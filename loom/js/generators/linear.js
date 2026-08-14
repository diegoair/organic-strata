/* ─────────────────────────────────────────────────────────────
   Linear generator — Column and Row combined into one generator, per
   direct request: those two were each a single fixed axis with no
   other controls, which meant "rotate the columns" or "make it
   columns-and-rows together" had nowhere to go without a third
   generator. Linear replaces both with one generator carrying real
   grid-management controls: `Axis` (Columns / Rows / Both) picks which
   of Column's/Row's/Modular's own topology it reproduces, and
   `Rotation`/`Jitter`/`Seed` are the same controls Hexagonal/
   Triangular/Diamond/Circular already carry, generalised here to a
   rectangular (not necessarily square) cell.

   `cellShape: 'polygon'`, not the rect/Kiwi lattice Column/Row used —
   Rotation needs it, the same reason Diamond isn't a CSS Grid: a
   rotated rect lattice's cells are still rectangles, but CSS Grid has
   no way to rotate individual tracks independently, and clipping a
   rotated lattice to the canvas rect needs real polygon geometry at
   the boundary (see diamond.js's own header for why "rotate the whole
   field, then clip" is the correct construction, not per-cell rotation).

   Two orthogonal unit vectors `nx1`/`nx2` (the rotated X/Y axes) do all
   three axis modes with one shared cell-builder: `both` places a small
   sx×sy rect at every (i,j) lattice point; `cols`/`rows` place a STRIP
   — full sx (or sy) width but stretched `halfLen` (≈ the canvas
   diagonal) along the other axis, then clipped to the inner rect — so
   a single generator naturally reproduces Column's full-height strips,
   Row's full-width bands, or a Modular-like 2D lattice, all through the
   same corner-offset math, never three separate code paths.
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

// Rect cell spanned by two independent half-widths along the rotated
// basis vectors nx1 (rotated X)/nx2 (rotated Y) — a strip is just this
// same builder with one half-width set to `halfLen` instead of a real
// track half-size.
function cellPoly(cx, cy, nx1, nx2, halfW1, halfW2) {
  const pts = [];
  for (const [s1, s2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    pts.push([
      cx + s1 * halfW1 * nx1[0] + s2 * halfW2 * nx2[0],
      cy + s1 * halfW1 * nx1[1] + s2 * halfW2 * nx2[1],
    ]);
  }
  return pts;
}

/**
 * @param {{cols:number, rows:number, axis:'cols'|'rows'|'both', rotation:number, jitter:number, gap:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateLinear(params, inner) {
  const { cols, rows, axis, rotation, jitter, gap, seed } = params;
  const rng = mulberry32(seed);
  const rad = (rotation || 0) * (Math.PI / 180);
  const nx1 = [Math.cos(rad), Math.sin(rad)];   // rotated "X" (division axis for Columns)
  const nx2 = [-Math.sin(rad), Math.cos(rad)];  // rotated "Y" (division axis for Rows)
  const cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  const sx = inner.width / cols, sy = inner.height / rows;
  const halfLen = Math.hypot(inner.width, inner.height) / 2 + Math.max(sx, sy);
  const shrink = 1 - Math.min(0.9, gap || 0);
  const j = (jitter || 0);

  const cells = [];
  const push = (cx0, cy0, halfW1, halfW2) => {
    const poly = clipToRect(cellPoly(cx0, cy0, nx1, nx2, halfW1 * shrink, halfW2 * shrink), inner);
    if (poly.length < 3) return;
    cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
  };

  if (axis === 'cols') {
    for (let i = 0; i < cols; i++) {
      const off = (i - (cols - 1) / 2) * sx + (j ? (rng() - 0.5) * 2 * j * sx : 0);
      push(cx + off * nx1[0], cy + off * nx1[1], sx / 2, halfLen);
    }
  } else if (axis === 'rows') {
    for (let r = 0; r < rows; r++) {
      const off = (r - (rows - 1) / 2) * sy + (j ? (rng() - 0.5) * 2 * j * sy : 0);
      push(cx + off * nx2[0], cy + off * nx2[1], halfLen, sy / 2);
    }
  } else {
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        let offX = (i - (cols - 1) / 2) * sx, offY = (r - (rows - 1) / 2) * sy;
        if (j) { offX += (rng() - 0.5) * 2 * j * sx; offY += (rng() - 0.5) * 2 * j * sy; }
        push(cx + offX * nx1[0] + offY * nx2[0], cy + offX * nx1[1] + offY * nx2[1], sx / 2, sy / 2);
      }
    }
  }

  return {
    grid: {
      type: 'linear',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, rows, axis, rotation, jitter, gap, seed },
      gap: 0,
    },
    cells,
  };
}
