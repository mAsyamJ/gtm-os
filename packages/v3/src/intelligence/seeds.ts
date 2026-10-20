import { readText, safePath } from '../../../core/src/workspace.js';
import { GtmError, hashObject } from '../../../observability/src/index.js';
import { context, type Dataset } from '../common.js';
import { Entity } from './contracts.js';
import { list, save } from './store.js';

export function csvRows(text:string) {
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i]!;
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[];}}
    else field+=c;
  }
  if(quoted)throw new GtmError('CSV_INVALID','Unclosed CSV field',2);
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift();if(!header||new Set(header).size!==header.length)throw new GtmError('CSV_INVALID','Unique header required',2);
  return rows.filter(r=>r.some(Boolean)).map(r=>{
    if(r.length!==header.length)throw new GtmError('CSV_INVALID','CSV row width differs',2);
    return Object.fromEntries(header.map((h,i)=>[h,r[i]!]));
  });
}
export function importSeeds(root:string,selected:unknown,people:string,projects:string,dataset:Dataset='OBSERVED') {
  const c=context(root,selected,dataset);const output=[];
  for(const [path,type] of [[people,'Person'],[projects,'Project']] as const){
    if(!/^GTM_V4_CRYPTO_(?:PEOPLE_WATCHLIST|PROJECT_RESEARCH)_SEED\.csv$/.test(path))throw new GtmError('INPUT_SCOPE','Use one of the two explicit project seed CSVs',2);
    safePath(root,path);
    for(const seed of csvRows(readText(root,path))){
      if(!seed.brand_relevance?.split(',').includes(c.tenant))continue;
      const name=seed.person??seed.project,uri=seed.initial_source_url??seed.source_url;
      if(!name||!uri)throw new GtmError('CSV_INVALID','Name and discovery URL required',2);
      const u=new URL(uri);if(u.protocol!=='https:'||u.username||u.password)throw new GtmError('SOURCE_POLICY','Credential-free HTTPS seed required',3);
      const entity={canonicalId:`public-${hashObject({type,name:name.normalize('NFKC').toLowerCase(),organization:seed.organization??''}).slice(0,24)}`,
        types:[type],name,organization:seed.organization??'',topics:[seed.subject_matter??seed.research_domain??'UNKNOWN'],sourceUrls:[uri],
        identityStatus:'UNVERIFIED',roleStatus:'UNKNOWN',xHandle:null,tier:'UNCLASSIFIED',seed,sourceIds:[],reviewIds:[],
        intendedUse:'RESEARCH_AND_ATTRIBUTED_COMMENTARY',biasTags:['OWNER_SUPPLIED_SEED','SOURCE_COVERAGE_BIAS','ROLE_NOT_CURRENTLY_VERIFIED'],verifiedAt:null};
      output.push(Entity.parse(save(root,c.tenant,'entity',entity,dataset)));
    }
  }
  return {...c,status:'IMPORTED_UNVERIFIED',entities:output,verifiedPeople:0,targetVerifiedPeople:50,
    totalPeopleSeedRows:csvRows(readText(root,people)).length,totalProjectSeedRows:csvRows(readText(root,projects)).length};
}
export function entities(root:string,tenant:unknown,dataset:Dataset,type?:string) {
  const latest=new Map<string,Entity>();
  for(const raw of list(root,tenant,'entity',dataset)){const e=Entity.parse(raw);latest.set(e.canonicalId,e);}
  return [...latest.values()].filter(e=>!type||e.types.some(t=>t.toLowerCase()===type.toLowerCase()));
}
