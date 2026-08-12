/* ─────────────────────────────────────────────────────────────
   Hexagonal generator — second POLYGON-shaped generator (Voronoi's own
   header: `grid.cellShape = 'polygon'` is the fork every renderer already
   branches on), reusing that whole pipeline for free: SVG/PNG export,
   the embedded-SVG live preview, edge dedup (collectPolygonEdges) — none
   of it had to change to add this generator, which is the whole point of
   the fork being a flag on the model rather than per-generator code in
   every renderer.

   Real regular-hexagon tessellation (redblobgames' standard formulas),
   not a distorted/irregular hex-ish shape: flat-top spacing is
   (1.5r horizontal, √3·r vertical, odd COLUMNS offset by half a row);
   pointy-top is the same with axes swapped (odd ROWS offset by half a
   column). At Gap 0 / Jitter 0 this tiles edge-to-edge exactly, the same
   "0 = true no-op" discipline as every other Organica control.

   `cols` drives density, not a literal column count: it sets the target
   horizontal spacing (inner.width / cols), then the loop covers however
   many rows/columns of that size are needed to fill the inner rect —
   simpler than solving backward from a fixed hex count, and it means
   Columns behaves the same way whether the canvas is a square poster or
   a wide banner.

   Gap shrinks each hexagon toward its OWN centre (not the tessellation
   point) before clipping — same idea as Padding on a rect cell, just
   applied pre-clip here since a polygon has no separate "track size" to
   shrink into. Jitter offsets each centre by a seeded random amount
   before the hexagon is built, so the polygon clipped against the inner
   rect can be a false triangle/sliver at the very edge — same accepted
   trade Voronoi's own boundary seeds have.
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

function hexPoints(cx, cy, r, flatTop) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const deg = flatTop ? 60 * i : 60 * i - 30;
    const rad = (Math.PI / 180) * deg;
    pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
  }
  return pts;
}

// Sutherland–Hodgman clip of a convex polygon against an axis-aligned
// rect, one edge (half-plane) at a time — same technique as voronoi.js's
// own clipHalfPlane, generalised to 4 fixed half-planes instead of one
// per neighbour seed.
function clipToRect(poly, rect) {
  const planes = [
    { p: [rect.x, rect.y], n: [1, 0] },
    { p: [rect.x + rect.width, rect.y], n: [-1, 0] },
    { p: [rect.x, rect.y], n: [0, 1] },
    { p: [rect.x, rect.y + rect.height], n: [0, -1] },
  ];
  let out = poly;
  for (const plane of planes) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    const side = (p) => (p[0] - plane.p[0]) * plane.n[0] + (p[1] - plane.p[1]) * plane.n[1];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i - 1 + input.length) % input.length];
      const curSide = side(cur), prevSide = side(prev);
      const curIn = curSide >= 0, prevIn = prevSide >= 0;
      if (curIn !== prevIn) {
        const t = prevSide / (prevSide - curSide);
        out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
      }
      if (curIn) out.push(cur);
    }
  }
  return out;
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

/**
 * @param {{cols:number, orientation:'flat'|'pointy', gap:number, jitter:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateHexagonal(params, inner) {
  const { cols, orientation, gap, jitter, seed } = params;
  const rng = mulberry32(seed);
  const flatTop = orientation === 'flat';

  const hSpacing0 = inner.width / cols;
  const r = flatTop ? hSpacing0 / 1.5 : hSpacing0 / Math.sqrt(3);
  const hSpacing = flatTop ? 1.5 * r : Math.sqrt(3) * r;
  const vSpacing = flatTop ? Math.sqrt(3) * r : 1.5 * r;

  const colSteps = Math.ceil(inner.width / hSpacing) + 2;
  const rowSteps = Math.ceil(inner.height / vSpacing) + 2;
  const effR = r * (1 - gap);

  const cells = [];
  for (let row = -1; row < rowSteps; row++) {
    for (let col = -1; col < colSteps; col++) {
      let cx, cy;
      if (flatTop) {
        cx = inner.x + col * hSpacing;
        cy = inner.y + row * vSpacing + (col % 2 !== 0 ? vSpacing / 2 : 0);
      } else {
        cx = inner.x + col * hSpacing + (row % 2 !== 0 ? hSpacing / 2 : 0);
        cy = inner.y + row * vSpacing;
      }
      if (jitter > 0) {
        cx += (rng() - 0.5) * 2 * jitter * r;
        cy += (rng() - 0.5) * 2 * jitter * r;
      }
      const poly = clipToRect(hexPoints(cx, cy, effR, flatTop), inner);
      if (poly.length < 3) continue;
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'hexagonal',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, orientation, gap, jitter, seed },
      gap: 0,
    },
    cells,
  };
}
