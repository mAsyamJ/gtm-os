import { z } from 'zod';
import { readStructured } from '../../../core/src/workspace.js';
import { GtmError, hashObject, sha256 } from '../../../observability/src/index.js';
import { context, localInput, type Dataset } from '../common.js';
import { PILLARS, Observation, Brief,TrendSignal } from './contracts.js';
import { PublicTransport } from './http.js';
import { list, save } from './store.js';
import { usable } from '../evidence.js';
import { parseFeed } from './parsers.js';

export const Policy=z.object({id:z.string(),host:z.string(),prefixes:z.array(z.string()).nonempty(),queryKeys:z.array(z.string()),
  urls:z.array(z.url()),pillar:z.string(),platform:z.string(),license:z.string(),access:z.literal('PUBLIC_KEYLESS_READ'),termsReviewedAt:z.string()});
export function sourcePolicies(root:string){return z.object({schemaVersion:z.literal(4),sources:z.array(Policy)}).parse(readStructured(root,'config/v4-sources.json')).sources;}
export function window30(end=new Date()) {return {windowStartUtc:new Date(end.getTime()-30*86400000).toISOString(),windowEndUtc:end.toISOString()};}
export function inWindow(publishedAt:string|null,start:string,end:string){if(!publishedAt)return false;const n=Date.parse(publishedAt);return Number.isFinite(n)&&n>=Date.parse(start)&&n<=Date.parse(end);}
function currentWindow(root:string,tenant:unknown,dataset:Dataset){
  const last=list(root,tenant,'collection',dataset).at(-1);
  return last?{windowStartUtc:String(last.windowStartUtc),windowEndUtc:String(last.windowEndUtc)}:window30();
}
function linked(observation:Observation,reviewed:ReturnType<typeof usable>[number]) {
  return observation.evidenceId===reviewed.source.id&&observation.reviewId===reviewed.review.id&&observation.uri===reviewed.source.uri&&
    reviewed.claims.every(claim=>observation.excerpt.includes(claim));
}
export function publicationCoverage(root:string,tenant:unknown,ids:string[],dataset:Dataset,clock=currentWindow(root,tenant,dataset),at=new Date()) {
  const c=context(root,tenant,dataset),reviewed=usable(root,c.tenant,dataset,undefined,at),latest=new Map<string,Observation>();
  for(const raw of list(root,tenant,'source',dataset)){const o=Observation.parse(raw);latest.set(o.canonicalUrl+'|'+o.contentSha256,o);}
  const observations=ids.map(id=>{
    const source=reviewed.find(r=>r.source.id===id),observation=source&&[...latest.values()].find(o=>o.status==='COLLECTED'&&linked(o,source)&&inWindow(o.publishedAt,clock.windowStartUtc,clock.windowEndUtc));
    if(!observation)throw new GtmError('WINDOW_EVIDENCE','Rolling selection lacks explicitly linked publication-dated source coverage',4);
    return {id:observation.id,sha256:hashObject(observation),evidenceId:id,reviewId:observation.reviewId!,publishedAt:observation.publishedAt!};
  });
  return {...clock,observations};
}
export function textContent(raw:string,type:string) {
  if(!type.includes('html'))return raw;
  return raw.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[m]??m)).replace(/\s+/g,' ').trim();
}
export function publicationDate(raw:string) {
  const value=/(?:property|name)=["'](?:article:published_time|datePublished)["'][^>]*content=["']([^"']+)/i.exec(raw)?.[1]
    ?? /"datePublished"\s*:\s*"([^"']+)"/.exec(raw)?.[1];
  return value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
}
export async function collect(root:string,selected:unknown,network:unknown,dataset:Dataset='OBSERVED',end=new Date()) {
  const c=context(root,selected,dataset);if(network!=='approved-read'||dataset!=='OBSERVED')throw new GtmError('NETWORK_POLICY_REQUIRED','Observed collection requires --network approved-read; fixtures never fetch',3);
  const clock=window30(end),transport=new PublicTransport(root,c.tenant),sources=sourcePolicies(root),observations:Observation[]=[],queries:Record<string,unknown>[]=[];
  for(const policy of sources){
    for(const template of policy.urls){
      const targets=template.includes('{query}')?PILLARS.map(([pillar,query])=>({pillar,uri:template.replace('{query}',encodeURIComponent(query)).replace('{start}',String(Math.floor(Date.parse(clock.windowStartUtc)/1000))).replace('{end}',String(Math.floor(end.getTime()/1000)))})):[{pillar:policy.pillar,uri:template}];
      for(const target of targets){
        try{
          const response=await transport.fetch(target.uri,policy),raw=response.body.toString('utf8');
          const hn=policy.platform==='HN'?z.object({hits:z.array(z.object({objectID:z.string().regex(/^\d+$/),title:z.string().nullable(),story_text:z.string().nullable().optional(),created_at:z.string(),author:z.string(),points:z.number().nullable(),num_comments:z.number().nullable()}))}).parse(JSON.parse(raw)).hits:undefined;
          const items=policy.platform==='RSS'?parseFeed(root,raw).items.map(item=>({uri:item.uri,title:item.title,text:textContent(item.summary,'text/html'),author:item.author,publishedAt:item.publishedAt,engagement:{}})):hn?hn.filter(hit=>{const content=`${hit.title??''} ${hit.story_text??''}`.toLowerCase();const query=PILLARS.find(p=>p[0]===target.pillar)![1].split(' ');return query.filter(w=>w.length>2&&content.includes(w.toLowerCase())).length>=2;}).map(hit=>({uri:`https://hn.algolia.com/api/v1/items/${hit.objectID}`,title:hit.title??'HN discussion',text:`${hit.title??''}\n${textContent(hit.story_text??'','text/html')}`,author:hit.author,publishedAt:new Date(hit.created_at).toISOString(),engagement:{points:hit.points,comments:hit.num_comments}})):
            [{uri:target.uri,title:/<title[^>]*>([^<]+)/i.exec(raw)?.[1]??raw.split('\n').find(Boolean)?.slice(0,240)??policy.id,text:textContent(raw,response.contentType),author:null,publishedAt:publicationDate(raw),engagement:{}}];
          queries.push({sourceId:policy.id,pillar:target.pillar,uri:target.uri,status:items.length?'RESULTS':'NO_MATCHES',matchingResults:items.length,retrievedAt:response.at,responseSha256:response.sha256});
          for(const item of items){
            const excerpt=item.text.slice(0,policy.license==='MIT'?5000:1200);
            const value=save(root,c.tenant,'source',{sourceId:policy.id,pillar:target.pillar,uri:item.uri,canonicalUrl:item.uri,retrievalUri:target.uri,title:item.title.slice(0,500),author:item.author,publishedAt:item.publishedAt,retrievedAt:response.at,
              responseSha256:response.sha256,contentSha256:sha256(excerpt),excerpt,hashScope:'HTTP_RESPONSE_BODY',license:policy.license,status:'COLLECTED',error:null,engagement:item.engagement,
              platform:policy.platform,duplicateKey:hashObject({text:excerpt.toLowerCase().replace(/\W/g,'')}),publicationClock:item.publishedAt?'VERIFIED_METADATA':'BACKGROUND',evidenceId:null,reviewId:null,
              robotsSha256:response.robotsSha256,crawlDelaySeconds:response.crawlDelaySeconds},dataset);
            observations.push(Observation.parse(value));
          }
        }catch(error){
          const code=error instanceof GtmError?error.code:`SOURCE_UNAVAILABLE_${String((error as {code?:string}).code??'UNKNOWN').replace(/[^A-Z0-9_]/g,'').slice(0,60)}`;
          queries.push({sourceId:policy.id,pillar:target.pillar,uri:target.uri,status:'SOURCE_UNAVAILABLE',error:code});
          observations.push(Observation.parse(save(root,c.tenant,'source',{sourceId:policy.id,pillar:target.pillar,uri:target.uri,canonicalUrl:target.uri,title:policy.id,author:null,publishedAt:null,retrievedAt:new Date().toISOString(),
            responseSha256:sha256(''),contentSha256:sha256(''),excerpt:'',hashScope:'HTTP_RESPONSE_BODY',license:policy.license,status:'SOURCE_UNAVAILABLE',error:code,engagement:{},platform:policy.platform,
            duplicateKey:hashObject({uri:target.uri,error:code}),publicationClock:'BACKGROUND',evidenceId:null,reviewId:null},dataset)));
          if(code==='QUOTA_EXHAUSTED')break;
        }
      }
    }
  }
  const value=save(root,c.tenant,'collection',{...clock,profile:'crypto',queries,sourceIds:observations.map(o=>o.id),coverage:PILLARS.map(([pillar])=>({pillar,queries:queries.filter(q=>q.pillar===pillar).length,collected:observations.filter(o=>o.pillar===pillar&&o.status==='COLLECTED').length,unavailable:observations.filter(o=>o.pillar===pillar&&o.status==='SOURCE_UNAVAILABLE').length})),
    networkRequests:transport.requests,bodyBytes:transport.bytes,maxReservedTransferBytes:transport.requests*2*1024*1024,hostedModelRequests:0,status:observations.some(o=>o.status==='COLLECTED')?'PARTIAL_COVERAGE':'BLOCKED',
    excludedProviders:['X','PAID_APIS','COOKIE_CHANNELS'],approvalStatus:'HOLD'},dataset);
  return {...c,...value};
}
export function trends(root:string,selected:unknown,dataset:Dataset='OBSERVED',end?:Date) {
  const c=context(root,selected,dataset),last=list(root,c.tenant,'collection',dataset).at(-1);
  const clock=window30(end??(last?new Date(String(last.windowEndUtc)):new Date())),seen=new Set<string>();
  const latest=new Map<string,Observation>();for(const raw of list(root,c.tenant,'source',dataset)){const o=Observation.parse(raw);latest.set(o.canonicalUrl+'|'+o.contentSha256,o);}
  const observed=[...latest.values()];
  const reviewed=usable(root,c.tenant,dataset);
  const out=[];
  for(const [pillar,query] of PILLARS){
    const eligible=observed.filter(s=>s.pillar===pillar&&s.status==='COLLECTED'&&inWindow(s.publishedAt,clock.windowStartUtc,clock.windowEndUtc));
    const unique=eligible.filter(s=>{if(seen.has(s.duplicateKey))return false;seen.add(s.duplicateKey);return true;});
    const sources=reviewed.filter(r=>unique.some(s=>linked(s,r)));
    if(!sources.length)continue;
    const bound=unique.filter(s=>sources.some(r=>linked(s,r)));
    const independent=new Set(bound.map(s=>new URL(s.canonicalUrl).hostname)).size;
    const base={topicId:`${c.tenant}-topic-${pillar}`,pillar,title:query,...clock,sourceIds:sources.map(s=>s.source.id),independentSourceCount:independent,
      evidenceClass:'REVIEWED_SOURCE',rawObservations:bound.map(s=>({id:s.id,publishedAt:s.publishedAt,engagement:s.engagement,platform:s.platform})),
      weights:{evidenceQuality:.25,brandFit:.25,timelyDiscussion:.15,educationalUtility:.15,novelty:.10,feasibleCta:.10},
      trendScore:null,scoreExplanation:'Requires explicit editorial feature assessment; engagement is not automatically interpreted as influence.',
      whyNow:'Recent published material within the frozen window',whoCares:c.tenant==='founder'?'Technical builders':'Eligible creators and traders',
      counterargument:'Review counter-evidence before selecting an angle',whatWeKnow:sources.flatMap(s=>s.claims),whatWeDoNotKnow:['Market demand','Representative audience preference'],
      safeAngle:'Source-backed education',productionEffort:'ONE_EDITORIAL_PACKAGE',reviewStatus:'PENDING',approvalStatus:'HOLD',biasTags:['SOURCE_COVERAGE_BIAS'],counterEvidence:[]};
    out.push(TrendSignal.parse({...base,id:`${c.tenant}-trend-${hashObject(base).slice(0,24)}`,schemaVersion:4,tenant:c.tenant,dataset,label:dataset==='SYNTHETIC'?'SYNTHETIC':'REVIEWED_SOURCE',createdAt:clock.windowEndUtc}));
  }
  return {...c,...clock,status:out.length?'REVIEWED_CANDIDATES':'EVIDENCE_GAP',trends:out,background:observed.filter(s=>!inWindow(s.publishedAt,clock.windowStartUtc,clock.windowEndUtc)).map(s=>s.id),hostedModelRequests:0};
}
export function linkReview(root:string,selected:unknown,file:string,dataset:Dataset='OBSERVED') {
  const c=context(root,selected,dataset),input=z.strictObject({observationId:z.string(),evidenceId:z.string()}).parse(localInput(root,c.tenant,file,'research'));
  const raw=list(root,c.tenant,'source',dataset).find(s=>s.id===input.observationId),reviewed=usable(root,c.tenant,dataset,input.evidenceId)[0];
  if(!raw||!reviewed)throw new GtmError('EVIDENCE_GAP','Source observation and current review required',4);
  const observation=Observation.parse(raw);
  if(observation.status!=='COLLECTED'||observation.uri!==reviewed.source.uri||reviewed.claims.some(claim=>!observation.excerpt.includes(claim)))throw new GtmError('REVIEW_BINDING','Reviewed claim must be an exact collected source excerpt',4);
  const {id:_id,createdAt:_at,...base}=observation;
  return Observation.parse(save(root,c.tenant,'source',{...base,evidenceId:reviewed.source.id,reviewId:reviewed.review.id},dataset));
}
export function createBrief(root:string,selected:unknown,topicId:string,dataset:Dataset='OBSERVED') {
  const c=context(root,selected,dataset);const topic=list(root,c.tenant,'opportunity',dataset).reverse().find(r=>r.id===topicId||r.topicId===topicId);
  if(!topic)throw new GtmError('EVIDENCE_GAP','Select an existing reviewed opportunity',4);
  const ids=z.array(z.string()).nonempty().parse(topic.sourceIds),all=usable(root,c.tenant,dataset),sources=all.filter(s=>ids.includes(s.source.id));
  if(sources.length!==ids.length)throw new GtmError('EVIDENCE_GAP','Selected opportunity sources are not currently reviewed',4);
  const publicationEvidence=topic.temporalScope==='ROLLING_30D'?publicationCoverage(root,c.tenant,ids,dataset):undefined;
  const document={topicId:String(topic.topicId),opportunityId:topic.id,...(publicationEvidence?{publicationEvidence}:{}),title:String(topic.title),angle:String(topic.safeAngle??topic.title),audience:c.tenant==='founder'?'Engineers and ecosystem builders':'Eligible creators and traders',
    cta:c.tenant==='founder'?'Discuss the inspectable engineering constraint':'Inspect the testnet mechanics and provide structured feedback',
    sourceIds:ids,sourceSetSha256:hashObject(sources.map(s=>({source:hashObject(s.source),review:hashObject(s.review)}))),
    claims:sources.flatMap(s=>s.claims.map(statement=>({statement,evidenceId:s.source.id,evidenceSha256:hashObject(s.source)}))),
    riskNotes:['Unaudited testnet scope; historical receipts do not establish current liquidity, demand or production readiness.','Human editorial and authenticity review required.'],
    temporalScope:topic.temporalScope==='BACKGROUND'?'BACKGROUND':'ROLLING_30D',approvalStatus:'HOLD',humanReview:'PENDING',publicationAuthorized:false,label:dataset==='SYNTHETIC'?'SYNTHETIC':'REVIEWED_SOURCE'};
  return Brief.parse(save(root,c.tenant,'brief',document,dataset));
}
export function selectedBrief(root:string,selected:unknown,id:string,dataset:Dataset='OBSERVED',at?:Date) {
  const c=context(root,selected,dataset),raw=list(root,c.tenant,'brief',dataset).find(r=>r.id===id);if(!raw)throw new GtmError('EVIDENCE_GAP','Brief is absent in selected tenant',4);
  const brief=Brief.parse(raw),sources=usable(root,c.tenant,dataset,undefined,at??new Date()).filter(s=>brief.sourceIds.includes(s.source.id));
  if(sources.length!==brief.sourceIds.length||hashObject(sources.map(s=>({source:hashObject(s.source),review:hashObject(s.review)})))!==brief.sourceSetSha256)throw new GtmError('INPUT_CHANGED','Selected source or review changed/expired',4);
  if(brief.temporalScope==='ROLLING_30D'){
    if(!brief.publicationEvidence)throw new GtmError('WINDOW_EVIDENCE','Rolling brief lacks frozen publication evidence',4);
    publicationCoverage(root,c.tenant,brief.sourceIds,dataset,at?window30(at):currentWindow(root,c.tenant,dataset),at);
    if(hashObject(publicationCoverage(root,c.tenant,brief.sourceIds,dataset,brief.publicationEvidence,at))!==hashObject(brief.publicationEvidence))throw new GtmError('INPUT_CHANGED','Frozen publication evidence changed',4);
  }
  return brief;
}
