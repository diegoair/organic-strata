/* ─────────────────────────────────────────────────────────────
   Column generator — Phase 2's first elementary type: a plain vertical
   column grid, full canvas height, no rows. The single most common
   typographic grid (a "12-column grid") in its most literal form — not
   Bento reused with Rows pinned to 1, which would still carry Bento's
   own merge/variety/seed controls that don't belong to this mental
   model at all. Kiwi-solved (equal-by-default, overridable under
   priority — constraint-engine.js's own header), same solver Bento uses
   for its own column axis.
   ───────────────────────────────────────────────────────────── */

import { solveTracksKiwi } from '../constraint-engine.js';

/**
 * @param {{count:number, gap:number}} params
 * @param {{width:number, height:number}} inner
 */
export function generateColumn(params, inner) {
  const { count, gap } = params;
  const colSizes = solveTracksKiwi(count, inner.width, gap);
  const cells = [];
  for (let c = 0; c < count; c++) {
    cells.push({ id: 'c' + c, col: c, row: 0, colSpan: 1, rowSpan: 1 });
  }
  return {
    grid: {
      type: 'column',
      solver: 'kiwi',
      params: { count },
      gap,
      tracks: { cols: colSizes, rows: [inner.height] },
    },
    cells,
  };
}
