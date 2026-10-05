# Colour & naming audit (Oct 4, 2026)

HEAD `491eb47`. Read-only audit + design-system CONSULT, plus two pieces of research: the
colour picker, and how TuneSutra's palettes reach the tools. The decision sheet with live
previews of every tool's colour section is **`/design-system/_colour-audit.html`** (linked from
`/design-system/#open-audits`); this file is the written record. The 49 decisions are open in
`docs/DESIGN-DECISIONS.md` §1 as **O-20 … O-23**; the naming answers become
`docs/UI-COPY.md`.

Method: three read-only agents (per-tool colour inventory, naming inventory, design-system
AUDIT + CONSULT) and two research agents (picker: web sources; TuneSutra link: code). The
live previews were checked in the browser: 26 panel sections in 19 tools, each clipped to the
right `<h3>`, light and dark. `ds-audit.py --diff` exit 0, `check.py` passes. Not verified:
Safari / Firefox, real keyboard focus-visible, the library menu inside an open popover (read
in code only).

## 1. Headline

The one colour component **already exists**: `Organica.palette.swatch` in two shapes —
**attach** (a labelled row: 19 tools, 37 rows) and **generate** (the RMX chip strip: 8 tools)
— plus two opt-ins (the `palette.pick` library menu; `opts.pattern`, FVS Paper only). We
converge by extending it. Four problems:

1. **Four kinds of colour control live outside it**: the bare well in layer / channel cards
   and variant rows (Camo Turing, Colornet, FVS, Trellis); "choose one of the current inks"
   (4 UIs inside FVS); the colour-mode / mapping block hand-copied in 5 tools (Pollen, Spore,
   Camo Turing, Mote, Membrane); TuneSutra's editor (one consumer — stays local).
2. **Accessibility**: an invisible tab stop in every row (the native input, `opacity:0`,
   `tabIndex 0` — 4 stops per colour); swatch / input / hex share one name ("Ink" ×3 in 12
   tools); Colornet and Murmur show "Paper" but announce "Background colour"; chips expose the
   active state as a class only; `.rmx-x` / `.rmx-add` lack `type="button"`; the library menu
   neither sends nor listens to `organica:dropdown-open`; well 18×18 and chip ✕ 13×13 are
   under `--hit-min` (24).
3. **The live reference does not show what runs**: `/design-system/` has static markup for
   the row (no wrap, no input, no library button) and static chips.
4. **Names disagree**: foreground Ink / Point / Mark / Dots; ground Paper / Background / BG /
   Color; 6+ section titles; Color / Colour.

## 2. Patterns in use

| | Pattern | Tools | On the component |
|---|---|---|---|
| A | Single row: label + well + hex + library | 18 tools | yes |
| A+ | Row + accessories — dice (Pollen, Camo, Membrane, Vortex), pattern + transparent (FVS Paper), hidden hex (Trellis tracks) | — | yes (options) |
| B | Foreground / ground pair (A×2); swap in Pollen, Halide (button), Living Path (floatbar) | most | yes, swap local |
| C | N fixed role rows: Komorebi Sun / Sky / Ground / Shadow; Blob Boundary Background / Mask / Dots | 2 | yes |
| D | Chip strip: 2–5 (Spore, Pollen, Camo, Membrane), 2–8 (Mote, Vortex), 1–8 (FVS, Trellis), 3–7 library off (TuneSutra), gradient stops 2–5 | 9 | yes |
| E | Colour mode + mapping: segmented (Pollen, Camo, Mote), button grid (Spore), select (Membrane) | 5 | ✎ hand copies |
| F | Choose a palette index (FVS ×4, TuneSutra System) | 2 | ✎ |
| G | Visible native input (FVS variants, Figure, custom cell colour — 3 identical CSS rules) | 1 | ✎ |
| H | Well in a layer card (Camo layers, Colornet channels + CMYK readout) | 2 | ✎ |
| I | Full editor hex + RGB + HSB + CMYK + name + lock | TuneSutra | ✎ |
| J | Two animated colours A → B (Colour cycle track) | Trellis | yes, hidden-hex trick |

No colour controls: Loom, Undertow, Dapple, Apostate, Mycel, Rhizome (`color` port type
unused), Genesis (`genesis-creator.js` is dead code), Gallery, Hub.

## 3. Per-tool notes worth keeping

- **Spore**: modes as a `.cm-btn` grid (Solid / Adaptive / Image / Multi / RMX, local CSS);
  the only tool with the label after the hex (`.ctrl-label`); rows "Mark" / "BG".
- **Pollen**: rows "Point" / "BG", "Swap colors", Alpha 0–255; `.rmx-slot*` are *shape* slots
  under the colour prefix.
- **Halide**: background fill row labelled just "Color"; transparent paper is a checkbox.
- **Camo Turing**: the mapping select is labelled "Palette" and sits before the chips; its
  hint equates Solid with "Duotone"; layer wells hand-wired (`.layer-dot`).
- **Membrane**: "Color mode" select (Single ink / Rainbow / Sample from image / RMX); RMX on
  its own `rmxColorAt` — "Posterize" there (and in Camo's GLSL, floor) differs from
  `palette.colorAt` (round) in Spore / Pollen / Mote.
- **Mote**: "Adapt"; mapping options lower case with other words ("tone (lerp)",
  "tone + jitter"); hides nothing in RMX.
- **FVS**: Colour by / Start at, Colourways, layer ink popover (`.fvs-ink-pop`, outside
  `Organica.popover`), cell colour select + custom native input, variant rows with native
  inputs.
- **TuneSutra**: colour row labelled "Hex", input before the button, swatch wired twice
  (`onclick` + listener); `.rmx-x` / `.rmx-add` re-declared because `.rmx-add` cannot read the
  `--rmx-cell-*` tuning variables.
- **Colornet**: channel wells + CMYK readout; "Shuffle" reorders channels, "Random Colors"
  randomises them.
- **Trellis**: Colour cycle A/B made of two attach rows with `<input type=hidden>` as the hex.
- Hex `maxlength` missing in Komorebi, Warping, Radial, Mote, Murmur, Colornet, Blob Boundary,
  Trellis. Sinew links `palette.css` unused. Local `toHex` / `hexToRgb` in Pollen, Warping,
  Komorebi, Membrane.

## 4. Proposal — one component, five variants (CONSULT)

```js
Organica.palette.control(target, {
  kind: 'single' | 'well' | 'inks' | 'stops' | 'pick',
  role: 'ink' | 'paper' | '<custom>',   // visible label + every accessible name
  label, value | values, min, max,
  from: () => hexes, custom: true,       // 'pick' only
  modes: ['solid','adaptive','inks'], mapping: true,   // 'inks' only (D8)
  accessories: { library: true, random: false, none: false, pattern: {…} },
  onChange(value, detail), onCommit(value)
}) → { el, get, set, getColors, setColors, setActive, setPattern, destroy }
```

`swatch()` stays as an alias (string → `single`, element → `inks`); ids and preset keys never
change. Shared parts: the well (one tab stop; native input `tabindex=-1` + `aria-hidden`),
the hex field, accessories as `.org-btn--icon`. Buildable from JS as well as attached.

| Variant | Maps today's | Migration |
|---|---|---|
| `single` | every `.color-row` (19 tools, 37 rows) | easy — fixes inside `palette.js` |
| `well` | Colornet channels, Camo layers, FVS Figure / variants / custom cell, Trellis A/B | easy–medium; deletes 3 FVS rules + Trellis's trick |
| `inks` | the RMX strip; the mode block (D8) | strip as is |
| `stops` | TuneSutra gradient stops | `inks` + `ordered:true` |
| `pick` | FVS's 4 "choose ink" UIs | D9 — one tool today |

**Fixes that need no decision**: `.rmx-add` reads `--rmx-cell-*` (then TuneSutra's local
rules and two `css-lint.py` exceptions go); library icon via `Organica.icons.get('grid')`
(today a pasted SVG string, `palette.js:354`); `type="button"` on chip buttons; native input
out of the tab order; Colornet / Murmur label = name; hex `maxlength`.

**Paper + pattern** (`opts.pattern`, FVS only): the Pattern icon is appended to the row and
moves the tool's own panel under it; the component shows / hides it and reports on/off, the
tool draws the pattern (live demo on the audit page §2). Measured: with three accessories on
the FVS Paper row (Transparent, library, Pattern) the hex field is **42px** wide and cuts
"#ffffff" — the component should own the accessory slots and keep the hex readable.

**Contract for the migration**: both themes contrast-checked; one tab stop per well; names
follow the role ("Ink colour", "Ink hex"); active chip `aria-pressed`; one dropdown open at a
time; no raw px in shared sheets; `data-armed` on chip remove once `Organica.armed` has its
icon-only form; `ds-audit.py --diff` exit 0. **Docs once it ships**: `SHARED-COMPONENTS.md` §2,
`UI-SHELL.md` "Colour controls", `DESIGN-SYSTEM.md` §5 (vocabulary), a live
`/design-system/#colour-control` entry replacing the static specimens.

## 5. The colour picker

**Today**: every colour opens the browser's native picker. The 18×18 swatch forwards its
click to a hidden `<input type=color>` (`palette.js:150`, `cp.click()`); chips wrap a real
input in a `<label>`; `.color-swatch-wrap` exists only so the invisible input sits under the
swatch (Chrome anchors its popup to the input). Only `input` is listened to (no commit, no
clean Undo step). Values: 8-bit sRGB hex — no alpha, no OKLCH, although `shared/color.js` has
every OKLCH conversion, gamut mapping and contrast. 49 static colour inputs in ~20 tools.

| Browser | What the user gets |
|---|---|
| Chrome / Edge · macOS | the system Colors window (NSColorPanel): floating, not anchored, eyedropper, alpha hidden |
| Chrome / Edge · Windows, Linux | Chromium's anchored popup: SV field, hue, eyedropper, HEX / RGB / HSL |
| Safari · macOS | a swatch popover + "Show Colors…"; `alpha` / `colorspace="display-p3"` since 18.4 |
| Firefox | macOS NSColorPanel · Windows Win32 ChooseColor · Linux GTK |

Limits: sRGB only; no perceptual model; OS-owned, unthemable, different everywhere; library /
recents / contrast cannot live inside it; fragile opening (`showPicker()` is the sanctioned
API, Baseline 2022); no commit. Platform: `<input type=color alpha colorspace>` ships in
Safari 18.4+ only (Oct 2026); EyeDropper is Chromium-only.

**Best pickers** (judgement from Figma, Illustrator / Photoshop, Adobe Color, Procreate,
Affinity, Coolors, oklch.com, Material / Radix / Tailwind scales): swatches first; recent
colours; live while dragging + commit on release; paste any CSS colour; perceptual sliders
with the gamut edge; contrast against the ground; old / new chip; eyedropper where it exists;
few modes.

**Libraries** (framework-free): vanilla-colorful (2.7 KB, MIT, ARIA, `::part`, no OKLCH — the
best reference); Coloris (~8–10 KB est., MIT, swatches, dark theme, attaches to text inputs);
Pickr (frozen); iro.js (MPL, hiatus); Web Awesome / Spectrum (bring Lit and a second design
system).

**Recommendation**: our own popover picker on `shared/color.js` + `Organica.popover` —
palettes + recent row on top, a 2D field + hue strip (HSB default, OKLCH toggle with the gamut
edge from `color.maxChroma`), hex paste, contrast chip vs Paper, old / new, EyeDropper on
Chromium, "System picker…" → `showPicker()`. ~6–10 KB, no dependency, ~1–2 days + ~1 day of
cross-browser testing; keyboard pattern after vanilla-colorful. Same `onChange` contracts +
`onCommit`. Quick fixes worth doing even if the native picker stays: `showPicker()` with
`click()` fallback, `change` for commit / Undo, paste any CSS colour in the hex field. New
component → design-system CONSULT before building.

Sources: MDN [input color](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color),
[showPicker](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/showPicker),
[colorSpace](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/colorSpace);
caniuse [alpha](https://caniuse.com/wf-input-color-alpha), [EyeDropper](https://caniuse.com/mdn-api_eyedropper);
[WebKit, Safari 18.4](https://webkit.org/?p=16900); [WebKit Mac picker](https://webkit.googlesource.com/WebKit/+/23815488d103a0b772876fb72814e43e488a88fd);
[Chromium review](https://codereview.chromium.org/2534063003);
[Firefox QA](https://m.wiki.mozilla.org/QA/Desktop_Firefox/input-type-color), [bug 1666714](https://bugzil.la/1666714);
[vanilla-colorful](https://github.com/web-padawan/vanilla-colorful), [Coloris](https://github.com/mdbassit/Coloris),
[Pickr](https://github.com/simonwep/pickr), [iro.js](https://github.com/jaames/iro.js),
[Web Awesome](https://webawesome.com/docs/components/color-picker/);
Evil Martians on [OKLCH](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) and
[its tools](https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools);
[Figma OKLCH request](https://forum.figma.com/suggest-a-feature-11/support-oklab-and-oklch-8257).

## 6. TuneSutra → tools

**Today** (facts, from the code):
- Palettes live in `Organica.store('tunesutra')`, **keyed by name** (Supabase key
  `(user, tool, name)`, `shared/store.js:31`): `colors[]`, `names[]`, `ids[]` (stable
  `c-xxxxxx` per colour, `tunesutra/index.html:465`), locks, harmony, gradient, system. **No
  stable palette id**; renaming = a new record. Roles are positional (Base, Secondary,
  Accent…, `:431`); **no Paper / Ink role**. `color.roleShares` (3 colours = 51 / 31 / 18 %).
- Exports: CSS `--tunesutra-<name>-<step>` (0–900), DTCG JSON `<name>.<step>` (no role layer),
  gradient PNG / SVG, plates. The System view proposes chrome tokens but is never loaded at
  runtime, by design (`:961-965`).
- `palette.library()` reads the local cache synchronously (user palettes + 3 combinations +
  21 Riso inks); `palette.pick()` pulls once per page; **only the hex is kept** (`:156`,
  `:248`). Presets store plain hex.
- A palette edited later: nothing happens in the tools. No `storage` listener, no
  `BroadcastChannel`; `store.onSync` is same-tab only — a tool already open does not see a new
  palette until reload.
- The 3 built-in combinations are re-typed in `palette.js:319-323` and
  `tunesutra/collections.js` (different ids), held together by a comment. `fvsField.palettes()`
  is the only consumer that resolves roles (by contrast).

**Options**: A copy, better (whole-palette "Use palette" through a role map) · B linked by
reference (`{ref:{palette, colour|role, step?}, hex}`, Linked / Detached / Missing, export
always uses the resolved hex; needs a stable id) · C explicit roles + per-tool role maps · D a
suite (active) palette, as the picker's first entry or auto-followed · E DTCG interchange +
a Rhizome Palette node · F scale steps as references.

**Recommendation (phased)**: 0 — stable palette id, generate or test the combinations mirror,
refresh the library on `storage` / focus. 1 — A + light C: "Use palette" fills a tool by
roles, copied by value (presets and exports byte-stable), the TuneSutra palette pinned on
top. 2 — B opt-in, piloted in FVS + Pollen. 3 — DTCG import, Rhizome node, step references,
as needed. The System view stays a proposal.

## 7. Names

Full inventory and the 16 naming decisions on the audit page §10. Biggest conflicts:
**Format** (file type · canvas aspect · codec), **Seed** (number · shape · initial
conditions), **Render** (compute · look section · video export · stroke), **Scale** (export
multiplier · colour scale · noise scale), **Reset** (zoom · restart · everything · controls),
**Palette** (section title · strip label · mapping select · saved set), **Invert** (image
luminance · swap ink / paper), **Shuffle** (reorder, read as random). Also: background has 5
names, presets 6, the Loom-grid import 7; Color / Colour and Randomize / Randomise both in
use; Title Case strays; two Italian strings in the UI (Genesis, `pathfx.js`). The agreed terms
go into `docs/UI-COPY.md`; the design-system agent applies them as content designer.

## 8. Decisions

49, on `/design-system/_colour-audit.html` §9–§10, each with a recommended first option:
D1–D12 component (CONSULT) · P1–P8 picker · T1–T13 TuneSutra link · N1–N16 names. Ledger:
O-20 … O-23.

## 9. Applied — the fixes that needed no decision (Oct 4, 2026)

| Fix | Where |
|---|---|
| `.rmx-add` reads `--rmx-cell-border` / `--rmx-cell-radius` and does not shrink; the tuning variables are set on the strip so chips and the add / library buttons follow them | `shared/palette.css` |
| TuneSutra: no local `.rmx-*` rule; `--rmx-cell-*` set on `#rmx-palette, #grad-stops`; its three `css-lint.py` allow entries removed. Measured after: 30×26, radius 2px, `--border-strong` (unchanged). Visible delta: the ✕ is the shared one (corner, square) | `tunesutra/index.html`, `scripts/css-lint.py` |
| One tab stop per colour: the native input gets `tabindex=-1` + `aria-hidden` when a swatch button forwards to it (left reachable when there is no swatch) | `shared/palette.js` attach mode |
| Names "‹Label› colour" (swatch) and "‹Label› hex" (field) from the row's `.color-name`, unless the tool named them (`docs/UI-COPY.md` rule 6); not on a hidden hex; a row already called "Color" is not "Color colour". Spore / Pollen read "BG colour" until D3 | `shared/palette.js` attach mode |
| `type="button"` on `.rmx-x` / `.rmx-add`; the chip `<label>`'s duplicate name removed | `shared/palette.js` generate mode |
| Library icon from `Organica.icons.get('grid')` (the literal kept only as a fallback) | `shared/palette.js` |
| Library menu: joins `organica:dropdown-open` (closes when another dropdown opens and closes the others; a colour row inside a popover would close it — none today), arrow / Home / End keys, Tab closes | `shared/palette.js` |
| Colornet, Murmur: the Paper row is announced "Paper colour" / "Paper hex" (section titles wait for D3 / D4) | `colornet/index.html`, `murmur/index.html` |
| `maxlength="7"` on every hex field | Komorebi, Warping, Radial, Mote, Murmur, Colornet, Blob Boundary, Trellis, TuneSutra, `shared/_template.html` |
| Unused `palette.css` link removed (`design-system/templates.json` regenerated) | `sinew/index.html` |
| `toHex` → `Organica.rgbToHex` (identical clamp + round); `hexToRgb` → `Organica.hexToRGB255` | Warping, Komorebi, `membrane/js/color.js` |

**Left on purpose**: Pollen's `toHex` (truncates rather than rounds — changing it changes
output); the FVS Paper hex squeezed to 42px (how many accessories a row holds belongs to D1);
the "Posterize" maths in Membrane / Camo Turing (changes output — a decision); the active
chip's `aria-pressed` and the 24px hit area (D11 / D12, with the migration).

**Reviewed** by the design-system agent (PASS WITH NOTES; its notes applied). **Verified**: FVS regression 395/395; `check.py`; `css-lint.py` clean; `ds-audit.py --diff`
no raw values; browser — TuneSutra strip metrics, Colornet names / tab order / maxlength, the
library menu's keys and its closing when Export opens, Warping's SVG export; no console error
besides the dev server's favicon 404. Not verified: Safari / Firefox.

## 10. Decided since the audit

- **Oct 4, 2026 — FVS, Colour by → "Element's own colours" (first option, default).** A saved
  Element placed in a Symbol cell keeps the palette it was saved with (`cell.ownColors`):
  first ink for a shape, every layer's ink for a stack; any other rule colours every cell by
  that rule. Before, a saved Element took the Colour by colour of its cell. Replaced a
  same-day "Keep own colours" rail switch. `docs/FVS.md` §7, ledger §2, commit `8aec96d`.
- **Oct 4, 2026 — FVS, saved Element thumbnails show the Paper texture** (commit `37d1fc9`).
- **Oct 4, 2026 — FVS, saved Elements in a Symbol cell draw their own Paper + texture**
  (`ownPaper` / `ownAppearance`, under Element's own colours; commit `5181628`).
- **Oct 4, 2026 — FVS, a Symbol from saved Elements alone** when no Component is saved
  (Arrange from the latest 8; Suggest stays Components-only; commit `47bde38`).
- **Oct 4, 2026 — FVS, rectangular Components take their modular block** in a regular
  rectangular Symbol grid (cols × rows reduced; square = 1 cell; does not fit → one cell,
  reduced); Fit / Anchor / overflow measure the block (commits `d2a1d91`, `d160d2c`).
