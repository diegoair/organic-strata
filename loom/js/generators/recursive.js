/* ─────────────────────────────────────────────────────────────
   Recursive generator — Fractal's own sibling: identical binary-space-
   partition recursion and `Split variance` wobble, but the split AXIS
   is chosen by which side of the current rect is LONGER, not by strict
   alternation (fractal.js's own header explains the distinction and why
   it's a real algorithmic difference, not cosmetic) — a real treemap
   heuristic (same family as squarified/slice-and-dice treemap
   algorithms) that keeps every leaf closer to square and actively
   avoids the thin slivers strict alternation can produce on an already-
   narrow rect. Same `Depth`/`Split variance`/`Gap`/`Seed` controls,
   same `2^depth` leaf count, same depth-0-is-a-no-op discipline.
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

function split(rect, depth, variance, rng, out) {
  if (depth <= 0) { out.push(rect); return; }
  const axis = rect.width >= rect.height ? 'v' : 'h';
  const frac = Math.min(0.85, Math.max(0.15, 0.5 + (rng() - 0.5) * 2 * variance));
  if (axis === 'v') {
    const w1 = rect.width * frac;
    split({ x: rect.x, y: rect.y, width: w1, height: rect.height }, depth - 1, variance, rng, out);
    split({ x: rect.x + w1, y: rect.y, width: rect.width - w1, height: rect.height }, depth - 1, variance, rng, out);
  } else {
    const h1 = rect.height * frac;
    split({ x: rect.x, y: rect.y, width: rect.width, height: h1 }, depth - 1, variance, rng, out);
    split({ x: rect.x, y: rect.y + h1, width: rect.width, height: rect.height - h1 }, depth - 1, variance, rng, out);
  }
}

/**
 * @param {{depth:number, variance:number, gap:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateRecursive(params, inner) {
  const { depth, variance, gap, seed } = params;
  const rng = mulberry32(seed);
  const leaves = [];
  split({ x: inner.x, y: inner.y, width: inner.width, height: inner.height }, depth, variance, rng, leaves);

  const inset = (gap || 0) / 2;
  const cells = leaves.map((r, i) => {
    const poly = rectPoly(r.x + inset, r.y + inset, Math.max(0, r.width - 2 * inset), Math.max(0, r.height - 2 * inset));
    return { id: 'c' + i, points: poly, centroid: polygonCentroid(poly) };
  });

  return {
    grid: {
      type: 'recursive',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { depth, variance, gap, seed },
      gap: 0,
    },
    cells,
  };
}
