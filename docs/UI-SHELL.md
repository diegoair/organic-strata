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
exactly as happened with the JS utilities before `core.js`.

This document is the shell's definition. `shared/_template.html` is a working
copy to start a new tool from.

**Why a template and not a shared stylesheet:** each tool tunes its own palette
(Halide is a darkroom, Komorebi a forest floor) and adds tool-specific controls.
A shared `shell.css` would need an override for nearly every rule.
Copying a *documented* template is honest about that; copying an undocumented
neighbour is what caused the drift.

---

## 2. Required includes

In `<head>`, **in this order**:

```html
<link rel="stylesheet" href="/shared/tokens.css">
<link rel="stylesheet" href="/shared/header.css">
<link rel="stylesheet" href="/shared/panel.css">
<link rel="stylesheet" href="/shared/floatbar.css">
<link rel="stylesheet" href="/shared/shell.css">
<style> /* only the tool's own content — its --tool accent + one-off components */ </style>
```

`shell.css` (added 2026-08-30) is the app-shell skeleton — the
box-sizing reset, the flex-column `<body>`, `#app`, the centred
`#canvas-wrap` stage area, `.org-stage` (the canvas element's shadow +
`.zoomed`/`.panning`/`.picking` cursor states — add `class="org-stage"` to
the canvas, its id varies per tool), `#zoom-hud` and `#drop-hint`. Before
it, all 17 tools carried their own ~30-line copy. A tool keeps only its
genuine deltas locally (`#canvas-wrap { padding: 0 }` for edge-to-edge
canvases, a lighter `box-shadow`, a bespoke `#stage-frame`). Genesis
(3-column shell), Rhizome and FVS (own canvas surfaces) don't link it;
they still get the reset + surface palette from tokens.

`floatbar.css` is the shared bottom-centre floating action bar
(`.org-floatbar`, `.org-popover`) that Export (and any playback controls)
lives in — see §5's WYSIWYG rule and the many tools' own "Export moved
here, not the header" notes. Linked by every tool except the Genesis
catalog pages, which use the `--catalog` header variant instead.

Before the tool's own `<script>`:

```html
<script src="/shared/core.js"></script>
```

Order is load-bearing: tokens first so the tool can override without
`!important`; core before the tool script so `Organica.*` exists at parse time.

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

- **`--tool`** — its identity hue, matching the hub nav accent (drives the
  header focus ring). See `docs/DESIGN-SYSTEM.md` §5.
- the rare genuine override — `--ink: #241b14` for the warm-black trio
  (Warping / Radial / Pulsar), `--mid: #726a5e` for Blob Boundary.

| Variable | Role | Default |
|---|---|---|
| `--ink` | text, primary marks | `#0a0a0a` |
| `--paper` | page background | `#ffffff` |
| `--mid` | secondary text, dividers | `#696256` |
| `--accent` | emphasis text | `#2a2a2a` |
| `--panel` | canvas surround, inputs | `#eceae4` |
| `--border` | all 1px rules | `#d0c8b8` |

A tool's own **content** colour (Halide's ink/paper for the dithered
image, Pollen's dots) is still set locally — that's user data, not a role.
`--danger` (`#a03828`, validation / destructive text) is also in tokens.

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

`shared/header.css` + `Organica.status()` / `Organica.popover()`.
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
| `--catalog` | title + count | Indicators (archived — `genesis/archive/indicators-55.html`) |
| `--editor` | mode tabs / breadcrumb | Genesis (Library / Create — the seed library, Aug 30, 2026 — see below) |

**All 11 pages migrated** (6 tool / 3 catalog / 2 editor, historical count —
Strata was among them and was later removed from the product). The stale
`#organica-banner` migration notice was removed from Genesis and Indicators.

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

Catalog pages inherit `body{padding:48px}` from `page.css` for the form
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
Living Path, so its JS is untouched.

**Order matters:** the tool's own `<style>` comes after the linked sheet, so
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
  One **filter bar** across the top: a **Sets** picker (segmented buttons per
  set + count, `+` to make a new one) then Source (All/Organic/Primitives/My
  seeds) · Type (All/Asset/Variant/Mask/Container) · Density
  (Cozy/Comfortable/Airy), over a responsive auto-fill tile grid. Each tile
  carries a **parametric / vector** kind badge. The active set + its count also
  show in the shared header status line. The built-in **Base Seeds** set = 13
  organic forms + 6 procedural primitives, both synthesized (never stored).
  **Click a tile → Edit** (no detail card — that was removed Aug 31). Density
  persists in `localStorage['organica.library.density']`.
- **Create** — `.app` becomes `[stage | panel]` (`.app--create` →
  `1fr var(--panel-width-right)`). New shapes only: Draw (Paper.js freehand) /
  Generate (parametric kinds) / a single **`+`** icon in Source that imports an
  SVG **file** (the old note + paste box are gone). Save mints a `user-…` seed.
- **Edit** — same `[stage | panel]` layout, reached by clicking a Library seed
  (the Edit tab is `disabled` until then). Adapts to the seed:
  - **parametric** (non-freehand `genType`) → its generator sliders, no canvas;
  - **vector** (freehand or raw SVG) → the seed's every contour becomes
    editable bezier anchors on the Paper canvas (`drawEditor.importSVG()` runs
    a raw seed through `paper.project.importSVG({expandShapes:true})` into a
    `CompoundPath`; a `<line>`-based seed opens in Stroke style).
  The right panel = an **Edit header** (kind badge · facts `<dl>` · built-in
  notice · "filter will be flattened" warning · Delete) + Appearance transforms
  + Name/Type. **No panel Save.** The **floatbar** carries the Edit verbs:
  Undo (vector only) · **Duplicate** (forks the on-screen edits into a new
  seed) · **Save** (disabled until dirty; a user seed → armed 2-click confirm →
  overwrite in place; a built-in → auto-fork a copy to "My Seeds"). Dirty is
  tracked from `drawEditor` `onChange` + any `input`/`change` in the panel.

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

1. Copy `shared/_template.html` to `<tool>/index.html`.
2. Replace the tool name in `<title>` and `.logo`.
3. Set the palette (§3) and add the identity colour.
4. Add the tool to `index.html` (nav link + accent class), `vercel.json`
   (rewrite), `README.md` and `CLAUDE.md`.
5. Register the accent in `docs/DESIGN-SYSTEM.md` §5.

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

- [ ] **Shell**: link the 5 shared CSS files in the load-bearing order
  (`tokens.css` → `header.css` → `panel.css`
  → `floatbar.css` → `shell.css`), add a real
  `<header class="org-header org-header--tool">` with the logo linking to
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
  `grep -rhoP "^\s*--tool:\s*#[0-9a-fA-F]{6}" */index.html` plus
  `grep -oP "nav__link--\w+:hover \{ color: #[0-9a-fA-F]{6}" index.html`
  — plot the hues, find a real open gap, and say so in a comment next to
  the chosen hex (see `blob-boundary/index.html`'s own `--tool` comment
  for the pattern). An exploration's own placeholder accent is not a
  hint — it was picked with zero collision-checking and often does
  collide (`#e94f37`, Blob Boundary's own original placeholder, collided
  with both Strata's and Membrane's warm-red band).
- [ ] **Hub nav**: add the real link in the correct thematic
  `.nav__group` (not "Explorations") with its own accent hover rule, AND
  **remove the link from the "Explorations" group** — a promoted tool
  does not stay listed twice. (An earlier session note said to leave the
  exploration link in place "for now"; the current repo state shows both
  Membrane's and Vortex's were in fact removed, just never documented
  as a deliberate step — this bullet makes that the documented rule.)
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
- [ ] **Verify**: fresh tab, 0 controls without an accessible name
  (`Organica.autoLabelPanel` wired in), console clean, the tool renders
  and behaves identically to the exploration it came from unless a
  difference was a deliberate, disclosed decision.

---

## 7. Known drift (not yet reconciled)

Honest list of where the tools still disagree:

- **App shell** — resolved 2026-08-30. `shell.css` owns the reset,
  `body`, `#app`, `#canvas-wrap`, `.org-stage`, `#zoom-hud`, `#drop-hint`;
  14 tools link it (all but Genesis / Rhizome / FVS, which keep their own
  canvas surface but still get the surface palette). This also retired the
  "Panel width — 240 vs 244 vs 260" item (one `--panel-w: 248px` token in
  `panel.css`) and the "Zoom/pan CSS still inline in Spore /
  Pollen / Halide" item.
- **Genesis** uses a different shell entirely (Library = one full-width grid
  under a filter bar; Create and Edit add a right design panel — `.app` /
  `.app--create` swap the column count). It predates this template; converging
  it is a bigger job than a rename.
- **Living Path** is fully retrofitted onto the shared panel component via
  its own documented aliases (`.sec`/`.row`/`.group-label`).
- **`syncColor()`** — resolved 2026-08-30. Every production colour-picker tool now
  uses the shared Palette component (`Organica.palette.swatch`,
  `shared/palette.js` + `palette.css`); the `createColorSwatch` /
  `createPaletteChips` / `Organica.Palette.colorAt` aliases were removed. Membrane's
  `rmxColorAt` and Camo Turing's export `rmxLerpColor` deliberately stay separate
  (different colour lineage — see `SHARED-COMPONENTS.md` §3). `shared/_template.html`
  was refreshed to the current conventions on 2026-08-30 (links all 5 sheets,
  uses `Organica.palette.swatch`, no more `syncColor`).
- **Layer card** — resolved 2026-08-30. Camo Turing's `.layer-card` and
  Colornet's `.chan-card` were first aliased onto `.org-layer-card`, then
  renamed to it outright the same day (Colornet's `.chan-card--armed` →
  `.chan-armed`); the aliases are gone. `panel.css` carries only
  `.org-layer-card` / `__head` / `__body` / `.active`; each tool keeps its
  own dot / name / opacity / thumbnail controls local.
- **Zoom/pan JS** — resolved 2026-08-30. Spore, Pollen and Halide's inline
  copies are gone; all three call `Organica.createZoomPan` now.

---

*Organica System v0.1 · July 25, 2026*
