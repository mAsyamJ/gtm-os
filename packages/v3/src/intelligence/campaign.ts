import { GtmError, hashObject } from '../../../observability/src/index.js';
import { context, artifact, type Dataset } from '../common.js';
import { draftBriefContent, humanize } from '../editorial.js';
import { creativePack } from '../creative.js';
import { manualPack, packetById } from '../distribution.js';
import { runCycle } from '../workflows.js';
import { selectedBrief, createBrief } from './research.js';
import { routedSelection } from './model.js';
import { intelligenceDiagrams } from './creative.js';
import { list, save } from './store.js';

export async function briefPack(root:string,selected:unknown,briefId:string,dataset:Dataset='OBSERVED',modelMode:unknown='offline',budgetId?:unknown) {
  const c=context(root,selected,dataset),brief=selectedBrief(root,c.tenant,briefId,dataset);
  if(!['offline','router'].includes(String(modelMode)))throw new GtmError('MODEL_MODE','Explicit offline or router mode required',2);
  const selection=modelMode==='router'?await routedSelection(root,c.tenant,brief,budgetId,dataset):undefined;
  const posts:ReturnType<typeof humanize>[]=[],threads:ReturnType<typeof humanize>[]=[];
  for(let i=0;i<7;i++){
    const post=i<5,j=post?i:i-5;
    const draft=draftBriefContent(root,c.tenant,briefId,post?'post':'thread',j,dataset,post?selection?.posts[j]?.claimIndices:selection?.threads[j]?.claimIndices);
    const edited=humanize(root,c.tenant,draft.id,dataset);(post?posts:threads).push(edited);
  }
  return {...c,briefId,posts,threads,modelMode,editorialReview:'HUMAN_REQUIRED',receipt:artifact(root,c.tenant,'content-batch',{briefId,posts,threads})};
}
export async function campaign(root:string,selected:unknown,options:{briefId?:string;topicId?:string;key:string;dataset:Dataset;modelMode?:unknown;budgetId?:unknown}) {
  const c=context(root,selected,options.dataset);
  if(!options.key.startsWith(c.tenant+'-')||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}$/.test(options.key))throw new GtmError('CYCLE_SCOPE','Tenant-prefixed cycle key required',2);
  if(options.briefId&&options.topicId)throw new GtmError('SELECTION_CONFLICT','Choose brief-id or topic-id',2);
  const brief=options.briefId?selectedBrief(root,c.tenant,options.briefId,options.dataset):options.topicId?createBrief(root,c.tenant,options.topicId,options.dataset):undefined;
  if(!brief)throw new GtmError('BRIEF_REQUIRED','Explicit topic or brief required',2);
  const previous=list(root,c.tenant,'campaign',options.dataset).find(v=>v.cycleKey===options.key);
  if(previous){
    if(previous.briefSha256!==hashObject(brief))throw new GtmError('INPUT_CHANGED','Campaign brief changed; use a new key',4);
    packetById(root,c.tenant,String(previous.packetId),options.dataset);
    return runCycle(root,c.tenant,options.key,options.dataset,id=>creativePack(root,c.tenant,id,options.dataset),{briefId:brief.id,draftId:String(previous.draftId)});
  }
  const pack=await briefPack(root,c.tenant,brief.id,options.dataset,options.modelMode??'offline',options.budgetId),draft=pack.threads[0]!;
  const extra=await intelligenceDiagrams(root,c.tenant,draft.id,options.dataset);
  const creative=await creativePack(root,c.tenant,draft.id,options.dataset,extra);
  const packet=manualPack(root,c.tenant,draft.id,options.dataset);
  const value=save(root,c.tenant,'campaign',{cycleKey:options.key,briefId:brief.id,briefSha256:hashObject(brief),draftId:draft.id,packetId:packet.id,
    content:pack.receipt,creative,extraFiles:extra,payloadSha256:packet.payloadSha256,manualDirectory:packet.directory,
    state:'AWAITING_OWNER_APPROVAL',approvalStatus:'HOLD',humanReview:'PENDING',label:options.dataset==='SYNTHETIC'?'SYNTHETIC':'REVIEWED_SOURCE'},options.dataset);
  const cycle=await runCycle(root,c.tenant,options.key,options.dataset,id=>creativePack(root,c.tenant,id,options.dataset),{briefId:brief.id,draftId:draft.id});
  return {...cycle,campaignId:value.id,manualDirectory:packet.directory,payloadSha256:packet.payloadSha256};
}
