import { z } from 'zod';
import { readText } from '../../core/src/workspace.js';
import { GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { HashSchema, IdSchema, TenantSchema } from '../../schemas/src/index.js';
import { selectedBrief } from './intelligence/research.js';
import { context, open, records, type Dataset } from './common.js';
import { usable } from './evidence.js';

const Claim = z.strictObject({ statement: z.string(), evidenceId: IdSchema, evidenceSha256: HashSchema });
export const Draft = z.object({ id: IdSchema, tenant: TenantSchema, label: z.enum(['SYNTHETIC', 'REVIEWED_SOURCE', 'OWNER_ATTESTED']),
  format: z.enum(['post', 'thread']), sourceIds: z.array(IdSchema).nonempty(), claims: z.array(Claim).nonempty(),
  blocks: z.array(z.string()).nonempty(), protectedSegments: z.array(z.string()).nonempty(),
  humanReview: z.literal('PENDING'), publicationAuthorized: z.literal(false), authoringMode: z.enum(['DETERMINISTIC_SOURCE_ASSEMBLY','ROUTED_CLAIM_SELECTION']),
  governance: z.array(z.object({ path: z.string(), sha256: HashSchema })), sourceRevision: z.string(), authenticity: z.string() }).passthrough();
export type Draft = z.infer<typeof Draft>;
export function draftById(root: string, tenant: z.infer<typeof TenantSchema>, id: string, dataset: Dataset = 'OBSERVED', at = new Date()) {
  const raw = records(root, tenant, 'content', dataset).find(d => d.id === id);
  if (!raw) throw new GtmError('DRAFT_MISSING', 'Draft is absent in selected tenant', 4);
  const draft = Draft.parse(raw); const sources = usable(root, tenant, dataset, undefined, at);
  if(typeof draft.briefId==='string'){
    const brief=selectedBrief(root,tenant,draft.briefId,dataset,at);
    if(hashObject(brief)!==draft.briefSha256)throw new GtmError('INPUT_CHANGED','Draft brief revision differs',4);
  }
  for (const claim of draft.claims) if (!sources.some(s => s.source.id === claim.evidenceId && hashObject(s.source) === claim.evidenceSha256 && s.claims.includes(claim.statement)))
    throw new GtmError('EVIDENCE_GAP', 'Draft source expired, changed or lacks the required review', 4);
  if (draft.governance.some(g => sha256(readText(root, g.path)) !== g.sha256)) throw new GtmError('INPUT_CHANGED', 'Draft governance changed; create a new revision');
  return draft;
}
export function draftContent(root: string, selected: unknown, format: unknown, sourceId: string, dataset: Dataset = 'OBSERVED', variant = 0) {
  const c = context(root, selected, dataset); const mode = z.enum(['post', 'thread']).parse(format);
  const sources = usable(root, c.tenant, dataset, sourceId);
  if (!sources.length) throw new GtmError('EVIDENCE_GAP', 'A current reviewed source is required for drafting', 4);
  const source = sources[0]!; const claims = source.claims.map(statement => ({ statement, evidenceId: source.source.id, evidenceSha256: hashObject(source.source) }));
  if (claims.some(v => /\b(?:guaranteed profits?|risk.free|\d+%\s*(?:return|apr)|get rich)\b/i.test(v.statement)))
    throw new GtmError('UNVERIFIED_FINANCIAL_CLAIM', 'Unsupported financial promotions cannot be assembled', 3);
  const personal = claims.some(v => /\b(?:I|my|we|our)\b/.test(v.statement));
  if (personal && source.review.authenticFirstPerson !== true) throw new GtmError('AUTHENTICITY_GAP', 'First-person experience requires explicit owner attestation', 4);
  const hooks = c.tenant === 'founder' ? ['Start with an inspectable constraint.', 'Keep the evidence close to the decision.', 'Make the failure condition explicit.', 'A technical explanation needs a reproducible check.', 'State the limit of the example.'] :
    ['Read the current evidence before exploring the mechanism.', 'Separate the mechanism from its trading outcome.', 'Check the scope before interpreting a demo.', 'Keep the test environment visible.', 'A useful product explanation names its limits.'];
  const risk = c.tenant === 'retropick' ? 'Scope follows the cited source. No investment advice or assurance of trading outcomes.' : 'Source-supported engineering note. Personal experience is included only when owner-attested.';
  const governance = ['VOICE.md', 'DESIGN.md', 'claims-ledger.yaml'].map(name => ({ path: `brands/${c.tenant}/${name}`, sha256: sha256(readText(root, `brands/${c.tenant}/${name}`)) }));
  const selectedClaims = mode === 'post' ? [claims[variant % claims.length]!] : claims;
  const blocks = [hooks[variant % hooks.length]!, ...selectedClaims.map(x => x.statement), risk];
  const base = { tenant: c.tenant, label: dataset === 'SYNTHETIC' ? 'SYNTHETIC' as const : source.review.label as 'REVIEWED_SOURCE' | 'OWNER_ATTESTED',
    format: mode, sourceIds: [source.source.id], claims: selectedClaims, blocks, protectedSegments: [...selectedClaims.map(x => x.statement), risk],
    humanReview: 'PENDING' as const, publicationAuthorized: false as const, authoringMode: 'DETERMINISTIC_SOURCE_ASSEMBLY' as const,
    governance, sourceRevision: source.source.revision,
    citations: [{ uri: source.source.uri, revision: source.source.revision, license: source.source.license, sourceId: source.source.id }],
    authenticity: personal ? 'OWNER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED' : 'NO_PERSONAL_ACHIEVEMENT_ASSERTED' };
  const value = Draft.parse({ id: `${c.tenant}-draft-${hashObject(base).slice(0, 24)}`, ...base });
  using store = open(root, c.tenant, dataset); store.put('content', value); return value;
}
export function integrity(original: Draft, revisedBlocks: string[]) {
  const same = original.protectedSegments.every(s => revisedBlocks.filter(b => b === s).length === original.blocks.filter(b => b === s).length);
  const transforms = (s: string) => s.replace(/^Let's dive into\s+/i, '').replace(/\bin order to\b/g, 'to').replace(/\butilize\b/g, 'use');
  const safe = revisedBlocks.length === original.blocks.length && revisedBlocks.every((s, i) => s === original.blocks[i] ||
    !original.protectedSegments.includes(original.blocks[i]!) && s === transforms(original.blocks[i]!));
  if (!same || !safe) throw new GtmError('EDITORIAL_INTEGRITY', 'Unsupported additions or changed protected text require a new source-backed draft');
  return { status: 'PASS', protectedClaimsUnchanged: true, unsupportedAdditions: 0, semanticReview: 'HUMAN_REQUIRED', authenticityReview: 'HUMAN_REQUIRED' };
}

export function draftBriefContent(root:string,selected:unknown,briefId:string,format:'post'|'thread',variant:number,dataset:Dataset='OBSERVED',indices?:number[]) {
  const c=context(root,selected,dataset),brief=selectedBrief(root,c.tenant,briefId,dataset);
  const sources=usable(root,c.tenant,dataset).filter(s=>brief.sourceIds.includes(s.source.id));
  let selectedClaims=indices?indices.map(i=>{const claim=brief.claims[i];if(!claim)throw new GtmError('EDITORIAL_INTEGRITY','Model selected a nonexistent claim');return claim;}):
    format==='post'?[brief.claims[variant%brief.claims.length]!]:[...brief.claims.slice(variant),...brief.claims.slice(0,variant)].slice(0,6);
  if(!selectedClaims.length)throw new GtmError('EVIDENCE_GAP','Draft requires claims',4);
  const hooks=c.tenant==='founder'?['What proves this transition actually completed?','Where should accounting end and execution begin?','Which failure can a retry safely recover from?','What would falsify this engineering claim?','What can a test receipt prove—and what remains unknown?']:
    ['What happens after a token launch?','How does price discovery differ from secondary trading?','What does graduation actually change?','Which liquidity risks still need attention?','What should a creator check before exploring a testnet?'];
  let risk=c.tenant==='founder'?'Engineering analysis of cited sources. Historical testnet receipts establish no personal achievement or production readiness.':
    'Unaudited Monad Testnet candidate. Historical functional tests are not organic demand or current market depth. No investment advice or assurance of trading outcomes.';
  const hook=hooks[variant%hooks.length]!;
  const cta=format==='post'?(c.tenant==='founder'?'Discuss the constraint.':'Inspect the cited scope.'):brief.cta;
  if(format==='post'){
    risk=c.tenant==='founder'?'Unaudited testnet evidence; no personal achievement inferred.':'Unaudited testnet; no assurance of trading outcomes.';
    if(!indices){const eligible=brief.claims.filter(claim=>[hook,claim.statement,risk,cta].join('\n\n').length<=280);if(!eligible.length)throw new GtmError('POST_LENGTH','No complete reviewed claim fits a standard post',4);selectedClaims=[eligible[variant%eligible.length]!];}
  }
  if(selectedClaims.some(claim=>/\b(?:I|my|we|our)\b/.test(claim.statement)&&!sources.find(s=>s.source.id===claim.evidenceId)?.review.authenticFirstPerson))throw new GtmError('AUTHENTICITY_GAP','Owner attestation required for autobiographical claims',4);
  if(selectedClaims.some(claim=>/\b(?:guaranteed profits?|risk.free|\d+%\s*(?:return|apr)|get rich)\b/i.test(claim.statement)))throw new GtmError('UNVERIFIED_FINANCIAL_CLAIM','Financial promotion denied',3);
  const blocks=[hook,...selectedClaims.map(x=>x.statement),risk,cta];
  if(format==='post'&&blocks.join('\n\n').length>280)throw new GtmError('POST_LENGTH','Selected claims require a thread; facts and risk disclosures are never truncated',4);
  const governance=['VOICE.md','DESIGN.md','claims-ledger.yaml'].map(name=>({path:`brands/${c.tenant}/${name}`,sha256:sha256(readText(root,`brands/${c.tenant}/${name}`))}));
  const base={tenant:c.tenant,label:dataset==='SYNTHETIC'?'SYNTHETIC':'REVIEWED_SOURCE',format,sourceIds:brief.sourceIds,claims:selectedClaims,blocks,
    protectedSegments:[...selectedClaims.map(x=>x.statement),risk],humanReview:'PENDING',publicationAuthorized:false,
    authoringMode:indices?'ROUTED_CLAIM_SELECTION':'DETERMINISTIC_SOURCE_ASSEMBLY',governance,sourceRevision:brief.sourceSetSha256,
    briefId:brief.id,topicId:brief.topicId,briefSha256:hashObject(brief),
    citations:sources.map(s=>({uri:s.source.uri,revision:s.source.revision,license:s.source.license,sourceId:s.source.id})),
    authenticity:'NO_PERSONAL_ACHIEVEMENT_ASSERTED',semanticReview:'HUMAN_REQUIRED',temporalScope:brief.temporalScope};
  const value=Draft.parse({id:`${c.tenant}-draft-${hashObject(base).slice(0,24)}`,...base});
  using store=open(root,c.tenant,dataset);store.put('content',value);return value;
}
export function humanize(root: string, selected: unknown, id: string, dataset: Dataset = 'OBSERVED') {
  const c = context(root, selected, dataset); const original = draftById(root, c.tenant, id, dataset);
  const blocks = original.blocks.map(s => original.protectedSegments.includes(s) ? s : s.replace(/^Let's dive into\s+/i, '').replace(/\bin order to\b/g, 'to').replace(/\butilize\b/g, 'use'));
  const check = integrity(original, blocks);
  const value = { ...original, id: `${c.tenant}-humanized-${hashObject({ original: original.id, blocks }).slice(0, 24)}`,
    blocks, parentDraftId: original.id, integrity: check, hostedModelRequests: 0,
    humanizerMode: 'CONSERVATIVE_LOCAL_RULES_WITH_PROTECTED_CLAIM_BLOCKS',
    editorialSkill: 'Audited installed Humanizer guidance; semantic and voice quality are not automatically established' };
  using store = open(root, c.tenant, dataset); store.put('content', value); return value;
}
