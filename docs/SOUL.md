# Soul — Organica's animation engine

> The tool at `/soul/`. Read this alongside `docs/ANIMATION-SYSTEM.md` (the 6
> physics patterns Soul rebuilds parametric) and `docs/LOOM.md` (Loom is
> Soul's most natural upstream source — its cell/grid model produces exactly
> the "many addressable elements with a real position" shape a stagger
> formula wants).

---

## 1. Why Soul exists

Genesis's 55 forms are animated, but the animation is CSS hand-typed per
form — `organic-animations.css` has one `@keyframes` rule per form, coupled
1:1 to that form's own markup. There's no way to take "Internal pressure"
(breath/heartbeat) and apply it to a shape that isn't one of the 55 without
writing new CSS by hand.

Soul is the general case: **pattern + stagger, applied to whatever
primitives are loaded**, not baked per-shape. The scoping conversation that
led here (session notes, August 2026) settled on three architectural
decisions, each already proven elsewhere in the repo before being reused
here:

1. **Primitives are vectors, always** — even raster sources vectorise
   first (every Organica tool already does this: Halide/Komorebi/Camo
   Turing/Warping all export real vector SVG via the shared contour
   tracer). So Soul's input contract is just "an SVG string" — no
   per-tool adapter, one parser.
2. **Loom is the layout layer, not reinvented** — a grid/canvas defines
   WHERE things are; Soul defines HOW they move. Loom's own cell list
   (`col/row/points`) is exactly the "many elements with a real position"
   shape a stagger formula needs.
3. **GSAP is the timing/morph engine**, not hand-rolled — evaluated
   against p5.js (declined: duplicates `organica-noise.js`/
   `organica-palette.js`, wants to own its own canvas/loop) and against
   building a timeline system by hand (GSAP's free "Standard, No Charge"
   license — confirmed live from gsap.com/standard-license, not assumed
   — covers this use case: no fee charged to end users to access
   Organica itself). Three.js (already vendored, used by Camo Turing) is
   the noted future path for very-large particle counts (thousands of
   Pollen-style dots) — not needed for the DOM/SVG-element scale Soul
   runs at today.

---

## 2. Architecture

```
Any Organica tool's SVG export
        │
        ▼
organica-motion.js: parsePrimitives(svgString)
        │  → flat list of {id, type: point|path, x, y, r, bbox, fill, stroke, sourceTag, sourceAttrs}
        ▼
soul/index.html: buildElement(primitive) → real <circle>/<path>/<polygon>/… DOM node
        │  (GSAP needs a real element to animate — DrawSVG/MorphSVG specifically
        │   operate on SVG attributes, not canvas draw calls)
        ▼
organica-motion.js: animate(targets, primitives, pattern, params, staggerCfg)
        │  → one GSAP tween/timeline per element, delayed per staggerDelay()
        ▼
Live playback in #stage-svg
```

**Everything downstream of `parsePrimitives` is SVG DOM, not Canvas2D** —
a deliberate change from the first commit (which rendered a static canvas
preview). GSAP, DrawSVG, and MorphSVG are all built to animate real
DOM/SVG properties; there is no clean way to hand a Path2D/canvas draw call
to GSAP. `soul/index.html`'s own `buildElement()` reconstructs each
primitive's real tag (`circle`/`rect`/`path`/`polygon`/`polyline`/`line`)
from the parser's preserved `sourceTag`/`sourceAttrs`, the same "redraw
from the original markup, not a normalised approximation" idea Pollen's own
`drawSvgEl()` already uses for its canvas replay.

## 3. `organica-motion.js` — the shared contract

### `parsePrimitives(svgString)` → `{ primitives, canvas }`

Walks the same tag set Pollen's own `drawSvgEl()` already handles
(`circle`/`ellipse`/`rect`/`path`/`polygon`/`polyline`/`line`, recursing
into `<g>`). Two things worth knowing:

- **Skips the canvas background rect** automatically — every Organica SVG
  exporter opens with a full-bleed `<rect>` (`width="100%" height="100%"`
  or matching the declared canvas size, at `x=0,y=0`); recognised
  structurally, not by document position, since a `<g>` wrapper elsewhere
  can shift what "element 0" means.
- **Resolves real SVG style inheritance** — `fill`/`stroke`/`stroke-width`
  set on an ancestor `<g>` (Loom's own convention: one
  `<g fill="none" stroke="#3399ff" stroke-width="1">` wrapping every cell,
  not per-shape attributes) propagate down to each leaf primitive. A first
  version read only the element's own attributes and every Loom export
  rendered in Soul's fallback colour instead of the real one — caught by
  testing against a real export, not a synthetic case, and fixed by
  carrying an `inherited` context through the recursion.

Every primitive carries `bbox`/`cx`/`cy` regardless of type — the field
any stagger formula needs (distance from centre, position), independent of
whether the shape is a point or a path. `getBBox()` needs its host SVG
actually attached to the document (a detached node returns an all-zero
bbox in Chromium) — `parsePrimitives` keeps one hidden, positioned
off-screen (not `display:none`, which also breaks layout/measurement) host
node for this, built lazily on first use.

### `PATTERNS` — the 6 physics patterns, GSAP-backed

| Pattern | Genesis pattern # | GSAP mechanism |
|---|---|---|
| `pressure` | 1. Internal Pressure | 2-tween timeline, `scale`, asymmetric ease (fast expand / slow contract) |
| `gravity` | 2. Gravity + Viscosity | percentage `keyframes` on `y`+`scaleY`, matching the CSS original's own stretch/squash shape |
| `growth` | 3. Growth by Tracing | **DrawSVG plugin** — direct match, no approximation (`drawSVG: '0%' → '100%'`); falls back to a manual `strokeDasharray`/`strokeDashoffset` tween if DrawSVG isn't registered |
| `environmental` | 5. Environmental Forces | continuous `x`/`y` drift, `ease: 'none'` (linear — the documented distinction from biological easing) |
| `rotation` | 6. Differential Rotation | per-primitive rotation, direction alternating by index parity (a per-element approximation of "counter-spinning layers" — Soul has no explicit layer/group concept yet) |

**"Collective Behaviour" (Genesis's own pattern 4) is deliberately not a
7th pattern function.** Its own definition in `docs/ANIMATION-SYSTEM.md` —
"the same simple animation on many elements, phase-shifted" — is exactly
what any of the 5 patterns above, composed with a Stagger, already gives
you. Building it separately would duplicate one of the 5 with a stagger
bolted on.

`growth` is the one pattern that only makes meaningful sense on path-type
primitives (a circle has no "stroke being drawn" to animate) — Soul's own
`playMotion()` filters to path-type primitives before invoking it, rather
than letting DrawSVG silently no-op on point-type shapes.

### Stagger — `staggerDelay(primitive, index, allPrimitives, config)`

A pure function, not tied to GSAP's own (position-string-only) stagger
DSL — returns a delay in seconds, handed to each tween's own `.delay()`.
Three formulas:
- `index` — `index * amount`
- `distance` — distance from the primitive set's own centroid (or an
  explicit origin), normalised 0–1 across the set
- `noise` — `simplexFbm2(cx, cy)` sampled at each primitive's own centre —
  reuses this same file's own Simplex noise (§4), not a separate RNG

## 4. Simplex noise (`simplex2`/`simplex3`/`simplexFbm2`/`simplexFbm3`)

Added to `organica-noise.js` ahead of the primitive/motion work, evaluated
directly against p5.js's own `noise()` rather than assumed better because
it's newer. The finding, not just the conclusion: **p5's `noise()` is NOT
gradient/Perlin noise** despite the name (a well-documented historical
mix-up) — it's structurally the same family as this repo's own
`vnoise`/`fbm` (value noise: hashed values at lattice points, smoothly
interpolated, summed over octaves), not a different algorithm. The real,
concrete differences: p5's hash is a **fixed-period lookup table** (visibly
repeats past ~4096 units) vs. ours' procedural hash (no practical period);
p5 is **stateful** (`noiseSeed()` mutates global state) vs. ours being pure
per-call functions, matching every other seeded function in this codebase;
p5 has a genuinely useful **native 3rd axis** for smooth continuous
time-evolution, which our own `vnoise`/`fbm` lacked (Komorebi's own
`windOffset` fakes motion with two decorrelated but discretely-different 2D
taps, not a continuously interpolated 3rd dimension).

Simplex noise (Ken Perlin's own 2001 successor) was added as the answer to
"what's the actual quality upgrade, independent of p5" — a skewed
triangular lattice instead of a square one, removing the directional bias
a square grid imposes. `simplex3(x, y, t)` gives Soul (and any future
consumer) the genuinely continuous time axis noise-driven motion needs.
Verified over 200k samples: range ≈[-1,1], near-zero mean, deterministic,
and the time axis's own continuity confirmed directly (max delta of 0.004
between samples 0.001 apart in t). Additive only — `vnoise`/`fbm` are
untouched, since Komorebi/Camo Turing/Warping all verified their own
shipped output against `vnoise`'s exact byte behaviour.

## 5. `soul/index.html` — the tool itself

Three panel sections: **Source** (paste or open an SVG file — any
Organica export), **Primitives** (read-only stats: canvas size, total,
point/path counts — proves the parse worked before anything else runs),
**Motion** (Pattern/Amount/Duration/Stagger/Stagger-amount + Play/Stop).

Header has PNG/SVG export — both a snapshot of the stage EXACTLY as it
looks at export time, mid-animation or at rest. This works with no special
"bake the current frame" step because GSAP already writes real inline
`transform`/`stroke-dashoffset` etc. onto the live DOM every tick;
`serialiseStage()` just clones and serialises whatever the DOM already is.
No Figma button — `sendToFigma()` implies "this becomes a Figma frame",
and what a moving animation becomes as a still frame is a real design
decision nobody's made yet, so it isn't wired to look like it works before
it means something.

`playMotion()`/`stopMotion()` are the whole runtime: `activeTweens` holds
exactly what the last `playMotion()` call created, so `stopMotion()` kills
precisely those (no guessing, no `gsap.globalTimeline` sweep) and resets
every primitive's element via `gsap.set(el, {clearProps: 'all'})` — a real
clean reset, not just pausing mid-pose.

## 6. Verified

- `parsePrimitives` against three real cases: a synthetic Pollen-style SVG
  (circles/path/polygon), Loom's own Bento export (11 primitives: 10 cells
  + 1 guide rect, background correctly excluded), Loom's own Hexagonal
  export (67/68-cell cases, real cubic-Bézier `<path>` geometry) — counts
  match Loom's own regression test exactly in every case.
- Style inheritance fix verified before/after: Loom's Hexagonal export
  rendered in Soul's own fallback colour before the fix, the correct
  `#3399ff` blue after — confirmed via both a direct attribute read and a
  full visual screenshot.
- All 5 patterns verified via real property inspection over time
  (`gsap.getProperty`), not just "no console error": `scale` genuinely
  cycling (pressure), `y` genuinely changing (gravity),
  `strokeDasharray`/`strokeDashoffset` genuinely animating (growth via
  DrawSVG), `x` genuinely drifting (environmental), `rotation` genuinely
  alternating sign by index parity (rotation).
- Stagger verified two ways: different primitives at different animation
  phases in the same time-snapshot (index/distance), and a primitive with
  a longer computed delay correctly still at its rest value while an
  earlier one had already started (proves the delay is real, not
  decorative).
- Scale-tested against a real 32-cell Hexagonal slice: `pressure` +
  distance-stagger produces a visibly organic, phase-shifted "breathing"
  field (screenshot-confirmed — genuinely different scale states visible
  in one frame); `growth` + index-stagger produces a real staggered
  "drawing itself" effect across the whole grid (screenshot-confirmed).
- 0 of the 5 new Motion controls unaccessibly-named (`Organica.autoLabelPanel`,
  verified via `aria-labelledby`, not just visual proximity).
- Zero console errors across every load, pattern switch, play, and stop
  tested.
- PNG/SVG export verified against actual output, not just "downloaded
  without throwing": exported SVG mid-animation confirmed to contain a
  real live `transform="matrix(...)"` value (proves it's exporting the
  ACTUAL current pose, not a reset/rest state); exported PNG decoded back
  and its pixels sampled, confirming the real content colour is present
  at the correct dimensions (2x scale).

## 7. Not built yet

- **Video/GIF export** — PNG/SVG (a single-frame snapshot, mid-animation
  or at rest) work today; there's no render-to-video pipeline yet. Camo
  Turing's own `canvas.captureStream()` + `MediaRecorder` approach is the
  precedent, but it needs an SVG-to-canvas rasterisation loop first
  (`captureStream()` only exists on `<canvas>`, not `<svg>`) — a real next
  step, not attempted this pass.
- **MorphSVG** — vendored and registered (`shared/gsap-morphsvg.min.js`),
  never yet invoked by a real Soul feature. The natural next use: morphing
  between two primitive sets (e.g. two different Loom grids, or a Pollen
  dot cloud reshaping into a Strata trace).
- **Large-particle-count rendering** — today's DOM/SVG-element approach is
  right for the scale tested (dozens to low hundreds of primitives); a
  Pollen export with thousands of dots would want the Three.js/WebGL path
  discussed during scoping, not built this pass.
- **Layer/group concept** — `rotation`'s own per-element parity
  approximation is a stand-in for real "counter-spinning layers", which
  needs an explicit grouping concept Soul doesn't have yet.
- **Loading a grid directly from Loom** (`Organica.loadLoomGrid`) instead
  of via a pasted/exported SVG — currently Soul only reads SVG strings;
  a direct Loom-JSON path would skip the SVG round-trip entirely.

---

*Studio Rann · Organica*
