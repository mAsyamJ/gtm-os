# Runtime packages contract

**Scope:** packages/ typed local core. Root AGENTS.md is mandatory and cannot be relaxed.

**Source of truth:** master prompt, docs/PLAN.md, tenancy/approval/storage ADRs, config/defaults.yaml, selected brand contracts and workflow YAML.

**Allowed:** Build and test deterministic TypeScript, isolated tenant stores, offline artifacts, mock adapters and the local CLI. Every tenant operation requires an explicit tenant. Structural discovery and aggregate read-only cost reporting are administrative exceptions.

**Forbidden:** No credential reads, provider requests, paid APIs, external writes, global configuration changes or inferred public claims. Never treat a mock as a real capability or approval.

**Validation:** From root run `pnpm check`; use `python3 scripts/validate_scaffold.py` for governance. Require tenant, traceability, recovery/idempotency, redaction and publication-denial regressions.

**Owner and approval:** Owner retains exact-action authority. The requested phases authorize the local core and Phase C authorized-file research/strategy implementation; disabled flags stay disabled. No live retrieval or public claim verification is implied.

**Handoff:** Return typed artifacts, hashes and test receipts to QA/owner; missing live integrations remain BLOCKED. No agent can self-authorize an external action.
