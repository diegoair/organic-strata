# Flexible Visual System — User Manual

> Organica · Flexible Visual System — Element → Component → Symbol → Grid
> Live: [theorganicalanguage.vercel.app/fvs/](https://theorganicalanguage.vercel.app/fvs/)
> Last updated: September 20, 2026

---

## 1. What Flexible Visual System does

Flexible Visual System is a **rule engine for visual patterns**, modelled on Figma's own
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
| **Symbol** | A larger grid whose every cell holds a Seed or a saved Component | a grid generated in the canvas, or a loaded JSON grid |
| **Grid** | A Symbol, or a saved Component, tiled 2×2 / 3×3 / 4×4 / Loom | the previous step's output |

**Tile in Grid** (Component step) tiles the selected Component directly in the
Grid step without saving it first.

---

**Zoom** — only in **Symbol** and **Component** (not Element or Figure):
- **Symbol** and **Component Edit**: mouse wheel or **⌘+ / ⌘− / ⌘0** zooms the view, the same
  zoom as every other Organica tool, with a "142 % · reset" chip bottom-left. Pan with
  **Space + drag**, **⌥ + drag** or the **middle button**; a plain click keeps doing what it
  does (select cells, drag borders). Double-click or ⌘0 = 100%.
- **Component gallery**: the wheel / ⌘+ / ⌘− make the **thumbnails bigger** (up to 5×); the
  grid reflows and still scrolls with its scrollbar. ⌘0 or *reset* = normal size.

## 3. Element

- **Seed type** — Arc, Arc truchet, Blob, Chevron, Circle, Cross, Drop, Lens,
  Polygon, Rounded rect, Segment, Star, Triangle, Wedge (alphabetical), plus
  **Freehand** (draw with bezier anchors), **Custom** (an uploaded SVG) and
  Seeds picked from the **Creator library** (Genesis). Each type has its own
  *extras* — corner styles, curvature, outline, twist and so on — listed from
  one shared table (`Organica.shapes.EXTRAS`), the same one Genesis Create uses.
- **Segment** is a filled bar: *Length*, *Thickness* (% of the cell, default 8) and
  *Round ends* (off by default — square ends). It shows in Fill style like any other
  shape; picking it turns *Rounded caps* off (they only matter in Stroke, where the bar is
  outlined) and leaving it gives them back. **Repeat X / Y** split the canvas into tiles
  and put one copy in each, so the copies always fill the whole canvas; **Space X / Y** are
  the gap between copies as a % of a tile (0 = touching). Rays then turn the whole grid;
  if the bar's thickness pushes past the canvas it is fitted back in. Segments saved before
  this (plain lines) are drawn as bars too.
  As a **second layer**, a Segment gets the full canvas: a new layer starts at Scale 0.6 (so
  it shows on top of the one below), and choosing Segment on it sets Scale 1 so its repeats
  fill the whole canvas, not the central 60%. Going back to another shape gives 0.6 back; a
  placement you set by hand is always kept.
- **Layers** — a multi-layer Element, one lean row per layer (top first), with **+** in the
  section header. Each row: **⠿** drag to reorder — press anywhere on the row's head (grip or
  name), move, drop on another row (upper half = above it, lower half = below; a drop that would
  leave it in place takes that row's place, so two layers always swap) — or ⌥↑ / ⌥↓ on a focused row · the shape's
  icon tinted with its ink + its name (click = edit it) · **eye** to hide it (a hidden layer is
  skipped everywhere, exports and colour variants included) · **role icon** — click cycles
  Filled → Subtraction mask → Mask → Pattern (§6a) · **colour dot** — opens the palette: *follow cell
  colour* or an ink (off for mask layers) · **bin** on hover. The active row opens **X / Y /
  Size / Rot** (the layer's own placement) right under it, followed by the layer's own
  **Style, Stroke W, Rounded caps, Width and Length** — with layers these controls sit in the
  layer's card, not in Appearance. Appearance then keeps only what acts on the **whole
  Element** (Scale, Move, Fit), under a "Whole Element — all layers" label. With a single
  shape everything is in Appearance, as before.
- **Appearance** — Style **Fill / Stroke / Pattern**, Width / Length, **Scale, Move X/Y**
  and **⤢ Fit to canvas** (one-shot). **Inner seed** adds nested copies
  (Count, Ratio, Anchor).
- **Pattern** (Style, Oct 3, 2026 — a test) — the shape filled with **Lines / Crosshatch /
  Dots / Concentric** in its ink, set by **Spacing** (between lines / dots / rings), **Weight**
  (line width or dot diameter) and **Angle** (hidden for Concentric). Real vector paths clipped
  to the shape (no SVG `<pattern>`, no bitmap), so an export stays one ink per path for print.
  The pattern is laid out in the Element's 0–100 box, anchored at its centre: Width / Length
  stretch the shape, not the spacing, and stacked layers' patterns line up. It turns with the
  cell in Component and Symbol (a Checkerboard 0°/90° alternates the line direction). With
  layers, each layer picks its own Style, but the pattern's settings (Pattern / Spacing /
  Weight / Angle) are **one set for the whole Element**, always here in Appearance — never in
  the layer's card. They show whenever any layer uses Pattern (Style or role).
- **Reset seed shape** (floatbar) puts the current shape's controls back to
  their defaults without touching Appearance or Palette.
- The strip above the frame shows the Element at 0/90/180/270° and each flip. **Click a view**
  to show it on the big canvas (a viewing choice — the Element and later steps are unchanged;
  the Element export exports the view shown; Freehand drawing and Split's cut grid show 0°).
- **Saved Elements** (Oct 3, 2026 — a test). Every view and the big frame carry two hover
  circles: **save** (+ → ✓ once saved, hovering ✓ removes it — the same circle as the Component
  gallery) and **pattern** (save this view if needed and make it the **Paper tile**; pressed when it
  is the current tile). A saved Element keeps its shape in that orientation (rotation / flip baked
  in), its colours (thumbnail) and its tile silhouette; it is not edited, only used or removed.
  They are listed under **Saved Elements** (click = use as the Paper tile).

---

## 4. Palette and colour rules

- **Ink** — 1 to 8 colours (RMX chips); **Paper** is the ground for every
  gallery thumbnail, PNG and SVG. The **checkerboard button** next to Paper makes it
  **transparent** everywhere (every step, thumbnail, saved Component/Symbol and export):
  SVG gets `fill="none"`, PNG keeps the alpha, and the previews show a checkerboard behind.
  Click it again (or pick a colour) to get the previous Paper colour back.
- **Paper = colour + texture** (Oct 3, 2026 — a test). The **Pattern** icon at the end of the
  Paper row switches a texture on over the Paper colour: **Pattern** (Lines / Crosshatch /
  Dots / Concentric), **Ink** (a palette ink), **Spacing / Weight / Angle**, opening right under
  the row; click it again for plain Paper. It always covers the **whole canvas** in every step —
  the Element preview and its strip, the Component, the Symbol frame — under everything else.
  Spacing is in 1/100 of the canvas's short side, so the same settings look alike at every
  size. Saved with the appearance: a saved Component keeps its own Paper + texture, also inside
  Symbol cells (in its saved inks). Not covered yet: the bleed strip of a Print export (plain
  Paper colour) and the Figure tab. The icon is the shared Palette's opt-in `opts.pattern`.
  **Pattern = Element (tile)**: a shape repeated as the texture in ONE ink — **Tile** (a thumbnail
  dropdown: the Current Element, a Saved Element, or a Genesis seed — the 13 Base Seeds plus this
  browser's Genesis library, each turned into one filled outline), **Layout** (Grid / Brick /
  Half-drop), **Turn** (None / Alternate 0°·180° / Quarter pinwheel), **Size** (% of the spacing),
  Spacing, Angle. Weight hides: the tile uses the Element's Fill, or its Stroke. At most 2,500
  tiles per canvas (the spacing is raised, with a note). SVG: one `<path>` in `<defs>` + one `<use>`
  per tile. A saved Component / Symbol keeps a **snapshot** of the tile; the live Paper follows the
  Element.
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

The Component is the small building block: a grid of **1–4 columns × 1–4 rows**
(square or rectangular — 2×3, 3×4, 4×1…). Larger and irregular grids live in the
Symbol (§6). A rectangular Component sits letterboxed in its square frame in the
gallery/export; inside a Symbol it is placed by its own tight box. A Component
saved on an imported Loom grid before this split still renders exactly as saved
("legacy" hint in the Grid section); picking columns × rows replaces it. A 1×1
Component is one Element on its own — the way to put a single shape in a Symbol;
the pattern rules are greyed out there (use Exhaustive for its turns/flips).

Generate produces a gallery of candidates; click one to select it.

- **Named rules** — Identity, Pinwheel, Mirror, Diagonal, Checkerboard, Row
  mirror, Column mirror, Radial, plus Lines, Oscillator, Random, Exhaustive and
  Manual. Every named rule reads each cell's column/row, so they work on **any**
  grid (2×2, 3×3, 4×4, Loom): Pinwheel steps rotation by `(col + 2·row) mod 4`,
  Mirror flips by column/row parity, Diagonal alternates `R` / `90−R`,
  Row/Column mirror flip by row/column parity. Beyond 2×2, **Mirror** also offers
  the three whole-grid *book-matched* mirrors (left|right, top|bottom, both) and
  **Radial** offers both one rosette on the whole grid and a *tiled* rosette per
  2×2 block (four quarter-arcs → four circles on a 4×4). **Radial** needs an
  even × even grid (its centre falls between cells), **Row mirror** needs ≥ 2 rows,
  **Column mirror** ≥ 2 columns — greyed out otherwise. Only a real 2×2 (four
  cells laid out TL, TR, BL, BR) uses the original four-cell tables; a 4-cell Loom
  row or column is treated as the 4×1 / 1×4 it is.
- **Polygon Loom grids** (e.g. Hexagonal) get their columns/rows from the
  full-size cells only, with a hex lattice's offset ("doubled") rows folded back —
  otherwise every full hexagon landed on the same parity and Checkerboard/Mirror/
  Diagonal collapsed to Identity.
- **Random / Exhaustive** draw from the same symmetry families on **any** grid
  (never per-cell noise). Exhaustive is capped at 512 and refuses cleanly above it;
  its count is the honest one after folding duplicates.
- **Nothing hidden.** Picking a named rule shows its whole family: the axis the
  rule needs (Flip for the mirrors, Rotation for Pinwheel/Diagonal/Radial) is
  implied by the pick, so Mirror with Flip off still lists every mirror, not
  Identity. Only Checkerboard, built entirely from the active axes, falls back to
  Identity when every axis is off. Candidates that merely *paint* alike with this
  Element (a Circle's 8 Pinwheels) are all listed. The only fold is the exact one:
  flip H + flip V *is* a 180° turn, so that pair is never listed twice. Random keeps
  drawing until it has the count you asked for, or the space runs out.
- **Layer colours** (switch *Layer colour variants* under the Rule, on by default,
  shown only for a multi-layer Element). When on, every candidate is repeated for
  every combination of layer inks — each Fill layer takes *Follow cell colour* or
  each palette ink ((inks + 1)^layers combinations; 2 layers × 3 inks = 16). The
  Element's current inks come first. The caption ends with the inks (`inks c/2` =
  bottom layer follows the cell, top layer Ink 2). Clicking a variant makes its inks
  the Element's own; quick-saving one stores its own inks. Above 512 results the
  first 512 are shown and the gallery says how many exist (Exhaustive's hint gives
  the product too).
- **Role** — a Component can be a *Container* or *Mask* over another saved one.
- **Undo** (floatbar, ⌘Z) — the last 20 Generate / Add / Clear / Tile / recipe
  steps of the gallery. It never touches the Seed.

---

## 6. Symbol

The Symbol is the composition: a page, a grid inside it, and saved Components in
its cells.

- **Canvas** — a format (Square 1:1, Portrait 4:5, Landscape 16:9, Vertical 9:16,
  Widescreen 3:2, A4/A3/Letter, or Custom), **Screen** (px) or **Print** (mm/in,
  DPI, bleed), and a margin (% of the short side). The page is stored on the
  grid's own Loom model (`canvas.fvsFrame`), so it travels with saved Symbols and
  the Grid tier with no extra field. In Print the Export follows the canvas: SVG at
  the physical size with the paper extended into the bleed and crop marks; PNG at
  the canvas DPI with the DPI written into the file.
- **Symbol grid** — *Generate grid in canvas* runs one of Loom's own generators
  (Rectangular, Bento, Wave, Masonry, Hexagonal, Triangular, Diamond, Circular,
  Radial, Organic, Fractal, Spiral — `loom/js/generators/registry.js`, imported as
  ES modules) inside the canvas margin, gap 0 so cells meet. **Load JSON grid** loads
  a grid file exported from Loom; it keeps its own frame. (The former *More grids*
  block — saved Loom grids, ready-made Bento/Hexagonal, Square N×M, Triangle — was
  removed Oct 2, 2026.) The preview fits any proportion.
- **View toggles (floatbar)** — four icon buttons in the Symbol step's floatbar (on =
  the icon at full strength, as everywhere in the bar): **Show loaded grid** (the grid's own lines), **Clip to
  cell** (content cut at the cell's edge — the one that is in the export and saved
  with the Symbol), **Show cover crop** (what a Cover fit crops away) and **Show
  column/row guides**. Only the guides start on; a new grid starts unclipped (it
  started clipped until Oct 2, 2026 — saved Symbols keep what they were saved with).
- **The first grid** — while the Symbol is empty and the pool holds Components, the
  middle of the page shows one **Generate** button (the design system's primary
  button). It runs the same thing as *Generate grid in canvas* (canvas, generator and
  parameters are read from the panel). The Symbol is built underneath at once; over
  it, one pane per cell of the grid shows a filtered copy of the Symbol that goes
  from blank paper to a few blurred, high-contrast, rippling masses and then to
  sharp, one cell after another in a scattered order, drawn anew each run (1 s per cell, the whole sweep
  about 2 s; nothing with *reduce motion*). Preview only — nothing of it reaches the
  export, and the panes take no clicks. Once a
  grid exists the button does not come back.
- **Resize columns and rows by dragging** — on any rect grid that has tracks
  (Rectangular, Bento, Wave, a plain square…) each inner border shows a dashed
  handle on the preview (never exported). Drag it: the two tracks either side trade
  size, the total stays, the cells keep their content, and a track never goes below
  4% of the grid. On *Rectangular* the Column / Row weights fields follow live
  (mean 1, two decimals), so *Generate grid in canvas* reproduces the proportions.
- **Components (palette)** — the saved Components the Symbol is built from, each
  with a weight (×1–×5). *+ Add Components…* opens the library to toggle them; a
  first visit starts with the three most recently saved.
- **Fill**
  - **Suggest** (default) — proposes whole Symbols from the palette (§6a).
  - **Arrange (palette)** — places the palette by a rule: Random (by weight),
    Checkerboard (first two), Rows, Columns, Diagonal bands, 2×2 blocks, Rings,
    Sectors, Wave bands, Up/down (triangles). The n-th class takes the n-th
    Component. Fit: Fill the cell or Contain. Locked cells stay.
  - **Rule** — transforms only (Oscillator, Checkerboard, Rows, Columns, Radial,
    Wave, Orientation, Random), lock-aware, with Reset & apply to all.
  - **Manual** — click a cell to select it; drag to select several; ⌘-click (Ctrl-click on
    Windows; Shift also works) adds or removes a cell. A click only selects: **click a
    selected cell again, or double-click a cell, to open Choose content** for the whole
    selection. Every Cell-properties change, Fit, Anchor and *Choose…* applies to the selection.
- **Choose content** — the **Element** itself (as it is, or in the six states of the Element
  step's strip: 90° / 180° / 270° / Flip H / Flip V / Flip H+V — the cell keeps the Element's
  settings as they are at that moment, layers included; a layer that follows the cell colour
  is pinned to the palette's first ink, the one the Element step shows it in, so no layer
  disappears into another), a saved Component or **Empty**, with an **Apply to all
  cells** switch. The plain default Seeds are no longer offered as Symbol content (old Symbols with
  Seed cells, and the Figure tier's lattices, still render them).
- **Cell properties** — rotation, flip, fit, scale, padding, **Lock**,
  and **Colour**: *Follow palette* (default) or an explicit override (a palette
  colour or a free one). An override is flagged, and **Reset** returns the cell
  to the palette.
- **Fit and Anchor** — in the floatbar of the Symbol step, one control for both scopes: with
  cells selected on the canvas they act on the **selection**; with none selected, on **every
  cell**. The tooltip names the target ("Cover · 2 selected cells" / "Cover · all cells").
  - **Fit**: four line icons — Contain / Fill / Cover / Fixed size (a wide cell and what a round
    content does in it; Fixed has a dashed cell). An icon is pressed only when every target
    cell holds that value (mixed = none). Cover resets Cover axis to Auto; Fixed starts from
    the median cell size.
  - **Anchor**: one button after the Fit icons; a click raises a small flyout with the nine
    positions and nothing else, and picking one closes it. The button's icon is the
    position itself (a dot in a cell, a dash when the target cells differ). Anchor shows only
    where the content does not match its cell (Cover, Fixed, Contain): when every target cell
    is on Fill at 100% the button is disabled (its tooltip says why) and an open grid closes. This is the only Anchor control — the
    grids in the Symbol grid section and in Cell properties were removed.
  A control is on only when using it would change the drawing of at least one target cell
  (the same rule with or without a selection):
  - no content at all (Empty cells, no grid yet) → Fit and Anchor off; in a mixed group they
    read the cells that hold something;
  - Contain / Fill / Cover that would place every target exactly as it is now → that icon off,
    its tooltip says "same result as now" (a round content in a square cell: the three are the
    same picture). Fixed size stays available — it changes what the cell does next (its own Size);
  - Anchor when no target has room to move in (the content is exactly its cell) → off. Both write the same per-cell fields as Cell
  properties → Fit.

- **No seams.** Cells never show a light line where they meet: nested Components'
  papers are painted first under all ink, and each cell's content and clip reach
  0.1% of the page past its border (the Component's own cells too), so neighbours
  overlap instead of touching. With *Fill*, a polygon cell's content is centred on
  the cell's box, not its centroid (a hexagon cut by the margin stays covered).

### 6a. Suggest — how the proposals are made

- Each palette Component is rasterised once into an ink mask of its own tight
  frame (cached by name + save time), so any point of any turned/flipped placement
  can be asked "ink or paper?".
- The grid's real adjacencies: rect cells share a vertical/horizontal segment
  (bento spans included); polygon cells share an edge, including partial ones
  (Loom's triangular lattice offsets its rows) and curved borders made of many
  pieces (Radial). One pair per two neighbouring cells, with 10 sample points
  along the shared border, nudged into each side.
- A proposal = per cell {Component, turn}. Square Components in square-ish cells
  take any of the 8 turns/flips; otherwise only 0°/180° (± flip).
- Scores, weighted by the three sliders:
  - **Continuity** — the two sides of every shared border agree (ink meets ink
    counts most, paper meets paper a little, a mismatch costs);
  - **Balance** — ink spread evenly over a 3×3 split of the page, and each
    Component used as often as its weight;
  - **Surprise** — fewer identical neighbours.
- Generators: every Arrange rule with each cell's turn chosen for continuity; a
  beam search (width 4) over Component × turn, cell by cell; a weighted mix with
  the same turn search. Ranked, exact duplicates dropped, up to 12 shown above the
  canvas with a caption ("Continuity search · continuity 97%"). Deterministic per
  seed. Click one to take it; **More like this** re-draws 8–20% of the cells of
  the current Symbol and re-turns them. Locked cells are always kept.
- On a grid whose cells don't share borders (Circular) continuity doesn't apply
  and the caption omits it. On hexagons/triangles a square Component is deformed
  into the cell, so continuity is an approximation.

### 6b. Colour — measured and generated (Oct 2, 2026)

FVS reads colour with `Organica.color` (`shared/color.js`: OKLCH, WCAG `contrast`,
`deltaE`, the 0–900 `scale` — the same steps TuneSutra shows). Colours stay plain hex
everywhere: a palette is a source, never a link, and saved work never changes on its own.
The order of the palette is the role (Base, Secondary, Accent…), as in TuneSutra.

- **Suggest measures colour.** The mask also keeps *which* ink each point is. On a shared
  edge the same colour on both sides counts fully, two distinct inks count half, and two
  inks too close to tell apart (ΔE under 6) count nothing. A fourth slider, **Colour**,
  scores the ink areas: a clear hierarchy (largest first, against the role shares
  51 / 31 / 18…), each ink spread over the page, neighbouring inks distinct. The caption
  shows `continuity N% · colour N%`. With one ink in the pool nothing changes.
- **Colourways** (Component → Rule → *Colourways of the selection*). Colour variants of the
  selected Component from the palette's main colours and their shade scales, by named
  schemes: **Roles** (and its turns), **Tonal** (steps of one colour on its step 100),
  **Tint ground** (paper = Base 100), **Dark ground** (paper = Base 900), **Accent** (Base
  everywhere, the Accent on the share of cells nearest its role share), **Pair** (the two
  mains furthest apart). Every result is *solved*: an ink under 3:1 on its paper moves
  along its own scale — hue kept — to the nearest step that reaches it; inks closer than
  ΔE 6 are moved apart; a scheme that cannot be solved is dropped. The gallery shows one
  candidate per colourway, each in its own colours (caption: scheme · contrast · ΔE). The
  first is the palette as it is. Picking one makes it the live palette; saving (also *Save
  all*) stores its colours. Editing the palette by hand turns the selected one into *Custom*.
- **Recolour cells (test)** in Suggest. Each pool Component offers up to three of its
  colourways (the ones that keep its number of inks and its colour rule) and the search
  picks Component × turn × colourway. A recoloured cell carries `colourway {colors, paper}`
  and shows "· recoloured" in Cell properties; choosing content again clears it. Off by
  default; a large grid searches a narrower beam.
- **Figure.** *Shuffle* / *Variations* no longer draw from a fixed list of inks: **Other
  hue** turns every ink by a harmony angle in OKLCH (±30°, ±60°, ±120°, 180°; a grey is
  given a hue), **Other colourway** applies one of the schemes above to the recipe's own
  palette, **Other colour rule** changes how the inks are spread. Two checks were added:
  *Inks read on the paper (3:1 or more)* and *Inks are distinct*. The form and the Ink field
  keep the recipe's other inks and its colour rule.
- **Limits.** Continuity samples a 64 px mask, so an anti-aliased edge pixel can be read as
  the neighbouring ink. The Colour hierarchy is by area, whatever colour is the largest — it
  does not ask that the *Base* be the largest. Recolour tends to converge on one tonal
  colourway (the same colour on every edge scores highest). Colourways are judged on the
  Component's own paper, not on the Symbol's.

---

### Triangle lattices, Empty cells, Orientation, Tier and Mirror (Sep 20, 2026)

- **Triangle grid** (its Symbol button was removed Oct 2, 2026 — use the Triangular generator or a loaded JSON grid; the Grid step's Triangle layouts remain): an exact triangular lattice of 2–8 rows
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

Worked example — *Form-based Flexible Visual System, Triangle Symbol*: Element **Triangle**, Fill red →
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
  `transform` belongs to the last). A guard stops at 40 000 shapes
  (filled cells × tiles × mirror copies, multiplied through every Grid level): above that the
  recipe is refused with the exact count instead of drawing.
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
  ring). Every gesture writes a **Rule**, shown as a chip in the right panel's **Rules** section (above
  Palette, visible only on this tab) — switch off (●), reorder (↑ ↓), delete (×). A whole drag is one history step.
- **Grid steps — handles on the figure**: click the right edge to Mirror over it, the bottom edge to
  Mirror over it, the corner to Rotate 90° (keys `M`, `Shift+M`, `R`). The handles are always faintly
  visible (⇔ / ⇕ / ⟳ icons, not only on hover) and a click switches the view to **Mirror / Rotate**
  right away, so the result shows immediately rather than needing a separate click on that card. A
  middle Grid keeps its own transform; the last one uses the recipe's.
- **Right panel — the active step's few parameters**: Seed thumbnails, the Seed's two or three main
  sliders (Star: Points / Inner radius; Arc: Thickness / Sweep…), Style/Ink/Paper; layout
  thumbnails and a rows/rings slider; Grid types; Rotate/Mirror. Everything else (form, checks,
  reference, JSON) is under **Advanced**.
- **Play**: **Shuffle** (Space) changes one to three things at random, keeping what is locked;
  **Variations** (V) shows up to nine nearby figures — one click adopts one, *More* gives others;
  **Lock** Element / Symbol / Rules / Grid / Mirror-Rotate protects a group from both. `[` `]` change
  the rows/rings.
- **Symbol ⇄ Component**: the ⇄ on the first card swaps the Symbol for a Component block and back.
  A figure that is only a Symbol opens on it, so its cells are paintable at once; on a triangular
  lattice **Rotate** turns a cell by 180° (90° on a square one, 60° on a hexagonal one).
- **Reach**: all twelve "Triangle Symbol" figures are rebuilt from a blank one with real UI events
  in 1 to 6 actions each (Sierpinski 1–4, trapezoid 3–6, lattice 4 2–5) and draw exactly what the
  preset recipes draw — checked by `ux12:*` in the regression suite.

- An assistant can produce the recipe from an image: see `.claude/skills/fvs-figure-from-image`.

## 6a. Layer roles: Mask / Subtraction mask / Pattern

A layer's **role icon** (on its row) sets how it acts on the **layers below** it:

- **Filled** (solid disc) — the layer paints its own ink (default).
- **Subtraction mask** (striped disc) — keeps the layers below only inside the layer's shape.
- **Mask** (square with a hole) — cuts the layer's shape out of every layer below it.
- **Pattern** (diagonal hatch, Oct 3, 2026) — a mask made of the pattern: its lines / dots are
  **cut out of every layer below** (real transparency — the Paper and its texture show through).
  It uses the Element's pattern settings (Appearance) and has no ink; its card hides Style, and
  its Seed is ignored. Its X / Y / Size / Rot move, scale and rotate the pattern. SVG: a `<mask>`
  (white, pattern in black); canvas: `destination-out`.

It works in every step (Component, Symbol, Grid, export) because it is the layer stack itself.
The old Element **Content** section (and before it, *Pick underlying component…*) was removed
on Sep 28, 2026 — the role now lives only on the row.

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
**Show JSON to record** and update the baseline in the same commit. New Flexible Visual System
behaviour gets new cases in `battery()`. It is run before every commit that
touches `fvs/index.html` or the shared files Flexible Visual System uses.

Not covered: PNG byte content, cross-browser behaviour (see the backlog in
CLAUDE.md).
