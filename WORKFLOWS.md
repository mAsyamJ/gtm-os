# WORKFLOWS.md — Operating map

Workflow YAML is stored in `workflows/definitions/`. Run specification validation before any execution. Until runtime modules exist, YAML is a design contract, not a scheduler.

## Global content lifecycle

`idea -> sourced_brief -> draft -> evidence_checked -> asset_created -> qa_passed -> awaiting_owner_approval -> approved -> queued -> published -> measured -> retrospective`.

All external writes are suspended at `awaiting_owner_approval` unless an exact-account, hash-bound approval has been independently verified. A changed draft returns to `draft`.

## Operating cadences

- Daily intelligence: evidence + competitor/community scan, read-only; no automated social engagement.
- Weekly GTM review: actual vs expected funnel, founder credibility outcomes, experiments, costs and decisions.
- Launch on demand: verified code/product feature -> GTM brief -> multi-format creative -> QA -> approved release -> measured outcome.
- Monthly: positioning/ICP refresh, compliance and spend audit, asset license review, skill updates by pinned diff.

## Cross-department handoffs

Research → verified source card → Strategy → campaign brief → Content → reviewed post → Creative → validated media → Compliance/QA → owner approval → Distribution → receipt → Growth Analytics → retrospective. Every stage has accountable owner, contract and failure path in `agents/ORCHESTRATION.md`.

## Failure handling

Auth unavailable -> manual/mock adapter; license uncertain -> asset/tool blocked; source stale -> reacquire evidence; API response ambiguous -> reconcile before retry; X account mismatch -> abort; risk policy violation -> pause entire affected queue and notify owner via current session record.
