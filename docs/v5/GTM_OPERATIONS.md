# V5 daily and weekly operation

Revision: v5-r1. Audience: owner and GTM operator. Inputs: authorized evidence/reviews, confirmed activity statements, scoped candidate files and real provider/first-party observations. Original local plans and prose; source rights remain per-card. Approval: planning authorized, publishing requires exact separate owner decisions.

```bash
./gtm publishing calendar --brand retropick --json
./gtm content calendar --brand founder --days 7 --json
./gtm daily today --brand founder --json
./gtm research conversations --brand retropick --json
./gtm research prospects --brand founder --json
./gtm analytics learning --brand founder --json
```

These commands create local review artifacts, not scheduled posts. Legacy `content calendar --days 14` remains unchanged. The owner's updated cadence is five posts/week for each account in America/New_York. Discovery reads each channel's existing recurring schedule without changing it. A schedule observed within 24 hours supplies exact weekly slots; timezone/count/duplicate mismatches produce no calendar entries and require review. Until discovery or after staleness, five weekday 09:00 slots are visibly proposed rather than provider verified. UTC persistence and WIB display remain; a past slot is visibly past and unavailable proof is HOLD. Topic evidence candidates do not assert that a finished post exists. The full week is never submitted without immutable packet-level approvals.

The founder loop returns exactly five supported accomplishments or missing slots and five suggestions. For authorized GitHub/Beads activity, confirmed owner updates or research, first ingest/review exact statements through existing V3 evidence commands. `daily today --brand founder --file research/inbox/founder/FILE.json` accepts tenant `founder`, current WIB `date`, and at most five accomplishments with `text`, `evidenceId`, `evidenceSha256`, and kind `GITHUB_ACTIVITY`, `BEADS`, `OWNER_CONFIRMED`, or `RESEARCH`. Text must be an exact permitted reviewed statement; OWNER_CONFIRMED requires an owner-attested source. Activity records do not certify production readiness or personal achievements. There is no hidden credential-based GitHub/Beads polling or invented fill for missing slots.

For research queues, supply `--file research/inbox/TENANT/FILE.json`. Strict input has `tenant`, kind `conversations` or `prospects`, and candidates with `id`, public `url`, exact `evidenceId`, `evidenceSha256`, permitted `statement`, `relevance`, actual discovery `observedAt`, provenance `PUBLIC_SEARCH_DISCOVERY` or `AUTHORIZED_OWNER_RESEARCH`, and optional `entityId`. Candidate fit must bind current reviewed source statements. Discovery timestamps do not certify the publication date or fresh X activity. Prospects lacking independently reviewed current role/identity remain HOLD. Search-index URLs remain discovery-only; the owner opens native X and decides whether/how to engage personally. No bulk DMs, replies, scraping or account automation occurs. Smaller queues and evidence gaps are valid results.

After a genuine approved post is sent, `publishing metrics --brand TENANT --job ID` fetches Buffer metrics and preserves provider/observation refresh clocks. API permissions or ~daily refresh lag may leave values unknown. Do not infer zero, US audience, qualified acquisition or causal lift from a scheduled time or impression count.

`metrics product-import --brand TENANT --file growth/inbox/TENANT/FILE.json` accepts an array of authorized exports with tenant, unique id, known sent jobId, observedAt, event, nullable value, `utm` (`source: x`, `medium: organic_social`, campaign, content), `origin: AUTHORIZED_FIRST_PARTY_EXPORT`, original export sourceSha256, operational definition and actual consentReviewed. Choose an opaque UTM content value before drafting; all four UTM values must match an exact link in the approved post. Do not embed an envelope's own hash into its URL. Imports deduplicate IDs, reject conflicting changes and pre-publication observations, enforce tenant scorecards and remain owner-attested rather than independently product-verified. The initial two questions contain no product link, so they cannot support per-post product acquisition attribution.

`analytics learning` combines V3 scorecards with the latest observed V5 snapshots in the completed UTC half-open weekly window. It preserves source/refresh timestamps and nulls, reports missing observations and proposes one falsifiable next experiment. Overlapping cumulative snapshots are not summed. Real metrics/product instrumentation are not manufactured when disconnected. Product-side code changes outside this repository require separate permission.

Inside an operator-configured publisher runtime, `publishing tick --brand TENANT --execute` reconciles due/uncertain jobs, collects available sent metrics and refills only explicitly approved jobs. `--dry-run` performs no network requests. The supplied systemd template invokes one tenant at a time; it is not installed/enabled and has no timer. Buffer alone owns future delivery. For the initial acceptance, approve only the closed two-post test before running refill/tick.
