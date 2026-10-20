#!/usr/bin/env node
// Explicit source-review session: only the listed exact source statements are admitted.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { list } from '../dist/packages/v3/src/intelligence/store.js';
import { ingestEvidence, reviewEvidence } from '../dist/packages/v3/src/evidence.js';
import { linkReview, createBrief } from '../dist/packages/v3/src/intelligence/research.js';
import { opportunities } from '../dist/packages/v3/src/intelligence/opportunities.js';
import { sha256, hashObject } from '../dist/packages/observability/src/index.js';

const root=process.cwd();
const productClaims=[
  'RetroPick carries community tokens through onchain bonding discovery and protected graduation into Kuru orderbook trading.',
  'Current scope is an unaudited Monad Testnet candidate; market depth and demand remain market-dependent.',
  'Historical team functional-test receipts demonstrate launch, curve trading, Kuru graduation and two-wallet order/fill/cancel; they are not organic volume or present orderbook depth.',
  'Factory → single-ledger Coordinator → venue executor keeps lifecycle authority separate from venue work.',
  'Exact integer terminal-quote constraints preserve completion liveness across valid trade histories; graduation LP/excess assets enter a permanent bound lock.',
];
const kuruClaims=[
  'Kuru is a decentralized spot exchange built on Monad.',
  'You can buy and sell tokens through an onchain order book, choosing the price and amount you want to trade.',
  'Orders match against available liquidity, with better prices executing first.',
  'Your order’s settings determine whether an unfilled amount stays open or is canceled.',
];
function put(path,value){mkdirSync(join(root,path,'..'),{recursive:true});const text=JSON.stringify(value,null,2)+'\n';if(existsSync(join(root,path)))throw new Error('Refusing to overwrite Day0 input: '+path);writeFileSync(join(root,path),text,{flag:'wx'});}
const results=[];
for(const tenant of ['retropick','founder']){
  const all=list(root,tenant,'source').filter(s=>s.status==='COLLECTED');const sourceIds=[];
  for(const [provider,statements] of [['retropick-product',productClaims],['kuru-docs',kuruClaims]]){
    const observation=all.find(s=>s.sourceId===provider&&statements.every(q=>s.excerpt.includes(q)));
    if(!observation)throw new Error('Required real source or exact excerpts missing for '+tenant+'/'+provider);
    const text=statements.join('\n'),suffix=hashObject({observationId:observation.id,text}).slice(0,12),id=`${tenant}-v4-${provider}-${suffix}`;
    const card={id,tenant,title:provider==='kuru-docs'?'Kuru orderbook mechanics':'RetroPick source-pinned testnet and engineering scope',uri:observation.uri,
      revision:observation.responseSha256,observedAt:observation.retrievedAt,expiresAt:new Date(Date.parse(observation.retrievedAt)+14*86400000).toISOString(),text,contentSha256:sha256(text),license:observation.license,statements};
    const file=`research/inbox/${tenant}/${id}.json`;put(file,card);const source=ingestEvidence(root,tenant,file);
    const review={evidenceId:id,evidenceSha256:source.sha256,classification:'REVIEWED_SOURCE',actor:'source-reviewer',permittedClaims:statements,authenticFirstPerson:false};
    const reviewFile=`research/inbox/${tenant}/${id}-review.json`;put(reviewFile,review);reviewEvidence(root,tenant,reviewFile);
    const linkFile=`research/inbox/${tenant}/${id}-link.json`;put(linkFile,{observationId:observation.id,evidenceId:id});linkReview(root,tenant,linkFile);
    sourceIds.push(id);
  }
  const topicId=`${tenant}-v4-day0-${hashObject(sourceIds).slice(0,10)}`;
  const input={tenant,topicId,title:tenant==='retropick'?'A token launch is not the end of the market':'Why graduation needs exact accounting and proof of completion',
    safeAngle:tenant==='retropick'?'Understand bonding discovery, graduation and the boundary of liquidity claims':'Inspect accounting boundaries, completion evidence and retry constraints',
    sourceIds,temporalScope:'BACKGROUND',features:{evidenceQuality:0.9,brandFit:1,timelyDiscussion:0,educationalUtility:0.95,novelty:0.5,feasibleCta:0.9},risk:0.3,
    counterEvidence:['Historical testnet receipts do not prove present depth, organic demand or mainnet readiness.','Primary documentation is not an independent security audit.'],
    counterargument:'Mechanism correctness alone does not establish market quality or user demand.'};
  const opportunityFile=`research/inbox/${tenant}/${topicId}-opportunity.json`;put(opportunityFile,input);opportunities(root,tenant,'OBSERVED',opportunityFile);
  const brief=createBrief(root,tenant,topicId);results.push({tenant,topicId,briefId:brief.id,sourceIds,approvalStatus:'HOLD',temporalScope:'BACKGROUND',reason:'First-party mechanism sources lack verified publication dates inside rolling30days'});
}
const path=`runtime/v4-day0-prepared-${Date.now()}.json`;put(path,{schemaVersion:4,results});console.log(JSON.stringify({path,results},null,2));
