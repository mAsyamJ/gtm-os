# Genuine two-account publishing acceptance

Revision: v5-r1. Audience: owner/operator/QA. Inputs: separately scoped reviewed documentary sources, V5 packets, genuine owner approval, authenticated Buffer identities and public X proof. Asset source: original text only; no synthetic image, product screenshot or external media is proposed. Status: **BLOCKED_AWAITING_CREDENTIALS**, not live success.

Both actual provider doctors returned exit 4 with `BLOCKED_AWAITING_CREDENTIALS`, `identity: NOT_VERIFIED`, and zero network requests. No dedicated Buffer credential directory is available to this process. Buffer organizations, channel IDs, service IDs, ownership and permissions therefore remain unverified. No owner-approved V5 payload exists; no Buffer scheduling request or real acceptance receipt exists. Existing V4 HOLD campaigns remain unpublished.

`node scripts/prepare_v5.mjs` prepares one distinct local text packet for each account using current, separately reviewed source-pinned evidence. It also produces the seven-day calendar, truthful founder 5+5 and research queues. Candidate manifests under each tenant's `runtime/v5/.../candidates/` show exact text, content hash, documentary revision/license and proposed audience/UTC/WIB slot. They are `DRAFT_NOT_APPROVABLE_ACCOUNT_DISCOVERY_REQUIRED`: final execution payload hashes require real principal/channel discovery. If a proposed slot passes, choose a new slot and request fresh exact approval.

After credentials are provisioned, create final previews and present both exact payloads and times for a closed two-post owner approval. One RetroPick post discusses documented testnet graduation and quoted liquidity boundaries; the separate founder post asks about completion retry/state/receipt/balance reliability without claiming personal shipment or production readiness.

Acceptance is independent for each tenant:

1. Discover the exact active authorized X channel; never guess IDs from handles.
2. Validate current sources/reviews, immutable text/media/governance, rights, weighted length, account, future slot, quota and cost. Obtain genuine exact owner approval.
3. Schedule once; save remote post ID and redacted receipt. Independently reread the ID/channel/text/time. Report `SCHEDULED_ONLY` until actual transmission.
4. Reconcile `sent`, matching text/channel/slot and nonfuture `sentAt`. Report `SENT_PROVIDER_VERIFIED__PERMALINK_PENDING` until public verification succeeds.
5. Obtain the actual documented Buffer `externalLink`. Independently query X's [official oEmbed API](https://docs.x.com/x-for-websites/oembed-api) using that exact account/status URL. Compare returned author, URL and text, parsing only supported inert markup. Unsupported/truncated/changed markup cannot yield verified state; no widgets/scripts execute.
6. Only then write `END_TO_END_VERIFIED`, containing provider ID, exact approval/payload hashes, due/sent/observed times, real public URL, proof hash and metric refresh/unknowns. Credentials are absent from receipts.
7. The V5 verifier reports both tenant receipts and checks that real provider IDs/public URLs differ. Stop after exactly two posts; any discrepancy is a blocker, not a reason to silently post again.

The public verifier never invents a URL or fetches a guessed ID. Owner-supplied URLs alone are owner attestations. X oEmbed is a narrow verification exception; research still cannot scrape X, access cookies, automate the website, search via Buffer, or send replies/DMs. Buffer fields [reference](https://developers.buffer.com/reference).

Validation evidence is recorded append-only by `python3 scripts/verify_v5.py`. Offline SYNTHETIC tests establish local contracts and failure handling only. No two-account live receipt will be manufactured to close this gate.
