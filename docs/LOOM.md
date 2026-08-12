# Loom — Universal Grid Generator — manual

`/loom/` — a universal layout-grid engine: every grid is generated from a common mathematical model, resolved once into a Universal JSON Model, then rendered by independent renderers (live HTML/CSS Grid, SVG, PNG, and — via the existing shared Figma pipeline — a Figma import). Not a column generator: the brief this was built from (`Grid Definition`, Notion) is explicit that this is a constraint-driven, multi-generator system meant to become an industry-standard layout tool.

**Status: Phase 1 (MVP).** Two generators (Bento, Sinusoidal — the brief's own "one simple, one complex" pairing to prove the architecture end to end), the full pipeline below, and a Figma export that reuses the existing SVG-import plugin as-is. The other ~24 elementary/preset grid types, WYSIWYG cell editing, and native Figma Auto Layout frame generation are later phases — see §7.

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

## 5. Universal JSON Model (`js/json-model.js`)

```js
{
  version, generatedAt,
  canvas: { width, height, unit, orientation, margin, safeArea, bleed },
  grid: { type, solver, params, gap, tracks: { cols: [...], rows: [...] } },
  cells: [ { id, col, row, colSpan, rowSpan } ]
}
```

Deliberately does **not** store per-cell pixel `x/y/width/height` — those are always derivable from `tracks` + spans (`resolveCellRects`), and storing a derived value alongside its source is exactly how "which one is the truth" bugs happen. The CSS Grid renderer reads `tracks` + spans natively (`grid-template-columns`, `grid-column: n / span k`); SVG/raster/Figma read resolved pixel rects — both come from the same tracks, so they can't drift apart.

## 6. Renderers (`js/renderers/`)

- **`html-renderer.js`** — `paintGridDOM` paints the live preview as a *real* `display: grid` container (not absolutely-positioned divs simulating one); `buildHTMLSnippet` serialises the exact same CSS the DOM preview uses, so the on-screen canvas and the exported HTML file can never disagree — the same WYSIWYG rule as every raster/vector renderer elsewhere in Organica, applied to a DOM target instead of a `<canvas>`.
- **`svg-renderer.js`** — outlined rects (a grid *definition* — guides for a designer to build on in Figma/Affinity, not filled shapes pretending to be a finished layout), plus a dashed margin guide.
- **`raster-renderer.js`** — draws the same resolved rects onto an offscreen `<canvas>` for PNG export, independent of SVG parsing.
- **Figma** — reuses `Organica.sendToFigma()` and the existing `figma-plugin/` verbatim: the grid arrives as vector guides via the plugin's existing SVG-import path. **Not yet** native Auto Layout frame generation — that's Phase 5 (§7). No UI button calls it currently — the Figma send button was removed product-wide across every Organica tool pending its return as a tab inside the Export popover; `sendToFigma()` stays defined, unwired, ready for that.

## 7. UI shell

Export lives in the shared bottom-centre floating toolbar (`shared/organica-floatbar.css`), not the header — the same component Strata/Spore/Pollen/Halide/Komorebi/Living Path/Genesis Creator/Camo Turing all use; the header carries only the logo and status. Zoom/pan is the shared `Organica.createZoomPan` (`shared/organica-core.js`) on `#canvas-frame` — a pure CSS transform that never touches `canvas.width/height` or the JSON model, so no export can disagree with what's on screen regardless of zoom level. Range is `[0.1, 12]` rather than the function's own `[1, 12]` default, and a canvas whose physical size just changed (a new preset, a manual width/height edit) is auto-fit to the viewport once — Loom renders its canvas at its own real declared size (an A4's 297px up to a 1920px social preset), unlike Halide/Komorebi's own capped ~900px preview resolution, so 100% alone isn't guaranteed to fit.

## 8. Roadmap

1. ~~Phase 0 — architecture analysis~~ (done, this session)
2. ~~**Phase 1 (MVP)** — Canvas Manager, Bento + Sinusoidal, JSON Model, CSS Grid/SVG/PNG renderers, Figma via the existing plugin~~ (done, this session)
3. Phase 2 — remaining 12 elementary generators (Rectangular, Radial, Elliptical, Circular, Polar, Hexagonal, Triangular, Diamond, Diagonal, Angular, Column, Row, Modular, Noise)
4. Phase 3 — remaining 11 presets, each a named parameter set over an elementary generator (Swiss, Voronoi, Golden Ratio, Rule of Thirds, Timeline, Masonry, Fractal, Recursive, Organic, Isometric, Spiral) — Voronoi reuses `shared/organica-noise.js`'s `voronoiF1F2` directly
5. Phase 4 — WYSIWYG cell editing (drag/resize), per-side margins, real edit-constraint use of Kiwi (`addEditVariable` + `suggestValue`, unused by any generator in Phase 1)
6. Phase 5 — native Figma Auto Layout frame generation, nested Auto Layout, roundtrip editing (extends `figma-plugin/`, doesn't fork it)
7. Phase 6 — randomisation UI, tests, worked examples

**Not on this list, deliberately not extracted yet**: `canvas-manager.js` (unit mm/px, margin %, safe area %, bleed, industry presets) is a plausible seed for `docs/ROADMAP.md`'s own Phase 6 output pipeline (print PDF, mural schema) — but it's a real *system-wide* Phase 6, not a Loom one, and every prior Organica shared-module extraction (`organica-noise.js`, `organica-panel.css`) happened only once a **second real consumer** existed, never speculatively. `canvas-manager.js` is already written with zero coupling to Loom's own UI (pure functions, no DOM), so moving it to `shared/organica-canvas.js` will be cheap whenever a second tool (most likely Halide or Strata, for a poster/mural export) actually needs physical units — that is the trigger, not a target date. Revisit then.

---

*Studio Rann · Organica*
