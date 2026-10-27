#!/usr/bin/env node
// FVS Symbol › Cells (Oct 27, 2026 — Diego: "posso scegliere se quel component deve occupare una sola cella o tutte le celle
// che lo compongono … l'inizio è sempre top left"). A Component cell's `span`: true = In proportion (the default since Oct 4:
// its columns × rows reduced), 'grid' = Its grid size (every cell it is made of, cut where the grid ends or a cell is taken
// or locked), false = One cell. The Cells row shows on a regular grid only; the note says when the block is cut.
// Usage: scripts/test-fvs-symbol-cells.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  // a 2 × 4 Component
  F.setTier('component'); await w(500);
  set('rg-grid-cols', 2); set('rg-grid-rows', 4); await w(200);
  q('btn-generate').click(); await w(1000);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  const g = F.LIBRARY.peek()[A].grid;
  check('the Component is 2 × 4', g.cols === 2 && g.rows === 4, JSON.stringify([g.cols, g.rows]));
  F.setTier('symbol'); await w(700);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450);
  set('symgen-cols', 4); set('symgen-rows', 4); await w(450);
  F.state.symbolClipEnabled = false;
  const lat = () => F.symbolLattice(F.getSymbolGrid()), at = (c, r) => lat().at(c, r);
  const empty = () => { F.state.symbolCells = F.state.symbolCells.map(F.emptySymbolCell); };
  const put = (c, r, patch) => { const i = at(c, r); F.patchCell(F.state.symbolCells[i], { ...F.railPatch('component', A), ...(patch || {}) }); F.renderSymbolCanvasOnly(); return i; };
  const L = () => F.symbolSpanLayout(F.getSymbolGrid(), F.state.symbolCells);
  const covers = i => Object.values(L().covered).filter(a => a === i).length + 1;
  empty(); let i = put(0, 0);
  check('a drop is In proportion (as before): 2 × 4 → 1 × 2', F.state.symbolCells[i].span === true && covers(i) === 2, covers(i));
  F.patchCell(F.state.symbolCells[i], { span: 'grid' });
  { const r = L().region[i], c0 = F.resolveGridCells(F.getSymbolGrid())[i];
    check('Its grid size: 8 cells from the top-left, not cut', covers(i) === 8 && r && !r.cut && Math.abs(r.c.cellW - 2 * c0.cellW) < 1 && Math.abs(r.c.cellH - 4 * c0.cellH) < 1, JSON.stringify([covers(i), r && r.cut])); }
  F.patchCell(F.state.symbolCells[i], { span: false });
  check('One cell: no block', covers(i) === 1 && !L().region[i], covers(i));
  // at the grid's edge: cut, the Component at its full size
  empty(); i = put(3, 2, { span: 'grid' });
  { const r = L().region[i], c0 = F.resolveGridCells(F.getSymbolGrid())[i];
    check('at column 4, row 3: cut to 1 × 2, placed in its whole 2 × 4 box', covers(i) === 2 && r && r.cut && Math.abs(r.c.cellW - 2 * c0.cellW) < 1 && Math.abs(r.c.cellH - 4 * c0.cellH) < 1 && Math.abs(r.raw.height - 2 * F.getSymbolGrid().cells[i].height) < 1, JSON.stringify([covers(i), r && r.cut, r && r.c.cellW, c0.cellW]));
    const sv = F.buildSymbolSVG();
    check('…drawn only inside its cells (a clip, Clip to cell off)', new RegExp('clip-cell-' + i + '-').test(sv), 'no clip'); }
  // a locked neighbour: the block stops there
  empty(); F.patchCell(F.state.symbolCells[at(1, 0)], { locked: true }); i = put(0, 0, { span: 'grid' });
  check('a locked cell on its right: cut to 1 × 4', covers(i) === 4 && L().region[i].cut, covers(i));
  F.patchCell(F.state.symbolCells[at(1, 0)], { locked: false });
  // a block already there: the later one stops at it
  empty(); const j = put(1, 0, { span: 'grid' }); i = put(0, 0, { span: 'grid' });
  check('a block already on its right: the first one (top-left first) wins, the second is cut', covers(at(0, 0)) === 8 && !Object.keys(L().region).includes(String(j)), JSON.stringify([covers(at(0, 0)), Object.keys(L().region)]));
  // the panel
  empty(); i = put(3, 2);
  F.state.symbolSelection = new Set([i]); F.renderCellPropertiesPanel(); await w(50);
  check('the Cells row shows for a Component, In proportion', !q('row-cellprop-span').hidden && q('sel-cellprop-span').value === 'fit' && q('note-cellprop-span-cut').hidden, JSON.stringify([q('row-cellprop-span').hidden, q('sel-cellprop-span').value]));
  set('sel-cellprop-span', 'all'); await w(50);
  check('…Its grid size writes span: grid, and the cut note shows', F.state.symbolCells[i].span === 'grid' && !q('note-cellprop-span-cut').hidden, JSON.stringify([F.state.symbolCells[i].span, q('note-cellprop-span-cut').hidden]));
  set('sel-cellprop-span', 'one'); await w(50);
  check('…One cell writes span: false', F.state.symbolCells[i].span === false && q('note-cellprop-span-cut').hidden, F.state.symbolCells[i].span);
  const seedI = at(0, 0); F.state.symbolSelection = new Set([seedI]); F.renderCellPropertiesPanel(); await w(50);
  check('an empty cell: no Cells row', q('row-cellprop-span').hidden, 'shown');
  // a re-drop goes back to the default
  put(3, 2); check('a new drop on the cell: In proportion again', F.state.symbolCells[i].span === true, F.state.symbolCells[i].span);
  // a grid with no rows and columns
  set('sel-symgrid-gen', 'hexagonal'); await w(500);
  const k = F.state.symbolCells.findIndex(c => c.source === 'component');
  F.state.symbolSelection = new Set([k >= 0 ? k : 0]); if (k < 0) F.patchCell(F.state.symbolCells[0], F.railPatch('component', A)); F.renderCellPropertiesPanel(); await w(50);
  check('Hexagonal: no Cells row', q('row-cellprop-span').hidden, 'shown');
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS symbol cells: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
