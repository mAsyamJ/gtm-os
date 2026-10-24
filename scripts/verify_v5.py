#!/usr/bin/env python3
"""Fresh offline checks, preserved-data verification and honest V5 live gates."""
import datetime
import hashlib
import json
from pathlib import Path
import resource
import sqlite3
import subprocess
import time

from project_inputs import project_inputs

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run_json(args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError('Read-only acceptance command failed; raw output withheld')
    return json.loads(result.stdout)


def verify_preservation():
    candidates = sorted((ROOT / 'runtime/preservation/v5').glob('*/receipt.json'))
    if not candidates:
        raise RuntimeError('V5 preservation baseline missing')
    path = candidates[0]
    receipt = json.loads(path.read_text())
    retained = 0
    for entry in receipt['files']:
        copied = path.parent / 'snapshot' / entry['path']
        if copied.is_symlink() or digest(copied) != entry['sha256']:
            raise RuntimeError('Preservation snapshot changed')
        if entry['path'].startswith(('runtime/v3/', 'runtime/v4/', 'docs/evidence/')):
            if digest(ROOT / entry['path']) != entry['sha256']:
                raise RuntimeError('Historical artifact/receipt changed')
            retained += 1
    databases = []
    for entry in receipt['databases']:
        backup = ROOT / entry['backup']
        restored = backup.with_suffix('.restored.sqlite')
        if digest(backup) != entry['sha256'] or digest(restored) != entry['sha256']:
            raise RuntimeError('Historical database backup/restore changed')
        current = ROOT / entry['path']
        with sqlite3.connect(current.as_uri() + '?mode=ro', uri=True) as active, sqlite3.connect(backup.as_uri() + '?mode=ro', uri=True) as saved:
            if active.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise RuntimeError('Existing database integrity failed')
            counts = {}
            for table in ('records', 'audit', 'sources', 'jobs', 'artifacts', 'outbox'):
                exists = saved.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
                if exists:
                    old_count = saved.execute('SELECT COUNT(*) FROM "' + table + '"').fetchone()[0]
                    new_count = active.execute('SELECT COUNT(*) FROM "' + table + '"').fetchone()[0]
                    if old_count != new_count:
                        raise RuntimeError('Existing V4 data count changed; explicit review required')
                    counts[table] = new_count
            databases.append({'path': entry['path'], 'restoreVerified': True, 'retainedCounts': counts})
    return {'receipt': str(path.relative_to(ROOT)), 'receiptSha256': digest(path),
            'snapshotFiles': len(receipt['files']), 'historicalArtifactsRetained': retained, 'databases': databases}


def main():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    directory = ROOT / 'runtime/acceptance/v5' / stamp
    directory.mkdir(parents=True, exist_ok=False)
    start = time.monotonic()
    log = directory / 'checks.log'
    # No credential is installed/exported; the deterministic tests inject synthetic transports.
    with log.open('w') as output:
        result = subprocess.run(['pnpm', 'check'], cwd=ROOT, stdout=output, stderr=subprocess.STDOUT, timeout=600)
    preservation = verify_preservation()
    packets = run_json(['node', '--input-type=module', '-e',
        'import {readFileSync} from "node:fs"; import {packetById} from "./dist/packages/v3/src/distribution.js";'
        'const s=JSON.parse(readFileSync("docs/evidence/v4-sprint-2026-10-19T17-05-28-197Z.json","utf8"));'
        'console.log(JSON.stringify(s.tenantReports.map(t=>{const p=packetById(process.cwd(),t.tenant,t.packetId);return {tenant:t.tenant,packetId:p.id,payloadSha256:p.payloadSha256,status:"HOLD",currentValidation:"PASS"};})));'])
    live = run_json(['node', '--input-type=module', '-e',
        'import {acceptance} from "./dist/packages/v5/src/acceptance.js";'
        'import {credentialStatus} from "./dist/packages/v5/src/buffer.js";'
        'console.log(JSON.stringify({credential:credentialStatus(),tenants:["retropick","founder"].map(t=>acceptance(process.cwd(),t))}));'])
    real = [r for tenant in live['tenants'] for r in tenant['receipts']]
    ids = [r['providerPostId'] for r in real]
    urls = [r['publicProof']['url'] for r in real]
    texts = [r['publicProof']['textSha256'] for r in real]
    two_account = len(real) == 2 and len(set(ids)) == 2 and len(set(urls)) == 2 and len(set(texts)) == 2 and all(len(t['receipts']) == 1 for t in live['tenants'])
    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    report = {'schemaVersion': 5, 'revision': 'v5-r1', 'at': stamp,
        'status': 'OFFLINE_VERIFIED_LIVE_BLOCKED' if result.returncode == 0 and not two_account else 'END_TO_END_VERIFIED' if result.returncode == 0 and two_account else 'CHECKS_FAILED',
        'git': {'branch': subprocess.check_output(['git','branch','--show-current'], cwd=ROOT, text=True).strip(),
                'baseSha': subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(),
                'dirty': bool(subprocess.check_output(['git','status','--porcelain'], cwd=ROOT, text=True).strip())},
        'audience': 'Owner, implementers and publishing operators', 'assetSourceLicense': 'Original text/code; per-source documentary rights; no live media',
        'checks': {'command': 'pnpm check', 'exit': result.returncode, 'log': str(log.relative_to(ROOT)), 'logSha256': digest(log)},
        'preservation': preservation, 'v4Packets': packets, 'live': live,
        'crossTenantAcceptance': {'status': 'VERIFIED' if two_account else 'BLOCKED_REAL_TWO_ACCOUNT_RECEIPTS_REQUIRED', 'distinctProviderIds': len(set(ids)), 'distinctPublicUrls': len(set(urls))},
        'sourceHashes': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in project_inputs(ROOT)],
        'resources': {'wallSeconds': time.monotonic()-start, 'childUserCpuSeconds': usage.ru_utime, 'childSystemCpuSeconds': usage.ru_stime, 'peakRssKiB': usage.ru_maxrss},
        'approvalStatus': 'PER_JOB_GENUINE_OWNER_APPROVAL_REQUIRED', 'providerRequestsDuringVerifier': 0,
        'limitations': ['Offline fixtures never establish real Buffer/X success.', 'No global credentials, account configuration, service installation, push or merge performed.',
                       'Initial text-only slice; media hosting unsupported.', 'Research queue size/fit and product instrumentation depend on genuine evidence, not fabricated coverage.',
                       'No actual metrics, business lift or US audience geography inferred.']}
    path = ROOT / 'docs/evidence' / f'v5-acceptance-{stamp}.json'
    path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'receipt': str(path.relative_to(ROOT)), 'checksExit': result.returncode,
                      'crossTenantAcceptance': report['crossTenantAcceptance'], 'credentialStatus': live['credential']['status']}, indent=2))
    return 0 if result.returncode == 0 else 5


if __name__ == '__main__':
    raise SystemExit(main())
