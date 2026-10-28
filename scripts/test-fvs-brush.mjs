#!/usr/bin/env node
// FVS Symbol › Brush (Oct 28, 2026 — Diego: "clic sulla tile la prende, clic sulle celle la mette, clic di nuovo ruota e
// ribalta, Esc la lascia"). A mouse click on a Library rail tile on the Symbol step takes it as the Brush; a click or a
// drag over the cells puts it there; a click on a cell holding it walks its 8 poses; Esc puts it down; a Symbol tile is
// never a Brush; Enter on a tile still places it in the selected cells; the Element's 7 poses are in the rail; a second
// click on a selected cell no longer opens Choose content; the rail opens by default. 15-export-library-view.
// Usage: scripts/test-fvs-brush.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  F.setTier('component'); await w(500); set('rg-grid-cols', 2); set('rg-grid-rows', 2); await w(200); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(700);
  check('the Library rail is open by default (something saved)', q('fvs-rail-panel').dataset.open === 'true', q('fvs-rail-panel').dataset.open);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450); set('symgen-cols', 4); set('symgen-rows', 4); await w(600);
  F.state.symbolCells.forEach(c => F.patchCell(c, { source: 'empty', rotation: 0, flipH: false, flipV: false, locked: false })); F.renderSymbol(); await w(200);
  const tile = (k, n) => [...document.querySelectorAll('#fvs-rail-panel .fvs-library-item')].find(t => t.dataset.railKind === k && (n == null || t.dataset.railName === n));
  const poses = [...document.querySelectorAll('#rail-poses .fvs-library-item')];
  check('the Element in its 7 poses, first in the rail', poses.length === 7 && !q('rail-g-poses').hidden && poses[0].dataset.railName === 'As it is', poses.length);
  const mclick = async t => { t.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await w(300); };
  const cellXY = i => { const r = q('symbol-frame').querySelector('[data-cell-index="' + i + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const mouse = (type, i, tgt) => { const [x, y] = cellXY(i); (tgt || q('symbol-frame').querySelector('[data-cell-index="' + i + '"]')).dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })); };
  const press = (i) => { mouse('mousedown', i); mouse('mouseup', i); };
  // a second click on a selected cell: no Choose content window
  F.state.symbolSelection = new Set([0]); F.renderSymbol(); await w(100);
  press(0); await w(100);
  check('a click on a selected cell keeps it, no Choose content', getComputedStyle(q('symbol-content-overlay')).display === 'none' && F.state.symbolSelection.has(0), 'opened');
  F.state.symbolSelection.clear(); F.renderSymbol(); await w(100);
  // take the Component as the Brush
  await mclick(tile('component', A));
  check('a click on a tile takes it as the Brush: pressed, the sheet a crosshair', tile('component', A).classList.contains('is-brush') && tile('component', A).getAttribute('aria-pressed') === 'true' && document.body.classList.contains('fvs-brush-on'), String(tile('component', A).className));
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
  // a pose of the Element
  await mclick(poses[2]);
  check('another tile takes the Brush over', poses[2].classList.contains('is-brush') && !tile('component', A).classList.contains('is-brush'), 'both');
  press(1); await w(100);
  check('a pose of the Element paints with its turn (180°)', F.state.symbolCells[1].source === 'seed' && F.state.symbolCells[1].rotation === 180, JSON.stringify([F.state.symbolCells[1].source, F.state.symbolCells[1].rotation]));
  // a click on the same tile puts it down
  await mclick(poses[2]);
  check('a click on the Brush tile puts it down', !F.state || (!document.body.classList.contains('fvs-brush-on') && !poses[2].classList.contains('is-brush')), 'still on');
  // Esc
  await mclick(tile('component', A));
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
  // leaving the step puts it down
  F.setTier('symbol'); await w(300); await mclick(tile('component', A)); F.setTier('component'); await w(300);
  check('leaving the Symbol step puts the Brush down', !document.body.classList.contains('fvs-brush-on'), 'still on');
  return rows;`);
rows.forEach(r => console.log('  ' + r));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const fail = rows.filter(r => r.startsWith('✗')).length + (errs.length ? 1 : 0);
console.log(`\nFVS brush: ${fail ? 'FAIL' : 'PASS'} — ${rows.length} checks`);
await P.close(fail ? 1 : 0);
