# V4 QA and acceptance

This report separates engineering verification, live connector evidence, editorial acceptance and business outcomes. A blocked stage is not a pass.

## Capabilities

Implemented: typed tenant/dataset-separated intelligence storage, immutable graph records, source policy and bounded public transport, two CSV seed import, source-review bindings, publication-date radar, configurable editorial ranking, selected briefs, multi-source content, bounded router claim selection, diagrams/prototype videos, eight V3 runtime workflow handlers and manual HOLD handoffs.

The source registry is intentionally narrow. Live collection and source review were exercised for both brands; local parser tests do not establish live RSS coverage. Full upstream Last30Days/Agent Reach provider orchestration remains inactive. Expertise/influence assessment is a review framework, not a measured social graph model. No automated publisher or scheduler is enabled.

## Evidence

- Preservation: `runtime/preservation/v4/20261019T163411197598Z/receipt.json`; 364 source files and four database backup/restores were checked.
- Product truth: [RetroPick capability ledger](../research/product/RETROPICK_CAPABILITY_LEDGER.md).
- Campaign/source/model evidence: [first sprint receipt](evidence/v4-sprint-2026-10-19T17-05-28-197Z.json).
- Fresh checks, historical evidence preservation, packet verification, resources and costs are recorded by `scripts/verify_v4.py` in a new append-only acceptance receipt.

## Required verification

```bash
pnpm check
python3 scripts/verify_v4.py
```

Offline tests cover tenant boundaries, seed distrust, exact publication cutoffs, future/unknown timestamps, graph immutability, quota exhaustion, URL/SSRF restrictions, robots delay semantics, post length, source selection, changed protected claims and selected-cycle recovery after unrelated source ingestion. Existing V3 tests remain required.

Final review regressions also cover unsafe claims selected during post-length fitting, identical text at another URI without an explicit review link, newest opportunity revision selection, frozen rolling publication evidence, stale windows and historical validation at the publication clock. The first full acceptance attempt captured the historical-clock regression; its failed receipt remains preserved. A later passing receipt supersedes it only for the tested source revision.

A regression also covers equivalent JSON key order: artifact identity is canonical, while existing historical bytes stay unchanged. Parser workers deny DNS/connection paths and execute only the reviewed parsing component. They never receive provider credentials, global Codex homes or evaluation answers.

Live acceptance requires two real reviewed core sources for each tenant, valid packet/source/media hashes, distinct brand drafts and successful source retrieval receipts. Offline fixtures do not substitute for these checks. Router task receipts establish actual admitted calls and deterministic output selection; they do not establish subjective writing quality or attributable dollar savings.

## Outstanding acceptance gates

| Stage | State |
|---|---|
| Engineering and regression | See latest append-only check receipt |
| Real source-to-packet pipeline | Two tenant packages exist; verify exact receipts and files |
| Source coverage across all eight pillars | Partial; evidence gaps remain |
| Fourteen fully current verified people | BLOCKED; current-role proof is incomplete |
| Human prose/authenticity/rights/creative review | HOLD |
| Owner publication and owned outcome measurement | BLOCKED |
| Verified growth/professional outcomes | UNAVAILABLE |
| Harness sealed evaluation and P6 promotion | BLOCKED; unchanged |

## Security and cost limits

No credentials were copied, rotated, printed or supplied to source parsers or Harness workers. Provider access remained inside the existing protected router. No X API, scraping, posting, outreach, paid fallback, onchain action, Git push or global skill/provider configuration change occurred. Temporary activation of existing router services supported the explicitly approved capped model calls.

Both existing router services were restored to their original inactive state after the six provider requests. Semgrep permits only the fixed loopback router health probe with a two-second timeout and redirects forbidden; other outbound-client matches remain findings under the existing rule.

The first-sprint model reservation ceiling is $0.10 estimated, with four calls/attempts per tenant/eight total. Actual subscription spend is unknown. Request/token counts in the sprint receipt come from the approved router report. HTTP counts include failed reservations; body bytes exclude TLS/header overhead. CPU/wall/RSS evidence describes local checking, not an end-to-end hosting bill.

Gitleaks/Semgrep are scoped source checks, not a complete dependency audit. The editor's normal runtime sandbox is not presented as a new adversarial OS isolation guarantee. Existing Harness isolation and holdout restrictions are preserved.

## Rollback

Stop invoking V4 handlers and preserve their append-only receipts. The new intelligence databases are separate from V3 observations/operations state. Use the verified source snapshot and matching database backups only with writers stopped and explicit target verification. No automatic destructive rollback is provided. Do not restore an old database over newly collected evidence without preserving the newer version first.
