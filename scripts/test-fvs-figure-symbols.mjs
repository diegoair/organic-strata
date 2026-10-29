#!/usr/bin/env node
// FVS Figure ← Symbol (Diego, Oct 29, 2026: "Figure è attivo solo quando almeno un symbol è creato … Quello che è in Symbol
// e quello che è in Figure devono essere sincronizzati, quindi se ho 3 symbol vedo 3 figure con i symbol creati"; "Symbol si
// sostituisce a quello che oggi è la canvas figure, le logiche rimangono invariate"). The Figure tab is aria-disabled until a
// Symbol has a filled cell; each filled Symbol is a Symbol node → a Figure in the graph; an edit, a rename, a delete on the
// Symbol board follows on the next visit; an empty Symbol has no Figure; the Symbol node cannot be deleted in the graph;
// a Palette node recolours a Symbol's Figure. 17-figure-graph.js · engine/17-figure-nodes.js · 18-step-boards.js.
// Usage: scripts/test-fvs-figure-symbols.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const tab = () => document.querySelector('#tier-tabs [data-tier="figure"]');
  const stored = () => (F.figureGraphModel && F.figureGraphModel()) || null;   // the graph on screen
  const symNodes = () => (stored() || { nodes: [] }).nodes.filter(n => n.type === 'symbol');
  const figsOf = id => (stored() || { nodes: [] }).nodes.filter(n => n.type === 'figure' && n.params.symbolId === id);
  F.setTier('symbol'); await w(800);
  check('no Symbol filled: the Figure tab is aria-disabled, its name says why', tab().getAttribute('aria-disabled') === 'true' && /fill a cell on the Symbol step/.test(tab().getAttribute('aria-label')), tab().getAttribute('aria-label'));
  tab().click(); await w(300);
  check('…a click on it stays on the Symbol step', F.state.activeTier === 'symbol', F.state.activeTier);
  F.setTier('component'); await w(500); set('rg-grid-cols', 2); set('rg-grid-rows', 2); q('btn-generate').click(); await w(800);
  [0, 1].forEach(i => F.quickSaveComponentToLibrary(F.state.components[i].id)); await w(300);
  const names = Object.keys(F.LIBRARY.read());
  F.setTier('symbol'); await w(800); set('sel-symgrid-gen', 'rectangular'); await w(400); set('symgen-cols', 4); set('symgen-rows', 4); await w(700);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, { source: 'component', componentName: names[i % 2], rotation: (i * 90) % 360 })); F.renderSymbol(); await w(900);
  check('a Symbol with content: the Figure tab opens', tab().getAttribute('aria-disabled') === 'false' && tab().getAttribute('aria-label') === 'Figure', tab().getAttribute('aria-label'));
  q('btn-board-new-symbol').click(); await w(800);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, { source: 'component', componentName: names[(i + 1) % 2] })); F.renderSymbol(); await w(900);
  q('btn-board-new-symbol').click(); await w(800);   // a third, empty
  tab().click(); await w(4000);
  const ids = F.state.symbols.map(s => s.id);
  check('3 Symbols, 2 filled: 2 Symbol nodes, each into its own Figure, named as the Symbol', symNodes().length === 2 && figsOf(ids[0]).length === 1 && figsOf(ids[1]).length === 1 && figsOf(ids[2]).length === 0 && figsOf(ids[0])[0].name === 'Symbol 1', JSON.stringify(symNodes().map(n => n.name)));
  const imgs = () => [...document.querySelectorAll('#fg-graph .fg-card__img')];
  check('…each Figure draws', imgs().length === 2 && !document.querySelector('#fg-graph .nc-node.is-error'), imgs().length);
  const fig = figsOf(ids[0])[0] || {};
  check('…its Figure takes the Symbol, not Canvas + Grid + Content (cells: 16)', !!document.querySelector('#fg-graph [data-node-id="' + fig.id + '"]') && /16 cells/.test(document.querySelector('#fg-graph [data-node-id="' + fig.id + '"]').textContent), document.querySelector('#fg-graph [data-node-id="' + fig.id + '"]') && document.querySelector('#fg-graph [data-node-id="' + fig.id + '"]').textContent.slice(0, 80));
  // edit Symbol 1, rename Symbol 2, delete Symbol 3 — then back to Figure
  F.setTier('symbol'); await w(800);
  document.querySelectorAll('.fvs-board-symbol--static')[0].click(); await w(800);
  F.state.symbolCells.forEach((c, i) => { if (i < 8) F.patchCell(c, { source: 'empty' }); }); F.renderSymbol(); await w(900);
  F.state.symbols[1].name = 'Waves'; F.state.symbols[1].custom = true;
  tab().click(); await w(3500);
  const sn = symNodes().find(n => n.params.symbolId === ids[0]);
  check('an edit on the Symbol step reaches its Figure (8 cells emptied)', sn && sn.params.snapshot.work.cells.filter(c => c.source === 'empty').length === 8, sn && sn.params.snapshot.work.cells.filter(c => c.source === 'empty').length);
  check('…a rename too: node and Figure are “Waves”', symNodes().some(n => n.name === 'Waves') && figsOf(ids[1])[0].name === 'Waves', JSON.stringify(symNodes().map(n => n.name)));
  // the Symbol node cannot be deleted here
  const before = symNodes().length;
  const nodeEl = document.querySelector('#fg-graph [data-node-id="' + sn.id + '"]'); nodeEl && nodeEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); nodeEl && nodeEl.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 })); await w(150);
  const notes = []; const n0 = Organica.notice; Organica.notice = (m, o) => { notes.push(m); return n0 && n0(m, o); };
  q('btn-fg-delete').click(); await w(500); Organica.notice = n0;
  check('the Symbol node is not deleted in the graph (it comes from the Symbol step)', symNodes().length === before && notes.some(m => /Symbol step/.test(m)), symNodes().length + ' ' + JSON.stringify(notes));
  // nor its Figure (the sync would not make it again)
  const figEl = document.querySelector('#fg-graph [data-node-id="' + figsOf(ids[0])[0].id + '"]'); figEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); figEl.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 })); await w(150);
  const notes2 = []; const n1 = Organica.notice; Organica.notice = (m, o) => { notes2.push(m); return n1 && n1(m, o); };
  q('btn-fg-delete').click(); await w(500); Organica.notice = n1;
  check('…nor its Figure; its panel has no Canvas, Grid, Fit or Clip to cell', figsOf(ids[0]).length === 1 && notes2.some(m => /delete the Symbol on the Symbol step/.test(m)) && !q('fgi-f-canvas') && !q('fgi-f-grid') && !q('fgi-fit') && !q('fgi-clip') && !!q('fgi-f-palette'), JSON.stringify(notes2) + ' ' + [!!q('fgi-f-canvas'), !!q('fgi-fit'), !!q('fgi-f-palette')]);
  // delete Symbol 2 on the board: its Figure goes
  F.setTier('symbol'); await w(800);
  F.state.symbols.splice(1, 1); F.renderSymbol(); await w(900);
  tab().click(); await w(3500);
  check('a Symbol deleted on the board: its Symbol node and its Figure go, the other stays', !symNodes().some(n => n.params.symbolId === ids[1]) && !figsOf(ids[1]).length && figsOf(ids[0]).length === 1, JSON.stringify(symNodes().map(n => n.name)));
  return rows;`);
rows.forEach(r => console.log('  ' + r));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const fail = rows.filter(r => r.startsWith('✗')).length + (errs.length ? 1 : 0);
console.log(`\nFVS figure symbols: ${fail ? 'FAIL' : 'PASS'} — ${rows.length} checks`);
await P.close(fail ? 1 : 0);
