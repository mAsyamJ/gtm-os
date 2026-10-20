import { GtmError } from '../../../observability/src/index.js';
import { context, Dataset } from '../common.js';
import { list } from './store.js';
import { importSeeds, entities } from './seeds.js';
import { collect, trends, sourcePolicies, createBrief,linkReview } from './research.js';
import { opportunities, reviewEntity } from './opportunities.js';

export async function routeIntelligence(root:string,words:string[],values:Record<string,unknown>) {
  if(!words.includes('intelligence'))return undefined;
  const dataset=Dataset.parse(values.synthetic===true?'SYNTHETIC':values.dataset??'OBSERVED');
  if(!values.brand)throw new GtmError('BRAND_REQUIRED','Explicit --brand required',2);
  const c=context(root,values.brand,dataset),key=words.join(' ');
  const str=(name:string)=>{const v=values[name];if(typeof v!=='string'||!v)throw new GtmError('ARGUMENT_REQUIRED',`--${name} required`,2);return v;};
  if(values.window&&values.window!=='30d')throw new GtmError('WINDOW_INVALID','V4 currently implements rolling 30d windows',2);
  let data:unknown;
  if(key==='intelligence sources doctor')data={...c,schemaVersion:4,networkRequests:0,hostedModelRequests:0,sources:sourcePolicies(root).map(p=>({id:p.id,host:p.host,access:p.access,liveIntegration:'REQUIRES_COLLECTION_RECEIPT'})),
    networkPolicy:'PER_ADAPTER_PUBLIC_KEYLESS_EXPLICIT_OPT_IN',globalComponents:'PIN_AUDIT_NOT_LIVE_VERIFICATION',paidSources:'DENIED',router:'EXISTING_ADMISSION_ONLY',modelBudget:{totalCalls:8,perTenant:4,estimatedReservationUsd:.10,actualSubscriptionUsd:null}};
  else if(key==='intelligence seeds import')data=importSeeds(root,c.tenant,str('people'),str('projects'),dataset);
  else if(key==='intelligence entities list')data={...c,entities:entities(root,c.tenant,dataset,typeof values.type==='string'?values.type:undefined)};
  else if(key==='intelligence entities review')data=reviewEntity(root,c.tenant,str('file'),dataset);
  else if(key==='intelligence graph export')data={...c,entities:entities(root,c.tenant,dataset),edges:list(root,c.tenant,'edge',dataset),privateCrossTenantJoins:false};
  else if(key==='intelligence collect'){
    if(values.offline||values.profile!=='crypto')throw new GtmError('NETWORK_POLICY_REQUIRED','Collection requires crypto profile and explicit approved-read; offline collection denied',3);
    data=await collect(root,c.tenant,values.network,dataset);
  }else if(key==='intelligence trends')data=trends(root,c.tenant,dataset);
  else if(key==='intelligence opportunities')data=opportunities(root,c.tenant,dataset,typeof values.file==='string'?values.file:undefined);
  else if(key==='intelligence brief')data=createBrief(root,c.tenant,str('topic-id'),dataset);
  else if(key==='intelligence sources list')data={...c,sources:list(root,c.tenant,'source',dataset),collections:list(root,c.tenant,'collection',dataset)};
  else if(key==='intelligence sources review-link')data=linkReview(root,c.tenant,str('file'),dataset);
  else throw new GtmError('UNKNOWN_COMMAND','Unknown intelligence operation',2);
  return {status:'LOCAL_RESULT',data};
}
