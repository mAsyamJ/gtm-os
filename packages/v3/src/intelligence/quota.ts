import Database from 'better-sqlite3';
import { chmodSync, existsSync, lstatSync } from 'node:fs';
import { safeDirectory, safePath } from '../../../core/src/workspace.js';
import { GtmError } from '../../../observability/src/index.js';
import { context } from '../common.js';

/** Shared quota metadata contains counts only, never tenant content or provider credentials. */
export function reserve(root:string,tenant:unknown,kind:'http'|'model',units=1) {
  const c=context(root,tenant);if(!Number.isSafeInteger(units)||units<1)throw new GtmError('INVALID_QUOTA','Positive reservation required');
  safeDirectory(root,'runtime/state');const path=safePath(root,'runtime/state/v4-quota.sqlite');
  for(const suffix of ['','-wal','-shm','-journal'])if(existsSync(path+suffix)&&(!lstatSync(path+suffix).isFile()||lstatSync(path+suffix).nlink!==1))throw new GtmError('UNSAFE_DATABASE','Quota database links denied');
  const db=new Database(path,{timeout:5000});
  try {
    db.exec('CREATE TABLE IF NOT EXISTS reservations(id INTEGER PRIMARY KEY,tenant TEXT,kind TEXT,units INTEGER,at TEXT)');
    chmodSync(path,0o600);
    return db.transaction(()=>{
      const rows=db.prepare('SELECT tenant,sum(units) AS used FROM reservations WHERE kind=? GROUP BY tenant').all(kind) as {tenant:string;used:number}[];
      const used=rows.find(r=>r.tenant===c.tenant)?.used??0,total=rows.reduce((n,r)=>n+r.used,0),limit=kind==='http'?80:4;
      if(used+units>limit || total+units>limit*2)throw new GtmError('QUOTA_EXHAUSTED','First-sprint durable quota exhausted; no automatic reset',3);
      db.prepare('INSERT INTO reservations(tenant,kind,units,at) VALUES(?,?,?,?)').run(c.tenant,kind,units,new Date().toISOString());
      return {tenant:c.tenant,kind,reserved:units,tenantUsed:used+units,totalUsed:total+units,estimatedReservationUsd:kind==='model'?units*0.0125:null,actualSubscriptionUsd:null};
    }).immediate();
  } finally {db.close();}
}
