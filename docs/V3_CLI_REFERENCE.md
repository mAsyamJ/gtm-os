# GTM OS V3 CLI reference

This reference follows `packages/cli/src/commands.ts` and `packages/v3/src/cli.ts`.
Use the [user manual](V3_USER_MANUAL.md) for field schemas and operating decisions, and the
[synthetic tutorial](examples/V3_SYNTHETIC_WALKTHROUGH.md) for complete executable examples.
Commands below are local unless an approved public read is explicitly selected.

## Invocation and output

```bash
pnpm build
./gtm COMMAND SUBCOMMAND [POSITIONAL_ARGUMENT] [OPTIONS]
pnpm gtm COMMAND SUBCOMMAND [OPTIONS]
```

| Option | Meaning |
| --- | --- |
| `--brand founder\|retropick` | Required for tenant work; not required for structural audit/catalog, aggregate cost or cross-tenant synthetic Harness² commands |
| `--json` | Compact JSON response; the default is formatted JSON |
| `--root PATH` | Select a local workspace's inputs/state/output; does not copy it or change dependency installation |
| `--offline` | Required by workflow/cycle runs, research replay and offline Harness²/acceptance |
| `--synthetic` | Select synthetic V3/operations data where supported; retain it through every step of a fixture workflow |
| `--dataset OBSERVED\|SYNTHETIC` | Explicit V3 dataset; default is `OBSERVED`; synthetic fixture flags take precedence |
| `--help`, `-h` | General help; not separate per-command manuals |
| `--version` | Package version, currently `0.2.0`; not an acceptance milestone |

Options use space-separated values, for example `--brand founder`. Flags with recognized
names are not necessarily used by every command. For instance, `--source-card` does not
select a cycle source, `--max-stages` is not a V3 cycle control and `--seed` is not a custom
worker configuration interface. Use only the options documented for each command.

Responses normally have `{ "status": "...", "data": ... }`. A local result can contain a
blocked nested state. On errors inspect `data.error.code` and `data.error.message`.

| Exit | Meaning |
| --- | --- |
| 0 | Local result, including honest nested blockers |
| 2 | Invalid/missing argument |
| 3 | Policy/permission denial |
| 4 | Missing/unavailable capability |
| 5 | Typed validation, integrity or acceptance failure |
| 6 | Execution failure |

## Inventory, accounts, costs and capabilities

| Command | Important options | Output/scope |
| --- | --- | --- |
| `doctor` | `--json` | Legacy local configuration/storage checks; retains some older phase wording; not an authenticated provider health probe |
| `install audit` | `--json` | Local upstream/dependency inventory; installs and connects nothing |
| `brand show` | `--brand` | Selected brand's local profile |
| `brand validate` | `--brand` | Local profile/claims checks; no authenticated principal proof |
| `claims audit` | `--brand` | Brand claims ledger validation; separate from V3 evidence review |
| `skills list` | `--json` | Local project specialist skills |
| `agents list` | `--json` | Role directories; not running agent processes |
| `skills audit`, `capabilities audit` | `--json` | Curated global source/license inventory; reference status is not execution verification |
| `skills dedupe` | `--json` | Reports duplicate repositories; removes none |
| `capabilities doctor` | `--json` | Source audit and unchanged protected-router policy; no live connector proof |
| `capabilities plan` | `--brand`, `--task TEXT`, optional `--stage NAME` | Discovers one primary/at most two supporting skills for one stage; never executes them |
| `integrations costs` | `--json` | Zero paid social cap, explicit unknown prices/inference cost |
| `costs report` | Optional `--brand` | Legacy recorded project cost entries; excludes complete subscription/operator/CPU billing |
| `voice profile` | `--brand` | Local tenant voice contract; provisional pending authentic owner samples |

```bash
./gtm capabilities plan --brand retropick --stage strategy \
  --task 'Position the documented testnet mechanism for eligible product explorers' --json
./gtm capabilities plan --brand founder --stage content \
  --task 'Draft a technical explanation preserving reviewed source claims' --json
```

Planning excludes prohibited social scraping, cookie/stealth/bypass and publishing tasks
before global discovery. It returns `executable: false`. A discoverable tool or provider
does not independently confer permission, reviewed schema, price admission or availability.

## V3 research and evidence

| Command | Required options | Optional options / result |
| --- | --- | --- |
| `evidence ingest` | `--brand`, `--file research/inbox/TENANT/FILE.json` | Dataset flags; returns `data.id`, source record `data.sha256` and unverified/synthetic class |
| `evidence review` | `--brand`, `--file research/inbox/TENANT/REVIEW.json` | Dataset flags; binds exact ingestion record hash and permitted statements |
| `evidence list` | `--brand` | Dataset flags; records visible to that tenant/dataset |
| `research trends` | `--brand` | `--days 1..90` (default 30), dataset flags; local source cards/themes and window indicators |
| `research replay` | `--brand`, `--offline` | Always three synthetic installed-component jobs; no live search or provider call |
| `research fetch` | `--brand`, `--url HTTPS_URL`, `--network approved-read` | Keyless allowed-host public read; returns unverified bytes, not an ingested/reviewed source |

Inboxes accept relative `.json` paths with a tenant-matching directory. V3 evidence files
use the [V3 source/review schemas](V3_USER_MANUAL.md#4-research-and-review-evidence).
These are different from the older Phase C source input schema.

Public fetch hosts are currently `raw.githubusercontent.com`, `api.github.com` and
`hn.algolia.com`. Credentials, ports, query strings and fragments are excluded. The transport
can still deny requests for source policy, robots, DNS or availability reasons.

## V3 content, creative and manual packages

All commands in this table require `--brand` and use the selected dataset.

| Command | Arguments/options | Result |
| --- | --- | --- |
| `content draft` | `--source-card SOURCE_ID`, optional `--format post\|thread` (default post) | Source-assembled immutable draft; source must be reviewed/current |
| `content humanize` | `--draft DRAFT_ID --preserve-claims` | Conservative protected-claim edit; human editorial review still required |
| `content pack` | `--source-card SOURCE_ID` | Five posts, two threads and a content-batch receipt; no automatic creative for all seven |
| `creative pack` | `--draft HUMANIZED_ID`, or `--campaign CYCLE_KEY` | Prototype covers and landscape/portrait videos for that draft/cycle |
| `distribution manual-pack` | `--draft HUMANIZED_ID` | Exact-account/content/evidence/media-bound local manual packet |
| `distribution status` | No extra arguments | V3 packet records and complete publication history in this tenant/dataset |
| `distribution decision import` | `--file distribution/inbox/TENANT/FILE.json` | Audited owner decision state transition |
| `distribution receipt import` | Same input as decision import | Alias; no automatic platform verification |

```bash
./gtm content draft --brand founder --format thread --source-card SOURCE_ID --json
./gtm content humanize --brand founder --draft RETURNED_DRAFT_ID --preserve-claims --json
./gtm creative pack --brand founder --draft RETURNED_HUMANIZED_ID --json
./gtm distribution manual-pack --brand founder --draft RETURNED_HUMANIZED_ID --json
```

The capitalized IDs above are placeholders. Use returned `data.id` values; do not use
filenames as record IDs. For synthetic examples add `--synthetic` to all four commands.

Manual approval must follow actual owner review. Accepted event names are `APPROVE_MANUAL`,
`REJECT`, `INVALIDATE`, `HANDOFF`, `OWNER_REPORTED_SCHEDULED`,
`OWNER_REPORTED_PUBLISHED` and `PUBLICATION_UNKNOWN`. See the
[decision fields and transition table](V3_USER_MANUAL.md#7-approve-and-distribute-manually).

## V3 cycles and reports

| Command | Required options | Optional options / interpretation |
| --- | --- | --- |
| `cycle run` | `--brand`, `--offline`, `--idempotency-key TENANT-KEY` | Dataset flags; creates/resumes a cycle, usually pauses for owner review |
| `cycle resume` | Same as cycle run | Same immutable key; does not automatically select a new source or approve |
| `cycle status` | `--brand` | Dataset flags; returns checkpoint history, not just latest snapshots |
| `metrics import` | `--brand`, `--from growth/inbox/TENANT/FILE.json\|csv` | `--file` is an alternative input flag; all rows validate atomically |
| `analytics weekly` | `--brand` | `--days 1..90` (default 7), dataset flags; separate engineering/business scorecards |
| `weekly recap` | Same as analytics weekly | Alias to V3 scorecards, not the older synthetic recap function |

`--id TENANT-KEY` is accepted as a cycle key fallback, but explicit `--idempotency-key` is
clearer. For a cycle key use a valid ID beginning with the tenant followed by `-`, such as
`founder-2026-w43`. `creative pack --campaign` takes that key, not a packet ID or arbitrary
path. Cycles use the first usable source and bind the current usable source/review set.

The report period is `[UTC-midnight-minus-days, UTC-midnight-today)`. Metrics uploaded today
may therefore not appear until tomorrow. A later snapshot replaces an older one only when
packet, metric and measurement window match; different/overlapping windows remain distinct.

```bash
./gtm cycle resume --brand founder --idempotency-key founder-2026-w43 --offline --json
./gtm analytics weekly --brand founder --days 7 --offline --json
```

## Workflow commands: two engines

| Command | Meaning |
| --- | --- |
| `workflow catalog` | V3's 20 portable definitions and implementation/tenant status |
| `workflow list` | Older engine's 16 synthetic YAML definitions |
| `workflow run NAME --brand TENANT --offline` | V3 dispatch first for V3 catalog names; otherwise older engine |
| `workflow resume JOB_ID --brand TENANT --offline` | Older engine only; V3 cycles use `cycle resume --idempotency-key KEY` |
| `audit trace --brand TENANT --job JOB_ID` | Older engine job/source/artifact audit; not a universal V3 trace endpoint |

V3 execution currently supports `daily-market-intelligence`, `weekly-competitive-intelligence`,
`founder-voice-calibration`, `retropick-positioning-refresh`, `founder-tech-thread`,
`retropick-feature-launch` and `weekly-growth-retrospective`. The launch/thread commands
also require a tenant-prefixed `--idempotency-key`. The remaining V3 catalog names return
`WORKFLOW_STAGED`; overlapping legacy names do not bypass that V3 gate.

Example of legacy interruption/recovery, using a non-overlapping name:

```bash
./gtm workflow run feature-launch --brand retropick --offline \
  --idempotency-key retropick-legacy-demo --max-stages 1 --json
./gtm workflow resume RETURNED_JOB_ID --brand retropick --offline --max-stages 1 --json
./gtm audit trace --brand retropick --job RETURNED_JOB_ID --json
```

Legacy `--max-stages` is a positive integer; `--fixture synthetic` is the only declared
fixture. Legacy completions are synthetic JSON contracts and cannot authorize publication.
This example creates local synthetic legacy records; use an isolated demo `--root` if you
want to keep the main workspace unchanged.

## Legacy source/planning tools

These commands use the older `gtm.sqlite` source cards and planning path, not the V3
reviewed evidence database. Importing a V3 source alone does not populate this older path.
Read [Phase C's format and examples](PHASE_C.md) before using it.

| Command | Options |
| --- | --- |
| `research ingest` | `--brand`, `--source research/inbox/TENANT/FILE.json`, `--offline` |
| `research daily`, `research sources` | `--brand`, `--offline` |
| `strategy icp` | `--brand` |
| `strategy plan`, `campaign plan` | `--brand`, optional `--days N`, `--from YYYY-MM-DD` |
| `content calendar` | `--brand`, optional `--days N`, `--from YYYY-MM-DD` |
| `content brief` | `--brand`, `--topic TEXT`, optional `--source LEGACY_SOURCE_ID` |

These create local hypotheses/briefs requiring review, not approved public copy. Do not use
recorded-clock examples to extend a source's actual expiry.

## Legacy synthetic graphics/video

| Command | Options |
| --- | --- |
| `design templates` | `--brand` |
| `design render` | `--brand`, `--template NAME`, `--fixture synthetic`, optional `--size` |
| `video storyboard` | `--brand`, `--fixture synthetic` |
| `video render` | `--brand`, `--fixture synthetic`, optional `--size landscape\|portrait` |

Current template names:

| Founder | RetroPick |
| --- | --- |
| `decision-note` | `evidence-checklist` |
| `reliability-check` | `mechanism-notes` |
| `learning-map` | `feature-hero` |

For `design render`, common documented sizes are `landscape`, `wide`, `square` and `portrait`.
Use the selected template's intended layout. These outputs live under `runtime/creative/`
and remain explicitly synthetic placeholders, separate from V3 source-backed creative.

```bash
./gtm design render --brand founder --template decision-note --fixture synthetic --size square --json
./gtm video storyboard --brand retropick --fixture synthetic --json
```

## Phase E synthetic dispatch and analytics

These functions exercise fault handling and attribution without a live account or actual
publication. They use the synthetic operations store even if the main observed campaign
has not published. They are distinct from V3 packet approvals and metrics imports.

| Command | Options | Meaning |
| --- | --- | --- |
| `distribution prepare` | `--brand --fixture synthetic`, optional `--media RECEIPT_PATH` | Prepare a daily synthetic dispatch draft |
| `distribution simulate` | `--brand --fixture synthetic --draft PREPARED_ID --idempotency-key KEY`, optional `--scenario` | Simulate mock acceptance/timeout |
| `distribution reconcile` | `--brand --id REQUEST_KEY` | Read back authoritative local mock receipt; never blindly retry |
| `analytics seed` | `--brand --fixture synthetic` | Register a synthetic link and deduplicated fixture events |
| `analytics ingest` | `--brand --synthetic --source growth/analytics/inbox/TENANT/FILE.json` | Import a synthetic event-batch envelope |
| `analytics report` | `--brand --synthetic`, optional `--period 1d\|7d\|30d` | Synthetic ordered funnel and traceable last-entry-touch attribution |
| `analytics metrics` | `--brand` | Proposed synthetic event dictionary; distinct from V3 metric names |
| `growth cro` | `--brand --synthetic`, optional `--period` | Local proposal blocked on real UI and baseline; no deployment |
| `experiments list` | `--brand --synthetic` | Recorded proposals; no running live experiments |

Dispatch scenarios are `none`, `timeout-before-accept` and `timeout-after-accept`.
`distribution simulate` prepares the current daily fixture internally and requires its
exact draft ID. A draft from the previous UTC day, or one prepared with different media,
does not necessarily match that fixture. Use an exact request key when reconciling.

Example sequence (replace the returned ID):

```bash
./gtm distribution prepare --brand founder --fixture synthetic --json
./gtm distribution simulate --brand founder --fixture synthetic \
  --draft RETURNED_PREPARED_DRAFT_ID --idempotency-key founder-timeout-demo \
  --scenario timeout-after-accept --json
./gtm distribution reconcile --brand founder --id founder-timeout-demo --json
./gtm analytics seed --brand founder --fixture synthetic --json
./gtm analytics report --brand founder --synthetic --period 7d --json
./gtm growth cro --brand founder --synthetic --period 7d --json
./gtm experiments list --brand founder --synthetic --json
```

`timeout-after-accept` can reconcile to `SIMULATED_CONFIRMED`. A timeout with no authoritative
mock receipt remains unknown. Neither state is a real platform receipt. The seeded funnel
has four entry subjects and two ordered completions by construction; it is not campaign
performance. Synthetic event input has the envelope
`{"tenant":"founder","label":"SYNTHETIC","events":[...]}`; it is not the V3 metrics array.

`analytics report` without `--synthetic` does not select the V3 weekly report; use
`analytics weekly` for V3 owner observations. `distribution status` now selects the V3
packets/publication history, not the internal older mock-dispatch summary.

## Harness² and acceptance

| Command | Options | Scope |
| --- | --- | --- |
| `harness baseline` | `--offline`, optional `--suite all\|global\|gtm` | Deterministic contract baseline; default all |
| `harness evaluate` | Same; optional `--k 1`, `--mode offline` | Actual pinned scheduler with deterministic proposer |
| `harness propose` | Same; optional `--target project:guardrails` | Isolated project guardrail candidate; no promotion |
| `harness promotions status` | `--json` | Required gates and eligible latest observed-cycle counts; promotion flags remain false |
| `verify` | `--all --offline` | Fresh local checks and append-only milestone reports; requires saved runtime acceptance inputs |

```bash
./gtm harness baseline --suite global --offline --json
./gtm harness evaluate --suite gtm --k 1 --mode offline --json
./gtm harness propose --suite gtm --target project:guardrails --offline --json
./gtm harness promotions status --json
./gtm verify --all --offline --json
```

Run administrative worker/acceptance commands from the real configured workspace, not the
minimal tutorial clone. They depend on the audited upstream snapshot, saved receipts and
rootless worker image. The runner never automatically downloads missing upstream sources,
installs dependencies, enables providers or reads credential stores as a fallback.

The global suite has 12 public fixtures and GTM has 16. Contract checks are not model/voice/
creative/business quality evaluations. Sealed holdouts remain an outstanding gate. No CLI
command promotes a candidate, changes global instructions or enables model-backed evaluation.

## Explicit unavailable/denied boundaries

| Command or request | Current behavior |
| --- | --- |
| `x auth status --brand TENANT` | BLOCKED/exit 4; does not inspect account credentials or probe identity |
| `publish`, `schedule`, `outreach`, `deploy` | Denied; manual approval does not enable an automated action path |
| `benchmark run` | No measured hosted-model/compute benchmark implemented |
| `harness ... --suite founder-voice` | Unsupported suite; human authenticity review is separate |
| `harness ... --target skill:content-strategy` | Denied; no global skill editing |
| `harness ... --mode model-backed` | Denied; no provider/budget admission path |
| V3 staged workflow execution | BLOCKED; a catalog entry is not an integration |
| Arbitrary source scraping, authenticated X scraping or cookie extraction | Outside the approved source policy |

Roadmap/master prompt command examples may describe future capabilities. This reference
and the current code determine what you can actually run now.
