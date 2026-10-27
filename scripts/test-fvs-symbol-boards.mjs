#!/usr/bin/env node
// FVS Symbol board — several Symbols (Oct 27, 2026 — Diego: "creazione di più board symbol come abbiamo in element per gli
// element"). New symbol adds one (the edited one's grid, every cell empty) and edits it; a click on another edits that one,
// each keeping its own cells, grid and Palette; rename (double-click the name); Delete on a selected sheet + Undo; the list
// and the edited one come back after a reload; the single working Symbol kept before (`current`) becomes the first one.
// Usage: scripts/test-fvs-symbol-boards.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const pre = `const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const B = F.boards.symbol, sheet = id => document.querySelector('[data-sheet="sy-' + id + '"]');
  const key = (e, t = document) => t.dispatchEvent(new KeyboardEvent('keydown', { key: e, bubbles: true }));`;
const rows = await P.ev(pre + `
  F.setTier('component'); await w(500); q('btn-generate').click(); await w(1000);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(700);
  set('sel-symgrid-gen', 'rectangular'); await w(400); set('symgen-cols', 3); set('symgen-rows', 3); await w(450);
  check('one Symbol on a fresh board, named Symbol 1', F.state.symbols.length === 1 && F.state.symbols[0].name === 'Symbol 1' && !!sheet(F.state.activeSymbol), JSON.stringify(F.state.symbols.map(s => s.name)));
  F.state.symbolCells.forEach(c => F.patchCell(c, F.railPatch('component', A))); F.renderSymbolCanvasOnly(); await w(700);
  const first = F.state.activeSymbol;
  q('btn-board-new-symbol').click(); await w(400);
  const second = F.state.activeSymbol;
  check('New symbol: a second one, edited, the same 3 × 3 grid, every cell empty', F.state.symbols.length === 2 && second !== first && F.state.symbolCells.length === 9 && F.state.symbolCells.every(c => c.source === 'empty') && F.state.symbols[1].name === 'Symbol 2', JSON.stringify([F.state.symbols.length, F.state.symbolCells.map(c => c.source).join()]));
  check('…the live sheet is the new one, the first drawn from its snapshot', sheet(second) && sheet(second).id === 'board-symbol' && sheet(first) && !!sheet(first).querySelector('.fvs-board-symbol--static svg'), sheet(first) && sheet(first).outerHTML.slice(0, 120));
  set('sel-symgrid-gen', 'rectangular'); set('symgen-cols', 2); set('symgen-rows', 2); await w(700);
  sheet(first).querySelector('.fvs-board-symbol--static').click(); await w(400);
  check('a click on the first: edited again, its 9 Components back', F.state.activeSymbol === first && F.state.symbolCells.length === 9 && F.state.symbolCells.every(c => c.componentName === A), JSON.stringify([F.state.activeSymbol === first, F.state.symbolCells.length]));
  check('…the second kept its own 2 × 2 grid', F.state.symbols.find(s => s.id === second).work.cells.length === 4, F.state.symbols.find(s => s.id === second).work.cells.length);
  check('…the label says which is being edited', /· editing/.test(sheet(first).querySelector('.fvs-board-sheet__label').textContent) && !/editing/.test(sheet(second).querySelector('.fvs-board-sheet__label').textContent), sheet(first).querySelector('.fvs-board-sheet__label').textContent);
  // rename
  const lab = sheet(second).querySelector('.fvs-board-sheet__label');
  lab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await w(50);
  const inp = lab.querySelector('input'); inp.value = 'Poster'; key('Enter', inp); await w(50);
  check('double-click the name: renamed', F.state.symbols.find(s => s.id === second).name === 'Poster' && /Poster/.test(sheet(second).querySelector('.fvs-board-sheet__label').textContent), F.state.symbols.map(s => s.name).join());
  // Delete on a selected sheet, then Undo
  F.state.symbolSelection.clear(); F.selectSheets(B, ['sy-' + second]); key('Delete'); await w(100);
  check('Delete on the selected sheet: it goes', F.state.symbols.length === 1 && !sheet(second), F.state.symbols.length);
  q('btn-board-undo-symbol').click(); await w(200);
  check('Undo: it comes back, with its name and cells', F.state.symbols.length === 2 && F.state.symbols.find(s => s.id === second).name === 'Poster' && !!sheet(second), F.state.symbols.length);
  F.selectSheets(B, ['sy-' + first]); key('Delete'); await w(300);
  check('Delete on the one being edited: the other is edited, the first goes', F.state.symbols.length === 1 && F.state.activeSymbol === second && F.state.symbolCells.length === 4, JSON.stringify([F.state.symbols.length, F.state.activeSymbol === second]));
  F.selectSheets(B, ['sy-' + second]); key('Delete'); await w(100);
  check('the last one stays', F.state.symbols.length === 1, F.state.symbols.length);
  q('btn-board-undo-symbol').click(); await w(300);
  check('Undo again: both back, the first edited again (as it was when deleted)', F.state.symbols.length === 2 && F.state.activeSymbol === first && F.state.symbolCells.length === 9, JSON.stringify([F.state.symbols.length, F.state.symbolCells.length]));
  window.dispatchEvent(new Event('pagehide')); await w(100);
  window.__kept = { active: F.state.activeSymbol, names: F.state.symbols.map(s => s.name).join() };
  sessionStorage.setItem('kept', JSON.stringify(window.__kept));
  return rows;`);
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows2 = await P.ev(pre + `
  const kept = JSON.parse(sessionStorage.getItem('kept'));
  await w(300);
  check('after a reload: the same Symbols, the same one edited', F.state.symbols.map(s => s.name).join() === kept.names && F.state.activeSymbol === kept.active, JSON.stringify([F.state.symbols.map(s => s.name).join(), kept]));
  // the single working Symbol of before Oct 27, 2026 → the first Symbol (the row left in place)
  const S = Organica.store('fvs-symbol-work'), cur = F.state.symbols.find(s => s.id === F.state.activeSymbol).work;
  sessionStorage.setItem('legacyCells', String(cur.cells.length));
  await w(900);   // the page's own last save (600 ms after a draw) first
  S.write({ current: cur });
  S.write = () => true;   // the reload below must not save this page's list over it
  return rows;`);
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows3 = await P.ev(pre + `
  await w(300);
  check('the old single Symbol (current) opens as Symbol 1', F.state.symbols.length === 1 && F.state.symbols[0].name === 'Symbol 1' && F.state.symbolCells.length === +sessionStorage.getItem('legacyCells'), JSON.stringify([F.state.symbols.map(s => s.name), F.state.symbolCells.length]));
  check('…the current row is still there', !!(Organica.store('fvs-symbol-work').read() || {}).current, 'gone');
  return rows;`);
const all = [...rows, ...rows2, ...rows3], fails = all.filter(x => x.startsWith('✗'));
for (const x of all) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS symbol boards: ${ok ? 'PASS' : 'FAIL'} — ${all.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
