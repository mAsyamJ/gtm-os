import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
PYTHON = '/home/ubuntu/.local/share/uv/tools/agent-reach/bin/python'

class ResearchReplayTests(unittest.TestCase):
    def run_adapter(self, mode, value):
        result = subprocess.run([PYTHON, '-I', str(ROOT/'adapters/research/offline.py'), mode], input=json.dumps(value), text=True, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_rss_replay_keeps_source_dates_and_deduplicates_entries(self):
        data = self.run_adapter('rss', {'tenant':'founder','feed':'<rss><channel><item><guid>one</guid><title>Constraint</title><pubDate>Mon, 19 Oct 2026 00:00:00 GMT</pubDate></item><item><guid>one</guid><title>Constraint</title></item></channel></rss>'})
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['items'][0]['title'], 'Constraint')
        self.assertEqual(data['networkRequests'], 0)
        self.assertEqual(data['label'], 'SYNTHETIC')

    def test_last30days_uses_pinned_dates_component_without_loading_auth_or_search(self):
        data = self.run_adapter('dates', {'tenant':'retropick','days':30,'asOf':'2026-10-19'})
        self.assertEqual(data['range'], ['2026-09-19','2026-10-19'])
        self.assertEqual(data['networkRequests'],0)

    def test_replay_cannot_select_x_or_a_credential_backend(self):
        result = subprocess.run([PYTHON,'-I',str(ROOT/'adapters/research/offline.py'),'x'],input='{}',text=True,capture_output=True,timeout=20)
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('Traceback',result.stderr)

if __name__ == '__main__': unittest.main()
