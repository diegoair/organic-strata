# UI copy — the words on the interface

> Content-design rules and the glossary for every visible string in Organica: panel
> section titles, labels, buttons, options, placeholders, hints, status lines, toasts,
> `aria-label`s. Kept by the design-system agent (`.claude/agents/design-system.md`),
> decided by Diego. Started Oct 4, 2026, from the naming audit
> (`/design-system/_colour-audit.html` §8).

A label is part of the design system like a token: the same thing has the same name in
every tool, and one word has one meaning. A wrong or drifting label costs the same refactor
a raw hex does — it just shows up in a user's head instead of in the CSS.

## 1. Rules

1. **One concept, one word; one word, one meaning — across the whole suite.** Before naming a
   control, look the concept up in §2. If the word you want already means something else
   (see the conflicts in §3), pick another.
2. **Name what the user gets, not how the code does it.** "Paper", not "bg"; "Colour by",
   not "Mapping"; no internal ids (`rmx`, `cp-bg`) as text.
3. **Sentence case** for every control, title and option ("Save to library", "Random
   colours"). Capitals only for proper nouns: tool names, and the FVS / Genesis domain
   nouns when they name the object (Seed, Element, Component, Symbol, Figure).
4. **English, one spelling.** No Italian strings in the UI. UK vs US spelling: *pending*
   (D5 / N9) — until decided, do not introduce a new spelling that differs from the rest of
   the same tool.
5. **Whole words.** No "BG", "Med", "Adapt", "Stop rec", "col." — unless the abbreviation is
   the domain term (PNG, DPI, CMYK, OTF).
6. **The visible label is contained in the accessible name** (WCAG 2.5.3). A row labelled
   "Paper" is not announced as "Background colour". Prefer `Organica.autoLabelPanel` over
   hand-written names; when hand-written, use one pattern: "‹Label› colour", "‹Label› hex".
   (`Organica.palette.swatch` applies this pattern to every colour row since Oct 4, 2026.)
7. **Verbs for actions, nouns for settings.** A button says what happens ("Render",
   "Restart", "Export"); a row says what it sets ("Spacing", "Opacity").
8. **Same action, same verb**: Reset = back to defaults · Restart = run again from the
   start · Clear = empty it · Delete = remove for good (armed or held; a held button is named *‹Action› — hold to confirm*) · Open = the main source
   file · Add = one more item. (Matches the icon meanings in `CLAUDE.md`: refresh / reset /
   close / trash / eraser.)
9. **Units and ranges are consistent**: a percentage is 0–100 and says %; a seed is a number.
10. **Status and toasts**: past tense, what happened + what it is — "PNG exported",
    "Preset saved". Errors say what to do next.
11. **Changing a label never changes an id or a preset key** — saved work depends on them.

## 2. Glossary

Status: **Decided** (in the ledger, enforce it) · **Pending** (a question for Diego — do not
"fix" towards one option before he answers; flag the drift instead).

| Concept | Word | Status | Not | Where decided / asked |
|---|---|---|---|---|
| Generated alternatives to pick from (FVS Suggest, Figure) | **Variation** — *12 variations*, "Use variation 3: …" | Decided | proposal, option, combination, arrangement (Arrange = a fill mode) | Ledger §2, 2026-10-05 (O-25, delegated) |
| Put content into the empty Symbol grid (FVS) | **Fill the grid** (button); **Fill** = the panel section that says how (Suggest / Arrange / Manual / Rule) | Decided | Generate (a new grid, a Component set — elsewhere), Fill the Symbol | Ledger §2, 2026-10-05 |
| Content scaled to its cell, both axes (FVS Fit) | **Stretch** | Pending | Fill, Fill the cell | O-26 |
| FVS Element sections | **Shape**, **Look & place** | Decided | Seed, Appearance | Ledger §2, 2026-10-04 |
| FVS shape details | **Rounding**, **Rounding style**, **Dashes / Dash gap**, **Thickness**, **Bands**, **Hole** (Ring: **Opening**) | Decided | Corner radius, Corner rounding, End rounding, Arm width, Arc ratio | Ledger §2, 2026-10-04 |
| Paper (+ texture) | **Paper** = ground colour + its pattern (FVS) | Decided (FVS) | — | Ledger §2, 2026-10-03 |
| Foreground colour | Ink (role names allowed with ≥3 roles) | Pending | Point, Mark, Dots | D2 |
| Ground colour | Paper; Halide's replacement fill = Background fill | Pending | Background, BG, Color | D3 |
| Colour section title | Colour; "Palette" only for a saved set | Pending | Color, Palette, Tone… | D4 |
| Multi-colour mode | Inks | Pending | RMX, Multi | D6 |
| Mode set / assignment | Solid · Adaptive · Inks; Colour by: Tone · Posterize · Random · Tone + random | Pending | Adapt, Single ink, Mapping | D7 |
| File type in Export | Format (and only that) | Pending | — | N1 |
| Canvas size section | Canvas | Pending | Format, Resolution, Scene | N2 |
| Aspect presets | Square 1:1 · Portrait 4:5 · Vertical 9:16 · Landscape 16:9 · Widescreen 3:2 | Pending | Wide 16:9, Landscape 3:2 | N3 |
| Seed | the shape (Organica vocabulary); the number = Random seed | Pending | — | N4 |
| Render | the compute action only | Pending | Refresh; section titles | N5 |
| Scale | export multiplier; Noise scale; TuneSutra Shades | Pending | PNG scale | N6 |
| Reset / Restart / Fit / Clear | see rule 8 | Pending | Reset for zoom or restart | N7 |
| Saved settings | Presets · "Preset name" · Save | Pending | Scene, Look, Name this… | N8 |
| Random | Randomise; Shuffle = reorder only | Pending | Randomize | N9 |
| Loom grid import | Load Loom grid | Pending | 6 other wordings | N10 |
| Source file | Open … (image / SVG / font); Add … for one more item | Pending | Upload, Import | N11 |
| Transparency | Opacity, % 0–100 | Pending | Alpha 0–255 | N12 |
| Colour swap | Swap Ink / Paper; luminance = Invert image | Pending | Swap colors, Invert | N13 |

When Diego answers on the audit page, the DOCUMENT run moves the row to **Decided**, writes
the decision in `docs/DESIGN-DECISIONS.md` §2, and lists the tools whose strings must change.

## 3. Words that mean more than one thing today

Format · Seed · Render · Scale · Reset · Palette · Invert · Shuffle · Duotone · Zoom ·
Style · Resolution · Fill (FVS: put content in the cells — Decided; stretch content to the cell — O-26; Element paint Fill / Stroke — the vector term, a different object, kept) · Variation (FVS Figure's blob seed slider is labelled "Variation" — a number, not a generated alternative; to rename with N4) · Variant (Export *Variants* = size rows; a different word, keep them apart) — inventory with tools and lines on `/design-system/_colour-audit.html`
§8. A new control must not add a meaning to any of them.

## 4. How it is checked

- **CONSULT** gives a copy brief: the exact labels, options, placeholder, hint and
  `aria-label` for what is about to be built, from §2.
- **REVIEW** reads every added or changed visible string in the diff against §1–§2.
- **AUDIT** (scope "copy") re-runs the inventory: section titles, labels, buttons, options,
  aria, toasts, per tool.
