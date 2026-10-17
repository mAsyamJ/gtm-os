#!/usr/bin/env python3
"""Offline Phase A contracts. Never executes workflows or loads credential files."""
import argparse
import json
import sys
from pathlib import Path

EXPECTED_SKILLS = set("""analytics-attribution brand-voice campaign-architecture claim-verification
community-engagement content-repurposing cost-optimization creator-distribution customer-discovery
developer-relations founder-led-growth graphic-design growth-experiments gtm-orchestrator
icp-positioning landing-page-cro launch-playbook partnership-outreach product-demo-capture release-qa
research-intelligence security-compliance seo-geo-content social-publishing tenant-router video-editing
video-storyboard weekly-founder-brief x-thread-writing""".split())
EXPECTED_WORKFLOWS = set("""build-in-public campaign-from-insight community-relationship daily-intelligence
feature-launch incident-pause landing-page-experiment partner-outreach post-performance-retro
product-to-video record-demo repurpose-winners review-and-schedule seo-content thread-to-graphic
weekly-founder-review""".split())
EXPECTED_ROLES = set("""chief-gtm compliance-officer developer-relations founder-brand graphic-designer
market-researcher marketing-analyst marketing-ops motion-designer partnerships product-marketer
qa-auditor seo-cro-engineer social-editor video-editor""".split())
SCOPES = (".agents", "agents", "brands", "brands/founder", "brands/retropick", "campaigns", "content",
          "creative", "distribution", "growth", "relationships", "research", "strategy", "workflows")
DEPARTMENTS = ("campaigns", "content", "creative", "distribution", "growth", "relationships", "research",
               "strategy", "workflows")
HANDLES = {"retropick": "RetroPickMarket", "founder": "iHateModelsss"}
DEFAULTS = {name: False for name in ("publish_enabled", "external_writes", "paid_api_enabled",
            "ads_enabled", "auto_reply_enabled", "auto_dm_enabled", "auto_follow_enabled")}
DEFAULTS["x_monthly_hard_cap_usd"] = 0
DEFAULTS["mock_mode"] = True
FLAGS = {name: False for name in ("x_live_auth", "x_auto_publish", "postiz", "activepieces",
         "video_shotcraft", "comfyui", "penpot", "posthog_live")}
MAX_BYTES = 1024 * 1024


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate mapping key")
        result[key] = value
    return result


def yaml_load(text, yaml):
    class StrictLoader(yaml.SafeLoader):
        pass

    def mapping(loader, node):
        return unique_pairs((loader.construct_object(k), loader.construct_object(v))
                            for k, v in node.value)

    StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
    if any(isinstance(token, (yaml.tokens.AliasToken, yaml.tokens.AnchorToken))
           for token in yaml.scan(text)):
        raise ValueError("YAML anchors and aliases are not allowed")
    return yaml.load(text, Loader=StrictLoader)


class Audit:
    def __init__(self, root, yaml, schema_module):
        self.root = root.resolve()
        self.yaml = yaml
        self.schema_module = schema_module
        self.findings = []
        self.documents = {}
        self.counts = {}
        self.texts = {}

    def error(self, code, path, message):
        self.findings.append({"code": code, "path": str(path), "message": message})

    def read(self, rel):
        if rel in self.texts:
            return self.texts[rel]
        path = self.root / rel
        if any(p.is_symlink() for p in (path, *path.parents)):
            self.error("file.unsafe", rel, "symlinks are not allowed in governance inputs")
            return None
        if not path.is_file():
            self.error("file.missing", rel, "required file is missing")
            return None
        if path.stat().st_size > MAX_BYTES:
            self.error("file.size", rel, "governance input exceeds 1 MiB")
            return None
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            self.error("file.unreadable", rel, "cannot read UTF-8 governance input")
            return None
        self.texts[rel] = text
        return text

    def parse(self, rel):
        text = self.read(rel)
        if text is None:
            return None
        try:
            data = (json.loads(text, object_pairs_hook=unique_pairs) if rel.endswith(".json")
                    else yaml_load(text, self.yaml))
        except (ValueError, TypeError, self.yaml.YAMLError, RecursionError):
            self.error("parse.invalid", rel, "invalid or unsafe structured input")
            return None
        self.documents[rel] = data
        return data

    def check_schema(self, data, kind, rel):
        schema = {"$ref": f"#/$defs/{kind}", "$defs": self.schemas["$defs"]}
        errors = list(self.schema_module.Draft202012Validator(schema).iter_errors(data))
        for error in errors:
            field = "/".join(str(x) for x in error.absolute_path) or "<root>"
            self.error("schema." + kind, rel, f"{field}: violates {error.validator} contract")
        return not errors

    def inventory(self, directory, pattern, expected, code):
        base = self.root / directory
        unsafe = any(p.is_symlink() for p in (base, *base.parents))
        if unsafe:
            self.error("file.unsafe", directory, "symlinked inventory roots are not allowed")
        paths = sorted(base.glob(pattern)) if not unsafe else []
        actual = {p.parent.name if pattern.endswith("/SKILL.md") or pattern.endswith("/ROLE.md")
                  else p.stem for p in paths}
        if actual != expected:
            self.error(code, directory, "inventory differs from required identifiers: " +
                       ", ".join(sorted(actual ^ expected)))
        return paths

    def run(self):
        self.schemas = self.parse("scripts/schemas/governance.json")
        if not isinstance(self.schemas, dict) or not isinstance(self.schemas.get("$defs"), dict):
            self.error("schema.definition", "scripts/schemas/governance.json", "schema definitions unavailable")
            return self.report()
        def local_refs(value):
            if isinstance(value, dict):
                ref = value.get("$ref")
                if ref is not None and (not isinstance(ref, str) or not ref.startswith("#/$defs/")
                                        or ref[8:] not in self.schemas["$defs"]):
                    return False
                return all(local_refs(item) for item in value.values())
            return not isinstance(value, list) or all(local_refs(item) for item in value)
        if not local_refs(self.schemas):
            self.error("schema.definition", "scripts/schemas/governance.json", "only defined local schema references are allowed")
            return self.report()
        try:
            self.schema_module.Draft202012Validator.check_schema(self.schemas)
        except self.schema_module.SchemaError:
            self.error("schema.definition", "scripts/schemas/governance.json", "invalid schema definitions")
            return self.report()
        for rel in ("AGENTS.md", "SKILLS.md", "DESIGN.md", "WORKFLOWS.md", "SECURITY.md",
                    "README.md", "CONTRIBUTING.md", "PROJECT_STATUS.md",
                    "docs/MASTER_EXECUTION_PROMPT_V2.md", "docs/ASSESSMENT.md", "docs/PLAN.md",
                    "docs/TOOLS_MATRIX.md", "docs/SECURITY.md", "docs/GOVERNANCE_REVIEW.md",
                    "docs/QA_REPORT.md", "docs/adr/0001-tenancy.md", "docs/adr/0002-publishing.md",
                    "docs/adr/0003-storage.md"):
            self.read(rel)
        root_rules = self.read("AGENTS.md") or ""
        if len(root_rules.splitlines()) > 250:
            self.error("instructions.size", "AGENTS.md", "root instructions exceed 250 lines")
        for scope in SCOPES:
            rel = scope + "/AGENTS.md"
            text = self.read(rel) or ""
            for marker in ("Scope:", "Source of truth:", "Allowed:", "Forbidden:",
                           "Validation:", "Owner and approval:", "Handoff:"):
                if marker not in text:
                    self.error("instructions.contract", rel, "missing contract marker " + marker)
            if "python3 scripts/validate_scaffold.py" not in text:
                self.error("instructions.validation", rel, "missing concrete root validation command")
        for dept in DEPARTMENTS:
            for filename in ("SKILLS.md", "WORKFLOWS.md"):
                self.read(dept + "/" + filename)

        skills = self.inventory(".agents/skills", "*/SKILL.md", EXPECTED_SKILLS, "skill.inventory")
        self.counts["skills"] = len(skills)
        seen = set()
        for path in skills:
            rel = str(path.relative_to(self.root))
            text = self.read(rel)
            if text is None:
                continue
            lines = text.splitlines()
            try:
                if not lines or lines[0] != "---":
                    raise ValueError()
                end = lines.index("---", 1)
                data = yaml_load("\n".join(lines[1:end]), self.yaml)
            except (ValueError, TypeError, self.yaml.YAMLError, RecursionError):
                self.error("parse.invalid", rel, "invalid or missing skill frontmatter")
                continue
            if not self.check_schema(data, "skill", rel):
                continue
            name = data["name"]
            if name in seen:
                self.error("skill.duplicate", rel, "duplicate project skill name")
            seen.add(name)
            if name != path.parent.name:
                self.error("skill.path", rel, "skill name must match its directory")
            if not "\n".join(lines[end + 1:]).strip():
                self.error("skill.body", rel, "skill body is empty")
            if f".agents/skills/{path.parent.name}/SKILL.md" not in (self.read("SKILLS.md") or ""):
                self.error("skill.index", rel, "exact path is absent from skill index")
        roles = self.inventory("agents/roles", "*/ROLE.md", EXPECTED_ROLES, "role.inventory")
        for path in roles:
            rel = str(path.relative_to(self.root))
            text = self.read(rel) or ""
            if not any(f".agents/skills/{name}/SKILL.md" in text for name in EXPECTED_SKILLS):
                self.error("role.skill", rel, "role must reference an existing project skill")
        self.counts["roles"] = len(roles)

        workflows = self.inventory("workflows/definitions", "*.yaml", EXPECTED_WORKFLOWS, "workflow.inventory")
        self.counts["workflows"] = len(workflows)
        seen = set()
        for path in workflows:
            rel = str(path.relative_to(self.root))
            data = self.parse(rel)
            if not self.check_schema(data, "workflow", rel):
                continue
            if data["id"] in seen:
                self.error("workflow.duplicate", rel, "duplicate workflow identifier")
            seen.add(data["id"])
            if data["id"] != path.stem:
                self.error("workflow.path", rel, "workflow identifier must match filename")
            if data["owner"] not in EXPECTED_ROLES:
                self.error("workflow.owner", rel, "unknown accountable role")
            stages = set()
            for stage in data["stages"]:
                if stage["id"] in stages:
                    self.error("workflow.stage_duplicate", rel, "duplicate stage identifier")
                stages.add(stage["id"])
                if stage["skill"] not in {p.parent.name for p in skills}:
                    self.error("workflow.skill", rel, "stage references unknown project skill")
                if stage["tool"] != "manual":
                    self.error("workflow.tool", rel, "Phase A stages must remain instruction-only/manual")

        machines = self.inventory("workflows/state-machines", "*.yaml",
                                  {"approval", "content", "experiment", "release"}, "state.inventory")
        self.counts["state_machines"] = len(machines)
        for path in machines:
            rel = str(path.relative_to(self.root))
            data = self.parse(rel)
            if self.check_schema(data, "state", rel):
                if data["initial"] not in data["states"] or data["default_on_error"] not in data["states"]:
                    self.error("state.membership", rel, "initial and error states must be declared")
                if data["id"] != path.stem:
                    self.error("state.path", rel, "state machine identifier must match filename")

        for tenant, handle in HANDLES.items():
            prefix = f"brands/{tenant}/"
            for filename in ("VOICE.md", "DESIGN.md", "POSITIONING.md", "MESSAGING.md"):
                self.read(prefix + filename)
            instructions = self.read(prefix + "AGENTS.md") or ""
            if "profile.yaml" in instructions or "profile.json" not in instructions:
                self.error("brand.reference", prefix + "AGENTS.md", "brand must reference its existing profile.json")
            for filename, kind, key in (("profile.json", "profile", "id"),
                                         ("tokens.json", "tokens", "tenant"),
                                         ("claims-ledger.yaml", "claims", "tenant")):
                rel = prefix + filename
                data = self.parse(rel)
                if self.check_schema(data, kind, rel):
                    if data[key] != tenant:
                        self.error("brand.tenant", rel, "object belongs to the wrong tenant")
                    if kind == "profile" and data["expected_x_handle"] != handle:
                        self.error("brand.account", rel, "expected account handle does not match tenant")
                    if kind == "claims":
                        ids = set()
                        for claim in data["claims"]:
                            if claim["tenant"] != tenant:
                                self.error("brand.tenant", rel, "claim belongs to the wrong tenant")
                            if claim["claim_id"] in ids:
                                self.error("claim.duplicate", rel, "duplicate claim identifier")
                            ids.add(claim["claim_id"])
            extra = "expertise-ledger.yaml" if tenant == "founder" else "product-facts.yaml"
            data = self.parse(prefix + extra)
            if not isinstance(data, dict) or data.get("tenant") != tenant:
                self.error("brand.tenant", prefix + extra, "tenant-specific evidence ledger is invalid")

        for filename, expected, code in (("defaults.yaml", DEFAULTS, "policy.defaults"),
                                          ("feature-flags.yaml", FLAGS, "policy.flags")):
            rel = "config/" + filename
            data = self.parse(rel)
            if (not isinstance(data, dict) or set(data) != set(expected) or
                    any(data.get(k) != v or type(data.get(k)) is not type(v) for k, v in expected.items())):
                self.error(code, rel, "Phase A disabled-write, zero-spend defaults must match exactly")
        accounts = self.parse("config/accounts.example.yaml")
        if not isinstance(accounts, dict) or not isinstance(accounts.get("accounts"), dict):
            self.error("policy.accounts", "config/accounts.example.yaml", "invalid account declarations")
        else:
            expected = {tenant: {"platform": "x", "expected_handle": handle, "status": "NOT_AUTHENTICATED"}
                        for tenant, handle in HANDLES.items()}
            if accounts["accounts"] != expected:
                self.error("policy.accounts", "config/accounts.example.yaml", "accounts must remain distinct and unauthenticated")
        extra_files = [self.root / "config/model-routing.example.yaml"]
        extra_files += [self.root / "agents/handoffs" / (name + ".yaml") for name in
                        ("approval-to-distribution", "creative-to-review", "research-to-brief")]
        extra_files += [self.root / "brands" / tenant / (name + ".yaml")
                        for tenant in HANDLES for name in ("channels", "pillars")]
        extra_files += [self.root / ".agents/vendor/manifest.lock.yaml"]
        for path in sorted(extra_files):
            rel = str(path.relative_to(self.root))
            if rel not in self.documents:
                self.parse(rel)
        return self.report()

    def report(self):
        return {"status": "FAIL" if self.findings else "PASS", "scope": "phase-a-governance",
                "counts": self.counts, "findings": self.findings,
                "limitations": ["Static contracts only; runtime integration NOT TESTED.",
                                "Instruction authority requires documented human/operator review."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--json", action="store_true", help="emit redacted machine-readable findings")
    args = parser.parse_args()
    try:
        import yaml
        import jsonschema
    except ImportError:
        report = {"status": "BLOCKED", "scope": "phase-a-governance", "counts": {},
                  "findings": [{"code": "dependency.missing", "path": "scripts/validate_scaffold.py",
                                "message": "PyYAML and jsonschema required; see scripts/requirements-validation.txt"}]}
        code = 4
    else:
        report = Audit(args.root, yaml, jsonschema).run()
        code = 0 if report["status"] == "PASS" else 5
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"{report['status']}: Phase A governance; " +
              ", ".join(f"{value} {key}" for key, value in report["counts"].items()))
        for item in report["findings"]:
            print(f"{item['code']}: {item['path']}: {item['message']}")
        print("Runtime integration NOT TESTED.")
    return code


if __name__ == "__main__":
    sys.exit(main())
