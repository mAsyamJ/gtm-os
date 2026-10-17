# ADR 0004 — Deterministic offline fixtures and closed execution

Status: implemented/tested in Phase B. Revision: phase-b-r1. Audience: core/policy implementers. Inputs: phase B's mock/offline requirement, tenant ADR and approval ADR. Owner authorized local implementation; no provider actions. Assets: no external media.

Decision: execute the existing instruction-only workflow stages as labeled deterministic JSON contract fixtures. Do not manufacture marketing copy, media or source support to impersonate later phases. Source IDs, content/definition/scoped-input hashes, checkpoint and audit references travel with each artifact. Synthetic source validity defaults to 24 hours; replay cannot refresh evidence silently.

Reason: this produces a working storage/workflow/CLI slice without confusing mock integration results with real GTM work. Requiring --brand on resume extends the master example to honor its stricter mandatory-tenant rule. Read-only aggregates/listings are explicit exceptions. The code retains manual tool declarations because real tools are not installed/verified here.

Execution remains impossible: approval-shaped object matching returns executable=false, publishing stages pause with a blocked outbox, and every adapter execute method denies unconditionally. Signed owner authority, receipt reconciliation and live adapter execution belong to Phase E and separate exact-action approval.

Consequences: AWAITING_APPROVAL is a durable local endpoint, not a deliverable signed approval or scheduled post. Stable-key replay verifies artifacts and inputs; changed/expired evidence requires a new run. SQLite immediate transactions atomically commit step metadata, costs and audit. Files written before a rolled-back commit are accepted on retry only if their deterministic bytes match. No irreversible external compensation is necessary in Phase B because no provider call exists.
