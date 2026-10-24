import { existsSync } from 'node:fs';
import { z } from 'zod';
import { GtmError, hashObject } from '../../observability/src/index.js';
import { safePath } from '../../core/src/workspace.js';
import { type Tenant, HashSchema, TimeSchema } from '../../schemas/src/index.js';
import { context, localInput, artifact, type Dataset } from '../../v3/src/common.js';
import { usable } from '../../v3/src/evidence.js';
import { scorecards } from '../../v3/src/analytics.js';
import { list } from '../../v3/src/intelligence/store.js';
import { PublishingStore } from './store.js';
import { resolveSlot, timeDisplay, wallTime } from './time.js';
import { assertChannel } from './contracts.js';

export function postingPolicy(channel?: ReturnType<typeof assertChannel>) {
  if(!channel?.timezone || !channel.postingSchedule)return {status:'AWAITING_BUFFER_SCHEDULE',weeklyPosts:5,timezone:'America/New_York'};
  const days=channel.postingSchedule.map(s=>s.day);
  const count=channel.postingSchedule.filter(s=>!s.paused).reduce((n,s)=>n+s.times.length,0);
  const unique=days.length===new Set(days).size && channel.postingSchedule.every(s=>s.times.length===new Set(s.times).size);
  return {status:channel.timezone==='America/New_York' && count===5 && unique?'VERIFIED_BUFFER_SCHEDULE':'BUFFER_SCHEDULE_MISMATCH',
    weeklyPosts:5,timezone:'America/New_York',observedWeeklySlots:count,observedTimezone:channel.timezone,verifiedAt:channel.verifiedAt};
}

export function calendar(root:string,tenant:Tenant,start?:string,now=new Date(),dataset:Dataset='OBSERVED') {
  context(root,tenant,dataset);const date=start??wallTime(now,'America/New_York').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)throw new GtmError('PLAN_DATE','Real YYYY-MM-DD required',2);
  const themes=tenant==='retropick'?['Documented testnet flow','Orderbook liquidity questions','Graduation boundaries','Mechanism failure paths','Evidence-backed product note','Creator research question','Weekly evidence review']:
    ['Tests and production readiness','State transition design','Settlement failure modes','Security boundaries','Inspectable architecture','Source-grounded technical question','Weekly engineering learning'];
  const cards=usable(root,tenant,dataset,undefined,now),entries:unknown[]=[];
  const statePath=`runtime/state/${tenant}/publishing-${dataset==='SYNTHETIC'?'synthetic':'observed'}.sqlite`;
  let channel:ReturnType<typeof assertChannel>|undefined;
  if(existsSync(safePath(root,statePath))) {
    using store=new PublishingStore(root,tenant,dataset==='SYNTHETIC',true);
    const latest=store.rows('provider_channels').at(-1);
    if(latest)channel=assertChannel(tenant,latest.channel);
  }
  const fresh=channel && Date.parse(channel.verifiedAt)<=now.getTime() && Date.parse(channel.verifiedAt)>now.getTime()-86400000;
  const policy=postingPolicy(fresh?channel:undefined);
  const weekdays=['sun','mon','tue','wed','thu','fri','sat'];
  for(let d=0;d<7;d++) {
    const day=new Date(Date.parse(date)+d*86400000).toISOString().slice(0,10);
    const weekday=weekdays[new Date(day).getUTCDay()]!;
    const times=policy.status==='VERIFIED_BUFFER_SCHEDULE'?channel!.postingSchedule!.filter(s=>s.day===weekday && !s.paused).flatMap(s=>s.times):
      policy.status==='BUFFER_SCHEDULE_MISMATCH'?[]:['sat','sun'].includes(weekday)?[]:['09:00'];
    for(const time of times) {
      const zone='America/New_York',slot=day+'T'+time,dueAt=resolveSlot(slot,zone);
      const current=cards.filter(c=>Date.parse(c.source.expiresAt)>Date.parse(dueAt));
      entries.push({id:`${tenant}-${day}-${time}`,topic:themes[d],targetZone:zone,localSlot:slot,dueAt,times:timeDisplay(dueAt,zone),
        status:Date.parse(dueAt)<=now.getTime()?'SLOT_PASSED':current.length?'RESEARCH_BRIEF_REQUIRES_TOPIC_REVIEW':'HOLD_EVIDENCE_GAP',
        evidenceCandidates:current.map(c=>c.source.id),packetId:null,scheduled:false,approval:'REQUIRED_PER_IMMUTABLE_PACKET',timingBasis:policy.status==='VERIFIED_BUFFER_SCHEDULE'?'OBSERVED_BUFFER_SCHEDULE':'PROPOSED_WEEKDAYS_09_00_NOT_PROVIDER_VERIFIED'});
    }
  }
  const report={schemaVersion:5,tenant,dataset,start:date,days:7,entries,postingPolicy:policy,queueTarget:8,provider:'buffer',batchApproval:false};
  return {...report,receipt:artifact(root,tenant,'v-five-calendar',report)};
}
const DailyInput=z.strictObject({tenant:z.literal('founder'),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accomplishments:z.array(z.strictObject({text:z.string().min(1).max(1000),evidenceId:z.string(),evidenceSha256:HashSchema,kind:z.enum(['GITHUB_ACTIVITY','BEADS','OWNER_CONFIRMED','RESEARCH'])})).max(5)});
export function daily(root:string,tenant:Tenant,path?:string,now=new Date(),dataset:Dataset='OBSERVED') {
  context(root,tenant,dataset);if(tenant!=='founder')throw new GtmError('TENANT_SCOPE','Founder 5+5 requires --brand founder',2);
  const date=wallTime(now,'Asia/Jakarta').slice(0,10),cards=usable(root,tenant,dataset,undefined,now);
  const input=path?DailyInput.parse(localInput(root,tenant,path,'research')):{tenant:'founder',date,accomplishments:[]};
  if(input.date!==date)throw new GtmError('DAILY_DATE','Daily input must match the current WIB date',3);
  const supported=input.accomplishments.map(a=>{
    const c=cards.find(c=>c.source.id===a.evidenceId && hashObject(c.source)===a.evidenceSha256 && c.claims.includes(a.text));
    if(!c)throw new GtmError('EVIDENCE_GAP','Accomplishment must match an exact reviewed statement',3);
    if(a.kind==='OWNER_CONFIRMED' && c.review.classification!=='OWNER_ATTESTED')throw new GtmError('OWNER_ATTESTATION_REQUIRED','Owner-confirmed accomplishment needs owner evidence',3);
    return {...a,status:'SUPPORTED_SOURCE_STATEMENT',limitation:'Activity/repository evidence does not certify production shipment or personal achievement'};
  });
  const accomplishments:Array<unknown>=[...supported];while(accomplishments.length<5)accomplishments.push({slot:accomplishments.length+1,status:'MISSING',text:null,reason:'No supported owner/activity statement supplied'});
  const suggestions=['Review one current technical source and its limits','Confirm one authentic proof-of-work statement','Review five researched conversations for human engagement','Inspect pending approvals and Buffer queue capacity','Review observed metrics and choose one falsifiable next experiment']
    .map((text,i)=>({priority:i+1,text,evidenceIds:cards.map(c=>c.source.id),status:'SUGGESTION_NOT_ACCOMPLISHMENT'}));
  const report={schemaVersion:5,tenant,dataset,date,timezone:'Asia/Jakarta',accomplishments,suggestions,externalWrites:0,automaticAchievementInference:false};
  return {...report,receipt:artifact(root,tenant,'v-five-daily',report)};
}
const QueueInput=z.strictObject({tenant:z.enum(['founder','retropick']),kind:z.enum(['conversations','prospects']),
  candidates:z.array(z.strictObject({id:z.string().min(1).max(160),url:z.url(),evidenceId:z.string(),evidenceSha256:HashSchema,
    statement:z.string().min(1).max(1500),relevance:z.string().min(10).max(1000),observedAt:TimeSchema,
    provenance:z.enum(['PUBLIC_SEARCH_DISCOVERY','AUTHORIZED_OWNER_RESEARCH']),entityId:z.string().optional()})).max(30)});
export function researchQueue(root:string,tenant:Tenant,kind:'conversations'|'prospects',dataset:Dataset='OBSERVED',now=new Date(),path?:string) {
  context(root,tenant,dataset);const cards=usable(root,tenant,dataset,undefined,now),entities=list(root,tenant,'entity',dataset);
  const maximum=kind==='conversations'?30:20;
  const suggestions=kind==='conversations'?cards.flatMap(c=>c.claims.map(statement=>({id:hashObject({tenant,statement,source:c.source.id}),
    kind:'RESEARCH_ANGLE_NOT_OBSERVED_X_CONVERSATION',statement,sourceId:c.source.id,sourceHash:hashObject(c.source),uri:c.source.uri,
    reviewedAt:c.review.observedAt,expiresAt:c.source.expiresAt,ownerAction:'Find and verify a relevant public conversation, then engage personally',observedXActivity:false}))).slice(0,maximum):
    entities.filter(e=>Array.isArray(e.types)&&e.types.includes('Person')).map(e=>({id:e.id,kind:'DISCOVERY_ONLY_PROSPECT',entity:e,fit:'REQUIRES_CURRENT_ROLE_AND_TOPIC_REVIEW',
      observedXActivity:false,outreachAuthorized:false})).slice(0,maximum);
  const entries:Record<string,unknown>[]=[];
  if(path){
    const input=QueueInput.parse(localInput(root,tenant,path,'research'));
    if(input.tenant!==tenant || input.kind!==kind)throw new GtmError('QUEUE_SCOPE','Research queue input must match tenant and queue kind',3);
    const seen=new Set<string>();
    for(const candidate of input.candidates.slice(0,maximum)) {
      const url=new URL(candidate.url);
      if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||Date.parse(candidate.observedAt)>now.getTime()||Date.parse(candidate.observedAt)<now.getTime()-30*86400000)throw new GtmError('QUEUE_PROVENANCE','Current credential-free public discovery URL required',3);
      const card=cards.find(c=>c.source.id===candidate.evidenceId && hashObject(c.source)===candidate.evidenceSha256 && c.claims.includes(candidate.statement));
      if(!card)throw new GtmError('EVIDENCE_GAP','Candidate fit must bind an exact current reviewed source statement',3);
      if(seen.has(url.href))continue;seen.add(url.href);
      const entity=candidate.entityId?entities.find(e=>e.id===candidate.entityId):undefined;
      const currentRole=entity?.roleStatus==='REVIEWED_SOURCE' && entity.identityStatus==='REVIEWED_SOURCE' && typeof entity.verifiedAt==='string' && Date.parse(entity.verifiedAt)>=now.getTime()-30*86400000;
      entries.push({...candidate,sourceReviewHash:hashObject(card.review),expiresAt:card.source.expiresAt,discoveryOnly:candidate.provenance==='PUBLIC_SEARCH_DISCOVERY',
        status:kind==='prospects'&&!currentRole?'HOLD_CURRENT_ROLE_REQUIRED':'SOURCE_GROUNDED_HUMAN_REVIEW_QUEUE',observedXActivity:false,
        ownerAction:kind==='conversations'?'Open the exact public conversation natively and respond personally if relevant':'Verify current fit and selectively contact personally; no bulk outreach',outreachAuthorized:false});
    }
  }
  const report={schemaVersion:5,tenant,dataset,kind,status:'RESEARCH_ONLY',target:kind==='conversations'?'15–30 actual researched conversations':'10–20 high-fit prospects maximum',
    entries,researchSuggestions:suggestions,verifiedConversationCount:0,verifiedProspectCount:0,evidenceGap:'Topic evidence and seed people are not fresh verified X conversations or high-fit prospects',
    collection:'Approved registered sources and authorized owner inputs only; no cookie/stealth/X browser automation',automaticReplies:false,automaticDMs:false};
  return {...report,receipt:artifact(root,tenant,`v-five-${kind}`,report)};
}
const ProductEvent=z.strictObject({tenant:z.enum(['retropick','founder']),id:z.string().min(1).max(160),jobId:z.string(),observedAt:TimeSchema,
  event:z.enum(['page_view','qualified_acquisition','activation','retained_user','qualified_conversation']),value:z.number().finite().nonnegative().nullable(),
  utm:z.strictObject({source:z.literal('x'),medium:z.literal('organic_social'),campaign:z.string(),content:z.string()}),
  origin:z.literal('AUTHORIZED_FIRST_PARTY_EXPORT'),sourceSha256:HashSchema,definition:z.string().min(10),consentReviewed:z.literal(true)});
export function importEvents(root:string,tenant:Tenant,path:string,synthetic=false,now=new Date()) {
  context(root,tenant,synthetic?'SYNTHETIC':'OBSERVED');const input=z.array(ProductEvent).max(10000).parse(localInput(root,tenant,path,'growth'));
  using store=new PublishingStore(root,tenant,synthetic);
  return store.transaction(()=>{
    let inserted=0;
    for(const event of input){
      const job=store.job(event.jobId);
      if(tenant==='founder' && !['page_view','qualified_conversation'].includes(event.event) || tenant==='retropick' && event.event==='qualified_conversation')throw new GtmError('METRIC_TENANT','Product event belongs to the other tenant scorecard',3);
      if(event.tenant!==tenant || Date.parse(event.observedAt)>now.getTime() || !['SENT','MEASURED','EXTERNAL_URL_PENDING'].includes(job.state))throw new GtmError('EVENT_BINDING','Product event must match a sent tenant post',3);
      // The opaque tracking value is chosen before approval. Using the envelope hash inside
      // its own text URL would create a circular hash and cannot bind a real outbound link.
      const approvedLinks=(job.envelope.text.match(/https:\/\/[^\s]+/g)??[]).flatMap(raw=>{try{return [new URL(raw)];}catch{return [];}});
      const boundLink=approvedLinks.some(url=>!url.username&&!url.password&&!url.port&&Object.entries(event.utm).every(([name,value])=>
        url.searchParams.getAll('utm_'+name).length===1&&url.searchParams.get('utm_'+name)===value));
      if(!boundLink)throw new GtmError('EVENT_BINDING','Export UTM values must match one exact link in the approved post',3);
      const sent=store.rows('provider_receipts',job.id).filter(r=>r.post).at(-1)?.post as {sentAt?:string}|undefined;
      if(!sent?.sentAt || Date.parse(event.observedAt)<Date.parse(sent.sentAt))throw new GtmError('EVENT_BINDING','Attributed product events must follow actual publication',3);
      const old=store.rows('metrics_snapshots').find(r=>r.eventId===event.id);
      const data={...event,eventId:event.id,verification:'OWNER_ATTESTED_EXPORT_NOT_PRODUCT_VERIFIED'};
      if(old && hashObject(old)!==hashObject(data))throw new GtmError('EVENT_CONFLICT','Event identity changed',3);
      if(!old){store.put('metrics_snapshots',data,job.id);inserted++;}
    }
    return {tenant,inserted,duplicates:input.length-inserted,verification:'OWNER_ATTESTED_EXPORT_NOT_PRODUCT_VERIFIED'};
  });
}
export function weekly(root:string,tenant:Tenant,synthetic=false,now=new Date()) {
  const legacy=scorecards(root,tenant,synthetic?'SYNTHETIC':'OBSERVED',7,now);
  const path=safePath(root,`runtime/state/${tenant}/publishing-${synthetic?'synthetic':'observed'}.sqlite`);
  if(!existsSync(path))return {schemaVersion:5,tenant,legacy,provider:{status:'NO_DATA',snapshots:[]},learning:'BLOCKED_OBSERVATIONS_REQUIRED',causalGrowth:null};
  using store=new PublishingStore(root,tenant,synthetic,true);
  const start=Date.parse(legacy.period.start),end=Date.parse(legacy.period.end);
  const snapshots=store.rows('metrics_snapshots').filter(r=>Date.parse(String(r.observedAt))>=start && Date.parse(String(r.observedAt))<end);
  const latest=new Map<string,Record<string,unknown>>();
  for(const r of snapshots){const k=String(r.providerPostId??r.eventId);if(!latest.has(k)||String(latest.get(k)!.observedAt)<String(r.observedAt))latest.set(k,r);}
  const measured=[...latest.values()].some(r=>Array.isArray(r.metrics)&&r.metrics.some((v:unknown)=>v!==null&&typeof v==='object'&&(v as {value?:unknown}).value!==null) || typeof r.value==='number');
  return {schemaVersion:5,tenant,legacy,provider:{status:snapshots.length?'OBSERVED_WITH_PROVENANCE':'NO_DATA',snapshots:[...latest.values()]},
    learning:measured?'REVIEW_OBSERVATIONS_AND_MISSING_DATA':'BLOCKED_OBSERVATIONS_REQUIRED',nextExperiment:'Compare one declared content/time hypothesis using matching post windows and denominators',
    causalGrowth:null,usAudienceVerified:false,unknownIsZero:false,countsMayOverlap:true};
}
