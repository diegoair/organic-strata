/* ─────────────────────────────────────────────────────────────
   Rhizome node — Membrane Trail (Tier 2 bridge, Phase 3, the second
   flagged-risk bridge alongside Camo Turing).

   Confirmed directly: Membrane's trail position genuinely depends on
   wall-clock time (p.deltaTime-driven movement, a real setTimeout-
   throttled pushHistory()), not frame count — there is no synchronous
   "advance N steps" entry point the way Camo Turing's stepSim() is. So
   `seconds` is a real wait, not a step count — larger values cost real
   time, not just more compute. Default 2.5s is enough for a visible
   trail on most patterns; slower patterns may want more.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const PATTERNS = ['mouse', 'linear', 'orbit', 'zigzag', 'figure8', 'sine'];

export const { meta, compute } = makeBridgeNode({
  id: 'membrane-trail',
  label: 'Membrane Trail',
  src: '/membrane/',
  inputs: [],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'pattern', type: 'select', options: PATTERNS, default: 'orbit' },
    { name: 'seconds', type: 'number', min: 1, max: 10, default: 2.5, step: 0.5 },
  ],
  buildPayload(inputs, params) {
    return { pattern: params.pattern || 'orbit', seconds: params.seconds || 2.5 };
  },
});
