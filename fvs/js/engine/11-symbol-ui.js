// Flexible Visual System · engine/11-symbol-ui — the engine part of 11-symbol-ui.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  state
} from './00-core.js';
import {
  resolveGridCells
} from './01-geometry.js';
import {
  getSymbolGrid, symbolFrame
} from './08-symbol-grid.js';
import { provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  cellColRow: () => cellColRow
});
// Per-cell {col,row,cols,rows,cx,cy,nx,ny,angle,index,count} parallel to
// state.symbolCells. Rect Loom cells carry col/row in their JSON; polygon
// cells don't, so their centroids are binned into row/column bands. Thin
// wrapper over shared/shapes.js's version (moved there for Trellis) — feeds
// it the FVS-specific state (symbolGrid's own raw cells + grid meta) its
// generic signature takes as explicit args instead of reaching for directly.
export function cellColRow(grid) {
  return Organica.shapes.cellColRow(grid, state.symbolGrid && state.symbolGrid.cells, state.symbolGrid && state.symbolGrid.grid);
}
export const snap90 = deg => ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
// Preview-only wireframe of the loaded grid's own cell boundaries — never
// baked into buildSymbolSVG()/drawSymbolCanvas() (export stays pure
// content, same rule Loom's own "Background grid" toggle already
// follows). Reuses the EXACT same origin/half offset resolveGridCells()
// and buildSymbolItems() already use, so the outline lines up exactly
// with whatever is actually rendered in each cell, rect or polygon.
export function buildGridOutlineSVG() {
  const grid = getSymbolGrid();
  if (!grid) return '';
  const F = symbolFrame(grid);
  let s = '<g fill="none" stroke="#3399ff" stroke-width="1.5">';
  if (grid.cellShape === 'polygon') {
    for (const c of grid.cells) {
      const pts = c.points.map(p => `${F.X(p[0]).toFixed(2)},${F.Y(p[1]).toFixed(2)}`).join(' ');
      s += `<polygon points="${pts}"/>`;
    }
  } else {
    for (const c of grid.cells) {
      const x = F.X(c.x), y = F.Y(c.y);
      s += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${c.width.toFixed(2)}" height="${c.height.toFixed(2)}"/>`;
    }
  }
  return s + '</g>';
}
// One axis-aligned box per cell, in the same space — reuses the already-
// resolved cellW/cellH (Fill mode's own addition to resolveGridCells)
// rather than any new grid math. An approximation for hexagon/polygon
// cells (their bounding box, not their exact outline), same notion of
// "cell size" this feature already uses elsewhere.
export function symbolCellBounds() {
  const grid = getSymbolGrid();
  if (!grid) return [];
  const F = symbolFrame(grid);
  return resolveGridCells(grid).map((c, i) => ({
    index: i, x: F.bx + c.cx - c.cellW / 2, y: F.by + c.cy - c.cellH / 2, w: c.cellW, h: c.cellH,
  }));
}
export function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
// Plain click (no movement) selects — or opens Choose content on a cell that is
// already selected; movement past a small threshold switches to a live marquee
// instead — same moved-past-a-few-pixels-means-a-drag distinction
// Creator's own old draw-mode click handler used (downPt/moved). mouseup
// is bound on window, not the frame, so releasing outside the canvas
// while dragging still ends the drag cleanly rather than leaving it stuck.
// ── Drag the column / row borders of a rectangular Symbol grid ──
// Any rect grid that carries Loom tracks (Rectangular, Bento, Wave, a plain
// square…) shows a handle on each inner border. Dragging moves the border: the
// two tracks on either side trade size, the total stays the same, and the cells
// keep their content (only the tracks change; the grid is re-resolved from
// them). On the Rectangular generator the Column / Row weights fields follow
// live, so the grid regenerates to the same proportions.
export const TRACK_MIN_FRAC = 0.04;   // a track never shrinks below 4% of the grid's side
export function symbolTrackGrid() {
  const g = state.symbolGrid;
  if (!g || g.cellShape !== 'rect' || !g.grid || !g.grid.tracks || !g.grid.tracks.cols || !g.grid.tracks.rows) return null;
  return g;
}
export function trackBorders(axis) {
  const g = symbolTrackGrid();
  const sizes = g.grid.tracks[axis], gap = g.grid.gap || 0, start = axis === 'cols' ? g.inner.x : g.inner.y;
  const out = [];
  let acc = start;
  for (let i = 0; i < sizes.length - 1; i++) { acc += sizes[i] + gap; out.push(acc - gap / 2); }
  return out;
}
// Every track's own band (start/end in raw coords) + its % share of the axis
// total — the live readout drawn above each column / beside each row so a
// drag has real feedback instead of a blind border.
export function trackBands(axis) {
  const g = symbolTrackGrid();
  if (!g) return [];
  const sizes = g.grid.tracks[axis], gap = g.grid.gap || 0, start = axis === 'cols' ? g.inner.x : g.inner.y;
  const total = sizes.reduce((a, b) => a + b, 0);
  const out = [];
  let acc = start;
  for (let i = 0; i < sizes.length; i++) {
    out.push({ start: acc, end: acc + sizes[i], pct: Math.round(sizes[i] / total * 100) });
    acc += sizes[i] + gap;
  }
  return out;
}
// sizes → the weights text the Rectangular generator reads ("1.25,0.75,1"), mean 1
export function tracksToWeights(sizes) {
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  return sizes.map(v => String(Math.round(v / mean * 100) / 100)).join(',');
}
// Batch-edit: writes `patch` (or the result of calling `patch` with the
// existing cell, for edits that depend on the cell's current value) into
// every currently-selected cell, then re-renders the canvas only — the
// panel's own controls don't need to rebuild themselves on every edit,
// only the rendered result changes.
// Writes a patch into a cell and says whether anything actually changed (a click on "Stretch" when every cell
// already is Fill is not an edit — it must not arm the leave-site prompt).
export function patchCell(cell, patch) {
  const p = typeof patch === 'function' ? patch(cell) : patch;
  let changed = false;
  for (const k of Object.keys(p)) if (JSON.stringify(cell[k]) !== JSON.stringify(p[k])) { changed = true; break; }
  Object.assign(cell, p);
  return changed;
}
export const ANCHOR_POSITIONS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
// ── Symbol library — a SEPARATE store from Components' own LIBRARY
// ('fvs' key): a Symbol snapshot is a grid + heterogeneous per-cell
// fill, not one Seed repeated, so it doesn't belong in the same
// list. state.symbolGrid is stored verbatim as gridModel (see
// getSymbolGrid()'s own comment — it's already re-import-able as-is). ──
export const SYMBOL_LIBRARY = Organica.presetStore('fvs-symbols');
// The whole rule block's control values, so a saved Symbol re-opens with
// its generator intact and re-tunable (cells are also stored resolved, so
// this is purely additive — an old entry without `rule` still loads).
export const RULE_CONTROL_IDS = ['sel-symbol-fill', 'sel-symbol-rule', 'sel-rule-ori-up', 'sel-rule-ori-down',
  'sel-rule-osc-angle', 'rg-rule-osc-shift', 'rg-rule-osc-period', 'rg-rule-osc-phase',
  'sel-rule-chk-rota', 'chk-rule-chk-swap', 'sel-rule-chk-rot', 'chk-rule-chk-flip', 'rg-rule-rows-step', 'sel-rule-rows-mode',
  'rg-rule-cols-step', 'sel-rule-cols-mode', 'chk-rule-radial-snap', 'sel-rule-radial-chir',
  'rg-rule-wave-amp', 'rg-rule-wave-freq', 'rg-rule-wave-phase', 'chk-rule-wave-snap',
  'chk-rule-rotation', 'chk-rule-flip', 'chk-rule-scale', 'rg-rule-scale-min', 'rg-rule-scale-max',
  'num-rule-seed'];
// A Print canvas exports at its own physical size: SVG in mm with the bleed
// (paper extended into it) and crop marks; PNG at the canvas DPI with the DPI
// written into the file. Same v1 discipline as the rest of the suite
// (shared/print-size.js) — the bleed is a flat paper extension.
export function symbolPrintDims(F, cv) {
  const mm = v => v * (cv.unit === 'in' ? 25.4 : 1);
  const trimWmm = mm(cv.pw), trimHmm = mm(cv.ph), bleedMm = cv.bleed || 0;
  const px = v => Math.round(Organica.printSize.mmToPx(v, cv.dpi));
  return { trimWmm, trimHmm, bleedMm, dpi: cv.dpi, trimWpx: px(trimWmm), trimHpx: px(trimHmm), bleedPx: px(bleedMm), k: trimWmm / F.w };
}
