import { existsSync } from 'node:fs';
import { GtmError } from '../../observability/src/index.js';
import { safePath } from '../../core/src/workspace.js';
import { context, localInput } from '../../v3/src/common.js';
import { BufferPublisherAdapter, credentialStatus } from './buffer.js';
import { PublishingService, approvalFile } from './publishing.js';
import { PublishingStore } from './store.js';
import { acceptance, verifyPublic } from './acceptance.js';
import { calendar, daily, researchQueue, weekly, importEvents, postingPolicy } from './gtm.js';

export async function routeV5(root:string,words:string[],values:Record<string,unknown>):Promise<{status:string;data:unknown;exitCode?:number}|undefined> {
  const key=words.join(' ');
  const supported=['provider doctor','provider channels','publishing packet','publishing preview','publishing approve','publishing schedule','publishing reconcile','publishing cancel','publishing refill','publishing tick','publishing metrics','publishing acceptance','publishing calendar','daily today','research conversations','research prospects','metrics product-import','analytics learning'];
  const v5Calendar=key==='content calendar' && values.days==='7';
  if(!supported.includes(key) && !v5Calendar)return undefined;
  if(typeof values.brand!=='string')throw new GtmError('BRAND_REQUIRED','Explicit --brand founder|retropick required',2);
  const synthetic=values.synthetic===true || values.dataset==='SYNTHETIC';
  const tenant=context(root,values.brand,synthetic?'SYNTHETIC':'OBSERVED').tenant;
  const str=(name:string)=>{const v=values[name];if(typeof v!=='string'||!v)throw new GtmError('ARGUMENT_REQUIRED',`--${name} required`,2);return v;};
  if(values.provider && values.provider!=='buffer')throw new GtmError('UNSUPPORTED','Buffer is the only active provider; Postiz requires separate authentication',4);
  if(values.execute && (values['dry-run'] || values.offline))throw new GtmError('MODE_CONFLICT','--execute conflicts with --dry-run or --offline',2);
  const service=new PublishingService(root,tenant,new BufferPublisherAdapter(root,undefined,synthetic,tenant),synthetic);
  let data:unknown;
  if(v5Calendar || key==='publishing calendar')data=calendar(root,tenant,typeof values.from==='string'?values.from:undefined,new Date(),synthetic?'SYNTHETIC':'OBSERVED');
  else if(key==='daily today')data=daily(root,tenant,typeof values.file==='string'?values.file:undefined,new Date(),synthetic?'SYNTHETIC':'OBSERVED');
  else if(key==='research conversations' || key==='research prospects')data=researchQueue(root,tenant,key.endsWith('conversations')?'conversations':'prospects',synthetic?'SYNTHETIC':'OBSERVED',new Date(),typeof values.file==='string'?values.file:undefined);
  else if(key==='analytics learning')data=weekly(root,tenant,synthetic);
  else if(key==='metrics product-import')data=importEvents(root,tenant,str('file'),synthetic);
  else if(key==='publishing packet')data=service.createPacket(localInput(root,tenant,str('file'),'distribution'));
  else if(key==='publishing approve')data=service.approve(approvalFile(root,tenant,str('file')));
  else if(key==='publishing acceptance' && !values.verify)data=acceptance(root,tenant,synthetic);
  else if(key==='publishing schedule' && !values.execute)data=await service.schedule(str('approved-id'),false);
  else if(key==='publishing cancel' && !values.execute)data=await service.cancel(str('job'),false);
  else if(key==='publishing refill' && !values.execute)data=await service.refill(false);
  else if(key==='publishing tick' && !values.execute)data=await service.tick(false);
  else {
    // No live fixture mode: injected adapters are available only through typed test entrypoints.
    if(synthetic || values.offline)return {status:'BLOCKED',exitCode:4,data:{tenant,status:'BLOCKED_OFFLINE_OR_SYNTHETIC',networkRequests:0}};
    const credential=credentialStatus(new Date(),tenant);
    if(!credential.present || credential.status==='EXPIRED' || credential.status==='BLOCKED_EXPIRY_UNKNOWN')return {status:'BLOCKED',exitCode:4,data:{tenant,provider:'buffer',...credential,
      blocker:credential.status,action:'Provision buffer-api-key, buffer-expiry and buffer-tenant via dedicated per-tenant publisher service credentials. Run scripts/provision_buffer.py from a private terminal. Never paste keys in chat.',identity:'NOT_VERIFIED',networkRequests:0}};
    if(key==='provider doctor') {
      const channels=await service.channels();
      data={tenant,provider:'buffer',credential:credential.status,status:'IDENTITY_VERIFIED_WRITE_NOT_PROBED',channels,postingPolicy:postingPolicy(channels[0]),writeCapability:'NOT_PROBED_WITHOUT_EXACT_OWNER_APPROVAL'};
    }
    else if(key==='provider channels')data={tenant,channels:await service.channels()};
    else if(key==='publishing preview')data=await service.preview(str('packet-id'),str('target-zone'),str('local-slot'));
    else if(key==='publishing schedule')data=await service.schedule(str('approved-id'),true);
    else if(key==='publishing refill')data=await service.refill(true);
    else if(key==='publishing tick')data=await service.tick(true);
    else if(key==='publishing cancel')data=await service.cancel(str('job'),true);
    else if(key==='publishing metrics')data=await service.metrics(str('job'));
    else if(key==='publishing acceptance')data=await verifyPublic(service,str('job'),typeof values.url==='string'?values.url:undefined);
    else if(key==='publishing reconcile') {
      let id=typeof values.job==='string'?values.job:undefined;
      if(!id && values['provider-post-id']) {
        const path=safePath(root,`runtime/state/${tenant}/publishing-observed.sqlite`);
        if(!existsSync(path))throw new GtmError('JOB_MISSING','No publishing jobs for selected tenant',4);
        using store=new PublishingStore(root,tenant,false,true);id=store.jobs().find(j=>j.providerPostId===values['provider-post-id'])?.id;
      }
      if(!id)throw new GtmError('JOB_MISSING','Supply --job or an existing --provider-post-id for this tenant',4);
      data=await service.reconcile(id);
    }
  }
  return {status:'LOCAL_RESULT',data};
}
