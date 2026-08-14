/* ─────────────────────────────────────────────────────────────
   Generator registry — the Grid Definition Engine's own module list.
   Adding a generator in a later phase means adding one entry here, not
   touching Constraint Engine, JSON Model, or any renderer — the
   "modular architecture that supports future extensions without
   requiring changes to the core engine" the brief asks for.
   ───────────────────────────────────────────────────────────── */

import { generateBento } from './bento.js';
import { generateSinusoidal } from './sinusoidal.js';
import { generateVoronoi } from './voronoi.js';
import { generateHexagonal } from './hexagonal.js';
import { generateRadial } from './radial.js';
import { generateTriangular } from './triangular.js';
import { generateDiamond } from './diamond.js';
import { generateCircular } from './circular.js';
import { generateNoise } from './noise.js';
import { generateColumn } from './column.js';
import { generateRow } from './row.js';
import { generateModular } from './modular.js';
import { generateRectangular } from './rectangular.js';
import { generateDiagonal } from './diagonal.js';
import { generateAngular } from './angular.js';
import { generatePolar } from './polar.js';
import { generateElliptical } from './elliptical.js';
import { generateMasonry } from './masonry.js';
import { generateFractal } from './fractal.js';
import { generateRecursive } from './recursive.js';
import { generateOrganic } from './organic.js';
import { generateSpiral } from './spiral.js';

export const GENERATORS = {
  bento: {
    label: 'Bento',
    solver: 'kiwi',
    cellShape: 'rect',
    generate: generateBento,
    defaults: { cols: 4, rows: 4, variety: 0.5, gap: 12, seed: 7 },
  },
  sinusoidal: {
    label: 'Sinusoidal',
    solver: 'parametric',
    cellShape: 'rect',
    generate: generateSinusoidal,
    defaults: { cols: 8, rows: 5, amplitude: 0.5, frequency: 2, phase: 0, axis: 'cols', gap: 8 },
  },
  // Polygon-shaped, not a track lattice — main.js branches its preview
  // and export wiring on this flag (see voronoi.js's own header for why
  // there's no honest rect/CSS-Grid form of a Voronoi cell).
  voronoi: {
    label: 'Voronoi',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateVoronoi,
    defaults: { points: 18, seed: 7 },
  },
  hexagonal: {
    label: 'Hexagonal',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateHexagonal,
    defaults: { cols: 8, rotation: 0, spinMode: 'off', spinAmount: 20, noiseScale: 3, gap: 0.06, jitter: 0, seed: 7 },
  },
  radial: {
    label: 'Radial',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateRadial,
    defaults: { rings: 4, sectors: 12, innerRadiusFrac: 0.15, gap: 0.08, startAngle: 0 },
  },
  triangular: {
    label: 'Triangular',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateTriangular,
    defaults: { cols: 8, rotation: 0, spinMode: 'off', spinAmount: 20, noiseScale: 3, gap: 0.06, jitter: 0, seed: 7 },
  },
  diamond: {
    label: 'Diamond',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateDiamond,
    // Rotation defaults to 45, not 0 — reads as an actual diamond/argyle
    // pattern out of the box, matching this generator's own name (see
    // diamond.js's own header: 0 = axis-aligned squares, 45 = diamonds).
    defaults: { cols: 8, rotation: 45, spinMode: 'off', spinAmount: 20, noiseScale: 3, gap: 0.06, jitter: 0, seed: 7 },
  },
  circular: {
    label: 'Circular',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateCircular,
    defaults: { cols: 8, rotation: 0, gap: 0.06, jitter: 0, seed: 7 },
  },
  noise: {
    label: 'Noise',
    solver: 'parametric',
    cellShape: 'rect',
    generate: generateNoise,
    defaults: { cols: 8, rows: 5, amount: 0.5, scale: 2, axis: 'cols', seed: 7, gap: 8 },
  },
  // ── Phase 2 — remaining elementary generators ──
  column: {
    label: 'Column',
    solver: 'kiwi',
    cellShape: 'rect',
    generate: generateColumn,
    defaults: { count: 6, gap: 16 },
  },
  row: {
    label: 'Row',
    solver: 'kiwi',
    cellShape: 'rect',
    generate: generateRow,
    defaults: { count: 6, gap: 16 },
  },
  modular: {
    label: 'Modular',
    solver: 'kiwi',
    cellShape: 'rect',
    generate: generateModular,
    defaults: { cols: 6, rows: 6, gap: 12 },
  },
  rectangular: {
    label: 'Rectangular',
    solver: 'parametric',
    cellShape: 'rect',
    generate: generateRectangular,
    defaults: { colWeights: '2,1,1', rowWeights: '1,1,2', gap: 12 },
  },
  diagonal: {
    label: 'Diagonal',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateDiagonal,
    defaults: { count: 8, angle: 20, skew: 90, gap: 0.06, jitter: 0, seed: 7 },
  },
  angular: {
    label: 'Angular',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateAngular,
    defaults: { sectors: 12, startAngle: 0, centerX: 0.5, centerY: 0.5, gap: 0.06 },
  },
  polar: {
    label: 'Polar',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generatePolar,
    defaults: { rings: 5, sectors: 12, innerRadiusFrac: 0.1, gap: 0.08, startAngle: 0, curve: 1.8 },
  },
  elliptical: {
    label: 'Elliptical',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateElliptical,
    defaults: { rings: 4, sectors: 16, innerRadiusFrac: 0.15, gap: 0.08, startAngle: 0 },
  },
  // ── Phase 3 — the five generators that needed real new geometry;
  // the other five Phase-3 list items (Swiss, Golden Ratio, Rule of
  // Thirds, Timeline, Isometric) turned out to be pure parameter
  // presets on generators that already exist — see main.js's own
  // BUILTIN_GRID_PRESETS rather than duplicate code here. ──
  masonry: {
    label: 'Masonry',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateMasonry,
    defaults: { cols: 5, minHeight: 0.5, maxHeight: 1.8, gap: 12, seed: 7 },
  },
  fractal: {
    label: 'Fractal',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateFractal,
    defaults: { depth: 5, variance: 0.2, gap: 8, seed: 7 },
  },
  recursive: {
    label: 'Recursive',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateRecursive,
    defaults: { depth: 6, variance: 0.3, gap: 8, seed: 7 },
  },
  organic: {
    label: 'Organic',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateOrganic,
    defaults: { points: 24, iterations: 4, seed: 7 },
  },
  spiral: {
    label: 'Spiral',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateSpiral,
    defaults: { count: 8, ratio: 0.382, gap: 8 },
  },
};
