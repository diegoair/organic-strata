/* ─────────────────────────────────────────────────────────────
   Organic generator — Voronoi's own relaxed sibling: identical half-
   plane-intersection construction (voronoi.js's own header), but each
   seed is repositioned to its own cell's centroid and the whole
   tessellation rebuilt, `Iterations` times, before the final cells are
   returned — Lloyd's algorithm, producing a "centroidal Voronoi
   tessellation". Raw Voronoi's seeds are uniform-random, which reliably
   produces some long slivers and some near-degenerate cells next to
   normal ones; relaxation pulls every seed toward the middle of the
   region it already owns, so cells converge toward more even, rounded,
   naturally-packed sizes — the organic, hand-felt look Organica's own
   biomimicry language favours (perfect geometry is the OTHER half of
   the language; this is the "living, slightly irregular" half, still
   real vector geometry, not a raster/blob approximation of one).

   `Iterations` 0 is an exact no-op — reproduces raw Voronoi's own
   output at the same seed, byte-for-byte, since no relaxation step
   runs. Higher iterations converge quickly (a handful of steps already
   reads as clearly more even than 0); the loop is capped low enough
   (see registry.js's own default/max) that this stays interactive.
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

function clipHalfPlane(poly, pi, pj) {
  const mx = (pi[0] + pj[0]) / 2, my = (pi[1] + pj[1]) / 2;
  const nx = pi[0] - pj[0], ny = pi[1] - pj[1];
  const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], prev = poly[(i - 1 + poly.length) % poly.length];
    const curSide = side(cur), prevSide = side(prev);
    const curIn = curSide >= 0, prevIn = prevSide >= 0;
    if (curIn !== prevIn) {
      const t = prevSide / (prevSide - curSide);
      out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
    }
    if (curIn) out.push(cur);
  }
  return out;
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

function buildCells(seeds, boundsPoly) {
  return seeds.map((pi, i) => {
    let poly = boundsPoly;
    for (let j = 0; j < seeds.length; j++) {
      if (j === i || poly.length === 0) continue;
      poly = clipHalfPlane(poly, pi, seeds[j]);
    }
    const centroid = poly.length ? polygonCentroid(poly) : pi;
    return { poly, centroid };
  });
}

/**
 * @param {{points:number, iterations:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateOrganic(params, inner) {
  const { points, iterations, seed } = params;
  const rng = mulberry32(seed);
  let seeds = Array.from({ length: points }, () => [
    inner.x + rng() * inner.width,
    inner.y + rng() * inner.height,
  ]);

  const boundsPoly = [
    [inner.x, inner.y], [inner.x + inner.width, inner.y],
    [inner.x + inner.width, inner.y + inner.height], [inner.x, inner.y + inner.height],
  ];

  let built = buildCells(seeds, boundsPoly);
  for (let it = 0; it < (iterations || 0); it++) {
    seeds = built.map((c, i) => c.poly.length >= 3 ? c.centroid : seeds[i]);
    built = buildCells(seeds, boundsPoly);
  }

  const cells = built
    .map((c, i) => ({ id: 'c' + i, points: c.poly, centroid: c.centroid }))
    .filter(c => c.points.length >= 3);

  return {
    grid: {
      type: 'organic',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { points, iterations, seed },
      gap: 0,
    },
    cells,
  };
}
