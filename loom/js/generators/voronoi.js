/* ─────────────────────────────────────────────────────────────
   Voronoi generator — the first POLYGON-shaped generator, not a rect one.

   A real architecture fork, not a Bento variant: Bento/Sinusoidal cells
   are always axis-aligned rectangles that live on a Columns×Rows track
   lattice (grid.tracks + col/row/span), because that's what CSS Grid can
   natively render. Voronoi cells are arbitrary convex polygons — there is
   no honest way to force them onto a track lattice (a bounding-box
   approximation would be a fake, the exact kind of degenerate output this
   project's own conventions refuse to ship — see e.g. the Padding no-op
   discipline, the real-vector-SVG rule elsewhere in Organica). So this
   generator sets `grid.cellShape = 'polygon'` and cells carry their own
   absolute-coordinate point list directly — registry.js/main.js branch on
   that flag to route rendering differently (SVG-native preview instead of
   live CSS Grid; see html-renderer.js's own header for the CSS-side of
   this fork).

   Cell construction: N seed points scattered in the inner rect (seeded),
   each cell = the seed's own Voronoi region computed by half-plane
   intersection — start from the inner rect as a polygon, then for every
   OTHER seed, clip to the half-plane on this seed's own side of their
   perpendicular bisector (Sutherland–Hodgman). O(N²) total, trivial at
   the cell counts this tool actually uses (a few dozen), and far simpler
   to get right than Fortune's algorithm for the same result.

   Solver: neither Kiwi nor the parametric track math — genuinely a third
   category (labelled `solver: 'geometric'`), since there's no linear
   constraint system and no track function to evaluate. Documented as its
   own thing rather than forced into the existing two-way split.
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

// Sutherland–Hodgman clip of convex polygon `poly` to the half-plane
// containing `pi`, bounded by the perpendicular bisector of pi/pj.
function clipHalfPlane(poly, pi, pj) {
  const mx = (pi[0] + pj[0]) / 2, my = (pi[1] + pj[1]) / 2;
  const nx = pi[0] - pj[0], ny = pi[1] - pj[1];   // normal pointing toward pi
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

/**
 * @param {{points:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateVoronoi(params, inner) {
  const { points, seed } = params;
  const rng = mulberry32(seed);
  const seeds = Array.from({ length: points }, () => [
    inner.x + rng() * inner.width,
    inner.y + rng() * inner.height,
  ]);

  const boundsPoly = [
    [inner.x, inner.y], [inner.x + inner.width, inner.y],
    [inner.x + inner.width, inner.y + inner.height], [inner.x, inner.y + inner.height],
  ];

  const cells = seeds.map((pi, i) => {
    let poly = boundsPoly;
    for (let j = 0; j < seeds.length; j++) {
      if (j === i || poly.length === 0) continue;
      poly = clipHalfPlane(poly, pi, seeds[j]);
    }
    const centroid = poly.length ? polygonCentroid(poly) : pi;
    return { id: 'c' + i, points: poly, centroid };
  }).filter(c => c.points.length >= 3);   // a seed can be fully clipped away by denser neighbours — drop degenerate cells rather than emit a fake sliver

  return {
    grid: {
      type: 'voronoi',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { points, seed },
      gap: 0,
    },
    cells,
  };
}
