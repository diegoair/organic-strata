#!/usr/bin/env node
// FVS Symbol grid (Oct 27, 2026 — Diego: "al cambio di tipologia di grid si aggiorna automaticamente la canvas e la grid …
// elimina generate grid in canvas"; Columns / Rows from Loom, 2–24; Square cells; social canvas formats). The grid is live:
// a change to the Canvas or the grid rebuilds it and the cells' contents repeat as a motif; Square cells gives exact squares
// on any canvas; the presets export at their own size; a Symbol holds at most 2,048 cells; the ranges match Loom's registry.
// Usage: scripts/test-fvs-symbol-grid.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 5 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const settle = () => w(450);
  F.setTier('component'); await w(500); q('btn-generate').click(); await w(1000);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  F.quickSaveComponentToLibrary(F.state.components[1].id); await w(200); const B = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(700);
  check('no Generate grid in canvas button', !q('btn-symgrid-generate'), 'still there');
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await settle();
  set('symgen-cols', 4); set('symgen-rows', 4); await settle();
  check('a 4 × 4 grid now (Columns / Rows below 5)', F.state.symbolCells.length === 16, F.state.symbolCells.length);
  // a checkerboard motif of two Components
  const pa = F.railPatch('component', A), pb = F.railPatch('component', B);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, ((i % 4) + Math.floor(i / 4)) % 2 ? pb : pa)); F.renderSymbolCanvasOnly();
  const motif = () => F.state.symbolGrid.cells.map((c, i) => [c.row, c.col, F.state.symbolCells[i].componentName === A ? 'a' : F.state.symbolCells[i].componentName === B ? 'b' : '-']);
  set('symgen-cols', 9); set('symgen-rows', 7); await settle();
  const m = motif(), ok = m.every(([r, c, k]) => k === ((r + c) % 2 ? 'b' : 'a'));
  check('live: Columns 9 × Rows 7 rebuilds at once, the motif repeats (' + F.state.symbolCells.length + ' cells)', F.state.symbolCells.length === 63 && ok, m.filter(([r, c, k]) => k !== ((r + c) % 2 ? 'b' : 'a')).length + ' off');
  set('sel-symcanvas-preset', 'Portrait 4:5'); await settle();
  check('live: a canvas change keeps the contents', motif().every(([r, c, k]) => k === ((r + c) % 2 ? 'b' : 'a')) && F.state.symbolGrid.canvas.height === 1350, F.state.symbolGrid.canvas.height);
  set('sel-symgrid-gen', 'hexagonal'); await settle();
  check('live: another grid type, the contents carried by order', F.state.symbolGrid.cellShape === 'polygon' && F.state.symbolCells.some(c => c.componentName === A) && F.state.symbolCells.some(c => c.componentName === B), F.state.symbolGrid.cellShape);
  set('sel-symgrid-gen', 'rectangular'); await settle();
  // Square cells: exact squares on every canvas, Rows hidden, the count in the hint
  for (const preset of ['Portrait 4:5', 'Vertical 9:16', 'Landscape 1.91:1', 'Portrait 3:4', 'A4 portrait']) {
    set('sel-symcanvas-preset', preset); await w(100);
    if (!q('chk-symgen-square').checked) set('chk-symgen-square', true);
    set('symgen-cols', 6); await settle();
    const cells = F.state.symbolGrid.cells, sides = cells.map(c => [c.width, c.height]), s0 = sides[0][0];
    const square = sides.every(([a, b]) => Math.abs(a - s0) < 0.01 && Math.abs(b - s0) < 0.01);
    const cv = F.state.symbolGrid.canvas, ys = cells.map(c => c.y), top = Math.min(...ys), bottom = cv.height - Math.max(...cells.map(c => c.y + c.height));
    check('Square cells on ' + preset + ': ' + q('symbol-cellcount-hint').textContent + ', exact squares, centred, Rows hidden', square && Math.abs(top - bottom) < 0.5 && q('symgen-row-rows').hidden && /^6 × \\d+ · \\d+ cells$/.test(q('symbol-cellcount-hint').textContent), JSON.stringify([s0, top, bottom, q('symbol-cellcount-hint').textContent]));
  }
  set('chk-symgen-square', false); await settle();
  check('Square cells off: Rows back', !q('symgen-row-rows').hidden, 'hidden');
  // the presets export at their own size
  const want = { 'Square 1:1': [1080, 1080], 'Portrait 4:5': [1080, 1350], 'Portrait 3:4': [1080, 1440], 'Portrait 2:3': [1000, 1500], 'Vertical 9:16': [1080, 1920], 'Landscape 16:9': [1920, 1080], 'Landscape 1.91:1': [1080, 566] };
  const sizes = [];
  for (const [preset, [W, H]] of Object.entries(want)) {
    set('sel-symcanvas-preset', preset); await settle();
    const sv = F.buildSymbolSVG(), vb = sv.match(/viewBox="([^"]+)"/)[1];
    const png = await new Promise(res => { const dl = Organica.download; Organica.download = b => { Organica.download = dl; const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = URL.createObjectURL(b); }; q('sel-export-scale').value = '1'; F.exportSymbol('png'); });
    sizes.push(preset + ' ' + vb + ' png ' + png.join('×'));
    if (vb !== '0 0 ' + W + ' ' + H || png[0] !== W || png[1] !== H) { check('export at its size: ' + preset, false, vb + ' / ' + png); }
  }
  check('every Screen preset exports at its own size (SVG viewBox and PNG ×1)', sizes.length === 7 && rows.every(r => !r.includes('export at its size')), sizes.join(' | '));
  check('the picker groups them: Screen, Print', [...q('sel-symcanvas-preset').querySelectorAll('optgroup')].map(g => g.label).join() === 'Screen,Print', [...q('sel-symcanvas-preset').querySelectorAll('optgroup')].map(g => g.label).join());
  // the cap: 24 × 24 on 9:16 square cells is fine; Masonry / Wave 24 × 24 builds
  set('sel-symcanvas-preset', 'Square 1:1'); set('symgen-cols', 24); set('symgen-rows', 24); await settle();
  check('24 × 24 = 576 cells builds', F.state.symbolCells.length === 576 && q('symgrid-gen-error').hidden, F.state.symbolCells.length + ' ' + q('symgrid-gen-error').textContent);
  // the ranges match Loom's registry (one source)
  const G = await F.loomRegistry(), off = [];
  for (const [id, spec] of Object.entries(F.SYMGRID_GENS)) for (const [k, , a, b] of spec.params.filter(p => p[0] === 'cols' || p[0] === 'rows')) { const r = G[id] && G[id].ranges && G[id].ranges[k]; if (r && (r[0] !== a || r[1] !== b)) off.push(id + '.' + k + ' ' + a + '–' + b + ' vs Loom ' + r.join('–')); }
  const withRanges = Object.keys(F.SYMGRID_GENS).filter(id => G[id] && G[id].ranges).length;
  check('Columns / Rows ranges = Loom’s registry — Rings, Cells, Depth keep the Symbol’s own (' + withRanges + ' generators declare ranges)', withRanges >= 4 && !off.length, off.join('; ') || 'no ranges in Loom');
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS symbol grid: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
