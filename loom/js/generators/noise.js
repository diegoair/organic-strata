/* ─────────────────────────────────────────────────────────────
   Noise generator — the "organic track size" sibling to Sinusoidal,
   built on the identical parametric architecture (`constraint-engine.js`'s
   own header names this exact extension: "sine, noise, radial, polar…").
   A full Columns×Rows lattice (no merged spans, same as Sinusoidal — the
   rhythm here is in TRACK SIZE, not topology) where each column width /
   row height follows a 1D slice of `Organica.noise.fbm` instead of a sine
   wave — an irregular, hand-felt rhythm rather than a perfectly periodic
   one, closer to Organica's own biomimicry/raw-organic-nature language
   than a mathematically clean wave.

   `Organica.noise.fbm` (`shared/organica-noise.js`) is 2D; sampling it
   along a 1D line (`fbm(t * scale, seedOffset)`, `t` sweeping 0→1 across
   the track index, `seedOffset` a per-generation constant derived from
   Seed) gives a reproducible, seed-varying 1D noise curve without
   needing a separate 1D noise implementation — the same "reuse the 2D
   field, don't write a new primitive" choice Hexagonal/Triangular/
   Diamond's own Noise Spin mode already makes. `fbm` returns [0,1]; remapped
   to a signed weight (`1 + amount·(2·fbm−1)`) the same way Sinusoidal
   remaps `sin` — `Amount` 0 is an exact no-op (uniform tracks), matching
   every other Organica control's own "0 = true no-op" discipline.

   Same honesty note as Sinusoidal: this modulates track SIZE, not track
   BOUNDARY SHAPE — a real wavy/organic grid line isn't representable in
   CSS Grid or an axis-aligned SVG rect grid, so "Noise" here means an
   irregular width/height sequence, honestly renderable by every target
   this tool promises, not a torn-paper edge no renderer here could
   actually deliver.
   ───────────────────────────────────────────────────────────── */

import { solveTracksParametric } from '../constraint-engine.js';

/**
 * @param {{cols:number, rows:number, amount:number, scale:number,
 *   axis:'cols'|'rows'|'both', seed:number, gap:number}} params
 * @param {{width:number, height:number}} inner
 */
export function generateNoise(params, inner) {
  const { cols, rows, amount, scale, axis, seed, gap } = params;

  // Two DECORRELATED 1D noise curves (cols vs rows) from one seed — a
  // fixed y-offset per axis, same "sample the shared 2D field at a
  // per-purpose offset" trick Warping's own domain-warp taps use, so
  // Columns and Rows never accidentally track the same curve when both
  // are noise-driven (`axis: 'both'`).
  const colOffset = (seed || 0) * 0.137 + 1.7;
  const rowOffset = (seed || 0) * 0.137 + 9.2;

  const noiseWave = (yOffset) => (i, count) => {
    if (count <= 1) return 1;
    const t = i / (count - 1);
    const n = Organica.noise.fbm(t * scale, yOffset);
    return 1 + amount * (n * 2 - 1);
  };
  const flat = () => 1;

  const colFn = (axis === 'cols' || axis === 'both') ? noiseWave(colOffset) : flat;
  const rowFn = (axis === 'rows' || axis === 'both') ? noiseWave(rowOffset) : flat;

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
      type: 'noise',
      solver: 'parametric',
      params: { cols, rows, amount, scale, axis, seed },
      gap,
      tracks: { cols: colSizes, rows: rowSizes },
    },
    cells,
  };
}
