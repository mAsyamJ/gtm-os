import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import { constants, closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { z } from 'zod';
import { GtmError } from '../../observability/src/index.js';
import { isPublicAddress } from '../../v3/src/intelligence/http.js';
import { type Tenant } from '../../schemas/src/index.js';
import { assertChannel, Channel, Envelope, ProviderPost, type PublisherAdapter } from './contracts.js';
import { ProviderBudget } from './store.js';

export interface WireResponse { status: number; headers: Record<string,string>; body: unknown }
export type GraphWire = (query: string, variables: Record<string,unknown>) => Promise<WireResponse>;

/** Fixed-host TLS transport, DNS pinned to public addresses, no redirects or raw exception logging. */
export async function boundedRequest(url: URL, body?: string, bearer?: string): Promise<WireResponse> {
  if (!((url.origin === 'https://api.buffer.com' && url.pathname === '/' && !url.search) ||
      (url.origin === 'https://publish.x.com' && url.pathname === '/oembed' && !body && !bearer)) || url.username || url.password || url.hash)
    throw new GtmError('EGRESS_DENIED','Only reviewed Buffer and public oEmbed endpoints are allowed',3);
  let dnsTimer:ReturnType<typeof setTimeout>|undefined;
  const addresses = await Promise.race([lookup(url.hostname,{all:true,verbatim:true}),new Promise<never>((_resolve,reject)=>{dnsTimer=setTimeout(()=>reject(new GtmError('PROVIDER_DNS_TIMEOUT','Provider DNS resolution timed out',4)),5000);})]).finally(()=>clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(a=>!isPublicAddress(a.address))) throw new GtmError('SSRF_DENIED','Nonpublic provider address denied',3);
  const address = addresses[0]!;
  return new Promise((resolve,reject) => {
    const fail = () => reject(new GtmError('PROVIDER_TRANSPORT','Provider request failed or timed out; remote acceptance may be unknown',4));
    const req = request(url,{method:body?'POST':'GET',agent:false,servername:url.hostname,family:address.family,
      lookup:(_host,options,callback)=>options.all?callback(null,[address]):callback(null,address.address,address.family),
      headers:{Accept:'application/json','Accept-Encoding':'identity','User-Agent':'GtmOsPublisher/5.0',
        ...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{}),...(bearer?{Authorization:`Bearer ${bearer}`}:{})}},res=> {
      const chunks: Buffer[] = []; let size=0;
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {res.destroy();fail();return;}
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2*1024*1024){res.destroy();fail();}else chunks.push(chunk);});
      res.on('error',fail);
      res.on('end',()=>{
        const headers=Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(','):String(v??'')]));
        try { resolve({status:res.statusCode??0,headers,body:JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown}); }
        catch {fail();}
      });
    });
    const timer=setTimeout(()=>{req.destroy();fail();},20000);
    req.on('close',()=>clearTimeout(timer));req.on('error',fail);req.end(body);
  });
}
export function credentialStatus(now = new Date(), tenant?: Tenant) {
  const directory=process.env.CREDENTIALS_DIRECTORY;
  if (!directory) return {status:'BLOCKED_AWAITING_CREDENTIALS',present:false,expiresAt:null};
  if (!isAbsolute(directory)) throw new GtmError('CREDENTIAL_DIRECTORY','Service credential directory must be absolute',3);
  // Only dedicated service files are opened; no .env/global homes/token argv are supported.
  let fd: number|undefined;
  try {
    if(tenant) {
      fd=openSync(join(directory,'buffer-tenant'),constants.O_RDONLY|constants.O_NOFOLLOW);
      const bindingStat=fstatSync(fd);
      if(!bindingStat.isFile() || bindingStat.nlink!==1 || bindingStat.size>20 || bindingStat.mode & 0o022)throw new Error('unsafe');
      const bound=readFileSync(fd,'utf8').trim();closeSync(fd);fd=undefined;
      if(bound!==tenant)return {status:'BLOCKED_CREDENTIAL_TENANT_MISMATCH',present:false,expiresAt:null};
    }
    fd=openSync(join(directory,'buffer-api-key'),constants.O_RDONLY|constants.O_NOFOLLOW);
    const keyStat=fstatSync(fd);
    if(!keyStat.isFile() || keyStat.nlink!==1 || keyStat.size<16 || keyStat.size>4096 || keyStat.mode & 0o077)throw new Error('unsafe');
    closeSync(fd);fd=undefined;
    fd=openSync(join(directory,'buffer-expiry'),constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(fd);
    if (!stat.isFile() || stat.size>100 || stat.mode & 0o022) throw new Error('unsafe');
    const expiresAt=readFileSync(fd,'utf8').trim();
    // Owner explicitly accepted unknown expiration for this continuation.
    // This sentinel records that choice; it never claims the key is permanent.
    if(expiresAt==='UNKNOWN_OWNER_ACCEPTED')return {status:'EXPIRY_UNKNOWN_OWNER_ACCEPTED',present:true,expiresAt:null};
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt)>now.getTime()+366*86400000) return {status:'BLOCKED_EXPIRY_UNKNOWN',present:true,expiresAt:null};
    return {status:Date.parse(expiresAt)<=now.getTime()?'EXPIRED':Date.parse(expiresAt)-now.getTime()<14*86400000?'ROTATION_DUE':'PROVISIONED_NOT_AUTHENTICATED',present:true,expiresAt};
  } catch {return {status:'BLOCKED_AWAITING_CREDENTIALS',present:false,expiresAt:null};}
  finally {if(fd!==undefined)closeSync(fd);}
}
function loadCredential(tenant?: Tenant) {
  if(!tenant)throw new GtmError('CREDENTIAL_TENANT_REQUIRED','Publisher transport must bind an explicit tenant',3);
  const status=credentialStatus(new Date(),tenant);
  if (!status.present || status.status==='EXPIRED' || status.status==='BLOCKED_EXPIRY_UNKNOWN') throw new GtmError(status.status,'Dedicated Buffer service credential and owner-reviewed expiry metadata required',4);
  let fd: number|undefined;
  try {
    fd=openSync(join(process.env.CREDENTIALS_DIRECTORY!,'buffer-api-key'),constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(fd);
    if (!stat.isFile() || stat.nlink!==1 || stat.size>4096 || stat.mode & 0o077) throw new Error('unsafe');
    const value=readFileSync(fd,'utf8').trim();
    if (!/^[A-Za-z0-9_.-]{16,4096}$/.test(value)) throw new Error('invalid');
    return value;
  } catch {throw new GtmError('BLOCKED_AWAITING_CREDENTIALS','Credential absent, empty or permissions unsafe',4);}
  finally {if(fd!==undefined)closeSync(fd);}
}
const fields='id channelId text status dueAt sentAt externalLink assets { id }';
export class BufferPublisherAdapter implements PublisherAdapter {
  readonly provider='buffer' as const;
  constructor(readonly root: string, private readonly wire?: GraphWire, readonly synthetic=false, private readonly tenant?:Tenant) {
    if (wire && !synthetic) throw new GtmError('TRANSPORT_AUTHORITY','Injected transports require synthetic scope',3);
  }
  private async query(query: string, variables: Record<string,unknown> = {}) {
    if(this.synthetic && !this.wire)throw new GtmError('SYNTHETIC_NETWORK_DENIED','Synthetic adapters require an injected offline transport',3);
    using budget=new ProviderBudget(this.root,this.synthetic); budget.reserve();
    const result=this.wire?await this.wire(query,variables):await boundedRequest(new URL('https://api.buffer.com'),JSON.stringify({query,variables}),loadCredential(this.tenant));
    budget.observe(result.headers);
    if (result.status!==200) throw new GtmError(result.status===429?'PROVIDER_RATE_LIMIT':result.status===401||result.status===403?'PROVIDER_AUTH':'PROVIDER_HTTP',`Provider HTTP ${result.status}; response body omitted`,4);
    const envelope=z.object({data:z.record(z.string(),z.unknown()).nullable().optional(),errors:z.array(z.unknown()).optional()}).parse(result.body);
    if (envelope.errors?.length || !envelope.data) {
      const codes=envelope.errors?.map(e=>z.object({extensions:z.object({code:z.string().optional()}).optional()}).safeParse(e)).flatMap(e=>e.success?[e.data.extensions?.code]:[])??[];
      const code=codes.includes('RATE_LIMIT_EXCEEDED')?'PROVIDER_RATE_LIMIT':codes.some(c=>c==='UNAUTHORIZED'||c==='FORBIDDEN')?'PROVIDER_AUTH':'PROVIDER_GRAPHQL';
      throw new GtmError(code,'GraphQL errors or missing data; raw provider messages omitted',4);
    }
    return envelope.data;
  }
  async discoverChannels(tenant: Tenant) {
    if(this.tenant && tenant!==this.tenant)throw new GtmError('CREDENTIAL_TENANT_MISMATCH','Adapter credential belongs to another tenant',3);
    const data=await this.query('query Identity { account { id organizations { id } } }');
    const account=z.object({id:z.string().min(1),organizations:z.array(z.object({id:z.string().min(1)})).max(30)}).parse(data.account);
    const matches: Channel[]=[];
    for (const org of account.organizations) {
      const result=await this.query('query Channels($input: ChannelsInput!) { channels(input:$input) { id organizationId name service serviceId isQueuePaused isDisconnected isLocked allowedActions timezone postingSchedule { day paused times } } }',{input:{organizationId:org.id}});
      for (const raw of z.array(z.record(z.string(),z.unknown())).max(100).parse(result.channels)) {
        if (raw.service!=='twitter') continue;
        const parsed=Channel.safeParse({...raw,principalId:account.id,verifiedAt:new Date().toISOString()});
        if (parsed.success && parsed.data.organizationId===org.id) {
          try {matches.push(assertChannel(tenant,parsed.data));}catch { /* Other accounts are never returned to this tenant. */ }
        }
      }
    }
    if (matches.length!==1) throw new GtmError('CHANNEL_NOT_VERIFIED','Exactly one matching connected, unpaused, authorized X channel required',4);
    return matches;
  }
  async probe(tenant: Tenant) {return {status:'IDENTITY_VERIFIED_WRITE_NOT_PROBED',channels:await this.discoverChannels(tenant)};}
  async schedule(envelope: Envelope) {
    const e=Envelope.parse(envelope);assertChannel(e.tenant,e.channel);
    if(this.tenant && e.tenant!==this.tenant)throw new GtmError('CREDENTIAL_TENANT_MISMATCH','Envelope differs from credential tenant',3);
    if(e.media.length)throw new GtmError('UNSUPPORTED','V5 first slice supports text-only posts; no approved external media host configured',4);
    const data=await this.query(`mutation Schedule($input: CreatePostInput!) { createPost(input:$input) { __typename ... on PostActionSuccess { post { ${fields} } } ... on MutationError { message } } }`,
      {input:{text:e.text,channelId:e.channel.id,schedulingType:'automatic',mode:'customScheduled',dueAt:e.dueAt}});
    const result=z.object({__typename:z.string(),post:z.unknown().optional()}).parse(data.createPost);
    if(result.__typename!=='PostActionSuccess')throw new GtmError('PROVIDER_MUTATION','Provider rejected scheduling; provider error message omitted',4);
    return ProviderPost.parse(result.post);
  }
  private async posts(channel: Channel, statuses: string[]) {
    const all: ProviderPost[]=[];let after: string|null=null;
    for(let page=0;page<10;page++) {
      const data=await this.query(`query Posts($input: PostsInput!, $after: String) { posts(first:20,after:$after,input:$input) { edges { node { ${fields} } } pageInfo { endCursor hasNextPage } } }`,
        {input:{organizationId:channel.organizationId,filter:{channelIds:[channel.id],status:statuses}},after});
      const result=z.object({edges:z.array(z.object({node:ProviderPost})).max(100),pageInfo:z.object({endCursor:z.string().nullable(),hasNextPage:z.boolean()})}).parse(data.posts);
      if(result.edges.some(r=>r.node.channelId!==channel.id))throw new GtmError('ACCOUNT_MISMATCH','Provider returned another channel',3);
      all.push(...result.edges.map(r=>r.node));
      if(!result.pageInfo.hasNextPage)return all;
      if(!result.pageInfo.endCursor || result.pageInfo.endCursor===after)break;
      after=result.pageInfo.endCursor;
    }
    throw new GtmError('PROVIDER_PAGINATION','Incomplete provider coverage; queue size/reconciliation unknown',4);
  }
  getScheduled(channel: Channel) {return this.posts(channel,['scheduled','sending']);}
  getSent(channel: Channel) {return this.posts(channel,['sent']);}
  async reconcile(id: string) {
    const data=await this.query(`query Post($input: PostInput!) { post(input:$input) { ${fields} } }`,{input:{id}});
    return ProviderPost.parse(data.post);
  }
  async getPostMetrics(id: string) {
    const data=await this.query(`query Metrics($input: PostInput!) { post(input:$input) { ${fields} metricsUpdatedAt metrics { type name value unit } } }`,{input:{id}});
    return ProviderPost.parse(data.post);
  }
  async cancel(id: string) {
    const data=await this.query('mutation Cancel($input: DeletePostInput!) { deletePost(input:$input) { __typename ... on DeletePostSuccess { id } ... on MutationError { message } } }',{input:{id}});
    const result=z.object({__typename:z.literal('DeletePostSuccess'),id:z.literal(id)}).safeParse(data.deletePost);
    if(!result.success)throw new GtmError('PROVIDER_MUTATION','Cancellation not confirmed',4);
    return {id:result.data.id};
  }
}
