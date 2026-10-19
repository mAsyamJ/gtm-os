# V3 operating guide

For complete instructions, field-by-field formats and troubleshooting, read the
[V3 user manual](V3_USER_MANUAL.md). Start hands-on with the
[two-brand synthetic tutorial](examples/V3_SYNTHETIC_WALKTHROUGH.md), then use the
[CLI reference](V3_CLI_REFERENCE.md) for exact command options.

V3 adds source-reviewed local campaigns, manual publication records and owner-export
measurement. Existing A–E evidence remains historical. Runtime files are local and ignored
by Git; retain them with the acceptance receipts when moving this workspace.

The final owner amendments take precedence over the original master and roadmap. In
particular, existing authorized credentials are reused through protected routing. Rotation
is not a prerequisite. No router default, account configuration or global skill was changed.
Execution order is P0–P3, operational P5, then the separate P4 track. P6 is disabled.

## Prepare and inspect a campaign

```bash
pnpm build
./gtm evidence ingest --brand founder --file research/inbox/founder/SOURCE.json --json
./gtm evidence review --brand founder --file research/inbox/founder/REVIEW.json --json
./gtm content pack --brand founder --source-card SOURCE_ID --json
./gtm cycle run --brand founder --idempotency-key founder-WEEK --offline --json
./gtm distribution status --brand founder --json
./gtm analytics weekly --brand founder --offline --json
```

Use `retropick` and a separately reviewed RetroPick source for that tenant. Every tenant
operation requires `--brand`. Catalog/audit and synthetic cross-tenant benchmark inspection
are administrative exceptions. Cycle keys must start with the selected tenant.

Sources enter as `RETRIEVED_UNVERIFIED`. A source reviewer may classify documentary text
as `REVIEWED_SOURCE`; only an explicit owner record may attest personal experience as
`OWNER_ATTESTED`. Neither is platform or product verification. Uploaded exports cannot
self-assign `PLATFORM_VERIFIED` or `PRODUCT_VERIFIED`. Those classes are reserved for
future independently verified adapters. `SYNTHETIC` fixtures live in a different database.

Each source records its URI, exact revision, observed/expiry timestamps, text hash, license
and exact supported statement segments. Reviews bind the source record hash and permitted
claims. Expired or changed evidence blocks new drafting and publication. Historical metrics
validate freshness at the recorded publication time; they do not renew publication authority.

Humanization currently uses conservative local edits with exact protected claim blocks.
Numbers, entities, negations, conditions, citations and risk language must survive. Semantic
quality, voice and first-person authenticity require human review. Founder documentary
examples do not establish the owner's personal engineering experience.

## Manual owner handoff

The immutable packet includes `post.txt`, `thread.md`, `alt.txt`, `sources.md`, `preview.html`,
editable images, video, captions and instructions. Styling remains a prototype until the
owner approves the actual brand identity. Videos are silent by design; no fabricated product
capture, activity or personal history is shown.

Read the package's account and payload hash. The expected accounts are `@iHateModelsss`
for founder and `@RetroPickMarket` for RetroPick. A local owner decision file has this shape:

```json
{
  "tenant": "founder",
  "packetId": "COPY_EXACT_PACKET_ID",
  "payloadSha256": "COPY_EXACT_64_CHARACTER_HASH",
  "account": "iHateModelsss",
  "actor": "owner",
  "at": "CURRENT_ISO_TIMESTAMP",
  "event": "APPROVE_MANUAL",
  "editorialReviewed": true,
  "creativeReviewed": true,
  "authenticityReviewed": true,
  "expiresAt": "CURRENT_PLUS_AT_MOST_SEVEN_DAYS"
}
```

This is an inert shape example, not an approval. Import actual owner decisions from
`distribution/inbox/<tenant>/` using `distribution decision import --brand ... --file ...`.
The state sequence is:

`AWAITING_OWNER_APPROVAL → APPROVED_FOR_MANUAL → HANDED_OFF → OWNER_REPORTED_PUBLISHED`.

Separate events record rejection, invalidation, owner-reported scheduling and unknown
publication. Handoff and publication reporting require current approval. Publication requires
an exact-account native X post URL. All decisions bind the exact content, evidence, media
and immutable payload hash. Changed bytes block approval. Invalidation remains available
after evidence expires or media changes. This local actor field is an owner-supplied
attestation, not cryptographic identity or platform verification; protect the local workspace.

The owner signs in and distributes through the native platform. The software never posts,
schedules, replies, messages or buys ads. A successful local import is not an external action.

## Measurement and weekly recovery

Import an array of metric records or RFC4180 CSV through:

```bash
./gtm metrics import --brand founder --from growth/inbox/founder/METRICS.csv --json
./gtm cycle resume --brand founder --idempotency-key founder-WEEK --offline --json
./gtm analytics weekly --brand founder --offline --json
```

Each metric needs tenant, packetId, observedAt, metric, value, denominator, windowStart,
windowEnd, origin `OWNER_EXPORT`, definition, sourceSha256, outcomeVerification
`OWNER_ATTESTED`, and semantics `CUMULATIVE_SNAPSHOT`. Values/denominators may be null;
CSV empty cells or `UNAVAILABLE` mean null. Upload the export hash as provenance; the
software cannot independently establish the platform authenticity of an uploaded file.
Duplicate identities are idempotent; conflicting snapshots roll back the entire batch.
Snapshots for the same post/metric/window replace older observations in reports rather
than being summed. Reports use a half-open UTC interval ending at today's midnight.

Engineering checkpoint counts are separate from business observations. Founder measures
qualified engagement, relationships, collaboration, technical credibility and professional
opportunities. RetroPick measures qualified acquisition, activation and retention. Owner
observations and impression counts are not verified conversions; missing values stay
`UNAVAILABLE`. CTR remains unavailable until matching source/window evidence is implemented.
No causal attribution or growth claim is inferred from these samples.

Cycle checkpoints retain source/review hashes and structured stage handoffs. Re-running an
unchanged paused cycle does not render again. Changed source inputs require a new cycle
key. The latest publication state controls completion; invalidation removes eligibility.
Synthetic completion never qualifies an observed weekly cycle for improvement promotion.

## Isolated Harness² track

```bash
./gtm harness baseline --suite all --offline --json
./gtm harness evaluate --suite all --offline --json
./gtm harness propose --suite gtm --target project:guardrails --offline --json
./gtm harness promotions status --json
```

The project Python `GtmAdapter` implements the actual pinned `BenchmarkAdapter` protocol.
The custom runner uses `BenchSpec`, `SurfaceSpec`, `Proposer` and the upstream scheduler.
There is no assumed upstream `--bench gtm`. The pinned prompt renderer requires the
`opencode` profile name; the project executor remains deterministic and never invokes the
OpenCode CLI or a hosted provider. The upstream sources are unchanged and hash checked.

Public suites contain 12 general contract fixtures and 16 GTM contract fixtures. Their
hashes are frozen in `config/v3-harness-pin.json`. Stable deterministic proposals change only
isolated `guardrails.md`; no behavior improvement is claimed. Parent checks run after
selection. No sealed grading answers, private rubrics or privileged improvement memory
enter the worker. Sealed holdout evaluation is not implemented and remains a promotion gate.

The rootless Podman worker has no network, a read-only root filesystem, no capabilities,
no privilege escalation, a non-root user and bounded memory/CPU/PIDs/time. Its only host
mount is a dedicated run output directory. There are no credentials, Docker sockets,
global homes or production source mounts. Negative tests verify these boundaries.
Upstream `.env` loading happens only inside this credential-free image, never on the host.
Model-backed evaluations are blocked until separate explicit router budget admission exists.

Contract results do not measure editorial quality, authentic voice, model capability or
campaign effectiveness. P6 requires an observed weekly cycle for each brand, baseline,
sealed holdouts, security, rollback, independent review and exact owner authorization.
Both global and project promotion remain disabled.

## Validation and rollback

Run `pnpm check` for policy, runtime, tenant separation, offline adapter and security tests.
Run `python3 scripts/verify_v3.py` for an append-only milestone acceptance receipt. Older
phase verifiers are not rerun because they would overwrite historical receipts.

Before rollback, stop all local workers and preserve current observations and acceptance
receipts. The baseline is commit `1840d49`; the pre-V3 audited source and SQLite backups
are in `runtime/preservation/v3-before/snapshot/`, with a byte-verified restored copy and
manifest. Restore to a separate checkout and validate there; do not reset the active dirty
repository or overwrite current history. Restore SQLite backups only while their stores
are closed. V3 uses separate observed databases and content-addressed artifact directories.
No provider/router/global configuration rollback is needed because none was migrated.
Delete only a specifically identified disposable worker/output after retaining its receipt;
do not remove historical runtime artifacts or the preservation snapshot.
