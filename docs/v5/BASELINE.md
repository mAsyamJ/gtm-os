# V5 baseline and preservation

Revision: v5-r1. Audience: owner, implementation reviewers and operators. Approval: engineering authorized; public actions require their own exact approval. Assets: repository-owned source and existing authorized local artifacts; no external media added.

The complete `GTM_OS_V5_Codex_Master_Prompt.md` was read before implementation. Initial checkout: `main`, SHA `c554a264d64356f87d01ba6ee41ca5c7339e6abc`, matching the local origin/main reference. No remote fetch was performed, so this is not a claim of current server parity. The V5 prompt was the only ordinary untracked file. Ignored runtime data stayed in place. Work proceeds on `feature/v5-buffer-publishing`; no push or merge is authorized.

The preceding read-only audit ran `pnpm check`: exit 0, 225 TypeScript tests, 43 Python tests, governance, Gitleaks and Semgrep passed. These are actual baseline results; the V5 verifier runs fresh checks rather than inheriting that pass. Six live tenant SQLite databases passed `quick_check`. Both historical HOLD packets passed source/payload/media validation. Historical preservation validated 364 source files and four database backup/restores.

Before implementation, `runtime/preservation/v5/20261024T043335533692Z/receipt.json` recorded 1,453 source/artifact copies and six consistent SQLite backups. Each backup was restored separately and passed integrity checks. V3/V4 runtime content and historical receipts were copied without changing their originals. Credentials, Beads/Dolt internals and global private state were excluded. The owner's ordinary untracked prompt was included. No reset or data migration was performed.

Historical V4 status remains `LOCAL_PIPELINE_VERIFIED_OWNER_AND_COVERAGE_GATES_BLOCKED`: two HOLD campaigns, incomplete source/current-role coverage, no proved publication or business outcome. V5 drafts and future posts cannot retroactively publish those campaigns.

XERJ's existing full-project prefix rejected the new CSV schema. A separate source-only `gtm-v5-source` prefix indexed packages successfully. Reference corpus `better-sqlite3` pins upstream `f8e2d5412082` (MIT); immediate transaction and backup implementations informed API usage. No upstream code was copied. Its corpus indexed with skipped junk, including one code-classified patch artifact; it is not described as complete coverage.

No project-local Codex hook configuration exists in the inspected locations. Vitest's test/hook timeouts are 15 seconds, not a demonstrated cause of the reported global 10-second Codex hook limit. Global credential/configuration files were not inspected and no hooks were disabled. Global hook diagnosis remains unavailable from this project evidence.

Reproduce current acceptance with `python3 scripts/verify_v5.py`. Receipts contain input paths, hashes, actual commands/exits and explicit live blockers. They do not copy secrets or claim complete adversarial isolation.
