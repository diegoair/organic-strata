# Organica — Interaction behaviours and component coherence audit

Date: 2026-10-02. Read-only. Method: read the docs and the design-system page, then grep and node scripts over `*/index.html`, `*/js`, `shared/*`.
Scripts are in the scratchpad: `quant.js`, `states.js`, `a11y.js`, `fb.js`, `dup.js`, `cls.js`, `raw.js`, `ctr.js`.
Excluded: `explorations/`, `archive/`, `.claude/worktrees/`, `vendor/`.
Counts are static-source counts. Behaviour claims marked VERIFY need a quick check in a browser.

## 0. Headline

Token discipline is much better than the narrative suggests.
- Outside Genesis (known debt), raw font-size / spacing / radius / chrome-hex in tool CSS is small.
- `css-lint` is clean.
- Identical rule bodies repeated across three or more tools are almost non-existent.

The real gaps are behavioural. The design system documents appearance well, but not:
- state vocabulary
- two-click confirmation
- preset save and delete
- keyboard operability
- modal and picker behaviour
- progress and empty states
- shortcuts
- reduced motion

The same job is implemented 3 to 8 ways, and some implementations break accessibility.

## 1. Prioritised findings

Severity: **H** = functional or accessibility failure that affects users; **M** = inconsistency users will feel, or a documented rule that is broken; **L** = hygiene.

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | H | `genesis/index.html` `createTile()` (~l.1166), `.form-tile` | The Library, Genesis's home, is a grid of `<div>` tiles with a click handler. No `tabindex`, no role, no key handler, no focus ring. A keyboard user cannot open a seed. `.selected` has no ARIA. | Render tiles as `<button>`. Add `aria-pressed` or `aria-current`. Add a `:focus-visible` ring. |
| 2 | H | `shared/seeds-panel.js` ~l.389, 420 (`.shape-thumb`; used by Membrane, Camo Turing, Living Path); `pollen/index.html` l.629-651; `spore/index.html` l.454 (`.mark-thumb`) | Thumbnail pickers are `<div onclick>`. The shared one has `role="button"` and `aria-label` but no `tabindex` and no Enter/Space, so it announces as a button yet cannot be reached. Pollen and Spore have neither role nor label (only `title`). | One shared "thumb" component built on `<button>`, with state `aria-pressed`. Replace in all three. |
| 3 | H | `halide`, `pollen`, `spore`, `komorebi`, `camo-turing`, `mycel`, `trellis`, `sinew` (+ others) | Segmented controls signal state with the `.active` class only (about 54 buttons). No `aria-pressed`. Of 43 `.seg-ctrl` containers only 9 have a role and label. The docs say ".active is kept for tools not yet converted", but nothing tracks the conversion. | Add a `Organica.segCtrl` helper (or extend `autoLabelPanel`): set `role="group"`, `aria-label`, and keep `aria-pressed` in sync with `.active`. Retire `.active` in CSS afterwards. |
| 4 | H | `shared/core.js` ~l.746 (zoom/pan) | `⌘/Ctrl + + / - / 0` is captured globally (`preventDefault`) on every tool with a pannable canvas. This overrides browser zoom, a WCAG 1.4.4 resize failure for low-vision users. The wheel also zooms with no modifier and a fixed 1.15 step per event (VERIFY: trackpad inertia gives large jumps). It blurs any focused control as a side effect. | Drop the global ⌘± override (keep a visible `+ / - / reset` in the HUD). Use `ctrl+wheel` or pinch for zoom and plain wheel to pan, or at least scale the step by `deltaY`. |
| 5 | H | `shared/select-picker.js` | The thumbnail dropdown is a `<button>` plus a `<div hidden>` menu. It has no Escape. No `aria-expanded`, `aria-haspopup`, listbox or option roles. No arrow-key navigation. No close on scroll or resize (the menu is fixed-positioned). Opening it does not close other open popovers. The preset picker is used in about 12 tools. | Reuse the `Organica.popover` contract (Escape, `aria-expanded`, focus return) and add Up/Down/Home/End/Enter. Give the rows `role="option"` in a `role="listbox"`. |
| 6 | H | `shared/core.js` `Organica.popover` l.833-880 | Each trigger calls `e.stopPropagation()`, and closing relies on a document click, so clicking trigger B does not close open popover A. Today only Chrome's focus-on-click and the `focusout` handler save it (VERIFY: Safari and Firefox do not focus buttons on click). `fvs` has 3 popovers, `pulsar`, `trellis`, `murmur`, `dapple` and `undertow` have 2 each. Escape closes all popovers and the notice at once. | A single module-level "active popover" registry, so opening one closes the others. |
| 7 | H | `shared/floatbar.css` + `header.css` l.499-503 + `panel.css` l.754 | Focus ring is scoped: `.org-header`, `.org-popover`, `.org-mega`, `#panel`, `.org-panel`. The floatbar buttons are in none of those. Keyboard focus there is only an opacity change (0.6 to 1) plus the travelling pill, with no outline. Also `.org-field:focus` is `outline:none` with only a border-colour change. The floatbar tooltip is `:hover::after` only, so keyboard users never see the label. | Add `.org-floatbar :focus-visible { outline: 2px solid var(--tool) }` in `floatbar.css`. Show the tooltip on `:focus-visible` too. Add a visible focus ring to `.org-field`. |
| 8 | H | `--tool` as focus ring | `--tool` is used for every focus ring (2px). Contrast against white paper is below 3:1 for pollen 2.30, livingpath 2.64, dapple 2.69, komorebi 2.90, fvs 2.97. In dark mode `--tool` has no override: apostate is 2.52 against `#121210`, and undertow, vortex and design-system are close (3.1-3.5). | Use a fixed token for focus rings (`--focus-ring`, solid `--ink`, with a `--tool` inner accent if wanted). Or darken or lighten `--tool` per theme. TuneSutra's System view already proposes values. |
| 9 | H | `dapple`, `murmur`, `undertow`, `membrane` (Space handlers) | The Space shortcut skips only INPUT, SELECT and TEXTAREA (Membrane also skips contenteditable). It does not skip BUTTON, summary or role=button, and it calls `preventDefault`. A focused floatbar button cannot be activated with Space. VERIFY in Chrome and Firefox. | Skip `button, a, summary, [role=button]` in addition to the form fields. Put the guard in one shared helper (`Organica.shortcut`). |
| 10 | M | 13 tools: `camo-turing`, `dapple`, `halide`, `komorebi`, `mote`, `murmur`, `mycel`, `pollen`, `radial`, `tunesutra`, `undertow`, `warping`, `_template.html` | `deletePreset()` is one click, no confirmation, no undo. Genesis (seed and set delete) uses an armed two-click. The template ships the single-click version, so new tools copy it. | Extract one `Organica.armed(btn, {onConfirm, ms})` helper and use it for preset delete. |
| 11 | M | Armed two-click pattern | 5 implementations: Genesis (`.is-armed`, `dataset.armed`, 3000 ms, aria-label swap, no live-region announcement); Living Path and Apostate (`.is-armed`, 2600 ms); `admin` (`.armed`, 4000 ms, text swap); TuneSutra (`leaveArmed`, 4000 ms, no class, text swap); the floatbar (`color: --danger` only). The visual differs per place: red text only, red border and text, filled red. Apostate overrides `.org-floatbar__btn.is-armed` with a fill, contradicting the rule in UI-SHELL ("never a per-tool `.is-armed` override"). Admin uses `.armed`, not `.is-armed`. The Genesis rule in the docs says "armed" but the design system page has one mention. | One component with one class (`.is-armed`), one timeout token, an `aria-live` announcement, and one visual per button family. Document it. |
| 12 | M | Preset save UI | Inline save row in 9 tools; `prompt()` in 6 (`dapple`, `undertow`, `murmur`, `sinew`, `blob-boundary`, `_template.html`); bespoke in `fvs`, `colornet`, `rhizome` (`prompt()` throws in some embedded contexts, per comments in `fvs`, `colornet`, `rhizome`). `alert()` in `spore` (3, "Render first.") and `fvs` l.11162. | Make the inline name row the single pattern (`Organica.presetBar`). Replace `alert()` with `setStatus('error')`. Fix the template first. |
| 13 | M | `shared/floatbar.css` rule vs 5 tools | The design system says never add `title` on floatbar buttons (double tooltip). `dapple`, `murmur`, `undertow`, `pollen`, `spore` all do (8 buttons). | Remove `title`. Put the long explanation in the popover or status text. |
| 14 | M | Selected-state class names | Same concept, 6 spellings: `.active` (seg-btn, layer-card, shape-thumb, tier-view, fvs-layer, rmx-slot, camo layer-name), `.on` (preset-item, layer-dot, chan-dot, switch, `#btn-paper-clear.is-on`, `[data-on]`), `.selected` (fvs-thumb, form-tile, mark-thumb, Pollen's `.shape-thumb`), `.is-active` (`.lp-phrase-btn`), `[aria-pressed]`, `[aria-selected]`. Pollen redefines the shared `.shape-thumb` with `.selected` while the shared sheet uses `.active`. `.on` is also reused in Genesis for `[data-modes].on` (a visibility toggle). | Declare one contract: `aria-pressed` / `aria-selected` / `aria-current` is the state; `.is-active` is a styling mirror only. Migrate the shared sheets first. |
| 15 | M | Hover vocabulary | Border to `--ink` plus `--panel` fill (buttons); border to `--mid` (fields); border to `--tool` (`.preset-trigger`); border to `--accent` (Pollen thumbs, rmx-slot, rmx-add); fill to `--track-bg` (mega link, notice close); fill to `--panel` (nav, account item); fill to `--gray-100` (theme); border to `--border` (account trigger); `--surface` (Genesis tile); opacity (zoom-reset); underline none. | Define 3 hover tiers in the design system (outline control, list row, icon/ghost) and map each component. |
| 16 | M | `:active` (pressed-down) | Defined only for `input[type=range]` (`panel.css`) and `.fvs-flyout__tool`, `.layer-head`. Buttons, seg buttons, chips and tiles have no pressed feedback. | Add one `:active` rule on `.org-btn` family and `.seg-btn`. |
| 17 | M | Reduced motion | Honoured in the floatbar, header notice, slider coast, `index.html`, `gallery`, `fvs` (4), `core.js` (3). Not honoured anywhere in the tools with continuous or auto motion: `pulsar`, `trellis`, `vortex`, `membrane`, `mote`, `murmur`, `dapple`, `undertow`, `komorebi`, `camo-turing`, `blob-boundary` (GSAP). These are rAF loops. Also the Genesis (`genesis`), Pollen and Spore transitions. VERIFY which ones autoplay on load. | In each loop-based tool: start paused (or one still frame) when `prefers-reduced-motion: reduce`, as `gallery` already does. Add a CSS `@media` reset for tool-local transitions. |
| 18 | M | Modals | 4 modals (`fvs` x2, `colornet`, `genesis`) use `.org-modal` with `role="dialog" aria-modal`. Each has its own open/close code. Escape exists in some. No focus trap, no focus return, no `inert` on the page behind (VERIFY per modal). | `Organica.modal(el)` with Escape, focus trap, focus return. |
| 19 | M | Progress and loading | Three local progress bars (`#progress-bar` in Pollen, Spore, Mote, each with its own CSS); Pollen's `#recompute-overlay` with spinner; Living Path's scrim, message pill and 5px bar; the busy Notice. No shared progress component, no spinner token, no `aria-busy`. Halide has an "announced to assistive tech" comment. | Shared `.org-progress` (thin bar on the stage) plus the existing busy Notice. Document "when bar, when Notice, when overlay". |
| 20 | M | Empty states | `.fvs-library-empty`, `.chan-empty`, `.rz-node__empty`, `.empty` (livingpath, sinew), select-picker `.pi-group` hint, admin's `<td class="muted">`, Genesis `empty` div. Different type, colour and copy. | One `.org-empty` (text, optional action) and a copy rule. |
| 21 | M | Collapsible sections | `<details>` (fvs Advanced, mote `.flow-adv`), `.fx-cat-head` (livingpath, apostate, with different collapsed-class names `.collapsed` vs `.open`), sinew `.layer.open`, Genesis `[aria-pressed]` manage toggle. Chevrons: `▾`, `›`, rotating SVGs, `.chev`. | One disclosure component (`<details>`-based) and one chevron. |
| 22 | M | Layer or list-row card | `.org-layer-card` (colornet only, shared in `panel.css`), `.layer` (livingpath, sinew, duplicated), `.fvs-layer`, camo `.layer-*`, `.trk` (pulsar, trellis, duplicated), `.fg-card`, `.root-chip`. Reorder and delete: `.icon-btn` ↑↓× (colornet, camo), `.org-btn--sm` (sinew), `.sm-up/.sm-del` (genesis), drag (livingpath), `.mini-btn ×`, `.rmx-x`, `.fg-card__x`, `.fvs-layer__del`, `.org-notice__close`. At least 8 "remove ×" implementations. | Promote `.org-layer-card` to cover head, drag, toggle, chevron, reorder and remove. Add one `.org-btn--icon.org-btn--sm` for ×. |
| 23 | M | Icon-only buttons built in JS | Sinew layer ↑ ↓ and group × (`sinew/index.html` l.366, 367, 395) have no `aria-label`. Living Path / Apostate preset `×` (l.797 / 2415) and FVS `.rmx-x` (l.5970, 8932) rely on `title` only. | Add `aria-label`. Also add a lint check for `>×<` / `>↑<` buttons. |
| 24 | M | Unsaved work | No `beforeunload` guard anywhere (grep: 0). Only TuneSutra warns when leaving the editor (armed text swap). Genesis Create, FVS Component / Symbol / Figure drafts, and Living Path edits have no guard. VERIFY what each autosaves. | A shared dirty-state helper plus one confirm pattern. |
| 25 | M | Tooltips | Three systems: floatbar `::after` from `aria-label`, native `title` (Loom 93, FVS 104, Camo Turing 40, Genesis 16, others 13-17 each, in tool panels), Camo Turing's own `.info-tip` bubble (role=note, focusable). The docs state "title is unreachable by keyboard", and the suite uses it heavily. Only the floatbar and `.info-tip` are documented, and only the floatbar is a shared component. | Decide: either promote `.info-tip` to shared (`.org-tip`) and use it for non-obvious controls, or document `title` as acceptable for redundant hints only. |
| 26 | M | Floatbar order and labels | The "Create · Edit · Save · Back · Delete · Library · Export" order is documented only in `CLAUDE.md` for Genesis. Other tools follow an unwritten Open · transport · extras · Export order. Names drift: Pause/Play vs Play/Stop; Restart (dapple, undertow) vs Replay entrance (murmur) vs Reset (camo, membrane) vs Reseed (membrane, vortex) vs Refresh (pollen) vs Render (spore); Undo (⌘Z) vs Undo (Cmd/Ctrl+Z) vs Back. Shortcut hints in labels use 3 spellings. | Document the order and a verb list in the design system. |
| 27 | M | Keyboard shortcuts | Space = play/pause in `membrane`, `mote`, `murmur`, `dapple`, `undertow` only. `pulsar`, `trellis`, `vortex`, `camo-turing`, `blob-boundary` have Play/Pause but no Space. ⌘Z in `genesis`, `fvs`, `rhizome`, `tunesutra` only (Apostate / Living Path glyph editor have an Undo button; Halide, Spore, Colornet, Loom have none). `k` = kiosk in Mote only (guards INPUT but not ⌘K). Delete/Backspace in Genesis and Rhizome. Nothing is listed in the UI or the design system. | A "Keyboard" table in the design system (global, canvas, editors) plus one shared Space guard (see #9). |
| 28 | M | Drop zones | `Organica.canvasDropZone` is used by Halide, Spore, Pollen only. Colornet, Mote, Komorebi, Apostate, Living Path, Sinew and 5 spots in FVS hand-roll `dragover`. Drop hint class `.hidden`, `.drag-over` outline: documented in `shell.css` but not on the design system page (only 2 mentions of "drop-hint"). | Document the drop pattern. Move the remaining tools onto the helper where the markup allows. |
| 29 | L | Visibility toggling | `.visible` is redefined locally in 11 tools (plus shared `.org-stage.visible`); `.hidden`, `.u-hidden`, `hidden` attribute, and about 330 inline `style="display:none"` (fvs 61, genesis 35, loom 42, camo 17, trellis 14, pulsar 14, pollen 11, radial 11). Already in backlog. | Keep as is until the `hidden` sweep. |
| 30 | L | Bespoke buttons | `admin` has its own `.btn`, `.btn--danger`, `.btn--danger.armed` (does not use `.org-btn`). Genesis redefines `.panel-row`, `.panel-select`, `.check-row`, `.panel-divider` and uses 5px radii (known debt, `KNOWN_DEBT` in css-lint). | Migrate `admin` (small). Genesis stays deferred. |
| 31 | L | Duplicated tool CSS | Same local class in two tools: `.layer*` (livingpath, sinew); `.fx-cat-*`, `.lp-phrase*` (apostate, livingpath); `.trk`, `.one-shot` (pulsar, trellis); `.field-mini*` (mycel, tunesutra); `.preview-wrap`, `.thumb-num` (pollen, spore). The "extract at the second consumer" rule applies. | Promote these five. |
| 32 | L | Tool-local raw values | Raw px or hex in tool CSS (font-size px / spacing px / radius px / hex): genesis 12 / 43 / 4 / 11 (known); loom 13 / 19 / 2 / 25; rhizome 0 / 3 / 0 / 22; tunesutra 2 / 3 / 1 / 0; mycel 0 / 5 / 0 / 0; the rest 0-3 each. Suite totals: 27 / 84 / 7 / 77. Most hex are export or content colours (white paper, SVG fills, Rhizome port-type colours in JS) and are fine. The real chrome offenders: Loom `#guide-safe` `#c98a4a`, Loom 12-15px font sizes, Rhizome `.rz-*` greys. Shared CSS: `header.css` 5 spacing px, `panel.css` 5 radius px and 1 spacing px, `floatbar.css` 3 radius and 2 spacing px, `shell.css` 2 hex (HUD button colours). | Fix Loom and Rhizome chrome values. Ask before adding tokens (per the rule). |
| 33 | L | Notice | Escape closes the notice even when focus is in a dialog (shared document listener, double handling with popovers). Errors are `role="alert"`; busy and info are `role="status"` (good). 12 s auto-dismiss for errors cannot be paused by keyboard focus (pointer hover only). | Pause the timer on `focusin`. |
| 34 | L | Preview colour | Genesis `.form-tile__kind` uses uppercase and tracking, against the "no uppercase" panel rule. | Align or document the exception. |

## 2. State matrix: which states exist, where

Legend: Y = defined in shared CSS; T = only in some tool CSS; `-` = not defined.

| Component | hover | active (pressed-down) | focus-visible | disabled | selected / pressed | armed |
|---|---|---|---|---|---|---|
| `.org-btn` + aliases (`.mini-btn`, `.icon-btn`, `.upload-btn`, `.panel-btn`) | Y | - | Y only inside header, popover, `#panel` | Y | Y (`aria-pressed`, `.on`, `.active`) | - (tool-local) |
| `.org-floatbar__btn` | glyph opacity + pill | - | opacity + pill only, no ring | Y (0.35) | Y (`aria-pressed`, `aria-expanded`) | Y (colour only) |
| `.seg-btn` | Y | - | via `#panel` | Y (tunesutra) | Y (`aria-pressed` or `.active`) | - |
| `.org-tabs` | Y | - | via `#panel` | - | Y | - |
| `.org-field` / `.panel-select` / `.panel-input` | Y (border) | - | border only, `outline:none` | Y | - | - |
| `input[type=range]` | Y | Y (grabbing) | Y (track) | Y | - | - |
| checkbox / `.org-switch` | Y | - | Y | Y | Y | - |
| `.preset-trigger` / `.preset-item` (select-picker) | Y | - | via `#panel` (menu is outside) | Y (row hidden) | Y (`.on`) | - |
| `.org-layer-card` | - | - | - | - | Y (`.active`) | `.chan-armed` (colornet, swap) |
| `.shape-thumb` / `.mark-thumb` / `.form-tile` / `.fvs-thumb` | T | - | T (fvs only) | - | `.active` / `.selected` | - |
| mega menu link | Y | - | Y | - | Y (`aria-current`) | - |
| account item | Y | - | Y | Y | - | - |
| `.org-notice__close` | Y | - | Y (header only) | - | - | - |
| `.org-popover` | n/a | - | Y | - | n/a | - |
| chips (`.rmx-*`, `.root-chip`, `.fg-chip`) | T | - | Y (palette.css) | T | `.active` | - |

Gaps: no `:active` on buttons; no focus ring on floatbar; ring scoped by ancestor, not by component; selected-state vocabulary diverges; no armed state in `.org-btn`.

## 3. Behaviour patterns used but undocumented (or documented only in CLAUDE.md or tool notes)

1. Armed two-click delete (Genesis, Living Path, Apostate, admin, TuneSutra leave-guard).
2. Preset save and delete UI (inline row, naming rules, built-in protection, overwrite).
3. Keyboard shortcuts: Space (play), ⌘Z (undo), `k` (kiosk), Delete/Backspace, ⌘+/-/0 (zoom), arrows in the glyph editor, Space-drag to pan (FVS), Shift-click multi-select, Enter/Escape in inline name fields.
4. Drag and drop: file drop zone, layer reorder (Living Path), anchor drag, marquee (Rhizome), handles (FVS, Loom `.track-handle`).
5. Zoom/pan contract: wheel zoom, drag pan, double-click reset, HUD, `panAlways`.
6. Progress and busy: progress bar, spinner overlay, scrim and pill, busy Notice, Stop button convention.
7. Empty states and "built-in cannot be deleted" messages.
8. Disclosure (`<details>`, collapsible categories).
9. Floatbar contents: order, verbs, transport naming, flyouts (`.fvs-flyout__tool`), the type-tester group.
10. Inline editing: number value scrub/type (documented in Slider), inline rename (Genesis sets, FVS), inline name field.
11. Tooltips: `.info-tip`, `title` policy.
12. Confirm and guard dialogs: none (no shared one); `prompt()` and `alert()` remain.
13. Unsaved-changes handling.
14. Reduced-motion policy for rAF tools.
15. Hover-reveal controls (`.fvs-thumb-quicksave`, `.fvs-layer__del`): focus-visible exists in FVS; no touch or `:hover` media guard (the app is desktop-only, so low risk).
16. Selected-state contract (see #14).

## 4. Accessibility summary

- Accessible names: good. `autoLabelPanel` is called in 29 files. Static icon-only buttons without a name are only colour-swatch rows, which `autoLabelPanel` names. Exceptions: Sinew JS-built buttons (#23).
- Roles: `role="toolbar"` is on all floatbars. Dialogs: 4 with `aria-modal`. Almost no `role="tab"` / `listbox` / `menu` (the select-picker and seg controls would need them).
- Live regions: Notice (`alert` / `status`) and a few `aria-live` (camo, fvs 3, living path 2, mycel, gallery, sign-in). OK.
- Keyboard: findings 1, 2, 5, 7, 9. Roving tabindex or arrow keys exist only in the pattern switcher (and glyph editor).
- Contrast: findings 8. Body tokens are fine (`--mid` 6.03 on white, `--border-strong` 3.65, `--danger` 6.79 light / 6.1 dark). Floatbar glyph at 60% opacity is about 5:1 on white, OK.
- Reduced motion: finding 17.
- Zoom override: finding 4.
- Images: 4 `<img>` without `alt` in static HTML (camo-turing, colornet, fvs, 1 each). VERIFY if decorative.

## 5. Gaps: what `design-system/index.html` does not document but the suite uses

Current sections: Typography, Color tokens, Dark mode, Prose, Section/H2, Spacing, Radius, App shell, Canvas area and stage, Modal, File input, Layer card, Panel shell, Section/sub-label, Row/label/value, Slider, Checkbox and switch, Fields, Palette chips, Thumbnail select picker, Segmented control, Seeds panel, Buttons, Header, Account, Mega menu, Pattern switcher, Sign-in, Floating toolbar, Popover, Notice, Spacing and layout utilities, File architecture, Palette contract, Adding a token, Common mistakes, AI governance, Test gallery, Self-check. Only one "States" table exists (checkbox, line 1010).

| Missing entry | Used in (files) |
|---|---|
| State matrix per component (hover, active, focus, disabled, selected, armed) | whole suite (section 2 above) |
| Armed / confirm-delete | `genesis/index.html` l.1102, 1738; `livingpath/index.html` l.157, 1361; `apostate/index.html` l.2627; `admin/index.html` l.173; `tunesutra/index.html` l.1663 |
| Preset bar (select-picker + Save/Delete + inline name row + built-in protection) | `halide`, `pollen`, `warping`, `komorebi`, `radial`, `camo-turing`, `mote`, `mycel`, `tunesutra`, `_template.html` |
| Tile / thumbnail grid (`.shape-thumb`, `.mark-thumb`, `.form-tile`, `.fvs-thumb`, `.fg-thumb`) and its selection state | `shared/seeds-panel.css`, `pollen`, `spore`, `genesis`, `fvs` |
| Chip (`.rmx-slot`, `.root-chip`, `.fg-chip`, `.bar-seg`) | `pollen`, `mycel`, `fvs`, `tunesutra` |
| Remove / reorder icon buttons in list rows | `colornet`, `camo-turing`, `sinew`, `genesis`, `fvs`, `livingpath` |
| Collapsible section / disclosure | `livingpath`, `apostate`, `sinew`, `fvs`, `mote` |
| Progress bar / busy overlay / spinner | `pollen`, `spore`, `mote`, `livingpath`, `shell.css` `#compute-bar` |
| Empty state | `fvs`, `colornet`, `rhizome`, `admin`, `shared/select-picker.js` |
| Tooltip and info-tip, `title` policy | `shared/floatbar.css`, `camo-turing/index.html` l.151 |
| Drop zone (`.drag-over`, `#drop-hint`, `canvasDropZone`) | `shared/canvas.js`, `shell.css`, 12 tools |
| Zoom/pan and HUD (partly in Canvas area) | `shared/core.js` `createZoomPan`, `shared/canvas.js`, `#zoom-hud` |
| Keyboard shortcuts table | section 1 #27 |
| Floatbar order and verb list; transport controls; flyouts; type-tester group | `shared/floatbar.css`, all tools |
| Mode nav (`.org-tabs` as page navigation, Genesis Library/Create) | `genesis/index.html`, `fvs/index.html` |
| Status / error text inline (`gallery-status`, `symgrid-gen-error`, `.library-empty` used as error) vs Notice | `fvs/index.html` |
| Kiosk mode | `mote/index.html` |
| Reduced-motion policy | section 1 #17 |
| Focus ring spec (one ring, not per ancestor) | `header.css`, `panel.css`, `shell.css`, `palette.css`, `seeds-panel.css` |
| Hover tiers | section 1 #15 |
| Unsaved-changes guard | `tunesutra/index.html`, Genesis Create |
| Colour-in-chrome for node graphs (Rhizome port-type colours) | `rhizome/js/port-types.js` |
| Rhizome / Loom canvas controls (handles, track handles, wires) | `rhizome/js/canvas`, `loom/index.html` `.track-handle` |
| Number scrub / inline rename (partly in Slider) | `shared/core.js` l.1001-1023, `genesis/index.html` |

## 6. Suggested sequence

1. Quick wins (a day): add the floatbar focus ring (#7); remove `title` on floatbar buttons (#13); fix Sinew labels (#23); add Space-guard for buttons (#9); drop the global ⌘± override (#4); change `deletePreset` in `_template.html` and add the armed helper (#10, #11).
2. Shared components (a few days): segCtrl ARIA sync (#3); thumb-as-button (#1, #2); select-picker keyboard and ARIA (#5); popover registry (#6); `Organica.modal` (#18); `Organica.armed` (#11); focus-ring token (#8).
3. Design-system pass: add the section-5 entries, starting with the state matrix, selected-state contract, armed, preset bar, keyboard table, floatbar order, reduced-motion policy.
4. Tool passes: reduced motion in the rAF tools (#17); preset UI unification (#12); promote duplicated CSS (#31); Loom and Rhizome token cleanup (#32).
5. Lint: extend `scripts/css-lint.py` and `scripts/check.py` with (a) `<div onclick>` and `role="button"` without `tabindex`, (b) buttons whose only text is `×` / `↑` / `↓` / `+` without `aria-label`, (c) `title=` on `.org-floatbar__btn`, (d) `prompt(` / `alert(` / `confirm(`, (e) `prefers-reduced-motion` missing in files that call `requestAnimationFrame`.

## 7. Not verified

Safari and Firefox behaviour; whether each rAF tool autoplays on load; modal focus behaviour at runtime; whether FVS autosaves drafts; image `alt` intent; trackpad zoom feel. All other numbers above come from the static source.
