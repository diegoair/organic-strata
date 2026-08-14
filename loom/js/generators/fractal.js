/* ─────────────────────────────────────────────────────────────
   Fractal generator — recursive binary space partition where the split
   AXIS strictly alternates with depth (horizontal, vertical, horizontal,
   …) — the same rule applied at every scale, which is the literal
   definition of self-similar. `Recursive` (recursive.js, its own direct
   sibling) runs the same binary split but picks the axis by which side
   is currently longer instead of alternating — a real algorithmic
   difference, not a cosmetic one: strict alternation can and does
   produce thin slivers once depth is high on an already-narrow rect,
   which is the genuine "fractal" look (self-similar structure visible
   at every scale, slivers included); Recursive's longer-side heuristic
   is a real treemap algorithm that actively avoids that.

   `Split variance` wobbles each cut away from an exact 50/50 (clamped
   to [0.15, 0.85] so no cut degenerates to zero width) — 0 gives a
   perfectly regular quad-subdivision (still genuinely fractal: every
   leaf at depth N is identical in size, self-similarity at its purest).
   `Depth` leaves are `2^depth` — depth 0 is the inner rect itself, one
   cell, the same "0 = true no-op start point" every recursive control
   here begins from.
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

function split(rect, depth, variance, rng, out, alternateAxis) {
  if (depth <= 0) { out.push(rect); return; }
  const axis = alternateAxis(depth);
  const frac = Math.min(0.85, Math.max(0.15, 0.5 + (rng() - 0.5) * 2 * variance));
  if (axis === 'v') {
    const w1 = rect.width * frac;
    split({ x: rect.x, y: rect.y, width: w1, height: rect.height }, depth - 1, variance, rng, out, alternateAxis);
    split({ x: rect.x + w1, y: rect.y, width: rect.width - w1, height: rect.height }, depth - 1, variance, rng, out, alternateAxis);
  } else {
    const h1 = rect.height * frac;
    split({ x: rect.x, y: rect.y, width: rect.width, height: h1 }, depth - 1, variance, rng, out, alternateAxis);
    split({ x: rect.x, y: rect.y + h1, width: rect.width, height: rect.height - h1 }, depth - 1, variance, rng, out, alternateAxis);
  }
}

/**
 * @param {{depth:number, variance:number, gap:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateFractal(params, inner) {
  const { depth, variance, gap, seed } = params;
  const rng = mulberry32(seed);
  const leaves = [];
  split({ x: inner.x, y: inner.y, width: inner.width, height: inner.height }, depth, variance, rng, leaves, d => d % 2 === 0 ? 'v' : 'h');

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
      params: { depth, variance, gap, seed },
      gap: 0,
    },
    cells,
  };
}
