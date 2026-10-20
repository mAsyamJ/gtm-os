import { z } from 'zod';
import { spawnSync } from 'node:child_process';
import { safePath } from '../../core/src/workspace.js';
import { GtmError } from '../../observability/src/index.js';
import { HANDLES } from '../../schemas/src/index.js';
import { context, records, Dataset, artifact } from './common.js';
import { ingestEvidence, reviewEvidence, evidenceList, researchDigest } from './evidence.js';
import { draftContent, humanize } from './editorial.js';
import { manualPack, importDecision } from './distribution.js';
import { importMetrics, scorecards } from './analytics.js';
import { capabilitiesPlan, skillsAudit, dedupe, fetchPublic, voiceProfile } from './capabilities.js';
import { creativePack } from './creative.js';
import { executeResearchWorkflow, runCycle, workflowCatalog, WORKFLOWS } from './workflows.js';
import { researchReplay } from './replay.js';
import { routeIntelligence } from './intelligence/cli.js';
import { briefPack, campaign as intelligenceCampaign } from './intelligence/campaign.js';
import { createBrief } from './intelligence/research.js';
import { V4_WORKFLOWS, v4Catalog, executeV4Workflow } from './intelligence/workflows.js';
import { prepareDraft, illustrativeApproval, mockIdentity, simulateDispatch, reconcileDispatch, mediaFromReceipt } from '../../distribution/src/index.js';
import { seedAnalytics, ingestEventFile, analyticsReport, metricDictionary } from '../../growth/src/analytics.js';
import { croProposal, experimentsList } from '../../growth/src/reports.js';

export async function routeV3(root: string, words: string[], values: Record<string, unknown>): Promise<{ status: string; data: unknown } | undefined> {
  if(values.offline===true&&values['model-mode']==='router')throw new GtmError('OFFLINE_REQUIRED','Offline operations cannot call hosted models',3);
  const intelligence=await routeIntelligence(root,words,values);if(intelligence)return intelligence;
  const key = words.join(' '); const pair = words.slice(0, 2).join(' ');
  const str = (name: string, fallback?: string): string => {
    const value = values[name] ?? fallback;
    if (typeof value !== 'string' || !value) throw new GtmError('ARGUMENT_REQUIRED', `--${name} is required`, 2); return value;
  };
  const ds = () => Dataset.parse(values.synthetic === true || values.fixture === 'synthetic' ? 'SYNTHETIC' : values.dataset ?? 'OBSERVED');
  const tenant = () => {
    if (typeof values.brand !== 'string' || !values.brand) throw new GtmError('BRAND_REQUIRED', 'Explicit --brand founder|retropick is required', 2);
    return context(root, values.brand, ds()).tenant;
  };
  if(values['brief-id']&&values['topic-id']||values['source-card']&&(values['brief-id']||values['topic-id']))throw new GtmError('SELECTION_CONFLICT','Choose only one source-card, brief-id or topic-id',2);
  if(key==='content pack'&&(values['brief-id']||values['topic-id'])){
    const brand=tenant(),briefId=typeof values['brief-id']==='string'?values['brief-id']:createBrief(root,brand,str('topic-id'),ds()).id;
    return {status:'LOCAL_RESULT',data:await briefPack(root,brand,briefId,ds(),values['model-mode']??'offline',values['budget-id'])};
  }
  if(['cycle run','cycle resume'].includes(key)&&(values['brief-id']||values['topic-id'])){
    if(!values.offline&&values['model-mode']!=='router')throw new GtmError('OFFLINE_REQUIRED','Local cycles require --offline; routed execution requires explicit model mode',3);
    return {status:'LOCAL_RESULT',data:await intelligenceCampaign(root,tenant(),{key:str('idempotency-key'),dataset:ds(),
      ...(typeof values['brief-id']==='string'?{briefId:values['brief-id']}:{}),...(typeof values['topic-id']==='string'?{topicId:values['topic-id']}:{}),modelMode:values['model-mode']??'offline',budgetId:values['budget-id']})};
  }
  if(pair==='workflow run'&&V4_WORKFLOWS.includes(words[2] as typeof V4_WORKFLOWS[number]))return {status:'LOCAL_RESULT',data:await executeV4Workflow(root,tenant(),words[2]!,values,ds())};
  let data: unknown;
  if (key === 'verify') {
    if (!values.all || !values.offline) throw new GtmError('OFFLINE_REQUIRED', 'Acceptance requires --all --offline', 3);
    const result = spawnSync('/usr/bin/python3', [safePath(root, 'scripts/verify_v3.py')], {cwd:root,encoding:'utf8',timeout:310000,maxBuffer:2*1024*1024});
    if (result.error || result.status !== 0) throw new GtmError('ACCEPTANCE_FAILED', 'Local checks failed or prerequisites are missing; inspect the append-only acceptance log', 5);
    data = JSON.parse(result.stdout) as unknown;
    return {status:'ACCEPTANCE_RECORDED_WITH_BLOCKED_STAGES',data};
  }
  else if (['skills audit', 'capabilities audit'].includes(key)) data = skillsAudit(root);
  else if (key === 'skills dedupe') data = dedupe(root);
  else if (key === 'capabilities doctor') data = { ...skillsAudit(root), liveConnectors: 'NOT_VERIFIED_BY_SOURCE_AUDIT', modelRouting: 'EXISTING_PROTECTED_ROUTER_UNCHANGED', credentialRotationRequired: false };
  else if (key === 'integrations costs') data = { paidSocialApiCapUsd: 0, offlineProviderCalls: 0, livePlatformPrice: null, subscriptionInferenceCost: null, unknownPricesBlockCalls: true };
  else if (key === 'capabilities plan') data = capabilitiesPlan(root, tenant(), str('task'), typeof values.stage === 'string' ? values.stage : 'research');
  else if (key === 'evidence ingest') data = ingestEvidence(root, tenant(), str('file'), ds());
  else if (key === 'evidence review') data = reviewEvidence(root, tenant(), str('file'), ds());
  else if (key === 'evidence list') data = { tenant: tenant(), dataset: ds(), evidence: evidenceList(root, tenant(), ds()) };
  else if (key === 'research trends') data = researchDigest(root, tenant(), ds(), Number(values.days ?? 30));
  else if (key === 'research replay') {
    if (!values.offline) throw new GtmError('OFFLINE_REQUIRED', 'Component replay requires --offline', 3);
    data = researchReplay(root, tenant());
  }
  else if (key === 'research fetch') data = fetchPublic(root, tenant(), str('url'), values.network);
  else if (key === 'voice profile') data = voiceProfile(root, tenant());
  else if (key === 'distribution prepare') data = prepareDraft(root, tenant(), {fixture: values.fixture,
    ...(typeof values.media === 'string' ? {media:[mediaFromReceipt(root,tenant(),values.media)]} : {})});
  else if (key === 'distribution simulate') {
    const brand = tenant();
    if (values.fixture !== 'synthetic') throw new GtmError('SYNTHETIC_REQUIRED','Simulation requires --fixture synthetic',3);
    const now=new Date(); const draft=prepareDraft(root,brand,{fixture:'synthetic'},now).draft;
    if (str('draft') !== draft.id) throw new GtmError('SIMULATION_DRAFT','Use the current synthetic prepared draft',3);
    const scenario=z.enum(['none','timeout-before-accept','timeout-after-accept']).parse(values.scenario ?? 'none');
    data=simulateDispatch(root,brand,draft.id,{requestKey:str('idempotency-key'),approval:illustrativeApproval(draft,now),identity:mockIdentity(brand,now),estimatedUsd:0,fault:scenario},now);
  } else if (key === 'distribution reconcile') data=reconcileDispatch(root,tenant(),str('id'));
  else if (key === 'analytics seed') {
    if (values.fixture !== 'synthetic') throw new GtmError('SYNTHETIC_REQUIRED','Seed requires --fixture synthetic',3);
    data=seedAnalytics(root,tenant());
  } else if (key === 'analytics ingest') {
    if (values.synthetic !== true) throw new GtmError('SYNTHETIC_REQUIRED','Event ingestion requires --synthetic',3);
    data=ingestEventFile(root,tenant(),str('source'));
  } else if (key === 'analytics report' && values.synthetic === true) data=analyticsReport(root,tenant(),{synthetic:true,period:str('period','7d')});
  else if (key === 'analytics metrics') data=metricDictionary(tenant());
  else if (key === 'growth cro') data=croProposal(root,tenant(),{synthetic:values.synthetic,period:str('period','7d')});
  else if (key === 'experiments list') data=experimentsList(root,tenant(),values.synthetic);
  else if (key === 'content draft') data = draftContent(root, tenant(), str('format', 'post'), str('source-card'), ds());
  else if (key === 'content humanize') {
    if (values['preserve-claims'] !== true) throw new GtmError('PRESERVE_CLAIMS_REQUIRED', 'Explicit --preserve-claims is required', 3);
    data = humanize(root, tenant(), str('draft'), ds());
  } else if (key === 'content pack') {
    const brand = tenant(); const source = str('source-card');
    const posts: ReturnType<typeof humanize>[] = [], threads: ReturnType<typeof humanize>[] = [];
    for (let i = 0; i < 7; i++) {
      const draft = draftContent(root, brand, i < 5 ? 'post' : 'thread', source, ds(), i < 5 ? i : i - 5);
      const edited = humanize(root, brand, draft.id, ds()); (i < 5 ? posts : threads).push(edited);
    }
    data = { ...context(root, brand, ds()), posts, threads, receipt: artifact(root, brand, 'content-batch', { posts, threads }) };
  } else if (key === 'creative pack') {
    const brand = tenant(); const cycle = typeof values.campaign === 'string' ? records(root, brand, 'cycle', ds()).filter(c => c.cycleKey === values.campaign).sort((a,b) => Number(a.sequence)-Number(b.sequence)).at(-1) : undefined;
    data = await creativePack(root, brand, str('draft', typeof cycle?.draftId === 'string' ? cycle.draftId : undefined), ds());
  } else if (key === 'distribution manual-pack') data = manualPack(root, tenant(), str('draft'), ds());
  else if (['distribution decision import', 'distribution receipt import'].includes(key)) data = importDecision(root, tenant(), str('file'), ds());
  else if (key === 'distribution status') data = { ...context(root, tenant(), ds()), account: HANDLES[tenant()], packets: records(root, tenant(), 'packet', ds()), history: records(root, tenant(), 'publication', ds()) };
  else if (key === 'metrics import') data = importMetrics(root, tenant(), str('from', typeof values.file === 'string' ? values.file : undefined), ds());
  else if (['analytics weekly', 'weekly recap'].includes(key)) data = scorecards(root, tenant(), ds(), Number(values.days ?? 7));
  else if (key === 'workflow catalog') data = [...workflowCatalog(),...v4Catalog()];
  else if (pair === 'workflow run' && WORKFLOWS.includes(words[2] as typeof WORKFLOWS[number])) {
    const brand = tenant(); if (!values.offline) throw new GtmError('OFFLINE_REQUIRED', 'Use explicit --offline', 3);
    if (['founder-tech-thread', 'retropick-feature-launch'].includes(words[2]!)) {
      if (words[2]!.startsWith('founder-') && brand !== 'founder' || words[2]!.startsWith('retropick-') && brand !== 'retropick') throw new GtmError('WORKFLOW_SCOPE', 'Workflow belongs to the other tenant', 2);
      data = await runCycle(root, brand, str('idempotency-key'), ds(), id => creativePack(root, brand, id, ds()));
    } else if (words[2] === 'weekly-growth-retrospective') data = scorecards(root, brand, ds());
    else data = executeResearchWorkflow(root, brand, words[2]!, ds());
  } else if (['cycle run', 'cycle resume'].includes(key)) {
    const brand = tenant(); if (!values.offline) throw new GtmError('OFFLINE_REQUIRED', 'Use explicit --offline', 3);
    data = await runCycle(root, brand, str('idempotency-key', typeof values.id === 'string' ? values.id : undefined), ds(), id => creativePack(root, brand, id, ds()));
  } else if (key === 'cycle status') data = { ...context(root, tenant(), ds()), cycles: records(root, tenant(), 'cycle', ds()) };
  else if (key === 'harness promotions status') data = { globalPromotionEnabled: false, projectPromotionEnabled: false,
    requiredGates: ['OBSERVED_WEEKLY_CYCLE_EACH_BRAND', 'BASELINE', 'SEALED_HOLDOUT', 'SECURITY', 'ROLLBACK', 'INDEPENDENT_REVIEW', 'EXACT_OWNER_AUTHORIZATION'],
    eligibleObservedCycles: ['founder', 'retropick'].map(brand => ({ tenant: brand, completed: scorecards(root, brand).engineering.completedCycles })) };
  else if (['harness evaluate', 'harness baseline', 'harness propose'].includes(pair)) {
    if (!values.offline || values.mode && values.mode !== 'offline' || values.k && values.k !== '1') throw new GtmError('OFFLINE_REQUIRED', 'Only deterministic --offline with k=1 is admitted; model-backed work requires separate budget admission', 3);
    const requested = str('suite', 'all');
    if (!['all', 'global', 'gtm'].includes(requested)) throw new GtmError('SUITE_UNAVAILABLE', 'Available contract suites: all, global, gtm. Voice quality requires human review.', 4);
    if (values.target && values.target !== 'project:guardrails') throw new GtmError('TARGET_DENIED', 'Only isolated project:guardrails proposals are allowed; global skills are unchanged', 3);
    const result = spawnSync('/usr/bin/python3', [safePath(root, 'scripts/harness_gtm.py'), words[1]!, '--suite', requested],
      { cwd: root, encoding: 'utf8', timeout: 310000, maxBuffer: 2*1024*1024, env: {PATH:'/home/ubuntu/.local/bin:/usr/bin:/bin', ...(process.env.XDG_RUNTIME_DIR ? {XDG_RUNTIME_DIR:process.env.XDG_RUNTIME_DIR} : {})} });
    if (result.error || result.status !== 0) throw new GtmError('HARNESS_BLOCKED', 'Isolated runner failed; inspect local run evidence. No model or provider fallback was enabled', 4);
    data = JSON.parse(result.stdout) as unknown;
  }
  else return undefined;
  return { status: 'LOCAL_RESULT', data };
}
