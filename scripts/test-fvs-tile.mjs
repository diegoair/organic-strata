#!/usr/bin/env node
// FVS Component › Tile (Oct 26, 2026 — Diego: Elements that overlap their neighbours without changing shape, for
// continuous patterns; plan Phase 2): Layout (Grid · Brick · Half-drop · Alternate) moves every other row / column /
// cell by Offset X / Y (% of a cell), On top says which group covers the other (the whole cell), Tile seamlessly makes the
// Component one period (what leaves an edge comes back on the opposite one), Gap below 0 brings the cells together.
// It draws the Components there are (never Generate's dot), is saved with a Component, reaches the Symbol, and is
// absent at its defaults. Usage: scripts/test-fvs-tile.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 5 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  // the edge columns / rows of a Component drawn on a canvas
  const raster = async svg => { const m = svg.match(/viewBox="([^"]+)"/), vb = m[1].split(' ').map(Number), N = 200, H = Math.round(N * vb[3] / vb[2]);
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(new Blob([svg.replace(/<svg\\b([^>]*?)\\swidth="[^"]*"\\sheight="[^"]*"/, '<svg$1 width="' + N + '" height="' + H + '"')], { type: 'image/svg+xml' })); });
    const c = document.createElement('canvas'); c.width = N; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, N, H).data, N, H }; };
  const dark = (R, i, j) => R.d[(j * R.N + i) * 4] < 128;
  const edgeMatch = (R, axis) => { let same = 0, n = 0; if (axis === 'x') for (let j = 0; j < R.H; j++) { n++; if (dark(R, 0, j) === dark(R, R.N - 1, j)) same++; } else for (let i = 0; i < R.N; i++) { n++; if (dark(R, i, 0) === dark(R, i, R.H - 1)) same++; } return same / n; };
  const compSVG = () => { const c = F.state.components[0], g = F.gridOf(c); return F.buildComponentSVG(F.buildComponentItems(c, g), F.getSeed(), F.frameDims(g)); };
  F.setTier('element'); set('sel-seed-type', 'lens'); await w(300);
  F.setTier('component'); await w(500); set('rg-grid-cols', 4); set('rg-grid-rows', 4); set('rg-gap', 0); set('sel-rule', 'checkerboard'); q('btn-generate').click(); await w(1200);
  check('at its defaults the grid has no overlap (every grid before is unchanged)', !F.getGrid().overlap && q('tile-offset-x-row').hidden && q('tile-top-row').hidden, JSON.stringify(F.getGrid().overlap));
  check('Gap goes below 0 (to −80)', q('rg-gap').min === '-80', q('rg-gap').min);
  const presets = {};
  for (const lay of ['brick', 'halfdrop', 'alternate']) { set('sel-tile-layout', lay); await w(150); presets[lay] = q('rg-tile-offset-x').value + '/' + q('rg-tile-offset-y').value; }
  check('Layout presets its offset: Brick 50 / 0, Half-drop 0 / 50, Alternate 25 / 25; Offset and On top shown', presets.brick === '50/0' && presets.halfdrop === '0/50' && presets.alternate === '25/25' && !q('tile-offset-x-row').hidden && !q('tile-top-row').hidden, JSON.stringify(presets));
  check('Tile never lights Generate’s dot', !q('btn-generate').classList.contains('is-stale'), 'stale');
  set('sel-tile-layout', 'brick'); await w(300);
  const c0 = F.state.components[0], items = F.buildComponentItems(c0, F.gridOf(c0));
  check('Brick: every other row moved by half a cell, the others still', items.every((it, i) => Math.abs((it.dx || 0) - (Math.floor(i / 4) % 2 ? 0.5 * (it.cellW || it.cellSize) : 0)) < 1e-6), JSON.stringify(items.map(it => +(it.dx || 0).toFixed(1))));
  const plainW = F.frameDims({ ...F.gridOf(c0), overlap: undefined }).w;
  set('chk-tile-seamless', true); set('rg-gap', -40); await w(400);
  const g1 = F.gridOf(c0), d1 = F.frameDims(g1);
  check('Tile seamlessly: the frame is one period, cols × (cell + gap)', Math.abs(d1.w - 4 * (g1.cellSize - 40)) < 1e-6, d1.w + ' vs ' + 4 * (g1.cellSize - 40));
  const R = await raster(compSVG());
  check('…and its left and right edges meet, as its top and bottom', edgeMatch(R, 'x') > 0.97 && edgeMatch(R, 'y') > 0.97, edgeMatch(R, 'x').toFixed(3) + ' / ' + edgeMatch(R, 'y').toFixed(3));
  set('chk-tile-seamless', false); await w(300);
  const R0 = await raster(compSVG());
  check('without it the edges do not meet (the test sees a seam)', edgeMatch(R0, 'x') < 0.97, edgeMatch(R0, 'x').toFixed(3));
  set('chk-tile-seamless', true); await w(200);
  set('sel-tile-top', 'moved'); await w(200);
  const order = F.drawOrder(F.buildComponentItems(c0, F.gridOf(c0))).filter(it => !it.copy).map(it => it.oc).join('');
  check('On top · The moved cells: drawn after the others', /^0+1+$/.test(order), order);
  set('sel-tile-top', 'still'); await w(200);
  const order2 = F.drawOrder(F.buildComponentItems(c0, F.gridOf(c0))).filter(it => !it.copy).map(it => it.oc).join('');
  check('On top · The other cells: drawn after the moved ones', /^1+0+$/.test(order2), order2);
  check('On top draws the whole cell (not layer by layer)', F.layerPasses({ layers: [{}, {}] }, F.buildComponentItems(c0, F.gridOf(c0))) === null, 'passes');
  // saved with the Component, and back on the panel when it is opened again
  F.quickSaveComponentToLibrary(c0.id); await w(300);
  const entry = Organica.store('fvs').read()[c0.savedName];
  check('saved with the Component (its grid’s overlap)', entry && entry.grid.overlap && entry.grid.overlap.wrap && entry.grid.overlap.by === 'rows' && entry.grid.gap === -40, JSON.stringify(entry && entry.grid));
  set('sel-tile-layout', 'grid'); set('chk-tile-seamless', false); set('rg-gap', 0); await w(200);
  F.applyLibraryEntryToUI(entry); await w(300);
  check('opened again: its Tile on the panel', q('sel-tile-layout').value === 'brick' && q('chk-tile-seamless').checked && q('sel-tile-top').value === 'still' && q('rg-tile-offset-x').value === '50', [q('sel-tile-layout').value, q('chk-tile-seamless').checked, q('sel-tile-top').value]);
  // the Symbol: the Component one period, cut at its frame
  F.setTier('symbol'); await w(500); F.railApply('component', c0.savedName, 0); await w(300);
  check('in a Symbol: its copies cut at its frame', /id="nwrap-/.test(F.buildSymbolSVG()), 'no nwrap clip');
  F.setTier('component'); await w(300);
  set('sel-tile-layout', 'grid'); set('chk-tile-seamless', false); set('rg-gap', 0); await w(200);
  set('rg-cellsize', 60); set('rg-grid-cols', 4); set('rg-gap', -80); await w(200);
  const gs = [false, true].map(sm => { q('chk-tile-seamless').checked = sm; const g = F.getGrid(), d = F.frameDims(g); return d.w > 0 && d.h > 0 && g.gap > -60; });
  check('Gap −80 at Cell size 60: the frame never collapses (seamless off and on)', gs.every(Boolean), JSON.stringify(gs));
  set('rg-cellsize', 160); set('rg-gap', 0); set('chk-tile-seamless', false); await w(200);
  check('back at its defaults: no overlap again', !F.getGrid().overlap, JSON.stringify(F.getGrid().overlap));
  F.setCellShape('hexagon'); await w(300);
  check('a cell-shape lattice: no Tile section', q('tile-section').hidden, 'shown');
  F.setCellShape('square'); await w(300);
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS tile: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
