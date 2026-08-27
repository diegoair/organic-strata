/* ─────────────────────────────────────────────────────────────
   Rhizome node — Camo Turing Pattern (Tier 2 bridge, Phase 2 — the
   flagged-risk bridge).

   Camo Turing's Gray-Scott core needs to evolve over many steps and has
   NO convergence/auto-pause detection to hook into (confirmed by reading
   the file directly — see the listener added to camo-turing/index.html
   for the full finding). The bridge runs a fixed, tunable step count
   instead of a true "wait until settled" — a disclosed simplification,
   exposed as the `steps` param rather than hidden behind a guessed
   constant. Larger step counts take longer (WebGL draw calls, not free)
   — default 1500 is a middle ground, tune per preset if a pattern still
   looks unsettled.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const PRESETS = [
  'The U-Skate World', 'Worms', 'Worms join into maze', 'Negatons', 'Turing patterns',
  'Chaos to Turing negatons', 'Fingerprints', 'Chaos with negatons', 'Spots and worms',
  'Self-replicating spots', 'Super-resonant mazes', 'Mazes', 'Mazes with some chaos',
  'Chaos', 'Pulsating solitons', 'Warring microbes', 'Spots and loops', 'Moving spots',
  'Leopard spots', 'Cheetah spots', 'Tiger stripes', 'Zebra stripes', 'Watermelon rind',
];

export const { meta, compute } = makeBridgeNode({
  id: 'camo-turing-pattern',
  label: 'Camo Turing Pattern',
  src: '/camo-turing/',
  inputs: [],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'preset', type: 'select', options: PRESETS, default: 'Leopard spots' },
    { name: 'steps', type: 'number', min: 100, max: 5000, step: 100, default: 1500 },
  ],
  buildPayload(inputs, params) {
    return { preset: params.preset || 'Leopard spots', steps: params.steps || 1500 };
  },
});
