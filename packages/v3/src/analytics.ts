import { z } from 'zod';
import { HashSchema, IdSchema, TenantSchema, TimeSchema } from '../../schemas/src/index.js';
import { GtmError, hashObject } from '../../observability/src/index.js';
import { screenUntrusted } from '../../research/src/index.js';
import { context, localInput, open, records, type Dataset } from './common.js';
import { publicationHistory, packetById } from './distribution.js';

export const Metric = z.strictObject({ tenant: TenantSchema, packetId: IdSchema, observedAt: TimeSchema,
  metric: z.enum(['impressions', 'engagements', 'qualified_engagements', 'link_clicks', 'qualified_acquisition', 'activation', 'retained_users',
    'developer_relationships', 'collaborations', 'technical_credibility', 'professional_opportunities']),
  value: z.number().finite().nonnegative().nullable(), denominator: z.number().finite().nonnegative().nullable(),
  windowStart: TimeSchema, windowEnd: TimeSchema, origin: z.literal('OWNER_EXPORT'),
  definition: z.string().min(10).max(500), sourceSha256: HashSchema,
  outcomeVerification: z.enum(['OWNER_ATTESTED', 'PLATFORM_VERIFIED', 'PRODUCT_VERIFIED']), semantics: z.literal('CUMULATIVE_SNAPSHOT') });
export type Metric = z.infer<typeof Metric>;
function csv(text: string): unknown[] {
  // Deliberately bounded RFC4180 parser, including quoted commas/newlines and doubled quotes.
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (quoted || !cell) quoted = !quoted; else throw new GtmError('CSV_INVALID', 'Unexpected CSV quote'); }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (ch === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (quoted) throw new GtmError('CSV_INVALID', 'Unclosed CSV quote');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift() ?? [];
  if (!headers.length || new Set(headers).size !== headers.length || headers.some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) throw new GtmError('CSV_INVALID', 'Invalid CSV headers');
  return rows.filter(r => r.some(Boolean)).map(r => {
    if (r.length !== headers.length) throw new GtmError('CSV_INVALID', 'CSV row width mismatch');
    return Object.fromEntries(headers.map((key, i) => [key, ['value', 'denominator'].includes(key) ? r[i] === '' || r[i] === 'UNAVAILABLE' ? null : Number(r[i]) : r[i]]));
  });
}
export function importMetrics(root: string, selected: unknown, path: string, dataset: Dataset = 'OBSERVED', now = new Date()) {
  const c = context(root, selected, dataset); const input = localInput(root, c.tenant, path, 'growth');
  const values = z.array(Metric).max(10000).parse(typeof input === 'string' ? csv(input) : input);
  for (const v of values) {
    screenUntrusted(v);
    if (v.tenant !== c.tenant || Date.parse(v.observedAt) > now.getTime() || Date.parse(v.windowEnd) > Date.parse(v.observedAt) || Date.parse(v.windowEnd) <= Date.parse(v.windowStart))
      throw new GtmError('METRIC_SCOPE', 'Metric tenant, timestamps or reporting window is invalid');
    if (v.outcomeVerification !== 'OWNER_ATTESTED') throw new GtmError('VERIFICATION_AUTHORITY', 'An uploaded export cannot self-assign platform or product verification', 3);
    if (c.tenant === 'founder' && ['qualified_acquisition', 'activation', 'retained_users'].includes(v.metric) || c.tenant === 'retropick' && ['developer_relationships', 'collaborations', 'technical_credibility', 'professional_opportunities'].includes(v.metric))
      throw new GtmError('METRIC_TENANT', 'Metric belongs to the other brand');
    const publication = publicationHistory(root, c.tenant, v.packetId, dataset).at(-1);
    if (publication?.state !== 'OWNER_REPORTED_PUBLISHED') throw new GtmError('PUBLICATION_UNKNOWN', 'Post metrics require a current publication receipt', 3);
    const publishedAt = new Date(String(publication.at));
    if (Date.parse(v.observedAt) < publishedAt.getTime() || Date.parse(v.windowEnd) < publishedAt.getTime())
      throw new GtmError('METRIC_SCOPE', 'Post observations must follow publication');
    // Freshness at publication preserves historical reporting without authorizing new publication.
    packetById(root, c.tenant, v.packetId, dataset, publishedAt);
  }
  using store = open(root, c.tenant, dataset);
  return store.transaction(() => {
    let inserted = 0;
    for (const v of values) {
      const id = `${c.tenant}-metric-${hashObject({ packetId: v.packetId, observedAt: v.observedAt, metric: v.metric, windowStart: v.windowStart, windowEnd: v.windowEnd }).slice(0, 24)}`;
      if (store.put('metric', { ...v, id, label: dataset === 'SYNTHETIC' ? 'SYNTHETIC' : 'OWNER_ATTESTED' }).inserted) inserted++;
    }
    return { ...c, inserted, duplicates: values.length - inserted, sourceQuality: 'OWNER_ATTESTED', audit: store.verify() };
  });
}
export function scorecards(root: string, selected: unknown, dataset: Dataset = 'OBSERVED', days = 7, now = new Date()) {
  const c = context(root, selected, dataset);
  if (!Number.isSafeInteger(days) || days < 1 || days > 90) throw new GtmError('INVALID_WINDOW', 'Report window must be 1–90 days', 2);
  const end = new Date(now); end.setUTCHours(0, 0, 0, 0); const start = new Date(end.getTime() - days * 86400000);
  const all = records(root, c.tenant, 'metric', dataset).filter(v => Date.parse(String(v.observedAt)) < end.getTime() && Date.parse(String(v.observedAt)) >= start.getTime());
  const latest = new Map<string, typeof all[number]>();
  for (const row of all) {
    const key = `${row.packetId}/${row.metric}/${row.windowStart}/${row.windowEnd}`;
    if (!latest.has(key) || String(latest.get(key)!.observedAt) < String(row.observedAt)) latest.set(key, row);
  }
  const cycles = records(root, c.tenant, 'cycle', dataset); const observed = [...latest.values()];
  const latestCycles = new Map<string, typeof cycles[number]>();
  for (const cycle of cycles) if (!latestCycles.has(String(cycle.cycleKey)) || Number(latestCycles.get(String(cycle.cycleKey))!.sequence) < Number(cycle.sequence)) latestCycles.set(String(cycle.cycleKey), cycle);
  return { ...c, period: { start: start.toISOString(), end: end.toISOString(), interval: 'UTC_HALF_OPEN' },
    engineering: { status: cycles.length ? 'RECORDED' : 'NO_DATA', recordedCheckpoints: cycles.length, completedCycles: [...latestCycles.values()].filter(v => v.state === 'RETROSPECTIVE_COMPLETED' && publicationHistory(root, c.tenant, String(v.packetId), dataset).at(-1)?.state === 'OWNER_REPORTED_PUBLISHED').length,
      externalWrites: 0, inferenceCost: null, resourceConsumption: 'MEASURED_BY_ACCEPTANCE_RUNNER' },
    business: { status: observed.length ? 'OWNER_ATTESTED_OBSERVATIONS' : 'NO_DATA', verifiedConversions: null,
      metrics: observed, ctr: null, ctrLimitation: 'Requires clicks and impressions for the same post, source and window; no inference from impressions alone',
      qualification: c.tenant === 'founder' ? 'Owner-defined relevant builder engagement, relationships, collaboration and opportunities; follower counts alone do not qualify' :
        'Reviewed acquisition, supported activation and retention definitions; clicks and owner estimates are not verified product outcomes',
      missingValue: 'UNAVAILABLE', claimableGrowth: 'NOT_ESTABLISHED', datasetSeparation: 'PHYSICAL_DATABASES' },
    retrospective: { interpretation: 'Separate observations, missing data and hypotheses; no causal growth claim', nextExperiment: 'Owner selects one evidence-backed hypothesis and records its denominator and guardrails' } };
}
