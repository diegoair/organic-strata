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

Vanilla HTML/CSS/JS, no build step: `fvs/index.html` (markup) + `fvs/fvs.css` + native ES modules in
`fvs/js/` (split out of the single file, Oct 2026 — see §11 Architecture).

---

## 2. The four steps

The step bar above the canvas moves along the chain; each step builds on the
one before.

| Step | What you make | Built from |
|---|---|---|
| **Element** | The Seed shape and how it is drawn | a Seed type, its extras, Look & place, Palette |
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
  Polygon, Segment, Square (value `roundedrect`, was *Rounded rect* until Oct 5, 2026), Star, Triangle, Wedge (alphabetical), plus
  **Freehand** (draw with bezier anchors), **Custom** (an uploaded SVG) and
  Seeds picked from the **Genesis library** (its 13 Base Seeds + your own Genesis seeds — the
  **Genesis seeds** group of the Library view, §7). An uploaded SVG and a Genesis seed come in
  **whole** through one import (`useSvgAsSeed` → `svgToTileGeo`, Oct 6, 2026; it was the first shape
  only): every visible shape united, strokes outlined with their own width / caps / joins, evenodd
  holes kept, transforms and clip paths applied (the viewBox too), hidden layers and zero-opacity
  groups skipped, white / near-white paint treated as Paper (a background rect) unless it is all there
  is. A file it can't read falls back to the old first-shape reader and its error. Measured: 19
  upload-style cases + the 13 Base Seeds at IoU ≥ 0.95 against their source (geometry ≥ 0.997 at
  high resolution). Each type has its own
  *extras* — corner styles, curvature, outline, twist and so on — listed from
  one shared table (`Organica.shapes.EXTRAS`), the same one Genesis Create uses.
- **Shape** (the section, was *Seed*, renamed Oct 4, 2026). Every Seed lists its controls in the
  same order:
  1. **Type** (the preset shortcut).
  2. Proportions.
  3. **Rounding**, then **Rounding style**, then Edge curvature.
  4. The shape's own details (taper, twist, lean…).
  5. Repeats inside the shape (Dashes, Petals, Stack, Lines, Rays…).

  One name per idea, in every shape:
  - **Rounding**: was Corner radius / Corner rounding / End rounding. Star keeps Tip / Valley rounding.
  - **Rounding style**: was Corner style.
  - **Dashes + Dash gap**: Arc and Arc truchet's Segments + Segment gap.
  - **Thickness**: Chevron / Cross Arm width, Arc truchet Arc ratio.
  - **Bands**: Arc truchet Arc count.
  - **Hole**: the hole of Wedge. Circle → Ring says **Opening**, so it is not confused with Perforated's *Holes*. Star keeps *Inner radius* (its point depth).

  These labels are FVS's own (`FVS_EXTRAS_LABELS`; the order of rows built from the shared table:
  `FVS_SEED_ORDER`). The shared table keeps its labels for Genesis. Ids and saved keys are
  unchanged.
  **Split** sits right under the shape picker (its own section until Oct 4, 2026):
  - One row: Split · All / TL / TR / BL / BR, then *Show cut grid*.
  - **Save piece as Seed** shows only while a piece is cut.
  - It is a real geometric cut whose result is a new shape: the picker turns Custom.
  - It sits under the picker on purpose. Cutting hides the shape's own rows, which are below it, so the chips never move under the pointer. At the end of the section they jumped up ~256 px on the first cut.
  - With layers it cuts the whole stack into one shape, and a hint says so.
  - The status line is for problems only. The pressed chips say what is kept.
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
  layer's card, not in Look & place. Look & place then keeps only what acts on the **whole
  Element** (Scale, Move, Rotate, Fit), under a "Whole Element — all layers" label. With a single
  shape everything is in Look & place, as before.
- **Look & place** (was *Appearance*, renamed Oct 4, 2026) — Style **Fill / Stroke / Pattern**, Width / Length, **Scale, Move X/Y,
  Rotate** and **⤢ Fit to canvas** (one-shot). Rotate turns the Element about its centre,
  after Width / Length (a stretched shape turns as a whole — the same order as a layer's
  own Rot). **Cut out** (0–95, beside Width / Length — remembered per shape type like them, and
  per layer with layers; prototyped as "Hollow", renamed and inverted by Diego) cuts the middle out
  of the shape and leaves a rim of **even thickness** along its whole outline: 0 is solid, higher
  cuts more away (95 = a thin rim; the rim is 100 − Cut out % of the shape's inradius). Every
  Seed, Freehand and an uploaded SVG alike. It replaces the six shape-own *Outline (hollow)*
  sliders (Triangle, Polygon, Star, Square, Lens, Blob), which scaled the shape toward its
  centre — even only on a triangle or a regular polygon (×1.53 at a lens tip, ×0.73 in a star's
  valley). Those stay hidden for old snapshots and are never converted (the picture would change
  by up to 9 %); the Shape panel's note says so and Reset Element clears them. Such an old
  Element cut out again gets both (its own Outline first, then the even rim) — Reset Element
  first to keep only Cut out. Implementation: `hollowGeometry` (Paper.js, memoised; the inscribed
  circle in plain JS, `inscribedCircle`); prototype measurements in
  `docs/audit-2026-10/FVS-ELEMENT-DUPLICATES.md` §5–7 (the dev page was removed after it shipped by mistake).
- **Irregularity** (Oct 4, 2026 — under Cut out, per shape type, per layer with layers) makes any
  outline irregular, with a **Seed** (same seed, same shape) and two **Modes**: *Corners* — each
  corner gets a seeded offset and the sides between corners stay straight (hand-cut paper; a corner
  is where the outline turns > 35° within ±3 % of its length, sharp or rounded); *Outline* — the
  whole edge ripples, **Waves** = how many ripples run around it. A shape with no corners (Circle,
  Blob) always ripples, so Mode hides there. Amplitude: Irregularity % of the inscribed radius
  (half of it for Outline). Applied before Cut out and Copies (the rim and the copies follow the
  irregular outline); the shape may poke out of its cell, like Scale above 1. It replaces the five
  shape-own Irregularity + Seed pairs (Triangle, Arc, Wedge, Polygon, Star — two different
  behaviours under one name) and Polygon / Star *Angle jitter*; those stay hidden for old snapshots,
  never converted (different formulas), with the Shape-panel note. Blob stays a Seed type with its own Amount
  (Diego, Oct 4, 2026), even though Circle + Irregularity (Outline) can draw a similar shape.
- **Copies** (was *Inner seed*, renamed Oct 4, 2026) — nested copies of the shape. Since the same day
  it is not a section of its own: the **Copies** row sits in Look & place right after Cut out, which drives it
  (with layers, in the layer's card like Cut out). Order there follows the computation: Width, Length,
  Irregularity, Cut out, Copies. Ratio and Anchor show only with Copies > 0. Two behaviours, set by Cut out:
  - **Cut out 0** — the original alternating bands (byte-identical to before). Ratio = each copy's
    size as a % of the previous one; Anchor Bbox centre / Centroid / **Inner centre** (centre of the
    largest inscribed circle — the evenest bands) / Apex (Arc, Wedge).
  - **Cut out > 0** (Diego's choices C, then "A+B") — the copies are the cut-out rim, each one
    **fitted inside the previous copy's hole** (the largest scale at which its whole outline still
    lies in the hole, measured) and shrunk toward the Inner centre, so rings never merge on any
    shape. Ratio reads **Spacing** there: how much of that hole the next copy fills (high = rings
    packed close, low = spaced out). Anchor offers Inner centre / Apex only, and hides when Inner
    centre is the only choice. Before A+B only 6 of 24 Ratio × Cut out pairs gave separate rings —
    the rest only shrank the hole or left fragments.

- **One control per job** (Oct 4, 2026 — `docs/audit-2026-10/FVS-ELEMENT-DUPLICATES.md`).
  The shape sliders that did what Look & place already does are gone: Circle / Polygon / Star
  **Radius** (= Scale), Wedge / Chevron **Squash** (= Length), the per-shape **Rotate** of
  Wedge, Polygon, Star, Square, Chevron, Cross, Lens, Drop and Circle (= Rotate), and
  Blob **Radius** (it never changed the shape — the blob is fitted to the cell). Arc *Start
  angle* and Segment *Angle* stay (they are part of the shape: the arc's start relative to its
  pivot, the bar's direction inside its tiles). Also gone: the Arc and Wedge **Ring** types
  (a full ring is Circle → Interior Ring; Arc's never closed — Sweep stops at 350°), Polygon's
  **Triangle / Square** types (Seeds of their own) and Cross's **X** (a Plus with Rotate 45).
  A control that changes nothing until another one moves is hidden until then (one table,
  `SEED_DEPENDS`: Seed without Irregularity, a gap with one segment, a corner style with no
  corner…). Square's Type now sets Rounding on every preset.
  **Old snapshots**: their inputs still exist, hidden (`#seed-legacy`), so a saved Element
  renders exactly as saved. When one is opened for editing, `foldLegacySeed` moves each value
  into Look & place (single shape) or the layer's own Size / Rot / Length (stack) and resets the
  seed key — only when sampling both pictures says they are the same; anything that would
  change (a shape that refits after rotating, a Stroke whose width would scale with Scale, a
  Squash under a rotation) keeps its old value. Saved Components and Symbols never go through
  this: they draw from their stored seed, unchanged (regression 395/395).
- **Pattern** (Style, Oct 3, 2026 — a test) — the shape filled with **Lines / Crosshatch /
  Dots / Concentric** in its ink, set by **Spacing** (between lines / dots / rings), **Weight**
  (line width or dot diameter) and **Angle** (hidden for Concentric). Real vector paths clipped
  to the shape (no SVG `<pattern>`, no bitmap), so an export stays one ink per path for print.
  The pattern is laid out in the Element's 0–100 box, anchored at its centre: Width / Length
  stretch the shape, not the spacing, and stacked layers' patterns line up. It turns with the
  cell in Component and Symbol (a Checkerboard 0°/90° alternates the line direction). With
  layers, each layer picks its own Style, but the pattern's settings (Pattern / Spacing /
  Weight / Angle) are **one set for the whole Element**, always here in Look & place — never in
  the layer's card. They show whenever any layer uses Pattern (Style or role).
- **Reset Element** (floatbar, `reset` icon; was *Reset seed shape*) — since Oct 5, 2026 a **total
  reset** (Diego): the Element as FVS opens it — the picker's first shape, every shape's own parameters
  (not only the open one's) and their remembered Look & place, no layers, the default palette (one black
  ink, default colour rule) and a white Paper without texture. Saved Elements, Components and Symbols are
  untouched. **Hold to confirm** (`data-hold`, 1 s, a red ring; tooltip *Reset Element — hold to
  confirm*; a plain click falls back to two clicks). Until Oct 5 it reset only the open shape and its
  look, never the palette or Paper.
- The strip above the frame shows the Element at 0/90/180/270° and each flip. **Click a view**
  to show it on the big canvas (a viewing choice — the Element and later steps are unchanged;
  the Element export exports the view shown; Freehand drawing and Split's cut grid show 0°).
- **Saved Elements** (Oct 3, 2026 — a test). Every view and the big frame carry two hover
  circles: **save** (+ → ✓ once saved, hovering ✓ removes it — the same circle as the Component
  gallery) and **pattern** (save this view if needed and make it the **Paper tile**; pressed when it
  is the current tile). A saved Element keeps its shape in that orientation (rotation / flip baked
  in), its colours and Paper colour (thumbnail) and its tile silhouette; it is not edited, only used or removed.
  They are listed under **Saved Elements** (click = use as the Paper tile).

---

### 3a. Cell shape — Square · Circle · Triangle · Hexagon (Oct 6, 2026)

The cell the Element is drawn for. Four icon buttons in the floatbar, on the Element and Component steps (one setting, shown on both). **Square** is the original 0–100 box and changes nothing. The others:

- **Element.** The canvas *is* the cell: Paper only inside its outline, transparent outside (big frame, turns strip, SVG/PNG export). The turns strip shows the shape's own turns — Triangle 0/120/240 + Mirror, Hexagon 60° steps + Flip H/V, Circle as Square. **Arc** on a triangle = a 60° slice pivoted on a corner, radius half a side (six close a circle); **Arc truchet** on a hexagon = bands around three alternate corners, centred on the edge midpoints (they run on into any neighbour). Every other shape — built-in, Genesis seed or uploaded SVG — is **fitted whole inside** the cell (Diego, Oct 6, 2026; it was cut to the outline, so a Circle on a triangle became a solid triangle and a seed lost its ends): its box centre on the cell's centre, the largest scale at which every outline point is inside (`fitGeoToCell` — the cells are convex, so it is exact, no search; cached). Measured: 24 shapes × circle / triangle / hexagon, 0 points outside, each whole against its square-cell drawing. The non-square canvas keeps the stage shadow, cast by its outline (`filter: drop-shadow(var(--stage-shadow))` — a box shadow would be square). So do the turns-strip tiles and the Component gallery thumbnails; their **hover / selected / saved** marks follow the cell's (or the grid's) own outline, never a square box — the strip's outline polygon turns `--ink`, a Component thumbnail gets chained 1px `drop-shadow` rings (2 in `--ink` = selected, 3 in `--tool` = saved). Outlines + turns: `Organica.shapes.CELL_SHAPES` (each centred on 50,50 — the triangle's centroid, so it pokes above y 0).
- **Component.** Columns/Rows give way to **Grid shape** (Hexagon · Triangle · Diamond · Square — only what the cell shape can fill; triangles can't make a square) and **Grid size** (1–4, cells along each side). Cell counts at sizes 1–4: triangle cells → Hexagon 6/24/54/96, Triangle 1/4/9/16, Diamond 2/8/18/32; hexagon and circle cells → Hexagon 1/7/19/37, Triangle 1/3/6/10, Diamond and Square 1/4/9/16 (hexagons: stepped edges, offset columns; circles: packed, Square = square packing, Paper in the gaps). The Component canvas is the grid's own outline. Rules: Identity, Radial (each cell turned towards the centre; on triangles the Arc's pivot corner goes to the nearest corner), Checkerboard (up/down on triangles; a true checkerboard on square-packed circles; on hex-packed cells — every hexagon grid, packed circles — alternating lines of cells, each differing from 4 of its 6 neighbours, since no two-state pattern can do better; by position since Oct 7, 2026 — it was the cell's number, `i % 2`), Random, Exhaustive — every turn a step of the shape's own; the others grey out ("… needs a square cell"). **Show grid** (floatbar, Component) draws each cell's outline and, on a cell-shape lattice, the **Grid shape that wraps the cells** as a dashed `--tool` guide — the triangle round three packed circles, the hexagon round seven, the diamond, the square — so the Component reads as one shape, the way it sits in a Symbol grid (`gridWrapper`: the tightest polygon of that shape, per edge the support of every cell point, the orientation of least area; measured on 44 cell × Grid shape × size cases: right side count, no cell outside, every edge touching). The gallery thumbnail grows its viewBox to take it in. Screen only, never exported. Changing Grid shape, Grid size, Columns or Rows after a Generate runs the current rule again on the new grid (Manual brings back the starter set). **Cell size** was removed from the panel (Oct 6, 2026): every view fits the Component to its box, so it changed nothing visible — the output size is set at export (×1/×2/×4, or Print).
- **Symbol.** Fit **Match cell** (floatbar + Cell properties): an Element drawn for a cell shape is laid exactly onto a cell of that shape (centroid, corner to corner, turned to the cell's pose — down triangles, pointy-top hexagons); the cell's own turn snaps to the shape's step. Any other cell falls back to Contain.
- **Cell-shape Components in any Symbol grid** (Oct 6, 2026; replaced the short-lived "Component" grid generator). A Component with a Grid shape set to **Match cell** sits on ONE small-cell lattice shared by every such Component of that cell shape in the Symbol — one small-cell size (the median of their Contain fits, grown by Overlap), its turn snapped to the lattice's symmetry (60°, square packing 90°; no flips), its position snapped so its small cells land on the lattice (origin = the frame centre). So neighbours line up exactly on any grid (Rectangular, Bento, Hexagonal, Voronoi…), lines run on, and Shared cells can tell whose cell is whose. Code: `alignedPlacements` (+ `latticeBasisOf`). Measured: 5 grids × 11 Grid-shape kinds × Overlap 0/40 % × turns — every small cell on the lattice. Arrange → Fit offers Match cell. Gallery tiles 16–23.
- **Component → Blend** (Role section, Oct 6, 2026): **Normal** (default) · **Multiply** — where the cells' inks overlap (raise Scale in Look & place, or the Scale axis), they mix instead of the later covering the earlier; it multiplies with the Paper too. Saved as `entry.blend` only when Multiply (older Components = Normal), and carried into Symbols, Library thumbnails and exports (SVG `mix-blend-mode`, canvas `globalCompositeOperation`; measured PNG = SVG). Container / Mask draw as before.
- **Symbol → Overlap & blend** (its own section, every Symbol grid, Oct 6, 2026; saved with the Symbol as `entry.overlap`, older Symbols open as Paper under / 0). **Overlap** (0–100 %): each cell's content grows past its cell; aligned Components grow their shared lattice instead (they stay aligned). Clip to cell turns off when Overlap goes above 0. **Blend**: **Paper under** (default — every Paper first, all inks on top, as before), **Normal** (each content's Paper right under its own ink; the later one covers), **Multiply** (no Paper; each content multiplies onto the page as one ink — the canvas draws it on its own layer, `inkLayer`, to match the SVG's `mix-blend-mode`), **Shared cells** (needs aligned Components — Match cell + a Grid shape: a small cell two cover is drawn once, by **Drawn by** — Nearest centre · Alternate · First · Last; `shareComponentGridCells`). Code: `symbolLook`, `overlapGrowth`, `syncOverlapSection`. Measured: PNG vs SVG ≤0.1 % of pixels in every Blend.
- **Saved data.** A seed carries `cellShape` only when it isn't square; a Component grid carries `lattice: {shape, rings, outline}` (rings = Grid size). Missing = square — every existing file and the regression baseline are unchanged.
- **Not yet:** layered Elements aren't cut to the cell; Arc truchet's square-only rows still show on a hexagon; Symbol rules still make 90° turns (Match cell rounds them); Element as Paper tile is square-only; the Transform axes label still reads 0/90/180/270°.

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
  the icon at full strength, as everywhere in the bar): **Show grid** (the grid's own lines; *Show loaded grid* until Oct 8, 2026), **Clip to
  cell** (content cut at the cell's edge — the one that is in the export and saved
  with the Symbol), **Show cover crop** (what a Cover fit crops away) and **Show
  guides** (Oct 5, 2026 — was *Show column/row guides*): every helper line on the sheet, the
  column/row guides (rectangular grids) and the dashed outlines of empty cells (every grid shape;
  on a rectangular grid only the outer frame, the guides already draw the inner borders). Off = a
  clean sheet; cells still highlight on hover and drag. Only the guides start on; a new grid starts unclipped (it
  started clipped until Oct 2, 2026 — saved Symbols keep what they were saved with) — except a grid of
  **polygon cells** (hexagons, triangles, Voronoi…), which starts with **Clip to cell on** (Oct 5, 2026):
  there Cover and Stretch size the content to the cell's bounding box and would spill into the
  neighbours.
- **The empty Symbol is its grid** (Oct 5, 2026 — grid first, content second). Entering the
  Symbol step with no grid builds the panel's grid (canvas, generator, parameters) with every
  cell **empty**: each one drawn with a dashed outline while *Show guides* is on (`--border-strong`, the file's 6 5 dash;
  hover = ink + a light wash), a drop target for the Library rail and a click target for
  Choose content. Building by hand needs no button. While every cell is empty the panel is the
  grid's source: a change to the canvas or the generator rebuilds it live (nothing to lose);
  once anything is placed, *Generate grid in canvas* does that. Outline contrast on the default
  Paper: 3.65:1 light, 4.73:1 dark.
- **The Symbol floatbar** (Oct 5, 2026) — three named groups (`.org-floatbar__group`) between
  separators: **Symbol** (Fill the grid · Variations · Clear) | **Fit in cell** (Contain · Stretch ·
  Cover · Fixed size · Anchor) | **View** (loaded grid · clip · cover crop · guides), then Export.
  A pressed Fit or View button keeps its own wash while you hover others; the moving highlight
  follows the pointer only.
- **Fill the grid (floatbar)** (Oct 5, 2026; labelled *Generate* until the same day) — the first icon of the Symbol step's floatbar (`generate`: a grid with two cells filled,
  `#btn-symbol-generate`). On an empty grid it fills the **current** grid (borders dragged by hand
  are kept) with Suggest or Arrange, as the Fill section says, then the arrival plays: one pane per
  cell shows a filtered copy of the Symbol that goes from blank paper to a few blurred,
  high-contrast, rippling masses and then to sharp, one cell after another in a scattered order
  (1 s per cell, the whole sweep about 2 s; nothing with *reduce motion*; preview only, the panes
  take no clicks). Otherwise it stays visible but disabled (`aria-disabled`, still focusable), the
  reason in its tooltip: *Fill the grid — clear the Symbol first* (a filled grid — the Symbol has no
  undo, so Fill the grid never overwrites a composition) or *Fill the grid — save an Element or a Component
  first*; a click shows the reason as a notice. (Until Oct 5 it sat in a glass pane over the
  empty grid.)
- **Clear Symbol (floatbar)** (Oct 5, 2026) — an `eraser` icon, third in the Symbol
  step's floatbar (after Fill the grid and Variations, in the same group), shown with the grid and **disabled while every
  cell is empty** (nothing to clear). **Hold to
  confirm** (`data-hold`, Oct 5, 2026): press and hold 1 s (or Space / Enter) — a red ring
  fills round the button and the eraser's tip rubs out the line under it; let go early and nothing happens. Its tooltip reads *Clear Symbol —
  hold to confirm*. A plain click (voice control, switch access) falls back to two clicks
  (*Clear Symbol — click again to confirm*). After clearing, focus goes to Fill the grid. It empties every cell and keeps the
  grid (borders dragged by hand too), clears the selection and the variations, so the
  Symbol is back to its empty grid. Saved Symbols are not touched.
- **Resize columns and rows by dragging** — on any rect grid that has tracks
  (Rectangular, Bento, Wave, a plain square…) each inner border shows a dashed
  handle on the preview (never exported). Drag it: the two tracks either side trade
  size, the total stays, the cells keep their content, and a track never goes below
  4% of the grid. On *Rectangular* the Column / Row weights fields follow live
  (mean 1, two decimals), so *Generate grid in canvas* reproduces the proportions.
- **Components pool** — the saved Components the Symbol is built from. It fills itself, with no
  panel section (the *Components · N in the pool* section with its weights and *+ Add Components…*
  was removed on Oct 4, 2026, `40b71e8`): the first Symbol visit takes the 8 most recently saved,
  weight ×1, and a Component saved later joins it straight away (the oldest leaves when 8 are in).
  With no saved Component the pool is the saved Elements instead (§7).
- **Fill**
  - **Suggest** (default) — proposes whole Symbols from the palette (§6a).
  - **Arrange (palette)** — places the palette by a rule: Random (by weight),
    Checkerboard (first two), Rows, Columns, Diagonal bands, 2×2 blocks, Rings,
    Sectors, Wave bands, Up/down (triangles). The n-th class takes the n-th
    Component. Fit: Stretch or Contain. Locked cells stay.
  - **Rule** — transforms only (Oscillator, Checkerboard, Rows, Columns, Radial,
    Wave, Orientation, Random), lock-aware, with Reset & apply to all. Each rule snaps its own angle: Radial and Wave by their **Snap to 90°** box (on by default), the others are 90° steps by construction. Since Oct 7, 2026 the applier keeps the rule's angle (folded into 0–360°) — before, it always snapped to 90°, so Snap off did nothing. A free angle shows in Cell properties → Rotation as its own option ("Set by the rule").
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
  - **Fit**: four line icons — Contain / Stretch (was *Fill* until Oct 5, 2026) / Cover / Fixed size (a wide cell and what a round
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
  - Contain / Stretch / Cover that would place every target exactly as it is now → that icon off,
    its tooltip says "same result as now" (a round content in a square cell: the three are the
    same picture). Fixed size stays available — it changes what the cell does next (its own Size);
  - Anchor when no target has room to move in (the content is exactly its cell) → off. Both write the same per-cell fields as Cell
  properties → Fit.

- **No seams.** Cells never show a light line where they meet: nested Components'
  papers are painted first under all ink, and each cell's content and clip reach
  0.1% of the page past its border (the Component's own cells too), so neighbours
  overlap instead of touching. With *Stretch*, a polygon cell's content is centred on
  the cell's box, not its centroid (a hexagon cut by the margin stays covered).
- **Contain in a polygon cell** (Oct 5, 2026) fits the content inside the
  cell's SHAPE, not its bounding box: the real outline of a Seed (sampled along its path; a Component's
  frame) turned with the cell must lie inside the polygon. It only shrinks what would stick out — the
  requested size (the box's contain × the cell's Scale) if it already fits, else the largest that does
  (a square in a 216 × 187 hexagon: 137, was 187 and spilled into the neighbours; that spill, clipped,
  was the white diamonds at the hexagons' side corners). Anchor slides it towards its side as far as it
  stays inside. Cover / Stretch / Fixed still use the box (Clip to cell does the cut). Rect grids are
  unchanged; the classic hex Figures are byte-identical (their content already fit).

### 6a. Suggest — how the variations are made

- Each palette Component is rasterised once into an ink mask of its own tight
  frame (cached by name + save time), so any point of any turned/flipped placement
  can be asked "ink or paper?".
- The grid's real adjacencies: rect cells share a vertical/horizontal segment
  (bento spans included); polygon cells share an edge, including partial ones
  (Loom's triangular lattice offsets its rows) and curved borders made of many
  pieces (Radial). One pair per two neighbouring cells, with 10 sample points
  along the shared border, nudged into each side.
- A variation = per cell {Component, turn}. Square Components in square-ish cells
  take any of the 8 turns/flips; otherwise only 0°/180° (± flip).
- Scores, weighted by the three sliders:
  - **Continuity** — the two sides of every shared border agree (ink meets ink
    counts most, paper meets paper a little, a mismatch costs);
  - **Balance** — ink spread evenly over a 3×3 split of the page, and each
    Component used as often as its weight;
  - **Surprise** — fewer identical neighbours.
- Generators: every Arrange rule with each cell's turn chosen for continuity; a
  beam search (width 4) over Component × turn, cell by cell; a weighted mix with
  the same turn search. Ranked, exact duplicates dropped, up to 12, deterministic per
  seed. The first is put on the sheet at once.
- **Variations (floatbar)** (Oct 5, 2026) — the icon next to Fill the grid (`variations`,
  `#btn-sug-dock`), with the count in a small ink-on-paper circle at its top right (99+ cap;
  accessible name *12 variations*). Always in the bar: with no variations it is disabled
  (`aria-disabled`, tooltip *Variations — none yet*, no badge). It opens
  a glass strip of 48px thumbnails anchored just above the floatbar and centred with it
  (`#fvs-sug-panel`, a sibling of the bar; its bottom measured from the bar on open; scrolls
  sideways, the wheel over it never zooms the sheet); the current one has the tool-colour border.
  The score is in each thumbnail's tooltip and accessible name ("Use variation 3: Continuity
  search · continuity 97% · colour 97%"). Click one to take it (the strip closes); **More like this** re-draws
  8–20% of the cells of the current Symbol and re-turns them, and opens the strip (it applies
  nothing by itself). Esc, another floatbar flyout, or leaving the step closes it; not remembered
  between visits. Locked cells are always kept. (Until Oct 5 it was a pill top-centre over the
  sheet.)
- **Build a Figure from this Symbol — removed** (Oct 5, 2026, Diego). The floatbar button and
  its function are gone; a Figure whose first level is a Symbol adopted earlier still opens.
- On a grid whose cells don't share borders (Circular) continuity doesn't apply
  and the tooltip omits it. On hexagons/triangles a square Component is deformed
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
  51 / 31 / 18…), each ink spread over the page, neighbouring inks distinct. A variation's
  tooltip shows `continuity N% · colour N%`. With one ink in the pool nothing changes.
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
The **Figure** step (step 4, after Grid; it was ★ until Oct 7, 2026) is one screen for all of it: pick a preset or set the
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
  It uses the Element's pattern settings (Look & place) and has no ink; its card hides Style, and
  its Seed is ignored. Its X / Y / Size / Rot move, scale and rotate the pattern. SVG: a `<mask>`
  (white, pattern in black); canvas: `destination-out`.

It works in every step (Component, Symbol, Grid, export) because it is the layer stack itself.
The old Element **Content** section (and before it, *Pick underlying component…*) was removed
on Sep 28, 2026 — the role now lives only on the row.

## 7. Libraries

The saved Elements, Components and Symbols live in one place: the **Library rail**, the
floating rail on the left (`#fvs-rail` + `#fvs-rail-panel`). The right-sidebar Component and
Symbol libraries were removed when the rail arrived (Oct 3, 2026, `edafc4d`). The rail is shown on
the Element, Component and Symbol steps (not on step 4, Figure).

**Library view** (Oct 6, 2026) — everything in one place, larger: the **Library** button in the
floatbar (`library` icon, on every step, Figure included) covers the step's view with a page of
every saved **Element**, **Component** and **Symbol** plus the **Genesis seeds** (the 13 Base Seeds
and your own Genesis seeds, read fresh from `Organica.store.library` on open). The button is
always on — the Genesis seeds are always there, and this is where the Element picks one (Diego). A
Genesis seed lands **whole** on the Element canvas: every shape united, strokes outlined with their
own width, caps and joins (`svgToTileGeo` + `strokeOutlineParts`, the Paper tile's path too), evenodd
holes kept; when Paper.js's union drops part of a shape (Petal turn's four petals touching at one point)
the parts are kept side by side, wound clockwise. Measured Oct 6, 2026: all 13 Base Seeds and 12
synthetic cases (rings, transforms, open / closed / zigzag strokes, round / miter / butt) match their
source at IoU ≥ 0.95 (Sun 0.997 at high resolution). It opens on **All**;
a segmented filter (*All · Elements · Components · Symbols · Genesis seeds*) and *Search by name*
narrow it; empty groups are not shown. A tile's click opens it — an Element in the Element step, a
Component in the Component step, a Symbol in the Symbol step, a Genesis seed as the Element's Shape.
Under each tile: **Rename**, **Duplicate** (*‹name› copy*, *‹name› copy 2* …), **SVG** / **PNG**
(the thumbnail's own drawing, Paper included; PNG 2000 px on the long side — screen only, no
Print), **Delete** (the rail's rules, below). Genesis seeds are read-only: SVG / PNG only. Thumbnails
stay light in dark mode (a work surface). Esc or the close button returns to the step; changing step
closes it. While it is open the rail and the variations dock are hidden. The rail stays for dragging
onto Symbol cells. Code: `renderLibview`, `libviewTile`, `openLibview` / `closeLibview`,
`libviewDownload`, `deleteSaved`.

- **Nothing to show** — on the Element step with nothing saved the toggle is disabled (`aria-disabled`,
  still focusable) and says why: *Library rail — save an Element, a Component or a Symbol first* (`railBlock`,
  Oct 6, 2026). On the Component and Symbol steps it always opens (Save all · Save Symbol live there).
- **Open / close** — the rail's toggle (**Library rail**, `grid` icon) opens it; the toggle or Esc closes it. It always starts
  **closed** when the page loads (Oct 5, 2026): its open state is no longer remembered,
  `localStorage['organica.fvs.rail']` is not read or written any more, and the old key is left in
  place, as the localStorage rule asks.
- **It never covers the work** (Oct 5, 2026): while the panel is open, the work area reserves its
  width (`#canvas-wrap`'s left padding up to the panel's right edge + `--space-5`, `syncRailSpace`),
  so the Component gallery and the Symbol sheet move right and re-centre instead of sitting under
  it; closing gives the space back.
- **Three groups** — Elements, Components, Symbols, two thumbnails per row. An empty group is
  hidden; Components stays visible on the Component step (for *Save all*).
- **A click on a tile depends on the step** (the tile's `aria-label` says which):
  - a **Symbol** tile loads that Symbol on the Symbol step (asks first if the Symbol on the
    canvas has unsaved changes);
  - on the **Symbol** step, an Element or Component tile goes into the selected cells — or is
    **dragged** onto a cell (a drop on a selected cell fills the whole selection);
  - on the other steps, a Component tile loads it on the Component step, and an Element tile
    becomes the Paper tile (*Paper Pattern = Element*).
  - **a saved Symbol goes into cells — in Compose only** (Diego, Oct 8, 2026; the same day: “in symbol the user don't drag a symbol” — in the Symbol step a Symbol tile does not drag, a click loads it): **drag** a Symbol
    tile onto a cell. Its 4 central cells (the centre cell for an odd side) start at that cell — the anchor is
    the dropped-on cell — every other cell keeps its place relative to them, and what falls outside the
    target grid is cut: an 8 × 8 Symbol fits an 8 × 8 grid, a bigger one is cut at the edges. Elements and
    Components keep the grid's structure and their own size. Code: `symbolPastePlan(entry, targets, at)`
    (`engine/11-symbol-ui.js`); in the Symbol step a click on a Symbol tile loads it, as before;
  - **in Compose** (Oct 8, 2026) the rail is the left side (the node bar is hidden while composing,
    `rt.railTarget`): an Element / Component tile dragged onto a cell, or clicked for the selection, becomes a
    content region rule added after the others (so it wins); a Symbol tile dragged onto a cell, or clicked
    (= at the first selected cell), becomes a **paste** region rule (below).
- **Newest first** (Oct 5, 2026) — each group (Elements, Components, Symbols) lists the most recently
  saved at the top, so a save is in view at once (at the end it sat below the panel's fold). A
  one-click save (the quick-save circle) shows no notice — its ✓ says it (Diego, Oct 6, 2026: the
  *Saved as …* toast removed); *Save all* still says *Saved 4 Components*.
- **Double-click to edit** (Oct 5, 2026) — double-click an Element tile and the Element step opens
  with it loaded (its shape, layers, look, palette and Paper); double-click a Component tile and the
  Component step opens with it. A mouse single click waits a moment (≈0.2 s) for a possible second
  click, so double-clicking never also places the tile or makes it the Paper tile; Enter on a focused
  tile and a Symbol tile act at once. An Element saved without its settings can be placed, not edited
  (the rail says so).
- **Saving** — Elements and Components save from their own thumbnails (the quick-save circle);
  *Save all* (Components group) saves every Component in the gallery, skipping those already
  saved. The Symbol saves from the rail's footer, **Save Symbol** (was *Save library* until Oct 6, 2026), which asks for a name
  (Symbol step only, enabled once a grid exists).
- **Rename / delete** on each tile (pencil and trash, shown on hover or focus). Rename opens a dialog
  and asks again if the name is taken. Renaming a Component repoints saved Symbols, the Symbol
  pool, Container/Mask references and the Grid pick; renaming an Element repoints every Paper
  tile that names it. **Delete** is one click, no confirm (Diego, Oct 6, 2026: "delete is delete") —
  in the rail and the Library view. **Deleting never changes another creation** (Diego, Oct 6,
  2026): a Component still used (Symbol cells, saved Symbols, Container/Mask) leaves the library but
  is kept, hidden, under a new key (`‹name› (deleted ‹id›)`, every user repointed to it), so those
  creations draw exactly as before; an Element that is the open Paper tile is kept hidden the same
  way. Hidden entries nothing uses any more are swept on the next delete (`sweepHiddenSaved`).
  Elements placed in Symbol cells are copies already, so deleting one changes nothing. (Until Oct 6,
  2026 removing a used Component asked first and left its cells empty / a missing marker.)
- **Rectangular Components take their block** (Oct 4, 2026). On a regular rectangular Symbol
  grid (every column × row once — Rectangular and its kin; not polygons, not merged bento cells)
  a Component occupies the Symbol cells its proportion asks for: columns × rows reduced by their
  common factor — 1×4 → 1×4 cells, 2×4 → 1×2, 2×3 → 2×3; a square Component (1×1 … 4×4) stays in
  one cell. A turn of 90° / 270° swaps the block. Arrange places blocks top-left first and skips
  the cells a block covers (they become empty holes under it); placing a Component from the rail
  or Choose content does the same where it fits. Where a block does not fit — the grid's edge, a
  cell already covered, a locked cell — the Component sits in its own cell, reduced, as before.
  Stored as `span: true` on the anchor cell; the block is resolved at draw time
  (`symbolSpanLayout`), so preview, SVG, PNG, selection and hits agree. Fit acts on the whole block;
  **Fixed size** is a size *per cell*, so a block multiplies it by its length in cells along its
  long side (`fixedK`, `placeInBox`) — a 1×2 Component in Fixed keeps the same scale per module as
  a square one in a single cell (until Oct 5, 2026 it shrank to half its block).
  **Each module in its own cell** (Oct 5, 2026): when the block's cells differ in size (a border
  dragged by hand, a Wave grid), the Component's modules follow them — module 1 in cell 1, module 2
  in cell 2 — instead of being spread evenly over the block (`modulesToBlockCells`: the frame is cut
  in one band per block cell, each band takes its cell's share and its modules move / stretch with
  it; follows the cell's turn and flips). Equal cells draw exactly as before. SVG and PNG agree
  (0 differing pixels measured). Suggest and polygon / Loom
  grids stay one cell per Component for now. Symbols saved before this are unchanged.
- **A Symbol from Elements only** (Oct 4, 2026). With no saved Component, Fill the grid builds the
  grid anyway and fills it from the **saved Elements** (the latest 8, weight ×1, `elementPool()`),
  each placed as from the library rail. Arrange rules work as with Components; Suggest reads
  Components only, so with Elements alone the cells are arranged (the hint says so). As soon as a
  Component is saved, the pool is the Components again.
- **Saved Elements in a Symbol keep their colours** (Oct 4, 2026). A saved Element placed
  from the library rail carries the palette it was saved with (`cell.ownColors`). With
  **Colour by → Element's own colours** — the first option and the default — the cell draws
  in it: its first ink for the shape, every layer's ink for a stack (through `withEntryInks`,
  like a Component's own palette). Pick any other rule (By cell order, Checkerboard…) and every
  cell, saved Elements included, follows that rule on the current palette. Under the default the cell also
  draws the Element's own **Paper** (colour + texture, `cell.ownPaper` / `cell.ownAppearance`) under it,
  in the Element's frame — as its library thumbnail shows it, like a Component's paper. Cells without a
  saved Element, and every Component-step cell, are coloured by cell order under the default.
  Cell properties → Colour still overrides a single cell. A saved Component always keeps its
  own palette.
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
- **Starting points** live in the Figure tab (New figure… → the "Classic · …" seven:
  circle, leaf block/wave/outline/two-ink, pinwheel, kaleidoscope), where the whole
  chain incl. the Grid repeat is visible. The Element panel's "Start from a recipe"
  was removed Oct 4, 2026 — it landed on Component and its repeats showed nowhere.

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
touches `fvs/` or the shared files Flexible Visual System uses. Since the split (§11) the battery runs inside
`with (window.__fvs)` — the test surface puts every export there — and awaits `loadFigureTier()` first.
`scripts/test-fvs-qa.sh` adds boot health, every view in both themes, export parity and the lazy Figure check
(baseline `fvs/_qa-baseline.json`); `scripts/test-fvs-ui.sh` drives real mouse journeys; `scripts/test-fvs-perf.sh`
times Component saves (click → painted frame) across every cell shape × grid shape × size and traces the paint / GPU
work of each cell shape (header of the script for the options).

Not covered: PNG byte content, cross-browser behaviour (see the backlog in
CLAUDE.md).

## 11. Architecture (Oct 2026 — the split)

Until October 2026 the whole tool was one 903 KB `fvs/index.html` with a 736 KB inline script. It is now:

| Part | What | Loaded |
|---|---|---|
| `fvs/index.html` | head, markup, one `<script type="module" src="/fvs/js/main.js">` (~120 KB) | always |
| `fvs/fvs.css` | the tool's own sheet (was the inline `<style>`; linted by css-lint, audited by ds-audit) | always |
| `fvs/js/engine/NN-*.js` | **engine** — model + logic, no DOM UI (~303 KB): the Seed geometry (`SEED_TYPES`, Split, Cut out, Irregularity), `getSeed` / `getGrid` / `getElementAppearance`, rule builders, every renderer (`buildComponentSVG`, `drawComponentCanvas`, `buildSymbolSVG`, `drawSymbolCanvas`, `tierSVG`), Suggest, colourways, Loom models, Figure checks and mutations; the model (`state`, `live`, the saved-item stores) and the panel reader | first |
| `fvs/js/NN-*.js` | **UI** by component view: 00 core · 01 geometry · 02 Element panel · 03 rules · 04 appearance · 05 Component render · 06 Component UI · 07 library · 08 Symbol grid · 09 Symbol render · 10 Arrange/Suggest · 11 Symbol UI · 12 shell · 15 export, rail, Library view · 99 boot | in that order |
| `fvs/js/13-figure-engine.js`, `14-figure-ui.js` (+ their `engine/` halves) | the Figure tier (~96 KB) | **on demand** — `lazy.js` `loadFigureTier()` → `figure.js`, the first time `setTier('figure')` runs |

**Order.** Each file imports by name what it uses from *earlier* files only, so modules evaluate in the
order the single script used to run (`main.js` lists them). A reference from an earlier file to a later
one — only ever made at run time, never while loading — goes through **`hooks.*`** (`fvs/js/hooks.js`):
the later file `provide()`s live getters as its first statement. Finding one in the code means "this
reaches a later file". A top-level variable that more than one file assigns lives on **`rt`** (UI-side,
7 left; values the engine needs are on `live` instead)
(`fvs/js/rt.js`: `rt.paperPatternOn`, `rt.appearanceOverride`, …) — an imported binding is read-only.

**Adding code.** Put a function in the file of its view; import what it needs from earlier files. If it
must call something in a later file, call it as `hooks.name()` and add `name` to that file's
`provide({…})`. A new top-level variable written from another file goes on `rt`. Engine files
(`fvs/js/engine/`) must stay engine: `scripts/check.py` ("fvs engine") fails if one imports a UI file
or touches a panel control, page element or UI `Organica` call. Figure code stays in its two files so
it keeps loading on demand; anything outside Figure reaches it only through `hooks` after
`loadFigureTier()`.

**Test surface.** `fvs/js/test-surface.js` puts every export on `window.__fvs` (live getters; `rt`
fields get + set), plus `__fvs.ready` / `isReady`, `loadFigureTier`, and the one test hook in the tool:
`rt.afterLoadSymbolGrid` (called by `loadSymbolGrid`, null in use — the regression battery pins *Clip to
cell* with it). Figure names throw "await __fvs.loadFigureTier()" until Figure has loaded.

**The panel reader (Oct 2026).** The engine never reads the page. A control's value comes through
`pv(id)` (its value, like `ctrl(id).value`), `pc(id)` (a checkbox, like `ctrl(id).checked`), `pr(id)` (either)
and `val(id)` (`parseFloat(pv(id))`), all in `engine/00-core.js`. They ask **`panelSource`**, which the UI
points at the controls once (`setPanelSource`, in `00-core.js`): the same values, read the same way, so
nothing drifts — there is no copy to keep in step. A port plugs its own state into `setPanelSource`
instead. **Reading** a control anywhere: use `pv` / `pc` / `val`. **Writing** one stays UI
(`ctrl(id).value = …`).

**`live`** (`engine/00-core.js`) holds what render code and the UI share at run time — the render
overrides (`appearanceOverride`, `variantAppearance`, `inkPaletteOverride`, `layerInkOverride`),
`paperPatternOn`, the Symbol caches, the stack draw counter, `contentOverlayFit`, `lastFigureMeta`. It is part
of the model, like `state`; a new value of that kind goes there, not in a top-level `let`. The engine's one
page call is `offscreenCanvas(w, h)` (an unmounted canvas for compositing and raster checks).

**What stays UI.** Everything that builds, wires or reads the page beyond a control's value: panel
syncing, galleries, the rail and Library view, overlays, drag, the Figure runner (`runFigureRecipe` drives
the panel), exports that download.

**How it was made.** Mechanically, on branch `fvs-split`: `scripts/fvs-split.mjs` (anchor-based cut into
classic files, every line placed once, no parse-time reach into a later file) → `scripts/fvs-modules.mjs`
+ `scripts/fvs-engine.mjs` (exports/imports, hooks, rt, engine extraction, lazy Figure). Each stage
passed the regression (unchanged baseline) and `test-fvs-qa`. The generators were deleted at the merge
(Oct 6, 2026; in git history) — **the files in `fvs/` are the source: all FVS development continues here.**

**The old single file** is archived, frozen, at `archive/fvs-single-file/index.html` (main `2fcbd69`, the last
version before the split): never edited, never linked, `noindex`. It still runs at `/archive/fvs-single-file/`
and shares the live library (same storage keys) — useful to compare against or to recover old code, nothing
more. A fix goes in `fvs/js/`, never there.


## 12. Figure graph (shipped Oct 7, 2026)

Figure is a node **Graph**: Canvas, Grid and Palette nodes (the foundation), content from the saved libraries only (**Element / Component / Symbol / Set** nodes), rule nodes, and several **Figure** nodes side by side, each showing its own variations. The plan and Diego's decisions live in `docs/DESIGN-DECISIONS.md`; this section follows the phases (all shipped; the audit of Oct 7, 2026 is §12.7).

### 12.0 Words and port colours (decided Oct 7, 2026)

- **Words** — every visible string of the graph is in `docs/UI-COPY.md` §2 (the *Figure graph* rows): Graph, Nodes (the left bar; *node bar* in docs, never "node palette"), the four categories Foundation · Content · Rules · Output, the node and port names, Section (not Frame), Variations / Vary by / Keep / Pin / New variations, Compose → Composition, Region rule, the states and notices. Use them in code and docs from the first commit.
- **Port types and colours** — `canvas · grid · palette · content · rule · composition · figure`, one `--port-<type>` token each (light + dark, ≥ 3:1 on `--paper` and `--panel`, from TuneSutra’s Riso standard inks — table in the ledger, O-34). A port always shows its label and shape as well; colour is never the only cue. Rhizome maps SVG → content, Image → figure, Grid → grid, Color → palette, Number → rule, Points → composition.

### 12.1 The pure evaluator (Phase 1)

`evalFigure(recipe)` (`fvs/js/engine/16-figure-eval.js`, Figure chunk) renders a recipe v2 to `{ svg, tier, levels: {component, symbol}, metas, stats, shapes }` **without touching the page or the user's work**. It is what every Figure node calls, once per variation.

- **Same output as before.** It takes the steps `runFigureRecipe()` takes through the panel as model-only operations. `scripts/test-figure-eval.sh` renders all 25 catalog figures and checks them against `fvs/_figure-eval-baseline.json` (recorded from `runFigureRecipe()` on a fresh page per figure, `--record`): byte-identical.
- **Pure.** It runs inside `withFigureSandbox(fn)`, which
  - starts from FVS as it was at boot (`figurePristine` in `engine/00-core.js`: `state` and `live` cloned, plus a **virtual panel** of every control, captured by `captureFigurePristine()` in `fvs/js/00-core.js` just before `markReady`), so the result depends on the recipe alone;
  - points the panel reader (`pv` / `pc` / `pr`) at the virtual panel. A value set on it is sanitised the way the real control would hold it (a detached copy of the control is asked), so a range clamps and snaps, a select drops an unknown option;
  - keeps Library writes (the Grid's auto `Tile ·` entry, a sealed Symbol's Components) in memory;
  - puts every original object back afterwards.
  The test checks that `state`, `live` and every panel control are unchanged after a run, and that a figure gives the same SVG after another figure and on a changed panel.
- **Fast.** No DOM events, no re-render: about 0.4 ms per catalog figure warm (slowest 1 ms).
- `runFigureRecipe()` (`fvs/js/13-figure-engine.js`) drives the panels; no screen uses it any more. It is **test-only** since Oct 7, 2026: the Figure bundle no longer loads it — the regression page and the QA / eval scripts call `__fvs.loadFigureTestRunners()`.

### 12.2 The Figure graph on screen (Phase 3a)

- **Layout.** Left dock = the node bar (`#fg-nodebar-dock`, an `.org-dock`): Foundation · Content · Rules · Output; Content lists the saved Elements and Components as thumbnails; drag onto the graph or click to add. Right panel = the selected node's settings (`#fg-inspector`); while the graph is on screen the panel shows **only** it — the global Palette and Rules sections are hidden (`#panel:has(.tier-block.is-graph.active)`), since every colour now lives in a Palette node. Bottom floatbar group `#fb-figure-actions`, in this order: New Figure… · Undo · Redo · Delete · Fit all · Fit selection, then the FVS-wide Library and Export.
- **Nodes.** Canvas (the Symbol step's own Canvas controls), Grid (Loom's generators, inside the Canvas), Palette (inks + Paper + Colour by), Element / Component (a saved entry + a copy of it), Figure (Fit in cell, Clip to cell). Default names Canvas 1, Grid 1 … are given when a node is made; the card shows the type above the name.
- **A Figure always has a Canvas and a Grid.** Adding a Figure attaches the selected / last Canvas and Grid, or makes them. The one feeding a Figure can't be deleted (Delete is `aria-disabled`, the reason is its description and a notice).
- **Saved.** The graph being edited autosaves to `Organica.store('fvs-figure')` → `Current graph`; the view (zoom, pan) to `localStorage['organica.fvs.figure-view']`.
- **Colour.** A Palette recolours the content it feeds: Elements by its *Colour by* rule, Components through their colourway (the Palette's inks + Paper; the Component's own colour rule still picks which ink goes where). **Keep own colours** on the Figure leaves every content in the colours it was saved with.

### 12.3 The old Figure UI, retired (end of Phase 3, Oct 2026)

Diego's go-ahead, Oct 7, 2026. The graph is the only Figure UI now.

- **Removed:** `fvs/js/14-figure-ui.js` (the pipeline strip, the starting gallery, the step panel, the Advanced form with its JSON box, the paint toolbar, the on-canvas handles, the Variations overlay, the reference-image overlay, the Checks report), its markup in `fvs/index.html` (the old Figure view, the Figure panel block, the global *Rules* chip section) and its CSS; from `engine/14-figure-ui.js` the two functions that read the Advanced form (`figureRecipeFromForm`, `isFormRule`).
- **Kept, because the graph and the next phases use them:** the recipe runner `runFigureRecipe` (`13-figure-engine.js`, what the evaluator's baseline is recorded from), every pure piece of `engine/14` — the catalog, `describeRule` (the Cell rules chips), `paintCell` / `FIGURE_TOOLS` (Compose, Phase 5), `applyHandle`, the mutations / `figureNeighbours` / `figureShuffle` (Variations, Phase 4), `figureChecks`, `normMask` / `maskIoU` — and `rasterMask`, moved from the UI into the engine (offscreen canvas).
- **Regression battery:** 50 cases retired with the UI they drove — the strip (`figstrip:*`), the form round-trips (`fig:form:*`, `fig:hex:roundtrip:*`, `fig:rec:roundtrip:*`, `bridge:form`), the old tab wiring (`fig:tier`, `fig:json:error`), the step panel (`paint:step*`, `paint:formkeeps`, `paint:isformrule`, `fig:seedmain:*`), the on-canvas handles (`handle:*` except `handle:toggle`), the toolbar / shortcuts / overlay (`play:shuffle:ui`, `play:locks:ui`, `play:shortcuts`) and the six-action journeys (`ux:*`, `ux12:*`, `fig:switch`). 0 changed; 346 cases remain. The engine behaviour those cases also exercised is covered by `scripts/test-figure-eval.sh` (25 recipes byte-identical, purity) and `scripts/test-figure-graph.sh` (the 25 built-ins as graphs, byte-identical).
- **QA:** the Figure gallery view check is now *New Figure…* (the Built-in Figures); export parity runs the recipes through `runFigureRecipe` — the same 15 hashes.

### 12.4 Many outputs (Phase 4)

- **Variations** — on every Figure node (UI-COPY §2): *Variations* (count 1–12, default 4) · *Vary by* (Random seed · One change · Several changes) · *Random seed* · *Keep* (Content · Palette · Cell rules · Grid · Rotate & mirror) · ~~*Layout* (One row · Rows)~~ — removed Oct 8, 2026: the variations are child Figures, §12.8. A variation changes the Figure's own inputs (`varyInputs`, `engine/17`): the Grid's size or seed, the Palette's hue (contrast-solved) or ink order, how several contents spread over the cells, a cell rule, a turn / mirror once there is a repeat. Variation 1 is the Figure as set up. Deterministic per seed; a variation identical to another is replaced. **Pin** keeps a variation through **New variations**; **New Figure from this** = a sibling Figure with the same wires and that variation fixed (`params.fixed`, chainable).
- **Sets** — a Set node (Content) is an ordered list of saved Elements / Components, saved as **saved Sets** (`Organica.store('fvs-sets')`, listed in the node bar). Wired into a Figure with **Variations per item** on (default), each item gets its own group of variations, labelled by the item; off, the items are mixed over the cells. A list travels on a thicker wire. At most `FIGURE_RENDER_CAP` (24) figures per Figure node — fewer variations per item, then fewer items, and the card says so (ledger O-37: 48 froze the board for ~0.7 s at the Phase 4 checkpoint). **New Figure from this** on an item's variation makes a Figure of that item only (`params.onlyItem`, by name then place; *Use the whole Set* undoes it); the fixed variation carries the **Keep** it was drawn with, so the copy draws the same figure.
- **The board** — **Sections** (⌘G / *Add section* around the selection; drag the label to move what is inside; rename in place; resize; Delete removes only the section); a built-in Figure opens inside its own section. Below 50% zoom cards become chips (names at a constant size, previews kept). With nothing selected the panel lists the Figures (with their foundation) and the Sections — a click fits the view. A committed change to a shared Canvas / Grid / Palette pulses every Figure it feeds.

### 12.5 Compose (Phase 5)

- **The mode** (ledger O-32): double-click a Figure or *Compose…* → the Figure's own cells (its first level, before any repeat) on a light sheet with a selectable outline overlay; breadcrumb *Graph › Compose ‹Figure›*, *Done* / Esc back to the graph at the same view; *Applies to all ‹n› variations of ‹Figure›*. The floatbar is Done · Undo · Redo (+ Fit in cell and View since Oct 8, §12.5a); the left dock holds the saved items to drop (*Content*). ~~The selection tools Row · Column · Similar cells · Range~~ were removed Oct 8, 2026 — Compose selects as Symbol does (ledger §2).
- **The Composition node** — created and wired with the first rule (one undo step with it), named *Composition n* — is an ordered list of rules `{ when, do }` applied after the Cell rules (`applyRulesToContent`, `engine/16`): `when` is the Cell-rule selector plus `at: [[row, col], …]` — clicked, ⌘-clicked and dropped-on cells are stored by **grid address**, so they name the same cells when the Grid changes (a grid whose cells share an address falls back to `index`); Range stores a `row` × `col` box; the (retired, Oct 8) tools stored `row` / `col` / `class` / `ring` / `parity` — still read, so older Compositions draw unchanged; `do` adds, to the Cell-rule actions, `content` (a saved Element / Component dropped in), `toggle`, `color` (a Palette ink), `symbolRule` (a Symbol-step rule over the region: oscillator, checkerboard, rows, columns, radial, wave, orientation, random — with that rule's settings from the Symbol step and its own seed), `arrange` (the region gets the Figure's own content by an Arrange class) and `pattern` (Lines / Crosshatch / Dots / Concentric — a per-cell appearance patch, `cell.appearancePatch`, honoured by the Symbol renderer for Element and Component cells; absent = byte-identical output).
- **Colours** — a Component a rule puts in a cell (drop, Arrange) takes the Palette's colourway like the Figure's own Components (`first.paletteColourway`), unless *Keep own colours*. A live Arrange (`arrange.live`, the default from the panel) lays out the content feeding the Figure *now*, not a copy taken when the rule was made.
- **Shared** — a Composition feeding other Figures says so (*Shared with Figure 2 — edits change both Figures.*) with *Make a copy for this Figure* (the copy is rewired to this Figure only).
- **Chips** — hover / focus outlines the rule's cells on the sheet; a click selects them; seeded rules (Symbol rule, Arrange) have *New random seed*.
- **Survival** — a Composition reaches every variation; a rule naming cells the grid no longer has is kept and reported per rule (`composeLost` → `{rule, cells, none}`): *Region rule 3 (row 2, column 9 → Empty): row 2, column 9 is not in this grid any more — kept, not drawn.* — or *it matches no cell in this grid* for a row / column past the edge — each with *Delete region rule n*. The notes follow every new result of the Figure.
- ~~Quick tools (Toggle · Empty · Filled · Rotate · Flip) are text buttons in the panel~~ — removed Oct 8, 2026 with *They get*; see below.

#### 12.5a Compose = the Symbol step's cell editor (Oct 8, 2026)

Diego, Oct 8, 2026: Compose has "exactly the same" design and features as the Symbol step (ledger §2, *Compose = the Symbol step's cell editor, over region rules*). Built as one renderer per Symbol block with a **target**, not as copies (`3384f7b` … `da0734a`):

- **Panel** — three sections, in order: **Composition** (shared notice, selection hint), **Fill**, **Region rules** (the list: drag / ⌥↑↓ reorder, on/off, *New random seed*, Delete, lost-cell notes). The quick buttons and *They get* are gone.
- **Fill** — a select named *Fill mode*: **Manual · Rule · Arrange · Pattern**. *Manual* = the Symbol step's **Cell properties** (`cellPropsHTML(pre, {lock})` / `syncCellProps(pre, target)` / `bindCellProps(pre, target)` in `fvs/js/11-symbol-ui.js`; Symbol mounts it with prefix `''` and `SYMBOL_CELLS`, Compose with `fgc-` and `COMPOSE_CELLS` in `17-figure-graph.js`): Selected · Content (*Choose…*) · Shape · Rotation · Flip · Fit · Cover axis · Scale / Size · Colour · Padding — no Lock row (rule order and on/off do that). *Rule* = Symbol's rule select + the rule's own controls (`#rp-<rule>` cloned with an `fgc-` prefix and read through `SYMBOL_RULES[x].fields`, the one description of each rule's params, `engine/11-symbol-ui.js`) + Vary + Seed + **Apply rule**. *Arrange* = Arrange · Fit · Seed + **Arrange** (the content feeding the Figure). *Pattern* (Compose only) = Pattern · Spacing · Weight · Angle + **Apply pattern**. Settings start from the Symbol step's own; with a region rule picked they edit it live, and the button reads **Apply to a new rule**.
- **One region rule per selection** — every Cell properties edit patches the rule whose `when` is this selection (the picked one, else the last cell rule with the same `when`, else a new one); a slider drag is one undo step (commit after 400 ms). The rule is described in the panel's own words: *rows 1–2 × columns 2–4 → Rotation 90° · Contain · Padding 15*. Fields a cell rule has no kind for go on **`do.cell`** (`fitMode · coverAxis · fixedSize · padding · seedParams · anchorX · anchorY`, `engine/16-figure-eval.js` `CELL_KEYS`; `null` = back to the default); a colour from the Palette is stored as `ink` (its place), a free one as `color`. Arrange carries `fit`. `evalFigure` returns `compose.cells` — each cell as drawn — for the panel to read.
- **Gestures** — Symbol's: click selects, drag = marquee (⌘ / Shift adds), click on a selected cell = **Choose content** (the Symbol step's window, `openCellContentOverlay(target)`; *Apply to all cells* hidden), click off the cells clears. That is the whole selection model (Diego, Oct 8: the Row · Column · Similar cells · Range dock tools are removed). The keyboard path stays: arrows move between cells, Space / Enter select (Shift / ⌘ add), Esc clears, then leaves.
- **Floatbar** — Done · Undo · Redo, then Symbol's **Fit in cell** (Contain · Stretch · Cover · Fixed size · Match cell + Anchor; on the selection, or on every cell when none is selected — the names say which) and **View** (*Show grid* = cell outlines — renamed from *Show loaded grid* in both steps, Oct 8, *Clip to cell* = the Figure node's own Clip, an undo step). Not in Compose: guides, track drag, *Show cover crop* (needs the Figure to draw it), Suggest, Variations, Generate, Clear.
- **Left side = the Library rail** (Oct 8, 2026, `8a35de0`): the node bar is hidden while composing; drag or click a saved item as on the Symbol step (§ Library rail). Dropped on a cell outside the selection it takes that cell only; inside it, the whole selection.
- **A saved Symbol in a Figure's cells** (`a2ec72f`): region rule `do.paste = {name, at: [row, col], entry: {gridModel, cells}, components}` — the Symbol's 4 central cells start at `at`, the rest keep their relative place, the outside is cut (`symbolPastePlan`, recomputed at every evaluation); its Components travel inside the rule (`components`, read by `evalFigure` like the Figure's own). Described *‹n› cells → Symbol: ‹name›*.
- **Not built**: the Scale range row under Vary in Compose's Rule; the cover-crop view. C8 (selection tools in Symbol) was dropped Oct 8, 2026.

### 12.6 Export (Phase 6)

- **The Export node** (Output) takes Figures on a list input. Its right panel holds every option (ledger, round 2 #2): *Variations* — all / pinned only / as set up only; *Format* — SVG, PNG, plates (one file per ink the drawing uses — read from its fills and strokes, paper left out — black on transparent); *Resolution* ×1 / ×2 / ×4 (Screen Canvases; a Print Canvas uses its own size and DPI); *Transparent paper*; then *Export n files* and *Send to Figma*. The card shows the summary first (*18 files · SVG + plates · 300 DPI*) and *Export n files*. The floatbar Export selects the Export node — creating it if there is none, wired to the selected Figures (or every Figure); with one already there it wires the selected Figures in.
- **The plan is pure** (`exportPlan(figs, p)` / `exportSummary`, `engine/17`): one entry per file — figure, variation tag, format, scale, plate / ink, paper, the Canvas. The UI encodes each (`encodeFile`, `17-figure-graph.js`): a Print Canvas wraps the SVG at its size in mm with bleed and crop / registration marks (`Organica.printSize`); PNG rasterises through an `Image` at ×scale or at the Canvas DPI, with the DPI written in (`embedPngDpi`); plates via `plateSVG`; files go out through `Organica.plateExport.run`.
- **Checks** — each Figure runs `evalFigure(def, {checks: true})` for its main result; the card carries a checks badge (*Checks pass* / *n checks to look at*), the inspector lists them.
- Tests (`scripts/test-figure-graph.sh`): plan counts (variations × SVG + PNG sizes + one plate per ink), pinned / as-set-up filters, a ×2 PNG at twice the size, a plate keeping one ink in black, a Print SVG in mm with crop marks, a Print PNG at the Canvas DPI with a `pHYs` chunk.
- A Figure wired to an Export node computes even off screen, and an off-screen (stale) result still counts in the plan.

### 12.7 After the audit (Oct 7, 2026)

- **Keyboard** — the graph's shortcuts are off while composing (Compose has its own: arrows, Space / Enter, ⌘Z / ⌘Y, Esc) and the right panel no longer counts as the board (Delete on a panel button used to delete the selected node). Enter on a focused card = its double-click (a Figure → Compose). The panel keeps its focused control across rebuilds.
- **Composition node** — its card shows *‹n› region rules (‹k› off) · ‹first rule› …*; its panel lists the rules and a *Compose ‹Figure›* button per Figure it feeds. A new one goes under the Figure's input column.
- ~~**Similar cells** selects with the rules' own matcher~~ — the tool was removed Oct 8, 2026 (§12.5a).
- **Safe loading** — `Organica.nodeCanvas.repairModel` drops unknown node types, broken wires and wires that close a loop when a graph is loaded or opened, with a notice. A v1 recipe file, or one with hand-placed cells, gets a notice instead of an error or a silently different figure.
- **Content** — a Component in a Figure draws from the copy the node keeps, like an Element (a same-named library entry no longer wins inside the evaluator).
- **Engine** — a node back on screen with unchanged inputs keeps its value and version (no recompute of its variations).
- **Fit in cell** applies on built-in Figures (`symbolFit` gives way once the user picks a fit).
- The Library rail is back on Element / Component / Symbol: the node bar's `.org-dock` beat `[hidden]`; `.org-dock[hidden]` now hides it (QA check *rail-reachable*).

### 12.8 Child Figures (Oct 8, 2026)

Diego, Oct 8, 2026: every variation of a Figure is a node of its own, so it can be wired, exported and changed on its own. Uncommitted at the time of writing.

- **The node** — type `figure-var` (`fvs/js/engine/17-figure-nodes.js`, registry `meta.hidden`: not in the node bar or the search), overline *Variation*, name *‹Figure› · variation n* (derived from its parent, `nodeLabel`; the Figure itself is variation 1, captioned *As set up*). Inputs: **Figure** (`from`, the parent link, required) and *Canvas · Grid · Palette · Content · Rules · Composition*; output *Figure*. Params `parent` · `slot` · `item` (+ `auto` while the Figure places it). `.nc-node--wide`.
- **Made and removed by its Figure** — `syncChildren()` (`fvs/js/17-figure-graph.js`) after every change (one undo step with it, `commit('sync', {amend})`) and when a graph is loaded: one child per variation the Figure draws (`wantedChildren`: slots 1…Variations−1, or per Set item with *Variations per item*), keyed `childKey(slot, item)`; a child whose slot is no longer drawn goes; a Set item reordered is found by its name. A child can't be deleted alone (`protect`: *A variation goes with its Figure — lower Variations on ‹Figure› instead* / *… or remove the item from the Set instead*). A graph saved before child Figures gets its children on load.
- **Placed** — in a column right of the Figure (its width + `LABEL_ROOM`), one under the other, 24 apart (`restackChildren`), while `params.auto`; a child moved by hand keeps its place; a Figure moved takes its placed children along.
- **Drawing** — `figureVariation(i, p)`: with no own input, the parent's variation as drawn (no recompute). With own inputs, the variation is drawn again from what the parent drew it from (`v.src` — inputs, extra, params, kept non-enumerable on the variation) with *Canvas · Grid · Palette · Composition* replaced, *Content* replaced, *Rules* added after the parent's, then the variation's change made again (`varyInputs` with the parent's Keep). Checks run on the parent only.
- **The parent card** shows only *As set up* + *· n variations*; the old Layout row is gone (the `layout` param stays in saved graphs, unread). Pin and *New Figure from this* are on the child's tile (`aria-label` *Pin variation n* / *New Figure from variation n*); pins stay on the parent's params, as before. *New Figure from this* also copies the child's own inputs onto the new Figure (Rules added, the rest replace).
- **Panel** — hint *Variation n of ‹Figure› — ‹change›*, **Select ‹Figure›** (selects and fits the Figure with its children), sub-label *Own inputs* + hint.
- **Export** — the parent's Figure output still carries every variation; Export swaps in each child's own drawing (`withChildren`), so *All variations · Pinned only · As set up only* keep their meaning; a child selected alone exports alone. A child is kept computing off screen when its Figure feeds an Export.
- **Behaviour (Diego, Oct 8, 2026 — ledger §2)**: (a) a variation opens **Compose** (double-click or its panel's Compose): without a Composition of its own it is first wired to its Figure's (shared, the notice offers a copy); with none, the first region rule makes one for the variation only; (c) the parent's output carries every variation, Export draws each from its child; (d) *New variations* redraws the children in place — same nodes, positions and wires. Still open (O-56 b): lowering Variations removes the children past the count (their pins stay on the parent).
- **Inheritance (Diego, Oct 8, 2026 — like CSS)**: an input left unwired is inherited from the Figure; a wired one wins, per port (the whole Palette, the whole Content list — not field by field); Rules are added after the Figure's (later wins on the same cells). **Declared beats generated**: an own Palette / Grid / Content / Rules is kept as if *Keep* were on for it, so the variation's change goes only to what you left alone (`figureVariation`).

Also on Oct 8 (same batch): the shared node card puts **ports and body in one row** (`shared/node-canvas.css`, SHARED-COMPONENTS §2d); the **Palette node** has the Paper pattern + *Transparent paper* (O-45 — `palette.ground` → the element's `ground`, drawn by `evalFigure` through the Appearance's own pattern controls; `paper: 'none'` when transparent); the **Grid** title adds *· n cells*; *Bleed is always in millimetres.* with Unit = in and *Margin* in *%* (Figure Canvas and Symbol step).
