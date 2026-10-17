# Asyam × RetroPick Founder-Led GTM OS — Phase B

The local CLI and deterministic core execute 16 workflow definitions as synthetic JSON fixtures. Zod validates runtime contracts; separate tenant SQLite databases hold immutable sources, jobs/checkpoints, artifact references, blocked outbox entries, costs and a hash-chained audit ledger. Real research/content generation, media rendering, OAuth, live analytics and publication remain later-phase work. The specification is `docs/MASTER_EXECUTION_PROMPT_V2.md`; gates are in `docs/PHASED_EXECUTION.md`.

**Brand tenants:** `retropick` (@RetroPickMarket) and `founder` (@iHateModelsss). **No external side effects by default.**

## Preflight

1. Inspect your real current workspace, the existing dirty Git state, Codex version and installed skills. Merge this scaffold selectively, not blindly.
2. Run `python3 scripts/validate_scaffold.py` for governance/schema checks. PyYAML 6.0.1 and jsonschema 4.10.3 were already installed here; pins are recorded in `scripts/requirements-validation.txt`. A missing dependency reports BLOCKED rather than installing anything.
3. Read `AGENTS.md`, `SKILLS.md`, `DESIGN.md`, `WORKFLOWS.md`, `docs/PLAN.md`, and brand-specific files.
4. Use Node 24.11+ (24.x) and pinned pnpm 12.4.2. Install project dependencies with `pnpm install --frozen-lockfile --ignore-scripts --store-dir runtime/pnpm-store`, then `pnpm build`. No lifecycle scripts or global link/install are required.

## Local CLI

```bash
./gtm doctor --json
./gtm brand validate --brand retropick
./gtm skills list
./gtm workflow list
./gtm workflow run feature-launch --brand retropick --offline
./gtm workflow run build-in-public --brand founder --offline
./gtm workflow resume JOB_ID --brand founder --offline
./gtm claims audit --brand retropick
./gtm costs report
./gtm audit trace --brand retropick --job JOB_ID
```

`pnpm gtm ...` also works. Every tenant operation, including resume/trace, requires `--brand`; structural discovery and aggregate read-only costs are administrative exceptions. `--json` emits redacted output; `--root PATH` selects a workspace. `./gtm --help` lists arguments and later-phase blocked boundaries.

Runs create `runtime/state/<tenant>/gtm.sqlite` and `runtime/artifacts/<tenant>/<job>/`. Launch/build-in-public pause at AWAITING_APPROVAL without a signed approval or posting path. COMPLETED_LOCAL means synthetic fixtures finished, not a completed marketing campaign. `--max-stages 1` demonstrates durable interruption; `--idempotency-key KEY` replays the same immutable inputs. Sources expire after 24 hours; use a new run/key after expiry. Changed workflow, scoped instructions or artifacts block resume.

## Verification

```bash
python3 scripts/validate_scaffold.py
python3 scripts/validate_scaffold.py --json
python3 -m unittest discover -s tests -v
python3 scripts/security_audit.py --json
pnpm check
python3 scripts/verify_phase_b.py
```

Phase B verification builds/tests, performs local CLI demonstrations, verifies artifact hashes, and records separate B evidence in `docs/evidence/`. It makes no provider calls or installs. A receipts remain historical snapshots; do not overwrite them merely to verify B. Security requires existing Gitleaks/Semgrep and uses local rules. `lint` is strict TypeScript compiler checking, not an ESLint/style audit.

Validator options: `--root PATH` audits isolated fixtures; `--json` emits redacted findings. Exit codes: 0 pass, 2 argument error, 4 missing tool/dependency, 5 validation failure. Passing Phase A does not prove runtime tenant isolation or publishing safety.

See `docs/PHASE_B.md`, `docs/PHASE_B_QA.md`, `docs/TOOLS_MATRIX.md`, and `docs/SECURITY.md`. Beads issue `gtm-fff` tracks this slice; no remote/hooks are configured. No live account identity, product claim, official palette, media asset or provider capability is verified by this setup.
