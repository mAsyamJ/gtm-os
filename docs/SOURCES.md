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
