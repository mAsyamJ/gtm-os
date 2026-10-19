# Phase C validation receipt

Revision phase-c-r1. Audience: owner/reviewer. Inputs and exact hashes: `docs/evidence/phase-c-sources.json`; machine result: `docs/evidence/phase-c-receipt.json`. Reproduce with `python3 scripts/verify_phase_c.py`. Outputs are local, text-only review drafts, NOT APPROVED; no external media/license grants or public permissions are inferred.

- 150 runtime tests: prior core checks plus 48 Phase C cases; the former Phase B research-unavailable case is replaced by actual Phase C behavior tests.
- 38 Python governance/input-boundary regressions, strict TypeScript lint, build and canonical scaffold validation.
- 22 compiled CLI demonstrations, including each tenant's ingest/report/ICP/plan/calendar/brief, missing inputs, and continued publication/auth denial.
- Byte-identical replay of both 30-day plans, 14-day calendars, ICPs and briefs using the recorded evaluation clock and exact local inputs.
- Gitleaks and Semgrep use scoped allowlisted local source copies; scanner counts/results are recorded in `phase-c-security.json`. No credential stores or upstream executable code are scanned/executed by this check.

Negative tests cover cross-tenant inbox/store/output references, fake local source bytes, source/body hashes, expiry/future dates/window bounds, stale revisions and refresh recovery, duplicate JSON keys, symlinks/traversal, unsafe provenance URIs, direct/Unicode/HTML instruction injection, sensitive metadata, unrecognized encoded text staying inert, vendor/license tampering, unsupported day counts, impossible/backdated starts and altered output files. Distinct audiences/voice/CTA/topics are asserted; public factual claims remain empty and nothing is scheduled.

The three selected upstream references preserve complete MIT notices and commit/version/body/license pins. Static inventories include actual names, collisions, scripts/plugin manifests, dependency signals and commit dates. Composio remains BLOCKED_LICENSE; `x-growth` is REJECTED. No upstream script, hook, global skill installation, live provider, account connection, paid API, public post, deployment or Git push occurred.

Limits: local governance verification proves exact bytes, not product truth. Authorized external excerpts retain UNVERIFIED status; there is no live crawler, independent semantic fact-checker or signed owner approval. Injection pattern detection is best effort; the structural no-execution/no-copy boundary prevents source instructions becoming authority. Sample clock replay proves historical reproducibility, not current source freshness. Brand claims/design remain provisional; briefs require topic proof and later phases remain unimplemented. Operator compute/model cost is NOT_MEASURED.
