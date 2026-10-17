#!/usr/bin/env python3
"""Run existing local scanners against allowlisted copies; emit redacted summaries."""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from project_inputs import project_inputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    files = project_inputs(root)
    report = {"scope": "local-governance-runtime-sources", "files": len(files), "checks": [],
              "limitations": ["No credential stores, runtime logs, Git history, or Beads data scanned.",
                              "Semgrep uses local rules only; this is not a full dependency audit."]}
    env = {k: v for k, v in os.environ.items() if not k.startswith(("GITLEAKS_", "SEMGREP_"))}
    env.update({"SEMGREP_SEND_METRICS": "off", "SEMGREP_ENABLE_VERSION_CHECK": "0"})
    runtime = root / "runtime"
    runtime.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="phase-a-scan-", dir=runtime) as folder:
        target = Path(folder)
        for p in files:
            copy = target / p.relative_to(root)
            copy.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(p, copy)
        commands = {
            "gitleaks": ["gitleaks", "dir", str(target), "--redact=100", "--no-banner", "--no-color",
                         "--max-decode-depth", "0", "--report-format", "json", "--report-path", "-"],
            "semgrep": ["semgrep", "scan", "--config", str(root / "scripts/semgrep-phase-a.yaml"),
                        "--metrics=off", "--disable-version-check", "--no-git-ignore", "--json", "--error",
                        *[str(target / name) for name in ("scripts", "tests", "packages", "adapters") if (target / name).is_dir()]],
        }
        for tool, command in commands.items():
            check = {"tool": tool, "status": "BLOCKED", "findings": None}
            if shutil.which(tool):
                try:
                    result = subprocess.run(command, capture_output=True, text=True, env=env, timeout=60)
                    data = json.loads(result.stdout or ("[]" if tool == "gitleaks" else "{}"))
                    findings = len(data) if tool == "gitleaks" else len(data.get("results", []))
                    errors = [] if tool == "gitleaks" else data.get("errors", [])
                    check.update(exit=result.returncode, findings=findings,
                                 status="PASS" if result.returncode == 0 and not errors and findings == 0 else "FAIL")
                    if tool == "gitleaks" and findings:
                        check["locations"] = [{"rule": item.get("RuleID"),
                                               "path": str(Path(item["File"]).relative_to(target)),
                                               "line": item.get("StartLine")} for item in data[:20]]
                    if tool == "semgrep":
                        check["files_scanned"] = len(data.get("paths", {}).get("scanned", []))
                        check["scanner_errors"] = len(errors)
                        if not check["files_scanned"]:
                            check["status"] = "FAIL"
                except (subprocess.TimeoutExpired, OSError, ValueError):
                    check["reason"] = "scanner timed out or did not return valid structured output"
            else:
                check["reason"] = "scanner executable unavailable; nothing installed"
            # Never forward scanner source lines, matched values, or raw stderr.
            report["checks"].append(check)
    report["status"] = ("BLOCKED" if any(c["status"] == "BLOCKED" for c in report["checks"])
                        else "PASS" if all(c["status"] == "PASS" for c in report["checks"]) else "FAIL")
    print(json.dumps(report, indent=2) if args.json else
          "\n".join([report["status"] + ": Local source security"] +
                    [f"{c['tool']}: {c['status']}; findings={c['findings']}" for c in report["checks"]]))
    return {"PASS": 0, "BLOCKED": 4, "FAIL": 5}[report["status"]]


if __name__ == "__main__":
    sys.exit(main())
