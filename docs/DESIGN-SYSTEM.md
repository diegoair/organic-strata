# Organica — Design System

> Studio Rann · Organica · Typography, tokens, and the Figma mapping
> Last updated: August 26, 2026
>
> **Single source of truth: `shared/tokens.json`.**
> `shared/tokens.css` mirrors it for the browser; this document
> explains it; Figma variables and text styles are named to match. A value
> changes **here first**, then in the CSS, then in Figma. Anything that
> disagrees with the JSON is a bug, not a variant.

---

## 1. One typeface

**Wix Madefor Display**, everywhere, via `--font`. Nothing else. (Since Sep 29, 2026 —
until then the typeface was **Manrope**; the rest of this document still names Manrope's
styles where it records history.)

Wix Madefor Display is a **variable font** with a single weight axis running **400–800**, so
the whole range costs one file. Self-hosted, loaded once from `tokens.css`:

```css
@font-face {
  font-family: 'Wix Madefor Display';
  src: url('/shared/vendor/wix-madefor-display-variable.ttf') format('truetype-variations');
  font-weight: 400 800;
}
:root { --font: 'Wix Madefor Display', 'Manrope', ui-sans-serif, system-ui, sans-serif; }
```

There is **no 300**: `--w-light` (panel labels, sub-labels, values) renders as 400. Manrope
stays vendored — it is the fallback in `--font`, and the text seeds read its file for glyph
outlines (opentype.js).

### What this replaced

Organica had accumulated four typefaces under four different variable names:

| Was | Where | Problem |
|---|---|---|
| Syne + Syne Mono | hub | a third and fourth family for one page |
| DM Sans + DM Mono | Strata, Living Path | loaded properly, but two more families |
| Georgia (serif) | Genesis pages | a fifth voice, unrelated to the rest |
| `ui-monospace` | Genesis pages | system-dependent — different on every OS |
| `'DM Mono'` **declared but never loaded** | Spore, Pollen, Halide, Komorebi, Genesis Library, Genesis Creator | six pages silently rendered system monospace; the design was never what the CSS claimed |

Four names described the same idea — `--font`, `--sans`, `--mono`, `--display`.
With one family the distinction is meaningless, so **`--font` is now the only
name**. The other three still resolve (as aliases at the bottom of the tokens
file) so old rules keep working, but new code uses `--font`.

---

## 2. Type scale

A **1.2 ratio (minor third)** anchored at **11px** — the size the tool panels
were already built around. Steps are rounded to whole pixels so text lands on
the pixel grid in a dense UI.

| Token | Size | Used for |
|---|---|---|
| `--fs-micro` | 9px | sub-labels, labels, values — **the panel floor** |
| `--fs-small` | 10px | section titles, controls |
| `--fs-base` | 11px | header and body text outside the panel |
| `--fs-medium` | 12px | header context title |
| `--fs-large` | 14px | headings inside a tool |
| `--fs-xl` | 17px | tool title |
| `--fs-2xl` | 20px | editorial H3 |
| `--fs-3xl` | 24px | editorial H2 (max) |
| `--fs-4xl` | 32px | editorial H1 (max) |
| `--fs-5xl` | 44px | reserved step |
| `--fs-6xl` | 64px | display (max) |
| `--fs-display` | fluid | hub wordmark only |

`--fs-display` is `clamp(1.5rem, 9vw, 13rem)` — it scales with the viewport and
exists only on the hub. Everything else is fixed, because a tool panel that
reflows with the window is harder to use, not easier.

**Nothing goes below 9px.** Spore and Pollen had 6px index numerals and 8px
captions; at panel density they stop being readable.

### Weights

Space Grotesk's axis is 300–700; the system uses 400–700. Organica defines four stops.

**The number is canonical, not the token name.** Figma's weight picker shows the
font's own style names, so a token called "medium" holding 400 would read as
*Regular* in Figma and the two would silently disagree.

| Token | Value | Used for |
|---|---|---|
| `--w-regular` | 400 | body, panel section titles and controls |
| `--w-medium` | 500 | emphasis, primary action, H4/H5 |
| `--w-semibold` | 600 | H2/H3, `<strong>` |
| `--w-bold` | 700 | H1, display, overline, wordmark |

### Letter spacing

**Panel type carries no tracking at all.** Tracking exists only for the
uppercase micro-labels that survive in the header (the tool logo, button
labels) — the rule being that the smaller and more uppercase the text, the more
tracking it needs to stay legible. Sentence-case text never needs it.

| Token | Value | Figma | Used for |
|---|---|---|---|
| `--ls-display` | −0.03em | −3% | display — big type needs negative |
| `--ls-tight` | −0.02em | −2% | H1, H2 |
| `--ls-snug` | −0.01em | −1% | H3 |
| `--ls-normal` | 0 | 0% | **everything in the panel** |
| `--ls-wide` | 0.05em | 5% | hex fields |
| `--ls-wider` | 0.08em | 8% | header button labels |
| `--ls-widest` | 0.15em | 15% | the tool logo |

CSS em maps **1:1** to Figma percent — `0.08em` = `8%`. Don't type `0.08`.

### Line height

Unitless, so it scales with the element's own size.

| Token | Value | Used for |
|---|---|---|
| `--lh-none` | 1 | display |
| `--lh-tight` | 1.15 | H1 |
| `--lh-heading` | 1.25 | H2–H6 |
| `--lh-snug` | 1.45 | multi-line labels in panels |
| `--lh-normal` | 1.7 | body copy, docs, help text |

---

## 3. Text styles — the roles

Components reference a **role**, never a raw size or weight. These are the
composed styles, and they map one-for-one to Figma text styles.

| Role | Size | Weight | Manrope | Tracking | Colour | Example |
|---|---|---|---|---|---|---|
| `panel/section` | 10 | 400 | Regular | 0 | `--ink` | Presets, Dither, Canopy |
| `panel/control` | 10 | 400 | Regular | 0 | `--accent` | segmented buttons, selects |
| `panel/sub-label` | 9 | 300 | Light | 0 | `--mid` | Algorithm, Resolution |
| `panel/label` | 9 | 300 | Light | 0 | `--accent` | Grid width, Gamma |
| `panel/value` | 9 | 300 | Light | 0 | `--mid` | 120, 1.5 · tabular |

Outside the panel:

| Role | Size | Weight | Manrope | Tracking | Colour | Example |
|---|---|---|---|---|---|---|
| `header/logo` | 10 | 700 | Bold | 15% | `--mid` | ORGANICA / HALIDE |
| `header/title` | 12 | 500 | Medium | 0 | `--ink` | Sketch → SVG |
| `header/action` | 10 | 500 | Medium | 8% | `--ink` | EXPORT, FIGMA |
| `display/wordmark` | 96\* | 800 | ExtraBold | −3% | — | ORGANICA |

### Editorial roles

For pages that read (hub, docs, legal, sign-in) — never the tool panel. Tokens are
`--t-<role>-size|weight|lh|ls`. Display, H1 and H2 are fluid (`clamp`); everything
else is fixed.

| Role | Size | Weight | LH | Tracking | Use |
|---|---|---|---|---|---|
| `display` | 64 (fluid) | 700 | 1 | −3% | hub hero only |
| `heading/h1` | 32 (fluid) | 700 | 1.15 | −2% | page title |
| `heading/h2` | 24 (fluid) | 600 | 1.25 | −2% | section |
| `heading/h3` | 20 | 600 | 1.25 | −1% | subsection |
| `heading/h4` | 17 | 500 | 1.25 | 0 | tool / card title |
| `heading/h5` | 14 | 500 | 1.25 | 0 | group title |
| `heading/h6` | 11, UPPERCASE | 700 | 1.25 | 8% | overline / eyebrow |
| `body/lg` | 14 | 400 | 1.7 | 0 | lead paragraph |
| `body/md` | 12 | 400 | 1.7 | 0 | docs, legal |
| `body/sm` | 11 | 400 | 1.45 | 0 | outside-the-panel text |
| `caption` | 10 | 400 | 1.45 | 0 | hints, help |

Code and mono use the same `--font` with tabular figures (no second typeface).
Links are underlined `--ink`; `<strong>` is 600.

### Two styles, and colour does the rest

**The panel runs on exactly two type styles: 10/400 and 9/400** (no Light — thin 9px strokes in grey are the wrong trade for legibility; `--w-light` was removed).

`panel/section` and `panel/control` are typographically identical — a section
title is told from a button only by being `--ink` (near-black) rather than
`--accent`, and by sitting on its own line. Likewise `sub-label`, `label` and
`value` share one style and differ only in colour and alignment.

This is the Figma Design-panel model taken to its conclusion: **contrast does
the work, not bulk.** It is also the system's most fragile point — if a future
role needs distinguishing, reach for colour or position first, and add a type
style only if neither works.

`--fs-micro` (9px) is the floor. Three of the five panel roles now sit on it,
in Light. That is deliberate density, but it means there is no headroom left
below: anything that needs to recede further has to do it with colour.

### In CSS

Components reference the role tokens, never a raw value:

```css
--t-section-size  / --t-section-weight
--t-control-size  / --t-control-weight
--t-sublabel-size / --t-sublabel-weight
--t-label-size    / --t-label-weight
--t-value-size    / --t-value-weight
```

---

## 3b. Porting to Figma

Create the roles above as **text styles**, named exactly as in the tables
(`panel/section`, `header/logo`, …) so a Figma layer and a CSS rule can be
traced to each other by name.

Font: **Manrope** from Google Fonts. Pick the style by its Manrope name
(Light / Regular / Medium / Bold / ExtraBold) — that is what Figma's picker
shows, and it is why the tokens record the font's own names rather than
inventing their own.

Every role in `shared/tokens.json` carries a `$figma` block with the
values already converted, so they can be copied across without arithmetic.

Two conversions that catch people out:

- **Tracking** — Figma is a percentage, CSS is em. They map 1:1: `0.08em` = `8%`.
  Don't type `0.08` into Figma.
- **Line height** — enter as a **percentage**, not pixels, so the style survives
  a size change.

\* The web wordmark is fluid (`clamp(1.5rem, 9vw, 13rem)`); 96 is a sensible
fixed stand-in for a Figma frame. Adjust per artboard — the *ratios* matter
(0.88 line height, −3% tracking), not the absolute size.

---

## 4. Spacing & radius

A **4px base grid**. The panel layout was already built on these values; they
are written down now so the next tool doesn't invent its own.

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--space-1` | 4px | | `--radius-sm` | 2px |
| `--space-2` | 6px | | `--radius-md` | 4px |
| `--space-3` | 8px | | `--radius-lg` | 8px |
| `--space-4` | 10px | | | |
| `--space-5` | 14px | | | |
| `--space-6` | 16px | | | |
| `--space-7` | 24px | | | |
| `--space-8` | 32px | | | |

Organica's surfaces are flat and near-square — **radius is a whisper, not a
feature**. `--radius-lg` (8px) is already the loudest the system gets.

**Spacing utility classes** (`shared/tokens.css`): `.mt-1`…`.mt-8` /
`.mb-1`…`.mb-8` (`margin-top`/`margin-bottom: var(--space-N)`), `.u-flex1`
(`flex: 1 1 auto`), `.u-hidden` (`display: none`). All carry `!important` —
a utility only does its job if it always wins the cascade; a component's own
compound selector (`.row .val`) already outranks a single class without it.
`.u-hidden` is only safe on elements that are hidden once and never shown
again (a permanently-hidden file-input trigger) — anything toggled from JS
via `el.style.display = show ? '' : 'none'` must keep the inline
`style="display:none"` it started with, or clearing the inline style falls
back to the class and it never shows.

**Two tokens outside the spacing/radius scale:**

| Token | Value | Role |
|---|---|---|
| `--accent-warm` | `#c2551b` | The one accent (slider fills were retired Sep 29, 2026 — the Slosh slider is ink on `--track-bg`) — deliberately *not* `--tool` (which is blue for Halide/Spore), so a control reads as "you're dragging this" identically regardless of which tool it's in. Computed for contrast: 3.79:1 on `--panel`, 4.08:1 on `--paper`. |
| `--track-bg` | `color-mix(in srgb, var(--ink) 10%, var(--panel))` | The slider track's empty-portion housing — derived per-tool automatically, never a hardcoded hex. |
| `--gray-0` … `--gray-900` | `--gray-0` = `--paper`; step N = `color-mix(in srgb, var(--ink) N/10, var(--paper))` (100 = 10% … 900 = 90%) | **The grey scale — the scale of black** (added Sep 29, 2026, at Diego's request). Ten steps, derived from each tool's own `--ink`/`--paper` so they follow warm-black tools. For "a grey" that isn't a surface role; the role tokens (`--panel`, `--track-bg`, `--border`, `--mid`) keep their names. The design-system page's own background is `--gray-100`. |
| `--canvas-bg` | `var(--paper)` (#ffffff) | The canvas **area** every tool's stage sits on (`#canvas-wrap` / `.org-canvas-wrap` in `shell.css`, plus Flexible Visual System, Rhizome, Genesis, Apostate, Mycel, TuneSutra's own stage areas). Replaced the grey `--panel` area on Sep 29, 2026. |
| `--canvas-dot` | `#a8dff0` | Light cyan blue of the canvas dot grid. |
| `--stage-shadow` | `0 4px 40px rgba(0,0,0,.18)` | The one shadow of the **stage** — the sheet you draw on, class `.org-stage` in `shell.css`. Its element `id` differs per tool (`#board`, `#preview`, `#gl-canvas`, `#view-canvas`, `#stage`…) because each tool's script finds it by id; the *style* is the class/token, never the id. Used by all 22 tools that have a sheet (Rhizome is an infinite node canvas, no sheet). |
| `--canvas-grid` | `radial-gradient(circle, var(--canvas-dot) 1px, transparent 1.4px) 0 0 / var(--space-7) var(--space-7)` | The dot grid itself, one 24px pitch everywhere. Use as `background: var(--canvas-grid), var(--canvas-bg);` (grid layer over the colour). The stage/sheet on top keeps its own colour — a tool's Paper is user content. |

---

## 5. Colour — per-tool accents

Colour is *not* centralised in the tokens file, deliberately: each tool owns a
light/dark palette suited to what it renders (Halide is a darkroom, Komorebi is
a forest floor). What **is** systematic is the **accent per tool**, used on the
hub nav and as the tool's identity colour.

| Tool | Accent | Reading |
|---|---|---|
| Genesis | `#c8f060` | acid green — organic vitality (Creator's own `#5fc9b4` teal retired Aug 27, 2026 — merged into Genesis, see CLAUDE.md) |
| Spore | `#a0c8f0` | cool blue-grey |
| Pollen | `#e8c84a` | pollen yellow |
| Living Path | `#b48cf0` | vital violet |
| Halide | `#7a9cb8` | darkroom steel-blue |
| Komorebi | `#8aa054` | dappled forest-green |
| Camo Turing | `#3f8fa0` | teal-blue |
| Warping | `#a9683e` | wood / warm terracotta |
| Loom | `#4a7fc9` | blueprint blue |
| Membrane | `#c15b4a` | warm coral / tissue-red |
| Vortex | `#6d4bd8` | deep indigo |
| Flexible Visual System | `#3fa876` | emerald |
| TuneSutra | `#c93ed6` | vivid orchid / magenta |
| Mycel | `#8a7355` | mushroom taupe |
| Colornet | `#4a5fc7` | cornflower blue-violet |
| Blob Boundary | `#8a8a28` | mustard gold |
| Mote | `#2f9e8f` | sea-green teal — the Motion band's cool accent (hue ~172, between Flexible Visual System's green and Camo Turing's cyan) |

The palette spans green → yellow → orange → blue → violet → teal. When adding a
tool, pick a hue that isn't already taken and note it here. (Strata's own row
was retired along with the tool — see the removal note in `CLAUDE.md`'s
session log.)

### Hub nav categories

The hub (`index.html`) groups tools by function, not alphabetically or by
ship date — each `.nav__group` carries a `group-label`:

| Category | Tools |
|---|---|
| Seed / Form | Genesis |
| Coloring & palette | TuneSutra, Colornet |
| Grid & composition | Loom, Flexible Visual System |
| Tracing & vectorization | Halide, Living Path |
| Generative patterns | Komorebi, Camo Turing, Warping, Radial |
| Stippling & marks | Spore, Pollen |
| Motion & growth | Membrane, Vortex, Pulsar, Mycel, Mote, Blob Boundary |
| Workflow & pipelines | Rhizome |
| Explorations | (prototype pages, not full tools) |

When adding a tool, pick the category it actually belongs to functionally —
not the newest/emptiest one — or propose a new category if none fits.

### `--mid` — the one colour that IS systematic

Every tool's secondary-text colour (labels, values, sub-labels — most of the
panel, per §3) must be **`#696256`**. Not a per-tool choice.

An audit found three different values doing this job — Strata's own
`--muted: #888` (hardcoded, not even the same variable name), Spore's
`--mid: #c8c0b0`, and everyone else's `--mid: #726a5e` — with real contrast
failures, not close calls:

| Was | vs paper | vs panel | |
|---|---|---|---|
| Strata `#888` | 3.17:1 | — | fails AA (4.5:1) |
| Spore `#c8c0b0` | 1.62:1 | — | fails badly — this was rendering section titles, hints and index numerals |
| Everyone else `#726a5e` | 4.77:1 | 4.43:1 | fails AA **on panel background** |

`#696256` clears **5.4:1 on paper, ≥5.0:1 on panel** — real headroom above the
4.5:1 floor, not a value tuned to just barely pass. Computed the same way as
`--border-strong` (§ above): don't eyeball a "looks dark enough" grey.

---

## 5b. Dark mode (Sep 29, 2026)

> **Rule (Diego, Sep 29, 2026): every new component, token and style must work in both themes.** A token lands with a light and a dark value; a component is built from tokens only; it is checked with the header toggle and `/design-system/_dark-audit.html` before it ships.

**Dark flips the chrome, never the work.** Header, panel, floatbar and the canvas area around the sheet go dark; the sheet (`.org-stage`, or anything marked `data-theme="light"`) keeps the light palette and the tool's own Paper. Preview = export: exports are byte-identical in both themes.

- **Tokens** — `shared/tokens.css`, section THEMES: (1) the light literals on `:root`, `[data-theme="light"]` and `[data-theme="dark"] .org-stage`; (2) the dark literals on `:root[data-theme="dark"]` / `[data-theme="dark"]`; (3) the derived tokens (`--track-bg`, `--gray-*`, `--canvas-bg`, `--canvas-grid`) on `:root, [data-theme], .org-stage`, so they re-compute in each scope. `--border-strong` moved here from `header.css`.
- **Dark values** (on `--paper #121210` / `--panel #1f1e1a`): `--ink #eceae4` 15.6:1 · `--mid #a39c90` 6.9:1 · `--accent #d9d6cf` · `--border #3a362f` (decorative) · `--border-strong #7d725e` 3.97:1 · `--accent-hover #bdb8ae` · `--danger #e0735f` 6.1:1 · `--canvas-dot #2e4a55` · `--stage-shadow` 0.6 · `--accent-warm` unchanged (4.1:1). The design-system self-check fails if a dark text token drops under 4.5:1 or `--border-strong` under 3:1.
- **Switch** — the header's moon/sun button (`shared/header.js`, `.org-theme`), saved in `localStorage['organica.ui.theme']`, applied before first paint by `shared/pattern-init.js`. No OS following (Diego's call).
- **Opt-in per page** — `<html data-theme-support>`. Opted in: hub, design system, Pollen, Loom, Flexible Visual System. Every other page stays light even when the user chose dark, and shows no button.
- **Canvas / export colours** — never read off `documentElement`; use `Organica.contentColor('--ink')` (core.js), which reads the light content palette.
- **Shared sheets** — no raw hex outside `tokens.css` (css-lint check `shared-hex`).
- **Shadows and scrims are black in both themes** (`rgba(0,0,0,…)`), never `color-mix(var(--ink) …, transparent)` — in dark `--ink` is light, so it glows. Focus rings, by contrast, follow `--ink`.
- **Always-dark bands** (the hub's marquee and CTA) carry `data-theme="dark"` and paint `--paper`/`--ink` from the dark palette in both themes, instead of an `--ink` slab that would turn into a light slab in dark.
- **Audit** — `/design-system/_dark-audit.html` (dev page, press Run) loads every page light and dark and lists text under the WCAG floor and light islands left in dark chrome; pages not opted in are forced dark to show readiness.

## 5c. Buttons (Sep 29, 2026)

One component, `.org-btn` in `shared/header.css`: sizes `--sm` (`--slo-h`, 20) · default (`--row-h`, 26) · `--lg` (`--space-8`, 32); variants default outline · `--primary` · `--ghost` · `--danger`; shapes `--icon` · `--block`; pressed = `aria-pressed="true"` / `.on` / `.active`. Display face, `--t-control-size`, sentence case, `--radius-sm`. `--row-h`/`--slo-h` moved from panel.css into tokens.css so every page can size buttons. Legacy names are aliases (`.mini-btn`, `.panel-btn`, `.upload-btn`, `.icon-btn`, `.hud-btn`). The audit (`/design-system/_control-audit.html`) found 78 looks across 1,299 buttons before; the text buttons now resolve to the system's sizes only.

## 5d. Fields (Sep 29, 2026)

One component, `.org-field` in `shared/header.css` ("THE FIELD"), for text/number inputs, selects and textareas — THE BUTTON's measures: display face, `--t-control-size`, `--row-h` tall (`--lg` 32), `--panel` fill, `--border-strong`, `--radius-sm`; hover `--mid`, focus `--ink`. Modifiers `--lg`, `--block`, `--code` (mono). Aliases: `.panel-select`, `.panel-input`, `.color-hex`, `.org-select` (deltas in panel.css). The select-picker trigger has the same border and type but is 32px (`--space-8`), so its thumbnail sits in even `--space-1` air.

**The thumbnail select picker** (`Organica.selectPicker`, `shared/select-picker.js` + `.presets*` in panel.css; live reference `/design-system/#select-picker`). A dropdown gets thumbnails only when all three hold: (1) the options differ *visibly*, (2) the name doesn't predict the look (any user-named saved preset qualifies), and (3) the image comes from the tool's **own renderer**, never a drawing of it. Size follows what differs:
- **Every thumbnail is a square** — 22px in the trigger, 40px in the menu (Oct 1, 2026; was 26px icons and 3:2 60×40 / 33×22 previews). Aspect icons (`Organica.aspectIcon`) and grids (`Organica.loomGridThumb`) keep their true ratio, letterboxed inside the square; rendered previews are drawn square or cropped with `Organica.squareThumb(canvas)`.
- **icon** (default) is a `currentColor` pictogram for structure (shape kinds, aspect ratios, motion diagrams). It follows `--ink`.
- **preview** (`size:'preview'`) is a rendered image for look and texture (dither, stipple, grain, light, palettes). It is content, so it stays light in dark mode.

Thumbnails are lazy (`thumb:` renders when the menu first opens, one per frame, cached; `invalidate(key)` after a re-save). Image-effect tools all render on the same subject, `Organica.previewImage`. Placeholder options (empty value) are never rows; with nothing to pick, the menu shows the tool's disabled hint option. The Sep 30, 2026 audit applied it to Radial, Pulsar, Warping, Halide, Pollen, Colornet, Komorebi, Mote (moved off its own custom list), TuneSutra, Loom, Flexible Visual System, Trellis, Membrane and Vortex, then Flexible Visual System's built-in recipes (a synthetic entry through the saved-Component renderer), Mycel's saved networks and Blob Boundary's saved presets. Rhizome graphs and the Genesis arc type don't qualify. Audit: `/design-system/_control-audit.html?kind=fields` (347 fields, 24 looks → 317 in one look; the rest documented exceptions).

## 5e. Working with AI — governance (Sep 30, 2026)

The design system is maintained with an AI coding agent as a collaborator; it never holds a decision. **Loop:** audit (the agent measures what every tool really renders — `/design-system/_control-audit.html`, `_dark-audit.html`) → propose (one consolidated component/token set, often with a mock) → **decide (owner)** → build & migrate (tokens only, old classes kept as aliases) → verify (css-lint, the Flexible Visual System regression, the design-system self-check, light + dark in a browser) → document (this file, the live reference, a session note). **Two owner gates:** what gets built, and what ships ("commit in prod"). **Decision rights:** new/changed token, new shared component, exceptions → the owner decides; one-off styles in a tool → not allowed (css-lint, audits); anything new → must work in both themes; release → owner, explicit go. **Rules** live in `CLAUDE.md`, read by the agent at every session start, so every teammate works with the same collaborator and standards. Live version with the governance flow: the design system's "Working with AI" entry; shareable page: https://claude.ai/artifact/2YDV3hau2WR9dZVejTieoh

## 6. Accessible names

**Every interactive control needs a name a screen reader can announce.** A
July 26, 2026 audit of the six tools that existed at the time found 121 of
~210 form controls with no accessible name at all — a slider sat next to a
`.ctrl-label` reading "Grid width", but nothing tied them together
programmatically, so the control announced as "slider" with no name. The
label was there for sighted users and invisible to everyone else. That is a
WCAG 4.1.2 failure, and it was the same markup pattern (row → label +
control, no `for`/`aria-labelledby`) repeated in every tool. Every tool
shipped since has been verified at 0 unlabeled controls before shipping —
`Organica.autoLabelPanel` below is why that's a one-line check, not a
per-tool audit.

**Fix once, not 121 times:** `Organica.autoLabelPanel(document)` in
`shared/core.js` walks every row (`.ctrl-row`, `.param-row`,
`.color-row`, `.toggle-row`, …), finds the row's label, and wires it to the
row's control(s) via `aria-labelledby` — generating an id on the label if it
doesn't have one. It's idempotent (controls that already have a name are
left alone) and safe to call more than once, so a tool that builds rows
dynamically (a preset list, an effect stack) can call it again after
populating.

Call it once, after the panel's static rows exist and again after any
dynamic population:

```js
Organica.autoLabelPanel(document);
```

**What it does not catch** — fix these by hand where they occur:
- A control with no adjacent row label at all (a lone `<select>` under a
  section title, e.g. a preset picker) → add `aria-label` directly.
- A button whose only content is an icon or a colour swatch → needs its own
  `aria-label` if it isn't the colour-row pattern (which the function does
  handle — a colour row's swatch button, native `<input type=color>` and hex
  field all take the row's `.color-name` label).
- Content injected via `innerHTML` after the initial call → either re-call
  `autoLabelPanel`, or set `aria-label` directly in the template string.

Verified at the time across all six tools then shipped: **0 of ~210 controls
unnamed**, segmented buttons keep their own visible text as their name (the
function skips a button that already has text — `aria-labelledby` would
replace it, not add to it), zero runtime errors. Every tool shipped since
carries its own equivalent 0-unnamed check in its own session notes.

---

## 7. Rules

1. **One family.** If a design needs a second typeface, that is a system-level
   decision — change it here, not in a tool.
2. **Use the tokens — mandatory for every new development, not just typography.**
   A hardcoded `font-size: 13px`, a raw `padding: 9px 14px`, a bare
   `border-radius: 6px`, or a hex colour standing in for `--ink`/`--mid`/
   `--border-strong` is a bug, the same way a hardcoded font-size is. Use the
   matching `--fs-*` / `--space-*` / `--radius-*` / palette token.
3. **Missing a value on the scale? Stop and ask, don't invent one.** If the
   spacing, radius, or size you need doesn't exist on any current step,
   that's a real gap — but the fix is a conversation, not a silent new value
   or a "just this once" raw px/hex. Confirm before adding a token here.
   Two things that look like exceptions but aren't a licence to skip this:
   a tool's own **content** colour (Halide's ink/paper for the dithered
   image, Pollen's point colour) is user data, not chrome — don't tokenise
   it; and a genuine pill/stadium shape (`border-radius` = half the
   element's height, e.g. a toggle switch) isn't a corner radius — forcing
   it onto `--radius-sm/md/lg` flattens the capsule.
4. **`--font` only** in new code. `--sans` / `--mono` / `--display` are legacy
   aliases kept so old rules render; they all resolve to Manrope.
5. **Load order matters.** `tokens.css` must come *before* the tool's
   own `<style>`, so a tool can override a token without `!important`.
6. **Weights are the four defined stops.** 200, 600 and 800 exist in the font
   but aren't in the system — add them here before using them.
7. **Live reference:** `/design-system/` (linked from the hub) renders every
   token and shared component from the real CSS — not a screenshot. Check
   there before assuming something doesn't exist yet. It now also
   **checks itself** on load: token tables are generated from the CSSOM,
   any `:root` token it fails to document is listed, and a set of component
   contracts is asserted against the live demos. A red banner there means the
   documentation and the stylesheets have drifted apart.
8. **The rules are enforceable, not just written.** `docs/CSS-RULES.md` sets
   them out with the bug each one came from; `scripts/css-lint.py` checks
   them. Run it before committing anything under `shared/`:
   ```bash
   python3 scripts/css-lint.py
   ```
9. **Retired September 6, 2026:** `--sans`, `--mono`, `--display` (the
   typeface aliases — `--font` is the only name now), plus `--fs-display`,
   `--lh-tight` and `--ls-tight`, which had no consumers. New since:
   `--accent-hover`, the fill under an ink-filled button, previously a raw
   `#333` written twice for the same role.

---

*Studio Rann · Organica System v0.1 · August 26, 2026 · rules + lint added September 6, 2026*


---

## Typography rules — numerics, emphasis, measure, accessibility

Typefaces (Sep 29, 2026) — **two families, split by role**:

- **`--font-display` — Space Grotesk**: display, H1–H5, buttons and controls (`button`, `select`, `input`,
  `textarea`, seg/mini/org buttons, header logo, mega menu) and numbers (`.org-num`, every tabular readout), and panel labels, sub-labels, section titles and checkbox labels (the mono is ~20% wider and would not fit the panel).
  No italic, no slashed zero, proportional figures by default.
- **`--font-mono` — IBM Plex Mono**: H6 overline, body lg/md/sm, caption, panel hints/notes, code —
  everything else. Real 400/500/600/700 and a real 400 italic.
- **`--font`** is the inherited default and points at the mono; controls and headings re-point it. Fallbacks:
  Wix Madefor Display → Manrope.

- **Numeric role** — `--t-num-font` (display face) + `--t-num-variant` (tabular-nums) + `--t-num-ls`; apply with `.org-num` to every
  live readout, value, hex field and counter so digits don't jitter.
- **Header roles** — `--t-header-logo-size|weight`, `--t-header-action-size|weight`.
- **Measure** — `--measure` (66ch); `.org-prose` caps running text at it (WCAG 1.4.8 ≤ 80 chars).
- **Reading pages** default to 14px / 1.7 (`body/lg`); `.org-prose--compact` = 12px.
- **Emphasis**: `strong` 600; `em` is the mono's real italic in body text, upright in display text; `font-synthesis: none` on `html`.
- **No Light weight**; 9px is the floor and only for panel labels; running text is never below 11px.
- **Wrapping** — headings `text-wrap: balance`, body `pretty`. **Truncation** — `.org-truncate` (+ a `title`).
- **Uppercase** implies `--ls-wider` or wider, never below `--fs-small`, never for a sentence.
- **Contrast (WCAG 1.4.3, text under 24px needs 4.5:1)** — `--ink` 19.8:1, `--accent` 14.4:1,
  `--mid` 6.0:1 on white (5.0:1 on `--panel`) pass. **`--accent-warm` is a non-text accent** (bars,
  borders, fills, progress): as text it is 4.6:1 on white, 3.8:1 on `--panel`, 2.7:1 on a dark
  overlay. Text that must stand out uses `--ink` (or `--paper` on dark), with the accent beside it.
- Never convey meaning by colour alone (WCAG 1.4.1).
