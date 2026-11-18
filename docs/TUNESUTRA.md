# TuneSutra — manual

`/tunesutra/` · accent `#c93ed6` · single file (`tunesutra/index.html`)

TuneSutra is where Organica's colours are made. A palette built here has named
colours, a 0–900 scale per colour, a contrast check and a gradient; once saved
it can be picked from the colour control of every other tool.

Rebuilt Oct 1, 2026 on `shared/color.js` (`Organica.color`, OKLCH). Before that
it worked in HSL: harmonies came out unevenly bright and the scales were uneven
to the eye.

---

## 0. The library (home)

`/tunesutra/` opens on the palette library: every palette as a card.

- **Your palettes** — everything you have saved, newest first, plus a
  **New palette** card.
- **Built-in collections** (`tunesutra/collections.js`, data) — read-only. Opening
  one loads a *copy* into the editor; **Save** keeps it with your own palettes.
  Today: *Garment studies — violet* (12 three-colour studies) and *Garment
  studies — green* (12 four-colour studies), transcribed from two photographed
  pages of a colour-scheme book (role order: body, hem, collar, trim).
  They are the book's own combinations: fine as a working reference, but decide
  whether they should ship to other users before the tool is opened up.
- A card shows the palette in proportion, or on its figure when the palette was
  saved in the Figure view.

The address says where you are: no hash = the library, `#new`, `#p=<name>` (a
saved palette), `#c=<collection>/<id>` (a copy of a built-in). **← All
palettes** in the panel goes back; with unsaved changes it asks for a second
click. Saving again under the same name overwrites; deleting the palette on
screen returns to the library.

To add a collection from another page of the book: send the photo — the values
are read from the printed RGB numbers and added to `collections.js`. There is no
in-app photo reader.

## 1. The palette

- **Colours** 3–5 (6–7 only in palettes saved before). Each colour is an item `{ id, name, hex, lock }`; the `id` is
  stable for the colour's life. **A colour is named by its role** (Nov 18, 2026: Diego, *we don't
  want to change the name as it should be semantic and tokenized*) — one word, largest share
  first, the set following the count (`ROLE_SETS`): 3 *Base · Secondary · Accent*, 4 *Base ·
  Secondary · Tertiary · Accent*, 5 *… · Accent · Highlight*; a 6th / 7th is *Extra 1 / 2*. So
  adding a 4th colour renames the third Tertiary: the role follows the share. The Name field is
  gone; a name saved before stays in the data, unread.
- **Tokens** — `‹palette›-‹role›-‹step›`: the prefix is the palette's own name (*Violet 01* →
  `violet-01`, accents stripped; unsaved or not starting with a letter → `palette…`), so several
  palettes live in one project; steps **50** · 100 … 900 (the lightest is called 50 in TuneSutra —
  `stepName()`; the shared scale keeps 0 for FVS). CSS `--violet-01-accent-500`, JSON
  `{ "violet-01": { "accent": { "500": { "$value", "$type": "color" } } } }`.
- **Add / remove a colour on the sheet** (Nov 18, 2026: Diego, *togliere Colours 3 4 5 dalla barra
  di destra … un più su una scheda vuota che può generare al massimo altre 2 schede*). After the
  last card a dashed **+ card** — *Add a colour*, *2 left* / *1 left* — adds the next colour
  (`nextColour()`), up to 5; a card past the third has a **remove** button (close icon, *Remove
  ‹name›*). Both are HTML laid over the sheet (`#sheet-ctrls`), never in an export; the cards keep
  the export's places, the + card narrower at 4 colours to stay on the sheet. ⌘Z undoes both. The
  panel's Colours 3 · 4 · 5 and its colour chips are gone.
- **Select a colour** by clicking its card on the sheet (or a house shape); a card click also
  opens the picker.
- **Harmony** + **Generate** rebuild every colour except the first (**Keep on Generate** was
  removed Nov 18, 2026 — a saved lock is ignored). The first colour is the seed. Hue is rotated in
  OKLCH, so every generated colour has the seed's perceived lightness and as
  much of its chroma as that hue can hold. Pressing Generate twice gives the
  same set.
  - Analogous fans out ±15° per step either side of the seed.
  - Complementary / Split / Triadic / Tetradic have 2–4 hues of their own;
    extra colours reuse those hues at further steps of their scale.
  - Monochromatic walks the seed's own scale, lighter first.
- **Lightness spread** (0–30) moves the generated colours apart in lightness,
  alternately lighter and darker. At 0 they all share the seed's lightness —
  balanced, but with almost no contrast between them (the contrast pairs show
  it). It regenerates as you drag.
- **Undo** (button or ⌘Z) covers every change, including gradient settings.
- The hint at the foot of the Palette section names any two colours closer than ΔE 6 (OKLab ×100)
  — too close to tell apart at a glance.

## 2. The sheet

One scene list (`buildScene()`) draws the preview, the SVG and the PNG.

**Size** (Nov 18, 2026): the sheet is 900 units wide and is shown at its own size — one unit =
one CSS pixel — never enlarged on a wide screen, smaller only when the area is narrower
(`max-width` set in `renderStage`). The house is 360 units tall (`FIG_H`), so the house, the
share tubes and the colour cards fit an 800-px laptop screen.

First (since Nov 17, 2026: the figure above, the colours below) the palette
in use: **the house** (3 to 5 colours), then the shares as a **thin tube over
each colour card** — 10 px, filled in that colour to its share (the full tube
is 100%), the share above it as *52.0%* (Diego, Nov 18, 2026: the bar went
under the house that morning, then *metti le proporzioni della barra sopra i
colori come se fosse un istogramma* — mockups on the design canvas, his pick
*3 · Thin tube*). On screen the tubes **pour like a liquid** when a palette
opens or the colour count changes: a damped spring (overshoots, settles), one
tube after another, the number counting up — never on a colour edit, not with
reduced motion, never in an export (the SVG/PNG get them full). The **Gradient view was removed** (Nov 18, 2026,
Diego: *elimina view gradient*) with its Gradient-only exports; a palette saved on it opens on the
house (`view` is read as `garment`; `state.grad` is still saved, unused). A palette saved
with 6–7 colours shows the tubes alone.

**Shading — each colour's shadow noise** (Nov 18, 2026; Diego: *per ogni palette … per ogni
colore un set di gradient con noise predefinito che mi crei delle sorte di shadow noise sulle
forme*; his answers: on the house + tiles · a set of 3 · each shape its own light · Screen and
Print). Every colour gets three gradient definitions (`shadeDefs`), drawn by the gradient
engine of §3 in each shape's own box, the light from its top — all three are ink cells,
vector in every export:
- **Soft** — linear, the colour dithering into its own tint 3 steps darker (its 0–900
  scale) from 20% of the box down, grain 1.5
- **Speckle** — the colour flat, square specks of a tint 5 steps darker gathering away from
  the light (falloff 65)
- **Stipple** — Speckle as round dots (stored key `print`, its label until Nov 18, 2026)
A colour already at 800–900 takes lighter tints instead. The panel's **Shading** row
(None · Soft · Speckle · Stipple, default Speckle, saved with the palette as `shading`) puts one
on every shape of the house (each zone clipped to its shape, its box the shape's visible part —
`bb` in `house.js`); under each colour's scale a row of three **tiles** shows its set, the
one on the house outlined, a click puts that one on the house. The shape itself paints the
colour; only the darker cells go on it, clipped to the shape (a house ~200–500 KB of SVG).
Rendered once per
colour × box and cached, so selecting or renaming does not redraw the grain.
Then:

1. **Colour cards** — one rounded card per colour: the colour, its name and
   hex. Click a card to select that colour (and open the picker).
2. **Scales** — under each card, that colour's ten steps, 50–900. Every step
   sits at a fixed perceived lightness (`Organica.color.SCALE_L`), so step 500
   is the same lightness for every colour. The picked colour is kept unchanged
   on its nearest step (outlined). Chroma keeps the pick's share of the gamut at
   each lightness and never exceeds the pick's own.
   **The tints are selectable** (Nov 18, 2026: Diego, *rendi le shades selezionabili*): a click
   selects one — the ring the selected house shape has (paper under dashed ink, screen only) —
   and the Colour section shows its values (*‹Name› · ‹step›*). It never changes the palette, is
   not saved and not in ⌘Z; a card click goes back to the colour itself. Keyboard: one tab stop
   per column, ↑ ↓ move along it.

   **The figure** (since Nov 18, 2026 — Diego: *la Figura rimane unica generata
   da questo*) is a **house generated from a seed** (`tunesutra/house.js`,
   `TUNESUTRA_HOUSE.generate(seed, n)`). It replaced the Garment, the isometric
   House and the 5-colour Scene of the retired `figures.js`. Every part is an FVS
   shape (`Organica.shapes`, polygonal + the circle) or a curved roof profile: the roof a triangle
   (apex near the middle, eaves 10–20% of the wall either side) or the top half of
   a 4–8 sided polygon cut at the eaves line (a hip or mansard roof, its base its
   widest part) — always sitting on the wall, all of it above, never wider at the
   top than at the eaves, and never taller than 80% of the wall (Nov 18, 2026: Diego,
   *il tetto dovrebbe in teoria essere sempre sopra, ma delle volte la forma del tetto
   è strana o troppo grande*; the flat slab and the polygon hanging beside the wall
   were dropped); or, curved, a **dome**, a low **vault**, an **onion** or a pointed
   **gothic** arch (Nov 18, 2026: Diego, *tutte e 4, schiacciate*) — sampled as fine
   polygons so the drawn path is what is measured, and stretched to the solved
   height, so on a wide house they are squashed (a dome turns elliptic); about half
   of all roofs are curved; the door a rectangle or a pentagon; the windows a
   circle, a polygon of 3–8 sides or a rectangle (one, or two either side of the
   door at 4 colours). The wall is drawn at random; the roof height, door and
   windows are then **solved** so every role covers exactly its share — the
   Bar's weights (`TUNESUTRA_HOUSE.SHARES`):
   - 3 colours — wall 52.0 · roof 32.2 · door (+ window) 15.8, the house alone on white
   - 4 colours — wall 52.0 · roof 32.2 · door 10.9 · windows 4.9
   - 5 colours — background 71.6 · ground 20.0 · wall 4.6 · roof 2.8 · door 1.0,
     a small house in a landscape (flat or sloping ground)

   **One house per palette, a carousel for others.** The seed (`house`, 1–9999)
   is saved with the palette and drawn on its library card; two arrows on the
   sheet, either side of the house (*Previous house* / *Next house*, Figure view
   only, HTML over the sheet so never exported), step the seed to the next or
   previous house at the same number of colours, with Undo; the caption reads
   *Example — house no. 8274*. Another colour count is another house of the same
   seed. A palette saved before Nov 18 (with `figure: 'garment'` …) and every
   built-in palette get a fixed seed from their colours / id, so they always
   open on the same house; a New palette gets a random one.

   The line under the figure gives the shares as computed from the geometry
   (exact, polygon areas and πr²), and `node scripts/test-figures.mjs`
   generates 300 houses per colour count and fails if a share is off by more
   than 0.15, a shape leaves the box, or a seed does not repeat. A zone too pale
   to see on the paper gets a hairline (3–4 colours). The generator was first
   built on the design canvas *House illustration* (claude.ai artifact).
3. **Contrast — the best pairs** (simplified Nov 18, 2026; Diego: *una versione molto più
   semplice, mostriamo solo quelli che funzionano meglio come coppia*). Every pair of colours
   once, best first: those that pass WCAG AA for text (4.5:1), up to 4 (`PAIR_MAX`), and
   always at least 3 (`PAIR_MIN`; Diego: *mostra sempre come minimo 3 coppie, dalla migliore alla
   peggiore*) — the next best fill in, whatever their grade. Each pair is a tile
   in the background colour (the one with the larger share) with *Aa* and the text colour's
   name in the other, and under it *‹Text› on ‹Background›* and *‹ratio›:1 · AAA / AA / Large
   text only / Not for text*. The full grid (every colour on every other) is gone.
   The pairs take the left of the row; on its right sits the **Colour** section (Nov 18, 2026:
   Diego, *metti la parte colour al fianco destro di dove è ora contrast*) — since Nov 18, 2026
   only the **six value tiles** (Diego: *leave only the 6 boxes*; Name, Keep on Generate, Hex and
   the box removed — a colour changes from its card's picker), level with the pairs: HTML laid over
   the sheet (`#colour-dock`, scaled with it), light in both themes, never in an export. They show
   the selected tint, else the colour.

## 3. Gradient & grain

One definition per palette (`state.grad`, saved with it), one section in the panel
(**Gradient & grain**, merged Nov 18, 2026). The gradient lives inside the palette —
Diego, Nov 2, 2026 (not a library item of its own).

**Everything is ink cells, so everything is vector** (Diego, Nov 18, 2026: *tutto deve
essere esportato in vettoriale quindi anche con il noise e shadow*; the target look is
flat shapes with fine grain-gradient shadows, a riso / screenprint stipple). Every cell
of the drawing is one pure ink — a stop or the shadow ink. The blend between two stops is
a **dither**: the share of the way between them decides how many cells take the next ink.
Nothing is mixed, nothing is a raster: the sheet, the SVG, the PNG and the plates all draw
the same cells (`gradPlates`). Rows of one ink are merged into one rectangle; in the
composite drawing the first ink is a single rectangle and the others sit on it (half the
file), while the plates keep the exact partition.

- **Type** Flat · Linear · Radial. **Flat** is one colour (the first stop) — for a
  shadow on a flat colour. **Angle** (Linear) follows CSS: 0° = to top, 90° = to right.
- **Stops** 2–8, each with a position. The **stop bar** (a smooth preview of the
  blend as the track) shows where they sit: click the bar to add a stop in the
  colour the gradient has there, drag a stop to move it (it cannot pass its
  neighbours), ←/→ move the selected stop 1% (Shift 10%), Home / End to the
  ends, Delete removes it (2 at least). The chips under the bar carry the
  colours and the palette library; a chip added with + goes in the widest gap,
  a palette loaded whole is spaced evenly. Stops are colours in their own
  right: reordering the palette does not reorder them.
- **Reverse** flips the stops and their positions; **Space evenly** forgets
  the positions.
- **Fade to paper** adds the paper as the last stop: the last ink thins out to
  bare paper, and the paper gets no plate.
- **Grain size** — one cell, in sheet units, 1–12 (step 0.5). At 1 the gradient block
  is ~1.4 MB of SVG, at 2 ~350 KB, at 3 ~150 KB (measured Nov 18, 2026).
- **Pattern** — how the cells are chosen: **Noise** (at random) or **Dots** (round
  dots, evenly spread: a 64 × 64 blue-noise mask, `Organica.dither.blueNoise`).
- **Seed** fixes the cells.
- **Shadow** — one more ink on top: **Ink**, **Amount** (density, 0 = no shadow),
  **Away from a light** (switch; off = everywhere alike) with **Light from** (0° = the
  top, 90° = the right: none on the lit edge, full on the opposite one) and **Falloff**
  (50 = grows evenly; higher keeps it to the far side — an exponent 4^((f − 50) / 50)).
  Square shadow cells take their cells from the other inks; each shadow dot is cut out
  of the one ink under it (a circle inside that ink's rectangle, filled even-odd; dots
  only in whole cells), so the plates never overlap. A shadow ink equal to a stop is
  that stop's ink — one plate, not two.

The panel shows a control only while it changes the drawing (`gradUses()`).

**What the section edits** (Diego, Nov 18, 2026: on the house, a click on a shape / colour
and its gradient is edited there, the house staying in view): the selected colour's shading — the
title says whose (*Secondary · Speckle* while it is still the preset, *Secondary* once it is
its own). The first edit turns the preset into the colour's own definition (`item.shade`,
saved with the palette as `shades`; ⌘Z returns to the preset); its first stop is always the
colour itself (the Flat *Colour* row went with the Gradient view). **Back to preset** forgets it; a click
on one of that colour's tiles does too, and puts that preset on the house. No control
switches the view any more.

**Every shape its own** (Diego, Nov 18, 2026: *ogni forma nella casa deve avere una gestione
separata del gradient e grain*). A click on a shape of the house selects that **shape** (a double-click opens the colour picker on it; from the keyboard Enter selects, Enter again opens the picker — a colour card still opens the picker in one click)
(dashed outline, paper under ink, on screen only) and the section edits it alone — title
*‹Colour›, shape ‹n›* (*· as its colour* until edited). Its definition is kept under
`house/count/shape` (`state.zoneShades`, saved as `zoneShades`), so stepping the carousel
away and back finds it again. A colour card or chip selects the colour: *‹Colour›, every
shape* — the colour's own definition, which every shape of that colour without its own
follows. Order on the house: the shape's own → the colour's own → the Shading preset. A selection holds only on the house it was picked on (`selZone()`: same house, same colour count, the shape still of the active colour) — a colour removed or added, or the carousel stepped, and the section falls back to the colour; ⌘Z brings it back.
**Back to preset** forgets the selected one's own; a click on a colour's tile puts that
preset back on the colour and on all its shapes of this house.

**Removed on Nov 18, 2026** (they only made sense for a raster): Output (Screen ·
Print — everything is ink cells now), Mix in (a dither of pure inks mixes nothing),
Grain colour Tone · Shadow (Tone was a raster lightness jitter), Pattern Ordered,
Type Conic, Grain in Shadows / Highlights (the dither between stops already is that).
Palettes saved before read forward (`normalizeGrad`): Conic → Linear, Ordered →
Noise, a Tone grain → no shadow, Shadows / Highlights → everywhere; `out`, `kind`,
`space` are dropped.

## 4. Export

| Button | What you get |
|---|---|
| PNG / SVG | the whole sheet. The SVG carries its own paint and font on every element — no page CSS needed |
| CSS | `--‹palette›-‹role›-‹step›` for every scale step + `--‹palette›-gradient` (the smooth fill only — grain is not expressible in CSS): positions as percentages and the blend's space, `linear-gradient(90deg in oklch, #… 0%, #… 45%, …)`; a Flat fill is its colour |
| JSON | the same as design tokens (DTCG `$value` / `$type`), incl. a `gradient` token with each stop's real position |

SVG text names the page font (IBM Plex Mono) with fallbacks; a machine without
it shows the fallback.

## 5. Saving, and the palette library

**Save** stores the palette in `Organica.store('tunesutra')` (cloud-synced when
signed in): `{ n, harmony, spread, colors, names, ids, locks, gradient }` —
`gradient` = `{ type, angle, stops, pos, space, paper, out, kind, ink, amount, size, pattern, dist, light, falloff, seed }`.
Palettes saved before names / gradients existed still load.

Every colour control in the suite (`Organica.palette.swatch`) has a small ▦
button — **Pick from a palette** — listing these saved palettes and the
built-in sets (`Organica.palette.library()`):

- on a single colour row: click a colour to use it;
- on a chip strip: click a colour to add it (or replace the last one when the
  strip is full), or a palette's name to load it whole.

Built-in: three combinations available in every tool without saving them first
— **Violet 06**, **Stimulating**, **Violet 07** — and **Riso standard inks
(approx.)** — 21 inks. The hex values are screen
approximations of real inks (public riso-colors list); check them against your
printer's own chart before relying on them.

## 6. System — archived

The **System** view (Oct 1 – Nov 18, 2026) proposed Organica's own interface colours from a
palette — ten chrome roles in light + dark, every tool's `--tool` accent, a CSS / JSON export,
a this-page preview. Removed from the tool on Nov 18, 2026 (Diego: *il system per ora
togliamolo ma teniamolo in un archivio*) and frozen with its whole page and this section's old
text in `archive/tunesutra-system/` (its README says how to bring it back). Palettes saved
with a `system` field keep it; the tool no longer reads or writes it.

## 7. Not built yet

- A midpoint / easing handle per span of the gradient; a movable radial
  centre; repeating gradients. Gradients as library items of their own (Diego
  kept them in the palette, Nov 2, 2026).

- A real physical size / DPI for the gradient (the shared Screen/Print size
  panel) and registration marks on plates.
- Applying a System proposal automatically (it is a manual, reviewed paste), and
  the derived tokens outside the ten roles (`--accent-warm`, `--stage-shadow`).
- Screen-print ink sets beyond Riso; a free-text ink reference per colour.
- The colour inputs of FVS variant rows, Colornet channel cards and Camo Turing
  layer cards are still bare system pickers, without the palette button.
