import { z } from 'zod';
import { basename } from 'node:path';
import { HashSchema, IdSchema, HANDLES, TenantSchema, TimeSchema } from '../../schemas/src/index.js';
import { GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { screenUntrusted } from '../../research/src/index.js';
import { immutableFile } from '../../creative/src/common.js';
import { safeDirectory } from '../../core/src/workspace.js';
import { context, bytes, localInput, open, records, type Dataset } from './common.js';
import { draftById } from './editorial.js';

const File = z.object({ path: z.string(), sha256: HashSchema, bytes: z.number().optional() });
export const Packet = z.object({ id: IdSchema, tenant: TenantSchema, label: z.enum(['SYNTHETIC', 'REVIEWED_SOURCE', 'OWNER_ATTESTED']),
  draftId: IdSchema, account: z.string(), payloadSha256: HashSchema, files: z.array(File).nonempty(),
  evidence: z.array(z.object({ evidenceId: IdSchema, evidenceSha256: HashSchema, statement: z.string() })).nonempty(),
  media: z.array(File), creativeReady: z.boolean(), immutablePayload: z.record(z.string(), z.json()) }).passthrough();
export type Packet = z.infer<typeof Packet>;
function packetRecord(root: string, tenant: z.infer<typeof TenantSchema>, id: string, dataset: Dataset) {
  const raw = records(root, tenant, 'packet', dataset).find(p => p.id === id);
  if (!raw) throw new GtmError('PACKET_MISSING', 'Packet is absent in selected tenant', 4);
  const packet = Packet.parse(raw);
  if (packet.account !== HANDLES[tenant] || hashObject(packet.immutablePayload) !== packet.payloadSha256)
    throw new GtmError('PAYLOAD_CHANGED', 'Packet account/payload hash differs');
  return packet;
}
export function packetById(root: string, tenant: z.infer<typeof TenantSchema>, id: string, dataset: Dataset = 'OBSERVED', at = new Date()) {
  const packet = packetRecord(root, tenant, id, dataset);
  draftById(root, tenant, packet.draftId, dataset, at);
  for (const file of [...packet.files, ...packet.media]) {
    if (!file.path.startsWith(`runtime/v3/${tenant}/`) || sha256(bytes(root, file.path)) !== file.sha256)
      throw new GtmError('PAYLOAD_CHANGED', 'Packet file or media changed after hashing');
  }
  return packet;
}
export function manualPack(root: string, selected: unknown, draftId: string, dataset: Dataset = 'OBSERVED') {
  const c = context(root, selected, dataset); const draft = draftById(root, c.tenant, draftId, dataset);
  const creative = records(root, c.tenant, 'creative', dataset).find(a => a.draftId === draftId);
  const media = creative ? z.array(File).parse(creative.files) : [];
  const payload = { tenant: c.tenant, account: HANDLES[c.tenant], draftId, blocks: draft.blocks, claims: draft.claims,
    governance: draft.governance, media, citations: draft.citations ?? [], riskDisclosures: draft.protectedSegments, publicationMethod: 'OWNER_NATIVE_UI_ONLY',...(draft.briefId?{rightsReview:'REQUIRED_BEFORE_PUBLICATION'}:{}) };
  const payloadSha256 = hashObject(payload); const directory = `runtime/v3/${c.tenant}/manual-publish/${payloadSha256}`;
  safeDirectory(root, directory);
  const citations = z.array(z.object({uri:z.string(),revision:z.string(),license:z.string()})).parse(draft.citations ?? []);
  const citationText=citations.map(s=>`${s.uri} (revision ${s.revision}; ${s.license})`).join('\n');
  const text = draft.blocks.join('\n\n');
  const files = [immutableFile(root, `${directory}/post.txt`, text),
    immutableFile(root, `${directory}/thread.md`, draft.blocks.map((v, i) => `${i + 1}. ${v}`).join('\n\n') + '\n'),
    immutableFile(root, `${directory}/alt.txt`, 'Source-supported editorial geometry; prototype styling. No actual product UI or real activity shown.\n'),
    immutableFile(root, `${directory}/sources.md`, citationText+'\n'),
    immutableFile(root, `${directory}/preview.html`, `<meta charset="utf-8"><title>Manual review</title><pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`),
    immutableFile(root, `${directory}/instructions.md`, `# Manual handoff — HOLD\n\nAccount: @${HANDLES[c.tenant]}\nPayload SHA256: ${payloadSha256}\n\nReview sources, exact wording, authenticity, risk language, media and licenses. Approve this exact account and hash through the owner decision inbox. Sign in yourself and confirm the account in X's native interface. Any edit requires a new packet and approval. Supply the resulting post URL and owned metrics export. This software posts and schedules nothing. Owner-reported records are not platform verification.\n`)];
  for (const item of media) {
    const base=basename(item.path); const video=item.path.includes('/landscape/')||item.path.includes('/portrait/');
    const aspect=item.path.includes('/portrait/')?'portrait':'landscape';
    const category=video?'video':'images'; safeDirectory(root,`${directory}/${category}`);
    files.push(immutableFile(root,`${directory}/${category}/${video?aspect+'-':''}${base}`,bytes(root,item.path)));
  }
  const packet = Packet.parse({ ...c, id: `${c.tenant}-packet-${payloadSha256.slice(0, 24)}`, label: draft.label,
    draftId, account: HANDLES[c.tenant], payloadSha256, evidence: draft.claims, files, media,
    creativeReady: media.some(m => m.path.endsWith('.mp4')) && media.some(m => m.path.endsWith('.png')),
    ...(draft.briefId?{requiresRightsReview:true}:{}),
    immutablePayload: payload, state: 'AWAITING_OWNER_APPROVAL', humanReview: 'PENDING', directory });
  immutableFile(root, `${directory}/publishing-package.json`, JSON.stringify(packet, null, 2) + '\n');
  using store = open(root, c.tenant, dataset); store.put('packet', packet); return packet;
}
const Decision = z.strictObject({ tenant: TenantSchema, packetId: IdSchema, payloadSha256: HashSchema,
  account: z.string(), actor: z.literal('owner'), at: TimeSchema,
  event: z.enum(['APPROVE_MANUAL', 'REJECT', 'INVALIDATE', 'HANDOFF', 'OWNER_REPORTED_SCHEDULED', 'OWNER_REPORTED_PUBLISHED', 'PUBLICATION_UNKNOWN']),
  editorialReviewed: z.boolean().optional(), creativeReviewed: z.boolean().optional(), authenticityReviewed: z.boolean().optional(),rightsReviewed:z.boolean().optional(),
  expiresAt: TimeSchema.optional(), postUrl: z.url().optional() });
export function publicationHistory(root: string, tenant: z.infer<typeof TenantSchema>, packetId: string, dataset: Dataset = 'OBSERVED') {
  return records(root, tenant, 'publication', dataset).filter(r => r.packetId === packetId).sort((a, b) => Number(a.sequence) - Number(b.sequence));
}
export function importDecision(root: string, selected: unknown, path: string, dataset: Dataset = 'OBSERVED', now = new Date()) {
  const c = context(root, selected, dataset); const raw = localInput(root, c.tenant, path, 'distribution');
  // Resolve the packet before interpreting an untrusted event as publication evidence.
  const reference = z.object({ packetId: IdSchema }).parse(raw);
  const boundPacket = packetRecord(root, c.tenant, reference.packetId, dataset);
  const d = Decision.parse(raw); screenUntrusted(d);
  // Revocation remains possible when content has expired or media was altered.
  // Only approval and handoff paths can authorize a newly validated payload.
  const packet = ['REJECT', 'INVALIDATE'].includes(d.event) ? boundPacket : packetById(root, c.tenant, d.packetId, dataset);
  if (d.tenant !== c.tenant || d.account !== packet.account || d.payloadSha256 !== packet.payloadSha256 || Date.parse(d.at) > now.getTime())
    throw new GtmError('APPROVAL_BINDING', 'Owner decision must match tenant, account, time and exact payload hash');
  using store = open(root, c.tenant, dataset);
  return store.transaction(() => {
    const id = `${c.tenant}-publication-${hashObject(d).slice(0, 24)}`;
    const prior = store.get('publication', id); if (prior) return { ...c, ...prior, duplicate: true };
    const history = publicationHistory(root, c.tenant, packet.id, dataset); const latest = history.at(-1);
    if (latest && Date.parse(d.at) < Date.parse(String(latest.at))) throw new GtmError('EVENT_ORDER', 'Publication decisions cannot move backwards in time');
    const state = String(latest?.state ?? 'AWAITING_OWNER_APPROVAL');
    const approval = history.findLast(h => h.event === 'APPROVE_MANUAL');
    let next: string;
    if (d.event === 'APPROVE_MANUAL') {
      if (!['AWAITING_OWNER_APPROVAL', 'REJECTED', 'INVALIDATED'].includes(state) || !packet.creativeReady || !d.editorialReviewed || !d.creativeReviewed || !d.authenticityReviewed || (Boolean(draftById(root,c.tenant,packet.draftId,dataset).briefId)&&!d.rightsReviewed) ||
        !d.expiresAt || Date.parse(d.expiresAt) <= now.getTime() || Date.parse(d.expiresAt) - Date.parse(d.at) > 7 * 86400000)
        throw new GtmError('OWNER_REVIEW_REQUIRED', 'Current exact-hash approval, complete creative and explicit human reviews are required', 3);
      next = 'APPROVED_FOR_MANUAL';
    } else if (d.event === 'REJECT' || d.event === 'INVALIDATE') next = d.event === 'REJECT' ? 'REJECTED' : 'INVALIDATED';
    else {
      if (!approval || Date.parse(String(approval.expiresAt)) <= now.getTime() || ['REJECTED', 'INVALIDATED', 'AWAITING_OWNER_APPROVAL'].includes(state))
        throw new GtmError('OWNER_APPROVAL_MISSING', 'A current owner approval must precede manual handoff or publication reporting', 3);
      if (d.event === 'HANDOFF') {
        if (state !== 'APPROVED_FOR_MANUAL') throw new GtmError('ILLEGAL_TRANSITION', 'Handoff requires approved manual state'); next = 'HANDED_OFF';
      } else {
        if (!['HANDED_OFF', 'OWNER_REPORTED_SCHEDULED', 'PUBLICATION_UNKNOWN'].includes(state)) throw new GtmError('ILLEGAL_TRANSITION', 'Publication reporting requires prior handoff');
        next = d.event;
        if (d.event === 'OWNER_REPORTED_PUBLISHED') {
          if (!d.postUrl) throw new GtmError('POST_URL_REQUIRED', 'Owner publication reporting requires a post URL');
          const url = new URL(d.postUrl);
          if (!['x.com', 'twitter.com'].includes(url.hostname) || url.protocol !== 'https:' || url.search || url.hash ||
            !new RegExp(`^/${packet.account}/status/[0-9]+$`, 'i').test(url.pathname)) throw new GtmError('ACCOUNT_URL_MISMATCH', 'Post URL must match the exact selected account');
        }
      }
    }
    const value = { ...d, id, label: dataset === 'SYNTHETIC' ? 'SYNTHETIC' as const : 'OWNER_ATTESTED' as const,
      sequence: history.length + 1, state: next, provenance: 'OWNER_SUPPLIED_ATTESTATION_NOT_PLATFORM_VERIFICATION',
      platformVerified: false, executable: false, externalWrites: 0 };
    store.put('publication', value); return { ...c, ...value, duplicate: false };
  });
}

