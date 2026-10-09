// Flexible Visual System · engine/17-figure-nodes — the Figure graph's node types (Organica.nodeCanvas registry).
// An ES module of the Figure tier (loaded on demand by ./figure.js). It imports only earlier files. docs/FVS.md §12.
//
// A Figure = one Canvas + one Grid (+ an optional Palette) + content from the saved libraries + rules, compiled to a
// recipe and rendered by evalFigure() — no rendering code of its own.
//   · Grid = a Loom generator → generated INSIDE the Canvas (symbolGridModel, the Symbol step's own path), every cell
//     takes a content patch (the Library rail's patch), in turn from the connected content;
//   · Grid = an FVS lattice (Triangle / Square / Hexagon, the old Figure's) → the lattice keeps its own frame; with the
//     Canvas on "Figure’s own size" (id 'Fit to figure') the SVG is the figure itself, otherwise it is fitted onto the Canvas's page;
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
  mulberry32
} from './03-rules.js';
import {
  cwSolve
} from './06-component-ui.js';
import {
  componentCellsFromRule, ruleMatches, squareCR
} from './13-figure-engine.js';
import {
  FG_HUE_TURNS, describeRule
} from './14-figure-ui.js';
import {
  contentPatch, evalFigure, withFigureSandbox
} from './16-figure-eval.js';
export { contentPatch };

const clone = o => JSON.parse(JSON.stringify(o));
export const FIGURE_PORT_TYPES = ['canvas', 'grid', 'palette', 'content', 'rule', 'composition', 'figure'];
export const FIT_PRESET = 'Fit to figure';   // the stored preset id — saved graphs carry it; never shown
export const FIT_LABEL = 'Figure’s own size';   // what the UI says (O-43)

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
  if (cv.fit) return FIT_LABEL;
  return cv.mode === 'print' ? `${cv.pw} × ${cv.ph} ${cv.unit} · ${cv.dpi} DPI` : `${cv.pw} × ${cv.ph} px`;
}

// ── Grid: a Loom generator (inside the Canvas) or an FVS lattice (its own frame) ──
// One range per lattice (the atlas listed four different ones for the same lattice — this is now the only one).
export const FIGURE_LATTICES = {
  'lattice-triangle': { label: 'Triangle lattice', params: [['rows', 'Rows', 1, 8, 1, 2]] },
  'lattice-square': { label: 'Square lattice', params: [['cols', 'Columns', 1, 12, 1, 2], ['rows', 'Rows', 1, 12, 1, 2]] },
  'lattice-hexagon': { label: 'Hexagon lattice', params: [['rings', 'Grid size', 1, 6, 1, 3]] },   // id stays rings (UI-COPY: Grid size = cells along each side)
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
  if (p.cols != null && p.rows != null) return `${spec.label} · ${p.cols} × ${p.rows}`;
  if (p.cols != null) return `${spec.label} · ${p.cols} columns`;
  if (p.rows != null) return `${spec.label} · ${p.rows} rows`;
  if (p.rings != null) return `${spec.label} · grid size ${p.rings}`;
  return spec.label;
}
function latticeOf(g) {   // a lattice grid → recipe v2's lattice
  const p = { ...gridDefaults(g.gen), ...(g.params || {}) };
  if (g.gen === 'lattice-triangle') return { type: 'triangle', rows: p.rows };
  if (g.gen === 'lattice-hexagon') return { type: 'hexagon', rings: p.rings };
  return { type: 'square', cols: p.cols, rows: p.rows };
}
function latticeModel(l) { return l.type === 'triangle' ? triangleLoomModel(l.rows) : l.type === 'hexagon' ? hexLoomModel(l.rings) : squareLoomModel(l.cols, l.rows || l.cols); }
// A Grid's own drawing, for its card (the Loom model a Figure would draw in `cv`): a lattice, or a generator inside the Canvas.
export async function gridPreviewModel(grid, cv) {
  return isLattice(grid.gen) ? latticeModel(latticeOf(grid)) : symbolGridModel(grid.gen, { ...gridDefaults(grid.gen), ...(grid.params || {}) }, cv);
}

// ── Content: a saved Element / Component with a copy of its entry (contentPatch: engine/16) ──
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
  if (type === 'component-rule') {   // pose angles in degrees — graphs saved before Oct 9, 2026 stored 1–3 for 90–270° (then drawn as 1–3°)
    const q = clone(p.params || {}); ['base', 'a', 'b'].forEach(k => { if (+q[k] > 0 && +q[k] < 4) q[k] = +q[k] * 90; });
    return { kind: 'component', rule: p.rule || 'radial', params: q };
  }
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
// Rules are a chain (Diego, Oct 9, 2026): rule → rule → Figure, and the order is the chain's. A rule node's output is
// the ordered list so far (its upstream chain + itself). chainOf flattens whatever arrives on a Rules input — a chain,
// one rule (a graph saved before chains), or a list of either — into one ordered list of rules.
export const chainOf = x => [].concat(...[].concat(x == null ? [] : x).map(v => [].concat(v == null ? [] : v))).filter(Boolean);
const MIRROR_AXES = { none: '', v: 'v', h: 'h', vh: 'vh' };
const mergeMirror = (a, b) => { const s = new Set((MIRROR_AXES[a] || '') + (MIRROR_AXES[b] || '')); return s.has('v') && s.has('h') ? 'vh' : s.has('v') ? 'v' : s.has('h') ? 'h' : 'none'; };
// The chain → what the recipe needs, in one pass: cell rules (a Component rule's pose overwrites the turns and flips
// of the cell rules before it — a later step wins, as everywhere in the chain), the last Component rule, the Repeat
// levels in order, and each Rotate & mirror on the Repeat just before it in the chain.
export function chainPlan(chain) {
  const lastComp = chain.map(r => r.kind).lastIndexOf('component');
  const cellRules = [], levels = [], tfs = [];
  chain.forEach((r, i) => {
    if (r.kind === 'cells') (r.rules || []).forEach(c => {
      if (i < lastComp && c.do) {   // before the pose: its turn / flip is overwritten, the rest (empty, filled, scale) stays
        const d = { ...c.do }; delete d.rotate; delete d.flipH; delete d.flipV;
        if (Object.keys(d).length) cellRules.push({ ...clone(c), do: d });
      } else cellRules.push(clone(c));
    });
    else if (r.kind === 'repeat') { levels.push(clone(r.level)); tfs.push([]); }
    else if (r.kind === 'transform') {
      if (!levels.length) throw new Error('Rotate & mirror needs a Repeat in grid before it in the chain');
      tfs[levels.length - 1].push(r.transform);
    }
  });
  let transform = null;
  levels.forEach((lv, li) => {
    const list = tfs[li]; if (!list.length) return;
    if (li === levels.length - 1 && !lv.transform && list.length === 1) { transform = clone(list[0]); return; }   // the last Repeat's own: as a recipe's transform (unchanged recipes)
    const t = list.reduce((acc, x) => ({ rotate: ((acc.rotate + (+x.rotate || 0)) % 360 + 360) % 360, mirror: mergeMirror(acc.mirror, x.mirror) }), { rotate: (lv.transform && lv.transform.rotate) || 0, mirror: (lv.transform && lv.transform.mirror) || 'none' });
    if (t.rotate || t.mirror !== 'none') lv.transform = t; else delete lv.transform;
  });
  return { cellRules, compRule: lastComp >= 0 ? chain[lastComp] : null, repeats: levels, transform };
}

// ── Figure: compile → recipe (v2) → evalFigure ──
function fitOnPage(svg, cv, paper) {   // a figure with its own frame, fitted inside the Canvas's page (margin %)
  const m = svg.match(/^<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/), fw = m ? +m[1] : 1000, fh = m ? +m[2] : 1000;
  const mg = Math.min(cv.W, cv.H) * (cv.margin / 100), W = cv.W - 2 * mg, H = cv.H - 2 * mg, k = Math.min(W / fw, H / fh);
  const w = fw * k, h = fh * k, x = mg + (W - w) / 2, y = mg + (H - h) / 2;
  const inner = svg.replace(/^<svg([^>]*)>/, (all, attrs) => '<svg' + attrs.replace(/\s(width|height|x|y)="[^"]*"/g, '') + ` x="${x}" y="${y}" width="${w}" height="${h}">`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cv.W}" height="${cv.H}" viewBox="0 0 ${cv.W} ${cv.H}"><rect width="${cv.W}" height="${cv.H}" fill="${paper}"/>${inner}</svg>`;
}
// The most figures one Figure node draws (variations × Set items). Decided by testing in Phase 4 (ledger O-37).
export const FIGURE_RENDER_CAP = 24;   // ledger O-37 — measured at the Phase 4 UX checkpoint (48 froze the board for ~0.7 s)
// A Figure node's output. With a Set connected and Fan out on: one group per Set item (that item as the content, the
// other contents kept), each with its own variations; otherwise one group. → main figure + variations (+ groups).
export async function figureWithVariations(inputs, p) {
  inputs = { ...inputs, rules: chainOf(inputs.rules) };   // the chain, flat and ordered, for every variation
  const all = (inputs.content || []).filter(Boolean), set = all.find(c => c.kind === 'set');
  const others = set ? all.filter(c => c !== set) : all, items = set ? set.items : [];
  if (set && p.onlyItem) {   // "New Figure from this" on a fan-out variation: that item only (by name, else by place)
    const it = items.find(x => x.name === p.onlyItem.name) || items[p.onlyItem.index];
    if (it) return figureGroup({ ...inputs, content: [it, ...others] }, p);
  }
  if (!set || p.fanOut === false || !set.items.length) return figureGroup(inputs, p);
  const per = Math.max(1, Math.min(+p.variations || 1, Math.floor(FIGURE_RENDER_CAP / items.length)));
  const shown = items.slice(0, FIGURE_RENDER_CAP), keys = shown.map((it, gi) => gi + ':' + it.name);
  const groups = [];
  for (let gi = 0; gi < shown.length; gi++) {
    const it = shown[gi], itemKey = gi + ':' + it.name;   // by position: the same item twice is two groups
    if (gi) await new Promise(r => setTimeout(r, 0));   // let the board breathe between groups
    const g = await figureGroup({ ...inputs, content: [it, ...others] }, { ...p, variations: per }, itemKey, gi === 0, keys);   // checks: the first group's, the one the badge shows
    groups.push({ label: it.name, variations: g.variations.map(v => withSrc({ ...v, key: itemKey + '|' + v.key }, v.src, v.res)), main: g });
  }
  const main = groups[0].main;
  main.groups = groups.map(g => ({ label: g.label, variations: g.variations }));
  main.variations = [].concat(...main.groups.map(g => g.variations));
  main.capped = items.length > shown.length || per < (+p.variations || 1) ? { items: items.length, shownItems: shown.length, per, asked: +p.variations || 1, cap: FIGURE_RENDER_CAP } : null;
  return main;
}
// What a child Figure re-draws its variation from: kept on the variation, out of its JSON (and so lost to a spread — re-attach it).
// `res` = the variation's whole drawing (cells, Compose contexts, inks) — what a child shows, and composes, as is.
const hide = (v, k, x) => { if (x) Object.defineProperty(v, k, { value: x, enumerable: false, configurable: true }); };
const withSrc = (v, src, res) => (hide(v, 'src', src), hide(v, 'res', res), v);
async function figureGroup(inputs, p, item, checks = true, keys = null) {
  const keep = p.keep || {};
  // `fixed`: the variation(s) a "New Figure from this" froze — applied in order, before anything else (with the Keep they were drawn with)
  const base = [].concat(p.fixed || []).reduce((b, spec) => { const v = varyInputs(b.inputs, spec, spec.keep || {}); return { inputs: v.inputs, extra: { ...b.extra, ...v.extra } }; }, { inputs, extra: {} });
  const main = await compileFigure(base.inputs, { ...p, ...base.extra }, { checks });
  // two renders of one figure differ only in their export time and run-time ids (an Element stack's masks): compare without them
  const keyOf = svg => svg.replace(/"exportedAt":"[^"]*"/g, '').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const want = Math.max(1, Math.min(12, +p.variations || 1)), seen = new Set([keyOf(main.svg)]);
  const pins = new Map(pinsFor(p, item, keys).filter(q => q.slot >= 1 && q.slot < want).map(q => [q.slot, q]));
  const queue = variationSpecs(p, want + 12);
  let failed = 0;
  const draw = async spec => { const vr = varyInputs(base.inputs, spec, keep); const r = await compileFigure(vr.inputs, { ...p, ...base.extra, ...vr.extra }); return { r, label: vr.label }; };
  main.variations = [{ key: 'base', svg: main.svg, label: 'As set up', pinned: false, spec: null, slot: 0, item }];
  const src = { inputs: base.inputs, extra: base.extra, params: p };   // what a child Figure re-draws its variation from, with its own inputs
  for (let slot = 1; slot < want; slot++) {
    const pin = pins.get(slot);
    if (pin) {   // a pinned variation keeps its place, whatever the new seed
      const spec = { mode: pin.mode, seed: pin.seed };
      try { const { r, label } = await draw(spec); seen.add(keyOf(r.svg)); main.variations.push(withSrc({ key: 'pin:' + spec.mode + ':' + spec.seed, svg: r.svg, label, pinned: true, spec, slot, item }, null, r)); }
      catch (e) { main.variations.push({ key: 'pin:' + pin.seed, svg: '', label: e.message, pinned: true, spec, slot, item, error: true }); }
      continue;
    }
    while (queue.length) {
      const v = queue.shift();
      try {
        const { r, label } = await draw(v.spec);
        if (!r.shapes || seen.has(keyOf(r.svg))) continue;   // blank, or the same as one already shown: draw another
        seen.add(keyOf(r.svg)); main.variations.push(withSrc({ key: v.key, svg: r.svg, label, pinned: false, spec: v.spec, slot, item }, null, r)); break;
      } catch (e) { failed++; }   // this change does not apply here (or a real error): try the next — counted, shown on the card
    }
  }
  if (main.variations.length < want && failed) main.failedVariations = failed;   // fewer than asked, and some draws threw
  main.variations.forEach(v => withSrc(v, src, v.slot === 0 ? { ...main } : null));   // the base: this group's own drawing
  return main;
}
export async function compileFigure(inputs, params, opts) {
  const cv = inputs.canvas, grid = inputs.grid, pal = inputs.palette, rules = chainOf(inputs.rules);
  const contents = [].concat(...(inputs.content || []).filter(Boolean).map(c => c.kind === 'set' ? c.items : [c])).filter(Boolean);
  if (!contents.length) throw new Error('Connect a Content input');
  if (contents.some(c => c.kind === 'symbol')) throw new Error('A Symbol as content is not available yet — use Elements and Components for now');
  const { cellRules, compRule, repeats, transform: final } = chainPlan(rules);
  const colors = pal && pal.colors && pal.colors.length ? pal.colors.slice() : null;
  const colorRule = pal ? { ...DEFAULT_COLOR_RULE, ...(pal.rule || {}) } : { ...DEFAULT_COLOR_RULE };
  const paper = pal && pal.paper ? pal.paper : '#ffffff';
  const firstEl = contents.find(c => c.kind === 'element' && c.entry && c.entry.seed);
  const imported = contents.length === 1 && firstEl && firstEl.entry.recipe ? firstEl.entry.recipe : null;
  const composeRules = (inputs.composition && inputs.composition.rules ? inputs.composition.rules : [])
    .map(r => r.do && r.do.ink != null ? { ...r, do: { ...r.do, color: (colors || ['#000000'])[r.do.ink % (colors || ['#000000']).length] } } : r)   // an ink by its place in the Palette: follows Palette edits and hue variations
    .map(r => r.do && r.do.arrange && r.do.arrange.live ? { ...r, do: { ...r.do, arrange: { ...r.do.arrange, pool: contents.slice() } } } : r);   // a live Arrange lays out the content feeding the Figure now
  const lattice = isLattice(grid.gen);
  let element, first;
  const compSmall = l => l.type === 'square' && l.cols <= 4 && l.rows <= 4;   // a built-in's Component level: up to 4 × 4
  if (lattice && imported && !(compRule && cellRules.length) && !(compRule && !compSmall(latticeOf(grid))) && !composeRules.length) {   // a built-in's own pieces: compile back to its exact recipe (Cell rules + a Component rule take the general path below)
    element = { ...clone(imported), colors: colors && !params.keepOwn ? colors : clone(imported.colors || ['#000000']), paper };
    if (pal && pal.ground) element.ground = clone(pal.ground);
    if (pal && !params.keepOwn) element.colorRule = colorRule; else delete element.colorRule;
    if (params.keepOwn && imported.colorRule) element.colorRule = clone(imported.colorRule);   // Keep own colours: the built-in's own inks and rule
    if (pal && (pal.rule || {}).mode === DEFAULT_COLOR_RULE.mode && !imported.colorRule) delete element.colorRule;
    if (compRule) {
      const l = latticeOf(grid);
      first = { kind: 'component', grid: `square${l.cols}x${l.rows}`, rule: compRule.rule, params: clone(compRule.params) };
    } else {
      const l = latticeOf(grid);
      first = { kind: 'symbol', lattice: l, fit: params.fit === 'match' ? 'contain' : (params.fit || (l.type === 'triangle' ? 'fill' : 'contain')), rules: clone(cellRules) };
      if (params.symbolFit) first.fit = params.symbolFit;   // the built-in's own fit, kept as it was
      if (params.clip === false) first.clip = false;
    }
  } else {   // every other Figure: a sealed Symbol level — the grid's model + one content patch per cell
    const model = lattice ? latticeModel(latticeOf(grid)) : await symbolGridModel(grid.gen, { ...gridDefaults(grid.gen), ...(grid.params || {}) }, cv.fit ? canvasOf({ preset: 'Square 1:1', margin: 5 }) : cv);
    const n = Organica.loadLoomGrid(clone(model)).cells.length;
    const pickRng = params.contentSeed != null && contents.length > 1 ? mulberry32(params.contentSeed >>> 0) : null;
    let cells = Array.from({ length: n }, (_, i) => contentPatch(contents[pickRng ? Math.floor(pickRng() * contents.length) : i % contents.length], params.fit));
    // A Palette recolours the content (a Component through its colourway — its own colour rule still picks the inks);
    // "Keep own colours" leaves every content in the colours it was saved with.
    if (pal && colors && !params.keepOwn) cells.forEach(c => { if (c.source === 'component') c.colourway = { colors: colors.slice(), paper }; });
    if (compRule) {   // a Component rule poses every cell of a Square lattice, by its place (any size; Radial: even × even)
      const l = lattice ? latticeOf(grid) : null;
      if (!l || l.type !== 'square') throw new Error('A Component rule needs a Square lattice Grid — this Figure’s Grid is ' + (l ? 'a ' + l.type.charAt(0).toUpperCase() + l.type.slice(1) + ' lattice' : 'a Loom grid'));
      const posed = componentCellsFromRule(compRule.rule, compRule.params, squareCR(l.cols, l.rows || l.cols));
      cells = cells.map((c, i) => { const q = posed[i] || {}; return { ...c, rotation: q.rotation || 0, flipH: !!q.flipH, flipV: !!q.flipV }; });
    }
    const componentEntries = {};
    contents.forEach(c => { if (c.kind === 'component' && c.entry) componentEntries[c.name] = c.entry; });
    composeRules.forEach(r => { const c = r.do && r.do.content; if (c && typeof c === 'object' && c.kind === 'component' && c.entry) componentEntries[c.name] = c.entry; });
    composeRules.forEach(r => { const p = r.do && r.do.paste; if (p && p.components) Object.entries(p.components).forEach(([n, e]) => { if (e && !componentEntries[n]) componentEntries[n] = e; }); });   // a pasted Symbol's Components travel with it
    element = { type: firstEl && SEED_TYPES[firstEl.entry.seed.type] ? firstEl.entry.seed.type : 'triangle', style: 'fill', colors: colors || ['#000000'], paper };
    if (pal && pal.ground) element.ground = clone(pal.ground);
    first = { kind: 'symbol', lattice: { type: 'loomModel', model }, cells, componentEntries, colors: colors || ['#000000'], colorRule: params.keepOwn ? { ...DEFAULT_COLOR_RULE } : colorRule, paperColor: paper, clip: params.clip !== false };
    if (cellRules.length || composeRules.length) first.rules = clone(cellRules.concat(composeRules));
    if (composeRules.length && pal && colors && !params.keepOwn) first.paletteColourway = { colors: colors.slice(), paper };
  }
  const recipe = { tool: 'fvs-recipe', version: 2, element, levels: [first, ...repeats] };
  if (final) recipe.transform = clone(final);
  const r = evalFigure(recipe, opts);
  const fitted = !cv.fit && (lattice || repeats.length);
  // a placement on a cell this grid no longer has: kept in the Composition, not drawn — reported
  const lost = composeLost(composeRules, r.compose ? r.compose.ctxs : null, r.cells);
  return { svg: fitted ? fitOnPage(r.svg, cv, paper) : r.svg, recipe, cells: r.cells, shapes: r.shapes, canvas: cv,
    base: r.levels.symbol || '', compose: r.compose, lost, checks: r.checks,
    colors: (first.colors || element.colors || []).slice(), paper };
}

// ── Variations (Phase 4): a variation changes the Figure's own INPUTS — what Keep allows — then compiles as usual.
// spec = { mode: 'seed' | 'one' | 'several', seed }. 'seed' re-draws only what is random (a Grid's seed, how several
// contents spread over the cells); 'one' makes one change, 'several' two or three. Deterministic per spec.
export const MIRRORS = { none: 'None', v: 'Over the right edge', h: 'Over the bottom edge', vh: 'Over both edges' };   // the mirror options, as the UI says them
export const KEEP_KEYS = ['content', 'palette', 'cells', 'grid', 'transform'];   // UI-COPY §2: Content · Palette · Cell rules · Grid · Rotate & mirror
const pick = (a, rng) => a[Math.floor(rng() * a.length)];
function changeGrid(inp, rng) {
  const g = inp.grid, spec = gridSpec(g.gen), p = { ...gridDefaults(g.gen), ...(g.params || {}) };
  const keys = spec.params.filter(x => x[2] !== 'text'); if (!keys.length) return null;
  const [k, label, a, b, step] = pick(keys, rng);
  const cur = +p[k], span = Math.max(1, Math.round((b - a) / step / 4)) * step;
  let v = cur; for (let t = 0; t < 6 && v === cur; t++) v = Math.min(b, Math.max(a, Math.round((cur + (rng() < 0.5 ? -1 : 1) * step * (1 + Math.floor(rng() * Math.max(1, span / step)))) / step) * step));
  if (v === cur) return null;
  inp.grid = { gen: g.gen, params: { ...p, [k]: v } }; return `${label} ${v}`;
}
function changePalette(inp, rng) {
  const pal = inp.palette; if (!pal || !pal.colors || !pal.colors.length) return null;
  const C = Organica.color;
  if (pal.colors.length > 1 && rng() < 0.35) { const c = pal.colors.slice(); c.push(c.shift()); inp.palette = { ...pal, colors: c }; return 'Inks in another order'; }
  const turn = pick(FG_HUE_TURNS, rng);
  const turned = pal.colors.map(h => { const o = C.hexToOklch(h); return o.c < 0.03 ? h : C.oklchToHex(o.l, o.c, (o.h + turn + 360) % 360); });
  const solved = cwSolve(turned, pal.paper && pal.paper !== 'none' ? pal.paper : '#ffffff') || turned;
  inp.palette = { ...pal, colors: solved }; return `Hue ${turn > 0 ? '+' : ''}${turn}°`;
}
const RULE_POOL = [
  { when: { parity: 'odd' }, do: { rotate: 90 } }, { when: { parity: 'odd' }, do: { rotate: 180 } }, { when: { parity: 'even' }, do: { content: 'empty' } },
  { when: { parity: 'odd' }, do: { flipH: true } }, { when: { class: 'down' }, do: { content: 'empty' } }, { when: { class: 'up' }, do: { rotate: 180 } },
  { when: { row: [0] }, do: { content: 'empty' } }, { when: {}, do: { rotate: 'sector' } },
];
function changeCells(inp, rng) {
  const rules = (inp.rules || []).slice(), at = rules.findIndex(r => r.kind === 'cells');
  const cur = at >= 0 ? clone(rules[at].rules) : [];
  let label;
  if (cur.length && rng() < 0.4) { const i = Math.floor(rng() * cur.length); cur[i].off = !cur[i].off; label = (cur[i].off ? 'Off: ' : 'On: ') + describeRule(cur[i]); }
  else { const r = clone(pick(RULE_POOL, rng)); cur.push(r); label = describeRule(r); }
  if (at >= 0) rules[at] = { kind: 'cells', rules: cur }; else rules.unshift({ kind: 'cells', rules: cur });
  inp.rules = rules; return label.charAt(0).toUpperCase() + label.slice(1);
}
function changeTransform(inp, rng) {
  const rules = (inp.rules || []).slice(); if (!rules.some(r => r.kind === 'repeat')) return null;
  const at = rules.map(r => r.kind).lastIndexOf('transform'), t = at >= 0 ? { ...rules[at].transform } : { rotate: 0, mirror: 'none' };
  if (rng() < 0.5) t.rotate = (t.rotate + 90) % 360; else t.mirror = pick(['none', 'v', 'h', 'vh'].filter(m => m !== t.mirror), rng);
  if (at >= 0) rules[at] = { kind: 'transform', transform: t }; else rules.push({ kind: 'transform', transform: t });
  inp.rules = rules; return t.mirror !== 'none' ? `Mirror ${MIRRORS[t.mirror].toLowerCase()}` : `Rotation ${t.rotate}°`;
}
const CHANGES = { grid: changeGrid, palette: changePalette, content: null, cells: changeCells, transform: changeTransform };
const contentCount = inp => (inp.content || []).filter(Boolean).reduce((n, c) => n + (c.kind === 'set' ? c.items.length : 1), 0);   // a Set counts its items
export function varyInputs(inputs, spec, keep) {
  keep = keep || {};
  const inp = { ...inputs, rules: chainOf(inputs.rules) }, rng = mulberry32((spec.seed * 2654435761) >>> 0), labels = [], extra = {};
  const reseed = () => {   // what is random: a Grid's own seed, how several contents spread over the cells
    let did = false;
    if (!keep.grid && gridSpec(inp.grid.gen).params.some(x => x[0] === 'seed')) { inp.grid = { gen: inp.grid.gen, params: { ...gridDefaults(inp.grid.gen), ...(inp.grid.params || {}), seed: Math.floor(rng() * 1000) } }; labels.push('Grid: new seed'); did = true; }
    if (!keep.content && contentCount(inp) > 1) { extra.contentSeed = Math.floor(rng() * 1e9); labels.push('Content spread'); did = true; }
    return did;
  };
  const kinds = KEEP_KEYS.filter(k => !keep[k] && (k !== 'content' || contentCount(inp) > 1));
  if (spec.mode === 'seed' && reseed()) return { inputs: inp, extra, label: labels.join(' · ') };
  const want = spec.mode === 'several' ? 2 + Math.floor(rng() * 2) : 1;
  for (let tries = 0; tries < 12 && labels.length < want && kinds.length; tries++) {
    const k = pick(kinds, rng);
    if (k === 'content') { extra.contentSeed = Math.floor(rng() * 1e9); labels.push('Content spread'); kinds.splice(kinds.indexOf(k), 1); continue; }
    const l = CHANGES[k](inp, rng); if (l) { labels.push(l); kinds.splice(kinds.indexOf(k), 1); }
  }
  return { inputs: inp, extra, label: labels.join(' · ') || 'No change' };
}
// The candidate specs a Figure draws from its seed (the base, the Figure as set up, is not one of them).
export function variationSpecs(p, count) {
  const mode = p.varyBy || 'one', base = (+p.seed || 1) >>> 0, out = [];
  for (let i = 1; out.length < count && i < 400; i++) out.push({ key: mode + ':' + ((base * 7919 + i * 104729) >>> 0), spec: { mode, seed: (base * 7919 + i * 104729) >>> 0 }, pinned: false });
  return out;
}
// The pins that apply to a group: { mode, seed, slot, item? } — a pin stays in its slot; in a fan-out it belongs to its item.
export const itemName = k => k == null ? null : String(k).slice(String(k).indexOf(':') + 1);
// a pin's item: the exact key (place:name); if that key is gone (the Set was reordered), the item with its name
export const sameItem = (a, b, keys) => (a == null && b == null) || (a != null && b != null && (a === b || (!!keys && !keys.includes(a) && itemName(a) === itemName(b))));
export const pinsFor = (p, item, keys) => (p.pins || []).filter(q => sameItem(q.item, item, keys));

// ── Export (Phase 6): one export path — the Export node. exportPlan() lists the files (pure); the UI encodes them.
// Which: all variations · pinned only · as set up. Formats: SVG, PNG (×1 ×2 ×4 on a Screen Canvas; a Print Canvas is
// one file at its own size + DPI, with bleed and crop marks), Plates (one file per ink, black on transparent, with
// registration marks in Print). A figure's own Canvas decides Screen / Print.
// Composition rules that name cells this grid does not have: [{rule, cells: [index | [row, col]], none}] — `rule` is the
// rule's place in the Composition; `none` = it matches no cell at all (a row or column past the grid's edge).
export function composeLost(rules, ctxs, n) {
  const out = [];
  (rules || []).forEach((r, rule) => {
    const w = r.when; if (r.off || !w) return;
    const cells = w.index != null ? [].concat(w.index).filter(i => i >= n)
      : w.at ? w.at.filter(a => !(ctxs || []).some(c => c.row === a[0] && c.col === a[1])) : [];
    const none = !!ctxs && !ctxs.some(c => ruleMatches(w, c));
    if (cells.length || none) out.push({ rule, cells, none });
  });
  return out;
}
// The distinct solid inks of a drawing (fill / stroke hexes), paper left out — what a plate separates.
export function inksOf(svg, paper) {
  const norm = h => { h = h.toLowerCase(); return h.length === 4 ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h.slice(0, 7); };
  const out = [], pk = paper ? norm(paper) : null;
  String(svg || '').replace(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (m, c) => { const k = norm(c); if (k !== pk && !out.includes(k)) out.push(k); return m; });
  return out;
}
export function exportPlan(figs, p) {
  const which = p.which || 'all', fm = p.formats || { svg: true }, scales = (p.scales && p.scales.length ? p.scales : [1]).slice().sort((a, b) => a - b);
  const files = [];
  (figs || []).filter(Boolean).forEach(({ name, figure: f }) => {
    if (!f) return;
    const vars = (f.variations && f.variations.length ? f.variations : [{ svg: f.svg, slot: 0, label: 'As set up' }]).filter(v => !v.error && v.svg);
    const chosen = which === 'base' ? vars.filter(v => v.slot === 0) : which === 'pinned' ? vars.filter(v => v.pinned) : vars;
    const print = f.canvas && f.canvas.mode === 'print', sc = print ? [1] : scales, many = chosen.length > 1;
    chosen.forEach((v, k) => {
      const tag = (name || 'figure').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + (many ? '-v' + (vars.indexOf(v) + 1) : '') + (v.item ? '-' + String(v.item).split(':').slice(1).join(':').toLowerCase().replace(/[^a-z0-9]+/g, '-') : '');
      const inks = inksOf(v.svg, f.paper);   // the inks this drawing uses — not the Palette's (Keep own colours, a Set item, no Palette)
      const base = { figure: name, svg: v.svg, canvas: f.canvas, paper: p.transparent ? 'none' : f.paper, figPaper: f.paper, colors: inks, print, tag };
      if (fm.svg) files.push({ ...base, format: 'svg', scale: 1, plate: null });
      if (fm.png) sc.forEach(s => files.push({ ...base, format: 'png', scale: s, plate: null }));
      if (fm.plates) inks.forEach((c, i) => files.push({ ...base, format: fm.png && !fm.svg ? 'png' : 'svg', scale: 1, plate: i, ink: c, paper: 'none' }));
    });
  });
  return files;
}
export function exportSummary(files, p) {
  const fm = p.formats || {}, kinds = [fm.svg && 'SVG', fm.png && 'PNG', fm.plates && 'plates'].filter(Boolean);
  const print = files.find(x => x.print);
  return `${files.length} ${files.length === 1 ? 'file' : 'files'}${kinds.length ? ' · ' + kinds.join(' + ') : ''}${print ? ` · ${print.canvas.dpi} DPI` : ''}`;
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
  const chain = nodes.filter(n => ['cell-rules', 'component-rule', 'repeat', 'transform'].includes(n.type));   // one chain, in the recipe's order
  chain.forEach((n, k) => edges.push([n.ref, 'rules', k + 1 < chain.length ? chain[k + 1].ref : 'figure', 'rules']));
  return { nodes, edges };
}

// ── A child Figure (type 'figure-var'): one variation of its parent Figure, as a node of its own (Diego, Oct 8, 2026).
// It is placed by the UI (params.parent / slot / item) and draws the parent's variation at that slot. Its own inputs
// override the parent's for this child only — Canvas · Grid · Palette · Composition replace, Content replaces, Rules
// are added after the parent's — and the variation's change is then made again on top. No own input: the parent's
// drawing, as is.
const OVERRIDES = ['canvas', 'grid', 'palette', 'composition'];
export const hasOverrides = i => OVERRIDES.some(k => i[k]) || (i.content || []).some(Boolean) || chainOf(i.rules).length > 0;
export const childKey = (slot, item) => slot + '|' + (item == null ? '' : item);
export async function figureVariation(i, p) {
  const par = i.from; if (!par) throw new Error('Connect it to its Figure');
  const vars = par.variations || [];
  const v = vars.find(x => childKey(x.slot, x.item) === childKey(p.slot, p.item))
    || (p.item != null ? vars.find(x => x.slot === p.slot && x.item != null && itemName(x.item) === itemName(p.item)) : null);   // the Set was reordered: the item by its name
  if (!v) throw new Error('Not drawn now — raise Variations on its Figure');
  if (v.error) throw new Error(v.label);
  const one = (f, label = v.label) => ({ ...f, variations: [{ key: 'base', svg: f.svg, label, pinned: !!v.pinned, spec: v.spec, slot: v.slot, item: v.item }], groups: undefined, capped: undefined, failedVariations: undefined });
  if (!hasOverrides(i) || !v.src) return { figure: one({ ...par, ...(v.res || {}), svg: v.svg, canvas: (v.res || par).canvas || par.canvas, checks: null }) };
  const s = v.src, own = (i.content || []).filter(Boolean);
  const inp = { ...s.inputs, rules: chainOf(s.inputs.rules).concat(chainOf(i.rules)) };   // its own chain goes after the Figure's
  OVERRIDES.forEach(k => { if (i[k]) inp[k] = i[k]; });
  if (own.length) inp.content = own;
  let r;
  // What you connect by hand wins over the generated change (Diego, Oct 8, 2026 — as in CSS, declared beats generated):
  // an own input is kept as if Keep were on for it; the variation changes only what you left alone.
  const keep = { ...(s.params.keep || {}) };
  if (i.palette) keep.palette = true;
  if (i.grid) keep.grid = true;
  if (own.length) keep.content = true;
  if (chainOf(i.rules).length) { keep.cells = true; keep.transform = true; }
  if (v.spec) { const vr = varyInputs(inp, v.spec, keep); r = await compileFigure(vr.inputs, { ...s.params, ...s.extra, ...vr.extra }, { checks: false }); return { figure: one(r, vr.label) }; }
  r = await compileFigure(inp, { ...s.params, ...s.extra }, { checks: false });
  return { figure: one(r) };
}

// ── The registry entries (meta + compute). Labels: UI-COPY §2. ──
const RULE_OUT = [{ name: 'rules', type: 'rule', label: 'Rules' }];
const RULE_IN = [{ name: 'rules', type: 'rule', label: 'Rules', chain: true }];   // the chain so far (a new rule wired in slots in)
const chained = (type, i, p) => ({ rules: [...chainOf(i.rules), ruleOf(type, p)] });
export function figureNodeTypes() {
  return [
    { meta: { id: 'canvas', label: 'Canvas', category: 'Foundation', pill: true, icon: 'node-canvas', inputs: [], outputs: [{ name: 'canvas', type: 'canvas', label: 'Canvas' }],
        params: [{ name: 'preset', default: 'Square 1:1' }, { name: 'mode', default: 'screen' }, { name: 'unit', default: 'mm' }, { name: 'pw', default: 1080 }, { name: 'ph', default: 1080 },
          { name: 'dpi', default: 300 }, { name: 'bleed', default: 3 }, { name: 'margin', default: 5 }] },
      compute: (i, p) => ({ canvas: canvasOf(p) }) },
    { meta: { id: 'grid', label: 'Grid', category: 'Foundation', pill: true, icon: 'fvs-grid', inputs: [], outputs: [{ name: 'grid', type: 'grid', label: 'Grid' }],
        params: [{ name: 'gen', default: 'rectangular' }, { name: 'params', default: gridDefaults('rectangular') }] },
      compute: (i, p) => { const gen = SYMGRID_GENS[p.gen] || FIGURE_LATTICES[p.gen] ? p.gen : 'rectangular'; return { grid: { gen, params: { ...gridDefaults(gen), ...(p.params || {}) } } }; } },
    { meta: { id: 'palette', label: 'Palette', category: 'Foundation', pill: true, icon: 'palette', inputs: [], outputs: [{ name: 'palette', type: 'palette', label: 'Palette' }],
        params: [{ name: 'colors', default: ['#1a1a1a', '#e85d3a', '#2f6fb0'] }, { name: 'paper', default: '#ffffff' }, { name: 'rule', default: { mode: 'index', offset: 0 } },
          { name: 'transparent', default: false }, { name: 'pattern', default: null }] },   // O-45: Paper = colour + texture, or none
      compute: (i, p) => { const pal = { colors: (p.colors || []).slice(), paper: p.transparent ? 'none' : (p.paper || '#ffffff'), rule: COLOR_RULES[(p.rule || {}).mode] ? p.rule : { mode: 'index', offset: 0 } };
        if (p.pattern) pal.ground = clone(p.pattern); return { palette: pal }; } },
    { meta: { id: 'element', label: 'Element', category: 'Content', pill: true, icon: 'node-element', inputs: [], outputs: [{ name: 'content', type: 'content', label: 'Content' }],
        params: [{ name: 'name', default: '' }, { name: 'snapshot', default: null }] },
      compute: (i, p) => { if (!p.snapshot) throw new Error('Pick a saved Element'); return { content: { kind: 'element', name: p.name, entry: p.snapshot } }; } },
    { meta: { id: 'component', label: 'Component', category: 'Content', pill: true, icon: 'node-component', inputs: [], outputs: [{ name: 'content', type: 'content', label: 'Content' }],
        params: [{ name: 'name', default: '' }, { name: 'snapshot', default: null }] },
      compute: (i, p) => { if (!p.snapshot) throw new Error('Pick a saved Component'); return { content: { kind: 'component', name: p.name, entry: p.snapshot } }; } },
    { meta: { id: 'set', label: 'Set', category: 'Content', pill: true, icon: 'node-set', inputs: [], outputs: [{ name: 'content', type: 'content', label: 'Content', list: true }],
        params: [{ name: 'items', default: [] }] },
      compute: (i, p) => { const items = (p.items || []).filter(x => x && x.snapshot).map(x => ({ kind: x.kind, name: x.name, entry: x.snapshot }));
        if (!items.length) throw new Error('Add saved Elements or Components to the Set'); return { content: { kind: 'set', name: p.name || 'Set', items } }; } },
    { meta: { id: 'cell-rules', label: 'Cell rules', category: 'Rules', pill: true, icon: 'node-cell-rules', inputs: RULE_IN, outputs: RULE_OUT, params: [{ name: 'rules', default: [] }] },
      compute: (i, p) => chained('cell-rules', i, p) },
    { meta: { id: 'component-rule', label: 'Component rule', category: 'Rules', pill: true, icon: 'node-component-rule', inputs: RULE_IN, outputs: RULE_OUT, params: [{ name: 'rule', default: 'radial' }, { name: 'params', default: {} }] },
      compute: (i, p) => chained('component-rule', i, p) },
    { meta: { id: 'repeat', label: 'Repeat in grid', category: 'Rules', pill: true, icon: 'node-repeat', inputs: RULE_IN, outputs: RULE_OUT,
        params: [{ name: 'lattice', default: 'square' }, { name: 'count', default: 2 }, { name: 'cellSize', default: null }, { name: 'altFlip', default: false }, { name: 'rotate', default: 0 }, { name: 'mirror', default: 'none' }] },
      compute: (i, p) => chained('repeat', i, p) },
    { meta: { id: 'composition', label: 'Composition', category: 'Rules', pill: true, icon: 'node-composition', inputs: [], outputs: [{ name: 'composition', type: 'composition', label: 'Composition' }], params: [{ name: 'rules', default: [] }] },
      compute: (i, p) => ({ composition: { rules: clone(p.rules || []) } }) },
    { meta: { id: 'transform', label: 'Rotate & mirror', category: 'Rules', pill: true, icon: 'node-transform', inputs: RULE_IN, outputs: RULE_OUT, params: [{ name: 'rotate', default: 0 }, { name: 'mirror', default: 'none' }] },
      compute: (i, p) => chained('transform', i, p) },
    { meta: { id: 'export', label: 'Export', category: 'Output', pill: true, icon: 'download', inputs: [{ name: 'figures', type: 'figure', label: 'Figures', multi: true, required: true }], outputs: [],
        params: [{ name: 'which', default: 'all' }, { name: 'formats', default: { svg: true, png: false, plates: false } }, { name: 'scales', default: [1] }, { name: 'transparent', default: false }] },
      compute: (i, p, ctx) => ({ files: null }) },   // the UI fills the plan from the Figures' own results (they carry no names here)
    { meta: { id: 'figure', label: 'Figure', category: 'Content', icon: 'fvs-figure',   // with Content in the bar; a capped card (Diego, Oct 9, 2026)
        inputs: [{ name: 'canvas', type: 'canvas', label: 'Canvas', required: true }, { name: 'grid', type: 'grid', label: 'Grid', required: true },
          { name: 'palette', type: 'palette', label: 'Palette' }, { name: 'content', type: 'content', label: 'Content', required: true, multi: true },
          { name: 'rules', type: 'rule', label: 'Rules', chain: true }, { name: 'composition', type: 'composition', label: 'Composition' }],
        outputs: [{ name: 'figure', type: 'figure', label: 'Figure' }],
        params: [{ name: 'fit', default: 'contain' }, { name: 'clip', default: true }, { name: 'keepOwn', default: false }, { name: 'symbolFit', default: null },
          { name: 'variations', default: 4 }, { name: 'varyBy', default: 'one' }, { name: 'seed', default: 1 }, { name: 'keep', default: {} }, { name: 'layout', default: 'rows' },
          { name: 'pins', default: [] }, { name: 'fixed', default: null }, { name: 'fanOut', default: true }] },
      compute: async (i, p) => ({ figure: await figureWithVariations(i, p) }) },
    { meta: { id: 'figure-var', label: 'Variation', category: 'Output', hidden: true, icon: 'fvs-figure',   // made by its Figure, never from the node bar
        inputs: [{ name: 'from', type: 'figure', label: 'Figure', required: true },
          { name: 'canvas', type: 'canvas', label: 'Canvas' }, { name: 'grid', type: 'grid', label: 'Grid' },
          { name: 'palette', type: 'palette', label: 'Palette' }, { name: 'content', type: 'content', label: 'Content', multi: true },
          { name: 'rules', type: 'rule', label: 'Rules', chain: true }, { name: 'composition', type: 'composition', label: 'Composition' }],
        outputs: [{ name: 'figure', type: 'figure', label: 'Figure' }],
        params: [{ name: 'parent', default: null }, { name: 'slot', default: 1 }, { name: 'item', default: null }] },
      compute: async (i, p) => figureVariation(i, p) },
  ];
}
