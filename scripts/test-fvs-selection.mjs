#!/usr/bin/env node
// FVS Symbol › Selection (Oct 28, 2026 — Diego: the selection is the interaction; Zones removed). Cells picked on the
// canvas get a dot in the sheet's margin, on the side of the last picked cell; the dot opens the Selection section and a
// square drop target; items dropped there are A, B, C…; Arrange tiles place them from the selection's own first cell
// (Checkerboard over N, Rows, Columns, Rhythm along a walk with a sequence); Save keeps the selection live (a resize
// keeps the column and its pattern); Lock (Suggest leaves the cells), Clear, Delete (armed), ⌘Z; a saved Symbol dragged
// onto a cell is pasted. 11-selection-ui + engine/11-zones arrangeLetters.
// Usage: scripts/test-fvs-selection.sh   (SEL_SHOT=file.png [SEL_DARK=1] also takes a screenshot of the open section)
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  Organica.prompt = async o => o.value;   // Save selection… takes the offered name
  // three Components
  const names = [];
  for (const g of [2, 1, 3]) {
    F.setTier('component'); await w(500); set('rg-grid-cols', g); set('rg-grid-rows', g); await w(200); q('btn-generate').click(); await w(800);
    F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); names.push(F.getSelectedComponent().savedName);
  }
  const [A, B, Cn] = names;
  F.setTier('symbol'); await w(700);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450); set('symgen-cols', 6); set('symgen-rows', 6); await w(600);
  const ctx = () => F.zoneContexts(F.getSymbolGrid());
  check('no Zones and no Cells section', !q('sym-zones-section') && !q('sym-cells-section') && !q('zone-list'), 'still there');
  // the Zones of Oct 27 ({when, do}) are not saved selections: no dot without a selection
  F.state.symbolZones = [{ when: { sel: 'border' }, do: { keep: true } }, { when: { sel: 'quadrant', q: 'tl' }, do: {} }, { name: '', when: { sel: 'border' }, fill: null, rule: { follow: { id: 'field', params: { signal: 'noise', drive: 'turn' }, seed: 1 } }, off: false }]; F.renderSymbol(); await w(200);
  check('old Zones are dropped: nothing on the sheet with no selection', !document.querySelector('.fvs-sel-overlay') && F.state.symbolZones.length === 0, document.querySelectorAll('.fvs-sel-overlay .nc-port__dot').length + ' dots');
  // pick column 2 by hand (the last picked: its bottom cell)
  const col2 = ctx().filter(c => c.col === 2).map(c => c.index);
  F.state.symbolSelection = new Set(col2); F.selectionTouched(col2[col2.length - 1]); F.renderSymbol(); await w(250);
  const dot = document.querySelector('.fvs-sel-dot'), svg = q('symbol-frame').querySelector('svg');
  check('a box beside the selection, wired, with its end dot', !!dot && dot.classList.contains('fvs-sel-pill') && document.querySelectorAll('.fvs-sel-wires path').length === 1 && document.querySelectorAll('.fvs-sel-end').length === 1, String(!!dot));
  check('…in the left margin, outside the sheet', dot && dot.getBoundingClientRect().right < svg.getBoundingClientRect().left, dot && JSON.stringify([dot.getBoundingClientRect().right, svg.getBoundingClientRect().left]));
  check('…its name is its text: "6 cells Drop here"', /6 cells\\s*Drop here/.test(dot.textContent) && !dot.hasAttribute('aria-label') && dot.getAttribute('aria-describedby') === 'sym-sel-drop-hint', dot.textContent);
  check('…level with the last picked cell', dot && Math.abs((dot.getBoundingClientRect().top + dot.getBoundingClientRect().bottom) / 2 - (() => { const r = q('symbol-frame').querySelector('[data-cell-index="' + col2[col2.length - 1] + '"]').getBoundingClientRect(); return (r.top + r.bottom) / 2; })()) < 3, 'off');
  check('the section is closed until the box is clicked; the box is the drop target', q('sym-selection-section').hidden && dot.classList.contains('fvs-sel-drop'), 'open');
  dot.click(); await w(150);
  check('click the box: the Selection section opens', !q('sym-selection-section').hidden && q('sel-title').textContent === '6 cells' && document.querySelector('.fvs-sel-dot').getAttribute('aria-expanded') === 'true', q('sel-title').textContent);
  check('Transform has Rotation · Flip · Scale; Cells has Cells · Padding', ['row-cellprop-rotation', 'row-cellprop-flip', 'row-cellprop-scale'].every(id => q('sel-transform').contains(q(id))) && q('sel-cells').contains(q('row-cellprop-span')) && q('sel-cells').contains(q('cellprop-pad')), 'misplaced');
  // drops: A, B, C
  F.selectionDrop('component', A); await w(80); F.selectionDrop('component', B); await w(80); F.selectionDrop('component', Cn); await w(150);
  check('three drops → three items A B C', q('sel-items').querySelectorAll('.fvs-sel-item').length === 3, q('sel-items').querySelectorAll('.fvs-sel-item').length);
  F.renderCellPropertiesPanel(); await w(50);
  check('a Component over several cells: no Rotation / Flip, a note says how', q('row-cellprop-rotation').hidden && !q('note-cellprop-turn').hidden, JSON.stringify([q('row-cellprop-rotation').hidden, q('note-cellprop-turn').hidden, F.state.symbolCells[col2[0]].span]));
  check('Arrange tiles show (2 or more items)', !q('sel-arrange-block').hidden && q('sel-arrange').querySelectorAll('[data-arr]').length >= 12, q('sel-arrange').querySelectorAll('[data-arr]').length);
  const seq = () => col2.map(i => ({ [A]: 'A', [B]: 'B', [Cn]: 'C' }[F.state.symbolCells[i].componentName] || '?')).join('');
  check('Checkerboard by default: the column reads A B C A B C', seq() === 'ABCABC', seq());
  const tile = k => q('sel-arrange').querySelector('[data-arr="' + k + '"]');
  tile('columns').click(); await w(120);
  check('Columns: one column = all A', seq() === 'AAAAAA', seq());
  tile('rows').click(); await w(120);
  check('Rows: A B C A B C', seq() === 'ABCABC', seq());
  check('the picked tile is pressed', tile('rows').getAttribute('aria-pressed') === 'true', 'not');
  tile('rhythm:reading').click(); await w(120);
  check('Rhythm shows Sequence', !q('sel-seq-row').hidden, 'hidden');
  q('sel-seq').querySelector('[data-seq="ABB"]').click(); await w(120);
  check('Rhythm · Reading · A B B', seq() === 'ABBABB', seq());
  check('only the selection changed', F.state.symbolCells.every((c, i) => col2.includes(i) || c.source !== 'component'), 'leaked');
  // the phase is the selection's: a 2 × 2 block from column 3, row 2 starts on A
  const blk = ctx().filter(c => c.col >= 3 && c.col <= 4 && c.row >= 2 && c.row <= 3).map(c => c.index);
  F.state.symbolSelection = new Set(blk); F.selectionTouched(blk[3]); F.renderSymbol(); await w(100);
  document.querySelector('.fvs-sel-dot').click(); await w(100);
  check('a new selection: no items yet, and no Content part (no hint, no Choose content)', q('sel-items').querySelectorAll('.fvs-sel-item').length === 0 && q('sel-content-block').hidden && !q('btn-sel-choose'), 'shown');
  F.selectionDrop('component', A); F.selectionDrop('component', B); await w(150);
  const at = (c, r) => F.state.symbolCells[ctx().find(x => x.col === c && x.row === r).index].componentName;
  check('Checkerboard from the selection\\'s own corner: A B / B A', at(3, 2) === A && at(4, 2) === B && at(3, 3) === B && at(4, 3) === A, [at(3, 2), at(4, 2)].join(' '));
  { const e = document.querySelector('.fvs-sel-end').getBoundingClientRect(), c = q('symbol-frame').querySelector('[data-cell-index="' + blk[2] + '"]').getBoundingClientRect();
    check('the wire lands on the left edge of the selection, on the row of the last cell', Math.abs((e.left + e.right) / 2 - c.left) < 3 && Math.abs((e.top + e.bottom) / 2 - (c.top + c.bottom) / 2) < 3, JSON.stringify([e.left, c.left]));
    check('the box says what it does', /Checkerboard/.test(document.querySelector('.fvs-sel-dot').textContent), document.querySelector('.fvs-sel-dot').textContent); }
  set('sel-cellprop-span', 'one'); await w(150);
  check('…Cells › One cell: Rotation and Flip show', !q('row-cellprop-rotation').hidden && !q('row-cellprop-flip').hidden && q('note-cellprop-turn').hidden, 'hidden');
  set('sel-cellprop-rot', '90'); await w(120);
  check('…and turn the selected Components', blk.every(i => F.state.symbolCells[i].rotation === 90), JSON.stringify(blk.map(i => F.state.symbolCells[i].rotation)));
  // Lock
  q('btn-sel-lock').click(); await w(80);
  check('Lock: the 4 cells locked, the button pressed', blk.every(i => F.state.symbolCells[i].locked) && q('btn-sel-lock').getAttribute('aria-pressed') === 'true', 'no');
  // back to the column: Save it, resize to 8 × 8
  F.state.symbolSelection = new Set(col2); F.selectionTouched(col2[5]); F.renderSymbol(); await w(80);
  document.querySelector('.fvs-sel-dot').click(); await w(80);
  F.selectionDrop('component', A); F.selectionDrop('component', B); F.selectionDrop('component', Cn); await w(120);
  q('btn-sel-save').click(); await w(200);
  check('Save: one saved selection, named, a column selector', F.state.symbolZones.length === 1 && F.state.symbolZones[0].name === 'Selection 1' && JSON.stringify(F.state.symbolZones[0].when) === JSON.stringify({ sel: 'col', k: 2 }), JSON.stringify(F.state.symbolZones));
  check('…the header shows its name, Delete and Rename', q('sel-title').textContent === 'Selection 1' && !q('btn-sel-delete').hidden && q('btn-sel-save').hidden, q('sel-title').textContent);
  set('symgen-cols', 8); set('symgen-rows', 8); await w(900);
  const col2b = ctx().filter(c => c.col === 2).map(c => c.index);
  const seqB = col2b.map(i => ({ [A]: 'A', [B]: 'B', [Cn]: 'C' }[F.state.symbolCells[i].componentName] || '?')).join('');
  check('8 × 8: the saved column holds A B C again, over 8 cells', seqB === 'ABCABCAB', seqB);
  check('a faded box for the saved selection', document.querySelectorAll('.fvs-sel-saved').length === 1 || (F.state.selPick === 0), 'none');
  // two boxes never overlap: a second selection on the same rows
  { const c4 = ctx().filter(c => c.col === 4).map(c => c.index); F.state.symbolSelection = new Set(c4); F.selectionTouched(c4[c4.length - 1]); F.renderSymbol(); await w(200);
    const r = [...document.querySelectorAll('.fvs-sel-pill')].map(p => p.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    check('two boxes, stacked without overlap', r.length === 2 && r[1].top >= r[0].bottom, JSON.stringify(r.map(x => [x.top, x.bottom]))); }
  // Suggest leaves a saved selection as it is
  F.state.symbolSelection.clear(); F.selectionTouched(null); F.renderSymbol(); await w(100);
  F.state.symbolCells.forEach((c, i) => { if (!col2b.includes(i)) F.patchCell(c, F.railPatch('component', A)); });
  const held = JSON.stringify(col2b.map(i => F.state.symbolCells[i].componentName));
  q('btn-sug-run').click(); await w(300);
  check('Suggest: every variation keeps the saved column', F.state.symbolSuggestions.length > 0 && F.state.symbolSuggestions.every(sg => JSON.stringify(col2b.map(i => sg.cells[i].componentName)) === held), F.state.symbolSuggestions.length);
  // open the saved one from its dot, Clear, Delete (armed)
  document.querySelector('.fvs-sel-saved').click(); await w(150);
  check('the saved dot opens it again', F.state.selPick === 0 && F.state.symbolSelection.size === 8 && !q('sym-selection-section').hidden, F.state.selPick);
  q('btn-sel-clear').click(); await w(150);
  check('Clear: its cells empty, and it stays empty', col2b.every(i => F.state.symbolCells[i].source === 'empty') && F.state.symbolZones[0].fill && F.state.symbolZones[0].fill.empty, JSON.stringify(F.state.symbolZones[0].fill));
  q('btn-sel-delete').click(); await w(100);
  check('Delete is armed: one click deletes nothing', F.state.symbolZones.length === 1, F.state.symbolZones.length);
  q('btn-sel-delete').click(); await w(150);
  check('…the second deletes the saved selection', F.state.symbolZones.length === 0, F.state.symbolZones.length);
  // a saved Symbol dragged onto a cell: pasted
  const entry = F.buildSymbolLibraryEntry(), lib = F.SYMBOL_LIBRARY.read(); lib['__sel-test'] = entry; F.SYMBOL_LIBRARY.write(lib);
  F.state.symbolCells.forEach(c => F.patchCell(c, { source: 'empty', locked: false })); F.renderSymbol();
  F.symbolPaste('__sel-test', ctx().find(x => x.col === 3 && x.row === 3).index); await w(150);
  check('a Symbol dropped on a cell is pasted from it', F.state.symbolCells.filter(c => c.source === 'component').length > 10, F.state.symbolCells.filter(c => c.source === 'component').length);
  const l2 = F.SYMBOL_LIBRARY.read(); delete l2['__sel-test']; F.SYMBOL_LIBRARY.write(l2);
  // Esc closes the section, then the selection
  F.state.symbolSelection = new Set([0, 1]); F.selectionTouched(1); F.renderSymbol(); document.querySelector('.fvs-sel-dot').click(); await w(80);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(80);
  check('Esc: the section closes, the selection stays', q('sym-selection-section').hidden && F.state.symbolSelection.size === 2, F.state.symbolSelection.size);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(80);
  check('…Esc again: no selection', F.state.symbolSelection.size === 0, F.state.symbolSelection.size);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true })); await w(80);
  check('⌘A: every cell', F.state.symbolSelection.size === F.state.symbolCells.length, F.state.symbolSelection.size);
  // ⌘Z undoes a Save (the saved selections are part of the Symbol's edit)
  const c0 = ctx().filter(c => c.col === 0).map(c => c.index);
  F.state.symbolSelection = new Set(c0); F.selectionTouched(c0[0]); F.renderSymbol(); await w(700);
  document.querySelector('.fvs-sel-dot').click(); await w(80); q('btn-sel-save').click(); await w(900);
  check('a selection saved', F.state.symbolZones.length === 1, F.state.symbolZones.length);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })); await w(300);
  check('⌘Z: the Save undone', F.state.symbolZones.length === 0, F.state.symbolZones.length);
  return rows;`);
if (process.env.SEL_SHOT) {
  await P.ev(`const F = window.__fvs, w = ms => new Promise(r => setTimeout(r, ms)); ${process.env.SEL_DARK ? "document.documentElement.setAttribute('data-theme', 'dark');" : ''}
    const C = F.zoneContexts(F.getSymbolGrid()), lib = Object.keys(F.LIBRARY.peek()).slice(-3);
    const col = C.filter(c => c.col === 2).map(c => c.index);
    F.state.symbolSelection = new Set(col); F.selectionTouched(col[col.length - 1]); F.renderSymbol(); await w(100);
    document.querySelector('.fvs-sel-dot').click(); await w(100);
    lib.forEach(n => F.selectionDrop('component', n)); await w(200);
    if (${process.env.SEL_SAVED ? 1 : 0}) {   // a saved selection too, for the picture
      Organica.prompt = async o => 'Border'; document.getElementById('btn-sel-save').click(); await w(200);
      const c5 = C.filter(c => c.col === 5 && c.row >= 3).map(c => c.index); F.state.symbolSelection = new Set(c5); F.selectionTouched(c5[0]); F.renderSymbol(); await w(100);
      document.querySelector('.fvs-sel-dot').click(); await w(100); F.selectionDrop('component', lib[0]); await w(200);
    }
    document.getElementById('sym-selection-section').scrollIntoView(); return 1;`);
  const shot = await P.cdp('Page.captureScreenshot', { format: 'png' });
  (await import('node:fs')).writeFileSync(process.env.SEL_SHOT, Buffer.from(shot.result.data, 'base64'));
}
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS selection: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
