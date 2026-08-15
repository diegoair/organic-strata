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

### `PATTERNS` — the 6 physics patterns, GSAP-backed, plus 2 that aren't in Genesis at all

| Pattern | Genesis pattern # | GSAP mechanism |
|---|---|---|
| `pressure` | 1. Internal Pressure | 2-tween timeline, `scale`, asymmetric ease (fast expand / slow contract) |
| `gravity` | 2. Gravity + Viscosity | percentage `keyframes` on `y`+`scaleY`, matching the CSS original's own stretch/squash shape |
| `growth` | 3. Growth by Tracing | **DrawSVG plugin** — direct match, no approximation (`drawSVG: '0%' → '100%'`); falls back to a manual `strokeDasharray`/`strokeDashoffset` tween if DrawSVG isn't registered |
| `environmental` | 5. Environmental Forces | continuous `x`/`y` drift, `ease: 'none'` (linear — the documented distinction from biological easing) |
| `rotation` | 6. Differential Rotation | per-primitive rotation, direction alternating by index parity (a per-element approximation of "counter-spinning layers" — Soul has no explicit layer/group concept yet) |
| `wobble` | *(not in Genesis)* | **Continuous, procedural** — not a fixed repeating tween at all. Each primitive samples `Organica.noise.simplex3(x, y, t)` at its OWN `(cx, cy)` every `gsap.ticker` frame, so neighbours drift in a correlated but never-identical, never-repeating way |
| `morph` | *(not in Genesis)* | **MorphSVGPlugin**, morphing a circle into a noise-perturbed organic blob built from its own radius/seed and back — changes the primitive's own SHAPE, not just position/scale, the first genuinely different-in-KIND pattern |

**"Collective Behaviour" (Genesis's own pattern 4) is deliberately not a
7th pattern function.** Its own definition in `docs/ANIMATION-SYSTEM.md` —
"the same simple animation on many elements, phase-shifted" — is exactly
what any of the patterns above, composed with a Stagger, already gives
you. Building it separately would duplicate one of the others with a
stagger bolted on.

**`wobble` and `morph` were added directly from feedback that the first 5
(pure affine transforms on clean periodic curves) read as "basic".**
Both lean on infrastructure that existed but was unused: `wobble` is the
first real consumer of `simplex3`'s own continuous time axis (built the
same session, verified but never actually used by a feature until now);
`morph` is the first real consumer of MorphSVG (vendored since Soul's
first commit, registered, never invoked). `wobble` also has a different
RUNTIME SHAPE from the other 6 — there's no fixed-duration tween to hand
back (the motion never completes or loops in the traditional sense), so
its own pattern function returns a plain `{kill(), delay(d)}` object
driven by `gsap.ticker.add()` instead of a real GSAP tween/timeline.
`animate()`'s own contract only needs those two methods to exist, so this
is a second legitimate implementation strategy behind the same interface,
not a special case grafted onto the tween-based one.

**A real bug caught immediately by testing, not assumed to work from the
GSAP docs**: a bare `morphSVG` tween targeting a `<circle>` element does
**nothing** — no error, no `d` attribute ever appears, `r` stays
unchanged — MorphSVGPlugin does NOT auto-convert a non-`<path>` target the
way a first read of its docs suggested. Isolated with a minimal two-line
repro before touching the real code: the identical tween on an actual
`<path>` worked immediately, on a `<circle>` did nothing. Fixed with
`MorphSVGPlugin.convertToPath(el, true)`, which explicitly converts the
element to a real `<path>` AND swaps it into the live DOM in place of the
original — the primitive's own `.el` is updated to point at the new node,
so anything reading it afterward targets the element actually on stage. A
second, related gap: `d` is an SVG attribute MorphSVG writes directly, not
a CSS property GSAP's own `clearProps` can restore, so a killed morph
tween left the shape frozen mid-blob after Stop instead of genuinely
reverting to a circle — fixed by stashing the pre-morph circle-as-path `d`
string on the primitive (`_morphRestD`) the moment `convertToPath` produces
it, and having Soul's own `stopMotion()` write it back explicitly.
Verified before/after: mid-morph the path's `d` is genuinely a distorted
blob, and after Stop it's byte-identical to the captured rest value.

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

**Header**: logo + spacer only. No actions, no status — both moved out
(see below), matching Loom's own precedent of an empty action slot once
Export moved to the floatbar.

**Panel — two sections**: **Seeds** (Genesis/SVG/Text — see §5a) and
**Motion** (Pattern/Amount/Duration/Stagger/Stagger-amount). The earlier
**Primitives** stats section (canvas size, point/path counts) was removed
per direct request — deferred, not deleted outright; if it comes back
it's a small, self-contained addition.

**Canvas**: a real drop zone (`#drop-hint`, the same centralised pattern
`shared/_template.html` and every image-loading tool already use — drag a
file, or click the "+" to open a picker), plus `Organica.createZoomPan`
(wheel-zoom toward the cursor, drag-to-pan once zoomed, Reset) — the same
shared zoom/pan mechanics Loom/Halide/Spore/Pollen/Strata already use,
wired identically. Verified drag-pan specifically needed raw dispatched
`mousedown`/`mousemove`/`mouseup` events to test reliably — the browser
automation tool's own synthetic drag gesture doesn't reliably trigger real
listener chains the way an actual user drag does; not an app bug, a test-
tooling quirk caught by cross-checking two measurement methods before
concluding pan was broken.

**Floating toolbar** (`org-floatbar`, the same centralised bottom-centre
component Halide/Komorebi/Loom/Camo Turing all use for canvas-level
actions) now holds everything that used to be split across the header and
two panel sections: **Open** (file picker) · **Play/Stop** · **Loop**
(auto-stop popover) · **Export** (PNG/SVG/**Video**) · **status readout**.
The status output kept its exact original classes
(`.org-header__dot`/`.org-header__state`) when it moved, so
`Organica.status()` needed zero changes — only the element's location in
the DOM changed, not the contract every other call site already relies on.

**Video export** — the deferred item from the engine's own first pass,
built this round: `canvas.captureStream()` + `MediaRecorder`, MP4/H.264
tried first, WebM fallback (`MediaRecorder.isTypeSupported`, not assumed
— same technique Camo Turing's own recorder already uses). SVG has no
`captureStream()` of its own, so each frame is redrawn directly onto a
plain `<canvas>` from the primitives' own LIVE state (`drawPrimitiveToCanvas`,
reading each element's current `transform`/`d`/`stroke-dasharray` — mirrors
Pollen's own `drawSvgEl()` structure once more, but reading animated
attributes instead of static ones) rather than serialising the SVG to an
`<img>` every frame, which would need an async image decode per frame and
race the animation. Recording length is the Loop popover's own duration
(defaults to 5s if Loop is Off — a downloadable FILE needs a real end
point the way a live preview doesn't).

**A real bug caught before shipping, not assumed to work**: `startRecording()`
originally set `recording = true` BEFORE calling `playMotion()` (to start
playback for free if nothing was already animating) — but `playMotion()`'s
own first line is `stopMotion()` (clearing any previous animation), and
`stopMotion()` itself checks `if (recording) stopRecording()` so a manual
Stop mid-record ends the file cleanly. With the flag already `true`, that
very same convenience call killed the recording before a single frame was
captured — reproduced directly (an isolated `MediaRecorder` test captured
real data; the full `startRecording()` path always produced a 0-byte file)
and fixed by reordering: `playMotion()` first, `recording = true` only
after. Verified after the fix with a real decoded video element (not just
blob size): a genuine playable MP4, duration matching the Loop setting,
dimensions matching the source canvas.

`playMotion()`/`stopMotion()` are still the whole animation runtime:
`activeTweens` holds exactly what the last `playMotion()` call created, so
`stopMotion()` kills precisely those (no guessing, no `gsap.globalTimeline`
sweep) and resets every primitive's element via `gsap.set(el, {clearProps:
'all'})` — a real clean reset, not just pausing mid-pose. It also now
clears any pending Loop timeout and stops an in-progress recording, so a
manual Stop always leaves the tool in a fully idle state.

### 5a. Seeds — Genesis / SVG / Text

The same tabbed source-picker component Camo Turing's own Seeds panel
uses (`.seg-ctrl`/`.seg-btn` from the shared `organica-panel.css`;
`.shape-grid`/`.shape-thumb`/`.upload-btn` are Camo Turing's own local
additions, not yet promoted to a shared file, replicated verbatim here —
same situation Camo Turing itself is in), scoped down to what Soul
actually needs: **no Image tab** — a raster image has no vector form
without a decomposition step, and that's Pollen/Halide's job, not this
engine's; no Mode/Size/Two-seeds — those are Gray-Scott simulation
parameters specific to Camo Turing, nothing here is analogous.

- **Genesis** — the same curated 8-form subset (`PRIMORDIAL = [7, 56, 1,
  2, 14, 33, 38, 31]`) Camo Turing's own Seeds panel shows, thumbnails
  read straight from `window.ORGANIC_FORMS` (`/genesis/organic-forms.js`).
  Clicking a thumbnail calls `loadSVG()` directly — the exact same load
  path every other source uses, so a Genesis form goes through the same
  `parsePrimitives()` → render pipeline as everything else, not a special
  case.
- **SVG** — an "+ Upload SVG" button (opens the same `#file-input`) plus
  the canvas's own drop zone; both routes converge on `loadSVG()`.
- **Text** — real vector letterforms, not a raster mask (Camo Turing's own
  Text seed rasterises text into a simulation mask, correct for THAT tool,
  wrong here — Soul's whole contract is vector primitives).
  `opentype.js` (vendored, `shared/opentype.min.js`) reads the same
  vendored Manrope file every Organica tool's own typography already
  commits to (`shared/manrope-variable.ttf`, `docs/DESIGN-SYSTEM.md`).
  `font.getPaths(text, ...)` — plural — returns one `Path` per GLYPH
  rather than one fused path for the whole string, deliberately: it means
  Motion's own stagger addresses individual LETTERS, not the word as one
  blob (screenshot-verified: "Soul" → 4 primitives, one per letter,
  Growth-by-tracing staggered by index reads as the word drawing itself
  letter by letter).

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
- Edge cases: empty paste, genuinely malformed XML, and valid-but-empty
  SVG (only `<text>`, no recognisable shapes) each produce a distinct,
  correct status message rather than a silent failure or a crash; the
  Growth pattern correctly refuses (with a clear message, 0 tweens
  created) when every loaded primitive is a point (a circle has no
  meaningful "stroke being drawn"); loading a new SVG while a previous
  animation is mid-play correctly kills the old tweens first; switching
  Pattern and hitting Play again while already playing correctly replaces
  the running animation rather than stacking a second one on top.
- Scale-tested against Loom's own real Triangular export (171 primitives:
  170 cells + 1 guide rect) — 8ms parse+render, all three stagger
  formulas confirmed producing genuinely varying per-tween delays at this
  scale (via `tween.delay()`, not assumed), zero console errors.

**Two real bugs found and fixed by testing every code path, not just the
ones exercised in earlier passes**: (1) Chromium's XML parser doesn't
replace the document root on a parse error — it keeps the outer tag open
and injects a `<parsererror>` as a CHILD, so genuinely malformed markup
was silently read as "valid SVG, zero shapes found" instead of a real parse
error; fixed by explicitly checking for an injected `<parsererror>` node.
(2) The `noise` stagger formula referenced a bare `noise.simplexFbm2(...)`
that was never in scope in `organica-motion.js`'s own closure (that name
only exists inside `organica-noise.js`'s own IIFE) — every earlier
verification pass happened to test `index`/`distance` stagger and
generalised "stagger works" from that, without ever actually selecting
`noise` and pressing Play; fixed to `Organica.noise.simplexFbm2`, the same
cross-file access pattern Warping/Komorebi/Camo Turing already use. Lesson
recorded for next time: exercise every option in a dropdown at least once,
not a representative sample. **The lesson held**: while adding `morph`'s
own blob-path generator, the exact same bare-`noise.` mistake was typed
again — caught by re-reading the new code against the lesson just recorded,
before ever running it, not by a second live failure.

**Direct feedback ("le animazioni sono davvero basiche", "ci vuole sempre
un po' ad iniziare l'immagine") drove two more fixes, both measured before
and after rather than tuned by eye:**
- `growth`'s `power1.inOut` ease measured genuinely flat at the start —
  only 1.85% of the path drawn 300ms into a 3s duration, 7.7% at 600ms
  (read via the live `strokeDasharray` segment length, not assumed).
  Switched to `power1.out` (fast start, gentle deceleration) — 18.4% at
  300ms, 35.5% at 600ms after the fix, verified the same way.
- `gravity`'s own slow start (`power1.in` on the first keyframe segment)
  is physically correct — a falling object starts at rest — but that
  segment spanned 40% of total duration, so at the default 3s duration
  that's 1.2s of near-invisible motion (measured: 0.19px moved at 300ms).
  Recalibrated the keyframe percentages (0/40/55/70/100 → 0/18/32/50/100)
  to keep the exact same physical shape (accelerate → fall → impact
  squash → settle/fade) while reaching each stage sooner — 1.1px moved at
  300ms after the fix, a ~5.8× improvement at the same measurement point.
- Both `wobble` and `morph` (above) are the actual answer to "basic" —
  richer motion classes, not just re-tuned versions of the same 5
  transforms.

## 6b. UI overhaul — Seeds panel, floatbar consolidation, zoom/pan, video export

Verified this round: Genesis tab loads any of the 8 curated forms via a
single click (thumbnail marked active, primitive count updates); SVG tab's
Upload button and the canvas's own drag-drop both converge on the same
`loadSVG()`; Text tab produces real per-glyph vector paths ("Soul" → 4
primitives, confirmed via `currentParse.primitives.length`), and a pattern
played on it (Growth, index stagger) staggers letter-by-letter as intended
(screenshot-confirmed). All 7 patterns × 4 stagger formulas (28
combinations) re-verified clean after the full markup/JS restructuring.
Zoom confirmed via real transform inspection (wheel zooms toward cursor,
HUD shows correct %); pan confirmed via dispatched raw mouse events after
the browser automation tool's own synthetic drag didn't reliably trigger
the real listener chain (a test-tooling gap, not an app bug — caught by
cross-checking two measurement approaches rather than concluding pan was
broken from one). Video export produces a genuinely valid, decodable file
(loaded into a real `<video>` element and read back: correct duration,
correct dimensions) after the recording race-condition fix (§5). 0 of the
Seeds/Motion controls unaccessibly-named. Zero console errors across every
tab switch, source load, pattern/stagger combination, zoom/pan gesture,
and export tested.

## 6a. Real-world stress test — a live Pollen "Hatch Flow" export, and a scanline-relief prototype

Diego pointed at a reference (generative-gestaltung.de's `P_4_3_1_01`, a
p5.js sketch — studied for the TECHNIQUE only, no code copied, consistent
with this project's own "reference, don't import" rule for creative-coding
frameworks). Two things came out of evaluating it against a real photo
(`halide/test-photos/`) run through the actual production pipeline, not a
synthetic test case.

**Pollen already covers most of it.** The sketch's mode 1 (line angle from
brightness) and mode 3 (variable-size dots) are already real Pollen
features — Line marks with `Angle Range` (`ranged(min,max,range,random,b,rnd)`,
`b` = local brightness) for mode 1, and Pollen's own default Circle
behaviour for mode 3. Pollen's **Flow** mode (align to the image's
isophotes — 90° off the local gradient) is more sophisticated than the
reference's flat linear brightness ramp. Verified end-to-end: loaded a
real photo into Pollen, applied the built-in **"Hatch Flow"** preset
(`pointType:'stroke', strokeStyle:'line', ck-angle-flow:true` — confirmed
by reading the preset table, not assumed), exported real SVG (2.3MB,
5748 line-mark paths, genuine contour-following hatching), loaded it into
Soul.

**A real, serious performance bug found at this scale**: `wobble` on 5748
primitives measured **1fps** — the browser essentially frozen. Isolated
carefully (a real GSAP tween — `pressure` — on the SAME 5748 elements
measured a smooth **51fps**, ruling out "too many SVG elements" as the
cause): the fault was wobble's own architecture, N independent
`gsap.ticker.add()` callbacks each doing 3 `simplex3()` calls plus a
`gsap.set()`. Fixed by batching into ONE ticker callback that loops every
active element directly, writing `el.style.transform` as a single string
(bypassing GSAP's own per-call property-dispatch overhead). Re-profiling
after the fix found the true remaining ceiling isn't JS cost at all
(isolated: 17,244 `simplex3` calls = 2ms, 5748 raw style writes = 10ms) —
it's the BROWSER's own SVG paint/composite cost for that many
continuously-changing elements. Binary-searched cleanly (each point
tested in isolation, since a first sweep done as one chained sequential
function gave nonsense results across the board — a harness bug, not a
real per-scale finding, caught by re-testing n=100 alone and getting a
normal 62fps): **smooth (60fps+) up to ~3000 elements, a sharp cliff to
1-3fps by ~4000**. A UI warning was added in `soul/index.html`'s own
`playMotion()` (Wobble specifically, >3000 primitives) rather than letting
the tab silently freeze — the real fix (Three.js/WebGL for large particle
counts) is the same follow-up already flagged during scoping (§7).

**An open, unresolved finding, disclosed rather than hidden**: `growth`
(DrawSVG) showed inconsistent, hard-to-explain behaviour on the
scanline-relief prototype's own multi-segment polyline paths (250+ `L`
commands per path) — `strokeDasharray` stuck at `"0px, 999999px"` for a
disproportionate fraction of the tween's duration in repeated isolated
tests, independent of segment count (even a 2-segment zigzag showed it),
independent of which browser tab ran it (reproduced fresh in a brand-new
tab, ruling out session/tab degradation). `wobble` on the SAME
scanline-relief content works correctly and looks genuinely good
(screenshot-confirmed, real organic "breathing" line-relief). Not
root-caused tonight — flagged honestly rather than either (a) claiming
growth+scanline works when it doesn't reliably, or (b) spending
unbounded time chasing what may be a narrow GSAP DrawSVG quirk with
many-segment paths specifically. Worth a focused pass on its own.

**Scanline relief itself** — the reference's mode 5 (brightness as
vertical displacement along horizontal scanlines, a topographic/relief
look) has no equivalent in any existing Organica tool. Prototyped
standalone at `/_test-scanline-relief.html` (same "test before deciding
where it lives" discipline as Loom's own concept-test pages) — real
luminance sampling (`0.2126R+0.7152G+0.0722B`, the same weights every
other tool in this repo already uses), real SVG export (verified: 125
real `<path>` elements, not a raster embed). Where this belongs
architecturally is still open — closest existing kin is Halide (image
processing) or a small new tool, not Soul itself (Soul animates
primitives, it doesn't decompose raster images — that boundary was set
explicitly during the engine's own scoping).

## 7. Not built yet

- **GIF export** — Video (MP4/WebM, §5) and PNG/SVG all work now; GIF
  specifically doesn't (would need a separate encoder — MediaRecorder has
  no GIF output — not attempted, since video already covers the "share a
  loop" use case).
- **MorphSVG shape-to-shape** — now used by the `morph` pattern (circle →
  noise-perturbed blob → circle, on a single primitive). Morphing BETWEEN
  two different primitive SETS (e.g. two different Loom grids, or a Pollen
  dot cloud reshaping into a Strata trace) is still open — that needs a
  point-correspondence strategy across two independently-parsed primitive
  lists, a bigger feature than one primitive morphing against its own
  generated variant.
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
