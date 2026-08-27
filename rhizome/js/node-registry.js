/* ─────────────────────────────────────────────────────────────
   Rhizome — node registry. id -> {meta, compute}.
   ───────────────────────────────────────────────────────────── */

import * as loomGridGenerator from './nodes/loom-grid-generator.js';
import * as loomGridGeometry from './nodes/loom-grid-geometry.js';
import * as contourTrace from './nodes/contour-trace.js';
import * as svgToPoints from './nodes/svg-to-points.js';
import * as merge from './nodes/merge.js';
import * as exportNode from './nodes/export.js';
import * as genesisBridge from './nodes/genesis-bridge.js';
import * as komorebiBridge from './nodes/komorebi-bridge.js';
import * as warpingBridge from './nodes/warping-bridge.js';
import * as soulBridge from './nodes/soul-bridge.js';
import * as camoTuringBridge from './nodes/camo-turing-bridge.js';

const NODE_TYPES = [
  loomGridGenerator,
  loomGridGeometry,
  contourTrace,
  svgToPoints,
  merge,
  { meta: exportNode.meta, compute: exportNode.compute },
  genesisBridge,
  komorebiBridge,
  warpingBridge,
  soulBridge,
  camoTuringBridge,
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
