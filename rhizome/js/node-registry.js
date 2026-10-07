/* ─────────────────────────────────────────────────────────────
   Rhizome — node registry. id -> {meta, compute}.
   ───────────────────────────────────────────────────────────── */

import * as loomGridGenerator from './nodes/loom-grid-generator.js';
import * as loomGridGeometry from './nodes/loom-grid-geometry.js';
import * as contourTrace from './nodes/contour-trace.js';
import * as svgToPoints from './nodes/svg-to-points.js';
import * as merge from './nodes/merge.js';
import * as imageUpload from './nodes/image-upload.js';
import * as exportNode from './nodes/export.js';
import * as genesisBridge from './nodes/genesis-bridge.js';
import * as komorebiBridge from './nodes/komorebi-bridge.js';
import * as warpingBridge from './nodes/warping-bridge.js';
import * as camoTuringBridge from './nodes/camo-turing-bridge.js';
import * as membraneBridge from './nodes/membrane-bridge.js';
import * as sinewBridge from './nodes/sinew-bridge.js';
import * as sporeBridge from './nodes/spore-bridge.js';
import * as pollenBridge from './nodes/pollen-bridge.js';
import * as halideBridge from './nodes/halide-bridge.js';
import { ADAPTERS } from './adapters.js';
import { PORT_META } from './port-types.js';

const NODE_TYPES = [
  loomGridGenerator,
  loomGridGeometry,
  contourTrace,
  svgToPoints,
  merge,
  imageUpload,
  { meta: exportNode.meta, compute: exportNode.compute },
  genesisBridge,
  komorebiBridge,
  warpingBridge,
  camoTuringBridge,
  membraneBridge,
  sinewBridge,
  sporeBridge,
  pollenBridge,
  halideBridge,
];

// ── Visible names (docs/UI-COPY.md §2, Rhizome row): sentence case, real words. `id` / param `name` / port `name`
// stay as they are — saved graphs depend on them; only `label` is shown. Applied once, here, to every type's meta,
// so the board and the inspector read the same words. Category = the node bar group (Source · Process · Output).
const TYPE_LABELS = {
  'genesis-seed': 'Genesis seed', 'image-upload': 'Image', 'loom-grid-generator': 'Loom grid', 'loom-grid-geometry': 'Loom grid file',
  'camo-turing-pattern': 'Camo Turing pattern', 'komorebi-pattern': 'Komorebi pattern', 'warping-pattern': 'Warping pattern',
  'membrane-trail': 'Membrane trail', 'sinew-preset': 'Sinew effect', 'halide-dither': 'Halide dither', 'spore-stipple': 'Spore stipple',
  'pollen-stipple': 'Pollen stipple', 'contour-trace': 'Contour trace', 'svg-to-points': 'SVG to points', merge: 'Merge', export: 'Export',
};
const GROUP = {
  'genesis-seed': 'Source', 'image-upload': 'Source', 'loom-grid-generator': 'Source', 'loom-grid-geometry': 'Source', 'komorebi-pattern': 'Source',
  'warping-pattern': 'Source', 'camo-turing-pattern': 'Source', 'membrane-trail': 'Source', 'sinew-preset': 'Source',
  'halide-dither': 'Process', 'spore-stipple': 'Process', 'pollen-stipple': 'Process', 'contour-trace': 'Process', 'svg-to-points': 'Process', merge: 'Process',
  export: 'Output',
};
const PARAM_LABELS = {
  genType: 'Shape', preset: 'Preset', steps: 'Steps', pattern: 'Pattern', seconds: 'Duration (s)', type: 'Grid type', width: 'Width', height: 'Height',
  cols: 'Columns', rows: 'Rows', variety: 'Variety', gap: 'Gap', seed: 'Random seed', inputCount: 'Inputs', offsetXStep: 'Offset X per input',
  offsetYStep: 'Offset Y per input', padding: 'Padding', dataURL: 'Image', json: 'Grid file', scale: 'Scale',
};
export function optionLabel(v) {   // how a select option reads (its value stays the id)
  v = String(v);
  if (v.includes(':')) { const [a, b] = v.split(':'); return optionLabel(a) + ' · ' + b; }
  if (v === 'figure8') return 'Figure 8';
  return /^[a-z]/.test(v) ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}
const portLabel = p => ({ ...p, label: p.label || (PORT_META[p.type] ? PORT_META[p.type].label : p.name) });
NODE_TYPES.forEach(t => {
  const m = t.meta;
  m.label = TYPE_LABELS[m.id] || m.label;
  m.category = GROUP[m.id] || 'Process';
  m.params.forEach(p => { p.label = p.label || PARAM_LABELS[p.name] || p.name; });
  if (Array.isArray(m.inputs)) m.inputs = m.inputs.map(portLabel);
  m.outputs = (m.outputs || []).map(portLabel);
});

export const REGISTRY = new Map(NODE_TYPES.map(n => [n.meta.id, n]));

export function getNodeType(typeId) {
  const t = REGISTRY.get(typeId);
  if (!t) throw new Error(`Unknown node type "${typeId}".`);
  return t;
}

export function defaultParams(typeId) {
  const t = getNodeType(typeId);
  const out = {};
  for (const p of t.meta.params) out[p.name] = p.default;
  return out;
}

// A node's real input-port list — `meta.inputs` for every ordinary node,
// but a variadic node (Merge) exports its own `getInputs(node)` that
// reads the node's own params (e.g. inputCount) instead of a fixed
// array. Every caller that needs "this node's actual current ports"
// (the inspector, and the shared node canvas through sharedTypes() below)
// goes through this dispatcher rather than reading `meta.inputs`
// directly, so a variadic node's port count can't drift out of sync
// between the canvas, the engine, and the connect-gesture code.
export function getNodeInputs(node) {
  const t = getNodeType(node.type);
  return typeof t.getInputs === 'function' ? t.getInputs(node) : t.meta.inputs;
}

// ── The shared node canvas (Organica.nodeCanvas) reads the same types through this adapter: its compute()
// returns { <output port>: value } (here every node has one output, or none for Export), and a node with
// variable inputs (Merge) gives them as meta.inputs(node). `_v` keeps the raw value for the card preview and
// for Export, which has no output port.
export function sharedTypes() {
  return NODE_TYPES.map(t => ({
    meta: { ...t.meta, inputs: typeof t.getInputs === 'function' ? (node => t.getInputs(node)) : t.meta.inputs },
    async compute(inputs, params, ctx) {
      const v = await Promise.resolve(t.compute(inputs, params, ctx));
      const out = { _v: v };
      (t.meta.outputs || []).forEach(o => { out[o.name] = v; });
      return out;
    },
  }));
}
export function createSharedRegistry() { return Organica.nodeCanvas.createRegistry(sharedTypes(), { adapters: ADAPTERS }); }

// Node types offered in the "add node" menu, grouped by category —
// matches meta.category on each registered node (source/transform/sink/bridge).
export function byCategory() {
  const groups = {};
  for (const [, t] of REGISTRY) {
    const cat = t.meta.category || 'other';
    (groups[cat] = groups[cat] || []).push(t.meta);
  }
  return groups;
}
