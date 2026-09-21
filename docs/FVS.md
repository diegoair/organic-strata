# FVS — User Manual

> Organica · Flexible Visual System — Element → Component → Symbol → Grid
> Live: [theorganicalanguage.vercel.app/fvs/](https://theorganicalanguage.vercel.app/fvs/)
> Last updated: September 20, 2026

---

## 1. What FVS does

FVS is a **rule engine for visual patterns**, modelled on Figma's own
Elements → Components → Symbols chain. You author one small shape, then
compose it with rules — so a whole pattern stays coherent and every result is a
real symmetry, not noise. Everything is vector: one `<path>` per cell, the
preview **is** the export string, and PNG rasterises the same geometry.

Single-file vanilla HTML/CSS/JS (`fvs/index.html`), no build step.

---

## 2. The four steps

The step bar above the canvas moves along the chain; each step builds on the
one before.

| Step | What you make | Built from |
|---|---|---|
| **Element** | The Seed shape and how it is drawn | a Seed type, its extras, Appearance, Palette |
| **Component** | A small cell arrangement (2×2, 3×3, 4×4 or an imported Loom grid) | the Element, placed by a **rule** |
| **Symbol** | A larger grid whose every cell holds a Seed or a saved Component | a Square N×M grid (2–8) or a Loom grid |
| **Grid** | A Symbol, or a saved Component, tiled 2×2 / 3×3 / 4×4 / Loom | the previous step's output |

**Tile in Grid** (Component step) tiles the selected Component directly in the
Grid step without saving it first.

---

## 3. Element

- **Seed type** — Arc, Arc truchet, Blob, Chevron, Circle, Cross, Drop, Lens,
  Polygon, Rounded rect, Segment, Star, Triangle, Wedge (alphabetical), plus
  **Freehand** (draw with bezier anchors), **Custom** (an uploaded SVG) and
  Seeds picked from the **Creator library** (Genesis). Each type has its own
  *extras* — corner styles, curvature, outline, twist and so on — listed from
  one shared table (`Organica.shapes.EXTRAS`), the same one Genesis Create uses.
- **Appearance** — Style **Fill / Stroke**, Width / Length, **Scale, Move X/Y**
  and **⤢ Fit to canvas** (one-shot). **Inner seed** adds nested copies
  (Count, Ratio, Anchor).
- **Reset seed shape** (floatbar) puts the current shape's controls back to
  their defaults without touching Appearance or Palette.
- The strip above the frame shows the Element at 0/90/180/270° and each flip.

---

## 4. Palette and colour rules

- **Ink** — 1 to 8 colours (RMX chips); **Paper** is the ground for every
  gallery thumbnail, PNG and SVG.
- **Colour by** decides which ink each cell gets: cell order, Checkerboard, By
  row, By column, Diagonal bands, By quadrant; **Start at** picks the leading
  colour. *By quadrant* splits the grid at its middle — on a grid with an odd
  number of columns or rows the middle line runs through a cell, which joins the
  second half (the panel flags this).
- All colours are stored as lower-case 6-digit hex (`hexKey()` folds `#ABC` and
  case), because recolouring, plates and the paper strip work on the finished
  SVG by string.

---

## 5. Component rules

Generate produces a gallery of candidates; click one to select it.

- **Named rules** — Identity, Pinwheel, Mirror, Diagonal, Checkerboard, Row
  mirror, Column mirror, Radial, plus Lines, Oscillator, Random, Exhaustive and
  Manual. Every named rule reads each cell's column/row, so they work on **any**
  grid (2×2, 3×3, 4×4, Loom): Pinwheel steps rotation by `(col + 2·row) mod 4`,
  Mirror flips by column/row parity, Diagonal alternates `R` / `90−R`,
  Row/Column mirror flip by row/column parity. **Radial** needs an even × even
  grid (its centre falls between cells) and is greyed out otherwise. On a 2×2
  grid every rule gives exactly the original four-cell result.
- **Random / Exhaustive / Manual** stay four-cell shaped; Exhaustive is capped at
  512 and refuses cleanly above it.
- **Role** — a Component can be a *Container* or *Mask* over another saved one.
- **Undo** (floatbar, ⌘Z) — the last 20 Generate / Add / Clear / Tile / recipe
  steps of the gallery. It never touches the Seed.

---

## 6. Symbol

- Grid: a built-in or saved **Loom** grid, an uploaded grid JSON, or **Square
  N×M** (2–8).
- **Fill** — Manual (click cells; Shift-click or drag to multi-select), a
  generative **Rule** (Oscillator, Checkerboard, Rows, Columns, Radial, Wave,
  Random — lock-aware, with Reset & apply to all) or **Generate (seeded)**.
- **Choose content** — a Seed or a saved Component, with an *All / Seeds /
  Components* filter and an **Apply to all cells** switch.
- **Cell properties** — rotation, flip, fit, scale, padding, anchor, **Lock**,
  and **Colour**: *Follow palette* (default) or an explicit override (a palette
  colour or a free one). An override is flagged, and **Reset** returns the cell
  to the palette.

---

### Triangle lattices, Empty cells, Orientation, Tier and Mirror (Sep 20, 2026)

- **Triangle grid** (Symbol → Grid section): an exact triangular lattice of 2–8 rows
  (row *r* holds 2r+1 alternating up/down cells). Placement is centred on each cell's
  bounding box, not its centroid.
- **Empty** — a Choose-content tile that leaves the cell blank (a deliberate hole);
  the cell stays selectable and rules never fill it by accident.
- **Orientation rule** (Symbol → Rule): sets what *up* and *down* triangles hold —
  Filled or Empty. A filled down cell is turned 180° so it still fills its slot.
- **Grid step** gains **Triangle 2–4 rows**, **Tier** (one row of three triangles,
  up-down-up, forming a trapezoid) and **Tier ×2** (two tiers stacked, the stepped
  "tree" silhouette). Each cell holds the chosen Symbol; down cells are turned 180°.
- **Rotate figure** (0/90/180/270°) and **Mirror** (none / right edge / bottom edge /
  both) reflect the whole tiled figure over its own edge; the copy shares that edge.

Worked example — *Form-based FVS, Triangle Symbol*: Element **Triangle**, Fill red →
Symbol **Triangle grid 2**, Rule **Orientation** (up Filled, down Empty) → the
Sierpinski triangle; Triangle grid 2 with the top cell Empty and down Filled → the
trapezoid; Triangle grid 4 → the finer lattice. Save each, then in Grid: **Tier ×2**
(repeated), **Tier** + Rotate 90° + Mirror right edge (mirrored over one axis, a
"bow tie"), **Tier** + Mirror bottom edge (a hexagon star).

### The Figure tab and recipes (Sep 20, 2026)

A **figure** is one pipeline that does not mention a particular Seed:
**Seed → lattice → slot classes → rules (class → content + pose) → composition → transform.**
The **Figure** step (★, after Grid) is one screen for all of it: pick a preset or set the
five sections; every change redraws the figure, and the recipe JSON underneath can be
pasted, copied or saved. It replaces the current Element, palette and Symbol/Grid state.

- **Slot classes** a rule can address: `class` (`up`/`down` on triangular lattices), `row`,
  `col`, `index`, `parity` (`odd`/`even` of column + row). Rules run in order; the last
  match wins.
- **Recipe v2** (`{tool:'fvs-recipe', version:2, element, levels, transform}`): the first
  level is a `component` (a 2×2 block from checkerboard / radial / pinwheel / mirror) or a
  `symbol` (a triangle or square lattice + rules); an optional second level is a `grid`
  (square n, triangle rows, Tier stack) that tiles the first. v1 recipes still load.
- **Presets**: 12 "Triangle" figures (3 assets × asset / repeated / mirrored one axis /
  two axes) and the 7 classic recipes, all as data. The suite checks that the classic
  ones give exactly the same drawing as their v1 form.
- **Checks** (read from the drawn result): numbers valid, every clip reference resolves,
  defs/metadata once, slot count, shapes drawn = filled slots × tiles × mirror copies,
  file size, mirror symmetry, figure box.
- **Reference image**: load a picture (crop it to one figure first); its shape is fitted to
  the figure's own box, shown as an overlay, and the checks add *silhouette overlap* and
  *proportions*. Photos of screens are often stretched, so a moderate overlap is normal.
- **Levels of levels**: any number (up to three) of grid levels can follow the first; each
  grid's finished figure — rotation and mirror included — becomes the tile of the next
  (`levels: [symbol, grid, grid, …]`, an optional `transform` per grid level, the recipe's own
  `transform` belongs to the last). A guard stops at 20 000 shapes.
- **Hexagonal lattices** (`{type:'hexagon', rings:n}`): cells know their `ring` and `sector`;
  poses are multiples of 30° and `rotate: 'sector'` turns each cell by 60° × its sector
  (rosettes). Three presets.
- **Per-cell Seed settings**: `seed: 'live'` on a symbol level (or **Use Element** in Cell
  properties) freezes the Element step's own settings — extras, thickness — into each cell,
  instead of the plain default shape.
- **Limits**: the Figure form edits one or two grid levels (more are JSON-only); Grid
  lattices are square / triangle / tier (no hexagonal Grid yet).
### Working on the figure (Figure tab, Sep 21, 2026)

The tab is a workspace, not a form:

- **Pipeline** across the top — Element → Symbol/Component → Grid… → Mirror / Rotate, each card
  showing that step's own output. Click a card to work on that step (it stays active while you edit);
  `+ Grid` adds a level and selects it, `×` removes one, drag reorders. **New figure…** opens the
  gallery of the 25 starting figures; Undo / Redo (⌘Z / ⇧⌘Z) walk the recipe history.
- **Symbol step — paint the cells**: tools Toggle · Seed · Empty · Rotate · Flip H · Flip V (keys
  1–6). Click or drag; **Shift = the whole class of the cell** (all down triangles, all odd cells, the
  ring). Every gesture writes a **Rule**, shown as a chip under the canvas — switch off (●), reorder
  (↑ ↓), delete (×). A whole drag is one history step.
- **Grid steps — handles on the figure**: click the right edge to Mirror over it, the bottom edge to
  Mirror over it, the corner to Rotate 90° (keys `M`, `Shift+M`, `R`). A middle Grid keeps its own
  transform; the last one uses the recipe's.
- **Right panel — the active step's few parameters**: Seed thumbnails, Style/Ink/Paper; layout
  thumbnails and a rows/rings slider; Grid types; Rotate/Mirror. Everything else (form, checks,
  reference, JSON) is under **Advanced**.
- **Play**: **Shuffle** (Space) changes one to three things at random, keeping what is locked;
  **Variations** (V) shows up to nine nearby figures — one click adopts one, *More* gives others;
  **Lock** Element / Symbol / Rules / Grid / Mirror-Rotate protects a group from both. `[` `]` change
  the rows/rings.
- **Reach**: from a blank triangle the stepped tree takes 4 actions, the hexagon 5, the bow tie 6
  (checked in the regression suite with real UI events, and identical to the preset recipes).

- An assistant can produce the recipe from an image: see `.claude/skills/fvs-figure-from-image`.

## 7. Libraries

- **Component library** — save the selected Component; click the caption under
  a thumbnail to **rename it inline** (Enter confirms, Esc cancels). Renaming
  repoints saved Symbols, Container/Mask references and the Grid pick.
- **Symbol library** — saved separately.
- Entries named `Tile · …` are working copies made by *Tile in Grid* and the
  recipes; they are marked `auto`, hidden from every list, and pruned at start.

---

## 8. Export

Export popover: **PNG**, **SVG**, **Figma** (posts the active step's SVG to the
Organica Figma plugin, like Spore/Pollen/Halide).

- **Screen / Print** — Print exports at a real physical size, DPI and bleed with
  crop marks and a DPI chunk in the PNG. Non-square artwork (a rectangular Loom
  grid) keeps its proportions: the width drives the scale, the height follows.
- **Variants** — rows of Fill/Stroke, ink, paper, stroke width → one file each,
  SVG or PNG at ×1/×2/×4.
- **Plates** — one black-on-transparent file per ink, with registration marks in
  Print mode (needs a bleed of at least 8 mm).
- **Recipe** — save/load everything needed to rebuild the work as one JSON file.
- **Start from a recipe** builds Element → Component → colours → Grid in one
  click (circle, leaf block/wave/outline/two-ink, pinwheel, kaleidoscope).

---

## 9. Motion

Per-cell colour / scale tracks or a whole-field pan on the Component and Symbol
steps, previewed live with the floatbar's Play.

---

## 10. Regression suite

`fvs/_test-regression.html` (dev only): loads `/fvs/` in a hidden frame, runs a
fixed battery of builds, hashes every SVG and diffs against
`fvs/_regression-baseline.json`. Open it on the dev server and press **Run** —
expected: *All N cases match the baseline*. When a change is intentional, use
**Show JSON to record** and update the baseline in the same commit. New FVS
behaviour gets new cases in `battery()`. It is run before every commit that
touches `fvs/index.html` or the shared files FVS uses.

Not covered: PNG byte content, cross-browser behaviour (see the backlog in
CLAUDE.md).
