# Buffer operator setup

Revision: v5-r2. Audience: owner and trusted host operator. Approval: setup guide only; no account, global credential or service changes were executed. No secret values belong in this document, Git, argv, terminal history, agent prompts, fixtures, logs or error reports. The owner authorized use with unknown expiration on 2026-10-24; record that explicitly rather than inventing an expiry.

1. Sign into Buffer, verify email, and connect the two owned X profiles through Buffer's sanctioned OAuth UI: `@RetroPickMarket` and `@iHateModelsss`. Confirm ownership and the active Free plan; do not authorize a charge or upgrade by implication.
2. At [Settings → API](https://publish.buffer.com/settings/api), confirm each account's personal key permissions: `accountRead`, `postsRead`, `postsWrite` and, if available, `insightsRead`. Personal keys can reach all account organizations; V5 binds tenant channels locally. The owner supplied separate account credentials; maintain separate credential sets. Record actual expiration when known; unknown is not proof of unlimited validity. [Key setup](https://support.buffer.com/en-us/articles/how-to-create-your-buffer-api-key-ShIgYVwM6j).
3. Have the trusted operator provision a dedicated least-privileged publisher user and install the keys through the host's secret-management process. Each service instance receives `buffer-api-key`, `buffer-expiry` and `buffer-tenant` through systemd `LoadCredential`. Key contents must be a regular, single-link file readable only by that service; expiry contents are an ISO UTC timestamp or the explicit `UNKNOWN_OWNER_ACCEPTED` sentinel. Tenant must match exactly. Do not source `.env` or place a key in a shell command.
4. Review/adapt `distribution/v5/gtm-publisher@.service`: the example assumes `/opt/gtm-os` and `/etc/gtm-publisher/`. Only the operator installs it. Code is read-only; only the dedicated runtime is writable. Each invocation selects one brand; approvals, evidence and packets must be available in that brand's runtime. Global Codex/Zodex/Hermes credential homes are neither required nor exposed.
5. Inside the credential-bearing publisher runtime, run the following commands. `CREDENTIALS_DIRECTORY` is supplied by systemd; do not set a token environment variable.

```bash
./gtm provider doctor --provider buffer --brand retropick --json
./gtm provider channels --provider buffer --brand retropick --json
# In a separate founder credential-bearing instance:
./gtm provider doctor --provider buffer --brand founder --json
./gtm provider channels --provider buffer --brand founder --json
```

Doctor reports absence, tenant mismatch, unknown expiry, expired key, rotation due, or verified identity/capabilities without displaying the key. It reads the channel's timezone and recurring slots and reports whether they match five posts/week in America/New_York; it does not alter those settings or create a probe post. Read success does not prove write permissions. Revoked/incorrect keys fail closed. Expiry within 14 days flags rotation; expired or malformed metadata blocks requests. The explicit owner-accepted unknown sentinel permits requests while retaining an unknown-expiry status; automatic expiration/rotation forecasts are unavailable. Rediscover principal/channels and regenerate approvals if identity changes. Retain the shared conservative budget ledger across both accounts and rotation; it may underuse their independent quotas.

For private terminal setup without installing a service, the following operator commands prompt with echo disabled. Run in this checkout; use the RetroPick key at the first prompt and the personal key at the second. Values never enter command arguments, environment, stdout or project files. The helper refuses pipes, symlinks, checkout storage, unsafe permissions and overwriting existing sets. These commands have **not** been executed by the agent.

```bash
install -d -m 700 "$HOME/.local/share/gtm-publisher"
python3 scripts/provision_buffer.py --brand retropick --directory "$HOME/.local/share/gtm-publisher/retropick" --expires unknown
python3 scripts/provision_buffer.py --brand founder --directory "$HOME/.local/share/gtm-publisher/founder" --expires unknown
CREDENTIALS_DIRECTORY="$HOME/.local/share/gtm-publisher/retropick" ./gtm provider doctor --provider buffer --brand retropick --json
CREDENTIALS_DIRECTORY="$HOME/.local/share/gtm-publisher/founder" ./gtm provider doctor --provider buffer --brand founder --json
```

`CREDENTIALS_DIRECTORY` contains only a directory path, never a key. This operator session can read the dedicated files; production isolation requires the reviewed service user/template. Keep global agent authentication files untouched. No secure secret-entry tool is connected to this assistant; keys pasted in conversation cannot be transferred into this boundary without adding them to another tool transcript. The master prompt forbids that transfer.

Prepare reviewed V5 text packets with `publishing packet --brand TENANT --file distribution/inbox/TENANT/FILE.json`. The strict input includes tenant, text, exact evidence/source-review hashes and statements, `firstPersonExperience`, and media (empty for this slice). Inspect generated packet IDs; the preparation script supplies real source-grounded candidates without owner approvals.

```bash
./gtm publishing preview --brand retropick --packet-id ACTUAL_PACKET_ID --target-zone America/New_York --local-slot YYYY-MM-DDT09:00 --json
./gtm publishing approve --brand retropick --file distribution/inbox/retropick/ACTUAL_OWNER_DECISION.json --json
./gtm publishing schedule --brand retropick --approved-id ACTUAL_JOB_ID --provider buffer --dry-run --json
```

The preview contains the exact discovered principal/channel, copy, UTC/WIB/audience slot and payload hash. Only after genuine owner confirmation, import a decision matching the `ApprovalInput` schema: tenant, jobId, payloadSha256, actor `owner`, ownerIdentity `Muhammad Asyam Jayanegara`, actual `at`, future `expiresAt` no more than seven days later, editorial/authenticity/rights review booleans, event `APPROVE`, and a genuine `ownerConfirmationRef`. The expiry gates submission; the approved future slot remains explicit. Do not use a template as a real approval.

Then execute the same immutable job with `--execute`. Reconcile its returned provider ID after scheduling and after due time. Run `publishing acceptance --verify --job ID --brand TENANT` for independent public verification; if Buffer's external link is absent, an owner-supplied `--url` remains an unverified candidate until the same public check succeeds. Run `publishing metrics --job ID --brand TENANT` after transmission. Unknown/lagging metrics stay unknown. For cancellation, import `APPROVE_CANCEL` for the same job/hash and invoke `publishing cancel --job ID --brand TENANT --execute` while the remote post is still scheduled.

The initial test is a closed two-post test: one per account. Do not approve/refill additional jobs until that acceptance is assessed and further posts are separately approved. No weekly batch is submitted by preparing a calendar.
