import sharp from 'sharp';
import { immutableFile } from '../../../creative/src/common.js';
import { safeDirectory } from '../../../core/src/workspace.js';
import { context, type Dataset } from '../common.js';
import { draftById } from '../editorial.js';

export async function intelligenceDiagrams(root:string,selected:unknown,draftId:string,dataset:Dataset='OBSERVED') {
  const c=context(root,selected,dataset),draft=draftById(root,c.tenant,draftId,dataset);
  const directory=`runtime/v3/${c.tenant}/v4-diagrams/${draftId}`;safeDirectory(root,directory);
  const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const diagrams=c.tenant==='founder'?
    [{name:'accounting-boundary',title:'Inspect the accounting boundary',nodes:['Factory','Coordinator','Venue executor']},
      {name:'completion-proof',title:'Check the completion evidence',nodes:['Transition','Receipt','Bounded retry']}]:
    [{name:'launch-lifecycle',title:'Read the documented testnet lifecycle',nodes:['Bonding discovery','Graduation','Kuru market']},
      {name:'liquidity-boundary',title:'Keep liquidity claims bounded',nodes:['Custody evidence','Market conditions','Trading risk']}];
  const files:ReturnType<typeof immutableFile>[]=[];
  for(const diagram of diagrams){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#111827"/><g font-family="DejaVu Sans" fill="#f9fafb"><text x="100" y="140" font-size="42">${escape(diagram.title)}</text>${diagram.nodes.map((node,i)=>`<rect x="${100+i*500}" y="300" width="400" height="200" rx="20" fill="#1f2937" stroke="#94a3b8" stroke-width="3"/><text x="${300+i*500}" y="410" text-anchor="middle" font-size="30">${escape(node)}</text>${i<2?`<path d="M ${510+i*500} 400 h 70 l -14 -12 m 14 12 l -14 12" stroke="#e2e8f0" stroke-width="4" fill="none"/>`:''}`).join('')}<text x="100" y="660" font-size="25">SOURCE-REVIEWED EXPLANATION / EDITORIAL PROTOTYPE</text><text x="100" y="710" font-size="24">Historical testnet evidence; no current liquidity or production-readiness claim.</text><text x="100" y="790" font-size="23">Exact wording, diagram semantics and branding require owner review.</text></g></svg>`;
    const png=await sharp(Buffer.from(svg)).png().toBuffer();
    files.push(immutableFile(root,`${directory}/${diagram.name}.svg`,svg),immutableFile(root,`${directory}/${diagram.name}.png`,png),
      immutableFile(root,`${directory}/${diagram.name}.alt.txt`,`${diagram.title}: ${diagram.nodes.join(' → ')}. Conceptual source-linked diagram; not product UI or independently verified live behavior.`));
  }
  files.push(immutableFile(root,`${directory}/v4-storyboard.json`,JSON.stringify({tenant:c.tenant,draftId,label:'EDITORIAL_PROTOTYPE',sourceIds:draft.sourceIds,
    scenes:draft.claims.slice(0,4).map((claim,i)=>({startSeconds:i*5,durationSeconds:5,narration:claim.statement,evidenceId:claim.evidenceId,visual:'Conceptual geometry, not UI footage'})),
    captions:'Exact supported claim segments with testnet limitations',audio:'INTENTIONALLY_SILENT',assetLicense:'Original geometry; DejaVu font license',review:'HUMAN_REQUIRED'},null,2)));
  return files;
}
