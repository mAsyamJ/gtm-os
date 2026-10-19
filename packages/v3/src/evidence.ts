import { z } from 'zod';
import { GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { HashSchema, IdSchema, TenantSchema, TimeSchema, type Tenant } from '../../schemas/src/index.js';
import { screenUntrusted } from '../../research/src/index.js';
import { context, localInput, open, records, scoped, type Dataset } from './common.js';

export const InputEvidence = z.strictObject({ id: IdSchema, tenant: TenantSchema, title: z.string().min(1).max(240),
  uri: z.url(), revision: z.string().min(1).max(160), observedAt: TimeSchema, expiresAt: TimeSchema,
  text: z.string().min(1).max(100000), contentSha256: HashSchema, license: z.string().min(1).max(200),
  statements: z.array(z.string().min(1).max(1500)).min(1).max(30) });
export type Evidence = z.infer<typeof InputEvidence> & { label: 'RETRIEVED_UNVERIFIED' | 'SYNTHETIC'; origin: string };
const Review = z.strictObject({ evidenceId: IdSchema, evidenceSha256: HashSchema,
  classification: z.enum(['REVIEWED_SOURCE', 'OWNER_ATTESTED']), actor: z.enum(['owner', 'source-reviewer']),
  permittedClaims: z.array(z.string().min(1).max(1500)).min(1).max(30), authenticFirstPerson: z.boolean() });
export function evidenceList(root: string, tenant: Tenant, dataset: Dataset = 'OBSERVED') {
  return records(root, tenant, 'evidence', dataset) as unknown as Evidence[];
}
export function checkEvidence(value: Evidence, now = new Date()) {
  if (sha256(value.text) !== value.contentSha256) throw new GtmError('SOURCE_HASH', 'Evidence bytes changed');
  const start = Date.parse(value.observedAt), end = Date.parse(value.expiresAt);
  if (start > now.getTime() || end <= now.getTime() || end <= start || end - start > 90 * 86400000)
    throw new GtmError('SOURCE_EXPIRED', 'Evidence must be current with a bounded validity window');
  if (value.statements.some(s => !value.text.includes(s))) throw new GtmError('CLAIM_NOT_SUPPORTED', 'Claim must be an exact supported source segment');
}
export function ingestEvidence(root: string, selected: unknown, path: string, dataset: Dataset = 'OBSERVED', now = new Date()) {
  const c = context(root, selected, dataset); const raw = scoped(InputEvidence, localInput(root, c.tenant, path, 'research'), c.tenant);
  const url = new URL(raw.uri);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    /^(localhost|127\.|\[|10\.|192\.168\.)/.test(url.hostname)) throw new GtmError('SOURCE_URI', 'Only credential-free public HTTPS provenance is supported');
  if (!raw.id.startsWith(c.tenant + '-')) throw new GtmError('SOURCE_SCOPE', 'Evidence ID must be tenant-prefixed');
  screenUntrusted(raw);
  const value: Evidence = { ...raw, label: dataset === 'SYNTHETIC' ? 'SYNTHETIC' : 'RETRIEVED_UNVERIFIED', origin: 'AUTHORIZED_INBOX_FILE' };
  checkEvidence(value, now); using store = open(root, c.tenant, dataset); store.put('evidence', value);
  return { ...c, ...value, sha256: hashObject(value), verification: 'RETRIEVAL_OR_OWNER_SUPPLIED_BYTES_ONLY', permittedPublicClaims: [] };
}
export function reviewEvidence(root: string, selected: unknown, path: string, dataset: Dataset = 'OBSERVED') {
  const c = context(root, selected, dataset); const review = Review.parse(localInput(root, c.tenant, path, 'research'));
  const source = evidenceList(root, c.tenant, dataset).find(s => s.id === review.evidenceId);
  if (!source) throw new GtmError('EVIDENCE_GAP', 'Evidence is absent in selected tenant', 4);
  checkEvidence(source); screenUntrusted(review);
  if (review.classification === 'OWNER_ATTESTED' && review.actor !== 'owner') throw new GtmError('OWNER_ATTESTATION_REQUIRED', 'A source reviewer cannot attest owner experience', 3);
  if (review.evidenceSha256 !== hashObject(source) || review.permittedClaims.some(s => !source.statements.includes(s)))
    throw new GtmError('CLAIM_NOT_SUPPORTED', 'Review must bind the exact source revision and supported statements');
  if (review.authenticFirstPerson && review.classification !== 'OWNER_ATTESTED') throw new GtmError('AUTHENTICITY_GAP', 'Personal experience requires owner attestation');
  const value = { id: `${c.tenant}-review-${hashObject(review).slice(0, 24)}`, tenant: c.tenant,
    label: dataset === 'SYNTHETIC' ? 'SYNTHETIC' as const : review.classification, ...review,
    authority: review.actor === 'owner' ? 'OWNER_SUPPLIED_REVIEW_NOT_PLATFORM_OR_PRODUCT_VERIFICATION' : 'LOCAL_SOURCE_REVIEW_NOT_PUBLICATION_AUTHORITY', reviewStatus: 'REVIEWED',
    observedAt: source.observedAt, expiresAt: source.expiresAt, sourceRevision: source.revision };
  using store = open(root, c.tenant, dataset); store.put('review', value); return { ...c, ...value };
}
export function usable(root: string, tenant: Tenant, dataset: Dataset = 'OBSERVED', sourceId?: string, at = new Date()) {
  const reviews = records(root, tenant, 'review', dataset);
  return evidenceList(root, tenant, dataset).filter(s => !sourceId || sourceId === s.id).flatMap(source => {
    try { checkEvidence(source, at); } catch { return []; }
    const review = reviews.find(r => r.evidenceId === source.id && r.evidenceSha256 === hashObject(source));
    if (!review) return [];
    const claims = z.array(z.string()).parse(review.permittedClaims);
    return [{ source, review, claims }];
  });
}
export function researchDigest(root: string, selected: unknown, dataset: Dataset = 'OBSERVED', days = 30) {
  const c = context(root, selected, dataset);
  if (!Number.isSafeInteger(days) || days < 1 || days > 90) throw new GtmError('INVALID_WINDOW', 'Research window must be 1–90 days', 2);
  const cards = evidenceList(root, c.tenant, dataset); const good = usable(root, c.tenant, dataset);
  return { ...c, status: good.length ? 'REVIEWED_INPUTS_AVAILABLE' : 'EVIDENCE_GAP', days,
    cards: cards.map(s => ({ id: s.id, label: s.label, revision: s.revision, uri: s.uri, expiresAt: s.expiresAt,
      current: (() => { try { checkEvidence(s); return true; } catch { return false; } })(),
      inWindow: Date.parse(s.observedAt) >= Date.now() - days * 86400000 })),
    themes: good.map(v => ({ sourceId: v.source.id, title: v.source.title, claims: v.claims, classification: v.review.label })),
    opposingViews: 'NOT_ESTABLISHED_FROM_CURRENT_SOURCE_SET', networkRequests: 0, hostedModelRequests: 0 };
}

