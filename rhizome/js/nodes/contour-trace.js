/* ─────────────────────────────────────────────────────────────
   Rhizome node — Contour Trace (Tier 1, zero-porting).

   Thin wrapper on Organica.traceContours/contoursToPathD
   (shared/core.js:296-385) — pure, JSON-safe raster→vector,
   the exact function the Rhizome MVP test already validated inline.
   Accepts an IMAGE input (a binary mask), typically fed by a
   Loom-Grid-Generator/Geometry node through the grid->image adapter
   (adapters.js) — kept as a real port-type boundary rather than baking
   grid-rasterization into this node, so a future raster-photo source
   (Halide-style threshold, a Camo Turing bridge) can feed it too.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';

export const meta = {
  id: 'contour-trace',
  label: 'Contour Trace',
  category: 'transform',
  inputs: [{ name: 'mask', type: PortType.IMAGE }],
  outputs: [{ name: 'path', type: PortType.SVG }],
  params: [
    // Capped at 12: the erosion below is O(padding² · pixels) — fine at
    // this cap for the MVP's working canvas sizes, not meant to scale
    // further without a proper two-pass min-filter erosion.
    { name: 'padding', type: 'number', min: 0, max: 12, default: 0 },
  ],
};

export function compute(inputs, params) {
  const { mask: maskIn } = inputs;
  if (!maskIn) throw new Error('Contour Trace has no mask input connected.');
  const { width: w, height: h } = maskIn;
  const padding = params.padding || 0;

  let mask = maskIn.mask;
  if (padding > 0) {
    // Erode the mask by `padding` px on every side of every ink run —
    // a cheap approximate inset (per-pixel distance-to-background check)
    // good enough for the MVP; a real morphological erode (Living Path's
    // own `morph()`, livingpath/index.html:577) is the honest upgrade
    // path once this node graduates past the MVP.
    const eroded = new Uint8Array(mask.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      let keep = true;
      for (let dy = -padding; dy <= padding && keep; dy++) {
        for (let dx = -padding; dx <= padding; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || !mask[ny * w + nx]) { keep = false; break; }
        }
      }
      eroded[y * w + x] = keep ? 1 : 0;
    }
    mask = eroded;
  }

  const d = Organica.contoursToPathD(mask, w, h, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="#0a0a0a" fill-rule="evenodd"/></svg>`;
}
