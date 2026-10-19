#!/usr/bin/env python3
"""Reproduce Phase C local gates without installs, provider calls or historical receipt changes."""
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from project_inputs import project_inputs

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write(name, value):
    path = EVIDENCE / f"phase-c-{name}.json"
    path.write_text(json.dumps(value, indent=2) + "\n")
    return path


def run(command, expected=0):
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=180)
    if result.returncode != expected:
        # Redact arbitrary source/exception text; the exact command can be rerun locally.
        raise RuntimeError(f"Gate failed: {' '.join(command)}; exit {result.returncode}, expected {expected}")
    return result


def main():
    (ROOT / "runtime").mkdir(exist_ok=True)
    historical = {p: digest(p.read_bytes()) for p in EVIDENCE.glob("phase-[ab]-*.json")}
    checks = []
    for name, command in [("lint", ["pnpm", "lint"]), ("build", ["pnpm", "build"])]:
        result = run(command)
        write(name, {"command": command, "status": "PASS", "exit": result.returncode})
        checks.append(name)
    run(["pnpm", "exec", "vitest", "run", "--reporter=json", "--outputFile=runtime/phase-c-vitest.json"])
    tests = json.loads((ROOT / "runtime/phase-c-vitest.json").read_text())
    if not tests["success"] or tests["numFailedTests"] or tests["numPendingTests"]:
        raise RuntimeError("Runtime tests did not all pass")
    write("tests", {"status": "PASS", "tests": tests["numTotalTests"], "passed": tests["numPassedTests"],
                    "suites": tests["numTotalTestSuites"], "failed": tests["numFailedTests"], "skipped": tests["numPendingTests"]})
    checks.append("runtime-tests")
    governance = json.loads(run(["python3", "scripts/validate_scaffold.py", "--json"]).stdout)
    write("governance", governance)
    result = run(["python3", "-m", "unittest", "discover", "-s", "tests", "-v"])
    write("python-tests", {"status": "PASS", "output": result.stdout + result.stderr})
    checks.extend(["governance", "python-tests"])
    run(["node", "scripts/generate_phase_c_samples.mjs"])
    samples = (EVIDENCE / "phase-c-samples.json").read_bytes()
    run(["node", "scripts/generate_phase_c_samples.mjs"])
    if samples != (EVIDENCE / "phase-c-samples.json").read_bytes():
        raise RuntimeError("Recorded-clock sample replay changed bytes")
    for entry in json.loads(samples)["files"]:
        if digest((ROOT / entry["path"]).read_bytes()) != entry["sha256"]:
            raise RuntimeError("Sample output manifest mismatch")
    checks.append("byte-identical-sample-replay")
    cli_root = "runtime/phase-c-sample-workspace"
    # CLI checks use fresh local observations, independently of historical sample replay.
    observed = datetime.now(timezone.utc)
    for tenant in ("retropick", "founder"):
        path = ROOT / cli_root / f"research/inbox/{tenant}/voice.json"
        value = json.loads(path.read_text())
        value.update(id=f"{tenant}-voice-cli-check", observedAt=observed.isoformat(),
                     expiresAt=(observed + timedelta(days=7)).isoformat())
        path.write_text(json.dumps(value))
    commands = [(["doctor"], 0), (["install", "audit"], 0), (["skills", "list"], 0)]
    for tenant in ("retropick", "founder"):
        commands.extend([
            (["research", "ingest", "--brand", tenant, "--source", f"research/inbox/{tenant}/voice.json", "--offline"], 0),
            (["research", "daily", "--brand", tenant, "--offline"], 0),
            (["strategy", "icp", "--brand", tenant], 0),
            (["campaign", "plan", "--brand", tenant, "--days", "30"], 0),
            (["content", "calendar", "--brand", tenant, "--days", "14"], 0),
            (["content", "brief", "--brand", tenant, "--topic", "Inspect one source-aware example"], 0),
            (["publish", "run", "--brand", tenant], 3),
            (["x", "auth", "status", "--brand", tenant], 4),
        ])
    commands.extend([(["content", "calendar"], 2),
                     (["research", "daily", "--brand", "founder"], 3),
                     (["content", "calendar", "--brand", "founder", "--days", "0"], 2)])
    cli_checks = []
    for args, expected in commands:
        result = run(["node", "dist/packages/cli/src/index.js", *args, "--root", cli_root, "--json"], expected)
        payload = json.loads(result.stdout)
        cli_checks.append({"args": args, "exit": result.returncode, "expected_exit": expected,
                           "status": payload["status"], "output_sha256": digest(result.stdout.encode())})
    write("cli", {"status": "PASS", "checks": cli_checks, "provider_calls": 0})
    checks.append("cli")
    security = json.loads(run(["python3", "scripts/security_audit.py", "--json"]).stdout)
    write("security", security)
    checks.append("scoped-security")
    if any(digest(p.read_bytes()) != hash_value for p, hash_value in historical.items()):
        raise RuntimeError("Historical A/B evidence changed")
    sources = [{"path": str(p.relative_to(ROOT)), "sha256": digest(p.read_bytes())}
               for p in project_inputs(ROOT) if p.name not in {"phase-c-sources.json", "phase-c-receipt.json"}]
    source_manifest = write("sources", {"files": sources})
    write("receipt", {"revision": "phase-c-r1", "status": "PASS", "checks": checks,
                      "runtime_tests": tests["numPassedTests"], "cli_checks": len(cli_checks),
                      "sources": {"path": str(source_manifest.relative_to(ROOT)), "sha256": digest(source_manifest.read_bytes())},
                      "baseline_commit": "897aa61", "historical_evidence_unchanged": True,
                      "upstream_references": 3, "upstream_code_executed": False,
                      "external_writes": 0, "project_provider_calls": 0, "project_provider_cost_usd": 0,
                      "operator_compute_cost": "NOT_MEASURED", "public_claims_promoted": 0,
                      "limitations": ["Sample replay uses a recorded historical evaluation clock; live commands check actual time",
                                      "No independently verified product capabilities or personal achievements; public drafts still require proof",
                                      "Source ingestion is local authorized files only, not a live crawler",
                                      "Static scoped security checks do not certify all dependencies, upstream code or legal compliance"]})
    print(json.dumps({"status": "PASS", "runtime_tests": tests["numPassedTests"], "cli_checks": len(cli_checks), "receipt": "docs/evidence/phase-c-receipt.json"}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, OSError, subprocess.TimeoutExpired, ValueError, KeyError) as error:
        print(json.dumps({"status": "FAIL", "reason": str(error)}))
        sys.exit(5)
