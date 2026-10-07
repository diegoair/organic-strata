// Flexible Visual System · engine/16-figure-eval — the pure Figure evaluator: a recipe in, its SVG out.
// An ES module of the Figure tier (loaded on demand by ./figure.js). It imports only earlier files. docs/FVS.md §12.
//
// evalFigure(recipe) renders a figure exactly as runFigureRecipe() does (byte for byte — scripts/test-figure-eval.sh),
// but never touches the page or what the user is working on: it runs inside withFigureSandbox(), which
//   · starts from FVS as it was at boot (figurePristine: the model cloned + a virtual panel), so the result depends
//     on the recipe alone, not on the Shape or colours on screen;
//   · reads controls through the panel reader (pv / pc / pr) pointed at that virtual panel;
//   · keeps Library writes (the Grid's auto "Tile ·" entry, a sealed Symbol's Components) in memory;
//   · puts every original object back afterwards — state, live, the panel reader, the Library.
// No DOM events fire and nothing re-renders, so it is also what a node graph calls once per variation.
import {
  DEFAULT_COLOR_RULE, cloneModel, figurePristine, live, panelSource, state
} from './00-core.js';
import {
  resolveGridCells
} from './01-geometry.js';
import {
  seedForSnapshot
} from './02-seed-ui.js';
import {
  getSelectedComponent
} from './06-component-ui.js';
import {
  LIBRARY, PAPER_NONE, buildLibraryEntry, hexKey, isPaperNone
} from './07-library.js';
import {
  LIVE_SYMBOL, buildFvsGridSVG, defaultSymbolCells, getFvsGrid, getSymbolGrid, hexLoomModel, squareLoomModel,
  triangleLoomModel, withPlacementDefaults
} from './08-symbol-grid.js';
import {
  FIGURE_MAX_SHAPES, applyClassRules, componentCellsFromRule, figureSVGOf, gridTypeFromLattice,
  isSealedSymbol, promoteFigureToTile, validateFigureRecipe
} from './13-figure-engine.js';

const clone = o => JSON.parse(JSON.stringify(o));

// Run fn(panel) with FVS swapped for its boot-time copy; always restore. `panel` sets a virtual control.
export function withFigureSandbox(fn) {
  if (!figurePristine.state) throw new Error('The Figure evaluator is not ready yet — FVS is still starting');
  const savedState = { ...state }, savedLive = { ...live }, savedReader = { ...panelSource };
  const savedLib = { read: LIBRARY.read, peek: LIBRARY.peek, write: LIBRARY.write };
  const replace = (target, src) => { for (const k of Object.keys(target)) delete target[k]; Object.assign(target, src); };
  const ctl = new Map();
  for (const [id, c] of figurePristine.panel) ctl.set(id, { ...c });
  const get = id => { const c = ctl.get(id); if (!c) throw new Error('No control #' + id); return c; };
  const panel = {
    set(id, v) { const c = get(id); c.value = figurePristine.sanitize ? figurePristine.sanitize(id, v) : String(v); },
    get: id => get(id).value,
  };
  let lib = clone(savedLib.read.call(LIBRARY));
  try {
    replace(state, cloneModel(figurePristine.state));
    replace(live, cloneModel(figurePristine.live));
    Object.assign(panelSource, {
      value: id => get(id).value,
      checked: id => get(id).checked,
      read: id => { const c = get(id); return c.type === 'checkbox' ? c.checked : c.value; },
    });
    LIBRARY.read = () => clone(lib);
    LIBRARY.peek = () => lib;
    LIBRARY.write = obj => { lib = clone(obj); };
    return fn(panel);
  } finally {
    replace(state, savedState);
    replace(live, savedLive);
    Object.assign(panelSource, savedReader);
    Object.assign(LIBRARY, savedLib);
  }
}

// ── The steps runFigureRecipe() takes through the panel, as model-only operations ──
function setPaper(c) { state.paperColor = isPaperNone(c) ? PAPER_NONE : hexKey(c); }
function setComponentGridSpec(panel, spec) {   // setComponentGrid() for the specs a Figure recipe uses
  let cols = 2, rows = 2;
  if (typeof spec === 'string') { const m = spec.match(/^square(\d)x(\d)$/); if (m) { cols = +m[1]; rows = +m[2]; } }
  else if (spec && spec.kind === 'loom') {
    state.loomGrid = { cellShape: spec.cellShape, cells: spec.cells, inner: { width: spec.width, height: spec.height } };
    return;
  } else if (spec) { cols = spec.cols; rows = spec.rows || spec.cols; }
  state.loomGrid = null;
  panel.set('rg-grid-cols', String(Math.min(4, Math.max(1, cols))));
  panel.set('rg-grid-rows', String(Math.min(4, Math.max(1, rows))));
}
function loadSymbolGridModel(model) {   // loadSymbolGridNow() without its views
  state.symbolGrid = Organica.loadLoomGrid(model);
  state.symbolSuggestions = [];
  state.symbolCells = defaultSymbolCells(getSymbolGrid());
  state.symbolSelection.clear();
  state.symbolClipEnabled = false;
}
function tileSelected() {   // tileSelectedInGrid(): the Component becomes the Grid's tile (an auto Library entry)
  const comp = getSelectedComponent();
  if (!comp) return;
  const name = 'Tile · ' + comp.id, all = LIBRARY.read();
  all[name] = { ...buildLibraryEntry(), auto: true }; LIBRARY.write(all);
  state.fvsGridComponentName = name;
}
function sealedSymbolLevel(first) {   // runSealedSymbolLevel()
  const l = first.lattice;
  if (!l || l.type !== 'loomModel' || !l.model) throw new Error('An adopted Symbol needs its Loom grid (lattice.type "loomModel")');
  if (first.componentEntries) {
    const all = LIBRARY.read(); let added = false;
    Object.entries(first.componentEntries).forEach(([name, entry]) => { if (!all[name] && entry) { all[name] = clone(entry); added = true; } });
    if (added) LIBRARY.write(all);
  }
  if (first.colors) { state.colors = first.colors.map(hexKey); state.colorRule = { ...DEFAULT_COLOR_RULE, ...(first.colorRule || {}) }; }
  if (first.paperColor) setPaper(hexKey(first.paperColor));
  loadSymbolGridModel(clone(l.model));
  if (first.cells.length !== getSymbolGrid().cells.length) throw new Error(`The adopted Symbol has ${first.cells.length} cells but its grid has ${getSymbolGrid().cells.length}`);
  state.symbolCells = first.cells.map(c => withPlacementDefaults(clone(c)));
  state.symbolClipEnabled = first.clip !== false;
}

// The figure a recipe (v2) describes → { svg, tier, levels: {component, symbol}, metas, stats, shapes }.
// Throws on an invalid recipe or one over the shape budget, like runFigureRecipe().
export function evalFigure(def) {
  const lv = validateFigureRecipe(def);
  return withFigureSandbox(panel => {
    const el = def.element;
    panel.set('sel-seed-type', el.type);
    Object.entries(el.params || {}).forEach(([id, v]) => panel.set(id, v));
    panel.set('sel-element-fillmode', el.style || 'fill');
    if (el.strokeW) panel.set('rg-element-strokew', el.strokeW);
    state.colors = (el.colors || ['#000000']).map(hexKey);
    state.colorRule = { ...DEFAULT_COLOR_RULE, ...(el.colorRule || {}) };
    setPaper(hexKey(el.paper || '#ffffff'));
    const first = lv[0], grids = lv.slice(1), gridLv = grids[0];
    let tier;
    state.fvsGridRaw = null; state.figureLevelStats = []; state.figureLevelMeta = [];
    if (first.kind === 'component') {
      setComponentGridSpec(panel, first.grid || 'square2x2');
      const comp = { id: 'figure-component', ruleSource: 'recipe', cells: first.cells || componentCellsFromRule(first.rule, first.params) };
      state.components = [comp]; state.selectedId = comp.id; state.selectionExplicit = true; state.componentAutoGenerated = false;
      tier = 'component';
      if (gridLv) tileSelected();
    } else if (isSealedSymbol(first)) {
      sealedSymbolLevel(first);
      tier = 'symbol';
      if (gridLv) { state.fvsGridSymbolName = LIVE_SYMBOL; state.fvsGridComponentName = null; }
    } else {
      const l = first.lattice;
      loadSymbolGridModel(l.type === 'triangle' ? triangleLoomModel(l.rows) : l.type === 'hexagon' ? hexLoomModel(l.rings) : squareLoomModel(l.cols, l.rows || l.cols));
      const fit = first.fit || (l.type === 'triangle' ? 'fill' : 'contain');
      state.symbolCells.forEach(c => { c.source = 'seed'; c.seedType = el.type; c.fitMode = fit; c.rotation = 0; c.flipH = false; c.flipV = false; c.scale = 1; c.color = null; });
      if (first.seed === 'live') {
        const sp = seedForSnapshot();
        state.symbolCells.forEach(c => { c.seedParams = clone(sp); });
      } else state.symbolCells.forEach(c => { delete c.seedParams; });
      applyClassRules(first.rules, el.type);
      tier = 'symbol';
      if (gridLv) { state.fvsGridSymbolName = LIVE_SYMBOL; state.fvsGridComponentName = null; }
    }
    const tr = def.transform || {};
    let shapes = first.kind === 'symbol' ? state.symbolCells.filter(c => c.source !== 'empty').length : (getSelectedComponent() ? getSelectedComponent().cells.length : 0);
    grids.forEach((g, gi) => {
      const last = gi === grids.length - 1;
      tier = 'grid';
      const t = g.transform || (last ? tr : {});
      state.fvsGridConfig = { ...state.fvsGridConfig, type: gridTypeFromLattice(g.lattice), cellSize: g.cellSize || 110, gap: 0, altFlip: !!g.altFlip, rot: t.rotate || 0, mirror: t.mirror || 'none' };
      const tiles = resolveGridCells(getFvsGrid()).length, copies = t.mirror === 'vh' ? 4 : (t.mirror === 'v' || t.mirror === 'h') ? 2 : 1;
      state.figureLevelStats.push({ tiles, copies });
      shapes *= tiles * copies;
      if (shapes > FIGURE_MAX_SHAPES) throw new Error(`Too many shapes (${shapes}) — the limit is ${FIGURE_MAX_SHAPES}`);
      if (!last) { const svg = buildFvsGridSVG(); state.figureLevelMeta[gi] = live.lastFigureMeta; state.fvsGridRaw = promoteFigureToTile(svg); }
    });
    if (!grids.length) { state.fvsGridConfig.rot = tr.rotate || 0; state.fvsGridConfig.mirror = tr.mirror || 'none'; }
    const svg = figureSVGOf(tier);
    const metas = state.figureLevelMeta.slice(); if (grids.length) metas[grids.length - 1] = live.lastFigureMeta;
    const stats = state.figureLevelStats.slice();
    const levels = { component: figureSVGOf('component'), symbol: figureSVGOf('symbol') };
    return { svg, tier, levels, metas, stats, shapes };
  });
}
