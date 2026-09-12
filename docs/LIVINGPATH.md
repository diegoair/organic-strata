# Living Path — User Manual

> Studio Rann · Organica · Generative Font / Path Modification
> Live: [theorganicalanguage.vercel.app/livingpath/](https://theorganicalanguage.vercel.app/livingpath/)
> Last updated: July 23, 2026

---

## 1. What Living Path does

Living Path takes a **font, an SVG, or a Genesis form** and runs its outlines
through a stack of organic effects — then lets you **export the result**, up to a
fully installable **OTF font**. It is a web port of Ivan Murit's desktop
[LivingPath](https://github.com/ivangrozny/LivingPath) ("glyph hydrography"):
typographic forms that flow, melt, grow cells, and dissolve while staying usable.

Single-file vanilla HTML/CSS/JS. No build step, no framework. Uses
[opentype.js](https://github.com/opentypejs/opentype.js) to read/write font outlines.

---

## 2. The two engines — Technique toggle (top bar)

> **Staleness note (2026-09):** §2–§6 describe Living Path's pre-font-only architecture
> (the SVG/Genesis input tabs, the Vector/Raster **toggle**, per-effect groups). Since the
> Sep 5, 2026 font-only split the generic-vector half lives in **Sinew** (still toggle-based,
> matching this description) and Living Path itself is font-only, with the raster engine
> reorganised into the collapsible category stack described in §7 below. §7's "Distort &
> Deform" subsection is current. A full rewrite of §2–§6 is pending — see `CLAUDE.md` for the
> up-to-date session-by-session record in the meantime.

| | **Vector** | **Raster · LivingPath** |
|---|---|---|
| Works on | the Bézier **nodes** directly | a **rasterised** glyph → re-vectorised |
| Changes topology? | no (an A stays an A, edges move) | **yes** — strokes merge, holes open, cells grow |
| Best for | clean roughening / distortion | the signature melted / cellular / flooded looks |
| Speed | instant | fast (debounced), heavier effects slower |

**Why Vector only touches the outline:** a vector shape *is* its contours — a
boundary representation with no interior data, so the only thing you can move is
the edge (you can't open a hole without inventing a new contour). Raster holds a
2D field where every point inside the letter is real data — hence merging,
holes and textures.

**Chaining (⇄ vector → raster):** in Raster mode a toggle in the top bar feeds
the Vector stack's output into the rasteriser:

```
glyph → [Vector effects on nodes] → rasterise → [Raster effects] → re-vectorise
```

So you can twist/wobble precisely on the nodes and *then* melt the result. The
two stacks stay independent; with an empty Vector stack the toggle is a no-op.
It applies to the preview, the specimen and the font export (the Vector stage is
pre-computed per variant and shipped to the worker).

The **key insight**: node displacement can only nudge existing points. The
LivingPath aesthetic needs the raster pipeline:

```
glyph → rasterise (canvas) → pixel algorithms → re-vectorise
        (marching squares + contour stitching + Laplacian smoothing) → SVG
```

---

## 3. Input

Three sources (left panel tabs), and you can **drop a font or SVG anywhere** on the
page — it auto-selects the right tab.

- **Font** — OTF / TTF / **WOFF** (WOFF2 is not supported by opentype.js; you get a
  clear message). Type 1–12 glyphs in the Text field to preview. Enables **font export**.
- **SVG** — any `<path>` / shapes; parsed to Bézier nodes via the browser's own
  geometry (works on every shape type).
- **Genesis** — the 8 primordial Organica forms.

---

## 4. Vector effects

Node-level effects (run top→bottom): **Noise (jitter)**, **Wobble (sine)**,
**Inflate / Erode**, **Roughen**, **Organic smooth**, **Twist (radial)**,
**Scatter (explode)**.

Presets: `Type-safe` (gentle, for text) · `Eroded` · `Liquid` · `Vortex` · `Shatter`.

---

## 5. Raster engine — algorithms

Nine pixel algorithms, ported from the original's layers:

- **Dilate / Erode** — morphological thicken / thin.
- **Blur (flood)** — spread; with Threshold, merges strokes into bulbs.
- **Threshold (melt)** — re-binarise; the melt/flood control.
- **Noise** — value-noise perturbation of the field.
- **Particles** — disks seeded on the ink. *Keep body* on = nodules on the glyph;
  off = disks only (for subtract groups).
- **Center-line (skeleton)** — Zhang–Suen thinning to a 1px skeleton, then dilated
  to a constant-width hand-drawn stream stroke.
- **Polygonize (facet)** — block-quantises the field into chunky regions (pair with
  a faceted preset for angular, low-smoothing contours).
- **Seam carve** — content-aware min-energy seam removal; pinches / slices the glyph
  (vertical or horizontal).
- **Reaction-diffusion** — Gray-Scott, seeded with spots inside the glyph and
  confined to its mask, so a coral/cellular pattern grows and carves cells into the
  letter. Controls: Feed, Kill, Steps, **Depth** (carve amount), Seed.

### Groups + blend modes  *(the compositing model)*

The right panel organises layers into **groups**. Each group processes the source
glyph **independently**; groups are then composited with a **blend mode**:

`union · multiply · subtract · xor · add · screen`

This is what a flat stack can't do: overlap an **outline/body group** with a
**texture group**. Example — the **Frog-eggs** look = a solid body group **minus** a
sparse *particles (disks-only)* group → cellular holes ("roe"). Use **+ new group
(overlap)** to add one; the first group is the base (blend N/A).

---

## 6. Presets (raster)

24 presets, most mapped 1:1 to Ivan Murit's production example sheets:

| Family | Presets |
|---|---|
| Melted / flooded | `Avulsion` · `Flood` · `Bulbs` · `Gridouille` |
| Cellular (cahn) | `Coral` · `Cahn cells` · `Cahn bold` |
| Beaded / dotted | `Frog-eggs` · `Beaded` · `Dotty bold` · `Dotty light` |
| Line / thin | `Stream` · `Thin line` · `Dilated` |
| Grain / pixel | `Grain` · `Pixel dust` · `Rough bold` |
| Particles | `Bubbles` · `Exploded` |
| Faceted | `Faceted` · `Low-poly` |
| Seam-carved | `Sin-out` · `Sin-vert` |

Presets can auto-enable **Outline mode** (cellular / beaded looks read best stroked)
and set the contour smoothing (faceted presets go angular).

---

## 7. The type tester (the canvas)

The stage **is** a type tester, modelled on a foundry specimen page. On boot it
auto-loads **Archivo Black** (`shared/vendor/archivo-black.ttf`, SIL OFL) so it's never empty; the
floatbar **+** or a drop swaps in any OTF/TTF/WOFF. The specimen is one **editable**
paragraph rendered through the effect stack — click it and type (a transparent
`contenteditable` overlay sits on the SVG for the caret; the transformed SVG is what
you see). Text word-wraps and **clips at the panel's bottom edge** — no scroll.
With no effect active the stage shows the **untouched font** (its own Béziers,
crisp corners); any effect switches to the raster pipeline, RESET on the stack
returns to raw. Four **XS rounded-square icon buttons** near the stage (droplet /
path / branch / burst) swap between four short project-themed phrases that
together spell the whole alphabet; typing your own text clears the selection.
Zoom with the **mouse wheel** or **⌘/Ctrl +/−/0**, drag to pan when zoomed,
double-click to reset.

The header carries **no status line**. When work runs **longer than ~250 ms**
(`PROC_GRACE`) the stage goes into a **processing state**: a grey-out over the
specimen, a centred **message pill** (`applying effects…`, `building family…
n/total`, `exporting glyphs i/n…`), and a **5 px solid loading bar** on the **top
and bottom edge of the canvas** (`#board`, positioned by `syncProcLine()`) that
sweeps left→right once (~0.55 s) then holds solid until the work finishes.
Quicker work shows **nothing** — an identity render is instant; async jobs
(family build, OTF export) get a real grace timer that's cancelled if they
finish first; a blocking tester render can't be timed mid-flight, so it's
predicted "slow" from the previous heavy render's duration (the first slow one
is silent, repeats get the bar). One-shot results / errors (`✓` / `✗`) show as a
separate transient pill at the top of the stage.

The **floatbar** carries the tester controls (visible only with a font loaded and
not in Full Family View):

- **SIZE** — the specimen type size (slider + editable readout; click the number to type it).
- **TRACK** — tracking / letter-spacing, per-mille of size.
- **align L / C / R** — line alignment.
- **CAPS** — uppercase the text before layout.

Next to them, the **invert** button (half-circle icon, always visible — works in
Full Family View too) swaps the real **Ink ↔ Paper** swatches, flipping the
on-canvas preview *and* every PNG / SVG / OTF export (and the right-panel Colour
rows). Ink / Paper themselves are set in the right panel (**Colour**); the
floatbar **↻** resets the effect stack.

**Full Family View** (grid icon in the floatbar) is the one secondary view — a **Fontra-style font overview**:
the whole font (up to 1000 glyphs, space included) as a **scrollable** grid of boxed
cells, each glyph drawn on a shared per-row **baseline** at its true em-relative size
(`x` short, `H` tall, `g`/`p` descenders hang below), captioned with its **glyph name +
`U+XXXX`**. Every cell runs through the current effect stack — the first build shows a
`building family… n/total` counter, then a resize or a re-open is instant (per-glyph
geometry is cached). The tester bar, overlay and phrase dots hide while it's active, and
the stage **scrolls** instead of zooming. Exporting SVG/PNG in this view produces the
overview as a **specimen sheet** (boxes + names + glyphs), sized to the grid.

Each cell **hovers** (a `--tool` accent wash) — **click one → the single-glyph view**, which
opens straight into the **glyph outline editor** (`Organica.glyphEditor` on
`shared/glyph-model.js`'s canonical contours — Phase 1 of the variable-font arc). Drag nodes
(gaussian soft-drag, corners held crisp), **Alt-click / `+ pt`** to insert, **Backspace**
delete, **arrows** nudge (Shift ×10), **Enter** toggle corner, drag the advance line. The
in-stage bar has **Undo · Reset glyph · + pt** and a **Preview** toggle (that char fit to the
canvas through the effect stack — the old `typedLayout`). The small top-centre field types
which glyph to edit. **Edits flow through `glyphSubs`** — the edited outline is what the
effect stack runs on in the tester, Full Family, and both OTF exports — and persist in the
`.lvp` (**v5**, an `edits` map keyed by glyph name). The **Full Family** button returns to the
grid; **Esc** returns to the type-tester.

**Editing with effects — baked.** With an active effect stack, opening the editor **bakes**
the current effect result (`processGlyphEm`) into the glyph and edits *that* — so **Edit and
Preview show the same shape**. `processGlyphEm` then skips re-applying the stack for a baked
glyph (no double effects), and the Worker OTF export passes it straight through. A baked
glyph is **frozen**: changing the effect stack afterward doesn't re-flow into it —
**Reset glyph** discards the node edits and re-bakes the untouched glyph through the *current*
stack. An identity stack → the editor opens the raw outline (still effect-responsive).

### Variable · Masters (Phase 2)

The right panel's **Variable · Masters** section (visible once a font is loaded) turns Living Path
into a small design-space editor:

- **Axes** — `+ Axis` opens a compact tag / name / min / def / max form; each axis lists with a
  `×` to remove.
- **Location** — one slider per axis (user units). Moving it sets the model's design-space
  location; the tester, Full Family and both OTF exports all re-render the **current instance**.
- **Masters** — `+ Master here` snapshots the current location as a new master (named by its
  coordinates). A radio picks the **edit target**; `×` removes a non-base master.
- Open the **glyph editor** while sitting exactly on a master's location → you edit that master's
  outline. Sitting *between* masters → the editor shows the interpolated instance **read-only**.
- **Bake stack → master** — runs the live effect stack over every glyph and freezes the result
  into the selected master (`model.bakePresetMaster`; contour topology is re-projected onto the
  base point structure so interpolation stays valid — glyphs whose topology the effect changed
  are skipped, reported in the toast).
- A **⚠ compatibility** strip appears in the editor when a glyph's masters diverge in point
  structure — that glyph falls back to the nearest master instead of interpolating.

Everything persists in the `.lvp` (**v5** `variable` block — axes, per-master location + edits,
the last design-space location). An old v4 file, or a v5 with no `variable`, clears the model.

### UFO + designspace export (Phase 3)

Once there's an axis and a second master, the **export popover** shows **⬇ UFO + designspace
(.zip)** — `Organica.ufoExport.bundle(model, {familyName})` writes a `<family>.designspace` + one
UFO v3 directory per master (canonical contours → cubic `<point>`s via the same Catmull-Rom
formula as the OTF export, so every master shares point structure), `Organica.zip()` packs it
STORE-only, and it downloads as `<family>-ufo.zip`. Compile the variable binary outside:

```
fontmake -m <family>.designspace -o variable
```

The model's real vertical metrics (`ascender` / `descender` / `xHeight` / `capHeight` from the
loaded font's `OS/2`) go into each `fontinfo.plist`.

### Distort & Deform — the vector engine (2026-09)

The right panel's **Transform** section and the Effect stack's **Vector** half (below the
"Vector · instant" divider — **Distort · Deform · Break**) are a second, independent engine
alongside the raster Texture/Mass/Fracture/Warp/Structure/Reaction categories above the
divider — built to match [typoclast.com](https://typoclast.com)'s instant point-space
distortion dynamics.

- **Transform** — Rotate / Slant / Stretch X / Stretch Y, a per-glyph affine applied last (not
  a stack layer). Always instant.
- **Distort** — Twist · Pinch · Bulge · Wave · Ripple (radial) · Perspective · Wind · Curl · Flip.
- **Deform** — Jitter (noise) · Wobble (sine) · Inflate/Erode · Roughen · Organic smooth ·
  Sharpen · Noise (field) · Crush · Pull.
- **Break** — Scatter (explode) · Echo · Polygonize · Pixelate · Slice · Spikes · Vector griddler.
- **Groviera** (a raster effect, in **Texture**) — a one-slider wrapper on the raster engine's
  existing particle-punch, not a new algorithm.

**Why it's instant, unlike the raster stack above the divider:** every vector effect nudges a
glyph's own anchor points directly (`shared/pathfx.js`'s `FX` registry — the module Sinew has
always used) — no rasterize → pixel algorithm → marching-squares retrace round-trip. A stack
with only Distort/Deform/Break/Transform active renders **synchronously on every slider drag**,
no debounce, no processing overlay; a raster effect (alone or stacked with vector) still uses
the existing async/`Worker`-backed path, since that part is genuinely expensive. **The two
halves stack freely** — twist a glyph, then let a raster preset melt the twisted result — and
both flow into the tester, Full Family, `.lvp` (**v6** — adds a `vectorGroups` block; a v5/v4
file loads with the vector stack at rest, identity), and both OTF export paths (Worker and the
main-thread fallback) identically. A **vector-only** export skips the raster Worker's rasterize
pass entirely for that glyph — no lossy round-trip on a purely geometric distortion.

Ink / Paper colours are in the right panel (**Colour**).

### Filter-by-filter realignment against typoclast (2026-09)

A follow-up pass drove typoclast.com and Living Path side by side (same font, Archivo Black)
and tuned every shared-named effect to match typoclast's actual behaviour family, not just its
name — most of the 19 new effects above needed real math changes, not just exposure:

- **twist → shear**, **pinch → saddle squeeze+grow**, **bulge → angular-harmonic petals**,
  **pull → squircle** (dropped its `angle` param), **wave/ripple → angular-harmonic** (radial
  lobes, not spatial sine), **refraction → continuous sine**, **sharpen → decimate-to-facets**,
  **flip → circularize blend**, **crush → sharp-square blend**, **curl → radial spiral**,
  **spikesvec/groviera → real-corner targeting** (`findCorners`, a genuine direction-change
  threshold — not every-Nth-point) — the full list and reasoning is in `CLAUDE.md`'s Sep 2026
  session notes.
- **`echo`** was a near-invisible duplicate-copy pinch (max ~25-unit displacement on a
  700-unit glyph, and a **complete no-op** on low-point-count glyphs like Archivo Black's
  straight-line `A`, 9 points, below its own `n < count*3` guard). Rewritten as a real
  centroid-pull pinch at each segment seam, guard lowered to `n<6`, pull strength and window
  widened — now moves points 200+ units and never silently no-ops.
- **`groviera`** (moved from raster → vector, a real corner-bite notch via `findCorners`) read
  as only a faint rounding of each corner at first (`bite = R*0.05*amount`) — strengthened to
  `R*0.16*amount` so it reads as a genuine cut/notch at each real vertex, not a subtle chamfer.
- **`griddler`** (moved from vector → raster) is a real grid-clip: `griddlerField` zeroes the
  raster field along an N×N grid of gutter bands so marching-squares re-traces true axis-aligned
  gaps through the solid body — typoclast's own "vector griddler" turned out to be exactly this
  (a real cut with visible gutters), not a mesh warp; doing it as a genuine polygon clip would
  need a clipping-library dependency this project doesn't have, so it reuses the raster
  round-trip already in the pipeline instead.
- **`inflate`** gained **Ripple** + **Lobes** params — typoclast's inflate is a high-frequency
  petal ripple on both contours (outer bulge and inner counter alike), not a uniform push; the
  base `Distance` push is now modulated by `1 + ripple·cos(lobes·θ)` around the glyph's own
  centre, so outer and inner contours ripple in register like real petals. Backward-compatible
  defaults (`ripple:40, lobes:6`) keep the effect visible without requiring a slider touch.
- `perspective`/`wind` were retuned earlier in the same pass (see CLAUDE.md) for scale
  mismatches that either collapsed or barely moved the glyph.

Verified: a combined vector(echo)+raster(griddler) stack round-trips through the Worker OTF
export path and re-parses as a valid, installable font; Sinew's shared `FX`/`RFX` registries
regression-checked clean (engine counts, groviera in `FX`, griddler in `RFX`).

---

## 8. Export

Top bar: **SVG · PNG** (WYSIWYG of the current preview).

Font panel (font input only):
- **⬇ Export modified font (OTF)** — runs the **whole alphabet** through the active
  stack in each glyph's own em space (advance widths, unitsPerEm, ascender/descender
  preserved), re-vectorises, and rebuilds an **installable OTF**.
  - **Font name** — family name of the export.
  - **Include** — charset chips: `A–Z` / `a–z` / `0–9` / punctuation / accents.
  - **Randomised alternates (rand)** — bakes the "human touch" into the font:
    3 seed-variants per glyph are exported as alternates behind the OpenType
    `rand` (auto-randomise) + `aalt` (access-all) features, so repeated letters
    differ in apps that honour `rand` (macOS CoreText / Pages / TextEdit; in CSS
    use `font-feature-settings:"rand"`). Only kicks in when the stack uses a
    seeded effect (noise / particles / reaction / jitter / roughen / scatter).
  - **HTML specimen** — optionally also save a self-contained specimen page
    (base64 `@font-face` + type sample).
- **Save / Load .lvp** — save the whole setup (technique, groups, blend modes,
  colours, name) as a small JSON `.lvp` file and reload it later.

**Web Worker:** raster font export runs the per-glyph pipeline in a Web Worker
(OffscreenCanvas), off the main thread — the **full charset** (900+ glyphs incl.
accents) exports in a couple of seconds without freezing the UI, progress streaming
live. Vector export stays on the main thread (it's cheap). Falls back to the main
thread if Worker/OffscreenCanvas isn't available.

---

## 9. A typical workflow

1. It opens on **Archivo Black** — or **drop a font** anywhere to swap it.
2. Pick a preset (e.g. `Frog-eggs`, `Coral`, `Stream`) and tune the effect stack.
3. Type on the tester and dial in **SIZE / TRACK / align / CAPS**; ◐ for a dark specimen.
4. Name it, tick **HTML specimen** if you want one, and **Export OTF**.
5. **Save .lvp** to keep the setup (specimen text + tester settings included). Install the
   OTF and "let it flood your work".

---

## 10. Tips & gotchas

- **A glyph disappears in a subtract group?** The subtracted group must output *only*
  the texture — e.g. Particles with **Keep body off**. Otherwise it subtracts the
  whole glyph.
- **Reaction-diffusion too sparse / too eaten?** Raise **Steps** and **Depth**;
  Feed ≈ 55, Kill ≈ 62 gives a labyrinth. It's confined to the glyph, so it always
  stays readable.
- **Cells / beads look right only when stroked** — those presets auto-enable Outline;
  toggle it if you switch away.
- **Export is slow with heavy presets** — reaction-diffusion over the whole charset
  is the heaviest; the worker keeps the UI alive, just wait for the progress.
- **WOFF2 fonts** aren't supported — convert to TTF/OTF/WOFF.

---

## 11. Architecture notes

- **Pipeline** (raster): `rasterize()` → `rasterFieldFromGroups()` (each group from the
  source, composited via `blendField()`) → `contours()` (marching squares + segment
  stitching) → `smoothPoly()` (Laplacian, `CONTOUR_SMOOTH`) → `dFromSubs()` (Catmull-Rom
  → cubic).
- **Shared appliers** (`rasterFieldFromGroups` / `applyVectorGroups`) are used by BOTH
  the live preview and the font export, so what you see is what you export.
- **One scale everywhere (WYSIWYG).** Effect params are absolute numbers, so they only
  mean the same thing if the glyph is always at the same scale. Every path — the board
  preview, the text specimen and the font export — normalises each glyph into the **same
  1000-box** (`normGlyph` / `denormGlyph`, glyph ≈ 760 tall, y-flipped) and runs the
  identical pipeline, so what you see is what you export. `processGlyphEm` is the single
  per-glyph entry point. The tester's **SIZE / TRACK / align / CAPS** only *place* glyph
  subs that `buildSpecimenSubs()` has already 1000-box-normalised via `processGlyphEm` (a
  post-normalisation `scale` multiply + per-line X offset), so effect strength stays
  identical preview-vs-export.
- **Font export** builds each glyph via that shared pipeline; the **Web Worker** reuses
  the exact same pure field functions via `Function.toString()` (no code drift) — only
  rasterisation (OffscreenCanvas) and a layer dispatch are worker-specific. The worker
  receives glyphs already normalised into the 1000-box and returns 1000-box contours that
  the main thread maps back to em units.
- **Project files** (`.lvp`) are plain JSON of the state — portable and diff-able.
- Open follow-ups: `docs/ROADMAP.md`.

---

## 12. Development notes & context

Things that aren't obvious from the code but matter when working on this tool:

- **Dev-server caching.** The static preview server / browser aggressively caches
  `livingpath/index.html`. After an edit, a plain reload often serves the **old** file —
  do a hard refresh (⌘⇧R) or append a cache-buster (`?v=…`) to the URL when testing, or
  you'll chase phantom bugs. (This bit us twice during development.)
- **`hidden` doesn't work on every element.** `<svg>` (`SVGElement`) has no `hidden` IDL
  property, and a CSS `display:flex/grid/block` beats the UA `[hidden]{display:none}`
  rule. So toggling `el.hidden` can silently do nothing. Toggle an explicit class
  (e.g. `.show`) or add `[hidden]{display:none}` with enough specificity. Both variants
  caused real bugs here.
- **Scale is the source of "preview ≠ export" bugs.** Any new effect must respect the
  shared 1000-box scale (see §11). If the preview and the exported font ever look
  different, it's almost always because something processed the glyph at a different
  size. To get a *heavier* melt, push the effect params (e.g. blur ~13, dilate ~6, not
  blur 2) — the preview now honestly reflects the font, so it won't over-melt for you.
- **Verify visibility, not just the attribute.** When testing show/hide, check
  `getComputedStyle(el).display` (and bounding box), not `el.hidden` — a stale attribute
  passed tests while the element was still visible on screen.
- **Reaction-diffusion is the slow effect.** ~90 ms/glyph vs ~1–2 ms for the others; it's
  why the worker matters for full-charset export. It's confined to the glyph mask and
  seeded with random spots, so it fills the letter with cells (Feed ≈ 55 / Kill ≈ 62).
- **Files deliberately kept out of git (historical note):** `backend/fitCurves.py` and
  `backend/output/` no longer exist (`backend/` was removed with Strata, Aug 26, 2026);
  `design_handoff_genesis_creator/` was deleted Aug 27, 2026 as an obsolete local scratch
  directory (never tracked in git, so nothing to remove from history).
- **Open across the wider project (not Living Path):** the **Genesis Creator Bézier
  tangent-handle drag/edit** is still to verify/fix — flagged since the start and never
  closed. See the Genesis backlog in `docs/ROADMAP.md`.

---

*Studio Rann · Organica System v0.1*
