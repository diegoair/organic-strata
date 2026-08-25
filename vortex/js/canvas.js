/* ─────────────────────────────────────────────────────────────
   Vortex — Canvas. Same STANDARD Loom's own Canvas Manager established
   (a Preset dropdown + custom Width/Height, see loom/js/canvas-manager.js),
   copied verbatim from Membrane's own membrane/js/canvas.js (px only —
   see that file's own header for why mm/cm/m conversion doesn't apply
   to a live canvas with no print output).
   ───────────────────────────────────────────────────────────── */

export const CANVAS_PRESETS = {
  'Square 1:1': { width: 1080, height: 1080 },
  'Landscape 16:9': { width: 1920, height: 1080 },
  'Portrait 4:5': { width: 1080, height: 1350 },
  'Widescreen 3:2': { width: 1620, height: 1080 },
};

const MIN_CANVAS = 200;
const MAX_CANVAS = 4000;

export function clampCanvasSize(v) {
  return Math.min(MAX_CANVAS, Math.max(MIN_CANVAS, Math.round(v) || MIN_CANVAS));
}
