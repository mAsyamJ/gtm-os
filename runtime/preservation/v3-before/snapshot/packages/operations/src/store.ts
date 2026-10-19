import Database from 'better-sqlite3';
import { chmodSync, existsSync, lstatSync } from 'node:fs';
import { z } from 'zod';
import { canonical, GtmError, hashObject, redact } from '../../observability/src/index.js';
import { IdSchema, TenantSchema, type Tenant } from '../../schemas/src/index.js';
import { parseWith, safeDirectory, safePath } from '../../core/src/workspace.js';

const KindSchema = z.enum(['draft', 'dispatch', 'mock_receipt', 'webhook', 'event', 'link', 'experiment']);
type Kind = z.infer<typeof KindSchema>;
const ScopedSchema = z.object({ id: IdSchema, tenant: TenantSchema, label: z.literal('SYNTHETIC') }).passthrough();
type RecordValue = z.infer<typeof ScopedSchema>;
interface Row { kind: Kind; id: string; data: string; hash: string }
interface AuditRow { seq: number; previous: string; hash: string; data: string }

/** Separate tenant operations DB: append-only simulated dispatch snapshots and synthetic analytics. */
export class OperationsStore {
  readonly tenant: Tenant;
  readonly path: string;
  readonly #db: Database.Database;
  readonly #readonly: boolean;
  constructor(readonly root: string, selected: unknown, options: { readonly?: boolean } = {}) {
    this.tenant = parseWith(TenantSchema, selected, 'operations tenant'); this.#readonly = options.readonly === true;
    this.path = safePath(root, `runtime/state/${this.tenant}/operations.sqlite`);
    const present = existsSync(this.path);
    if (!present && this.#readonly) throw new GtmError('STORE_MISSING', 'Tenant operations database does not exist', 4);
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const path = safePath(root, `runtime/state/${this.tenant}/operations.sqlite${suffix}`);
      if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).nlink !== 1)) throw new GtmError('UNSAFE_DATABASE', 'Database links and non-files are forbidden');
    }
    if (present) {
      const probe = new Database(this.path, { readonly: true, fileMustExist: true });
      try {
        const meta = probe.prepare('SELECT tenant,purpose FROM operations_meta').get() as { tenant: string; purpose: string };
        if (meta?.tenant !== this.tenant || meta.purpose !== 'phase-e-operations') throw new GtmError('TENANT_MISMATCH', 'Operations database tenant/purpose mismatch');
        if (probe.pragma('user_version', { simple: true }) !== 1) throw new GtmError('MIGRATION_UNSUPPORTED', 'Unsupported operations schema');
      } catch (error) { if (error instanceof GtmError) throw error; throw new GtmError('STORAGE_INVALID', 'Invalid operations database'); }
      finally { probe.close(); }
    } else safeDirectory(root, `runtime/state/${this.tenant}`);
    this.#db = new Database(this.path, { readonly: this.#readonly, fileMustExist: this.#readonly, timeout: 5000 });
    if (!this.#readonly) {
      this.#db.pragma('journal_mode=WAL'); this.#db.pragma('synchronous=FULL');
      if (!present) this.#db.transaction(() => {
        this.#db.exec(`CREATE TABLE operations_meta (tenant TEXT NOT NULL CHECK(tenant='${this.tenant}'), purpose TEXT NOT NULL CHECK(purpose='phase-e-operations'));
          CREATE TABLE records (kind TEXT NOT NULL, id TEXT NOT NULL, tenant TEXT NOT NULL CHECK(tenant='${this.tenant}'), data TEXT NOT NULL CHECK(json_valid(data)), hash TEXT NOT NULL, PRIMARY KEY(kind,id));
          CREATE TABLE audit (seq INTEGER PRIMARY KEY, previous TEXT NOT NULL, hash TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)));
          CREATE TRIGGER records_no_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;
          CREATE TRIGGER records_no_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;
          CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'append-only'); END;
          CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'append-only'); END;
          PRAGMA user_version=1;`);
        this.#db.prepare('INSERT INTO operations_meta VALUES (?,?)').run(this.tenant, 'phase-e-operations');
      }).immediate();
      chmodSync(this.path, 0o600);
    }
    if (!this.verify().valid) { this.#db.close(); throw new GtmError('AUDIT_INVALID', 'Operations records/audit integrity validation failed'); }
  }
  transaction<T>(work: () => T): T {
    if (this.#readonly) throw new GtmError('STORE_READ_ONLY', 'Read-only operations report cannot mutate state', 3);
    return this.#db.transaction(work).immediate();
  }
  put(kind: Kind, input: unknown): { inserted: boolean; value: RecordValue } {
    parseWith(KindSchema, kind, 'record kind'); const value = parseWith(ScopedSchema, input, 'operations record');
    if (value.tenant !== this.tenant) throw new GtmError('TENANT_MISMATCH', 'Record belongs to another tenant');
    if (canonical(redact(value)) !== canonical(value)) throw new GtmError('SENSITIVE_OPERATIONS_DATA', 'Sensitive data is forbidden in synthetic records');
    const hash = hashObject(value);
    return this.transaction(() => {
      const existing = this.get(kind, value.id);
      if (existing) {
        if (hashObject(existing) !== hash) throw new GtmError('IMMUTABLE_CONFLICT', 'Record ID already binds different data');
        return { inserted: false, value: existing };
      }
      this.#db.prepare('INSERT INTO records VALUES (?,?,?,?,?)').run(kind, value.id, this.tenant, canonical(value), hash);
      const previous = this.#db.prepare('SELECT seq,hash FROM audit ORDER BY seq DESC LIMIT 1').get() as { seq: number; hash: string } | undefined;
      const event = { tenant: this.tenant, kind, id: value.id, recordHash: hash };
      const seq = (previous?.seq ?? 0) + 1, prior = previous?.hash ?? '0'.repeat(64);
      this.#db.prepare('INSERT INTO audit VALUES (?,?,?,?)').run(seq, prior, hashObject({ seq, previous: prior, data: event }), canonical(event));
      return { inserted: true, value };
    });
  }
  private parse(row: Row): RecordValue {
    const value = parseWith(ScopedSchema, JSON.parse(row.data), 'stored operations record');
    if (value.tenant !== this.tenant || value.id !== row.id || hashObject(value) !== row.hash) throw new GtmError('RECORD_HASH', 'Operations record scope/hash mismatch');
    return value;
  }
  get(kind: Kind, id: string): RecordValue | undefined {
    parseWith(KindSchema, kind, 'record kind'); parseWith(IdSchema, id, 'record ID');
    const row = this.#db.prepare('SELECT * FROM records WHERE kind=? AND id=?').get(kind, id) as Row | undefined;
    return row ? this.parse(row) : undefined;
  }
  list(kind: Kind): RecordValue[] {
    parseWith(KindSchema, kind, 'record kind');
    return (this.#db.prepare('SELECT * FROM records WHERE kind=? ORDER BY id').all(kind) as Row[]).map(r => this.parse(r));
  }
  verify(): { valid: boolean; records: number; headHash: string } {
    let previous = '0'.repeat(64);
    try {
      const rows = this.#db.prepare('SELECT * FROM records').all() as Row[];
      const records = new Map(rows.map(row => [`${row.kind}/${row.id}`, { hash: row.hash, value: this.parse(row) }]));
      const audits = this.#db.prepare('SELECT * FROM audit ORDER BY seq').all() as AuditRow[];
      if (rows.length !== audits.length) return { valid: false, records: rows.length, headHash: previous };
      const seen = new Set<string>();
      for (const [index, row] of audits.entries()) {
        const event = JSON.parse(row.data) as { tenant: Tenant; kind: Kind; id: string; recordHash: string };
        const key = `${event.kind}/${event.id}`;
        if (row.seq !== index + 1 || row.previous !== previous || event.tenant !== this.tenant || seen.has(key) ||
          records.get(key)?.hash !== event.recordHash || row.hash !== hashObject({ seq: row.seq, previous: row.previous, data: event }))
          return { valid: false, records: rows.length, headHash: previous };
        seen.add(key); previous = row.hash;
      }
      return { valid: this.#db.pragma('quick_check', { simple: true }) === 'ok', records: rows.length, headHash: previous };
    } catch { return { valid: false, records: 0, headHash: previous }; }
  }
  close(): void { this.#db.close(); }
  [Symbol.dispose](): void { this.close(); }
}
