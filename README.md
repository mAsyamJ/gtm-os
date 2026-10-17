# Asyam × RetroPick Founder-Led GTM OS — Phase A

Phase A provides reviewed governance, tenant contracts, 29 local instruction-only skills, 16 workflow definitions, a schema/policy validator, regression tests and bounded local security checks. The build specification is `docs/MASTER_EXECUTION_PROMPT_V2.md`; `docs/PHASED_EXECUTION.md` defines the phase gates. Runtime APIs, CLI, workflow engine, renderers, OAuth, analytics and content assets are not implemented.

**Brand tenants:** `retropick` (@RetroPickMarket) and `founder` (@iHateModelsss). **No external side effects by default.**

## Preflight

1. Inspect your real current workspace, the existing dirty Git state, Codex version and installed skills. Merge this scaffold selectively, not blindly.
2. Run `python3 scripts/validate_scaffold.py` for governance/schema checks. PyYAML 6.0.1 and jsonschema 4.10.3 were already installed here; pins are recorded in `scripts/requirements-validation.txt`. A missing dependency reports BLOCKED rather than installing anything.
3. Read `AGENTS.md`, `SKILLS.md`, `DESIGN.md`, `WORKFLOWS.md`, `docs/PLAN.md`, and brand-specific files.
4. Reproduce Phase A verification with the commands below. Runtime implementation begins in Phase B under a separate scope.

```bash
python3 scripts/validate_scaffold.py
python3 scripts/validate_scaffold.py --json
python3 -m unittest discover -s tests -v
python3 scripts/security_audit.py --json
python3 scripts/verify_phase_a.py
```

The last command records current results and source hashes in `docs/evidence/`. Security checks require the already installed Gitleaks and Semgrep binaries; missing tools report BLOCKED. Semgrep uses local rules only. No dependency download, account login or paid call is performed.

Validator options: `--root PATH` audits isolated fixtures; `--json` emits redacted findings. Exit codes: 0 pass, 2 argument error, 4 missing tool/dependency, 5 validation failure. Passing Phase A does not prove runtime tenant isolation or publishing safety.

See `docs/ASSESSMENT.md`, `docs/QA_REPORT.md`, `docs/TOOLS_MATRIX.md`, and `docs/SECURITY.md` for evidence/limits. Task tracking uses local Beads (`bd ready`, `bd show gtm-jhh`); no remote or hooks are configured. No social account identity, live feature claim, official palette, media asset or provider capability is verified by this setup.
