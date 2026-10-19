---
name: video-editing
description: "Use for motion video assembly, subtitle/audio edit, render and verification."
---

# video-editing

## Preconditions

Explicit `tenant` is required, except structural repo audits. Read root `AGENTS.md`, applicable brand rules, current evidence and workflow definition. Verify enabled capabilities, cost gate and source trust. No automatic publishing or external writes.

## Method

1. Resolve authoritative facts and permission boundaries. Missing evidence must be marked `UNVERIFIED`.
2. Prefer local FFmpeg for deterministic assembly, preserve edit project, run ffprobe and frame/peak/caption QA; never spoof product UI.
3. Write structured local artifact with tenant, source IDs/timestamps, output hash and approval status.
4. Run relevant independent factual/brand/accessibility/privacy/license checks.
5. Hand off to the next role in the workflow; a local draft or QA pass is **not** publication permission.

## Return contract

Return **MP4+source+QA receipt**, storage path, validation outcome, measured data vs hypothesis, blockers and explicit owner actions if any. If unavailable, output `BLOCKED` or honest offline fixture instead of claiming integration success.
