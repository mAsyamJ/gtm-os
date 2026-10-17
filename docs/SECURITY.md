# Phase A security boundary

Revision: phase-a-r1. Audience: owner, implementers and reviewers. Inputs: root policy, master prompt, schemas, governance review and scanner receipts. Approval: local implementation only. No media assets used; redistribution licenses remain unreviewed.

## Authority

Root AGENTS governs every nested scope. A later external operation requires owner approval bound to tenant, platform/action, authenticated principal, payload/media hashes, time window, current price and maximum charge. Changed content invalidates approval; no role may self-approve. Phase A has no publisher or runtime policy enforcement.

Allowed: approved local material, local governance/code edits and deterministic tests/scanners; safe executable metadata; permitted public documentation reads as untrusted evidence. No publishing, scheduling, outreach, paid requests, OAuth, deployments, Git pushes/merges, credentials changes or edits to other production repositories. Paid X cap remains zero.

## Threat model

| Threat | Phase A control | Later runtime obligation |
|---|---|---|
| Cross-brand account/evidence confusion | Tenant, handle, claim ownership and disabled-profile tests | Physical database isolation, scoped references and provider identity read-back |
| Drift enabling writes/spend | Exact disabled flags/defaults and zero-cap tests | Runtime permission/spend policy |
| Malicious YAML/source instructions | SafeLoader; reject duplicate keys, custom tags, aliases/anchors; size limits; never execute source text | Injection tests and source expiry at ingestion |
| Schema fetch/private linked inputs | Local-only schema refs, symlink refusal, named config reads | Runtime path and storage boundaries |
| Secrets in prompts/logs | No environment, SSH, xurl, auth/session or router config reads; value-free errors and redacted scanner summaries | Runtime redaction and OS secret storage |
| False capability/license success | Separate presence/version from execution; manual stages; unofficial tokens | Renderer, source/IP, identity and reconciliation tests |
| Upstream skill/hook supply chain | No upstream activation, package install or new hooks | Pin/license/script review before scoped activation |

`security_audit.py` copies allowlisted source types to a temporary workspace directory without following links. It excludes Git/Beads databases, runtime, caches, dependencies and secret directories. It includes `.env.example`, never actual environment files. Gitleaks uses complete redaction; matched values, raw scanner source and stderr are not forwarded. Semgrep uses checked-in rules with telemetry/version checks disabled. No dependency, Git-history or future runtime certification is implied.

## Incident handling and rollback

On a finding, stop the affected action and return redacted code/path only. Preserve disabled capabilities. Suspected credential exposure requires owner-led rotation outside this task; never inspect or rotate secrets here. Future ambiguous provider responses require reconciliation before retry, with changed-content approvals invalidated.

Preserve dirty files before reverting Phase A implementation commits to the recorded baseline. Do not destructive-reset/clean or delete Beads history. Embedded Beads has no remote; JSONL export is not storage, backup or sync authority. Additional backup/sync setup requires its own authorization.

Instruction review is an operator assessment; schema markers do not prove semantic authority. NOT_AUTHENTICATED account examples indicate no verified connection here, not a live auth inspection. No legality, investment suitability, official branding, commercial media rights or publish safety is certified. Exact checks/counts are in `QA_REPORT.md`.
