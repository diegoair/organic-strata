/* ─────────────────────────────────────────────────────────────
   Modular generator — the plain Columns×Rows module scaffold (Müller-
   Brockmann-style), no merged spans, no randomness. Mechanically this is
   Bento with Variety pinned to 0 — but shipped as its own named
   generator rather than telling users to "set Bento's Variety to 0",
   same precedent as Noise being Sinusoidal's own direct sibling
   (identical architecture, distinct purpose/UI): Bento's whole panel is
   built around the merge/variety/seed mental model, which is exactly
   the complexity a plain modular scaffold shouldn't have to carry.
   ───────────────────────────────────────────────────────────── */

import { solveTracksKiwi } from '../constraint-engine.js';

/**
 * @param {{cols:number, rows:number, gap:number}} params
 * @param {{width:number, height:number}} inner
 */
export function generateModular(params, inner) {
  const { cols, rows, gap } = params;
  const colSizes = solveTracksKiwi(cols, inner.width, gap);
  const rowSizes = solveTracksKiwi(rows, inner.height, gap);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ id: 'c' + (r * cols + c), col: c, row: r, colSpan: 1, rowSpan: 1 });
    }
  }
  return {
    grid: {
      type: 'modular',
      solver: 'kiwi',
      params: { cols, rows },
      gap,
      tracks: { cols: colSizes, rows: rowSizes },
    },
    cells,
  };
}
