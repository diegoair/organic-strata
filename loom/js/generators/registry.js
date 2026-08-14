/* ─────────────────────────────────────────────────────────────
   Generator registry — the Grid Definition Engine's own module list.
   Adding a generator in a later phase means adding one entry here, not
   touching Constraint Engine, JSON Model, or any renderer — the
   "modular architecture that supports future extensions without
   requiring changes to the core engine" the brief asks for.

   Convergence pass (after Phase 6): the list had grown to 21 entries,
   several of which turned out to be the exact same mechanism at fixed
   parameter values rather than genuinely different structures —
   Voronoi (Organic's own Iterations=0 case), Modular (Bento's own
   Variety=0 case, and Bento already ships variety-0-reproduces-plain-
   grid as a real, working no-op), Polar/Elliptical (Radial plus one
   orthogonal control each), Recursive (Fractal plus one axis-choice
   control), Noise (Sinusoidal's own Function=noise case). Consolidated
   into the 5 generators/1 preset below rather than kept as fake-
   distinct entries — see each surviving generator's own header for the
   specific reasoning, and main.js's BUILTIN_GRID_PRESETS for the new
   "Modular Grid" preset that replaced the Modular generator entirely.
   16 generators live (down from 21), zero output capability lost:
   every old generator's exact result is still reachable as a specific
   parameter combination on its surviving sibling.
   ───────────────────────────────────────────────────────────── */

import { generateBento } from './bento.js';
import { generateSinusoidal } from './sinusoidal.js';
import { generateHexagonal } from './hexagonal.js';
import { generateRadial } from './radial.js';
import { generateTriangular } from './triangular.js';
import { generateDiamond } from './diamond.js';
import { generateCircular } from './circular.js';
import { generateLinear } from './linear.js';
import { generateRectangular } from './rectangular.js';
import { generateDiagonal } from './diagonal.js';
import { generateAngular } from './angular.js';
import { generateMasonry } from './masonry.js';
import { generateFractal } from './fractal.js';
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
    // Label "Wave" — the type key stays 'sinusoidal' (its original,
    // still-accurate default case), now covering Sine AND Noise via
    // `fn` — see sinusoidal.js's own header for the merge reasoning.
    label: 'Wave',
    solver: 'parametric',
    cellShape: 'rect',
    generate: generateSinusoidal,
    defaults: { cols: 8, rows: 5, fn: 'sine', amount: 0.5, frequency: 2, phase: 0, scale: 2, seed: 7, axis: 'cols', gap: 8 },
  },
  hexagonal: {
    label: 'Hexagonal',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateHexagonal,
    defaults: { cols: 8, rotation: 0, spinMode: 'off', spinAmount: 20, noiseScale: 3, gap: 0.06, jitter: 0, seed: 7 },
  },
  radial: {
    // Covers the old Radial/Polar/Elliptical trio — `curve` 1 and
    // `stretch` off are the exact old-Radial defaults. See radial.js's
    // own header for the merge reasoning.
    label: 'Radial',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateRadial,
    defaults: { rings: 4, sectors: 12, innerRadiusFrac: 0.15, gap: 0.08, startAngle: 0, curve: 1, stretch: false },
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
  linear: {
    label: 'Linear',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateLinear,
    defaults: { cols: 6, rows: 6, axis: 'cols', rotation: 0, jitter: 0, gap: 0.05, seed: 7, distortMode: 'off', distortAmount: 0.3, distortFrequency: 2, distortPhase: 0 },
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
  masonry: {
    label: 'Masonry',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateMasonry,
    defaults: { cols: 5, minHeight: 0.5, maxHeight: 1.8, gap: 12, seed: 7 },
  },
  fractal: {
    // Covers the old Fractal/Recursive pair — `axisMode: 'alternate'`
    // is the exact old-Fractal default. See fractal.js's own header.
    label: 'Fractal',
    solver: 'geometric',
    cellShape: 'polygon',
    generate: generateFractal,
    defaults: { depth: 5, variance: 0.2, axisMode: 'alternate', gap: 8, seed: 7 },
  },
  organic: {
    // Covers the old Voronoi too — Iterations 0 is Voronoi's exact
    // output, verified byte-identical when Organic first shipped.
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
