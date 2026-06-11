# Pollen — User Manual

> Studio Rann · Organica · Advanced Stippling
> Live: [theorganicalanguage.vercel.app/pollen/](https://theorganicalanguage.vercel.app/pollen/)
> Last updated: June 9, 2026

---

## 1. What Pollen does

Pollen turns an image into a **stippled field of symbols**. Each point is one of
the Organica primordial forms (drop, line, circle, leaf…), placed so that **dark
areas are dense and bright areas are sparse**. The result is a vector-first,
scale-agnostic translation of a photo into the Organica mark vocabulary — ready
for print, screen, or mural.

It is a single-file vanilla HTML/CSS/JS tool. No build step, no framework.

---

## 2. The engine — variable-radius blue noise

Pollen places points with a **variable-radius Poisson-disk** algorithm
(a "blue-noise" distribution — even, never gridded, never clumped):

```
spacing(x, y) = lerp(SpacingMin, SpacingMax, brightness(x, y))
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

Two kinds of controls, deliberately separated in the UI:

| Type | What it changes | When it applies |
|---|---|---|
| **Placement** | *where* the points are | needs **↻ Refresh** (recompute) |
| **Appearance** | *how* each point looks | **live** (instant re-render) |

- **Placement (↻):** Spacing, Phases, Gamma, Contrast, Hide Zone, Invert,
  Rotation, Flip. Changing one marks the field "dirty" — the ↻ button highlights
  and the status reads *"Needs refresh ↻"*. Click ↻ to recompute.
- **Appearance (live):** Symbol shape, Size, Angle, Color, Overpaint,
  Antialiasing. These restyle the *existing* points with no recompute.

This is why moving, say, **Spacing** doesn't change the canvas until you press ↻ —
by design. Color or Size change instantly.

---

## 3. The right column — controls, section by section

### Top toolbar
- **Open** — load an image (or drag-drop onto the canvas, or click the ⊕ circle).
- **↻ Refresh** — recompute the point placement (bold = pending changes).
- **Stop** — interrupt a long computation.
- **Status** — "1,475 points placed", "Needs refresh ↻", etc.
- **PNG · JPG · SVG · Figma** — export buttons.

### Presets
A preset is a saved snapshot of the controls.
- **Select** — apply a built-in or saved preset.
- **Save** — store the current settings (persists in browser `localStorage`).
- **Delete** — remove a saved preset.

### Symbols  *(live · 400 %)*
The symbol picker — shared, identical component with Spore.
- **400 % preview** — large zoom of the selected symbol (centre + ring), reflects
  Size and Color live.
- **Shape · primordial forms** — 13 curated Genesis forms, each with its
  reference number (top-right) for fine-tuning:
  `7 drop · 56 line · 1 circle · 2 teardrop · 40 ring · 12 leaf · 14 petal ·
  33 seed · 38 spiral · 36 crescent · 44 dew · 30 iris · 45 mushroom`.
- **+ Upload SVG** — add your own SVG as a custom symbol.
- **Size** + **Range** — base marker size; Range varies size by brightness.
- **Angle** + **Range** + **Random** — base rotation; Range varies by brightness;
  Random scatters per-point.

> Symbols are sized and centred on their **real content bounding box** (not the
> 200×200 viewBox), and stroke-based forms (line, ring) get a minimum stroke
> width, so every symbol renders at the intended size — including the thin /
> outline ones.

### Color
- **Mode — Solid / Adaptive**
  - *Solid:* every point uses the Point colour.
  - *Adaptive (duotone):* each point is interpolated between **Point** (dark) and
    **BG** (bright) by its local brightness — a two-tone gradient mapped onto the
    image tones.
- **Point** — swatch + hex field (click swatch for the native picker) + 🎲 random.
- **BG** — background colour, same controls.
- **Alpha** — Point opacity (0–255).
- **Swap colors** — exchange Point and BG.

### Render  *(live)*
- **Overpaint (additive)** — overlapping marks darken (multiply) for built-up,
  inky density.
- **Antialiasing** — smooth mark edges.

### Image & Stippling  *(↻ recompute)*
**Image** (reshape the source before sampling):
- **Rotation** — 0 / 90 / 180 / 270°.
- **Flip horizontal**.
- **Invert** — swap dark/bright (negative).
- **Gamma** — midtone bias (──> more/less dense midtones).
- **Contrast** — push tones toward black/white.

**Stippling field:**
- **Spacing (min ↔ max)** — the density range (dark→min, bright→max).
- **Phases** — number of placement passes (higher = fuller fill).
- **Hide Zone (min ↔ max)** — suppress points in a brightness band (e.g. drop the
  brightest highlights so they stay empty).
- **Points** — read-out of the current point count.

### Export
- **Scale — ×1 / ×2 / ×3** — raster output resolution multiplier.
- **PNG / JPG** — raster, scaled by the chosen Scale.
- **SVG** — resolution-independent vector.
- **Figma** — send to Figma.

> **Export is WYSIWYG.** It serialises the **exact preview points** — no
> recompute, no drift. The SVG uses the preview dimensions as its viewBox so it
> scales to any size while staying pixel-faithful to what you see; raster honours
> the Scale multiplier.

---

## 4. A typical workflow

1. **Open** an image.
2. Set **Rotation / Flip / Invert**, then **Gamma / Contrast** to shape the tones
   → press **↻**.
3. Tune **Spacing** and **Phases** for the density you want → **↻**.
4. Pick a **Symbol**, set **Size** (and Angle if the symbol is directional, e.g.
   line) — these update live.
5. Choose **Color** (Solid or Adaptive duotone), Alpha, Overpaint.
6. (Optional) **Save** as a preset.
7. **Export** — SVG for vector/print/mural, PNG/JPG for screen (set Scale first).

---

## 5. Tips & gotchas

- **Canvas not updating?** You probably changed a *placement* control — press **↻**.
- **A symbol looks empty?** Increase **Size**; thin forms (line, ring, leaf) read
  better a little larger. All 13 forms now render (post bbox + stroke-min fix).
- **Too dense / muddy?** Raise Spacing min, lower Phases, or reduce Size /
  Overpaint.
- **Highlights too busy?** Use **Hide Zone** to clear the brightest band.
- **Export looks different from preview?** It shouldn't — export is WYSIWYG. If it
  does, re-render (↻) then export.

---

## 6. Architecture notes (for future work)

- **Symbols** come from the centralized Genesis library
  (`/genesis/organic-forms.js` → `window.ORGANIC_FORMS`), filtered to the
  primordial subset `[7,56,1,2,40,12,14,33,38,36,44,30,45]`. The same component
  is used in **Spore**.
- `pointType` is `g:<n>` (Genesis form) or `u:<id>` (uploaded SVG).
- Forms are measured by content bbox (`formBBox`, hidden-SVG `getBBox`, cached);
  stroke width is floored to ~1.1 device px so stroke-based forms stay visible.
- Open follow-ups live in `docs/ROADMAP.md` (full-snapshot presets, higher detail
  ceiling / Web Worker, animated stippling for video).

---

*Studio Rann · Organica System v0.1*
