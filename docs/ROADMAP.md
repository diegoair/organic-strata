# Organica — Roadmap

> Studio Rann · Development Priorities  
> Last updated: July 24, 2026 — v0.1

---

## Current State — v0.1

### Live & Working
- [x] Organica hub — `theorganicalanguage.vercel.app`
- [x] Strata — sketch → SVG pipeline with Smart+ algorithm
- [x] Genesis — 55 animated organic forms + grid composer
- [x] Genesis Indicators — full form catalog
- [x] Spore — generative stippling from images (`/spore/`) — mark library, zoom/pan preview, PNG + hi-def JPG + SVG export, Send to Figma
- [x] Pollen — advanced stippling from images (`/pollen/`) — variable-radius blue-noise engine, Circle/Polygon/Line points, Adaptive duotone, presets, PNG/JPG/SVG export, Send to Figma
- [x] Living Path — generative font/path modification (`/livingpath/`) — Vector + Raster engines, layer groups + blend modes, 9 raster algorithms, 24 presets, live text specimen, installable OTF export via Web Worker, `.lvp` projects. Manual: `docs/LIVINGPATH.md`
- [x] Halide — photo → true 1-bit dithered portrait (`/halide/`) — Floyd–Steinberg/Atkinson/Bayer/flat threshold, colour-key background removal (Pick/Auto), sticker Outline, Background fill, drag-to-position square crop, PNG/JPG/SVG (opt-in contour-traced "Simplify shapes")/Figma export, 8 presets incl. **Ditherface**. Manual: `docs/HALIDE.md`
- [x] Komorebi — 木漏れ日, real-time WebGL2 dappled sunlight (`/komorebi/`) — light-cookie/gobo canopy (procedural fBm or uploaded silhouette), penumbra/pinhole physics, post-process god rays, Scene + Gobo modes, Sway (seamless WebM loop) / Drift wind, PNG/JPG/WebM/tone-band SVG separation/Figma export, 8 presets. Manual: `docs/KOMOREBI.md`
- [x] Vercel deployment — auto-deploy on push to `main`
- [x] Animation system documentation

### Known Gaps
- [ ] Figma integration — export is manual
- [ ] No print/large-format export pipeline
- [ ] No pattern/tiling engine
- [ ] No typography module
- [ ] No color system tool beyond Genesis palettes
- [ ] No persistent storage — compositions reset on reload

---

## Spore — Post-Launch Backlog

Shipped to production June 5, 2026 (commit `e44c857`). Open follow-ups from the launch:

### Now — QA & verification
- [ ] **Verify SVG ↔ raster parity in Figma** — re-export an SVG from Spore after a real render and re-import into Figma; confirm the new inlined-geometry vector now matches the PNG/JPG raster. *(The fix was reasoned from the Figma "Spore results" artboard — node `91:51639` — not yet validated with a live export.)*
- [ ] **Verify zoom/pan + JPG export in-browser** — confirm wheel-zoom-to-cursor, drag-pan, reset, and the high-def JPG export all behave on a real image in a live browser session.

### Next — polish & correctness
- [ ] **Implement `adaptive` color mode** — currently a stub returning `markColor` unchanged (see comment "simplified — full impl would parse HSL" in `spore/index.html`); add real brightness-driven hue/lightness shift.
- [ ] **Reconcile brushdot transform** — the `brushdot` mark has an element-level `transform="rotate(-25 …)"` that the canvas renderer ignores but the SVG export now applies; align so raster and vector match exactly.

### Docs hygiene
- [x] **Document Spore** — added Spore to the CLAUDE.md tools table and the repo README (June 9, 2026).

---

## Pollen — Post-Launch Backlog

Advanced stippling tool, shipped to production June 2026. The engine is variable-radius
Poisson-disk (blue noise): spacing follows image brightness (dark = dense, bright = sparse).
The preview is downscaled for responsiveness; **export is WYSIWYG** — it serialises the exact
preview points (SVG is resolution-independent, PNG/JPG scale the same points up).

### Done
- [x] Engine (variable-radius Poisson blue-noise), 400% preview
- [x] Symbols from the centralized Genesis library (primordial subset of 8) + Upload SVG;
  bbox-based sizing + stroke-min floor so every form renders
- [x] Sizing: Size + Range, **Scale** (global ×), **Width/Length** (non-uniform stretch)
- [x] Stippling: Gamma, Contrast, Overpaint, Hide Zone, Phases, **Spacing ×** (master)
- [x] Image: Rotation, Flip, Invert
- [x] **Image & Stippling is live** — debounced auto-recompute (300ms) + "Recomputing…" overlay
- [x] Colour: Solid / Adaptive (duotone) / **RMX palette** (Tone/Posterize/Random/Tone+Random)
- [x] **RMX shapes** — remix up to 3 symbols by tone
- [x] Export PNG / JPG / SVG / Figma — WYSIWYG; **Export Scale moved to the top bar**
- [x] Presets (built-ins + user localStorage) — persist colour mode, RMX palette/shapes,
  Stroke params, Light dropout; + **Hatch Flow / Hatch Swirl** built-ins
- [x] **Stroke (Pointillist Line) + field streamlines** — see below
- [x] **Light dropout** — random thinning of the lights (probability ∝ brightness),
  works on all shapes, WYSIWYG, preset-persisted

### Open follow-ups
- [ ] **Aggiornare i preset** — rivedere/riscrivere i preset built-in per le nuove feature
  (RMX shapes/colours, Scale, Width/Length, Spacing ×, Stroke/dropout) e sync
  dell'etichetta del dropdown dopo Apply. *(extends "Complete presets"; Hatch presets già aggiunti)*
- [x] **Stippling effect "come da foto" — flow-field / gradient-oriented strokes**
  (rif: app *Pointillist*). DONE:
  - **Angle = Flow (follow image)** — orienta ogni marchio sull'isophote (gradiente +90°).
  - **Simbolo procedurale "Stroke"** = **linea a spessore costante** (Size = spessore,
    **Length** px, Segments, Warping, **Rounded**, **Style — / ✳**).
  - **Field streamline** — la linea integra il campo d'angolo dell'immagine
    segmento-per-segmento (avanti+indietro dal punto), curvando *attraverso* i toni:
    uncini (Angle Range) o piumaggio (Flow) anche con Warping 0. Warping = jitter "di mano".
  - Preview 400% = mini-stipple reale su blob sintetico (predice il render). WYSIWYG.
  - *Follow-up opzionale:* porting Flow + Stroke + dropout in Spore.
- [ ] **Hatching engine (proper)** — a *new* technique alongside Stippling, not a stroke
  shape. The current Stroke streamline only *approximates* it (one line per blue-noise
  point); true hatching uses a different placement philosophy. Discussed & parked
  (June 12, 2026). Four pillars:
  1. **Layered accumulation** — multiple hatching passes; darks build up by overlapping
     layers (pass 1 everywhere, pass 2 on mids, pass 3 on shadows…), not one mark/point.
  2. **Cross-hatch** — a second set crossed at ~60–90° in the darkest zones.
  3. **Smoothed flow field** (structure tensor) — coherent flow, not the noisy per-pixel
     gradient used by the current Flow.
  4. **Humanizer** — real wobble/tremor, variable pressure (line weight), imperfection,
     overshoot; per-stroke deterministic → WYSIWYG.
  Architecture decision pending: inside Pollen as **Technique: Stippling | Hatching**
  (reuses tone pipeline / colour / RMX / presets / export) vs. a separate `/hatch/` tool.
- [ ] **Higher detail ceiling** — preview point cap (~70k) bounds export richness; raise the
  cap and/or move point placement to a **Web Worker** to stay fluid on large images.
- [ ] **Animated stippling for video** (point 6) — animate the stored points (Reveal /
  Breathe / Drift / Twinkle / Rotate) for visualisation + WebM/GIF export.
- [ ] **RMX in Spore shapes** — Spore has RMX colours; add RMX shapes too for parity.
- [ ] **Optional** — more built-in presets; Gamma/Contrast on the 400% preview readout.

---

## Genesis Creator + Library — Backlog

New pages shipped alongside the composer: **`/genesis/library.html`** (Figma-like form
catalog, set/grid config, Pollen theme) and **`/genesis/creator.html`** (from-scratch SVG
form builder — Draw / Import / Generate, parametric controls, no animation, output to
Library via `localStorage organica_library`).

### To verify / fix
- [ ] **Creator — Bézier tangent handles** (yellow/pollen handles on each anchor): the
  rendering/visibility was fixed (was gray-on-black, now pollen-yellow), **but the
  drag/edit behaviour is still to be verified and likely modified** — confirm tangent
  drag, smooth-node mirroring, and double-click→auto (Catmull-Rom) all behave on a real
  edit session. *(da modificare)*
- [ ] **Library — delete form / delete set** — gap, not built yet.
- [ ] **Creator — edit existing user form** — open Creator pre-loaded with an existing
  form's data (currently only creates new).

---

## Living Path — Backlog

**`/livingpath/`** — web JS port of [ivangrozny/LivingPath](https://github.com/ivangrozny/LivingPath)
(a Python desktop tool that applies algorithmic effects to font glyphs). Our port is a
single-file vanilla HTML/CSS/JS tool: input a **font (OTF/TTF)** *or* an **SVG** (upload or
Genesis form), apply a stack of organic effects, export SVG/PNG.

### Done
- [x] **Vector engine** — Bézier-node effects (jitter/wobble/inflate/roughen/smooth/
  twist/scatter), layer stack, presets, font/SVG/Genesis input, SVG/PNG export.
- [x] **Drop anywhere** — window-level file routing + WOFF2 guard + real parse errors.
- [x] **Raster engine (the real LivingPath)** — Technique toggle **Vector | Raster**.
  Pipeline: rasterise glyph → pixel algorithms (**dilate/erode · blur · threshold ·
  noise · reaction-diffusion**) → **re-vectorise** (marching squares + segment stitch)
  → Laplacian-smoothed contours → SVG. Gives the "glyph hydrography" flood/melt look
  (strokes merge, edges bulge). Raster presets (Avulsion/Flood/Bulbs/Grain/Coral),
  **Outline mode**, debounced recompute.

- [x] **Raster — particles** (disks accreting on the form → bubbly nodules) and
  **center-line / skeleton** (Zhang–Suen thinning → constant-width stream stroke).
  Presets **Bubbles** and **Stream**.
- [x] **Reaction-diffusion masked to the glyph** — keeps the letter solid/readable
  and carves cellular holes instead of dissolving to floating dots.

### Next
- [ ] **Higher-res raster** — RES is 170 for live speed; raise it (or move to a Web
  Worker) for crisper re-vectorisation, especially on words.
- [ ] **Reaction-diffusion — stronger coral regime** — current masked output is subtle
  (texture mostly at edges); expose a "hole depth" / longer-run option for deeper cells.
- [x] **Font export (OTF)** — "Export modified font" runs the whole alphabet through
  the active stack **in each glyph's own em space** (advance widths, unitsPerEm,
  ascender/descender preserved), re-vectorises, and rebuilds an installable OTF with
  opentype.js (family renamed "LivingPath …"). Works for both Vector and Raster;
  counters/holes preserved (verified by round-trip re-parse). Vector caps at 320
  glyphs, raster at 180 (raster ~1–25 ms/glyph; reaction-diffusion much slower).
- [x] **Layer GROUPS + blend modes** — the original's compositing model. Each group
  processes the glyph, groups blend (union/multiply/subtract/xor/add/screen). Unlocks
  layered looks (the "Frog-eggs" 2-group preset = body − sparse bubbles). Shared by
  preview and font export.
- [x] **Live text specimen** — a paragraph rendered with the modified font, updating
  live (per-glyph pipeline, cached), for both engines.
- [x] **Export pro** — custom font name, charset selection (A–Z / a–z / 0–9 / punct /
  accents), optional HTML specimen (base64 @font-face), and **save/load project (.lvp)**.
- [ ] **Genesis integration** — pull a form straight from the Library into Living Path.
- [ ] **Font export — full charset + worker** — raise the glyph cap and move the heavy
  raster export off the main thread (Web Worker) so big fonts / heavy presets don't
  block the UI.
- [x] **Full original algorithm set** — dilate/erode, blur, threshold, noise, particles,
  center-line (skeleton), **polygonize** (facet), **seam-carving** (content-aware slice),
  reaction-diffusion. (cahn-hilliard ≈ reaction-diffusion; pixel/quality-loss ≈
  polygonize/noise.) 24 raster presets mapped to the production example sheets.
- [x] **Multi-language specimen text** — language selector (10 languages, Latin +
  Greek/Cyrillic) with curated offline samples, plus **↻ text** pulling a live random
  Wikipedia extract (CORS REST) with sample fallback. Specimen now word-wraps.

---

## Halide — Backlog

**`/halide/`** — photo → true 1-bit dithered portrait, prototyped July 23, 2026 after
evaluating ditherface.com (a manual commission service, not a tool) as a reference look.
Single-file vanilla HTML/CSS/JS, no dependencies. First full arc closed July 24, 2026 —
validated against a real test photo (`halide/test-photos/`, kept out of git). Manual:
`docs/HALIDE.md`.

### Done
- [x] **Real dithering** — Floyd–Steinberg + Atkinson error diffusion, recursive-Bayer
  ordered dithering, flat-threshold baseline. Serpentine scan, Resolution (grid width).
- [x] **Tone pipeline** — Rotation/Flip/Invert, Gamma/Contrast/Bias.
- [x] **Interactive crop positioning** — drag a square frame over the un-cropped source
  image, Enter/Esc to confirm/cancel. Replaced the original Crop X/Y sliders entirely.
- [x] **Background removal** — colour-key (global threshold, not connected flood-fill —
  the latter let lighting gradients bleed into the subject), **Pick…**/Auto reference.
- [x] **Sticker Outline** — largest-connected-component + enclosed-hole-fill for
  silhouette clean-up (handles wispy rim-lit hair), diagonal-corner-touch bridging so
  the ring always renders as one solid band.
- [x] **Background fill** — colours everything outside the outline (pure subtraction),
  independent of Paper; Paper/Transparent still govern the kept subject's own cells.
- [x] **True colour swap** — Swap Colors only trades Ink/Paper hex values now (verified
  byte-identical shapes before/after); does not silently recompute which cells are ink.
- [x] **Presets** — 8 built-ins incl. **Ditherface** (the validated reference-matching
  combo: Atkinson + square + background-removed + Outline + Background fill), fully
  deterministic on apply; custom presets via `localStorage`.
- [x] **Export** — PNG/JPG/SVG/Figma; **Simplify shapes** (SVG-only, opt-in) traces each
  region into one rectilinear `<path>` instead of tiling it with `<rect>`s — verified
  pixel-exact, ~36% smaller files, 4,789 rects → 4 paths on the reference photo.

### Evaluated and declined
- **Genesis organic-form marks instead of square pixels** — would duplicate Pollen
  (which already places Genesis forms by tone-driven density), and would undo the
  Simplify-shapes win (organic marks don't merge like rectilinear cells; SVG export
  would go back to one shape per cell, and live preview would get slower).

### Open follow-ups
- [ ] **Autonomous pixel animation** — noise/time-driven motion (no user input), fits
  the existing Motion vocabulary (Genesis's "Collective Behaviour" — staggered
  `animation-delay` + goo filter); could ship as an animated SVG export. Discussed,
  not yet built.
- [ ] **Hover-reactive pixel animation** — needs real JS reading cursor position; can't
  be a static export file (PNG/SVG). Would need a separate interactive page/demo, a
  different deliverable from what Halide produces today. Discussed, not yet built.
- [ ] **Mark-shape style beyond squares** — if an organic-dithering hybrid look is
  wanted later, scope it as an *additional* mark style (small Genesis primitive
  filling the cell 1:1, no overlap with neighbours), not a replacement — accepting
  that Simplify wouldn't apply to that mode.

---

## Komorebi — Backlog

**`/komorebi/`** — 木漏れ日, dappled sunlight filtering through a canopy, rendered live on
the GPU. First WebGL2 tool in Organica (a browser API, not a framework — a Canvas2D radial
blur would be ~9M ops/frame). Shipped July 25, 2026. Manual: `docs/KOMOREBI.md`.

### Done
- [x] **Light cookie / gobo** — canopy mask projected onto a ground plane in perspective.
  Procedural: two fBm layers combined with `max()` (gaps only where both open) + a second
  layer at a settable frequency ratio. Or an **uploaded silhouette** (drag-drop / Open) —
  a Halide 1-bit export, a Strata trace, or a photo becomes the canopy.
- [x] **Penumbra + pinhole physics** — sun subtends ~0.53°, so a gap at height h blurs by
  ≈ h/108; below that it becomes a pinhole and projects a disc of the sun. One "Height"
  control = a disc-kernel sample radius (golden-angle taps + per-sample rotation) over the
  cookie; small gaps wash into round coins of light for free.
- [x] **God rays** — post-process radial blur (Mitchell, GPU Gems 3 ch.13) of a half-res
  occlusion buffer. No shadow map / 3D scene — occluder is the same 2D canopy, shared GLSL
  so occlusion and dapple can't diverge. Density/Weight/Decay/Exposure + on/off.
- [x] **Scene + Gobo modes** — Scene: horizon, receding canopy ceiling, rays, dappled
  floor. Gobo: orthographic flat fill = the tileable pattern (feeds Phase 4).
- [x] **Wind Sway / Drift** — Sway is a single phase angle → exactly periodic field →
  **seamless WebM loop** (record one Loop period). Drift travels, no loop.
- [x] **Sun drag** — drag on canvas moves the sun; rays and light pools both read it.
- [x] **Export** — PNG/JPG (`toDataURL`, sync — WYSIWYG at any Export Scale), **WebM**
  recording (`captureStream` on the live canvas), and a posterised **tone-band SVG
  separation** (N flat luminance bands, one path/band, stacked "≥ level" so no seams —
  Halide's rectilinear tracer verbatim) + Figma push.
- [x] **8 presets** — Forest Floor / High Noon / Cathedral / Shoji / Undergrowth / Riso
  Two-Tone / Dusk Ember / Bamboo, each a full deterministic state; custom via localStorage.

### Open follow-ups
- [ ] **Structure-tensor flow for wind** — current domain warp is per-pixel fBm; a smoothed
  flow field would give coherent branch-sway rather than shimmer (mirrors the Pollen
  hatching-flow note).
- [ ] **Timeline / sun path** — animate the sun along an arc (dawn→dusk) with colour-temp
  keyframes, for the installation loop; currently sun is static per frame.
- [ ] **GIF export** — WebM covers video; a quantised GIF (as discussed for Pollen/Halide
  animation) would round out the social/web deliverables.
- [ ] **Multi-plate riso export** — the SVG is already a band separation; emit one SVG file
  *per* band (named plates) for a true print hand-off, not just one layered file.
- [ ] **Genesis canopy** — feed a Genesis form / composed grid directly as the cookie,
  closing the loop with the form library the same way the image upload already does.

---

## Phase 2 — Genesis Depth

Deepen the Genesis composer into a real production tool.

- [ ] **Export compositions** — download as SVG, PNG, or animated GIF
- [ ] **Save/load** — persist compositions to localStorage or file
- [ ] **More forms** — extend library beyond 55 (forms 56+)
- [ ] **Form scale** — allow forms to break outside their grid cell
- [ ] **Rotation** — per-form rotation control in composer
- [ ] **Opacity** — per-form opacity control
- [ ] **Drop mark forms** — new forms derived from the drop marking gesture specifically

---

## Phase 3 — Figma Integration

Direct push from Organica tools into Figma.

- [ ] **Genesis → Figma** — place composed grid directly into a Figma file as components
- [ ] **Strata → Figma** — push traced SVGs directly (current: manual download + import)
- [ ] **Component library** — Organica forms as a Figma component library
- [ ] **Variable system** — color and scale tokens synced between Organica and Figma

---

## Phase 4 — Pattern Engine

Systematic tiling and repetition — a core module of Flexible Visual Systems.

- [ ] **Tile from form** — take any Genesis form, generate a repeating pattern
- [ ] **Grid variants** — square, hexagonal, brick, random scatter
- [ ] **Density control** — sparse to dense
- [ ] **Export** — pattern as SVG tile, CSS `background`, or high-res PNG

---

## Phase 5 — Strata AI

Make the shape grammar extraction smarter.

- [ ] **Auto-element detection** — identify discrete forms in a sketch automatically
- [ ] **Form matching** — match extracted shapes to Genesis library forms
- [ ] **Style consistency** — ensure extracted forms follow Organica grammar rules
- [ ] **Batch processing** — multiple images → unified form library

---

## Phase 6 — Output Pipeline

Production-ready exports for every medium.

- [ ] **Print** — high-res PDF, CMYK-ready
- [ ] **Mural schema** — tiled large-format output with registration marks
- [ ] **Web** — animated SVG bundles, CSS animation exports
- [ ] **Installation** — generative loop output (canvas/WebGL)
- [ ] **Social** — sized presets (Instagram, poster formats)

---

## Open Questions

These need decisions before building:

1. **Typography module** — what role does type play in Organica? System font or custom?
2. **Color system** — beyond the 3 Genesis palettes, how are colors managed across outputs?
3. **Client workflow** — when Organica is used for client branding, what does the handoff look like?
4. **Mural scale** — what's the largest output format needed? What DPI/size?

---

*Studio Rann · Organica System v0.1 · July 24, 2026*
