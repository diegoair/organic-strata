# CLAUDE.md — Organica Project Memory

> This file is read by Claude at the start of every session.  
> It contains all the context needed to work on this project without re-explaining.  
> Keep it updated as the project evolves.

---

## Who

**Diego** — solo designer/artist, Studio Rann.  
This is his primary creative and production tool. Not a side project.

---

## What

**Organica** is two things simultaneously:
1. Studio Rann's visual language system
2. The AI-powered toolset to develop, generate, and deploy that language

The visual language is built on three references tuned together:
- **Biomimicry** — perfect organic geometries (nautilus, phyllotaxis, cellular growth)
- **Raw organic nature** — imperfect, living forms (drop marks, erosion, growth patterns)
- **Street art language** — bold marks, scale, presence, immediacy — the calibration mechanism that makes the other two feel grounded, not academic

The fundamental gesture is the **drop mark**: pigment dropped onto a surface, governed by gravity, viscosity, surface tension. Not drawn — allowed to happen. Two atoms: **drop + brushstroke**. Everything else derives from these.

---

## The Methodology

Based on **"Flexible Visual Systems"** by Martin Lorenz.  
Core principle: a visual system is a **grammar** — rules that generate infinite variations while remaining coherent.

Modules in Organica:
- **Form** — drop marks, brushstrokes, traced hand-drawn shapes
- **Pattern** — tiling/repetition (manual now, automated in roadmap)
- **Grid** — Genesis composer N×N cells
- **Color** — 3 base palettes (sky & sun / earth / deep sea), expandable
- **Typography** — undefined, TBD
- **Motion** — 55 organic CSS animations (Genesis library)
- **Scale** — vector-first, screen to mural

---

## The Tools (Live)

| Tool | URL | What it does |
|---|---|---|
| **Hub** | `theorganicalanguage.vercel.app` | Entry point, links to all tools |
| **Genesis** | `theorganicalanguage.vercel.app/genesis/` | Unified seed-authoring + library tool (merged from 3 pages, Aug 27, 2026): Library (browse/inspect 56 built-in + saved seeds), Compose (drag-select-and-fill grid composer), Draw / Import / Generate (shape authoring — Paper.js draw, SVG import, parametric generators) |
| **Indicators** | `theorganicalanguage.vercel.app/genesis/indicators.html` | Full catalog of all 55 forms |
| **Spore** | `theorganicalanguage.vercel.app/spore/` | Generative stippling from images — SVG mark library, zoom/pan, PNG/JPG/SVG export, Figma |
| **Pollen** | `theorganicalanguage.vercel.app/pollen/` | Advanced stippling — blue-noise engine, Circle/Polygon/Line points, Adaptive duotone, presets, PNG/JPG/SVG export, Figma |
| **Living Path** | `theorganicalanguage.vercel.app/livingpath/` | Generative font/path modification (web port of ivangrozny/LivingPath). Vector + Raster engines, layer groups + blend modes, 9 raster algorithms, 24 presets, live text specimen, installable OTF export (Web Worker), .lvp projects |
| **Halide** | `theorganicalanguage.vercel.app/halide/` | Photo → true 1-bit dithered portrait. Floyd–Steinberg / Atkinson / Bayer ordered / flat threshold; background removal (colour-key, Pick/Auto), sticker Outline, Background fill, interactive drag-to-position square crop; PNG/JPG/vector SVG (optional contour-traced "Simplify shapes")/Figma export. Manual: `docs/HALIDE.md` |
| **Komorebi** | `theorganicalanguage.vercel.app/komorebi/` | 木漏れ日 — dappled sunlight through a canopy, real-time on the GPU (WebGL2). Light-cookie/gobo canopy (procedural fBm or uploaded silhouette) projected in perspective; **penumbra/pinhole** physics (small gaps → round coins of light); post-process **god rays** (radial-blur occlusion buffer); Scene + Gobo (tileable pattern) modes; periodic wind → **seamless WebM loop**; PNG/JPG/WebM + posterised tone-band **SVG separation** (Halide's tracer)/Figma. Manual: `docs/KOMOREBI.md` |
| **Camo Turing** | `theorganicalanguage.vercel.app/camo-turing/` | GPU (WebGL2/Three.js) Gray-Scott reaction-diffusion — successor to Camouflage's Disruptive mode, removed from the repo. Live f/k sliders, drop-mark seeding, **Layers** (stack independent sims, blended in field space — Normal/Diff/Multiply/Screen/Add/Darken/Exclusion — with per-layer preset + colour), Paper background image/stencil (embeds real SVG on export), **anisotropic diffusion** (real parallel stripes — nearest-neighbour taps, not bilinear) with verified animal/plant presets (Leopard/Cheetah/Tiger/Zebra/Watermelon rind). PNG/JPG/SVG/Figma. Manual: `docs/CAMO-TURING.md` |
| **Warping** | `theorganicalanguage.vercel.app/warping/` | Domain-warped value-noise / Worley pattern generator — covers the pattern family Gray-Scott can't honestly produce: **Wood grain** and **Marble veining** (fbm turbulence), **Cellular network** (Worley F1/F2, e.g. giraffe-style reticulation), **Level curves** (topographic contours). **Warp** (the tool's namesake) bends the sampled coordinates with a low-frequency noise field before any pattern runs, independent of the pattern itself. Canvas2D/JS, same reasoning as Komorebi's own move off WebGL. PNG/JPG/SVG (posterised tone-band separation, same tracer as Komorebi/Halide)/Figma. Manual: `docs/WARPING.md` |
| **Loom** | `theorganicalanguage.vercel.app/loom/` | Universal Grid Generator — a constraint-driven layout-grid engine, not a column generator. Canvas Manager → Grid Definition Engine → Constraint Engine (**Kiwi solver** for equal-by-default/overridable sizing, **direct parametric math** for continuous-function generators — chosen per generator, not globally) → Universal JSON Model → renderers (live HTML/CSS Grid, SVG, PNG, Figma via the existing shared plugin). **Phase 1 MVP**: two generators, **Bento** (Kiwi, seeded cell-merge spans) and **Sinusoidal** (parametric, sine-modulated track sizes). First Organica tool built as native ES modules rather than single-file. Manual: `docs/LOOM.md` |
| **Soul** | `theorganicalanguage.vercel.app/soul/` | The animation engine — pattern + stagger applied to primitives parsed from ANY Organica tool's own SVG export (no per-tool adapter, one parser: `shared/organica-motion.js`), instead of Genesis's per-form hand-typed CSS keyframes. Genesis's 6 physics patterns rebuilt parametric on **GSAP** (vendored, free "no charge" license), plus 2 patterns not in Genesis at all — **Organic wobble** (continuous, non-repeating: each primitive samples `simplex3(x,y,t)`'s own real time axis at its own position every frame) and **Morph** (MorphSVGPlugin, circle ↔ noise-perturbed blob — the first pattern that changes a primitive's own shape, not just position/scale). DrawSVG for Growth-by-tracing. Stagger (index/distance/simplex-noise delay) is what gives "Collective behaviour" for free, composed on top of any pattern — not a pattern of its own. Loom is the natural upstream layout source (its cell list is exactly the "many positioned elements" shape a stagger wants). Primitives render as real SVG DOM (not canvas) since GSAP/DrawSVG/MorphSVG need real elements. **Seeds panel** (Genesis/SVG/Text — same tabbed component as Camo Turing's own, no Image tab) feeds sources in: Genesis's 8 curated forms, SVG upload/drop, or typed text converted to real per-glyph vector paths (opentype.js + vendored Manrope, one primitive per LETTER so stagger addresses individual glyphs). Everything canvas-level (Open/Play/Stop/Loop/Export/status) lives in one shared `org-floatbar`, including **video export** (canvas.captureStream + MediaRecorder, MP4/WebM, same technique as Camo Turing's recorder) alongside PNG/SVG. Zoom/pan via the same shared `Organica.createZoomPan` every other tool uses. Manual: `docs/SOUL.md` |
| **Membrane** | `theorganicalanguage.vercel.app/membrane/` | Generative form-growth tool — a point-set (circle/line/point, procedural/image/text-seeded) driven across the canvas by a chosen Movement pattern (float-to-mouse, orbit, figure-8, Follow-path…), leaving an accumulated trail. Canvas panel, Palette (Ink/Background swatches + RMX multi-colour mode), mouse-wheel zoom/pan via the shared `Organica.createZoomPan`, spacebar pause, real vector SVG export (a capped/throttled recording of recent frames — `state.shapeHistory`, the same "record marks as data" approach as Spore/Pollen), PNG, and Video (MediaRecorder). Promoted from `explorations/membrane/`, the template this project's other exploration→production migrations (Vortex) followed. |
| **Vortex** | `theorganicalanguage.vercel.app/vortex/` | A 3D conical helix of independently-drifting line segments, orbited by its own real perspective camera (drag-orbit, Shift-drag-roll, Camera distance as the zoom — deliberately NOT `Organica.createZoomPan`, a 3D scene needs one camera, not two overlapping zoom concepts). Resting → transitioning → running state machine: hovering (or Play) grows the spiral from a single seed line on an ease-in ramp. RMX palette (chip UI, up to 8 colours — raised from Membrane's 5, no shader array-size bound here) doubles as the segments' own ink, no separate Ink swatch. Numeric, reproducible **Seed** drives the per-segment noise/spin/orbit randomness (`p.noiseSeed` + a `mulberry32`-derived offset). Redraws from scratch every frame (no accumulation), so PNG export is a genuine re-render at scale (not an upsampled bitmap) and SVG export is just the current frame's already depth-sorted segment list — no history/throttle machinery needed. Promoted from `explorations/vortex/`, migrated the same way as Membrane. |
| **FVS** | `theorganicalanguage.vercel.app/fvs/` | Flexible Visual System engine — Figma's own Elements→Components model: an authored **Element** (isosceles triangle, or an Arc with a live Thickness slider 1–100% — one shared `arcGeometry()` generator, not 4 fixed presets — an **uploaded SVG**, or a **Seed picked from Genesis Creator's own shared library** via `Organica.loadLoomGrid`'s sibling read of `organica.library.forms`, first drawable shape, bbox-fit) gets a transformed copy placed into every cell of a grid — Square 2×2/3×3/4×4, or an **imported Loom grid** (`Organica.loadLoomGrid`, rect or polygon cellShape, any cell count; the 7 four-cell-only symmetry rules grey out automatically outside a 4-cell grid, Random/Exhaustive fall back to an honest per-cell-independent draw). Elements are real SVG path `d` strings (not polygon point-lists, needed for the arcs' curves) — `ELEMENT_TYPES[type].geometry(params) → {d, normTx, normTy, normScale}`, rendered via `<path>` (SVG) / `ctx.fill(new Path2D(d))` (Canvas2D). Colour lives in a centralised **Palette** — Ink (RMX chip UI, 1–8 colours, `colorAt(i)` cycling by cell index) + **Paper** (background swatch, wired into the gallery, PNG, and SVG export alike). Full transform vocabulary — Rotation (0/90/180/270°), Flip (none/H/V/both), Scale (Small/Medium/Large %, editable) — feeds **8 named symmetry rules** (Identity, Pinwheel, Mirror/Kaleidoscope, Diagonal mirror, Checkerboard, Row mirror, Column mirror, Radial — Radial uses the grid's true rotational cell order, `TL,TR,BR,BL`, not Pinwheel's row-major order, which is what lets 4 arcs tile into a real full circle) plus a **Manual** 2×2 mini-editor. **Random seeded** and **Exhaustive** draw from a `FAMILIES` registry of the same named rules rather than choosing 4 cells independently, gated by which axes are active — every generated result is still a real symmetry; Exhaustive stays hard-capped at 512, refusing cleanly with the exact count above cap. One item-descriptor array (`cx,cy,rotation,flipH,flipV,scale,color`) feeds both the Canvas2D PNG export and the SVG string, same discipline as Vortex's own `render.js`/`svgexport.js`. An always-visible **Element preview strip** shows the current Element at 0/90/180/270° + each flip before generating a full grid of it, and a local **Component Library** (`Organica.presetStore`) saves/reloads full self-contained snapshots (Element incl. an upload's own geometry, Grid, Palette, exact cells) for reuse — Figma export deliberately not wired in yet, since the shared `Organica.sendToFigma` channel is still broken product-wide (see Loom's own August 14 session note). Symbols/Pattern-tiling/Applications tiers (the rest of the Figma-component-library reference brief) are later phases. |
| **Colornet** | `theorganicalanguage.vercel.app/colornet/` | Channel-separation + recolour tool, inspired by (not a clone of) the desktop app Coloraster — drop a photo, split it into N luminance-band **channels** (v1 scope; true RGB/CMYK channel split is v2), each independently recolourable (hex + a live CMYK readout), reorderable, blendable (Normal/Multiply), with per-channel **transform** (position/scale/rotation/flip — genuinely new raster-layer math, no prior art elsewhere in the repo). Reuses the shared luminance-band tracer (`Organica.traceContours`/`contoursToPathD`, same technique as Komorebi/Warping's own `buildSVG()`) — confirmed format-agnostic, works identically on an uploaded photo. **WYSIWYG discipline** (same as Spore/Pollen): one `buildPlan()` resolves every channel's transform matrix once, and preview/PNG/JPG/plates/SVG all read that same plan — verified with a byte-exact (0-byte-diff) preview-vs-raster-export test. Promoted `Organica.rgbToCmyk`/`cmykToRgb` out of TuneSutra into `shared/organica-core.js` (TuneSutra's own code comment had flagged them as promotion candidates). PNG/JPG/SVG/per-channel-plate export, `Organica.presetStore` (settings only, never the uploaded image). |
| **Blob Boundary** | `theorganicalanguage.vercel.app/blob-boundary/` | Mask-shape morph (circle/diagonal band/steep band/organic blob/starburst, GSAP MorphSVGPlugin cycling through 3 chosen presets) with a fixed dot lattice classified live every frame against the mask's own current geometry (`SVGGeometryElement.isPointInFill`) — dots deep inside stay small and separate, dots straddling the boundary enlarge and overlap into a gooey fringe with no blur/goo filter, dots outside hide. Migrated from `explorations/blob-boundary/`, Aug 27, 2026 — the third exploration→production migration (after Membrane, Vortex), the first to follow the new `docs/UI-SHELL.md` §6b checklist written specifically because the first two skipped steps. |

---

## Repo Structure

```
organic-strata/          ← GitHub repo name (diegoair/organic-strata)
├── index.html           ← Organica hub (dark, animated noise field)
├── genesis/
│   ├── index.html       ← Genesis — the unified tool (Aug 27, 2026): Library/Compose/Draw/Import/Generate mode tabs, formerly 3 separate pages
│   ├── creator.html     ← thin redirect to /genesis/ (kept so old links resolve — the real Draw/Import/Generate logic lives in index.html now)
│   ├── library.html     ← thin redirect to /genesis/ (same — the real Library-mode logic lives in index.html now)
│   ├── indicators.html  ← 55-form catalog
│   ├── organic-animations.css ← 77 @keyframes + 55 .aNN rules — the REUSABLE half (append-only)
│   ├── organic-page.css      ← :root palette + Genesis catalog page chrome
│   ├── organic-library.css   ← @import shim: page + animations (historic entry point)
│   ├── organic-forms.js      ← SVG markup for 55 forms — PORT AS DATA
│   ├── organic-defs.js       ← Shared SVG defs (goo filters + chips) — INJECT ONCE
│   └── genesis-creator.js    ← RETIRED, loaded by no page — kept on disk as the record of what the old plain-composer's own decorative layer (palettes/backgrounds/per-shape colour/Randomize) was NOT ported into the merge, since it had no equivalent in the library's set/form data model
├── colornet/
│   └── index.html       ← Colornet — channel-separation + recolour tool (luminance bands v1), see Tools table
├── blob-boundary/
│   └── index.html       ← Blob Boundary — mask-morph + edge-scatter tool, migrated from explorations/, see Tools table
├── spore/
│   └── index.html       ← Spore — generative stippling (single-file, vanilla)
├── pollen/
│   └── index.html       ← Pollen — advanced stippling, blue-noise engine (single-file, vanilla)
├── halide/
│   └── index.html       ← Halide — photo → 1-bit dithered portrait (single-file, vanilla)
├── komorebi/
│   └── index.html       ← Komorebi — WebGL2 volumetric light / god rays / dapple (single-file, vanilla)
├── camo-turing/
│   └── index.html       ← Camo Turing — GPU (WebGL2/Three.js) Gray-Scott reaction-diffusion (single-file)
├── warping/
│   └── index.html       ← Warping — domain-warped value-noise / Worley pattern generator (single-file, vanilla, Canvas2D)
├── loom/                 ← Universal Grid Generator — the one tool NOT single-file (native ES modules)
│   ├── index.html       ← shell — canvas preview + panel, loads js/main.js as a module
│   └── js/
│       ├── canvas-manager.js     ← physical space: size/unit/margin/safe area/bleed
│       ├── json-model.js         ← the Universal JSON Model — single source of truth
│       ├── constraint-engine.js  ← Kiwi solver + parametric solver, chosen per generator
│       ├── generators/           ← registry.js + bento.js + sinusoidal.js (Phase 1 of ~26 planned)
│       └── renderers/            ← html-renderer.js (live CSS Grid) + svg-renderer.js + raster-renderer.js
├── soul/                 ← Animation engine — pattern + stagger over primitives from any tool's SVG export
│   └── index.html       ← shell — Source (load SVG) / Primitives (parsed stats) / Motion (pattern+stagger+play) panels
├── membrane/             ← Generative form-growth (point-set + Movement pattern + accumulated trail)
│   ├── index.html
│   └── js/               ← state.js, canvas.js, main.js, color.js, movement.js, svgexport.js, …
├── vortex/               ← 3D conical helix, own perspective camera, resting→transitioning→running
│   ├── index.html
│   └── js/               ← state.js, geometry.js (helix/camera/noise math), palette.js, render.js, canvas.js, svgexport.js, main.js
├── fvs/                  ← Flexible Visual System — Elements→Components grid/rule engine (single-file)
│   └── index.html
├── rhizome/              ← Node-based workflow canvas — chains other tools as pipeline stages (native ES modules, like Loom)
│   ├── index.html        ← shell — canvas/panel/floatbar, loads js/main.js as a module
│   ├── _test-mvp.html    ← the original isolated prototype (2-node drag/wire/connect test) — kept as record
│   └── js/
│       ├── graph-model.js       ← canonical model — nodes[]/edges[], everything else derived
│       ├── execution-engine.js  ← topoSort (Kahn, throws on cycle) + dirty-flag cache + serialized recompute()
│       ├── port-types.js        ← PortType enum + display metadata
│       ├── adapters.js          ← svg→points / grid→points / grid→svg / grid→image, the only auto-conversions
│       ├── node-registry.js     ← id → {meta, compute}
│       ├── nodes/                ← Tier 1 native (loom-grid-generator/geometry, contour-trace, svg-to-points, merge, export) + Tier 2 bridges (genesis/komorebi/warping/soul/camo-turing) + bridge-iframe.js (the generic Tier-2 factory)
│       ├── canvas/               ← pan-zoom.js (wraps Organica.createZoomPan), node-drag.js, wires.js, ports.js
│       └── renderers/            ← node-card.js, inspector-panel.js (populates the shared right panel)
├── shared/              ← Cross-tool system assets
│   ├── organica-tokens.css ← Manrope + type scale + spacing (load FIRST)
│   ├── organica-core.js    ← download, presets, Figma, tracer, zoom/pan
│   ├── organica-noise.js   ← hash2/vnoise/fbm/ridgedFbm/voronoiF1F2/simplex2/simplex3/simplexFbm2/simplexFbm3 — shared by Komorebi, Camo Turing, Warping, Soul
│   ├── organica-motion.js  ← Soul's own contract: parsePrimitives (any SVG → primitive list), PATTERNS, staggerDelay, animate — load AFTER noise
│   ├── gsap.min.js, gsap-morphsvg.min.js, gsap-drawsvg.min.js ← vendored (free "no charge" license, gsap.com/standard-license) — Soul's timing/morph/draw engine
│   ├── kiwi.min.js         ← Cassowary constraint solver (vendored, MIT/BSD-3-Clause) — Loom's Bento generator
│   └── _template.html      ← Start a new tool from this
├── docs/
│   ├── SESSION-LOG.md   ← Full historical session notes (split out of CLAUDE.md Aug 29, 2026) — read on-demand
│   ├── VISION.md        ← Full system vision and methodology
│   ├── ROADMAP.md       ← Development phases and open questions
│   ├── ANIMATION-SYSTEM.md  ← Animation pattern documentation
│   ├── SHARED-LIBRARY.md ← Shared-library contract + storage conventions
│   ├── DESIGN-SYSTEM.md ← Manrope, type scale, tokens, Figma mapping
│   ├── UI-SHELL.md      ← The standard tool layout + behaviour contract
│   ├── KOMOREBI.md      ← Komorebi manual
│   ├── CAMO-TURING.md   ← Camo Turing manual
│   ├── WARPING.md       ← Warping manual
│   ├── LOOM.md          ← Loom (Universal Grid Generator) manual
│   └── SOUL.md          ← Soul (animation engine) manual
├── vercel.json          ← Routing: / → hub, /genesis/ → genesis, per-tool rewrites
├── LICENSE              ← All-rights-reserved proprietary notice (repo is private on GitHub — see Aug 27 session note)
├── THIRD-PARTY-NOTICES.md ← Every vendored library's real license, audited against its own file header
└── CLAUDE.md            ← This file
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework |
| Animations | Pure CSS `@keyframes` — no JS animation libraries |
| SVG processing | Python + OpenCV + vtracer (local backend only) |
| Deployment | Vercel — Studio Rann account (team slug: studiorann) |
| Repository | GitHub — `diegoair/organic-strata` |
| Design integration | Figma (manual now, direct push in roadmap) |

---

## Critical Rules — Never Break These

- **Design tokens — mandatory, every new development.** Never hardcode a font-size, spacing (padding/margin/gap), radius, or UI-chrome colour — use the matching token from `shared/organica-tokens.css` (`--fs-*`, `--space-*`, `--radius-*`, `--ink`/`--paper`/`--panel`/`--mid`/`--border`/`--border-strong`/`--tool`/`--accent-warm`/`--track-bg`). If the value you need doesn't exist on any existing scale, **stop and ask before adding a new token** — don't invent one silently and don't fall back to a raw px/hex "just this once." Live reference with every token and component, rendered from the real CSS: `/design-system/` (linked from the hub). Full narrative + Figma mapping: `docs/DESIGN-SYSTEM.md`. Two real exceptions, not loopholes: (1) a tool's own **content** colour (Halide's ink/paper for the dithered image, Pollen's point colour) is user data, not design-system chrome — don't tokenise it just because it happens to default near `--ink`/`--paper`; (2) a genuine pill/stadium shape (`border-radius` = half the element's height, e.g. a toggle switch) isn't a corner radius — forcing it onto `--radius-sm/md/lg` flattens the capsule. Typography specifically: **Manrope only**, via `--font`, never a second typeface.
- **Shared code** — `shared/organica-core.js` owns download, preset storage + legacy migration, Figma postMessage, colour hex validation, the rectilinear contour tracer and zoom/pan. Don't re-implement these in a tool; if one needs different behaviour, extend the core
- **New tool** — start from `shared/_template.html`, not by copying a neighbour. Contract: `docs/UI-SHELL.md`
- **`organic-animations.css`** — never modify existing rules, only append new ones (the 55 forms depend on the exact timings/selectors). This is the split-out pure half of the old `organic-library.css`; the append-only rule now lives here. Any consumer linking it **must** define `--ink` and `--bg-cell` — see `docs/SHARED-LIBRARY.md`
- **`organic-library.css`** — now an `@import` shim (`organic-page.css` + `organic-animations.css`, in that order — the order is load-bearing for the cascade). Don't put rules back into it
- **localStorage keys** — always `organica.<tool>.<thing>`. When renaming a key, migrate forward and **leave the legacy key in place** (user presets/forms are real work); never delete it in the same release
- **`organic-forms.js` / `organic-defs.js`** — treat as data, port verbatim
- **Color in SVG forms** — always `fill: var(--ink)` / `stroke: var(--ink)`, never hardcode hex
- **Internal links** — always relative (`/genesis/`, `/loom/`), never absolute Vercel URLs
- **New forms** — follow the pattern in ANIMATION-SYSTEM.md, test in indicators.html first

---

## Animation System — Quick Reference

6 patterns, each maps to real physics:

1. **Internal Pressure** — `scale` + asymmetric `cubic-bezier` → breath, heartbeat, lung
2. **Gravity + Viscosity** — `translateY` + `scaleY` → drops, honey, lava
3. **Growth by Tracing** — `stroke-dashoffset` → vine, roots, tree rings
4. **Collective Behaviour** — staggered `animation-delay` + goo filter → swarm, metaballs
5. **Environmental Forces** — continuous `translate`, `linear` easing → wind, tide, sedimentation
6. **Differential Rotation** — counter-spinning layers at different speeds → orbit, shard rotation

Duration range `1.4s–14s` maps to real-world time scales. See `docs/ANIMATION-SYSTEM.md` for full detail.

---

## Output Formats Diego Produces

- Tavole grafiche / composition studies
- Posters (print + digital)
- Web pages (animated SVG)
- Branding systems for clients
- Mural schemas (large format, scale-agnostic vector)
- Art installations (generative animation loops)

---

## Roadmap Priorities (in order)

1. **Phase 2** — Genesis depth: export SVG/PNG/GIF, save/load, more forms, rotation/opacity controls
2. **Phase 3** — Figma direct push: Genesis → Figma (the shared `Organica.sendToFigma` channel is currently broken product-wide — see Loom's own August 14 session note)
3. **Phase 4** — Pattern engine: tiling, grid variants, density control
4. **Phase 5** — (retired — was Strata AI, moot since Strata's removal on August 26, 2026)
5. **Phase 6** — Output pipeline: print PDF, mural schema, installation loop

---

## Open Questions (Decisions Pending)

- Typography module — what role does type play? System font or custom?
- Color system — how are colors managed beyond the 3 Genesis palettes?
- Client workflow — what does the Organica handoff look like for client branding?
- Mural scale — largest format needed? DPI requirements?

---

## Backlog

- **Hub home-page performance** — `index.html` grew to ~1.48MB after the August 27, 2026 bento redesign embedded 4 real tool-export SVGs inline (Camo Turing/Komorebi/Halide/Membrane), the largest being Halide's un-simplified 775KB/16,375-`<rect>` export. Fine as a one-off disclosed tradeoff at the time, but worth a real pass: re-export Halide with "Simplify shapes" on (rect-tile → traced path, the same 4,789→4 win documented in Halide's own July 24 session note), consider lazy-loading/deferring off-screen masonry cells instead of parsing all 27 at once, and audit whether any future added preview should be capped by size before it ships. See the August 27, 2026 (still later same day) session note for the full asset-by-asset breakdown.

- **Cross-browser verification before opening to test users** — every tool has only ever been exercised through this session's own Chromium-based Browser pane; real Safari/Firefox behaviour is unverified. Prioritized by which real API each tool actually depends on (checked in the code, not guessed):
  - 🔴 **Camo Turing** — WebGL2 + Three.js (Safari's WebGL2 support has historically been the most fragile of the three engines); generate a preset, confirm the canvas actually renders.
  - 🔴 **Living Path** — Web Worker-driven OTF export; generate and download a font, Worker path/CORS behaviour differs across browsers.
  - 🔴 **Camo Turing / Membrane** — `MediaRecorder` video export; Safari's MP4/WebM codec support differs meaningfully from Chrome/Firefox — record a short export on each.
  - 🟡 **Rhizome** — iframe-sandbox bridge nodes; connect two nodes, confirm the bridge round-trips a real value.
  - 🟡 **Loom / FVS** — Kiwi.js constraint solver; generate a grid, confirm no console error.
  - 🟢 **All tools** — Manrope variable font + Google Fonts load; a quick visual pass, low real risk.
  For each: open on real Safari and Firefox, exercise the one risky action, check the console (Cmd+Opt+C on Safari, F12 on Firefox) for errors. Not something this session can execute directly — no real Safari/Firefox access from the Chromium-only Browser pane — logged here for Diego to run through himself before wider test-user access.

- **Colornet improvement plan — from watching 4 Stochaster Apps tutorial videos** (Coloraster - Basics; Dotraster - Halftone Modes, Presets, Batch Processing — no transcript available, gathered by stepping through each video's own on-screen UI frame by frame). Confirmed the videos are split across two different Stochaster apps: Coloraster (Basics) and **Dotraster** (Halftone Modes/Presets/Batch Processing — the real analogue of Spore/Pollen, not of Coloraster/Colornet). Ranked by effort:
  - 🟢 **Shuffle + Random Colors buttons** (from Coloraster - Basics) — one-click "randomize channel order" and "randomize all channel colours" next to Colornet's existing channel list. Confirmed genuinely missing: Colornet's own reorder is manual ↑/↓ one at a time, no fast-iteration/happy-accident browsing the way these two buttons give. Cheap, high value — do this first.
  - 🟡 **Channel Swapping gesture** (click a channel's name, click a second to swap) — lower priority, Colornet's ↑/↓ buttons already cover the underlying capability (reordering), this would just be an alternate, faster gesture for it.
  - 🟡 **Batch processing** (Dotraster) — pick/drop multiple images, run the SAME current channel/colour/transform configuration across all of them, export each. **No Organica tool has this today.** A real desktop app uses native folder pickers; the honest web equivalent is `<input type=file multiple>` or multi-file drag-drop, processing sequentially and offering either N individual downloads or a client-side zip (no zip library is currently vendored anywhere in the repo — would need one, or ship without zipping as v1 and add it only if the per-file download flow proves annoying in practice).
  - 🔴 **AM Screening as a genuine Colornet per-channel render mode** (Dotraster's own most complex mode: Dot shape incl. named classic screening functions like "Euclidean", Screen layout, **Angle + Lineature/lpi** per channel). This is the one idea from the videos that's more than a feature-parity catch-up — real 4-colour offset printing avoids moiré by giving each ink plate its own screen angle, and Colornet is *already* a multi-channel tool, so a per-channel Angle/Lineature control would be a direct, on-brand, differentiated capability, not just a copy of Dotraster's own single-channel version. Biggest lift of the four — new rendering math (regular-grid dot-growth functions, not the existing `Organica.traceContours` band-separation path), scope for its own planning pass before building.
  - **Reuse evaluated, as asked**: Dotraster's own "Noise" mode (organic, non-gridded stipple) is close enough to **Pollen's** existing blue-noise variable-radius scatter engine that an eventual "organic halftone" Colornet/Halide mode should study Pollen's own code as the starting point rather than building tone-mapped scatter from scratch — the underlying technique (dot size driven by local darkness) is the same idea Pollen already has proven and shipped. Dotraster's "Pattern" mode (a library of tileable dither textures) is disclosed as **more naturally a Halide extension** than a Colornet one, since Halide already owns "photo → dither" territory in this product — flagged here rather than silently folded into Colornet's own scope.
  - Not yet run through Plan Mode — this is raw analysis from the videos, next step is a proper planning pass (likely per-item, given the AM Screening piece alone is a real architecture decision) before any of it gets built.

---

## Session Notes

*Full historical log (100+ dated entries, June 2026 onward) lives in [`docs/SESSION-LOG.md`](docs/SESSION-LOG.md) — consult it on-demand for context on past decisions. Only the most recent entries are kept inline below. When adding a new note, append it here; periodically migrate older inline entries to the log to keep this section short.*

- **August 28, 2026 (still later same day) — Radial: two presets that were namesakes only, fixed against the live originals; +1 bonus preset.** Diego asked to re-verify `chaos_circles` and `line_based_circles` against Book of Shapes. Both were **name-only** — the preset rendered a different image. `line_based_circles` (real: ~8 concentric circles each *deconstructed* into short disconnected **tangent** dashes, plotter-art look) was shipping as connected jittered 40-gon `<polygon>` rings. `chaos_circles` (real: ~83 large, near-concentric noise-perturbed circle *outlines* piled into a tangle, own noise phase each) was shipping as a jittered lattice of small `<circle>` marks. Two fixes, one pass: **(1)** added a **Line direction: radial | tangent** option to Marks mode (one `+π/2` on the segment angle, in `markSVG` + `drawSceneCanvas`) — a grid of tangent line-marks *is* line-based circles; verified tangent measures 90° to the radius, radial 0°. **(2)** new **`loops` render mode ("Chaos circles")** — draws `Circle count` closed loops, each a 72-pt circle of `Circle radius`, edge wobbled by `Organica.noise.simplex2` with a per-loop phase + random rotation + slight radius spread + gentle centre drift from a dedicated `mulberry32` stream (`seed * 40503`) so they don't nest; params Circle count / Circle radius / Noise. First tuning (`radius 0.5`) read as a cramped wool-ball donut — Diego flagged it; bumped to `radius 0.85 / noise 0.16` for the reference's big-overlapping-circles-with-clean-centre look. Both presets rewritten to the new modes. Diego also liked the *old* Line-Based Circles look, so it's kept as a **"Jittered Rings"** preset (17 total). Group-C audit result: Spiral Dot Field + Halftone Sphere were already faithful; these two were not. Verified: all 17 presets render + WYSIWYG true, loop seed reproducible, 0 unlabeled controls, zero console errors on a fresh tab. `radial/index.html` only. Shipped to production.

- **August 28, 2026 (still later same day) — FVS Symbols: a generative per-cell rule layer, from `bookofshapes.com/patterns/concentric_arc_truchet_3` ("Arc Truchet Butterfly").** Diego: that tool (a Cols×Rows grid, one arc motif per cell, per-cell rotation 0°/90° from a `col + rowShift·row` oscillator) is basically FVS's Symbols model — "in teoria abbiamo tutto" — asked to evaluate integrating it into Symbol definition and to make Symbol authoring "molto più veloce e generativa", so a Loom grid becomes a new editable FVS instance while Components stay fixed. Two Explore agents mapped it: FVS Symbols already imports Loom grids and has full per-cell editing, but authoring is manual-cell-by-cell or a 50/50 random `Generate` — **no rule engine**. Components' own `FAMILIES` rules are all 2×2-only (hand-derived 4-cell literals), not reusable for N×M. **Loom already publishes every saved grid to `localStorage['organica.loom.presets']`** as a `buildModel()` object → directly `Organica.loadLoomGrid`-able; FVS just never read it. Decisions (Diego, via AskUserQuestion): full rule set; support any Loom grid (rect via native `col/row`, regular polygon via centroid binning) + a direct saved-grid picker; rule apply is lock-aware **and** has a hard "Reset & apply to all". **Out of scope, stated**: the concentric-arc "butterfly" Element itself — that's `2 × Arc Count` stacked semicircle paths per cell; FVS renders one path / one fill per cell and reuses one Element per Component, so it needs a new multi-ring `wedgePathD` geometry + cell shape-stacking. The rule layer works with whatever Element/Component is already the cell content. **Shipped in `fvs/index.html`**: `#sel-symbol-fill` gains a **Rule** mode with `#symbol-rule-block`; **`SYMBOL_RULES`** registry (`oscillator`/`checkerboard`/`rows`/`columns`/`radial`/`wave`/`random`), each `{read(), fn(ctx,p,rng) → {rotation?,flipH?,flipV?,scale?}}` — N×M-general, per-cell; **`cellColRow(grid)`** — the genuinely new helper: rect Loom cells read `col/row` from the JSON + `grid.params.cols/rows`; polygon cells bin `resolveGridCells` centres into sorted y→row / x→col bands; always also fills `cx,cy,nx,ny,angle` so Radial/Wave/Random work on any grid; **`applySymbolRule({resetAll})`** mirrors `generateSymbolCells()` — rebuilds only each unlocked cell's transforms from the rule, never touches `source`/content/`fitMode`/anchor/padding; **Vary** checkboxes (Rotation/Flip/Scale) gate which axes the rule writes; a per-cell **`locked`** flag (checkbox in the Cell-properties panel) makes `Apply rule` skip a hand-edited cell, `Reset & apply to all` ignores it; **direct Loom-grid picker** `#sel-symbol-loom-preset` reads `Organica.presetStore('loom')` (repopulated on tab switch) + the two built-ins, so a grid designed in `/loom/` is one click, no JSON upload; **"Apply to all cells"** toggle in the Choose-content overlay + a `Set content for all cells…` button in the rule block → `contentTarget()` routes tile-picks to every cell instead of the selection, so one Component tiles the whole grid then the rule varies it (~4 clicks to a full generative Symbol); the rule state (`RULE_CONTROL_IDS`) is saved into `buildSymbolLibraryEntry().rule` and restored by `applyRuleState()` in `applySymbolLibraryEntryToUI` — additive, old entries without `rule` still load (cells are also stored resolved). **Verified live** (2×rAF awaits): Bento grid → Rule → Oscillator → rotations `[0,0,90,0,0,0,90]` from real `col/row`, Row shift live-changes the flow; Arc content for all + oscillator renders the flowing quarter-circle Truchet composition (screenshot); Hexagonal (17 polygon cells) → centroid binning gives cols:3/rows:5, oscillator produces only `{0,90}`; every rule fills with the right distinct-rotation count; Vary Rotation-only leaves flip/scale byte-identical, enabling them changes them; a saved Loom grid appears in the picker and loads as a new instance; lock survives a rule re-apply, "Reset & apply to all" overrides it; save→mutate-UI→`applySymbolLibraryEntryToUI` restores rule+fill+params+cells; **WYSIWYG** — `buildSymbolSVG()` and the rendered DOM have identical element counts (svg/metadata/defs/clipPath×12/rect×25/g×36/path×12) and byte-identical first-path `d` (the `!==` on raw strings is browser `innerHTML` re-serialisation, same artifact as Radial); Components tier + Symbols Generate/Manual modes regression-clean; 0 unlabeled controls; zero console errors on a genuinely fresh tab. `fvs/index.html` only. Shipped to production.

- **August 28, 2026 (still later same day) — FVS: the "Arc truchet" Element, the piece flagged out of scope in the rule-layer pass, built.** Diego: "let's work on the Out of scope — the concentric-arc butterfly Element itself." The earlier note said it needed "cell shape-stacking" (one FVS cell holds one path) — that turned out to be avoidable: `arcTruchetPathD(count, ratio)` returns **one compound `d`** (2 fans × `count` closed annular half-rings from the top & bottom edge midpoints, non-overlapping so no `fill-rule` needed), which drops into FVS's existing one-`<path>`-per-cell model unchanged. Inscribed exactly in the 0–100 box (max radius 50, the fans meet at the centre — `getBBox` → `{0,0,100,100}`), so **no per-cell clip is needed** anywhere (Element preview strip, Components gallery, Symbols). **One real bug, caught by `getBBox` not by eye**: the first sweep-flag choice put both fans bulging *outward* (bbox `y:-50 h:200`, overflowing the box by 50 each side) — SVG's `sweep=1` on a left→right arc bulges UP in y-down space, and the inner arc (right→left) takes the opposite flag; fixed and re-verified bbox is exactly the unit box. Wired through: `SEED_TYPES.arctruchet`, `#sel-seed-type`, a `#seed-arctruchet-block` (Arc count 3–12 / Arc ratio 10–95%), `getSeed()` (ratio stored 0–1), `syncSeedUI()`, the two sliders' listeners, `buildLibraryEntry`/`applyLibraryEntryToUI` round-trip, and the Symbols tier — `buildSymbolItems` + the Choose-content overlay + `generateSymbolCells` all get a fixed `SYMBOL_ARC_TRUCHET = {arcCount:5, arcRatio:0.7}` (Symbols cells carry no per-seed params, same as they already ignore Base/Height/Thickness). Verified: preview strip shows the butterfly at 0/90/180/270° + flips; Components + Radial rule → concentric-arc mandalas; **Symbols + built-in Bento + Oscillator rule → a faithful `concentric_arc_truchet_3` reproduction** (screenshot); 7 `<path>` for 7 cells, WYSIWYG element counts match; arc-param save/reload round-trips (0–1 internal form); Triangle/Arc seeds unaffected; 0 unlabeled controls; zero console errors on a fresh tab. `fvs/index.html` only. **Not committed — waiting for an explicit "porta in prod".**

---

*Studio Rann · Updated August 2026*
