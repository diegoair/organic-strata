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

## 4b. The header component

`shared/organica-header.css` + `Organica.status()` / `Organica.popover()`.
Replaces five divergent bars. Full audit and rationale in this section.

### The rule

**Identity · Context · Status · at most three actions.** Everything else moves
closer to what it acts on. An audit found 8–9 interactive controls crammed
into a 40px bar; the component brings Halide to 4 and Komorebi to 3.

### Markup

```html
<header class="org-header org-header--tool" role="banner">
  <a class="org-header__logo" href="/"><b>Organica</b><span>/ Tool</span></a>
  <div class="org-header__context"><!-- variant-dependent --></div>
  <div class="org-header__spacer"></div>
  <output class="org-header__status" aria-live="polite" aria-atomic="true">
    <span class="org-header__dot" id="status-dot"></span>
    <span class="org-header__state" id="status-text">Ready</span>
  </output>
  <div class="org-header__actions"><!-- max 3 --></div>
</header>
```

Wire the two behaviours:

```js
const setStatus = Organica.status();                       // announces
Organica.popover(ctrl('btn-export'), ctrl('export-popover'));
```

### Variants

| Variant | Context slot | Used by |
|---|---|---|
| `--tool` | hidden (or engine tabs) | Spore, Pollen, Halide, Komorebi, Living Path, template |
| `--catalog` | title + count | Genesis, Genesis Library, Indicators |
| `--editor` | mode tabs / breadcrumb | Creator, Strata |

**All 11 pages migrated** (6 tool / 3 catalog / 2 editor). The stale
`#organica-banner` migration notice was removed from Genesis, Indicators and
Strata; Strata's `v0.1 — phase 1` tag went with it.

Only the Context slot differs — identity, status and actions are identical.

### What moved out, and where

| Was in the header | Now | Why |
|---|---|---|
| Export Scale, Simplify, PNG/JPG/SVG | **Export popover** | settings touched once per ten exports were taking permanent space; Simplify was a checkbox wedged between buttons |
| Play/Pause, Reset (Komorebi) | **canvas HUD** | the clock was read bottom-left and controlled top-right |
| REC (Komorebi) | Export popover → Motion | it is an export, not a transport control |
| `title=` tooltips | popover body text | `title` is unreachable by keyboard and ignored by most assistive tech |

### Accessibility, measured

The four main tools previously had **no landmark, no ARIA, no focus style and
a silent status**. Verified after the change:

| Check | Before | After |
|---|---|---|
| `<header role="banner">` | absent | present |
| Status announced | `<span>` mutated silently | `<output aria-live="polite">` |
| Focus ring | 3 of 10 pages had any `:focus` | `:focus-visible`, 2px in `--tool` |
| Popover keyboard | n/a | `aria-expanded`, Escape, click-outside, focus returns to trigger |
| `title`-only explanations | 2–4 per header | 0 |
| Button target height | 26px | 28px (logo link 14px → 26px) |
| Border contrast | `#d0c8b8` = **1.49:1** | `--border-strong` `#958462` = **3.27:1** paper / **3.03:1** panel |

The border value is computed, not eyeballed — a first pass at `#b5a992`
*looked* right and measured 2.08:1.

### Palette contract — the trap

The component reads `--paper`, `--mid` and `--panel`. Genesis Library and
Creator name the same roles `--bg`, `--ink-muted` and `--surface`, so they
**alias** rather than rename:

```css
--paper: var(--bg);
--mid:   var(--ink-muted);
--panel: var(--surface);
```

Without `--paper` the primary button painted its label in nothing and rendered
as a solid black box — silently, with no error. If a migrated page shows a
blank button, check the palette aliases first.

### Full-bleed banner

`role="banner"` spans the viewport, so the header sits **outside** the app grid,
not inside a column. Library originally had it inside `.canvas-area`, which
squeezed it into the middle column; the grid now uses
`height: calc(100vh - var(--header-h))` and the header is its sibling.

Catalog pages inherit `body{padding:48px}` from `organic-page.css` for the form
grid; there the header escapes with `margin: -48px -48px 32px` plus
`position: sticky` rather than dropping the padding the grid needs.

### Responsive

The old bar never overflowed; flex simply squeezed until the logo,
"EXPORT SCALE" and "→ FIGMA" each wrapped onto two lines inside 40px.
The component sheds the least critical text instead: below 820px the
"/ Tool" suffix and the status label go, keeping the dot and every control.
Verified at 700px — no wrapping, no clipping, height stable.


---

## 4c. The panel component

`shared/organica-panel.css`. Modelled on Figma's Design panel, which is the
reference for a dense inspector that stays readable.

### What it replaced

Six panels, no two alike:

| | Width | Section heading | Label | Slider |
|---|---|---|---|---|
| Strata | fluid | 9px/400 | 11px | 3px |
| Spore | 240px | 9px/400 ls.18em | 10px | 2px |
| Pollen | 240px | 12px/600 ls.10em | 11px | 2px |
| Living Path | 280px | 10px/500 ls.20em | 11px | 3px |
| Halide | 240px | 12px/600 | 10px | 2px |
| Komorebi | 244px | 12px/600 | 10px | 2px |

Four heading styles, three widths, two slider tracks, two label sizes, **76
uppercase elements**, and two markup vocabularies (`.ctrl-row` vs `.row`).

### The rules

1. **Sentence case everywhere. No uppercase, no tracking on labels.**
   A 12px uppercase heading with 0.1em tracking reads as a wall of spaced
   capitals; 11px medium in sentence case takes *less* room and scans faster.
2. **Three levels of hierarchy, never four** — section → sub-label → row.
3. **Label left, control centre, value right**, values tabular so they don't
   jitter under a dragging slider.
4. **One row height** (`--row-h: 26px`) so controls align down the column.
5. **Nothing below `--fs-micro` (9px)** — Spore and Pollen had 6px index
   numerals and 8px captions.

### Type

| Element | Token | Was |
|---|---|---|
| Section title | 11px / 500, sentence | 12px / 600 uppercase + tracking |
| Sub-label | 9px / 500, sentence | 9px / 500 uppercase + 0.12em |
| Row label | 10px / 400 | 10–11px |
| Value | 10px, tabular | 10px |
| Note | 9px | `title=` tooltip |

### Adopting it

Class names match what the tools already used, so adoption is *link the file,
delete the local copy*. `.sec h3`, `.row` and `.group-label` are aliased for
Strata and Living Path, so their JS is untouched.

**Order matters:** the tool's own `<style>` comes after the linked sheet, so
any leftover local rule silently overrides the component. When migrating,
delete the local rules — don't just add the link.

### One panel, on the right

Every tool puts its controls in a **single panel on the right**. Strata had its
only panel on the left; Living Path had two (Input + Source view on the left,
Presets + Effect stack on the right). Both were consolidated: the stage gets
the full width, and the panel reads top-to-bottom as *what you load → what you
apply → what you inspect*.

Genesis Library keeps a left column, deliberately — it lists **sets**, which is
navigation, not controls. The rule is about where controls live, not about
banning left columns.

### Deliberate variant

Strata keeps its full-width slider with min/max captions ("Clean → Raw",
"Thin → Thick") instead of the label-left/value-right row. The slider's own
visual style is unified; the layout stays because those captions do real work
for a tool aimed at less technical decisions. A variant, not drift.


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
