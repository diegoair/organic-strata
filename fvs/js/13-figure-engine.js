// Flexible Visual System · 13-figure-engine — Figure engine — recipes v1 fixtures, recipe v2 validate / run, catalogs.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import {
  DEFAULT_COLOR_RULE, buildPalette, ctrl, refreshColourViews, state, syncColorRuleUI
} from './00-core.js';
import {
  SEED_TYPES, frameDims, resolveGridCells
} from './01-geometry.js';
import {
  getSeed, seedForSnapshot
} from './02-seed-ui.js';
import {
  buildCheckerboardCells, buildMirrorCells, buildPinwheelCells, buildRadialCells, getGrid,
  setComponentGrid, stateFrom
} from './03-rules.js';
import {
  buildComponentItems
} from './04-appearance.js';
import {
  buildComponentSVG, renderGallery
} from './05-render-component.js';
import {
  getSelectedComponent, pushUndo
} from './06-component-ui.js';
import {
  LIBRARY, hexKey
} from './07-library.js';
import {
  LIVE_SYMBOL, buildFvsGridSVG, getFvsGrid, getSymbolGrid, hexLoomModel, lastFigureMeta, loadSymbolGrid,
  polyOrient, snapPose, squareLoomModel, tileSelectedInGrid, triangleLoomModel, withPlacementDefaults
} from './08-symbol-grid.js';
import {
  buildSymbolSVG
} from './09-symbol-render.js';
import {
  cellColRow, renderSymbol
} from './11-symbol-ui.js';
import {
  setPaperUI, setTier, syncSymbolViewUI
} from './12-shell.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  fireChange: () => fireChange
});
// ── Built-in recipes, v1 — no longer in the UI (the Element panel's "Start from a
// recipe" was removed Oct 4, 2026: its tiled results showed on no page; the same 7
// live in Figure as "Classic · …", FIGURE_RECIPES_V1_AS_V2). Kept as fixtures for
// fvs/_test-regression.html, which builds Element → Component → colours → Grid
// from them and checks each v1 result equals its v2 twin. Each `cells()` reuses the same builders the rule dropdown uses, so a
// recipe is exactly what the matching rule would generate.
export const LEAF_CELLS = () => buildCheckerboardCells(stateFrom(180, false, false, 1), stateFrom(0, false, false, 1));
export const BUILTIN_RECIPES = [
  { id: 'circle', label: 'Circle from four arcs', hint: 'Arc, Radial 180° — four quarter-discs meeting at the centre.',
    element: { type: 'arc', params: { 'rg-thickness': 100 } }, colors: ['#0a9a3e'],
    component: { grid: 'square2x2', cells: () => buildRadialCells(180, 1, 1) } },
  { id: 'leaf-block', label: 'Leaf block 2×2', hint: 'Arc, Checkerboard 180° / 0°.',
    element: { type: 'arc', params: { 'rg-thickness': 100 } }, colors: ['#0a9a3e'],
    component: { grid: 'square2x2', cells: LEAF_CELLS } },
  { id: 'leaf-wave', label: 'Leaf wave (tiled 2×2)', hint: 'The leaf block repeated 2×2 — diagonal chains of leaves.',
    element: { type: 'arc', params: { 'rg-thickness': 100 } }, colors: ['#0a9a3e'],
    component: { grid: 'square2x2', cells: LEAF_CELLS }, tile: { type: 'square2x2', cellSize: 110 } },
  { id: 'leaf-wave-outline', label: 'Leaf wave, outline', hint: 'Same pattern in Stroke, red.',
    element: { type: 'arc', params: { 'rg-thickness': 100 } }, style: 'stroke', strokeW: 5, colors: ['#e8321e'],
    component: { grid: 'square2x2', cells: LEAF_CELLS }, tile: { type: 'square2x2', cellSize: 110 } },
  { id: 'leaf-two-ink', label: 'Leaf wave, two inks (4×4)', hint: 'Red and green alternating like a checkerboard, tiled 4×4.',
    element: { type: 'arc', params: { 'rg-thickness': 100 } }, colors: ['#e8321e', '#0a9a3e'], colorRule: { mode: 'checker', offset: 0 },
    component: { grid: 'square2x2', cells: LEAF_CELLS }, tile: { type: 'square4x4', cellSize: 110 } },
  { id: 'pinwheel', label: 'Triangle pinwheels (3×3)', hint: 'Triangle, Pinwheel 0° — a windmill block tiled 3×3.',
    element: { type: 'triangle', params: {} }, colors: ['#e8321e'],
    component: { grid: 'square2x2', cells: () => buildPinwheelCells(0, 1, 1) }, tile: { type: 'square3x3', cellSize: 110 } },
  { id: 'kaleidoscope', label: 'Arc kaleidoscope', hint: 'Arc, Mirror — reflections meeting at the centre, tiled 2×2 with Alternate flip.',
    element: { type: 'arc', params: { 'rg-thickness': 60 } }, colors: ['#1e5be8'],
    component: { grid: 'square2x2', cells: () => buildMirrorCells(0, 1) }, tile: { type: 'square2x2', cellSize: 110, altFlip: true } },
];
export function fireInput(id, v) { const e = ctrl(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
export function fireChange(id, v) { const e = ctrl(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }
export function runBuiltinRecipe(def) {
  fireChange('sel-seed-type', def.element.type);
  Object.entries(def.element.params || {}).forEach(([id, v]) => fireInput(id, v));
  fireChange('sel-element-fillmode', def.style || 'fill');
  if (def.strokeW) fireInput('rg-element-strokew', def.strokeW);
  state.colors = def.colors.map(hexKey);
  state.colorRule = { ...DEFAULT_COLOR_RULE, ...(def.colorRule || {}) };
  syncColorRuleUI();
  buildPalette();
  setComponentGrid(def.component.grid);
  const comp = { id: 'recipe-' + def.id, ruleSource: 'recipe', cells: def.component.cells() };
  pushUndo();
  state.components = [comp];
  state.componentAutoGenerated = false;
  state.selectedId = comp.id;
  state.selectionExplicit = true;
  renderGallery();
  refreshColourViews();
  if (def.tile) {
    const all = LIBRARY.read(); delete all['Tile · ' + comp.id]; LIBRARY.write(all);   // never reuse a stale tile from an earlier run
    tileSelectedInGrid();
    // No page shows this tiling live anymore — buildFvsGridSVG()/tierSVG() still
    // resolve it correctly (via state.fvsGridComponentName) for anything that asks.
    state.fvsGridConfig = { ...state.fvsGridConfig, type: def.tile.type, cellSize: def.tile.cellSize, gap: 0, altFlip: !!def.tile.altFlip, rot: 0, mirror: 'none' };
  }
  setTier('component');
}
// ── Figure recipe v2 ─────────────────────────────────────────────────────────
// A figure is a pipeline of levels, none of which mentions a particular Seed:
//   element  — the unit Seed (any type), its style and colours
//   levels   — [ component | symbol ] then optionally [ grid ]
//     component: a 2×2/3×3… block from a named rule (radial, checkerboard, pinwheel, mirror)
//     symbol:    a lattice of slots (triangle rows / square cols×rows) + rules that map each
//                slot's CLASS (up/down, row, col, index, parity) to content and pose
//     grid:      tiles the level above over a lattice (square n / tier stack / triangle rows)
//   transform — rotate the whole figure, mirror it over its right/bottom edge
// runFigureRecipe() drives the same state and functions the UI does, so what it draws IS what
// the tiers export (one code path, checked by the regression suite).
export function slotClassContext(grid) {
  const cr = cellColRow(grid);
  const raw = (state.symbolGrid && state.symbolGrid.cells) || [];
  return cr.map((c, i) => ({
    index: i, col: c.col, row: c.row, parity: (c.col + c.row) % 2 === 1 ? 'odd' : 'even',
    orient: raw[i] && raw[i].points ? polyOrient(raw[i].points) : null,
    ring: raw[i] && raw[i].ring != null ? raw[i].ring : null, sector: raw[i] && raw[i].sector != null ? raw[i].sector : null,
  }));
}
export function ruleMatches(when, ctx) {
  const has = (v, x) => Array.isArray(v) ? v.includes(x) : v === x;
  return (when.class == null || has(when.class, ctx.orient)) && (when.row == null || has(when.row, ctx.row))
    && (when.col == null || has(when.col, ctx.col)) && (when.index == null || has(when.index, ctx.index))
    && (when.parity == null || when.parity === ctx.parity) && (when.ring == null || has(when.ring, ctx.ring)) && (when.sector == null || has(when.sector, ctx.sector));
}
// Rules apply in order; a later rule overrides an earlier one on the slots it matches.
export function applyClassRules(rules, seedType) {
  const grid = getSymbolGrid();
  if (!grid) return;
  const ctxs = slotClassContext(grid);
  state.symbolCells.forEach((cell, i) => {
    (rules || []).forEach(r => {
      if (r.off || !ruleMatches(r.when || {}, ctxs[i])) return;   // a switched-off rule stays in the recipe but does nothing
      const d = r.do || {};
      if (d.content === 'empty') cell.source = 'empty';
      else if (d.content === 'filled') { cell.source = 'seed'; cell.seedType = d.seed || seedType; }
      if (d.rotate != null) cell.rotation = snapPose(d.rotate === 'sector' ? 60 * (ctxs[i].sector || 0) : d.rotate);
      if (d.flipH != null) cell.flipH = !!d.flipH;
      if (d.flipV != null) cell.flipV = !!d.flipV;
      if (d.scale != null) cell.scale = d.scale;
    });
  });
}
export function componentCellsFromRule(rule, p) {
  p = p || {};
  if (rule === 'radial') return buildRadialCells(p.base || 0, p.chirality || 1, 1);
  if (rule === 'pinwheel') return buildPinwheelCells(p.base || 0, p.chirality || 1, 1);
  if (rule === 'mirror') return buildMirrorCells(p.seed || 0, 1);
  if (rule === 'checkerboard') return buildCheckerboardCells(stateFrom(p.a || 0, false, false, 1), stateFrom(p.b || 0, false, false, 1));
  throw new Error('Unknown component rule: ' + rule);
}
export function gridTypeFromLattice(l) {
  if (l.type === 'tier') return 'tier' + (l.stack || 1);
  if (l.type === 'triangle') return 'tri' + l.rows;
  if (l.type === 'square') return `square${l.n}x${l.n}`;
  throw new Error('Unknown grid lattice: ' + l.type);
}
export function validateFigureRecipe(def) {
  if (!def || def.tool !== 'fvs-recipe' || def.version !== 2) throw new Error('Not a v2 figure recipe');
  if (!def.element || !SEED_TYPES[def.element.type]) throw new Error('Unknown Seed type: ' + (def.element && def.element.type));
  const lv = def.levels || [];
  if (!lv.length || !['component', 'symbol'].includes(lv[0].kind)) throw new Error('The first level must be a component or a symbol');
  if (lv.slice(1).some(l => l.kind !== 'grid')) throw new Error('Every level after the first must be a grid');
  if (lv.length > 4) throw new Error('At most three grid levels');
  // A transform is only ever applied by buildFvsGridSVG (the Grid step's own
  // renderer) — with no grid level, runFigureRecipe silently never reaches that
  // code path, so a mirror/rotate on a gridless figure would be a no-op the
  // checks panel couldn't even detect. Reject it outright rather than accept a
  // recipe whose own transform field lies about what gets rendered.
  const tr = def.transform || {};
  if (lv.length < 2 && ((tr.rotate && tr.rotate !== 0) || (tr.mirror && tr.mirror !== 'none'))) throw new Error('A transform (rotate/mirror) needs at least one Grid level to apply to');
  return lv;
}
// ── Symbol → Figure bridge ──
// A symbol level may carry the Symbol step's own work instead of a lattice + rules: the full
// Loom grid (lattice.type 'loomModel', its Canvas frame included), every cell as it is, the
// saved Components those cells use (inline, so the recipe travels), and the Symbol's palette.
// Such a level is sealed: its cells are drawn as they are, Rules are not applied on top.
export const isSealedSymbol = l => !!l && l.kind === 'symbol' && Array.isArray(l.cells);
export function runSealedSymbolLevel(first) {
  const l = first.lattice;
  if (!l || l.type !== 'loomModel' || !l.model) throw new Error('An adopted Symbol needs its Loom grid (lattice.type "loomModel")');
  if (first.componentEntries) {   // make the recipe self-contained, never overwriting the user's own entry of the same name
    const all = LIBRARY.read(); let added = false;
    Object.entries(first.componentEntries).forEach(([name, entry]) => { if (!all[name] && entry) { all[name] = JSON.parse(JSON.stringify(entry)); added = true; } });
    if (added) LIBRARY.write(all);
  }
  if (first.colors) {
    state.colors = first.colors.map(hexKey);
    state.colorRule = { ...DEFAULT_COLOR_RULE, ...(first.colorRule || {}) };
    syncColorRuleUI(); buildPalette();
  }
  if (first.paperColor) { state.paperColor = hexKey(first.paperColor); setPaperUI(state.paperColor); }
  loadSymbolGrid(JSON.parse(JSON.stringify(l.model)));
  if (first.cells.length !== getSymbolGrid().cells.length) throw new Error(`The adopted Symbol has ${first.cells.length} cells but its grid has ${getSymbolGrid().cells.length}`);
  state.symbolCells = first.cells.map(c => withPlacementDefaults(JSON.parse(JSON.stringify(c))));
  state.symbolClipEnabled = first.clip !== false;
  syncSymbolViewUI();
  renderSymbol();
}
// The Symbol step as a sealed symbol level (null when there is no Symbol grid yet).
export function symbolLevelFromLiveState() {
  if (!state.symbolGrid) return null;
  const lib = LIBRARY.read(), componentEntries = {};
  const queue = state.symbolCells.filter(c => c.source === 'component' && c.componentName).map(c => c.componentName);
  while (queue.length) {   // a Component used as a Container/Mask reference travels with its user
    const name = queue.shift();
    if (componentEntries[name] || !lib[name]) continue;
    componentEntries[name] = JSON.parse(JSON.stringify(lib[name]));
    if (lib[name].underlyingComponentName) queue.push(lib[name].underlyingComponentName);
  }
  const level = {
    kind: 'symbol',
    lattice: { type: 'loomModel', model: JSON.parse(JSON.stringify(state.symbolGrid)) },
    cells: state.symbolCells.map(c => JSON.parse(JSON.stringify(c))),
    colors: state.colors.slice(), colorRule: { ...state.colorRule }, paperColor: state.paperColor,
    clip: state.symbolClipEnabled,
  };
  if (Object.keys(componentEntries).length) level.componentEntries = componentEntries;
  return level;
}
export function runFigureRecipe(def, opts) {
  const lv = validateFigureRecipe(def);
  const el = def.element;
  fireChange('sel-seed-type', el.type);
  Object.entries(el.params || {}).forEach(([id, v]) => fireInput(id, v));
  fireChange('sel-element-fillmode', el.style || 'fill');
  if (el.strokeW) fireInput('rg-element-strokew', el.strokeW);
  state.colors = (el.colors || ['#000000']).map(hexKey);
  state.colorRule = { ...DEFAULT_COLOR_RULE, ...(el.colorRule || {}) };
  syncColorRuleUI(); buildPalette();
  setPaperUI(hexKey(el.paper || '#ffffff'));
  const first = lv[0], grids = lv.slice(1), gridLv = grids[0];
  let tier;
  state.fvsGridRaw = null; state.figureLevelStats = []; state.figureLevelMeta = [];
  if (first.kind === 'component') {
    setComponentGrid(first.grid || 'square2x2');
    const comp = { id: 'figure-component', ruleSource: 'recipe', cells: first.cells || componentCellsFromRule(first.rule, first.params) };
    pushUndo(); state.components = [comp]; state.selectedId = comp.id; state.selectionExplicit = true; state.componentAutoGenerated = false;
    renderGallery(); refreshColourViews();
    tier = 'component';
    if (gridLv) { const all = LIBRARY.read(); delete all['Tile · ' + comp.id]; LIBRARY.write(all); tileSelectedInGrid(); }
  } else if (isSealedSymbol(first)) {
    runSealedSymbolLevel(first);
    tier = 'symbol';
    if (gridLv) { state.fvsGridSymbolName = LIVE_SYMBOL; state.fvsGridComponentName = null; }
  } else {
    const l = first.lattice;
    loadSymbolGrid(l.type === 'triangle' ? triangleLoomModel(l.rows) : l.type === 'hexagon' ? hexLoomModel(l.rings) : squareLoomModel(l.cols, l.rows || l.cols));
    const fit = first.fit || (l.type === 'triangle' ? 'fill' : 'contain');
    state.symbolCells.forEach(c => { c.source = 'seed'; c.seedType = el.type; c.fitMode = fit; c.rotation = 0; c.flipH = false; c.flipV = false; c.scale = 1; c.color = null; });
    if (first.seed === 'live') {   // every cell keeps the Element's own settings, frozen at this moment
      const sp = seedForSnapshot();
      state.symbolCells.forEach(c => { c.seedParams = JSON.parse(JSON.stringify(sp)); });
    } else state.symbolCells.forEach(c => { delete c.seedParams; });
    applyClassRules(first.rules, el.type);
    renderSymbol();
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
    if (!last) { const svg = buildFvsGridSVG(); state.figureLevelMeta[gi] = lastFigureMeta; state.fvsGridRaw = promoteFigureToTile(svg); }   // this figure becomes the next level's tile
  });
  if (!grids.length) { state.fvsGridConfig.rot = tr.rotate || 0; state.fvsGridConfig.mirror = tr.mirror || 'none'; }
  if (opts && opts.keepTier) { state.figureTier = tier; return figureSVGOf(tier); }
  // Every real caller passes keepTier — this path is a defensive fallback only.
  // 'grid' has no page of its own anymore, so land on Symbol instead of a blank UI.
  setTier(tier === 'grid' ? 'symbol' : tier);
  return hooks.tierSVG();
}
// Raised from 20000 alongside the Symbol/Figure size ladder (Symbol now up to ~64
// cells, Figure's Grid up to square12x12=144 tiles): a single properly-sized
// Symbol × one Grid level × a mirror stays comfortably under this (64×144×4=36,864);
// the most extreme chained combinations (two maxed grids stacked) still hit it, by
// design — see CLAUDE.md session note.
export const FIGURE_MAX_SHAPES = 40000;
// A finished Grid figure as the tile of the next level: its markup without the paper rect,
// its frame, and the box it really draws in (set by the last buildFvsGridSVG()).
export function promoteFigureToTile(svg) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="[\d.]+" height="[\d.]+" fill="#[0-9a-fA-F]+"\/>/, '');
  return { size: lastFigureMeta.size, inner, box: lastFigureMeta.box };
}
// The finished SVG of one underlying step, whichever step is on screen.
export function figureSVGOf(tier) {
  if (tier === 'grid') return buildFvsGridSVG();
  if (tier === 'symbol') return getSymbolGrid() ? buildSymbolSVG() : '';
  const comp = getSelectedComponent();
  if (!comp) return '';
  state.selectedRuleSource = comp.ruleSource;
  const grid = getGrid();
  return buildComponentSVG(buildComponentItems(comp, grid), getSeed(), frameDims(grid));
}

// The built-in recipes, written as v2 data. Each one reproduces its v1 twin above exactly
// (the regression suite compares them) — the proof that the model is not triangle-specific.
export const FIGURE_RECIPES_V1_AS_V2 = {
  'circle': { element: { type: 'arc', params: { 'rg-thickness': 100 }, colors: ['#0a9a3e'] }, levels: [{ kind: 'component', grid: 'square2x2', rule: 'radial', params: { base: 180, chirality: 1 } }] },
  'leaf-block': { element: { type: 'arc', params: { 'rg-thickness': 100 }, colors: ['#0a9a3e'] }, levels: [{ kind: 'component', grid: 'square2x2', rule: 'checkerboard', params: { a: 180, b: 0 } }] },
  'leaf-wave': { element: { type: 'arc', params: { 'rg-thickness': 100 }, colors: ['#0a9a3e'] }, levels: [{ kind: 'component', grid: 'square2x2', rule: 'checkerboard', params: { a: 180, b: 0 } }, { kind: 'grid', lattice: { type: 'square', n: 2 }, cellSize: 110 }] },
  'leaf-wave-outline': { element: { type: 'arc', params: { 'rg-thickness': 100 }, style: 'stroke', strokeW: 5, colors: ['#e8321e'] }, levels: [{ kind: 'component', grid: 'square2x2', rule: 'checkerboard', params: { a: 180, b: 0 } }, { kind: 'grid', lattice: { type: 'square', n: 2 }, cellSize: 110 }] },
  'leaf-two-ink': { element: { type: 'arc', params: { 'rg-thickness': 100 }, colors: ['#e8321e', '#0a9a3e'], colorRule: { mode: 'checker', offset: 0 } }, levels: [{ kind: 'component', grid: 'square2x2', rule: 'checkerboard', params: { a: 180, b: 0 } }, { kind: 'grid', lattice: { type: 'square', n: 4 }, cellSize: 110 }] },
  'pinwheel': { element: { type: 'triangle', colors: ['#e8321e'] }, levels: [{ kind: 'component', grid: 'square2x2', rule: 'pinwheel', params: { base: 0, chirality: 1 } }, { kind: 'grid', lattice: { type: 'square', n: 3 }, cellSize: 110 }] },
  'kaleidoscope': { element: { type: 'arc', params: { 'rg-thickness': 60 }, colors: ['#1e5be8'] }, levels: [{ kind: 'component', grid: 'square2x2', rule: 'mirror', params: { seed: 0 } }, { kind: 'grid', lattice: { type: 'square', n: 2 }, cellSize: 110, altFlip: true }] },
};
// Levels of levels: each grid's finished figure becomes the tile of the next one.
export function recursiveFigureRecipes() {
  const sym = { kind: 'symbol', lattice: { type: 'triangle', rows: 2 }, fit: 'fill', rules: [{ when: { class: 'down' }, do: { content: 'empty' } }] };
  const el = { type: 'triangle', style: 'fill', colors: ['#f0301f'], paper: '#ffffff' };
  const g = (lattice, extra) => ({ kind: 'grid', lattice, cellSize: 110, ...(extra || {}) });
  return {
    'Recursive · Sierpinski, three levels': { tool: 'fvs-recipe', version: 2, id: 'rec-sierpinski', element: el, levels: [sym, g({ type: 'triangle', rows: 2 }), g({ type: 'triangle', rows: 2 })] },
    'Recursive · bow tie tiled 2×2': { tool: 'fvs-recipe', version: 2, id: 'rec-bowtie', element: el, levels: [sym, g({ type: 'tier', stack: 1 }, { transform: { rotate: 90, mirror: 'v' } }), g({ type: 'square', n: 2 })] },
    'Recursive · tier of tiers, mirrored': { tool: 'fvs-recipe', version: 2, id: 'rec-tiers', element: el, levels: [sym, g({ type: 'tier', stack: 1 }), g({ type: 'tier', stack: 1 })], transform: { mirror: 'h' } },
  };
}
// Hexagonal lattices: poses in 60° steps (each cell turned by its sector).
export function hexFigureRecipes() {
  const mk = (id, el, rings, rules) => ({ tool: 'fvs-recipe', version: 2, id, element: el, levels: [{ kind: 'symbol', lattice: { type: 'hexagon', rings }, fit: 'contain', rules }] });
  return {
    'Hexagon · rosette (triangles turned by sector)': mk('hex-rosette', { type: 'triangle', colors: ['#f0301f'] }, 3, [{ when: {}, do: { rotate: 'sector', scale: 0.62 } }]),
    'Hexagon · star with empty centre': mk('hex-star', { type: 'star', colors: ['#1e5be8'] }, 3, [{ when: { ring: 0 }, do: { content: 'empty' } }, { when: { parity: 'odd' }, do: { rotate: 60 } }]),
    'Hexagon · arcs turned by sector': mk('hex-arcs', { type: 'arc', params: { 'rg-thickness': 100 }, colors: ['#0a9a3e'] }, 3, [{ when: {}, do: { rotate: 'sector', scale: 0.62 } }]),
  };
}
// The twelve "Triangle Symbol" figures: 3 assets × 4 compositions.
export function triangleFigureRecipes() {
  const assets = {
    sierpinski: { rows: 2, rules: [{ when: { class: 'down' }, do: { content: 'empty' } }] },
    trapezoid: { rows: 2, rules: [{ when: { class: 'down' }, do: { content: 'filled', rotate: 180 } }, { when: { row: 0 }, do: { content: 'empty' } }] },
    lattice4: { rows: 4, rules: [{ when: { class: 'down' }, do: { content: 'empty' } }] },
  };
  const comps = {
    asset: [], repeated: [{ kind: 'grid', lattice: { type: 'tier', stack: 2 } }],
    'mirror-1': [{ kind: 'grid', lattice: { type: 'tier', stack: 1 } }], 'mirror-2': [{ kind: 'grid', lattice: { type: 'tier', stack: 1 } }],
  };
  const tf = { asset: {}, repeated: {}, 'mirror-1': { rotate: 90, mirror: 'v' }, 'mirror-2': { mirror: 'h' } };
  const out = {};
  Object.entries(assets).forEach(([an, a]) => Object.entries(comps).forEach(([cn, extra]) => {
    out[an + ':' + cn] = { tool: 'fvs-recipe', version: 2, id: an + ':' + cn,
      element: { type: 'triangle', style: 'fill', colors: ['#f0301f'], paper: '#ffffff' },
      levels: [{ kind: 'symbol', lattice: { type: 'triangle', rows: a.rows }, fit: 'fill', rules: a.rules }, ...extra], transform: tf[cn] };
  }));
  return out;
}
