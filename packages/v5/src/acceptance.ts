import { existsSync } from 'node:fs';
import { z } from 'zod';
import { GtmError, hashObject } from '../../observability/src/index.js';
import { safePath } from '../../core/src/workspace.js';
import { HANDLES, type Tenant } from '../../schemas/src/index.js';
import { boundedRequest } from './buffer.js';
import { PublishingStore } from './store.js';
import { type Job, ProviderPost } from './contracts.js';
import { PublishingService } from './publishing.js';

export function exactPostUrl(raw:string,tenant:Tenant) {
  const url=new URL(raw);
  if(url.protocol!=='https:' || !['x.com','twitter.com'].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash ||
      !new RegExp(`^/${HANDLES[tenant]}/status/[1-9][0-9]*$`,'i').test(url.pathname))throw new GtmError('PERMALINK_MISMATCH','Public URL must identify the exact account and a real status ID',3);
  return url;
}
function decode(text:string) {
  const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_match:string,e:string)=>{
    if(e[0]==='#'){const n=e[1]?.toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));if(n<0||n>0x10ffff)throw new Error('invalid entity');return String.fromCodePoint(n);}
    if(!(e in entities))throw new Error('unsupported entity');return entities[e]!;
  });
}
export function verifyOEmbed(raw:unknown,job:Job,url:string) {
  const proof=z.object({url:z.string(),author_url:z.string(),html:z.string().max(100000),provider_name:z.enum(['Twitter','X'])}).parse(raw);
  const expected=exactPostUrl(url,job.tenant),actual=exactPostUrl(proof.url,job.tenant);
  const author=new URL(proof.author_url);
  if(actual.pathname.toLowerCase()!==expected.pathname.toLowerCase() || !['x.com','twitter.com'].includes(author.hostname) || author.protocol!=='https:' || author.username || author.password || author.port || author.search || author.hash || author.pathname.toLowerCase()!==`/${HANDLES[job.tenant]}`.toLowerCase())throw new GtmError('PUBLIC_PROOF_MISMATCH','Independent public author/URL differs',3);
  const paragraph=/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i.exec(proof.html)?.[1];
  if(!paragraph || /<(?!\/?a\b|br\b)/i.test(paragraph))throw new GtmError('PUBLIC_PROOF_SCHEMA','Public text markup cannot be safely compared',4);
  const text=decode(paragraph.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/?a\b[^>]*>/gi,''));
  if(text.normalize('NFC')!==job.envelope.text.normalize('NFC'))throw new GtmError('PUBLIC_PROOF_MISMATCH','Public text differs or cannot be compared exactly',3);
  return {url:expected.href,author:HANDLES[job.tenant],textSha256:hashObject({text:job.envelope.text}),proofSha256:hashObject(proof)};
}
export async function verifyPublic(service:PublishingService,id:string,suppliedUrl?:string) {
  if(service.synthetic)throw new GtmError('SYNTHETIC_AUTHORITY','Synthetic jobs cannot request genuine public acceptance',3);
  await service.reconcile(id);
  using store=new PublishingStore(service.root,service.tenant,service.synthetic);
  const job=store.job(id);
  const receipt=store.rows('provider_receipts',id).filter(r=>r.origin==='BUFFER_API' && r.post).at(-1);
  const post=ProviderPost.parse(receipt?.post);
  if(post.status!=='sent' || !post.sentAt || post.id!==job.providerPostId || post.channelId!==job.envelope.channel.id || post.text!==job.envelope.text || post.dueAt!==job.envelope.dueAt)
    throw new GtmError('NOT_SENT','Matching provider-confirmed sent receipt required',3);
  const candidateUrl=post.externalLink??suppliedUrl;
  if(!candidateUrl){store.transition(id,'EXTERNAL_URL_PENDING');return {status:'SENT_PROVIDER_VERIFIED__PERMALINK_PENDING',reason:'BUFFER_EXTERNAL_LINK_MISSING'};}
  try {
    const url=exactPostUrl(candidateUrl,job.tenant);
    if(post.externalLink && suppliedUrl && exactPostUrl(suppliedUrl,job.tenant).pathname.toLowerCase()!==url.pathname.toLowerCase())throw new GtmError('PERMALINK_MISMATCH','Owner URL differs from documented provider URL',3);
    const endpoint=new URL('https://publish.x.com/oembed');endpoint.searchParams.set('url',url.href);endpoint.searchParams.set('omit_script','true');endpoint.searchParams.set('hide_thread','true');
    const response=await boundedRequest(endpoint);
    if(response.status!==200)throw new GtmError('PUBLIC_PROOF_UNAVAILABLE','Public API did not verify the post',4);
    const proof=verifyOEmbed(response.body,job,url.href);
    const approval=store.rows('approvals',id).filter(a=>a.event==='APPROVE' && a.payloadSha256===job.payloadSha256).at(-1);
    const latest=store.rows('approvals',id).at(-1);
    if(!approval || latest?.event==='REVOKE')throw new GtmError('APPROVAL_BINDING','Public acceptance lacks an effective exact owner approval',3);
    const result={schemaVersion:5,tenant:job.tenant,status:'END_TO_END_VERIFIED',jobId:id,payloadSha256:job.payloadSha256,providerPostId:post.id,
      account:HANDLES[job.tenant],channelId:post.channelId,scheduledAt:post.dueAt,sentAt:post.sentAt,observedAt:service.now().toISOString(),
      publicProof:proof,urlCandidateOrigin:post.externalLink?'BUFFER_EXTERNAL_LINK':'OWNER_SUPPLIED_NOT_PROOF_UNTIL_PUBLIC_API_CHECK',approvalHash:hashObject(approval),metricsUpdatedAt:post.metricsUpdatedAt,metrics:post.metrics,
      sourceRights:'OWNER_REVIEW_BOUND_IN_APPROVAL',costUsd:0,origin:'BUFFER_SENT_AND_X_PUBLIC_OEMBED'};
    store.put('provider_receipts',result,id);return {...result,receipt:service.artifact('acceptance',result)};
  }catch(e){store.transition(id,'EXTERNAL_URL_PENDING',{reason:e instanceof GtmError?e.code:'PUBLIC_PROOF_UNAVAILABLE'});return {status:'SENT_PROVIDER_VERIFIED__PERMALINK_PENDING',reason:e instanceof GtmError?e.code:'PUBLIC_PROOF_UNAVAILABLE'};}
}
export function acceptance(root:string,tenant:Tenant,synthetic=false) {
  const path=safePath(root,`runtime/state/${tenant}/publishing-${synthetic?'synthetic':'observed'}.sqlite`);
  if(!existsSync(path))return {tenant,status:'BLOCKED',reason:'NO_PUBLICATION_JOBS',receipts:[]};
  using store=new PublishingStore(root,tenant,synthetic,true);
  const receipts=store.rows('provider_receipts').filter(r=>r.status==='END_TO_END_VERIFIED');
  return {tenant,status:receipts.length?'RECEIPTS_AVAILABLE':'BLOCKED',synthetic,receipts,jobs:store.jobs(),audit:store.verify()};
}
