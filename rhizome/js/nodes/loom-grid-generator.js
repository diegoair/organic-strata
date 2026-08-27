/* ─────────────────────────────────────────────────────────────
   Rhizome node — Loom Grid Generator (Tier 1, zero-porting).

   Wraps loom/js/generators/*.js directly as real ES module imports —
   all are already pure functions decoupled from the DOM by Loom's own
   architecture (registry.js header comment). Phase 1 shipped bento
   (rect, Kiwi-solved) + hexagonal (polygon, geometric) — one of each
   cellShape. Phase 2 (Piano Parte 5) adds triangular/diamond/circular:
   all three share hexagonal's exact params shape ({cols, rotation,
   spinMode, spinAmount, noiseScale, gap, jitter, seed} — confirmed by
   reading each file's own params destructuring before adding), so they
   fall through the same `else` branch below with zero new branching —
   circular just ignores the spin-related keys it doesn't destructure,
   same as any unused object property.

   Output shape matches Organica.loadLoomGrid()'s own return contract
   exactly — {canvas, grid, inner, cellShape, cells} — so every other
   node/adapter that already knows that shape (Grid→Geometry is a
   pass-through of it, grid->points / grid->svg adapters) works
   unchanged whether the grid came from this node or from an uploaded
   Loom JSON file (loom-grid-geometry.js).
   ───────────────────────────────────────────────────────────── */

import { generateBento } from '/loom/js/generators/bento.js';
import { generateHexagonal } from '/loom/js/generators/hexagonal.js';
import { generateTriangular } from '/loom/js/generators/triangular.js';
import { generateDiamond } from '/loom/js/generators/diamond.js';
import { generateCircular } from '/loom/js/generators/circular.js';
import { resolveCellRects } from '/loom/js/json-model.js';
import { PortType } from '../port-types.js';

const GENERATORS = {
  bento: generateBento,
  hexagonal: generateHexagonal,
  triangular: generateTriangular,
  diamond: generateDiamond,
  circular: generateCircular,
};

export const meta = {
  id: 'loom-grid-generator',
  label: 'Loom Grid',
  category: 'source',
  inputs: [],
  outputs: [{ name: 'grid', type: PortType.GRID }],
  params: [
    { name: 'type', type: 'select', options: ['bento', 'hexagonal', 'triangular', 'diamond', 'circular'], default: 'bento' },
    { name: 'width', type: 'number', min: 100, max: 1200, default: 400 },
    { name: 'height', type: 'number', min: 100, max: 1200, default: 300 },
    { name: 'cols', type: 'number', min: 2, max: 12, default: 4 },
    { name: 'rows', type: 'number', min: 2, max: 12, default: 4 },
    { name: 'variety', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
    { name: 'gap', type: 'number', min: 0, max: 30, default: 10 },
    { name: 'seed', type: 'number', min: 0, max: 9999, default: 7 },
  ],
};

export function compute(inputs, params) {
  const type = params.type || 'bento';
  const generate = GENERATORS[type];
  if (!generate) throw new Error(`Unknown Loom generator "${type}".`);

  const width = params.width || 400, height = params.height || 300;
  const inner = { x: 0, y: 0, width, height };

  let grid, cells;
  if (type === 'bento') {
    const out = generate({
      cols: params.cols, rows: params.rows,
      variety: params.variety, gap: params.gap, seed: params.seed,
    }, inner);
    grid = out.grid;
    cells = resolveCellRects({ grid, cells: out.cells }, inner).map(c => ({ ...c, shape: 'rect' }));
  } else {
    const out = generate({
      cols: params.cols, rotation: 0, spinMode: 'off', spinAmount: 0,
      noiseScale: 3, gap: params.gap, jitter: 0, seed: params.seed,
    }, inner);
    grid = out.grid;
    cells = out.cells.map(c => ({ ...c, shape: 'polygon' }));
  }

  return {
    canvas: { width, height },
    grid,
    inner,
    cellShape: grid.cellShape || 'rect',
    cells,
  };
}
