#!/usr/bin/env node
// FVS Figure graph — the node types (fvs/js/engine/17-figure-nodes.js) on Organica.nodeCanvas's engine, in the real page.
// Usage: scripts/test-figure-graph.sh
// Builds Canvas · Grid · Palette · a saved Element · a saved Component → Figure nodes and checks: a Figure renders
// (SVG, one cell per grid cell, the Canvas's own size); five Figures sharing one Canvas all update when it changes, and
// only they recompute; a Figure without content waits ("Connect …"); a deleted library entry still draws from its
// copy; the Palette recolours; the run leaves FVS's own state untouched. docs/FVS.md §12.
import fs from 'node:fs';
import path from 'node:path';
import { openChrome, ROOT } from './lib/chrome-page.mjs';
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'fvs', '_figure-eval-baseline.json'), 'utf8')).hashes;

const P = await openChrome();
const ok = await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
if (!ok) { console.log('Figure graph: FAIL — FVS never became ready'); await P.close(1); }
const PRE = `const F = n => window.__fvs[n]; const NC = Organica.nodeCanvas;`;
const out = await P.ev(`
  await F('loadFigureTier')();
  const res = {};
  // a saved Element (the Element as FVS opens) and a saved Component (the first starter Component)
  F('setTier')('component'); await new Promise(r => setTimeout(r, 300));
  const el = F('entrySnapshot')({ seed: F('seedForSnapshot')(), appearance: F('appearanceSnapshot')(), colors: F('state').colors.slice(), paperColor: '#ffffff' });
  const compEntry = F('entrySnapshot')(F('buildLibraryEntry')());
  F('setTier')('element');
  const before = JSON.stringify(F('state').colors) + F('state').activeTier;
  const reg = NC.createRegistry(F('figureNodeTypes')());
  const m = NC.createModel();
  const cv = NC.addNode(m, { type: 'canvas', params: reg.defaults('canvas') });
  const grids = [], figs = [];
  const gens = ['rectangular', 'hexagonal', 'triangular', 'bento', 'circular'];
  gens.forEach(g => grids.push(NC.addNode(m, { type: 'grid', params: { gen: g, params: F('gridDefaults')(g) } })));
  const pal = NC.addNode(m, { type: 'palette', params: reg.defaults('palette') });
  const en = NC.addNode(m, { type: 'element', params: { name: 'Test element', snapshot: el } });
  const cn = NC.addNode(m, { type: 'component', params: { name: 'Test component', snapshot: compEntry } });
  gens.forEach((g, i) => {
    const f = NC.addNode(m, { type: 'figure', params: reg.defaults('figure') }); figs.push(f);
    NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: f.id, port: 'canvas' });
    NC.addEdge(m, { node: grids[i].id, port: 'grid' }, { node: f.id, port: 'grid' });
    NC.addEdge(m, { node: en.id, port: 'content' }, { node: f.id, port: 'content' }, true);
    if (i % 2) NC.addEdge(m, { node: cn.id, port: 'content' }, { node: f.id, port: 'content' }, true);
    if (i === 4 || i === 3) NC.addEdge(m, { node: pal.id, port: 'palette' }, { node: f.id, port: 'palette' });
  });
  const lonely = NC.addNode(m, { type: 'figure', params: reg.defaults('figure') });
  NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: lonely.id, port: 'canvas' });
  NC.addEdge(m, { node: grids[0].id, port: 'grid' }, { node: lonely.id, port: 'grid' });
  const eng = NC.createEngine({ registry: reg });
  const t0 = performance.now(); await eng.run(m); res.ms = Math.round(performance.now() - t0);
  res.states = figs.map(f => eng.get(f.id).state + (eng.get(f.id).message ? ':' + eng.get(f.id).message : ''));
  if (!figs.every(f => eng.get(f.id).state === 'ok')) return { early: true, states: res.states, err: figs.map(f => { const e = eng.get(f.id).error; return e && e.stack ? e.stack.split(String.fromCharCode(10)).slice(0, 4).join(' / ') : ''; }) };
  const v0 = figs.map(f => eng.get(f.id).value.figure);
  res.cells = v0.map(v => v.cells);
  res.svgOk = v0.map(v => v.svg.startsWith('<svg') && v.svg.length > 500);
  res.size = v0.map(v => (v.svg.match(/viewBox="([^"]+)"/) || [])[1]);
  res.lonely = eng.get(lonely.id).state + ':' + eng.get(lonely.id).message;
  res.palDiffers = v0[4].svg.includes('#e85d3a') || v0[4].svg.includes('#2f6fb0');
  res.palComp = v0[3].svg.includes('#e85d3a') || v0[3].svg.includes('#2f6fb0') || v0[3].svg.includes('#1a1a1a');   // figure 3 has a Component: the Palette reaches it
  figs[3].params.keepOwn = true; eng.touch(figs[3].id); await eng.run(m);
  res.keepOwn = !eng.get(figs[3].id).value.figure.svg.includes('#e85d3a');
  // change the shared Canvas → all 5 Figures (and only they, plus the Canvas) recompute
  const vers = figs.map(f => eng.get(f.id).ver), gver = grids.map(g => eng.get(g.id).ver), ever = eng.get(en.id).ver;
  cv.params.preset = 'Landscape 16:9'; eng.touch(cv.id);
  await eng.run(m);
  res.allUpdated = figs.every((f, i) => eng.get(f.id).ver === vers[i] + 1);
  res.othersUntouched = grids.every((g, i) => eng.get(g.id).ver === gver[i]) && eng.get(en.id).ver === ever;
  res.size2 = (eng.get(figs[0].id).value.figure.svg.match(/viewBox="([^"]+)"/) || [])[1];
  // a deleted library entry still draws (the node keeps a copy) — nothing in the real library was ever written
  // ── variations (Phase 4) ──
  const f0 = figs[0]; f0.params.variations = 5; f0.params.varyBy = 'one'; f0.params.seed = 3; eng.touch(f0.id); await eng.run(m);
  const K = svg => svg.replace(/"exportedAt":"[^"]*"/g, '').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const V = () => eng.get(f0.id).value.figure.variations.map(v => ({ ...v, svg: K(v.svg) }));
  const v1 = V().map(v => v.svg), lab1 = V().map(v => v.label);
  res.varCount = V().length;
  res.varFirstIsBase = v1[0] === K(eng.get(f0.id).value.figure.svg);
  res.varUnique = new Set(v1).size === v1.length;
  eng.touch(f0.id); await eng.run(m); res.varDet = JSON.stringify(V().map(v => v.svg)) === JSON.stringify(v1);
  const pinSpec = V()[2].spec, pinSvg = V()[2].svg; f0.params.pins = [pinSpec]; eng.touch(f0.id); await eng.run(m);
  res.pinFirst = V()[1].pinned && V()[1].svg === pinSvg;
  f0.params.seed = 4; eng.touch(f0.id); await eng.run(m);   // New variations
  res.renewKeepsPin = V()[1].pinned && V()[1].svg === pinSvg;
  res.renewChanges = V().slice(2).some(v => !v1.includes(v.svg));
  // New Figure from this: a Figure with the pinned variation fixed draws exactly that variation
  const nf = NC.addNode(m, { type: 'figure', params: { ...JSON.parse(JSON.stringify(f0.params)), fixed: [pinSpec], pins: [], variations: 1 } });
  NC.edgesInto(m, f0.id).forEach(e => NC.addEdge(m, e.from, { node: nf.id, port: e.to.port }, true));
  await eng.run(m);
  res.fromThis = K(eng.get(nf.id).value.figure.svg) === pinSvg;
  // Keep: with every category kept, 'one change' changes nothing on this figure → only the base remains
  f0.params.keep = { content: true, palette: true, cells: true, grid: true, transform: true }; f0.params.pins = []; eng.touch(f0.id); await eng.run(m);
  res.keepAll = V().length === 1;
  f0.params.keep = {}; f0.params.variations = 4; eng.touch(f0.id); await eng.run(m);
  // ── Sets (Phase 4b): one group per item; Fan out off = items mixed; cap ──
  const sn = NC.addNode(m, { type: 'set', params: { items: [{ kind: 'element', name: 'Test element', snapshot: el }, { kind: 'component', name: 'Test component', snapshot: compEntry }] } });
  const fs = NC.addNode(m, { type: 'figure', params: { ...reg.defaults('figure'), variations: 3 } });
  NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: fs.id, port: 'canvas' }); NC.addEdge(m, { node: grids[0].id, port: 'grid' }, { node: fs.id, port: 'grid' });
  NC.addEdge(m, { node: sn.id, port: 'content' }, { node: fs.id, port: 'content' }, true);
  await eng.run(m);
  const FS = eng.get(fs.id).value.figure;
  res.setGroups = FS.groups ? FS.groups.map(g => g.label + ':' + g.variations.length).join(',') : 'none';
  fs.params.fanOut = false; eng.touch(fs.id); await eng.run(m);
  res.setMixed = !eng.get(fs.id).value.figure.groups && eng.get(fs.id).value.figure.variations.length === 3;
  fs.params.fanOut = true; fs.params.variations = 12; sn.params.items = Array.from({ length: 6 }, (_, i) => ({ kind: 'element', name: 'E' + i, snapshot: el })); eng.touch(sn.id); eng.touch(fs.id); await eng.run(m);
  const C = eng.get(fs.id).value.figure; res.setCap = C.variations.length <= F('FIGURE_RENDER_CAP') && C.groups.length === 6 && !!C.capped;
  // ── Composition (Phase 5) ──
  const fc = NC.addNode(m, { type: 'figure', params: { ...reg.defaults('figure'), variations: 3 } });
  NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: fc.id, port: 'canvas' }); NC.addEdge(m, { node: grids[0].id, port: 'grid' }, { node: fc.id, port: 'grid' });
  NC.addEdge(m, { node: en.id, port: 'content' }, { node: fc.id, port: 'content' }, true);
  await eng.run(m);
  const plain = K(eng.get(fc.id).value.figure.svg), FC0 = eng.get(fc.id).value.figure;
  res.composeInfo = !!(FC0.compose && FC0.compose.ctxs.length === FC0.cells && FC0.compose.outlines.length === FC0.cells && FC0.base.startsWith('<svg'));
  const co = NC.addNode(m, { type: 'composition', params: { rules: [] } });
  NC.addEdge(m, { node: co.id, port: 'composition' }, { node: fc.id, port: 'composition' });
  await eng.run(m); res.composeEmptySame = K(eng.get(fc.id).value.figure.svg) === plain;
  co.params.rules = [{ when: { index: [0] }, do: { content: { kind: 'component', name: 'Test component', entry: compEntry } } }]; eng.touch(co.id); await eng.run(m);
  const placed = K(eng.get(fc.id).value.figure.svg); res.composePlaced = placed !== plain;
  co.params.rules.push({ when: { row: [0] }, do: { content: 'empty' } }); eng.touch(co.id); await eng.run(m);
  const rowEmpty = K(eng.get(fc.id).value.figure.svg); res.composeRow = rowEmpty !== placed && (rowEmpty.match(/data-cell-index/g) || []).length === FC0.cells - 6;
  co.params.rules[1].off = true; eng.touch(co.id); await eng.run(m); res.composeOff = K(eng.get(fc.id).value.figure.svg) === placed;
  co.params.rules.push({ when: { index: [1, 2] }, do: { toggle: true } }); eng.touch(co.id); await eng.run(m);
  res.composeToggle = (K(eng.get(fc.id).value.figure.svg).match(/data-cell-index/g) || []).length === FC0.cells - 2;
  res.composeAllVariations = eng.get(fc.id).value.figure.variations.slice(1).every(v => (K(v.svg).match(/data-cell-index/g) || []).length <= FC0.cells - 2 + 12);
  co.params.rules.push({ when: { index: [999] }, do: { content: 'empty' } }); eng.touch(co.id); await eng.run(m);
  res.composeLost = JSON.stringify(eng.get(fc.id).value.figure.lost) === '[999]';
  res.libUntouched = !F('ELEMENT_LIB').read()['Test element'] && !F('LIBRARY').read()['Test component'];
  res.after = JSON.stringify(F('state').colors) + F('state').activeTier === before;
  return res;`, PRE);
if (out.early) { console.log('Figure graph: FAIL —', JSON.stringify(out, null, 1)); await P.close(1); }
// Every built-in Figure, imported as a graph, draws exactly its recipe (the same hash as fvs/_figure-eval-baseline.json).
const imp = await P.ev(`
  const H = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const norm = s => s.replace(/"exportedAt":"[^"]*"/g, '"exportedAt":""').replace(/"ruleSource":"[^"]*"/g, '"ruleSource":""').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const reg = NC.createRegistry(F('figureNodeTypes')());
  const out = {};
  for (const [name, def] of Object.entries(F('figureCatalog')())) {
    const entry = F('entrySnapshot')(F('elementEntryFromRecipe')(def.element));
    const g = F('graphFromRecipe')(def, 'Imported element');
    const m = NC.createModel(), ids = {};
    g.nodes.forEach(n => { const node = NC.addNode(m, { type: n.type, params: { ...reg.defaults(n.type), ...n.params }, name: n.name }); ids[n.ref] = node.id; if (n.type === 'element') node.params.snapshot = entry; });
    g.edges.forEach(([a, ap, b, bp]) => NC.addEdge(m, { node: ids[a], port: ap }, { node: ids[b], port: bp }, true));
    const eng = NC.createEngine({ registry: reg }); await eng.run(m);
    const e = eng.get(ids.figure);
    out[name] = e.state === 'ok' ? H(norm(e.value.figure.svg)) : 'ERR ' + e.message;
  }
  return out;`, PRE);
const fails = [];
const check = (c, m) => { if (!c) fails.push(m); };
const impBad = Object.entries(imp).filter(([n, h]) => h !== (BASE[n] || {}).final);
check(!impBad.length, `built-ins as graphs: ${impBad.length}/${Object.keys(imp).length} differ: ` + impBad.map(([n, h]) => `${n} (${h} vs ${(BASE[n] || {}).final})`).join('; '));
check(out.states.every(s => s === 'ok'), 'figures ok: ' + out.states.join(' | '));
check(out.svgOk.every(Boolean), 'every figure is an SVG');
check(out.cells.every(n => n > 10), 'cells per figure: ' + out.cells.join(','));
check(out.size.every(s => /1080 1080$/.test(s || '')), 'figure frame = the Canvas (1080×1080): ' + out.size.join(','));
check(/^waiting:Connect a Content/.test(out.lonely), 'a figure with no content waits: ' + out.lonely);
check(out.palDiffers, 'the Palette recolours the figure it feeds');
check(out.palComp, 'the Palette recolours a Component');
check(out.keepOwn, 'Keep own colours leaves the content in its own colours');
check(out.allUpdated, 'changing the shared Canvas updates all 5 figures');
check(out.othersUntouched, 'only the Canvas and its figures recompute');
check(/1920 1080$/.test(out.size2 || ''), 'the new Canvas size reaches the figure: ' + out.size2);
check(out.varCount === 5, 'variations: count ' + out.varCount);
check(out.varFirstIsBase, 'variation 1 is the figure as set up');
check(out.varUnique, 'no two variations are the same');
check(out.varDet, 'variations are the same for the same seed');
check(out.pinFirst, 'a pinned variation comes first after the base');
check(out.renewKeepsPin && out.renewChanges, 'New variations keeps the pinned one and changes the others');
check(out.fromThis, 'New Figure from this draws exactly that variation');
check(out.keepAll, 'Keep everything → no variation can change anything');
check(out.setGroups === 'Test element:3,Test component:3', 'a Set fans out, one group per item: ' + out.setGroups);
check(out.setMixed, 'Fan out off: the Set items are mixed, one group');
check(out.setCap, 'variations × items stay within the cap');
check(out.composeInfo, 'a Figure tells Compose its cells (classes, outlines, the base SVG)');
check(out.composeEmptySame, 'an empty Composition changes nothing');
check(out.composePlaced, 'a placement drops content into a cell');
check(out.composeRow, 'a row rule empties a row');
check(out.composeOff, 'a switched-off region rule does nothing');
check(out.composeToggle, 'toggle empties filled cells');
check(out.composeAllVariations, 'a Composition reaches the variations too');
check(out.composeLost, 'a placement on a cell the grid does not have is reported');
check(out.libUntouched, 'the real library was never written');
check(out.after, 'FVS state unchanged by graph runs');
check(!P.errors.length, 'page errors: ' + P.errors.join(' | '));
console.log(`Figure graph: ${fails.length ? 'FAIL' : 'PASS'} — ${Object.keys(imp).length - impBad.length}/${Object.keys(imp).length} built-ins identical as graphs · 5 figures + 1 waiting, first run ${out.ms} ms, cells ${out.cells.join('/')}`);
fails.forEach(f => console.log('  ✗ ' + f));
await P.close(fails.length ? 1 : 0);
