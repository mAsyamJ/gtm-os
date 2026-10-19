import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { canonical, GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { HashSchema, TenantSchema, type Tenant } from '../../schemas/src/index.js';
import { loadBrand, loadPolicy, parseWith, readStructured, readText, safeDirectory, safePath } from '../../core/src/workspace.js';

export const SIZES = { landscape: [1200, 675], wide: [1600, 900], square: [1080, 1080], portrait: [1080, 1920], videoLandscape: [1920, 1080] } as const;
export type Size = keyof typeof SIZES;
export const SizeSchema = z.enum(['landscape', 'wide', 'square', 'portrait', 'videoLandscape']);
export const TemplateSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/), tenant: TenantSchema, revision: z.literal('phase-d-r1'),
  variant: z.enum(['hero', 'steps', 'decision']), label: z.literal('SYNTHETIC DEMO / PLACEHOLDER'),
  eyebrow: z.string().min(1).max(42), title: z.string().min(1).max(78), body: z.string().min(1).max(160),
  panels: z.array(z.strictObject({ heading: z.string().min(1).max(28), text: z.string().min(1).max(70) })).min(2).max(3),
  footer: z.string().min(1).max(100), alt: z.string().min(20).max(500),
  contentMode: z.literal('ILLUSTRATIVE_NO_PRODUCT_OR_PERSONAL_FACTS'),
});
export type Template = z.infer<typeof TemplateSchema>;

export function creativeContext(root: string, selected: unknown, fixture: unknown) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  if (fixture !== 'synthetic') throw new GtmError('SYNTHETIC_REQUIRED', 'Explicit --fixture synthetic is required; production creative is unavailable', 3);
  loadPolicy(root); loadBrand(root, tenant);
  const paths = ['AGENTS.md', 'creative/AGENTS.md', 'creative/DESIGN.md', 'creative/WORKFLOWS.md',
    'packages/creative/src/common.ts', 'packages/creative/src/graphics.ts', 'packages/creative/src/video.ts', 'packages/creative/src/adapter.ts', 'creative/assets/fonts/manifest.json',
    'creative/assets/licenses/manifest.json', 'package.json', 'pnpm-lock.yaml',
    ...['AGENTS.md', 'VOICE.md', 'DESIGN.md', 'POSITIONING.md', 'MESSAGING.md', 'claims-ledger.yaml', 'tokens.json'].map(n => `brands/${tenant}/${n}`)];
  const inputs = paths.map(path => ({ path, sha256: sha256(readText(root, path)) }));
  const fontManifest = parseWith(z.object({ revision: z.literal('phase-d-r1'), font_family: z.literal('DejaVu Sans'),
    license: z.literal('Bitstream-Vera (DejaVu changes public domain)'), unmodified: z.literal(true),
    files: z.array(z.strictObject({ path: z.string(), sha256: HashSchema })).length(3) }), readStructured(root, 'creative/assets/fonts/manifest.json'), 'font license manifest');
  const expected = ['creative/assets/fonts/DejaVuSans.ttf', 'creative/assets/fonts/DejaVuSans-Bold.ttf', 'creative/assets/fonts/LICENSE.txt'];
  if (new Set(fontManifest.files.map(f => f.path)).size !== 3 || fontManifest.files.some(f => !expected.includes(f.path)))
    throw new GtmError('ASSET_SCOPE', 'Only the reviewed local font assets are supported');
  for (const file of fontManifest.files) {
    if (sha256(readFileSync(safePath(root, file.path))) !== file.sha256) throw new GtmError('ASSET_HASH', 'Font or license bytes changed');
  }
  const notice = readText(root, 'creative/assets/fonts/LICENSE.txt');
  if (!notice.includes('Permission is hereby granted') || !notice.includes('Bitstream')) throw new GtmError('ASSET_LICENSE', 'Font license notice is incomplete');
  const toolNotices = parseWith(z.object({ notices: z.array(z.strictObject({ tool: z.enum(['satori', 'sharp', 'playwright-core']), license: z.enum(['MPL-2.0', 'Apache-2.0']),
    path: z.string(), sha256: HashSchema, scope: z.literal('TOOL_NOTICE_NOT_A_MEDIA_ASSET') })).length(3) }), readStructured(root, 'creative/assets/licenses/manifest.json'), 'tool notice manifest');
  if (new Set(toolNotices.notices.map(n => n.tool)).size !== 3) throw new GtmError('ASSET_LICENSE', 'Expected three distinct renderer/test tool notices');
  for (const item of toolNotices.notices) {
    if (item.path !== `creative/assets/licenses/${item.tool}-LICENSE.txt` || sha256(readText(root, item.path)) !== item.sha256 ||
      item.license !== (item.tool === 'satori' ? 'MPL-2.0' : 'Apache-2.0')) throw new GtmError('ASSET_LICENSE', 'Renderer tool notice differs from reviewed pins');
  }
  return { tenant, revision: 'phase-d-r1', label: 'SYNTHETIC DEMO / PLACEHOLDER', approvalStatus: 'NOT_APPROVED',
    audience: tenant === 'retropick' ? 'Owner reviewing illustrative product-education creative' : 'Owner reviewing illustrative technical editorial creative',
    inputs, inputSha256: hashObject(inputs), evidenceScope: 'GOVERNANCE_ONLY_NO_PUBLIC_FACTS',
    assets: { fonts: fontManifest, tools: toolNotices, artwork: 'ORIGINAL_LOCAL_GEOMETRY', footage: 'NONE', music: 'NONE', voice: 'NONE', likeness: 'NONE' },
    host: { node: process.version, platform: process.platform, arch: process.arch },
    publicationAuthorized: false, providerCalls: 0, providerCostUsd: 0, operatorComputeCost: 'NOT_MEASURED',
    limitations: ['Neutral demo styling; official brand tokens are not verified.', 'Illustrative text and geometry only; no actual product UI, market activity, achievement or performance claim.',
      'Automated geometry/contrast/codec checks do not substitute for owner creative review or publication approval.'] };
}

export function immutableFile(root: string, path: string, bytes: string | Buffer) {
  const target = safePath(root, path); const hash = sha256(bytes);
  if (existsSync(target)) {
    if (sha256(readFileSync(target)) !== hash) throw new GtmError('CREATIVE_IMMUTABLE', 'Existing creative file differs from its immutable inputs');
  } else writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
  return { path, sha256: hash, bytes: Buffer.byteLength(bytes) };
}
export function outputDirectory(root: string, tenant: Tenant, kind: 'graphics' | 'video', inputs: unknown) {
  const path = `runtime/creative/${tenant}/${kind}/${hashObject(inputs)}`; safeDirectory(root, path); return path;
}
export function jsonFile(root: string, path: string, data: unknown) { return immutableFile(root, path, canonical(data)); }

export function contrast(a: string, b: string): number {
  function luminance(color: string) {
    const channels = [1, 3, 5].map(i => Number.parseInt(color.slice(i, i + 2), 16) / 255)
      .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  }
  const first = luminance(a), second = luminance(b); return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
