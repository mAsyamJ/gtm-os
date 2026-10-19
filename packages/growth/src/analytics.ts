import { z } from 'zod';
import { parseWith, readStructured } from '../../core/src/workspace.js';
import { GtmError, hashObject } from '../../observability/src/index.js';
import { IdSchema, TenantSchema, TimeSchema, type Tenant } from '../../schemas/src/index.js';
import { screenUntrusted } from '../../research/src/index.js';
import { OperationsStore } from '../../operations/src/store.js';
import { operationsContext, readonlyOperations } from '../../operations/src/common.js';

export const TAXONOMY = {
  retropick: ['landing_view', 'launchpad_view', 'market_detail_view', 'wallet_connect_started', 'wallet_connected', 'trade_intent_started', 'trade_submitted', 'trade_confirmed', 'launch_flow_started', 'launch_flow_completed', 'return_visit'],
  founder: ['credible_content_view', 'profile_view', 'repository_engagement', 'technical_conversation', 'collaboration_outcome'],
} as const;
export const FUNNELS: Record<Tenant, readonly string[]> = {
  retropick: ['landing_view', 'market_detail_view', 'trade_intent_started', 'trade_confirmed'],
  founder: ['credible_content_view', 'profile_view', 'repository_engagement', 'technical_conversation', 'collaboration_outcome'],
};
export const EventSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, label: z.literal('SYNTHETIC'), source: z.literal('SYNTHETIC_FIXTURE'),
  occurredAt: TimeSchema, subjectId: z.string().regex(/^synthetic-(?:retropick|founder)-[a-zA-Z0-9_.-]{1,80}$/),
  name: z.string().min(1).max(50), campaignId: IdSchema.nullable(), linkId: IdSchema.nullable(),
  privacy: z.literal('SYNTHETIC_IDENTIFIERS_ONLY_NO_PERSONAL_DATA'),
});
export type AnalyticsEvent = z.infer<typeof EventSchema>;
export const LinkSchema = z.strictObject({ id: IdSchema, tenant: TenantSchema, label: z.literal('SYNTHETIC'),
  campaignId: IdSchema, destination: z.url(), utmSource: z.literal('x'), utmMedium: z.literal('social'), utmContent: IdSchema });
export type Link = z.infer<typeof LinkSchema>;
export const DESTINATIONS: Record<Tenant, string> = { retropick: 'https://retropick.xyz/launchpad', founder: 'https://github.com/mAsyamJ' };

function scopedId(id: string | null, tenant: Tenant) {
  if (id !== null && !id.startsWith(tenant + '-')) throw new GtmError('TENANT_MISMATCH', 'Synthetic record/campaign/link identifier must be tenant-prefixed');
}
function eventValue(selected: Tenant, raw: unknown, now: Date): AnalyticsEvent {
  const value = parseWith(EventSchema, raw, 'synthetic event'); screenUntrusted(value);
  if (value.tenant !== selected || !value.subjectId.startsWith(`synthetic-${selected}-`)) throw new GtmError('TENANT_MISMATCH', 'Synthetic subject/event belongs to another tenant');
  for (const id of [value.id, value.campaignId, value.linkId]) scopedId(id, selected);
  if (!(TAXONOMY[selected] as readonly string[]).includes(value.name)) throw new GtmError('EVENT_TAXONOMY', 'Event is not in the selected proposed tenant taxonomy');
  if (Date.parse(value.occurredAt) > now.getTime()) throw new GtmError('EVENT_FUTURE', 'Future synthetic events cannot enter a current report');
  return value;
}
function linkValue(tenant: Tenant, raw: unknown): Link {
  const link = parseWith(LinkSchema, raw, 'synthetic outbound link'); screenUntrusted(link);
  if (link.tenant !== tenant || link.destination !== DESTINATIONS[tenant]) throw new GtmError('TENANT_MISMATCH', 'Destination is not the selected owner-specified candidate URL');
  for (const id of [link.id, link.campaignId, link.utmContent]) scopedId(id, tenant);
  return link;
}
export function linkUrl(link: Link): string {
  const url = new URL(link.destination);
  url.searchParams.set('utm_source', link.utmSource); url.searchParams.set('utm_medium', link.utmMedium);
  url.searchParams.set('utm_campaign', link.campaignId); url.searchParams.set('utm_content', link.utmContent);
  return url.toString();
}
export function registerLink(root: string, selected: unknown, raw: unknown) {
  const context = operationsContext(root, selected, true); const link = linkValue(context.tenant, raw);
  using store = new OperationsStore(root, context.tenant); const result = store.put('link', link);
  return { ...context, link, url: linkUrl(link), inserted: result.inserted, destinationVerified: false, liveTrackingInstalled: false };
}
export function ingestEvents(root: string, selected: unknown, raw: unknown, now = new Date()) {
  const context = operationsContext(root, selected, true);
  const batch = parseWith(z.strictObject({ tenant: TenantSchema, label: z.literal('SYNTHETIC'), events: z.array(EventSchema).max(10_000) }), raw, 'synthetic event batch');
  if (batch.tenant !== context.tenant) throw new GtmError('TENANT_MISMATCH', 'Batch belongs to another tenant');
  const events = batch.events.map(e => eventValue(context.tenant, e, now));
  using store = new OperationsStore(root, context.tenant);
  return store.transaction(() => {
    let inserted = 0, duplicates = 0;
    for (const event of events) { if (store.put('event', event).inserted) inserted++; else duplicates++; }
    return { ...context, received: events.length, inserted, duplicates, dedupe: 'TENANT_EVENT_ID_IMMUTABLE_PAYLOAD', audit: store.verify() };
  });
}
export function ingestEventFile(root: string, selected: unknown, path: string, now = new Date()) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  if (!new RegExp(`^growth/analytics/inbox/${tenant}/[a-zA-Z0-9][a-zA-Z0-9_.-]*\\.json$`).test(path)) throw new GtmError('ANALYTICS_SCOPE', 'Synthetic event files must be in the selected tenant analytics inbox');
  return ingestEvents(root, tenant, readStructured(root, path), now);
}

export function metricDictionary(selected: unknown) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  return TAXONOMY[tenant].map(name => ({ metric_id: `${tenant}.${name}`, tenant, label: 'SYNTHETIC', owner: 'analytics-attribution',
    event_source: 'SYNTHETIC_FIXTURE', event_definition: `Count of unique synthetic event IDs named ${name}; candidate taxonomy, feature availability and live instrumentation unverified`,
    denominator: 'None for raw count; ordered funnel conversion uses unique entry-stage subjects', dedupe_key: 'tenant + event.id; conflicting payloads reject the whole batch',
    window: 'Explicit half-open UTC reporting interval [start,end)', known_bias: 'Synthetic fixture only; no customer behavior, onchain proof, audience impact, revenue or causality inferred',
    privacy_classification: 'SYNTHETIC_IDENTIFIERS_ONLY_NO_PERSONAL_DATA' }));
}

export function analyticsFixture(selected: unknown, now = new Date()) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  const day = now.toISOString().slice(0, 10).replaceAll('-', ''); const base = Date.parse(now.toISOString().slice(0, 10)) - 2 * 86400_000;
  const campaignId = `${tenant}-campaign-${day}`, linkId = `${tenant}-link-${day}`;
  const link = LinkSchema.parse({ id: linkId, tenant, label: 'SYNTHETIC', campaignId, destination: DESTINATIONS[tenant], utmSource: 'x', utmMedium: 'social', utmContent: `${tenant}-content-${day}` });
  const events: AnalyticsEvent[] = [];
  function add(subject: string, name: string, minutes: number, linked = false) {
    events.push(EventSchema.parse({ id: `${tenant}-${day}-${subject}-${name}`, tenant, label: 'SYNTHETIC', source: 'SYNTHETIC_FIXTURE',
      occurredAt: new Date(base + minutes * 60_000).toISOString(), subjectId: `synthetic-${tenant}-${day}-${subject}`, name,
      campaignId: linked ? campaignId : null, linkId: linked ? linkId : null, privacy: 'SYNTHETIC_IDENTIFIERS_ONLY_NO_PERSONAL_DATA' }));
  }
  const stages = FUNNELS[tenant];
  stages.forEach((name, i) => add('a', name, 10 + i * 10, i === 0));
  stages.slice(0, -1).forEach((name, i) => add('b', name, 80 + i * 10, i === 0));
  stages.forEach((name, i) => add('c', name, 150 + i * 10));
  add('d', stages.at(-1)!, 240); add('d', stages[0]!, 250);
  if (tenant === 'retropick') { add('a', 'trade_submitted', 35); add('b', 'wallet_connect_started', 115); add('b', 'trade_submitted', 120); }
  events.push(events[0]!); // exact delivery duplicate, deliberately not an extra subject/conversion.
  return { link, batch: { tenant, label: 'SYNTHETIC' as const, events }, expected: { entrySubjects: 4, orderedTerminalSubjects: 2, attributed: 1, unattributed: 1 } };
}
export function seedAnalytics(root: string, selected: unknown, now = new Date()) {
  const fixture = analyticsFixture(selected, now); const link = registerLink(root, selected, fixture.link);
  return { link, events: ingestEvents(root, selected, fixture.batch, now), expectedFixtureOnly: fixture.expected };
}

export function analyticsReport(root: string, selected: unknown, options: { synthetic: unknown; period?: string }, now = new Date()) {
  const context = operationsContext(root, selected, options.synthetic); const period = options.period ?? '7d';
  if (!['1d', '7d', '30d'].includes(period)) throw new GtmError('PERIOD_INVALID', 'Period must be 1d, 7d or 30d', 2);
  const end = now.getTime(), start = end - Number(period.slice(0, -1)) * 86400_000;
  using store = readonlyOperations(root, context.tenant);
  const all = (store?.list('event') ?? []).map(e => eventValue(context.tenant, e, now));
  const events = all.filter(e => Date.parse(e.occurredAt) >= start && Date.parse(e.occurredAt) < end).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
  const links = (store?.list('link') ?? []).map(v => linkValue(context.tenant, v));
  const stages = FUNNELS[context.tenant];
  const subjects = [...new Set(events.filter(e => e.name === stages[0]).map(e => e.subjectId))].sort();
  const counts = stages.map(() => 0); const completions: AnalyticsEvent[] = [];
  for (const subject of subjects) {
    const timeline = events.filter(e => e.subjectId === subject); let previous = -Infinity;
    for (const [index, stage] of stages.entries()) {
      const match = timeline.find(e => e.name === stage && Date.parse(e.occurredAt) > previous);
      if (!match) break;
      previous = Date.parse(match.occurredAt); counts[index] = counts[index]! + 1;
      if (index === stages.length - 1) completions.push(match);
    }
  }
  const attribution: { conversionEventId: string; campaignId: string | null; touchEventId: string | null; reason: string }[] = [];
  for (const conversion of completions) {
    const touches = all.filter(e => e.subjectId === conversion.subjectId && e.name === stages[0] &&
      Date.parse(e.occurredAt) <= Date.parse(conversion.occurredAt) && Date.parse(e.occurredAt) >= Date.parse(conversion.occurredAt) - 7 * 86400_000 &&
      Date.parse(e.occurredAt) < end).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id));
    const touch = touches[0]; const traceable = touch?.campaignId && touch.linkId && links.some(l => l.id === touch.linkId && l.campaignId === touch.campaignId);
    attribution.push({ conversionEventId: conversion.id, campaignId: traceable ? touch!.campaignId : null, touchEventId: traceable ? touch!.id : null,
      reason: traceable ? 'LAST_ENTRY_TOUCH_REGISTERED_IDS_WITHIN_7D' : 'NO_TRACEABLE_TOUCH_IDS_OR_REGISTERED_LINK' });
  }
  const cohort = subjects.length; const terminal = counts.at(-1) ?? 0;
  return { ...context, kind: 'analytics-report', status: events.length ? 'SYNTHETIC_DATA' : 'NO_DATA', period,
    window: { start: new Date(start).toISOString(), end: now.toISOString(), timezone: 'UTC', interval: '[start,end)' },
    eventCount: events.length, dataSha256: hashObject({ events: all, links }), eventSourceHashes: events.map(e => ({ id: e.id, sha256: hashObject(e) })),
    counts: Object.fromEntries(TAXONOMY[context.tenant].map(name => [name, events.filter(e => e.name === name).length])),
    dictionary: metricDictionary(context.tenant),
    funnel: { definitionStatus: 'PROPOSED_SYNTHETIC_ONLY_NOT_VALIDATED_LIVE', ordering: 'Strictly increasing timestamps for the same synthetic subject, within the reporting interval',
      entrySubjects: cohort, terminalSubjects: terminal, conversionRate: cohort ? terminal / cohort : null,
      stages: stages.map((name, index) => ({ name, subjects: counts[index], denominator: cohort, rateFromEntry: cohort ? counts[index]! / cohort : null })),
      caveat: 'A wallet click or trade submission is not a confirmed trade; a conversation or repository event is not revenue. Orphan or out-of-order terminal events are excluded.' },
    attribution: { method: 'LAST_SYNTHETIC_ENTRY_TOUCH_CREDITED_ONLY_IF_TRACEABLE', lookbackDays: 7, denominator: terminal,
      attributed: attribution.filter(a => a.campaignId !== null).length, unattributed: attribution.filter(a => a.campaignId === null).length,
      outcomes: attribution, linkRegistry: links.map(link => ({ ...link, url: linkUrl(link), destinationVerified: false })),
      limits: ['Missing campaign/link IDs or an unregistered/mismatched link remains unattributed', 'No cross-device/person/tenant joins, probabilistic attribution, causal lift or revenue inference'] },
    validation: { eventIdsDeduplicated: true, noPersonalDataAccepted: true, actualLiveInstrumentation: false, audit: store?.verify() ?? { valid: true, records: 0, headHash: '0'.repeat(64) } } };
}
