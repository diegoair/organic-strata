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

## 7. Preview controls (stage top-right)

- **text specimen** — lay out a full paragraph rendered with the **modified font**,
  live (font input only). This is the original's right-hand preview. A **language**
  selector (10 languages) + **↻ text** button pull a live random Wikipedia extract
  (offline-safe curated fallback); the text word-wraps to the board.
- **overlay original** — ghost of the source glyph behind the result.
- **outline** — stroke the re-vectorised contour instead of filling (beaded / engraved).
- **nodes** — show the Bézier anchors (vector only).

Ink / Paper colours are in the left panel.

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

1. **Drop a font** anywhere on the page.
2. Switch to **Raster**, pick a preset (e.g. `Frog-eggs`, `Coral`, `Stream`).
3. Open the groups and tune the sliders — or add a **new group** and blend it in.
4. Turn on **text specimen** to see a paragraph in the modified font, live.
5. Name it, choose the **charset**, tick **HTML specimen**, and **Export OTF**.
6. **Save .lvp** to keep the setup. Install the OTF and "let it flood your work".

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
  per-glyph entry point (vector or raster + chaining); the board's typed text is laid out
  **per glyph** via `typedLayout` (not flattened), matching the specimen and the font.
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
- **Files deliberately kept out of git:** `backend/fitCurves.py`, `backend/output/`
  (debug images), `design_handoff_genesis_creator/` (has a `.DS_Store`).
- **Open across the wider project (not Living Path):** the **Genesis Creator Bézier
  tangent-handle drag/edit** is still to verify/fix — flagged since the start and never
  closed. See the Genesis backlog in `docs/ROADMAP.md`.

---

*Studio Rann · Organica System v0.1*
