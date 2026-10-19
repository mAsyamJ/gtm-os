# GTM OS V3 user manual

This guide explains the current local application, including its working commands and its
limits. Start with the isolated tutorial before entering owner approvals or real observations.
The application prepares and records work. Publishing still happens manually in the native
platform, after the owner reviews the exact package.

## Contents

1. [Choose a starting point](#1-choose-a-starting-point)
2. [Prepare the environment](#2-prepare-the-environment)
3. [Understand tenants, datasets and results](#3-understand-tenants-datasets-and-results)
4. [Research and review evidence](#4-research-and-review-evidence)
5. [Prepare content and creative](#5-prepare-content-and-creative)
6. [Run a weekly campaign](#6-run-a-weekly-campaign)
7. [Approve and distribute manually](#7-approve-and-distribute-manually)
8. [Import measurements and read reports](#8-import-measurements-and-read-reports)
9. [Use specialists and the workflow catalog](#9-use-specialists-and-the-workflow-catalog)
10. [Use the isolated improvement track](#10-use-the-isolated-improvement-track)
11. [Operate, verify and recover](#11-operate-verify-and-recover)
12. [Troubleshoot](#12-troubleshoot)
13. [Understand the current limits](#13-understand-the-current-limits)

Related guides:

- [Runnable two-brand synthetic tutorial](examples/V3_SYNTHETIC_WALKTHROUGH.md).
- [CLI command reference](V3_CLI_REFERENCE.md).
- [Short operating guide and rollback](V3_OPERATIONS.md).
- [Milestone acceptance status](V3_ACCEPTANCE.md).
- [Legacy Phase C source/planning format](PHASE_C.md) and [Phase D media](PHASE_D.md).

## 1. Choose a starting point

| You want to… | Start here |
| --- | --- |
| Learn the complete process safely | Run the synthetic tutorial in its separate workspace |
| Inspect the packages already generated | Use `distribution status` for each tenant, then open the packet directory |
| Create a new real campaign | Review current sources, ingest/review evidence, then run a V3 cycle |
| Practise dispatch failures or attribution | Use the explicitly synthetic Phase E commands in the CLI reference |
| Evaluate the adapter infrastructure | Use the offline Harness² contract suites |
| Check acceptance | Run local checks and inspect the milestone reports; a blocked milestone remains blocked |

The tenant/account mapping is fixed:

| Tenant argument | Brand | Expected account in a decision file |
| --- | --- | --- |
| `founder` | Asyam Jayanegara founder brand | `iHateModelsss` |
| `retropick` | RetroPick | `RetroPickMarket` |

Account strings inside JSON omit `@`. Never reuse a source review, content approval or
publication receipt across tenants.

### Inspect existing work without changing it

From the repository root:

```bash
./gtm distribution status --brand founder --json
./gtm distribution status --brand retropick --json
./gtm cycle status --brand founder --json
./gtm cycle status --brand retropick --json
./gtm analytics weekly --brand founder --offline --json
./gtm analytics weekly --brand retropick --offline --json
```

`distribution status` returns packet records and publication history. Open each packet's
`directory/publishing-package.json` and `directory/preview.html`. Read `sources.md` and
`instructions.md`; inspect the images and both videos before deciding whether to approve.
The package JSON records its initial state; current decisions live in publication history.
Do not edit the JSON to change status.

The initial October 19, 2026 packages are indexed in
[the campaign manifest](evidence/v3-campaigns-2026-10-19-14585cf69a72.json). Their sources
have bounded validity windows. Those historical examples are not permanently current.

## 2. Prepare the environment

Use the existing repository and installed toolchain. The checked-in `package.json` currently
requires Node `>=24.11.0 <25` and pnpm `12.4.2`; check it again when upgrading.

```bash
cd /home/ubuntu/project/gtm/gtm-os
node --version
pnpm --version
python3 --version
pnpm build
./gtm --help
```

If dependencies are missing, the project's established installation command is:

```bash
pnpm install --frozen-lockfile --ignore-scripts --store-dir runtime/pnpm-store
pnpm build
```

Installation may use the package registry. It is separate from offline workflow execution.
Keep the existing lockfile and do not enable lifecycle scripts as a workaround.

| Task | Additional prerequisites |
| --- | --- |
| Evidence, content, reports and local state | Installed project Node dependencies |
| Creative/video rendering | Existing `/usr/bin/ffmpeg`, `ffprobe`, licensed fonts under `creative/assets/`, Sharp and Satori |
| Installed-component research replay | Existing Agent Reach Python environment/feedparser, pinned Last30Days date component, existing Scrapling environment |
| Capability discovery and approved public fetch | Existing `/home/ubuntu/.local/bin/agentctl` and audited global control-plane installation |
| Offline Harness² | Rootless Podman, existing audited base image and matching pinned upstream source under `runtime/harness2/vendor/` |
| Governance/security checks | Existing Python validation dependencies, Gitleaks and Semgrep |

These global component locations belong to this configured host. A fresh checkout on a new
machine does not automatically include them or the ignored runtime data. Missing components
must report unavailable; do not substitute credentials, install unreviewed tools or claim a
live integration from an installed source snapshot.

### Authentication and costs

Ordinary local V3 commands do not need you to paste an API key into the project. Keep existing
Codex/Zodex and Z.ai/GLM authentication in their protected configuration. Do not create a
project `.env` containing credentials, copy global homes into workers or enable disabled
provider routes. Credential rotation is not an implementation prerequisite.

```bash
./gtm capabilities doctor --json
./gtm integrations costs --json
./gtm costs report --json
```

These commands describe configured/local scope. `costs report` reads legacy project cost
entries; it is not a complete bill for your interactive coding session, subscription or V3
rendering CPU time. Unknown costs remain unknown. There is no supported V3 CLI command
that enables model-backed Harness² or automatic paid publishing.

## 3. Understand tenants, datasets and results

### Command conventions

All examples run from the repository root. `./gtm` uses the compiled `dist/` files, so rebuild
after implementation changes. `pnpm gtm ...` is an alternative invocation. `--help` currently
prints the general command help even when supplied after a subcommand.

Use `--json` for automation. A typical response is:

```json
{"status":"LOCAL_RESULT","data":{"tenant":"founder","dataset":"OBSERVED"}}
```

This is an abbreviated shape. Read the nested `data.state`, `data.blocker`, `data.status` or
milestone reports. `LOCAL_RESULT` and exit code zero mean a local command returned a result;
they do not mean the campaign is approved, published or accepted. For example, a cycle may
return exit zero with `data.state: "BLOCKED"` and `data.blocker: "EVIDENCE_GAP"`.

`--root PATH` selects a separate workspace's configuration, state and artifacts. It does not
copy the repository, install dependencies or provide a new security sandbox. Continue using
the executable from the built project. Harness² and verification scripts additionally depend
on files/runtime sources associated with their script location; use those administrative
commands from the real configured project, not a minimal tutorial clone.

### Keep dataset selection consistent

| Selection | Meaning | Operations store |
| --- | --- | --- |
| Default, or `--dataset OBSERVED` | Actual supplied documentary/owner observations, with their evidence classification | `runtime/state/<tenant>/observations.sqlite` |
| `--synthetic`, or `--dataset SYNTHETIC` | Training/replay fixtures, never real campaign evidence | `runtime/state/<tenant>/operations.sqlite` |
| Legacy workflows | Older synthetic engine and source cards | `runtime/state/<tenant>/gtm.sqlite` |

`OBSERVED` does not mean independently verified. An owner-supplied metric in that database
still has owner-attested provenance. Use the same dataset for evidence, review, content,
creative, packet, decision, metrics and cycle commands. If you omit `--synthetic` halfway
through a tutorial, the record will appear missing in the other physical database.

### Evidence classes

| Class | What it establishes | Current entry path |
| --- | --- | --- |
| `SYNTHETIC` | An illustrative fixture | Explicit synthetic commands |
| `RETRIEVED_UNVERIFIED` | Source bytes were supplied/retrieved, with no permitted claim yet | V3 evidence ingestion or permitted public fetch |
| `REVIEWED_SOURCE` | A local reviewer approved exact documentary statements | Evidence review by owner or source reviewer |
| `OWNER_ATTESTED` | The owner supplied an attestation | Owner evidence review, publication decisions and metric uploads |
| `PLATFORM_VERIFIED` | Independent platform proof | Reserved; upload files cannot assign it |
| `PRODUCT_VERIFIED` | Independent product/instrumentation proof | Reserved; upload files cannot assign it |

The last two classes exist in the schema but currently have no live verification adapter.
An owner report never automatically upgrades to either class.

## 4. Research and review evidence

### Decide what you actually know

For RetroPick, prefer a current first-party repository/product revision and explicitly state
test environment, audit status and feature limits. For the founder brand, distinguish cited
technical documentation from the owner's personal experience. A repository description is
not proof of adoption, revenue or a personal achievement.

Research commands:

```bash
./gtm evidence list --brand founder --json
./gtm research trends --brand founder --days 30 --offline --json
./gtm research replay --brand founder --offline --json
./gtm voice profile --brand founder --json
```

`research trends` summarizes local reviewed statements; it does not search the web. `--days`
accepts 1–90 and marks whether cards fall in that window. Current reviewed themes are not
necessarily filtered to only that window. Opposing views remain unestablished when the
source set does not support them. `research replay` runs three deterministic installed
components and stays synthetic regardless of the current campaign's dataset.

### Optional approved public read

```bash
./gtm research fetch --brand founder \
  --url https://api.github.com/users/mAsyamJ \
  --network approved-read --json
```

This requests a public keyless read through the existing audited transport. It does not
authenticate a social account or automatically create a reviewed evidence record. The
current allowlist is `raw.githubusercontent.com`, `api.github.com` and `hn.algolia.com`.
HTTPS URLs must not include credentials, an explicit port, query string or fragment.
Use immutable repository revisions when importing claims. Endpoint availability and rate
limits can still block a read. No external read is required by the synthetic tutorial.

### Evidence input format

Save a JSON object at `research/inbox/<tenant>/NAME.json`. The filename may contain letters,
numbers, dots, underscores and hyphens. Use a workspace-relative path, not `/tmp/source.json`.

| Field | Type and rule |
| --- | --- |
| `id` | Tenant-prefixed ID, for example `founder-source-unique-revision` |
| `tenant` | Exactly `founder` or `retropick`, matching `--brand` |
| `title` | 1–240 characters |
| `uri` | Public HTTPS provenance without embedded credentials, query or fragment |
| `revision` | Exact commit/document revision or content identity, 1–160 characters |
| `observedAt` | ISO timestamp, not in the future |
| `expiresAt` | Future ISO timestamp, after observedAt; validity span at most 90 days |
| `text` | Exact authorized source excerpt, 1–100,000 characters |
| `contentSha256` | Lowercase SHA256 of the UTF-8 `text`, including its exact whitespace |
| `license` | Explicit rights/license statement, 1–200 characters |
| `statements` | 1–30 exact substrings of `text`, each at most 1,500 characters |

The input is strict: do not add status, review or verification fields. Protect proprietary
or personal data before supplying an excerpt. The runnable tutorial generates a valid file
and fresh dates automatically; it is the complete copyable JSON-generation example.

```bash
./gtm evidence ingest --brand founder \
  --file research/inbox/founder/SOURCE.json --json
```

Capture `data.id` and **`data.sha256`**. The latter hashes the ingested source record and
is the review binding. It differs from `contentSha256`, which hashes only the source text.

### Review input format

After a human has checked the source, save this shape in the same tenant's research inbox:

```json
{
  "evidenceId": "founder-source-unique-revision",
  "evidenceSha256": "REPLACE_WITH_DATA_SHA256_FROM_INGESTION",
  "classification": "REVIEWED_SOURCE",
  "actor": "source-reviewer",
  "permittedClaims": ["REPLACE_WITH_AN_EXACT_SUPPORTED_STATEMENT"],
  "authenticFirstPerson": false
}
```

The placeholders above deliberately make this an input template, not an executable review.
The synthetic tutorial demonstrates how to populate the exact fields programmatically.

```bash
./gtm evidence review --brand founder \
  --file research/inbox/founder/REVIEW.json --json
```

Each permitted claim must match an ingested statement. `source-reviewer` may approve
documentary claims but cannot impersonate the owner. Personal experience requires an actual
owner review with `classification: "OWNER_ATTESTED"`, `actor: "owner"` and
`authenticFirstPerson: true`. Do not infer that attestation from an agent's draft.

Source/record IDs are immutable. For a corrected source, new revision, new expiry decision
or different source bytes, create a new evidence ID and review it. Do not edit existing
receipts or simply extend old timestamps to make a claim current.

## 5. Prepare content and creative

These examples use placeholder IDs returned by preceding commands. Replace them; do not
literally pass `SOURCE_ID`, `DRAFT_ID` or `PACKET_ID`.

```bash
./gtm content draft --brand founder --format thread --source-card SOURCE_ID --json
./gtm content humanize --brand founder --draft DRAFT_ID --preserve-claims --json
./gtm content pack --brand founder --source-card SOURCE_ID --json
```

Use `data.id` from `content draft` as the input to `content humanize`. Use the returned
humanized ID when rendering or packaging. `content pack` returns five posts and two threads
plus a content-batch artifact; it does not publish them or render all seven automatically.

Current writing is deterministic source assembly with tenant-specific hooks. Humanization
uses conservative local wording rules and preserves protected statement/risk blocks. It is
not a hosted Humanizer call, a complete stylistic rewrite or a substitute for editorial
review. First-person claims require owner-attested evidence. Numbers, named entities,
negations, conditions and risk disclosures must stay supported.

```bash
./gtm creative pack --brand founder --draft HUMANIZED_DRAFT_ID --json
./gtm distribution manual-pack --brand founder --draft HUMANIZED_DRAFT_ID --json
```

Render before manual packaging. Packaging a draft without creative can produce an
incomplete packet, but that packet cannot pass manual approval. Repeating packaging after
creative exists creates a different payload/hash because the media binding has changed.

### What creative output contains

| Asset | Current output |
| --- | --- |
| Cover one | 1200×675 SVG, PNG, WebP, editable layout JSON and alt text |
| Cover two | 1080×1080 SVG, PNG, WebP, editable layout JSON and alt text |
| Landscape video | 1920×1080, 20 seconds, 30 fps, H.264/yuv420p |
| Portrait video | 1080×1920, 20 seconds, 30 fps, H.264/yuv420p |
| Video supporting files | Poster, FFprobe result, timeline, SRT and VTT captions |

Videos use four five-second editorial scenes with gentle motion. They are intentionally
silent. Caption cues repeat the scope/risk footer, not a full narrated transcript. These
are source-backed editorial graphics with provisional styling, not captured live UI.
Long claims are referred to in the packet rather than being truncated in a visual.

Automated checks inspect bounds, dimensions, video properties, decoded poster and faststart.
The owner must still review visual quality, exact branding, readability, licensing, caption
adequacy and platform-specific text/media suitability. There is no complete native X
weighted-character validation or automatic text revision editor in this CLI.

### Package contents

Look under `runtime/v3/<tenant>/manual-publish/<payload-hash>/`:

```text
publishing-package.json    immutable payload/account/evidence/media metadata
post.txt                  joined draft text
thread.md                 numbered blocks for manual thread preparation
alt.txt                   general description
sources.md                source URLs, revisions and licenses
preview.html              escaped text preview
instructions.md           exact-account handoff instructions and HOLD state
images/                   copied images and editable/supporting files
video/                    copied video/caption/timeline/poster files
```

`preview.html` is a text preview, not a complete social composer or automatic video player.
Open the media files separately. `post.txt` for a thread is not necessarily suitable as one
single platform post. Review and preserve the exact approved content; any edit requires
new source-backed content/package and a fresh approval.

## 6. Run a weekly campaign

The V3 cycle sequences:

**Research → Strategy → Content → Humanization → Creative → QA → Owner Approval →
Manual Distribution → Measurement → Retrospective.**

```bash
./gtm cycle run --brand retropick --idempotency-key retropick-2026-w43 --offline --json
./gtm cycle status --brand retropick --json
./gtm cycle resume --brand retropick --idempotency-key retropick-2026-w43 --offline --json
```

Choose a unique tenant-prefixed key for each campaign/week and immutable input set.
The cycle creates one source-backed thread, its creative and its manual packet. It does
not automatically create seven creative packages; use `content pack` separately for the
five-post/two-thread batch.

The current cycle chooses the first usable reviewed source in the selected tenant/dataset.
It does not accept `--source-card` to override that choice. Inspect `evidence list` and the
produced handoff before proceeding. For precise source selection, use the individual
content/creative/manual-pack commands. The cycle binds the set of usable sources/reviews;
adding or expiring sources can therefore require a new key even if unrelated to the first
source. A new key does not itself fix an evidence gap.

| Returned cycle state | Meaning and next action |
| --- | --- |
| `BLOCKED` / `EVIDENCE_GAP` | Supply current reviewed evidence; then use an appropriate new key if inputs changed |
| `AWAITING_APPROVAL` | Open the exact packet; await genuine owner review and manual distribution |
| `BLOCKED` / `MEASUREMENT_REQUIRED` | Publication was reported; import a qualifying non-null observation |
| `RETROSPECTIVE_COMPLETED` | Local checkpoint sequence finished with publication and measurement records |

A completed synthetic cycle has `realCycleCompleted: false`. A completed observed cycle
still uses owner-reported publication/measurement; it does not imply verified conversion,
causal lift or eligibility to bypass improvement review. The cycle currently needs a
non-null metric, not proof that the whole seven-day period or every business KPI is complete.
Read the report's period and missing-data fields separately.

Unchanged resume avoids repeating creative work. Immutable snapshots preserve checkpoints.
Changed evidence/governance/media should be resolved with a new reviewed revision rather
than overwriting existing files. The latest publication state controls completion;
invalidation removes completion eligibility. Cycle snapshots can contain `AWAITING_APPROVAL`
while the packet's initial state is `AWAITING_OWNER_APPROVAL`; these name different records.

### Brand-specific usage

For RetroPick, prepare the current reviewed product source, then:

```bash
./gtm voice profile --brand retropick --json
./gtm content pack --brand retropick --source-card RETROPICK_SOURCE_ID --json
./gtm workflow run retropick-feature-launch --brand retropick \
  --idempotency-key retropick-launch-unique --offline --json
```

For founder technical content, prepare a reviewed technical source and any separate genuine
owner experience attestation, then:

```bash
./gtm voice profile --brand founder --json
./gtm content pack --brand founder --source-card FOUNDER_SOURCE_ID --json
./gtm workflow run founder-tech-thread --brand founder \
  --idempotency-key founder-technical-unique --offline --json
```

These named launch/thread commands route to the V3 cycle. Review the actual selected source,
account and thread. A provisional voice profile does not establish authentic founder voice.

### A practical weekly routine

This is a suggested human operating cadence, not a built-in schedule. Adapt it to the
actual campaign and source validity windows; the application runs only when invoked.

| When | Operator work | Useful command/output |
| --- | --- | --- |
| Start of week | Review primary sources, identify one audience/problem, separate facts from hypotheses | `evidence list`, `research trends`, new reviewed source records |
| Planning | Choose one message and a measurable outcome with a definition and denominator | `capabilities plan --stage strategy`; review the cycle strategy handoff |
| Production | Prepare a writing batch and render the selected piece | `content pack`, `creative pack`, or `cycle run` |
| Review | Inspect exact copy, evidence, authenticity, media, rights and account | Packet files and genuine owner review; keep HOLD if any item is unresolved |
| Distribution | Record approval/handoff, then manually publish unchanged content in the native UI | Decision imports followed by actual native publication and owner-reported URL |
| Following days | Collect consented/owned observations without treating reach as conversion | `metrics import`; retain export provenance and qualification definitions |
| Retrospective | Read the completed UTC window, review missing data, choose one next hypothesis | `analytics weekly`, `cycle resume`; record the actual human decision separately |

For a RetroPick experiment, define what constitutes a qualified acquisition, activation or
retained user before counting it. For founder work, define which relevant developer
conversation, collaboration or professional opportunity qualifies. Keep unrelated follower
or impression totals separate. These are planning instructions; the application does not
implement live product instrumentation or independently verify those outcomes.

## 7. Approve and distribute manually

Only the owner can supply a real approval. The isolated tutorial supplies visibly synthetic
fixture decisions and never authorizes actual publication.

### Decision file fields

Save a strict JSON object in `distribution/inbox/<tenant>/NAME.json`:

| Field | Requirement |
| --- | --- |
| `tenant` | Exact selected tenant |
| `packetId` | Exact packet ID returned by packaging/cycle |
| `payloadSha256` | Exact packet `payloadSha256`; do not recompute it from pretty-printed JSON |
| `account` | Exact expected handle without `@` |
| `actor` | `owner` |
| `at` | Actual ISO event timestamp, not future; events cannot move backward |
| `event` | One of the events below |
| `editorialReviewed`, `creativeReviewed`, `authenticityReviewed` | All true for a genuine `APPROVE_MANUAL` |
| `expiresAt` | For approval: future, at most seven days after approval event |
| `postUrl` | Required when reporting publication; actual exact-account X/Twitter status URL |

The shape is shown in [the operating guide](V3_OPERATIONS.md#manual-owner-handoff); the
tutorial generates a fully valid synthetic version. For a real campaign, do not programmatically
set review booleans until the owner has actually performed those reviews.

```bash
./gtm distribution decision import --brand founder \
  --file distribution/inbox/founder/APPROVAL.json --json
```

`distribution receipt import` is an alias to the same decision parser, not a platform
verification mechanism. Actor fields are local attestations, not cryptographic signatures.

### State transitions

| Event | Permitted starting state / condition | Result |
| --- | --- | --- |
| `APPROVE_MANUAL` | Awaiting approval, rejected or invalidated; valid source/media, complete creative and all human review flags | `APPROVED_FOR_MANUAL` |
| `HANDOFF` | Approved and approval still current | `HANDED_OFF` |
| `OWNER_REPORTED_SCHEDULED` | Handed off, scheduled or publication unknown; current approval | `OWNER_REPORTED_SCHEDULED` |
| `OWNER_REPORTED_PUBLISHED` | Handed off, scheduled or publication unknown; current approval; matching post URL | `OWNER_REPORTED_PUBLISHED` |
| `PUBLICATION_UNKNOWN` | Handed off, scheduled or unknown; current approval | `PUBLICATION_UNKNOWN` |
| `REJECT` | Known exact-bound packet | `REJECTED` |
| `INVALIDATE` | Known exact-bound packet, including expired/changed media situations | `INVALIDATED` |

Use a separate file/event for each transition. In particular, approval does not replace
handoff. A scheduled report does not schedule anything. For publication the owner must:

1. Review sources, text, authenticity, risk language, media and rights.
2. Approve the exact packet/account/hash, then record handoff.
3. Sign in independently and confirm the expected account in the native platform.
4. Publish the unchanged approved content/media manually.
5. Supply the actual matching status URL and actual event time in a publication record.

The current URL validator accepts credential-free, query-free HTTPS status paths on
`x.com` or `twitter.com` for the packet's account. It does not independently contact the
platform to prove that URL belongs to a real post. Never use the tutorial's `/status/0`
fixture as observed publication evidence.

## 8. Import measurements and read reports

Export or collect authorized owned observations after actual publication. Give the metric a
clear definition and window, with qualification criteria appropriate to the brand. Hash the
original authorized export bytes for `sourceSha256`; the software records that hash but
does not independently authenticate the upload or fetch its referenced export.

### Metric record format

JSON input is an **array**, even for one observation. CSV uses the same field names as its
header. The runnable tutorial creates both JSON and CSV examples.

| Field | Rule |
| --- | --- |
| `tenant`, `packetId` | Exact tenant and already owner-reported-published packet |
| `observedAt` | Actual snapshot timestamp; not in future or before publication |
| `metric` | Supported name below |
| `value` | Nonnegative finite number or null |
| `denominator` | Nonnegative finite number or null |
| `windowStart`, `windowEnd` | ISO timestamps; start < end ≤ observedAt; end not before publication |
| `origin` | `OWNER_EXPORT` |
| `definition` | 10–500 character operational definition |
| `sourceSha256` | Lowercase SHA256 provenance hash |
| `outcomeVerification` | `OWNER_ATTESTED`; self-assigned platform/product verification is rejected |
| `semantics` | `CUMULATIVE_SNAPSHOT` |

Supported metric names:

| Scope | Names |
| --- | --- |
| Both tenants | `impressions`, `engagements`, `qualified_engagements`, `link_clicks` |
| RetroPick only | `qualified_acquisition`, `activation`, `retained_users` |
| Founder only | `developer_relationships`, `collaborations`, `technical_credibility`, `professional_opportunities` |

CSV empty numeric cells and `UNAVAILABLE` parse as null. JSON uses `null`, not the string
`"UNAVAILABLE"`. Do not use zero to represent a missing measurement. A zero is an actual
measured value. The importer accepts quoted commas/newlines and doubled quotes.

```bash
./gtm metrics import --brand retropick --from growth/inbox/retropick/METRICS.csv --json
./gtm analytics weekly --brand retropick --days 7 --offline --json
./gtm weekly recap --brand retropick --days 7 --offline --json
./gtm cycle resume --brand retropick --idempotency-key retropick-2026-w43 --offline --json
```

Exact duplicate imports return duplicates rather than adding counts. Changing the value of
the same metric identity conflicts and rolls back the whole batch. A later cumulative
snapshot needs a later actual `observedAt`; the report selects the latest snapshot for the
same packet/metric/window. Different windows remain separate rows and should not be blindly
summed, especially if they overlap.

### Read the two scorecards

`engineering` records checkpoint/completion counts and software-side limitations.
`business.metrics` contains owner observations with provenance. Do not equate the two:

- Successful rendering does not establish engagement.
- Impression or follower counts alone do not establish qualified outcomes.
- A click is not a verified acquisition, activation, retained user or opportunity.
- An owner-uploaded activation count remains owner-attested, not product-verified.
- `verifiedConversions` and `ctr` currently remain null; no causal growth is inferred.

Reports end at the current day's **00:00 UTC**, with a half-open interval `[start, end)`.
Today's snapshots appear in the next day's report. Selection uses `observedAt`; it does not
prorate cumulative windows across the report boundary. `NO_DATA` is a valid honest result.
Historical metric imports use source freshness at recorded publication time, but current
payload/media/governance integrity checks can still block changed artifacts.

## 9. Use specialists and the workflow catalog

```bash
./gtm skills list --json
./gtm agents list --json
./gtm skills audit --json
./gtm skills dedupe --json
./gtm capabilities plan --brand founder --stage research \
  --task 'Research an inspectable technical explanation from reviewed primary sources' --json
./gtm workflow catalog --json
./gtm workflow list --json
```

`capabilities plan` discovers a stage-specific primary specialist and at most two supporting
skills. It does not execute the selected agent, tools or model. Each subsequent workflow
stage can use a different specialist through a structured handoff. Unknown model availability
or tool pricing does not authorize fallback. Ranking weights are currently declared targets,
not a complete measured ranking engine. `skills dedupe` reports duplicates and removes none.

`agents/` contains roles, not permanent background processes. Natural-language work through
your coding assistant is separate from deterministic CLI execution. An example request is:

> For tenant founder, prepare a technical thread from the reviewed source ID supplied here.
> Use one primary writing specialist and at most two supporting skills for this stage.
> Preserve exact claims, conditions, citations and risk disclosures. Do not invent my
> experience. Produce an owner-review draft and list unresolved authenticity questions.
> Do not publish or change global skills or provider configuration.

For RetroPick, supply that tenant's own source IDs and ask for the documented product scope,
eligible audience and a measurable hypothesis without claims of trading upside. Such a
prompt directs an assistant; it is not a new `gtm` subcommand or authorization to call a paid tool.

### V3 workflow availability

| Workflow | Current behavior |
| --- | --- |
| `daily-market-intelligence` | Local reviewed source themes |
| `weekly-competitive-intelligence` | Documentary source statements; no invented competitor metrics |
| `founder-voice-calibration` | Requires an authentic owner-attested sample; remains owner-reviewed |
| `retropick-positioning-refresh` | Reviewed local message hierarchy |
| `founder-tech-thread` | V3 cycle with required tenant-prefixed idempotency key |
| `retropick-feature-launch` | V3 cycle with required tenant-prefixed idempotency key |
| `weekly-growth-retrospective` | V3 scorecard report |
| Remaining 13 V3 catalog entries | Staged definitions; not implemented V3 executions |

Example:

```bash
./gtm workflow run daily-market-intelligence --brand founder --offline --json
./gtm workflow run weekly-growth-retrospective --brand founder --offline --json
```

The older 16-definition engine is listed by `workflow list`, not `workflow catalog`. Some
names overlap, such as `build-in-public`. V3 dispatch takes precedence for names in its
catalog; a staged overlapping name returns `WORKFLOW_STAGED`, even if the older definition
exists. Use a non-overlapping legacy workflow such as `feature-launch` to practise the
older engine. Do not mistake a catalog entry for a completed integration.

## 10. Use the isolated improvement track

Run these from the actual configured project, after retaining current campaign evidence:

```bash
./gtm harness baseline --suite all --offline --json
./gtm harness evaluate --suite all --offline --json
./gtm harness propose --suite gtm --target project:guardrails --offline --json
./gtm harness promotions status --json
```

These administrative commands are cross-tenant synthetic contract checks and do not require
`--brand`. Supported suites are `global` (12 fixtures), `gtm` (16) and `all` (28). Only
offline deterministic execution with k=1 is admitted. `--mode offline` is optional; sequential
scheduler operation is fixed by the custom worker. Do not infer support for arbitrary modes,
seeds, target skills or baseline references merely because the general argument parser
recognizes a flag. `global-discovery` and `founder-voice` are not implemented suite names.

The upstream pin is `1cfe254e8d25b15f37048c3730134686abe60335`. The project implements
its own Python adapter and runner; do not invoke an assumed upstream `--bench gtm`.
Baseline executes source-preserving handoffs; evaluate/propose use the real upstream
scheduler with a deterministic local proposer. The only admitted edit surface is the
worker's project `guardrails.md`; no global skill is changed and no improvement is promoted.

The rootless worker has no network, credentials, writable production source mount, global
Codex home or Docker socket. Its root filesystem is read-only and resources are bounded.
Negative tests check network/root writes, candidate script injection, removal of publication
boundaries and credential environment exposure. Parent-side checks inspect deliverables
after selection. Read `data.receipt`, `worker.negativeTests`, `externalModelRequests` and
`limitations` in the resulting acceptance file.

Public fixtures are frozen by hash. Sealed holdout evaluation and model-backed quality
evaluation remain unimplemented. A public contract pass does not prove human editorial
quality, authentic voice, live connector capability or business impact. Both project and
global promotion stay disabled pending observed weekly cycles for each brand, baseline,
sealed holdouts, security, rollback validation, independent review and exact owner authorization.

## 11. Operate, verify and recover

### Check local software

```bash
pnpm check
./gtm verify --all --offline --json
```

`pnpm check` runs compiler/lint, build, runtime tests, governance, Python tests and scoped
security scans. The acceptance command runs local checks again and verifies preserved
snapshots, existing campaign manifests and saved Harness² receipts. It needs the established
runtime artifacts; a source-only checkout cannot satisfy that historical acceptance check.
Run one appropriate check for your task rather than repeatedly invoking both commands.

Acceptance writes unique reports under `runtime/acceptance/v3/<timestamp>/` and a hashed
index under `docs/evidence/v3-acceptance-<timestamp>.json`. A successful command may return
`ACCEPTANCE_RECORDED_WITH_BLOCKED_STAGES`: check its nested overall and milestone statuses.
Do not rerun old phase-specific verifiers casually; some overwrite historical phase receipts.

### Files to retain

| Location | Purpose |
| --- | --- |
| `research/inbox/<tenant>/` | Authorized V3 source/review inputs |
| `distribution/inbox/<tenant>/` | Actual owner decision inputs |
| `growth/inbox/<tenant>/` | V3 measurement imports |
| `runtime/state/<tenant>/` | Separate legacy, synthetic operations and observed stores |
| `runtime/v3/<tenant>/` | Hashed content, creative, packets, handoffs and reports |
| `runtime/harness2/` | Audited upstream snapshot and disposable evaluation outputs/receipts |
| `runtime/preservation/v3-before/` | Original audited snapshot, restored copy and manifest |
| `docs/evidence/` | Historical and versioned acceptance indexes |

`runtime/` is ignored by Git. A Git commit or copied source tree alone does not preserve
campaign state and media. Back up authorized runtime state separately, without credential
stores. Close writers and use a consistent SQLite backup mechanism; copying a live database
file alone can miss WAL data. Store backups securely according to the data they contain.

For rollback, restore into a separate workspace and validate against the snapshot manifest.
Never reset the active dirty repository, delete historical receipts or overwrite current
observations to make an old test pass. Follow the detailed
[rollback instructions](V3_OPERATIONS.md#validation-and-rollback).

## 12. Troubleshoot

| Symptom/code | Likely reason | Action |
| --- | --- | --- |
| Missing `dist/` module | Project not built | Run `pnpm build` with the pinned installed dependencies |
| `BRAND_REQUIRED`, `INVALID_BRAND` | Missing or wrong tenant | Supply exactly `--brand founder` or `--brand retropick` |
| `INPUT_SCOPE` | Absolute/private/wrong-tenant inbox path | Place the file in the allowed tenant inbox and use a relative path |
| `SCHEMA_INVALID` | Extra/missing fields, bad dates, wrong JSON shape or enum | Compare with the field tables; metrics JSON must be an array |
| `SOURCE_HASH` | Text bytes differ from supplied digest | Hash the exact UTF-8 text; create a new source revision when correcting it |
| `SOURCE_EXPIRED`, `EVIDENCE_GAP` | Unreviewed/expired source, wrong dataset, missing authentic sample | Review current authorized evidence in the same tenant/dataset |
| `CLAIM_NOT_SUPPORTED` | Review digest or statement mismatch | Use ingestion `data.sha256` and exact supported statement segments |
| `OWNER_ATTESTATION_REQUIRED`, `AUTHENTICITY_GAP` | Personal claim lacks genuine owner attestation | Remove unsupported personal claims or obtain actual owner evidence |
| `INPUT_CHANGED` | Source set, review or governance changed since cycle/draft | Create a newly reviewed revision and new cycle key; retain old history |
| `PACKET_MISSING`, `DRAFT_MISSING` | Wrong ID/tenant/dataset or no packet yet | Inspect status and use returned IDs consistently |
| `PAYLOAD_CHANGED`, `CREATIVE_CHANGED` | Bound media/file bytes changed | Stop using the old approval; create and review a fresh revision/package |
| `OWNER_REVIEW_REQUIRED` | Missing creative/review flags, wrong state or invalid expiry | Complete actual owner review and use the exact current packet |
| `OWNER_APPROVAL_MISSING`, `ILLEGAL_TRANSITION` | Skipped handoff or approval expired/state revoked | Follow the transition table; reapprove only when genuinely reviewed |
| `APPROVAL_BINDING`, `ACCOUNT_URL_MISMATCH` | Hash/account/time/URL does not match | Correct the input from the actual packet/publication; never guess identity |
| `PUBLICATION_UNKNOWN` on metric import | No latest published record, or record invalidated | Resolve actual publication state; do not manufacture a receipt |
| `METRIC_SCOPE`, `METRIC_TENANT` | Invalid dates/window or other brand's metric | Correct the real measurement definition, window and tenant |
| `VERIFICATION_AUTHORITY` | Upload asserts platform/product verification | Preserve owner-attested classification; only independent adapters could verify |
| Report `NO_DATA` | Missing records, wrong dataset or today's snapshots excluded | Inspect UTC period and `observedAt`; missing data is not a zero |
| `GLOBAL_CAPABILITY_BLOCKED` | Existing global tool unavailable/denied | Inspect approved installation; do not enable fallback or extract credentials |
| `WORKFLOW_STAGED`, `SUITE_UNAVAILABLE`, `TARGET_DENIED` | Named capability is not implemented/admitted | Use the availability tables; do not assume roadmap names work |
| `HARNESS_BLOCKED` | Rootless runtime/image/pin/prerequisite failure | Inspect local evaluation evidence; retain isolation and exact pin |
| `ACCEPTANCE_FAILED` | Tests or required historical artifacts unavailable | Read the new checks log; restore the proper artifacts rather than overwriting history |

Exit codes are: 0 local result, 2 invalid arguments, 3 permission/policy denial, 4 capability
unavailable, 5 validation failure and 6 execution failure. Some schema constraints return
5 rather than 2. Structured output is more precise than the exit code alone.

## 13. Understand the current limits

Use the current [acceptance report](V3_ACCEPTANCE.md) when deciding what is ready. Important
operational limits include provisional brand identity, conservative deterministic writing,
no complete X text validator, first-usable-source cycle selection, staged workflow definitions,
no automatic authenticated publishing, no independently verified uploaded conversions,
no calculated CTR, no completed sealed holdout evaluator and no automatic promotion.

The final owner amendments override older prompt/roadmap statements about mandatory
credential rotation or different milestone ordering. Reuse the existing authorized protected
router, keep unknown costs explicit, and treat synthetic results as synthetic throughout.
