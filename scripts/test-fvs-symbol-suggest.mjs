#!/usr/bin/env node
// FVS Symbol › Suggest from the Symbol's own contents (Diego, Oct 27, 2026: "leghiamo la generazione di varianti a quello
// che è nella symbol come elementi e componenti, quindi non richiamando altri elementi e componenti esterni"). Suggest and
// More like this use only what the cells hold (Components and Elements, weighted by count); a variation copies the cell a
// content came from (Cells / span, Fit, scale, padding kept) and changes its turn and flip; empty cells stay empty; the
// placeholder triangles are not a content; with no content yet the library pool is used, as Fill the grid.
// Usage: scripts/test-fvs-symbol-suggest.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const E = F.saveElementVariant(0, false, false, '0°', 'Suggest test element');
  F.setTier('component'); await w(500); q('btn-generate').click(); await w(1000);
  const names = [];
  for (let k = 0; k < 4; k++) { F.quickSaveComponentToLibrary(F.state.components[k].id); await w(150); names.push(F.getSelectedComponent().savedName); }
  const [A, B, C, D] = names;   // C and D are saved but not in the Symbol
  F.setTier('symbol'); await w(700);
  set('sel-symgrid-gen', 'rectangular'); await w(300); set('symgen-cols', 4); set('symgen-rows', 4); await w(450);
  // placeholders only: the library (as Fill the grid)
  F.state.symbolCells = F.state.symbolCells.map(() => F.defaultSymbolCells(F.getSymbolGrid())[0]);
  check('placeholder triangles are no content', F.symbolContentPool(F.state.symbolCells).length === 0, F.symbolContentPool(F.state.symbolCells).length);
  // the Symbol: A ×6, B ×3, the Element ×2 (Fit Stretch, scale 0.8), two empty holes, the rest placeholders
  const cells = F.state.symbolCells;
  const pa = F.railPatch('component', A), pb = F.railPatch('component', B), pe = F.railPatch('element', E);
  [0, 1, 2, 3, 4, 5].forEach(i => F.patchCell(cells[i], { ...pa, fitMode: 'fill', padding: 0.1 }));
  [6, 7, 8].forEach(i => F.patchCell(cells[i], pb));
  [9, 10].forEach(i => F.patchCell(cells[i], { ...pe, scale: 0.8 }));
  [11, 12].forEach(i => F.patchCell(cells[i], F.emptySymbolCell()));
  F.renderSymbolCanvasOnly();
  const pool = F.symbolContentPool(cells);
  const wOf = n => (pool.find(p => p.name === n) || {}).weight;
  check('the pool: A ×6, B ×3, the Element ×2 — weighted by count', pool.length === 3 && wOf(A) === 6 && wOf(B) === 3 && pool.some(p => p.element && p.weight === 2), JSON.stringify(pool.map(p => [p.name.slice(0, 20), p.weight])));
  q('btn-sug-run').click(); await w(500);
  const sg = F.state.symbolSuggestions, all = sg.flatMap(v => v.cells);
  check('Suggest: ' + sg.length + ' variations', sg.length > 3, sg.length);
  check('…only the Symbol\\'s contents: never C or D', all.every(c => c.source !== 'component' || c.componentName === A || c.componentName === B), [...new Set(all.map(c => c.componentName))].join());
  check('…the Element is a content too (some variation places it)', all.some(c => c.source === 'seed' && c.seedParams && c.ownColors !== undefined), 'never');
  check('…the empty cells stay empty', sg.every(v => v.cells[11].source === 'empty' && v.cells[12].source === 'empty'), 'filled');
  check('…a cell keeps its source cell\\'s settings (A: Stretch, padding 10%; the Element: scale 0.8)', all.every(c => c.source !== 'component' || c.componentName !== A || (c.fitMode === 'fill' && c.padding === 0.1)) && all.every(c => c.source !== 'seed' || !c.seedParams || c.scale === 0.8), 'lost');
  check('…the placeholders were filled', sg.every(v => [13, 14, 15].every(i => F.cellContentKey(v.cells[i]))), 'left');
  check('…the hint says where it drew from', /From this Symbol’s 3 contents/.test(q('sug-hint').textContent), q('sug-hint').textContent);
  // Cells (span) survive a variation
  F.state.symbolCells = sg[0].cells.map(c => ({ ...c })); F.renderSymbol(); await w(100);
  const ai = F.state.symbolCells.findIndex(c => c.componentName === A); F.patchCell(F.state.symbolCells[ai], { span: 'grid' }); F.renderSymbol();
  q('btn-sug-more').click(); await w(500);
  const more = F.state.symbolSuggestions;
  check('More like this: ' + more.length + ' variations, A keeps Cells › Its grid size', more.length > 0 && more.every(v => v.cells.every(c => c.componentName !== A || c.span === 'grid' || c.span === true)) && more.some(v => v.cells.some(c => c.componentName === A && c.span === 'grid')), 'span lost');
  check('…still never C or D', more.every(v => v.cells.every(c => c.source !== 'component' || c.componentName === A || c.componentName === B)), 'outside');
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS symbol suggest: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
