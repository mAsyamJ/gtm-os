# Asyam × RetroPick Founder-Led GTM OS

## Start with V4 crypto intelligence

Use the [V4 operator manual and examples](docs/CRYPTO_INTELLIGENCE_OS.md),
[first two-brand HOLD sprint](docs/FIRST_LIVE_GTM_SPRINT.md),
[source coverage](docs/LAST30DAYS_SOURCE_COVERAGE.md) and
[QA/remaining gates](docs/CRYPTO_GTM_V4_QA.md). V4 adds typed intelligence,
bounded public collection and eight executable workflows on the V3 runtime.
Publication, measured outcomes and full watchlist verification remain gated.

## Start with V3

The current local implementation adds reviewed evidence, protected-claim editorial work,
creative packages, owner-only manual publication records, weekly scorecards and isolated
Harness² contract evaluation. Read the [detailed user manual](docs/V3_USER_MANUAL.md),
run the [complete synthetic example for both brands](docs/examples/V3_SYNTHETIC_WALKTHROUGH.md),
and keep the [CLI reference](docs/V3_CLI_REFERENCE.md) nearby. The
[acceptance report](docs/V3_ACCEPTANCE.md) states the remaining owner and evaluation gates.
Nothing publishes automatically. Existing authorized credentials remain in protected routing.

## Historical Phase D guide

The material below describes the earlier Phase D implementation. Use the V3 guides above
for current workflow routing: some V3 names overlap older definitions, and staged V3 names
take precedence rather than falling through to the legacy engine.

The local CLI supports authorized-file source cards, expiry, evidence-aware strategy/ICP/calendar/brief generation and three curated, licensed reference skills. Separate tenant SQLite stores preserve immutable sources and audit history. The workflow engine still executes its 16 definitions as synthetic JSON fixtures; Phase D adds local synthetic graphics/video rendering; OAuth, live analytics and publication remain later-phase work. The specification is `docs/MASTER_EXECUTION_PROMPT_V2.md`; gates are in `docs/PHASED_EXECUTION.md`.

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

Phase C usage, source input schema, licenses and limitations: [implementation notes](docs/PHASE_C.md). Review the [RetroPick plan](output/sample-plans/phase-c-retropick.md), [founder plan](output/sample-plans/phase-c-founder.md), [RetroPick calendar](output/sample-calendars/phase-c-retropick.md) and [founder calendar](output/sample-calendars/phase-c-founder.md). These are hypotheses with missing topic proof, NOT APPROVED public copy. Shipped source examples expire; live commands enforce actual time.

```bash
python3 scripts/validate_scaffold.py
python3 scripts/validate_scaffold.py --json
python3 -m unittest discover -s tests -v
python3 scripts/security_audit.py --json
pnpm check
python3 scripts/verify_phase_d.py
```

Phase D verification builds/tests, renders both media formats, checks a fresh video re-encode and browser pixels, and records D evidence in `docs/evidence/`. It makes no provider calls or installs. A/B/C receipts remain historical snapshots. Security requires existing Gitleaks/Semgrep and uses local rules. `lint` is strict TypeScript compiler checking, not an ESLint/style audit.

Validator options: `--root PATH` audits isolated fixtures; `--json` emits redacted findings. Exit codes: 0 pass, 2 argument error, 4 missing tool/dependency, 5 validation failure. Passing Phase A does not prove runtime tenant isolation or publishing safety.

See [Phase D implementation](docs/PHASE_D.md), [creative gallery](docs/PHASE_D_GALLERY.md), `docs/PHASE_D_QA.md`, `docs/PHASE_C_QA.md`, `docs/PHASE_B.md`, `docs/TOOLS_MATRIX.md`, and `docs/SECURITY.md`. Beads issue `gtm-fc4` tracks this slice; no remote/hooks are configured. No live account identity, product claim, official palette, media asset or provider capability is verified by this setup.
