/* ─────────────────────────────────────────────────────────────
   Rectangular generator — the asymmetric/hierarchical sibling to
   Modular: still a plain Columns×Rows lattice, no merged spans, but
   track sizes come from EXPLICIT user-typed ratios ("2,1,1,3") instead
   of being equal or following a periodic/noise function. This is the
   classic content-driven magazine grid — one wide lead column next to
   several narrow ones — which neither Modular (uniform) nor Sinusoidal/
   Noise (periodic/organic modulation) can express: those two describe a
   RULE, this generator describes a specific, hand-set proportion.

   Solved by solveTracksParametric (direct math, no solver) — the ratio
   string IS the sizeFn's weight, already exactly what that function
   expects, so no new solving strategy is needed. Column/row COUNT is
   derived from how many numbers are typed, not a separate slider —
   editing the text is the only thing that changes topology, so there's
   never a mismatch between "how many tracks" and "how many ratios".
   ───────────────────────────────────────────────────────────── */

import { solveTracksParametric } from '../constraint-engine.js';

// "2, 1, 1.5, 3" → [2, 1, 1.5, 3]. Non-numeric/empty entries fall back to
// 1 (a neutral weight) rather than dropping the slot — typing "2,,1"
// still yields 3 tracks, matching what the text visibly shows.
function parseWeights(str) {
  const parts = String(str || '1').split(',').map(s => parseFloat(s.trim()));
  const weights = parts.map(n => (Number.isFinite(n) && n > 0) ? n : 1);
  return weights.length ? weights : [1];
}

/**
 * @param {{colWeights:string, rowWeights:string, gap:number}} params
 * @param {{width:number, height:number}} inner
 */
export function generateRectangular(params, inner) {
  const { colWeights, rowWeights, gap } = params;
  const colW = parseWeights(colWeights);
  const rowW = parseWeights(rowWeights);

  const colSizes = solveTracksParametric(colW.length, inner.width, gap, i => colW[i]);
  const rowSizes = solveTracksParametric(rowW.length, inner.height, gap, i => rowW[i]);

  const cells = [];
  for (let r = 0; r < rowW.length; r++) {
    for (let c = 0; c < colW.length; c++) {
      cells.push({ id: 'c' + (r * colW.length + c), col: c, row: r, colSpan: 1, rowSpan: 1 });
    }
  }

  return {
    grid: {
      type: 'rectangular',
      solver: 'parametric',
      params: { colWeights, rowWeights },
      gap,
      tracks: { cols: colSizes, rows: rowSizes },
    },
    cells,
  };
}
