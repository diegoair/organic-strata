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
import * as livingpathBridge from './nodes/livingpath-bridge.js';
import * as sporeBridge from './nodes/spore-bridge.js';
import * as pollenBridge from './nodes/pollen-bridge.js';
import * as halideBridge from './nodes/halide-bridge.js';

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
  livingpathBridge,
  sporeBridge,
  pollenBridge,
  halideBridge,
];

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
// (node-card.js, execution-engine.js, the port-type lookups in main.js)
// goes through this dispatcher rather than reading `meta.inputs`
// directly, so a variadic node's port count can't drift out of sync
// between the canvas, the engine, and the connect-gesture code.
export function getNodeInputs(node) {
  const t = getNodeType(node.type);
  return typeof t.getInputs === 'function' ? t.getInputs(node) : t.meta.inputs;
}

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
