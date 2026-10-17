# Phased implementation contract

Revision: phase-c-r1. Audience: owner/local implementers. Inputs: MASTER_EXECUTION_PROMPT_V2.md and PHASED_EXECUTION.md. Owner approved A/B and requested the next phase. C implements curated references and authorized-file research/strategy; D–F remain. Beads is the durable task tracker; this document defines gates, not a parallel backlog. No external assets used or public action authorized.

| Phase | Deliverable/dependency | Acceptance gate |
|---|---|---|
| A — governance | Reconcile scaffold, local tracking, tools/security assessment and validation | 29 unique skills, 16 workflow contracts, distinct tenants, zero-spend disabled defaults, regression/security checks |
| B — deterministic core | After A: TypeScript/pnpm/Zod, separate tenant SQLite databases, jobs/audit ledger, CLI and mocks | Runtime isolation, traceability, idempotent transitions, working offline CLI, blocked external actions |
| C — research/strategy | After B: source cards/expiry, evidence briefs and curated upstream references | Pinned commits/licenses/scripts, injection negatives, distinct sourced 30-day strategies and 14-day calendars |
| D — creative | After B and source/asset contracts: editable graphics/video | Three templates per tenant, sized exports/QC, synthetic-labeled landscape/portrait promo with probe/license receipts |
| E — distribution/analytics | After B: mock/manual boundaries and synthetic reporting | Identity/hash/approval/budget/reconciliation tests, event dedupe, disconnected live providers |
| F — campaign simulations | After B–E: both tenant workflows offline | Real reproducible artifacts, paused approval, safe resume/replay and honest cost/QA receipt |

Phase A preserves `python3 scripts/validate_scaffold.py`, adding `--root` for isolated fixture audits and `--json` for value-redacted findings. Exit codes: 0 pass, 2 invalid arguments, 4 missing validation/scanner dependency, 5 contract/security failure. Existing dependency versions are recorded in scripts/requirements-validation.txt; none were installed.

Tenancy and storage ADRs now have tested offline implementations. The approval matcher never enables execution; authenticated/signed provider approval remains Phase E. Preserve global Codex/router settings and existing runners. No dashboard, plugin activation, upstream catalog install or live account setup belongs to Phase A. Future capability/flag changes must update schemas and tests deliberately.

Evidence: ASSESSMENT.md, GOVERNANCE_REVIEW.md, TOOLS_MATRIX.md, SECURITY.md, QA_REPORT.md and evidence/. Reproduce checks before accepting a gate; missing evidence/tools/permissions remain BLOCKED. No false claims, tenant confusion, unapproved side effect or forged receipt is acceptable.
