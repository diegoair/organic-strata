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

---

## 5. Prototype — one Hollow for every shape (Oct 4, 2026)

Dev page `fvs/_proto-hollow.html` — **removed Oct 4, 2026** (it reached prod with the feature by mistake; Diego: not needed). Recover it from git (`49ea6b2`) if ever useful. It loads `/fvs/` in a hidden frame and uses the real `SEED_TYPES` and FVS's Paper.js scope. FVS itself is unchanged.

**Algorithm.**
1. Take the shape's visible silhouette, resolved by uniting it with itself, so a self-crossing pentagram gets no wall along its inner lines.
2. Measure the inradius by sampling. Wall t = Thickness % × inradius, the same unit as today's Outline sliders.
3. Build the band around every outline, holes included: one quad per flattened edge plus one disc per vertex, united pairwise. The flattening tolerance is ≤ 3% of t.
4. Hollow = shape ∩ band.

**Measured** on 17 cases at 8 / 30 / 80 / 95 %. Wall = inner-edge distance to the outline, min–max as × target:

| | Today's Outline | Generic Hollow |
|---|---|---|
| Triangle, Hexagon | 1.02–1.03 (exact: these are the shapes a homothety handles) | 1.00–1.00 |
| Triangle rounded + curved, Lens | up to **1.53** (thick at the tips) | 1.00–1.02 |
| Polygon curved + irregular, Blob | 0.87–1.22, 0.91–1.21 | 1.00–1.02 |
| Star, Star burst | down to **0.73** (thin at the valleys) | 1.00–1.00 |
| Cross, Chevron, Drop, Arc, Wedge, Circle with lobes, Circle + Inner seed, Pentagram | **none today** | 0.97–1.02 |

- Pixels differing from today's Outline: 1.4–9.2 % of the shape. That gap is exactly the uneven wall today's Outline has.
- Time: 4–60 ms per shape; Circle with 6 lobes ≈ 350 ms (many curve points). A real build would cache by `d + t` like `pathBBox`, so a slider drag only recomputes on change.

**Two bugs found and fixed while building it:**
- One compound "band" read as nonzero made Paper flip the ring on convex shapes with long edges (the hole came out filled). The band is now united pairwise.
- A fixed 0.3 flattening tolerance gave ±19 % walls on thin walls. It now scales with t.

**Open, for the real build (Diego):**
- Where Hollow sits. Proposed: Appearance, beside Rotate, so it works on every shape, layer and uploaded SVG.
- Whether the six shape-own Outline sliders retire. They can't fold 1:1: the picture changes up to 9 %. They would stay hidden for old snapshots, like Radius / Rotate.
- Whether Inner seed rings also get walls. Today: yes, every outline does.
- Performance budget on Symbol-size grids, where the cache matters.

---

## 6. Hollow shipped in FVS (Oct 4, 2026)

**Decided by Diego.**
1. Hollow goes in Appearance.
2. The six Outlines retire, hidden for old snapshots.
3. Inner seed + Hollow follows option **C**: the copies are the hollowed shape. A and C were compared on 8 Seeds at the same absolute wall. A puts the same wall on every edge, which nearly duplicates Style → Stroke, and at 40 % A's bands stay solid, so Hollow has no visible effect.

**Built.**
- `hollowGeometry(geo, pct)` and `withInnerHollowCopies` (copies **united**, not evenodd — evenodd turned every overlap of a thick wall white). They are wired into every `SEED_TYPES` geometry. Hollow 0 is byte-identical to before (regression 395/395).
- The value is a Seed param `hollow`, so every renderer and every layer gets it.
- The control sits in the look block after Length. That means it is in Appearance with one shape, and in the layer's card with layers. This is a deliberate placement, not beside Rotate: Hollow changes one shape, Rotate turns the whole Element.

**Fixed against the prototype.**
- I tried dropping the vertex discs on gentle turns to speed things up. It opened a crack through the wall (wall down to ×0.08), because the wedge between two quads starts at the vertex.
- Gentle turns now get two thin triangles instead of a disc. They are polygons, so the booleans stay fast, and the error is ≤ 0.25 % of t.

**Measured (real build).**
- Wall ±3 % on 14 cases at 8 / 30 / 80 %. Arc truchet at 8 % reaches 0.90–1.09: its bands are very thin.
- SVG = canvas: 0 px in fill / pattern, 2 px in stroke, with Rotate and Inner seed on.
- Per-layer values and the legacy note + Reset checked.
- Speed. The inradius was first sampled with Paper's `getNearestPoint` (~500 ms on a lobed Circle). It now runs in plain JS on the silhouette flattened to 0.05, with two refining passes: 0–5 ms. It is also closer to exact: triangle 30.80 vs the true 30.90 (Paper grid: 30.21).
  - Dragging any Seed slider with Hollow 30: 4–41 ms per step on every shape except **Arc truchet, 230–650 ms** (dozens of curved bands to unite).
  - Dragging Hollow itself: 1–20 ms.

**Open.**
- Arc truchet speed.
- Irregularity + Seed as one generic control (§2d), not started.
- Safari/Firefox.

---

## 7. Cut out × Copies — analysis and the rational UX (Oct 4, 2026)

**Rename (Diego).** *Hollow* → **Cut out**, inverted: 0 = solid, higher = thinner rim, no jump. Before, the slider was the wall thickness: 0 = solid, 1 = thinnest, 95 = nearly solid again. Cut out is remembered per shape type, like Width / Length.

**Analysis of Cut out + Inner seed (option C as first built).** Copies of the cut-out rim, scaled by Ratio and united. Matrix of Ratio 30–90 × Cut out 1–90 with 3 copies on circle, triangle and drop:
- Separate rings **only when Cut out > Ratio**: 6 of 24 pairs, identical on all three shapes.
- Elsewhere the copies landed on the previous rim and only shrank the hole — a duplicate of Cut out.
- Near the threshold: fragments. A crescent in the drop, bars in the rectangle, a real 1.2-unit gap in the triangle, because its centroid is not equidistant from its edges.
- Cut out 0 → 1 jumps from alternating bands to a solid shape. This stays, so that old saves don't change.

**A+B (Diego).**
- A: each copy fits inside the previous hole.
- B: the copies shrink toward the inscribed-circle centre.

Two refinements, from measurement:
1. Estimating the hole as "Cut out %" failed on stars (tips far beyond the inradius).
2. "Farthest point" failed on long and concave shapes (a rectangle's short side, a cross's arms).

So the fit is now the largest scale at which the whole outline still lies in the hole, by bisection.

Result on 10 shapes × 20 pairs: **no merge anywhere**. Fewer than 4 rings only where the copies become microscopic (low Cut out / low Spacing). 8 ms average, 32 ms max.

**UX (design-system CONSULT → Diego chose option B).**
- Cut out stays in Appearance. *Inner seed* → **Copies**.
- Ratio and Anchor hide at Count 0.
- With Cut out on:
  - Ratio reads **Spacing**.
  - Anchor offers Inner centre / Apex.
  - The Anchor row hides when only Inner centre is left.
- New Anchor option **Inner centre** for Cut out 0 too.
- Rejected:
  - A, one "Rings" section: it reverses the Appearance placement and conflicts with layers.
  - C, Copies per layer: needs a data migration.

**Verified.**
- Cut out 0 + Copies byte-identical to production on 108 cases (12 shapes × 3 anchors × 3 Count/Ratio). The regression suite has no Inner seed cases.
- FVS regression 395/395.

**Use cases** (see the session reply):

| Use case | Shape | Settings |
|---|---|---|
| Target | Circle | Cut out 50–70, Copies 2–3 |
| Contour lines | Blob / Drop | Cut out 85–92, Copies 5–8, Spacing 80–90 |
| Passe-partout | Rounded rect | Cut out 75–85, Copies 1 |
| Tunnel | Triangle / Rounded rect | Copies 3–4 |
| Ripples from a corner | Arc / Wedge | Anchor Apex |
| Plain ring | any | Copies 0 |
| Nested stars / flowers | Star / lobed Circle | — |

---

## 8. Irregularity — one for every shape (Oct 4, 2026)

**Why (as explained to Diego).**
- Five shape-own copies with two different behaviours under one name:
  - vertex jitter (Triangle, Polygon, Star);
  - edge wobble (Arc, Wedge, Blob).
- Plus Angle jitter on Polygon and Star.
- Nine shapes and Freehand/uploads had none.
- Up to 4 sliders per shape.

**Built** (approved: two modes, under Cut out). `irregularGeometry` works on the flattened outline:
- **Corners**: seeded offsets at detected corners, blended along the outline, so straight sides stay straight. A single corner (a drop's tip) fades to the far side.
- **Outline**: a normal offset along a periodic Catmull-Rom wave with `irrWaves` bumps.
- Amplitude: Irregularity % of the inscribed radius in Corners, half of it in Outline. Corners was first at half; doubled to match the old Triangle at the same value.
- Order: base → Irregularity → Cut out → Copies.
- No prototype page: compared in the console against today's controls.

**Verified.**
- 13 shapes × both modes, under 1 ms each.
- Circle and Blob are detected as cornerless, so they use Outline only.
- No dead control in either mode.
- Per-shape memory, Reset, and the legacy triangle render the same, with the note.
- SVG = canvas 0 px with Irregularity + Cut out + Copies.
- Regression 395/395.

**Open.**
- ~~Blob vs Circle + Irregularity.~~ Decided by Diego: **Blob stays** (Oct 4, 2026).
- Self-intersections at high Irregularity on thin shapes (Chevron, Segment) are possible; not clamped.
