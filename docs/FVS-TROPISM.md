# Tropism — FVS axes, levels and new rules

> Codename **Tropism** (Diego, Oct 14, 2026): cells turn in response to a signal — a rule, a field, a photo. Status: **planned, nothing built**. Open decisions: ledger O-73. Plan written Oct 14, 2026 from the rule review (`design-system/_fvs-rules.html`).


## Context
Diego asked (Oct 14, 2026) what is missing from the Component rules and how the **Transform axes** (Rotation · Flip · Scale) should work with them, then: *write a plan which includes the possibilities of those two evaluations*.

Today the axes mean something different in each rule:
- **Checkerboard, Random, Exhaustive, Uniform** — the axes are their states.
- **Step turn, Radial** — need Rotation on, then ignore its values.
- **Mirror** — reads Rotation as its turn.
- **Lines, Rhythm** — read only Scale, through a fixed "cycle S/M/L".
- **Connect** — reads only Flip.

Every rule only sets turn / flip / size. The gaps found:
- glide reflection
- symmetry from a hand-drawn piece
- field- and image-driven rules
- continuous size
- rings and spirals
- nesting
- paths
- colour or layers following a rule (already in the backlog)

**Outcome wanted:** one model where
1. **an axis says which values exist**,
2. **a rule says which one each cell takes**, and
3. **each axis can be driven by its own rule**.

The new rules then become small "level sources", and the new axes (Ink, Offset, Stretch, Layers, Content) reuse the same model.

**Hard constraint:** saved Components, built-in Figures, the regression baseline (629 cases, hashed SVG + cell strings) and `_figure-eval-baseline.json` stay byte-identical until a phase deliberately changes defaults. New cell fields must stay **absent** on default cells, so `JSON.stringify(cells)` and `canonicalState` don't move.

## The model

**Level.** A rule outputs, per cell, a **level**: an integer step (discrete rules) or a fraction 0–1 (continuous rules), plus a `kind: 'step' | 'unit'`.

**Axis.** Each axis maps a level to a value through its own **values**:
- **Rotation**: list of angles (0/90/180/270 today; 45° / 60° steps, or a free range).
- **Flip**: list of none / H / V.
- **Scale**: S/M/L list, or a min–max range.
- **Ink**: palette slots.
- **Offset**: a pair of dx, dy within the cell.
- **Stretch**: a pair of w, h.
- **Layers**: a set of visible layers.
- **Content**: Set items.

**Mapping.** A step level indexes the values list, cycling. A unit level interpolates a range, or picks the nearest list value.

**Driven by.** Per axis: *Rule* (default — the Rule menu above) or another rule with its own settings. The Rule menu stays the main control. "Driven by" is an override per axis, folded closed until used.

**Back-compat adapter.** Every existing rule keeps its current builder. A wrapper derives today's cells exactly when every axis is on "Rule" with today's values. A new path is used only when an axis is overridden or has non-default values. This is how the baseline stays byte-identical.

Reuse:
- `stateFrom` / `canonicalState` / `componentKey` / `dedupeComponents`, `activeAxes` / `axisValues` / `scaleValues`, `FAMILIES` (all in `fvs/js/engine/03-rules.js`)
- `buildComponentItems` in `fvs/js/engine/04-appearance.js:23` — the single cell→item point, 24 call sites
- `COLOR_RULES` / `ruleInk` / `entryItemInk` in `fvs/js/engine/00-core.js:87-130`
- Symbol's `anchorX`/`anchorY` placement (`fvs/js/engine/09-symbol-render.js:143-160`) — the precedent for Offset
- Symbol nested items' `kx`/`ky` (`fvs/js/engine/09-symbol-render.js:501`) — the precedent for Stretch
- Rhythm's level builders `rhythmBeatCells` / `rhythmWaveCells` (`fvs/js/engine/03-rules.js`)

## Manual — keep or remove? (Diego asked, Oct 14)

### What it is today
- `buildManualEditor` (`fvs/js/06-component-ui.js:458`) builds one group per cell: Rotation / Flip / Scale selects. On a 4×4 that is 16 groups and 48 menus in the panel.
- `readManualCells` (`fvs/js/engine/03-rules.js:882`) reads them; **Add component** puts the result on the board.
- Square cells only. No canvas interaction. It sets only what the axes set; it doesn't use the axes.

### Overlaps
- **Component Edit** (double-click a Component): on the canvas, click / ⌘-click / marquee cells, give a cell its own shape, part inks.
- **Symbol › Fill mode Manual**: click and drag-select cells on the canvas, then edit them with **Cell properties** (`cellPropsHTML` / `syncCellProps` / `bindCellProps`, `fvs/js/11-symbol-ui.js`) — Rotation, Flip, Scale, Padding, lock.
- **Uniform**, then Component Edit, gives the same result as Manual, on the canvas.

### Verdict
Remove Manual **as a rule**, keep the capability, and move it onto the canvas.

**Phase 0 (small, before Phase 1):**
- Component Edit gains Rotation / Flip / Scale for the picked cells. Reuse Symbol's Cell properties block and its selection grammar (click, ⌘-click, marquee — already in Component Edit for parts).
- Then hide the *Manual* option, the same way as Diagonal mirror and Row / Column mirror: `hidden`, engine kept.
  - Saved Components with `ruleSource: 'manual'` keep their cells and label.
  - The regression check `auto:manualLocksIt` (`fvs/_test-regression.html:932`) still runs through the hidden option.
  - `scripts/test-fvs-ui.mjs` drops `manual` from its rule list.
- **Payoff:** Phase 5 *From a hand-drawn piece* becomes a button in that same edit: pick cells, set them, **Fill the rest with ▾** Mirror · Radial · Step turn. It's Manual and the rules combined, which Manual alone can't do.

## Phases (each one: CONSULT the words first, then regression + QA + board + Figure gates, then commit)

### Phase 1 — Levels + axis values (no visible change by default)
- `fvs/js/engine/03-rules.js`
  - Add `AXES` (rotation, flip, scale), each with `values`, `fromLevel(level, kind)`, `defaultValues()`.
  - Add `ruleLevels(mode)`, which returns per-cell levels for every rule. Rhythm and Lines already compute keys; Checkerboard returns its class; Radial its step; Mirror its flip class.
  - Keep each `rule*()` returning today's cells; assert in the test that `fromLevel` reproduces them.
- **Rotation values:** a row of chips (0 · 90 · 180 · 270, plus *Step* 30/45/60/90 or *Free*). On circle / triangle / hexagon cells the chips are the shape's steps (`latticeSteps`).
- **Scale values:** S/M/L as now, plus a *Range* mode (min–max %) for unit levels.
- **Test:** new `scripts/test-fvs-axes.sh`. Every rule × axis combination at defaults gives the same cells as `rule*()`. Regression stays 629/629.

### Phase 2 — Driven by, per axis
- **UI:** the Transform axes section becomes one row per axis: switch · values · *Driven by* (`Rule` | Uniform · Step turn · Checkerboard · Lines · Rhythm › Beat/Wave · Radial · Random). The driver's own settings fold out beneath it, reusing that rule's existing panel block markup where possible.
- **Engine:** `composeAxes(cellsFromRule, overrides)` replaces only the overridden fields. Overridden components are deduped on the full state.
- **Lines and Rhythm:** their "cycle S/M/L when Scale is on" becomes "Scale driven by Rule" — same cells.
- **Random / Exhaustive:** draw a family per overridden axis. **Exhaustive** gets a combination counter in its hint and the existing 512 cap, plus *Sample 512* as a later option.
- **Figure:** the Component rule node gets the same per-axis Driven by (`fvs/js/17-figure-graph.js` `rhythmRows` pattern). `componentCellsFromRule` accepts the overrides.
- **Saved:** the Component entry still stores only cells (unchanged). Optionally store `axes` for re-editing (decision D2).

### Phase 3 — New axes (each a separate, optional sub-phase)

**3a Ink — colour follows a rule.**
- `cell.ink` (a palette slot), set only when the Ink axis is on.
- `buildComponentItems`: `color = cell.ink != null ? paletteInk(cell.ink) : ruleInk(i, cr)`; same in `entryItemInk` and `withPartInks`' `inkSlot`.
- `COLOR_RULES` gains *Follow the rule* (ink = the Rotation level, for example).
- Closes the backlog item "colour follows the rule".

**3b Offset — shift inside the cell.**
- `cell.dx/dy` as a % of the cell.
- Applied in every item transform (see the Verification list of draw points): `translate(cx+dx·size, cy+dy·size)`.
- Enables jitter, staggered rows, and glide (3b + Flip).

**3c Stretch — width / height.**
- `cell.sx/sy` multiplied into the scale in the same transforms (Symbol already does `kx/ky`).

**3d Layers — which layers show / turn, per cell.**
- `cell.layers` (a hidden-ids set, or per-layer pose), drawn by `layerPasses` / `drawItemsPlainOnce` (`fvs/js/engine/05-render-component.js:417, 439`).
- Closes the backlog item "rules per layer".
- Needs the design read first: layer passes across cells.

**3e Content — which Element of a list per cell.**
- The Component step gains a small content list; the axis picks the item, rendered through the existing `cell.content` path (`resolveItemGeo`, `fvs/js/engine/04-appearance.js:345`).
- In Figure it maps onto the Set pick (`fvs/js/engine/17-figure-nodes.js:330`).

**For each new field:**
- add it to `canonicalState` **only when present**;
- keep it absent at defaults;
- add an `rt`-free export check in `test-fvs-axes`.

### Phase 4 — New level sources (rules that are just levels)
- **Field:** noise (shared `noise.js` `fbm`/`simplex2`), a linear gradient (angle), a radial gradient (from the centre or a corner), and *Rings* (Chebyshev / Euclid distance bands). Unit level, with Seed / Scale / Angle.
- **Image:** upload or pick a photo; the level = the luminance at each cell's centre (reuse `Organica.pollenEngine.processLuma` / `buildField`). Unit level. The image is never stored in presets — only its derived levels in the saved cells, like Colornet's rule.
- **Walks:** *Spiral* and *Snake* (boustrophedon) orders give a step level (the Step turn idea along a different path).
- **Continuous size** = Scale in Range mode driven by Field or Image.
- These appear in the Rule menu (driving all axes) **and** in every *Driven by* menu.

### Phase 4P — Photo in the Element (Diego, Oct 14: *the Element a mask of an uploaded photo; take its colour, a tone, or normal; convertible like Halide / Pollen / Spore to vector; both placements*)

**What it is.** A new Element **Style** next to Fill · Stroke · Pattern: **Photo**. The Element's shape is the mask; an uploaded photo shows through it.

**Placement** (a choice; both built):
- **Across the Component** — one photo covers the whole grid; each cell's shape is a window onto its own part of it, so the image reads through the pattern.
  - SVG: one photo layer clipped by the union of the cells' shapes. Reuse the Container clip path (`componentBoundaryClipContent`, `fvs/js/engine/04-appearance.js:354`). With Tone, each cell is its own clip group so it can take its own ink.
- **Inside each Element** — the whole photo inside every shape, turning and flipping with the cell.
  - Rendered like the Pattern style: `elementPathMarkup`'s clipPath branch (`fvs/js/engine/05-render-component.js:365`), with the photo instead of the pattern paths.

**Look** (a select):
- **Normal** — the photo's own colours, raster (an `<image>` inside the clip).
- **Tone** — the photo's light/dark mapped from the cell's ink to the Paper, so it follows Colour by and the Palette (an SVG `feComponentTransfer` duotone per ink, mirrored on canvas).
- **Dither** — 1-bit, vector, Halide's algorithms (Floyd–Steinberg / Atkinson / Bayer / Threshold).
  - Extract Halide's dither and rect-run vectoriser into `shared/dither.js` (2nd consumer rule).
  - Ink = the cell's ink; paper = transparent.
- **Stipple** — dots, vector, through `shared/pollen-engine.js` (`processLuma` / `buildField` / `computePoints`, already shared by Pollen + Mote).
  - Spore's mark library is a later option.
  - Ink = the cell's ink.
- **Bands** (optional) — posterised tone bands, vector, through `Organica.traceContours` (Komorebi / Warping's tracer).

Dither, Stipple and Bands are pure vector, so screenprint plates work (`Organica.plateExport`). Normal and Tone embed a raster `<image>` in the SVG; the export says so and plates are disabled for them.

**The photo's controls:** Upload (also by drag onto the Element canvas, `Organica.canvasDropZone`) · Fit (Cover / Contain) · Zoom · Position X/Y · Brightness / Contrast (reuse Pollen's tone pipeline) · the Look's own settings (density, algorithm, size).

**Tone also drives the rules.** Phase 4's **Image** level source reads the *same* photo when the Element has one: the luminance under each cell's centre drives Rotation / Scale / Ink / Offset via *Driven by*. A Component can then be a photo printed through the pattern *and* posed by it.

**Storage.**
- The photo is kept downscaled (≤ 1024 px long side, JPEG ≈ 150–300 KB) in the Element snapshot.
- The vector results are computed on draw and cached by (photo, look, settings, size) — never stored.
- Saved Components / Elements / Figures carry the photo once.

**Where it reaches.**
- The Element step: the style, the preview and the views.
- The Component step: both placements.
- Symbol / Figure content: *Inside each Element* works as soon as the Element carries the photo; *Across* at Symbol / Figure level is a later phase (it needs the whole frame as the window).

**Gates.**
- Regression unchanged (a new style, absent by default).
- QA export hashes plus a new photo case.
- Measure the draw cost on a 4×4 Stipple (cost-meter page, `design-system/_cost-meter.js`) before it ships.

### Phase 5 — Structure
- **Glide** (Mirror › Line gains *Glide*): flip on alternate rows + Offset half a cell. Needs 3b.
- **From a hand-drawn piece:** Manual sets a seed region (one quarter / row / cell); Mirror · Radial · Step turn fill the rest by copying and transforming the seed cells instead of computing from scratch. Uses `readManualCells`.
- **Nest:** an inner rule inside each k×k block + an outer rule across the blocks (Radial *Each 2×2* becomes one preset of it).
- **Paths (Connect+):** *Closed loops only* / *One line*. A search on top of `rhythmConnectCells` (backtracking, capped by tries; refuses with a reason when impossible).

## Decisions for Diego (put in the ledger before building)
- **D1** — Words: *Driven by*, *Values*, *Range*, *Ink*, *Offset*, *Stretch*, *Field*, *Image*, *Walk*, *Glide*, *Nest* (design-system CONSULT).
- **D2** — Store each Component's axis settings with it, so it can be re-edited (vs cells only, as now).
- **D3** — Order after Phase 2: **3a Ink + 4 Field/Image** first (recommended), or 3b/5 Glide first.
- **D4** — Exhaustive with overridden axes: cap only, or add *Sample*.
- **D6** — Photo: which Looks first (recommended: Normal + Tone + Dither, then Stipple, then Bands), and the stored photo size (1024 px JPEG proposed).
- **D7** — Order: Phase 4P can come right after Phase 1 (it needs only the Ink of each cell, which exists today through Colour by); *Tone drives the rules* waits for Phase 2.
- **D5** — Manual: hide the rule after Phase 0 moves cell editing onto the canvas (recommended), or keep it in the menu as well.

## Verification
- **Every phase:**
  - `scripts/regression.sh` must stay 629/629 until a deliberate re-record (named in the commit);
  - `scripts/test-fvs-qa.sh`, `test-fvs-boards.sh`, `test-figure-graph.sh` / `-eval` / `-board`;
  - `python3 scripts/check.py`; `python3 scripts/ds-audit.py --diff`.
- **New** `scripts/test-fvs-axes.mjs` (headless, own profile — never the shared Browser pane tab):
  - default axes reproduce each `rule*()`;
  - each Driven-by override changes only its field;
  - new fields stay absent at defaults;
  - dedupe includes them when present.
- **Draw points to update for 3b/3c**, each checked by the PNG / SVG / canvas byte-compare that QA already runs:
  - the item transform at `fvs/js/engine/05-render-component.js:391, 452, 504, 575, 597`
  - `fvs/js/engine/04-appearance.js:354`
  - `fvs/js/engine/09-symbol-render.js:501, 696, 730`
- **Visual:** the six-Element contact sheet harness (scratchpad `rhythm-test.mjs` pattern, headless) per phase; then the atlas re-captured by `scripts/capture-fvs-atlas.mjs`, with new cards for Field / Image / Glide / Nest and a *Driven by* section.
- **Docs per phase:** `docs/FVS.md` §5.3, UI-COPY rows, the ledger, the rule atlas.
