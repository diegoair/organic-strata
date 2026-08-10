# Camo Turing — manual

`/camo-turing/` — GPU (WebGL2/Three.js) Gray-Scott reaction-diffusion. The successor to Camouflage's Disruptive mode: Camouflage itself (Dazzle, Countershade, Structural palette, Canvas2D) was removed from the repo (`git log --oneline -- camouflage`), and its reaction-diffusion core was rebuilt here, on the GPU, with substantially more depth. Single-file, vanilla (`camo-turing/index.html`), using Three.js as a native ES module (`shared/three.module.js`, no CDN, no bundler) purely as a WebGL2 render-target/shader-pass harness — there is no scene graph or 3D content, just full-screen quads.

Why GPU here and not Canvas2D like Komorebi/Warping: Gray-Scott is an **iterative PDE** — it has to converge over many simulation steps, each one reading the previous frame's state. That's the one case in Organica where a continuous per-frame GPU pass is the right tool, unlike Komorebi's/Warping's patterns, which are pure stateless functions of `(x,y)` and were deliberately kept off the GPU for debuggability (see `docs/KOMOREBI.md` §17).

---

## 1. Core simulation

Standard two-chemical Gray-Scott: `Feed (f)`, `Kill (k)`, diffusion rates `dA`/`dB`, and a `Timestep`. Runs on a toroidal (wrap-around) grid at a chosen resolution (`Resolution`: 128 / 256 / 512, the simulation grid's long side — independent of the on-screen canvas size). Toroidal wrapping makes the `Tile preview` control (×1–×4, a genuine seamless repeat, not a crop) and every export's tiling free rather than a separate feature — the same architecture choice Camouflage made and this tool inherited.

**Pattern presets** — two families, 23 built-in total:
- The classic **mrob/Munafo regime catalogue** (The U-Skate World, Worms, Negatons, Turing patterns, Fingerprints, Mazes, Chaos, Pulsating solitons, Moving spots, …) — canonical named `f`/`k` pairs from Robert Munafo's Gray-Scott reference, the same set Camouflage shipped.
- **Animal/plant reference patterns** (Leopard spots, Cheetah spots, Tiger stripes, Zebra stripes, Watermelon rind) — Leopard/Cheetah/Tiger's `f`/`k` are Camouflage's own already-verified values, ported rather than re-derived; Cheetah's smaller feature size comes from `dA`/`dB` scaled down (Camouflage's own `pscale`); Tiger/Zebra/Watermelon are anisotropic (§3).

`Reset seed on preset change` (off by default) — off, a preset only changes the chemistry and the pattern keeps evolving live from wherever it already was; on, each preset reseeds fresh. Anisotropic presets above Anisotropy 0.3 force a reseed regardless of this toggle, because they need the row-seeded nucleation (§3) to fill the canvas rather than leaving a few local bands.

## 2. Seeds

Four source types, selected via the segmented control: **Genesis** (any of the 55 Genesis forms), **SVG** (upload), **Text** (opentype.js real glyph outlines, default Manrope, custom font upload), **Image** (luminance threshold, dark = inside).

Six seed **modes**, applied to whichever source is active:
- **Fill** — the coverage mask stamps the reaction once, directly.
- **Confine** — the mask permanently pins every cell outside it to the resting state, every step (masked reaction-diffusion, the same technique Camouflage's own "Seed from shape" used) — the pattern grows freely but can never escape the silhouette.
- **Trace outline** — nucleation points sample the shape's *edge* only, not its interior — growth radiates from the contour.
- **Regime boundary** — two different `f`/`k` values meet at the shape's edge, and the *whole* canvas keeps evolving on both sides; the shape becomes a border between two chemistries, not a container. The outside `f`/`k` is fixed (0.0545 / 0.0620, Coral labyrinth's own values).
- **Background image** — doesn't seed the simulation at all; the current Image/SVG source becomes Paper's background in full colour wherever the pattern isn't Ink (§4).
- **Stencil** — same source image, visible only *through* the Ink shapes instead; Paper stays flat.

**Two seeds** (toggle): a second independent shape, Seed A, which does *not* grow — it only resists Seed B's growth wherever the two overlap, via a `Famine depth` control (how far chemical A is depleted from its resting value at the start, i.e. how long the resistance lasts before A recovers).

## 3. Anisotropic diffusion — real parallel stripes

Isotropic Gray-Scott can only meander — no preferred direction, so it never bands into straight stripes on its own. `Anisotropy › Amount` (0–0.95) makes diffusion stronger along one axis and weaker along the perpendicular one, forcing the pattern into bands running the *other* way; `Direction` sets the stripe angle.

Implementation detail that matters for anyone touching the shader: taps are **nearest-neighbour**, not bilinear. Bilinear sampling at a rotated, generally non-axis-aligned offset leaks a small blur *into* the suppressed axis — measured directly in Camouflage's own development (`docs/CAMOUFLAGE.md` §11c): a clean 9.24× directional diffusion ratio at θ=0° collapsed to 2.15× at θ=50° with bilinear taps. Rounding the sample offset to the nearest whole texel before reading makes the lookup land exactly on a texel centre, where bilinear and nearest are mathematically identical.

Above Anisotropy 0.3, default nucleation switches from randomly scattered blobs to seeds laid out as a jittered **row along the stripe direction**, repeated across the perpendicular axis — scattered random seeds leave most of the canvas blank under strong anisotropy, because suppressed perpendicular diffusion can no longer carry information sideways from a handful of points to the rest of the frame (same finding, ported from Camouflage §11c).

Tiger/Zebra/Watermelon rind presets set `aniso`/`anisoAngle` directly.

## 4. Paper background image / stencil

Seed Mode `Background image` / `Stencil` reuses whatever Image/SVG source is already loaded in the Seeds panel — no second upload control. `Background image`: the source shows in full colour wherever the pattern isn't Ink. `Stencil`: the source shows only *through* Ink shapes; Paper stays flat elsewhere. Not available under RMX colour mode (`uPaperImgOn` is deliberately left off whenever RMX is active — RMX's own multi-colour mapping and a background photo don't compose meaningfully).

SVG export embeds the image **genuinely**, not as a rasterised approximation of the composite: a `<clipPath>` built from the same Ink-region path used everywhere else in the SVG exporter, clipping a real `<image>` element carrying the source as a base64 data URL (`preserveAspectRatio="xMidYMid slice"`, matching the canvas's own CSS `background-size:cover`-style fit).

## 5. Layers

`Layers` stacks additional, fully independent Gray-Scott simulations on top of the base pattern, blended in **field space** — before colour is applied — so blend modes like Multiply/Diff carve genuinely new geometry rather than just tinting the same shape. Each layer has its own Feed/Kill/dA/dB (edit by selecting the layer, then using the same sliders as the base Pattern section); Seeds/Transformers/export still act on the base pattern only.

Two independent blend systems per layer, deliberately kept separate rather than folded into one:
- **Field blend** (`Normal | Diff | Multiply | Screen | Add/Lighten | Darken | Exclusion`) — decides *shape*: how much ink ends up where, computed on the raw A/B field values.
- **Layer colour** (optional, off by default) — decides *tint*: once turned on, the layer's flat colour shows through wherever that layer's own pattern is active, weighted by its opacity, independent of which field blend mode is chosen. A layer can carve new geometry via Multiply while still tinting with its own colour without the two knobs fighting each other's math.

Confine/Boundary seed modes and Anisotropy are main-simulation-only in this first pass — extra layers always run isotropic, unconfined (documented in the code as a scoping decision, not an oversight).

## 6. Transformers — raster post-processing stack

A registry-driven stack of raster effects that runs *after* whatever Seeds produced, on that same mask canvas, before the reaction starts. Ported from Living Path's raster effect family (`RFX` in `livingpath/index.html`) — only the raster half, not Living Path's vector-node family (jitter/wobble/twist), which needs path points rather than a mask canvas. Kept isolated to this tool for now rather than centralised into `shared/`, pending a second consumer.

Entries: **Particles** (scatters disks of varying size onto the seed shape's own ink, unioned together — the old "Bubbles" seed source's replacement, now genuinely additive onto real ink instead of a blank-canvas approximation), **Dilate/Erode** (grows or shrinks the boundary), **Blur** (softens the edge into a graduated ramp), **Threshold** (re-cuts a soft/grainy edge back to a hard binary one — most useful after Blur or Noise), **Noise** (smooth random jitter on the boundary — a grainy, degraded edge), **Skeleton** (Zhang–Suen thinning to a 1px centre-line, then re-thickened to a constant width — a shape becomes a stream/wire tracing its own middle), **Polygonize** (quantises onto a coarse block grid — faceted, low-poly boundary), **Seam carve** (content-aware carving, à la Photoshop — pinches/warps rather than uniformly scaling; a shape with a lot of empty margin can absorb several seams from blank space before any visible pinch reaches it), **Reaction** (a second, independent Gray-Scott pass confined to the seed shape's own ink, then carved as holes into it — coral/cellular instead of solid).

## 7. Compare

`Diff overlay` — shows how much the field has changed since the last `Snapshot`: Ink where it moved a lot, Paper where it barely moved. `Export vs. preview` — overlays the exported SVG on the live canvas at `mix-blend-mode: difference`; near-black means the export matches the preview exactly. This is the literal technique used to verify this tool's own SVG-export correctness during development, exposed directly in the UI.

## 8. Palette

Three colour modes, Pollen's own naming: **Solid** (the field's own threshold decides ink vs paper — plain duotone, same convention as everywhere else in Organica), **Adaptive** (smooth blend between Ink and Paper by the field's raw value, no hard edge), **RMX** (up to 5 colours mapped across the field: `Tone` blends like a gradient, `Posterize` bands them, `Random`/`Tone + Random` add hashed jitter — a texture, not per-blob colour, since the field is continuous rather than discrete marks like Pollen's stipple points).

## 9. Export

**PNG** at ×1/×2/×4 scale. **SVG** traces the *frozen* field into genuine vector paths — pause the simulation first; SVG needs a still frame to trace, same WYSIWYG discipline as every Organica exporter. **Video**: `canvas.captureStream()` + `MediaRecorder`, MP4/H.264 where supported, WebM fallback — records the live canvas, Format/Resolution/Tile at the moment `Start recording` is pressed apply to the whole clip.

## 10. Zoom

Mouse wheel over the canvas zooms; click re-seeds at that point (matching the CPU-engine convention "click to seed" used elsewhere in Organica).

---

*Studio Rann · Organica*
