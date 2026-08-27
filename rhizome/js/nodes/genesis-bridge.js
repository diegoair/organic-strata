/* ─────────────────────────────────────────────────────────────
   Rhizome node — Genesis Seed (Tier 2 bridge, MVP proof of concept).

   Bridges the real genesis/creator.html via the generic factory in
   bridge-iframe.js. Genesis was picked (Piano Parte 5, Fase 1) as the
   one Tier-2 proof of concept: a clean single entry point
   (loadSeedIntoWorkingShape({genType,genParams})) and a simple existing
   export (formMarkup()) — see the listener added to genesis/creator.html
   right after its own init().
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const GEN_TYPES = ['circle', 'polygon', 'star', 'arc', 'triangle', 'square', 'segment', 'drop', 'blob'];

export const { meta, compute } = makeBridgeNode({
  id: 'genesis-seed',
  label: 'Genesis Seed',
  src: '/genesis/creator.html',
  inputs: [],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'genType', type: 'select', options: GEN_TYPES, default: 'blob' },
  ],
  buildPayload(inputs, params) {
    return { genType: params.genType || 'blob', genParams: {} };
  },
});
