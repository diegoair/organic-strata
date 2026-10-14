# CLAUDE.md — Organica Project Memory

> This file is read by Claude at the start of every session.  
> It contains all the context needed to work on this project without re-explaining.  
> Keep it updated as the project evolves.

---

## Who

**Diego** — designer/artist, founder of a design and art studio.

---

## What

**Organica** is two things simultaneously:
1. Diego's visual language system
2. A series of tools to develop, generate, automate and deploy multiple languages.

This is a creative tool, made for designers and artists to experiment with and compose new visual languages.
It is designed to reduce the gap between the raster world and the vector world — which is why most outputs are a vector format that can find their way into the physical world through screenprint and traditional printing, across media and formats.

---

## The Methodology

Core principle: a visual system is a **grammar** — rules that generate infinite variations while remaining coherent.

Modules in Organica:
- **Form** — seeds, elements, components, patterns and symbols. Vector shapes that enable and define the mark.
- **Canvas** — the space where the language is created
- **Grid** — composer of grids used to constrain the canvas
- **Color** — a series of tools to handle different palette methodologies and colour combinations
- **Typography** — a tool to define and create typography
- **Motion** — a series of animation engines
- **Scale** — vector-first, screen to mural
- **Rhizome** — a node-based canvas that chains the other tools into a pipeline, composing a full flexible visual system end to end

---

## The Tools (Live)

One line each — the full description of every tool (what shipped when, the controls, the export paths) is in
[`docs/TOOLS.md`](docs/TOOLS.md); the per-tool manual, where there is one, is linked. All live at
`theorganicalanguage.vercel.app/<path>/`. Single-file vanilla unless noted.

| Tool | Path | What it is · what to know before touching it |
|---|---|---|
| **Hub** | `/` | Home: stipple-field hero, live sketch gallery, the what/why. Tool navigation = the header mega menu (`shared/tools.js`). |
| **Genesis** | `/genesis/` | The seed library — Library (sets of seed ids, built-in Base Seeds = 13 organic + 6 procedural) · Create (Draw / Generate / import SVG) · Edit (parametric sliders or Paper.js bezier anchors). Own-surface variant. The 55-form animated catalog is archived at `genesis/archive/indicators-55.html` (`indicators.html` redirects). |
| **Spore** | `/spore/` | Generative stippling from images, SVG mark library. Screen/Print export, per-ink Plates. [SPORE.md](docs/SPORE.md) |
| **Pollen** | `/pollen/` | Advanced blue-noise stippling (core in `shared/pollen-engine.js`, shared with Mote). Screen/Print, Plates. [POLLEN.md](docs/POLLEN.md) |
| **Living Path** | `/livingpath/` | Font-only: type-tester canvas → effect stack (`shared/pathfx.js`, raster + instant vector tiers) → OTF; glyph editor, variable-font masters/axes, UFO + designspace export; `.lvp` v6 projects. [LIVINGPATH.md](docs/LIVINGPATH.md) |
| **Sinew** | `/sinew/` | The generic SVG / Genesis-seed half of Living Path's `shared/pathfx.js` engine; no font. Carries the Rhizome "Sinew Preset" bridge. |
| **Apostate** | `/apostate/` | From-scratch reimplementation of typoclast.com's font deformation (fixed 27-slider pipeline, .otf + .svg). Shares **zero code** with `pathfx.js` by decision. Own-surface variant. |
| **Halide** | `/halide/` | Photo → true 1-bit dither (FS / Atkinson / Bayer / threshold), background removal, crop, traced SVG. Screen/Print. [HALIDE.md](docs/HALIDE.md) |
| **Komorebi** | `/komorebi/` | Dappled light, one static Canvas2D frame (WebGL rewrite Jul 27, 2026 — manual §§5/9/10/13 describe the old GPU tool). Tone-band SVG with `organica` metadata. [KOMOREBI.md](docs/KOMOREBI.md) |
| **Camo Turing** | `/camo-turing/` | GPU (WebGL2/Three.js) Gray-Scott reaction-diffusion, layers, anisotropic diffusion, animal presets. [CAMO-TURING.md](docs/CAMO-TURING.md) |
| **Warping** | `/warping/` | Domain-warped noise / Worley patterns (wood, marble, cells, level curves), Canvas2D, tone-band SVG. [WARPING.md](docs/WARPING.md) |
| **Loom** | `/loom/` | Constraint-driven layout-grid engine (Kiwi solver or parametric per generator) → Universal JSON Model → HTML/SVG/PNG/Figma. **ES modules.** Screen/Print with real bleed. [LOOM.md](docs/LOOM.md) |
| **Membrane** | `/membrane/` | Point-set growth driven by a Movement pattern, accumulated trail, vector SVG from recorded frames. ES modules (`js/`). |
| **Vortex** | `/vortex/` | 3D conical helix with its own perspective camera (deliberately not `createZoomPan`), seeded, redraws each frame. ES modules (`js/`). |
| **Flexible Visual System** | `/fvs/` | Element → Component → Symbol → Figure grid/rule engine on step boards; the Figure is a node graph on `Organica.nodeCanvas`. **ES modules in `fvs/js/` + `fvs/fvs.css`** (never the archive — Critical Rule); gates `scripts/test-fvs.sh`. [FVS.md](docs/FVS.md) (§11 module rules, §13 boards), Tropism plan [FVS-TROPISM.md](docs/FVS-TROPISM.md) |
| **Colornet** | `/colornet/` | Luminance-band channel separation + recolour, per-channel transform, AM screening; one `buildPlan()` feeds preview and every export. Screen/Print, plates. |
| **Blob Boundary** | `/blob-boundary/` | GSAP MorphSVG mask morph over a live-classified dot lattice. |
| **Radial** | `/radial/` | The Book of Shapes radial family: polar field × 7 render modes, pure vector; core in `shared/radial.js`. |
| **Pulsar** | `/pulsar/` | Motion over Radial: parameter tracks, seamless-loop WebM, `renderFrameAt(tNorm)` serves preview/PNG/video. |
| **Mycel** | `/mycel/` | Mycelial growth by space colonisation from Roots, SVG/PNG. |
| **Mote** | `/mote/` | Video / webcam → stipple (`shared/pollen-engine.js`), 3 coherence modes, frame-accurate offline encoder, batch social sizes, kiosk mode. |
| **Murmur** | `/murmur/` | A Pollen / Spore / Halide Screen SVG export, animated — every mark on a spring (`shared/swarm.js`, parser `shared/marks-svg.js`). [MURMUR.md](docs/MURMUR.md) |
| **Undertow** | `/undertow/` | Warping's SVG export, animated — tone-band vertices on one displacement field (`shared/bandfield.js`), seamless by construction. [UNDERTOW.md](docs/UNDERTOW.md) |
| **Dapple** | `/dapple/` | Komorebi's SVG export, animated — Undertow's twin tuned to light through leaves. [DAPPLE.md](docs/DAPPLE.md) |
| **Gallery** | `/gallery/` | The development test gallery (not a tool): reachable only from the design system, signed-in, `noindex`, size-budgeted — see the Critical Rule. |
| **TuneSutra** | `/tunesutra/` | Where colours are made: palette library (home) + editor on `shared/color.js` (OKLCH harmony, scales, contrast, gradient + grain, System view); its saved palettes are the suite's palette library. [TUNESUTRA.md](docs/TUNESUTRA.md) |
| **Rhizome** | `/rhizome/` | Node workflow canvas chaining the tools (native nodes + iframe bridges), on the shared `Organica.nodeCanvas`. **ES modules.** [RHIZOME.md](docs/RHIZOME.md) |
| **Trellis** | `/trellis/` | Phase 1 test: fills and animates an imported Loom grid (`shared/shapes.js`). |

---

## Repo Structure

The layout and the rules it carries. Every file's full description (APIs, load order, history) is in
[`docs/REPO-STRUCTURE.md`](docs/REPO-STRUCTURE.md) — read it before touching a `shared/` module.

```
organic-strata/            ← GitHub diegoair/organic-strata (private)
├── index.html · 404.html  ← home (hub) · error page (Page template, public, FVS field)
├── <tool>/index.html      ← one folder per tool (Tools table); single-file vanilla unless below
├── loom/ · rhizome/ · membrane/ · vortex/   ← native ES modules: index.html + js/
├── fvs/                   ← index.html + fvs.css + js/ (ES modules; js/engine/ = model, no DOM UI — docs/FVS.md §11)
│                            + _test-regression.html and the *-baseline.json files the headless suites read
├── genesis/               ← the seed library; forms.js + defs.js are DATA; animations.css append-only (archive support)
├── tunesutra/             ← + collections.js, figures.js (DATA)
├── gallery/ + samples/    ← the test gallery (budget: gallery/budget.json)
├── archive/               ← frozen: hub-bento/, fvs-single-file/ (never edited)
├── shared/                ← cross-tool system, named by role (no organica- prefix); JS global window.Organica.*
│   ├── tokens.css (load FIRST) · shell.css (Tool template) · page.css + prose.css (Page template)
│   ├── header.css/.js · tools.js · panel.css · floatbar.css · icons.js/.css · pattern-init.js · auth*.js · store.js
│   ├── core.js            ← download, presets, Figma, contour tracer, zoom/pan, colour utils — never re-implement
│   ├── color.js · palette.js/.css · noise.js · shapes.js · radial.js · pathfx.js · pollen-engine.js
│   ├── swarm.js · marks-svg.js · bandfield.js · recorder.js · canvas.js · seeds-panel.js/.css · fvs-field.js/.css
│   ├── node-canvas.js/.css (FVS Figure + Rhizome) · print-size.js · print-size-panel.js · plate-export.js
│   ├── vendor/            ← third-party (see THIRD-PARTY-NOTICES.md)
│   └── _template.html     ← start a new tool from this
├── scripts/               ← check.py (pre-commit), ds-audit.py, templates.py, test-fvs.sh (every FVS suite), smoke.py, test-*.mjs
├── docs/                  ← manuals (FVS, LOOM, RHIZOME, …), TOOLS.md, REPO-STRUCTURE.md, SESSION-LOG.md (older notes),
│                            DESIGN-SYSTEM.md, DESIGN-DECISIONS.md (ledger), UI-SHELL.md, UI-COPY.md, RELEASE.md, ROADMAP.md
├── vercel.json            ← routing + headers; NO comment keys (schema rejects them)
├── LICENSE · THIRD-PARTY-NOTICES.md
└── CLAUDE.md              ← this file
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework, no build step |
| Modules | Mostly single-file per tool; Loom and Rhizome are native ES modules |
| Animation | Genesis forms: pure CSS `@keyframes`. Blob Boundary: vendored **GSAP** + MorphSVG. Radial/Pulsar/Warping/Komorebi/Camo Turing/Membrane/Vortex: own `requestAnimationFrame` redraw loops |
| SVG processing | All client-side now — `Organica.traceContours` (rectilinear contour tracer in `shared/core.js`), used by Komorebi/Warping/Halide/Colornet. The old Python/OpenCV/vtracer backend went with Strata (Aug 26, 2026) |
| Vendored libs | GSAP + MorphSVG (Blob Boundary), Kiwi.js (Loom), Three.js (Camo Turing), Paper.js (Genesis draw/edit), opentype.js + Manrope (Membrane/Camo Turing text seeds), p5.js (Membrane, CDN) — see `THIRD-PARTY-NOTICES.md` |
| Deployment | Vercel (team slug `studiorann`), no build step |
| Repository | GitHub — `diegoair/organic-strata` (private) |
| Design integration | Figma (manual now, direct push in roadmap) |

---

## Critical Rules — Never Break These

- **Design tokens — mandatory, every new development.** Never hardcode a font-size, spacing (padding/margin/gap), radius, or UI-chrome colour — use the matching token from `shared/tokens.css` (`--fs-*`, `--space-*`, `--radius-*`, `--ink`/`--paper`/`--panel`/`--mid`/`--accent`/`--border`/`--border-strong`/`--tool`/`--accent-warm`/`--danger`/`--track-bg`). The surface palette (`--ink` … `--border`) has defaults in the token file now — a tool declares only `--tool` plus the rare override. If the value you need doesn't exist on any existing scale, **stop and ask before adding a new token** — don't invent one silently and don't fall back to a raw px/hex "just this once." Live reference with every token and component, rendered from the real CSS: `/design-system/` (linked from the hub). Full narrative + Figma mapping: `docs/DESIGN-SYSTEM.md`. Two real exceptions, not loopholes: (1) a tool's own **content** colour (Halide's ink/paper for the dithered image, Pollen's point colour) is user data, not design-system chrome — don't tokenise it just because it happens to default near `--ink`/`--paper`; (2) a genuine pill/stadium shape (`border-radius` = half the element's height, e.g. a toggle switch) isn't a corner radius — forcing it onto `--radius-sm/md/lg` flattens the capsule. Typography specifically: **two typefaces, split by role** (since Sep 29, 2026): **Space Grotesk** (`--font-display`) for display, H1–H5, buttons/controls, numbers and panel labels/titles (the mono is ~20% wider); **IBM Plex Mono** (`--font-mono`) for everything else (H6/overline, body, caption, panel hints, code). `--font` is the inherited default and points at the mono; never name a typeface directly, never a third one. Wix Madefor Display and Manrope stay vendored as fallbacks (Manrope also for the text seeds' glyph outlines via opentype.js). Canvas text reads `--font` at draw time (see `shared/glyph-editor.js`).
- **Icons and motion — tokens, not literals** (Oct 2, 2026, after the UI audit; `docs/audit-2026-10/`). **Icons**: never paste an inline `<svg>` for a chrome icon — add the drawing to `shared/icons.js` (16 grid, `currentColor`, no stroke attributes) and use `Organica.icons.get()` or `data-icon`; never type `× + ↑ ↓ ✓ ▾` as an icon; one meaning per name (refresh = run again, reset = defaults, close = dismiss, trash = delete, eraser = clear). **Motion**: durations and easings are `--dur-instant/fast/base/slow/settle/reveal/stagger` and `--ease-standard/out/glide/overshoot-soft/overshoot/in-out` — no raw ms or `cubic-bezier`, list the properties (never `transition: all`), animate `transform`/`opacity` not `width`; reduced motion collapses the tokens to 1ms. **Behaviour**: a destructive button carries `data-armed` (`Organica.armed`); an icon-only button has an `aria-label` and no `title` in the floatbar; ⌘/Ctrl +−0 stay the browser's.
- **Design-system agent — consult before, review after** (Oct 2, 2026). The design system has a steward: the `design-system` subagent (`.claude/agents/design-system.md`, also `/ds`). It measures, advises and documents — and it is the **content designer** too: every visible string (section title, label, button, option, placeholder, toast, `aria-label`) follows `docs/UI-COPY.md` (one concept one word, one word one meaning, sentence case, visible label = accessible name; a new term or a rename = Diego). It never decides (new token / component / exception / glossary term = Diego) and never edits tool or shared code. **Three gates for any UI work:** (1) **CONSULT before building** — a new tool, panel section, control, component, icon, motion, or anything that seems to need a value the scale doesn't have: ask it for the build brief (what exists, which classes / `Organica.*` calls / tokens to use, the gaps that are Diego's to decide) and build from that; skip only for a change that touches no UI or re-uses a pattern already in the same file. (2) **REVIEW before the local commit** — `python3 scripts/ds-audit.py --diff` must add no raw values (exit 0), and for a change that adds UI the agent reviews the diff; a BLOCK is fixed before committing. (3) **DOCUMENT after it ships** — the agent updates `docs/DESIGN-SYSTEM.md`, the `/design-system/` entry, `shared/tokens.json` and the ledger. The ledger is `docs/DESIGN-DECISIONS.md` (open questions for Diego · decisions · standing exceptions · audit log): read it before proposing anything, and put every owner decision there, not only in a session note.
- **Both themes — mandatory, every new component, token and style** (Diego, Sep 29, 2026). Anything new must work in light AND dark (`<html data-theme="dark">`, see DESIGN-SYSTEM.md §5b) before it ships: a new colour token gets a light value in the THEMES light rule AND a dark value in the dark rule of `shared/tokens.css` (contrast-checked: text ≥ 4.5:1, boundaries ≥ 3:1 on dark `--paper`/`--panel`); a new component uses only tokens, never a raw hex; shadows/scrims are `rgba(0,0,0,…)`, never an `--ink` mix; a colour that feeds blend-mode maths (e.g. `difference`) is a fixed value, not a theme token; work surfaces (the sheet, previews, galleries of results) stay light via `.org-stage` / `data-theme="light"`; canvas/export colours come from `Organica.contentColor()`. Verify by toggling the header moon button and by running `/design-system/_dark-audit.html`; a new design-system entry must render in both.
- **FVS is developed in `fvs/js/` (ES modules) + `fvs/fvs.css`, never in the archive** (Diego, Oct 6, 2026). The single-file version is frozen at `archive/fvs-single-file/` for reference only. Before adding FVS code read `docs/FVS.md` §11: import only from earlier files, reach a later file through `hooks.*` (and `provide()` it there), a variable written from another file goes on `rt`, Figure code stays in its lazy files, `fvs/js/engine/` stays free of DOM UI (check.py "fvs engine") — it reads controls only through the panel reader (`pv` / `pc` / `pr` / `val`) and shares run-time values on `live`, never `ctrl()` or a top-level `let`. Gates: `scripts/regression.sh` + `scripts/test-fvs-qa.sh`.
- **Shared code** — `shared/core.js` owns download, preset storage + legacy migration, Figma postMessage, colour hex validation, the rectilinear contour tracer and zoom/pan. Don't re-implement these in a tool; if one needs different behaviour, extend the core
- **Test gallery — a development log, kept light** (Diego, Oct 1, 2026). `/gallery/` records the tests we run: one tile = one real export (from `gallery/samples/`) + one animator preset — or, since Oct 2, 2026, a **still** tile (`kind: 'still'`, the export drawn as it is) when the test is about the export itself — + a date and a note, listed in its Test log. It is reachable **only from the design system** (`#test-gallery`) — never from the tools menu or the hub (`scripts/check.py` fails if another page links to it) — is `noindex` and signed-in. **Keep it small**: the budget is `gallery/budget.json` (≤24 tiles, ≤3 MB of samples in total — raised from 16 / 2 MB on Oct 6, 2026 for the FVS overlap & blend tests, on Diego's request — ≤300 KB per sample, ≤40 KB page), enforced by `scripts/check.py` and shown on the page; a sample no tile uses fails the check. Add a tile when a test is worth keeping; retire old ones rather than raising the budget, and raise it only deliberately.
- **New tool or page — start from its template, never from a neighbour** (three templates, decided Oct 2, 2026; live reference `/design-system/#templates`). **Tool** (canvas + right panel + floatbar, on `shell.css`): start from `shared/_template.html`. **Page** (header + one scrolling column, on `shared/page.css` — `body.org-page` > `.org-page__col`, `--wide`, `--full`): start from Privacy (reading) or Admin (data); a page **never** links `shell.css` (it pins the body and the page cannot scroll). **Auth card**: sign-in only. A tool whose surface `shell.css` cannot describe is an *own-surface variant* of Tool (Apostate, FVS, Rhizome, Genesis), listed with its reason in `scripts/templates.py`. After adding a page run `python3 scripts/templates.py` — it regenerates `design-system/templates.json` (what the reference renders; never type a page list) — and `scripts/check.py` fails if a page's skeleton stops matching its template (sheet order, mobile gate first, `#panel` last in `#app`, floatbar a child of body, no Export in the header, dark opt-in) or the JSON is stale. A deliberate deviation is an entry in that script's `OWN_SURFACE` / `OWN_LAYOUT` / `ALLOW` plus a line in `docs/DESIGN-DECISIONS.md` §3. Contract: `docs/UI-SHELL.md`
- **`genesis/animations.css`** — never modify existing rules, only append new ones (the 55 forms depend on the exact timings/selectors). Archive-support now — the only live consumer is `genesis/archive/indicators-55.html` (Genesis and the hub bento both render static since 2026-09-03). Any consumer linking it **must** define `--ink` and `--bg-cell` — see `docs/SHARED-LIBRARY.md`. (The `organic-library.css` `@import` shim was retired 2026-08-30 — link `page.css` then this file directly.)
- **localStorage keys** — always `organica.<tool>.<thing>`. When renaming a key, migrate forward and **leave the legacy key in place** (user presets/forms are real work); never delete it in the same release
- **`forms.js` / `defs.js`** — treat as data. A new base seed = one `window.ORGANIC_SEEDS['seed-<slug>']` entry (`label / type / tags / bbox / svg`); the SVG must paint `fill="var(--ink)"` / `stroke="var(--ink)"` and carry no `class`. Keep it byte-aligned with the `base_seeds` DB row (DB wins). Genesis renders it static
- **Color in SVG forms** — always `fill: var(--ink)` / `stroke: var(--ink)`, never hardcode hex
- **Internal links** — always relative (`/genesis/`, `/loom/`), never absolute Vercel URLs
- **New base seeds** — add a `window.ORGANIC_SEEDS` entry in `forms.js` (see the `forms.js` rule above) + the matching `base_seeds` DB row; Genesis renders it static. New *animated* forms belong in `genesis/archive/indicators-55.html` (or Pulsar / the tool's own engine for motion) — see ANIMATION-SYSTEM.md

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

These 6 originated as Genesis's hand-typed CSS `@keyframes`. **Pulsar** maps 4 of them (Pulse / Bloom / Drift / Orbit) onto Radial's parameter tracks; Membrane / Vortex / Blob Boundary each embody one physically. **Murmur** / the hub hero (`shared/swarm.js`) map all 6 onto a mark field as one-click Motion modes. *(Soul rebuilt all 6 parametric on GSAP + 2 new patterns, but was removed Aug 31, 2026 — see `docs/archive/SOUL.md`.)* The taxonomy is still the reference; the delivery is no longer CSS-only.

---

## Output Formats Diego Produces

- Tavole grafiche / composition studies
- Posters (print + digital)
- Web pages (animated SVG)
- Branding systems for clients
- Mural schemas (large format, scale-agnostic vector)
- Art installations (generative animation loops)

---

## Release Workflow

Full detail: [`docs/RELEASE.md`](docs/RELEASE.md). In short: **local first, preview second, prod last.**

1. Build + test locally (no-store dev server, browser pane). Every FVS headless suite at once: `scripts/test-fvs.sh` (~3.5 min, side by side; `--only regression,boards`, `--list`). The pre-commit hook runs the suites the staged paths need — regression, Rhizome, Figure board, step boards — in one parallel call.
2. **UI changed?** `python3 scripts/ds-audit.py --diff` (no new raw values) and the design-system agent's REVIEW — see the Critical Rule.
3. **Local commit only** when a release is ready to test — never push at this stage. The tracked pre-commit hook runs `scripts/check.py` (`vercel.json` schema guard, JSON, JS syntax, local refs, icons registry, page templates, css-lint, copy apostrophes). Enable once per clone: `scripts/install-hooks.sh`.
4. Preview gate: push to `staging`, run `python3 scripts/smoke.py <preview-url>`.
5. **Only on "commit in prod" / "porta in prod"**: push `main`.
6. After every prod push: Vercel MCP `list_deployments` must show READY, then `python3 scripts/smoke.py` (CI's `deploy-verify.yml` also runs it). A successful git push does not prove the deploy worked. CI (`ci.yml`) re-runs check + regression on every push.
7. **End of every working day — the test log + closing gate** (Diego, Oct 9, 2026). Add the day to the **Organica test log** artifact (`https://claude.ai/artifact/FsEoGMwKmWeKinrXfUhvyh`, data in its `db`, never republish the page for it): one `commits/<short sha>` doc per commit of the day (`day` · `n` · `time` · `kind` · `group` · `title` · `test` = a concrete "try this" · `links` [prod path or doc] · `done:false` · `note:''`) + one `days/<YYYY-MM-DD>` doc (`base` · `head` · `prod` · `gate` · `summary`), via one `ArtifactData` batch. For a day that touched the FVS Figure, also run `scripts/gate-figure.sh <base>` and write that day's manual checklist into `docs/FIGURE-GATE.md` §3. Before adding a day, read the previous day's `note` fields: a note = a bug to fix or a ledger question.

---

## Roadmap Priorities

*The original numbered phases (mid-2026) have largely landed and are folded into shipped tools; this is the current picture. Priorities themselves are Diego's call — see `docs/ROADMAP.md` for the full narrative.*

- **Done / shipped** — Genesis depth (unified library + save/load + SVG/PNG export + bezier Edit); the pattern family (Warping, Camo Turing, Radial, Flexible Visual System Symbols) covering what "Phase 4 — pattern engine" pointed at; the Motion engine (Pulsar over Radial; each generative tool also carries its own); the workflow layer (Rhizome).
- **Figma push** — the shared `Organica.sendToFigma` channel was **fixed** by Rhizome's Phase 0 (`figma-plugin/code.js` now listens for `'organica-svg'`), so it works for the 7 tools that call it (Spore/Pollen/Halide/Komorebi/Loom/Camo Turing/Warping). Still to do: wire an Export→Figma tab into the tools that only have `sendToFigma()` defined but not surfaced (Flexible Visual System, Radial, …).
- **Output pipeline** — print PDF, mural schema, installation loop. Still open.
- **Opening to test users** — desktop-only gate + Vercel Analytics shipped; still open: access control for external testers, error monitoring, a feedback channel, and the cross-browser pass (see Backlog).

---

## Open Questions (Decisions Pending)

- **Typography** — Living Path (font/path modification, OTF export) is the type module in practice. Still open: is there a role for type *inside* the visual language beyond specimen/lettering — a Genesis-style generative type system?
- **Colour** — TuneSutra (harmony rules + garment preview), Colornet (channel separation), and the shared Palette component now cover this. The old "3 Genesis palettes" framing is retired; still open: how the tools' palettes stay coherent with each other across a whole system.
- **Client workflow** — what does the Organica handoff look like for a client branding project? Still open.
- **Mural scale** — largest format needed? DPI requirements? Still open.

---

## Backlog

- **Tropism — FVS axes, levels and new rules** (Diego, Oct 14, 2026; plan `docs/FVS-TROPISM.md`, open decisions ledger O-73). Axes say which values exist, rules say which one each cell takes, each axis can be *Driven by* its own rule; new axes (Ink · Offset · Stretch · Layers · Content), new level sources (Field · Image · walks), a **Photo** Element style (the shape masks an uploaded photo — across the Component or inside each Element; Normal · Tone · Dither · Stipple · Bands), Glide · from a hand-drawn piece · Nest · Paths. Phase 0 moves Manual onto the canvas. Planned, nothing built.

- **FVS Component — rules that reach colour and layers** (Diego, Oct 13, 2026: *leave the rules as they are, we combine colour rules and layer rules later*). Today a rule decides only each cell's turn · flip · size; the ink comes from Colour by (the cell's position) and Layer colour variants, and every layer turns with the Element. Ideas on the table: (1) **colour follows the rule** — a Colour by option where each cell's ink follows its turn / flip; (2) **rules per layer** — choose which layers a rule turns. Now planned in **Tropism** (Phase 3a Ink, 3d Layers). Reference: `docs/FVS.md` §5.4, the rule atlas `/design-system/_fvs-rules.html`.

- **FVS Phase D — one board per project** (O-67 a; Diego, Oct 11, 2026: *on the backlog until we finish all the 4 steps*). A project = one board holding its Elements, Components, Symbols and Figures; the step buttons navigate that one board. The *project* (what it is, how it is saved and opened) needs its own plan and Diego's answers first. Phases A–C (New element, Delete on parts, a Palette per Element, Generated components per Element) shipped Oct 11, 2026.

- **Cloud sync (Supabase)** — auth + per-user persistence, shipped 2 Sep 2026. Project `dgzxsqdrktqgpnewxtwf` ("Organica", eu-west-1). Client is the vendored `@supabase/supabase-js` UMD; `shared/supabase.js` (`Organica.sb`, config inline — anon key is public, RLS is the guard) → `shared/auth.js` (`Organica.auth`, Google OAuth + magic link, **client-side auto-gate**: any page loading `auth.js` needs a session; `/sign-in` `/privacy` `/terms` are public, `window.ORGANICA_PUBLIC` opts out) → `shared/auth-badge.js` (avatar + name → dropdown menu: email, **Admin** [owner only], **Delete my account** (`delete_own_account` RPC), Sign out — self-mounts into `.org-header`, reads `user.user_metadata.full_name`/`.avatar_url`) → `shared/store.js` (`Organica.store(tool)` aka `Organica.presetStore` — sync `read()`/`write()` over a localStorage cache + `pull()`/`push()`/`onSync()`; `Organica.store.library` for Genesis). **Tables** (all RLS on): `presets (user_id, tool, name, data jsonb, pk(user_id,tool,name))` + `seeds (user_id, seed_id, name, svg, type, gen_type, gen_params, data jsonb)` — policy "own rows" (ALL), granted to `authenticated`, no `anon` read. `base_seeds (seed_id, name, slug, svg, type, gen_type, gen_params, data jsonb, position)` — policy "read all" (SELECT), granted to `anon`+`authenticated`, **no write policy/grant** so only the project owner edits it (dashboard / MCP). **Uniform id scheme (2 Sep):** every seed id is **`seed-<handle>`** — `handle` = the kebab slug for the 19 Base Seeds (`seed-breath`, `seed-drop-fall`, `seed-square`, `seed-arc`, …), a short base36 token for user seeds (`newSeedId()` in `genesis/index.html`). Every set id is **`set-<handle>`** (`set-base` built-in; `newSetId(name)` for user sets). No more `organic-N` / `basic-*` / `user-<ts>` / `set_*`. `genesis/index.html` `migrateLibrary()` has `LEGACY_ID_MAP` + `remapId`/`remapSetId` that rewrite any stale localStorage blob on load; `pollen` keeps a `remapPointType()` shim for old `g:<n>` presets. Genesis's 19 Base Seeds live in `base_seeds` keyed by `seed-<slug>`; `genesis/forms.js` `ORGANIC_FORMS`/`ORGANIC_LABELS` (keyed by the same id) + `genesis/index.html` `PROCEDURAL_CANON` are the first-paint/offline fallback and must stay byte-aligned with the table — **all 19 names lowercase**, `slug` is the id minus the `seed-` prefix, `data->>'id'`/`'name'`/`'slug'` mirror the columns; DB wins. Genesis user library = one row per seed in `seeds` + set structure in `presets` `tool='library' name='meta'`; the old `name='__blob__'` row is a dead migration fallback, safe to `delete` later. **Admin** (`/admin/`, owner-only client gate `u.id === '997a1f53-…'`): calls `security definer` RPCs `admin_overview` / `admin_user_detail(uuid)` / `admin_delete_user(uuid)` / `admin_allow_email(text,text)` / `admin_revoke_email(text)` / `admin_list_allowed` (each raises `forbidden` unless `is_owner()`), + `delete_own_account()` (any user), + `before_user_created(jsonb)` Auth Hook that rejects emails not in `allowed_emails` (owner always allowed). Keep-alive: **GitHub Action** `.github/workflows/keepalive.yml`.
  - **Font:** `shared/tokens.css` self-hosts Manrope via `@font-face` on `shared/vendor/manrope-variable.ttf` — the Google Fonts `@import` was removed (it leaked visitor IP to Google on every public page).
  - **Diego to do (dashboard, one-time):** Auth → turn off "Allow new sign-ups"; Auth → Hooks → enable **Before User Created** → `public.before_user_created`; add tester emails via `/admin/` Allowlist; fill the real controller/imprint/`[contact email]`/`[city]` placeholders in `privacy/` + `terms/`.
  - **Open item:** **"to continue to …supabase.co"** on Google sign-in — unverified OAuth app on a non-owned domain; fix = Supabase **custom auth domain** (Pro + an owned domain), cosmetic, deferred.

- **Hub home-page performance** — `index.html` is ~1.48MB; ~1.4MB of that is 4 inline tool-export SVGs (Halide 757KB/**16,374 `<rect>`**, Camo Turing 401KB/2 path, Membrane 151KB/220 path, Komorebi 101KB/2 path). Only Halide's is pathological. **Verified 2026-08-30**: a vertical rect-merge yields **0%** — the dither has no vertical coherence (each Floyd-Steinberg row diffuses differently), and it's already horizontally run-length merged. So the only real fixes are (a) rectilinear contour-trace the 16k rects → one `<path fill-rule="evenodd">` (what Halide's own "Simplify shapes" does — needs the tracer + a pixel-diff to verify), or (b) move the 4 big SVGs to external files + lazy-load the off-screen bento cells (IntersectionObserver). Both change the hub's structure/appearance and need a scoped pass with real visual verification — not a mid-stream hack. Left for a dedicated session.

- **Mote — deferred polish** (Sep 1, 2026): (1) **"Hatch flow" cool variant.** The Aug-31 prototype had *two* hatch-flow presets; the 18→9 curation kept only `pollen-hatch-flow` (black strokes on cream). The dropped one — `hatch-flow` — was RMX `RAMP_COOL` (`['#0e1622','#274157','#5f8aa0','#a9cdd6','#eef4f2']`) on dark `#0c1116`, `strokeLen 16`, `size 1.6`, `dropout 45`, `map: 'tonernd'`, `spMin 2`. Re-add as a 10th built-in ("Hatch flow · cool") or fold into "Hatch flow" — ~5 min in `mote/index.html` `BUILTIN_PRESETS`. (2) **Webcam device picker.** The `enumerateDevices` camera `<select>` was dropped when Source moved into the floatbar; the webcam now uses the default device only. Re-add as a small popover on the `#btn-cam` icon (the Pulsar `Organica.popover` pattern) if multi-camera choice is needed for an install.

- **Dark mode — every tool is opted in** (Oct 1, 2026: all production pages; hub, design system, Pollen, Loom, Flexible Visual System, Murmur, Spore had it earlier). Not opted in: `explorations/*` (dev pages) and the `design-system/_*` dev pages. Open: the dark audit still has no headless runner (press Run on `/design-system/_dark-audit.html`; a `scripts/regression.mjs`-style CDP runner would let it run per commit), and it cannot check canvas contents or light-vs-dark export hashes.

- **Cross-browser verification before opening to test users** — every tool has only ever been exercised through this session's own Chromium-based Browser pane; real Safari/Firefox behaviour is unverified. Prioritized by which real API each tool actually depends on (checked in the code, not guessed):
  - 🔴 **Camo Turing** — WebGL2 + Three.js (Safari's WebGL2 support has historically been the most fragile of the three engines); generate a preset, confirm the canvas actually renders.
  - 🔴 **Living Path** — Web Worker-driven OTF export; generate and download a font, Worker path/CORS behaviour differs across browsers.
  - 🔴 **Camo Turing / Membrane** — `MediaRecorder` video export; Safari's MP4/WebM codec support differs meaningfully from Chrome/Firefox — record a short export on each.
  - 🟡 **Rhizome** — iframe-sandbox bridge nodes; connect two nodes, confirm the bridge round-trips a real value.
  - 🟡 **Loom / Flexible Visual System** — Kiwi.js constraint solver; generate a grid, confirm no console error.
  - 🟢 **All tools** — Manrope variable font + Google Fonts load; a quick visual pass, low real risk.
  For each: open on real Safari and Firefox, exercise the one risky action, check the console (Cmd+Opt+C on Safari, F12 on Firefox) for errors. Not something this session can execute directly — no real Safari/Firefox access from the Chromium-only Browser pane — logged here for Diego to run through himself before wider test-user access.

- **Flexible Visual System — cross-browser checklist for Diego (Safari + Firefox)** — the Browser pane is Chromium-only, so these were never run elsewhere. Open `/fvs/` and check each, console open (Cmd+Opt+C / F12): (1) **PNG export** — Export → PNG in each step; it rasterises the SVG through an `Image` (Safari is stricter about SVG-in-`<img>` with embedded `<metadata>`/`clipPath`), open the file and compare with the preview. (2) **PNG in Print mode** — set Print, 100×100 mm, 300 dpi, bleed 3: the PNG should be 1299×1299 and carry the DPI (macOS Preview → Tools → Show Inspector → 300 dpi). (3) **Plates** — bleed ≥ 8 mm, a 2-colour recipe (Figure → New figure… → "Classic · Leaf wave, two inks (4×4)"): one file per ink, black on transparent, registration marks present. (4) **Multiple downloads** — Variants with 3 rows × ×1/×2/×4, and Plates: the browser may block or ask about several downloads in a row; confirm they all arrive. (5) **Figma button** — needs the plugin, only check it does not throw. (6) `fvs/_test-regression.html` → Run should say *All N cases match* (Firefox/Safari can hash differently only if serialisation differs — worth knowing). Report anything that differs from Chrome.

- **Colornet improvement plan (from the Stochaster videos)** — **verified 2026-08-30: all four items have since shipped.** 🟢 Shuffle + Random Colors (`btn-shuffle`/`btn-random-colors` → `shuffleChannels()` Fisher–Yates / `randomizeColors()`); 🟡 Channel-swap gesture (`armOrSwapChannel` — click a name to arm, click another to swap); 🟡 Batch processing (`btn-batch` + `#batch-input` multi-file, per-image export of the current config); 🔴 **AM Screening as a real per-channel render mode** (`screenMode: am/noise/dither/flat`, per-channel `screenAngle` [15/75/0/45° defaults] / `screenFreq` / `dotShape` incl. a real PostScript **Euclidean** spot function, 3 catalogued presets). The "reuse evaluated" note stands: Dotraster's Noise mode ≈ Pollen's engine; its Pattern mode ≈ a Halide extension. Nothing left to build here — if extending, run through Plan Mode.

- **Inline `style="display:none"` → `hidden` attribute sweep** — ~180 static inline visibility toggles across the suite (loom ~40, fvs ~30, genesis 25, camo-turing 21, pulsar 13, radial/membrane 10 each, …). A future pass to the HTML `hidden` attribute + a `[hidden]{display:none!important}` safety rule (needed because flex/grid containers override bare `hidden`). Deliberately left out of the 2026-08-30 shell/style-centralization pass. Watch for the ones that are JS-toggled via `el.style.display` — those must keep an inline `style` so clearing it works (see the `.u-hidden` note in `design-system` §utilities). Also queued in `docs/SHARED-COMPONENTS.md` §3.
- **Follow-ups from the 2026-08-30 shell pass** — all closed as of 2026-08-30: ~~zoom/pan JS~~, ~~`.chan-card` → `.org-layer-card`~~, ~~Spore `.upload-mark-btn`~~, ~~Genesis `.upload-btn`~~ (reduced to its 2 real deltas), ~~8 camo-turing/fvs/genesis inline file inputs → `.org-file-input`~~, ~~`.hud-btn`/`#compute-bar` folded into `shell.css`~~. **Not a dup after all:** `design-system`'s `::-webkit-scrollbar` is a page-global 6px style, not the `#panel`-scoped 3px one — left in place. **Still open:** ~~Genesis's inline `margin:2px 0 6px`~~ done — per the design-system rule a one-off doesn't earn a token, so `.panel-hint` got `margin: 0 0 var(--space-2)` in its rule and both raw-px inline overrides were dropped (the third `.panel-hint` also had `margin-bottom:8px`); net shift 2px, imperceptible. `_template.html` Export → floatbar.
- **Centralization mini-projects** — **`Organica.seedsPanel`** and **`Organica.recorder`** both shipped Aug 30, 2026 (see `docs/SHARED-COMPONENTS.md` §3). `mulberry32` is effectively resolved (6 tools delegate via a 1-line wrapper; Loom's `js/generators/*.js` deliberately excluded per Aug 26 D1; `transformer.js` fallback deliberate; `noise.js` keeps its own — it loads before core in Warping/Loom).

---

## Session Notes














- **October 11, 2026 (FVS step boards — the prototype migrated) — local commits on branch `fvs-step-boards` (worktree `.claude/worktrees/fvs-step-boards`), not pushed.** Diego's plan: move `fvs/_proto-board/` (branch `proto/step-boards`, 18 local commits) into FVS — a migration, not a rewrite. Element, Component and Symbol each on an infinite board like Figure (`fvs/js/16-board.js` the board + cell grammar, `fvs/js/18-step-boards.js` the three boards; the tier views' own markup on node-canvas's `.nc-stage` / `.nc-board` / `.nc-frame__label`). The glue replaced: no DOM moved (the live Element's sheets are markup, the others drawn from their snapshot; a single view = `.tier-view.is-single` laying out the same markup), no observers (hooks from `renderElementFrame` / `renderGallery` / Component Edit / `setTier`), no `!important` (`:has()` on `#canvas-wrap`, `openCellContentOverlay({seedsOnly})`), `setRailTarget({apply, cellSel})`. The Element list in the user's store `Organica.store('fvs-elements')` (decision 3); the prototype's localStorage keys read forward, left in place (tested). Symbol's floatbar Variations button + dock removed — the variations are sheets beside the Symbol (decision 2). `Organica.nodeCanvas.chordShim` exported, applied to the steps, the rail panel and the floatbar. Bugs found on the way: a dblclick lost while Edit redraws the parts (now the second press), a store reload dropped the sheet positions. Gates: check, ds-audit --diff 0, regression 623/623, QA 10/10 (its dock check replaced by the boards), node-canvas 26/26, Figure board 27/27 (selectors scoped to the Figure step — the boards use `.nc-stage` too), Rhizome 17/17, new `scripts/test-fvs-boards.sh` 76/76 clean + held, light + dark (pre-commit + CI). Design-system CONSULT + REVIEW (PASS WITH NOTES, applied) + DOCUMENT. Then O-66 answered by Diego: keep *Gallery*; undo on the Element board (Delete and Clear board each a step, ⌘Z + a floatbar Undo, as Component's); the panel's *Clear* renamed *Clear board*. Still open: the small sheets' pile (Diego's visual test). Manual: `docs/FVS.md` §13. After the merge: delete `proto/step-boards` + its worktree.

- **October 13, 2026 (FVS Element units debug → Fit with stroke, Show as tile, Snap, hexagon turn bug, Figma Padding) — prod `fde477b`.** Diego: debug the Element's units so a user sees where a figure meets / snaps to the next cell in grids, patterns and tiles. Found: the 0..100 box maps 1:1 onto a cell, but Fit to canvas padded by strokeW while the painted stroke is strokeW × normScale × stretch (half outside) and measured with getBBox (loose under rotation) — fixed with `measureElementInk` (samples the ink as it paints, exact box on unturned / quarter-turned paths). **Show as tile** (Element floatbar View group, single view only): the Element with its neighbours on −50…150, in the Paper tile's lattice (`tileAt`, shared with `elementTileLayout`) on square cells or the Component's own lattice (`cellLatticeCells`) on Circle / Triangle / Hexagon; dashed box, dots, ticks where the ink meets an edge (`edgeContacts` / `polyEdgeContacts`); Layout / Turn as a second layer of six icons above it (`#element-tile-flyout`, floatbar icon rules). **Snap** (opt-in, single view only): dragging Move X/Y or a layer's X/Y catches box 0 · 50 · 100 and the other layers (`snapAxis` / `snapCandidates`, 4 px of travel, ⌘/Ctrl off, keys never snap). Readout units (× % °) were built and **rejected** by Diego — rolled back. **O-71**: `polygonCellTurn` rounded 59.9999 → 60, turning hexagon cells' content 60° (200 bad cells across lattices) — fixed at the source. **Symbol Padding as Figma has it**: Horizontal · Vertical or Padding per side (`cell.pad {t,r,b,l}`, `Organica.shapes.cellPads`; an older `padding` total reads as half a side, draws unchanged). O-70 closed (stroke stays centred). New test `scripts/test-fvs-element-units.sh` (36). Process rule from Diego the same day: full test suites only before a prod push, design-system / other agents only on demand (memory `feedback_tests_and_agents_on_demand`).

- **October 14, 2026 (FVS test speed + code audit; CLAUDE.md slimmed) — local commit `be39a3c` (tests + code) + the docs change, not pushed.** Diego: "run an audit and debug test on the code in FVS and make sure we improve speed of testing and quality of the code". `scripts/test-fvs.sh` runs every FVS headless suite side by side (6 at a time; step boards split clean / held / extra, the UI runner's 120 variants in 4 shards via `--shard i/n`, same variants as unsharded): ~1016 s sequential → ~209 s wall, 17/17. The board tests wait for the page instead of sleeping (`QUIET_INIT` in `scripts/lib/chrome-page.mjs`: two frames, no short timer pending, reduced motion) — mind a board swallowing any click within 100 ms of a drag's end (`swallowNextClick`). Pre-commit hook + CI run their suites in one runner call. FVS: `drawIdFree` linear (8000 ids 4.5 s → 37 ms, identical output); 10 dead exports, 38 unused imports, 7 unused locals removed (`tsc --noUnusedLocals` clean). Stale tests fixed: UI J2.4 (a cell's own shape now goes through Edit shape…), perf sequence (a circle / size-1 grid offers 10 thumbnails since today's rule changes). Open, Diego's: J4.2 still ~50 s — browser layout of a huge Symbol DOM (a Paper of Element tiles) re-rendered on every drop; `check.py`'s engine rule misses a dynamic `import()` (engine/08 → Loom registry). Then, on Diego's "all three": CLAUDE.md 122 KB → ~50 KB — the full Tools table and Repo Structure moved verbatim to `docs/TOOLS.md` / `docs/REPO-STRUCTURE.md` (one line each here), session notes trimmed to 3, and `check.py` "docs" keeps it so (size budget, ≤ 3 inline notes, a report of doc paths that do not resolve).

*Older entries (100+ dated notes, June 2026 onward) live in [`docs/SESSION-LOG.md`](docs/SESSION-LOG.md) — consult on-demand. Keep only the ~3 most recent notes inline here; when adding a new note, append it here and migrate the oldest to the log.*


---

*Organica · Updated August 2026*
