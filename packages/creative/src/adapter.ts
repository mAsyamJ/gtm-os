import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { GtmError, sha256 } from '../../observability/src/index.js';
import { parseWith, safePath } from '../../core/src/workspace.js';
import { TenantSchema } from '../../schemas/src/index.js';
import { creativeContext } from './common.js';
import { renderVideo, storyboard } from './video.js';

/** Local creative adapter, separate from the mock/provider publishing contract. */
export function localVideoAdapter(root: string, selected: unknown) {
  const tenant = parseWith(TenantSchema, selected, 'tenant');
  function verifiedDirectory(directory: string) {
    if (!new RegExp(`^runtime/creative/${tenant}/video/[a-f0-9]{64}$`).test(directory))
      throw new GtmError('TENANT_MISMATCH', 'Video artifact belongs to another tenant or unsafe path');
    const bytes = readFileSync(safePath(root, `${directory}/manifest.json`));
    if (sha256(bytes) !== readFileSync(safePath(root, `${directory}/manifest.sha256.txt`), 'utf8')) throw new GtmError('CREATIVE_IMMUTABLE', 'Video manifest changed');
    const manifest = parseWith(z.object({ tenant: TenantSchema, files: z.array(z.object({ path: z.string(), sha256: z.string() })), qc: z.json() }), JSON.parse(bytes.toString()), 'video artifact');
    if (manifest.tenant !== tenant) throw new GtmError('TENANT_MISMATCH', 'Video manifest belongs to another tenant');
    for (const file of manifest.files) {
      if (!file.path.startsWith(directory + '/') || sha256(readFileSync(safePath(root, file.path))) !== file.sha256) throw new GtmError('CREATIVE_IMMUTABLE', 'Video artifact file changed');
    }
    return manifest;
  }
  return {
    capture(): never { throw new GtmError('CAPTURE_UNVERIFIED', 'Real UI capture is unavailable until the product/source and redaction scope are verified', 4); },
    storyboard: (fixture: unknown) => storyboard(root, tenant, fixture),
    generateTimeline: (fixture: unknown) => ({ ...storyboard(root, tenant, fixture), editableSource: 'timeline.json plus source scene SVG/JSON/PNG and fixed FFmpeg recipe' }),
    render: (options: { fixture: unknown; size?: unknown }) => renderVideo(root, tenant, options),
    generateCaptions(directory: string) {
      verifiedDirectory(directory); return { srt: readFileSync(safePath(root, `${directory}/captions.srt`), 'utf8'), vtt: readFileSync(safePath(root, `${directory}/captions.vtt`), 'utf8') };
    },
    createThumbnail(directory: string) { const manifest = verifiedDirectory(directory); return manifest.files.find(f => f.path === `${directory}/poster.png`); },
    probe(directory: string) { verifiedDirectory(directory); return JSON.parse(readFileSync(safePath(root, `${directory}/ffprobe.json`), 'utf8')) as unknown; },
    visualQA(directory: string) { return verifiedDirectory(directory).qc; },
    licenseAudit(fixture: unknown) { const context = creativeContext(root, tenant, fixture); return { tenant, assets: context.assets, status: 'LOCAL_SYNTHETIC_ASSETS_ONLY', productionApproved: false,
      limitations: ['No actual product footage, stock media, audio, font modification, likeness or official brand assets.', 'Tool build/license receipts do not certify every patent or publication requirement.'] }; },
  };
}
