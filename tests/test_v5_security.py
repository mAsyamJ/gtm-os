"""Exercise the actual local scanner on denied worker code without executing it."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class V5PublisherBoundaries(unittest.TestCase):
    def test_worker_network_and_credential_access_are_scanner_failures(self):
        if not shutil.which('semgrep'):
            self.skipTest('Semgrep unavailable; required repository security gate reports BLOCKED')
        with tempfile.TemporaryDirectory(dir=ROOT / 'runtime', prefix='v5-boundary-') as folder:
            base = Path(folder) / 'packages/v5/src'
            base.mkdir(parents=True)
            (base / 'worker.ts').write_text("export const leaked = process.env.BUFFER_API_KEY;\nexport const run = () => fetch('https://example.invalid');\n")
            (base / 'report.ts').write_text("export const report = { status: 'NO_DATA', observations: [] };\n")
            env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'SEMGREP_SEND_METRICS': 'off', 'SEMGREP_ENABLE_VERSION_CHECK': '0'}
            result = subprocess.run(['semgrep', 'scan', '--config', str(ROOT / 'scripts/semgrep-phase-a.yaml'),
                                     '--metrics=off', '--disable-version-check', '--no-git-ignore', '--json', '--error', str(base)],
                                    cwd=folder, env=env, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 1)
            data = json.loads(result.stdout)
            self.assertEqual(data.get('errors'), [])
            ids = [finding['check_id'] for finding in data['results']]
            self.assertTrue(any(name.endswith('v5-outbound-boundary') for name in ids))
            self.assertTrue(any(name.endswith('v5-credential-boundary') for name in ids))
            self.assertFalse(any(finding['path'].endswith('report.ts') for finding in data['results']))


if __name__ == '__main__':
    unittest.main()
