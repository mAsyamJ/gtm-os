import { GtmError, hashObject } from '../../observability/src/index.js';
import { saveResearchOutput } from '../../research/src/index.js';
import { distributionStatus } from '../../distribution/src/index.js';
import { OperationsStore } from '../../operations/src/store.js';
import { operationsContext, readonlyOperations } from '../../operations/src/common.js';
import { analyticsReport, DESTINATIONS } from './analytics.js';

export function weeklyRecap(root: string, selected: unknown, options: { synthetic: unknown; period?: string }, now = new Date()) {
  const context = operationsContext(root, selected, options.synthetic); const analytics = analyticsReport(root, context.tenant, options, now);
  const distribution = distributionStatus(root, context.tenant);
  const document = { ...context, kind: 'weekly-recap', window: analytics.window, analytics,
    verifiedShipping: 'NO_VERIFIED_PRODUCT_OR_PERSONAL_SHIPPING_FACTS', actualAudienceResults: 'NO_DATA',
    contentWinner: 'NO_REAL_WINNER_SYNTHETIC_COUNTS_ONLY', competitorMovements: 'NO_VERIFIED_CURRENT_RESEARCH',
    distribution: { simulations: distribution.simulations, simulatedAcceptances: distribution.simulatedAcceptances, actualPublished: 0 },
    spend: { projectProviderActualUsd: 0, syntheticEstimatedUsd: 0, operatorComputeCost: 'NOT_MEASURED' },
    topThreeDecisions: [
      { decision: 'Confirm the proposed event definitions and consent scope before real instrumentation', evidence: 'Current input is a synthetic fixture, not a live baseline', owner: 'owner' },
      { decision: 'Review topic-specific proof and current landing UI before selecting content or CRO work', evidence: 'Product behavior/personal history and UI are unverified in this slice', owner: 'owner' },
      { decision: 'Keep live distribution blocked until principal, exact payload/media, current total cost and owner approval are established', evidence: distribution.live.blockers, owner: 'owner' }],
    proposedExperiments: [
      { hypothesis: 'A source-linked explanation may improve comprehension', baseline: 'REAL_BASELINE_REQUIRED', guardrail: 'No unsupported claims or private feedback attribution' },
      { hypothesis: 'A clearer next-step description may reduce confusion', baseline: 'REAL_UI_AND_BASELINE_REQUIRED', guardrail: 'No live site edits/deployment without separate scope' }],
    nextStep: 'Owner selects next bets; this local recap schedules and publishes nothing' };
  return saveResearchOutput(root, context.tenant, 'weekly-recap', document);
}

export function croProposal(root: string, selected: unknown, options: { synthetic: unknown; period?: string }, now = new Date()) {
  const context = operationsContext(root, selected, options.synthetic); const baseline = analyticsReport(root, context.tenant, options, now);
  const core = { tenant: context.tenant, label: 'SYNTHETIC' as const, kind: 'cro-experiment-proposal',
    targetCandidate: DESTINATIONS[context.tenant], targetVerified: false, uiCapture: 'NOT_PERFORMED_UNVERIFIED_SCOPE',
    hypothesis: context.tenant === 'retropick' ? 'Explaining the evidence and limitations before a next step may reduce product-flow confusion' :
      'An inspectable technical example and a clear discussion prompt may help a peer understand the intended next step',
    baseline: { label: 'SYNTHETIC', sourceDataSha256: baseline.dataSha256, window: baseline.window, metricDefinitionSha256: hashObject(baseline.dictionary), entrySubjects: baseline.funnel.entrySubjects,
      terminalSubjects: baseline.funnel.terminalSubjects, conversionRate: baseline.funnel.conversionRate, usableAsRealBaseline: false },
    primaryMetric: { numerator: 'Unique subjects completing every proposed ordered stage', denominator: 'Unique subjects entering the first stage during the defined window',
      eventDefinition: baseline.funnel.stages.map(s => s.name), source: 'REAL_INSTRUMENTATION_NOT_CONNECTED' },
    guardrails: ['No unsupported capability/financial/personal claims', 'No private identifiers or non-consented collection', 'No merge/deploy or production repository changes',
      'No causal lift or winner claim from synthetic counts'],
    acceptanceBeforeImplementation: ['Owner-approved actual UI/source scope', 'Authorized real baseline and consent/privacy review',
      'Predeclared experiment design, sample-size rationale, success and stop criteria', 'Separate owner scope for any production branch/PR/merge/deploy'],
    proposedLocalWork: ['Map verified UI steps to the proposed funnel', 'Review comprehension and accessibility', 'Prepare an owner-reviewable change proposal after evidence exists'],
    status: 'PROPOSED_BLOCKED_REAL_UI_AND_BASELINE', approvalStatus: 'NOT_APPROVED', deployed: false };
  const experiment = { id: `${context.tenant}-cro-${hashObject(core).slice(0, 20)}`, ...core };
  using store = new OperationsStore(root, context.tenant); store.put('experiment', experiment);
  return saveResearchOutput(root, context.tenant, 'cro-proposal', { ...context, ...experiment, validation: { productionRepoModified: false, realBaselineAvailable: false },
    limitations: [...context.limitations, 'This is a proposal, not an audited real landing page or a measured experiment result.'] });
}

export function experimentsList(root: string, selected: unknown, synthetic: unknown) {
  const context = operationsContext(root, selected, synthetic); using store = readonlyOperations(root, context.tenant);
  const experiments = store?.list('experiment') ?? [];
  if (experiments.some(e => e.tenant !== context.tenant)) throw new GtmError('TENANT_MISMATCH', 'Experiment scope mismatch');
  return { ...context, experiments, actualRunningExperiments: 0 };
}
