# CLAUDE.md — Organica Project Memory

> This file is read by Claude at the start of every session.  
> It contains all the context needed to work on this project without re-explaining.  
> Keep it updated as the project evolves.

---

## Who

**Diego** — solo designer/artist, Studio Rann.  
This is his primary creative and production tool. Not a side project.

---

## What

**Organica** is two things simultaneously:
1. Studio Rann's visual language system
2. The AI-powered toolset to develop, generate, and deploy that language

The visual language is built on three references tuned together:
- **Biomimicry** — perfect organic geometries (nautilus, phyllotaxis, cellular growth)
- **Raw organic nature** — imperfect, living forms (drop marks, erosion, growth patterns)
- **Street art language** — bold marks, scale, presence, immediacy — the calibration mechanism that makes the other two feel grounded, not academic

The fundamental gesture is the **drop mark**: pigment dropped onto a surface, governed by gravity, viscosity, surface tension. Not drawn — allowed to happen. Two atoms: **drop + brushstroke**. Everything else derives from these.

---

## The Methodology

Based on **"Flexible Visual Systems"** by Martin Lorenz.  
Core principle: a visual system is a **grammar** — rules that generate infinite variations while remaining coherent.

Modules in Organica:
- **Form** — drop marks, brushstrokes, traced hand-drawn shapes
- **Pattern** — tiling/repetition (manual now, automated in roadmap)
- **Grid** — Genesis composer N×N cells
- **Color** — 3 base palettes (sky & sun / earth / deep sea), expandable
- **Typography** — undefined, TBD
- **Motion** — 55 organic CSS animations (Genesis library)
- **Scale** — vector-first, screen to mural

---

## The Tools (Live)

| Tool | URL | What it does |
|---|---|---|
| **Hub** | `theorganicalanguage.vercel.app` | Entry point, links to all tools |
| **Genesis** | `theorganicalanguage.vercel.app/genesis/` | 55 animated organic forms + grid composer |
| **Indicators** | `theorganicalanguage.vercel.app/genesis/indicators.html` | Full catalog of all 55 forms |
| **Strata** | `theorganicalanguage.vercel.app/strata/` | Sketch → SVG tracing, Smart+ algorithm |
| **Spore** | `theorganicalanguage.vercel.app/spore/` | Generative stippling from images — SVG mark library, zoom/pan, PNG/JPG/SVG export, Figma |
| **Pollen** | `theorganicalanguage.vercel.app/pollen/` | Advanced stippling — blue-noise engine, Circle/Polygon/Line points, Adaptive duotone, presets, PNG/JPG/SVG export, Figma |
| **Living Path** | `theorganicalanguage.vercel.app/livingpath/` | Generative font/path modification (web port of ivangrozny/LivingPath). Vector + Raster engines, layer groups + blend modes, 9 raster algorithms, 24 presets, live text specimen, installable OTF export (Web Worker), .lvp projects |
| **Halide** | `theorganicalanguage.vercel.app/halide/` | Photo → true 1-bit dithered portrait. Floyd–Steinberg / Atkinson / Bayer ordered / flat threshold; background removal (colour-key, Pick/Auto), sticker Outline, Background fill, interactive drag-to-position square crop; PNG/JPG/vector SVG (optional contour-traced "Simplify shapes")/Figma export. Manual: `docs/HALIDE.md` |
| **Komorebi** | `theorganicalanguage.vercel.app/komorebi/` | 木漏れ日 — dappled sunlight through a canopy, real-time on the GPU (WebGL2). Light-cookie/gobo canopy (procedural fBm or uploaded silhouette) projected in perspective; **penumbra/pinhole** physics (small gaps → round coins of light); post-process **god rays** (radial-blur occlusion buffer); Scene + Gobo (tileable pattern) modes; periodic wind → **seamless WebM loop**; PNG/JPG/WebM + posterised tone-band **SVG separation** (Halide's tracer)/Figma. Manual: `docs/KOMOREBI.md` |

---

## Repo Structure

```
organic-strata/          ← GitHub repo name (diegoair/organic-strata)
├── index.html           ← Organica hub (dark, animated noise field)
├── genesis/
│   ├── index.html       ← Genesis Creator composer
│   ├── indicators.html  ← 55-form catalog
│   ├── organic-library.css   ← 55 @keyframes animations — PORT VERBATIM
│   ├── organic-forms.js      ← SVG markup for 55 forms — PORT AS DATA
│   ├── organic-defs.js       ← Shared SVG defs (goo filters + chips) — INJECT ONCE
│   └── genesis-creator.js    ← Composer interaction logic
├── strata/
│   └── index.html       ← Strata app (OrganicStrata with Smart+)
├── spore/
│   └── index.html       ← Spore — generative stippling (single-file, vanilla)
├── pollen/
│   └── index.html       ← Pollen — advanced stippling, blue-noise engine (single-file, vanilla)
├── halide/
│   └── index.html       ← Halide — photo → 1-bit dithered portrait (single-file, vanilla)
├── komorebi/
│   └── index.html       ← Komorebi — WebGL2 volumetric light / god rays / dapple (single-file, vanilla)
├── backend/             ← Python + OpenCV + vtracer — DO NOT TOUCH
├── docs/
│   ├── VISION.md        ← Full system vision and methodology
│   ├── ROADMAP.md       ← Development phases and open questions
│   ├── ANIMATION-SYSTEM.md  ← Animation pattern documentation
│   └── KOMOREBI.md      ← Komorebi manual
├── vercel.json          ← Routing: / → hub, /genesis/ → genesis, /strata/ → strata
└── CLAUDE.md            ← This file
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework |
| Animations | Pure CSS `@keyframes` — no JS animation libraries |
| SVG processing | Python + OpenCV + vtracer (local backend only) |
| Deployment | Vercel — Studio Rann account (team slug: studiorann) |
| Repository | GitHub — `diegoair/organic-strata` |
| Design integration | Figma (manual now, direct push in roadmap) |

---

## Critical Rules — Never Break These

- **`organic-library.css`** — never modify existing rules, only append new ones
- **`organic-forms.js` / `organic-defs.js`** — treat as data, port verbatim
- **`backend/`** — do not touch Python files unless explicitly asked
- **`strata/`** — do not touch unless explicitly asked
- **Color in SVG forms** — always `fill: var(--ink)` / `stroke: var(--ink)`, never hardcode hex
- **Internal links** — always relative (`/genesis/`, `/strata/`), never absolute Vercel URLs
- **New forms** — follow the pattern in ANIMATION-SYSTEM.md, test in indicators.html first

---

## Animation System — Quick Reference

6 patterns, each maps to real physics:

1. **Internal Pressure** — `scale` + asymmetric `cubic-bezier` → breath, heartbeat, lung
2. **Gravity + Viscosity** — `translateY` + `scaleY` → drops, honey, lava
3. **Growth by Tracing** — `stroke-dashoffset` → vine, roots, tree rings
4. **Collective Behaviour** — staggered `animation-delay` + goo filter → swarm, metaballs
5. **Environmental Forces** — continuous `translate`, `linear` easing → wind, tide, sedimentation
6. **Differential Rotation** — counter-spinning layers at different speeds → orbit, shard rotation

Duration range `1.4s–14s` maps to real-world time scales. See `docs/ANIMATION-SYSTEM.md` for full detail.

---

## Output Formats Diego Produces

- Tavole grafiche / composition studies
- Posters (print + digital)
- Web pages (animated SVG)
- Branding systems for clients
- Mural schemas (large format, scale-agnostic vector)
- Art installations (generative animation loops)

---

## Roadmap Priorities (in order)

1. **Phase 2** — Genesis depth: export SVG/PNG/GIF, save/load, more forms, rotation/opacity controls
2. **Phase 3** — Figma direct push: Genesis → Figma, Strata → Figma
3. **Phase 4** — Pattern engine: tiling, grid variants, density control
4. **Phase 5** — Strata AI: auto-element detection, form matching
5. **Phase 6** — Output pipeline: print PDF, mural schema, installation loop

---

## Open Questions (Decisions Pending)

- Typography module — what role does type play? System font or custom?
- Color system — how are colors managed beyond the 3 Genesis palettes?
- Client workflow — what does the Organica handoff look like for client branding?
- Mural scale — largest format needed? DPI requirements?

---

## Session Notes

*Add dated notes here as the project evolves:*

- **June 2026** — Completed full setup: hub live at theorganicalanguage.vercel.app, Genesis Creator integrated with 55 forms, Strata with Smart+ at /strata/, Vercel team renamed to studio_rann, docs/ folder created with VISION.md, ROADMAP.md, ANIMATION-SYSTEM.md. CLAUDE.md added to root.
- **June 9, 2026** — Shipped **Spore** (`/spore/`, generative stippling) and **Pollen** (`/pollen/`, advanced stippling). Pollen: variable-radius blue-noise engine, Circle/Polygon/Line points with Size/Angle Range + Random + Warping, Gamma/Contrast/Overpaint/Hide Zone, Rotation/Flip/Invert, Solid/Adaptive colour with RGBA + Random, presets, and WYSIWYG PNG/JPG/SVG/Figma export (export serialises the exact preview points). Both are single-file vanilla HTML/CSS/JS. Hub nav + `/spore/` + `/pollen/` routes added.
- **July 23, 2026** — Prototyped **Halide** (`/halide/`), a single-file dither-portrait tool inspired by evaluating ditherface.com (a manual $150-per-slot commission service, not a tool). Real Floyd–Steinberg + Atkinson error diffusion and recursive-Bayer ordered dithering (verified: no prior dithering code existed in the repo — algorithms written from scratch), plus a flat-threshold baseline. Reuses Pollen's shell verbatim where it fit: drop-zone, zoom/pan, tone pipeline (rotation/flip/invert/gamma/contrast, + a new Bias shift), PNG/JPG/SVG export, and the `organica-svg` → Figma postMessage protocol. Square-crop toggle for avatar framing. One `runs` (row run-length-encoded ink cells) feeds preview canvas, raster export, and true-vector SVG output alike — same shared-function WYSIWYG discipline as Pollen/Living Path. 8 built-in presets + localStorage custom presets. Not yet added to `docs/` as a dedicated manual — do that once the prototype's shape is confirmed with Diego.
- **July 24, 2026** — Closed out the first full arc on **Halide**, validated against a real test photo (`halide/test-photos/`, deliberately kept out of git). Shipped: **background removal** (colour-key, global threshold — not connected flood-fill, which let lighting gradients bleed the flood into the subject; **Pick…**/Auto reference, since border-average contaminates the moment the subject touches the frame edge); a **sticker Outline** (largest-connected-component + enclosed-hole-fill for the silhouette, diagonal-corner-touch bridging so the ring always reads solid); **Background fill** outside the outline (pure subtraction, independent of Paper); an **interactive drag-to-position square crop** (replaced Crop X/Y sliders entirely, per direct feedback that a slider divorced from the visual is worse than dragging the frame on the photo); a **true colour swap** (Swap Colors now only trades hex values — verified byte-identical shapes before/after — it no longer silently toggles Invert, which is a real image change, not a recolour); the **Ditherface** preset (Atkinson + square + background-removed + Outline + Background fill, the validated reference-matching look, replacing the now-redundant "Studio Rann Ink"); and **"Simplify shapes"**, an opt-in SVG-export toggle that traces each region into one rectilinear `<path>` (evenodd fill-rule for holes) instead of a pile of `<rect>` tiles — verified pixel-exact against the tiled version on every tested case, 4,789 rects → 4 paths on the reference photo. Evaluated and **explicitly declined**: swapping the square/pixel mark for Genesis organic forms (would duplicate Pollen, and would undo the Simplify win since organic marks don't merge like rectilinear cells do); autonomous/hover-reactive pixel animation (autonomous fits the existing Motion vocabulary and is worth revisiting as an animated-SVG export; mouse-hover reactivity needs real JS and can't be a static export file — different deliverable, not built). Full manual: `docs/HALIDE.md`.
- **July 25, 2026** — Shipped **Komorebi** (`/komorebi/`), the first **WebGL2** tool in Organica (a browser API, not a framework — holds the vanilla/single-file rule; a Canvas2D radial blur would be ~9M ops/frame, dead). Replicates 木漏れ日 — dappled sunlight through a canopy — via the three real graphics mechanics Diego named: **(1) light cookie / gobo** — a canopy mask (procedural 2-layer fBm foliage combined with `max()` so gaps only exist where both layers open; OR an uploaded silhouette, so a Halide 1-bit export / Strata trace / photo drops straight in as the canopy) projected onto a ground plane in perspective, two layers domain-warped at different rates = wind; **(2) penumbra + pinhole** — the detail nobody implements and the thing that *makes* it komorebi: the sun subtends ~0.53°, so a gap at height h blurs its shadow edge by ≈ h/108, and once a gap is smaller than that blur it becomes a pinhole projecting a round disc of the sun instead of the leaf shape. Implemented as ONE "Height" control = a disc-kernel sample radius over the cookie (golden-angle taps, per-sample rotation), so small gaps naturally wash into soft coins of light — verified visibly in Gobo mode; **(3) god rays** — post-process radial blur of an occlusion buffer (Mitchell, GPU Gems 3 ch.13), *no* shadow map / *no* 3D scene — the occluder is the same 2D canopy, so pass A (occlusion, half-res) and pass B (composite) share the CANOPY_LIB + PROJECT_LIB GLSL chunks and can never disagree. Two modes: **Scene** (horizon + canopy ceiling + rays + dappled floor — the picture) and **Gobo** (orthographic flat fill — the tileable *pattern*, the Phase-4 feed). **Wind: Sway | Drift** — Sway is built from a single phase angle so the field is exactly periodic → the **WebM export is a genuinely seamless loop** (Phase-6 installation deliverable); Drift travels and deliberately doesn't loop. WYSIWYG discipline (same as Pollen/Halide/Living Path): one `renderFrame(w,h)` serves preview, PNG/JPG (`toDataURL`, sync — `toBlob` raced the canvas resize-back), WebM frames, and the pixel source the SVG reads. **SVG export = posterised tone-band separation** — a volumetric field has no honest 1:1 vector form, but N flat luminance bands traced into one path each *is* honest and is a real print/riso separation (bands stacked as "≥ level" regions so no hairline seams); reuses **Halide's rectilinear contour tracer verbatim** (evenodd fill). 8 built-in presets (Forest Floor / High Noon / Cathedral / Shoji / Undergrowth / Riso Two-Tone / Dusk Ember / Bamboo), each a complete deterministic state layered over the Forest-Floor baseline; custom presets via `localStorage`. Drag on canvas = move the sun (rays + light pools both read `uSunUV`). Hub nav + `/komorebi/` route added. Manual: `docs/KOMOREBI.md`.
- **July 2026** — Shipped **Living Path** (`/livingpath/`), a full web port of ivangrozny/LivingPath (single-file vanilla). Two engines (Vector node-effects | Raster "glyph hydrography"), layer **groups + blend modes**, 9 raster algorithms (dilate/erode, blur, threshold, noise, particles, center-line, polygonize, seam-carve, reaction-diffusion), 24 presets mapped to the author's example sheets, **Vector→Raster chaining**, live multi-language **text specimen**, and installable **OTF export** (charset/name/HTML specimen/`.lvp` projects/**randomised alternates** via `rand`+`aalt`) run off a **Web Worker**. Manual: `docs/LIVINGPATH.md` (incl. §12 Development notes). Key invariant: preview = specimen = export share one normalised 1000-box scale (WYSIWYG). **Dev gotchas** (also in the manual): the dev server caches aggressively — hard-refresh / `?v=` when testing; `<svg>` and `display:flex/grid` both defeat the `hidden` attribute (toggle a class instead); verify visibility via `getComputedStyle().display`, not the attribute. **Still open:** Genesis Creator Bézier tangent-handle drag/edit (flagged since setup, unresolved).

---

*Studio Rann · Updated July 2026*
