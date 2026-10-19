import satori, { type SatoriNode } from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { buildTree, checkBounds } from '../../creative/src/graphics.js';
import { creativeContext, immutableFile, type Size } from '../../creative/src/common.js';
import { mediaCommand, validateProbe, faststart } from '../../creative/src/video.js';
import { safeDirectory, safePath } from '../../core/src/workspace.js';
import { GtmError, hashObject, sha256 } from '../../observability/src/index.js';
import { context, open, records, type Dataset } from './common.js';
import { draftById } from './editorial.js';

export async function creativePack(root: string, selected: unknown, draftId: string, dataset: Dataset = 'OBSERVED') {
  const c = context(root, selected, dataset); const draft = draftById(root, c.tenant, draftId, dataset);
  const previous = records(root, c.tenant, 'creative', dataset).find(r => r.draftId === draftId);
  if (previous) {
    const files = previous.files as { path: string; sha256: string }[];
    for (const file of files) if (sha256(readFileSync(safePath(root, file.path))) !== file.sha256) throw new GtmError('CREATIVE_CHANGED', 'Committed creative file changed');
    return previous;
  }
  const assets = creativeContext(root, c.tenant, 'synthetic').assets;
  const inputs = { draft: hashObject(draft), assets, renderer: 'v3-editorial-r1',
    pipeline: sha256(readFileSync(safePath(root, 'packages/v3/src/creative.ts'))),
    layout: sha256(readFileSync(safePath(root, 'packages/creative/src/graphics.ts'))),
    native: sharp.versions, ffmpeg: sha256(readFileSync('/usr/bin/ffmpeg')) };
  const directory = `runtime/v3/${c.tenant}/creative/${hashObject(inputs)}`; safeDirectory(root, directory);
  const files: ReturnType<typeof immutableFile>[] = [];
  async function card(name: string, size: Size, index: number) {
    const statement = draft.claims[index % draft.claims.length]!.statement;
    const layout = buildTree({ tenant: c.tenant, variant: 'decision', eyebrow: 'SOURCE-SUPPORTED EXPLANATION',
      title: c.tenant === 'founder' ? 'Make the constraint inspectable' : 'Understand the documented scope',
      body: statement.length <= 150 ? statement : 'Read the complete source-supported statement and scope in the accompanying packet.', panels: [{ heading: 'Evidence', text: `Source revision ${draft.sourceRevision.slice(0, 22)}` },
        { heading: 'Boundary', text: 'Editorial prototype. No live UI or user activity shown.' }],
      footer: c.tenant === 'founder' ? 'No personal achievement inferred. Owner review required.' : 'Scope follows evidence. No assurance of trading outcomes.',
      label: dataset === 'SYNTHETIC' ? 'SYNTHETIC / PLACEHOLDER' : 'SOURCE REVIEW / PROTOTYPE VISUAL' }, size);
    const nodes: SatoriNode[] = [];
    const svg = await satori(layout.tree as Parameters<typeof satori>[0], { width: layout.width, height: layout.height,
      fonts: [{ name: 'DejaVu Sans', data: readFileSync(safePath(root, 'creative/assets/fonts/DejaVuSans.ttf')), weight: 400 },
        { name: 'DejaVu Sans', data: readFileSync(safePath(root, 'creative/assets/fonts/DejaVuSans-Bold.ttf')), weight: 700 }],
      onNodeDetected: n => nodes.push(n), embedFont: true });
    checkBounds(nodes, layout.width, layout.height);
    if (/<(?:script|image|foreignObject)\b|(?:href|src)=/i.test(svg)) throw new GtmError('RENDER_UNSAFE', 'External SVG resources are forbidden');
    const png = await sharp(Buffer.from(svg)).png().toBuffer(); const metadata = await sharp(png).metadata();
    if (metadata.width !== layout.width || metadata.height !== layout.height) throw new GtmError('CREATIVE_SIZE', 'Unexpected dimensions');
    files.push(immutableFile(root, `${directory}/${name}.svg`, svg), immutableFile(root, `${directory}/${name}.png`, png),
      immutableFile(root, `${directory}/${name}.webp`, await sharp(png).webp({ lossless: true }).toBuffer()),
      immutableFile(root, `${directory}/${name}.json`, JSON.stringify({ sourceStatement: statement, displayedCompleteClaim: statement.length <= 150, draftId, inputs, tree: layout.tree, dimensions: [layout.width, layout.height], safeMargin: layout.pad })),
      immutableFile(root, `${directory}/${name}.alt.txt`, `${statement} Editorial geometry with placeholder styling; no product UI or personal history depicted.`));
  }
  await card('cover-one', 'landscape', 0); await card('cover-two', 'square', 1);
  const videos = [];
  for (const [aspect, size, width, height] of [['landscape', 'videoLandscape', 1920, 1080], ['portrait', 'portrait', 1080, 1920]] as const) {
    const path = `${directory}/${aspect}`; safeDirectory(root, path);
    const captions = [];
    for (let i = 0; i < 4; i++) {
      const name = `${aspect}-scene-${i + 1}`; await card(name, size, i);
      mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-i', `${name}.png`,
        '-vf', `zoompan=z='1+0.010*on/150':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=150:s=${width}x${height}:fps=30`,
        '-frames:v', '150', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-threads', '2', '-pix_fmt', 'yuv420p',
        '-flags', '+bitexact', '-fflags', '+bitexact', '-map_metadata', '-1', '-y', `${aspect}/segment-${i + 1}.mp4`], directory);
      captions.push({ start: i * 5, end: (i + 1) * 5, text: c.tenant === 'founder' ? 'No personal achievement inferred. Owner review required.' : 'Scope follows evidence. No assurance of trading outcomes.' });
    }
    files.push(immutableFile(root, `${path}/segments.txt`, [1,2,3,4].map(i => `file 'segment-${i}.mp4'`).join('\n') + '\n'));
    mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-f', 'concat', '-safe', '1',
      '-i', 'segments.txt', '-c', 'copy', '-an', '-map_metadata', '-1', '-movflags', '+faststart', '-fflags', '+bitexact', '-y', 'video.mp4'], path);
    const result = mediaCommand(root, 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', 'video.mp4'], path);
    const spec = validateProbe(JSON.parse(result.stdout), width, height);
    if (!faststart(readFileSync(safePath(root, `${path}/video.mp4`)))) throw new GtmError('VIDEO_FASTSTART', 'Faststart required');
    const stamp = (n: number, mark = ',') => `00:00:${String(n).padStart(2, '0')}${mark}000`;
    files.push(immutableFile(root, `${path}/video.mp4`, readFileSync(safePath(root, `${path}/video.mp4`))),
      immutableFile(root, `${path}/captions.srt`, captions.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n')),
      immutableFile(root, `${path}/captions.vtt`, 'WEBVTT\n\n' + captions.map(cue => `${stamp(cue.start, '.')} --> ${stamp(cue.end, '.')}\n${cue.text}\n`).join('\n')),
      immutableFile(root, `${path}/timeline.json`, JSON.stringify({ aspect, captions, duration: 20, fps: 30, sourceDraft: draftId, motion: 'Gentle zoom; four five-second scenes; visible footer matches caption cues', sound: 'INTENTIONALLY_SILENT' })),
      immutableFile(root, `${path}/ffprobe.json`, result.stdout));
    mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-ss', '2.5', '-i', 'video.mp4', '-frames:v', '1', '-y', 'poster.png'], path);
    const poster = readFileSync(safePath(root, `${path}/poster.png`)); const stats = await sharp(poster).stats();
    if (stats.channels.slice(0,3).every(ch => ch.stdev < 3)) throw new GtmError('VIDEO_BLANK', 'Decoded poster appears blank');
    files.push(immutableFile(root, `${path}/poster.png`, poster)); videos.push({ aspect, ...spec, captionCues: 4, faststart: true });
  }
  const value = { ...c, id: `${c.tenant}-creative-${hashObject(inputs).slice(0, 24)}`, label: draft.label, draftId, directory, files, videos,
    inputs, assetSource: 'ORIGINAL_EDITORIAL_GEOMETRY_AND_LICENSED_DEJAVU_FONT', assetLicense: assets.fonts.license,
    actualProductFootage: false, styling: 'PROVISIONAL', qc: { status: 'PASS', decodedPoster: true, geometry: 'BOUNDS_CHECKED', humanReview: 'PENDING' } };
  immutableFile(root, `${directory}/manifest.json`, JSON.stringify(value, null, 2) + '\n');
  using store = open(root, c.tenant, dataset); store.put('creative', value); return value;
}
