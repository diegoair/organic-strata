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
  mulberry32
} from './03-rules.js';
import {
  getSelectedComponent
} from './06-component-ui.js';
import {
  LIBRARY, PAPER_NONE, buildLibraryEntry, hexKey, isPaperNone
} from './07-library.js';
import {
  LIVE_SYMBOL, buildFvsGridSVG, defaultSymbolCells, getFvsGrid, getSymbolGrid, hexLoomModel, snapPose, squareLoomModel, symbolFrame,
  triangleLoomModel, withPlacementDefaults
} from './08-symbol-grid.js';
import {
  SYMBOL_ARRANGE, symbolCellContext
} from './10-suggest.js';
import {
  SYMBOL_RULES, snap90, symbolPastePlan
} from './11-symbol-ui.js';
import {
  figureChecks
} from './14-figure-ui.js';
import {
  FIGURE_MAX_SHAPES, applyClassRules, componentCellsFromRule, figureSVGOf, gridTypeFromLattice, squareCR,
  isSealedSymbol, promoteFigureToTile, ruleMatches, slotClassContext, validateFigureRecipe
} from './13-figure-engine.js';

const clone = o => JSON.parse(JSON.stringify(o));

// A saved Element / Component (with a copy of its entry) → the patch a Symbol cell takes (the Library rail's railPatch,
// from the copy). Used by the Figure graph's content and by Composition rules that drop content into cells.
export function contentPatch(c, fit) {
  const base = { rotation: 0, flipH: false, flipV: false, fitMode: fit || 'contain', scale: 1, padding: 0, anchorX: 0, anchorY: 0, colourway: null };
  if (c.kind === 'component') return { ...base, source: 'component', componentName: c.name, span: true, ownColors: null, ownPaper: null, ownAppearance: null };
  const e = c.entry || {};
  const sp = clone(e.seed), o = e.orientation || {};
  if (sp.type === 'stack') sp.layers.forEach(l => { if (l.ink == null || l.ink === 'cell') l.ink = 0; });
  return { ...base, source: 'seed', seedType: sp.type, seedParams: sp, color: null,
    ownColors: e.colors && e.colors.length ? e.colors.slice() : null, ownPaper: e.paperColor || null, ownAppearance: e.appearance || null,
    rotation: o.rotation || 0, flipH: !!o.flipH, flipV: !!o.flipV };
}
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
    Object.entries(first.componentEntries).forEach(([name, entry]) => { if (entry && JSON.stringify(all[name]) !== JSON.stringify(entry)) { all[name] = clone(entry); added = true; } });   // the copy carried with the Figure wins over a same-named library entry (sandboxed library — the user's is untouched)
    if (added) LIBRARY.write(all);
  }
  if (first.colors) { state.colors = first.colors.map(hexKey); state.colorRule = { ...DEFAULT_COLOR_RULE, ...(first.colorRule || {}) }; }
  if (first.paperColor) setPaper(hexKey(first.paperColor));
  loadSymbolGridModel(clone(l.model));
  if (first.cells.length !== getSymbolGrid().cells.length) throw new Error(`The adopted Symbol has ${first.cells.length} cells but its grid has ${getSymbolGrid().cells.length}`);
  state.symbolCells = first.cells.map(c => withPlacementDefaults(clone(c)));
  state.symbolClipEnabled = first.clip !== false;
  if (first.rules && first.rules.length) applyRulesToContent(first.rules, first.paletteColourway);
}
// Cell rules on a sealed level (the Figure graph's cells hold content patches): applyClassRules()'s order and
// matching, but "filled" puts back the cell's own content (or a Seed of `do.seed`), never a bare Seed. Composition
// rules add: content: {kind, name, entry} (drop saved content into the cells), toggle (empty ↔ its content), color.
// Region rules (Phase 5b) add: symbolRule {name, params, seed, vary} — a Symbol-step rule over the region's cells only;
// arrange {rule, pool: [content…], seed, fit?} — the region gets content by an Arrange class (fit: the Symbol Arrange's Fit); pattern {patType, patSpacing,
// patWeight, patAngle} — a pattern fill (the cell's appearance patch). Seeded rules draw in cell order.
// paste {name, at: [row, col], entry: {gridModel, cells}, components} — a saved Symbol cell by cell (symbolPastePlan);
// Compose (Oct 8, 2026 — the Symbol step's Cell properties over region rules) adds: cell {fitMode, coverAxis,
// fixedSize, padding, seedParams} — the Cell properties fields a rotate / flip / scale / colour rule does not carry,
// copied onto the cell as Symbol's patchCell does (seedParams only on a Seed cell; null = back to the default shape).
const CELL_KEYS = ['fitMode', 'coverAxis', 'fixedSize', 'padding', 'seedParams', 'anchorX', 'anchorY'];
const COMPOSE_CELL_FIELDS = ['source', 'seedType', 'componentName', 'colourway', 'rotation', 'flipH', 'flipV', 'fitMode', 'coverAxis', 'scale', 'fixedSize', 'color', 'padding', 'seedParams', 'anchorX', 'anchorY'];
function applyRulesToContent(rules, cw) {   // cw: the Palette's colourway, given to every Component a rule puts in a cell
  const own = state.symbolCells.map(c => clone(c)), G = getSymbolGrid(), ctxs = slotClassContext(G), sctx = symbolCellContext(G);
  const rngs = rules.map(r => { const d = r.do || {}, sd = (d.symbolRule && d.symbolRule.seed) || (d.arrange && d.arrange.seed) || 0; return mulberry32(sd >>> 0); });
  const pastes = rules.map(r => r.do && r.do.paste ? new Map(symbolPastePlan(r.do.paste.entry, ctxs, r.do.paste.at)) : null);   // a Symbol put in the cells
  state.symbolCells.forEach((cell, i) => {
    rules.forEach((r, ri) => {
      if (r.off || !ruleMatches(r.when || {}, ctxs[i])) return;
      const d = r.do || {};
      if (pastes[ri]) { const src = pastes[ri].get(i); if (src) { Object.assign(cell, withPlacementDefaults(clone(src))); if (cw && cell.source === 'component') cell.colourway = clone(cw); own[i] = clone(cell); } return; }
      if (d.symbolRule && SYMBOL_RULES[d.symbolRule.name]) {
        const sr = d.symbolRule, vary = { rotation: true, flip: true, scale: false, ...(sr.vary || {}) };
        const t = SYMBOL_RULES[sr.name].fn(sctx[i], sr.params || {}, rngs[ri]) || {};
        if (t.empty != null) { if (t.empty) cell.source = 'empty'; else { if (cell.source === 'empty') Object.assign(cell, { source: own[i].source === 'empty' ? 'seed' : own[i].source }); cell.rotation = t.turn || 0; } return; }
        if (vary.rotation && t.rotation != null) cell.rotation = Math.round((((t.rotation % 360) + 360) % 360) * 100) / 100;
        if (vary.flip) { if (t.flipH != null) cell.flipH = t.flipH; if (t.flipV != null) cell.flipV = t.flipV; }
        if (vary.scale && t.scale != null) cell.scale = t.scale;
        return;
      }
      if (d.arrange && (d.arrange.pool || []).length) {
        const A = SYMBOL_ARRANGE[d.arrange.rule] || SYMBOL_ARRANGE.random, pool = d.arrange.pool, k = d.arrange.rule === 'checker' ? Math.min(2, pool.length) : pool.length;
        const pick = A.cls ? pool[((A.cls(sctx[i], k) % k) + k) % k] : pool[Math.floor(rngs[ri]() * pool.length)];
        Object.assign(cell, withPlacementDefaults(contentPatch(pick, d.arrange.fit || cell.fitMode)), { rotation: sctx[i].orient === 'down' ? 180 : 0 }); if (cw && cell.source === 'component') cell.colourway = clone(cw); own[i] = clone(cell);
        return;
      }
      if (d.pattern) cell.appearancePatch = { fillMode: 'pattern', patType: d.pattern.patType || 'lines', patSpacing: +d.pattern.patSpacing || 8, patWeight: +d.pattern.patWeight || 2, patAngle: d.pattern.patAngle != null ? +d.pattern.patAngle : 45 };
      if (d.content && typeof d.content === 'object') { const pose = { rotation: cell.rotation, flipH: cell.flipH, flipV: cell.flipV }; Object.assign(cell, withPlacementDefaults(contentPatch(d.content, cell.fitMode)), d.keepPose ? pose : {}); if (cw && cell.source === 'component') cell.colourway = clone(cw); own[i] = clone(cell); }
      else if (d.toggle) { if (cell.source === 'empty') Object.assign(cell, { source: own[i].source === 'empty' ? 'seed' : own[i].source }); else cell.source = 'empty'; }
      else if (d.content === 'empty') cell.source = 'empty';
      else if (d.content === 'filled') { Object.assign(cell, d.seed ? { source: 'seed', seedType: d.seed } : { source: own[i].source === 'empty' ? 'seed' : own[i].source }); }
      if (d.color) cell.color = d.color;
      if (d.rotate != null) cell.rotation = snapPose(d.rotate === 'sector' ? 60 * (ctxs[i].sector || 0) : d.rotate);
      if (d.flipH != null) cell.flipH = !!d.flipH;
      if (d.flipV != null) cell.flipV = !!d.flipV;
      if (d.scale != null) cell.scale = d.scale;
      if (d.cell) CELL_KEYS.forEach(k => { if (!(k in d.cell)) return; if (k === 'seedParams' && cell.source !== 'seed') return; if (d.cell[k] == null) delete cell[k]; else cell[k] = clone(d.cell[k]); });
    });
  });
}

// The figure a recipe (v2) describes → { svg, tier, levels: {component, symbol}, metas, stats, shapes }.
// Throws on an invalid recipe or one over the shape budget, like runFigureRecipe().
export function evalFigure(def, opts) {
  const lv = validateFigureRecipe(def);
  return withFigureSandbox(panel => {
    const el = def.element;
    panel.set('sel-seed-type', el.type);
    Object.entries(el.params || {}).forEach(([id, v]) => panel.set(id, v));
    panel.set('sel-element-fillmode', el.style || 'fill');
    if (el.strokeW) panel.set('rg-element-strokew', el.strokeW);
    state.colors = (el.colors || ['#000000']).map(hexKey);
    state.colorRule = { ...DEFAULT_COLOR_RULE, ...(el.colorRule || {}) };
    setPaper(isPaperNone(el.paper) ? PAPER_NONE : hexKey(el.paper || '#ffffff'));
    if (el.ground) {   // the Paper pattern (a Figure Palette's, O-45): the Appearance's own controls, set as the panel would
      const g = el.ground; live.paperPatternOn = true;
      panel.set('sel-ground-pattern', g.patType || 'lines'); panel.set('rg-ground-patspacing', g.patSpacing ?? 4);
      panel.set('rg-ground-patweight', g.patWeight ?? 0.75); panel.set('rg-ground-patangle', g.patAngle ?? -45); panel.set('sel-ground-ink', g.ink || 0);
    }
    const first = lv[0], grids = lv.slice(1), gridLv = grids[0];
    let tier;
    state.fvsGridRaw = null; state.figureLevelStats = []; state.figureLevelMeta = [];
    if (first.kind === 'component') {
      setComponentGridSpec(panel, first.grid || 'square2x2');
      const gm = String(first.grid || 'square2x2').match(/^square(\d)x(\d)$/), big = gm && (+gm[1] !== 2 || +gm[2] !== 2);   // beyond 2 × 2 the rule reads each cell's place (was: the 2 × 2 poses repeated)
      const comp = { id: 'figure-component', ruleSource: 'recipe', cells: first.cells || componentCellsFromRule(first.rule, first.params, big ? squareCR(+gm[1], +gm[2]) : null) };
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
      if (first.clip === false) state.symbolClipEnabled = false;   // Clip to cell off on a built-in's own lattice (absent = the default, byte-identical)
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
      if (shapes > FIGURE_MAX_SHAPES) throw new Error(`Too many shapes: ${shapes} (limit ${FIGURE_MAX_SHAPES}). Lower Variations or use a smaller Grid.`);
      if (!last) { const svg = buildFvsGridSVG(); state.figureLevelMeta[gi] = live.lastFigureMeta; state.fvsGridRaw = promoteFigureToTile(svg); }
    });
    if (!grids.length) { state.fvsGridConfig.rot = tr.rotate || 0; state.fvsGridConfig.mirror = tr.mirror || 'none'; }
    const svg = figureSVGOf(tier);
    const metas = state.figureLevelMeta.slice(); if (grids.length) metas[grids.length - 1] = live.lastFigureMeta;
    const stats = state.figureLevelStats.slice();
    const levels = { component: figureSVGOf('component'), symbol: figureSVGOf('symbol') };
    const cells = first.kind === 'symbol' ? state.symbolCells.length : (getSelectedComponent() ? getSelectedComponent().cells.length : 0);
    let compose = null;   // what Compose needs to hit and select cells: each cell's class and its outline in the frame
    if (first.kind === 'symbol' && getSymbolGrid()) {
      const G = getSymbolGrid(), F = symbolFrame(G);
      compose = { w: F.w, h: F.h, ctxs: slotClassContext(G),
        // each cell as drawn — the fields Cell properties shows (Compose = the Symbol step's editor)
        cells: state.symbolCells.map(c => { const o = {}; COMPOSE_CELL_FIELDS.forEach(k => { if (c[k] != null) o[k] = k === 'colourway' || k === 'seedParams' ? true : c[k]; }); return o; }),
        outlines: G.cells.map(c => (c.points ? c.points : [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]]).map(p => [+F.X(p[0]).toFixed(2), +F.Y(p[1]).toFixed(2)])) };
    }
    // the Figure checks (engine/14 figureChecks), read from this run's own state — only when asked (they draw again)
    let checks = null;
    if (opts && opts.checks) { try { checks = figureChecks(def, svg); } catch (e) { checks = [{ ok: false, label: 'Checks could not run', detail: e.message }]; } }
    return { svg, tier, levels, metas, stats, shapes, cells, compose, checks };
  });
}
