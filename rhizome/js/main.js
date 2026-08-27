/* ─────────────────────────────────────────────────────────────
   Rhizome — boot. Wires canvas, panel, floatbar, execution engine.
   Node set (Piano Parte 5 + Fase 2/3): 6 Tier-1 natives (Loom Grid,
   Loom Grid→Geometry, Contour Trace, SVG→Points, Merge — variadic —,
   Image Upload, Export) + 10 Tier-2 bridges (Genesis, Komorebi, Warping,
   Soul, Camo Turing, Membrane, Living Path, Spore, Pollen, Halide).
   ───────────────────────────────────────────────────────────── */

import { buildModel, addNode, removeNode, removeEdge, addEdge, findNode } from './graph-model.js';
import { createEngine } from './execution-engine.js';
import { REGISTRY, getNodeType, getNodeInputs, defaultParams } from './node-registry.js';
import { createCanvasZoomPan } from './canvas/pan-zoom.js';
import { WireLayer } from './canvas/wires.js';
import { bindPortInteractions } from './canvas/ports.js';
import { bindSelection } from './canvas/selection.js';
import { createNodeCard, renderPreview } from './renderers/node-card.js';
import { renderInspector } from './renderers/inspector-panel.js';
import { createHistory } from './history.js';
import * as exportOps from './nodes/export.js';

const graphEl = document.getElementById('graph');
const wrapEl = document.getElementById('canvas-wrap');
const nodesLayer = document.getElementById('nodes-layer');
const wireLayerEl = document.getElementById('wire-layer');
const marqueeEl = document.getElementById('marquee-rect');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');

const model = buildModel({ nodes: [], edges: [] });
const engine = createEngine();
const history = createHistory();
const portEls = new Map();
const cardRefs = new Map();   // nodeId -> {el, previewEl, statusEl, refreshPorts}
const zoomPanRef = { current: null };
const wireLayer = new WireLayer(wireLayerEl, onWireClick);
let selectedNodeId = null;
let selection = null;   // set below, after bindSelection

function setStatus(state, msg) {
  statusDot.className = 'org-header__dot' + (state ? ' ' + state : '');
  statusText.textContent = msg;
}

function guessValueType(value) {
  if (typeof value === 'string' && value.trim().startsWith('<svg')) return 'svg';
  if (Array.isArray(value)) return 'points';
  if (value && Array.isArray(value.cells)) return 'grid';
  if (value && (value.dataURL || value.mask)) return 'image';
  return 'other';
}

function applyPos(node) {
  const ref = cardRefs.get(node.id);
  if (ref) { ref.el.style.left = node.x + 'px'; ref.el.style.top = node.y + 'px'; }
}

function updateWires() {
  wireLayer.updateAll(model, portEls, graphEl, zoomPanRef.current ? zoomPanRef.current.zoom : 1);
}

function commitHistory() {
  history.push(model);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.disabled = !history.canUndo();
  if (redoBtn) redoBtn.disabled = !history.canRedo();
}

// recompute() calls are serialized, not concurrent: two overlapping
// runGraph() calls (e.g. add-node then immediately connect, both firing
// recompute()) each create/reuse the SAME bridge iframe per node
// (bridge-iframe.js's `pending` map is keyed by nodeId) — the SECOND
// call's pending-response registration silently overwrites the FIRST's,
// so the first call's `await runNode(...)` never resolves and its whole
// for-loop hangs forever with no error surfaced. Found live: a 3-node
// graph (2 bridge nodes) left one node's preview permanently empty with
// no error shown, reproduced in isolation, root-caused to this exact
// race. Fixed by never running two recomputes at once — a later call
// while one is in flight just marks `queued` and the in-flight call
// re-runs itself once more after finishing, picking up the latest model.
let recomputeRunning = false;
let recomputeQueued = false;

async function recompute() {
  if (recomputeRunning) { recomputeQueued = true; return; }
  recomputeRunning = true;
  try {
    await recomputeNow();
    while (recomputeQueued) {
      recomputeQueued = false;
      await recomputeNow();
    }
  } finally {
    recomputeRunning = false;
  }
}

async function recomputeNow() {
  setStatus('busy', 'Running…');
  try {
    const { values, errors } = await engine.runGraph(model);
    for (const node of model.nodes) {
      const ref = cardRefs.get(node.id);
      if (!ref) continue;
      const cached = values.get(node.id);
      const err = errors.get(node.id);
      if (err) {
        ref.statusEl.textContent = err.message;
        ref.previewEl.innerHTML = '<span class="rz-node__empty">error</span>';
      } else {
        ref.statusEl.textContent = '';
        const value = cached ? cached.value : null;
        renderPreview(ref.previewEl, guessValueType(value), value);
      }
    }
    updateWires();
    const errCount = [...errors.keys()].length;
    setStatus(errCount ? '' : 'active', errCount ? `${errCount} node error${errCount === 1 ? '' : 's'}` : `${model.nodes.length} nodes · ${model.edges.length} edges`);
  } catch (e) {
    setStatus('', e.message);
  }
}

function selectNode(nodeId, evt) {
  if (evt && evt.shiftKey && nodeId) {
    selection.toggle(nodeId);
    // Shift-click adds/removes from the multi-selection but doesn't
    // necessarily change which node's OWN params show in the inspector —
    // only a plain click does that, matching Strata's own Refine editor.
    return;
  }
  selectedNodeId = nodeId;
  wireLayer.setSelectedEdge(null);
  if (nodeId) selection.set([nodeId]); else selection.clear();
  for (const [id, ref] of cardRefs) ref.el.classList.toggle('is-selected', id === nodeId);
  renderInspectorFor(nodeId);
}

function onWireClick(edgeId) {
  selectedNodeId = null;
  selection.clear();
  for (const [, ref] of cardRefs) ref.el.classList.remove('is-selected');
  wireLayer.setSelectedEdge(edgeId);
  renderInspectorFor(null);
}

function renderInspectorFor(nodeId) {
  const node = findNode(model, nodeId);
  const nodeType = node ? getNodeType(node.type) : null;
  renderInspector(panelEl, node, nodeType, {
    onChange: () => {
      engine.invalidate(node.id);
      // Variadic nodes (Merge) may have just changed their own input
      // COUNT — re-derive the port list and rebuild the card's port rows
      // so the canvas can't drift out of sync with node.params.
      if (nodeType.getInputs) {
        const ref = cardRefs.get(node.id);
        const newInputs = getNodeInputs(node);
        ref.refreshPorts(newInputs, nodeType.meta.outputs);
        // Dropping an input port orphans any edge still connected to it —
        // prune those rather than leaving a dangling edge the engine
        // would otherwise try (and fail) to resolve.
        const validNames = new Set(newInputs.map(p => p.name));
        model.edges = model.edges.filter(e => !(e.to.nodeId === node.id && !validNames.has(e.to.port)));
        updateWires();
      }
      recompute();
    },
    onCommit: commitHistory,
    exportActions: node && nodeType.meta.id === 'export' ? {
      png: async () => {
        const cached = engine.cache.get(node.id);
        if (!cached || !cached.value) { setStatus('', 'Nothing to export yet.'); return; }
        await exportOps.exportPNG(cached.value, parseFloat(node.params.scale || '2'));
      },
      svg: () => {
        const cached = engine.cache.get(node.id);
        if (!cached || !cached.value) { setStatus('', 'Nothing to export yet.'); return; }
        exportOps.exportSVG(cached.value);
      },
      figma: () => {
        const cached = engine.cache.get(node.id);
        if (!cached || !cached.value) { setStatus('', 'Nothing to export yet.'); return; }
        exportOps.sendToFigma(cached.value);
      },
    } : null,
  });
}

function addNodeCard(node) {
  const nodeType = getNodeType(node.type);
  const nodeInputs = getNodeInputs(node);
  const { el, previewEl, statusEl, refreshPorts } = createNodeCard(node, nodeType, nodeInputs, {
    zoomPanRef, portEls,
    applyPos,
    onMove: () => updateWires(),
    onDragEnd: (group, moved) => { if (moved) commitHistory(); },
    onSelect: selectNode,
    getDragGroup: (n) => {
      const sel = selection ? selection.current : new Set();
      if (sel.has(n.id) && sel.size > 1) {
        return model.nodes.filter(x => sel.has(x.id));
      }
      return [n];
    },
  });
  nodesLayer.appendChild(el);
  cardRefs.set(node.id, { el, previewEl, statusEl, refreshPorts });
}

function addNodeOfType(typeId) {
  const wrapRect = wrapEl.getBoundingClientRect();
  const zoom = zoomPanRef.current ? zoomPanRef.current.zoom : 1;
  const pan = zoomPanRef.current ? zoomPanRef.current.pan : { x: 0, y: 0 };
  const node = addNode(model, {
    type: typeId,
    x: (wrapRect.width / 2 - pan.x) / zoom - 120,
    y: (wrapRect.height / 2 - pan.y) / zoom - 60,
    params: defaultParams(typeId),
  });
  addNodeCard(node);
  recompute();
  selectNode(node.id);
  commitHistory();
}

function deleteSelection() {
  const sel = selection ? selection.current : new Set();
  const edgeId = wireLayer.selectedEdgeId;
  if (!sel.size && !edgeId) return;
  for (const nodeId of sel) {
    removeNode(model, nodeId);
    const ref = cardRefs.get(nodeId);
    if (ref) ref.el.remove();
    cardRefs.delete(nodeId);
    for (const key of Array.from(portEls.keys())) if (key.startsWith(nodeId + ':')) portEls.delete(key);
    engine.invalidate(nodeId);
  }
  if (edgeId) removeEdge(model, edgeId);
  selection.clear();
  wireLayer.setSelectedEdge(null);
  selectedNodeId = null;
  renderInspectorFor(null);
  updateWires();
  recompute();
  commitHistory();
}

// ── Rebuild the whole canvas from a {nodes, edges} snapshot — shared by
//    preset-load and undo/redo, so the two can't drift into two
//    different "restore a saved graph" implementations. ──
function loadGraphState(nodes, edges) {
  nodesLayer.innerHTML = '';
  cardRefs.clear();
  portEls.clear();
  model.nodes = nodes;
  model.edges = edges;
  for (const node of model.nodes) addNodeCard(node);
  if (selection) selection.clear();
  selectedNodeId = null;
  wireLayer.setSelectedEdge(null);
  renderInspectorFor(null);
  updateWires();
  recompute();
}

// ── Canvas pan/zoom ──
zoomPanRef.current = createCanvasZoomPan({ graphEl, wrapEl, onChange: updateWires });

// ── Multi-select / marquee (Shift+drag on empty canvas) ──
selection = bindSelection({
  graphEl, wrapEl, marqueeEl, model, cardRefs, zoomPanRef,
  onSelectionChange: () => {},
});

// ── Port drag-to-connect ──
bindPortInteractions({
  graphEl, wireLayer, portEls, model,
  getNodeOutputType: (nodeId, portName) => {
    const node = findNode(model, nodeId);
    return getNodeType(node.type).meta.outputs.find(o => o.name === portName).type;
  },
  getNodeInputType: (nodeId, portName) => {
    const node = findNode(model, nodeId);
    return getNodeInputs(node).find(i => i.name === portName).type;
  },
  zoomPanRef,
  onConnected: () => { updateWires(); recompute(); commitHistory(); },
  onRejected: (msg) => setStatus('', msg),
});

// ── Delete key — removes the selected node(s) or the selected wire.
//    Ignored while typing in any text field/select so Delete/Backspace
//    still works normally inside the inspector panel's own controls. ──
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  deleteSelection();
});

// ── Undo/redo — Cmd/Ctrl+Z / Shift+Z, same shortcut convention as
//    Organica.createZoomPan's own Cmd/Ctrl+/-/0 handling. ──
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  const snap = e.shiftKey ? history.redo() : history.undo();
  if (snap) loadGraphState(snap.nodes, snap.edges);
  updateHistoryButtons();
});

// ── Add-node menu ──
const addNodeList = document.getElementById('add-node-list');
for (const [id, type] of REGISTRY) {
  const btn = document.createElement('button');
  btn.className = 'org-btn';
  btn.textContent = type.meta.label;
  btn.addEventListener('click', () => addNodeOfType(id));
  addNodeList.appendChild(btn);
}
Organica.popover(document.getElementById('btn-add-node'), document.getElementById('add-node-popover'));

// ── Undo/redo/delete floatbar buttons ──
document.getElementById('btn-undo').addEventListener('click', () => {
  const snap = history.undo();
  if (snap) loadGraphState(snap.nodes, snap.edges);
  updateHistoryButtons();
});
document.getElementById('btn-redo').addEventListener('click', () => {
  const snap = history.redo();
  if (snap) loadGraphState(snap.nodes, snap.edges);
  updateHistoryButtons();
});
document.getElementById('btn-delete-selected').addEventListener('click', deleteSelection);

// ── Graph presets (Organica.presetStore, same convention as every other tool) ──
const PRESETS = Organica.presetStore('rhizome');
function refreshPresetList() {
  const sel = document.getElementById('sel-preset');
  sel.innerHTML = '<option value="">— none —</option>';
  const store = PRESETS.read();
  for (const name of Object.keys(store)) {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  }
}
document.getElementById('btn-save-preset').addEventListener('click', () => {
  const nameInput = document.getElementById('txt-preset-name');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  const store = PRESETS.read();
  store[name] = model;
  PRESETS.write(store);
  nameInput.value = '';
  refreshPresetList();
});
document.getElementById('btn-delete-preset').addEventListener('click', () => {
  const sel = document.getElementById('sel-preset');
  if (!sel.value) return;
  const store = PRESETS.read();
  delete store[sel.value];
  PRESETS.write(store);
  refreshPresetList();
});
document.getElementById('sel-preset').addEventListener('change', (e) => {
  if (!e.target.value) return;
  const store = PRESETS.read();
  const saved = store[e.target.value];
  if (!saved) return;
  loadGraphState(saved.nodes, saved.edges);
  commitHistory();
});
Organica.popover(document.getElementById('btn-graph-menu'), document.getElementById('graph-popover'));
refreshPresetList();

// ── Init ──
Organica.autoLabelPanel(document);
setStatus('active', 'Ready');
selectNode(null);
commitHistory();   // seed the undo stack with the empty-graph baseline
