/* ─────────────────────────────────────────────────────────────
   Rhizome — execution engine (Piano approvato, Parte 3.3).

   Topological sort + eager synchronous re-run on any upstream change.
   Tier 2 (bridge) nodes are the only genuinely async case — every node's
   compute() return value is Promise.resolve()'d uniformly, so this isn't
   a special code path, just a normalization.

   Dirty-flagging is per-node (a structural hash of that node's own
   resolved inputs + params, not the whole upstream subgraph) — same
   principle as Loom's own reactive rebuild-on-change, applied per node
   instead of per whole canvas.
   ───────────────────────────────────────────────────────────── */

import { edgesInto, findNode } from './graph-model.js';
import { getNodeType } from './node-registry.js';
import { canAdapt, adapt } from './adapters.js';

export class CycleError extends Error {}

// Kahn's algorithm. Throws CycleError (not a silent hang) if the edge set
// contains one — must be checked at connect-time in ports.js too, this
// is the last-resort backstop.
export function topoSort(model) {
  const inDegree = new Map(model.nodes.map(n => [n.id, 0]));
  for (const e of model.edges) inDegree.set(e.to.nodeId, (inDegree.get(e.to.nodeId) || 0) + 1);

  const queue = model.nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const e of model.edges) {
      if (e.from.nodeId !== id) continue;
      const d = inDegree.get(e.to.nodeId) - 1;
      inDegree.set(e.to.nodeId, d);
      if (d === 0) queue.push(e.to.nodeId);
    }
  }
  if (order.length !== model.nodes.length) {
    throw new CycleError('This connection would create a loop.');
  }
  return order;
}

function structuralHash(value) {
  try { return JSON.stringify(value); }
  catch { return String(value); }   // e.g. a Uint8Array mask — falls back to identity-ish string
}

export function createEngine() {
  const cache = new Map();   // nodeId -> {inputHash, value}
  const errors = new Map();  // nodeId -> Error

  async function runNode(model, node) {
    const type = getNodeType(node.type);
    const inputs = {};
    for (const portDef of type.meta.inputs) {
      const edge = edgesInto(model, node.id).find(e => e.to.port === portDef.name);
      if (!edge) { inputs[portDef.name] = null; continue; }
      const upstream = cache.get(edge.from.nodeId);
      let value = upstream ? upstream.value : null;
      const outType = getNodeType(findNode(model, edge.from.nodeId).type).meta.outputs
        .find(o => o.name === edge.from.port);
      if (value != null && outType && outType.type !== portDef.type) {
        if (!canAdapt(outType.type, portDef.type)) {
          throw new Error(`Port type mismatch: "${outType.type}" → "${portDef.type}" has no adapter.`);
        }
        value = adapt(outType.type, portDef.type, value);
      }
      inputs[portDef.name] = value;
    }

    const inputHash = structuralHash({ inputs: Object.keys(inputs).sort().map(k => structuralHash(inputs[k])), params: node.params });
    const cached = cache.get(node.id);
    if (cached && cached.inputHash === inputHash) { errors.delete(node.id); return cached.value; }

    try {
      const raw = type.compute(inputs, node.params, { nodeId: node.id });
      const value = await Promise.resolve(raw);
      cache.set(node.id, { inputHash, value });
      errors.delete(node.id);
      return value;
    } catch (err) {
      errors.set(node.id, err);
      cache.set(node.id, { inputHash, value: null });
      return null;
    }
  }

  async function runGraph(model) {
    const order = topoSort(model);   // throws CycleError — caller's job to surface it
    for (const nodeId of order) {
      const node = findNode(model, nodeId);
      await runNode(model, node);
    }
    return { values: cache, errors };
  }

  function invalidate(nodeId) {
    cache.delete(nodeId);
  }

  return { runGraph, invalidate, cache, errors };
}
