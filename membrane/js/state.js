/* ─────────────────────────────────────────────────────────────
   Membrane — shared mutable state. One plain object, imported by every
   module, instead of threading two dozen parameters through every
   function call — the same "one source of truth" reasoning Loom's own
   Universal JSON Model uses, just for a live sketch's runtime state
   rather than an exportable model.

   `state.p` holds the live p5 INSTANCE (instance mode, not global mode —
   the exploration this is migrated from used global mode, which doesn't
   compose with ES modules: every module here would collide on the same
   bare `random`/`noise`/`curveVertex` globals). main.js constructs it
   once and stores it here; every other module reads state.p.* instead
   of importing p5 itself.
   ───────────────────────────────────────────────────────────── */

export const state = {
  p: null,             // the p5 instance, set once by main.js
  W: 800, H: 800,       // canvas size

  // ── Form (the breathing shape) ──
  centerX: 400, centerY: 400,
  xs: [], ys: [],
  shapeBreaks: new Set(),   // indices i where segment (i-1→i) crosses two unrelated contours — see seeds/text.js
  formResolution: 15,
  initRadius: 150,
  pointSizeSetting: 8,
  pointSize: 8,             // the LIVE point's own drawn radius, set by initShape() from whatever radius it was spawned with
  drawMode: 'line',         // 'circle' | 'line' | 'point'
  stepSize: 2,

  // ── Seed source ──
  seedSource: 'procedural', // 'procedural' | 'image' | 'text'
  seedStyle: 'contour',     // 'contour' | 'scatter' — Image only
  threshold: 128,
  invertMask: false,
  imageScale: 0.85,
  seedText: 'AMO',
  loadedImg: null,
  imgFit: null,              // { scale, refX, refY } — set by applySeedResult(), read back by Sample-from-image colour + Text's own path builder
  imgPixelsCache: null,      // { pixels, w, h } — cached once per image load, not reloaded per point/frame

  // ── Motion ──
  movementPattern: 'mouse',  // mouse | linear | orbit | zigzag | figure8 | sine | textpath
  floatSpeed: 0.01,
  moveSpeed: 1,
  moveClock: 0,
  linVX: 1, linVY: 0.6,      // Linear (bounce)'s own current direction

  // ── Follow path ──
  pathSource: 'text',        // 'text' | 'loom'
  textPathPoints: [],        // stable canvas-space waypoints — see seeds/text.js and seeds/loom.js
  pathBreaks: new Set(),
  loompathStyle: 'borders',  // 'borders' | 'centroids'
  lastLoomModel: null,       // kept so switching Loom path style rebuilds without re-choosing the file
  drawFullPath: true,
  pathRenderStyle: 'line',   // 'line' | 'dots'
  pathDotSize: 6,
  glowEnabled: false,
  writeBrush: false,
  brushSize: 20,

  // ── Ink ──
  colorSrc: 'ink',           // 'ink' | 'rainbow' | 'image'
  strokeW: 0.75,
  strokeAlpha: 50,
  fillEachFrame: false,
  inkRGB: [246, 232, 195],
  accentRGB: [10, 10, 10],

  frozen: false,
};

// Point mode means exactly ONE agent regardless of seed source — without
// this, Image/Text would still sample formResolution points and
// renderPoint() would silently draw index 0 of that array, wasting the
// rest on a per-frame random walk nobody sees (a real bug caught in the
// exploration this migrates from).
export function effectiveN() {
  return state.drawMode === 'point' ? 1 : state.formResolution;
}
