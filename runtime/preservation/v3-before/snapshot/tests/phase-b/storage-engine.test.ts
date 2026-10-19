import { copyFileSync, existsSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { TenantStore } from '../../packages/storage/src/index.js';
import { WorkflowEngine } from '../../packages/core/src/engine.js';
import { loadWorkflow } from '../../packages/core/src/workspace.js';
import { canonical, hashObject, sha256 } from '../../packages/observability/src/index.js';
import { source, workspace } from './helpers.js';

let fixture: ReturnType<typeof workspace>;
beforeEach(() => { fixture = workspace(); });
afterEach(() => fixture.cleanup());

describe('tenant SQLite repositories', () => {
  test('physically isolates databases and denies foreign objects', () => {
    using retro = new TenantStore(fixture.root, 'retropick');
    using founder = new TenantStore(fixture.root, 'founder');
    retro.putSource(source());
    expect(founder.sources()).toEqual([]);
    expect(retro.path).not.toBe(founder.path);
    expect(() => founder.putSource(source())).toThrow('tenant');
  });
  test('source provenance is immutable and content hash checked', () => {
    using store = new TenantStore(fixture.root, 'retropick');
    store.putSource(source()); store.putSource(source());
    expect(store.sources()).toHaveLength(1);
    expect(() => store.putSource({ ...source(), revision: 'changed' })).toThrow('immutable');
    expect(() => store.putSource({ ...source(), id: 'other', contentSha256: '0'.repeat(64) })).toThrow('hash');
  });
  test('rejects evidence containing secret-like data rather than losing provenance', () => {
    using store = new TenantStore(fixture.root, 'retropick');
    const body = { password: 'fixture-private' };
    expect(() => store.putSource({ ...source(), body, contentSha256: hashObject(body) })).toThrow('sensitive');
  });
  test('detects a database copied from another tenant', () => {
    new TenantStore(fixture.root, 'retropick').close();
    new TenantStore(fixture.root, 'founder').close();
    copyFileSync(join(fixture.root, 'runtime/state/retropick/gtm.sqlite'), join(fixture.root, 'runtime/state/founder/gtm.sqlite'));
    expect(() => new TenantStore(fixture.root, 'founder')).toThrow('tenant');
  });
  test('refuses symlinked runtime state', () => {
    symlinkSync(join(fixture.root, 'brands'), join(fixture.root, 'runtime'), 'dir');
    expect(() => new TenantStore(fixture.root, 'retropick')).toThrow('Symlink');
  });
  test('read-only absent store does not silently create a database', () => {
    expect(() => new TenantStore(fixture.root, 'retropick', { readonly: true })).toThrow('not exist');
    expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
  });
  test('database and tenant directory use private permissions', () => {
    using store = new TenantStore(fixture.root, 'founder');
    expect(statSync(store.path).mode & 0o777).toBe(0o600);
    expect(statSync(join(fixture.root, 'runtime/state/founder')).mode & 0o777).toBe(0o700);
  });
  test('SQL constraints reject a foreign tenant even outside the typed repository', () => {
    using store = new TenantStore(fixture.root, 'founder'); const db = new Database(store.path);
    try { expect(() => db.prepare('INSERT INTO sources VALUES (?,?,?)').run('foreign', 'retropick', '{}')).toThrow(); }
    finally { db.close(); }
  });
  test('unsupported database schema is rejected without migration/downgrade', () => {
    const store = new TenantStore(fixture.root, 'founder'); const path = store.path; store.close();
    const db = new Database(path); db.pragma('user_version = 99'); db.close();
    expect(() => new TenantStore(fixture.root, 'founder')).toThrow('unsupported');
  });
});

describe('offline workflow checkpoints and audit', () => {
  test('feature launch produces traceable synthetic artifacts and pauses without publishing', () => {
    using store = new TenantStore(fixture.root, 'retropick');
    const engine = new WorkflowEngine(fixture.root, store);
    const job = engine.run('feature-launch', { offline: true, idempotencyKey: 'launch-one' });
    expect(job.state).toBe('AWAITING_APPROVAL');
    const artifacts = store.artifacts(job.id);
    expect(artifacts).toHaveLength(6);
    for (const a of artifacts) {
      expect(a.label).toBe('SYNTHETIC'); expect(a.tenant).toBe('retropick');
      expect(a.sourceIds).toEqual(job.sourceIds);
      expect(sha256(readFileSync(join(fixture.root, a.relativePath)))).toBe(a.sha256);
    }
    expect(store.outbox(job.id)).toHaveLength(1);
    expect(store.outbox(job.id)[0]?.status).toBe('BLOCKED');
    expect(store.verifyAudit().valid).toBe(true);
    expect(store.costs().every(c => c.actualUsd === 0)).toBe(true);
  });
  test('resume/replayed idempotency key cannot duplicate artifacts, outbox, audit or costs', () => {
    using store = new TenantStore(fixture.root, 'founder');
    const engine = new WorkflowEngine(fixture.root, store);
    const job = engine.run('build-in-public', { offline: true, idempotencyKey: 'replay' });
    const before = [store.artifacts(job.id).length, store.audit().length, store.costs().length, store.outbox(job.id).length];
    expect(engine.resume(job.id, { offline: true })).toEqual(job);
    expect(engine.run('build-in-public', { offline: true, idempotencyKey: 'replay' })).toEqual(job);
    expect([store.artifacts(job.id).length, store.audit().length, store.costs().length, store.outbox(job.id).length]).toEqual(before);
  });
  test('reusing key for different workflow fails without mutating prior job', () => {
    using store = new TenantStore(fixture.root, 'retropick');
    const engine = new WorkflowEngine(fixture.root, store);
    engine.run('daily-intelligence', { offline: true, idempotencyKey: 'key' });
    expect(() => engine.run('feature-launch', { offline: true, idempotencyKey: 'key' })).toThrow('Idempotency');
  });
  test('read-only daily workflow completes locally', () => {
    using store = new TenantStore(fixture.root, 'retropick');
    const job = new WorkflowEngine(fixture.root, store).run('daily-intelligence', { offline: true });
    expect(job.state).toBe('COMPLETED_LOCAL'); expect(store.outbox(job.id)).toHaveLength(0);
  });
  test('explicit offline required', () => {
    using store = new TenantStore(fixture.root, 'retropick');
    expect(() => new WorkflowEngine(fixture.root, store).run('feature-launch', { offline: false })).toThrow('offline');
    expect(store.audit()).toEqual([]);
  });
  test('cross-tenant resume never discovers the foreign job', () => {
    using retro = new TenantStore(fixture.root, 'retropick'); using founder = new TenantStore(fixture.root, 'founder');
    const job = new WorkflowEngine(fixture.root, retro).run('feature-launch', { offline: true });
    expect(() => new WorkflowEngine(fixture.root, founder).resume(job.id, { offline: true })).toThrow('not found');
  });
  test('changed workflow invalidates resume fingerprint', () => {
    using store = new TenantStore(fixture.root, 'retropick'); const engine = new WorkflowEngine(fixture.root, store);
    const job = engine.run('feature-launch', { offline: true });
    const path = join(fixture.root, 'workflows/definitions/feature-launch.yaml'); writeFileSync(path, readFileSync(path, 'utf8') + '\n# changed\n');
    expect(() => engine.resume(job.id, { offline: true })).toThrow('changed');
  });
  test('tampered artifact blocks resume', () => {
    using store = new TenantStore(fixture.root, 'retropick'); const engine = new WorkflowEngine(fixture.root, store);
    const job = engine.run('feature-launch', { offline: true }); const a = store.artifacts(job.id)[0];
    if (!a) throw new Error('artifact missing');
    writeFileSync(join(fixture.root, a.relativePath), 'changed');
    expect(() => engine.resume(job.id, { offline: true })).toThrow('hash');
  });
  test('same transition is idempotent; illegal transition and stale versions fail', () => {
    using store = new TenantStore(fixture.root, 'retropick'); const engine = new WorkflowEngine(fixture.root, store);
    const job = engine.run('daily-intelligence', { offline: true }); const count = store.audit().length;
    expect(store.transition(job.id, job.version, job.state)).toEqual(job); expect(store.audit()).toHaveLength(count);
    expect(() => store.transition(job.id, job.version, 'RUNNING')).toThrow('transition');
    expect(() => store.transition(job.id, job.version - 1, 'CANCELLED')).toThrow('version');
  });
  test('durable checkpoint survives closing and reopening the database', () => {
    const store = new TenantStore(fixture.root, 'founder'); const job = new WorkflowEngine(fixture.root, store).run('build-in-public', { offline: true }); store.close();
    using reopened = new TenantStore(fixture.root, 'founder');
    expect(new WorkflowEngine(fixture.root, reopened).resume(job.id, { offline: true })).toEqual(job);
  });
  test('audit entries reject update/delete and detect inserted corrupt chain', () => {
    using store = new TenantStore(fixture.root, 'retropick'); new WorkflowEngine(fixture.root, store).run('daily-intelligence', { offline: true });
    const db = new Database(store.path);
    expect(() => db.prepare('DELETE FROM audit').run()).toThrow();
    expect(() => db.prepare("UPDATE audit SET kind = 'changed'").run()).toThrow();
    db.prepare('INSERT INTO audit (tenant_id,job_id,kind,at,data,previous_hash,hash) VALUES (?,?,?,?,?,?,?)')
      .run('retropick', null, 'injected', new Date().toISOString(), '{}', '0'.repeat(64), '0'.repeat(64)); db.close();
    expect(store.verifyAudit().valid).toBe(false);
  });
  test('all workflow YAML contracts load with valid skill references', () => expect(loadWorkflow(fixture.root, 'feature-launch').definition.stages.length).toBe(7));
  test('failure during stage commit rolls back checkpoint, artifact, costs and audit; orphan file is recoverable', () => {
    using store = new TenantStore(fixture.root, 'retropick'); const engine = new WorkflowEngine(fixture.root, store);
    const db = new Database(store.path);
    db.exec("CREATE TRIGGER fail_cost BEFORE INSERT ON costs BEGIN SELECT RAISE(ABORT,'simulated interruption'); END");
    expect(() => engine.run('daily-intelligence', { offline: true, idempotencyKey: 'interruption' })).toThrow('simulated interruption');
    const job = store.jobByKey('interruption'); if (!job) throw new Error('missing durable job');
    expect(job.checkpoint).toBe(0); expect(store.artifacts(job.id)).toHaveLength(0); expect(store.costs()).toHaveLength(0);
    expect(store.audit().filter(e => e.kind === 'stage.completed')).toHaveLength(0);
    expect(existsSync(join(fixture.root, `runtime/artifacts/retropick/${job.id}/step_1.json`))).toBe(true);
    db.exec('DROP TRIGGER fail_cost'); db.close();
    expect(engine.resume(job.id, { offline: true }).state).toBe('COMPLETED_LOCAL');
    expect(store.artifacts(job.id)).toHaveLength(3); expect(store.costs()).toHaveLength(3); expect(store.verifyAudit().valid).toBe(true);
  });
  test('stored artifact rewriting cannot bypass original audit linkage', () => {
    using store = new TenantStore(fixture.root, 'retropick'); const engine = new WorkflowEngine(fixture.root, store);
    const job = engine.run('feature-launch', { offline: true }); const artifact = store.artifacts(job.id)[0];
    if (!artifact) throw new Error('missing artifact');
    const changed = { ...artifact, data: { changed: true } }; const { sha256: _old, relativePath: _path, ...payload } = changed;
    changed.sha256 = hashObject(payload);
    writeFileSync(join(fixture.root, changed.relativePath), canonical(payload));
    const db = new Database(store.path); db.prepare('UPDATE artifacts SET data=? WHERE id=?').run(JSON.stringify(changed), changed.id); db.close();
    expect(() => engine.resume(job.id, { offline: true })).toThrow('lineage');
  });
});
