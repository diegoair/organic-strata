# TuneSutra — manual

`/tunesutra/` · accent `#c93ed6` · single file (`tunesutra/index.html`)

TuneSutra is where Organica's colours are made. A palette built here has named
colours, a 0–900 scale per colour, a contrast check and a gradient; once saved
it can be picked from the colour control of every other tool.

Rebuilt Oct 1, 2026 on `shared/color.js` (`Organica.color`, OKLCH). Before that
it worked in HSL: harmonies came out unevenly bright and the scales were uneven
to the eye.

---

## 1. The palette

- **Colours** 3–7. Each colour is an item `{ id, name, hex, lock }`. The `id` is
  stable for the colour's life; the **name** is what the token key is built
  from (`Warm Clay` → `warm-clay`; a repeated name gets `-2`, `-3`).
- **Select a colour** by clicking it on the sheet (bar segment or garment zone).
  The chips in the panel open the system colour picker directly.
- **Harmony** + **Generate** rebuild every colour except the first and any
  marked **Keep on Generate**. The first colour is the seed. Hue is rotated in
  OKLCH, so every generated colour has the seed's perceived lightness and as
  much of its chroma as that hue can hold. Pressing Generate twice gives the
  same set.
  - Analogous fans out ±15° per step either side of the seed.
  - Complementary / Split / Triadic / Tetradic have 2–4 hues of their own;
    extra colours reuse those hues at further steps of their scale.
  - Monochromatic walks the seed's own scale, lighter first.
- **Lightness spread** (0–30) moves the generated colours apart in lightness,
  alternately lighter and darker. At 0 they all share the seed's lightness —
  balanced, but with almost no contrast between them (the contrast grid shows
  it). It regenerates as you drag.
- **Undo** (button or ⌘Z) covers every change, including gradient settings.
- The hint under the chips names any two colours closer than ΔE 6 (OKLab ×100)
  — too close to tell apart at a glance.

## 2. The sheet

One scene list (`buildScene()`) draws the preview, the SVG and the PNG.

1. **Top block** — *Bar* (colours in 60/…-style proportions), *Garment*
   (3 colours only) or *Gradient*.
2. **Scales** — ten steps per colour, 0–900. Every step sits at a fixed
   perceived lightness (`Organica.color.SCALE_L`), so step 500 is the same
   lightness in every row. The picked colour is kept unchanged on its nearest
   step (outlined). Chroma keeps the pick's share of the gamut at each
   lightness and never exceeds the pick's own.
3. **Contrast grid** — each cell sets the row's colour as text on the column's,
   with the WCAG ratio under it (`· close` marks a pair under ΔE 6).

## 3. Gradient + grain

One definition, two renderings (the **Output** switch):

| | Screen | Print |
|---|---|---|
| What it is | a smooth gradient, interpolated in OKLab, with luminance grain on top | the same gradient as a grid of cells, each one pure ink |
| Grain | **Grain** (strength) + **Grain size** | **Grain size** = cell size (min 3) + **Pattern**: Noise (stochastic) or Ordered (Bayer 8×8) |
| Output | raster — PNG, or a PNG inside the SVG | vector — one path per ink |
| Plates | — | one SVG per ink, black on transparent |

- **Type** linear / radial / conic. **Angle** follows CSS: 0° = to top,
  90° = to right; a conic gradient starts there and turns clockwise.
- **Stops** 2–5. The ▦ button on the strip lists *This palette* first, then
  every saved palette and the built-in sets. Stops are colours in their own
  right: reordering the palette does not reorder them.
- **Fade to paper** adds the paper as the last stop. In Print the last ink
  thins out to bare paper and the paper gets no plate.
- **Seed** fixes the grain / the cell pattern.

In Print every cell belongs to exactly one ink: plates never overlap and
together cover the whole block (verified: 0 uncovered, 0 doubly covered pixels;
plates re-composited in their inks = the print PNG, 0 differing pixels).

## 4. Export

| Button | What you get |
|---|---|
| PNG / SVG | the whole sheet. The SVG carries its own paint and font on every element — no page CSS needed |
| CSS | `--tunesutra-<name>-<step>` for every scale step + `--tunesutra-gradient` (smooth gradient only — grain is not expressible in CSS) |
| JSON | the same as design tokens (DTCG `$value` / `$type`), incl. a `gradient` token |
| Gradient only → PNG / SVG | the gradient block alone, 860×300 units |
| Gradient only → Plates | Print output only: one SVG per ink |

SVG text names the page font (IBM Plex Mono) with fallbacks; a machine without
it shows the fallback.

## 5. Saving, and the palette library

**Save** stores the palette in `Organica.store('tunesutra')` (cloud-synced when
signed in): `{ n, harmony, spread, colors, names, ids, locks, gradient }`.
Palettes saved before names / gradients existed still load.

Every colour control in the suite (`Organica.palette.swatch`) has a small ▦
button — **Pick from a palette** — listing these saved palettes and the
built-in sets (`Organica.palette.library()`):

- on a single colour row: click a colour to use it;
- on a chip strip: click a colour to add it (or replace the last one when the
  strip is full), or a palette's name to load it whole.

Built-in: **Riso standard inks (approx.)** — 21 inks. The hex values are screen
approximations of real inks (public riso-colors list); check them against your
printer's own chart before relying on them.

## 6. System — the interface's own colours

The **System** view proposes Organica's chrome tokens from the palette and shows
them beside today's. It writes nothing: the result is a file to review.

- **Neutral** — which colour's hue tints the greys (panel, borders, labels), or
  *Today's warm grey*. **Tint** 0–100: 50 = today's amount, 0 = pure grey.
- **Canvas dot** — the hue of the dot grid behind the sheet.
- The ten existing roles are derived for **light and dark** (`--ink`, `--paper`,
  `--mid`, `--accent`, `--accent-hover`, `--panel`, `--border`,
  `--border-strong`, `--danger`, `--canvas-dot`) at today's own lightness
  levels; text and boundary roles are then pushed until they clear the rule
  (text ≥ 4.5:1, boundaries ≥ 3:1, on both `--paper` and `--panel`). Light
  `--paper` stays `#ffffff` (it is also the sheet). No new token names.
  With *Today's warm grey* at Tint 50 the proposal is today's palette (every
  role within ΔE 0.7).
- **Tool accents** — every tool page's own `--tool`, read live. *Keep hues*
  gives them all one **Lightness** and **Chroma** and keeps each hue; *Even hues*
  also spaces the hues evenly, in today's order. The sheet lists each accent's
  contrast on light and on dark paper; `*` marks one that is under 3:1 today
  (six were on Oct 1, 2026: Flexible Visual System, Pollen, Komorebi, Living
  Path, Apostate, Dapple).
- **Preview on this page** applies the proposal to TuneSutra's own interface, in
  whichever theme is on. Not saved; no other page changes. The sheet stays light.
- **Export → System proposal → CSS** gives the two theme rules for
  `shared/tokens.css` (each changed value with its old one in a comment) and a
  commented list of `--tool` per tool. **JSON** gives the same as tokens.

To adopt a proposal: paste the values over the same properties in the THEMES
rules of `shared/tokens.css`, mirror them in `shared/tokens.json`, set each
tool's `--tool`, then run `/design-system/_dark-audit.html` on every page.

## 7. Not built yet

- A real physical size / DPI for the gradient (the shared Screen/Print size
  panel) and registration marks on plates.
- Applying a System proposal automatically (it is a manual, reviewed paste), and
  the derived tokens outside the ten roles (`--accent-warm`, `--stage-shadow`).
- Screen-print ink sets beyond Riso; a free-text ink reference per colour.
- The colour inputs of FVS variant rows, Colornet channel cards and Camo Turing
  layer cards are still bare system pickers, without the palette button.
