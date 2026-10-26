#!/usr/bin/env node
// FVS pipeline (Oct 26, 2026 — Diego's QA of paper, patterns and inks from Element to Symbol): one Component followed
// through Element → gallery → saved (library / rail / Library view draw it through componentThumbSVG) → the live panel
// changed → a Symbol cell; each stage rasterised to a quantised colour histogram. Checks: the saved thumbnail = the
// gallery's; it does not change when the Element is edited (it once drew with the live panel's look); the Symbol cell =
// the saved thumbnail (where they should match). And a saved Element dropped in a Symbol keeps its own inks + Paper +
// texture under Colour by Element's colours and Palette in order (it once took the live first ink). Usage:
// scripts/test-fvs-pipeline.sh
import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 20 * 60 * 1000 });

const CASES = {
  'base: 1 ink on white': `palette(['#111111'], '#ffffff');`,
  '3 inks, coloured paper, Element colours': `palette(['#1d3b2a', '#c2462e', '#e8b04a'], '#f4efe4');`,
  '3 inks, Colour by Checkerboard': `palette(['#1d3b2a', '#c2462e', '#e8b04a'], '#f4efe4'); rule('checker');`,
  '3 inks, Colour by Palette in order': `palette(['#1d3b2a', '#c2462e', '#e8b04a'], '#f4efe4'); rule('own');`,
  'transparent paper': `palette(['#c2462e'], 'none');`,
  'paper pattern: lines in ink 2': `palette(['#1d3b2a', '#c2462e'], '#f4efe4'); F.showGroundControls({ patType: 'lines', patSpacing: 6, patWeight: 1.5, patAngle: 45, ink: 1 });`,
  'paper pattern: Element tile': `palette(['#1d3b2a', '#c2462e'], '#f4efe4'); F.showGroundControls({ patType: 'element', patSpacing: 12, patWeight: 1, patAngle: 0, ink: 1, src: 'element', layout: 'grid', turn: 'none', patSize: 70 });`,
  'Style Pattern (dots)': `palette(['#1d3b2a'], '#f4efe4'); set('sel-element-fillmode', 'pattern'); set('sel-element-pattern', 'dots');`,
  'Style Stroke': `palette(['#1d3b2a'], '#f4efe4'); set('sel-element-fillmode', 'stroke');`,
  'Width 1.5 (stretched)': `palette(['#c2462e'], '#ffffff'); set('rg-element-w', 1.5);`,
  'two layers, top layer Ink 2': `palette(['#1d3b2a', '#e8b04a'], '#ffffff'); F.addLayer(); await w(200); const L = F.state.layers; L.items[L.items.length - 1].ink = 1; F.layersChanged ? F.layersChanged() : 0; F.onAppearanceChange();`,
};

const PRE = `
  const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const palette = (inks, paper) => { F.state.colors = inks; F.buildPalette(); F.setPaperUI(paper); F.onAppearanceChange(); };
  const rule = m => { set('sel-color-rule', m); };
  const hist = async (svg, N = 96) => {
    if (!svg) return null;
    svg = F.exportablePhotoSVG ? F.exportablePhotoSVG(svg, true) : svg;
    const m = svg.match(/viewBox="([^"]+)"/), vb = m ? m[1].split(/[\\s,]+/).map(Number) : [0, 0, 100, 100];
    const sized = svg.replace(/<svg\\b([^>]*)>/, (a, at) => '<svg' + at.replace(/\\s(width|height)="[^"]*"/g, '') + ' width="' + N + '" height="' + Math.round(N * vb[3] / vb[2]) + '">');
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' })); });
    const c = document.createElement('canvas'); c.width = N; c.height = Math.round(N * vb[3] / vb[2]); const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data, h = {}; let n = 0;
    for (let i = 0; i < d.length; i += 4) { const k = d[i + 3] < 128 ? 'transparent' : '#' + [d[i], d[i + 1], d[i + 2]].map(v => Math.min(255, Math.round(v / 32) * 32).toString(16).padStart(2, '0')).join(''); h[k] = (h[k] || 0) + 1; n++; }
    const o = {}; Object.entries(h).filter(([, v]) => v / n > 0.02).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { o[k] = Math.round(100 * v / n); });
    return o;
  };`;

const results = {};
let ci = 0;
for (const [name, setup] of Object.entries(CASES)) {
  const NM = 'QA ' + (++ci);
  await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
  try {
    results[name] = await P.ev(PRE + `
      F.setTier('element'); set('sel-seed-type', 'chevron'); await w(300);
      ${setup}
      await w(300);
      const st = {};
      st.element = await hist(F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 200));
      F.setTier('component'); set('rg-grid-cols', 2); set('rg-grid-rows', 2); set('sel-rule', 'mirror'); q('btn-generate').click(); await w(1200);
      const comp = F.state.components[0], grid = F.gridOf(comp);
      st.gallery = await hist(F.componentThumbMarkup(comp, grid, F.getSeed(), F.frameDims(grid)));
      const domThumb = document.querySelector('.fvs-thumb svg, [data-comp-id] svg');
      st.galleryDOM = domThumb ? await hist(domThumb.outerHTML) : null;
      F.quickSaveComponentToLibrary(comp.id, ${JSON.stringify(NM)}); await w(300); st._saved = Object.keys(Organica.store('fvs').read()).includes(${JSON.stringify(NM)});
      st.library = await hist(F.componentThumbSVG(${JSON.stringify(NM)}));
      // the user keeps working: another shape, other inks, plain white paper, Fill, no pattern
      F.setTier('element'); set('sel-seed-type', 'circle'); set('sel-element-fillmode', 'fill'); set('rg-element-w', 1);
      F.showGroundControls(null); F.state.colors = ['#3355ff', '#ff00aa']; F.buildPalette(); F.setPaperUI('#ffffff'); rule('element'); F.onAppearanceChange(); await w(300);
      st.libraryAfterEdit = await hist(F.componentThumbSVG(${JSON.stringify(NM)}));
      // into a Symbol: one cell, Stretch
      F.setTier('symbol'); await w(600);
      F.state.symbolCells.forEach((c, i) => { if (i) c.source = 'empty'; });
      F.railApply('component', ${JSON.stringify(NM)}, 0); await w(300);
      const sv = F.buildSymbolSVG(), host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0'; host.innerHTML = sv; document.body.appendChild(host);
      const g = host.querySelector('[data-cell-index="0"]'), b = g.getBBox(), root = host.querySelector('svg'); host.remove();
      const crop = sv.replace(/viewBox="[^"]+"/, 'viewBox="' + [b.x, b.y, b.width, b.height].map(v => v.toFixed(2)).join(' ') + '"');
      st.symbolCell = await hist(crop);
      st._cell = { fit: F.state.symbolCells[0].fitMode, source: F.state.symbolCells[0].source, ownColors: !!F.state.symbolCells[0].ownColors };
      return st;`);
  } catch (e) { results[name] = { error: String(e).slice(0, 200) }; }
}
// a saved Element dropped in a Symbol keeps its own inks + Paper + texture under Element's colours / Palette in order
const drop = {};
for (const symRule of ['element', 'own']) {
  await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
  drop[symRule] = await P.ev(PRE + `
    F.setTier('element'); set('sel-seed-type', 'chevron'); await w(300);
    palette(['#c2462e', '#1d3b2a'], '#f4efe4'); F.showGroundControls({ patType: 'lines', patSpacing: 6, patWeight: 1.5, patAngle: 45, ink: 1 }); F.onAppearanceChange(); await w(200);
    const name = F.saveElementVariant(0, false, false, '0°', 'QA element ' + ${JSON.stringify(symRule)});
    palette(['#3355ff', '#ff00aa'], '#ffffff'); F.showGroundControls(null); F.onAppearanceChange();
    F.setTier('symbol'); await w(600); rule(${JSON.stringify(symRule)}); await w(100);
    F.railApply('element', name, 0); await w(300);
    const host = document.createElement('div'); host.innerHTML = F.buildSymbolSVG(); const svg = host.innerHTML;
    const g = host.querySelector('[data-cell-index="0"]');
    return { ink: [...new Set([...g.querySelectorAll('[fill]')].map(e => e.getAttribute('fill')).filter(f => f !== 'transparent' && f !== 'none'))].join(','), paper: /fill="#f4efe4"/.test(svg), lines: /stroke="#1d3b2a"/.test(svg) };`);
}
const rows = [], fails = [];
const same = (a, b, tol = 4) => a && b && [...new Set([...Object.keys(a), ...Object.keys(b)])].every(k => Math.abs((a[k] || 0) - (b[k] || 0)) <= tol);
const check = (name, ok, got) => { rows.push((ok ? '✓ ' : '✗ ') + name + (ok ? '' : ' — ' + got)); if (!ok) fails.push(name); };
// where the Symbol cell is expected to differ from the saved thumbnail (not a bug): a transparent paper shows the
// Symbol's Paper; a Pattern's lines reach past the clip (the crop is its bbox); a stretched shape spills past its box
const SYMBOL_DIFFERS = ['transparent paper', 'Style Pattern (dots)', 'Width 1.5 (stretched)'];
for (const [n, st] of Object.entries(results)) {
  if (st.error) { check(n, false, st.error); continue; }
  check(n + ': saved thumbnail = gallery', same(st.gallery, st.library), JSON.stringify([st.gallery, st.library]));
  check(n + ': saved thumbnail unchanged after editing the Element', same(st.library, st.libraryAfterEdit), JSON.stringify([st.library, st.libraryAfterEdit]));
  if (!SYMBOL_DIFFERS.includes(n)) check(n + ': Symbol cell = saved thumbnail', same(st.library, st.symbolCell), JSON.stringify([st.library, st.symbolCell]));
}
for (const [r, d] of Object.entries(drop)) check(`saved Element in a Symbol, Colour by ${r}: own ink, Paper and texture`, d.ink.split(',').includes('#c2462e') && !d.ink.includes('#3355ff') && d.paper && d.lines, JSON.stringify(d));
for (const r of rows) console.log('  ' + r);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS pipeline: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
