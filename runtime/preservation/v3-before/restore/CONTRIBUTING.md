# CONTRIBUTING.md

Use feature branches and atomic changes; inspect dirty worktree first. Run `python3 scripts/validate_scaffold.py`, then (after runtime implementation) configured lint, typecheck, unit, integration, schema, visual and security tests. Require proof of tenancy checks and updated first-party sources for brand changes. Do not merge or deploy automatically. Any new third-party skill needs license, provenance, pinned release, malware/script review and narrowed trigger metadata.

Phase A verification: `python3 scripts/verify_phase_a.py` runs the validator, isolated unittest fixtures and allowlisted local scanners; it writes evidence and source hashes. No tool is installed automatically. For quick checks use `python3 -m unittest discover -s tests -v`. Dependencies are pinned in `scripts/requirements-validation.txt`. Do not add real secrets to fixtures or capture global configuration in reports.

Use Beads for durable issues; do not add markdown task lists or duplicate memory files. Implementation plans and ADRs describe contracts, not task-tracking state. Local-only Beads was initialized without Git hooks or a remote. Commit only allowlisted project sources and review `git diff --cached`; global ignores may hide AGENTS or .agents files, which require explicit staging. Preserve Windows download metadata locally; do not commit it.

Phase B: install exact local dependencies with scripts disabled and a frozen lockfile, then `pnpm check`. Use `python3 scripts/verify_phase_b.py` for B receipts/CLI demos; it preserves historical A evidence. `pnpm test` builds before running Vitest so compiled CLI tests use fresh code. `pnpm lint` uses strict compiler checks. Never infer real media or provider identity from a mock fixture.
