import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { workspace } from '../phase-b/helpers.js';
import { hashObject, sha256 } from '../../packages/observability/src/index.js';
import { ingestEvidence, reviewEvidence } from '../../packages/v3/src/evidence.js';
import { inWindow, publicationDate, createBrief, selectedBrief, trends, linkReview } from '../../packages/v3/src/intelligence/research.js';
import { csvRows, importSeeds } from '../../packages/v3/src/intelligence/seeds.js';
import { opportunities, rank } from '../../packages/v3/src/intelligence/opportunities.js';
import { draftBriefContent, draftById, integrity } from '../../packages/v3/src/editorial.js';
import { runCycle } from '../../packages/v3/src/workflows.js';
import { save, list } from '../../packages/v3/src/intelligence/store.js';
import { artifact } from '../../packages/v3/src/common.js';

let f:ReturnType<typeof workspace>;
beforeEach(()=>{f=workspace();});afterEach(()=>f.cleanup());
function json(path:string,value:unknown){mkdirSync(join(f.root,path,'..'),{recursive:true});writeFileSync(join(f.root,path),JSON.stringify(value));return path;}
function evidence(id:string,statement:string){
  const now=new Date(),source=ingestEvidence(f.root,'founder',json(`research/inbox/founder/${id}.json`,{
    id,tenant:'founder',title:'SYNTHETIC engineering fixture',uri:`https://example.org/${id}`,revision:'fixture-r1',
    observedAt:new Date(now.getTime()-1000).toISOString(),expiresAt:new Date(now.getTime()+86400000).toISOString(),text:statement,contentSha256:sha256(statement),license:'SYNTHETIC',statements:[statement],
  }),'SYNTHETIC');
  reviewEvidence(f.root,'founder',json(`research/inbox/founder/${id}-review.json`,{evidenceId:id,evidenceSha256:source.sha256,classification:'REVIEWED_SOURCE',actor:'source-reviewer',permittedClaims:[statement],authenticFirstPerson:false}),'SYNTHETIC');
  return id;
}
const features={evidenceQuality:1,brandFit:1,timelyDiscussion:1,educationalUtility:1,novelty:1,feasibleCta:1};
test('publication windows include exact boundaries but never crawl clocks or future publications',()=>{
  const start='2026-09-19T12:00:00.000Z',end='2026-10-19T12:00:00.000Z';
  expect(inWindow(start,start,end)).toBe(true);expect(inWindow(end,start,end)).toBe(true);
  expect(inWindow('2026-09-19T11:59:59.999Z',start,end)).toBe(false);expect(inWindow('2026-10-19T12:00:00.001Z',start,end)).toBe(false);
  expect(inWindow(null,start,end)).toBe(false);expect(publicationDate('<meta property="article:modified_time" content="2026-10-19">')).toBe(null);
});
test('ranking exposes heuristic meaning and applies risk without inventing engagement',()=>{
  expect(rank(f.root,features,0).score).toBe(100);expect(rank(f.root,features,1).score).toBe(85);
  expect(rank(f.root,features,0).engagement).toBe('UNAVAILABLE_NOT_USED_FOR_SCORE');
  expect(()=>rank(f.root,{...features,brandFit:null},0)).toThrow();
});
test('CSV quoting preserves discovery data and never accepts supplied verification as authority',()=>{
  expect(csvRows('name,note\r\n"A, B","quote ""x"""\r\n')).toEqual([{name:'A, B',note:'quote "x"'}]);
  writeFileSync(join(f.root,'GTM_V4_CRYPTO_PEOPLE_WATCHLIST_SEED.csv'),'person,organization,initial_source_url,brand_relevance,verification_status\nAda,Example,https://example.org/ada,founder,VERIFIED\n');
  writeFileSync(join(f.root,'GTM_V4_CRYPTO_PROJECT_RESEARCH_SEED.csv'),'project,source_url,brand_relevance\nExample,https://example.org,founder\n');
  const value=importSeeds(f.root,'founder','GTM_V4_CRYPTO_PEOPLE_WATCHLIST_SEED.csv','GTM_V4_CRYPTO_PROJECT_RESEARCH_SEED.csv','SYNTHETIC');
  expect(value.verifiedPeople).toBe(0);expect(value.entities[0]).toMatchObject({identityStatus:'UNVERIFIED',roleStatus:'UNKNOWN',xHandle:null});
});
test('selected briefs bind multiple reviewed sources while unrelated ingestion preserves cycle recovery',async()=>{
  const ids=[evidence('founder-first','SYNTHETIC accounting stays bounded.'),evidence('founder-second','SYNTHETIC completion has a receipt.')];
  const file=json('research/inbox/founder/topic.json',{tenant:'founder',topicId:'founder-test-topic',title:'Inspect completion',safeAngle:'Which receipt proves completion?',sourceIds:ids,temporalScope:'BACKGROUND',features,risk:0,counterEvidence:[],counterargument:'A receipt does not establish adoption.'});
  opportunities(f.root,'founder','SYNTHETIC',file);const brief=createBrief(f.root,'founder','founder-test-topic','SYNTHETIC');
  const draft=draftBriefContent(f.root,'founder',brief.id,'thread',0,'SYNTHETIC');
  expect(draft.sourceIds).toEqual(ids);expect(draft.claims).toHaveLength(2);
  for(let i=0;i<5;i++)expect(draftBriefContent(f.root,'founder',brief.id,'post',i,'SYNTHETIC').blocks.join('\n\n').length).toBeLessThanOrEqual(280);
  expect(()=>integrity(draft,[...draft.blocks,'Guaranteed profits.'])).toThrow();
  const first=await runCycle(f.root,'founder','founder-selected','SYNTHETIC',async()=>({fixture:'LOCAL_TEST_NO_MEDIA'}),{briefId:brief.id,draftId:draft.id});
  evidence('founder-unrelated','SYNTHETIC unrelated research.');
  expect(hashObject(selectedBrief(f.root,'founder',brief.id,'SYNTHETIC'))).toBe(hashObject(brief));
  const resumed=await runCycle(f.root,'founder','founder-selected','SYNTHETIC',async()=>{throw new Error('Must not rerender');},{briefId:brief.id,draftId:draft.id});
  expect(resumed.id).toBe(first.id);expect(resumed.realCycleCompleted).toBe(false);
});
test('rolling opportunities cannot be forged from undated background evidence',()=>{
  const id=evidence('founder-background','SYNTHETIC source without publication metadata.');
  const file=json('research/inbox/founder/forged.json',{tenant:'founder',topicId:'founder-forged',title:'False recency',safeAngle:'A question?',sourceIds:[id],temporalScope:'ROLLING_30D',features,risk:0,counterEvidence:[],counterargument:'Unknown.'});
  expect(()=>opportunities(f.root,'founder','SYNTHETIC',file)).toThrow(/publication/i);
});
test('public canonical IDs do not create cross-tenant graph joins',()=>{
  save(f.root,'founder','trend',{topicId:'public-same',sourceIds:[],status:'EVIDENCE_GAP'},'SYNTHETIC');
  expect(list(f.root,'retropick','trend','SYNTHETIC')).toEqual([]);
});
test('equivalent object key ordering does not overwrite or invalidate immutable artifacts',()=>{
  const first=artifact(f.root,'founder','stage-qa',{nested:{a:1,b:2},status:'HOLD'});
  const second=artifact(f.root,'founder','stage-qa',{status:'HOLD',nested:{b:2,a:1}});
  expect(second.path).toBe(first.path);expect(second.sha256).toBe(first.sha256);
});
function topic(topicId:string,ids:string[],temporalScope='BACKGROUND',safeAngle='Inspect the source.') {
  return opportunities(f.root,'founder','SYNTHETIC',json('research/inbox/founder/selection.json',{tenant:'founder',topicId,title:'Completion',safeAngle,sourceIds:ids,temporalScope,features,risk:0,counterEvidence:[],counterargument:'Unknown.'}));
}
function observation(id:string,statement:string,publishedAt:string) {
  return save(f.root,'founder','source',{uri:`https://example.org/${id}`,canonicalUrl:`https://example.org/${id}`,sourceId:'fixture-source',pillar:'engineering',title:'SYNTHETIC',author:null,publishedAt,retrievedAt:new Date().toISOString(),responseSha256:sha256(statement),contentSha256:sha256(statement),excerpt:statement,hashScope:'HTTP_RESPONSE_BODY',license:'SYNTHETIC',status:'COLLECTED',error:null,engagement:{},platform:'DOCS',duplicateKey:sha256(statement),publicationClock:'VERIFIED_METADATA',evidenceId:null,reviewId:null},'SYNTHETIC');
}
for(const unsafe of ['I built this mechanism.','Guaranteed profits.'])test(`post length fitting validates final claim: ${unsafe}`,()=>{
  const ids=[evidence('founder-long','SYNTHETIC '+ 'A bounded engineering claim. '.repeat(15)),evidence('founder-unsafe',unsafe)];
  topic('founder-fitting',ids);const brief=createBrief(f.root,'founder','founder-fitting','SYNTHETIC');
  expect(()=>draftBriefContent(f.root,'founder',brief.id,'post',0,'SYNTHETIC')).toThrow(/attestation|promotion/i);
});
test('identical text cannot transfer publication recency without explicit source and review linkage',()=>{
  const statement='SYNTHETIC exact accounting fixture.';evidence('founder-undated',statement);
  observation('founder-different-uri',statement,new Date().toISOString());
  expect(trends(f.root,'founder','SYNTHETIC').trends).toHaveLength(0);
});
test('corrected stable topic selects the newest immutable opportunity revision',()=>{
  const id=evidence('founder-revision','SYNTHETIC bounded receipt.');
  topic('founder-revision-topic',[id],'BACKGROUND','Old question.');
  topic('founder-revision-topic',[id],'BACKGROUND','Corrected question.');
  expect(createBrief(f.root,'founder','founder-revision-topic','SYNTHETIC').angle).toBe('Corrected question.');
});
test('rolling briefs freeze linked publication evidence and reject an advanced stale window',()=>{
  const statement='SYNTHETIC dated engineering receipt.',id=evidence('founder-dated',statement),now=new Date();
  const o=observation(id,statement,now.toISOString());
  linkReview(f.root,'founder',json('research/inbox/founder/link.json',{observationId:o.id,evidenceId:id}),'SYNTHETIC');
  topic('founder-rolling',[id],'ROLLING_30D');
  const brief=createBrief(f.root,'founder','founder-rolling','SYNTHETIC');
  expect(brief.publicationEvidence).toBeDefined();
  save(f.root,'founder','collection',{...{windowStartUtc:new Date(now.getTime()+86400000).toISOString(),windowEndUtc:new Date(now.getTime()+31*86400000).toISOString()},profile:'crypto',sourceIds:[],coverage:[],networkRequests:0,bodyBytes:0,status:'PARTIAL_COVERAGE',approvalStatus:'HOLD'},'SYNTHETIC');
  expect(()=>createBrief(f.root,'founder','founder-rolling','SYNTHETIC')).toThrow(/publication/i);
  expect(()=>selectedBrief(f.root,'founder',brief.id,'SYNTHETIC')).toThrow(/publication/i);
});
test('historical draft validation retains the publication clock after source expiry',()=>{
  const at=new Date(),id=evidence('founder-historic','SYNTHETIC bounded historical receipt.');
  topic('founder-historic-topic',[id]);const brief=createBrief(f.root,'founder','founder-historic-topic','SYNTHETIC');
  const draft=draftBriefContent(f.root,'founder',brief.id,'thread',0,'SYNTHETIC');
  vi.useFakeTimers();vi.setSystemTime(new Date(at.getTime()+2*86400000));
  try {expect(()=>draftById(f.root,'founder',draft.id,'SYNTHETIC',at)).not.toThrow();expect(()=>draftById(f.root,'founder',draft.id,'SYNTHETIC')).toThrow();}
  finally {vi.useRealTimers();}
});
