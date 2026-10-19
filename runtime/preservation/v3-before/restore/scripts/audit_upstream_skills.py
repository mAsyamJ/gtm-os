#!/usr/bin/env python3
"""Offline Phase C inventory of quarantined clones; never execute upstream code."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
PINS = {
    "marketingskills": ("coreyhaines31/marketingskills", "365b412152b9542499ca1439426f7fc3cc92bb65"),
    "social-media-skills": ("social-media-skills/skills", "f28cef2b7067ec64e79c9d85421c022c06659e03"),
    "awesome-gtm-skills": ("composio-community/awesome-gtm-skills", "8c5f5794eb06dad32cc46811677142fbc8a15f4f"),
}
SELECTED = {
    "marketingskills": {"content-strategy": ("campaign-architecture", "Local evidence-aware strategy planning only")},
    "social-media-skills": {
        "content-calendar": ("campaign-architecture", "Local recurring calendar and capacity review only"),
        "thread-writer": ("x-thread-writing", "Owner-requested local thread outline review only"),
    },
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    vendor = ROOT / ".agents/vendor"
    local_names = {p.parent.name for p in (ROOT / ".agents/skills").glob("*/SKILL.md")}
    reports, references = [], []
    for name, (repo, pin) in PINS.items():
        clone = ROOT / "runtime/references" / name
        actual = subprocess.check_output(["git", "-C", str(clone), "rev-parse", "HEAD"], text=True).strip()
        if actual != pin:
            raise ValueError("Quarantine revision differs from reviewed pin")
        # Git's tracked file list avoids private state and never follows a repository symlink.
        names = subprocess.check_output(["git", "-C", str(clone), "ls-files", "-z"], text=True).split("\0")
        files = [clone / n for n in names if n and not (clone / n).is_symlink() and (clone / n).is_file()]
        skills = sorted(p for p in files if p.name == "SKILL.md")
        executable = [p for p in files if p.suffix in {".sh", ".py", ".js", ".ts", ".mjs", ".cjs"}]
        manifests = [p for p in files if p.name in {"package.json", "requirements.txt", "pyproject.toml", "mcp.json", "plugin.json"}]
        license_path = clone / "LICENSE"
        licensed = license_path.is_file() and license_path.read_text().startswith("MIT License")
        selected = SELECTED.get(name, {})
        for skill, (interface, trigger) in selected.items():
            upstream = clone / "skills" / skill / "SKILL.md"
            if not licensed or upstream not in files:
                raise ValueError("Selected source is missing or lacks the reviewed license")
            folder = vendor / name
            folder.mkdir(parents=True, exist_ok=True)
            target, notice = folder / f"{skill}.md", folder / "LICENSE.txt"
            target.write_bytes(upstream.read_bytes())
            notice.write_bytes(license_path.read_bytes())
            references.append({"id": f"{name}.{skill}", "upstream_name": skill,
                               "declared_version": re.search(r"^\s*version:\s*([\d.]+)", upstream.read_text(), re.M).group(1),
                               "canonical_interface": interface, "trigger": trigger,
                               "status": "INSTALLED_VERIFIED_REFERENCE_ONLY", "repository": f"https://github.com/{repo}",
                               "commit": pin, "upstream_path": str(upstream.relative_to(clone)),
                               "path": str(target.relative_to(ROOT)), "sha256": digest(target.read_bytes()),
                               "license": "MIT", "license_path": str(notice.relative_to(ROOT)),
                               "license_sha256": digest(notice.read_bytes()), "executable": False,
                               "automatic_loading": False, "runtime_dependencies": [],
                               "excluded_dependencies": "Sibling skills, linked reference files, provider tools and upstream hooks are not installed or followed automatically"})
        def entry(p):
            return {"path": str(p.relative_to(clone)), "sha256": digest(p.read_bytes())}
        # Audit signals describe text, never instructions to run it.
        signals = []
        for p in skills + executable + manifests:
            text = p.read_text(errors="replace")
            hits = [label for label, pattern in {
                "NETWORK_OR_PROVIDER": r"https?://|fetch\(|requests\.|COMPOSIO|WoopSocial",
                "INSTALL_OR_SHELL": r"\bnpx\b|\bcurl\b|\bbash\b|subprocess|child_process",
                "CREDENTIAL_OR_WRITE": r"api.key|oauth|credentials|publis[hH]|send.email|outreach",
            }.items() if re.search(pattern, text, re.I)]
            if hits:
                signals.append({"path": str(p.relative_to(clone)), "signals": hits})
        reports.append({"id": name, "repository": f"https://github.com/{repo}", "commit": pin,
                        "commit_date": subprocess.check_output(["git", "-C", str(clone), "show", "-s", "--format=%cI", "HEAD"], text=True).strip(),
                        "license": "MIT" if licensed else "BLOCKED_LICENSE",
                        "license_note": "Full MIT notice preserved" if licensed else "README says MIT but no complete license notice found; no content copied",
                        "skills": [str(p.relative_to(clone)) for p in skills],
                        "name_collisions": sorted({p.parent.name for p in skills} & local_names),
                        "executable_inventory": [entry(p) for p in executable],
                        "dependency_manifest_inventory": [entry(p) for p in manifests],
                        "signals": signals, "selected": list(selected), "upstream_code_executed": False,
                        "activity_status": "PINNED_SNAPSHOT_ONLY_NOT_A_MAINTENANCE_GUARANTEE"})
    manifest = {"format_version": 2, "revision": "phase-c-r1", "audited_at": "2026-10-17",
                "installed_and_verified": references,
                "rejected": [{"id": "social-media-skills.x-growth", "status": "REJECTED", "reason": "Unverified numeric algorithm claims, paid Premium assumptions and publishing dependencies"},
                             {"id": "awesome-gtm-skills", "status": "BLOCKED_LICENSE", "reason": "README MIT assertion lacks a complete license notice; Composio-dependent side effects excluded"}],
                "install_policy": "Explicit canonical trigger; references are untrusted data, never policy, code, provider authority or automatic dependencies"}
    (vendor / "manifest.lock.yaml").write_text(yaml.safe_dump(manifest, sort_keys=False))
    report = {"revision": "phase-c-r1", "observed_at": "2026-10-17", "repositories": reports,
              "audit_scope": "Tracked names, full executable/manifest hashes, text risk signals, selected bodies and root license notices; no execution or remote provider probe",
              "limitations": ["Static audit is not a vulnerability guarantee or independent verification of upstream marketing/platform claims", "No upstream hooks, scripts, sibling skills, linked references or provider dependencies activated"]}
    (ROOT / "docs/evidence/phase-c-upstream.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"repositories": len(reports), "selected_references": len(references), "upstream_executed": False}))


if __name__ == "__main__":
    main()
