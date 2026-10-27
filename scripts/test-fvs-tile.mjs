#!/usr/bin/env node
// FVS Component › Tile (Oct 26, 2026 — Diego: Elements that overlap their neighbours without changing shape, for
// continuous patterns; plan Phase 2, then: "solo sul componente selezionato", "come quello dell'element … nell'edit del
// component, con una preview"). In Component Edit only, as part of the edit (Back to board drops it, Save as new keeps
// it): Layout (Grid · Brick · Half-drop · Alternate) moves every other row / column / cell by Offset X / Y (% of a cell),
// On top says which group covers the other (the whole cell), Tile seamlessly makes the Component one period; Gap below 0
// brings the cells together; the floatbar's Show as tile shows the Component with its repeats faded around it. A cell's
// own Move X / Y and Bring forward / Send backward (Phase 3). Usage: scripts/test-fvs-tile.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 5 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const raster = async svg => { const m = svg.match(/viewBox="([^"]+)"/), vb = m[1].split(' ').map(Number), N = 200, H = Math.round(N * vb[3] / vb[2]);
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(new Blob([svg.replace(/<svg\\b([^>]*?)\\swidth="[^"]*"\\sheight="[^"]*"/, '<svg$1 width="' + N + '" height="' + H + '"')], { type: 'image/svg+xml' })); });
    const c = document.createElement('canvas'); c.width = N; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, N, H).data, N, H }; };
  const dark = (R, i, j) => R.d[(j * R.N + i) * 4] < 128;
  const edgeMatch = (R, axis) => { let same = 0, n = 0; if (axis === 'x') for (let j = 0; j < R.H; j++) { n++; if (dark(R, 0, j) === dark(R, R.N - 1, j)) same++; } else for (let i = 0; i < R.N; i++) { n++; if (dark(R, i, 0) === dark(R, i, R.H - 1)) same++; } return same / n; };
  const eg = () => F.state.componentEditGrid, ceItems = () => F.buildComponentItems({ cells: F.state.componentEditCells }, eg());
  const editSVG = () => F.buildComponentSVG(ceItems(), F.state.componentEditDefaultSeed, F.frameDims(eg()));
  F.setTier('element'); set('sel-seed-type', 'lens'); await w(300);
  F.setTier('component'); await w(500); set('rg-grid-cols', 4); set('rg-grid-rows', 4); set('rg-gap', 0); set('sel-rule', 'checkerboard'); q('btn-generate').click(); await w(1200);
  const n0 = F.state.components.length, id0 = F.state.components[0].id;
  check('at its defaults no Component has a Tile (every grid before is unchanged)', !F.getGrid().overlap && F.state.components.every(c => !c.tile && !F.gridOf(c).overlap), 'tile');
  check('on the Component step: no Tile section, no Show as tile', q('tile-section').hidden && q('btn-component-view-tile').hidden, [q('tile-section').hidden, q('btn-component-view-tile').hidden]);
  check('Gap goes below 0 (to −80)', q('rg-gap').min === '-80', q('rg-gap').min);
  F.enterComponentEditMode(id0); await w(500);
  check('in Component Edit: the Tile section and Show as tile', !q('tile-section').hidden && !q('btn-component-view-tile').hidden && q('sel-tile-layout').value === 'grid' && q('tile-offset-x-row').hidden, [q('tile-section').hidden, q('btn-component-view-tile').hidden]);
  { const w0 = F.frameDims(eg()).w; set('rg-ce-gap', -30); await w(300);
    check('Edit’s Grid has Gap: the step’s (the board’s slider with it), the edit draws it', eg().gap === -30 && q('rg-gap').value === '-30' && F.frameDims(eg()).w < w0, JSON.stringify([eg().gap, q('rg-gap').value]));
    set('rg-ce-gap', 0); await w(200); }
  const presets = {};
  for (const lay of ['brick', 'halfdrop', 'alternate']) { set('sel-tile-layout', lay); await w(150); presets[lay] = q('rg-tile-offset-x').value + '/' + q('rg-tile-offset-y').value; }
  check('Layout presets its offset: Brick 50 / 0, Half-drop 0 / 50, Alternate 25 / 25; Offset and On top shown', presets.brick === '50/0' && presets.halfdrop === '0/50' && presets.alternate === '25/25' && !q('tile-offset-x-row').hidden && !q('tile-top-row').hidden, JSON.stringify(presets));
  set('sel-tile-layout', 'brick'); await w(300);
  check('it goes on the edit, not on the Component yet', eg().overlap && eg().overlap.by === 'rows' && !F.state.components.find(c => c.id === id0).tile, JSON.stringify([eg().overlap, F.state.components.find(c => c.id === id0).tile]));
  const items = ceItems();
  check('Brick: every other row moved by half a cell, the others still', items.every((it, i) => Math.abs((it.dx || 0) - (Math.floor(i / 4) % 2 ? 0.5 * (it.cellW || it.cellSize) : 0)) < 1e-6), JSON.stringify(items.map(it => +(it.dx || 0).toFixed(1))));
  set('chk-tile-seamless', true); await w(300);
  const d1 = F.frameDims(eg());
  check('Tile seamlessly: the frame is one period, cols × (cell + gap)', Math.abs(d1.w - 4 * (eg().cellSize + eg().gap)) < 1e-6, d1.w);
  const R = await raster(editSVG());
  check('…and its left and right edges meet, as its top and bottom', edgeMatch(R, 'x') > 0.97 && edgeMatch(R, 'y') > 0.97, edgeMatch(R, 'x').toFixed(3) + ' / ' + edgeMatch(R, 'y').toFixed(3));
  set('chk-tile-seamless', false); await w(300);
  const R0 = await raster(editSVG());
  check('without it the edges do not meet (the test sees a seam)', edgeMatch(R0, 'x') < 0.97, edgeMatch(R0, 'x').toFixed(3));
  set('chk-tile-seamless', true); set('sel-tile-top', 'moved'); await w(200);
  const order = F.drawOrder(ceItems()).filter(it => !it.copy).map(it => it.oc).join('');
  check('On top · The moved cells: drawn after the others', /^0+1+$/.test(order), order);
  set('sel-tile-top', 'still'); await w(200);
  const order2 = F.drawOrder(ceItems()).filter(it => !it.copy).map(it => it.oc).join('');
  check('On top · The other cells: drawn after the moved ones', /^1+0+$/.test(order2), order2);
  check('On top draws the whole cell (not layer by layer)', F.layerPasses({ layers: [{}, {}] }, ceItems()) === null, 'passes');
  // Weave (Phase 5): every cell masked by the neighbours over it; Margin grows them; works on Grid too
  set('sel-tile-layout', 'grid'); await w(150);
  check('On top on Grid: Reading order and Weave only', [...q('sel-tile-top').options].filter(o => !o.hidden).map(o => o.value).join() === 'order,weave', [...q('sel-tile-top').options].filter(o => !o.hidden).map(o => o.value).join());
  set('sel-tile-top', 'weave'); await w(200);
  check('Weave: Margin shown, saved with the Tile', !q('tile-margin-row').hidden && eg().overlap && eg().overlap.top === 'weave' && eg().overlap.margin === 0.02, JSON.stringify(eg().overlap));
  { const sv = editSVG(), covers = F.weaveCovers(F.drawOrder(ceItems())), n = covers.filter(c => c.length).length;
    // a cycle: no single drawing order can do it — some cell is over a neighbour that is over another that is over it
    const over = new Map(); covers.forEach((c, k) => c.forEach(j => { over.set(k + '>' + j, true); }));
    check('Weave: cells masked by the neighbours over them (' + n + '), a mask and a dilate per masked cell', n > 4 && (sv.match(/<mask id="weave-/g) || []).length === n && (sv.match(/feMorphology/g) || []).length === n, n + ' / ' + (sv.match(/<mask id="weave-/g) || []).length);
    check('…each pair decided once: never both over each other', [...over.keys()].every(k => { const [a, b] = k.split('>'); return !over.has(b + '>' + a); }), 'a pair both ways'); }
  // the over / under goes round each cell (Oct 27, 2026 — gallery tiles 30–31): on Grid two of the four diagonals over
  // it, on Brick three of its six nearest neighbours — never a cell over (or under) every neighbour
  { const roundOf = (grid, nearest) => { const comp = { cells: Array.from({ length: 36 }, () => ({ rotation: 0, flipH: false, flipV: false, scale: 1 })) };
      const items = F.buildComponentItems(comp, grid), drawn = F.drawOrder(items), cov = F.weaveCovers(drawn), out = [];
      drawn.forEach((a, i) => { if (a.copy) return; const d = (b) => Math.hypot(b.cx + (b.dx || 0) - a.cx - (a.dx || 0), b.cy + (b.dy || 0) - a.cy - (a.dy || 0));
        const nb = drawn.map((b, j) => j).filter(j => j !== i).sort((x, y) => d(drawn[x]) - d(drawn[y])).filter(j => nearest(d(drawn[j]) / a.ov.px));
        out.push(nb.filter(j => cov[i].includes(j)).length + '/' + nb.length); });
      return [...new Set(out)].join(' '); };
    const base = { kind: 'square', cols: 6, rows: 6, cellSize: 160, gap: -110 };
    const diag = roundOf({ ...base, overlap: { by: 'rows', x: 0, y: 0, top: 'weave', wrap: true, margin: 0.02 } }, r => r > 1.2 && r < 1.6);
    check('Interlace on Grid: two of the four diagonals over each cell', diag === '2/4', diag);
    const brick = roundOf({ ...base, gap: -100, overlap: { by: 'rows', x: 0.5, y: 0, top: 'weave', wrap: true, margin: 0.02 } }, r => r < 1.2);
    check('Interlace on Brick: three of the six nearest over each cell', brick === '3/6', brick);
    const drop = roundOf({ ...base, gap: -100, overlap: { by: 'cols', x: 0, y: 0.5, top: 'weave', wrap: true, margin: 0.02 } }, r => r < 1.2);
    check('Interlace on Half-drop: three of the six nearest over each cell', drop === '3/6', drop); }
  set('rg-tile-margin', 0); await w(200); F.applyTileUI(eg().overlap); await w(100);
  check('Crossing gap 0 is kept (back on the panel as 0)', eg().overlap.margin === 0 && q('rg-tile-margin').value === '0', JSON.stringify([eg().overlap.margin, q('rg-tile-margin').value]));
  set('sel-tile-layout', 'brick'); set('sel-tile-top', 'still'); await w(200);
  // Plates (Phase 4): where an ink is covered it does not print
  { const raster = async sv => { const vb = sv.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number), W = 240, H = Math.round(W * vb[3] / vb[2]);
      const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(new Blob([sv.replace(/<svg\b([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '<svg$1 width="' + W + '" height="' + H + '"')], { type: 'image/svg+xml' })); });
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, W, H).data, W, H }; };
    const inkAt = (R, fx, fy) => R.d[(Math.round(fy * R.H) * R.W + Math.round(fx * R.W)) * 4 + 3] > 128;
    const two = ['#1d3b2a', '#c2462e'], comp = { cells: [0, 1].map(k => ({ rotation: 0, flipH: false, flipV: false, scale: 1, color: two[k] })) }, grid = { kind: 'square', cols: 2, rows: 1, cellSize: 160, gap: -80 };
    const svg = F.withEntryInks ? F.buildComponentSVG(F.buildComponentItems(comp, grid), { ...F.getSeed(), type: 'circle' }, F.frameDims(grid)) : '';
    const p0 = await raster(F.plateSVG(svg, two, 0, F.state.paperColor)), p1 = await raster(F.plateSVG(svg, two, 1, F.state.paperColor));
    check('Plates: where the second circle covers the first, the first ink does not print; the second does', !inkAt(p0, 0.5, 0.5) && inkAt(p1, 0.5, 0.5) && inkAt(p0, 0.2, 0.5) && inkAt(p1, 0.8, 0.5), JSON.stringify([inkAt(p0, 0.5, 0.5), inkAt(p1, 0.5, 0.5)]));
    const mult = svg.replace(/<g transform/g, '<g style="mix-blend-mode:multiply" transform'), m0 = await raster(F.plateSVG(mult, two, 0, F.state.paperColor));
    const apart = { kind: 'square', cols: 2, rows: 1, cellSize: 160, gap: 0 }, plain = F.buildComponentSVG(F.buildComponentItems(comp, apart), { ...F.getSeed(), type: 'circle' }, F.frameDims(apart));
    check('Plates where nothing covers: the plain plate (no mask)', !/<mask/.test(F.plateSVG(plain, two, 0, F.state.paperColor)) && /<mask/.test(F.plateSVG(svg, two, 0, F.state.paperColor)), 'mask');
    check('Plates with Multiply: overprint — each ink whole', inkAt(m0, 0.5, 0.5) && inkAt(m0, 0.2, 0.5), JSON.stringify(inkAt(m0, 0.5, 0.5))); }
  // the preview
  q('btn-component-view-tile').click(); await w(300);
  const sv = q('component-edit-frame').querySelector('svg'), vb = sv.getAttribute('viewBox').split(' ').map(Number), fd = F.frameDims(eg());
  check('Show as tile: the frame and half of each neighbour, 8 faded copies', q('btn-component-view-tile').getAttribute('aria-pressed') === 'true' && Math.abs(vb[2] - 2 * fd.w) < 0.01 && sv.querySelectorAll('.fvs-tile-ghost use').length === 8, JSON.stringify(vb));
  check('…the cells still pickable (one hit box each)', q('component-edit-frame').querySelectorAll('[data-cell-index]').length === 16, q('component-edit-frame').querySelectorAll('[data-cell-index]').length);
  q('btn-component-view-tile').click(); await w(300);
  check('off: the frame alone', q('component-edit-frame').querySelector('svg').getAttribute('viewBox').startsWith('0 0'), q('component-edit-frame').querySelector('svg').getAttribute('viewBox'));
  // Edit undo
  { const before = JSON.stringify(eg().overlap); set('chk-tile-seamless', false); await w(200); F.ceUndoStep(); await w(300);
    check('Edit undo: a Tile change is its own step, the panel follows', JSON.stringify(eg().overlap) === before && q('chk-tile-seamless').checked, JSON.stringify([before, eg().overlap])); }
  // a cell's own Move and order (Phase 3)
  F.selectComponentEditCell(0); F.cePicked = new Set([0]); F.syncCeCellProps(); await w(300);
  check('Edit: Move X / Y and the order buttons shown for a picked cell', !q('ce-row-cellprop-move-x').hidden && !q('ce-row-cellprop-order').hidden, 'hidden');
  set('ce-rg-cellprop-move-x', 40); await w(300);
  const it0 = ceItems()[0];
  check('Move X 40: the cell moves 40 % of its width', Math.abs((it0.ox || 0) - 0.4 * (it0.cellW || it0.cellSize)) < 1e-6 && F.state.componentEditCells[0].moveX === 0.4, JSON.stringify([it0.ox, F.state.componentEditCells[0].moveX]));
  q('ce-btn-cellprop-forward').click(); await w(300);
  const top = F.drawOrder(ceItems()).filter(x => !x.copy), last = top[top.length - 1];
  check('Bring forward: drawn over every other cell, the button then off', F.state.componentEditCells[0].z === 1 && last.cx === ceItems()[0].cx && last.cy === ceItems()[0].cy && q('ce-btn-cellprop-forward').disabled, JSON.stringify(F.state.componentEditCells[0].z));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true })); await w(300);
  check('⌥↓ Send backward: under every other cell', F.state.componentEditCells[0].z === -1 && q('ce-btn-cellprop-backward').disabled, JSON.stringify(F.state.componentEditCells[0].z));
  // Save as new keeps the Tile on the new Component only
  q('btn-component-edit-save').click(); await w(600);
  const made = F.state.components.find(c => c.id === F.state.selectedId);
  check('Save as new component: the new one has its Tile, the others none', F.state.components.length === n0 + 1 && made.tile && made.tile.by === 'rows' && made.tile.wrap && F.state.components.filter(c => c !== made).every(c => !c.tile), JSON.stringify(made && made.tile));
  if (F.state.componentEditMode) { F.exitComponentEditMode(); await w(300); }
  check('back on the board: no Tile section', q('tile-section').hidden, 'shown');
  // Back to board drops an edit's Tile
  F.enterComponentEditMode(id0); await w(400); set('sel-tile-layout', 'halfdrop'); await w(200); F.exitComponentEditMode(); await w(300);
  check('Back to board: the edit’s Tile is dropped', !F.state.components.find(c => c.id === id0).tile, 'kept');
  // saved in the library with it, and in a Symbol one period
  F.quickSaveComponentToLibrary(made.id); await w(300);
  const entry = Organica.store('fvs').read()[made.savedName];
  check('saved with the Component (its grid’s overlap)', entry && entry.grid.overlap && entry.grid.overlap.wrap, JSON.stringify(entry && entry.grid));
  F.setTier('symbol'); await w(500); F.railApply('component', made.savedName, 0); await w(300);
  check('in a Symbol: its copies cut at its frame', /id="nwrap-/.test(F.buildSymbolSVG()), 'no nwrap clip');
  F.setTier('component'); await w(300);
  set('rg-cellsize', 60); set('rg-gap', -80); await w(200);
  const gs = [false, true].map(sm => { const g = { ...F.getGrid(), overlap: sm ? { by: 'rows', x: 0, y: 0, top: 'order', wrap: true } : undefined }, d = F.frameDims(g); return d.w > 0 && d.h > 0 && g.gap > -60; });
  check('Gap −80 at Cell size 60: the frame never collapses (seamless off and on)', gs.every(Boolean), JSON.stringify(gs));
  set('rg-cellsize', 160); set('rg-gap', 0); await w(200);
  F.setCellShape('hexagon'); await w(300);
  F.enterComponentEditMode(F.state.components[0] && F.state.components[0].id); await w(300);
  check('a cell-shape lattice: no Tile, no Show as tile', q('tile-section').hidden && q('btn-component-view-tile').hidden, 'shown');
  if (F.state.componentEditMode) F.exitComponentEditMode();
  F.setCellShape('square'); await w(300);
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS tile: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
