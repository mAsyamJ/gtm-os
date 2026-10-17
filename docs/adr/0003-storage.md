# ADR 0003 — Separate tenant SQLite databases

Status: accepted design; implementation pending Phase B. Revision: phase-a-r1. Audience: storage/core implementers. Inputs: master prompt, local-first scope and ADR 0001. No assets or external actions.

Decision: use separate databases below gitignored runtime/state/<tenant>/, keeping tenant_id mandatory on records/references. Add migrations, transactions, durable job/checkpoint state, audit/cost events and idempotent outbox. No remote database or queue in the initial runtime.

Reason: physical separation reduces accidental cross-tenant joins and clarifies backup/access boundaries. SQLite fits the initial local deterministic workload without a service. Select the actual Node binding in Phase B after native-build compatibility testing; no binding was installed by this ADR.

Consequences: administrative totals explicitly aggregate scoped reads. Test cross-tenant rejection, recovery, resume and idempotency; back up consistent private state. Beads' embedded Dolt task database is separate, and its JSONL export is not storage/sync authority. Phase A creates no GTM runtime database.
