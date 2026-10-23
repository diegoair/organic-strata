# FVS — Tropism, v2 (rewritten Oct 23, 2026 on today's model)

> Codename **Tropism** (Diego, Oct 14, 2026): cells turn in response to a signal — a rule, a field, a photo.
> **v2 (Oct 23, 2026, Diego: *ok go ahead*)** rewrites the plan on the model the rule-by-rule tests (Oct 21–23) left:
> every rule is a package, the Transform axes act after a rule or as its material, every variant is named and grouped,
> an Element can keep its own proportions. The v1 text (Oct 14–15) is in git (`42de358` and before); what it decided
> still stands where it isn't superseded here (ledger O-73, §2 2026-10-14 / -15).

## What changed since v1
- **Superseded:** v1's Phase 1–2 core — a level → value mapping per axis (`AXES`, `fromLevel`) and a *Driven by* menu on
  every axis. Today the rules have (almost) no controls: Checkerboard, Radial, Lines, Rhythm and Exhaustive / Random are
  packages; Turns, Flip and Scale are either applied after the rule (Uniform, Mirror) or the rule's own material
  (`TURNS_REPLACE`, `FS_AFTER`, `docs/FVS.md` §5). A per-axis *Driven by* would put controls back on rules we just
  emptied — dropped.
- **Built:** v1 Phase 0 (Components by hand in Component Edit, Oct 14); Phase 1's Turns / Sizes became today's
  Transform axes (Turns = Up to / Every); the grouping by variant (`rv`, `ck`, `xf`) gives every Component a name.
- **Still open and still worth it:** everything that **adds a capability** — colour and layers following the rule, a
  shift / stretch per cell, field and photo signals, the Photo Element style, and the new structures.

## The one engine idea kept: a level per cell
Each rule already knows, per cell, which "class" a cell is in — Checkerboard's A / B, a Line's index, Rhythm's beat
level, Radial's step, Mirror's plain / mirrored, Step turn's step. v2 makes the rules **write it on the cell**:
`cell.lv` (a small integer; `lvKind: 'step' | 'unit'` for a 0–1 level from a field or a photo). It is the signal the
new axes read. Rules:
- `lv` is set by the builders in `fvs/js/engine/03-rules.js` (`GRID_BUILD.*`, `ruleLinesAll`, `ruleRhythmAll`, the
  Checkerboard pairs, `latticeRule`) — **absent** unless a new axis is on, so saved Components, the regression baseline
  and `canonicalState` / `componentKey` don't move (v1's hard constraint, unchanged).
- When an axis that reads it is on, `lv` joins the dedupe key (two cells drawn alike but inked differently are different).

## Phases (each: design-system CONSULT for the words first; full suites before a commit; the atlas re-captured)

### T1 — Ink: colour follows the rule (closes the backlog item "colour follows the rule"; v1 3a)
- A new switch in **Transform axes**, **Ink** (word to confirm): on, each cell's ink is the Palette slot of its level
  (`lv mod inks`), so Checkerboard's A and B take two inks, Lines a colour per line, Rhythm a colour per beat.
- Engine: `cell.ink` written from `lv` after the rule; `buildComponentItems` → `color = cell.ink != null ? palette slot :
  ruleInk(i, cr)` (`fvs/js/engine/04-appearance.js:23`), same in `entryItemInk` and `withPartInks`.
- Package: with Ink on, every Component of the rule also comes **in its inks** (a column on the board, like a flip).
- Relation to today's colour controls (Colour by · Layer colour variants · Colourways · Each part the next ink, felt as
  unclear — CLAUDE.md Oct 15–17): Ink is *by the rule*; Colour by stays *by position*. The CONSULT decides whether Colour
  by gains *Follow the rule* instead of a separate switch (decision **T-D2**).

### T2 — Photo in the Element (v1 4P, unchanged in substance)
A new Element **Style**, **Photo**: the shape is a mask, an uploaded photo shows through it. Placements *Across the
Component* and *Inside each Element*; Looks **Normal · Tone · Dither · Stipple · Bands** (Dither = Halide's algorithms
extracted to `shared/dither.js`; Stipple = `shared/pollen-engine.js`; Bands = `Organica.traceContours`). Vector Looks
keep plates working; Normal / Tone embed a raster and say so. Photo stored downscaled (≤ 1024 px JPEG) in the Element
snapshot; vector results cached, never stored. Independent of the rules — can come first (**T-D1**).

### T3 — Image and Field signals (v1 Phase 4)
- **Image:** the luminance under each cell's centre (`Organica.pollenEngine.processLuma` / `buildField`) becomes the
  cell's `lv` (unit) — a new rule package **Image** (turn by tone · size by tone · ink by tone, grouped by what it
  drives), and the signal T1's Ink reads. Uses T2's photo when the Element has one, else its own upload.
- **Field:** noise (`shared/noise.js`), a linear / radial gradient, *Rings* (distance bands) — a package **Field**
  with a few curated seeds / angles, the same three "drives".
- **Walks:** *Spiral* and *Snake* orders as two more starts of Step turn (its package grows a section each).

### T4 — Offset and Stretch per cell (v1 3b / 3c) → Glide
- `cell.dx / dy` (a % of the cell) and `cell.sx / sy`, absent by default; applied at every item transform
  (`fvs/js/engine/05-render-component.js` draw points, `fvs/js/engine/09-symbol-render.js`), Symbol's `anchorX/Y` and
  `kx/ky` as the precedents.
- **Glide:** Mirror's package gains *Glide* sections (alternate rows flipped + shifted half a cell).
- A Rectangle Element (Oct 23) needs nothing new: its cells are already its proportions.

### T5 — Layers follow the rule (v1 3d; closes the backlog item "rules per layer")
- `cell.layers` (which layers show, or turn) from `lv`; drawn by `layerPasses` / `drawItemsPlainOnce`. Needs a design
  read first (layer passes across cells).

### T6 — Structures (v1 Phase 5)
- **From a hand-drawn piece:** in Component Edit, set some cells by hand, then **Fill the rest with ▾** Mirror · Radial
  · Step turn (copies and transforms the hand-set cells). Uses Phase 0's editing.
- **Nest:** an inner rule inside each k × k block and an outer rule across the blocks.
- **Paths (Connect+):** *Closed loops only* · *One line* — a search on top of `rhythmConnectCells`, refusing with a reason.

## Decisions for Diego (ledger O-73, before building)
- **T-D1 — Order.** Recommended: **T1 Ink** first (small, closes a backlog item, reads the rules we just built), then
  **T2 Photo**, then T3 (Image reuses T2's photo). Alternative: T2 first (independent, the most visible).
- **T-D2 — Ink's place.** A switch in Transform axes (recommended: it multiplies the package like Flip), or a *Follow
  the rule* option in Colour by.
- **T-D3 — Photo Looks first** (from v1 D6): Normal + Tone + Dither, then Stipple, then Bands; 1024 px JPEG.
- **T-D4 — Manual** (v1 D5, still open): hide the Manual rule now that cells are set by hand in Component Edit (recommended).
- **T-D5 — Words** (v1 D1, through the CONSULT): Ink · Image · Field · Rings · Spiral · Snake · Glide · Nest · Photo.

## Verification (every phase)
- `scripts/test-fvs.sh` (24 suites); regression and axes baselines unchanged until a phase deliberately re-records
  (named in the commit); new fields absent at defaults (`test-fvs-axes` asserts it).
- A per-phase test (T1: `lv` per rule, Ink by level, the package's ink columns; T2: the cost meter on a 4×4 Stipple,
  `design-system/_cost-meter.js`, before it ships).
- Headless screenshots on a separate port (never Diego's tab); `python3 scripts/check.py`, `ds-audit.py --diff`;
  the rule atlas re-captured; `docs/FVS.md`, UI-COPY and the ledger in the same change.
