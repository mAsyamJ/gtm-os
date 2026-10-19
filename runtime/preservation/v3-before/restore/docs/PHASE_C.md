# Phase C: curated references, research and strategy

Revision phase-c-r1. Audience: owner and local implementers. Inputs: master/phased contracts, tenant voice/positioning/messaging and pinned upstream snapshots. This phase implements authorized-file research and deterministic, evidence-aware planning. Product behavior, founder history, customer demand and analytics remain unverified. All outputs require owner review; no public action is authorized.

Three upstream skill bodies are installed as inert, namespaced Markdown references outside canonical skill discovery. Their full MIT notices, exact commits, declared versions and SHA256 digests are in [.agents/vendor/manifest.lock.yaml](../.agents/vendor/manifest.lock.yaml). The existing 29 canonical skills retain authority. `campaign-architecture` optionally consults content strategy/calendar references; `x-thread-writing` optionally consults thread craft for a requested local outline. `./gtm install audit` verifies reference/license bytes and canonical interface paths before planning. No linked sibling skill, referenced file, plugin, hook, script, provider or global configuration is activated.

| Upstream snapshot | Selection and audit decision |
|---|---|
| [Marketing Skills](https://github.com/coreyhaines31/marketingskills/tree/365b412152b9542499ca1439426f7fc3cc92bb65) | `content-strategy` 2.1.3, MIT. Use pillar and evidence questions; its statistics, growth advice and examples are not evidence for these brands. |
| [Social Media Skills](https://github.com/social-media-skills/skills/tree/f28cef2b7067ec64e79c9d85421c022c06659e03) | `content-calendar` and `thread-writer` 1.0.0, MIT. Use capacity/review rhythm and one-idea thread structure. Reject `x-growth`: unverified numeric algorithm claims and paid Premium assumptions. No WoopSocial publishing dependency activated. |
| [GTM Skills](https://github.com/composio-community/awesome-gtm-skills/tree/8c5f5794eb06dad32cc46811677142fbc8a15f4f) | BLOCKED_LICENSE. README says MIT, but no complete license notice exists in the tracked snapshot. No content copied, Composio dependency installed or account action attempted. |

The upstream audit report inventories every actual skill name, collisions against canonical names, executable and dependency/plugin manifest hashes, source risk signals, commit dates and excluded capabilities. It is a static audit, not a vulnerability or maintenance guarantee. Quarantine clones live under ignored `runtime/references/`. `python3 scripts/audit_upstream_skills.py` replays the inventory only if those clones match the reviewed pins; it never executes upstream code. No peer code was adapted into the runtime. Reference retrieval found the local `putSource` boundary; a thread-reference XERJ search failed on structured-field inference, so direct source review of `references/architecture.md:17` informed the question/example/constraint outline. Whole-project XERJ refresh failed on an existing PROJECT_STATUS file-family conflict; scoped package indexing succeeded (11 files, 122 records).

## Authorized-file ingestion

```bash
pnpm build
./gtm research ingest --brand retropick --source research/inbox/retropick/voice.json --offline
./gtm research daily --brand retropick --offline
./gtm strategy icp --brand retropick
./gtm campaign plan --brand retropick --days 30
./gtm content calendar --brand retropick --days 14
./gtm content brief --brand retropick --topic "How to verify a documented flow"
```

Repeat with the founder tenant and its own inbox files. `strategy plan` aliases `campaign plan`; `research sources` lists the same source report as `research daily`. `--from YYYY-MM-DD` selects a future plan/calendar start; `--source SOURCE_ID` optionally narrows a content brief. Plans support exactly 30 days, calendars exactly 14. No source input or selected brand means failure, not invented evidence. `research daily` reports NO_DATA when no cards exist; it does not fetch or schedule daily research. Unsupported later-phase commands remain blocked.

Each inbox JSON follows `SourceInputSchema` in `packages/research/src/index.ts`: ID/tenant, provenance URI/revision, observation/expiry, content SHA256, license, plain text, title, relevance, author/content timestamp and permission/basis. Inputs are at most 1 MiB; strict schema, duplicate-key checks, exact inbox paths and symlink rejection apply. `PROJECT_LOCAL` permits only the selected brand's AGENTS, VOICE, DESIGN, POSITIONING or MESSAGING bytes with a matching SHA256 revision and `OWNER_PROJECT_LOCAL_ONLY` license. This establishes **GOVERNANCE_ONLY**, never product or biographical truth. A changed local file makes old cards STALE_REVISION; a newly ingested revision can replace them as planning evidence without rewriting history.

`AUTHORIZED_FILE` is an owner-supplied excerpt for local analysis with a declared public HTTPS provenance URL, permission basis and license. It remains UNVERIFIED/SUPPLIED_TEXT_ONLY: its author, origin, permission and facts are not authenticated by the runtime. Restricted/private data collection is unsupported. No URL is fetched. Sources need current observation/expiry and a window of at most 90 days; ingestion never silently extends expiry. Cards, source/body hashes and append-only audit events persist in the existing tenant SQLite stores without a schema migration. The raw-text digest is distinct from the digest of the full card body.

Instruction patterns, normalized Unicode/HTML-encoded variants, common credential text and executable snippets are rejected before storage. This detector is a best-effort filter with false positives and misses. The stronger boundary is structural: source text is never executed, used as an instruction prompt, interpolated into generated copy or allowed to change policy. Encoded unknown text remains inert evidence and cannot promote factual claims. No LLM or provider is invoked.

## Reviewable outputs

The [RetroPick strategy](../output/sample-plans/phase-c-retropick.md), [founder strategy](../output/sample-plans/phase-c-founder.md), [RetroPick calendar](../output/sample-calendars/phase-c-retropick.md) and [founder calendar](../output/sample-calendars/phase-c-founder.md) are concrete owner-review drafts. Adjacent JSON files include all input/evidence hashes, expiry, methodology commits/licenses, audiences, status, constraints and text-only asset permissions. Each brand also has an ICP hypothesis and content brief. The plans contain 30 distinct local actions and measurement definitions; calendars contain 14 editorial slots including review/reserved days, each with proof requirements, owner/reviewer, CTA, source IDs and refresh gates. They are editorial proposals, with nothing scheduled.

Only current source cards are selected for planning; later dates explicitly identify sources that must be refreshed. Brand voice, design, positioning, messaging, profile and claims registry are read and fingerprinted for each output. Sources currently support editorial constraints only. The generator deliberately promotes no public facts from an unverified external excerpt or from arbitrary claims-ledger text. Briefs return BLOCKED_PENDING_TOPIC_PROOF until a future independently reviewed claim workflow can establish actual topic proof. No source URI, first-party label or ledger status alone is evidence that a product claim is true.

CLI outputs are immutable, hash-addressed JSON under `runtime/research/<tenant>/`. The save boundary checks document tenant, safe paths and existing file hashes. Provider calls/cost are zero; operator/model compute is NOT_MEASURED. No external media/assets are used. Existing B workflow execution remains SYNTHETIC contract fixtures; C planning is a separate implemented local path, not semantic execution of every workflow stage.

Reproduce samples with `pnpm build && node scripts/generate_phase_c_samples.mjs`. It uses the recorded evaluation time in `docs/evidence/phase-c-sample-clock.json` and fresh isolated sample state, preserving exact historical output bytes. It does not reset expiry for live use. The shipped example inputs expire seven days after observation; live CLI ingestion checks actual time and will reject expired examples. Prepare a newly observed, owner-authorized revision instead of backdating evidence.

Run `python3 scripts/verify_phase_c.py` for current type/build/runtime/governance/Python/security checks, sample replay and compiled CLI demonstrations. It preserves historical A/B receipts. Media rendering, live retrieval, provider identity, signed publication approval, analytics and end-to-end campaign execution remain D–F.
