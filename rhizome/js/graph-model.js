/* ─────────────────────────────────────────────────────────────
   Rhizome — canonical graph model (Piano approvato, Parte 3.3).

   Same discipline as Loom's own Universal JSON Model (loom/js/json-model.js
   §18-24's own stated principle, cited directly in the plan): ONE object
   is the source of truth. Node output values, dirty flags, adjacency
   lists, topological order — none of that lives here, all derived on
   demand by execution-engine.js. A derivable value stored alongside its
   source is exactly how the "which one is the truth" bug happens.
   ───────────────────────────────────────────────────────────── */

export const MODEL_VERSION = '1.0';

// node: { id, type, x, y, params }   — x/y are real position, not derived
// edge: { id, from:{nodeId,port}, to:{nodeId,port} }
export function buildModel({ nodes = [], edges = [] } = {}) {
  return {
    version: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  };
}

let idSeq = 0;
export function nextId(prefix) {
  return prefix + '-' + (++idSeq) + '-' + Date.now().toString(36);
}

export function addNode(model, { type, x, y, params }) {
  const node = { id: nextId('n'), type, x, y, params: params || {} };
  model.nodes.push(node);
  return node;
}

export function removeNode(model, nodeId) {
  model.nodes = model.nodes.filter(n => n.id !== nodeId);
  model.edges = model.edges.filter(e => e.from.nodeId !== nodeId && e.to.nodeId !== nodeId);
}

export function addEdge(model, from, to) {
  // An input port accepts at most one incoming edge — connecting a second
  // wire to an already-fed input silently replaces the first, matching
  // the "one output per input handle" convention of every node editor
  // this project's own research cited (Weavy/ComfyUI-style).
  model.edges = model.edges.filter(e => !(e.to.nodeId === to.nodeId && e.to.port === to.port));
  const edge = { id: nextId('e'), from, to };
  model.edges.push(edge);
  return edge;
}

export function removeEdge(model, edgeId) {
  model.edges = model.edges.filter(e => e.id !== edgeId);
}

export function findNode(model, nodeId) {
  return model.nodes.find(n => n.id === nodeId) || null;
}

export function edgesInto(model, nodeId) {
  return model.edges.filter(e => e.to.nodeId === nodeId);
}
