# Asyam × RetroPick Founder-Led GTM OS — V2 starter scaffold

This is a **documentation-first, security-first starting repository**, NOT an installed or production-running agent platform. The Codex master prompt in `docs/MASTER_EXECUTION_PROMPT_V2.md` is the build specification. Files here are substantive governance, tenant definitions, skill triggers, role contracts and executable-workflow **definitions**, plus a standard-library scaffold checker. Actual APIs, renderers, OAuth, daemon jobs, analytics connectors, CI jobs and content assets must be implemented and tested by Codex in the owner's environment.

**Brand tenants:** `retropick` (@RetroPickMarket) and `founder` (@iHateModelsss). **No external side effects by default.**

## Preflight

1. Inspect your real current workspace, the existing dirty Git state, Codex version and installed skills. Merge this scaffold selectively, not blindly.
2. Run `python3 scripts/validate_scaffold.py` to validate documentation presence, JSON tokens, YAML-style skill frontmatter and workflow definitions (structural checks, not full schema validation).
3. Read `AGENTS.md`, `SKILLS.md`, `DESIGN.md`, `WORKFLOWS.md`, `docs/PLAN.md`, and brand-specific files.
4. Run Codex with the master prompt to build the real TypeScript app, install audited project-scoped dependencies, add tests, and run two offline dry runs.

**Status:** starter templates only. No real social account authentication, live research, production publishing, API billing, full implementations or active scheduled jobs are included.
