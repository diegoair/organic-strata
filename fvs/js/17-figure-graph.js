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
  canvasOf, canvasSummary, entrySnapshot, figureNodeTypes, gridDefaults, gridSummary
} from './engine/17-figure-nodes.js';
import {
  ctrl
} from './00-core.js';

provide({ renderFigureTier: () => renderFigureGraph });

const NC = Organica.nodeCanvas;
const registry = NC.createRegistry(figureNodeTypes());
const VIEW_KEY = 'organica.fvs.figure-view';
const GRAPHS = Organica.store('fvs-figure');
const CURRENT = 'Current graph';   // the graph being edited, autosaved
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { Foundation: 'node-foundation', Content: 'node-content', Rules: 'node-rule', Output: 'node-output' };
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
  const old = urls.get(id); if (old) URL.revokeObjectURL(old);
  const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); urls.set(id, u); return u;
}
function renderBody(node, entry, el) {
  const p = node.params || {}, v = entry && entry.value;
  if (node.type === 'figure') {
    const f = v && v.figure;
    if (!f) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="fg-card__sheet" data-theme="light"><img class="fg-card__img" alt="${esc(nodeLabel(node))} preview" src="${figureImg(node.id, f.svg)}"></div>
      <p class="fg-card__meta">${esc(canvasSummary(f.canvas))} · ${f.cells} cells</p>`;
  } else if (node.type === 'canvas') {
    const cv = canvasOf(p);
    el.innerHTML = `<p class="fg-card__meta">${Organica.aspectIcon ? Organica.aspectIcon(cv.W, cv.H) : ''} ${esc(canvasSummary(cv))}</p>`;
  } else if (node.type === 'grid') {
    el.innerHTML = `<p class="fg-card__meta">${esc(gridSummary({ gen: p.gen, params: p.params }))}</p>`;
  } else if (node.type === 'palette') {
    el.innerHTML = `<div class="fg-card__swatches" data-theme="light">${[p.paper, ...(p.colors || [])].map((c, i) => `<span class="fg-card__swatch${i ? '' : ' is-paper'}" style="background:${esc(c)}"></span>`).join('')}</div>`;
  } else if (node.type === 'element' || node.type === 'component') {
    const gone = p.name && !(node.type === 'element' ? ELEMENT_LIB.peek() : LIBRARY.peek())[p.name];
    el.innerHTML = p.snapshot ? `<div class="fg-card__thumb" data-theme="light">${entryThumb(node.type, p.name, p.snapshot)}</div>
      <p class="fg-card__meta">${gone ? `${esc(p.name)} is no longer in the library — drawn from the copy kept in this graph` : esc(p.name)}</p>` : '';
  }
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
function viewCentre() { const r = ctrl('fg-graph').getBoundingClientRect(); return ctl.toBoard(r.left + r.width / 2, r.top + r.height / 3); }
function addNode(type, at, params) {
  at = at || viewCentre();
  const named = t => ({ name: nameFor(ctl.model, t, t === type ? params : null) });
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
  }
  if (cat === 'Rules') html += `<p class="fg-nodebar__empty">Rule nodes are not available yet.</p>`;
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
        if (ev.type === 'pointerup' && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) addNode(spec.type, ctl.toBoard(ev.clientX, ev.clientY), spec.params);
      } else if (ev.type === 'pointerup') addNode(spec.type, null, spec.params);   // a click: add at the view centre
    };
    src.addEventListener('pointermove', move); src.addEventListener('pointerup', up); src.addEventListener('pointercancel', up);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openCat && state.activeTier === 'figure') setNodebar(null); });
}

// ── inspector (right panel) ──
function edited(node, commit) { ctl.touch(node.id); if (commit) ctl.commit('params'); save(); }
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
      <p class="panel-hint">Add nodes from the bar on the left. Drag from a port to connect; drop a wire on a node to use its first free input.</p></div>`;
    return;
  }
  if (nodes.length > 1) { box.innerHTML = `<div class="panel-section"><h3>${nodes.length} nodes selected</h3></div>`; return; }
  const node = nodes[0], p = node.params, rows = [];
  const title = `<div class="panel-section"><h3>${esc(nodeLabel(node))}</h3>`;
  const why = protect(node, ctl.model);
  if (node.type === 'canvas') {
    // The Symbol step's own Canvas section (fvs/index.html #sym-canvas-section) — same controls, same ranges (G4).
    const cv = canvasOf(p), print = p.mode === 'print';
    rows.push({ html: `<div class="ctrl-row"><select class="panel-select fg-grow" id="fgi-preset" aria-label="Canvas format">${[...Object.keys(SYMCANVAS_PRESETS), 'Custom'].map(n => `<option${n === (SYMCANVAS_PRESETS[p.preset] ? p.preset : 'Custom') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div class="ctrl-row"><div class="seg-ctrl" id="fgi-mode" role="group" aria-label="Canvas mode"><button class="seg-btn${print ? '' : ' active'}" data-mode="screen" aria-pressed="${!print}">Screen</button><button class="seg-btn${print ? ' active' : ''}" data-mode="print" aria-pressed="${print}">Print</button></div></div>
      <div class="ctrl-row"><span class="ctrl-label">Size</span><input type="number" class="panel-input fg-size" id="fgi-pw" min="1" step="1" value="${cv.pw}" aria-label="Canvas width"><span class="hint">×</span><input type="number" class="panel-input fg-size" id="fgi-ph" min="1" step="1" value="${cv.ph}" aria-label="Canvas height"><span class="hint">${esc(cv.unit)}</span></div>
      ${print ? `<div class="ctrl-row"><span class="ctrl-label">Unit</span><select class="panel-select" id="fgi-unit" aria-label="Canvas unit"><option value="mm"${cv.unit === 'mm' ? ' selected' : ''}>mm</option><option value="in"${cv.unit === 'in' ? ' selected' : ''}>in</option></select></div>
      <div class="ctrl-row"><span class="ctrl-label">DPI</span><input type="number" class="panel-input" id="fgi-dpi" min="72" max="2400" step="1" value="${cv.dpi}" aria-label="Canvas DPI"></div>
      <div class="ctrl-row"><span class="ctrl-label">Bleed (mm)</span><input type="number" class="panel-input" id="fgi-bleed" min="0" max="20" step="0.5" value="${cv.bleed}" aria-label="Canvas bleed in millimetres"></div>` : ''}`,
      bind: () => {
        const again = () => { edited(node, true); renderInspector(ids); };
        ctrl('fgi-preset').addEventListener('change', e => { p.preset = e.target.value; if (p.preset === 'Custom') { p.pw = cv.pw; p.ph = cv.ph; } again(); });
        ctrl('fgi-mode').addEventListener('click', e => { const bt = e.target.closest('[data-mode]'); if (!bt || bt.dataset.mode === p.mode) return; p.mode = bt.dataset.mode; if (!SYMCANVAS_PRESETS[p.preset]) { const c2 = canvasOf({ ...p }); p.pw = c2.pw; p.ph = c2.ph; } again(); });
        const size = () => { p.preset = 'Custom'; p.pw = +ctrl('fgi-pw').value || 1; p.ph = +ctrl('fgi-ph').value || 1; again(); };
        ctrl('fgi-pw').addEventListener('change', size); ctrl('fgi-ph').addEventListener('change', size);
        if (print) {
          ctrl('fgi-unit').addEventListener('change', e => { p.unit = e.target.value; again(); });
          ctrl('fgi-dpi').addEventListener('change', e => { p.dpi = Math.min(2400, Math.max(72, +e.target.value || 300)); edited(node, true); });
          ctrl('fgi-bleed').addEventListener('change', e => { p.bleed = Math.min(20, Math.max(0, +e.target.value || 0)); edited(node, true); });
        }
      } });
    rows.push(rangeRow('Margin', 'fgi-margin', 0, 25, 1, Math.min(25, p.margin), (v, c) => { p.margin = v; edited(node, c); }));
  } else if (node.type === 'grid') {
    rows.push(selectRow('Generator', 'fgi-gen', Object.entries(SYMGRID_GENS).map(([k, g]) => [k, g.label]), p.gen, v => { p.gen = v; p.params = gridDefaults(v); edited(node, true); renderInspector(ids); }));
    (SYMGRID_GENS[p.gen] || SYMGRID_GENS.rectangular).params.forEach(([k, label, a, b, step, def]) => {
      if (a === 'text') return;
      const val = p.params && p.params[k] != null ? p.params[k] : def;
      rows.push(rangeRow(label, 'fgi-g-' + k, a, b, step, val, (v, c) => { p.params = { ...(p.params || {}), [k]: v }; edited(node, c); }));
    });
  } else if (node.type === 'palette') {
    rows.push({ html: `<div class="ctrl-row"><div class="ctrl-label">Inks</div></div><div id="fgi-inks"></div>
      <div class="color-row"><span class="color-name">Paper</span><span class="color-swatch-wrap"><button class="color-swatch" id="sw-fgi-paper" style="background:${esc(p.paper)}"></button><input type="color" id="cp-fgi-paper" value="${esc(p.paper)}"></span><input class="color-hex" id="hex-fgi-paper" value="${esc(p.paper)}" maxlength="7"></div>`,
      bind: () => {
        Organica.palette.swatch(ctrl('fgi-inks'), { colors: p.colors, min: 1, max: 8, onChange: colors => { p.colors = colors.slice(); edited(node, true); } });
        Organica.palette.swatch('fgi-paper', { onChange: hex => { if (hex === p.paper) return; p.paper = hex; edited(node, true); } });
      } });
    rows.push(selectRow('Colour by', 'fgi-rule', Object.entries(COLOR_RULES).map(([k, r]) => [k, r.label]), (p.rule || {}).mode || 'index', v => { p.rule = { ...(p.rule || {}), mode: v }; edited(node, true); }));
  } else if (node.type === 'element' || node.type === 'component') {
    const s = savedEntries()[node.type];
    rows.push({ html: s.length ? `<div class="sub-label">Saved ${node.type === 'element' ? 'Elements' : 'Components'}</div><div class="fvs-rail__grid" id="fgi-pick">${s.map(e => `<button type="button" class="fvs-library-item${e.name === p.name ? ' selected' : ''}" data-name="${esc(e.name)}" aria-label="${esc(e.name)}" aria-pressed="${e.name === p.name}">${entryThumb(node.type, e.name, e.entry)}</button>`).join('')}</div>`
      : `<p class="org-empty">Nothing saved yet — save ${node.type === 'element' ? 'an Element in the Element' : 'a Component in the Component'} step first.</p>`,
      bind: () => { const g = ctrl('fgi-pick'); if (g) g.addEventListener('click', e => { const b = e.target.closest('[data-name]'); if (!b) return; Object.assign(p, addContent(node.type, b.dataset.name).params); node.name = b.dataset.name; edited(node, true); ctl.refresh(); renderInspector(ids); ctl.paint(node.id); }); } });
  } else if (node.type === 'figure') {
    rows.push(selectRow('Fit in cell', 'fgi-fit', [['fill', 'Stretch'], ['contain', 'Contain'], ['cover', 'Cover (no gaps)'], ['match', 'Match cell']], p.fit, v => { p.fit = v; edited(node, true); }));
    rows.push({ html: `<label class="check-row"><input type="checkbox" id="fgi-clip"${p.clip !== false ? ' checked' : ''}> Clip to cell</label>`,
      bind: () => { ctrl('fgi-clip').addEventListener('change', e => { p.clip = e.target.checked; edited(node, true); }); } });
  }
  box.innerHTML = title + rows.map(r => r.html).join('') + (why ? `<p class="panel-hint">${esc(why)}.</p>` : '') + '</div>';
  rows.forEach(r => r.bind && r.bind());
  if (Organica.autoLabelPanel) Organica.autoLabelPanel(box);
}

// ── persistence: the current graph autosaves; the view (zoom, pan) is per browser ──
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const all = GRAPHS.read(); all[CURRENT] = { model: ctl.model, savedAt: new Date().toISOString() }; GRAPHS.write(all);
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ zoom: ctl.zoomPan.zoom, ...ctl.zoomPan.pan })); } catch (e) {}
  }, 400);
}
function loadModel() {
  const e = GRAPHS.read()[CURRENT];
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
    wireClass: (e, m) => { const src = NC.findNode(m, e.from.node); return src && ['canvas', 'grid', 'palette'].includes(src.type) ? 'nc-wire--faint' : ''; },
    onSelect: ids => { renderInspector(ids); syncButtons(); },
    onChange: () => { syncButtons(); save(); },
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
  ctrl('btn-fg-new').addEventListener('click', () => addNode('figure'));
  initNodebar();
  renderInspector([]); syncButtons();
}
