import { existsSync } from 'node:fs';
import { loadBrand, loadPolicy, readText, safePath } from '../../core/src/workspace.js';
import { GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { TenantSchema } from '../../schemas/src/index.js';
import { parseWith } from '../../core/src/workspace.js';
import { OperationsStore } from './store.js';

export function operationsContext(root: string, selected: unknown, synthetic: unknown) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  if (synthetic !== true) throw new GtmError('SYNTHETIC_REQUIRED', 'Explicit synthetic/offline mode is required; real provider data and publication are unavailable', 3);
  loadPolicy(root); loadBrand(root, tenant);
  const paths = ['AGENTS.md', 'distribution/AGENTS.md', 'distribution/WORKFLOWS.md', 'growth/AGENTS.md', 'growth/WORKFLOWS.md',
    ...['AGENTS.md', 'VOICE.md', 'DESIGN.md', 'POSITIONING.md', 'MESSAGING.md', 'claims-ledger.yaml'].map(n => `brands/${tenant}/${n}`)];
  const inputs = paths.map(path => ({ path, sha256: sha256(readText(root, path)) }));
  return { tenant, label: 'SYNTHETIC' as const, revision: 'phase-e-r1', intendedAudience: 'Owner reviewing offline simulations and proposed measurement',
    inputs, inputSha256: hashObject(inputs), evidenceScope: 'LOCAL_GOVERNANCE_AND_SYNTHETIC_FIXTURES_ONLY',
    assetSource: 'LOCAL_TEXT_AND_OPTIONAL_HASHED_SYNTHETIC_MEDIA', assetLicense: 'LOCAL_REVIEW_ONLY_NO_PUBLIC_APPROVAL',
    approvalStatus: 'NOT_APPROVED', publicationAuthorized: false, providerCalls: 0, providerCostUsd: 0, operatorComputeCost: 'NOT_MEASURED',
    limitations: ['All event, identity, approval and provider outcome fixtures are SYNTHETIC; none establish live account authentication, customer behavior or personal achievements.',
      'No credential file, account endpoint, live MCP tool or billable request was accessed by the runtime.', 'Every real external action remains disabled.'] };
}

export function readonlyOperations(root: string, tenant: unknown): OperationsStore | undefined {
  const selected = parseWith(TenantSchema, tenant, 'tenant');
  return existsSync(safePath(root, `runtime/state/${selected}/operations.sqlite`)) ? new OperationsStore(root, selected, { readonly: true }) : undefined;
}
