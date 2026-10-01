# Dapple — User Manual

> Organica · Komorebi's canopy, set moving
> Live: [theorganicalanguage.vercel.app/dapple/](https://theorganicalanguage.vercel.app/dapple/)
> Last updated: October 1, 2026

---

## 1. What Dapple does

Komorebi composes **one static frame** of light through leaves. Dapple takes
the **SVG Komorebi exports** (posterised tone bands of that frame) and lets the
canopy move: a sway, a drift, a rustle of the edges, light that flickers, a gust.
At rest the picture *is* the source file.

It shares its engine, parser, loop model and export with **Undertow** (Warping's
animator) — read `docs/UNDERTOW.md` for the full mechanics: the band-SVG input
format, the vertex budget, the displacement field and its controls, looping by
construction, recording, and the measured numbers. This page covers only what
is specific to Dapple.

> Komorebi itself has no wind or video export: it was rewritten from WebGL to
> Canvas2D on Jul 27, 2026 and "wind/animation is a later pass". Dapple is that
> later pass, done as a separate tool that animates the exported SVG rather than
> as a mode inside Komorebi (the static tool transforms; the animator moves).

---

## 2. Input

A Komorebi SVG export (Screen mode): a full-canvas `<rect>` ground plus one
evenodd `<path>` per tone band (2–10 bands, trace width 240–900). Since
Oct 1, 2026 it carries `<metadata id="organica">{"tool":"komorebi",…}</metadata>`.

Komorebi bands are **thousands of small separate patches** (a typical default
export: 3,120 boundaries, most under 10 points). That is why the draw loop
omits `closePath()` (see UNDERTOW.md §5): with it, 37 ms a frame; without, 0.3 ms.
Measured here: the default export (30,000 points) and a 155,000-point 900-wide /
10-band export both hold **60 fps** with Stagger and Flicker on.

Refused with a message: Print-mode files, mark exports (→ Murmur), a Warping
export (→ Undertow), curved paths, empty files, over 220,000 points.

---

## 3. The presets

| Preset | Motion |
|---|---|
| **Sway** (default) | a slow, long-wavelength wave across the canopy, a little noise flow |
| **Drift** | broad flow with a gentle wave; the whole field wanders |
| **Rustle** | fine, fast edge shimmer over a still frame (2 cycles per loop) |
| **Flicker** | bands' opacity pulses at staggered phases (3 cycles): light comes and goes |
| **Gust** | a strong wave plus rustle, bands lagging each other |
| **Source** | the file as exported |

Every control is the engine's (Amplitude, Cycles, Scale, Flow, Wave,
Wavelength, Wave angle, Swirl, Breathe, Rustle, Stagger, Flicker, Smooth,
Detail). Smooth defaults to 3 here: Komorebi's boundaries are pixel staircases,
and rounding them is what makes patches of light read as light.

---

## 4. Output

A **seamless video loop**, MP4 / WebM, at Source / 1080 / 2160 / 3840.
Loop length 1–30 s; every periodic term snaps to whole cycles of it.

---

## 5. Code map

`dapple/index.html` (generated from the same template as `undertow/index.html`),
`shared/bandfield.js`, `shared/recorder.js`, `shared/noise.js`.
