# Pollen — User Manual

> Studio Rann · Organica · Advanced Stippling
> Live: [theorganicalanguage.vercel.app/pollen/](https://theorganicalanguage.vercel.app/pollen/)
> Last updated: June 12, 2026

---

## 1. What Pollen does

Pollen turns an image into a **stippled field of symbols**. Each point is one of
the Organica primordial forms (drop, line, circle, lung…), placed so that **dark
areas are dense and bright areas are sparse**. The result is a vector-first,
scale-agnostic translation of a photo into the Organica mark vocabulary — ready
for print, screen, or mural.

It is a single-file vanilla HTML/CSS/JS tool. No build step, no framework.

---

## 2. The engine — variable-radius blue noise

Pollen places points with a **variable-radius Poisson-disk** algorithm
(a "blue-noise" distribution — even, never gridded, never clumped):

```
spacing(x, y) = lerp(SpacingMin, SpacingMax, brightness(x, y)) × SpacingScale
   dark pixel  → small spacing → points close together → dense
   bright pixel → large spacing → points far apart      → sparse
```

- Points are thrown down over several **Phases** (passes). Each phase adds more
  candidate points; a spatial grid rejects any that fall too close to an existing
  point. More phases = a more complete, even fill.
- Placement runs on a **downscaled working image** (longest side ≈ 1000 px) so the
  preview stays responsive. The preview is capped (~70 000 points).
- **Brightness** is read after the image pipeline (Rotation → Flip → Invert →
  Gamma → Contrast), so those controls reshape *where* points land.

### Placement vs. Appearance — the key mental model

Two kinds of controls:

| Type | What it changes | When it applies |
|---|---|---|
| **Placement** | *where* the points are | recompute (now **live**, debounced) |
| **Appearance** | *how* each point looks | **live** (instant re-render) |

- **Placement:** Spacing, Spacing ×, Phases, Gamma, Contrast, Hide Zone, Invert,
  Rotation, Flip. These need the blue-noise to be recomputed — **Pollen now does
  it automatically** ~300 ms after you stop moving a control, showing a
  **"Recomputing…" overlay** on the image. A new change cancels an in-flight run.
  The **↻ Refresh** button is still there for a manual recompute.
- **Appearance (live):** Symbol(s), Size/Scale/Width/Length, Angle, Colour,
  Overpaint, Antialiasing. These restyle the *existing* points instantly.

---

## 3. Controls, section by section

### Top bar
- **Open** — load an image (or drag-drop onto the canvas, or click the ⊕ circle).
- **↻ Refresh** — recompute placement manually (bold = pending changes).
- **Stop** — interrupt a long computation.
- **Status** — "1,475 points placed", "Recomputing…", etc.
- **Export Scale** — ×1 / ×2 / ×3 raster multiplier, with the output pixel size
  next to it.
- **PNG · JPG · SVG · → Figma** — exports.

### Presets
A saved snapshot of *the whole look* — including symbol(s), sizing, colour mode,
RMX palette + mapping, RMX shapes, and placement.
- **Select / Save / Delete** — built-ins + user presets (browser `localStorage`).

### Symbols  *(live · 400 %)*
The symbol picker — shared, identical component with Spore.
- **400 % preview** — large zoom of the current symbol(s); reflects size, colour
  and the RMX mix live.
- **Shape · primordial forms** — 8 curated Genesis forms, each with its reference
  number (top-right):
  `7 drop · 56 line · 1 circle · 2 teardrop · 14 petal · 33 seed · 38 spiral ·
  31 lung`.
- **~ Stroke** — a procedural **Line** symbol (first tile), see §5.
- **+ Upload SVG** — add your own SVG as a custom symbol.
- **RMX · remix by tone** — distribute points across **up to 3 symbols**, assigned
  by brightness (see §4).
- **Size** + **Range** — base marker size; Range varies size by brightness.
- **Scale** — global size multiplier (×) on top of Size.
- **Width** / **Length** — non-uniform stretch on the symbol's *local* X / Y axes
  (e.g. elongate a line). A rotated symbol stretches along its own direction.
- **Angle** + **Range** + **Random** — base rotation; Range by brightness; Random
  scatters per-point.
- **Flow (follow image)** — orient each mark to the local image gradient (isophote),
  so directional symbols follow the contours. Works on any shape (visible on
  directional ones; on the Stroke it drives the streamline, see §5).

> Symbols are sized and centred on their **real content bounding box** (not the
> 200×200 viewBox), and stroke-based forms (line) get a minimum stroke width, so
> every symbol renders at the intended size — including thin / outline ones.

### Color
- **Mode — Solid / Adaptive / RMX**
  - *Solid:* one Point colour for all marks.
  - *Adaptive (duotone):* each mark is interpolated **Point → BG** by its
    brightness — a two-tone gradient onto the image tones.
  - *RMX:* a **palette of up to 5 colours** mapped onto the image — a gradient map
    (see §4). The single Point control is hidden in this mode (the palette
    replaces it).
- **Point / BG** — swatch + hex + 🎲 random (Point hidden in RMX).
- **Alpha** — point opacity (0–255).
- **Swap colors** — exchange Point and BG (hidden in RMX).

### Render  *(live)*
- **Overpaint (additive)** — overlapping marks darken (multiply) for inky density.
- **Antialiasing** — smooth mark edges.
- **Light dropout** — randomly **thins marks in the bright areas** (probability
  rises toward white; darks stay full). The organic "dirty" thinning of the
  lights — works on every shape. Decorrelated from the size/angle/colour random,
  WYSIWYG. Pair with Spacing (uniform density) for the natural look.

### Image & Stippling  *(live — debounced recompute)*
**Image** (reshape the source before sampling):
- **Rotation** — 0 / 90 / 180 / 270°.
- **Flip horizontal** · **Invert** (negative).
- **Gamma** — midtone bias. **Contrast** — push tones toward black/white.

**Stippling field:**
- **Spacing (min ↔ max)** — the density range (dark→min, bright→max).
- **Spacing ×** — master multiplier: scales min+max together, **keeping their
  ratio**. One knob for "denser / sparser" overall (↑ = sparser, ↓ = denser).
- **Phases** — placement passes (higher = fuller fill).
- **Hide Zone (min ↔ max)** — suppress points in a brightness band (e.g. clear the
  brightest highlights).
- **Points** — read-out of the current point count.

---

## 4. RMX — Remix (the creative layer)

RMX doesn't change *where* points go (the blue-noise stays) — it changes *what*
each point is. Two independent remixers, both **tone-driven** and deterministic
(→ WYSIWYG export):

### RMX shapes (Symbols section)
Pick up to **3 symbols**; each point gets one assigned by **tone** with smooth,
overlapping triangular weights — shadows get symbol 1, mids symbol 2, highlights
symbol 3, with gradual crossfades (no hard banding). Conceptually a "blue-noise
ASCII": the alphabet is organic symbols, the placement is organic.

### RMX colours (Color section, mode RMX)
A palette of up to 5 colours with four **Mappings**:
- **Tone (gradient)** — colours interpolated across brightness (a gradient map).
- **Posterize** — same, but hard bands (silkscreen / poster look).
- **Random** — each point picks a palette colour at random (confetti).
- **Tone + Random** — tone chooses the zone, random varies among nearby colours.

RMX shapes and RMX colours combine — forms *and* colours following tone together.

---

## 5. The Stroke — hatching / engraving lines

The first symbol (**~ Stroke**) is a procedural **Line** (Pointillist-style),
not a Genesis form. Its controls appear only when it's selected:

- **Style — / ✳** — single line, or a 3-armed star (the same curve crossed).
- **Size** = the line **thickness**. · **Length** = its length in px.
- **Segments** — smoothness of the curve. · **Warping** — hand-jitter / wobble.
- **Rounded** — round vs. flat caps.

### Streamline behaviour (the key idea)
When an image is loaded, the **— line** is a **streamline**: every segment
re-samples the image's local **angle field** and bends with it, so strokes curve
*through* the image — they accumulate and overlap in the shadows and thin out into
the lights. Two registers:

- **Angle · Range 0→360** → vortex / hooks that wrap tonal blobs (engraving look).
- **Flow (follow image)** → strokes follow the contours — plumage / fur / hatching.

Even with **Warping 0** the lines curve (that's the field doing it); Warping adds
hand-tremor on top. The 400 % preview shows a real mini-stipple of a test blob, so
it predicts the render. The ✳ star and the no-image case fall back to a fixed
smooth arc. Everything stays WYSIWYG (the SVG export integrates the same field).

> Pair the Stroke with **Light dropout** (Render) for the natural random thinning
> of the lights — see the **Hatch Flow** and **Hatch Swirl** presets.

---

## 6. A typical workflow

1. **Open** an image.
2. Tune **Image** (Invert / Gamma / Contrast) and the **Stippling field**
   (Spacing, Spacing ×, Phases) — the canvas recomputes live.
3. Pick a **Symbol** (or enable **RMX** and pick up to 3); set **Size / Scale**,
   and **Width/Length** to stretch. For a hatching look, pick the **~ Stroke**
   and turn on **Flow** (or start from the **Hatch Flow / Hatch Swirl** presets).
4. Choose **Colour** — Solid, Adaptive, or **RMX** palette + mapping.
5. Tune **Light dropout** (Render) to thin the lights organically.
6. (Optional) **Save** a preset — it captures everything (RMX, Stroke, dropout…).
7. **Export** — set **Export Scale**, then SVG (vector/mural) or PNG/JPG.

---

## 7. Tips & gotchas

- **Canvas flickers "Recomputing…"** — normal: a placement control changed and the
  blue-noise is rebuilding (debounced). On huge images this can take a moment.
- **A symbol looks empty?** Increase **Size / Scale**; thin forms (line) read
  better a little larger. All 8 primordials render (bbox + stroke-min fix).
- **Too dense / muddy?** Raise **Spacing ×**, lower Phases, or reduce Size /
  Overpaint.
- **Highlights too busy?** Use **Hide Zone** to clear the brightest band.
- **Export = preview.** It's WYSIWYG (exact points; SVG is resolution-independent,
  raster honours Export Scale).

---

## 8. Architecture notes

- **Symbols** come from the centralized Genesis library
  (`/genesis/organic-forms.js` → `window.ORGANIC_FORMS`), filtered to the
  primordial subset `[7, 56, 1, 2, 14, 33, 38, 31]`. The same picker component is
  used in **Spore**.
- `pointType` is `g:<n>` (Genesis form), `u:<id>` (uploaded SVG), or `stroke`.
- Forms are measured by content bbox (`formBBox`, hidden-SVG `getBBox`, cached);
  stroke width floored to ~1.1 device px. Non-uniform Width/Length scale the local
  axes; export mirrors both.
- RMX is a per-point function of `(brightness, stableRandom)` → identical in
  preview and export. `pickShape()` picks the form; `pointRGBA()` the colour.
- The **Stroke streamline** uses the brightness field kept from the last compute
  (`fieldB`); `makeFieldAngle()` gives the per-position angle and `fieldStrokePts()`
  integrates the line through it (forward + backward from the point). **Light
  dropout** (`dropoutSkip()`) is a per-point skip biased by brightness. Both are
  deterministic → canvas, 400 % preview and SVG export agree.
- Open follow-ups: `docs/ROADMAP.md`.

---

*Studio Rann · Organica System v0.1*
