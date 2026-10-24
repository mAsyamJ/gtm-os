import Database from 'better-sqlite3';
import { chmodSync, existsSync, lstatSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { safeDirectory, safePath } from '../../core/src/workspace.js';
import { canonical, hashObject, GtmError, redact } from '../../observability/src/index.js';
import { TenantSchema, type Tenant } from '../../schemas/src/index.js';
import { Envelope, STATES, type Job, type State } from './contracts.js';

const transitions:Record<State,readonly State[]>={
  DRAFT:['REVIEWED'],REVIEWED:['APPROVAL_PENDING'],APPROVAL_PENDING:['APPROVED','HOLD'],APPROVED:['SUBMITTING','HOLD'],
  SUBMITTING:['SCHEDULED','SENT','FAILED','HOLD','RECONCILE_REQUIRED'],
  SCHEDULED:['SCHEDULED','SENT','FAILED','HOLD','RECONCILE_REQUIRED','CANCELLED'],
  SENT:['SENT','MEASURED','EXTERNAL_URL_PENDING','HOLD','RECONCILE_REQUIRED'],MEASURED:['SENT','MEASURED','EXTERNAL_URL_PENDING','HOLD','RECONCILE_REQUIRED'],
  EXTERNAL_URL_PENDING:['SENT','MEASURED','EXTERNAL_URL_PENDING','HOLD','RECONCILE_REQUIRED'],
  HOLD:['HOLD','APPROVED','SCHEDULED','SENT','FAILED','RECONCILE_REQUIRED','CANCELLED'],
  RECONCILE_REQUIRED:['RECONCILE_REQUIRED','SCHEDULED','SENT','FAILED','HOLD','CANCELLED'],FAILED:['FAILED','RECONCILE_REQUIRED','SCHEDULED','SENT','HOLD'],CANCELLED:['CANCELLED']
};

function connect(root: string, rel: string, readonly: boolean) {
  const path = safePath(root, rel);
  for (const suffix of ['', '-wal', '-shm', '-journal']) if (existsSync(path + suffix)) {
    const stat = lstatSync(path + suffix);
    if (!stat.isFile() || stat.nlink !== 1) throw new GtmError('UNSAFE_DATABASE', 'Database links and non-files denied', 3);
  }
  if (!readonly) safeDirectory(root, rel.slice(0, rel.lastIndexOf('/')));
  const db = new Database(path, { readonly, fileMustExist: readonly, timeout: 5000 });
  if (!readonly) { db.pragma('journal_mode=WAL'); db.pragma('synchronous=FULL'); chmodSync(path, 0o600); }
  db.pragma('foreign_keys=ON');
  return db;
}
export class PublishingStore {
  readonly tenant: Tenant;
  readonly db: Database.Database;
  constructor(readonly root: string, selected: unknown, readonly synthetic = false, readonly readonly = false) {
    this.tenant = TenantSchema.parse(selected);
    this.db = connect(root, `runtime/state/${this.tenant}/publishing-${synthetic ? 'synthetic' : 'observed'}.sqlite`, readonly);
    if (!readonly) this.db.transaction(() => {
      this.db.exec(`CREATE TABLE IF NOT EXISTS publishing_meta(tenant TEXT NOT NULL,synthetic INTEGER NOT NULL,version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS provider_channels(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS packets(id TEXT PRIMARY KEY,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS channel_leases(channel_id TEXT PRIMARY KEY,owner TEXT NOT NULL,until_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS publication_jobs(id TEXT PRIMARY KEY,tenant TEXT NOT NULL CHECK(tenant='${this.tenant}'),
          channel_id TEXT NOT NULL,content_hash TEXT NOT NULL,due_at TEXT NOT NULL,envelope TEXT NOT NULL,payload_hash TEXT NOT NULL,
          state TEXT NOT NULL CHECK(state IN (${STATES.map(s => `'${s}'`).join(',')})),provider_post_id TEXT UNIQUE,
          lease_owner TEXT,lease_until INTEGER,version INTEGER NOT NULL DEFAULT 0,
          UNIQUE(tenant,channel_id,content_hash,due_at));
        CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES publication_jobs(id),data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS publication_attempts(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES publication_jobs(id),data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS provider_receipts(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES publication_jobs(id),data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS metrics_snapshots(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES publication_jobs(id),data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS outbox_events(seq INTEGER PRIMARY KEY,job_id TEXT NOT NULL,data TEXT NOT NULL,previous TEXT NOT NULL,hash TEXT NOT NULL);`);
      for (const table of ['provider_channels','packets','approvals','publication_attempts','provider_receipts','metrics_snapshots','outbox_events']) {
        this.db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable'); END;
          CREATE TRIGGER IF NOT EXISTS ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
      }
      if (!this.db.prepare('SELECT 1 FROM publishing_meta').get()) this.db.prepare('INSERT INTO publishing_meta VALUES(?,?,1)').run(this.tenant, Number(synthetic));
    }).immediate();
    const meta = this.db.prepare('SELECT * FROM publishing_meta').get() as { tenant: string; synthetic: number; version: number };
    if (meta.tenant !== this.tenant || meta.synthetic !== Number(synthetic) || meta.version !== 1) { this.db.close(); throw new GtmError('TENANT_MISMATCH', 'Publishing database scope/version differs', 3); }
    try {this.verify();}catch(e){this.db.close();throw e;}
  }
  transaction<T>(fn: () => T) { return this.db.transaction(fn).immediate(); }
  put(table: 'provider_channels'|'packets'|'approvals'|'publication_attempts'|'provider_receipts'|'metrics_snapshots', data: Record<string, unknown>, jobId?: string) {
    if (canonical(redact(data)) !== canonical(data) || /\bbuf_[A-Za-z0-9_-]{12,}/.test(canonical(data))) throw new GtmError('SENSITIVE_DATA', 'Sensitive data denied', 3);
    const id = hashObject(data);
    this.transaction(() => {
      if (jobId) { this.job(jobId); this.db.prepare(`INSERT OR IGNORE INTO ${table}(id,job_id,data) VALUES(?,?,?)`).run(id, jobId, canonical(data)); }
      else {
        const prior=this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(String(data.id??id)) as {data:string}|undefined;
        if(prior && prior.data!==canonical(data))throw new GtmError('IMMUTABLE_CONFLICT','Record ID already binds different content',3);
        this.db.prepare(`INSERT OR IGNORE INTO ${table}(id,data) VALUES(?,?)`).run(String(data.id ?? id), canonical(data));
      }
      this.event(jobId ?? '', { kind: table, recordId: String(data.id ?? id), recordHash: id });
    });
    return id;
  }
  rows(table: 'provider_channels'|'packets'|'approvals'|'publication_attempts'|'provider_receipts'|'metrics_snapshots', jobId?: string): Record<string, unknown>[] {
    return (this.db.prepare(`SELECT data FROM ${table}${jobId ? ' WHERE job_id=?' : ''} ORDER BY rowid`).all(...(jobId ? [jobId] : [])) as {data: string}[]).map(r => JSON.parse(r.data) as Record<string, unknown>);
  }
  event(jobId: string, data: Record<string, unknown>) {
    if (this.readonly) throw new GtmError('READ_ONLY', 'Read-only publishing store', 3);
    const previous = (this.db.prepare('SELECT hash FROM outbox_events ORDER BY seq DESC LIMIT 1').get() as {hash: string}|undefined)?.hash ?? '0'.repeat(64);
    const value = { tenant: this.tenant, synthetic: this.synthetic, ...data };
    this.db.prepare('INSERT INTO outbox_events(job_id,data,previous,hash) VALUES(?,?,?,?)').run(jobId, canonical(value), previous, hashObject({ jobId, data: value, previous }));
  }
  create(envelope: Envelope): Job {
    const e = Envelope.parse(envelope);
    if (e.tenant !== this.tenant) throw new GtmError('TENANT_MISMATCH', 'Envelope tenant differs', 3);
    const hash = hashObject(e), id = `${this.tenant}-publish-${hash.slice(0, 24)}`;
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT id,payload_hash FROM publication_jobs WHERE channel_id=? AND content_hash=? AND due_at=?').get(e.channel.id,e.contentHash,e.dueAt) as {id:string;payload_hash:string}|undefined;
      if (existing) { if (existing.payload_hash !== hash) throw new GtmError('JOB_CONFLICT','Submission slot already binds another envelope'); return this.job(existing.id); }
      this.db.prepare(`INSERT INTO publication_jobs(id,tenant,channel_id,content_hash,due_at,envelope,payload_hash,state) VALUES(?,?,?,?,?,?,?,'DRAFT')`).run(id,this.tenant,e.channel.id,e.contentHash,e.dueAt,canonical(e),hash);
      this.event(id,{state:'DRAFT',payloadSha256:hash});
      this.transition(id,'REVIEWED'); this.transition(id,'APPROVAL_PENDING');
      return this.job(id);
    });
  }
  job(id: string): Job {
    const r = this.db.prepare('SELECT * FROM publication_jobs WHERE id=? AND tenant=?').get(id,this.tenant) as Record<string,unknown>|undefined;
    if (!r) throw new GtmError('JOB_MISSING', 'Job absent in selected tenant', 4);
    const envelope = Envelope.parse(JSON.parse(String(r.envelope)));
    if (envelope.tenant !== this.tenant || hashObject(envelope) !== r.payload_hash || envelope.channel.id!==r.channel_id || envelope.contentHash!==r.content_hash || envelope.dueAt!==r.due_at) throw new GtmError('PAYLOAD_CHANGED','Envelope integrity differs',3);
    return {id:String(r.id),tenant:this.tenant,envelope,payloadSha256:String(r.payload_hash),state:z.enum(STATES).parse(r.state),
      providerPostId:r.provider_post_id as string|null,leaseOwner:r.lease_owner as string|null,leaseUntil:r.lease_until as number|null,version:Number(r.version)};
  }
  jobs() { return (this.db.prepare('SELECT id FROM publication_jobs ORDER BY rowid').all() as {id:string}[]).map(r=>this.job(r.id)); }
  transition(id: string, state: State, detail: Record<string,unknown> = {}, owner?: string) {
    return this.transaction(() => {
      const j = this.job(id);
      if(!transitions[j.state].includes(state))throw new GtmError('ILLEGAL_TRANSITION',`Cannot move publication from ${j.state} to ${state}`,3);
      if (owner && j.leaseOwner !== owner) throw new GtmError('LEASE_LOST','Publisher lease no longer belongs to this worker',3);
      this.db.prepare('UPDATE publication_jobs SET state=?,version=version+1 WHERE id=?').run(state,id);
      this.event(id,{from:j.state,state,...detail}); return this.job(id);
    });
  }
  claim(id: string, now = Date.now()): string {
    const prior=this.job(id);
    if(prior.state==='SUBMITTING' && (prior.leaseUntil??0)<=now){this.transition(id,'RECONCILE_REQUIRED',{reason:'ABANDONED_SUBMISSION'});throw new GtmError('RECONCILE_REQUIRED','Abandoned submission must be reconciled',3);}
    return this.transaction(() => {
      const job = this.job(id);
      if (job.state !== 'APPROVED') throw new GtmError('NOT_APPROVED','Only approved jobs can be claimed once',3);
      const lease=this.db.prepare('SELECT until_at FROM channel_leases WHERE channel_id=?').get(job.envelope.channel.id) as {until_at:number}|undefined;
      if(lease && lease.until_at>now)throw new GtmError('CHANNEL_BUSY','Another worker owns this channel',3);
      const unresolved=this.db.prepare("SELECT id FROM publication_jobs WHERE channel_id=? AND id<>? AND state IN ('SUBMITTING','RECONCILE_REQUIRED')").get(job.envelope.channel.id,id);
      if(unresolved)throw new GtmError('RECONCILE_REQUIRED','Resolve uncertain channel submissions before filling its queue',3);
      const owner = randomUUID();
      this.db.prepare('INSERT INTO channel_leases VALUES(?,?,?) ON CONFLICT(channel_id) DO UPDATE SET owner=excluded.owner,until_at=excluded.until_at').run(job.envelope.channel.id,owner,now+120000);
      this.db.prepare("UPDATE publication_jobs SET state='SUBMITTING',lease_owner=?,lease_until=?,version=version+1 WHERE id=?").run(owner,now+120000,id);
      this.event(id,{from:job.state,state:'SUBMITTING',owner});
      this.put('publication_attempts',{attemptId:randomUUID(),phase:'CLAIMED',at:new Date(now).toISOString(),payloadSha256:job.payloadSha256},id); return owner;
    });
  }
  release(owner:string){this.db.prepare('DELETE FROM channel_leases WHERE owner=?').run(owner);}
  lockExisting(id:string,now=Date.now()) {
    return this.transaction(()=>{
      const job=this.job(id),owner=randomUUID();
      const lease=this.db.prepare('SELECT until_at FROM channel_leases WHERE channel_id=?').get(job.envelope.channel.id) as {until_at:number}|undefined;
      if(lease && lease.until_at>now)throw new GtmError('CHANNEL_BUSY','Another worker owns this channel',3);
      this.db.prepare('INSERT INTO channel_leases VALUES(?,?,?) ON CONFLICT(channel_id) DO UPDATE SET owner=excluded.owner,until_at=excluded.until_at').run(job.envelope.channel.id,owner,now+120000);
      this.db.prepare('UPDATE publication_jobs SET lease_owner=?,lease_until=? WHERE id=?').run(owner,now+120000,id);
      this.event(id,{kind:'CANCELLATION_LEASE',owner});return owner;
    });
  }
  bind(id: string, providerPostId: string) {
    this.job(id);
    this.db.prepare('UPDATE publication_jobs SET provider_post_id=? WHERE id=? AND tenant=? AND (provider_post_id IS NULL OR provider_post_id=?)').run(providerPostId,id,this.tenant,providerPostId);
    if (this.job(id).providerPostId !== providerPostId) throw new GtmError('PROVIDER_ID_CONFLICT','Remote post binding differs',3);
    this.event(id,{kind:'REMOTE_BOUND',providerPostId});
  }
  verify() {
    let previous = '0'.repeat(64);
    const projections=new Map<string,{state?:string;providerPostId?:string}>();
    for (const r of this.db.prepare('SELECT * FROM outbox_events ORDER BY seq').all() as {job_id:string;data:string;previous:string;hash:string}[]) {
      const data = JSON.parse(r.data) as {tenant:string;synthetic:boolean};
      if (data.tenant !== this.tenant || data.synthetic !== this.synthetic || r.previous !== previous || r.hash !== hashObject({jobId:r.job_id,data,previous})) throw new GtmError('AUDIT_INVALID','Publishing audit chain differs',3);
      previous = r.hash;
      const event=data as typeof data & {state?:string;providerPostId?:string};
      const projection=projections.get(r.job_id)??{};
      if(event.state)projection.state=event.state;if(event.providerPostId)projection.providerPostId=event.providerPostId;projections.set(r.job_id,projection);
    }
    for(const job of this.jobs()){const projection=projections.get(job.id);if(projection?.state!==job.state || (projection.providerPostId??null)!==job.providerPostId)throw new GtmError('AUDIT_INVALID','Job projection differs from immutable audit',3);}
    if (this.db.pragma('quick_check',{simple:true}) !== 'ok') throw new GtmError('AUDIT_INVALID','Publishing database integrity failed',3);
    return { valid:true,head:previous };
  }
  [Symbol.dispose]() { this.db.close(); }
}

/** Shared by every tenant/credential generation: rotation cannot reset the free-plan budget. */
export class ProviderBudget {
  readonly db: Database.Database;
  constructor(root: string, synthetic = false) {
    this.db = connect(root,`runtime/state/publisher/budget-${synthetic?'synthetic':'observed'}.sqlite`,false);
    this.db.exec('CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS policies(window INTEGER PRIMARY KEY,remaining INTEGER NOT NULL,reset INTEGER NOT NULL);');
  }
  reserve(now = Date.now()) {
    this.db.transaction(() => {
      for (const [window,cap] of [[900,90],[86400,90],[2592000,2700]]) {
        const used = (this.db.prepare('SELECT COUNT(*) AS n FROM calls WHERE at>?').get(now-window!*1000) as {n:number}).n;
        const remote = this.db.prepare('SELECT remaining,reset FROM policies WHERE window=?').get(window) as {remaining:number;reset:number}|undefined;
        if (used >= cap! || remote && remote.reset > now && remote.remaining <= 2) throw new GtmError('PROVIDER_BUDGET','Buffer request budget exhausted; wait for its window',4);
      }
      this.db.prepare('INSERT INTO calls VALUES(?,?)').run(randomUUID(),now);
      this.db.prepare('UPDATE policies SET remaining=MAX(0,remaining-1) WHERE reset>?').run(now);
    }).immediate();
  }
  observe(headers: Record<string,string>, now = Date.now()) {
    const policies = headers['ratelimit-policy'] ?? '', status = headers.ratelimit ?? '';
    this.db.transaction(() => {
      for (const p of policies.split(/,\s*(?=")/)) {
        const name = /^"([^"]+)"/.exec(p)?.[1], window = Number(/\bw=(\d+)/.exec(p)?.[1]);
        const current = status.split(/,\s*(?=")/).find(s=>s.startsWith(`"${name}"`));
        if (!current || ![900,86400,2592000].includes(window)) continue;
        const remaining=Number(/\br=(\d+)/.exec(current)?.[1]), seconds=Number(/\bt=(\d+)/.exec(current)?.[1]);
        if (Number.isSafeInteger(remaining) && Number.isSafeInteger(seconds)) this.db.prepare('INSERT INTO policies VALUES(?,?,?) ON CONFLICT(window) DO UPDATE SET remaining=CASE WHEN policies.reset<=? THEN excluded.remaining ELSE MIN(policies.remaining,excluded.remaining) END,reset=MAX(policies.reset,excluded.reset)').run(window,remaining,now+seconds*1000,now);
      }
    }).immediate();
  }
  [Symbol.dispose]() { this.db.close(); }
}
