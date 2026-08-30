/* ─────────────────────────────────────────────────────────────
   Rhizome — canvas pan/zoom. Thin call-site wrapper around the shared
   Organica.createZoomPan (Piano Parte 3.4d): min:0.1 to see a whole
   pipeline, panAlways:true (the new opt-in added to core.js
   this session) so empty-canvas-space drag pans even at 100% zoom —
   the standard node-editor gesture, not gated on "already zoomed in"
   like every other Organica tool's own image/canvas zoom.
   ───────────────────────────────────────────────────────────── */

export function createCanvasZoomPan({ graphEl, wrapEl, onChange }) {
  return Organica.createZoomPan({
    canvas: graphEl,
    wrap: wrapEl,
    min: 0.1,
    max: 6,
    panAlways: true,
    onChange,
  });
}
