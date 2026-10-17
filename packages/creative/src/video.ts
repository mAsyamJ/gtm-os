import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import sharp from 'sharp';
import { z } from 'zod';
import { GtmError, sha256 } from '../../observability/src/index.js';
import { parseWith, safePath } from '../../core/src/workspace.js';
import { creativeContext, immutableFile, jsonFile, outputDirectory, SIZES, type Size, type Template } from './common.js';
import { renderGraphic } from './graphics.js';

const Tool = z.enum(['ffmpeg', 'ffprobe']);
/** Reviewed absolute executables, fixed argv, no shell, protocol allowlist and workspace-only cwd. */
export function mediaCommand(root: string, tool: z.infer<typeof Tool>, args: string[], directory = '.') {
  const selected = Tool.parse(tool); const executable = `/usr/bin/${selected}`;
  if (!existsSync(executable)) throw new GtmError('MEDIA_TOOL_MISSING', 'Required local FFmpeg tool is unavailable', 4);
  if (args.some(arg => /(?:https?|ftp|tcp|udp):\/\//i.test(arg))) throw new GtmError('MEDIA_NETWORK_DENIED', 'Media commands accept local files only', 3);
  const result = spawnSync(executable, [...(selected === 'ffmpeg' ? ['-nostdin'] : []), ...args], { cwd: safePath(root, directory), encoding: 'utf8',
    timeout: 120_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' } });
  if (result.error || result.status !== 0) throw new GtmError('MEDIA_TOOL_FAILED', `${selected} failed local validation/rendering`, 6);
  return { stdout: result.stdout, stderr: result.stderr };
}

function probe(root: string, directory: string) {
  const result = spawnSync('/usr/bin/ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', 'video.mp4'],
    { cwd: safePath(root, directory), encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new GtmError('PROBE_FAILED', 'ffprobe could not validate the generated local file', 6);
  try { return JSON.parse(result.stdout) as unknown; } catch { throw new GtmError('PROBE_INVALID', 'ffprobe output was not valid JSON'); }
}

export function storyboard(root: string, selected: unknown, fixture: unknown) {
  const context = creativeContext(root, selected, fixture); const product = context.tenant === 'retropick';
  const content = product ? [
    ['Start with a question.', 'What would make a product explanation useful?', 'A synthetic RetroPick creative concept, not product footage.'],
    ['Make the mechanism clear.', 'Show only what a current source can support.', 'No live feature or market activity is asserted here.'],
    ['Keep the boundary visible.', 'Name the missing proof and explain the limitation.', 'Risk and uncertainty belong in the explanation.'],
    ['Verify before the next step.', 'Use current evidence, then review the draft.', 'Concept for owner review. Nothing is published.'],
  ] : [
    ['I would start with a question.', 'What tradeoff should the example make inspectable?', 'An illustrative technical note, not a personal achievement.'],
    ['Compare the alternatives.', 'Name the constraint that each option handles.', 'A useful decision note keeps uncertainty visible.'],
    ['Write the test first.', 'Describe a reproducible check and a failure condition.', 'No performance number is claimed without measurement.'],
    ['Keep evidence attached.', 'Attribute the example and distinguish fact from interpretation.', 'A local concept for owner review. Nothing is published.'],
  ];
  return { ...context, kind: 'storyboard', durationSeconds: 20, fps: 30,
    sound: 'INTENTIONALLY_SILENT_NO_AUDIO_ASSETS', capture: 'NONE_SYNTHETIC_EDITORIAL_GEOMETRY',
    scenes: content.map(([title, body, caption], index) => ({ id: `scene-${index + 1}`, startSeconds: index * 5,
      durationSeconds: 5, title: title!, body: body!, caption: caption!, motion: 'Centered gentle zoom from 1.000 to 1.015; hard cut at each five-second boundary',
      evidence: 'ILLUSTRATIVE_ONLY_NO_FACTUAL_ASSERTION' })) };
}

export function validateProbe(raw: unknown, width: number, height: number) {
  const value = parseWith(z.object({ streams: z.array(z.object({ codec_type: z.string(), codec_name: z.string().optional(),
    width: z.number().optional(), height: z.number().optional(), pix_fmt: z.string().optional(), avg_frame_rate: z.string().optional(),
    nb_frames: z.string().optional() })), format: z.object({ duration: z.string() }) }), raw, 'ffprobe result');
  const video = value.streams.filter(s => s.codec_type === 'video');
  if (video.length !== 1 || video[0]?.codec_name !== 'h264' || video[0].pix_fmt !== 'yuv420p' || video[0].width !== width ||
      video[0].height !== height || video[0].avg_frame_rate !== '30/1' || video[0].nb_frames !== '600' ||
      Math.abs(Number(value.format.duration) - 20) > 0.05 || value.streams.some(s => s.codec_type === 'audio'))
    throw new GtmError('VIDEO_SPEC', 'Generated media does not match the 20-second silent H.264/30fps contract');
  return { codec: 'h264', pixelFormat: 'yuv420p', width, height, fps: 30, frames: 600, durationSeconds: Number(value.format.duration),
    audio: { present: false, expected: false, peak: 'NOT_APPLICABLE', silence: 'INTENTIONALLY_SILENT' } };
}

export function faststart(buffer: Buffer): boolean {
  let offset = 0, moov = -1, mdat = -1;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8);
    if (size < 8 || offset + size > buffer.length) return false;
    if (type === 'moov') moov = offset;
    if (type === 'mdat' && mdat < 0) mdat = offset;
    offset += size;
  }
  return moov >= 0 && mdat >= 0 && moov < mdat;
}

function time(seconds: number, separator: string) { return `00:00:${String(seconds).padStart(2, '0')}${separator}000`; }

export async function renderVideo(root: string, selected: unknown, options: { fixture: unknown; size?: unknown; rebuild?: boolean }) {
  const board = storyboard(root, selected, options.fixture);
  const aspect = parseWith(z.enum(['landscape', 'portrait']), options.size ?? 'landscape', 'video aspect');
  const graphicSize: Size = aspect === 'landscape' ? 'videoLandscape' : 'portrait'; const [width, height] = SIZES[graphicSize];
  if (!existsSync('/usr/bin/ffmpeg') || !existsSync('/usr/bin/ffprobe')) throw new GtmError('MEDIA_TOOL_MISSING', 'FFmpeg and ffprobe are required', 4);
  const ffmpegHash = sha256(readFileSync('/usr/bin/ffmpeg')); const ffprobeHash = sha256(readFileSync('/usr/bin/ffprobe'));
  const directory = outputDirectory(root, board.tenant, 'video', { board, aspect, ffmpegHash, ffprobeHash, encoder: 'libx264-ultrafast-crf20-zoom-v1' });
  const receiptPath = `${directory}/manifest.json`;
  if (existsSync(safePath(root, receiptPath))) {
    const hashPath = safePath(root, `${directory}/manifest.sha256.txt`);
    if (!existsSync(hashPath) || readFileSync(hashPath, 'utf8') !== sha256(readFileSync(safePath(root, receiptPath))))
      throw new GtmError('CREATIVE_IMMUTABLE', 'Video manifest checksum is missing or changed');
    const stored = parseWith(z.object({ files: z.array(z.object({ path: z.string(), sha256: z.string() }).passthrough()) }).passthrough(), JSON.parse(readFileSync(safePath(root, receiptPath), 'utf8')), 'existing video manifest');
    for (const file of stored.files) {
      if (!file.path.startsWith(directory + '/') || sha256(readFileSync(safePath(root, file.path))) !== file.sha256) throw new GtmError('CREATIVE_IMMUTABLE', 'Previously rendered video file changed');
    }
    if (!options.rebuild) return stored;
  }
  const files: ReturnType<typeof immutableFile>[] = [];
  const sceneReceipts = [];
  for (const [index, scene] of board.scenes.entries()) {
    const template: Template = { id: scene.id, tenant: board.tenant, revision: 'phase-d-r1', variant: 'decision',
      label: 'SYNTHETIC DEMO / PLACEHOLDER', eyebrow: board.tenant === 'retropick' ? 'RETROPICK CONCEPT / VERIFY THE FLOW' : 'FOUNDER CONCEPT / DECISION NOTEBOOK',
      title: scene.title, body: scene.body,
      panels: [{ heading: 'Illustrative concept', text: 'Editorial geometry. No actual product UI or personal history.' },
        { heading: 'Review boundary', text: 'Topic proof and owner review remain required.' }],
      footer: scene.caption, alt: `${scene.title} ${scene.body} ${scene.caption} Synthetic concept; placeholder styling.`,
      contentMode: 'ILLUSTRATIVE_NO_PRODUCT_OR_PERSONAL_FACTS' };
    const graphic = await renderGraphic(root, board.tenant, template, graphicSize, 'synthetic');
    const frameName = `scene-${index + 1}.png`;
    files.push(immutableFile(root, `${directory}/${frameName}`, readFileSync(safePath(root, `${graphic.directory}/image.png`))));
    sceneReceipts.push({ sceneId: scene.id, graphicsReceipt: graphic.receipt, qc: graphic.qc });
    const segmentName = `segment-${index + 1}.mp4`; const segment = safePath(root, `${directory}/${segmentName}`);
    // Partial segments are recoverable build intermediates, never committed output receipts.
    if (existsSync(segment)) rmSync(segment);
    mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-i', frameName,
      '-vf', `zoompan=z='1+0.015*on/150':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=150:s=${width}x${height}:fps=30`,
      '-frames:v', '150', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-threads', '2', '-pix_fmt', 'yuv420p',
      '-flags', '+bitexact', '-fflags', '+bitexact', '-map_metadata', '-1', '-y', segmentName], directory);
  }
  const concat = board.scenes.map((_, index) => `file 'segment-${index + 1}.mp4'`).join('\n') + '\n';
  files.push(immutableFile(root, `${directory}/segments.txt`, concat));
  mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-f', 'concat', '-safe', '1',
    '-i', 'segments.txt', '-c', 'copy', '-an', '-map_metadata', '-1', '-movflags', '+faststart', '-fflags', '+bitexact', '-y', 'video.partial.mp4'], directory);
  const partial = safePath(root, `${directory}/video.partial.mp4`), videoPath = safePath(root, `${directory}/video.mp4`);
  if (existsSync(videoPath) && sha256(readFileSync(videoPath)) !== sha256(readFileSync(partial))) throw new GtmError('CREATIVE_IMMUTABLE', 'Recovered encode differs from existing final media');
  renameSync(partial, videoPath);
  files.push(immutableFile(root, `${directory}/video.mp4`, readFileSync(videoPath)));
  const probeResult = probe(root, directory); const spec = validateProbe(probeResult, width, height);
  if (!faststart(readFileSync(videoPath))) throw new GtmError('VIDEO_FASTSTART', 'MP4 metadata is not before media data');
  const srt = board.scenes.map((scene, i) => `${i + 1}\n${time(scene.startSeconds, ',')} --> ${time(scene.startSeconds + 5, ',')}\n${scene.caption}\n`).join('\n');
  const vtt = 'WEBVTT\n\n' + board.scenes.map(scene => `${time(scene.startSeconds, '.')} --> ${time(scene.startSeconds + 5, '.')}\n${scene.caption}\n`).join('\n');
  files.push(immutableFile(root, `${directory}/captions.srt`, srt), immutableFile(root, `${directory}/captions.vtt`, vtt),
    jsonFile(root, `${directory}/timeline.json`, { storyboard: board, aspect, width, height, sceneReceipts,
      encoder: { name: 'libx264', preset: 'ultrafast', crf: 20, fps: 30, zoom: '1+0.015*on/150', audio: 'NONE' } }),
    jsonFile(root, `${directory}/ffprobe.json`, probeResult));
  const frameChecks = [];
  for (const [index, scene] of board.scenes.entries()) {
    const filename = `qc-${index + 1}.png`;
    mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-ss', String(scene.startSeconds + 2.5),
      '-i', 'video.mp4', '-frames:v', '1', '-y', filename], directory);
    const bytes = readFileSync(safePath(root, `${directory}/${filename}`)); const stats = await sharp(bytes).stats();
    const channels = stats.channels.slice(0, 3); const mean = channels.reduce((sum, c) => sum + c.mean, 0) / 3;
    if (mean < 12 || mean > 250 || channels.every(c => c.stdev < 3)) throw new GtmError('VIDEO_FRAME_QC', 'Decoded scene frame appears blank, black or clipped white');
    frameChecks.push({ sceneId: scene.id, atSeconds: scene.startSeconds + 2.5, averageChannelLevel: mean,
      channelDeviation: channels.map(c => c.stdev), label: 'DECODED_SCENE_FRAME_OWNER_REVIEW_REQUIRED' });
    files.push(immutableFile(root, `${directory}/${filename}`, bytes));
    if (index === 0) files.push(immutableFile(root, `${directory}/poster.png`, bytes));
  }
  const black = mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'info', '-protocol_whitelist', 'file,pipe', '-i', 'video.mp4',
    '-vf', 'blackdetect=d=0.2:pix_th=0.10', '-an', '-f', 'null', '-'], directory);
  if (/black_start:/.test(black.stderr)) throw new GtmError('VIDEO_BLACKOUT', 'Black interval detected in generated video');
  const motionPixels: Buffer[] = [];
  for (const [index, seconds] of [0.5, 4.5].entries()) {
    const filename = `motion-${index + 1}.png`;
    mediaCommand(root, 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-ss', String(seconds), '-i', 'video.mp4', '-frames:v', '1', '-y', filename], directory);
    const bytes = readFileSync(safePath(root, `${directory}/${filename}`));
    files.push(immutableFile(root, `${directory}/${filename}`, bytes));
    motionPixels.push(await sharp(bytes).resize(480).removeAlpha().raw().toBuffer());
  }
  let difference = 0;
  for (let i = 0; i < motionPixels[0]!.length; i++) difference += Math.abs(motionPixels[0]![i]! - motionPixels[1]![i]!);
  const motionMeanPixelDifference = difference / motionPixels[0]!.length;
  if (motionMeanPixelDifference <= 0.01) throw new GtmError('VIDEO_MOTION', 'Decoded first scene has no measurable motion');
  const qc = { status: 'PASS', ...spec, faststart: true, blackIntervalsAtLeastPointTwoSeconds: 0, decodedSceneChecks: frameChecks,
    motionMeanPixelDifference, motionSampleSeconds: [0.5, 4.5],
    captionCues: 4, captionTiming: 'Four five-second cues match timeline and visible scene footer text',
    captionBurnIn: true, automatedSceneGeometry: sceneReceipts.map(r => r.qc), ownerCreativeReview: 'REQUIRED_NOT_APPROVED' };
  files.push(jsonFile(root, `${directory}/qc.json`, qc));
  const manifest = { ...board, kind: 'video', aspect, width, height, directory, files, qc,
    tools: [{ path: '/usr/bin/ffmpeg', sha256: ffmpegHash }, { path: '/usr/bin/ffprobe', sha256: ffprobeHash }],
    license: { font: board.assets.fonts.license, geometry: 'ORIGINAL_LOCAL_ILLUSTRATIVE', music: 'NONE', footage: 'NONE', voice: 'NONE',
      encoder: 'Existing FFmpeg/libx264 toolchain; build/version/license receipt required; no bundled FFmpeg redistribution' } };
  const receipt = jsonFile(root, receiptPath, manifest);
  immutableFile(root, `${directory}/manifest.sha256.txt`, receipt.sha256); return manifest;
}
