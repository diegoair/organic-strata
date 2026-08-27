/* ─────────────────────────────────────────────────────────────
   Rhizome node — Spore Stipple (Tier 2 bridge, Phase 3).
   Spore has no default/blank output (confirmed by reading every call
   site — doRender()'s callers all bail without a sourceImage) and no
   preset dropdown at all (pure slider tool) — so this bridge takes a
   real IMAGE input (from Image Upload, image-upload.js) and no params
   of its own. See the listener added to spore/index.html.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

export const { meta, compute } = makeBridgeNode({
  id: 'spore-stipple',
  label: 'Spore Stipple',
  src: '/spore/',
  inputs: [{ name: 'image', type: PortType.IMAGE }],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [],
  buildPayload(inputs) {
    return { dataURL: inputs.image ? inputs.image.dataURL : null };
  },
});
