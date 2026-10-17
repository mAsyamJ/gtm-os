# Implementation plan — Codex acceptance gates

**This ZIP is a documentation scaffold only.** Codex must inspect real on-machine repo and reconcile this scaffold before implementation.

- P0 Discovery: current tree + software + router, existing dirty Git, secrets NOT printed; assessment and tool matrix.
- P1 Governance: root/nested AGENTS, skills, roles, claims schema, brand profiles; structural validator passes.
- P2 Engine: typed schemas, SQLite tenancy, event/outbox + job state, CLI doctor/commands with tests.
- P3 Creative: 3 real working SVG/PNG templates/tenant, 15–30 sec deterministic MP4 demo with editable source and QA.
- P4 Distribution: mock/manual publishers, official OAuth adapter behind approval; no live writes on setup.
- P5 Analytics: synthetic reporting and first-party event audit; no invented numbers.
- P6 Workflows: two end-to-end offline dry-runs, checkpoint/resume, receipts, provenance, current tool/license audits.
- P7 Optional scale: Postiz/Activepieces/ComfyUI/Penpot only after cost, authorization, license and resource gate.

**Fail conditions:** cross-tenant confusion, forged evidence, unapproved external post/charge, missing asset license, invalid claims, non-idempotent replays, fake pass receipts.
