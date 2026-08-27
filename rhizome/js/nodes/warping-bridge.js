/* ─────────────────────────────────────────────────────────────
   Rhizome node — Warping Pattern (Tier 2 bridge, Phase 2).
   See the listener added to warping/index.html, right after its own
   panel-listener wiring, for the receiving end.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const PATTERNS = ['wood', 'marble', 'cellular', 'contour'];

export const { meta, compute } = makeBridgeNode({
  id: 'warping-pattern',
  label: 'Warping Pattern',
  src: '/warping/',
  inputs: [],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'pattern', type: 'select', options: PATTERNS, default: 'wood' },
  ],
  buildPayload(inputs, params) {
    return { pattern: params.pattern || 'wood' };
  },
});
