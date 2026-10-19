import { IdSchema } from '../../schemas/src/index.js';
import { GtmError, hashObject } from '../../observability/src/index.js';
import { context, open, records, artifact, type Dataset } from './common.js';
import { researchDigest, usable } from './evidence.js';
import { draftContent, humanize } from './editorial.js';
import { manualPack, publicationHistory } from './distribution.js';
import { scorecards } from './analytics.js';

export const WORKFLOWS = ['daily-market-intelligence', 'weekly-competitive-intelligence', 'founder-voice-calibration', 'retropick-positioning-refresh',
  'founder-tech-thread', 'retropick-feature-launch', 'build-in-public', 'educational-series', 'daily-social-editorial', 'weekly-content-batch',
  'community-listening', 'community-replies-assist', 'developer-relations', 'seo-answer-engine-audit', 'landing-page-cro', 'product-demo-studio',
  'viral-hooks-lab', 'partnership-brief', 'weekly-growth-retrospective', 'harness-feedback-loop'] as const;
export const STAGES = [
  ['research', 'market-researcher', 'research-intelligence'], ['strategy', 'gtm-strategy', 'icp-positioning'],
  ['content', 'content-copywriting', 'brand-voice'], ['humanization', 'content-copywriting', 'humanizer'],
  ['creative', 'graphic-diagram-design', 'graphic-design'], ['qa', 'quality-assurance', 'release-qa'],
  ['owner-approval', 'owner', 'social-publishing'], ['manual-distribution', 'owner', 'social-publishing'],
  ['measurement', 'data-analytics', 'analytics-attribution'], ['retrospective', 'growth-marketing', 'weekly-founder-brief'],
] as const;
export function workflowCatalog() {
  return WORKFLOWS.map((id, i) => ({ id, schemaVersion: 3, implementation: i < 6 || id === 'weekly-growth-retrospective' ? 'IMPLEMENTED_WITH_EVIDENCE_AND_OWNER_GATES' : 'STAGED_DEFINITION',
    tenantAllowlist: id.startsWith('founder-') ? ['founder'] : id.startsWith('retropick-') ? ['retropick'] : ['founder', 'retropick'],
    stages: STAGES.map(([stage, primarySpecialist, skill]) => ({ id: stage, primarySpecialist, supportingSkills: [skill],
      acceptance: 'Scoped evidence, immutable input/output hashes, stage-specific review', sideEffectClass: stage === 'manual-distribution' ? 'OWNER_MANUAL_ONLY' : 'LOCAL_ONLY' })),
    budget: { paidSocialUsd: 0, hostedModelsOffline: 0 }, recovery: 'Immutable checkpoint snapshots; changed inputs require a new run',
    approval: 'EXACT_ACCOUNT_CONTENT_MEDIA_EVIDENCE_HASH_OWNER_DECISION', evaluationFixture: `v3-${id}`, output: 'SOURCE_HASHED_LOCAL_ARTIFACT_OR_EXPLICIT_BLOCKER' }));
}
export async function runCycle(root: string, selected: unknown, key: string, dataset: Dataset, creative: (draftId: string) => Promise<unknown>) {
  const c = context(root, selected, dataset); IdSchema.parse(key);
  if (!key.startsWith(c.tenant + '-')) throw new GtmError('CYCLE_SCOPE', 'Cycle key must be tenant-prefixed', 2);
  const history = records(root, c.tenant, 'cycle', dataset).filter(r => r.cycleKey === key).sort((a,b) => Number(a.sequence)-Number(b.sequence));
  const latest = history.at(-1); const sources = usable(root, c.tenant, dataset);
  const sourceHash = hashObject(sources.map(s => ({ source: hashObject(s.source), review: hashObject(s.review) })));
  if (latest && latest.sourceHash !== sourceHash) throw new GtmError('INPUT_CHANGED', 'Cycle source/review changed; use a new cycle key');
  let draftId = typeof latest?.draftId === 'string' ? latest.draftId : '';
  let packetId = typeof latest?.packetId === 'string' ? latest.packetId : '';
  const handoffs = Array.isArray(latest?.handoffs) ? [...latest.handoffs] : [];
  const checkpoint = (state: string, blocker: string | null) => {
    const base = { ...c, cycleKey: key, label: dataset === 'SYNTHETIC' ? 'SYNTHETIC' : 'OWNER_ATTESTED',
      sequence: history.length + 1, sourceHash, state, blocker, draftId, packetId, handoffs,
      realCycleCompleted: dataset === 'OBSERVED' && state === 'RETROSPECTIVE_COMPLETED' };
    const value = { ...base, id: `${key}-v${history.length + 1}` };
    if (latest && hashObject({ ...latest, id: '', sequence: 0 }) === hashObject({ ...value, id: '', sequence: 0 })) return latest;
    using store = open(root, c.tenant, dataset); store.put('cycle', value); return value;
  };
  if (!sources.length) return checkpoint('BLOCKED', 'EVIDENCE_GAP');
  if (!packetId) {
    const source = sources[0]!;
    const research = researchDigest(root, c.tenant, dataset);
    const strategy = { audience: c.tenant === 'founder' ? 'Relevant builders evaluating inspectable technical work' : 'Eligible product explorers and creators reviewing the documented testnet scope',
      hypothesis: 'Useful source-backed explanation can encourage qualified exploration', proof: source.source.id,
      successMeasure: 'Traceable qualified observations; no growth claim before measurement', evidenceScope: source.review.classification };
    const draft = draftContent(root, c.tenant, 'thread', source.source.id, dataset); const edited = humanize(root, c.tenant, draft.id, dataset); draftId = edited.id;
    const rendered = await creative(draftId); const packet = manualPack(root, c.tenant, draftId, dataset); packetId = packet.id;
    const outputs = [research, strategy, draft, edited, rendered, { automatedIntegrity: edited.integrity, humanReview: 'PENDING' }];
    for (const [index, output] of outputs.entries()) {
      const stage = STAGES[index]!; const result = artifact(root, c.tenant, `stage-${stage[0]}`, output);
      handoffs.push({ schemaVersion: 1, tenant: c.tenant, campaignId: key, taskId: `${key}-${stage[0]}`, stage: stage[0],
        primarySpecialist: stage[1], supportingSkills: [stage[2]], sourceIds: [source.source.id],
        requiredCapabilities: [stage[0]], allowedTools: ['reviewed-local-functions'], sideEffectClass: 'LOCAL_ONLY',
        budget: { paidSocialUsd: 0, hostedModelRequests: 0 }, modelRoute: 'NOT_REQUIRED_OFFLINE', seed: 1,
        approvalState: 'HOLD', inputSha256: index ? (handoffs.at(-1) as { outputSha256: string }).outputSha256 : sourceHash,
        outputSha256: result.sha256, artifact: result.path, nextOwner: STAGES[index + 1]![1], status: 'COMPLETED_LOCAL_HUMAN_REVIEW_PENDING' });
    }
  }
  const events = publicationHistory(root, c.tenant, packetId, dataset);
  const lastEvent = events.at(-1);
  const published = lastEvent?.state === 'OWNER_REPORTED_PUBLISHED' ? lastEvent : undefined;
  if (!published) return checkpoint('AWAITING_APPROVAL', 'OWNER_APPROVAL_AND_MANUAL_PUBLICATION_REQUIRED');
  if (latest?.state === 'RETROSPECTIVE_COMPLETED') return latest;
  const metrics = records(root, c.tenant, 'metric', dataset).filter(m => m.packetId === packetId && m.value !== null);
  if (!metrics.length) return checkpoint('BLOCKED', 'MEASUREMENT_REQUIRED');
  const report = scorecards(root, c.tenant, dataset); artifact(root, c.tenant, 'weekly-report', report);
  handoffs.push({ stage: 'owner-approval', status: 'OWNER_ATTESTED', evidence: events.filter(e => e.event === 'APPROVE_MANUAL').map(e => e.id) },
    { stage: 'manual-distribution', status: 'OWNER_ATTESTED', evidence: published.id, platformVerified: false },
    { stage: 'measurement', status: dataset === 'SYNTHETIC' ? 'SYNTHETIC' : 'OWNER_ATTESTED', evidence: metrics.map(m => m.id) },
    { stage: 'retrospective', status: 'COMPLETED_LOCAL', reportSha256: hashObject(report), nextAction: 'Owner selects next hypothesis after reviewing source quality and missing observations' });
  return checkpoint('RETROSPECTIVE_COMPLETED', null);
}
export function executeResearchWorkflow(root: string, selected: unknown, id: string, dataset: Dataset = 'OBSERVED') {
  const c = context(root, selected, dataset); const definition = workflowCatalog().find(w => w.id === id);
  if (!definition || !definition.tenantAllowlist.includes(c.tenant)) throw new GtmError('WORKFLOW_SCOPE', 'Workflow unavailable for selected tenant', 2);
  if (definition.implementation === 'STAGED_DEFINITION') throw new GtmError('WORKFLOW_STAGED', 'Definition is staged; no completed workflow is claimed', 4);
  const digest = researchDigest(root, c.tenant, dataset); const sources = usable(root, c.tenant, dataset);
  const authentic = sources.some(s => s.review.authenticFirstPerson === true);
  const missing = !sources.length || id === 'founder-voice-calibration' && !authentic;
  const output = { ...c, workflowId: id, state: missing ? 'BLOCKED' : 'COMPLETED_LOCAL', blocker: missing ? 'EVIDENCE_GAP' : null,
    sources: digest, audience: c.tenant === 'founder' ? 'Relevant technical builders' : 'Eligible product explorers',
    output: id === 'weekly-competitive-intelligence' ? sources.map(s => ({ sourceId: s.source.id, documentedStatements: s.claims, competitorMetrics: 'UNAVAILABLE' })) :
      id === 'founder-voice-calibration' ? { authenticSamples: authentic, voice: 'Specific engineering constraints, evidence, limits and personal attribution only when attested', review: 'OWNER_REQUIRED' } :
      id === 'retropick-positioning-refresh' ? { messageHierarchy: sources.flatMap(s => s.claims), status: 'SOURCE_SUPPORTED_OWNER_REVIEW_REQUIRED', unsupportedMarketClaims: [] } : digest.themes,
    ownerApproval: 'HOLD', hostedModelRequests: 0, implementation: definition.implementation };
  return { ...output, receipt: artifact(root, c.tenant, 'workflow', output) };
}
