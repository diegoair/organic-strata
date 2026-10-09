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
  // ── variations (Phase 4; a Variations node since Oct 9, 2026: Figure → Variations) ──
  res.figOnlyItself = eng.get(figs[0].id).value.figure.variations.length === 1;
  const f0 = figs[0], vf0 = NC.addNode(m, { type: 'variations', params: { ...reg.defaults('variations'), variations: 4, varyBy: 'one', seed: 3 } });   // 4 variations made + the Figure = 5 drawings
  NC.addEdge(m, { node: f0.id, port: 'figure' }, { node: vf0.id, port: 'figure' }); await eng.run(m);
  const K = svg => svg.replace(/"exportedAt":"[^"]*"/g, '').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const V = () => eng.get(vf0.id).value.figure.variations.map(v => ({ ...v, svg: K(v.svg) }));
  const v1 = V().map(v => v.svg), lab1 = V().map(v => v.label);
  res.varCount = V().length;
  res.varFirstIsBase = v1[0] === K(eng.get(f0.id).value.figure.svg);
  res.varUnique = new Set(v1).size === v1.length;
  eng.touch(vf0.id); await eng.run(m); res.varDet = JSON.stringify(V().map(v => v.svg)) === JSON.stringify(v1);
  const pinSpec = V()[2].spec, pinSvg = V()[2].svg; vf0.params.pins = [{ ...pinSpec, slot: 2 }]; eng.touch(vf0.id); await eng.run(m);
  res.pinFirst = V()[2].pinned && V()[2].svg === pinSvg;   // a pinned variation stays in its slot
  vf0.params.seed = 4; eng.touch(vf0.id); await eng.run(m);   // New variations
  res.renewKeepsPin = V()[2].pinned && V()[2].svg === pinSvg;
  res.renewChanges = V().slice(2).some(v => !v1.includes(v.svg));
  // New Figure from this: a Figure with the pinned variation fixed draws exactly that variation
  const nf = NC.addNode(m, { type: 'figure', params: { ...JSON.parse(JSON.stringify(f0.params)), fixed: [pinSpec] } });
  NC.edgesInto(m, f0.id).forEach(e => NC.addEdge(m, e.from, { node: nf.id, port: e.to.port }, true));
  await eng.run(m);
  res.fromThis = K(eng.get(nf.id).value.figure.svg) === pinSvg;
  // Keep: with every category kept, 'one change' changes nothing on this figure → only the base remains
  vf0.params.keep = { content: true, palette: true, cells: true, grid: true, transform: true }; vf0.params.pins = []; eng.touch(vf0.id); await eng.run(m);
  res.keepAll = V().length === 1;
  // New Figure from this with Keep set: the fixed spec carries the Keep, so each copy draws the same variation
  const KP = { palette: true, transform: true };
  vf0.params.keep = KP; vf0.params.variations = 3; eng.touch(vf0.id); await eng.run(m);
  const kvs = V().filter(v => v.spec), copies = kvs.map(kv => { const nk = NC.addNode(m, { type: 'figure', params: { ...JSON.parse(JSON.stringify(f0.params)), fixed: [{ ...kv.spec, keep: KP }] } }); NC.edgesInto(m, f0.id).forEach(e => NC.addEdge(m, e.from, { node: nk.id, port: e.to.port }, true)); return nk; });
  await eng.run(m);
  res.fromThisKeep = kvs.length > 0 && kvs.every((kv, i) => K(eng.get(copies[i].id).value.figure.svg) === kv.svg);
  copies.forEach(c => NC.removeNode(m, c.id));
  vf0.params.keep = {}; vf0.params.variations = 3; eng.touch(vf0.id); await eng.run(m);
  // ── Sets (Phase 4b): one group per item; Fan out off = items mixed; cap ──
  const sn = NC.addNode(m, { type: 'set', params: { items: [{ kind: 'element', name: 'Test element', snapshot: el }, { kind: 'component', name: 'Test component', snapshot: compEntry }] } });
  const fs0 = NC.addNode(m, { type: 'figure', params: reg.defaults('figure') }), fs = NC.addNode(m, { type: 'variations', params: { ...reg.defaults('variations'), variations: 2 } });
  NC.addEdge(m, { node: fs0.id, port: 'figure' }, { node: fs.id, port: 'figure' });
  NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: fs0.id, port: 'canvas' }); NC.addEdge(m, { node: grids[0].id, port: 'grid' }, { node: fs0.id, port: 'grid' });
  NC.addEdge(m, { node: sn.id, port: 'content' }, { node: fs0.id, port: 'content' }, true);
  await eng.run(m);
  const FS = eng.get(fs.id).value.figure;
  res.setGroups = FS.groups ? FS.groups.map(g => g.label + ':' + g.variations.length).join(',') : 'none';
  fs.params.fanOut = false; eng.touch(fs.id); await eng.run(m);
  res.setMixed = !eng.get(fs.id).value.figure.groups && eng.get(fs.id).value.figure.variations.length === 3;
  fs.params.fanOut = true; fs.params.variations = 11; sn.params.items = Array.from({ length: 6 }, (_, i) => ({ kind: 'element', name: 'E' + i, snapshot: el })); eng.touch(sn.id); eng.touch(fs.id); await eng.run(m);
  const C = eng.get(fs.id).value.figure; res.setCap = C.variations.length <= F('FIGURE_RENDER_CAP') && C.groups.length === 6 && !!C.capped;
  // the same item twice = two groups with their own keys; a pin belongs to its item
  sn.params.items = [{ kind: 'element', name: 'Twice', snapshot: el }, { kind: 'element', name: 'Twice', snapshot: el }]; fs.params.variations = 2; eng.touch(sn.id); eng.touch(fs.id); await eng.run(m);
  const T = eng.get(fs.id).value.figure, keys = T.variations.map(v => v.key);
  res.setTwice = T.groups.length === 2 && new Set(keys).size === keys.length;
  const v1g = T.groups[1].variations[1]; fs.params.pins = [{ ...v1g.spec, slot: 1, item: v1g.item }]; eng.touch(fs.id); await eng.run(m);
  const P = eng.get(fs.id).value.figure; res.pinPerItem = P.groups[1].variations[1].pinned && !P.groups[0].variations.some(v => v.pinned);
  // a reordered Set: the pin follows its item by name (its old place:name key is gone)
  sn.params.items = [{ kind: 'element', name: 'Alpha', snapshot: el }, { kind: 'component', name: 'Beta', snapshot: compEntry }]; fs.params.pins = []; eng.touch(sn.id); eng.touch(fs.id); await eng.run(m);
  const vb = eng.get(fs.id).value.figure.groups[1].variations[1]; fs.params.pins = [{ ...vb.spec, slot: 1, item: vb.item }];
  sn.params.items = sn.params.items.slice().reverse(); eng.touch(sn.id); eng.touch(fs.id); await eng.run(m);
  const R = eng.get(fs.id).value.figure; res.pinFollowsItem = R.groups[0].label === 'Beta' && R.groups[0].variations[1].pinned && !R.groups[1].variations.some(v => v.pinned);
  fs.params.pins = [];
  // ── Composition (Phase 5) ──
  const fc = NC.addNode(m, { type: 'figure', params: reg.defaults('figure') }), vfc = NC.addNode(m, { type: 'variations', params: { ...reg.defaults('variations'), variations: 2 } });
  NC.addEdge(m, { node: fc.id, port: 'figure' }, { node: vfc.id, port: 'figure' });
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
  res.composeAllVariations = eng.get(vfc.id).value.figure.variations.length === 3 && eng.get(vfc.id).value.figure.variations.slice(1).every(v => (K(v.svg).match(/data-cell-index/g) || []).length <= FC0.cells - 2 + 12);
  co.params.rules.push({ when: { index: [999] }, do: { content: 'empty' } }); eng.touch(co.id); await eng.run(m);
  res.composeLost = JSON.stringify(eng.get(fc.id).value.figure.lost) === JSON.stringify([{ rule: 3, cells: [999], none: true }]);
  // a colour region rule names an ink by its place: it follows the Palette
  NC.addEdge(m, { node: pal.id, port: 'palette' }, { node: fc.id, port: 'palette' }); co.params.rules = [{ when: { index: [0] }, do: { ink: 1 } }]; eng.touch(co.id); await eng.run(m);
  const inkA = K(eng.get(fc.id).value.figure.svg), oldColors = pal.params.colors.slice();
  pal.params.colors = pal.params.colors.map((c, i) => i === 1 ? '#00aa55' : c); eng.touch(pal.id); await eng.run(m);
  res.inkFollowsPalette = oldColors.length > 1 && /#00aa55/i.test(K(eng.get(fc.id).value.figure.svg)) && K(eng.get(fc.id).value.figure.svg) !== inkA;
  pal.params.colors = oldColors; eng.touch(pal.id); NC.edgesInto(m, fc.id).filter(e => e.to.port === 'palette').forEach(e => NC.removeEdge(m, e.id)); co.params.rules = []; eng.touch(co.id); eng.touch(fc.id); await eng.run(m);
  // ── region rules (Phase 5b): Symbol rule, Arrange, Pattern — only in their region ──
  const cellG = (svg, i) => { const d = new DOMParser().parseFromString(svg, 'image/svg+xml'); const g = d.querySelector('[data-cell-index="' + i + '"]'); return g ? g.innerHTML : null; };
  co.params.rules = []; eng.touch(co.id); await eng.run(m); const base5 = K(eng.get(fc.id).value.figure.svg);
  co.params.rules = [{ when: { row: [1] }, do: { symbolRule: { name: 'checkerboard', params: { rotA: 0, swap: false, rotB: 90, flip: false }, seed: 7 } } }]; eng.touch(co.id); await eng.run(m);
  const sr = K(eng.get(fc.id).value.figure.svg);
  res.symRule = sr !== base5 && cellG(sr, 0) === cellG(base5, 0) && cellG(sr, 6) !== cellG(base5, 6) && cellG(sr, 7) === cellG(base5, 7);   // row 0 untouched; row 1: the odd cell turned, the even one not
  eng.touch(co.id); await eng.run(m); res.symRuleDet = K(eng.get(fc.id).value.figure.svg) === sr;
  co.params.rules = [{ when: {}, do: { arrange: { rule: 'checker', pool: [{ kind: 'element', name: 'Test element', entry: el }, { kind: 'component', name: 'Test component', entry: compEntry }], seed: 3 } } }]; eng.touch(co.id); await eng.run(m);
  const ar = K(eng.get(fc.id).value.figure.svg); res.arrange = ar !== base5;
  co.params.rules = [{ when: { col: [0] }, do: { pattern: { patType: 'crosshatch', patSpacing: 8, patWeight: 2, patAngle: 45 } } }]; eng.touch(co.id); await eng.run(m);
  const pt = K(eng.get(fc.id).value.figure.svg); res.pattern = pt !== base5 && cellG(pt, 1) === cellG(base5, 1) && cellG(pt, 0) !== cellG(base5, 0);
  // Compose = Symbol's Cell properties: a cell rule (Fit, Padding …) only in its region; padding null = back to none
  co.params.rules = [{ when: { col: [0] }, do: { cell: { fitMode: 'fixed', fixedSize: 40, padding: 0.2 } } }]; eng.touch(co.id); await eng.run(m);
  const cp = K(eng.get(fc.id).value.figure.svg); res.cellProps = cp !== base5 && cellG(cp, 1) === cellG(base5, 1) && cellG(cp, 0) !== cellG(base5, 0);
  co.params.rules = [{ when: { col: [0] }, do: { cell: { padding: null } } }]; eng.touch(co.id); await eng.run(m);
  res.cellPropsNull = K(eng.get(fc.id).value.figure.svg) === base5;
  // ── Compose review fixes: cells by grid address, Palette colours on dropped Components, a live Arrange pool ──
  const idxAt = (r, c) => { const x = eng.get(fc.id).value.figure.compose.ctxs.find(q => q.row === r && q.col === c); return x ? x.index : -1; };
  const cellsOf = () => K(eng.get(fc.id).value.figure.svg).match(/data-cell-index="(\\d+)"/g).map(x => +x.match(/\\d+/)[0]);
  co.params.rules = [{ when: { at: [[1, 2]] }, do: { content: 'empty' } }]; eng.touch(co.id); await eng.run(m);
  const i6 = idxAt(1, 2), gone6 = !cellsOf().includes(i6) && cellsOf().length === FC0.cells - 1;
  const cols0 = grids[0].params.params.cols; grids[0].params.params.cols = cols0 + 2; eng.touch(grids[0].id); await eng.run(m);
  const i8 = idxAt(1, 2); res.composeAddress = gone6 && i8 !== i6 && !cellsOf().includes(i8) && cellsOf().includes(i6) && !eng.get(fc.id).value.figure.lost.length;
  co.params.rules.push({ when: { at: [[1, 99]] }, do: { content: 'empty' } }); eng.touch(co.id); await eng.run(m);
  res.composeLostAt = JSON.stringify(eng.get(fc.id).value.figure.lost) === JSON.stringify([{ rule: 1, cells: [[1, 99]], none: true }]);
  grids[0].params.params.cols = cols0; eng.touch(grids[0].id);
  NC.addEdge(m, { node: pal.id, port: 'palette' }, { node: fc.id, port: 'palette' });
  co.params.rules = [{ when: { at: [[0, 0]] }, do: { content: { kind: 'component', name: 'Test component', entry: compEntry } } }]; eng.touch(co.id); await eng.run(m);
  const pInks = eng.get(fc.id).value.figure.colors, dropped = cellG(eng.get(fc.id).value.figure.svg, idxAt(0, 0)) || '';
  res.composePaletteComp = pInks.length > 1 && pInks.some(h => dropped.toLowerCase().includes(h.toLowerCase()));
  NC.addEdge(m, { node: cn.id, port: 'content' }, { node: fc.id, port: 'content' }, true);
  co.params.rules = []; eng.touch(co.id); await eng.run(m); const mixed = K(eng.get(fc.id).value.figure.svg);
  co.params.rules = [{ when: {}, do: { arrange: { rule: 'checker', live: true, pool: [], seed: 1 } } }]; eng.touch(co.id); await eng.run(m);
  res.composeLiveArrange = eng.get(fc.id).state === 'ok' && K(eng.get(fc.id).value.figure.svg) !== mixed;
  co.params.rules = []; eng.touch(co.id); await eng.run(m);
  // ── Export (Phase 6): the plan, and files encoded as they would download ──
  const figsIn = [{ name: 'Figure A', figure: eng.get(figs[4].id).value.figure }];   // figure 4 has a 3-ink Palette
  const plan1 = F('exportPlan')(figsIn, { which: 'all', formats: { svg: true, png: true, plates: true }, scales: [1, 2] });
  const nv = figsIn[0].figure.variations.length, inks = figsIn[0].figure.colors.length;
  res.expCount = plan1.length === nv * (1 + 2 + inks);
  res.expBase = F('exportPlan')(figsIn, { which: 'base', formats: { svg: true } }).length === 1;
  res.expPinned = F('exportPlan')(figsIn, { which: 'pinned', formats: { svg: true } }).length === figsIn[0].figure.variations.filter(v => v.pinned).length;
  const png2 = plan1.find(f => f.format === 'png' && f.scale === 2), blob2 = await F('encodeFile')(png2);
  const dims = async b => { const bm = await createImageBitmap(b); return [bm.width, bm.height]; };
  const wm = png2.svg.match(/^<svg[^>]*\\swidth="([\\d.]+)"/), W0 = wm ? +wm[1] : 1000;
  res.expPng2x = (await dims(blob2))[0] === Math.round(W0 * 2);
  const plate = plan1.find(f => f.plate === 1), pb = await F('encodeFile')(plate), ptxt = await pb.text();
  res.expPlate = !ptxt.includes(figsIn[0].figure.colors[0]) && ptxt.includes('#000000');
  // a Print Canvas: mm size + bleed + crop marks; PNG at its DPI with the DPI written in
  cv.params.mode = 'print'; cv.params.preset = 'A4 portrait'; cv.params.dpi = 150; cv.params.bleed = 3; eng.touch(cv.id); await eng.run(m);
  const pf = [{ name: 'Figure A', figure: eng.get(figs[4].id).value.figure }];
  const pplan = F('exportPlan')(pf, { which: 'base', formats: { svg: true, png: true } });
  const psvg = await (await F('encodeFile')(pplan.find(f => f.format === 'svg'))).text();
  res.expPrintSvg = /width="216mm" height="303mm"/.test(psvg) && psvg.split('<line').length > 4;
  const ppng = await F('encodeFile')(pplan.find(f => f.format === 'png')), pd = await dims(ppng);
  const buf = new Uint8Array(await ppng.arrayBuffer()); let phys = false; for (let i = 0; i < buf.length - 4; i++) if (buf[i] === 0x70 && buf[i + 1] === 0x48 && buf[i + 2] === 0x59 && buf[i + 3] === 0x73) { phys = true; break; }
  res.expPrintPng = Math.abs(pd[0] - Math.round(216 / 25.4 * 150)) <= 1 && phys;
  cv.params.mode = 'screen'; cv.params.preset = 'Landscape 16:9'; eng.touch(cv.id); await eng.run(m);
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
// ── Rules as a chain (Oct 9, 2026): the order is the chain's; a later step wins; nothing silently dropped ──
const ch = await P.ev(`
  const norm = s => s.replace(/"exportedAt":"[^"]*"/g, '"exportedAt":""').replace(/"ruleSource":"[^"]*"/g, '"ruleSource":""').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '').replace(/(id|href|url\\()="?#?[a-z]+-?\\d+/g, '$1');
  const reg = NC.createRegistry(F('figureNodeTypes')());
  const def = Object.values(F('figureCatalog')())[0];
  const entry = F('entrySnapshot')(F('elementEntryFromRecipe')(def.element)); delete entry.recipe;   // a saved Element: the general path
  const R = { rot90: { kind: 'cell-rules', p: { rules: [{ when: {}, do: { rotate: 90 } }] } }, odd: { kind: 'cell-rules', p: { rules: [{ when: { parity: 'odd' }, do: { content: 'empty' } }] } },
    radial: { kind: 'component-rule', p: { rule: 'radial', params: {} } }, pin: { kind: 'component-rule', p: { rule: 'pinwheel', params: {} } },
    chk: { kind: 'component-rule', p: { rule: 'checkerboard', params: { a: 0, b: 90 } } }, chkSwap: { kind: 'component-rule', p: { rule: 'checkerboard', params: { a: 0, b: 90, swap: true } } },
    chkFlip: { kind: 'component-rule', p: { rule: 'checkerboard', params: { a: 0, b: 90, flip: true } } },
    rep: { kind: 'repeat', p: { lattice: 'square', count: 2 } }, t90: { kind: 'transform', p: { rotate: 90, mirror: 'none' } }, t180: { kind: 'transform', p: { rotate: 180, mirror: 'none' } }, tmv: { kind: 'transform', p: { rotate: 0, mirror: 'v' } }, t0: { kind: 'transform', p: { rotate: 0, mirror: 'none' } } };
  const run = async (steps, grid, parallel) => {
    const m = NC.createModel();
    const cv = NC.addNode(m, { type: 'canvas', params: reg.defaults('canvas') });
    const gr = NC.addNode(m, { type: 'grid', params: grid || { gen: 'lattice-square', params: { cols: 2, rows: 2 } } });
    const en = NC.addNode(m, { type: 'element', params: { name: 'E', snapshot: entry } });
    const f = NC.addNode(m, { type: 'figure', params: { ...reg.defaults('figure'), variations: 1 } });
    NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: f.id, port: 'canvas' });
    NC.addEdge(m, { node: gr.id, port: 'grid' }, { node: f.id, port: 'grid' });
    NC.addEdge(m, { node: en.id, port: 'content' }, { node: f.id, port: 'content' }, true);
    let prev = null;
    steps.forEach(k => { const n = NC.addNode(m, { type: R[k].kind, params: { ...reg.defaults(R[k].kind), ...JSON.parse(JSON.stringify(R[k].p)) } });
      if (parallel) m.edges.push({ id: NC.nextId('e'), from: { node: n.id, port: 'rules' }, to: { node: f.id, port: 'rules' } });
      else if (prev) NC.addEdge(m, { node: prev.id, port: 'rules' }, { node: n.id, port: 'rules' });
      prev = n; });
    if (prev && !parallel) NC.addEdge(m, { node: prev.id, port: 'rules' }, { node: f.id, port: 'rules' });
    const mm = parallel ? F('chainRules')(m) : m;
    const eng = NC.createEngine({ registry: reg }); await eng.run(mm);
    const e = eng.get(f.id);
    return { state: e.state, msg: e.message || '', svg: e.state === 'ok' ? norm(e.value.figure.svg) : '', cells: e.state === 'ok' ? e.value.figure.cells : 0, shapes: e.state === 'ok' ? e.value.figure.shapes : 0, rulesIn: mm.edges.filter(w => w.to.node === f.id && w.to.port === 'rules').length };
  };
  const res = {};
  const [cells, comp, compThenCells, cellsThenComp] = await Promise.all([run(['rot90']), run(['radial']), run(['radial', 'rot90']), run(['rot90', 'radial'])]);
  res.allOk = [cells, comp, compThenCells, cellsThenComp].map(x => x.state + (x.msg ? ':' + x.msg : ''));
  res.orderMatters = compThenCells.svg !== cellsThenComp.svg;
  res.laterWinsTurn = compThenCells.svg === cells.svg && cellsThenComp.svg === comp.svg;
  res.poseKeepsEmpty = (await run(['odd', 'radial'])).svg !== comp.svg;   // an empty cell before the pose stays empty
  res.twoComp = (await run(['radial', 'pin'])).svg === (await run(['pin'])).svg;
  // Rotate & mirror with no Repeat before it turns / mirrors the Figure itself (Oct 9, 2026 — it used to stop the Figure)
  const plain = await run([]), tNoRep = await run(['t90']), tBefore = await run(['t90', 'rep']), mNoRep = await run(['tmv']), t0 = await run(['t0']);
  res.tAlone = [tNoRep, tBefore, mNoRep, t0].map(x => x.state + (x.msg ? ':' + x.msg : ''));
  // option A (Diego): the whole Figure turned / flipped in place — the same cells and shapes (no copies), the drawing changed
  res.tNoRep = [tNoRep, tBefore, mNoRep].every(x => x.state === 'ok') && tNoRep.svg !== plain.svg && mNoRep.svg !== plain.svg && mNoRep.svg !== tNoRep.svg && tBefore.svg !== tNoRep.svg && t0.state === 'ok'
    && [tNoRep, mNoRep, t0].every(x => x.cells === plain.cells && x.shapes === plain.shapes) && t0.svg === plain.svg && tNoRep.svg.includes('rotate(90)') && mNoRep.svg.includes('scale(-1 1)');
  res.tAlone.push('cells/shapes ' + [plain, tNoRep, mNoRep, t0].map(x => x.cells + '/' + x.shapes).join(' '));
  res.tAfter = (await run(['rep', 't90'])).state === 'ok';
  res.twoT = (await run(['rep', 't90', 't90'])).svg === (await run(['rep', 't180'])).svg;
  const p33 = await run(['pin'], { gen: 'lattice-square', params: { cols: 3, rows: 3 } }), r33 = await run(['radial'], { gen: 'lattice-square', params: { cols: 3, rows: 3 } });
  const r44 = await run(['radial'], { gen: 'lattice-square', params: { cols: 4, rows: 4 } }), loom = await run(['radial'], { gen: 'rectangular', params: F('gridDefaults')('rectangular') });
  res.big = p33.state === 'ok' && r44.state === 'ok' && /even/.test(r33.msg) && /Square lattice/.test(loom.msg);
  const chk = await run(['chk']);
  res.chkOpts = chk.state === 'ok' && (await run(['chkSwap'])).svg !== chk.svg && (await run(['chkFlip'])).svg !== chk.svg;
  // every rule node added alone to the Figure FVS opens with (default Grid / Palette, an Element) — as from the node bar
  // (Oct 9, 2026: a Rotate & mirror alone stopped the Figure). None may stop it, except a Component rule on a Loom grid,
  // which says why.
  { const one = async kind => { const m = NC.createModel();
      const cv = NC.addNode(m, { type: 'canvas', params: reg.defaults('canvas') }), gr = NC.addNode(m, { type: 'grid', params: reg.defaults('grid') }), pa = NC.addNode(m, { type: 'palette', params: reg.defaults('palette') });
      const en = NC.addNode(m, { type: 'element', params: { name: 'E', snapshot: entry } }), f = NC.addNode(m, { type: 'figure', params: reg.defaults('figure') });
      NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: f.id, port: 'canvas' }); NC.addEdge(m, { node: gr.id, port: 'grid' }, { node: f.id, port: 'grid' });
      NC.addEdge(m, { node: pa.id, port: 'palette' }, { node: f.id, port: 'palette' }); NC.addEdge(m, { node: en.id, port: 'content' }, { node: f.id, port: 'content' }, true);
      if (kind) { const r = NC.addNode(m, { type: kind, params: reg.defaults(kind) }), port = kind === 'composition' ? 'composition' : 'rules'; NC.addEdge(m, { node: r.id, port }, { node: f.id, port }); }
      const eng = NC.createEngine({ registry: reg }); await eng.run(m); const e = eng.get(f.id); return e.state + (e.message ? ':' + e.message : ''); };
    const kinds = ['cell-rules', 'repeat', 'transform', 'composition', 'component-rule'], got = {};
    for (const k of kinds) got[k] = await one(k);
    res.aloneOnDefault = kinds.map(k => k + '=' + got[k]);
    res.aloneOk = kinds.slice(0, 4).every(k => got[k] === 'ok') && /^error:.*Square lattice/.test(got['component-rule']); }
  // a graph saved before chains draws as the old engine did: the first Component rule poses, then the Cell rules, whatever the wire order
  const mig = await run(['rot90', 'radial'], null, true), mig2 = await run(['radial', 'pin'], null, true);
  res.migrated = mig.rulesIn === 1 && mig.svg === compThenCells.svg && mig2.svg === comp.svg;
  // a Figure saved with Variations 3 (before the Variations node): a Variations node takes them, its Export too
  { const m = NC.createModel();
    const cv = NC.addNode(m, { type: 'canvas', params: reg.defaults('canvas') }), gr = NC.addNode(m, { type: 'grid', params: { gen: 'lattice-square', params: { cols: 2, rows: 2 } } });
    const en = NC.addNode(m, { type: 'element', params: { name: 'E', snapshot: entry } });
    const f = NC.addNode(m, { type: 'figure', params: { fit: 'contain', clip: true, variations: 3, varyBy: 'one', seed: 7, keep: {}, pins: [], fanOut: true, layout: 'rows' } });
    const ex = NC.addNode(m, { type: 'export', params: reg.defaults('export') });
    NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: f.id, port: 'canvas' }); NC.addEdge(m, { node: gr.id, port: 'grid' }, { node: f.id, port: 'grid' });
    NC.addEdge(m, { node: en.id, port: 'content' }, { node: f.id, port: 'content' }, true); NC.addEdge(m, { node: f.id, port: 'figure' }, { node: ex.id, port: 'figures' }, true);
    const mm = F('variationsNodes')(m), vn = mm.nodes.find(n => n.type === 'variations');
    const eng = NC.createEngine({ registry: reg }); await eng.run(mm);
    const into = mm.edges.find(e => e.to.node === ex.id);
    res.varMigrated = !!vn && vn.params.variations === 2 && vn.params.seed === 7 && !('variations' in mm.nodes.find(n => n.id === f.id).params) && into && into.from.node === vn.id && eng.get(vn.id).value.figure.variations.length === 3; }
  return res;`, PRE);
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
check(out.figOnlyItself, 'a Figure draws itself only');
check(out.varCount === 5, 'variations: count ' + out.varCount);
check(out.varFirstIsBase, 'variation 1 is the figure as set up');
check(out.varUnique, 'no two variations are the same');
check(out.varDet, 'variations are the same for the same seed');
check(out.pinFirst, 'a pinned variation stays in its slot');
check(out.renewKeepsPin && out.renewChanges, 'New variations keeps the pinned one and changes the others');
check(out.fromThis, 'New Figure from this draws exactly that variation');
check(out.keepAll, 'Keep everything → no variation can change anything');
check(out.fromThisKeep, 'New Figure from this with Keep set draws exactly that variation');
check(out.setGroups === 'Test element:3,Test component:3', 'a Set fans out, one group per item: ' + out.setGroups);
check(out.setMixed, 'Fan out off: the Set items are mixed, one group');
check(out.setCap, 'variations × items stay within the cap');
check(out.setTwice, 'the same item twice in a Set: two groups, distinct keys');
check(out.pinPerItem, 'a pin in a fan-out belongs to its item only');
check(out.pinFollowsItem, 'a pin follows its item when the Set is reordered');
check(out.inkFollowsPalette, 'a colour region rule follows the Palette (ink by place)');
check(out.composeInfo, 'a Figure tells Compose its cells (classes, outlines, the base SVG)');
check(out.composeEmptySame, 'an empty Composition changes nothing');
check(out.composePlaced, 'a placement drops content into a cell');
check(out.composeRow, 'a row rule empties a row');
check(out.composeOff, 'a switched-off region rule does nothing');
check(out.composeToggle, 'toggle empties filled cells');
check(out.composeAllVariations, 'a Composition reaches the variations too');
check(out.composeLost, 'a placement on a cell the grid does not have is reported');
check(out.composeAddress, 'a cell picked by row / column is the same cell after the Grid gains columns');
check(out.composeLostAt, 'an address past the grid is reported, with its rule');
check(out.composePaletteComp, 'a Component dropped in a cell takes the Palette colours');
check(out.composeLiveArrange, 'a live Arrange lays out the content feeding the Figure');
check(out.cellProps, 'a Cell properties region rule (Fit, Size, Padding) changes only its region');
check(out.cellPropsNull, 'a Cell properties field set to null leaves the cell as it was');
check(out.symRule, 'a Symbol rule turns its region only');
check(out.symRuleDet, 'a Symbol rule is the same for the same seed');
check(out.arrange, 'Arrange gives the region content from its pool');
check(out.pattern, 'a Pattern fill changes its region only');
check(out.expCount, 'export plan: variations × (SVG + 2 PNG sizes + one plate per ink)');
check(out.expBase && out.expPinned, 'export plan: As set up only / Pinned only');
check(out.expPng2x, 'a ×2 PNG is twice the figure size');
check(out.expPlate, 'a plate keeps one ink, in black');
check(out.expPrintSvg, 'a Print Canvas exports at its size in mm with bleed and crop marks');
check(out.expPrintPng, 'a Print PNG is at the Canvas DPI, with the DPI written in');
check(out.libUntouched, 'the real library was never written');
check(ch.allOk.every(x => x === 'ok'), 'rule chains draw: ' + ch.allOk.join(' | '));
check(ch.orderMatters, 'rules: the chain order changes the drawing');
check(ch.laterWinsTurn, 'rules: a later step wins on the turn it sets (Cell rules after / before a Component rule)');
check(ch.poseKeepsEmpty, 'rules: an empty cell from a rule before the pose stays empty');
check(ch.twoComp, 'rules: two Component rules — the later one poses');
check(ch.tNoRep, 'rules: Rotate & mirror with no Repeat before it turns / flips the whole Figure in place, no copies (alone, before a Repeat, mirror, 0°): ' + ch.tAlone.join(' | '));
check(ch.aloneOk, 'rules: each rule alone on the default Figure draws (a Component rule on a Loom grid says why): ' + ch.aloneOnDefault.join(' | '));
check(ch.tAfter, 'rules: Rotate & mirror after a Repeat draws');
check(ch.twoT, 'rules: two Rotate & mirror add up (90° + 90° = 180°)');
check(ch.big, 'rules: a Component rule on 3 × 3 / 4 × 4; Radial refuses odd sizes; a Loom grid is refused with a reason');
check(ch.chkOpts, 'rules: Checkerboard Swap A and B / Flip B change the drawing');
check(ch.migrated, 'rules: a graph saved with parallel rule wires becomes one chain, drawing as before');
check(ch.varMigrated, 'a Figure saved with variations gets a Variations node with its settings, and its Export');
check(out.after, 'FVS state unchanged by graph runs');
check(!P.errors.length, 'page errors: ' + P.errors.join(' | '));
console.log(`Figure graph: ${fails.length ? 'FAIL' : 'PASS'} — ${Object.keys(imp).length - impBad.length}/${Object.keys(imp).length} built-ins identical as graphs · 5 figures + 1 waiting, first run ${out.ms} ms, cells ${out.cells.join('/')}`);
fails.forEach(f => console.log('  ✗ ' + f));
await P.close(fails.length ? 1 : 0);
