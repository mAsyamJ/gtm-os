# Codex GTM OS V2 — Phased execution guide

**Purpose:** Reduce implementation risk and context bloat by making each Codex invocation produce an auditable vertical slice. This document works with `FOUNDER_RETROPICK_GTM_OS_MASTER_PROMPT_V2.md` and the starter scaffold ZIP. The scaffold has not been installed on your machine. All external writes, X publishing, remote deployments and paid API calls remain disabled until separately approved.

## Installation onto your machine (local files only)

1. Download `Founder_RetroPick_GTM_OS_V2_scaffold.zip` and `FOUNDER_RETROPICK_GTM_OS_MASTER_PROMPT_V2.md` from ChatGPT.
2. In the machine where Codex runs, use a new isolated location (do not overwrite an existing repository):

```bash
mkdir -p ~/project/gtm
cd ~/project/gtm
# Replace the path below with the actual downloaded ZIP in your WSL/Linux filesystem.
unzip -n /path/to/Founder_RetroPick_GTM_OS_V2_scaffold.zip
cd Founder_RetroPick_GTM_OS_V2_scaffold
python3 scripts/validate_scaffold.py
```

3. Inspect `AGENTS.md`, `PROJECT_STATUS.md`, `docs/PLAN.md`, `docs/TOOLS_MATRIX.md` and the real existing Codex environment. The primary source prompt is already bundled at `docs/MASTER_EXECUTION_PROMPT_V2.md`.
4. For an all-in-one attempt (not recommended on resource-limited environments):

```bash
codex exec --sandbox workspace-write - < docs/MASTER_EXECUTION_PROMPT_V2.md
```

If your local Codex version uses different flags, check `codex exec --help` and use a supported restricted sandbox mode. Keep prompts scoped to the workspace; DO NOT run with unrestricted/global write permissions.

## Recommended session sequence

Use these short phase prompts in separate Codex sessions. Supply the existing master prompt as the governing implementation specification. Before every phase, check the active Git branch and dirty files; use explicit feature-branch commits without pushing or merging.

### Phase A — Reconnaissance + governance

> Read `docs/MASTER_EXECUTION_PROMPT_V2.md`, `AGENTS.md` and `PROJECT_STATUS.md`. Inventory the actual local Codex/Zodex/GLM/model router (read-only) and existing folder/branches. Compare real environment to scaffold. Produce `docs/ASSESSMENT.md`, `docs/PLAN.md`, pinned `docs/TOOLS_MATRIX.md`, `docs/SECURITY.md` and ADRs. Validate all nested AGENTS, SKILL.md frontmatter, workflow YAML. Do not install external software, modify other repos, spend, authenticate or publish. Run and report scaffold validation.

**Gate:** all 29 local skill definitions discoverable by project conventions, claim ledgers present, two brands distinct, no secrets leaked.

### Phase B — Deterministic core + local CLI

> Implement the typed schemas, per-tenant SQLite storage, workflow state machine and audit ledger in `packages/`. Build functional CLI `gtm doctor`, `gtm brand validate`, `gtm skills list`, `gtm workflow list`, `gtm workflow run ... --offline`, `gtm claims audit`, `gtm costs report`. Build mocks for all integration surfaces. Add Zod schema, unit, integration and policy tests. Do not touch global Codex configuration. No network writes.

**Gate:** tenant isolation, source traceability, idempotent status transitions, blocked external publishing by default, CLI tests green.

### Phase C — Curated skill installation + research / strategy

> Audit upstream Marketing Skills, Social Media Skills and GTM Skills against exact current versions, licenses, dependencies, scripts and existing skill names. Stage and pin ONLY the selected high-value skills with scoped triggers; do not bulk install. Implement source-card ingestion for authorized content, source expiry and content brief generator. Produce evidence-aware 30-day strategic plans and 14-day calendars for both brands. No fabricated source support. Update license manifest and tests.

**Gate:** upstream provenance pinned, negative prompt-injection tests pass, source claims traceable and the two brand voices remain distinct.

### Phase D — Creative studio

> Implement real graphics rendering with Satori/Sharp and safe fallback fonts/assets, plus local FFmpeg-based motion pipeline (video-shotcraft only if commercial eligibility and assets checked). Create at least three source-editable templates per tenant; render verified image sizes and a synthetic-labeled 15–30 second RetroPick promo with 16:9 and 9:16 formats, captions and thumbnail. Capture real public product UI only when it can be verified and safely redacted. Generate ffprobe/QC/asset license receipts.

**Gate:** tested image exports, no text clipping, no unauthorized branding claims, valid MP4 source outputs and licensing manifest.

### Phase E — Distribution + analytics, still offline by default

> Implement mocked/manual publication and official X account adapter boundaries; make identity verification, immutable approval, budget estimation and reconciliation tests pass without connecting to live accounts. Review official MCP/xurl docs and provider prices. Implement synthetic analytics/event dedupe, metric definitions, funnels, attribution constraints, weekly executive recap and landing page CRO proposal generator. Do not enter real credentials or make billable X calls.

**Gate:** impossible to post to wrong tenant, no unapproved writes even under retry/timeout, synthetic analytics visibly labeled, all external connections report honest status.

### Phase F — Two end-to-end campaign simulations and QA

> Execute real local dry-run workflows `feature-launch --brand retropick --offline` and `build-in-public --brand founder --offline`. Produce cited briefs, owner-reviewable X drafts, editable graphics, verified/demo-labeled video, QA packages, mock distribution approvals (not real signed approvals), synthetic analytics and audited costs. Document current command results and test counts. Do not publish, deploy or modify other repos. Return a receipt listing installed, blocked, not measured and next exact human authorization steps.

**Gate:** reproducible artifacts, true status reports and no external side effects.

## After MVP: user-mediated actions

- The owner reviews and authorizes accounts independently through official OAuth; the GTM OS verifies the current authenticated account identity. Do not share passwords/2FA or read `.xurl` secrets into model context.
- Only after verified X pricing/scopes and explicit account-specific approval may the system enable live publication for a single approved payload. The default paid API ceiling remains zero until changed with owner authorization.
- Production marketing website PRs/deployments, Postiz/Activepieces deployment and paid integrations require separate infrastructure approval.
- Weekly review can be scheduled later only if a secure, tested execution environment actually exists; the scaffold does not schedule anything.
