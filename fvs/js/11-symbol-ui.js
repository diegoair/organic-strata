// Flexible Visual System · 11-symbol-ui — Symbol UI — rule layer, overlays, renderSymbol, track drag, cell properties, Symbol library + export.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import { rt } from './rt.js';
import {
  DEFAULT_COLOR_RULE, buildPalette, ctrl, entryInkAt, ruleInk, setStatus, state, symbolCR, syncColorRuleUI
} from './00-core.js';
import {
  SEED_TYPES, frameDims, frameSize, resolveGridCells
} from './01-geometry.js';
import {
  SYMBOL_SEED_DEFAULTS, getSeed, seedForSnapshot
} from './02-seed-ui.js';
import {
  fitThumbBox, mulberry32
} from './03-rules.js';
import {
  appearanceSnapshot, applyAppearanceToUI, buildComponentItems, withAppearance
} from './04-appearance.js';
import {
  buildSeedPreviewSVG, r2, seedPreviewStates, withEntryInks
} from './05-render-component.js';
import {
  elementIsEmpty
} from './06-component-ui.js';
import {
  LIBRARY, buildComponentSVGWithPaper, fillPaper, hexKey, libraryNames
} from './07-library.js';
import {
  applySymbolCanvasToUI, getSymbolGrid, polyOrient, symbolCanvasOf, symbolFrame, symbolHasContent,
  syncFitAnchorUI, syncOverlapSection, syncSymbolStart, withPlacementDefaults
} from './08-symbol-grid.js';
import {
  buildSymbolItems, buildSymbolSVG, cellOverflowInfo, drawSymbolCanvas, symbolCellBoxes, symbolSpanLayout
} from './09-symbol-render.js';
import {
  renderSuggestGallery, renderSymbolPool
} from './10-suggest.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  ANCHOR_POSITIONS: () => ANCHOR_POSITIONS, SYMBOL_LIBRARY: () => SYMBOL_LIBRARY,
  applyToAllCells: () => applyToAllCells, applyToSelection: () => applyToSelection,
  buildSymbolLibraryEntry: () => buildSymbolLibraryEntry, cellColRow: () => cellColRow,
  renderCellPropertiesPanel: () => renderCellPropertiesPanel, renderSymbol: () => renderSymbol,
  renderSymbolCanvasOnly: () => renderSymbolCanvasOnly, renderSymbolLibrary: () => renderSymbolLibrary,
  snap90: () => snap90
});
// ─────────────────────────────────────────────────────────────
// GENERATIVE RULE LAYER — fill every cell's transform from a rule + a
// few params, N×M-general (Components' own FAMILIES are 2×2-only). The
// Truchet reference (bookofshapes concentric_arc_truchet_3) is the
// "oscillator" rule: rotation 0/90 from (col + rowShift·row) parity.
// Content (source/seedType/componentName/fit/anchor/padding) is never
// touched — only rotation/flipH/flipV/scale, and only the axes ticked
// in "Vary". Locked cells are skipped unless resetAll.
// ─────────────────────────────────────────────────────────────

// Per-cell {col,row,cols,rows,cx,cy,nx,ny,angle,index,count} parallel to
// state.symbolCells. Rect Loom cells carry col/row in their JSON; polygon
// cells don't, so their centroids are binned into row/column bands. Thin
// wrapper over shared/shapes.js's version (moved there for Trellis) — feeds
// it the FVS-specific state (symbolGrid's own raw cells + grid meta) its
// generic signature takes as explicit args instead of reaching for directly.
export function cellColRow(grid) {
  return Organica.shapes.cellColRow(grid, state.symbolGrid && state.symbolGrid.cells, state.symbolGrid && state.symbolGrid.grid);
}

export function ruleScaleChoices() {
  const lo = parseInt(ctrl('rg-rule-scale-min').value, 10) / 100;
  const hi = parseInt(ctrl('rg-rule-scale-max').value, 10) / 100;
  return [lo, 1, hi];
}
export const snap90 = deg => ((Math.round(deg / 90) * 90) % 360 + 360) % 360;

export const SYMBOL_RULES = {
  oscillator: {
    read: () => ({
      angle: parseInt(ctrl('sel-rule-osc-angle').value, 10),
      shift: parseFloat(ctrl('rg-rule-osc-shift').value),
      period: parseInt(ctrl('rg-rule-osc-period').value, 10),
      phase: parseInt(ctrl('rg-rule-osc-phase').value, 10),
    }),
    fn: (ctx, p) => ({
      rotation: (((ctx.col + Math.floor(p.shift * ctx.row)) % p.period + p.period) % p.period === p.phase % p.period) ? p.angle : 0,
    }),
  },
  checkerboard: {
    read: () => ({ rotA: parseInt(ctrl('sel-rule-chk-rota').value, 10), swap: ctrl('chk-rule-chk-swap').checked,
      rotB: parseInt(ctrl('sel-rule-chk-rot').value, 10), flip: ctrl('chk-rule-chk-flip').checked }),
    fn: (ctx, p) => {
      // Defaults (rotA 0, no swap) reproduce the original A-even / B-odd result exactly.
      const odd = ((ctx.col + ctx.row + (p.swap ? 1 : 0)) % 2) === 1;
      if (!odd) return { rotation: p.rotA || 0, flipH: false, flipV: false };
      return p.flip ? { rotation: 0, flipH: true, flipV: false } : { rotation: p.rotB, flipH: false, flipV: false };
    },
  },
  orientation: {
    read: () => ({ up: ctrl('sel-rule-ori-up').value, down: ctrl('sel-rule-ori-down').value }),
    fn: (ctx, p) => {
      if (!ctx.orient) return {};
      const mode = ctx.orient === 'up' ? p.up : p.down;
      return { empty: mode === 'empty', turn: ctx.orient === 'down' ? 180 : 0 };
    },
  },
  rows: {
    read: () => ({ step: parseInt(ctrl('rg-rule-rows-step').value, 10), mode: ctrl('sel-rule-rows-mode').value }),
    fn: (ctx, p) => ({ rotation: p.mode === 'ramp' ? snap90(p.step * ctx.row) : p.step * (ctx.row % 2) }),
  },
  columns: {
    read: () => ({ step: parseInt(ctrl('rg-rule-cols-step').value, 10), mode: ctrl('sel-rule-cols-mode').value }),
    fn: (ctx, p) => ({ rotation: p.mode === 'ramp' ? snap90(p.step * ctx.col) : p.step * (ctx.col % 2) }),
  },
  radial: {
    read: () => ({ snap: ctrl('chk-rule-radial-snap').checked, chir: parseInt(ctrl('sel-rule-radial-chir').value, 10) }),
    fn: (ctx, p) => {
      const deg = (ctx.angle * 180 / Math.PI) * p.chir;
      return { rotation: p.snap ? snap90(deg) : deg };
    },
  },
  wave: {
    read: () => ({
      amp: parseInt(ctrl('rg-rule-wave-amp').value, 10),
      freq: parseFloat(ctrl('rg-rule-wave-freq').value),
      phase: parseInt(ctrl('rg-rule-wave-phase').value, 10),
      snap: ctrl('chk-rule-wave-snap').checked,
    }),
    fn: (ctx, p) => {
      const v = p.amp * Math.sin(p.freq * (ctx.nx + ctx.ny) * Math.PI + p.phase * Math.PI / 180);
      return { rotation: p.snap ? snap90(v) : v };
    },
  },
  random: {
    read: () => ({}),
    fn: (ctx, p, rng) => ({
      rotation: [0, 90, 180, 270][Math.floor(rng() * 4)],
      flipH: rng() < 0.5, flipV: rng() < 0.5,
      scale: ruleScaleChoices()[Math.floor(rng() * 3)],
    }),
  },
};

export function applySymbolRule(opts) {
  opts = opts || {};
  const grid = getSymbolGrid();
  if (!grid || !state.symbolCells.length) return;
  const name = ctrl('sel-symbol-rule').value;
  const rule = SYMBOL_RULES[name];
  if (!rule) return;
  const ctxs = cellColRow(grid);
  const rng = mulberry32(parseInt(ctrl('num-rule-seed').value, 10) || 0);
  const params = rule.read();
  const vary = {
    rotation: ctrl('chk-rule-rotation').checked,
    flip: ctrl('chk-rule-flip').checked,
    scale: ctrl('chk-rule-scale').checked,
  };
  const rawCells = (state.symbolGrid && state.symbolGrid.cells) || [];
  state.symbolCells.forEach((cell, i) => {
    if (!opts.resetAll && cell.locked) return;
    const raw = rawCells[i];
    const t = rule.fn({ ...ctxs[i], orient: raw && raw.points ? polyOrient(raw.points) : null }, params, rng);
    // Content-level results (the Orientation rule): a hole, or a filled cell turned to face its lattice slot.
    if (t.empty != null) {
      if (t.empty) cell.source = 'empty';
      // Only a genuinely empty cell needs a fresh default shape to become
      // visible again — a cell that already holds a Component or a Seed
      // keeps its own content; this used to force ANY non-'seed' cell
      // (i.e. every Component cell) to a plain Triangle seed on every
      // single run, silently discarding the Component reference each time
      // the rule was re-applied.
      else { if (cell.source === 'empty') { cell.source = 'seed'; cell.seedType = cell.seedType || 'triangle'; } cell.fitMode = 'fill'; cell.rotation = t.turn || 0; }
      return;
    }
    if (vary.rotation && t.rotation != null) cell.rotation = snap90(t.rotation);
    if (vary.flip) {
      if (t.flipH != null) cell.flipH = t.flipH;
      if (t.flipV != null) cell.flipV = t.flipV;
    }
    if (vary.scale && t.scale != null) cell.scale = t.scale;
  });
  renderSymbol();
}

export function syncSymbolRuleUI() {
  const name = ctrl('sel-symbol-rule').value;
  document.querySelectorAll('#symbol-rule-block .rule-params').forEach(el => {
    el.style.display = el.id === 'rp-' + name ? '' : 'none';
  });
  ctrl('row-rule-scalerange').style.display = ctrl('chk-rule-scale').checked ? '' : 'none';
}

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

export function renderSymbolCanvasOnly() {
  const frame = ctrl('symbol-frame');
  const grid = getSymbolGrid();
  ctrl('btn-symbol-clear').style.display = grid ? '' : 'none';
  ctrl('btn-symbol-clear').disabled = !symbolHasContent();   // an empty grid: the icon stays, disabled (nothing to clear)
  syncSymbolStart();
  if (!grid) {
    // No grid yet: the empty grid is being built from the panel (buildEmptySymbolGrid, on entering the step).
    frame.innerHTML = '';
    ctrl('symbol-cellcount-hint').textContent = '0 cells';
    setStatus('', 'No symbol grid loaded');
    return;
  }
  const count = resolveGridCells(grid).length;
  ctrl('symbol-cellcount-hint').textContent = count + (count === 1 ? ' cell' : ' cells');
  let svg = buildSymbolSVG();
  let overlay = buildEmptyCellHitsSVG();
  if (state.symbolView.outline) overlay += buildGridOutlineSVG();
  overlay += buildSelectionOutlineSVG();
  if (state.symbolView.guides) overlay += buildTrackHandlesSVG();
  if (trackDrag) overlay += buildOverflowOutlineSVG();
  if (state.symbolView.cover) overlay += buildCoverCropPreviewSVG();
  if (state.symbolMarqueeRect) {
    const r = state.symbolMarqueeRect;
    overlay += `<rect class="symbol-marquee" x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}"/>`;
  }
  if (overlay) svg = svg.replace('</svg>', overlay + '</svg>');
  const F = symbolFrame(grid);
  frame.style.setProperty('--sym-ar', (F.w / F.h).toFixed(5));   // the sheet's box takes the canvas's proportions (see #symbol-frame svg)
  frame.innerHTML = svg;
  renderTrackLabelsOverlay();
  // …and once more when this step's layout has settled. A render can run while
  // the Suggest strip above is momentarily empty: the frame is then taller, the
  // labels are measured against that, and the strip is refilled before the
  // browser paints — so the frame ends at its old size, the ResizeObserver
  // (which compares sizes between frames) never fires, and the labels stay
  // where the sheet was. Found on wide canvases, where the sheet re-centres.
  cancelAnimationFrame(trackLabelsRaf);
  trackLabelsRaf = requestAnimationFrame(renderTrackLabelsOverlay);
  setStatus('active', `Symbol · ${count} cells`);
}
export let trackLabelsRaf = 0;

export function renderSymbol() {
  syncOverlapSection();   // Shared cells follows whether aligned Components are in the Symbol
  renderSymbolCanvasOnly();
  if (ctrl('sel-symbol-fill').value === 'manual' || state.symbolSelection.size) renderCellPropertiesPanel();
  else { syncManualBlock(); syncFitAnchorUI(); }
}

// Click-to-select on the rendered Symbol itself (Strata's Refine editor
// uses the same click-a-shape-on-canvas convention) — delegated on
// #symbol-frame, which survives every re-render (only its innerHTML is
// replaced), so this binds exactly once rather than being re-attached
// per render. Plain click selects just this cell (a click on a selected cell opens Choose content);
// ⌘/Ctrl-click (or Shift-click) toggles this cell into/out of a multi-cell selection.
// Mouse position → the SVG's own internal 0..size coordinate space (same
// technique Creator's old draw-mode artLoc() used) — needed both for a
// plain click (was it inside a cell?) and for the marquee rectangle,
// which is defined in that same space so it lines up with the cells it's
// meant to be selecting.
export function svgPointFromEvent(e) {
  const svg = ctrl('symbol-frame').querySelector('svg');
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: loc.x, y: loc.y };
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
export function buildTrackHandlesSVG() {
  const g = symbolTrackGrid();
  if (!g) return '';
  const grid = getSymbolGrid(), F = symbolFrame(grid);
  const hitW = Math.max(6, 0.012 * Math.max(F.w, F.h)), lw = Math.max(1, 0.002 * Math.max(F.w, F.h));
  const x0 = F.X(g.inner.x), x1 = F.X(g.inner.x + g.inner.width), y0 = F.Y(g.inner.y), y1 = F.Y(g.inner.y + g.inner.height);
  let s = '';
  trackBorders('cols').forEach((b, i) => {
    const x = F.X(b);
    s += `<g class="sym-track${trackDrag && trackDrag.axis === 'cols' && trackDrag.i === i ? ' is-dragging' : ''}" data-axis="cols" data-track="${i}"><rect class="sym-track__hit" x="${(x - hitW / 2).toFixed(2)}" y="${y0.toFixed(2)}" width="${hitW.toFixed(2)}" height="${(y1 - y0).toFixed(2)}"/><line class="sym-track__line" x1="${x.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y1.toFixed(2)}" stroke-width="${lw}"/></g>`;
  });
  trackBorders('rows').forEach((b, i) => {
    const y = F.Y(b);
    s += `<g class="sym-track${trackDrag && trackDrag.axis === 'rows' && trackDrag.i === i ? ' is-dragging' : ''}" data-axis="rows" data-track="${i}"><rect class="sym-track__hit" x="${x0.toFixed(2)}" y="${(y - hitW / 2).toFixed(2)}" width="${(x1 - x0).toFixed(2)}" height="${hitW.toFixed(2)}"/><line class="sym-track__line" x1="${x0.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y.toFixed(2)}" stroke-width="${lw}"/></g>`;
  });
  return s;
}
// % labels — one above each column, one left of each row, genuinely OUTSIDE
// the canvas. These are real HTML elements (a sibling overlay div, not SVG
// <text>), because "outside" has to survive the SVG's own preserveAspectRatio
// letterboxing: the viewBox (F.w × F.h, always the canvas's own square/
// rectangle) rarely matches #symbol-frame's own box exactly, so the browser
// centres it inside with extra space on one axis — a fixed SVG-user-space
// offset cleared the constrained axis fine but fell well short on the
// letterboxed one (a small negative x still landed inside the visible
// canvas whenever the frame was wider than the canvas itself). Measuring the
// SVG's REAL rendered rect after it's in the DOM and mapping through that
// gives the correct answer regardless of the frame's own proportions, and
// lets the labels use real design-system tokens directly (--fs-micro,
// --w-light) instead of a canvas-size-scaled approximation.
export function renderTrackLabelsOverlay() {
  const old = document.getElementById('sym-track-labels');
  if (old) old.remove();
  if (!state.symbolView.guides) return;
  const g = symbolTrackGrid();
  if (!g) return;
  const frame = ctrl('symbol-frame'), svgEl = frame.querySelector('svg');
  if (!svgEl) return;
  const grid = getSymbolGrid(), F = symbolFrame(grid);
  const svgR = svgEl.getBoundingClientRect(), frameR = frame.getBoundingClientRect();
  const scale = Math.min(svgR.width / F.w, svgR.height / F.h);
  const offX = svgR.left - frameR.left + (svgR.width - F.w * scale) / 2;
  const offY = svgR.top - frameR.top + (svgR.height - F.h * scale) / 2;
  // Gap between the label and the true canvas edge — --space-4 (10px), read
  // live rather than hardcoded so it tracks the token if it ever changes.
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-4')) || 10;
  const wrap = document.createElement('div');
  wrap.id = 'sym-track-labels';
  wrap.className = 'sym-track-labels';
  trackBands('cols').forEach(band => {
    const el = document.createElement('div');
    el.className = 'sym-track-label sym-track-label--col';
    el.style.left = (offX + F.X((band.start + band.end) / 2) * scale).toFixed(1) + 'px';
    el.style.top = (offY - gap).toFixed(1) + 'px';
    el.textContent = band.pct + '%';
    wrap.appendChild(el);
  });
  trackBands('rows').forEach(band => {
    const el = document.createElement('div');
    el.className = 'sym-track-label sym-track-label--row';
    el.style.left = (offX - gap).toFixed(1) + 'px';
    el.style.top = (offY + F.Y((band.start + band.end) / 2) * scale).toFixed(1) + 'px';
    el.textContent = band.pct + '%';
    wrap.appendChild(el);
  });
  frame.appendChild(wrap);
}
// sizes → the weights text the Rectangular generator reads ("1.25,0.75,1"), mean 1
export function tracksToWeights(sizes) {
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  return sizes.map(v => String(Math.round(v / mean * 100) / 100)).join(',');
}
// Move border i of `axis` to raw coordinate `pos`; the grid is re-resolved, cells untouched.
export function moveTrackBorder(axis, i, pos) {
  const g = symbolTrackGrid();
  if (!g) return;
  const sizes = g.grid.tracks[axis].slice(), gap = g.grid.gap || 0;
  const start = (axis === 'cols' ? g.inner.x : g.inner.y) + sizes.slice(0, i).reduce((a, b) => a + b + gap, 0);
  const pair = sizes[i] + sizes[i + 1];
  const min = Math.max(1, TRACK_MIN_FRAC * sizes.reduce((a, b) => a + b, 0));
  const a = Math.min(pair - min, Math.max(min, pos - start - gap / 2));
  sizes[i] = a; sizes[i + 1] = pair - a;
  const tracks = { ...g.grid.tracks, [axis]: sizes };
  const grid = { ...g.grid, tracks };
  const frame = g.canvas && g.canvas.fvsFrame;
  const key = axis === 'cols' ? 'colWeights' : 'rowWeights';
  if (grid.type === 'rectangular') {
    grid.params = { ...(grid.params || {}), [key]: tracksToWeights(sizes) };
    if (frame && frame.params) frame.params = { ...frame.params, [key]: grid.params[key] };
    if (ctrl('sel-symgrid-gen').value === 'rectangular' && ctrl('symgen-' + key)) ctrl('symgen-' + key).value = grid.params[key];
  }
  state.symbolGrid = Organica.loadLoomGrid({ ...g, grid });
}
export let trackDrag = null;   // {axis, i} while a border is being dragged
export function bindSymbolTrackDrag() {
  const frame = ctrl('symbol-frame');
  // capture phase: a border drag must not also start a marquee selection
  frame.addEventListener('mousedown', e => {
    const h = e.button === 0 && e.target.closest && e.target.closest('.sym-track');
    if (!h) return;
    e.preventDefault(); e.stopImmediatePropagation();
    trackDrag = { axis: h.dataset.axis, i: +h.dataset.track };
    frame.classList.add('is-resizing-' + trackDrag.axis);
    renderSymbolCanvasOnly();
  }, true);
  window.addEventListener('mousemove', e => {
    if (!trackDrag) return;
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    const F = symbolFrame(getSymbolGrid());
    // frame → raw coordinates: invert F.X / F.Y (both are v + constant)
    const pos = trackDrag.axis === 'cols' ? pt.x - (F.X(0)) : pt.y - (F.Y(0));
    moveTrackBorder(trackDrag.axis, trackDrag.i, pos);
    renderSymbolCanvasOnly();
  });
  window.addEventListener('mouseup', () => {
    if (!trackDrag) return;
    frame.classList.remove('is-resizing-' + trackDrag.axis);
    trackDrag = null;
    state.symbolSuggestions = []; renderSuggestGallery();   // variations were drawn for the old proportions
    renderSymbol();
  }, true);
}

export function bindSymbolCanvasSelection() {
  const frame = ctrl('symbol-frame');
  const THRESHOLD = 5;
  let dragStart = null, dragMoved = false, dragBase = [];
  const addKey = e => e.metaKey || e.ctrlKey || e.shiftKey;   // ⌘ (Ctrl on Windows) or Shift: add to / remove from the selection

  frame.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    e.preventDefault(); // no native text/seed drag while marquee-selecting
    dragStart = pt;
    dragMoved = false;
    dragBase = addKey(e) ? Array.from(state.symbolSelection) : [];
  });

  frame.addEventListener('mousemove', e => {
    if (!dragStart) return;
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    if (!dragMoved && Math.hypot(pt.x - dragStart.x, pt.y - dragStart.y) > THRESHOLD) dragMoved = true;
    if (!dragMoved) return;
    const rect = {
      x: Math.min(dragStart.x, pt.x), y: Math.min(dragStart.y, pt.y),
      w: Math.abs(pt.x - dragStart.x), h: Math.abs(pt.y - dragStart.y),
    };
    state.symbolMarqueeRect = rect;
    const hits = symbolCellBounds().filter(c => rectsIntersect(rect, c)).map(c => c.index);
    state.symbolSelection = new Set([...dragBase, ...hits]);
    renderSymbolCanvasOnly();
    renderCellPropertiesPanel();
  });

  window.addEventListener('mouseup', e => {
    if (!dragStart) return;
    const wasDrag = dragMoved;
    dragStart = null; dragMoved = false;
    if (wasDrag) {
      // A drag is for building a multi-selection to batch-edit — it
      // deliberately never opens the content overlay on its own.
      state.symbolMarqueeRect = null;
      renderSymbolCanvasOnly();
      return;
    }
    const el = e.target.closest && e.target.closest('[data-cell-index]');
    if (!el) {
      // Click outside any cell (the canvas's own paper background) clears
      // the selection — same convention as Strata's Refine editor, which
      // this feature was explicitly modelled on. A plain click missing
      // this was a real gap, not just an unhandled case: with a selection
      // already active, clicking empty canvas silently left it in place.
      if (!addKey(e) && state.symbolSelection.size > 0) {
        state.symbolSelection.clear();
        renderSymbolCanvasOnly();
        renderCellPropertiesPanel();
      }
      return;
    }
    const i = parseInt(el.getAttribute('data-cell-index'), 10);
    if (addKey(e)) {
      state.symbolSelection.has(i) ? state.symbolSelection.delete(i) : state.symbolSelection.add(i);
      renderSymbolCanvasOnly();
      renderCellPropertiesPanel();
    } else {
      // A plain click SELECTS; a click on a cell that is already selected (alone or in a
      // group — so also the second click of a double-click) opens Choose content for the
      // whole selection. Selecting a cell to change its Fit, Anchor or turn must not pop
      // the content picker in the way.
      const again = state.symbolSelection.has(i);
      if (!again) {
        state.symbolSelection.clear();
        state.symbolSelection.add(i);
      }
      renderSymbolCanvasOnly();
      renderCellPropertiesPanel();
      if (again) openCellContentOverlay();
    }
  });
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
export function applyToSelection(patch) {
  let changed = false;
  state.symbolSelection.forEach(i => {
    const cell = state.symbolCells[i];
    if (!cell) return;
    if (patchCell(cell, patch)) changed = true;
  });
  if (changed) Organica.dirty.set('fvs-symbol', true);   // hand-edited cells live only in memory until saved to the Symbol library
  renderSymbolCanvasOnly();
}

export const ANCHOR_POSITIONS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
// Replaces the old one-row-per-cell list entirely: ONE shared panel that
// reflects/edits whatever is currently selected (state.symbolSelection).
// The panel markup itself is static HTML (see index.html) — no rebuild
// per selection change, only values get synced, so a control never loses
// focus mid-edit the way rebuilding used to risk.
// Content (Source/Type/Component) is picked entirely through the overlay
// now — no docked <select> trio to keep in sync with it, which is exactly
// what used to risk drifting (a dropdown AND an overlay both able to set
// the same fields). The docked panel just reflects the result: a plain
// text readout plus the Choose… button that reopens the overlay.
// Colour: "Follow palette" (color null) or an explicit override — a palette
// colour or a free one. Only Seed cells carry a colour (a nested Component
// keeps its own inks).
export function syncCellColourUI(cell, isComponent) {
  ctrl('row-cellprop-color').style.display = isComponent ? 'none' : '';
  if (isComponent) { ctrl('row-cellprop-color-override').style.display = 'none'; return; }
  const sel = ctrl('sel-cellprop-color');
  const pal = state.colors.map(hexKey);
  const cur = cell.color ? hexKey(cell.color) : '';
  const custom = cur && !pal.includes(cur);
  sel.innerHTML = `<option value="">Follow palette</option>`
    + pal.map((c, i) => `<option value="${c}">Palette ${i + 1} · ${c}</option>`).join('')
    + `<option value="custom">Custom…</option>`;
  sel.value = !cur ? '' : custom ? 'custom' : cur;
  const inp = ctrl('in-cellprop-color');
  inp.style.display = custom ? '' : 'none';
  if (custom) inp.value = cur;
  ctrl('row-cellprop-color-override').style.display = cur ? '' : 'none';
}
// Cell properties belong to the selection, not to the Fill mode: the block
// shows in Manual, and in any other mode as soon as cells are selected.
export function syncManualBlock() {
  ctrl('symbol-manual-block').style.display = (ctrl('sel-symbol-fill').value === 'manual' || state.symbolSelection.size > 0) ? '' : 'none';
}
export function renderCellPropertiesPanel() {
  syncManualBlock();
  syncFitAnchorUI();
  const hasSelection = state.symbolSelection.size > 0 && state.symbolGrid;
  ctrl('symbol-cell-empty').style.display = hasSelection ? 'none' : '';
  ctrl('symbol-cell-props').style.display = hasSelection ? '' : 'none';
  if (!hasSelection) return;
  const n = state.symbolSelection.size;
  ctrl('symbol-cellprop-count').textContent = `${n} cell${n === 1 ? '' : 's'}`;

  const first = state.symbolCells[Math.min(...state.symbolSelection)];
  const isComponent = first.source === 'component';

  let label = '—';
  if (isComponent) {
    const exists = first.componentName && LIBRARY.read()[first.componentName];
    label = first.componentName ? (exists ? first.componentName + (first.colourway ? ' · recoloured' : '') : `⚠ ${first.componentName} (missing)`) : '—';
  } else if (first.source === 'empty') {
    label = 'Empty';
  } else if (first.seedType && SEED_TYPES[first.seedType]) {
    label = SEED_TYPES[first.seedType].label;
  }
  ctrl('symbol-cellprop-content-label').textContent = label;

  // Rotation/Flip are hidden entirely for Component cells — a saved
  // Component is already an internally-composed (often symmetric)
  // arrangement, so rotating/flipping the whole nested block as one more
  // knob adds little real value against the extra control surface.
  ctrl('row-cellprop-rotation').style.display = isComponent ? 'none' : '';
  ctrl('row-cellprop-flip').style.display = isComponent ? 'none' : '';
  ctrl('sel-cellprop-rot').value = String(first.rotation);
  ctrl('sel-cellprop-flip').value = first.flipH && first.flipV ? 'hv' : first.flipH ? 'h' : first.flipV ? 'v' : 'none';
  ctrl('sel-cellprop-fit').value = first.fitMode || 'contain';
  ctrl('row-cellprop-coveraxis').style.display = first.fitMode === 'cover' ? '' : 'none';
  ctrl('sel-cellprop-coveraxis').value = first.coverAxis || 'auto';
  ctrl('row-cellprop-scale').style.display = first.fitMode === 'fixed' ? 'none' : '';
  ctrl('row-cellprop-fixedsize').style.display = first.fitMode === 'fixed' ? '' : 'none';
  ctrl('rg-cellprop-scale').value = Math.round((first.scale == null ? 1 : first.scale) * 100);
  ctrl('v-cellprop-scale').textContent = ctrl('rg-cellprop-scale').value;
  ctrl('rg-cellprop-fixedsize').value = first.fixedSize || 100;
  ctrl('v-cellprop-fixedsize').textContent = ctrl('rg-cellprop-fixedsize').value;
  syncCellColourUI(first, isComponent);
  ctrl('row-cellprop-seedparams').style.display = (isComponent || first.source === 'empty') ? 'none' : '';
  ctrl('symbol-cellprop-seedparams-label').textContent = first.seedParams ? 'Element settings' : 'Default';
  ctrl('rg-cellprop-padding').value = Math.round((first.padding || 0) * 100);
  ctrl('v-cellprop-padding').textContent = ctrl('rg-cellprop-padding').value;
  ctrl('chk-cellprop-lock').checked = !!first.locked;

  const firstIndex = Math.min(...state.symbolSelection);
  const overflowing = !state.symbolClipEnabled && cellOverflowInfo(firstIndex);
  ctrl('row-cellprop-overflow').style.display = overflowing ? '' : 'none';
}

// ── Choose-content overlay — opened by a plain click on a cell (or the
// docked panel's own Choose… button for a ⌘-click/drag-built multi-
// selection). Picking a tile applies the same fresh defaults regardless
// of source type (scale 100%, Fill, no padding, centred anchor) — a
// predictable clean slate every time content is assigned, not whatever
// the previously-selected cell happened to have. ──
export function openCellContentOverlay() {
  if (state.symbolSelection.size === 0 && !ctrl('chk-content-overlay-all').checked) return;
  renderCellContentOverlayTiles();
  ctrl('symbol-content-overlay').style.display = 'flex';
  const first = ctrl('symbol-content-overlay').querySelector('button.fvs-library-item, button#btn-content-overlay-close');
  if (first) first.focus();
}
export function openCellContentOverlayForAll() {
  if (!state.symbolGrid) return;
  ctrl('chk-content-overlay-all').checked = true;
  openCellContentOverlay();
}
// Write a content patch to every cell (used when "Apply to all cells" is
// armed) — the sibling of applyToSelection().
export function applyToAllCells(patch) {
  let changed = false;
  state.symbolCells.forEach(cell => {
    if (!cell) return;
    if (patchCell(cell, patch)) changed = true;
  });
  if (changed) Organica.dirty.set('fvs-symbol', true);
  renderSymbolCanvasOnly();
}
export function contentTarget() { return ctrl('chk-content-overlay-all').checked ? applyToAllCells : applyToSelection; }

// Choose-content filter — which of the two lists to show (memory only).
rt.contentFilter = 'all';
export function syncContentFilter() {
  ctrl('content-sec-seeds').style.display = rt.contentFilter === 'components' ? 'none' : '';
  ctrl('content-sec-components').style.display = rt.contentFilter === 'seeds' ? 'none' : '';
  ctrl('seg-content-filter').querySelectorAll('.seg-btn').forEach(b => {
    const on = b.dataset.filter === rt.contentFilter;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
export function closeCellContentOverlay() {
  ctrl('symbol-content-overlay').style.display = 'none';
  ctrl('chk-content-overlay-all').checked = false;   // disarm so a later single-cell edit isn't hijacked
}

// The overlay fills the selected cell(s) with a Component or Empty — a Symbol is built from saved
// Components only, so the raw Seeds are no longer offered; old Symbols with Seed cells still render.
// Which fitMode fresh content picked from this overlay gets — sticky for the
// session (same convention as contentFilter below), not reset on close: a
// deliberate visible choice, unlike "Apply to all cells" which IS reset
// (that one guards against an accidental bulk edit; this one doesn't carry
// that risk — a wrong fit is obvious immediately and easy to redo).
rt.contentOverlayFit = 'fill';
export function renderCellContentOverlayTiles() {
  const toAll = ctrl('chk-content-overlay-all').checked;
  const count = state.symbolSelection.size;
  ctrl('symbol-content-overlay__title').textContent = toAll ? 'Choose content for all cells' : count > 1 ? `Choose content for ${count} cells` : 'Choose content';

  const elWrap = ctrl('symbol-content-overlay__seeds');
  elWrap.innerHTML = '';
  const emptyBtn = document.createElement('button');
  emptyBtn.className = 'fvs-library-item';
  emptyBtn.title = 'Empty — leave the cell blank';
  emptyBtn.setAttribute('aria-label', 'Use Empty (blank cell)');
  emptyBtn.innerHTML = '<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="10" y="10" width="52" height="52" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 4"/></svg>';
  emptyBtn.addEventListener('click', () => {
    contentTarget()(() => ({ source: 'empty', rotation: 0, flipH: false, flipV: false, fitMode: rt.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0 }));
    closeCellContentOverlay();
    renderCellPropertiesPanel();
  });
  elWrap.appendChild(emptyBtn);
  ['arc', 'arctruchet', 'blob', 'chevron', 'circle', 'cross', 'drop', 'lens', 'polygon', 'roundedrect', 'star', 'triangle', 'wedge'].forEach(type => {   // alphabetical (UI only — generateSymbolCells' seeded seedTypes array is deliberately NOT reordered)
    const svgStr = buildSeedPreviewSVG({ type, ...SYMBOL_SEED_DEFAULTS }, 0, false, false, 72);
    const btn = document.createElement('button');
    btn.className = 'fvs-library-item';
    btn.title = SEED_TYPES[type].label;
    btn.setAttribute('aria-label', 'Use ' + SEED_TYPES[type].label);
    btn.innerHTML = svgStr;
    btn.addEventListener('click', () => {
      contentTarget()(cell => ({
        source: 'seed', seedType: type, color: cell.color || null,
        rotation: 0, flipH: false, flipV: false,
        fitMode: rt.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0,
      }));
      closeCellContentOverlay();
      renderCellPropertiesPanel();
    });
    elWrap.appendChild(btn);
  });

  const library = LIBRARY.read();
  const libNames = libraryNames(library);
  ctrl('symbol-content-overlay__components-empty').style.display = libNames.length ? 'none' : '';
  const compWrap = ctrl('symbol-content-overlay__components');
  compWrap.innerHTML = '';
  compWrap.appendChild(emptyBtn);
  for (const name of libNames) {
    const entry = library[name];
    const size = frameDims(entry.grid);
    // Entry's own saved colours/paper, not the live Palette — same rule
    // renderLibrary()'s own thumbnails already follow.
    const savedColorAt = entryInkAt(entry);
    const items = buildComponentItems({ cells: entry.component.cells }, entry.grid)
      .map((it, j) => ({ ...it, color: savedColorAt(j) }));
    const svgStr = withEntryInks(entry.colors, () => buildComponentSVGWithPaper(items, entry.seed, size, entry.paperColor, entry.role, entry.underlyingComponentName, entry.blend));
    const btn = document.createElement('button');
    btn.className = 'fvs-library-item';
    const box = fitThumbBox(size.w, size.h, 76);
    btn.style.width = box.w + 'px'; btn.style.height = box.h + 'px';
    btn.title = name;
    btn.setAttribute('aria-label', 'Use Component ' + name);
    btn.innerHTML = svgStr;
    btn.addEventListener('click', () => {
      contentTarget()({
        source: 'component', componentName: name, span: true, colourway: null,   // a rectangular Component takes its block where it fits
        rotation: 0, flipH: false, flipV: false,
        fitMode: rt.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0,
      });
      closeCellContentOverlay();
      renderCellPropertiesPanel();
    });
    const item = document.createElement('div');
    const cap = document.createElement('span');
    cap.className = 'fvs-library-caption';
    cap.textContent = name;
    item.append(btn, cap);
    compWrap.appendChild(item);
  }
  // The Element itself as cell content: as it is, and in the six states of the Element
  // step's own preview strip. The cell keeps the Element's settings as they are now
  // (seedParams, like Cell properties → Use Element) and the turn / flip of the tile.
  const elSec = ctrl('content-sec-element'), elTiles = ctrl('symbol-content-overlay__element');
  elTiles.innerHTML = '';
  elSec.style.display = elementIsEmpty() ? 'none' : '';
  if (!elementIsEmpty()) {
    const live = getSeed();
    [[0, false, false, 'As it is'], ...seedPreviewStates().slice(1)].forEach(([r, fh, fv, label]) => {   // the strip's own 0° is "As it is" here
      const btn = document.createElement('button');
      btn.className = 'fvs-library-item';
      btn.title = 'Element · ' + label;
      btn.setAttribute('aria-label', 'Use the Element — ' + label);
      btn.innerHTML = buildSeedPreviewSVG(live, r, fh, fv, 72);
      btn.addEventListener('click', () => {
        const sp = JSON.parse(JSON.stringify(seedForSnapshot()));
        // A layer that follows the cell colour would take a different ink in every cell (the Symbol's
        // colour rule) and vanish wherever that ink is also another layer's own. Here it is pinned to
        // the ink the Element step shows it in — the palette's first — so every cell shows all layers.
        if (sp.type === 'stack') sp.layers.forEach(l => { if (l.ink == null || l.ink === 'cell') l.ink = 0; });
        contentTarget()(cell => ({
          source: 'seed', seedType: sp.type, seedParams: JSON.parse(JSON.stringify(sp)), color: cell.color || null, ownColors: null, ownPaper: null, ownAppearance: null, colourway: null,
          rotation: r, flipH: fh, flipV: fv,
          fitMode: rt.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0,
        }));
        closeCellContentOverlay();
        renderCellPropertiesPanel();
      });
      const item = document.createElement('div');
      const cap = document.createElement('span');
      cap.className = 'fvs-library-caption';
      cap.textContent = label;
      item.append(btn, cap);
      elTiles.appendChild(item);
    });
  }
  // The plain default Seeds are not Symbol content any more: that list and the filter stay hidden.
  ctrl('content-sec-seeds').style.display = 'none';
  ctrl('seg-content-filter').style.display = 'none';
  Organica.autoLabelPanel(ctrl('symbol-content-overlay'));
}

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
export function readRuleState() {
  const s = {};
  RULE_CONTROL_IDS.forEach(id => { const el = ctrl(id); s[id] = el.type === 'checkbox' ? el.checked : el.value; });
  return s;
}
export function applyRuleState(s) {
  if (!s) return;
  RULE_CONTROL_IDS.forEach(id => {
    if (s[id] == null) return;
    const el = ctrl(id);
    if (el.type === 'checkbox') el.checked = !!s[id]; else el.value = s[id];
    const v = ctrl(id.replace(/^rg-/, 'v-')); if (v && el.type === 'range') v.textContent = el.value;
  });
  ctrl('symbol-rule-block').style.display = ctrl('sel-symbol-fill').value === 'rule' ? '' : 'none';
  ctrl('symbol-generate-block').style.display = ctrl('sel-symbol-fill').value === 'generate' ? '' : 'none';
  ctrl('symbol-suggest-block').style.display = ctrl('sel-symbol-fill').value === 'suggest' ? '' : 'none';
  syncManualBlock();
  syncSymbolRuleUI();
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
    arrange: { rule: ctrl('sel-sym-arrange').value, fit: ctrl('sel-sym-arrange-fit').value, seed: ctrl('num-symbol-seed').value },
    savedAt: new Date().toISOString(),
  };
}

export function saveSymbolAs(chosen) {
  const entry = buildSymbolLibraryEntry();
  if (!entry) return;
  const all = SYMBOL_LIBRARY.read();
  let name = chosen;
  for (let i = 2; all[name]; i++) name = `${chosen} (${i})`;
  all[name] = entry;
  SYMBOL_LIBRARY.write(all);
  Organica.dirty.set('fvs-symbol', false);
  renderSymbolLibrary();
}
export function removeSymbolLibraryEntry(name) {
  const all = SYMBOL_LIBRARY.read();
  delete all[name];
  SYMBOL_LIBRARY.write(all);
  renderSymbolLibrary();
}

export function applySymbolLibraryEntryToUI(entry) {
  state.symbolGrid = Organica.loadLoomGrid(entry.gridModel);
  if (symbolCanvasOf(state.symbolGrid)) applySymbolCanvasToUI(symbolCanvasOf(state.symbolGrid));
  if (entry.pool || entry.palette) { state.symbolPool = (entry.pool || entry.palette).map(p => ({ ...p })); renderSymbolPool(); }
  if (entry.arrange) { ctrl('sel-sym-arrange').value = entry.arrange.rule; ctrl('sel-sym-arrange-fit').value = entry.arrange.fit; ctrl('num-symbol-seed').value = entry.arrange.seed; }
  state.symbolCells = entry.cells.map(c => withPlacementDefaults({ ...c }));
  Organica.dirty.set('fvs-symbol', false);   // a loaded saved Symbol matches the library
  state.symbolSelection.clear();
  state.colors = entry.colors.map(hexKey);
  state.colorRule = { ...DEFAULT_COLOR_RULE, ...(entry.colorRule || {}) };
  syncColorRuleUI();
  // Older saves pinned each cell to its palette colour — release those pins
  // (cellInk) so the palette drives them; genuinely different colours stay.
  state.symbolCells.forEach((c, i) => { if (c.color && String(c.color).toLowerCase() === String(ruleInk(i, symbolCR())).toLowerCase()) c.color = null; });
  buildPalette();
  state.paperColor = hexKey(entry.paperColor);
  hooks.setPaperUI(entry.paperColor);
  // Old saved Symbols (pre-Clip-to-cell) have no clipEnabled field — back-
  // filled to true, matching withPlacementDefaults' own convention of
  // restoring exactly the pre-feature behaviour for anything not saved.
  state.symbolClipEnabled = entry.clipEnabled !== false;
  hooks.syncSymbolViewUI();
  state.symbolOverlap = { amount: 0, blend: 'under', drawnBy: 'nearest', ...(entry.overlap || {}) };
  syncOverlapSection();
  applyAppearanceToUI(entry.appearance);
  applyRuleState(entry.rule);
  renderSymbol();
}

export function renderSymbolLibrary() { hooks.renderLibraryRail(); }
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

export function exportSymbol(format) {
  const grid = getSymbolGrid();
  if (!grid) return;
  const F = symbolFrame(grid);
  const cv = symbolCanvasOf(state.symbolGrid);
  if (cv && cv.mode === 'print') { exportSymbolPrint(format, F, cv); return; }
  if (format === 'svg') {
    Organica.download(new Blob([buildSymbolSVG()], { type: 'image/svg+xml' }), Organica.stamp('fvs-symbol', 'svg'));
    return;
  }
  const scale = parseInt(ctrl('sel-export-scale').value, 10);
  const off = document.createElement('canvas');
  off.width = Math.round(F.w * scale); off.height = Math.round(F.h * scale);
  const ctx = off.getContext('2d');
  ctx.save();
  ctx.scale(scale, scale);
  drawSymbolCanvas(ctx);
  ctx.restore();
  off.toBlob(blob => { Organica.download(blob, Organica.stamp('fvs-symbol', 'png')); });
}

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
export function buildSymbolPrintSVG(F, cv) {
  const d = symbolPrintDims(F, cv);
  const bw = d.trimWmm + 2 * d.bleedMm, bh = d.trimHmm + 2 * d.bleedMm;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(bw)}mm" height="${r2(bh)}mm" viewBox="0 0 ${r2(bw)} ${r2(bh)}">`
    + `<rect width="${r2(bw)}" height="${r2(bh)}" fill="${state.paperColor}"/>`
    + `<g transform="translate(${r2(d.bleedMm)},${r2(d.bleedMm)})"><g transform="scale(${d.k})">${hooks.svgInnerOf(buildSymbolSVG())}</g>`;
  if (d.bleedMm > 0) out += Organica.printSize.cropMarksSVG(d.trimWmm, d.trimHmm, {}, '#000');
  return out + '</g></svg>';
}
export function exportSymbolPrint(format, F, cv) {
  if (format === 'svg') {
    Organica.download(new Blob([buildSymbolPrintSVG(F, cv)], { type: 'image/svg+xml' }), Organica.stamp('fvs-symbol', 'svg'));
    return;
  }
  const d = symbolPrintDims(F, cv);
  const off = document.createElement('canvas');
  off.width = d.trimWpx + 2 * d.bleedPx; off.height = d.trimHpx + 2 * d.bleedPx;
  const ctx = off.getContext('2d');
  fillPaper(ctx, state.paperColor, 0, 0, off.width, off.height);
  ctx.save();
  ctx.translate(d.bleedPx, d.bleedPx);
  ctx.scale(d.trimWpx / F.w, d.trimHpx / F.h);
  drawSymbolCanvas(ctx);
  ctx.restore();
  if (d.bleedPx > 0) {
    ctx.save(); ctx.translate(d.bleedPx, d.bleedPx);
    Organica.printSize.drawCropMarksCanvas(ctx, d.trimWpx, d.trimHpx, {}, '#000');
    ctx.restore();
  }
  off.toBlob(async blob => {
    const bytes = Organica.printSize.embedPngDpi(await blob.arrayBuffer(), d.dpi);
    Organica.download(new Blob([bytes], { type: 'image/png' }), Organica.stamp('fvs-symbol', 'png'));
  });
}
