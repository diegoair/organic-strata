/* ─────────────────────────────────────────────────────────────
   Rhizome node — Soul Pass-through (Tier 2 bridge, Phase 2).
   Takes an upstream SVG, round-trips it through Soul's own
   parsePrimitives()/renderStage(), returns the at-rest snapshot. No
   motion pattern is applied yet (see the listener added to
   soul/index.html for why) — this is Rhizome's first bridge node with
   a real INPUT, not just a source, proving a node's own SVG output can
   feed a second tool's own ingestion path.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

export const { meta, compute } = makeBridgeNode({
  id: 'soul-pass',
  label: 'Soul (pass-through)',
  src: '/soul/',
  inputs: [{ name: 'svg', type: PortType.SVG }],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [],
  buildPayload(inputs) {
    return { svg: inputs.svg };
  },
});
