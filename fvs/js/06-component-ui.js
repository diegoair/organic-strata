// Flexible Visual System · 06-component-ui — Component UI — Edit mode, rule UI, undo, Colourways, Generate, Split.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  colorAt, live, pv, state, val
} from './engine/00-core.js';
import {
  INNER_APEX, INNER_UNSUPPORTED, SEED_TYPES, fitPathToSeed, frameDims, splitPaperScope, splitPlan
} from './engine/01-geometry.js';
import {
  SEED_ICONS, getSeed, seedForSnapshot, splitIsOn, splitLayersOn
} from './engine/02-seed-ui.js';
import {
  EXHAUSTIVE_CAP, FAMILIES, LATTICE_RULES, activeAxes, activeCellCount, axisSatisfied, crDims,
  canonicalState, exhaustiveTotal, getGrid, gridOf, isCanonical2x2, latticeMirrorKind, latticeRule, mirrorLinesEligible, mirrorSpreadsEligible, radialEligible, radialReadingsEligible, readManualCells,
  resolvedComponentDims, ruleCheckerboard, ruleColumnMirror, ruleDiagonal, ruleExhaustive, ruleIdentity,
  ruleLines, ruleMirror, ruleOscillator, rulePinwheel, ruleRadial, ruleRandom, ruleRowMirror, withGrid
} from './engine/03-rules.js';
import {
  appearanceIsIdentity, appearanceMatrix, buildComponentItems, componentCellColRow, getElementAppearance, itemH, itemW, stretchOpts,
  withAppearance
} from './engine/04-appearance.js';
import {
  buildComponentSVG, buildComponentSVGBody, componentGridOutlineSVG, drawComponentCanvas, gridWrapper, layerTransformAttr
} from './engine/05-render-component.js';
import {
  COMPONENT_STARTER_RULES, RULE_TO_FAMILY, STARTER_VARIANTS_PER_RULE, UNDO_MAX, buildColourways,
  componentEditHitLayer, componentElementSignature, currentLayerInks, cwColourKey, elementIsEmpty,
  expandLayerInks, getSelectedComponent, layerInkComboCount, liveColourKey, splitCurrentOriginal,
  undoStack
} from './engine/06-component-ui.js';
import {
  fillPaper
} from './engine/07-library.js';
import {
  buildPalette, ctrl, printSizePanel, setStatus, syncColorRuleUI, syncQuadrantHint
} from './00-core.js';
import {
  splitElementGeometry
} from './01-geometry.js';
import {
  seedPicker, syncDependentRows, syncFreehandEditor, useSvgAsSeed
} from './02-seed-ui.js';
import {
  applyAppearanceToUI
} from './04-appearance.js';
import {
  buildPrintComponentSVG, elementReachesEdge, printComponentDims, renderGallery, renderSeedPreview
} from './05-render-component.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  adoptColourway: () => adoptColourway, adoptLayerInks: () => adoptLayerInks,
  enterComponentEditMode: () => enterComponentEditMode, generate: () => generate,
  populateComponentStarterGallery: () => populateComponentStarterGallery, renderComponentEditCanvas: () => renderComponentEditCanvas,
  syncRuleAvailability: () => syncRuleAvailability, syncSeedUI: () => syncSeedUI, syncSplitUI: () => syncSplitUI
});
// ── Component Edit mode ──────────────────────────────────────────────────
// A big single-component view (state.componentEditMode) where every cell is
// clickable; the selected cell's own shape can then be edited LIVE from the
// Element sidebar panel (temporarily swapped into view in place of the
// Component tier's own Grid/Rule panel). Never mutates the source component
// — componentEditCells is a working copy, and "Save as new component" pushes
// a fresh gallery candidate, leaving the original untouched.
export function enterComponentEditMode(compId) {
  const comp = state.components.find(c => c.id === compId);
  if (!comp) return;
  state.selectedId = comp.id;
  state.selectionExplicit = true;
  state.componentEditMode = true;
  state.componentEditId = compId;
  // A per-cell shallow copy, NOT structuredClone(comp.cells) — some rule
  // generators (confirmed live: checkerboard) build their cells array with
  // two slots pointing at the SAME object (harmless until now, since
  // nothing ever mutated one cell in place). structuredClone faithfully
  // preserves that aliasing, so editing "cell 0" would silently also edit
  // whichever other index shares its object. map(c => ({...c})) guarantees
  // every slot is its own independent object regardless.
  state.componentEditCells = comp.cells.map(c => ({ ...c }));
  state.componentEditGrid = structuredClone(gridOf(comp));
  state.componentEditSelectedCell = null;
  rt.cePicked = new Set();
  // Frozen once, at entry — every non-overridden cell's DEFAULT shape must
  // stay this, even while the same physical Seed panel is being reused as
  // the SELECTED cell's own scratch pad (selectComponentEditCell/
  // componentEditLiveBind write into cell.content, they never touch this).
  // Without freezing it, moving a slider would change every un-edited
  // cell's shape too, since they'd otherwise read the live (now-scratch)
  // panel same as before this mode existed.
  state.componentEditDefaultSeed = seedForSnapshot();
  state.componentEditDefaultAppearance = getElementAppearance();   // same freezing, for Style/Width/Length/Scale/Move
  ceUndo.length = 0;
  // Grid is fixed for the duration of the edit (a resize could invalidate
  // cells mid-edit) — disable the controls that would change it.
  ctrl('rg-grid-cols').disabled = true; ctrl('rg-grid-rows').disabled = true;
  ctrl('sel-rule').disabled = true;
  ctrl('gallery').classList.remove('visible');
  ctrl('gallery-empty').style.display = 'none';
  ctrl('gallery-status').textContent = '';
  ctrl('component-edit-view').style.display = 'flex';
  if (hooks.boardComponentEdit) hooks.boardComponentEdit(true);   // Edit is the Component board's single view (18-step-boards.js)
  renderComponentEditCanvas();
  syncUndoUI();
  syncCeGridUI();
  if (hooks.syncCeCellProps) hooks.syncCeCellProps();
  hooks.syncFvsZoomHud();   // gallery ⇄ Edit: the zoom chip follows
}

export function exitComponentEditMode() {
  // The panel was repurposed as the selected cell's own scratch pad —
  // restore it to the real shared Element before leaving, so normal
  // Element-tier editing (and the next cell you select) doesn't inherit
  // whatever the last-edited cell happened to be showing.
  if (state.componentEditDefaultSeed) hooks.applySeedToPanel(state.componentEditDefaultSeed);
  if (state.componentEditDefaultAppearance) applyAppearanceToUI(state.componentEditDefaultAppearance);
  state.componentEditMode = false;
  state.componentEditId = null;
  state.componentEditCells = null;
  state.componentEditGrid = null;
  state.componentEditSelectedCell = null;
  state.componentEditDefaultSeed = null;
  state.componentEditDefaultAppearance = null;
  rt.cePicked = new Set();
  ceUndo.length = 0;
  ctrl('component-edit-parts').hidden = true;
  ctrl('rg-grid-cols').disabled = false; ctrl('rg-grid-rows').disabled = false;
  ctrl('sel-rule').disabled = false;
  ctrl('component-edit-view').style.display = 'none';
  if (hooks.boardComponentEdit) hooks.boardComponentEdit(false);
  const compBlock = document.querySelector('.tier-block[data-tier="component"]');
  const elBlock = document.querySelector('.tier-block[data-tier="element"]');
  if (compBlock) compBlock.classList.add('active');
  if (elBlock) elBlock.classList.remove('active', 'is-ce-shaping');
  renderGallery();
  renderSeedPreview();
  syncUndoUI();
  syncCeGridUI();
  if (hooks.syncCeCellProps) hooks.syncCeCellProps();
  hooks.syncFvsZoomHud();   // gallery ⇄ Edit: the zoom chip follows
}

// ── Component Edit — this Component's own grid (Tropism Phase 0, Oct 14, 2026 — Diego: "each component can have a different
// grid type"; Symbol's grid: Columns × Rows, track borders dragged on the canvas). Square cells (a cell-shape lattice keeps
// the step's grid). The grid lives on state.componentEditGrid while editing; Save gives the new Component its own `grid`
// when it differs from the step's. Added cells continue the rule that made the Component (its candidates on the new grid,
// the one that agrees with the cells kept); a hand-made or random one repeats its own cells. Cells kept are untouched.
const ceSquare = () => state.componentEditMode && state.componentEditGrid && state.componentEditGrid.kind === 'square' && state.cellShape === 'square';
const CE_RULES = {
  identity: () => ruleIdentity(), pinwheel: () => rulePinwheel(), mirror: () => ruleMirror(), diagonal: () => ruleDiagonal(),
  checkerboard: () => ruleCheckerboard(), rowmirror: () => ruleRowMirror(), columnmirror: () => ruleColumnMirror(), radial: () => ruleRadial(),
  hlines: () => ruleLines('row'), vlines: () => ruleLines('col'), oscillator: () => ruleOscillator(),
};
const evenOrNull = w => (w && w.some(v => Math.abs(v - w[0]) > 1e-6) ? w : null);
function resizeWeights(w, n) {
  if (!w) return null;
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  return evenOrNull(Array.from({ length: n }, (_, i) => (i < w.length ? w[i] : mean)));
}
function continueCells(ruleSource, oldGrid, oldCells, g) {
  const oc = oldGrid.cols, or = oldGrid.rows, n = g.cols * g.rows;
  const at = (c, r) => (c < oc && r < or ? oldCells[r * oc + c] : null);
  let fill = null;
  if (CE_RULES[ruleSource]) {
    let cands = [];
    try { cands = withGrid(g, CE_RULES[ruleSource]) || []; } catch (e) { cands = []; }
    let best = null, bestScore = -1, total = 0;
    for (let r = 0; r < Math.min(or, g.rows); r++) for (let c = 0; c < Math.min(oc, g.cols); c++) total++;
    for (const cand of cands) {
      if (!cand || !cand.cells || cand.cells.length !== n) continue;
      let sc = 0;
      for (let r = 0; r < Math.min(or, g.rows); r++) for (let c = 0; c < Math.min(oc, g.cols); c++) if (canonicalState(cand.cells[r * g.cols + c]) === canonicalState(at(c, r))) sc++;
      if (sc > bestScore) { bestScore = sc; best = cand; }
    }
    if (best && bestScore * 2 >= total) fill = best.cells;
  }
  return Array.from({ length: n }, (_, i) => {
    const c = i % g.cols, r = Math.floor(i / g.cols), kept = at(c, r);
    if (kept) return kept;
    return { ...(fill ? fill[i] : oldCells[(r % or) * oc + (c % oc)]) };
  });
}
export function ceSetGrid(cols, rows) {
  if (!ceSquare()) return;
  cols = Math.max(2, Math.min(8, cols)); rows = Math.max(2, Math.min(8, rows));   // a Component's grid starts at 2 × 2 (Diego, Oct 14)
  const old = state.componentEditGrid;
  if (cols === old.cols && rows === old.rows) return;
  ceSnapshot();
  const g = { ...old, cols, rows };
  delete g.colWeights; delete g.rowWeights;
  const cw = resizeWeights(old.colWeights, cols), rw = resizeWeights(old.rowWeights, rows);
  if (cw) g.colWeights = cw;
  if (rw) g.rowWeights = rw;
  const src = state.components.find(c => c.id === state.componentEditId);
  state.componentEditCells = continueCells(src ? src.ruleSource : '', old, state.componentEditCells, g);
  state.componentEditGrid = g;
  rt.cePicked = new Set([...rt.cePicked].filter(i => i < cols * rows));
  if (state.componentEditSelectedCell != null && state.componentEditSelectedCell >= cols * rows) state.componentEditSelectedCell = null;
  renderComponentEditCanvas();
  syncCeGridUI();
  if (hooks.syncCeCellProps) hooks.syncCeCellProps();
}
export function ceEvenTracks() {
  if (!ceSquare()) return;
  const g = state.componentEditGrid;
  if (!g.colWeights && !g.rowWeights) return;
  ceSnapshot();
  state.componentEditGrid = { ...g }; delete state.componentEditGrid.colWeights; delete state.componentEditGrid.rowWeights;
  renderComponentEditCanvas(); syncCeGridUI();
}
// The grid the new Component keeps: only what differs from the step's (null = it follows the step's, as before)
export function ceOwnGrid() {
  const g = state.componentEditGrid, s = getGrid();
  if (!g || g.kind !== 'square' || s.kind !== 'square') return null;
  const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
  if (g.cols === s.cols && g.rows === s.rows && same(g.colWeights, s.colWeights) && same(g.rowWeights, s.rowWeights)) return null;
  return { cols: g.cols, rows: g.rows, ...(g.colWeights ? { colWeights: g.colWeights.slice() } : {}), ...(g.rowWeights ? { rowWeights: g.rowWeights.slice() } : {}) };
}
// Apply grid to all: the step takes this grid (columns, rows, tracks); the other Components are made again on it when
// Edit closes (the gallery's grid-change path) — a Component with its own grid keeps it.
export function ceApplyGridToAll() {
  if (!ceSquare()) return;
  const g = state.componentEditGrid, before = getGrid();
  // the Component being edited keeps the grid it was made on (it becomes unique), as every Component with its own grid
  const src = state.components.find(c => c.id === state.componentEditId);
  if (src && !src.grid && (before.cols !== g.cols || before.rows !== g.rows)) src.grid = { cols: before.cols, rows: before.rows, ...(before.colWeights ? { colWeights: before.colWeights.slice() } : {}), ...(before.rowWeights ? { rowWeights: before.rowWeights.slice() } : {}) };
  const keep = state.components.filter(c => c.grid);
  state.loomGrid = null;
  ctrl('rg-grid-cols').value = g.cols; ctrl('v-grid-cols').textContent = g.cols;
  ctrl('rg-grid-rows').value = g.rows; ctrl('v-grid-rows').textContent = g.rows;
  state.gridWeights = g.colWeights || g.rowWeights ? { colWeights: g.colWeights ? g.colWeights.slice() : null, rowWeights: g.rowWeights ? g.rowWeights.slice() : null } : null;
  hooks.syncComponentGridUI(); syncRuleAvailability();
  // the others: the step's rule again, on the new grid (their hand edits go — the two-click button says so)
  if (pv('sel-rule') !== 'manual' && !ctrl('sel-rule').selectedOptions[0].disabled) generate();
  keep.forEach(c => { if (!state.components.includes(c)) state.components.push(c); });
  state.componentAutoGenerated = false;
  syncCeGridUI();
}
export function syncCeGridUI() {
  const on = ceSquare();
  ctrl('ce-grid-section').hidden = !on;
  if (!on) return;
  const g = state.componentEditGrid;
  ctrl('rg-ce-cols').value = g.cols; ctrl('v-ce-cols').textContent = g.cols;
  ctrl('rg-ce-rows').value = g.rows; ctrl('v-ce-rows').textContent = g.rows;
  ctrl('ce-grid-count').textContent = `${g.cols * g.rows} cell${g.cols * g.rows === 1 ? '' : 's'}`;
  ctrl('btn-ce-even-tracks').disabled = !g.colWeights && !g.rowWeights;
  ctrl('btn-ce-apply-grid').disabled = !ceOwnGrid();
}
['cols', 'rows'].forEach(k => ctrl('rg-ce-' + k).addEventListener('input', e => {
  ctrl('v-ce-' + k).textContent = e.target.value;
  const g = state.componentEditGrid;
  ceSetGrid(k === 'cols' ? +e.target.value : g.cols, k === 'rows' ? +e.target.value : g.rows);
}));
ctrl('btn-ce-even-tracks').addEventListener('click', ceEvenTracks);
ctrl('btn-ce-apply-grid').addEventListener('click', ceApplyGridToAll);
// The track borders on the canvas: Symbol's handles (.sym-track — a dashed line, solid on hover / drag) and its % labels.
let ceTrackDrag = null;   // { axis, i } while a border is dragged
function ceTrackGeometry(items, size) {
  const g = state.componentEditGrid, d = resolvedComponentDims(size), hx = d.w / 2, hy = d.h / 2;
  const col = Array.from({ length: g.cols }, (_, c) => items[c]), row = Array.from({ length: g.rows }, (_, r) => items[r * g.cols]);
  const xs = col.map(it => [hx + it.cx - itemW(it) / 2, hx + it.cx + itemW(it) / 2]), ys = row.map(it => [hy + it.cy - itemH(it) / 2, hy + it.cy + itemH(it) / 2]);
  return { d, xs, ys };
}
function ceTrackHandles(items, size) {
  if (!ceSquare() || !state.componentGuides || items.length !== state.componentEditGrid.cols * state.componentEditGrid.rows) return '';
  const { d, xs, ys } = ceTrackGeometry(items, size), M = Math.max(d.w, d.h);
  const hitW = Math.max(6, 0.012 * M), lw = Math.max(1, 0.002 * M), y0 = ys[0][0], y1 = ys[ys.length - 1][1], x0 = xs[0][0], x1 = xs[xs.length - 1][1];
  const on = (axis, i) => (ceTrackDrag && ceTrackDrag.axis === axis && ceTrackDrag.i === i ? ' is-dragging' : '');
  let s = '';
  for (let i = 0; i < xs.length - 1; i++) {
    const x = (xs[i][1] + xs[i + 1][0]) / 2;
    s += `<g class="sym-track${on('cols', i)}" data-axis="cols" data-track="${i}"><rect class="sym-track__hit" x="${(x - hitW / 2).toFixed(2)}" y="${y0.toFixed(2)}" width="${hitW.toFixed(2)}" height="${(y1 - y0).toFixed(2)}"/><line class="sym-track__line" x1="${x.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y1.toFixed(2)}" stroke-width="${lw}"/></g>`;
  }
  for (let i = 0; i < ys.length - 1; i++) {
    const y = (ys[i][1] + ys[i + 1][0]) / 2;
    s += `<g class="sym-track${on('rows', i)}" data-axis="rows" data-track="${i}"><rect class="sym-track__hit" x="${x0.toFixed(2)}" y="${(y - hitW / 2).toFixed(2)}" width="${(x1 - x0).toFixed(2)}" height="${hitW.toFixed(2)}"/><line class="sym-track__line" x1="${x0.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y.toFixed(2)}" stroke-width="${lw}"/></g>`;
  }
  return s;
}
// % of the width / height each column / row takes, outside the sheet — HTML, placed from the SVG's rendered box (Symbol's way)
function ceTrackLabels(size) {
  const frame = ctrl('component-edit-frame'), old = frame.querySelector('.sym-track-labels');
  if (old) old.remove();
  if (!ceSquare() || !state.componentGuides) return;
  const svg = frame.querySelector('svg');
  if (!svg) return;
  const items = buildComponentItems({ cells: state.componentEditCells }, state.componentEditGrid);
  const { d, xs, ys } = ceTrackGeometry(items, size);
  const sr = svg.getBoundingClientRect(), fr = frame.getBoundingClientRect(), k = sr.width / d.w || 1;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-4')) || 10;
  const tw = xs[xs.length - 1][1] - xs[0][0], th = ys[ys.length - 1][1] - ys[0][0];
  const wrap = document.createElement('div');
  wrap.className = 'sym-track-labels';
  const label = (cls, x, y, pct) => { const el = document.createElement('div'); el.className = 'sym-track-label ' + cls; el.style.left = x.toFixed(1) + 'px'; el.style.top = y.toFixed(1) + 'px'; el.textContent = pct + '%'; wrap.appendChild(el); };
  // the columns' % under the sheet (the Edit toolbar sits above it — Symbol's place for them would cover it)
  xs.forEach(([a, b]) => label('sym-track-label--col sym-track-label--below', sr.left - fr.left + (a + b) / 2 * k, sr.bottom - fr.top + gap, Math.round((b - a) / tw * 100)));
  ys.forEach(([a, b]) => label('sym-track-label--row', sr.left - fr.left - gap, sr.top - fr.top + (a + b) / 2 * k, Math.round((b - a) / th * 100)));
  frame.appendChild(wrap);
}
function ceSvgPoint(e) {
  const svg = ctrl('component-edit-frame').querySelector('svg');
  if (!svg) return null;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
// a border drag moves only the two tracks beside it (their sum stays); each keeps at least a tenth of the pair
function ceMoveTrack(axis, i, pos) {
  const g = state.componentEditGrid, size = frameDims(g), items = buildComponentItems({ cells: state.componentEditCells }, g);
  const { xs, ys } = ceTrackGeometry(items, size), spans = axis === 'cols' ? xs : ys;
  const sizes = spans.map(([a, b]) => b - a), start = spans[i][0], pair = sizes[i] + sizes[i + 1], gap = g.gap || 0, min = pair * 0.1;
  const a = Math.min(pair - min, Math.max(min, pos - start - gap / 2));
  sizes[i] = a; sizes[i + 1] = pair - a;
  const mean = sizes.reduce((x, y) => x + y, 0) / sizes.length, w = sizes.map(v => Math.round(v / mean * 1000) / 1000);
  const key = axis === 'cols' ? 'colWeights' : 'rowWeights', next = { ...g };
  if (evenOrNull(w)) next[key] = w; else delete next[key];
  state.componentEditGrid = next;
}
ctrl('component-edit-frame').addEventListener('pointerdown', e => {
  const h = e.button === 0 && e.target.closest && e.target.closest('.sym-track');
  if (!h || !ceSquare()) return;
  e.preventDefault(); e.stopPropagation();
  ceSnapshot();
  ceTrackDrag = { axis: h.dataset.axis, i: +h.dataset.track };
  renderComponentEditCanvas();
}, true);
window.addEventListener('pointermove', e => {
  if (!ceTrackDrag) return;
  const pt = ceSvgPoint(e);
  if (!pt) return;
  ceMoveTrack(ceTrackDrag.axis, ceTrackDrag.i, ceTrackDrag.axis === 'cols' ? pt.x : pt.y);
  renderComponentEditCanvas();
}, true);   // capture: the board's own pointer handling stops the event before it bubbles to window
window.addEventListener('pointerup', () => {
  if (!ceTrackDrag) return;
  ceTrackDrag = null;
  const frame = ctrl('component-edit-frame');
  const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };   // the release is not a cell click
  frame.addEventListener('click', swallow, true);
  setTimeout(() => frame.removeEventListener('click', swallow, true), 0);
  renderComponentEditCanvas(); syncCeGridUI();
}, true);

// Undo inside Component Edit (Tropism Phase 0, Oct 14, 2026): each change to the cells is a step. A drag of a slider or
// typing a value (a run of `input` events) is ONE step — a new one only when the last edit is more than 600 ms old;
// every other edit (Lock, Delete, Fit, Anchor, Choose, a menu) is always its own. ⌘Z and the floatbar's Undo step
// back through them while Edit is open, the gallery's own undo otherwise.
const ceUndo = [];
let ceUndoAt = 0;
export function ceSnapshot() {
  const now = Date.now(), dragging = typeof window !== 'undefined' && window.event && window.event.type === 'input';
  const fresh = !dragging || now - ceUndoAt > 600;
  ceUndoAt = now;
  if (!fresh || !state.componentEditCells) return;
  ceUndo.push(structuredClone({ cells: state.componentEditCells, grid: state.componentEditGrid }));
  if (ceUndo.length > UNDO_MAX) ceUndo.shift();
  syncUndoUI();
}
export function ceUndoStep() {
  if (!state.componentEditMode || !ceUndo.length) return;
  const step = ceUndo.pop();
  state.componentEditCells = step.cells; state.componentEditGrid = step.grid;
  rt.cePicked = new Set([...rt.cePicked].filter(i => i < step.cells.length));
  ceUndoAt = 0;
  renderComponentEditCanvas();
  if (hooks.syncCeCellProps) hooks.syncCeCellProps();
  syncUndoUI();
}

// Pushes a brand-new gallery candidate carrying the edited cells, then
// leaves edit mode — the component being edited FROM is never touched.
export function saveComponentEditAsNew() {
  if (!state.componentEditMode) return;
  const newComp = { id: `edit-${Date.now()}`, ruleSource: 'edited', cells: structuredClone(state.componentEditCells) };
  const own = ceOwnGrid();
  if (own) newComp.grid = own;
  pushUndo();
  state.components.push(newComp);
  state.selectedId = newComp.id;
  state.selectionExplicit = true;
  state.componentAutoGenerated = false;
  exitComponentEditMode();
}


export function renderComponentEditCanvas() {
  if (!state.componentEditMode) return;
  const grid = state.componentEditGrid;
  const seed = state.componentEditDefaultSeed;   // frozen — see enterComponentEditMode's comment
  const size = frameDims(grid);   // real width×height — no square letterbox
  const items = buildComponentItems({ cells: state.componentEditCells }, grid);
  // Frozen default Appearance for the whole call (every non-overridden cell) —
  // an overridden cell's own withAppearance (inside buildComponentSVGBody's
  // per-item loop) nests inside this one and wins for just that item.
  live.tagParts = !!seed.parts;   // a divided Element: a click finds the part under it (renderComponentEditParts)
  let body;
  try { body = withAppearance(state.componentEditDefaultAppearance, () => buildComponentSVGBody(items, seed, size)); }
  finally { live.tagParts = false; }
  const hit = componentEditHitLayer(items, size, rt.cePicked);
  const dims = resolvedComponentDims(size);
  ctrl('component-edit-frame').style.setProperty('--comp-ar', (dims.w / dims.h).toFixed(5));   // the sheet's box takes the component's proportions
  const tracks = ceTrackHandles(items, size);
  ctrl('component-edit-frame').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg"${items.length && items[0].poly ? ' class="is-cell"' : ''} viewBox="0 0 ${dims.w} ${dims.h}">${body}${componentGridOutlineSVG(items, size)}${(gridWrapper(items, grid.lattice && grid.lattice.outline) || {}).svg || ''}${hit}</svg>`;
  const n = rt.cePicked.size, shaping = ceShaping();
  ctrl('component-edit-hint').textContent = !n
    ? (seed.parts ? 'Click cells — ⌘-click adds — then a part and an ink' : 'Click a cell — ⌘-click or drag to pick several')
    : shaping ? `Shape of ${n} cell${n === 1 ? '' : 's'} — click a cell to go back to its properties`
    : `${n} cell${n === 1 ? '' : 's'} selected`;
  if (tracks) { const svg = ctrl('component-edit-frame').querySelector('svg'); if (svg) svg.insertAdjacentHTML('beforeend', tracks); }
  ceTrackLabels(size);
  renderComponentEditParts();
}
// ── Divide into parts, per cell (R3) ── the picked cells' own colour for one part of the divided Element
// (cell.partInks {partKey: 'cell' | slot}); it lives in the edit's working copy until Save as new component.
const ceParts = () => {
  const seed = state.componentEditDefaultSeed;
  return seed && seed.parts ? (seed.layers || []).filter(l => l.part) : [];
};
export function renderComponentEditParts() {
  const parts = ceParts(), box = ctrl('component-edit-parts');
  box.hidden = !parts.length;
  if (!parts.length) return;
  const sel = ctrl('sel-ce-part');
  if (!parts.some(l => l.part === rt.cePart)) rt.cePart = parts[0].part;
  sel.innerHTML = parts.map(l => `<option value="${l.part}"${l.part === rt.cePart ? ' selected' : ''}>${l.partName || l.part}</option>`).join('');
  const picked = [...rt.cePicked].map(i => state.componentEditCells[i]).filter(Boolean);
  const vals = new Set(picked.map(c => (c.partInks && rt.cePart in c.partInks) ? String(c.partInks[rt.cePart]) : 'unset'));
  const cur = vals.size === 1 ? [...vals][0] : null;
  ctrl('ce-part-inks').innerHTML = `<button type="button" class="is-cell" data-ink="cell" style="--sw:${colorAt(0)}" aria-pressed="${cur === 'cell'}" aria-label="Follow cell colour" title="Follow the cell colour"></button>`
    + state.colors.map((c, k) => `<button type="button" data-ink="${k}" style="--sw:${c}" aria-pressed="${cur === String(k)}" aria-label="Ink ${k + 1}" title="Ink ${k + 1} · ${c}"></button>`).join('');
  const off = !picked.length;
  ctrl('ce-part-inks').querySelectorAll('button').forEach(b => { b.disabled = off; });
  ctrl('btn-ce-part-clear').disabled = off || !picked.some(c => c.partInks && rt.cePart in c.partInks);
}
ctrl('sel-ce-part').addEventListener('change', e => { rt.cePart = e.target.value; renderComponentEditParts(); });
ctrl('ce-part-inks').addEventListener('click', e => {
  const b = e.target.closest('[data-ink]');
  if (!b || !rt.cePart) return;
  const ink = b.dataset.ink === 'cell' ? 'cell' : +b.dataset.ink;
  rt.cePicked.forEach(i => { const c = state.componentEditCells[i]; if (c) c.partInks = { ...(c.partInks || {}), [rt.cePart]: ink }; });
  renderComponentEditCanvas();
});
ctrl('btn-ce-part-clear').addEventListener('click', () => {
  rt.cePicked.forEach(i => {   // the picked cells' colour for the chosen Part only; the other parts keep theirs
    const c = state.componentEditCells[i];
    if (!c || !c.partInks) return;
    const { [rt.cePart]: _gone, ...rest } = c.partInks;
    if (Object.keys(rest).length) c.partInks = rest; else delete c.partInks;
  });
  renderComponentEditCanvas();
});

// Selecting a cell shows its Cell properties (Symbol's block — Tropism Phase 0, Oct 14, 2026); "Edit shape…" there swaps
// the sidebar to the Element panel, loaded with the cell's own content (or, when it has none, the panel as it already
// reads), and every edit in it goes to the picked cells. A click on a cell comes back to the properties.
const ceTierBlock = t => document.querySelector(`.tier-block[data-tier="${t}"]`);
export const ceShaping = () => !!(state.componentEditMode && ceTierBlock('element') && ceTierBlock('element').classList.contains('active'));
function showCeBlock(tier) {
  const comp = ceTierBlock('component'), el = ceTierBlock('element');
  if (comp) comp.classList.toggle('active', tier === 'component');
  if (el) { el.classList.toggle('active', tier === 'element'); el.classList.toggle('is-ce-shaping', tier === 'element'); }   // only what is inside the layers (fvs.css)
}
export function selectComponentEditCell(i) {
  if (!state.componentEditMode) return;
  state.componentEditSelectedCell = i;
  showCeBlock('component');
  renderComponentEditCanvas();
  if (hooks.syncCeCellProps) hooks.syncCeCellProps();
}
export function editCellShape() {
  if (!state.componentEditMode || !rt.cePicked.size) return;
  const i = state.componentEditSelectedCell != null && rt.cePicked.has(state.componentEditSelectedCell) ? state.componentEditSelectedCell : Math.min(...rt.cePicked);
  state.componentEditSelectedCell = i;
  const cell = state.componentEditCells[i];
  hooks.applyElementSnapshot(cell.content ? cell.content.seedParams : state.componentEditDefaultSeed, (cell.content && cell.content.appearance) || state.componentEditDefaultAppearance);
  showCeBlock('element');
  renderComponentEditCanvas();
}

ctrl('component-edit-frame').addEventListener('click', e => {
  const hit = e.target.closest('[data-cell-index]');
  if (!hit) return;
  const i = parseInt(hit.dataset.cellIndex, 10);
  // the part under the pointer (the hit layer sits on top of the drawing): it becomes the Part
  if (ceParts().length) {
    const under = document.elementsFromPoint(e.clientX, e.clientY).map(el => el.closest && el.closest('[data-part]')).find(Boolean);
    const seed = state.componentEditDefaultSeed, l = under && (seed.layers || []).find(x => x.id === under.getAttribute('data-part'));
    if (l && l.part) rt.cePart = l.part;
  }
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    if (rt.cePicked.has(i) && rt.cePicked.size > 1) rt.cePicked.delete(i); else rt.cePicked.add(i);
    renderComponentEditCanvas();
    if (hooks.syncCeCellProps) hooks.syncCeCellProps();
    return;
  }
  rt.cePicked = new Set([i]);
  selectComponentEditCell(i);
});
ctrl('btn-component-edit-exit').addEventListener('click', exitComponentEditMode);
ctrl('btn-component-edit-save').addEventListener('click', saveComponentEditAsNew);

// Live binding: any edit inside the Element sidebar, while a cell is
// selected in Component Edit mode, writes straight into that cell's own
// content and re-renders — delegated on the whole panel (fires in the
// bubble phase, after each control's own input/change listener already ran
// its usual job), so no individual Seed slider needs touching.
ctrl('panel').addEventListener('input', componentEditLiveBind);
ctrl('panel').addEventListener('change', componentEditLiveBind);
export function componentEditLiveBind(e) {
  if (!state.componentEditMode || !ceShaping() || !rt.cePicked.size) return;
  if (!e.target.closest('.tier-block[data-tier="element"]')) return;
  // Appearance (Style/Width/Length/Scale/Move) rides along in the same snapshot as the shape — the Element panel is the
  // picked cells' own scratch pad while it shows, so everything you touch in it (not just the Seed section) belongs to
  // them, not to the whole Component. A locked cell keeps its shape.
  ceSnapshot();
  const sp = seedForSnapshot(), app = getElementAppearance(), type = getSeed().type;
  rt.cePicked.forEach(i => {
    const cell = state.componentEditCells[i];
    if (!cell || cell.locked) return;
    cell.content = { source: 'seed', seedType: type, seedParams: structuredClone(sp), appearance: { ...app } };
    delete cell.empty;
  });
  renderComponentEditCanvas();
}




// ── Grid-driven rule availability — Radial needs an even × even grid (its
// centre falls between cells); Random/Exhaustive draw from the same families on any grid
// (see the comment above ruleRandom). Grey out what does not apply and bounce
// off a now-invalid selection rather than leaving it silently unusable. ──
export function syncRuleAvailability() {
  const count = activeCellCount();
  const sel = ctrl('sel-rule');
  let currentInvalid = false;
  // Row mirror on a single row (or Column mirror on a single column) has
  // nothing to mirror — every candidate was Identity in disguise.
  const d = crDims(componentCellColRow(getGrid()));
  const gates = {
    radial: [radialEligible(), 'A single cell has no centre to turn towards'],
    rowmirror: [d.rows > 1, 'Row mirror needs at least two rows'],
    columnmirror: [d.cols > 1, 'Column mirror needs at least two columns'],
  };
  // A single cell has no pattern to arrange — Identity / Random / Exhaustive /
  // Manual cover its rotations and flips.
  if (count === 1) ['pinwheel', 'mirror', 'diagonal', 'checkerboard', 'hlines', 'vlines', 'oscillator'].forEach(v => { gates[v] = [false, 'A 1×1 Component has no pattern — use Exhaustive for its rotations/flips']; });
  // A non-square cell shape: only the rules that turn in its own step apply.
  if (state.cellShape !== 'square') {
    gates.radial = [count > 1, 'A single cell has no centre to turn towards'];
    [...sel.options].forEach(o => { if (!LATTICE_RULES.has(o.value) && o.value !== 'manual') gates[o.value] = [false, `${o.textContent.replace(/ \(.*\)$/, '')} needs square cells`]; });
    gates.manual = [false, 'Manual needs square cells'];
    if (count === 1) gates.checkerboard = [false, 'A single cell has no pattern'];
  } else if (!('manual' in gates)) gates.manual = [true, ''];
  Object.entries(gates).forEach(([v, [eligible, why]]) => {
    const opt = sel.querySelector(`option[value="${v}"]`);
    opt.disabled = !eligible;
    opt.title = eligible ? '' : why;
    if (!eligible && sel.value === v) currentInvalid = true;
  });
  ['pinwheel', 'mirror', 'diagonal', 'checkerboard', 'hlines', 'vlines', 'oscillator'].forEach(v => {
    if (count !== 1 && !(v in gates)) { const opt = sel.querySelector(`option[value="${v}"]`); if (opt) { opt.disabled = false; opt.title = ''; } }
  });
  if (currentInvalid) { sel.value = 'identity'; syncRuleUI(); }
  syncMirrorLine();
  syncCheckerStart();
  syncRadialTurnBy();
  ctrl('grid-cellcount-hint').textContent = count + ' cell' + (count === 1 ? '' : 's');
  syncQuadrantHint();
  buildManualEditor();
  if (sel.value === 'exhaustive') syncExhaustiveHint();
}

// Mirror › Line (Both · Left–right · Top–bottom) and Span (Cell · Pair · Whole grid), Oct 13, 2026: an option this grid
// or cell shape cannot run is greyed with its reason (aria-disabled + title + aria-description, the Grid shape seg's
// pattern) and the pick falls back to Both / Cell.
const MIRROR_LINE_WHY = { lr: 'Left–right needs 2 or more columns', tb: 'Top–bottom needs 2 or more rows' };
function mirrorWhy(kind, v) {
  if (state.cellShape !== 'square') return kind === 'line' ? `${v === 'lr' ? 'Left–right' : 'Top–bottom'} needs square cells` : `${v === 'pair' ? 'Pair' : 'Whole grid'} needs square cells`;
  if (kind === 'line') return MIRROR_LINE_WHY[v];
  return `${v === 'pair' ? 'Pair' : 'Whole grid'} needs 3 or more cells along the Line`;
}
function syncSeg(id, attr, ok, value, kind) {
  ctrl(id).querySelectorAll('.seg-btn').forEach(b => {
    const v = b.dataset[attr], can = ok.includes(v), on = v === value;
    b.setAttribute('aria-disabled', String(!can));
    if (can) { b.removeAttribute('title'); b.removeAttribute('aria-description'); }
    else { const why = mirrorWhy(kind, v); b.title = why; b.setAttribute('aria-description', why); }
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
}
export function syncMirrorLine() {
  const lines = mirrorLinesEligible();
  if (!lines.includes(state.mirrorLine)) state.mirrorLine = 'both';
  const spans = mirrorSpreadsEligible(state.mirrorLine);
  if (!spans.includes(state.mirrorSpread)) state.mirrorSpread = 'cell';
  syncSeg('seg-mirror-line', 'line', lines, state.mirrorLine, 'line');
  syncSeg('seg-mirror-span', 'span', spans, state.mirrorSpread, 'span');
}
export function setMirrorLine(line) {
  if (!mirrorLinesEligible().includes(line)) return;
  state.mirrorLine = line;
  syncMirrorLine();
}
// Checkerboard › Start at (Oct 13, 2026): which state of each set sits on the first cell — A · B, and C where the cell
// shape gives three states (hexagons, hex-packed circles); the C button only exists there (display, not greyed).
export function syncCheckerStart() {
  const n = state.cellShape !== 'square' && latticeMirrorKind() === 'lines' ? 3 : 2;
  if (state.checkerStart >= n) state.checkerStart = 0;
  ctrl('seg-checker-start').querySelectorAll('.seg-btn').forEach(b => {
    const v = +b.dataset.start, on = v === state.checkerStart;
    b.style.display = v < n ? '' : 'none';
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
}
export function setCheckerStart(v) { state.checkerStart = v; syncCheckerStart(); }
// Rhythm (Oct 14, 2026): Mode Beat · Two beats · Wave · Connect, each with its own rows; Row shift for all but
// Connect. The Beat is a row of steps, a click turns one a quarter; − / + remove / add the last (1–8 steps).
export const RHYTHM_BEAT_MAX = 8;
export function syncRhythm() {
  const r = state.rhythm, m = r.mode;
  ctrl('sel-rhythm-mode').value = m;
  ctrl('sel-rhythm-combine').value = r.combine;
  ctrl('rhythm-beat-block').style.display = m === 'beat' ? '' : 'none';
  ctrl('rhythm-beats-block').style.display = m === 'beats' ? '' : 'none';
  ctrl('rhythm-wave-block').style.display = m === 'wave' ? '' : 'none';
  ctrl('rhythm-shift-row').style.display = m === 'connect' ? 'none' : '';
  ctrl('rhythm-wrap-row').style.display = m === 'connect' ? '' : 'none';
  ctrl('rhythm-beat').innerHTML = r.beat.map((t, i) => `<button type="button" class="seg-btn" data-step="${i}" aria-label="Step ${i + 1}: ${t}°"><span class="fvs-beat__mark" style="--beat-turn:${t}deg" aria-hidden="true">F</span></button>`).join('');
  ctrl('v-rhythm-beat').textContent = r.beat.length + (r.beat.length === 1 ? ' step' : ' steps');
  ctrl('btn-rhythm-beat-remove').disabled = r.beat.length <= 1;
  ctrl('btn-rhythm-beat-add').disabled = r.beat.length >= RHYTHM_BEAT_MAX;
  ctrl('rhythm-connect-hint').style.display = m === 'connect' && !elementReachesEdge() ? '' : 'none';
}
export function setRhythmMode(m) { state.rhythm.mode = m; syncRhythm(); }
export function setRhythmCombine(c) { state.rhythm.combine = c; syncRhythm(); }
export function turnRhythmStep(i) { const b = state.rhythm.beat; if (i in b) { b[i] = (b[i] + 90) % 360; syncRhythm(); } }
export function resizeRhythmBeat(d) {
  const b = state.rhythm.beat;
  if (d > 0 && b.length < RHYTHM_BEAT_MAX) b.push(0);
  else if (d < 0 && b.length > 1) b.pop();
  syncRhythm();
}
// Radial › Turn by (Oct 14, 2026): Quadrant · Each 2×2 · Cell; an option this grid or cell shape cannot run is greyed
// with its reason and the pick falls back to the first that can.
const RADIAL_NAME = { quadrants: 'Quadrant', blocks: 'Each 2×2', centre: 'Cell' };
export function syncRadialTurnBy() {
  const ok = radialReadingsEligible();
  if (ok.length && !ok.includes(state.radialReading)) state.radialReading = ok[0];
  ctrl('seg-radial-turnby').querySelectorAll('.seg-btn').forEach(b => {
    const v = b.dataset.radial, can = ok.includes(v), on = v === state.radialReading;
    const why = can ? '' : state.cellShape !== 'square' ? `${RADIAL_NAME[v]} needs square cells` : `${RADIAL_NAME[v]} needs an even number of columns and rows`;
    b.setAttribute('aria-disabled', String(!can));
    if (can) { b.removeAttribute('title'); b.removeAttribute('aria-description'); } else { b.title = why; b.setAttribute('aria-description', why); }
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
}
export function setRadialTurnBy(v) { if (!radialReadingsEligible().includes(v)) return; state.radialReading = v; syncRadialTurnBy(); }
export function setMirrorSpan(span) {
  if (!mirrorSpreadsEligible(state.mirrorLine).includes(span)) return;
  state.mirrorSpread = span;
  syncMirrorLine();
}

export function syncRuleAxisNote() {
  const note = ctrl('rule-axis-note');
  const famKey = RULE_TO_FAMILY[pv('sel-rule')];
  const fam = famKey && FAMILIES[famKey];
  // Only Checkerboard still depends on the axes (see familyRuleGallery).
  const ax = activeAxes();
  // Random with no axis on draws the one uniform Component, however many it is asked for (Oct 14, 2026)
  if (pv('sel-rule') === 'random' && !ax.rotation && !ax.flip && !ax.scale) {
    note.textContent = 'Random needs an axis active in Transform axes (above) — every Component is the same until then.';
    note.style.display = ''; return;
  }
  const satisfied = !fam || fam.requiresAxis !== 'any' || axisSatisfied('any', ax);
  if (satisfied) { note.style.display = 'none'; return; }
  note.textContent = 'Checkerboard needs an axis active in Transform axes (above) — showing Uniform until then.';
  note.style.display = '';
}

// ── Rule UI wiring ──
export function syncRuleUI() {
  const mode = pv('sel-rule');
  ctrl('rule-random-block').style.display = mode === 'random' ? '' : 'none';
  ctrl('rule-mirror-block').style.display = mode === 'mirror' ? '' : 'none';
  ctrl('rule-checker-block').style.display = mode === 'checkerboard' ? '' : 'none';
  ctrl('rule-radial-block').style.display = mode === 'radial' ? '' : 'none';
  ctrl('rule-lines-block').style.display = (mode === 'hlines' || mode === 'vlines') ? '' : 'none';
  ctrl('rule-oscillator-block').style.display = mode === 'oscillator' ? '' : 'none';
  if (mode === 'oscillator') syncRhythm();
  ctrl('rule-exhaustive-block').style.display = mode === 'exhaustive' ? '' : 'none';
  ctrl('rule-manual-block').style.display = mode === 'manual' ? '' : 'none';
  ctrl('btn-generate').textContent = mode === 'manual' ? 'Add component' : 'Generate';
  syncRuleAxisNote();
  // Exhaustive-over-cap disables Generate; leaving that mode for any
  // other rule must re-enable it — previously only re-checked when
  // switching BACK INTO exhaustive, so Generate could stay permanently
  // stuck disabled after leaving an over-cap Exhaustive for any other rule.
  if (mode === 'exhaustive') syncExhaustiveHint();
  else ctrl('btn-generate').disabled = false;
}

export function syncExhaustiveHint() {
  const total = exhaustiveTotal();
  const hint = ctrl('rule-total-hint');
  if (total > EXHAUSTIVE_CAP) {
    hint.textContent = `${total.toLocaleString()} possible — exceeds the ${EXHAUSTIVE_CAP} cap. Narrow active axes or use Random instead.`;
    hint.classList.add('over-cap');
    ctrl('btn-generate').disabled = pv('sel-rule') === 'exhaustive';
  } else {
    const k = layerInkComboCount(), ax = activeAxes();
    // no axis on = the one uniform Component (Diego, Oct 14, 2026: "it says one component only, it seems very strange") —
    // say why, in Checkerboard's words (syncRuleAxisNote)
    hint.textContent = !ax.rotation && !ax.flip && !ax.scale && k <= 1
      ? '1 possible component — no axis is active. Turn on Rotation, Flip or Scale in Transform axes (above) for more.'
      : k > 1
      ? `${total.toLocaleString()} possible component${total === 1 ? '' : 's'} × ${k} layer-colour combinations = ${(total * k).toLocaleString()}${total * k > EXHAUSTIVE_CAP ? ` (first ${EXHAUSTIVE_CAP} shown)` : ''}.`
      : `${total.toLocaleString()} possible component${total === 1 ? '' : 's'}.`;
    hint.classList.remove('over-cap');
    if (pv('sel-rule') === 'exhaustive') ctrl('btn-generate').disabled = false;
  }
}

export function buildManualEditor() {
  const wrap = ctrl('rule-manual-block');
  const count = activeCellCount();
  const square4Labels = ['Cell 1 (top-left)', 'Cell 2 (top-right)', 'Cell 3 (bottom-left)', 'Cell 4 (bottom-right)'];
  let html = '';
  for (let i = 0; i < count; i++) {
    const label = isCanonical2x2() ? square4Labels[i] : `Cell ${i + 1}`;
    html += `<div class="fvs-cell-group">
      <div class="sub-label">${label}</div>
      <div class="ctrl-row"><div class="ctrl-label">Rotation</div>
        <select class="panel-select" id="sel-manual-rot-${i}">
          <option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option>
        </select></div>
      <div class="ctrl-row"><div class="ctrl-label">Flip</div>
        <select class="panel-select" id="sel-manual-flip-${i}">
          <option value="none">None</option><option value="h">Horizontal</option><option value="v">Vertical</option><option value="hv">Both</option>
        </select></div>
      <div class="ctrl-row"><div class="ctrl-label">Scale</div>
        <select class="panel-select" id="sel-manual-scale-${i}">
          <option value="0.75">Small (75%)</option><option value="1" selected>Medium (100%)</option><option value="1.25">Large (125%)</option>
        </select></div>
    </div>`;
  }
  wrap.innerHTML = html;
  // This rebuilds on every grid/cell-count change (via
  // syncRuleAvailability), not just once at init — autoLabelPanel only
  // ran once at page load, so any rebuild after that left its fresh
  // rows unlabeled. Safe to call again: it skips rows that already have
  // a name and only fills the real gaps.
  Organica.autoLabelPanel(wrap);
}

export function pushUndo() {
  undoStack.push(structuredClone({ el: state.activeElement, components: state.components, selectedId: state.selectedId, explicit: state.selectionExplicit, tile: state.fvsGridComponentName, auto: state.componentAutoGenerated, sig: state.componentAutoGenSignature }));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  syncUndoUI();
}
export function undoComponents() {
  const snap = undoStack.pop();
  if (!snap) return;
  // the Component board's Clear board (every Element's generated components): all of them back (18-step-boards.js)
  if (snap.all) { if (hooks.boardRestoreGalleries) hooks.boardRestoreGalleries(snap.all); syncUndoUI(); return; }
  // a step taken on another Element's generated components: that Element is edited again first
  if (snap.el && snap.el !== state.activeElement && hooks.boardActivateElement) hooks.boardActivateElement(snap.el);
  state.components = snap.components; state.selectedId = snap.selectedId; state.selectionExplicit = !!snap.explicit; state.fvsGridComponentName = snap.tile;
  state.componentAutoGenerated = snap.auto; state.componentAutoGenSignature = snap.sig;
  adoptColourway(getSelectedComponent());
  renderGallery(); syncUndoUI();
}
export function pushUndoEntry(entry) { undoStack.push(structuredClone(entry)); if (undoStack.length > UNDO_MAX) undoStack.shift(); syncUndoUI(); }
export function syncUndoUI() { ctrl('btn-undo-components').disabled = (state.componentEditMode ? ceUndo.length : undoStack.length) === 0; }
ctrl('btn-undo-components').addEventListener('click', () => (state.componentEditMode ? ceUndoStep() : undoComponents()));
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z' || state.activeTier !== 'component') return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;   // keep native text undo
  e.preventDefault();
  if (state.componentEditMode) ceUndoStep(); else undoComponents();
});

// The starter set: each starter rule's first STARTER_VARIANTS_PER_RULE candidates. Rules read the grid only, so it is
// the same for every Element — the Component board draws it for an Element never opened there (18-step-boards.js).
export function starterComponents() {
  const picks = [];
  const starters = state.cellShape !== 'square'
    ? ['radial', 'checkerboard', 'identity'].map(m => ({ name: m, fn: () => latticeRule(m) }))
    : COMPONENT_STARTER_RULES;
  for (const r of starters) {
    if (r.eligible && !r.eligible()) continue;
    const out = r.fn();
    if (!out || !out.length) continue;
    for (const comp of out.slice(0, STARTER_VARIANTS_PER_RULE)) picks.push(comp);
  }
  return picks;
}
export function populateComponentStarterGallery() {
  // Runs automatically the moment you land on the Component step, nothing filtered for looking alike (Generate
  // doesn't filter either).
  const picks = starterComponents();
  state.components = picks;
  // selectedId still defaults to the first candidate — Save/Tile/Export etc.
  // all read getSelectedComponent() and several other tests/recipes rely on
  // a fresh tier entry already having a working default target. What
  // changes is state.selectionExplicit (false here): the starter gallery's
  // own pick is a passive default nobody has looked at yet, so it renders
  // with NO visible border (see renderGallery()'s isSelected) until a real
  // action — a click, Generate, quick-save, a Library load — happens.
  state.selectedId = picks.length ? picks[0].id : null;
  state.selectionExplicit = false;
  state.componentAutoGenerated = true;
  state.componentAutoGenSignature = componentElementSignature();
  renderGallery();
}

// Picking a colour variant makes its inks the Element's own, so Export, Tile
// in Grid, Component Edit and the Symbol step all see what the thumbnail shows.
export function adoptLayerInks(comp) {
  if (!comp || !comp.layerInks || !state.layers) return;
  let changed = false;
  for (const l of state.layers.items) {
    if (!(l.id in comp.layerInks)) continue;
    const v = comp.layerInks[l.id], ink = v && typeof v === 'object' ? v.ink : v, tone = v && typeof v === 'object' ? v.tone : undefined;
    if (l.ink === ink && l.tone === tone) continue;
    l.ink = ink; if (tone == null) delete l.tone; else l.tone = tone; changed = true;
  }
  if (changed) { hooks.renderLayersUI(); renderSeedPreview(); }
}

// Picking a colourway makes it the live palette (like adoptLayerInks), so Export,
// Tile, Component Edit and the Symbol step all show what the thumbnail shows.
export function adoptColourway(comp) {
  const cw = comp && comp.colourway;
  if (!cw || cwColourKey(cw) === liveColourKey()) return;
  state.colors = cw.colors.slice(); state.colorRule = { ...cw.colorRule };
  syncColorRuleUI(); buildPalette(); hooks.setPaperUI(cw.paper);
  renderSeedPreview();
}
export function generateColourways() {
  const comp = getSelectedComponent();
  if (!comp) { setStatus('error', 'Select a component first'); return; }
  // Asked again from a colourway: the mains are still the palette the first set was made from
  // (a hand-edited one — Custom — is a new starting palette).
  const base = comp.colourway && comp.colourway.scheme !== 'custom' && state.colourwayBase ? state.colourwayBase : { colors: state.colors.slice(), paper: state.paperColor, colorRule: { ...state.colorRule } };
  state.colourwayBase = base;
  const list = buildColourways(base, gridOf(comp), comp.cells.length);
  pushUndo();
  const root = String(comp.id).replace(/-cw\d+$/, '');
  state.components = list.map((cw, j) => ({ ...comp, id: `${root}-cw${j}`, savedName: null, colourway: cw }));
  state.galleryCapNote = null;
  state.selectedId = state.components[0].id;
  state.selectionExplicit = true;
  state.componentAutoGenerated = false;
  adoptColourway(state.components[0]);
  renderGallery();
}

export function generate() {
  const mode = pv('sel-rule');
  let produced = state.cellShape !== 'square' && LATTICE_RULES.has(mode) ? latticeRule(mode) : null;
  if (produced && mode === 'exhaustive' && produced.length > EXHAUSTIVE_CAP) return;
  if (!produced) switch (mode) {
    case 'identity': produced = ruleIdentity(); break;
    case 'pinwheel': produced = rulePinwheel(); break;
    case 'mirror': produced = ruleMirror(); break;
    case 'diagonal': produced = ruleDiagonal(); break;
    case 'checkerboard': produced = ruleCheckerboard(); break;
    case 'rowmirror': produced = ruleRowMirror(); break;
    case 'columnmirror': produced = ruleColumnMirror(); break;
    case 'radial': produced = ruleRadial(); break;
    case 'hlines': produced = ruleLines('row'); break;
    case 'vlines': produced = ruleLines('col'); break;
    case 'oscillator': produced = ruleOscillator(); break;
    case 'random': produced = ruleRandom(); break;
    case 'exhaustive':
      produced = ruleExhaustive();
      if (produced.length > EXHAUSTIVE_CAP) return;
      break;
    case 'manual': {
      pushUndo();
      const comp = { id: `manual-${Date.now()}`, ruleSource: 'manual', cells: readManualCells() };
      if (state.layers) comp.layerInks = currentLayerInks();
      state.components.push(comp);
      state.selectedId = comp.id;
      state.selectionExplicit = true;
      state.componentAutoGenerated = false;
      renderGallery();
      return;
    }
  }
  pushUndo();
  // Nothing is hidden: every structurally distinct candidate is listed, even
  // when this Element paints two of them alike (a Circle's 8 Pinwheels).
  // A multi-layer Element multiplies each one by every layer-ink combination.
  const expanded = expandLayerInks(produced);
  produced = expanded.list;
  state.galleryCapNote = expanded.total > expanded.list.length
    ? { list: produced, text: `Showing ${expanded.list.length} of ${expanded.total.toLocaleString()} (geometry × layer colours) — reduce inks, layers or axes to see all.` }
    : null;
  state.components = produced;
  state.selectedId = produced.length ? produced[0].id : null;
  state.selectionExplicit = true;
  state.componentAutoGenerated = false;
  renderGallery();
}

export function clearGallery() {
  pushUndo();
  state.components = [];
  state.selectedId = null;
  state.selectionExplicit = false;
  state.componentAutoGenerated = false;
  renderGallery();
}

// Element-tier split: cuts the Element's own shape at its bbox centre (a real
// geometric clip via splitElementGeometry, not a mask) and keeps ONE OR MORE
// quadrants as the Element itself, stored as one combined 'custom' seed —
// every downstream tier (Component, Symbol, Figure, export) already
// understands that. `All` restores the original. state.splitOriginal
// remembers the pre-split seed; it is re-snapshotted whenever the Element is
// no longer the piece we made (state.splitApplied), so a manual change of
// shape never restores stale data. state.splitKeep is the live multi-select
// set (empty = whole shape); state.splitCache memoises splitElementGeometry's
// Paper.js work per pre-split seed so toggling chips is cheap.
// The piece buttons follow the cell shape (splitPlan): All · TL · TR · BL · BR on a Square, All · 1 … n on a fan.
// Rebuilt only when the set changes; a cell shape change while a Split is on puts the whole shape back first.
let splitPlanKey = 'quad';
export function currentSplitPlan() { return splitPlan(state.cellShape); }
function syncSplitButtons() {
  const plan = currentSplitPlan(), key = plan.pieces.map(p => p.id).join(',');
  if (key === splitPlanKey) return;
  const wasFan = splitPlanKey !== 'quad' && splitPlanKey !== 'tl,tr,bl,br';
  splitPlanKey = key;
  const seg = ctrl('seg-split-quadrant');
  const QUARTER = { tl: 'Top left quarter', tr: 'Top right quarter', bl: 'Bottom left quarter', br: 'Bottom right quarter' };
  seg.innerHTML = `<button type="button" class="seg-btn" data-q="whole" aria-pressed="false" title="Restore the whole shape">All</button>`
    + plan.pieces.map(p => `<button type="button" class="seg-btn" data-q="${p.id}" aria-pressed="false" aria-label="${plan.kind === 'fan' ? 'Slice ' + p.label : QUARTER[p.id]}">${p.label}</button>`).join('');
  if ((wasFan || plan.kind === 'fan') && state.splitKeep.size) splitElementReset();
}
export function syncSplitUI() {
  syncSplitButtons();
  // the Shape picker shows the shape a Split was cut from (SEED_ICONS.custom follows it); the "custom" row leaves the
  // list meanwhile, so the menu never holds that shape twice — picking it (or All) gives the whole shape back
  const customOpt = ctrl('sel-seed-type').querySelector('option[value="custom"]');
  if (customOpt) customOpt.disabled = splitIsOn();
  seedPicker.invalidate('custom');
  ctrl('seg-split-quadrant').querySelectorAll('.seg-btn').forEach(b => {
    const q = b.dataset.q;
    const on = q === 'whole' ? state.splitKeep.size === 0 : state.splitKeep.has(q);
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
  ctrl('btn-split-save').hidden = state.splitKeep.size === 0;   // below the chips: appearing never moves them
}
export function splitElementReset() {
  const status = ctrl('split-status');
  if (splitLayersOn()) {   // a layered Element: its layers as they were before the cut
    state.layers = JSON.parse(JSON.stringify(state.splitOriginalLayers));
    const L = state.layers, act = L.items[L.active];
    if (act) hooks.applyPanelSeedRaw(hooks.layerPanelSeed(L, act));
    hooks.renderLayersUI();
  }
  state.splitOriginalLayers = null; state.splitLayersApplied = null;
  if (state.splitOriginal && state.customSeed === state.splitApplied) {
    hooks.applySeedToPanel(state.splitOriginal);
    if (state.splitOriginalStyle) hooks.fireChange('sel-element-fillmode', state.splitOriginalStyle);
  }
  state.splitOriginal = null; state.splitApplied = null; state.splitOriginalStyle = null;
  state.splitCache = null; state.splitCombinedRaw = null; state.splitKeep.clear();
  renderGallery(); renderSeedPreview();
  syncSplitUI();
  status.textContent = '';   // the All chip says it
}
export function toggleSplitQuadrant(q) {
  if (state.splitKeep.has(q)) state.splitKeep.delete(q); else state.splitKeep.add(q);
  if (state.splitKeep.size === 0 || state.splitKeep.size === currentSplitPlan().pieces.length) { splitElementReset(); return; }
  splitElementApply();
}
// raw `d` → the Element's 0..100 box as drawn: the geometry's norm layer, then Scale / Move / Rotation / Width / Length
export function splitViewMatrix(geo) {
  const ns = geo.normScale || 1;
  return appearanceMatrix(getElementAppearance()).translate((geo.normTx || 0) * ns, (geo.normTy || 0) * ns).scale(ns);
}
// A layered Element (Diego, Oct 13, 2026: "keep the layers and their colours"): each layer is cut on its own, in
// place — the kept slices / quarters of ITS shape, as drawn (its place + look, then the Element's appearance), cut at
// the same canvas centre as every other layer — and becomes a custom piece in its own raw space with its own norm, so
// it draws exactly where it was, with its ink, role and look. A divided Element's part layers are cut the same way.
// All gives the layers back (state.splitOriginalLayers). A layer with nothing in the kept pieces draws nothing.
function layerViewMatrix(l, geo) {
  const a = getElementAppearance(), probe = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const appT = appearanceIsIdentity(a) ? '' : Organica.shapeAppearance.stretchTransformAttr(a.w, a.l, 50, stretchOpts(a));
  probe.setAttribute('transform', (appT + ' ' + layerTransformAttr(l, geo)).trim());
  const m = probe.transform.baseVal.consolidate();
  return m ? m.matrix : new DOMMatrix();
}
function splitLayersApply() {
  const status = ctrl('split-status');
  if (!splitLayersOn()) { hooks.syncActiveLayer(); state.splitOriginalLayers = JSON.parse(JSON.stringify(state.layers)); }
  const orig = JSON.parse(JSON.stringify(state.splitOriginalLayers)), plan = currentSplitPlan();
  const stack = SEED_TYPES.stack.geometry({ type: 'stack', active: orig.active, layers: orig.items, ...(orig.parts ? { parts: orig.parts } : {}), ...(state.cellShape !== 'square' ? { cellShape: state.cellShape } : {}) });
  const keep = plan.pieces.map(p => p.id).filter(q => state.splitKeep.has(q)), viewDs = [];
  let any = false;
  const items = orig.items.map(item => {
    const r = (stack.layers || []).find(x => x.id === item.id), g = r && r.geo;
    if (!r || !g || !g.d || item.role === 'pattern') return item;
    const M = layerViewMatrix(r, g), pieces = splitElementGeometry(g.d, g.fillRule, M, plan);
    const kept = keep.map(q => pieces.find(p => p.id === q)).filter(Boolean), d = kept.map(p => p.seed.d).join(' ');
    if (d) {
      any = true;
      try { const scope = splitPaperScope(), cp = new scope.CompoundPath(d); cp.transform(new scope.Matrix(M.a, M.b, M.c, M.d, M.e, M.f)); viewDs.push(cp.pathData); cp.remove(); } catch (e) { /* the Seed save only */ }
    }
    const from = item.part && orig.parts ? orig.parts.source.type : item.seed && item.seed.type;
    const out = { ...item, seed: { ...(item.seed || (orig.parts && orig.parts.source) || {}), type: 'custom', splitFrom: from, innerCount: 0, irregular: 0,
      customSeed: { d, normTx: g.normTx || 0, normTy: g.normTy || 0, normScale: g.normScale || 1, ...(g.fillRule ? { fillRule: g.fillRule } : {}), placed: true } } };
    delete out.part;
    return out;
  });
  if (!any) { status.textContent = plan.kind === 'fan' ? 'Those slices are empty — the shape has no material there.' : 'Those quadrants are empty — the shape has no material there.'; syncSplitUI(); return; }
  state.layers = { ...orig, items };
  state.splitLayersApplied = state.layers;
  state.splitCombinedRaw = viewDs.join(' ');
  const act = state.layers.items[state.layers.active];
  if (act) hooks.applyPanelSeedRaw(act.seed);
  hooks.renderLayersUI();
  renderGallery(); renderSeedPreview();
  syncSplitUI();
  status.textContent = '';
}
export function splitElementApply() {
  const status = ctrl('split-status');
  if (state.layers || splitLayersOn()) { splitLayersApply(); return; }
  const { stillOurs, original } = splitCurrentOriginal();
  if (!stillOurs && elementIsEmpty()) { status.textContent = 'Draw or pick a Seed first — nothing to split.'; state.splitKeep.clear(); syncSplitUI(); return; }
  const geo = SEED_TYPES[original.type].geometry(original);
  if (!geo || !geo.d) { status.textContent = 'This Element has no visible shape to split.'; state.splitKeep.clear(); syncSplitUI(); return; }
  // cut on what the canvas shows: the norm layer, then the Element's appearance (splitViewMatrix)
  const view = splitViewMatrix(geo), plan = currentSplitPlan();
  const key = JSON.stringify([original, view.toString(), plan.pieces.map(p => p.id)]);
  if (!state.splitCache || state.splitCache.key !== key) {
    state.splitCache = { key, pieces: splitElementGeometry(geo.d, geo.fillRule, view, plan) };
  }
  const pieces = state.splitCache.pieces;
  const kept = plan.pieces.map(p => p.id).filter(q => state.splitKeep.has(q)).map(q => pieces.find(p => p.id === q)).filter(Boolean);
  if (!kept.length) { status.textContent = plan.kind === 'fan' ? 'Those slices are empty — the shape has no material there.' : 'Those quadrants are empty — the shape has no material there.'; syncSplitUI(); return; }
  // Each kept piece's seed.d is its RAW (unfitted) pathData (fitPathToSeed's
  // `d` field is the input unchanged) — concatenating them and fitting the
  // whole against the shared frameBB keeps every piece at its original place
  // and size, so several kept quadrants reassemble exactly like the original.
  const combinedRaw = kept.map(p => p.seed.d).join(' ');
  // The pieces are in the shape's raw space: they take the whole shape's own placement (its norm layer, as the cell
  // fitted it) and are marked `placed`, so a non-square cell does not fit them a second time (Oct 13, 2026 — a fan
  // slice was moved off its wedge). A Segment's stroke ribbon keeps the frame fit it always had.
  const fitted = kept[0].strokeConv ? fitPathToSeed(combinedRaw, kept[0].frameBB)
    : { d: combinedRaw, normTx: geo.normTx || 0, normTy: geo.normTy || 0, normScale: geo.normScale || 1, ...(geo.fillRule ? { fillRule: geo.fillRule } : {}), placed: true };
  if (!fitted) { status.textContent = 'Could not combine the kept pieces.'; return; }
  if (!stillOurs) state.splitOriginalStyle = pv('sel-element-fillmode');
  state.splitOriginal = JSON.parse(JSON.stringify(original));
  state.splitCombinedRaw = combinedRaw;
  // innerCount forced to 0: Inner Seed rings are already baked into the clipped
  // `d`; 'custom' runs back through withInnerCopies, which would nest a second set.
  hooks.applySeedToPanel({ ...original, type: 'custom', customSeed: fitted, innerCount: 0 });
  const strokeConv = kept.some(p => p.strokeConv);
  if (strokeConv && pv('sel-element-fillmode') !== 'fill') hooks.fireChange('sel-element-fillmode', 'fill');
  state.splitApplied = state.customSeed;
  renderGallery(); renderSeedPreview();
  syncSplitUI();
  status.textContent = '';   // the pressed chips say what is kept; the line is for problems only
}
export function savePieceAsSeed() {
  const status = ctrl('split-status');
  const raw = state.splitCombinedRaw;
  if (!raw) return;
  const scope = splitPaperScope();
  let src;
  try { src = new scope.CompoundPath(raw); } catch (e) { status.textContent = 'Could not save this piece.'; return; }
  const b = src.bounds;
  if (!b || b.width <= 0 || b.height <= 0) { src.remove(); status.textContent = 'Could not save this piece.'; return; }
  const s = 180 / Math.max(b.width, b.height);
  src.scale(s, b.center);
  src.position = new scope.Point(100, 100);
  const d = src.pathData;
  src.remove();
  // the saved Seed's name: the shape's own name (never the engine's "Custom (uploaded)") + what was kept, in words —
  // "Polygon · slice 6", "Polygon · slices 1, 2, 4", "Square · top left quarter" (design-system audit, Oct 13, 2026)
  const srcType = state.splitOriginal ? state.splitOriginal.type : getSeed().type;
  const typeLabel = srcType === 'custom' || !SEED_TYPES[srcType] ? 'Element' : ((SEED_ICONS[srcType] || {}).name || SEED_TYPES[srcType].label);
  const plan = currentSplitPlan(), keptP = plan.pieces.filter(p => state.splitKeep.has(p.id));
  const QW = { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' };
  const what = plan.kind === 'fan' ? (keptP.length === 1 ? 'slice ' : 'slices ') + keptP.map(p => p.label).join(', ')
    : keptP.length === 1 ? QW[keptP[0].id] + ' quarter' : 'quarters ' + keptP.map(p => QW[p.id]).join(', ');
  const name = typeLabel + ' · ' + what;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="${d}" fill="var(--ink)"/></svg>`;
  const lib = Organica.store.library.read();
  lib.forms = lib.forms || []; lib.sets = lib.sets || [];
  const id = 'seed-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  lib.forms.push({ id, name, svg, type: 'asset', builtIn: false });
  let mySet = lib.sets.find(x => x.id === 'set-my-seeds');
  if (!mySet) { mySet = { id: 'set-my-seeds', name: 'My Seeds', builtIn: false, forms: [] }; lib.sets.push(mySet); }
  if (!mySet.forms) mySet.forms = [];
  mySet.forms.push(id);
  Organica.store.library.write(lib);
  if (hooks.libviewIsOpen()) hooks.renderLibview();
  useSvgAsSeed(svg);
  state.splitOriginal = null; state.splitApplied = null; state.splitOriginalStyle = null;
  state.splitCache = null; state.splitCombinedRaw = null; state.splitKeep.clear();
  syncSplitUI();
  status.textContent = '';   // no message (Diego, Oct 13, 2026): the Element on the canvas is the saved piece
}

// ── Export ──
export function exportSelected(format) {
  const comp = getSelectedComponent();
  if (!comp) return;
  state.selectedRuleSource = comp.ruleSource;
  const grid = gridOf(comp);
  const seed = getSeed();
  const items = buildComponentItems(comp, grid);
  const baseDims = frameDims(grid);
  const isPrint = printSizePanel.getMode() === 'print';

  if (format === 'svg') {
    const svg = isPrint ? buildPrintComponentSVG(items, seed, baseDims.w, baseDims.h) : buildComponentSVG(items, seed, baseDims);
    Organica.download(new Blob([svg], { type: 'image/svg+xml' }), Organica.stamp('fvs', 'svg'));
    return;
  }

  if (isPrint) {
    const p = printComponentDims(baseDims.w, baseDims.h);
    const off = document.createElement('canvas');
    off.width = p.outW; off.height = p.outH;
    const ctx = off.getContext('2d');
    fillPaper(ctx, state.paperColor, 0, 0, p.outW, p.outH);
    ctx.save();
    ctx.translate(p.bleedPx, p.bleedPx);
    ctx.scale(p.scale, p.scale);
    drawComponentCanvas(ctx, items, seed, baseDims);
    ctx.restore();
    if (p.bleedPx > 0) {
      ctx.save();
      ctx.translate(p.bleedPx, p.bleedPx);
      Organica.printSize.drawCropMarksCanvas(ctx, p.trimWpx, p.trimHpx, {}, '#000');
      ctx.restore();
    }
    off.toBlob(async blob => {
      const bytes = Organica.printSize.embedPngDpi(await blob.arrayBuffer(), p.dpi);
      Organica.download(new Blob([bytes], { type: 'image/png' }), Organica.stamp('fvs', 'png'));
    });
    return;
  }

  const scale = parseInt(pv('sel-export-scale'), 10);
  const off = document.createElement('canvas');
  off.width = baseDims.w * scale; off.height = baseDims.h * scale;
  const ctx = off.getContext('2d');
  ctx.save();
  ctx.scale(scale, scale);
  drawComponentCanvas(ctx, items, seed, baseDims);
  ctx.restore();
  off.toBlob(blob => {
    Organica.download(blob, Organica.stamp('fvs', 'png'));
  });
}

// ── Seed UI — Base/Height only mean anything for the triangle,
// Thickness only for the arc; an upload has no adjustable params. ──
export function syncSeedUI() {
  const type = pv('sel-seed-type');
  ctrl('seed-triangle-block').style.display = type === 'triangle' ? '' : 'none';
  ctrl('seed-arc-block').style.display = type === 'arc' ? '' : 'none';
  ctrl('seed-arctruchet-block').style.display = type === 'arctruchet' ? '' : 'none';
  ctrl('seed-wedge-block').style.display = type === 'wedge' ? '' : 'none';
  ctrl('seed-polygon-block').style.display = type === 'polygon' ? '' : 'none';
  ctrl('seed-star-block').style.display = type === 'star' ? '' : 'none';
  ctrl('seed-roundedrect-block').style.display = type === 'roundedrect' ? '' : 'none';
  ctrl('seed-chevron-block').style.display = type === 'chevron' ? '' : 'none';
  ctrl('seed-cross-block').style.display = type === 'cross' ? '' : 'none';
  ctrl('seed-lens-block').style.display = type === 'lens' ? '' : 'none';
  ctrl('seed-circle-block').style.display = type === 'circle' ? '' : 'none';
  ctrl('seed-segment-block').style.display = type === 'segment' ? '' : 'none';
  ctrl('seed-drop-block').style.display = type === 'drop' ? '' : 'none';
  ctrl('seed-blob-block').style.display = type === 'blob' ? '' : 'none';
  ctrl('seed-freehand-block').style.display = type === 'freehand' ? '' : 'none';
  { const off = INNER_UNSUPPORTED.has(type);
    ['rg-inner-count', 'rg-inner-ratio', 'sel-inner-anchor'].forEach(id => { ctrl(id).disabled = off; });
    ctrl('inner-unsupported').style.display = off ? '' : 'none';
    const hasApex = !!INNER_APEX[type], sel = ctrl('sel-inner-anchor');
    sel.querySelector('option[value="apex"]').disabled = !hasApex;
    if (!hasApex && sel.value === 'apex') { sel.value = val('rg-element-cutout') > 0 ? 'incentre' : 'centroid'; renderGallery(); renderSeedPreview(); } }
  syncDependentRows();
  seedPicker.refresh();
  syncFreehandEditor();
}
