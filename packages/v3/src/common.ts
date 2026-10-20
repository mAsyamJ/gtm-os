import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadBrand, loadPolicy, parseWith, readStructured, readText, safePath, safeDirectory } from '../../core/src/workspace.js';
import { canonical, GtmError, hashObject,sha256 } from '../../observability/src/index.js';
import { TenantSchema, type Tenant } from '../../schemas/src/index.js';
import { OperationsStore } from '../../operations/src/store.js';
import { immutableFile } from '../../creative/src/common.js';

export const EvidenceClass = z.enum(['SYNTHETIC', 'RETRIEVED_UNVERIFIED', 'REVIEWED_SOURCE', 'OWNER_ATTESTED', 'PLATFORM_VERIFIED', 'PRODUCT_VERIFIED']);
export const Dataset = z.enum(['SYNTHETIC', 'OBSERVED']);
export type Dataset = z.infer<typeof Dataset>;
export function context(root: string, selected: unknown, dataset: Dataset = 'OBSERVED') {
  const tenant = parseWith(TenantSchema, selected, 'tenant'); loadPolicy(root); loadBrand(root, tenant);
  return { tenant, dataset: Dataset.parse(dataset), schemaVersion: 1, revision: 'v3-r1', publicationAuthorized: false as const,
    intendedAudience: 'Owner and relevant builders or product explorers', externalWrites: 0, paidSocialApiCalls: 0,
    operatorInferenceCost: 'NOT_MEASURED', approvalStatus: 'HOLD', assetLicense: 'PER_ARTIFACT_PROVENANCE_REQUIRED' };
}
export function open(root: string, tenant: Tenant, dataset: Dataset = 'OBSERVED', readonly = false) {
  return new OperationsStore(root, tenant, { dataset, readonly });
}
export function records(root: string, tenant: Tenant, kind: Parameters<OperationsStore['list']>[0], dataset: Dataset = 'OBSERVED') {
  const name = dataset === 'OBSERVED' ? 'observations.sqlite' : 'operations.sqlite';
  if (!existsSync(safePath(root, `runtime/state/${tenant}/${name}`))) return [];
  using store = open(root, tenant, dataset, true); return store.list(kind);
}
export function localInput(root: string, tenant: Tenant, path: string, area: 'research' | 'distribution' | 'growth') {
  if (!new RegExp(`^${area}/inbox/${tenant}/[A-Za-z0-9][A-Za-z0-9_.-]*\\.(json|csv)$`).test(path))
    throw new GtmError('INPUT_SCOPE', 'Input must be an explicit file in the selected tenant inbox', 2);
  return path.endsWith('.csv') ? readText(root, path) : readStructured(root, path);
}
export function artifact(root: string, tenant: Tenant, kind: string, document: unknown) {
  if (!/^[a-z][a-z-]+$/.test(kind)) throw new GtmError('ARTIFACT_KIND', 'Invalid artifact kind', 2);
  const directory = `runtime/v3/${tenant}/${kind}/${hashObject(document)}`; safeDirectory(root, directory);
  const path=`${directory}/manifest.json`;
  // Preserve historical bytes while accepting the identical canonical document.
  if(existsSync(safePath(root,path))){
    const old=readFileSync(safePath(root,path));
    if(hashObject(readStructured(root,path))!==hashObject(document))throw new GtmError('CREATIVE_IMMUTABLE','Existing artifact differs from canonical inputs');
    return {directory,path,sha256:sha256(old),bytes:old.length};
  }
  const file = immutableFile(root, path, canonical(document) + '\n');
  return { directory, ...file };
}
export function scoped<T>(schema: z.ZodType<T>, raw: unknown, tenant: Tenant): T {
  const value = parseWith(schema, raw, 'V3 object');
  if ((value as { tenant: unknown }).tenant !== tenant) throw new GtmError('TENANT_MISMATCH', 'Object belongs to another tenant');
  return value;
}
export function bytes(root: string, path: string) { return readFileSync(safePath(root, path)); }

