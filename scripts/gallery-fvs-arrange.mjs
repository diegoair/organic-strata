#!/usr/bin/env node
// FVS Symbol › Fill › Arrange — a visual test of every arrangement, for the test gallery (Oct 27, 2026 — Diego: "fai un
// test visuale sulle creazioni fatte con Fill arrange e tutti i cases che ci sono per verificare e vedere quale creano dei
// pattern visivi piu interessanti, salva i test in gallery").
// Pool = Diego's five Components of the Tile tests (Mirror 08:20:40 / 41 / 42, Radial 08:20:44 / 46 — 2 × 2, the Arc
// Element filled and turned 90°, #fba79d · #cfb3d7 · #f9dfe2 on Paper #0033ff), written into a throwaway profile.
// Each case = a Symbol grid → Arrange (rule · Fit · seed) the way the panel's Arrange button does (generateSymbolCells)
// → its export (buildSymbolSVG). Measured: how many pool entries it uses, ink cover, the share of neighbours that hold
// the same Component (how "banded" it reads), SVG size and time. --sheets writes one contact sheet (PNG) per grid.
// Headless, never Diego's store.
// Usage: node --experimental-websocket scripts/gallery-fvs-arrange.mjs [outDir] [--only id,id] [--sheets dir] [--json file]
import fs from 'node:fs';
import path from 'node:path';
import { openChrome } from './lib/chrome-page.mjs';

const args = process.argv.slice(2), opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const only = opt('--only') ? opt('--only').split(',') : [];
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : 'gallery/samples';
const SHEETS = opt('--sheets');
fs.mkdirSync(OUT, { recursive: true }); if (SHEETS) fs.mkdirSync(SHEETS, { recursive: true });

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
export const GRIDS = {
  rectangular: { label: 'Rectangular 8 × 8', params: { cols: 8, rows: 8 } },
  bento: { label: 'Bento 8 × 8', params: { cols: 8, rows: 8, variety: 0.5, seed: 7 } },
  sinusoidal: { label: 'Wave 8 × 8', params: { cols: 8, rows: 8, amount: 0.5, frequency: 2 } },
  masonry: { label: 'Masonry 6', params: { cols: 6, seed: 7 } },
  hexagonal: { label: 'Hexagonal 8', params: { cols: 8 } },
  triangular: { label: 'Triangular 10', params: { cols: 10 } },
  diamond: { label: 'Diamond 8', params: { cols: 8 } },
  circular: { label: 'Circular 6', params: { cols: 6 } },
  radial: { label: 'Radial 6 × 8', params: { rings: 6, sectors: 8 } },
  organic: { label: 'Organic 40', params: { points: 40, iterations: 4, seed: 7 } },
  fractal: { label: 'Fractal 5', params: { depth: 5, variance: 0.2, seed: 7 } },
  spiral: { label: 'Spiral 40', params: { count: 40 } },
};
export const RULES = ['random', 'checker', 'rows', 'columns', 'diagonal', 'blocks', 'rings', 'sectors', 'wave', 'orientation'];
export const FITS = ['fill', 'contain', 'cover', 'match'];
const CASES = [];
for (const g of Object.keys(GRIDS)) for (const fit of FITS) for (const rule of RULES) CASES.push({ id: `${g}.${fit}.${rule}`, grid: g, fit, rule, seed: 1 });
// the gallery picks (written to OUT as arrange-NN.svg)
export const PICKS = {
  'arrange-01': 'bento.fill.blocks', 'arrange-02': 'fractal.fill.rings', 'arrange-03': 'spiral.fill.checker', 'arrange-04': 'diamond.fill.rings',
  'arrange-05': 'hexagonal.cover.columns', 'arrange-06': 'masonry.fill.columns', 'arrange-07': 'diamond.fill.sectors', 'arrange-08': 'radial.match.rings',
};

const P = await openChrome({ timeoutMs: 30 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  F.setTier('element'); q('sel-seed-type').value = 'arc'; q('sel-seed-type').dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  const seed = { ...F.getSeed() }, saved = ${JSON.stringify(SAVED)}, lib = {}; let t = Date.parse('2026-10-27T08:20:40Z');
  for (const [name, component] of Object.entries(saved)) lib[name] = { seed, appearance: ${JSON.stringify(APPEARANCE)}, grid: { kind: 'square', cols: 2, rows: 2, cellSize: 160, gap: 0 },
    colors: ${JSON.stringify(INKS)}, colorRule: { mode: 'element', offset: 0 }, paperColor: '${PAPER}', component, role: 'normal', underlyingComponentName: null, savedAt: new Date(t += 1000).toISOString() };
  Organica.store('fvs').write(lib);
  F.setTier('symbol'); await w(600); F.renderSymbolPool(); return F.symbolSource().map(p => p.name);`);
const results = [], sheet = {};
const todo = CASES.filter(C => !only.length || only.includes(C.id) || only.includes(C.grid));
for (const C of todo) {
  const r = await P.ev(`const C = ${JSON.stringify(C)}, GP = ${JSON.stringify(GRIDS[C.grid].params)}, F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
    const R = {};
    const model = await F.symbolGridModel(C.grid, GP, { ...F.readSymbolCanvas(), margin: 4 });
    F.loadSymbolGrid(model); F.clipByDefaultForShape(); await w(60);   // as the panel builds it: polygon cells start with Clip to cell on
    R.clip = F.state.symbolClipEnabled;
    F.state.symbolCells = F.state.symbolCells.map(x => ({ ...x, locked: false }));
    q('sel-sym-arrange').value = C.rule; q('sel-sym-arrange-fit').value = C.fit; q('num-symbol-seed').value = C.seed;
    F.renderSymbolPool(); F.generateSymbolCells(); await w(60);
    const cells = F.state.symbolCells, names = cells.map(x => x.source === 'component' ? x.componentName : null);
    R.cells = cells.length; R.used = new Set(names.filter(Boolean)).size;
    // neighbours that hold the same Component: from the cells' centres, each cell's nearest 4
    const ctr = F.resolveGridCells(F.getSymbolGrid()).map(k => { const p = k.polygon || k.points; if (p && p.length) { let x = 0, y = 0; p.forEach(v => { x += v.x ?? v[0]; y += v.y ?? v[1]; }); return [x / p.length, y / p.length]; } return [k.x + (k.width || k.w || 0) / 2, k.y + (k.height || k.h || 0) / 2]; });
    let same = 0, n = 0;
    ctr.forEach((a, i) => { if (!names[i]) return; ctr.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2]).filter(([j]) => j !== i && names[j]).sort((u, v) => u[1] - v[1]).slice(0, 4).forEach(([j]) => { n++; if (names[j] === names[i]) same++; }); });
    R.sameNb = n ? same / n : 0;
    const t0 = performance.now(); const svg = F.buildSymbolSVG(); R.ms = performance.now() - t0; R.kb = svg.length / 1024;
    const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/[ ,]+/).map(Number), S = 260, H = Math.round(S * vb[3] / vb[2]);
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(new Blob([svg.replace(/<svg\\b([^>]*?)\\swidth="[^"]*"\\sheight="[^"]*"/, '<svg$1 width="' + S + '" height="' + H + '"')], { type: 'image/svg+xml' })); });
    const cv = document.createElement('canvas'); cv.width = S; cv.height = H; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, H); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, S, H).data; let ink = 0, paper = 0;
    for (let k = 0; k < d.length; k += 4) { const pp = Math.abs(d[k]) + Math.abs(d[k + 1] - 0x33) + Math.abs(d[k + 2] - 0xff) < 90, wh = d[k] > 245 && d[k + 1] > 245 && d[k + 2] > 245; if (pp) paper++; else if (!wh) ink++; }
    R.cover = ink / (S * H); R.paper = paper / (S * H);
    (window.__sheet ||= {})[C.id] = cv;
    R.svg = ${JSON.stringify(Object.values(PICKS))}.includes(C.id) || ${only.length > 0} ? svg : null;
    return R;`);
  const { svg, ...m } = r;
  results.push({ ...C, ...m });
  const pick = Object.entries(PICKS).find(([, id]) => id === C.id);
  if (svg && pick) fs.writeFileSync(path.join(OUT, pick[0] + '.svg'), svg);
  else if (svg && only.includes(C.id)) fs.writeFileSync(path.join(OUT, C.id.replace(/\./g, '-') + '.svg'), svg);
  const pc = v => (v * 100).toFixed(0).padStart(3) + '%';
  console.log(`${C.id.padEnd(30)} clip ${m.clip ? "on " : "off"} cells ${String(m.cells).padStart(3)}  used ${m.used}/5  same-nb ${pc(m.sameNb)}  ink ${pc(m.cover)}  paper ${pc(m.paper)}  ${m.kb.toFixed(0).padStart(4)} KB ${m.ms.toFixed(0).padStart(4)} ms`);
}
if (SHEETS) for (const g of [...new Set(todo.map(C => C.grid))]) {
  // a sheet per grid: a row per Fit, a column per rule, labelled
  const png = await P.ev(`const RULES = ${JSON.stringify(RULES)}, FITS = ${JSON.stringify(FITS)}, g = ${JSON.stringify(g)}, T = 260, L = 18, LW = 70;
    const cv = document.createElement('canvas'); cv.width = LW + RULES.length * (T + 6); cv.height = L + FITS.length * (T + 6 + L); const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#000'; x.font = '13px sans-serif';
    RULES.forEach((r, i) => x.fillText(r, LW + i * (T + 6), 13));
    FITS.forEach((f, j) => { const y = L + j * (T + 6 + L); x.fillText(f, 4, y + T / 2); RULES.forEach((r, i) => { const s = window.__sheet[g + '.' + f + '.' + r]; if (s) x.drawImage(s, LW + i * (T + 6), y, T, T * s.height / s.width); }); });
    return cv.toDataURL('image/png');`);
  fs.writeFileSync(path.join(SHEETS, g + '.png'), Buffer.from(png.split(',')[1], 'base64'));
}
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(results, null, 1));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('console: ' + errs.slice(0, 5).join(' | '));
await P.close(0);
