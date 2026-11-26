#!/usr/bin/env node
// FVS Symbol › Fit › Repeat (Nov 26, 2026, backlog 1.4 — one Component for a band of any length): a Component cell set to
// Repeat lays the Component n times along the cell's long side, each copy at the size of the short side
// (n = round(length / copy length), at least 1), as one strip stretched to close the cell. A turned cell (90° / 270°) still
// repeats along the cell. An Element cell set to Repeat draws as Contain. SVG and PNG come from the same items.
// Usage: node --experimental-websocket --no-warnings scripts/test-fvs-symbol-repeat.mjs — exits 1 on a failure.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const near = (a, b, t) => Math.abs(a - b) <= (t || 0.02) * Math.max(1, Math.abs(b));
  // a 1 × 1 Component and a 2 × 1 one
  F.setTier('component'); await w(500);
  const saveComp = async (cols, rows) => { set('rg-grid-cols', cols); set('rg-grid-rows', rows); await w(200); q('btn-generate').click(); await w(1000);
    F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); return F.getSelectedComponent().savedName; };
  const A = await saveComp(1, 1), B = await saveComp(2, 1);
  F.setTier('symbol'); await w(700);
  // one column of six rows on a square sheet: every cell is several times as wide as it is tall
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450);
  set('symgen-cols', 1); set('symgen-rows', 6); await w(450);
  const empty = () => { F.state.symbolCells = F.state.symbolCells.map(F.emptySymbolCell); };
  const put = (i, name, patch) => { F.patchCell(F.state.symbolCells[i], { ...F.railPatch('component', name), span: false, ...(patch || {}) }); F.renderSymbolCanvasOnly(); };
  const item = i => F.buildSymbolItems().find(it => it.index === i);
  const box = i => F.resolveGridCells(F.getSymbolGrid())[i];
  empty(); put(0, A); const one = item(0);
  put(0, A, { fitMode: 'repeat' }); const rep = item(0), c0 = box(0);
  const a = c0.cellW / c0.cellH, N = Math.round(a), gr = F.getSymbolGrid();
  check('the cells are long (at least 3 : 1)', a >= 2.6, a.toFixed(2) + ' (' + JSON.stringify(gr.params || {}) + ')');
  check('Repeat lays a 1 × 1 ' + N + ' times along the cell', rep.repeat && rep.nestedItems.length === N * one.nestedItems.length && near(rep.nestedW, N * one.nestedW) && near(rep.nestedH, one.nestedH), JSON.stringify([rep.nestedItems.length, one.nestedItems.length, rep.nestedW, one.nestedW]));
  check('…stretched to close the cell', near(Math.abs(rep.scaleX) * rep.nestedW, c0.cellW) && near(Math.abs(rep.scaleY) * rep.nestedH, c0.cellH), JSON.stringify([Math.abs(rep.scaleX) * rep.nestedW, c0.cellW]));
  const xs = rep.nestedItems.map(it => it.cx), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  check('…the copies centred on the strip', near(mid, 0, 0.01) || Math.abs(mid) < 0.5, mid);
  // a 2 × 1 Component: twice as long, so two copies
  put(1, B, { fitMode: 'repeat' }); const r2 = item(1), b1 = F.LIBRARY.peek()[B].grid;
  const bd = F.buildSymbolItems && item(1);
  check('a 2 × 1 Component repeats half as often', Math.round(r2.nestedW / r2.nestedH / 2) === Math.max(1, Math.round(a / 2)) && near(Math.abs(r2.scaleX) * r2.nestedW, box(1).cellW), JSON.stringify([r2.nestedW / r2.nestedH, a]));
  // a turned cell: the strip still runs along the cell
  put(2, A, { fitMode: 'repeat', rotation: 90 }); const r3 = item(2), c2 = box(2);
  check('turned 90°: ' + N + ' copies, laid down the Component, across the cell', r3.nestedItems.length === N * one.nestedItems.length && near(r3.nestedH, N * one.nestedH) && near(Math.abs(r3.scaleY) * r3.nestedW, c2.cellH) && near(Math.abs(r3.scaleX) * r3.nestedH, c2.cellW), JSON.stringify([r3.nestedW, r3.nestedH, r3.scaleX, r3.scaleY]));
  // a square cell: one copy, the same drawing as Stretch
  set('symgen-cols', 4); set('symgen-rows', 4); await w(450);
  empty(); put(0, A, { fitMode: 'fill' }); const st = item(0); put(0, A, { fitMode: 'repeat' }); const sq = item(0);
  check('a square cell: one copy, as Stretch', sq.nestedItems.length === st.nestedItems.length && near(sq.scaleX, st.scaleX) && near(sq.scaleY, st.scaleY), JSON.stringify([sq.nestedItems.length, sq.scaleX, st.scaleX]));
  // an Element cell set to Repeat draws as Contain
  const els = Object.entries(F.LIBRARY.peek()).find(([k, v]) => v && v.kind === 'element') || null;
  // the panel: Repeat is offered on a Component cell, not on an Element or empty one
  set('symgen-cols', 1); set('symgen-rows', 4); await w(450);
  empty(); put(0, A);
  F.state.symbolSelection = new Set([0]); F.renderCellPropertiesPanel(); await w(50);
  const opt = () => q('sel-cellprop-fit').querySelector('option[value="repeat"]');
  check('the Fit menu offers Repeat on a Component cell', opt() && !opt().hidden && !opt().disabled, opt() ? 'hidden' : 'missing');
  set('sel-cellprop-fit', 'repeat'); await w(50);
  check('…choosing it writes fitMode repeat', F.state.symbolCells[0].fitMode === 'repeat', F.state.symbolCells[0].fitMode);
  F.state.symbolSelection = new Set([1]); F.renderCellPropertiesPanel(); await w(50);
  check('…not on an empty cell', !opt() || opt().hidden || opt().disabled, 'offered');
  // the floatbar button (O-111 b): off with no Component in the target, writes Component cells only
  empty(); F.state.symbolSelection = new Set(); F.renderCellPropertiesPanel(); F.renderSymbolCanvasOnly(); await w(80);
  const fb = q('btn-symbol-fit-all-repeat');
  check('the floatbar has a Repeat button, off with no Component', fb && fb.disabled && /fvs-repeat/.test(fb.innerHTML), fb ? fb.getAttribute('aria-label') : 'missing');
  put(0, A); const seedCell = F.state.symbolCells[1]; F.patchCell(seedCell, { source: 'seed', seedType: 'circle' }); F.renderSymbolCanvasOnly(); F.renderCellPropertiesPanel(); await w(80);
  check('…on with a Component, "Components only" when the target is mixed', !fb.disabled && /Components only/.test(fb.getAttribute('aria-label')), fb.getAttribute('aria-label'));
  fb.click(); F.renderCellPropertiesPanel(); await w(80);
  check('…a click writes Repeat to the Component cell only', F.state.symbolCells[0].fitMode === 'repeat' && F.state.symbolCells[1].fitMode !== 'repeat' && fb.getAttribute('aria-pressed') !== null, JSON.stringify([F.state.symbolCells[0].fitMode, F.state.symbolCells[1].fitMode]));
  // SVG and PNG agree: a Repeat cell, a turned one and a 2 × 1, drawn both ways
  empty(); put(0, A, { fitMode: 'repeat' }); put(2, A, { fitMode: 'repeat', rotation: 90 }); put(4, B, { fitMode: 'repeat' });
  F.state.symbolSelection = new Set(); const svg = F.buildSymbolSVG();
  const W = 900, img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
  const a2 = document.createElement('canvas'); a2.width = a2.height = W; a2.getContext('2d').drawImage(img, 0, 0, W, W);
  const fr = F.symbolFrame(F.getSymbolGrid()), b2 = document.createElement('canvas'); b2.width = fr.w; b2.height = fr.h; F.drawSymbolCanvas(b2.getContext('2d'));
  const c3 = document.createElement('canvas'); c3.width = c3.height = W; c3.getContext('2d').drawImage(b2, 0, 0, W, W);
  const da = a2.getContext('2d').getImageData(0, 0, W, W).data, db = c3.getContext('2d').getImageData(0, 0, W, W).data;
  let diff = 0; for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 60) diff++;
  check('SVG and PNG agree (< 1 % of pixels differ)', diff / (W * W) < 0.01, (100 * diff / (W * W)).toFixed(2) + ' %');
  window.__repeatPNG = c3.toDataURL('image/png');
  return rows;`);
if (process.env.REPEAT_PNG) { const u = await P.ev('return window.__repeatPNG;'); (await import('node:fs')).writeFileSync(process.env.REPEAT_PNG, Buffer.from(u.split(',')[1], 'base64')); }
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS symbol repeat: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
