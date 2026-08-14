/* ─────────────────────────────────────────────────────────────
   Fractal generator — recursive binary space partition. Consolidated
   from two generators that shared the identical recursion, `Split
   variance` wobble, `Depth` (leaves = 2^depth), `Gap` and `Seed`, and
   differed in exactly one real, load-bearing way: which axis each cut
   uses. `Axis mode` makes that the single control it always should
   have been, instead of two separate generator entries:

   - **Alternating** (the old "Fractal"): the split axis strictly
     alternates with recursion depth (horizontal, vertical, horizontal,
     …) — the same rule applied at every scale, the literal definition
     of self-similar, and genuinely capable of producing thin slivers
     at high depth on an already-narrow rect (a real, expected artefact
     of true alternation, not a bug).
   - **Longest side** (the old "Recursive"): the axis is chosen by
     whichever side of the CURRENT rect is longer — a real treemap
     heuristic (the same family as squarified/slice-and-dice
     algorithms) that actively keeps leaves closer to square instead of
     alternating strictly.

   Both are genuinely useful, genuinely different-looking outputs from
   the identical underlying recursion — exactly the kind of "one real
   parameter, not two generators" case Column/Row→Linear and the
   Radial/Polar/Elliptical merge already established.
   ───────────────────────────────────────────────────────────── */

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rectPoly(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

function split(rect, depth, variance, rng, out, chooseAxis) {
  if (depth <= 0) { out.push(rect); return; }
  const axis = chooseAxis(rect, depth);
  const frac = Math.min(0.85, Math.max(0.15, 0.5 + (rng() - 0.5) * 2 * variance));
  if (axis === 'v') {
    const w1 = rect.width * frac;
    split({ x: rect.x, y: rect.y, width: w1, height: rect.height }, depth - 1, variance, rng, out, chooseAxis);
    split({ x: rect.x + w1, y: rect.y, width: rect.width - w1, height: rect.height }, depth - 1, variance, rng, out, chooseAxis);
  } else {
    const h1 = rect.height * frac;
    split({ x: rect.x, y: rect.y, width: rect.width, height: h1 }, depth - 1, variance, rng, out, chooseAxis);
    split({ x: rect.x, y: rect.y + h1, width: rect.width, height: rect.height - h1 }, depth - 1, variance, rng, out, chooseAxis);
  }
}

/**
 * @param {{depth:number, variance:number, axisMode:'alternate'|'longest', gap:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateFractal(params, inner) {
  const { depth, variance, axisMode, gap, seed } = params;
  const rng = mulberry32(seed);
  const chooseAxis = axisMode === 'longest'
    ? (rect) => (rect.width >= rect.height ? 'v' : 'h')
    : (rect, d) => (d % 2 === 0 ? 'v' : 'h');
  const leaves = [];
  split({ x: inner.x, y: inner.y, width: inner.width, height: inner.height }, depth, variance, rng, leaves, chooseAxis);

  const inset = (gap || 0) / 2;
  const cells = leaves.map((r, i) => {
    const poly = rectPoly(r.x + inset, r.y + inset, Math.max(0, r.width - 2 * inset), Math.max(0, r.height - 2 * inset));
    return { id: 'c' + i, points: poly, centroid: polygonCentroid(poly) };
  });

  return {
    grid: {
      type: 'fractal',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { depth, variance, axisMode, gap, seed },
      gap: 0,
    },
    cells,
  };
}
