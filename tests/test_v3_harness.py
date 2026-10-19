"""Host-side tests never import upstream config or provider executors."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gtm_launcher", ROOT / "scripts/harness_gtm.py")
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class HarnessContracts(unittest.TestCase):
    def test_frozen_fixtures_and_upstream_identity(self):
        pin, identity = launcher.source_identity()
        self.assertEqual(pin["commit"], "1cfe254e8d25b15f37048c3730134686abe60335")
        self.assertEqual(len(identity), 64)
        values = json.loads((ROOT / "harness/fixtures/public.json").read_text())
        self.assertEqual(sum(v["suite"] == "global" for v in values), 12)
        self.assertEqual(sum(v["suite"] == "gtm" for v in values), 16)

    def test_parent_rejects_changed_negation_and_forged_verification(self):
        source = json.loads((ROOT / "harness/fixtures/public.json").read_text())[0]
        value = {"tenant": source["tenant"], "statement": source["statement"], "revision": source["revision"],
                 "limitations": source["limitations"], "sourceSha256": hashlib.sha256(source["statement"].encode()).hexdigest(),
                 "label": "SYNTHETIC", "publicationAuthorized": False, "platformVerified": False,
                 "humanReview": "REQUIRED", "hostedModelRequests": 0}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            answer = root / "executions" / source["id"] / "handoff.json"
            answer.parent.mkdir(parents=True)
            answer.write_text(json.dumps(value))
            self.assertEqual(len(launcher.grade(root)), 1)
            for changed in ({"statement": source["statement"].replace("does not", "does")}, {"platformVerified": True}, {"tenant": "retropick"}):
                answer.write_text(json.dumps({**value, **changed}))
                with self.assertRaises(ValueError):
                    launcher.grade(root)


if __name__ == "__main__":
    unittest.main()
