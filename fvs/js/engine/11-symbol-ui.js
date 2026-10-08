// Flexible Visual System · engine/11-symbol-ui — the engine part of 11-symbol-ui.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  DEFAULT_COLOR_RULE, pc, pr, pv, state
} from './00-core.js';
import {
  frameDims, frameSize, resolveGridCells
} from './01-geometry.js';
import {
  appearanceSnapshot, withAppearance
} from './04-appearance.js';
import {
  r2
} from './05-render-component.js';
import {
  LIBRARY
} from './07-library.js';
import {
  getSymbolGrid, symbolFrame
} from './08-symbol-grid.js';
import {
  buildSymbolItems, buildSymbolSVG, cellOverflowInfo, symbolCellBoxes, symbolSpanLayout
} from './09-symbol-render.js';
import { hooks, provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  SYMBOL_LIBRARY: () => SYMBOL_LIBRARY, buildSymbolLibraryEntry: () => buildSymbolLibraryEntry,
  cellColRow: () => cellColRow, snap90: () => snap90
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
export function ruleScaleChoices() {
  const lo = parseInt(pv('rg-rule-scale-min'), 10) / 100;
  const hi = parseInt(pv('rg-rule-scale-max'), 10) / 100;
  return [lo, 1, hi];
}
export const SYMBOL_RULES = {
  oscillator: {
    fields: [{ id: 'sel-rule-osc-angle', key: 'angle', type: 'int' }, { id: 'rg-rule-osc-shift', key: 'shift', type: 'float' },
      { id: 'rg-rule-osc-period', key: 'period', type: 'int' }, { id: 'rg-rule-osc-phase', key: 'phase', type: 'int' }],
    fn: (ctx, p) => ({
      rotation: (((ctx.col + Math.floor(p.shift * ctx.row)) % p.period + p.period) % p.period === p.phase % p.period) ? p.angle : 0,
    }),
  },
  checkerboard: {
    fields: [{ id: 'sel-rule-chk-rota', key: 'rotA', type: 'int' }, { id: 'chk-rule-chk-swap', key: 'swap', type: 'bool' },
      { id: 'sel-rule-chk-rot', key: 'rotB', type: 'int' }, { id: 'chk-rule-chk-flip', key: 'flip', type: 'bool' }],
    fn: (ctx, p) => {
      // Defaults (rotA 0, no swap) reproduce the original A-even / B-odd result exactly.
      const odd = ((ctx.col + ctx.row + (p.swap ? 1 : 0)) % 2) === 1;
      if (!odd) return { rotation: p.rotA || 0, flipH: false, flipV: false };
      return p.flip ? { rotation: 0, flipH: true, flipV: false } : { rotation: p.rotB, flipH: false, flipV: false };
    },
  },
  orientation: {
    fields: [{ id: 'sel-rule-ori-up', key: 'up', type: 'str' }, { id: 'sel-rule-ori-down', key: 'down', type: 'str' }],
    fn: (ctx, p) => {
      if (!ctx.orient) return {};
      const mode = ctx.orient === 'up' ? p.up : p.down;
      return { empty: mode === 'empty', turn: ctx.orient === 'down' ? 180 : 0 };
    },
  },
  rows: {
    fields: [{ id: 'rg-rule-rows-step', key: 'step', type: 'int' }, { id: 'sel-rule-rows-mode', key: 'mode', type: 'str' }],
    fn: (ctx, p) => ({ rotation: p.mode === 'ramp' ? snap90(p.step * ctx.row) : p.step * (ctx.row % 2) }),
  },
  columns: {
    fields: [{ id: 'rg-rule-cols-step', key: 'step', type: 'int' }, { id: 'sel-rule-cols-mode', key: 'mode', type: 'str' }],
    fn: (ctx, p) => ({ rotation: p.mode === 'ramp' ? snap90(p.step * ctx.col) : p.step * (ctx.col % 2) }),
  },
  radial: {
    fields: [{ id: 'chk-rule-radial-snap', key: 'snap', type: 'bool' }, { id: 'sel-rule-radial-chir', key: 'chir', type: 'int' }],
    fn: (ctx, p) => {
      const deg = (ctx.angle * 180 / Math.PI) * p.chir;
      return { rotation: p.snap ? snap90(deg) : deg };
    },
  },
  wave: {
    fields: [{ id: 'rg-rule-wave-amp', key: 'amp', type: 'int' }, { id: 'rg-rule-wave-freq', key: 'freq', type: 'float' },
      { id: 'rg-rule-wave-phase', key: 'phase', type: 'int' }, { id: 'chk-rule-wave-snap', key: 'snap', type: 'bool' }],
    fn: (ctx, p) => {
      const v = p.amp * Math.sin(p.freq * (ctx.nx + ctx.ny) * Math.PI + p.phase * Math.PI / 180);
      return { rotation: p.snap ? snap90(v) : v };
    },
  },
  random: {
    fields: [],
    fn: (ctx, p, rng) => ({
      rotation: [0, 90, 180, 270][Math.floor(rng() * 4)],
      flipH: rng() < 0.5, flipV: rng() < 0.5,
      scale: ruleScaleChoices()[Math.floor(rng() * 3)],
    }),
  },
};
// Each rule's params are described once by `fields` — {id: the Symbol step's control, key, type} — and read()
// is derived from them, so another editor (Compose) can build the same controls from the same list.
const readField = f => f.type === 'bool' ? pc(f.id) : f.type === 'int' ? parseInt(pv(f.id), 10) : f.type === 'float' ? parseFloat(pv(f.id)) : pv(f.id);
Object.values(SYMBOL_RULES).forEach(r => { r.read = () => Object.fromEntries(r.fields.map(f => [f.key, readField(f)])); });
// Same technique as buildGridOutlineSVG (preview-only, never inside
// buildSymbolSVG), a second colour, only the currently-selected cells —
// Manual mode's own visual feedback for what a Cell properties edit is
// about to apply to.
export function buildSelectionOutlineSVG() {
  const grid = getSymbolGrid();
  if (!grid || state.symbolSelection.size === 0) return '';
  const F = symbolFrame(grid);
  let s = '<g fill="none" stroke="#ff3d7f" stroke-width="2.5">';
  const L = symbolSpanLayout(grid, state.symbolCells);
  grid.cells.forEach((c0, i) => {
    if (!state.symbolSelection.has(i) || L.covered[i] != null) return;
    const c = L.region[i] ? L.region[i].raw : c0;
    if (grid.cellShape === 'polygon') {
      const pts = c.points.map(p => `${F.X(p[0]).toFixed(2)},${F.Y(p[1]).toFixed(2)}`).join(' ');
      s += `<polygon points="${pts}"/>`;
    } else {
      const x = F.X(c.x), y = F.Y(c.y);
      s += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${c.width.toFixed(2)}" height="${c.height.toFixed(2)}"/>`;
    }
  });
  return s + '</g>';
}
// An EMPTY cell draws nothing, so buildSymbolSVG gives it no <g data-cell-index> and a click or a drop
// found nothing to land on (after Delete / Choose → Empty / removing a Component, those cells were dead).
// Preview-only invisible hit shape per empty cell — never in the export.
export function buildEmptyCellHitsSVG() {
  const grid = getSymbolGrid();
  if (!grid || !state.symbolCells.some(c => c && c.source === 'empty')) return '';
  const F = symbolFrame(grid);
  let s = '';
  const L = symbolSpanLayout(grid, state.symbolCells);
  // The guides toggle governs every helper line: off = a clean sheet (the cells still answer hover / a drag).
  // On a track grid the guides already draw the inner borders, so the empty cells add only the outer frame;
  // on any other grid (hex, triangle, Voronoi…) each empty cell is outlined.
  const tracks = !!symbolTrackGrid(), outlined = state.symbolView.guides && !tracks, cls = outlined ? 'is-empty is-outlined' : 'is-empty';
  if (state.symbolView.guides && tracks) { const g = symbolTrackGrid(); s += `<rect class="sym-empty-frame" x="${F.X(g.inner.x).toFixed(2)}" y="${F.Y(g.inner.y).toFixed(2)}" width="${g.inner.width.toFixed(2)}" height="${g.inner.height.toFixed(2)}"/>`; }
  grid.cells.forEach((c, i) => {
    const cell = state.symbolCells[i]; if (!cell || cell.source !== 'empty' || L.covered[i] != null) return;   // a covered cell belongs to its block
    if (grid.cellShape === 'polygon') s += `<g class="${cls}" data-cell-index="${i}"><polygon points="${c.points.map(p => `${F.X(p[0]).toFixed(2)},${F.Y(p[1]).toFixed(2)}`).join(' ')}" fill="transparent"/></g>`;
    else s += `<g class="${cls}" data-cell-index="${i}"><rect x="${F.X(c.x).toFixed(2)}" y="${F.Y(c.y).toFixed(2)}" width="${c.width.toFixed(2)}" height="${c.height.toFixed(2)}" fill="transparent"/></g>`;
  });
  return s;
}
// Only meaningful while a border drag is actually happening — see the
// `if (trackDrag)` gate at its one call site in renderSymbolCanvasOnly().
// Skipped while Clip to cell is on, same guard cellOverflowInfo()'s own
// docs already state (clipping already makes the question moot).
export function buildOverflowOutlineSVG() {
  const grid = getSymbolGrid();
  if (!grid || state.symbolClipEnabled) return '';
  const F = symbolFrame(grid);
  const resolvedCells = symbolCellBoxes(grid), L = symbolSpanLayout(grid, state.symbolCells);
  let s = '<g fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-dasharray="5 3">';
  grid.cells.forEach((c0, i) => {
    if (!cellOverflowInfo(i, resolvedCells)) return;
    const c = L.region[i] ? L.region[i].raw : c0;
    if (grid.cellShape === 'polygon') {
      const pts = c.points.map(p => `${F.X(p[0]).toFixed(2)},${F.Y(p[1]).toFixed(2)}`).join(' ');
      s += `<polygon points="${pts}"/>`;
    } else {
      const x = F.X(c.x), y = F.Y(c.y);
      s += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${c.width.toFixed(2)}" height="${c.height.toFixed(2)}"/>`;
    }
  });
  return s + '</g>';
}
// A light, un-cropped preview of what Cover is scaling to, regardless of
// drag state — complements buildOverflowOutlineSVG (which only reacts to a
// genuine surprise, and is silent for auto-Cover on purpose). Box position/
// size read straight off buildSymbolItems()'s own resolved cx/cy/scale — the
// same values the real render uses — rather than re-deriving symbolFrame()'s
// coordinate math by hand (it has two different conventions depending on
// whether the grid has a canvasFrame, and buildSymbolItems() is the one
// place that already reconciles them correctly). Rotation ignored
// (axis-aligned box), same disclosed approximation cellOverflowInfo()/
// symbolCellBounds() already use elsewhere. Most useful while Clip to cell
// is on — that's exactly when the crop is otherwise invisible.
export function buildCoverCropPreviewSVG() {
  const grid = getSymbolGrid();
  if (!grid || !state.symbolClipEnabled) return '';
  const library = LIBRARY.read();
  const items = buildSymbolItems();
  let s = '<g fill="none" stroke="var(--tool)" stroke-width="1" stroke-dasharray="2 2" opacity="0.6">';
  state.symbolCells.forEach((cell, i) => {
    if (cell.fitMode !== 'cover') return;
    const it = items[i];
    if (!it || it.type === 'missing') return;
    let natural = 100;
    if (cell.source === 'component') {
      const entry = library[cell.componentName];
      if (!entry) return;
      const nd = frameDims(entry.grid);
      natural = nd.w === nd.h ? frameSize(entry.grid) : { w: nd.w, h: nd.h };
    }
    const itemW = (natural.w || natural) * Math.abs(it.scaleX);
    const itemH = (natural.h || natural) * Math.abs(it.scaleY);
    s += `<rect x="${(it.cx - itemW / 2).toFixed(2)}" y="${(it.cy - itemH / 2).toFixed(2)}" width="${itemW.toFixed(2)}" height="${itemH.toFixed(2)}"/>`;
  });
  return s + '</g>';
}
export function readRuleState() {
  const s = {};
  RULE_CONTROL_IDS.forEach(id => { s[id] = pr(id); });
  return s;
}
export function buildSymbolLibraryEntry() {
  if (!state.symbolGrid) return null;
  return {
    gridModel: state.symbolGrid,
    cells: state.symbolCells.map(c => ({ ...c })),
    colors: state.colors.slice(),
    colorRule: { ...state.colorRule },
    paperColor: state.paperColor,
    clipEnabled: state.symbolClipEnabled,
    overlap: { ...state.symbolOverlap },
    appearance: appearanceSnapshot(),
    rule: readRuleState(),
    pool: state.symbolPool.map(p => ({ ...p })),   // was "palette" — renamed to avoid clashing with the colour Palette; `applySymbolLibraryEntryToUI` still reads the old key too
    arrange: { rule: pv('sel-sym-arrange'), fit: pv('sel-sym-arrange-fit'), seed: pv('num-symbol-seed') },
    savedAt: new Date().toISOString(),
  };
}
// A saved Symbol's thumbnail, drawn against the ENTRY's own saved state, not the live one —
// same rule as the Components' own library thumbnails.
export function symbolEntryThumbSVG(entry) {
  const prev = { grid: state.symbolGrid, cells: state.symbolCells, colors: state.colors, rule: state.colorRule, paper: state.paperColor, clip: state.symbolClipEnabled, overlap: state.symbolOverlap };
  state.symbolGrid = Organica.loadLoomGrid(entry.gridModel);
  state.symbolCells = entry.cells;
  state.colors = entry.colors;
  state.colorRule = entry.colorRule || DEFAULT_COLOR_RULE;
  state.paperColor = entry.paperColor;
  state.symbolClipEnabled = entry.clipEnabled !== false;
  state.symbolOverlap = { amount: 0, blend: 'under', drawnBy: 'nearest', ...(entry.overlap || {}) };
  const svgStr = withAppearance(entry.appearance, buildSymbolSVG);
  state.symbolGrid = prev.grid; state.symbolCells = prev.cells; state.colors = prev.colors; state.colorRule = prev.rule; state.paperColor = prev.paper; state.symbolClipEnabled = prev.clip; state.symbolOverlap = prev.overlap;
  return svgStr;
}
export function buildSymbolPrintSVG(F, cv) {
  const d = symbolPrintDims(F, cv);
  const bw = d.trimWmm + 2 * d.bleedMm, bh = d.trimHmm + 2 * d.bleedMm;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(bw)}mm" height="${r2(bh)}mm" viewBox="0 0 ${r2(bw)} ${r2(bh)}">`
    + `<rect width="${r2(bw)}" height="${r2(bh)}" fill="${state.paperColor}"/>`
    + `<g transform="translate(${r2(d.bleedMm)},${r2(d.bleedMm)})"><g transform="scale(${d.k})">${hooks.svgInnerOf(buildSymbolSVG())}</g>`;
  if (d.bleedMm > 0) out += Organica.printSize.cropMarksSVG(d.trimWmm, d.trimHmm, {}, '#000');
  return out + '</g></svg>';
}
