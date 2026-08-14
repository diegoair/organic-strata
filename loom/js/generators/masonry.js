/* ─────────────────────────────────────────────────────────────
   Masonry generator — the Pinterest-style column layout: N equal-width
   columns, each independently stacked with cells of randomised height
   (seeded) until the column fills the canvas — a structure no track-
   lattice generator here can express, since every column's own cell
   BOUNDARIES fall at different y-positions (that's the whole point of
   masonry), not a shared set of row lines every column agrees on.

   Shipped as `cellShape: 'polygon'` even though every cell is a plain
   axis-aligned rect — each cell carries its own already-resolved 4-
   point rectangle rather than a col/row/span into a shared track list,
   because there IS no shared track list on the row axis (Diagonal/
   Masonry/Fractal/Recursive/Spiral all reuse this same "resolved rect
   as a 4-point polygon" trick rather than extending the JSON Model
   with a third cell representation just for this one axis).

   Each column's LAST cell is clamped to exactly fill whatever height
   remains (not just capped at the canvas edge) — the same "no leftover
   unaccounted space" discipline solveTracksParametric's own rescale
   step already applies to Sinusoidal/Noise, just solved directly here
   since a masonry column has no periodic function to normalise.
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

/**
 * @param {{cols:number, minHeight:number, maxHeight:number, gap:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateMasonry(params, inner) {
  const { cols, minHeight, maxHeight, gap, seed } = params;
  const rng = mulberry32(seed);
  const colWidth = (inner.width - gap * (cols - 1)) / cols;

  const cells = [];
  for (let c = 0; c < cols; c++) {
    const x = inner.x + c * (colWidth + gap);
    let y = inner.y;
    const bottom = inner.y + inner.height;
    while (y < bottom - 0.5) {
      let h = colWidth * (minHeight + rng() * (maxHeight - minHeight));
      // Clamp the final cell so the column sums to exactly `inner.height`
      // — no leftover sliver, no overflow past the canvas edge.
      if (y + h + gap >= bottom || bottom - (y + h) < colWidth * minHeight * 0.5) {
        h = bottom - y;
      }
      const poly = rectPoly(x, y, colWidth, h);
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
      y += h + gap;
    }
  }

  return {
    grid: {
      type: 'masonry',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, minHeight, maxHeight, seed },
      gap: 0,
    },
    cells,
  };
}
