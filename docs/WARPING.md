# Warping — manual

`/warping/` — domain-warped value-noise / Worley pattern generator. Single-file, vanilla Canvas2D/JS (`warping/index.html`).

## Why this tool exists

Gray-Scott reaction-diffusion (Camo Turing, `docs/CAMO-TURING.md`) is a general-purpose pattern engine, but it is honestly limited to what an activator-inhibitor chemical system can produce: spots, mazes, stripes, coral. It cannot produce wood/marble veining, a sharp polygonal cell network (giraffe-style reticulation), or topographic contour lines without faking it — those are noise-field phenomena, not reaction-diffusion ones. Warping covers that other family.

## Why Canvas2D and not WebGL/GLSL

Every pattern here is a **pure function of `(x, y)`** — no iterative convergence, unlike Gray-Scott. That's exactly the category Komorebi already made the case for moving off WebGL (`docs/KOMOREBI.md` §17): GLSL has no breakpoints or `console.log`, and a stateless per-pixel function loses nothing running on the CPU at these resolutions. Warping follows the same reasoning from the start rather than starting on the GPU and migrating later.

## Architecture note — shared noise module

`hash2`, `vnoise`, `fbm`, `ridgedFbm`, `voronoiF1F2` live in `shared/noise.js`, not as a private copy in this file. They started as private copies inside `komorebi/index.html` (itself a plain-JS port of an even older GLSL version); Camo Turing's anisotropic-diffusion work needed the same hash/fbm construction again, and this tool is a third independent consumer — the exact condition `core.js`'s own header warns about (a routine copied three times drifts, and a fix in one copy never reaches the others). Komorebi was switched to consume the shared module in the same session this tool shipped, verified regression-clean (identical Cellular-pattern render, identical `buildSVG()` output on the Canvas Bloom preset).

**Load order matters**: `core.js` → `noise.js` → the tool's own script. `core.js`'s own last line is `global.Organica = Organica`, which would silently overwrite (not merge with) a `.noise` namespace attached before it loaded.

## 1. Pattern

Four generators, selected from the `Pattern` dropdown — each is a scalar field function, `fieldValue(x, y, P) → 0..1`, sampled once per output pixel:

- **Wood grain** — concentric rings from a centre point: `r = √(x² + (y·Squash)²)`, then `v = sin(2π · (r · Rings + grain·GrainAmt))`. `Squash` flattens circular pith rings toward straight plank-cut lines (1 = circular, lower = flatter). `Grain` adds a finer independent noise layer riding on top of the rings (figure/curl), separate from `Warp` below, which bends the *whole* field rather than adding local texture.
- **Marble veining** — `v = sin(x·VeinFreq·π + fbm(x,y)·Turbulence·2π)`. `Turbulence` at 0 gives dead-straight bands (not marble); real marble needs it above 0.
- **Cellular network** — Worley/Voronoi F1/F2: `edge = F2 − F1`, thresholded by `Wall width`. This is the direct mechanism for a giraffe-style polygonal reticulation — `Cell size` sets how many Worley cells span the canvas, `Jitter` moves cell centres off a regular grid (0 = perfect honeycomb, higher = irregular organic cells). Ported verbatim from Komorebi's own Cellular mask, which uses the identical F1/F2 technique for cracked-earth patterns.
- **Level curves** — a single fbm "elevation" field, sliced into `Levels` threshold bands; pixels near a band boundary (within `Line width`) draw as a contour line. Genuine topographic-map contours, not a raster gradient with lines painted on top.

`Sharpness` (shared across all four patterns) is a `pow()` applied to the field value — higher values push the field toward hard black/white, lower toward soft grey transitions.

## 2. Warp — the tool's namesake

Bends the **sampled coordinates** with a low-frequency noise field before the pattern function above ever runs — two decorrelated `fbm` taps (the same `(5.2, 1.3)` offset trick Komorebi's own `windOffset()` uses, so the x/y displacement isn't just one noise field read diagonally twice and correlated with itself). `Amount` 0 is an exact no-op: every pattern's straight/regular form (dead-straight marble veins, a perfect honeycomb, concentric wood rings) is always reachable, warp is additive on top, never a replacement mechanism.

This is deliberately a single, shared mechanism across all four patterns rather than a per-pattern reimplementation — wood becomes burl, straight marble veins go organic, a honeycomb goes irregular, contour lines get an extra layer of waviness, all from the same two controls (`Amount`, `Warp scale` — the noise field's own spatial frequency).

## 3. Tone

`Bands` posterizes the field into N flat levels before mapping to colour (0/"Smooth" = a continuous gradient between Ink and Paper). `Ink`/`Paper` are plain hex colours, validated through `Organica.normalizeHex`. `Seed` varies the noise's own random offset — folded into each pattern's *noise* sampling only (grain, turbulence, Worley cell layout, contour field, and the warp field itself), never into the base geometric position. Wood's ring centre and marble's vein direction are defined relative to the canvas centre; offsetting the base coordinate by the seed would silently push that centre far off-frame, and far from a circle's own centre the local curvature is negligible — rings would read as near-straight parallel lines instead of concentric circles. (This was a real bug in the first version of this file, caught by looking at the render: `Rings = 6` on the default seed produced something that looked like straight diagonal lines, not six rings.)

## 4. World-coordinate normalisation

Every pattern normalises its input coordinate by a shared `NORM` constant before applying its own frequency slider (`Rings`, `Vein freq.`, `Cell size`, `Field scale`), so a slider reads consistently as "cycles across the canvas half-width" regardless of which pattern is active. This was also a real bug in the first version: before normalisation, `Rings = 6` produced roughly 25 visible stripes because the slider multiplied a raw, un-normalised coordinate directly — the number on the slider and what appeared on screen had no real relationship. Fixed by dividing every pattern's coordinate input by `NORM` first.

## 5. Export

Same discipline as every Organica generator: **PNG/JPG** read the live canvas directly (`toDataURL`, synchronous, not `toBlob`, which races the canvas resize-back). **SVG** re-renders at a fixed trace resolution and posterises luminance into N stacked bands (`"≥ level"`, darkest first, so there can be no hairline gap between bands however coarse the trace) — the identical shape as Komorebi's own `buildSVG()`, reusing the same shared rectilinear contour tracer (`Organica.contoursToPathD`) that Halide/Komorebi/Camo Turing all already use. When `Bands` is "Smooth" (0) in the live preview, SVG export still posterizes into a reasonable default (6 bands) — a continuous field has no honest one-to-one vector form, only a tone separation does.

## 6. Presets

Eight built-in, two per pattern, run and checked visually before naming:

| Preset | Pattern | Notes |
|---|---|---|
| Oak plank | Wood grain | Low warp — clean, mostly-straight rings |
| Burl wood | Wood grain | High warp — visibly twisted, chaotic grain |
| White marble | Marble veining | Subtle warp, high sharpness, light ground |
| Black marble | Marble veining | Warm veins on a dark ground |
| Giraffe hide | Cellular network | The motivating case — bold reticulation, warm palette |
| Cracked earth | Cellular network | Wider walls, higher jitter |
| Topographic map | Level curves | Moderate warp, green-on-cream |
| Wavy contour | Level curves | High warp — pronounced wandering contours |

Custom presets save via `Organica.presetStore('warping', …)`, same convention as every other tool.

## 7. Known limitations

- **Marble veining** currently reads more like directional brushed grain than the branching, crossing vein structure of real marble — a further tuning pass (likely more octaves at varying orientation, rather than a single directional `sin`) would improve it. Not yet done.
- Wind/animation is out of scope, same as Komorebi's own current state — every pattern here is a single static frame.

---

*Studio Rann · Organica*
