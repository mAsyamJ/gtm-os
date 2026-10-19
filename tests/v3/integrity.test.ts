import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { workspace } from '../phase-b/helpers.js';
import { sha256 } from '../../packages/observability/src/index.js';
import { ingestEvidence, reviewEvidence } from '../../packages/v3/src/evidence.js';
import { draftContent, integrity, humanize } from '../../packages/v3/src/editorial.js';
import { open } from '../../packages/v3/src/common.js';
import { manualPack, importDecision, publicationHistory } from '../../packages/v3/src/distribution.js';
import { importMetrics, scorecards } from '../../packages/v3/src/analytics.js';
import { runCycle } from '../../packages/v3/src/workflows.js';
import { immutableFile } from '../../packages/creative/src/common.js';

let f: ReturnType<typeof workspace>;
beforeEach(() => { f = workspace(); }); afterEach(() => {vi.useRealTimers();f.cleanup();});
function file(area: string, name: string, value: unknown) {
  const path = `${area}/inbox/founder/${name}.json`; mkdirSync(join(f.root, area, 'inbox/founder'), { recursive: true });
  writeFileSync(join(f.root, path), JSON.stringify(value)); return path;
}
const claim = 'The example does not establish a performance improvement.';
function seed() {
  const source = ingestEvidence(f.root, 'founder', file('research', 'source', { id: 'founder-source', tenant: 'founder', title: 'Synthetic evidence fixture',
    uri: 'https://example.org/source', revision: 'fixture-one', observedAt: new Date(Date.now()-4*86400000).toISOString(), expiresAt: new Date(Date.now()+86400000).toISOString(),
    text: claim, contentSha256: sha256(claim), license: 'SYNTHETIC_FIXTURE_ONLY', statements: [claim] }), 'SYNTHETIC');
  reviewEvidence(f.root, 'founder', file('research', 'review', { evidenceId: source.id, evidenceSha256: source.sha256,
    classification: 'REVIEWED_SOURCE', actor: 'owner', permittedClaims: [claim], authenticFirstPerson: false }), 'SYNTHETIC');
  return humanize(f.root, 'founder', draftContent(f.root, 'founder', 'thread', source.id, 'SYNTHETIC').id, 'SYNTHETIC');
}
async function fixtureCreative(draftId: string) {
  const base = 'runtime/v3/founder/test-media'; mkdirSync(join(f.root, base), { recursive: true });
  using store = open(f.root, 'founder', 'SYNTHETIC');
  const files = ['fixture.png','fixture.mp4'].map(n => immutableFile(f.root, `${base}/${n}`, 'SYNTHETIC TEST BYTES; NOT VALID MEDIA'));
  const r = { id: 'founder-creative-fixture', tenant: 'founder', label: 'SYNTHETIC', draftId, files }; store.put('creative', r); return r;
}
async function packet() { const d = seed(); await fixtureCreative(d.id); return manualPack(f.root, 'founder', d.id, 'SYNTHETIC'); }
function decision(p: Awaited<ReturnType<typeof packet>>, event: string, offset: number, extra = {}) {
  const now = Date.now(); return file('distribution', event, { tenant: 'founder', packetId: p.id, payloadSha256: p.payloadSha256,
    account: 'iHateModelsss', actor: 'owner', at: new Date(now-2*86400000+offset).toISOString(), event, ...extra });
}
async function publish() {
  const p = await packet();
  importDecision(f.root, 'founder', decision(p,'APPROVE_MANUAL',0,{ editorialReviewed:true,creativeReviewed:true,authenticityReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString() }), 'SYNTHETIC');
  importDecision(f.root, 'founder', decision(p,'HANDOFF',1000), 'SYNTHETIC');
  const path = decision(p,'OWNER_REPORTED_PUBLISHED',2000,{postUrl:'https://x.com/iHateModelsss/status/1234567890'});
  importDecision(f.root, 'founder', path, 'SYNTHETIC');
  expect(importDecision(f.root, 'founder', path, 'SYNTHETIC').duplicate).toBe(true); return p;
}
test('deterministic editing rejects a dropped negation, added number and extra first-person achievement', () => {
  const draft = seed();
  for (const replacement of ['The example establishes a performance improvement.', 'It is 20 times faster.', 'I shipped this system.'])
    expect(() => integrity(draft, draft.blocks.map(b => b===claim?replacement:b))).toThrow('Unsupported additions');
});
test('source reviewers can review documentary evidence without impersonating the owner', () => {
  const source = ingestEvidence(f.root, 'founder', file('research','source',{id:'founder-document',tenant:'founder',title:'Document',uri:'https://example.org/doc',revision:'one',
    observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),text:claim,contentSha256:sha256(claim),license:'MIT',statements:[claim]}));
  expect(reviewEvidence(f.root,'founder',file('research','review',{evidenceId:source.id,evidenceSha256:source.sha256,classification:'REVIEWED_SOURCE',actor:'source-reviewer',permittedClaims:[claim],authenticFirstPerson:false})).label).toBe('REVIEWED_SOURCE');
  expect(() => reviewEvidence(f.root,'founder',file('research','forgery',{evidenceId:source.id,evidenceSha256:source.sha256,classification:'OWNER_ATTESTED',actor:'source-reviewer',permittedClaims:[claim],authenticFirstPerson:true}))).toThrow();
});
test('manual approval binds payload and real review gates; native publication remains owner-attested', async () => {
  const p = await packet();
  expect(() => importDecision(f.root,'founder',decision(p,'APPROVE_MANUAL',0,{payloadSha256:'0'.repeat(64)}),'SYNTHETIC')).toThrow('exact payload');
  expect(() => importDecision(f.root,'founder',decision(p,'OWNER_REPORTED_PUBLISHED',0,{postUrl:'https://x.com/RetroPickMarket/status/1'}),'SYNTHETIC')).toThrow('approval');
  importDecision(f.root,'founder',decision(p,'APPROVE_MANUAL',0,{editorialReviewed:true,creativeReviewed:true,authenticityReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString()}),'SYNTHETIC');
  importDecision(f.root,'founder',decision(p,'HANDOFF',1000),'SYNTHETIC');
  expect(() => importDecision(f.root,'founder',decision(p,'OWNER_REPORTED_PUBLISHED',2000,{postUrl:'https://x.com/RetroPickMarket/status/1'}),'SYNTHETIC')).toThrow('selected account');
  expect(publicationHistory(f.root,'founder',p.id,'SYNTHETIC').at(-1)?.state).toBe('HANDED_OFF');
});
test('metric import is atomic, rejects self-verification and selects the latest snapshot instead of summing', async () => {
  const p = await publish(); const now = Date.now();
  const metric = {tenant:'founder',packetId:p.id,observedAt:new Date(now-86400000).toISOString(),metric:'impressions',value:10,denominator:null,
    windowStart:new Date(now-3*86400000).toISOString(),windowEnd:new Date(now-1.5*86400000).toISOString(),origin:'OWNER_EXPORT',definition:'Owned impression snapshot; fixture only',sourceSha256:'1'.repeat(64),outcomeVerification:'OWNER_ATTESTED',semantics:'CUMULATIVE_SNAPSHOT'};
  const path = file('growth','metrics',[metric]);
  expect(importMetrics(f.root,'founder',path,'SYNTHETIC').inserted).toBe(1);
  expect(importMetrics(f.root,'founder',path,'SYNTHETIC').duplicates).toBe(1);
  expect(() => importMetrics(f.root,'founder',file('growth','bad',[{...metric,observedAt:new Date(now-86400000+1000).toISOString(),value:15},{...metric,value:99}]),'SYNTHETIC')).toThrow();
  importMetrics(f.root,'founder',file('growth','latest',[{...metric,observedAt:new Date(now-86400000+2000).toISOString(),value:12}]),'SYNTHETIC');
  const report=scorecards(f.root,'founder','SYNTHETIC'); expect(report.business.metrics).toHaveLength(1); expect(report.business.metrics[0]?.value).toBe(12);
  expect(report.business.verifiedConversions).toBe(null);
  expect(() => importMetrics(f.root,'founder',file('growth','authority',[{...metric,outcomeVerification:'PRODUCT_VERIFIED'}]),'SYNTHETIC')).toThrow('self-assign');
});
test('weekly cycle resumes after a synthetic manual handoff without repeating media work or qualifying real promotion', async () => {
  seed(); let renders=0;
  const first=await runCycle(f.root,'founder','founder-cycle','SYNTHETIC',async id => {renders++;return fixtureCreative(id);});
  expect(first.state).toBe('AWAITING_APPROVAL');
  const next=await runCycle(f.root,'founder','founder-cycle','SYNTHETIC',fixtureCreative);
  expect(next.id).toBe(first.id); expect(renders).toBe(1); expect(next.realCycleCompleted).toBe(false);
});
test('completed cycles lose eligibility after owner invalidation',async()=>{
  const p=await publish();const now=Date.now();
  importMetrics(f.root,'founder',file('growth','cycle-metric',[{tenant:'founder',packetId:p.id,observedAt:new Date(now-86400000).toISOString(),metric:'impressions',value:10,denominator:null,
    windowStart:new Date(now-3*86400000).toISOString(),windowEnd:new Date(now-1.5*86400000).toISOString(),origin:'OWNER_EXPORT',definition:'Synthetic owned fixture snapshot',sourceSha256:'1'.repeat(64),outcomeVerification:'OWNER_ATTESTED',semantics:'CUMULATIVE_SNAPSHOT'}]),'SYNTHETIC');
  const complete=await runCycle(f.root,'founder','founder-complete-cycle','SYNTHETIC',fixtureCreative);expect(complete.state).toBe('RETROSPECTIVE_COMPLETED');
  importDecision(f.root,'founder',decision(p,'INVALIDATE',3000),'SYNTHETIC');
  const stopped=await runCycle(f.root,'founder','founder-complete-cycle','SYNTHETIC',fixtureCreative);expect(stopped.state).toBe('AWAITING_APPROVAL');
});
test('historical owner metrics remain importable after source freshness expires',async()=>{
  const p=await publish();const then=Date.now();vi.useFakeTimers();vi.setSystemTime(then+8*86400000);
  const result=importMetrics(f.root,'founder',file('growth','historical',[{tenant:'founder',packetId:p.id,observedAt:new Date().toISOString(),metric:'impressions',value:0,denominator:null,
    windowStart:new Date(then-3*86400000).toISOString(),windowEnd:new Date().toISOString(),origin:'OWNER_EXPORT',definition:'Synthetic post observation after freshness expiry',sourceSha256:'2'.repeat(64),outcomeVerification:'OWNER_ATTESTED',semantics:'CUMULATIVE_SNAPSHOT'}]),'SYNTHETIC');
  expect(result.inserted).toBe(1);
});
test('owner can invalidate an expired packet without renewing publication authority',async()=>{
  const p=await publish();const then=Date.now();vi.useFakeTimers();vi.setSystemTime(then+8*86400000);
  const path=file('distribution','expired-invalidation',{tenant:'founder',packetId:p.id,payloadSha256:p.payloadSha256,account:p.account,
    actor:'owner',at:new Date().toISOString(),event:'INVALIDATE'});
  expect(importDecision(f.root,'founder',path,'SYNTHETIC')).toMatchObject({state:'INVALIDATED'});
});
