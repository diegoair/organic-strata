/* ─────────────────────────────────────────────────────────────
   Constraint Engine — two solvers, chosen PER GENERATOR, not globally.

   solveTracksKiwi: real Cassowary constraint solving (shared/kiwi.min.js,
   vendored — MIT/BSD, no CDN, same convention as Paper.js in Strata).
   Used where a generator genuinely benefits from "equal by default,
   overridable under priority" — modular/column/row/Bento-family grids,
   and the future WYSIWYG drag-to-resize (Phase 4): dragging one track
   becomes a `strong` edit constraint, every other track re-solves around
   it automatically instead of needing hand-written redistribution logic.

   solveTracksParametric: direct math, no solver. Used where tracks follow
   a continuous function (sine, noise, radial, polar, …) that a linear
   constraint system doesn't model — Sinusoidal today, every future
   procedural generator.

   This split is the deliberate outcome of the architecture discussion:
   Kiwi is not the default, it's the tool for the specific case where
   simultaneous, priority-weighted sizing is the actual behaviour wanted.
   ───────────────────────────────────────────────────────────── */

// `kiwi` is a classic global (shared/kiwi.min.js loads before this module,
// same load-order convention as Organica on every other tool that mixes a
// vendored global with an ES module — see camo-turing/index.html).

/**
 * Solves N track sizes that sum to `innerSize` (minus gaps), equal by
 * default (medium-strength constraint — a soft preference, not a hard
 * rule) so a future per-track override can win without fighting the
 * solver. Every track is hard-constrained (`required`) to be at least
 * `minSize`, so a canvas too small for N tracks fails loudly (NaN/negative
 * sizes) rather than silently rendering overlapping cells.
 */
export function solveTracksKiwi(count, innerSize, gap, minSize = 16) {
  if (count <= 0) return [];
  const solver = new kiwi.Solver();
  const vars = Array.from({ length: count }, (_, i) => new kiwi.Variable('t' + i));

  vars.forEach(v => {
    solver.createConstraint(v, kiwi.Operator.Ge, minSize, kiwi.Strength.required);
  });
  for (let i = 1; i < count; i++) {
    solver.createConstraint(vars[0], kiwi.Operator.Eq, vars[i], kiwi.Strength.medium);
  }
  const totalGap = gap * (count - 1);
  const sumExpr = vars.reduce((e, v) => e.plus(v), new kiwi.Expression());
  solver.createConstraint(sumExpr, kiwi.Operator.Eq, innerSize - totalGap, kiwi.Strength.required);

  solver.updateVariables();
  return vars.map(v => v.value());
}

/**
 * The real edit-constraint use of Kiwi this file's own header already
 * named as the point of choosing Kiwi at all (Phase 4): dragging one
 * track's boundary in the live preview becomes a `strong` edit
 * constraint on that ONE track's variable — stronger than the medium
 * equal-preference between tracks, weaker than the required minimum-size
 * and sum-fills-canvas constraints, which stay untouched. The solver then
 * redistributes the difference across every OTHER track by re-optimising
 * the same constraint system solveTracksKiwi always solves — no hand-
 * written "shrink my neighbour by the same amount" redistribution code,
 * exactly the payoff documented since Bento shipped. Passing `editIndex:
 * null` reproduces solveTracksKiwi's own plain result exactly (verified:
 * byte-identical), so this isn't a second code path to keep in sync —
 * solveTracksKiwi could call this with editIndex null instead of
 * duplicating the setup, but is left as-is since it's the simpler,
 * already-proven function and nothing depends on merging them.
 */
export function solveTracksKiwiWithEdit(count, innerSize, gap, minSize = 16, editIndex, editValue) {
  if (count <= 0) return [];
  const solver = new kiwi.Solver();
  const vars = Array.from({ length: count }, (_, i) => new kiwi.Variable('t' + i));

  vars.forEach(v => {
    solver.createConstraint(v, kiwi.Operator.Ge, minSize, kiwi.Strength.required);
  });
  for (let i = 1; i < count; i++) {
    solver.createConstraint(vars[0], kiwi.Operator.Eq, vars[i], kiwi.Strength.medium);
  }
  const totalGap = gap * (count - 1);
  const sumExpr = vars.reduce((e, v) => e.plus(v), new kiwi.Expression());
  solver.createConstraint(sumExpr, kiwi.Operator.Eq, innerSize - totalGap, kiwi.Strength.required);

  if (editIndex != null) {
    solver.addEditVariable(vars[editIndex], kiwi.Strength.strong);
    solver.suggestValue(vars[editIndex], Math.max(minSize, editValue));
  }

  solver.updateVariables();
  return vars.map(v => v.value());
}

/**
 * Direct parametric track sizing — no solver, a closed-form function
 * evaluated per track then rescaled to fit exactly. `sizeFn(i, count)`
 * returns a relative weight (not a final pixel size); the rescale step is
 * what makes the result always sum to `innerSize` regardless of sizeFn's
 * own output range, the same normalise-then-rescale shape Warping's own
 * pattern functions use for the identical reason.
 */
export function solveTracksParametric(count, innerSize, gap, sizeFn, minSize = 16) {
  if (count <= 0) return [];
  const raw = Array.from({ length: count }, (_, i) => Math.max(0.001, sizeFn(i, count)));
  const totalGap = gap * (count - 1);
  const targetSum = innerSize - totalGap;
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const scaled = raw.map(r => (r / rawSum) * targetSum);
  // Clamp to minSize post-hoc and redistribute the shortfall proportionally
  // across the tracks that still have headroom — keeps the sum exact
  // without letting amplitude push a track negative.
  const deficit = scaled.reduce((sum, v) => sum + Math.max(0, minSize - v), 0);
  if (deficit === 0) return scaled;
  const headroom = scaled.map(v => Math.max(0, v - minSize));
  const headroomSum = headroom.reduce((a, b) => a + b, 0) || 1;
  return scaled.map((v, i) => v < minSize ? minSize : v - deficit * (headroom[i] / headroomSum));
}
