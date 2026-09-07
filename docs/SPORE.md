# Spore — User Manual

> Organica · Generative Stippling
> Live: [theorganicalanguage.vercel.app/spore/](https://theorganicalanguage.vercel.app/spore/)
> Last updated: September 7, 2026

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
- **PNG · JPG · SVG · → Figma** — exports, in the Export popover (see §2a).
- The preview supports **zoom/pan** (wheel + drag) with **⌘ +/−** shortcuts.

### Symbols  *(400 %)*
Shared, identical picker with Pollen.
- **400 % preview** of the selected symbol.
- **Shape · primordial forms** — 13 curated Genesis Base Seeds (the same set
  every seed-picker in Organica shares).
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

## 2a. Export — Screen/Print & Plates (September 2026)

The Export popover carries an explicit **Screen | Print** mode switch
(`shared/print-size-panel.js`, shared with Loom/Pollen/Halide/FVS):

- **Screen** (default) — today's behaviour exactly.
- **Print** — a real physical size (mm/in) + DPI. PNG/JPG export a
  bleed-inclusive canvas (flat-fill background extension + crop marks) with a
  real embedded `pHYs` DPI chunk; SVG wraps the same per-mark markup the
  Screen-mode export already builds in a physical-mm document with the same
  bleed + crop marks.

### Plates — one file per RMX ink colour

A **Plates** section appears whenever **Color mode is RMX** with a discrete
Mapping (**Posterize**, **Random**, or **Tone + Random** — not plain **Tone**,
a continuous blend with no single ink per mark). Exports **PNG** and **SVG**,
one file per palette colour, ink black on a transparent background (a real
screen-print/riso separation, not a colour preview). Classification is a
plain colour-equality check — Spore already stores each mark's own resolved
colour, and the three discrete mappings always store one of the palette's
literal hex values unchanged, so no re-derivation is needed. In Print mode,
plates also carry registration marks alongside the usual crop marks. Built on
the same shared `Organica.plateExport` driver Colornet and Pollen use.

---

## 3. Symbols & rendering notes

- Symbols come from the centralized Genesis library
  (`/genesis/forms.js` → `window.ORGANIC_FORMS`), same 13-form primordial
  subset (`shared/seeds-panel.js`'s `PRIMORDIAL`) as Pollen.
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
| Hatching | — | **Stroke** (Pointillist Line) + **field streamlines** (Flow) |
| Density | Spacing / Density | Spacing / Spacing × + **Light dropout** |
| Tone tools | Invert | Invert / Gamma / Contrast / Hide Zone / Rotation / Flip |
| Export | PNG / JPG / SVG / Figma, Screen/Print + Plates | PNG / JPG / SVG / Figma, Screen/Print + Plates, WYSIWYG |

Reach for **Spore** for a fast, expressive pass; **Pollen** when you need precise
density, tonal control, stretch, hatching/engraving lines, and full WYSIWYG vector
output.

---

*Organica*
