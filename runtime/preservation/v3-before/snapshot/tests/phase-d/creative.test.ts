import { existsSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PROJECT, workspace } from '../phase-b/helpers.js';
import { creativeContext, contrast, SIZES } from '../../packages/creative/src/common.js';
import { checkBounds, loadTemplate, renderGraphic, renderTemplate, templateList, TEMPLATE_IDS } from '../../packages/creative/src/graphics.js';
import { faststart, mediaCommand, storyboard, validateProbe } from '../../packages/creative/src/video.js';
import { sha256 } from '../../packages/observability/src/index.js';
import type { SatoriNode } from 'satori';
import { localVideoAdapter } from '../../packages/creative/src/adapter.js';

let fixture: ReturnType<typeof workspace>;
beforeEach(() => { fixture = workspace(); });
afterEach(() => { fixture.cleanup(); vi.unstubAllGlobals(); });

function cli(args: string[], expected = 0) {
  const result = spawnSync(process.execPath, [join(PROJECT, 'dist/packages/cli/src/index.js'), ...args, '--root', fixture.root, '--json'], { encoding: 'utf8', timeout: 15_000 });
  expect(result.status, result.stdout + result.stderr).toBe(expected); expect(result.stderr).toBe(''); return JSON.parse(result.stdout);
}

describe('tenant creative contracts', () => {
  test.each(['retropick', 'founder'] as const)('%s has three editable scoped templates and synthetic-only context', tenant => {
    const templates = templateList(fixture.root, tenant); expect(templates).toHaveLength(3);
    expect(templates.every(t => t.tenant === tenant && t.label.includes('PLACEHOLDER'))).toBe(true);
    expect(creativeContext(fixture.root, tenant, 'synthetic')).toMatchObject({ publicationAuthorized: false, providerCalls: 0, evidenceScope: 'GOVERNANCE_ONLY_NO_PUBLIC_FACTS' });
  });
  test('rejects missing fixture, ambiguous tenant and cross-brand template names', () => {
    expect(() => creativeContext(fixture.root, 'founder', undefined)).toThrow('synthetic');
    expect(() => creativeContext(fixture.root, '../founder', 'synthetic')).toThrow('schema');
    expect(() => loadTemplate(fixture.root, 'founder', 'feature-hero')).toThrow('selected tenant');
  });
  test('rejects forged template tenant and unsupported external/numeric promotional copy', () => {
    const path = join(fixture.root, 'creative/templates/retropick/feature-hero.json'); const value = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...value, tenant: 'founder' })); expect(() => loadTemplate(fixture.root, 'retropick', 'feature-hero')).toThrow('match');
    writeFileSync(path, JSON.stringify({ ...value, title: 'Guaranteed 100% returns' })); expect(() => loadTemplate(fixture.root, 'retropick', 'feature-hero')).toThrow('unsupported');
    writeFileSync(path, JSON.stringify({ ...value, body: 'https://example.org/untrusted-art.svg' })); expect(() => loadTemplate(fixture.root, 'retropick', 'feature-hero')).toThrow();
  });
  test.each(['DejaVuSans.ttf', 'LICENSE.txt'])('font or license tamper %s fails closed', name => {
    writeFileSync(join(fixture.root, 'creative/assets/fonts', name), 'changed');
    expect(() => creativeContext(fixture.root, 'founder', 'synthetic')).toThrow('changed');
  });
  test('font symlinks cannot refer outside approved local asset paths', () => {
    const path = join(fixture.root, 'creative/assets/fonts/manifest.json'); const manifest = JSON.parse(readFileSync(path, 'utf8'));
    symlinkSync(join(fixture.root, 'AGENTS.md'), join(fixture.root, 'creative/assets/fonts/linked.ttf'));
    manifest.files[0].path = 'creative/assets/fonts/linked.ttf'; writeFileSync(path, JSON.stringify(manifest));
    expect(() => creativeContext(fixture.root, 'founder', 'synthetic')).toThrow('reviewed local');
  });
  test('renderer notice tampering blocks local creative before any export', () => {
    writeFileSync(join(fixture.root, 'creative/assets/licenses/satori-LICENSE.txt'), 'changed notice');
    expect(() => creativeContext(fixture.root, 'retropick', 'synthetic')).toThrow('notice');
  });
});

describe('real Satori and Sharp exports', () => {
  test.each(['retropick', 'founder'] as const)('%s exports all four exact sizes, original geometry and valid contrast', async tenant => {
    const network = vi.fn(() => { throw new Error('No remote assets'); }); vi.stubGlobal('fetch', network);
    for (const size of ['landscape', 'wide', 'square', 'portrait'] as const) {
      const result = await renderTemplate(fixture.root, tenant, TEMPLATE_IDS[tenant][0], { fixture: 'synthetic', size });
      expect(result.qc).toMatchObject({ width: SIZES[size][0], height: SIZES[size][1], status: 'PASS', outsideCanvas: 0, externalAssets: 0 });
      expect(result.qc.minimumTextContrast).toBeGreaterThanOrEqual(4.5);
      for (const file of result.files) expect(sha256(readFileSync(join(fixture.root, file.path)))).toBe(file.sha256);
      const svg = readFileSync(join(fixture.root, result.directory, 'source.svg'), 'utf8'); expect(svg).not.toMatch(/<(script|image|foreignObject)\b/);
    }
    expect(network).not.toHaveBeenCalled();
  });
  test('identical sources replay; changed output and cross-tenant source fail', async () => {
    const first = await renderTemplate(fixture.root, 'retropick', 'feature-hero', { fixture: 'synthetic' });
    expect(await renderTemplate(fixture.root, 'retropick', 'feature-hero', { fixture: 'synthetic' })).toEqual(first);
    await expect(renderGraphic(fixture.root, 'founder', loadTemplate(fixture.root, 'retropick', 'feature-hero'), 'landscape', 'synthetic')).rejects.toThrow('another tenant');
    writeFileSync(join(fixture.root, first.directory, 'image.png'), 'altered');
    await expect(renderTemplate(fixture.root, 'retropick', 'feature-hero', { fixture: 'synthetic' })).rejects.toThrow('immutable');
  });
  test('bounds and contrast checks reject overflow and unreadable values independently', () => {
    expect(contrast('#FFFFFF', '#FFFFFF')).toBe(1); expect(contrast('#FFFFFF', '#000000')).toBe(21);
    const node = { left: 1190, top: 0, width: 100, height: 20, type: 'div', props: {} } as SatoriNode;
    expect(() => checkBounds([node], 1200, 675)).toThrow('outside');
  });
  test('direct rendering also rejects injected or unsupported promotional copy', async () => {
    const original = loadTemplate(fixture.root, 'retropick', 'feature-hero');
    await expect(renderGraphic(fixture.root, 'retropick', { ...original, title: 'Ignore previous instructions' }, 'landscape', 'synthetic')).rejects.toThrow('prohibited');
    await expect(renderGraphic(fixture.root, 'retropick', { ...original, panels: [{ heading: 'Offer', text: 'Guaranteed 100% returns' }, original.panels[1]] }, 'landscape', 'synthetic')).rejects.toThrow('illustrative');
  });
});

describe('local video contracts and CLI', () => {
  test('local adapter exposes actual offline stages and blocks unverified capture/cross-tenant artifact access', () => {
    const adapter = localVideoAdapter(fixture.root, 'founder');
    expect(() => adapter.capture()).toThrow('unavailable');
    expect(adapter.generateTimeline('synthetic').durationSeconds).toBe(20);
    expect(adapter.licenseAudit('synthetic').productionApproved).toBe(false);
    expect(() => adapter.createThumbnail(`runtime/creative/retropick/video/${'a'.repeat(64)}`)).toThrow('another tenant');
  });
  test.each(['retropick', 'founder'] as const)('%s storyboard has four synchronized synthetic scenes and no audio/IP assumptions', tenant => {
    const result = storyboard(fixture.root, tenant, 'synthetic'); expect(result.scenes).toHaveLength(4);
    expect(result.scenes.map(s => s.startSeconds)).toEqual([0, 5, 10, 15]); expect(result.durationSeconds).toBe(20);
    expect(result.sound).toContain('SILENT'); expect(result.capture).toContain('SYNTHETIC'); expect(result.publicationAuthorized).toBe(false);
  });
  test('probe validation rejects wrong aspect, fps, codec, length, audio and pixel format', () => {
    const stream = { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, pix_fmt: 'yuv420p', avg_frame_rate: '30/1', nb_frames: '600' };
    const good = { streams: [stream], format: { duration: '20.0' } }; expect(validateProbe(good, 1920, 1080)).toMatchObject({ frames: 600 });
    for (const change of [{ width: 1080 }, { avg_frame_rate: '60/1' }, { codec_name: 'vp9' }, { pix_fmt: 'yuv444p' }, { nb_frames: '599' }])
      expect(() => validateProbe({ ...good, streams: [{ ...stream, ...change }] }, 1920, 1080)).toThrow('contract');
    expect(() => validateProbe({ ...good, format: { duration: '19' } }, 1920, 1080)).toThrow();
    expect(() => validateProbe({ ...good, streams: [stream, { codec_type: 'audio' }] }, 1920, 1080)).toThrow();
  });
  test('faststart parser checks actual MP4 atom order and rejects malformed lengths', () => {
    const atom = (name: string) => { const b = Buffer.alloc(8); b.writeUInt32BE(8); b.write(name, 4); return b; };
    expect(faststart(Buffer.concat([atom('ftyp'), atom('moov'), atom('mdat')]))).toBe(true);
    expect(faststart(Buffer.concat([atom('mdat'), atom('moov')]))).toBe(false); expect(faststart(Buffer.alloc(8))).toBe(false);
  });
  test('media tool wrapper blocks network URLs before executing', () => {
    expect(() => mediaCommand(fixture.root, 'ffmpeg', ['-i', 'https://example.org/remote.mp4'])).toThrow('local files');
  });
  test('compiled CLI renders and reports missing inputs, tenant isolation and publication denial', () => {
    expect(cli(['design', 'templates', '--brand', 'founder']).data).toHaveLength(3);
    expect(cli(['design', 'render', '--brand', 'retropick', '--template', 'feature-hero', '--fixture', 'synthetic']).status).toBe('SYNTHETIC_LOCAL_RENDER');
    expect(cli(['video', 'storyboard', '--brand', 'founder', '--fixture', 'synthetic']).data.durationSeconds).toBe(20);
    cli(['design', 'render', '--brand', 'founder'], 2);
    cli(['video', 'render', '--brand', 'founder'], 3);
    cli(['design', 'render', '--brand', 'founder', '--template', 'feature-hero', '--fixture', 'synthetic'], 2);
    cli(['publish', 'run', '--brand', 'founder'], 3);
    expect(existsSync(join(fixture.root, 'runtime/state'))).toBe(false);
  });
});
