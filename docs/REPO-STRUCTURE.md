# Organica — Repo Structure

> Every file and folder with its full description (APIs, load order, history), as it stood in CLAUDE.md. Moved out of `CLAUDE.md` on October 14, 2026 to keep the session-start context small;
> `CLAUDE.md` keeps a one-line version. Keep this file current when a tool changes.

## Repo Structure — full

```
organic-strata/          ← GitHub repo name (diegoair/organic-strata)
├── 404.html             ← the error page (Oct 2, 2026): Page template, public (no auth.js), header + card + footer, standing on a full-screen FVS field (`shared/fvs-field.js`): the numerals "404" in the band above the card, each visit the other motion (Arrival / Rules) and the next palette of the library (`localStorage['organica.404.visit']`; `?p=a|b`, `?pal=<n>` pin them). Vercel serves it for any address that matches no file and no rewrite — and so does the dev server (`.claude/nocache_server.py`)
├── index.html           ← Organica home (rebuilt Sep 29, 2026): stipple-field hero word, a gallery of live placeholder sketches (one per tool language), then the what/why text. No side-nav — tool navigation is the header mega menu only (`shared/tools.js`, incl. an Explorations group)
├── archive/
│   └── hub-bento/index.html ← the previous hub (side-nav + bento), kept for later reuse
│   └── fvs-single-file/index.html ← FVS as one 903 KB file, the last version before the split (Oct 6, 2026). FROZEN — never edited; FVS development continues in fvs/
├── genesis/
│   ├── index.html       ← Genesis — the seed library (Aug 30, 2026 restructure): two modes, Library + Create. Sets = plain ordered id lists. Base Seeds built-in = 13 organic + 6 procedural, synthesized
│   ├── creator.html     ← thin redirect to /genesis/ (kept so old links resolve)
│   ├── library.html     ← thin redirect to /genesis/ (same)
│   ├── indicators.html  ← thin redirect to /genesis/ (the 55-form catalog moved to archive/, Aug 30, 2026)
│   ├── archive/
│   │   └── indicators-55.html  ← the full 55-form animated catalog, self-contained. Links animations.css + page.css absolutely
│   ├── animations.css ← 78 @keyframes + 55 .aNN rules — append-only. Archive-support only now: linked ONLY by archive/indicators-55.html (Genesis + the hub bento both render static since 2026-09-03)
│   ├── page.css      ← :root palette + catalog page chrome (archive/indicators-55.html)
│   ├── forms.js      ← the 13 organic Base Seeds. `window.ORGANIC_SEEDS` = one entry per seed keyed by `seed-<slug>` (matches base_seeds.seed_id, DB wins): `{ label, type, tags[], bbox[x,y,w,h], svg }`. SVG is class-free and paints `fill="var(--ink)"` / `stroke="var(--ink)"` (the `class="aNN"` animation hooks were dropped 2026-09-03 — nothing consumed them). `window.ORGANIC_FORMS` (id→svg) + `window.ORGANIC_LABELS` (id→label) are derived from it for back-compat — PORT AS DATA
│   ├── defs.js       ← Shared SVG defs (goo filters + chips) — INJECT ONCE
│   └── genesis-creator.js    ← RETIRED, loaded by no page — record of the old plain-composer's decorative layer (palettes/backgrounds/per-shape colour/Randomize) that was never ported
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
│       └── renderers/            ← node-card.js (the card body preview — SVG as an <img> from a blob URL), inspector-panel.js (populates the shared right panel). The board itself (cards, ports, wires, selection, history, engine, node bar, node search) is `shared/node-canvas.js` since Oct 2026
├── membrane/             ← Generative form-growth (point-set + Movement pattern + accumulated trail)
│   ├── index.html
│   └── js/               ← state.js, canvas.js, main.js, color.js, movement.js, svgexport.js, …
├── vortex/               ← 3D conical helix, own perspective camera, resting→transitioning→running
│   ├── index.html
│   └── js/               ← state.js, geometry.js (helix/camera/noise math), palette.js, render.js, canvas.js, svgexport.js, main.js
├── fvs/                  ← Flexible Visual System — Elements→Components grid/rule engine (split Oct 2026 — docs/FVS.md §11)
│   ├── index.html       ← head + markup + one <script type="module" src="/fvs/js/main.js">; the Element / Component / Symbol tier views are board stages (§13)
│   ├── fvs.css          ← the tool's own sheet (was the inline <style>)
│   └── js/              ← native ES modules: main.js (order) · hooks.js (refs to later files) · rt.js (cross-file vars) · test-surface.js (window.__fvs) · lazy.js + figure.js (Figure on demand) · NN-*.js UI by view · engine/NN-*.js model + logic, no DOM UI (check.py guards it)
├── radial/               ← Book of Shapes "radial" family — polar field → 7 render modes (single-file, vanilla)
│   └── index.html       ← DOM glue only; geometry/render core is shared/radial.js
├── pulsar/               ← Motion tool over Radial — parameter tracks + rAF redraw → seamless-loop WebM (single-file)
│   └── index.html
├── mote/                 ← Video / webcam → stipple — 3 coherence modes + offline frame-accurate encoder (single-file). Consumes shared/pollen-engine.js
│   └── index.html
├── murmur/               ← A Pollen / Spore / Halide SVG export, animated — every mark on a spring (single-file). Consumes shared/swarm.js
│   └── index.html
├── undertow/             ← Warping's SVG export, animated — tone-band vertices on a displacement field (single-file, generated from the same template as dapple/). Consumes shared/bandfield.js
│   └── index.html
├── dapple/               ← Komorebi's SVG export, animated — Undertow's twin tuned to light through leaves (single-file). Consumes shared/bandfield.js
│   └── index.html
├── gallery/              ← Public showcase: live animated tiles from real exports (single-file) + samples/ (8 committed SVG exports). Consumes shared/marks-svg.js, swarm.js, bandfield.js
│   ├── index.html
│   └── samples/          ← pollen-dots · halide-atkinson · halide-bayer · warping-wood/marble/cells · komorebi-birch/palm (.svg)
├── mycel/                ← Mycelial-network growth — space-colonisation branching from Roots, SVG/PNG (single-file, vanilla)
│   └── index.html
├── trellis/              ← Phase 1 test — fills & animates an imported Loom grid (single-file). Consumes shared/shapes.js
│   └── index.html
├── tunesutra/            ← The colour source: palette library (home) + palette editor (cards, scales, contrast, gradient + grain, System) (single-file, vanilla)
│   ├── index.html
│   ├── collections.js   ← built-in palette collections, as data (`window.TUNESUTRA_COLLECTIONS`) — PORT AS DATA
│   └── figures.js       ← the figures a palette is shown on, as data (`window.TUNESUTRA_FIGURES`: polygon zones per colour role) + `TUNESUTRA_FIGURE_SHARES(fig)` (measured area share per role) — PORT AS DATA
├── livingpath/           ← Font-only — font input → type-tester canvas (editable specimen, SIZE/TRACK/align/CAPS/night bar) → OTF export. Auto-loads shared/vendor/archivo-black.ttf (OFL) on boot. Raster engine in shared/pathfx.js (single-file, web port)
│   └── index.html
├── sinew/                ← Split from Living Path Sep 5, 2026 — the generic SVG/Genesis half of the same shared/pathfx.js engine (single-file)
│   └── index.html
├── rhizome/              ← Node-based workflow canvas — chains other tools as pipeline stages (native ES modules, like Loom)
│   ├── index.html        ← shell — canvas/panel/floatbar, loads js/main.js as a module
│   ├── _test-mvp.html    ← the original isolated prototype (2-node drag/wire/connect test) — kept as record
│   └── js/
│       ├── port-types.js        ← PortType enum + display metadata
│       ├── adapters.js          ← svg→points / grid→points / grid→svg / grid→image, the only auto-conversions
│       ├── node-registry.js     ← id → {meta, compute}; the visible labels (type / param / port, sentence case) + node bar groups (Source · Process · Output); `sharedTypes()` / `createSharedRegistry()` adapt the types to `Organica.nodeCanvas`
│       ├── nodes/                ← Tier 1 native (loom-grid-generator/geometry, contour-trace, svg-to-points, merge, export) + Tier 2 bridges (genesis/komorebi/warping/camo-turing/membrane/livingpath/spore/pollen/halide) + bridge-iframe.js (the generic Tier-2 factory)
│       └── renderers/            ← node-card.js, inspector-panel.js (populates the shared right panel)
├── shared/              ← Cross-tool system assets
│   ├── tokens.css ← the two typefaces (--font-display Space Grotesk / --font-mono IBM Plex Mono / --font = the mono default) + type scale + editorial/panel/header/numeric role tokens + spacing + the surface palette (--ink/--paper/--mid/--accent/--panel/--border defaults) + --danger (load FIRST)
│   ├── shell.css  ← the app-shell skeleton: reset, body, #app, #canvas-wrap, .org-stage (+ zoom-cursor states), #zoom-hud, #drop-hint. Load AFTER floatbar, BEFORE the tool <style>. The **Tool template's** skeleton; linked by every tool except the own-surface variants (Apostate, FVS, Rhizome, Genesis) — the list is generated, see `/design-system/#templates`
│   ├── icons.js + icons.css ← **the one icon system** (Oct 2, 2026). `Organica.icons` — a registry of 75 drawings on a 16×16 grid (general, file/io, history/run, edit, views, glyph editor, `fvs-*`, `phrase-*`, `role-*`) → `get(name,{size,cls,label})` / `mount()` / `register()` / `names()`. `.ico` styles every icon: stroke = `--icon-stroke` (1.3) in **screen px** (`vector-effect: non-scaling-stroke`), size = `--icon-xs/sm/md/lg/xl` (10/12/14/16/20). Static HTML may carry the markup inline with `data-icon="name"`; `scripts/check.py` fails if a drawing drifts from the registry or a new bare 16-grid `<svg>` appears (opt out of a JS-filled slot with `data-icon-slot`). Not in it: 26-grid pictograms, export serialisers, Google logo, `<menu-icon>`, **Genesis** (retiring, left alone). Load icons.css after tokens.css; icons.js after core.js, before header.js. Manual: design-system `#icons`
│   ├── core.js    ← download, presets, Figma, tracer, zoom/pan, hex/CMYK utils, mulberry32, picker-thumbnail sources `Organica.previewImage(w,h)` (the one test subject every image-effect preset renders on) / `loomGridThumb(model)` / `aspectIcon(w,h)`, `Organica.dataURLToBytes`/`dataURLToBlob` (the atob→Uint8Array canvas-export tail, found in 11 files — `toDataURL()` not `toBlob()` everywhere, since `toBlob()` is async and can race a canvas resized back right after export)
│   ├── page.css   ← the **Page template's** skeleton (Oct 2, 2026): reset, `body.org-page` (+ `--paper`), the `.org-page__col` column (660) + `--wide` (1040) / `--full` (1500), widths as component-local `--page-col-w`, `.org-page__card` (paper card: privacy, terms, 404) and `.org-page__foot` (the one footer — © Organica + Privacy · Terms · Design System; privacy, terms, 404, hub). The counterpart of shell.css; a page links this and never shell.css. Used by privacy, terms, admin, gallery (+ the design system, for its live demo). Load AFTER header.css, BEFORE prose.css
│   ├── prose.css  ← `.org-prose` — styles bare h1–h6/p/lists/links/code/tables from the editorial type roles (legal, docs, long-form). `--compact` = 12px body. Not for tool panels or dense data pages. Load AFTER tokens.css
│   ├── header.js ← the header's two self-built parts: the **mega menu** (nav button → full-width panel of every tool from `Organica.tools`, via `Organica.popover`) and the **pattern switcher** (4 round buttons → `<html data-canvas-pattern>`, persisted in `localStorage['organica.ui.canvas-pattern']`). Load AFTER core.js + tools.js
│   ├── tools.js ← `Organica.tools` — the tool list as data for the mega menu, the only tool navigation since the hub side-nav was removed: 6 groups by what you start from (Form & grid · From an image · Patterns · Colour · Type & vector · Motion, one row, ≤5 links) + `Organica.toolsPipeline` (Rhizome) and `Organica.explorations`, both in the menu's foot; `scripts/check.py` fails if a link doesn't resolve to a file
│   ├── pattern-init.js ← sync `<head>` script: applies the saved canvas pattern before first paint (no dot flash). Tokens: `:root[data-canvas-pattern=…]` in tokens.css re-point `--canvas-grid`
│   ├── auth-card.css ← the sign-in card (`.org-auth-card` + `__brand/__sub/__google/__link/__divider/__label/__input/__msg(--ok,--err)/__legal`), promoted out of `sign-in/index.html` Sep 29, 2026; linked only by `/sign-in` and the design-system page (live example). Tokens only, `--auth-card-w` is component-local
│   ├── fvs-field.js + fvs-field.css ← `Organica.fvsField` (Oct 2, 2026) — a decorative full-screen Flexible Visual System field under a page: one Element (`Organica.shapes`) in every cell of a grid, each cell's turn set by a named rule; inline SVG, never takes the pointer. `mount(host, {motion, numerals, band, centre, above, below, palette})` → `{stop}`. Two motions: **arrival** (FVS's Generate arrival — blur → contrast → sharp, cells in a scattered order, each pane filtering the cell + its 8 neighbours, ≤140 forming at once; Arc truchet, Checkerboard 0°/90°; then one cell at a time takes a quarter turn and re-forms) and **rules** (quarter turns through Radial → Checkerboard → Pinwheel → Identity on CSS `--dur-settle`/`--ease-overshoot-soft`; Arc quarter ring). `numerals` = the "404" 16 × 8 mask, or `text` = any words in a 3 × 5 cell alphabet (`textMask`): the cells that never finish arriving / never obey the rule (`hold`, default true; `false` = they behave like the rest). `elements: {cell, mark}` picks the Elements by name (`truchet | arc | triangle | circle`); a different `mark` draws the words in that Element and the palette's strongest ink. Past 800 cells only a share of the grid arrives through the filter (the rest fades in), and the blur scales down with small cells. `visit(key)` = the per-browser visit counter. `palettes()` = `Organica.palette.library()` resolved to ground + inks (ground = the colour leaving the others most contrast; inks along their own scale to ≥1.8:1, the numerals' ink ≥3:1; a palette is content, same in both themes). CSS: `.org-fvs-field` (fixed layer, z-index −1), `__band` (`--fvs-field-band-h`), `__cell`, and the Page variant `.org-page--field` (column fills the viewport; the footer is a child of body — a bar like the header; header + footer on clear ground, `--ink` instead of `--mid`; pattern switcher + theme button hidden). Reduced motion = the settled picture. **Standalone** (Oct 2, 2026, "make it lighter"): it bakes `ELEMENTS` (the two paths = `Organica.shapes`' output) and `BUILTIN` (the built-in combinations, resolved) plus a local `mulberry32`, kept honest by `node scripts/test-fvs-field.mjs` (run by `check.py`; `--print` re-bakes); with `color.js` + `palette.js` loaded `palettes()` reads the live library instead. Sheet after page/prose. Used by `/404.html` and `/sign-in/`; reference `/design-system/#fvs-field`
│   ├── color.js ← Organica.color — the perceptual colour maths (Oct 1, 2026): OKLab/OKLCH ↔ hex with chroma-reduction gamut mapping, `mix` (OKLab), `contrast`/`luminance` (WCAG), `deltaE`, `scale(hex)` (10 steps 0–900 at fixed perceived lightness, the pick kept on its nearest step), `DISTINCT_MIN` (6) + `roleShares(n)` (moved from TuneSutra Oct 2, 2026) + `stepFor(hex, against, minContrast)` (the scale step nearest the pick that reaches a contrast), HSB/HSL (moved from TuneSutra; Membrane delegates). Pure, no DOM. Tests: `node scripts/test-color.mjs`. Load AFTER core, BEFORE palette. Used by TuneSutra + Membrane + Flexible Visual System
│   ├── palette.js ← the Palette component: Organica.palette.swatch(target, opts) — string target = attach a #cp-/#hex-/#sw- colour row, element target = build an RMX chip strip — plus .colorAt (score→colour) / .mix. Paired CSS: palette.css. Folded in organica-palette-chip.js + core's createColorSwatch (Aug 29). Since Oct 1, 2026 every swatch also carries a **Pick from a palette** button → `Organica.palette.pick` menu over `Organica.palette.library()` (palettes saved in TuneSutra, read from `Organica.store('tunesutra')`, + the built-ins: three combinations Diego chose — Violet 06 / Stimulating / Violet 07, mirrored from `tunesutra/collections.js` — and the Riso standard inks); `opts.library:false` opts out, `opts.palettes` lists a tool's own unsaved palettes; menu CSS in panel.css; `mix`/`colorAt` take an opt-in `'oklab'` space. Load AFTER core (+ color.js for the oklab space)
│   ├── palette.css ← paired sheet for palette.js — .rmx-* chip CSS (custom-prop tunable) + .icon-btn. Link only for generate/RMX mode; .color-* stays in panel.css
│   ├── noise.js   ← hash2/vnoise/fbm/ridgedFbm/voronoiF1F2/simplex2/simplex3/simplexFbm2/simplexFbm3 — shared by Komorebi, Camo Turing, Warping, Radial/Pulsar
│   ├── motion.js  ← parsePrimitives (any SVG → primitive list) — used by Rhizome's svg-to-points node + svg→points adapter. PATTERNS/staggerDelay/animate/morph retained-but-unused since Soul's removal (Aug 31, 2026). Load AFTER noise
│   ├── radial.js  ← Radial's polar-field geometry/render core (buildScene/sceneSVG/drawSceneCanvas + PARAM_RANGES + BP/BUILTIN_PRESETS), shared by Radial and Pulsar — load AFTER noise, BEFORE the tool script
│   ├── pollen-engine.js ← Organica.pollenEngine — the stippling core: processLuma/buildField (tone), computePoints (pure dart-thrower, injectable rng + field + isCancelled/onProgress), spacingAt/gradAngle, ranged/dropoutSkip/pointAngle/pointRGBA, strokeCenterline/smoothOpenPath[D]/makeFieldAngle/fieldStrokePts. Shared by Pollen + Mote; each keeps its own paintPoints + SVG serializer. Load AFTER core + palette
│   ├── recorder.js ← Organica.recorder({canvas,tool,duration,bitrate,mimeCandidates,onStart,onStatus,onStateChange}) → {toggle,start,stop,isRecording}. captureStream + MediaRecorder + 5-entry MIME fallback (overridable) + optional explicit videoBitsPerSecond + negotiated-mimeType ext sniff. Used by Pulsar/Camo Turing/Vortex/Membrane/Mote. No paired CSS. Load AFTER core
│   ├── dual-range.js ← `Organica.dualRange(host, {min,max,from,to,step,detents,catchBy,label,fmt,onInput,onChange})` → `{get,set,setDetents,setBounds}` — one track, two knobs (a From–To span), detents that catch a knob; styles `.org-dual` in panel.css. First used by FVS Rule › Axes (Free angles, Scale › Sizes), Oct 15, 2026. Manual: design-system `#dual-range`
│   ├── swarm.js ← Organica.swarm — a field of marks on springs: create({homes,styles,W,H,params,unit,seed}) → {advance(t,pointer,warm),draw(ctx),reset,settle,setParams,pointerAt,time}. Fixed 1/60 s step; ambient (noise drift / wave / breath), pointer (repel/attract/swirl + scripted orbit/figure8/zigzag/sweep), entrance + stagger (tracks.staggerDelay), cycle forces (gravity/scatter/swing), fast marks → strokes; `loop` snaps every periodic motion to whole cycles. Kinds circle / square / shape (Path2D + oval primitives). SCHEMA + MODES + panel(target,params,onChange) (the one DOM helper) + diff(). DEFAULTS = the hub hero's original constants. Extracted from the hero at Murmur's arrival. Load AFTER core + noise (+ tracks)
│   ├── marks-svg.js ← Organica.marksSVG.parse(svgText,{maxMarks}) — a Pollen/Spore/Halide Screen SVG export → {W,H,tool,bg,count,styles,homes} for Organica.swarm. Extracted VERBATIM from murmur/index.html (Oct 1, 2026, at the gallery's arrival — second consumer); verified by a fingerprint of the parse output on 3 real exports before/after (identical). Refuses Print-mode and Warping/Komorebi band exports (pointing to their animators). Load AFTER core. Used by Murmur + Gallery
│   ├── bandfield.js ← Organica.bandField — animate a tone-band SVG export (Warping / Komorebi): parse(svgText,{expect}) → bands of closed polylines (M/L/H/V/Z only; refuses Print-mode, marks, curves, >220k points) · prepare (subdivide long staircase edges to ≤maxSeg within a 120k-vertex budget + 1-2-1 Laplacian smoothing) · create({model,params}) → {advance(t), draw(ctx), setParams, vertices, thinned, bandCount}: ONE displacement field evaluated on a 144-node lattice and bilinearly sampled per vertex (flow/wave/swirl/breathe/rustle, per-band stagger lag + flicker alpha), a PURE function of t, every term periodic in 2π·t/loop·cycles with noise on a circle → seamless by construction; border vertices pinned to the border. **Draw omits closePath()** (fill() closes subpaths; closePath cost ~12µs per subpath in Chrome — 37ms→0.3ms on 3k small patches). panel()/diff()/thumb(params,'warm'|'leaf') (80px PNG from the real engine on a synthetic model). Load AFTER core + noise. Used by Undertow + Dapple
│   ├── canvas.js  ← **`Organica.canvasZoomHud({canvas,wrap,hud,level,resetEl,zoomedClass,hudVisible,onChange,...isReady/min/max/panAlways})`** → the same {zoomBy,reset,apply,zoom,pan} createZoomPan returns. Wraps createZoomPan + the #zoom-level/#zoom-hud/.zoomed DOM wiring every consumer used to hand-write (found byte-near-identical in 6 tools by the Sep 2026 "Canvas Surface Audit"). `hud`/`level`/`resetEl` default to `#zoom-hud`/`#zoom-level`/none, or pass `null` to suppress the HUD side entirely. Used by all 11 tools with a pannable canvas/SVG stage — Halide/Spore/Pollen/Colornet/Mote/Membrane (full HUD) + Living Path/Apostate (HUD + a custom `onChange` for their own overlay-sync logic) + Trellis/Pulsar/Radial (`hud:null` — no on-canvas HUD). Camo Turing's transient auto-hide zoom badge and Rhizome/Vortex's real architectural exceptions stay on raw `createZoomPan`. **`Organica.canvasDropZone({wrap,dropIcon,fileInput,accept,onFile})`** → the click-to-open + dragover/dragleave/drop wiring, found byte-near-identical in exactly 3 tools (Halide/Spore/Pollen) — deliberately narrow, doesn't try to also cover Colornet's own multi-file batch drop or Mote's video-file drop. Agenda: (1) zoom/pan→HUD wiring — done; (2) DPR-aware sizing — done for the one real candidate (Trellis; every raster/WYSIWYG tool's canvas.width IS its work resolution, DPR-scaling it would change the computed image, not just its sharpness — see the session note); (3) surface mounting — investigated, found to have almost no real duplication worth centralizing (WebGL/p5/dynamic-canvas setup is already a few tool-specific lines each), redirected into `canvasDropZone` instead; (4) multi-surface patterns — investigated, the audit's own "board+hidden-glyph-canvas" and "ephemeral export canvas from SVG" framings both turned out not to be real duplication (Living Path/Apostate already share `shared/glyph-editor.js`; Mycel/TuneSutra/Flexible Visual System's canvases redraw natively rather than rasterizing SVG, so there was nothing SVG-specific to centralize there) — redirected into `Organica.dataURLToBytes`/`dataURLToBlob` (`core.js`) instead, the real duplication actually sitting at that layer, found in 11 files. No paired CSS. Load AFTER core, BEFORE the tool script
│   ├── node-canvas.js + node-canvas.css ← `Organica.nodeCanvas` (Oct 2026, built for the FVS Figure graph): a pure graph model (`createModel`/`addNode`/`addEdge`/`removeEdge`, typed ports via a registry, `canConnect`, cycle guard), an engine (`createEngine`: version-keyed cache, downstream-only recompute, states ok / error / waiting / upstream / stale, serialized runs, `keepActive`), a history (`push`/`amend`, checkpoints), and `mount()` — the board view: cards, ports, wires drawn from the model, Weave-style wiring (drop on a body, double-click a port, release on empty → search), marquee, sections (`model.frames`, ⌘G), a chip view below 50 % zoom, pulse, `keyScope`, fit (Shift+1 / Shift+2); plus the helpers a host builds its node bar and search from — `nodeBar()` (a `.org-dock` bar + panel, drag onto the board or click), `search()` (type-to-filter dialog), `portFor()` (the port of a new node that takes a dragged wire), `graphMenu()` (the floatbar's Graph menu: Saved graphs · Save · Delete · New graph · Open file… · Save as file, *Untitled n*, the unsaved dot — `.nc-graph-btn` / `.nc-graph-pop`); a card whose port list changes is rebuilt. Card look + `--port-*` colours: ledger G3 / O-34. Tests: `node scripts/test-node-canvas.mjs` (run by check.py). Two consumers: FVS's Figure graph and Rhizome (since Oct 7, 2026). *(The `canvasPresetGrid` once listed here was never built — struck Oct 7, 2026.)*
│   ├── seeds-panel.js ← Organica.seedsPanel({target,idPrefix,tabs,slots,subControls,extraControls,genesis,text,svg,image,applyMode,onSeed,onTabChange,onFontReady,onError}) — the tabbed Genesis/SVG/Text(/Image) source picker. Emits svgString + a raw descriptor; each tool keeps its own model step. .PRIMORDIAL = the shared curated form list. Used by Membrane + Camo Turing (2 instances) + Living Path (.PRIMORDIAL only). Paired: seeds-panel.css. Load AFTER core
│   ├── seeds-panel.css ← paired sheet — .shape-grid/.shape-thumb/.thumb-num only (--seeds-grid-cols tunable); .seg-ctrl/.upload-btn stay in panel.css
│   ├── shapes.js  ← Organica.shapes — pure shape geometry (triangleGeometry/arcGeometry+arcPathD/arcTruchetGeometry+arcTruchetPathD, each → {d,normTx,normTy,normScale} in a 0..100 box) + grid cell-placement math (resolveGridCells/resolveCellPlacement/cellColRow/frameSize/median) extracted from Flexible Visual System's Symbols tier at Trellis's arrival (2nd consumer). Flexible Visual System aliases these at the top of its own script (byte-identical output, verified); cellColRow's shared signature takes rawCells/gridMeta as explicit args instead of reaching into a caller's own state. Load AFTER core + palette
│   ├── pathfx.js  ← Organica.pathfx — the font-agnostic Vector/Raster effect engine (FX/RFX registries, raster pipeline, groups/blend appliers, 24 presets) extracted from Living Path at Sinew's arrival (2nd consumer, Sep 5, 2026). Operates on a generic `subs` polyline structure regardless of source (font glyph, SVG, Genesis seed); Living Path keeps only the genuinely font-specific 20% local (opentype parsing, live specimen, OTF export). Load AFTER core, BEFORE the tool script
│   ├── print-size.js  ← Organica.printSize — physical-unit math + PNG DPI metadata + bleed/crop-mark geometry (`UNIT_TO_MM` incl. `in`, `toMM`/`mmToPx`/`pxToMm`, a from-scratch PNG `pHYs`-chunk writer `embedPngDpi`, `bleedBox`/`cropMarks`/`cropMarksSVG`/`drawCropMarksCanvas`). Classic script only (no `export`) — Loom's ES modules read it as a bare global like every other `Organica.*`. Load AFTER core, BEFORE print-size-panel.js and the tool script
│   ├── print-size-panel.js  ← Organica.printSizePanel(target, opts) — the shared Screen/Print `.seg-ctrl` output panel (Pollen/Spore/Halide/FVS/Colornet; Loom built its own equivalent since it already had a real unit selector). Screen is the default, byte-identical to pre-existing export; Print reveals unit(mm|in)/size/DPI/bleed. Load AFTER print-size.js
│   ├── plate-export.js  ← Organica.plateExport.run(count, {build, stagger, onDone}) — generalizes Colornet's own per-channel PNG loop into "N discrete outputs → N staggered downloads" (Colornet's plate PNG/SVG, Pollen/Spore's per-ink Plates PNG/SVG). `build(i)` may return `{blob,filename}` or a Promise of one. Load AFTER print-size-panel.js
│   ├── (also: header.css · panel.css · floatbar.css · mobile-gate.css · paper.js · transformer.js · tokens.json — same drop-the-prefix rule)
│   ├── vendor/            ← third-party, isolated from first-party (2026-08-30): gsap.min.js + gsap-morphsvg (Blob Boundary, free "no charge" license), kiwi.min.js (Loom, MIT/BSD-3), three.module.js (Camo Turing), opentype.min.js (Membrane/Camo Turing text seeds), paper-full.min.js (Genesis draw/edit), manrope-variable.ttf (the type-seed font). See THIRD-PARTY-NOTICES.md
│   └── _template.html      ← Start a new tool from this
│   NOTE: files here are named by role, no `organica-` prefix — the `shared/` path is the namespace (renamed 2026-08-30). The JS API global stays `window.Organica.*`.
├── docs/
│   ├── SESSION-LOG.md   ← Full historical session notes (split out of CLAUDE.md Aug 29, 2026) — read on-demand
│   ├── VISION.md        ← Full system vision and methodology
│   ├── ROADMAP.md       ← Development phases and open questions
│   ├── ANIMATION-SYSTEM.md  ← Animation pattern documentation
│   ├── SHARED-LIBRARY.md ← Genesis organic-* forms library contract + storage conventions
│   ├── SHARED-COMPONENTS.md ← The Organica.* JS/CSS component system + the reusable centralization pattern (Palette is the worked example; backlog of concerns queued for the same treatment)
│   ├── DESIGN-SYSTEM.md ← Manrope, type scale, tokens, Figma mapping
│   ├── DESIGN-DECISIONS.md ← the design-system ledger: open questions for Diego, decisions, standing exceptions, audit log — kept by the design-system agent (`.claude/agents/design-system.md`); instrument: `scripts/ds-audit.py`
│   ├── UI-SHELL.md      ← The standard tool layout + behaviour contract
│   ├── KOMOREBI.md      ← Komorebi manual
│   ├── CAMO-TURING.md   ← Camo Turing manual
│   ├── WARPING.md       ← Warping manual
│   ├── LOOM.md          ← Loom (Universal Grid Generator) manual
│   ├── RHIZOME.md       ← Rhizome (node workflow canvas) manual
│   ├── HALIDE.md        ← Halide manual
│   ├── FVS.md           ← Flexible Visual System manual
│   ├── SPORE.md · POLLEN.md · LIVINGPATH.md · MURMUR.md ← per-tool manuals
│   └── archive/SOUL.md  ← manual for the retired Soul tool (removed Aug 31, 2026)
├── vercel.json          ← Routing: / → hub, /genesis/ → genesis, per-tool rewrites, cache headers for shared/*. No comments allowed by Vercel's schema (`additionalProperties: false`) — don't add `_comment_*` keys here again; put rationale in CLAUDE.md instead
├── LICENSE              ← All-rights-reserved proprietary notice (repo is private on GitHub — see Aug 27 session note)
├── THIRD-PARTY-NOTICES.md ← Every vendored library's real license, audited against its own file header
└── CLAUDE.md            ← This file
```
