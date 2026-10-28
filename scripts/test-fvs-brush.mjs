#!/usr/bin/env node
// FVS Symbol › Brush, Show letters and Assets (Oct 28, 2026 — Diego: "clic sulla tile la prende, clic sulle celle la mette, clic di nuovo ruota e
// ribalta, Esc la lascia"). A mouse click on a Library rail tile on the Symbol step takes it as the Brush; a click or a
// drag over the cells puts it there; a click on a cell holding it walks its 8 poses; Esc puts it down; a Symbol tile is
// never a Brush; Enter on a tile still places it in the selected cells; the rail shows the saved Elements only (no 7 poses); a second
// click on a selected cell no longer opens Choose content; the rail opens by default; Show letters (one letter per
// content, kept as cells are painted, shared with the Selection's items, never exported). 15-export-library-view.
// Usage: scripts/test-fvs-brush.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  F.setTier('component'); await w(500); set('rg-grid-cols', 2); set('rg-grid-rows', 2); await w(200); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  const E = F.saveElementVariant(0, false, false, '0°', 'Brush test element'); await w(200);
  F.setTier('symbol'); await w(700);
  check('the Library rail is open by default (something saved)', q('fvs-rail-panel').dataset.open === 'true', q('fvs-rail-panel').dataset.open);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450); set('symgen-cols', 4); set('symgen-rows', 4); await w(600);
  F.state.symbolCells.forEach(c => F.patchCell(c, { source: 'empty', rotation: 0, flipH: false, flipV: false, locked: false })); F.renderSymbol(); await w(200);
  const tile = (k, n) => [...document.querySelectorAll('#fvs-rail-panel .fvs-library-item')].find(t => t.dataset.railKind === k && (n == null || t.dataset.railName === n));
  // only the saved Elements (Diego, Oct 28, 2026: "non è necessario portare tutti gli element nel library rail ma solo quello salvato")
  check('the rail shows the saved Element, not the Element’s 7 poses', q('rail-g-poses').hidden && !document.querySelector('#rail-poses .fvs-library-item') && !!tile('element', E), document.querySelectorAll('#rail-poses .fvs-library-item').length + ' poses');
  const elTile = () => tile('element', E);
  const mclick = async t => { t.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await w(300); };
  const key = async k => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await w(80); };
  const brushOn = () => document.body.classList.contains('fvs-brush-on');
  const take = async t => { if (!brushOn()) q('btn-symbol-mode-brush').click(); await mclick(t); };   // Brush mode, then the tile
  const cellXY = i => { const r = q('symbol-frame').querySelector('[data-cell-index="' + i + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const mouse = (type, i, tgt) => { const [x, y] = cellXY(i); (tgt || q('symbol-frame').querySelector('[data-cell-index="' + i + '"]')).dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })); };
  const press = (i) => { mouse('mousedown', i); mouse('mouseup', i); };
  // a second click on a selected cell: no Choose content window
  F.state.symbolSelection = new Set([0]); F.renderSymbol(); await w(100);
  press(0); await w(100);
  check('a click on a selected cell keeps it, no Choose content', getComputedStyle(q('symbol-content-overlay')).display === 'none' && F.state.symbolSelection.has(0), 'opened');
  F.state.symbolSelection.clear(); F.renderSymbol(); await w(100);
  // Select · Brush in the bar (Oct 28, 2026): Select by default; a click on a tile with Select places it in the selection
  const pressed = id => q(id).getAttribute('aria-pressed') === 'true';
  check('the bar’s Tool: Select pressed by default, Brush not', pressed('btn-symbol-mode-select') && !pressed('btn-symbol-mode-brush') && !brushOn(), 'brush on');
  F.state.symbolSelection = new Set([14]); F.renderSymbol(); await w(100);
  await mclick(tile('component', A));
  check('…with Select a click on a tile places it in the selected cell, no Brush', F.state.symbolCells[14].componentName === A && !brushOn(), F.state.symbolCells[14].source);
  press(13); await w(100);
  check('…and a click on a cell still selects it', F.state.symbolSelection.has(13) && F.state.symbolSelection.size === 1, JSON.stringify([...F.state.symbolSelection]));
  F.patchCell(F.state.symbolCells[14], { source: 'empty' }); F.state.symbolSelection = new Set([14]); F.renderSymbol(); await w(100);
  await key('b');
  check('B turns the Brush on with nothing taken: the newest saved Element, in the button', pressed('btn-symbol-mode-brush') && !pressed('btn-symbol-mode-select') && brushOn() && !q('symbol-brush-thumb').hidden && elTile().classList.contains('is-brush'), q('btn-symbol-mode-brush').getAttribute('aria-label'));
  await key('v');
  check('V: back to Select', pressed('btn-symbol-mode-select') && !brushOn() && q('symbol-brush-thumb').hidden, 'still on');
  F.state.symbolSelection.clear(); F.renderSymbol(); await w(100);
  // take the Component as the Brush
  q('btn-symbol-mode-brush').click(); await w(80);
  await mclick(tile('component', A));
  check('Brush on, a click on a tile takes it: its thumbnail in the button', q('btn-symbol-mode-brush').getAttribute('aria-label') === 'Brush: ' + A + ' (B)' && !q('symbol-brush-thumb').hidden, q('btn-symbol-mode-brush').getAttribute('aria-label'));
  check('a click on a tile takes it as the Brush: pressed, the sheet a crosshair', tile('component', A).classList.contains('is-brush') && document.body.classList.contains('fvs-brush-on'), String(tile('component', A).className));
  press(5); await w(150);
  check('a click on a cell puts it there', F.state.symbolCells[5].source === 'component' && F.state.symbolCells[5].componentName === A, JSON.stringify(F.state.symbolCells[5].source));
  check('…and selects nothing', F.state.symbolSelection.size === 0, F.state.symbolSelection.size);
  const poseOf = c => [c.rotation || 0, !!c.flipH];
  const seen = [JSON.stringify(poseOf(F.state.symbolCells[5]))];
  for (let k = 0; k < 8; k++) { press(5); await w(80); seen.push(JSON.stringify(poseOf(F.state.symbolCells[5]))); }
  check('a click again turns it a quarter: 90 180 270', seen.slice(1, 4).join() === '[90,false],[180,false],[270,false]', seen.join(' '));
  check('…then flips: 0 90 180 270 flipped, then back', seen.slice(4, 8).join() === '[0,true],[90,true],[180,true],[270,true]' && seen[8] === seen[0], seen.join(' '));
  // a drag paints a row
  mouse('mousedown', 8); [9, 10, 11].forEach(i => { const [x, y] = cellXY(i); window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y })); }); mouse('mouseup', 11); await w(150);
  check('a drag paints every cell it passes', [8, 9, 10, 11].every(i => F.state.symbolCells[i].componentName === A), [8, 9, 10, 11].map(i => F.state.symbolCells[i].source).join());
  check('…and no marquee selection', F.state.symbolSelection.size === 0 && !F.state.symbolMarqueeRect, F.state.symbolSelection.size);
  // a locked cell stays
  F.state.symbolCells[0].locked = true; press(0); await w(80);
  check('a locked cell is not painted', F.state.symbolCells[0].source === 'empty', F.state.symbolCells[0].source);
  F.state.symbolCells[0].locked = false;
  // the saved Element
  await take(elTile());
  check('another tile takes the Brush over', elTile().classList.contains('is-brush') && !tile('component', A).classList.contains('is-brush'), 'both');
  press(1); await w(100);
  check('the saved Element paints; a click again turns it (90°)', F.state.symbolCells[1].source === 'seed' && (press(1), F.state.symbolCells[1].rotation === 90), JSON.stringify([F.state.symbolCells[1].source, F.state.symbolCells[1].rotation]));
  // Select puts it down
  q('btn-symbol-mode-select').click(); await w(80);
  check('Select puts the Brush down', !brushOn() && !elTile().classList.contains('is-brush'), 'still on');
  // Esc
  await take(tile('component', A));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(80);
  check('Esc puts the Brush down', !document.body.classList.contains('fvs-brush-on'), 'still on');
  check('…and leaves the rail open', q('fvs-rail-panel').dataset.open === 'true', 'closed');
  press(2); await w(100);
  check('without a Brush a click selects again', F.state.symbolSelection.has(2) && F.state.symbolCells[2].source === 'empty', JSON.stringify([...F.state.symbolSelection]));
  // Enter (a click with detail 0) still places in the selection
  tile('component', A).click(); await w(100);
  check('Enter on a tile places it in the selected cells (no Brush)', F.state.symbolCells[2].componentName === A && !document.body.classList.contains('fvs-brush-on'), F.state.symbolCells[2].source);
  // a Symbol tile is never the Brush
  F.saveSymbolAs && F.saveSymbolAs('S brush'); await w(300); F.renderLibraryRail && F.renderLibraryRail(); await w(200);
  const st = tile('symbol');
  if (st) { const was = F.state.activeTier; st.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await w(400); check('a Symbol tile is not a Brush', !document.body.classList.contains('fvs-brush-on'), 'brush on'); }
  // Show letters: one letter per content, on screen only
  const lettersOn = () => [...q('symbol-frame').querySelectorAll('text.fvs-sel-letter')];
  q('btn-symbol-view-letters').click(); await w(150);
  const filled = F.state.symbolCells.filter(c => c.source !== 'empty').length;
  check('Show letters: a letter on every filled cell', q('btn-symbol-view-letters').getAttribute('aria-pressed') === 'true' && lettersOn().length === filled, lettersOn().length + ' of ' + filled);
  const letterAt = i => { const r = q('symbol-frame').querySelector('[data-cell-index="' + i + '"]').getBoundingClientRect(); const t = lettersOn().find(t => { const b = t.getBoundingClientRect(), x = (b.left + b.right) / 2, y = (b.top + b.bottom) / 2; return x > r.left && x < r.right && y > r.top && y < r.bottom; }); return t && t.textContent; };
  check('…the same content, the same letter (turned or not)', letterAt(5) === letterAt(8) && letterAt(8) === letterAt(11) && letterAt(5) !== letterAt(1), [5, 8, 11, 1].map(letterAt).join());
  const before = [5, 1].map(letterAt).join();
  await take(elTile()); press(15); await w(150); setTimeout(() => {}, 0);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(100);
  check('…the same Element again keeps its letter, the others keep theirs', [5, 1].map(letterAt).join() === before && letterAt(15) === letterAt(1), [5, 1, 15].map(letterAt).join());
  check('…never in the export', !/fvs-sel-letter/.test(F.buildSymbolSVG()), 'in the SVG');
  // the Selection's items take the same letters
  F.state.symbolSelection = new Set([12, 13]); F.selectionTouched(13); F.renderSymbol(); await w(150);
  document.querySelector('.fvs-sel-dot').click(); await w(150);
  F.selectionDrop('component', A); await w(200);
  const itemL = (document.querySelector('.fvs-sel-item__letter') || {}).textContent;
  check('a Selection item has its content’s letter on the Symbol', itemL === letterAt(5), itemL + ' vs ' + letterAt(5));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(100);
  q('btn-symbol-view-letters').click(); await w(100);
  check('Show letters off: no letters', !lettersOn().length, lettersOn().length);
  // Assets: the selected cells saved as a pattern — in the rail's Assets and the Library, placed from a cell
  Organica.prompt = async o => o.value;
  F.state.symbolSelection = new Set([5, 9]); F.selectionTouched(9); F.renderSymbol(); await w(150);
  document.querySelector('.fvs-sel-dot').click(); await w(150);
  q('btn-sel-asset').click(); await w(300);
  const at = tile('asset');
  check('Save as asset: a tile in the rail’s Assets', !!at && !q('rail-g-assets').hidden && at.dataset.railName === 'Asset 1', at && at.dataset.railName);
  const vb = at && (at.querySelector('svg').getAttribute('viewBox') || '').split(' ').map(Number);
  check('…its picture is cropped to its cells (1 × 2 of a 4 × 4 grid)', vb && vb[3] > vb[2] * 1.5, JSON.stringify(vb));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(100);
  F.state.symbolCells.forEach(c => F.patchCell(c, { source: 'empty', rotation: 0, flipH: false, flipV: false, locked: false })); F.renderSymbol(); await w(150);
  const src = JSON.parse(JSON.stringify(Object.values(JSON.parse(localStorage.getItem('organica.fvs-assets.presets') || '{}'))[0] || null));
  check('…kept in its own store, the other cells empty', src && src.asset && src.asset.idxs.join() === '5,9' && src.cells.filter(c => c.source !== 'empty').length === 2, src && JSON.stringify(src.asset));
  F.state.symbolSelection = new Set([2]); F.renderSymbol(); await w(100);
  at.click(); await w(200);
  check('Enter on the asset places it from the selected cell (its top-left)', F.state.symbolCells[2].componentName === A && F.state.symbolCells[6].componentName === A && F.state.symbolCells.filter(c => c.source !== 'empty').length === 2, F.state.symbolCells.map(c => c.source[0]).join(''));
  F.state.symbolSelection.clear(); F.renderSymbol();
  await take(tile('asset')); press(3); await w(150);
  check('…as the Brush, a click stamps it; past the edge it is cut', F.state.symbolCells[3].componentName === A && F.state.symbolCells[7].componentName === A, F.state.symbolCells.map(c => c.source[0]).join(''));
  press(15); await w(150);
  check('…at the last row only its top cell lands', F.state.symbolCells[15].componentName === A, F.state.symbolCells[15].source);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(80);
  q('btn-libview').click(); await w(300);
  check('the Library lists Assets', [...document.querySelectorAll('#libview-body .fvs-libview__thumb')].some(b => b.dataset.lvKind === 'asset') && !!document.querySelector('#libview-filter [data-kind="asset"]'), 'not there');
  q('libview-close').click(); await w(150);
  tile('asset').parentElement.querySelector('[data-rail-remove]').click(); await w(200);
  check('Delete on the rail removes the asset', !tile('asset') && q('rail-g-assets').hidden, 'still there');
  // leaving the step puts it down
  F.setTier('symbol'); await w(300); await take(tile('component', A)); F.setTier('component'); await w(300);
  check('leaving the Symbol step puts the Brush down', !document.body.classList.contains('fvs-brush-on'), 'still on');
  await key('b');
  check('B does nothing off the Symbol step', !brushOn(), 'brush on');
  return rows;`);
rows.forEach(r => console.log('  ' + r));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const fail = rows.filter(r => r.startsWith('✗')).length + (errs.length ? 1 : 0);
console.log(`\nFVS brush: ${fail ? 'FAIL' : 'PASS'} — ${rows.length} checks`);
await P.close(fail ? 1 : 0);
