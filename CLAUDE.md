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
│   ├── organic-animations.css ← 77 @keyframes + 55 .aNN rules — the REUSABLE half (append-only)
│   ├── organic-page.css      ← :root palette + Genesis catalog page chrome
│   ├── organic-library.css   ← @import shim: page + animations (historic entry point)
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
├── shared/              ← Cross-tool system assets
│   ├── organica-tokens.css ← Manrope + type scale + spacing (load FIRST)
│   ├── organica-core.js    ← download, presets, Figma, tracer, zoom/pan
│   └── _template.html      ← Start a new tool from this
├── backend/             ← Python + OpenCV + vtracer — DO NOT TOUCH
├── docs/
│   ├── VISION.md        ← Full system vision and methodology
│   ├── ROADMAP.md       ← Development phases and open questions
│   ├── ANIMATION-SYSTEM.md  ← Animation pattern documentation
│   ├── SHARED-LIBRARY.md ← Shared-library contract + storage conventions
│   ├── DESIGN-SYSTEM.md ← Manrope, type scale, tokens, Figma mapping
│   ├── UI-SHELL.md      ← The standard tool layout + behaviour contract
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

- **Design tokens — mandatory, every new development.** Never hardcode a font-size, spacing (padding/margin/gap), radius, or UI-chrome colour — use the matching token from `shared/organica-tokens.css` (`--fs-*`, `--space-*`, `--radius-*`, `--ink`/`--paper`/`--panel`/`--mid`/`--border`/`--border-strong`/`--tool`/`--accent-warm`/`--track-bg`). If the value you need doesn't exist on any existing scale, **stop and ask before adding a new token** — don't invent one silently and don't fall back to a raw px/hex "just this once." Live reference with every token and component, rendered from the real CSS: `/design-system/` (linked from the hub). Full narrative + Figma mapping: `docs/DESIGN-SYSTEM.md`. Two real exceptions, not loopholes: (1) a tool's own **content** colour (Halide's ink/paper for the dithered image, Pollen's point colour) is user data, not design-system chrome — don't tokenise it just because it happens to default near `--ink`/`--paper`; (2) a genuine pill/stadium shape (`border-radius` = half the element's height, e.g. a toggle switch) isn't a corner radius — forcing it onto `--radius-sm/md/lg` flattens the capsule. Typography specifically: **Manrope only**, via `--font`, never a second typeface.
- **Shared code** — `shared/organica-core.js` owns download, preset storage + legacy migration, Figma postMessage, colour hex validation, the rectilinear contour tracer and zoom/pan. Don't re-implement these in a tool; if one needs different behaviour, extend the core
- **New tool** — start from `shared/_template.html`, not by copying a neighbour. Contract: `docs/UI-SHELL.md`
- **`organic-animations.css`** — never modify existing rules, only append new ones (the 55 forms depend on the exact timings/selectors). This is the split-out pure half of the old `organic-library.css`; the append-only rule now lives here. Any consumer linking it **must** define `--ink` and `--bg-cell` — see `docs/SHARED-LIBRARY.md`
- **`organic-library.css`** — now an `@import` shim (`organic-page.css` + `organic-animations.css`, in that order — the order is load-bearing for the cascade). Don't put rules back into it
- **localStorage keys** — always `organica.<tool>.<thing>`. When renaming a key, migrate forward and **leave the legacy key in place** (user presets/forms are real work); never delete it in the same release
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
- **July 26, 2026 (accessible names + contrast)** — Two fixes, both found by measuring rather than assuming. **(1) Accessible names:** audited all six panels and found **121 of ~210 form controls with no accessible name** — a slider sat next to a `.ctrl-label` reading "Grid width" with nothing tying them together, so a screen reader announced "slider" with no name. Same markup pattern (row → label + control, no `for`/`aria-labelledby`) in every tool, so fixed once as `Organica.autoLabelPanel(document)` in `organica-core.js` instead of 121 hand-edits. **Two bugs caught only by re-measuring after the first pass, not by reading the diff:** the first edit deleted `global.Organica = Organica;` while adding the new function, which would have broken *every* tool silently (no console error until something called `Organica.*`); and the `hasName()` check treated any `el.closest('label')` as "already named", so Strata's toggle switches (checkbox wrapped in an empty `<label class="toggle">` styled as a slider knob, no text) were skipped as false-positives — fixed by requiring the wrapping label to have non-empty text. Final: **0 of ~210 unnamed**, segmented buttons keep their own visible text (the function skips buttons that already have text — `aria-labelledby` replaces a name, it doesn't add to one), zero runtime errors. **(2) Contrast:** requested a "just a little more margin" on `panel/value`/`panel/sub-label`; measuring first showed it was already a **real AA failure**, not a margin problem — `--mid` was **three different values** across tools (Strata's own `--muted: #888` at 3.17:1, Spore's `--mid: #c8c0b0` at **1.62:1**, everyone else's `#726a5e` at 4.43:1 *on panel background* — all below the 4.5:1 floor). Unified to **`#696256`** everywhere (5.4:1 paper / ≥5.0:1 panel, real headroom, computed the same way as `--border-strong`). Also separately answered a **px vs rem** question: kept px — browser zoom at 200% already scales the panel correctly with px (verified: no overflow, no clipping), rem's only real benefit is respecting an OS-level font-size override (rarer path than zoom), and the panel is pixel-grid-locked (26px rows, 1px borders, a hierarchy resting on a single px of difference) so a partial rem conversion would break alignment — documented as a conscious choice, not silently decided. Docs: `docs/DESIGN-SYSTEM.md` §5 (`--mid`) and §6 (accessible names).
- **July 25, 2026** — Shipped **Komorebi** (`/komorebi/`), the first **WebGL2** tool in Organica (a browser API, not a framework — holds the vanilla/single-file rule; a Canvas2D radial blur would be ~9M ops/frame, dead). Replicates 木漏れ日 — dappled sunlight through a canopy — via the three real graphics mechanics Diego named: **(1) light cookie / gobo** — a canopy mask (procedural 2-layer fBm foliage combined with `max()` so gaps only exist where both layers open; OR an uploaded silhouette, so a Halide 1-bit export / Strata trace / photo drops straight in as the canopy) projected onto a ground plane in perspective, two layers domain-warped at different rates = wind; **(2) penumbra + pinhole** — the detail nobody implements and the thing that *makes* it komorebi: the sun subtends ~0.53°, so a gap at height h blurs its shadow edge by ≈ h/108, and once a gap is smaller than that blur it becomes a pinhole projecting a round disc of the sun instead of the leaf shape. Implemented as ONE "Height" control = a disc-kernel sample radius over the cookie (golden-angle taps, per-sample rotation), so small gaps naturally wash into soft coins of light — verified visibly in Gobo mode; **(3) god rays** — post-process radial blur of an occlusion buffer (Mitchell, GPU Gems 3 ch.13), *no* shadow map / *no* 3D scene — the occluder is the same 2D canopy, so pass A (occlusion, half-res) and pass B (composite) share the CANOPY_LIB + PROJECT_LIB GLSL chunks and can never disagree. Two modes: **Scene** (horizon + canopy ceiling + rays + dappled floor — the picture) and **Gobo** (orthographic flat fill — the tileable *pattern*, the Phase-4 feed). **Wind: Sway | Drift** — Sway is built from a single phase angle so the field is exactly periodic → the **WebM export is a genuinely seamless loop** (Phase-6 installation deliverable); Drift travels and deliberately doesn't loop. WYSIWYG discipline (same as Pollen/Halide/Living Path): one `renderFrame(w,h)` serves preview, PNG/JPG (`toDataURL`, sync — `toBlob` raced the canvas resize-back), WebM frames, and the pixel source the SVG reads. **SVG export = posterised tone-band separation** — a volumetric field has no honest 1:1 vector form, but N flat luminance bands traced into one path each *is* honest and is a real print/riso separation (bands stacked as "≥ level" regions so no hairline seams); reuses **Halide's rectilinear contour tracer verbatim** (evenodd fill). 8 built-in presets (Forest Floor / High Noon / Cathedral / Shoji / Undergrowth / Riso Two-Tone / Dusk Ember / Bamboo), each a complete deterministic state layered over the Forest-Floor baseline; custom presets via `localStorage`. Drag on canvas = move the sun (rays + light pools both read `uSunUV`). Hub nav + `/komorebi/` route added. Manual: `docs/KOMOREBI.md`.
- **July 25, 2026 (panel layout)** — Consolidated to **one control panel, always on the right**. Strata's only panel was on the left (grid flipped to `1fr var(--panel-w)`, aside moved to `grid-column: 2 / grid-row: 2` — the first attempt used `grid-row: 1/-1` and the aside fought the header for row 1, pushing it below the panel). Living Path had **two** panels; merged into one, ordered *what you load → what you apply → what you inspect* (Input · Presets · Effect stack · Source view), giving the stage the full width. Genesis Library keeps its left column on purpose — it lists **sets**, which is navigation, not controls. Verified: all six tools now report exactly one panel, on the right, 248px, zero uppercase, zero runtime errors.
- **July 25, 2026 (panel component)** — Audited the six control sidebars (Strata, Spore, Pollen, Living Path, Halide, Komorebi): **four different section-heading styles** (9/400, 10/500, 12/600×3), **three widths** (240/244/280), **two slider tracks** (2px/3px), two label sizes, **76 uppercase elements**, and two markup vocabularies (`.ctrl-row` vs `.row`). New **`shared/organica-panel.css`**, modelled on Figma's Design panel: **sentence case everywhere, no tracking on labels**, three levels of hierarchy (section → sub-label → row), one row height so controls align down the column, tabular values so numbers don't jitter under a dragging slider. Section title went 12px/600 uppercase+0.1em → **11px/500 sentence** — smaller on the page *and* faster to scan, which is the whole argument for dropping caps. Class names match what the tools already used, so adoption was "link the file, delete the local copy"; `.sec h3` / `.row` / `.group-label` are aliased so Strata's and Living Path's JS is untouched. Verified: **0 uppercase** across all six, one width (248px), one slider (2px), one heading (11px/500), nothing below 9px, all Manrope, zero runtime errors. Two things worth knowing: the tool's `<style>` loads *after* the component, so a leftover local rule silently wins — migrating means deleting, not just linking (Living Path's `.sec h3` survived my first pass and its headings fell back to the browser's default `h3` size); and Strata deliberately keeps its full-width slider with min/max captions ("Clean → Raw") — the slider's visual style is unified but that layout does real work for its audience, so it's a documented variant, not drift. Also lifted 6px index numerals and 8px captions in Spore/Pollen to `--fs-micro`.
- **July 25, 2026 (header component)** — Audited every header outside the hub: **five different structures for ten pages** (`#topbar` in Spore/Pollen/Halide/Komorebi, `.top` in Living Path, `<header>`+`.toolbar` in Strata, an editorial `<header>` in Genesis index/Indicators, `.toolbar` in Library/Creator), plus a stale `#organica-banner` migration notice on three pages. The four main tools had **8–9 interactive controls in a 40px bar** and, measured: no `<header>`/`<nav>`/`<main>` landmark at all, **zero `aria-*` attributes**, a `#status-text` mutated from JS with no live region (so export progress was never announced), `:focus` defined on only 3 of 10 pages, `title=`-only explanations (unreachable by keyboard), and `--border` #d0c8b8 at **1.49:1** — failing even the 3:1 UI minimum. New **`shared/organica-header.css`** + `Organica.status()` / `Organica.popover()`: one component, five slots (identity · context · status · spacer · actions), three variants (Tool / Catalog / Editor — only the Context slot differs). **The rule: identity, context, status, at most three actions.** Everything else moved to where it acts — Export Scale + Simplify + PNG/JPG/SVG into an **Export popover** (with `aria-expanded`, Escape, click-outside and focus-return, verified step by step), Komorebi's Play/Pause/Reset onto the **canvas HUD** next to the clock they control (they were split: time read bottom-left, controlled top-right), and REC into the popover's Motion group since it is an export, not a transport. Applied to Halide (8→4 controls) and Komorebi (9→3). `--border-strong` is **computed, not eyeballed**: a first pass at #b5a992 *looked* right and measured 2.08:1; the shipped #958462 is 3.27:1 on paper and 3.03:1 on panel. Logo link target went 14px→26px (WCAG 2.2's inline-link exception doesn't cover a nav control). Responsive fixed too — the old bar never overflowed, flex just squeezed until logo/"EXPORT SCALE"/"→ FIGMA" each wrapped onto two lines inside 40px; the component sheds the least-critical text instead (verified at 700px: no wrap, no clip). Template updated so new tools inherit it. **Dev gotcha, third time:** `python3 -m http.server` cached `organica-core.js` so hard the page ran a stale copy and threw `Organica.status is not a function` with an empty console — replaced with a `no-store` dev server; when a change seems not to apply, suspect cache before code. Still to migrate: Spore, Pollen, Living Path, Strata, Genesis pages.
- **July 25, 2026 (system pass)** — Three cleanups that turn "coherence by copy-paste" into an actual system, done ahead of the Phase-4 Pattern Engine. **(1) `shared/organica-core.js`** — the copy-shared JS is now one module: download, preset storage + legacy migration, Figma postMessage, hex validation, the rectilinear contour tracer, zoom/pan. The copies had **already drifted**, which is the whole argument: Living Path revoked its download URL after a delay (correct) while three tools revoked immediately (can cancel the download); Komorebi's tracer emitted `.toFixed(2)` coordinates while Halide emitted integers; Komorebi validated colour hex while **Halide did not** (typing junk in a hex field set an invalid colour). Each merged routine is the better of the variants — the unified tracer emits the shortest correct form, so it is byte-identical to Halide's *and* **43% smaller than Komorebi's**, proven on 48 equivalence cases incl. checkerboard saddles, ring-with-hole, solid and empty masks (geometry identical everywhere). Wired into Halide, Komorebi, Pollen, Spore. **(2) Typography unified to Manrope** via `shared/organica-tokens.css`. Killed four families (Syne, Syne Mono, DM Sans, DM Mono, Georgia, ui-monospace) and four variable names for one idea (`--font`/`--sans`/`--mono`/`--display` → **`--font`**, old names kept as aliases). **The real find: six of eleven pages declared `'DM Mono'` and never loaded it** — Spore, Pollen, Halide, Komorebi, Genesis Library and Creator had been silently rendering system monospace, so the design was never what the CSS claimed. Verified: all 11 pages carry the tokens, zero old families, zero stale imports, Manrope loads as a variable font (200–800). **(3) `docs/DESIGN-SYSTEM.md` + `docs/UI-SHELL.md` + `shared/_template.html`** — type scale (1.2 ratio anchored at 11px), weights, tracking, spacing, per-tool accents, each with the **Figma text-style mapping** (Figma tracking is a *percentage*, CSS is em — they map 1:1, don't type 0.08 into Figma). The template is a working page, verified rendering with zoom/pan already wired from the core. **Known drift left honest, not hidden** (documented in UI-SHELL §7): panel widths still 240/244/260, Genesis pages use a different shell entirely, Strata and Living Path weren't retro-fitted, and Spore/Pollen/Halide still run their own inline zoom/pan — migrating those is safe but untested, so it's a follow-up rather than done blind.
- **July 25, 2026 (housekeeping)** — Two architectural cleanups ahead of the Phase-4 Pattern Engine, which will be the 8th consumer of the shared library. **(1) Split `organic-library.css`** — it mixed the 77 keyframes with the Genesis *catalog page* layout (`body{padding}`, `header`, `.grid`, `.cell`), so any tool wanting the animations inherited page chrome. Now `organic-animations.css` (pure, reusable, append-only rule moved here) + `organic-page.css` (chrome), with `organic-library.css` kept as an `@import` shim so every existing link is untouched — page chrome imports first, animations second, order load-bearing. **Verified rule-for-rule** on index/library/creator: identical computed vars, body metrics, 77 reachable keyframes, exact flattened rule counts (372/350/353 = lib+inline as before), and forms 1/29/36/48 computing identical fill/stroke/animation. **The load-bearing discovery:** the animations need `--bg-cell`, but *none* of the three Genesis pages define it — they inherited it only from the `:root` inside the old bundle, and only forms 29 (iris) and 36 (moon mask) use it to punch holes. A naive split would have turned exactly two forms into black blobs and left the other 53 fine — near-invisible. That contract is now documented at the top of `organic-animations.css` and in `docs/SHARED-LIBRARY.md`. **(2) Standardised localStorage** to `organica.<tool>.<thing>` (was three different separators: `pollen-presets`, `halide-presets`, `organica_komorebi_presets`, `organica_library`). Each tool migrates forward on first read and **deliberately does not delete the legacy key** — presets and custom forms are real user work, and leaving the old copy means a rollback still finds them. Genesis is the delicate one: `organica.library.forms` is read/written by *both* `library.html` and `creator.html`, so they carry an identical `readLibraryRaw()` that must stay in sync. Verified end-to-end per tool (seed legacy → read → migrate → save new → legacy stays frozen) and cross-file for Genesis. **Dev gotcha that cost a cycle:** the Genesis migration looked broken on reload and was just the dev-server cache — `?v=N` fixed it, exactly as `docs/LIVINGPATH.md` already warned. New doc: `docs/SHARED-LIBRARY.md`.
- **July 25, 2026 (later same day)** — Komorebi: **Scene mode removed from the UI** per direct feedback — Diego wants pattern-making (Riso Two-Tone, Shoji direction), not a landscape picture; the Scene shader code stays in place but inert (`uMode` now hardcoded to gobo in JS) so nothing downstream (occlusion pass, rays, SVG separation) had to change. Canopy got two new controls for organic realism: **Clumping** (a slow low-frequency field that varies local leaf density across the frame — denser thickets, wider gaps, instead of one uniform threshold) and **Leaf detail** (a fine high-frequency layer that scallops the leaf edges and flecks pinholes through the interior, instead of smooth blob edges). Rebuilt the preset set around Gobo-only patterns: **Forest Floor / Riso Two-Tone / Shoji / Dense Canopy / Sparse Grove / Fine Foliage** (the old Scene-tuned presets — High Noon, Cathedral, Undergrowth, Dusk Ember, Bamboo — were dropped, not just hidden). Caught in verification: the first "Dense Canopy" tuning (density 0.74 + leaf-detail 0.55) rendered near-solid black — Leaf detail's nibble subtracts as often as it adds, so on an already-high-density field it closed off the few remaining gaps instead of texturing them; fixed by lowering density to 0.60 and leaf-detail to 0.35. Lesson for tuning future presets: Leaf detail and Density fight each other at the high end, verify visually rather than reasoning from slider values alone.
- **July 2026** — Shipped **Living Path** (`/livingpath/`), a full web port of ivangrozny/LivingPath (single-file vanilla). Two engines (Vector node-effects | Raster "glyph hydrography"), layer **groups + blend modes**, 9 raster algorithms (dilate/erode, blur, threshold, noise, particles, center-line, polygonize, seam-carve, reaction-diffusion), 24 presets mapped to the author's example sheets, **Vector→Raster chaining**, live multi-language **text specimen**, and installable **OTF export** (charset/name/HTML specimen/`.lvp` projects/**randomised alternates** via `rand`+`aalt`) run off a **Web Worker**. Manual: `docs/LIVINGPATH.md` (incl. §12 Development notes). Key invariant: preview = specimen = export share one normalised 1000-box scale (WYSIWYG). **Dev gotchas** (also in the manual): the dev server caches aggressively — hard-refresh / `?v=` when testing; `<svg>` and `display:flex/grid` both defeat the `hidden` attribute (toggle a class instead); verify visibility via `getComputedStyle().display`, not the attribute. **Still open:** Genesis Creator Bézier tangent-handle drag/edit (flagged since setup, unresolved).

---

*Studio Rann · Updated July 2026*
