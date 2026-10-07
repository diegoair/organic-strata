#!/usr/bin/env node
// Rhizome on the shared node canvas (Organica.nodeCanvas), in the real page.
// Usage: scripts/test-rhizome.sh
// Checks: every node type is named in words (type, params, ports); a native graph computes through the three
// adapters (grid → image, grid → SVG, SVG → points); a Tier-2 bridge (Warping, a hidden iframe) answers; Merge's
// input count rebuilds its card and drops the wire to a port that is gone, and undo brings both back; a wire that
// no adapter can carry is refused; a graph saved before Oct 2026 (edges by `nodeId`) opens and computes; the node
// search, opened from a wire, lists only what connects and adds the node wired; the node bar lists its group.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome();
const ok = await P.goto('/rhizome/', 'window.__rhizome && window.__rhizome.ctl');
if (!ok) { console.log('Rhizome: FAIL — the page never became ready'); await P.close(1); }
const out = await P.ev(`
  const W = ms => new Promise(r => setTimeout(r, ms));
  const NC = Organica.nodeCanvas, { ctl, registry, engine, migrateModel, openSearch, nodebar } = window.__rhizome;
  const res = {};
  const settle = async () => { for (let i = 0; i < 200; i++) { await W(50); if (!engine.isRunning()) { await W(80); if (!engine.isRunning()) return; } } };
  const st = id => { const e = engine.get(id); return e ? e.state : 'none'; };
  // names in words
  const types = registry.list();
  res.typeCount = types.length;
  const PROPER = new Set(['Genesis', 'Loom', 'Komorebi', 'Warping', 'Camo', 'Turing', 'Membrane', 'Sinew', 'Halide', 'Spore', 'Pollen', 'SVG']);
  const sentence = l => !!l && /^[A-Z]/.test(l) && !/→/.test(l) && l.split(' ').slice(1).every(w => !/^[A-Z]/.test(w) || PROPER.has(w));
  res.named = types.every(t => sentence(t.meta.label) && (t.meta.params || []).every(p => p.label && (!/[A-Z]/.test(p.name) || p.label !== p.name))
    && (t.meta.outputs || []).every(p => p.label) && (typeof t.meta.inputs === 'function' || (t.meta.inputs || []).every(p => p.label)));
  res.groups = Object.keys(registry.byCategory()).sort().join(',');
  // a native graph through the adapters
  const add = (type, x) => ctl.add(type, { x, y: 0 }, null, { name: type + '-t' });
  const g = add('loom-grid-generator', 0), ct = add('contour-trace', 300), mg = add('merge', 600), ex = add('export', 900), sp = add('svg-to-points', 900);
  ctl.connect({ node: g.id, port: 'grid' }, { node: ct.id, port: 'mask' });
  ctl.connect({ node: ct.id, port: 'path' }, { node: mg.id, port: 'in0' });
  ctl.connect({ node: g.id, port: 'grid' }, { node: mg.id, port: 'in1' });
  ctl.connect({ node: mg.id, port: 'svg' }, { node: ex.id, port: 'svg' });
  ctl.connect({ node: mg.id, port: 'svg' }, { node: sp.id, port: 'svg' });
  await settle();
  res.states = [g, ct, mg, ex, sp].map(n => st(n.id)).join(',');
  const v = id => engine.get(id).value._v;
  res.adapters = Array.isArray(v(g.id).cells) && /^<svg/.test(v(ct.id)) && /^<svg/.test(v(mg.id)) && Array.isArray(v(sp.id)) && v(sp.id).length > 0;
  res.exportValue = v(ex.id) === v(mg.id);
  res.previewImg = !!ctl.cardOf(mg.id).querySelector('.rz-preview img');
  // Merge: 2 → 1 input drops the in1 wire and the card's second port; undo brings both back
  const e0 = ctl.model.edges.length;
  ctl.select([mg.id]);
  mg.params.inputCount = 1;
  const slider = [...document.querySelectorAll('#panel .ctrl-row')].find(r => /Inputs/.test(r.textContent)).querySelector('input');
  slider.value = 1; slider.dispatchEvent(new Event('input', { bubbles: true })); slider.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  const ports = () => [...ctl.cardOf(mg.id).querySelectorAll('.nc-port--in .nc-port__label')].map(x => x.textContent).join(',');
  res.mergeShrink = ctl.model.edges.length === e0 - 1 && ports() === 'SVG 1' && st(mg.id) === 'ok';
  ctl.undo(); await settle();
  res.mergeUndo = ctl.model.edges.length === e0 && ports() === 'SVG 1,SVG 2';
  // a wire no adapter carries is refused
  const im = add('image-upload', 0);
  res.refused = !NC.canConnect(ctl.model, registry, { node: im.id, port: 'image' }, { node: mg.id, port: 'in1' }).ok;
  // node search from a wire: only what takes a Grid, and the pick arrives wired
  const before = ctl.model.nodes.length;
  openSearch({ x: 0, y: 400 }, { node: g.id, port: 'grid', dir: 'out' }, { x: 300, y: 300 });
  const box = document.querySelector('.nc-search');
  res.searchList = box ? [...box.querySelectorAll('.nc-search__item span:first-child')].map(x => x.textContent).sort().join(',') : null;
  const merge = box && [...box.querySelectorAll('.nc-search__item')].find(b => /^Merge/.test(b.textContent));
  if (merge) merge.click();
  await settle();
  const added = ctl.model.nodes[ctl.model.nodes.length - 1];
  res.searchAdd = ctl.model.nodes.length === before + 1 && added.type === 'merge' && ctl.model.edges.some(e => e.from.node === g.id && e.to.node === added.id) && /^Merge \\d+$/.test(added.name);
  // node bar
  nodebar.open('Output');
  res.nodebar = [...document.querySelectorAll('#rz-nodebar-panel .nc-nodebar__item')].map(b => b.textContent).join(',');
  nodebar.close();
  // a Tier-2 bridge answers (Warping in a hidden iframe)
  const wp = add('warping-pattern', 0);
  for (let i = 0; i < 60 && st(wp.id) !== 'ok' && st(wp.id) !== 'error'; i++) await W(250);
  res.bridge = st(wp.id) === 'ok' && /^<svg/.test(v(wp.id));
  // a graph saved before Oct 2026
  const legacy = { version: '1.0', nodes: [{ id: 'n-1', type: 'loom-grid-generator', x: 0, y: 0, params: registry.defaults('loom-grid-generator') }, { id: 'n-2', type: 'export', x: 300, y: 0, params: { scale: '2' } }],
    edges: [{ id: 'e-1', from: { nodeId: 'n-1', port: 'grid' }, to: { nodeId: 'n-2', port: 'svg' } }] };
  ctl.setModel(migrateModel(legacy)); await settle();
  res.legacy = ctl.model.edges[0].from.node === 'n-1' && st('n-2') === 'ok' && /^<svg/.test(v('n-2')) && ctl.model.nodes.map(n => n.name).join(',') === 'Loom grid 1,Export 1';
  // the Graph menu (Organica.nodeCanvas.graphMenu): save clears the dot; New graph keeps an unsaved graph as "Untitled n";
  // an entry saved before Oct 2026 (a bare model, edges by nodeId) reopens
  const store = Organica.presetStore('rhizome'), keep = JSON.stringify(store.read()), btn = document.getElementById('btn-rz-graph');
  const dot = () => btn.classList.contains('is-unsaved');
  ctl.add('loom-grid-generator', { x: 0, y: 600 }, null, { name: 'Loom grid 7' }); await settle();
  btn.click(); await W(100);
  const dirty1 = dot();
  document.getElementById('rz-graph-name').value = '__t graph';
  document.getElementById('rz-graph-save').click(); await W(100);
  const clean = !dot() && !!store.read()['__t graph'] && !!store.read()['__t graph'].model;
  ctl.add('merge', { x: 300, y: 600 }, null, { name: 'Merge 7' }); await settle();
  document.getElementById('rz-graph-new').click(); await W(300);
  const untitled = Object.keys(store.read()).filter(n => /^Untitled \\d+$/.test(n));
  const newEmpty = ctl.model.nodes.length === 0;
  const all = store.read(); all['__t legacy'] = legacy; store.write(all);
  btn.click(); await W(100);
  const sel = document.getElementById('rz-graph-saved'); sel.value = '__t legacy'; sel.dispatchEvent(new Event('change')); await settle();
  res.graphMenu = dirty1 && clean && untitled.length >= 1 && newEmpty && ctl.model.edges.length === 1 && st('n-2') === 'ok' && !dot();
  store.write(JSON.parse(keep));
  return res;
`);
const fails = [];
const check = (c, msg) => { if (!c) fails.push(msg); };
check(out.typeCount === 16, `16 node types (got ${out.typeCount})`);
check(out.named, 'every type, param and output has a label in words');
check(out.groups === 'Output,Process,Source', 'node bar groups: ' + out.groups);
check(out.states === 'ok,ok,ok,ok,ok', 'the native graph computes: ' + out.states);
check(out.adapters, 'grid → image, grid → SVG and SVG → points adapters carry the values');
check(out.exportValue, 'Export holds what it exports');
check(out.previewImg, 'an SVG preview is an <img>, not parsed into the page');
check(out.mergeShrink, 'Merge down to one input: its card rebuilds and the orphaned wire goes');
check(out.mergeUndo, 'undo brings back the input and its wire');
check(out.refused, 'a wire no adapter carries is refused');
check(out.searchList === 'Contour trace,Export,Halide dither,Merge,Pollen stipple,SVG to points,Spore stipple', 'search from a Grid wire lists what takes it (grid → image and grid → SVG adapters included): ' + out.searchList);
check(out.searchAdd, 'a node picked from a wire arrives wired and numbered');
check(out.nodebar === 'Export', 'the node bar lists its group: ' + out.nodebar);
check(out.bridge, 'a Tier-2 bridge (Warping) answers through its iframe');
check(out.legacy, 'a graph saved before Oct 2026 (edges by nodeId) opens, is named and computes');
check(out.graphMenu, 'Graph menu: save clears the dot, New graph keeps an unsaved graph as Untitled n, an old saved entry reopens');
check(!P.errors.length, 'page errors: ' + P.errors.join(' | '));
console.log(`Rhizome: ${fails.length ? 'FAIL' : 'PASS'} — ${17 - fails.length}/17 checks`);
fails.forEach(f => console.log('  ✗ ' + f));
await P.close(fails.length ? 1 : 0);
