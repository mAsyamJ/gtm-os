# Runtime packages contract

**Scope:** packages/ typed local core. Root AGENTS.md is mandatory and cannot be relaxed.

**Source of truth:** master prompt, docs/PLAN.md, tenancy/approval/storage ADRs, config/defaults.yaml, selected brand contracts and workflow YAML.

**Allowed:** Build and test deterministic TypeScript, isolated tenant stores, offline artifacts, mock adapters, synthetic Satori/Sharp exports, fixed local FFmpeg/ffprobe argv without a shell, and the local CLI. Every tenant operation requires an explicit tenant. Structural discovery and aggregate read-only cost reporting are administrative exceptions.

**Forbidden:** No credential reads, provider requests, paid APIs, external writes, global configuration changes or inferred public claims. Never treat a mock as a real capability or approval.

**Validation:** From root run `pnpm check`; use `python3 scripts/validate_scaffold.py` for governance. Require tenant, traceability, recovery/idempotency, redaction and publication-denial regressions.

**Owner and approval:** Owner retains exact-action authority. The requested phases authorize the local core, C authorized-file research/strategy and D synthetic local media implementation; disabled flags stay disabled. No live retrieval or public claim verification is implied.

**Handoff:** Return typed artifacts, hashes and test receipts to QA/owner; missing live integrations remain BLOCKED. No agent can self-authorize an external action.

**V3 authorization:** The owner's final amendments authorize project-local V3 implementation, explicit reviewed keyless public-source reads, and reuse of existing protected router admission. Credentials are handled only inside established routing mechanisms; this package never imports their values. V3 source-reviewed editorial geometry may use licensed existing renderers without claiming product UI footage. All external account writes remain disabled. See packages/v3/AGENTS.md for evidence, manual state and dataset contracts.

**V5 authorization:** The owner's V5 master prompt and approved plan authorize the separately scoped `packages/v5` Buffer publisher. Only its dedicated publisher runtime may load its own Linux service credential. Exact tenant/channel/payload/slot/rights/cost approval and explicit execution remain mandatory; see packages/v5/AGENTS.md. Existing V3/V4 manual packets, approvals and disabled paths remain historical contracts and grant no Buffer authority.
