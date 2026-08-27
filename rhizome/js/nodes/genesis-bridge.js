/* ─────────────────────────────────────────────────────────────
   Rhizome node — Genesis Seed (Tier 2 bridge, MVP proof of concept).

   Bridges the real Genesis tool via the generic factory in
   bridge-iframe.js. Genesis was picked (Piano Parte 5, Fase 1) as the
   one Tier-2 proof of concept: a clean single entry point
   (loadSeedIntoWorkingShape({genType,genParams})) and a simple existing
   export (formMarkup()) — see the listener at the bottom of
   genesis/index.html.

   src was '/genesis/creator.html' until Aug 27, 2026, when Creator was
   merged into the unified tool at /genesis/ and creator.html became a
   redirect — which would have broken this bridge, since the redirect
   fires inside the hidden iframe and never answers the protocol.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const GEN_TYPES = ['circle', 'polygon', 'star', 'arc', 'triangle', 'square', 'segment', 'drop', 'blob'];

export const { meta, compute } = makeBridgeNode({
  id: 'genesis-seed',
  label: 'Genesis Seed',
  src: '/genesis/',
  inputs: [],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'genType', type: 'select', options: GEN_TYPES, default: 'blob' },
  ],
  buildPayload(inputs, params) {
    return { genType: params.genType || 'blob', genParams: {} };
  },
});
