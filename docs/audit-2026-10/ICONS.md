# Organica icon audit (read-only, 2 Oct 2026)

Method: a node script extracted every `<svg>…</svg>` block (<1.4 KB) from all tracked `*.html/*.js` (excluding vendor, archive, explorations, samples, `.claude/worktrees`, home `index.html`), normalised the inner markup and clustered by identical path data; a second script paired each icon with its enclosing button's `aria-label`/`title`. Scratch data: `scratchpad/svgs.json` (320 blocks, 54 files), `icons16.txt` (clusters), `labels.txt` (icon -> label -> file:line, 132 icon-bearing buttons).

Note: `*.html` totals for lines below are approximate (pre-commit `acb3fef` tree).

## 0. Headline findings

* **There is no icon system.** No `shared/icons.js`, no sprite, no `Organica.icon()`; the design system (`/design-system/`) has **no Icons section** (sections: Buttons, Floating toolbar, Notice… but nothing lists glyphs; the only icon examples are 3 inline 26-grid seed pictograms at DS:1775 and one plus at DS:1194). Every icon is hand-pasted inline SVG.
* ~181 UI-chrome icon SVGs on a 16 / 10 / 8x5 / 16x12 / 14 grid (the rest of the 320 blocks are export serialisers, seed shapes, pictograms, hero art). Only **~65 distinct drawings** after clustering, e.g. the Export arrow is copy-pasted **23x** byte-identically, the 8x5 chevron **29x**, Play 5x+, Loop 5x.
* **Stroke weight**: de-facto standard is **1.3** (185 of ~230 stroke-width attrs, ~80%) but 1.2 / 1.4 (29) / 1.5 / 1.6 (7) all occur, so the same "plus" is 1.4, 1.5 or 1.6 depending on the tool. Brief asks for 1.5; changing means touching every copy, hence the argument for a single source driven by a CSS var.
* **Caps/joins**: round everywhere except a few (Stop/Play/grip are fills; Loom margin corners and Genesis-style pictograms are stroke-only with CSS-supplied stroke). Round is effectively standard.
* **Colour**: every chrome icon uses `currentColor` (good). Only exceptions: Google "G" logo (4 multi-colour paths, legit brand), `pollen/index.html:617` (stroke `#0a0a0a`, a content thumbnail), `pollen/index.html:763` (`shapeSVG().replace(/currentColor/g,'#0a0a0a')` for a swatch slot), `fvs/index.html:5170` uses `var(--ink)` (fine). No dark-mode violations among chrome icons.
* **Where stroke/fill live differs**: most icons carry `fill="none"` on the svg and `stroke="currentColor" stroke-width="1.3" …` on each path (verbose, ~230 repetitions); `shared/header.js` sun/moon, Loom `margin-corner-icon`, Genesis/Loom/Pulsar 26-grid pictograms and the DS plus put them on the svg or CSS instead. A single `.ico{fill:none;stroke:currentColor;stroke-width:var(--icon-stroke);stroke-linecap:round;stroke-linejoin:round}` rule would remove all path-level attrs.
* **Size ladder (no token)**: 7px (`.chev` in floatbar), 8x5 (intrinsic, elsewhere), 10 (notice close), 11 (inline `width="11"` in mini/random buttons), 12 (fvs transparent paper), 14 (`--space-5`: `.org-btn--icon svg`, loom corner icons), 16 (`.org-floatbar__btn .ico`, `.org-theme svg`=`--space-6`), 20 (menu-icon), 22 (`.pt-ico` thumbnails), 26 (pictogram viewBox). Sizes are `px` or space tokens, not an icon-size scale.
* **Accessibility**: icon-only `<button>`s are in good shape for names: of 132 icon-only elements, 126 have `aria-label`, 24 have `title`; the 4 "neither" are false positives (div wrappers). Floatbar deliberately uses `aria-label` only (CSS `::after` tooltip). Real gaps below (§5).

## 1. Same meaning, drawn differently

| Meaning | Variants found (distinct drawings) | Where |
|---|---|---|
| **Close / remove (x)** | (a) 10x10 `M2 2l6 6M8 2L2 8` sw1.3 (core.js:797 notice) (b) 16 `M3 3l10 10M13 3L3 13` sw1.4 (fvs:1989,2024) (c) 16 `M4 4l8 8M12 4l-8 8` sw1.4 (apostate:202) (d) text `×` in ~14 places (camo-turing:1755, colornet:1531, genesis:1022, fvs:4411/5970/7381/8932/10218/11008, palette.js:191, apostate:2415, livingpath:797/2178/2205, sinew:395) | 3 svg + many glyph |
| **Plus / add / new** | `M8 3v10M3 8h10` at sw **1.4** (rhizome:99, genesis:289), **1.5** (fvs:685, DS:1194), **1.6** (dapple/undertow/murmur:36, mote:247); smaller `M8 3.5v9M3.5 8h9` 1.4 (apostate:171, livingpath); text `+` (genesis:390 New set, colornet/halide/pollen/spore/dapple/murmur/undertow/mote `.drop-icon`, `rmx-add`, `rmx-plus`, tunesutra card); dashed-circle plus (apostate:207 "Add point mode") | 4 svg + glyph |
| **Undo** | rhizome:108 (`M4 6H11a3.5 3.5 0 0 1 0 7H7` + arrow, sw1.4); fvs:506 (arrow-head + `M3 6h6.5…`, 1.3); genesis:350 ("Back"; `M4.5 3.5 2 6l2.5 2.5M2 6h7.5a4 4 0 1 1 0 8H8`); apostate:199 (circular `M4 4v4h4M4 8a5 5 0 1 1 1.5 3.5`) | 4 drawings |
| **Redo** | rhizome:112 only (mirror of rhizome undo) | 1 |
| **Refresh / reset / reseed / restart / re-render** (circular arrow) | 6 geometries: `M13 8a5 5 0 1 1-1.6-3.65`+`M13 2.3V6h-3.7` (reseed/reset: vortex, membrane, camo-turing:246, fvs x5) · `M3.5 8a4.5 4.5 0 1 0 1.4-3.3`+`M4.6 2.2v2.6h2.6` (pollen, spore "Render", dapple/undertow/murmur Restart/Replay) · `M3 8a5 5 0 1 0 1.6-3.7`+`M3 2.5v3h3` (fvs:486 reset seed shape) · `M13 4.8A5.5 5.5 0 1 0 14 8`+`M13.3 1.5v3.5H9.8` (livingpath/apostate/sinew "Reset effects") · loop `M3 8a5 5 0 0 1 8.5-3.5M13 8…` (Loop length x5) · apostate undo | 6 |
| **Export / download** | `M8 2v7.2M5.3 6.7 8 9.4l2.7-2.7`+tray `M2.5 11v1.5…` (x23, canonical) · mote:265 `M8 2v8M5 7l3 3 3-3M3 13h10` (different arrow + bar tray) · genesis:364 "Export SVG" `M8 2.5v8M8 10.5 5 7.5…` (third drawing) | 3 |
| **Import / upload** | genesis:292 / fvs:489 `M8 10.5V2.5M8 2.5 5 5.5…` (up arrow + tray, matches neither export drawing's proportions) | 1 (+ plus & folder used for the same meaning) |
| **Open file** | folder (pollen:160, halide, spore, DS:1385) **vs** plus (dapple/murmur/undertow "Open an SVG", mote "Open a video file", apostate/livingpath "Load a font") **vs** text `+` (`.drop-icon`) | 3 conventions |
| **Delete / trash** | 5: vortex/membrane (`M3 5h10M6.5 5V3.5…`, sw1.2), genesis:353 (`M2.5 4.5h11…` no ribs), genesis:357 (with ribs), rhizome:116 (`M3.5 4.5h9`, with ribs), fvs LAYER_ICONS.trash (`M3 4.5h10M6.5 4.5V3h3`) | 5 |
| **Pencil / edit** | genesis:296 (angular pen), apostate:193 ("Edit points", pen + dot), fvs:4433 (`M11.3 2.3l2.4 2.4…`) | 3 |
| **Dice / random** | `rect 2..14 rx2.5` + 3 dots r1.1 sw1.4 (x7: vortex, pollen x2, camo-turing x2, membrane x2) · apostate:227 (rect 2.5..13.5 rx2, r1) · apostate:2688 (same, stroke on svg, r.9) | 3 (plus text "Random seed" shown with the refresh arrow) |
| **Play / Pause / Stop** | Play: `M5 3.5v9l7-4.5-7-4.5Z` (x5, `z` lowercase in vortex, `M5 3.5 12 8l-7 4.5z` in mote – same shape). Pause: two filled rects rx.6 (dapple/undertow/murmur) vs stroked lines `M5 3.5v9M11 3.5v9` sw1.6 (camo-turing, membrane, blob-boundary). Stop: rect 8x8 **rx1** (pollen, spore, pulsar, trellis) vs **no rx** (mote:260) | 2 pause / 2 stop |
| **Chevron down** | svg 8x5 `M1 1l3 3 3-3` sw1.3 (x29, class `chev`) · 10x6 `M1 1l4 4 4-4` (mote:266) · text `▾` (`.pt-chev` in select-picker.js:65, transformer.js:300, apostate, livingpath, sinew, camo-turing) · HTML entity `&#9662;`/`&#9660;` (_template, apostate x4) | 4 |
| **Chevron right / disclosure** | text `▸` livingpath:937, `▶` sinew:370 rotated by CSS; apostate `.chev` svg rotated -90deg | 3 |
| **Check** | text `✓` (sinew `.tog`, fvs:4415, livingpath status, seeds-panel.js:316/367) — no svg check anywhere |
| **Grid / library** | genesis/fvs "Library" 2x2 rounded squares (#19) vs fvs "Show loaded grid" 3x3 lines vs livingpath/apostate "Full Family" 4-up cross | 3 distinct, legitimately different meaning but similar silhouettes |
| **Move up/down** | text `↑ ↓` in camo-turing:1753, colornet:1529, genesis:1020, sinew:366 | glyph only |
| **Theme** | sun/moon in header.js:160-161 (no stroke attrs; CSS in header.css:208, sw1.4) | 1 |
| **Menu** | `<menu-icon>` web component, 24 grid, 2px bars, shadow DOM (shared/menu-icon.js) | 1 |
| **Text align L/C/R** | 16x12 grid (not 16x16), sw1.4: livingpath:244-246, apostate:179-181 — duplicated pair of tools | 1 each |
| **Show/Hide** | eye / eye-off only in fvs (LAYER_ICONS, JS-only) | 1 |

## 2. Different meaning, same glyph

* `×` text: close, delete, remove layer/axis/master/variant, **multiply** (`×1.00` slider values: genesis:1863, pollen:306…), size notation "W × H" (print-size-panel.js:162), `.hint` (fvs:1391), and **"Reset glyph" in Apostate uses the X-path** (apostate:202) while every other Reset is a circular arrow.
* Circular arrow: **Random seed** (fvs, vortex), **Reset** (camo-turing:245 uses the exact Reseed path), **Reseed**, **Refresh** (pollen), **Render** (spore), **Replay entrance**/**Restart** (murmur/dapple/undertow), **Reset effects** (livingpath/sinew/apostate). Eight labels, five paths.
* Trash: **Clear canvas** (genesis, membrane), **Delete seed**, **Delete selected**, **Delete layer**, and **"Reset to rest"** (vortex:65, a reset action) all use a bin.
* Plus: **Add node/layer/new set**, **Open file**, **Load a font**, **Create** (genesis mode tab), `.drop-icon` placeholder (drop target, not an action).
* Genesis "Back" = the Undo glyph; "Back" otherwise elsewhere is a text link `← All palettes` (tunesutra:1603).
* Pause button (dapple/undertow/murmur:41) contains both a play triangle and pause bars (two svgs, toggled) – fine but note the initial state shows Play under label "Pause".
* `→` text: print-size-panel hint ("→ 1200 × 800 px"), fvs arrow between steps (10204), rhizome inspector "→ Figma" button text.

## 3. Grid / size / stroke inconsistencies

* viewBoxes: 16x16 (136), 8x5 (29 chevrons), 26x26 (41 pictograms), 10x10 (4), 14x14 (5 loom corners), 16x12 (6 text-align), 10x6 (1), 20x20 (1 pollen), 40x40 (8, scene art). Chrome icon grid is 16 except chevron, close(10), align(16x12), corners(14).
* Stroke widths: 1.2, 1.3 (std), 1.4, 1.5, 1.6; plus pictograms 1.3 (loom, select-picker fallback, mote) / 1.6 (fvs SEED_ICONS stroke mode) / 2.5 (genesis line/squiggle pictograms).
* Fill vs outline: Play/Stop/Pause fill; Pause also exists outline-stroked (sw1.6, 3 tools) so Pause looks heavier in Membrane/Camo/Blob than in Murmur/Undertow/Dapple. Pause bar x-positions differ (x=5/11 strokes vs rect x4..6.6, 9.4..12).
* Same Stop: rx1 vs none. Same Play: `Z` vs `z` (cosmetic).
* Dice icon: 3 geometries (see §1).
* Explicit `width/height` attrs only on 11 icons (11x11, 12x12, 10x10) otherwise sized by CSS; floatbar `.ico` 16px, `.icon-btn svg`/`.org-btn--icon svg` 14px, `.org-theme svg` 16px, mini-buttons 11px: three "16 grid" icons render at 11, 14 or 16 px — stroke becomes 0.9/1.14/1.3 effective, i.e. weight varies visually by container.
* `aria-hidden`: 25 of 181 chrome icons lack it (all of mote's floatbar icons: mote:247-266; fvs:685/1516/1751/1773/1797/1990/2025; pollen:418/430; camo-turing:630/641; membrane:328/339; vortex:279/287; DS:1194; apostate:2688).
* `class="ico"` (floatbar) vs none (inline mini buttons) vs `chev`: styling hooks are per-context not per-icon.

## 4. Hardcoded colours

Only the exceptions listed in §0. Seed pictograms are `currentColor`. Export serialisers contain intentional hex (`#fff`, `#0a0a0a`, `${bg}`) – out of scope (content colours). `shared/core.js:328` pattern icon uses `fill/stroke=currentColor` with opacity (fine).

## 5. Accessibility / label gaps

* Icon svg buttons: **no icon-only button without a name** (all 126 named). 104 have `aria-label` but no `title` (by design in floatbar; elsewhere hover tooltip missing): fvs 17, apostate 15, genesis 10, livingpath 8, mote 6, camo-turing 3 … (list in labels.txt).
* **Glyph buttons without name**: `sinew/index.html:366-367` (`↑ ↓` org-btn--sm, no aria-label/title; Sinew "remove" is text), `sinew:395` (`×` group delete, no label), `livingpath:797` (× has title only — OK), `apostate:2415` (× title), `fvs:10218` ok (aria-label).
* **`.drop-icon` `+` div** is a clickable drop target with no `role="button"`, no `tabindex`, no label in dapple:101, halide:149, murmur:103, pollen:228, spore:209, undertow:101 and `shared/_template.html:93` (the template propagates this). Mote:89 and colornet:173 add `role=button tabindex=0 aria-label` — the correct pattern to copy.
* `genesis:391` `⚙` Manage sets button: named (aria-label) but the glyph renders as an emoji-ish font glyph on macOS.
* `pt-chev ▾` spans are not `aria-hidden` (read as "black down-pointing small triangle").
* Floatbar tooltip relies on `aria-label`; buttons like Genesis Library/Create/Edit have aria-label and `aria-pressed` — fine.

## 6. Text / emoji glyphs used as icons (to replace with svg)

`×` (≈14 close/remove sites + design-system:846/1195), `+` (`.drop-icon` x8, genesis:390, `rmx-add`, `rmx-plus` x3, tunesutra:1625 card, pollen:763), `↑ ↓` (camo-turing:1753-4, colornet:1529-30, genesis:1020-21, sinew:366-7), `⚙` (genesis:391 only), `✓` (sinew `.tog` x2, fvs:4415, seeds-panel.js:316/367, livingpath status ✓/✗), `✗` (livingpath status lines), `▾ ▸ ▶` chevrons (6 files), `←`/`→` (tunesutra:1603, rhizome inspector, fvs:10204), `&#9662;` (_template:1 Export ▾ — the template itself seeds the legacy pattern, though newer tools use the floatbar svg), `⌘Z` in tooltips (fine). `×` as multiplication in value labels is legitimate text, not an icon.

## 7. Where each icon-bearing file stands (counts of icon-like svg blocks)

fvs 40 (layer icons JS builder `LI()` at 5645 is the nearest thing to a registry), genesis 33 (+13 in forms.js seeds), apostate 21, loom/js/main.js 17 (grid-type pictograms 26-grid, stroke on svg), design-system 17, livingpath 16, camo-turing 15 (8 pattern pictograms 26-grid), pollen 10, murmur 9, mote 8, dapple 8, undertow 8, tunesutra 8, vortex 7, membrane 7, trellis 7, halide 4, spore 6, sinew 5, mycel 5, rhizome 6, colornet 4, shared: core.js 3, header.js 2, select-picker.js 2, palette.js 1, seeds-panel.js 1, transformer.js 1, menu-icon.js (CSS bars). Registries already existing per-tool: `SEED_ICONS` (fvs:2673), `LAYER_ICONS` (fvs:5648), `GENERATOR_ICONS` (loom main.js), genesis `PROCEDURAL_CANON` pictograms 1676-1685, camo-turing Pattern pictograms 2294-2329, `Organica.aspectIcon` (core.js), murmur pictograms from engine. These are **thumbnail pictograms** (26 grid, `Organica.selectPicker` content) and should stay a separate family from UI icons.

## 8. Proposed canonical set + single source

Proposal: `shared/icons.js` exposing `Organica.icons.get(name, {size, title})` returning inline `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">`, plus `Organica.icons.mount(root)` that fills `<i data-icon="export">` placeholders (works for server-written HTML without JS in template strings: `${Organica.icons.export}`), and a paired `shared/icons.css`:

```css
.ico { width: var(--icon-size, 16px); height: var(--icon-size, 16px); flex: none;
       fill: none; stroke: currentColor; stroke-width: var(--icon-stroke, 1.5);
       stroke-linecap: round; stroke-linejoin: round; }
.ico--fill { fill: currentColor; stroke: none; }
```
Tokens to add (after asking, per project rule): `--icon-sm 12px`, `--icon-md 16px`, `--icon-lg 20px`, `--icon-stroke`. Keep 1.3 as default only if Diego prefers the existing look; one variable changes the whole suite. Also add a DS section "Icons" rendered from the registry with name + size/stroke samples in both themes, and a `scripts/check.py` rule failing on new inline `<svg viewBox="0 0 16 16"` outside `shared/icons.js` and on `×/⚙/▾` glyph-only buttons. Exempt: seed/generator pictograms (26 grid), export serialisers, Google logo, `<menu-icon>`.

Canonical catalogue (16x16, stroke 1.5 round caps/joins, `currentColor`, `fill:none` unless noted). Path data is the dominant existing drawing, regularised to the grid (live-area 2..14):

| name | meaning | canonical inner markup | variants found / replaces | files |
|---|---|---|---|---|
| `plus` | add, new, create, open (as add) | `<path d="M8 3v10M3 8h10"/>` | 1.4/1.5/1.6 plus; `+` glyph; apostate `M8 3.5v9` smaller | rhizome, genesis, fvs, dapple, undertow, murmur, mote, apostate, livingpath, DS, drop-icon x8 |
| `minus` | collapse, subtract (not used today) | `<path d="M3 8h10"/>` | none | — |
| `close` | dismiss, remove | `<path d="M4 4l8 8M12 4l-8 8"/>` | 3 svg + ~14 `×` | core.js:797, fvs:1989/2025, apostate:202, camo/colornet/genesis/sinew/livingpath/palette.js |
| `check` | confirm, done, toggle on | `<path d="M3.5 8.5l3 3 6-7"/>` | `✓` glyph x8 | sinew, fvs, seeds-panel, livingpath |
| `chevron-down` | disclosure, dropdown | `<path d="M4 6l4 4 4-4"/>` (rotate for up/left/right) | 8x5 svg x29, 10x6, `▾` x6 | every tool's Export button, select-picker, transformer, mote |
| `chevron-right` | disclosure/expand row | `<path d="M6 4l4 4-4 4"/>` | `▸ ▶` | livingpath, sinew, apostate |
| `arrow-up` / `arrow-down` | reorder | `<path d="M8 13V3M4.5 6.5 8 3l3.5 3.5"/>` / mirror | `↑ ↓` glyphs | camo-turing, colornet, genesis, sinew |
| `arrow-right` | next/to | `<path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5"/>` | `→` | rhizome inspector, tunesutra (left) |
| `menu` | nav | keep `<menu-icon>` (24 grid), expose as `icons.menu` alias | — | header |
| `download` (= Export) | export / save to file | `<path d="M8 2v7.2M5.3 6.7 8 9.4l2.7-2.7"/><path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11"/>` | x23 identical + mote + genesis variants | all floatbars |
| `upload` (= Import) | import file | `<path d="M8 9.2V2M5.3 4.7 8 2l2.7 2.7"/><path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11"/>` (mirror of download) | genesis:292, fvs:489 | genesis, fvs |
| `folder-open` | open file/image | `<path d="M1.5 4A1 1 0 0 1 2.5 3h2.8l1 1.3H13.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4Z"/>` | folder x4; plus x7 for same meaning | pollen, spore, halide, DS; (retarget dapple/murmur/undertow/mote/apostate/livingpath) |
| `undo` | undo / back | `<path d="M5.5 3 2.5 6l3 3"/><path d="M3 6h6.5a3.5 3.5 0 0 1 0 7H6"/>` | 4 drawings | rhizome, fvs, genesis ("Back"), apostate |
| `redo` | redo | mirror of `undo` (`M10.5 3l3 3-3 3` / `M13 6H6.5a3.5 3.5 0 0 0 0 7H10`) | rhizome:112 | rhizome |
| `refresh` | re-run, re-render, replay, restart | `<path d="M13 8a5 5 0 1 1-1.6-3.65"/><path d="M13 2.3V6h-3.7"/>` | 4+ clockwise variants | pollen, spore, murmur, dapple, undertow |
| `reset` | back to defaults (counter-clockwise) | `<path d="M3 8a5 5 0 1 0 1.6-3.65"/><path d="M3 2.3V6h3.7"/>` | fvs:486, livingpath/apostate/sinew, camo-turing | many |
| `shuffle`/`dice` | randomise | `<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><circle cx="5.5" cy="5.5" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="10.5" cy="10.5" r=".9" fill="currentColor" stroke="none"/>` | 3 dice | vortex, pollen, camo, membrane, apostate |
| `loop` | loop length | `<path d="M3 8a5 5 0 0 1 8.5-3.5M13 8a5 5 0 0 1-8.5 3.5"/><path d="M11 2.5V5H8.5M5 13.5V11h2.5"/>` | x5 identical | murmur, dapple, undertow, pulsar, trellis |
| `play` (fill) | play | `<path d="M5 3.5v9l7-4.5-7-4.5Z" fill="currentColor" stroke="none"/>` | 5+ | pulsar, trellis, vortex, mote, murmur… |
| `pause` (fill) | pause | `<rect x="4" y="3.5" width="2.6" height="9" rx=".6"/><rect x="9.4" y="3.5" width="2.6" height="9" rx=".6"/>` (fill) | filled vs stroked 1.6 | camo, membrane, blob-boundary, murmur, dapple, undertow |
| `stop` (fill) | stop render/record | `<rect x="4" y="4" width="8" height="8" rx="1"/>` (fill) | with/without rx | pollen, spore, pulsar, trellis, mote |
| `trash` | delete (permanent) | `<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>` (fvs LAYER_ICONS) ; `trash-ribs` adds `M6.7 7v4M9.3 7v4` | 5 drawings | vortex, membrane, genesis, rhizome, fvs |
| `clear` | clear canvas / reset to rest (not a bin; use `eraser`/`reset`) | reuse `reset` or new `eraser` | uses trash today | genesis:353, membrane:78, vortex:65 |
| `pencil` | edit | `<path d="M10.5 2.5 13.5 5.5 6 13H3v-3l7.5-7.5Z"/>` (genesis) | 3 | genesis, apostate, fvs:4433 |
| `copy` | duplicate | `<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>` | 1 | genesis |
| `save` | save to library | genesis:304 path | 1 | genesis |
| `eye` / `eye-off` | visibility | fvs LAYER_ICONS.eye / eyeOff | 1 | fvs |
| `grip` (fill dots) | drag handle | fvs LAYER_ICONS.grip | 1 | fvs |
| `grid` | library / grid view | `<rect 2.5 2.5 4.5x4.5 rx1> x4` | 3 similar | genesis, fvs, livingpath |
| `sun` / `moon` | theme | header.js:160-161 | 1 | header |
| `camera`, `mirror`, `video` | webcam | mote:250/253 | 1 | mote |
| `invert` | swap ink/paper | livingpath:252 | 1 | livingpath |
| `align-left/center/right` | text align (16x12 – re-grid to 16x16: shift y by +2) | livingpath:244-246 | 2 duplicates | livingpath, apostate |
| `handles`, `outline`, `add-point`, `fullfamily`, `legible` | apostate-only tool icons | apostate:188-227 | 1 each | apostate, partly livingpath |
| `settings` (gear) | manage | no svg exists; `⚙` glyph | glyph | genesis:391 |
| `info`, `lock`, `search`, `help`, `link` | **not used anywhere** (no matches) — add to the registry only when first needed |
| `google` | brand logo, multi-colour (exempt from currentColor) | sign-in:31 | 4 identical copies (sign-in + DS x3) | sign-in, DS |
| `fit/fill/contain/cover/anchor/clip/guides/tier icons` | FVS-specific toolbar (fvs:486-552) | stay in `fvs` as a local `icons.register()` extension | — | fvs |

Recommended migration order: (1) add `shared/icons.js/css` + DS "Icons" page; (2) swap the 23 identical Export arrows, 29 chevrons, 5 play/pause/stop, 5 loop (mechanical, byte-identical so zero visual risk); (3) decide stroke (1.3 vs 1.5) once, via `--icon-stroke`; (4) replace glyph buttons (`× ↑ ↓ ⚙ ✓ ▾ ▸`) with svg and add `aria-label` to the sinew ones and `role/tabindex/aria-label` to the 7 `.drop-icon`s (template first); (5) unify the diverging families (undo, trash, refresh/reset, dice, pencil, pause) and give Reset vs Refresh vs Replay distinct, documented meanings; (6) add a `check.py` rule to stop new inline 16-grid svg.

Not verified: visual rendering (static analysis only); icons assembled at runtime from strings in JS other than those the regex could match (e.g. fvs `${inner}` at 5645 builds through `LI()`); the home page `index.html` and `archive/` were excluded by instruction of scope (they contain only exported art).
