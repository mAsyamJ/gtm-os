import { GtmError } from '../../../observability/src/index.js';
import { loadWorkflow } from '../../../core/src/workspace.js';
import { context, artifact, type Dataset } from '../common.js';
import { usable } from '../evidence.js';
import { scorecards } from '../analytics.js';
import { PILLARS } from './contracts.js';
import { collect, trends } from './research.js';
import { opportunities } from './opportunities.js';
import { entities } from './seeds.js';
import { campaign } from './campaign.js';

export const V4_WORKFLOWS=['crypto-daily-radar','crypto-weekly-synthesis','influencer-expert-watchlist','launchpad-competitor-intel','retropick-market-structure-series','founder-engineering-research','research-to-manual-packet','weekly-gtm-learning'] as const;
export function v4Catalog(){return V4_WORKFLOWS.map(id=>({id,schemaVersion:4,implementation:'EXECUTABLE_WITH_EVIDENCE_AND_OWNER_GATES',tenantAllowlist:id.startsWith('founder-')?['founder']:id.startsWith('retropick-')?['retropick']:['founder','retropick'],network:'COLLECT_REQUIRES_APPROVED_READ',publication:'OWNER_NATIVE_UI_ONLY_HOLD',scheduling:'MANUAL_INVOCATION'}));}
export function synthesis(root:string,selected:unknown,dataset:Dataset='OBSERVED') {
  const c=context(root,selected,dataset),sources=usable(root,c.tenant,dataset),radar=trends(root,c.tenant,dataset);
  const domains=PILLARS.map(([pillar,query])=>{
    const relevant=sources.filter(s=>query.split(' ').some(word=>word.length>3&&`${s.source.title} ${s.claims.join(' ')}`.toLowerCase().includes(word.toLowerCase())));
    return {pillar,question:query,status:relevant.length?'REVIEWED_BACKGROUND_OR_RECENT':'EVIDENCE_GAP',sources:relevant.map(s=>({id:s.source.id,uri:s.source.uri,revision:s.source.revision})),facts:relevant.flatMap(s=>s.claims),limitations:['Source coverage is incomplete; publication dates and contrary evidence require explicit review.']};
  });
  const questions=['What evidence establishes this mechanism?','Which environment was tested?','What does custody protect?','What does custody leave uncertain?','How is completion verified?','Which retries are bounded?','What makes a claim reproducible?','Where does price discovery end?','Where does secondary trading begin?','What can a receipt establish?','What cannot a receipt establish?','Which observations establish depth?','What would falsify the claim?','What is still planned?','What structured feedback is useful?'];
  const result={...c,status:sources.length?'PARTIAL_SOURCE_COVERAGE':'BLOCKED',domains,crossDomainSynthesis:{reviewedSources:sources.length,rollingTopics:radar.trends.length,claims:sources.flatMap(s=>s.claims)},
    questions:sources.length?questions.map((question,i)=>({question,sourceIds:[sources[i%sources.length]!.source.id],status:'RESEARCH_QUESTION_NOT_OBSERVED_CUSTOMER_PAIN'})):[],
    counterHypeNotes:['Testnet is not mainnet.','A functional receipt is not organic adoption.','Custody does not guarantee liquidity.','Deployment does not establish security audit completion.','An integration does not establish spreads.','Followers do not establish factual authority.','Retrieved text is not reviewed evidence.','A current crawl is not a current publication.','Missing engagement is unavailable.','A HOLD packet is not a published campaign.'],
    watchlist:entities(root,c.tenant,dataset,'person'),scorecards:scorecards(root,c.tenant,dataset),approvalStatus:'HOLD',hostedModelRequests:0};
  return {...result,receipt:artifact(root,c.tenant,'crypto-synthesis',result)};
}
export async function executeV4Workflow(root:string,selected:unknown,id:string,values:Record<string,unknown>,dataset:Dataset='OBSERVED') {
  const c=context(root,selected,dataset),definition=loadWorkflow(root,id);const entry=v4Catalog().find(v=>v.id===id);
  if(!entry||!entry.tenantAllowlist.includes(c.tenant))throw new GtmError('WORKFLOW_SCOPE','V4 workflow tenant differs',2);
  if(id==='crypto-daily-radar')return values.network==='approved-read'&&!values.offline?collect(root,c.tenant,values.network,dataset):trends(root,c.tenant,dataset);
  if(id==='crypto-weekly-synthesis')return synthesis(root,c.tenant,dataset);
  if(id==='influencer-expert-watchlist'){
    const watchlist=entities(root,c.tenant,dataset,'person'),verified=watchlist.filter(e=>e.identityStatus==='REVIEWED_SOURCE'&&e.roleStatus==='REVIEWED_SOURCE');
    return {...c,status:verified.length>=14?'COMPLETED_LOCAL':'BLOCKED',blocker:verified.length>=14?null:'PEOPLE_VERIFICATION_SHORTFALL',watchlist,verifiedPeople:verified.length,minimum:14,target:50,remaining:Math.max(0,14-verified.length)};
  }
  if(id==='launchpad-competitor-intel')return {...c,status:'PARTIAL_RESEARCH_NOT_COMPETITOR_VERIFICATION',battlecards:entities(root,c.tenant,dataset,'project').map(e=>({project:e.name,sourceUrls:e.sourceUrls,claims:usable(root,c.tenant,dataset).filter(s=>e.sourceIds.includes(s.source.id)).flatMap(s=>s.claims),competitionDimension:null,directCompetitorVerified:false})),opportunities:opportunities(root,c.tenant,dataset)};
  if(id==='weekly-gtm-learning')return {...c,status:scorecards(root,c.tenant,dataset).business.status==='NO_DATA'?'BLOCKED':'COMPLETED_LOCAL',report:scorecards(root,c.tenant,dataset),improvementPromotion:'DISABLED'};
  const key=values['idempotency-key'];if(typeof key!=='string')throw new GtmError('ARGUMENT_REQUIRED','--idempotency-key required',2);
  const result=await campaign(root,c.tenant,{key,dataset,...(typeof values['brief-id']==='string'?{briefId:values['brief-id']}:{}),...(typeof values['topic-id']==='string'?{topicId:values['topic-id']}:{}),modelMode:values['model-mode']??'offline',budgetId:values['budget-id']});
  return {...result,definitionSha256:definition.sha256,workflowId:id};
}
