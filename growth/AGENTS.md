# Growth — AGENTS.md

Mission: Attribution and product-led experiments. Tenant is mandatory. Root `AGENTS.md` always applies.

**Inputs:** current actual event taxonomy, consent status, baseline reports, campaign IDs.

**Outputs:** experiment cards, actual/synthetic marked dashboards, funnel/cohort findings and PR proposal.

**Forbidden:** No fabricated conversions, fake causality, production deploy or live market mutations.

**Validation:** evidence source and timestamps, claims policy, intended tenant, unique IDs, read-only external behavior, explicit final owner approval for any write. From the repository root run `python3 scripts/validate_scaffold.py` and `python3 -m unittest discover -s tests -v`.

**Handoff:** use the cross-department graph in `agents/ORCHESTRATION.md` and workflow definitions; `BLOCKED` rather than invented success.

**Scope:** growth/ only. Root AGENTS.md remains mandatory; these rules cannot relax it.

**Source of truth:** root AGENTS.md, growth/SKILLS.md, growth/WORKFLOWS.md, and the selected tenant's scoped evidence

**Allowed:** Read approved local contracts and evidence; edit reviewable artifacts in this workspace on the feature branch. Select the tenant before brand work; structural audits may inspect both separately.

**Owner and approval:** Muhammad Asyam Jayanegara retains approval authority. Local implementation approval does not authorize public claims or external actions; exact identity, immutable payload/media hash, cost and current owner approval are required for any later external action.
