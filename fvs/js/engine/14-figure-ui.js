// Flexible Visual System · engine/14-figure-ui — the engine part of 14-figure-ui.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, offscreenCanvas, pc, pv, state
} from './00-core.js';
import {
  mulberry32
} from './03-rules.js';
import {
  CW_MIN_CONTRAST, buildColourways, cwMetrics, cwSolve, getSelectedComponent
} from './06-component-ui.js';
import {
  hexKey
} from './07-library.js';
import {
  buildSymbolSVG
} from './09-symbol-render.js';
import {
  FIGURE_RECIPES_V1_AS_V2, hexFigureRecipes, isSealedSymbol, recursiveFigureRecipes, triangleFigureRecipes,
  validateFigureRecipe
} from './13-figure-engine.js';
// ── Figure tier: the form, the recipe JSON, the checks, the reference overlay ──
export const FIGURE_CLASSIC_LABELS = { circle: 'Circle from four arcs', 'leaf-block': 'Leaf block 2×2', 'leaf-wave': 'Leaf wave (tiled 2×2)', 'leaf-wave-outline': 'Leaf wave, outline', 'leaf-two-ink': 'Leaf wave, two inks (4×4)', pinwheel: 'Triangle pinwheels (3×3)', kaleidoscope: 'Arc kaleidoscope' };
export const figureCatalog = () => {
  const cat = {};
  Object.entries(triangleFigureRecipes()).forEach(([k, r]) => {
    const [a, c] = k.split(':');
    cat['Triangle · ' + { sierpinski: 'Sierpinski', trapezoid: 'Trapezoid', lattice4: 'Lattice 4' }[a] + ' · ' + { asset: 'asset', repeated: 'repeated', 'mirror-1': 'mirrored, one axis', 'mirror-2': 'mirrored, two axes' }[c]] = r;
  });
  Object.entries(FIGURE_RECIPES_V1_AS_V2).forEach(([k, r]) => { cat['Classic · ' + FIGURE_CLASSIC_LABELS[k]] = { tool: 'fvs-recipe', version: 2, ...r }; });
  Object.entries(hexFigureRecipes()).forEach(([k, r]) => { cat[k] = r; });
  Object.entries(recursiveFigureRecipes()).forEach(([k, r]) => { cat[k] = r; });
  return cat;
};
export const FG_LATTICE_OF = v => /^tier(\d)$/.test(v) ? { type: 'tier', stack: +v[4] } : /^tri(\d)$/.test(v) ? { type: 'triangle', rows: +v[3] } : { type: 'square', n: +v.match(/^square(\d+)/)[1] };
export const FG_STR_OF = l => l.type === 'tier' ? 'tier' + l.stack : l.type === 'triangle' ? 'tri' + l.rows : `square${l.n}x${l.n}`;
// ── Pipeline strip, starting gallery, recipe history ──
// The strip shows each step's own output (Element → Symbol/Component → Grid… → Mirror/Rotate)
// as a thumbnail; a thumbnail is a truncated run of the same recipe, cached by its JSON.
export const figureStepCache = new Map();
export const figureGalleryCache = new Map();
export function capMap(m, n) { while (m.size > n) m.delete(m.keys().next().value); }
export const svgURI = svg => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
export function figureCardHTML(label, svg, extra) {
  return `<img alt="" src="${svgURI(svg)}"><span>${label}</span>${extra || ''}`;
}
// History of recipes (JSON snapshots, max 50)
export const figureHistory = { stack: [], idx: -1 };
// ── Figure workspace: the active step, cell tools, rule chips, the step panel ──
export const FIGURE_TOOLS = [
  ['toggle', 'Toggle', 'Click a cell to switch it between Seed and Empty'], ['seed', 'Seed', 'Fill the cell with the Seed'], ['empty', 'Empty', 'Leave the cell blank'],
  ['rotate', 'Rotate', 'Turn the cell by 90° (60° on a hexagonal lattice, 180° on a triangular one)'], ['flipH', 'Flip H', 'Mirror the cell left–right'], ['flipV', 'Flip V', 'Mirror the cell top–bottom'],
];
export const figureStepIds = def => ['element'].concat(def.levels.map((_, i) => 'level' + i), ['final']);
export const figurePaintable = () => !!state.figureShown && state.figureStep === 'level0' && state.figureShown.def.levels[0].kind === 'symbol' && !isSealedSymbol(state.figureShown.def.levels[0]);
// Painting a cell writes a Rule: a single cell → `when {index}`, Shift → the whole class of that cell.
export function figureClassWhen(ctx, lat) {
  if (lat.type === 'triangle' && ctx.orient) return { class: ctx.orient };
  if (lat.type === 'hexagon' && ctx.ring != null) return { ring: ctx.ring };
  return { parity: ctx.parity };
}
export function paintCell(def, ctx, cellState, tool, byClass) {
  const d = JSON.parse(JSON.stringify(def)), first = d.levels[0];
  if (first.kind !== 'symbol' || isSealedSymbol(first)) return d;
  const when = byClass ? figureClassWhen(ctx, first.lattice) : { index: ctx.index };
  const step = first.lattice.type === 'hexagon' ? 60 : first.lattice.type === 'triangle' ? 180 : 90;   // a triangle only fits its cell turned by 180°
  const act = {
    toggle: () => ({ content: cellState.source === 'empty' ? 'filled' : 'empty' }), seed: () => ({ content: 'filled' }), empty: () => ({ content: 'empty' }),
    rotate: () => ({ rotate: (((cellState.rotation || 0) + step) % 360 + 360) % 360 }), flipH: () => ({ flipH: !cellState.flipH }), flipV: () => ({ flipV: !cellState.flipV }),
  }[tool];
  if (!act) return d;
  const dd = act(), key = JSON.stringify(when);
  first.rules = first.rules || [];
  const same = first.rules.find(r => JSON.stringify(r.when || {}) === key);
  if (same) { same.do = { ...same.do, ...dd }; delete same.off; } else first.rules.push({ when, do: dd });
  return d;
}
// ── Play: variations, shuffle with locks ──
// A mutation changes one thing in one of five groups; shuffle and variations are built from them, always
// through validateFigureRecipe, so every result is a valid recipe.
export const FG_LOCK_GROUPS = [['element', 'Element'], ['symbol', 'Symbol'], ['rules', 'Rules'], ['grid', 'Grid'], ['transform', 'Mirror / Rotate']];
export const FG_SEED_POOL = ['triangle', 'arc', 'star', 'polygon', 'blob', 'chevron', 'cross', 'lens', 'roundedrect', 'drop', 'circle', 'wedge'];
// Colour moves come from colour theory, not a fixed list: a hue turned by a harmony
// angle (OKLCH, lightness and chroma kept), a colourway of the recipe's own palette
// (COLOUR_SCHEMES — its shade scales), another colour rule. Each result is solved
// against the paper (cwSolve), so an ink never ends up unreadable.
export const FG_HUE_TURNS = [30, -30, 60, -60, 120, -120, 180];   // analogous · split · triadic · complementary
export const fgBaseColours = d => ({ colors: (d.element.colors && d.element.colors.length ? d.element.colors : ['#000000']).map(hexKey), paper: d.element.paper ? hexKey(d.element.paper) : '#ffffff', colorRule: { ...DEFAULT_COLOR_RULE, ...(d.element.colorRule || {}) } });
export const fgPick = (a, rng) => a[Math.floor(rng() * a.length)];
export function fgLastGridTransform(d) {
  const g = d.levels.length - 1; if (g < 1) return null;
  return d.levels[g].transform ? d.levels[g].transform : (d.transform = d.transform || {});
}
export function fgSymbol(d) { return d.levels[0].kind === 'symbol' && !isSealedSymbol(d.levels[0]) ? d.levels[0] : null; }
export const FIGURE_MUTATIONS = [
  { group: 'element', name: 'Other Seed', fn: (d, rng) => { const cur = d.element.type, t = fgPick(FG_SEED_POOL.filter(x => x !== cur), rng); d.element.type = t; if (t === 'arc') d.element.params = { 'rg-thickness': 100 }; else delete d.element.params; delete d.element.strokeW; if (d.element.style === 'stroke') d.element.strokeW = 4; return true; } },
  { group: 'element', name: 'Other hue', fn: (d, rng) => {
      const C = Organica.color, b = fgBaseColours(d), turn = fgPick(FG_HUE_TURNS, rng), grey = Math.round(rng() * 12) * 30;
      const turned = b.colors.map(h => { const o = C.hexToOklch(h); return o.c < 0.03 ? C.oklchToHex(Math.min(0.7, Math.max(0.5, o.l)), 0.16, grey) : C.oklchToHex(o.l, o.c, (o.h + turn + 360) % 360); });   // a grey has no hue to turn: it is given one
      const solved = cwSolve(turned, b.paper);
      if (!solved) return false;
      d.element.colors = solved; return true; } },
  { group: 'element', name: 'Other colourway', fn: (d, rng) => {
      const b = fgBaseColours(d), all = buildColourways(b, null, 0).slice(1);
      const same = all.filter(cw => cw.colors.length === b.colors.length), pool = same.length ? same : all;   // keep the number of inks when a scheme allows it
      if (!pool.length) return false;
      const cw = fgPick(pool, rng);
      d.element.colors = cw.colors.slice(); d.element.paper = cw.paper; return true; } },
  { group: 'element', name: 'Other colour rule', fn: (d, rng) => {
      const b = fgBaseColours(d);
      if (b.colors.length < 2) return false;
      d.element.colorRule = { mode: fgPick(Object.keys(COLOR_RULES).filter(m => m !== b.colorRule.mode && m !== 'own'), rng), offset: b.colorRule.offset || 0 }; return true; } },
  { group: 'element', name: 'Fill ↔ Stroke', fn: d => { if (d.element.style === 'stroke') { d.element.style = 'fill'; delete d.element.strokeW; } else { d.element.style = 'stroke'; d.element.strokeW = 4; } return true; } },
  { group: 'symbol', name: 'Bigger / smaller layout', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; const l = s2.lattice, key = l.type === 'triangle' ? 'rows' : l.type === 'hexagon' ? 'rings' : 'cols', lo = l.type === 'hexagon' ? 1 : 2, hi = l.type === 'hexagon' ? 3 : l.type === 'triangle' ? 5 : 4; const v = l[key] + (rng() < 0.5 ? -1 : 1); if (v < lo || v > hi) return false; l[key] = v; if (l.type === 'square') l.rows = v; return true; } },
  { group: 'rules', name: 'Toggle a class', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; s2.rules = s2.rules || []; const l = s2.lattice;
      if (l.type === 'triangle') { const r = s2.rules.find(x => x.when && x.when.class === 'down'); if (r) { r.do = r.do.content === 'empty' ? { content: 'filled', rotate: 180 } : { content: 'empty' }; } else s2.rules.push({ when: { class: 'down' }, do: { content: 'empty' } }); return true; }
      if (l.type === 'hexagon') { const i = s2.rules.findIndex(x => x.when && x.when.ring === 0); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: { ring: 0 }, do: { content: 'empty' } }); return true; }
      const i = s2.rules.findIndex(x => x.when && x.when.parity === 'odd' && x.do.content); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: { parity: 'odd' }, do: { content: 'empty' } }); return true; } },
  { group: 'rules', name: 'Empty a row', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; const l = s2.lattice, n = l.type === 'triangle' ? l.rows : l.type === 'hexagon' ? 2 * l.rings - 1 : (l.rows || l.cols); const row = Math.floor(rng() * n); s2.rules = s2.rules || [];
      if (s2.rules.some(x => x.when && x.when.row != null && [].concat(x.when.row).includes(row))) return false; s2.rules.push({ when: { row: [row] }, do: { content: 'empty' } }); return true; } },
  { group: 'rules', name: 'Turn cells', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; s2.rules = s2.rules || []; const l = s2.lattice;
      if (l.type === 'hexagon') { const i = s2.rules.findIndex(x => x.do && x.do.rotate === 'sector'); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: {}, do: { rotate: 'sector', scale: 0.62 } }); return true; }
      const i = s2.rules.findIndex(x => x.when && x.when.parity === 'odd' && x.do && x.do.rotate != null); const deg = l.type === 'triangle' ? 180 : fgPick([90, 180, 270], rng); if (i >= 0) s2.rules[i].do.rotate = deg; else s2.rules.push({ when: { parity: 'odd' }, do: { rotate: deg } }); return true; } },
  { group: 'rules', name: 'Flip cells', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; s2.rules = s2.rules || []; const i = s2.rules.findIndex(x => x.when && x.when.parity === 'odd' && x.do && x.do.flipH != null); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: { parity: 'odd' }, do: { flipH: true } }); return true; } },
  { group: 'rules', name: 'Drop a rule', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2 || !(s2.rules || []).length) return false; s2.rules.splice(Math.floor(rng() * s2.rules.length), 1); return true; } },
  { group: 'grid', name: 'Other Grid', fn: (d, rng) => { const g = d.levels.length - 1; const types = FG_GRID_TYPES.map(x => x[0]); if (g < 1) { d.levels.push({ kind: 'grid', lattice: FG_LATTICE_OF(fgPick(types, rng)), cellSize: 110 }); return true; }
      const cur = FG_STR_OF(d.levels[g].lattice); d.levels[g].lattice = FG_LATTICE_OF(fgPick(types.filter(x => x !== cur), rng)); return true; } },
  { group: 'grid', name: 'Add a Grid', fn: (d, rng) => { if (d.levels.length >= 4) return false; d.levels.push({ kind: 'grid', lattice: FG_LATTICE_OF(fgPick(['tier1', 'tri2', 'square2x2'], rng)), cellSize: 110 }); return true; } },
  { group: 'grid', name: 'Remove a Grid', fn: d => { if (d.levels.length < 2) return false; d.levels.pop(); return true; } },
  { group: 'transform', name: 'Rotate', fn: d => { const t = fgLastGridTransform(d); if (!t) return false; applyHandle(t, 'rotate'); return true; } },
  { group: 'transform', name: 'Mirror', fn: (d, rng) => { const t = fgLastGridTransform(d); if (!t) return false; const cur = t.mirror || 'none'; t.mirror = fgPick(['none', 'v', 'h', 'vh'].filter(x => x !== cur), rng); return true; } },
];
// Rule chips
export function describeRule(r) {
  const w = r.when || {}, d = r.do || {}, parts = [];
  if (w.class != null) parts.push([].concat(w.class).join('/') + ' cells');
  if (w.ring != null) parts.push('ring ' + [].concat(w.ring).join('/'));
  if (w.sector != null) parts.push('sector ' + [].concat(w.sector).join('/'));
  if (w.row != null) parts.push('row ' + [].concat(w.row).map(x => x + 1).join('/'));
  if (w.col != null) parts.push('column ' + [].concat(w.col).map(x => x + 1).join('/'));
  if (w.index != null) parts.push('cell ' + [].concat(w.index).map(x => x + 1).join('/'));
  if (w.parity != null) parts.push(w.parity + ' cells');
  const what = [];
  if (d.content === 'empty') what.push('Empty'); if (d.content === 'filled') what.push('Seed');
  if (d.rotate != null) what.push(d.rotate === 'sector' ? 'Rotate by sector' : 'Rotate ' + d.rotate + '°');
  if (d.flipH != null) what.push(d.flipH ? 'Flip H' : 'Unflip H'); if (d.flipV != null) what.push(d.flipV ? 'Flip V' : 'Unflip V');
  if (d.scale != null) what.push('Scale ' + Math.round(d.scale * 100) + '%');
  return (parts.length ? parts.join(' + ') : 'all cells') + ' → ' + (what.join(', ') || '—');
}
// Edge handles: the right edge mirrors over it, the bottom edge mirrors over it, the corner rotates.
export function figureHandleTarget() {
  const sh = state.figureShown; if (!sh || sh.def.levels.length < 2) return -1;
  if (state.figureStep === 'final') return sh.def.levels.length - 1;
  if (state.figureStep.startsWith('level')) { const k = +state.figureStep.slice(5); return sh.def.levels[k] && sh.def.levels[k].kind === 'grid' ? k : -1; }
  return -1;
}
// Pure: how a handle changes a transform {rotate, mirror}
export function applyHandle(t, kind) {
  const cur = t.mirror || 'none', hasV = cur === 'v' || cur === 'vh', hasH = cur === 'h' || cur === 'vh';
  if (kind === 'mirror-v') t.mirror = hasV ? (hasH ? 'h' : 'none') : (hasH ? 'vh' : 'v');
  else if (kind === 'mirror-h') t.mirror = hasH ? (hasV ? 'v' : 'none') : (hasV ? 'vh' : 'h');
  else if (kind === 'rotate') t.rotate = (((t.rotate || 0) + 90) % 360);
  return t;
}
// The step panel: the few parameters of whichever step is active
export const FG_SEEDS = ['triangle', 'arc', 'arctruchet', 'wedge', 'polygon', 'star', 'roundedrect', 'chevron', 'cross', 'lens', 'circle', 'drop', 'blob'];
export const FG_ICONS = {
  triangle: '<path d="M20 5 L5 33 H35 Z M12.5 19 H27.5 M20 33 L12.5 19 M20 33 L27.5 19"/>',
  square: '<rect x="6" y="6" width="28" height="28"/><path d="M20 6V34M6 20H34"/>',
  hexagon: '<path d="M20 4 L34 12 V28 L20 36 L6 28 V12 Z M20 4V36 M6 12L34 28 M34 12L6 28"/>',
  component: '<rect x="6" y="6" width="28" height="28"/><path d="M20 6V34M6 20H34"/><circle cx="20" cy="20" r="8"/>',
  tier1: '<path d="M11 12 H29 L37 30 H3 Z M11 12 L20 30 L29 12"/>',
  tier2: '<path d="M13 4H27L34 16H6Z M13 4L20 16L27 4 M10 22H30L38 36H2Z M10 22L20 36L30 22"/>',
  tri2: '<path d="M20 5 L5 33 H35 Z M12.5 19 H27.5 M20 33 L12.5 19 M20 33 L27.5 19"/>',
  tri3: '<path d="M20 5 L5 33 H35 Z M15 14 H25 M10 24 H30 M20 33 L10 24 M20 33 L30 24 M15 14 L20 24 M25 14 L20 24"/>',
  square2x2: '<rect x="6" y="6" width="28" height="28"/><path d="M20 6V34M6 20H34"/>',
  square3x3: '<rect x="6" y="6" width="28" height="28"/><path d="M15.3 6V34M24.7 6V34M6 15.3H34M6 24.7H34"/>',
};
export const FG_GRID_TYPES = [['tier1', 'Tier'], ['tier2', 'Tier ×2'], ['tri2', 'Triangle 2'], ['tri3', 'Triangle 3'], ['square2x2', 'Square 2×2'], ['square3x3', 'Square 3×3']];
// The two or three settings of each Seed that change it most (control id → label); ranges come from the controls themselves.
export const FG_SEED_MAIN = {
  triangle: [['rg-tri-apex', 'Apex'], ['rg-tri-corner', 'Rounding']], arc: [['rg-thickness', 'Thickness'], ['rg-arc-sweep', 'Sweep']],
  arctruchet: [['rg-arc-count', 'Bands'], ['rg-arc-ratio', 'Thickness']], wedge: [['rg-wedge-angle', 'Angle'], ['rg-wedge-inner', 'Hole']],
  polygon: [['rg-poly-sides', 'Sides'], ['rg-poly-corner', 'Rounding']], star: [['rg-star-points', 'Points'], ['rg-star-inner', 'Inner radius']],
  roundedrect: [['rg-rr-width', 'Width'], ['rg-rr-corner', 'Rounding']], chevron: [['rg-chev-notch', 'Notch'], ['rg-chev-arm', 'Thickness']],
  cross: [['rg-cross-armwidth', 'Thickness'], ['rg-cross-corner', 'Rounding']], lens: [['rg-lens-width', 'Width']],
  circle: [['rg-circle-radius', 'Radius'], ['rg-circle-lobes', 'Lobes']], drop: [['rg-drop-radius', 'Size'], ['rg-drop-tail', 'Tail']],
  blob: [['rg-blob-amount', 'Wobble'], ['rg-blob-seed', 'Variation']],
};
// A fresh first level: a Component block or a Symbol on a triangle / square / hexagon lattice.
// Row/ring/col defaults match the Symbol size ladder's own lower bound (5 for
// triangle/square, 4 rings for hexagon — hexLoomModel(4) = 37 cells, confirmed live;
// Component stays its own 1-4 tier, untouched). See CLAUDE.md session note.
export function figureFirstLevelOf(v) {
  return v === 'component' ? { kind: 'component', grid: 'square2x2', rule: 'checkerboard', params: { a: 180, b: 0 } }
    : { kind: 'symbol', lattice: v === 'triangle' ? { type: 'triangle', rows: 5 } : v === 'hexagon' ? { type: 'hexagon', rings: 4 } : { type: 'square', cols: 5, rows: 5 }, fit: v === 'triangle' ? 'fill' : 'contain', rules: [] };
}
// The mask's own box resampled to m×m (so two silhouettes of different size compare shape, not scale).
export function normMask(M, m) {
  const out = new Uint8Array(m * m); if (!M.box) return out;
  const bw = M.box.x1 - M.box.x0, bh = M.box.y1 - M.box.y0;
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) out[y * m + x] = M.mask[Math.min(M.n - 1, Math.floor(M.box.y0 + (y + .5) * bh / m)) * M.n + Math.min(M.n - 1, Math.floor(M.box.x0 + (x + .5) * bw / m))];
  return out;
}
export const maskIoU = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { i += a[k] & b[k]; u += a[k] | b[k]; } return u ? i / u : 0; };
// A figure (SVG text) or an image → a 0/1 mask of what is not ground on an n × n grid, plus its box. For the Figure
// checks (silhouette, symmetry) and a reference image. Engine-side: drawn on an offscreen canvas, never mounted.
export async function rasterMask(src, n, ground) {
  const c = offscreenCanvas(n, n), g = c.getContext('2d');
  const im = (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) ? src : await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(src); });
  const w = im.naturalWidth || n, h = im.naturalHeight || n, k = Math.min(n / w, n / h);
  const ox = (n - w * k) / 2, oy = (n - h * k) / 2;
  g.fillStyle = ground || '#ffffff'; g.fillRect(0, 0, n, n);
  g.drawImage(im, ox, oy, w * k, h * k);
  let d = g.getImageData(0, 0, n, n).data;
  let gr = ground ? null : [0, 0, 0];
  if (!ground) {
    // an image's ground is read from its OWN corners (the letterbox is not part of it), then the box is repainted with it
    const cx0 = Math.ceil(ox), cx1 = Math.floor(ox + w * k) - 1, cy0 = Math.ceil(oy), cy1 = Math.floor(oy + h * k) - 1;
    [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]].forEach(([x, y]) => { const i = (y * n + x) * 4; gr[0] += d[i] / 4; gr[1] += d[i + 1] / 4; gr[2] += d[i + 2] / 4; });
    g.fillStyle = `rgb(${gr.map(Math.round).join(',')})`; g.fillRect(0, 0, n, n); g.drawImage(im, ox, oy, w * k, h * k);
    d = g.getImageData(0, 0, n, n).data;
  } else { const t = offscreenCanvas(1, 1).getContext('2d'); t.fillStyle = ground; t.fillRect(0, 0, 1, 1); const p = t.getImageData(0, 0, 1, 1).data; gr = [p[0], p[1], p[2]]; }
  const mask = new Uint8Array(n * n); let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4, dist = Math.abs(d[i] - gr[0]) + Math.abs(d[i + 1] - gr[1]) + Math.abs(d[i + 2] - gr[2]);
    if (dist > 110) { mask[y * n + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { mask, n, box: x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 } };
}
export function figureMutateOnce(def, mut, rng) {
  const d = JSON.parse(JSON.stringify(def));
  try { if (!mut.fn(d, rng)) return null; validateFigureRecipe(d); } catch (e) { return null; }
  return JSON.stringify(d) === JSON.stringify(def) ? null : d;
}
// Up to `count` different recipes, each one mutation away from `def`. Deterministic for a given seed.
export function figureNeighbours(def, seed, count) {
  count = count || 9;
  const rng = mulberry32(seed >>> 0), order = FIGURE_MUTATIONS.map((m, i) => [rng(), i]).sort((a, b) => a[0] - b[0]).map(x => FIGURE_MUTATIONS[x[1]]);
  const out = [], seen = new Set([JSON.stringify(def)]);
  for (let pass = 0; pass < 4 && out.length < count; pass++) for (const m of order) {
    if (out.length >= count) break;
    const d = figureMutateOnce(def, m, rng); if (!d) continue;
    const k = JSON.stringify(d); if (seen.has(k)) continue; seen.add(k); out.push({ recipe: d, label: m.name });
  }
  return out;
}
// One to three mutations of groups that are not locked; null when everything is locked.
export function figureShuffle(def, locks, seed) {
  const rng = mulberry32(seed >>> 0), pool = FIGURE_MUTATIONS.filter(m => !(locks && locks[m.group]));
  if (!pool.length) return null;
  // A later mutation can undo an earlier one (Fill ↔ Stroke twice, Add then Remove a Grid) — a step
  // that lands back on `def` is rejected, so a shuffle always changes something.
  const start = JSON.stringify(def);
  let d = def, changed = 0; const want = 1 + Math.floor(rng() * 3);
  for (let tries = 0; tries < 30 && changed < want; tries++) { const n = figureMutateOnce(d, fgPick(pool, rng), rng); if (n && JSON.stringify(n) !== start) { d = n; changed++; } }
  return changed ? d : null;
}
// Checks — every one reads the drawn result, none reads the recipe's own intent back.
export function figureChecks(def, svg) {
  const out = [];
  const add = (ok, label, detail) => out.push({ ok, label, detail });
  const noDefs = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '');
  add(!/NaN|undefined|Infinity/.test(svg), 'Numbers are valid', '');
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]), ids = new Set([...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
  add(refs.every(r => ids.has(r)), 'Every clip reference resolves', refs.length + ' refs');
  add((svg.match(/<metadata>/g) || []).length <= 1 && (svg.match(/<defs>/g) || []).length <= 1, 'Defs and metadata appear once', '');
  const paths = (noDefs.match(/<path /g) || []).length;
  const first = def.levels[0];
  let slots = null;
  if (isSealedSymbol(first)) {
    add(state.symbolCells.length === first.cells.length, 'Lattice has the expected number of slots', `${state.symbolCells.length} of ${first.cells.length}`);
    // a cell may hold a whole Component (many shapes): count what the Symbol itself draws
    slots = (buildSymbolSVG().replace(/<defs>[\s\S]*?<\/defs>/g, '').match(/<path /g) || []).length;
  } else if (first.kind === 'symbol') {
    const l = first.lattice, total = l.type === 'triangle' ? l.rows * l.rows : l.type === 'hexagon' ? 3 * l.rings * (l.rings - 1) + 1 : l.cols * (l.rows || l.cols);
    add(state.symbolCells.length === total, 'Lattice has the expected number of slots', `${state.symbolCells.length} of ${total}`);
    slots = state.symbolCells.filter(c => c.source !== 'empty').length;
  } else slots = getSelectedComponent() ? getSelectedComponent().cells.length : 0;
  const stats = state.figureLevelStats || [];
  const expected = stats.reduce((acc, st) => acc * st.tiles * st.copies, slots);
  add(paths === expected, 'Shapes drawn = filled slots × tiles × mirror copies (per level)', `${paths} of ${expected}`);
  add(svg.length < 400000, 'File size is reasonable', Math.round(svg.length / 1024) + ' KB');
  // colour, read from what was drawn with (the live palette after the run)
  // the inks the drawing really uses (Keep own colours, Components' own palettes), else the live palette
  const drawn = [...new Set((svg.match(/(?:fill|stroke)="#[0-9a-fA-F]{6}"/g) || []).map(m => hexKey(m.slice(m.indexOf('#'), m.indexOf('#') + 7))))].filter(h => h !== hexKey(state.paperColor));
  const cm = cwMetrics({ colors: drawn.length ? drawn : state.colors.map(hexKey), paper: state.paperColor });
  add(cm.minContrast >= CW_MIN_CONTRAST, `Inks read on the paper (${CW_MIN_CONTRAST}:1 or more)`, cm.minContrast.toFixed(1) + ':1');
  if (cm.minDeltaE != null) add(cm.minDeltaE >= Organica.color.DISTINCT_MIN, 'Inks are distinct', 'ΔE ' + Math.round(cm.minDeltaE));
  return out;
}
