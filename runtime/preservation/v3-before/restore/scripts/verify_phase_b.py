#!/usr/bin/env python3
"""Reproduce Phase B build/tests, local CLI demos and evidence without provider calls."""
import hashlib
import json
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
    (root / "runtime").mkdir(exist_ok=True)
    checks = {}
    commands = {
        "dependencies": [sys.executable, "scripts/inventory_dependencies.py"],
        "lint": ["pnpm", "lint"],
        "build": ["pnpm", "build"],
        "tests": ["pnpm", "exec", "vitest", "run", "--reporter=json", "--outputFile=runtime/phase-b-vitest.json"],
        "governance": [sys.executable, "scripts/validate_scaffold.py", "--json"],
        "python-tests": [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
    }
    def run(name, command):
        start = time.monotonic()
        completed = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=60)
        record = {"command": command, "exit": completed.returncode, "elapsed_seconds": round(time.monotonic() - start, 3),
                  "stdout": completed.stdout, "stderr": completed.stderr}
        checks[name] = {"exit": completed.returncode, "status": "PASS" if completed.returncode == 0 else "FAIL"}
        (evidence / f"phase-b-{name}.json").write_text(json.dumps(record, indent=2) + "\n")
        print(name + ": " + checks[name]["status"], flush=True)
        return completed

    for name, command in commands.items():
        completed = run(name, command)
        if name == "dependencies" and completed.returncode == 0:
            (evidence / "phase-b-dependencies.json").write_text(json.dumps(json.loads(completed.stdout), indent=2) + "\n")
        if name == "tests" and completed.returncode == 0:
            report = json.loads((root / "runtime/phase-b-vitest.json").read_text())
            (evidence / "phase-b-tests.json").write_text(json.dumps({"command": command, "exit": completed.returncode,
                "summary": {k: report.get(k) for k in ("numTotalTests", "numPassedTests", "numFailedTests", "success")}}, indent=2) + "\n")
        if completed.returncode:
            print("Verification stopped; inspect redacted/local test evidence. No later steps were run.")
            return 5

    # These are public local replay IDs, not credentials; keep demo values plainly readable.
    counter_path = root / "runtime/phase-b-demo-counter"
    counter = int(counter_path.read_text()) + 1 if counter_path.exists() else 1
    counter_path.write_text(str(counter))
    key = "demo-" + str(counter).zfill(6)
    demos = []
    def cli(arguments, expected=0):
        command = ["./gtm", *arguments, "--json"]
        completed = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=15)
        result = json.loads(completed.stdout)
        passed = completed.returncode == expected and not completed.stderr
        demos.append({"command": command, "expected_exit": expected, "exit": completed.returncode, "passed": passed, "result": result})
        if not passed:
            raise RuntimeError("CLI demo failed; do not claim Phase B complete")
        return result

    for arguments in (["doctor"], ["skills", "list"], ["workflow", "list"], ["agents", "list"], ["install", "audit"]):
        cli(arguments)
    for tenant, workflow in (("retropick", "feature-launch"), ("founder", "build-in-public")):
        cli(["brand", "validate", "--brand", tenant])
        cli(["claims", "audit", "--brand", tenant])
        result = cli(["workflow", "run", workflow, "--brand", tenant, "--offline", "--idempotency-key", key + "-" + tenant[0]])
        job_id = result["data"]["job"]["id"]
        cli(["workflow", "resume", job_id, "--brand", tenant, "--offline"])
        cli(["audit", "trace", "--brand", tenant, "--job", job_id])
        for artifact in result["data"]["artifacts"]:
            if hashlib.sha256((root / artifact["relativePath"]).read_bytes()).hexdigest() != artifact["sha256"]:
                raise RuntimeError("Demo artifact digest mismatch")
    cli(["costs", "report"])
    cli(["publish", "dry-run", "--brand", "retropick"], 3)
    cli(["x", "auth", "status", "--brand", "founder"], 4)
    (evidence / "phase-b-cli.json").write_text(json.dumps({"label": "SYNTHETIC_WORKFLOW_DEMOS", "commands": demos}, indent=2) + "\n")
    checks["cli"] = {"status": "PASS", "exit": 0, "commands": len(demos)}
    security = run("security", [sys.executable, "scripts/security_audit.py", "--json"])
    if security.returncode:
        return 5

    manifest_path = evidence / "phase-b-sources.json"
    excluded = {"docs/evidence/phase-b-sources.json", "docs/evidence/phase-b-receipt.json"}
    manifest = {"algorithm": "sha256", "files": [
        {"path": str(path.relative_to(root)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        for path in project_inputs(root) if str(path.relative_to(root)) not in excluded],
        "excluded_self_references": sorted(excluded)}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    receipt = {"revision": "phase-b-r1", "observed_at": datetime.now(timezone.utc).isoformat(), "status": "PASS",
        "baseline_commit": "36d4a04", "branch": "codex/gtm-phase-b",
        "audience": "Owner and local implementers", "approval": "Local Phase B only; no live external actions",
        "inputs": ["FOUNDER_RETROPICK_GTM_OS_MASTER_PROMPT_V2.md", "CODEX_GTM_OS_V2_PHASED_EXECUTION.md", "docs/adr/"],
        "asset_source_license": "JSON synthetic fixtures only; no third-party media; dependency metadata in phase-b-dependencies.json",
        "checks": checks, "source_manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "project_provider_calls": 0, "project_api_charges_usd": 0, "operator_model_compute_cost": "NOT_MEASURED",
        "benchmark_savings": "NOT_MEASURED", "limitations": ["No real research, marketing copy, image/video renderer or live analytics.",
            "No authenticated provider identity, signed owner approval or live publishing.",
            "Audit hashes detect corruption; local database owners can rewrite storage; no external cryptographic anchor.",
            "Synthetic source validity is 24 hours; use a new run/key when expired."]}
    (evidence / "phase-b-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"status": "PASS", "checks": checks, "sources_hashed": len(manifest["files"]),
                      "receipt": "docs/evidence/phase-b-receipt.json"}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (subprocess.TimeoutExpired, OSError, ValueError, RuntimeError):
        print("BLOCKED/FAIL: Phase B verification did not finish; inspect existing local receipts.", file=sys.stderr)
        raise SystemExit(5)
