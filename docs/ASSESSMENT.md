# Phase A assessment

Revision: phase-a-r1, 2026-10-17. Audience: owner and local implementers. Approval: local Phase A implementation only. Inputs: master prompt, phased guide, original scaffold and local command receipts. No creative assets used; original scaffold redistribution rights are unspecified.

## Starting workspace

The chosen root is `/home/ubuntu/project/gtm/gtm-os`, already containing the extracted documentation scaffold: 29 local skills, 15 roles, 16 workflow definitions and four state declarations. Its only implementation was a structural validator. No `.git`, `.beads`, package manifest, workflow engine, renderer or CLI existed. The inspected GTM parent contained only this workspace. No other repository was migrated or edited.

The original validator passed: 247 paths, 29 skills, 16 workflows. It checked presence and text markers without schema, role-reference or policy-value validation. Runtime integration was explicitly untested.

Memorix MCP could not bind the workspace; its prescribed CLI fallback failed on Git ownership/safe-directory detection before Git existed here. No global Git settings were changed to bypass that result. Prior memory is unavailable evidence, not proof of no prior work. Beads initially reported no active workspace.

## Reconciliation

| Observed | Resolution | Evidence |
|---|---|---|
| No Git/Beads | Local `codex/gtm-phase-a` and embedded Beads, no remote/hooks | Git history; issue `gtm-jhh` |
| Global ignores hid governance paths from normal staging | Force-staged only audited allowlisted files for baseline | Baseline commit and manifest |
| Both brand contracts referenced absent profile.yaml | Kept existing JSON profiles; corrected references | Brand AGENTS and tests |
| 62 workflow stages lacked required tool field | Added `tool: manual`; no engine implied | Workflow schemas |
| Daily intelligence owner was a skill | Corrected to existing `market-researcher` role | Role-reference tests |
| Three undeclared error states | Added blocked to content, experiment and release | State membership tests |
| Sparse nested contracts/grouped skill index | Added scoped authority details and individual skill paths/owners/status | Governance review and root skill index |
| Identical sample brand palettes | Preserved explicitly unofficial placeholders | Unchanged tokens/design |
| Empty claim/product/expertise ledgers | Preserved evidence gaps, no facts promoted | Ledger schemas |

## Capabilities and limits

Local probes found Python 3.12.3, Node 24.11.0, pnpm 12.4.2, Codex 0.162.1 and FFmpeg/ffprobe 6.1.1. PyYAML 6.0.1 and jsonschema 4.10.3 were already available. Exact paths, versions and executable hashes are in `evidence/phase-a-tools.json`. Router wrappers and one known CLI source were inspected read-only; no router configuration, credentials, model calls or provider identity checks were made.

Expected X handles are not verified principals. Example account mappings remain NOT_AUTHENTICATED. Available operator app connectors do not prove project integrations exist. Live product UI, upstream product revisions, provider prices, media rights, performance and savings remain unverified or NOT_MEASURED.

Phase A implements governance validation and bounded security/source receipts. Runtime storage/isolation, immutable approval enforcement, workflow execution, rendering and analytics remain Phase B–F. Static checks cannot prove runtime safety. Reproduce checks through `QA_REPORT.md`; evidence and hashes are under `evidence/`.
