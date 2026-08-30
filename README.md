# Organica

> Studio Rann — Visual Language System & Toolset  
> Live at [theorganicalanguage.vercel.app](https://theorganicalanguage.vercel.app)

Organica is both a visual language and the AI-powered toolset built to develop, generate, and deploy it across any medium. Built on the methodology of **Flexible Visual Systems** (Martin Lorenz) — a grammar of rules that generates infinite coherent variations, from screen to mural.

---

## Live Tools

| Tool | URL | Description |
|---|---|---|
| **Hub** | [theorganicalanguage.vercel.app](https://theorganicalanguage.vercel.app) | Entry point |
| **Genesis** | [/genesis/](https://theorganicalanguage.vercel.app/genesis/) | 55 animated organic forms + grid composer |
| **Indicators** | [/genesis/indicators.html](https://theorganicalanguage.vercel.app/genesis/indicators.html) | Full form catalog |
| **Strata** | [/strata/](https://theorganicalanguage.vercel.app/strata/) | Sketch → SVG, Smart+ algorithm |
| **Spore** | [/spore/](https://theorganicalanguage.vercel.app/spore/) | Generative stippling from images — SVG mark library, PNG/JPG/SVG export |
| **Pollen** | [/pollen/](https://theorganicalanguage.vercel.app/pollen/) | Advanced stippling — blue-noise engine, point shapes, Adaptive duotone, presets |
| **Living Path** | [/livingpath/](https://theorganicalanguage.vercel.app/livingpath/) | Generative font/path modification — Vector + Raster engines, layer groups + blend modes, installable OTF export |
| **Halide** | [/halide/](https://theorganicalanguage.vercel.app/halide/) | Photo → true 1-bit dithered portrait — Floyd–Steinberg/Atkinson/Bayer, background removal, sticker outline, PNG/JPG/SVG/Figma export |
| **Komorebi** | [/komorebi/](https://theorganicalanguage.vercel.app/komorebi/) | 木漏れ日 — real-time WebGL2 dappled sunlight through a canopy: light-cookie/gobo, penumbra/pinhole physics, god rays, seamless WebM loop, tone-band SVG separation |

---

## Repo Structure

```
organic-strata/
├── index.html           ← Organica hub (dark, animated noise field)
├── genesis/
│   ├── index.html       ← Genesis Creator composer
│   ├── indicators.html  ← 55-form animated catalog
│   ├── animations.css   ← 55 CSS @keyframes animations (append-only)
│   ├── page.css         ← Genesis catalog page chrome
│   ├── forms.js      ← SVG markup for all 55 forms
│   ├── defs.js       ← Shared SVG defs (goo filters + shapes)
│   └── genesis-creator.js    ← Composer interaction logic
├── strata/
│   └── index.html       ← Strata app with Smart+ tracing algorithm
├── spore/
│   └── index.html       ← Spore — generative stippling (single-file)
├── pollen/
│   └── index.html       ← Pollen — advanced stippling, blue-noise engine (single-file)
├── livingpath/
│   └── index.html       ← Living Path — generative font/path modification (single-file)
├── halide/
│   └── index.html       ← Halide — photo → 1-bit dithered portrait (single-file)
├── komorebi/
│   └── index.html       ← Komorebi — WebGL2 volumetric light / god rays / dapple (single-file)
├── backend/             ← Python + OpenCV + vtracer (local only)
├── docs/
│   ├── VISION.md        ← System vision and methodology
│   ├── ROADMAP.md       ← Development phases
│   ├── ANIMATION-SYSTEM.md  ← Animation pattern documentation
│   ├── LIVINGPATH.md    ← Living Path manual
│   ├── HALIDE.md        ← Halide manual
│   └── KOMOREBI.md      ← Komorebi manual
├── CLAUDE.md            ← Project memory for AI sessions
└── vercel.json          ← Routing configuration
```

---

## Architecture

<!-- This list has drifted well behind CLAUDE.md's own Tools table (still
     listing the removed /strata/ and /backend, missing most tools shipped
     since — Komorebi onward) — a known, larger gap outside this note's own
     scope. New entries are still added here per docs/UI-SHELL.md §6/§6b so
     it doesn't fall further behind; a full resync is a separate task. -->
```
Hub (index.html)
├── /genesis/         → Genesis (unified Library/Compose/Draw/Import/Generate tool, static, Vercel)
├── /spore/           → Spore stippling app (static, Vercel)
├── /pollen/          → Pollen advanced stippling app (static, Vercel)
├── /livingpath/      → Living Path font/path tool (static, Vercel)
├── /halide/          → Halide dither-portrait tool (static, Vercel)
├── /komorebi/        → Komorebi volumetric-light tool (static, Vercel)
├── /colornet/        → Colornet channel-separation + recolour tool (static, Vercel)
├── /blob-boundary/   → Blob Boundary mask-morph + edge-scatter tool (static, Vercel)
├── /radial/          → Radial — Book of Shapes "radial" polar-field generator (static, Vercel)
├── /pulsar/          → Pulsar — generative Motion tool over Radial's parameters (static, Vercel)
└── /backend          → Python server (local only, not deployed) — historical, no longer present (removed with Strata)
```

**Deployment:** Vercel — auto-deploys on push to `main`  
**Backend:** Local only — Python + OpenCV + vtracer, runs at `http://localhost:5050`

---

## Backend (Local)

Required to use Strata's SVG tracing features:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 server.py
```

Server runs at `http://localhost:5050`. Without it, Strata shows a guidance banner.

---

## Genesis — Animation System

55 animated organic forms, each physically simulated with pure CSS `@keyframes`. Six animation patterns:

1. **Internal Pressure** — `scale` + asymmetric easing → breath, heartbeat, lung
2. **Gravity + Viscosity** — `translateY` + `scaleY` → drops, honey, lava
3. **Growth by Tracing** — `stroke-dashoffset` → vine, roots, tree rings
4. **Collective Behaviour** — staggered delays + goo filter → swarm, metaballs
5. **Environmental Forces** — continuous translate, linear easing → wind, tide
6. **Differential Rotation** — counter-spinning layers → orbit, shard rotation

See `docs/ANIMATION-SYSTEM.md` for full documentation.

---

## Strata — Smart+ Algorithm

Sketch-to-SVG tracing with four modes:

- **Smart ✦** — vtracer-based, shape style A/B/C (Organic / Balanced / Geometric)
- **Single** — full image as one path
- **Separate** — multi-path output
- **Simplified** — reduced node count

Fidelity slider (1–10) maps to potrace/vtracer parameters. Crop selection before tracing.

---

## Spore — Generative Stippling

Translate an image into the Organica mark vocabulary. SVG mark library (drop, blob, petal,
brush, crescent, leaf + base shapes) with size-by-brightness, zoom/pan preview, and PNG /
high-def JPG / vector SVG export plus Figma push. Single-file vanilla HTML/CSS/JS.

---

## Pollen — Advanced Stippling

Image → variable-radius **blue-noise** point field (Poisson-disk): spacing follows brightness
(dark = dense, bright = sparse). Each point is drawn as a **Circle / Polygon / Line** with
Size & Angle ranges, Random and Warping. Tone controls (Gamma, Contrast, Overpaint, Hide Zone),
image orientation (Rotation / Flip / Invert), and colour (Solid or **Adaptive** duotone, RGBA +
Random, Alpha). Presets (built-ins + user-saved). **Export is WYSIWYG** — PNG/JPG/SVG/Figma
serialise the exact preview points (SVG is resolution-independent; raster honours an export
Scale). Single-file vanilla HTML/CSS/JS — the placement runs on a downscaled preview for speed.

---

## Living Path — Generative Font/Path Modification

Web port of [ivangrozny/LivingPath](https://github.com/ivangrozny/LivingPath) ("glyph
hydrography"). Two engines — **Vector** (Bézier-node jitter/wobble/inflate/roughen/twist,
topology-preserving) and **Raster** (rasterise → 9 pixel algorithms — dilate/erode, blur,
threshold, noise, particles, centre-line, polygonize, seam-carve, reaction-diffusion →
re-vectorise; can change topology — the melted/cellular look), chainable Vector→Raster. Layer
**groups + blend modes**, 24 presets, live multi-language text specimen, and installable
**OTF export** (full charset, randomised `rand`/`aalt` alternates) run off a Web Worker so it
never blocks the UI. Manual: `docs/LIVINGPATH.md`.

---

## Halide — Photo → 1-bit Dithered Portrait

Real dithering — **Floyd–Steinberg**, **Atkinson**, and recursive-**Bayer** ordered dithering,
plus a flat-threshold baseline — not a filter. **Remove background** (colour-key, click-to-pick
reference), a sticker **Outline** (silhouette clean-up handles wispy hair and enclosed
highlights), **Background fill** outside the outline, and an interactive **drag-to-position**
square crop. Export **PNG/JPG/SVG/Figma**; SVG has an opt-in **Simplify shapes** toggle that
traces each region into a single rectilinear path instead of tiling it with rectangles (verified
pixel-exact, ~36% smaller files). Manual: `docs/HALIDE.md`.

---

## Komorebi — Volumetric Light / God Rays / Dapple

木漏れ日 ("sunlight leaking through trees") replicated in real time on the GPU (WebGL2 —
a browser API, not a framework, so it holds the vanilla single-file rule). Three real
graphics mechanics: a **light cookie / gobo** (procedural two-layer fBm canopy *or* an
uploaded silhouette — a Halide 1-bit export, a Strata trace, or a photo) projected onto a
ground plane in perspective; **penumbra + pinhole physics** — because the sun subtends
~0.53°, gaps smaller than their own shadow-blur turn into pinholes and cast round coins of
light instead of leaf shapes (the thing that actually reads as komorebi), exposed as one
"Height" control; and **god rays** — a post-process radial blur of an occlusion buffer
(Mitchell, GPU Gems 3), no shadow map or 3D scene needed. **Scene** mode is the picture
(horizon, canopy ceiling, rays, dappled floor); **Gobo** mode is the flat tileable pattern.
Wind **Sway** is exactly periodic, so the **WebM export loops seamlessly**. Export
PNG/JPG/WebM plus a posterised **tone-band SVG separation** (one flat path per luminance
band — a real print/riso plate, traced with Halide's rectilinear contour tracer) and Figma.
Manual: `docs/KOMOREBI.md`.

---

## Roadmap

- [x] Hub — Organica entry point
- [x] Genesis — 55 animated forms + grid composer
- [x] Strata — Smart+ sketch-to-SVG pipeline
- [x] Spore — generative stippling from images
- [x] Pollen — advanced stippling (blue-noise engine)
- [x] Living Path — generative font/path modification (Vector + Raster, OTF export)
- [x] Halide — photo → 1-bit dithered portrait (real dithering, background removal, outline)
- [x] Komorebi — WebGL2 volumetric light / god rays / penumbra dapple (Scene + Gobo, WebM loop, SVG separation)
- [x] Docs — Vision, Roadmap, Animation System, Living Path, Halide, Komorebi
- [ ] Phase 2 — Genesis export (SVG/PNG/GIF), save/load, more forms
- [ ] Phase 3 — Figma direct push (Genesis + Strata)
- [ ] Phase 4 — Pattern engine (tiling, grid variants)
- [ ] Phase 5 — Strata AI (auto-element detection, form matching)
- [ ] Phase 6 — Output pipeline (print PDF, mural schema, installation loop)

See `docs/ROADMAP.md` for full detail.

---

*Studio Rann · Organica System v0.1 · July 2026*
