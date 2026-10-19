# ADR 0001 — Explicit tenant boundaries

Status: accepted design under the approved plan; implemented/tested for the Phase B offline core. Revision: phase-a-r1. Audience: core/security implementers. Inputs: master prompt and root/brand/account contracts. Approval: local work, no external actions. No assets adapted.

Decision: require retropick or founder on every tenant-specific command/object. Structural inventory and aggregate cost reports are administrative exceptions and never infer a tenant for a write. Resolve voice, evidence, design and expected account inside that scope. Cross-promotion requires distinct adapted artifacts and independent approvals.

Reason: shared infrastructure must not imply shared identity or authorization. Never infer tenant from a browser tab, working directory, copied draft or previous approval. Keep sources, accounts, assets, approvals and audit references tenant-bound.

Consequences: Phase A checks declarations only. Phase B rejects object/repository tenant mismatch and cross-tenant source/job references; stores validate their on-disk tenant before opening for writes. Expected handles are not authenticated IDs. ADR 0003 provides physical separation; ADR 0002 binds external authorization. No runtime isolation is claimed here.
