#!/usr/bin/env python3
"""Run local acceptance and write append-only milestone reports, including blockers."""
import datetime
import hashlib
import json
from pathlib import Path
import resource
import subprocess
import time

from project_inputs import project_inputs

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    directory = ROOT / "runtime/acceptance/v3" / stamp
    directory.mkdir(parents=True, exist_ok=False)
    start = time.monotonic()
    with (directory / "checks.log").open("w") as log:
        check = subprocess.run(["pnpm", "check"], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=300)
    check_status = "PASS" if check.returncode == 0 else "FAIL"
    preservation = json.loads((ROOT / "runtime/preservation/v3-before/receipt.json").read_text())
    historical = []
    for item in preservation["files"]:
        for copy in ("snapshot", "restore"):
            path = ROOT / "runtime/preservation/v3-before" / copy / item["path"]
            if not path.is_file() or sha(path) != item["sha256"]:
                raise ValueError("Preservation restoration mismatch")
        if item["path"].startswith("docs/evidence/"):
            path = ROOT / item["path"]
            if not path.is_file() or sha(path) != item["sha256"]:
                raise ValueError("Historical evidence changed")
            historical.append(item["path"])
    campaigns = json.loads(next((ROOT / "docs/evidence").glob("v3-campaigns-2026-10-19-*.json")).read_text())
    for campaign in campaigns["campaigns"]:
        path = ROOT / campaign["campaign"]
        # Campaign identifiers bind canonical JSON, while file hashes bind formatted bytes.
        canonical = json.dumps(json.loads(path.read_text()), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        if hashlib.sha256(canonical.encode()).hexdigest() != campaign["campaignSha256"]:
            raise ValueError("Campaign manifest changed")
        campaign["campaignFileSha256"] = sha(path)
        campaign["campaignHashMethod"] = "SORTED_COMPACT_UTF8_JSON"
    harness = {}
    for name in ("baseline", "evaluation"):
        source = ROOT / f"runtime/harness2/{name}.json"
        value = json.loads(source.read_text())
        receipt = ROOT / value["receipt"]
        if json.loads(receipt.read_text())["worker"] != value["worker"]:
            raise ValueError("Harness receipt differs")
        harness[name] = {"path": value["receipt"], "sha256": sha(receipt), "status": value["status"],
                         "tasks": value["worker"]["taskCount"], "externalModelRequests": value["worker"]["externalModelRequests"],
                         "negativeTests": value["worker"]["negativeTests"]}
    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    resources = {"wallSeconds": time.monotonic()-start, "childUserCpuSeconds": usage.ru_utime,
                 "childSystemCpuSeconds": usage.ru_stime, "childPeakRssKiB": usage.ru_maxrss,
                 "interpretation": "OS child usage, not exact cumulative container memory consumption"}
    common = {"schemaVersion": 1, "recordedAt": stamp, "checks": {"status": check_status, "exit": check.returncode,
              "log": str((directory / "checks.log").relative_to(ROOT)), "logSha256": sha(directory / "checks.log")},
              "costs": {"paidSocialApiCalls": 0, "offlineHostedModelRequests": 0, "offlineInferenceUsd": 0,
                        "approvedRouterConnectivityTokens": 27, "subscriptionCostUsd": None},
              "resourceConsumption": resources, "securityFindings": "See scoped Gitleaks/Semgrep summary in checks log; not a full dependency audit",
              "rollback": "docs/V3_OPERATIONS.md#validation-and-rollback", "approvalStatus": "OWNER_HOLD_FOR_PUBLICATION_AND_PROMOTION"}
    definitions = [
        ("P0", "PASS" if check_status == "PASS" else "FAIL", ["Audited source and SQLite preservation", "Byte-verified restoration", "Existing router authentication preserved"],
         ["No mandatory rotation or migration", "Provider connectivity validates availability, not quality or savings"], []),
        ("P1", "PASS_LOCAL_SCOPE" if check_status == "PASS" else "FAIL", ["Curated source/license audit", "Six installed-component offline replays", "Per-stage selection limits and structured handoffs"],
         ["Capability weights are declared targets; not a measured weighted ranking engine", "No live research connector claim from fixtures"], []),
        ("P2", "BLOCKED_OWNER_ACCEPTANCE", ["Phase E mock dispatch and attribution", "Two immutable owner-review manual publishing packets", "Append-only account/hash-bound state machine"],
         ["Owner reports remain owner attestations", "No live X or paid social connector"], ["Exact-hash owner editorial, creative and authenticity reviews", "Owner manual distribution"]),
        ("P3", "BLOCKED_OWNER_ACCEPTANCE", ["Five posts and two threads per tenant", "Protected-claim deterministic editing", "Editable covers and captioned 20-second portrait/landscape videos"],
         ["Prototype identity; no approved official brand tokens", "Human editorial quality and authentic founder voice remain unverified"], ["Human editorial/authenticity and creative approval"]),
        ("P5", "BLOCKED_OBSERVED_CYCLES", ["Replayable ten-stage cycles for both brands", "Separate engineering and business scorecards", "Atomic owner-export import and latest snapshot reports"],
         ["Synthetic cycle tests do not establish real campaign completion", "No verified acquisition, activation, retention or professional outcome yet"], ["Observed owner-approved weekly cycle for each brand", "Publication receipts and owned performance observations"]),
        ("P4", "PARTIAL_CONTRACT_TRACK", ["Pinned project-owned BenchmarkAdapter", "Actual BenchSpec, scheduler, proposer and substrate compatibility", "Rootless network-disabled worker and negative tests"],
         ["Public deterministic contracts only; no model, voice or business quality result", "No observed behavior improvement established"], ["Sealed holdout evaluation", "Independent improvement review and rollback validation"]),
        ("P6", "BLOCKED", ["Promotion disabled and acceptance gates visible"], ["No global instructions, skills, plugins or agents modified"],
         ["Observed cycle for each brand", "Sealed holdouts", "Security and rollback validation", "Independent review", "Exact owner promotion authorization"]),
    ]
    milestones = []
    for phase, status, capabilities, limitations, blockers in definitions:
        report = {**common, "milestone": phase, "status": status, "implementedCapabilities": capabilities,
                  "verifiedIntegrations": harness if phase == "P4" else {"localChecks": check_status},
                  "producedArtifacts": campaigns["campaigns"] if phase in ("P2", "P3", "P5") else [],
                  "knownLimitations": limitations, "outstandingBlockers": blockers}
        path = directory / f"{phase}.json"
        path.write_text(json.dumps(report, indent=2)+"\n")
        milestones.append({"milestone": phase, "status": status, "path": str(path.relative_to(ROOT)), "sha256": sha(path)})
    sources = [{"path": str(p.relative_to(ROOT)), "sha256": sha(p)} for p in project_inputs(ROOT)]
    index = {**common, "status": "BLOCKED_OWNER_AND_HOLDOUT_GATES" if check_status == "PASS" else "FAIL",
             "milestones": milestones, "preservationFilesVerified": len(preservation["files"]),
             "historicalEvidenceUnchanged": historical, "harness": harness, "sourceHashes": sources,
             "actualPublications": 0, "verifiedBusinessOutcomes": "UNAVAILABLE", "globalPromotionEnabled": False}
    path = ROOT / "docs/evidence" / f"v3-acceptance-{stamp}.json"
    path.write_text(json.dumps(index, indent=2)+"\n")
    print(json.dumps({"status": index["status"], "checks": check_status, "receipt": str(path.relative_to(ROOT)), "milestones": milestones}, indent=2))
    return 0 if check_status == "PASS" else 5


if __name__ == "__main__":
    raise SystemExit(main())
