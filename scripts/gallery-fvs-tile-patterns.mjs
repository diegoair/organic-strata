#!/usr/bin/env node
// FVS Component › Tile — pattern tests for the test gallery, on Diego's own Components (Oct 27, 2026: "rifai i pattern
// usando solo i 5 component presenti ora e la palette usata ora, rifai il test sulle tile e le creazioni").
// The five Components saved that morning (Mirror 08:20:40 / 41 / 42, Radial 08:20:44 / 46 — 2 × 2, the Arc Element filled
// and turned 90°) and their palette (#fba79d · #cfb3d7 · #f9dfe2 on Paper #0033ff) are written into a throwaway profile.
// Each case goes the user's way: open the saved Component → Component Edit › Tile (and Edit's Gap) → Save as new
// component → its export (tierSVG); then the creation: a 6 × 6 Symbol, no margin, every cell that Component → its export
// (buildSymbolSVG) — the gallery sample. Measured: export time and size, ink cover, the seam of one period, the masks
// Interlace adds, the canvas twin against the SVG, the plates (ink printed twice), and the Symbol against the Component
// repeated 6 × 6 (what the creation loses). Headless, never Diego's store.
// Usage: node --experimental-websocket scripts/gallery-fvs-tile-patterns.mjs [outDir] [--only id,id] [--json file]
import fs from 'node:fs';
import path from 'node:path';
import { openChrome } from './lib/chrome-page.mjs';

const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : [];
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : 'gallery/samples';
fs.mkdirSync(OUT, { recursive: true });

// Diego's five, as saved (component.cells; everything else is shared)
const INKS = ['#fba79d', '#cfb3d7', '#f9dfe2'], PAPER = '#0033ff';
const APPEARANCE = { fillMode: 'fill', strokeW: 4, rounded: true, w: 1, l: 1, scale: 1, mx: 0, my: 0, rotate: 90, patType: 'lines', patSpacing: 8, patWeight: 2, patAngle: 45, ground: null };
const c = (r, h, v) => ({ rotation: r, flipH: !!h, flipV: !!v, scale: 1 });
const SAVED = {
  'Mirror 08:20:40': { ruleSource: 'mirror', cells: [c(0, 1, 0), c(0, 0, 0), c(0, 1, 1), c(0, 0, 1)] },
  'Mirror 08:20:41': { ruleSource: 'mirror', cells: [c(0, 0, 1), c(0, 1, 1), c(0, 0, 0), c(0, 1, 0)] },
  'Mirror 08:20:42': { ruleSource: 'mirror', cells: [c(0, 1, 1), c(0, 0, 1), c(0, 1, 0), c(0, 0, 0)] },
  'Radial 08:20:44': { ruleSource: 'radial', cells: [c(180), c(270), c(90), c(0)] },
  'Radial 08:20:46': { ruleSource: 'radial', cells: [c(0), c(90), c(270), c(180)] },
};
// colourBy: a Colour by value (element = as saved: every cell the first ink). gap: Edit's Gap. tile: Component Edit › Tile.
export const CASES = [
  { id: 'tile-01', from: 'Mirror 08:20:40', name: 'As saved', tile: { layout: 'grid' } },
  { id: 'tile-02', from: 'Mirror 08:20:41', name: 'Tile seamlessly', tile: { layout: 'grid', wrap: true } },
  { id: 'tile-03', from: 'Mirror 08:20:42', name: 'Brick', tile: { layout: 'brick', wrap: true } },
  { id: 'tile-04', from: 'Radial 08:20:44', name: 'Half-drop', tile: { layout: 'halfdrop', wrap: true } },
  { id: 'tile-05', from: 'Radial 08:20:46', name: 'Alternate · Gap −40', gap: -40, tile: { layout: 'alternate', top: 'moved', wrap: true } },
  { id: 'tile-06', from: 'Mirror 08:20:40', name: 'Brick · three inks', gap: -40, colourBy: 'own', tile: { layout: 'brick', top: 'moved', wrap: true } },
  { id: 'tile-07', from: 'Radial 08:20:44', name: 'Grid · Gap −60', gap: -60, colourBy: 'index', tile: { layout: 'grid', wrap: true } },
  { id: 'tile-08', from: 'Radial 08:20:46', name: 'Interlace · Gap −60', gap: -60, colourBy: 'checker', tile: { layout: 'grid', top: 'weave', margin: 2, wrap: true } },
  { id: 'tile-09', from: 'Mirror 08:20:41', name: 'Interlace · Brick', gap: -50, colourBy: 'rows', tile: { layout: 'brick', top: 'weave', margin: 2, wrap: true } },
  { id: 'tile-10', from: 'Mirror 08:20:42', name: 'Half-drop · other cells on top', gap: -30, colourBy: 'checker', tile: { layout: 'halfdrop', top: 'still', wrap: true } },
  { id: 'tile-11', from: 'Radial 08:20:44', name: 'Move + Bring forward', colourBy: 'own', tile: { layout: 'grid', wrap: true }, cells: [{ i: 0, moveX: 0.3, moveY: 0.3, z: 1 }] },
  { id: 'tile-12', from: 'Radial 08:20:46', name: 'Alternate · Offset 50 / 50', colourBy: 'columns', tile: { layout: 'alternate', ox: 50, oy: 50, wrap: true } },
];

const P = await openChrome({ timeoutMs: 15 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
// the five into the library (the Arc Element's own defaults are Diego's seed: arc, corner pivot, 90° sweep)
await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  F.setTier('element'); q('sel-seed-type').value = 'arc'; q('sel-seed-type').dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  const seed = { ...F.getSeed() }, saved = ${JSON.stringify(SAVED)}, lib = {};
  for (const [name, component] of Object.entries(saved)) lib[name] = { seed, appearance: ${JSON.stringify(APPEARANCE)}, grid: { kind: 'square', cols: 2, rows: 2, cellSize: 160, gap: 0 },
    colors: ${JSON.stringify(INKS)}, colorRule: { mode: 'element', offset: 0 }, paperColor: '${PAPER}', component, role: 'normal', underlyingComponentName: null, savedAt: new Date().toISOString() };
  Organica.store('fvs').write(lib); return Object.keys(Organica.store('fvs').read()).length;`);
const results = [];
for (const C of CASES) {
  if (only.length && !only.includes(C.id)) continue;
  const r = await P.ev(`const C = ${JSON.stringify(C)}, F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
    const set = (id, v) => { const e = q(id); if (!e) throw new Error('no #' + id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
    const R = {};
    // open the saved Component (as a double-click on its tile does)
    F.openSavedComponent(C.from); await w(700);
    const want = JSON.stringify(Organica.store('fvs').read()[C.from].component.cells.map(x => [x.rotation, x.flipH, x.flipV]));
    const comp = F.state.components.find(k => JSON.stringify(k.cells.map(x => [x.rotation, x.flipH, x.flipV])) === want) || F.getSelectedComponent();
    R.opened = !!comp && JSON.stringify(comp.cells.map(x => [x.rotation, x.flipH, x.flipV])) === want;
    R.inks = F.state.colors.join(' ') + ' / ' + F.state.paperColor;
    if (C.colourBy) { set('sel-color-rule', C.colourBy); await w(250); }
    R.colourBy = q('sel-color-rule').selectedOptions[0].textContent.trim();
    // Component Edit › Tile
    F.enterComponentEditMode(comp.id); await w(500);
    if (C.gap != null) { set('rg-ce-gap', C.gap); await w(200); }
    set('sel-tile-layout', C.tile.layout); await w(150);
    if (C.tile.ox != null) set('rg-tile-offset-x', C.tile.ox); if (C.tile.oy != null) set('rg-tile-offset-y', C.tile.oy);
    if (C.tile.top) set('sel-tile-top', C.tile.top); await w(150);
    if (C.tile.margin != null) set('rg-tile-margin', C.tile.margin);
    set('chk-tile-seamless', !!C.tile.wrap); await w(250);
    for (const k of C.cells || []) {
      F.selectComponentEditCell(k.i); F.cePicked = new Set([k.i]); F.syncCeCellProps(); await w(150);
      if (k.moveX) set('ce-rg-cellprop-move-x', Math.round(k.moveX * 100)); if (k.moveY) set('ce-rg-cellprop-move-y', Math.round(k.moveY * 100)); await w(150);
      if (k.z > 0) q('ce-btn-cellprop-forward').click(); await w(150);
    }
    q('btn-component-edit-save').click(); await w(600);
    if (F.state.componentEditMode) { F.exitComponentEditMode(); await w(300); }
    const made = F.getSelectedComponent();
    R.tile = JSON.stringify(made && made.tile); R.gap = F.getGrid().gap;
    // the Component's export, timed
    let svg = '', t = []; for (let k = 0; k < 3; k++) { const t0 = performance.now(); svg = F.tierSVG(); t.push(performance.now() - t0); }
    R.ms = Math.min(...t); R.kb = svg.length / 1024; R.masks = (svg.match(/<mask id="weave-/g) || []).length;
    const N = 360;
    const raster = async (sv, n = N) => { const vb = sv.match(/viewBox="([^"]+)"/)[1].split(/[ ,]+/).map(Number), H = Math.round(n * vb[3] / vb[2]);
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(new Blob([sv.replace(/<svg\\b([^>]*?)\\swidth="[^"]*"\\sheight="[^"]*"/, '<svg$1 width="' + n + '" height="' + H + '"')], { type: 'image/svg+xml' })); });
      const cv = document.createElement('canvas'); cv.width = n; cv.height = H; const x = cv.getContext('2d'); x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, n, H).data, W: n, H, img }; };
    const paper = [0x00, 0x33, 0xff], isInk = (Rr, k) => Rr.d[k + 3] > 128 && Math.abs(Rr.d[k] - paper[0]) + Math.abs(Rr.d[k + 1] - paper[1]) + Math.abs(Rr.d[k + 2] - paper[2]) > 90;
    const S = await raster(svg); let ink = 0; for (let k = 0; k < S.d.length; k += 4) if (isInk(S, k)) ink++;
    R.cover = ink / (S.W * S.H);
    const seam = axis => { let same = 0, n = 0; if (axis === 'x') for (let j = 0; j < S.H; j++) { n++; if (isInk(S, (j * S.W) * 4) === isInk(S, (j * S.W + S.W - 1) * 4)) same++; } else for (let i = 0; i < S.W; i++) { n++; if (isInk(S, i * 4) === isInk(S, ((S.H - 1) * S.W + i) * 4)) same++; } return same / n; };
    R.seamX = seam('x'); R.seamY = seam('y');
    { const grid = F.gridOf(made), items = F.buildComponentItems(made, grid), dims = F.frameDims(grid), cv = document.createElement('canvas'); cv.width = dims.w; cv.height = dims.h;
      F.drawComponentCanvas(cv.getContext('2d'), items, F.getSeed(), dims);
      const c2 = document.createElement('canvas'); c2.width = S.W; c2.height = S.H; const x2 = c2.getContext('2d'); x2.drawImage(cv, 0, 0, S.W, S.H); const D = { d: x2.getImageData(0, 0, S.W, S.H).data };
      let diff = 0; for (let k = 0; k < S.d.length; k += 4) if (isInk(S, k) !== isInk(D, k)) diff++; R.canvasDiff = diff / (S.W * S.H); }
    const used = ${JSON.stringify(INKS)}.filter(h => svg.toLowerCase().includes(h));
    R.inksUsed = used.length;
    if (used.length > 1) {
      const plates = []; for (let i = 0; i < used.length; i++) plates.push(await raster(F.plateSVG(svg, used, i, F.state.paperColor)));
      let twice = 0; for (let k = 0; k < S.d.length; k += 4) if (plates.filter(p => p.d[k + 3] > 128).length > 1) twice++;
      R.plateTwice = twice / (S.W * S.H);
    }
    // the creation: a 6 × 6 Symbol, no margin, every cell this Component
    F.quickSaveComponentToLibrary(made.id); await w(250);
    const name = F.getSelectedComponent().savedName || made.savedName; R.savedAs = name;
    F.setTier('symbol'); await w(500);
    const model = await F.symbolGridModel('rectangular', { cols: 6, rows: 6 }, { ...F.readSymbolCanvas(), margin: 0 });
    F.loadSymbolGrid(model); await w(300);
    const patch = F.railPatch('component', name); F.state.symbolCells.forEach(cell => F.patchCell(cell, patch)); F.renderSymbolCanvasOnly(); await w(400);
    const sym = F.buildSymbolSVG(); R.symbolSVG = sym; R.symbolKB = sym.length / 1024; R.symbolMasks = (sym.match(/<mask id="n?weave-/g) || []).length;
    // the Symbol against the Component repeated 6 × 6 (what a creation should look like)
    { const Y = await raster(sym, 480), cv = document.createElement('canvas'); cv.width = 480; cv.height = Y.H; const x = cv.getContext('2d');
      const p = await raster(svg, 80); for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) x.drawImage(p.img, i * 80, j * Y.H / 6, 80, Y.H / 6);
      const T = { d: x.getImageData(0, 0, 480, Y.H).data }; let diff = 0; for (let k = 0; k < Y.d.length; k += 4) if (isInk(Y, k) !== isInk(T, k)) diff++;
      R.symbolVsRepeat = diff / (480 * Y.H); }
    F.setTier('component'); await w(300);
    return R;`);
  const { symbolSVG, ...m } = r;
  fs.writeFileSync(path.join(OUT, C.id + '.svg'), symbolSVG);
  results.push({ id: C.id, from: C.from, name: C.name, ...m });
  const pc = v => (v * 100).toFixed(1) + '%';
  console.log(`${C.id} ${(C.from + ' · ' + C.name).padEnd(48)} opened ${m.opened}  comp ${m.kb.toFixed(1)} KB ${m.ms.toFixed(1)} ms  cover ${pc(m.cover)}  seam ${pc(m.seamX)}/${pc(m.seamY)}  canvas≠svg ${pc(m.canvasDiff)}  masks ${m.masks}`
    + (m.plateTwice != null ? `  plates twice ${pc(m.plateTwice)}` : '') + `  · Symbol ${m.symbolKB.toFixed(1)} KB, masks ${m.symbolMasks}, ≠ repeat ${pc(m.symbolVsRepeat)}  · ${m.colourBy}`);
}
if (args.includes('--json')) fs.writeFileSync(args[args.indexOf('--json') + 1], JSON.stringify(results, null, 1));   // the measures, for the analysis
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('console: ' + errs.slice(0, 5).join(' | '));
await P.close(0);
