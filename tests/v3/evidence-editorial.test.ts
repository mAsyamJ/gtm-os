import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { beforeEach, afterEach, expect, test } from 'vitest';
import { PROJECT, workspace } from '../phase-b/helpers.js';
let f: ReturnType<typeof workspace>;
beforeEach(() => { f = workspace(); });
afterEach(() => f.cleanup());
function cli(args: string[], expected = 0) {
  const p = spawnSync(process.execPath, [join(PROJECT, 'dist/packages/cli/src/index.js'), ...args, '--root', f.root, '--json'], { encoding: 'utf8', timeout: 15000 });
  expect(p.status, p.stdout + p.stderr).toBe(expected);
  return JSON.parse(p.stdout).data as Record<string, unknown>;
}
function input(name: string, value: unknown) {
  mkdirSync(join(f.root, 'research/inbox/founder'), { recursive: true });
  const path = `research/inbox/founder/${name}.json`; writeFileSync(join(f.root, path), JSON.stringify(value)); return path;
}
const text = 'A reproducible example names its constraint. The example does not establish a performance improvement.';
function source() {
  return cli(['evidence', 'ingest', '--brand', 'founder', '--file', input('source', {
    id: 'founder-source', tenant: 'founder', title: 'Engineering example', uri: 'https://example.org/engineering', revision: 'revision-one',
    observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(),
    text, contentSha256: createHash('sha256').update(text).digest('hex'), license: 'OWNER_APPROVED_LOCAL_REVIEW',
    statements: ['A reproducible example names its constraint.', 'The example does not establish a performance improvement.'],
  })]);
}
test('unreviewed retrieval cannot become public-ready copy or platform verification', () => {
  const s = source(); expect(s.label).toBe('RETRIEVED_UNVERIFIED');
  cli(['content', 'draft', '--brand', 'founder', '--format', 'thread', '--source-card', 'founder-source'], 4);
  cli(['evidence', 'review', '--brand', 'founder', '--file', input('review', { evidenceId: 'founder-source', evidenceSha256: s.sha256,
    classification: 'PLATFORM_VERIFIED', actor: 'owner', permittedClaims: [text], authenticFirstPerson: false })], 5);
});
test('reviewed source generates traceable content while owner authenticity and publication remain pending', () => {
  const s = source();
  cli(['evidence', 'review', '--brand', 'founder', '--file', input('review', { evidenceId: 'founder-source', evidenceSha256: s.sha256,
    classification: 'REVIEWED_SOURCE', actor: 'owner', permittedClaims: ['A reproducible example names its constraint.'], authenticFirstPerson: false })]);
  const d = cli(['content', 'draft', '--brand', 'founder', '--format', 'thread', '--source-card', 'founder-source']);
  expect(d).toMatchObject({ publicationAuthorized: false, humanReview: 'PENDING', format: 'thread' });
  const refined = cli(['content', 'humanize', '--brand', 'founder', '--draft', String(d.id), '--preserve-claims']);
  expect(refined).toMatchObject({ integrity: { status: 'PASS', protectedClaimsUnchanged: true }, humanReview: 'PENDING', hostedModelRequests: 0 });
  cli(['content', 'draft', '--brand', 'retropick', '--format', 'post', '--source-card', 'founder-source'], 4);
});
test('review cannot approve a claim absent from the retrieved bytes', () => {
  const s = source();
  cli(['evidence', 'review', '--brand', 'founder', '--file', input('forgery', { evidenceId: 'founder-source', evidenceSha256: s.sha256,
    classification: 'REVIEWED_SOURCE', actor: 'owner', permittedClaims: ['This creates guaranteed profits.'], authenticFirstPerson: false })], 5);
});
