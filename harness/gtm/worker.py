"""Container entry point; upstream imports occur only after environment isolation."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import time

attempts = []
original_connect = socket.socket.connect


def deny_network(*args, **kwargs):
    attempts.append("DENIED")
    raise PermissionError("Offline worker prohibits external requests")


socket.create_connection = deny_network
socket.socket.connect = deny_network
socket.getaddrinfo = deny_network
sys.path[:0] = ["/opt/upstream", "/opt/gtm"]

from adapter import GtmAdapter, OfflineProposer  # noqa: E402
from harness2.core.spec import BenchmarkAdapter, SubstrateLike  # noqa: E402
from harness2.core.schedule import run_domain  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", choices=("baseline", "evaluate", "propose"), required=True)
    parser.add_argument("--suite", choices=("all", "global", "gtm"), default="all")
    args = parser.parse_args()
    start = time.monotonic()
    adapter = GtmAdapter(Path("/work/output"), Path("/opt/fixtures/public.json"))
    assert isinstance(adapter, BenchmarkAdapter) and isinstance(adapter.substrate, SubstrateLike)
    assert os.getuid() != 0
    assert not any(Path(p).exists() for p in ("/home/ubuntu/.codex", "/var/run/docker.sock", "/opt/sealed"))
    negative = {}
    probe = socket.socket()
    probe.settimeout(1)
    try:
        original_connect(probe, ("198.51.100.1", 443))
        negative["kernelNetworkDenied"] = False
    except OSError:
        negative["kernelNetworkDenied"] = True
    finally:
        probe.close()
    try:
        Path("/opt/escape-test").write_text("must fail")
        negative["rootFilesystemWriteDenied"] = False
    except OSError:
        negative["rootFilesystemWriteDenied"] = True
    for key, harness in (("scriptInjectionDenied", {"scripts/escape.py": "raise SystemExit"}),
                         ("boundaryRemovalDenied", {"guardrails.md": "Publish immediately"})):
        try:
            adapter.validate_tree(harness)
            negative[key] = False
        except ValueError:
            negative[key] = True
    negative["credentialEnvironmentAbsent"] = not any("API_KEY" in k or "TOKEN" in k or "SECRET" in k for k in os.environ)
    assert all(negative.values())
    tasks = adapter.tasks(args.suite)
    for task in tasks:
        first = adapter.execute(task, None, f"baseline-{task}")
        assert adapter.execute(task, None, f"baseline-{task}") == first
    result = None
    prop = OfflineProposer(adapter.spec.channels["proposer"])
    if args.action != "baseline":
        result = run_domain("gtm", tasks, 1, adapter=adapter, prop=prop,
                            runs_root=adapter.spec.runs_root, library_root=adapter.root / "library",
                            modes=("seq",), seed=1)
        if result["failed"]:
            raise RuntimeError("Pinned scheduler reported failed tasks")
    report = {"label": "SYNTHETIC", "scope": "SOURCE_PRESERVATION_CONTRACTS_ONLY",
              "action": args.action, "taskCount": len(tasks), "upstreamPin": "1cfe254e8d25b15f37048c3730134686abe60335",
              "fixtureSha256": hashlib.sha256(Path("/opt/fixtures/public.json").read_bytes()).hexdigest(),
              "protocolCompatible": True, "uid": os.getuid(), "externalModelRequests": 0,
              "attemptedNetworkRequests": len(attempts), "executionCount": adapter.execution_count,
              "proposerCalls": len(prop._calls), "scheduler": result, "wallSeconds": time.monotonic()-start,
              "negativeTests": negative,
              "costUsd": 0, "subjectiveQuality": None, "businessImpact": None, "promotionAuthorized": False}
    if attempts:
        raise RuntimeError("Offline worker attempted network access")
    (adapter.root / "worker-report.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
