/* ─────────────────────────────────────────────────────────────
   Rhizome — boot. Wires canvas, panel, floatbar, execution engine.
   Phase 1 MVP node set (Piano Parte 5): Loom Grid, Loom Grid→Geometry,
   Contour Trace, SVG→Points, Merge, Export, Genesis Seed (Tier 2 PoC).
   ───────────────────────────────────────────────────────────── */

import { buildModel, addNode, findNode } from './graph-model.js';
import { createEngine } from './execution-engine.js';
import { REGISTRY, getNodeType, defaultParams } from './node-registry.js';
import { createCanvasZoomPan } from './canvas/pan-zoom.js';
import { WireLayer } from './canvas/wires.js';
import { bindPortInteractions } from './canvas/ports.js';
import { createNodeCard, renderPreview } from './renderers/node-card.js';
import { renderInspector } from './renderers/inspector-panel.js';
import * as exportOps from './nodes/export.js';

const graphEl = document.getElementById('graph');
const wrapEl = document.getElementById('canvas-wrap');
const nodesLayer = document.getElementById('nodes-layer');
const wireLayerEl = document.getElementById('wire-layer');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');

const model = buildModel({ nodes: [], edges: [] });
const engine = createEngine();
const portEls = new Map();
const cardRefs = new Map();   // nodeId -> {el, previewEl, statusEl}
const zoomPanRef = { current: null };
const wireLayer = new WireLayer(wireLayerEl);
let selectedNodeId = null;

function setStatus(state, msg) {
  statusDot.className = 'org-header__dot' + (state ? ' ' + state : '');
  statusText.textContent = msg;
}

function guessValueType(value) {
  if (typeof value === 'string' && value.trim().startsWith('<svg')) return 'svg';
  if (Array.isArray(value)) return 'points';
  if (value && Array.isArray(value.cells)) return 'grid';
  return 'other';
}

function updateWires() {
  wireLayer.updateAll(model, portEls, graphEl, zoomPanRef.current ? zoomPanRef.current.zoom : 1);
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

function selectNode(nodeId) {
  selectedNodeId = nodeId;
  for (const [id, ref] of cardRefs) ref.el.classList.toggle('is-selected', id === nodeId);
  const node = findNode(model, nodeId);
  const nodeType = node ? getNodeType(node.type) : null;
  renderInspector(panelEl, node, nodeType, () => { engine.invalidate(nodeId); recompute(); },
    node && nodeType.meta.id === 'export' ? {
      png: async () => {
        const cached = engine.cache.get(nodeId);
        if (!cached || !cached.value) { setStatus('', 'Nothing to export yet.'); return; }
        await exportOps.exportPNG(cached.value, parseFloat(node.params.scale || '2'));
      },
      svg: () => {
        const cached = engine.cache.get(nodeId);
        if (!cached || !cached.value) { setStatus('', 'Nothing to export yet.'); return; }
        exportOps.exportSVG(cached.value);
      },
      figma: () => {
        const cached = engine.cache.get(nodeId);
        if (!cached || !cached.value) { setStatus('', 'Nothing to export yet.'); return; }
        exportOps.sendToFigma(cached.value);
      },
    } : null);
}

function addNodeCard(node) {
  const nodeType = getNodeType(node.type);
  const { el, previewEl, statusEl } = createNodeCard(node, nodeType, {
    zoomPanRef, portEls,
    onMove: updateWires,
    onSelect: selectNode,
  });
  nodesLayer.appendChild(el);
  cardRefs.set(node.id, { el, previewEl, statusEl });
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
}

// ── Canvas pan/zoom ──
zoomPanRef.current = createCanvasZoomPan({ graphEl, wrapEl, onChange: updateWires });

// ── Port drag-to-connect ──
bindPortInteractions({
  graphEl, wireLayer, portEls, model,
  getNodeOutputType: (nodeId, portName) => {
    const node = findNode(model, nodeId);
    return getNodeType(node.type).meta.outputs.find(o => o.name === portName).type;
  },
  getNodeInputType: (nodeId, portName) => {
    const node = findNode(model, nodeId);
    return getNodeType(node.type).meta.inputs.find(i => i.name === portName).type;
  },
  zoomPanRef,
  onConnected: () => { updateWires(); recompute(); },
  onRejected: (msg) => setStatus('', msg),
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
  nodesLayer.innerHTML = '';
  cardRefs.clear();
  portEls.clear();
  model.nodes = saved.nodes;
  model.edges = saved.edges;
  for (const node of model.nodes) addNodeCard(node);
  updateWires();
  recompute();
});
Organica.popover(document.getElementById('btn-graph-menu'), document.getElementById('graph-popover'));
refreshPresetList();

// ── Init ──
Organica.autoLabelPanel(document);
setStatus('active', 'Ready');
selectNode(null);
