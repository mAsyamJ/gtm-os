"""Offline contract tests; mutate isolated workspace copies, never live policy."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class GovernanceTests(unittest.TestCase):
    def setUp(self):
        (ROOT / "runtime").mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / "runtime")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in (".agents", "agents", "brands", "config", "docs", "workflows", "scripts",
                     "campaigns", "content", "creative", "distribution", "growth", "relationships",
                     "research", "strategy", "plugins"):
            shutil.copytree(ROOT / name, self.root / name, ignore=shutil.ignore_patterns("__pycache__"))
        for p in ROOT.glob("*.md"):
            shutil.copyfile(p, self.root / p.name)

    def run_check(self, expected=5):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/validate_scaffold.py"),
                                 "--root", str(self.root), "--json"], capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], "PASS" if expected == 0 else "FAIL")
        return report

    def replace(self, path, old, new):
        p = self.root / path
        self.assertIn(old, p.read_text())
        p.write_text(p.read_text().replace(old, new))

    def has_code(self, code):
        report = self.run_check()
        self.assertIn(code, {x["code"] for x in report["findings"]}, report)

    def test_valid_workspace(self):
        report = self.run_check(0)
        self.assertEqual(report["counts"]["skills"], 29)
        self.assertEqual(report["counts"]["workflows"], 24)

    def test_valid_folded_frontmatter(self):
        self.replace(".agents/skills/tenant-router/SKILL.md",
                     'description: "Use whenever a task changes or chooses between RetroPick and the founder brand."',
                     "description: >\n  Use when choosing a tenant\n  for a scoped task.")
        self.run_check(0)

    def test_missing_expected_skill(self):
        shutil.rmtree(self.root / ".agents/skills/tenant-router")
        self.has_code("skill.inventory")

    def test_duplicate_skill_name(self):
        self.replace(".agents/skills/tenant-router/SKILL.md", "name: tenant-router", "name: brand-voice")
        self.has_code("skill.duplicate")

    def test_invalid_skill_frontmatter(self):
        self.replace(".agents/skills/tenant-router/SKILL.md", "name: tenant-router", "name: [")
        self.has_code("parse.invalid")

    def test_invalid_description(self):
        p = self.root / ".agents/skills/tenant-router/SKILL.md"
        p.write_text("---\nname: tenant-router\ndescription: ''\n---\nBody\n")
        self.has_code("schema.skill")

    def test_missing_workflow_tool(self):
        self.replace("workflows/definitions/feature-launch.yaml", "    tool: manual\n", "")
        self.has_code("schema.workflow")

    def test_unknown_skill(self):
        self.replace("workflows/definitions/feature-launch.yaml", "skill: claim-verification", "skill: unknown")
        self.has_code("workflow.skill")

    def test_unknown_role(self):
        self.replace("workflows/definitions/feature-launch.yaml", "owner: product-marketer", "owner: unknown")
        self.has_code("workflow.owner")

    def test_duplicate_workflow(self):
        self.replace("workflows/definitions/build-in-public.yaml", "id: build-in-public", "id: feature-launch")
        self.has_code("workflow.duplicate")

    def test_duplicate_stage(self):
        self.replace("workflows/definitions/feature-launch.yaml", "id: step_2", "id: step_1")
        self.has_code("workflow.stage_duplicate")

    def test_undeclared_error_state(self):
        self.replace("workflows/state-machines/content.yaml", "  - blocked\n", "")
        self.has_code("state.membership")

    def test_tenant_mismatch(self):
        self.replace("brands/retropick/profile.json", '"id": "retropick"', '"id": "founder"')
        self.has_code("brand.tenant")

    def test_wrong_handle(self):
        self.replace("brands/founder/profile.json", "iHateModelsss", "RetroPickMarket")
        self.has_code("brand.account")

    def test_source_required_for_claim(self):
        p = self.root / "brands/retropick/claims-ledger.yaml"
        p.write_text("tenant: retropick\napproval_required: true\nclaims:\n  - claim_id: unsupported\n    tenant: retropick\n    statement: Example\n")
        self.has_code("schema.claims")

    def test_cross_tenant_claim(self):
        self.replace("brands/founder/claims-ledger.yaml", "tenant: founder", "tenant: retropick")
        self.has_code("brand.tenant")

    def test_external_writes_enabled(self):
        self.replace("config/defaults.yaml", "external_writes: false", "external_writes: true")
        self.has_code("policy.defaults")

    def test_paid_cap_enabled(self):
        self.replace("config/defaults.yaml", "x_monthly_hard_cap_usd: 0", "x_monthly_hard_cap_usd: 1")
        self.has_code("policy.defaults")

    def test_unknown_feature_flag(self):
        p = self.root / "config/feature-flags.yaml"
        p.write_text(p.read_text() + "unreviewed_connector: true\n")
        self.has_code("policy.flags")

    def test_missing_reference(self):
        (self.root / "brands/founder/profile.json").unlink()
        self.has_code("file.missing")

    def test_yaml_duplicate_key(self):
        p = self.root / "config/defaults.yaml"
        p.write_text(p.read_text() + "external_writes: true\n")
        self.has_code("parse.invalid")

    def test_yaml_python_tag(self):
        (self.root / "config/defaults.yaml").write_text("!!python/object/apply:os.system ['false']")
        self.has_code("parse.invalid")

    def test_yaml_alias_rejected(self):
        (self.root / "config/defaults.yaml").write_text("a: &a [*a]\n")
        self.has_code("parse.invalid")

    def test_json_duplicate_key(self):
        (self.root / "brands/founder/profile.json").write_text('{"id":"founder","id":"retropick"}')
        self.has_code("parse.invalid")

    def test_symlink_not_followed(self):
        p = self.root / "brands/founder/profile.json"
        p.unlink()
        p.symlink_to(ROOT / "brands/founder/profile.json")
        self.has_code("file.unsafe")

    def test_no_sensitive_files_read(self):
        # The parser must never encounter this invalid YAML in a prohibited path.
        (self.root / ".env").write_text("not a config\n")
        (self.root / "runtime").mkdir()
        (self.root / "runtime/secrets.yaml").write_text("invalid: [")
        self.run_check(0)

    def test_missing_dependency_is_blocked_json(self):
        result = subprocess.run([sys.executable, "-S", str(ROOT / "scripts/validate_scaffold.py"),
                                 "--root", str(self.root), "--json"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "BLOCKED")

    def test_null_workflow_is_invalid(self):
        (self.root / "workflows/definitions/feature-launch.yaml").write_text("null\n")
        self.has_code("schema.workflow")

    def test_remote_schema_reference_denied(self):
        p = self.root / "scripts/schemas/governance.json"
        data = json.loads(p.read_text())
        data["$defs"]["stage"] = {"$ref": "https://example.invalid/schema"}
        p.write_text(json.dumps(data))
        self.has_code("schema.definition")

    def test_malformed_schema_definitions(self):
        (self.root / "scripts/schemas/governance.json").write_text('{"$defs": null}')
        self.has_code("schema.definition")

    def test_secret_named_config_not_read(self):
        (self.root / "config/credentials.yaml").write_text("invalid: [")
        self.run_check(0)

    def test_unknown_initial_state(self):
        self.replace("workflows/state-machines/approval.yaml", "initial: not_requested", "initial: unknown")
        self.has_code("state.membership")

    def test_enabled_brand_publication_denied(self):
        self.replace("brands/founder/profile.json", '"publication_enabled": false', '"publication_enabled": true')
        self.has_code("schema.profile")

    def test_oversized_input_rejected(self):
        (self.root / "brands/founder/profile.json").write_text(" " * (1024 * 1024 + 1))
        self.has_code("file.size")

    def test_unsafe_messages_are_redacted(self):
        p = self.root / "brands/founder/profile.json"
        p.write_text('{"id": "PRIVATE_TEST_VALUE", "publication_enabled": true}')
        report = self.run_check()
        self.assertNotIn("PRIVATE_TEST_VALUE", json.dumps(report))

    def test_missing_phase_a_assessment(self):
        (self.root / "docs/ASSESSMENT.md").unlink()
        self.has_code("file.missing")

    def test_unknown_role_primary_skill(self):
        self.replace("agents/roles/founder-brand/ROLE.md", "founder-led-growth/SKILL.md", "unknown/SKILL.md")
        self.has_code("role.skill")


if __name__ == "__main__":
    unittest.main()
