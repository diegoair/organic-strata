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

   `Distortion` (Off/Sine/Noise) — the same construction Linear's own
   header derives in full: ONE `warp(a, b)` function used for every
   point on every cell edge, where the displacement along `u` depends
   only on the `b` (v-axis) lattice coordinate and the displacement
   along `v` depends only on the `a` (u-axis) coordinate. That
   separability is what guarantees two cells sharing a nominal edge —
   even though `u`/`v` aren't perpendicular here — always compute the
   identical warped position for it, since a shared edge always has
   one of its two lattice coordinates literally constant along its own
   length. Diagonal is really Linear's own `Axis: Both` case with a
   non-90° basis, so the identical warp idea carries over unchanged.

   `Gap` shrinks each parallelogram toward its own centroid (same
   "shrink toward the cell's own middle" idea as every other polygon
   generator's Gap, applied post-warp so it still works on a curved,
   many-point cell exactly as it did on a plain 4-corner one); `Jitter`
   offsets each lattice point before the shape is built, same accepted
   "breaks exact shared edges" trade-off — applied as a uniform
   translation of the cell's own already-warped points, so Jitter and
   Distortion don't fight each other's own math.
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

// Same distortion shape as linear.js's own distortAt — a lattice-index
// offset (not a physical length; `a`/`b` are already in units of "whole
// lattice steps", so the result is dimensionless too, scaled into
// u/v's own physical length automatically when multiplied by the basis
// vector).
function distortAt(pos, mode, amount, freq, phase, seedOffset) {
  if (mode === 'off' || !amount) return 0;
  if (mode === 'sine') return amount * Math.sin(pos * freq * 2 * Math.PI / 8 + phase);
  const n = Organica.noise.fbm(pos * freq / 8, seedOffset);
  return amount * (n * 2 - 1);
}

function traceEdge(realPoint, a0, b0, a1, b1, subdiv) {
  const pts = [];
  for (let k = 0; k <= subdiv; k++) {
    const t = k / subdiv;
    pts.push(realPoint(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t));
  }
  return pts;
}

/**
 * @param {{count:number, angle:number, skew:number, gap:number, jitter:number, seed:number, distortMode:'off'|'sine'|'noise', distortAmount:number, distortFrequency:number, distortPhase:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateDiagonal(params, inner) {
  const { count, angle, skew, gap, jitter, seed, distortMode, distortAmount, distortFrequency, distortPhase } = params;
  const rng = mulberry32(seed);

  const s = inner.width / count;
  const a0deg = (angle || 0) * (Math.PI / 180);
  const a1deg = a0deg + (skew != null ? skew : 90) * (Math.PI / 180);
  const u = [s * Math.cos(a0deg), s * Math.sin(a0deg)];
  const v = [s * Math.cos(a1deg), s * Math.sin(a1deg)];

  const centerX = inner.x + inner.width / 2, centerY = inner.y + inner.height / 2;
  const halfDiag = Math.hypot(inner.width, inner.height) / 2 + s;
  const steps = Math.ceil((2 * halfDiag) / s) + 2;
  const start = -Math.floor(steps / 2);
  const shrink = 1 - Math.min(0.9, gap || 0);

  const mode = distortMode || 'off';
  const active = mode !== 'off' && distortAmount > 0;
  const seedOffsetA = (seed || 0) * 0.137 + 5.1, seedOffsetB = (seed || 0) * 0.137 + 13.9;
  const distortA = active ? (b) => distortAt(b, mode, distortAmount, distortFrequency, distortPhase, seedOffsetA) : null;
  const distortB = active ? (a) => distortAt(a, mode, distortAmount, distortFrequency, distortPhase, seedOffsetB) : null;
  const subdiv = active ? 6 : 1;

  const realPoint = (a, b) => {
    const da = distortA ? distortA(b) : 0, db = distortB ? distortB(a) : 0;
    const ra = a + da, rb = b + db;
    return [centerX + ra * u[0] + rb * v[0], centerY + ra * u[1] + rb * v[1]];
  };

  const cells = [];
  for (let j = start; j < start + steps; j++) {
    for (let i = start; i < start + steps; i++) {
      let poly = traceEdge(realPoint, i, j, i + 1, j, subdiv)
        .concat(traceEdge(realPoint, i + 1, j, i + 1, j + 1, subdiv))
        .concat(traceEdge(realPoint, i + 1, j + 1, i, j + 1, subdiv))
        .concat(traceEdge(realPoint, i, j + 1, i, j, subdiv));

      if (jitter > 0) {
        const dx = (rng() - 0.5) * 2 * jitter * s, dy = (rng() - 0.5) * 2 * jitter * s;
        poly = poly.map(p => [p[0] + dx, p[1] + dy]);
      }
      if (shrink < 1) {
        const c = polygonCentroid(poly);
        poly = poly.map(p => [c[0] + (p[0] - c[0]) * shrink, c[1] + (p[1] - c[1]) * shrink]);
      }
      poly = clipToRect(poly, inner);
      if (poly.length < 3) continue;
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly), smooth: subdiv > 1 });
    }
  }

  return {
    grid: {
      type: 'diagonal',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { count, angle, skew, gap, jitter, seed, distortMode, distortAmount, distortFrequency, distortPhase },
      gap: 0,
    },
    cells,
  };
}
