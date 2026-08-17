/* ─────────────────────────────────────────────────────────────
   Membrane — Canvas. Same STANDARD Loom's own Canvas Manager
   established (a Preset dropdown + custom Width/Height, see
   loom/js/canvas-manager.js) — reused as a shape, not imported as
   machinery: Loom's own unit/margin/safeArea/bleed fields describe a
   PRINT document a grid resolves into, and Membrane has neither a grid
   nor a print output, so mm/cm/m conversion would be a physical unit
   with no honest meaning here. What genuinely carries over is the
   preset list + custom width/height pair, kept in px only.
   ───────────────────────────────────────────────────────────── */

export const CANVAS_PRESETS = {
  'Square 1:1': { width: 1080, height: 1080 },
  'Landscape 16:9': { width: 1920, height: 1080 },
  'Portrait 4:5': { width: 1080, height: 1350 },
  'Widescreen 3:2': { width: 1620, height: 1080 },
};

// Floor well above anything degenerate (a 1×1 canvas throwing p5 into a
// bad state), ceiling generous for a live-animated canvas without
// inviting an accidental multi-thousand-pixel resize that stalls the
// per-frame accumulation loop.
const MIN_CANVAS = 200;
const MAX_CANVAS = 4000;

export function clampCanvasSize(v) {
  return Math.min(MAX_CANVAS, Math.max(MIN_CANVAS, Math.round(v) || MIN_CANVAS));
}
