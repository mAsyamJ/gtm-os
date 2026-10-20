import Database from 'better-sqlite3';
import { chmodSync, existsSync, lstatSync } from 'node:fs';
import { z } from 'zod';
import { safeDirectory, safePath } from '../../../core/src/workspace.js';
import { canonical, GtmError, hashObject } from '../../../observability/src/index.js';
import { context, type Dataset } from '../common.js';
import { Base, KINDS,Entity,Edge,Observation,Brief,CollectionRun,Opportunity } from './contracts.js';

type Kind = typeof KINDS[number];
export class IntelligenceStore {
  readonly db: Database.Database;
  readonly tenant: 'founder'|'retropick';
  constructor(readonly root: string, tenant: unknown, readonly dataset: Dataset = 'OBSERVED') {
    this.tenant = context(root,tenant,dataset).tenant;
    safeDirectory(root,`runtime/state/${this.tenant}`);
    const path = safePath(root,`runtime/state/${this.tenant}/intelligence-${dataset.toLowerCase()}.sqlite`);
    for (const suffix of ['','-wal','-shm','-journal']) if(existsSync(path+suffix) && (!lstatSync(path+suffix).isFile() || lstatSync(path+suffix).nlink!==1))
      throw new GtmError('UNSAFE_DATABASE','Database links denied');
    this.db = new Database(path); this.db.pragma('journal_mode=WAL'); this.db.pragma('synchronous=FULL');
    this.db.exec(`CREATE TABLE IF NOT EXISTS meta(tenant TEXT,dataset TEXT);
      CREATE TABLE IF NOT EXISTS records(seq INTEGER PRIMARY KEY,kind TEXT,id TEXT UNIQUE,data TEXT,hash TEXT,previous TEXT);
      CREATE TRIGGER IF NOT EXISTS immutable_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
    const meta=this.db.prepare('SELECT * FROM meta').get() as {tenant:string;dataset:string}|undefined;
    if(!meta)this.db.prepare('INSERT INTO meta VALUES(?,?)').run(this.tenant,dataset);
    else if(meta.tenant!==this.tenant||meta.dataset!==dataset){this.db.close();throw new GtmError('TENANT_MISMATCH','Intelligence database scope differs');}
    chmodSync(path,0o600); this.verify();
  }
  put(kind: Kind, input: Record<string,unknown>) {
    z.enum(KINDS).parse(kind);
    const schema=({entity:Entity,edge:Edge,source:Observation,brief:Brief,collection:CollectionRun,opportunity:Opportunity} as Partial<Record<Kind,z.ZodType>>)[kind]??Base;
    const value=Base.parse(schema.parse(input));
    if(value.tenant!==this.tenant || value.dataset!==this.dataset || (value.label==='SYNTHETIC')!==(this.dataset==='SYNTHETIC'))
      throw new GtmError('TENANT_MISMATCH','Intelligence record scope/dataset differs');
    if(/(?:gh[opusr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(canonical(value)))
      throw new GtmError('SENSITIVE_OPERATIONS_DATA','Credential pattern denied');
    return this.db.transaction(()=>{
      const previous=this.db.prepare('SELECT hash FROM records ORDER BY seq DESC LIMIT 1').get() as {hash:string}|undefined;
      const old=this.db.prepare('SELECT data FROM records WHERE id=?').get(value.id) as {data:string}|undefined;
      if(old){if(old.data!==canonical(value))throw new GtmError('IMMUTABLE_CONFLICT','Record changed');return value;}
      const prior=previous?.hash??'0'.repeat(64); const data=canonical(value);
      this.db.prepare('INSERT INTO records(kind,id,data,hash,previous) VALUES(?,?,?,?,?)').run(kind,value.id,data,hashObject({kind,data,previous:prior}),prior);
      return value;
    }).immediate();
  }
  list(kind: Kind) {
    return (this.db.prepare('SELECT data FROM records WHERE kind=? ORDER BY seq').all(kind) as {data:string}[]).map(r=>Base.parse(JSON.parse(r.data)));
  }
  verify() {
    let previous='0'.repeat(64);
    for(const row of this.db.prepare('SELECT * FROM records ORDER BY seq').all() as {kind:Kind;data:string;hash:string;previous:string}[]){
      const v=Base.parse(JSON.parse(row.data));
      if(v.tenant!==this.tenant || v.dataset!==this.dataset || row.previous!==previous || row.hash!==hashObject({kind:row.kind,data:row.data,previous}))
        throw new GtmError('AUDIT_INVALID','Intelligence hash chain differs');
      previous=row.hash;
    }
    return previous;
  }
  [Symbol.dispose](){this.db.close();}
}
export function list(root:string,tenant:unknown,kind:Kind,dataset:Dataset='OBSERVED') {
  const c=context(root,tenant,dataset);
  if(!existsSync(safePath(root,`runtime/state/${c.tenant}/intelligence-${dataset.toLowerCase()}.sqlite`)))return [];
  using store=new IntelligenceStore(root,tenant,dataset);return store.list(kind);
}
export function save(root:string,tenant:unknown,kind:Kind,data:Record<string,unknown>,dataset:Dataset='OBSERVED') {
  const c=context(root,tenant,dataset);const base={schemaVersion:4 as const,tenant:c.tenant,dataset,label:dataset==='SYNTHETIC'?'SYNTHETIC':'RETRIEVED_UNVERIFIED',...data};
  const value={...base,id:`${c.tenant}-${kind}-${hashObject(base).slice(0,24)}`,createdAt:new Date().toISOString()};
  const existing=list(root,tenant,kind,dataset).find(r=>r.id===value.id);if(existing)return existing;
  using store=new IntelligenceStore(root,tenant,dataset); return store.put(kind,value);
}
