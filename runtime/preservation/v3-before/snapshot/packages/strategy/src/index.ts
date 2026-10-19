import { z } from 'zod';
import { GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { IdSchema, TenantSchema, type Tenant } from '../../schemas/src/index.js';
import { loadBrand, loadPolicy, parseWith, readText } from '../../core/src/workspace.js';
import { auditReferences, screenUntrusted, sourceCards } from '../../research/src/index.js';

type Slot = readonly [string, string, string, string]; // title, format, proof needed, editorial task
interface Program {
  audience: string; problem: string; positioning: string; voice: string; series: string[];
  pillars: string[]; exclusions: string[]; activation: string; cta: string;
  weeks: readonly (readonly [string, string, readonly string[]])[]; slots: readonly Slot[];
}
const PROGRAMS: Record<Tenant, Program> = {
  retropick: {
    audience: 'Hypothesis: eligible crypto-native builders and curious users evaluating onchain market tools',
    problem: 'Hypothesis: readers need to distinguish observable product behavior from promotional assertions',
    positioning: 'Hypothesis: earn consideration through inspectable product education and explicit limitations',
    voice: 'Clear, technically fluent, evidence-first; explain mechanisms and risks; no financial upside or urgency',
    series: ['Verify the flow', 'Mechanism notes'],
    pillars: ['Verified product walkthroughs', 'Market mechanics and risk', 'Builder questions and documentation'],
    exclusions: ['People seeking guaranteed returns', 'Users whose eligibility is unconfirmed', 'Any segment requiring unsupported live-feature claims'],
    activation: 'Proposed activation: a reviewer can reproduce a documented public flow and name its constraints; measurement not connected',
    cta: 'Review the cited evidence and identify the step that needs clarification.',
    weeks: [
      ['Evidence foundation', 'A source-backed positioning draft with unresolved claims listed', [
        'Inventory public product and repository source candidates without assuming they are current.',
        'Pin an authorized repository revision and list which files actually support each candidate feature.',
        'Request owner confirmation of eligibility and prohibited financial messaging.',
        'Map one public UI flow to the pinned documentation; record differences as unresolved.',
        'Write a provisional audience/problem statement and three explicit disqualifiers.',
        'Draft a source/claim matrix with expiry and a separate unsupported-claims list.',
        'Review the evidence matrix; stop any topic whose proof is missing.']],
      ['Useful explanations', 'A reviewed walkthrough outline and risk explanation', [
        'Outline one product flow using only demonstrated steps and current evidence.',
        'Prepare a market-mechanics explanation; request authoritative risk references.',
        'Draft a short builder FAQ from documented questions; label analyst questions as hypotheses.',
        'Prepare a thread spine with one mechanism, one limitation and one next action.',
        'Review terminology against product sources; remove implied launch or trade promises.',
        'Reserve a local revision slot for newly verified changes; do not invent a release.',
        'Run editorial, claim and accessibility review; leave publication awaiting owner review.']],
      ['Discovery and iteration', 'A consent-aware interview guide and revised provisional positioning', [
        'Draft an opted-in discovery interview guide about evidence needed before trying a tool.',
        'Prepare an unsent invitation for owner review; no outreach or contact collection.',
        'Define a walkthrough-comprehension checklist and privacy-minimal feedback form proposal.',
        'Analyze owner-supplied, consented notes if available; otherwise record NO_DATA.',
        'Revise one explanation against actual confusion only when notes support it.',
        'Prepare a documentation improvement proposal with source links and no production edits.',
        'Review audience assumptions; retain or reject them using observed evidence only.']],
      ['Owner decision package', 'A source-current draft package and a measured-or-NO_DATA review', [
        'Recheck source expiry and public UI/documentation alignment before reuse.',
        'Compare two alternative educational hooks as hypotheses; do not report a winner.',
        'Prepare a traceable walkthrough brief with source citations and capture requirements.',
        'Review risk language, eligibility caveats and exact account routing.',
        'Prepare a future measurement proposal for documented-flow comprehension.',
        'Collect owner review comments and revise locally; no assumed approval.',
        'Assemble a review package with evidence, drafts, limitations and immutable hashes.']],
      ['Next-cycle decision', 'A defensible continue/change/stop decision', [
        'Report observed evidence and NO_DATA separately; no inferred traffic or conversion lift.',
        'Choose next-cycle topics only after owner review of evidence gaps and capacity.']],
    ],
    slots: [
      ['What would verify a launchpad claim?', 'single-post', 'Current public documentation and owner-approved capability statement', 'Build a claim-to-source checklist; avoid asserting a live feature.'],
      ['Verify the flow: entry and eligibility', 'walkthrough-brief', 'Authorized current UI capture and eligibility documentation', 'Outline observable entry steps; mark every unverified interaction.'],
      ['Mechanism notes: separate mechanics from outcomes', 'thread-outline', 'Authoritative mechanism and risk references', 'Plan hook, mechanism, limitations and evidence checklist; no return projections.'],
      ['Builder questions before trying a flow', 'question-draft', 'Owner-reviewed discovery questions; consented responses if later quoted', 'Draft useful open questions without inventing customer quotes.'],
      ['What a source-linked feature note needs', 'release-brief', 'Pinned release/code and independently verified current UI behavior', 'Prepare a proof checklist; no announcement until a release is verified.'],
      ['Evidence refresh slot', 'reserved', 'New authorized source or explicit NO_DATA', 'Replace only with a verified change; otherwise retain an empty editorial slot.'],
      ['Week-one evidence review', 'internal-review', 'Current source cards, expiry report and claims audit', 'Remove unsupported statements and report remaining research gaps.'],
      ['Verify the flow: failure paths', 'walkthrough-brief', 'Reproducible public failure-state capture and documented constraints', 'Outline error states and what a reader can safely conclude.'],
      ['Mechanism notes: risk questions', 'thread-outline', 'Authoritative risk disclosures and current mechanism references', 'Explain which risk questions need answers; do not imply safety or eligibility.'],
      ['A builder FAQ with receipts', 'faq-brief', 'Documentation passages; consented questions for any attributed voice', 'Distinguish documented answers from research questions.'],
      ['One improvement to the documentation', 'proposal', 'A concrete mismatch between current documentation and a verified flow', 'Draft a local documentation proposal; no production change.'],
      ['How to check whether an explanation helped', 'measurement-proposal', 'Owner-approved future research design; no analytics assumed', 'Define comprehension criteria and a stop rule without claiming results.'],
      ['Evidence refresh slot', 'reserved', 'Fresh authorized source or NO_DATA', 'Keep room for an actual verified update.'],
      ['Two-week editorial decision', 'internal-review', 'Source/claim matrix and owner feedback if available', 'Prepare continue/revise/stop recommendations with explicit unknowns.'],
    ],
  },
  founder: {
    audience: 'Hypothesis: technical founders, backend/Web3 engineers and AI tooling builders who value inspectable engineering decisions',
    problem: 'Hypothesis: readers want concrete decision processes and reproducible examples instead of unsupported authority claims',
    positioning: 'Hypothesis: build technical trust through inspectable reasoning and owner-confirmed proof of work',
    voice: 'First-person, specific, independent, reflective and technical; use intent or questions until personal experience is owner-confirmed',
    series: ['Decision notebook', 'Proof before claims'],
    pillars: ['Architecture tradeoffs', 'Security and reliable systems', 'Open-source learning and proof of work'],
    exclusions: ['Readers seeking unverified credentials as proof', 'Topics requiring invented personal experience', 'Partnership pitches before a specific consented context'],
    activation: 'Proposed activation: a peer can inspect an example and explain the tradeoff; measurement not connected',
    cta: 'Which tradeoff should I make explicit in the example?',
    weeks: [
      ['Proof and boundaries', 'An owner-reviewed expertise map with evidence gaps', [
        'Inventory owner-provided public work candidates; do not infer authorship from a username.',
        'Request owner confirmation of authorship, role and permitted project examples.',
        'Pin one authorized example revision and record what it demonstrates precisely.',
        'Choose a narrow technical audience and list three topics that need more proof.',
        'Outline an architecture decision with alternatives, constraints and uncertainty.',
        'Draft an explicit personal-history checklist; remove unconfirmed anecdotes.',
        'Review proof-of-work links and provisional voice with the owner.']],
      ['Teach one decision well', 'A technical outline grounded in an inspectable example', [
        'Explain one architecture tradeoff using an authorized example or label it illustrative.',
        'Prepare a reliability checklist without claiming production scale or benchmark wins.',
        'Draft a thread spine: question, alternatives, evidence, constraint, next experiment.',
        'Read a pinned upstream implementation and separate attribution from personal contribution.',
        'Prepare a security-review question and document its threat model.',
        'Reserve time for evidence updates; do not invent a shipping milestone.',
        'Review technical accuracy, attribution and first-person statements locally.']],
      ['Peer learning', 'An inspectable experiment proposal and consent-aware feedback guide', [
        'Define a small reproducible experiment and a falsifiable decision criterion.',
        'Write the experiment procedure and expected failure conditions before running it.',
        'Run only authorized local work; otherwise record execution as pending.',
        'Record measured results with method and limitations only if actually observed.',
        'Prepare an unsent question for an opted-in peer; no unsolicited messaging.',
        'Revise the explanation from consented feedback if present; otherwise record NO_DATA.',
        'Review which insights belong to the founder and which are upstream attribution.']],
      ['Reviewable technical body of work', 'A source-current draft package with no invented authority', [
        'Recheck example revisions, source expiry, author attribution and asset licenses.',
        'Prepare a decision-note draft with an explicit alternative and why it remains plausible.',
        'Draft a reliability explainer with a failure mode and reproducible check.',
        'Audit biography, credentials, impact numbers and all first-person achievement language.',
        'Prepare a future peer-feedback measurement plan with a minimal data scope.',
        'Collect owner edits locally; exact publication approval remains separate.',
        'Assemble an owner-review package with source links, caveats and immutable hashes.']],
      ['Next-cycle decision', 'A credible learning agenda based on observed evidence', [
        'Report what was demonstrated, what was merely proposed and what remains unmeasured.',
        'Choose the next example with the owner; retain only supported personal claims.']],
    ],
    slots: [
      ['I want my technical claims to be inspectable', 'single-post', 'Owner confirmation of this intended editorial stance', 'Draft a first-person intention; avoid past achievements.'],
      ['Decision notebook: what I would compare first', 'decision-note', 'An authorized pinned example or explicit illustrative setup', 'Outline alternatives and constraints; frame unsupported experience as a question.'],
      ['A reliability question I want to test', 'thread-outline', 'Reproducible example and explicit test method', 'Build a question-to-experiment spine; no benchmark claims.'],
      ['What I need before calling a system secure', 'checklist', 'Authoritative security reference and a scoped threat model', 'Draft an engineering standard as an opinion, with limitations.'],
      ['Reading upstream code without claiming authorship', 'learning-note', 'Pinned upstream revision, license and attribution', 'Prepare a source-linked reading note; distinguish upstream work from mine.'],
      ['Evidence and owner-context slot', 'reserved', 'Owner-confirmed example or NO_DATA', 'Hold the slot if personal context is not yet confirmed.'],
      ['My draft review checklist', 'internal-review', 'Current evidence cards and owner-confirmed personal statements', 'Review biography, attribution and unresolved claims.'],
      ['Decision notebook: the alternative still matters', 'decision-note', 'A concrete authorized example with alternatives', 'Plan a narrow tradeoff explanation without universal advice.'],
      ['How I would make an experiment reproducible', 'thread-outline', 'Runnable method and an explicit illustrative label until executed', 'Outline setup, comparison, failure criterion and limitations.'],
      ['A failure mode worth explaining', 'technical-brief', 'Verified example behavior or clearly hypothetical failure setup', 'Separate observed behavior from a proposed failure test.'],
      ['A question I would ask a technical peer', 'question-draft', 'Owner-reviewed question; consented notes for any later attribution', 'Prepare an unsent discussion prompt without implied endorsements.'],
      ['Proof before claims: method before a number', 'measurement-proposal', 'A documented measurement method; no result assumed', 'Draft the method and boundaries before any performance claim.'],
      ['Evidence and owner-context slot', 'reserved', 'Fresh authorized evidence or NO_DATA', 'Leave room for a real owner-confirmed learning.'],
      ['What I can support in the next draft', 'internal-review', 'Current evidence, source expiry and owner edits if available', 'List supported material separately from the learning agenda.'],
    ],
  },
};

function context(root: string, selected: unknown, now: Date, sourceId?: string) {
  const tenant = parseWith(TenantSchema, selected, 'tenant'); loadPolicy(root); const brand = loadBrand(root, tenant);
  if (sourceId) parseWith(IdSchema, sourceId, 'source ID');
  const all = sourceCards(root, tenant, now);
  const cards = sourceId ? all.filter(c => c.source.id === sourceId) : all.filter(c => c.validity === 'CURRENT');
  if (!cards.length) throw new GtmError('EVIDENCE_REQUIRED', 'Ingest a current tenant source card before generating a plan or brief', 4);
  if (cards.some(c => c.validity !== 'CURRENT')) throw new GtmError('SOURCE_EXPIRED', 'Selected source is expired or future-dated');
  const manifest = auditReferences(root);
  const paths = ['AGENTS.md', 'brands/AGENTS.md', 'campaigns/WORKFLOWS.md', ...['AGENTS.md', 'VOICE.md', 'DESIGN.md', 'POSITIONING.md', 'MESSAGING.md', 'profile.json', 'claims-ledger.yaml'].map(n => `brands/${tenant}/${n}`),
    'config/defaults.yaml', 'config/feature-flags.yaml', '.agents/vendor/manifest.lock.yaml',
    '.agents/skills/campaign-architecture/SKILL.md', '.agents/skills/claim-verification/SKILL.md'];
  const inputs = paths.map(path => ({ path, sha256: sha256(readText(root, path)) }));
  return { tenant, program: PROGRAMS[tenant], brand, common: {
    tenant, revision: 'phase-c-r1', evaluatedAt: now.toISOString(), audience: PROGRAMS[tenant].audience,
    label: 'EVIDENCE_AWARE_HYPOTHESIS_PLAN', approvalStatus: 'NOT_APPROVED', publicationAuthorized: false,
    assetSource: 'TEXT_ONLY_NO_EXTERNAL_MEDIA', assetLicense: 'PROJECT_LOCAL_REVIEW_ONLY',
    inputs, inputSha256: hashObject(inputs),
    evidenceRefs: cards.map(({ source, card }) => ({ sourceId: source.id, uri: source.uri, revision: source.revision,
      contentSha256: source.contentSha256, observedAt: source.observedAt, expiresAt: source.expiresAt,
      verification: card.verification, scope: card.evidenceScope, license: source.license })),
    methodologyRefs: manifest.installed_and_verified.map(r => ({ id: r.id, commit: r.commit, sha256: r.sha256, license: r.license })),
    factualClaims: [], ledgerClaimsNotPromoted: brand.claims.claims.map(c => c.claim_id),
    validation: { tenantSeparated: true, currentSourcesOnly: true, referencesAndLicensesHashed: true,
      publicFactVerification: 'NOT_ESTABLISHED', sourceInstructionsExecuted: false },
    costs: { providerCalls: 0, actualUsd: 0, operatorCompute: 'NOT_MEASURED' },
    limitations: ['Audience, positioning, cadence and success criteria are analyst hypotheses, not observed demand or results.',
      'Governance sources support editorial constraints only; external supplied text remains unverified.',
      'No product capability, personal achievement, interview quote, analytics or platform algorithm claim is asserted.',
      'Every future draft requires source refresh, factual review and separate owner approval before publication.'],
    missingEvidence: tenant === 'retropick' ? ['Current product code/UI verification', 'Owner-confirmed eligibility and risk disclosures', 'Consented discovery or authorized analytics'] :
      ['Owner-confirmed biography and authorship', 'Authorized pinned technical examples', 'Consented peer feedback or actual measured experiments'],
    expiredExcluded: all.filter(c => c.validity !== 'CURRENT').map(c => c.source.id),
  } };
}

function startDate(start: string | undefined, now: Date): string {
  const date = start ?? now.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < now.toISOString().slice(0, 10))
    throw new GtmError('PLAN_DATE', 'Plan start must be a real YYYY-MM-DD on or after today', 2);
  return date;
}
function dayAt(start: string, index: number) { return new Date(Date.parse(start) + index * 86400_000).toISOString().slice(0, 10); }
function refreshFor(refs: { sourceId: string; expiresAt: string }[], date: string) {
  return refs.filter(r => Date.parse(r.expiresAt) <= Date.parse(`${date}T23:59:59.999Z`)).map(r => r.sourceId);
}

export function strategyPlan(root: string, selected: unknown, options: { days?: number; start?: string } = {}, now = new Date()) {
  if (options.days !== undefined && options.days !== 30) throw new GtmError('PLAN_DAYS', 'Phase C strategy is exactly 30 days', 2);
  const { common, program } = context(root, selected, now); const start = startDate(options.start, now);
  let index = 0;
  const phases = program.weeks.map(([name, deliverable, actions]) => ({ name, deliverable,
    days: actions.map(action => {
      const day = ++index, date = dayAt(start, day - 1);
      return { day, date, action, owner: 'campaign-architect', reviewer: 'owner', evidenceSourceIds: common.evidenceRefs.map(r => r.sourceId),
        refreshBeforeUse: refreshFor(common.evidenceRefs, date), status: 'PROPOSED_LOCAL_WORK',
        completionEvidence: 'A source-linked local artifact or explicit BLOCKED/NO_DATA receipt; never an assumed publication' };
    }) }));
  return { ...common, kind: 'strategy', days: 30, start, positioning: program.positioning, problem: program.problem,
    voice: program.voice, pillars: program.pillars, disqualifiers: program.exclusions,
    channels: [{ channel: 'X', mode: 'LOCAL_DRAFTS_ONLY', rationale: 'Owner-specified account; audience fit is a hypothesis',
      paidBudgetUsd: 0, timing: 'UNMEASURED_NO_BEST_TIME_CLAIM' }],
    activation: program.activation,
    measures: [{ name: 'Evidence coverage', definition: 'Supported reviewable statements / all proposed factual statements; undefined when denominator is zero', owner: 'claim-verifier', baseline: 'NO_DATA', target: 'All retained factual statements trace to current reviewed evidence' },
      { name: 'Reader comprehension', definition: 'Consented reviewers who can explain the documented decision or flow / consented completed reviews', owner: 'customer-researcher', baseline: 'NO_DATA', target: 'Set after owner-approved research; no numerical lift assumed' }],
    stopRules: ['Stop a topic if its source expires or proof is missing', 'Stop first-person experience language without owner confirmation',
      'No public action until exact account, content, cost and owner approval gates exist'],
    capacity: 'Hypothesis: one operator prepares a small local draft batch and reviews weekly; owner must confirm available time', phases };
}

export function contentCalendar(root: string, selected: unknown, options: { days?: number; start?: string } = {}, now = new Date()) {
  if (options.days !== undefined && options.days !== 14) throw new GtmError('CALENDAR_DAYS', 'Phase C calendar is exactly 14 days', 2);
  const { common, program } = context(root, selected, now); const start = startDate(options.start, now);
  return { ...common, kind: 'calendar', days: 14, start, series: program.series, voice: program.voice,
    cadence: 'Proposed editorial slots include research and internal review; these are not fourteen scheduled public posts',
    timezone: 'UTC dates only; publication windows unmeasured',
    operatingRhythm: 'Prepare a small batch, verify evidence daily, review weekly with the owner; leave two research slots open',
    entries: program.slots.map(([title, format, proofNeeded, task], index) => {
      const date = dayAt(start, index);
      return { id: `${common.tenant}-day-${index + 1}`, day: index + 1, date, title, format, task,
        pillar: program.pillars[index % program.pillars.length], audience: program.audience, channel: 'X_DRAFT_OR_INTERNAL',
        voice: program.voice, proofNeeded, evidenceSourceIds: common.evidenceRefs.map(r => r.sourceId),
        evidenceUse: 'Editorial constraints only; topic-specific proof is pending', refreshBeforeUse: refreshFor(common.evidenceRefs, date),
        cta: program.cta, metric: 'Evidence coverage at editorial review; audience results NO_DATA',
        dependencies: ['Current topic-specific evidence', 'Claim verification', 'Brand editor review', 'Exact owner approval for any future external action'],
        owner: 'social-editor', reviewer: 'claim-verifier', status: 'PROPOSED_REQUIRES_PROOF', scheduled: false };
    }) };
}

export function contentBrief(root: string, selected: unknown, topic: string, sourceId?: string, now = new Date()) {
  parseWith(z.string().trim().min(1).max(240), topic, 'brief topic'); screenUntrusted(topic);
  const { common, program } = context(root, selected, now, sourceId);
  return { ...common, kind: 'brief', topic, topicStatus: 'USER_PROPOSED_UNVERIFIED', problem: program.problem,
    voice: program.voice, differentiatedAngle: 'Show the evidence and its boundary before asking the reader to accept a conclusion',
    proof: { usablePublicFacts: [], required: common.missingEvidence, evidenceUse: 'Governance constraints only; factual topic proof pending' },
    outline: ['One clearly scoped question or intention', 'The specific example and its source, once verified',
      'The mechanism or tradeoff, with uncertainty visible', 'A limitation or failure mode', 'One relevant next action'],
    hookDirection: common.tenant === 'founder' ? 'Use a first-person intention or technical question; never invent a retrospective achievement' :
      'Use a clear mechanism question; never imply financial upside, verified safety or fake urgency',
    cta: program.cta, risk: 'Unsupported feature, financial, achievement or numerical statements remain blocked',
    successMeasure: 'A reviewer can locate every factual assertion in current topic-specific evidence; audience impact remains NO_DATA',
    draftStatus: 'BLOCKED_PENDING_TOPIC_PROOF', nextOwnerAction: 'Supply or confirm topic-specific evidence and review the brief; publication requires separate exact-action approval' };
}

export function icpHypothesis(root: string, selected: unknown, now = new Date()) {
  const { common, program } = context(root, selected, now);
  return { ...common, kind: 'icp', status: 'HYPOTHESIS_REQUIRES_DISCOVERY', problem: program.problem,
    positioning: program.positioning, disqualifiers: program.exclusions,
    discoveryQuestions: ['What concrete task brings this reader to the topic?', 'What evidence would make the explanation credible?',
      'What would rule out the proposed solution or audience fit?', 'What did an opted-in reader actually say, if anything?'],
    nextStep: 'Validate with owner-approved, consented discovery; no outreach sent or customer wins assumed' };
}
