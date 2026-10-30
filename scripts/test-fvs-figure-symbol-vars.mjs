#!/usr/bin/env node
// FVS Figure ← Symbol: the Variations, the rule nodes and a variation's own inputs (Diego, Oct 30, 2026: "I tried canvas on
// the variation 1 and it doesn't change the symbol. Palette works, but grid no. Check the rule nodes if they work on the
// first mother symbol and on the variations too"). A Symbol built on the Symbol step → its Symbol node snapshot, then an
// engine of its own (Organica.nodeCanvas, never the graph on screen): a Variation's own Canvas changes the page (Screen /
// Print), its own Grid builds the Symbol's grid again with the cells as a repeating motif, both together; each rule node
// (Cell rules · Component rule · Rotate & mirror · Repeat in grid · Composition) changes the Symbol's Figure and every
// variation of it; a rule on one variation changes that one only. engine/17-figure-nodes.js compileFromSymbol.
// Usage: scripts/test-fvs-figure-symbol-vars.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, NC = Organica.nodeCanvas, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  await F.loadFigureTier();
  // a 4 × 4 Symbol of two Components, each turned by its place
  F.setTier('component'); await w(500); set('rg-grid-cols', 2); set('rg-grid-rows', 2); q('btn-generate').click(); await w(800);
  [0, 1].forEach(i => F.quickSaveComponentToLibrary(F.state.components[i].id)); await w(300);
  const names = Object.keys(F.LIBRARY.read());
  F.setTier('symbol'); await w(800); set('sel-symgrid-gen', 'rectangular'); await w(400); set('symgen-cols', 4); set('symgen-rows', 4); await w(700);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, { source: 'component', componentName: names[i % 3 === 0 ? 0 : 1] })); F.renderSymbol(); await w(900);
  document.querySelector('#tier-tabs [data-tier="figure"]').click(); await w(3000);
  const sn0 = F.figureGraphModel().nodes.find(n => n.type === 'symbol');
  if (!sn0) return ['✗ no Symbol node on the Figure step'];
  // an engine of its own: Symbol → Figure → Variations (3, palette Order / Another palette) → its 3 variations
  const reg = NC.createRegistry(F.figureNodeTypes()), m = NC.createModel(), eng = NC.createEngine({ registry: reg });
  const sym = NC.addNode(m, { type: 'symbol', params: JSON.parse(JSON.stringify(sn0.params)) });
  const fig = NC.addNode(m, { type: 'figure', params: { ...reg.defaults('figure'), symbolId: sn0.params.symbolId } });
  NC.addEdge(m, { node: sym.id, port: 'symbol' }, { node: fig.id, port: 'symbol' });
  const vn = NC.addNode(m, { type: 'variations', params: { ...reg.defaults('variations'), seed: 11, vary: { palette: ['order', 'lib'] } } });
  NC.addEdge(m, { node: fig.id, port: 'figure' }, { node: vn.id, port: 'figure' });
  const kids = [1, 2, 3].map(slot => { const k = NC.addNode(m, { type: 'figure-var', params: { ...reg.defaults('figure-var'), parent: vn.id, slot } }); NC.addEdge(m, { node: vn.id, port: 'figure' }, { node: k.id, port: 'from' }, true); return k; });
  const K = svg => svg.replace(/"exportedAt":"[^"]*"/g, '').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const val = n => { const g = eng.get(n.id); return g && g.state === 'ok' ? g.value.figure : null; };
  const why = n => { const g = eng.get(n.id); return g ? g.state + (g.message ? ': ' + g.message : '') : 'none'; };
  const box = f => f ? (f.svg.match(/viewBox="([^"]+)"/) || [])[1] : '';
  const run = async () => { m.nodes.forEach(n => eng.touch(n.id)); await eng.run(m); };
  await run();
  const base = { fig: val(fig) && K(val(fig).svg), kids: kids.map(k => val(k) && K(val(k).svg)), cells: val(fig) && val(fig).cells };
  check('the Symbol’s Figure and its 3 variations draw', base.fig && base.kids.every(Boolean) && base.cells === 16, [why(fig), ...kids.map(why)].join(' | '));
  // ── a variation's own Canvas ──
  const cv = NC.addNode(m, { type: 'canvas', params: { ...reg.defaults('canvas'), preset: 'Landscape 16:9' } });
  NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: kids[0].id, port: 'canvas' }); await run();
  const k0 = val(kids[0]);
  check('a Canvas on Variation 1: its page is the Canvas (Landscape 16:9), the Symbol’s grid built in it, 16 cells', k0 && box(k0) === '0 0 1920 1080' && k0.cells === 16 && k0.canvas && k0.canvas.W === 1920, why(kids[0]) + ' ' + box(k0) + ' ' + (k0 && k0.cells));
  check('…Variation 2, 3 and the Figure stay as they were', K(val(fig).svg) === base.fig && K(val(kids[1]).svg) === base.kids[1] && K(val(kids[2]).svg) === base.kids[2], 'changed');
  check('…the variation’s own change is still made (its palette differs from the Figure’s)', k0 && JSON.stringify(k0.colors) !== JSON.stringify(val(fig).colors) || (k0 && k0.paper !== val(fig).paper), k0 && JSON.stringify(k0.colors));
  cv.params.mode = 'print'; cv.params.preset = 'A4 Portrait'; await run();
  check('…a Print Canvas: the variation carries it (mode, size, bleed) for the Export', val(kids[0]) && val(kids[0]).canvas.mode === 'print' && val(kids[0]).canvas.bleed === 3, why(kids[0]) + ' ' + JSON.stringify(val(kids[0]) && val(kids[0]).canvas));
  // ── a variation's own Grid ──
  const gr = NC.addNode(m, { type: 'grid', params: { gen: 'rectangular', params: { ...F.gridDefaults('rectangular'), cols: 6, rows: 6 } } });
  NC.addEdge(m, { node: gr.id, port: 'grid' }, { node: kids[1].id, port: 'grid' }); await run();
  const k1 = val(kids[1]), lv = k1 && k1.recipe.levels[0];
  const motif = lv && lv.cells.every((c, i) => { const r = Math.floor(i / 6), col = i % 6; return c.componentName === names[((r % 4) * 4 + (col % 4)) % 3 === 0 ? 0 : 1]; });
  check('a Grid on Variation 2 (Rectangular 6 × 6): 36 cells, the Symbol’s cells repeated as a motif', k1 && k1.cells === 36 && motif, why(kids[1]) + ' ' + (k1 && k1.cells) + ' motif ' + motif);
  check('…in the Symbol’s own canvas (1080 × 1080)', box(k1) === '0 0 1080 1080', box(k1));
  gr.params = { gen: 'hexagonal', params: F.gridDefaults('hexagonal') }; await run();
  check('…a Hexagonal Grid: drawn, every cell filled', val(kids[1]) && val(kids[1]).cells > 16 && val(kids[1]).recipe.levels[0].cells.every(c => c.source === 'component'), why(kids[1]));
  gr.params = { gen: 'lattice-square', params: { cols: 3, rows: 3 } }; await run();
  check('…a Square lattice: 9 cells', val(kids[1]) && val(kids[1]).cells === 9, why(kids[1]) + ' ' + (val(kids[1]) && val(kids[1]).cells));
  NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: kids[1].id, port: 'canvas' }); cv.params.mode = 'screen'; cv.params.preset = 'Landscape 16:9';
  gr.params = { gen: 'rectangular', params: { ...F.gridDefaults('rectangular'), cols: 8, rows: 4 } }; await run();
  check('…Canvas and Grid together: 8 × 4 cells on a 16:9 page', val(kids[1]) && val(kids[1]).cells === 32 && box(val(kids[1])) === '0 0 1920 1080', why(kids[1]) + ' ' + box(val(kids[1])));
  [kids[0], kids[1]].forEach(k => m.edges.filter(e => e.to.node === k.id && (e.to.port === 'canvas' || e.to.port === 'grid')).forEach(e => NC.removeEdge ? NC.removeEdge(m, e.id) : m.edges.splice(m.edges.indexOf(e), 1)));
  await run();
  check('wires removed: the variations are as before', kids.every((k, i) => val(k) && K(val(k).svg) === base.kids[i]), kids.map(why).join(' | '));
  // ── the rule nodes, on the Symbol's Figure (the mother) and so on every variation ──
  const RULES = [
    ['Cell rules', 'cell-rules', { rules: [{ when: { parity: 'odd' }, do: { rotate: 90 } }] }],
    ['Component rule', 'component-rule', { rule: 'radial', params: {} }],
    ['Rotate & mirror', 'transform', { ...reg.defaults('transform'), rotate: 45 }],
    ['Rotate & mirror per cell', 'transform', { ...reg.defaults('transform'), perCell: 30 }],
    ['Repeat in grid', 'repeat', { ...reg.defaults('repeat'), count: 2 }],
  ];
  for (const [label, type, params] of RULES) {
    const rn = NC.addNode(m, { type, params: JSON.parse(JSON.stringify(params)) });
    NC.addEdge(m, { node: rn.id, port: 'rules' }, { node: fig.id, port: 'rules' }); await run();
    const f = val(fig), ks = kids.map(val);
    check(label + ' on the Symbol’s Figure: it changes', f && K(f.svg) !== base.fig, why(fig));
    check('…and every variation follows it', ks.every((k, i) => k && K(k.svg) !== base.kids[i]), kids.map(why).join(' | '));
    NC.removeNode(m, rn.id); await run();
  }
  const co = NC.addNode(m, { type: 'composition', params: { rules: [{ when: { index: [0, 5] }, do: { content: 'empty' } }] } });
  NC.addEdge(m, { node: co.id, port: 'composition' }, { node: fig.id, port: 'composition' }); await run();
  check('Composition on the Symbol’s Figure: it changes, every variation follows', val(fig) && K(val(fig).svg) !== base.fig && kids.every((k, i) => val(k) && K(val(k).svg) !== base.kids[i]), [why(fig), ...kids.map(why)].join(' | '));
  NC.removeNode(m, co.id); await run();
  // ── a rule on one variation: that variation only ──
  const own = NC.addNode(m, { type: 'transform', params: { ...reg.defaults('transform'), rotate: 45 } });
  NC.addEdge(m, { node: own.id, port: 'rules' }, { node: kids[2].id, port: 'rules' }); await run();
  check('a rule on Variation 3: it changes, the Figure and the others stay', val(kids[2]) && K(val(kids[2]).svg) !== base.kids[2] && K(val(fig).svg) === base.fig && K(val(kids[0]).svg) === base.kids[0], why(kids[2]));
  const cr = NC.addNode(m, { type: 'cell-rules', params: { rules: [{ when: { parity: 'odd' }, do: { rotate: 90 } }] } });
  NC.removeNode(m, own.id); NC.addEdge(m, { node: cr.id, port: 'rules' }, { node: kids[2].id, port: 'rules' }); await run();
  check('…Cell rules on Variation 3 too', val(kids[2]) && K(val(kids[2]).svg) !== base.kids[2], why(kids[2]));
  // ── borders dragged on the Symbol's grid: a Canvas alone keeps them ──
  { const snap = JSON.parse(JSON.stringify(sn0.params.snapshot)), gm = snap.work.gridModel;
    gm.grid.params.colWeights = '3,1,1,1'; delete gm.grid.params.cols;
    sym.params.snapshot = snap; NC.addEdge(m, { node: cv.id, port: 'canvas' }, { node: kids[0].id, port: 'canvas' }); await run();
    const lvl = val(kids[0]) && val(kids[0]).recipe.levels[0].lattice.model.grid.params;
    check('a Symbol with dragged borders + a Canvas on a variation: the borders stay', lvl && lvl.colWeights === '3,1,1,1', why(kids[0]) + ' ' + JSON.stringify(lvl));
    sym.params = JSON.parse(JSON.stringify(sn0.params)); m.edges.filter(e => e.to.node === kids[0].id && e.to.port === 'canvas').forEach(e => NC.removeEdge(m, e.id)); }
  // ── the Element step's recent changes, through an Element node: a duplicated layer, a Segment with a Wave ──
  const elFig = async seed => {
    const snapEl = F.entrySnapshot({ seed, appearance: F.appearanceSnapshot(), colors: F.state.colors.slice(), paperColor: '#ffffff' });
    const g2 = NC.createModel(), e2 = NC.createEngine({ registry: reg });
    const c2 = NC.addNode(g2, { type: 'canvas', params: reg.defaults('canvas') }), gg = NC.addNode(g2, { type: 'grid', params: { gen: 'rectangular', params: { ...F.gridDefaults('rectangular'), cols: 3, rows: 3 } } });
    const en = NC.addNode(g2, { type: 'element', params: { name: 'E', snapshot: snapEl } }), f2 = NC.addNode(g2, { type: 'figure', params: reg.defaults('figure') });
    NC.addEdge(g2, { node: c2.id, port: 'canvas' }, { node: f2.id, port: 'canvas' }); NC.addEdge(g2, { node: gg.id, port: 'grid' }, { node: f2.id, port: 'grid' }); NC.addEdge(g2, { node: en.id, port: 'content' }, { node: f2.id, port: 'content' }, true);
    const v2 = NC.addNode(g2, { type: 'variations', params: { ...reg.defaults('variations'), seed: 5 } }); NC.addEdge(g2, { node: f2.id, port: 'figure' }, { node: v2.id, port: 'figure' });
    await e2.run(g2); const r = e2.get(f2.id), rv = e2.get(v2.id);
    return { ok: r.state === 'ok' && rv.state === 'ok', msg: r.state + ' ' + (r.message || '') + ' / ' + rv.state + ' ' + (rv.message || ''), svg: r.value && r.value.figure.svg, vars: rv.value ? rv.value.figure.variations.length : 0 };
  };
  F.setTier('element'); await w(600);
  q('btn-layer-add').click(); await w(400);
  const two = await elFig(JSON.parse(JSON.stringify(F.seedForSnapshot())));
  document.querySelector('#layers-list .org-layer-card[data-layer="1"] [data-layer-act="dup"]').click(); await w(500);
  set('rg-layer-mx', 25); await w(400);
  const s3 = JSON.parse(JSON.stringify(F.seedForSnapshot())), three = await elFig(s3);
  check('an Element with a duplicated layer (moved): an Element node → Figure → Variations draws all 3 layers', s3.type === 'stack' && s3.layers.length === 3 && three.ok && three.vars === 4 && three.svg !== two.svg, three.msg + ' ' + (s3.layers && s3.layers.length));
  const seg = await elFig({ type: 'segment', segLen: 70, segWave: 100, segCycles: 8, segRepeatX: 3, segRepeatY: 3, segWeight: 8 });
  check('a Segment Element with a high Wave and a Repeat: an Element node → Figure → Variations draws', seg.ok && seg.vars === 4 && /<path/.test(seg.svg), seg.msg);
  return rows;`);
rows.forEach(r => console.log('  ' + r));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const fail = rows.filter(r => r.startsWith('✗')).length + (errs.length ? 1 : 0);
console.log(`\nFVS figure symbol variations: ${fail ? 'FAIL' : 'PASS'} — ${rows.length} checks`);
await P.close(fail ? 1 : 0);
