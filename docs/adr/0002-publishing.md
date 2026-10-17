# ADR 0002 — Immutable, identity-bound approval

Status: accepted design; Phase B always-deny execution implemented; live enforcement pending Phase E. Revision: phase-a-r1. Audience: policy/adapter implementers. Inputs: master approval contract, root policy and zero-spend defaults. No external action authorization or media assets.

Decision: fail closed without exact owner approval for canonical payload/media SHA256, tenant, platform/action, verified principal/expected handle, time window, current price snapshot, license/compliance review and maximum charge. Changed content invalidates approval. Current paid ceiling stays zero.

Reason: campaign/setup approval cannot authorize an altered post, another account, hidden charge or retry. Verify authenticated identity through the provider boundary before an eventual write. After timeout, reconcile receipts/idempotency state before retrying. Mock/manual previews are never live receipts or signed owner approvals.

Consequences: test the boundary offline before any connection. Later tests must cover wrong identity/tenant, changed/expired approval, unknown price, zero cap, duplicate execution and ambiguous responses. Phase A validated disabled declarations. Phase B adds a constraint-only approval matcher (always executable=false) and unconditional execution denial. A matching illustrative object is not authenticated human authority. No OAuth, live price assumption or signed approval exists.
