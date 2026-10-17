# Adapter boundary contract

**Scope:** adapters/ implementation boundaries and local fixtures. Root AGENTS.md remains mandatory.

**Source of truth:** typed connector contract, root policy, selected tenant account mapping, immutable approval ADR and current capability manifest.

**Allowed:** Deterministic offline mocks and honest unavailable-provider boundaries. Expose capabilities, costEstimate, identity, dryRun and audit without opening network connections.

**Forbidden:** No live requests, credential inspection, paid calls, implicit identity assertions or mock owner approvals. No self-approved external execution.

**Validation:** From root run `pnpm check`, including adapter/tenant/policy contract tests. `python3 scripts/validate_scaffold.py` checks governance.

**Owner and approval:** Owner retains separate OAuth, provider, price and payload approvals. Phase B does not authorize any of them.

**Handoff:** Return SYNTHETIC mock receipts or BLOCKED capabilities to the core/QA; never claim real rendering, publishing or analytics.
