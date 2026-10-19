import { beforeEach, afterEach, expect, test } from 'vitest';
import { workspace } from '../phase-b/helpers.js';
import { prepareDraft, illustrativeApproval, mockIdentity, simulateDispatch, reconcileDispatch } from '../../packages/distribution/src/index.js';
import { analyticsFixture, ingestEvents, registerLink, analyticsReport } from '../../packages/growth/src/analytics.js';
let f: ReturnType<typeof workspace>;
beforeEach(() => {f=workspace();}); afterEach(()=>f.cleanup());
test.each(['timeout-before-accept','timeout-after-accept'] as const)('synthetic %s does not blindly repeat a publication attempt', fault => {
  const now=new Date(); const draft=prepareDraft(f.root,'founder',{fixture:'synthetic'},now).draft;
  const options={requestKey:'founder-fault-case',approval:illustrativeApproval(draft,now),identity:mockIdentity('founder',now),estimatedUsd:0,fault};
  const r=simulateDispatch(f.root,'founder',draft.id,options,now); expect(r.dispatch.status).toBe('UNKNOWN_OUTCOME');
  expect(simulateDispatch(f.root,'founder',draft.id,options,now).replayed).toBe(true);
  const reconciled=reconcileDispatch(f.root,'founder',options.requestKey);
  expect(reconciled.dispatch.status).toBe(fault==='timeout-after-accept'?'SIMULATED_CONFIRMED':'UNKNOWN_OUTCOME');
  expect(reconciled.blindRetryAllowed).toBe(false);
});
test('synthetic dispatch rejects another account and unknown price',()=>{
  const now=new Date(); const draft=prepareDraft(f.root,'retropick',{fixture:'synthetic'},now).draft;
  expect(()=>simulateDispatch(f.root,'retropick',draft.id,{requestKey:'retropick-unknown-price',approval:illustrativeApproval(draft,now),identity:mockIdentity('retropick',now),estimatedUsd:null},now)).toThrow('denied');
  expect(()=>simulateDispatch(f.root,'retropick',draft.id,{requestKey:'retropick-wrong-account',approval:illustrativeApproval(draft,now),identity:mockIdentity('founder',now),estimatedUsd:0},now)).toThrow('denied');
});
test('event deduplication and ordered funnels do not count submissions as confirmations',()=>{
  const fixture=analyticsFixture('retropick'); registerLink(f.root,'retropick',fixture.link);
  const first=ingestEvents(f.root,'retropick',fixture.batch); expect(first.inserted).toBe(fixture.batch.events.length-1);
  expect(ingestEvents(f.root,'retropick',fixture.batch).inserted).toBe(0);
  const report=analyticsReport(f.root,'retropick',{synthetic:true,period:'7d'});
  expect(report.status).toBe('SYNTHETIC_DATA'); expect(report.funnel).toMatchObject({entrySubjects:4,terminalSubjects:2,conversionRate:.5});
  expect(report.attribution).toMatchObject({attributed:1,unattributed:1});
  const changed={...fixture.batch.events[0]!,name:'trade_confirmed'};
  expect(()=>ingestEvents(f.root,'retropick',{...fixture.batch,events:[{...fixture.batch.events[0]!,id:'retropick-new-event'},changed]})).toThrow();
  expect(ingestEvents(f.root,'retropick',{...fixture.batch,events:[{...fixture.batch.events[0]!,id:'retropick-new-event'}]}).inserted).toBe(1);
});
