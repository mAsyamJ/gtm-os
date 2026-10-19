"""Verify that audits never copy protected or linked files into scanner context."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("project_inputs", ROOT / "scripts/project_inputs.py")
inputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inputs)


class SourceBoundaryTests(unittest.TestCase):
    def test_allowlist_excludes_credentials_runtime_and_links(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "runtime") as folder:
            root = Path(folder)
            names = ["README.md", ".env.example", ".env", "config/defaults.yaml",
                     "config/credentials.yaml", "config/secrets/key.json", "config/auth.json",
                     "config/session.json", "runtime/private.md", ".git/config", ".beads/metadata.json",
                     "scripts/check.py", ".agents/skills/example/SKILL.md"]
            for name in names:
                p = root / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text("safe test fixture")
            (root / "config/linked.json").symlink_to(root / ".env")
            (root / "brands").symlink_to(root / "runtime", target_is_directory=True)
            actual = {str(p.relative_to(root)) for p in inputs.project_inputs(root)}
            self.assertEqual(actual, {"README.md", ".env.example", "config/defaults.yaml",
                                      "scripts/check.py", ".agents/skills/example/SKILL.md"})


if __name__ == "__main__":
    unittest.main()
