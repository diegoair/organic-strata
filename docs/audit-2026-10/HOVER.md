# HOVER audit, Organica (2026-10-02)

Scope: shared/*.css, shared/core.js, every */index.html. Read-only. Contrast numbers computed with real tokens from shared/tokens.css (WCAG ratio; `color-mix(in srgb)` evaluated). Known from BEHAVIOURS #15/#16 and MOTION: 10 hover spellings, no `:active`, missing hover transitions. This report adds the matrix, the bugs found, dark contrast, and tiers.

Token values used. Light: paper #fff, panel #eceae4, border #d0c8b8, border-strong #958462, mid #696256, ink #0a0a0a, accent-hover #333. Dark: paper #121210, panel #1f1e1a, border #3a362f, border-strong #7d725e, mid #a39c90, ink #eceae4, accent-hover #bdb8ae. Derived: control-bg = 5% ink in paper, track-bg = 10% ink in panel, gray-N = N0% ink in paper.

## 1. Facts about the system

- `@media (hover: hover)` guards: **zero** anywhere. `:active` pressed style: **zero** (only `input[type=range]:active{cursor:grabbing}` plus 3 tool-local: design-system x2, fvs x1, livingpath x1). Cursor on press/drag is the only active feedback.
- `:hover` rule counts: panel.css 21, header.css 17, floatbar 4, shell 3, palette 1, prose 1; tools: fvs 25, genesis 8, livingpath 4, hub 4, others 1-2. 17 tools have no local hover (they inherit shared).
- Tools with `:hover` and **zero** `focus-visible` in their own file: admin, apostate, colornet, genesis (8 hovers), livingpath, loom, mycel, spore. They rely on `#panel :focus-visible` (panel.css:754) or UA default.
- Hover colour vocabulary in use: border->`--ink` (+fill `--panel`) on buttons; border->`--mid` on fields; border->`--tool` on `.preset-trigger`, `.fg-card`, `.fg-thumb`, `.drop`; border->`--accent` on Pollen/Spore thumbs, `.rmx-add`, `.rmx-slot`; border->`--border-strong` on Genesis `.btn-icon`, `.picker-item`, `.lib-sets` buttons; border->`--border` on account trigger; fill->`--panel` (nav, account item, preset-item, Genesis form-tile via `--surface`, admin .btn, charset); fill->`--track-bg` (mega link, mega foot link, notice close, fvs-layer); fill->`--gray-100` (theme button); colour-only (seg-btn, panel values, `.pal-link`, prose a, fvs rename/layer btn, `.fg-chip button`, `.root-chip button`, `.fx-cat-head`); opacity (zoom-reset 0.6->1, floatbar glyph 0.6->1, fvs quicksave 0->1); transform (`.lp-phrase-btn` translateY(-1px), apostate same); outline (`.color-swatch`, `.pe-cell`, number value ew-resize outline); hub inversion (`.hub-module` ink fill / paper text); border-style (upload-btn stays dashed).
- Three different "light fills" for the same gesture: `--panel` (1.20 on paper light, **1.12 dark**), `--gray-100` (1.24/1.26), `--track-bg` (1.49/1.47).

## 2. Matrix (component x property). "-" = not changed. Transition column: P = property list tokenised, none = no transition, all = `transition:all`.

| Component | bg | border | colour | opacity | transform | cursor | transition | focus-visible parity | disabled suppresses hover |
|---|---|---|---|---|---|---|---|---|---|
| `.org-btn/.mini-btn/.icon-btn/.upload-btn` (header.css:457) | none -> `--panel` | `--border-strong` -> `--ink` | - | - | - | pointer | P border/bg/colour `--dur-fast` | ring 2px `--tool` only inside .org-header/.org-popover/.org-mega/#panel; **not parity** (hover fill+border, focus ring only, no fill); outside those scopes UA default | partly (see bug B1) |
| `.org-btn--primary/.panel-btn/.on/.active/[aria-pressed]` | `--ink` -> `--accent-hover` | -> `--accent-hover` | - | - | - | pointer | same | ring as above | `--primary`, `.panel-btn` yes; `.on`, `--danger`, `--ghost` **no** (B1) |
| `.org-btn--ghost` | none -> `--panel` | stays transparent | - | - | - | pointer | same | ring | no rule |
| `.org-btn--danger` | none -> `--danger` | `--danger` | `--danger` -> `--paper` | - | - | pointer | same | ring | **bug B1** |
| `.upload-btn` | -> `--panel` (inherits) | stays dashed -> `--ink` | `--mid` -> `--ink` | - | - | pointer | same | ring | not covered (disabled hover still fills) |
| `.hud-btn` (shell.css:197) | rgba(10,10,10,.82)->.95 (raw) | rgba .24 -> **#f5f2ec raw** | fixed #f5f2ec | - | - | pointer | inherits base | ring `--tool` 2px | `:not(:disabled)` yes |
| `.org-btn--icon/.icon-btn` Colornet | inherits + local: border transparent, colour mid->ink | | | | | | | | |
| Floatbar button (floatbar.css:196) | none (pill indicator travels, no tile) | - | (colour transition only for armed) | glyph 0.6 -> 1 | tooltip `::after` appears | pointer | glyph `--dur-slow` `--ease-glide`; tooltip none | **yes** (glyph opacity + tooltip also on :focus-visible; ring 2px `--ink` offset 2, floatbar.css:205, so BEHAVIOURS #7 is already partly fixed) but the travelling pill is pointer-only (`pointerover`, core.js:1597; touch ignored) | pill skips disabled (core.js:1593); but CSS `:hover > svg{opacity:1}` and tooltip still fire on a disabled button (whole button .35) |
| Floatbar pill | follows hovered btn | | | | | | `--ind-*` | follows focus too (core.js header comment) | skips disabled |
| Native `<select>` `.panel-select/.org-select/.org-field` | `--control-bg` unchanged | `--border-strong` -> `--mid` | - | - | - | pointer (select) / text | border `--dur-fast` | `:focus` border -> `--ink`, `outline:none`; inside #panel the 2px `:focus-visible` ring also applies; **standalone .org-field has no ring** (BEHAVIOURS #7) | `:disabled` .42 + not-allowed, but `:hover` rule still fires (border -> mid on disabled) |
| `.preset-trigger` (panel.css:804) | - | `--border-strong` -> `--tool` (or `--ink`) | - | - | - | pointer | border `--dur-fast`... (.14s in MOTION notes; token in file) | `#panel :focus-visible` ring only | no disabled style at all |
| `.preset-item` (panel.css:838) | none -> `--panel` | transparent -> `--border` | - | - | - | pointer | **none** | ring only inside panel; menu is `position:fixed` outside #panel? depends on mount | no disabled style |
| `.org-popover` rows | no hover (rows are labels/controls) | | | | | | | | |
| Mega link `.org-mega__link` | none -> `--track-bg` | - | - | - | - | pointer (link) | bg `--dur-instant` (90ms) | `.org-mega :focus-visible` ring; hover fill not mirrored | n/a |
| Mega foot link | -> `--track-bg` | - | - | - | - | pointer | **none** | ring | n/a |
| Header nav button | none -> `--panel`; open state `--track-bg` | - | - | - | - | pointer | bg `--dur-fast` | ring | n/a |
| Theme button `.org-theme` | none -> `--gray-100` | - | - | - | - | pointer | **none** | ring | n/a |
| Pattern dots `.org-pattern__dot` | **no hover rule** (has `transition: outline-color` with nothing to transition on hover; checked state outline `--ink`) | | | | | pointer | outline-color | ring | n/a |
| Account trigger | none | transparent -> `--border` (1.66:1 paper light) | - | - | - | pointer | **none** | ring | n/a |
| Account menu item | none -> `--panel` | - | - | - | - | pointer | **none** | ring | `:disabled` .5 + `cursor:default` (differs from not-allowed elsewhere); hover still fills |
| Header logo | - | - | `--mid`? -> `--ink` | - | - | pointer | check (colour only) | ring | n/a |
| Notice close | none -> `--track-bg` | - | `--mid` -> `--ink` | - | - | pointer | `--dur-fast` P | ring | n/a |
| Switch `.org-switch` | off: `--control-bg` -> `--gray-200`; on: `--ink` -> `--gray-900` | - | - | - | droplet swell scale 1.1 about its centre, spring (core.js:1270, 520/34/0.6) | pointer on row | colour `--dur-slow ease`; swell = rAF spring | `:focus-visible` outline 1px `--tool` offset 2 on the input; no swell on focus | `:not(:disabled)` excluded for fill, JS `if (input.disabled) return` |
| Checkbox `.check-row/.org-check` | off -> `--gray-200`; on -> `--gray-900` | - | - | - | tick previews 40% on off-hover (core.js:1407) | pointer on row | spring | same ring | same exclusion |
| Slider (range) | none on track or thumb | - | - | - | - | `grab` base (panel.css:241), `grabbing` on `:active` | none | track ring (2px paper + 2px ink 40%) on `:focus-visible` | `.35` + not-allowed |
| Slider number box `.ctrl-val/.panel-value/...` | outline 1px `--border` only on the slider-row variant | - | `--mid` -> `--ink` | - | - | ew-resize (slider rows) / text (editing) | **none** | no ring | n/a |
| `.seg-btn` (panel.css:546) | none | - | `--accent` -> `--ink` | - | - | pointer | bg/colour `--dur-fast` | `#panel` ring only; Genesis ships own hover for same | **no :disabled style**; pressed (.active/[aria-pressed]) gets **no** hover change |
| `.org-tabs .org-btn` | inherits org-btn hover (fill+border) | | | | | pointer | | | pressed tab: hover rule loses cascade to the `[aria-pressed]` tab rule (header.css:641), so a pressed tab has **no** hover feedback, unlike a pressed `.org-btn` (-> `--accent-hover`) |
| `.rmx-add` | - | `--border` dashed -> `--accent` | `--mid` -> `--accent` | - | - | pointer | **none** | none | n/a |
| `.rmx-color` chip | no hover | | | | | pointer | | | |
| `.rmx-x` | none | | | | | pointer | | | |
| `.color-swatch` (palette menu / pal-chips) | - | outline 1px `--ink` offset 1 on hover AND focus-visible | - | - | - | pointer | none | **yes** (the one true parity) | n/a |
| `.shape-thumb` Pollen / `.mark-thumb` Spore | `--panel` stays | `--border` -> `--accent` (8.6:1) | - | - | - | pointer | border+bg `--dur-fast` (Pollen); Spore none | none | n/a |
| Genesis `.form-tile` | transparent -> `--surface` (= `--panel`) | - | - | - | - | pointer | 0.15s raw `background` | none (0 focus-visible in genesis) | n/a; selected = `--surface-raised`, only 1.165 from hover colour |
| Genesis `.btn-icon`, `.picker-item`, `.lib-sets` buttons | - | `--border` -> `--border-strong` | `--ink-muted` -> `--ink` | - | - | pointer | `.btn-icon` `transition: all .1s` | none | `.sm-row button` has `:not(:disabled)` |
| FVS `.fvs-thumb` | **none on plain**; saved: border -> transparent | selected: `--tool`; hover removes border for saved | - | - | - | pointer | border/box-shadow `--dur-fast` | partly | n/a |
| FVS `.fvs-thumb-quicksave/.edit` | -> `--tool`/`--ink` fill, colour paper | | | opacity 0 -> 1 via parent hover + focus-visible | | pointer | 4 props | **yes** | n/a |
| FVS `.fvs-layer` | -> `--track-bg` | | | | | pointer | none | | n/a |
| FVS `.fg-card/.fg-thumb` | - | -> `--tool` | | | | pointer | none | none | n/a |
| FVS `.fg-chip button`, Mycel `.root-chip button` | - | - | `--mid`? -> `--ink` | - | - | pointer | none | none | fvs: `:not(:disabled)` |
| `.org-layer-card` | no hover (active = `--tool` border) | | | | | | | | |
| Notice | (see close) | | | | | | | | |
| `.drop-icon` (shell.css:132) | - | `--mid` 1.5px -> `--ink` | `--mid` -> `--ink` | - | - | pointer | border+colour `--dur-fast` | none | n/a |
| Livingpath `.drop` | -> `--paper` | -> `--tool` | | | | pointer | `.16s` (all) | none | n/a |
| `#zoom-hud .zoom-reset` | - | - | - | 0.6 -> 1 | - | pointer | opacity `--dur-fast` | none | n/a |
| `.info-tip` Camo Turing | - | `--border-strong` -> `--ink` | `--mid` -> `--ink` | bubble shown | - | **help** | none | **yes** (shared selector) | n/a |
| Prose link `.org-prose a` | - | - | -> `--accent` (barely different from ink) | - | - | pointer | none | none | n/a |
| Hub `.hub-module` | -> `--ink` | | `--paper` | | | pointer | .25s raw | | |
| Livingpath/Apostate `.lp-phrase-btn` | - | -> `--ink` | -> `--ink` | - | `translateY(-1px)` | pointer | .12s | none | n/a |

Cursor census: pointer is correct on every clickable. Outliers: `.info-tip` help (fine), `.org-account__item:disabled` default vs `not-allowed` (button/field/slider/floatbar/check), `.rmx-color` pointer ok, slider `grab`. `:disabled` cursor not-allowed on org-btn family, fields, floatbar, range, checkbox; none on seg-btn, preset-trigger, preset-item, rmx, thumbs.

## 3. Inconsistencies and bugs

B1. **Disabled hover can erase a button (cascade bug, by analysis, not run in a browser).** `.org-btn:disabled:hover, .mini-btn:disabled:hover, .icon-btn:disabled:hover { border-color: var(--border-strong); background: none }` (header.css:489, spec 0,3,0) beats the earlier `.org-btn.on:hover` / `.mini-btn.on:hover` / `.org-btn--danger:hover` (0,3,0 / 0,2,0) and only resets bg+border, not colour. Result for a disabled pressed button: paper text on no fill (invisible); disabled `--danger`: hover sets colour `--paper` and the disabled rule clears the fill (white on white); disabled `.org-btn--ghost` gets a visible `--border-strong` border on hover; `.upload-btn:disabled:hover` and `.org-btn--ghost:disabled` are not covered. Fix by guarding the hover rules with `:not(:disabled):not([aria-disabled="true"])` instead of the reset rule.
B2. **`--panel` is a weak hover fill and invisible on panel-coloured grounds.** On paper 1.20 light / **1.12 dark**. Where it sits on `--control-bg` (preset menu, the thumbnail dropdown) it is 1.08 light / **1.014 dark = invisible**; the only remaining cue is `border-color: var(--border)` at 1.49/1.41 (decorative, < 3:1). `.preset-item:hover` (panel.css:838) in dark is effectively not visible. The panel.css comment itself says "a hover that only moves a 1px border is a weak affordance" yet the fill chosen does nothing in dark.
B3. **Checked switch/checkbox hover is invisible.** `--ink -> --gray-900` = **1.25:1 light, 1.23:1 dark**. Only the 1.1x droplet swell signals hover on an ON switch (checked checkbox: tick swell is not present, so effectively no hover). OFF state is fine (control-bg -> gray-200: 1.42 light, 1.56 dark). Use `gray-800` (1.77/1.53) or `--accent-hover` (1.57/1.64, already the "ink-fill hover" token, same as buttons).
B4. **`.seg-btn` and pressed-tab have no hover feedback in the selected state, and unselected hover is colour-only** (`--accent` -> `--ink`: 14.35 -> 19.8:1 light, 12.9 -> 15.6 dark; practically invisible). No fill, no border, no disabled style. Genesis re-declares the same colour-only hover twice (lib-sets, lib-filters). Segmented controls are the largest hover-silent family.
B5. **Account trigger hover border is `--border`** (1.66:1 paper, 1.56 dark): not a 3:1 boundary, the only cue; no transition. Theme button hover `--gray-100` (1.24/1.26) is ok-ish but a second spelling of the wash.
B6. **`.preset-trigger` hover border `--tool`: 12 of 26 tool accents fail 3:1 against control-bg in one theme.** Light fails: dapple 2.42, fvs 2.67, genesis 2.95, komorebi 2.61, livingpath 2.38, mote 2.95, murmur 2.94, pollen 2.07, rhizome 2.80. Dark fails: apostate 2.27, undertow 2.82, vortex 2.94. (Same hazard for `.fg-card`, `.fg-thumb`, `.drop`, `.org-layer-card.active`.) Note the floatbar already says "`--tool` fails 3:1 on several" and uses `--ink` for its ring. Resting border is `--border-strong`, which gets to 3.65 light / 3.97 dark, so `--tool` often is a LOWER-contrast border than rest (pollen: 2.07 vs resting 3.65, hover darkens nothing).
B7. **Hover vs selected collisions.** Genesis `.form-tile:hover` = `--surface` (= `--panel`), selected = `--surface-raised` (panel + 6% ink): only 1.17:1 apart; a hovered unselected tile looks half-selected. Pollen `.shape-thumb.selected` sets `background: var(--panel)` identical to its resting bg, so selection reads on border alone; hover border `--accent` (#2a2a2a) is almost the same as selected `--ink`, so hover and selected are indistinguishable.
B8. **`.hud-btn` uses raw hex/rgba on hover** (#f5f2ec, rgba(10,10,10,.95)): violates the token rule. It is a content-on-canvas skin (intentionally fixed in both themes), but the hover only changes border 1.96 -> 17.7:1 and an almost identical fill. Fine visually; should still be named tokens (e.g. component-local custom props).
B9. **Hover without transition** (in addition to MOTION notes): `.preset-item`, mega foot link, `.org-theme`, `.org-account__trigger/__item`, `.org-header__logo`, `.rmx-add`, `.drop-icon`? (has), `.ctrl-val`, fvs layer/card/thumb (mixed), genesis (6 of 8), Mycel/Colornet/Tunesutra/admin hovers, prose link, `.seg-btn.active`. `transition: all`: Genesis `.btn-icon`, Livingpath `.drop`.
B10. **Focus parity is partial everywhere.** Hover is a fill/border change; focus is an outline. Exceptions that mirror: floatbar glyph+tooltip, `.color-swatch`, `.info-tip`, fvs quicksave/edit/del reveal. Not mirrored: every `.org-btn` (focus gets a ring but not the fill), mega link, account item, preset-item, seg-btn, thumbs, Genesis tiles. Scoping gap: `.org-field` standalone, tools outside `#panel/.org-header`, floatbar-hosted fields.
B11. **No touch guard.** Sticky hover on touch for fills/borders (`.org-btn`, `.seg-btn`, thumbs). App is desktop-gated so low risk, but the hover-reveal controls (fvs quicksave/edit/del, `.zoom-reset` at .6) are unreachable by touch; floatbar pill already ignores touch (core.js:1597 pointerType check), so the CSS is the odd one out.
B12. **Disabled still hovers** for: fields (`:disabled` + `:hover` border mid), account item, floatbar (glyph brightens, tooltip shows on a .35 button, pill skips), upload-btn, ghost. Checkbox/switch do it right (`:not(:disabled)` + JS return).

## 4. Dark-theme contrast numbers (WCAG ratio)

Hover fills against their resting surface (light / dark):
- `--panel` on paper: 1.20 / **1.12** (below 1.2 in dark)
- `--panel` on `--control-bg`: 1.08 / **1.01** (invisible)
- `--panel` on `--track-bg` ground: 1.24 / 1.31
- `--gray-100` on paper: 1.24 / 1.26
- `--gray-200` on paper: 1.57 / 1.73
- `--track-bg` on paper: 1.49 / 1.47; on panel 1.24 / 1.31; on control-bg 1.34 / 1.33
- `--accent-hover` vs `--ink` fill: 1.57 / 1.64 (text paper on it 12.6 / 9.5, legible)
- `--danger` fill with paper text: 6.8 / 6.1 (legible)
- Switch ON hover `--gray-900` vs `--ink`: **1.25 / 1.23** (invisible); `gray-800` 1.77 / 1.53; `gray-700` 2.59 / 1.95
- Switch OFF hover `--gray-200` vs `--control-bg`: 1.42 / 1.56 (ok)

Hover borders against the surface they sit on (3:1 rule for non-text boundary):
- `--ink` vs paper 19.8 / 15.6; vs panel 16.5 / 13.9; vs control-bg 17.8 / 14.1 (pass)
- `--mid` vs paper 6.0 / 6.9; control-bg 5.4 / 6.2 (pass), but only 1.65 / 1.74 away from the resting `--border-strong` (field hover border change is a subtle step)
- `--border-strong` (rest) 3.65 / 3.97 (pass); `--border` 1.66 / 1.56 (**fails 3:1**: account trigger hover, preset-item hover, Genesis tile... decorative only)
- `--accent` 14.4 / 12.9 (pass; hover and selected nearly same)
- `--tool`: 12 of 26 fail 3:1 in one theme (B6)

Text on hover: `--mid` on `--track-bg` 4.05 light (**below 4.5**) / 4.69 dark (notice close, mega link: text there is ink 13.3/10.6, so only `mid`-coloured items on track-bg, e.g. `.pal-link`, FVS layer meta, would fall short). `--mid` on panel 5.0 / 6.1 ok.

Floatbar resting glyph 0.6 ink on paper 5.25 / 6.15 (ok); hover to 1.0 is a visible lift.

## 5. Proposal: three canonical tiers

Common rules. One hover fill token, **`--track-bg`** (already exists, 10% ink: 1.49 on paper, 1.34 on control-bg, 1.31 on panel; works in both themes, the least-bad existing token; `--panel` retired for hover). No new token needed; if Diego wants a pure role name, `--hover-bg: var(--track-bg)` would be the one new token (ask before adding). One border hover: `--ink`. Transitions always `var(--dur-fast) var(--ease-standard)` on explicit properties, list rows `var(--dur-instant)`. Never `--tool` as a hover border. All hover rules sit behind the guard below and exclude disabled.

```css
/* GUARD: wrap every :hover rule. Touch gets :active only. */
@media (hover: hover) { … }
```
Simplest uniform pattern: define each tier once with `:is(:hover, :focus-visible)`-style parity where the visual is a fill, and keep the ring on focus-visible.

**Tier 1, outline control** (`.org-btn` family, `.upload-btn`, `.preset-trigger`, fields, `.seg-btn`, `.org-tabs .org-btn`, thumbs/tiles with a border, `.drop-icon`, `.rmx-add`, Genesis `.btn-icon`/`.picker-item`/`.lib-sets`, `.fg-card`):
```css
.control { border: 1px solid var(--border-strong); background: none; transition: border-color var(--dur-fast), background-color var(--dur-fast), color var(--dur-fast); }
@media (hover: hover) {
  .control:hover:not(:disabled):not([aria-disabled="true"]) { border-color: var(--ink); background: var(--track-bg); }
}
.control:active:not(:disabled):not([aria-disabled="true"]) { background: var(--gray-200); }       /* pressed: one more step */
/* pressed/selected (inverse) */
.control.on, .control[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
@media (hover: hover) { .control.on:hover:not(:disabled), .control[aria-pressed="true"]:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); } }
.control.on:active:not(:disabled) { background: var(--gray-700); border-color: var(--gray-700); }
/* fields: hover border --mid is too faint a step; use --ink hover on pickers/buttons, keep --mid only for text inputs (focus is --ink) */
```
Delete the disabled reset rules; the guard replaces them (fixes B1/B12). Segmented children share this (fixes B4; selected state gets `--accent-hover`). Danger: `:hover { background: var(--danger); border-color: var(--danger); color: var(--paper) }` inside the same guard.

**Tier 2, list row** (mega link and foot link, account item, `.preset-item`, popover rows, palette-library rows, fvs layer rows, charset, Genesis `.form-tile`):
```css
.row { background: none; border: 1px solid transparent; transition: background-color var(--dur-instant); }
@media (hover: hover) { .row:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--track-bg); } }
.row:focus-visible { background: var(--track-bg); }            /* focus mirrors the wash (plus the existing 2px ring) */
.row:active { background: var(--gray-200); }
.row.on, .row[aria-selected="true"] { border-color: var(--ink); }   /* selection = border, never a fill, so hover and selected never collide (B7) */
```
Drop the `border-color: var(--border)` hover on `.preset-item` (decorative contrast, B2). `.org-account__item:disabled`: `cursor: not-allowed`.

**Tier 3, icon / ghost** (header nav, theme button, notice close, `.org-btn--ghost`, `.org-btn--icon` ghost, Colornet `.icon-btn`, `.fvs-layer__btn`, `.fg-chip button`, `.root-chip button`, `.rmx-x`, zoom-reset, text links, `.pal-link`, `.ctrl-val`):
```css
.ghost { border: 0; background: none; color: var(--mid); border-radius: var(--radius-md); transition: background-color var(--dur-fast), color var(--dur-fast); }
@media (hover: hover) { .ghost:hover:not(:disabled) { background: var(--track-bg); color: var(--ink); } }
.ghost:active:not(:disabled) { background: var(--gray-200); }
.ghost[aria-expanded="true"], .ghost[aria-pressed="true"] { background: var(--track-bg); color: var(--ink); }
```
`.org-header__nav` already uses this pair (`--panel`/`--track-bg` open). Text links: `color: var(--ink); text-decoration: underline` on hover, not `--accent` (indistinguishable from ink, prose.css:55). Colour-only is allowed only for inline values (`.ctrl-val`: mid -> ink + the existing ew-resize outline).

**Plus tile / dashed add** (`.upload-btn`, `.rmx-add`, "+" tiles, drop zones): dashed border stays dashed; hover = Tier 1 (`border-color: var(--ink); background: var(--track-bg); color: var(--ink)`). `.drop-icon`/`.drop` hover and drag-over: hover = Tier 1; drag-over = `outline: 2px solid var(--ink)` (never `--tool` for a boundary).

**Switch and checkbox**: keep the spring swell (1.1x, rAF) as the primary cue since it is theme-proof. Change the colour step so ON is visible: ON hover `--accent-hover` (1.57 / 1.64) or `gray-800`; OFF hover `--gray-200` (already ok). Add the same swell + preview tick on `:focus-visible` (currently hover-only) so keyboard users get parity; under `prefers-reduced-motion` the colour step alone must remain readable.

**Tiles/thumbs** (Pollen `.shape-thumb`, Spore `.mark-thumb`, FVS `.fvs-thumb`, `.fg-thumb`): hover `border-color: var(--ink)` (not `--accent`/`--tool`); selected = `--tool` border + 1px ring; saved keeps its own 3px state. Never let hover clear the border (the fvs saved-thumb case is a deliberate exception, keep it local).

**Slider**: thumb/track have no hover today. Add (inside the guard) thumb `box-shadow` widen: `0 0 var(--space-3) rgba(0,0,0,.4)` -> `0 0 var(--space-4) rgba(0,0,0,.5)`, or a 1.1 scale on the thumb matching the switch droplet; cursor `grab` -> `grabbing` on `:active` already exists. Number box: keep mid -> ink + existing outline.

**Floatbar**: no change to the glyph-opacity + pill model; add `:active` = glyph `opacity:1` plus the pill stays; make tooltip and glyph lift skip `:disabled`:
```css
.org-floatbar__btn:disabled:is(:hover, :focus-visible) > svg, … > span { opacity: inherit }
.org-floatbar__btn:disabled::after { display: none }
```

**Disabled rule (all tiers)**: `opacity: 0.42; cursor: not-allowed; pointer-events: auto` (keep events so the cursor and `data-why` tooltip work), and every hover/active rule carries `:not(:disabled):not([aria-disabled="true"])`. Floatbar uses .35 (keep, one number: pick 0.4 token if one is added). Menus rows: `cursor: not-allowed`, not `default`.

**:active rule**: pressed = one grey step darker than hover: fill controls `--gray-200`, inverse controls `--gray-700`, icon `--gray-200`; transition `--dur-instant`; no transform (except the optional 1px translate on the Apostate/Livingpath phrase buttons: remove, it is the only transform hover in the system).

**Cursor rule**: `pointer` on every clickable (buttons, tiles, rows, links, labels of check rows); `not-allowed` disabled; `text` fields; `grab`/`grabbing` slider, canvas pan; `ew-resize` numeric scrub; `help` info-tip; never leave `default` on a clickable.

**Guard**: `@media (hover: hover) and (pointer: fine)` around the hover-only visuals; hover-reveal controls (fvs quicksave/edit/del, zoom-reset) must be visible at rest when `@media (hover: none)`; focus-visible mirrors each tier's hover fill and adds the 2px ring (`outline: 2px solid var(--ink)`, one colour; `--tool` fails 3:1 on 12 of 26 tools), applied globally, not scoped to `.org-header/#panel`.

## 6. Priority fixes

1. B1 disabled-hover cascade (real bug, 6 button variants).
2. B2/B3 two near-invisible hovers in dark (preset-item, checked switch/checkbox).
3. Swap hover fill to `--track-bg` everywhere; delete `--panel` and `--gray-100` hovers.
4. Replace `--tool`/`--accent`/`--border` hover borders with `--ink` (B5/B6/B7).
5. Give `.seg-btn`/pressed tabs a hover, add `:disabled` styling, add transitions to the 12 transition-less hover rules (B9), `transition: all` removal (2).
6. Add the `@media (hover: hover)` guard and one `:active` step; extend the global focus ring beyond `#panel/.org-header`.
7. Retarget tool-local duplicates (Genesis x8, FVS, Pollen/Spore, Colornet, Admin `.btn`) to the three tiers; tools with zero `focus-visible` (admin, apostate, colornet, genesis, livingpath, loom, mycel, spore) get the global ring.

Method note: counts from grep over the live tree (uncommitted working copy); contrast from `scratchpad/c.js`, `t.js`, `s.js`. B1 is derived from CSS specificity, not run in a browser.
