// Flexible Visual System · engine/17-figure-nodes — the Figure graph's node types (Organica.nodeCanvas registry).
// An ES module of the Figure tier (loaded on demand by ./figure.js). It imports only earlier files. docs/FVS.md §12.
//
// A Figure = one Canvas + one Grid (+ an optional Palette) + content from the saved libraries + rules, compiled to a
// recipe and rendered by evalFigure() — no rendering code of its own.
//   · Grid = a Loom generator → generated INSIDE the Canvas (symbolGridModel, the Symbol step's own path), every cell
//     takes a content patch (the Library rail's patch), in turn from the connected content;
//   · Grid = an FVS lattice (Triangle / Square / Hexagon, the old Figure's) → the lattice keeps its own frame; with the
//     Canvas on "Fit to figure" the SVG is the figure itself, otherwise it is fitted onto the Canvas's page;
//   · rules: Cell rules (by cell class), Component rule (a Square lattice ≤ 4 × 4 laid out by a named rule),
//     Repeat in grid (tile the figure, any number, in wire order), Rotate & mirror (the last repeat's transform).
// A built-in Figure (recipe v2) imports as a graph whose nodes keep the recipe's own pieces, so it compiles back to the
// same recipe — byte-identical (scripts/test-figure-graph.sh). Words: docs/UI-COPY.md §2 "Figure graph".
import {
  DEFAULT_COLOR_RULE, COLOR_RULES, state
} from './00-core.js';
import {
  SEED_TYPES
} from './01-geometry.js';
import {
  seedForSnapshot
} from './02-seed-ui.js';
import {
  elementVariantSVG, getElementAppearance, orientedElementTile, tileSig
} from './04-appearance.js';
import {
  PX_PER_MM, SYMCANVAS_PRESETS, SYMGRID_GENS, hexLoomModel, squareLoomModel, symbolGridModel, triangleLoomModel
} from './08-symbol-grid.js';
import {
  componentCellsFromRule
} from './13-figure-engine.js';
import {
  evalFigure, withFigureSandbox
} from './16-figure-eval.js';

const clone = o => JSON.parse(JSON.stringify(o));
export const FIGURE_PORT_TYPES = ['canvas', 'grid', 'palette', 'content', 'rule', 'figure'];
export const FIT_PRESET = 'Fit to figure';

// ── Canvas: the figure's page — readSymbolCanvas()'s shape, from params instead of the panel ──
export function canvasOf(p) {
  if (p.preset === FIT_PRESET) return { preset: FIT_PRESET, fit: true, mode: 'screen', unit: 'px', pw: 1080, ph: 1080, dpi: 300, bleed: 0, margin: 0, W: 1080, H: 1080 };
  const preset = SYMCANVAS_PRESETS[p.preset];
  const mode = p.mode === 'print' ? 'print' : 'screen';
  const unit = mode === 'print' ? (p.unit === 'in' ? 'in' : 'mm') : 'px';
  let pw = +p.pw, ph = +p.ph;
  if (preset) {
    if (mode === 'print' && preset.unit === 'px') { pw = Math.round(preset.w / PX_PER_MM); ph = Math.round(preset.h / PX_PER_MM); }
    else if (mode === 'screen' && preset.unit === 'mm') { pw = Math.round(preset.w * PX_PER_MM); ph = Math.round(preset.h * PX_PER_MM); }
    else { pw = preset.w; ph = preset.h; }
    if (mode === 'print' && unit === 'in') { pw = Math.round(pw / 25.4 * 100) / 100; ph = Math.round(ph / 25.4 * 100) / 100; }
  }
  pw = Math.max(1, pw || 1); ph = Math.max(1, ph || 1);
  const toPx = v => mode === 'print' ? v * (unit === 'in' ? 25.4 : 1) * PX_PER_MM : v;
  return { preset: preset ? p.preset : 'Custom', mode, unit, pw, ph, dpi: +p.dpi || 300, bleed: Math.max(0, +p.bleed || 0),
    margin: Math.max(0, Math.min(25, +p.margin || 0)), W: Math.round(toPx(pw) * 100) / 100, H: Math.round(toPx(ph) * 100) / 100 };
}
export function canvasSummary(cv) {
  if (cv.fit) return 'Fit to figure';
  return cv.mode === 'print' ? `${cv.pw} × ${cv.ph} ${cv.unit} · ${cv.dpi} dpi` : `${cv.pw} × ${cv.ph} px`;
}

// ── Grid: a Loom generator (inside the Canvas) or an FVS lattice (its own frame) ──
// One range per lattice (the atlas listed four different ones for the same lattice — this is now the only one).
export const FIGURE_LATTICES = {
  'lattice-triangle': { label: 'Triangle lattice', params: [['rows', 'Rows', 1, 8, 1, 2]] },
  'lattice-square': { label: 'Square lattice', params: [['cols', 'Columns', 1, 12, 1, 2], ['rows', 'Rows', 1, 12, 1, 2]] },
  'lattice-hexagon': { label: 'Hexagon lattice', params: [['rings', 'Rings', 1, 6, 1, 3]] },
};
export const isLattice = gen => !!FIGURE_LATTICES[gen];
export function gridSpec(gen) { return FIGURE_LATTICES[gen] || SYMGRID_GENS[gen] || SYMGRID_GENS.rectangular; }
export function gridDefaults(gen) {
  const out = {};
  gridSpec(gen).params.forEach(([k, , a, b, , def]) => { out[k] = a === 'text' ? b : def; });
  return out;
}
export function gridSummary(g) {
  const spec = gridSpec(g.gen), p = g.params || {};
  if (p.cols != null && p.rows != null) return `${spec.label} ${p.cols} × ${p.rows}`;
  if (p.cols != null) return `${spec.label} · ${p.cols} columns`;
  if (p.rows != null) return `${spec.label} · ${p.rows} rows`;
  if (p.rings != null) return `${spec.label} · ${p.rings} rings`;
  return spec.label;
}
function latticeOf(g) {   // a lattice grid → recipe v2's lattice
  const p = { ...gridDefaults(g.gen), ...(g.params || {}) };
  if (g.gen === 'lattice-triangle') return { type: 'triangle', rows: p.rows };
  if (g.gen === 'lattice-hexagon') return { type: 'hexagon', rings: p.rings };
  return { type: 'square', cols: p.cols, rows: p.rows };
}
function latticeModel(l) { return l.type === 'triangle' ? triangleLoomModel(l.rows) : l.type === 'hexagon' ? hexLoomModel(l.rings) : squareLoomModel(l.cols, l.rows || l.cols); }

// ── Content: a saved Element / Component with a copy of its entry → the cell patch a Symbol cell takes ──
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
export function entrySnapshot(entry) {   // what a content node keeps: the entry without its cached thumbnail
  if (!entry) return null;
  const e = clone(entry); delete e.thumb; return e;
}

// ── Rules: what a rule node emits on its "Rules" output ──
export const REPEAT_LATTICES = {
  square: { label: 'Square', key: 'n', min: 2, max: 6, def: 2 },
  tier: { label: 'Tier', key: 'stack', min: 1, max: 3, def: 1 },
  triangle: { label: 'Triangle', key: 'rows', min: 2, max: 4, def: 2 },
};
export function ruleOf(type, p) {
  if (type === 'cell-rules') return { kind: 'cells', rules: clone(p.rules || []) };
  if (type === 'component-rule') return { kind: 'component', rule: p.rule || 'radial', params: clone(p.params || {}) };
  if (type === 'repeat') {
    const L = REPEAT_LATTICES[p.lattice] || REPEAT_LATTICES.square, n = Math.max(L.min, Math.min(L.max, +p.count || L.def));
    const r = { kind: 'repeat', level: { kind: 'grid', lattice: { type: p.lattice in REPEAT_LATTICES ? p.lattice : 'square', [L.key]: n } } };
    if (p.cellSize) r.level.cellSize = +p.cellSize;
    if (p.altFlip) r.level.altFlip = true;
    if ((+p.rotate || 0) || (p.mirror && p.mirror !== 'none')) r.level.transform = { rotate: +p.rotate || 0, mirror: p.mirror || 'none' };
    return r;
  }
  if (type === 'transform') return { kind: 'transform', transform: { rotate: +p.rotate || 0, mirror: p.mirror || 'none' } };
  return null;
}

// ── Figure: compile → recipe (v2) → evalFigure ──
function fitOnPage(svg, cv, paper) {   // a figure with its own frame, fitted inside the Canvas's page (margin %)
  const m = svg.match(/^<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/), fw = m ? +m[1] : 1000, fh = m ? +m[2] : 1000;
  const mg = Math.min(cv.W, cv.H) * (cv.margin / 100), W = cv.W - 2 * mg, H = cv.H - 2 * mg, k = Math.min(W / fw, H / fh);
  const w = fw * k, h = fh * k, x = mg + (W - w) / 2, y = mg + (H - h) / 2;
  const inner = svg.replace(/^<svg([^>]*)>/, (all, attrs) => '<svg' + attrs.replace(/\s(width|height|x|y)="[^"]*"/g, '') + ` x="${x}" y="${y}" width="${w}" height="${h}">`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cv.W}" height="${cv.H}" viewBox="0 0 ${cv.W} ${cv.H}"><rect width="${cv.W}" height="${cv.H}" fill="${paper}"/>${inner}</svg>`;
}
export async function compileFigure(inputs, params) {
  const cv = inputs.canvas, grid = inputs.grid, pal = inputs.palette, rules = (inputs.rules || []).filter(Boolean);
  const contents = (inputs.content || []).filter(Boolean);
  if (!contents.length) throw new Error('Connect a Content input');
  if (contents.some(c => c.kind === 'symbol')) throw new Error('A Symbol as content is not available yet — use Elements and Components for now.');
  const cellRules = [].concat(...rules.filter(r => r.kind === 'cells').map(r => r.rules));
  const compRule = rules.find(r => r.kind === 'component');
  const repeats = rules.filter(r => r.kind === 'repeat').map(r => clone(r.level));
  const final = rules.filter(r => r.kind === 'transform').pop();
  if (final && !repeats.length) throw new Error('Rotate & mirror needs a Repeat in grid before it.');
  const colors = pal && pal.colors && pal.colors.length ? pal.colors.slice() : null;
  const colorRule = pal ? { ...DEFAULT_COLOR_RULE, ...(pal.rule || {}) } : { ...DEFAULT_COLOR_RULE };
  const paper = pal && pal.paper ? pal.paper : '#ffffff';
  const firstEl = contents.find(c => c.kind === 'element' && c.entry && c.entry.seed);
  const imported = contents.length === 1 && firstEl && firstEl.entry.recipe ? firstEl.entry.recipe : null;
  const lattice = isLattice(grid.gen);
  let element, first;
  if (lattice && imported && !(compRule && cellRules.length)) {   // a built-in's own pieces: compile back to its exact recipe (Cell rules + a Component rule take the general path below)
    element = { ...clone(imported), colors: colors || clone(imported.colors || ['#000000']), paper };
    if (pal) element.colorRule = colorRule; else delete element.colorRule;
    if (pal && (pal.rule || {}).mode === DEFAULT_COLOR_RULE.mode && !imported.colorRule) delete element.colorRule;
    if (compRule) {
      const l = latticeOf(grid); if (l.type !== 'square' || l.cols > 4 || l.rows > 4) throw new Error('A Component rule needs a Square lattice up to 4 × 4.');
      first = { kind: 'component', grid: `square${l.cols}x${l.rows}`, rule: compRule.rule, params: clone(compRule.params) };
    } else {
      const l = latticeOf(grid);
      first = { kind: 'symbol', lattice: l, fit: params.fit === 'match' ? 'contain' : (params.fit || (l.type === 'triangle' ? 'fill' : 'contain')), rules: clone(cellRules) };
      if (params.symbolFit) first.fit = params.symbolFit;   // the built-in's own fit, kept as it was
    }
  } else {   // every other Figure: a sealed Symbol level — the grid's model + one content patch per cell
    const model = lattice ? latticeModel(latticeOf(grid)) : await symbolGridModel(grid.gen, { ...gridDefaults(grid.gen), ...(grid.params || {}) }, cv.fit ? canvasOf({ preset: 'Square 1:1', margin: 5 }) : cv);
    const n = Organica.loadLoomGrid(clone(model)).cells.length;
    let cells = Array.from({ length: n }, (_, i) => contentPatch(contents[i % contents.length], params.fit));
    // A Palette recolours the content (a Component through its colourway — its own colour rule still picks the inks);
    // "Keep own colours" leaves every content in the colours it was saved with.
    if (pal && colors && !params.keepOwn) cells.forEach(c => { if (c.source === 'component') c.colourway = { colors: colors.slice(), paper }; });
    if (compRule) {   // a Component rule poses the cells of a small Square lattice
      const l = lattice ? latticeOf(grid) : null;
      if (!l || l.type !== 'square' || l.cols > 4 || l.rows > 4) throw new Error('A Component rule needs a Square lattice up to 4 × 4.');
      const posed = componentCellsFromRule(compRule.rule, compRule.params);
      cells = cells.map((c, i) => { const q = posed[i % posed.length] || {}; return { ...c, rotation: q.rotation || 0, flipH: !!q.flipH, flipV: !!q.flipV }; });
    }
    const componentEntries = {};
    contents.forEach(c => { if (c.kind === 'component' && c.entry) componentEntries[c.name] = c.entry; });
    element = { type: firstEl && SEED_TYPES[firstEl.entry.seed.type] ? firstEl.entry.seed.type : 'triangle', style: 'fill', colors: colors || ['#000000'], paper };
    first = { kind: 'symbol', lattice: { type: 'loomModel', model }, cells, componentEntries, colors: colors || ['#000000'], colorRule: params.keepOwn ? { ...DEFAULT_COLOR_RULE } : colorRule, paperColor: paper, clip: params.clip !== false };
    if (cellRules.length) first.rules = clone(cellRules);
  }
  const recipe = { tool: 'fvs-recipe', version: 2, element, levels: [first, ...repeats] };
  if (final) recipe.transform = clone(final.transform);
  const r = evalFigure(recipe);
  const fitted = !cv.fit && (lattice || repeats.length);
  return { svg: fitted ? fitOnPage(r.svg, cv, paper) : r.svg, recipe, cells: first.cells ? first.cells.length : (r.stats[0] ? r.stats[0].tiles : 0), shapes: r.shapes, canvas: cv };
}

// ── A recipe v2 (a built-in Figure, a JSON file) → the pieces of a graph. Its Element is saved to the library once
// (deduplicated by the recipe element it came from; tagged `imported`), so content still comes from the library. ──
export function elementEntryFromRecipe(el) {
  return withFigureSandbox(panel => {
    panel.set('sel-seed-type', el.type);
    Object.entries(el.params || {}).forEach(([id, v]) => panel.set(id, v));
    panel.set('sel-element-fillmode', el.style || 'fill');
    if (el.strokeW) panel.set('rg-element-strokew', el.strokeW);
    state.colors = (el.colors || ['#000000']).slice();
    const tile = orientedElementTile(0, false, false);
    return { tile, sig: tile ? tileSig(tile) : '', thumb: elementVariantSVG(0, false, false), colors: (el.colors || ['#000000']).slice(), paperColor: el.paper || '#ffffff',
      orientation: { rotation: 0, flipH: false, flipV: false }, seed: seedForSnapshot(), appearance: getElementAppearance(),
      recipe: (({ type, params, style, strokeW }) => clone({ type, params, style, strokeW }))(el), imported: true, savedAt: new Date().toISOString() };
  });
}
export const recipeElementKey = el => JSON.stringify([el.type, el.params || {}, el.style || 'fill', el.strokeW || null]);
// → { nodes: [{ref, type, params, name?}], edges: [[fromRef, port, toRef, port]], element } — the UI places and saves it.
export function graphFromRecipe(def, elementName) {
  const lv = def.levels || [], first = lv[0], el = def.element;
  const nodes = [], edges = [];
  const add = (ref, type, params, name) => nodes.push({ ref, type, params, name });
  add('canvas', 'canvas', { preset: FIT_PRESET, mode: 'screen', unit: 'mm', pw: 1080, ph: 1080, dpi: 300, bleed: 3, margin: 5 });
  add('palette', 'palette', { colors: (el.colors || ['#000000']).slice(), paper: el.paper || '#ffffff', rule: el.colorRule ? clone(el.colorRule) : { ...DEFAULT_COLOR_RULE } });
  add('element', 'element', { name: elementName, snapshot: null }, elementName);
  if (first.kind === 'component') {
    const m = String(first.grid || 'square2x2').match(/^square(\d)x(\d)$/) || [0, 2, 2];
    add('grid', 'grid', { gen: 'lattice-square', params: { cols: +m[1], rows: +m[2] } });
    add('comp', 'component-rule', { rule: first.rule, params: clone(first.params || {}) });
  } else {
    const l = first.lattice;
    add('grid', 'grid', l.type === 'triangle' ? { gen: 'lattice-triangle', params: { rows: l.rows } } : l.type === 'hexagon' ? { gen: 'lattice-hexagon', params: { rings: l.rings } } : { gen: 'lattice-square', params: { cols: l.cols, rows: l.rows || l.cols } });
    if (first.rules && first.rules.length) add('cells', 'cell-rules', { rules: clone(first.rules) });
  }
  lv.slice(1).forEach((g, i) => {
    const t = g.transform || {}, L = g.lattice, key = (REPEAT_LATTICES[L.type] || REPEAT_LATTICES.square).key;
    add('rep' + i, 'repeat', { lattice: L.type, count: L[key], cellSize: g.cellSize || null, altFlip: !!g.altFlip, rotate: t.rotate || 0, mirror: t.mirror || 'none' });
  });
  const tr = def.transform || {};
  if ((tr.rotate || 0) || (tr.mirror && tr.mirror !== 'none')) add('tr', 'transform', { rotate: tr.rotate || 0, mirror: tr.mirror || 'none' });
  add('figure', 'figure', { fit: first.fit || 'contain', clip: true, symbolFit: first.fit || null }, null);
  edges.push(['canvas', 'canvas', 'figure', 'canvas'], ['grid', 'grid', 'figure', 'grid'], ['palette', 'palette', 'figure', 'palette'], ['element', 'content', 'figure', 'content']);
  nodes.filter(n => ['cell-rules', 'component-rule', 'repeat', 'transform'].includes(n.type)).forEach(n => edges.push([n.ref, 'rules', 'figure', 'rules']));
  return { nodes, edges };
}

// ── The registry entries (meta + compute). Labels: UI-COPY §2. ──
const RULE_OUT = [{ name: 'rules', type: 'rule', label: 'Rules' }];
export function figureNodeTypes() {
  return [
    { meta: { id: 'canvas', label: 'Canvas', category: 'Foundation', inputs: [], outputs: [{ name: 'canvas', type: 'canvas', label: 'Canvas' }],
        params: [{ name: 'preset', default: 'Square 1:1' }, { name: 'mode', default: 'screen' }, { name: 'unit', default: 'mm' }, { name: 'pw', default: 1080 }, { name: 'ph', default: 1080 },
          { name: 'dpi', default: 300 }, { name: 'bleed', default: 3 }, { name: 'margin', default: 5 }] },
      compute: (i, p) => ({ canvas: canvasOf(p) }) },
    { meta: { id: 'grid', label: 'Grid', category: 'Foundation', inputs: [], outputs: [{ name: 'grid', type: 'grid', label: 'Grid' }],
        params: [{ name: 'gen', default: 'rectangular' }, { name: 'params', default: gridDefaults('rectangular') }] },
      compute: (i, p) => { const gen = SYMGRID_GENS[p.gen] || FIGURE_LATTICES[p.gen] ? p.gen : 'rectangular'; return { grid: { gen, params: { ...gridDefaults(gen), ...(p.params || {}) } } }; } },
    { meta: { id: 'palette', label: 'Palette', category: 'Foundation', inputs: [], outputs: [{ name: 'palette', type: 'palette', label: 'Palette' }],
        params: [{ name: 'colors', default: ['#1a1a1a', '#e85d3a', '#2f6fb0'] }, { name: 'paper', default: '#ffffff' }, { name: 'rule', default: { mode: 'index', offset: 0 } }] },
      compute: (i, p) => ({ palette: { colors: (p.colors || []).slice(), paper: p.paper || '#ffffff', rule: COLOR_RULES[(p.rule || {}).mode] ? p.rule : { mode: 'index', offset: 0 } } }) },
    { meta: { id: 'element', label: 'Element', category: 'Content', inputs: [], outputs: [{ name: 'content', type: 'content', label: 'Content' }],
        params: [{ name: 'name', default: '' }, { name: 'snapshot', default: null }] },
      compute: (i, p) => { if (!p.snapshot) throw new Error('Pick a saved Element.'); return { content: { kind: 'element', name: p.name, entry: p.snapshot } }; } },
    { meta: { id: 'component', label: 'Component', category: 'Content', inputs: [], outputs: [{ name: 'content', type: 'content', label: 'Content' }],
        params: [{ name: 'name', default: '' }, { name: 'snapshot', default: null }] },
      compute: (i, p) => { if (!p.snapshot) throw new Error('Pick a saved Component.'); return { content: { kind: 'component', name: p.name, entry: p.snapshot } }; } },
    { meta: { id: 'cell-rules', label: 'Cell rules', category: 'Rules', inputs: [], outputs: RULE_OUT, params: [{ name: 'rules', default: [] }] },
      compute: (i, p) => ({ rules: ruleOf('cell-rules', p) }) },
    { meta: { id: 'component-rule', label: 'Component rule', category: 'Rules', inputs: [], outputs: RULE_OUT, params: [{ name: 'rule', default: 'radial' }, { name: 'params', default: {} }] },
      compute: (i, p) => ({ rules: ruleOf('component-rule', p) }) },
    { meta: { id: 'repeat', label: 'Repeat in grid', category: 'Rules', inputs: [], outputs: RULE_OUT,
        params: [{ name: 'lattice', default: 'square' }, { name: 'count', default: 2 }, { name: 'cellSize', default: null }, { name: 'altFlip', default: false }, { name: 'rotate', default: 0 }, { name: 'mirror', default: 'none' }] },
      compute: (i, p) => ({ rules: ruleOf('repeat', p) }) },
    { meta: { id: 'transform', label: 'Rotate & mirror', category: 'Rules', inputs: [], outputs: RULE_OUT, params: [{ name: 'rotate', default: 0 }, { name: 'mirror', default: 'none' }] },
      compute: (i, p) => ({ rules: ruleOf('transform', p) }) },
    { meta: { id: 'figure', label: 'Figure', category: 'Output',
        inputs: [{ name: 'canvas', type: 'canvas', label: 'Canvas', required: true }, { name: 'grid', type: 'grid', label: 'Grid', required: true },
          { name: 'palette', type: 'palette', label: 'Palette' }, { name: 'content', type: 'content', label: 'Content', required: true, multi: true },
          { name: 'rules', type: 'rule', label: 'Rules', multi: true }],
        outputs: [{ name: 'figure', type: 'figure', label: 'Figure' }],
        params: [{ name: 'fit', default: 'contain' }, { name: 'clip', default: true }, { name: 'keepOwn', default: false }, { name: 'symbolFit', default: null }] },
      compute: async (i, p) => ({ figure: await compileFigure(i, p) }) },
  ];
}
