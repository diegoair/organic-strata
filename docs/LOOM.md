# Loom — Universal Grid Generator — manual

`/loom/` — a universal layout-grid engine: every grid is generated from a common mathematical model, resolved once into a Universal JSON Model, then rendered by independent renderers (live HTML/CSS Grid, SVG, PNG, and — via the existing shared Figma pipeline — a Figma import). Not a column generator: the brief this was built from (`Grid Definition`, Notion) is explicit that this is a constraint-driven, multi-generator system meant to become an industry-standard layout tool.

**Status: Phase 1 (MVP) + two Phase 3 presets.** Two MVP generators (Bento, Sinusoidal — the brief's own "one simple, one complex" pairing to prove the architecture end to end) plus Voronoi and Hexagonal (the first two `cellShape: 'polygon'` generators, proving that fork generalises), the full pipeline below, and a Figma export that reuses the existing SVG-import plugin as-is. The remaining ~22 elementary/preset grid types, WYSIWYG cell editing, and native Figma Auto Layout frame generation are later phases — see §7.

## 1. Architecture

```
Canvas Manager (physical space: size, unit, margin, safe area, bleed)
     ↓
Grid Definition Engine (generator registry — js/generators/registry.js)
     ↓
Constraint Engine (per-generator: Kiwi solver OR direct parametric math)
     ↓
Universal JSON Model (js/json-model.js)  ← single source of truth
     ↓
Renderers: live CSS Grid · SVG · raster PNG · Figma (via shared pipeline)
```

Native ES modules (`loom/js/*.js`, `import`/`export`, no bundler) — the one deliberate deviation from every other Organica tool's single-file convention, chosen because this engine has a real module boundary (canvas → generators → solvers → model → renderers) that a 3000-line single file would obscure rather than simplify. `kiwi` and `Organica` are both classic global scripts loaded before the module entry point, read as unqualified globals inside the modules — same load-order pattern Camo Turing already uses for `Organica` inside its own `<script type="module">`.

## 2. The Kiwi / parametric split — the central architecture decision

Two solvers, chosen **per generator**, not globally — this was the explicit output of an architecture discussion before any code was written (the brief's own instruction: "Always explain architectural decisions before writing code").

- **Kiwi** (`shared/kiwi.min.js`, vendored — MIT/BSD-3-Clause, no CDN, same convention as Paper.js in Strata) — a real Cassowary constraint solver. Used where tracks should size **equally by default but be overridable under priority** — Bento today; every future modular/column/row grid, and Phase 4's WYSIWYG drag-to-resize, where dragging one track becomes a stronger edit constraint and the rest re-solve automatically, with no hand-written redistribution logic.
- **Parametric** (`js/constraint-engine.js`'s `solveTracksParametric`) — direct closed-form math, no solver. Used where tracks follow a continuous function that isn't a linear constraint — Sinusoidal today; every future radial/polar/noise generator.

`js/constraint-engine.js` exposes both; each generator picks the one that actually matches its own behaviour, documented in its own file rather than hidden behind a generic dispatcher.

## 3. Canvas Manager (`js/canvas-manager.js`)

Width/height/unit (px, mm, cm, or m), a preset library (`Square 1:1`, `Landscape 16:9`, `Portrait 4:5`, `Widescreen 3:2`, `A4 portrait/landscape`, `Letter portrait`), Margin and Safe area (both a single percentage of the canvas's own shorter side, applied to all four sides), and Bleed (always mm regardless of canvas unit — the real print convention — shown for any non-px unit).

**Units — px vs. the metric family.** mm/cm/m convert between each other with clean decimal factors (`UNIT_TO_MM = { mm: 1, cm: 10, m: 1000 }`); px does not — a CSS pixel has no fixed physical size, so "converting" it to mm would mean silently assuming a DPI nobody asked for. `createCanvas` canonicalises any mm/cm/m input to an internal **mm-equivalent** number (`canvas.width`/`canvas.height`) that every generator, `innerRect`/`safeAreaRect`, and the on-screen canvas-frame sizing read directly — none of them need to know or care which of the three the user actually typed. `canvas.displayWidth`/`displayHeight`/`unit` keep the raw typed number, unconverted, purely for showing it back to the user. Gap and Padding (absolute-number sliders, unlike the percentage-based Margin/Safe area) go through the same canonicalisation (`main.js`'s `unitVal()`) — and their own slider range/step rescales when the unit changes (`UNIT_RANGES`, `rescaleUnitField`), converting the CURRENT value to preserve its physical size rather than leaving the raw number unchanged and silently meaning something else (a Gap of "12" is 12mm under `mm` but would be 12 *metres* under `m` with no rescale — verified live that switching units keeps the physical gap constant, e.g. 12mm → 1.2cm → 0.02m, the last step-snapped by the `m` slider's own 0.02 granularity).

**Export unit suffixes.** SVG's and CSS's `width`/`height` need a real unit suffix on a physical canvas or the bare number is read as px — a genuine bug found while building this (an A4 canvas exported `width="210"`, i.e. 210px, not 210mm; the manual's own earlier claim that this already worked was wrong). Neither SVG nor CSS has a native **metre** unit, so any non-px unit — mm, cm, *and* m — exports as a literal `mm` suffix using the already-canonical mm-equivalent number (e.g. a 3m canvas exports `width="3000mm"`, dimensionally exact). `viewBox` and the grid's own internal CSS (`grid-template-columns`, `gap`, `padding`) stay bare canonical numbers rendered as px, matching the existing on-screen convention — only the outermost declared width/height carries physical meaning.

**Disclosed simplification**: per-side margins are a real brief requirement but deferred to the WYSIWYG-editing phase, since a per-side value wants a visual drag handle, not four more blind sliders. Safe area is a guide only in this phase — it doesn't clip generator output. On-screen preview treats 1 canonical unit as 1px regardless of the declared physical unit (no device-DPI-aware physical preview exists anywhere in Organica yet) — the exported file is always dimensionally correct even though the on-screen preview isn't physically true-to-size.

## 4. Generators (`js/generators/`)

### Bento (`bento.js`) — Kiwi

A base Columns×Rows lattice where adjacent cells are randomly merged (seeded) into 1×1 up to 2×2 rectangular spans — the mixed-size look a Bento grid is named for. `Variety` gates how often a merge is attempted; **0 is a verified exact no-op** (a plain uniform grid, every cell 1×1). Track sizing is solved by Kiwi: every column/row equal by default (medium-strength constraint — a soft preference), a hard minimum size, and a hard "tracks + gaps fill the canvas" sum.

A first version weighted each track by how many spans touched it, meant to make a track under a wide cell size up proportionally — reverted after testing, because dividing a wide cell's contribution across its own tracks made them *thinner*, the opposite of the intended effect. Bento's visual variety comes entirely from the span topology, not from unequal track sizing.

### Sinusoidal (`sinusoidal.js`) — parametric

A full Columns×Rows lattice, no merged spans — the rhythm here is in **track size**, not topology. Each column width (or row height, or both — `Axis`) follows `1 + Amplitude · sin(t · Frequency · 2π + Phase)` as a relative weight, then rescaled to fill the canvas exactly (`solveTracksParametric`'s normalise-then-rescale, the same shape Warping's own pattern functions use).

**Honesty note** (same discipline as Camouflage's "Stripes/worms" disclosure): this modulates track *size*, not track *boundary shape*. A literal wavy grid line isn't representable in real CSS Grid (`grid-template-columns` is a list of straight sizes) or as an axis-aligned SVG rect grid, so "sinusoidal" here means a rhythmic width/height sequence — honestly renderable by every promised target, rather than a wavy-edged grid the CSS renderer could never actually deliver.

### Voronoi (`voronoi.js`) — geometric

The first **polygon-shaped** generator, not a rect one — a real architecture fork, not a Bento variant. `N` seed points scatter (seeded) inside the inner rect; each cell is that seed's own Voronoi region, built by half-plane intersection: start from the inner rect as a polygon, then for every OTHER seed clip to the half-plane on this seed's own side of their perpendicular bisector (Sutherland–Hodgman), repeated over all seeds. O(N²), trivial at the cell counts this tool uses (a handful to a few dozen), and far simpler to get right than Fortune's algorithm for the identical result. `grid.cellShape = 'polygon'` and `grid.solver = 'geometric'` — genuinely a third category, neither Kiwi nor the parametric track math, since there's no track lattice and no linear constraint system at all.

**Why there's no CSS Grid form**: Voronoi cells are arbitrary convex polygons: there is no honest way to fit them onto CSS Grid's own track lattice (a bounding-box approximation would be a fake, the exact kind of degenerate output this project's conventions refuse elsewhere — see the Padding no-op discipline, or the real-vector-SVG rule shared across every Organica tool). So `main.js`/`html-renderer.js` branch on `cellShape`: rect grids get the live CSS Grid preview described above; Voronoi's preview is an embedded SVG instead (`buildPolygonSVG`), built from the same de-duplicated edge list (`collectPolygonEdges` — the polygon analogue of `collectEdges`: two adjacent Voronoi cells share the exact bisector segment that bounds them both, so stroking each cell's own full outline independently would double-stroke every internal edge, the identical bug `collectEdges` already fixed for rect grids) the SVG *export* uses, so preview and export are about as close to byte-identical as this tool gets. The one deliberate difference: the preview also draws each cell's number at its polygon centroid — numbers were always a preview/HTML-snippet-only feature for rect grids too (the SVG *export* has never drawn them), so Voronoi just keeps that existing convention rather than inventing a new one. Gap and Padding don't apply to polygon cells yet (no defined "shrink a polygon inward" operation shipped) — hidden from the panel rather than left as dead controls, per the same rule Komorebi's own control audit established (`docs/KOMOREBI.md` §18).

### Hexagonal (`hexagonal.js`) — geometric

The second polygon-shaped generator, and proof the `cellShape: 'polygon'` fork Voronoi introduced generalises for free: this file only had to produce cells shaped `{ points, centroid }` — every renderer (SVG/PNG export, the embedded-SVG live preview, `collectPolygonEdges` dedup) already branches on the flag, so nothing outside `hexagonal.js`/`registry.js`/the panel block changed to add it.

Real regular-hexagon tessellation (the standard redblobgames axial-spacing formulas), not a distorted hex-ish shape: **flat-top** spacing is `1.5r` horizontal / `√3·r` vertical with odd *columns* offset by half a row; **pointy-top** swaps the axes (odd *rows* offset by half a column). `Columns` sets the target horizontal spacing (`inner.width / cols`), from which the hexagon radius and both spacings are derived — density, not a literal hex count, so the same slider value behaves consistently on a square canvas or a wide banner. `Gap` shrinks each hexagon toward its own centre before clipping (the polygon analogue of rect-cell Padding, applied pre-clip since a polygon has no separate track size to shrink into) — **verified 0 is an exact no-op**: edge-to-edge tessellation, single de-duplicated boundary line, no doubled-stroke artefact. `Jitter` offsets each hexagon's centre by a seeded random amount before the polygon is built, breaking the lattice into an organic hand-set-tile look (verified visually: overlapping, unevenly-spaced hexagons at Jitter 0.7, vs. a perfect grid at 0).

Clipping reuses the same Sutherland–Hodgman technique as Voronoi's own `clipHalfPlane`, generalised from one half-plane per neighbour seed to 4 fixed half-planes (the inner rect's own edges) — a hexagon straddling the inner-rect boundary is trimmed to a real partial polygon, not dropped or left overflowing. Verified end to end: both orientations render correctly, Gap/Jitter/Columns/Seed all rebuild live, SVG export contains real de-duplicated polygon-edge geometry (276 `<line>` segments on a 95-cell canvas, not a degenerate fallback), all four generators (Bento/Sinusoidal/Voronoi/Hexagonal) regression-tested together with zero console errors, 0 of the block's controls unaccessibly-named (the two orientation segmented buttons carry their own visible text, same convention as every other `seg-ctrl` in Loom).

## 5. Universal JSON Model (`js/json-model.js`)

```js
{
  version, generatedAt,
  canvas: { width, height, unit, orientation, margin, safeArea, bleed },
  grid: { type, solver, params, gap, padding, cellShape,
          tracks: { cols: [...], rows: [...] } },   // rect grids only
  cells: [ { id, col, row, colSpan, rowSpan } ]      // rect grids
      // OR [ { id, points: [[x,y],...], centroid: [x,y] } ]  — polygon grids (Voronoi)
}
```

`grid.cellShape` (`'rect'` or `'polygon'`) is the fork every renderer branches on. Rect grids deliberately do **not** store per-cell pixel `x/y/width/height` — those are always derivable from `tracks` + spans (`resolveCellRects`), and storing a derived value alongside its source is exactly how "which one is the truth" bugs happen. Polygon grids (Voronoi) have no track lattice at all — there's no meaningful "canonical span" representation for an arbitrary polygon, so their cells carry final absolute-coordinate points directly, resolved once at generation time. The CSS Grid renderer reads `tracks` + spans natively (`grid-template-columns`, `grid-column: n / span k`); SVG/raster/Figma read resolved pixel rects for rect grids, or `cell.points` directly for polygon grids — every renderer reads the same source either way, so none can drift from another.

## 6. Renderers (`js/renderers/`)

- **`html-renderer.js`** — for rect grids, `paintGridDOM` paints the live preview as a *real* `display: grid` container (not absolutely-positioned divs simulating one); `buildHTMLSnippet` serialises the exact same CSS the DOM preview uses, so the on-screen canvas and the exported HTML file can never disagree — the same WYSIWYG rule as every raster/vector renderer elsewhere in Organica, applied to a DOM target instead of a `<canvas>`. For polygon grids (`cellShape === 'polygon'`), both functions branch to `buildPolygonSVG` instead — an embedded SVG preview, since CSS Grid has no honest way to represent an arbitrary polygon cell (§4's own Voronoi section has the full reasoning).
- **`svg-renderer.js`** — outlined rects or polygons (a grid *definition* — guides for a designer to build on in Figma/Affinity, not filled shapes pretending to be a finished layout), drawn from a de-duplicated edge list (`collectEdges` for rects, `collectPolygonEdges` for polygons — same dedup idea, generalised), plus a dashed margin guide.
- **`raster-renderer.js`** — draws the same de-duplicated edges onto an offscreen `<canvas>` for PNG export, independent of SVG parsing.
- **Figma** — reuses `Organica.sendToFigma()` and the existing `figma-plugin/` verbatim: the grid arrives as vector guides via the plugin's existing SVG-import path. **Not yet** native Auto Layout frame generation — that's Phase 5 (§7). No UI button calls it currently — the Figma send button was removed product-wide across every Organica tool pending its return as a tab inside the Export popover; `sendToFigma()` stays defined, unwired, ready for that.

## 7. UI shell

Export lives in the shared bottom-centre floating toolbar (`shared/organica-floatbar.css`), not the header — the same component Strata/Spore/Pollen/Halide/Komorebi/Living Path/Genesis Creator/Camo Turing all use; the header carries only the logo and status. Zoom/pan is the shared `Organica.createZoomPan` (`shared/organica-core.js`) on `#canvas-frame` — a pure CSS transform that never touches `canvas.width/height` or the JSON model, so no export can disagree with what's on screen regardless of zoom level. Range is `[0.01, 12]` rather than the function's own `[1, 12]` default (lowered from an initial `0.1` after cm/m canvases could need a fit-scale below that, clamping to `min` and zeroing pan — see the cm/m session note in `CLAUDE.md`), and a canvas whose physical size just changed (a new preset, a manual width/height edit) is auto-fit to the viewport once — Loom renders its canvas at its own real declared size (an A4's 297px up to a 1920px social preset, capped at 50 000 canonical units / 50m), unlike Halide/Komorebi's own capped ~900px preview resolution, so 100% alone isn't guaranteed to fit.

## 8. Roadmap

1. ~~Phase 0 — architecture analysis~~ (done, this session)
2. ~~**Phase 1 (MVP)** — Canvas Manager, Bento + Sinusoidal, JSON Model, CSS Grid/SVG/PNG renderers, Figma via the existing plugin~~ (done, this session)
3. Phase 2 — remaining 13 elementary generators (Rectangular, Radial, Elliptical, Circular, Polar, ~~Hexagonal~~ done — see §4, Triangular, Diamond, Diagonal, Angular, Column, Row, Modular, Noise)
4. Phase 3 — remaining 10 presets (~~Voronoi~~ done — see §4; turned out to need real half-plane-clipped polygon cells, not a reuse of `shared/organica-noise.js`'s raster-only `voronoiF1F2`, and became the first `cellShape: 'polygon'` generator): Swiss, Golden Ratio, Rule of Thirds, Timeline, Masonry, Fractal, Recursive, Organic, Isometric, Spiral
5. Phase 4 — WYSIWYG cell editing (drag/resize), per-side margins, real edit-constraint use of Kiwi (`addEditVariable` + `suggestValue`, unused by any generator in Phase 1)
6. Phase 5 — native Figma Auto Layout frame generation, nested Auto Layout, roundtrip editing (extends `figma-plugin/`, doesn't fork it)
7. Phase 6 — randomisation UI, tests, worked examples

**Not on this list, deliberately not extracted yet**: `canvas-manager.js` (unit mm/px, margin %, safe area %, bleed, industry presets) is a plausible seed for `docs/ROADMAP.md`'s own Phase 6 output pipeline (print PDF, mural schema) — but it's a real *system-wide* Phase 6, not a Loom one, and every prior Organica shared-module extraction (`organica-noise.js`, `organica-panel.css`) happened only once a **second real consumer** existed, never speculatively. `canvas-manager.js` is already written with zero coupling to Loom's own UI (pure functions, no DOM), so moving it to `shared/organica-canvas.js` will be cheap whenever a second tool (most likely Halide or Strata, for a poster/mural export) actually needs physical units — that is the trigger, not a target date. Revisit then.

---

*Studio Rann · Organica*
