import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mockAdapter } from '../../../adapters/index.js';
import type { IntegrationId } from '../../connectors/src/index.js';
import { ArtifactPayloadSchema, IdSchema, type Artifact, type Job, type Source } from '../../schemas/src/index.js';
import { canonical, GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { TenantStore } from '../../storage/src/index.js';
import { loadBrand, loadPolicy, loadWorkflow, parseWith, readText, safeDirectory, safePath } from './workspace.js';

export interface RunOptions { offline: boolean; idempotencyKey?: string; sourceIds?: string[]; maxStages?: number }
const SKILL_ADAPTERS: Record<string, IntegrationId> = {
  'graphic-design': 'satori-sharp', 'video-storyboard': 'ffmpeg', 'video-editing': 'ffmpeg',
  'product-demo-capture': 'playwright', 'analytics-attribution': 'posthog', 'research-intelligence': 'rss',
};

export class WorkflowEngine {
  constructor(readonly root: string, readonly store: TenantStore) {}

  private check(offline: boolean): void {
    if (!offline) throw new GtmError('OFFLINE_REQUIRED', 'Explicit --offline is required; no provider calls are available', 3);
    loadPolicy(this.root); loadBrand(this.root, this.store.tenant);
    if (!this.store.verifyAudit().valid) throw new GtmError('AUDIT_INVALID', 'Audit chain verification failed');
  }
  private fingerprint(workflowId: string, sourceIds: string[]): string {
    const { definition, sha256: revision } = loadWorkflow(this.root, workflowId);
    const files = ['AGENTS.md', 'brands/AGENTS.md', 'config/defaults.yaml', 'config/feature-flags.yaml',
      ...['AGENTS.md', 'VOICE.md', 'DESIGN.md', 'profile.json', 'tokens.json', 'claims-ledger.yaml'].map(name => `brands/${this.store.tenant}/${name}`),
      ...definition.stages.map(stage => `.agents/skills/${stage.skill}/SKILL.md`)];
    return hashObject({ tenant: this.store.tenant, workflowId, revision, sourceIds,
      context: files.map(path => ({ path, sha256: sha256(readText(this.root, path)) })), mode: 'OFFLINE_SYNTHETIC', engineRevision: 'phase-b-r1' });
  }

  run(workflowId: string, options: RunOptions): Job {
    this.check(options.offline);
    const { sha256: definitionSha256 } = loadWorkflow(this.root, workflowId);
    const idempotencyKey = parseWith(IdSchema, options.idempotencyKey ?? `run_${randomUUID()}`, 'idempotency key');
    const previous = this.store.jobByKey(idempotencyKey);
    if (previous) {
      if (previous.workflowId !== workflowId || (options.sourceIds && canonical(options.sourceIds) !== canonical(previous.sourceIds))) throw new GtmError('IDEMPOTENCY_CONFLICT', 'Idempotency key already binds different inputs');
      return this.resume(previous.id, options);
    }
    const at = new Date().toISOString();
    const sourceId = `source_${hashObject({ tenant: this.store.tenant, idempotencyKey }).slice(0, 32)}`;
    const body = { statement: 'SYNTHETIC illustrative workflow input. No product feature, user metric or founder achievement is asserted.',
      tenant: this.store.tenant, workflowId };
    const fixture: Source = { id: sourceId, tenant: this.store.tenant, uri: `fixture://${this.store.tenant}/phase-b/${sourceId}`,
      revision: 'phase-b-fixture-r1', observedAt: at, expiresAt: new Date(Date.parse(at) + 86_400_000).toISOString(),
      contentSha256: hashObject(body), classification: 'SYNTHETIC', license: 'NO_EXTERNAL_ASSETS', body };
    const sourceIds = options.sourceIds ?? [sourceId];
    const job = this.store.createJob({ id: `job_${randomUUID()}`, tenant: this.store.tenant, workflowId, definitionSha256,
      inputSha256: this.fingerprint(workflowId, sourceIds), idempotencyKey, sourceIds, createdAt: at, updatedAt: at,
      checkpoint: 0, version: 0, state: 'PENDING', synthetic: true, offline: true }, options.sourceIds ? undefined : fixture);
    return this.resume(job.id, options);
  }

  resume(jobId: string, options: Pick<RunOptions, 'offline' | 'maxStages'>): Job {
    this.check(options.offline);
    let job = this.store.getJob(jobId);
    const { definition, sha256: revision } = loadWorkflow(this.root, job.workflowId);
    if (revision !== job.definitionSha256 || this.fingerprint(job.workflowId, job.sourceIds) !== job.inputSha256) throw new GtmError('INPUT_CHANGED', 'Workflow or scoped inputs changed; create a newly reviewed job');
    for (const id of job.sourceIds) {
      const source = this.store.getSource(id);
      if (Date.parse(source.expiresAt) <= Date.now() || Date.parse(source.observedAt) > Date.now()) throw new GtmError('SOURCE_EXPIRED', 'Source validity window expired or is in the future');
    }
    this.verifyArtifacts(job, definition.stages);
    if (!['PENDING', 'RUNNING'].includes(job.state)) return job;
    if (job.state === 'PENDING') job = this.store.transition(job.id, job.version, 'RUNNING');
    let completed = 0;
    const limit = options.maxStages ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isSafeInteger(limit) || limit < 1) throw new GtmError('INVALID_LIMIT', 'maxStages must be a positive integer', 2);
    while (job.checkpoint < definition.stages.length && completed < limit) {
      const stage = definition.stages[job.checkpoint];
      if (!stage) throw new GtmError('CHECKPOINT_INVALID', 'Checkpoint is outside workflow stages');
      const previous = this.store.artifacts(job.id);
      if (stage.skill === 'social-publishing') {
        return this.store.pauseForApproval(job.id, job.version, stage.id, hashObject({ tenant: job.tenant,
          jobId: job.id, workflowSha256: revision, artifactHashes: previous.map(a => a.sha256), sourceIds: job.sourceIds }));
      }
      const adapter = mockAdapter(SKILL_ADAPTERS[stage.skill] ?? 'local-fixture');
      const receipt = adapter.dryRun({ tenant: job.tenant, jobId: job.id, action: 'draft', sourceIds: job.sourceIds,
        inputHashes: previous.map(a => a.sha256), parameters: { skill: stage.skill } });
      const payload = parseWith(ArtifactPayloadSchema, {
        id: `artifact_${hashObject({ jobId: job.id, stageId: stage.id }).slice(0, 32)}`,
        revision: 'phase-b-r1',
        tenant: job.tenant, jobId: job.id, stageId: stage.id, skill: stage.skill, sourceIds: job.sourceIds,
        inputArtifactHashes: previous.map(a => a.sha256), createdAt: job.createdAt,
        label: 'SYNTHETIC', format: 'application/json', approvalStatus: 'NOT_APPROVED',
        audience: 'Owner and local runtime reviewers', assetLicense: 'NO_EXTERNAL_ASSETS',
        data: { proposedOutput: stage.output, mode: 'MOCK', receipt },
        limitations: ['Phase B deterministic contract fixture; not a completed marketing deliverable.',
          'No real media, product verification, analytics, account access or publication.'],
      }, 'artifact payload');
      safeDirectory(this.root, `runtime/artifacts/${job.tenant}/${job.id}`);
      const relativePath = `runtime/artifacts/${job.tenant}/${job.id}/${stage.id}.json`;
      const path = safePath(this.root, relativePath); const bytes = canonical(payload); const hash = sha256(bytes);
      if (existsSync(path)) {
        if (sha256(readFileSync(path)) !== hash) throw new GtmError('ARTIFACT_HASH', 'Uncommitted artifact file hash mismatch');
      } else {
        try { writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 }); }
        catch (error) {
          if (!existsSync(path) || sha256(readFileSync(path)) !== hash) throw error;
        }
      }
      const artifact: Artifact = { ...payload, sha256: hash, relativePath };
      job = this.store.completeStep(job.id, job.version, artifact); completed += 1;
    }
    return job.checkpoint === definition.stages.length ? this.store.transition(job.id, job.version, 'COMPLETED_LOCAL') : job;
  }

  private verifyArtifacts(job: Job, stages: { id: string; skill: string }[]): void {
    const artifacts = this.store.artifacts(job.id);
    if (artifacts.length !== job.checkpoint) throw new GtmError('CHECKPOINT_INVALID', 'Checkpoint/artifact count mismatch');
    const completed = this.store.audit().filter(event => event.jobId === job.id && event.kind === 'stage.completed');
    if (completed.length !== artifacts.length || job.checkpoint > stages.length) throw new GtmError('CHECKPOINT_INVALID', 'Audit/checkpoint/artifact count mismatch');
    for (const [index, artifact] of artifacts.entries()) {
      const { sha256: hash, relativePath, ...payload } = artifact;
      const expected = `runtime/artifacts/${job.tenant}/${job.id}/${artifact.stageId}.json`;
      if (artifact.jobId !== job.id || artifact.stageId !== stages[index]?.id || artifact.skill !== stages[index]?.skill ||
          canonical(artifact.sourceIds) !== canonical(job.sourceIds) ||
          canonical(artifact.inputArtifactHashes) !== canonical(artifacts.slice(0, index).map(a => a.sha256)) ||
          completed[index]?.data.sha256 !== hash || completed[index]?.data.artifactId !== artifact.id) {
        throw new GtmError('ARTIFACT_LINEAGE', 'Artifact lineage does not match workflow sources, stages or audit');
      }
      if (relativePath !== expected || hashObject(payload) !== hash || !existsSync(safePath(this.root, relativePath)) ||
          sha256(readFileSync(safePath(this.root, relativePath))) !== hash) throw new GtmError('ARTIFACT_HASH', 'Committed artifact hash or path mismatch');
    }
    if (job.state === 'COMPLETED_LOCAL' && job.checkpoint !== stages.length) throw new GtmError('CHECKPOINT_INVALID', 'Completed workflow has unfinished stages');
    if (job.state === 'AWAITING_APPROVAL' && (stages[job.checkpoint]?.skill !== 'social-publishing' || this.store.outbox(job.id).length !== 1)) throw new GtmError('CHECKPOINT_INVALID', 'Approval checkpoint/outbox mismatch');
  }
}
