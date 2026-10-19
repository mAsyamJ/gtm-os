# EXECUTE — CODEX FOUNDER × RETROPICK GTM OS V3
## API-Minimal, Capability-Reusing, Evidence-Based, Self-Improving Marketing Harness

**Date:** 19 October 2026  
**Mode:** Implement locally with verified evidence. No paid API calls or public social-account actions without separate exact approval.  
**Role:** Principal GTM engineer, founder-led growth strategist, DevRel/technical writer, social editorial director, market intelligence researcher, creative director, video editor, analytics engineer, agent runtime architect, security reviewer, and harness evaluation engineer.

### Mission and definition of success

Upgrade the EXISTING Founder/RetroPick GTM OS, reusing EXISTING GLOBAL Codex/Zodex skills, MCPToon, Agent Reach, Scrapling, Last 30 Days, Humanizer, Marketing Skills, routing, and tools. **DO NOT start a new OS from scratch or bulk reinstall globally.** Implement a trustworthy research → strategy → sourced content → human voice → creative → quality review → owner-approved manual/platform-native publication → outcome measurement → learning system. Integrate `https://github.com/google-research/harness2` as an **isolated harness improvement lab**, first for global agent capabilities via staged proposals, then for project-local GTM tasks. Separate research ability from authorization to operate third-party websites.

**Two tenants** (never combine identifiers, writing voice, audience data, metrics, credentials, publishing identities, or approvals):
1. `retropick`: X `@RetroPickMarket`; product `https://retropick.xyz/launchpad`; source `https://github.com/RetroPick/retropick-protocol`. Primary business outcomes: qualified trader/creator awareness → first legitimate product exploration → wallet-connection completion (if currently supported) → verified activation → retention. Prediction markets/crypto are financially sensitive: verify routes, available assets, claims and relevant geographic/legal constraints before any promotional assertion.
2. `founder`: Asyam Jayanegara; X `@iHateModelsss`; source of attributable engineering work `https://github.com/mAsyamJ`. Primary outcomes: useful engineering authority, organic engagement from relevant builders, open-source adoption, founder network, high-quality collaborations/inbound. First-person posts MUST be supported by user-approved actual experience and verifiable achievements; NO fake founder backstories.

**Non-negotiables**:
- External paid API spend defaults `$0`; unknown-priced network calls are blocked. Existing model subscription routing is separate from social/platform API pricing. No cost-saving claim without measured per-success benchmarks.
- `PUBLISH_ENABLED=false`, `AUTO_ENGAGE_ENABLED=false`, `ADS_ENABLED=false`, `X_API_ENABLED=false`, `SCRAPE_X_ENABLED=false`, `HARNESS_PROMOTION_ENABLED=false` at launch.
- Do not scrape X via browser/cookie APIs to bypass X's paid APIs: X terms prohibit crawling/scraping without prior written consent; owner login does not negate provider terms. Agent Reach or Last30Days may offer such mechanisms, but keep X-specific automation disabled pending explicitly verified permission. Use consented exports, manually captured research, publicly licensed sources, or authorized official X paths. Do NOT automate browser posting via stealth scripts. Owner may use X's own interface manually and its native scheduling functionality if available. No mass DM, mass follow, cross-account amplification, fake engagement, or deceptive reply bots.
- Agent Reach and Scrapling MAY be used for public websites where crawling is permitted; honor robots.txt where applicable, ToS, rate limits, copyright, personal-data restrictions, and anti-bot gates. DO NOT activate stealth, fingerprint impersonation, CAPTCHA bypass, cookie extraction, or proxy rotation to overcome protections. No bulk ingestion of private conversations or personal data.
- No external writes (post, schedule, DM, comment, reply, follow, ad buy, PR merge, production deployment) without account, exact rendered payload/content hash, preview, permission, and user approval. A generic request to build this system IS NOT such approval. Manual publishing is the v3 default.
- Do not echo, search-index, import into models, or copy credentials from historical logs. Supplied progress log contains an exposed Z.ai key: report rotation as a mandatory blocker and follow secure credential replacement procedure. Never copy raw history into the research corpus; use sanitized structured excerpts.
- Preserve `~/.codex`, `~/.zodex`, `~/.hermes`, existing `codex-auto`, CCR, protected proxy and all session histories. Never override global provider defaults or overwrite global `AGENTS.md` automatically.
- Never run external repo installation scripts or third-party SKILL instructions before provenance/license/dependency audit. Never clone upstream repository into a production path and auto-execute hooks. No indiscriminate `npx skills add ... --global`.
- No existing website design change without permission. No false product UI, fabricated real metrics, APR, trades, users, volumes, partnerships or verified accounts.
- **All Harness² benchmark executions must be isolated**: upstream documents that Codex executor disables its sandbox and enables unrestricted network. Do not run its benchmark executor on real worktrees with authenticated tools, keys or unrestricted internet. Use a separate unprivileged OS identity/ephemeral container with no sensitive mounts, network allowlist/offline fixtures, filesystem quotas, CPU/memory limits, output promotion gate, and disposable credentials (prefer none). If isolation is impossible, RUN ONLY safe local `harness2-demo` and implement a synthetic in-process PPC-compatible experiment harness without running the upstream Codex executor.
- No global harness updates from benchmark results without verified improvement, independent regression tests and explicit approval. Regression > minor benefit; roll back reliably.

---

# A. Known baseline — VERIFY, don't assume live state

The *supplied historical logs* (not current live observations) show:
- GTM project under `/home/ubuntu/project/gtm/gtm-os`. Phase A: governance in commit `36d4a04` (38 tests); Phase B: typed TypeScript/Zod/SQLite workflow engine and CLI in `897aa61` (103 runtime/38 governance); Phase C: source cards, plans and calendars in `d2962c1` (150 runtime/38 governance); Phase D: six editable templates, 24 graphic exports, two 20-second silent captioned demo renders in `1840d49` (168 runtime/38 governance). Phase E started: local distribution approval store and synthetic attribution modules edited, but attached log ends before final acceptance/commit. Phase F not verified.
- Global control plane `/home/ubuntu/agent-control-plane`: `agentctl status`, `agentctl capabilities resolve`, `agentctl doctor`, `agentctl costs`; reported MCPToon 0.8.22, 17 audited repositories, 18 specialists, 113 skill adaptations, 73 passing control-plane tests, 20/20 routing fixtures, an isolated successful Economy patch-test-promotion smoke. These numbers represent prior execution and must be revalidated; different reports enumerate 113/114 owned entries and 131 registry capabilities, so reconcile definition/count rather than summing them.
- Existing model router under `/home/ubuntu/codex-model-router`: 40 regression tests; production default not migrated, GLM/Premium/Zodex issues and CCR security advisory remained; savings unproven.
- Existing global skills include Marketing Skills, Humanizer, Agent Reach, Last30Days, Scrapling, MCPToon, design and SEO skills and more, with varying levels of actual availability and risk. Discovery and completed installation do not prove working external capabilities.

**FIRST TASK:** read the actual local versions/status receipts of all three workspaces, inspect feature branch and file state, and produce `docs/GTMMIGRATION_V3_BASELINE.md` listing VERIFIED / INSTALLED_UNVERIFIED / MOCK_ONLY / BLOCKED / CANDIDATE per capability. Check current branch worktree before any edits. Reuse existing package conventions, build commands and tests. Never clobber Phase E edits.

Read-only initial commands, when they actually exist:
```
pwd
git status --short --branch
./gtm doctor --json
python3 scripts/validate_scaffold.py --json
agentctl status
agentctl doctor
agentctl capabilities resolve 'research DeFi market launches, cited sources'
agent-reach doctor
codex mcp list
```
Do not invoke a command absent from PATH as if it succeeded; record that boundary instead.

---

# B. Ownership model and layered architecture

```
                         HUMAN OWNER
                  brand voice / fact approval
                  manual publication / access
                               |
                    GTM PROJECT ORCHESTRATOR
                `gtm` CLI, current tenant, workflows
                               |
          +--------------------+---------------------+
          |                    |                     |
    GLOBAL CONTROL       TENANT CONTENT         HARNESS LAB
  agentctl + MCPToon    evidence + SQLite      isolated Harness²
  discovery/selection   calendar + assets      candidate → probe
  existing router       tenant policy          adjudication → PR
          |                    |                     |
     tools/adapters        QA and preview       experiment receipts
          |                    |                     |
   allowlisted sources   OWNER native posting    human gate before
   no X unauthorized     and metrics import     global promotion
```

Authority boundaries:
- `agentctl` is global capability registry/selector: pick existing specialist + at most two task-relevant skills and bounded tools; may not approve publication, mutate tenant facts or silently escalate spending.
- `MCPToon` owns compact lazy discovery, NOT marketing policy.
- `codex-model-router` owns inference model selection/call limits (when working), NOT marketing policy or source trust.
- `gtm` engine owns brand selection, evidence, workflows, content objects, artifact hashes, approval/outbox, spend admission for marketing providers, metrics and revision.
- `harness-lab` owns experiments on clones/fixtures; never a controller with direct social account access.
- Owner owns external account authorization, sign-in, publication and any global rollout.

Every invoked task carries `tenant_id`, `campaign_id`, `task_id`, `source_card_ids`, `required_capabilities`, `allowed_tools`, `side_effect_class`, `budget`, `model_route`, `reproducibility_seed`, and `approval_state`. Capability resolver output MUST pass through tenant permission gate and fail closed if a tool's behavior is unknown.

---

# C. Capability and skills audit — do NOT reinstall already-working tools

Audit these actual URLs, local paths, checksums, licenses and command behavior:
- Core marketing: `https://github.com/coreyhaines31/marketingskills`; existing adapted content-strategy, product marketing context, customer research, launch, copywriting, copy-editing, SEO, CRO, analytics. Don't vendor duplicated ambiguous skill triggers.
- Social editorial: `https://github.com/social-media-skills/skills`; pick only useful thread, hooks, calendar, social-strategy and distribution references after fact review.
- Humanizer: `https://github.com/blader/humanizer`; language polishing only after sourcing; never modify claims or personal first-person details. Verify global activation path and current version.
- Research: `https://github.com/Panniantong/Agent-Reach`; verify *Git-based actual installation*, not the unrelated PyPI package called agent-reach. Run `agent-reach doctor` only for allowed channels and classify each capability by required auth/source policy. Use public web/RSS/YouTube/GitHub where permitted. X read/search via browser cookies is NOT approved as a workaround.
- Freshness: `https://github.com/mvanhorn/last30days-skill`; local/public keyless Reddit (where compliant), Hacker News, GitHub, arXiv, Techmeme, public sources. Its X options include browser cookies or paid provider APIs: disabled by default, not promised free/compliant. Check exact version, provider backend, source timestamps, dedup and cache policy.
- Extraction: `https://github.com/D4Vinci/Scrapling`; prefer basic HTTP `Fetcher` on explicitly allowed hosts. Its stealth/dynamic modes exist but may not be used to defeat site policies or auth gates. Verify installed version/MCP command/API: no guessed imports.
- Compact capabilities: `https://github.com/activeing123/mcptoon`; existing MCPToon global authority; audit but preserve.
- Market research: first-party product site, approved partner documents, SEC/regulator public materials if relevant, product repo releases, verified docs, allowed RSS, public GitHub activity.
- Organic analytics / SEO: Open SEO, Claude SEO, Lighthouse CI, local site analytics; inspect actual compatibility and avoid paid external backlink/index APIs by default.
- Graphic: existing Satori/Sharp, Impeccable, diagram-design, FFmpeg/Playwright. Avoid reinstalling previous Phase D dependencies.
- Creative/video optional: Motion Canvas, Remotion/video-shotcraft only if license allows, Editly, ffmpeg, Piper, whisper.cpp, ComfyUI only after local hardware, attribution, license and cost review.
- **Harness²**: `https://github.com/google-research/harness2`; Apache 2.0 core, with separately licensed included benchmarks. Integrate as optional isolated improvement engine; `--substrate cx` supports Codex on upstream benchmarks; custom GTM benchmark adapter is YOUR integration work, not a built-in Harness² benchmark.
- Evaluate optional Paperclip/Headroom/AgentQL/TinyFish/Reverse-Engineer-Anything as reference or sandboxed candidates only if genuinely beneficial; avoid provider wrappers that silently use paid inference.

For each discovered skill/MCP/tool store manifest:
`id, canonical_repo, local_path, installed_version, git_commit, sha256, license, last_audit_at, data_access_class, authentication_path, billing_path, ToS_risk, capabilities, limitations, executable_commands, test_result, duplicate_of, trust_state, tenant_allowlist, recommendation`.
Statuses: `ACTIVE_VERIFIED`, `INSTALLED_NOT_VERIFIED`, `REFERENCE_ONLY`, `QUARANTINED`, `DISABLED_POLICY`, `MISSING`, `BLOCKED_CREDENTIALS`, `BLOCKED_PAID`.

Implement `gtm skills audit`, `gtm capabilities plan --brand <tenant> --task '<text>'`, `gtm capabilities doctor`, `gtm skills dedupe`, `gtm integrations costs`, with JSON output. Build command implementations/test them; don't only write docs. **Never install all candidates reflexively.** Activate missing ones only after version/license/runtime/security audit, and add no global override without the explicit global-promotion gate.

Tool-selection ranking: domain relevance (0.30), verified operation (0.25), provenance/trust (0.20), token/compute budget (0.10), output quality evidence (0.10), latency (0.05), with HARD exclusion before ranking for authorization, paid call, untrusted source or provider terms. Tune on fixture benchmarks. Avoid exact claims about savings from these weights alone.

---

# D. Repository governance redesign: extend existing tree in place

Preserve current root `AGENTS.md`, `SKILLS.md`, `DESIGN.md`, `WORKFLOWS.md` and nested AGENTS.md; do not erase. Add/extend these where needed:
```
AGENTS.md                         # authority and action boundaries
SKILLS.md                         # skill directory, triggers, sources, evaluated status
DESIGN.md                         # brand-specific creative quality/visual QA
WORKFLOWS.md                      # workflow index and phase state machines
BRAND_SYSTEM.md                   # tenant-specific fact/voice/design ownership
EDITORIAL_POLICY.md               # evidence, humanization, voice, disclosure, originality
GROWTH_METRICS.md                 # funnel definitions and attributable outcomes
HARNESS_POLICY.md                 # global vs project promotion, regression gates
PROJECT_STATUS.md                # current verified status only
.agents/skills/                    # task-scoped SKILL.md, avoid duplicates
.agents/vendor/                    # pinned inert references, manifests
agents/roles/                      # scoped role contracts
brands/{founder,retropick}/        # voice, position, claims, actual brand assets
research/{sources,briefs,topics}/  # trusted source cards + trends
content/{briefs,drafts,reviewed,ready,published-manual}/
creative/{templates,project-files,renders,qa}/
distribution/{calendars,manual-checklists,receipts}/
growth/{events,attribution,experiments,reviews}/
relationships/{founder,partners,community}/
workflows/definitions/             # registered pipeline machines
harness/
  docs/{DESIGN,SECURITY,BENCHMARKS,PROMOTION,RUNBOOK}.md
  fixtures/{global,founder,retropick}/
  candidates/                       # experiment snapshots, isolated
  adapters/                         # Harness² API/CLI integrations
  evaluations/{quality,claim-safety,voice,workflow,creative}/
  promotions/{project,global}/       # staging/approval, never direct activation
  runs/                              # source-hashed, redacted receipts
config/{features,tenants,source-policy,model-compatibility}.yaml
scripts/{doctor,verify,rollback,...}
tests/{unit,integration,regression,adversarial,e2e}/
docs/evidence/
```

Nested `AGENTS.md` must specify exact scope, responsible agent, trusted facts, permitted operations, required skill paths, expected artifacts and test commands. Never relax root restrictions. `SKILLS.md` is a catalog; executable skills need distinct `SKILL.md` with valid Agent Skills metadata and narrow triggers.

`DESIGN.md`: keep actual founder/RetroPick palettes provisional until brand assets are verified; template tokens not approximate production brand. Require editable SVG/timelines, legibility at mobile sizes, real UI proof, subtitles, 16:9 and 9:16, image/video provenance, proper financial risk disclaimer and alt text. Humanizer must not rewrite onchain risk statements into promises.

---

# E. Twenty GTM workflows — implement as deterministic stage contracts

Each workflow has `id`, tenant allowlist, intent, trigger, inputs, source policy, skills, tool resolver query, stages, budget, approval requirement, outputs, KPIs, evaluation fixture, incident recovery, and checkpoint/idempotency. Do not just describe; implement first four fully and preserve the rest as valid, honestly-staged definitions.

1. `daily-market-intelligence` — Agent Reach allowed RSS/YouTube/GitHub + Last30Days allowable keyless research → timestamped themes, competing opinions, impact; never rely on unsupported X scraping.
2. `weekly-competitive-intelligence` — validate public product messaging and releases → competitor matrix + evidence; no unverified user or volume counts.
3. `founder-voice-calibration` — owner-approved authentic first-person writing samples → tone profile and regression checks.
4. `retropick-positioning-refresh` — repo/release/product evidence → message hierarchy → owner review.
5. `founder-tech-thread` — verified engineering fact → outline → researched thread → humanizer → claim QA → cover diagram → owner-ready post.
6. `retropick-feature-launch` — verified shipped feature → screenshot/fixture → narrative → post/thread/image/video → disclaimer → approval.
7. `build-in-public` — commits/PR evidence → progress lesson → first-person draft; no invented personal effort.
8. `educational-series` — verified mechanism education, non-advisory → reusable carousels/microclips.
9. `daily-social-editorial` — calendar backlog → hooks, variants, sources → drafted queue; no online writes.
10. `weekly-content-batch` — content pillars → 7–14 day two-tenant calendar → multi-format kit → reviewed handoff.
11. `community-listening` — allowed public sources plus manually supplied social observations → theme clustering; no DMs, fake consensus or secret collection.
12. `community-replies-assist` — owner-pasted thread/context → truthful one-off reply suggestions; no bulk automatic replies.
13. `developer-relations` — verified code changes, SDK use cases, tutorials → open-source content → owned channels.
14. `seo-answer-engine-audit` — allowed first-party pages, local crawl/structured metadata → issues and reviewed PRs, no auto deploy.
15. `landing-page-cro` — confirmed funnel and session data → hypotheses, variants, test instrumentation, PR, rollback plan.
16. `product-demo-studio` — authorized test frontend → deterministic capture, motion, captions, editable source and ffprobe QA.
17. `viral-hooks-lab` — generate bounded hooks grounded in actual sources; reject clickbait/unsupported exaggeration, evaluate human preference.
18. `partnership-brief` — public organization/company research → personalized, accurate outreach draft only; no unsolicited automation.
19. `weekly-growth-retrospective` — manual/first-party metrics + attributable outcomes → content/campaign scorecard → next-week strategy.
20. `harness-feedback-loop` — compare workflow outcomes → propose local skill/rule changes → sandboxed baseline-vs-candidate evaluation → gated adoption.

Every stage artifact has immutable `sha256`, origin source cards, evaluation record, stage result and next-owner handoff. Differentiate draft from owner-approved and manually published. Halt missing sources as `EVIDENCE_GAP`, not hallucination. Editing a post invalidates prior hash-based approval. Manual published receipts require owner-supplied post URL or reliable first-party confirmation; no fabricated scheduling/publishing success.

---

# F. Zero-social-API publishing and metrics path

**Publishing boundary:**
1. Codex creates post content, crop sizes, alt text, source references, disclaimers, optional post variants, and one exact `publishing-package.json` per tenant.
2. QA checks facts and brand tone; preview is rendered and hash committed.
3. Owner approves exact hash/account; outputs `distribution/manual-publish/<draft-id>/` including `post.txt`, `thread.md`, `images/`, `video/`, `alt.txt`, `schedule.ics` optional, and `instructions.md`.
4. Owner signs in to X and publishes (or uses native scheduling) from the correct account. No software-driven X posting or anti-bot automation.
5. Owner supplies public post URL or exports owned analytics manually. The importer validates tenant, URL/handle, timestamps, metrics schema and origin, dedupes observations, and stores receipts.
6. Weekly report calculates metrics with explicit source quality, missing-data caveats and content attribution. Do not infer click-through rate from impression-only data.

Research without a paid social API should rely on first-party repo/product signals, platform-authorized public sources, RSS, search where allowed, manually curated X observations and user-owned data exports. Agent Reach can extract allowed site content but should never be described as giving automatic full X access or an X API subscription substitute. Create a `gtm distribution manual-pack` and `gtm metrics import --from <owner-export>` command.

---

# G. Writing quality and voice pipeline

Pipeline: `Evidence → Audience/JTBD → Angle → Hook → Draft → Fact/claim QA → Humanizer → Voice comparator → Compliance review → Creative → Owner review`. Humanizer is a controlled editor, not an evidence source. It may improve rhythm, sentence variety and jargon; it may NEVER invent personal experiences, affiliations, customer quotes, market metrics, or conclusions.

Per-tenant voice profiles:
- Founder: actual engineering tradeoffs, implementation lessons, specific observations, curious/precise first-person, no inflated founder bragging, no fake anecdotes or templated AI tone.
- RetroPick: clear product facts, authentic interface demos, explanations of how instruments work, no implied investment recommendations or profit assurance, risk-aware, useful to creators and traders.

Enforce English-first for international X (with optional Indonesian localization), preserving crypto/Web3 technical terminology. Build `humanizer_ablation` tests: original vs refined draft; semantic entailment of source claims, named entities/numbers unchanged, voice fit score, reader review, similarity to other tenant. Include anti-AI-slop checklist, ban unsubstantiated hyperbole, avoid artificial engagement bait and generic threads.

Outputs per sample: 5 sourced/clearly proposed posts + 2 threads + 2 covers per tenant; 1 founder engineering mini-explainer and 1 real/prototype-labeled RetroPick demo if evidence is available. Do not call a synthetic demo a shipped feature.

---

# H. Harness² integration — evidence-driven recursive improvement

Official repo: `https://github.com/google-research/harness2` (current upstream, verify commit/license). It describes task-level `Propose–Probe–Compose` recursion and persistent harnessing-level reflections. Documented components: system prompt, guardrails, memory, tool guidance, subagents, skills, scripts, plugins. Official benchmark modes and `--substrate cx` work with supported built-in benchmark tasks; **do not claim GTM/marketing is a built-in benchmark.**

**H1. Quarantine install:** clone pinned commit into `~/agent-harness-lab/vendor/harness2` (or project-owned equivalent), inspect setup scripts, dependency chain and sandbox settings. Create dedicated Python 3.12 uv environment. Run offline `harness2-demo --output <isolated-run-dir> --k 2` only AFTER verifying its output path and execution effect. It requires no model credentials. If unsafe on current host, do not run; simulate PPC with local fixtures. No privileged Docker, no mounting `$HOME` or active Codex auth into benchmark containers.

**H2. Evaluation driver:** create a `harness/adapters/gtm-benchmark` integration that matches current Harness² extension architecture or a standalone PPC evaluator if official plugin hooks are absent. Read actual source; do not monkey-patch without tests. `gtm-harness evaluate --suite founder-voice|retropick-launch|global-discovery --k 1 --mode sequential --offline` and `--baseline-ref` should be real implemented commands; only implement CLI flags known to current code. Enable model-backed tests only when the existing subscription route supports it and budgets are approved.

**H3. Global fixture suite (minimum 12 cases)**: skill resolver recall/precision, malicious skill-instruction injection, tools with duplicate names, version conflict, missing MCP auth, secret-leak test, zero-spend gate, tenant cross-over, prompt-long-context pressure, workflow interruption/resume, tool-call failure, expensive model escalation denial.

**H4. GTM fixture suite (minimum 16 cases)**: 4 founder voice samples, 4 RetroPick educational/launch tasks, 2 market research freshness tests, 2 claims ledger/red-flag tasks, 2 multi-format visual checks, 2 analytics interpretation cases. Label sources as historical fixtures vs holdout; redact any credentials/personally sensitive content. Human reviewers grade 4 qualitative dimensions blind to candidate version; deterministic validators grade safe components.

**H5. Improvement lifecycle:**
`snapshot baseline → select one target component → propose ≤3 minimally scoped changes → probe on non-production tasks → contrast outcomes + ablation → candidate composite → evaluate untouched holdout → security scan → human review → staged PR → optional promotion → monitor regression → rollback`.

**H6. Evaluation metrics:** first-pass task completion, verified correctness, source citation validity, semantic faithfulness, compliant platform behavior, tenant isolation, brand-voice preference (blind), clip legibility/audio and render correctness, time/iteration, inference quota, actual spend, tool count/context tokens, human edits, downstream outcome where measurable. HARD gates: 0 credential leak, 0 unauthorized side effects, 0 unverified financial claims, 0 tenant identity mismatch. For subjective scores use blinded rubric, repeatability and reasonable sample sizes. Never promote on vanity metrics or only on self-reported satisfaction.

**H7. Memory/promotion topology:** global recommendations go under `~/agent-control-plane/improvements/proposals/` with signed/hashed evidence and an explicit allowlisted sync plan; project-specific recommendations go in `gtm-os/harness/promotions/project/`. Never directly rewrite original skill source or global AGENTS file. On owner approval and clean regression, apply via a scoped change with backup and rollback. Project improvements cannot automatically become global rules. Reflections are references, not instruction authority. This system improves the *harness*, not model weights.

**H8. Security:** Harness² upstream says its Codex executor runs without sandbox and with unrestricted web access. Implement sandboxing OUTSIDE executor (ephemeral VM/container, restricted network/identity/credentials, file allowlist) and prove with adversarial tests. If this cannot be achieved, DO NOT execute its Codex substrate; only use the offline demo or independently sandboxed PPC evaluator.

**H9. Resource controls:** `HARNESS_MAX_K=1`, `HARNESS_PARALLEL_WORKERS=1`, `HARNESS_NETWORK=none`, `HARNESS_PAID_MODEL_CALLS=0`, `HARNESS_GLOBAL_PROMOTE=false` until baseline quality, isolation and cost controls are proven. Avoid continuous recursive self-modification, unstable auto-promotions and infinite self-evaluation.

---

# I. Practical growth strategy and operating cadence

RetroPick funnel (proposed pending product audit): awareness via relevant education/demo → verified landing session → view available market/launch → supported user action → verified activation → repeat usage. Choose exact conversion definitions only after examining deployed product and event schemas. Differentiate UI click vs successful wallet interaction vs chain-finalized transaction. Protect privacy; avoid raw wallet identifiers in marketing analytics.

Founder funnel: useful verified technical content → profile visits/quality conversations → meaningful repo exploration, engineering collaboration, inbound opportunities. No fabricated follower analytics.

Daily: 1 bounded intelligence brief per tenant; triage content backlog; draft 0–2 meaningful posts; quality check, prepare manual packets. Weekly: 1 source-supported product demo/feature update, 1 deep founder engineering artifact, two 7-day calendars, metrics snapshot and 1 measured growth experiment. Monthly: offer/message testing, channel ROI assessment, skill effectiveness review and Harness² proposal review. These are planning cadences, not instructions to spam.

KPI schema: source timestamp, post URL if supplied, format, hook angle, audience, impressions if owner-supplied, engagement, qualified link clicks, attributable visits, product conversion where verified, meaningful replies, collaboration referrals, run cost, human editing effort, provenance/confidence. Mark missing values `UNAVAILABLE`, NOT 0. Use manual CSV imports at first; optional first-party PostHog only if already configured lawfully and user approves.

---

# J. Phased implementation plan with explicit exit gates

**Phase 0 — reconcile prior work and security (first):** inventory current three workspaces and active branch, review Phase E uncommitted work, generate redacted manifests, confirm exposed credential rotated, run `agentctl doctor`, skill discovery, `./gtm doctor`, tests, available video previews. Gate: no history loss; true status matrix; all original tests green or scoped regression documented.

**Phase 1 — integrate existing global skills without duplication:** capability registry adapters, tenant-specific selection policy, Last30Days allowed source policies, Agent Reach research adapter and Scrapling simple fetcher. Tests: tool absent, duplicate skill, policy-blocked X backend, source expiry, prompt injection, zero API spend. Gate: 6 useful offline capability invocations with receipt, no network abuse.

**Phase 2 — complete/repair Phase E rather than redo it:** reconcile distribution/approval and analytics modules, manual publishing packet, export metrics import, idempotent receipts, attribution caveats. Preserve historical Phase A–D artifacts and build interfaces. Gate: one fully offline founder run + one RetroPick run, approval HOLD state, 0 social network writes.

**Phase 3 — editorial/humanizer studio:** source-grounded writing, first-person authenticity, voice memory, humanizer as post-edit, SEO and content atomization. Gate: ≥5 posts and ≥2 threads per tenant, invariant checks, editorial review and 2 creative templates using existing Phase D pipeline.

**Phase 4 — Harness² isolated lab:** upstream audit, safe offline demo, full QA suite, PPC-comparable GTM fixtures, baseline vs candidates, no live credential exposure. Gate: documented evaluator, no sandbox escape, deterministic tests, no auto-promotion.

**Phase 5 — growth operating cycle:** daily/weekly workflows, content calendars, owner-safe publishing packets, owner analytics imports, risk-aware scorecards, CRO proposals. Gate: two back-to-back complete simulated weekly cycles with consistent checkpoint/resume, at least one real sourced public-product fact if accessible, otherwise documented evidence blocker.

**Phase 6 — gated improvement and optional deployment:** run ablations/holdouts, review candidate improvements, project PR, optional approved global promotion. No background tasks, paid APIs, automated account actions or VPS deployment until explicitly authorized. Gate: improvement report quantifying evidence and clear rollback test, plus confirmed non-regression.

Prefer vertical slices; implement real working features and tests per phase, not merely directories, empty role definitions, or proposal-only output.

---

# K. CLI required surface (adapt to observed implementation)

Commands to implement and prove (do not claim syntax already exists):
```
./gtm doctor --json
./gtm capabilities audit --json
./gtm capabilities plan --brand retropick --task 'feature launch'
./gtm research daily --brand founder --offline
./gtm research trends --brand retropick --sources allowed --days 30
./gtm content draft --brand founder --format thread --source-card <id>
./gtm content humanize --brand founder --draft <id> --preserve-claims
./gtm creative pack --brand retropick --campaign <id> --offline
./gtm distribution manual-pack --brand founder --draft <id>
./gtm distribution receipt import --brand founder --file <owner-supplied.json>
./gtm metrics import --brand retropick --from <owner-export.csv>
./gtm analytics weekly --brand retropick --offline
./gtm harness baseline --suite global-discovery --offline
./gtm harness propose --target skill:content-strategy --offline
./gtm harness evaluate --suite founder-voice --offline
./gtm harness promotions status
./gtm costs report --json
./gtm verify --all --offline
```

All commands have typed input validation, bounded resources, structured error codes, no secret log output, idempotency and clear `BLOCKED` where a provider or auth path isn't available. Mock/fixture results must always be labeled synthetic.

---

# L. Tests, observability, and acceptance

Required test classes:
- Tenant account isolation, claims ledger, reference provenance, malicious instructions in fetched pages, content-hash invalidation, provider denied-by-policy, zero-spend enforced independently of prompts.
- Agent Reach/Last30Days/Scrapling mocked success/failure/freshness/rate-limit paths, no X scraper invocation, no cookie exfiltration, provider ToS adjudication.
- Humanizer semantic equivalence and authentic first-person checks; brand differentiation; DOI/URL/source expiry where applicable.
- Offline graphics/video image/audio/safe-area tests using existing pipeline; verify dimensions, captions and ffprobe actual media.
- Manual publishing handoff: account handle, exact hash, owner proof, timestamp, unknown publication state, retry/dedup; no false receipt.
- Analytics missing data ≠ zero; correct conversion definitions; synthetic observations never mingle with observed production metrics.
- Harness²: good/bad candidate discrimination, holdout protection, leaked rubric prevention, prompt injection, regression detection, sandbox escape, budget cap, global mutation prevented, rollback proof.
- Preserve and rerun all Phase A-D tests, current Phase E tests, global control-plane smoke and model-router regression; don't assert pass without real logs.

Deliver:
1. `docs/GTMMIGRATION_V3_BASELINE.md` + exact host inventory and branch state.
2. `docs/INTEGRATIONS_V3_MATRIX.md`: reuse/replace/block decisions with technical reason.
3. `docs/ARCHITECTURE_V3.md`, 2 tenants, privilege boundaries, threat model.
4. Updated root/nested `AGENTS.md`, `SKILLS.md`, `DESIGN.md`, `WORKFLOWS.md`, operational templates.
5. Actually working skill-selection/research/humanizer adapters with sanitized replayable source cards.
6. At least two full offline runs: founder tech thread and RetroPick verified feature (or mock-labeled) release pack with graphics and video.
7. Complete manually operated distribution pathway and importable reports.
8. `harness/docs/{DESIGN,SECURITY,BENCHMARKS,PROMOTION,RUNBOOK}.md`; tests and one local Propose–Probe–Compose demonstration.
9. Reviewable change proposals, separate GLOBAL vs PROJECT promotion staging, rollback.
10. Measured comparison: original Phase D / current baseline vs v3 on identical tasks—first-pass success, claim correctness, human editing, output quality, time, cost/quota where attributable; unknown marked unknown.
11. `docs/evidence/V3_ACCEPTANCE.json` with exact commands/test counts/hashes, missing credentials, risks and honest statuses.

Completion means real project-local GTM workflows work, their outputs are source-grounded, improvements are experimentally gated, and zero unauthorized writes or paid social API calls occurred. It does NOT mean both X accounts were logged into, published to, or that growth/revenue was achieved.

## Final execution instruction to Codex

Do not ask for a new folder or start a new scaffold. Inspect existing `/home/ubuntu/project/gtm/gtm-os`, `/home/ubuntu/agent-control-plane`, and `/home/ubuntu/codex-model-router`. Work in the current GTM project's safe feature branch (create a new branch from current head if clean; preserve dirty work). Build the next smallest vertical slice today. If an item is blocked by provider policy, auth, source quality, or sandboxing, implement the verified local pathway and report the exact blocker. Make no live account changes or paid calls. Finish with a concise evidence-backed audit, actual modified files, test receipts, demonstration commands, all known remaining gates and the next prioritized task.

**EXECUTE THE RECONCILIATION AND FIRST WORKING V3 SLICE NOW.**
