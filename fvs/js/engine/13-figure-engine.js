// Flexible Visual System · engine/13-figure-engine — the engine part of 13-figure-engine.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  live, state
} from './00-core.js';
import {
  SEED_TYPES, frameDims
} from './01-geometry.js';
import {
  getSeed
} from './02-seed-ui.js';
import {
  GRID_BUILD, buildCheckerboardCells, buildMirrorCells, buildPinwheelCells, buildRadialCells, getGrid, stateFrom
} from './03-rules.js';
import {
  buildComponentItems
} from './04-appearance.js';
import {
  buildComponentSVG
} from './05-render-component.js';
import {
  getSelectedComponent
} from './06-component-ui.js';
import {
  LIBRARY
} from './07-library.js';
import {
  buildFvsGridSVG, getSymbolGrid, polyOrient, snapPose
} from './08-symbol-grid.js';
import {
  buildSymbolSVG
} from './09-symbol-render.js';
import {
  cellColRow
} from './11-symbol-ui.js';
import { provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  figureSVGOf: () => figureSVGOf
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
    && (when.parity == null || when.parity === ctx.parity) && (when.ring == null || has(when.ring, ctx.ring)) && (when.sector == null || has(when.sector, ctx.sector))
    && (when.at == null || when.at.some(a => a[0] === ctx.row && a[1] === ctx.col));   // at: [[row, col], …] — cells by grid address (Compose)
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
// The poses a Component rule gives the cells. Without `cr`: the four of a 2 × 2 (row-major). With `cr` (each cell's
// {col, row}, row-major): any Square lattice, through the Component step's own any-grid builders (GRID_BUILD — the same
// four on a 2 × 2). Checkerboard: p.swap = start on B, p.flip = B is flipped instead of rotated (the Symbol step's pair).
export function componentCellsFromRule(rule, p, cr) {
  p = p || {};
  const chkA = () => stateFrom(p.a || 0, false, false, 1), chkB = () => (p.flip ? stateFrom(0, true, false, 1) : stateFrom(p.b || 0, false, false, 1));
  if (cr) {
    if (rule === 'radial') {
      const cols = Math.max(...cr.map(c => c.col)) + 1, rows = Math.max(...cr.map(c => c.row)) + 1;
      if (cols % 2 || rows % 2) throw new Error('Radial needs an even number of columns and rows');
      return GRID_BUILD.radial(cr, p.base || 0, p.chirality || 1, 1, false);
    }
    if (rule === 'pinwheel') return GRID_BUILD.pinwheel(cr, p.base || 0, p.chirality || 1, 1);
    if (rule === 'mirror') return GRID_BUILD.mirror(cr, p.seed || 0, 1);
    if (rule === 'checkerboard') return p.swap ? GRID_BUILD.checkerboard(cr, chkB(), chkA()) : GRID_BUILD.checkerboard(cr, chkA(), chkB());
    throw new Error('Unknown component rule: ' + rule);
  }
  if (rule === 'radial') return buildRadialCells(p.base || 0, p.chirality || 1, 1);
  if (rule === 'pinwheel') return buildPinwheelCells(p.base || 0, p.chirality || 1, 1);
  if (rule === 'mirror') return buildMirrorCells(p.seed || 0, 1);
  if (rule === 'checkerboard') return p.swap ? buildCheckerboardCells(chkB(), chkA()) : buildCheckerboardCells(chkA(), chkB());
  throw new Error('Unknown component rule: ' + rule);
}
// {col, row} of every cell of a cols × rows Square lattice, row-major
export const squareCR = (cols, rows) => Array.from({ length: cols * rows }, (_, i) => ({ col: i % cols, row: Math.floor(i / cols) }));
export function gridTypeFromLattice(l) {
  if (l.type === 'tier') return 'tier' + (l.stack || 1);
  if (l.type === 'triangle') return 'tri' + l.rows;
  if (l.type === 'square') return `square${l.n}x${l.n}`;
  throw new Error('Unknown grid lattice: ' + l.type);
}
// ── Symbol → Figure bridge ──
// A symbol level may carry the Symbol step's own work instead of a lattice + rules: the full
// Loom grid (lattice.type 'loomModel', its Canvas frame included), every cell as it is, the
// saved Components those cells use (inline, so the recipe travels), and the Symbol's palette.
// Such a level is sealed: its cells are drawn as they are, Rules are not applied on top.
export const isSealedSymbol = l => !!l && l.kind === 'symbol' && Array.isArray(l.cells);
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
// Raised from 20000 alongside the Symbol/Figure size ladder (Symbol now up to ~64
// cells, Figure's Grid up to square12x12=144 tiles): a single properly-sized
// Symbol × one Grid level × a mirror stays comfortably under this (64×144×4=36,864);
// the most extreme chained combinations (two maxed grids stacked) still hit it, by
// design — see CLAUDE.md session note.
export const FIGURE_MAX_SHAPES = 40000;
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
// A finished Grid figure as the tile of the next level: its markup without the paper rect,
// its frame, and the box it really draws in (set by the last buildFvsGridSVG()).
export function promoteFigureToTile(svg) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="[\d.]+" height="[\d.]+" fill="#[0-9a-fA-F]+"\/>/, '');
  return { size: live.lastFigureMeta.size, inner, box: live.lastFigureMeta.box };
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
