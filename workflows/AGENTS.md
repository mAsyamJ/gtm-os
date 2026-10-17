# Workflows — AGENTS.md

Mission: Cross-functional orchestration. Tenant is mandatory. Root `AGENTS.md` always applies.

**Inputs:** typed job contract + tenant + source references + capability manifest.

**Outputs:** job checkpoints, state transitions, acceptance evidence and deterministic retries.

**Forbidden:** No self-approval, infinite retry or side-effect on dry-run.

**Validation:** evidence source and timestamps, claims policy, intended tenant, unique IDs, read-only external behavior, explicit final owner approval for any write.

**Handoff:** use the cross-department graph in `agents/ORCHESTRATION.md` and workflow definitions; `BLOCKED` rather than invented success.
