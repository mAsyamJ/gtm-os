# V5 rollback and recovery

Revision: v5-r1. Audience: trusted operator. Approval: no destructive restoration or public deletion is implied by this guide. Original project instructions; no external assets.

Stop invoking the V5 refill/execute commands and stop an operator-installed publisher service if present. No service/timer is installed by this change. Buffer already owns accepted future posts: disabling local code does not unschedule them. Inspect exact provider IDs and reconcile pending jobs. For each genuine owner-approved cancellation, validate the remote job remains scheduled, cancel that ID, and preserve the redacted result. Never delete an already-sent post as an automatic rollback.

Keep V5 SQLite/receipts and the shared quota ledger. Uncertain submissions remain RECONCILE_REQUIRED; they are not reset to APPROVED. Restart with the same stores and query scheduled/sent posts before any resubmission decision. Zero/multiple recovery matches require operator investigation. Preserve actual provider IDs and logs without credentials.

The V4 source/data snapshot is recorded in `runtime/preservation/v5/20261024T043335533692Z/receipt.json`. Stop writers before a consistent SQLite backup. Restore backups into a separate directory, run integrity/audit checks, compare counts and hashes, and preserve any newer active observations before requesting explicit destructive restore approval. Never copy a live SQLite file without its WAL consistency, reset the dirty checkout or overwrite historical acceptance receipts. Reverting source alone does not restore ignored runtime data or cancel remote posts.

Rotate/revoke a Buffer key only through the owner's protected operator process. Replace the service credential and expiry metadata atomically with the service stopped, then rerun identity/capability checks. Do not rotate or inspect global Codex/Zodex/Hermes keys. Keep quota history across rotation. If principal/channel changes, invalidate pending scheduling approvals and create new exact previews.

Return to V3/V4 manual CLI paths without changing their native-only approvals. They remain usable with their original evidence/owner gates. Existing V4 HOLD campaigns do not acquire publication status from V5 acceptance. Revalidate with `pnpm check` and a new append-only V5 verifier receipt after recovery.
