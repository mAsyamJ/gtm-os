import { existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { canonical, GtmError, hashObject, redact, sha256 } from '../../observability/src/index.js';
import { HashSchema, IdSchema, TimeSchema, TenantSchema, type Source, type Tenant } from '../../schemas/src/index.js';
import { loadBrand, loadPolicy, parseWith, readStructured, readText, safeDirectory, safePath } from '../../core/src/workspace.js';
import { TenantStore } from '../../storage/src/index.js';

const Text = z.string().min(1).max(100_000);
export const SourceInputSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, uri: Text, revision: Text, observedAt: TimeSchema, expiresAt: TimeSchema,
  contentSha256: HashSchema, license: Text, text: Text, title: z.string().min(1).max(240),
  relevance: Text, author: Text, contentTimestamp: TimeSchema.nullable(),
  permission: z.enum(['PROJECT_LOCAL', 'AUTHORIZED_FILE']), permissionBasis: Text,
});
export type SourceInput = z.infer<typeof SourceInputSchema>;
const BodySchema = SourceInputSchema.omit({ id: true, tenant: true, uri: true, revision: true, observedAt: true, expiresAt: true, contentSha256: true, license: true }).extend({
  kind: z.literal('SOURCE_CARD_V1'), rawTextSha256: HashSchema,
  verification: z.enum(['LOCAL_CONTRACT_VERIFIED', 'UNVERIFIED']),
  evidenceScope: z.enum(['GOVERNANCE_ONLY', 'SUPPLIED_TEXT_ONLY']),
  confidence: z.enum(['HIGH_FOR_LOCAL_BYTES', 'UNKNOWN']),
  promptInjectionScan: z.literal('NO_KNOWN_PATTERN_DETECTED'),
  usage: z.literal('LOCAL_RESEARCH_ONLY_NO_REDISTRIBUTION'),
});
export type CardBody = z.infer<typeof BodySchema>;
export interface Card { source: Source; card: CardBody; validity: 'CURRENT' | 'EXPIRED' | 'FUTURE' | 'STALE_REVISION'; }
export const LOCAL_FILES = ['AGENTS.md', 'VOICE.md', 'DESIGN.md', 'POSITIONING.md', 'MESSAGING.md'] as const;

// Defense in depth only. Source text never controls tools, prompts, policies or generated copy.
export function screenUntrusted(value: unknown): void {
  const raw = canonical(value);
  const normalized = raw.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_m, hex: string | undefined, dec: string | undefined) => {
      const point = Number.parseInt(hex ?? dec ?? '0', hex ? 16 : 10);
      return point <= 0x10ffff ? String.fromCodePoint(point) : '';
    });
  const patterns = [
    /(?:ignore|disregard|override|forget).{0,80}(?:previous|prior|system|developer|policy|instructions|rules)/i,
    /(?:system|developer|assistant)\s*(?:message|prompt|:)|\[INST\]|<\|(?:im_start|system|assistant)/i,
    /\b(?:reveal|exfiltrate|upload|print|read)\b.{0,60}(?:credentials|secrets|\.env|private.key|access.token)/i,
    /(?:curl|wget)\s|\bnpx\s|(?:bash|sh)\s+-c|\$\(|```(?:bash|sh|powershell)|<script\b|javascript:/i,
    /(?:enable|set|turn.on).{0,40}(?:publish_enabled|external_writes|paid_api_enabled)/i,
    /(?:publish|schedule|send).{0,35}(?:without.approval|automatically|now.to)/i,
  ];
  if (patterns.some(p => p.test(normalized))) throw new GtmError('SOURCE_INJECTION', 'Untrusted input contains a prohibited instruction pattern');
  if (canonical(redact(value)) !== raw) throw new GtmError('SOURCE_SENSITIVE', 'Sensitive data is not permitted in research inputs');
}

function windowValid(observedAt: string, expiresAt: string, now: Date): void {
  const observed = Date.parse(observedAt), expires = Date.parse(expiresAt);
  if (observed > now.getTime() || expires <= now.getTime() || expires <= observed || expires - observed > 90 * 86400_000)
    throw new GtmError('SOURCE_VALIDITY', 'Source must be current, not future-dated, with a validity window of at most 90 days');
}

function localContract(root: string, tenant: Tenant, uri: string): { path: string; text: string } {
  const prefix = `project:///brands/${tenant}/`;
  const name = uri.startsWith(prefix) ? uri.slice(prefix.length) : '';
  if (!(LOCAL_FILES as readonly string[]).includes(name)) throw new GtmError('SOURCE_SCOPE', 'Local evidence must be a selected tenant contract');
  const path = `brands/${tenant}/${name}`;
  return { path, text: readText(root, path) };
}

function validateOrigin(root: string, tenant: Tenant, input: SourceInput): void {
  if (input.tenant !== tenant) throw new GtmError('TENANT_MISMATCH', 'Research input belongs to another tenant');
  if (sha256(input.text) !== input.contentSha256) throw new GtmError('SOURCE_HASH', 'Supplied text does not match its declared SHA256');
  if (input.permission === 'PROJECT_LOCAL') {
    const local = localContract(root, tenant, input.uri);
    if (local.text !== input.text || input.revision !== sha256(local.text)) throw new GtmError('SOURCE_REVISION', 'Local source differs from current tenant contract');
    if (input.license !== 'OWNER_PROJECT_LOCAL_ONLY') throw new GtmError('SOURCE_LICENSE', 'Local contract permission is local use only');
  } else {
    let url: URL;
    try { url = new URL(input.uri); } catch { throw new GtmError('SOURCE_URI', 'Authorized external text requires an HTTPS provenance URL'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new GtmError('SOURCE_URI', 'External provenance must be a public HTTPS URL without credentials, query or fragment');
  }
}

export function ingestSource(root: string, selected: unknown, path: string, now = new Date()): Card {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  loadPolicy(root); loadBrand(root, tenant);
  if (!new RegExp(`^research/inbox/${tenant}/[a-zA-Z0-9][a-zA-Z0-9_.-]*\\.json$`).test(path))
    throw new GtmError('SOURCE_SCOPE', 'Input must be an explicit JSON file in the selected tenant research inbox');
  const input = parseWith(SourceInputSchema, readStructured(root, path), 'source input');
  screenUntrusted(input); validateOrigin(root, tenant, input); windowValid(input.observedAt, input.expiresAt, now);
  const local = input.permission === 'PROJECT_LOCAL';
  const body: CardBody = { title: input.title, text: input.text, relevance: input.relevance, author: input.author,
    contentTimestamp: input.contentTimestamp, permission: input.permission, permissionBasis: input.permissionBasis,
    kind: 'SOURCE_CARD_V1', rawTextSha256: input.contentSha256,
    verification: local ? 'LOCAL_CONTRACT_VERIFIED' : 'UNVERIFIED', evidenceScope: local ? 'GOVERNANCE_ONLY' : 'SUPPLIED_TEXT_ONLY',
    confidence: local ? 'HIGH_FOR_LOCAL_BYTES' : 'UNKNOWN', promptInjectionScan: 'NO_KNOWN_PATTERN_DETECTED',
    usage: 'LOCAL_RESEARCH_ONLY_NO_REDISTRIBUTION' };
  const source: Source = { id: input.id, tenant, uri: input.uri, revision: input.revision, observedAt: input.observedAt,
    expiresAt: input.expiresAt, license: input.license, classification: local ? 'FIRST_PARTY' : 'EXTERNAL', body,
    contentSha256: hashObject(body) };
  using store = new TenantStore(root, tenant);
  if (!store.verifyAudit().valid) throw new GtmError('AUDIT_INVALID', 'Research requires a valid tenant audit chain');
  store.putSource(source);
  return { source, card: body, validity: 'CURRENT' };
}

export function sourceCards(root: string, selected: unknown, now = new Date()): Card[] {
  const tenant = parseWith(TenantSchema, selected, 'tenant'); loadPolicy(root); loadBrand(root, tenant);
  if (!existsSync(safePath(root, `runtime/state/${tenant}/gtm.sqlite`))) return [];
  using store = new TenantStore(root, tenant, { readonly: true });
  if (!store.verifyAudit().valid) throw new GtmError('AUDIT_INVALID', 'Research requires a valid tenant audit chain');
  return store.sources().filter(s => s.body.kind === 'SOURCE_CARD_V1').map(source => {
    const card = parseWith(BodySchema, source.body, 'stored source card'); screenUntrusted(card);
    if (sha256(card.text) !== card.rawTextSha256) throw new GtmError('SOURCE_HASH', 'Stored source text hash mismatch');
    let staleRevision = false;
    if (card.permission === 'PROJECT_LOCAL') {
      const local = localContract(root, tenant, source.uri);
      if (card.verification !== 'LOCAL_CONTRACT_VERIFIED' || card.evidenceScope !== 'GOVERNANCE_ONLY' ||
        source.classification !== 'FIRST_PARTY' || source.license !== 'OWNER_PROJECT_LOCAL_ONLY') throw new GtmError('SOURCE_TRUST', 'Invalid local evidence trust metadata');
      staleRevision = source.revision !== sha256(local.text) || local.text !== card.text;
    } else if (card.verification !== 'UNVERIFIED' || card.evidenceScope !== 'SUPPLIED_TEXT_ONLY')
      throw new GtmError('SOURCE_TRUST', 'Supplied text cannot self-assign verification');
    windowValid(source.observedAt, source.expiresAt, new Date(source.observedAt));
    const validity = staleRevision ? 'STALE_REVISION' : Date.parse(source.observedAt) > now.getTime() ? 'FUTURE' : Date.parse(source.expiresAt) <= now.getTime() ? 'EXPIRED' : 'CURRENT';
    return { source, card, validity };
  });
}

export function researchReport(root: string, tenant: Tenant, now = new Date()) {
  const cards = sourceCards(root, tenant, now);
  return { tenant, revision: 'phase-c-r1', evaluatedAt: now.toISOString(),
    cards: cards.map(({ source, card, validity }) => ({ id: source.id, uri: source.uri, revision: source.revision,
      observedAt: source.observedAt, expiresAt: source.expiresAt, contentSha256: source.contentSha256,
      rawTextSha256: card.rawTextSha256, license: source.license, relevance: card.relevance, confidence: card.confidence,
      verification: card.verification, evidenceScope: card.evidenceScope, validity, usage: card.usage })),
    expired: cards.filter(c => c.validity !== 'CURRENT').map(c => c.source.id),
    usableProductClaims: 0, usablePersonalAchievements: 0, publicationAuthorized: false,
    limitations: ['Supplied text provenance is declared, not authenticated; no runtime network retrieval.',
      'Local contract verification establishes governance bytes only; it does not verify product features, customer demand or personal history.'] };
}

const ReferenceSchema = z.object({ id: IdSchema, canonical_interface: IdSchema, upstream_name: IdSchema,
  declared_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: z.literal('INSTALLED_VERIFIED_REFERENCE_ONLY'), repository: z.url(), commit: z.string().regex(/^[a-f0-9]{40}$/),
  path: z.string(), sha256: HashSchema, license: z.literal('MIT'), license_path: z.string(), license_sha256: HashSchema,
  executable: z.literal(false), automatic_loading: z.literal(false), trigger: Text,
  runtime_dependencies: z.array(z.string()).length(0), excluded_dependencies: Text, upstream_path: Text,
});
const ManifestSchema = z.strictObject({ format_version: z.literal(2), revision: z.literal('phase-c-r1'), audited_at: z.string(),
  installed_and_verified: z.array(ReferenceSchema).length(3), rejected: z.array(z.object({ id: z.string(), status: z.string(), reason: z.string() })), install_policy: Text });

export function auditReferences(root: string) {
  const manifest = parseWith(ManifestSchema, readStructured(root, '.agents/vendor/manifest.lock.yaml'), 'reference manifest');
  const seen = new Set<string>();
  for (const ref of manifest.installed_and_verified) {
    if (seen.has(ref.id)) throw new GtmError('REFERENCE_DUPLICATE', 'Duplicate selected reference'); seen.add(ref.id);
    for (const [path, hash] of [[ref.path, ref.sha256], [ref.license_path, ref.license_sha256]]) {
      if (!path?.startsWith('.agents/vendor/') || !hash || sha256(readText(root, path)) !== hash)
        throw new GtmError('REFERENCE_HASH', 'Selected reference or license changed');
    }
    readText(root, `.agents/skills/${ref.canonical_interface}/SKILL.md`);
    if (!readText(root, ref.license_path).startsWith('MIT License')) throw new GtmError('REFERENCE_LICENSE', 'Complete MIT notice required');
  }
  return manifest;
}

/** Immutable, reproducible local JSON; an existing conflicting file is never overwritten. */
export function saveResearchOutput(root: string, tenant: Tenant, kind: string, document: unknown) {
  const selected = parseWith(TenantSchema, tenant, 'tenant'); parseWith(IdSchema, kind, 'output kind');
  const scope = parseWith(z.object({ tenant: TenantSchema }), document, 'output tenant');
  if (scope.tenant !== selected) throw new GtmError('TENANT_MISMATCH', 'Output document belongs to another tenant');
  screenUntrusted(document);
  const bytes = canonical(document), digest = sha256(bytes);
  const directory = `runtime/research/${selected}/${kind}`; safeDirectory(root, directory);
  const relativePath = `${directory}/${digest}.json`; const path = safePath(root, relativePath);
  if (existsSync(path)) {
    if (sha256(readFileSync(path)) !== digest) throw new GtmError('OUTPUT_IMMUTABLE', 'Existing research artifact hash mismatch');
  } else writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  return { relativePath, sha256: digest, document };
}

export function inboxFiles(root: string, tenant: Tenant): string[] {
  const directory = `research/inbox/${tenant}`;
  if (!existsSync(safePath(root, directory))) return [];
  return readdirSync(safePath(root, directory)).filter(n => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.json$/.test(n)).sort().map(n => `${directory}/${n}`);
}
