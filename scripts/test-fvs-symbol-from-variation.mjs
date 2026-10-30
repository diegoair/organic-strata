#!/usr/bin/env node
// FVS Figure → Symbol: a double-click on a Symbol's Figure opens its Symbol on the Symbol step; on one of its variations, a
// draft "Symbol 1.a" beside it — a Symbol at its first edit, gone if left untouched (Diego, Oct 30, 2026: "La variation
// diventa editabile come se fosse un nuovo symbol … Symbol 1.a, che se si modifica diventa un symbolo nuovo"; answers:
// born at the first edit · the Symbol holds grid, cells, palette, selections and its Figure gets copies of the rules ·
// independent with a link · the mother opens on the Symbol step). 17-figure-graph.js openOnSymbolStep · 18-step-boards.js
// openSymbolDraft · engine/17-figure-nodes.js symbolWork.
// Usage: scripts/test-fvs-symbol-from-variation.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, NC = Organica.nodeCanvas, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const K = svg => svg.replace(/"exportedAt":"[^"]*"/g, '').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const tab = t => document.querySelector('#tier-tabs [data-tier="' + t + '"]');
  const M = () => F.figureGraphModel(), card = id => document.querySelector('#fg-graph .nc-node[data-node-id="' + id + '"]');
  const dbl = id => card(id).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  // a 4 × 4 Symbol of two Components
  F.setTier('component'); await w(500); set('rg-grid-cols', 2); set('rg-grid-rows', 2); q('btn-generate').click(); await w(800);
  [0, 1].forEach(i => F.quickSaveComponentToLibrary(F.state.components[i].id)); await w(300);
  const names = Object.keys(F.LIBRARY.read());
  F.setTier('symbol'); await w(800); set('sel-symgrid-gen', 'rectangular'); await w(400); set('symgen-cols', 4); set('symgen-rows', 4); await w(700);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, { source: 'component', componentName: names[i % 3 === 0 ? 0 : 1] })); F.renderSymbol(); await w(1500);
  const motherId = F.state.activeSymbol, nSym = F.state.symbols.length;
  tab('figure').click(); await w(4000);
  // a rule on the mother Figure: Rotate & mirror 45° (copied onto a Symbol made from its variation)
  { const m = JSON.parse(JSON.stringify(M())), fg = m.nodes.find(n => n.type === 'figure' && n.params.symbolId === motherId);
    const tr = NC.addNode(m, { type: 'transform', name: 'Rotate & mirror 1', x: fg.x, y: fg.y + 700, params: { rotate: 45, mirror: 'none', which: 'all', n: 1, perCell: 0, countBy: 'index', randomAmount: null, seed: 1 } });
    NC.addEdge(m, { node: tr.id, port: 'rules' }, { node: fg.id, port: 'rules' }); F.figureUseModel(m); await w(5000); }
  const fig = M().nodes.find(n => n.type === 'figure' && n.params.symbolId === motherId), vn = M().nodes.find(n => n.type === 'variations');
  const kids = M().nodes.filter(n => n.type === 'figure-var' && n.params.parent === vn.id).sort((a, b) => a.params.slot - b.params.slot), v2 = kids[1];
  for (let t = 0; t < 40 && !(card(v2.id) && card(v2.id).querySelector('.fg-card__img')); t++) await w(250);
  const v2svg = K(F.figureNodeSVG(v2.id) || '');
  // 1 · the mother
  dbl(fig.id); await w(1200);
  check('a double-click on Symbol 1’s Figure: the Symbol step, Symbol 1 edited, no Symbol added', F.state.activeTier === 'symbol' && F.state.activeSymbol === motherId && F.state.symbols.length === nSym, F.state.activeTier + ' ' + F.state.symbols.length);
  // the panel says it too (REVIEW Oct 30): the Figure's first button; the Symbol node opens it as well
  tab('figure').click(); await w(3000);
  { const c = card(fig.id); c.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); c.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 })); await w(400);
    const b = q('fgi-on-symbol'), first = document.querySelector('#fg-inspector .fg-block');
    check('a Symbol’s Figure panel: first button “Edit on the Symbol step”, Compose after it', b && b.textContent === 'Edit on the Symbol step' && first === b && !!q('fgi-compose'), b && b.textContent);
    b.click(); await w(1200);
    check('…which opens Symbol 1 on the Symbol step', F.state.activeTier === 'symbol' && F.state.activeSymbol === motherId, F.state.activeTier); }
  tab('figure').click(); await w(3000);
  dbl(M().nodes.find(n => n.type === 'symbol' && n.params.symbolId === motherId).id); await w(1200);
  check('a double-click on the Symbol node: the Symbol step, Symbol 1', F.state.activeTier === 'symbol' && F.state.activeSymbol === motherId, F.state.activeTier);
  // 2 · a variation → a draft
  tab('figure').click(); await w(3000);
  { const c = card(v2.id); c.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); c.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 })); await w(400);
    const b = q('fgi-on-symbol');
    check('a variation’s panel: “Edit as a new Symbol” first', b && b.textContent === 'Edit as a new Symbol', b && b.textContent); }
  dbl(v2.id); await w(1500);
  const d = F.state.symbols.find(s => s.id === F.state.activeSymbol);
  check('a double-click on variation 2: the Symbol step on a draft “Symbol 1.a”, beside Symbol 1', F.state.activeTier === 'symbol' && d && d.draft && d.name === 'Symbol 1.a' && d.from.symbolId === motherId && F.state.symbols.length === nSym + 1, d && JSON.stringify({ n: d.name, draft: d.draft }));
  const lab = [...document.querySelectorAll('.fvs-board-sheet__state')].map(e => e.textContent).join('|');
  check('…its sheet says “Draft from Symbol 1 · variation 2”, in its name too', /Draft from Symbol 1 · variation 2/.test(lab) && [...document.querySelectorAll('[aria-label]')].some(e => /^Symbol 1\.a · editing · Draft from Symbol 1 · variation 2 —/.test(e.getAttribute('aria-label'))), lab);
  check('…its cells are the variation’s (16, Components), its palette its own', F.state.symbolCells.length === 16 && F.state.symbolCells.every(c => c.source === 'component') && d.work.palette && d.work.palette.own, F.state.symbolCells.length);
  // 3 · left untouched
  tab('figure').click(); await w(3000);
  check('left without an edit: the draft is gone, the Figure step has no new Symbol', F.state.symbols.length === nSym && !F.state.symbols.some(s => s.draft) && M().nodes.filter(n => n.type === 'symbol').length === 1, F.state.symbols.length + ' ' + M().nodes.filter(n => n.type === 'symbol').length);
  // 4 · the first edit: born
  dbl(v2.id); await w(1500);
  const did = F.state.activeSymbol;
  F.patchCell(F.state.symbolCells[0], { source: 'empty' }); F.renderSymbol(); await w(1800);
  const born = F.state.symbols.find(s => s.id === did);
  check('the first edit: “Symbol 1.a” is a Symbol (kept with the board)', born && !born.draft && born.name === 'Symbol 1.a' && JSON.stringify(Organica.store('fvs-symbol-work').read()).includes(did), born && JSON.stringify({ draft: born.draft }));
  // 5 · ⌘Z: the edit goes back, the Symbol stays
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })); await w(1200);
  check('⌘Z: the cell comes back, Symbol 1.a stays', F.state.symbolCells[0].source === 'component' && F.state.symbols.some(s => s.id === did), F.state.symbolCells[0].source);
  // 6 · in Figure
  tab('figure').click(); await w(5000);
  const sn = M().nodes.find(n => n.type === 'symbol' && n.params.symbolId === did), f2 = M().nodes.find(n => n.type === 'figure' && n.params.symbolId === did);
  const chain = f2 ? M().edges.filter(e => e.to.node === f2.id && e.to.port === 'rules').map(e => M().nodes.find(n => n.id === e.from.node)) : [];
  check('in Figure: Symbol 1.a → its Figure → Variations, the Symbol node says “From Symbol 1 · variation 2”', sn && f2 && M().edges.some(e => e.from.node === f2.id && M().nodes.find(n => n.id === e.to.node && n.type === 'variations')) && sn.params.from === 'From Symbol 1 · variation 2', sn && sn.params.from);
  check('…its Figure has a copy of the mother’s Rotate & mirror (its own node)', chain.length === 1 && chain[0].type === 'transform' && +chain[0].params.rotate === 45 && !M().edges.some(e => e.from.node === chain[0].id && e.to.node === fig.id), JSON.stringify(chain.map(c => c && c.type)));
  for (let t = 0; t < 40 && !(card(f2.id) && card(f2.id).querySelector('.fg-card__img')); t++) await w(250);
  let f2svg = '', v2now = ''; for (let t = 0; t < 80; t++) { f2svg = K(F.figureNodeSVG(f2.id) || ''); v2now = K(F.figureNodeSVG(v2.id) || ''); if (f2svg && f2svg === v2now) break; await w(250); }   // both read now: under load either may still be computing
  check('…and draws as variation 2 does', f2svg && f2svg === v2now, 'differs' + (v2now === v2svg ? '' : ' (variation 2 changed since the start)'));
  const cap = card(v2.id) ? card(v2.id).querySelector('.fg-var__label').textContent : '';
  check('variation 2 is pinned and says “Kept as Symbol 1.a”', /Kept as Symbol 1\\.a/.test(cap) && (M().nodes.find(n => n.id === vn.id).params.pins || []).some(p => p.slot === v2.params.slot), cap);
  // 7 · again: opens it
  dbl(v2.id); await w(1500);
  check('a double-click on variation 2 again opens Symbol 1.a — no new draft', F.state.activeSymbol === did && !F.state.symbols.some(s => s.draft) && F.state.symbols.length === nSym + 1, F.state.activeSymbol + ' ' + F.state.symbols.length);
  // 8 · the mother changed: 1.a stays, its link says "an earlier"
  const before = JSON.stringify(born.work.cells);
  document.querySelector('.fvs-board-symbol--static') && [...document.querySelectorAll('.fvs-board-symbol--static')].find(b => /Symbol 1 /.test(b.getAttribute('aria-label') + ' ')).click(); await w(1200);
  check('…Symbol 1 opened again from its sheet', F.state.activeSymbol === motherId, F.state.activeSymbol);
  F.patchCell(F.state.symbolCells[5], { source: 'empty' }); F.renderSymbol(); await w(1800);
  const lab2 = [...document.querySelectorAll('.fvs-board-sheet__state')].map(e => e.textContent).join('|');
  check('Symbol 1 changed: Symbol 1.a is as it was, its link reads “From an earlier Symbol 1 · variation 2”', JSON.stringify(F.state.symbols.find(s => s.id === did).work.cells) === before && /From an earlier Symbol 1 · variation 2/.test(lab2), lab2);
  // 9 · a variation of 1.a → Symbol 1.a.a
  tab('figure').click(); await w(5000);
  const vn2 = M().nodes.find(n => n.type === 'variations' && M().edges.some(e => e.from.node === f2.id && e.to.node === n.id)), k2 = vn2 && M().nodes.find(n => n.type === 'figure-var' && n.params.parent === vn2.id);
  for (let t = 0; t < 40 && k2 && !(card(k2.id) && card(k2.id).querySelector('.fg-card__img')); t++) await w(250);
  if (k2) { dbl(k2.id); await w(1500); }
  const d2 = F.state.symbols.find(s => s.id === F.state.activeSymbol);
  check('a variation of Symbol 1.a opens a draft “Symbol 1.a.a”', d2 && d2.draft && d2.name === 'Symbol 1.a.a', d2 && d2.name);
  tab('figure').click(); await w(2500);
  return rows;`);
rows.forEach(r => console.log('  ' + r));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const fail = rows.filter(r => r.startsWith('✗')).length + (errs.length ? 1 : 0);
console.log(`\nFVS symbol from variation: ${fail ? 'FAIL' : 'PASS'} — ${rows.length} checks`);
await P.close(fail ? 1 : 0);
