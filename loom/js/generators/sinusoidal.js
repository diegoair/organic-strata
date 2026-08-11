/* ─────────────────────────────────────────────────────────────
   Sinusoidal generator — the "complex" MVP generator, deliberately paired
   against Bento to prove the parametric half of the Constraint Engine
   split (constraint-engine.js's own header) end to end.

   A full Columns×Rows lattice (no merged spans — the rhythm here is in
   TRACK SIZE, not topology) where each column width / row height follows
   a sine wave instead of being uniform. Solved by
   solveTracksParametric, not Kiwi — a sine curve isn't a linear
   constraint, and doesn't need to be one; direct math is simpler and
   exact here, not a lesser substitute for a "real" solver.

   Honesty note, same discipline as Camouflage's own "Stripes/worms"
   disclosure (docs/CAMOUFLAGE.md): this modulates track SIZE, not track
   BOUNDARY SHAPE. A literal wavy grid line is not representable in real
   CSS Grid (`grid-template-columns` is a list of straight-line sizes) or
   as an axis-aligned SVG rect grid — so "sinusoidal" here means a
   rhythmic width/height sequence, which stays honestly renderable by
   every target this tool promises (HTML/CSS Grid, SVG, Figma), rather
   than promising a wavy-edged grid the CSS renderer could never deliver.
   ───────────────────────────────────────────────────────────── */

import { solveTracksParametric } from '../constraint-engine.js';

/**
 * @param {{cols:number, rows:number, amplitude:number, frequency:number,
 *   phase:number, axis:'cols'|'rows'|'both', gap:number}} params
 * @param {{width:number, height:number}} inner
 */
export function generateSinusoidal(params, inner) {
  const { cols, rows, amplitude, frequency, phase, axis, gap } = params;

  const wave = (i, count) => {
    if (count <= 1) return 1;
    const t = i / (count - 1);
    return 1 + amplitude * Math.sin(t * frequency * Math.PI * 2 + phase);
  };
  const flat = () => 1;

  const colFn = (axis === 'cols' || axis === 'both') ? wave : flat;
  const rowFn = (axis === 'rows' || axis === 'both') ? wave : flat;

  const colSizes = solveTracksParametric(cols, inner.width, gap, colFn);
  const rowSizes = solveTracksParametric(rows, inner.height, gap, rowFn);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ id: 'c' + (r * cols + c), col: c, row: r, colSpan: 1, rowSpan: 1 });
    }
  }

  return {
    grid: {
      type: 'sinusoidal',
      solver: 'parametric',
      params: { cols, rows, amplitude, frequency, phase, axis },
      gap,
      tracks: { cols: colSizes, rows: rowSizes },
    },
    cells,
  };
}
