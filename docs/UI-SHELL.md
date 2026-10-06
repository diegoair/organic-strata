# Organica — The UI Shell

> Studio Rann · Organica · The standard tool layout
> Last updated: October 2, 2026
> Reference implementation: `shared/_template.html` · page inventory: `/design-system/#templates`

---

## 1. What the shell is

Every Organica tool has the same layout (it began with five — Spore, Pollen,
Halide, Komorebi and, in spirit, Living Path):

```
┌──────────────────────────────────────────────────────────┐
│ HEADER   nav · logo / Tool · · · · account · patterns    │  64px (--header-h), in flow
├───────────────────────────────────┬──────────────────────┤
│                                   │                      │
│  CANVAS                           │  PANEL               │
│  the artwork, centred             │  controls, scrolls   │
│  drop target, zoom/pan            │  248px (--panel-w)   │
│                                   │                      │
│  HUD bottom-left   [ FLOATBAR ]   │                      │
└───────────────────────────────────┴──────────────────────┘
   the floatbar: Open · playback · Export, fixed bottom-centre
```

### Three templates (decided Oct 2, 2026 — `docs/DESIGN-DECISIONS.md` O-6)

| Template | For | Skeleton sheet | Start from |
|---|---|---|---|
| **Tool** | anything with a canvas and controls — the drawing above | `shell.css` | `shared/_template.html` |
| **Page** | anything that reads or lists (legal, admin, the test gallery) | `page.css` | an existing page — §6 |
| **Auth card** | the sign-in card, alone on the page (on an FVS field since Oct 2, 2026) | `auth-card.css` | `/sign-in/` |

Two documented variants, not templates of their own: an **own-surface** tool has
the Tool chrome (header, floatbar, `#panel`, mobile gate) but its own canvas
surface, so it does not link `shell.css`; an **own-layout** page has the page
chrome but not the `page.css` column. Which page is which, and why, is never
typed in a document: `scripts/templates.py` reads the pages and writes
`design-system/templates.json`, and [`/design-system/#templates`](/design-system/#templates)
renders it. `scripts/check.py` fails when a page's skeleton leaves its template
or the JSON is out of date. The rest of this document is the **Tool** template,
except where it says Page.

Until now this was **coherence by copy-paste**: Spore introduced it, Pollen
refined it, Halide and Komorebi cloned Pollen's `<style>` block almost verbatim
(~300 near-identical lines each). That produced a consistent look and a
maintenance problem — a fix to the shell in one tool never reached the others,
exactly as happened with the JS utilities before `core.js`.

This document is the shell's definition. `shared/_template.html` is a working
copy to start a new tool from.

**Superseded.** This section used to argue *"why a template and not a shared
stylesheet"* — that each tool tunes its own palette so a shared `shell.css`
would need an override for nearly every rule. That prediction was wrong and
the decision went the other way: `shared/shell.css` shipped, every page on the
Tool template links it (the list is generated — `/design-system/#template-tool`),
and the per-tool overrides amount to a handful of real deltas each. The
paragraph sat here contradicting §2 for a month. Kept as a note rather than
deleted because "the template will diverge" is a live risk in the *other*
direction now — see `docs/CSS-RULES.md` (b).

---

## 2. Required includes

In `<head>`, **in this order**:

```html
<link rel="stylesheet" href="/shared/tokens.css">
<link rel="stylesheet" href="/shared/icons.css">
<link rel="stylesheet" href="/shared/header.css">
<link rel="stylesheet" href="/shared/panel.css">
<link rel="stylesheet" href="/shared/floatbar.css">
<link rel="stylesheet" href="/shared/shell.css">
<!-- opt-in, in this order after shell: palette.css, seeds-panel.css -->
<link rel="stylesheet" href="/shared/mobile-gate.css">
<style> /* only the tool's own content — its --tool accent + one-off components */ </style>
<!-- …or, instead of the <style>, its own sheet in the same place: <link rel="stylesheet" href="/<tool>/<tool>.css"> (O-27; fvs/fvs.css) -->
<script src="/shared/pattern-init.js"></script>   <!-- theme + canvas pattern before first paint -->
```

A **page** links `tokens` → `icons` → `header` → `page` (→ `prose` for running
text) and never `panel` / `floatbar` / `shell`: `shell.css` pins `<body>` to the
viewport, which is how privacy and terms once could not scroll.

The full order, for any combination, is one list —
`tokens → icons → header → page → prose → auth-card → fvs-field → panel → floatbar → shell → palette → seeds-panel → mobile-gate`
— kept in `scripts/templates.py` and `scripts/css-lint.py` (`ORDER`), and both
fail a page that links them out of order. `<html>` carries `data-theme-support`
on every template.

**The authoritative list of shared files, what each owns and who must link
it, lives in one place:** [`/design-system/` § File architecture](/design-system/#file-architecture).
It used to be restated here, in `SHARED-COMPONENTS.md`, and on the
design-system page itself — which is how the repo ended up with four
different answers to "what is the shared CSS system", none of which mentioned
`mobile-gate.css`. Don't copy the list back into this file.

`shell.css` (added 2026-08-30) is the app-shell skeleton — the
box-sizing reset, the flex-column `<body>`, `#app`, the centred
`#canvas-wrap` stage area, `.org-stage` (the canvas element's shadow +
`.zoomed`/`.panning`/`.picking` cursor states — add `class="org-stage"` to
the canvas, its id varies per tool), `#zoom-hud` and `#drop-hint`. Before
it, every tool (17 then) carried its own ~30-line copy. A tool keeps only its
genuine deltas locally (`#canvas-wrap { padding: 0 }` for edge-to-edge
canvases, a bespoke `#stage-frame` — but never a different stage shadow: since
Sep 29, 2026 that is `--stage-shadow`, one value everywhere). The own-surface
tools (Apostate, Flexible Visual System, Rhizome, Genesis — `OWN_SURFACE` in
`scripts/templates.py`, each with its reason) don't link it; they still get the
surface palette from tokens. Mycel and TuneSutra name their region `#stage-wrap`
and Pulsar / Radial / Trellis `#stage`; all five carry `class="org-canvas-wrap"`,
the same rule under a class, and keep only real deltas local.

`floatbar.css` is the shared bottom-centre floating action bar
(`.org-floatbar`, `.org-popover`) that Export (and any playback controls)
lives in — see §5's WYSIWYG rule and the many tools' own "Export moved
here, not the header" notes. Linked by every tool except the Genesis
catalog pages, which use the `--catalog` header variant instead.
Since Sep 29, 2026 the bar is a **glass icon bar** (after Bencho's IconBar) —
a translucent pill, no tile behind buttons, one elastic indicator that
follows hover and rests on an open toggle (`Organica.floatbarPill` in
`core.js`). Since Oct 5, 2026 a **pressed** toggle carries its own static wash
(`--pane-thumb`), so an "on" state never vanishes when you hover another button
and independent toggles all show. Behaviour per section comes from the ARIA the
buttons already have: actions (no `aria-pressed`) = hover only; a choice (one
pressed) and toggles (any pressed) = their own wash + the pill on hover; an open
panel (`aria-expanded`) = the pill rests there. A bar with several sections wraps
each in `<span class="org-floatbar__group" role="group" aria-label="…">` (a real
flex box — never `display: contents`, Safari drops its role) with
`.org-floatbar__sep` between groups; the order inside a group is the tool's own
(see its manual). Tooltips are unchanged. Never add a per-tool `aria-pressed` /
`.is-armed` / hover background override: it lives in `floatbar.css`.

Before the tool's own `<script>`:

```html
<script src="/shared/core.js"></script>
<script src="/shared/icons.js"></script>
<!-- then what the tool uses: canvas.js, palette.js, select-picker.js, recorder.js … -->
```

and, as the last shared scripts before `</body>` (every template but the auth card):

```html
<script src="/shared/tools.js"></script>
<script src="/shared/menu-icon.js"></script>
<script src="/shared/header.js"></script>
```

Order is load-bearing: tokens first so the tool can override without
`!important`; core before the tool script so `Organica.*` exists at parse time.
The complete, current list is `shared/_template.html` — linted by the same rules.

If the tool places Genesis forms, also:

```html
<script src="/genesis/forms.js"></script>
```

**Colour controls — the Palette component.** `shared/palette.js`
(paired sheet `shared/palette.css`) is the one home for both the
single Ink/Paper swatch and the multi-colour RMX chip strip. One polymorphic
entry point:

- `Organica.palette.swatch('<prefix>', { initial, onChange })` — **attach
  mode**: wires pre-existing `#cp-`/`#hex-`/`#sw-`/`#btn-random-<prefix>`
  markup inside a labelled `.color-row` (CSS in `panel.css`, which
  every tool already links — no extra `<link>` needed).
- `Organica.palette.swatch(<wrapEl>, { colors, min, max, onChange })` —
  **generate mode**: builds `.rmx-color` chips into the element. Needs
  `palette.css`.
- `Organica.palette.colorAt(score, opts)` — score→colour (Solid/Adaptive/RMX).

Load after core; add the `<link>` only if you use generate mode:

```html
<link rel="stylesheet" href="/shared/palette.css">   <!-- generate mode only -->
...
<script src="/shared/palette.js"></script>
```

The old names `Organica.createColorSwatch` / `createPaletteChips` /
`Organica.Palette.colorAt` still work as thin aliases (removal tracked in the
Phase 2 migration). `organica-palette-chip.js` was folded into
`palette.js` on 2026-08-29; `createColorSwatch` moved out of
`core.js` at the same time.

**Video recording — `Organica.recorder`** (`shared/recorder.js`,
added 2026-08-30, no paired CSS). `Organica.recorder({ canvas, tool, fps,
duration, durationPadMs, onStart, onStatus, onStateChange }) → { toggle, start,
stop, isRecording }`. `canvas` may be a function (p5 tools). `duration` omitted
= manual stop; number|fn = auto-stop after N seconds (`durationPadMs` tail).
The tool keeps its own floatbar button and wires `toggleRecording` to
`rec.toggle()`. Load after core. Used by Pulsar / Camo Turing / Vortex /
Membrane.

**Seed source picker — `Organica.seedsPanel`** (`shared/seeds-panel.js`
+ paired `seeds-panel.css`, added 2026-08-30). The tabbed
Genesis/SVG/Text(/Image) picker + Genesis thumbnail grid.
`Organica.seedsPanel({ target, idPrefix, tabs, slots, subControls,
extraControls, genesis, text, svg, image, applyMode, onSeed, onTabChange,
onFontReady, onError })`. Polymorphic on `typeof target` (element = generate /
string = attach). `onSeed(result)` carries **both** `result.svgString` (the
canonical vector intermediate) and `result.descriptor` (raw
`{kind,formId,svgText,text,font,glyphPaths,fusedPath,imageEl}`) — each tool
adapts whichever it needs. `applyMode:'manual'` = the picker never fires; the
tool calls `panel.getDescriptor()` / `panel.getSVGString()` at its own Apply
step. `genesis.bakeGeometry:true` resolves CSS-driven form geometry (needs
`/genesis/animations.css`). `.PRIMORDIAL` = the shared curated form list —
**the 13 Genesis Base Seeds** since 2026-08-30 (`[1,2,3,7,9,13,14,21,26,28,37,41,56]`),
the whole of `ORGANIC_FORMS`, not a subset. A page with two panels passes distinct `idPrefix`es (Camo Turing).
Load after core; link the CSS. Used by Membrane / Camo Turing. Living Path
takes only `Organica.seedsPanel.PRIMORDIAL` (the shared curated form list) —
its Font/SVG/Genesis picker is bespoke (`.seg`/`.drop`/`.forms`, an OTF-export
"Font" workbench, no shared panel CSS); a full adoption waits on Living Path
moving to the shared shell.

```html
<link rel="stylesheet" href="/shared/seeds-panel.css">
...
<script src="/shared/recorder.js"></script>      <!-- if it records video -->
<script src="/shared/seeds-panel.js"></script>    <!-- if it has a seed picker -->
```

---

## 3. Palette contract

The six surface names (`--ink` `--paper` `--mid` `--accent` `--panel`
`--border`) are **defaults in `tokens.css`** as of 2026-08-30.
This section used to say each tool sets its own hex, on the theory tools
would diverge; 15 of 17 shipped byte-identical values, so they moved to
one place. A tool now declares only:

- **`--tool`** — its identity hue (tints the tool's primary action and
  accents). See `docs/DESIGN-SYSTEM.md` §5.
- the rare genuine override — `--ink: #241b14` for the warm-black trio
  (Warping / Radial / Pulsar), `--mid: #726a5e` for Blob Boundary.

| Variable | Role | Default |
|---|---|---|
| `--ink` | text, primary marks | `#0a0a0a` |
| `--paper` | page background | `#ffffff` |
| `--mid` | secondary text, dividers | `#696256` |
| `--accent` | emphasis text | `#2a2a2a` |
| `--panel` | inputs, selected rows, floating bars (the canvas surround moved to `--canvas-bg` + `--canvas-grid`, Sep 29, 2026) | `#eceae4` |
| `--border` | all 1px rules | `#d0c8b8` |

A tool's own **content** colour (Halide's ink/paper for the dithered
image, Pollen's dots) is still set locally — that's user data, not a role.
`--danger` (`#a03828`, validation / destructive text) is also in tokens.

---

## 4. Components

Class names are part of the contract — keep them.

### Topbar — **removed**

This section used to table a `.logo` / `.tb-btn` / `.tb-sep` / `.tb-spacer` /
`.tb-label` / `.tb-select` / `.tb-out` vocabulary, under a heading that reads
*"Class names are part of the contract — keep them."* None of those classes
has existed since the header became a shared component; the replacement is
`.org-header__*` in §4b below, and the actions moved to the floatbar. A dead
table under a "keep these" heading is worse than no table, so it is gone
rather than annotated.

### Canvas (`#canvas-wrap`, `flex: 1`)

| Class | What |
|---|---|
| `#canvas-wrap` | centres the canvas; `.drag-over` shows the drop outline |
| `#drop-hint` | the "+ drop an image" affordance; `.hidden` fades it out |
| `#zoom-hud` / `#hud` | bottom-left state chip, `pointer-events: none` |

`#canvas-wrap.checker` paints the alpha checkerboard for transparent output.

**Rules (Sep 29, 2026 — also on `/design-system/#canvas-stage`):**
- The canvas **area** is `background: var(--canvas-grid), var(--canvas-bg);` — white
  with the light cyan dot grid. A tool with its own stage area (not `#canvas-wrap`)
  uses the same line. Never `--panel`: that grey is interface chrome only.
- The **stage** (the sheet you draw on) gets its look from `class="org-stage"`
  (`--stage-shadow`, `transform-origin`, zoom cursors). Its id is free and per-tool
  (`#board`, `#preview`, `#view-canvas`…) because the script finds it by id — the
  style never hangs off the id. Where the class can't go (a p5 canvas, a re-rendered
  SVG) use `box-shadow: var(--stage-shadow)`. Never retype the shadow.
- The stage's own colour is the tool's Paper — user content, not a token.
- Every text on the canvas surface uses `var(--font)`; text drawn on a `<canvas>`
  reads `--font` at draw time (`shared/glyph-editor.js`).

### Panel (`--panel-w`, 248px, `overflow-y: auto`)

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

**Sliders** are `input[type=range]` — the one **Slosh slider** (Sep 29, 2026): grey `--track-bg` well, `--ink` spring liquid, full-height 9px handle, dotted centre line; the number beside it drags to scrub and clicks to type. Applied to every range by `Organica.enhanceSliders()`; see the design system's Slider entry. Never restyle `input[type=range]` in a tool.

**Checkboxes & switches** are one component (Sep 29, 2026): `.check-row` (checkbox) / `.check-row.org-switch` (switch), drawn by `shared/panel.css` from `--chk-size` so they look the same in every browser; the real `input[type=checkbox]` is kept. Never restyle a checkbox or hand-build a toggle in a tool. See the design system's "Checkbox & switch" entry.

---

## 4b. The header component

`shared/header.css` + `Organica.status()` / `Organica.popover()`.
Replaces five divergent bars. Full audit and rationale in this section.

### The rule

**One header, no variants** (v2, Sep 29, 2026): transparent, **64px** (`--header-h`: a 32px row inside `--header-pad-y`
= `--space-6` top and bottom), no border, **in flow** — every canvas starts below it, and pages that do height maths read `--header-h`
(never a typed fallback).
Left → right: **nav button** (opens the mega menu) · **logo mark** (placeholder) · **name** + `/ Page` · spacer ·
**Sign Up / Login** (signed out) or the **account control** · the **4 pattern circles**.
Everything else moves closer to what it acts on. Live reference: the design system's Header, Account control,
Mega menu and Pattern switcher entries.
The mega menu (Sep 29, 2026 regroup): one row of six groups by what you start from — Form & grid · From an image · Patterns · Colour · Type & vector · Motion — with Rhizome ("Chain them all") and the Explorations in its foot; data in `shared/tools.js`.

### Markup

```html
<head> … <script src="/shared/pattern-init.js"></script> </head>
<header class="org-header" role="banner">
  <button type="button" class="org-header__nav" aria-label="All tools" aria-controls="org-mega"><menu-icon state="menu" size="20" line-cap="square"></menu-icon></button>
  <a class="org-header__logo" href="/"><span class="org-header__mark" aria-hidden="true"></span><b>Organica</b><span>/ Tool</span></a>
  <div class="org-header__spacer"></div>
  <!-- JS appends: .org-mega + .org-pattern (header.js), .org-header__auth | .org-account (auth-badge.js) -->
</header>
…
<script src="/shared/tools.js"></script><script src="/shared/menu-icon.js"></script><script src="/shared/header.js"></script>   <!-- last, before </body> -->
```

Wire the behaviours:

```js
const setStatus = Organica.status();   // 'error' / 'busy' show a Notice; 'active' / '' are silent
Organica.popover(ctrl('btn-export'), ctrl('export-popover'));
```

**New tool:** one line in `shared/tools.js` — the mega menu is the only tool navigation (the hub has no nav of its own since Sep 29, 2026); `scripts/check.py` fails if a link doesn't resolve.
**Not** on the header: the sign-in page (a centred card), the archived `genesis/archive/indicators-55.html`.
The old variants (`--tool` / `--editor` / `--catalog`), the context slot and the status slot are gone.

### Notice (replaced the status slot, Sep 29, 2026)

The header's status slot (a dot + a line at the right) had grown into five
things: state ("Ready"), prompts that repeated the canvas's own drop hint,
live counts rewriting at slider-drag rate, a bare "—", and the errors that
were the only part worth keeping. It was removed from every header. Errors,
guards and progress ("Could not read that image", "Pause the simulation
before exporting SVG", "Recording 6s…") now show as a **Notice**
(`Organica.notice()` / `Organica.status()`, `.org-notice` in `header.css`):
centred on the canvas, always closable (×, Escape, 12s). Tools keep calling
`setStatus(state, msg)`; `'error'` and `'busy'` show, `'active'` and `''` are
silent. Never put status text in a header again — see the design system's
Notice entry.

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

Catalog pages inherit `body{padding:48px}` from `genesis/page.css` (the archive's own sheet — not `shared/page.css`, the Page template) for the form
grid; there the header escapes with `margin: -48px -48px 32px` plus
`position: sticky` rather than dropping the padding the grid needs.

### Responsive

The old bar never overflowed; flex simply squeezed until the logo,
"EXPORT SCALE" and "→ FIGMA" each wrapped onto two lines inside 40px.
The component sheds the least critical text instead: below 820px the
"/ Tool" suffix and the status label go, keeping the dot and every control.
Verified at 700px — no wrapping, no clipping, height stable.


---

### Buttons — one component (Sep 29, 2026)

Every text/icon button is `.org-btn` (shared/header.css, "THE BUTTON"): sizes `--sm` 20 · default 26 · `--lg` 32 (`--slo-h` / `--row-h` / `--space-8`), variants `--primary` · `--ghost` · `--danger`, shapes `--icon` · `--block`, pressed via `aria-pressed="true"` (or `.on` / `.active`). Sentence case, never uppercase. `.mini-btn` / `.panel-btn` / `.upload-btn` / `.icon-btn` / `.hud-btn` are aliases of it — use them or the modifiers, never a local button look. Re-check with `/design-system/_control-audit.html`.

### Fields — one component (Sep 29, 2026)

Every text/number input, select and textarea is `.org-field` (shared/header.css, "THE FIELD") or one of its aliases — `.panel-select` (full width), `.panel-input` (68px, right-aligned digits), `.color-hex`, `.org-select`. Same height and type as THE BUTTON, so a control row lines up. `--lg` 32 · `--block` · `--code` (mono). Never a local field look; re-check with `/design-system/_control-audit.html?kind=fields`.

### Dark mode — opting a tool in (Sep 29, 2026)

Dark mode is per page, opt-in (full rules: DESIGN-SYSTEM.md §5b). To opt a tool in:
1. `<html lang="en" data-theme-support>`.
2. Its own `<style>`: no raw chrome colours — a hex that means "panel grey" or "border" becomes `--panel` / `--border` / `--gray-*`. Content colours (the tool's Paper, marks) stay.
3. Anything that is work but not `.org-stage` (a preview frame, a results gallery, an SVG stage) gets `data-theme="light"` (Loom's `#canvas-frame`, the hub's gallery).
4. Canvas/export colours read through `Organica.contentColor()`, never `getComputedStyle(documentElement)`.
5. Shadows/scrims: `rgba(0,0,0,…)`, never an `--ink` mix (it glows in dark).
6. Run `/design-system/_dark-audit.html`, check both themes in the browser, and that PNG/SVG exports hash the same in both.

## 4c. The panel component

`shared/panel.css`. Modelled on Figma's Design panel, which is the
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
6. **A divider separates every two sections.** `.panel-section` draws it
   underneath; it is dropped only at the panel's end (`#panel` / `.org-panel`,
   also one wrapper deep) and inside a popover — never just because a section is
   the last of its wrapper (Oct 4, 2026). A wrapper followed only by hidden
   siblings leaves a line at the panel's end; CSS cannot skip `display:none`.

### Type

**The table that used to sit here was wrong** — it said Section 11/500,
Sub-label 9/500, Row label 10/400, and only one of those four rows matched
`tokens.css`. It was typed by hand and never re-checked. The live values are
generated from the stylesheet on
[`/design-system/` § Typography → Role tokens](/design-system/#typography),
which is now the only place they are written down. Components reference a
role token (`--t-section-size`), never a raw step.

### Adopting it

Class names match what the tools already used, so adoption is *link the file,
delete the local copy*. `.sec h3`, `.row` and `.group-label` are aliased for
Living Path, so its JS is untouched.

**Order matters:** the tool's own `<style>` — or its own sheet `/<tool>/<tool>.css`, linked in the same place (O-27) — comes after the linked sheet, so
any leftover local rule silently overrides the component. When migrating,
delete the local rules — don't just add the link.

### One panel, on the right

Every tool puts its controls in a **single panel on the right**. Strata had its
only panel on the left; Living Path had two (Input + Source view on the left,
Presets + Effect stack on the right). Both were consolidated: the stage gets
the full width, and the panel reads top-to-bottom as *what you load → what you
apply → what you inspect*.

Genesis has no left column — Library is a single scrolling grid under one
filter bar (the set picker included). *(It kept a left "Sets" sidebar until
Aug 30, 2026, when the picker + "new set" moved inline into the filter bar.)*

---

### Genesis: the seed library — three modes (Aug 30 – 31, 2026)

`genesis/index.html`, `genesis/creator.html`, and `genesis/library.html` used
to be three separate pages; they merged into `genesis/index.html` on Aug 27,
2026 (creator/library became `location.replace('/genesis/')` redirects). On
**Aug 30, 2026** Genesis dropped its role as a motion catalog and became the
**seed library, plainly**; on **Aug 31** it gained a dedicated **Edit** mode.
Three modes now:

- **Library** (the home) — `.app` is a single column (`1fr`), no side panels.
  Three stacked rows over a responsive auto-fill tile grid at a fixed "cozy"
  density (`--tile-min: 130px` / `--tile-gap: 12px`; the density toggle was
  removed):
  1. `.lib-modenav` — the **mode nav** (`#mode-tabs`, shared `.org-tabs`
     segmented control, **Library / Create** only); Create/Edit navigation is
     in the floatbar.
  2. `.lib-sets` — the **Sets** row: label · `#sets-seg` chips (name + count,
     click to activate) · `#btn-new-set` (`+`) · `#btn-manage-sets` (`⚙`, a
     toggle). `⚙` reveals `#sets-manage-list` **inline below the chips** (no
     popover): one row per set — the built-in "Base Seeds" row is label-only;
     each user row has inline rename (click the name → transient input, same
     commit/Esc/blur as `showNewSetInput`), `↑`/`↓` reorder (`disabled` at the
     first/last *user* row — the built-in is pinned at `sets[0]`), and `×`
     (two-click armed, `.is-armed`). `renameSet` rejects empty / case-insensitive
     duplicate names; `deleteSet` also deletes any `user-*` member now in **no
     other set** (Diego's call — the `×` is already armed) and falls back to
     Base Seeds if the active set went.
  3. `.lib-filters` — now just the **Type** seg (All/Asset/Variant/Mask/
     Container). The old **Source** seg (All/Organic/Primitives/My seeds) was
     removed Aug 31 — it was dead on every user set, and the `parametric /
     vector` tile badge already carries the one useful split.
  The built-in **Base Seeds** set = 13 organic forms + 6 procedural primitives,
  both synthesized (never stored). **Click a tile → Edit** (no detail card —
  removed Aug 31). Genesis's header is just the logo. The active set + the Type
  filter are remembered across reloads in `localStorage['organica.library.view']`
  (`{activeSetId, filter}`; a brand-new key, value-whitelisted on read, kept
  separate from `organica.library.forms` so a corrupt view blob can't hurt
  library data). Switching sets **no longer wipes the filter**.
- **Create** — `.app` becomes `[stage | panel]` (`.app--create` →
  `1fr var(--panel-width-right)`). Entering Create from any other mode runs
  `resetCreate()` → a **blank Freehand canvas** (nothing drawn, Save disabled).
  New shapes only: Draw (Paper.js freehand) / Generate (parametric kinds) / an
  Import icon in the **floatbar** that opens a file picker for an SVG.
- **Edit** — same `[stage | panel]` layout, reached by clicking a Library seed
  (the floatbar **Edit** icon is `disabled` until then). Adapts to the seed:
  - **parametric** (non-freehand `genType`) → its generator sliders, no canvas;
  - **vector** (freehand or raw SVG) → the seed's every contour becomes
    editable bezier anchors on the Paper canvas (`drawEditor.importSVG()` runs
    a raw seed through `paper.project.importSVG({expandShapes:true})` into a
    `CompoundPath`; a `<line>`-based seed opens in Stroke style).
  The right panel = an **Edit header** (kind badge · facts `<dl>` · an
  interactive **"In sets"** block · built-in notice · "filter will be
  flattened" warning) + Appearance transforms. The "In sets" block, for a
  `user-*` seed, is a checkbox per user set — toggling `push`es/`splice`s the
  seed id in `set.forms` directly (no copy minted), guarded so a seed can never
  fall out of *every* set (use the floatbar Delete for a real global removal).
  For a built-in it's just the count + a "Save a copy" hint.
  The **floatbar** (Create/Edit only) is the sole home of both mode navigation
  and the verbs, in one canonical order:
  **Create · Edit · Save · Back · Delete · Library · Export**, with the
  context extras slotted by their owner — **Import** (Create) after Create,
  **Duplicate** (Edit) after Edit, **Clear** (Create) after Back. `Back` is the
  Undo icon (shown for a live Paper canvas only). `Delete` is an icon button
  with a two-click armed confirm (`.is-armed` tint + aria-label swap), shown
  for a non-built-in seed in Edit; it replaces the old panel Delete button.
  `Export` downloads the current seed as a standalone `.svg` (viewBox
  `0 0 200 200`, `--ink` pinned), disabled when there's no shape. `Save` is
  the floatbar icon that opens the **Save popover** — `#btn-save-open` →
  `#save-popover`, upward from the bar. The popover holds Name / Type /
  underlying-layer / (Create only) a
  **Save-to** `<select>` (every set in Library-bar order, built-in "Base Seeds"
  `disabled`; defaults to the Library's active set) + new-set row, and one Save
  button. Create → `saveForm()` mints a `user-…` seed. Edit → disabled until dirty; the popover-open + Save click is
  the confirm — a user seed is overwritten in place, a built-in auto-forks a
  copy to "My Seeds". Dirty is tracked from `drawEditor` `onChange` + any
  `input`/`change` in `#design-panel` or `#save-popover`.

**Compose** (the drag-select-then-fill grid gesture) and **Import as its own
mode** were removed Aug 30. The `set` data model shrank with them — a set is now
a **plain ordered list of seed ids**, no `gridConfig`/`formLayout`/spans/
alignment. `migrateLibrary()` strips those on load and merges the old separate
`basic-seeds` set into Base Seeds (see `docs/SHARED-LIBRARY.md` §4).

`isCreatorMode()` = Create **or** Edit (both draw on the artboard, own the
status line). `isDrawMode()` = the Paper canvas is live (Create-Freehand, or a
vector seed in Edit). `S.gen.type === 'freehand'` still selects Draw vs a
generator; `geometry()` converges both to one path string
(`fill-rule="evenodd"` when `drawEditor.isMulti()`). Freehand/compound seeds
round-trip via `createPaperDrawEditor().serialize()`/`.load()` in
`shared/paper.js`. Create's `+`-imported SVG (`S.importInner` set) is still a
frozen markup import, gated out of the `genType` recipe.

**Never carried over** (from the original plain composer): Palette swatches,
Background pattern, per-shape Fill override, Randomize — no equivalent in the
`set` model. `genesis/genesis-creator.js` stays on disk, loaded by nothing, as
the record. The 55-form animated catalog lives at
`genesis/archive/indicators-55.html`; `genesis/indicators.html` is a redirect.

---

## 5. Behaviour contract

Every tool wires these the same way, using `core.js`:

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

Before step 1: `/ds consult <what is about to be built>` — the build brief says
what already exists and must be reused.

1. Copy `shared/_template.html` to `<tool>/index.html`. Never copy a neighbour.
   The template is linted with the same skeleton rules as every tool, so it is
   current by construction.
2. Replace the tool name in `<title>` and in the header logo (`/ New Tool`).
3. Declare `--tool` and nothing else (§3) — check the hue against
   `docs/DESIGN-SYSTEM.md` §5 first, and register it there in the same change.
4. Navigation: one line in `shared/tools.js` (the mega menu). There is no nav
   link to add in `index.html`. Then `vercel.json` (rewrite), `README.md` and
   `CLAUDE.md` (Tools table, Repo Structure).
5. Keep the skeleton: `.mobile-gate` first in `<body>`, the header with no
   actions, `.org-floatbar` a direct child of `<body>` with Open · playback ·
   Export, `#app` = the canvas region then `#panel` last.
6. Canvas: keep the template's `#canvas-wrap` + `class="org-stage"` on the sheet (§4 Canvas rules) —
   no local canvas-area background, no local stage shadow, no font outside `--font`.
7. `python3 scripts/templates.py` — regenerates `design-system/templates.json`,
   which is what puts the tool in `/design-system/#templates` and in the
   generated "Used in" lists. Commit the JSON with the tool.
8. `python3 scripts/check.py` — the "page templates" step lints the skeleton
   and fails if the JSON is stale. Then `/ds review` before the commit.

A tool that genuinely needs its own canvas surface is an entry in `OWN_SURFACE`
(`scripts/templates.py`) with its reason **and** a line in
`docs/DESIGN-DECISIONS.md` §3 — the owner's decision, not a way to pass the lint.

### Starting a new page

For anything that reads or lists. There is no starter file; the smallest real
examples are `privacy/index.html` (reading) and `admin/index.html` (data).

1. `<html lang="en" data-theme-support>`; link `tokens` → `icons` → `header` →
   `page` (→ `prose` for running text). Never `shell.css`.
2. `<body class="org-page">` (the canvas ground: paper + the dot pattern, like the hub — never `--panel`) or `class="org-page org-page--paper"` (flat paper, for content that sits on the ground itself).
3. The shared header, then one column: `<main class="org-page__col">` (660,
   reading) · `org-page__col--wide` (1040, data) · `org-page__col--full` (1500,
   gallery). The widths are the component's own `--page-col-w` — do not type
   another one.
4. `pattern-init.js` in `<head>`; `tools.js` → `menu-icon.js` → `header.js` last.
5. No mobile gate unless the page is unusable on a phone (the test gallery opts in).
6. `python3 scripts/templates.py`, then `python3 scripts/check.py`.

**Variant — a Page on a field** (Oct 2, 2026; `/404.html` is the one consumer).
The same template on a full-screen Flexible Visual System field instead of the
dot pattern: `<body class="org-page org-page--field">`, `fvs-field.css` linked
after `page.css` / `prose.css`, a `<div class="org-fvs-field" aria-hidden="true">`
after the header, a `<div class="org-fvs-field__band" aria-hidden="true">` in the
column above the card, and `fvs-field.js` — standalone, no `core.js` or any
other script needed (`color.js` + `palette.js` only to offer the saved palettes
too) — before the page's own script, which calls
`Organica.fvsField.mount(host, { motion, numerals, band, above, below, palette })`.
Two things differ from the plain Page: the **footer is a direct child of
`<body>`**, after `</main>` — a bar with the header's height and side padding,
not the column's closing line — and the **header shows no pattern switcher and
no theme button** (hidden by the sheet; the saved theme still applies). The
header and the footer each take an element-scoped `data-theme` from the
palette's ground. Markup, options, the two motions and the colour rule:
[`/design-system/#fvs-field`](/design-system/#fvs-field).

**The sign-in stands on the same field** (decided Oct 2, 2026 — O-13), and stays
the Auth card template: no header, no footer. `<body>` is a flex column
(`min-height: 100%`) holding the `.org-fvs-field` layer, the
`.org-fvs-field__band`, then `.org-auth-card`; `fvs-field.css` is linked after
`auth-card.css`; `fvs-field.js` loads right **after** `core.js` (core's last
line reassigns the `Organica` namespace — on a page that loads both, the field
script must come second). Circles spell WELCOME TO ORGANICA among triangles
(`text`, `elements: { cell: 'triangle', mark: 'circle' }`, `hold: false`); each
visit shows the other motion and the next built-in palette
(`localStorage['organica.signin.visit']`).

---

## 6b. Promoting an exploration to a production tool

An `explorations/<name>/` prototype and a production tool are deliberately
different shapes — the exploration convention (documented at the top of
`explorations/flow-field/index.html` and every sibling) is a standalone
file with **no** shared CSS, no `<header>`, bespoke local `:root` tokens,
raw px everywhere, and zero `Organica.*` beyond whatever vendored library
the prototype itself needed. That's correct for a prototype — cheap to
throw away, no product commitments. Promoting one to a real tool means
closing every one of those gaps, not just moving the file.

This checklist exists because it was skipped, partially, twice: Membrane's
own migration shipped without ever getting a CLAUDE.md Tools-table row or
Repo Structure entry, and Vortex's migration (which copied Membrane's
pattern) had to retroactively backfill that missing documentation *and*
discovered its own accent hex collided with Strata/Membrane's only after
shipping. Follow every line here in the same session as the migration —
"do it later" is exactly how the first two gaps happened.

- [ ] **Shell**: link the Tool template's sheets in the load-bearing order
  (`tokens.css` → `icons.css` → `header.css` → `panel.css`
  → `floatbar.css` → `shell.css` → `mobile-gate.css`, §2), add a real
  `<header class="org-header">` with the logo linking to
  `/`, put `class="org-stage"` on the canvas element, and migrate panel
  markup onto the shared `.panel-section`/`.ctrl-row`/`.panel-select`/
  `.color-row` classes instead of the exploration's own bespoke
  `.row`/`.sec-title`. Delete the exploration's own copy of the reset /
  `body` / `#app` / `#canvas-wrap` / `#zoom-hud` / `#drop-hint` rules —
  `shell.css` owns them. Start from `shared/_template.html`.
- [ ] **Tokens**: replace the bespoke local `:root` block with the shared
  token set; keep a local `:root` only for genuine tool-content colours
  (what the tool draws — the two-exception rule already in `CLAUDE.md`'s
  Critical Rules), never for spacing/type/UI chrome.
- [ ] **Accent — check the collision BEFORE picking, not after.** Grep the
  full registry in one shot:
  `grep -rhoP "^\s*--tool:\s*#[0-9a-fA-F]{6}" */index.html` (or the accent list
  `python3 scripts/ds-audit.py` prints)
  — plot the hues, find a real open gap, and say so in a comment next to
  the chosen hex (see `blob-boundary/index.html`'s own `--tool` comment
  for the pattern). An exploration's own placeholder accent is not a
  hint — it was picked with zero collision-checking and often does
  collide (`#e94f37`, Blob Boundary's own original placeholder, collided
  with both Strata's and Membrane's warm-red band).
- [ ] **Navigation**: add the tool to its thematic group in
  `shared/tools.js` (the mega menu — the hub has had no nav of its own since
  Sep 29, 2026) AND **remove it from `Organica.explorations`** — a promoted
  tool does not stay listed twice.
- [ ] **`vercel.json`**: add the tool's own rewrite entry, matching every
  other production tool. `explorations/` itself never needed one (Vercel's
  default static serving covers it), which is exactly why this step is
  easy to forget when promoting out of it — verified missing at least
  once already (Camouflage shipped without one).
- [ ] **`.gitignore`**: if the `explorations/<name>/` folder is being kept
  on disk as a local-only reference (not deleted outright), add it to the
  "Superseded exploration prototypes" block with a comment explaining why
  — same pattern as the existing Membrane/Vortex/Blob Boundary lines. If
  it's being deleted outright instead, just delete it; nothing to ignore.
- [ ] **Docs**: add the line to `README.md`'s Architecture list, register
  the accent in `docs/DESIGN-SYSTEM.md` §5's accent table AND its "Hub nav
  categories" table.
- [ ] **`CLAUDE.md`** — all three, in the same session, not deferred:
  the Tools table row, the Repo Structure tree entry, and a dated session
  note describing what changed structurally versus the original
  exploration (which shared components it adopted, what accent it picked
  and why, what if anything was deliberately NOT carried over).
- [ ] **Inventory**: `python3 scripts/templates.py`, commit
  `design-system/templates.json`; `python3 scripts/check.py` must pass its
  "page templates" step.
- [ ] **Verify**: fresh tab, 0 controls without an accessible name
  (`Organica.autoLabelPanel` wired in), console clean, the tool renders
  and behaves identically to the exploration it came from unless a
  difference was a deliberate, disclosed decision.

---

## 7. Known drift (not yet reconciled)

Honest list of where the tools still disagree:

- **App shell** — resolved 2026-08-30. `shell.css` owns the reset,
  `body`, `#app`, `#canvas-wrap`, `.org-stage`, `#zoom-hud`, `#drop-hint`;
  every tool links it but the four own-surface ones (§1; the list is generated,
  `/design-system/#template-tool`). This also retired the
  "Panel width — 240 vs 244 vs 260" item (one `--panel-w: 248px` token in
  `panel.css`) and the "Zoom/pan CSS still inline in Spore /
  Pollen / Halide" item.
- **Genesis** uses a different shell entirely (Library = one full-width grid
  under a filter bar; Create and Edit add a right design panel — `.app` /
  `.app--create` swap the column count). It predates this template; converging
  it is a bigger job than a rename.
- **Living Path** is fully retrofitted onto the shared panel component via
  its own documented aliases (`.sec`/`.row`/`.group-label`).
- **Mote** (promoted from `scratchpad/mote.html` Sep 1, 2026) links the Tool
  template's sheets and uses the standard header / panel / floatbar / `.org-stage`
  classes with the shared `#canvas-wrap` surround (white + dot grid: `--canvas-grid`, `--canvas-bg`)
  (the prototype's near-black stage was dropped Sep 1 as off-system). Source
  (open-file `＋`, webcam, mirror) lives in the floatbar, which also carries a
  small `#perf` readout (`ms / fps / pts`, `var(--font)` tabular). The Export
  popover has sub-heads (`.org-popover__title` + divider, the Vortex/Komorebi
  pattern) — **Still** (PNG / SVG), **Video — single** (Record / Render),
  **Video — batch** (Master + 5 by-ratio social `sz-*` checkboxes + Crop/Fit seg
  → Export batch, one `.mp4` per size) — plus FPS / Format / **Size** (HD→8K) /
  Length / Output rows. The floatbar carries a **Fullscreen** icon (after Export; it was a header button until Oct 2, 2026) → `body.kiosk`
  (hides header/panel/floatbar, canvas on `#000`, Fullscreen API, `k` toggles).
  Local rules: the hide-until-a-source rule, `#perf`, `#progress-bar` / `#note`,
  and the `body.kiosk` block.
- **`syncColor()`** — resolved 2026-08-30. Every production colour-picker tool now
  uses the shared Palette component (`Organica.palette.swatch`,
  `shared/palette.js` + `palette.css`); the `createColorSwatch` /
  `createPaletteChips` / `Organica.Palette.colorAt` aliases were removed. Membrane's
  `rmxColorAt` and Camo Turing's export `rmxLerpColor` deliberately stay separate
  (different colour lineage — see `SHARED-COMPONENTS.md` §3). `shared/_template.html`
  was refreshed to the current conventions on 2026-08-30 (uses
  `Organica.palette.swatch`, no more `syncColor`) and again on Oct 2, 2026 (below).
- **Layer card** — resolved 2026-08-30. Camo Turing's `.layer-card` and
  Colornet's `.chan-card` were first aliased onto `.org-layer-card`, then
  renamed to it outright the same day (Colornet's `.chan-card--armed` →
  `.chan-armed`); the aliases are gone. `panel.css` carries only
  `.org-layer-card` / `__head` / `__body` / `.active`; each tool keeps its
  own dot / name / opacity / thumbnail controls local.
- **Zoom/pan JS** — resolved 2026-08-30. Spore, Pollen and Halide's inline
  copies are gone; all three call `Organica.createZoomPan` now.
- **Templates** — resolved Oct 2, 2026 (`docs/DESIGN-DECISIONS.md` O-6 … O-10).
  Privacy / terms / admin / gallery are on `page.css` (privacy and terms scroll
  again); Membrane's and Vortex's grey `#panel` and stale `#app` height are gone;
  Mycel's and TuneSutra's `#stage-wrap` is `.org-canvas-wrap`; the starter
  template is current (dark-mode opt-in, icons, mobile gate first, no header
  actions, Open + Export in the floatbar, `selectPicker`) and linted; Spore's
  duplicate `id`, Camo Turing's raw panel width and Apostate's gate position
  are fixed.
- **Still open** (no decision needed — `docs/DESIGN-DECISIONS.md` §4 is the
  list): Camo Turing links `/genesis/animations.css`; Living Path loads
  opentype.js from a CDN; Colornet has two action buttons in the header.

---

*Organica System · October 2, 2026*
