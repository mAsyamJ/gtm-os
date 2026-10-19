#!/usr/bin/env python3
"""Reproduce local Phase A checks and write reviewable evidence; never installs tools."""
import hashlib
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from project_inputs import project_inputs


def main():
    root = Path(__file__).resolve().parents[1]
    evidence = root / "docs/evidence"
    evidence.mkdir(exist_ok=True)
    checks = {}
    commands = {
        "validation": [sys.executable, "scripts/validate_scaffold.py", "--json"],
        "tests": [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
        "security": [sys.executable, "scripts/security_audit.py", "--json"],
    }
    for name, command in commands.items():
        start = time.monotonic()
        try:
            run = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=60)
            if name == "tests":
                output = run.stdout + run.stderr
                match = re.search(r"Ran (\d+) tests", output)
                detail = {"tests_run": int(match[1]) if match else None,
                          "status": "PASS" if run.returncode == 0 and match else "FAIL",
                          "transcript": output}
            else:
                detail = json.loads(run.stdout)
            checks[name] = {"command": ["python3", *command[1:]], "exit": run.returncode,
                            "elapsed_seconds": round(time.monotonic() - start, 3), "result": detail}
        except (subprocess.TimeoutExpired, OSError, ValueError):
            checks[name] = {"command": ["python3", *command[1:]], "exit": 4,
                            "result": {"status": "BLOCKED", "reason": "check unavailable, timed out or returned invalid JSON"}}
        (evidence / f"phase-a-{name}.json").write_text(json.dumps(checks[name], indent=2) + "\n")
    excluded = {"docs/evidence/phase-a-sources.json", "docs/evidence/phase-a-receipt.json"}
    # Separate paths from digest field names, so token-file names cannot look like API-key assignments.
    sources = [{"path": str(p.relative_to(root)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in project_inputs(root) if str(p.relative_to(root)) not in excluded]
    baseline_file = evidence / "phase-a-baseline.json"
    original = {entry["path"]: entry["sha256"] for entry in
                json.loads(baseline_file.read_text())["files"]} if baseline_file.is_file() else {}
    classification = {"changed_from_baseline": [], "unchanged_from_baseline": [],
                      "not_in_baseline_manifest": []}
    for entry in sources:
        key = ("not_in_baseline_manifest" if entry["path"] not in original else
               "unchanged_from_baseline" if original[entry["path"]] == entry["sha256"] else
               "changed_from_baseline")
        classification[key].append(entry["path"])
    manifest = evidence / "phase-a-sources.json"
    manifest.write_text(json.dumps({"algorithm": "sha256", "files": sources,
                                    "excluded_self_references": sorted(excluded)}, indent=2) + "\n")
    passed = all(c["exit"] == 0 and c["result"]["status"] == "PASS" for c in checks.values())
    blocked = any(c["result"]["status"] == "BLOCKED" for c in checks.values())
    baseline = subprocess.run(["git", "log", "-1", "--format=%H", "--grep=preserve audited GTM scaffold baseline"],
                              cwd=root, capture_output=True, text=True)
    receipt = {"revision": "phase-a-r1", "observed_at": datetime.now(timezone.utc).isoformat(),
               "status": "PASS" if passed else "BLOCKED" if blocked else "FAIL",
               "audience": "owner and local implementers", "approval": "local Phase A implementation only",
               "inputs": ["FOUNDER_RETROPICK_GTM_OS_MASTER_PROMPT_V2.md", "CODEX_GTM_OS_V2_PHASED_EXECUTION.md"],
               "asset_source_license": "No creative assets used; original scaffold distribution license unspecified.",
               "baseline_commit": baseline.stdout.strip() if baseline.returncode == 0 else "UNAVAILABLE",
               "file_classification": classification,
               "checks": {name: {"exit": value["exit"], "status": value["result"]["status"]}
                          for name, value in checks.items()},
               "source_manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
               "project_paid_api_calls": 0, "project_api_charges_usd": 0,
               "operator_model_cost": "NOT_MEASURED", "benchmark_savings": "NOT_MEASURED",
               "limitations": ["Static governance only; runtime integration NOT TESTED.",
                               "No authenticated account identity, media exports or live provider tests.",
                               "No independent human security or license approval implied."]}
    (evidence / "phase-a-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"status": receipt["status"], "checks": receipt["checks"],
                      "sources_hashed": len(sources), "receipt": "docs/evidence/phase-a-receipt.json"}, indent=2))
    return 0 if passed else 4 if blocked else 5


if __name__ == "__main__":
    sys.exit(main())
