import { afterEach, beforeEach, expect, test } from 'vitest';
import { workspace } from '../phase-b/helpers.js';
import { isPublicAddress, robotsPolicy, checkedUrl } from '../../packages/v3/src/intelligence/http.js';
import { reserve } from '../../packages/v3/src/intelligence/quota.js';
import { IntelligenceStore, save, list } from '../../packages/v3/src/intelligence/store.js';

let f: ReturnType<typeof workspace>;
beforeEach(()=>{f=workspace();});afterEach(()=>f.cleanup());
test.each(['127.0.0.1','10.2.3.4','169.254.169.254','100.64.0.1','198.18.0.1','224.0.0.1','::1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::'])('SSRF address %s is denied',address=>expect(isPublicAddress(address)).toBe(false));
test('public addresses and crawl delays survive policy normalization',()=>{
  expect(isPublicAddress('1.1.1.1')).toBe(true);expect(isPublicAddress('2606:4700::1111')).toBe(true);
  expect(robotsPolicy('User-agent: *\nDisallow: /private\nAllow: /private/public\nCrawl-delay: 3','/private/public')).toEqual({allowed:true,delaySeconds:3});
  expect(robotsPolicy('User-agent: *\nDisallow: /private','/private/token').allowed).toBe(false);
});
test('robots rules cannot be bypassed using encoded unreserved characters or wildcard backtracking',()=>{
  expect(robotsPolicy('User-agent: *\nDisallow: /private','/%70rivate/report').allowed).toBe(false);
  expect(robotsPolicy('User-agent: *\nDisallow: /data*end$','/data/one/end/other/end').allowed).toBe(false);
  expect(robotsPolicy('User-agent: *\nDisallow: /data*end$','/data/end/other').allowed).toBe(true);
});
test('URL policy rejects credentials, unapproved queries and host confusion',()=>{
  expect(()=>checkedUrl('https://api.x.com/research',{host:'api.x.com',prefixes:['/'],queryKeys:[]})).toThrow(/prohibited/i);
  expect(()=>checkedUrl('https://api.github.com.evil.test/repos/a/b',{host:'api.github.com',prefixes:['/repos/'],queryKeys:[]})).toThrow();
  expect(()=>checkedUrl('https://api.github.com/repos/a/b?token=foo',{host:'api.github.com',prefixes:['/repos/'],queryKeys:[]})).toThrow();
  expect(()=>checkedUrl('http://api.github.com/repos/a/b',{host:'api.github.com',prefixes:['/repos/'],queryKeys:[]})).toThrow();
});
test('quotas persist across independent calls and failures consume reservation',()=>{
  reserve(f.root,'founder','model',4);
  expect(()=>reserve(f.root,'founder','model')).toThrow(/quota/i);
  expect(reserve(f.root,'retropick','model',4).totalUsed).toBe(8);
  expect(()=>reserve(f.root,'retropick','model')).toThrow();
});
test('append-only graph records are tenant and dataset separated',()=>{
  const v=save(f.root,'founder','trend',{title:'SYNTHETIC fixture'},'SYNTHETIC');
  expect(list(f.root,'retropick','trend','SYNTHETIC')).toEqual([]);
  expect(list(f.root,'founder','trend')).toEqual([]);
  using store=new IntelligenceStore(f.root,'founder','SYNTHETIC');
  expect(()=>store.put('trend',{...v,title:'changed'})).toThrow(/changed/i);
  expect(()=>store.put('trend',{...v,id:'foreign',tenant:'retropick'})).toThrow();
});
