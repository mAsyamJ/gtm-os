import satori, { type SatoriNode } from 'satori';
import sharp from 'sharp';
import { readFileSync, readdirSync } from 'node:fs';
import { canonical, GtmError, hashObject } from '../../observability/src/index.js';
import { screenUntrusted } from '../../research/src/index.js';
import { parseWith, readStructured, safePath } from '../../core/src/workspace.js';
import { TenantSchema } from '../../schemas/src/index.js';
import { contrast, creativeContext, immutableFile, jsonFile, outputDirectory, SIZES, SizeSchema, TemplateSchema, type Size, type Template } from './common.js';

type Style = Record<string, string | number>;
interface Element { type: string; props: { style: Style; children: string | Element[]; [key: string]: unknown } }
const div = (style: Style, children: string | Element[], extra: Record<string, unknown> = {}): Element => ({ type: 'div', props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children, ...extra } });
export const TEMPLATE_IDS = { retropick: ['feature-hero', 'mechanism-notes', 'evidence-checklist'], founder: ['decision-note', 'reliability-check', 'learning-map'] } as const;

export function loadTemplate(root: string, selected: unknown, name: string): Template {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  if (!(TEMPLATE_IDS[tenant] as readonly string[]).includes(name)) throw new GtmError('TEMPLATE_SCOPE', 'Template is unavailable for the selected tenant', 2);
  const value = parseWith(TemplateSchema, readStructured(root, `creative/templates/${tenant}/${name}.json`), 'creative template');
  if (value.tenant !== tenant || value.id !== name) throw new GtmError('TENANT_MISMATCH', 'Template does not match selected tenant/name');
  if (Object.values(value).some(v => typeof v === 'string' && /https?:|<script|\bguaranteed\b|\d+%/i.test(v)))
    throw new GtmError('TEMPLATE_UNSAFE', 'External assets, executable markup and unsupported numeric/financial copy are unavailable');
  return value;
}
export function templateList(root: string, selected: unknown) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  const actual = readdirSync(safePath(root, `creative/templates/${tenant}`)).filter(n => n.endsWith('.json')).sort();
  if (actual.join() !== [...TEMPLATE_IDS[tenant]].sort().map(n => n + '.json').join()) throw new GtmError('TEMPLATE_INVENTORY', 'Template inventory differs from the scoped contract');
  return TEMPLATE_IDS[tenant].map(id => loadTemplate(root, tenant, id));
}

export function buildTree(template: Template, size: Size) {
  const [width, height] = SIZES[size]; const portrait = height >= width;
  const factor = width / 1200; const pad = Math.round(width * 0.065);
  const fontFactor = factor * (height > width ? 1.5 : 1);
  const product = template.tenant === 'retropick';
  const colors = product ? { background: '#131720', foreground: '#F2F3F5', muted: '#B8C0CC', accent: '#D4DDC7', panel: '#202731' } :
    { background: '#F3F0E8', foreground: '#202831', muted: '#48515B', accent: '#303F4F', panel: '#E2DFD6' };
  const labelSize = Math.round(17 * fontFactor); const titleSize = Math.round((portrait ? 66 : 54) * fontFactor);
  const row = template.variant === 'steps' ? template.panels : template.variant === 'decision' ? template.panels.slice(0, 2) : template.panels;
  const children = [
    div({ fontSize: labelSize, fontWeight: 700, letterSpacing: 2 * factor, color: colors.muted, justifyContent: 'space-between', width: '100%' }, [
      div({}, product ? 'RETROPICK / CONCEPT STUDIO' : 'ASYAM / DECISION NOTEBOOK'), div({}, portrait ? 'DEMO' : 'LOCAL REVIEW')]),
    div({ flex: 1, flexDirection: portrait ? 'column' : 'row', gap: 30 * factor, marginTop: portrait ? 45 * factor : 25 * factor, alignItems: portrait ? 'stretch' : 'center' }, [
      div({ flexDirection: 'column', width: portrait ? '100%' : '55%' }, [
        div({ fontSize: 17 * fontFactor, letterSpacing: 2 * factor, color: colors.muted }, template.eyebrow.toUpperCase()),
        div({ marginTop: 16 * factor, fontSize: titleSize, lineHeight: 1.10, fontWeight: 700, maxWidth: '100%', letterSpacing: -1.5 * factor }, template.title),
        div({ marginTop: 22 * factor, fontSize: 23 * fontFactor, lineHeight: 1.4, color: colors.muted, maxWidth: '100%' }, template.body)]),
      div({ gap: 12 * factor, flexDirection: 'column', width: portrait ? '100%' : '42%' }, row.map((panel, index) =>
        div({ backgroundColor: colors.panel, borderRadius: 12 * factor, padding: 16 * factor, flexDirection: 'column', gap: 8 * factor }, [
          div({ fontSize: 14 * fontFactor, color: colors.muted }, `${String(index + 1).padStart(2, '0')} / ${template.variant === 'decision' ? 'OPTION' : 'CHECK'}`),
          div({ fontSize: 21 * fontFactor, fontWeight: 700, lineHeight: 1.15 }, panel.heading),
          div({ fontSize: 17 * fontFactor, color: colors.muted, lineHeight: 1.35 }, panel.text)])))]),
    div({ paddingTop: 18 * factor, fontSize: (height > width ? 36 : 17) * factor, color: colors.muted, lineHeight: 1.35 }, template.footer),
    div({ marginTop: 14 * factor, fontSize: 16 * fontFactor, fontWeight: 700, color: colors.foreground, letterSpacing: 1 * factor }, template.label),
  ];
  const tree = div({ width, height, backgroundColor: colors.background, color: colors.foreground,
    fontFamily: 'DejaVu Sans', padding: pad, flexDirection: 'column', overflow: 'hidden' }, children);
  return { tree, colors, width, height, pad, portrait };
}

export function checkBounds(nodes: SatoriNode[], width: number, height: number) {
  const outside = nodes.filter(n => n.left < -0.5 || n.top < -0.5 || n.left + n.width > width + 0.5 || n.top + n.height > height + 0.5);
  if (outside.length) throw new GtmError('CREATIVE_OVERFLOW', 'Rendered content extends outside the canvas');
  return { nodesMeasured: nodes.length, outsideCanvas: outside.length };
}

export async function renderTemplate(root: string, selected: unknown, name: string, options: { fixture: unknown; size?: unknown }) {
  const context = creativeContext(root, selected, options.fixture); const template = loadTemplate(root, context.tenant, name);
  const size = parseWith(SizeSchema, options.size ?? 'landscape', 'render size');
  return renderGraphic(root, context.tenant, template, size, options.fixture);
}

/** Only the internal trusted template tree is passed to Satori; there is no remote asset callback. */
export async function renderGraphic(root: string, selected: unknown, raw: unknown, size: Size, fixture: unknown) {
  const context = creativeContext(root, selected, fixture); const template = parseWith(TemplateSchema, raw, 'creative source');
  if (template.tenant !== context.tenant) throw new GtmError('TENANT_MISMATCH', 'Creative source belongs to another tenant');
  screenUntrusted(template);
  if (/https?:|<script|\bguaranteed\b|\d+%/i.test(canonical(template))) throw new GtmError('TEMPLATE_UNSAFE', 'Only local illustrative text is supported');
  const layout = buildTree(template, size); const nodes: SatoriNode[] = []; const errors: string[] = [];
  const svg = await satori(layout.tree as Parameters<typeof satori>[0], { width: layout.width, height: layout.height,
    fonts: [{ name: 'DejaVu Sans', data: readFileSync(safePath(root, 'creative/assets/fonts/DejaVuSans.ttf')), weight: 400 },
      { name: 'DejaVu Sans', data: readFileSync(safePath(root, 'creative/assets/fonts/DejaVuSans-Bold.ttf')), weight: 700 }],
    embedFont: true, onNodeDetected: node => nodes.push(node), onStyleError: error => errors.push(error.message) });
  if (errors.length || /<(?:script|image|foreignObject)\b|(?:href|src)=/i.test(svg)) throw new GtmError('RENDER_UNSAFE', 'Unsafe SVG resource or unsupported style');
  const bounds = checkBounds(nodes, layout.width, layout.height);
  const ratios = [contrast(layout.colors.foreground, layout.colors.background), contrast(layout.colors.muted, layout.colors.background),
    contrast(layout.colors.foreground, layout.colors.panel), contrast(layout.colors.muted, layout.colors.panel)];
  if (ratios.some(r => r < 4.5)) throw new GtmError('CREATIVE_CONTRAST', 'Demo text contrast must reach WCAG AA for normal text');
  const directory = outputDirectory(root, context.tenant, 'graphics', { context, template, size, renderer: 'satori-0.62.0-sharp-0.35.5', nativeVersions: sharp.versions });
  const png = await sharp(Buffer.from(svg)).png().toBuffer(); const webp = await sharp(png).webp({ lossless: true }).toBuffer();
  const files = [immutableFile(root, `${directory}/source.svg`, svg), immutableFile(root, `${directory}/image.png`, png), immutableFile(root, `${directory}/image.webp`, webp),
    jsonFile(root, `${directory}/source.json`, { template, size, tree: layout.tree, fontManifest: context.assets.fonts }),
    immutableFile(root, `${directory}/alt.txt`, template.alt)];
  const meta = await sharp(png).metadata();
  if (meta.width !== layout.width || meta.height !== layout.height) throw new GtmError('RENDER_SIZE', 'Raster dimensions differ from requested canvas');
  const qc = { status: 'PASS', width: meta.width, height: meta.height, ...bounds, minimumTextContrast: Math.min(...ratios),
    altTextPresent: true, externalAssets: 0, safeMarginPixels: layout.pad, styleErrors: errors.length,
    textLegibility: 'AUTOMATED_GEOMETRY_AND_CONTRAST_ONLY_OWNER_REVIEW_REQUIRED' };
  const manifest = { ...context, kind: 'graphics', templateId: template.id, templateSha256: hashObject(template), size,
    renderer: { satori: '0.62.0', sharp: sharp.versions }, files, qc, directory };
  const receipt = jsonFile(root, `${directory}/manifest.json`, manifest);
  return { ...manifest, receipt };
}
