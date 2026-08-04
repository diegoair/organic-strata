# Camouflage — User Manual

> Studio Rann · Organica · a creative disruption engine, not a concealment tool
> Live: [theorganicalanguage.vercel.app/camouflage/](https://theorganicalanguage.vercel.app/camouflage/)
> Shipped: August 1, 2026 · Three-mode architecture: August 3, 2026

---

## 0. Scope statement

Camouflage produces nothing that needs to functionally conceal, evade a detector, or fool a
human eye in a real environment. It borrows the *visual grammar* of camouflage — disruption,
fragmentation, contour-breaking, countershading — and drops the performance requirement
entirely, in the lineage of WWI dazzle ships → CV Dazzle → adaptive brand identity → Hardy
Blechman's **Disruptive Pattern Material** (the design-history term for camo's civilian/
artistic use across fashion, architecture, film, art). Every mode is judged on visual/creative
merit only; see `docs/organica-camouflage-tool-brief.md` for the full positioning brief and
`docs/Research_Report_Camouflage.md` for the underlying research (biology, algorithms,
artists, physical-output pipelines).

**Explicitly out of scope, by design**: no adversarial/ML-detection-evasion functionality. The
anti-surveillance references in the research (CV Dazzle, HyperFace, Weckert) are aesthetic
inspiration — fragmented, high-contrast, form-breaking motifs as a style choice — not a working
evasion tool. Nothing in this codebase targets a real detector.

---

## 1. What Camouflage does

Three generative modes, one shell, switched via header tabs (`.org-header--editor` +
`.org-tabs` — a shared component every other tool had left unused until now):

| Mode | Mechanism | Loop? |
|---|---|---|
| **Disruptive** | Gray-Scott reaction-diffusion — spots/stripes/labyrinth from two numbers (f, k) | Yes — the only mode with a real simulation loop |
| **Dazzle** | Recursive polygon fragmentation — bold angular facets, unique every time from one rule-set | No — instant, pure vector |
| **Countershade** | Tonal gradient (Thayer's principle) — fakes volume on a flat surface | No — instant, pure vector |

**Structural** is not a fourth mode. It's a third **Palette** option (alongside Duotone/Bands),
available in all three modes: colour derived from the pattern's own local geometry — gradient
direction in Disruptive, facet cut-angle in Dazzle, gradient orientation in Countershade —
instead of assigned. The way a Morpho butterfly's blue is structural colour (nanostructure),
not pigment. Building it as a shared palette layer instead of a fourth generator avoided
reimplementing Disruptive/Dazzle's geometry a second time just to recolour it.

It is a **standalone tool**, not an addition to Komorebi or the 55-form Genesis library. The
two were considered together during scoping (both are "organic pattern generators") and
deliberately kept separate: Gray-Scott is an iterative PDE solver that has to *converge* over
many steps before it means anything, a fundamentally different interaction model from
Komorebi's instant, on-demand procedural masks. Folding both into one file would have repeated
the two-engine complexity Living Path already carries (Vector vs Raster).

---

## 2. Disruptive — the mechanism

Two fields cover the grid: **A** (abundant, "substrate") and **B** (scarce, "activator").
Every step:

```
A' = A + [ dA·∇²A − A·B² + f·(1−A) ]
B' = B + [ dB·∇²B + A·B² − (k+f)·B ]
```

`∇²` is a discrete Laplacian (a 3×3 blur-like kernel) — the diffusion term. `A·B²` is the
reaction: B "eats" A wherever both are present, and eating produces more B, which is why the
marked regions grow. `f` keeps replenishing A everywhere (feed); `k` keeps removing B
everywhere (kill). The tug-of-war between those two settles into a stable pattern that depends
almost entirely on the **f/k ratio and their absolute scale** — not on the random seed, which
only decides where the pattern's features land, not what family they belong to.

Three named regions (exposed as quick-jump buttons, not just presets — sliders cover the
continuum between and around them):

| Regime | f | k | Character |
|---|---|---|---|
| Spots / mitosis | 0.0367 | 0.0649 | Discrete round blobs, "cell division" look |
| Stripes / worms | 0.0290 | 0.0570 | Thick wandering bands — see the honesty note below |
| Labyrinth / coral | 0.0545 | 0.0620 | Dense branching maze, thinner walls |

Beyond f/k, four more parameters shape the field: **Feature size** (how big the features are,
by scaling the diffusion coefficients), **Sites** (how many nucleation points it grows from),
**Persistence** (whether the seed shape survives into the result) and **Modulation** (a slow
noise field carrying several regimes on one canvas). All four are documented in §11d.

**Honesty note on "stripes":** vanilla *isotropic* Gray-Scott, seeded from random blobs, does
not produce dead-straight parallel stripes — it has no preferred direction, so it can only
meander. That is why the f/k-only preset is called **Worm bands**: a genuinely distinct,
wider-banded regime from Labyrinth/coral, but wormy rather than parallel. Straight stripes need
a directional bias, which the **Anisotropy** section now provides (§11c) — see the `True
stripes (zebra)` and `Tiger diagonal` presets.

**Seed shape — Blobs or Drop marks.** What the simulation grows from. Blobs are plain filled
circles (the original seeding). Drop marks stamp Organica's own gesture instead — a circle
pulled into a gravity tail, the same signed-distance shape as Komorebi's `shapeDrop` (simplified:
no multi-octave scatter engine, just a handful of discrete seeds, which is what a
reaction-diffusion initial condition needs). This is the direct link the research report draws
between the drop mark and *disruptive coloration*: "the drop mark ad alto contrasto è esattamente
l'elemento di bordo che rompe la percezione del contorno" (Thayer/Cott) — the tool's native
gesture as the literal seed of the pattern, not just a visual coincidence.

---

## 3. Dazzle — geometric fragmentation

WWI dazzle (Norman Wilkinson, 1917) wasn't about blending in — it was bold geometric
fragmentation meant to confuse an observer's *estimate* of a ship's heading, speed and range,
and every hull's pattern was unique so silhouettes couldn't be learned. Dazzle mode replicates
the generative logic, not a specific look: a **recursive polygon split**. Starting from the full
canvas rectangle, each facet is cut in half by a random line — the angle snapped toward
0°/45°/90°/135° plus jitter, for the bold zigzag dazzle character rather than a generic irregular
tessellation (Voronoi would read as organic cells, not dazzle) — until **Fragments** (the split
depth) or a minimum facet area is reached. Recursion means each canvas is a real, resolvable set
of straight-edged facets, not noise.

**Colour**: the two children of every split always get different colours — they share the cut
edge, so a match there would read as an obvious mistake. Non-sibling facets can still share a
colour, the same way real dazzle hulls did; the goal is disruption, not a tidy four-colour map.

Pure vector from the start: the canvas preview and the SVG export walk the *exact same* facet
list, so there's no tracing step, no raster round-trip — `buildSVGDazzle()` just emits one
`<path>` per facet.

**Not tileable.** Unlike Disruptive's toroidal field, Dazzle facets touch the canvas edge at
arbitrary points — each pattern is a genuine one-off, like a ship's hull, not a repeatable tile.
Disclosed in the export popover's hint text, not left for the user to discover.

---

## 4. Countershade — tonal gradient

Abbott Thayer's countershading principle (1896): an animal is darker where it's lit and lighter
where it's shadowed, cancelling its own self-shading and flattening its 3D form. Countershade
mode runs that gradient in reverse to *fake* volume on a flat surface — dark → light → dark
across a direction (**Linear**, reads as a cylinder/rod cross-section) or from the centre out
(**Radial**, reads as a dome/sphere). **Falloff** controls how far the light "highlight" spreads
before returning to shadow.

**Grain** is a seeded speckle overlay (driven by the shared Seed, §5) — the packaging use case
from the brief: the same design, but every physical unit reads as its own instance rather than
an identical printed copy.

Exports as a genuine `<linearGradient>`/`<radialGradient>` SVG def when Palette is Duotone — the
most honest possible vector form, nothing traced or rasterised. Structural Countershade has no
flat-fill vector equivalent (it's a continuous hue field), so it's approximated the same way the
raster preview is: a coarse 64-column grid, quantised and traced for real (§8 discloses the one
mathematical quirk this produces: a pure *linear* countershade has a constant gradient direction
everywhere, so Structural + Linear renders as a single flat hue — correct, if not the most
interesting combination; Structural + Radial is where the effect actually varies across the
canvas).

---

## 5. Seed — reproducible instances

A single numeric **Seed**, shared across all three modes, drives one deterministic PRNG
(`mulberry32`) that every mode's randomness reads from — Disruptive's blob/drop-mark placement,
Dazzle's facet splits and colour assignment, Countershade's grain. **Same seed + same
parameters = byte-identical output**, verified directly (not assumed): regenerating Dazzle at
seed 4242 twice, with a different seed run in between, produced an identical SVG string both
times and a different one for seed 999.

This is the "every instance unique but traceable" requirement from the brief — adaptive
branding (a mark that gets a related-but-different pattern per touchpoint, from one rule-set)
and limited-edition packaging (each unit's seed is its own provenance record) both need
exactly this: instant uniqueness on **Reseed** (floatbar, picks a new random seed), and exact
reproduction by typing a known seed back into the panel field.

Each generator resets its own RNG from the current seed at the *start* of its run
(`rng = mulberry32(currentSeed)`), not by relying on whatever state a shared RNG happened to be
in — so reproducibility holds regardless of how many times you've clicked around beforehand.

---

## 6. Palette — Duotone / Bands / Structural

One shared Palette section, not duplicated per mode — each mode's own render function
interprets the same three options in its own terms:

- **Duotone** — Ink/Paper colour pair. In Disruptive, a Threshold slider cuts the A−B field
  (only meaningful there — hidden in Dazzle/Countershade, where Duotone means something else
  entirely and Threshold would be a dead control, see §11). In Dazzle, colour is assigned per
  facet (§3). In Countershade, it's the two ends of the tonal gradient (§4).
- **Bands** — posterises a continuous scalar field into N flat steps, interpolated Ink→Paper.
  Only offered in Disruptive — Dazzle's facets are already discrete (nothing to posterise) and
  Countershade's two-stop gradient doesn't have enough range to band meaningfully. Hidden, not
  disabled, in the other two modes.
- **Structural** — hue from local orientation (gradient direction / cut angle), lightness from a
  local scalar level (§1). Available in all three modes; §2–4 note what "local geometry" means
  in each.

---

## 7. Export

- **PNG / JPG** — `canvas.toDataURL`, synchronous, at any Export Scale (×1–×4), for any mode —
  the export dispatcher just calls the same `renderFrame()` the preview uses, at a higher
  resolution.
- **SVG** — mode-specific, always a genuine vector, never a raster wrapped in an `<svg>` tag:
  Disruptive traces the reaction-diffusion field's own bands (`Organica.contoursToPathD`,
  shared with Halide/Komorebi); Dazzle emits its facet polygons directly, no tracing; Countershade
  emits a real gradient def (or a coarse traced grid for Structural). A shared helper,
  `tracedBandsSVG()`, handles both of Disruptive's two topologies: **stacked** ("≥ level") for
  an *ordered* field like Duotone/Bands, where each band legitimately contains the next and the
  "≥" trick guarantees no hairline gaps — and **independent equality masks** for a *categorical*
  field like Structural's hue sectors, where bands aren't ordered and stacking them would
  wrongly union unrelated hues together.
- **Seamless tiling** — Disruptive only, and automatic rather than a special export mode: the
  field wraps at its own edges by construction, so any crop tiles against itself with no seam.
  Dazzle and Countershade are one-off compositions, not tiles (§3, §4) — the export popover's
  hint text is mode-aware and says so rather than repeating a blanket claim that's only true for
  one of the three modes.
- **→ Figma** — same mode-dispatching `buildSVG()` the SVG export uses, pushed via the shared
  Figma plugin protocol.

---

## 8. Why a continuous simulation loop (unlike the rest of Organica)

Every other Organica tool (Komorebi since its Canvas2D rewrite, Halide, Pollen…) renders
on-demand: a control changes, one frame is queued, done. Camouflage genuinely can't work that
way — Gray-Scott's pattern doesn't exist until the simulation has run enough steps to
converge; there is no single-frame "result" to schedule. The loop **is** the algorithm, the
same way Living Path's own (glyph-masked) reaction-diffusion effect already runs iteratively
on the CPU.

To avoid spinning forever once nothing is left to compute, the loop **auto-pauses**: it tracks
the mean per-cell change each frame and stops once that has stayed below a threshold for 40
consecutive frames, flipping the header status from "Simmering…" (busy, animated dot) to
"Settled · f=… k=…" (active, static dot). Any control that changes the simulation itself
(f/k, grid size, gradient, Reseed) resumes it; a control that only changes how the *same*
field is drawn (palette, zoom, format) just repaints once.

Switching to Dazzle or Countershade doesn't reset Disruptive's convergence state — it just
stops the loop's per-frame work (`running && mode === 'disruptive'` gates the step), so an
unconverged simulation picks up exactly where it left off if you switch back, and a converged
one doesn't needlessly re-run. Dazzle/Countershade never touch `running` at all: there's no loop
to gate, only a single `renderFrame()` call per control change.

---

## 9. Architecture notes

- **Canvas2D + plain JS**, not WebGL/GLSL — deliberately matching the precedent Komorebi set
  in its own rewrite (§17 of `docs/KOMOREBI.md`): debuggable with a debugger and
  `console.log`, no shader compilation, and the grid sizes here (80–176) don't need a GPU to
  stay interactive.
- **Toroidal (wrap-around) boundary** everywhere — chosen from the start, not retrofitted,
  because it makes Zoom and seamless export free instead of two separate features to build.
- Shares `shared/organica-core.js` (`download`, `stamp`, `presetStore`, `hexToRGB255`,
  `normalizeHex`, `contoursToPathD`, `status`, `popover`, `autoLabelPanel`, `enhanceSliders`)
  and `shared/organica-tokens.css` / `organica-header.css` / `organica-panel.css` verbatim —
  no new shared code was needed; every building block already existed from Komorebi/Halide.
  Verified: 0 of 38 panel controls unnamed (`autoLabelPanel`), sliders show the filled-track
  + click-to-edit affordance (`enhanceSliders`), same as every other tool.
- **Mode tabs** (`.org-header--editor` + `.org-tabs`) — a component defined in
  `shared/organica-header.css` since before Camouflage existed but never adopted by any tool
  (confirmed by grepping every `index.html` for the class before using it). Camouflage is the
  first tool to actually use it, rather than inventing another one-off tab pattern the way
  Strata's `.output-view-btn` did.
- **Per-mode preset stores** (`Organica.presetStore('camouflage_' + mode)`, i.e. three
  independent `localStorage` keys) rather than one shared list — the three modes' control sets
  don't overlap (Disruptive's f/k mean nothing to Dazzle), so a single preset list would either
  need per-mode filtering logic or risk a saved preset silently doing nothing when applied under
  the wrong mode.
- **Seed, Ink and Paper are the only state shared across all three modes** (`SHARED_COLORS` in
  the code) — everything else lives in a per-mode `FIELDS` table that `readState()`/
  `applyState()` read from, so adding a fourth mode later means adding one table entry, not
  touching the serialization logic.

---

## 10. Known limitation, disclosed

Isotropic Gray-Scott cannot produce true parallel stripes from random seeding (§2). If a
straight-stripe look is needed later, the honest fix is an anisotropic Laplacian (different
diffusion weight along x vs y) — a real but scoped addition, not implemented in this pass.

---

## 11. Verification log

**First ship (Disruptive only, August 1, 2026):**
- Spots, Stripes/worms, Labyrinth/coral all rendered and visually confirmed distinct from
  each other in a live browser session (not assumed from f/k numbers) before shipping —
  same discipline as Komorebi §16/§22's "verify visually, don't reason from slider values
  alone" lesson.
- Gradient verified by sampling the live field: left-third vs right-third mean A−B measurably
  different (0.56 vs 0.41) under a horizontal gradient, and the rendered frame visibly shows
  discrete spots on one edge and full labyrinth on the other.
- Zoom ×2 verified with no visible seam at the tile boundary.
- `buildSVG()` called directly and inspected (path count, band count, byte length) rather than
  only eyeballing the PNG preview — the same rule Komorebi §16 was written to enforce after a
  luminance-banding bug slipped past a PNG-only check there.
- A real init-order bug was caught during this verification, not before it: `syncColor()`
  (called during page init to paint the Ink/Paper swatches) triggers a render, but the
  simulation grid (`a`/`b` Float32Arrays) wasn't allocated until *after* that call in the
  original init order — threw `Cannot read properties of undefined (reading '0')` on first
  load, canvas stayed blank. Fixed by allocating and seeding the grid first, before anything
  that can paint.

**Three-mode architecture — Phase 1 (August 3, 2026):**
- Every render/export path tested live per mode, not just visually: `buildSVG()` called
  directly for all three modes in both Duotone and Structural (6 combinations), each returned
  valid SVG with a sane path/band count and no exception.
- **Seed reproducibility verified, not assumed** — the entire point of §5: regenerated Dazzle
  twice at seed 4242 with a different seed (999) run in between; the two seed-4242 SVG strings
  were byte-identical, the seed-999 one differed. Same check for Disruptive's seeded field
  array (`b`) at seed 777 vs 555.
- PNG export verified end-to-end at ×2 scale (`withExportSize`) including that the canvas is
  correctly restored to preview size afterward — the exact class of bug (render-before-resize)
  already fixed once during first ship, checked again here since `renderFrame` was rewritten
  to dispatch across three renderers.
- Presets verified per-mode: saved a temporary Dazzle preset, applied a different built-in,
  applied the saved one back, confirmed the field value round-tripped correctly, deleted it.
- Accessible names re-verified after the header/panel rewrite (mode tabs, Seed field, three new
  mode-panes): 0 of 38 controls unnamed.
- **A real dead-control bug caught during verification, not before it**: the shared Palette
  section's Threshold row stayed visible in Dazzle and Countershade whenever Duotone was
  selected, even though neither mode's render or export code ever reads `rg-threshold` — a
  control sitting there doing nothing, the same class of bug Komorebi §18 was written to catch
  ("a control with no effect is a bug, not a harmless extra"). Fixed by gating Threshold's
  visibility on `mode === 'disruptive'` in addition to the palette check, the same pattern
  already used for hiding Bands outside Disruptive.

---

## 11b. Output-quality audit (August 3, 2026)

Diego's verdict on the first three-mode build was that output quality was "limited and
mediocre". Rather than tune by eye, each mode was **measured**. Four distinct root causes came
out, all of them the same underlying mistake in different clothes — **letting an internal
representation leak into the output** — and all four are now fixed, with before/after numbers.

**1. Render resolution — the blocky edges.**
Measured: 54% of the settled field's cells hold an *intermediate* value, i.e. more than half
the field is edge information. The build threw all of it away: it thresholded per **cell**,
wrote an N×N ImageData, and let `drawImage` upscale — so on a 128 grid at 640px, each of ~1,717
boundary cells became a hard **5-pixel stair-step**. Fixed by sampling the field **bilinearly at
output-pixel resolution** and applying the threshold there, so the contour lands at a real
sub-cell position. The simulation grid is untouched; this is purely how it's drawn. Cost:
9.2 ms/frame at 640² (74 fps with the solver), was 0.3 ms — an affordable trade for the single
most visible defect in the tool.

**2. Dazzle facet distribution — the three-blobs problem.**
Measured on the shipped build: the largest facet covered **29.6%** of the canvas, the top three
covered **65.2%**, largest-to-smallest area ratio was **1162×**, and two facets were thin
slivers (perimeter²/area of 689, where a square is 16). Two causes, both fixed: the cut point
was **uniformly random in the bounding box** (a point near an edge — which happens half the
time — produces one huge piece and one sliver), and recursion was **depth-driven**, so a facet
that won the big half of an unbalanced cut stayed big no matter its size. Now the cut passes
near the polygon's **centroid** (±18% jitter) and recursion is **area-driven** — anything above
the target area keeps splitting. After: largest **4.1%**, top three **12.1%**, ratio **3×**,
worst sliver **55**, zero slivers over 100. `Fragments` correspondingly changed meaning from
recursion depth (2–8) to approximate **facet count** (4–80), which is what its label always
implied.

**3. Structural colour — the rainbow.**
The build mapped local angle onto the **full 0–360° hue wheel** at fixed saturation: the classic
rainbow colormap, garish, ignoring the Ink/Paper the user had chosen — and backwards from the
very phenomenon it cites. `Research_Report_Camouflage.md` §1 is explicit that a Morpho's blue is
a Bragg stack reflecting *"una banda stretta di lunghezze d'onda (blu ~460 nm)"*. Real
iridescence shifts blue→cyan→violet as it tilts; it does not travel through yellow and red.
Now the sweep is a **76° arc anchored on the user's own Ink hue** (falling back to Morpho blue
at 220° when Ink is achromatic, as the #0a0a0a default is), with saturation and lightness also
shifting across the sweep, since real structural colour changes brightness with angle too.
A second defect fixed alongside it: the gradient was sampled over a **sub-cell step**, and
bilinear interpolation has a *constant* derivative inside a cell — so every pixel in a cell got
the same hue and the result came out in visible cell-sized facets. The step is now a full cell.

**4. SVG geometry — the staircase.**
`Organica.contoursToPathD` (shared with Halide/Komorebi) walks **cell edges** and emits
axis-aligned segments. That is exactly right for Halide, where the subject *is* a grid of
dithered square pixels. It is exactly wrong for organic blobs: measured **26 right-angle
vertices per spot**, 1,220 straight segments and **zero curves** across the export — a leopard
spot rendered as a staircase. Camouflage now reuses the shared tracer for **topology** (which
cells form which closed loop, holes included — that logic is correct and worth sharing) and
replaces only the **geometry**: the staircase loop is decimated, low-pass filtered to kill the
single-cell zigzag, and emitted as Catmull-Rom-derived **cubic Béziers**. After: **1,209 curve
segments, 0 straight lines**, verified by overlaying the exported SVG on the canvas — identical
regions, smoother edges. The shared tracer is deliberately **not** modified; Halide depends on
its rectilinear output. Note Dazzle correctly still exports **straight lines only** — its facets
are meant to be sharp.

**5. Countershade shading curve — the flat plateau.**
Not a measurement but a physics error: the gradient ramped **linearly** from a flat plateau of
Paper out to Ink, which is why it read as "a big flat area with dark edges" rather than a
rounded form. Real self-shading has no plateau — a cylinder lit from the viewer's side has
normal angle θ = asin(x) across its width, so Lambertian brightness is **cos θ = √(1−x²)**, with
a rounded shoulder that falls away increasingly fast toward the silhouette. That curve *is*
Thayer's countershading. Now sampled into 17 stops shared by the canvas render and the SVG
export (so the two cannot drift), with **Falloff** raising it to a power — broad soft body at
the low end, tight highlight at the high end. The SVG stays a genuine 0.9 KB `<radialGradient>`.

---

## 11c. Disruptive enrichment — anisotropic stripes + seed-from-shape (August 3, 2026)

Two of four requested enrichments landed (the other two — cephalopod-style layered noise and
a Web Worker for higher-resolution grids — are scoped but not built; see §12).

**Anisotropic diffusion (real parallel stripes) — three attempts, in order, kept as the
record of why the first two failed:**

1. A rotated diffusion **tensor** (Dxx=cos²θ+D⊥sin²θ, Dyy=sin²θ+D⊥cos²θ, Dxy=(1−D⊥)sinθcosθ)
   through ordinary axis-aligned finite differences, approximating the mixed ∂²/∂x∂y term from
   the 4 diagonal neighbours. Textbook formula. Worked cleanly at θ=0°/90° (where Dxy=0 and the
   mixed term drops out) — verified visually at θ=50° and got a **maze, not stripes**: the
   4-point corner estimate is too coarse relative to how small D⊥ gets at high Anisotropy.
2. Rotating the **sampling** instead of the tensor — the two second derivatives taken directly
   along the rotated stripe axes, using **bilinear**-interpolated taps. Fixed the topology at
   θ=50° (real bands appeared), but measuring the actual anisotropy ratio (mean-squared step
   along the stripe vs across it) explained why it still read soft: **9.24×** at θ=0° (an exact
   grid lookup, zero blur) collapsed to **2.15×** at θ=50° (fractional coordinates, so bilinear
   blends in neighbours) — interpolation smoothness leaks diffusion into the axis that's
   supposed to be suppressed. **Catmull-Rom** (sharper, 16-tap) was tried next and made it
   *worse*, confirming the leak scales with interpolation smoothness, not tap count.
3. **Shipped**: nearest-neighbour taps — no interpolation, no blur to leak. The same ratio
   measurement recovered a clean directional split at every angle tested (0°/50°/90°). The
   trade is grid aliasing (a faint stipple where the angle doesn't line up with the lattice),
   minor at Grid=Fine (176) and part of why the "True stripes" preset sets it. Numeric
   stability was a separate, earlier bug in the same feature: the unscaled tensor Laplacian
   diverged (field oscillating at the ±1 clamp bounds, `lastDiff` stuck around 2.0 instead of
   decaying) because a plain second-difference stencil is ~5× the magnitude of the hand-tuned
   9-point kernel at the same nominal coefficient — fixed by matching the two kernels' scale
   (×0.2), not by guessing a smaller number.

New controls: **Anisotropy › Amount** (0 = the original isotropic kernel, unchanged — every
existing preset stays on it, this path only engages above 0) and **Direction** (0–180°). At
high Anisotropy, `seed()` also switches from scattered random blobs to a **jittered row of
seeds along the stripe direction, repeated across the perpendicular axis** — verified visually,
not assumed: the first version kept the old random placement and produced clean stripes *near*
the few seed points and blank canvas everywhere else, because suppressed perpendicular
diffusion means information can no longer spread sideways to reach unseeded regions.

**Seed from shape.** A third Seed shape option, **Shape…**, opens a file picker (any image —
a Halide 1-bit export or Strata trace drops straight in) and seeds B only inside the dark
region, via the same **masked reaction-diffusion** technique Living Path already uses to carve
cellular holes into a glyph instead of dissolving it into floating dots. Two parts: nucleation
points are rejection-sampled so they only land inside the shape, and — the part that actually
keeps the pattern contained, not just started, there — **every simulation step pins cells
outside the mask back to the resting state** (`a=1, b=0`), so the reaction cannot leak past the
silhouette no matter how long it runs. Verified directly, not eyeballed: seeded from a
synthetic star silhouette, ran to settlement, and confirmed **0 of ~24,957 cells outside the
mask** had moved from the resting state — a hard 0.00% leak, not "looks contained."

---

## 11d. Preset rebuild + three new Disruptive parameters (August 3, 2026)

### The presets were measured, not eyeballed

Each preset was run to settlement from a fixed seed and fingerprinted (ink %,
connected-component count, mean component area, local-density spread over a 4×4
partition). Two of the seven failed on their own terms:

- **`Drop-mark disruption` was a duplicate of `Labyrinth / coral`** — identical f/k, and it
  settled to the same attractor (42.9% vs 40.8% ink, same topology). A seed *shape* leaves no
  trace once a Gray-Scott field converges: the seed decides *where* features land, never *what
  kind* they are. The preset promised Organica's own gesture and showed none of it.
- **`Stripes / worms` settled at 63.7% ink** — so dark it read as a solid field with light
  cracks rather than as bands, i.e. sitting at the extreme of its own regime.

The set is now **15 presets**, verified with a signature check that no two share the same
field-generating parameter combination (0 identical pairs). `Stripes / worms` became
**`Worm bands`** retuned to 45.6% ink; `Drop-mark disruption` was rebuilt on the new
Persistence parameter so the drop marks actually survive into the result.

New presets exercise the parameters the old set never touched — Feature size
(`Cheetah fine` / `Giant cell`), Modulation (`Cephalopod skin`, `Reef mottle`), anisotropy at
an angle (`Tiger diagonal`), radial gradient (`Radial dissolve`), Structural palette
(`Morpho iridescent`) and Zoom (`Tiled swatch`).

**Note on the fingerprint's blind spot**: it is rotation-invariant, so `True stripes` and
`Tiger diagonal` measured *identically* (52.8/11/1487 vs 52.7/11/1485). They are not
duplicates — a separate directional measurement confirms stripe angles of 0° and 65° with
anisotropy ratios 9.4 and 12.0, plus different palettes. The metric was wrong for that pair,
not the presets.

### Feature size — the diffusion coefficients, finally exposed

`dA`/`dB` had been hardcoded at 1.0/0.5 through every build, which left no way to change how
**big** the pattern's features are: Grid changes simulation cost, Zoom repeats the same tile.
Gray-Scott's wavelength goes as √D — the diffusion coefficients *are* the scale control, as
`Research_Report_Camouflage.md` §1 states outright.

The obstacle was stability: this is explicit Euler, the 9-point kernel's most negative
eigenvalue is ≈ −2, so the scheme holds only while dt·D ≲ 1 — and dA was **already exactly at
that limit**. Feature size therefore raises D and lowers dt together (`dA = 1.0·s, dB = 0.5·s,
dt = min(1, 1/s)`), keeping dt·dA pinned at 1. dt does not change the steady state a
reaction-diffusion system settles into, only how fast it arrives, so this buys a genuinely
larger pattern at the cost of proportionally more steps.

Verified: at s = 1 every number is bit-identical to the previous build (no existing preset
shifts), dt·dA ≤ 1 across the whole slider range, and mean component area came out **49 → 101
→ 164 → 215** for s = 0.5/1.0/1.6/2.4 — proportional to *s*, exactly as area ∝ λ² ∝ D predicts.

**A real bug this surfaced**: at s = 2 the pattern died out completely (0 blobs, 0% ink).
Not a numerical failure — a physical one: nucleation sites sized for D = 1 disperse below the
critical density before they can nucleate once D is doubled. Seed size now scales with √s.

### Modulation — the cephalopod layer

A slow noise field varies f/k from cell to cell, so one simulation carries several regimes at
once (round spots in one region, elongated worms in another). This is the research report's
three-layer cephalopod-skin model (§5): a slow structural field under the fast reactive one.
Unlike Gradient it has no direction, so it reads as organic unevenness rather than a ramp.

`hash2`/`vnoise`/`fbm` are ported verbatim from Komorebi (`komorebi/index.html` §509–548) —
the same scalar value-noise stack it builds every canopy pattern from, reused rather than
reinvented.

**Defect caught by measuring the field rather than the output**: plain fbm returns ~0..1 but
its *mean drifts with frequency*. Mapped through `fbm*2−1` the sampled field measured entirely
negative at low Region size (profile −0.29…−0.53 across the canvas), so modulation pushed f/k
consistently one way — quietly changing the regime instead of texturing it. Fixed with
`fbmSigned`, which accumulates `(vnoise − 0.5)` per octave and is therefore centred at zero by
construction at any frequency. Residual bias measured across 6 seeds: 0.188 at Region size 1.2,
0.076 at 2.0, 0.059 at 2.2 — hence the **slider floor of 1.8**. Below that less than one noise
cycle fits the canvas and the field degenerates into a one-way ramp, which is what Gradient
already does better.

Verified: local-density spread rose 0.052 → 0.106 → 0.148 as Amount went 0 → 0.5 → 1.0.

### Persistence — making the seed shape survive

The fix for the duplicate preset above. Instead of seeding only at t = 0, B is re-injected at
the original nucleation sites every step, weighted by a feathered copy of the seed's own SDF
(`seedInject`), so the drop marks remain a standing feature of the settled pattern.

Verified by correlating the settled field against the injection map: **−0.02 → 0.35 → 0.45**
for Persistence 0 / 0.35 / 0.8. The −0.02 at zero is the original diagnosis restated
numerically — with no persistence the result retains no memory whatsoever of what it grew from.

Also exposed: **Sites**, the nucleation-point count, previously hardcoded at `5 + rng()*4`.

---

## 11e. Bug fixes: dead control, unreachable values, premature stop (August 3, 2026)

Four fixes. Two came from re-reading the code against what the UI claims; the third is the one Diego actually noticed on screen ("the animation stops at some point").

**1. `Sites` was dead whenever Anisotropy > 0.3.** The anisotropic branch of `seed()` lays
nucleation points out as rows along the stripe direction and never read the control. Measured:
at Anisotropy 0.85, Sites 5 / 20 / 40 all seeded exactly **675 cells**. Sites now drives the
row spacing.

Its range there is deliberately narrower than on the isotropic path, and that is physics, not
a UI compromise: suppressed perpendicular diffusion cannot carry the pattern sideways into an
unseeded band, so rows sparser than ~3.2×size leave bare canvas between stripes. **The first
attempt did exactly that** — mapping Sites straight onto a row count seeded 3 rows on a 176
grid at the default and left most of the frame empty, a regression caught by looking at the
render rather than at the numbers. Sites now interpolates between "just dense enough to fill"
and "tightly packed", with the default landing on the spacing that was previously hardcoded.

**2. The canonical f/k values were not reachable.** A range input snaps to `min + n·step`, and
at `step="0.0005"` the Pearson/Munafo spots-mitosis pair fell between stops:

| Wanted | Actually got |
|---|---|
| f 0.0367 | **0.0365** |
| k 0.0649 | **0.0650** |

So `Leopard spots` declared 0.0367 / 0.0649 in its definition and the simulation ran 0.0365 /
0.0650 — visible in the status bar, and the tool was quietly saying one thing and doing
another. Step on f, k, f2 and k2 is now `0.0001`; both canonical values are exact. (`Coral
labyrinth`'s 0.0545 / 0.0620 happened to land on a stop and were always correct.)

**3. The simulation stopped too early — the visible "it freezes" symptom.**

Reported as "the animation stops at some point". The stop itself is deliberate (Gray-Scott
converges; continuing would redraw an identical frame forever), but it was firing far too soon.

The original test was "mean per-cell change per step below 4e-5 for 40 frames". Three things
were wrong with it, each found by measuring rather than reasoning:

- **`lastDiff` never reaches zero.** It settles onto a permanent noise plateau — for Coral
  labyrinth around 2.4e-5, only marginally under the 4e-5 cutoff — so the cutoff fired while
  the pattern was still visibly evolving. Lowering the number is not the fix: anything under
  the plateau never stops at all, and the plateau moves with regime, grid and dt.
- **It is not monotonic.** Traced live: `f19 6.2e-5 ↓ · f31 5.1e-5 ↑ · f55 1.6e-4 ↑ · f73
  1.6e-4 ↓`. Gray-Scott grows in phases — formation, then an **expansion** where spots
  multiply to fill the canvas and per-step change climbs again, then the real settle. A
  "stopped improving" test (tried second) fires during that climb and was *worse*: it stopped
  at 1.2s with **30.7%** of cells still to flip.
- **The structure was still forming.** At the old stop point Leopard spots had 47 blobs at
  25.8% ink; left running it reaches 49 blobs at 26.7% and holds there. It was stopping
  mid-mitosis.

Fixed by measuring the **field**, the way a viewer would: snapshot it, wait a window, and see
how much the picture actually moved. Stop when that drift falls to **12% of the run's own
peak** — self-calibrating across regimes, with no magic absolute constant. A third attempt
using "drift stopped improving" also failed and is documented in-code: drift decays smoothly
and indefinitely (Giant cell: 35% → 11% → 8% → 4% → 1% of peak, no plateau ever), so it ran to
the 30s cap even though ink% had been flat since 7.5s. Quiet windows are counted
**cumulatively**, because drift occasionally spikes back up (Leopard spots: 7.4% → 15.0% →
8.0%) and a consecutive counter would reset on every blip.

**Steps per frame is now scaled by 1/dt.** Feature size lowers dt, so a frame advanced less
simulated time and a high-Feature-size preset needed ~2.4× the frames — `Giant cell` ran past
the cap while everything else finished in 7–13s. Now a frame always advances the same
simulated time, so wall-clock convergence is roughly constant across Feature size.

| | before | after |
|---|---|---|
| Leopard spots | 6.6s, 11.0% still to flip | 8.5s, 8.5% |
| Giant cell | hit the 30s cap | 6.0s, 4.0% |
| Cheetah fine | — | 7.5s, 8.8% |

**Disclosed honestly**: the residual never reaches zero. Once the structure is fixed (ink %,
blob count) the features still migrate slowly, essentially forever — measured 16.3% → 7.9% →
5.2% flip over a 5000-step window at 6k / 12k / 20k steps. What the new criterion guarantees
is that the *structure* has stopped changing, not that every pixel has.

**4. Convergence readout.** The status line now reads "Simmering… 47%" — worth having now
that a settle takes several seconds and varies by preset. Progress is a log scale between the
drift peak and the settle threshold, with the last 15% reserved for confirming the quiet
windows. Two refinements came from watching a real run rather than trusting the formula: the
underlying signal **rises** during the growth phase, which pinned a first-sample baseline at
0% for half the run, and it fluctuates near the end, which made the readout go **85% → 81% →
99%**. The reading is now peak-baselined and monotonic:

```
before   0 → 0 → 0 → 0 → 9 → 71 → 85 → 81 → 99 → 100
after   27 → 27 → 27 → 37 → 67 → 82 → 88 → 90 → 94 → 100
```

---

## 12. Open follow-ups

- [x] **Anisotropic stripes** — done (§11c). Real parallel stripes at any angle via a
  nearest-neighbour-sampled directional Laplacian.
- [x] **Seed from image** — done (§11c), as **Shape…** in Seed shape. Uses masked
  reaction-diffusion (cells outside the shape pinned to resting state every step) rather than
  just seeding inside it, so the pattern stays contained — verified at 0.00% leak.
- [x] **Cephalopod-style layered structure** — done (§11d), as **Modulation**. A slow
  zero-centred fBm field varies f/k per cell so one simulation carries several regimes at once.
  Noise primitives ported from Komorebi rather than reinvented.
- [ ] **Web Worker for higher-resolution grids** — move `step()` off the main thread so Grid
  can go well past 176 without blocking the UI. Deliberately sequenced *last* of the four
  requested enrichments: it's the one architectural change or the group (message passing,
  transferable buffers, async coordination with the render loop), and building it after the
  algorithmic surface (anisotropy, shape-seeding, eventually layered noise) settles means
  porting one stable set of logic into the worker once, not iterating inside it.
- [ ] **Radial/multi-point gradient presets** — Disruptive's Gradient currently ships four
  directions; more exotic blends (e.g. per-corner four-way blend) are a straightforward
  extension of `gradientAt()`, not a new feature class.
- [ ] **Steps/frame as a user control** — currently a fixed constant (20/frame); exposing it
  trades simulation speed against UI responsiveness and hasn't been asked for yet. Note this
  now interacts with **Feature size**, which lowers dt and so needs proportionally more steps
  to settle — a high Feature size preset visibly takes longer to converge.
- [ ] **Reuse still on the table, evaluated but not built** (from the August 3 cross-tool
  audit): Living Path's `blendField` + `rasterFieldFromGroups` (25 lines, would allow composing
  several RD fields with union/multiply/subtract — explicitly deferred by Diego this round);
  its `skeleton` (Zhang–Suen) for labyrinth centre-lines and `contours` + `smoothPoly`
  (marching squares on a continuous field, complementary to the shared rectilinear tracer);
  Pollen's `makeFieldAngle` + `fieldStrokePts`, which would give streamlines following the RD
  field's own isophotes — also the natural input for the vpype plotter pipeline in Phase 3;
  Halide's `ditherErrorDiffusion` for rendering the continuous field as 1-bit texture.
- [ ] **Disruptive/Structural SVG file size** — 310 KB at 8 hue bands (vs 49 KB for Duotone),
  because each of the 8 categorical hue sectors is traced independently with full curve
  detail. Correct output, but heavier than it needs to be; more aggressive decimation on the
  structural path would trade a little contour fidelity for a much smaller file.
- [ ] **Countershade applied to a shape, not the frame** — the brief's actual use cases
  ("self-shading logotypes", "fake dimension on packaging") want the countershade mapped onto
  an arbitrary silhouette (an uploaded SVG/Strata trace), not filling the whole canvas. The
  shading curve is now physically right (§11b.5); confining it to a shape is the next step.
- [ ] **Physical-output export presets** — Phase 3 of the brief (not started): export variants
  tuned for Ink/Stitch (grayscale density-map PNG), screen print (Lab-quantised flat SVG), and
  a JS approximation of vpype-flow-imager's flow-field hatching (Jobard & Lefer streamlines).
  Scoped as its own pass, not folded into this one — see `docs/Research_Report_Camouflage.md`
  §Recommendations, Fase 4.
- [ ] **"Concealed Motion" (7th animation category)** — motion camouflage / CBDR as a new
  Genesis animation principle ("moving without appearing to move"). A *separate* initiative on
  `docs/ANIMATION-SYSTEM.md` + `organic-animations.css` (append-only), not part of Camouflage
  itself — likely CSS-only (very slow, linear, sub-perceptual transforms), not a simulation, so
  probably doesn't conflict with the animation system's CSS-only rule, but that needs its own
  scoping pass before touching a file the other 55 forms depend on.

---

*Studio Rann · Organica System v0.1 · August 2026*
