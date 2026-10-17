# Brands scope

A tenant ID is mandatory. Reject unspecified/ambiguous tenant, shared OAuth identities, cross-account bulk duplicate posts and approval reuse. Source brand-specific `AGENTS.md`, `VOICE.md`, `DESIGN.md` and claims registry before content generation. No brand may override root no-publish policy. Cross-promotion requires distinct adapted briefs and individual approvals.

**Scope:** brands/ only. Root AGENTS.md remains mandatory; these rules cannot relax it.

**Source of truth:** root AGENTS.md and each selected brand profile, voice, design and claims ledger

**Allowed:** Read approved local contracts and evidence; edit reviewable artifacts in this workspace on the feature branch. Select the tenant before brand work; structural audits may inspect both separately.

**Forbidden:** No external writes, installs, authentication, spending, publishing, deployment or credential access during Phase A. Never reuse evidence or approvals across tenants.

**Validation:** From the repository root run `python3 scripts/validate_scaffold.py` and `python3 -m unittest discover -s tests -v`. Later runtime/media checks remain separate.

**Owner and approval:** Muhammad Asyam Jayanegara retains approval authority. Local implementation approval does not authorize public claims or external actions; exact identity, immutable payload/media hash, cost and current owner approval are required for any later external action.

**Handoff:** Return scoped artifacts and evidence to the accountable role in agents/ORCHESTRATION.md; missing evidence or capability is BLOCKED. Root policy applies at every handoff.
