#!/usr/bin/env python3
"""Trusted launcher. Never imports Harness² or loads provider configuration on the host."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
BASE = "53aed8d3e14d5555d9b94c983129bcf19634f1f55a330fb49596e9a52ec425ad"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(argv, timeout=300):
    env = {k: os.environ[k] for k in ("PATH", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS") if k in os.environ}
    result = subprocess.run(argv, cwd=ROOT, env=env, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"Isolated command failed ({result.returncode}): {result.stderr[-3000:]}")
    return result.stdout


def source_identity():
    pin = json.loads((ROOT / "config/v3-harness-pin.json").read_text())
    upstream = ROOT / "runtime/harness2/vendor"
    expected = {f["path"] for f in pin["upstreamFiles"]}
    actual = {str(p.relative_to(upstream)) for p in upstream.rglob("*") if p.is_file()}
    if actual != expected:
        raise ValueError("Upstream inventory changed")
    for record in pin["upstreamFiles"]:
        path = upstream / record["path"]
        if path.is_symlink() or digest(path) != record["sha256"]:
            raise ValueError("Pinned upstream bytes changed")
    if digest(ROOT / "harness/fixtures/public.json") != pin["fixtureSha256"]:
        raise ValueError("Frozen public fixture changed")
    paths = [p for p in (ROOT / "harness").rglob("*") if p.is_file() and "__pycache__" not in p.parts]
    identity = hashlib.sha256(json.dumps([(str(p.relative_to(ROOT)), digest(p)) for p in sorted(paths)], sort_keys=True).encode()).hexdigest()
    return pin, identity


def build(identity):
    image = f"localhost/gtm-harness-v3:{identity[:20]}"
    if subprocess.run(["podman", "image", "exists", image], capture_output=True).returncode == 0:
        return image
    command(["podman", "tag", BASE, "localhost/gtm-v3-base:audited"])
    with tempfile.TemporaryDirectory(prefix="build-", dir=ROOT / "runtime/harness2") as folder:
        target = Path(folder)
        shutil.copytree(ROOT / "runtime/harness2/vendor", target / "upstream")
        shutil.copytree(ROOT / "harness/gtm", target / "gtm", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copytree(ROOT / "harness/fixtures", target / "fixtures")
        shutil.copyfile(ROOT / "harness/Containerfile", target / "Containerfile")
        command(["podman", "build", "--network=none", "--pull=never", "-t", image, str(target)])
    return image


def grade(output):
    """Public contract checks run after selection, outside candidate context."""
    fixtures = {v["id"]: v for v in json.loads((ROOT / "harness/fixtures/public.json").read_text())}
    checks = []
    for answer in sorted((output / "executions").rglob("handoff.json")):
        if answer.is_symlink() or answer.stat().st_size > 100000:
            raise ValueError("Unsafe worker deliverable")
        value = json.loads(answer.read_text())
        source = next((v for task, v in fixtures.items() if task in str(answer)), None)
        if source is None:
            raise ValueError("Unmapped worker deliverable")
        ok = all((value["tenant"] == source["tenant"], value["statement"] == source["statement"],
                  value["revision"] == source["revision"], value["limitations"] == source["limitations"],
                  value["sourceSha256"] == hashlib.sha256(source["statement"].encode()).hexdigest(),
                  value["label"] == "SYNTHETIC", value["publicationAuthorized"] is False,
                  value["platformVerified"] is False, value["humanReview"] == "REQUIRED",
                  value["hostedModelRequests"] == 0))
        checks.append({"path": str(answer.relative_to(output)), "pass": ok})
    if not checks or not all(v["pass"] for v in checks):
        raise ValueError("Source-preservation contract failed")
    return checks


def run(action, suite):
    pin, identity = source_identity()
    info = json.loads(command(["podman", "info", "--format", "json"]))
    if not info["host"]["security"]["rootless"]:
        raise ValueError("Rootless Podman is required")
    image = build(identity)
    output = Path(tempfile.mkdtemp(prefix=f"{action}-", dir=ROOT / "runtime/harness2"))
    start = time.monotonic()
    command(["podman", "run", "--rm", "--pull=never", "--network=none", "--read-only",
             "--cap-drop=ALL", "--security-opt=no-new-privileges", "--userns=keep-id",
             "--user", f"{os.getuid()}:{os.getgid()}", "--pids-limit=128", "--memory=1g", "--cpus=2",
             "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "--volume", f"{output}:/work/output:rw,Z",
             image, "--action", action, "--suite", suite])
    report = json.loads((output / "worker-report.json").read_text())
    checks = grade(output)
    receipt = {"schemaVersion": 1, "status": "PASS_CONTRACTS_ONLY", "label": "SYNTHETIC",
               "upstreamPin": pin["commit"], "upstreamModified": False, "image": image,
               "worker": report, "independentParentChecks": checks, "wallSeconds": time.monotonic()-start,
               "resourceLimits": {"memoryMiB": 1024, "cpus": 2, "pids": 128, "timeoutSeconds": 300},
               "mounts": ["Dedicated empty run output only"], "network": "NONE", "rootless": True,
               "hostCredentialsMounted": False, "paidModelRequests": 0, "costUsd": 0,
               "sealedHoldoutStatus": "NOT_RUN", "observedImprovement": None, "promotionAuthorized": False,
               "limitations": ["Deterministic source-preservation contracts only; no model or creative quality claim.",
                               "No sealed answers, private scoring rubrics or privileged memory entered the worker.",
                               "Actual memory and CPU consumption are not instrumented; limits and wall time are recorded."]}
    (output / "acceptance.json").write_text(json.dumps(receipt, indent=2)+"\n")
    return {"receipt": str((output / "acceptance.json").relative_to(ROOT)), **receipt}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("baseline", "evaluate", "propose"))
    parser.add_argument("--suite", choices=("all", "global", "gtm"), default="all")
    args = parser.parse_args()
    print(json.dumps(run(args.action, args.suite), indent=2))
