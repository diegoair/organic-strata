/* ─────────────────────────────────────────────────────────────
   Rhizome — boot. Since Oct 2026 the board is the shared node canvas (Organica.nodeCanvas, shared/node-canvas.js
   + .css — the model, engine, history, view, node bar and node search FVS's Figure graph uses). Rhizome keeps its
   node types, its Tier-2 bridges, the inspector in #panel, the floatbar and its saved graphs.
   Node set: 7 Tier-1 natives (Loom grid, Loom grid file, Contour trace, SVG to points, Merge — variable inputs —,
   Image, Export) + 9 Tier-2 bridges (Genesis, Komorebi, Warping, Camo Turing, Membrane, Sinew, Spore, Pollen, Halide).
   ───────────────────────────────────────────────────────────── */

import { REGISTRY, getNodeType, createSharedRegistry } from './node-registry.js';
import { renderInspector } from './renderers/inspector-panel.js';
import { renderPreview } from './renderers/node-card.js';
import * as exportOps from './nodes/export.js';

const NC = Organica.nodeCanvas;
const $ = id => document.getElementById(id);

// The inspector builds its range inputs from JS: enhanceSliders' MutationObserver
// gives each the shared slider (liquid fill + click/drag-to-edit number) as it appears.
Organica.enhanceSliders(document);

const panelEl = $('panel'), stageEl = $('canvas-wrap');
const setStatus = Organica.status();   // errors and guards show as a notice; everything else is silent
const registry = createSharedRegistry();

// Each node has its own name — the type's label + a number ("Merge 2"); the card shows the type above it.
function nextName(model, type) {
  const base = registry.get(type).meta.label, used = new Set(model.nodes.map(n => n.name));
  let i = 1; while (used.has(base + ' ' + i)) i++; return base + ' ' + i;
}
function ensureNames(model) { model.nodes.forEach(n => { if (!n.name) n.name = nextName(model, n.type); }); return model; }

// A graph saved before Oct 2026 (Rhizome's own model, version '1.0') wires by `nodeId`; the shared model by `node`.
function migrateModel(saved) {
  const ref = r => ({ node: r.node || r.nodeId, port: r.port });
  return ensureNames(NC.createModel({
    nodes: (saved && saved.nodes || []).filter(n => REGISTRY.has(n.type)).map(n => ({ ...n, params: { ...(n.params || {}) } })),
    edges: (saved && saved.edges || []).map(e => ({ id: e.id, from: ref(e.from), to: ref(e.to) })),
    frames: saved && saved.frames || [],
  }));
}

// Every node computes, on screen or not: a bridge's output feeds what follows, and Export reads it.
let statusTimer = 0;
const engine = NC.createEngine({
  registry, isActive: () => true,
  onState: () => { clearTimeout(statusTimer); statusTimer = setTimeout(reportStatus, 60); },
});
function reportStatus() {
  if (!ctl) return;
  const errs = ctl.model.nodes.filter(n => { const e = engine.get(n.id); return e && e.state === 'error'; }).length;
  const n = ctl.model.nodes.length, c = ctl.model.edges.length;
  setStatus(errs ? 'error' : 'active', errs ? `${errs} node error${errs === 1 ? '' : 's'}` : `${n} node${n === 1 ? '' : 's'} · ${c} connection${c === 1 ? '' : 's'}`);
}

// ── the card body: a preview of the node's output, on a light work surface ──
function valueKind(v) {
  if (typeof v === 'string' && v.trim().startsWith('<svg')) return 'svg';
  if (Array.isArray(v)) return 'points';
  if (v && Array.isArray(v.cells)) return 'grid';
  if (v && (v.dataURL || v.mask)) return 'image';
  return 'other';
}
function renderBody(node, entry, el) {
  let box = el.querySelector('.rz-preview');
  if (!box) { box = document.createElement('div'); box.className = 'rz-preview'; box.setAttribute('data-theme', 'light'); el.replaceChildren(box); }
  const v = entry && entry.state === 'ok' && entry.value ? entry.value._v : null;
  if (v == null && node.type === 'export') { box.hidden = true; return; }
  box.hidden = false;
  renderPreview(box, valueKind(v), v);
}

// ── the inspector (#panel) for the one selected node ──
function renderInspectorFor(ids) {
  const node = ids.length === 1 ? NC.findNode(ctl.model, ids[0]) : null;
  const type = node ? getNodeType(node.type) : null;
  const valueOf = () => { const e = node && engine.get(node.id); return e && e.state === 'ok' && e.value ? e.value._v : null; };
  const needValue = fn => () => { const v = valueOf(); if (!v) { setStatus('error', 'Nothing to export — connect an SVG input'); return; } fn(v); };
  renderInspector(panelEl, node, type, {
    onChange: () => {
      if (typeof type.getInputs === 'function') {   // Merge: the input count may have changed — drop wires to ports that are gone
        const names = new Set(type.getInputs(node).map(p => p.name));
        ctl.model.edges = ctl.model.edges.filter(e => !(e.to.node === node.id && !names.has(e.to.port)));
        ctl.refresh();
      }
      ctl.touch(node.id);
      onModelChange();
    },
    onCommit: () => ctl.commit('params'),
    exportActions: node && type.meta.id === 'export' ? {
      png: needValue(v => exportOps.exportPNG(v, parseFloat(node.params.scale || '2'))),
      svg: needValue(v => exportOps.exportSVG(v)),
      figma: needValue(v => exportOps.sendToFigma(v)),
    } : null,
  });
}

// ── adding nodes: the node bar (left dock) and the node search ('/', right-click, double-click on the board,
// a wire released on empty space — then the picked node arrives wired) ──
function addNode(type, at, from) {
  const r = stageEl.getBoundingClientRect(), c = at || ctl.toBoard(r.left + r.width / 2, r.top + r.height / 2);
  const p = from && NC.portFor(registry, ctl.model, type, null, from);
  const node = ctl.add(type, { x: c.x - 112, y: c.y - 40 }, null, { name: nextName(ctl.model, type) });
  if (p) from.dir === 'out' ? ctl.connect({ node: from.node, port: from.port }, { node: node.id, port: p.name }) : ctl.connect({ node: node.id, port: p.name }, { node: from.node, port: from.port });
  return node;
}
function openSearch(at, from, client) {
  const fromNode = from && NC.findNode(ctl.model, from.node);
  const fromPort = fromNode && (from.dir === 'out' ? registry.outputsOf(fromNode) : registry.inputsOf(fromNode)).find(p => p.name === from.port);
  let items = registry.list().map(t => ({ label: t.meta.label, hint: t.meta.category, type: t.meta.id }));
  if (from) items = items.filter(it => NC.portFor(registry, ctl.model, it.type, null, from));
  const r = stageEl.getBoundingClientRect();
  NC.search({
    items, title: fromPort ? `Nodes that connect to ${fromPort.label || fromPort.name}` : '', returnFocus: stageEl,
    client: client || { x: r.left + r.width / 2, y: r.top + r.height / 3 },
    onPick: it => addNode(it.type, at, from),
  });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nodebar = NC.nodeBar({
  bar: $('rz-nodebar'), panel: $('rz-nodebar-panel'), stage: stageEl,
  icons: { Source: 'node-content', Process: 'node-rule', Output: 'node-output' },
  render: (cat, panel) => {
    const types = registry.byCategory()[cat] || [];
    panel.innerHTML = `<p class="nc-nodebar__hint">Drag onto the graph, or click to add</p><div class="nc-nodebar__list">`
      + types.map(t => `<button type="button" class="nc-nodebar__item" data-type="${esc(t.meta.id)}" aria-label="Add ${esc(t.meta.label)}">${esc(t.meta.label)}</button>`).join('') + `</div>`;
  },
  specOf: t => { const b = t.closest && t.closest('.nc-nodebar__item'); return b ? { type: b.dataset.type } : null; },
  onAdd: (spec, ev, over) => { if (ev.type === 'click') addNode(spec.type); else if (over) addNode(spec.type, ctl.toBoard(ev.clientX, ev.clientY)); },
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && nodebar.current()) nodebar.close(); });

// ── the board ──
let ctl = null;
ctl = NC.mount({
  stage: stageEl, registry, engine, model: NC.createModel(),
  renderBody,
  fitInset: { left: 88, bottom: 72 },   // the node bar (left dock) and the floatbar
  onSelect: ids => { renderInspectorFor(ids); syncButtons(); },
  onChange: (m, reason) => { onModelChange(); if (reason === 'remove' || reason === 'history') renderInspectorFor(ctl.selection()); },
  onSearch: openSearch,
  onWireDrop: (from, at, client) => openSearch(at, from, client),
  onBoardDblClick: (at, client) => openSearch(at, null, client),
  nameCopy: (copy, model) => nextName(model, copy.type),
  keyScope: t => !!(t && t.closest && t.closest('.org-floatbar, #rz-nodebar-dock') && !t.closest('input, select, textarea')),
});

// ── floatbar ──
function onModelChange() { syncButtons(); syncGraphButton(); }
function syncButtons() {
  $('btn-undo').disabled = !ctl.history.canUndo();
  $('btn-redo').disabled = !ctl.history.canRedo();
  const none = !ctl.selection().length, del = $('btn-delete-selected');
  del.setAttribute('aria-disabled', String(none));
  $('rz-delete-why').textContent = none ? 'Select a node first' : '';
  if (none) del.setAttribute('aria-describedby', 'rz-delete-why'); else del.removeAttribute('aria-describedby');
}
const icon = (id, name) => { $(id).innerHTML = Organica.icons.get(name); };
icon('btn-undo', 'undo'); icon('btn-redo', 'redo'); icon('btn-delete-selected', 'trash'); icon('btn-fit', 'fit-view'); icon('btn-fit-sel', 'fit-selection');
$('btn-undo').addEventListener('click', () => { ctl.undo(); syncButtons(); });
$('btn-redo').addEventListener('click', () => { ctl.redo(); syncButtons(); });
$('btn-delete-selected').addEventListener('click', () => {
  const sel = ctl.selection(); if (!sel.length) { Organica.notice('Select a node first'); return; }
  ctl.remove(sel); syncButtons();
});
$('btn-fit').addEventListener('click', () => ctl.fitAll());
$('btn-fit-sel').addEventListener('click', () => ctl.fitSelection());

// ── Graph menu: Saved graphs · Graph name · Save · Delete · New graph · Open file… · Save as file
// (the Figure graph's verbs). Saved graphs stay in Organica.presetStore('rhizome'). A graph that was never saved
// is kept as "Untitled n" before another replaces it, so nothing is lost. ──
const GRAPHS = Organica.presetStore('rhizome'), GRAPH_FILE = 'rhizome-graph';
let graphName = '';
const snap = m => JSON.stringify({ nodes: m.nodes, edges: m.edges, frames: m.frames || [] });
function savedAs() { const e = graphName && GRAPHS.read()[graphName]; return !!e && snap(migrateModel(e)) === snap(ctl.model); }
function syncGraphButton() {
  const unsaved = !!ctl.model.nodes.length && !savedAs();
  $('btn-rz-graph').classList.toggle('is-unsaved', unsaved);
  if (unsaved) $('btn-rz-graph').setAttribute('aria-description', 'Not saved'); else $('btn-rz-graph').removeAttribute('aria-description');
  Organica.dirty.set('graph', unsaved);
}
function syncGraphMenu() {
  const sel = $('rz-graph-saved'), names = Object.keys(GRAPHS.read()).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = names.length ? '<option value="">—</option>' + names.map(n => `<option${n === graphName ? ' selected' : ''}>${esc(n)}</option>`).join('') : '<option value="">No saved graphs yet</option>';
  sel.disabled = !names.length;
  $('rz-graph-name').value = graphName;
  $('rz-graph-delete').disabled = !graphName || !GRAPHS.read()[graphName];
  syncGraphButton();
}
function keepUnsaved() {
  if (!ctl.model.nodes.length || savedAs()) return;
  const all = GRAPHS.read(); let i = 1; while (all['Untitled ' + i]) i++;
  const n = graphName && !all[graphName] ? graphName : 'Untitled ' + i;
  all[n] = JSON.parse(JSON.stringify(ctl.model)); GRAPHS.write(all);
  Organica.notice(`The current graph was saved as “${n}”`);
}
function useModel(model, name) {
  graphName = name || '';
  ctl.setModel(migrateModel(model));
  renderInspectorFor([]); syncButtons(); syncGraphMenu();
  requestAnimationFrame(() => ctl.fitAll());
}
$('btn-rz-graph').querySelector('.rz-graph-btn__chev').innerHTML = Organica.icons.get('chevron-down', { cls: 'chev' });
Organica.popover($('btn-rz-graph'), $('rz-graph-popover'));
$('btn-rz-graph').addEventListener('click', syncGraphMenu);
$('rz-graph-saved').addEventListener('change', e => { const n = e.target.value, g = n && GRAPHS.read()[n]; if (!g) return; keepUnsaved(); useModel(g, n); });
$('rz-graph-save').addEventListener('click', () => {
  const n = $('rz-graph-name').value.trim(); if (!n) { Organica.notice('Name the graph first'); $('rz-graph-name').focus(); return; }
  const all = GRAPHS.read(); all[n] = JSON.parse(JSON.stringify(ctl.model)); GRAPHS.write(all);
  graphName = n; syncGraphMenu(); Organica.notice('Graph saved');
});
$('rz-graph-delete').addEventListener('click', () => {
  if (!graphName) return; const all = GRAPHS.read(); delete all[graphName]; GRAPHS.write(all);
  Organica.notice('Graph deleted'); graphName = ''; syncGraphMenu();
});
$('rz-graph-new').addEventListener('click', () => { keepUnsaved(); useModel({ nodes: [], edges: [] }, ''); });
$('rz-graph-open').addEventListener('click', () => $('rz-graph-input').click());
$('rz-graph-input').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text()), m = data.model || data;
    if (!Array.isArray(m.nodes) || !Array.isArray(m.edges)) throw new Error('not a graph');
    keepUnsaved(); useModel(m, data.name || f.name.replace(/\.json$/i, ''));
  } catch (err) { setStatus('error', 'That file is not a Rhizome graph.'); }
});
$('rz-graph-file').addEventListener('click', () => {
  const data = { tool: GRAPH_FILE, name: graphName || '', model: ctl.model };
  Organica.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), Organica.stamp(GRAPH_FILE, 'json'));
  Organica.notice('Graph file saved');
});
GRAPHS.pull().then(syncGraphMenu);   // cloud sync (shared/store.js)
GRAPHS.onSync(syncGraphMenu);

// ── init ──
[['/', 'Search nodes', 'Edit'], ['Delete / Backspace', 'Delete selection', 'Edit'], ['⌘Z', 'Undo', 'Edit'], ['⌘⇧Z', 'Redo', 'Edit'], ['⇧1', 'Fit all', 'View'], ['⇧2', 'Fit selection', 'View']]
  .forEach(([keys, label, group]) => Organica.shortcuts.add({ keys, label, group }));
Organica.autoLabelPanel(document);
setStatus('active', 'Ready');
renderInspectorFor([]);
syncButtons(); syncGraphMenu();

// test hook (scripts/test-rhizome.sh)
window.__rhizome = { ctl, registry, engine, migrateModel, openSearch, nodebar };
