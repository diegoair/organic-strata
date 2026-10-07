// Flexible Visual System · 17-figure-graph — the Figure step as a node graph (Organica.nodeCanvas). The UI side of
// engine/17-figure-nodes.js. An ES module of the Figure tier (loaded on demand by ./figure.js). docs/FVS.md §12.
//
// Left dock = the node bar (Foundation · Content · Rules · Output; saved entries as thumbnails, drag onto the graph or
// click to add). Right panel = the selected node's settings. Bottom floatbar = New Figure…, Undo / Redo, Delete,
// Fit all / Fit selection. Words: docs/UI-COPY.md §2 "Figure graph".
import { rt } from './rt.js';
import { provide } from './hooks.js';
import {
  COLOR_RULES, state
} from './engine/00-core.js';
import {
  ELEMENT_LIB, savedElementThumb
} from './engine/04-appearance.js';
import {
  LIBRARY, libraryNames, shownElementNames
} from './engine/07-library.js';
import {
  SYMCANVAS_PRESETS, SYMGRID_GENS
} from './engine/08-symbol-grid.js';
import {
  componentThumbSVG
} from './engine/10-suggest.js';
import {
  SEED_TYPES
} from './engine/01-geometry.js';
import {
  describeRule, figureCatalog
} from './engine/14-figure-ui.js';
import {
  evalFigure
} from './engine/16-figure-eval.js';
import {
  FIGURE_LATTICES, FIT_PRESET, KEEP_KEYS, REPEAT_LATTICES, canvasOf, canvasSummary, elementEntryFromRecipe, entrySnapshot, figureNodeTypes,
  graphFromRecipe, gridDefaults, gridSpec, gridSummary, recipeElementKey
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
let graphName = '';             // the saved graph this one was opened from / saved as ('' = not saved yet)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { Foundation: 'node-foundation', Content: 'node-content', Rules: 'node-rule', Output: 'node-output' };
const COMPONENT_RULES = { radial: 'Radial', pinwheel: 'Pinwheel', mirror: 'Mirror', checkerboard: 'Checkerboard' };
const MIRRORS = { none: 'No mirror', v: 'Right edge', h: 'Bottom edge', vh: 'Both edges' };
let ctl = null;

// ── the graph a first visit starts with: Canvas + Grid + Palette → Figure, fed by the newest saved Component/Element ──
// Default names (UI-COPY §2): Canvas 1, Grid 1, Palette 1, Figure 1 — given once, when the node is made, so deleting
// Canvas 1 never renames Canvas 2. A content node is titled by its library entry.
const NUMBERED = ['canvas', 'grid', 'palette', 'figure', 'set'];
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
function starterModel() {
  const m = NC.createModel();
  const mk = (type, x, y) => NC.addNode(m, { type, x, y, params: registry.defaults(type), name: nextName(m, type) });
  const cv = mk('canvas', 40, 40), gr = mk('grid', 40, 200), pa = mk('palette', 40, 360), fg = mk('figure', 360, 40);
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
  try { return kind === 'element' ? savedElementThumb(entry) : componentThumbSVG(name); } catch (e) { return ''; }
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
  if (node.type === 'figure') {
    const f = v && v.figure;
    if (!f) { el.innerHTML = ''; return; }
    const crumb = foundationOf(node).map(n => n ? esc(nodeLabel(n)) : '—').join(' · ');
    const vars = f.variations && f.variations.length ? f.variations : [{ key: 'base', svg: f.svg, label: 'As set up' }];
    const layout = p.layout === 'row' ? 'row' : 'rows';
    const groups = f.groups || [{ label: null, variations: vars }];
    let gi = 0;
    const tile = (v, i, first) => `
      <figure class="fg-var${v.pinned ? ' is-pinned' : ''}" data-i="${i}">
        <div class="fg-card__sheet" data-theme="light">${v.error ? `<p class="fg-var__error">${esc(v.label)}</p>` : `<img class="fg-card__img" alt="${esc(nodeLabel(node))}, variation ${i + 1}" src="${figureImg(node.id + ':' + v.key, v.svg)}">`}</div>
        <figcaption class="fg-var__label">${first ? 'As set up' : esc(v.label)}</figcaption>
        ${v.spec ? `<div class="fg-var__tools">
          <button type="button" class="icon-btn" data-act="pin" data-i="${i}" aria-pressed="${!!v.pinned}" aria-label="Pin variation ${i + 1}">${Organica.icons.get('pin', { size: 'xs' })}</button>
          <button type="button" class="icon-btn" data-act="from" data-i="${i}" aria-label="New Figure from variation ${i + 1}">${Organica.icons.get('copy', { size: 'xs' })}</button></div>` : ''}
      </figure>`;
    el.innerHTML = `<p class="fg-card__crumb">${crumb}</p>` + groups.map(g => `${g.label ? `<p class="fg-group__label">${esc(g.label)}</p>` : ''}<div class="fg-vars fg-vars--${layout}${g.variations.length === 1 ? ' is-single' : ''}">${g.variations.map((v, k) => tile(v, gi++, k === 0)).join('')}</div>`).join('')
      + `<p class="fg-card__meta">${esc(canvasSummary(f.canvas))} · ${f.cells} cells${vars.length > 1 ? ` · ${vars.length} ${f.groups ? 'figures' : 'variations'}` : ''}${f.capped ? ` · showing ${f.capped.shownItems} of ${f.capped.items} items, ${f.capped.per} each` : ''}</p>`;
    el.querySelectorAll('.fg-card__img').forEach(img => img.addEventListener('load', () => ctl.remeasure(node.id), { once: true }));
    if (!el._varBound) { el._varBound = true; el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; e.stopPropagation(); variationAction(node.id, b.dataset.act, +b.dataset.i); }); }
    el._vars = vars;
  } else if (node.type === 'canvas') {
    const cv = canvasOf(p);
    el.innerHTML = cv.fit ? `<p class="fg-card__meta">Fit to figure — the page is the figure’s own frame</p>` : `<p class="fg-card__meta">${Organica.aspectIcon ? Organica.aspectIcon(cv.W, cv.H) : ''} ${esc(canvasSummary(cv))}</p>`;
  } else if (node.type === 'grid') {
    el.innerHTML = `<p class="fg-card__meta">${esc(gridSummary({ gen: p.gen, params: p.params }))}</p>`;
  } else if (node.type === 'palette') {
    el.innerHTML = `<div class="fg-card__swatches" data-theme="light">${[p.paper, ...(p.colors || [])].map((c, i) => `<span class="fg-card__swatch${i ? '' : ' is-paper'}" style="background:${esc(c)}"></span>`).join('')}</div>`;
  } else if (node.type === 'set') {
    const items = p.items || [];
    el.innerHTML = items.length ? `<div class="fg-set__strip" data-theme="light">${items.slice(0, 8).map(it => `<span class="fg-set__thumb" title="${esc(it.name)}">${entryThumb(it.kind, it.name, it.snapshot)}</span>`).join('')}</div>
      <p class="fg-card__meta">${items.length} ${items.length === 1 ? 'item' : 'items'}</p>` : '<p class="fg-card__meta">No items yet</p>';
  } else if (node.type === 'cell-rules') {
    const rs = p.rules || [];
    el.innerHTML = `<p class="fg-card__meta">${rs.length ? rs.length + (rs.length === 1 ? ' rule' : ' rules') + ' · ' + esc(describeRule(rs[0])) + (rs.length > 1 ? ' …' : '') : 'No rules yet'}</p>`;
  } else if (node.type === 'component-rule') {
    el.innerHTML = `<p class="fg-card__meta">${esc(COMPONENT_RULES[p.rule] || p.rule)}</p>`;
  } else if (node.type === 'repeat') {
    const L = REPEAT_LATTICES[p.lattice] || REPEAT_LATTICES.square;
    el.innerHTML = `<p class="fg-card__meta">${esc(L.label)} · ${p.count}${p.altFlip ? ' · alternate flip' : ''}${(+p.rotate || 0) ? ' · ' + p.rotate + '°' : ''}${p.mirror && p.mirror !== 'none' ? ' · mirror ' + esc(MIRRORS[p.mirror]) : ''}</p>`;
  } else if (node.type === 'transform') {
    el.innerHTML = `<p class="fg-card__meta">${(+p.rotate || 0) ? p.rotate + '°' : 'No turn'} · ${esc(MIRRORS[p.mirror] || 'No mirror')}</p>`;
  } else if (node.type === 'element' || node.type === 'component') {
    const gone = p.name && !(node.type === 'element' ? ELEMENT_LIB.peek() : LIBRARY.peek())[p.name];
    el.innerHTML = p.snapshot ? `<div class="fg-card__thumb" data-theme="light">${entryThumb(node.type, p.name, p.snapshot)}</div>
      <p class="fg-card__meta">${gone ? `${esc(p.name)} is no longer in the library — drawn from the copy kept in this graph` : esc(p.name)}</p>` : '';
  }
}
// The Canvas / Grid / Palette feeding a Figure (null where none is connected).
function foundationOf(fig) {
  const m = ctl ? ctl.model : null; if (!m) return [null, null, null];
  return ['canvas', 'grid', 'palette'].map(port => { const e = m.edges.find(w => w.to.node === fig.id && w.to.port === port); return e ? NC.findNode(m, e.from.node) : null; });
}
// Pin keeps a variation through New variations; New Figure from this = a sibling Figure, same wires, that variation fixed.
function variationAction(id, act, i) {
  const node = NC.findNode(ctl.model, id), card = ctl.cardOf(id); if (!node || !card) return;
  const v = (card.querySelector('.nc-node__body')._vars || [])[i]; if (!v || !v.spec) return;
  const p = node.params;
  if (act === 'pin') {
    const pins = (p.pins || []).filter(s => !(s.mode === v.spec.mode && s.seed === v.spec.seed));
    if (!v.pinned) pins.push(v.spec);
    p.pins = pins; edited(node, true); return;
  }
  if (act === 'from') {
    const [copy] = ctl.duplicate([id]); const n = NC.findNode(ctl.model, copy);
    n.params.fixed = [].concat(p.fixed || [], [v.spec]); n.params.pins = []; n.params.seed = 1;
    ctl.touch(copy); ctl.refresh(); ctl.select([copy]); ctl.commit('new-figure-from'); save();
    announce(`New Figure from variation ${i + 1}`);
  }
}
const announce = t => { const l = document.querySelector('#fg-graph .nc-live'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); } };
function fitFrame(f) {   // fit the view to a section
  const r = ctrl('fg-graph').getBoundingClientRect(), pad = 48, L = 88, B = 72, W = r.width - L, H = r.height - B;
  const z = Math.min(1.5, Math.max(0.1, Math.min((W - pad * 2) / f.w, (H - pad * 2) / (f.h + 40))));
  ctl.zoomPan.setView({ zoom: z, panX: L + (W - f.w * z) / 2 - f.x * z, panY: (H - f.h * z) / 2 - f.y * z + 20 });
}
function cardClass(node) {
  if (node.type === 'figure') return 'nc-node--wide';
  return 'nc-node--compact';
}
function nodeLabel(node) { return node.name || registry.get(node.type).meta.label; }
// A Figure always has a Canvas and a Grid: the one feeding it can't be deleted while it is that Figure's only one.
function protect(node, model) {
  if (node.type !== 'canvas' && node.type !== 'grid') return null;
  const feeds = model.edges.some(e => e.from.node === node.id && model.nodes.some(n => n.id === e.to.node && n.type === 'figure'));
  return feeds ? `A Figure needs a ${node.type === 'canvas' ? 'Canvas' : 'Grid'} — connect another one first` : null;
}

// ── adding nodes: a Figure comes with its Canvas + Grid (the last ones used, or new ones beside it) ──
function viewCentre() { const r = ctrl('fg-graph').getBoundingClientRect(); return freeSpot(ctl.toBoard(r.left + r.width / 2, r.top + r.height / 3)); }
function freeSpot(at) {   // the nearest place below / beside `at` that no card covers
  const boxes = ctl.model.nodes.map(n => { const c = ctl.cardOf(n.id); return { x: n.x, y: n.y, w: c ? c.offsetWidth : 200, h: c ? c.offsetHeight : 120 }; });
  const hit = p => boxes.some(b => p.x < b.x + b.w + 24 && p.x + 240 > b.x - 24 && p.y < b.y + b.h + 24 && p.y + 140 > b.y - 24);
  for (let ring = 0; ring < 12; ring++) for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 1], [0, -1], [-1, 0]]) {
    const p = { x: Math.round(at.x + dx * ring * 160), y: Math.round(at.y + dy * ring * 120) }; if (!hit(p)) return p;
  }
  return at;
}
function centred(at, type) { const w = type === 'figure' ? 416 : type === 'canvas' || type === 'grid' || type === 'palette' ? 160 : 160; return { x: Math.round(at.x - w / 2), y: Math.round(at.y - 24) }; }
function addNode(type, at, params) {
  at = at || viewCentre();
  const named = t => ({ name: t === type && params && params.__name ? params.__name : nameFor(ctl.model, t, t === type ? params : null) });
  if (params && params.__name) { params = { ...params }; delete params.__name; }
  if (type !== 'figure') return ctl.add(type, at, params, named(type));
  const last = t => { const sel = ctl.selection().map(id => NC.findNode(ctl.model, id)).filter(n => n && n.type === t); return sel[0] || ctl.model.nodes.filter(n => n.type === t).slice(-1)[0]; };
  const fig = ctl.add('figure', at, params, named('figure'));
  let cv = last('canvas'), gr = last('grid');
  if (!cv) cv = ctl.add('canvas', { x: at.x - 260, y: at.y }, null, named('canvas'));
  if (!gr) gr = ctl.add('grid', { x: at.x - 260, y: at.y + 150 }, null, named('grid'));
  ctl.connect({ node: cv.id, port: 'canvas' }, { node: fig.id, port: 'canvas' });
  ctl.connect({ node: gr.id, port: 'grid' }, { node: fig.id, port: 'grid' });
  ctl.select([fig.id]);
  return fig;
}
function addContent(kind, name) {
  const all = kind === 'element' ? ELEMENT_LIB.read() : LIBRARY.read();
  return { type: kind, params: { name, snapshot: entrySnapshot(all[name]) } };
}

// ── node bar (left dock) ──
let openCat = null;
function nodebarItems(cat) {
  const types = (registry.byCategory()[cat] || []).filter(t => t.meta.id !== 'element' && t.meta.id !== 'component');
  const items = types.map(t => ({ label: t.meta.label, make: () => ({ type: t.meta.id }) }));
  return items;
}
function renderNodebar(cat) {
  const panel = ctrl('fg-nodebar-panel');
  panel.setAttribute('aria-label', cat);
  let html = `<p class="fg-nodebar__hint">Drag onto the graph, or click to add</p>`;
  const items = nodebarItems(cat);
  if (items.length) html += `<div class="fg-nodebar__list">${items.map((it, i) => `<button type="button" class="fg-nodebar__item" data-i="${i}" aria-label="Add ${esc(it.label)}">${esc(it.label)}</button>`).join('')}</div>`;
  if (cat === 'Content') {
    const s = savedEntries();
    const block = (kind, title, list, step) => `<div class="sub-label">${title}</div>` + (list.length
      ? `<div class="fvs-rail__grid">${list.map(e => `<button type="button" class="fvs-library-item fg-nodebar__tile" data-kind="${kind}" data-name="${esc(e.name)}" aria-label="Add ${kind === 'element' ? 'Element' : 'Component'}: ${esc(e.name)}">${entryThumb(kind, e.name, e.entry)}</button>`).join('')}</div>`
      : `<p class="fg-nodebar__empty">Nothing saved yet — save ${kind === 'element' ? 'an Element in the Element' : 'a Component in the Component'} step first.</p>`);
    html += block('element', 'Elements', s.element) + block('component', 'Components', s.component);
    const sets = Object.keys(SETS.read()).sort((a, b) => a.localeCompare(b));
    html += `<div class="sub-label">Saved Sets</div>` + (sets.length ? `<div class="fg-nodebar__list">${sets.map(n => `<button type="button" class="fg-nodebar__item fg-nodebar__set" data-set="${esc(n)}" aria-label="Add Set: ${esc(n)}">${esc(n)}</button>`).join('')}</div>` : `<p class="fg-nodebar__empty">No Sets yet — New Set makes one</p>`);
  }
  panel.innerHTML = html;
  panel._items = items;
}
function setNodebar(cat) {
  openCat = cat;
  const panel = ctrl('fg-nodebar-panel');
  ctrl('fg-nodebar').querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.cat === cat)));
  if (cat) { renderNodebar(cat); panel.dataset.open = 'true'; panel.inert = false; }
  else { panel.dataset.open = 'false'; panel.inert = true; }
}
function nodebarSpec(target) {
  const item = target.closest('.fg-nodebar__item'), tile = target.closest('.fg-nodebar__tile');
  if (item && item.dataset.set) { const e = SETS.read()[item.dataset.set]; return e ? { type: 'set', params: { items: JSON.parse(JSON.stringify(e.items || [])) }, name: item.dataset.set } : null; }
  if (item) return ctrl('fg-nodebar-panel')._items[+item.dataset.i].make();
  if (tile) return addContent(tile.dataset.kind, tile.dataset.name);
  return null;
}
function initNodebar() {
  ctrl('fg-nodebar').querySelectorAll('[data-cat]').forEach(b => {
    b.innerHTML = Organica.icons.get(ICON[b.dataset.cat]);
    b.addEventListener('click', () => setNodebar(openCat === b.dataset.cat ? null : b.dataset.cat));
  });
  const panel = ctrl('fg-nodebar-panel');
  // drag a node type / a saved entry onto the graph (the ghost lives on <body>: the dock is transformed)
  panel.addEventListener('pointerdown', e => {
    const spec = nodebarSpec(e.target); if (!spec || e.button !== 0) return;
    const src = e.target.closest('button'); const sx = e.clientX, sy = e.clientY; let ghost = null;
    try { src.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic or ended pointer */ }
    const move = ev => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      if (!ghost) { ghost = document.createElement('div'); ghost.className = 'fvs-rail-ghost fg-nodebar__ghost'; ghost.innerHTML = src.innerHTML; document.body.appendChild(ghost); panel.classList.add('is-dragging-away'); document.body.classList.add('is-rail-dragging'); }
      ghost.style.transform = `translate(${ev.clientX + 8}px, ${ev.clientY + 8}px)`;
    };
    const up = ev => {
      src.removeEventListener('pointermove', move); src.removeEventListener('pointerup', up); src.removeEventListener('pointercancel', up);
      panel.classList.remove('is-dragging-away'); document.body.classList.remove('is-rail-dragging');
      if (ghost) {
        ghost.remove();
        const r = ctrl('fg-graph').getBoundingClientRect();
        if (ev.type === 'pointerup' && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) addNode(spec.type, centred(ctl.toBoard(ev.clientX, ev.clientY), spec.type), spec.name ? { ...spec.params, __name: spec.name } : spec.params);
      } else if (ev.type === 'pointerup') addNode(spec.type, null, spec.name ? { ...spec.params, __name: spec.name } : spec.params);   // a click: add at the view centre
    };
    src.addEventListener('pointermove', move); src.addEventListener('pointerup', up); src.addEventListener('pointercancel', up);
  });
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
function rangeRow(label, id, min, max, step, value, onInput) {
  return { html: `<div class="ctrl-row"><div class="ctrl-label">${esc(label)}</div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}"><span class="ctrl-val" id="v-${id}">${value}</span></div>`,
    bind: () => { const r = ctrl(id); r.addEventListener('input', () => { ctrl('v-' + id).textContent = r.value; onInput(+r.value, false); }); r.addEventListener('change', () => onInput(+r.value, true)); } };
}
function selectRow(label, id, options, value, onChange) {
  return { html: `<div class="ctrl-row"><div class="ctrl-label">${esc(label)}</div><select class="panel-select" id="${id}" aria-label="${esc(label)}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`,
    bind: () => { ctrl(id).addEventListener('change', e => onChange(e.target.value)); } };
}
function numberRow(label, id, value, onChange, attrs) {
  return { html: `<div class="ctrl-row"><div class="ctrl-label">${esc(label)}</div><input type="number" class="panel-input" id="${id}" value="${esc(value)}" aria-label="${esc(label)}" ${attrs || ''}></div>`,
    bind: () => { ctrl(id).addEventListener('change', e => onChange(e.target.value)); } };
}
function renderInspector(ids) {
  const box = ctrl('fg-inspector');
  if (!box) return;
  const nodes = ids.map(id => NC.findNode(ctl.model, id)).filter(Boolean);
  if (!nodes.length) {
    const m = ctl.model, figs = m.nodes.filter(n => n.type === 'figure').length;
    box.innerHTML = `<div class="panel-section"><h3>Graph</h3>
      <p class="panel-hint">${figs} ${figs === 1 ? 'Figure' : 'Figures'} · ${m.nodes.length} ${m.nodes.length === 1 ? 'node' : 'nodes'}</p>
      ${m.nodes.length ? '' : '<p class="org-empty">This graph is empty. Add a Figure and some saved content, or start from a built-in Figure with New Figure…</p>'}
      ${figs ? `<div class="sub-label">Figures</div><div class="fg-figlist">${m.nodes.filter(n => n.type === 'figure').map(n => `<button type="button" class="fg-figlist__item" data-id="${n.id}">${esc(nodeLabel(n))}<span class="fg-figlist__hint">${foundationOf(n).map(x => x ? esc(nodeLabel(x)) : '—').join(' · ')}</span></button>`).join('')}</div>` : ''}
      ${(m.frames || []).length ? `<div class="sub-label">Sections</div><div class="fg-figlist">${m.frames.map(f => `<button type="button" class="fg-figlist__item" data-frame="${f.id}">${esc(f.name)}</button>`).join('')}</div>` : ''}
      ${m.nodes.length ? '<div class="row-btns"><button type="button" class="mini-btn" id="fgi-add-section">Add section</button></div>' : ''}
      <p class="panel-hint">Add nodes from the bar on the left, or press / to search. Drag from a port to connect; drop a wire on a node to use its first free input.</p></div>`;
    box.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => { ctl.select([b.dataset.id]); ctl.fitTo([b.dataset.id]); }));
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
  const title = `<div class="panel-section"><h3>${esc(nodeLabel(node))}</h3>`;
  const why = protect(node, ctl.model);
  if (node.type === 'canvas') {
    // The Symbol step's own Canvas section (fvs/index.html #sym-canvas-section) — same controls, same ranges (G4).
    const cv = canvasOf(p), print = p.mode === 'print', fit = p.preset === FIT_PRESET;
    const cur = fit ? FIT_PRESET : SYMCANVAS_PRESETS[p.preset] ? p.preset : 'Custom';
    rows.push({ html: `<div class="ctrl-row"><select class="panel-select fg-grow" id="fgi-preset" aria-label="Canvas format">${[FIT_PRESET, ...Object.keys(SYMCANVAS_PRESETS), 'Custom'].map(n => `<option${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      ${fit ? '<p class="panel-hint">A Figure on a lattice keeps its own frame. On a Loom grid it uses a square page.</p>' : `
      <div class="ctrl-row"><div class="seg-ctrl" id="fgi-mode" role="group" aria-label="Canvas mode"><button class="seg-btn${print ? '' : ' active'}" data-mode="screen" aria-pressed="${!print}">Screen</button><button class="seg-btn${print ? ' active' : ''}" data-mode="print" aria-pressed="${print}">Print</button></div></div>
      <div class="ctrl-row"><span class="ctrl-label">Size</span><input type="number" class="panel-input fg-size" id="fgi-pw" min="1" step="1" value="${cv.pw}" aria-label="Canvas width"><span class="hint">×</span><input type="number" class="panel-input fg-size" id="fgi-ph" min="1" step="1" value="${cv.ph}" aria-label="Canvas height"><span class="hint">${esc(cv.unit)}</span></div>
      ${print ? `<div class="ctrl-row"><span class="ctrl-label">Unit</span><select class="panel-select" id="fgi-unit" aria-label="Canvas unit"><option value="mm"${cv.unit === 'mm' ? ' selected' : ''}>mm</option><option value="in"${cv.unit === 'in' ? ' selected' : ''}>in</option></select></div>
      <div class="ctrl-row"><span class="ctrl-label">DPI</span><input type="number" class="panel-input" id="fgi-dpi" min="72" max="2400" step="1" value="${cv.dpi}" aria-label="Canvas DPI"></div>
      <div class="ctrl-row"><span class="ctrl-label">Bleed (mm)</span><input type="number" class="panel-input" id="fgi-bleed" min="0" max="20" step="0.5" value="${cv.bleed}" aria-label="Canvas bleed in millimetres"></div>` : ''}`}`,
      bind: () => {
        const again = () => { edited(node, true); renderInspector(ids); };
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
    if (!fit) rows.push(rangeRow('Margin', 'fgi-margin', 0, 25, 1, Math.min(25, p.margin), (v, c) => { p.margin = v; edited(node, c); }));
  } else if (node.type === 'grid') {
    rows.push({ html: `<div class="ctrl-row"><div class="ctrl-label">Grid</div><select class="panel-select" id="fgi-gen" aria-label="Grid">
        <optgroup label="Loom grids — inside the Canvas">${Object.entries(SYMGRID_GENS).map(([k, g]) => `<option value="${k}"${k === p.gen ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}</optgroup>
        <optgroup label="Lattices — their own frame">${Object.entries(FIGURE_LATTICES).map(([k, g]) => `<option value="${k}"${k === p.gen ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}</optgroup></select></div>`,
      bind: () => ctrl('fgi-gen').addEventListener('change', e => { p.gen = e.target.value; p.params = gridDefaults(p.gen); edited(node, true); renderInspector(ids); }) });
    gridSpec(p.gen).params.forEach(([k, label, a, b, step, def]) => {
      if (a === 'text') return;
      const val = p.params && p.params[k] != null ? p.params[k] : def;
      rows.push(rangeRow(label, 'fgi-g-' + k, a, b, step, val, (v, c) => { p.params = { ...(p.params || {}), [k]: v }; edited(node, c); }));
    });
  } else if (node.type === 'palette') {
    const lib = Organica.palette.library ? Organica.palette.library() : [];
    rows.push({ html: `<div class="ctrl-row"><div class="ctrl-label">From the library</div><select class="panel-select" id="fgi-lib" aria-label="From the library"><option value="">Choose a palette…</option>${lib.map(l => `<option value="${esc(l.id)}"${l.id === p.source ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>`,
      bind: () => ctrl('fgi-lib').addEventListener('change', e => { const l = lib.find(x => x.id === e.target.value); if (!l) return; p.colors = l.colors.map(c => c.hex); p.source = l.id; edited(node, true); renderInspector(ids); }) });
    rows.push({ html: `<div class="ctrl-row"><div class="ctrl-label">Inks</div></div><div id="fgi-inks" class="rmx-palette"></div>
      <div class="color-row"><span class="color-name">Paper</span><span class="color-swatch-wrap"><button class="color-swatch" id="sw-fgi-paper" style="background:${esc(p.paper)}"></button><input type="color" id="cp-fgi-paper" value="${esc(p.paper)}"></span><input class="color-hex" id="hex-fgi-paper" value="${esc(p.paper)}" maxlength="7"></div>`,
      bind: () => {
        Organica.palette.swatch(ctrl('fgi-inks'), { colors: p.colors, min: 1, max: 8, library: false, onChange: colors => { p.colors = colors.slice(); delete p.source; edited(node, true); } });
        Organica.palette.swatch('fgi-paper', { onChange: hex => { if (hex === p.paper) return; p.paper = hex; edited(node, true); } });
      } });
    rows.push(selectRow('Colour by', 'fgi-rule', Object.entries(COLOR_RULES).map(([k, r]) => [k, r.label]), (p.rule || {}).mode || 'index', v => { p.rule = { ...(p.rule || {}), mode: v }; edited(node, true); }));
  } else if (node.type === 'element' || node.type === 'component') {
    const s = savedEntries()[node.type];
    rows.push({ html: s.length ? `<div class="sub-label">Saved ${node.type === 'element' ? 'Elements' : 'Components'}</div><div class="fvs-rail__grid" id="fgi-pick">${s.map(e => `<button type="button" class="fvs-library-item${e.name === p.name ? ' selected' : ''}" data-name="${esc(e.name)}" aria-label="${esc(e.name)}" aria-pressed="${e.name === p.name}">${entryThumb(node.type, e.name, e.entry)}</button>`).join('')}</div>`
      : `<p class="org-empty">Nothing saved yet — save ${node.type === 'element' ? 'an Element in the Element' : 'a Component in the Component'} step first.</p>`,
      bind: () => { const g = ctrl('fgi-pick'); if (g) g.addEventListener('click', e => { const b = e.target.closest('[data-name]'); if (!b) return; Object.assign(p, addContent(node.type, b.dataset.name).params); node.name = b.dataset.name; edited(node, true); ctl.refresh(); renderInspector(ids); ctl.paint(node.id); }); } });
  } else if (node.type === 'set') {
    rows.push(setEditor(node, ids));
  } else if (node.type === 'cell-rules') {
    rows.push(cellRulesEditor(node, ids));
  } else if (node.type === 'component-rule') {
    const q = p.params || (p.params = {});
    rows.push(selectRow('Rule', 'fgi-crule', Object.entries(COMPONENT_RULES), p.rule, v => { p.rule = v; p.params = {}; edited(node, true); renderInspector(ids); }));
    if (p.rule === 'radial' || p.rule === 'pinwheel') {
      rows.push(selectRow('Start', 'fgi-cbase', [[0, '0°'], [1, '90°'], [2, '180°'], [3, '270°']], q.base || 0, v => { q.base = +v; edited(node, true); }));
      rows.push(selectRow('Direction', 'fgi-cchir', [[1, 'Clockwise'], [-1, 'Counter-clockwise']], q.chirality || 1, v => { q.chirality = +v; edited(node, true); }));
    } else if (p.rule === 'mirror') {
      rows.push(selectRow('Start', 'fgi-cseed', [[0, '0°'], [1, '90°'], [2, '180°'], [3, '270°']], q.seed || 0, v => { q.seed = +v; edited(node, true); }));
    } else if (p.rule === 'checkerboard') {
      rows.push(selectRow('First cells', 'fgi-ca', [[0, '0°'], [1, '90°'], [2, '180°'], [3, '270°']], q.a || 0, v => { q.a = +v; edited(node, true); }));
      rows.push(selectRow('Second cells', 'fgi-cb', [[0, '0°'], [1, '90°'], [2, '180°'], [3, '270°']], q.b || 0, v => { q.b = +v; edited(node, true); }));
    }
    rows.push({ html: '<p class="panel-hint">Lays out a Square lattice up to 4 × 4.</p>' });
  } else if (node.type === 'repeat') {
    const L = REPEAT_LATTICES[p.lattice] || REPEAT_LATTICES.square;
    rows.push(selectRow('Lattice', 'fgi-rlat', Object.entries(REPEAT_LATTICES).map(([k, l]) => [k, l.label]), p.lattice, v => { p.lattice = v; p.count = REPEAT_LATTICES[v].def; edited(node, true); renderInspector(ids); }));
    rows.push(rangeRow(L.key === 'n' ? 'Size' : L.key === 'stack' ? 'Stack' : 'Rows', 'fgi-rcount', L.min, L.max, 1, p.count, (v, c) => { p.count = v; edited(node, c); }));
    rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-ralt"${p.altFlip ? ' checked' : ''}> Alternate flip</label>`, bind: () => ctrl('fgi-ralt').addEventListener('change', e => { p.altFlip = e.target.checked; edited(node, true); }) });
    rows.push(selectRow('Rotate', 'fgi-rrot', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], +p.rotate || 0, v => { p.rotate = +v; edited(node, true); }));
    rows.push(selectRow('Mirror', 'fgi-rmir', Object.entries(MIRRORS), p.mirror || 'none', v => { p.mirror = v; edited(node, true); }));
    rows.push({ html: '<p class="panel-hint">Several Repeat in grid nodes apply in the order they were connected.</p>' });
  } else if (node.type === 'transform') {
    rows.push(selectRow('Rotate', 'fgi-trot', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], +p.rotate || 0, v => { p.rotate = +v; edited(node, true); }));
    rows.push(selectRow('Mirror', 'fgi-tmir', Object.entries(MIRRORS), p.mirror || 'none', v => { p.mirror = v; edited(node, true); }));
    rows.push({ html: '<p class="panel-hint">Turns and mirrors the whole figure — needs a Repeat in grid before it.</p>' });
  } else if (node.type === 'figure') {
    const cur = foundationOf(node);
    ['canvas', 'grid', 'palette'].forEach((t, k) => {
      const opts = ctl.model.nodes.filter(n => n.type === t).map(n => [n.id, nodeLabel(n)]);
      if (t === 'palette') opts.unshift(['', 'None — content’s own colours']);
      rows.push(selectRow(registry.get(t).meta.label, 'fgi-f-' + t, opts, cur[k] ? cur[k].id : '', v => {
        if (!v) { const e = ctl.model.edges.find(w => w.to.node === node.id && w.to.port === t); if (e) { NC.removeEdge(ctl.model, e.id); ctl.touch(node.id); ctl.commit('disconnect'); ctl.refresh(); } }
        else ctl.connect({ node: v, port: t }, { node: node.id, port: t });
        renderInspector(ids); save();
      }));
    });
    const hasSet = ctl.model.edges.some(e => e.to.node === node.id && e.to.port === 'content' && (NC.findNode(ctl.model, e.from.node) || {}).type === 'set');
    if (hasSet) rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-fanout"${p.fanOut !== false ? ' checked' : ''}> One group per item</label><p class="panel-hint">Each item of the Set gets its own variations. Off: the items are mixed over the cells.</p>`,
      bind: () => ctrl('fgi-fanout').addEventListener('change', e => { p.fanOut = e.target.checked; edited(node, true); }) });
    rows.push({ html: '<div class="sub-label">Variations</div>' });
    rows.push(rangeRow('Variations', 'fgi-vcount', 1, 12, 1, +p.variations || 1, (v, c) => { p.variations = v; edited(node, c); }));
    rows.push(selectRow('Vary by', 'fgi-varyby', [['seed', 'Random seed'], ['one', 'One change'], ['several', 'Several changes']], p.varyBy || 'one', v => { p.varyBy = v; edited(node, true); }));
    rows.push(numberRow('Random seed', 'fgi-seed', +p.seed || 1, v => { p.seed = Math.max(1, Math.round(+v) || 1); edited(node, true); }, 'min="1" max="999999" step="1"'));
    const KEEP_LABELS = { content: 'Content', palette: 'Palette', cells: 'Cell rules', grid: 'Grid', transform: 'Rotate & mirror' };
    rows.push({ html: `<div class="ctrl-row"><div class="ctrl-label">Keep</div></div><div class="fg-keep">${KEEP_KEYS.map(k => `<label class="check-row"><input type="checkbox" data-keep="${k}"${(p.keep || {})[k] ? ' checked' : ''}> ${KEEP_LABELS[k]}</label>`).join('')}</div>`,
      bind: () => box.querySelectorAll('[data-keep]').forEach(c => c.addEventListener('change', () => { p.keep = { ...(p.keep || {}), [c.dataset.keep]: c.checked }; edited(node, true); })) });
    rows.push({ html: `<div class="ctrl-row"><div class="ctrl-label">Layout</div><div class="seg-ctrl" id="fgi-layout" role="group" aria-label="Layout"><button class="seg-btn${p.layout === 'row' ? ' active' : ''}" data-v="row" aria-pressed="${p.layout === 'row'}">One row</button><button class="seg-btn${p.layout !== 'row' ? ' active' : ''}" data-v="rows" aria-pressed="${p.layout !== 'row'}">Rows</button></div></div>
      <div class="row-btns"><button type="button" class="mini-btn" id="fgi-renew" aria-label="New variations — pinned ones stay">${Organica.icons.get('refresh', { size: 'xs' })} New variations</button></div>
      ${(p.pins || []).length ? `<p class="panel-hint">${p.pins.length} pinned</p>` : ''}${(p.fixed || []).length ? `<p class="panel-hint">Made from a variation — ${p.fixed.length === 1 ? 'one change fixed' : p.fixed.length + ' changes fixed'}</p>` : ''}`,
      bind: () => {
        ctrl('fgi-layout').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; p.layout = b.dataset.v; edited(node, true); renderInspector(ids); ctl.paint(node.id); });
        ctrl('fgi-renew').addEventListener('click', () => { p.seed = (+p.seed || 1) + 1; edited(node, true); renderInspector(ids); });
      } });
    rows.push({ html: '<div class="sub-label">Cells</div>' });
    rows.push(selectRow('Fit in cell', 'fgi-fit', [['fill', 'Stretch'], ['contain', 'Contain'], ['cover', 'Cover (no gaps)'], ['match', 'Match cell']], p.fit, v => { p.fit = v; edited(node, true); }));
    rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-keepown"${p.keepOwn ? ' checked' : ''}> Keep own colours</label>`,
      bind: () => { ctrl('fgi-keepown').addEventListener('change', e => { p.keepOwn = e.target.checked; edited(node, true); }); } });
    rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-clip"${p.clip !== false ? ' checked' : ''}> Clip to cell</label>`,
      bind: () => { ctrl('fgi-clip').addEventListener('change', e => { p.clip = e.target.checked; edited(node, true); }); } });
  }
  box.innerHTML = title + rows.map(r => r.html).join('') + (why ? `<p class="panel-hint">${esc(why)}.</p>` : '') + '</div>';
  rows.forEach(r => r.bind && r.bind());
  if (Organica.autoLabelPanel) Organica.autoLabelPanel(box);
}

// ── Set: an ordered list of saved Elements / Components; saved Sets ('fvs-sets') ──
function setEditor(node, ids) {
  const p = node.params, items = p.items || (p.items = []), s = savedEntries(), saved = Object.keys(SETS.read()).sort((a, b) => a.localeCompare(b));
  const row = (it, i) => `<div class="fg-chip"><span class="fg-set__thumb" data-theme="light">${entryThumb(it.kind, it.name, it.snapshot)}</span><span class="fg-chip__text">${esc(it.name)}</span>
    <button type="button" class="icon-btn" data-act="up" data-i="${i}" aria-label="Move ${esc(it.name)} up"${i ? '' : ' disabled'}>${Organica.icons.get('arrow-up', { size: 'xs' })}</button>
    <button type="button" class="icon-btn" data-act="down" data-i="${i}" aria-label="Move ${esc(it.name)} down"${i < items.length - 1 ? '' : ' disabled'}>${Organica.icons.get('arrow-down', { size: 'xs' })}</button>
    <button type="button" class="icon-btn" data-act="del" data-i="${i}" aria-label="Remove ${esc(it.name)} from the Set">${Organica.icons.get('trash', { size: 'xs' })}</button></div>`;
  const tiles = (kind, list) => list.map(e => `<button type="button" class="fvs-library-item" data-add="${kind}" data-name="${esc(e.name)}" aria-label="Add ${esc(e.name)}">${entryThumb(kind, e.name, e.entry)}</button>`).join('');
  return { html: `<div class="fg-chips" id="fgi-set-items">${items.length ? items.map(row).join('') : '<p class="panel-hint">No items yet — add saved Elements or Components below.</p>'}</div>
    <div class="sub-label">Add</div><div class="fvs-rail__grid" id="fgi-set-add">${tiles('element', s.element) + tiles('component', s.component) || '<p class="panel-hint">Nothing saved yet — save a Component in the Component step first.</p>'}</div>
    <div class="sub-label">Saved Sets</div>
    <div class="ctrl-row"><select class="panel-select" id="fgi-set-saved" aria-label="Saved Sets"><option value="">${saved.length ? 'Open a saved Set…' : 'No Sets yet'}</option>${saved.map(n => `<option>${esc(n)}</option>`).join('')}</select></div>
    <div class="row-btns"><button type="button" class="mini-btn" id="fgi-set-save">Save Set</button></div>`,
    bind: () => {
      const again = () => { edited(node, true); renderInspector(ids); ctl.paint(node.id); };
      ctrl('fgi-set-items').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; const i = +b.dataset.i;
        if (b.dataset.act === 'up' && i) [items[i - 1], items[i]] = [items[i], items[i - 1]];
        else if (b.dataset.act === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
        else if (b.dataset.act === 'del') items.splice(i, 1);
        again(); });
      ctrl('fgi-set-add').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (!b) return; const c = addContent(b.dataset.add, b.dataset.name); items.push({ kind: b.dataset.add, name: b.dataset.name, snapshot: c.params.snapshot }); again(); });
      ctrl('fgi-set-saved').addEventListener('change', e => { const v = SETS.read()[e.target.value]; if (!v) return; p.items = JSON.parse(JSON.stringify(v.items || [])); node.name = e.target.value; ctl.refresh(); again(); });
      ctrl('fgi-set-save').addEventListener('click', () => { if (!items.length) { Organica.notice('Add items to the Set first'); return; } const all = SETS.read(); all[nodeLabel(node)] = { items: JSON.parse(JSON.stringify(items)), savedAt: new Date().toISOString() }; if (SETS.write(all)) Organica.notice('Set saved'); renderInspector(ids); });
    } };
}

// ── Cell rules: today's rule chips (eye / up / down / trash) + "Add rule" — which cells, what they get ──
const WHICH = [['all', 'All cells'], ['up', 'Up cells'], ['down', 'Down cells'], ['odd', 'Odd cells'], ['even', 'Even cells'], ['row', 'Row'], ['col', 'Column'], ['ring', 'Ring'], ['sector', 'Sector'], ['index', 'Cell']];
const DOES = [['empty', 'Empty'], ['filled', 'Filled'], ['r60', 'Rotate 60°'], ['r90', 'Rotate 90°'], ['r180', 'Rotate 180°'], ['rsector', 'Rotate by sector'], ['fh', 'Flip H'], ['fv', 'Flip V']];
function ruleFrom(which, n, does) {
  const when = which === 'all' ? {} : which === 'up' || which === 'down' ? { class: which } : which === 'odd' || which === 'even' ? { parity: which } : { [which]: Math.max(0, n - (which === 'ring' || which === 'sector' ? 0 : 1)) };
  const d = does === 'empty' ? { content: 'empty' } : does === 'filled' ? { content: 'filled' } : does === 'rsector' ? { rotate: 'sector' } : does[0] === 'r' ? { rotate: +does.slice(1) } : does === 'fh' ? { flipH: true } : { flipV: true };
  return { when, do: d };
}
function cellRulesEditor(node, ids) {
  const rs = node.params.rules || (node.params.rules = []);
  const chip = (r, i) => `<div class="fg-chip${r.off ? ' is-off' : ''}"><span class="fg-chip__text">${esc(describeRule(r))}</span>
    <button type="button" class="icon-btn" data-act="off" data-i="${i}" aria-pressed="${!r.off}" aria-label="Rule ${i + 1} on">${Organica.icons.get(r.off ? 'eye-off' : 'eye', { size: 'xs' })}</button>
    <button type="button" class="icon-btn" data-act="up" data-i="${i}" aria-label="Move rule ${i + 1} up"${i ? '' : ' disabled'}>${Organica.icons.get('arrow-up', { size: 'xs' })}</button>
    <button type="button" class="icon-btn" data-act="down" data-i="${i}" aria-label="Move rule ${i + 1} down"${i < rs.length - 1 ? '' : ' disabled'}>${Organica.icons.get('arrow-down', { size: 'xs' })}</button>
    <button type="button" class="icon-btn" data-act="del" data-i="${i}" aria-label="Delete rule ${i + 1}">${Organica.icons.get('trash', { size: 'xs' })}</button></div>`;
  return { html: `<div class="fg-chips" id="fgi-rules">${rs.length ? rs.map(chip).join('') : '<p class="panel-hint">No rules yet — every cell gets the content.</p>'}</div>
    <div class="sub-label">Add rule</div>
    <div class="ctrl-row"><div class="ctrl-label">Which cells</div><select class="panel-select" id="fgi-which" aria-label="Which cells">${WHICH.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    <div class="ctrl-row fg-hide" id="fgi-n-row" hidden><div class="ctrl-label">Number</div><input type="number" class="panel-input" id="fgi-n" min="0" max="99" step="1" value="1" aria-label="Number"></div>
    <div class="ctrl-row"><div class="ctrl-label">They get</div><select class="panel-select" id="fgi-does" aria-label="They get">${DOES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    <div class="row-btns"><button type="button" class="mini-btn" id="fgi-add-rule">Add rule</button></div>
    <p class="panel-hint">Rules apply in order: a later rule wins on the cells it matches.</p>`,
    bind: () => {
      ctrl('fgi-which').addEventListener('change', e => { ctrl('fgi-n-row').hidden = !['row', 'col', 'ring', 'sector', 'index'].includes(e.target.value); });
      ctrl('fgi-add-rule').addEventListener('click', () => { rs.push(ruleFrom(ctrl('fgi-which').value, +ctrl('fgi-n').value || 0, ctrl('fgi-does').value)); edited(node, true); renderInspector(ids); ctl.paint(node.id); });
      ctrl('fgi-rules').addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return; const i = +b.dataset.i;
        if (b.dataset.act === 'off') rs[i].off = !rs[i].off;
        else if (b.dataset.act === 'up' && i) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]];
        else if (b.dataset.act === 'down' && i < rs.length - 1) [rs[i + 1], rs[i]] = [rs[i], rs[i + 1]];
        else if (b.dataset.act === 'del') rs.splice(i, 1);
        edited(node, true); renderInspector(ids); ctl.paint(node.id);
      });
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
function openBuiltin(def) {
  const { name, entry } = savedElementFor(def.element);
  const g = graphFromRecipe(def, name);
  const m = ctl.model, maxX = m.nodes.reduce((a, n) => Math.max(a, n.x + 420), 0), x0 = m.nodes.length ? maxX + 120 : 40, y0 = 40;
  const col = { canvas: [0, 0], grid: [0, 1], palette: [0, 2], element: [0, 3] }, ids = {};
  let rulesY = 0;
  g.nodes.forEach(n => {
    const isRule = ['cell-rules', 'component-rule', 'repeat', 'transform'].includes(n.type);
    const [c, r] = n.type === 'figure' ? [2, 0] : isRule ? [1, rulesY++] : col[n.ref] || [0, 4];
    const params = { ...registry.defaults(n.type), ...n.params };
    if (n.type === 'element') params.snapshot = entrySnapshot(entry);
    const node = NC.addNode(m, { type: n.type, x: x0 + c * 260, y: y0 + r * 150, params, name: n.name || nameFor(m, n.type, params) });
    ids[n.ref] = node.id;
  });
  g.edges.forEach(([a, ap, b, bp]) => NC.addEdge(m, { node: ids[a], port: ap }, { node: ids[b], port: bp }, true));
  Object.values(ids).forEach(id => ctl.touch(id));
  ctl.refresh(); ctl.select([ids.figure]); ctl.commit('new-figure');
  requestAnimationFrame(() => { ctl.addSection(Object.values(ids), def.id ? (Object.entries(figureCatalog()).find(([, d]) => d.id === def.id) || [])[0] || 'Section' : undefined); ctl.select([ids.figure]); save(); ctl.fitTo(Object.values(ids)); });
}
function openNewFigure() {
  const cat = figureCatalog();
  const m = document.createElement('div'); m.className = 'org-modal fg-new'; m.style.display = 'flex';
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'fg-new-title');
  m.innerHTML = `<div class="org-modal__panel fg-new__panel"><div class="org-modal__header"><span class="org-modal__title" id="fg-new-title">New Figure…</span>
    <button class="org-btn org-btn--icon org-btn--sm org-btn--ghost" data-act="close" aria-label="Close">${Organica.icons.get('close', { size: 'sm' })}</button></div>
    <div class="sub-label">Built-in Figures</div>
    <div class="fg-new__grid" data-theme="light">${Object.keys(cat).map((n, i) => `<button type="button" class="fg-new__item" data-i="${i}" aria-label="${esc(n)}"><span class="fg-new__thumb"></span><span class="fg-new__name">${esc(n)}</span></button>`).join('')}</div>
    <div class="row-btns"><button type="button" class="mini-btn" data-act="blank">Empty Figure</button></div></div>`;
  const close = () => { if (Organica.modal) Organica.modal.release(m); m.remove(); };
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-act], [data-i]'); if (!b && e.target === m) { close(); return; } if (!b) return;
    if (b.dataset.act === 'close') close();
    else if (b.dataset.act === 'blank') { close(); addNode('figure'); }
    else { const def = Object.values(cat)[+b.dataset.i]; close(); openBuiltin(JSON.parse(JSON.stringify(def))); }
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
  const types = registry.list().filter(t => t.meta.id !== 'element' && t.meta.id !== 'component').map(t => ({ label: t.meta.label, hint: t.meta.category, spec: { type: t.meta.id } }));
  const s = savedEntries();
  return types.concat(s.element.map(e => ({ label: e.name, hint: 'Element', spec: addContent('element', e.name) })), s.component.map(e => ({ label: e.name, hint: 'Component', spec: addContent('component', e.name) })));
}
function connects(spec, from) {   // can a new node of this spec connect to `from` (a port being dragged)?
  const t = registry.get(spec.type), fromNode = NC.findNode(ctl.model, from.node);
  const fp = (from.dir === 'out' ? registry.outputsOf(fromNode) : registry.inputsOf(fromNode)).find(p => p.name === from.port);
  if (!fp) return null;
  const mine = from.dir === 'out' ? (typeof t.meta.inputs === 'function' ? [] : t.meta.inputs) : t.meta.outputs;
  const want = from.dir === 'out' ? fp.type : (fp.accepts || [fp.type]);
  return (mine || []).find(p => from.dir === 'out' ? (p.accepts || [p.type]).includes(want) : [].concat(want).includes(p.type)) || null;
}
let searchEl = null;
function closeSearch() { if (searchEl) { searchEl.remove(); searchEl = null; } }
function openSearch(at, from, client) {
  closeSearch();
  const fromNode = from && NC.findNode(ctl.model, from.node);
  const fromPort = fromNode && (from.dir === 'out' ? registry.outputsOf(fromNode) : registry.inputsOf(fromNode)).find(p => p.name === from.port);
  let items = searchItems(); if (from) items = items.filter(it => connects(it.spec, from));
  const el = document.createElement('div'); el.className = 'fg-search'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Search nodes');
  el.innerHTML = `${fromPort ? `<p class="fg-search__head">Nodes that connect to ${esc(fromPort.label || fromPort.name)}</p>` : ''}<input type="search" class="org-field fg-search__q" placeholder="Search nodes" aria-label="Search nodes" autocomplete="off"><div class="fg-search__list" role="listbox" aria-label="Nodes"></div>`;
  const r = ctrl('fg-graph').getBoundingClientRect(), c = client || { x: r.left + r.width / 2, y: r.top + r.height / 3 };
  el.style.left = Math.min(c.x, innerWidth - 260) + 'px'; el.style.top = Math.min(c.y, innerHeight - 320) + 'px';
  document.body.appendChild(el); searchEl = el;
  const q = el.querySelector('.fg-search__q'), list = el.querySelector('.fg-search__list');
  let shown = [], cur = 0;
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    shown = items.filter(it => !t || it.label.toLowerCase().includes(t) || it.hint.toLowerCase().includes(t)).slice(0, 12);
    cur = Math.min(cur, Math.max(0, shown.length - 1));
    list.innerHTML = shown.length ? shown.map((it, i) => `<button type="button" class="fg-search__item${i === cur ? ' is-current' : ''}" role="option" aria-selected="${i === cur}" data-i="${i}"><span>${esc(it.label)}</span><span class="fg-search__hint">${esc(it.hint)}</span></button>`).join('')
      : `<p class="fg-search__none">No node matches “${esc(q.value.trim())}”</p>`;
  };
  const pick = i => {
    const it = shown[i]; if (!it) return; closeSearch();
    const node = addNode(it.spec.type, from ? centred(at, it.spec.type) : freeSpot(centred(at, it.spec.type)), it.spec.params);
    if (from && node) { const p = connects(it.spec, from); if (p) from.dir === 'out' ? ctl.connect({ node: from.node, port: from.port }, { node: node.id, port: p.name }) : ctl.connect({ node: node.id, port: p.name }, { node: from.node, port: from.port }); }
  };
  q.addEventListener('input', () => { cur = 0; draw(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { cur = Math.min(shown.length - 1, cur + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { pick(cur); e.preventDefault(); }
    else if (e.key === 'Escape') { closeSearch(); ctrl('fg-graph').focus({ preventScroll: true }); e.stopPropagation(); }
  });
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); });
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (searchEl && !searchEl.contains(e.target)) { closeSearch(); } document.removeEventListener('pointerdown', off, true); }, true), 0);
  draw(); q.focus();
}
// Double-click a port: an input gets the node it needs, beside it and connected; anything else opens the search
function spawnFor(node, port, dir) {
  const ip = dir === 'in' && registry.inputsOf(node).find(p => p.name === port);
  const direct = ip && { canvas: 'canvas', grid: 'grid', palette: 'palette' }[ip.type];
  if (direct) { const n = addNode(direct, freeSpot({ x: node.x - 220, y: node.y })); ctl.connect({ node: n.id, port: direct }, { node: node.id, port }); return; }
  const card = ctl.cardOf(node.id), r = card ? card.getBoundingClientRect() : null;
  openSearch({ x: dir === 'in' ? node.x - 260 : node.x + (card ? card.offsetWidth : 200) + 60, y: node.y }, { node: node.id, port, dir }, r ? { x: dir === 'in' ? r.left - 250 : r.right + 10, y: r.top } : null);
}

// ── persistence: the current graph autosaves; the view (zoom, pan) is per browser ──
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const all = GRAPHS.read(); all[CURRENT] = { model: ctl.model, name: graphName, savedAt: new Date().toISOString() }; GRAPHS.write(all);
    Organica.dirty.set('fvs-figure-graph', !savedAs());
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ zoom: ctl.zoomPan.zoom, ...ctl.zoomPan.pan })); } catch (e) {}
  }, 400);
}
function loadModel() {
  const e = GRAPHS.read()[CURRENT];
  graphName = (e && e.name) || '';
  return ensureNames(e && e.model ? NC.createModel(e.model) : starterModel());
}
function syncButtons() {
  ctrl('btn-fg-undo').disabled = !ctl.history.canUndo();
  ctrl('btn-fg-redo').disabled = !ctl.history.canRedo();
  const sel = ctl.selection(), why = sel.map(id => protect(NC.findNode(ctl.model, id), ctl.model)).filter(Boolean)[0];
  const del = ctrl('btn-fg-delete'), refused = !sel.length || (sel.length === 1 && !!why);
  del.setAttribute('aria-disabled', String(refused));
  ctrl('fg-delete-why').textContent = !sel.length ? 'Select a node first' : (why || '');
  if (refused) del.setAttribute('aria-describedby', 'fg-delete-why'); else del.removeAttribute('aria-describedby');
}

// ── Graph menu (floatbar): Saved graphs · Graph name · Save · Delete · New graph · Open file… · Save as file ──
const GRAPH_FILE = 'fvs-figure-graph';
function savedNames() { return Object.keys(GRAPHS.read()).filter(n => n !== CURRENT).sort((a, b) => a.localeCompare(b)); }
function savedAs() { const e = graphName && GRAPHS.read()[graphName]; return !!e && JSON.stringify(e.model) === JSON.stringify(ctl.model); }
function syncGraphMenu() {
  const sel = ctrl('fg-graph-saved'), names = savedNames();
  sel.innerHTML = names.length ? `<option value="">—</option>` + names.map(n => `<option${n === graphName ? ' selected' : ''}>${esc(n)}</option>`).join('') : '<option value="">No saved graphs yet</option>';
  sel.disabled = !names.length;
  ctrl('fg-graph-name').value = graphName;
  ctrl('fg-graph-delete').disabled = !graphName || !GRAPHS.read()[graphName];
  const fresh = ctl.model.nodes.length && !savedAs();
  const nw = ctrl('fg-graph-new');
  nw.removeAttribute('data-armed');   // an unsaved graph is kept as "Untitled n", so New graph never loses it
  ctrl('btn-fg-graph').setAttribute('aria-label', 'Graph');
  if (fresh) ctrl('btn-fg-graph').setAttribute('aria-description', 'Not saved'); else ctrl('btn-fg-graph').removeAttribute('aria-description');
  ctrl('btn-fg-graph').classList.toggle('is-unsaved', !!fresh);
}
function keepUnsaved() {   // never lose a graph: an unsaved one is saved as "Untitled n" before another replaces it
  if (!ctl.model.nodes.length || savedAs()) return;
  const all = GRAPHS.read(); let i = 1; while (all['Untitled ' + i]) i++;
  const n = graphName && !all[graphName] ? graphName : 'Untitled ' + i;
  all[n] = { model: JSON.parse(JSON.stringify(ctl.model)), savedAt: new Date().toISOString() }; GRAPHS.write(all);
  Organica.notice(`The current graph was saved as “${n}”`);
}
function useModel(model, name) {
  graphName = name || '';
  ctl.setModel(ensureNames(NC.createModel(model)));
  renderInspector([]); syncButtons(); save(); syncGraphMenu();
  requestAnimationFrame(() => ctl.fitAll());
}
function initGraphMenu() {
  ctrl('btn-fg-graph').querySelector('.fg-graph-btn__chev').innerHTML = Organica.icons.get('chevron-down', { cls: 'chev' });
  Organica.popover(ctrl('btn-fg-graph'), ctrl('fg-graph-popover'));
  ctrl('btn-fg-graph').addEventListener('click', syncGraphMenu);
  ctrl('fg-graph-saved').addEventListener('change', e => { const n = e.target.value, g = n && GRAPHS.read()[n]; if (!g) return; keepUnsaved(); useModel(g.model, n); });
  ctrl('fg-graph-save').addEventListener('click', () => {
    const n = ctrl('fg-graph-name').value.trim(); if (!n) { Organica.notice('Name the graph first'); ctrl('fg-graph-name').focus(); return; }
    const all = GRAPHS.read(); all[n] = { model: JSON.parse(JSON.stringify(ctl.model)), savedAt: new Date().toISOString() };
    if (!GRAPHS.write(all)) return;
    graphName = n; save(); syncGraphMenu(); Organica.notice('Graph saved');
  });
  ctrl('fg-graph-delete').addEventListener('click', () => {
    const all = GRAPHS.read(); if (!graphName || !all[graphName]) return;
    delete all[graphName]; GRAPHS.write(all); graphName = ''; save(); syncGraphMenu(); Organica.notice('Graph deleted');
  });
  ctrl('fg-graph-new').addEventListener('click', () => { keepUnsaved(); useModel(NC.createModel(), ''); });
  ctrl('fg-graph-file').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ tool: GRAPH_FILE, version: 1, name: graphName, model: ctl.model }, null, 2)], { type: 'application/json' });
    Organica.download(blob, Organica.stamp(graphName ? graphName.replace(/[^\w-]+/g, '-').toLowerCase() : 'fvs-graph', 'json'));
    Organica.notice('Graph file saved');
  });
  ctrl('fg-graph-open').addEventListener('click', () => ctrl('fg-graph-input').click());
  ctrl('fg-graph-input').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data && data.tool === GRAPH_FILE && data.model) { keepUnsaved(); useModel(data.model, data.name || ''); }
      else if (data && data.tool === 'fvs-recipe') { openBuiltin(data); Organica.notice('Recipe opened as a graph'); }
      else throw new Error('Not a graph or a Figure recipe');
    } catch (err) { Organica.notice(err.message || 'That file could not be opened', { kind: 'error' }); }
  });
}

export function renderFigureGraph() {
  if (ctl) { ctl.refresh(); return; }
  rt.figureGraph = true;
  document.querySelector('.tier-view[data-tier="figure"]').classList.add('is-graph');
  document.querySelector('.tier-block[data-tier="figure"]').classList.add('is-graph');
  ctl = NC.mount({
    stage: ctrl('fg-graph'), registry, model: loadModel(),
    isActive: () => state.activeTier === 'figure' && !document.body.classList.contains('fvs-libview-open'),
    renderBody, cardClass, nodeLabel, protect,
    fitInset: { left: 88, bottom: 72 },   // the node bar (left dock) and the floatbar
    wireClass: (e, m) => { const src = NC.findNode(m, e.from.node); return !src ? '' : ['canvas', 'grid', 'palette'].includes(src.type) ? 'nc-wire--faint' : src.type === 'set' ? 'nc-wire--list' : ''; },
    onSelect: ids => { renderInspector(ids); syncButtons(); },
    onChange: (m, reason) => { syncButtons(); save(); if (reason !== 'move' && reason !== 'params') renderInspector(ctl.selection()); },
    onSearch: (at, from, client) => openSearch(at, from, client),
    onWireDrop: (from, at, client) => openSearch(at, from, client),
    onBoardDblClick: (at, client) => openSearch(at, null, client),
    onPortDblClick: (node, port, dir) => spawnFor(node, port, dir),
    nameCopy: (copy, model) => NUMBERED.includes(copy.type) ? nextName(model, copy.type) : copy.name,
    onNodeDblClick: node => { if (node.type === 'figure') Organica.notice('Compose is not available yet.'); },
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
  initNodebar(); initGraphMenu();
  renderInspector([]); syncButtons();
}
