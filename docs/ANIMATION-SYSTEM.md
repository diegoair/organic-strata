# Organica — Animation System Documentation

> A vocabulary of **6 physical animation patterns** — not tied to any one tool
> or shape library. Use this when choosing how something should move: what
> real force or process governs the subject, and which pattern below already
> encodes that force's timing/easing/transform shape.
>
> **Origin, for context:** these 6 patterns were first written as hand-typed
> CSS `@keyframes` for Genesis's 55 animated forms. Genesis itself has been a
> *static* seed library since August 30, 2026 (13 base forms, no animation);
> the 55-form catalog is preserved read-only at
> `genesis/archive/indicators-55.html`. The taxonomy **outlived** that origin —
> it's the live reference for **Pulsar**'s 4 Motion modes (Pulse/Bloom/Drift/
> Orbit, over Radial) and for the hand-picked motion on the hub's own tool-
> preview cards (`index.html`) — see §"Who uses this today" per pattern below.
> Treat it as a general physics-of-motion vocabulary, usable by any future
> track-driven tool via `shared/tracks.js` (see §Bridge to code).

---

## Core Principle

Motion should follow the subject's **real physical or biological mechanics** —
not a generic motion preset applied to an arbitrary shape. The question behind
every animation is: *what force or process actually governs this thing in
nature?*

This is why the animations feel convincing: the timing, easing, and transform
type all correspond to the real phenomenon, not to what's easiest to keyframe.

---

## The 6 Animation Patterns

### 1. Internal Pressure — cyclic scale, asymmetric easing

**What it simulates:** biological pressure systems — lungs, hearts, cells, fungi, chemical reactions still "alive".
**Mechanism:** a scale factor cycling between a compressed and expanded state, with a fast-expand/slow-contract (or reverse) easing curve — a `cubic-bezier` in CSS, an `ease` name on a track's `ease` field in code.
**Key insight:** pressure builds slowly and releases fast (or vice versa) — a linear scale reads as mechanical, not organic.

**Who uses this today:** Pulsar's **Pulse** Motion mode (drives a radial field's fill/size params with a sine track). The hub's own Camo Turing/Komorebi bento cards (`.tp-anim-breathe`, `index.html`) — both are filled reaction-diffusion/canopy regions, so a slow scale pulse reads as "still alive" under a frozen export.

**Minimal shape (CSS):**
```css
@keyframes breathe { 0%,100% { transform: scale(.95) } 50% { transform: scale(1.05) } }
```
**Minimal shape (track, `shared/tracks.js`):** `{ wave: 'sine', amount: 0.05, period: 1, ease: 'inOut' }` added to a `scale` parameter.

---

### 2. Gravity + Viscosity — translate + scale combined

**What it simulates:** fluid dynamics — drops, honey, lava, dew, anything falling and deforming under gravity and drag.
**Mechanism:** vertical translation paired with a scale change along the same axis. Stretches on acceleration, compresses on impact. Duration and easing encode viscosity.
**Key insight:** a falling drop elongates (`scaleY > 1`) as it accelerates, flattens (`scaleY < 1`) on impact. Honey is slow to start, water is fast — the easing curve IS the viscosity.

**Who uses this today:** no live tool maps to this one directly yet — the closest reference is the archived catalog (`archive/indicators-55.html`'s honey-drip/pebble-splash forms). A candidate for a future "Drift"-adjacent track type once a tool needs falling/impact motion (see §Bridge to code).

**Minimal shape (CSS):**
```css
@keyframes drip { 0% { transform: scaleY(1) translateY(0) } 40% { transform: scaleY(2.2) translateY(10px) } 70% { transform: scaleY(.9) translateY(30px) } }
```

---

### 3. Growth by Tracing — progressive stroke reveal

**What it simulates:** biological growth — vines, roots, shells, tree rings, mycelium, anything that grows outward from a point.
**Mechanism:** a stroke's dash-offset animated from its full length to `0`, "drawing" the path progressively. In track terms: a one-shot progress value (0→1) driving how much of a path is visible.
**Key insight:** the path shape encodes the growth direction; the timing encodes growth speed. A ring's own circumference can drive its own draw duration, so bigger rings draw proportionally slower — real growth, not a fixed timer.

**Who uses this today:** Pulsar's **Bloom** Motion mode (a `ramp-once` track on a radial field's element count — a literal count-up "growth"). The hub's Membrane bento card (`traceIn`/`animateTrailReveal()`, `index.html`) replays its own 220-path trail once on load via `stroke-dashoffset` — a direct, still-live use of this exact mechanism.

**Minimal shape (track):** `{ wave: 'ramp-once', amount: 1, ease: 'out' }` driving a progress/reveal parameter — this is genuinely one-shot (doesn't loop cleanly on its own; see the loop-safety note in §Bridge to code).

---

### 4. Collective Behaviour — staggered delay + goo merge

**What it simulates:** swarms, colonies, fluid clusters — many simple individuals reading as one collective body.
**Mechanism:** the identical animation on many elements, each offset by a small per-element delay; an optional goo filter (blur + threshold) fuses nearby shapes into one fluid silhouette.
**Key insight:** collective behaviour is NOT a complex animation — it's one simple animation, phase-shifted per instance. The stagger does the storytelling; the goo filter (where used) does the rest optically.

**Who uses this today:** no live tool uses the goo-filter half today (it was Genesis/Soul-specific SVG plumbing, not carried into Pulsar or the hub). The **stagger half**, though, is exactly what `shared/tracks.js`'s `staggerDelay(ctx, by, amount)` generalizes — any track-driven tool with N instances (grid cells, points, primitives) gets per-instance phase-shifting for free, independent of any goo filter.

**Minimal shape (per-instance delay, in cycle units):** `phase: baseline + staggerDelay(ctx, 'index', 0.3)` — see §Bridge to code for the full contract.

---

### 5. Environmental Forces — continuous, linear-eased translate

**What it simulates:** external forces acting on a passive object — wind, current, gravity fields, drift.
**Mechanism:** continuous translation, cycling or one-directional. Linear easing (not ease-in-out) for wind/current/fall; `ease-in-out` only for a genuinely oscillating force like a tide.
**Key insight:** unlike biological motion, an environmental force is constant and uniform — the object doesn't "choose" to speed up or slow down.

**Who uses this today:** Pulsar's **Drift** Motion mode (a sine/noise track on a radial field's warp/fill offset — Environmental Forces is the one pattern that survives even after Radial's own symmetry constraints rule out a directional Gravity pull). The hub's Halide bento card (`.tp-anim-drift`) — a slow Ken-Burns creep on the dithered photograph, same continuous/linear pacing.

**Minimal shape (track):** `{ wave: 'sine', amount: <small>, period: 1, ease: 'linear' }`, or `{ wave: 'noise', ... }` for a non-repeating-looking drift that still closes the loop (circular-sampled, see `trackValue`'s own `noise` branch).

---

### 6. Differential Rotation — counter-spinning layers

**What it simulates:** orbital mechanics, crystal growth, geological strata — two or more layers rotating at different speeds/directions.
**Mechanism:** two-plus elements rotating continuously, at different speeds and/or opposite directions.
**Key insight:** a single rotating element reads as mechanical. Two layers, counter-rotating at different speeds, read as a system with its own physics — the eye infers depth and cause from the speed difference alone.

**Who uses this today:** Pulsar's **Orbit** Motion mode (a `spin` wave — continuous rotation — on a radial field's whole-group `rotate`). The hub's Membrane bento card (`.tp-anim-spin`) — a slow continuous rotation, because Membrane's own export metadata literally records `movementPattern:"orbit"`.

**Minimal shape (track):** `{ wave: 'spin', amount: <turns> }` — continuous, ignores `period`/`ease`/`phase` (see `trackValue`'s own `spin` branch in `shared/tracks.js`).

---

## Timing Philosophy

Duration isn't arbitrary — it should map to the **real-world time scale** of the phenomenon:

| Range | Phenomena |
|---|---|
| `1.4 – 2s` | Heartbeat, ripple, water drop |
| `2 – 3.5s` | Breathing, leaf sway, vine growth |
| `3.5 – 5s` | Flower bloom, jellyfish pulse, a growth-reveal completing |
| `5 – 9s` | Sedimentation, spiral shell, smoke |
| `9 – 14s` | Shard rotation, geological / tectonic motion |

In track terms this is the loop length (Pulsar's own loop-seconds control, or any future tool's equivalent) combined with a track's `period` (whole cycles within that loop) — a "9-14s" phenomenon is a `period: 1` track on a long loop, not a fast track on a short one. Motion that feels slow should feel slow because its real counterpart is slow — this is the single biggest contributor to perceived authenticity, independent of which tool or shape is animating.

---

## Bridge to code — `shared/tracks.js`

The 6 patterns above are physics; **`shared/tracks.js`** is where they become
parameters. It's a small, pure module (no DOM, no per-tool state) with:

- **`trackValue(t, tNorm)`** — the value of one track at a normalized loop
  position `tNorm` (0..1). `t = {wave, amount, period, phase, ease, idx}`;
  `wave` is `sine | triangle | noise | ramp-once | spin`. `period` is a whole
  number of cycles per loop (keeps a periodic wave seamless); `ramp-once` is
  the one genuinely one-shot wave (pattern 3, Growth by Tracing) — a scene
  using it won't loop cleanly on its own, flag it as such in the UI (Pulsar's
  own "one-shot — will not loop" note is the precedent).
- **`staggerDelay(ctx, by, amount)`** — a per-instance phase offset (pattern
  4's stagger half), in the SAME cycle units as `trackValue`'s own `phase` —
  composes by addition, never breaks loop closure for any `by`/`amount`. `ctx`
  is the same per-instance shape `shared/shapes.js`'s `cellColRow()` already
  produces for a Loom grid (rect or polygon/hex) — `{index, count, row, col,
  rows, cols, cx, cy, nx, ny, angle}` — so a grid tool needs no adapter.
- **`ease01`/`tri`/`easedCyc`** — the easing/wave-shape primitives `trackValue`
  itself is built on, exposed for a tool that needs the raw shape (e.g. a
  one-shot reveal with a custom overshoot curve on top of `ease01`).

**What stays local to each tool** (never moves into `shared/tracks.js`): which
parameter a track drives, how multiple tracks on the same parameter combine
(sum for an angle, product for a scale, ...), and the track-editing UI itself.
Pulsar's own `composeP()` is the reference example of this per-tool
composition layer sitting on top of the shared primitives.

**Adding a new pattern to a tool, today:**
1. Identify the real physics — pick the closest of the 6 patterns above.
2. Express it as a track: which `wave`/`ease`/`period` combination produces
   that pattern's motion shape (see each pattern's "Minimal shape" above).
3. Wire it into the tool's own composition function (its `readTracks()`/
   `composeP()`-equivalent) — `shared/tracks.js` supplies the math, the tool
   decides what it drives.
4. If the motion needs to vary per-instance (pattern 4, many cells/points),
   use `staggerDelay()` rather than inventing a new per-instance formula.

---

## Files Reference

| File | Role | Modify? |
|---|---|---|
| `shared/tracks.js` | Pure track math — `trackValue`/`staggerDelay`/`ease01`/`tri`/`easedCyc` | Yes — this is where a genuinely new *wave* or stagger *by*-type belongs |
| `pulsar/index.html` | First consumer of `shared/tracks.js`; its own `composeP()`/Motion-mode mapping is the reference per-tool composition layer | Yes — Pulsar's own params/Motion modes |
| `shared/shapes.js` | `cellColRow()` — the per-instance context shape `staggerDelay()` expects, for any Loom-grid-driven tool | Rarely — only if the context shape itself needs a new field |
| `genesis/archive/indicators-55.html` | The original 55-form animated gallery (CSS `@keyframes`, self-contained) — historical reference only, not an active workflow | Only to look up a form's original CSS for a track port |

---

*Last updated: September 2026 — generalized from the Genesis-specific v0.1 (see git history for the original)*
