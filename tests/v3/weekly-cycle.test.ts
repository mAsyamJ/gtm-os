import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { workspace } from '../phase-b/helpers.js';
import { HANDLES, type Tenant } from '../../packages/schemas/src/index.js';
import { sha256 } from '../../packages/observability/src/index.js';
import { ingestEvidence, reviewEvidence } from '../../packages/v3/src/evidence.js';
import { open, records } from '../../packages/v3/src/common.js';
import { immutableFile } from '../../packages/creative/src/common.js';
import { runCycle } from '../../packages/v3/src/workflows.js';
import { importDecision, packetById } from '../../packages/v3/src/distribution.js';
import { importMetrics, scorecards } from '../../packages/v3/src/analytics.js';

for (const tenant of ['founder','retropick'] as Tenant[]) test(`${tenant} completes all ten weekly stages using visibly synthetic observations`, async () => {
  const f=workspace();
  try {
    const file=(area:string,name:string,value:unknown)=>{
      const p=`${area}/inbox/${tenant}/${name}.json`;mkdirSync(join(f.root,area,'inbox',tenant),{recursive:true});writeFileSync(join(f.root,p),JSON.stringify(value));return p;
    };
    const now=Date.now();const text='The documented example does not prove live user activity.';
    const source=ingestEvidence(f.root,tenant,file('research','source',{id:`${tenant}-weekly-source`,tenant,title:'Synthetic weekly cycle fixture',
      uri:'https://example.org/weekly',revision:'synthetic-one',observedAt:new Date(now-3*86400000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),text,contentSha256:sha256(text),license:'SYNTHETIC_FIXTURE_ONLY',statements:[text]}),'SYNTHETIC');
    reviewEvidence(f.root,tenant,file('research','review',{evidenceId:source.id,evidenceSha256:source.sha256,classification:'REVIEWED_SOURCE',actor:'source-reviewer',permittedClaims:[text],authenticFirstPerson:false}),'SYNTHETIC');
    let renders=0;
    const render=async(draftId:string)=>{
      renders++;const dir=`runtime/v3/${tenant}/synthetic-test-media`;mkdirSync(join(f.root,dir),{recursive:true});
      const files=['fixture.png','fixture.mp4'].map(name=>immutableFile(f.root,`${dir}/${name}`,'INVALID MEDIA; SYNTHETIC POLICY TEST ONLY'));
      using store=open(f.root,tenant,'SYNTHETIC');const value={id:`${tenant}-weekly-creative`,tenant,label:'SYNTHETIC',draftId,files};store.put('creative',value);return value;
    };
    const key=`${tenant}-weekly-fixture`;
    const waiting=await runCycle(f.root,tenant,key,'SYNTHETIC',render);expect(waiting.state).toBe('AWAITING_APPROVAL');
    const packet=packetById(f.root,tenant,String(waiting.packetId),'SYNTHETIC');
    const event=(event:string,offset:number,extra={})=>importDecision(f.root,tenant,file('distribution',event,{tenant,packetId:packet.id,payloadSha256:packet.payloadSha256,account:HANDLES[tenant],actor:'owner',at:new Date(now-2*86400000+offset).toISOString(),event,...extra}),'SYNTHETIC');
    event('APPROVE_MANUAL',0,{editorialReviewed:true,creativeReviewed:true,authenticityReviewed:true,expiresAt:new Date(now+86400000).toISOString()});event('HANDOFF',1000);
    event('OWNER_REPORTED_PUBLISHED',2000,{postUrl:`https://x.com/${HANDLES[tenant]}/status/1234567890`});
    expect((await runCycle(f.root,tenant,key,'SYNTHETIC',render)).blocker).toBe('MEASUREMENT_REQUIRED');
    importMetrics(f.root,tenant,file('growth','metrics',[{tenant,packetId:packet.id,observedAt:new Date(now-86400000).toISOString(),metric:tenant==='founder'?'qualified_engagements':'qualified_acquisition',value:2,denominator:null,
      windowStart:new Date(now-2*86400000).toISOString(),windowEnd:new Date(now-1.5*86400000).toISOString(),origin:'OWNER_EXPORT',definition:'Synthetic fixture observations; never a verified business outcome',sourceSha256:sha256('synthetic fixture'),outcomeVerification:'OWNER_ATTESTED',semantics:'CUMULATIVE_SNAPSHOT'}]),'SYNTHETIC');
    const complete=await runCycle(f.root,tenant,key,'SYNTHETIC',render);
    expect(complete).toMatchObject({state:'RETROSPECTIVE_COMPLETED',realCycleCompleted:false,label:'SYNTHETIC'});expect(complete.handoffs).toHaveLength(10);expect(renders).toBe(1);
    expect((await runCycle(f.root,tenant,key,'SYNTHETIC',render)).id).toBe(complete.id);
    expect(scorecards(f.root,tenant,'SYNTHETIC').engineering.completedCycles).toBe(1);
    expect(scorecards(f.root,tenant,'SYNTHETIC').business.verifiedConversions).toBeNull();
    expect(records(f.root,tenant,'publication')).toHaveLength(0);
  } finally {f.cleanup();}
});
