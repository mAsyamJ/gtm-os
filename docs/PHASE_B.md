# Phase B — deterministic local core

Revision: phase-b-r1 / CLI 0.2.0. Audience: owner and implementers. Inputs: approved Phase B request, master prompt, phase guide, A baseline and tenancy/storage/approval ADRs. Approval covers local code, scoped dependency installation, tests and synthetic demos only. No external write, account or paid-provider approval exists.

## Implemented behavior

`packages/schemas` exports Zod tenant/source/job/artifact/claim/approval/cost/audit/outbox/workflow contracts. `core` validates scoped project inputs and runs deterministic fixtures. `storage` owns separate `runtime/state/<tenant>/gtm.sqlite` files, transactional revision-1 migrations, immutable sources, job checkpoints, artifact/source links, blocked outbox records, cost records and an append-only hash-chained audit ledger. `policy` always denies external execution; its approval matcher checks constraints only and always returns executable=false. `connectors` plus `adapters` expose 23 mock/unavailable integration boundaries.

The pnpm app uses strict TypeScript 7.0.2, Zod 4.6.7, YAML 2.9.1, better-sqlite3 13.0.3 and Vitest 5.0.5. The SQLite package's bundled Linux binary worked on Node 24.11.0; it has no install lifecycle script. Dependencies are exact-pinned and the lockfile records registry integrity. All installation scripts were disabled. Installed metadata contains 44 packages and zero install lifecycle hooks; licensing and native/manifest hashes are in evidence/phase-b-dependencies.json. No upstream skill was installed.

## Interfaces and data flow

Use the project-local `./gtm` launcher after `pnpm build`, or `pnpm gtm`. The CLI supports doctor, install audit, skills/agents/workflow listing, brand show/validate, claims audit, offline workflow run/resume, audit trace and cost reports. `--brand` is mandatory for every tenant operation, including resume/trace; no cross-database search infers a tenant. Administrative lists and optional aggregate cost reports are explicit read-only exceptions. `--root` scopes a workspace; `--json` returns `{status,data}` with redaction. Exit codes follow the master contract: 0 local success, 2 input, 3 permission, 4 unavailable capability, 5 validation, 6 execution.

An offline run creates one typed SYNTHETIC source with a fixture URI, content hash, explicit revision and 24-hour validity. Each completed stage emits a real JSON file labeled SYNTHETIC and NOT_APPROVED. Its source references, prior artifact hashes, format, audience, asset license, revision and limitations are recorded. These files are contract demonstrations, not real copy, graphics, video or analytics. Renderer/provider stages use in-process mocks; no model, browser, FFmpeg, provider SDK or credential file is opened.

Checkpoint, artifact reference, source links, zero-charge cost entry and audit event commit together. A crash before database commit may leave an orphaned JSON file; resume accepts it only if deterministic bytes match. A committed artifact is checked against its source/stage/input chain, file digest and original audit event. Workflow definitions and scoped brand/policy/skill inputs are fingerprinted; changed inputs, expired sources, foreign IDs and corrupt artifacts block replay. Read-only workflows finish COMPLETED_LOCAL. Publishing stages pause AWAITING_APPROVAL with one BLOCKED outbox record, no signed approval, and no continuation to execution.

`--max-stages 1` returns a RUNNING checkpoint for interruption demonstrations. Reusing `--idempotency-key` returns/resumes the same inputs; conflicting workflow/source bindings fail. Completed and approval-paused jobs do not duplicate artifacts, audit events or costs on resume. The caller must use a new run/key when synthetic evidence expires; expiration is never silently refreshed.

## Security and limits

Tenant IDs are enum-validated; database metadata is checked before opening an existing file for writes. Tenant columns have SQLite CHECK constraints, source/job/artifact relations use foreign keys, writes use parameterized statements and immediate transactions. Database files are mode 0600 and tenant directories 0700. Symlinks, database hardlinks, path escape, protected credential paths, invalid JSON/YAML, duplicate keys, unsupported tags/aliases and unsafe config flags are rejected. SQLite schema versions other than 1 require an explicit future migration rather than silent downgrade.

The audit ledger has update/delete guards and a previous-hash chain. It detects tested corruption but is not an externally anchored signature: a local database owner with schema access can rewrite storage. No signed human approval is inferred from a matching illustrative object. External execution is unconditionally disabled even if a caller passes an approval-shaped object. Model/compute costs and savings remain NOT_MEASURED; zero USD records refer only to actual offline stages making no provider request.

Source ingestion/ranking/calendars, real marketing copy, media rendering/license verification, authenticated identity, receipt reconciliation, live analytics and full campaign simulations remain C–F. Their CLI boundaries return useful BLOCKED responses. `x auth status` reports NOT_AUTHENTICATED without probing credentials/accounts. `publish` and scheduling commands return permission exit 3, including --dry-run. No scheduler, daemon, public plugin or live integration was enabled.

## Verification and provenance

Run `pnpm check` for strict compiler checks, build/Vitest, governance regressions and local source scanners. `python3 scripts/verify_phase_b.py` records separate B receipts, performs both local tenant demos, checks artifact hashes, and preserves A evidence. See PHASE_B_QA.md for results and next boundaries. Fixtures use no external media; original scaffold redistribution licensing remains unspecified. Dependency license metadata is not a complete vulnerability or legal audit.

Reference work: existing MCP TypeScript SDK corpus, commit 9bc40e903fde15534ec06ff4c1347d47000dbe16, core-internal util/schema.ts:27–31, informed the validation-boundary approach. better-sqlite3 13.0.3 source commit dbc2ea1165fef1f599b9be12faea33fa5e9d7ffb, lib/methods/transaction.js:52, confirmed immediate transactions/savepoints and rollback on thrown errors. No peer code was copied. The old whole-project XERJ refresh refused a retained document's changed inferred type; fresh scoped Python (8 files/45 records) and SQLite library (23 files/48 records) indexes succeeded with no skipped code files.
