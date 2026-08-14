/* ─────────────────────────────────────────────────────────────
   Diagonal generator — sixth polygon-shaped generator, and the
   parallelogram/rhombus sibling to Diamond: Diamond is a plain square
   lattice rigidly ROTATED as a whole (the angle between its two edge
   families is always 90°); Diagonal is the same lattice construction
   with that inter-family angle itself exposed as `Skew`, so the cell
   shape genuinely changes (square → rhombus → increasingly sheared
   parallelogram) rather than just spinning. Two families of parallel
   lines is exactly what an affine-sheared regular lattice already IS —
   no separate line-intersection code needed, just two basis vectors
   `u`/`v` at `Angle` and `Angle + Skew` instead of the always-
   perpendicular case.

   Each cell is the parallelogram spanned by (P, P+u, P+u+v, P+v) at
   lattice point P = centre + i·u + j·v — the direct 2D analogue of
   mapping a unit square through a basis, same construction Diamond's
   own header describes (build what's proven to tile: a plain lattice,
   then transform the WHOLE field, never the shape alone) generalised
   from a rigid rotation to a full affine basis change. `Skew` at 90°
   reproduces a plain rotated rect lattice exactly (Diamond's own
   Rotation-0 case); away from 90° it shears into parallelograms no
   other generator here can produce.

   `Gap` shrinks each parallelogram toward its own centroid (same
   "shrink toward the cell's own middle" idea as every other polygon
   generator's Gap); `Jitter` offsets each lattice point before the
   shape is built, same accepted "breaks exact shared edges" trade-off.
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

// Sutherland–Hodgman clip of a convex polygon against an axis-aligned
// rect — same technique as every other polygon generator's own private
// copy (voronoi.js/hexagonal.js/diamond.js/etc.).
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
 * @param {{count:number, angle:number, skew:number, gap:number, jitter:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateDiagonal(params, inner) {
  const { count, angle, skew, gap, jitter, seed } = params;
  const rng = mulberry32(seed);

  const s = inner.width / count;
  const a0 = (angle || 0) * (Math.PI / 180);
  const a1 = a0 + (skew != null ? skew : 90) * (Math.PI / 180);
  const u = [s * Math.cos(a0), s * Math.sin(a0)];
  const v = [s * Math.cos(a1), s * Math.sin(a1)];

  const centerX = inner.x + inner.width / 2, centerY = inner.y + inner.height / 2;
  const halfDiag = Math.hypot(inner.width, inner.height) / 2 + s;
  const steps = Math.ceil((2 * halfDiag) / s) + 2;
  const start = -Math.floor(steps / 2);
  const shrink = 1 - Math.min(0.9, gap || 0);

  const cells = [];
  for (let j = start; j < start + steps; j++) {
    for (let i = start; i < start + steps; i++) {
      let px = centerX + i * u[0] + j * v[0];
      let py = centerY + i * u[1] + j * v[1];
      if (jitter > 0) {
        px += (rng() - 0.5) * 2 * jitter * s;
        py += (rng() - 0.5) * 2 * jitter * s;
      }
      let poly = [
        [px, py],
        [px + u[0], py + u[1]],
        [px + u[0] + v[0], py + u[1] + v[1]],
        [px + v[0], py + v[1]],
      ];
      if (shrink < 1) {
        const c = polygonCentroid(poly);
        poly = poly.map(p => [c[0] + (p[0] - c[0]) * shrink, c[1] + (p[1] - c[1]) * shrink]);
      }
      poly = clipToRect(poly, inner);
      if (poly.length < 3) continue;
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'diagonal',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { count, angle, skew, gap, jitter, seed },
      gap: 0,
    },
    cells,
  };
}
