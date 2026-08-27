/* ─────────────────────────────────────────────────────────────
   Rhizome node — Komorebi Pattern (Tier 2 bridge, Phase 2).
   See the listener added to komorebi/index.html, right after its own
   panel-listener wiring, for the receiving end.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const PATTERNS = ['foliage', 'conifer', 'cellular', 'veins', 'drop', 'blinds', 'fronds', 'leaves', 'cluster', 'blob'];

export const { meta, compute } = makeBridgeNode({
  id: 'komorebi-pattern',
  label: 'Komorebi Pattern',
  src: '/komorebi/',
  inputs: [],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'pattern', type: 'select', options: PATTERNS, default: 'foliage' },
  ],
  buildPayload(inputs, params) {
    return { pattern: params.pattern || 'foliage' };
  },
});
