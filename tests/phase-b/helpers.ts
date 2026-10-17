import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hashObject } from '../../packages/observability/src/index.js';
import type { Source, Tenant } from '../../packages/schemas/src/index.js';

export const PROJECT = resolve(import.meta.dirname, '../..');
export function workspace(): { root: string; cleanup: () => void } {
  mkdirSync(join(PROJECT, 'runtime/tests'), { recursive: true });
  const root = mkdtempSync(join(PROJECT, 'runtime/tests/case-'));
  for (const folder of ['config', 'brands', 'workflows', 'agents', '.agents', 'campaigns', 'creative', 'packages/creative']) cpSync(join(PROJECT, folder), join(root, folder), { recursive: true });
  copyFileSync(join(PROJECT, 'AGENTS.md'), join(root, 'AGENTS.md'));
  copyFileSync(join(PROJECT, 'package.json'), join(root, 'package.json'));
  copyFileSync(join(PROJECT, 'pnpm-lock.yaml'), join(root, 'pnpm-lock.yaml'));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export function source(tenant: Tenant = 'retropick', id = 'source_fixture'): Source {
  const body = { statement: 'SYNTHETIC fixture; no actual product capability or personal achievement asserted.' };
  return { id, tenant, uri: `fixture://${tenant}/${id}`, revision: 'test-r1',
    observedAt: '2026-10-17T00:00:00.000Z', expiresAt: '2030-10-17T00:00:00.000Z',
    contentSha256: hashObject(body), classification: 'SYNTHETIC', license: 'NO_EXTERNAL_ASSETS', body };
}
