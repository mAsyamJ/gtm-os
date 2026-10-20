#!/usr/bin/env node
import { mkdirSync,writeFileSync } from 'node:fs';
import { PublicTransport } from '../dist/packages/v3/src/intelligence/http.js';
import { sourcePolicies } from '../dist/packages/v3/src/intelligence/research.js';
import { sha256 } from '../dist/packages/observability/src/index.js';
const root=process.cwd(),transport=new PublicTransport(root,'retropick');
const policy=sourcePolicies(root).find(s=>s.id==='retropick-product');
const revision='464dca136e9765d638e742a810ab58af0e911376',directory=`runtime/v4/product-audit/${Date.now()}`;
mkdirSync(directory,{recursive:true});const sources=[];
for(const path of ['contracts/src/v2/GraduationCoordinatorV2.sol','contracts/src/v2/KuruGraduationExecutorV2.sol','deployments/monad-testnet/v2.json']){
  const uri=`https://raw.githubusercontent.com/RetroPick/retropick-protocol/${revision}/${path}`;
  try{const value=await transport.fetch(uri,policy),file=`${directory}/${path.split('/').at(-1)}`;writeFileSync(file,value.body,{flag:'wx'});
    const text=value.body.toString();sources.push({path,uri,revision,retrievedAt:value.at,bodySha256:value.sha256,file,bytes:value.body.length,
      inspectedLines:text.split('\n').map((line,i)=>({line:i+1,text:line})).filter(v=>/function (?:complete|secure|execute|receipt|available)|packetHash|destinationIdentity|executorCodeHash|nonReentrant|codehash/.test(v.text)).slice(0,30),
      license:'MIT_WITH_REPOSITORY_THIRD_PARTY_NOTICES',status:'RETRIEVED_FOR_SOURCE_INSPECTION'});
  }catch(e){sources.push({path,uri,status:'SOURCE_UNAVAILABLE',error:e.code??'SOURCE_UNAVAILABLE'});}
}
const receipt={revision,at:new Date().toISOString(),sources,networkRequests:transport.requests,bodyBytes:transport.bytes,
  liveChainVerification:false,limitations:['Code inspection and a deployment manifest are documentary evidence; deployed bytecode and current liquidity were not independently checked.']};
const file=`${directory}/receipt.json`;writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({file,sha256:sha256(JSON.stringify(receipt,null,2)+'\n'),sources},null,2));
