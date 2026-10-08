# FVS Figure step — right-panel copy audit

> AUDIT, scope **copy** (content design), Oct 7, 2026, by the design-system agent. Read-only on code.
> Asked by Diego: *"the right column of the FVS Figure step has many things not coherent with what we
> developed for Element, Component and Symbol"*. A parallel audit covers layout and components; this one
> covers the **words** only.
>
> Measured from source at `b87930d` (`main`, clean): `fvs/js/17-figure-graph.js` (the inspector
> `#fg-inspector`: `renderInspectorBody`, `setEditor`, `cellRulesEditor`, `renderComposeInspector`, the
> Export panel), `fvs/js/engine/17-figure-nodes.js` (node / port / param labels, summaries, variation
> captions), `fvs/js/engine/14-figure-ui.js` (`describeRule`), against the Element / Component / Symbol
> panels in `fvs/index.html` and `fvs/js/02…11-*.js`. Rules: `docs/UI-COPY.md` §1–§3; ledger
> `docs/DESIGN-DECISIONS.md` (the Figure vocabulary is **delegated to the content designer**, §2
> 2026-10-07: Figure-only wording can be settled without the owner; a rename that touches the
> Element / Component / Symbol steps or a suite-wide term is Diego's).
>
> **Not verified:** nothing was opened in a browser. Strings produced by `Organica.autoLabelPanel` and by
> `Organica.palette.swatch` were read from their code, not measured on the live DOM.

> **Status, Oct 8, 2026** (DOCUMENT run): the *Sev* column now ends with each row’s status — **done** (`2d5009e`, `21d968b`, `1706d27`, `cd00d90`, checked in the code), *open — O-nn* (a question for Diego, ledger §1), *queued* (no decision needed, ledger §4). §2 items 1–6 and 8 are O-40 … O-46; item 7 is N4 (O-23). **Oct 8, 2026 (later):** Diego answered all of them (ledger §2, “Figure panel audit questions O-40 … O-53 + N4 / N6 answered”); the words are in the code (uncommitted batch, REVIEW pass with notes) and in UI-COPY §1 rule 8, §2, §3. §3 docs: done (UI-COPY §2, Oct 8). §4 legacy: E/C/S *Colour by* / *Start at* names, Symbol *Size* / *Bleed (mm)*, *dpi*, *PNG sizes* — done in `cd00d90`.

## 0. The answer

About 170 visible strings and accessible names inventoried in 13 panel states (nothing selected,
multi-select, Canvas, Grid, Palette, Element / Component, Set, Cell rules, Component rule, Repeat in grid,
Rotate & mirror, Composition, Figure, Export, Compose). **37 findings**: 5 BLOCK-class (a word that
already means something else — rows 9, 10, 17, 18, 19), 16 FIX (same concept, different word or form than
the decided term or the earlier steps), 16 NOTE.

The incoherence Diego sees has four causes, in order of weight:

1. **The transform vocabulary forked.** The earlier steps say **Rotation** (select, 0°/90°/180°/270°) and
   **Flip** (*None · Horizontal · Vertical · Both*). The Figure panel says **Rotate**, **Mirror**
   (*No mirror · Right edge · Bottom edge · Both edges*), **Alternate flip**, *Flip H* / *Unflip H* (chips),
   and offers four different rotation option sets in four places (rows 1–6).
2. **Grid words drifted from the Component step's decided terms.** *Rings* where the Component step says
   **Grid size** (decided Oct 6), bare **Size** (forbidden, §2 "Grid size" row) on Repeat in grid,
   **Lattice** used for two different things, a bare **Seed** next to the Figure's own **Random seed**
   (rows 7–12).
3. **Colour words collide.** *From the library* (Library = the FVS saved-items view), three phrasings of
   "keep the content's own colours", an **Inks** heading over chips named *Palette colour n*, and a
   **Paper** that is colour only while FVS Paper is colour + pattern (rows 13–17).
4. **One chip word is wrong.** A rule that fills cells is shown as **"Seed"** — the option the user picked
   was *Filled*, and in FVS a Seed is a shape (row 18). This one is on every Cell rules chip, every
   Composition chip and every variation caption that shows it.

## 1. Findings

Severity: **BLOCK** = a word that already means something else (UI-COPY rule 1) — fix before more Figure
UI is built on it · **FIX** = the same concept named differently from a Decided term or from the
Element / Component / Symbol steps · **NOTE** = form, punctuation, tone, a11y detail.
"E/C/S" = Element / Component / Symbol steps. All paths under `fvs/`.

### 1a. Transforms (rotation, flip, mirror)

| # | Sev | State / node | Figure string (file:line) | E/C/S string for the same concept (file:line) | Proposed (rule) |
|---|---|---|---|---|---|
| 1 | FIX · **done** (O-46 *Rotation*, Oct 8; the Element layer card’s *Rot* row `index.html:367` and the Repeat card’s bare *90°* `js/17-figure-graph.js:167` still to follow) | Rotate & mirror; Repeat in grid | row label **Rotate** — `js/17-figure-graph.js:514`, `:518` | **Rotation** — Component Transform axes `index.html:1221`, Component Manual `js/06-component-ui.js:306`, Symbol Cell properties `index.html:1615` | **Rotation** (a setting is a noun, rule 7; same concept same word, rule 1). Node name *Rotate & mirror* stays (Decided). Card summary `:166` *Rotate 90°* → *Rotation 90°*; `No rotation` already right |
| 2 | FIX · **done** | Cell rules → *They get*; Compose quick buttons + *They get* | *Flip horizontal* · *Flip vertical* (`:607`, `:869`) but the chip says **Flip H** / **Unflip H** / **Flip V** / **Unflip V** — `js/engine/14-figure-ui.js:147` | *Flip* → *Horizontal · Vertical · Both* — `index.html:1620-1622`, `js/06-component-ui.js:311` | Chip: *Flip horizontal* / *Flip vertical*; the un-flip case *No flip* (whole words, rule 5; the chip must read like the option that made it) |
| 3 | FIX · **done** | Cell rules → *They get* | *Rotate 60° · Rotate 90° · Rotate 180° · Rotate by sector* — `:607` (no 270°, no 120°/240°/300°) | Symbol Cell properties *Rotation* 0/60/90/120/180/240/270/300° `index.html:1617`; Compose quick *Rotate 90° · Rotate 180°* `:869` | One option set for "rotate these cells": *Rotate 90° · Rotate 180° · Rotate 270°* everywhere, + *Rotate 60° · 120° · 240° · 300°* only on a triangle / hexagon grid (as the Symbol step shows them). Option sets are copy (rule 1): today a user finds 270° in Rotate & mirror but not in Cell rules |
| 4 | NOTE · **done** (O-42: *None · Over the right edge · Over the bottom edge · Over both edges*, Oct 8) | Rotate & mirror; Repeat in grid | **Mirror** options *No mirror · Right edge · Bottom edge · Both edges* — `js/engine/17-figure-nodes.js:268` | no equivalent: Mirror here **doubles** the figure over an edge (`js/engine/16-figure-eval.js:228`, 2 or 4 copies) — a different concept from Flip | Keep *Mirror* (it is not a flip), but the options name an edge, not a result: *None · Over the right edge · Over the bottom edge · Over both edges*. The word *Mirror* is also a Component rule (row 21) — see Diego item 3 |
| 5 | NOTE · not done — queued (ledger §4) | Repeat in grid | **Alternate flip** (checkbox) `:513`; card *alternate flip* `:164` | *Flip* (E/C/S); Paper tile *Turn: Alternate* `index.html:1397-1400` | *Flip every other copy* (says what the user gets, rule 2) |
| 6 | NOTE · **done** | Cards (Repeat vs Rotate & mirror) | Repeat card *… · mirror Right edge* `:164`; Rotate & mirror card *Mirror: right edge* `:166`; variation caption *Mirror: Right edge* `js/engine/17-figure-nodes.js:308` | — | One form: *Mirror: over the right edge* (lower case after the colon, as in `:166`) in all three |

### 1b. Grid, lattice, size, seed

| # | Sev | State / node | Figure string | E/C/S string for the same concept | Proposed |
|---|---|---|---|---|---|
| 7 | FIX · **done** | Grid (Hexagon lattice) | **Rings** 1–6 — `js/engine/17-figure-nodes.js:78`; summary *Hexagon lattice · 3 rings* `:92` | **Grid size** (1–4), hint *Cells along each side.* — Component Hexagon `index.html:1187`; UI-COPY §2 "Grid size" row lists **Rings** under *Not* ("id only") | **Grid size**, hint *Cells along each side.*; summary *Hexagon lattice · grid size 3*. Id `rings` unchanged (rule 11) |
| 8 | FIX · kept *Rows* (not re-measured) | Grid (Triangle lattice) | **Rows** 1–8 — `js/engine/17-figure-nodes.js:76` | Component Triangle grid shape → **Grid size** `index.html:1187` | **Grid size** — *if* the Figure triangle lattice counts the same thing (cells along a side; `triangleLoomModel(rows)`). Verify on screen before changing; if it really counts rows, keep *Rows* |
| 9 | BLOCK · **done** (O-41: *Copies per side · Tiers · Rows*, Oct 8) | Repeat in grid | count row **Size** (Square) / **Stack** (Tier) / **Rows** (Triangle) — `js/17-figure-graph.js:512` | UI-COPY §2 "Grid size": *Size (bare — Scale's Small / Medium / Large and export sizes already use it)* is a **Not**; Component **Grid size** `index.html:1187` | Square: **Copies per side**; Tier: **Tiers**; Triangle: **Rows**. (*Grid size* would be wrong here: it counts copies of the figure, not cells) |
| 10 | BLOCK · **done** (O-41: row *Repeat as*; *lattice* stays, Figure only, Oct 8) | Grid node; Repeat in grid; Component rule | **Lattice** for two things: the Grid node's FVS grids (*Triangle / Square / Hexagon lattice*, optgroup *Lattices — sized by their cells* `:452`, hint *Lays out a Square lattice up to 4 × 4.* `:508`) **and** Repeat in grid's tiling (*Lattice: Square · Tier · Triangle* `:511`) | E/C/S never show *lattice*: Component says **Grid shape** *Hexagon · Triangle · Diamond · Square* `index.html:1179-1185` | One word, one meaning: Repeat in grid's row → **Repeat as** (*Square · Tier · Triangle*) — Diego item 2; the Grid node keeps *lattice* only if Diego accepts it as an on-screen word (not in the glossary today) |
| 11 | FIX · **done** (Figure + Symbol, N4 Oct 8; the Figure’s render-time mapping removed — the label lives in `SYMGRID_GENS`) | Grid (Loom generators with a seed) | **Seed** — label from `SYMGRID_GENS` `js/engine/08-symbol-grid.js:292,294,300,301`, shown by `js/17-figure-graph.js:457`; the same panel family says **Random seed** (Figure `:547`, variation caption *Grid: new random seed* `js/engine/17-figure-nodes.js:317`) | Symbol grid generators: **Seed** (same registry); Symbol Rule / Suggest / Arrange: **Seed** + icon *Random seed* `index.html:1543,1565,1589` | In the Figure: **Random seed** (Decided for the Figure, §2 "Variations" row). Map the label at render (`:457`), not in the shared registry — changing `SYMGRID_GENS` renames the Symbol step too, which is N4 (pending, Diego). Variation caption *Seed 12* (from `changeGrid`, `:278`) → *Random seed 12* |
| 12 | NOTE · half — summary form done, cell-count hint queued | Grid summary (Figure foundation select, card) | *Square lattice 2 × 2* (no separator) vs *Hexagonal · 6 columns* — `js/engine/17-figure-nodes.js:89-92` | Symbol section hint *24 cells* `js/11-symbol-ui.js:144` | One form: *‹Label› · 2 × 2*, *‹Label› · 6 columns*. The Grid node panel shows no cell count, the Symbol and Component sections do (*24 cells*, `index.html:1145,1178`) — add *‹n› cells* as the Grid node's hint |

### 1c. Canvas

| # | Sev | State / node | Figure string | E/C/S string | Proposed |
|---|---|---|---|---|---|
| 13 | FIX · **done** | Canvas card, Figure foundation select, Figure card meta | **dpi** lower case — `js/engine/17-figure-nodes.js:70` (`canvasSummary`) | row label **DPI** (Figure `:433`, Symbol `index.html:1130`); Export summary *300 DPI* `js/engine/17-figure-nodes.js:389`; Symbol hint also *dpi* `js/08-symbol-grid.js:163` (same slip) | **DPI** in both summaries (domain abbreviation, rule 5) |
| 14 | FIX · **done** (Figure + Symbol) | Canvas (Screen / Print) — Figure and Symbol | visible **Size**, inputs named *Canvas width* / *Canvas height*; visible **Bleed (mm)**, named *Canvas bleed in millimetres* — `:431`, `:434` | identical in Symbol `index.html:1118-1121,1134-1135` (the Figure copied it) | Label ⊂ name (rule 6): *Size, width* / *Size, height*; *Bleed (mm)*. Fix both steps together |
| 15 | NOTE · queued | Canvas | **Bleed (mm)** while the Unit is *in* — `:434` | same, Symbol `index.html:1134` | Keep mm (bleed is stored in mm) but say it once Unit = in: hint *Bleed is always in millimetres.* |
| 16 | NOTE · queued | Canvas | **Margin** 0–25, no unit — `:448` | Symbol *Margin* `index.html:1139`, same | Show the unit: value *5 %* or hint *% of the short side* (rule 9, both steps) |
| 17 | BLOCK · **done** (O-43: *Figure’s own size*, stored id `'Fit to figure'` kept, Oct 8) | Canvas preset | option **Fit to figure**; card *Fit to figure — the page is the Figure’s own size*; panel hint *A Figure on a lattice takes its size from its cells. On a Loom grid it uses a square page.* — `js/engine/17-figure-nodes.js:48`, `js/17-figure-graph.js:140,429` | *Fit* already means how content sits in a cell (Symbol Fit select, *Stretch · Contain · Cover · Match cell*, `index.html:1625`; glossary "Match cell" row: *Fit = the select itself*); Element **Fit to canvas** button `index.html:1101`; N7 pending | Option **Figure’s own size**; card *The page is the Figure’s own size*; one hint for both places. Diego item 4 (it adds no new word, but N7 is his) |

### 1d. Palette, inks, paper

| # | Sev | State / node | Figure string | E/C/S string | Proposed |
|---|---|---|---|---|---|
| 18 | BLOCK · **done** | Cell rules chip, Composition chip, card summaries, variation captions | a *Filled* rule is shown as **Seed** — `js/engine/14-figure-ui.js:145` (`d.content === 'filled' → 'Seed'`); reached from Compose's *Filled* quick button via `describeComposeRule` `js/17-figure-graph.js:885` | the option the user picked is **Filled** (`:607`, `:869`; Symbol *Up cells / Down cells: Filled · Empty* `index.html:1461-1464`); **Seed** in FVS = the shape (UI-COPY §2 row "Variations", N4) | **Filled**. One-word change in `describeRule`; it also feeds the old Figure engine's labels — check `scripts/test-figure-graph.sh` for a string assertion |
| 19 | BLOCK · **done** | Palette | row + select **From the library**, placeholder *Choose a palette…* — `:461` | **Library** = every saved Element / Component / Symbol + Genesis seeds (UI-COPY §2, Decided Oct 6); every E/C/S colour row has the shared **Pick from a palette** button (`shared/palette.js:379`), switched off here by `library: false` (`:466`) | Rung 1: use the shared button (drop `library:false` on the Inks strip) and remove the select. If the select stays: label **Saved palette**, placeholder *Pick a palette…* |
| 20 | FIX · **done** (default: O-53) | Palette → Colour by | options include **Element’s own colours** (`COLOR_RULES.own`, `js/engine/00-core.js:78`) | same list in E/C/S Palette `index.html:1356` — there it is right | In the Figure the same idea already has two names: **Keep own colours** (Figure, Decided) and **None — content’s own colours** (Figure's Palette picker, Decided). A third phrasing that says *Element* when the content is a Component is wrong: hide `own` from the Figure Palette node's list (code: filter at `:469`) |
| 21 | FIX · pending D2 / D6 | Palette | **Inks** heading (`:463`) over chips named *Palette colour 1…* / *Add palette colour* / *Remove colour 1* (`shared/palette.js:231-251`); Figure foundation option *Palette 1 · 3 inks* `:530`; caption *Inks in another order* | E/C/S Palette: the chip strip has **no** heading (`index.html:1354`) | D2 / D6 (Ink / Inks) are **pending**: do not settle here. Flag only: within one control the heading and the chip names disagree. When D6 is answered, the chip names follow it (shared change) |
| 22 | FIX · **done** | Palette | **Colour by** only; no **Start at** | E/C/S: *Colour by* + *Start at* `index.html:1356-1361` | Same rows as the Palette section (*Start at* is a setting the Figure's colour rule reads: `rule.offset`, `js/engine/00-core.js:91`). Behaviour, not only words — for the layout audit too |
| 23 | NOTE · decided — O-45 yes (Paper pattern + *Transparent paper* on the Palette node), to build | Palette | **Paper** = a colour only (`:464`) | **Paper** = ground colour + its pattern (UI-COPY §2, Decided for FVS); E/C/S Paper row carries the Pattern icon + *Transparent paper* (`index.html:1365-1374`) | The word is right; the Figure's Paper is a smaller thing than the word promises. Diego item 6 (behaviour) |

### 1e. Rules (Component rule, Cell rules, Compose)

| # | Sev | State / node | Figure string | E/C/S string | Proposed |
|---|---|---|---|---|---|
| 24 | FIX · **done** | Component rule → Rule | **Mirror** — `js/17-figure-graph.js:62` | **Mirror (kaleidoscope)** — Component Rule `index.html:1249` | **Mirror (kaleidoscope)** — also keeps it apart from Rotate & mirror's *Mirror* (row 4) |
| 25 | FIX · **done** (O-40: *Cells A / Cells B* in both steps, *Swap A and B* kept, Oct 8) | Component rule → Checkerboard | **First cells** / **Second cells** (0°/90°/180°/270°) — `:505-506` | Symbol Rule → Checkerboard **Rotate A** / **Rotate B** + *Swap A and B (start on B)* — `index.html:1483-1490` | Two names for the same pair across steps. Diego item 1 (recommend the Figure's *First cells / Second cells* everywhere — nouns, say which cells; *Rotate A* is a verb on a setting) |
| 26 | NOTE · **done** | Component rule → Radial / Pinwheel / Mirror | **Start** (0°…270°) — `:500`, `:503` | Component step shows no control (it lists every start as a result); Symbol Radial has **Direction** *Clockwise · Counter-clockwise* `index.html:1513-1514` — matches the Figure's *Direction* ✓ | **Starting rotation** (says what it sets; *Start* alone reads as a verb) |
| 27 | FIX · **done** | Cell rules → Add rule | **Number** (0–99) — `:623`; rows / columns / cells are counted from 1, rings and sectors from 0 (`ruleFrom`, `:609`) | Compose names the same places *row 2, column 3*, *ring ‹n›* | Label by what was picked: *Row number · Column number · Ring · Sector · Cell number*; hint for Ring *Ring 0 is the centre.* |
| 28 | NOTE · **done** | Cell rules → Which cells | *Up cells · Down cells* offered on every grid — `:606` | Symbol: same options, with the hint *For triangular grids: …* `index.html:1459` | Same hint, or show them only on a triangle grid |
| 29 | NOTE · **done** (UI-COPY) | Compose → They get | optgroups *Cells · Colour · Symbol rule · Arrange · Pattern · Content* — `:908-913` | UI-COPY §2 Compose row lists the kinds as *Symbol rule · **Component rule** · Arrange · Pattern · Colour* | *Component rule* is not built as a region-rule kind; *Cells* and *Content* are built but not in the row. The glossary is false — docs to update (§3) |

### 1f. Set, Export, empty states, accessible names

| # | Sev | State / node | Figure string | E/C/S string | Proposed |
|---|---|---|---|---|---|
| 30 | FIX · **done** | Set → Add (nothing saved) | *Nothing saved yet — save a Component in the Component step first.* — `:582` | a Set takes Elements **or** Components; the Figure's own empty state says *save an Element or a Component in its step first* (`:528`, Decided) | *Nothing saved yet — save an Element or a Component in its step first.* |
| 31 | FIX · **done** (O-44: *Remove* + `close`, written into UI-COPY rule 8, Oct 8) | Set → item chip | **Remove ‹name› from the Set**, `close` icon — `:579` | Cell rules / Composition chips: **Delete rule ‹n›**, `trash` (`:619`, `:921`); rule 8 has no *Remove*; icons: `close` = dismiss, `trash` = delete; Component *Remove* (underlying component) `index.html:1345` | No verb today for "take it out of this list, keep the saved item". Diego item 5 |
| 32 | NOTE · **done** | Set → Add tiles | *Add ‹name›* — `:580` | node bar tiles *Add Element: ‹name›* / *Add Component: ‹name›* `:331` | *Add Element: ‹name›* / *Add Component: ‹name›* (an Element and a Component can share a name) |
| 33 | NOTE · **done** | Figure → Cells | **Fit in cell** — `:562` | Symbol **Fit** (visible) `index.html:1585,1625`, Arrange's `aria-label` *Fit in cell*; glossary "Match cell": *Fit = the select itself* | **Fit** (under the *Cells* sub-label it needs no qualifier). Options already match Arrange ✓ |
| 34 | NOTE · **done** (UI-COPY) | Figure → fan-out | **Variations per item**, hint *Each item of the Set gets its own variations. Off: the items are mixed over the cells.* — `:542` | — | New string, not in UI-COPY §2. Acceptable; log it in the Set row. Hint form: *Off, the items are mixed over the cells.* |
| 35 | NOTE · **done**, then superseded by N6 (Oct 8): **Resolution** in the Export node and both popover rows | Export | **PNG size** `:480` (Decided) | E/C/S Export popover **PNG sizes** `index.html:239`; *Transparent paper (all rows)* `:244` ✓ | The popover follows the Decided *PNG size* (one-word change, E/C/S side) |
| 36 | NOTE · **done** | Any node the Figure needs | protect hint *A Figure needs a Canvas — connect another one first.* — `:568` adds a full stop | Decided string has none (UI-COPY §2 "Graph view and removal") | Drop the added `.` (or add it to the Decided string — one form) |
| 37 | NOTE · **done** | Nothing selected → Figures list | button name = *Figure 1Canvas 1 · Grid 1 · Palette 1* (name and hint run together) — `:406` | — | `aria-label` *Show Figure 1 — Canvas 1 · Grid 1 · Palette 1*, or a space / separator before the hint span |

### What is already coherent (measured, no action)

*Screen · Print*, *Unit* (*mm · in*), *DPI*, *Margin* (label) match the Symbol Canvas section · *Colour by*
(the Figure's `aria-label` "Colour by" is better than E/C/S's *Colour rule*, row in §4) · Symbol rule names
in Compose = the Symbol step's `#sel-symbol-rule` options, verbatim · Pattern names = Paper pattern options
· Arrange names = the Symbol step's · *Stretch · Contain · Cover (no gaps) · Match cell* = Symbol Arrange's
Fit · *Direction: Clockwise · Counter-clockwise* = Symbol Radial · *Clip to cell* = the Symbol floatbar
toggle · every Export, Compose, Graph, Pin, Variation string = UI-COPY §2 Decided rows · typographic
apostrophes and the `…` character everywhere · `×` spacing (*1080 × 1080 px*, *×1*, *rows 1–2 × columns
2–4*) consistent.

## 2. Needs Diego

Each is a cross-step rename or a word the suite does not have yet. Answerable in a word.

1. **Checkerboard pair** — Component rule *First cells / Second cells* vs Symbol rule *Rotate A / Rotate B*
   (row 25). Recommend **First cells / Second cells** in both steps (Symbol's *Swap A and B* →
   *Swap first and second*). *Yes / keep both*.
2. **Repeat in grid's arrangement row** (rows 9–10) — *Lattice* already names the Grid node's FVS grids.
   Recommend **Repeat as**: *Square · Tier · Triangle*, count rows *Copies per side · Tiers · Rows*. And:
   is **lattice** an on-screen word at all (Grid node *Square lattice*, hint *Square lattice up to 4 × 4*)?
   Recommend yes, Figure-only, = "an FVS grid sized by its cells". *Yes / other*.
3. **Mirror** names three things (Component rule *Mirror (kaleidoscope)*, Rotate & mirror's doubling,
   E/C/S never) — accept two meanings kept apart by the qualifier (rows 4, 24)? Recommend yes.
4. **Fit to figure** (row 17) → **Figure’s own size** (keeps *Fit* for how content sits in a cell; N7).
   *Yes / no*.
5. **A verb for "take out of a list, keep the saved item"** (row 31: Set items; also Component
   *Remove* underlying component). Recommend **Remove** added to rule 8 with the `close` icon's second
   meaning written down, *or* the `trash` icon + *Delete ‹name› from the Set*. *Remove / Delete*.
6. **The Figure Palette's Paper** is colour only, while FVS Paper is colour + pattern (row 23). Should the
   Palette node carry the Paper pattern (and *Transparent paper*), as the Palette section does? *Yes / not
   now*.
7. **N4 in the Symbol step** (row 11): the Figure will say *Random seed* on its Grid node; the Symbol
   step's Grid generator, Rule, Suggest and Arrange rows still say *Seed*. Answering N4 moves them all.
   *(already open — N4)*.
8. **Rotation vs Rotate across the suite** (row 1): the Element's *Rotate* slider (`index.html:1097`)
   is a setting too. Recommend **Rotation** for every setting, *Rotate* only for actions (chips *Rotate
   90°*). *Yes / no*.

## 3. Docs to update (DOCUMENT run, after the fixes)

- `docs/UI-COPY.md` §2 "Node names" lists **Symbol**, **Arrange**, **Region rule** as node types; the
  registry (`js/engine/17-figure-nodes.js:439-484`) has none of them (Symbol content refuses with *A Symbol
  as content is not available yet*). Mark them *not built*.
- `docs/UI-COPY.md` §2 Compose row: region-rule kinds as built = *Cells · Colour · Symbol rule · Arrange ·
  Pattern · Content*; *Component rule* not built (row 29).
- `docs/UI-COPY.md` §2 Set row: add *Variations per item* + its hint (row 34).
- `docs/UI-COPY.md` §2 "Grid size" row: add the Figure Hexagon lattice once row 7 ships.
- `docs/UI-COPY.md` §3: *Lattice*, *Mirror*, *Fit* get their meanings once Diego answers items 2–4. — **done** Oct 8 (with *Rotation / Rotate*, *Seed*, *Scale*, *Resolution*).

## 4. Legacy, outside the Figure (one line each)

E/C/S *Colour by* select is named *Colour rule* and *Start at* is named *Colour rule start colour*
(`index.html:1357,1361` — label not in name, rule 6) · Symbol *Size* / *Bleed (mm)* names (row 14) ·
Symbol canvas hint *dpi* (row 13) · Export popover *PNG sizes* (row 35).

## 5. For the main session (code, after the decisions)

Figure-only, delegated vocabulary — can ship without the owner: rows 2, 3, 6, 7, 11 (Figure side), 12, 13
(Figure side), 18, 19, 20, 24, 26, 27, 28, 30, 32, 33, 36, 37. Then `python3 scripts/check.py`
(apostrophes), `scripts/test-figure-graph.sh` and `scripts/regression.sh` (row 18 changes a label the old
Figure engine also prints), and a design-system REVIEW of the diff. No id, param name or preset key
changes (rule 11): `rings`, `count`, `lattice`, `fit`, `mirror` values stay.
