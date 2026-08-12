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
};
