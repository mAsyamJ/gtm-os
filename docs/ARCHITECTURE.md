# Architecture — multi-tenant GTM OS

## Core boundaries

Human Owner ↔ Codex Operator ↔ audited skills/role specs ↔ typed workflow engine ↔ policy/claim/approval gate ↔ adapter ↔ X / analytics / GitHub (where explicitly permitted). Research and creative jobs may operate offline with fixtures.

Data: `tenant_id` required on every content object, account mapping, approval, evidence/source card, analytics event, artifact, job and audit receipt. Identity is asserted at adapter boundary, not inferred from visible browser tab. Job table + outbox + idempotency keys; local SQLite for MVP, external queues/database only if capacity justifies it.

## Context model

`AGENTS.md` is scoped always-on governance; `SKILLS.md` human index; actual `SKILL.md` progressive on-demand instructions; `agents/roles` are task roles (do not assume background bots); `WORKFLOWS.md` human process map; YAML definitions are machine-validated work contracts; `DESIGN.md` human creative contract; `tokens.json` validates rendered output.

## Threat boundaries

External website/skill = untrusted source; output must pass evidence and injection tests. Credentials = protected environment outside LLM. Public publishing = explicit human gate + verified user identity + content hash + projected spend. Marketing claims = cited and scoped to time and jurisdiction.

## Execution note

No runtime packages or integrations exist in this scaffold. Codex must implement, test and evidence them. See master prompt.
