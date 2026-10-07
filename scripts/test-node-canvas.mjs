#!/usr/bin/env node
// Organica.nodeCanvas — model, registry, engine, history (shared/node-canvas.js). Pure logic, no browser.
// Usage: node scripts/test-node-canvas.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {}, console, structuredClone, Promise, Map, Set, Date, JSON };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared/node-canvas.js'), 'utf8'), ctx);
const NC = ctx.window.Organica.nodeCanvas;
const fails = []; let n = 0;
const ok = (c, m) => { n++; if (!c) fails.push(m); };

// a counter of compute() calls per type
const calls = {};
const T = (id, inputs, outputs, compute, extra = {}) => ({ meta: { id, label: id, category: 'Test', inputs, outputs, params: extra.params || [] }, compute: (i, p, c) => { calls[id] = (calls[id] || 0) + 1; return compute(i, p, c); } });
const reg = NC.createRegistry([
  T('num', [], [{ name: 'n', type: 'number' }], (i, p) => ({ n: p.v }), { params: [{ name: 'v', default: 1 }] }),
  T('add', [{ name: 'a', type: 'number', required: true }, { name: 'b', type: 'number' }], [{ name: 'n', type: 'number' }], i => ({ n: i.a + (i.b || 0) })),
  T('sum', [{ name: 'xs', type: 'number', multi: true }], [{ name: 'n', type: 'number' }], i => ({ n: i.xs.reduce((a, b) => a + b, 0) })),
  T('boom', [{ name: 'a', type: 'number' }], [{ name: 'n', type: 'number' }], () => { throw new Error('bad'); }),
  T('str', [{ name: 's', type: 'text' }], [{ name: 's', type: 'text' }], i => ({ s: i.s })),
], { adapters: { 'number->text': v => 'n' + v } });

const m = NC.createModel();
const a = NC.addNode(m, { type: 'num', params: { v: 2 } });
const b = NC.addNode(m, { type: 'num', params: { v: 3 } });
const s = NC.addNode(m, { type: 'add' });
const t = NC.addNode(m, { type: 'add' });   // fed by s
ok(reg.defaults('num').v === 1, 'defaults');
let c = NC.canConnect(m, reg, { node: a.id, port: 'n' }, { node: s.id, port: 'a' }); ok(c.ok, 'connect num→add');
NC.addEdge(m, { node: a.id, port: 'n' }, { node: s.id, port: 'a' });
NC.addEdge(m, { node: b.id, port: 'n' }, { node: s.id, port: 'b' });
NC.addEdge(m, { node: s.id, port: 'n' }, { node: t.id, port: 'a' });
ok(!NC.canConnect(m, reg, { node: t.id, port: 'n' }, { node: s.id, port: 'b' }).ok, 'loop refused');
ok(/loop/.test(NC.canConnect(m, reg, { node: t.id, port: 'n' }, { node: s.id, port: 'b' }).reason), 'loop reason');

const states = [];
const eng = NC.createEngine({ registry: reg, onState: (id, e) => states.push([id, e.state]) });
await eng.run(m);
ok(eng.get(t.id).value.n === 5 && eng.get(t.id).state === 'ok', 'computed 2+3 through t');
const before = { ...calls };
await eng.run(m);
ok(JSON.stringify(calls) === JSON.stringify(before), 'second run computes nothing');

// change b → s and t recompute, a does not
b.params.v = 10; eng.touch(b.id);
await eng.run(m);
ok(eng.get(t.id).value.n === 12, 'after edit: 12');
ok(calls.num === before.num + 1 && calls.add === before.add + 2, 'downstream only (num +1, add +2): ' + JSON.stringify(calls));

// required input missing → waiting, with a message
const w = NC.addNode(m, { type: 'add' });
await eng.run(m);
ok(eng.get(w.id).state === 'waiting' && /Connect/.test(eng.get(w.id).message), 'waiting state');

// error → upstream for its dependants
const x = NC.addNode(m, { type: 'boom' }); const y = NC.addNode(m, { type: 'add' });
NC.addEdge(m, { node: x.id, port: 'n' }, { node: y.id, port: 'a' });
await eng.run(m);
ok(eng.get(x.id).state === 'error' && eng.get(x.id).message === 'bad', 'error state');
ok(eng.get(y.id).state === 'upstream' && /fix it first/.test(eng.get(y.id).message), 'upstream state');

// multi input + adapter
const sm = NC.addNode(m, { type: 'sum' });
NC.addEdge(m, { node: a.id, port: 'n' }, { node: sm.id, port: 'xs' }, true);
NC.addEdge(m, { node: b.id, port: 'n' }, { node: sm.id, port: 'xs' }, true);
ok(NC.addEdge(m, { node: b.id, port: 'n' }, { node: sm.id, port: 'xs' }, true) === null, 'no duplicate multi wire');
const st = NC.addNode(m, { type: 'str' });
ok(NC.canConnect(m, reg, { node: a.id, port: 'n' }, { node: st.id, port: 's' }).ok, 'adapter number→text allowed');
NC.addEdge(m, { node: a.id, port: 'n' }, { node: st.id, port: 's' });
await eng.run(m);
ok(eng.get(sm.id).value.n === 12, 'multi sum 2+10');
ok(eng.get(st.id).value.s === 'n2', 'adapter applied');

// isActive: only on-screen outputs + their ancestors run; the rest is stale
const reg2 = reg;
const m2 = NC.createModel();
const p1 = NC.addNode(m2, { type: 'num', params: { v: 1 } }), q1 = NC.addNode(m2, { type: 'add' }), q2 = NC.addNode(m2, { type: 'add' });
NC.addEdge(m2, { node: p1.id, port: 'n' }, { node: q1.id, port: 'a' }); NC.addEdge(m2, { node: p1.id, port: 'n' }, { node: q2.id, port: 'a' });
const visible = new Set([q1.id]);
const eng2 = NC.createEngine({ registry: reg2, isActive: nd => visible.has(nd.id) });
await eng2.run(m2);
ok(eng2.get(q1.id).state === 'ok' && eng2.get(p1.id).state === 'ok', 'active + ancestor ran');
ok(eng2.get(q2.id).state === 'stale', 'off-screen stays stale');
visible.add(q2.id); await eng2.run(m2);
ok(eng2.get(q2.id).state === 'ok' && eng2.get(q2.id).value.n === 1, 'scrolled in → computed');

// serialized runs: concurrent calls never overlap
let live = 0, maxLive = 0;
const reg3 = NC.createRegistry([{ meta: { id: 'slow', inputs: [], outputs: [{ name: 'v', type: 'x' }] }, compute: async (i, p) => { live++; maxLive = Math.max(maxLive, live); await new Promise(r => setTimeout(r, 10)); live--; return { v: p.v }; } }]);
const m3 = NC.createModel(); const sl = NC.addNode(m3, { type: 'slow', params: { v: 1 } });
const eng3 = NC.createEngine({ registry: reg3 });
const r1 = eng3.run(m3); sl.params.v = 2; eng3.touch(sl.id); const r2 = eng3.run(m3); sl.params.v = 3; eng3.touch(sl.id); eng3.run(m3);
await r1; await r2; await new Promise(r => setTimeout(r, 50));
ok(maxLive === 1, 'never two runs at once');
ok(eng3.get(sl.id).value.v === 3, 'the queued run used the latest model');

// remove a node: only its wires go
const edgesBefore = m.edges.length;
NC.removeNode(m, b.id);
ok(NC.findNode(m, s.id) && NC.findNode(m, sm.id), 'neighbours kept');
ok(m.edges.length === edgesBefore - 2, 'only its 2 wires removed');
await eng.run(m);
ok(eng.get(s.id).value.n === 2 && eng.get(b.id) === undefined, 'recomputed without it; entry forgotten');

// history with meta
const h = NC.createHistory();
const hm = NC.createModel(); NC.addNode(hm, { type: 'num' }); h.push(hm, { sel: ['x'] });
NC.addNode(hm, { type: 'num' }); h.push(hm, { sel: ['y'] });
h.push(hm, { sel: ['z'] });   // no-op change: no new step
ok(h.canUndo() && !h.canRedo(), 'history flags');
const u = h.undo(); ok(u.model.nodes.length === 1 && u.meta.sel[0] === 'x', 'undo returns model + meta');
const r = h.redo(); ok(r.model.nodes.length === 2 && r.meta.sel[0] === 'z', 'redo; no-op push updated meta');

console.log(`nodeCanvas: ${fails.length ? 'FAIL' : 'PASS'} — ${n - fails.length}/${n}`);
fails.forEach(f => console.log('  ✗ ' + f));
process.exit(fails.length ? 1 : 0);
