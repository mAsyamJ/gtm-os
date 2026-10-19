import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { z } from 'zod';
import { readStructured, readText } from '../../core/src/workspace.js';
import { GtmError, sha256 } from '../../observability/src/index.js';
import { context } from './common.js';

const GLOBAL = '/home/ubuntu/agent-control-plane/sources/';
const Source = z.object({ id: z.string(), canonical_repo: z.url(), local_path: z.string(), git_commit: z.string().regex(/^[a-f0-9]{40}$/),
  license: z.string(), license_path: z.string().nullable(), license_sha256: z.string().nullable(), status: z.string() }).passthrough();
export function skillsAudit(root: string) {
  const manifest = z.object({ sources: z.array(Source) }).parse(readStructured(root, 'config/v3-capabilities.json'));
  return { schemaVersion: 1, installedOrModified: 0, credentialsRead: false, sources: manifest.sources.map(source => {
    let status = 'INSTALLED_NOT_VERIFIED';
    try {
      if (!source.license_path || !source.license_sha256 || !source.license_path.startsWith(GLOBAL) ||
        !realpathSync(source.license_path).startsWith(GLOBAL) || statSync(source.license_path).size > 1000000 ||
        sha256(readFileSync(source.license_path)) !== source.license_sha256) status = 'QUARANTINED';
      else status = 'REFERENCE_ONLY';
    } catch { status = 'MISSING'; }
    return { ...source, status, executionVerified: false, recommendation: 'Use only reviewed project adapter; source audit is not an operational integration test' };
  }), zeroSpendPolicy: true, noAutomaticInstallation: true };
}
export function toolCommand(args: string[], timeout = 15000) {
  const p = spawnSync('/home/ubuntu/.local/bin/agentctl', args, { encoding: 'utf8', timeout, maxBuffer: 2 * 1024 * 1024,
    env: { PATH: '/home/ubuntu/.local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1' } });
  if (p.error || p.status !== 0) throw new GtmError('GLOBAL_CAPABILITY_BLOCKED', 'Existing capability command unavailable or denied; no fallback was enabled', 4);
  try { return JSON.parse(p.stdout) as unknown; } catch { throw new GtmError('GLOBAL_SCHEMA', 'Existing capability output did not match JSON contract', 4); }
}
export function capabilitiesPlan(root: string, selected: unknown, task: string, stage = 'research') {
  const c = context(root, selected);
  if (!task.trim() || Buffer.byteLength(task) > 4096) throw new GtmError('INVALID_TASK', 'Stage task must be 1–4096 bytes', 2);
  const excluded = /(?:scrap\w*|cookies?|stealth|bypass).{0,40}\b(?:X|Twitter)\b|\b(?:X|Twitter)\b.{0,40}(?:scrap\w*|cookies?|stealth|bypass)|\b(?:publish|send dm|mass.follow|buy ads|extract cookies)\b/i.test(task);
  if (excluded) return { ...c, stage, blocked: true, reasons: ['STAGE_ACTION_OR_SOURCE_POLICY_DENIED'], executable: false, selected: [], globalInvocations: 0 };
  const value = z.object({ agent: z.string(), skills: z.array(z.object({ slug: z.string() }).passthrough()),
    tool_candidates: z.array(z.unknown()), model_availability: z.unknown(), executed: z.literal(false) }).passthrough().parse(
      toolCommand(['capabilities', 'resolve', task, '--repo', root]));
  return { ...c, stage, blocked: false, executable: false, selected: { primarySpecialist: value.agent, supportingSkills: value.skills.slice(0, 2) },
    selectionScope: 'PER_WORKFLOW_STAGE', toolCandidates: value.tool_candidates, modelAvailability: value.model_availability,
    rankingWeights: { domainRelevance: .30, verifiedOperation: .25, provenance: .20, budget: .10, qualityEvidence: .10, latency: .05 },
    executionGate: 'Selected tools require reviewed native schemas, tenant permission and independent cost admission before any invocation', globalInvocations: 1,
    limitations: ['Global shortlist remains authoritative; weights are an evaluation target, not measured savings', 'Unknown tool behavior and price deny execution'] };
}
export function dedupe(root: string) {
  const audit = skillsAudit(root); const seen = new Map<string, string>();
  return { ...audit, duplicates: audit.sources.flatMap(s => { const prior = seen.get(s.canonical_repo); seen.set(s.canonical_repo, s.id); return prior ? [{ id: s.id, duplicateOf: prior }] : []; }), removed: 0 };
}
export function fetchPublic(root: string, selected: unknown, uri: string, network: unknown) {
  const c = context(root, selected);
  if (network !== 'approved-read') throw new GtmError('NETWORK_POLICY_REQUIRED', 'Explicit --network approved-read is required', 3);
  const u = new URL(uri); const hosts = ['raw.githubusercontent.com', 'api.github.com', 'hn.algolia.com'];
  if (u.protocol !== 'https:' || !hosts.includes(u.hostname) || u.username || u.password || u.port || u.hash || u.search)
    throw new GtmError('HOST_POLICY', 'URL is outside the audited keyless public-source policy', 3);
  // Existing reviewed transport pins DNS, checks robots, rejects redirects and bounds response bytes.
  const response = toolCommand(['web', 'fetch', uri, '--allow-domain', u.hostname], 45000);
  return { ...c, label: 'RETRIEVED_UNVERIFIED', uri, response, usage: 'LOCAL_RESEARCH_REVIEW_REQUIRED', sourcePolicy: 'PUBLIC_KEYLESS_NO_COOKIES', permittedPublicClaims: [] };
}
export function voiceProfile(root: string, selected: unknown) {
  const c = context(root, selected);
  return { ...c, voiceContract: readText(root, `brands/${c.tenant}/VOICE.md`),
    calibration: 'PROVISIONAL_UNTIL_OWNER_APPROVED_AUTHENTIC_SAMPLES', personalExperienceInferred: false };
}

