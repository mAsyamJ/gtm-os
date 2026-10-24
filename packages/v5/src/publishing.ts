import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import twitterText from 'twitter-text';
import { GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { safePath, safeDirectory } from '../../core/src/workspace.js';
import { HANDLES, type Tenant } from '../../schemas/src/index.js';
import { context, localInput, records } from '../../v3/src/common.js';
import { usable } from '../../v3/src/evidence.js';
import { packetById } from '../../v3/src/distribution.js';
import { immutableFile } from '../../creative/src/common.js';
import { screenUntrusted } from '../../research/src/index.js';
import { ApprovalInput, assertChannel, contentHash, Envelope, Packet, PacketInput, type Channel, type Job, type ProviderPost, type PublisherAdapter } from './contracts.js';
import { PublishingStore } from './store.js';
import { resolveSlot, timeDisplay } from './time.js';

export function governanceHash(root: string, tenant: Tenant) {
  return hashObject(['AGENTS.md','packages/v5/AGENTS.md',...['AGENTS.md','VOICE.md','DESIGN.md','claims-ledger.yaml','profile.json'].map(f=>`brands/${tenant}/${f}`)]
    .map(path=>({path,sha256:sha256(readFileSync(safePath(root,path)))})));
}
export class PublishingService {
  constructor(readonly root:string,readonly tenant:Tenant,readonly adapter:PublisherAdapter,readonly synthetic=false,readonly now:()=>Date=()=>new Date()) {
    context(root,tenant,synthetic?'SYNTHETIC':'OBSERVED');
    if(adapter.synthetic!==synthetic)throw new GtmError('DATASET_MISMATCH','Injected/synthetic provider cannot enter observed publishing',3);
  }
  private store(readonly=false) {return new PublishingStore(this.root,this.tenant,this.synthetic,readonly);}
  private validate(packet: Packet, at=this.now()) {
    screenUntrusted(packet);
    if(/\b(?:guaranteed profits?|risk.free|\d+%\s*(?:return|apr|apy)|get rich)\b/i.test(packet.text))throw new GtmError('UNVERIFIED_FINANCIAL_CLAIM','Financial promotion denied',3);
    const input=PacketInput.parse({tenant:packet.tenant,text:packet.text,evidence:packet.evidence,firstPersonExperience:packet.firstPersonExperience,media:packet.media});
    if(packet.tenant!==this.tenant || contentHash(input)!==packet.contentHash || governanceHash(this.root,this.tenant)!==packet.governanceHash)
      throw new GtmError('PAYLOAD_CHANGED','Packet scope/content/governance changed',3);
    const count=twitterText.parseTweet(packet.text);
    if(!count.valid || count.weightedLength>280)throw new GtmError('POST_LENGTH','Post must pass X weighted length validation at 280',3);
    const cards=usable(this.root,this.tenant,this.synthetic?'SYNTHETIC':'OBSERVED',undefined,at);
    for(const ref of packet.evidence) {
      const card=cards.find(c=>c.source.id===ref.evidenceId && hashObject(c.source)===ref.evidenceSha256 && hashObject(c.review)===ref.reviewSha256 && c.claims.includes(ref.statement));
      if(!card)throw new GtmError('EVIDENCE_GAP','Current exact reviewed source/claim binding required',3);
      if(packet.firstPersonExperience && !(card.review.classification==='OWNER_ATTESTED' && card.review.authenticFirstPerson===true))throw new GtmError('OWNER_ATTESTATION_REQUIRED','Personal experience requires owner attestation',3);
    }
    if(!packet.firstPersonExperience && /\b(?:I|we)\s+(?:built|shipped|launched|achieved|earned|audited|deployed|tested)\b/i.test(packet.text))throw new GtmError('OWNER_ATTESTATION_REQUIRED','First-person achievement language requires explicit attestation',3);
    for(const m of packet.media) {
      if(!m.path.startsWith(`runtime/v3/${this.tenant}/`) || sha256(readFileSync(safePath(this.root,m.path)))!==m.sha256 || !m.rightsReviewed)throw new GtmError('MEDIA_RIGHTS','Media provenance/rights/hash differs',3);
    }
  }
  createPacket(raw:unknown) {
    const input=PacketInput.parse(raw);
    const governance=governanceHash(this.root,this.tenant);
    const packet=Packet.parse({...input,id:`${this.tenant}-v5-packet-${hashObject({input,governance}).slice(0,24)}`,contentHash:contentHash(input),governanceHash:governance,createdAt:this.now().toISOString()});
    this.validate(packet);using store=this.store();const prior=store.rows('packets').find(p=>p.id===packet.id);if(prior)return Packet.parse(prior);store.put('packets',packet);
    this.artifact('packets',packet);return packet;
  }
  packet(id:string):Packet {
    if(!existsSync(safePath(this.root,`runtime/state/${this.tenant}/publishing-${this.synthetic?'synthetic':'observed'}.sqlite`)))throw new GtmError('PACKET_MISSING','V5 packet absent in selected tenant',4);
    using store=this.store(true);
    const p=store.rows('packets').find(p=>p.id===id);
    if(!p)throw new GtmError('PACKET_MISSING','V5 packet absent in selected tenant',4);
    return Packet.parse(p);
  }
  /** Explicit conversion creates a new V5 payload; old native-only approvals never transfer. */
  importLegacy(id:string) {
    const p=packetById(this.root,this.tenant,id,this.synthetic?'SYNTHETIC':'OBSERVED',this.now());
    const blocks=z.array(z.string()).parse(p.immutablePayload.blocks);
    if(blocks.length!==1)throw new GtmError('UNSUPPORTED','Initial V5 acceptance supports one post, not a legacy thread',4);
    const reviews=records(this.root,this.tenant,'review',this.synthetic?'SYNTHETIC':'OBSERVED');
    return this.createPacket({tenant:this.tenant,text:blocks[0],firstPersonExperience:false,media:[],evidence:p.evidence.map(e=>{
      const review=reviews.find(r=>r.evidenceId===e.evidenceId && r.evidenceSha256===e.evidenceSha256);
      if(!review)throw new GtmError('EVIDENCE_GAP','Legacy review missing',3);
      return {...e,reviewSha256:hashObject(review)};
    })});
  }
  async channels() {const channels=await this.adapter.discoverChannels(this.tenant);using store=this.store();for(const c of channels)store.put('provider_channels',{id:hashObject(c),channel:assertChannel(this.tenant,c)});return channels;}
  async preview(packetId:string,zone:string,slot:string) {
    let packet:Packet;
    try {packet=this.packet(packetId);}catch(e){if(e instanceof GtmError && e.code==='PACKET_MISSING')packet=this.importLegacy(packetId);else throw e;}
    const dueAt=resolveSlot(slot,zone);this.validate(packet);this.validate(packet,new Date(dueAt));
    if(Date.parse(dueAt)<=this.now().getTime())throw new GtmError('SLOT_PAST','Publishing slot must be future',3);
    const [channel]=await this.channels();if(!channel)throw new GtmError('CHANNEL_NOT_VERIFIED','Verified channel required',4);
    const envelope=Envelope.parse({schemaVersion:5,tenant:this.tenant,provider:'buffer',account:HANDLES[this.tenant],channel,packetId:packet.id,
      contentHash:packet.contentHash,governanceHash:packet.governanceHash,text:packet.text,evidence:packet.evidence,media:packet.media,dueAt,targetZone:zone,localSlot:slot,maxCostUsd:0});
    using store=this.store();const job=store.create(envelope);
    const preview={...job,times:timeDisplay(dueAt,zone),approvalStatus:'PENDING_OWNER',sourceRights:packet.media.length?'PER_MEDIA':'ORIGINAL_TEXT_WITH_SEPARATE_SOURCE_RIGHTS_REVIEW',estimatedProviderCostUsd:0,approvalExpiryLimit:new Date(Math.min(this.now().getTime()+7*86400000,Date.parse(dueAt))).toISOString()};
    this.artifact('previews',preview);return preview;
  }
  approve(raw:unknown) {
    const a=ApprovalInput.parse(raw);using store=this.store();const job=store.job(a.jobId);
    if(a.tenant!==this.tenant || a.payloadSha256!==job.payloadSha256 || Date.parse(a.at)>this.now().getTime() || Date.parse(a.expiresAt)<=this.now().getTime() ||
      Date.parse(a.expiresAt)<=Date.parse(a.at) || Date.parse(a.expiresAt)-Date.parse(a.at)>7*86400000)throw new GtmError('APPROVAL_BINDING','Exact current tenant/hash/time-bound owner approval required',3);
    if(a.event==='APPROVE') {
      this.validate(this.packet(job.envelope.packetId));this.validate(this.packet(job.envelope.packetId),new Date(job.envelope.dueAt));
      if(!['APPROVAL_PENDING','HOLD'].includes(job.state) || job.providerPostId || store.rows('publication_attempts',job.id).some(a=>a.phase==='MUTATION_STARTED'))throw new GtmError('ILLEGAL_TRANSITION','Only an unsubmitted preview can receive schedule approval',3);
    }
    if(a.event==='APPROVE_CANCEL' && (!job.providerPostId || !['SCHEDULED','HOLD','RECONCILE_REQUIRED'].includes(job.state)))throw new GtmError('CANCEL_DENIED','Cancellation approval requires a known potentially pending provider post',3);
    const previous=store.rows('approvals',job.id).at(-1);
    if(previous && Date.parse(a.at)<Date.parse(String(previous.at)))throw new GtmError('EVENT_ORDER','Owner decisions cannot move backwards in time',3);
    return store.transaction(()=>{
      store.put('approvals',a,job.id);
      if(a.event==='APPROVE')return store.transition(job.id,'APPROVED');
      if(a.event==='REVOKE')return store.transition(job.id,'HOLD',{reason:job.providerPostId?'REMOTE_CANCELLATION_REQUIRES_APPROVAL':'OWNER_REVOKED'});
      return job;
    });
  }
  private approval(store:PublishingStore,job:Job,event:'APPROVE'|'APPROVE_CANCEL') {
    const all=store.rows('approvals',job.id).map(a=>ApprovalInput.parse(a));
    const last=all.at(-1);
    if(!last || last.event!==event || last.payloadSha256!==job.payloadSha256 || last.tenant!==this.tenant || Date.parse(last.expiresAt)<=this.now().getTime())
      throw new GtmError('OWNER_APPROVAL_MISSING','Unexpired exact owner approval required',3);
    return last;
  }
  private async identity(job:Job) {
    const channels=await this.adapter.discoverChannels(this.tenant), selected=channels[0];
    const old=job.envelope.channel;
    if(channels.length!==1 || !selected || ['id','principalId','organizationId','serviceId','service'].some(k=>selected[k as keyof Channel]!==old[k as keyof Channel]) || selected.name.replace(/^@/,'').toLowerCase()!==old.name.replace(/^@/,'').toLowerCase())throw new GtmError('ACCOUNT_MISMATCH','Current provider identity differs from approved identity',3);
    assertChannel(this.tenant,selected);
  }
  async schedule(id:string,execute=false) {
    using store=this.store();let job=store.job(id);
    if(!execute)return {status:'DRY_RUN',job,networkRequests:0,externalWrites:0,required:'Exact owner approval, credentials, current identity/evidence, capacity and --execute'};
    this.approval(store,job,'APPROVE');this.validate(this.packet(job.envelope.packetId));this.validate(this.packet(job.envelope.packetId),new Date(job.envelope.dueAt));
    if(Date.parse(job.envelope.dueAt)<=this.now().getTime())throw new GtmError('SLOT_PAST','Approved slot has passed; new preview and approval required',3);
    if(job.envelope.media.length)throw new GtmError('UNSUPPORTED','Text-only publishing slice; media hosting not configured',4);
    // Claim before preflight network calls: competing workers cannot both pass queue checks.
    const owner=store.claim(id,this.now().getTime());job=store.job(id);let submitting=false;
    try {
      await this.identity(job);
      const pending=await this.adapter.getScheduled(job.envelope.channel);
      if(pending.length>=8)throw new GtmError('QUEUE_CAPACITY','Keep at least two of ten Buffer pending slots free',4);
      this.approval(store,store.job(id),'APPROVE');this.validate(this.packet(job.envelope.packetId));
      if(Date.parse(job.envelope.dueAt)<=this.now().getTime())throw new GtmError('SLOT_PAST','Slot passed during preflight',3);
      store.transaction(()=>{
        const current=store.job(id);
        if(current.state!=='SUBMITTING' || current.leaseOwner!==owner || (current.leaseUntil??0)<=this.now().getTime()+25000)throw new GtmError('LEASE_EXPIRED','Submission lease lacks sufficient request time; no mutation attempted',3);
        this.approval(store,current,'APPROVE');
        store.put('publication_attempts',{phase:'MUTATION_STARTED',owner,at:this.now().toISOString(),payloadSha256:job.payloadSha256},id);
      });
      submitting=true;
      const post=await this.adapter.schedule(job.envelope);
      this.match(job,post);
      store.transaction(()=>{store.bind(id,post.id);store.put('provider_receipts',{at:this.now().toISOString(),origin:this.synthetic?'SYNTHETIC':'BUFFER_API',post},id);store.transition(id,'SCHEDULED',{providerPostId:post.id},owner);});
      // Independently read the created ID; a mutation receipt alone is insufficient acceptance.
      return await this.reconcile(id);
    } catch(e) {
      if(store.job(id).leaseOwner===owner)store.transition(id,submitting?'RECONCILE_REQUIRED':'HOLD',{reason:e instanceof GtmError?e.code:'PROVIDER_FAILURE'},owner);
      throw e;
    } finally {store.release(owner);}
  }
  private match(job:Job,post:ProviderPost) {
    if(post.channelId!==job.envelope.channel.id || post.text!==job.envelope.text || post.dueAt!==job.envelope.dueAt || post.assets.length || job.providerPostId && job.providerPostId!==post.id)
      throw new GtmError('REMOTE_PAYLOAD_MISMATCH','Remote ID/channel/text/time/media differs from approved envelope',3);
  }
  async reconcile(id:string) {
    using store=this.store();const job=store.job(id);await this.identity(job);
    if(!store.rows('publication_attempts',id).some(a=>a.phase==='MUTATION_STARTED'))throw new GtmError('NO_SUBMISSION_ATTEMPT','Reconciliation requires this job’s prior approved submission attempt',3);
    if(job.state==='SUBMITTING' && (job.leaseUntil??0)>this.now().getTime())throw new GtmError('LEASE_ACTIVE','Submission worker still owns the active lease',3);
    let post:ProviderPost;
    if(job.providerPostId)post=await this.adapter.reconcile(job.providerPostId);
    else {
      const candidates=[...await this.adapter.getScheduled(job.envelope.channel),...await this.adapter.getSent(job.envelope.channel)];
      const matches=candidates.filter(p=>p.channelId===job.envelope.channel.id && p.text===job.envelope.text && p.dueAt===job.envelope.dueAt && !p.assets.length);
      if(matches.length!==1){store.transition(id,'RECONCILE_REQUIRED',{candidates:matches.length,automaticRetry:false});return {status:'RECONCILE_REQUIRED',job:store.job(id),automaticRetry:false};}
      post=matches[0]!;
    }
    this.match(job,post);
    if(post.status==='sent' && (!post.sentAt || Date.parse(post.sentAt)>this.now().getTime()))throw new GtmError('PROVIDER_SCHEMA','Sent state requires an actual nonfuture sentAt',4);
    const state=post.status==='sent'?'SENT':post.status==='scheduled'||post.status==='sending'?'SCHEDULED':post.status==='error'?'FAILED':'HOLD';
    store.transaction(()=>{store.bind(id,post.id);store.put('provider_receipts',{at:this.now().toISOString(),origin:this.synthetic?'SYNTHETIC':'BUFFER_API',post},id);store.transition(id,state,{providerStatus:post.status});});
    return {status:state==='SENT'?'SENT_PROVIDER_VERIFIED__PERMALINK_PENDING':state==='SCHEDULED'?'SCHEDULED_ONLY':state,job:store.job(id),post};
  }
  async cancel(id:string,execute=false) {
    using store=this.store();const job=store.job(id);
    if(!execute)return {status:'DRY_RUN',job,externalWrites:0};
    this.approval(store,job,'APPROVE_CANCEL');
    if(!job.providerPostId)throw new GtmError('RECONCILE_REQUIRED','Remote ID required before cancellation',3);
    if(!['SCHEDULED','HOLD','RECONCILE_REQUIRED'].includes(job.state))throw new GtmError('CANCEL_DENIED','Only potentially pending jobs may be cancelled',3);
    const owner=store.lockExisting(id,this.now().getTime());let submitted=false;
    try {
      await this.identity(job);const post=await this.adapter.reconcile(job.providerPostId);this.match(job,post);
      if(post.status!=='scheduled')throw new GtmError('CANCEL_DENIED','Only an unsent scheduled post can be cancelled',3);
      store.transaction(()=>{
        const current=store.job(id);this.approval(store,current,'APPROVE_CANCEL');
        if(current.leaseOwner!==owner || (current.leaseUntil??0)<=this.now().getTime()+25000)throw new GtmError('LEASE_EXPIRED','Cancellation lease expired before mutation',3);
        store.put('publication_attempts',{phase:'CANCEL_STARTED',owner,at:this.now().toISOString(),providerPostId:post.id},id);
      });
      submitted=true;const result=await this.adapter.cancel(post.id);
      return store.transaction(()=>{store.put('provider_receipts',{at:this.now().toISOString(),action:'CANCEL',result},id);return store.transition(id,'CANCELLED',{},owner);});
    }catch(e){if(submitted)store.transition(id,'RECONCILE_REQUIRED',{reason:'CANCELLATION_UNCERTAIN'},owner);throw e;}
    finally{store.release(owner);}
  }
  async metrics(id:string) {
    using store=this.store();const job=store.job(id);
    if(!job.providerPostId || !['SENT','MEASURED','EXTERNAL_URL_PENDING'].includes(job.state))throw new GtmError('NOT_SENT','Metrics require provider-confirmed sent state',3);
    await this.identity(job);const post=await this.adapter.getPostMetrics(job.providerPostId);this.match(job,post);
    if(post.status!=='sent')throw new GtmError('NOT_SENT','Provider no longer reports sent',3);
    const snapshot={observedAt:this.now().toISOString(),metricsUpdatedAt:post.metricsUpdatedAt,metrics:post.metrics,providerPostId:post.id,
      origin:this.synthetic?'SYNTHETIC':'BUFFER_API',missingValue:'UNKNOWN',freshness:post.metricsUpdatedAt?'PROVIDER_REFRESH_CLOCK':'UNKNOWN'};
    if(post.metricsUpdatedAt && (Date.parse(post.metricsUpdatedAt)>this.now().getTime() || post.sentAt && Date.parse(post.metricsUpdatedAt)<Date.parse(post.sentAt)))throw new GtmError('METRIC_CLOCK','Provider metric refresh clock is invalid',3);
    store.put('metrics_snapshots',snapshot,id);
    if(post.metrics && post.metricsUpdatedAt)store.transition(id,'MEASURED');
    return snapshot;
  }
  async refill(execute=false) {
    using store=this.store();const candidates=store.jobs().filter(j=>j.state==='APPROVED').sort((a,b)=>a.envelope.dueAt.localeCompare(b.envelope.dueAt));
    const results:unknown[]=[];
    for(const job of candidates){try{results.push(await this.schedule(job.id,execute));}catch(e){results.push({jobId:job.id,status:'BLOCKED',code:e instanceof GtmError?e.code:'EXECUTION_FAILURE'});break;}}
    return {tenant:this.tenant,results,automaticFutureDelivery:'BUFFER_ONLY'};
  }
  async tick(execute=false) {
    using store=this.store();const results:unknown[]=[];
    for(const job of store.jobs()) {
      if(!execute){results.push({jobId:job.id,state:job.state,externalWrites:0});continue;}
      try {
        if(job.state==='RECONCILE_REQUIRED'||job.state==='SUBMITTING'||job.providerPostId && Date.parse(job.envelope.dueAt)<=this.now().getTime() && ['SCHEDULED','HOLD'].includes(job.state))results.push(await this.reconcile(job.id));
        const current=store.job(job.id);
        if(['SENT','EXTERNAL_URL_PENDING'].includes(current.state))results.push(await this.metrics(job.id));
      }catch(e){results.push({jobId:job.id,status:'BLOCKED',code:e instanceof GtmError?e.code:'EXECUTION_FAILURE'});}
    }
    return {tenant:this.tenant,reconciliation:results,refill:await this.refill(execute)};
  }
  artifact(kind:string,value:unknown) {
    const path=`runtime/v5/${this.tenant}/${this.synthetic?'synthetic':'observed'}/${kind}/${hashObject(value)}.json`;
    safeDirectory(this.root,path.slice(0,path.lastIndexOf('/')));
    if(!existsSync(safePath(this.root,path)))immutableFile(this.root,path,JSON.stringify(value,null,2)+'\n');return path;
  }
}
export function approvalFile(root:string,tenant:Tenant,path:string) {return localInput(root,tenant,path,'distribution');}
