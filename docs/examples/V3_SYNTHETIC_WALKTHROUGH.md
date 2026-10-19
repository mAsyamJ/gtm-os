# Worked example: complete both brand cycles locally

This is a runnable learning exercise for **synthetic data only**. It creates a new directory
under the project's ignored `runtime/docs-demos/`, copies the minimum local governance/media
inputs and uses separate SQLite stores there. It does not alter the existing real campaign
records, contact a website, authenticate an account, call a model or publish anything.

Run it from the built project root in Bash. It requires Python 3, the existing Node
dependencies, FFmpeg/ffprobe and the checked-in licensed fonts. It renders real local
prototype media for each tenant, so allow time and disk space for two sets of videos.
If those prerequisites are unavailable, stop at the reported failure rather than substituting
fake media or disabling QA.

The approval flags, status URL and metric values below are deliberately synthetic fixtures.
They must never be copied into an observed campaign as actual owner actions or performance.
Every tenant operation includes `--synthetic`.

## Run the complete example

Paste this whole block into Bash from the repository root. It uses a subshell so its strict
error handling does not change your interactive shell settings. Each run creates a new demo
directory; it does not overwrite a previous example.

```bash
(
set -euo pipefail
gtm_project_root="$(pwd -P)"
test -f "$gtm_project_root/package.json"
test -f "$gtm_project_root/AGENTS.md"
pnpm build

# Copy reviewed local inputs only; no runtime state, credentials or global homes.
gtm_demo_root="$(python3 - "$gtm_project_root" <<'PY'
from pathlib import Path
import shutil
import sys
import tempfile

project = Path(sys.argv[1])
parent = project / "runtime/docs-demos"
parent.mkdir(parents=True, exist_ok=True)
demo = Path(tempfile.mkdtemp(prefix="v3-", dir=parent))

def exclude(directory, names):
    return [name for name in names
            if (Path(directory) / name).is_symlink()
            or name.startswith((".env", "credentials", "secrets", "cookies", "session", "auth."))
            or name in {".git", "node_modules", "__pycache__", "runtime"}]

for folder in ("config", "brands", "workflows", "agents", ".agents", "campaigns",
               "creative", "packages/creative", "packages/v3", "distribution", "growth"):
    shutil.copytree(project / folder, demo / folder, ignore=exclude)
for name in ("AGENTS.md", "package.json", "pnpm-lock.yaml"):
    shutil.copyfile(project / name, demo / name)
print(demo)
PY
)"

gtm_demo() {
  "$gtm_project_root/gtm" --root "$gtm_demo_root" "$@"
}

for gtm_brand in founder retropick; do
  # Create fresh, visibly synthetic source bytes and dates.
  python3 - "$gtm_demo_root" "$gtm_brand" <<'PY'
import datetime as dt
import hashlib
import json
from pathlib import Path
import sys

root, tenant = Path(sys.argv[1]), sys.argv[2]
now = dt.datetime.now(dt.timezone.utc)
iso = lambda value: value.isoformat(timespec="milliseconds").replace("+00:00", "Z")
statement = ("This synthetic engineering example does not establish a personal achievement."
             if tenant == "founder" else
             "This synthetic product example does not establish live adoption or trading outcomes.")
source = {
    "id": f"{tenant}-docs-source", "tenant": tenant,
    "title": f"Synthetic {tenant} documentation exercise",
    "uri": f"https://example.org/gtm-docs/{tenant}",
    "revision": "synthetic-docs-v1",
    "observedAt": iso(now - dt.timedelta(days=3)),
    "expiresAt": iso(now + dt.timedelta(days=7)),
    "text": statement,
    "contentSha256": hashlib.sha256(statement.encode("utf-8")).hexdigest(),
    "license": "SYNTHETIC_TUTORIAL_TEXT_ONLY", "statements": [statement]
}
inbox = root / "research/inbox" / tenant
inbox.mkdir(parents=True, exist_ok=True)
(inbox / "source.json").write_text(json.dumps(source, indent=2) + "\n")
PY

  gtm_demo evidence ingest --brand "$gtm_brand" --synthetic \
    --file "research/inbox/$gtm_brand/source.json" --json \
    > "$gtm_demo_root/research/inbox/$gtm_brand/ingested.json"

  # Bind the exact ingestion record hash, not just the source text hash.
  python3 - "$gtm_demo_root" "$gtm_brand" <<'PY'
import json
from pathlib import Path
import sys

root, tenant = Path(sys.argv[1]), sys.argv[2]
inbox = root / "research/inbox" / tenant
source = json.loads((inbox / "source.json").read_text())
ingested = json.loads((inbox / "ingested.json").read_text())["data"]
review = {"evidenceId": ingested["id"], "evidenceSha256": ingested["sha256"],
          "classification": "REVIEWED_SOURCE", "actor": "source-reviewer",
          "permittedClaims": source["statements"], "authenticFirstPerson": False}
(inbox / "review.json").write_text(json.dumps(review, indent=2) + "\n")
PY

  gtm_demo evidence review --brand "$gtm_brand" --synthetic \
    --file "research/inbox/$gtm_brand/review.json" --json \
    > "$gtm_demo_root/runtime/$gtm_brand-review-result.json"

  # Build the seven-item writing batch and one complete creative/manual cycle packet.
  gtm_demo content pack --brand "$gtm_brand" --synthetic \
    --source-card "$gtm_brand-docs-source" --json \
    > "$gtm_demo_root/runtime/$gtm_brand-content-batch.json"
  gtm_demo cycle run --brand "$gtm_brand" --synthetic --offline \
    --idempotency-key "$gtm_brand-docs-week" --json \
    > "$gtm_demo_root/runtime/$gtm_brand-cycle-waiting.json"

  # Prepare fixture decisions and metric files. No actual owner action is asserted.
  python3 - "$gtm_demo_root" "$gtm_brand" <<'PY'
import csv
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import sys

root, tenant = Path(sys.argv[1]), sys.argv[2]
now = dt.datetime.now(dt.timezone.utc)
iso = lambda value: value.isoformat(timespec="milliseconds").replace("+00:00", "Z")
cycle = json.loads((root / f"runtime/{tenant}-cycle-waiting.json").read_text())["data"]
assert cycle["state"] == "AWAITING_APPROVAL", cycle
assert cycle["realCycleCompleted"] is False
packets = list((root / f"runtime/v3/{tenant}/manual-publish").glob("*/publishing-package.json"))
packet = next(json.loads(path.read_text()) for path in packets
              if json.loads(path.read_text())["id"] == cycle["packetId"])
assert packet["label"] == "SYNTHETIC" and packet["creativeReady"] is True
base = {"tenant": tenant, "packetId": packet["id"], "payloadSha256": packet["payloadSha256"],
        "account": packet["account"], "actor": "owner"}
inbox = root / "distribution/inbox" / tenant
inbox.mkdir(parents=True, exist_ok=True)
for event, offset, extras in (
    ("APPROVE_MANUAL", 0, {"editorialReviewed": True, "creativeReviewed": True,
                          "authenticityReviewed": True, "expiresAt": iso(now + dt.timedelta(days=1))}),
    ("HANDOFF", 1, {}),
    ("OWNER_REPORTED_PUBLISHED", 2, {"postUrl": f"https://x.com/{packet['account']}/status/0"}),
):
    value = {**base, "event": event,
             "at": iso(now - dt.timedelta(days=2) + dt.timedelta(seconds=offset)), **extras}
    (inbox / f"{event}.json").write_text(json.dumps(value, indent=2) + "\n")

# The digest binds this synthetic export payload, not an actual platform export.
export = {"fixture": "SYNTHETIC_DOCS_ONLY", "impressions": 40, "qualified": 2}
export_bytes = (json.dumps(export, sort_keys=True) + "\n").encode()
metrics_inbox = root / "growth/inbox" / tenant
metrics_inbox.mkdir(parents=True, exist_ok=True)
(metrics_inbox / "synthetic-export.txt").write_bytes(export_bytes)
common = {"tenant": tenant, "packetId": packet["id"],
          "observedAt": iso(now - dt.timedelta(days=1)),
          "denominator": None,
          "windowStart": iso(now - dt.timedelta(days=2)),
          "windowEnd": iso(now - dt.timedelta(days=1, hours=12)),
          "origin": "OWNER_EXPORT", "definition": "Synthetic documentation observations; no real business outcome",
          "sourceSha256": hashlib.sha256(export_bytes).hexdigest(),
          "outcomeVerification": "OWNER_ATTESTED", "semantics": "CUMULATIVE_SNAPSHOT"}
metrics = [{**common, "metric": "impressions", "value": 40},
           {**common, "metric": "qualified_engagements" if tenant == "founder" else "qualified_acquisition", "value": 2}]
(metrics_inbox / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
with (metrics_inbox / "metrics.csv").open("w", newline="") as stream:
    writer = csv.DictWriter(stream, fieldnames=list(metrics[0]))
    writer.writeheader()
    writer.writerows(metrics)
print(f"{tenant}: synthetic packet {packet['id']} ready; no actual publication")
PY

  for gtm_event in APPROVE_MANUAL HANDOFF OWNER_REPORTED_PUBLISHED; do
    gtm_demo distribution decision import --brand "$gtm_brand" --synthetic \
      --file "distribution/inbox/$gtm_brand/$gtm_event.json" --json \
      > "$gtm_demo_root/runtime/$gtm_brand-$gtm_event-result.json"
  done

  gtm_demo metrics import --brand "$gtm_brand" --synthetic \
    --from "growth/inbox/$gtm_brand/metrics.csv" --json \
    > "$gtm_demo_root/runtime/$gtm_brand-metrics-result.json"
  # Importing the equivalent JSON produces duplicates, not extra observations.
  gtm_demo metrics import --brand "$gtm_brand" --synthetic \
    --from "growth/inbox/$gtm_brand/metrics.json" --json \
    > "$gtm_demo_root/runtime/$gtm_brand-metrics-duplicate.json"
  gtm_demo cycle resume --brand "$gtm_brand" --synthetic --offline \
    --idempotency-key "$gtm_brand-docs-week" --json \
    > "$gtm_demo_root/runtime/$gtm_brand-cycle-complete.json"
  gtm_demo analytics weekly --brand "$gtm_brand" --synthetic --days 7 --offline --json \
    > "$gtm_demo_root/runtime/$gtm_brand-weekly-report.json"
  gtm_demo analytics weekly --brand "$gtm_brand" --days 7 --offline --json \
    > "$gtm_demo_root/runtime/$gtm_brand-observed-report.json"
done

gtm_demo harness promotions status --json > "$gtm_demo_root/runtime/promotions.json"

# Verify the expected learning outcome and physical dataset separation.
python3 - "$gtm_demo_root" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
def result(name):
    return json.loads((root / "runtime" / name).read_text())["data"]
for tenant in ("founder", "retropick"):
    batch = result(f"{tenant}-content-batch.json")
    cycle = result(f"{tenant}-cycle-complete.json")
    report = result(f"{tenant}-weekly-report.json")
    observed = result(f"{tenant}-observed-report.json")
    assert len(batch["posts"]) == 5 and len(batch["threads"]) == 2
    assert cycle["state"] == "RETROSPECTIVE_COMPLETED"
    assert cycle["label"] == "SYNTHETIC" and cycle["realCycleCompleted"] is False
    assert len(cycle["handoffs"]) == 10
    assert result(f"{tenant}-metrics-duplicate.json")["duplicates"] == 2
    assert report["engineering"]["completedCycles"] == 1
    assert len(report["business"]["metrics"]) == 2
    assert report["business"]["verifiedConversions"] is None
    assert observed["business"]["status"] == "NO_DATA"
    assert not (root / f"runtime/state/{tenant}/observations.sqlite").exists()
    print(f"{tenant}: ten synthetic stages completed; observed outcomes remain unavailable")
promotion = result("promotions.json")
assert promotion["projectPromotionEnabled"] is False
assert promotion["globalPromotionEnabled"] is False
assert all(v["completed"] == 0 for v in promotion["eligibleObservedCycles"])
print(f"Demo retained at: {root}")
print("No network/model calls, actual publication or promotion performed.")
PY
)
```

## Inspect the result

The final output prints the retained demo directory. In that directory:

- `runtime/founder-content-batch.json` and `runtime/retropick-content-batch.json` contain the
  five posts and two threads per tenant.
- `runtime/v3/<tenant>/manual-publish/<hash>/` contains the packet and copied media.
- `runtime/<tenant>-weekly-report.json` contains two synthetic metric rows and a completed
  synthetic engineering cycle. Forty impressions and two qualified observations are fixture
  numbers, not results achieved by either brand.
- `runtime/<tenant>-observed-report.json` still reports `NO_DATA`.
- `runtime/promotions.json` keeps both promotion flags false and observed-cycle counts zero.

Some workflow stage/state field names contain `OWNER_ATTESTED` because the same state
machine is being exercised. The selected dataset, stored record labels and
`realCycleCompleted: false` keep this entire exercise synthetic.

## Repeat or adapt the example

Re-run the whole block for a new independent demo workspace. To inspect a retained workspace,
run the built project's executable with that printed directory as `--root`, the correct
`--brand` and `--synthetic`. To practise invalidation, create a **new synthetic** `INVALIDATE`
decision with the packet's exact account/hash and a later event timestamp, import it, then
resume the same synthetic cycle. It should return to `AWAITING_APPROVAL` rather than retain
completion eligibility.

For a real campaign, follow the [user manual](../V3_USER_MANUAL.md). Do not turn this into
an observed campaign by removing `--synthetic`: replace every fixture source, attestation,
publication URL, timestamp, export and observation with genuine authorized evidence first.
