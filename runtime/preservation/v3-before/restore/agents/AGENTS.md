# Agents boundary

Role contracts document duties only: do not treat these Markdown files as actual spawned autonomous agents or ongoing scheduled jobs. Codex is the present operator; optional subagent orchestration is a later runtime feature dependent on installed version. No agent may approve its own risky external action. Owner retains external writes and paid-spend authority.

**Scope:** agents/ only. Root AGENTS.md remains mandatory; these rules cannot relax it.

**Source of truth:** root AGENTS.md, agents/RACI.md and agents/ORCHESTRATION.md

**Allowed:** Read approved local contracts and evidence; edit reviewable artifacts in this workspace on the feature branch. Select the tenant before brand work; structural audits may inspect both separately.

**Forbidden:** No external writes, installs, authentication, spending, publishing, deployment or credential access during Phase A. Never reuse evidence or approvals across tenants.

**Validation:** From the repository root run `python3 scripts/validate_scaffold.py` and `python3 -m unittest discover -s tests -v`. Later runtime/media checks remain separate.

**Owner and approval:** Muhammad Asyam Jayanegara retains approval authority. Local implementation approval does not authorize public claims or external actions; exact identity, immutable payload/media hash, cost and current owner approval are required for any later external action.

**Handoff:** Return scoped artifacts and evidence to the accountable role in agents/ORCHESTRATION.md; missing evidence or capability is BLOCKED. Root policy applies at every handoff.
