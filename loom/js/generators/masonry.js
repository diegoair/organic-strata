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
   Masonry/Fractal/Spiral all reuse this same "resolved rect as a
   4-point polygon" trick rather than extending the JSON Model with a
   third cell representation just for this one axis).

   Each column's LAST cell is clamped to exactly fill whatever height
   remains (not just capped at the canvas edge) — the same "no leftover
   unaccounted space" discipline solveTracksParametric's own rescale
   step already applies to Wave, just solved directly here since a
   masonry column has no periodic function to normalise.

   `Distortion` (Off/Sine/Noise) bends the `cols+1` vertical seams
   BETWEEN columns — same construction as linear.js's own header derives
   in full: one shared function of Y, added to each seam's own baseline
   X position. Since seam `i` is read as column `i-1`'s own right edge
   AND column `i`'s own left edge, using the identical function for
   both is what keeps them coincident with no seam-matching special
   case — exactly Linear's Axis:Columns case, just applied to Masonry's
   own column-boundary positions instead of a uniform lattice. The
   INTERNAL stacking cuts within one column stay straight — those are
   independent per column by design (that's what makes it masonry, not
   a lattice), so there is no second boundary to keep them consistent
   with.
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

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

function distortAt(pos, refLen, mode, amount, freq, phase, seedOffset) {
  if (mode === 'off' || !amount) return 0;
  const t = pos / refLen;
  if (mode === 'sine') return amount * Math.sin(t * freq * 2 * Math.PI + phase);
  const n = Organica.noise.fbm(t * freq, seedOffset);
  return amount * (n * 2 - 1);
}

/**
 * @param {{cols:number, minHeight:number, maxHeight:number, gap:number, seed:number, distortMode:'off'|'sine'|'noise', distortAmount:number, distortFrequency:number, distortPhase:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateMasonry(params, inner) {
  const { cols, minHeight, maxHeight, gap, seed, distortMode, distortAmount, distortFrequency, distortPhase } = params;
  const rng = mulberry32(seed);
  const colWidth = (inner.width - gap * (cols - 1)) / cols;
  const bottom = inner.y + inner.height;

  const mode = distortMode || 'off';
  const active = mode !== 'off' && distortAmount > 0;
  const seedOffset = (seed || 0) * 0.137 + 7.7;
  // One shared function of Y for every vertical seam — a seam's own
  // baseline X (seamX below) is what makes each one distinct, not the
  // wave shape, so neighbours always agree exactly where they meet.
  const seamDx = active ? (y) => distortAt(y - inner.y, inner.height, mode, distortAmount * colWidth, distortFrequency, distortPhase, seedOffset) : () => 0;
  const subdiv = active ? 20 : 1;

  // Seam `i` (0..cols) sits at this baseline X before distortion — column
  // c's own cells read seam c as their left edge, seam c+1 as their right.
  const seamX = i => inner.x + i * (colWidth + gap);

  function seamPoints(i, y0, y1) {
    const pts = [];
    for (let k = 0; k <= subdiv; k++) {
      const y = y0 + (y1 - y0) * k / subdiv;
      pts.push([seamX(i) + seamDx(y), y]);
    }
    return pts;
  }

  const cells = [];
  for (let c = 0; c < cols; c++) {
    let y = inner.y;
    while (y < bottom - 0.5) {
      let h = colWidth * (minHeight + rng() * (maxHeight - minHeight));
      // Clamp the final cell so the column sums to exactly `inner.height`
      // — no leftover sliver, no overflow past the canvas edge.
      if (y + h + gap >= bottom || bottom - (y + h) < colWidth * minHeight * 0.5) {
        h = bottom - y;
      }
      const left = seamPoints(c, y, y + h);
      const right = seamPoints(c + 1, y + h, y);   // reversed, closes the loop
      const poly = left.concat(right);
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly), smooth: subdiv > 1 });
      y += h + gap;
    }
  }

  return {
    grid: {
      type: 'masonry',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, minHeight, maxHeight, seed, distortMode, distortAmount, distortFrequency, distortPhase },
      gap: 0,
    },
    cells,
  };
}
