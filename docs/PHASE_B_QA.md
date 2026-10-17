# Phase B acceptance receipt

Revision: phase-b-r1, 2026-10-17. Audience: owner and next implementer. Inputs: master specification, phased guide, user continuation request, accepted ADRs and actual local tests. Approval: local Phase B only. Assets: labeled synthetic JSON fixtures, no third-party media. Runtime dependency sources/licenses/integrity are recorded in evidence/phase-b-dependencies.json; no public distribution approval is asserted.

## Reproduction

```bash
pnpm install --frozen-lockfile --ignore-scripts --store-dir runtime/pnpm-store
pnpm check
python3 scripts/verify_phase_b.py
./gtm doctor --json
```

Installation is scoped to this project. The verification runner itself installs nothing and makes no provider calls. It records lint/build, Vitest, governance/Python regressions, scoped scanner results, CLI transcripts, current source SHA256s and a manifest-bound receipt under docs/evidence/phase-b-*.json. Historical A receipts remain unchanged. Beads issue gtm-fff tracks this slice; the local branch is codex/gtm-phase-b with no remote operation.

## Acceptance coverage

| Gate | Implemented verification |
|---|---|
| Typed schemas | Strict tenant/data/config/workflow/source/job/artifact/cost/claim/approval/audit/outbox validation; malformed and extra-field negatives |
| Tenant isolation | Separate files; foreign-object and foreign-resume rejection; copied-database detection; SQL tenant constraint; private filesystem permissions |
| Traceability | Immutable source revisions/content hashes; linked source IDs and prior artifacts; file SHA256 and original audit linkage; no fabricated citations |
| State/idempotency | Legal transition/version checks; replay and restart/reopen safety; partial CLI checkpoint/resume; one blocked outbox record |
| Transaction recovery | Injected cost-insert failure rolls back artifact/checkpoint/cost/audit; leftover deterministic file safely recovered on resume |
| Publication policy | Execution always denied; changed/expired/wrong-principal/wrong-tenant/unknown-price/zero-budget approval negatives; no real or mock signed owner approval |
| Integration mocks | All 23 surfaces expose capabilities/identity/estimate/dryRun/audit; no fetch invocation; live identity null and provider price unknown |
| CLI | Compiled binary tests for required commands, both brands, JSON/exit codes, absent --brand/--offline, later-phase blocked boundaries, trace and read-only costs |
| Protected inputs/logs | No environment/auth files loaded; duplicate JSON/YAML, tags/aliases, symlinks/escape/size and sensitive-data negatives; value-redacted errors |

Runtime test count: **103 passing**. Existing Python governance/source-boundary tests: **38 passing**. Strict compiler lint and build pass. Exact final counts, exits and local CLI results are in the generated evidence; a failure must never be relabeled success. Gitleaks and Semgrep pass with zero findings on the approved source allowlist, with full secret redaction and local rules only; Semgrep scanned 18 production source files. Exact final coverage is in the scanner receipt. No dependency vulnerability-database or live provider security audit was performed.

## Usable output and limits

The real local feature-launch/retropick and build-in-public/founder demos produce six/five JSON artifacts respectively, backed by tenant SQLite records and verified file hashes, then stop at AWAITING_APPROVAL. These are not the Phase F end-to-end marketing campaigns: no real copy, graphics, video, signed approval or analytics is generated. JSON transcripts contain actual job/artifact paths for inspection. The paid-provider call count and project API charges are zero; operator model/compute costs and benchmark savings are NOT_MEASURED.

All global Codex/router settings and other production repositories remain unchanged. Installed dependencies and the pnpm store are local; no new Git hooks, upstream skills, account connections, public plugins, schedules, messages, posts, pushes, merges or deployments were enabled. Native SQLite works without running package install hooks. The lockfile is pnpm-generated multi-document YAML; dependency inventory reads both the package-manager and app documents.

## Handoff and rollback

Phase C is next: audited selected upstream skills, source ingestion/expiry, evidence briefs, strategies and calendars. Live actions still require separate identity/scopes/pricing, license review and exact owner authorization; Phase B permission cannot authorize them. Source fixtures expire after 24 hours and input changes block resume; start a newly reviewed run rather than mutating provenance.

For rollback, preserve local state and dirty work first, then revert the Phase B implementation commit on its feature branch. Runtime files are gitignored/private; do not delete another tenant's database or Beads history. Uninstall local dependencies by removing only this project's generated dependency/build directories when intentionally authorized; no global configuration migration is necessary.

Receipt assembly initially flagged an opaque synthetic demo idempotency key as a generic API key. Locations were verified against the public local replay arguments without printing values. The demo now uses short readable replay IDs; no scanner rules or findings were suppressed.
