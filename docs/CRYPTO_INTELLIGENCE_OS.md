# Crypto Intelligence OS V4 — operator manual

V4 extends the existing V3 runtime. Select `--brand founder` or `--brand retropick` on every operation. Evidence, private annotations, drafts, packets and approvals remain separate. Shared public entity IDs are identifiers, not permission to join tenant data.

Start with [the first sprint](FIRST_LIVE_GTM_SPRINT.md), [research methodology](INFLUENCER_RESEARCH_METHODOLOGY.md), [source coverage](LAST30DAYS_SOURCE_COVERAGE.md) and [QA](CRYPTO_GTM_V4_QA.md). The V3 manual remains the authority for evidence review, owner decision imports and measurement.

## Prepare and inspect

```bash
pnpm build
./gtm intelligence sources doctor --brand retropick --json
./gtm intelligence sources doctor --brand founder --json
./gtm workflow catalog --json
```

The doctor checks declared policies without network/model requests. It does not certify an authenticated integration. `workflow catalog` includes eight executable V4 handlers; executable handlers may return `BLOCKED` or partial coverage when inputs are missing.

## Import the supplied seeds

```bash
./gtm intelligence seeds import --brand retropick \
  --people GTM_V4_CRYPTO_PEOPLE_WATCHLIST_SEED.csv \
  --projects GTM_V4_CRYPTO_PROJECT_RESEARCH_SEED.csv --json
./gtm intelligence seeds import --brand founder \
  --people GTM_V4_CRYPTO_PEOPLE_WATCHLIST_SEED.csv \
  --projects GTM_V4_CRYPTO_PROJECT_RESEARCH_SEED.csv --json
./gtm intelligence entities list --brand retropick --type person --json
./gtm intelligence graph export --brand founder --json
```

The original files contain 14 people and 25 projects. Only rows relevant to the selected tenant enter its store. CSV status labels and handles do not grant verification: imports retain them as discovery data, set identity unverified, role unknown and handle unavailable. Re-import is idempotent.

## Collect public sources

```bash
./gtm intelligence collect --brand retropick --window 30d \
  --profile crypto --network approved-read --json
./gtm intelligence sources list --brand retropick --json
./gtm intelligence trends --brand retropick --window 30d --json
```

Collection reads only individually registered sources in `config/v4-sources.json`. It uses HTTPS, public address validation with DNS pinning, robots checks and actual crawl delays, serial requests, no redirect following and bounded response bodies. Paid providers, X, credentials, cookies and stealth paths remain excluded. The first-sprint network ceiling is 80 request reservations per tenant/160 total. Each request reserves a 2 MiB application-body allowance, including robots requests and failed attempts. TLS/header overhead is not measured. Reservations survive restarts and are not automatically reset.

Each collection freezes its own UTC window. Trend reads use the latest collection window unless explicitly called with a clock in code. Publication metadata controls recency. Retrieval clocks do not turn old or undated material into a current trend. A `NO_MATCHES` query is retained in the query receipt; sparse source coverage is an operational result.

Sources remain retrieved and unverified. Save selected exact, bounded excerpts into the V3 inbox schema, then use:

```bash
./gtm evidence ingest --brand retropick --file research/inbox/retropick/SOURCE.json --json
./gtm evidence review --brand retropick --file research/inbox/retropick/REVIEW.json --json
./gtm intelligence sources review-link --brand retropick --file research/inbox/retropick/LINK.json --json
```

The link file contains `observationId` and `evidenceId`. Linking requires a current review, matching source URI and exact statement matches in the collected excerpt. Reviews bind the complete evidence record hash; copying a review across tenants fails.

## Select an editorial opportunity

An opportunity is a local JSON file under the selected tenant's research inbox:

```json
{
  "tenant": "retropick",
  "topicId": "retropick-example-topic",
  "title": "What happens after token launch?",
  "safeAngle": "Explain the documented testnet lifecycle and its limits",
  "sourceIds": ["REPLACE_WITH_REVIEWED_SOURCE_ID"],
  "temporalScope": "BACKGROUND",
  "features": {
    "evidenceQuality": 0.9, "brandFit": 1, "timelyDiscussion": 0,
    "educationalUtility": 0.95, "novelty": 0.5, "feasibleCta": 0.9
  },
  "risk": 0.3,
  "counterEvidence": ["Historical test receipts do not establish current liquidity."],
  "counterargument": "A correct mechanism does not establish demand."
}
```

These numbers are explicit editorial assessments, not observed influence or conversion metrics. Weights live in `config/v4-ranking.json`; they must sum to one. Missing engagement is unavailable and is not imputed as zero. High-risk opportunities require independent source hosts. A rolling opportunity must have linked, reviewed, publication-dated source coverage in the selected window.

A stable topic ID resolves to the newest stored opportunity revision; an immutable opportunity ID selects that exact revision. New briefs bind the opportunity ID and exact source/review hashes. Rolling briefs also freeze their publication window and linked observation hashes. Creating or reusing a rolling brief checks that the sources remain eligible in the selected collection window. A later window can make that brief stale; create a fresh researched revision rather than relabeling an old article as recent. Historical metrics validate against publication time.

```bash
./gtm intelligence opportunities --brand retropick --file research/inbox/retropick/TOPIC.json --json
./gtm intelligence opportunities --brand retropick --json
./gtm intelligence brief --brand retropick --topic-id retropick-example-topic --json
```

## Produce content and a HOLD campaign

Use the returned brief ID:

```bash
./gtm content pack --brand retropick --brief-id BRIEF_ID --model-mode offline --json
./gtm cycle run --brand retropick --brief-id BRIEF_ID \
  --idempotency-key retropick-unique-cycle --offline --json
./gtm cycle resume --brand retropick --brief-id BRIEF_ID \
  --idempotency-key retropick-unique-cycle --offline --json
```

Select exactly one of `--source-card`, `--topic-id` or `--brief-id`. Legacy source-card commands retain their old behavior. A selected cycle binds only its brief, selected evidence/reviews and draft governance; unrelated new research does not invalidate it. Changed selected inputs need a new revision/key.

The content pack contains five standard-length post drafts and two threads. Facts and risk disclosures are not truncated to fit a post. Creative output includes two editable diagrams, captioned portrait/landscape prototype video, source manifests and a storyboard. Prototype visuals are explicitly labeled and do not depict live UI or trading activity.

### Optional admitted-router selection

```bash
./gtm content pack --brand founder --brief-id BRIEF_ID \
  --model-mode router --budget-id v4-first-sprint --json
```

This operation requires the already-approved first-sprint reservation and a healthy existing guard. It never enables GLM or changes providers/defaults. The workflow uses the existing economy route with no escalation or metered fallback. Missing health fails before reserving quota. The initial budget allows four calls per tenant/eight total, including attempts/retries, with a $0.10 total estimated reservation ceiling. Actual subscription charges remain unknown. Exhausted reservations are not reset automatically.

The model can select/order exact reviewed claim indices; it cannot introduce new factual prose into the packet. Cached successful selections make reruns model-free. Humanizer preserves locked facts, numbers, conditions, citations, negations and disclosures. Semantic/editorial/authenticity review remains human work. Source-based third-person analysis is allowed; autobiographical claims need owner attestation.

## All eight workflows

```bash
./gtm workflow run crypto-daily-radar --brand retropick --offline --json
./gtm workflow run crypto-weekly-synthesis --brand founder --offline --json
./gtm workflow run influencer-expert-watchlist --brand founder --offline --json
./gtm workflow run launchpad-competitor-intel --brand retropick --offline --json
./gtm workflow run retropick-market-structure-series --brand retropick --brief-id BRIEF_ID --idempotency-key retropick-series-one --offline --json
./gtm workflow run founder-engineering-research --brand founder --brief-id BRIEF_ID --idempotency-key founder-series-one --offline --json
./gtm workflow run research-to-manual-packet --brand founder --brief-id BRIEF_ID --idempotency-key founder-packet-one --offline --json
./gtm workflow run weekly-gtm-learning --brand retropick --offline --json
```

For a daily live collection, replace `--offline` with `--network approved-read`. The watchlist blocks until its current-role verification threshold is met. Weekly learning blocks outcome acceptance when owned measurements are missing. No scheduler is activated by these commands.

## Owner review, distribution and measurement

Open the packet's `preview.html`, `publishing-package.json`, sources, media and captions. Keep account, evidence and payload hashes visible. The primary packet binds one selected thread; other content candidates need their own creative/manual packet before approval. A V4 owner approval also requires explicit quotation/rights review (`rightsReviewed: true`) alongside editorial, creative and authenticity review. Historical V3 approval records are not changed.

Only the owner publishes through X's native interface. Import owner decisions, the post URL and owned metrics using the V3 manual. Owner reports remain owner attestations. No observed weekly cycle or conversion is declared complete before the matching publication and measurement gates.

## Recovery and rollback

Read `cycle status`, source/brief revisions and the stored blocker before retrying. Failed requests retain reservations. A denied source is not a reason to enable authenticated, stealth or paid fallback. The Day0 router reconciliation script is a narrowly scoped historical repair with fixed original attempt IDs; it is not a general quota recovery command.

Preservation receipts are under `runtime/preservation/v4/`. Disable use of V4 routes to stop new work. Existing V3 databases are unchanged by the new intelligence schema. Source rollback can use the audited snapshot; restore a SQLite backup only after stopping writers and independently verifying the selected backup/target. Preserve later evidence instead of overwriting historical receipts. No remote push, merge, publication or global promotion is part of this release.
