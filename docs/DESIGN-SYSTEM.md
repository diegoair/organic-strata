# Organica — Design System

> Studio Rann · Organica · Typography, tokens, and the Figma mapping
> Last updated: October 9, 2026 (the capped card — `.nc-node--capped`, a non-pill node type with `meta.icon`: the pill's round cap + the name on the card's own paper; FVS Figure / Variation, Figure in Content in the node bar — §5g, `/design-system/#node-canvas`); October 9, 2026 (node-bar items are tiles, not pills — `body.tile(meta, label)`, `.nc-nodebar__item--tile`, `.nc-tile__icon` / `__label`, `meta.barIcon`; `body.pill` / `pillAttrs` / `.nc-pill__cap` removed; node-bar hint line removed — §5g, `/design-system/#node-canvas`); October 8, 2026 (every node but the Figure is a pill — Foundation, Content, Rules, Output; body helpers `thumb` / `stack` / `pill` / `pillAttrs`; one-fact line rule; dead nodes `.is-isolated`; node-bar pill items; `[data-ink]` mapping attribute-only; no hover motion on the board; floatbars opaque with a cached shadow; 98 icons — §5g, Icons, `/design-system/#node-canvas` · `#node-bodies`); October 8, 2026 (node pill for the Foundation nodes: `meta.pill` / `meta.icon`, `.nc-node--pill`, icons `node-canvas` / `palette` — §5g, `/design-system/#node-canvas`; node bodies, Foundation group: `Organica.nodeCanvas.body` + `.nc-body*` — §5g, `/design-system/#node-bodies`; `Organica.loomGridThumb` also takes a resolved grid); October 8, 2026 (Principles added at the top; node card = tinted head in the card’s ink + gesture motion — §5g); October 8, 2026 (node card: ports and body in one row, port labels outside the card — §5g; the seven `--port-*` named in full; FVS child Figures use no new token or shared class); October 8, 2026 (`Organica.selectPicker` `opts.signal`; node board `wireLabel` → `.nc-wire__label`, ports in the tab order with `onPortDblClick`, connect reasons without a stop — `/design-system/#node-canvas`, SHARED-COMPONENTS §2d); October 7, 2026 (Rhizome on the node board — the second consumer; `Organica.nodeCanvas.nodeBar` / `search` / `portFor` + `.nc-nodebar__*` / `.nc-search*` promoted from FVS, shown in `/design-system/#node-canvas`; API in `docs/SHARED-COMPONENTS.md` §2d); October 7, 2026 (the node board `Organica.nodeCanvas` + `shared/node-canvas.css`, `/design-system/#node-canvas`; the seven `--port-*` tokens; the left dock `.org-dock`, `#dock`; 12 node-graph icons, 87 drawings — all on branch `figure-graph`, see §5g); October 7, 2026 (the FVS rule atlas, `/design-system/_fvs-rules.html`, linked from `#fvs-rules`); October 6, 2026 (FVS Library view: `library` icon, 75 drawings, `.icon-btn.is-armed`; FVS Cell shape: six `fvs-*` icons; `.seg-btn[aria-disabled="true"]` = a gated option that keeps its reason; earlier: Oct 3 RMX chips draw `close` / `plus`, `swap`, `pattern`)
> (§5f, templates, added; the "Page on a field" variant and the FVS field added to it the same day. §1 and §3 — one typeface — and the §5 accent
> table are **known stale**: the two-typeface rule is in the appendix at the end, and the rewrite is
> queued in `docs/DESIGN-DECISIONS.md` §4; it waits on O-2 / O-3.)
>
> **Single source of truth: `shared/tokens.json`.**
> `shared/tokens.css` mirrors it for the browser; this document
> explains it; Figma variables and text styles are named to match. A value
> changes **here first**, then in the CSS, then in Figma. Anything that
> disagrees with the JSON is a bug, not a variant.

---

## Principles (Diego, Oct 8, 2026 — suite-wide)

Organica is **playful, colourful, animated, interactive, easy to use and enjoyable**. Applied as:

- **Colour carries meaning** — a colour says what something is (a port type, a node's ink, the tool's accent), never decoration alone and never the only cue (a label or a shape says it too).
- **Motion answers a gesture** — hover, pick up, add, connect get a short reply on the `--dur-*` / `--ease-*` tokens; nothing moves on its own, nothing moves during pan / zoom.
- **Performance beats ornament** — no blurred shadows (only the floatbar keeps one); animate `transform` / `opacity` or the individual `translate` / `rotate` / `scale`, never layout.
- **Easy for everyone** — both themes always (§5b); reduced motion turns the motion off; one concept, one word (`docs/UI-COPY.md`).

Live: `/design-system/#principles`.

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
| `--lh-none` | 1 | single-line specimens (the display role, `--t-display-lh`, is `--lh-tight` since Oct 8, 2026 — the hub manifesto runs over lines) |
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
| `--control-bg` | `color-mix(in srgb, var(--ink) 5%, var(--paper))` | **The control surface** (Oct 1, 2026). A role token, not a grey step: the ground of an editable control — fields (`.org-field` and aliases), selects, thumbnail pickers and their menus, the slider well, the switch/checkbox off track, the sign-in card's inputs. Lighter than `--panel`, so a control reads as a recess-free light chip on the panel; derived, so it follows each tool's ink/paper and both themes. |
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

**Content colour has one source since Oct 1, 2026: TuneSutra.** The colours a
tool draws *with* (inks, papers, RMX strips) are user data, not chrome, and stay
out of the tokens file — but they are no longer typed per tool. A palette saved
in TuneSutra is available from the *Pick from a palette* button on every colour
control (`Organica.palette.library()`, see `docs/SHARED-COMPONENTS.md` §2 and
`docs/TUNESUTRA.md`). Each tool's own default ink / paper is unchanged for now;
generating the chrome tokens themselves from a palette is planned, not built.

**A colour may carry a texture (Oct 3, 2026).** `Organica.palette.swatch` attach
mode takes an opt-in `opts.pattern = { panel, on, onToggle(on), label, title }`:
a **Pattern** icon button (`pattern`, `org-btn org-btn--sm org-btn--icon`,
`aria-pressed`) at the end of the colour row, which moves the tool's own
`panel` right under the row and toggles its `hidden`; the returned object gains
`setPattern(on)`. The tool draws the pattern itself — the component only owns
the toggle and the placement. Tools that do not pass it are unchanged. One
consumer: FVS's **Paper** (Paper = colour + texture; see `docs/DESIGN-DECISIONS.md` §2).

| Tool | Accent | Reading |
|---|---|---|
| Genesis | `#6a9c2e` | leaf green — organic vitality (was `#c8f060` acid green, darkened for contrast on paper; Creator's own `#5fc9b4` teal retired Aug 27, 2026 — merged into Genesis, see CLAUDE.md) |
| Spore | `#5a7a96` | cool blue-grey (was `#a0c8f0`; shares Halide's steel-blue) |
| Pollen | `#c8a83a` | pollen ochre (was `#e8c84a`) |
| Living Path | `#b48cf0` | vital violet |
| Sinew | `#b8467a` | sinew rose (Living Path's vector half) |
| Apostate | `#9c2b3a` | heretic crimson |
| Halide | `#5a7a96` | darkroom steel-blue (was `#7a9cb8`) |
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
| Radial | `#6b6f8c` | slate blue-grey |
| Pulsar | `#dd5140` | signal red (Radial's motion tool) |
| Rhizome | `#7a9c5e` | root moss-green |
| Trellis | `#c9587a` | rose |
| Murmur | `#d4762a` | murmuration orange (the stipple exports' animator) |
| Blob Boundary | `#8a8a28` | mustard gold |
| Undertow | `#8a4f7d` | plum — the pull beneath a surface (Warping's animator; hue ~315, unclaimed) |
| Dapple | `#d0905a` | sun-through-leaves amber (Komorebi's animator; lighter than Murmur's `#d4762a`) |
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
| Animate an export | Murmur, Undertow, Dapple |

> **Test gallery** (`/gallery/`, Oct 1, 2026) is not a tool and not in this menu: a development log of the animation tests we keep (one tile = one real export + one animator preset + a date and a note). Reachable only from the design system (`#test-gallery`); budget in `gallery/budget.json` (16 tiles, 2 MB samples, 300 KB per sample, 40 KB page), enforced by `scripts/check.py`, which also fails if any other page links to it.
>
> **FVS rule atlas** (`/design-system/_fvs-rules.html`, Oct 7, 2026) is not a tool either: a reference of every generative rule in Flexible Visual System (Element → Palette & Paper → Component → Symbol → Figure — controls, ranges, a rules-by-grid-size table, diagrams from FVS's real output), reached from the design system (nav group **Tool references**; entry `#fvs-rules`). A `_` page like the audits — light only, `noindex`, tokens for every chrome value, fixed content colours in its diagrams (O-29) — but scanned by `check-apostrophes.mjs` and `ds-audit.py` (`SCANNED_DEV_PAGES`, O-28). It opens with **relation diagrams**: per step, three views of one link list — Flow (you set → FVS decides → you get), Matrix, Ring — with lettered variables (A you set · B FVS decides · C you get), links typed Fixed · Can be fixed · Shapes, and a worked example embedded in the Flow — Input → Transformation → Output, each step on the example’s path shown with its value and a picture, the generated result large on the right. It is a capture — re-capture a rule and update the page in the commit that changes the rule.
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
- **Dark values** (on `--paper #121210` / `--panel #1d1d1b`, = `--control-bg` since Oct 8, 2026 — was `#1f1e1a`): `--ink #ededed` 16.0:1 (was the warm `#eceae4`, retired Oct 8, 2026) · `--mid #a39c90` 6.9:1 · `--accent #d9d6cf` · `--border #3a362f` (decorative) · `--border-strong #7d725e` 3.97:1 · `--accent-hover #bdb8ae` · `--danger #e0735f` 6.1:1 · `--canvas-dot #2e4a55` · `--stage-shadow` 0.6 · `--accent-warm #d8642a` (non-text: 5.2:1 on `--paper`, 4.6:1 on `--panel`; light's `#c2551b` was 3.7:1 on the dark `--panel` — own dark value since Oct 8, 2026). The design-system self-check fails if a dark text token drops under 4.5:1 or `--border-strong` under 3:1.
- **Switch** — the header's moon/sun button (`shared/header.js`, `.org-theme`), saved in `localStorage['organica.ui.theme']`, applied before first paint by `shared/pattern-init.js`. The switch is a **circular reveal** from the button (the View Transitions technique of Magic UI's AnimatedThemeToggler, ported to vanilla Oct 1, 2026: `document.startViewTransition` + a `clip-path: circle()` animation on `::view-transition-new(root)`, 200ms; the default cross-fade is off in `header.css`). Instant swap where the API is missing or `prefers-reduced-motion` is set. No OS following (Diego's call).
- **Opt-in per page** — `<html data-theme-support>`. Opted in (Oct 1, 2026): every production page — the hub, design system, Genesis and all tools, Rhizome, sign-in, privacy, terms, admin. Only the `explorations/*` and `design-system/_*` dev pages stay light. Work surfaces without `.org-stage` (Mycel/TuneSutra stage, Trellis/Pulsar canvas, Apostate board, Genesis artboard, Rhizome node previews) carry `data-theme="light"`.
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
- **Every thumbnail is a square** — 22px in the trigger, 40px in the menu (Oct 1, 2026; was 26px icons and 3:2 60×40 / 33×22 previews). Aspect icons (`Organica.aspectIcon`) and grids (`Organica.loomGridThumb` — a Loom export or, since Oct 8, 2026, an already-resolved grid; also the node bodies' picture, §5g) keep their true ratio, letterboxed inside the square; rendered previews are drawn square or cropped with `Organica.squareThumb(canvas)`.
- **icon** (default) is a `currentColor` pictogram for structure (shape kinds, aspect ratios, motion diagrams). It follows `--ink`.
- **preview** (`size:'preview'`) is a rendered image for look and texture (dither, stipple, grain, light, palettes). It is content, so it stays light in dark mode.
- **`opts.signal`** (an `AbortSignal`, Oct 8, 2026 — `244fed3`): a picker mounted on markup that is rebuilt (FVS's Figure panel re-renders its Canvas node on every change) passes one and aborts it before the next mount; the picker's four page listeners (click outside, `organica:dropdown-open`, resize, scroll) go with it. Without it, nothing changes.

Thumbnails are lazy (`thumb:` renders when the menu first opens, one per frame, cached; `invalidate(key)` after a re-save). Image-effect tools all render on the same subject, `Organica.previewImage`. Placeholder options (empty value) are never rows; with nothing to pick, the menu shows the tool's disabled hint option. The Sep 30, 2026 audit applied it to Radial, Pulsar, Warping, Halide, Pollen, Colornet, Komorebi, Mote (moved off its own custom list), TuneSutra, Loom, Flexible Visual System, Trellis, Membrane and Vortex, then Flexible Visual System's built-in recipes (a synthetic entry through the saved-Component renderer), Mycel's saved networks and Blob Boundary's saved presets. Rhizome graphs and the Genesis arc type don't qualify. Audit: `/design-system/_control-audit.html?kind=fields` (347 fields, 24 looks → 317 in one look; the rest documented exceptions).

## 5e. Working with AI — governance (Sep 30, 2026)

The design system is maintained with an AI coding agent as a collaborator; it never holds a decision. **Loop:** audit (the agent measures what every tool really renders — `/design-system/_control-audit.html`, `_dark-audit.html`) → propose (one consolidated component/token set, often with a mock) → **decide (owner)** → build & migrate (tokens only, old classes kept as aliases) → verify (css-lint, the Flexible Visual System regression, the design-system self-check, light + dark in a browser) → document (this file, the live reference, a session note). **Two owner gates:** what gets built, and what ships ("commit in prod"). **Decision rights:** new/changed token, new shared component, exceptions → the owner decides; one-off styles in a tool → not allowed (css-lint, audits); anything new → must work in both themes; release → owner, explicit go. **Rules** live in `CLAUDE.md`, read by the agent at every session start, so every teammate works with the same collaborator and standards. Live version with the governance flow: the design system's "Working with AI" entry; shareable page: https://claude.ai/artifact/2YDV3hau2WR9dZVejTieoh

**The design-system agent (Oct 2, 2026).** The loop above has a dedicated steward: the `design-system` subagent (`.claude/agents/design-system.md`, command `/ds`). It works in four modes — **CONSULT** before anything is built (a build brief: what exists, what to reuse, the gaps that are the owner's to decide), **REVIEW** before a commit that touches UI (verdict PASS / PASS WITH NOTES / BLOCK), **AUDIT** (the state of the system, in numbers), **DOCUMENT** after a decision or a shipped change. It never decides and never edits tool or shared code; it edits documentation only. Its instrument is `scripts/ds-audit.py` (registry drift between `tokens.css`, `tokens.json`, this file and the live reference; a map of raw values per page; `--diff` fails when a change *adds* a raw value where a token exists). Its ledger is `docs/DESIGN-DECISIONS.md`: open questions, decisions, standing exceptions, audit log.

## 5f. Page templates (Oct 2, 2026)

Every production page is one of **three templates** (decision O-6, `docs/DESIGN-DECISIONS.md` §2):

| Template | For | Skeleton sheet | Start from |
|---|---|---|---|
| **Tool** | a canvas and controls: header · floatbar · `#app` (surface + `#panel` on the right) | `shared/shell.css` | `shared/_template.html` |
| **Page** | anything that reads or lists: header + one scrolling column | `shared/page.css` | `privacy/` (reading) · `admin/` (data) |
| **Auth card** | the sign-in card, alone on the page — no header, no footer; since Oct 2, 2026 on an FVS field | `shared/auth-card.css` | `/sign-in/` |

- **Variants, not a fourth template.** *Own surface* — tool chrome without `shell.css` (Apostate, Flexible Visual System, Rhizome, Genesis). *Own layout* — page chrome without the `page.css` column (the hub, the design-system reference). Each is an entry with its reason in `OWN_SURFACE` / `OWN_LAYOUT` in `scripts/templates.py` and a line in `docs/DESIGN-DECISIONS.md` §3.
- **`shared/page.css`** (O-7) — `body.org-page` (the canvas ground — `var(--canvas-grid), var(--canvas-bg)`, like the hub; never `--panel`; `org-page--paper` for flat paper), `.org-page__col` (660, reading) · `--wide` (1040, data) · `--full` (1500, gallery). The widths are the component's own `--page-col-w`, like `--panel-w` and `--auth-card-w` — not steps on a global scale. A page never links `shell.css` (it pins `<body>` to the viewport).
- **The card and the footer** — `.org-page__card` (a paper sheet for a page that is one block of text) and `.org-page__foot` (the one footer: “© Organica” + Privacy · Terms · Design System, current link `aria-current="page"`; privacy, terms, the 404, the hub). Tools have no footer. **The error page** is `/404.html`: this template, public, card + footer.
- **A Page on a field** — `body.org-page.org-page--field` + `shared/fvs-field.css` / `shared/fvs-field.js` (`Organica.fvsField.mount(host, opts)` → `{ stop() }`, `.palettes()`, `.MOTIONS`): the Page template standing on a decorative full-screen Flexible Visual System field instead of the dot pattern. A shared component by decision (Oct 2, 2026); its consumers are `/404.html` and `/sign-in/`. **Standalone**: the script needs no other (`ELEMENTS` — the Elements' paths — and `BUILTIN` — the three built-in combinations, resolved — are baked in and kept honest by `node scripts/test-fvs-field.mjs`, run by `scripts/check.py`); the 404 loads it alone, 38 KB of script on the page instead of ~250 KB. `color.js` + `palette.js` (after `core.js`) are needed only to read the live library; `.resolve(entry)` is public. Classes: `.org-fvs-field` (fixed, `inset: 0`, `z-index: -1`, no pointer, `aria-hidden`), `.org-fvs-field__band` (the box the "404" numerals fill; height = the component's own `--fvs-field-band-h`, 42vh), `.org-fvs-field__svg` / `__cell` (written by the script).
  - **Two motions**, both FVS's own: *arrival* (Arc truchet under Checkerboard; cells form blur → contrast → sharp in a scattered order, then one cell at a time takes a quarter turn and re-forms; the numerals are the cells that never finish arriving) and *rules* (Arc; every cell turns in quarter turns as the grid moves Radial → Checkerboard → Pinwheel → Identity; the numerals are the cells that never obey, in the strongest ink). The 404 shows both, alternating per visit, with the next of the three built-in palettes each time (`localStorage['organica.404.visit']`; `?p=a|b` and `?pal=<n>` pin them).
  - **Colour — a palette is content**, fixed in both themes (`palettes()` = the three built-in combinations; with `color.js` + `palette.js` loaded, the live library — TuneSutra's saved palettes + the built-ins, 2–7 colours). Ground = the palette colour that leaves the others the most contrast; the pattern's inks move along their own shade scale (`Organica.color.stepFor`) to ≥ 1.8:1 on the ground; the numerals' ink in the rules motion to ≥ 3:1. Without a palette the cells are `currentColor` (`--border`) and follow the theme.
  - **Header and footer on a field** — both stay, as two bars that frame the pattern on clear ground (`opts.above` / `opts.below`: no cell above the header's bottom or below the footer's top). The **footer is a direct child of `<body>`**, after `</main>`, not inside the column: `height: var(--header-h)`, `padding: 0 var(--space-7)` — the header's counterpart (inside the 660 column it did not line up with the full-width header). The **header carries no pattern switcher and no theme button** (`.org-pattern`, `.org-theme` hidden): the field covers the ground, the palette does not flip; the saved theme still applies to the card and the mega menu. Each bar takes an element-scoped `data-theme` from the palette's ground and `--ink` instead of `--mid` for the logo label and footer text (`--mid` falls to 2.8:1 on a saturated ground); the mega menu, a child of the header, is given the page's theme back.
  - **Reduced motion** = the settled picture, nothing moves. The field pauses while the tab is hidden and rebuilds on resize.
  - **Words and Elements** (Oct 2, later): `opts.text` spells any words in a 3 × 5 cell alphabet (`Organica.fvsField.textMask`); `opts.elements = { cell, mark }` picks the Element of the pattern and of the words (`truchet` · `arc` · `triangle` · `circle` — four baked paths, test-enforced); `opts.hold: false` lets the words' cells arrive and obey like every other; `Organica.fvsField.visit(key)` is the per-browser visit counter. Past 800 cells only a share forms through the filter, the rest fade in (`.org-fvs-field__own`).
  - **The sign-in stands on the same field** (O-13, decided Oct 2, 2026): circles spell WELCOME TO ORGANICA among triangles in the band above the card, `hold: false`, each visit the other motion and the next built-in palette (`localStorage['organica.signin.visit']`). Still the Auth card template: no header, no footer; `fvs-field.css` after `auth-card.css`, `fvs-field.js` right after `core.js` (core's last line reassigns the namespace). `explorations/page-motion/signin.html` is a dev preview of the real page, without Supabase.
- **The shared sheets, in load-bearing order:** `tokens → icons → header → page → prose → auth-card → fvs-field → panel → floatbar → shell → node-canvas → palette → seeds-panel → mobile-gate`. Which of them a page links follows from its template; what each owns is on `/design-system/#file-architecture`.
- **Documented** on `/design-system/` → Templates (`#templates`, `#template-tool`, `#template-page`, `#fvs-field`, `#sign-in`), rendered from `design-system/templates.json`. The page list — and the "Used in" lists of `#shell` and `#panel-shell` — is generated by `python3 scripts/templates.py`, never typed. The contract in prose: `docs/UI-SHELL.md` §1, §2, §6.
- **Enforced** by `python3 scripts/templates.py --check`, run by `scripts/check.py` ("page templates", blocking — O-10): sheet order, `data-theme-support`, `pattern-init.js` in `<head>`, the three tail scripts, the header; for a tool also the mobile gate first in `<body>`, the floatbar as a body child, `#panel` last in `#app`, no Export in the header; for a page `body.org-page` and a column. It lints `shared/_template.html` with the Tool rules and fails when the committed JSON differs from the pages.
- **A new tool or page** regenerates the inventory (`python3 scripts/templates.py`) in the same change, and a new tool's `--tool` goes in §5.
- **A tool's own CSS** lives in its inline `<style>` or in its own sheet `<tool>/<tool>.css`, linked in the same place (O-27, Oct 6, 2026; first: `fvs/fvs.css`). Its `--tool` may be declared in either — `ds-audit.py` and TuneSutra's System view read both.

## 5g. The node board and the left dock (Oct 2026)

The FVS Figure graph (branch `figure-graph`, `docs/FVS.md` §12) brought two shared pieces; Rhizome moved onto the first on Oct 7, 2026 (branch `rhizome-node-canvas`), and the node bar + node search helpers (`nodeBar` / `search` / `portFor`, `.nc-nodebar__*` / `.nc-search*`) were promoted from FVS with it — `docs/SHARED-COMPONENTS.md` §2d.

- **`--port-*` — seven port-type colours, the *node palette*** (Diego, Oct 8, 2026 — used only by the node board; replaced the Riso inks of ledger O-34): `--port-canvas` · `--port-grid` · `--port-palette` · `--port-content` · `--port-rule` · `--port-composition` · `--port-figure` — one per port type: the filled port dot, the wire, and the card's **solid head** (`data-ink`). Source: the cover of *Essential Color Combinations That Just Work* (Em Sans), sampled pixel-exact and used **as is** (Diego: "the colours are not the ones I gave" — the first pass had stepped them to 3:1): canvas black `#131313` (dark theme: the cover's cream `#f1e1c8`, black being invisible there) · grid blue `#037cc1` · palette pink `#fb4673` · content green `#018e64` · rule yellow `#fac400` · composition red `#f73710` · figure orange `#fb8700`. **Standing exception (ledger §3):** yellow (1.6:1), orange (2.5:1) are under the 3:1 non-text floor on white — the port also carries its label and shape, and the dot is filled with a darker edge. Head text: white on black and blue, black on the rest (cream in dark too); the head carries `data-theme="light"` so `--paper` / `--ink` there are fixed white / black. Name on its ink ≥ 4.5:1 except the green, 4.47:1. Mirrored in `shared/tokens.json` → `color.port`. They are chrome colours (they say what kind of data flows), not content.
- **The node board look** (`shared/node-canvas.css`, ledger G3): a card on `--paper`, edge `--border-strong` (≥ 3:1 in both themes — Rhizome’s 1.66:1 edge retired), `--radius-md`; **a solid head** (Diego, Oct 8, 2026 — "C · solid", replacing the same day's 14 % tint): the head is `--node-ink`, its text fixed white (black, blue inks) or black (the rest) via `data-theme="light"` on the head; the node type as a mono overline over the node’s own name in the display face; `--node-ink` = the `--port-*` of the card’s first output (Export: its first input), set as `data-ink` on the card by `mount()`, fallback `--border-strong` — head text ≥ 4.5:1 on six inks, 4.47:1 on the green (self-check floor 4.4:1); port dots **filled** with their ink, edge 65 % ink + `--ink`; **ports and body in one shared row** (Oct 8, 2026 — the card is a grid: head · ports + body · status, the dots on the card’s edges over the body, so a many-input card has no empty band; self-checked on `/design-system/#node-canvas`); port labels **outside the card, raised above the wire** (Oct 8, 2026); **no shadow**, at rest or lifted (Oct 8, 2026 — a blur repainted every drag / zoom frame; only the floatbar keeps a shadow); selected = 2px `--ink` ring, the same for many (dashed means *pending* — the wire being drawn, the marquee); keyboard focus = the shared focus ring; error = `--danger` edge + message; stale = body at half opacity. Wires take their source port’s colour, `--wire-w` 1.5px at every zoom (non-scaling), 1px wider on hover and selected (selected = `--ink`); foundation wires (from Canvas, Grid, Palette) are drawn faint (35%) until their node is selected or hovered. Ports: a 10px dot (`--port-d`) with a `--hit-min` hit area at any zoom + its label. Below 50% zoom a card becomes a chip: ports, port labels, the type overline and status lines hide, the name stays at one size on screen (`.nc-stage--far`). **Motion on gestures only** (Diego, Oct 8, 2026): no hover motion (the hover lift, icon turn, picture grow and chip hop were removed the same day — "annoying"), a lifted card tilts (`scale: 1.02`, `rotate: -1deg`, no shadow), a card added after the first render and the card a wire lands on pop (`.is-pop`, scale 1.04), the receiving dot pops to 1.6, a dot grows to 1.3 on hover and when `.is-compatible`; individual `translate` / `rotate` / `scale` so they compose with the position transform; `--dur-fast` / `--dur-base` / `--dur-slow`, `--ease-standard` / `--ease-overshoot(-soft)`; all off under reduced motion. Behaviour, keys and options: `docs/SHARED-COMPONENTS.md` §2d; live, both themes: `/design-system/#node-canvas`.
- **The pill** (Diego, Oct 8, 2026 — ledger §2 *Node pill*, *Node pill icons + Content pills…*, *Rules and Export are pills*): every node but the Figure and its variations (their fact is the drawn result). A registry type whose `meta` has `pill: true` is drawn by `mount()` as `.nc-node--pill` — the solid head is a round cap holding the type's icon (`meta.icon` → `.nc-node__icon`, `aria-hidden`, the library's own `.ico`: `--icon-lg`, `--icon-stroke`) and beside it **one fact** of what it holds (the body). Icons: Foundation `node-canvas` · `fvs-grid` (never `grid`, the Library rail's) · `palette`; Content `node-element` · `node-component` · `node-set`; Rules `node-cell-rules` · `node-component-rule` · `node-repeat` · `node-composition` · `node-transform`; Output `download` (Export). **The icon is always light** (`--paper` inside the light-scoped head = white; 1.6:1 on yellow, 2.5:1 on orange — ledger §3 node-palette exception) **except on the canvas ink in dark** (the cover's cream, 1.3:1 for white): there it is black, unless inside a light island. The overline and the name stay in the DOM, visually hidden (`clip-path: inset(50%)`) — the accessible name — and the name lives in the panel. Height `--pill-h` (component-local: 1.5 × `--space-8` + 2 × `--space-2`), radius `--pill-h / 2` + 1px (the edge): a real stadium, the pill exception of the radius rule. **One fact per pill:** a body with a picture (`.nc-body__pic`, `__thumb`, `__stack`, `__swatches`) hides its `.nc-body__line`; a body that is only words (Rules, Export) shows the line in the display face and `--ink`. Keeps its body in the chip view; no hover motion. **Dead node:** a node wired to nothing gets `.is-isolated` from `mount()` on every wire redraw — opacity 0.45, `grayscale(1)`, dashed edge (0.8 when selected). Self-checked on `/design-system/#node-canvas` and `#node-bodies`, both themes: radius = half the height, title hidden but present, icon drawn and white (black on the dark canvas ink), line shown / hidden by the rule, the dead node greyed.
- **The capped card** (Diego, Oct 9, 2026 — ledger §2 *capped card*: the Figure "in line with the others"): a node type with `meta.icon` and no `pill` is drawn by `mount()` as `.nc-node--capped` — a full card whose head is the pill's round cap (`.nc-node__icon`: a `--space-8` circle on `--node-ink`, the white icon — 2.5:1 on the Figure's orange, ledger §3 node-palette exception) + the node's name on one row, on the card's own paper: no solid band, a 1px `--border` line under it (resolved in the card's own theme — the head is light-scoped). The overline is visually hidden (the accessible name), as on a pill. FVS: Figure and Variation (`fvs-figure`); the Figure body = the drawing + one meta line (*‹n› cells · ‹k› variations*), Canvas · Grid · Palette in the panel. A card without an icon (Rhizome) keeps the solid head. Specimen + self-check: `/design-system/#node-canvas` (the three Figure cards).
- **Node bodies** (Diego, Oct 8, 2026 — shared, built group by group): `Organica.nodeCanvas.body.line / picture / thumb / stack / swatches` → `.nc-body__line` (caption size, `--mid`), `.nc-body__pic` (48px = 1.5 × `--space-8`, drawn in `currentColor` = the card's `--node-ink`), `.nc-body__thumb` (48px, a saved piece of work in its own colours on `--paper`, `--border` edge, `--radius-md`, `data-theme="light"` — a work surface, light in both themes), `.nc-body__stack` (the first three thumbs fanned −4° / 0° / +4°, each a third over the last), `.nc-body__swatch` (`--space-5`, `--radius-sm`, `--border` edge; the paper chip `.is-paper` `--border-strong`; `.is-clear` = a checker for transparent paper). FVS: Canvas = `Organica.aspectIcon` (dashed = the Figure's own size); Grid = `Organica.loomGridThumb` of the real grid; Palette = paper + inks; Element / Component = `thumb`; Set = `stack`; Cell rules *‹n› rules*, Component rule *‹rule›*, Repeat in grid *‹Lattice› · ‹n› per side*, Composition *‹n› region rules*, Rotate & mirror *Rotation ‹a›° + mirror*, Export *‹n› files* = `line`. Plus `tile(meta, label)` for node-bar items (below). Thumbs and swatches are content, the same in both themes. No hover motion. API: `docs/SHARED-COMPONENTS.md` §2d; live, both themes, self-checked: `/design-system/#node-bodies`.
- **Node-bar items as tiles** (Diego, Oct 9, 2026, after Weavy's node menu — ledger §2; replaced the Oct 8 pills): a node type with `meta.icon` — or `meta.barIcon`, an icon for the bar tile only (FVS no longer uses it — since Oct 9, 2026 the Figure's `meta.icon` serves the tile and the card's cap) — is offered as `.nc-nodebar__item--tile` + `body.tile(meta, label)`: the icon (`.nc-tile__icon`, `--icon-lg`, monochrome `--ink` — no node ink, no cap) over the name (`.nc-tile__label`, display face), on `--paper` with a `--border` edge, `--radius-lg`, min-height 2 × `--space-8`, two per row (a `.nc-nodebar__list` holding tiles becomes a 2-column grid; an icon-less item in it is centred as a tile); the drag ghost copies the class. The colour lives on the board, not in the bar. Items without an icon in a plain list (Rhizome) stay plain `.nc-nodebar__item` buttons. No hint line under the category (drag or click is the gesture); FVS keeps only its Compose hint. The `--port-*` ink mapping stays **attribute-only**: `[data-ink="x"] { --node-ink }` on any element; the dark canvas-ink black-icon exception covers `.nc-node__icon` only. Specimen (two real left docks, both themes, self-checked): `/design-system/#node-canvas`.
- **The left dock** (`.org-dock`, `shared/floatbar.css`, ledger O-30 / O-31): an optional left slot of the Tool template for what you add to the canvas — a vertical floatbar of toggles (`.org-dock__bar`) and one sibling panel (`.org-dock__panel`; opaque like every `.org-floatbar` since Oct 8, 2026 — `--paper`, `--panel` in dark, its soft shadow cached on its own compositor layer by `will-change: transform`, no `backdrop-filter`), one occupant per tool step (FVS: the Library rail; the node bar on the Figure graph). Contract: `docs/UI-SHELL.md` “Left dock”; reference `/design-system/#dock`.
- **`createZoomPan` for a board** (`core.js`): `infinite` (no snap back to 0,0 at minimum zoom), `dblclickReset: false` (double-click belongs to the board), `setView()` (Fit all / Fit selection, restoring a view). Opt-in; every image tool unchanged.

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

## Icons, motion tokens and behaviours (Oct 2, 2026)

- **Icons** — `shared/icons.js` (registry, `Organica.icons`) + `shared/icons.css` (`.ico`). 16×16 grid, `currentColor`, stroke `--icon-stroke` (1.3) in screen px, sizes `--icon-xs/sm/md/lg/xl`. Never paste an inline chrome `<svg>`; `scripts/check.py` enforces it. 98 drawings (Oct 8, 2026: the node pills — `node-canvas` (a page), `palette` (a row of colour chips: the Palette node and "Pick from a palette", which no longer borrows `grid`), `node-element` (one tile with its mark — E1, Oct 9, 2026), `node-component` (the same tile repeated 2 × 2 — C3), `node-set` (cards stacked in order), `node-cell-rules`, `node-component-rule`, `node-repeat` (one tile repeated across and down — not `grid`), `node-composition`, `node-transform`; Export's pill uses `download`, the Grid pill `fvs-grid`, never `grid` — that one keeps the Library rail toggle; tool families `fvs-*`, `phrase-*`, `role-*` sit in the same file). Live catalogue: `/design-system/#icons`.
- **No typed glyphs as icons** (applied Oct 3, 2026): the RMX chip strip (`shared/palette.js`) draws `close` (xs) on `.rmx-x` and `plus` (sm) on `.rmx-add` — `palette.css` no longer sizes text there, it flex-centres the icon (measured 0px off-centre); a page must load `shared/icons.js` before `palette.js` or the two buttons are empty (they keep their `aria-label`). FVS: library remove × → `close`, figure card × → `close` and ⇄ → `swap`, rule chip ○● → `eye` / `eye-off` with `aria-pressed`, ↑↓ → `arrow-up` / `arrow-down`. FVS's quick-save circle (Component gallery, Element views, Element frame) is one 20px builder with `plus` / `check` / `close` at sm and a `--hit-min` `::before` hit area. Provisional choices behind this are open in `docs/DESIGN-DECISIONS.md` §1 (O-14 … O-18).
- **Layer card reorder** — `.org-layer-card--flush.is-draggable` with `.is-dragging` / `.drop-before` / `.drop-after`. Two implementations behind the same classes: FVS a pointer drag (since Oct 3, 2026), Living Path native HTML5 drag-and-drop. No shared reorder helper yet (maintenance queue, `docs/DESIGN-DECISIONS.md` §4).
- **Motion** — `--dur-instant/fast/base/slow/settle/reveal/stagger` and `--ease-standard/out/glide/overshoot-soft/overshoot/in-out` in `tokens.css` / `tokens.json`; durations collapse to 1ms under `prefers-reduced-motion`. Catalogue and demos: `#motion`.
- **States and behaviours** — selected = ARIA, one focus ring, armed two-click (`[data-armed]`), hold to confirm (`[data-hold]`, Oct 5, 2026: `Organica.HOLD_MS` = 1000 is an interaction threshold, not a `--dur-*` token, so it never collapses under reduced motion; the ring fill is linear, the run-back `--dur-fast`), keyboard table, floatbar order: `#states`, `#behaviours`.
- The full audit that produced these: `docs/audit-2026-10/`.
- **Segmented control, gated option** (Oct 6, 2026) — `.seg-btn[aria-disabled="true"]` looks like `.seg-btn:disabled` (opacity .42, `not-allowed`, no hover wash) but stays focusable; its `title` + `aria-description` give the reason ("Square needs circle or hexagon cells"), the handler ignores the click. `disabled` only when there is nothing to explain. `/design-system/#seg-ctrl`; ledger §2.
- **Hover and pressed** — three tiers, one wash (`--track-bg`), border hover `--ink`, `:active` one grey step, every hover rule behind `@media (hover: hover)` and `:where(:not(:disabled))`. See `/design-system/#hover` and `docs/audit-2026-10/HOVER.md`.
- **Shared behaviours (core.js, self-running):** `Organica.a11y` (ARIA mirrors of class state, keyboard on `[role=button]`), `Organica.modal` (focus management), one-dropdown-at-a-time, `Organica.armed`.
