# GTM OS V5 — Codex Implementation, Live Two-Brand Publishing Test, and US-First GTM Architecture

**Prepared:** 2026-10-24. **Repository:** `mAsyamJ/gtm-os`. **Last verified main SHA:** `c554a264d64356f87d01ba6ee41ca5c7339e6abc`. **Operating timezone:** `Asia/Jakarta`. **Target audience:** US crypto-native memecoin traders, creators, degens and market structure enthusiasts; Europe second; Asia exploratory. **Identities:** `retropick` → `@RetroPickMarket`; `founder` → `@iHateModelsss`.

## Copy this entire brief into Codex

You are Principal TypeScript/SQLite Backend Engineer, SRE, Security Architect, and senior Web3 GTM Engineer. Work in the existing local checkout and **implement**, not just plan, a production-grade V5 vertical slice, with a real, safely approved X post from **each of two accounts** as final integration verification. Do not claim live success on mocks. Finish all independent tasks even if the owner has not yet connected credentials.

### A. Resolve provider incompatibility

**Buffer and Postiz are separate products.** A Buffer Free personal API key works with `https://api.buffer.com` GraphQL, **not with Postiz**. For first production launch, use **Buffer as the only active scheduler/provider**. Implement a provider interface so a separately authenticated official `PostizPublisherAdapter` may be added later, but do not install/configure Postiz merely as a wrapper around Buffer or double-schedule content. Self-hosted Postiz X connector may require separate X developer credentials and operational costs. Confirm with current official docs.

Official sources (read now):
- https://developers.buffer.com/guides/authentication.html
- https://developers.buffer.com/examples/get-channels.html
- https://developers.buffer.com/examples/create-scheduled-post.html
- https://developers.buffer.com/examples/get-scheduled-posts.html
- https://developers.buffer.com/examples/get-posts-with-metrics.html
- https://developers.buffer.com/guides/posts-and-scheduling.html
- https://buffer.com/pricing
- https://support.buffer.com/en-us/articles/how-to-create-your-buffer-api-key-ShIgYVwM6j
- https://github.com/gitroomhq/postiz-app
- https://help.x.com/en/rules-and-policies/x-automation

Buffer Free has up to 3 connected channels, 10 pending scheduled posts **per channel**, one API key, and 3,000 API calls per 30 days. Official materials conflict on the free 24-hour cap (100 or 250); enforce a *conservative* <=100/day budget until actual provider response headers indicate the effective enforced limit, plus 15-minute throttling and safety margin. Key validity is finite (currently up to one year), not literally permanent: make durable secret storage, expiration checks, and rotation first-class. Buffer API cannot be used as a general authenticated X search/reply/DM API.

### B. Read and preserve the real V4 baseline (P0)

1. Inspect Git status, branch/remote parity, dirty/untracked/ignored assets, running tools, package versions and locks. Do not reset local changes. Create a safe isolated feature branch or worktree. Do not push or merge to main without owner instruction.
2. Read root/nested `AGENTS.md`, both brands' VOICE/DESIGN/claims files, `distribution/AGENTS.md`, `docs/CRYPTO_INTELLIGENCE_OS.md`, `docs/V3_USER_MANUAL.md`, `docs/FIRST_LIVE_GTM_SPRINT.md`, `docs/CRYPTO_GTM_V4_QA.md`, and `research/product/RETROPICK_CAPABILITY_LEDGER.md`.
3. Reuse `packages/v3/src/intelligence/http.ts`, `research.ts`, `store.ts`, `workflows.ts`, `packages/v3/src/distribution.ts`, `analytics.ts`, existing hash/Zod utilities and CLI. Preserve append-only tenant SQLite history and all V4 acceptance receipts. Historical baseline is `LOCAL_PIPELINE_VERIFIED_OWNER_AND_COVERAGE_GATES_BLOCKED`, with two HOLD packets and incomplete people/source coverage. A new V5 publishing test does not retroactively prove the old V4 HOLD campaign was published.
4. Run existing suites, including `pnpm check`, Python verification as appropriate, and record actual logs/exit codes. The historical 225 TypeScript / 43 Python numbers are reported, not a substitute for reruns. Inspect 10-second Codex hook timeouts without disabling security hooks casually.
5. Output `docs/v5/BASELINE.md` and machine-readable baseline receipt.

### C. Implement provider-neutral publisher and durable SQLite outbox (P1)

- `PublisherAdapter`: `discoverChannels`, `probe`, `schedule`, `getScheduled`, `getSent`, `getPostMetrics`, `reconcile`, and supported `cancel`. Unsupported capability must return `UNSUPPORTED` not a fake success.
- Add first-class `BufferPublisherAdapter` authenticating with `Authorization: Bearer` at `https://api.buffer.com`. Discover `account.organizations` then `channels(input:{organizationId})`, select exact X `service`, exact handle and unpaused channel. Persist and assert tenant-bound discovered identity. Do not hardcode IDs.
- Official scheduling GraphQL mutation uses `createPost(input:{ text, channelId, schedulingType:automatic, mode:customScheduled, dueAt:<UTC ISO 8601> })`; use variables/validated schema. Parse HTTP errors, GraphQL `errors` on HTTP 200, union `MutationError`, success `post.id`, and rate-limit headers. Reject unknown schema. Bind validated media and rights separately.
- New additive tables (or already existing equivalent): `provider_channels`, `publication_jobs`, `publication_attempts`, `provider_receipts`, `approvals`, `metrics_snapshots`, `outbox_events`. Use the existing storage security patterns, WAL, constraints on `(tenant, channel, content_hash, time_slot)` and provider ID, plus opaque audit IDs. Never put API credentials in DB.
- Durable states: `DRAFT -> REVIEWED -> APPROVAL_PENDING -> APPROVED -> SUBMITTING -> SCHEDULED -> SENT -> MEASURED`. Error/auxiliary: `HOLD`, `CANCELLED`, `RECONCILE_REQUIRED`, `FAILED`, `EXTERNAL_URL_PENDING`. Never call `SCHEDULED` equal to `SENT`.
- Atomic job claims and owner leases; one provider controls a given post. Timeout/uncertain response **must reconcile** remote scheduled/sent posts before retrying; never blindly double-post. On credential mismatch, incorrect handle, quota/full queue or revoked approval, fail closed. Monitor actual pending Buffer queue; internally target <=8 of 10 pending slots/channel to leave flexibility for manual additions.
- Implement `--dry-run` default and explicit `--execute` only for cryptographically hash-bound, unexpired, tenant-scoped owner-approved exact payload and slot. Include approval identity, content/media hashes, evidence/rights checks, provider principal and bounded cost.

### D. Credential provisioning: user will supply the API key later (P2)

- Owner signs up/logs into Buffer, verifies email/ownership, connects both owned X profiles via Buffer's sanctioned OAuth UI, then generates a personal API key at https://publish.buffer.com/settings/api.
- Access key must have minimum necessary permissions (read channels/posts, create approved posts, metrics if allowed). It currently can expire after at most one year. Implement secret rotation before expiry.
- Key must never go into Git, README, agent chat prompts, test fixtures, terminal history, command-line argv, printed environment, public logs or remote error reports. Use a server secret manager or Linux service credential (e.g. systemd `LoadCredential`) and a least-privileged publisher-only runtime. Do not modify global Zodex/Codex/Hermes credentials.
- Provide an operator-only secret installation guide and `provider doctor` that verifies presence and capabilities without revealing value. If not connected, report `BLOCKED_AWAITING_CREDENTIALS` for live operations and continue coding/testing everything else.
- Strict network egress to reviewed Buffer API endpoint; redact Authorization and all sensitive fields; bound retry/backoff and connection timeout. Rate-limit and budget ceilings are durable.

### E. Editorial GTM and US-first content schedule (P3)

- Maintain separate brands/voices: RetroPick is a truthful product/market-structure account; founder is a genuine first-person technical builder and opinion account. DO NOT copy-paste substantially similar text across accounts, overclaim demand, audit, mainnet, profit, execution depth or personal achievements.
- Initial sustainable cadence: RetroPick two original English posts/day; founder 1–2 original posts/day. Allow 2–3 each only with sufficient meaningful verified sources and quality. Mix demo screenshots captured only from RetroPick-owned tested UI, build-in-public evidence, insights, no manufactured product proof.
- Schedule by *target audience zone* using IANA `America/New_York`, `America/Los_Angeles` and `Europe/London`, display in `Asia/Jakarta`, persist UTC `dueAt`. Test DST Europe 2026-10-25 and US 2026-11-01, dates/slots across WIB midnight. Candidate experiments: 09:00 New York, 09:00 Los Angeles, alternate 13:00 New York; these are research hypotheses not proved optimal times.
- Produce a previewable 7-day content plan but DO NOT submit the entire week without packet-level or scoped immutable batch owner approval. Buffer has ten simultaneous scheduled posts/channel; use queue refills. Buffer owns future publishing at `dueAt`, your local scheduler only refills approved queue and reconciles after the fact. No duplicate cron or future second provider publishes.

### F. Required real publishing acceptance: exactly two distinct real X posts (P4)

The user's requested integration test is **one meaningful actual public post on each connected account**, after exact payload approval. This request does not approve arbitrary copy/time/media; follow existing V4 exact payload approval rules. Draft candidate concepts only:
- `@RetroPickMarket`: a concise, evidenced question about launchpad-to-orderbook graduation and the importance of real quoted liquidity, clearly identifying verified testnet/documentary status as relevant.
- `@iHateModelsss`: the genuine technical distinction between passing tests and production trading readiness, with a question about state transitions or settlement reliability. Any first-person claims require owner attestation.

For each brand independently:
1. Discover and validate authenticated X channel `service`, handle and ownership from Buffer. No guessing.
2. Validate current evidence, permissible product claims, rights, copy length, authentic voice, unique content and safe media.
3. Present immutable final preview with exact account, final copy, time (UTC + WIB + audience zone), evidence refs, payload hash, expiry and cost. Obtain specific human approval (can approve a closed two-post test batch) and preserve it.
4. Schedule using Buffer GraphQL `createPost` with `customScheduled` and `automatic`, after checking that scheduled time is still future. Persist provider post ID and redacted receipt, then query scheduled state to verify exact ID, channel and text.
5. AFTER Buffer transmits at due time, query `sent` state for that post and matching content/account. Fetch real public X permalink from a supported provider field if documented, otherwise have owner supply exact permalink and validate with authorized public/native verification. **Never invent an X URL from a guessed post ID.**
6. Mark `END_TO_END_VERIFIED` only if exact public X author+content+URL are independently verified, provider says `sent`, hash and approval match, and separately store observed metrics/freshness (`metricsUpdatedAt`). If permalink is not verified, say `SENT_PROVIDER_VERIFIED__PERMALINK_PENDING`.
7. Store **two distinct** append-only acceptance receipts with actual provider IDs, posting times and public URLs (if verified), plus a cross-tenant isolation receipt. Stop after exactly two posts, unless owner separately approves more.
8. For missing channel/key/approval or provider failures, return honest `BLOCKED`, `SCHEDULED_ONLY`, or `FAILED` with evidence and minimum owner action; NEVER claim a fake live success or blindly resend.

### G. Research and daily loop additions (P5)

- Preserve V4 bounded research and official-source dates. Agent Reach/Scrapling permitted parser/approved source use is allowed; NOT cookie-based, stealth or Playwright automation of X. Web search indexes can discover public X URLs, but must be labeled discovery-only, not verified fresh X activity/metrics.
- Add a daily 5+5 founder briefing (five supported accomplishments or truthful missing slots, five prioritized agent suggestions). Inputs: authorized GitHub activity, Beads, confirmed owner updates and research; avoid converting git commits into automatically verified production achievements.
- Queue 15–30 researched potential X conversations for owner-operated authentic engagement and research up to 10–20 high-fit prospects/day for selective human outreach. NO bulk unsolicited auto DMs or AI auto-replies.
- Collect Buffer post metrics (personal API key) and UTM-tagged first-party product events. Preserve `UNKNOWN` separate from real zero and avoid assuming US audience from publication time alone.

### H. Tests, security, QA and rollback (P6)

Add deterministic integration tests for: mismatched X account, wrong Buffer channel, cross-brand hash reuse, expired source/approval, paid/blocked scopes, empty credentials, auth failures, 429, 500, GraphQL success HTTP 200 with `errors`, provider `MutationError`, timeout after remote success, multiple workers, duplicate queue submissions, media licensing, queued-vs-sent distinction, scheduled-post capacity, DST changes, metric lag, unknown permalink, key revocation and backup/restore.

Maintain original V3/V4 tests and source integrity. Produce `docs/v5/ARCHITECTURE.md`, `docs/v5/BUFFER_SETUP.md`, `docs/v5/PUBLISHING_ACCEPTANCE.md`, `docs/v5/SECURITY.md`, `docs/v5/ROLLBACK.md`, an ADR for Buffer-vs-Postiz, and redacted machine-readable receipts.

### I. Suggested new CLI surface (implement; not currently present)

```bash
./gtm provider doctor --provider buffer --brand retropick --json
./gtm provider channels --provider buffer --brand founder --json
./gtm publishing preview --brand retropick --packet-id PACKET_ID --target-zone America/New_York --local-slot '2026-10-27T09:00' --json
./gtm publishing approve --brand retropick --file APPROVAL_JSON --json
./gtm publishing schedule --brand retropick --approved-id ID --provider buffer --dry-run --json
./gtm publishing schedule --brand retropick --approved-id ID --provider buffer --execute --json
./gtm publishing reconcile --brand retropick --provider-post-id ID --json
./gtm publishing acceptance --brand founder --json
./gtm daily today --json
```

### J. Required report and success definition

Report:
```
Git branch / SHA / dirty state / changes:
V4 baseline verified tests: PASS | FAIL | BLOCKED
Buffer Free API capability / contracts: VERIFIED | CHANGED
Secret status: CONNECTED | MISSING | EXPIRED (NEVER VALUE)
RetroPick X channel: VERIFIED | BLOCKED
Founder X channel: VERIFIED | BLOCKED
Offline tests: PASS | FAIL
RetroPick actual post: DRAFT | APPROVED | SCHEDULED | SENT | END_TO_END_VERIFIED | BLOCKED
Founder actual post: DRAFT | APPROVED | SCHEDULED | SENT | END_TO_END_VERIFIED | BLOCKED
Provider IDs / hashes / timestamps / public X links (only when verified):
Real metrics and observation freshness / unknowns:
Cost, quota, retries, redacted logs:
Risk, source rights, remaining action:
Rollback and API key rotation plan:
```

**Definition of done:** V4 unchanged and tested; Buffer integration implemented and secured; only authorized exact posts queued; *two* actual non-duplicate X posts published at the correct accounts, separately verified by public URL when possible; truthful metrics and receipts; restart/retry/isolation tests; simple CLI; full documentation. If missing credentials or approval, do all implementable work and report the precise live blocker; no fake verified state. Do not push or merge to main absent an explicit owner directive.
