import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseDocument, visit } from 'yaml';
import { z } from 'zod';
import { ClaimsLedgerSchema, DefaultsSchema, FlagsSchema, HANDLES, IdSchema, ProfileSchema, SkillSchema, TenantSchema, WorkflowSchema, type Tenant } from '../../schemas/src/index.js';
import { GtmError, sha256 } from '../../observability/src/index.js';

export function parseWith<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new GtmError('SCHEMA_INVALID', `${label}: schema validation failed`);
  return result.data;
}

export function safePath(root: string, path: string): string {
  const base = resolve(root);
  const target = resolve(base, path);
  const local = relative(base, target);
  if (isAbsolute(path) || local.startsWith('..') || isAbsolute(local)) throw new GtmError('UNSAFE_PATH', 'Path must remain inside the workspace');
  let current = base;
  for (const part of ['', ...local.split(/[\\/]/).filter(Boolean)]) {
    current = part ? join(current, part) : current;
    try {
      if (lstatSync(current).isSymbolicLink()) throw new GtmError('UNSAFE_PATH', 'Symlinked workspace inputs or outputs are forbidden');
    } catch (error) {
      if (error instanceof GtmError || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return target;
}

export function safeDirectory(root: string, path: string): string {
  const target = safePath(root, path);
  mkdirSync(target, { recursive: true, mode: 0o700 });
  return target;
}

export function readText(root: string, path: string): string {
  if (path.split(/[\\/]/).some(part =>
    (part.startsWith('.env') && part !== '.env.example') || ['.git', '.beads'].includes(part) ||
    /^(?:secrets|credentials|sessions?|cookies?)(?:\.|$)/i.test(part))) {
    throw new GtmError('PROTECTED_INPUT', 'Credential, session and private state inputs are forbidden', 3);
  }
  const file = safePath(root, path);
  if (!existsSync(file)) throw new GtmError('FILE_MISSING', `Required project file is missing: ${path}`);
  if (!lstatSync(file).isFile() || lstatSync(file).size > 1024 * 1024) throw new GtmError('UNSAFE_INPUT', 'Project input must be a file of at most 1 MiB');
  return readFileSync(file, 'utf8');
}

export function parseYaml(text: string): unknown {
  try {
    const doc = parseDocument(text, { uniqueKeys: true, version: '1.2' });
    if (doc.errors.length || doc.warnings.length) throw new Error();
    visit(doc, { Node(_key, node) {
      if ('anchor' in node && node.anchor) throw new Error();
    }, Alias() { throw new Error(); } });
    return doc.toJS({ maxAliasCount: 0 });
  } catch { throw new GtmError('YAML_INVALID', 'Invalid, duplicate-key or unsafe YAML'); }
}

export function readStructured(root: string, path: string): unknown {
  const text = readText(root, path);
  if (path.endsWith('.json')) {
    try { JSON.parse(text); } catch { throw new GtmError('JSON_INVALID', 'Invalid JSON input'); }
  }
  return parseYaml(text);
}

export function loadPolicy(root: string): void {
  try {
    DefaultsSchema.parse(readStructured(root, 'config/defaults.yaml'));
    FlagsSchema.parse(readStructured(root, 'config/feature-flags.yaml'));
  } catch { throw new GtmError('POLICY_DISABLED_REQUIRED', 'Offline mode, disabled external writes and zero paid budget are required', 3); }
}

export function loadBrand(root: string, selected: unknown) {
  const tenant = parseWith(TenantSchema, selected, 'brand');
  const profile = parseWith(ProfileSchema, readStructured(root, `brands/${tenant}/profile.json`), 'brand profile');
  if (profile.id !== tenant || profile.expected_x_handle !== HANDLES[tenant]) throw new GtmError('TENANT_MISMATCH', 'Brand/profile/account mismatch');
  for (const name of ['AGENTS.md', 'VOICE.md', 'DESIGN.md']) readText(root, `brands/${tenant}/${name}`);
  const tokens = parseWith(z.strictObject({
    _status: z.literal('PLACEHOLDER_NOT_OFFICIAL'), tenant: TenantSchema, font_family: z.string().min(1),
    colors: z.record(z.string(), z.string().regex(/^#[a-fA-F0-9]{6}$/)),
    ratios: z.array(z.enum(['16:9', '1:1', '9:16'])).nonempty(),
  }), readStructured(root, `brands/${tenant}/tokens.json`), 'brand tokens');
  if (tokens.tenant !== tenant) throw new GtmError('TENANT_MISMATCH', 'Design tokens belong to another tenant');
  const claims = parseWith(ClaimsLedgerSchema, readStructured(root, `brands/${tenant}/claims-ledger.yaml`), 'claims ledger');
  if (claims.tenant !== tenant || claims.claims.some(c => c.tenant !== tenant)) throw new GtmError('TENANT_MISMATCH', 'Claim belongs to another tenant');
  return { tenant, profile, claims };
}

export function listSkills(root: string) {
  const directory = safePath(root, '.agents/skills');
  return readdirSync(directory, { withFileTypes: true }).filter(d => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).map(entry => {
    const path = `.agents/skills/${entry.name}/SKILL.md`;
    const text = readText(root, path);
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if (!match?.[1]) throw new GtmError('SKILL_INVALID', 'Missing skill frontmatter');
    const skill = parseWith(SkillSchema, parseYaml(match[1]), 'skill');
    if (skill.name !== entry.name) throw new GtmError('SKILL_INVALID', 'Skill name/path mismatch');
    return { ...skill, path, status: 'INSTRUCTION_ONLY' as const };
  });
}

export function loadWorkflow(root: string, name: string) {
  parseWith(IdSchema, name, 'workflow identifier');
  const text = readText(root, `workflows/definitions/${name}.yaml`);
  const definition = parseWith(WorkflowSchema, parseYaml(text), 'workflow');
  if (definition.id !== name) throw new GtmError('WORKFLOW_MISMATCH', 'Workflow identifier/path mismatch');
  readText(root, `agents/roles/${definition.owner}/ROLE.md`);
  const skills = new Set(listSkills(root).map(s => s.name));
  if (definition.stages.some(s => !skills.has(s.skill))) throw new GtmError('SKILL_MISSING', 'Workflow references an unavailable project skill');
  return { definition, sha256: sha256(text) };
}

export function listWorkflows(root: string) {
  return readdirSync(safePath(root, 'workflows/definitions')).filter(n => n.endsWith('.yaml')).sort()
    .map(name => loadWorkflow(root, name.slice(0, -5)));
}

export function claimsAudit(root: string, tenant: Tenant, now = new Date()) {
  const { claims } = loadBrand(root, tenant);
  const issues = claims.claims.flatMap(c => {
    const reasons = [];
    if (Date.parse(c.observed_at) > now.getTime() || Date.parse(c.expires_at) <= now.getTime() || Date.parse(c.expires_at) <= Date.parse(c.observed_at)) reasons.push('SOURCE_EXPIRED_OR_INVALID');
    if (!['VERIFIED', 'OWNER_APPROVED'].includes(c.review_status)) reasons.push('UNVERIFIED');
    if (c.review_status === 'OWNER_APPROVED' && !c.owner_approval) reasons.push('OWNER_APPROVAL_MISSING');
    return reasons.map(code => ({ claimId: c.claim_id, code }));
  });
  if (new Set(claims.claims.map(c => c.claim_id)).size !== claims.claims.length) issues.push({ claimId: 'ledger', code: 'DUPLICATE_CLAIM' });
  return { tenant, claims: claims.claims.length, issues, verifiedProductClaims: claims.claims.length === 0 ? 'NONE_RECORDED' : 'SEE_REVIEW_STATUS', publicationAuthorized: false };
}
