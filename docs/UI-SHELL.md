# Organica — The UI Shell

> Studio Rann · Organica · The standard tool layout
> Last updated: July 25, 2026
> Reference implementation: `shared/_template.html`

---

## 1. What the shell is

Five of Organica's tools — Spore, Pollen, Halide, Komorebi, and (in spirit)
Living Path — share the same layout:

```
┌──────────────────────────────────────────────────────────┐
│ TOPBAR   logo · actions · status · export scale · export │  40px, fixed
├───────────────────────────────────┬──────────────────────┤
│                                   │                      │
│  CANVAS                           │  PANEL               │
│  the artwork, centred             │  controls, scrolls   │
│  drop target, zoom/pan            │  240–244px           │
│                                   │                      │
├───────────────────────────────────┴──────────────────────┤
│ HUD  bottom-left, over the canvas                        │
└──────────────────────────────────────────────────────────┘
```

Until now this was **coherence by copy-paste**: Spore introduced it, Pollen
refined it, Halide and Komorebi cloned Pollen's `<style>` block almost verbatim
(~300 near-identical lines each). That produced a consistent look and a
maintenance problem — a fix to the shell in one tool never reached the others,
exactly as happened with the JS utilities before `organica-core.js`.

This document is the shell's definition. `shared/_template.html` is a working
copy to start a new tool from.

**Why a template and not a shared stylesheet:** each tool tunes its own palette
(Halide is a darkroom, Komorebi a forest floor) and adds tool-specific controls.
A shared `organica-shell.css` would need an override for nearly every rule.
Copying a *documented* template is honest about that; copying an undocumented
neighbour is what caused the drift.

---

## 2. Required includes

In `<head>`, **in this order**:

```html
<link rel="stylesheet" href="/shared/organica-tokens.css">
<style> /* the tool's own palette + shell + controls */ </style>
```

Before the tool's own `<script>`:

```html
<script src="/shared/organica-core.js"></script>
```

Order is load-bearing: tokens first so the tool can override without
`!important`; core before the tool script so `Organica.*` exists at parse time.

If the tool places Genesis forms, also:

```html
<script src="/genesis/organic-forms.js"></script>
```

---

## 3. Palette contract

Every tool defines the same six names, whatever the values. This is what lets
the shell CSS be copied without edits.

| Variable | Role | Halide (light) | Komorebi (light) |
|---|---|---|---|
| `--ink` | text, primary marks | `#0a0a0a` | `#0a0a0a` |
| `--paper` | page background | `#f5f2ec` | `#f5f2ec` |
| `--mid` | secondary text, dividers | `#726a5e` | `#726a5e` |
| `--accent` | emphasis text | `#2a2a2a` | `#2a2a2a` |
| `--panel` | canvas surround, inputs | `#eceae4` | `#eceae4` |
| `--border` | all 1px rules | `#d0c8b8` | `#d0c8b8` |

Plus **one identity colour** named after the tool (`--halide`, `--komorebi`, …)
matching the hub nav accent — see `docs/DESIGN-SYSTEM.md` §5.

---

## 4. Components

Class names are part of the contract — keep them.

### Topbar (40px, `flex-shrink: 0`)

| Class | What |
|---|---|
| `.logo` | `<a href="/">` — `<span>Organica</span> / ToolName` |
| `.tb-btn` | action button; `.primary` for the filled one (→ Figma) |
| `.tb-sep` | 1px × 20px vertical divider |
| `.tb-spacer` | `flex: 1` — pushes the right group over |
| `.tb-label` | uppercase micro-label before a control |
| `.tb-select` | `<select>` in the bar |
| `.tb-out` | numeric readout (output size) |
| `#status-dot` / `#status-text` | state; `.active` turns the dot green |

Left group = input actions. Right group = export. Status sits between them,
before the first separator of the export group.

### Canvas (`#canvas-wrap`, `flex: 1`)

| Class | What |
|---|---|
| `#canvas-wrap` | centres the canvas; `.drag-over` shows the drop outline |
| `#drop-hint` | the "+ drop an image" affordance; `.hidden` fades it out |
| `#zoom-hud` / `#hud` | bottom-left state chip, `pointer-events: none` |

`#canvas-wrap.checker` paints the alpha checkerboard for transparent output.

### Panel (240–244px, `overflow-y: auto`)

| Class | What |
|---|---|
| `.panel-section` | one group; `border-bottom: 1px solid var(--border)` |
| `.panel-section h3` | title, with an optional `<span class="hint">` on the right |
| `.sub-label` | subdivides a section |
| `.ctrl-row` | label + control + value, one line |
| `.ctrl-label` / `.ctrl-val` | fixed-width ends so sliders align down the column |
| `.check-row` | checkbox + label |
| `.seg-ctrl` / `.seg-btn` | segmented control; `.active` inverts |
| `.color-row` / `.color-swatch` / `.color-hex` | colour control |
| `.panel-select` | full-width `<select>` |
| `.row-btns` / `.mini-btn` | paired buttons (Save / Delete) |

**Sliders** are `input[type=range]`, 2px track, 10px round thumb, `--ink`.

---

## 5. Behaviour contract

Every tool wires these the same way, using `organica-core.js`:

| Behaviour | Call |
|---|---|
| Zoom & pan | `Organica.createZoomPan({ canvas, wrap, onChange, isReady })` |
| Download a file | `Organica.download(blob, name)` |
| Filename | `Organica.stamp('halide', 'svg')` → `halide-<ts>.svg` |
| Presets + migration | `Organica.presetStore('halide', 'halide-presets')` |
| Send to Figma | `Organica.sendToFigma(svg, 'Halide')` |
| Validate a hex field | `Organica.normalizeHex(value, fallback)` |
| Trace a mask to one path | `Organica.contoursToPathD(mask, W, H, block)` |

### The WYSIWYG rule

**One render function serves preview and every export.** Preview, PNG/JPG,
video frames and the pixel source for SVG all call the same code; only the
resolution differs, and every parameter is resolution-independent.

This is the single most important invariant in the suite — Pollen, Living Path,
Halide and Komorebi all hold it. If an export can disagree with the preview,
the tool is broken regardless of how good the output looks.

### Raster export gotcha

Use `canvas.toDataURL()`, **not** `toBlob()`, when the export resizes the canvas
and resizes it back. `toBlob` is asynchronous and races the resize, producing a
blank or preview-sized file. Komorebi hit this; the fix is in its export path.

---

## 6. Starting a new tool

1. Copy `shared/_template.html` to `<tool>/index.html`.
2. Replace the tool name in `<title>` and `.logo`.
3. Set the palette (§3) and add the identity colour.
4. Add the tool to `index.html` (nav link + accent class), `vercel.json`
   (rewrite), `README.md` and `CLAUDE.md`.
5. Register the accent in `docs/DESIGN-SYSTEM.md` §5.

---

## 7. Known drift (not yet reconciled)

Honest list of where the tools still disagree:

- **Panel width** — 240px (Halide) vs 244px (Komorebi) vs 260px (Genesis
  Library/Creator). Should be one token.
- **Genesis pages** use a different shell entirely (left sets panel + centre
  grid + right design panel). They predate this template; converging them is a
  bigger job than a rename.
- **Strata** and **Living Path** have their own layouts and were not
  retro-fitted.
- **`syncColor()`** still lives per-tool because each has different side
  effects (Halide repaints, Komorebi doesn't). Only the hex *validation* is
  shared, via `Organica.normalizeHex`.
- **Zoom/pan** is available in `organica-core.js` but Spore, Pollen and Halide
  still run their own inline copies — migrating them is safe but untested, so
  it is left as a follow-up rather than done blind.

---

*Studio Rann · Organica System v0.1 · July 25, 2026*
