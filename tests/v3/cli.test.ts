import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { PROJECT, workspace } from '../phase-b/helpers.js';

let fixture: ReturnType<typeof workspace>;
beforeEach(() => { fixture = workspace(); });
afterEach(() => { fixture.cleanup(); });
function cli(args: string[], expected = 0) {
  const p = spawnSync(process.execPath, [join(PROJECT, 'dist/packages/cli/src/index.js'), ...args, '--root', fixture.root, '--json'], { encoding: 'utf8', timeout: 20_000 });
  expect(p.status, p.stdout + p.stderr).toBe(expected);
  return JSON.parse(p.stdout) as { status: string; data: Record<string, unknown> };
}
test('capability planning requires a tenant and excludes prohibited X research before ranking', () => {
  cli(['capabilities', 'plan', '--task', 'research'], 2);
  const r = cli(['capabilities', 'plan', '--brand', 'founder', '--task', 'scrape X with cookies']);
  expect(r.data).toMatchObject({ executable: false, blocked: true });
  expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
});
test('observed scorecards preserve unavailable business data instead of manufacturing zero conversions', () => {
  const r = cli(['analytics', 'weekly', '--brand', 'retropick', '--offline']);
  expect(r.data).toMatchObject({ dataset: 'OBSERVED', business: { status: 'NO_DATA', verifiedConversions: null }, engineering: { status: 'NO_DATA' } });
  expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
});
test('a fresh weekly cycle halts at evidence gap without approving or publishing', () => {
  const r = cli(['cycle', 'run', '--brand', 'founder', '--offline', '--idempotency-key', 'founder-week-one']);
  expect(r.data).toMatchObject({ state: 'BLOCKED', blocker: 'EVIDENCE_GAP', externalWrites: 0 });
});
test('manual receipt import cannot fabricate publication without an approved packet', () => {
  mkdirSync(join(fixture.root, 'distribution/inbox/founder'), { recursive: true });
  writeFileSync(join(fixture.root, 'distribution/inbox/founder/receipt.json'), JSON.stringify({ tenant: 'founder', packetId: 'missing', event: 'OWNER_REPORTED_PUBLISHED', postUrl: 'https://x.com/iHateModelsss/status/1234567890' }));
  cli(['distribution', 'receipt', 'import', '--brand', 'founder', '--file', 'distribution/inbox/founder/receipt.json'], 4);
});
test('skill audit is read only and never installs or enables integrations', () => {
  expect(cli(['skills', 'audit']).data).toMatchObject({ installedOrModified: 0, credentialsRead: false });
});
test('global promotion is never inferred from a successful local invocation', () => {
  expect(cli(['harness', 'promotions', 'status']).data).toMatchObject({ globalPromotionEnabled: false, projectPromotionEnabled: false });
});
