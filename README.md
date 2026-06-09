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

---

## Repo Structure

```
organic-strata/
├── index.html           ← Organica hub (dark, animated noise field)
├── genesis/
│   ├── index.html       ← Genesis Creator composer
│   ├── indicators.html  ← 55-form animated catalog
│   ├── organic-library.css   ← 55 CSS @keyframes animations
│   ├── organic-forms.js      ← SVG markup for all 55 forms
│   ├── organic-defs.js       ← Shared SVG defs (goo filters + shapes)
│   └── genesis-creator.js    ← Composer interaction logic
├── strata/
│   └── index.html       ← Strata app with Smart+ tracing algorithm
├── spore/
│   └── index.html       ← Spore — generative stippling (single-file)
├── pollen/
│   └── index.html       ← Pollen — advanced stippling, blue-noise engine (single-file)
├── backend/             ← Python + OpenCV + vtracer (local only)
├── docs/
│   ├── VISION.md        ← System vision and methodology
│   ├── ROADMAP.md       ← Development phases
│   └── ANIMATION-SYSTEM.md  ← Animation pattern documentation
├── CLAUDE.md            ← Project memory for AI sessions
└── vercel.json          ← Routing configuration
```

---

## Architecture

```
Hub (index.html)
├── /genesis/     → Genesis Creator + Indicators (static, Vercel)
├── /strata/      → Strata tracing app (static, Vercel)
├── /spore/       → Spore stippling app (static, Vercel)
├── /pollen/      → Pollen advanced stippling app (static, Vercel)
└── /backend      → Python server (local only, not deployed)
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

## Roadmap

- [x] Hub — Organica entry point
- [x] Genesis — 55 animated forms + grid composer
- [x] Strata — Smart+ sketch-to-SVG pipeline
- [x] Spore — generative stippling from images
- [x] Pollen — advanced stippling (blue-noise engine)
- [x] Docs — Vision, Roadmap, Animation System
- [ ] Phase 2 — Genesis export (SVG/PNG/GIF), save/load, more forms
- [ ] Phase 3 — Figma direct push (Genesis + Strata)
- [ ] Phase 4 — Pattern engine (tiling, grid variants)
- [ ] Phase 5 — Strata AI (auto-element detection, form matching)
- [ ] Phase 6 — Output pipeline (print PDF, mural schema, installation loop)

See `docs/ROADMAP.md` for full detail.

---

*Studio Rann · Organica System v0.1 · June 2026*
