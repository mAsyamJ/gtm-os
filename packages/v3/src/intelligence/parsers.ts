import { spawnSync } from 'node:child_process';
import { safePath } from '../../../core/src/workspace.js';
import { GtmError } from '../../../observability/src/index.js';
import { z } from 'zod';

export function parseFeed(root:string,body:string) {
  const p=spawnSync('/home/ubuntu/.local/share/uv/tools/agent-reach/bin/python',['-I',safePath(root,'adapters/research/v4_parse.py'),'rss'],{input:body,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}});
  if(p.status!==0||p.error)throw new GtmError('RSS_COMPONENT_BLOCKED','Audited parser unavailable or XML denied; no fallback installation',4);
  return z.object({items:z.array(z.object({title:z.string(),uri:z.url(),author:z.string().nullable(),summary:z.string(),publishedAt:z.string().nullable()})),networkRequests:z.literal(0),credentialsRead:z.literal(false)}).parse(JSON.parse(p.stdout));
}
export function parseHtml(root:string,body:string) {
  const p=spawnSync('/home/ubuntu/agent-control-plane/adapters/scrapling/.venv/bin/python',['-I',safePath(root,'adapters/research/v4_parse.py'),'html'],{input:body,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}});
  if(p.status!==0||p.error)throw new GtmError('HTML_COMPONENT_BLOCKED','Audited parser unavailable; no browser or stealth fallback',4);
  return z.object({title:z.string().nullable(),paragraphs:z.array(z.string()),networkRequests:z.literal(0),credentialsRead:z.literal(false)}).parse(JSON.parse(p.stdout));
}
