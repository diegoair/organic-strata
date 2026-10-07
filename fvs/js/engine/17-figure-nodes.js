// Flexible Visual System · engine/17-figure-nodes — the Figure graph's node types (Organica.nodeCanvas registry).
// An ES module of the Figure tier (loaded on demand by ./figure.js). It imports only earlier files. docs/FVS.md §12.
//
// A Figure = one Canvas + one Grid (+ an optional Palette) + content from the saved libraries, compiled to a recipe and
// rendered by evalFigure() — no rendering code of its own. The Grid is generated INSIDE the Canvas by Loom's own
// generators (symbolGridModel, the Symbol step's own path), so the Canvas is the figure's frame; every cell gets a
// content patch — the same patch the Library rail drops into a Symbol cell — taken in turn from the connected content.
// Words: docs/UI-COPY.md §2 "Figure graph" (decided by the content designer, Oct 7, 2026).
import {
  DEFAULT_COLOR_RULE, COLOR_RULES
} from './00-core.js';
import {
  SEED_TYPES
} from './01-geometry.js';
import {
  PX_PER_MM, SYMCANVAS_PRESETS, SYMGRID_GENS, symbolGridModel
} from './08-symbol-grid.js';
import {
  evalFigure
} from './16-figure-eval.js';

const clone = o => JSON.parse(JSON.stringify(o));
export const FIGURE_PORT_TYPES = ['canvas', 'grid', 'palette', 'content', 'figure'];

// ── Canvas: the figure's page — readSymbolCanvas()'s shape, from params instead of the panel ──
export function canvasOf(p) {
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
    margin: Math.max(0, Math.min(40, +p.margin || 0)), W: Math.round(toPx(pw) * 100) / 100, H: Math.round(toPx(ph) * 100) / 100 };
}
export function canvasSummary(cv) {
  return cv.mode === 'print' ? `${cv.pw} × ${cv.ph} ${cv.unit} · ${cv.dpi} dpi` : `${cv.pw} × ${cv.ph} px`;
}

// ── Grid: a Loom generator + its params (the model is built per Canvas, inside the Figure) ──
export function gridDefaults(gen) {
  const spec = SYMGRID_GENS[gen] || SYMGRID_GENS.rectangular, out = {};
  spec.params.forEach(([k, , a, b, , def]) => { out[k] = a === 'text' ? b : def; });
  return out;
}
export function gridSummary(g) {
  const spec = SYMGRID_GENS[g.gen]; if (!spec) return g.gen;
  const p = g.params || {};
  if (p.cols != null && p.rows != null) return `${spec.label} ${p.cols} × ${p.rows}`;
  if (p.cols != null) return `${spec.label} · ${p.cols} columns`;
  if (p.rings != null) return `${spec.label} · ${p.rings} rings`;
  return spec.label;
}

// ── Content: a saved Element / Component, carried with a copy of its entry (so the graph still draws it after the
// entry is renamed or deleted) → the cell patch a Symbol cell takes (railPatch(), from the copy) ──
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

// ── Figure: compile → recipe → evalFigure ──
export async function compileFigure(inputs, params) {
  const cv = inputs.canvas, grid = inputs.grid, pal = inputs.palette;
  const contents = (inputs.content || []).filter(Boolean);
  if (!contents.length) throw new Error('Connect an Element, a Component or a Symbol.');
  if (contents.some(c => c.kind === 'symbol')) throw new Error('A Symbol as content arrives in a later step — use Elements and Components for now.');
  const model = await symbolGridModel(grid.gen, { ...gridDefaults(grid.gen), ...(grid.params || {}) }, cv);
  const n = Organica.loadLoomGrid(clone(model)).cells.length;   // one cell patch per grid cell (what getSymbolGrid() resolves)
  const cells = Array.from({ length: n }, (_, i) => contentPatch(contents[i % contents.length], params.fit));
  const componentEntries = {};
  contents.forEach(c => { if (c.kind === 'component' && c.entry) componentEntries[c.name] = c.entry; });
  const firstSeed = contents.find(c => c.kind === 'element' && c.entry && c.entry.seed);
  const colors = pal && pal.colors && pal.colors.length ? pal.colors.slice() : null;
  const colorRule = pal ? { ...DEFAULT_COLOR_RULE, ...(pal.rule || {}) } : { ...DEFAULT_COLOR_RULE };
  const paper = pal && pal.paper ? pal.paper : '#ffffff';
  const recipe = { tool: 'fvs-recipe', version: 2,
    element: { type: firstSeed && SEED_TYPES[firstSeed.entry.seed.type] ? firstSeed.entry.seed.type : 'triangle', style: 'fill', colors: colors || ['#000000'], paper },
    levels: [{ kind: 'symbol', lattice: { type: 'loomModel', model }, cells, componentEntries, colors: colors || ['#000000'], colorRule, paperColor: paper, clip: params.clip !== false }] };
  const r = evalFigure(recipe);
  return { svg: r.svg, recipe, cells: n, shapes: r.shapes, canvas: cv };
}

// ── The registry entries (meta + compute). Labels: UI-COPY §2. ──
export function figureNodeTypes() {
  return [
    { meta: { id: 'canvas', label: 'Canvas', category: 'Foundation', inputs: [], outputs: [{ name: 'canvas', type: 'canvas', label: 'Canvas' }],
        params: [{ name: 'preset', default: 'Square 1:1' }, { name: 'mode', default: 'screen' }, { name: 'unit', default: 'mm' }, { name: 'pw', default: 1080 }, { name: 'ph', default: 1080 },
          { name: 'dpi', default: 300 }, { name: 'bleed', default: 3 }, { name: 'margin', default: 5 }] },
      compute: (i, p) => ({ canvas: canvasOf(p) }) },
    { meta: { id: 'grid', label: 'Grid', category: 'Foundation', inputs: [], outputs: [{ name: 'grid', type: 'grid', label: 'Grid' }],
        params: [{ name: 'gen', default: 'rectangular' }, { name: 'params', default: gridDefaults('rectangular') }] },
      compute: (i, p) => ({ grid: { gen: SYMGRID_GENS[p.gen] ? p.gen : 'rectangular', params: { ...gridDefaults(p.gen), ...(p.params || {}) } } }) },
    { meta: { id: 'palette', label: 'Palette', category: 'Foundation', inputs: [], outputs: [{ name: 'palette', type: 'palette', label: 'Palette' }],
        params: [{ name: 'colors', default: ['#1a1a1a', '#e85d3a', '#2f6fb0'] }, { name: 'paper', default: '#ffffff' }, { name: 'rule', default: { mode: 'index', offset: 0 } }] },
      compute: (i, p) => ({ palette: { colors: (p.colors || []).slice(), paper: p.paper || '#ffffff', rule: COLOR_RULES[(p.rule || {}).mode] ? p.rule : { mode: 'index', offset: 0 } } }) },
    { meta: { id: 'element', label: 'Element', category: 'Content', inputs: [], outputs: [{ name: 'content', type: 'content', label: 'Content' }],
        params: [{ name: 'name', default: '' }, { name: 'snapshot', default: null }] },
      compute: (i, p) => { if (!p.snapshot) throw new Error('Pick a saved Element.'); return { content: { kind: 'element', name: p.name, entry: p.snapshot } }; } },
    { meta: { id: 'component', label: 'Component', category: 'Content', inputs: [], outputs: [{ name: 'content', type: 'content', label: 'Content' }],
        params: [{ name: 'name', default: '' }, { name: 'snapshot', default: null }] },
      compute: (i, p) => { if (!p.snapshot) throw new Error('Pick a saved Component.'); return { content: { kind: 'component', name: p.name, entry: p.snapshot } }; } },
    { meta: { id: 'figure', label: 'Figure', category: 'Output',
        inputs: [{ name: 'canvas', type: 'canvas', label: 'Canvas', required: true }, { name: 'grid', type: 'grid', label: 'Grid', required: true },
          { name: 'palette', type: 'palette', label: 'Palette' }, { name: 'content', type: 'content', label: 'Content', required: true, multi: true }],
        outputs: [{ name: 'figure', type: 'figure', label: 'Figure' }],
        params: [{ name: 'fit', default: 'contain' }, { name: 'clip', default: true }] },
      compute: async (i, p) => ({ figure: await compileFigure(i, p) }) },
  ];
}
