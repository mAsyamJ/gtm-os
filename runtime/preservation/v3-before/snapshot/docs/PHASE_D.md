# Phase D: local creative studio

Revision phase-d-r1. Audience: owner and local implementers. Inputs: master/phased contracts, creative governance, each selected tenant's voice/design/positioning/claims/tokens, six editable template sources, licensed local font files and pinned render dependencies. Outputs are SYNTHETIC DEMO / PLACEHOLDER and NOT APPROVED. No product capability, founder achievement, official brand identity or public permission is inferred.

The [sample gallery](PHASE_D_GALLERY.md) links to actual local PNG/SVG/JSON sources, two RetroPick MP4 exports, posters, captions and timelines. `docs/evidence/phase-d-media.json` indexes every render and browser check. Generated binaries remain in ignored `runtime/creative/`; editable JSON templates, renderer code, font files/notices, dependency locks and receipts are tracked. Rebuild missing binaries with `pnpm build && node scripts/generate_phase_d_samples.mjs`.

## Working commands

```bash
./gtm design templates --brand retropick
./gtm design render --brand retropick --template feature-hero --fixture synthetic --size landscape
./gtm design render --brand founder --template decision-note --fixture synthetic --size portrait
./gtm video storyboard --brand retropick --fixture synthetic
./gtm video render --brand retropick --fixture synthetic --size landscape
./gtm video render --brand retropick --fixture synthetic --size portrait
```

All support `--json`. Every creative operation requires the selected tenant. Rendering also requires explicit `--fixture synthetic`; production mode remains unavailable. Graphics sizes are landscape 1200×675, wide 1600×900, square 1080×1080 and portrait 1080×1920. Video outputs are landscape 1920×1080 or portrait 1080×1920. Sizes are tested export contracts, not claims about current platform upload limits or timeless safe zones.

RetroPick templates: feature-hero, mechanism-notes, evidence-checklist. Founder templates: decision-note, reliability-check, learning-map. The names map to separate tenant JSON sources under `creative/templates/<tenant>/`; cross-tenant names or edited tenant fields are rejected. Layouts are neutral placeholder designs: dark evidence-oriented RetroPick concepts and light first-person technical founder concepts. Official palettes/fonts remain unverified. The explicit synthetic label is part of each schema, SVG/raster and video scene.

## Render and trust boundaries

Satori 0.62.0 converts an internally built, pure layout tree to SVG with embedded font outlines. Sharp 0.35.5 exports PNG and lossless WebP. No arbitrary JSX, executable markup, remote image, font callback, HTML source or model provider is accepted. Text templates are bounded, screened and restricted to illustrative content; unsupported percentage/guarantee copy and external URLs are rejected. This is a defensive local demo surface, not independent semantic fact verification. Topic-specific public copy still needs evidence and owner review.

`source.json` preserves editable text/style/tree and font references; `source.svg` preserves vector geometry. Each output manifest records template hash, tenant, audience, governance input hashes, renderer/native versions, sources/licenses, approval, limits, file digests, dimensions, alt text and QC. Pipeline source files and dependency lock are hashed into inputs. Host/platform/native versions scope reproducibility. Outputs are hash-addressed and immutable; conflicting existing bytes fail rather than silently overwrite. Fonts and their complete notices must match reviewed local hashes. Missing tools fail BLOCKED; invalid assets fail validation.

The local video adapter implements storyboard, editable timeline generation, render, captions, thumbnail, probe, visual QA and license audit. Its real-product `capture` method reports BLOCKED: no source/UI/redaction scope has been verified. These actual local creative methods are separate from the earlier provider/mock interface, whose execute method still denies external actions. The workflow engine still emits SYNTHETIC JSON contract fixtures; complete campaign artifact wiring is Phase F.

Video uses four five-second source scenes, a gentle centered zoom and explicit hard cuts. Fixed FFmpeg argv, absolute `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`, local-only protocol lists, workspace paths, process timeouts and no shell restrict the process boundary. There is no free-form CLI filter/command or URL input. Output is a 20-second, 600-frame H.264 yuv420p MP4 at 30 fps with faststart. Captions are visible scene footer text plus synchronized SRT/VTT. Source scene SVG/JSON/PNG references, encoding recipe and timing remain in the editable timeline. A decoded poster and per-scene QC frames are retained.

Audio is intentionally absent: no music, SFX, narration, voice model or likeness is used. QC records audio peak as NOT_APPLICABLE and silence as intentional, rather than treating silence as a successful audio mix. No fake UI, charts, market activity or product footage is shown. The demo promotes a concept for evidence-led explanation; it is not proof of a live product flow.

## Assets and tools

DejaVu Sans regular/bold are unmodified fallback fonts copied from the existing system distribution. The complete relevant Bitstream Vera notice is preserved, with DejaVu changes identified as public domain. Its use/copy permission and naming/notice conditions are recorded in `creative/assets/fonts/manifest.json`; this does not verify official brand typography. No other external media or artwork is used. Original local geometry/text remains an owner-review demo, not approved production marketing.

Satori is MPL-2.0, Sharp and playwright-core 1.64.1 are Apache-2.0. Full direct tool notices are preserved under `creative/assets/licenses/`. The installed native libvips package reports **LGPL-3.0-or-later**; it is not classified as Sharp's Apache license. The existing FFmpeg 6.1.1 build enables libx264/GPL and reports GPL-2.0-or-later. Exact tool outputs, native/WASM/module hashes and installed dependency license metadata are in the D receipts. No FFmpeg/Chrome system binary is redistributed, no dependency install script ran, and no global configuration was changed. These notices do not constitute a complete transitive legal/patent audit or publication approval.

FFmpeg was selected directly; video-shotcraft/Remotion and bundled assets are not installed or used, so no commercial eligibility is assumed. Existing Chrome is used only for offline QC in a fresh workspace profile, with requests aborted and no existing account/session loaded. Real product capture and production branding can be added only after their evidence/permission scope is established.

## Validation and reproducibility

`python3 scripts/verify_phase_d.py` runs type/build/runtime tests, Python governance checks, installed dependency/native inventory, tool/license probes, actual rendering, a fresh video re-encode, compiled CLI checks and scoped security scans. It preserves A/B/C receipts and writes a separate hash-bound D source manifest/receipt.

All six templates render at all four sizes: 24 PNGs, 24 WebPs, 24 SVGs and editable sources. Satori layout measurements reject outside-canvas content; all four text/background combinations must reach 4.5:1 contrast. Explicit border-box sizing handles Satori's content-box default. Fresh offline Chrome measures SVG primitives/viewport overflow and compares screenshot pixels against Sharp output with a small antialiasing tolerance. Both videos pass ffprobe dimensions/codec/pixel format/frame count/duration, MP4 atom-order faststart checks, full-stream black-interval detection, decoded scene checks, synchronized caption timing and measured decoded first-scene motion.

The verifier repeats exports and forces a new video encode, checking identical manifest/file hashes under the recorded toolchain. Cached video reuse verifies the manifest checksum and every final artifact digest; altered files fail. Rendering on another architecture/native/browser/encoder version may differ; the manifests identify those dependencies rather than promise cross-platform byte equality. Exact source/template/code edits produce new output directories.

Automated geometry/pixel/codec checks and agent visual inspection do not replace owner editorial/creative review. No account auth, posting, scheduling, paid API, deployment, push or merge occurred. Publication stays disabled; E/F remain separate phases.
