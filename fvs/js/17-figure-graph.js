// Flexible Visual System · 17-figure-graph — the Figure step as a node graph (Organica.nodeCanvas). The UI side of
// engine/17-figure-nodes.js. An ES module of the Figure tier (loaded on demand by ./figure.js). docs/FVS.md §12.
//
// Left dock = the node bar (Foundation · Content · Rules · Output; saved entries as thumbnails, drag onto the graph or
// click to add). Right panel = the selected node's settings. Bottom floatbar = New Figure…, Undo / Redo, Delete,
// Fit all / Fit selection. Words: docs/UI-COPY.md §2 "Figure graph".
import { rt } from './rt.js';
import { provide } from './hooks.js';
import { bindCellProps, cellPropsHTML, openCellContentOverlay, syncCellProps } from './11-symbol-ui.js';
import { placeStepNav, syncExportButton } from './12-shell.js';
import { syncRailTier } from './15-export-library-view.js';
import {
  COLOR_RULES, live, pc, pv, state
} from './engine/00-core.js';
import {
  ELEMENT_LIB, savedElementThumb
} from './engine/04-appearance.js';
import {
  savedElementEntrySVG
} from './engine/05-render-component.js';
import {
  LIBRARY, libraryNames, shownElementNames
} from './engine/07-library.js';
import {
  SYMCANVAS_PRESETS, SYMGRID_GENS
} from './engine/08-symbol-grid.js';
import {
  SYMBOL_ARRANGE, componentThumbSVG
} from './engine/10-suggest.js';
import {
  SYMBOL_LIBRARY, SYMBOL_RULES, symbolPastePlan
} from './engine/11-symbol-ui.js';
import {
  SEED_TYPES
} from './engine/01-geometry.js';
import {
  describeRule, figureCatalog
} from './engine/14-figure-ui.js';
import {
  isSealedSymbol, ruleMatches, validateFigureRecipe
} from './engine/13-figure-engine.js';
import {
  evalFigure
} from './engine/16-figure-eval.js';
import {
  plateSVG
} from './engine/15-export-library-view.js';
import {
  FIGURE_LATTICES, FIT_LABEL, FIT_PRESET, KEEP_KEYS, MIRRORS, REPEAT_LATTICES, canvasOf, canvasSummary, elementEntryFromRecipe, entrySnapshot, figureNodeTypes,
  exportPlan, exportSummary, graphFromRecipe, gridDefaults, gridPreviewModel, gridSpec, gridSummary, recipeElementKey, sameItem, childKey, itemName, FIGURE_RENDER_CAP
} from './engine/17-figure-nodes.js';
import {
  ctrl
} from './00-core.js';

provide({ renderFigureTier: () => renderFigureGraph });

const NC = Organica.nodeCanvas;
const registry = NC.createRegistry(figureNodeTypes());
const VIEW_KEY = 'organica.fvs.figure-view';
const GRAPHS = Organica.store('fvs-figure');
const SETS = Organica.store('fvs-sets');   // saved Sets: { name: { items: [{kind, name, snapshot}], savedAt } }
const CURRENT = '__current';   // the graph being edited, autosaved (not a saved graph: never listed)
let graphName = '';             // the saved graph the autosaved one was opened from / saved as, read at boot ('' = not saved yet); then graphMenu.name()
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { Foundation: 'node-foundation', Content: 'node-content', Rules: 'node-rule', Output: 'node-output' };
const COMPONENT_RULES = { radial: 'Radial', pinwheel: 'Pinwheel', mirror: 'Mirror (kaleidoscope)', checkerboard: 'Checkerboard' };   // the Component step's own names
let ctl = null;

// ── the graph a first visit starts with: Canvas + Grid + Palette → Figure, fed by the newest saved Component/Element ──
// Default names (UI-COPY §2): Canvas 1, Grid 1, Palette 1, Figure 1 — given once, when the node is made, so deleting
// Canvas 1 never renames Canvas 2. A content node is titled by its library entry.
const NUMBERED = ['canvas', 'grid', 'palette', 'figure', 'set', 'variations'];   // Variations numbered (O-58 b, Diego, Oct 9, 2026)
function nextName(model, type) {
  const base = registry.get(type).meta.label, re = new RegExp('^' + base + ' (\\d+)$');
  const used = model.nodes.filter(n => n.type === type).map(n => +((String(n.name || '').match(re) || [])[1] || 0));
  return base + ' ' + (Math.max(0, ...used) + 1);
}
function nameFor(model, type, params) {
  if (NUMBERED.includes(type)) return nextName(model, type);
  return params && params.name ? params.name : registry.get(type).meta.label;
}
function ensureNames(model) { model.nodes.forEach(n => { if (!n.name) n.name = nameFor(model, n.type, n.params); }); return model; }
// Room between node columns: port labels sit outside the cards (node-canvas.css), an output's and an input's face
// each other across the gap — two one-word labels + their gaps need ~120 px (design-system review, Oct 8, 2026).
const LABEL_ROOM = 136, COL_STEP = 224 + LABEL_ROOM;   // 224 = the default card width (14rem)
function starterModel() {
  const m = NC.createModel();
  const mk = (type, x, y) => NC.addNode(m, { type, x, y, params: registry.defaults(type), name: nextName(m, type) });
  const cv = mk('canvas', 40, 40), gr = mk('grid', 40, 200), pa = mk('palette', 40, 360), fg = mk('figure', 40 + COL_STEP, 40);
  NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: fg.id, port: 'canvas' });
  NC.addEdge(m, { node: gr.id, port: 'grid' }, { node: fg.id, port: 'grid' });
  NC.addEdge(m, { node: pa.id, port: 'palette' }, { node: fg.id, port: 'palette' });
  const c = newestEntry();
  if (c) {
    const cn = NC.addNode(m, { type: c.kind, x: 40, y: 520, params: { name: c.name, snapshot: entrySnapshot(c.entry) }, name: c.name });
    NC.addEdge(m, { node: cn.id, port: 'content' }, { node: fg.id, port: 'content' }, true);
  }
  return m;
}
function savedEntries() {
  const els = ELEMENT_LIB.read(), comps = LIBRARY.read();
  const by = all => (a, b) => String((all[b] || {}).savedAt || '').localeCompare(String((all[a] || {}).savedAt || ''));
  return {
    element: shownElementNames(els).sort(by(els)).map(n => ({ kind: 'element', name: n, entry: els[n] })),
    component: libraryNames(comps).sort(by(comps)).map(n => ({ kind: 'component', name: n, entry: comps[n] })),
  };
}
function newestEntry() { const s = savedEntries(); return s.component[0] || s.element[0] || null; }
function entryThumb(kind, name, entry) {
  try { return kind === 'element' ? (entry && !entry.thumb && entry.seed ? savedElementEntrySVG(entry) : savedElementThumb(entry)) : componentThumbSVG(name); } catch (e) { return ''; }   // a node's copy has no thumbnail: drawn from the entry
}

// ── card bodies ──
const urls = new Map();
function figureImg(id, svg) {
  const old = urls.get(id); if (old && old.svg === svg) return old.url;
  if (old) URL.revokeObjectURL(old.url);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); urls.set(id, { url, svg }); return url;
}
function renderBody(node, entry, el) {
  const p = node.params || {}, v = entry && entry.value;
  if ((node.type === 'figure' || node.type === 'figure-var') && composing && composing.fig === node.id) requestAnimationFrame(() => { if (!composing) return; drawCompose(); const a = document.activeElement; if (!(a && a.type === 'range' && ctrl('fg-inspector').contains(a))) renderComposeInspector(); });   // (not under a slider being dragged) the panel's lost-cell notes follow the new result
  if (node.type === 'figure') {
    const f = v && v.figure;
    if (!f) { el.innerHTML = ''; return; }
    const vars = f.variations && f.variations.length ? f.variations : [{ key: 'base', svg: f.svg, label: 'As set up' }];
    const base = vars[0];
    // the drawing + one line (Diego, Oct 9, 2026 — the card in line with the others): Canvas · Grid · Palette are in the panel
    el.innerHTML = `<figure class="fg-var"><div class="fg-card__sheet" data-theme="light">${base.error ? `<p class="fg-var__error">${esc(base.label)}</p>` : `<img class="fg-card__img" alt="${esc(nodeLabel(node))}" src="${figureImg(node.id + ':' + base.key, base.svg)}">`}</div>
        ${f.groups ? `<figcaption class="fg-var__label">${esc(f.groups[0].label)}</figcaption>` : ''}</figure>`
      + checksBadge(f) + `<p class="fg-card__meta">${f.cells} cells${f.capped ? ` · ${f.capped.per} of ${f.capped.asked} variations per item${f.capped.shownItems < f.capped.items ? `, ${f.capped.shownItems} of ${f.capped.items} items` : ''} — at most ${f.capped.cap} figures` : ''}${f.failedVariations ? ` · ${f.failedVariations} ${f.failedVariations === 1 ? 'change' : 'changes'} could not be drawn` : ''}</p>`;
    el.querySelectorAll('.fg-card__img').forEach(img => img.addEventListener('load', () => { ctl.remeasure(node.id); variationsOf(node.id).forEach(vn => restackChildren(vn.id)); }, { once: true }));
  } else if (node.type === 'variations') {
    const k = Math.max(0, +p.variations || 0), f = v && v.figure;
    el.innerHTML = NC.body.line(`${k} ${k === 1 ? 'variation' : 'variations'} · ${({ seed: 'Seed', one: 'One change', several: 'Several changes' })[p.varyBy || 'one']}${f && f.failedVariations ? ` · ${f.failedVariations} could not be drawn` : ''}`);
  } else if (node.type === 'figure-var') {
    const f = v && v.figure, par = sourceOf(node);
    if (!f) { el.innerHTML = ''; return; }
    const vr = f.variations[0], item = vr.item != null ? itemName(vr.item) : null;
    el.innerHTML = `<figure class="fg-var${vr.pinned ? ' is-pinned' : ''}">
        <div class="fg-card__sheet" data-theme="light"><img class="fg-card__img" alt="${esc(nodeLabel(node))}" src="${figureImg(node.id, f.svg)}"></div>
        <figcaption class="fg-var__label">${item ? esc(item) + ' · ' : ''}${esc(vr.slot === 0 ? 'As set up' : vr.label)}</figcaption>
        ${vr.spec ? `<div class="fg-var__tools">
          <button type="button" class="icon-btn" data-act="pin" aria-pressed="${!!vr.pinned}" aria-label="Pin variation ${par ? variationNo(node) : ''}">${Organica.icons.get('pin')}</button>
          <button type="button" class="icon-btn" data-act="from" aria-label="New Figure from variation ${par ? variationNo(node) : ''}">${Organica.icons.get('figure-from')}</button></div>` : ''}
      </figure>`;
    el.querySelectorAll('.fg-card__img').forEach(img => img.addEventListener('load', () => { ctl.remeasure(node.id); if (par) restackChildren(par.id); }, { once: true }));
    if (!el._varBound) { el._varBound = true; el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; e.stopPropagation(); variationAction(node.id, b.dataset.act); }); }
  } else if (node.type === 'canvas') {
    const cv = canvasOf(p);
    el.innerHTML = cv.fit ? NC.body.picture(Organica.aspectIcon(1, 1, { dashed: true }), 'The page is the Figure’s own size') : NC.body.picture(Organica.aspectIcon(cv.W, cv.H), canvasSummary(cv));
  } else if (node.type === 'grid') {
    const g = { gen: p.gen, params: p.params }, text = gridSummary(g);
    el.innerHTML = NC.body.picture('', text);
    const cv = gridCanvasOf(node), key = JSON.stringify([g, cv.W, cv.H, cv.margin]); el._gridKey = key;   // a newer render wins
    const fallback = () => { if (el._gridKey === key) el.innerHTML = NC.body.line(text); };   // no drawing: the summary stays readable on the pill
    gridPreviewModel(g, cv).then(m => { const pic = el._gridKey === key && el.querySelector('.nc-body__pic'), svg = m && Organica.loomGridThumb(m); if (!pic) return; if (svg) pic.innerHTML = svg; else fallback(); }).catch(fallback);
  } else if (node.type === 'palette') {
    const k = (p.colors || []).length;
    el.innerHTML = NC.body.swatches([p.transparent ? 'transparent' : (p.paper || '#ffffff'), ...(p.colors || [])], { paper: true, text: k + (k === 1 ? ' ink' : ' inks') });
  } else if (node.type === 'export') {
    const files = exportFiles(node), n = files.length;
    el.innerHTML = NC.body.line(n ? `${n} ${n === 1 ? 'file' : 'files'}` : 'No files');   // a pill: one fact; Export ‹n› files is the panel's (Diego, Oct 8, 2026)
  } else if (node.type === 'set') {
    const items = p.items || [];
    el.innerHTML = items.length ? NC.body.stack(items.slice(0, 3).map(it => entryThumb(it.kind, it.name, it.snapshot)), `${items.length} ${items.length === 1 ? 'item' : 'items'}`)
      : NC.body.stack([], 'No items yet');
  } else if (node.type === 'cell-rules') {
    const rs = p.rules || [];
    el.innerHTML = NC.body.line(rs.length ? rs.length + (rs.length === 1 ? ' rule' : ' rules') : 'No rules yet');   // the rules themselves: the panel
  } else if (node.type === 'component-rule') {
    el.innerHTML = NC.body.line(COMPONENT_RULES[p.rule] || p.rule);
  } else if (node.type === 'composition') {
    const rs = p.rules || [];
    el.innerHTML = NC.body.line(rs.length ? `${rs.length} region ${rs.length === 1 ? 'rule' : 'rules'}` : 'No region rules yet');
  } else if (node.type === 'repeat') {
    const L = REPEAT_LATTICES[p.lattice] || REPEAT_LATTICES.square;
    const unit = { square: 'per side', tier: +p.count === 1 ? 'tier' : 'tiers', triangle: +p.count === 1 ? 'row' : 'rows' }[p.lattice in REPEAT_LATTICES ? p.lattice : 'square'];
    el.innerHTML = NC.body.line(`${L.label} · ${p.count} ${unit}`);   // flip, rotation, mirror: the panel
  } else if (node.type === 'transform') {
    const rot = +p.rotate || 0, mir = p.mirror && p.mirror !== 'none' && MIRRORS[p.mirror];
    el.innerHTML = NC.body.line(rot && mir ? `Rotation ${rot}° + mirror` : rot ? `Rotation ${rot}°` : mir ? 'Mirror ' + MIRRORS[p.mirror].toLowerCase() : 'No change');
  } else if (node.type === 'element' || node.type === 'component') {
    const gone = p.name && !(node.type === 'element' ? ELEMENT_LIB.peek() : LIBRARY.peek())[p.name];
    el.innerHTML = p.snapshot ? NC.body.thumb(entryThumb(node.type, p.name, p.snapshot), gone ? `${p.name} is no longer in the library — drawn from the copy kept in this graph` : p.name) : NC.body.thumb('', 'Pick a saved ' + node.type);
  }
}
// The page a Grid card draws its grid in: the Canvas of the first Figure it feeds (a square page when there is none).
function gridCanvasOf(grid) {
  const e = ctl.model.edges.find(x => x.from.node === grid.id && x.to.port === 'grid');
  const fig = e && NC.findNode(ctl.model, e.to.node), cvn = fig && foundationOf(fig)[0], cv = cvn ? canvasOf(cvn.params || {}) : null;
  return cv && !cv.fit ? cv : canvasOf({ preset: 'Square 1:1', margin: 5 });
}
// The Canvas / Grid / Palette feeding a Figure (null where none is connected).
const degOf = v => { v = +v || 0; return v > 0 && v < 4 ? v * 90 : v; };   // a pose angle in degrees (graphs before Oct 9, 2026 stored 1–3 for 90–270°)
function foundationOf(fig) {
  const m = ctl ? ctl.model : null; if (!m) return [null, null, null];
  return ['canvas', 'grid', 'palette'].map(port => { const e = m.edges.find(w => w.to.node === fig.id && w.to.port === port); return e ? NC.findNode(m, e.from.node) : null; });
}
// Pin keeps a child's variation through New variations; New Figure from this = a sibling Figure of the parent, same
// wires (and the child's own inputs in place of the parent's), that variation fixed.
function variationAction(childId, act) {
  const child = NC.findNode(ctl.model, childId), node = child && sourceOf(child), fig = node && figOf(node), en = ctl.engine.get(childId); if (!node || !fig) return;
  const v = en && en.value && en.value.figure ? en.value.figure.variations[0] : null; if (!v || !v.spec) return;
  const p = node.params, id = fig.id;   // pins live on the Variations node; New Figure from this copies its Figure
  if (act === 'pin') {   // a pin keeps its slot (and, in a fan-out, belongs to its item)
    const keys = wantedChildren(node).map(k => k.item).filter(x => x != null);
    const same = q => q.slot === v.slot && sameItem(q.item, v.item, keys);
    const pins = (p.pins || []).filter(q => !same(q));
    if (!v.pinned) pins.push({ mode: v.spec.mode, seed: v.spec.seed, slot: v.slot, ...(v.item != null ? { item: v.item } : {}) });
    p.pins = pins; edited(node, true); ctl.select([childId]); return;
  }
  if (act === 'from') {   // one undo step
    const [copy] = ctl.duplicate([id], { noCommit: true }); const n = NC.findNode(ctl.model, copy), m = ctl.model;
    n.params.fixed = [].concat(fig.params.fixed || [], [{ ...v.spec, keep: { ...(p.keep || {}) } }]);
    if (v.item != null) { const at = String(v.item).indexOf(':'); n.params.onlyItem = { index: +String(v.item).slice(0, at), name: String(v.item).slice(at + 1) }; }   // a fan-out variation: that Set item only
    m.edges.filter(e => e.to.node === childId && e.to.port !== 'from').forEach(e => {   // the child's own inputs: they replace the parent's (Rules are added)
      if (e.to.port !== 'rules' && e.to.port !== 'content') m.edges.filter(w => w.to.node === copy && w.to.port === e.to.port).forEach(w => NC.removeEdge(m, w.id));
      if (e.to.port === 'content') m.edges.filter(w => w.to.node === copy && w.to.port === 'content').forEach(w => NC.removeEdge(m, w.id));
    });
    m.edges.filter(e => e.to.node === childId && e.to.port !== 'from').forEach(e => NC.addEdge(m, e.from, { node: copy, port: e.to.port }, true));
    syncChildren();
    ctl.touch(copy); ctl.refresh(); ctl.select([copy]); ctl.commit('new-figure-from'); save();
    announce(`New Figure from ${nodeLabel(child)}`);
  }
}

// ── Child Figures (Diego, Oct 8, 2026; from a Variations node since Oct 9): every variation is a node of its own — a
// child, in a column to the right of its Variations node, one under the other. Made and removed with the node's
// Variations (and the Set's items when Variations per item is on); a child can't be deleted alone. Its source = the
// Variations node wired into its From input; its parent = the Figure that node varies.
function figOf(vn, m) { m = m || ctl.model; const e = vn && m.edges.find(w => w.to.node === vn.id && w.to.port === 'figure'), f = e && NC.findNode(m, e.from.node); return f && f.type === 'figure' ? f : null; }
function variationsOf(figId, m) { m = m || ctl.model; return m.edges.filter(e => e.from.node === figId && e.to.port === 'figure').map(e => NC.findNode(m, e.to.node)).filter(n => n && n.type === 'variations'); }
function wantedChildren(vn) {   // [{slot, item}] — what the Variations node draws, its Figure's own "As set up" left out
  const p = vn.params || {}, m = ctl.model, want = Math.max(0, Math.min(12, +p.variations || 0)) + 1, fig = figOf(vn, m);   // the count = variations made (O-58 a); slot 0 = the Figure itself
  if (!fig) return [];
  const set = m.edges.filter(e => e.to.node === fig.id && e.to.port === 'content').map(e => NC.findNode(m, e.from.node)).find(n => n && n.type === 'set');
  const items = set ? ((set.params || {}).items || []).filter(x => x && x.snapshot) : [];
  const out = [];
  if (!items.length || p.fanOut === false || (fig.params || {}).onlyItem) { for (let k = 1; k < want; k++) out.push({ slot: k, item: null }); return out; }
  const per = Math.max(1, Math.min(want, Math.floor(FIGURE_RENDER_CAP / items.length)));
  items.slice(0, FIGURE_RENDER_CAP).forEach((it, gi) => { for (let k = 0; k < per; k++) if (gi || k) out.push({ slot: k, item: gi + ':' + it.name }); });
  return out;
}
function sourceOf(child, m) {   // the Variations node a child hangs from
  m = m || ctl.model;
  const e = m.edges.find(w => w.to.node === child.id && w.to.port === 'from'), src = e && NC.findNode(m, e.from.node);
  return src && src.type === 'variations' ? src : null;
}
function parentNode(child, m) { m = m || ctl.model; return figOf(sourceOf(child, m), m); }   // the Figure a child is a variation of
function childrenOf(vnId) {   // in the order the Variations node draws them
  const vn = NC.findNode(ctl.model, vnId); if (!vn) return [];
  const order = wantedChildren(vn).map(k => childKey(k.slot, k.item));
  return ctl.model.nodes.filter(n => n.type === 'figure-var' && (sourceOf(n) || {}).id === vnId)
    .sort((a, b) => order.indexOf(childKey(a.params.slot, a.params.item)) - order.indexOf(childKey(b.params.slot, b.params.item)));
}
let syncing = false;
function syncChildren() {   // → true when the graph changed
  if (syncing || !ctl) return false;
  syncing = true;
  const m = ctl.model; let changed = false;
  const drop = n => { NC.removeNode(m, n.id); ctl.engine.forget(n.id); changed = true; };
  m.nodes.filter(n => n.type === 'figure-var').forEach(n => {   // each child: its parent by its wire, else the one it remembers
    const into = m.edges.filter(w => w.to.node === n.id && w.to.port === 'from');
    let par = sourceOf(n);
    into.filter(w => !par || w.from.node !== par.id).forEach(w => { NC.removeEdge(m, w.id); changed = true; });   // only a Variations node can be its source
    if (!par) { const q = NC.findNode(m, n.params.parent); if (q && q.type === 'variations') { NC.addEdge(m, { node: q.id, port: 'figure' }, { node: n.id, port: 'from' }, true); par = q; changed = true; } }
    if (!par) { drop(n); return; }
    if (n.params.parent !== par.id) { n.params.parent = par.id; changed = true; }
  });
  m.nodes.filter(n => n.type === 'variations').forEach(fig => {
    const want = wantedChildren(fig), keys = want.map(k => childKey(k.slot, k.item)), have = new Map();
    m.nodes.filter(n => n.type === 'figure-var' && n.params.parent === fig.id).forEach(n => {
      const k = childKey(n.params.slot, n.params.item);
      if (!keys.includes(k) || have.has(k)) drop(n); else have.set(k, n);   // no longer drawn, or a second copy of one
    });
    want.forEach(k => {
      if (have.has(childKey(k.slot, k.item))) return;
      const n = NC.addNode(m, { type: 'figure-var', x: fig.x, y: fig.y, params: { ...registry.defaults('figure-var'), auto: true, parent: fig.id, slot: k.slot, item: k.item } });
      NC.addEdge(m, { node: fig.id, port: 'figure' }, { node: n.id, port: 'from' }, true); changed = true;
    });
  });
  syncing = false;
  if (changed) { ctl.refresh(); m.nodes.filter(n => n.type === 'variations').forEach(f => restackChildren(f.id, true)); }
  return changed;
}
function restackAll() { ctl.model.nodes.filter(n => n.type === 'variations').forEach(v => { childrenOf(v.id).forEach(c => { c.params.auto = true; }); restackChildren(v.id, true); }); }
// After every change: the children follow their Figure (one undo step with the change that made them); a child moved
// by hand stays where it was put, a Figure moved by hand takes its placed children along.
function childrenAfter(reason) {
  if (reason === 'move') {
    ctl.selection().map(id => NC.findNode(ctl.model, id)).filter(Boolean).forEach(n => { if (n.type === 'figure-var') delete n.params.auto; else if (n.type === 'variations') restackChildren(n.id); });
    return;
  }
  if (reason === 'history' || reason === 'sync' || syncing) return;
  queueMicrotask(() => { if (syncChildren()) ctl.commit('sync', { amend: true }); });
}
// The children placed by their Figure (not yet moved by hand) stand in a column to its right, one under the other.
function restackChildren(figId, force) {
  const fig = NC.findNode(ctl.model, figId); if (!fig) return;
  const fc = ctl.cardOf(figId), x = fig.x + ((fc && fc.offsetWidth) || 200) + LABEL_ROOM;
  let y = fig.y, moved = false;
  // nodes that are not this Figure's variations but sit in their column (an Export, a Palette…): the stack steps around them
  const kids = new Set(childrenOf(figId).map(n => n.id)), box = n => { const c = ctl.cardOf(n.id); return { x: n.x, y: n.y, w: (c && c.offsetWidth) || 224, h: (c && c.offsetHeight) || 120 }; };
  const others = ctl.model.nodes.filter(n => n.id !== figId && !kids.has(n.id)).map(box);
  const clear = (top, w, h) => { let t = top, hit; do { hit = others.find(o => o.x < x + w && o.x + o.w > x && o.y < t + h + 24 && o.y + o.h + 24 > t); if (hit) t = hit.y + hit.h + 24; } while (hit); return t; };
  childrenOf(figId).forEach(n => {
    const c = ctl.cardOf(n.id), h = (c && c.offsetHeight) || 280;
    if (n.params.auto) {
      y = clear(y, (c && c.offsetWidth) || 416, h);
      if (n.x !== x || n.y !== y) { n.x = x; n.y = y; moved = true; if (c) c.style.transform = `translate(${x}px,${y}px)`; }
    }
    y = (n.params.auto ? y : Math.max(y, n.y)) + h + 24;
  });
  if (moved || force) { childrenOf(figId).forEach(n => ctl.remeasure(n.id)); save(); }
}
const announce = t => { const l = document.querySelector('#fg-graph .nc-live'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); } };
function fitFrame(f) {   // fit the view to a section
  const r = ctrl('fg-graph').getBoundingClientRect(), pad = 48, L = 88, B = 72, W = r.width - L, H = r.height - B;
  const z = Math.min(1.5, Math.max(0.1, Math.min((W - pad * 2) / f.w, (H - pad * 2) / (f.h + 40))));
  ctl.zoomPan.setView({ zoom: z, panX: L + (W - f.w * z) / 2 - f.x * z, panY: (H - f.h * z) / 2 - f.y * z + 20 });
}
const newSeed = () => 1 + Math.floor(Math.random() * 99999);
// A Variations node for a Figure, to its right (the Figure panel's Add Variations) — one undo step with its children.
function addVariations(figId) {
  const fig = NC.findNode(ctl.model, figId); if (!fig) return;
  const fc = ctl.cardOf(figId), vn = NC.addNode(ctl.model, { type: 'variations', name: nextName(ctl.model, 'variations'), x: fig.x + ((fc && fc.offsetWidth) || 416) + LABEL_ROOM, y: fig.y, params: { ...registry.defaults('variations'), seed: newSeed() } });
  NC.addEdge(ctl.model, { node: fig.id, port: 'figure' }, { node: vn.id, port: 'figure' });
  syncChildren(); ctl.touch(vn.id); ctl.refresh(); ctl.select([vn.id]); ctl.commit('variations'); save();
}   // a Figure's own seed — so two Figures don't show the same changes
// ── Export (Phase 6) ──
function figuresInto(exp) {   // the Figures wired into an Export node: { name, figure }
  return ctl.model.edges.filter(e => e.to.node === exp.id && e.to.port === 'figures').map(e => {
    const src = NC.findNode(ctl.model, e.from.node), en = ctl.engine.get(e.from.node);
    const f = en && (en.state === 'ok' || en.state === 'stale') && en.value ? en.value.figure : null;   // off screen = stale, still exported (kept active below)
    return src ? { name: nodeLabel(src.type === 'variations' && figOf(src) ? figOf(src) : src), figure: src.type === 'variations' && f ? withChildren(src, f) : f } : null;
  }).filter(Boolean);
}
function withChildren(fig, f) {   // a Figure's variations as its children draw them (a child's own inputs change its drawing)
  const kids = new Map(childrenOf(fig.id).map(n => [childKey(n.params.slot, n.params.item), n]));
  return { ...f, variations: (f.variations || []).map(v => {
    const n = kids.get(childKey(v.slot, v.item)), en = n && ctl.engine.get(n.id), cf = en && (en.state === 'ok' || en.state === 'stale') && en.value ? en.value.figure : null;
    return cf ? { ...v, svg: cf.svg } : v;
  }) };
}
function exportFiles(exp) { return exportPlan(figuresInto(exp), exp.params); }
function printWrap(svg, cv, paper, plate) {   // a Print Canvas: its own size in mm, bleed (paper extended), crop marks; plates add registration marks
  const m = svg.match(/^<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/), W = m ? +m[1] : 1000;
  const mm = v => v * (cv.unit === 'in' ? 25.4 : 1), tw = mm(cv.pw), th = mm(cv.ph), b = cv.bleed || 0, bw = tw + 2 * b, bh = th + 2 * b, r = v => Math.round(v * 100) / 100;
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${r(bw)}mm" height="${r(bh)}mm" viewBox="0 0 ${r(bw)} ${r(bh)}">`;
  if (paper && paper !== 'none') out += `<rect width="100%" height="100%" fill="${paper}"/>`;
  out += `<g transform="translate(${r(b)},${r(b)})"><g transform="scale(${tw / W})">${inner}</g>`;
  if (b > 0) out += Organica.printSize.cropMarksSVG(tw, th, {}, '#000');
  if (plate && b > 0) out += Organica.printSize.registrationMarksSVG(tw, th, { bleed: b }, '#000');
  return out + '</g></svg>';
}
export async function encodeFile(f) {   // exported for scripts/test-figure-graph.sh
  const noPaper = s => s.replace(new RegExp(`<rect width="[\\d.]+" height="[\\d.]+" fill="${f.figPaper}"/>`, 'i'), '');
  let svg = f.plate != null ? plateSVG(f.svg, f.colors, f.plate, f.figPaper) : f.paper === 'none' ? noPaper(f.svg) : f.svg;
  const doc = f.print ? printWrap(svg, f.canvas, f.plate != null ? 'none' : f.paper, f.plate != null) : svg;
  if (f.format === 'svg') return new Blob([doc], { type: 'image/svg+xml' });
  const m = svg.match(/^<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/), W = m ? +m[1] : 1000, H = m ? +m[2] : 1000;
  let outW = Math.round(W * f.scale), outH = Math.round(H * f.scale), dpi = null;
  if (f.print) { const cv = f.canvas, mm = v => v * (cv.unit === 'in' ? 25.4 : 1), b = cv.bleed || 0; dpi = cv.dpi; outW = Math.round(Organica.printSize.mmToPx(mm(cv.pw) + 2 * b, dpi)); outH = Math.round(Organica.printSize.mmToPx(mm(cv.ph) + 2 * b, dpi)); }
  const sized = doc.replace(/^<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, `<svg$1 width="${outW}" height="${outH}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('SVG raster failed')); im.src = url; });
    const cv = document.createElement('canvas'); cv.width = outW; cv.height = outH; cv.getContext('2d').drawImage(img, 0, 0, outW, outH);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return dpi ? new Blob([Organica.printSize.embedPngDpi(await blob.arrayBuffer(), dpi)], { type: 'image/png' }) : blob;
  } finally { URL.revokeObjectURL(url); }
}
function fileName(f) { return Organica.stamp(`fvs-${f.tag}${f.plate != null ? '-plate' + (f.plate + 1) + '-' + String(f.ink).slice(1) : ''}${f.format === 'png' && f.scale > 1 ? '@' + f.scale + 'x' : ''}`, f.format); }
function runExport(id) {
  const exp = NC.findNode(ctl.model, id); if (!exp) return;
  const files = exportFiles(exp); if (!files.length) { Organica.notice('Nothing to export — connect a Figure and pick a format'); return; }
  Organica.plateExport.run(files.length, { build: async i => ({ blob: await encodeFile(files[i]), filename: fileName(files[i]) }), onDone: () => Organica.notice(`${files.length} ${files.length === 1 ? 'file' : 'files'} exported`) });
}
// The floatbar Export in the Figure step: the one export path — create (or select) the Export node, wired to the
// selected Figures (or every Figure), and show its settings.
function exportFromFloatbar() {
  const m = ctl.model, sel = ctl.selection().map(i => NC.findNode(m, i)).filter(n => n && (n.type === 'figure' || n.type === 'figure-var' || n.type === 'variations'));   // a child goes on its own
  let exp = m.nodes.find(n => n.type === 'export');
  if (!exp) {
    const figs = sel.length ? sel : m.nodes.filter(n => n.type === 'figure');
    const cols = figs.concat(...figs.map(f => (f.type === 'figure' ? variationsOf(f.id) : f.type === 'variations' ? [f] : []).flatMap(v => [v, ...childrenOf(v.id)])));   // past the variations' column too
    const right = cols.reduce((a, n) => Math.max(a, n.x + (ctl.cardOf(n.id) ? ctl.cardOf(n.id).offsetWidth : 420)), 0), top = figs.length ? Math.min(...figs.map(n => n.y)) : 40;
    exp = NC.addNode(m, { type: 'export', x: right + LABEL_ROOM, y: top, params: registry.defaults('export'), name: 'Export' });
    figs.forEach(f => NC.addEdge(m, { node: f.id, port: 'figure' }, { node: exp.id, port: 'figures' }, true));
    ctl.touch(exp.id); ctl.refresh(); ctl.commit('export'); save();
  } else sel.forEach(f => { if (!m.edges.some(e => e.from.node === f.id && e.to.node === exp.id)) { NC.addEdge(m, { node: f.id, port: 'figure' }, { node: exp.id, port: 'figures' }, true); ctl.touch(exp.id); ctl.commit('export'); } });
  ctl.refresh(); ctl.select([exp.id]); ctl.fitTo([exp.id]); save();
}
function checksBadge(f) {
  const cs = f.checks || [], bad = cs.filter(c => !c.ok);
  return cs.length ? `<p class="fg-card__checks${bad.length ? ' is-bad' : ''}">${bad.length ? Organica.icons.get('alert', { size: 'xs' }) + ` ${bad.length} ${bad.length === 1 ? 'check' : 'checks'} to look at` : Organica.icons.get('check', { size: 'xs' }) + ' Checks pass'}</p>` : '';
}
function cardClass(node) {
  if (node.type === 'figure') return 'nc-node--wide';
  if (node.type === 'figure-var') return 'nc-node--wide';
  return 'nc-node--compact';
}
function variationNo(child) { const src = sourceOf(child); return src ? childrenOf(src.id).indexOf(child) + 1 : 1; }   // variation 1 … n (O-58 a: the count is the variations made)
function nodeLabel(node) {
  if (node.type === 'figure-var') {   // named after its Figure: Figure 1.2, Figure 1.3 … (the Figure itself is the first)
    const par = ctl && parentNode(node); if (!par) return registry.get(node.type).meta.label;
    const src = sourceOf(node), several = src && variationsOf(par.id).length > 1;   // a Figure with several Variations nodes: each child named after its own (O-58 b)
    return (several ? nodeLabel(src) : nodeLabel(par)) + ' · variation ' + variationNo(node);
  }
  return node.name || registry.get(node.type).meta.label;
}
// Rename a named node from the panel title (O-47): the name is a button; click / Enter / F2 → a field,
// Enter or leaving it keeps the name, Esc cancels. Two nodes of one type never share a name (Save Set saves by it).
function bindRename(node, ids) {
  const b = ctrl('fgi-rename'); if (!b) return;
  const start = () => {
    const old = nodeLabel(node), typeLabel = registry.get(node.type).meta.label;
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'panel-input fg-rename__input'; inp.value = old; inp.setAttribute('aria-label', typeLabel + ' name');
    b.replaceWith(inp); inp.focus(); inp.select();
    let over = false;
    const done = (ok, refocus = true) => {
      if (over) return; over = true;
      const v = inp.value.trim();
      if (ok && v && v !== old) {
        if (ctl.model.nodes.some(n => n !== node && n.type === node.type && nodeLabel(n) === v)) Organica.notice(`There is already a ${typeLabel} called “${v}”`);
        else { node.name = v; ctl.refresh(); ctl.commit('rename'); save(); }
      }
      renderInspector(ids); const again = refocus && ctrl('fgi-rename'); if (again) again.focus({ preventScroll: true });
    };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); done(false); } });
    inp.addEventListener('blur', () => done(true, false));
  };
  b.addEventListener('click', start);
  b.addEventListener('keydown', e => { if (e.key === 'F2') { e.preventDefault(); start(); } });
}
// A Figure always has a Canvas and a Grid: the one feeding it can't be deleted while it is that Figure's only one.
function protect(node, model, removing) {   // removing: the ids deleted together — a Figure going with its Canvas / Grid does not keep them
  if (node.type === 'figure-var') { const par = sourceOf(node, model); return par && !(removing || []).includes(par.id) ? (node.params.item != null ? `A variation goes with its Variations node — lower the count on ${nodeLabel(par)} or remove the item from the Set instead` : `A variation goes with its Variations node — lower the count on ${nodeLabel(par)} instead`) : null; }
  if (node.type !== 'canvas' && node.type !== 'grid') return null;
  const feeds = model.edges.some(e => e.from.node === node.id && !(removing || []).includes(e.to.node) && model.nodes.some(n => n.id === e.to.node && n.type === 'figure'));
  return feeds ? `A Figure needs a ${node.type === 'canvas' ? 'Canvas' : 'Grid'} — connect another one first` : null;
}

// ── adding nodes: a Figure comes with its Canvas + Grid (the last ones used, or new ones beside it) ──
function viewCentre() { const r = ctrl('fg-graph').getBoundingClientRect(); return freeSpot(ctl.toBoard(r.left + r.width / 2, r.top + r.height / 3)); }
function freeSpot(at) {   // the nearest place below / beside `at` that no card covers
  const boxes = ctl.model.nodes.map(n => { const c = ctl.cardOf(n.id); return { x: n.x, y: n.y, w: (c && c.offsetWidth) || 200, h: (c && c.offsetHeight) || 160 }; });   // 0 while the board is hidden (Compose): use a typical card
  const hit = p => boxes.some(b => p.x < b.x + b.w + LABEL_ROOM && p.x + 240 > b.x - LABEL_ROOM && p.y < b.y + b.h + 24 && p.y + 140 > b.y - 24);
  for (let ring = 0; ring < 12; ring++) for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 1], [0, -1], [-1, 0]]) {
    const p = { x: Math.round(at.x + dx * ring * COL_STEP), y: Math.round(at.y + dy * ring * 120) }; if (!hit(p)) return p;
  }
  return at;
}
// Where a new Composition goes: the column just left of its Figure (where its inputs sit), under the lowest card there.
function composeSpot(fig) {
  const col = ctl.model.nodes.filter(n => n.id !== fig.id && n.x < fig.x && n.x > fig.x - COL_STEP - 60);
  const y = col.reduce((m, n) => { const c = ctl.cardOf(n.id); return Math.max(m, n.y + ((c && c.offsetHeight) || 160) + 24); }, fig.y);
  return { x: fig.x - COL_STEP, y };
}
function centred(at, type) { const w = type === 'figure' ? 416 : type === 'canvas' || type === 'grid' || type === 'palette' ? 160 : 160; return { x: Math.round(at.x - w / 2), y: Math.round(at.y - 24) }; }
function addNode(type, at, params) {
  at = at || viewCentre();
  const named = t => ({ name: t === type && params && params.__name ? params.__name : nameFor(ctl.model, t, t === type ? params : null) });
  if (params && params.__name) { params = { ...params }; delete params.__name; }
  if (type !== 'figure') return ctl.add(type, at, params, named(type));
  const last = t => { const sel = ctl.selection().map(id => NC.findNode(ctl.model, id)).filter(n => n && n.type === t); return sel[0] || ctl.model.nodes.filter(n => n.type === t).slice(-1)[0]; };
  const fig = ctl.add('figure', at, { seed: newSeed(), ...(params || {}) }, named('figure'));
  let cv = last('canvas'), gr = last('grid');
  if (!cv) cv = ctl.add('canvas', { x: at.x - COL_STEP, y: at.y }, null, named('canvas'));
  if (!gr) gr = ctl.add('grid', { x: at.x - COL_STEP, y: at.y + 150 }, null, named('grid'));
  ctl.connect({ node: cv.id, port: 'canvas' }, { node: fig.id, port: 'canvas' });
  ctl.connect({ node: gr.id, port: 'grid' }, { node: fig.id, port: 'grid' });
  ctl.select([fig.id]);
  return fig;
}
function addContent(kind, name) {
  const all = kind === 'element' ? ELEMENT_LIB.read() : LIBRARY.read();
  return { type: kind, params: { name, snapshot: entrySnapshot(all[name]) } };
}

// ── node bar (left dock) — Organica.nodeCanvas.nodeBar; this file fills the panel and adds what is dropped ──
let nodebar = null, openCat = null;
function nodebarItems(cat) {
  const types = (registry.byCategory()[cat] || []).filter(t => t.meta.id !== 'element' && t.meta.id !== 'component' && !t.meta.hidden);
  const items = types.map(t => ({ label: t.meta.id === 'set' ? 'New Set' : t.meta.label, meta: t.meta, make: () => ({ type: t.meta.id }) }));
  return items;
}
function renderNodebar(cat, panel) {
  openCat = cat;
  if (composing && cat !== 'Content') cat = 'Content';
  let html = '';   // no hint line: drag or click is the bar's own gesture (Diego, Oct 9, 2026)
  const items = composing ? [] : nodebarItems(cat);
  if (items.length) html += `<div class="nc-nodebar__list">${items.map((it, i) => (it.meta.icon || it.meta.barIcon)   // offered as a tile: icon over name (Diego, Oct 9, 2026)
    ? `<button type="button" class="nc-nodebar__item nc-nodebar__item--tile" data-i="${i}" aria-label="${it.label === 'New Set' ? 'New Set' : 'Add ' + esc(it.label)}">${NC.body.tile(it.meta, it.label)}</button>`
    : `<button type="button" class="nc-nodebar__item" data-i="${i}" aria-label="${it.label === 'New Set' ? 'New Set' : 'Add ' + esc(it.label)}">${esc(it.label)}</button>`).join('')}</div>`;
  if (composing) html = `<p class="nc-nodebar__hint">Drop on a cell, or click to give it to the selected cells</p>`;
  if (cat === 'Content') {
    const s = savedEntries();
    const block = (kind, title, list, step) => `<div class="sub-label">${title}</div>` + (list.length
      ? `<div class="fvs-rail__grid">${list.map(e => `<button type="button" class="fvs-library-item fg-nodebar__tile" data-kind="${kind}" data-name="${esc(e.name)}" aria-label="Add ${kind === 'element' ? 'Element' : 'Component'}: ${esc(e.name)}">${entryThumb(kind, e.name, e.entry)}</button>`).join('')}</div>`
      : `<p class="nc-nodebar__empty">Nothing saved yet — save ${kind === 'element' ? 'an Element in the Element' : 'a Component in the Component'} step first.</p>`);
    html += block('element', 'Elements', s.element) + block('component', 'Components', s.component);
    const sets = Object.keys(SETS.read()).sort((a, b) => a.localeCompare(b));
    if (!composing) html += `<div class="sub-label">Saved Sets</div>` + (sets.length ? `<div class="nc-nodebar__list">${sets.map(n => `<button type="button" class="nc-nodebar__item fg-nodebar__set" data-set="${esc(n)}" aria-label="Add Set: ${esc(n)}">${esc(n)}</button>`).join('')}</div>` : `<p class="nc-nodebar__empty">No Sets yet — New Set makes one</p>`);
  }
  panel.innerHTML = html;
  panel._items = items;
}
function setNodebar(cat) { if (nodebar) nodebar.open(cat); openCat = nodebar ? nodebar.current() : null; }
function nodebarSpec(target) {
  const item = target.closest('.nc-nodebar__item'), tile = target.closest('.fg-nodebar__tile');
  if (item && item.dataset.set) { const e = SETS.read()[item.dataset.set]; return e ? { type: 'set', params: { items: JSON.parse(JSON.stringify(e.items || [])) }, name: item.dataset.set } : null; }
  if (item) return ctrl('fg-nodebar-panel')._items[+item.dataset.i].make();
  if (tile) return addContent(tile.dataset.kind, tile.dataset.name);
  return null;
}
function initNodebar() {
  nodebar = NC.nodeBar({
    bar: ctrl('fg-nodebar'), panel: ctrl('fg-nodebar-panel'), stage: ctrl('fg-graph'), icons: ICON,
    render: renderNodebar, specOf: nodebarSpec,
    onAdd: (spec, ev, over) => {
      const params = spec.name ? { ...spec.params, __name: spec.name } : spec.params;
      if (ev.type !== 'click') {   // a drop
        if (composing) { if (!composeDrop(spec, ev.clientX, ev.clientY)) Organica.notice('Drop it on a cell'); return; }
        if (over) addNode(spec.type, centred(ctl.toBoard(ev.clientX, ev.clientY), spec.type), params);
      } else if (composing) {   // a click while composing: give the item to the selected cells
        if (spec.type === 'element' || spec.type === 'component') addComposeRule({ content: { kind: spec.type, name: spec.params.name, entry: spec.params.snapshot } });
      } else addNode(spec.type, null, params);   // a click: add at the view centre
    },
  });
  ctrl('fg-nodebar').addEventListener('click', () => { openCat = nodebar.current(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openCat && state.activeTier === 'figure') setNodebar(null); });
}

// ── inspector (right panel) ──
function edited(node, commit) {
  ctl.touch(node.id); if (commit) ctl.commit('params'); save();
  if (commit && ['canvas', 'grid', 'palette'].includes(node.type)) {
    const figs = ctl.model.edges.filter(e => e.from.node === node.id).map(e => e.to.node).filter(id => { const n = NC.findNode(ctl.model, id); return n && n.type === 'figure'; });
    setTimeout(() => ctl.pulse(figs), 60);
  }
}
function rangeRow(label, id, min, max, step, value, onInput, unit = '') {
  return { html: `<div class="ctrl-row"><div class="ctrl-label">${esc(label)}</div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}"><span class="ctrl-val" id="v-${id}">${value}${unit}</span></div>`,
    bind: () => { const r = ctrl(id); r.addEventListener('input', () => { ctrl('v-' + id).textContent = r.value + unit; onInput(+r.value, false); }); r.addEventListener('change', () => onInput(+r.value, true)); } };
}
function selectRow(label, id, options, value, onChange) {
  return { html: `<div class="ctrl-row"><div class="ctrl-label">${esc(label)}</div><select class="panel-select" id="${id}" aria-label="${esc(label)}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`,
    bind: () => { ctrl(id).addEventListener('change', e => onChange(e.target.value)); } };
}
function numberRow(label, id, value, onChange, attrs) {
  return { html: `<div class="ctrl-row"><div class="ctrl-label">${esc(label)}</div><input type="number" class="panel-input" id="${id}" value="${esc(value)}" aria-label="${esc(label)}" ${attrs || ''}></div>`,
    bind: () => { ctrl(id).addEventListener('change', e => onChange(e.target.value)); } };
}
// A rebuild keeps the focused control (by id, else by its data-* attributes) — as Compose's panel does.
function focusKey(el) {
  if (el.id) return '#' + CSS.escape(el.id);
  const ds = Object.entries(el.dataset || {}); if (!ds.length) return null;
  return el.tagName.toLowerCase() + ds.map(([k, v]) => `[data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${CSS.escape(v)}"]`).join('');
}
let panelAbort = null;
const panelSignal = () => (panelAbort = panelAbort || new AbortController()).signal;
function renderInspector(ids) {
  const box = ctrl('fg-inspector');
  if (!box) return;
  const a = document.activeElement, key = a && a !== box && box.contains(a) ? focusKey(a) : null;
  if (panelAbort) panelAbort.abort(); panelAbort = null;   // listeners a previous panel left on the page (a format picker)
  renderInspectorBody(box, ids);
  if (key) { const el = box.querySelector(key); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}
// A Grid's cell count (audit #12): what a Figure it feeds drew (a generator's cells are only known once generated).
function gridCells(grid) {
  const fig = ctl.model.edges.filter(e => e.from.node === grid.id && e.to.port === 'grid').map(e => figureValue(e.to.node)).find(Boolean);
  return fig ? fig.cells : 0;
}
// A node's one-line summary for its panel title (the card shows the same): as E/C/S's h3 hints
function nodeMeta(node) {
  const p = node.params || {}, n = k => k.length;
  switch (node.type) {
    case 'canvas': return canvasSummary(canvasOf(p));
    case 'grid': { const k = gridCells(node); return gridSummary({ gen: p.gen, params: p.params }) + (k ? ` · ${k} ${k === 1 ? 'cell' : 'cells'}` : ''); }
    case 'palette': { const k = (p.colors || []).length; return k + (k === 1 ? ' ink' : ' inks'); }
    case 'set': return n(p.items || []) + ((p.items || []).length === 1 ? ' item' : ' items');
    case 'cell-rules': return n(p.rules || []) + ((p.rules || []).length === 1 ? ' rule' : ' rules');
    case 'composition': return n(p.rules || []) + ((p.rules || []).length === 1 ? ' region rule' : ' region rules');
    case 'export': return exportSummary(exportFiles(node), p);
    default: return '';
  }
}
function renderInspectorBody(box, ids) {
  const nodes = ids.map(id => NC.findNode(ctl.model, id)).filter(Boolean);
  if (!nodes.length) {
    const m = ctl.model, figs = m.nodes.filter(n => n.type === 'figure').length;
    box.innerHTML = `<div class="panel-section"><h3>Graph <span class="hint">${figs} ${figs === 1 ? 'Figure' : 'Figures'} · ${m.nodes.length} ${m.nodes.length === 1 ? 'node' : 'nodes'}</span></h3>
      ${m.nodes.length ? '' : '<p class="org-empty">This graph is empty. Add a Figure and some saved content, or start from a built-in Figure with New Figure…</p>'}
      ${figs ? `<div class="sub-label">Figures</div><div class="fg-figlist">${m.nodes.filter(n => n.type === 'figure').map(n => `<button type="button" class="fg-figlist__item" data-id="${n.id}" aria-label="Show ${esc(nodeLabel(n))} — ${foundationOf(n).map(x => x ? esc(nodeLabel(x)) : 'none').join(' · ')}">${esc(nodeLabel(n))}<span class="fg-figlist__hint">${foundationOf(n).map(x => x ? esc(nodeLabel(x)) : '—').join(' · ')}</span></button>`).join('')}</div>` : ''}
      ${(m.frames || []).length ? `<div class="sub-label">Sections</div><div class="fg-figlist">${m.frames.map(f => `<button type="button" class="fg-figlist__item" data-frame="${f.id}">${esc(f.name)}</button>`).join('')}</div>` : ''}
      ${m.nodes.length ? '<div class="row-btns"><button type="button" class="mini-btn" id="fgi-add-section" aria-keyshortcuts="Meta+G Control+G">Add section</button></div>' : ''}
      <p class="org-panel__hint">Add nodes from the bar on the left, or press / to search. Drag from a port to connect; drop the connection on a node to use its first free input.</p></div>`;
    box.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => ctl.fitTo([b.dataset.id])));
    box.querySelectorAll('[data-frame]').forEach(b => b.addEventListener('click', () => { const f = m.frames.find(x => x.id === b.dataset.frame); if (f) ctl.zoomPan && fitFrame(f); }));
    const add = ctrl('fgi-add-section'); if (add) add.addEventListener('click', () => { ctl.addSection([]); save(); renderInspector([]); });
    return;
  }
  if (nodes.length > 1) {
    box.innerHTML = `<div class="panel-section"><h3>${nodes.length} nodes selected</h3><div class="row-btns"><button type="button" class="mini-btn" id="fgi-add-section" aria-keyshortcuts="Meta+G Control+G">Add section</button><button type="button" class="mini-btn" id="fgi-dup">Duplicate</button></div></div>`;
    ctrl('fgi-add-section').addEventListener('click', () => { ctl.addSection(ids); save(); });
    ctrl('fgi-dup').addEventListener('click', () => { ctl.duplicate(ids); save(); });
    return;
  }
  const node = nodes[0], p = node.params, rows = [];
  const meta = nodeMeta(node), typeLabel = registry.get(node.type).meta.label, name = nodeLabel(node);
  const renameable = NUMBERED.includes(node.type);   // the named, shared nodes rename in place from the title (O-47)
  const title = `<div class="panel-section"><h3>${esc(typeLabel)} <span class="hint">${renameable ? `<button type="button" class="fg-rename" id="fgi-rename" aria-label="Rename ${esc(name)}" aria-keyshortcuts="F2">${esc(name)}</button>${meta ? ' · ' + esc(meta) : ''}` : esc([name !== typeLabel ? name : '', meta].filter(Boolean).join(' · '))}</span></h3>`;   // the concept, then the node's name + a one-line summary
  const why = protect(node, ctl.model);
  if (node.type === 'canvas') {
    // The Symbol step's own Canvas section (fvs/index.html #sym-canvas-section) — same controls, same ranges (G4).
    const cv = canvasOf(p), print = p.mode === 'print', fit = p.preset === FIT_PRESET;
    const cur = fit ? FIT_PRESET : SYMCANVAS_PRESETS[p.preset] ? p.preset : 'Custom';
    rows.push({ html: `<div class="ctrl-row"><div id="fgi-preset-picker"></div><select class="panel-select fg-grow" id="fgi-preset" aria-label="Canvas format">${[FIT_PRESET, ...Object.keys(SYMCANVAS_PRESETS), 'Custom'].map(n => `<option value="${esc(n)}"${n === cur ? ' selected' : ''}>${esc(n === FIT_PRESET ? FIT_LABEL : n)}</option>`).join('')}</select></div>
      ${fit ? '<p class="org-panel__hint">A Figure on a lattice takes its size from its cells. On a Loom grid it uses a square page.</p>' : `
      <div class="ctrl-row"><div class="seg-ctrl" id="fgi-mode" role="group" aria-label="Canvas mode"><button class="seg-btn${print ? '' : ' active'}" data-mode="screen" aria-pressed="${!print}">Screen</button><button class="seg-btn${print ? ' active' : ''}" data-mode="print" aria-pressed="${print}">Print</button></div></div>
      <div class="ctrl-row"><span class="ctrl-label">Size</span><input type="number" class="panel-input fg-size" id="fgi-pw" min="1" step="1" value="${cv.pw}" aria-label="Size, width"><span class="hint">×</span><input type="number" class="panel-input fg-size" id="fgi-ph" min="1" step="1" value="${cv.ph}" aria-label="Size, height"><span class="hint">${esc(cv.unit)}</span></div>
      ${print ? `<div class="ctrl-row"><span class="ctrl-label">Unit</span><select class="panel-select" id="fgi-unit" aria-label="Canvas unit"><option value="mm"${cv.unit === 'mm' ? ' selected' : ''}>mm</option><option value="in"${cv.unit === 'in' ? ' selected' : ''}>in</option></select></div>
      <div class="ctrl-row"><span class="ctrl-label">DPI</span><input type="number" class="panel-input" id="fgi-dpi" min="72" max="2400" step="1" value="${cv.dpi}" aria-label="Canvas DPI"></div>
      <div class="ctrl-row"><span class="ctrl-label">Bleed (mm)</span><input type="number" class="panel-input" id="fgi-bleed" min="0" max="20" step="0.5" value="${cv.bleed}" aria-label="Bleed (mm)"></div>${cv.unit === 'in' ? '<p class="org-panel__hint">Bleed is always in millimetres.</p>' : ''}` : ''}`}`,
      bind: () => {
        const again = () => { edited(node, true); renderInspector(ids); };
        // the Symbol Canvas's thumbnail format picker (G4): each format at its aspect, Custom dashed
        Organica.selectPicker(ctrl('fgi-preset'), ctrl('fgi-preset-picker'), { ariaLabel: 'Canvas format', signal: panelSignal(), registry: Object.assign({ [FIT_PRESET]: { name: FIT_LABEL, icon: Organica.icons.get('fit-view') } }, Object.fromEntries(Object.entries(SYMCANVAS_PRESETS).map(([n, q]) => [n, { name: n, icon: Organica.aspectIcon(q.w, q.h) }])), { Custom: { name: 'Custom', icon: Organica.aspectIcon(1, 1, { dashed: true }) } }) });
        ctrl('fgi-preset').addEventListener('change', e => { p.preset = e.target.value; if (p.preset === 'Custom') { p.pw = cv.pw; p.ph = cv.ph; } again(); });
        if (fit) return;
        ctrl('fgi-mode').addEventListener('click', e => { const bt = e.target.closest('[data-mode]'); if (!bt || bt.dataset.mode === p.mode) return; p.mode = bt.dataset.mode; if (!SYMCANVAS_PRESETS[p.preset]) { const c2 = canvasOf({ ...p }); p.pw = c2.pw; p.ph = c2.ph; } again(); });
        const size = () => { p.preset = 'Custom'; p.pw = +ctrl('fgi-pw').value || 1; p.ph = +ctrl('fgi-ph').value || 1; again(); };
        ctrl('fgi-pw').addEventListener('change', size); ctrl('fgi-ph').addEventListener('change', size);
        if (print) {
          ctrl('fgi-unit').addEventListener('change', e => { p.unit = e.target.value; again(); });
          ctrl('fgi-dpi').addEventListener('change', e => { p.dpi = Math.min(2400, Math.max(72, +e.target.value || 300)); edited(node, true); });
          ctrl('fgi-bleed').addEventListener('change', e => { p.bleed = Math.min(20, Math.max(0, +e.target.value || 0)); edited(node, true); });
        }
      } });
    if (!fit) rows.push(rangeRow('Margin', 'fgi-margin', 0, 25, 1, Math.min(25, p.margin), (v, c) => { p.margin = v; edited(node, c); }, '%'));
  } else if (node.type === 'grid') {
    rows.push({ html: `<div class="ctrl-row"><select class="panel-select fg-grow" id="fgi-gen" aria-label="Grid generator">
        <optgroup label="Loom grids — inside the Canvas">${Object.entries(SYMGRID_GENS).map(([k, g]) => `<option value="${k}"${k === p.gen ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}</optgroup>
        <optgroup label="Lattices — sized by their cells">${Object.entries(FIGURE_LATTICES).map(([k, g]) => `<option value="${k}"${k === p.gen ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}</optgroup></select></div>`,
      bind: () => ctrl('fgi-gen').addEventListener('change', e => { p.gen = e.target.value; p.params = gridDefaults(p.gen); edited(node, true); renderInspector(ids); }) });
    gridSpec(p.gen).params.forEach(([k, label, a, b, step, def]) => {
      if (a === 'text') return;
      const val = p.params && p.params[k] != null ? p.params[k] : def;
      rows.push(rangeRow(label, 'fgi-g-' + k, a, b, step, val, (v, c) => { p.params = { ...(p.params || {}), [k]: v }; edited(node, c); }));
      if (k === 'rings') rows.push({ html: '<p class="org-panel__hint">Cells along each side.</p>' });
    });
  } else if (node.type === 'palette') {
    rows.push({ html: `<div id="fgi-inks" class="rmx-palette"></div>
      <div class="color-row"><span class="color-name">Paper</span><span class="color-swatch-wrap"><button class="color-swatch" id="sw-fgi-paper" style="background:${esc(p.paper)}"></button><input type="color" id="cp-fgi-paper" value="${esc(p.paper)}"></span><input class="color-hex" id="hex-fgi-paper" value="${esc(p.paper)}" maxlength="7"><button type="button" class="icon-btn" id="fgi-paper-clear" aria-pressed="${!!p.transparent}" aria-label="Transparent paper">${Organica.icons.get('fvs-transparent', { size: 'sm' })}</button></div>
      <div id="fgi-pattern-block"${p.pattern ? '' : ' hidden'}>${paperPatternRows(p)}</div>`,
      bind: () => {
        // the strip's own Pick from a palette (as the Palette section); Start at follows the inks without a rebuild
        Organica.palette.swatch(ctrl('fgi-inks'), { colors: p.colors, min: 1, max: 8, onChange: colors => { p.colors = colors.slice(); delete p.source; edited(node, true); syncStartAt(); syncPatternInks(); } });
        // Paper = colour + texture (O-45): the shared Palette's Pattern icon shows the pattern settings, as the Palette section does
        Organica.palette.swatch('fgi-paper', { onChange: hex => { if (hex === p.paper) return; p.paper = hex; edited(node, true); },
          pattern: { panel: ctrl('fgi-pattern-block'), on: !!p.pattern, onToggle: on => { if (on) p.pattern = { ...PAPER_PATTERN_DEFAULT, ...(p.lastPattern || {}) }; else delete p.pattern; edited(node, true); renderInspector(ids); } } });
        ctrl('fgi-paper-clear').addEventListener('click', e => { p.transparent = !p.transparent; e.currentTarget.setAttribute('aria-pressed', String(p.transparent)); edited(node, true); });
        const syncPatternInks = () => { const s = ctrl('fgi-pat-ink'); if (s) { const cur = (p.pattern || {}).ink || 0; s.innerHTML = (p.colors || []).map((c, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>Ink ${i + 1} · ${esc(c)}</option>`).join(''); } };
        if (p.pattern) {
          const set = (k, v, commit) => { p.pattern = { ...p.pattern, [k]: v }; p.lastPattern = p.pattern; edited(node, commit); };
          ctrl('fgi-pat-type').addEventListener('change', e => { set('patType', e.target.value, true); renderInspector(ids); });   // Concentric has no Angle
          ctrl('fgi-pat-ink').addEventListener('change', e => set('ink', +e.target.value, true));
          [['spacing', 'patSpacing'], ['weight', 'patWeight'], ['angle', 'patAngle']].forEach(([id, k]) => { const r = ctrl('fgi-pat-' + id); r.addEventListener('input', () => { ctrl('v-fgi-pat-' + id).textContent = r.value; set(k, +r.value, false); }); r.addEventListener('change', () => set(k, +r.value, true)); });
        }
      } });
    const shownMode = (p.rule || {}).mode === 'own' ? 'index' : ((p.rule || {}).mode || 'index');   // a built-in's stored 'own' draws like By cell order (kept as stored: byte-identical)
    const syncStartAt = () => { const off = ctrl('fgi-roff'), n = (p.colors || []).length; if (!off) return; off.innerHTML = p.colors.map((c, i) => `<option value="${i}">Colour ${i + 1}</option>`).join(''); off.value = String(Math.min((p.rule || {}).offset || 0, Math.max(0, n - 1))); ctrl('fgi-roff-row').hidden = n < 2; };
    rows.push(selectRow('Colour by', 'fgi-rule', Object.entries(COLOR_RULES).filter(([k]) => k !== 'own').map(([k, r]) => [k, r.label]), shownMode, v => { p.rule = { ...(p.rule || {}), mode: v }; edited(node, true); }));   // "own colours" is Keep own colours on the Figure
    rows.push({ html: `<div class="ctrl-row" id="fgi-roff-row"${(p.colors || []).length > 1 ? '' : ' hidden'}><div class="ctrl-label">Start at</div><select class="panel-select" id="fgi-roff" aria-label="Start at"></select></div>`,   // as the Palette section
      bind: () => { syncStartAt(); ctrl('fgi-roff').addEventListener('change', e => { p.rule = { ...(p.rule || {}), offset: +e.target.value }; edited(node, true); }); } });
  } else if (node.type === 'element' || node.type === 'component') {
    const s = savedEntries()[node.type];
    rows.push({ html: s.length ? `<div class="sub-label">Saved ${node.type === 'element' ? 'Elements' : 'Components'}</div><div class="fvs-rail__grid" id="fgi-pick">${s.map(e => `<button type="button" class="fvs-library-item${e.name === p.name ? ' selected' : ''}" data-name="${esc(e.name)}" aria-label="${esc(e.name)}" aria-pressed="${e.name === p.name}">${entryThumb(node.type, e.name, e.entry)}</button>`).join('')}</div>`
      : `<p class="org-empty">Nothing saved yet — save ${node.type === 'element' ? 'an Element in the Element' : 'a Component in the Component'} step first.</p>`,
      bind: () => { const g = ctrl('fgi-pick'); if (g) g.addEventListener('click', e => { const b = e.target.closest('[data-name]'); if (!b) return; Object.assign(p, addContent(node.type, b.dataset.name).params); node.name = b.dataset.name; edited(node, true); ctl.refresh(); renderInspector(ids); ctl.paint(node.id); }); } });
  } else if (node.type === 'export') {
    const fm = p.formats || (p.formats = { svg: true }), sc = p.scales || (p.scales = [1]), files = exportFiles(node), n = files.length;
    const anyPrint = files.some(f => f.print);
    rows.push(selectRow('Variations', 'fgi-ex-which', [['all', 'All variations'], ['pinned', 'Pinned only'], ['base', 'As set up only']], p.which || 'all', v => { p.which = v; edited(node, true); renderInspector(ids); }));
    rows.push({ html: `<div class="sub-label">Format</div><div class="check-group">${[['svg', 'SVG'], ['png', 'PNG'], ['plates', 'Plates (one per ink)']].map(([k, l]) => `<label class="check-row"><input type="checkbox" data-fmt="${k}"${fm[k] ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
      ${fm.png ? `<div class="sub-label">Resolution</div><div class="check-group">${[1, 2, 4].map(k => `<label class="check-row"><input type="checkbox" data-scale="${k}"${sc.includes(k) ? ' checked' : ''}><span>×${k}</span></label>`).join('')}</div>${anyPrint ? '<p class="org-panel__hint">A Figure on a Print Canvas exports one PNG at its own size and DPI.</p>' : ''}` : ''}
      <label class="check-row"><input type="checkbox" id="fgi-ex-transparent"${p.transparent ? ' checked' : ''}><span>Transparent paper</span></label>
      <p class="org-panel__hint">${esc(exportSummary(files, p))}. A Print Canvas adds its bleed and crop marks; plates get registration marks.</p>
      <button type="button" class="panel-btn fg-block" id="fgi-ex-run"${n ? '' : ' disabled'}>Export ${n} ${n === 1 ? 'file' : 'files'}</button><div class="row-btns"><button type="button" class="mini-btn" id="fgi-ex-figma"${n ? '' : ' disabled'}>Send to Figma</button></div>
      <p class="org-panel__hint">Send to Figma sends the first file — plates stay in the download.</p>`,
      bind: () => {
        box.querySelectorAll('[data-fmt]').forEach(c => c.addEventListener('change', () => { p.formats = { ...p.formats, [c.dataset.fmt]: c.checked }; edited(node, true); renderInspector(ids); }));
        box.querySelectorAll('[data-scale]').forEach(c => c.addEventListener('change', () => { const k = +c.dataset.scale; p.scales = c.checked ? [...new Set([...(p.scales || []), k])] : (p.scales || []).filter(x => x !== k); edited(node, true); renderInspector(ids); }));
        ctrl('fgi-ex-transparent').addEventListener('change', e => { p.transparent = e.target.checked; edited(node, true); });
        ctrl('fgi-ex-run').addEventListener('click', () => runExport(node.id));
        ctrl('fgi-ex-figma').addEventListener('click', () => { const f = exportFiles(node).find(x => x.plate == null); if (f && Organica.sendToFigma) Organica.sendToFigma(f.svg); });
      } });
  } else if (node.type === 'set') {
    rows.push(setEditor(node, ids));
  } else if (node.type === 'cell-rules') {
    rows.push(cellRulesEditor(node, ids));
  } else if (node.type === 'component-rule') {
    const q = p.params || (p.params = {});
    rows.push(selectRow('Rule', 'fgi-crule', Object.entries(COMPONENT_RULES), p.rule, v => { p.rule = v; p.params = {}; edited(node, true); renderInspector(ids); }));
    if (p.rule === 'radial' || p.rule === 'pinwheel') {
      rows.push(selectRow('Starting rotation', 'fgi-cbase', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], degOf(q.base), v => { q.base = +v; edited(node, true); }));
      rows.push(selectRow('Direction', 'fgi-cchir', [[1, 'Clockwise'], [-1, 'Counter-clockwise']], q.chirality || 1, v => { q.chirality = +v; edited(node, true); }));
    } else if (p.rule === 'mirror') {
      rows.push(selectRow('Starting rotation', 'fgi-cseed', [[0, '0°'], [1, '90°'], [2, '180°'], [3, '270°']], q.seed || 0, v => { q.seed = +v; edited(node, true); }));
    } else if (p.rule === 'checkerboard') {
      rows.push(selectRow('Cells A', 'fgi-ca', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], degOf(q.a), v => { q.a = +v; edited(node, true); }));
      rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-cswap"${q.swap ? ' checked' : ''}><span>Swap A and B (start on B)</span></label>`, bind: () => ctrl('fgi-cswap').addEventListener('change', e => { q.swap = e.target.checked; edited(node, true); }) });
      if (!q.flip) rows.push(selectRow('Cells B', 'fgi-cb', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], degOf(q.b), v => { q.b = +v; edited(node, true); }));
      rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-cflip"${q.flip ? ' checked' : ''}><span>Flip B instead of rotate</span></label>`, bind: () => ctrl('fgi-cflip').addEventListener('change', e => { q.flip = e.target.checked; edited(node, true); renderInspector(ids); }) });
    }
    rows.push({ html: '<p class="org-panel__hint">Poses every cell of a Square lattice Grid, any size (Radial: an even number of columns and rows). A later rule in the chain wins.</p>' });
  } else if (node.type === 'repeat') {
    const L = REPEAT_LATTICES[p.lattice] || REPEAT_LATTICES.square;
    rows.push(selectRow('Repeat as', 'fgi-rlat', Object.entries(REPEAT_LATTICES).map(([k, l]) => [k, l.label]), p.lattice, v => { p.lattice = v; p.count = REPEAT_LATTICES[v].def; edited(node, true); renderInspector(ids); }));
    rows.push(rangeRow(L.key === 'n' ? 'Copies per side' : L.key === 'stack' ? 'Tiers' : 'Rows', 'fgi-rcount', L.min, L.max, 1, p.count, (v, c) => { p.count = v; edited(node, c); }));
    rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-ralt"${p.altFlip ? ' checked' : ''}><span>Alternate flip</span></label>`, bind: () => ctrl('fgi-ralt').addEventListener('change', e => { p.altFlip = e.target.checked; edited(node, true); }) });
    rows.push(selectRow('Rotation', 'fgi-rrot', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], +p.rotate || 0, v => { p.rotate = +v; edited(node, true); }));
    rows.push(selectRow('Mirror', 'fgi-rmir', Object.entries(MIRRORS), p.mirror || 'none', v => { p.mirror = v; edited(node, true); }));
    rows.push({ html: '<p class="org-panel__hint">Several Repeat in grid nodes apply in the order of the chain.</p>' });
  } else if (node.type === 'transform') {
    rows.push(selectRow('Rotation', 'fgi-trot', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], +p.rotate || 0, v => { p.rotate = +v; edited(node, true); }));
    rows.push(selectRow('Mirror', 'fgi-tmir', Object.entries(MIRRORS), p.mirror || 'none', v => { p.mirror = v; edited(node, true); }));
    rows.push({ html: '<p class="org-panel__hint">Rotates and mirrors the Repeat in grid just before it in the chain. With none before it, the whole Figure turns and flips in place. Two of them add up.</p>' });
  } else if (node.type === 'composition') {
    const rs = p.rules || [], figs = ctl.model.edges.filter(e => e.from.node === node.id && e.to.port === 'composition').map(e => NC.findNode(ctl.model, e.to.node)).filter(Boolean);
    rows.push({ html: `<div class="sub-label">Region rules</div>${rs.length ? `<div class="fg-list fg-list--static" role="list">${rs.map(r => `<div class="org-layer-card org-layer-card--flush${r.off ? ' is-off' : ''}" role="listitem"><div class="org-layer-card__head"><span class="org-layer-card__title">${esc(describeComposeRule(r, compInks(node)))}${r.off ? ' (off)' : ''}</span></div></div>`).join('')}</div>` : '<p class="org-panel__hint">No region rules yet.</p>'}
      <div class="sub-label">Figures</div>${figs.length ? `<div class="row-btns">${figs.map(f => `<button type="button" class="mini-btn" data-compose="${f.id}">Compose ${esc(nodeLabel(f))}</button>`).join('')}</div>` : '<p class="org-panel__hint">Connect it to a Figure’s Composition input, then compose that Figure to add region rules.</p>'}`,
      bind: () => box.querySelectorAll('[data-compose]').forEach(b => b.addEventListener('click', () => enterCompose(b.dataset.compose))) });
  } else if (node.type === 'figure') {
    const cur = foundationOf(node);
    rows.push({ html: `<button type="button" class="panel-btn fg-block" id="fgi-compose">Compose</button>`, bind: () => ctrl('fgi-compose').addEventListener('click', () => enterCompose(node.id)) });   // the node's main verb
    if (!ctl.model.edges.some(e => e.to.node === node.id && e.to.port === 'content')) rows.push({ html: `<p class="org-empty">${savedEntries().element.length + savedEntries().component.length ? 'No content yet — add an Element or a Component from Content nodes on the left, then connect it to this Figure.' : 'No content yet — save an Element or a Component in its step first, or start from a built-in Figure with New Figure…'}</p>` });
    ['canvas', 'grid', 'palette'].forEach((t, k) => {
      const summary = n => t === 'canvas' ? canvasSummary(canvasOf(n.params)) : t === 'grid' ? gridSummary({ gen: n.params.gen, params: n.params.params }) : (k => k + (k === 1 ? ' ink' : ' inks'))((n.params.colors || []).length);
      const opts = ctl.model.nodes.filter(n => n.type === t).map(n => [n.id, nodeLabel(n) + ' · ' + summary(n)]);
      if (t === 'palette') opts.unshift(['', 'None — content’s own colours']);
      rows.push(selectRow(registry.get(t).meta.label, 'fgi-f-' + t, opts, cur[k] ? cur[k].id : '', v => {
        if (!v) { const e = ctl.model.edges.find(w => w.to.node === node.id && w.to.port === t); if (e) { NC.removeEdge(ctl.model, e.id); ctl.touch(node.id); ctl.commit('disconnect'); ctl.refresh(); } }
        else ctl.connect({ node: v, port: t }, { node: node.id, port: t });
        renderInspector(ids); save();
      }));
    });
    const chainNodes = []; for (let at = node.id, e; (e = ctl.model.edges.find(w => w.to.node === at && w.to.port === 'rules')) && chainNodes.length < 64; at = e.from.node) chainNodes.unshift(NC.findNode(ctl.model, e.from.node));
    if (chainNodes.length) rows.push({ html: `<div class="sub-label">Rules</div><ol class="fg-chain">${chainNodes.filter(Boolean).map(n => `<li><button type="button" class="fg-figlist__item" data-sel="${n.id}">${esc(nodeLabel(n))}<span class="fg-figlist__hint">${esc(nodeMeta(n))}</span></button></li>`).join('')}</ol><p class="org-panel__hint">In the order of the chain: a later rule wins.</p>`,
      bind: () => box.querySelectorAll('.fg-chain [data-sel]').forEach(b => b.addEventListener('click', () => ctl.select([b.dataset.sel]))) });
    const hasSet = ctl.model.edges.some(e => e.to.node === node.id && e.to.port === 'content' && (NC.findNode(ctl.model, e.from.node) || {}).type === 'set');
    if (hasSet && p.onlyItem) rows.push({ html: `<p class="org-panel__hint">Made from one item of the Set: ${esc(p.onlyItem.name)}.</p><div class="row-btns"><button type="button" class="mini-btn" id="fgi-allitems">Use the whole Set</button></div>`,
      bind: () => ctrl('fgi-allitems').addEventListener('click', () => { delete p.onlyItem; edited(node, true); renderInspector(ids); }) });
    if ((p.fixed || []).length) rows.push({ html: `<p class="org-panel__hint">Made from a variation — ${p.fixed.length === 1 ? 'one change fixed' : p.fixed.length + ' changes fixed'}</p>` });
    if (!variationsOf(node.id).length) rows.push({ html: `<div class="row-btns"><button type="button" class="mini-btn" id="fgi-addvar">Add Variations</button></div>`, bind: () => ctrl('fgi-addvar').addEventListener('click', () => addVariations(node.id)) });
    const fv = figureValue(node.id), cks = fv && fv.checks ? fv.checks : [];
    if (cks.length) rows.push({ html: `</div><div class="panel-section"><h3>Checks <span class="hint">${cks.every(c => c.ok) ? 'All pass' : cks.filter(c => !c.ok).length + ' to look at'}</span></h3><ul class="fg-checks">${cks.map(c => `<li class="${c.ok ? 'is-ok' : 'is-bad'}">${Organica.icons.get(c.ok ? 'check' : 'alert', { size: 'xs' })}<span>${esc(c.label)}${c.detail ? ` <span class="fg-checks__detail">${esc(c.detail)}</span>` : ''}</span></li>`).join('')}</ul>` });
    rows.push({ html: '</div><div class="panel-section"><h3>Cells</h3>' });
    rows.push(selectRow('Fit', 'fgi-fit', [['fill', 'Stretch'], ['contain', 'Contain'], ['cover', 'Cover (no gaps)'], ['match', 'Match cell']], p.fit, v => { p.fit = v; delete p.symbolFit; edited(node, true); }));   // a built-in's own fit gives way to the user's
    rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-keepown"${p.keepOwn ? ' checked' : ''}><span>Keep own colours</span></label>`,
      bind: () => { ctrl('fgi-keepown').addEventListener('change', e => { p.keepOwn = e.target.checked; edited(node, true); }); } });
    rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-clip"${p.clip !== false ? ' checked' : ''}><span>Clip to cell</span></label>`,
      bind: () => { ctrl('fgi-clip').addEventListener('change', e => { p.clip = e.target.checked; edited(node, true); }); } });
  }
  if (node.type === 'variations') {
    const fig = figOf(node), hasSet = fig && ctl.model.edges.some(e => e.to.node === fig.id && e.to.port === 'content' && (NC.findNode(ctl.model, e.from.node) || {}).type === 'set');
    if (!fig) rows.push({ html: '<p class="org-empty">Connect a Figure — its variations appear beside this node, each saying what changed.</p>' });
    if (hasSet && !(fig.params || {}).onlyItem) rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-fanout"${p.fanOut !== false ? ' checked' : ''}><span>Variations per item</span></label><p class="org-panel__hint">Each item of the Set gets its own variations. Off: the items are mixed over the cells.</p>`,
      bind: () => ctrl('fgi-fanout').addEventListener('change', e => { p.fanOut = e.target.checked; edited(node, true); }) });
    rows.push(rangeRow('Variations', 'fgi-vcount', 1, 12, 1, +p.variations || 1, (v, c) => { p.variations = v; edited(node, c); }));   // variations made, the Figure not counted (O-58 a)
    rows.push(selectRow('Vary by', 'fgi-varyby', [['seed', 'Seed'], ['one', 'One change'], ['several', 'Several changes']], p.varyBy || 'one', v => { p.varyBy = v; edited(node, true); }));
    rows.push({ html: `<div class="ctrl-row"><div class="ctrl-label">Seed</div><input type="number" class="panel-input" id="fgi-seed" value="${+p.seed || 1}" min="1" max="999999" step="1" aria-label="Seed"><button type="button" class="icon-btn" id="fgi-renew" aria-label="New variations — pinned ones stay" title="New variations — pinned ones stay">${Organica.icons.get('refresh', { size: 'sm' })}</button></div>`,   // as every E/C/S seed row: the number + its refresh
      bind: () => { ctrl('fgi-seed').addEventListener('change', e => { p.seed = Math.max(1, Math.round(+e.target.value) || 1); edited(node, true); }); ctrl('fgi-renew').addEventListener('click', () => { p.seed = (+p.seed || 1) + 1; edited(node, true); renderInspector(ids); }); } });
    const KEEP_LABELS = { content: 'Content', palette: 'Palette', cells: 'Cell rules', grid: 'Grid', transform: 'Rotate & mirror' };
    rows.push({ html: `<div class="sub-label">Keep</div><div class="check-group">${KEEP_KEYS.map(k => `<label class="check-row"><input type="checkbox" data-keep="${k}"${(p.keep || {})[k] ? ' checked' : ''}><span>${KEEP_LABELS[k]}</span></label>`).join('')}</div>`,
      bind: () => box.querySelectorAll('[data-keep]').forEach(c => c.addEventListener('change', () => { p.keep = { ...(p.keep || {}), [c.dataset.keep]: c.checked }; edited(node, true); })) });
    const hidden = (p.pins || []).filter(q => q.slot > (+p.variations || 0)).length;
    if ((p.pins || []).length) rows.push({ html: `<p class="org-panel__hint">${p.pins.length} pinned${hidden ? ` — ${hidden} not shown: raise Variations to see ${hidden === 1 ? 'it' : 'them'}` : ''}</p>` });
  }
  if (node.type === 'figure-var') {
    rows.push({ html: `<button type="button" class="panel-btn fg-block" id="fgi-compose">Compose</button>`, bind: () => ctrl('fgi-compose').addEventListener('click', () => enterCompose(node.id)) });   // as the Figure's: the node's main verb
    const par = parentNode(node), en = ctl.engine.get(node.id), v = en && en.value && en.value.figure ? en.value.figure.variations[0] : null;
    const own = ctl.model.edges.filter(e => e.to.node === node.id && e.to.port !== 'from').map(e => registry.inputsOf(node).find(q => q.name === e.to.port).label);
    if (par) rows.push({ html: `<p class="org-panel__hint">Variation ${variationNo(node)} of ${esc(nodeLabel(par))}${v && v.slot ? ' — ' + esc(v.label) : ''}</p>
      <div class="row-btns"><button type="button" class="mini-btn" id="fgi-parent">Select ${esc(nodeLabel(par))}</button></div>
      <div class="sub-label">Own inputs</div><p class="org-panel__hint">${own.length ? `${esc([...new Set(own)].join(', '))} — for this variation only. ` : ''}Connect a Canvas, Grid, Palette, Content, Rules or Composition to change this variation only. Rules are added to ${esc(nodeLabel(par))}’s; the others replace them, and the variation’s own change leaves them as they are.</p>`,
      bind: () => ctrl('fgi-parent').addEventListener('click', () => { const src = sourceOf(node); ctl.select([par.id]); ctl.fitTo([par.id, ...(src ? [src.id, ...childrenOf(src.id).map(n => n.id)] : [])]); }) });
  }
  box.innerHTML = title + (why && node.type !== 'figure-var' ? `<p class="org-panel__hint">${esc(why)}</p>` : '') + rows.map(r => r.html).join('') + '</div>';   // a refused Delete explains itself first (no stop: the Decided string has none)
  if (renameable) bindRename(node, ids);
  rows.forEach(r => r.bind && r.bind());
  if (Organica.autoLabelPanel) Organica.autoLabelPanel(box);
}

// ── Reorder a Figure list (Set items, Cell rules, region rules) — the Element Layers' gesture (O-49):
// press a card's head, move 4px, drop on another card (its upper half = before it, lower half = after);
// ⌥↑ / ⌥↓ on a card's button moves that card. Cards carry data-i (0 = top). moved(to) re-renders.
const GRIP = () => `<span class="org-layer-card__grip" aria-hidden="true">${Organica.icons.get('grip', { size: 'sm' })}</span>`;
function reorderable(list, arr, moved) {
  if (!list) return;
  let press = null;
  const cards = () => [...list.querySelectorAll(':scope > .org-layer-card')];
  const clear = () => cards().forEach(c => c.classList.remove('drop-before', 'drop-after', 'is-dragging'));
  const at = e => { const el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest('.org-layer-card'); return c && c.parentElement === list ? c : null; };
  const drop = (e, c) => {
    const t = +c.dataset.i, r = (c.querySelector('.org-layer-card__head') || c).getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
    let to = before ? t : t + 1; if (to > press.from) to--;
    return { to: Math.max(0, Math.min(arr.length - 1, to)), before };
  };
  const move = (from, to) => { if (to === from || to < 0 || to >= arr.length) return false; arr.splice(to, 0, arr.splice(from, 1)[0]); moved(to); return true; };
  list.addEventListener('pointerdown', e => {
    const head = e.button === 0 && arr.length > 1 && e.target.closest('.org-layer-card__head');
    if (!head || e.target.closest('button:not(.fg-rule__pick), input, select')) return;
    press = { from: +head.parentElement.dataset.i, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  });
  list.addEventListener('pointermove', e => {
    if (!press || e.pointerId !== press.id) return;
    if (!press.moved) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4) return;
      press.moved = true; list.setPointerCapture(e.pointerId);
      const c = cards()[press.from]; if (c) c.classList.add('is-dragging');
    }
    e.preventDefault();
    cards().forEach(c => c.classList.remove('drop-before', 'drop-after'));
    const c = at(e); if (c && +c.dataset.i !== press.from) c.classList.add(drop(e, c).before ? 'drop-before' : 'drop-after');
  });
  const end = e => {
    if (!press || e.pointerId !== press.id) return;
    const c = press.moved && e.type === 'pointerup' ? at(e) : null, to = c && +c.dataset.i !== press.from ? drop(e, c).to : press.from;
    const p = press; press = null;
    if (!p.moved) return;   // a plain click keeps its own meaning
    clear();
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };   // the click that ends a drag is not a click
    window.addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', swallow, true), 0);
    move(p.from, to);
  };
  list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
  list.addEventListener('keydown', e => {
    const c = e.target.closest('.org-layer-card');
    if (!c || c.parentElement !== list || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault(); const i = +c.dataset.i; move(i, i + (e.key === 'ArrowUp' ? -1 : 1));
  });
}
const focusCard = (list, i) => { const b = list && list.querySelector(`:scope > .org-layer-card[data-i="${i}"] button`); if (b) b.focus({ preventScroll: true }); };

// ── Set: an ordered list of saved Elements / Components; saved Sets ('fvs-sets') ──
function setEditor(node, ids) {
  const p = node.params, items = p.items || (p.items = []), s = savedEntries(), saved = Object.keys(SETS.read()).sort((a, b) => a.localeCompare(b));
  const row = (it, i) => `<div class="org-layer-card org-layer-card--flush${items.length > 1 ? ' is-draggable' : ''}" role="listitem" data-i="${i}"><div class="org-layer-card__head">${items.length > 1 ? GRIP() : ''}<span class="fg-set__thumb" data-theme="light">${entryThumb(it.kind, it.name, it.snapshot)}</span><span class="org-layer-card__title">${esc(it.name)}</span>
    <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="del" data-i="${i}" aria-label="Remove ${esc(it.name)} from the Set">${Organica.icons.get('close')}</button></div></div>`;
  const tiles = (kind, list) => list.map(e => `<button type="button" class="fvs-library-item" data-add="${kind}" data-name="${esc(e.name)}" aria-label="Add ${kind === 'element' ? 'Element' : 'Component'}: ${esc(e.name)}">${entryThumb(kind, e.name, e.entry)}</button>`).join('');
  return { html: `<div class="fg-list" role="list" id="fgi-set-items">${items.length ? items.map(row).join('') : '<p class="org-panel__hint">No items yet — add saved Elements or Components below.</p>'}</div>
    <div class="sub-label">Add</div><div class="fvs-rail__grid" id="fgi-set-add">${tiles('element', s.element) + tiles('component', s.component) || '<p class="org-panel__hint">Nothing saved yet — save an Element or a Component in its step first.</p>'}</div>
    <div class="sub-label">Saved Sets</div>
    <div class="ctrl-row"><select class="panel-select" id="fgi-set-saved" aria-label="Saved Sets"><option value="">${saved.length ? 'Open a saved Set…' : 'No Sets yet'}</option>${saved.map(n => `<option>${esc(n)}</option>`).join('')}</select></div>
    <div class="row-btns"><button type="button" class="mini-btn" id="fgi-set-save">Save Set</button>${SETS.read()[nodeLabel(node)] ? `<button type="button" class="mini-btn" id="fgi-set-delete" data-armed="Delete — click again to confirm">Delete saved Set</button>` : ''}</div>`,
    bind: () => {
      const again = () => { edited(node, true); renderInspector(ids); ctl.paint(node.id); };
      ctrl('fgi-set-items').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; const i = +b.dataset.i;
        if (b.dataset.act === 'del') items.splice(i, 1);
        again(); });
      reorderable(ctrl('fgi-set-items'), items, to => { again(); focusCard(ctrl('fgi-set-items'), to); });
      ctrl('fgi-set-add').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (!b) return; const c = addContent(b.dataset.add, b.dataset.name); items.push({ kind: b.dataset.add, name: b.dataset.name, snapshot: c.params.snapshot }); again(); });
      ctrl('fgi-set-saved').addEventListener('change', e => { const v = SETS.read()[e.target.value]; if (!v) return; p.items = JSON.parse(JSON.stringify(v.items || [])); node.name = e.target.value; ctl.refresh(); again(); });
      ctrl('fgi-set-save').addEventListener('click', async () => {
        if (!items.length) { Organica.notice('Add items to the Set first'); return; }
        const all = SETS.read(), name = nodeLabel(node), same = all[name] && JSON.stringify(all[name].items) === JSON.stringify(items);
        if (all[name] && !same && Organica.confirm && !(await Organica.confirm({ title: `Replace the saved Set “${name}”?`, message: 'The saved Set gets this Set’s items.', ok: 'Replace' }))) return;
        all[name] = { items: JSON.parse(JSON.stringify(items)), savedAt: new Date().toISOString() }; if (SETS.write(all)) Organica.notice('Set saved'); renderInspector(ids);
      });
      const del = ctrl('fgi-set-delete'); if (del) del.addEventListener('click', () => { const all = SETS.read(); delete all[nodeLabel(node)]; SETS.write(all); Organica.notice('Saved Set deleted'); renderInspector(ids); });
    } };
}

// ── Cell rules: today's rule chips (eye / up / down / trash) + "Add rule" — which cells, what they get ──
// option groups: [group label | null, [[value, label], …]] — the triangle- and hexagon-only choices say so (as the Symbol step does)
const WHICH = [[null, [['all', 'All cells'], ['odd', 'Odd cells'], ['even', 'Even cells'], ['row', 'Row'], ['col', 'Column'], ['index', 'Cell']]], ['Triangle grids', [['up', 'Up cells'], ['down', 'Down cells']]], ['Hexagon grids', [['ring', 'Ring'], ['sector', 'Sector']]]];
const DOES = [[null, [['empty', 'Empty'], ['filled', 'Filled'], ['r90', 'Rotate 90°'], ['r180', 'Rotate 180°'], ['r270', 'Rotate 270°'], ['fh', 'Flip horizontal'], ['fv', 'Flip vertical']]], ['Triangle and hexagon grids', [['r60', 'Rotate 60°'], ['r120', 'Rotate 120°'], ['r240', 'Rotate 240°'], ['r300', 'Rotate 300°'], ['rsector', 'Rotate by sector']]]];
const groupedOptions = groups => groups.map(([g, os]) => { const o = os.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); return g ? `<optgroup label="${g}">${o}</optgroup>` : o; }).join('');
const N_HINT = { ring: 'Ring 0 is the centre.', sector: 'Sector 0 starts on the right; they count clockwise.' };
const N_LABEL = { row: 'Row number', col: 'Column number', ring: 'Ring', sector: 'Sector', index: 'Cell number' };   // what the number counts
function ruleFrom(which, n, does) {
  const when = which === 'all' ? {} : which === 'up' || which === 'down' ? { class: which } : which === 'odd' || which === 'even' ? { parity: which } : { [which]: Math.max(0, n - (which === 'ring' || which === 'sector' ? 0 : 1)) };
  const d = does === 'empty' ? { content: 'empty' } : does === 'filled' ? { content: 'filled' } : does === 'rsector' ? { rotate: 'sector' } : does[0] === 'r' ? { rotate: +does.slice(1) } : does === 'fh' ? { flipH: true } : { flipV: true };
  return { when, do: d };
}
function cellRulesEditor(node, ids) {
  const rs = node.params.rules || (node.params.rules = []);
  const chip = (r, i) => `<div class="org-layer-card org-layer-card--flush${r.off ? ' is-off' : ''}${rs.length > 1 ? ' is-draggable' : ''}" role="listitem" data-i="${i}"><div class="org-layer-card__head">${rs.length > 1 ? GRIP() : ''}<span class="org-layer-card__title">${esc(describeRule(r))}</span>
    <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="off" data-i="${i}" aria-pressed="${!r.off}" aria-label="Rule ${i + 1} on">${Organica.icons.get(r.off ? 'eye-off' : 'eye')}</button>
    <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="del" data-i="${i}" aria-label="Delete rule ${i + 1}">${Organica.icons.get('trash')}</button></div></div>`;
  return { html: `<div class="fg-list" role="list" id="fgi-rules">${rs.length ? rs.map(chip).join('') : '<p class="org-panel__hint">No rules yet — every cell gets the content.</p>'}</div>
    <div class="sub-label">Add rule</div>
    <div class="ctrl-row"><div class="ctrl-label">Which cells</div><select class="panel-select" id="fgi-which" aria-label="Which cells">${groupedOptions(WHICH)}</select></div>
    <div class="ctrl-row fg-hide" id="fgi-n-row" hidden><div class="ctrl-label" id="fgi-n-label">Row number</div><input type="number" class="panel-input" id="fgi-n" min="0" max="99" step="1" value="1" aria-labelledby="fgi-n-label"></div>
    <p class="org-panel__hint fg-hide" id="fgi-n-hint" hidden>Ring 0 is the centre.</p>
    <div class="ctrl-row"><div class="ctrl-label">They get</div><select class="panel-select" id="fgi-does" aria-label="They get">${groupedOptions(DOES)}</select></div>
    <div class="row-btns"><button type="button" class="mini-btn" id="fgi-add-rule">Add rule</button></div>
    <p class="org-panel__hint">Rules apply in order: a later rule wins on the cells it matches.</p>`,
    bind: () => {
      ctrl('fgi-which').addEventListener('change', e => { const v = e.target.value; ctrl('fgi-n-row').hidden = !N_LABEL[v]; if (N_LABEL[v]) ctrl('fgi-n-label').textContent = N_LABEL[v]; ctrl('fgi-n').min = v === 'ring' || v === 'sector' ? 0 : 1; ctrl('fgi-n-hint').hidden = !N_HINT[v]; if (N_HINT[v]) ctrl('fgi-n-hint').textContent = N_HINT[v]; });
      ctrl('fgi-add-rule').addEventListener('click', () => { rs.push(ruleFrom(ctrl('fgi-which').value, +ctrl('fgi-n').value || 0, ctrl('fgi-does').value)); edited(node, true); renderInspector(ids); ctl.paint(node.id); });
      ctrl('fgi-rules').addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return; const i = +b.dataset.i;
        if (b.dataset.act === 'off') rs[i].off = !rs[i].off;
        else if (b.dataset.act === 'del') rs.splice(i, 1);
        edited(node, true); renderInspector(ids); ctl.paint(node.id);
      });
      reorderable(ctrl('fgi-rules'), rs, to => { edited(node, true); renderInspector(ids); ctl.paint(node.id); focusCard(ctrl('fgi-rules'), to); });
    } };
}

// ── New Figure… → Built-in Figures: a built-in opens as a graph beside what is there ──
function savedElementFor(el) {   // the built-in's Element, saved once (deduplicated by the recipe element it came from)
  const all = ELEMENT_LIB.read(), key = recipeElementKey(el);
  const have = Object.keys(all).find(n => all[n] && all[n].recipe && recipeElementKey(all[n].recipe) === key);
  if (have) return { name: have, entry: all[have] };
  const entry = elementEntryFromRecipe(el);
  let name = `${(SEED_TYPES[el.type] || {}).label || el.type} · built-in`;
  while (all[name]) name += '′';
  all[name] = entry; ELEMENT_LIB.write(all);
  return { name, entry };
}
function nextSlot() {   // where a new built-in's section goes: the next place in rows of three sections
  const fr = ctl.model.frames || [];
  if (!ctl.model.nodes.length) return { x: 40, y: 40 };
  if (!fr.length) return { x: ctl.model.nodes.reduce((a, n) => Math.max(a, n.x + 440), 0) + 160, y: 40 };
  const rowY = Math.max(...fr.map(f => f.y)), row = fr.filter(f => Math.abs(f.y - rowY) < 200);
  if (row.length < 3) { const last = row.reduce((a, f) => (f.x + f.w > a.x + a.w ? f : a)); return { x: last.x + last.w + 160, y: last.y + 60 }; }
  return { x: Math.min(...fr.map(f => f.x)) + 32, y: Math.max(...fr.map(f => f.y + f.h)) + 200 };
}
function openBuiltin(def, title) {
  const { name, entry } = savedElementFor(def.element);
  const g = graphFromRecipe(def, name);
  const m = ctl.model, slot = nextSlot(), x0 = slot.x, y0 = slot.y;
  const col = { canvas: [0, 0], grid: [0, 1], palette: [0, 2], element: [0, 3] }, ids = {};
  let rulesY = 0;
  g.nodes.forEach(n => {
    const isRule = ['cell-rules', 'component-rule', 'repeat', 'transform'].includes(n.type);
    const [c, r] = n.type === 'figure' ? [2, 0] : isRule ? [1, rulesY++] : col[n.ref] || [0, 4];
    const params = { ...registry.defaults(n.type), ...n.params };
    if (n.type === 'element') params.snapshot = entrySnapshot(entry);
    const node = NC.addNode(m, { type: n.type, x: x0 + c * COL_STEP, y: y0 + r * 150, params, name: n.name || nameFor(m, n.type, params) });
    ids[n.ref] = node.id;
  });
  g.edges.forEach(([a, ap, b, bp]) => NC.addEdge(m, { node: ids[a], port: ap }, { node: ids[b], port: bp }, true));
  Object.values(ids).forEach(id => ctl.touch(id));
  ctl.refresh(); ctl.select([ids.figure]); ctl.commit('new-figure');
  requestAnimationFrame(() => { ctl.addSection(Object.values(ids), title || undefined, { noCommit: true }); ctl.commit('new-figure', { amend: true }); ctl.select([ids.figure]); save(); ctl.fitTo(Object.values(ids)); });
}
function openNewFigure() {
  const cat = figureCatalog();
  const m = document.createElement('div'); m.className = 'org-modal fg-new'; m.style.display = 'flex';
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'fg-new-title');
  m.innerHTML = `<div class="org-modal__panel fg-new__panel"><div class="org-modal__header"><span class="org-modal__title" id="fg-new-title">New Figure…</span>
    <button class="org-btn org-btn--icon org-btn--sm org-btn--ghost" data-act="close" aria-label="Close">${Organica.icons.get('close', { size: 'sm' })}</button></div>
    <div class="sub-label">Built-in Figures</div>
    <div class="fg-new__grid" data-theme="light">${Object.keys(cat).map((n, i) => `<button type="button" class="fg-new__item" data-i="${i}" aria-label="${esc(n)}"><span class="fg-new__thumb"></span><span class="fg-new__name">${esc(n)}</span></button>`).join('')}</div>
    <div class="row-btns"><button type="button" class="mini-btn" data-act="blank">Start with an empty Figure</button></div></div>`;
  const close = () => { if (Organica.modal) Organica.modal.release(m); m.remove(); };
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-act], [data-i]'); if (!b && e.target === m) { close(); return; } if (!b) return;
    if (b.dataset.act === 'close') close();
    else if (b.dataset.act === 'blank') { close(); addNode('figure'); }
    else { const key = Object.keys(cat)[+b.dataset.i]; close(); openBuiltin(JSON.parse(JSON.stringify(cat[key])), key); }
  });
  document.body.appendChild(m); if (Organica.modal) Organica.modal.watch(m);
  // thumbnails, a few per frame (evalFigure ~1 ms each)
  const items = [...m.querySelectorAll('.fg-new__thumb')], defs = Object.values(cat);
  let i = 0; const step = () => { if (!m.isConnected) return; for (let k = 0; k < 4 && i < items.length; k++, i++) { try { items[i].innerHTML = evalFigure(defs[i]).svg; } catch (e) { items[i].textContent = '—'; } } if (i < items.length) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ── Node search: '/', right-click or double-click on the board, a wire released on the board ──
// From a wire it lists only what connects, and the picked node arrives connected (Figma Weave).
function searchItems() {
  const types = registry.list().filter(t => t.meta.id !== 'element' && t.meta.id !== 'component' && !t.meta.hidden).map(t => ({ label: t.meta.label, hint: t.meta.category, spec: { type: t.meta.id } }));
  const s = savedEntries();
  return types.concat(s.element.map(e => ({ label: e.name, hint: 'Element', spec: addContent('element', e.name) })), s.component.map(e => ({ label: e.name, hint: 'Component', spec: addContent('component', e.name) })));
}
function connects(spec, from) { return NC.portFor(registry, ctl.model, spec.type, spec.params, from); }   // the new node's port that takes `from`
function openSearch(at, from, client) {   // Organica.nodeCanvas.search
  const fromNode = from && NC.findNode(ctl.model, from.node);
  const fromPort = fromNode && (from.dir === 'out' ? registry.outputsOf(fromNode) : registry.inputsOf(fromNode)).find(p => p.name === from.port);
  let items = searchItems(); if (from) items = items.filter(it => connects(it.spec, from));
  const r = ctrl('fg-graph').getBoundingClientRect();
  NC.search({
    items, title: fromPort ? `Nodes that connect to ${fromPort.label || fromPort.name}` : '', returnFocus: ctrl('fg-graph'),
    client: client || { x: r.left + r.width / 2, y: r.top + r.height / 3 },
    onPick: it => {
      const p = from && connects(it.spec, from);
      const node = addNode(it.spec.type, freeSpot(centred(at, it.spec.type)), it.spec.params);
      if (p && node) from.dir === 'out' ? ctl.connect({ node: from.node, port: from.port }, { node: node.id, port: p.name }) : ctl.connect({ node: node.id, port: p.name }, { node: from.node, port: from.port });
    },
  });
}
// Double-click a port: an input gets the node it needs, beside it and connected; anything else opens the search
function spawnFor(node, port, dir) {
  const ip = dir === 'in' && registry.inputsOf(node).find(p => p.name === port);
  const direct = ip && { canvas: 'canvas', grid: 'grid', palette: 'palette' }[ip.type];
  if (direct) { const n = addNode(direct, freeSpot({ x: node.x - COL_STEP, y: node.y })); ctl.connect({ node: n.id, port: direct }, { node: node.id, port }); return; }
  const card = ctl.cardOf(node.id), r = card ? card.getBoundingClientRect() : null;
  openSearch({ x: dir === 'in' ? node.x - COL_STEP : node.x + (card ? card.offsetWidth : 200) + LABEL_ROOM, y: node.y }, { node: node.id, port, dir }, r ? { x: dir === 'in' ? r.left - 250 : r.right + 10, y: r.top } : null);
}

// ── Compose (Phase 5, ledger O-32): a mode of the Figure step. The Figure's own cells, selectable; every action is a
// rule on the Figure's Composition node (created and wired with the first rule), so it applies to all its variations and
// survives upstream changes. Selection tools keep their meaning (a row stays "row 3" when the Grid changes).
let composing = null;   // { fig, comp, sel: Set<index>, when: {…} | null, tool, view: {zoom, pan}, anchor }
function figureValue(id) { const e = ctl.engine.get(id); return e && e.state === 'ok' && e.value ? e.value.figure : null; }
function compNode() {   // the Composition feeding the Figure now (undo can take it away or bring it back)
  if (!composing) return null;
  const e = ctl.model.edges.find(w => w.to.node === composing.fig && w.to.port === 'composition'), c = e && NC.findNode(ctl.model, e.from.node);
  composing.comp = c ? c.id : null; return c || null;
}
function compositionName() { const used = new Set(ctl.model.nodes.map(n => n.name)); let i = 1; while (used.has('Composition ' + i)) i++; return 'Composition ' + i; }
function sharedWith(comp) { return comp ? ctl.model.edges.filter(e => e.from.node === comp.id && e.to.port === 'composition' && e.to.node !== composing.fig).map(e => NC.findNode(ctl.model, e.to.node)).filter(Boolean) : []; }
function copyComposition() {   // this Figure gets its own copy; the other Figures keep the shared one
  const comp = compNode(), fig = NC.findNode(ctl.model, composing.fig); if (!comp || !fig) return;
  const copy = NC.addNode(ctl.model, { type: 'composition', x: comp.x, y: comp.y + 120, params: JSON.parse(JSON.stringify(comp.params)), name: compositionName() });
  NC.addEdge(ctl.model, { node: copy.id, port: 'composition' }, { node: fig.id, port: 'composition' });
  composing.comp = copy.id; ctl.touch(fig.id); ctl.refresh(); ctl.commit('compose'); save();
  Organica.notice(`${nodeLabel(fig)} now has its own ${copy.name}`); renderComposeInspector('#fgc-fill');
}
function enterCompose(figId) {
  const fig = NC.findNode(ctl.model, figId); if (!fig) return;
  if (fig.type === 'figure-var') inheritComposition(fig);
  const edge = ctl.model.edges.find(e => e.to.node === figId && e.to.port === 'composition'), comp = edge && NC.findNode(ctl.model, edge.from.node);
  composing = { fig: figId, comp: comp ? comp.id : null, sel: new Set(), when: null, tool: null, anchor: null, focus: 0, opener: document.activeElement, view: { zoom: ctl.zoomPan.zoom, ...ctl.zoomPan.pan } };
  document.body.classList.add('fg-composing'); syncExportButton();
  ctrl('fg-graph').hidden = true; ctrl('fg-compose').hidden = false;
  ctrl('fb-figure-actions').style.display = 'none'; ctrl('fb-compose-actions').style.display = '';
  setNodebar(null); renderComposeBar();
  // the left side is the Symbol step's Library rail: drag a saved Element / Component onto a cell, or click it for the selection
  rt.railTarget = { apply: composeRailApply }; live.railCompose = true; ctrl('fg-nodebar-dock').hidden = true; syncRailTier('figure'); placeStepNav();
  ctrl('fg-compose-title').textContent = 'Compose ' + nodeLabel(fig);
  ctl.run(); drawCompose(); renderComposeInspector();
  ctrl('fg-compose-back').focus({ preventScroll: true });
}
// A variation without its own Composition draws its Figure's: composing it starts on that same Composition, wired to it
// too — shared, so the shared notice offers this variation its own copy. No Figure Composition: the first rule makes one.
function inheritComposition(child) {
  const m = ctl.model, par = parentNode(child); if (!par || m.edges.some(e => e.to.node === child.id && e.to.port === 'composition')) return;
  const e = m.edges.find(w => w.to.node === par.id && w.to.port === 'composition'); if (!e) return;
  NC.addEdge(m, { node: e.from.node, port: 'composition' }, { node: child.id, port: 'composition' });
  ctl.touch(child.id); ctl.refresh(); ctl.commit('compose'); save();
}
function exitCompose() {
  if (!composing) return;
  const fig = composing.fig, view = composing.view, opener = composing.opener; composing = null;
  document.body.classList.remove('fg-composing'); syncExportButton();
  ctrl('fg-compose').hidden = true; ctrl('fg-graph').hidden = false;
  ctrl('fb-compose-actions').style.display = 'none'; ctrl('fb-figure-actions').style.display = '';
  renderNodebarButtons();
  rt.railTarget = null; live.railCompose = false; ctrl('fg-nodebar-dock').hidden = false; syncRailTier('figure'); placeStepNav();
  ctl.zoomPan.setView({ zoom: view.zoom, panX: view.x, panY: view.y });
  ctl.select([fig]); ctl.refresh(); ctl.pulse([fig]);
  const back = opener && opener.isConnected && !opener.closest('#fg-compose') ? opener : ctl.cardOf(fig);
  if (back) back.focus({ preventScroll: true });
}
function drawCompose() {
  if (!composing) return;
  ctrl('btn-fg-compose-undo').disabled = !ctl.history.canUndo(); ctrl('btn-fg-compose-redo').disabled = !ctl.history.canRedo();
  const f = figureValue(composing.fig), stage = ctrl('fg-compose-stage');
  const fig = NC.findNode(ctl.model, composing.fig), n = fig ? (+fig.params.variations || 1) : 1;
  const par = fig && fig.type === 'figure-var' ? parentNode(fig) : null;
  ctrl('fg-compose-note').textContent = par ? `Variation ${variationNo(fig, par)} of ${nodeLabel(par)}` : `Applies to all ${n} ${n === 1 ? 'variation' : 'variations'} of ${fig ? nodeLabel(fig) : 'the Figure'}`;
  if (!fig) { exitCompose(); return; }   // undone away, or deleted
  if (!f) { const e = ctl.engine.get(composing.fig), bad = e && /error|waiting|upstream/.test(e.state); stage.innerHTML = `<p class="fg-compose__empty">${bad ? esc(e.message || 'This Figure can’t be drawn') : 'Updating…'}</p>`; return; }
  if (!f.compose || !f.base) { stage.innerHTML = '<p class="fg-compose__empty">This Figure has no cells to compose — a Component rule lays out its own.</p>'; return; }
  const C = f.compose, base = f.base.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const hadFocus = stage.contains(document.activeElement), fi = Math.min(composing.focus || 0, C.outlines.length - 1);
  stage.innerHTML = `<svg class="fg-compose__svg" viewBox="0 0 ${C.w} ${C.h}" role="listbox" aria-multiselectable="true" aria-label="Cells">${base}<g class="fg-cells">${C.outlines.map((pts, i) => `<polygon class="fg-cell${composing.sel.has(i) ? ' is-sel' : ''}" data-i="${i}" points="${pts.map(p => p.join(',')).join(' ')}" role="option" aria-selected="${composing.sel.has(i)}" tabindex="${i === fi ? 0 : -1}"><title>${C.ctxs && C.ctxs[i] && C.ctxs[i].row != null ? 'Row ' + (C.ctxs[i].row + 1) + ', column ' + (C.ctxs[i].col + 1) : 'Cell ' + (i + 1)}</title></polygon>`).join('')}</g>${composing.marquee ? `<rect class="symbol-marquee" x="${composing.marquee.x.toFixed(2)}" y="${composing.marquee.y.toFixed(2)}" width="${composing.marquee.w.toFixed(2)}" height="${composing.marquee.h.toFixed(2)}"/>` : ''}</svg>`;
  if (hadFocus) { const c = stage.querySelector(`.fg-cell[data-i="${fi}"]`); if (c) c.focus({ preventScroll: true }); }
  syncComposeFloatbar();
}
// The selection, said once it changes (a persistent live region: the panel is rebuilt with innerHTML)
function announceSelection() {
  const live = ctrl('fg-compose-live'); if (!live || !composing) return;
  const n = composing.sel.size, w = composing.when || (n === 1 ? selectionWhen() : null);
  const t = n ? `${n} ${n === 1 ? 'cell' : 'cells'} selected${w ? ' — ' + whereText(w) : ''}` : 'No cell selected';
  live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30);
}
function renderComposeBar() {   // the left dock while composing: the saved items to drop into cells (selection is drag / click, as in Symbol)
  const bar = ctrl('fg-nodebar');
  ctrl('fg-nodebar-dock').setAttribute('aria-label', 'Compose'); bar.setAttribute('aria-label', 'Compose tools');
  bar.innerHTML = `<button class="org-floatbar__btn" data-cat="Content" aria-label="Content" aria-expanded="false" aria-controls="fg-nodebar-panel">${Organica.icons.get(ICON.Content)}</button>`;
  placeStepNav();
}
function renderNodebarButtons() {   // back to the node bar
  const bar = ctrl('fg-nodebar'); bar.setAttribute('aria-label', 'Nodes'); ctrl('fg-nodebar-dock').setAttribute('aria-label', 'Nodes');
  bar.innerHTML = ['Foundation', 'Content', 'Rules', 'Output'].map(c => `<button class="org-floatbar__btn" data-cat="${c}" aria-label="${c === 'Rules' ? 'Rule' : c} nodes" aria-expanded="false" aria-controls="fg-nodebar-panel">${Organica.icons.get(ICON[c])}</button>`).join('');
  setNodebar(null);
  placeStepNav();
}
// A selection is stored by grid address (row, column), so it names the same cells when the Grid changes; a grid whose
// cells share an address (some Loom generators) falls back to cell numbers.
function cellsWhen(ids) {
  const f = figureValue(composing.fig), ctxs = f && f.compose ? f.compose.ctxs : null, list = [...ids].sort((a, b) => a - b);
  const unique = ctxs && new Set(ctxs.map(c => c.row + ',' + c.col)).size === ctxs.length;
  return unique ? { at: list.map(i => [ctxs[i].row, ctxs[i].col]) } : { index: list };
}
// ── Compose's Fill — the Symbol step's Fill section over the selection (Oct 8, 2026): Manual = Cell properties;
// Rule and Arrange are the Symbol step's own blocks (the rule's #rp-* controls are cloned from the Symbol panel with
// a fgc- prefix, read through SYMBOL_RULES[x].fields — one source); Pattern is Compose's own. The settings start from
// the Symbol step's, or from the region rule being edited; with a rule picked a change updates it at once, and the
// button writes a new region rule on the selection otherwise.
const COMPOSE_FILLS = [['arrange', 'Arrange'], ['manual', 'Manual'], ['rule', 'Rule'], ['pattern', 'Pattern']];   // Symbol's order, then Pattern; the default is Manual
const fillOf = r => { const d = (r && r.do) || {}; return d.symbolRule ? 'rule' : d.arrange ? 'arrange' : d.pattern ? 'pattern' : 'manual'; };
const newSeedNum = () => 1 + Math.floor(Math.random() * 99999);
function editedOfKind(comp, kind) {   // the picked region rule, if it is this kind and still covers the selection
  const rs = comp ? comp.params.rules || [] : [], r = composing.edit != null ? rs[composing.edit] : null, w = selectionWhen();
  return r && fillOf(r) === kind && w && JSON.stringify(r.when) === JSON.stringify(w) ? r : null;
}
function composeDraft(comp, kind) {
  composing.draft = composing.draft || {};
  if (composing.draft[kind]) return composing.draft[kind];
  const r = editedOfKind(comp, kind), d = r && r.do;
  const v = kind === 'rule' ? (d ? JSON.parse(JSON.stringify(d.symbolRule)) : { name: pv('sel-symbol-rule') || 'oscillator', params: null, seed: newSeedNum(), vary: { rotation: pc('chk-rule-rotation'), flip: pc('chk-rule-flip'), scale: pc('chk-rule-scale') } })
    : kind === 'arrange' ? (d ? JSON.parse(JSON.stringify(d.arrange)) : { rule: pv('sel-sym-arrange') || Object.keys(SYMBOL_ARRANGE)[0], live: true, pool: [], fit: pv('sel-sym-arrange-fit') || 'fill', seed: newSeedNum() })
    : (d ? JSON.parse(JSON.stringify(d.pattern)) : { patType: 'lines', patSpacing: 8, patWeight: 2, patAngle: 45 });
  if (kind === 'rule' && !v.params) v.params = SYMBOL_RULES[v.name].read();
  return (composing.draft[kind] = v);
}
const fieldVal = (el, f) => f.type === 'bool' ? el.checked : f.type === 'int' ? parseInt(el.value, 10) : f.type === 'float' ? parseFloat(el.value) : el.value;
function mountComposeFill(host, kind, comp) {
  const draft = composeDraft(comp, kind), editing = editedOfKind(comp, kind), n = composing.sel.size;
  const key = kind === 'rule' ? 'symbolRule' : kind;
  const push = () => {   // a change: live on the picked rule
    const r = editedOfKind(compNode(), kind); if (!r) return;
    r.do[key] = JSON.parse(JSON.stringify(draft)); const c = compNode(); ctl.touch(c.id); save();
    clearTimeout(composeCommitT); composeCommitT = setTimeout(() => ctl.commit('compose'), 400);
  };
  const seedRow = `<div class="ctrl-row"><div class="ctrl-label">Seed</div><input type="number" class="panel-input" id="fgc-seed" value="${draft.seed}" min="0" max="999999" step="1" aria-label="Seed"><button type="button" class="icon-btn" id="fgc-seed-random" aria-label="Random seed">${Organica.icons.get('refresh', { size: 'sm' })}</button></div>`;
  const apply = label => `<button type="button" class="mini-btn" id="fgc-apply" style="width:100%"${n ? '' : ' disabled'}>${editing ? 'Apply to a new rule' : label}</button>`;
  if (kind === 'rule') {
    const src = ctrl('sel-symbol-rule');
    host.innerHTML = `<div class="ctrl-row"><select class="panel-select" id="fgc-rule" aria-label="Rule">${[...src.options].map(o => `<option value="${o.value}"${o.value === draft.name ? ' selected' : ''}>${esc(o.textContent)}</option>`).join('')}</select></div>
      <div id="fgc-rule-params"></div>
      <div class="sub-label">Vary</div><div class="check-group">${[['rotation', 'Rotation'], ['flip', 'Flip'], ['scale', 'Scale']].map(([k, l]) => `<label class="check-row"><input type="checkbox" data-vary="${k}"${(draft.vary || {})[k] ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
      ${seedRow}${apply('Apply rule')}`;
    const rp = ctrl('rp-' + draft.name), box = ctrl('fgc-rule-params');
    if (rp) {   // the Symbol step's own controls for this rule, cloned with a prefix
      const c = rp.cloneNode(true); c.removeAttribute('style'); c.id = 'fgc-' + c.id;
      c.querySelectorAll('[id]').forEach(e => { e.id = 'fgc-' + e.id; }); c.querySelectorAll('[aria-labelledby]').forEach(e => e.removeAttribute('aria-labelledby'));   // named again by autoLabelPanel, not by Symbol's own labels c.querySelectorAll('label[for]').forEach(e => e.setAttribute('for', 'fgc-' + e.getAttribute('for')));
      box.appendChild(c);
      SYMBOL_RULES[draft.name].fields.forEach(f => {
        const el = ctrl('fgc-' + f.id); if (!el) return; const v = draft.params[f.key];
        if (f.type === 'bool') el.checked = !!v; else if (v != null) el.value = v;
        const out = ctrl('fgc-' + f.id.replace(/^rg-/, 'v-')); if (out && el.type === 'range') out.textContent = el.value;
        el.addEventListener(el.type === 'range' ? 'input' : 'change', () => { draft.params[f.key] = fieldVal(el, f); if (out && el.type === 'range') out.textContent = el.value; push(); });
      });
    }
    ctrl('fgc-rule').addEventListener('change', e => { draft.name = e.target.value; draft.params = SYMBOL_RULES[draft.name].read(); push(); renderComposeInspector('#fgc-rule'); });
    host.querySelectorAll('[data-vary]').forEach(c => c.addEventListener('change', () => { draft.vary = { ...(draft.vary || {}), [c.dataset.vary]: c.checked }; push(); }));
  } else if (kind === 'arrange') {
    const fit = ctrl('sel-sym-arrange-fit');
    host.innerHTML = `<div class="ctrl-row"><div class="ctrl-label">Arrange</div><select class="panel-select" id="fgc-arrange" aria-label="Arrangement">${Object.entries(SYMBOL_ARRANGE).map(([k, a]) => `<option value="${k}"${k === draft.rule ? ' selected' : ''}>${esc(a.label)}</option>`).join('')}</select></div>
      <div class="ctrl-row"><div class="ctrl-label">Fit</div><select class="panel-select" id="fgc-arrange-fit" aria-label="Fit in cell">${[...fit.options].map(o => `<option value="${o.value}"${o.value === draft.fit ? ' selected' : ''}>${esc(o.textContent)}</option>`).join('')}</select></div>
      ${seedRow}${apply('Arrange')}
      <p class="org-panel__hint">Places the content feeding the Figure by a rule — which one goes in each cell follows its column / row, ring, sector or band. Random picks by weight.</p>`;
    ctrl('fgc-arrange').addEventListener('change', e => { draft.rule = e.target.value; push(); });
    ctrl('fgc-arrange-fit').addEventListener('change', e => { draft.fit = e.target.value; push(); });
  } else {
    const rows = [selectRow('Pattern', 'fgc-pat-type', Object.entries(PATTERN_LABELS), draft.patType, v => { draft.patType = v; push(); })];
    [['patSpacing', 'Spacing', 3, 30, 0.5], ['patWeight', 'Weight', 0.5, 20, 0.5], ['patAngle', 'Angle', -90, 90, 1]].forEach(([k, l, a, b, st]) => rows.push(rangeRow(l, 'fgc-pat-' + k, a, b, st, draft[k], v => { draft[k] = v; push(); })));
    host.innerHTML = rows.map(r => r.html).join('') + apply('Apply pattern');
    rows.forEach(r => r.bind());
  }
  const seed = ctrl('fgc-seed');
  if (seed) {
    seed.addEventListener('change', () => { draft.seed = Math.max(0, +seed.value || 0); push(); });
    ctrl('fgc-seed-random').addEventListener('click', () => { draft.seed = newSeedNum(); seed.value = draft.seed; push(); });
  }
  ctrl('fgc-apply').addEventListener('click', () => {
    if (kind === 'arrange' && !figureContents(composing.fig).length) { Organica.notice('Connect a Content input to the Figure first'); return; }
    composing.draft = null; addComposeRule({ [key]: JSON.parse(JSON.stringify(draft)) });
  });
}

// ── Compose's target for the shared Cell properties block (Symbol's editor, Oct 8, 2026): the selected cells as the
// Figure draws them; an edit patches ONE region rule for this selection (the rule being edited if it covers the
// same cells, else a new one) — rotation / flip / scale / colour on the rule kinds that exist, the rest on do.cell.
const CELL_DO_KEYS = ['content', 'seed', 'rotate', 'flipH', 'flipV', 'scale', 'color', 'ink', 'cell'];
const isCellRule = r => r && r.do && Object.keys(r.do).length && Object.keys(r.do).every(k => CELL_DO_KEYS.includes(k));
const composeInks = () => { const pal = foundationOf(NC.findNode(ctl.model, composing.fig) || {})[2]; return pal ? (pal.params.colors || []) : []; };
let composeCommitT = 0;
const COMPOSE_CELLS = {
  count: () => composing ? composing.sel.size : 0,
  first: () => { const f = figureValue(composing.fig), cs = f && f.compose && f.compose.cells; return (cs && cs[Math.min(...composing.sel)]) || {}; },
  colors: () => { const f = figureValue(composing.fig); return (f && f.colors) || composeInks(); },
  apply: (patch, all) => {
    const when = all ? {} : selectionWhen(); if (!when) return;
    let p = typeof patch === 'function' ? patch(COMPOSE_CELLS.first()) : patch, key = JSON.stringify(when);
    if (p.source) {   // a pick in Choose content: the content (+ the window's Fit, an Element tile's turn / flip) — not Symbol's clean-slate resets
      const q = { source: p.source, fitMode: p.fitMode };
      if (p.source === 'component') q.componentName = p.componentName; else if (p.source === 'seed') { q.seedType = p.seedType; if ('seedParams' in p) q.seedParams = p.seedParams; }
      if (p.rotation) q.rotation = p.rotation; if (p.flipH) q.flipH = true; if (p.flipV) q.flipV = true;
      p = q;
    }
    let comp = compNode(), rs = comp ? comp.params.rules || [] : [];
    let i = composing.edit != null && isCellRule(rs[composing.edit]) && JSON.stringify(rs[composing.edit].when) === key ? composing.edit : rs.findIndex(r => isCellRule(r) && JSON.stringify(r.when) === key);
    if (i < 0) { addComposeRule({}, when, true); comp = compNode(); rs = comp.params.rules; i = rs.length - 1; }
    const d = rs[i].do;
    Object.entries(p).forEach(([k, v]) => {
      if (k === 'rotation') d.rotate = v;
      else if (k === 'flipH' || k === 'flipV' || k === 'scale') d[k] = v;
      else if (k === 'color') { delete d.color; delete d.ink; if (v) { const at = COMPOSE_CELLS.colors().map(h => h.toLowerCase()).indexOf(String(v).toLowerCase()); if (at >= 0) d.ink = at; else d.color = v; } }   // a palette ink by its place, so it follows the Palette
      else if (k === 'source') { delete d.seed; d.content = v === 'empty' ? 'empty' : v === 'component' ? { kind: 'component', name: p.componentName, entry: addContent('component', p.componentName).params.snapshot } : 'filled'; if (v === 'seed' && p.seedType) d.seed = p.seedType; }
      else if (k === 'seedType' || k === 'componentName') { /* carried by source */ }
      else { d.cell = d.cell || {}; d.cell[k] = v === undefined ? null : v; }
    });
    composing.edit = i;
    ctl.touch(comp.id); save();
    clearTimeout(composeCommitT); composeCommitT = setTimeout(() => ctl.commit('compose'), 400);   // a slider drag is one undo step
  },
  refresh: () => renderComposeInspector(),
  overflow: () => false,
  choose: () => openCellContentOverlay({ count: () => COMPOSE_CELLS.count(), apply: COMPOSE_CELLS.apply, done: () => renderComposeInspector() }),
  lock: false,
};
function selectionWhen() { return composing.when || (composing.sel.size ? cellsWhen(composing.sel) : null); }
function pickCells(i, e) {   // a click (or Space / Enter) on cell i — selects it; ⌘ / Shift adds or removes it (as in Symbol)
  const f = figureValue(composing.fig); if (!f || !f.compose) return;
  const add = e && (e.metaKey || e.ctrlKey || e.shiftKey);
  composing.when = null;
  if (add) { if (composing.sel.has(i)) composing.sel.delete(i); else composing.sel.add(i); }
  else composing.sel = new Set([i]);
  composing.anchor = i; composing.focus = i; drawCompose(); renderComposeInspector(); announceSelection();
}
function addComposeRule(d, when, quiet) {
  when = when || selectionWhen(); if (!when) { Organica.notice('Select cells first'); return; }
  let comp = compNode();
  if (!comp) {   // the first rule brings its Composition node and wire — one undo step with the rule
    const fig = NC.findNode(ctl.model, composing.fig);
    comp = NC.addNode(ctl.model, { type: 'composition', ...freeSpot(composeSpot(fig)), params: { rules: [] }, name: compositionName() });
    NC.addEdge(ctl.model, { node: comp.id, port: 'composition' }, { node: fig.id, port: 'composition' });
    composing.comp = comp.id; ctl.touch(fig.id); ctl.refresh();
  }
  comp.params.rules = (comp.params.rules || []).concat([{ when: JSON.parse(JSON.stringify(when)), do: d }]);
  composing.edit = comp.params.rules.length - 1;   // the rule the panel edits
  if (quiet) return;   // the caller fills it in, touches and commits
  ctl.touch(comp.id); ctl.commit('compose'); save(); renderComposeInspector();
}
// Region rule kinds (Phase 5b) — labels as the Symbol step says them (fvs/index.html #sel-symbol-rule) and Arrange's own.
const SYMBOL_RULE_LABELS = { oscillator: 'Oscillator (Truchet)', checkerboard: 'Checkerboard', rows: 'Rows', columns: 'Columns', radial: 'Radial', wave: 'Wave', orientation: 'Orientation (up / down triangles)', random: 'Random (transforms only)' };
const PATTERN_LABELS = { lines: 'Lines', crosshatch: 'Crosshatch', dots: 'Dots', concentric: 'Concentric' };
// The Palette node's Paper pattern (O-45): the Paper pattern section's controls and ranges (fvs/index.html #paper-pattern-block),
// minus Element (tile) — a Figure's texture is a pattern, its content is the Elements.
const PAPER_PATTERN_DEFAULT = { patType: 'lines', patSpacing: 4, patWeight: 0.75, patAngle: -45, ink: 0 };
function paperPatternRows(p) {
  const g = { ...PAPER_PATTERN_DEFAULT, ...(p.pattern || {}) };
  const range = (label, id, min, max, step, v) => `<div class="ctrl-row"><div class="ctrl-label">${label}</div><input type="range" id="fgi-pat-${id}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label}"><span class="ctrl-val" id="v-fgi-pat-${id}">${v}</span></div>`;
  return `<div class="ctrl-row"><div class="ctrl-label">Pattern</div><select class="panel-select" id="fgi-pat-type" aria-label="Paper pattern">${Object.entries(PATTERN_LABELS).map(([k, l]) => `<option value="${k}"${k === g.patType ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="ctrl-row"><div class="ctrl-label">Ink</div><select class="panel-select" id="fgi-pat-ink" aria-label="Paper pattern ink">${(p.colors || []).map((c, i) => `<option value="${i}"${i === g.ink ? ' selected' : ''}>Ink ${i + 1} · ${esc(c)}</option>`).join('')}</select></div>
    ${range('Spacing', 'spacing', 1.5, 30, 0.5, g.patSpacing)}${range('Weight', 'weight', 0.25, 20, 0.25, g.patWeight)}${g.patType !== 'concentric' ? range('Angle', 'angle', -90, 90, 1, g.patAngle) : ''}`;
}
function figureContents(figId) {   // the content feeding a Figure, as {kind, name, entry} — a Set's items included
  const out = [];
  ctl.model.edges.filter(e => e.to.node === figId && e.to.port === 'content').forEach(e => {
    const en = ctl.engine.get(e.from.node), c = en && en.value && en.value.content; if (!c) return;
    if (c.kind === 'set') out.push(...c.items); else out.push(c);
  });
  return out;
}
const cellAt = a => `row ${a[0] + 1}, column ${a[1] + 1}`;
function whereText(w) {
  if (w.at) return w.at.length === 1 ? cellAt(w.at[0]) : w.at.length + ' cells';
  if (w.index) return w.index.length === 1 ? 'cell ' + (w.index[0] + 1) : w.index.length + ' cells';
  const span = v => { v = [].concat(v); return v.length > 1 && v.every((x, k) => !k || x === v[k - 1] + 1) ? `${v[0] + 1}–${v[v.length - 1] + 1}` : v.map(x => x + 1).join(', '); };
  if (w.row && w.col) return `rows ${span(w.row)} × columns ${span(w.col)}`;
  return describeRule({ when: w, do: {} }).split(' → ')[0];
}
const FIT_WORDS = { contain: 'Contain', fill: 'Stretch', cover: 'Cover (no gaps)', fixed: 'Fixed size', match: 'Match cell' };
function cellRuleText(d, inks) {   // a Cell properties rule, in the panel's own words: "Rotation 90° · Padding 15"
  const out = [], c = d.cell || {};
  if (d.content === 'empty') out.push('Empty'); else if (d.content && typeof d.content === 'object') out.push(d.content.name); else if (d.content === 'filled') out.push(d.seed && SEED_TYPES[d.seed] ? SEED_TYPES[d.seed].label : 'Filled');
  if (d.rotate != null) out.push(`Rotation ${d.rotate}°`);
  if (d.flipH != null || d.flipV != null) out.push(d.flipH && d.flipV ? 'Flip both' : d.flipH ? 'Flip horizontal' : d.flipV ? 'Flip vertical' : 'No flip');
  if (c.fitMode) out.push(FIT_WORDS[c.fitMode] || c.fitMode);
  if (c.fixedSize != null) out.push(`Size ${c.fixedSize}`);
  if (d.scale != null) out.push(`Scale ${Math.round(d.scale * 100)}`);
  if (d.ink != null) out.push('Ink ' + (d.ink + 1)); else if (d.color) { const k = inks ? inks.indexOf(d.color) : -1; out.push(k >= 0 ? 'Ink ' + (k + 1) : 'Colour ' + d.color); }
  if (c.padding != null) out.push(`Padding ${Math.round(c.padding * 100)}`);
  if (c.anchorX != null || c.anchorY != null) { const x = c.anchorX || 0, y = c.anchorY || 0; out.push(`Anchor ${x < 0 ? 'left' : x > 0 ? 'right' : 'centre'} ${y < 0 ? 'top' : y > 0 ? 'bottom' : 'middle'}`); }
  if ('seedParams' in c) out.push(c.seedParams ? 'Shape: Element settings' : 'Shape: Default');
  return out.join(' · ') || 'No change';
}
function describeComposeRule(r, inks) {
  const w = r.when || {}, d = r.do || {};
  const where = whereText(w);
  if (isCellRule(r)) return where + ' → ' + cellRuleText(d, inks);
  const ink = d.color && inks ? inks.indexOf(d.color) : -1;
  const what = d.content && typeof d.content === 'object' ? d.content.name : d.toggle ? 'Swap empty / filled' : d.ink != null ? 'Ink ' + (d.ink + 1) : d.color ? (ink >= 0 ? 'Ink ' + (ink + 1) : inks ? 'Colour ' + d.color : 'Colour')
    : d.symbolRule ? 'Symbol rule: ' + (SYMBOL_RULE_LABELS[d.symbolRule.name] || d.symbolRule.name)
    : d.arrange ? 'Arrange: ' + ((SYMBOL_ARRANGE[d.arrange.rule] || {}).label || d.arrange.rule) + (d.arrange.live ? ' · the Figure’s content' : ' · ' + d.arrange.pool.length + ' items')
    : d.paste ? 'Symbol: ' + d.paste.name
    : d.pattern ? 'Pattern: ' + (PATTERN_LABELS[d.pattern.patType] || d.pattern.patType) : describeRule({ when: {}, do: d }).split(' → ')[1];
  return where + ' → ' + what;
}
// The inks a Composition's colour rules read: the Palette of the first Figure it feeds (none → the rule reads "Colour").
function compInks(comp) {
  const e = ctl.model.edges.find(w => w.from.node === comp.id && w.to.port === 'composition'), fig = e && NC.findNode(ctl.model, e.to.node);
  const pal = fig ? foundationOf(fig)[2] : null; return pal ? (pal.params.colors || []) : null;
}
function renderComposeInspector(next) {
  const box = ctrl('fg-inspector'); if (!box || !composing) return;
  ctrl('btn-fg-compose-undo').disabled = !ctl.history.canUndo(); ctrl('btn-fg-compose-redo').disabled = !ctl.history.canRedo();
  // a rebuild keeps what you were on: the focused control and the "They get" choice
  const a = document.activeElement, keep = box.contains(a) ? (a.id ? '#' + a.id : a.dataset.act ? `[data-act="${a.dataset.act}"][data-i="${a.dataset.i}"]` : null) : null;
  const comp = compNode(), rules = comp ? comp.params.rules || [] : [], f = figureValue(composing.fig);
  const pal = foundationOf(NC.findNode(ctl.model, composing.fig) || {})[2], inks = pal ? (pal.params.colors || []) : [];
  const n = composing.sel.size, shared = sharedWith(comp), fill = composing.fill || 'manual';
  const cfig = NC.findNode(ctl.model, composing.fig), cpar = cfig && cfig.type === 'figure-var' ? parentNode(cfig) : null;   // composing a variation
  box.innerHTML = `<div class="panel-section"><h3>Composition</h3>
    ${shared.length ? (cpar ? `<p class="org-panel__hint">Shared with ${esc(shared.map(nodeLabel).join(', '))} — edits change ${esc(nodeLabel(cpar))} and every variation that uses it.</p>
    <div class="row-btns"><button type="button" class="mini-btn" id="fgc-copy">Make a copy for this variation</button></div>` : `<p class="org-panel__hint">Shared with ${esc(shared.map(nodeLabel).join(', '))} — edits change ${shared.length === 1 ? 'both Figures' : 'all of them'}.</p>
    <div class="row-btns"><button type="button" class="mini-btn" id="fgc-copy">Make a copy for this Figure</button></div>`) : ''}
    <p class="org-panel__hint">Selection: ${n} ${n === 1 ? 'cell' : 'cells'}${composing.when ? ' — ' + esc(whereText(composing.when)) : n === 1 ? ' — ' + esc(whereText(selectionWhen())) : ''}</p>
    </div>
    <div class="panel-section"><h3>Fill</h3>
    <div class="ctrl-row"><select class="panel-select" id="fgc-fill" aria-label="Fill mode">${COMPOSE_FILLS.map(([k, l]) => `<option value="${k}"${k === fill ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    ${fill === 'manual' ? `<p class="org-panel__hint">Click a cell to select it; drag to select several; ⌘-click (Ctrl-click on Windows) adds or removes a cell. Click a selected cell again to choose its content, for the whole selection. Every change below applies to the selection, as one region rule.</p>
    ${n && f && f.compose && f.compose.cells ? `<div id="fgc-cell-props">${cellPropsHTML('fgc-', { lock: false })}</div>` : `<div class="org-empty">No cell selected.</div>`}` : `<div id="fgc-fill-block"></div>`}
    </div>
    <div class="panel-section"><h3>Region rules</h3>
    <div class="fg-list" role="list" id="fgc-rules">${rules.length ? rules.map((r, i) => `<div class="org-layer-card org-layer-card--flush${r.off ? ' is-off' : ''}${rules.length > 1 ? ' is-draggable' : ''}" role="listitem" data-i="${i}"><div class="org-layer-card__head">${rules.length > 1 ? GRIP() : ''}<button type="button" class="org-layer-card__title fg-rule__pick" data-act="pick" data-i="${i}" aria-label="Select the cells of region rule ${i + 1}: ${esc(describeComposeRule(r, inks))}">${esc(describeComposeRule(r, inks))}</button>
      ${r.do && (r.do.symbolRule || r.do.arrange) ? `<button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="seed" data-i="${i}" aria-label="New random seed for region rule ${i + 1}">${Organica.icons.get('refresh')}</button>` : ''}
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="off" data-i="${i}" aria-pressed="${!r.off}" aria-label="Region rule ${i + 1} on">${Organica.icons.get(r.off ? 'eye-off' : 'eye')}</button>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="del" data-i="${i}" aria-label="Delete region rule ${i + 1}">${Organica.icons.get('trash')}</button></div></div>`).join('') : '<p class="org-panel__hint">No region rules yet — select cells, then set them in Fill, or drop a saved item on a cell.</p>'}</div>
    <div id="fgc-lost">${f && f.lost && f.lost.length ? f.lost.filter(l => rules[l.rule]).map(l => `<div class="fg-lost"><p class="org-panel__hint fg-warn">Region rule ${l.rule + 1} (${esc(describeComposeRule(rules[l.rule], inks))}): ${l.cells.length ? esc(l.cells.map(x => Array.isArray(x) ? cellAt(x) : 'cell ' + (x + 1)).join(', ')) + (l.cells.length === 1 ? ' is' : ' are') + ' not in this grid any more' : 'it matches no cell in this grid'} — kept but not drawn.</p>
      <button type="button" class="mini-btn" data-act="del" data-i="${l.rule}">Delete region rule ${l.rule + 1}</button></div>`).join('') : ''}</div>
    <p class="org-panel__hint">A rule reads each cell’s place in the whole grid, so a wave over a region continues the Figure’s wave. Arrange lays out the content feeding the Figure, as it is now. Pick a region rule to see and change its settings.</p>
    <p class="org-panel__hint">Rules apply in order: a later rule wins on the cells it matches. Esc clears the selection, then leaves Compose.</p></div>`;
  const back = next || keep; if (back) { const el = box.querySelector(back); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  ctrl('fgc-fill').addEventListener('change', e => { composing.fill = e.target.value; renderComposeInspector('#fgc-fill'); });
  if (ctrl('fgc-fill-block')) mountComposeFill(ctrl('fgc-fill-block'), fill, comp);
  if (ctrl('fgc-copy')) ctrl('fgc-copy').addEventListener('click', copyComposition);
  const onRule = e => {
    const b = e.target.closest('[data-act]'); if (!b || !comp) return; const i = +b.dataset.i, rs = comp.params.rules;
    if (b.dataset.act === 'pick') { composing.edit = i; composing.fill = fillOf(rs[i]); composing.draft = null; const f = figureValue(composing.fig), ctxs = f && f.compose ? f.compose.ctxs : []; composing.when = JSON.parse(JSON.stringify(rs[i].when || {})); composing.sel = new Set(ctxs.filter(c => ruleMatches(composing.when, c)).map(c => c.index)); drawCompose(); renderComposeInspector(`[data-act="pick"][data-i="${i}"]`); announceSelection(); return; }
    if (b.dataset.act === 'seed') { const k = rs[i].do.symbolRule ? 'symbolRule' : 'arrange'; rs[i].do[k].seed = 1 + Math.floor(Math.random() * 99999); }
    else if (b.dataset.act === 'off') rs[i].off = !rs[i].off;
    else if (b.dataset.act === 'del') rs.splice(i, 1);
    ctl.touch(comp.id); ctl.commit('compose'); save();   // focus follows the chip (after a Delete: the next one)
    renderComposeInspector(b.dataset.act === 'del' ? (rs.length ? `[data-act="del"][data-i="${Math.min(i, rs.length - 1)}"]` : '#fgc-fill') : `[data-act="${b.dataset.act}"][data-i="${i}"]`);
  };
  ctrl('fgc-rules').addEventListener('click', onRule); ctrl('fgc-lost').addEventListener('click', onRule);
  if (ctrl('fgc-cell-props')) { syncCellProps('fgc-', COMPOSE_CELLS); bindCellProps('fgc-', COMPOSE_CELLS); }
  if (comp) reorderable(ctrl('fgc-rules'), comp.params.rules, to => { ctl.touch(comp.id); ctl.commit('compose'); save(); renderComposeInspector(`.org-layer-card[data-i="${to}"] .fg-rule__pick`); });
  const hint = i => {   // hover / focus a chip: its cells are outlined on the stage
    const f = figureValue(composing.fig), ctxs = f && f.compose ? f.compose.ctxs : [], w = i != null && rules[i] ? rules[i].when || {} : null;
    ctrl('fg-compose-stage').querySelectorAll('.fg-cell').forEach(c => c.classList.toggle('is-hint', !!w && !!ctxs[+c.dataset.i] && ruleMatches(w, ctxs[+c.dataset.i])));
  };
  ctrl('fgc-rules').querySelectorAll('.fg-rule__pick').forEach(b => {
    ['pointerenter', 'focus'].forEach(t => b.addEventListener(t, () => hint(+b.dataset.i)));
    ['pointerleave', 'blur'].forEach(t => b.addEventListener(t, () => hint(null)));
  });
  if (Organica.autoLabelPanel) Organica.autoLabelPanel(box);   // Cell properties + the cloned rule controls get their names from their labels
}
// ── Compose floatbar — the Symbol step's Fit in cell + View groups (Oct 8, 2026). Fit / Anchor act on the selection,
// or on every cell when none is selected (the label says which), as one region rule; View: the cells' outlines, and the
// Figure's own Clip to cell. (Symbol's cover-crop view needs the Figure to draw it — not yet.)
const FITS = [['contain', 'Contain'], ['fill', 'Stretch'], ['cover', 'Cover'], ['fixed', 'Fixed size'], ['match', 'Match cell']];
function buildComposeFloatbar() {
  const host = ctrl('fb-compose-actions');
  host.insertAdjacentHTML('beforeend', `<span class="org-floatbar__group" role="group" aria-label="Fit in cell">${FITS.map(([k, l]) => `<button class="org-floatbar__btn" id="btn-fgc-fit-${k}" data-fit="${k}" data-fit-name="${l}" aria-pressed="false" aria-label="${l} · all cells">${Organica.icons.get('fvs-' + k)}</button>`).join('')}
    <div class="org-popover-wrap"><button class="org-floatbar__btn" id="btn-fgc-anchor" aria-label="Anchor · all cells"><svg class="ico" id="ico-fgc-anchor" data-icon-slot viewBox="0 0 16 16" fill="none" aria-hidden="true"></svg></button>
    <div class="fvs-flyout" id="fgc-anchor-popover" aria-label="Anchor position">${[[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([ax, ay]) => `<button type="button" class="fvs-flyout__tool" data-on="false" data-ax="${ax}" data-ay="${ay}" aria-label="Anchor ${ax < 0 ? 'left' : ax > 0 ? 'right' : 'centre'} ${ay < 0 ? 'top' : ay > 0 ? 'bottom' : 'middle'}"><span></span></button>`).join('')}</div></div></span>
    <span class="org-floatbar__sep" aria-hidden="true"></span>
    <span class="org-floatbar__group" role="group" aria-label="View">
    <button class="org-floatbar__btn" id="btn-fgc-view-outline" aria-pressed="false" aria-label="Show grid">${Organica.icons.get('fvs-grid')}</button>
    <button class="org-floatbar__btn" id="btn-fgc-view-clip" aria-pressed="true" aria-label="Clip to cell">${Organica.icons.get('fvs-clip')}</button></span>
    <span class="org-floatbar__sep" aria-hidden="true"></span>`);
  const pop = Organica.popover(ctrl('btn-fgc-anchor'), ctrl('fgc-anchor-popover'));
  FITS.forEach(([k]) => ctrl('btn-fgc-fit-' + k).addEventListener('click', () => {
    if (!composing) return; const all = !composing.sel.size, first = COMPOSE_CELLS.first();
    COMPOSE_CELLS.apply({ fitMode: k, ...(k === 'cover' ? { coverAxis: 'auto' } : k === 'fixed' ? { fixedSize: first.fixedSize || 100 } : {}) }, all); renderComposeInspector();
  }));
  ctrl('fgc-anchor-popover').addEventListener('click', e => { const b = e.target.closest('[data-ax]'); if (!b || !composing) return; COMPOSE_CELLS.apply({ anchorX: +b.dataset.ax, anchorY: +b.dataset.ay }, !composing.sel.size); pop.close(); renderComposeInspector(); });
  ctrl('btn-fgc-view-outline').addEventListener('click', e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on)); ctrl('fg-compose-stage').classList.toggle('is-outlined', on); });
  ctrl('btn-fgc-view-clip').addEventListener('click', () => { const fig = composing && NC.findNode(ctl.model, composing.fig); if (!fig) return; fig.params.clip = fig.params.clip === false; ctl.touch(fig.id); ctl.commit('compose'); save(); syncComposeFloatbar(); });
}
function syncComposeFloatbar() {
  if (!composing || !ctrl('btn-fgc-fit-contain')) return;
  const f = figureValue(composing.fig), cs = (f && f.compose && f.compose.cells) || [], n = composing.sel.size;
  const who = n ? `${n} selected cell${n === 1 ? '' : 's'}` : 'all cells', idx = n ? [...composing.sel] : cs.map((_, i) => i);
  const cells = idx.map(i => cs[i]).filter(c => c && c.source !== 'empty'), nothing = !cells.length;
  const shared = fn => cells.length && cells.every(c => fn(c) === fn(cells[0])) ? fn(cells[0]) : null;
  const fit = shared(c => c.fitMode || 'contain'), ax = shared(c => c.anchorX || 0), ay = shared(c => c.anchorY || 0);
  FITS.forEach(([k]) => { const b = ctrl('btn-fgc-fit-' + k); b.setAttribute('aria-pressed', String(fit === k)); b.setAttribute('aria-label', `${b.dataset.fitName} · ${who}${nothing ? ' — nothing to fit (empty)' : ''}`); b.disabled = nothing; });
  const a = ctrl('btn-fgc-anchor'); a.setAttribute('aria-label', 'Anchor · ' + who + (nothing ? ' — nothing to fit (empty)' : '')); a.disabled = nothing;
  ctrl('fgc-anchor-popover').querySelectorAll('[data-ax]').forEach(b => { b.dataset.on = String(ax != null && ay != null && +b.dataset.ax === ax && +b.dataset.ay === ay); });
  ctrl('ico-fgc-anchor').innerHTML = '<rect x="2.5" y="2.5" width="11" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/>' + (ax != null && ay != null ? `<circle cx="${8 + ax * 3}" cy="${8 + ay * 3}" r="1.5" fill="currentColor"/>` : '<path d="M6 8h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>');
  const fig = NC.findNode(ctl.model, composing.fig); ctrl('btn-fgc-view-clip').setAttribute('aria-pressed', String(!fig || fig.params.clip !== false));
}
function initCompose() {
  buildComposeFloatbar();
  const stage = ctrl('fg-compose-stage');
  // The Symbol step's gestures (11-symbol-ui bindSymbolCanvasSelection): drag = marquee (⌘ / Shift adds), click selects,
  // a click on a cell already selected opens Choose content for the selection, a click off the cells clears.
  let press = null;
  const addKey = e => e.metaKey || e.ctrlKey || e.shiftKey;
  const svgPt = e => { const svg = stage.querySelector('svg.fg-compose__svg'), m = svg && svg.getScreenCTM(); return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null; };
  stage.addEventListener('mousedown', e => { if (e.button !== 0 || !composing) return; const pt = svgPt(e); if (!pt) return; e.preventDefault(); press = { pt, moved: false, base: addKey(e) ? [...composing.sel] : [] }; });
  window.addEventListener('mousemove', e => {
    if (!press || !composing) return; const pt = svgPt(e); if (!pt) return;
    if (!press.moved && Math.hypot(pt.x - press.pt.x, pt.y - press.pt.y) > 5) press.moved = true;
    if (!press.moved) return;
    const r = { x: Math.min(press.pt.x, pt.x), y: Math.min(press.pt.y, pt.y), w: Math.abs(pt.x - press.pt.x), h: Math.abs(pt.y - press.pt.y) };
    const f = figureValue(composing.fig), outs = f && f.compose ? f.compose.outlines : [];
    const hits = outs.map((ps, i) => { const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]); return Math.min(...xs) < r.x + r.w && Math.max(...xs) > r.x && Math.min(...ys) < r.y + r.h && Math.max(...ys) > r.y ? i : -1; }).filter(i => i >= 0);
    composing.marquee = r; composing.when = null; composing.sel = new Set([...press.base, ...hits]);
    drawCompose(); renderComposeInspector();
  });
  window.addEventListener('mouseup', e => {
    if (!press || !composing) { press = null; return; }
    const was = press.moved; press = null;
    if (was) { composing.marquee = null; drawCompose(); announceSelection(); return; }   // a drag builds a selection — it never opens Choose content
    const c = e.target.closest && e.target.closest('#fg-compose-stage .fg-cell');
    if (!c) { if (!addKey(e) && composing.sel.size) { composing.sel.clear(); composing.when = null; drawCompose(); renderComposeInspector(); announceSelection(); } return; }
    const i = +c.dataset.i;
    if (!addKey(e) && composing.sel.has(i)) { COMPOSE_CELLS.choose(); return; }   // click again → Choose content
    pickCells(i, e);
  });
  ctrl('fg-compose-back').addEventListener('click', exitCompose);
  ctrl('btn-fg-compose-done').addEventListener('click', exitCompose);
  ctrl('btn-fg-compose-undo').innerHTML = Organica.icons.get('undo'); ctrl('btn-fg-compose-redo').innerHTML = Organica.icons.get('redo');
  ctrl('btn-fg-compose-undo').addEventListener('click', () => { ctl.undo(); if (composing) { drawCompose(); renderComposeInspector(); } });
  ctrl('btn-fg-compose-redo').addEventListener('click', () => { ctl.redo(); if (composing) { drawCompose(); renderComposeInspector(); } });
  // drop a saved item on a cell (or on the selection it belongs to)
  document.addEventListener('keydown', e => {
    if (!composing || state.activeTier !== 'figure' || (e.target.closest && e.target.closest('input, select, textarea, .org-popover, [role=dialog], .nc-search'))) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (openCat) { setNodebar(null); return; }
      if (composing.sel.size) { composing.sel.clear(); composing.when = null; drawCompose(); renderComposeInspector(); announceSelection(); } else exitCompose();
      return;
    }
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && (k === 'z' || k === 'y')) { e.preventDefault(); e.stopPropagation(); (k === 'y' || e.shiftKey) ? ctl.redo() : ctl.undo(); drawCompose(); renderComposeInspector(); return; }
    const cell = e.target.closest && e.target.closest('#fg-compose-stage .fg-cell');
    if (cell) {   // the keyboard path: arrows move between cells, Space / Enter select (Shift / ⌘ add)
      const f = figureValue(composing.fig), ctxs = f && f.compose ? f.compose.ctxs : [], i = +cell.dataset.i, c = ctxs[i];
      let to = null;
      if (e.key === 'ArrowRight') to = Math.min(ctxs.length - 1, i + 1);
      else if (e.key === 'ArrowLeft') to = Math.max(0, i - 1);
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && c) { const r = c.row + (e.key === 'ArrowDown' ? 1 : -1), hit = ctxs.find(x => x.row === r && x.col === c.col) || ctxs.find(x => x.row === r); if (hit) to = hit.index; }
      if (to != null) { e.preventDefault(); composing.focus = to; drawCompose(); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pickCells(i, e); return; }
    }
  }, true);
}
// A saved item dropped from the dock onto a Compose cell: called by the node bar's drag (initNodebar).
// A rail item on cell idx (a dragged tile) or on the selection (a click): a content region rule, after the others so it
// wins over them; a cell inside the selection takes the whole selection (as Symbol's railApply).
function composeRailApply(kind, name, idx) {
  if (!composing) return;
  if (kind === 'symbol') {   // a saved Symbol, cell by cell — its 4 central cells start at the dropped-on cell (or the first selected one)
    const f = figureValue(composing.fig), ctxs = f && f.compose ? f.compose.ctxs : null, entry = SYMBOL_LIBRARY.read()[name];
    const i = idx != null ? idx : composing.sel.size ? Math.min(...composing.sel) : null; if (!ctxs || !entry || i == null || !ctxs[i]) return;
    const at = [ctxs[i].row, ctxs[i].col], plan = symbolPastePlan(entry, ctxs, at); if (!plan.length) return;
    const components = {}; plan.forEach(([, c]) => { if (c.source === 'component' && c.componentName && !components[c.componentName]) { const s = addContent('component', c.componentName).params.snapshot; if (s) components[c.componentName] = s; } });
    addComposeRule({ paste: { name, at, entry: { gridModel: entry.gridModel, cells: entry.cells }, components } }, cellsWhen(plan.map(p => p[0])));
    return;
  }
  if (kind !== 'element' && kind !== 'component') return;
  const when = idx != null && !composing.sel.has(idx) ? cellsWhen([idx]) : selectionWhen(); if (!when) return;   // no cell selected: a click does nothing, as in Symbol
  const c = addContent(kind, name); if (!c.params.snapshot) return;
  addComposeRule({ content: { kind, name, entry: c.params.snapshot } }, when);
}
function composeDrop(spec, clientX, clientY) {
  if (!composing || !spec || (spec.type !== 'element' && spec.type !== 'component')) return false;
  const hit = document.elementFromPoint(clientX, clientY), cell = hit && hit.closest && hit.closest('#fg-compose-stage .fg-cell'); if (!cell) return false;
  const i = +cell.dataset.i, when = composing.sel.has(i) ? selectionWhen() : cellsWhen([i]);
  addComposeRule({ content: { kind: spec.type, name: spec.params.name, entry: spec.params.snapshot } }, when);
  return true;
}

// ── persistence: the current graph autosaves; the view (zoom, pan) is per browser ──
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const all = GRAPHS.read(); all[CURRENT] = { model: ctl.model, name: graphMenu ? graphMenu.name() : graphName, savedAt: new Date().toISOString() }; GRAPHS.write(all);
    if (graphMenu) graphMenu.sync();   // the unsaved dot + Organica.dirty
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ zoom: ctl.zoomPan.zoom, ...ctl.zoomPan.pan })); } catch (e) {}
  }, 400);
}
function loadModel() {
  const e = GRAPHS.read()[CURRENT];
  graphName = (e && e.name) || '';
  return ensureNames(e && e.model ? safeModel(e.model) : starterModel());
}
// Rules became a chain (Diego, Oct 9, 2026): a graph saved before, with several rule wires into one Figure, is rewired
// as one chain in the order the old engine applied them — so it draws as before: the first Component rule, then every
// Cell rules (in wire order), every Repeat in grid (in wire order), the last Rotate & mirror. What the old engine
// ignored (a second Component rule, an earlier Rotate & mirror) stays on the board, unwired. A rule node that also fed
// elsewhere is copied for this Figure, so no other Figure changes. Returns the model; chainRules.rewired = Figures rewired.
const RULE_TYPES = new Set(['cell-rules', 'component-rule', 'repeat', 'transform']);
export function chainRules(src) {
  const m = { ...src, nodes: (src.nodes || []).slice(), edges: (src.edges || []).slice() };
  let rewired = 0;
  m.nodes.filter(n => n.type === 'figure' || n.type === 'figure-var').forEach(fig => {
    const ins = m.edges.filter(e => e.to.node === fig.id && e.to.port === 'rules');
    if (ins.length < 2 || !ins.every(e => { const n = NC.findNode(m, e.from.node); return n && RULE_TYPES.has(n.type); })) return;
    const of = t => ins.map(e => NC.findNode(m, e.from.node)).filter(n => n.type === t);
    const reps = of('repeat'), lastRep = reps[reps.length - 1], lp = (lastRep && lastRep.params) || {};
    const ownTurn = lastRep && ((+lp.rotate || 0) || (lp.mirror && lp.mirror !== 'none'));   // the old engine ignored Rotate & mirror when the last Repeat had its own
    const order = [...of('component-rule').slice(0, 1), ...of('cell-rules'), ...reps, ...(ownTurn ? [] : of('transform').slice(-1))];
    m.edges = m.edges.filter(e => !ins.includes(e));
    let prev = null;
    order.forEach(n0 => {
      let n = n0;
      if (m.edges.some(w => w.from.node === n.id) || m.edges.some(w => w.to.node === n.id && w.to.port === 'rules')) {
        n = { ...JSON.parse(JSON.stringify(n0)), id: NC.nextId('n'), x: n0.x, y: n0.y + 96 }; m.nodes.push(n);
      }
      if (prev) m.edges.push({ id: NC.nextId('e'), from: { node: prev.id, port: 'rules' }, to: { node: n.id, port: 'rules' } });
      prev = n;
    });
    m.edges.push({ id: NC.nextId('e'), from: { node: prev.id, port: 'rules' }, to: { node: fig.id, port: 'rules' } });
    rewired++;
  });
  chainRules.rewired = rewired;
  return m;
}
// Variations became a node (Diego, Oct 9, 2026): a Figure saved with Variations above 1 gets a Variations node with its
// settings (count, Vary by, seed, Keep, pins, per item); its children and the Exports that took its variations move to
// it — the board draws as before. The Figure keeps only what is its own (fit, clip, own colours, fixed changes).
const VAR_KEYS = ['variations', 'varyBy', 'seed', 'keep', 'pins', 'fanOut'];
export function variationsNodes(src) {
  const m = { ...src, nodes: (src.nodes || []).map(n => ({ ...n })), edges: (src.edges || []).slice() };
  let moved = 0;
  m.nodes.slice().filter(n => n.type === 'figure').forEach(fig => {
    const p = fig.params || {}, count = p.variations == null ? (VAR_KEYS.some(k => k in p) ? 4 : 1) : +p.variations;
    const kids = m.edges.filter(e => e.from.node === fig.id && e.to.port === 'from');
    if (count > 1 || kids.length) {
      const vp = { variations: count - 1 }; VAR_KEYS.slice(1).forEach(k => { if (k in p) vp[k] = JSON.parse(JSON.stringify(p[k])); });
      const vn = { id: NC.nextId('n'), type: 'variations', x: fig.x + 416 + LABEL_ROOM, y: fig.y, params: vp, name: nextName(m, 'variations') };
      m.nodes.push(vn);
      m.edges = m.edges.map(e => e.from.node === fig.id && (e.to.port === 'from' || e.to.port === 'figures') ? { ...e, from: { node: vn.id, port: 'figure' } } : e);
      m.edges.push({ id: NC.nextId('e'), from: { node: fig.id, port: 'figure' }, to: { node: vn.id, port: 'figure' } });
      m.nodes.filter(n => n.type === 'figure-var' && n.params && n.params.parent === fig.id).forEach(n => { n.params = { ...n.params, parent: vn.id }; });
      moved++;
    }
    if (VAR_KEYS.some(k => k in p) || 'layout' in p) { const q = { ...p }; VAR_KEYS.forEach(k => delete q[k]); delete q.layout; fig.params = q; }
  });
  variationsNodes.moved = moved;
  return m;
}
const chainNotice = () => {
  const said = [chainRules.rewired ? `the Rules of ${chainRules.rewired === 1 ? 'one Figure are' : chainRules.rewired + ' Figures are'} now a chain` : '', variationsNodes.moved ? `${variationsNodes.moved === 1 ? 'one Figure’s variations are now a Variations node' : variationsNodes.moved + ' Figures’ variations are now Variations nodes'}` : ''].filter(Boolean);
  if (said.length) Organica.notice(said.join('; ').replace(/^./, c => c.toUpperCase()) + ' — drawing as before');
};
// A stored or opened graph, made safe to run (unknown nodes, broken or looping wires dropped) — said, not silent.
function safeModel(m) {
  const r = NC.repairModel(variationsNodes(chainRules(m)), registry), d = r.dropped; chainNotice();
  const t = NC.droppedText(d); if (t) Organica.notice(t, { kind: 'error' });
  return r.model;
}
// A recipe file → a graph, or the reason it can't be one (an old v1 file; hand-placed cells a graph has no node for yet).
function recipeProblem(def) {
  if (def.version !== 2) return 'This recipe is from an older version of FVS and can’t be opened as a graph';
  try { validateFigureRecipe(def); } catch (e) { return 'This recipe can’t be opened: ' + e.message; }
  const f = def.levels[0];
  if (isSealedSymbol(f) || (f.lattice && f.lattice.type === 'loomModel') || (f.kind === 'component' && Array.isArray(f.cells)) || f.seed === 'live') return 'This recipe places its cells by hand — a graph can’t show that yet';
  return null;
}
function syncButtons() {
  ctrl('btn-fg-undo').disabled = !ctl.history.canUndo();
  ctrl('btn-fg-redo').disabled = !ctl.history.canRedo();
  const sel = ctl.selection(), why = sel.map(id => protect(NC.findNode(ctl.model, id), ctl.model, sel)).filter(Boolean)[0];
  const del = ctrl('btn-fg-delete'), refused = !sel.length || (sel.length === 1 && !!why);
  del.setAttribute('aria-disabled', String(refused));
  ctrl('fg-delete-why').textContent = !sel.length ? 'Select a node first' : (why || '');
  if (refused) del.setAttribute('aria-describedby', 'fg-delete-why'); else del.removeAttribute('aria-describedby');
}

// ── Graph menu (floatbar) — Organica.nodeCanvas.graphMenu: Saved graphs · Graph name · Save · Delete · New graph ·
// Open file… · Save as file. FVS adds: the autosave slot is not a saved graph, and a Figure recipe file opens as a graph. ──
let graphMenu = null;
function initGraphMenu() {
  graphMenu = NC.graphMenu({
    els: { button: ctrl('btn-fg-graph'), popover: ctrl('fg-graph-popover'), saved: ctrl('fg-graph-saved'), name: ctrl('fg-graph-name'), save: ctrl('fg-graph-save'),
      del: ctrl('fg-graph-delete'), newGraph: ctrl('fg-graph-new'), open: ctrl('fg-graph-open'), file: ctrl('fg-graph-file'), input: ctrl('fg-graph-input') },
    store: GRAPHS, getModel: () => ctl.model, hidden: n => n === CURRENT,
    normalize: m => ensureNames(safeModel(m)),
    load: (model) => { ctl.setModel(variationsNodes(chainRules(model))); chainNotice(); if (syncChildren()) ctl.commit('sync', { amend: true }); renderInspector([]); syncButtons(); requestAnimationFrame(() => { if (variationsNodes.moved) restackAll(); ctl.fitAll(); }); },
    fileTool: 'fvs-figure-graph', fileName: 'fvs-graph', dirtyKey: 'fvs-figure-graph',
    openFile: data => { if (!data || data.tool !== 'fvs-recipe') return false; const why = recipeProblem(data); if (why) { Organica.notice(why, { kind: 'error' }); return true; } openBuiltin(data); Organica.notice('Recipe opened as a graph'); return true; },
    onSaved: () => save(),
  });
  graphMenu.setName(graphName);
}

export function renderFigureGraph() {
  if (ctl) { if (composing) { ctrl('fb-figure-actions').style.display = 'none'; ctrl('fb-compose-actions').style.display = ''; drawCompose(); renderComposeInspector(); } else ctl.refresh(); return; }
  rt.figureGraph = true;
  document.querySelector('.tier-view[data-tier="figure"]').classList.add('is-graph');
  document.querySelector('.tier-block[data-tier="figure"]').classList.add('is-graph');
  ctl = NC.mount({
    stage: ctrl('fg-graph'), registry, model: loadModel(),
    isActive: () => state.activeTier === 'figure' && !composing && !document.body.classList.contains('fvs-libview-open'),   // Compose owns the keyboard (its own handler below)
    renderBody, cardClass, nodeLabel, protect,
    fitInset: { left: 88, bottom: 72 },   // the node bar (left dock) and the floatbar
    wireLabel: (e, m) => { const src = NC.findNode(m, e.from.node); return src && src.type === 'set' ? '×' + ((src.params || {}).items || []).length : ''; },   // UI-COPY: the Set's wire is labelled ×n
    wireClass: (e, m) => { const src = NC.findNode(m, e.from.node); return !src ? '' : ['canvas', 'grid', 'palette'].includes(src.type) ? 'nc-wire--faint' : src.type === 'set' ? 'nc-wire--list' : ''; },
    onSelect: ids => { if (!composing) renderInspector(ids); syncButtons(); },   // in Compose the panel is Compose's
    onChange: (m, reason) => { childrenAfter(reason); syncButtons(); save(); if (reason !== 'move' && reason !== 'params') { if (composing) renderComposeInspector(); else renderInspector(ctl.selection()); } },
    onSearch: (at, from, client) => openSearch(at, from, client),
    onWireDrop: (from, at, client) => openSearch(at, from, client),
    onBoardDblClick: (at, client) => openSearch(at, null, client),
    onPortDblClick: (node, port, dir) => spawnFor(node, port, dir),
    nameCopy: (copy, model) => { if (copy.type === 'variations') { copy.params.seed = newSeed(); copy.params.pins = []; } return NUMBERED.includes(copy.type) ? nextName(model, copy.type) : copy.name; },
    keyScope: t => !!(t && t.closest && t.closest('#fb-figure-actions, #fg-nodebar-dock') && !t.closest('input, select, textarea')),   // not the panel: Delete on a panel button must not delete the node
    onNodeDblClick: node => { if (node.type === 'figure' || node.type === 'figure-var') enterCompose(node.id); },   // a variation composes too (Diego, Oct 8 — O-56 a)
    keepActive: n => !!(composing && n.id === composing.fig) || (ctl && (n.type === 'figure' || n.type === 'figure-var' || n.type === 'variations') && [n, n.type === 'figure-var' && sourceOf(n)].some(x => x && ctl.model.edges.some(e => e.from.node === x.id && e.to.port === 'figures'))),   // a Figure / Variations wired to Export is computed off screen too, with the children (they draw its variations)
  });
  try { const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); if (v) ctl.zoomPan.setView({ zoom: v.zoom, panX: v.x, panY: v.y }); else requestAnimationFrame(() => ctl.fitAll()); } catch (e) { requestAnimationFrame(() => ctl.fitAll()); }
  const icon = (id, name) => { ctrl(id).innerHTML = Organica.icons.get(name); };
  icon('btn-fg-new', 'plus'); icon('btn-fg-undo', 'undo'); icon('btn-fg-redo', 'redo'); icon('btn-fg-delete', 'trash'); icon('btn-fg-fit', 'fit-view'); icon('btn-fg-fit-sel', 'fit-selection');
  ctrl('btn-fg-undo').addEventListener('click', () => { ctl.undo(); syncButtons(); });
  ctrl('btn-fg-redo').addEventListener('click', () => { ctl.redo(); syncButtons(); });
  ctrl('btn-fg-delete').addEventListener('click', () => {
    const sel = ctl.selection();
    if (!sel.length) { Organica.notice('Select a node first'); return; }
    ctl.remove(sel); syncButtons();
  });
  ctrl('btn-fg-fit').addEventListener('click', () => ctl.fitAll());
  ctrl('btn-fg-fit-sel').addEventListener('click', () => ctl.fitSelection());
  ctrl('btn-fg-new').addEventListener('click', openNewFigure);
  initNodebar(); initGraphMenu(); initCompose();
  ctrl('btn-export').addEventListener('click', e => { if (state.activeTier !== 'figure' || composing) return; e.preventDefault(); e.stopImmediatePropagation(); exportFromFloatbar(); }, true);
  if (syncChildren()) ctl.commit('sync', { amend: true });   // a graph saved before child Figures: its variations become nodes
  else if (ctl.model.nodes.some(n => n.type === 'figure-var')) ctl.refresh();   // their names follow their Figure's: drawn again now that ctl exists
  if (variationsNodes.moved) requestAnimationFrame(restackAll);   // a migrated Variations node: its children stand beside it
  renderInspector([]); syncButtons();
}
