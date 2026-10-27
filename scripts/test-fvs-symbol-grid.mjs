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
  // Square cells (after Rows — Diego): Columns × Rows as chosen, exact squares, centred both ways, Rows always shown
  const order = [...q('symgrid-gen-params').children].map(e => e.id).filter(Boolean);
  check('Square cells sits right after Rows', order.indexOf('symgen-square-row') === order.indexOf('symgen-row-rows') + 1, order.join());
  for (const [preset, cols, rows] of [['Portrait 4:5', 6, 8], ['Vertical 9:16', 6, 8], ['Landscape 1.91:1', 6, 8], ['Portrait 3:4', 9, 12], ['A4 portrait', 5, 5]]) {
    set('sel-symcanvas-preset', preset); await w(100);
    if (!q('chk-symgen-square').checked) set('chk-symgen-square', true);
    set('symgen-cols', cols); set('symgen-rows', rows); await settle();
    const cells = F.state.symbolGrid.cells, s0 = cells[0].width;
    const square = cells.every(c => Math.abs(c.width - s0) < 0.01 && Math.abs(c.height - s0) < 0.01);
    const cv = F.state.symbolGrid.canvas, top = Math.min(...cells.map(c => c.y)), bottom = cv.height - Math.max(...cells.map(c => c.y + c.height));
    const left = Math.min(...cells.map(c => c.x)), right = cv.width - Math.max(...cells.map(c => c.x + c.width));
    check('Square cells on ' + preset + ' ' + cols + ' × ' + rows + ': ' + q('symbol-cellcount-hint').textContent + ', exact squares, centred, Rows shown', square && cells.length === cols * rows && Math.abs(top - bottom) < 0.5 && Math.abs(left - right) < 0.5 && !q('symgen-row-rows').hidden, JSON.stringify([cells.length, s0, top, bottom, left, right]));
  }
  // Overflow (with Square cells): the squares go on to the canvas's edges, margin included, cut there; the chosen grid stays put
  { set('sel-symcanvas-preset', 'Portrait 4:5'); set('symgen-cols', 6); set('symgen-rows', 6); await settle();
    const base = F.state.symbolGrid.cells.map(c => c.x.toFixed(2) + ',' + c.y.toFixed(2)), s0 = F.state.symbolGrid.cells[0].width;
    check('Overflow shows with Square cells on', !q('symgen-overflow-row').hidden, 'hidden');
    set('chk-symgen-overflow', true); await settle();
    const cells = F.state.symbolGrid.cells, cv = F.state.symbolGrid.canvas, at = new Set(cells.map(c => c.x.toFixed(2) + ',' + c.y.toFixed(2)));
    const minX = Math.min(...cells.map(c => c.x)), maxX = Math.max(...cells.map(c => c.x + c.width)), minY = Math.min(...cells.map(c => c.y)), maxY = Math.max(...cells.map(c => c.y + c.height));
    const ok = cells.every(c => Math.abs(c.width - s0) < 0.01 && Math.abs(c.height - s0) < 0.01) && minX <= 0.01 && minY <= 0.01 && maxX >= cv.width - 0.01 && maxY >= cv.height - 0.01 && base.every(k => at.has(k));
    check('Overflow on Portrait 4:5 6 × 6: ' + q('symbol-cellcount-hint').textContent + ' — the canvas covered to its edges, same squares, the 6 × 6 where it was', ok, JSON.stringify([cells.length, minX, minY, maxX, maxY, cv.width, cv.height, base.filter(k => !at.has(k)).length]));
    check('…the Symbol keeps what was asked (6 × 6, Overflow) — the extra tracks are the model’s', F.state.symbolGrid.canvas.fvsFrame.params.cols === 6 && F.state.symbolGrid.canvas.fvsFrame.params.overflow === true, JSON.stringify(F.state.symbolGrid.canvas.fvsFrame.params));
    const sv = F.buildSymbolSVG();
    check('…the export is the canvas (viewBox), so a cut square ends at its edge', /viewBox="0 0 1080 1350"/.test(sv), (sv.match(/viewBox="[^"]+"/) || [])[0]);
    // Keep margin: the squares to the margin's box, cut at the margin line; the margin stays Paper (SVG and PNG)
    check('Keep margin shows with Overflow on', !q('symgen-keepmargin-row').hidden, 'hidden');
    set('chk-symgen-keepmargin', true); await settle();
    { const cells = F.state.symbolGrid.cells, cv = F.state.symbolGrid.canvas, m = Math.min(cv.width, cv.height) * 0.05, cr = F.state.symbolGrid.grid.clipRect;
      const minX = Math.min(...cells.map(c => c.x)), maxX = Math.max(...cells.map(c => c.x + c.width));
      const sv = F.buildSymbolSVG();
      const png = await new Promise(res => { const dl = Organica.download; Organica.download = b => { Organica.download = dl; const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d'); x.drawImage(i, 0, 0); res([x.getImageData(Math.round(m / 2), Math.round(cv.height / 2), 1, 1).data, x.getImageData(Math.round(m + 2), Math.round(cv.height / 2), 1, 1).data]); }; i.src = URL.createObjectURL(b); }; q('sel-export-scale').value = '1'; F.exportSymbol('png'); });
      const paper = F.state.paperColor.toLowerCase(), hex = d => '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      check('Keep margin: ' + q('symbol-cellcount-hint').textContent + ' — to the margin, cut there (SVG clip), the margin Paper in the PNG', cr && Math.abs(cr.x - m) < 0.01 && minX <= m + 0.01 && minX > -0.01 && maxX >= cv.width - m - 0.01 && /<clipPath id="mclip-/.test(sv) && hex(png[0]) === paper, JSON.stringify([cr, minX, maxX, hex(png[0]), paper])); }
    set('chk-symgen-keepmargin', false); await settle();
    check('Keep margin off: no margin cut', !F.state.symbolGrid.grid.clipRect && !/mclip-/.test(F.buildSymbolSVG()), 'still cut');
    set('chk-symgen-overflow', false); await settle();
    set('chk-symgen-square', false); await settle();
    check('Square cells off: Overflow hides', q('symgen-overflow-row').hidden, 'shown'); }
  set('chk-symgen-square', false); await settle();
  check('Square cells off: the cells fill the margin box again', Math.abs(Math.min(...F.state.symbolGrid.cells.map(c => c.x)) - Math.min(F.state.symbolGrid.canvas.width, F.state.symbolGrid.canvas.height) * 0.05) < 0.5, Math.min(...F.state.symbolGrid.cells.map(c => c.x)));
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
  // the story safe zone (O-77): a guide on 9:16 only, under Show guides, never exported; the numbers = Loom's
  { set('sel-symcanvas-preset', 'Vertical 9:16'); await settle();
    const r = q('symbol-frame').querySelector('.sym-story-safe'), g = F.state.symbolView.guides;
    const want = [0.06 * 1080, 0.14 * 1920, 0.88 * 1080, 0.51 * 1920].map(v => v.toFixed(2)).join();
    check('Vertical 9:16: the story safe zone under Show guides (' + (r ? ['x', 'y', 'width', 'height'].map(k => r.getAttribute(k)).join() : 'none') + ')', g && r && ['x', 'y', 'width', 'height'].map(k => r.getAttribute(k)).join() === want, want);
    check('…never in the export', !/sym-story-safe/.test(F.buildSymbolSVG()), 'in the SVG');
    set('sel-symcanvas-preset', 'Portrait 4:5'); await settle();
    check('…and not on another format', !q('symbol-frame').querySelector('.sym-story-safe'), 'shown on 4:5');
    const L = await import('/loom/js/canvas-manager.js');
    check('…its numbers = Loom’s STORY_SAFE', JSON.stringify(L.STORY_SAFE) === JSON.stringify(F.STORY_SAFE) && L.storySafeRect({ width: 1080, height: 1920 }).width === 0.88 * 1080, JSON.stringify([L.STORY_SAFE, F.STORY_SAFE])); }
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
