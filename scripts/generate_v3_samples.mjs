import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ingestEvidence, reviewEvidence } from '../dist/packages/v3/src/evidence.js';
import { draftContent, humanize } from '../dist/packages/v3/src/editorial.js';
import { creativePack } from '../dist/packages/v3/src/creative.js';
import { runCycle } from '../dist/packages/v3/src/workflows.js';
import { scorecards } from '../dist/packages/v3/src/analytics.js';
import { researchReplay } from '../dist/packages/v3/src/replay.js';
import { hashObject, sha256 } from '../dist/packages/observability/src/index.js';
const root=resolve(import.meta.dirname,'..');
const retrieved=JSON.parse(readFileSync(resolve(root,'runtime/v3-public-source-receipts.json'),'utf8'));
const today=new Date().toISOString().slice(0,10), observedAt=new Date(today).toISOString(),expiresAt=new Date(Date.parse(observedAt)+7*86400000).toISOString();
const receipt=[];
const claims={
  retropick:['The market creation layer for Monad.','Current scope is an unaudited Monad Testnet candidate; market depth and demand remain market-dependent.','Canonical Circle-USDC live smoke: BLOCKED_FUNDING.'],
  founder:['No reads or writes occur except within a transaction.','END TRANSACTION is an alias for COMMIT.','Transactions created using BEGIN...COMMIT do not nest.','For nested transactions, use the SAVEPOINT and RELEASE commands.'],
};
function immutableJson(path,value) {
  const text=JSON.stringify(value,null,2)+'\n'; const target=resolve(root,path);
  if(existsSync(target)&&readFileSync(target,'utf8')!==text) throw Error('Immutable generated input changed: '+path);
  mkdirSync(resolve(target,'..'),{recursive:true}); if(!existsSync(target))writeFileSync(target,text); return path;
}
for(const tenant of ['retropick','founder']) {
  const sourceReceipt=retrieved.find(s=>s.name===(tenant==='retropick'?'retropick-readme':'sqlite-transactions'));
  const raw=readFileSync(resolve(root,sourceReceipt.path),'utf8');
  if(sha256(raw)!==sourceReceipt.sha256)throw Error('Source snapshot changed');
  const normalized=raw.replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').replace(/\*\*/g,'').replace(/\s+/g,' ');
  for(const statement of claims[tenant])if(!normalized.includes(statement))throw Error('Unsupported source statement: '+statement);
  const sourceKey=tenant+'-source-'+today.replaceAll('-','')+'-'+sourceReceipt.sha256.slice(0,8);
  const input={id:sourceKey,tenant,title:tenant==='retropick'?'Pinned RetroPick repository scope':'SQLite transaction control reference',
    uri:sourceReceipt.uri,revision:tenant==='retropick'?'464dca136e9765d638e742a810ab58af0e911376':sourceReceipt.sha256,
    observedAt,expiresAt,text:claims[tenant].join('\n'),contentSha256:sha256(claims[tenant].join('\n')),
    license:tenant==='retropick'?'MIT; pinned repository LICENSE receipt':'PUBLIC_DOMAIN; SQLite copyright.html receipt',statements:claims[tenant]};
  const source=ingestEvidence(root,tenant,immutableJson(`research/inbox/${tenant}/${sourceKey}.json`,input));
  const review=reviewEvidence(root,tenant,immutableJson(`research/inbox/${tenant}/${sourceKey}-review.json`,{evidenceId:source.id,evidenceSha256:source.sha256,classification:'REVIEWED_SOURCE',actor:'source-reviewer',permittedClaims:claims[tenant],authenticFirstPerson:false}));
  const posts=[],threads=[];
  for(let i=0;i<7;i++) {
    const d=draftContent(root,tenant,i<5?'post':'thread',source.id,'OBSERVED',i<5?i:i-5);
    const edited=humanize(root,tenant,d.id); (i<5?posts:threads).push(edited);
  }
  const key=tenant+'-week-'+today.replaceAll('-','');
  const cycle=await runCycle(root,tenant,key,'OBSERVED',id=>creativePack(root,tenant,id));
  const report=scorecards(root,tenant);const replay=researchReplay(root,tenant);
  const result={tenant,source,sourceReview:review,publicRetrieval:sourceReceipt,posts,threads,cycle,report,replay,
    limitations:['No owner experience or voice calibration invented','Source review establishes documentary statements, not live product verification',
      'Creative is editorial prototype geometry, not real UI footage','Owner approval, manual publication and actual measurement are pending'],
    externalWrites:0,paidSocialApiCalls:0};
  const directory=`runtime/v3/${tenant}/campaign/${hashObject(result)}`;mkdirSync(resolve(root,directory),{recursive:true});
  immutableJson(directory+'/campaign.json',result);
  receipt.push({tenant,sourceId:source.id,posts:posts.length,threads:threads.length,cycleState:cycle.state,packetId:cycle.packetId,draftId:cycle.draftId,campaign:directory+'/campaign.json',campaignSha256:hashObject(result),replayJobs:replay.jobs.length,actualPublications:0,observedBusinessOutcomes:'UNAVAILABLE'});
}
const file=`docs/evidence/v3-campaigns-${today}-${hashObject(receipt).slice(0,12)}.json`;
immutableJson(file,{revision:'v3-r1',status:'OWNER_REVIEW_REQUIRED',campaigns:receipt,externalWrites:0,paidSocialApiCalls:0});
console.log(JSON.stringify({receipt:file,campaigns:receipt},null,2));
