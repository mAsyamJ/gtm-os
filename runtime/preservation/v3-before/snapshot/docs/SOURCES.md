# Reference sources to verify during installation

- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Skill spec: https://agentskills.io/specification
- Skills authoring: https://developers.openai.com/plugins/build/skills
- Marketing Skills: https://github.com/coreyhaines31/marketingskills
- Social Media Skills: https://github.com/social-media-skills/skills
- Awesome GTM Skills: https://github.com/composio-community/awesome-gtm-skills
- Official X MCP: https://docs.x.com/tools/mcp
- Official xurl: https://github.com/xdevplatform/xurl
- Postiz: https://github.com/gitroomhq/postiz-app
- video-shotcraft: https://github.com/Vincentwei1021/video-shotcraft
- Activepieces: https://github.com/activepieces/activepieces
- Crawl4AI: https://github.com/unclecode/crawl4ai

Research date: 2026-10-17. All licensing, pricing and API claims require actual revision/source audit before executable install.

## Phase A sources actually inspected

- Governing local specification: root FOUNDER_RETROPICK_GTM_OS_MASTER_PROMPT_V2.md and CODEX_GTM_OS_V2_PHASED_EXECUTION.md; bundled docs copies were byte-identical at inspection.
- [Official Codex skill discovery](https://learn.chatgpt.com/docs/build-skills), fetched 2026-10-17 through the canonical developers.openai.com/codex/skills redirect: project .agents/skills layout and required name/description metadata.
- [Official AGENTS discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), fetched 2026-10-17 through the canonical developers.openai.com/codex/guides/agents-md redirect: scope/merge discovery and default document size limit. Local policy explicitly forbids nested rules relaxing root restrictions.
- [Agent Skills specification](https://agentskills.io/specification), fetched 2026-10-17: metadata constraints, path/name consistency and optional fields. No upstream executable installed.
- Existing local XERJ agent-tooling corpus: caveman/tests/verify_repo.py:87, commit d262ab3882952a59312ff3537cd86d894523c5ab. Inspected its handling of multiline descriptions; our implementation independently uses PyYAML safe parsing. No peer code copied; no new corpus cloned. XERJ indexed 128 canonical files/190 records with one code file, exit 0; hidden skill files were excluded and checked directly.
- Local executable version probes, hashes and installed Python package license metadata: evidence/phase-a-tools.json. They do not attest upstream signatures or commercial asset eligibility.

Unfetched links above remain candidates, not verified support for product features, API prices or licenses. No source card, public biography, product capability or financial claim was fabricated. Receipts/manifests identify local revisions; no creative asset adaptation occurred.


## Phase B sources actually inspected

- Official better-sqlite3 repository package manifest: https://github.com/WiseLibs/better-sqlite3/blob/master/package.json. Exact npm version 13.0.3 pins gitHead dbc2ea1165fef1f599b9be12faea33fa5e9d7ffb; archive integrity was checked before source extraction. Reviewed lib/database.js and lib/methods/transaction.js; no peer code copied.
- Official Zod introduction https://zod.dev/ and Vitest guide https://vitest.dev/guide/ were fetched 2026-10-17 for strict TypeScript/runtime validation and test-runtime requirements. Exact installed versions and licenses come from registry/local package metadata and the lockfile, not an assumed latest version.
- Existing MCP SDK corpus https://github.com/modelcontextprotocol/typescript-sdk, local commit 9bc40e903fde15534ec06ff4c1347d47000dbe16: util/schema.ts:27–31 shows safeParse at a typed boundary; no copied code.
- Public npm registry metadata was read for the exact selected dependencies. No authenticated provider or online audit request was made; install lifecycle scripts were disabled. evidence/phase-b-dependencies.json records local metadata/integrity limits.
- Whole-project XERJ refresh failed on a retained document's inferred-family change. Fresh scoped Python and better-sqlite3 library indexes succeeded with zero skipped code. This is a bounded source-retrieval limitation, not a complete-index success claim.

## Phase C sources actually inspected

- [Marketing Skills pinned tree](https://github.com/coreyhaines31/marketingskills/tree/365b412152b9542499ca1439426f7fc3cc92bb65), fetched 2026-10-17: tracked skill/script/manifest names, selected content-strategy 2.1.3 and MIT notice. Upstream metrics are not brand evidence.
- [Social Media Skills pinned tree](https://github.com/social-media-skills/skills/tree/f28cef2b7067ec64e79c9d85421c022c06659e03), fetched 2026-10-17: calendar/thread bodies 1.0.0, MIT notice, x-growth exclusions, actual names and script/plugin inventories.
- [Composio GTM Skills pinned tree](https://github.com/composio-community/awesome-gtm-skills/tree/8c5f5794eb06dad32cc46811677142fbc8a15f4f), fetched 2026-10-17: README licensing assertion, actual skill names, ICP/positioning examples and provider/dependency signals. No full license notice; no content copied.
- Selected tenant VOICE/POSITIONING/MESSAGING bytes: research/inbox files and phase-c-*-sources.json contain exact revisions, observation/expiry and local-use permission. These support governance constraints only. Product URLs and personal profiles remain candidates; no product/founder fact is invented from their names.
- XERJ scoped package index/search located SourceSchema and TenantStore.putSource; thread-reference structured search failed, so architecture.md:17 was read directly for the outline principle. No upstream runtime code copied; sample method references preserve MIT notices.

## Phase D sources actually inspected

- [Satori source at f725edd4ca99a4c86cfd3dfbc1d50123e47e6404](https://github.com/vercel/satori/tree/f725edd4ca99a4c86cfd3dfbc1d50123e47e6404), matching npm 0.62.0 gitHead: local font buffers, pure element objects, onNodeDetected geometry, source options and box sizing. XERJ indexed 82 source files/1131 records and retrieved layout/font passages; no implementation code copied. Scoped project refresh covered 13 files/149 records; whole-project refresh still hit the recorded PROJECT_STATUS classification conflict.
- [Sharp official installation documentation](https://sharp.pixelplumbing.com/install/), npm 0.35.5 metadata, local native round trip and installed dependency notices. Source/native versions pinned; no install scripts enabled.
- [Playwright BrowserType documentation](https://playwright.dev/docs/api/class-browsertype), playwright-core 1.64.1 package and local Chrome launch in a new offline profile. No persistent user profile or real product page accessed.
- [FFmpeg official documentation](https://ffmpeg.org/ffmpeg.html), existing local -version/-L and actual render/probe output. GPL/libx264 build and exact executable hashes recorded; no system tool redistribution.
- Existing distribution DejaVu Sans regular/bold bytes and complete relevant copyright notice from /usr/share/doc/fonts-dejavu-core/copyright. Only font files/notice copied; no Debian packaging files or user assets.
