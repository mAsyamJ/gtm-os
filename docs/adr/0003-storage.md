# ADR 0003 — Separate tenant SQLite databases

Status: accepted design; implemented and tested in Phase B. Revision: phase-a-r1. Audience: storage/core implementers. Inputs: master prompt, local-first scope and ADR 0001. No assets or external actions.

Decision: use separate databases below gitignored runtime/state/<tenant>/, keeping tenant_id mandatory on records/references. Add migrations, transactions, durable job/checkpoint state, audit/cost events and idempotent outbox. No remote database or queue in the initial runtime.

Reason: physical separation reduces accidental cross-tenant joins and clarifies backup/access boundaries. SQLite fits the initial local deterministic workload without a service. Phase B pins better-sqlite3 13.0.3: its Node >=22 package has a bundled Linux binary and no install hook. The installed binary passed an actual SQLite 3.53.4 round trip; no native compiler/header download was needed.

Consequences: administrative totals explicitly aggregate scoped reads. Test cross-tenant rejection, recovery, resume and idempotency; back up consistent private state. Beads' embedded Dolt task database is separate, and its JSONL export is not storage/sync authority. Phase A created no GTM runtime database; Phase B migrations create revision 1 transactionally, use WAL/FULL synchronization and reject unknown schema revisions.
