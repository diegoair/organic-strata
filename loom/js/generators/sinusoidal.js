/* ─────────────────────────────────────────────────────────────
   Wave generator (type: 'sinusoidal', kept for backward compatibility
   with anything already keyed on it — Sinusoidal was the brief's own
   "complex" MVP generator; Noise was its direct sibling, identical
   `solveTracksParametric` architecture, a 1D slice of a noise field
   instead of a sine wave. The two were never actually two different
   MECHANISMS — both modulate track SIZE (not topology) on a full
   Columns×Rows lattice via the exact same normalise-then-rescale
   solver call, differing only in which function supplies the
   per-track weight. `Function` (Sine/Noise) makes that the one real
   parameter it always should have been, same consolidation as
   Radial/Polar/Elliptical and Fractal/Recursive.

   A full Columns×Rows lattice (no merged spans — the rhythm here is in
   TRACK SIZE, not topology). Sine: each column width (or row height,
   or both — `Axis`) follows `1 + Amount·sin(t·Frequency·2π + Phase)`.
   Noise: `1 + Amount·(2·fbm(t·Scale, seedOffset)−1)`, `Organica.noise.fbm`
   sampled along a line — the same "reuse the shared 2D field, don't
   write a new 1D primitive" choice Hexagonal/Triangular/Diamond's own
   Noise Spin mode already makes. Both share ONE `Amount` control
   (0 = uniform tracks, exact no-op, either function) since they're the
   same normalised weight shape; Sine-only (Frequency/Phase) and Noise-
   only (Scale/Seed) rows show only for their own Function, same
   conditional-row discipline as Hexagonal's own Spin-mode rows.
   Columns and Rows get two DECORRELATED noise curves from one seed
   when Axis is Both (different fixed y-offsets into the shared field).

   Honesty note, same discipline as Camouflage's own "Stripes/worms"
   disclosure: this modulates track SIZE, not track BOUNDARY SHAPE — a
   literal wavy/organic grid line isn't representable in CSS Grid or an
   axis-aligned SVG rect grid, so "Wave"/"Noise" here means an
   irregular or periodic width/height SEQUENCE, honestly renderable by
   every target this tool promises, not a torn-paper or wavy edge no
   renderer here could actually deliver.
   ───────────────────────────────────────────────────────────── */

import { solveTracksParametric } from '../constraint-engine.js';

/**
 * @param {{cols:number, rows:number, fn:'sine'|'noise', amount:number, frequency:number, phase:number, scale:number, seed:number, axis:'cols'|'rows'|'both', gap:number}} params
 * @param {{width:number, height:number}} inner
 */
export function generateSinusoidal(params, inner) {
  const { cols, rows, fn, amount, frequency, phase, scale, seed, axis, gap } = params;

  const sineWave = (i, count) => {
    if (count <= 1) return 1;
    const t = i / (count - 1);
    return 1 + amount * Math.sin(t * frequency * Math.PI * 2 + phase);
  };
  // Two DECORRELATED 1D noise curves (cols vs rows) from one seed — a
  // fixed y-offset per axis, same "sample the shared 2D field at a
  // per-purpose offset" trick Warping's own domain-warp taps use, so
  // Columns and Rows never accidentally track the same curve when both
  // are noise-driven (Axis: Both).
  const colOffset = (seed || 0) * 0.137 + 1.7;
  const rowOffset = (seed || 0) * 0.137 + 9.2;
  const noiseWave = (yOffset) => (i, count) => {
    if (count <= 1) return 1;
    const t = i / (count - 1);
    const n = Organica.noise.fbm(t * scale, yOffset);
    return 1 + amount * (n * 2 - 1);
  };
  const flat = () => 1;

  const waveFn = fn === 'noise' ? noiseWave : (_offset) => sineWave;
  const colFn = (axis === 'cols' || axis === 'both') ? waveFn(colOffset) : flat;
  const rowFn = (axis === 'rows' || axis === 'both') ? waveFn(rowOffset) : flat;

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
      params: { cols, rows, fn, amount, frequency, phase, scale, seed, axis },
      gap,
      tracks: { cols: colSizes, rows: rowSizes },
    },
    cells,
  };
}
