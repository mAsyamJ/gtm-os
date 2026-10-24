"""Security behavior of the operator-only provisioning boundary; synthetic values only."""
import datetime
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

SPEC = importlib.util.spec_from_file_location('provision_buffer', Path(__file__).resolve().parents[1] / 'scripts/provision_buffer.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ProvisionTests(unittest.TestCase):
    def test_private_atomic_tenant_set_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as parent:
            expiry = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
            destination = Path(parent) / 'founder'
            MODULE.provision('founder', str(destination), expiry, Mock(return_value='SYNTHETIC_NOT_A_REAL_CREDENTIAL'))
            self.assertEqual((destination / 'buffer-tenant').read_text(), 'founder\n')
            self.assertEqual((destination / 'buffer-expiry').read_text(), expiry + '\n')
            for path in destination.iterdir():
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            prompt = Mock()
            with self.assertRaises(ValueError):
                MODULE.provision('retropick', str(destination), expiry, prompt)
            prompt.assert_not_called()

    def test_unsafe_parent_symlink_unknown_expiry_and_project_storage_refused_before_prompt(self):
        with tempfile.TemporaryDirectory() as parent:
            prompt = Mock()
            root = Path(__file__).resolve().parents[1]
            candidates = [(str(root / 'runtime/never-a-secret'), 'unknown'), (str(Path(parent) / 'new'), 'invalid')]
            link = Path(parent) / 'link'
            link.symlink_to(parent, target_is_directory=True)
            candidates.append((str(link / 'new'), '2030-01-01T00:00:00Z'))
            for directory, expiry in candidates:
                with self.assertRaises(ValueError):
                    MODULE.provision('founder', directory, expiry, prompt)
            os.chmod(parent, 0o755)
            with self.assertRaises(ValueError):
                MODULE.provision('founder', str(Path(parent) / 'new'), '2030-01-01T00:00:00Z', prompt)
            prompt.assert_not_called()
