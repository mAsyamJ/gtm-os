import { z } from 'zod';
import { readStructured } from '../../../core/src/workspace.js';
import { GtmError } from '../../../observability/src/index.js';
import { context, localInput, type Dataset } from '../common.js';
import { usable } from '../evidence.js';
import { trends } from './research.js';
import { save, list } from './store.js';
import { entities } from './seeds.js';
import { Entity, Edge } from './contracts.js';

const Features=z.object({evidenceQuality:z.number().min(0).max(1),brandFit:z.number().min(0).max(1),timelyDiscussion:z.number().min(0).max(1),educationalUtility:z.number().min(0).max(1),novelty:z.number().min(0).max(1),feasibleCta:z.number().min(0).max(1)});
export function rank(root:string,features:unknown,risk:number) {
  const values=Features.parse(features),config=z.object({weights:Features,riskPenalty:z.number().min(0).max(1)}).parse(readStructured(root,'config/v4-ranking.json'));
  if(Math.abs(Object.values(config.weights).reduce((a,b)=>a+b,0)-1)>0.000001||!Number.isFinite(risk)||risk<0||risk>1)throw new GtmError('RANKING_CONFIG','Normalized weights and risk required',2);
  return {score:Math.round(10000*Math.max(0,Math.min(1,Object.entries(values).reduce((sum,[k,v])=>sum+v*config.weights[k as keyof typeof values],0)-risk*config.riskPenalty)))/100,
    features:values,weights:config.weights,risk,interpretation:'EDITORIAL_HEURISTIC_NOT_OBSERVED_INFLUENCE',engagement:'UNAVAILABLE_NOT_USED_FOR_SCORE'};
}
export function opportunities(root:string,selected:unknown,dataset:Dataset='OBSERVED',file?:string) {
  const c=context(root,selected,dataset),reviewed=usable(root,c.tenant,dataset);
  if(file){
    const input=z.strictObject({tenant:z.enum(['founder','retropick']),topicId:z.string(),title:z.string(),safeAngle:z.string(),sourceIds:z.array(z.string()).nonempty(),
      temporalScope:z.enum(['BACKGROUND','ROLLING_30D']),features:Features,risk:z.number().min(0).max(1),counterEvidence:z.array(z.string()),counterargument:z.string()}).parse(localInput(root,c.tenant,file,'research'));
    if(input.tenant!==c.tenant||!input.topicId.startsWith(c.tenant+'-')||input.sourceIds.some(id=>!reviewed.some(s=>s.source.id===id)))throw new GtmError('EVIDENCE_GAP','Opportunity sources must be reviewed in selected tenant',4);
    if(input.temporalScope==='ROLLING_30D'){
      const eligible=trends(root,c.tenant,dataset).trends.flatMap(t=>t.sourceIds);
      if(input.sourceIds.some(id=>!eligible.includes(id)))throw new GtmError('WINDOW_EVIDENCE','Rolling opportunity lacks publication-dated source coverage',4);
    }
    if(input.risk>=0.7&&new Set(reviewed.filter(s=>input.sourceIds.includes(s.source.id)).map(s=>new URL(s.source.uri).hostname)).size<2)throw new GtmError('TRIANGULATION_REQUIRED','Controversial or market-moving angle requires independent sources',4);
    save(root,c.tenant,'opportunity',{...input,ranking:rank(root,input.features,input.risk),label:dataset==='SYNTHETIC'?'SYNTHETIC':'REVIEWED_SOURCE',reviewStatus:'SOURCE_REVIEWED_EDITORIAL_PENDING',approvalStatus:'HOLD'},dataset);
  }
  const values=list(root,c.tenant,'opportunity',dataset).filter(v=>z.array(z.string()).parse(v.sourceIds).every(id=>reviewed.some(s=>s.source.id===id)))
    .sort((a,b)=>Number((b.ranking as {score:number}).score)-Number((a.ranking as {score:number}).score));
  return {...c,status:values.length?'EDITORIAL_REVIEW_REQUIRED':'EVIDENCE_GAP',opportunities:values.slice(0,10),unavailableEngagement:'UNAVAILABLE',hostedModelRequests:0};
}
export function reviewEntity(root:string,selected:unknown,file:string,dataset:Dataset='OBSERVED') {
  const c=context(root,selected,dataset),input=z.strictObject({tenant:z.enum(['founder','retropick']),canonicalId:z.string(),evidenceId:z.string(),identityClaim:z.string(),roleClaim:z.string().nullable(),tier:z.enum(['A','B','C','D']),xHandle:z.string().nullable()}).parse(localInput(root,c.tenant,file,'research'));
  const old=entities(root,c.tenant,dataset).find(e=>e.canonicalId===input.canonicalId),source=usable(root,c.tenant,dataset,input.evidenceId)[0];
  if(input.tenant!==c.tenant||!old||!source||!source.claims.includes(input.identityClaim)||!input.identityClaim.toLowerCase().includes(old.name.toLowerCase()))throw new GtmError('IDENTITY_EVIDENCE','Exact reviewed identity statement required',4);
  if(input.roleClaim&&(!source.claims.includes(input.roleClaim)||!input.roleClaim.toLowerCase().includes(old.organization.toLowerCase())))throw new GtmError('ROLE_EVIDENCE','Exact current organization/role statement required',4);
  if(input.xHandle&&(!/^@[A-Za-z0-9_]{1,15}$/.test(input.xHandle)||!source.source.text.includes(`https://x.com/${input.xHandle.slice(1)}`)))throw new GtmError('HANDLE_EVIDENCE','Official source must contain exact public profile link',4);
  const {id:_id,createdAt:_at,...base}=old;
  const value=Entity.parse(save(root,c.tenant,'entity',{...base,label:dataset==='SYNTHETIC'?'SYNTHETIC':'REVIEWED_SOURCE',identityStatus:'REVIEWED_SOURCE',roleStatus:input.roleClaim?'REVIEWED_SOURCE':'UNKNOWN',sourceIds:[...new Set([...old.sourceIds,input.evidenceId])],reviewIds:[...new Set([...old.reviewIds,String(source.review.id)])],tier:input.tier,xHandle:input.xHandle,verifiedAt:new Date().toISOString(),biasTags:['SOURCE_COVERAGE_BIAS']},dataset));
  if(value.organization&&input.roleClaim){const organization=entities(root,c.tenant,dataset).find(e=>e.name.toLowerCase()===value.organization.toLowerCase());
    if(organization){const edge=save(root,c.tenant,'edge',{from:value.canonicalId,to:organization.canonicalId,relation:'RELATES_TO',dimension:'Reviewed current organizational role; founding not inferred',sourceUrl:source.source.uri,retrievedAt:source.source.observedAt,confidence:0.8,evidenceIds:[source.source.id],reviewIds:[String(source.review.id)],label:dataset==='SYNTHETIC'?'SYNTHETIC':'REVIEWED_SOURCE'},dataset);Edge.parse(edge);}}
  return value;
}
