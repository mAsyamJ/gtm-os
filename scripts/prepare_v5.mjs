#!/usr/bin/env node
/** Local source-grounded candidates only. Never creates owner approvals or calls Buffer. */
import { mkdirSync } from 'node:fs';
import { usable } from '../dist/packages/v3/src/evidence.js';
import { hashObject } from '../dist/packages/observability/src/index.js';
import { BufferPublisherAdapter } from '../dist/packages/v5/src/buffer.js';
import { PublishingService } from '../dist/packages/v5/src/publishing.js';
import { timeDisplay } from '../dist/packages/v5/src/time.js';
import { immutableFile } from '../dist/packages/creative/src/common.js';
import { calendar, daily, researchQueue, weekly } from '../dist/packages/v5/src/gtm.js';

const root=process.cwd(),now=new Date();
const concepts={
  retropick:{text:'RetroPick’s documented testnet flow moves from bonding discovery to Kuru orderbook trading. Graduation alone doesn’t establish depth or demand.\n\nWhat quoted liquidity would you want to see before trading?\n\nUnaudited Monad Testnet.',zone:'America/New_York',needle:'retropick-product'},
  founder:{text:'Passing a test is one checkpoint. I want to see what happens when a completion transaction is retried: do state, receipts and balances still agree?\n\nWhich failure path would you test first before calling a trading flow production-ready?',zone:'America/New_York',needle:'retropick-product'}
};
const reports=[];
for(const tenant of ['retropick','founder']) {
  const concept=concepts[tenant],cards=usable(root,tenant).filter(c=>c.source.id.includes(concept.needle));
  if(cards.length!==1)throw new Error(`Expected one separately reviewed product source for ${tenant}`);
  const card=cards[0];
  const refs=card.claims.filter(statement=>tenant==='retropick'?/bonding|unaudited|depth|market-dependent/i.test(statement):/Factory|Coordinator|complete|receipt|retry|account/i.test(statement))
    .map(statement=>({evidenceId:card.source.id,evidenceSha256:hashObject(card.source),reviewSha256:hashObject(card.review),statement}));
  const service=new PublishingService(root,tenant,new BufferPublisherAdapter(root));
  const packet=service.createPacket({tenant,text:concept.text,evidence:refs,firstPersonExperience:false,media:[]});
  const plan=calendar(root,tenant,undefined,now);
  const next=plan.entries.find(e=>Date.parse(e.dueAt)>now.getTime()+30*60000);
  if(!next)throw new Error(`No future compatible schedule slot for ${tenant}; inspect publishing calendar`);
  const slot=next.localSlot,dueAt=next.dueAt;
  const candidate={schemaVersion:5,tenant,account:tenant==='founder'?'@iHateModelsss':'@RetroPickMarket',packetId:packet.id,text:packet.text,contentHash:packet.contentHash,
    candidateSlot:timeDisplay(dueAt,concept.zone),targetZone:concept.zone,localSlot:slot,dueAt,timingBasis:next.timingBasis,source:{id:card.source.id,uri:card.source.uri,revision:card.source.revision,expiresAt:card.source.expiresAt,license:card.source.license},
    evidence:refs,media:[],assetSource:'ORIGINAL_PARAPHRASED_TEXT; source rights separately reviewed',intendedAudience:tenant==='retropick'?'US crypto-native creators and market-structure readers':'US technical builders and reliability engineers',
    revision:'v5-initial-two-posts-r2',status:'DRAFT_NOT_APPROVABLE_ACCOUNT_DISCOVERY_REQUIRED',approvalStatus:'PENDING_OWNER',
    providerPrincipal:null,channelId:null,payloadSha256:null,costForecastUsd:0,externalWrites:0,
    limitations:['Slot is a proposal; if it passes, regenerate preview and obtain fresh approval.','Final scheduling hash cannot exist before authenticated principal/channel discovery.','No personal shipment, current trading depth, audit or production readiness is claimed.']};
  const directory=`runtime/v5/${tenant}/observed/candidates`;mkdirSync(directory,{recursive:true});
  const file=immutableFile(root,`${directory}/${hashObject(candidate)}.json`,JSON.stringify(candidate,null,2)+'\n');
  reports.push({tenant,candidate:file,calendar:plan,conversations:researchQueue(root,tenant,'conversations'),prospects:researchQueue(root,tenant,'prospects'),weekly:weekly(root,tenant)});
}
const report={schemaVersion:5,at:now.toISOString(),status:'DRAFTS_PREPARED_LIVE_BLOCKED',reports,daily:daily(root,'founder'),externalWrites:0};
const directory='runtime/v5/preparation';mkdirSync(directory,{recursive:true});
const receipt=immutableFile(root,`${directory}/${hashObject(report)}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,receipt,reports:reports.map(r=>({tenant:r.tenant,candidate:r.candidate.path}))},null,2));
