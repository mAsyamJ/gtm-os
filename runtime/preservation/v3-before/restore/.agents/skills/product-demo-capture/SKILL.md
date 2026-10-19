---
name: product-demo-capture
description: "Use for authorized RetroPick browser screenshots, deterministic product demos and release visual QA."
---

# product-demo-capture

## Preconditions

Explicit `tenant` is required, except structural repo audits. Read root `AGENTS.md`, applicable brand rules, current evidence and workflow definition. Verify enabled capabilities, cost gate and source trust. No automatic publishing or external writes.

## Method

1. Resolve authoritative facts and permission boundaries. Missing evidence must be marked `UNVERIFIED`.
2. Use Playwright with safe fixture accounts, mask wallets/private info, verify page actions, capture legitimate UI and log source revision.
3. Write structured local artifact with tenant, source IDs/timestamps, output hash and approval status.
4. Run relevant independent factual/brand/accessibility/privacy/license checks.
5. Hand off to the next role in the workflow; a local draft or QA pass is **not** publication permission.

## Return contract

Return **timestamped screenshots/recording + trace**, storage path, validation outcome, measured data vs hypothesis, blockers and explicit owner actions if any. If unavailable, output `BLOCKED` or honest offline fixture instead of claiming integration success.
