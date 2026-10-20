import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { PROJECT, workspace } from '../phase-b/helpers.js';

let fixture: ReturnType<typeof workspace>;
beforeEach(() => { fixture = workspace(); });
afterEach(() => fixture.cleanup());
function cli(args: string[], exit = 0) {
  const p = spawnSync(process.execPath, [join(PROJECT, 'dist/packages/cli/src/index.js'), ...args,
    '--root', fixture.root, '--json'], { encoding: 'utf8', timeout: 20000 });
  expect(p.status, p.stdout + p.stderr).toBe(exit);
  return JSON.parse(p.stdout) as { data: Record<string, unknown>; error?: { code: string } };
}
test('intelligence doctor is read-only and requires an explicit tenant', () => {
  cli(['intelligence', 'sources', 'doctor'], 2);
  expect(cli(['intelligence', 'sources', 'doctor', '--brand', 'founder']).data).toMatchObject({
    tenant: 'founder', networkRequests: 0, hostedModelRequests: 0, publicationAuthorized: false,
  });
});
test('empty intelligence never fabricates trends or content', () => {
  expect(cli(['intelligence', 'trends', '--brand', 'retropick', '--window', '30d']).data)
    .toMatchObject({ status: 'EVIDENCE_GAP', trends: [] });
  cli(['intelligence', 'brief', '--brand', 'retropick', '--topic-id', 'missing'], 4);
});
test('offline collection denies network and routed editorial cannot bypass admission', () => {
  cli(['intelligence', 'collect', '--brand', 'founder', '--window', '30d', '--profile', 'crypto', '--offline'], 3);
  cli(['content', 'pack', '--brand', 'founder', '--brief-id', 'missing', '--model-mode', 'router', '--offline'], 3);
});
