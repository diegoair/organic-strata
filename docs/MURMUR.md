# Murmur — User Manual

> Organica · Mark fields in motion
> Live: [theorganicalanguage.vercel.app/murmur/](https://theorganicalanguage.vercel.app/murmur/)
> Last updated: September 30, 2026

---

## 1. What Murmur does

Murmur takes an SVG exported from **Pollen**, **Spore** or **Halide** and brings
it to life. Every mark in the file becomes a particle hung on a spring to its own
place. At rest the field *is* the source image. The motion happens around it:
- ambient drift, a wave and a breath;
- a pointer that pushes, pulls or swirls the marks;
- an entrance that assembles the image;
- periodic forces (sag, scatter, swing).

Fast marks stretch into strokes, so motion reads as hatching.

It is the hub hero's animation (the word "Organica" as a stipple field), turned
into a tool. Both run on the same engine, `shared/swarm.js`
(`Organica.swarm`).

Output: a **video loop** (MP4 / WebM).

---

## 2. Input — which SVGs work

| Source | What becomes a particle | Drawn as |
|---|---|---|
| **Pollen** | each point's `<g transform>` (a Genesis form, an upload, a stroke), or each field streamline `<path>` | a plain dot uses the batched **circle** path. Any other form becomes a vector **shape**: Path2D, plus oval primitives |
| **Spore** | each mark's `<g transform="translate rotate scale translate">` | circle or vector shape, with the mark's colour and opacity |
| **Halide** | each **dither cell**. Merged `<rect>` runs are split back into `block × block` cells; a "Simplify shapes" path is read back into cells | squares |

- **Screen-mode exports only.** Print-mode files (mm / in documents with crop
  marks) are refused with a message.
- The three tools now write a
  `<metadata id="organica">{"tool":"…"}</metadata>` block into their Screen SVG
  (Halide adds `block` and `paper`). Older files without it are recognised by
  shape (rects → Halide, nested transformed groups → Spore, otherwise Pollen).
  The Source panel then shows the tool as *guessed*.
- A **full-canvas `<rect>`** is the background: it sets Paper and is not
  animated. Halide's paper-coloured regions are skipped too.
- **Cap: 60,000 marks.** Above that the file is refused, with the count.
- **Colours:** above 256 distinct colours (Pollen's image-colour mode), colours
  are quantised to 17 levels per channel so marks can share styles.

### Fidelity

The settled frame was measured against Chrome's own rendering of the source SVG,
at 1:1 with breath off:
- Pollen dots and forms, Spore dots, streamlines, and Halide (rects and
  simplified): **pixel-exact** (ink ratio 1.000, zero block difference).
- Spore's two-ellipse mark at 3–4 px: **~6–11% lighter**. Chrome's SVG renderer
  and canvas `ellipse()` anti-alias ovals under 2 px thick differently. This
  can't be fixed in canvas, and it fades at export sizes, where marks are
  2–6× larger.

Two rendering rules came out of that measurement (see the comments in
`shared/swarm.js` and `murmur/index.html`):
- Up to 25,000 marks, circles and squares are **filled one by one**. One big
  batched path is anti-aliased ~15% lighter.
- Shape geometry is **baked at the mark's own scale**. A 100-unit form drawn at
  ×0.02 loses ink to curve flattening.

---

## 3. Controls

Every control group below comes from one schema (`Organica.swarm.SCHEMA`). The
hub hero's `?tune` panel shows exactly the same controls.

| Group | Controls | Feel |
|---|---|---|
| **Spring** | Stiffness, Damping | snappy ↔ syrupy |
| **Ambient** | Drift / Drift scale / Drift speed (value noise), Wave / Wave speed / Wave length, Breath / Breath speed | how alive the field is at rest |
| **Pointer** | Mode (repel / attract / swirl), Radius (fraction of width), Force, Press × | how the field answers the hand |
| | Scripted (off / orbit / figure8 / zigzag / sweep), Turns, Scripted press | a pointer that shows up in recordings. Paths ported from Membrane's movement patterns |
| **Entrance** | From (scatter / centre / below / edges / none), Stagger by (none / index / x / distance / noise), Stagger (s) | how the image assembles. Uses `Organica.tracks.staggerDelay` |
| **Marks** | Stroke at, Full speed, Shrink, Stroke length | when motion becomes hatching. Stroke at ≥ 1 turns it off |
| **Cycle** | Period, Gravity, Scatter, Swing | periodic forces; Period is used when Loop = 0 |

Distances are in **reference pixels**. The engine multiplies them by
`unit = long edge ÷ 1200`, so one params object feels the same on a 600 px Halide
export and a 4000 px Pollen export.

**Motion** — one-click starting points mapped to `docs/ANIMATION-SYSTEM.md`:

| Mode | Pattern | What it sets |
|---|---|---|
| Pulse | Internal Pressure | strong breath, stiff spring |
| Drip | Gravity + Viscosity | each mark sags and falls on its own phase |
| Assemble | Growth by Tracing | from the centre, staggered by distance |
| Swarm | Collective Behaviour | loose spring, strong noise drift |
| Drift | Environmental Forces | a steady wave across the field |
| Orbit | Differential Rotation | the field swings about its centre, inner marks further |

**Presets** save the params (only what differs from the defaults), the loop
length and the Paper colour to `Organica.store('murmur')`. **Copy params** puts
the params JSON on the clipboard, ready to paste into the hub hero's
`HERO_PARAMS`.

---

## 4. Playback, loop, export

- **Floatbar:** Play / Pause (also Space), Replay entrance, Loop, Export.
- **Loop (s):** every periodic motion (wave, breath, noise drift, scripted
  pointer, cycle forces) snaps to a whole number of cycles in this length. Noise
  travels on a circle through the field (Komorebi / Pulsar's trick). 0 means
  free-running.
- **Record loop:** re-renders at the chosen **Size** (Source / 1080 / 2160 /
  3840 long edge, even dimensions) and records through `Organica.recorder`.
  - With *Start with the entrance* **off**, the field is pre-rolled two whole
    loops, so the file loops seamlessly. Measured: frame L ≡ frame 2L to within
    0.002 grey levels.
  - With it **on**, the file opens with the marks flying in (one-shot).
- The simulation runs on a **fixed 1/60 s step**, so it is deterministic for a
  given seed and inputs. A frame-accurate offline render (like Mote's) is
  possible later without touching the physics.

---

## 5. The hub hero

`index.html` feeds the same engine dots sampled from the word "Organica" (jittered
grid, size ∝ depth inside the glyph). `HERO_PARAMS` / `HERO_SAMPLE` in the hero
script are the feel. Empty means `Organica.swarm.HERO`, the original hand-tuned
constants. Open `/?tune` for the author-only panel:
- every control group above;
- the word sampler (Density, Depth probe, Accent dots);
- the motion modes;
- Replay, Defaults, and **Copy params**. Paste the result back into the hero
  script.

Visitors never see the panel.

---

## 6. Deferred

- Print-mode SVG input (physical-unit documents with bleed and crop marks).
- PNG / SVG frame export, and a frame-accurate offline encoder.
- Genesis / generic SVG input. The parser is generic, but v1 is scoped to the
  three stipple tools.
- Morphing between two sources.
