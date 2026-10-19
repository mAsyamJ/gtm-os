/** Local text-only samples. Fixed evaluation time and exact input hashes make replay deterministic. */
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { canonical, sha256 } from '../dist/packages/observability/src/index.js';
import { ingestSource, researchReport } from '../dist/packages/research/src/index.js';
import { contentBrief, contentCalendar, strategyPlan, icpHypothesis } from '../dist/packages/strategy/src/index.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const clockPath = resolve(root, 'docs/evidence/phase-c-sample-clock.json');
// Recorded evaluation time is replay input, never a claim that a historical source is current today.
if (!existsSync(clockPath)) writeFileSync(clockPath, JSON.stringify({ evaluatedAt: new Date().toISOString() }, null, 2) + '\n');
const now = new Date(JSON.parse(readFileSync(clockPath, 'utf8')).evaluatedAt);
const sampleRoot = resolve(root, 'runtime/phase-c-sample-workspace');
rmSync(sampleRoot, { recursive: true, force: true });
mkdirSync(sampleRoot, { recursive: true });
for (const directory of ['config', 'brands', '.agents', 'agents', 'workflows', 'campaigns']) cpSync(resolve(root, directory), resolve(sampleRoot, directory), { recursive: true });
copyFileSync(resolve(root, 'AGENTS.md'), resolve(sampleRoot, 'AGENTS.md'));
copyFileSync(resolve(root, 'package.json'), resolve(sampleRoot, 'package.json'));
const files = [];
function put(path, bytes) {
  mkdirSync(resolve(root, path, '..'), { recursive: true });
  writeFileSync(resolve(root, path), bytes);
  files.push({ path, sha256: sha256(bytes) });
}
function refs(doc) {
  return doc.evidenceRefs.map(r => `- ${r.sourceId}: ${r.uri} — revision ${r.revision}; expires ${r.expiresAt}; ${r.scope}`).join('\n');
}
for (const tenant of ['retropick', 'founder']) {
  for (const name of ['VOICE.md', 'POSITIONING.md', 'MESSAGING.md']) {
    const text = readFileSync(resolve(root, `brands/${tenant}/${name}`), 'utf8');
    const digest = sha256(text);
    const input = { id: `${tenant}-${name.slice(0, -3).toLowerCase()}-${digest.slice(0, 8)}-${sha256(now.toISOString()).slice(0, 8)}`, tenant,
      uri: `project:///brands/${tenant}/${name}`, revision: digest, text, contentSha256: digest,
      observedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 7 * 86400_000).toISOString(),
      title: `${tenant} ${name} editorial contract`, author: 'Project owner contracts', contentTimestamp: null,
      relevance: 'Editorial constraints and provisional positioning only; not proof of product capabilities or personal achievements',
      permission: 'PROJECT_LOCAL', permissionBasis: 'Owner authorized local Phase C implementation and reviewable plans', license: 'OWNER_PROJECT_LOCAL_ONLY' };
    const path = `research/inbox/${tenant}/${name.slice(0, -3).toLowerCase()}.json`;
    put(path, JSON.stringify(input, null, 2) + '\n');
    mkdirSync(resolve(sampleRoot, path, '..'), { recursive: true });
    copyFileSync(resolve(root, path), resolve(sampleRoot, path));
    ingestSource(sampleRoot, tenant, path, now);
  }
  const plan = strategyPlan(sampleRoot, tenant, {}, now), calendar = contentCalendar(sampleRoot, tenant, {}, now);
  const topic = tenant === 'founder' ? 'An inspectable architecture decision' : 'How to verify a documented product flow';
  const brief = contentBrief(sampleRoot, tenant, topic, undefined, now), icp = icpHypothesis(sampleRoot, tenant, now);
  put(`output/sample-plans/phase-c-${tenant}.json`, canonical(plan));
  put(`output/sample-plans/phase-c-${tenant}-brief.json`, canonical(brief));
  put(`output/sample-plans/phase-c-${tenant}-icp.json`, canonical(icp));
  put(`output/sample-calendars/phase-c-${tenant}.json`, canonical(calendar));
  put(`docs/evidence/phase-c-${tenant}-sources.json`, JSON.stringify(researchReport(sampleRoot, tenant, now), null, 2) + '\n');
  const planText = `# ${tenant}: 30-day strategy\n\nRevision: ${plan.revision}. Evaluated ${plan.evaluatedAt}. Start ${plan.start}. Owner-review draft; NOT APPROVED.\n\n${plan.positioning}\n\nAudience: ${plan.audience}\n\nProblem: ${plan.problem}\n\nVoice: ${plan.voice}\n\nPillars: ${plan.pillars.join('; ')}.\n\n${plan.activation}\n\n${plan.capacity}\n\n${plan.phases.map(p => `## ${p.name}\n\nDeliverable: ${p.deliverable}\n\n| Day | Date | Proposed local action | Refresh sources before use |\n|---|---|---|---|\n${p.days.map(d => `| ${d.day} | ${d.date} | ${d.action} | ${d.refreshBeforeUse.length ? d.refreshBeforeUse.join(', ') : 'Check at use'} |`).join('\n')}`).join('\n\n')}\n\n## Measurement and stop rules\n\n${plan.measures.map(m => `- ${m.name}: ${m.definition}. Baseline ${m.baseline}; owner ${m.owner}. Target: ${m.target}.`).join('\n')}\n\n${plan.stopRules.map(r => `- ${r}`).join('\n')}\n\n## Evidence and limits\n\n${refs(plan)}\n\n${plan.limitations.map(l => `- ${l}`).join('\n')}\n\nMissing proof: ${plan.missingEvidence.join('; ')}. No factual claims promoted. Asset source: text only, project-local review permission. Provider calls/cost: 0/$0; operator compute NOT_MEASURED.\n\nReproduce with \`pnpm build && node scripts/generate_phase_c_samples.mjs\`. Exact inputs, source revisions, methodology pins and validation fields are in the adjacent JSON.\n`;
  put(`output/sample-plans/phase-c-${tenant}.md`, planText);
  const calendarText = `# ${tenant}: 14-day editorial calendar\n\nRevision ${calendar.revision}; evaluated ${calendar.evaluatedAt}. NOT APPROVED; nothing scheduled. ${calendar.cadence}.\n\nVoice: ${calendar.voice}\n\n${calendar.operatingRhythm}\n\n| Day / date | Topic / format | Editorial task | Missing topic proof |\n|---|---|---|---|\n${calendar.entries.map(e => `| ${e.day} / ${e.date} | ${e.title} (${e.format}) | ${e.task} | ${e.proofNeeded} |`).join('\n')}\n\nCTA direction: ${calendar.entries[0].cta}\n\nSources expire on 24 October. Refresh them before all later slots; each JSON entry lists exact source IDs needing refresh. Topics remain proposed and need the proof listed above.\n\n## Evidence and limits\n\n${refs(calendar)}\n\n${calendar.limitations.map(l => `- ${l}`).join('\n')}\n\nAudience: ${calendar.audience}. Asset source/license: text-only, project-local review. Provider calls/cost: 0/$0; operator compute NOT_MEASURED. Reproduce with \`pnpm build && node scripts/generate_phase_c_samples.mjs\`. The adjacent JSON contains all source, input, owner/reviewer, metric and dependency fields.\n`;
  put(`output/sample-calendars/phase-c-${tenant}.md`, calendarText);
}
put('docs/evidence/phase-c-samples.json', JSON.stringify({ revision: 'phase-c-r1', evaluatedAt: now.toISOString(), reproducible: true, files: [...files] }, null, 2) + '\n');
process.stdout.write(JSON.stringify({ status: 'LOCAL_DRAFTS_CREATED', files: files.length, publicFactsPromoted: 0, providerCalls: 0 }) + '\n');
