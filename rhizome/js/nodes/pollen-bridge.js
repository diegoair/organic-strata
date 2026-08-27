/* ─────────────────────────────────────────────────────────────
   Rhizome node — Pollen Stipple (Tier 2 bridge, Phase 3).
   Same image-gated shape as Spore, plus a real 6-preset dropdown
   (BUILTIN_PRESETS). See the listener added to pollen/index.html.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const PRESETS = ['Fine Dots', 'Felt-tip', 'Lines Flow', 'Duotone', 'Hatch Flow', 'Hatch Swirl'];

export const { meta, compute } = makeBridgeNode({
  id: 'pollen-stipple',
  label: 'Pollen Stipple',
  src: '/pollen/',
  inputs: [{ name: 'image', type: PortType.IMAGE }],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'preset', type: 'select', options: PRESETS, default: 'Hatch Flow' },
  ],
  buildPayload(inputs, params) {
    return { dataURL: inputs.image ? inputs.image.dataURL : null, preset: params.preset || 'Hatch Flow' };
  },
});
