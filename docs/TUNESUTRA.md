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

`/tunesutra/` opens on **Explore › Palettes** (redesign, Nov 19–20, 2026; Explore first since Nov 20). Three tabs,
each a hash so Back works: **Explore** (`#explore`, or no hash; `#explore/moods`, `#explore/swatches`) · **Make**
(`#make`, `#make/image`) · **Your palettes** (`#palettes`). The nav's **New palette** button went on Nov 20 (Diego);
a blank palette (`#new`, three white colours) is the dashed **New** card in Your palettes. The guide **How colour
works** moved to the design system (`/design-system/colour/`, Nov 20) and TuneSutra keeps no link to it; an old
`#learn` address lands there. The colour model under every view is `Organica.hueTone` (`shared/hue-tone.js`):
10 hues × 12 tones in four tone families, plus neutrals; the words are in `docs/UI-COPY.md`.

- **Your palettes** — your saved palettes and every palette you starred, filter **All · Starred · Saved**.
  A star sits on every card, top right on the house on a paper chip (`Organica.store('tunesutra-favs')`, synced with
  your account). Under each card's name, one bar per colour, all of them fitting (Nov 20, 2026 — was the hex codes); a
  house of 5–9 colours fills the card's square (no paper band above or below).
- **Make › From a colour** — a key colour, 2–9 colours, **Built by** *Roles* (the role rule: each colour on its
  part of the house, shares as measured) or *Hue and tone* (tone family, hue relation, tone relation, purity,
  neutral). **Suggest** draws the next seeds. Settings are remembered (`organica.tunesutra.make`).
- **Make › From an image** — open or drop an image; its colours become one palette per count (2–9), picked by
  **Area** or **Difference** (`Organica.hueTone.extract`: OKLab k-means on a 128 px copy, near colours merged).
  The image stays in memory for the visit, never stored or sent.
- **Explore › Palettes** — the palette library (Supabase `palettes`, read-all, owner-only write; cached on the
  device), grouped by structure, key colour, mood or source, with filters for key colour, number of colours,
  mood, tone family, hue relation, tone relation, purity and source. Facets are read on the device from the
  colours, so they follow the model.
- **Explore › Moods** — the mood map (Soft · Hard · Warm · Cool): one disc per mood word, sized by how many
  palettes have it. A palette's place (`Organica.hueTone.imagePos`): each colour from its hue × tone cell
  (hue warmth × saturation; whiteness softens, blackness hardens), the mean, harder with a strong light–dark
  contrast, then each axis through ten fixed steps (the library's deciles, Nov 20, 2026) so every word has palettes. Picking words sets Explore's Mood filter (several at once); **Show in Palettes** lists them.
- **Explore › Swatches** — the 130 hue × tone swatches; each counts the different library colours that fall in
  it. The panel shows the swatch's values, its library colours, how many palettes use it, **Make from this
  colour** and **Show palettes**. Keyboard: one Tab stop, then arrows · Home · End.
- **How colour works** — now a design-system page, `/design-system/colour/` (Page template, Tool references):
  hue and tone, tone families, hue and tone relations, purity, roles, moods (the words only, no counts), where the
  palettes come from — each with a figure drawn by the model and a link into TuneSutra. What it shares with
  TuneSutra (role names, the relation words, the house as SVG, the mood square) is `tunesutra/palette-figures.js`.

Opening a palette from any view loads it into the editor: `#p=<name>` (saved), `#l=<id>` (library), `#m=<hex>-…~<house>`
(made), `#c=<collection>/<id>` (a built-in collection, `tunesutra/collections.js`). Library and made palettes open
as copies — **Save** keeps them with your own. With unsaved changes, leaving asks for a second click; deleting the
palette on screen returns to the library.

## 1. The palette

- **Colours** 2–9 (branch `tunesutra-redesign`, Nov 19, 2026; `main` offers 3–7), each count on its own house. Roles: 2 *Base · Accent*, 6 *… · Accent · Highlight · Spark*, 7 *… · Support · Accent · Highlight · Spark*, 8 *… · Support · Backdrop · Accent · Highlight · Spark*, 9 *… · Backdrop · Touch · Accent · Highlight · Spark*. **Each colour saves its house part** (`parts[]`: background · ground · middle · far · main · sub · accent · accent2 · accent3 = `Organica.hueTone.ROLE_PARTS[n]`): adding or removing a colour keeps the others on their part, the new one takes the part that appears; a palette saved before gets the parts of its places, as it was drawn. Each colour is an item `{ id, name, hex, lock }`; the `id` is
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
  — **following the Harmony rule** (Nov 18, 2026: Diego, *il nuovo colore segue la regola dell'harmony, di default è complementary*): the colour Generate would put in that place, the others untouched (a duplicate falls back to the next tint, `nextColour()`) — up to 5; **every card has a remove button while there are more than 3** (Nov 18, 2026: Diego, *ogni colore card si può eliminare fino a rimanere 3*) — a close icon on a paper chip, *Remove ‹name›*, shown **only while the pointer is over that card** (*la X per eliminarlo solo al mouse over*), or when it has the keyboard focus; always on a touch screen. Removing the Base makes the next colour the base. Both are HTML laid over the sheet (`#sheet-ctrls`), never in an export; the cards keep
  the export's places, the + card narrower at 4 colours to stay on the sheet. ⌘Z undoes both. The
  panel's Colours 3 · 4 · 5 and its colour chips are gone.
- **Select a colour** by clicking its card on the sheet (or a house shape); a card click also
  opens the picker.
- **The Palette section is gone** (Nov 18, 2026, night: Diego, *gli ink free devono essere quelli generati da regole di
  armonia, in modo da poter poi togliere da sopra* → *Sì, toglila*). Harmony, Lightness spread, Generate and the
  ΔE hint went with it; the harmony rules now live in Shadow › Ink › *Free* (§3). `generateHarmony()` stays for the
  **+ card**: a new colour follows the palette's `harmony` — **Complementary** by default, a saved palette its own
  (and its saved `spread`). Generating a whole palette from the seed is no longer in the UI.
- **Undo** — the floatbar's first button (`undo` icon, *Undo (⌘Z)*, as in FVS) or ⌘Z; covers every change.

## 2. The sheet

Above the sheet, as wide as it, the **palette bar** (Nov 18, 2026: Diego, *sposta il back … sopra a Example — house no. … con una barra che lo racchiude della stessa larghezza della canvas*): **← All palettes** on the left, on the right *Unsaved changes* for a saved palette edited since (nothing otherwise — *Not saved yet* removed, Diego, Nov 18, 2026); attached to the sheet, no gap, on the sheet's own paper (light in both themes, as the sheet). The palette's **name** is on the sheet itself, where *Example* was: *‹Name› — house no. ‹n›* (also in the export) — moved out of the panel; chrome (`--panel`, both themes), not part of the sheet or its exports.

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
with 6–7 colours shows its house too (since Nov 19, 2026).

**Shading — each colour's shadow noise** (Nov 18, 2026; Diego: *per ogni palette … per ogni
colore un set di gradient con noise predefinito che mi crei delle sorte di shadow noise sulle
forme*; his answers: on the house + tiles · a set of 3 · each shape its own light · Screen and
Print). Every colour gets three gradient definitions (`shadeDefs`), drawn by the gradient
engine of §3 in each shape's own box, the light from its top — all three are ink cells,
vector in every export:
- **Soft** — linear, the colour blending into its own **900** (its 50 when the colour is the 900 —
  Diego, Nov 18, 2026: *i color (stop) sul gradient di default usano il 900*; was 3 steps darker)
  from 20% of the box down, no grain (a smooth blend; grain 1.5 until Nov 18, 2026)
- **Speckle** — the colour flat, square specks of a tint 5 steps darker gathering away from
  the light (falloff 65)
- **Stipple** — Speckle as round dots (stored key `print`, its label until Nov 18, 2026)
A colour already at 800–900 takes lighter tints instead. The panel's **Shading** row
(None · Soft · Speckle · Stipple, default **None** — flat, as the home shows it, since Nov 18, 2026; saved with the palette as `shading`) acts on the selection (Nov 18, 2026: Diego, *quando clicco shading e nulla è selezionato applica lo shading a tutte le forme, se seleziono una forma … solo alla selezione*): **a house shape selected** → that preset becomes the shape's own (None = the shape flat), and the row shows that shape's preset; **nothing selected** (Esc or a click on the bare sheet lets go of a shape) → it puts one
on every shape of the house — every colour's / shape's own shading forgotten, one ⌘Z step (each zone clipped to its shape, its box the shape's visible part —
`bb` in `house.js`); the row of **tiles** under each colour's scale (its set, the one on the house outlined) was
removed Nov 18, 2026, night (Diego: *togli questi visto che li abbiamo nella dropdown specifica* — the Shadow
dropdown's thumbnails show every preset); the sheet and its exports end at the 900 tint. The shape itself paints the
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
   **A tint picked becomes the card's colour** (Nov 19, 2026: Diego, *quando seleziono una shade voglio che
   quel colore venga preso dalla card*; from Nov 18 a click only selected it and showed its values). **The column
   stays as it was** (Nov 19, 2026: Diego, *quando cambio shade non deve ricalcolare gli altri*): only the
   outline moves to the picked step — the item keeps `scaleFrom`, the colour its column was built from (saved with
   the palette as `scaleFrom`; picking the original step again drops it; a colour set anew from the picker gets its
   own column); the other cards never change. The house, the shading and the value tiles follow; one ⌘Z / Undo step returns to the colour before. Each tint's name is *Use ‹step› for
   ‹Name› — #hex* (the card's own step: *‹Name› ‹step› — #hex*). Keyboard: one tab stop per column, ↑ ↓ walk the
   colour one step lighter / darker.

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
   - 6 colours — background 71.6 · ground 20.0 · wall 3.8 · roof 2.8 · door 1.0 · windows 0.8:
     the 5-colour landscape with windows (one, or two either side of the door) — Nov 19, 2026
   - 7 colours — background 57.6 · ground 20.0 · hill 14.0 · wall 3.8 · roof 2.8 · door 1.0 · windows 0.8:
     plus a hill behind the house, a convex arc whose height is solved for its share (clipped to the
     frame and to the house) — Nov 19, 2026. 6–7 can be chosen again (Diego, Nov 19: *riattiva*). The rule comes from the Hue × tone lab
     (`explorations/tunesutra-hue-tone/`, *By roles*): the 5-colour space plus a second accent, then a
     middle plane.
   - 2 · 8 · 9 colours (house.js only, Nov 19, 2026 — TuneSutra still offers 3–7 until the redesign):
     2 = wall 61.8 · roof 38.2, the house alone without a door; 8 = 47.6 · 20 · 14 · far band 10 · 3.8 · 2.8 · 1 · 0.8,
     a wider arc behind the hill, solved for what the hill, ground and house leave visible; 9 = 8 + a path 0.6
     (taken from the ground, 19.4), a trapezoid from the door's foot to the bottom edge.
   - `node scripts/test-house.mjs` (in `check.py`): every share on target for 500 seeds × 2–9, and the 3–7 houses
     equal to `scripts/house-golden.json` — a saved palette keeps its house by its seed; re-record only by decision.

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

## 3. Gradient · Shadow

> **Nov 18, 2026 (night) — Grain removed, Shadow = type + Ink** (Diego: *togli il grain definitivamente visto che abbiamo le shadow complete con i presets* · *la dropdown di shadow così sceglie il tipo di ombra mentre Hue come la colora*). The panel is **Palette · Gradient · Shadow**. Every gradient is a smooth vector blend (`g.size` forced to 0 by `normalizeGrad`; a palette saved with a grain opens smooth). The Grain paragraphs below (Size, Pattern, Seed, the dithered blend) are history: the cell renderer remains only for Flat shadows. In Shadow, **Shading** picks the shadow and **Ink** (a thumbnail dropdown, `#sel-gink`) picks how it is coloured — *On the palette* Same · Cool · Warm · Complement (inks snapped to the palette's tints) or *Free* — **the Palette's harmony rules** (Diego: *gli ink free devono essere quelli generati da regole di armonia*): Monochromatic · Analogous · Complementary · Split-complementary · Triadic · Tetradic, the halftone ink on the rule's first hue away from the colour, the core on its second (`HARMONY_INK`: 15/30°, 180°, 150/210°, 120/240°, 90/180°), Shift scaling the turn (100 = the rule's own angle); a saved free Cool / Warm moves on the palette, Impressionist becomes Analogous; it replaces the Hue select and the Snap to palette switch. **Shift** sits right under Ink, **only for Free inks** (on the palette the inks snap to its tints, so it could only jump; hidden on Monochromatic and when both inks are hand-picked). **Depth** is the share of the colour's own lightness lost at the core (halftone half of it) — no longer subtracted outright, which sent a mid colour's inks to black; **Same** on the palette snaps to the colour's own tints. Halftone / Core stay for a hand pick; picking an Ink preset forgets them (**Reset inks** removed). With a shape selected the Shading menu names the shadow's type even after an edit. The Gradient section has no hint. The *Away from a light* switch, **Chroma**, **Parts** and the **More** disclosure are gone (saved values still read).

One definition behind three panel sections — **Gradient** (how the colour fills each
shape: Type, Angle, Stops, Fade to paper), **Grain** (the gradient broken into cells of pure
ink, for print plates: Size and Pattern (its hint, Seed and the plates note removed Nov 18, 2026) — **hidden entirely on Flat**, Nov 18, 2026) and
**Shadow** (specks of a second ink on top: a switch, then Ink, Amount, Size, Specks, the
light, its own Seed). Split Nov 18, 2026 (Diego: *dobbiamo far capire bene cosa è per gradient,
cosa è per grain, e cosa è shadow*; mockup A, three sections, `archive/tunesutra-mockups/gradient-panel/`);
before that one section, **Gradient & grain** (merged the same morning). The gradient lives inside the palette —
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
  ends, Delete removes it (2 at least). **A click on a stop (or Enter) opens the colour picker**
  for it; the first stop is the colour itself, so there the picker edits the colour (Nov 18, 2026:
  Diego, *elimina sotto la barra i quadrati con i colori, quelli vengono selezionati dal picker* —
  the chips under the bar and the bar's hint are gone). Stops are colours in their own right:
  reordering the palette does not reorder them.
- **Reverse** flips the stops and their positions, **keeping every colour** (Nov 18, 2026: Diego, *quando clicco reverse, deve mantenere i color scelti*): the stop that is the colour itself moves with it (`colourAt`) instead of being forced back to first; Flat and the drawing follow it. Until a stop is chosen by hand (picker, add, remove — `auto2`), the other stop of two stays the colour's **900** and follows a colour change. Fade to paper sits a `--space-3` below the buttons; **Space evenly** forgets
  the positions.
- **Transparent stops** (Nov 18, 2026: Diego, *togliamo il fade to paper e aggiungiamo il trasparente al picker*): the
  picker opened from a stop (never the colour's own) has a **Transparent** button; that stop is then no ink at all
  (`'transparent'` in `stops`) — anywhere along the bar, at the start, the end or in between (Reverse keeps it). The ink
  next to it fades in or out to nothing; the paper's share takes no plate and is left **empty, not white**: a shape
  with a transparent stop has no solid fill under it (cells: its empty cells undrawn; smooth: `stop-opacity` → 0); it
  keeps its click (`pointer-events: all`). On screen the empty part shows a **checkerboard** (screen only, inside the
  shape — fine 2-unit squares in that colour's own 50 and 200 tints, `#ts-checker-‹i›`); its knob on the stop bar is a
  checkerboard too. In a file it is empty only with **Export › Transparent paper** on. The **Fade to paper**
  switch is gone; a palette saved with it gets a transparent last stop (positions squeezed as they were drawn).
- **Grain size** — one cell, in sheet units, **0**–12 (step 0.5); **hidden on Flat** (Nov 18, 2026: Diego, *when Gradient & grain is on flat Grain size is hidden* — a Flat shadow keeps the size it has, 2 for Speckle, 3 for Stipple). **0 = no grain, the default
  for a gradient** (Nov 18, 2026: Diego, *quando lavoro su un gradient c'è solo il gradient senza
  necessariamente il grain … se non modificato è 0 di default*): the blend is a smooth vector
  gradient — an SVG `linearGradient` / `radialGradient` in the shape's box, OKLab sampled (16
  sub-stops a span), a canvas gradient in the PNG — so it is no longer one plate per ink (the hint
  says so); Pattern and Seed hide unless a shadow uses them; a shadow keeps its cells (2 units) on
  top. From 0.5 up the blend is cells again — at 1 a full-width block is ~1.4 MB of SVG, at 2 ~350 KB,
  at 3 ~150 KB (measured Nov 18, 2026).
- **Pattern** — how the cells are chosen: **Noise** (at random) or **Dots** (round
  dots, evenly spread: a 64 × 64 blue-noise mask, `Organica.dither.blueNoise`).
- **Seed** fixes the cells.
- **Shading — a dropdown with thumbnails** (Nov 18, 2026, night: Diego, *una dropdown con thumb per tutti incluso gli 11 scelti e None e Soft*; the 11 chosen in `archive/tunesutra-mockups/shadow-types/`). `Organica.selectPicker` (size *preview*) over `#sel-shading`: **None · Soft**, then **Specks** *Speckle · Mottle* (not *Grain*: that is the section above), **Dither** *Serpentine · Blue noise · Bayer*, **Pollen** *Dot · Stroke · Cross-hatch*, **Camo** *Spots · Maze*, **Cells**. Each row has a one-line hint; each thumbnail is that preset drawn by the tool's own renderer on the active colour (a disc), lazily, redrawn when the colour or the theme changes. The textures come from **`shared/shade-marks.js`** (`Organica.shadeMarks`): Mottle = Speckle × simplex fbm; Serpentine = Floyd–Steinberg, serpentine + blue-noise jitter; Blue noise / Bayer = ordered dithers (`Organica.dither`); Pollen = its variable-density Poisson disk (synchronous, on the shadow field) — dots, strokes across the light, or brush strokes in three directions each with its own points, fading in by depth; Camo = Camo Turing's Gray-Scott on the CPU (72², 3000 steps, cached, pre-run when idle — `warm()`), tiled; Cells = Worley. All use the same light, Parts and two palette inks; cell types are one ink per cell, Pollen marks overprint. Each has a minimum Size (`minSize`: Pollen Cross-hatch 3, Pollen / Dither 2) to keep the files light. **Visible controls** (a test — Diego: *lascia i 6 comandi … probabile che li togliamo dopo*): Amount, Size, Light from, Falloff, Ink, Depth (+ the Halftone / Core rows); Shift in a closed **More** disclosure (Inks, Snap, Chroma, Parts there until the same night). **Seed** removed (fixed at 7).
- **Shading, at the top of Shadow** (Nov 18, 2026, late): **None · Soft · Speckle** for the whole figure (or the selected shape), default None, in place of the Shadow switch — Soft or Speckle turn the shadow on and show the parameters below. **Soft = a smooth shadow, no specks** (Diego: *soft non dovrebbe avere il noise* — one vector gradient along the light, from nothing on the lit side through the Halftone ink to the Core ink; vector, but not one plate per ink; Size / Seed hidden), **Speckle** = square specks (one ink per cell, plates); Stipple, and the Pattern row's Dots / Bands, were removed (a saved one still draws).
- **Shadow — the painter's shadow** (Nov 18, 2026: Diego, *lo voglio tutte così come opzioni in shadow con un
  focus su specks e dots … allineare le parti ai colori definiti come token*; from the Shadow lab,
  `archive/tunesutra-mockups/shadow-ink/`). Its own **switch** (`shadow`), then:
  - **Pattern** *Specks · Dots · Bands* (`specks`; *Render* until Diego chose Pattern, Nov 18, 2026): Specks = square cells mixing two inks (Seed); Dots = a true
    AM halftone screen — up to half the next ink is a dot on the lower one, past half the cell takes it and a dot
    of the lower ink is left, each dot's area exactly the share, so the tone runs 0 → 100% with no jump and no
    dot leaves its cell (plates never overlap; revised Nov 18, 2026 — Diego: *dots mi sembra diverso da quello di
    prima*, the first version capped dots at half a cell); Bands = hard steps on a fine 1-unit grid, so their
    edges follow the light (Size hidden). **Size** (`speck`, its own grid on Flat / a grain-0 blend; on a grained blend
    the grain's cells), **Amount** (how strong), **Seed** (`sseed`), **Away from a light** · **Light from** ·
    **Falloff** (the light across each shape's own box).
  - **Inks** — two, **Halftone** and **Core** (`shadowInks()`): made by the rules below from the colour, or
    hand-picked from the picker (`inkMid` / `inkCore`; **Reset inks** forgets them). **Snap to palette**
    (`snap`, on by default) moves each ink to the nearest of the palette's own 50–900 tints (never the colour
    itself, the core never the halftone's) — so a shadow is made of the palette's tokens; with Complement or Cool
    it often lands on another palette colour's tint.
  - **Hue** (a select) *Same · Cool · Warm · Complement · Impressionist* (`hue`) with **Shift** — warm light / cool shadows,
    the reverse, Chevreul's complement, Monet's coloured shadows; **Depth** (`depth`, lightness of the core).
  - **Chroma**: **Loss** (colour lost in the shadow), **Edge glow** (colour gained by the halftone ink).
  - **Parts** (`parts`): **Halftone** (a ramp, else a hard edge), **Terminator** (a darker band at the turn),
    **Core shadow** (else it stops at the halftone ink), **Reflected light** (lighter at the far edge),
    **Highlight** (paper-white specks on the lit edge). No cast shadow: the house's shapes are flat on the sheet.
  A shadow saved before keeps its look: its one Ink becomes the hand-picked Core.

The panel shows a control only while it changes the drawing (`gradUses()`).

**What the section edits** (Diego, Nov 18, 2026: on the house, a click on a shape / colour
and its gradient is edited there, the house staying in view): the selected colour's shading (or the selected shape's) — the section title no longer names it
(Diego, Nov 18, 2026: *elimina "Base, shape 1"*); the selection on the sheet says whose. The first edit turns the preset into the colour's own definition (`item.shade`,
saved with the palette as `shades`; ⌘Z returns to the preset); its first stop is always the
colour itself (the Flat *Colour* row went with the Gradient view). With nothing of its own the section starts from the Shading preset on the house — with Shading **None**, from **Flat** (Nov 18, 2026: Diego, *by default in gradient & grain Type is always flat*; was Soft), its second stop already the 900 so Linear / Radial blend at once. **Back to preset** became the floatbar's
**Reset** (Nov 18, 2026: Diego, *sposta back to preset nella floatbar come se fosse un reset alla
palette iniziale*): the palette as it was opened — colours, every shading of its own, the house —
one ⌘Z step. No control
switches the view any more.

**Every shape its own** (Diego, Nov 18, 2026: *ogni forma nella casa deve avere una gestione
separata del gradient e grain*). A click on a shape of the house selects that **shape** (a double-click opens the colour picker on it; from the keyboard Enter selects, Enter again opens the picker — a colour card still opens the picker in one click)
(dashed outline, paper under ink, on screen only) and the section edits it alone — title
*‹Colour›, shape ‹n›* (*· as its colour* until edited). Its definition is kept under
`house/count/shape` (`state.zoneShades`, saved as `zoneShades`), so stepping the carousel
away and back finds it again. A colour card or chip selects the colour: *‹Colour›, every
shape* — the colour's own definition, which every shape of that colour without its own
follows. Order on the house: the shape's own → the colour's own → the Shading preset. A selection holds only on the house it was picked on (`selZone()`: same house, same colour count, the shape still of the active colour) — a colour removed or added, or the carousel stepped, and the section falls back to the colour; ⌘Z brings it back.
A click on a colour's tile puts that preset back on the colour and on all its shapes of this
house; the floatbar's **Reset** returns the whole palette to how it was opened.

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
| Transparent paper (switch) | PNG / SVG without the sheet's white paper rect: what fades to paper is empty in the file |
| CSS | `--‹palette›-‹role›-‹step›` for every scale step + `--‹palette›-gradient` (the smooth fill only — grain is not expressible in CSS): positions as percentages and the blend's space, `linear-gradient(90deg in oklch, #… 0%, #… 45%, …)`; a Flat fill is its colour |
| JSON | the same as design tokens (DTCG `$value` / `$type`), incl. a `gradient` token with each stop's real position |

SVG text names the page font (IBM Plex Mono) with fallbacks; a machine without
it shows the fallback.

## 5. Saving, and the palette library

Save, and since Nov 18, 2026 **Delete palette** (armed *Delete?*, only for a saved palette), live in the floatbar's Save popover; the panel's **Saved palettes** section (a preset menu, Delete and a hint) was removed (Diego: *deve essere eliminato in quanto ne abbiamo uno simile nella floatbar*) — palettes are opened from the home page.

**Save** stores the palette in `Organica.store('tunesutra')` (cloud-synced when
signed in) **under a name — always** (an empty name does not save; a new palette has no
suggestion, a built-in copy suggests its own): `{ n, harmony, spread, colors, names, ids, locks,
shades, zoneShades, gradient, house, shading, set, savedAt }` — `names` are the roles,
`locks` / `gradient` / `shading` are kept for older readers. A palette **always opens flat**, as the home
shows it (`shading` is not restored — its shadings are in the set).

**The base set** (`set`, Nov 18, 2026 — Diego: *si salvano sia le tinte piatte che quelle con le
shadow, gradient e grain in modo d'aver un set di base che ci permetta di fare tutto*;
`paletteSet()`, `v: 1`): `{ v, prefix, colours: [{ role, key, hex, tints, shading, own }] }` —
`prefix` the token prefix from the palette's name, `tints` the ten flat tints `{ 50: hex … 900: hex }`,
`shading` the three definitions `{ soft, speckle, stipple }` (the gradient engine's own: type,
angle, stops, pos, ink, amount, size, pattern, dist, light, falloff, seed), `own` the colour's edited
shading or null. About 3 KB for 3 colours. The editor rebuilds the same from the colours; the set is
for whatever needs the palette whole without TuneSutra's code (tokens, other tools).
Palettes saved before names / gradients / the set existed still load.

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
