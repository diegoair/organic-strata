# FVS — Element tier: debug + duplicate features (Oct 4, 2026)

Scope: the Element tier only (`fvs/index.html` panel `tier-block[data-tier="element"]`, `SEED_TYPES`, `SEED_EXTRAS` → `shared/shapes.js` `EXTRAS`).

**Status (same day): steps 1–4 of §3 done** on Diego's "fai tutto" — see §4. §2d (shape-agnostic Hollow / Irregularity) and Wedge vs Arc-Centre are still open.

**Method.** Run in the browser pane on the local server: every visible control of every Seed type was moved and the Element render compared before/after; pairs of controls were compared by rasterising the Element SVG at 96×96 and counting differing pixels (0 = identical; ≤ 4 = anti-aliasing only). No console errors during the sweep.

Inventory: 15 Seed types; **~150 shape controls** (≈ 60 in HTML + ≈ 45 built from `EXTRAS` + circle's 20), plus Appearance (8), Inner seed (3), Split, Recipe, and the layer card (X/Y/Size/Rot).

---

## 1. Bugs

| # | What | Evidence | Fix |
|---|---|---|---|
| B1 | **Rounded rect → Type "Square" leaves Corner radius as it was.** Pill → Square gives a circle labelled "Square". | Pill (100/50/100) → Square = 100/100/**100** | Every rr preset sets `rg-rr-corner` (Square/Landscape/Portrait = 0). |
| B2 | **Rounded rect Type does not go to Custom when Corner radius moves.** Pill, then Corner 30 → still "Pill". | `syncExtrasType` is only wired to the keys of the *first* preset (`square`: width/height), and Corner is an HTML control, not an `EXTRAS` row. | Wire it to the union of the keys of all presets. |
| B3 | **Blob → Radius does nothing.** | Radius 60 → 20: **0 px** different. `blobGeometry` fits the result to the box (`fitToBox`), which cancels the radius. | Remove the slider (Appearance → Scale already does it), or stop fitting the blob. |
| B4 | **Arc → Type "Ring" is not a ring.** Sets Sweep to 350° (the slider maximum), which leaves a 10° gap. | Arc Ring vs Circle Ring: 159 px different. | Remove "Ring" from Arc (Wedge Ring and Circle Ring already make it), or allow 360. |
| B5 | **14 controls that do nothing until another control is moved, but are always shown** (breaks the dead-control rule Circle already follows with `syncCircleRows`). | Seed while Irregularity is 0 (Triangle, Arc, Wedge, Polygon, Star) · Segment gap while Segments is 1 (Arc, Truchet) · Corner style while Corner radius is 0 (Chevron) · Stack gap while Stack is 1 (Chevron) · Wave cycles while Wave is 0, Dash gap while Dashes is 1, Line spacing while Lines is 1, Space X/Y while Repeat is 1 (Segment) · Rotate on a plain circle | Hide them the same way Circle does. |
| B6 | Arc Seed is 1–99; the other Seeds are 1–999. | HTML | Make them all one range. |

---

## 2. Duplicates — the same result two ways (measured)

### 2a. Shape sliders that do what Appearance already does

| Shape control | = Appearance control | Pixels different |
|---|---|---|
| Circle **Radius** 50 | Scale 0.5 | **0** |
| Polygon **Radius** 60 | Scale 0.6 | **0** |
| Star **Radius** 60 | Scale 0.6 | **0** |
| Wedge **Squash** 50 | Length 0.5 | **0** |
| Chevron **Squash** 50 | Length 0.5 | **0** |
| Triangle **Base** 50 | Width 0.5 | **0** |
| Triangle **Height** 50 | Length 0.5 | **0** |
| Segment **Length** 35 | Width 0.5 | **0** |
| Blob **Radius** | — (does nothing, B3) | 0 |
| Rounded rect Width / Height | Width / Length | 0 with sharp corners; differs only with rounding (a pill vs an ellipse) — **a real difference, keep** |
| Lens Width | Width | 54 px (circular arcs vs a stretched lens) — close to a duplicate |

The Width/Length/Scale exceptions to note: with rounded corners, a stretch distorts the rounding — that is the one real reason for shape-level width/height (Rounded rect, and Triangle once Corner radius > 0).

### 2b. Rotate in 11 places

Per-shape Rotate on Wedge, Polygon, Star, Rounded rect, Chevron, Cross, Lens, Drop, Circle, plus Arc **Start angle** and Segment **Angle** — and the layer card's **Rot**. A single shape has no Rotate in Appearance, which is why each shape grew its own. One **Rotate** in Appearance (next to Scale / Move) would replace all 11. Watch: a few shapes refit to the cell after rotating (Circle squircle shrinks on overflow); one Appearance Rotate would have to choose one rule (rotate, then fit — or not).

### 2c. The same shape from two Seed types

| Shape | Ways to make it | Measured |
|---|---|---|
| **Full ring (annulus)** | Wedge → Type Ring · Circle → Interior Ring · Circle + Inner seed 1 × 50 | **4 px** (identical) between all three |
| **Sector / ring segment** | Wedge (Angle + Inner radius) · Arc with Pivot Centre (Sweep + Thickness) | Same family; they differ only in start angle (Wedge is centred on the vertical, Arc starts at the top) and Arc being fitted to the cell. Wedge Rotate ≈ Arc Start angle. |
| **Equilateral triangle** | Triangle → Type Equilateral · Polygon → Type Triangle | Same shape, different size/position in the cell |
| **Square** | Polygon → Type Square · Rounded rect → Square | Same shape, Polygon's is 0.71× smaller |
| **Star polygon** | Star · Polygon with Step > 1 (pentagram) | overlapping |
| **N-armed asterisk** | Cross → Arms / Asterisk · Segment → Rays (+ Thickness) | overlapping |
| **Petals / lobes** | Lens Petals · Drop Petals · Circle Lobes | three implementations of "repeat around the centre" |
| **Concentric rings** | Circle → Interior Concentric rings · Inner seed (any shape) · Style → Pattern → Concentric · Arc truchet (bands) | four ways |
| **Repeated lines** | Segment → Lines / Repeat X / Repeat Y · Style → Pattern → Lines | Segment's repeat is a pattern inside one shape; also the job of the Component grid |

### 2d. Same modifier re-implemented per shape (not identical output, but one concept)

| Modifier | Shapes that each have their own |
|---|---|
| Outline (hollow) | Triangle, Polygon, Star, Rounded rect, Lens, Blob (+ Circle Ring, Wedge Inner radius, Arc Thickness, and Style → Stroke) |
| Irregularity + Seed | Triangle, Arc, Wedge, Polygon, Star (+ Blob Amount/Seed) |
| Angle jitter | Polygon, Star |
| Edge curvature | Triangle, Wedge, Polygon, Star, Rounded rect, Chevron |
| Corner radius / rounding (+ Corner style) | Triangle, Polygon, Star (tip + valley), Rounded rect, Chevron, Cross, Wedge, Arc (ends), Truchet (ends) |
| Segments + gap / Dashes | Arc, Arc truchet, Segment |
| Taper | Arc, Cross |

These are the candidates for **Appearance-level, shape-agnostic** modifiers (one Hollow, one Irregularity + Seed, one Rotate), but they are not drop-in: each shape's version uses its own geometry (an inradius-based wall, a vertex jitter vs an edge wobble). Merging them means a generic path operation (offset / jitter on any `d`, e.g. through Paper.js, already loaded) — a real piece of work, not a cleanup.

### 2e. Placement: two levels, by design

Appearance **Scale / Move X / Move Y** (whole Element) and the layer card **Size / X / Y / Rot** (one layer) are a deliberate hierarchy, not a duplicate. Only gap: Rot exists per layer but not for the whole Element.

---

## 3. Suggested order (owner decides)

1. **Fix the bugs** B1–B4 (small, local), B5 (hide dependent rows), B6.
2. **Remove the 0-px duplicates** of §2a — Circle/Polygon/Star/Blob Radius, Wedge/Chevron Squash, Segment Length — or keep them and hide Appearance's equivalents for that shape. Either way one place per job. Old snapshots still carry the values, so the geometry must keep honouring them (or convert them into Scale/Width/Length on load).
3. **One Rotate in Appearance**, retire the 11 shape rotates (same snapshot caveat).
4. **Decide the overlapping Seed types**: drop Wedge's "Ring" and Arc's "Ring" (Circle Ring covers it); Polygon's "Triangle"/"Square" types vs the Triangle / Rounded rect Seeds; Wedge vs Arc-Centre.
5. Later, if wanted: shape-agnostic Hollow / Irregularity as Appearance modifiers (§2d).

Before any of this ships: a design-system CONSULT (the panel changes), FVS regression (saved Components/Symbols must render the same), and a snapshot-migration note in `docs/FVS.md`.

---

## 4. What was done (Oct 4, 2026)

- **B1–B6 fixed.** Rounded rect presets all set Corner radius and its Type re-syncs on any key a preset sets; Blob Radius retired; Arc and Wedge lose "Ring"; `SEED_DEPENDS` + `syncDependentRows()` hide every dependent row (re-measured: 0 dead visible controls at defaults; each dependent row reappears and changes the render once its parent moves; Segment Space X/Y also need the bar to have extent on that axis); Arc and Wedge Seed are 1–999.
- **§2a:** Circle / Polygon / Star Radius and Wedge / Chevron Squash retired (Triangle Base/Height, Segment Length, Rounded rect Width/Height, Lens Width kept — they differ once corners, angle or rays are involved).
- **§2b:** one **Appearance → Rotate** (after Width/Length, the same order as a layer's Rot). The 9 per-shape Rotates are retired; Arc Start angle and Segment Angle stay.
- **§2c:** Polygon's Triangle / Square types and Cross's X type removed. Wedge vs Arc-Centre: both kept for now (each has controls the other lacks).
- **Old snapshots:** the retired inputs live on, hidden, in `#seed-legacy`; `foldLegacySeed` moves a value into Appearance / the layer's place on load only when a 64×64 point sample of both pictures agrees. 66 single-shape cases + a 2-layer stack measured: identical (rotated rectangles differ only in anti-aliasing — same vertices).
- Checks: FVS regression 395/395, SVG = canvas (0 px) with Rotate in fill / stroke / pattern, `ds-audit --diff` clean, `check.py` passes.
