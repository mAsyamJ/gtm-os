import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { parseWith, readText, safeDirectory, safePath } from '../../core/src/workspace.js';
import { canonical, GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { ApprovalSchema, HANDLES, HashSchema, IdSchema, TenantSchema, TimeSchema, type Tenant } from '../../schemas/src/index.js';
import { checkApproval, denyExternalAction } from '../../policy/src/index.js';
import { screenUntrusted, saveResearchOutput } from '../../research/src/index.js';
import { immutableFile } from '../../creative/src/common.js';
import { OperationsStore } from '../../operations/src/store.js';
import { operationsContext, readonlyOperations } from '../../operations/src/common.js';

const MediaSchema = z.strictObject({ path: z.string(), sha256: HashSchema, receiptPath: z.string(), receiptSha256: HashSchema });
export const DraftSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, label: z.literal('SYNTHETIC'), platform: z.literal('x'), action: z.literal('publish'),
  expectedHandle: z.string(), text: z.string().min(1).max(250).startsWith('SYNTHETIC DEMO:'),
  media: z.array(MediaSchema).max(4), createdAt: TimeSchema, expiresAt: TimeSchema,
  sources: z.array(z.strictObject({ path: z.string(), sha256: HashSchema })).nonempty(),
  scheduledAt: z.null(), audience: z.string().min(1), approvalStatus: z.literal('NOT_APPROVED'),
});
export type Draft = z.infer<typeof DraftSchema>;
const IdentitySchema = z.strictObject({ tenant: TenantSchema, provider: z.literal('mock-x'), label: z.literal('SYNTHETIC'),
  principalId: IdSchema, handle: z.string(), scopes: z.array(z.string()), observedAt: TimeSchema, source: z.literal('MOCK_USERS_ME') });
export const SimulationApprovalSchema = z.strictObject({ label: z.literal('SYNTHETIC'), authority: z.literal('SIMULATION_ONLY_NOT_OWNER_AUTHORITY'), approval: ApprovalSchema });
const DispatchSchema = z.strictObject({ id: IdSchema, tenant: TenantSchema, label: z.literal('SYNTHETIC'), requestKey: IdSchema,
  version: z.number().int().positive(), draftId: IdSchema, payloadSha256: HashSchema, principalId: IdSchema,
  status: z.enum(['SIMULATED_CONFIRMED', 'UNKNOWN_OUTCOME']), attempts: z.literal(1),
  receiptId: IdSchema.nullable(), approvalSha256: HashSchema, externalSideEffects: z.literal(false), actualUsd: z.literal(0) });
type Dispatch = z.infer<typeof DispatchSchema>;
const ReceiptSchema = z.strictObject({ id: IdSchema, tenant: TenantSchema, label: z.literal('SYNTHETIC'),
  provider: z.literal('mock-x'), principalId: IdSchema, payloadSha256: HashSchema, receiptId: IdSchema, status: z.literal('ACCEPTED') });
const WebhookSchema = ReceiptSchema.extend({ id: IdSchema, requestKey: IdSchema });

export function mockIdentity(tenant: Tenant, now = new Date()) {
  return IdentitySchema.parse({ tenant, provider: 'mock-x', label: 'SYNTHETIC', principalId: `mock-${tenant}`,
    handle: HANDLES[tenant], scopes: ['tweet.read', 'tweet.write', 'users.read'], observedAt: now.toISOString(), source: 'MOCK_USERS_ME' });
}

function verifyMedia(root: string, tenant: Tenant, media: z.infer<typeof MediaSchema>) {
  const prefix = new RegExp(`^runtime/creative/${tenant}/(?:graphics|video)/[a-f0-9]{64}/`);
  if (!prefix.test(media.receiptPath) || !media.receiptPath.endsWith('/manifest.json') ||
    !media.path.startsWith(media.receiptPath.slice(0, -'manifest.json'.length)) || !/\/(?:image\.png|video\.mp4)$/.test(media.path))
    throw new GtmError('MEDIA_SCOPE', 'Media and receipt must be a scoped synthetic creative export');
  const receiptBytes = readText(root, media.receiptPath);
  if (sha256(receiptBytes) !== media.receiptSha256 || sha256(readFileSync(safePath(root, media.path))) !== media.sha256)
    throw new GtmError('MEDIA_CHANGED', 'Media or receipt digest differs from the frozen payload');
  const receipt = parseWith(z.object({ tenant: TenantSchema, label: z.literal('SYNTHETIC DEMO / PLACEHOLDER'),
    qc: z.object({ status: z.literal('PASS') }), files: z.array(z.object({ path: z.string(), sha256: HashSchema })) }), JSON.parse(receiptBytes), 'media receipt');
  if (receipt.tenant !== tenant || !receipt.files.some(f => f.path === media.path && f.sha256 === media.sha256)) throw new GtmError('MEDIA_SCOPE', 'Receipt does not bind this tenant/media');
}

export function mediaFromReceipt(root: string, selected: unknown, path: string) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  if (!new RegExp(`^runtime/creative/${tenant}/(?:graphics|video)/[a-f0-9]{64}/manifest\\.json$`).test(path)) throw new GtmError('MEDIA_SCOPE', 'Only a selected tenant creative receipt is accepted');
  const text = readText(root, path);
  const receipt = parseWith(z.object({ files: z.array(z.object({ path: z.string(), sha256: HashSchema })) }), JSON.parse(text), 'creative receipt');
  const file = receipt.files.find(f => /\/(?:image\.png|video\.mp4)$/.test(f.path));
  if (!file) throw new GtmError('MEDIA_MISSING', 'Creative receipt has no supported local media');
  const media = { ...file, receiptPath: path, receiptSha256: sha256(text) }; verifyMedia(root, tenant, media); return media;
}

function validateDraft(root: string, tenant: Tenant, raw: unknown, now: Date): Draft {
  const draft = parseWith(DraftSchema, raw, 'distribution draft'); screenUntrusted(draft);
  if (draft.tenant !== tenant || !draft.id.startsWith(tenant + '-') || draft.expectedHandle !== HANDLES[tenant]) throw new GtmError('TENANT_MISMATCH', 'Draft/account scope mismatch');
  if (Date.parse(draft.createdAt) > now.getTime() || Date.parse(draft.expiresAt) <= now.getTime() || Date.parse(draft.expiresAt) <= Date.parse(draft.createdAt)) throw new GtmError('DRAFT_EXPIRED', 'Draft validity window is not current');
  const required = [`brands/${tenant}/VOICE.md`, `brands/${tenant}/claims-ledger.yaml`, 'distribution/AGENTS.md'];
  if (draft.sources.length !== required.length || new Set(draft.sources.map(s => s.path)).size !== required.length) throw new GtmError('DRAFT_SOURCE', 'Draft requires exact tenant/governance source references');
  for (const source of draft.sources) {
    if (!required.includes(source.path) || sha256(readText(root, source.path)) !== source.sha256) throw new GtmError('DRAFT_SOURCE', 'Draft source revision changed');
  }
  for (const media of draft.media) verifyMedia(root, tenant, media);
  return draft;
}

export function prepareDraft(root: string, selected: unknown, options: { fixture: unknown; media?: z.infer<typeof MediaSchema>[] }, now = new Date()) {
  const context = operationsContext(root, selected, options.fixture === 'synthetic'); const tenant = context.tenant;
  const createdAt = new Date(now.toISOString().slice(0, 10)).toISOString();
  const sources = [`brands/${tenant}/VOICE.md`, `brands/${tenant}/claims-ledger.yaml`, 'distribution/AGENTS.md'].map(path => ({ path, sha256: sha256(readText(root, path)) }));
  const text = tenant === 'founder' ? 'SYNTHETIC DEMO: I want technical decisions to be inspectable. What evidence would make an example useful? This is an illustrative draft, not a personal achievement.' :
    'SYNTHETIC DEMO: What would make a product explanation useful? Start with current evidence and make its limits clear. This illustrative draft asserts no live product capability.';
  const base = { tenant, label: 'SYNTHETIC', platform: 'x', action: 'publish', expectedHandle: HANDLES[tenant], text,
    media: options.media ?? [], createdAt, expiresAt: new Date(Date.parse(createdAt) + 86400_000).toISOString(), sources,
    scheduledAt: null, audience: context.intendedAudience, approvalStatus: 'NOT_APPROVED' };
  const draft = validateDraft(root, tenant, { id: `${tenant}-draft-${hashObject(base).slice(0, 16)}`, ...base }, now);
  using store = new OperationsStore(root, tenant); store.put('draft', draft);
  return { ...context, draft, payloadSha256: hashObject(draft), liveGates: liveBoundary(tenant) };
}

export function liveBoundary(selected: unknown) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  return { tenant, provider: 'x-official', expectedHandle: HANDLES[tenant], principalId: null, authenticated: false,
    identityEndpoint: 'GET /2/users/me', createEndpoint: 'POST /2/tweets',
    identityStatus: 'NOT_AUTHENTICATED_NOT_PROBED', mcp: 'NOT_CONNECTED_TOOLS_NOT_DISCOVERED',
    estimate: { known: false, estimatedUsd: null, basis: 'LIVE_TOTAL_ACCOUNT_SCOPES_MEDIA_AND_PRICE_NOT_VERIFIED' },
    hardCapUsd: 0, signedOwnerApproval: 'NOT_ESTABLISHED', executable: false,
    blockers: ['EXTERNAL_WRITES_DISABLED', 'PAID_API_DISABLED', 'IDENTITY_NOT_VERIFIED', 'CURRENT_TOTAL_PRICE_NOT_VERIFIED', 'SIGNED_OWNER_APPROVAL_MISSING'] };
}
export class OfficialXBoundary {
  constructor(readonly tenant: Tenant) { parseWith(TenantSchema, tenant, 'tenant'); }
  identity() { return liveBoundary(this.tenant); }
  costEstimate() { return liveBoundary(this.tenant).estimate; }
  discoverMcp(): never { throw new GtmError('MCP_NOT_CONNECTED', 'Live MCP discovery requires separately approved identity and cost scope', 4); }
  execute(): never { return denyExternalAction(); }
}

export function manualPackage(root: string, selected: unknown, draftId: string, now = new Date()) {
  const context = operationsContext(root, selected, true); using store = new OperationsStore(root, context.tenant, { readonly: true });
  const raw = store.get('draft', draftId); if (!raw) throw new GtmError('DRAFT_MISSING', 'Prepared draft not found in selected tenant', 4);
  const draft = validateDraft(root, context.tenant, raw, now), payloadSha256 = hashObject(draft);
  const directory = `runtime/operations/${context.tenant}/manual/${payloadSha256}`; safeDirectory(root, directory);
  const files = [immutableFile(root, `${directory}/draft.txt`, draft.text)];
  for (const [index, media] of draft.media.entries()) files.push(immutableFile(root, `${directory}/media-${index + 1}${media.path.endsWith('.mp4') ? '.mp4' : '.png'}`, readFileSync(safePath(root, media.path))));
  const document = { ...context, kind: 'manual-package', status: 'MANUAL_REVIEW_ONLY_NOT_READY_TO_PUBLISH', draft, payloadSha256, files,
    account: { expectedProfileUrl: `https://x.com/${HANDLES[context.tenant]}`, identityVerified: false, principalId: null },
    liveGates: liveBoundary(context.tenant), requiredReview: ['Review source/claim/license scope and exact text/media', 'Establish authenticated account principal and current full price', 'Obtain exact immutable owner action approval; defaults currently prohibit execution'] };
  return saveResearchOutput(root, context.tenant, 'manual-package', document);
}

export function illustrativeApproval(draft: Draft, now = new Date()) {
  return SimulationApprovalSchema.parse({ label: 'SYNTHETIC', authority: 'SIMULATION_ONLY_NOT_OWNER_AUTHORITY', approval: {
    id: `${draft.tenant}-mock-approval`, tenant: draft.tenant, platform: 'x', resolved_user_id: `mock-${draft.tenant}`, expected_handle: HANDLES[draft.tenant],
    asset_sha256: draft.media.map(m => m.sha256), canonical_payload_sha256: hashObject(draft), action_type: 'publish',
    approved_at: now.toISOString(), expires_at: new Date(now.getTime() + 3600_000).toISOString(), actor: 'SYNTHETIC_OWNER_FIXTURE',
    price_snapshot: { id: 'mock-local-zero', known: true, estimated_usd: 0 }, max_charge: 0,
    safe_window: { start: now.toISOString(), end: new Date(now.getTime() + 3600_000).toISOString() } } });
}

export function simulationGate(root: string, selected: unknown, rawDraft: unknown, rawApproval: unknown, rawIdentity: unknown, estimatedUsd: number | null, now = new Date()) {
  const tenant = parseWith(TenantSchema, selected, 'tenant'); operationsContext(root, tenant, true);
  const draft = validateDraft(root, tenant, rawDraft, now), envelope = parseWith(SimulationApprovalSchema, rawApproval, 'simulation-only approval');
  const identity = parseWith(IdentitySchema, rawIdentity, 'simulation identity');
  const result = checkApproval(envelope.approval, { tenant, principalId: identity.principalId, payloadSha256: hashObject(draft), mediaSha256: draft.media.map(m => m.sha256), estimatedUsd, now: now.toISOString() });
  const reasons = [...result.reasons];
  if (identity.tenant !== tenant || identity.principalId !== `mock-${tenant}` || identity.handle !== HANDLES[tenant]) reasons.push('IDENTITY_MISMATCH');
  if (identity.observedAt !== now.toISOString()) reasons.push('IDENTITY_REVALIDATION_REQUIRED');
  if (!['tweet.read', 'tweet.write', 'users.read'].every(s => identity.scopes.includes(s))) reasons.push('SCOPES_MISSING');
  if (envelope.approval.actor !== 'SYNTHETIC_OWNER_FIXTURE') reasons.push('NOT_SIMULATION_ACTOR');
  return { validForSimulation: !reasons.length, reasons, executable: false as const, label: 'SYNTHETIC' as const };
}

function latest(store: OperationsStore, key: string): Dispatch | undefined {
  return store.list('dispatch').map(v => parseWith(DispatchSchema, v, 'dispatch snapshot')).filter(v => v.requestKey === key).sort((a, b) => b.version - a.version)[0];
}

export function simulateDispatch(root: string, selected: unknown, draftId: string, options: { requestKey: string; approval: unknown; identity: unknown; estimatedUsd: number | null; fault?: 'none' | 'timeout-before-accept' | 'timeout-after-accept' }, now = new Date()) {
  const context = operationsContext(root, selected, true), tenant = context.tenant;
  if (!options.requestKey.startsWith(tenant + '-') || options.requestKey.length > 100) throw new GtmError('REQUEST_SCOPE', 'Request key must be tenant-prefixed and at most 100 characters', 2);
  parseWith(IdSchema, options.requestKey, 'request key');
  using store = new OperationsStore(root, tenant);
  return store.transaction(() => {
    const raw = store.get('draft', draftId); if (!raw) throw new GtmError('DRAFT_MISSING', 'Draft is absent in selected tenant', 4);
    const draft = parseWith(DraftSchema, raw, 'draft'), hash = hashObject(draft); const prior = latest(store, options.requestKey);
    if (prior) {
      if (prior.payloadSha256 !== hash || prior.draftId !== draftId) throw new GtmError('IDEMPOTENCY_CONFLICT', 'Request key already binds another immutable payload');
      return { ...context, dispatch: prior, replayed: true, blindRetryAllowed: false, audit: store.verify() };
    }
    const gate = simulationGate(root, tenant, draft, options.approval, options.identity, options.estimatedUsd, now);
    if (!gate.validForSimulation) throw new GtmError('SIMULATION_GATE', `Simulation denied: ${gate.reasons.join(', ')}`, 3);
    const fault = options.fault ?? 'none'; if (!['none', 'timeout-before-accept', 'timeout-after-accept'].includes(fault)) throw new GtmError('SCENARIO_INVALID', 'Unknown synthetic delivery scenario', 2);
    const receiptId = `mock-receipt-${hash.slice(0, 20)}-${options.requestKey}`;
    if (fault !== 'timeout-before-accept') store.put('mock_receipt', ReceiptSchema.parse({ id: options.requestKey, tenant, label: 'SYNTHETIC', provider: 'mock-x',
      principalId: `mock-${tenant}`, payloadSha256: hash, receiptId, status: 'ACCEPTED' }));
    const dispatch = DispatchSchema.parse({ id: `${options.requestKey}.v1`, requestKey: options.requestKey, version: 1, tenant, label: 'SYNTHETIC', draftId,
      payloadSha256: hash, principalId: `mock-${tenant}`, status: fault === 'none' ? 'SIMULATED_CONFIRMED' : 'UNKNOWN_OUTCOME', attempts: 1,
      receiptId: fault === 'none' ? receiptId : null, approvalSha256: hashObject(options.approval), externalSideEffects: false, actualUsd: 0 });
    store.put('dispatch', dispatch);
    return { ...context, dispatch, replayed: false, blindRetryAllowed: false, audit: store.verify() };
  });
}

export function reconcileDispatch(root: string, selected: unknown, key: string, event?: unknown) {
  const context = operationsContext(root, selected, true); using store = new OperationsStore(root, context.tenant);
  return store.transaction(() => {
    const dispatch = latest(store, key); if (!dispatch) throw new GtmError('DISPATCH_MISSING', 'No simulation found for the selected tenant/request', 4);
    const receipt = store.get('mock_receipt', key);
    if (!receipt) return { ...context, dispatch, resolution: 'UNKNOWN_NO_AUTHORITATIVE_MOCK_RECEIPT', blindRetryAllowed: false, audit: store.verify() };
    const known = parseWith(ReceiptSchema, receipt, 'mock receipt');
    if (known.payloadSha256 !== dispatch.payloadSha256 || known.principalId !== dispatch.principalId) throw new GtmError('RECONCILIATION_MISMATCH', 'Mock read-back does not match principal/payload');
    const webhook = parseWith(WebhookSchema, event ?? { ...known, id: `${key}.readback`, requestKey: key }, 'mock reconciliation event');
    const { requestKey, id: eventId, ...eventBody } = webhook;
    const { id: _knownId, ...knownBody } = known;
    if (webhook.tenant !== context.tenant || requestKey !== key || canonical(eventBody) !== canonical(knownBody)) throw new GtmError('RECONCILIATION_MISMATCH', 'Untrusted event cannot replace the local mock receipt');
    store.put('webhook', { ...webhook, id: eventId });
    let final = dispatch;
    if (dispatch.status === 'UNKNOWN_OUTCOME') {
      final = { ...dispatch, id: `${key}.v${dispatch.version + 1}`, version: dispatch.version + 1, status: 'SIMULATED_CONFIRMED', receiptId: known.receiptId };
      store.put('dispatch', final);
    }
    return { ...context, dispatch: final, resolution: 'MOCK_RECEIPT_CONFIRMED', blindRetryAllowed: false, audit: store.verify() };
  });
}

export function distributionStatus(root: string, selected: unknown) {
  const context = operationsContext(root, selected, true); using store = readonlyOperations(root, context.tenant);
  const snapshots = store?.list('dispatch').map(v => parseWith(DispatchSchema, v, 'dispatch snapshot')) ?? [];
  const current = snapshots.filter(d => !snapshots.some(o => o.requestKey === d.requestKey && o.version > d.version));
  return { ...context, drafts: store?.list('draft').map(d => ({ id: d.id, payloadSha256: hashObject(d) })) ?? [], simulations: current,
    simulatedAcceptances: store?.list('mock_receipt').length ?? 0, live: liveBoundary(context.tenant), audit: store?.verify() ?? { valid: true, records: 0, headHash: '0'.repeat(64) } };
}
