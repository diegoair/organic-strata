/* ─────────────────────────────────────────────────────────────
   ORGANICA — tracks.js
   Pure track-animation primitives — wave shaping, easing, and per-instance
   stagger — shared across any tool that drives parameters with time-varying
   "tracks" over a normalized loop position (tNorm, 0..1).

   Extracted from pulsar/index.html (its ease01/tri/easedCyc/trackValue,
   already the most mature, shipped implementation — Pulsar drives Radial's
   whole parameter object this way) rather than rewritten, following the same
   "pull out once a second consumer needs it" discipline as noise.js/radial.js/
   shapes.js/pollen-engine.js — applied here pre-emptively, before a second
   consumer exists, because a shared module was the explicit ask rather than
   waiting for the usual second-consumer trigger.

   Deliberately PURE — no DOM, no state, no tool-specific composition. What a
   track's `param` maps to, how multiple tracks accumulate (sum for an angle,
   product for a scale, ...), and the UI that reads/writes track objects all
   stay local to each tool (Pulsar's own composeP(), a future grid tool's own
   buildDrawList()) — same boundary shapes.js already keeps between pure
   geometry and each tool's own placement logic.

   Load order: AFTER noise.js (trackValue's 'noise' wave and staggerDelay's
   'noise' by both call Organica.noise.fbm), BEFORE the tool's own script.

   Everything hangs off window.Organica.tracks.*
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = global.Organica = global.Organica || {};
  const TAU = Math.PI * 2;

  // ease01(f, mode) — clamps f to [0,1] then applies a named ease. Verbatim
  // from Pulsar (pulsar/index.html) — every existing consumer of a track's
  // `ease` field already depends on this exact shape.
  function ease01(f, mode) {
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    if (mode === 'in') return f * f;
    if (mode === 'out') return 1 - (1 - f) * (1 - f);
    if (mode === 'inOut') return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    return f;
  }
  // tri(p) — a triangle wave on the unit cycle, p wrapped to [0,1) first.
  function tri(p) {
    p = p - Math.floor(p);
    if (p < 0.25) return p * 4;
    if (p < 0.75) return 2 - p * 4;
    return p * 4 - 4;
  }
  // easedCyc(cyc, mode) — applies ease01 to the FRACTIONAL part of a cycle
  // count, keeping the whole-cycle part untouched, so a periodic wave stays
  // periodic under easing (cyc=2.3 → 2 + ease01(0.3)), not just the [0,1] case.
  function easedCyc(cyc, mode) {
    const w = Math.floor(cyc);
    return w + ease01(cyc - w, mode);
  }
  // trackValue(t, tNorm) — the value of one track at a given normalized loop
  // position. `t` = {wave, amount, period, phase, ease, idx}. `period` is a
  // whole number of cycles per loop (keeps a periodic wave seamless — see
  // Pulsar's own "period = whole CYCLES per master loop" note); `phase` is in
  // CYCLE units (added to tNorm*period before the *TAU that feeds sin/cos),
  // so any constant `phase` (including a stagger offset added by the caller,
  // see staggerDelay below) never breaks loop closure on its own. `idx` only
  // seeds the 'noise' wave's phase offset (distinct tracks don't sample the
  // same noise field). Returns a signed delta around 0, in the track's own
  // units — not an absolute value.
  function trackValue(t, tNorm) {
    const per = t.period > 0 ? t.period : 1;
    if (t.wave === 'ramp-once') return t.amount * ease01(tNorm * per + t.phase, t.ease);
    if (t.wave === 'spin') return t.amount * TAU * tNorm;   // continuous — phase/period/ease don't apply
    let cyc = tNorm * per + t.phase;
    if (t.ease && t.ease !== 'linear') cyc = easedCyc(cyc, t.ease);
    let v;
    if (t.wave === 'triangle') v = t.amount * tri(cyc);
    else if (t.wave === 'noise') {
      const th = TAU * cyc, so = 13.37 * ((t.idx || 0) + 1);
      v = t.amount * (Organica.noise.fbm(Math.cos(th) + so, Math.sin(th) + so) - 0.5) * 2;
    } else v = t.amount * Math.sin(TAU * cyc);   // sine — the default
    return Math.abs(v) < 1e-9 ? 0 : v;
  }

  // staggerDelay(ctx, by, amount) — a per-instance phase OFFSET, in the same
  // cycle units as trackValue's own `phase` (0..amount, not seconds) — so a
  // caller composes it as `phase: baseline + staggerDelay(ctx, by, amount)`
  // before calling trackValue, and the result stays loop-safe for ANY by/
  // amount (an additive constant before the *TAU never breaks periodicity —
  // the same property that already lets Rotation/Drift tracks close their
  // loop under stagger, verified in an earlier session).
  //
  // NOT a port of shared/motion.js's own staggerDelay (Soul's old GSAP-timeline
  // helper, kept dead-but-harmless for Rhizome) — that one returns a delay in
  // SECONDS for a timeline's own `delay` option, a different unit and a
  // different pure function even where the by-type formula rhymes. This one
  // is scoped to the tNorm/cycle-unit convention every track in this module
  // already uses.
  //
  // ctx is the same per-instance context shape shared/shapes.js's own
  // cellColRow(grid, rawCells, gridMeta) already produces for a Loom grid
  // (rect or polygon/hex — both branches fill every field) — {index, count,
  // row, col, rows, cols, cx, cy, nx, ny, angle} — so a grid tool can pass
  // that object straight through with no adapter. Any other per-instance
  // animation (points, primitives) just needs to provide the same shape.
  function staggerDelay(ctx, by, amount) {
    if (!amount || by === 'none' || !by) return 0;
    if (by === 'index') return (ctx.count > 1 ? ctx.index / (ctx.count - 1) : 0) * amount;
    if (by === 'row') return (ctx.rows > 1 ? ctx.row / (ctx.rows - 1) : 0) * amount;
    if (by === 'col') return (ctx.cols > 1 ? ctx.col / (ctx.cols - 1) : 0) * amount;
    if (by === 'distance') return Math.min(1, Math.hypot(ctx.nx, ctx.ny)) * amount;
    if (by === 'noise') return Organica.noise.fbm(ctx.cx * 0.004, ctx.cy * 0.004) * amount;
    return 0;
  }

  Organica.tracks = { ease01, tri, easedCyc, trackValue, staggerDelay };
})(window);
