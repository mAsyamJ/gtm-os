import Database from 'better-sqlite3';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { integrationCatalog, unavailableAdapter } from '../../../adapters/index.js';
import { WorkflowEngine } from '../../core/src/engine.js';
import { claimsAudit, listSkills, listWorkflows, loadBrand, loadPolicy, parseWith, readStructured, readText, safePath } from '../../core/src/workspace.js';
import { GtmError, publicError, redact } from '../../observability/src/index.js';
import { denyExternalAction } from '../../policy/src/index.js';
import { HANDLES, TENANTS, TenantSchema, type Tenant } from '../../schemas/src/index.js';
import { TenantStore } from '../../storage/src/index.js';
import { auditReferences, ingestSource, researchReport, saveResearchOutput } from '../../research/src/index.js';
import { contentBrief, contentCalendar, icpHypothesis, strategyPlan } from '../../strategy/src/index.js';

const HELP = `GTM OS 0.2.0 — Phase C local/offline CLI

Working commands:
  gtm doctor [--json]
  gtm install audit | skills list | agents list | workflow list
  gtm brand show|validate --brand retropick|founder
  gtm workflow run NAME --brand TENANT --offline [--idempotency-key KEY] [--max-stages N]
  gtm workflow resume JOB_ID --brand TENANT --offline [--max-stages N]
  gtm claims audit --brand TENANT
  gtm costs report [--brand TENANT]
  gtm audit trace --brand TENANT --job JOB_ID
  gtm research ingest --brand TENANT --source research/inbox/TENANT/FILE.json --offline
  gtm research daily|sources --brand TENANT --offline
  gtm strategy icp --brand TENANT
  gtm strategy plan --brand TENANT --days 30 [--from YYYY-MM-DD]
  gtm campaign plan --brand TENANT --days 30 [--from YYYY-MM-DD]
  gtm content calendar --brand TENANT --days 14 [--from YYYY-MM-DD]
  gtm content brief --brand TENANT --topic TOPIC [--source SOURCE_ID]
  gtm x auth status --brand TENANT  (BLOCKED; no authentication probe)

All commands support --json. --root PATH selects an explicit local workspace.
Workflow artifacts are SYNTHETIC JSON contract fixtures, not completed marketing/media.
Publication, scheduling, outreach and paid calls always fail closed. No command authorizes a write.
Research uses authorized inbox files only; generated plans are hypotheses pending topic proof.
Other campaign/content/design/video/analytics/experiments/assets/benchmark commands
are explicit later-phase blocked boundaries. Use --help with any command.
Exit: 0 local success; 2 invalid input; 3 permission denied; 4 capability unavailable;
      5 validation failed; 6 execution failed. --version reports this local CLI version.`;

const OPTIONS = {
  brand: { type: 'string' }, root: { type: 'string' }, json: { type: 'boolean' }, offline: { type: 'boolean' },
  'dry-run': { type: 'boolean' }, synthetic: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' }, 'idempotency-key': { type: 'string' }, 'max-stages': { type: 'string' },
  job: { type: 'string' }, draft: { type: 'string' }, id: { type: 'string' }, source: { type: 'string' },
  topic: { type: 'string' }, type: { type: 'string' }, days: { type: 'string' }, from: { type: 'string' },
  template: { type: 'string' }, fixture: { type: 'string' }, period: { type: 'string' },
} as const;
type Values = ReturnType<typeof parseOptions>['values'];
function parseOptions(args: string[]) { return parseArgs({ args, options: OPTIONS, allowPositionals: true, strict: true }); }
function selected(values: Values): Tenant {
  if (!values.brand) throw new GtmError('BRAND_REQUIRED', 'Explicit --brand retropick|founder is required', 2);
  const parsed = TenantSchema.safeParse(values.brand);
  if (!parsed.success) throw new GtmError('INVALID_BRAND', 'Brand must be retropick or founder', 2);
  return parsed.data;
}
function maxStages(values: Values): number | undefined {
  if (values['max-stages'] === undefined) return undefined;
  const value = Number(values['max-stages']);
  if (!Number.isSafeInteger(value) || value < 1) throw new GtmError('INVALID_LIMIT', '--max-stages must be a positive integer', 2);
  return value;
}
function need(values: Values, name: 'job'): string {
  const value = values[name];
  if (!value) throw new GtmError('ARGUMENT_REQUIRED', `--${name} is required`, 2);
  return value;
}

function costs(root: string, tenants: readonly Tenant[]) {
  return tenants.map(tenant => {
    const path = safePath(root, `runtime/state/${tenant}/gtm.sqlite`);
    if (!existsSync(path)) return { tenant, status: 'NO_DATA', entries: 0, actualUsd: 0, estimatedUsd: 0, computeCost: 'NOT_MEASURED', modelTokens: null };
    using store = new TenantStore(root, tenant, { readonly: true });
    if (!store.verifyAudit().valid) throw new GtmError('AUDIT_INVALID', 'Audit chain verification failed');
    const entries = store.costs();
    return { tenant, status: entries.length ? 'OFFLINE_SYNTHETIC_WORK' : 'NO_DATA', entries: entries.length,
      actualUsd: entries.reduce((sum, e) => sum + e.actualUsd, 0), estimatedUsd: entries.reduce((sum, e) => sum + e.estimatedUsd, 0),
      computeCost: 'NOT_MEASURED', modelTokens: null };
  });
}

function doctor(root: string) {
  loadPolicy(root);
  const skills = listSkills(root); const workflows = listWorkflows(root);
  const brands = TENANTS.map(tenant => ({ tenant, profileValid: Boolean(loadBrand(root, tenant)),
    expectedHandle: HANDLES[tenant], principalVerified: false, claims: claimsAudit(root, tenant) }));
  const db = new Database(':memory:');
  let sqlite: { version: string };
  try { sqlite = db.prepare('SELECT sqlite_version() AS version').get() as { version: string }; }
  finally { db.close(); }
  const stores = TENANTS.map(tenant => {
    if (!existsSync(safePath(root, `runtime/state/${tenant}/gtm.sqlite`))) return { tenant, status: 'NOT_INITIALIZED' };
    using store = new TenantStore(root, tenant, { readonly: true });
    const audit = store.verifyAudit();
    if (!store.integrity() || !audit.valid) throw new GtmError('STORAGE_INVALID', 'Tenant database or audit integrity check failed');
    return { tenant, status: 'LOCAL_STORE_VERIFIED', audit };
  });
  return { readyForPhaseBOffline: true, node: process.version, sqlite: sqlite.version,
    skills: skills.length, workflows: workflows.length, brands, stores,
    integrations: integrationCatalog(), liveProviders: 'BLOCKED_NOT_CONNECTED',
    researchStrategy: { status: 'LOCAL_IMPLEMENTED', sourceRetrieval: 'AUTHORIZED_FILES_ONLY', liveFacts: 'NOT_ESTABLISHED' },
    missingComponents: ['Real graphics/video: Phase D',
      'OAuth, signed owner approvals, live distribution and analytics: Phase E', 'Full campaign simulations: Phase F'],
    policy: { publishEnabled: false, externalWrites: false, paidApiEnabled: false, xMonthlyCapUsd: 0 },
    modelRouting: 'NOT_INVOKED', benchmarkSavings: 'NOT_MEASURED' };
}

export function main(argv: string[], defaultRoot: string): number {
  let json = argv.includes('--json');
  try {
    let parsed: ReturnType<typeof parseOptions>;
    try { parsed = parseOptions(argv); } catch { throw new GtmError('INVALID_ARGUMENTS', 'Invalid command options; run gtm --help', 2); }
    const { values, positionals: words } = parsed; json = values.json === true;
    if (values.help || !words.length && !values.version) {
      process.stdout.write(json ? JSON.stringify({ status: 'PASS', help: HELP }) + '\n' : HELP + '\n'); return 0;
    }
    if (values.version) { process.stdout.write(json ? JSON.stringify({ version: '0.2.0' }) + '\n' : '0.2.0\n'); return 0; }
    const root = resolve(values.root ?? defaultRoot);
    readText(root, 'AGENTS.md');
    if (values.brand !== undefined) selected(values);
    const key = words.slice(0, 2).join(' ');
    let data: unknown;
    let status = 'PASS';
    if (key === 'doctor') data = doctor(root);
    else if (key === 'skills list') data = listSkills(root);
    else if (key === 'agents list') data = readdirSync(safePath(root, 'agents/roles'), { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => ({ id: entry.name, path: `agents/roles/${entry.name}/ROLE.md`, runtimeAgent: false })).sort((a, b) => a.id.localeCompare(b.id));
    else if (key === 'workflow list') data = listWorkflows(root).map(w => ({ id: w.definition.id, owner: w.definition.owner,
      description: w.definition.description, stages: w.definition.stages.length, definitionSha256: w.sha256, execution: 'OFFLINE_SYNTHETIC' }));
    else if (key === 'install audit') data = { upstreamSkills: auditReferences(root),
      projectDependencies: parseWith(z.object({ dependencies: z.record(z.string(), z.string()), devDependencies: z.record(z.string(), z.string()) }),
        readStructured(root, 'package.json'), 'project package manifest'), activatedProviderConnections: 0, note: 'Local inventory only; no registry or dependency audit request was made.' };
    else if (key === 'brand show' || key === 'brand validate') {
      const brand = loadBrand(root, selected(values));
      data = key === 'brand show' ? brand : { tenant: brand.tenant, profileValid: true, claims: claimsAudit(root, brand.tenant),
        officialAssetsVerified: false, principalVerified: false, publicationAuthorized: false };
    } else if (key === 'claims audit') {
      data = claimsAudit(root, selected(values));
      if ((data as ReturnType<typeof claimsAudit>).issues.length) throw new GtmError('CLAIMS_INVALID', 'Claims audit failed; verify source validity and review status');
    } else if (key === 'costs report') data = { reports: costs(root, values.brand ? [selected(values)] : TENANTS), currency: 'USD',
      attribution: 'Recorded project provider calls only; no real-user metrics', operatorModelCost: 'NOT_MEASURED' };
    else if (key === 'workflow run' || key === 'workflow resume') {
      const tenant = selected(values);
      if (words.length !== 3) throw new GtmError('WORKFLOW_ARGUMENT', 'Provide exactly one workflow name or job ID', 2);
      if (!values.offline) throw new GtmError('OFFLINE_REQUIRED', 'Explicit --offline is required', 3);
      if (values.fixture !== undefined && values.fixture !== 'synthetic') throw new GtmError('FIXTURE_UNAVAILABLE', 'Only the declared synthetic fixture is available', 4);
      if (values.source) throw new GtmError('SOURCE_INGESTION_UNAVAILABLE', 'CLI source ingestion is Phase C; use the synthetic fixture in Phase B', 4);
      loadPolicy(root); loadBrand(root, tenant);
      const limit = maxStages(values);
      if (key === 'workflow resume' && !existsSync(safePath(root, `runtime/state/${tenant}/gtm.sqlite`))) throw new GtmError('STORE_MISSING', 'Tenant database does not exist', 4);
      using store = new TenantStore(root, tenant); const engine = new WorkflowEngine(root, store);
      const options = { offline: true, ...(limit === undefined ? {} : { maxStages: limit }),
        ...(values['idempotency-key'] ? { idempotencyKey: values['idempotency-key'] } : {}) };
      const argument = words[2]; if (!argument) throw new GtmError('WORKFLOW_ARGUMENT', 'Workflow argument required', 2);
      const job = key === 'workflow run' ? engine.run(argument, options) : engine.resume(argument, options);
      status = job.state;
      data = { label: 'SYNTHETIC', job, artifacts: store.artifacts(job.id), outbox: store.outbox(job.id), audit: store.verifyAudit(),
        limitations: ['JSON contract fixtures only; no completed marketing content, media, provider call or signed owner approval.'] };
    } else if (key === 'audit trace') {
      const tenant = selected(values); const jobId = need(values, 'job');
      using store = new TenantStore(root, tenant, { readonly: true });
      const job = store.getJob(jobId); const audit = store.verifyAudit();
      if (!audit.valid) throw new GtmError('AUDIT_INVALID', 'Audit chain verification failed');
      data = { tenant, job, audit, events: store.audit().filter(e => e.jobId === jobId), sourceIds: job.sourceIds,
        sources: job.sourceIds.map(id => store.getSource(id)), artifacts: store.artifacts(jobId), outbox: store.outbox(jobId) };
    } else if (['research ingest', 'research daily', 'research sources'].includes(key)) {
      const tenant = selected(values);
      if (!values.offline) throw new GtmError('OFFLINE_REQUIRED', 'Research requires explicit --offline; runtime URL retrieval is unavailable', 3);
      if (words.length !== 2) throw new GtmError('INVALID_ARGUMENTS', 'Unexpected research arguments', 2);
      if (key === 'research ingest') {
        if (!values.source) throw new GtmError('SOURCE_REQUIRED', 'Provide --source with a selected tenant inbox JSON path', 2);
        const result = ingestSource(root, tenant, values.source);
        data = { tenant, sourceId: result.source.id, contentSha256: result.source.contentSha256,
          verification: result.card.verification, evidenceScope: result.card.evidenceScope, publicationAuthorized: false };
      } else {
        data = researchReport(root, tenant);
        status = (data as ReturnType<typeof researchReport>).cards.length ? 'PASS' : 'NO_DATA';
      }
    } else if (['strategy icp', 'strategy plan', 'campaign plan', 'content calendar', 'content brief'].includes(key)) {
      const tenant = selected(values);
      if (words.length !== 2) throw new GtmError('INVALID_ARGUMENTS', 'Unexpected planning arguments', 2);
      const days = values.days === undefined ? undefined : Number(values.days);
      if (days !== undefined && !Number.isSafeInteger(days)) throw new GtmError('INVALID_DAYS', '--days must be an integer', 2);
      const options = { ...(days === undefined ? {} : { days }), ...(values.from ? { start: values.from } : {}) };
      let document: unknown;
      if (key === 'content calendar') document = contentCalendar(root, tenant, options);
      else if (key === 'strategy plan' || key === 'campaign plan') document = strategyPlan(root, tenant, options);
      else if (key === 'strategy icp') document = icpHypothesis(root, tenant);
      else {
        if (!values.topic) throw new GtmError('TOPIC_REQUIRED', 'Provide --topic for a content brief', 2);
        document = contentBrief(root, tenant, values.topic, values.source);
      }
      data = saveResearchOutput(root, tenant, key.replace(' ', '-'), document);
      status = 'LOCAL_DRAFT_REQUIRES_REVIEW';
    } else if (words.join(' ') === 'x auth status') {
      const tenant = selected(values); const identity = unavailableAdapter('x-official').identity(tenant);
      emit(json, 'BLOCKED', { identity, reason: 'No authenticated connection; no credential file or identity endpoint was inspected.' }); return 4;
    } else if (words[0] === 'publish' || ['schedule', 'outreach', 'deploy'].includes(words[0] ?? '')) {
      selected(values); denyExternalAction();
    } else if (['research', 'strategy', 'campaign', 'content', 'design', 'video', 'analytics', 'experiments', 'assets'].includes(words[0] ?? '')) {
      selected(values); throw new GtmError('LATER_PHASE_CAPABILITY', 'This command requires a later phase; no source, content, media or analytics output was generated', 4);
    } else if (key === 'benchmark run') throw new GtmError('BENCHMARK_NOT_MEASURED', 'Model/compute benchmarks are not implemented or measured', 4);
    else throw new GtmError('UNKNOWN_COMMAND', 'Unknown command; run gtm --help', 2);
    emit(json, status, data); return 0;
  } catch (error) {
    const failure = publicError(error);
    emit(json, failure.exitCode === 3 || failure.exitCode === 4 ? 'BLOCKED' : 'FAIL', { error: { code: failure.code, message: failure.message } });
    return failure.exitCode;
  }
}

function emit(json: boolean, status: string, data: unknown): void {
  const result = redact({ status, data });
  process.stdout.write(JSON.stringify(result, null, json ? undefined : 2) + '\n');
}
