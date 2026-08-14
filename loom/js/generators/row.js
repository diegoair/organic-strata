/* ─────────────────────────────────────────────────────────────
   Row generator — Column's own mirror: full canvas width, no columns,
   N horizontal bands. Same rationale as column.js's own header (a
   dedicated, uncluttered generator for the plain single-axis case
   rather than Bento with Columns pinned to 1).
   ───────────────────────────────────────────────────────────── */

import { solveTracksKiwi } from '../constraint-engine.js';

/**
 * @param {{count:number, gap:number}} params
 * @param {{width:number, height:number}} inner
 */
export function generateRow(params, inner) {
  const { count, gap } = params;
  const rowSizes = solveTracksKiwi(count, inner.height, gap);
  const cells = [];
  for (let r = 0; r < count; r++) {
    cells.push({ id: 'c' + r, col: 0, row: r, colSpan: 1, rowSpan: 1 });
  }
  return {
    grid: {
      type: 'row',
      solver: 'kiwi',
      params: { count },
      gap,
      tracks: { cols: [inner.width], rows: rowSizes },
    },
    cells,
  };
}
