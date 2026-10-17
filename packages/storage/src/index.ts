import Database from 'better-sqlite3';
import { chmodSync, existsSync, lstatSync, readFileSync } from 'node:fs';
import { ArtifactPayloadSchema, ArtifactSchema, AuditEventSchema, CostSchema, IdSchema, JobSchema, OutboxSchema, SourceSchema, TenantSchema,
  type Artifact, type AuditEvent, type Cost, type Data, type Job, type JobState, type Outbox, type Source, type Tenant } from '../../schemas/src/index.js';
import { canonical, GtmError, hashObject, redact, sha256 } from '../../observability/src/index.js';
import { parseWith, safeDirectory, safePath } from '../../core/src/workspace.js';

const ZERO = '0'.repeat(64);
const TRANSITIONS: Record<JobState, readonly JobState[]> = {
  PENDING: ['RUNNING', 'BLOCKED', 'FAILED', 'CANCELLED'],
  RUNNING: ['AWAITING_APPROVAL', 'COMPLETED_LOCAL', 'BLOCKED', 'FAILED', 'CANCELLED'],
  AWAITING_APPROVAL: ['BLOCKED', 'CANCELLED'], COMPLETED_LOCAL: [], BLOCKED: [], FAILED: [], CANCELLED: [],
};
interface JsonRow { data: string }
interface AuditRow { seq: number; tenant_id: string; job_id: string | null; kind: string; at: string; data: string; previous_hash: string; hash: string }

export class TenantStore {
  readonly tenant: Tenant;
  readonly path: string;
  readonly #db: Database.Database;
  readonly #readonly: boolean;
  #closed = false;

  constructor(readonly root: string, selected: unknown, options: { readonly?: boolean } = {}) {
    this.tenant = parseWith(TenantSchema, selected, 'tenant');
    this.#readonly = options.readonly === true;
    this.path = safePath(root, `runtime/state/${this.tenant}/gtm.sqlite`);
    const present = existsSync(this.path);
    if (!present && this.#readonly) throw new GtmError('STORE_MISSING', 'Tenant database does not exist', 4);
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const path = safePath(root, `runtime/state/${this.tenant}/gtm.sqlite${suffix}`);
      if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).nlink > 1)) throw new GtmError('UNSAFE_DATABASE', 'Database links or non-files are forbidden');
    }
    if (present) {
      const probe = new Database(this.path, { readonly: true, fileMustExist: true });
      try {
        const meta = probe.prepare('SELECT tenant_id FROM tenant_meta WHERE singleton=1').get() as { tenant_id: string } | undefined;
        if (meta?.tenant_id !== this.tenant) throw new GtmError('TENANT_MISMATCH', 'Database tenant does not match selected tenant');
        if (probe.pragma('user_version', { simple: true }) !== 1) throw new GtmError('MIGRATION_UNSUPPORTED', 'Database schema revision is unsupported');
      } catch (error) {
        if (error instanceof GtmError) throw error;
        throw new GtmError('STORAGE_INVALID', 'Tenant database failed schema/identity validation');
      } finally { probe.close(); }
    } else safeDirectory(root, `runtime/state/${this.tenant}`);
    this.#db = new Database(this.path, { readonly: this.#readonly, fileMustExist: this.#readonly, timeout: 5000 });
    this.#db.pragma('foreign_keys = ON');
    if (!this.#readonly) {
      this.#db.pragma('journal_mode = WAL');
      this.#db.pragma('synchronous = FULL');
      if (!present) this.migrate();
      chmodSync(this.path, 0o600);
    }
  }

  private migrate(): void {
    const tenant = this.tenant; // Enum-validated SQL constant, never arbitrary input.
    this.#db.transaction(() => {
      this.#db.exec(`
        CREATE TABLE tenant_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), tenant_id TEXT NOT NULL CHECK(tenant_id='${tenant}'));
        CREATE TABLE sources (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL CHECK(tenant_id='${tenant}'), data TEXT NOT NULL CHECK(json_valid(data)));
        CREATE TABLE jobs (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL CHECK(tenant_id='${tenant}'), idempotency_key TEXT NOT NULL UNIQUE,
          data TEXT NOT NULL CHECK(json_valid(data)));
        CREATE TABLE job_sources (job_id TEXT NOT NULL REFERENCES jobs(id), source_id TEXT NOT NULL REFERENCES sources(id), PRIMARY KEY(job_id,source_id));
        CREATE TABLE artifacts (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL CHECK(tenant_id='${tenant}'), job_id TEXT NOT NULL REFERENCES jobs(id),
          stage_id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), UNIQUE(job_id,stage_id));
        CREATE TABLE artifact_sources (artifact_id TEXT NOT NULL REFERENCES artifacts(id), source_id TEXT NOT NULL REFERENCES sources(id), PRIMARY KEY(artifact_id,source_id));
        CREATE TABLE costs (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL CHECK(tenant_id='${tenant}'), job_id TEXT NOT NULL REFERENCES jobs(id),
          stage_id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), UNIQUE(job_id,stage_id));
        CREATE TABLE audit (seq INTEGER PRIMARY KEY, tenant_id TEXT NOT NULL CHECK(tenant_id='${tenant}'), job_id TEXT REFERENCES jobs(id),
          kind TEXT NOT NULL, at TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), previous_hash TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE outbox (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL CHECK(tenant_id='${tenant}'), job_id TEXT NOT NULL REFERENCES jobs(id),
          stage_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status='BLOCKED'), data TEXT NOT NULL CHECK(json_valid(data)), UNIQUE(job_id,stage_id));
        CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
        CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
        CREATE TRIGGER sources_no_update BEFORE UPDATE ON sources BEGIN SELECT RAISE(ABORT,'sources are immutable'); END;
        CREATE TRIGGER sources_no_delete BEFORE DELETE ON sources BEGIN SELECT RAISE(ABORT,'sources are immutable'); END;
        CREATE TRIGGER costs_no_update BEFORE UPDATE ON costs BEGIN SELECT RAISE(ABORT,'costs are append-only'); END;
        CREATE TRIGGER costs_no_delete BEFORE DELETE ON costs BEGIN SELECT RAISE(ABORT,'costs are append-only'); END;
        PRAGMA user_version = 1;
      `);
      this.#db.prepare('INSERT INTO tenant_meta VALUES (1,?)').run(tenant);
    }).immediate();
  }

  private writable(): void {
    if (this.#readonly) throw new GtmError('STORE_READ_ONLY', 'Read-only report cannot mutate state', 3);
  }
  private scoped(tenant: Tenant): void {
    if (tenant !== this.tenant) throw new GtmError('TENANT_MISMATCH', 'Object tenant does not match selected tenant');
  }
  private append(kind: string, jobId: string | null, data: Data): void {
    const previous = this.#db.prepare('SELECT seq,hash FROM audit ORDER BY seq DESC LIMIT 1').get() as { seq: number; hash: string } | undefined;
    const base = { seq: (previous?.seq ?? 0) + 1, tenant: this.tenant, jobId, kind, at: new Date().toISOString(),
      data: redact(data), previousHash: previous?.hash ?? ZERO };
    const event = parseWith(AuditEventSchema, { ...base, hash: hashObject(base) }, 'audit event');
    this.#db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?,?,?)')
      .run(event.seq, this.tenant, jobId, kind, event.at, canonical(event.data), event.previousHash, event.hash);
  }

  putSource(input: Source): Source {
    this.writable();
    const value = parseWith(SourceSchema, input, 'source'); this.scoped(value.tenant);
    if (value.contentSha256 !== hashObject(value.body)) throw new GtmError('SOURCE_HASH', 'Source content hash mismatch');
    if (canonical(value.body) !== canonical(redact(value.body))) throw new GtmError('SOURCE_SENSITIVE', 'Source contains sensitive data; reject rather than alter evidence');
    return this.#db.transaction(() => {
      const row = this.#db.prepare('SELECT data FROM sources WHERE id=?').get(value.id) as JsonRow | undefined;
      if (row) {
        if (row.data !== canonical(value)) throw new GtmError('SOURCE_IMMUTABLE', 'Source revision is immutable; use a new source identifier');
        return value;
      }
      this.#db.prepare('INSERT INTO sources VALUES (?,?,?)').run(value.id, this.tenant, canonical(value));
      this.append('source.recorded', null, { sourceId: value.id, contentSha256: value.contentSha256, classification: value.classification });
      return value;
    }).immediate();
  }
  sources(): Source[] {
    return (this.#db.prepare('SELECT data FROM sources ORDER BY id').all() as JsonRow[]).map(row => {
      const source = parseWith(SourceSchema, JSON.parse(row.data), 'stored source'); this.scoped(source.tenant);
      if (source.contentSha256 !== hashObject(source.body)) throw new GtmError('SOURCE_HASH', 'Stored source hash mismatch');
      return source;
    });
  }
  getSource(id: string): Source {
    const source = this.sources().find(s => s.id === id);
    if (!source) throw new GtmError('SOURCE_NOT_FOUND', 'Source not found in selected tenant');
    return source;
  }
  jobByKey(key: string): Job | undefined {
    const row = this.#db.prepare('SELECT data FROM jobs WHERE idempotency_key=?').get(key) as JsonRow | undefined;
    if (!row) return undefined;
    const job = parseWith(JobSchema, JSON.parse(row.data), 'stored job'); this.scoped(job.tenant); return job;
  }
  getJob(id: string): Job {
    parseWith(IdSchema, id, 'job identifier');
    const row = this.#db.prepare('SELECT data FROM jobs WHERE id=?').get(id) as JsonRow | undefined;
    if (!row) throw new GtmError('JOB_NOT_FOUND', 'Job not found in selected tenant');
    const job = parseWith(JobSchema, JSON.parse(row.data), 'stored job'); this.scoped(job.tenant); return job;
  }
  createJob(input: Job, source?: Source): Job {
    this.writable(); const value = parseWith(JobSchema, input, 'job'); this.scoped(value.tenant);
    return this.#db.transaction(() => {
      const existing = this.jobByKey(value.idempotencyKey);
      if (existing) {
        if (existing.inputSha256 !== value.inputSha256 || existing.workflowId !== value.workflowId) throw new GtmError('IDEMPOTENCY_CONFLICT', 'Idempotency key already binds different inputs');
        return existing;
      }
      if (source) this.putSource(source);
      for (const id of value.sourceIds) this.getSource(id);
      if (value.state !== 'PENDING' || value.version !== 0 || value.checkpoint !== 0) throw new GtmError('JOB_INITIAL_STATE', 'New jobs must start pending at checkpoint zero');
      this.#db.prepare('INSERT INTO jobs VALUES (?,?,?,?)').run(value.id, this.tenant, value.idempotencyKey, canonical(value));
      for (const id of value.sourceIds) this.#db.prepare('INSERT INTO job_sources VALUES (?,?)').run(value.id, id);
      this.append('job.created', value.id, { workflowId: value.workflowId, sourceIds: value.sourceIds, inputSha256: value.inputSha256 });
      return value;
    }).immediate();
  }
  private update(job: Job): Job {
    const updated = { ...job, version: job.version + 1, updatedAt: new Date().toISOString() };
    this.#db.prepare('UPDATE jobs SET data=? WHERE id=?').run(canonical(updated), job.id);
    return updated;
  }
  transition(id: string, expectedVersion: number, next: JobState): Job {
    this.writable();
    return this.#db.transaction(() => {
      const job = this.getJob(id);
      if (job.version !== expectedVersion) throw new GtmError('STALE_VERSION', 'Job version changed; reload checkpoint');
      if (job.state === next) return job;
      if (!TRANSITIONS[job.state].includes(next)) throw new GtmError('ILLEGAL_TRANSITION', 'Illegal workflow state transition');
      const updated = this.update({ ...job, state: next });
      this.append('job.transition', id, { from: job.state, to: next, version: updated.version });
      return updated;
    }).immediate();
  }
  artifacts(jobId: string): Artifact[] {
    this.getJob(jobId);
    return (this.#db.prepare('SELECT data FROM artifacts WHERE job_id=? ORDER BY rowid').all(jobId) as JsonRow[]).map(row => {
      const a = parseWith(ArtifactSchema, JSON.parse(row.data), 'stored artifact'); this.scoped(a.tenant); return a;
    });
  }
  completeStep(jobId: string, expectedVersion: number, input: Artifact): Job {
    this.writable(); const artifact = parseWith(ArtifactSchema, input, 'artifact'); this.scoped(artifact.tenant);
    if (artifact.jobId !== jobId) throw new GtmError('ARTIFACT_JOB_MISMATCH', 'Artifact references a different job');
    const { sha256: hash, relativePath, ...payload } = artifact;
    if (hashObject(ArtifactPayloadSchema.parse(payload)) !== hash) throw new GtmError('ARTIFACT_HASH', 'Artifact payload hash mismatch');
    const expectedPath = `runtime/artifacts/${this.tenant}/${jobId}/${artifact.stageId}.json`;
    if (relativePath !== expectedPath || sha256(readFileSync(safePath(this.root, relativePath))) !== hash) throw new GtmError('ARTIFACT_HASH', 'Artifact path or file hash mismatch');
    return this.#db.transaction(() => {
      const job = this.getJob(jobId);
      const existing = this.#db.prepare('SELECT data FROM artifacts WHERE job_id=? AND stage_id=?').get(jobId, artifact.stageId) as JsonRow | undefined;
      if (existing) {
        if (existing.data !== canonical(artifact)) throw new GtmError('ARTIFACT_IMMUTABLE', 'Committed artifact is immutable');
        return job;
      }
      if (job.version !== expectedVersion) throw new GtmError('STALE_VERSION', 'Job version changed; reload checkpoint');
      if (job.state !== 'RUNNING') throw new GtmError('ILLEGAL_TRANSITION', 'Stage requires a running job');
      if (canonical(job.sourceIds) !== canonical(artifact.sourceIds)) throw new GtmError('SOURCE_MISMATCH', 'Stage sources must match immutable job inputs');
      if (canonical(artifact.inputArtifactHashes) !== canonical(this.artifacts(jobId).map(a => a.sha256))) throw new GtmError('ARTIFACT_LINEAGE', 'Stage input hashes must match prior artifacts');
      for (const id of artifact.sourceIds) this.getSource(id);
      this.#db.prepare('INSERT INTO artifacts VALUES (?,?,?,?,?)').run(artifact.id, this.tenant, jobId, artifact.stageId, canonical(artifact));
      for (const id of artifact.sourceIds) this.#db.prepare('INSERT INTO artifact_sources VALUES (?,?)').run(artifact.id, id);
      const cost: Cost = { id: `cost_${artifact.id}`, tenant: this.tenant, jobId, stageId: artifact.stageId,
        estimatedUsd: 0, actualUsd: 0, currency: 'USD', basis: 'OFFLINE_NO_PROVIDER_CALL', modelTokens: null, computeCost: 'NOT_MEASURED' };
      this.#db.prepare('INSERT INTO costs VALUES (?,?,?,?,?)').run(cost.id, this.tenant, jobId, cost.stageId, canonical(cost));
      const updated = this.update({ ...job, checkpoint: job.checkpoint + 1 });
      this.append('stage.completed', jobId, { stageId: artifact.stageId, artifactId: artifact.id, sha256: hash,
        sourceIds: artifact.sourceIds, checkpoint: updated.checkpoint, synthetic: true });
      return updated;
    }).immediate();
  }
  pauseForApproval(jobId: string, expectedVersion: number, stageId: string, payloadSha256: string): Job {
    this.writable(); parseWith(IdSchema, stageId, 'stage identifier');
    return this.#db.transaction(() => {
      const job = this.getJob(jobId);
      if (job.state === 'AWAITING_APPROVAL') return job;
      if (job.version !== expectedVersion) throw new GtmError('STALE_VERSION', 'Job version changed; reload checkpoint');
      if (job.state !== 'RUNNING') throw new GtmError('ILLEGAL_TRANSITION', 'Approval gate requires a running job');
      const item = parseWith(OutboxSchema, { id: `outbox_${jobId}_${stageId}`, tenant: this.tenant, jobId, stageId,
        status: 'BLOCKED', reason: 'EXTERNAL_WRITES_DISABLED', payloadSha256, approval: null }, 'outbox');
      this.#db.prepare('INSERT INTO outbox VALUES (?,?,?,?,?,?)').run(item.id, this.tenant, jobId, stageId, item.status, canonical(item));
      const updated = this.update({ ...job, state: 'AWAITING_APPROVAL' });
      this.append('approval.required', jobId, { stageId, payloadSha256, signedApproval: false, externalWrites: false });
      return updated;
    }).immediate();
  }
  outbox(jobId: string): Outbox[] {
    this.getJob(jobId);
    return (this.#db.prepare('SELECT data FROM outbox WHERE job_id=? ORDER BY rowid').all(jobId) as JsonRow[]).map(row => {
      const item = parseWith(OutboxSchema, JSON.parse(row.data), 'outbox'); this.scoped(item.tenant);
      if (item.jobId !== jobId) throw new GtmError('OUTBOX_MISMATCH', 'Outbox belongs to another job');
      return item;
    });
  }
  costs(): Cost[] {
    return (this.#db.prepare('SELECT data FROM costs ORDER BY rowid').all() as JsonRow[]).map(row => {
      const cost = parseWith(CostSchema, JSON.parse(row.data), 'cost'); this.scoped(cost.tenant); return cost;
    });
  }
  audit(): AuditEvent[] {
    return (this.#db.prepare('SELECT * FROM audit ORDER BY seq').all() as AuditRow[]).map(row =>
      parseWith(AuditEventSchema, { seq: row.seq, tenant: row.tenant_id, jobId: row.job_id, kind: row.kind, at: row.at,
        data: JSON.parse(row.data), previousHash: row.previous_hash, hash: row.hash }, 'stored audit event'));
  }
  verifyAudit(): { valid: boolean; entries: number; headHash: string } {
    let previous = ZERO;
    try {
      const entries = this.audit();
      for (const [index, event] of entries.entries()) {
        const { hash, ...base } = event;
        if (event.tenant !== this.tenant || event.seq !== index + 1 || event.previousHash !== previous || hashObject(base) !== hash) return { valid: false, entries: entries.length, headHash: previous };
        previous = hash;
      }
      return { valid: true, entries: entries.length, headHash: previous };
    } catch { return { valid: false, entries: 0, headHash: previous }; }
  }
  integrity(): boolean { return this.#db.pragma('quick_check', { simple: true }) === 'ok'; }
  close(): void { if (!this.#closed) { this.#db.close(); this.#closed = true; } }
  [Symbol.dispose](): void { this.close(); }
}
