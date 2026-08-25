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
  proceduralShape: 'ring',  // 'ring' | 'noise' | 'cluster' — Circle draw mode only, see seeds/procedural.js's own header
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
  // mouseX/mouseY are OUR OWN tracked pointer position in canvas-local
  // logical coordinates (0..W, 0..H) — not p5's own p.mouseX/p.mouseY.
  // p5 computes those from the canvas's LAYOUT size (offsetWidth), which
  // a CSS zoom transform (Organica.createZoomPan) never changes — only
  // the visual box does — so p.mouseX/mouseY go wrong the moment the
  // canvas is zoomed (confirmed live: expected ~360 at a real cursor
  // position, p5 reported 582 at 115% zoom). main.js's own mousemove
  // listener keeps these correct by reading getBoundingClientRect()
  // directly, which DOES reflect the live transform.
  mouseX: 0, mouseY: 0,
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

  // ── Palette ── (Camo Turing's own Ink/Paper pairing — Membrane's
  // "Paper" is the canvas's own background fill, canvasBgRGB, since
  // there's no second duotone ink here, just marks over a ground)
  colorSrc: 'ink',           // 'ink' | 'rainbow' | 'image' | 'rmx'
  rmxColors: ['#f6e8c3', '#c15b4a', '#0a0a0a'],   // mark ink / tool identity / mark accent — an on-brand default triple
  rmxColorMap: 'tone',       // 'tone' | 'posterize' | 'random' | 'tonernd' — see color.js's own rmxColorAt
  strokeW: 0.75,
  strokeAlpha: 50,
  fillEachFrame: false,
  inkRGB: [246, 232, 195],
  accentRGB: [10, 10, 10],
  canvasBgRGB: [6, 6, 6],    // the drawing surface's own fill — p.background() target; #canvas-wrap's own CSS background is --panel (UI chrome), independent of this

  // ── Shape history — a RECORDED LIST of past frames' own curve/point
  // geometry, the same "marks[]" architecture Spore/Pollen's own SVG
  // export already uses (window._lastRenderData.marks / points[]): every
  // draw call pushes its own absolute geometry + resolved colour into a
  // plain array, and SVG export replays that array as real vector
  // elements instead of re-deriving it from a raster. Membrane's own
  // difference from Spore/Pollen is that a single frame is a MOVING
  // point/curve, not a one-shot batch of discrete marks — so this is a
  // capped, throttled RECORDING of many frames over time (render.js's
  // own pushHistory()), not a one-time render pass. See render.js's own
  // header for the entry shape and the cap/throttle constants. Cleared
  // by paintBackground() (main.js) — the single choke point for "the
  // canvas pixels got wiped", so history can never claim to represent
  // strokes that are no longer actually on screen.
  shapeHistory: [],

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
