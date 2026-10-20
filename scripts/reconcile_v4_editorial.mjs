#!/usr/bin/env node
// One bounded repair of the two recorded Day0 attempts; never resets reservations.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { list, save } from '../dist/packages/v3/src/intelligence/store.js';
import { selectedBrief } from '../dist/packages/v3/src/intelligence/research.js';
import { Selection } from '../dist/packages/v3/src/intelligence/model.js';
import { safePath } from '../dist/packages/core/src/workspace.js';
const exec=promisify(execFile),root=process.cwd();
const environment={PATH:'/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'};
const report=JSON.parse((await exec('/home/ubuntu/.local/bin/codex-router',['report'],{env:environment,maxBuffer:8*1024*1024})).stdout);
const prior=report.tasks.find(t=>t.id==='task-827af1a64ba14253');
if(!prior||prior.requests.length!==0)throw new Error('Recorded failed task has model requests; reconciliation denied');
if(existsSync('/home/ubuntu/codex-model-router/DISABLED'))throw new Error('Router kill switch active');
for(const [tenant,priorId] of [['founder','founder-model-run-1e21770e56abae0d9a32d7da'],['retropick',null]]){
  const attempts=list(root,tenant,'model-run');
  const failed=priorId?attempts.find(t=>t.id===priorId):attempts.find(t=>t.status==='BLOCKED');
  if(!failed||failed.status!=='BLOCKED'||attempts.filter(t=>t.status==='BLOCKED').length!==1)throw new Error('Unexpected prior attempt scope');
  if(attempts.some(t=>t.retryOf===failed.id)){console.log(JSON.stringify({tenant,status:'REPAIR_ALREADY_RECORDED'}));continue;}
  const brief=selectedBrief(root,tenant,failed.briefId);
  const directory=safePath(root,failed.directory);
  const prompt='Read brief.json only. Write candidate.json only. Do not read other directories, use network/tools beyond reading and writing these two local files, delegate, inspect credentials, or change settings. This is editorial ordering of exact reviewed claims, not free-form writing. JSON must be exactly {"posts":[{"claimIndices":[5]},{"claimIndices":[7]},{"claimIndices":[5]},{"claimIndices":[7]},{"claimIndices":[5]}],"threads":[{"claimIndices":[0,1,2,3,4,5]},{"claimIndices":[3,4,5,6,7,8]}]}. You may reorder valid indices inside the two threads, keeping all six indices of each thread. Do not add prose or facts. The intentionally repeated short post claims preserve standard post length; hooks differ outside this selection.';
  let status='BLOCKED',selection=null,routerTaskId=null;
  try{
    const result=await exec('/home/ubuntu/.local/bin/codex-router',['run',prompt,'--repo',directory,'--tier','economy','--runtime','codex','--category','content_writing','--risk','low','--max-calls','3','--max-usd','0.05','--no-escalate','--check',`/usr/bin/python3 ${safePath(root,'scripts/validate_v4_editorial.py')} ${directory}`],{env:environment,timeout:180000,maxBuffer:1048576});
    const first=result.stdout.split('\n').find(l=>l.startsWith('{'));if(first)routerTaskId=JSON.parse(first).task_id??null;
    selection=Selection.parse(JSON.parse(readFileSync(safePath(root,`${failed.directory}/candidate.json`),'utf8')));
    if([...selection.posts,...selection.threads].some(item=>item.claimIndices.some(i=>i>=brief.claims.length)))throw new Error('Invalid claim reference');
    status='COMPLETED';
  }catch{status='BLOCKED';}
  const receipt=save(root,tenant,'model-run',{briefId:brief.id,status,selection,retryOf:failed.id,maxModelCalls:3,failedPreflightAttempts:1,
    quota:failed.quota,routerTaskId,estimatedReservationUsd:0.05,actualSubscriptionUsd:null,
    reconciliation:'Original reservation retained. Founder unknown-category classification preceded task creation. Original RetroPick task report proves zero requests. One repair leaves at most3 model calls per tenant, counting original failure within4.',approvalStatus:'HOLD'});
  console.log(JSON.stringify({tenant,status,receiptId:receipt.id,routerTaskId}));
}
