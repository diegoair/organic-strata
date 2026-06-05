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
├── backend/             ← Python + OpenCV + vtracer — DO NOT TOUCH
├── docs/
│   ├── VISION.md        ← Full system vision and methodology
│   ├── ROADMAP.md       ← Development phases and open questions
│   └── ANIMATION-SYSTEM.md  ← Animation pattern documentation
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

- **June 2026** — v0.1 live. Hub + Genesis + Strata deployed on theorganicalanguage.vercel.app. Vercel team renamed to studio_rann. Docs created (VISION, ROADMAP, ANIMATION-SYSTEM).

---

*Studio Rann · Updated June 2026*
