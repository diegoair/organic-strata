/* ─────────────────────────────────────────────────────────────
   Organica.nodeCanvas — a node graph: model, registry, engine, history (and, from Phase 2b, the canvas view).
   Extracted from Rhizome (rhizome/js/graph-model.js, execution-engine.js, history.js) at its second consumer,
   FVS's Figure graph (docs/FVS.md §12), and fixed on the way:
     · the engine recomputes only what changed: a node's cache key is its own revision + the output versions of the
       nodes feeding it (counters, never a JSON.stringify of big SVG inputs);
     · only what is needed runs: `isActive(node)` (e.g. "on screen") picks the outputs to compute; their ancestors
       run with them, everything else is left "stale" until it is needed;
     · every node has an explicit state — ok · error · waiting (a required input is missing) · upstream (a node it
       depends on failed) · stale — never a silent null;
     · runs are serialized: a run() while one is in flight re-runs once after it, never concurrently.
   Classic script (no `export`) like every shared file: ES-module tools read it as the global Organica.nodeCanvas.
   Load AFTER core.js.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var Organica = window.Organica = window.Organica || {};

  // ── Model: ONE object is the truth; outputs, order and states are derived (engine) ──
  // compute() returns an object keyed by output port name: { svg: '…' }.
  // node: { id, type, x, y, params, name?, w?, h?, collapsed? } · edge: { id, from:{node,port}, to:{node,port} }
  // frame: { id, name, x, y, w, h }
  var MODEL_VERSION = 2;
  var seq = 0;
  function nextId(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + (++seq).toString(36); }
  function createModel(src) {
    src = src || {};
    return { version: MODEL_VERSION, nodes: (src.nodes || []).slice(), edges: (src.edges || []).slice(), frames: (src.frames || []).slice() };
  }
  function findNode(model, id) { for (var i = 0; i < model.nodes.length; i++) if (model.nodes[i].id === id) return model.nodes[i]; return null; }
  function edgesInto(model, id) { return model.edges.filter(function (e) { return e.to.node === id; }); }
  function edgesOutOf(model, id) { return model.edges.filter(function (e) { return e.from.node === id; }); }
  function addNode(model, n) {
    var node = { id: n.id || nextId('n'), type: n.type, x: n.x || 0, y: n.y || 0, params: n.params || {} };
    ['name', 'w', 'h', 'collapsed'].forEach(function (k) { if (n[k] != null) node[k] = n[k]; });
    model.nodes.push(node);
    return node;
  }
  // Removes the node and ONLY its own wires — connected nodes and their settings never go with it.
  function removeNode(model, id) {
    model.nodes = model.nodes.filter(function (n) { return n.id !== id; });
    model.edges = model.edges.filter(function (e) { return e.from.node !== id && e.to.node !== id; });
  }
  // An input takes one wire (a new one replaces it) unless its port is `multi`.
  function addEdge(model, from, to, multi) {
    if (!multi) model.edges = model.edges.filter(function (e) { return !(e.to.node === to.node && e.to.port === to.port); });
    else if (model.edges.some(function (e) { return e.from.node === from.node && e.from.port === from.port && e.to.node === to.node && e.to.port === to.port; })) return null;
    var edge = { id: nextId('e'), from: { node: from.node, port: from.port }, to: { node: to.node, port: to.port } };
    model.edges.push(edge);
    return edge;
  }
  function removeEdge(model, id) { model.edges = model.edges.filter(function (e) { return e.id !== id; }); }

  // Kahn's algorithm. Throws (never hangs) on a loop.
  function CycleError(msg) { var e = new Error(msg || 'That connection would make a loop.'); e.name = 'CycleError'; return e; }
  function topoSort(model) {
    var indeg = new Map(), out = new Map();
    model.nodes.forEach(function (n) { indeg.set(n.id, 0); out.set(n.id, []); });
    model.edges.forEach(function (e) {
      if (!indeg.has(e.to.node) || !indeg.has(e.from.node)) return;
      indeg.set(e.to.node, indeg.get(e.to.node) + 1); out.get(e.from.node).push(e.to.node);
    });
    var queue = model.nodes.filter(function (n) { return indeg.get(n.id) === 0; }).map(function (n) { return n.id; });
    var order = [];
    while (queue.length) {
      var id = queue.shift(); order.push(id);
      out.get(id).forEach(function (t) { var d = indeg.get(t) - 1; indeg.set(t, d); if (d === 0) queue.push(t); });
    }
    if (order.length !== model.nodes.length) throw CycleError();
    return order;
  }
  function wouldCycle(model, from, to) {
    if (from.node === to.node) return true;
    // a path to → … → from already exists?
    var seen = new Set(), stack = [to.node];
    while (stack.length) {
      var id = stack.pop(); if (id === from.node) return true;
      if (seen.has(id)) continue; seen.add(id);
      edgesOutOf(model, id).forEach(function (e) { stack.push(e.to.node); });
    }
    return false;
  }

  // ── Registry: type id → { meta:{id,label,category,inputs,outputs,params}, compute(inputs, params, ctx) } ──
  // port: { name, type, label?, required?, multi? } · `inputs` may be a function of the node (variable ports).
  function createRegistry(types, opts) {
    opts = opts || {};
    var map = new Map();
    (types || []).forEach(function (t) { map.set(t.meta.id, t); });
    var adapters = opts.adapters || {};   // { 'from->to': fn }
    function get(id) { var t = map.get(id); if (!t) throw new Error('Unknown node type: ' + id); return t; }
    function inputsOf(node) { var t = get(node.type); return typeof t.meta.inputs === 'function' ? t.meta.inputs(node) : (t.meta.inputs || []); }
    function outputsOf(node) { var t = get(node.type); return typeof t.meta.outputs === 'function' ? t.meta.outputs(node) : (t.meta.outputs || []); }
    function defaults(id) { var p = {}; (get(id).meta.params || []).forEach(function (d) { if (d.default !== undefined) p[d.name] = JSON.parse(JSON.stringify(d.default)); }); return p; }
    function canAdapt(from, to) { return from === to || typeof adapters[from + '->' + to] === 'function'; }
    function adapt(from, to, v) { return from === to ? v : adapters[from + '->' + to](v); }
    function byCategory() { var out = {}; map.forEach(function (t) { var c = t.meta.category || 'Other'; (out[c] = out[c] || []).push(t); }); return out; }
    return { get: get, has: function (id) { return map.has(id); }, list: function () { return Array.from(map.values()); },
      inputsOf: inputsOf, outputsOf: outputsOf, defaults: defaults, canAdapt: canAdapt, adapt: adapt, byCategory: byCategory };
  }
  // Can `from` (an output) feed `to` (an input)? → { ok } or { ok:false, reason } (copy for a notice).
  function canConnect(model, registry, from, to) {
    var a = findNode(model, from.node), b = findNode(model, to.node);
    if (!a || !b) return { ok: false, reason: 'That node is gone.' };
    var op = registry.outputsOf(a).filter(function (p) { return p.name === from.port; })[0];
    var ip = registry.inputsOf(b).filter(function (p) { return p.name === to.port; })[0];
    if (!op || !ip) return { ok: false, reason: 'That port is gone.' };
    var accepts = ip.accepts || [ip.type];
    var typeOk = accepts.some(function (t) { return registry.canAdapt(op.type, t); });
    if (!typeOk) return { ok: false, reason: (op.label || op.type) + ' can’t connect to ' + (ip.label || ip.name) + '.' };
    if (wouldCycle(model, from, to)) return { ok: false, reason: 'That connection would make a loop.' };
    return { ok: true, multi: !!ip.multi, inType: accepts.filter(function (t) { return registry.canAdapt(op.type, t); })[0], outType: op.type };
  }

  // ── Engine ──
  // createEngine({ registry, isActive?(node), onState?(nodeId, entry) }) →
  //   { run(model) → Promise<{entries}>, touch(nodeId), get(nodeId) → entry, forget(nodeId), entries }
  // entry: { state:'ok'|'error'|'waiting'|'upstream'|'stale', value, error?, message?, ver }
  function createEngine(o) {
    var registry = o.registry, isActive = o.isActive || function () { return true; }, onState = o.onState || function () {};
    var entries = new Map();   // nodeId → { key, value, ver, state, message }
    var revs = new Map();      // nodeId → revision (bumped by touch: params / wiring changed)
    var running = null, queued = false;

    function rev(id) { return revs.get(id) || 0; }
    function touch(id) { revs.set(id, rev(id) + 1); }
    function forget(id) { entries.delete(id); revs.delete(id); }
    function setEntry(id, e) { entries.set(id, e); onState(id, e); }

    function needed(model, order) {   // the active nodes + everything they depend on
      var need = new Set(), byId = new Map(model.nodes.map(function (n) { return [n.id, n]; }));
      var stack = model.nodes.filter(function (n) { return isActive(n); }).map(function (n) { return n.id; });
      while (stack.length) {
        var id = stack.pop(); if (need.has(id)) continue; need.add(id);
        edgesInto(model, id).forEach(function (e) { if (byId.has(e.from.node)) stack.push(e.from.node); });
      }
      return need;
    }

    async function runOnce(model) {
      var order = topoSort(model), need = needed(model, order);
      for (var i = 0; i < order.length; i++) {
        var id = order[i], node = findNode(model, id), prev = entries.get(id);
        if (!need.has(id)) { if (prev && prev.state !== 'stale') setEntry(id, Object.assign({}, prev, { state: 'stale' })); else if (!prev) setEntry(id, { key: null, value: null, ver: 0, state: 'stale' }); continue; }
        var type = registry.get(node.type), inputs = {}, keyParts = [node.type, rev(id)], blocked = null, missing = null;
        var ins = registry.inputsOf(node);
        for (var j = 0; j < ins.length; j++) {
          var p = ins[j], wires = edgesInto(model, id).filter(function (e) { return e.to.port === p.name; });
          var vals = [];
          for (var k = 0; k < wires.length; k++) {
            var w = wires[k], up = entries.get(w.from.node), src = findNode(model, w.from.node);
            if (!up || up.state === 'error' || up.state === 'waiting' || up.state === 'upstream') { blocked = blocked || (src && (src.name || registry.get(src.type).meta.label)) || 'a node'; continue; }
            var op = registry.outputsOf(src).filter(function (q) { return q.name === w.from.port; })[0];
            var v = up.value && op && Object.prototype.hasOwnProperty.call(up.value, w.from.port) ? up.value[w.from.port] : null;
            var accepts = p.accepts || [p.type];
            var target = op && accepts.filter(function (t) { return registry.canAdapt(op.type, t); })[0];
            if (v != null && op && target && op.type !== target) v = registry.adapt(op.type, target, v);
            vals.push(v); keyParts.push(w.from.node + ':' + w.from.port + '@' + up.ver);
          }
          inputs[p.name] = p.multi ? vals : (vals.length ? vals[0] : null);
          if (p.required && !wires.length) missing = missing || (p.label || p.name);
        }
        var key = keyParts.join('|');
        if (blocked) { setEntry(id, { key: null, value: null, ver: (prev ? prev.ver : 0) + 1, state: 'upstream', message: 'Waiting on ' + blocked + ', which has an error.' }); continue; }
        if (missing) { setEntry(id, { key: null, value: null, ver: (prev ? prev.ver : 0) + 1, state: 'waiting', message: 'Connect a ' + missing + '.' }); continue; }
        if (prev && prev.key === key && (prev.state === 'ok' || prev.state === 'error')) continue;   // nothing it reads changed
        try {
          var value = await Promise.resolve(type.compute(inputs, node.params || {}, { node: node, nodeId: id }));
          setEntry(id, { key: key, value: value || {}, ver: (prev ? prev.ver : 0) + 1, state: 'ok' });
        } catch (err) {
          setEntry(id, { key: key, value: null, ver: (prev ? prev.ver : 0) + 1, state: 'error', error: err, message: err && err.message ? err.message : String(err) });
        }
      }
      // forget nodes that no longer exist
      Array.from(entries.keys()).forEach(function (id) { if (!findNode(model, id)) forget(id); });
      return { entries: entries };
    }
    // Serialized: one run at a time; a call during a run schedules ONE more run (with the latest model) after it.
    function run(model) {
      if (running) { queued = model; return running; }
      running = (async function () {
        try {
          var r = await runOnce(model);
          while (queued) { var m = queued; queued = false; r = await runOnce(m); }
          return r;
        } finally { running = null; }
      })();
      return running;
    }
    return { run: run, touch: touch, forget: forget, get: function (id) { return entries.get(id); }, entries: entries, isRunning: function () { return !!running; } };
  }

  // ── History: a snapshot stack of the model, pushed at checkpoints (add/remove, connect, drag end, commit) ──
  // push(model, meta?) — meta (e.g. the selection) comes back with undo()/redo(): { model, meta }.
  function createHistory(max) {
    max = max || 100;
    var stack = [], index = -1;
    function snap(model) { return JSON.stringify({ nodes: model.nodes, edges: model.edges, frames: model.frames || [] }); }
    function push(model, meta) {
      var s = snap(model);
      if (index >= 0 && stack[index].s === s) { stack[index].meta = meta; return; }
      stack = stack.slice(0, index + 1); stack.push({ s: s, meta: meta });
      if (stack.length > max) stack.shift();
      index = stack.length - 1;
    }
    function at(i) { var e = stack[i]; var m = JSON.parse(e.s); return { model: createModel(m), meta: e.meta }; }
    return {
      push: push,
      canUndo: function () { return index > 0; },
      canRedo: function () { return index < stack.length - 1; },
      undo: function () { if (index <= 0) return null; index--; return at(index); },
      redo: function () { if (index >= stack.length - 1) return null; index++; return at(index); },
      clear: function () { stack = []; index = -1; },
    };
  }

  Organica.nodeCanvas = {
    MODEL_VERSION: MODEL_VERSION,
    nextId: nextId, createModel: createModel, findNode: findNode, edgesInto: edgesInto, edgesOutOf: edgesOutOf,
    addNode: addNode, removeNode: removeNode, addEdge: addEdge, removeEdge: removeEdge,
    topoSort: topoSort, wouldCycle: wouldCycle,
    createRegistry: createRegistry, canConnect: canConnect,
    createEngine: createEngine, createHistory: createHistory,
  };
})();
