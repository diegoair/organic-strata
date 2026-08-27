/* ─────────────────────────────────────────────────────────────
   Rhizome node — Image Upload (Tier 1, native, source).

   The upstream a photo-driven bridge (Spore/Pollen/Halide — Phase 3)
   needs: an IMAGE-typed source node holding a real uploaded photo as a
   dataURL. Confirmed necessary by direct research before building the
   3 photo-gated bridges — none of those 3 tools has ANY blank/default
   output path (Spore/Pollen return early with no sourceImage; Halide's
   own two call sites both confirm the same), so a synthetic canvas
   stand-in would misrepresent what the node actually does. A real file
   input, same 'file' param type Loom-Grid-Geometry already uses for
   JSON upload — here it's read as a dataURL instead of text.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';

export const meta = {
  id: 'image-upload',
  label: 'Image Upload',
  category: 'source',
  inputs: [],
  outputs: [{ name: 'image', type: PortType.IMAGE }],
  params: [
    { name: 'dataURL', type: 'file', accept: 'image/*', asDataURL: true, default: '' },
  ],
};

export function compute(inputs, params) {
  if (!params.dataURL) throw new Error('No image uploaded yet — upload one in the node panel.');
  return { dataURL: params.dataURL };
}
