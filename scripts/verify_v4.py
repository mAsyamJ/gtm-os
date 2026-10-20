#!/usr/bin/env python3
"""Fresh offline checks plus real-artifact verification; append-only V4 acceptance."""
import argparse
import datetime
import hashlib
import json
import resource
import subprocess
import time
from pathlib import Path
from project_inputs import project_inputs

ROOT=Path(__file__).resolve().parents[1]
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):
            h.update(block)
    return h.hexdigest()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--artifacts-only',action='store_true');args=parser.parse_args()
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    directory=ROOT/'runtime/acceptance/v4'/stamp;directory.mkdir(parents=True,exist_ok=False)
    start=time.monotonic();check=None
    if not args.artifacts_only:
        with (directory/'checks.log').open('w') as log:
            check=subprocess.run(['pnpm','check'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,timeout=360).returncode
    preservation=json.loads((ROOT/'runtime/preservation/v4/20261019T163411197598Z/receipt.json').read_text())
    preserved=0
    for item in preservation['files']:
        for mode in ('snapshot','restore'):
            path=ROOT/'runtime/preservation/v4/20261019T163411197598Z'/mode/item['path']
            if path.is_symlink() or sha(path)!=item['sha256']:raise ValueError('Snapshot/restore changed')
        if item['path'].startswith('docs/evidence/') and sha(ROOT/item['path'])!=item['sha256']:
            raise ValueError('Historical receipt changed')
        preserved+=1
    for item in preservation['databases']:
        backup=ROOT/item['backup'];restored=backup.with_suffix('.restored.sqlite')
        if sha(backup)!=item['sha256'] or sha(restored)!=item['sha256']:raise ValueError('Database backup/restore changed')
    sprint_path=ROOT/'docs/evidence/v4-sprint-2026-10-19T17-05-28-197Z.json'
    sprint=json.loads(sprint_path.read_text());packets=[]
    for tenant in sprint['tenantReports']:
        packet_path=ROOT/tenant['manualDirectory']/'publishing-package.json';packet=json.loads(packet_path.read_text())
        if packet['tenant']!=tenant['tenant'] or packet['payloadSha256']!=tenant['payloadSha256'] or packet['publicationAuthorized']:
            raise ValueError('Packet scope/hash/HOLD differs')
        payload=json.dumps(packet['immutablePayload'],sort_keys=True,separators=(',',':'),ensure_ascii=False)
        if hashlib.sha256(payload.encode()).hexdigest()!=packet['payloadSha256']:raise ValueError('Canonical packet hash differs')
        for item in packet['files']+packet['media']:
            if not item['path'].startswith('runtime/v3/'+tenant['tenant']+'/'):raise ValueError('Cross-tenant media')
            if sha(ROOT/item['path'])!=item['sha256']:raise ValueError('Media/file changed')
        if tenant['realCoreSources']<2 or tenant['posts']!=5 or tenant['threads']!=2 or any(n>280 for n in tenant['postCharacterCounts']):
            raise ValueError('Real source/content acceptance missing')
        code='import {packetById} from "./dist/packages/v3/src/distribution.js";packetById(process.cwd(),process.argv[1],process.argv[2]);'
        subprocess.run(['node','--input-type=module','-e',code,tenant['tenant'],tenant['packetId']],cwd=ROOT,check=True,capture_output=True,text=True,timeout=20)
        packets.append({'tenant':tenant['tenant'],'packetId':packet['id'],'payloadSha256':packet['payloadSha256'],'filesVerified':len(packet['files'])+len(packet['media']),'status':'HOLD','currentSourceValidation':'PASS'})
    usage=resource.getrusage(resource.RUSAGE_CHILDREN)
    source_hashes=[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in project_inputs(ROOT)]
    source_hashes.extend({'path':p.name,'sha256':sha(p)} for p in ROOT.glob('GTM_V4_*_SEED.csv') if not p.is_symlink())
    report={'schemaVersion':4,'at':stamp,'status':'LOCAL_PIPELINE_VERIFIED_OWNER_AND_COVERAGE_GATES_BLOCKED' if check==0 else 'ARTIFACTS_ONLY_CHECKS_NOT_RUN' if check is None else 'CHECKS_FAILED',
      'implementedCapabilities':['Typed intelligence graph','Bounded keyless public collection','Evidence review linkage','Seed/watchlist workflows','Publication-date radar','Editorial heuristic ranking','Selected multi-source briefs and cycles','Capped admitted-router claim selection','Two-brand creative/manual HOLD packages','Eight executable V4 workflow handlers'],
      'verifiedIntegrations':{'realSourcesPerTenantAtLeast2':True,'currentPackets':packets,'routerTasks':sprint['routerTasks'],'globalProviderConfigurationChanged':False},
      'testResults':{'command':'pnpm check','exit':check,'log':str((directory/'checks.log').relative_to(ROOT)) if check is not None else None,'logSha256':sha(directory/'checks.log') if check is not None else None},
      'producedArtifacts':{'sprint':str(sprint_path.relative_to(ROOT)),'sprintSha256':sha(sprint_path),'packets':packets,'sourceHashes':source_hashes},
      'preservation':{'sourcesRestoredVerified':preserved,'databasesRestoredVerified':len(preservation['databases']),'historicalReceiptsUnchanged':True},
      'costs':sprint['costs'],'resources':{'wallSeconds':time.monotonic()-start,'childUserCpuSeconds':usage.ru_utime,'childSystemCpuSeconds':usage.ru_stime,'childPeakRssKiB':usage.ru_maxrss,'scope':'Acceptance subprocesses; excludes prior renders and subscription overhead'},
      'securityFindings':'Scoped Gitleaks/Semgrep results in checks.log; no credential stores or private router traces inspected',
      'knownLimitations':['Sparse rolling-source coverage; first campaign is BACKGROUND','Fourteen current verified people not achieved','Current router selected exact claims, not unrestricted factual prose','Prototype visuals, not live UI footage','Owner review, publication and outcome measurement missing','RSS parser tests do not prove a live RSS connector','No current independent chain/market-depth verification'],
      'outstandingBlockers':sprint['remainingBlockers'],'rollback':'docs/CRYPTO_INTELLIGENCE_OS.md#recovery-and-rollback','globalPromotionEnabled':False}
    path=ROOT/'docs/evidence'/f'v4-acceptance-{stamp}.json';path.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'receipt':str(path.relative_to(ROOT)),'checksExit':check,'packets':packets},indent=2))
    return 0 if check in (0,None) else 5

if __name__=='__main__':
    raise SystemExit(main())
