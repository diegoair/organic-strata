// Flexible Visual System · engine/08-symbol-grid — the engine part of 08-symbol-grid.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import { hooks } from '../hooks.js';
import {
  state
} from './00-core.js';
import {
  frameDims, frameSize, median, resolveGridCells
} from './01-geometry.js';
import {
  mod360
} from './03-rules.js';
import {
  LIBRARY
} from './07-library.js';
// Two real Loom exports (captured live from /loom/, not hand-built) —
// a small Bento (7 merged rect cells) and a Hexagonal (17 polygon
// cells, the "more complex" case), both well under Loom's own
// defaults so the evaluation stays small per Diego's own instruction.
export const SYMBOL_GRID_PRESETS = {
  bento: {
    "version": "1.0", "canvas": { "width": 1080, "height": 1080, "displayWidth": 1080, "displayHeight": 1080, "unit": "px", "orientation": "landscape", "marginTop": 0, "marginRight": 0, "marginBottom": 0, "marginLeft": 0, "margin": 0, "safeArea": 0, "bleed": 0 },
    "grid": { "type": "bento", "solver": "kiwi", "params": { "cols": 3, "rows": 3, "variety": 0.35, "seed": 7 }, "gap": 0, "tracks": { "cols": [360, 360, 360], "rows": [360, 360, 360] }, "padding": 0 },
    "cells": [
      { "id": "c0", "col": 0, "row": 0, "colSpan": 2, "rowSpan": 1, "number": 1 },
      { "id": "c1", "col": 2, "row": 0, "colSpan": 1, "rowSpan": 1, "number": 2 },
      { "id": "c2", "col": 0, "row": 1, "colSpan": 1, "rowSpan": 1, "number": 3 },
      { "id": "c3", "col": 1, "row": 1, "colSpan": 1, "rowSpan": 1, "number": 4 },
      { "id": "c4", "col": 2, "row": 1, "colSpan": 1, "rowSpan": 1, "number": 5 },
      { "id": "c5", "col": 0, "row": 2, "colSpan": 2, "rowSpan": 1, "number": 6 },
      { "id": "c6", "col": 2, "row": 2, "colSpan": 1, "rowSpan": 1, "number": 7 }
    ]
  },
  hexagonal: {
    "version": "1.0", "canvas": { "width": 1080, "height": 1080, "displayWidth": 1080, "displayHeight": 1080, "unit": "px", "orientation": "landscape", "marginTop": 0, "marginRight": 0, "marginBottom": 0, "marginLeft": 0, "margin": 0, "safeArea": 0, "bleed": 0 },
    "grid": { "type": "hexagonal", "solver": "geometric", "cellShape": "polygon", "params": { "cols": 3, "rotation": 0, "spinMode": "off", "spinAmount": 20, "noiseScale": 3, "gap": 0, "jitter": 0, "seed": 7 }, "gap": 0, "padding": 0 },
    "cells": [
      { "id": "c0", "points": [[371.7691453623979, 0], [300, 124.3078061834695], [60.00000000000006, 124.30780618346952], [0, 20.384757729336854], [-6.968733952797104e-16, 0]], "centroid": [146.35382907247958, 53.80007401925518], "number": 1 },
      { "id": "c1", "points": [[1080, 0], [1080, 20.38475772933687], [1020, 124.3078061834695], [780, 124.30780618346952], [708.2308546376021, 0]], "centroid": [933.6461709275205, 53.80007401925518], "number": 2 },
      { "id": "c2", "points": [[0, 20.38475772933684], [60, 124.3078061834695], [0, 228.23085463760214]], "centroid": [20, 124.3078061834695], "number": 3 },
      { "id": "c3", "points": [[420, 332.1539030917347], [300, 540], [60.00000000000006, 540], [0, 436.07695154586736], [-7.105427357601002e-15, 228.23085463760205], [59.999999999999886, 124.3078061834695], [300, 124.30780618346947]], "centroid": [162.85714285714286, 332.1539030917347], "number": 4 },
      { "id": "c4", "points": [[708.2308546376021, 0], [780, 124.3078061834695], [660, 332.1539030917347], [420.00000000000006, 332.1539030917348], [300, 124.30780618346952], [371.7691453623979, 0]], "centroid": [540, 152.15390309173475], "number": 5 },
      { "id": "c5", "points": [[1080, 228.23085463760208], [1080, 436.07695154586736], [1020, 540], [780, 540], [660, 332.1539030917348], [779.9999999999999, 124.3078061834695], [1020, 124.30780618346947]], "centroid": [917.1428571428571, 332.1539030917347], "number": 6 },
      { "id": "c6", "points": [[1080, 228.23085463760214], [1020, 124.30780618346952], [1080, 20.384757729336897]], "centroid": [1060, 124.30780618346951], "number": 7 },
      { "id": "c7", "points": [[0, 436.07695154586736], [60, 540], [0, 643.9230484541326]], "centroid": [20, 540], "number": 8 },
      { "id": "c8", "points": [[420, 747.8460969082653], [300, 955.6921938165306], [60.00000000000006, 955.6921938165306], [0, 851.7691453623979], [-7.105427357601002e-15, 643.9230484541325], [59.999999999999886, 540], [300, 540]], "centroid": [162.85714285714286, 747.8460969082653], "number": 9 },
      { "id": "c9", "points": [[780, 540], [660, 747.8460969082653], [420.00000000000006, 747.8460969082653], [300, 540], [419.9999999999999, 332.1539030917348], [660, 332.1539030917347]], "centroid": [540, 540], "number": 10 },
      { "id": "c10", "points": [[1080, 643.9230484541326], [1080, 851.7691453623979], [1020, 955.6921938165306], [780, 955.6921938165306], [660, 747.8460969082653], [779.9999999999999, 540], [1020, 540]], "centroid": [917.1428571428571, 747.8460969082653], "number": 11 },
      { "id": "c11", "points": [[1080, 643.9230484541326], [1020, 540], [1080, 436.07695154586736]], "centroid": [1060, 540], "number": 12 },
      { "id": "c12", "points": [[0, 851.7691453623979], [60, 955.6921938165306], [0, 1059.6152422706632]], "centroid": [20, 955.6921938165306], "number": 13 },
      { "id": "c13", "points": [[371.7691453623979, 1080], [-6.408553962321293e-15, 1080], [-7.105427357601002e-15, 1059.6152422706632], [59.999999999999886, 955.6921938165306], [300, 955.6921938165306]], "centroid": [146.35382907247956, 1026.1999259807449], "number": 14 },
      { "id": "c14", "points": [[780, 955.6921938165306], [708.2308546376021, 1080], [371.7691453623979, 1080], [300, 955.6921938165306], [419.9999999999999, 747.8460969082653], [660, 747.8460969082653]], "centroid": [540, 927.8460969082653], "number": 15 },
      { "id": "c15", "points": [[1080, 1059.6152422706632], [1080, 1080], [708.2308546376021, 1080], [779.9999999999999, 955.6921938165306], [1020, 955.6921938165306]], "centroid": [933.6461709275205, 1026.1999259807449], "number": 16 },
      { "id": "c16", "points": [[1080, 1059.6152422706632], [1020, 955.6921938165306], [1080, 851.7691453623979]], "centroid": [1060, 955.6921938165306], "number": 17 }
    ]
  },
};
export function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// state.symbolGrid is the RAW Organica.loadLoomGrid() return value
// ({canvas, grid, inner, cellShape, cells}) — kept raw (not pre-wrapped
// like getGrid() does for Components) specifically so it can be fed
// straight back into Organica.loadLoomGrid() again when reloading a
// saved Symbol, with zero reconstruction. getSymbolGrid() does the same
// {kind:'loom', cellShape, cells, width, height} wrapping getGrid()
// does for Components, on demand, for resolveGridCells()/frameSize().
export function getSymbolGrid() {
  if (!state.symbolGrid) return null;
  return { kind: 'loom', cellShape: state.symbolGrid.cellShape, cells: state.symbolGrid.cells, width: state.symbolGrid.inner.width, height: state.symbolGrid.inner.height,
    canvasFrame: state.symbolGrid.canvas && state.symbolGrid.canvas.fvsFrame ? state.symbolGrid.canvas : null };
}
// Where the Symbol draws. Without a Symbol Canvas (every grid loaded or saved
// before it, and every Figure lattice) the frame is the old square
// frameSize(grid) with the grid centred — byte-identical to before. With a
// Canvas the frame IS the canvas (w × h, any proportion) and the cells sit at
// their own absolute canvas coordinates (the grid was generated inside the
// canvas margin). bx/by: where a resolveGridCells() centre (c.cx = 0) lands;
// X/Y: map a RAW cell coordinate (outline, hit shape, clip) into the frame.
export function symbolFrame(grid) {
  if (grid && grid.canvasFrame) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    grid.cells.forEach(c => {
      if (grid.cellShape === 'polygon') c.points.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      else { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x + c.width); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y + c.height); }
    });
    return { w: grid.canvasFrame.width, h: grid.canvasFrame.height, bx: (x0 + x1) / 2, by: (y0 + y1) / 2, X: v => v, Y: v => v };
  }
  const S = frameSize(grid), half = S / 2, ox = grid.width / 2, oy = grid.height / 2;
  // (half + v) − origin, in exactly the order the renderers always used, so every
  // coordinate string stays byte-identical
  return { w: S, h: S, bx: half, by: half, X: v => half + v - ox, Y: v => half + v - oy };
}
export function getFvsGrid() {
  const cfg = state.fvsGridConfig;
  const type = cfg.type;
  if (/^tier\d$/.test(type)) {
    const g = Organica.loadLoomGrid(tierLoomModel(+type[4], Math.max(20, cfg.cellSize)));
    return { kind: 'loom', tri: true, cellShape: 'polygon', cells: g.cells, width: g.inner.width, height: g.inner.height };
  }
  if (/^tri\d$/.test(type)) {
    const g = Organica.loadLoomGrid(triangleLoomModel(+type[3], Math.max(20, cfg.cellSize)));
    return { kind: 'loom', tri: true, cellShape: 'polygon', cells: g.cells, width: g.inner.width, height: g.inner.height };
  }
  const m = /^square(\d+)/.exec(type);
  const n = m ? +m[1] : 2;
  return { kind: 'square', cols: n, rows: n, cellSize: cfg.cellSize, gap: cfg.gap };
}
// A saved Component tiled directly: a throw-away 1×1 Symbol whose only cell
// holds the Component, built on the fly so nothing pollutes SYMBOL_LIBRARY.
export function componentTileEntry(name) {
  const c = LIBRARY.read()[name];
  if (!c) return null;
  return {
    gridModel: squareLoomModel(1, 1, frameSize(c.grid)),
    cells: [{ source: 'component', componentName: name, rotation: 0, flipH: false, flipV: false, scale: 1, color: null,
      fitMode: 'fill', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false }],
    colors: c.colors, colorRule: c.colorRule, paperColor: c.paperColor, clipEnabled: false, appearance: c.appearance, rule: null,
  };
}
// The Symbol being edited, offered to the Grid as it is right now — no save step
// in between (a saved copy went stale the moment the Symbol was edited).
export const LIVE_SYMBOL = '● Current symbol';
// The box a saved Symbol really draws in (its non-empty cells), in the Symbol's own frame — so a
// mirror lands on the visible edge even when a tile's outer rows are empty.
export function symbolContentBox(entry, nat) {
  if (entry.raw) return entry.raw.box;
  try {
    const g = Organica.loadLoomGrid(entry.gridModel);
    const gw = { kind: 'loom', cellShape: g.cellShape, cells: g.cells, width: g.inner.width, height: g.inner.height, canvasFrame: symbolCanvasOf(g) ? g.canvas : null };
    const cs = resolveGridCells(gw);
    const F = symbolFrame(gw), bx = (nat - F.w) / 2 + F.bx, by = (nat - F.h) / 2 + F.by;   // = nat/2 for a Symbol without a Canvas
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    cs.forEach((c, i) => {
      if (!entry.cells[i] || entry.cells[i].source === 'empty') return;
      const cw = c.cellW || c.cellSize, ch = c.cellH || c.cellSize;
      x0 = Math.min(x0, bx + c.cx - cw / 2); x1 = Math.max(x1, bx + c.cx + cw / 2);
      y0 = Math.min(y0, by + c.cy - ch / 2); y1 = Math.max(y1, by + c.cy + ch / 2);
    });
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  } catch (e) { return null; }
}
export function defaultSymbolCells(grid) {
  return resolveGridCells(grid).map((c, i) => ({
    source: 'seed', seedType: 'triangle', rotation: 0, flipH: false, flipV: false, scale: 1, color: null,
    fitMode: 'contain', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false,
  }));
}
// Old saved Symbols (fvs-symbols store) predate fitMode/fixedSize/anchor/
// padding — backfilled here so they render exactly as they did before
// this feature shipped (contain/center/0 is the old, only behaviour).
export function withPlacementDefaults(cell) {
  return {
    fitMode: 'contain', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false,
    rotation: 0, flipH: false, flipV: false, scale: 1,
    ...cell,
  };
}
// A plain cols×rows grid of equal square rect cells, in the same Loom-model
// shape as SYMBOL_GRID_PRESETS.bento so it goes through Organica.loadLoomGrid
// and every Symbol code path (rules, cellColRow, export) unchanged.
export function squareLoomModel(cols, rows, cell = 270) {
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push({ id: 'c' + (r * cols + c), col: c, row: r, colSpan: 1, rowSpan: 1, number: r * cols + c + 1 });
  }
  const W = cell * cols, H = cell * rows;
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'bento', solver: 'kiwi', params: { cols, rows, variety: 0, seed: 1 }, gap: 0, tracks: { cols: Array(cols).fill(cell), rows: Array(rows).fill(cell) }, padding: 0 },
    cells,
  };
}
// An exact triangular lattice of `n` rows (a triangle of side n): row r holds
// 2r+1 cells alternating up/down, so the silhouette is a real triangle (Loom's
// rectangular Triangular grid clips its boundary cells instead). Polygon
// cells, same model shape as Loom's own Triangular generator.
export function triangleLoomModel(n, side = 200) {
  const h = side * Math.sqrt(3) / 2, W = side * n, H = h * n;
  const cells = [];
  for (let r = 0; r < n; r++) {
    const y0 = r * h, y1 = y0 + h, left = W / 2 - (r + 1) * side / 2;
    for (let i = 0; i <= 2 * r; i++) {
      const x0 = left + i * side / 2;
      const pts = i % 2 === 0 ? [[x0, y1], [x0 + side, y1], [x0 + side / 2, y0]] : [[x0, y0], [x0 + side, y0], [x0 + side / 2, y1]];
      // placement anchor = the bbox centre, not the true centroid (h/6 apart on a triangle): a shape fitted to the cell's box must be centred on that box
      const cx = x0 + side / 2, cy = (y0 + y1) / 2;
      cells.push({ id: 'c' + cells.length, number: cells.length + 1, points: pts, centroid: [cx, cy] });
    }
  }
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'triangular', solver: 'geometric', cellShape: 'polygon', params: { rows: n }, gap: 0 },
    cells,
  };
}
// A "tier": one row of three triangles (up, down, up) forming a trapezoid, stacked
// `stack` times without lattice offset — the stepped silhouette of a tree. Same
// polygon-cell model as triangleLoomModel (bbox-centre placement anchor).
export function tierLoomModel(stack, side = 200) {
  const h = side * Math.sqrt(3) / 2, W = 2 * side, H = h * stack;
  const cells = [];
  for (let k = 0; k < stack; k++) {
    const y0 = k * h, y1 = y0 + h;
    [0, 1, 2].forEach(i => {
      const x0 = i * side / 2;
      const pts = i % 2 === 0 ? [[x0, y1], [x0 + side, y1], [x0 + side / 2, y0]] : [[x0, y0], [x0 + side, y0], [x0 + side / 2, y1]];
      cells.push({ id: 'c' + cells.length, number: cells.length + 1, points: pts, centroid: [x0 + side / 2, (y0 + y1) / 2] });
    });
  }
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'triangular', solver: 'geometric', cellShape: 'polygon', params: { tier: stack }, gap: 0 },
    cells,
  };
}
// A hexagonal lattice of `rings` rings (1, 7, 19, 37… pointy-top hexagons). Each cell knows its
// ring (distance from the centre) and its sector (0–5, clockwise from the +x axis: one corner
// cell plus the edge cells that follow it), the classes 60° poses are keyed on.
export function hexLoomModel(rings, side = 100) {
  const R = rings - 1, w = Math.sqrt(3) * side, pos = [];
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) pos.push([q, r]);
  pos.sort((a, b) => a[1] - b[1] || (a[0] + a[1] / 2) - (b[0] + b[1] / 2));
  const xy = pos.map(([q, r]) => [w * (q + r / 2), 1.5 * side * r]);
  const minX = Math.min(...xy.map(p => p[0])) - w / 2, maxX = Math.max(...xy.map(p => p[0])) + w / 2;
  const minY = Math.min(...xy.map(p => p[1])) - side, maxY = Math.max(...xy.map(p => p[1])) + side;
  const cells = xy.map(([x, y], i) => {
    const [q, r] = pos[i], ring = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
    const ang = ((Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360;
    const cx = x - minX, cy = y - minY;
    const points = [0, 1, 2, 3, 4, 5].map(k => { const a = (-90 + 60 * k) * Math.PI / 180; return [cx + side * Math.cos(a), cy + side * Math.sin(a)]; });
    return { id: 'c' + i, number: i + 1, points, centroid: [cx, cy], ring, sector: ring ? Math.floor(ang / 60 + 1e-6) % 6 : 0 };
  });
  const W = maxX - minX, H = maxY - minY;
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'hexagonal', solver: 'geometric', cellShape: 'polygon', params: { rings }, gap: 0 },
    cells,
  };
}
// Poses are multiples of 30° (0/90/180/270 for square lattices, 60° steps for hexagonal ones).
export const snapPose = n => ((Math.round(n / 30) * 30) % 360 + 360) % 360;
// 'up' when the triangle's base is its lower edge (two vertices share the max y), 'down' otherwise; null for non-triangles.
export function polyOrient(points) {
  if (!points || points.length !== 3) return null;
  const ys = points.map(p => p[1]), mx = Math.max(...ys), mn = Math.min(...ys);
  const low = ys.filter(y => Math.abs(y - mx) < 1e-6).length, high = ys.filter(y => Math.abs(y - mn) < 1e-6).length;
  return low === 2 ? 'up' : high === 2 ? 'down' : null;
}
export const SYMCANVAS_PRESETS = {   // Loom's CANVAS_PRESETS (loom/js/canvas-manager.js) + 9:16 and A3
  'Square 1:1': { w: 1080, h: 1080, unit: 'px' },
  'Portrait 4:5': { w: 1080, h: 1350, unit: 'px' },
  'Landscape 16:9': { w: 1920, h: 1080, unit: 'px' },
  'Vertical 9:16': { w: 1080, h: 1920, unit: 'px' },
  'Widescreen 3:2': { w: 1620, h: 1080, unit: 'px' },
  'A4 portrait': { w: 210, h: 297, unit: 'mm' },
  'A4 landscape': { w: 297, h: 210, unit: 'mm' },
  'A3 portrait': { w: 297, h: 420, unit: 'mm' },
  'Letter portrait': { w: 215.9, h: 279.4, unit: 'mm' },
};
export const PX_PER_MM = 96 / 25.4;
// [key, label, min, max, step, default] — or [key, label, 'text', default]. Everything
// else comes from the generator's own registry defaults; gap is 0 so cells touch
// (edge continuity needs neighbours that meet).
// Every generator is bounded so its cell count lands in the same "Symbol" band —
// above a maxed-out Component (4×4 = 16 cells) and below a Figure-scale canvas —
// roughly 25-64 cells, i.e. what a 5×5 to 8×8 square grid produces. Two generators
// (Fractal's exact 2^depth, and Figure's own hex-ring picker elsewhere) don't map
// onto a literal 5-8 slider and get their own deliberately different-looking range
// that still lands in the same cell-count band — see CLAUDE.md session note.
export const SYMGRID_GENS = {
  // Columns/Rows just pick the track COUNT (equal-width to start, same slider
  // shape as every other generator) — uneven weights are set afterward by
  // dragging the borders directly on the canvas, where a live % label above
  // each column / beside each row shows the current share. A free-text
  // "1,1,1,1,1" field asked the user to hand-author that string blind; this
  // doesn't, and it's the same generate-then-drag workflow Loom itself uses.
  rectangular: { label: 'Rectangular', params: [['cols', 'Columns', 5, 8, 1, 6], ['rows', 'Rows', 5, 8, 1, 6]] },
  bento: { label: 'Bento', params: [['cols', 'Columns', 5, 8, 1, 6], ['rows', 'Rows', 5, 8, 1, 6], ['variety', 'Variety', 0, 1, 0.05, 0.5], ['seed', 'Seed', 0, 999, 1, 7]] },
  sinusoidal: { label: 'Wave', params: [['cols', 'Columns', 5, 8, 1, 6], ['rows', 'Rows', 5, 8, 1, 6], ['amount', 'Amount', 0, 1, 0.05, 0.5], ['frequency', 'Frequency', 0.5, 6, 0.5, 2]] },
  masonry: { label: 'Masonry', params: [['cols', 'Columns', 5, 8, 1, 6], ['seed', 'Seed', 0, 999, 1, 7]] },
  hexagonal: { label: 'Hexagonal', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  triangular: { label: 'Triangular', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  diamond: { label: 'Diamond', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  circular: { label: 'Circular', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  radial: { label: 'Radial', params: [['rings', 'Rings', 5, 8, 1, 6], ['sectors', 'Sectors', 5, 8, 1, 6]] },
  organic: { label: 'Organic (Voronoi)', params: [['points', 'Cells', 25, 64, 1, 40], ['iterations', 'Relax', 0, 8, 1, 4], ['seed', 'Seed', 0, 999, 1, 7]] },
  fractal: { label: 'Fractal', params: [['depth', 'Depth', 5, 6, 1, 5], ['variance', 'Variance', 0, 0.5, 0.05, 0.2], ['seed', 'Seed', 0, 999, 1, 7]] },
  spiral: { label: 'Spiral (golden)', params: [['count', 'Cells', 25, 64, 1, 40]] },
};
// Rectangular has no cols/rows slider — column/row count is literally the number of
// comma-separated weights typed in. Clamp the track COUNT (not the weight values) to
// the same 5-8 band every other generator uses, padding/truncating as needed.
export function clampWeightTrackCount(str, min = 5, max = 8) {
  let parts = String(str).split(',').map(s => s.trim()).filter(s => s !== '');
  if (parts.length > max) parts = parts.slice(0, max);
  while (parts.length < min) parts.push('1');
  return parts.join(',');
}
// ── Cell-shape Components in a Symbol (Oct 6, 2026): every Component with a Grid shape set to Match cell shares ONE
// small-cell lattice per cell shape — its small cells snap to it, wherever the Symbol grid puts it — so neighbours
// line up exactly (lines run on, Shared cells can tell which small cell is whose). The lattice helpers:
export const SQ3 = Math.sqrt(3);
// Every aligned Component's placement, per cell index: one small-cell size per cell shape (the median of their
// Contain fits, grown by Overlap), the turn snapped to the lattice's symmetry (60°, square packing 90°; no flips),
// and the position snapped so the Component's lattice origin lands on the shared lattice — whose origin is the
// frame centre, in the Components' own (unturned) orientation.
export function alignedPlacements(grid, centers, F, lib, L) {
  const out = new Map(), groups = {};
  state.symbolCells.forEach((cell, i) => {
    if (!cell || cell.source !== 'component' || cell.fitMode !== 'match' || L.covered[i] != null || L.region[i]) return;
    const e = lib[cell.componentName], c = centers[i];
    if (!e || !e.grid || !e.grid.lattice || !c) return;
    const B = latticeBasisOf(e), d = frameDims(e.grid), nat = d.w === d.h ? frameSize(e.grid) : { w: d.w, h: d.h };
    const fit = hooks.placeInBox(c, nat, { ...withPlacementDefaults(cell), fitMode: 'contain', scale: 1, anchorX: 0, anchorY: 0, padding: 0, rotation: 0 }, hooks.cellPolygon(grid, i));
    const key = e.grid.lattice.shape + (B.square ? ':square' : '');
    (groups[key] = groups[key] || []).push({ i, e, B, c, cell, r: Math.abs(fit.scaleX) * B.R });
  });
  const grow = overlapGrowth();
  Object.values(groups).forEach(list => {
    const r = median(list.map(x => x.r)) * grow;
    list.forEach(({ i, e, B, c, cell }) => {
      const k = r / B.R, step = B.square ? 90 : 60, rot = mod360(Math.round((cell.rotation || 0) / step) * step);
      const a = rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
      const T = v => [k * (v[0] * cos - v[1] * sin), k * (v[0] * sin + v[1] * cos)];
      const cs = e.grid.cells, Cs = [cs.reduce((t, q) => t + q.centroid[0], 0) / cs.length, cs.reduce((t, q) => t + q.centroid[1], 0) / cs.length];
      const bx = F.bx + c.cx, by = F.by + c.cy, o = T([B.O[0] - Cs[0], B.O[1] - Cs[1]]), ox = bx + o[0], oy = by + o[1];
      const g1 = [B.e1[0] * k, B.e1[1] * k], g2 = [B.e2[0] * k, B.e2[1] * k], det = g1[0] * g2[1] - g1[1] * g2[0];
      const dx = ox - F.bx, dy = oy - F.by, la = Math.round((dx * g2[1] - dy * g2[0]) / det), lb = Math.round((g1[0] * dy - g1[1] * dx) / det);
      const sx = F.bx + la * g1[0] + lb * g2[0] - ox, sy = F.by + la * g1[1] + lb * g2[1] - oy;
      const fc = T([e.grid.width / 2 - Cs[0], e.grid.height / 2 - Cs[1]]);
      out.set(i, { scaleX: k, scaleY: k, offsetX: fc[0] + sx, offsetY: fc[1] + sy, rotate: rot });
    });
  });
  return out;
}
// The small-cell lattice of a saved cell-shape Component: basis e1/e2, an origin O (a cell centre, or a triangle
// corner), and how a cell is keyed (its centre, or the triangle it is).
export function latticeBasisOf(entry) {
  const L = entry.grid.lattice, c0 = entry.grid.cells[0];
  const cR = Math.max(...c0.points.map(q => Math.hypot(q[0] - c0.centroid[0], q[1] - c0.centroid[1])));
  if (L.shape === 'hexagon') return { e1: [1.5 * cR, SQ3 / 2 * cR], e2: [0, SQ3 * cR], O: c0.centroid, kind: 'centre', R: cR };
  if (L.shape === 'circle') return L.outline === 'square' ? { e1: [2 * cR, 0], e2: [0, 2 * cR], O: c0.centroid, kind: 'centre', R: cR, square: true }
    : { e1: [2 * cR, 0], e2: [cR, SQ3 * cR], O: c0.centroid, kind: 'centre', R: cR };
  const S = cR * SQ3;
  return { e1: [S, 0], e2: [S / 2, S * SQ3 / 2], O: c0.points[0], kind: 'vertex', R: cR };
}
export function latticeKeyer(B) {
  const det = B.e1[0] * B.e2[1] - B.e1[1] * B.e2[0];
  const toLat = ([x, y]) => { const dx = x - B.O[0], dy = y - B.O[1]; return [(dx * B.e2[1] - dy * B.e2[0]) / det, (B.e1[0] * dy - B.e1[1] * dx) / det]; };
  return B.kind === 'centre'
    ? c => { const [a, b] = toLat(c); return Math.round(a) + ',' + Math.round(b); }
    : c => { const [a, b] = toLat(c), fa = Math.floor(a + 1e-6), fb = Math.floor(b + 1e-6); return fa + ',' + fb + ',' + ((a - fa) + (b - fb) < 1 ? 0 : 1); };
}
export const latCart = (B, [a, b]) => [a * B.e1[0] + b * B.e2[0], a * B.e1[1] + b * B.e2[1]];
// The section: Overlap in % (each content grows past its cell; Components on the shared small-cell lattice grow
// that lattice instead, so they stay aligned). Shared cells needs aligned Components (Match cell + a Grid shape).
export function symbolHasAlignedComponents() {
  const lib = LIBRARY.read();
  return (state.symbolCells || []).some(c => c && c.source === 'component' && c.fitMode === 'match' && lib[c.componentName] && lib[c.componentName].grid && lib[c.componentName].grid.lattice);
}
// How overlaps draw on the loaded grid: null = Paper under (the drawing as before).
export function symbolLook(grid) {
  const o = state.symbolOverlap;
  if (!grid || o.blend === 'under') return null;
  if (o.blend === 'shared') return { shared: true };
  return { interleave: o.blend === 'normal', multiply: o.blend === 'multiply' };
}
// Overlap: each cell's content grows past its cell, about its own centre (aligned Components: see alignedPlacements).
export function overlapGrowth() { return 1 + Math.max(0, state.symbolOverlap.amount) / 100; }
// ── The empty Symbol: the panel's grid with every cell empty ──
export const emptySymbolCell = () => ({ source: 'empty', rotation: 0, flipH: false, flipV: false, scale: 1, color: null, fitMode: 'contain', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false });
export const symbolHasContent = () => (state.symbolCells || []).some(c => c && c.source !== 'empty');
// The floatbar Generate: fills the empty grid. Disabled (aria-disabled, so it stays focusable and its
// tooltip says why) when nothing is saved, or when the grid already has content (no Symbol undo — Clear first).
export function symbolGenerateBlock() {
  if (!state.symbolGrid) return '';   // the grid is being built; the click handler's own guard covers it
  if (symbolHasContent()) return 'Fill the grid — clear the Symbol first';
  if (!hooks.symbolSource().length) return 'Fill the grid — save an Element or a Component first';
  return '';
}
// The canvas of the loaded Symbol, if it has one (a grid generated in a Canvas).
export function symbolCanvasOf(model) { return model && model.canvas && model.canvas.fvsFrame ? model.canvas.fvsFrame : null; }
// ── The arrival, after Bencho's Generate (MIT — THIRD-PARTY-NOTICES.md) ──
// The Symbol is built whole and sharp, underneath. Over it, in the live
// preview only (never in the export — that string is built separately), goes
// a layer with one pane per cell of the grid in use: the cell's own paper,
// and on it a filtered COPY OF THE WHOLE SYMBOL cut to that cell. The whole
// Symbol, not the cell's own group: a blur that only knows one cell fades to
// nothing at the cell's edge and frames every cell in paper, where shapes
// that were drawn to meet across the edge should stay joined while they form.
// A cell arrives the way a generated image does, the large decisions first
// and the fine ones last:
//   · SHAPES. Heavily blurred and pushed hard in contrast, the cell is a few
//     clean glassy masses — where the ink is, nothing more. The contrast is
//     what makes them shapes rather than fog.
//   · FORM. The blur lets go on a slow curve and the contrast eases back to
//     the Symbol's own, so the shapes find their edges. A low drifting ripple
//     keeps the surface liquid while it happens.
// Contrast turns about the PAPER rather than mid-grey: about 0.5 the paper
// went to white and the card was a glowing sheet that snapped back at the
// end. About the paper, the ground holds and the ink deepens. With no paper
// (transparent) the same slope goes on the alpha instead.
// The filter is identity by the time a pane leaves, so leaving shows nothing.
// Cells start `step` apart, in a scattered order; `step` is the sweep
// divided by the cell count (clamped), so a 4-cell grid does not crawl and a
// 200-cell one does not take ten seconds. One rAF loop for all of them, and
// it parks itself when the last cell has landed. Lengths are Bencho's, in
// screen pixels, converted to the svg's user units at the start.
export const GEN_ARRIVE = { cell: 1000, sweep: 1200, stepMin: 4, stepMax: 60, blur: 20, contrast: 2.4, ripple: 50 };
// Mirrors Trellis's refCellSize() (trellis/index.html) — a sensible starting
// size for newly-"Fixed" content, so switching TO fixed doesn't leave every
// cell's content looking randomly sized. getSymbolGrid(), not state.symbolGrid
// directly — resolveGridCells() expects the resolved {cells,cellShape,...}
// shape getSymbolGrid() returns, same as cellOverflowInfo() already does.
export function symbolMedianCellSize() {
  const grid = getSymbolGrid();
  if (!grid) return 100;
  const cells = resolveGridCells(grid);
  return cells.length ? Math.round(median(cells.map(c => Math.min(c.cellW, c.cellH)))) || 100 : 100;
}
export const fitTargetIndices = () => (state.symbolSelection.size ? [...state.symbolSelection] : state.symbolCells.map((_, i) => i)).filter(i => state.symbolCells[i]);
// The label names the target; a button is pressed only when EVERY target cell holds that value (mixed = none).
// What a Fit button would write into a cell — the one definition the buttons and their enabled state share.
export function fitPatch(fitMode) {
  const patch = { fitMode };
  if (fitMode === 'fixed') patch.fixedSize = symbolMedianCellSize();
  if (fitMode === 'cover') patch.coverAxis = 'auto';   // a fresh Cover always starts from the safe, guaranteed-no-gaps baseline
  return patch;
}
// The natural size a cell's content is placed with (as buildSymbolItems does): 100 for a Seed,
// the Component's own frame otherwise. null = nothing to place (Empty, or a missing Component).
export function cellNaturalSize(cell, lib) {
  if (!cell || cell.source === 'empty') return null;
  if (cell.source !== 'component') return 100;
  const entry = lib[cell.componentName];
  if (!entry) return null;
  const nd = frameDims(entry.grid);
  return nd.w === nd.h ? frameSize(entry.grid) : { w: nd.w, h: nd.h };
}
export const samePlacement = (a, b) => ['scaleX', 'scaleY', 'offsetX', 'offsetY'].every(k => Math.abs(a[k] - b[k]) < 1e-6);
