import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import { GtmError, sha256 } from '../../../observability/src/index.js';
import { reserve } from './quota.js';

export interface HostPolicy {host:string;prefixes:string[];queryKeys:string[]}
const blocked=new BlockList();
for(const [address,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]] as const)blocked.addSubnet(address,bits,'ipv4');
const v6=new BlockList();v6.addSubnet('2000::',3,'ipv6');
const bad6=new BlockList();bad6.addSubnet('2001::',23,'ipv6');bad6.addSubnet('2001:db8::',32,'ipv6');bad6.addSubnet('2002::',16,'ipv6');bad6.addSubnet('3fff::',20,'ipv6');
export function isPublicAddress(address:string) {
  return isIP(address)===4?!blocked.check(address,'ipv4'):isIP(address)===6&&v6.check(address,'ipv6')&&!bad6.check(address,'ipv6');
}
export function checkedUrl(uri:string,policy:HostPolicy) {
  const u=new URL(uri);
  if(/(?:^|\.)(?:x|twitter)\.com$/.test(u.hostname))throw new GtmError('X_SOURCE_DENIED','X/Twitter collection remains prohibited even if added to a source registry',3);
  if(u.protocol!=='https:'||u.hostname!==policy.host||u.username||u.password||u.port||u.hash||isIP(u.hostname)||
    !policy.prefixes.some(p=>u.pathname.startsWith(p)) || [...u.searchParams.keys()].some(k=>!policy.queryKeys.includes(k)))
    throw new GtmError('SOURCE_POLICY','URL is outside its individually reviewed source policy',3);
  if(/(?:token|secret|key|cookie|password|authorization)/i.test([...u.searchParams.keys()].join(' ')))throw new GtmError('SOURCE_POLICY','Credential-bearing query denied',3);
  return u;
}
function robotsMatch(pattern:string,uri:string){
  const normalize=(s:string)=>Array.from(s).map(c=>c.codePointAt(0)!>127?encodeURIComponent(c):c).join('').replace(/%[0-9a-f]{2}/gi,v=>{const c=String.fromCharCode(parseInt(v.slice(1),16));return /[A-Za-z0-9_.~-]/.test(c)?c:v.toUpperCase();});
  let p=normalize(pattern),path=normalize(uri);const exact=p.endsWith('$');if(exact)p=p.slice(0,-1);else p+='*';
  let i=0,j=0,star=-1,mark=0;
  while(i<path.length){
    if(j<p.length&&p[j]===path[i]){i++;j++;}
    else if(p[j]==='*'){star=j++;mark=i;}
    else if(star>=0){j=star+1;i=++mark;}
    else return false;
  }
  while(p[j]==='*')j++;return j===p.length;
}
export function robotsPolicy(text:string,path:string) {
  const groups:{agents:string[];rules:{allow:boolean;path:string}[];delay:number}[]=[];
  let group:{agents:string[];rules:{allow:boolean;path:string}[];delay:number}|undefined;
  for(const line of text.slice(0,200000).split(/\r?\n/)){
    const m=/^\s*([a-z-]+)\s*:\s*(.*?)\s*(?:#.*)?$/i.exec(line);if(!m)continue;
    const key=m[1]!.toLowerCase(),value=m[2]!;
    if(key==='user-agent'){
      if(!group||group.rules.length||group.delay!==1){group={agents:[],rules:[],delay:1};groups.push(group);}
      group.agents.push(value.toLowerCase());
    }else if(group&&['allow','disallow'].includes(key)&&value)group.rules.push({allow:key==='allow',path:value.slice(0,2000)});
    else if(group&&key==='crawl-delay'){
      const delay=Number(value);if(!Number.isFinite(delay)||delay<0||delay>60)throw new GtmError('ROBOTS_DELAY','Unserviceable robots delay',3);
      group.delay=Math.max(1,delay);
    }
  }
  const exact=groups.filter(g=>g.agents.some(a=>a!=='*'&&'gtmosresearch'.startsWith(a)));
  const chosen=exact.length?exact:groups.filter(g=>g.agents.includes('*'));
  const matches=chosen.flatMap(g=>g.rules).filter(r=>robotsMatch(r.path,path))
    .sort((a,b)=>b.path.replace(/\*/g,'').length-a.path.replace(/\*/g,'').length||Number(b.allow)-Number(a.allow));
  return {allowed:matches[0]?.allow??true,delaySeconds:Math.max(1,...chosen.map(g=>g.delay))};
}
export interface HttpBody {status:number;body:Buffer;contentType:string;at:string;sha256:string}
export class PublicTransport {
  private clocks=new Map<string,{at:number;delay:number}>();
  requests=0;bytes=0;
  constructor(readonly root:string,readonly tenant:'retropick'|'founder'){}
  async raw(u:URL):Promise<HttpBody> {
    reserve(this.root,this.tenant,'http');this.requests++;
    const clock=this.clocks.get(u.hostname)??{at:0,delay:1};
    await pause(Math.max(0,clock.at+clock.delay*1000-Date.now()));
    const addresses=await lookup(u.hostname,{all:true,verbatim:true});
    if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw new GtmError('SSRF_DENIED','Private or special DNS address denied',3);
    const selected=addresses[0]!;
    this.clocks.set(u.hostname,{...clock,at:Date.now()});
    return new Promise((resolve,reject)=>{
      const req=request(u,{method:'GET',agent:false,servername:u.hostname,family:selected.family,
        lookup:(_host,options,callback)=>options.all?callback(null,[selected]):callback(null,selected.address,selected.family),
        headers:{'User-Agent':'GtmOsResearch/4.0','Accept':'text/html,text/plain,application/json,application/rss+xml,application/xml','Accept-Encoding':'identity'}},res=>{
        const chunks:Buffer[]=[];let size=0;
        if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();reject(new GtmError('CONTENT_ENCODING','Encoded bodies denied'));return;}
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2*1024*1024){res.destroy(new GtmError('CONTENT_LENGTH','Response exceeds 2MiB'));return;}chunks.push(chunk);});
        res.on('error',reject);res.on('end',()=>{this.bytes+=size;const body=Buffer.concat(chunks);resolve({status:res.statusCode??0,body,contentType:String(res.headers['content-type']??''),at:new Date().toISOString(),sha256:sha256(body)});});
      });
      const timer=setTimeout(()=>req.destroy(new GtmError('SOURCE_TIMEOUT','Public request exceeded 20 seconds')),20000);
      req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
    });
  }
  async fetch(uri:string,policy:HostPolicy) {
    const u=checkedUrl(uri,policy);
    const robots=await this.raw(new URL('/robots.txt',u.origin));
    if(![200,404,410].includes(robots.status))throw new GtmError('ROBOTS_UNAVAILABLE','Robots policy unavailable; no target request attempted',4);
    const rules=robots.status===200?robotsPolicy(robots.body.toString('utf8'),u.pathname+u.search):{allowed:true,delaySeconds:1};
    if(!rules.allowed)throw new GtmError('ROBOTS_DENIED','Robots disallows this target',3);
    const clock=this.clocks.get(u.hostname)!;this.clocks.set(u.hostname,{...clock,delay:rules.delaySeconds});
    const response=await this.raw(u);
    if(response.status!==200)throw new GtmError('SOURCE_UNAVAILABLE',`HTTP_${response.status}; redirects and authentication are not followed`,4);
    if(!/(?:text\/|application\/(?:json|rss\+xml|atom\+xml|xml|xhtml\+xml))/.test(response.contentType))throw new GtmError('CONTENT_TYPE','Unsupported public body type');
    return {...response,robotsSha256:robots.sha256,crawlDelaySeconds:rules.delaySeconds};
  }
}
