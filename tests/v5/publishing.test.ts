import { copyFileSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { workspace, PROJECT } from '../phase-b/helpers.js';
import { hashObject, sha256, redact } from '../../packages/observability/src/index.js';
import { ingestEvidence, reviewEvidence, usable } from '../../packages/v3/src/evidence.js';
import { BufferPublisherAdapter, credentialStatus, boundedRequest } from '../../packages/v5/src/buffer.js';
import { PublishingService } from '../../packages/v5/src/publishing.js';
import { PublishingStore, ProviderBudget } from '../../packages/v5/src/store.js';
import { type Channel, type Envelope, type ProviderPost, type PublisherAdapter, ApprovalInput } from '../../packages/v5/src/contracts.js';
import { resolveSlot, wallTime } from '../../packages/v5/src/time.js';
import { acceptance, verifyOEmbed, exactPostUrl } from '../../packages/v5/src/acceptance.js';
import { calendar, daily, weekly, importEvents, researchQueue, postingPolicy } from '../../packages/v5/src/gtm.js';

let f: ReturnType<typeof workspace>;
let now:Date;
beforeEach(()=>{
  f=workspace();now=new Date();
  mkdirSync(join(f.root,'packages/v5'),{recursive:true});copyFileSync(join(PROJECT,'packages/v5/AGENTS.md'),join(f.root,'packages/v5/AGENTS.md'));
});
afterEach(()=>{f.cleanup();vi.unstubAllEnvs();vi.restoreAllMocks();});
function evidence(tenant:'founder'|'retropick'='founder') {
  const dir=`research/inbox/${tenant}`;mkdirSync(join(f.root,dir),{recursive:true});
  const text='A completion transition checks the bound receipt before advancing state.';
  const input={id:`${tenant}-v5-source`,tenant,title:'Technical source',uri:'https://example.org/technical',revision:'fixture-r1',observedAt:new Date(now.getTime()-60000).toISOString(),
    expiresAt:new Date(now.getTime()+7*86400000).toISOString(),text,contentSha256:sha256(text),license:'SYNTHETIC_FIXTURE',statements:[text]};
  writeFileSync(join(f.root,dir,'source.json'),JSON.stringify(input));
  const source=ingestEvidence(f.root,tenant,`${dir}/source.json`,'SYNTHETIC',now);
  writeFileSync(join(f.root,dir,'review.json'),JSON.stringify({evidenceId:source.id,evidenceSha256:source.sha256,classification:'REVIEWED_SOURCE',actor:'source-reviewer',permittedClaims:[text],authenticFirstPerson:false}));
  reviewEvidence(f.root,tenant,`${dir}/review.json`,'SYNTHETIC');
  const c=usable(f.root,tenant,'SYNTHETIC',undefined,now)[0]!;
  return {evidenceId:c.source.id,evidenceSha256:hashObject(c.source),reviewSha256:hashObject(c.review),statement:text};
}
function channel(tenant:'founder'|'retropick'='founder'):Channel {
  return {principalId:'owner-1',organizationId:'org-1',id:`channel-${tenant}`,name:tenant==='founder'?'iHateModelsss':'RetroPickMarket',service:'twitter',serviceId:`x-${tenant}`,
    isQueuePaused:false,isDisconnected:false,isLocked:false,allowedActions:['scheduleUpdates'],verifiedAt:now.toISOString()};
}
class Provider implements PublisherAdapter {
  readonly provider='buffer' as const;readonly synthetic=true;
  posts:ProviderPost[]=[];writes=0;pending=0;failAfter=false;wrong=false;delay:Promise<void>|undefined;
  async discoverChannels(tenant:'founder'|'retropick'){return [{...channel(tenant),...(this.wrong?{name:'someoneElse'}:{})}];}
  async probe(tenant:'founder'|'retropick'){return {status:'SYNTHETIC',channels:await this.discoverChannels(tenant)};}
  async schedule(e:Envelope) {
    this.writes++;if(this.delay)await this.delay;
    const post:ProviderPost={id:`buffer-${this.writes}`,channelId:e.channel.id,text:e.text,status:'scheduled',dueAt:e.dueAt,sentAt:null,externalLink:null,metricsUpdatedAt:null,metrics:null,assets:[]};
    this.posts.push(post);if(this.failAfter)throw new Error('timeout after acceptance');return post;
  }
  async getScheduled(){return [...this.posts.filter(p=>p.status!=='sent'),...Array.from({length:this.pending},(_,i)=>({id:`manual-${i}`} as ProviderPost))];}
  async getSent(){return this.posts.filter(p=>p.status==='sent');}
  async reconcile(id:string){const p=this.posts.find(p=>p.id===id);if(!p)throw new Error('missing');return p;}
  getPostMetrics(id:string){return this.reconcile(id);}
  async cancel(id:string){this.posts=this.posts.filter(p=>p.id!==id);return {id};}
}
async function prepare(provider=new Provider(),text='Passing a test covers a path. What proves completion remains safe after a retry?') {
  const service=new PublishingService(f.root,'founder',provider,true,()=>now);
  const packet=service.createPacket({tenant:'founder',text,evidence:[evidence()],firstPersonExperience:false,media:[]});
  const day=new Date(now.getTime()+86400000).toISOString().slice(0,10);
  const preview=await service.preview(packet.id,'America/New_York',day+'T09:00');
  return {provider,service,packet,preview};
}
function approval(job:{id:string;payloadSha256:string},event:'APPROVE'|'REVOKE'|'APPROVE_CANCEL'='APPROVE') {
  return {tenant:'founder',jobId:job.id,payloadSha256:job.payloadSha256,actor:'owner',ownerIdentity:'Muhammad Asyam Jayanegara',at:now.toISOString(),
    expiresAt:new Date(now.getTime()+3600000).toISOString(),editorialReviewed:true,authenticityReviewed:true,rightsReviewed:true,event,ownerConfirmationRef:'SYNTHETIC_OWNER_CONFIRMATION_NOT_REAL_AUTHORITY'};
}
test('dry-run is offline and an unsigned/unapproved packet cannot trigger a provider write',async()=>{
  const {service,provider,preview}=await prepare();
  expect(await service.schedule(preview.id)).toMatchObject({status:'DRY_RUN',networkRequests:0});
  await expect(service.schedule(preview.id,true)).rejects.toThrow('approval');expect(provider.writes).toBe(0);
});
test('approved schedule is distinct from sent; restart reconciliation binds the same remote ID',async()=>{
  const {service,provider,preview}=await prepare();service.approve(approval(preview));
  expect(await service.schedule(preview.id,true)).toMatchObject({status:'SCHEDULED_ONLY'});
  const restarted=new PublishingService(f.root,'founder',provider,true,()=>now);
  provider.posts[0]!.status='sent';provider.posts[0]!.sentAt=now.toISOString();
  expect(await restarted.reconcile(preview.id)).toMatchObject({status:'SENT_PROVIDER_VERIFIED__PERMALINK_PENDING'});
  await expect(restarted.schedule(preview.id,true)).rejects.toThrow();expect(provider.writes).toBe(1);
});
test('timeout after remote acceptance never resends; reconcile recovers the accepted post',async()=>{
  const provider=new Provider();provider.failAfter=true;
  const {service,preview}=await prepare(provider);service.approve(approval(preview));
  await expect(service.schedule(preview.id,true)).rejects.toThrow('timeout');
  using store=new PublishingStore(f.root,'founder',true,true);expect(store.job(preview.id).state).toBe('RECONCILE_REQUIRED');
  await expect(service.schedule(preview.id,true)).rejects.toThrow();
  expect(await service.reconcile(preview.id)).toMatchObject({status:'SCHEDULED_ONLY'});expect(provider.writes).toBe(1);
});
test('uncertain write with zero/multiple matches stays unresolved and blocks another channel job',async()=>{
  const provider=new Provider();provider.schedule=async()=>{provider.writes++;throw new Error('timeout');};
  const {service,preview}=await prepare(provider);service.approve(approval(preview));await expect(service.schedule(preview.id,true)).rejects.toThrow();
  expect(await service.reconcile(preview.id)).toMatchObject({status:'RECONCILE_REQUIRED',automaticRetry:false});
});
test('wrong account, changed exact copy and stale approval fail closed',async()=>{
  const {service,preview,provider}=await prepare();
  expect(()=>service.approve({...approval(preview),payloadSha256:'0'.repeat(64)})).toThrow('approval');
  expect(()=>service.approve({...approval(preview),expiresAt:new Date(now.getTime()-1).toISOString()})).toThrow();
  service.approve(approval(preview));provider.wrong=true;
  await expect(service.schedule(preview.id,true)).rejects.toThrow('identity');expect(provider.writes).toBe(0);
});
test('provider principal and channel IDs are exact, even when their letter case differs',async()=>{
  const {service,preview,provider}=await prepare();service.approve(approval(preview));
  provider.discoverChannels=async()=>[{...channel(),principalId:'OWNER-1'}];
  await expect(service.schedule(preview.id,true)).rejects.toThrow('identity');expect(provider.writes).toBe(0);
});
test('revoked approval and media/claim changes cannot be submitted',async()=>{
  const {service,preview,provider}=await prepare();service.approve(approval(preview));service.approve(approval(preview,'REVOKE'));
  await expect(service.schedule(preview.id,true)).rejects.toThrow();expect(provider.writes).toBe(0);
  expect(()=>service.createPacket({tenant:'founder',text:'I shipped a production exchange.',evidence:[evidence()],firstPersonExperience:false,media:[]})).toThrow('attestation');
});
test('source expiry at scheduled delivery and governance tampering invalidate packets',async()=>{
  const {service,packet}=await prepare();
  const after=new Date(now.getTime()+8*86400000).toISOString().slice(0,10);
  await expect(service.preview(packet.id,'America/New_York',after+'T09:00')).rejects.toThrow('source');
  writeFileSync(join(f.root,'brands/founder/VOICE.md'),'Changed voice');
  await expect(service.preview(packet.id,'America/New_York',new Date(now.getTime()+86400000).toISOString().slice(0,10)+'T09:00')).rejects.toThrow('governance');
});
test('capacity includes manual provider queue entries',async()=>{
  const provider=new Provider();provider.pending=8;const {service,preview}=await prepare(provider);service.approve(approval(preview));
  await expect(service.schedule(preview.id,true)).rejects.toThrow('slots');expect(provider.writes).toBe(0);
});
test('simultaneous workers serialize submission and queue access',async()=>{
  const {service,provider,preview}=await prepare();service.approve(approval(preview));
  let release!:()=>void;provider.delay=new Promise<void>(r=>{release=r;});
  const first=service.schedule(preview.id,true);await new Promise(r=>setTimeout(r,20));
  await expect(service.schedule(preview.id,true)).rejects.toThrow('approved');release();await first;expect(provider.writes).toBe(1);
});
test('expired submitting lease becomes durable reconciliation requirement',async()=>{
  const {service,preview}=await prepare();service.approve(approval(preview));using store=new PublishingStore(f.root,'founder',true);
  store.claim(preview.id,now.getTime()-200000);expect(()=>store.claim(preview.id,now.getTime())).toThrow('reconciled');
  expect(store.job(preview.id).state).toBe('RECONCILE_REQUIRED');
});
test('cross-tenant hash/job reuse and synthetic-to-observed adapter reuse are denied',async()=>{
  const {service,preview,provider}=await prepare();
  expect(()=>new PublishingService(f.root,'founder',provider,false)).toThrow('synthetic');
  using other=new PublishingStore(f.root,'retropick',true);expect(()=>other.job(preview.id)).toThrow('absent');
  expect(()=>service.approve({...approval(preview),tenant:'retropick'})).toThrow();
});
test('provider 200 errors, mutation errors, auth, 429, 500 and malformed payloads are failures without raw messages',async()=>{
  const cases=[{status:200,body:{errors:[{message:'PRIVATE_RAW_MESSAGE'}]}},{status:200,body:{data:{createPost:{__typename:'LimitReachedError',message:'PRIVATE_RAW_MESSAGE'}}}},
    {status:401,body:{}},{status:429,body:{}},{status:500,body:{}},{status:200,body:{data:{createPost:{__typename:'PostActionSuccess',post:{id:'incomplete'}}}}}];
  const {preview}=await prepare();
  for(const response of cases){const adapter=new BufferPublisherAdapter(f.root,async()=>({...response,headers:{}}),true);try{await adapter.schedule(preview.envelope);throw new Error('unexpected success');}catch(e){expect(String(e)).not.toContain('PRIVATE_RAW_MESSAGE');expect(String(e)).not.toContain('unexpected success');}}
});
test('GraphQL discovery filters exact X identity, paused/disconnected/wrong channels',async()=>{
  const candidate=channel();
  const adapter=new BufferPublisherAdapter(f.root,async q=>({status:200,headers:{},body:{data:q.includes('Identity')?{account:{id:'owner-1',organizations:[{id:'org-1'}]}}:{channels:[candidate,{...candidate,id:'other',name:'wrong'}]}}}),true);
  expect(await adapter.discoverChannels('founder')).toHaveLength(1);
  await expect(adapter.discoverChannels('retropick')).rejects.toThrow('Exactly one');
});
test('unknown pagination coverage blocks queue count',async()=>{
  const adapter=new BufferPublisherAdapter(f.root,async()=>({status:200,headers:{},body:{data:{posts:{edges:[],pageInfo:{hasNextPage:true,endCursor:null}}}}}),true);
  await expect(adapter.getScheduled(channel())).rejects.toThrow('coverage');
});
test('durable shared rate budget honors observed windows, safety margin and reset',()=>{
  using budget=new ProviderBudget(f.root,true);
  budget.observe({'ratelimit-policy':'"a";q=100;w=900','ratelimit':'"a";r=2;t=60'},now.getTime());
  expect(()=>budget.reserve(now.getTime())).toThrow('budget');
  budget.observe({'ratelimit-policy':'"a";q=100;w=900','ratelimit':'"a";r=100;t=900'},now.getTime()+61000);
  expect(()=>budget.reserve(now.getTime()+61000)).not.toThrow();
});
test('metrics remain unknown until provider refresh; real zero survives',async()=>{
  const {service,provider,preview}=await prepare();service.approve(approval(preview));await service.schedule(preview.id,true);
  await expect(service.metrics(preview.id)).rejects.toThrow('sent');
  Object.assign(provider.posts[0]!,{status:'sent',sentAt:now.toISOString()});await service.reconcile(preview.id);
  expect(await service.metrics(preview.id)).toMatchObject({metrics:null,metricsUpdatedAt:null,missingValue:'UNKNOWN'});
  Object.assign(provider.posts[0]!,{metrics:[{type:'impressions',name:'Impressions',value:0,unit:'count'}],metricsUpdatedAt:now.toISOString()});
  expect(await service.metrics(preview.id)).toMatchObject({metrics:[{value:0}]});
});
test('public acceptance compares author, URL and actual text without executing embedded scripts',async()=>{
  const {preview}=await prepare();const url='https://x.com/iHateModelsss/status/123456789';
  const proof={url,author_url:'https://x.com/iHateModelsss',provider_name:'Twitter',html:`<blockquote><p>${preview.envelope.text}</p></blockquote>`};
  expect(verifyOEmbed(proof,preview,url)).toMatchObject({url,author:'iHateModelsss'});
  expect(()=>verifyOEmbed({...proof,author_url:'https://x.com/other'},preview,url)).toThrow();
  expect(()=>verifyOEmbed({...proof,html:'<p>different</p>'},preview,url)).toThrow();
  expect(()=>verifyOEmbed({...proof,html:'<p><script>attack()</script></p>'},preview,url)).toThrow();
  expect(()=>exactPostUrl('https://x.com/RetroPickMarket/status/123','founder')).toThrow();
  expect(acceptance(f.root,'founder',true)).toMatchObject({status:'BLOCKED',receipts:[]});
});
test('DST Europe/US, nonexistent/ambiguous slots and WIB midnight are explicit',()=>{
  expect(resolveSlot('2026-10-24T09:00','Europe/London')).toBe('2026-10-24T08:00:00.000Z');
  expect(resolveSlot('2026-10-25T09:00','Europe/London')).toBe('2026-10-25T09:00:00.000Z');
  expect(resolveSlot('2026-10-31T09:00','America/New_York')).toBe('2026-10-31T13:00:00.000Z');
  expect(resolveSlot('2026-11-01T09:00','America/New_York')).toBe('2026-11-01T14:00:00.000Z');
  expect(resolveSlot('2026-11-01T09:00','America/Los_Angeles')).toBe('2026-11-01T17:00:00.000Z');
  expect(wallTime(new Date('2026-11-01T17:00:00Z'),'Asia/Jakarta')).toBe('2026-11-02T00:00');
  expect(()=>resolveSlot('2026-11-01T01:30','America/New_York')).toThrow('Ambiguous');
  expect(()=>resolveSlot('2026-03-08T02:30','America/New_York')).toThrow('nonexistent');
});
test('text weighted length rejects CJK overflow and preserves URL weighting',async()=>{
  const {service}=await prepare();
  expect(()=>service.createPacket({tenant:'founder',text:'界'.repeat(141),evidence:[evidence()],firstPersonExperience:false,media:[]})).toThrow('length');
  expect(service.createPacket({tenant:'founder',text:'Read https://example.org/'+ 'a'.repeat(300),evidence:[evidence()],firstPersonExperience:false,media:[]}).text).toContain('https://');
});
test('publisher database backup restores jobs and immutable audit; unsafe links denied',async()=>{
  const {preview}=await prepare();
  using store=new PublishingStore(f.root,'founder',true);const target=join(f.root,'restored.sqlite');await store.db.backup(target);
  const restored=new Database(target,{readonly:true});
  try {expect(restored.pragma('integrity_check',{simple:true})).toBe('ok');expect(restored.prepare('SELECT id FROM publication_jobs').get()).toEqual({id:preview.id});}finally{restored.close();}
  expect(()=>store.db.prepare("UPDATE outbox_events SET data='{}'").run()).toThrow('immutable');
  mkdirSync(join(f.root,'runtime/state/retropick'),{recursive:true});symlinkSync(target,join(f.root,'runtime/state/retropick/publishing-synthetic.sqlite'));
  expect(()=>new PublishingStore(f.root,'retropick',true)).toThrow();
});
test('cancel needs its own exact approval and never deletes sent posts',async()=>{
  const {service,preview}=await prepare();service.approve(approval(preview));await service.schedule(preview.id,true);
  await expect(service.cancel(preview.id,true)).rejects.toThrow('approval');
  service.approve(approval(preview,'APPROVE_CANCEL'));expect(await service.cancel(preview.id,true)).toMatchObject({state:'CANCELLED'});
});
test('daily/calendar/weekly retain missing evidence and provenance rather than achievements or metrics',()=>{
  expect(daily(f.root,'founder',undefined,now,'SYNTHETIC')).toMatchObject({accomplishments:Array.from({length:5},()=>expect.objectContaining({status:'MISSING'}))});
  expect(()=>daily(f.root,'retropick')).toThrow('founder');
  expect(calendar(f.root,'retropick',undefined,now,'SYNTHETIC').entries).toHaveLength(5);
  expect(calendar(f.root,'founder',undefined,now,'SYNTHETIC').entries).toHaveLength(5);
  expect(weekly(f.root,'founder',true,now)).toMatchObject({learning:'BLOCKED_OBSERVATIONS_REQUIRED'});
});
test('product exports cannot self-assign verification or cross-brand events',()=>{
  mkdirSync(join(f.root,'growth/inbox/founder'),{recursive:true});writeFileSync(join(f.root,'growth/inbox/founder/events.json'),JSON.stringify([{tenant:'retropick',verification:'PRODUCT_VERIFIED'}]));
  expect(()=>importEvents(f.root,'founder','growth/inbox/founder/events.json',true)).toThrow();
});
test('missing service credential and Buffer token redaction are explicit',()=>{
  vi.stubEnv('CREDENTIALS_DIRECTORY','');expect(credentialStatus()).toMatchObject({status:'BLOCKED_AWAITING_CREDENTIALS',present:false});
  const sample='buf_'+ 'a'.repeat(30);expect(JSON.stringify(redact({message:sample}))).not.toContain(sample);
  expect(()=>ApprovalInput.parse({...approval({id:'founder-job',payloadSha256:'0'.repeat(64)}),actor:'agent'})).toThrow();
});
test('compiled CLI requires brand, reports genuine credential blocker and preserves default offline routes',()=>{
  const run=(args:string[])=>spawnSync(process.execPath,[join(PROJECT,'dist/packages/cli/src/index.js'),...args,'--root',f.root,'--json'],{encoding:'utf8',env:{PATH:process.env.PATH??'/usr/bin:/bin'},timeout:20000});
  expect(run(['provider','doctor','--provider','buffer']).status).toBe(2);
  const doctor=run(['provider','doctor','--provider','buffer','--brand','retropick']);expect(doctor.status).toBe(4);expect(JSON.parse(doctor.stdout).data.blocker).toBe('BLOCKED_AWAITING_CREDENTIALS');
  expect(run(['daily','today','--brand','founder']).status).toBe(0);
  expect(run(['publishing','calendar','--brand','retropick']).status).toBe(0);
  expect(readFileSync(join(f.root,'config/feature-flags.yaml'),'utf8')).toContain('x_auto_publish: false');
});
test('media bytes, tenant path and rights must match before a text packet can be reviewed',async()=>{
  const {service}=await prepare();
  expect(()=>service.createPacket({tenant:'founder',text:'Question about receipt bindings.',evidence:[evidence()],firstPersonExperience:false,
    media:[{path:'runtime/v3/retropick/private.png',sha256:'0'.repeat(64),license:'UNKNOWN',rightsReviewed:true}]})).toThrow('rights');
  expect(()=>service.createPacket({tenant:'founder',text:'Question about receipt bindings.',evidence:[evidence()],firstPersonExperience:false,
    media:[{path:'runtime/v3/founder/image.png',sha256:'0'.repeat(64),license:'MIT',rightsReviewed:false}]})).toThrow();
});
test('financial promotions and nonzero execution cost cannot be approved by attaching unrelated evidence',async()=>{
  const {service,preview}=await prepare();
  expect(()=>service.createPacket({tenant:'founder',text:'Guaranteed profits with 100% APR.',evidence:[evidence()],firstPersonExperience:false,media:[]})).toThrow('promotion');
  using store=new PublishingStore(f.root,'founder',true);
  expect(()=>store.create({...preview.envelope,maxCostUsd:1} as unknown as Envelope)).toThrow();
});
test('duplicate previews reuse a job and conflicting content at the same slot cannot replace it',async()=>{
  const {service,packet,preview}=await prepare();
  expect((await service.preview(packet.id,preview.envelope.targetZone,preview.envelope.localSlot)).id).toBe(preview.id);
  using store=new PublishingStore(f.root,'founder',true);
  expect(()=>store.create({...preview.envelope,text:'Changed outside packet',maxCostUsd:0})).toThrow('binds another');
  expect(()=>store.transition(preview.id,'SENT')).toThrow('Cannot move');
});
test('two different approved jobs on the same account cannot hold concurrent queue leases',async()=>{
  const {service,preview}=await prepare();service.approve(approval(preview));
  const secondPacket=service.createPacket({tenant:'founder',text:'How would you verify a retry boundary?',evidence:[evidence()],firstPersonExperience:false,media:[]});
  const second=await service.preview(secondPacket.id,preview.envelope.targetZone,preview.envelope.localSlot);service.approve(approval(second));
  using a=new PublishingStore(f.root,'founder',true);using b=new PublishingStore(f.root,'founder',true);
  const owner=a.claim(preview.id,now.getTime());expect(()=>b.claim(second.id,now.getTime())).toThrow('Another worker');a.release(owner);
  expect(()=>b.claim(second.id,now.getTime()+200000)).toThrow('uncertain');
});
test('manual changes to a mutable job projection are detected on reopen',async()=>{
  const {preview}=await prepare();
  {using store=new PublishingStore(f.root,'founder',true);store.db.prepare("UPDATE publication_jobs SET state='SENT' WHERE id=?").run(preview.id);}
  expect(()=>new PublishingStore(f.root,'founder',true,true)).toThrow('audit');
});
test('empty, expired and unknown-expiry service credentials remain blocked without logging key values',()=>{
  const directory=join(f.root,'service-credentials');mkdirSync(directory);
  vi.stubEnv('CREDENTIALS_DIRECTORY',directory);
  writeFileSync(join(directory,'buffer-api-key'),'',{mode:0o600});writeFileSync(join(directory,'buffer-expiry'),new Date(now.getTime()+86400000).toISOString(),{mode:0o600});
  expect(credentialStatus()).toMatchObject({present:false});
  writeFileSync(join(directory,'buffer-api-key'),'SYNTHETIC_NOT_A_REAL_CREDENTIAL',{mode:0o600});writeFileSync(join(directory,'buffer-expiry'),new Date(now.getTime()-86400000).toISOString());
  expect(credentialStatus()).toMatchObject({status:'EXPIRED'});
  writeFileSync(join(directory,'buffer-expiry'),'unknown');expect(credentialStatus()).toMatchObject({status:'BLOCKED_EXPIRY_UNKNOWN'});
  writeFileSync(join(directory,'buffer-expiry'),'UNKNOWN_OWNER_ACCEPTED');expect(credentialStatus()).toMatchObject({status:'EXPIRY_UNKNOWN_OWNER_ACCEPTED',present:true,expiresAt:null});
});
test('service credential tenant binding fails closed and cannot be reused by another account',async()=>{
  const directory=join(f.root,'scoped-credentials');mkdirSync(directory);
  vi.stubEnv('CREDENTIALS_DIRECTORY',directory);
  writeFileSync(join(directory,'buffer-api-key'),'SYNTHETIC_NOT_A_REAL_CREDENTIAL',{mode:0o600});
  writeFileSync(join(directory,'buffer-expiry'),new Date(now.getTime()+86400000).toISOString(),{mode:0o600});
  expect(credentialStatus(now,'founder').present).toBe(false);
  writeFileSync(join(directory,'buffer-tenant'),'founder',{mode:0o600});
  expect(credentialStatus(now,'founder').present).toBe(true);
  expect(credentialStatus(now,'retropick').status).toBe('BLOCKED_CREDENTIAL_TENANT_MISMATCH');
  const adapter=new BufferPublisherAdapter(f.root,async()=>{throw new Error('must not call');},true,'founder');
  await expect(adapter.discoverChannels('retropick')).rejects.toThrow('another tenant');
});
test('calendar uses fresh observed five-slot New York schedules and rejects mismatched cadence',()=>{
  const schedule=['mon','tue','wed','thu','fri'].map(day=>({day,paused:false,times:['14:25']}));
  const observed={...channel(),timezone:'America/New_York',postingSchedule:schedule,verifiedAt:now.toISOString()};
  {using store=new PublishingStore(f.root,'founder',true);store.put('provider_channels',{id:hashObject(observed),channel:observed});}
  const report=calendar(f.root,'founder',undefined,now,'SYNTHETIC');
  expect(report.postingPolicy.status).toBe('VERIFIED_BUFFER_SCHEDULE');expect(report.entries).toHaveLength(5);
  for(const entry of report.entries as {localSlot:string;targetZone:string;timingBasis:string}[]) {
    expect(entry.localSlot.endsWith('T14:25')).toBe(true);expect(entry.targetZone).toBe('America/New_York');expect(entry.timingBasis).toBe('OBSERVED_BUFFER_SCHEDULE');
  }
  expect(calendar(f.root,'founder',undefined,new Date(now.getTime()+86400001),'SYNTHETIC').postingPolicy.status).toBe('AWAITING_BUFFER_SCHEDULE');
  const wrong={...observed,timezone:'America/Los_Angeles'};
  {using store=new PublishingStore(f.root,'founder',true);store.put('provider_channels',{id:hashObject(wrong),channel:wrong});}
  expect(calendar(f.root,'founder',undefined,now,'SYNTHETIC').entries).toHaveLength(0);
  expect(postingPolicy({...channel(),timezone:'America/New_York',postingSchedule:[]} as Channel).status).toBe('BUFFER_SCHEDULE_MISMATCH');
});
test('reviewed provider transport denies arbitrary endpoints and credential forwarding to public proof',async()=>{
  for(const url of ['http://api.buffer.com/','https://api.buffer.com.evil.invalid/','https://127.0.0.1/','https://api.buffer.com/other'])await expect(boundedRequest(new URL(url),'{}')).rejects.toThrow('reviewed');
  await expect(boundedRequest(new URL('https://publish.x.com/oembed'),'{}','SYNTHETIC')).rejects.toThrow('reviewed');
});
test('tenant-bound service credentials reject cross-account and unbound loading before network calls',async()=>{
  const directory=join(f.root,'tenant-service');mkdirSync(directory);
  vi.stubEnv('CREDENTIALS_DIRECTORY',directory);
  writeFileSync(join(directory,'buffer-api-key'),'SYNTHETIC_NOT_A_REAL_CREDENTIAL',{mode:0o600});
  writeFileSync(join(directory,'buffer-expiry'),new Date(now.getTime()+86400000).toISOString(),{mode:0o600});
  writeFileSync(join(directory,'buffer-tenant'),'founder',{mode:0o600});
  expect(credentialStatus(now,'founder')).toMatchObject({present:true});
  expect(credentialStatus(now,'retropick')).toMatchObject({status:'BLOCKED_CREDENTIAL_TENANT_MISMATCH',present:false});
  const adapter=new BufferPublisherAdapter(f.root,undefined,false,'founder');
  await expect(adapter.discoverChannels('retropick')).rejects.toThrow('another tenant');
  const unbound=new BufferPublisherAdapter(f.root);
  await expect(unbound.discoverChannels('founder')).rejects.toThrow('explicit tenant');
});
test('five weekly New York policy uses observed slots, blocks mismatches and labels stale schedules',()=>{
  const postingSchedule=['mon','tue','wed','thu','fri'].map(day=>({day:day as 'mon',paused:false,times:['11:35']}));
  const c={...channel(),timezone:'America/New_York',postingSchedule,verifiedAt:now.toISOString()};
  expect(postingPolicy(c).status).toBe('VERIFIED_BUFFER_SCHEDULE');
  expect(postingPolicy({...c,timezone:'Europe/London'}).status).toBe('BUFFER_SCHEDULE_MISMATCH');
  expect(postingPolicy({...c,postingSchedule:[...postingSchedule,postingSchedule[0]!]}).status).toBe('BUFFER_SCHEDULE_MISMATCH');
  {using store=new PublishingStore(f.root,'founder',true);store.put('provider_channels',{id:'fresh',channel:c});}
  const result=calendar(f.root,'founder',undefined,now,'SYNTHETIC');
  expect(result.entries).toHaveLength(5);expect(JSON.stringify(result.entries)).toContain('11:35');
  expect(result.postingPolicy.status).toBe('VERIFIED_BUFFER_SCHEDULE');
  {using store=new PublishingStore(f.root,'founder',true);store.put('provider_channels',{id:'wrong',channel:{...c,timezone:'Europe/London'}});}
  expect(calendar(f.root,'founder',undefined,now,'SYNTHETIC').entries).toHaveLength(0);
  {using store=new PublishingStore(f.root,'founder',true);store.put('provider_channels',{id:'stale',channel:{...c,verifiedAt:new Date(now.getTime()-2*86400000).toISOString()}});}
  expect(calendar(f.root,'founder',undefined,now,'SYNTHETIC').postingPolicy.status).toBe('AWAITING_BUFFER_SCHEDULE');
});
test('multiple exact remote matches never establish a recovered remote identity',async()=>{
  const provider=new Provider();provider.failAfter=true;const {service,preview}=await prepare(provider);service.approve(approval(preview));
  await expect(service.schedule(preview.id,true)).rejects.toThrow();provider.posts.push({...provider.posts[0]!,id:'different-remote-id'});
  expect(await service.reconcile(preview.id)).toMatchObject({status:'RECONCILE_REQUIRED'});expect(provider.writes).toBe(1);
});
test('research candidate queues bind current tenant source and preserve discovery-only X activity',()=>{
  const ref=evidence();const file='research/inbox/founder/queue.json';
  writeFileSync(join(f.root,file),JSON.stringify({tenant:'founder',kind:'conversations',candidates:[{id:'candidate-1',url:'https://x.com/example/status/123',evidenceId:ref.evidenceId,
    evidenceSha256:ref.evidenceSha256,statement:ref.statement,relevance:'Discuss the completion boundary from the cited source.',observedAt:now.toISOString(),provenance:'PUBLIC_SEARCH_DISCOVERY'}]}));
  const q=researchQueue(f.root,'founder','conversations','SYNTHETIC',now,file);
  expect(q.entries[0]).toMatchObject({discoveryOnly:true,observedXActivity:false,outreachAuthorized:false});
  expect(()=>researchQueue(f.root,'founder','prospects','SYNTHETIC',now,file)).toThrow('kind');
});
test('authorized UTM observations deduplicate without upgrading to independently verified conversions',async()=>{
  const {service,preview,provider}=await prepare(new Provider(),'Inspect the documented mechanism: https://example.org/demo?utm_source=x&utm_medium=organic_social&utm_campaign=v5-test&utm_content=founder-tracking-one');service.approve(approval(preview));await service.schedule(preview.id,true);
  Object.assign(provider.posts[0]!,{status:'sent',sentAt:now.toISOString()});await service.reconcile(preview.id);
  const file='growth/inbox/founder/events.json';mkdirSync(join(f.root,'growth/inbox/founder'),{recursive:true});
  const event={tenant:'founder',id:'event-1',jobId:preview.id,observedAt:now.toISOString(),event:'qualified_conversation',value:0,
    utm:{source:'x',medium:'organic_social',campaign:'v5-test',content:'founder-tracking-one'},origin:'AUTHORIZED_FIRST_PARTY_EXPORT',sourceSha256:'a'.repeat(64),
    definition:'Owner-defined relevant technical conversation.',consentReviewed:true};
  writeFileSync(join(f.root,file),JSON.stringify([event]));expect(importEvents(f.root,'founder',file,true,now).inserted).toBe(1);
  expect(importEvents(f.root,'founder',file,true,now).duplicates).toBe(1);
  writeFileSync(join(f.root,file),JSON.stringify([{...event,utm:{...event.utm,content:'unrelated-link'},id:'unbound-event'}]));expect(()=>importEvents(f.root,'founder',file,true,now)).toThrow('exact link');
  writeFileSync(join(f.root,file),JSON.stringify([{...event,event:'activation',id:'wrong-scorecard'}]));expect(()=>importEvents(f.root,'founder',file,true,now)).toThrow('scorecard');
  writeFileSync(join(f.root,file),JSON.stringify([{...event,value:1}]));expect(()=>importEvents(f.root,'founder',file,true,now)).toThrow('changed');
});
