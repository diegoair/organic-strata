/* ─────────────────────────────────────────────────────────────
   Rhizome node — Halide Dither (Tier 2 bridge, Phase 3).
   Confirmed to genuinely need a real photo — no default/blank output
   path exists (both scheduleRender()'s and exportSVG()'s own guards
   checked directly). Requires an IMAGE input; 8 built-in presets.
   See the listener added to halide/index.html.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const PRESETS = [
  'Mac Classic (Atkinson)', 'Newspaper (Bayer 4×4)', 'Film Grain (Floyd–Steinberg)',
  'Halftone Coarse (Bayer 8×8)', 'Fine Grain (Bayer 16×16)', 'High-Contrast Portrait',
  'Threshold (no dither)', 'Ditherface',
];

export const { meta, compute } = makeBridgeNode({
  id: 'halide-dither',
  label: 'Halide Dither',
  src: '/halide/',
  inputs: [{ name: 'image', type: PortType.IMAGE }],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'preset', type: 'select', options: PRESETS, default: 'Ditherface' },
  ],
  buildPayload(inputs, params) {
    return { dataURL: inputs.image ? inputs.image.dataURL : null, preset: params.preset || 'Ditherface' };
  },
});
