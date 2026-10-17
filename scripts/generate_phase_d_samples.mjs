/** Local sample rendering + browser pixel/geometry QA; no remote URLs or existing profiles. */
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, TEMPLATE_IDS } from '../dist/packages/creative/src/graphics.js';
import { renderVideo } from '../dist/packages/creative/src/video.js';
import { sha256 } from '../dist/packages/observability/src/index.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = resolve(root, 'runtime/phase-d-browser'); mkdirSync(browserRoot, { recursive: true });
process.env.TMPDIR = browserRoot;
if (!existsSync('/usr/bin/google-chrome')) throw new Error('BLOCKED: local Chrome executable unavailable; nothing downloaded');
const profile = resolve(browserRoot, 'profile'); rmSync(profile, { recursive: true, force: true });
const context = await chromium.launchPersistentContext(profile, { executablePath: '/usr/bin/google-chrome', headless: true,
  offline: true, serviceWorkers: 'block', viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1,
  env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TMPDIR: browserRoot, XDG_CONFIG_HOME: browserRoot, XDG_CACHE_HOME: browserRoot } });
let attemptedRequests = 0;
await context.route('**/*', route => { attemptedRequests++; return route.abort(); });
const graphics = [], videos = [], browserChecks = [];
try {
  const page = await context.newPage();
  for (const tenant of ['retropick', 'founder']) {
    for (const template of TEMPLATE_IDS[tenant]) {
      for (const size of ['landscape', 'wide', 'square', 'portrait']) {
        const result = await renderTemplate(root, tenant, template, { fixture: 'synthetic', size });
        const svg = readFileSync(resolve(root, result.directory, 'source.svg'), 'utf8');
        await page.setViewportSize({ width: result.qc.width, height: result.qc.height });
        await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"></head><body style="margin:0">${svg}</body></html>`, { waitUntil: 'load' });
        const dimensions = await page.evaluate(() => {
          const svg = document.querySelector('svg'); const box = svg.getBoundingClientRect();
          const bad = [...svg.querySelectorAll('path,rect,text')].filter(node => {
            const r = node.getBoundingClientRect(); return r.left < -1 || r.top < -1 || r.right > box.width + 1 || r.bottom > box.height + 1;
          });
          return { width: box.width, height: box.height, overflowingPrimitives: bad.length,
            documentOverflow: document.documentElement.scrollWidth > box.width || document.documentElement.scrollHeight > box.height };
        });
        const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
        const browserPixels = await sharp(screenshot).removeAlpha().raw().toBuffer();
        const rasterPixels = await sharp(resolve(root, result.directory, 'image.png')).removeAlpha().raw().toBuffer();
        if (browserPixels.length !== rasterPixels.length) throw new Error('Browser and Sharp raster dimensions differ');
        let sum = 0; for (let i = 0; i < browserPixels.length; i++) sum += Math.abs(browserPixels[i] - rasterPixels[i]);
        const meanAbsolutePixelDifference = sum / browserPixels.length;
        if (dimensions.overflowingPrimitives || dimensions.documentOverflow || meanAbsolutePixelDifference > 3)
          throw new Error(`Browser QC failed for ${tenant}/${template}/${size}`);
        const screenshotPath = `${result.directory}/browser-qc.png`; writeFileSync(resolve(root, screenshotPath), screenshot);
        browserChecks.push({ tenant, template, size, ...dimensions, meanAbsolutePixelDifference,
          screenshot: { path: screenshotPath, sha256: sha256(screenshot) }, status: 'PASS' });
        graphics.push({ tenant, template, size, directory: result.directory, receipt: result.receipt, qc: result.qc });
      }
    }
  }
  for (const size of ['landscape', 'portrait']) {
    const result = await renderVideo(root, 'retropick', { fixture: 'synthetic', size, rebuild: process.argv.includes('--rebuild') });
    videos.push({ tenant: 'retropick', aspect: size, directory: result.directory, qc: result.qc,
      receipt: { path: `${result.directory}/manifest.json`, sha256: sha256(readFileSync(resolve(root, result.directory, 'manifest.json'))) } });
  }
  const report = { revision: 'phase-d-r1', status: 'PASS', graphics, videos, browserChecks,
    browser: { executable: '/usr/bin/google-chrome', version: context.browser().version(), network: 'OFFLINE_CONTEXT_ALL_REQUESTS_ABORTED', attemptedRequests },
    ownerReview: 'REQUIRED_NOT_APPROVED', providerCalls: 0,
    limitations: ['Browser/Sharp pixel comparison tolerates edge antialiasing; it is not semantic fact verification.',
      'SYNTHETIC editorial concepts only. No real product capture, official brand palette, audio, likeness or measured product outcome.'] };
  if (attemptedRequests !== 0) throw new Error('Unexpected browser resource request');
  writeFileSync(resolve(root, 'docs/evidence/phase-d-media.json'), JSON.stringify(report, null, 2) + '\n');
  const gallery = '# Phase D local creative samples\n\nSYNTHETIC DEMO / PLACEHOLDER. Owner review required; NOT APPROVED. No actual product UI, official brand identity or personal achievements.\n\n' +
    graphics.filter(g => g.size === 'landscape').map(g => `- [${g.tenant} / ${g.template}](../${g.directory}/image.png) — [editable source](../${g.directory}/source.json), [SVG](../${g.directory}/source.svg), [receipt](../${g.directory}/manifest.json)`).join('\n') + '\n\n' +
    videos.map(v => `- [RetroPick ${v.aspect} video](../${v.directory}/video.mp4) — [poster](../${v.directory}/poster.png), [captions](../${v.directory}/captions.srt), [timeline](../${v.directory}/timeline.json), [QC](../${v.directory}/qc.json)`).join('\n') +
    '\n\nAll local paths are regenerated by `pnpm build && node scripts/generate_phase_d_samples.mjs`. Exact bytes, four sizes per template, browser pixel checks and dimensions are indexed in `docs/evidence/phase-d-media.json`. Generated binaries remain under ignored runtime/; editable templates and licensed fonts are tracked. Text/geometry are original local demos; font and renderer notices are preserved under creative/assets/. Outputs use no footage, stock artwork, music, voice model or likeness.\n';
  writeFileSync(resolve(root, 'docs/PHASE_D_GALLERY.md'), gallery);
  process.stdout.write(JSON.stringify({ status: 'PASS', graphics: graphics.length, videos: videos.length, browserChecks: browserChecks.length, networkRequests: attemptedRequests }) + '\n');
} finally { await context.close(); }
