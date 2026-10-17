# SKILLS.md — discoverable skills and ownership index

This is a **human-readable registry**. Codex reads **individual** `.agents/skills/<skill-name>/SKILL.md` (with required YAML frontmatter); this index is not a replacement for those files.

Workflow use order: choose tenant → confirm evidence → invoke narrow relevant skill(s) → produce schema-valid artifact → independent validation → human approval gate for any external writes → reconciliation.

| Domain | Skills | Department | Trust status |
|---|---|---|---|
| Strategy | `gtm-orchestrator`, `icp-positioning`, `campaign-architecture`, `launch-playbook` | strategy, campaigns | local reviewed draft |
| Discovery | `research-intelligence`, `customer-discovery`, `claim-verification` | research | local reviewed draft |
| Founder & DevRel | `founder-led-growth`, `developer-relations`, `brand-voice` | brands/founder | local reviewed draft |
| Content and X | `x-thread-writing`, `content-repurposing`, `social-publishing`, `community-engagement` | content, distribution | publish blocked |
| Creative | `graphic-design`, `video-storyboard`, `video-editing`, `product-demo-capture` | creative | renderer not installed |
| Acquisition | `seo-geo-content`, `landing-page-cro`, `creator-distribution`, `partnership-outreach` | growth, relationships | read-only by default |
| Measurement | `analytics-attribution`, `growth-experiments`, `weekly-founder-brief` | growth | synthetic until connected |
| Governance | `tenant-router`, `security-compliance`, `release-qa`, `cost-optimization` | agents, policy | local reviewed draft |

Third-party skill references are candidates to audit, not silently activated: Corey Haines Marketing Skills, Social Media Skills, Awesome GTM Skills, Codex skill-creator. Maintain pinned commit and license records under `.agents/vendor/manifest.lock.yaml` after on-machine review.
