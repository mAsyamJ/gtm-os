---
name: social-publishing
description: "Use for social publishing preparation, approvals, account matching, receipts and dry-run."
---

# social-publishing

## Preconditions

Explicit `tenant` is required, except structural repo audits. Read root `AGENTS.md`, applicable brand rules, current evidence and workflow definition. Verify enabled capabilities, cost gate and source trust. No automatic publishing or external writes.

## Method

1. Resolve authoritative facts and permission boundaries. Missing evidence must be marked `UNVERIFIED`.
2. Check final hash, account ID/handle, scopes, costs and explicit owner approval; dry-run/mock by default; no external writes without gates.
3. Write structured local artifact with tenant, source IDs/timestamps, output hash and approval status.
4. Run relevant independent factual/brand/accessibility/privacy/license checks.
5. Hand off to the next role in the workflow; a local draft or QA pass is **not** publication permission.

## Return contract

Return **preview/blocked status or verified receipt**, storage path, validation outcome, measured data vs hypothesis, blockers and explicit owner actions if any. If unavailable, output `BLOCKED` or honest offline fixture instead of claiming integration success.
