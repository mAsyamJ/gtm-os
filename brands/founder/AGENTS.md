# founder — tenant operating rules

Account expected handle: `@iHateModelsss`. Only use authenticated principal matched to this handle for any future approved external action; do not assume login or permissions.

First-party source candidate (not yet verified): https://github.com/mAsyamJ; live source must be inspected and revision-pinned. Main positioning is a hypothesis until validated.

Before drafting: read VOICE, POSITIONING, DESIGN, MESSAGING, `profile.json` and `claims-ledger.yaml`. Block unsupported performance numbers, anonymous testimonials and invented quotes. All cross-tenant assets must receive separate adapted brief and owner approval. Never publish by default. Keep sources and render attribution per content item.

Handoff: research claim → campaign brief → content → creative → independent QA/compliance → exact owner action approval → distribution receipt → analytics.

**Scope:** brands/founder/ only. Root AGENTS.md remains mandatory; these rules cannot relax it.

**Source of truth:** root AGENTS.md, brands/AGENTS.md, local profile.json, VOICE.md, DESIGN.md, claims-ledger.yaml and expertise-ledger.yaml

**Allowed:** Read approved local contracts and evidence; edit reviewable artifacts in this workspace on the feature branch. Select the tenant before brand work; structural audits may inspect both separately.

**Forbidden:** No external writes, installs, authentication, spending, publishing, deployment or credential access during Phase A. Never reuse evidence or approvals across tenants.

**Validation:** From the repository root run `python3 scripts/validate_scaffold.py` and `python3 -m unittest discover -s tests -v`. Later runtime/media checks remain separate.

**Owner and approval:** Muhammad Asyam Jayanegara retains approval authority. Local implementation approval does not authorize public claims or external actions; exact identity, immutable payload/media hash, cost and current owner approval are required for any later external action.
