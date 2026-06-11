# Spore — User Manual

> Studio Rann · Organica · Generative Stippling
> Live: [theorganicalanguage.vercel.app/spore/](https://theorganicalanguage.vercel.app/spore/)
> Last updated: June 11, 2026

---

## 1. What Spore does

Spore translates an image into a field of **Organica symbols** — a fast,
approachable stippling tool. Marks are placed denser in dark areas and sparser in
bright ones, sized by tone, and exported as PNG / JPG / SVG or pushed to Figma.

It is the **lighter sibling of Pollen**: Pollen runs a variable-radius blue-noise
engine with a deep control set; Spore uses a simpler, quicker sampling and a
streamlined panel. Both share the **same centralized symbol library**.

Single-file vanilla HTML/CSS/JS.

---

## 2. Controls, section by section

### Top bar
- **Open** — load an image (drag-drop or click the ⊕ circle).
- **↻ Render** — (re)generate the stipple.
- **Stop** — interrupt a long render.
- **PNG · JPG · SVG · → Figma** — exports.
- The preview supports **zoom/pan** (wheel + drag) with **⌘ +/−** shortcuts.

### Symbols  *(400 %)*
Shared, identical picker with Pollen.
- **400 % preview** of the selected symbol.
- **Shape · primordial forms** — 8 curated Genesis forms with reference numbers:
  `7 drop · 56 line · 1 circle · 2 teardrop · 14 petal · 33 seed · 38 spiral ·
  31 lung`.
- **+ Upload SVG mark** — add your own SVG.

### Stippling
- **Spacing** — distance between marks (↑ = sparser).
- **Size** — base mark size.
- **Size by brightness** — darker areas get larger marks.
- **Density** — Light / Med / Dense sampling.
- **Phases** — sampling passes (fuller fill).
- **Invert image** — swap dark/bright.
- **Antialiasing** — smooth edges.

### Transform
- **Angle** — base rotation.
- **Angle by brightness** — rotation scales with tone.
- **Random angle** — per-mark random rotation.
- **Warp** — adds organic angular jitter.

### Color
- **Mode — Solid / Adaptive / Image / Multi / RMX**
  - *Solid:* one Mark colour.
  - *Adaptive:* tone-shifted mark colour.
  - *Image:* each mark takes the colour of the underlying pixel.
  - *Multi:* random hues.
  - *RMX:* a **palette of up to 5 colours** mapped by tone — gradient map (same as
    Pollen). Mappings: **Tone / Posterize / Random / Tone + Random**. The single
    Mark control is hidden in this mode.
- **Mark / BG** — colours (Mark hidden in RMX).
- **Opacity** — mark opacity.

---

## 3. Symbols & rendering notes

- Symbols come from the centralized Genesis library
  (`/genesis/organic-forms.js` → `window.ORGANIC_FORMS`), same primordial subset
  `[7, 56, 1, 2, 14, 33, 38, 31]` as Pollen.
- Marks are sized/centred on their **content bounding box** with a minimum stroke
  width, so thin/outline forms (line) render correctly — in canvas *and* SVG
  export.
- **RMX colours** assign a palette colour per mark by tone; the chosen colour is
  stored per mark, so the **SVG/PNG export matches the preview** exactly.

---

## 4. Spore vs. Pollen — when to use which

| | Spore | Pollen |
|---|---|---|
| Engine | quick sampling (Spacing / Density / Phases) | variable-radius **blue-noise** Poisson |
| Symbols | shared primordial set + upload | shared primordial set + upload |
| Sizing | Size + Size-by-brightness | Size + Range + **Scale** + **Width/Length** |
| Remix | **RMX colours** | **RMX colours + RMX shapes** |
| Colour | Solid / Adaptive / Image / Multi / RMX | Solid / Adaptive / RMX |
| Tone tools | Invert | Invert / Gamma / Contrast / Hide Zone / Rotation / Flip |
| Export | PNG / JPG / SVG / Figma | PNG / JPG / SVG / Figma (Export Scale) + WYSIWYG |

Reach for **Spore** for a fast, expressive pass; **Pollen** when you need precise
density, tonal control, stretch, and full WYSIWYG vector output.

---

*Studio Rann · Organica System v0.1*
