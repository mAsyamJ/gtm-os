#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { list,save } from '../dist/packages/v3/src/intelligence/store.js';
import { entities } from '../dist/packages/v3/src/intelligence/seeds.js';
import { reviewEntity } from '../dist/packages/v3/src/intelligence/opportunities.js';
import { synthesis,executeV4Workflow } from '../dist/packages/v3/src/intelligence/workflows.js';
import { ingestEvidence,reviewEvidence,usable } from '../dist/packages/v3/src/evidence.js';
import { records } from '../dist/packages/v3/src/common.js';
import { hashObject,sha256 } from '../dist/packages/observability/src/index.js';

const root=process.cwd(),stamp=new Date().toISOString().replace(/[:.]/g,'-');
function out(path,value){mkdirSync(join(root,path,'..'),{recursive:true});if(existsSync(join(root,path)))throw new Error('Append-only export exists');writeFileSync(join(root,path),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return {path,sha256:sha256(readFileSync(join(root,path)))};}
function node(tenant,name,types,source){
  const existing=entities(root,tenant,'OBSERVED').find(e=>e.name===name);if(existing)return existing;
  return save(root,tenant,'entity',{canonicalId:`public-${hashObject({type:types[0],name:name.toLowerCase(),organization:''}).slice(0,24)}`,name,types,organization:'',topics:['market-structure'],sourceUrls:[source.source.uri],identityStatus:'REVIEWED_SOURCE',roleStatus:'UNKNOWN',xHandle:null,tier:'UNCLASSIFIED',seed:{},sourceIds:[source.source.id],reviewIds:[source.review.id],intendedUse:'RESEARCH_AND_ATTRIBUTED_COMMENTARY',biasTags:['DOCUMENTARY_SOURCE_ONLY'],verifiedAt:new Date().toISOString(),label:'REVIEWED_SOURCE'});
}
const tenantReports=[];
for(const tenant of ['retropick','founder']){
  // Each enrichment claim below is checked against a real collected excerpt.
  const observations=list(root,tenant,'source').filter(s=>s.status==='COLLECTED');
  for(const [name,provider,identityClaim,roleClaim,tier] of [
    ['Haseeb Qureshi','haseeb-public-about','About - haseeb qureshi','I’m a managing partner at Dragonfly , a crypto venture fund.','A'],
    ['Hayden Adams','uniswap-about','In 2018, Hayden Adams created the Uniswap Protocol, a decentralized protocol that introduced a new way to exchange value online.',null,'A'],
    ['Keone Hon','monad-foundation','Keone Hon and Eunice Giarta will be joining the Monad Foundation.',null,'A'],
  ]){
    const old=entities(root,tenant,'OBSERVED','person').find(e=>e.name===name),observation=observations.find(s=>s.sourceId===provider&&[identityClaim,...(roleClaim?[roleClaim]:[])].every(q=>s.excerpt.includes(q)));
    if(!old||!observation||old.identityStatus==='REVIEWED_SOURCE')continue;
    const statements=[identityClaim,...(roleClaim?[roleClaim]:[])],text=statements.join('\n'),id=`${tenant}-v4-person-${hashObject({name,text}).slice(0,12)}`;
    const card={id,tenant,title:`Public identity evidence: ${name}`,uri:observation.uri,revision:observation.responseSha256,observedAt:observation.retrievedAt,expiresAt:new Date(Date.parse(observation.retrievedAt)+14*86400000).toISOString(),text,contentSha256:sha256(text),license:observation.license,statements};
    const input=`research/inbox/${tenant}/${id}.json`;out(input,card);const source=ingestEvidence(root,tenant,input);
    const reviewFile=`research/inbox/${tenant}/${id}-review.json`;out(reviewFile,{evidenceId:id,evidenceSha256:source.sha256,classification:'REVIEWED_SOURCE',actor:'source-reviewer',permittedClaims:statements,authenticFirstPerson:false});reviewEvidence(root,tenant,reviewFile);
    const entityFile=`research/inbox/${tenant}/${id}-identity.json`;out(entityFile,{tenant,canonicalId:old.canonicalId,evidenceId:id,identityClaim,roleClaim,tier,xHandle:null});reviewEntity(root,tenant,entityFile);
  }
  const product=usable(root,tenant).find(s=>s.source.title==='RetroPick source-pinned testnet and engineering scope');
  if(product){
    const retropick=node(tenant,'RetroPick',['Project'],product),kuru=entities(root,tenant,'OBSERVED').find(e=>e.name==='Kuru');
    if(kuru)save(root,tenant,'edge',{from:retropick.canonicalId,to:kuru.canonicalId,relation:'USES_INFRA',dimension:'Documented testnet graduation and secondary orderbook; not current market depth',sourceUrl:product.source.uri,retrievedAt:product.source.observedAt,confidence:0.85,evidenceIds:[product.source.id],reviewIds:[product.review.id],label:'REVIEWED_SOURCE'});
    for(const claim of product.claims){const target=node(tenant,claim.slice(0,220),['Claim'],product);save(root,tenant,'edge',{from:retropick.canonicalId,to:target.canonicalId,relation:'RELATES_TO',dimension:'Exact reviewed documentary statement, not independent live verification',sourceUrl:product.source.uri,retrievedAt:product.source.observedAt,confidence:0.85,evidenceIds:[product.source.id],reviewIds:[product.review.id],label:'REVIEWED_SOURCE'});}
  }
  const directory=`research/trends/${tenant}/${stamp}`,report=synthesis(root,tenant);
  const domainFiles=report.domains.map(domain=>out(`${directory}/${domain.pillar}.md`,`# ${domain.pillar}\n\nStatus: ${domain.status}. Tenant: ${tenant}.\n\nResearch question: ${domain.question}\n\n${domain.sources.map(s=>`- ${s.uri} — source ${s.id}; revision ${s.revision}`).join('\n')}\n\n${domain.facts.length?'Reviewed excerpts are available in the scoped source cards.':'No reviewed source supports this pillar yet.'}\n\nCoverage is partial; no market trend or customer pain is inferred from missing data.\n`));
  const synthesisFile=out(`${directory}/synthesis.json`,report);
  const watch=await executeV4Workflow(root,tenant,'influencer-expert-watchlist',{},'OBSERVED');
  const watchFile=out(`research/registry/${tenant}-watchlist-${stamp}.json`,watch);
  const competition=await executeV4Workflow(root,tenant,'launchpad-competitor-intel',{},'OBSERVED');
  const competitorFile=out(`research/competitors/${tenant}/${stamp}.json`,competition);
  const campaign=list(root,tenant,'campaign').filter(c=>String(c.cycleKey).endsWith('-routed')).at(-1)??list(root,tenant,'campaign').at(-1);
  if(!campaign)throw new Error('Missing campaign');
  const batch=JSON.parse(readFileSync(join(root,campaign.content.path),'utf8'));
  const bundleDir=`runtime/v4/${tenant}/sprint-${stamp}`;
  const contentFiles=[...batch.posts,...batch.threads].map((draft,i)=>out(`${bundleDir}/${i<5?'post-'+(i+1):'thread-'+(i-4)}.txt`,draft.blocks.join('\n\n')+'\n\nHOLD — NOT APPROVED. Sources and immutable draft identity: '+draft.id+'\n'));
  const brief=list(root,tenant,'brief').find(b=>b.id===campaign.briefId);
  const editorial=out(`strategy/editorial/${tenant}/${stamp}.json`,brief);
  const bundle=out(`${bundleDir}/bundle.json`,{tenant,approvalStatus:'HOLD',campaignId:campaign.id,primaryPacketId:campaign.packetId,primaryPacketDirectory:campaign.manualDirectory,contentFiles,
    note:'Only the primary immutable packet binds an owner approval. Other post/thread candidates remain HOLD; selecting one requires its own creative and manual packet.'});
  const cards=usable(root,tenant),allSources=list(root,tenant,'source');
  tenantReports.push({tenant,reviewedSources:cards.length,realCoreSources:cards.filter(c=>c.source.id.includes('-v4-retropick-product-')||c.source.id.includes('-v4-kuru-docs-')).length,
    collectedObservations:allSources.filter(s=>s.status==='COLLECTED').length,domainFiles,synthesis:synthesisFile,watchlist:watchFile,competitorFile,editorial,bundle,
    campaignId:campaign.id,briefId:campaign.briefId,packetId:campaign.packetId,payloadSha256:campaign.payloadSha256,manualDirectory:campaign.manualDirectory,
    posts:batch.posts.length,threads:batch.threads.length,postCharacterCounts:batch.posts.map(p=>p.blocks.join('\n\n').length),
    verifiedPeopleCurrentRole:watch.verifiedPeople,peopleVerificationShortfall:watch.remaining,approvalStatus:'HOLD',
    ownerReportedPublications:records(root,tenant,'publication').filter(p=>p.state==='OWNER_REPORTED_PUBLISHED').length,
    models:list(root,tenant,'model-run').map(m=>({id:m.id,status:m.status,routerTaskId:m.routerTaskId??null,estimatedReservationUsd:m.estimatedReservationUsd,actualSubscriptionUsd:null}))});
}
const route=JSON.parse(execFileSync('/home/ubuntu/.local/bin/codex-router',['report'],{encoding:'utf8',maxBuffer:8*1024*1024}));
const ids=tenantReports.flatMap(t=>t.models.map(m=>m.routerTaskId).filter(Boolean));
const routerTasks=route.tasks.filter(t=>ids.includes(t.id)).map(t=>({id:t.id,model:t.model,status:t.status,inputTokens:t.input_tokens,outputTokens:t.output_tokens,requests:t.requests.length}));
const receipt={schemaVersion:4,at:new Date().toISOString(),tenantReports,routerTasks,costs:{paidSocialCalls:0,estimatedReservationCeilingUsd:0.10,actualSubscriptionUsd:null,interpretation:'Reservations are not measured charges'},
  actualAutomaticPublications:0,verifiedBusinessOutcomes:'UNAVAILABLE',globalPromotionEnabled:false,remainingBlockers:['Owner editorial, authenticity, rights and creative approval','Owner-native publication and observed performance','14 fully current verified people target not met','Sealed improvement evaluation and promotion remain disabled']};
const receiptFile=out(`docs/evidence/v4-sprint-${stamp}.json`,receipt);console.log(JSON.stringify({receipt:receiptFile,tenantReports:tenantReports.map(t=>({tenant:t.tenant,packetId:t.packetId,manualDirectory:t.manualDirectory,bundle:t.bundle,postCharacterCounts:t.postCharacterCounts,verifiedPeopleCurrentRole:t.verifiedPeopleCurrentRole}))},null,2));
