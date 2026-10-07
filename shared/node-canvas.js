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

  // ═══════════════════════════════════════════════════════════
  // VIEW — mount(opts) draws a model on an infinite board and edits it. Styles: shared/node-canvas.css.
  //
  // opts: {
  //   stage        the element to fill (position: relative; it gets the board, wires and marquee)
  //   registry     createRegistry(...)
  //   model        createModel(...)                                     (the controller keeps it; read ctl.model)
  //   isActive()   → bool: shortcuts and wheel only while this is true (e.g. the Figure step is on screen)
  //   renderBody(node, entry, el, ctx)   fill the card body (preview, summary) — called after every run
  //   cardClass(node) → extra class(es) for the card (size variants: 'nc-node--compact' / 'nc-node--wide')
  //   nodeLabel(node) → the card title (default: node.name || the type's label)
  //   protect(node, model) → null, or the reason this node can't be deleted (Delete then says so)
  //   onSelect(ids)             the selection changed (the tool fills its panel)
  //   onChange(model, reason)   anything changed (structure, positions, params) — the tool saves / marks dirty
  //   onWireDrop(from, point)   a wire released on empty board (open the node search there)
  //   onPortDblClick(node, port, dir)   a port double-clicked (spawn the node it wants, wired)
  //   onNodeDblClick(node, e)   a card double-clicked (outside its ports)
  //   onBoardDblClick(point)    the empty board double-clicked
  //   announce(text)            a polite live-region message (default: a hidden region in the stage)
  //   engine                    createEngine(...) — default: one made here, isActive = the card is on screen
  //   history                   createHistory() — default: one made here
  //   fitInset                  { left, bottom } px of the stage covered by chrome (a left dock, a floatbar) — Fit avoids them
  // }
  // → ctl: { model, engine, history, zoomPan, select(ids), selection(), add(type, at, params), connect(from, to),
  //          remove(ids), duplicate(ids), setModel(model, meta), refresh(), run(), fitAll(), fitSelection(),
  //          toBoard(clientX, clientY), commit(reason), undo(), redo(), destroy() }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, cls, attrs) { var e = document.createElement(tag); if (cls) e.className = cls; if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function wirePath(x1, y1, x2, y2) { var dx = Math.max(40, Math.abs(x2 - x1) * 0.5); return 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2; }

  function mount(o) {
    var NC = Organica.nodeCanvas, registry = o.registry, stage = o.stage;
    var isActive = o.isActive || function () { return true; };
    var ctl = { model: o.model || createModel() };
    var cards = new Map();      // nodeId → { el, body, ports: Map('in:name'|'out:name' → {el, x, y}), w, h }
    var selected = new Set(), selectedWire = null, clipboard = null, visible = new Set();
    var history = o.history || createHistory();

    // ── DOM ──
    stage.classList.add('nc-stage');
    stage.setAttribute('role', 'application');
    stage.setAttribute('aria-roledescription', 'node graph');
    stage.setAttribute('aria-keyshortcuts', '/');
    var board = el('div', 'nc-board');
    var wires = document.createElementNS(SVGNS, 'svg'); wires.setAttribute('class', 'nc-wires'); wires.setAttribute('aria-hidden', 'true');
    var wireG = document.createElementNS(SVGNS, 'g'); wires.appendChild(wireG);
    var pending = document.createElementNS(SVGNS, 'path'); pending.setAttribute('class', 'nc-wire nc-wire--pending'); pending.style.display = 'none'; wires.appendChild(pending);
    var nodesLayer = el('div', 'nc-nodes');
    board.append(wires, nodesLayer);
    var marquee = el('div', 'nc-marquee'); marquee.hidden = true;
    var live = el('div', 'nc-live', { 'aria-live': 'polite' });
    stage.append(board, marquee, live);
    var announce = o.announce || function (t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); };

    // ── pan / zoom: wheel zooms, Space-drag / middle-drag pans, plain drag on the board = marquee ──
    var spaceDown = false;
    var zoomPan = Organica.createZoomPan({ canvas: board, wrap: stage, min: 0.1, max: 4, panAlways: true, infinite: true, dblclickReset: false,
      isReady: function () { return isActive(); },
      panStart: function (e) { return e.button === 1 || (e.button === 0 && spaceDown); },
      onChange: function (v) { stage.style.setProperty('--nc-zoom', v.zoom); stage.classList.toggle('nc-stage--far', v.zoom < 0.35); scheduleVisibility(); } });
    ctl.zoomPan = zoomPan;
    function toBoard(cx, cy) { var r = stage.getBoundingClientRect(); return { x: (cx - r.left - zoomPan.pan.x) / zoomPan.zoom, y: (cy - r.top - zoomPan.pan.y) / zoomPan.zoom }; }
    ctl.toBoard = toBoard;

    // ── engine: only cards on screen (and what they need) compute ──
    var engine = o.engine || createEngine({ registry: registry, isActive: function (n) { return visible.has(n.id); } });
    ctl.engine = engine; ctl.history = history;
    var runQueued = false;
    function run() {
      if (runQueued) return; runQueued = true;
      requestAnimationFrame(function () {
        runQueued = false;
        engine.run(ctl.model).then(function () { cards.forEach(function (c, id) { paintState(id); }); }, function (err) { announce(err.message); });
      });
    }
    ctl.run = run;
    function paintState(id) {
      var c = cards.get(id), node = findNode(ctl.model, id); if (!c || !node) return;
      var e = engine.get(id) || { state: 'stale' };
      c.el.dataset.state = e.state;
      c.status.textContent = e.state === 'ok' || e.state === 'stale' ? '' : (e.message || '');
      c.status.hidden = !c.status.textContent;
      if (o.renderBody) o.renderBody(node, e, c.body, ctl);
      measure(id); drawWires();
    }

    // visibility (IntersectionObserver on the stage) → which cards compute
    var io = new IntersectionObserver(function (list) {
      var changed = false;
      list.forEach(function (it) { var id = it.target.dataset.nodeId; var was = visible.has(id); if (it.isIntersecting) visible.add(id); else visible.delete(id); if (was !== visible.has(id)) changed = true; });
      if (changed) run();
    }, { root: stage, rootMargin: '25%' });
    var visTimer = 0;
    function scheduleVisibility() { clearTimeout(visTimer); visTimer = setTimeout(function () { cards.forEach(function (c) { io.unobserve(c.el); io.observe(c.el); }); }, 120); }

    // ── cards ──
    function label(node) { return o.nodeLabel ? o.nodeLabel(node) : (node.name || registry.get(node.type).meta.label || node.type); }
    function portRow(node, p, dir) {
      var row = el('div', 'nc-port nc-port--' + dir);
      var b = el('button', 'nc-port__dot', { type: 'button', 'aria-label': (p.label || p.name) + ' — connect', 'data-port': p.name, 'data-dir': dir, 'data-type': p.type });
      if (p.multi) b.classList.add('nc-port__dot--multi');
      var t = el('span', 'nc-port__label'); t.textContent = p.label || p.name;
      if (dir === 'in') row.append(b, t); else row.append(t, b);
      return { row: row, dot: b };
    }
    function buildCard(node) {
      var c = { ports: new Map() };
      var card = el('div', 'nc-node' + (o.cardClass ? ' ' + (o.cardClass(node) || '') : ''), { role: 'group', tabindex: '0', 'data-node-id': node.id });
      card.setAttribute('aria-label', label(node));
      var head = el('div', 'nc-node__head'); var title = el('span', 'nc-node__title'); title.textContent = label(node); head.appendChild(title);
      var ins = el('div', 'nc-node__ports nc-node__ports--in'), outs = el('div', 'nc-node__ports nc-node__ports--out');
      registry.inputsOf(node).forEach(function (p) { var r = portRow(node, p, 'in'); ins.appendChild(r.row); c.ports.set('in:' + p.name, { el: r.dot }); });
      registry.outputsOf(node).forEach(function (p) { var r = portRow(node, p, 'out'); outs.appendChild(r.row); c.ports.set('out:' + p.name, { el: r.dot }); });
      var body = el('div', 'nc-node__body');
      var status = el('p', 'nc-node__status', { role: 'status' }); status.hidden = true;
      var portsWrap = el('div', 'nc-node__io'); portsWrap.append(ins, outs);
      card.append(head, portsWrap, body, status);
      Object.assign(c, { el: card, head: head, title: title, body: body, status: status });
      place(card, node);
      bindCard(card, node.id);
      return c;
    }
    function place(card, node) { card.style.transform = 'translate(' + node.x + 'px,' + node.y + 'px)'; if (node.w) card.style.width = node.w + 'px'; }
    function measure(id) {   // port centres in board units — layout offsets, not screen rects (no per-wire getBoundingClientRect)
      var c = cards.get(id), node = findNode(ctl.model, id); if (!c || !node) return;
      c.ports.forEach(function (p) {
        var x = 0, y = 0, e = p.el;
        while (e && e !== c.el) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
        p.x = x + p.el.offsetWidth / 2; p.y = y + p.el.offsetHeight / 2;
      });
      c.w = c.el.offsetWidth; c.h = c.el.offsetHeight;
    }
    function portXY(ref, dir) {
      var node = findNode(ctl.model, ref.node), c = cards.get(ref.node); if (!node || !c) return null;
      var p = c.ports.get(dir + ':' + ref.port); if (!p) return null;
      return { x: node.x + p.x, y: node.y + p.y };
    }
    function drawWires() {
      while (wireG.firstChild) wireG.removeChild(wireG.firstChild);
      ctl.model.edges.forEach(function (e) {
        var a = portXY(e.from, 'out'), b = portXY(e.to, 'in'); if (!a || !b) return;
        var src = findNode(ctl.model, e.from.node), op = src && registry.outputsOf(src).filter(function (q) { return q.name === e.from.port; })[0];
        var d = wirePath(a.x, a.y, b.x, b.y);
        var hit = document.createElementNS(SVGNS, 'path'); hit.setAttribute('class', 'nc-wire-hit'); hit.setAttribute('d', d); hit.dataset.edge = e.id;
        var path = document.createElementNS(SVGNS, 'path'); path.setAttribute('d', d); path.dataset.edge = e.id;
        var cls = 'nc-wire'; if (op) cls += ' nc-wire--' + op.type;
        if (o.wireClass) cls += ' ' + (o.wireClass(e, ctl.model) || '');
        if (selected.has(e.from.node) || selected.has(e.to.node)) cls += ' is-related';
        if (selectedWire === e.id) cls += ' is-selected';
        path.setAttribute('class', cls);
        wireG.append(hit, path);
      });
    }
    function render() {   // full rebuild — after setModel / undo / a structural change
      var keep = new Set(ctl.model.nodes.map(function (n) { return n.id; }));
      cards.forEach(function (c, id) { if (!keep.has(id)) { io.unobserve(c.el); c.el.remove(); cards.delete(id); visible.delete(id); } });
      ctl.model.nodes.forEach(function (n) {
        var c = cards.get(n.id);
        if (!c) { c = buildCard(n); cards.set(n.id, c); nodesLayer.appendChild(c.el); io.observe(c.el); }
        else { place(c.el, n); c.title.textContent = label(n); c.el.setAttribute('aria-label', label(n)); }
        c.el.classList.toggle('is-selected', selected.has(n.id));
        c.el.classList.toggle('is-collapsed', !!n.collapsed);
      });
      Array.from(selected).forEach(function (id) { if (!keep.has(id)) selected.delete(id); });
      cards.forEach(function (c, id) { measure(id); });
      drawWires();
    }
    ctl.refresh = function () { render(); run(); };

    // ── changes ──
    function changed(reason, structural) {
      if (structural) render(); else drawWires();
      if (o.onChange) o.onChange(ctl.model, reason);
    }
    function commit(reason) { history.push(ctl.model, { selection: Array.from(selected) }); if (o.onChange) o.onChange(ctl.model, reason || 'commit'); }
    ctl.commit = commit;
    function touchDown(id) {   // a node's params/wiring changed: bump it; the engine recomputes it and what follows
      engine.touch(id); run();
    }
    ctl.touch = touchDown;

    // ── selection ──
    function select(ids, opt) {
      opt = opt || {};
      if (!opt.add) selected.clear();
      ids.forEach(function (id) { if (opt.toggle && selected.has(id)) selected.delete(id); else selected.add(id); });
      selectedWire = null;
      cards.forEach(function (c, id) { c.el.classList.toggle('is-selected', selected.has(id)); });
      drawWires();
      if (o.onSelect) o.onSelect(Array.from(selected));
    }
    ctl.select = function (ids) { select(ids || []); };
    ctl.selection = function () { return Array.from(selected); };

    // ── node drag (pointer capture on the card: no window listeners left behind) ──
    function bindCard(card, id) {
      card.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || spaceDown || e.target.closest('.nc-port__dot, button, input, select, textarea, a')) return;
        var node = findNode(ctl.model, id); if (!node) return;
        if (!selected.has(id)) select([id], { add: e.shiftKey || e.metaKey || e.ctrlKey });
        else if (e.metaKey || e.ctrlKey) { select([id], { add: true, toggle: true }); return; }
        var start = toBoard(e.clientX, e.clientY), moved = false;
        var group = Array.from(selected).map(function (sid) { var n = findNode(ctl.model, sid); return n && { n: n, x: n.x, y: n.y }; }).filter(Boolean);
        try { card.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic or ended pointer */ }
        function move(ev) {
          var p = toBoard(ev.clientX, ev.clientY), dx = p.x - start.x, dy = p.y - start.y;
          if (!moved && Math.hypot(dx, dy) * zoomPan.zoom < 3) return;
          if (!moved) { moved = true; stage.classList.add('nc-stage--dragging'); group.forEach(function (g) { var c = cards.get(g.n.id); if (c) c.el.classList.add('is-lifted'); }); }
          group.forEach(function (g) { g.n.x = Math.round(g.x + dx); g.n.y = Math.round(g.y + dy); var c = cards.get(g.n.id); if (c) place(c.el, g.n); });
          drawWires();
        }
        function up() {
          card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up);
          stage.classList.remove('nc-stage--dragging');
          group.forEach(function (g) { var c = cards.get(g.n.id); if (c) c.el.classList.remove('is-lifted'); });
          if (moved) { changed('move'); commit('move'); }
        }
        card.addEventListener('pointermove', move); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
      });
      card.addEventListener('dblclick', function (e) {
        if (e.target.closest('.nc-port__dot')) return;
        var node = findNode(ctl.model, id); if (node && o.onNodeDblClick) o.onNodeDblClick(node, e);
      });
      card.addEventListener('focus', function () { if (!selected.has(id)) select([id]); });
    }

    // ── wiring: drag from any port; compatible ports glow, others dim; release on a port / a card / the board ──
    function portInfo(dot) { var card = dot.closest('.nc-node'); return { node: card.dataset.nodeId, port: dot.dataset.port, dir: dot.dataset.dir }; }
    function startWire(e, dot) {
      var info = portInfo(dot), from, fixedDir;
      if (info.dir === 'in') {
        var existing = ctl.model.edges.filter(function (w) { return w.to.node === info.node && w.to.port === info.port; });
        var node = findNode(ctl.model, info.node), ip = registry.inputsOf(node).filter(function (p) { return p.name === info.port; })[0];
        if (existing.length && !(ip && ip.multi)) {   // drag a connected input off: detach it and carry its source
          var w = existing[existing.length - 1]; removeEdge(ctl.model, w.id); touchDown(info.node);
          from = { node: w.from.node, port: w.from.port, dir: 'out' };
        } else from = info;
      } else from = info;
      fixedDir = from.dir;
      var anchor = portXY(from, from.dir);
      stage.classList.add('nc-stage--wiring');
      // mark every port compatible / not
      cards.forEach(function (c, nid) {
        c.ports.forEach(function (p, key) {
          var dir = key.slice(0, key.indexOf(':')), name = key.slice(key.indexOf(':') + 1);
          var okc = dir !== fixedDir && (fixedDir === 'out'
            ? canConnect(ctl.model, registry, { node: from.node, port: from.port }, { node: nid, port: name }).ok
            : canConnect(ctl.model, registry, { node: nid, port: name }, { node: from.node, port: from.port }).ok);
          p.el.classList.toggle('is-compatible', okc); p.el.classList.toggle('is-incompatible', !okc);
        });
      });
      pending.style.display = '';
      function move(ev) { var p = toBoard(ev.clientX, ev.clientY); pending.setAttribute('d', fixedDir === 'out' ? wirePath(anchor.x, anchor.y, p.x, p.y) : wirePath(p.x, p.y, anchor.x, anchor.y)); }
      move(e);
      function up(ev) {
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
        pending.style.display = 'none'; stage.classList.remove('nc-stage--wiring');
        cards.forEach(function (c) { c.ports.forEach(function (p) { p.el.classList.remove('is-compatible', 'is-incompatible'); }); });
        var target = document.elementFromPoint(ev.clientX, ev.clientY);
        var tdot = target && target.closest && target.closest('.nc-port__dot');
        var tcard = target && target.closest && target.closest('.nc-node');
        if (tdot && stage.contains(tdot)) {
          var t = portInfo(tdot); if (t.dir === fixedDir) return changed('wire');
          var a = fixedDir === 'out' ? from : t, b = fixedDir === 'out' ? t : from;
          tryConnect({ node: a.node, port: a.port }, { node: b.node, port: b.port });
        } else if (tcard && stage.contains(tcard) && tcard.dataset.nodeId !== from.node && fixedDir === 'out') {
          // Weave: a wire dropped on a card goes to its first compatible input
          var tn = findNode(ctl.model, tcard.dataset.nodeId), hit = null;
          registry.inputsOf(tn).some(function (p) {
            var free = p.multi || !ctl.model.edges.some(function (w) { return w.to.node === tn.id && w.to.port === p.name; });
            if (free && canConnect(ctl.model, registry, { node: from.node, port: from.port }, { node: tn.id, port: p.name }).ok) { hit = p; return true; }
            return false;
          });
          if (hit) tryConnect({ node: from.node, port: from.port }, { node: tn.id, port: hit.name });
          else announce('No free input on ' + label(tn) + ' takes this.');
        } else if (!tcard && o.onWireDrop) {
          o.onWireDrop({ node: from.node, port: from.port, dir: fixedDir }, toBoard(ev.clientX, ev.clientY));
          changed('wire', false);
        } else changed('wire');
      }
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    }
    function tryConnect(from, to) {
      var r = canConnect(ctl.model, registry, from, to);
      if (!r.ok) { if (Organica.notice) Organica.notice(r.reason); else announce(r.reason); changed('wire'); return null; }
      var edge = addEdge(ctl.model, from, to, r.multi);
      touchDown(to.node);
      var a = findNode(ctl.model, from.node), b = findNode(ctl.model, to.node);
      announce('Connected ' + label(a) + ' to ' + label(b));
      changed('connect'); commit('connect');
      return edge;
    }
    ctl.connect = tryConnect;
    // multi-connect (Weave): with several nodes selected, a wire from one of them connects them all
    stage.addEventListener('pointerdown', function (e) {
      var dot = e.target.closest && e.target.closest('.nc-port__dot');
      if (dot && e.button === 0 && !spaceDown) { e.preventDefault(); e.stopPropagation(); startWire(e, dot); }
    }, true);
    stage.addEventListener('dblclick', function (e) {
      var dot = e.target.closest && e.target.closest('.nc-port__dot');
      if (dot && o.onPortDblClick) { var i = portInfo(dot); o.onPortDblClick(findNode(ctl.model, i.node), i.port, i.dir); return; }
      if (!e.target.closest('.nc-node') && o.onBoardDblClick) o.onBoardDblClick(toBoard(e.clientX, e.clientY));
    });
    // wire selection
    wires.addEventListener('pointerdown', function (e) {
      var id = e.target.dataset && e.target.dataset.edge; if (!id) return;
      e.stopPropagation(); selected.clear(); cards.forEach(function (c) { c.el.classList.remove('is-selected'); });
      selectedWire = id; drawWires(); if (o.onSelect) o.onSelect([]);
    });

    // ── marquee: plain drag on the empty board ──
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || spaceDown || e.target.closest('.nc-node') || (e.target.dataset && e.target.dataset.edge)) return;
      if (!isActive()) return;
      var r0 = stage.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, add = e.shiftKey || e.metaKey || e.ctrlKey, base = add ? new Set(selected) : new Set();
      var dragged = false;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic or ended pointer */ }
      function move(ev) {
        var x = Math.min(sx, ev.clientX), y = Math.min(sy, ev.clientY), w = Math.abs(ev.clientX - sx), h = Math.abs(ev.clientY - sy);
        if (!dragged && w + h < 4) return; dragged = true;
        marquee.hidden = false; marquee.style.transform = 'translate(' + (x - r0.left) + 'px,' + (y - r0.top) + 'px)'; marquee.style.width = w + 'px'; marquee.style.height = h + 'px';
        var a = toBoard(x, y), b = toBoard(x + w, y + h), pick = new Set(base);
        ctl.model.nodes.forEach(function (n) { var c = cards.get(n.id); if (!c) return; if (n.x < b.x && n.x + c.w > a.x && n.y < b.y && n.y + c.h > a.y) pick.add(n.id); });
        selected = pick; cards.forEach(function (c, id) { c.el.classList.toggle('is-selected', selected.has(id)); });
      }
      function up() {
        stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerup', up); stage.removeEventListener('pointercancel', up);
        marquee.hidden = true;
        if (!dragged) { selected.clear(); selectedWire = null; cards.forEach(function (c) { c.el.classList.remove('is-selected'); }); }
        drawWires(); if (o.onSelect) o.onSelect(Array.from(selected));
      }
      stage.addEventListener('pointermove', move); stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    });

    // ── add / remove / duplicate / paste ──
    ctl.add = function (type, at, params, extra) {
      var p = Object.assign(registry.defaults(type), params || {});
      var node = addNode(ctl.model, Object.assign({ type: type, x: Math.round(at.x), y: Math.round(at.y), params: p }, extra || {}));
      render(); select([node.id]); touchDown(node.id);
      announce(label(node) + ' added');
      changed('add'); commit('add');
      return node;
    };
    function remove(ids) {
      var gone = [], kept = [];
      ids.forEach(function (id) {
        var n = findNode(ctl.model, id); if (!n) return;
        var why = o.protect ? o.protect(n, ctl.model) : null;
        if (why) kept.push(why); else gone.push(n);
      });
      if (selectedWire && !ids.length) {
        var w = ctl.model.edges.filter(function (x) { return x.id === selectedWire; })[0];
        if (w) { removeEdge(ctl.model, w.id); touchDown(w.to.node); selectedWire = null; changed('disconnect', true); commit('disconnect'); }
        return;
      }
      if (kept.length && Organica.notice) Organica.notice(kept[0]);
      if (!gone.length) return;
      var downstream = new Set();
      gone.forEach(function (n) { edgesOutOf(ctl.model, n.id).forEach(function (e) { downstream.add(e.to.node); }); removeNode(ctl.model, n.id); engine.forget(n.id); selected.delete(n.id); });
      downstream.forEach(function (id) { if (findNode(ctl.model, id)) engine.touch(id); });
      announce(gone.length === 1 ? label(gone[0]) + ' deleted' : gone.length + ' nodes deleted');
      changed('remove', true); commit('remove'); run();
      if (o.onSelect) o.onSelect(Array.from(selected));
    }
    ctl.remove = function (ids) { remove(ids || Array.from(selected)); };
    // Duplicate copies the nodes and their wires among themselves, and re-wires their inputs to the SAME shared
    // nodes outside the copy (ledger B3: a node can feed many figures).
    function cloneNodes(ids, dx, dy, rewireOutside) {
      var map = new Map(), src = ids.map(function (id) { return findNode(ctl.model, id); }).filter(Boolean);
      src.forEach(function (n) { var c = addNode(ctl.model, JSON.parse(JSON.stringify(Object.assign({}, n, { id: null, x: n.x + dx, y: n.y + dy })))); map.set(n.id, c.id); });
      ctl.model.edges.slice().forEach(function (e) {
        if (!map.has(e.to.node)) return;
        var from = map.has(e.from.node) ? { node: map.get(e.from.node), port: e.from.port } : (rewireOutside ? e.from : null);
        if (from) addEdge(ctl.model, from, { node: map.get(e.to.node), port: e.to.port }, true);
      });
      return Array.from(map.values());
    }
    ctl.duplicate = function (ids) {
      ids = ids || Array.from(selected); if (!ids.length) return [];
      var made = cloneNodes(ids, 40, 40, true);
      render(); select(made); made.forEach(touchDown);
      announce(made.length === 1 ? 'Duplicated' : made.length + ' nodes duplicated');
      changed('duplicate', true); commit('duplicate');
      return made;
    };
    function copy() {
      var ids = Array.from(selected); if (!ids.length) return;
      var set = new Set(ids);
      clipboard = { nodes: ids.map(function (id) { return JSON.parse(JSON.stringify(findNode(ctl.model, id))); }),
        edges: ctl.model.edges.filter(function (e) { return set.has(e.from.node) && set.has(e.to.node); }).map(function (e) { return JSON.parse(JSON.stringify(e)); }) };
      announce(ids.length === 1 ? 'Copied' : ids.length + ' nodes copied');
    }
    function paste() {
      if (!clipboard) return;
      var map = new Map(), made = [];
      clipboard.nodes.forEach(function (n) { var c = addNode(ctl.model, Object.assign({}, JSON.parse(JSON.stringify(n)), { id: null, x: n.x + 60, y: n.y + 60 })); map.set(n.id, c.id); made.push(c.id); });
      clipboard.edges.forEach(function (e) { addEdge(ctl.model, { node: map.get(e.from.node), port: e.from.port }, { node: map.get(e.to.node), port: e.to.port }, true); });
      clipboard = { nodes: clipboard.nodes.map(function (n) { return Object.assign({}, n, { x: n.x + 60, y: n.y + 60 }); }), edges: clipboard.edges };
      render(); select(made); made.forEach(touchDown); changed('paste', true); commit('paste');
    }

    // ── view: fit all / fit selection ──
    function fit(ids) {
      var ns = ids.map(function (id) { return findNode(ctl.model, id); }).filter(Boolean); if (!ns.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      ns.forEach(function (n) { var c = cards.get(n.id), w = c ? c.w : 200, h = c ? c.h : 120; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h); });
      var r = stage.getBoundingClientRect(), pad = 48, inset = o.fitInset || {}, L = inset.left || 0, B = inset.bottom || 0;
      var W = r.width - L, H = r.height - B;
      var z = Math.min(1.5, Math.max(0.1, Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0))));
      zoomPan.setView({ zoom: z, panX: L + (W - (x1 - x0) * z) / 2 - x0 * z, panY: (H - (y1 - y0) * z) / 2 - y0 * z });
    }
    ctl.fitAll = function () { fit(ctl.model.nodes.map(function (n) { return n.id; })); };
    ctl.fitSelection = function () { var s = Array.from(selected); fit(s.length ? s : ctl.model.nodes.map(function (n) { return n.id; })); };

    // ── undo / redo (the graph's own stack — active only while isActive()) ──
    function restore(snap) {
      if (!snap) return;
      ctl.model = snap.model;
      ctl.model.nodes.forEach(function (n) { engine.touch(n.id); });
      selected = new Set((snap.meta && snap.meta.selection) || []);
      render(); run();
      if (o.onSelect) o.onSelect(Array.from(selected));
      if (o.onChange) o.onChange(ctl.model, 'history');
    }
    ctl.undo = function () { restore(history.undo()); };
    ctl.redo = function () { restore(history.redo()); };
    ctl.setModel = function (m, meta) {
      ctl.model = m; selected = new Set((meta && meta.selection) || []);
      m.nodes.forEach(function (n) { engine.touch(n.id); });
      render(); run(); history.clear(); history.push(ctl.model, { selection: Array.from(selected) });
      if (o.onSelect) o.onSelect(Array.from(selected));
    };

    // ── keyboard (only while the board is active and focus is not in a field) ──
    function typing(t) { return !!(t && t.closest && t.closest('input, select, textarea, [contenteditable=""], [contenteditable="true"]')); }
    function onKey(e) {
      if (!isActive() || typing(e.target)) return;
      var mod = e.metaKey || e.ctrlKey, k = e.key;
      if (e.code === 'Space' && !e.repeat && !e.target.closest('button')) { spaceDown = true; stage.classList.add('nc-stage--pan'); e.preventDefault(); return; }
      var inStage = stage.contains(e.target) || e.target === document.body;
      if (mod && !e.shiftKey && k.toLowerCase() === 'z') { e.preventDefault(); ctl.undo(); return; }
      if (mod && (k.toLowerCase() === 'y' || (e.shiftKey && k.toLowerCase() === 'z'))) { e.preventDefault(); ctl.redo(); return; }
      if (e.shiftKey && !mod && (e.code === 'Digit1' || k === '!')) { e.preventDefault(); ctl.fitAll(); return; }
      if (e.shiftKey && !mod && (e.code === 'Digit2' || k === '@')) { e.preventDefault(); ctl.fitSelection(); return; }
      if (!inStage) return;
      if (mod && k.toLowerCase() === 'a') { e.preventDefault(); select(ctl.model.nodes.map(function (n) { return n.id; })); return; }
      if (mod && k.toLowerCase() === 'd') { e.preventDefault(); ctl.duplicate(); return; }
      if (mod && k.toLowerCase() === 'c') { copy(); return; }
      if (mod && k.toLowerCase() === 'v') { e.preventDefault(); paste(); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); remove(Array.from(selected)); return; }
      if (k === 'Escape') { select([]); return; }
      if (k === '/' && o.onSearch) { e.preventDefault(); var r = stage.getBoundingClientRect(); o.onSearch(toBoard(r.left + r.width / 2, r.top + r.height / 2)); return; }
      if (/^Arrow/.test(k) && selected.size) {
        e.preventDefault(); var step = e.shiftKey ? 32 : 8, dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        selected.forEach(function (id) { var n = findNode(ctl.model, id); if (n) { n.x += dx; n.y += dy; var c = cards.get(id); if (c) place(c.el, n); } });
        drawWires(); changed('move'); clearTimeout(ctl._nudge); ctl._nudge = setTimeout(function () { commit('move'); }, 400);
      }
    }
    function onKeyUp(e) { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('nc-stage--pan'); } }
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onKeyUp);

    ctl.destroy = function () {
      document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onKeyUp);
      io.disconnect(); stage.replaceChildren(); stage.classList.remove('nc-stage');
    };
    ctl.cardOf = function (id) { var c = cards.get(id); return c ? c.el : null; };
    ctl.paint = function (id) { paintState(id); };

    render();
    history.push(ctl.model, { selection: [] });
    run();
    return ctl;
  }

  Organica.nodeCanvas = {
    MODEL_VERSION: MODEL_VERSION,
    nextId: nextId, createModel: createModel, findNode: findNode, edgesInto: edgesInto, edgesOutOf: edgesOutOf,
    addNode: addNode, removeNode: removeNode, addEdge: addEdge, removeEdge: removeEdge,
    topoSort: topoSort, wouldCycle: wouldCycle,
    createRegistry: createRegistry, canConnect: canConnect,
    createEngine: createEngine, createHistory: createHistory,
    mount: mount, wirePath: wirePath,
  };
})();
