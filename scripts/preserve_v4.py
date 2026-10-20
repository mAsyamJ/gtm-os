#!/usr/bin/env python3
"""Append-only credential-excluded source snapshot and verified SQLite restore."""
import datetime
import hashlib
import json
import shutil
import sqlite3
import subprocess
from pathlib import Path
from project_inputs import project_inputs

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def main():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    target = ROOT / 'runtime/preservation/v4' / stamp
    target.mkdir(parents=True, exist_ok=False)
    files = project_inputs(ROOT)
    files += [p for p in ROOT.glob('GTM_V4_*_SEED.csv') if not p.is_symlink()]
    entries = []
    for source in sorted(set(files)):
        rel = source.relative_to(ROOT)
        for copy in ('snapshot', 'restore'):
            out = target / copy / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, out)
            if digest(out) != digest(source):
                raise ValueError('Source restoration mismatch')
        entries.append({'path': str(rel), 'sha256': digest(source)})
    databases = []
    for source in sorted((ROOT / 'runtime/state').glob('*/*.sqlite')):
        if source.is_symlink():
            raise ValueError('Database link denied')
        out = target / 'databases' / source.relative_to(ROOT / 'runtime/state')
        out.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src:
            with sqlite3.connect(out) as dst:
                src.backup(dst)
                if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('Backup integrity failed')
        restored = out.with_suffix('.restored.sqlite')
        shutil.copyfile(out, restored)
        if digest(restored) != digest(out):
            raise ValueError('Database restore mismatch')
        databases.append({'path': str(source.relative_to(ROOT)), 'backup': str(out.relative_to(ROOT)), 'sha256': digest(out), 'restoreVerified': True})
    receipt = {'schemaVersion': 1, 'at': stamp, 'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
               'credentialsIncluded': False, 'sourceRestoreVerified': True, 'files': entries, 'databases': databases,
               'limitations': ['No credential stores or Beads/Dolt internals read; existing runtime artifacts remain in place.']}
    path = target / 'receipt.json'
    path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'receipt': str(path.relative_to(ROOT)), 'sha256': digest(path), 'sources': len(entries), 'databases': len(databases)}))

if __name__ == '__main__':
    main()
