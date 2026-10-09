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
  function CycleError(msg) { var e = new Error(msg || 'That connection would make a loop'); e.name = 'CycleError'; return e; }
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
    if (!a || !b) return { ok: false, reason: 'That node is gone' };
    var op = registry.outputsOf(a).filter(function (p) { return p.name === from.port; })[0];
    var ip = registry.inputsOf(b).filter(function (p) { return p.name === to.port; })[0];
    if (!op || !ip) return { ok: false, reason: 'That port is gone' };
    var accepts = ip.accepts || [ip.type];
    var typeOk = accepts.some(function (t) { return registry.canAdapt(op.type, t); });
    if (!typeOk) return { ok: false, reason: (op.label || op.type) + ' can’t connect to ' + (ip.label || ip.name) };   // one clause, no stop (UI-COPY)
    if (wouldCycle(model, from, to)) return { ok: false, reason: 'That connection would make a loop' };
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
        if (!need.has(id)) { if (prev && prev.state !== 'stale') setEntry(id, Object.assign({}, prev, { state: 'stale', was: prev.state })); else if (!prev) setEntry(id, { key: null, value: null, ver: 0, state: 'stale' }); continue; }
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
        if (blocked) { setEntry(id, { key: null, value: null, ver: (prev ? prev.ver : 0) + 1, state: 'upstream', message: 'Waiting for ' + blocked + ' — fix it first' }); continue; }
        if (missing) { setEntry(id, { key: null, value: null, ver: (prev ? prev.ver : 0) + 1, state: 'waiting', message: 'Connect a ' + missing + ' input' }); continue; }
        if (prev && prev.key === key && (prev.state === 'ok' || prev.state === 'error')) continue;   // nothing it reads changed
        if (prev && prev.key === key && prev.state === 'stale' && (prev.was === 'ok' || prev.was === 'error')) { setEntry(id, Object.assign({}, prev, { state: prev.was, was: undefined })); continue; }   // back on screen, nothing changed: same value, same version
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
    function amend(model, meta) { if (index < 0) return push(model, meta); stack[index] = { s: snap(model), meta: meta }; }
    function push(model, meta) {
      var s = snap(model);
      if (index >= 0 && stack[index].s === s) { stack[index].meta = meta; return; }
      stack = stack.slice(0, index + 1); stack.push({ s: s, meta: meta });
      if (stack.length > max) stack.shift();
      index = stack.length - 1;
    }
    function at(i) { var e = stack[i]; var m = JSON.parse(e.s); return { model: createModel(m), meta: e.meta }; }
    return {
      push: push, amend: amend,
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
  //   protect(node, model, ids) → null, or the reason this node can't be deleted (Delete then says so); ids = everything deleted together
  //   onSelect(ids)             the selection changed (the tool fills its panel)
  //   onChange(model, reason)   anything changed (structure, positions, params) — the tool saves / marks dirty
  //   onWireDrop(from, point, client)   a wire released on empty board (open the node search there)
  //   onSearch(point, from, client)     '/' or right-click on the board: open the node search
  //   nameCopy(node, model) → name      the name a duplicated / pasted node gets
  //   onPortDblClick(node, port, dir)   a port double-clicked, or Enter / Space on a focused port (ports are then in the tab order)
  //   wireLabel(edge, model) → '' or a short text drawn on the wire's midpoint (a list's size)
  //   onNodeDblClick(node, e)   a card double-clicked (outside its ports), or Enter on a focused card
  //   onBoardDblClick(point)    the empty board double-clicked
  //   announce(text)            a polite live-region message (default: a hidden region in the stage)
  //   engine                    createEngine(...) — default: one made here, isActive = the card is on screen
  //   history                   createHistory() — default: one made here
  //   fitInset                  { left, bottom } px of the stage covered by chrome (a left dock, a floatbar) — Fit avoids them
  //   keepActive(node) → bool   compute this node even off screen (the host shows its output elsewhere)
  //   keyScope(target) → bool   focus on this element still counts as the board for its shortcuts (the host's floatbar…)
  // }
  // → ctl: { model, engine, history, zoomPan, select(ids), selection(), add(type, at, params), connect(from, to),
  //          remove(ids), duplicate(ids), setModel(model, meta), refresh(), run(), fitAll(), fitSelection(), fitTo(ids),
  //          toBoard(clientX, clientY), commit(reason), undo(), redo(), destroy(),
  //          addSection(ids?, name?) (⌘G: around the selection), selectedSection(), pulse(ids) }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, cls, attrs) { var e = document.createElement(tag); if (cls) e.className = cls; if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function wirePath(x1, y1, x2, y2) { var dx = Math.max(40, Math.abs(x2 - x1) * 0.5); return 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2; }

  function mount(o) {
    var NC = Organica.nodeCanvas, registry = o.registry, stage = o.stage;
    var isActive = o.isActive || function () { return true; };
    var ctl = { model: o.model || createModel() };
    var cards = new Map();      // nodeId → { el, body, ports: Map('in:name'|'out:name' → {el, x, y}), w, h }
    var selected = new Set(), selectedWire = null, clipboard = null, visible = new Set(), hovered = null;
    var history = o.history || createHistory();

    // ── DOM ──
    stage.classList.add('nc-stage');
    stage.setAttribute('role', 'application');
    stage.setAttribute('aria-roledescription', 'node graph');
    if (o.onSearch) stage.setAttribute('aria-keyshortcuts', '/');
    var board = el('div', 'nc-board');
    var wires = document.createElementNS(SVGNS, 'svg'); wires.setAttribute('class', 'nc-wires'); wires.setAttribute('aria-hidden', 'true');
    var wireG = document.createElementNS(SVGNS, 'g'); wires.appendChild(wireG);
    var pending = document.createElementNS(SVGNS, 'path'); pending.setAttribute('class', 'nc-wire nc-wire--pending'); pending.style.display = 'none'; wires.appendChild(pending);
    var nodesLayer = el('div', 'nc-nodes'), framesLayer = el('div', 'nc-frames');
    board.append(wires, nodesLayer, framesLayer);
    var selectedFrame = null;
    var marquee = el('div', 'nc-marquee'); marquee.hidden = true;
    var live = el('div', 'nc-live', { 'aria-live': 'polite' });
    stage.append(board, marquee, live);
    stage.addEventListener('scroll', function () { stage.scrollTop = 0; stage.scrollLeft = 0; });
    var announce = o.announce || function (t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); };

    // ── pan / zoom: wheel zooms, Space-drag / middle-drag pans, plain drag on the board = marquee ──
    var spaceDown = false, movingT = 0;
    var zoomPan = Organica.createZoomPan({ canvas: board, wrap: stage, min: 0.1, max: 4, panAlways: true, infinite: true, dblclickReset: false,
      isReady: function () { return isActive(); },
      panStart: function (e) { return e.button === 1 || (e.button === 0 && spaceDown); },
      onChange: function (v) {
        stage.style.setProperty('--nc-zoom', v.zoom);
        stage.classList.add('nc-stage--moving'); clearTimeout(movingT); movingT = setTimeout(function () { stage.classList.remove('nc-stage--moving'); }, 150);   // no hover lift while the board moves (wheel, middle-drag)
        var far = v.zoom < 0.5, was = stage.classList.contains('nc-stage--far');
        stage.classList.toggle('nc-stage--far', far);
        if (was !== far && cards) { cards.forEach(function (c, id) { measure(id); }); drawWires(); }
        scheduleVisibility();
      } });
    ctl.zoomPan = zoomPan;
    function toBoard(cx, cy) { var r = stage.getBoundingClientRect(); return { x: (cx - r.left - zoomPan.pan.x) / zoomPan.zoom, y: (cy - r.top - zoomPan.pan.y) / zoomPan.zoom }; }
    ctl.toBoard = toBoard;

    // ── engine: only cards on screen (and what they need) compute ──
    var engine = o.engine || createEngine({ registry: registry, isActive: function (n) { return visible.has(n.id) || !!(o.keepActive && o.keepActive(n)); } });
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
    function paintState(id, force) {
      var c = cards.get(id), node = findNode(ctl.model, id); if (!c || !node) return;
      var e = engine.get(id) || { state: 'stale' };
      var stamp = e.state + ':' + (e.ver || 0) + ':' + JSON.stringify(node.params).length + ':' + (node.name || '');
      if (!force && c.painted === stamp) return;
      c.painted = stamp;
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
      var b = el('button', 'nc-port__dot', { type: 'button', tabindex: o.onPortDblClick ? '0' : '-1', 'aria-label': (p.label || p.name) + (dir === 'in' ? ' input' : ' output') + ' — connect', 'data-port': p.name, 'data-dir': dir, 'data-type': p.type });
      if (p.multi) b.classList.add('nc-port__dot--multi');
      if (o.onPortDblClick) b.addEventListener('keydown', function (e) {   // keyboard: Enter / Space on a port = its double-click (what connects here: spawn or search)
        if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); o.onPortDblClick(findNode(ctl.model, node.id), p.name, dir);
      });
      var t = el('span', 'nc-port__label'); t.textContent = p.label || p.name;
      if (dir === 'in') row.append(b, t); else row.append(t, b);
      return { row: row, dot: b };
    }
    function portSig(node) {   // a card is rebuilt when its port list changes (a node with variable inputs)
      var f = function (p) { return p.name + ':' + p.type + (p.multi ? '*' : '') + ':' + (p.label || ''); };
      return registry.inputsOf(node).map(f).join(',') + '|' + registry.outputsOf(node).map(f).join(',');
    }
    function buildCard(node) {
      var c = { ports: new Map(), sig: portSig(node) };
      var inkPort = registry.outputsOf(node)[0] || registry.inputsOf(node)[0];   // the card's ink: its first output's type (Export: its input's)
      var card = el('div', 'nc-node' + (o.cardClass ? ' ' + (o.cardClass(node) || '') : ''), { role: 'group', tabindex: '0', 'data-node-id': node.id, 'data-ink': inkPort ? inkPort.type : '' });
      card.setAttribute('aria-label', label(node));
      var meta = registry.get(node.type).meta;
      if (meta.pill) card.classList.add('nc-node--pill');   // a pill: the type's icon + one picture; the name is in the panel (and the card's aria-label)
      else if (meta.icon) card.classList.add('nc-node--capped');   // a full card with an icon: the pill's round cap + its name on one row, no solid band
      var head = el('div', 'nc-node__head', { 'data-theme': 'light' }); /* fixed black / white on the solid ink */ var type = el('span', 'nc-node__type'); type.textContent = meta.label;
      if (meta.icon && Organica.icons) { var ic = el('span', 'nc-node__icon', { 'aria-hidden': 'true' }); ic.innerHTML = Organica.icons.get(meta.icon); head.appendChild(ic); }
      var title = el('span', 'nc-node__title'); title.textContent = label(node); head.append(type, title);
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
      if (stage.classList.contains('nc-stage--far')) { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; return; }   // chips hide their ports: keep the last positions
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
      if (stage.classList.contains('nc-stage--far')) return { x: node.x + (dir === 'out' ? c.w : 0), y: node.y + Math.min(c.h / 2, 24) };   // a chip: wires meet its edge
      return { x: node.x + p.x, y: node.y + p.y };
    }
    function drawWires() {
      while (wireG.firstChild) wireG.removeChild(wireG.firstChild);
      var linked = new Set(); ctl.model.edges.forEach(function (e) { linked.add(e.from.node); linked.add(e.to.node); });
      cards.forEach(function (c, id) { var dead = !linked.has(id); if (c.el.classList.contains('is-isolated') !== dead) c.el.classList.toggle('is-isolated', dead); });   // wired to nothing = dead
      ctl.model.edges.forEach(function (e) {
        var a = portXY(e.from, 'out'), b = portXY(e.to, 'in'); if (!a || !b) return;
        var src = findNode(ctl.model, e.from.node), op = src && registry.outputsOf(src).filter(function (q) { return q.name === e.from.port; })[0];
        var d = wirePath(a.x, a.y, b.x, b.y);
        var hit = document.createElementNS(SVGNS, 'path'); hit.setAttribute('class', 'nc-wire-hit'); hit.setAttribute('d', d); hit.dataset.edge = e.id;
        var path = document.createElementNS(SVGNS, 'path'); path.setAttribute('d', d); path.dataset.edge = e.id;
        var cls = 'nc-wire'; if (op) cls += ' nc-wire--' + op.type;
        if (o.wireClass) cls += ' ' + (o.wireClass(e, ctl.model) || '');
        if (selected.has(e.from.node) || selected.has(e.to.node) || hovered === e.from.node || hovered === e.to.node) cls += ' is-related';
        if (selectedWire === e.id) cls += ' is-selected';
        path.setAttribute('class', cls);
        wireG.append(hit, path);
        var lbl = o.wireLabel ? o.wireLabel(e, ctl.model) : '';   // e.g. a list's size (FVS: ×n on a Set's wire), at the curve's midpoint
        if (lbl) { var t = document.createElementNS(SVGNS, 'text'); t.setAttribute('class', 'nc-wire__label'); t.setAttribute('x', (a.x + b.x) / 2); t.setAttribute('y', (a.y + b.y) / 2); t.textContent = lbl; wireG.appendChild(t); }
      });
    }
    var rendered = false;   // after the first render a new card pops in (not the whole board on load)
    function pop(elm) { elm.classList.remove('is-pop'); void elm.offsetWidth; elm.classList.add('is-pop'); elm.addEventListener('animationend', function () { elm.classList.remove('is-pop'); }, { once: true }); }
    function render() {   // full rebuild — after setModel / undo / a structural change
      var keep = new Set(ctl.model.nodes.map(function (n) { return n.id; }));
      cards.forEach(function (c, id) { if (!keep.has(id)) { io.unobserve(c.el); c.el.remove(); cards.delete(id); visible.delete(id); } });
      ctl.model.nodes.forEach(function (n) {
        var c = cards.get(n.id);
        if (c && c.sig !== portSig(n)) {   // its ports changed: a new card in the old one's place
          var fresh = buildCard(n); io.unobserve(c.el); c.el.replaceWith(fresh.el); cards.set(n.id, fresh); io.observe(fresh.el);
          if (visible.has(n.id)) fresh.painted = null;
          c = fresh; paintState(n.id, true);
        } else if (!c) { c = buildCard(n); cards.set(n.id, c); nodesLayer.appendChild(c.el); io.observe(c.el); if (rendered) pop(c.el); }
        else { place(c.el, n); c.title.textContent = label(n); c.el.setAttribute('aria-label', label(n)); }
        c.el.classList.toggle('is-selected', selected.has(n.id));
        c.el.classList.toggle('is-collapsed', !!n.collapsed);
      });
      Array.from(selected).forEach(function (id) { if (!keep.has(id)) selected.delete(id); });
      cards.forEach(function (c, id) { measure(id); });
      rendered = true;
      growFrames();
      drawFrames();
      drawWires();
    }
    function growFrames() {   // a section grows to hold the cards that sit in it (never shrinks on its own)
      var pad = 32, grew = false;
      (ctl.model.frames || []).forEach(function (f) {
        nodesIn(f).forEach(function (n) {
          var c = cards.get(n.id), w = c ? c.w : 200, h = c ? c.h : 120;
          var r = Math.max(f.x + f.w, n.x + w + pad), b = Math.max(f.y + f.h, n.y + h + pad);
          if (r > f.x + f.w + 0.5 || b > f.y + f.h + 0.5) { f.w = Math.round(r - f.x); f.h = Math.round(b - f.y); grew = true; }
        });
      });
      return grew;
    }
    // ── Sections (model.frames): a named area that moves the nodes inside it; its label stays readable at any zoom ──
    function nodesIn(f) {
      return ctl.model.nodes.filter(function (n) { var c = cards.get(n.id), w = c ? c.w : 200, h = c ? c.h : 120, cx = n.x + w / 2, cy = n.y + h / 2; return cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h; });
    }
    function selectFrame(id) {   // select a section without rebuilding the frames layer (a drag may hold one of its labels)
      selectedFrame = null; select([]); selectedFrame = id;
      framesLayer.querySelectorAll('.nc-frame').forEach(function (x) { x.classList.toggle('is-selected', x.dataset.frame === id); });
    }
    function drawFrames() {
      framesLayer.replaceChildren();
      (ctl.model.frames || []).forEach(function (f) {
        var d = el('div', 'nc-frame' + (selectedFrame === f.id ? ' is-selected' : ''), { 'data-frame': f.id, role: 'group', 'aria-label': f.name });
        d.style.transform = 'translate(' + f.x + 'px,' + f.y + 'px)'; d.style.width = f.w + 'px'; d.style.height = f.h + 'px'; d.style.setProperty('--frame-w', f.w + 'px');
        var lab = el('button', 'nc-frame__label', { type: 'button', 'aria-label': f.name, 'aria-keyshortcuts': 'F2 Delete', title: f.name }); lab.textContent = f.name;
        var grip = el('span', 'nc-frame__grip', { 'aria-hidden': 'true' });
        d.append(lab, grip); framesLayer.appendChild(d);
        bindFrame(d, lab, grip, f);
      });
    }
    function bindFrame(d, lab, grip, f) {
      lab.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || spaceDown) return; e.stopPropagation();
        selectFrame(f.id);
        var start = toBoard(e.clientX, e.clientY), fx = f.x, fy = f.y, inside = nodesIn(f).map(function (n) { return { n: n, x: n.x, y: n.y }; }), moved = false;
        try { lab.setPointerCapture(e.pointerId); } catch (err) {}
        function move(ev) {
          var p = toBoard(ev.clientX, ev.clientY), dx = p.x - start.x, dy = p.y - start.y;
          if (!moved && Math.hypot(dx, dy) * zoomPan.zoom < 3) return; moved = true;
          f.x = Math.round(fx + dx); f.y = Math.round(fy + dy);
          d.style.transform = 'translate(' + f.x + 'px,' + f.y + 'px)';
          inside.forEach(function (g) { g.n.x = Math.round(g.x + dx); g.n.y = Math.round(g.y + dy); var c = cards.get(g.n.id); if (c) place(c.el, g.n); });
          drawWires();
        }
        function up() { lab.removeEventListener('pointermove', move); lab.removeEventListener('pointerup', up); lab.removeEventListener('pointercancel', up); if (moved) { changed('move'); commit('move'); } lab.focus({ preventScroll: true }); }
        lab.addEventListener('pointermove', move); lab.addEventListener('pointerup', up); lab.addEventListener('pointercancel', up);
      });
      function rename() {
        var inp = el('input', 'nc-frame__input', { type: 'text', 'aria-label': 'Section name', value: f.name });
        lab.replaceWith(inp); inp.focus(); inp.select();
        var over = false;
        var done = function (ok) { if (over) return; over = true; if (ok && inp.value.trim()) { f.name = inp.value.trim(); commit('rename'); } drawFrames(); if (o.onChange) o.onChange(ctl.model, 'rename'); };
        inp.addEventListener('keydown', function (k) { if (k.key === 'Enter') done(true); else if (k.key === 'Escape') done(false); k.stopPropagation(); });
        inp.addEventListener('blur', function () { done(true); });
      }
      lab.addEventListener('dblclick', function (e) { e.stopPropagation(); rename(); });   // rename in place
      lab.addEventListener('click', function () { if (selectedFrame !== f.id) selectFrame(f.id); });
      lab.addEventListener('keydown', function (e) {   // the keyboard path: F2 / Enter rename, Delete removes the section, arrows move it
        if (e.key === 'F2' || (e.key === 'Enter' && selectedFrame === f.id)) { e.preventDefault(); e.stopPropagation(); rename(); return; }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); selectFrame(f.id); remove([]); return; }
        if (/^Arrow/.test(e.key)) {
          e.preventDefault(); e.stopPropagation(); selectFrame(f.id);
          var step = e.shiftKey ? 32 : 8, dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          nodesIn(f).forEach(function (n) { n.x += dx; n.y += dy; var c = cards.get(n.id); if (c) place(c.el, n); });
          f.x += dx; f.y += dy; d.style.transform = 'translate(' + f.x + 'px,' + f.y + 'px)'; drawWires(); changed('move');
          clearTimeout(ctl._nudge); ctl._nudge = setTimeout(function () { commit('move'); }, 400);
        }
      });
      grip.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return; e.stopPropagation();
        var start = toBoard(e.clientX, e.clientY), w0 = f.w, h0 = f.h;
        try { grip.setPointerCapture(e.pointerId); } catch (err) {}
        function move(ev) { var p = toBoard(ev.clientX, ev.clientY); f.w = Math.max(160, Math.round(w0 + p.x - start.x)); f.h = Math.max(120, Math.round(h0 + p.y - start.y)); d.style.width = f.w + 'px'; d.style.height = f.h + 'px'; }
        function up() { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); changed('resize'); commit('resize'); }
        grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
      });
    }
    // Add a section around the given nodes (or the selection, or the view's centre). → the frame
    ctl.addSection = function (ids, name, opt) {
      ids = ids || Array.from(selected);
      var ns = ids.map(function (id) { return findNode(ctl.model, id); }).filter(Boolean), pad = 32, f;
      var n = (ctl.model.frames || []).length, nm = name;
      if (!nm) { var used = (ctl.model.frames || []).map(function (x) { return +((String(x.name).match(/^Section (\d+)$/) || [])[1] || 0); }); nm = 'Section ' + (Math.max(0, Math.max.apply(null, used.concat([0]))) + 1); }
      if (ns.length) {
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        ns.forEach(function (q) { measure(q.id); var c = cards.get(q.id), w = c ? c.w : 200, h = c ? c.h : 120; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + w); y1 = Math.max(y1, q.y + h); });
        f = { id: nextId('f'), name: nm, x: Math.round(x0 - pad), y: Math.round(y0 - pad - 28), w: Math.round(x1 - x0 + pad * 2), h: Math.round(y1 - y0 + pad * 2 + 28) };
      } else { var r = stage.getBoundingClientRect(), c0 = toBoard(r.left + r.width / 2, r.top + r.height / 2); f = { id: nextId('f'), name: nm, x: Math.round(c0.x - 300), y: Math.round(c0.y - 200), w: 600, h: 400 }; }
      ctl.model.frames = (ctl.model.frames || []).concat([f]);
      drawFrames(); announce(nm + ' added'); changed('section', false); if (!(opt && opt.noCommit)) commit('section');
      return f;
    };
    ctl.pulse = function (ids) {
      ids.forEach(function (id) { var c = cards.get(id); if (!c) return; c.el.classList.remove('is-pulse'); void c.el.offsetWidth; c.el.classList.add('is-pulse'); });
    };
    ctl.refresh = function () { render(); cards.forEach(function (c) { c.painted = null; }); run(); };

    // ── changes ──
    function changed(reason, structural) {
      if (structural) render(); else drawWires();
      if (o.onChange) o.onChange(ctl.model, reason);
    }
    function commit(reason, opt) { (opt && opt.amend ? history.amend : history.push)(ctl.model, { selection: Array.from(selected) }); if (o.onChange) o.onChange(ctl.model, reason || 'commit'); }
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
      if (selectedFrame) { selectedFrame = null; drawFrames(); }
      cards.forEach(function (c, id) { c.el.classList.toggle('is-selected', selected.has(id)); });
      drawWires();
      if (o.onSelect) o.onSelect(Array.from(selected));
    }
    ctl.selectedSection = function () { return selectedFrame; };
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
      card.addEventListener('focus', function () { stage.scrollTop = 0; stage.scrollLeft = 0; if (!selected.has(id)) select([id]); });
      card.addEventListener('pointerenter', function () { hovered = id; drawWires(); });
      card.addEventListener('pointerleave', function () { if (hovered === id) { hovered = null; drawWires(); } });
    }

    // ── wiring: drag from any port; compatible ports glow, others dim; release on a port / a card / the board ──
    function portInfo(dot) { var card = dot.closest('.nc-node'); return { node: card.dataset.nodeId, port: dot.dataset.port, dir: dot.dataset.dir }; }
    function startWire(e, dot) {
      var info = portInfo(dot), from, fixedDir, detached = false;
      function noConnect(reason) { if (detached) { drawWires(); commit('disconnect'); run(); } else changed(reason || 'wire'); }
      if (info.dir === 'in') {
        var existing = ctl.model.edges.filter(function (w) { return w.to.node === info.node && w.to.port === info.port; });
        var node = findNode(ctl.model, info.node), ip = registry.inputsOf(node).filter(function (p) { return p.name === info.port; })[0];
        if (existing.length && !(ip && ip.multi)) {   // drag a connected input off: detach it and carry its source
          var w = existing[existing.length - 1]; removeEdge(ctl.model, w.id); touchDown(info.node); detached = true;
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
          var t = portInfo(tdot); if (t.dir === fixedDir) return noConnect();
          var a = fixedDir === 'out' ? from : t, b = fixedDir === 'out' ? t : from;
          if (!tryConnect({ node: a.node, port: a.port }, { node: b.node, port: b.port }) && detached) noConnect();
        } else if (tcard && stage.contains(tcard) && tcard.dataset.nodeId !== from.node && fixedDir === 'out') {
          // Weave: a wire dropped on a card goes to its first compatible input
          var tn = findNode(ctl.model, tcard.dataset.nodeId), hit = null, taken = [];
          registry.inputsOf(tn).forEach(function (p) {
            if (hit || !canConnect(ctl.model, registry, { node: from.node, port: from.port }, { node: tn.id, port: p.name }).ok) return;
            var free = p.multi || !ctl.model.edges.some(function (w) { return w.to.node === tn.id && w.to.port === p.name; });
            if (free) hit = p; else taken.push(p);
          });
          if (!hit && taken.length === 1) hit = taken[0];   // the one input it fits is taken: replace that wire
          if (hit) tryConnect({ node: from.node, port: from.port }, { node: tn.id, port: hit.name });
          else { var msg = 'No input on ' + label(tn) + ' takes this.'; if (Organica.notice) Organica.notice(msg); else announce(msg); noConnect(); }
        } else if (!tcard && o.onWireDrop) {
          o.onWireDrop({ node: from.node, port: from.port, dir: fixedDir }, toBoard(ev.clientX, ev.clientY), { x: ev.clientX, y: ev.clientY });
          noConnect();
        } else noConnect();
      }
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    }
    function tryConnect(from, to) {
      var r = canConnect(ctl.model, registry, from, to);
      if (!r.ok) { if (Organica.notice) Organica.notice(r.reason); else announce(r.reason); changed('wire'); return null; }
      var edge = addEdge(ctl.model, from, to, r.multi);
      touchDown(to.node);
      var tc = cards.get(to.node), td = tc && tc.ports.get('in:' + to.port); if (td) pop(td.el); if (tc) pop(tc.el);
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
    stage.addEventListener('contextmenu', function (e) {
      if (!o.onSearch || e.target.closest('.nc-node')) return;
      e.preventDefault(); o.onSearch(toBoard(e.clientX, e.clientY), null, { x: e.clientX, y: e.clientY });
    });
    stage.addEventListener('dblclick', function (e) {
      var dot = e.target.closest && e.target.closest('.nc-port__dot');
      if (dot && o.onPortDblClick) { var i = portInfo(dot); o.onPortDblClick(findNode(ctl.model, i.node), i.port, i.dir); return; }
      if (!e.target.closest('.nc-node') && o.onBoardDblClick) o.onBoardDblClick(toBoard(e.clientX, e.clientY), { x: e.clientX, y: e.clientY });
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
        if (!dragged) { selected.clear(); selectedWire = null; if (selectedFrame) { selectedFrame = null; drawFrames(); } cards.forEach(function (c) { c.el.classList.remove('is-selected'); }); }
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
        var why = o.protect ? o.protect(n, ctl.model, ids) : null;   // ids: everything deleted together
        if (why) kept.push(why); else gone.push(n);
      });
      if (selectedFrame && !ids.length) {
        var fr = (ctl.model.frames || []).filter(function (x) { return x.id === selectedFrame; })[0];
        ctl.model.frames = (ctl.model.frames || []).filter(function (x) { return x.id !== selectedFrame; }); selectedFrame = null;
        if (fr) announce(fr.name + ' deleted — its nodes stay'); drawFrames(); changed('section', false); commit('section'); return;
      }
      if (selectedWire && !ids.length) {
        var w = ctl.model.edges.filter(function (x) { return x.id === selectedWire; })[0];
        if (w) { removeEdge(ctl.model, w.id); touchDown(w.to.node); selectedWire = null; changed('disconnect', true); commit('disconnect'); }
        return;
      }
      if (kept.length && Organica.notice) Organica.notice(kept.length === 1 ? kept[0] : kept.length + ' nodes kept — ' + kept.filter(function (k, i) { return kept.indexOf(k) === i; }).join(' · '));
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
    function boxOf(n) { var c = cards.get(n.id); return { x: n.x, y: n.y, w: c ? c.w : 200, h: c ? c.h : 120 }; }
    function freeDy(src, dx, dy) {   // move a copy of `src` (offset dx, dy) down until it covers no other card
      var others = ctl.model.nodes.filter(function (n) { return src.indexOf(n) < 0; }).map(boxOf);
      for (var t = 0; t < 40; t++) {
        var hit = src.some(function (n) { var b = boxOf(n), x = b.x + dx, y = b.y + dy; return others.some(function (q) { return x < q.x + q.w + 24 && x + b.w > q.x - 24 && y < q.y + q.h + 24 && y + b.h > q.y - 24; }); });
        if (!hit) return dy; dy += 120;
      }
      return dy;
    }
    function cloneNodes(ids, dx, dy, rewireOutside) {
      var map = new Map(), src = ids.map(function (id) { return findNode(ctl.model, id); }).filter(Boolean);
      if (dx == null) {   // beside the originals: to the right of their bounding box
        var x0 = Infinity, x1 = -Infinity;
        src.forEach(function (n) { var c = cards.get(n.id); x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x + (c ? c.w : 200)); });
        dx = Math.round(x1 - x0 + 60); dy = 0;
        dy = freeDy(src, dx, dy);
      }
      src.forEach(function (n) {
        var copy = JSON.parse(JSON.stringify(Object.assign({}, n, { id: null, x: n.x + dx, y: n.y + dy })));
        if (o.nameCopy) copy.name = o.nameCopy(copy, ctl.model);
        var c = addNode(ctl.model, copy); map.set(n.id, c.id);
      });
      ctl.model.edges.slice().forEach(function (e) {
        if (!map.has(e.to.node)) return;
        var from = map.has(e.from.node) ? { node: map.get(e.from.node), port: e.from.port } : (rewireOutside ? e.from : null);
        if (from) addEdge(ctl.model, from, { node: map.get(e.to.node), port: e.to.port }, true);
      });
      return Array.from(map.values());
    }
    ctl.duplicate = function (ids, opt) {
      ids = ids || Array.from(selected); if (!ids.length) return [];
      var made = cloneNodes(ids, null, null, true);
      render(); select(made); made.forEach(touchDown);
      announce(made.length === 1 ? 'Duplicated' : made.length + ' nodes duplicated');
      changed('duplicate', true); if (!(opt && opt.noCommit)) commit('duplicate');
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
      clipboard.nodes.forEach(function (n) { var copy = Object.assign({}, JSON.parse(JSON.stringify(n)), { id: null, x: n.x + 60, y: n.y + 60 }); if (o.nameCopy) copy.name = o.nameCopy(copy, ctl.model); var c = addNode(ctl.model, copy); map.set(n.id, c.id); made.push(c.id); });
      clipboard.edges.forEach(function (e) { addEdge(ctl.model, { node: map.get(e.from.node), port: e.from.port }, { node: map.get(e.to.node), port: e.to.port }, true); });
      clipboard = { nodes: clipboard.nodes.map(function (n) { return Object.assign({}, n, { x: n.x + 60, y: n.y + 60 }); }), edges: clipboard.edges };
      render(); select(made); made.forEach(touchDown); changed('paste', true); commit('paste');
    }

    // ── view: fit all / fit selection ──
    function fit(ids, again) {
      var ns = ids.map(function (id) { return findNode(ctl.model, id); }).filter(Boolean); if (!ns.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      ns.forEach(function (n) { measure(n.id); var c = cards.get(n.id), w = c ? c.w : 200, h = c ? c.h : 120; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h); });
      var r = stage.getBoundingClientRect(), pad = 48, inset = o.fitInset || {}, L = inset.left || 0, B = inset.bottom || 0;
      var W = r.width - L, H = r.height - B;
      var z = Math.min(1.5, Math.max(0.1, Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0))));
      zoomPan.setView({ zoom: z, panX: L + (W - (x1 - x0) * z) / 2 - x0 * z, panY: (H - (y1 - y0) * z) / 2 - y0 * z });
      if (!again) requestAnimationFrame(function () { fit(ids, true); });   // measured again at the new zoom (a chip → a full card)
    }
    ctl.fitAll = function () { fit(ctl.model.nodes.map(function (n) { return n.id; })); };
    ctl.fitTo = function (ids) { fit(ids || []); };
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
      ctl.model = m; selected = new Set((meta && meta.selection) || []); rendered = false;   // a whole new board does not pop
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
      var inStage = stage.contains(e.target) || e.target === document.body || !!(o.keyScope && o.keyScope(e.target));
      if (mod && !e.shiftKey && k.toLowerCase() === 'z') { e.preventDefault(); ctl.undo(); return; }
      if (mod && (k.toLowerCase() === 'y' || (e.shiftKey && k.toLowerCase() === 'z'))) { e.preventDefault(); ctl.redo(); return; }
      if (e.shiftKey && !mod && (e.code === 'Digit1' || k === '!')) { e.preventDefault(); ctl.fitAll(); return; }
      if (e.shiftKey && !mod && (e.code === 'Digit2' || k === '@')) { e.preventDefault(); ctl.fitSelection(); return; }
      if (!inStage) return;
      if (mod && k.toLowerCase() === 'a') { e.preventDefault(); select(ctl.model.nodes.map(function (n) { return n.id; })); return; }
      if (mod && k.toLowerCase() === 'd') { e.preventDefault(); ctl.duplicate(); return; }
      if (mod && k.toLowerCase() === 'g') { e.preventDefault(); ctl.addSection(); return; }
      if (mod && k.toLowerCase() === 'c') { copy(); return; }
      if (mod && k.toLowerCase() === 'v') { e.preventDefault(); paste(); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); remove(Array.from(selected)); return; }
      if (k === 'Escape') { select([]); return; }
      if (k === 'Enter' && !mod && e.target.classList && e.target.classList.contains('nc-node') && o.onNodeDblClick) { var en = findNode(ctl.model, e.target.dataset.nodeId); if (en) { e.preventDefault(); o.onNodeDblClick(en, e); } return; }   // Enter on a focused card = its double-click (FVS: Compose)
      if (k === '/' && o.onSearch) { e.preventDefault(); var r = stage.getBoundingClientRect(); o.onSearch(toBoard(r.left + r.width / 2, r.top + r.height / 3), null, { x: r.left + r.width / 2, y: r.top + r.height / 3 }); return; }
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
    ctl.paint = function (id) { paintState(id, true); };
    ctl.remeasure = function (id) { measure(id); if (growFrames()) drawFrames(); drawWires(); };

    render();
    history.push(ctl.model, { selection: [] });
    run();
    return ctl;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS a host builds its node bar and node search from (promoted from FVS's Figure graph at Rhizome, Oct 2026)

  // The port of a NEW node of `type` that would connect to `from` (a port being dragged: {node, port, dir}), or null.
  // A probe node is added to a copy of the model, so variable-input types (meta.inputs as a function) work too.
  function portFor(registry, model, type, params, from) {
    if (!from) return null;
    var probe = { id: '__probe', type: type, x: 0, y: 0, params: params || registry.defaults(type) };
    var m = { nodes: model.nodes.concat([probe]), edges: model.edges, frames: [] };
    var ports = from.dir === 'out' ? registry.inputsOf(probe) : registry.outputsOf(probe);
    for (var i = 0; i < ports.length; i++) {
      var ok = from.dir === 'out' ? canConnect(m, registry, { node: from.node, port: from.port }, { node: '__probe', port: ports[i].name }).ok
                                  : canConnect(m, registry, { node: '__probe', port: ports[i].name }, { node: from.node, port: from.port }).ok;
      if (ok) return ports[i];
    }
    return null;
  }

  // Node search — a small dialog at a screen point: type to filter, ↑↓ Enter to pick, Esc to close.
  // search({ items:[{label, hint, …}], title?, client:{x,y}, onPick(item), onClose?(), returnFocus? }) → { close }
  // Styles: .nc-search* (node-canvas.css). One open at a time.
  var openSearchEl = null;
  function search(o) {
    if (openSearchEl) openSearchEl.close();
    var box = el('div', 'nc-search', { role: 'dialog', 'aria-label': 'Search nodes' });
    if (o.title) { var h = el('p', 'nc-search__head'); h.textContent = o.title; box.appendChild(h); }
    var q = el('input', 'org-field nc-search__q', { type: 'search', placeholder: 'Search nodes', 'aria-label': 'Search nodes', autocomplete: 'off' });
    var list = el('div', 'nc-search__list', { role: 'listbox', 'aria-label': 'Nodes' });
    box.append(q, list);
    var c = o.client || { x: innerWidth / 2, y: innerHeight / 3 };
    box.style.left = Math.max(8, Math.min(c.x, innerWidth - 260)) + 'px'; box.style.top = Math.max(8, Math.min(c.y, innerHeight - 320)) + 'px';
    document.body.appendChild(box);
    var shown = [], cur = 0, closed = false;
    function draw() {
      var t = q.value.trim().toLowerCase();
      shown = o.items.filter(function (it) { return !t || it.label.toLowerCase().indexOf(t) >= 0 || String(it.hint || '').toLowerCase().indexOf(t) >= 0; }).slice(0, 12);
      cur = Math.min(cur, Math.max(0, shown.length - 1));
      list.replaceChildren();
      if (!shown.length) { var none = el('p', 'nc-search__none'); none.textContent = 'No node matches “' + q.value.trim() + '”'; list.appendChild(none); return; }
      shown.forEach(function (it, i) {
        var b = el('button', 'nc-search__item' + (i === cur ? ' is-current' : ''), { type: 'button', role: 'option', 'aria-selected': String(i === cur), 'data-i': String(i) });
        var a = el('span'); a.textContent = it.label; var hh = el('span', 'nc-search__hint'); hh.textContent = it.hint || '';
        b.append(a, hh); list.appendChild(b);
      });
    }
    function close(back) {
      if (closed) return; closed = true; box.remove(); openSearchEl = null;
      document.removeEventListener('pointerdown', outside, true);
      if (back && o.returnFocus) o.returnFocus.focus({ preventScroll: true });
      if (o.onClose) o.onClose();
    }
    function pick(i) { var it = shown[i]; if (!it) return; close(false); o.onPick(it); }
    function outside(e) { if (!box.contains(e.target)) close(false); }
    q.addEventListener('input', function () { cur = 0; draw(); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { cur = Math.min(shown.length - 1, cur + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { pick(cur); e.preventDefault(); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(true); }
    });
    list.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); });
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
    draw(); q.focus({ preventScroll: true });
    openSearchEl = { close: function () { close(false); }, el: box };
    return openSearchEl;
  }

  // Node bar — the host's left dock (.org-dock: a bar of category buttons [data-cat] + one panel). A category
  // button opens the panel (aria-expanded, inert when closed); the host fills it (render). Any panel element
  // specOf() recognises can be dragged onto the board (a ghost follows the pointer, on <body> — the dock is
  // transformed) or clicked. nodeBar({ bar, panel, icons?:{cat: iconName}, render(cat, panel), specOf(target) → spec|null,
  //   onAdd(spec, ev, overStage) — a click (ev.type 'click', overStage false) or a drop; stage: the board element })
  // → { open(cat), close(), current() }. Styles: .nc-nodebar__* (node-canvas.css).
  function nodeBar(o) {
    var bar = o.bar, panel = o.panel, cur = null;
    if (o.icons && Organica.icons) bar.querySelectorAll('[data-cat]').forEach(function (b) { if (o.icons[b.dataset.cat]) b.innerHTML = Organica.icons.get(o.icons[b.dataset.cat]); });
    function open(cat) {
      cur = cat || null;
      bar.querySelectorAll('[data-cat]').forEach(function (b) { b.setAttribute('aria-expanded', String(b.dataset.cat === cur)); });
      if (cur) { panel.setAttribute('aria-label', cur); o.render(cur, panel); panel.dataset.open = 'true'; panel.inert = false; }
      else { panel.dataset.open = 'false'; panel.inert = true; }
    }
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (b) open(cur === b.dataset.cat ? null : b.dataset.cat); });
    // A drag that lost its pointer (a native drag started, the window lost focus, capture dropped) must never stay half
    // done — a ghost stuck on screen with the board unresponsive was the "browser freezes after two drags" (Oct 8, 2026).
    var endDrag = null;
    panel.addEventListener('dragstart', function (e) { e.preventDefault(); });   // never the browser's own drag of the item's text
    panel.addEventListener('pointerdown', function (e) {
      var spec = e.button === 0 && o.specOf(e.target); if (!spec) return;
      if (endDrag) endDrag();   // a previous drag left hanging
      e.preventDefault();   // no text selection, no native drag; the item keeps its keyboard focus path (Enter / Space below)
      var src = e.target.closest('button') || e.target, sx = e.clientX, sy = e.clientY, ghost = null;
      try { src.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic or ended pointer */ }
      function move(ev) {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        if (!ghost) { ghost = el('div', 'nc-nodebar__ghost' + (src.classList.contains('nc-nodebar__item--tile') ? ' nc-nodebar__item--tile' : '')); ghost.innerHTML = src.innerHTML; document.body.appendChild(ghost); panel.classList.add('is-dragging-away'); document.body.classList.add('nc-is-dragging'); }
        ghost.style.transform = 'translate(' + (ev.clientX + 8) + 'px,' + (ev.clientY + 8) + 'px)';
      }
      function up(ev) {
        src.removeEventListener('pointermove', move); src.removeEventListener('pointerup', up); src.removeEventListener('pointercancel', up);
        src.removeEventListener('lostpointercapture', lost); window.removeEventListener('blur', up); endDrag = null;
        panel.classList.remove('is-dragging-away'); document.body.classList.remove('nc-is-dragging');
        if (ev.type !== 'pointerup') { if (ghost) ghost.remove(); return; }
        if (ghost) {
          ghost.remove();
          var r = o.stage ? o.stage.getBoundingClientRect() : null;
          var over = !!r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
          o.onAdd(spec, ev, over);
        } else o.onAdd(spec, { type: 'click', clientX: ev.clientX, clientY: ev.clientY }, false);
      }
      // capture lost without a pointerup (it arrives first when the drag ends normally, so this is only the broken case)
      function lost(ev) { setTimeout(function () { if (endDrag === cancel) up({ type: 'cancel' }); }, 0); }
      function cancel() { up({ type: 'cancel' }); }
      endDrag = cancel;
      src.addEventListener('pointermove', move); src.addEventListener('pointerup', up); src.addEventListener('pointercancel', up);
      src.addEventListener('lostpointercapture', lost); window.addEventListener('blur', up);
    });
    // keyboard: Enter / Space on an item = a click
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return; var spec = o.specOf(e.target); if (!spec) return;
      e.preventDefault(); o.onAdd(spec, { type: 'click' }, false);
    });
    return { open: open, close: function () { open(null); }, current: function () { return cur; } };
  }

  // Graph menu — the floatbar's file menu for a node board (promoted from FVS + Rhizome, Oct 2026): Saved graphs ·
  // Graph name · Save · Delete · New graph · Open file… · Save as file. A graph that was never saved is kept as
  // "Untitled n" before another replaces it, so nothing is lost; the button shows a dot while the graph is unsaved.
  // graphMenu({
  //   els: { button, popover, saved (select), name (input), save, del, newGraph, open, file, input (type=file) },
  //   store              Organica.presetStore(tool) — entries { model, name?, savedAt } (a bare model also reads)
  //   getModel()         the board's model now
  //   load(model, name)  put a model on the board (the host refits, re-renders its panel…)
  //   normalize(model)?  how a stored model reads (e.g. an older format), also used to compare "saved?"
  //   hidden(name)?      store keys that are not saved graphs (e.g. an autosave slot)
  //   fileTool           the `tool` field of a graph file;  fileName?  base name when the graph has no name
  //   openFile(data, file)?  a file that is not a graph: return true if the host opened it
  //   onSaved?()         after the store changed (the host's autosave)
  //   dirtyKey?          Organica.dirty key set while the graph is unsaved
  // }) → { sync(), name(), setName(n), use(model, name), keepUnsaved(), savedAs() }
  function graphMenu(o) {
    var E = o.els, store = o.store, current = '';
    var hidden = o.hidden || function () { return false; };
    var norm = o.normalize || function (m) { return createModel(m); };
    function unwrap(e) { return e && e.model ? e.model : e; }
    function snap(m) { return JSON.stringify({ nodes: m.nodes, edges: m.edges, frames: m.frames || [] }); }
    function names() { return Object.keys(store.read()).filter(function (n) { return !hidden(n); }).sort(function (a, b) { return a.localeCompare(b); }); }
    function savedAs() { var e = current && store.read()[current]; return !!e && snap(norm(unwrap(e))) === snap(o.getModel()); }
    function entry(m) { return { model: JSON.parse(JSON.stringify(m)), savedAt: new Date().toISOString() }; }
    function sync() {
      var list = names(), sel = E.saved;
      sel.replaceChildren();
      var first = document.createElement('option'); first.value = ''; first.textContent = list.length ? '—' : 'No saved graphs yet'; sel.appendChild(first);
      list.forEach(function (n) { var op = document.createElement('option'); op.textContent = n; op.value = n; if (n === current) op.selected = true; sel.appendChild(op); });
      sel.disabled = !list.length;
      E.name.value = current;
      E.del.disabled = !current || !store.read()[current];
      var unsaved = !!o.getModel().nodes.length && !savedAs();
      E.button.classList.toggle('is-unsaved', unsaved);
      if (unsaved) E.button.setAttribute('aria-description', 'Not saved'); else E.button.removeAttribute('aria-description');
      if (o.dirtyKey && Organica.dirty) Organica.dirty.set(o.dirtyKey, unsaved);
    }
    function keepUnsaved() {
      var m = o.getModel(); if (!m.nodes.length || savedAs()) return;
      var all = store.read(), i = 1; while (all['Untitled ' + i]) i++;
      var n = current && !all[current] ? current : 'Untitled ' + i;
      all[n] = entry(m); store.write(all);
      if (Organica.notice) Organica.notice('The current graph was saved as “' + n + '”');
    }
    function use(m, name) { current = name || ''; o.load(norm(m), current); sync(); if (o.onSaved) o.onSaved(); }
    var chev = E.button.querySelector('.nc-graph-btn__chev'); if (chev && Organica.icons) chev.innerHTML = Organica.icons.get('chevron-down', { cls: 'chev' });
    if (Organica.popover) Organica.popover(E.button, E.popover);
    E.button.addEventListener('click', sync);
    E.saved.addEventListener('change', function (e) { var n = e.target.value, g = n && store.read()[n]; if (!g) return; keepUnsaved(); use(unwrap(g), n); });
    E.save.addEventListener('click', function () {
      var n = E.name.value.trim(); if (!n) { if (Organica.notice) Organica.notice('Name the graph first'); E.name.focus(); return; }
      var all = store.read(); all[n] = entry(o.getModel());
      if (store.write(all) === false) return;
      current = n; sync(); if (o.onSaved) o.onSaved(); if (Organica.notice) Organica.notice('Graph saved');
    });
    E.del.addEventListener('click', function () {
      var all = store.read(); if (!current || !all[current]) return;
      delete all[current]; store.write(all); current = ''; sync(); if (o.onSaved) o.onSaved(); if (Organica.notice) Organica.notice('Graph deleted');
    });
    E.newGraph.addEventListener('click', function () { keepUnsaved(); use(createModel(), ''); });
    E.file.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ tool: o.fileTool, version: 1, name: current, model: o.getModel() }, null, 2)], { type: 'application/json' });
      Organica.download(blob, Organica.stamp(current ? current.replace(/[^\w-]+/g, '-').toLowerCase() : (o.fileName || o.fileTool), 'json'));
      if (Organica.notice) Organica.notice('Graph file saved');
    });
    E.open.addEventListener('click', function () { E.input.click(); });
    E.input.addEventListener('change', async function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        var data = JSON.parse(await f.text()), m = data && (data.tool === o.fileTool ? data.model : (!data.tool && data.model ? data.model : null));
        if (m && Array.isArray(m.nodes) && Array.isArray(m.edges)) { keepUnsaved(); use(m, data.name || ''); return; }
        if (o.openFile && o.openFile(data, f)) return;
        throw new Error('That file is not a graph');
      } catch (err) { if (Organica.notice) Organica.notice(err && err.message && !/JSON/.test(err.message) ? err.message : 'That file could not be opened', { kind: 'error' }); }
    });
    return { sync: sync, name: function () { return current; }, setName: function (n) { current = n || ''; sync(); }, use: use, keepUnsaved: keepUnsaved, savedAs: savedAs };
  }

  // A model from storage or a file, made safe to run: unknown node types, wires to missing nodes or ports, and wires
  // that would close a loop are dropped (topoSort would throw on every run). → { model, dropped: { nodes, edges } }
  // The notice for what repairModel dropped — one sentence for every host (FVS, Rhizome); '' when nothing was.
  function droppedText(d) {
    var parts = [d.nodes && d.nodes + (d.nodes === 1 ? ' node' : ' nodes'), d.edges && d.edges + (d.edges === 1 ? ' connection' : ' connections')].filter(Boolean);
    return parts.length ? 'Part of this graph could not be opened: ' + parts.join(' and ') + ' left out' : '';
  }
  function repairModel(src, registry) {
    var m = createModel(src), dn = 0, de = 0;
    m.nodes = m.nodes.filter(function (n) { var ok = n && n.id && registry.has(n.type); if (!ok) dn++; return ok; });
    var edges = m.edges; m.edges = [];
    edges.forEach(function (e) {
      var a = e && e.from && findNode(m, e.from.node), b = e && e.to && findNode(m, e.to.node);
      var ports = function (list, name) { return !list || list.some(function (q) { return q.name === name; }); };
      if (!a || !b || !ports(registry.outputsOf && registry.outputsOf(a), e.from.port) || !ports(registry.inputsOf && registry.inputsOf(b), e.to.port) || wouldCycle(m, e.from, e.to)) { de++; return; }
      m.edges.push(e);
    });
    return { model: m, dropped: { nodes: dn, edges: de } };
  }

  // ── card bodies (Diego, Oct 8, 2026 — the shared body vocabulary, Foundation first): HTML strings a host puts in
  // .nc-node__body. A picture is an SVG in currentColor, so it is drawn in the card's ink (--node-ink); swatches are
  // content colours. Styles: .nc-body* in node-canvas.css.
  function escH(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var body = {
    line: function (text) { return '<p class="nc-body__line">' + escH(text) + '</p>'; },
    // a small drawing beside its summary line — Organica.aspectIcon (a Canvas), Organica.loomGridThumb (a Grid), …
    picture: function (svg, text) {
      return '<div class="nc-body"><span class="nc-body__pic" aria-hidden="true">' + (svg || '') + '</span>' + (text != null ? body.line(text) : '') + '</div>';
    },
    // a saved piece of work on paper (an SVG in its own colours — a light work surface in both themes) beside its line
    thumb: function (svg, text) {
      if (!svg) return text != null ? body.line(text) : '';   // nothing to show (none picked): the words say so, on a pill too
      return '<div class="nc-body"><span class="nc-body__thumb" data-theme="light" aria-hidden="true">' + (svg || '') + '</span>' + (text != null ? body.line(text) : '') + '</div>';
    },
    // several pieces of work as a little fanned stack (the first three), beside its line — a Set, a list
    stack: function (svgs, text) {
      var list = (svgs || []).filter(Boolean).slice(0, 3);
      if (!list.length) return text != null ? body.line(text) : '';   // an empty list: the words only
      return '<div class="nc-body"><span class="nc-body__stack" aria-hidden="true">' + list.map(function (svg, i) {
        return '<span class="nc-body__thumb" data-theme="light" style="--i:' + i + '">' + (svg || '') + '</span>';
      }).join('') + '</span>' + (text != null ? body.line(text) : '') + '</div>';
    },
    // a node-bar item as a tile: the type's icon (monochrome) over its name (the button keeps its own class and adds
    // .nc-nodebar__item--tile). meta.barIcon = an icon for the tile only, on a type whose card has none
    tile: function (meta, label) {
      var icon = meta && (meta.barIcon || meta.icon);
      return '<span class="nc-tile__icon" aria-hidden="true">' + (icon && Organica.icons ? Organica.icons.get(icon) : '') + '</span><span class="nc-tile__label">' + escH(label) + '</span>';
    },
    // a row of colour chips; opts.paper = the first is the ground (a stronger edge); opts.text = a summary line under it
    swatches: function (colors, opts) {
      opts = opts || {};
      var chips = (colors || []).map(function (c, i) {
        return '<span class="nc-body__swatch' + (opts.paper && i === 0 ? ' is-paper' : '') + (c === 'transparent' || c === 'none' ? ' is-clear' : '') + '" style="--i:' + i + ';background:' + escH(c) + '"></span>';
      }).join('');
      return '<div class="nc-body nc-body--stack"><span class="nc-body__swatches">' + chips + '</span>' + (opts.text != null ? body.line(opts.text) : '') + '</div>';
    },
  };

  Organica.nodeCanvas = {
    MODEL_VERSION: MODEL_VERSION,
    nextId: nextId, createModel: createModel, findNode: findNode, edgesInto: edgesInto, edgesOutOf: edgesOutOf,
    addNode: addNode, removeNode: removeNode, addEdge: addEdge, removeEdge: removeEdge,
    topoSort: topoSort, wouldCycle: wouldCycle, repairModel: repairModel, droppedText: droppedText,
    createRegistry: createRegistry, canConnect: canConnect,
    createEngine: createEngine, createHistory: createHistory,
    mount: mount, wirePath: wirePath,
    portFor: portFor, search: search, nodeBar: nodeBar, graphMenu: graphMenu,
    body: body,
  };
})();
