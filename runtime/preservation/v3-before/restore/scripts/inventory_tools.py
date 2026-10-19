#!/usr/bin/env python3
"""Read-only executable/version receipts. No router dispatch, auth or provider requests."""
import ast
import hashlib
import importlib.metadata
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

COMMANDS = {
    "python3": ["--version"], "git": ["--version"], "node": ["--version"],
    "pnpm": ["--version"], "npm": ["--version"], "codex": ["--version"],
    "ffmpeg": ["-version"], "ffprobe": ["-version"], "gitleaks": ["version"],
    "semgrep": ["--version", "--disable-version-check"], "trivy": ["--version"],
    "bd": ["--version"], "rtk": ["--version"],
}


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    result = {"observed_at": datetime.now(timezone.utc).isoformat(), "revision": "phase-a-r1",
              "scope": "local executable metadata; no provider connectivity",
              "tools": {}, "packages": {}, "limitations": [
                  "Presence/version/hash does not verify integrations, account access or commercial asset rights.",
                  "No credential files or router configuration read; no external executables installed."]}
    for name, arguments in COMMANDS.items():
        executable = shutil.which(name)
        record = {"status": "NOT_ON_PATH", "command": [name, *arguments]}
        if executable:
            path = Path(executable)
            record.update(path=str(path), resolved_path=str(path.resolve()), sha256=digest(path))
            try:
                completed = subprocess.run([executable, *arguments], capture_output=True, text=True, timeout=15)
                lines = (completed.stdout or completed.stderr).splitlines()
                record.update(exit=completed.returncode, version=lines[0] if lines else "NOT_REPORTED",
                              status="VERSION_VERIFIED" if completed.returncode == 0 else "BLOCKED")
            except (subprocess.TimeoutExpired, OSError):
                record["status"] = "BLOCKED"
        result["tools"][name] = record
    for name in ("codex-auto", "codex-router", "zodex", "glm", "tsc", "xerj-project"):
        executable = shutil.which(name)
        result["tools"][name] = {"status": "PRESENT_NOT_EXECUTED" if executable else "NOT_ON_PATH"}
        if executable:
            result["tools"][name].update(path=executable, sha256=digest(Path(executable)))
    for name in ("PyYAML", "jsonschema"):
        try:
            result["packages"][name] = {"version": importlib.metadata.version(name),
                                        "license_metadata": importlib.metadata.metadata(name).get("License", "NOT_REPORTED")}
        except importlib.metadata.PackageNotFoundError:
            result["packages"][name] = {"status": "BLOCKED_MISSING"}
    # Only this known, non-secret implementation file is within the approved router capability audit.
    router = Path("/home/ubuntu/codex-model-router/router/dispatch/cli.py")
    if router.is_file():
        tree = ast.parse(router.read_text())
        flags = sorted({node.value for node in ast.walk(tree) if isinstance(node, ast.Constant)
                        and isinstance(node.value, str) and re.fullmatch(r"--[a-z][a-z0-9-]*", node.value)})
        result["router_capabilities"] = {"source": str(router), "sha256": digest(router),
                                         "declared_flags": flags, "connectivity": "NOT_TESTED"}
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
