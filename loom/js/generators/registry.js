/* ─────────────────────────────────────────────────────────────
   Generator registry — the Grid Definition Engine's own module list.
   Adding a generator in a later phase means adding one entry here, not
   touching Constraint Engine, JSON Model, or any renderer — the
   "modular architecture that supports future extensions without
   requiring changes to the core engine" the brief asks for.
   ───────────────────────────────────────────────────────────── */

import { generateBento } from './bento.js';
import { generateSinusoidal } from './sinusoidal.js';

export const GENERATORS = {
  bento: {
    label: 'Bento',
    solver: 'kiwi',
    generate: generateBento,
    defaults: { cols: 4, rows: 4, variety: 0.5, gap: 12, seed: 7 },
  },
  sinusoidal: {
    label: 'Sinusoidal',
    solver: 'parametric',
    generate: generateSinusoidal,
    defaults: { cols: 8, rows: 5, amplitude: 0.5, frequency: 2, phase: 0, axis: 'cols', gap: 8 },
  },
};
