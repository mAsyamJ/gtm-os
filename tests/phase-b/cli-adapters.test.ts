import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { INTEGRATIONS, type AdapterRequest } from '../../packages/connectors/src/index.js';
import { mockAdapter, unavailableAdapter } from '../../adapters/index.js';
import { PROJECT, workspace } from './helpers.js';

let fixture: ReturnType<typeof workspace>;
beforeEach(() => { fixture = workspace(); });
afterEach(() => { fixture.cleanup(); vi.unstubAllGlobals(); });
interface Output { status: string; data: Record<string, unknown> }
function cli(args: string[], expected = 0): Output {
  const result = spawnSync(process.execPath, [join(PROJECT, 'dist/packages/cli/src/index.js'),
    ...args, '--root', fixture.root, '--json'], { encoding: 'utf8', timeout: 10_000 });
  expect(result.status, result.stdout + result.stderr).toBe(expected);
  expect(result.stderr).toBe('');
  return JSON.parse(result.stdout) as Output;
}

describe('compiled CLI', () => {
  test('doctor reports core ready and missing integrations honestly', () => {
    const result = cli(['doctor']);
    expect(result.status).toBe('PASS'); expect(result.data.readyForPhaseBOffline).toBe(true);
    expect(result.data.liveProviders).toBe('BLOCKED_NOT_CONNECTED');
    expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
  });
  test.each([['skills', 'list'], ['agents', 'list'], ['workflow', 'list'], ['install', 'audit']])('admin command %s %s works', (...args) => expect(cli(args).status).toBe('PASS'));
  test.each(['retropick', 'founder'])('validates selected brand %s and claims', brand => {
    expect(cli(['brand', 'validate', '--brand', brand]).data.tenant).toBe(brand);
    expect(cli(['claims', 'audit', '--brand', brand]).data.claims).toBe(0);
  });
  test.each([['brand', 'validate'], ['workflow', 'resume', 'job_abc', '--offline'], ['claims', 'audit'], ['publish', 'preview']])('rejects missing tenant %s %s', (...args) => {
    expect(cli(args, 2).status).toBe('FAIL'); expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
  });
  test('rejects tenant traversal and unknown flags', () => {
    cli(['brand', 'show', '--brand', '../founder'], 2);
    cli(['doctor', '--unknown', 'private-input'], 2);
  });
  test('requires offline without creating state', () => {
    cli(['workflow', 'run', 'feature-launch', '--brand', 'retropick'], 3);
    expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
  });
  test('workflow run/resume/audit round trip and zero-charge cost report', () => {
    const result = cli(['workflow', 'run', 'feature-launch', '--brand', 'retropick', '--offline', '--idempotency-key', 'cli-demo']);
    expect(result.status).toBe('AWAITING_APPROVAL');
    const job = result.data.job as { id: string };
    expect(cli(['workflow', 'resume', job.id, '--brand', 'retropick', '--offline']).data).toEqual(result.data);
    expect(cli(['audit', 'trace', '--brand', 'retropick', '--job', job.id]).data.audit).toMatchObject({ valid: true });
    expect(cli(['costs', 'report']).data.reports).toEqual(expect.arrayContaining([
      expect.objectContaining({ tenant: 'retropick', actualUsd: 0, entries: 6 }),
      expect.objectContaining({ tenant: 'founder', status: 'NO_DATA' }),
    ]));
    expect(existsSync(join(fixture.root, 'runtime/state/founder'))).toBe(false);
  });
  test('checkpoint interruption and resume are real CLI behavior', () => {
    const partial = cli(['workflow', 'run', 'daily-intelligence', '--brand', 'founder', '--offline', '--max-stages', '1']);
    expect(partial.status).toBe('RUNNING');
    const job = partial.data.job as { id: string; checkpoint: number }; expect(job.checkpoint).toBe(1);
    const finished = cli(['workflow', 'resume', job.id, '--brand', 'founder', '--offline']);
    expect(finished.status).toBe('COMPLETED_LOCAL'); expect(finished.data.artifacts).toHaveLength(3);
  });
  test('tampered disabled defaults block execution', () => {
    const path = join(fixture.root, 'config/defaults.yaml');
    writeFileSync(path, readFileSync(path, 'utf8').replace('external_writes: false', 'external_writes: true'));
    cli(['workflow', 'run', 'feature-launch', '--brand', 'retropick', '--offline'], 3);
    expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
  });
  test.each([['publish', 'preview'], ['publish', 'dry-run'], ['publish', 'run'], ['schedule', 'post']])('external boundary %s %s always denies', (...args) => expect(cli([...args, '--brand', 'founder', '--dry-run'], 3).status).toBe('BLOCKED'));
  test('auth status is blocked without reading any authentication state', () => {
    const result = cli(['x', 'auth', 'status', '--brand', 'retropick'], 4);
    expect(result.data.identity).toMatchObject({ expectedHandle: 'RetroPickMarket', principalId: null, authenticated: false });
  });
  test.each([['design', 'render'], ['video', 'render'], ['analytics', 'report']])('later phase %s %s is an honest blocked boundary', (...args) => expect(cli([...args, '--brand', 'retropick', '--offline'], 4).status).toBe('BLOCKED'));
  test('missing project file is validation failure, not a false pass', () => {
    writeFileSync(join(fixture.root, 'brands/founder/profile.json'), '{invalid-private-value');
    const result = cli(['brand', 'validate', '--brand', 'founder'], 5);
    expect(JSON.stringify(result)).not.toContain('invalid-private-value');
  });
});

describe('all integration surfaces remain in-process mocks', () => {
  const request: AdapterRequest = { tenant: 'founder', jobId: 'job_fixture', action: 'preview', sourceIds: ['source_fixture'], inputHashes: [], parameters: {} };
  test.each(INTEGRATIONS)('%s exposes typed capabilities, identity, estimate, dry-run, audit and denies execute', id => {
    const network = vi.fn(() => { throw new Error('network must not run'); }); vi.stubGlobal('fetch', network);
    const mock = mockAdapter(id);
    expect(mock.capabilities()).toMatchObject({ id, status: 'MOCK_ONLY', network: false, liveImplemented: false });
    expect(mock.identity('founder').principalId).toBe(null);
    expect(mock.costEstimate(request)).toMatchObject({ known: true, estimatedUsd: 0, basis: 'OFFLINE_NO_PROVIDER_CALL' });
    expect(mock.dryRun(request)).toMatchObject({ tenant: 'founder', label: 'SYNTHETIC', externalSideEffects: false });
    expect(mock.audit(request)).toMatchObject({ networkCalls: 0, publicationAuthorized: false });
    expect(() => mock.execute(request)).toThrow('disabled');
    const blocked = unavailableAdapter(id);
    expect(blocked.dryRun(request).status).toBe('BLOCKED');
    expect(blocked.costEstimate(request)).toMatchObject({ known: false, estimatedUsd: null });
    expect(network).not.toHaveBeenCalled();
  });
  test('adapter boundary validates tenant at runtime', () => {
    expect(() => mockAdapter('x-official').dryRun({ ...request, tenant: 'other' } as unknown as AdapterRequest)).toThrow('schema');
  });
});
