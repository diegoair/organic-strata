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
  buildColourways, cwSolve
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
// "Which cells" → a rule's `when` (the Cell rules vocabulary; a row / column / cell number counts from 1, a ring / sector from 0)
export function whenOf(which, n) {
  return which === 'all' ? {} : which === 'up' || which === 'down' ? { class: which } : which === 'odd' || which === 'even' ? { parity: which } : { [which]: Math.max(0, n - (which === 'ring' || which === 'sector' ? 0 : 1)) };
}
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
  if (type === 'transform') {   // + what only applies on the cells (no Repeat before it): which cells, Rotation per cell, Random rotation
    const r = { kind: 'transform', transform: { rotate: +p.rotate || 0, mirror: p.mirror || 'none' } }, c = {};
    if (p.which && p.which !== 'all') c.when = whenOf(p.which, +p.n || 0);
    if (+p.perCell) c.turnStep = { deg: +p.perCell, by: p.countBy === 'row' || p.countBy === 'col' ? p.countBy : 'index' };
    const amt = p.randomAmount != null ? +p.randomAmount : p.random ? 180 : 0;   // Random rotation (0–180°); `random: true` = saved before the slider
    if (amt > 0) c.turnRandom = { seed: (+p.seed || 0) >>> 0, amount: amt };
    if (Object.keys(c).length) r.cells = c;
    return r;
  }
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
// levels in order, and each Rotate & mirror on the Repeat just before it in the chain — with no Repeat before it, a
// rule on every cell that turns / mirrors each Element in its place (do.turnBy / do.mirror, added to what the cell has).
export function chainPlan(chain) {
  const lastComp = chain.map(r => r.kind).lastIndexOf('component');
  const cellRules = [], levels = [], tfs = [];
  chain.forEach((r, i) => {
    if (r.kind === 'cells') (r.rules || []).forEach(c => {
      if (i < lastComp && c.do) {   // before the pose: its turn / flip is overwritten, the rest (empty, filled, scale) stays
        const d = { ...c.do }; delete d.rotate; delete d.flipH; delete d.flipV; delete d.turnBy; delete d.mirror;
        if (Object.keys(d).length) cellRules.push({ ...clone(c), do: d });
      } else cellRules.push(clone(c));
    });
    else if (r.kind === 'repeat') { levels.push(clone(r.level)); tfs.push([]); }
    else if (r.kind === 'transform') {
      // no Repeat before it: it turns / mirrors every Element in its own cell — the grid and the cells' places kept
      // (Diego, Oct 9, 2026: "it should only rotate or mirror the 36 elements in the grid"; wired alone it used to
      // stop the Figure with "needs a Repeat in grid")
      if (!levels.length) {
        const t = r.transform, c = r.cells || {}, d = {}; if (+t.rotate) d.turnBy = +t.rotate; if (t.mirror && t.mirror !== 'none') d.mirror = t.mirror;
        if (c.turnStep) d.turnStep = clone(c.turnStep); if (c.turnRandom != null) d.turnRandom = c.turnRandom;
        if (Object.keys(d).length) cellRules.push({ when: clone(c.when || {}), do: d });
        return;
      }
      // after a Repeat in grid: quarter turns only (Diego, Oct 9, 2026 — say so rather than round it)
      if ((+r.transform.rotate || 0) % 90) throw new Error('Rotate & mirror after a Repeat in grid takes quarter turns only — set its Rotation to 0°, 90°, 180° or 270°');
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

// A Component rule on a grid without columns and rows: each cell gets a place from where its centre lies. Radial: its
// quarter around the grid's centre (a 2 × 2 of quarters — the rosette follows the space, whatever the cells). The
// others: a regular lattice laid over the grid, one square per average cell (Rectangular → its own columns and rows).
export function spatialCR(cells, rule) {
  const c = cells.map(k => { if (k.points && k.points.length) { const n = k.points.length; return { x: k.points.reduce((a, p) => a + p[0], 0) / n, y: k.points.reduce((a, p) => a + p[1], 0) / n }; } return { x: k.x + k.width / 2, y: k.y + k.height / 2 }; });
  const box = cells.map(k => k.points && k.points.length ? k.points : [[k.x, k.y], [k.x + k.width, k.y + k.height]]).flat();
  const x0 = Math.min(...box.map(p => p[0])), x1 = Math.max(...box.map(p => p[0])), y0 = Math.min(...box.map(p => p[1])), y1 = Math.max(...box.map(p => p[1]));
  const W = Math.max(1e-6, x1 - x0), H = Math.max(1e-6, y1 - y0);
  if (rule === 'radial') return c.map(p => ({ col: p.x >= x0 + W / 2 ? 1 : 0, row: p.y >= y0 + H / 2 ? 1 : 0 }));
  const s = Math.sqrt(W * H / Math.max(1, cells.length)), cols = Math.max(1, Math.round(W / s)), rows = Math.max(1, Math.round(H / s));
  return c.map(p => ({ col: Math.min(cols - 1, Math.max(0, Math.floor((p.x - x0) / W * cols))), row: Math.min(rows - 1, Math.max(0, Math.floor((p.y - y0) / H * rows))) }));
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
  const st = settingsOf(p);   // Vary + Amount (or an older Keep)
  // `fixed`: the variation(s) a "New Figure from this" froze — applied in order, before anything else (with the settings they were drawn with)
  const base = [].concat(p.fixed || []).reduce((b, spec) => { const v = varyInputs(b.inputs, spec, spec.st || spec.keep || {}); return { inputs: v.inputs, extra: { ...b.extra, ...v.extra } }; }, { inputs, extra: {} });
  const main = await compileFigure(base.inputs, { ...p, ...base.extra }, { checks });
  // two renders of one figure differ only in their export time and run-time ids (an Element stack's masks): compare without them
  const keyOf = svg => svg.replace(/"exportedAt":"[^"]*"/g, '').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const structured = p.mode === 'series' || p.mode === 'table';   // Series / Table (Phase E): exactly the steps, a step equal to another drawing still shown
  const series = structured ? seriesSpecs(p, sweepableOf(base.inputs)) : null;
  const want = structured ? Math.min(17, series.length + 1) : Math.max(1, Math.min(13, +p.variations || 1)), seen = new Set([keyOf(main.svg)]);   // drawings: the Figure + up to 12 variations (a table up to 16)
  main.sweepable = sweepableOf(base.inputs);   // what a Series / Table can sweep here — the panel lists it
  const pins = new Map(pinsFor(p, item, keys).filter(q => q.slot >= 1 && q.slot < want).map(q => [q.slot, q]));
  const queue = variationSpecs(p, want + 40);   // a variation only adjusts what is there (Oct 9, 2026): a Figure with few dials repeats itself more often — more tries
  let failed = 0;
  const draw = async spec => { const vr = varyInputs(base.inputs, item != null ? { ...spec, fanOut: true } : spec, st); const r = await compileFigure(vr.inputs, { ...p, ...base.extra, ...vr.extra }); return { r, label: vr.label, changes: vr.changes }; };
  main.variations = [{ key: 'base', svg: main.svg, label: 'As set up', pinned: false, spec: null, slot: 0, item }];
  const src = { inputs: base.inputs, extra: base.extra, params: p, raw: inputs };   // what a child Figure re-draws its variation from, with its own inputs; raw = before `fixed` (a Variations node draws again from it)
  for (let slot = 1; slot < want; slot++) {
    const pin = pins.get(slot);
    if (pin) {   // a pinned variation keeps its place, whatever the new seed
      const spec = { mode: pin.mode, ...(pin.changes ? { changes: pin.changes } : {}), ...(pin.set ? { set: { ...pin.set } } : {}), seed: pin.seed, ...(pin.edits && Object.keys(pin.edits).length ? { edits: { ...pin.edits } } : {}) };   // edits: values set by hand on the variation's panel (Phase D); set: a series step
      try { const { r, label, changes } = await draw(spec); seen.add(keyOf(r.svg)); main.variations.push(withSrc({ key: 'pin:' + spec.mode + (spec.changes || '') + ':' + spec.seed, svg: r.svg, label, changes, pinned: true, spec, slot, item }, null, r)); }
      catch (e) { main.variations.push({ key: 'pin:' + pin.seed, svg: '', label: e.message, pinned: true, spec, slot, item, error: true }); }
      continue;
    }
    if (structured) {   // a Series / Table: slot k is step k — a pin replaces its own step (no shift), a failed step is shown as such (no retry)
      const v = series[slot - 1]; if (!v) break;
      try { const { r, label, changes } = await draw(v.spec); main.variations.push(withSrc({ key: v.key, svg: r.svg, label, changes, pinned: false, spec: v.spec, slot, item }, null, r)); }
      catch (e) { failed++; main.variations.push({ key: v.key, svg: '', label: e.message, pinned: false, spec: v.spec, slot, item, error: true }); }
      continue;
    }
    while (queue.length) {
      const v = queue.shift();
      try {
        const { r, label, changes } = await draw(v.spec);
        if (!r.shapes || seen.has(keyOf(r.svg))) continue;   // blank, or the same as one already shown: draw another
        seen.add(keyOf(r.svg)); main.variations.push(withSrc({ key: v.key, svg: r.svg, label, changes, pinned: false, spec: v.spec, slot, item }, null, r)); break;
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
    if (compRule) {   // a Component rule poses every cell by its place — on a Square lattice its column and row; on any other
      // grid (Diego, Oct 9, 2026: "the most creative and surprising way") the place each cell's centre has in the space
      const l = lattice ? latticeOf(grid) : null;
      const cr = l && l.type === 'square' ? squareCR(l.cols, l.rows || l.cols) : spatialCR(Organica.loadLoomGrid(clone(model)).cells, compRule.rule);
      const posed = componentCellsFromRule(compRule.rule, compRule.params, cr);
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

// ── Variations (Phase 4): a variation changes the Figure's own INPUTS — what Vary allows — then compiles as usual.
// spec = { mode: 'seed' | 'one' | 'several' | 'changes', changes?, seed }. 'seed' re-draws only what is random (a Grid's
// seed, how several contents spread over the cells, a rule's Random rotation); 'one' makes one change, 'several' two or
// three (older pins), 'changes' exactly `changes` (1–3). Deterministic per spec — and per settings: at the default
// settings every spec draws as it did before Vary / Amount existed (same rng calls, same formulas), so a saved pin
// comes back identical.
export const MIRRORS = { none: 'None', v: 'Over the right edge', h: 'Over the bottom edge', vh: 'Over both edges' };   // the mirror options, as the UI says them
export const KEEP_KEYS = ['content', 'palette', 'cells', 'grid', 'transform'];   // UI-COPY §2: Content · Palette · Cell rules · Grid · Rotate & mirror
// What a variation may change, per category (the Vary section, Oct 9, 2026): `vary[k]` = true (any of its parameters)
// · false (never) · an array of its parameter keys (only those). The keys per category, in the panel's words:
export const VARY_KEYS = {
  grid: null,   // the Grid generator's own numeric parameters (gridSpec), by their key — listed per generator
  palette: [['hue', 'Hue'], ['order', 'Ink order'], ['light', 'Lightness'], ['chroma', 'Chroma'], ['paper', 'Paper'], ['lib', 'Another palette'], ['colourway', 'Colourway']],   // light … colourway: opt-in (second level, phase G; words: design-system CONSULT, O-62)
  content: [['spread', 'Spread'], ['rotation', 'Rotation'], ['flipH', 'Flip horizontal'], ['flipV', 'Flip vertical'], ['style', 'Style'], ['strokeW', 'Stroke width'], ['scale', 'Scale'], ['item', 'Item']],   // rotation … item: opt-in (phase H)
  cells: [['off', 'On / off'], ['angle', 'Angle'], ['parity', 'Odd / even']],
  transform: [['turn', 'Rotation'], ['flip', 'Flip'], ['per', 'Rotation per cell'], ['draw', 'Random draw'], ['mirror', 'Mirror']],   // mirror: after a Repeat in grid
};
export function gridVaryKeys(gen) { return gridSpec(gen).params.filter(x => x[2] !== 'text').map(x => [x[0], x[1]]); }
const normVary = v => v == null || v === true ? true : Array.isArray(v) ? (v.length ? v.slice() : false) : !!v;
// The settings a variation is drawn with: from a Variations node's params (`vary`, `amount`), or from an older `keep`
// object (what must NOT change — inverted), the shape pins and `fixed` specs saved before Oct 9, 2026 carry.
export function settingsOf(x) {
  x = x || {};
  const keep = x.vary == null && x.amount == null ? (x.keep && typeof x.keep === 'object' ? x.keep : KEEP_KEYS.some(k => k in x) ? x : null) : null;
  const vary = {};
  KEEP_KEYS.forEach(k => { vary[k] = keep ? !keep[k] : normVary(x.vary ? x.vary[k] : true); });
  return { vary, amount: x.amount == null ? 50 : Math.max(0, Math.min(100, +x.amount || 0)) };
}
// The second level's parameters are OPT-IN: `vary[k] = true` (the default, "any of it") never includes them, so every
// graph saved before draws exactly as it did; a parameter list that names one turns it on.
export const OPT_IN = { palette: ['light', 'chroma', 'paper', 'lib', 'colourway'], content: ['rotation', 'flipH', 'flipV', 'style', 'strokeW', 'scale', 'item'] };
export const isOptIn = (k, key) => (OPT_IN[k] || []).includes(key);
// `allowed(st, k, key)`: may this category / this parameter of it change
const allowed = (st, k, key) => { const v = st.vary[k]; if (v === true) return key == null || !isOptIn(k, key); return Array.isArray(v) && (key == null || v.includes(key)); };
// Older Variations params (`keep`, `varyBy`) → `vary`, `changes`, `onlyRandom`. Mutates and returns the params.
export function migrateVariationParams(p) {
  if (!p) return p;
  if (p.keep && typeof p.keep === 'object' && (p.vary == null || !Object.keys(p.vary).length)) { p.vary = {}; KEEP_KEYS.forEach(k => { if (p.keep[k]) p.vary[k] = false; }); }
  delete p.keep;
  if (p.varyBy != null) { if (p.changes == null) p.changes = p.varyBy === 'several' ? 2 : 1; if (p.onlyRandom == null) p.onlyRandom = p.varyBy === 'seed'; delete p.varyBy; }
  return p;
}
const pick = (a, rng) => a[Math.floor(rng() * a.length)];
// Amount (0–100, default 50): how far a change goes — k = amount / 50, so 50 is exactly the older formulas. Grid: the
// span is ¼ of the range × k (at least one step); hue: the turns within 30° + 150°·k (k ≤ 1) / at least 60°·k (k > 1);
// a cell rotation 5 + 10k … 30 + 60k degrees (15–90 at k = 1). Discrete changes (on / off, parity, flip, mirror) are as they are.
const kOf = st => st.amount / 50;
// Every change function returns null (nothing it can change here) or a change record, the structured form the label,
// the tile caption and a variation's panel read from (Phase D, Oct 9, 2026): { kind, key, label, value, text, edit }.
// `edit` ('number' with min / max / step / unit, or null) says whether the value can be set by hand; `edits` on a spec
// ({ 'kind:key': value }) replace the drawn value by that one — the rng is consumed exactly as without the edit, so the
// other changes of the variation stay what they were.
const editOf = (spec, kind, key) => spec && spec.edits && spec.edits[kind + ':' + key] != null ? spec.edits[kind + ':' + key] : null;
const snapTo = (v, a, b, step) => Math.min(b, Math.max(a, Math.round((+v - a) / step) * step + a));
// `only` (Series / Table, Phase E): that parameter and no other, its value from the spec (`editOf`), no rng, Vary ignored;
// a value equal to the current one is still a record (a step of the series, captioned as such).
function changeGrid(inp, rng, st, spec, only) {
  const g = inp.grid, gs = gridSpec(g.gen), p = { ...gridDefaults(g.gen), ...(g.params || {}) };
  const keys = gs.params.filter(x => x[2] !== 'text' && (only ? x[0] === only : allowed(st, 'grid', x[0]))); if (!keys.length) return null;
  const [k, label, a, b, step] = only ? keys[0] : pick(keys, rng);
  const cur = +p[k], span = Math.max(1, Math.round((b - a) / step / 4 * kOf(st))) * step;
  let v = cur; if (!only) for (let t = 0; t < 6 && v === cur; t++) v = Math.min(b, Math.max(a, Math.round((cur + (rng() < 0.5 ? -1 : 1) * step * (1 + Math.floor(rng() * Math.max(1, span / step)))) / step) * step));
  const e = editOf(spec, 'grid', k); if (e != null) v = snapTo(e, a, b, step);
  if (v === cur && !only) return null;
  inp.grid = { gen: g.gen, params: { ...p, [k]: v } };
  return { kind: 'grid', key: k, label, value: v, from: cur, text: `${label} ${v}`, edit: { type: 'number', min: a, max: b, step } };
}
function changePalette(inp, rng, st, spec, only) {
  const pal = inp.palette; if (!pal || !pal.colors || !pal.colors.length) return null;
  const C = Organica.color, n = pal.colors.length, ok = key => only ? only === key : allowed(st, 'palette', key);
  const canOrder = n > 1 && ok('order'), canHue = ok('hue'), extra = OPT_IN.palette.filter(ok);
  let op;
  if (!extra.length) { if (!canOrder && !canHue) return null; op = canOrder && (!canHue || rng() < 0.35) ? 'order' : 'hue'; }   // the first level's draw, unchanged
  else { const opts = [...(canOrder ? ['order'] : []), ...(canHue ? ['hue'] : []), ...extra]; op = only || pick(opts, rng); }
  const ground = pal.paper && pal.paper !== 'none' ? pal.paper : '#ffffff', kk = kOf(st), solve = inks => cwSolve(inks, ground) || inks;
  if (op === 'light') {   // every ink's perceived lightness, a signed delta in TuneSutra's points (L × 100), kept apart and legible on the paper
    let v = (rng() < 0.5 ? -1 : 1) * (3 + Math.floor(rng() * Math.max(1, Math.round(8 * kk)))); const e = editOf(spec, 'palette', 'light'); if (e != null) v = snapTo(e, -20, 20, 1);
    if (!v && !only) return null;
    inp.palette = { ...pal, colors: solve(pal.colors.map(h => { const o = C.hexToOklch(h); return C.oklchToHex(Math.min(0.97, Math.max(0.03, o.l + v / 100)), o.c, o.h); })) };
    return { kind: 'palette', key: 'light', label: 'Lightness', value: v, from: 0, text: `Lightness ${v > 0 ? '+' : ''}${v}`, edit: { type: 'number', min: -20, max: 20, step: 1 } };
  }
  if (op === 'chroma') {   // every ink's chroma, a signed delta in TuneSutra's points (C × 100; the gamut map clamps per ink)
    let v = (rng() < 0.5 ? -1 : 1) * (2 + Math.floor(rng() * Math.max(1, Math.round(4 * kk)))); const e = editOf(spec, 'palette', 'chroma'); if (e != null) v = snapTo(e, -10, 10, 1);
    if (!v && !only) return null;
    inp.palette = { ...pal, colors: solve(pal.colors.map(h => { const o = C.hexToOklch(h); return C.oklchToHex(o.l, Math.max(0, o.c + v / 100), o.h); })) };
    return { kind: 'palette', key: 'chroma', label: 'Chroma', value: v, from: 0, text: `Chroma ${v > 0 ? '+' : ''}${v}`, edit: { type: 'number', min: -10, max: 10, step: 1 } };
  }
  if (op === 'paper') {   // the paper one step lighter or darker along its own scale (a transparent paper has no step)
    if (pal.paper === 'none' || pal.transparent) return null;
    const sc = C.scale(ground), at = sc.reduce((b, x, i) => Math.abs(x.l - C.hexToOklch(ground).l) < Math.abs(sc[b].l - C.hexToOklch(ground).l) ? i : b, 0);
    const opts = [at > 0 ? ['lighter', sc[at - 1].hex] : null, at < sc.length - 1 ? ['darker', sc[at + 1].hex] : null].filter(Boolean).filter(([, h]) => h.toLowerCase() !== ground.toLowerCase());
    if (!opts.length) return null;
    const [name, hex] = only ? opts[0] : pick(opts, rng);
    inp.palette = { ...pal, paper: hex, colors: cwSolve(pal.colors, hex) || pal.colors };
    return { kind: 'palette', key: 'paper', label: 'Paper', value: name, text: `${name === 'lighter' ? 'Lighter' : 'Darker'} paper`, shown: name, edit: null };
  }
  if (op === 'lib') {   // the inks of another palette of the library (TuneSutra's saved ones + the built-ins) with at least as many inks; the resolved inks go on the record (and on a pin) so it redraws the same whatever the library does later
    const fixed = editOf(spec, 'palette', 'lib');
    let q;
    if (fixed && Array.isArray(fixed.hexes)) q = fixed;
    else {
      const lib = (Organica.palette && Organica.palette.library ? Organica.palette.library() : []).filter(x => x && x.colors && x.colors.length >= n).map(x => ({ name: x.name, hexes: x.colors.slice(0, n).map(c => (c.hex || c).toLowerCase()) })).filter(x => x.hexes.join() !== pal.colors.map(h => h.toLowerCase()).join());
      if (!lib.length) return null;
      q = only ? lib[0] : pick(lib, rng);
    }
    inp.palette = { ...pal, colors: solve(q.hexes) };
    return { kind: 'palette', key: 'lib', label: 'Another palette', value: { name: q.name, hexes: q.hexes }, text: `Inks from ${q.name}`, shown: q.name, edit: null, keep: true };
  }
  if (op === 'colourway') {   // one of the Component step's colourways of this palette (Tonal / Tint ground / Dark ground / Accent / Pair — Roles = Ink order, left out); the resolved colourway goes on the record
    const fixed = editOf(spec, 'palette', 'colourway');
    let cw;
    if (fixed && Array.isArray(fixed.colors)) cw = fixed;
    else {
      let cws = []; try { cws = buildColourways({ colors: pal.colors, paper: ground, colorRule: { ...DEFAULT_COLOR_RULE, ...(pal.rule || {}) } }, null, n, 24).filter(x => x.scheme !== 'current' && x.scheme !== 'roles'); } catch (e) { cws = []; }
      if (!cws.length) return null;
      const c0 = only ? cws[0] : pick(cws, rng); cw = { label: c0.label, colors: c0.colors.slice(), paper: c0.paper, colorRule: { ...c0.colorRule } };
    }
    inp.palette = { ...pal, colors: cw.colors.slice(), paper: cw.paper, rule: { ...cw.colorRule } };
    const [scheme, note] = String(cw.label).split(' · ');
    return { kind: 'palette', key: 'colourway', label: 'Colourway', value: cw, text: `Colourway ${scheme}`, shown: note ? `${scheme}, ${note}` : scheme, edit: null, keep: true };
  }
  if (op === 'order') { const c = pal.colors.slice(); c.push(c.shift()); inp.palette = { ...pal, colors: c }; return { kind: 'palette', key: 'order', label: 'Ink order', value: 'next', text: 'Inks in another order', edit: null }; }
  const turns = FG_HUE_TURNS.filter(t => kk <= 1 ? Math.abs(t) <= 30 + 150 * kk : Math.abs(t) >= 60 * kk);
  let turn = only ? 0 : pick(turns.length ? turns : FG_HUE_TURNS, rng);
  const e = editOf(spec, 'palette', 'hue'); if (e != null) turn = snapTo(e, -180, 180, 1);
  if (!turn && !only) return null;
  const turned = pal.colors.map(h => { const o = C.hexToOklch(h); return o.c < 0.03 ? h : C.oklchToHex(o.l, o.c, (o.h + turn + 360) % 360); });
  const solved = cwSolve(turned, pal.paper && pal.paper !== 'none' ? pal.paper : '#ffffff') || turned;
  inp.palette = { ...pal, colors: solved };
  return { kind: 'palette', key: 'hue', label: 'Hue', value: turn, from: 0, text: `Hue ${turn > 0 ? '+' : ''}${turn}°`, edit: { type: 'number', min: -180, max: 180, step: 1, unit: '°' } };
}
// Rules describe, Variations explore (Diego, Oct 9, 2026): a variation adjusts a rule that is in the chain — it never
// adds one (what a Figure does stays visible in its chain); "Use this" writes the change back into the graph.
const ANGLES = [90, 180, 270];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function changeCells(inp, rng, st, spec, only) {
  const rules = (inp.rules || []).slice(), at = rules.map((r, i) => r.kind === 'cells' && (r.rules || []).length ? i : -1).filter(i => i >= 0);
  if (!at.length) return null;
  let k, cur, i;
  if (only === 'angle') {   // the first rule with an angle, deterministic
    k = at.find(j => (rules[j].rules || []).some(q => typeof (q.do || {}).rotate === 'number' && ANGLES.includes(q.do.rotate))); if (k == null) return null;
    cur = clone(rules[k].rules); i = cur.findIndex(q => typeof (q.do || {}).rotate === 'number' && ANGLES.includes(q.do.rotate));
  } else { k = pick(at, rng); cur = clone(rules[k].rules); i = Math.floor(rng() * cur.length); }
  const r = cur[i], d = r.do || {}, w = r.when || {};
  const opts = [];
  if (only ? only === 'off' : allowed(st, 'cells', 'off')) opts.push('off');
  if (typeof d.rotate === 'number' && ANGLES.includes(d.rotate) && (only ? only === 'angle' : allowed(st, 'cells', 'angle'))) opts.push('angle');
  if (w.parity && (only ? only === 'parity' : allowed(st, 'cells', 'parity'))) opts.push('parity');
  if (!opts.length) return null;
  const o = only ? opts[0] : pick(opts, rng); let out;
  if (o === 'angle') {
    let a = only ? d.rotate : pick(ANGLES.filter(x => x !== d.rotate), rng); const e = editOf(spec, 'cells', 'angle'); if (e != null) a = snapTo(e, 0, 270, 90);
    r.do = { ...d, rotate: a }; out = { kind: 'cells', key: 'angle', label: 'Angle', value: a, from: d.rotate, text: cap(describeRule(r)), edit: { type: 'number', min: 0, max: 270, step: 90, unit: '°' } };
  } else if (o === 'parity') { r.when = { ...w, parity: w.parity === 'odd' ? 'even' : 'odd' }; out = { kind: 'cells', key: 'parity', label: 'Odd / even', value: r.when.parity, text: cap(describeRule(r)), edit: null }; }
  else { r.off = !r.off; out = { kind: 'cells', key: 'off', label: 'On / off', value: r.off ? 'off' : 'on', text: (r.off ? 'Off: ' : 'On: ') + describeRule(r), edit: null }; }
  rules[k] = { ...rules[k], rules: cur };
  inp.rules = rules; return out;
}
// Rotate & mirror, either mode: after a Repeat in grid a quarter turn or another Mirror; on the cells a turn of
// 15–90° either way, one Flip on / off, Rotation per cell, or a new random draw — said in the panel's own words
function changeTransform(inp, rng, st, spec, only) {
  const rules = (inp.rules || []).slice(), kinds = rules.map(r => r.kind), ok = key => only ? only === key : allowed(st, 'transform', key), ed = key => editOf(spec, 'transform', key);
  const at = kinds.map((k, i) => k === 'transform' ? i : -1).filter(i => i >= 0); if (!at.length) return null;
  const i = only ? at[0] : pick(at, rng), r = clone(rules[i]), t = r.transform, onCells = kinds.slice(0, i).indexOf('repeat') < 0;
  let out;
  const deg = { type: 'number', min: 0, max: 359, step: 1, unit: '°' };
  if (!onCells) {
    const canTurn = ok('turn'), canMirror = ok('mirror'); if (!canTurn && !canMirror) return null;
    if (canTurn && (!canMirror || rng() < 0.5)) {
      let a = only ? (+t.rotate || 0) : ((+t.rotate || 0) + 90) % 360; const e = ed('turn'); if (e != null) a = snapTo(e, 0, 270, 90);
      t.rotate = a; out = { kind: 'transform', key: 'turn', label: 'Rotation', value: a, text: `Rotation ${a}°`, edit: { ...deg, max: 270, step: 90 } };
    } else { t.mirror = pick(['none', 'v', 'h', 'vh'].filter(m => m !== t.mirror), rng); out = { kind: 'transform', key: 'mirror', label: 'Mirror', value: t.mirror, text: t.mirror === 'none' ? 'No mirror' : `Mirror ${MIRRORS[t.mirror].toLowerCase()}`, edit: null }; }
  } else {
    const c = r.cells || (r.cells = {}), opts = ['turn', 'flip', 'per'].filter(ok);
    if (c.turnRandom && ok('draw')) opts.push('draw');
    if (!opts.length) return null;
    const kk = kOf(st), o = only ? opts[0] : pick(opts, rng), by = () => only ? 0 : (rng() < 0.5 ? -1 : 1) * (5 + Math.round(10 * kk) + Math.floor(rng() * (26 + Math.round(50 * kk))));
    if (o === 'turn') {
      let a = (((+t.rotate || 0) + by()) % 360 + 360) % 360; const e = ed('turn'); if (e != null) a = snapTo(e, 0, 359, 1);
      t.rotate = a; out = { kind: 'transform', key: 'turn', label: 'Rotation', value: a, text: `Rotation ${a}°`, edit: deg };
    } else if (o === 'flip') {
      const axis = rng() < 0.5 ? 'v' : 'h', has = x => t.mirror === x || t.mirror === 'vh', on = !has(axis);
      const v = axis === 'v' ? on : has('v'), h = axis === 'h' ? on : has('h'); t.mirror = v && h ? 'vh' : v ? 'v' : h ? 'h' : 'none';
      out = { kind: 'transform', key: 'flip', label: `Flip ${axis === 'v' ? 'horizontal' : 'vertical'}`, value: on ? 'on' : 'off', text: `${on ? 'On' : 'Off'}: Flip ${axis === 'v' ? 'horizontal' : 'vertical'}`, edit: null };   // the Cell rules' form
    } else if (o === 'per') {
      const s = c.turnStep || { deg: 0, by: 'index' }; let d = ((s.deg + by()) % 360 + 360) % 360; const e = ed('per'); if (e != null) d = snapTo(e, 0, 359, 1);
      if (d) c.turnStep = { ...s, deg: d }; else delete c.turnStep;
      out = { kind: 'transform', key: 'per', label: 'Rotation per cell', value: d, text: `+${d}° per ${{ row: 'row', col: 'column' }[s.by] || 'cell'}`, edit: deg };   // as the card says it
    } else { c.turnRandom = { ...c.turnRandom, seed: Math.floor(rng() * 1e6) }; out = { kind: 'transform', key: 'draw', label: 'Random draw', value: c.turnRandom.seed, text: 'New random draw', edit: null }; }
    if (!Object.keys(c).length) delete r.cells;
  }
  rules[i] = r; inp.rules = rules; return out;
}
export const CHANGE_OF = { grid: 'Grid', palette: 'Palette', content: 'Content', cells: 'Cell rules', transform: 'Rotate & mirror' };   // UI-COPY §2 names
// Content (phase H): the spread of several contents over the cells (as before), or — opt-in — the first Element turned a
// quarter in every cell (rotation), flipped (flipH / flipV), its Style swapped fill ↔ stroke, its stroke width or scale
// changed, or — a wired Set — one of its items as the whole content (item; never in a fan-out). Words: O-62.
// `extra` takes the content seed (the spread). The library is never read: a content node draws from its own entry.
function changeContent(inp, rng, st, spec, only, extra) {
  const list = (inp.content || []).filter(Boolean), ok = key => only ? only === key : allowed(st, 'content', key), ed = key => editOf(spec, 'content', key);
  const firstEl = () => { for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.kind === 'element' && c.entry) return [i, null, c]; if (c.kind === 'set') { const j = (c.items || []).findIndex(x => x && x.kind === 'element' && x.entry); if (j >= 0) return [i, j, c.items[j]]; } } return null; };
  const el = firstEl(), set = list.find(c => c.kind === 'set' && (c.items || []).length > 1), opts = [];
  if (contentCount(inp) > 1 && ok('spread')) opts.push('spread');
  if (el) ['rotation', 'flipH', 'flipV', 'style', 'strokeW', 'scale'].forEach(k => { if (ok(k)) opts.push(k); });
  if (set && !spec.fanOut && ok('item')) opts.push('item');
  if (!opts.length) return null;
  const op = only || (opts.length === 1 && opts[0] === 'spread' ? 'spread' : pick(opts, rng));   // one option = no draw (the first level's spread consumed none)
  if (op === 'spread') { extra.contentSeed = Math.floor(rng() * 1e9); return { kind: 'content', key: 'spread', label: 'Spread', value: extra.contentSeed, text: 'New spread', shown: 'new', edit: null }; }
  if (op === 'item') {
    const fixed = ed('item'), names = set.items.map(x => x && x.name), cur = names.indexOf(fixed) >= 0 ? names.indexOf(fixed) : -1;
    const i = cur >= 0 ? cur : only ? 0 : Math.floor(rng() * set.items.length), it = set.items[i];
    inp.content = list.map(c => c === set ? it : c);
    return { kind: 'content', key: 'item', label: 'Item', value: it.name, text: `Item ${it.name}`, shown: it.name, edit: null, keep: true };
  }
  const entry = el[2].entry, kk = kOf(st);
  // a changed entry is drawn by the general path (a built-in's recipe path reads neither appearance nor orientation — review B1): `recipe` goes
  const put = e2 => { const [i, j, c] = el, { recipe, ...clean } = e2, nc = { ...c, entry: clean }, copy = list.slice(); void recipe; if (j == null) copy[i] = nc; else copy[i] = { ...list[i], items: list[i].items.map((x, k) => k === j ? nc : x) }; inp.content = copy; };
  const o = entry.orientation || {}, a = entry.appearance || {};
  if (op === 'rotation') {
    let r = ((+o.rotation || 0) + (only ? 0 : 90)) % 360; const e = ed('rotation'); if (e != null) r = snapTo(e, 0, 270, 90);
    if (r !== (+o.rotation || 0)) put({ ...entry, orientation: { ...o, rotation: r } });   // an identity step (a Series from the current value) leaves the entry — and its recipe — as it is
    return { kind: 'content', key: 'rotation', label: 'Rotation', value: r, from: +o.rotation || 0, text: `Rotation ${r}°`, edit: { type: 'number', min: 0, max: 270, step: 90, unit: '°' } };
  }
  if (op === 'flipH' || op === 'flipV') {
    const on = !o[op]; put({ ...entry, orientation: { ...o, [op]: on } });
    const which = op === 'flipH' ? 'Flip horizontal' : 'Flip vertical';
    return { kind: 'content', key: op, label: which, value: on ? 'on' : 'off', text: `${on ? 'On' : 'Off'}: ${which}`, shown: on ? 'on' : 'off', edit: null };
  }
  if (op === 'style') {
    const mode = a.fillMode === 'stroke' ? 'fill' : 'stroke';
    put({ ...entry, appearance: { ...a, fillMode: mode, strokeW: a.strokeW || 4 } });
    return { kind: 'content', key: 'style', label: 'Style', value: mode, text: mode === 'stroke' ? 'Stroke' : 'Fill', shown: mode, edit: null };
  }
  if (op === 'strokeW') {
    const cur = +a.strokeW || 4; let w = cur + (only ? 0 : (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * Math.max(1, Math.round(3 * kk))))); const e = ed('strokeW'); if (e != null) w = e; w = snapTo(w, 1, 20, 1);
    if (w === cur && !only) return null;
    if (w !== cur) put({ ...entry, appearance: { ...a, fillMode: a.fillMode === 'fill' || !a.fillMode ? 'stroke' : a.fillMode, strokeW: w } });   // a width needs a stroke to show
    return { kind: 'content', key: 'strokeW', label: 'Stroke width', value: w, from: cur, text: `Stroke width ${w}`, edit: { type: 'number', min: 1, max: 20, step: 1 } };
  }
  const cur = Math.round((+a.scale || 1) * 100); let pc = cur + (only ? 0 : (rng() < 0.5 ? -1 : 1) * 10 * (1 + Math.floor(rng() * Math.max(1, Math.round(3 * kk))))); const e = ed('scale'); if (e != null) pc = e; pc = snapTo(pc, 10, 500, 10);
  if (pc === cur && !only) return null;
  if (pc !== cur) put({ ...entry, appearance: { ...a, scale: pc / 100 } });
  return { kind: 'content', key: 'scale', label: 'Scale', value: pc, from: cur, text: `Scale ${pc}%`, edit: { type: 'number', min: 10, max: 500, step: 10, unit: '%' } };
}
const CHANGES = { grid: changeGrid, palette: changePalette, content: changeContent, cells: changeCells, transform: changeTransform };
const contentCount = inp => (inp.content || []).filter(Boolean).reduce((n, c) => n + (c.kind === 'set' ? c.items.length : 1), 0);   // a Set counts its items
// `settings`: a Variations node's params (`vary`, `amount`) or an older `keep` object — see settingsOf().
// → { inputs, extra, label, changes } — `changes` the records above (each with `text`; the label = the records' texts,
// each prefixed with the input it changed, joined with ' · ').
export function varyInputs(inputs, spec, settings) {
  const st = settingsOf(settings);
  const inp = { ...inputs, rules: chainOf(inputs.rules) }, rng = mulberry32((spec.seed * 2654435761) >>> 0), changes = [], extra = {};
  const spread = () => { extra.contentSeed = Math.floor(rng() * 1e9); changes.push({ kind: 'content', key: 'spread', label: 'Spread', value: extra.contentSeed, text: 'New spread', shown: 'new', edit: null }); };
  const reseed = () => {   // what is random: a Grid's own seed, how several contents spread over the cells, a rule's Random rotation
    let did = false;
    if (allowed(st, 'grid', 'seed') && gridSpec(inp.grid.gen).params.some(x => x[0] === 'seed')) { const seed = Math.floor(rng() * 1000); inp.grid = { gen: inp.grid.gen, params: { ...gridDefaults(inp.grid.gen), ...(inp.grid.params || {}), seed } }; changes.push({ kind: 'grid', key: 'seed', label: 'Seed', value: seed, text: 'new seed', edit: null }); did = true; }
    if (allowed(st, 'content', 'spread') && contentCount(inp) > 1) { spread(); did = true; }
    if (allowed(st, 'transform', 'draw') && inp.rules.some(r => r.kind === 'transform' && r.cells && r.cells.turnRandom)) {   // a rule's own luck: Random rotation draws again
      const seed = Math.floor(rng() * 1e6);
      inp.rules = inp.rules.map(r => r.kind === 'transform' && r.cells && r.cells.turnRandom ? { ...r, cells: { ...r.cells, turnRandom: { ...r.cells.turnRandom, seed } } } : r);
      changes.push({ kind: 'transform', key: 'draw', label: 'Random draw', value: seed, text: 'New random draw', edit: null }); did = true;
    }
    return did;
  };
  const done = () => ({ inputs: inp, extra, changes, label: changes.map(c => CHANGE_OF[c.kind] + ': ' + c.text).join(' · ') || 'No change' });   // every change prefixed with its input, Content too (O-62)
  if (spec.mode === 'set') {   // Series / Table (Phase E): the given parameters set to the given values, in key order — deterministic, Vary and Amount do not apply
    const sp = { ...spec, edits: { ...(spec.set || {}), ...(spec.edits || {}) } };
    Object.keys(spec.set || {}).forEach(k => { const [kind, key] = k.split(':'); const f = CHANGES[kind]; const c = f ? f(inp, rng, st, sp, key, extra) : null; if (c) changes.push(c); });
    return done();
  }
  const kinds = KEEP_KEYS.filter(k => allowed(st, k) && (k !== 'content' || (contentCount(inp) > 1 && allowed(st, 'content', 'spread')) || OPT_IN.content.some(key => allowed(st, 'content', key))));
  if (spec.mode === 'seed' && reseed()) return done();
  const want = spec.mode === 'several' ? 2 + Math.floor(rng() * 2) : spec.mode === 'changes' ? Math.max(1, Math.min(3, +spec.changes || 1)) : 1;
  for (let tries = 0; tries < 12 && changes.length < want && kinds.length; tries++) {
    const k = pick(kinds, rng);
    const c = CHANGES[k](inp, rng, st, spec, null, extra); if (c) { changes.push(c); kinds.splice(kinds.indexOf(k), 1); }   // what changed, said with the input it changed (Diego, Oct 9, 2026)
  }
  return done();
}
// The spec mode a Variations node draws with: `onlyRandom` → 'seed'; one change → 'one' (the key older pins have);
// two or three → 'changes'. Older params (`varyBy`) read as they were.
export function specModeOf(p) {
  p = p || {};
  if (p.onlyRandom || p.varyBy === 'seed') return { mode: 'seed' };
  const n = p.changes != null ? Math.max(1, Math.min(3, +p.changes || 1)) : p.varyBy === 'several' ? 0 : 1;
  return n === 0 ? { mode: 'several' } : n === 1 ? { mode: 'one' } : { mode: 'changes', changes: n };
}
// How many steps a Series / Table draws (its children): the axes' steps multiplied; 0 when no axis is set.
export const seriesAxes = p => (p.series || []).filter(a => a && a.key).slice(0, p.mode === 'table' ? 2 : 1).map(a => ({ ...a, steps: Math.max(1, Math.min(12, Math.round(+a.steps || 1))) }));
export function seriesCount(p) { const ax = seriesAxes(p); return ax.length ? Math.min(16, ax.reduce((n, a) => n * a.steps, 1)) : 0; }
// The parameters a Series / Table can sweep, from a Figure's inputs: [{ key: 'grid:cols', kind, label, min, max, step, unit?, cur }]
// — the Grid's numeric parameters, Palette Hue, Cell rules Angle (if a rule has one), Rotate & mirror Rotation / Rotation per cell.
export function sweepableOf(inputs) {
  const out = [], rules = chainOf(inputs.rules), g = inputs.grid;
  if (g) { const p = { ...gridDefaults(g.gen), ...(g.params || {}) }; gridSpec(g.gen).params.filter(x => x[2] !== 'text').forEach(([k, label, a, b, step]) => out.push({ key: 'grid:' + k, kind: 'grid', label, min: a, max: b, step, cur: +p[k] })); }
  if (inputs.palette && inputs.palette.colors && inputs.palette.colors.length) { out.push({ key: 'palette:hue', kind: 'palette', label: 'Hue', min: -180, max: 180, step: 15, unit: '°', cur: 0 }); out.push({ key: 'palette:light', kind: 'palette', label: 'Lightness', min: -20, max: 20, step: 1, cur: 0 }); out.push({ key: 'palette:chroma', kind: 'palette', label: 'Chroma', min: -10, max: 10, step: 1, cur: 0 }); }
  const anyEl = (inputs.content || []).filter(Boolean).some(c => (c.kind === 'element' && c.entry) || (c.kind === 'set' && (c.items || []).some(x => x && x.kind === 'element' && x.entry)));
  if (anyEl) { const e = (inputs.content || []).filter(Boolean).flatMap(c => c.kind === 'set' ? (c.items || []) : [c]).find(c => c && c.kind === 'element' && c.entry).entry, a = e.appearance || {}; out.push({ key: 'content:rotation', kind: 'content', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°', cur: +(e.orientation || {}).rotation || 0 }); out.push({ key: 'content:strokeW', kind: 'content', label: 'Stroke width', min: 1, max: 20, step: 1, cur: +a.strokeW || 4 }); out.push({ key: 'content:scale', kind: 'content', label: 'Scale', min: 10, max: 500, step: 10, unit: '%', cur: Math.round((+a.scale || 1) * 100) }); }
  const angled = rules.find(r => r.kind === 'cells' && (r.rules || []).some(q => typeof (q.do || {}).rotate === 'number' && ANGLES.includes(q.do.rotate)));
  if (angled) out.push({ key: 'cells:angle', kind: 'cells', label: 'Angle', min: 90, max: 270, step: 90, unit: '°', cur: angled.rules.find(q => typeof (q.do || {}).rotate === 'number' && ANGLES.includes(q.do.rotate)).do.rotate });
  const ti = rules.findIndex(r => r.kind === 'transform');
  if (ti >= 0) {
    const t = rules[ti], onCells = rules.slice(0, ti).every(r => r.kind !== 'repeat');
    out.push(onCells ? { key: 'transform:turn', kind: 'transform', label: 'Rotation', min: 0, max: 359, step: 1, unit: '°', cur: +t.transform.rotate || 0 } : { key: 'transform:turn', kind: 'transform', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°', cur: +t.transform.rotate || 0 });
    if (onCells) out.push({ key: 'transform:per', kind: 'transform', label: 'Rotation per cell', min: 0, max: 359, step: 1, unit: '°', cur: t.cells && t.cells.turnStep ? +t.cells.turnStep.deg || 0 : 0 });
  }
  return out;
}
// The specs of a Series (one parameter, `steps` values from → to, snapped to the parameter's step) or a Table (two
// parameters, row-major: the first across, the second down). p.series = [{ key, from, to, steps, label? }, …] (1 or 2).
export function seriesSpecs(p, sweep) {
  const axes = seriesAxes(p).map(a => {
    const sw = (sweep || []).find(x => x.key === a.key) || { min: -Infinity, max: Infinity, step: 1 };
    const n = a.steps, from = +a.from, to = +a.to, vals = [];
    for (let i = 0; i < n; i++) { const v = n === 1 ? from : from + (to - from) * i / (n - 1); vals.push(Number.isFinite(sw.min) ? snapTo(v, sw.min, sw.max, sw.step) : Math.round(v / sw.step) * sw.step); }
    return { key: a.key, vals };
  });
  if (!axes.length) return [];
  const base = (+p.seed || 1) >>> 0, out = [];
  const push = set => out.push({ key: 'set:' + Object.entries(set).map(([k, v]) => k + '=' + v).join(','), spec: { mode: 'set', set, seed: base }, pinned: false });
  if (axes.length === 1) axes[0].vals.forEach(v => push({ [axes[0].key]: v }));
  else axes[1].vals.forEach(v2 => axes[0].vals.forEach(v1 => push({ [axes[0].key]: v1, [axes[1].key]: v2 })));
  return out;
}
// The candidate specs a Figure draws from its seed (the base, the Figure as set up, is not one of them).
export function variationSpecs(p, count) {
  const md = specModeOf(p), base = (+p.seed || 1) >>> 0, out = [], tag = md.mode + (md.changes ? md.changes : '');
  for (let i = 1; out.length < count && i < 400; i++) out.push({ key: tag + ':' + ((base * 7919 + i * 104729) >>> 0), spec: { ...md, seed: (base * 7919 + i * 104729) >>> 0 }, pinned: false });
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
  // Its output carries `src` = the variation's own varied inputs (Phase C, Oct 9, 2026): a Variations node wired to a
  // variation draws around IT — `raw` is what that node varies, with no `fixed` left to re-apply and no fan-out item.
  const one = (f, label = v.label, src = null, changes = v.changes) => {
    const out = { ...f, variations: [{ key: 'base', svg: f.svg, label, changes, pinned: !!v.pinned, spec: v.spec, slot: v.slot, item: v.item }], groups: undefined, capped: undefined, failedVariations: undefined };
    if (src) { const { fixed, onlyItem, ...params } = src.params || {}; withSrc(out.variations[0], { inputs: src.inputs, extra: src.extra, params, raw: src.inputs }, out); }
    return out;
  };
  const s = v.src, own = (i.content || []).filter(Boolean);
  const variedFrom = (inputs, st) => { if (!v.spec) return { inputs, extra: { ...s.extra } }; const vr = varyInputs(inputs, v.spec, st); return { inputs: vr.inputs, extra: { ...s.extra, ...vr.extra } }; };
  if (!hasOverrides(i) || !v.src) {
    const src = s ? { ...variedFrom(s.inputs, settingsOf(s.params)), params: s.params } : null;
    return { figure: one({ ...par, ...(v.res || {}), svg: v.svg, canvas: (v.res || par).canvas || par.canvas, checks: null }, v.label, src) };
  }
  const inp = { ...s.inputs, rules: chainOf(s.inputs.rules).concat(chainOf(i.rules)) };   // its own chain goes after the Figure's
  OVERRIDES.forEach(k => { if (i[k]) inp[k] = i[k]; });
  if (own.length) inp.content = own;
  let r;
  // What you connect by hand wins over the generated change (Diego, Oct 8, 2026 — as in CSS, declared beats generated):
  // an own input is kept as if Keep were on for it; the variation changes only what you left alone.
  const st = settingsOf(s.params);
  if (i.palette) st.vary.palette = false;
  if (i.grid) st.vary.grid = false;
  if (own.length) st.vary.content = false;
  if (chainOf(i.rules).length) { st.vary.cells = false; st.vary.transform = false; }
  if (v.spec) { const vr = varyInputs(inp, v.spec, st); r = await compileFigure(vr.inputs, { ...s.params, ...s.extra, ...vr.extra }, { checks: false }); return { figure: one(r, vr.label, { inputs: vr.inputs, extra: { ...s.extra, ...vr.extra }, params: s.params }, vr.changes) }; }
  r = await compileFigure(inp, { ...s.params, ...s.extra }, { checks: false });
  return { figure: one(r, v.label, { inputs: inp, extra: { ...s.extra }, params: s.params }) };
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
    { meta: { id: 'transform', label: 'Rotate & mirror', category: 'Rules', pill: true, icon: 'node-transform', inputs: RULE_IN, outputs: RULE_OUT, params: [{ name: 'rotate', default: 0 }, { name: 'mirror', default: 'none' }, { name: 'which', default: 'all' }, { name: 'n', default: 1 }, { name: 'perCell', default: 0 }, { name: 'countBy', default: 'index' }, { name: 'randomAmount', default: null }, { name: 'seed', default: 1 }] },
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
          { name: 'fixed', default: null }] },
      // a Figure draws itself only (Diego, Oct 9, 2026) — its variations are a Variations node's; a Set's items are mixed over the cells
      compute: async (i, p) => ({ figure: await figureWithVariations(i, { ...p, variations: 1, fanOut: false }) }) },
    // Variations (Diego, Oct 9, 2026): Figure → Variations → one Figure per variation, each saying what changed. It draws
    // again from the Figure's own inputs (carried on its drawing), so a variation changes what Keep allows.
    { meta: { id: 'variations', label: 'Variations', category: 'Rules', pill: true, icon: 'variations',
        inputs: [{ name: 'figure', type: 'figure', label: 'Figure', required: true }],
        outputs: [{ name: 'figure', type: 'figure', label: 'Figures' }],
        params: [{ name: 'variations', default: 3 }, { name: 'changes', default: 1 }, { name: 'onlyRandom', default: false }, { name: 'seed', default: 1 },
          { name: 'vary', default: {} }, { name: 'amount', default: 50 }, { name: 'pins', default: [] }, { name: 'fanOut', default: true },
          { name: 'mode', default: 'random' }, { name: 'series', default: [] }] },   // mode: random · series · table; series: [{ key, from, to, steps }] (Phase E)
      compute: async (i, p) => {
        const base = i.figure && i.figure.variations && i.figure.variations[0], s = base && base.src;
        if (!s) throw new Error('Connect a Figure input');
        const q = migrateVariationParams({ ...p });   // an older node's keep / varyBy, read as vary / changes
        return { figure: await figureWithVariations(s.raw || s.inputs, { ...s.params, variations: Math.max(0, +q.variations || 0) + 1, changes: q.changes, onlyRandom: q.onlyRandom, seed: q.seed, vary: q.vary, amount: q.amount, pins: q.pins, fanOut: q.fanOut, mode: q.mode || 'random', series: q.series || [] }) };
      } },
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
