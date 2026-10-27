#!/usr/bin/env node
// FVS Component › Tile — pattern-generation tests for the test gallery (Diego, Oct 27, 2026: "fammi dei test di
// generazioni di patterns usando tile … tutti i test salvali nella galleria … valuta eventuali bug e migliorie").
// Each case goes the user's way: Element → Component (grid, rule, Generate) → Component Edit › Tile → Save as new
// component → the Component's own export (tierSVG). It writes the SVG and measures it: export time, size, ink cover,
// seam (left/right and top/bottom edges of the raster), the masks Interlace adds, the canvas twin against the SVG, the
// plates (ink printed twice), and the Component nested in a Symbol. Headless, on a throwaway profile (never Diego's store).
// Usage: node --experimental-websocket scripts/gallery-fvs-tile-patterns.mjs [outDir] [--only id,id] [--json file]
import fs from 'node:fs';
import path from 'node:path';
import { openChrome } from './lib/chrome-page.mjs';

const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : [];
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : 'gallery/samples';
fs.mkdirSync(OUT, { recursive: true });

// inks: two-plate screen-print pairs; paper off-white so Paper and the sheet's white differ in the raster
const GREEN = '#1d3b2a', VERMILION = '#c2462e', INDIGO = '#2b3a67', OCHRE = '#d39b2a', TEAL = '#1f6f6b', PINK = '#d9667b';
export const CASES = [
  { id: 'tile-01', name: 'Grid · control', el: { type: 'lens' }, grid: { cols: 6, rows: 6, gap: 0 }, rule: 'checkerboard', inks: [GREEN], tile: { layout: 'grid', wrap: true } },
  { id: 'tile-02', name: 'Brick · scales', el: { type: 'circle' }, grid: { cols: 6, rows: 6, gap: -15 }, rule: 'identity', inks: [GREEN, VERMILION], colourBy: 'rows', tile: { layout: 'brick', top: 'moved', wrap: true } },
  { id: 'tile-03', name: 'Half-drop · chevrons', el: { type: 'chevron' }, grid: { cols: 6, rows: 6, gap: -10 }, rule: 'identity', inks: [INDIGO, OCHRE], colourBy: 'columns', tile: { layout: 'halfdrop', wrap: true } },
  { id: 'tile-04', name: 'Alternate · stars', el: { type: 'star' }, grid: { cols: 6, rows: 6, gap: -30 }, rule: 'pinwheel', inks: [TEAL, PINK], colourBy: 'checker', tile: { layout: 'alternate', top: 'still', wrap: true } },
  { id: 'tile-05', name: 'Brick · drops, rule turns', el: { type: 'drop' }, grid: { cols: 6, rows: 6, gap: -25 }, rule: 'checkerboard', inks: [INDIGO], tile: { layout: 'brick', top: 'moved', wrap: true } },
  { id: 'tile-06', name: 'Interlace · chain mail', el: { type: 'circle', fill: 'stroke', strokeW: 10 }, grid: { cols: 6, rows: 6, gap: -70 }, rule: 'identity', inks: [GREEN, VERMILION], colourBy: 'checker', tile: { layout: 'grid', top: 'weave', margin: 2, wrap: true } },
  { id: 'tile-07', name: 'Interlace · brick rings', el: { type: 'circle', fill: 'stroke', strokeW: 8 }, grid: { cols: 6, rows: 6, gap: -65 }, rule: 'identity', inks: [INDIGO, OCHRE], colourBy: 'rows', tile: { layout: 'brick', top: 'weave', margin: 3, wrap: true } },
  { id: 'tile-08', name: 'Interlace · quarter arcs', el: { type: 'arc', fill: 'stroke', strokeW: 12 }, grid: { cols: 6, rows: 6, gap: -30 }, rule: 'pinwheel', inks: [TEAL], tile: { layout: 'grid', top: 'weave', margin: 2, wrap: true } },
  { id: 'tile-09', name: 'Interlace · Crossing gap 8', el: { type: 'circle', fill: 'stroke', strokeW: 10 }, grid: { cols: 6, rows: 6, gap: -70 }, rule: 'identity', inks: [GREEN, VERMILION], colourBy: 'checker', tile: { layout: 'grid', top: 'weave', margin: 8, wrap: true } },
  { id: 'tile-10', name: 'Move + Bring forward', el: { type: 'lens' }, grid: { cols: 6, rows: 6, gap: -20 }, rule: 'checkerboard', inks: [INDIGO, OCHRE], colourBy: 'checker', tile: { layout: 'grid', wrap: true }, cells: [{ i: 14, moveX: 0.35, moveY: 0.35, z: 1 }, { i: 21, moveX: -0.35, moveY: -0.35, z: 1 }] },
  { id: 'tile-11', name: 'Brick, 5 rows · the seam', el: { type: 'circle' }, grid: { cols: 6, rows: 5, gap: -15 }, rule: 'identity', inks: [GREEN, VERMILION], colourBy: 'rows', tile: { layout: 'brick', top: 'moved', wrap: true } },
  { id: 'tile-12', name: 'Interlace · arc truchet', el: { type: 'arctruchet' }, grid: { cols: 6, rows: 6, gap: -20 }, rule: 'random', inks: [INDIGO], tile: { layout: 'grid', top: 'weave', margin: 2, wrap: true } },
];

const P = await openChrome({ timeoutMs: 10 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const results = [];
for (const C of CASES) {
  if (only.length && !only.includes(C.id)) continue;
  const r = await P.ev(`const C = ${JSON.stringify(C)}, F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
    const set = (id, v) => { const e = q(id); if (!e) throw new Error('no #' + id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
    const R = {};
    // Element
    F.setTier('element'); await w(200);
    set('sel-seed-type', C.el.type); await w(200);
    set('sel-element-fillmode', C.el.fill || 'fill'); if (C.el.strokeW) set('rg-element-strokew', C.el.strokeW); await w(200);
    // inks + Colour by
    F.state.colors = C.inks.slice(); F.state.paperColor = '#f6f2e9';
    F.setTier('component'); await w(400);
    const cb = q('sel-color-rule'), opts = [...cb.options].map(o => [o.value, o.textContent.trim()]);
    R.colourByOptions = opts.map(o => o.join('=')).join(' | ');
    if (C.colourBy) { const hit = opts.find(o => o[0] === C.colourBy); if (hit) set('sel-color-rule', hit[0]); R.colourBy = hit ? hit[1] : 'not found'; }
    // Grid + rule + Generate
    set('rg-grid-cols', C.grid.cols); set('rg-grid-rows', C.grid.rows); set('rg-gap', C.grid.gap); set('sel-rule', C.rule); await w(200);
    q('btn-generate').click(); await w(1200);
    R.generated = F.state.components.length;
    const comp = F.state.components[0]; if (!comp) throw new Error('nothing generated');
    // Component Edit › Tile
    F.enterComponentEditMode(comp.id); await w(500);
    set('sel-tile-layout', C.tile.layout); await w(150);
    if (C.tile.ox != null) set('rg-tile-offset-x', C.tile.ox); if (C.tile.oy != null) set('rg-tile-offset-y', C.tile.oy);
    if (C.tile.top) set('sel-tile-top', C.tile.top); await w(150);
    if (C.tile.margin != null) set('rg-tile-margin', C.tile.margin);
    set('chk-tile-seamless', !!C.tile.wrap); await w(250);
    for (const c of C.cells || []) {
      F.selectComponentEditCell(c.i); F.cePicked = new Set([c.i]); F.syncCeCellProps(); await w(150);
      if (c.moveX) set('ce-rg-cellprop-move-x', Math.round(c.moveX * 100)); if (c.moveY) set('ce-rg-cellprop-move-y', Math.round(c.moveY * 100)); await w(150);
      if (c.z > 0) q('ce-btn-cellprop-forward').click(); await w(150);
    }
    R.movedCells = F.state.componentEditCells.map((c, i) => c.moveX || c.moveY || c.z ? i + ':' + [c.moveX, c.moveY, c.z].join('/') : '').filter(Boolean).join(' ');
    R.editOverlap = JSON.stringify(F.state.componentEditGrid.overlap);
    q('btn-component-edit-save').click(); await w(600);
    if (F.state.componentEditMode) { F.exitComponentEditMode(); await w(300); }
    const made = F.getSelectedComponent();
    R.savedTile = JSON.stringify(made && made.tile);
    // the export, timed
    let svg = '', t = []; for (let k = 0; k < 3; k++) { const t0 = performance.now(); svg = F.tierSVG(); t.push(performance.now() - t0); }
    R.svg = svg; R.ms = Math.min(...t); R.kb = svg.length / 1024;
    R.masks = (svg.match(/<mask id="weave-/g) || []).length; R.dilates = (svg.match(/feMorphology/g) || []).length;
    R.inksInFile = C.inks.filter(c => svg.toLowerCase().includes(c.toLowerCase())).length;
    // raster: cover, seam
    const N = 360;
    const raster = async sv => { const vb = sv.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number), H = Math.round(N * vb[3] / vb[2]);
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(new Blob([sv.replace(/<svg\\b([^>]*?)\\swidth="[^"]*"\\sheight="[^"]*"/, '<svg$1 width="' + N + '" height="' + H + '"')], { type: 'image/svg+xml' })); });
      const c = document.createElement('canvas'); c.width = N; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, N, H).data, W: N, H }; };
    const paperRGB = [0xf6, 0xf2, 0xe9], isInk = (Rr, k) => Rr.d[k + 3] > 128 && Math.abs(Rr.d[k] - paperRGB[0]) + Math.abs(Rr.d[k + 1] - paperRGB[1]) + Math.abs(Rr.d[k + 2] - paperRGB[2]) > 60;
    const S = await raster(svg); let ink = 0; for (let k = 0; k < S.d.length; k += 4) if (isInk(S, k)) ink++;
    R.cover = ink / (S.W * S.H);
    const seam = axis => { let same = 0, n = 0; if (axis === 'x') for (let j = 0; j < S.H; j++) { n++; if (isInk(S, (j * S.W) * 4) === isInk(S, (j * S.W + S.W - 1) * 4)) same++; } else for (let i = 0; i < S.W; i++) { n++; if (isInk(S, i * 4) === isInk(S, ((S.H - 1) * S.W + i) * 4)) same++; } return same / n; };
    R.seamX = seam('x'); R.seamY = seam('y');
    // canvas twin vs SVG: the share of pixels that differ (ink vs no ink)
    { const grid = F.gridOf(made), items = F.buildComponentItems(made, grid), dims = F.frameDims(grid), cv = document.createElement('canvas'); cv.width = dims.w; cv.height = dims.h;
      F.drawComponentCanvas(cv.getContext('2d'), items, F.getSeed(), dims);
      const c2 = document.createElement('canvas'); c2.width = S.W; c2.height = S.H; const x2 = c2.getContext('2d'); x2.drawImage(cv, 0, 0, S.W, S.H); const D = { d: x2.getImageData(0, 0, S.W, S.H).data, W: S.W, H: S.H };
      let diff = 0; for (let k = 0; k < S.d.length; k += 4) if (isInk(S, k) !== isInk(D, k)) diff++; R.canvasDiff = diff / (S.W * S.H); }
    // plates: ink printed on more than one plate (should be ~0 where cells cover, Normal order)
    if (C.inks.length > 1) {
      const plates = []; for (let i = 0; i < C.inks.length; i++) plates.push(await raster(F.plateSVG(svg, C.inks, i, F.state.paperColor)));
      let twice = 0, any = 0; for (let k = 0; k < S.d.length; k += 4) { const n = plates.filter(p => p.d[k + 3] > 128).length; if (n) any++; if (n > 1) twice++; }
      R.plateTwice = twice / (S.W * S.H); R.plateCover = any / (S.W * S.H); R.plateMask = /<mask id="plate-/.test(F.plateSVG(svg, C.inks, 0, F.state.paperColor));
    }
    // nested in a Symbol: does it keep what Tile does?
    { F.quickSaveComponentToLibrary(made.id); await w(250); F.setTier('symbol'); await w(400);
      F.railApply('component', made.savedName, 0); await w(250);
      const sym = F.buildSymbolSVG(); R.symbolWrap = /id="nwrap-/.test(sym); R.symbolWeave = /<mask id="weave-/.test(sym); R.symbolKB = sym.length / 1024;
      F.setTier('component'); await w(300); }
    return R;`);
  const { svg, ...m } = r;
  fs.writeFileSync(path.join(OUT, C.id + '.svg'), svg);
  results.push({ id: C.id, name: C.name, ...m });
  console.log(`${C.id} ${C.name.padEnd(30)} ${m.kb.toFixed(1).padStart(6)} KB ${m.ms.toFixed(1).padStart(6)} ms  cover ${(m.cover * 100).toFixed(0)}%  seam ${(m.seamX * 100).toFixed(1)}/${(m.seamY * 100).toFixed(1)}  canvas≠svg ${(m.canvasDiff * 100).toFixed(1)}%  masks ${m.masks}` + (m.plateTwice != null ? `  plates twice ${(m.plateTwice * 100).toFixed(2)}%` : '') + `  symbol wrap ${m.symbolWrap} weave ${m.symbolWeave}`);
}
if (args.includes('--json')) fs.writeFileSync(args[args.indexOf('--json') + 1], JSON.stringify(results, null, 1));   // the measures, for the analysis
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('console: ' + errs.slice(0, 5).join(' | '));
await P.close(0);
