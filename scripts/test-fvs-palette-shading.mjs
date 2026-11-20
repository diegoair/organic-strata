#!/usr/bin/env node
// FVS · a TuneSutra palette taken whole (Nov 20, 2026 — Diego: "poterle caricare con tutti i loro shadow, grain e parametri …
// modificare i colori tramite il picker … salvarla"). The Palette menu lists TuneSutra's saved palettes; taking one sets
// the inks AND each ink's shading (state.inkShades); every shape of a shaded ink draws Organica.shading's plates in its
// own box, clipped to it; editing the colour keeps its shading; the Gradient + Shadow editor changes it; Save as palette…
// writes a NEW TuneSutra palette (the original never changes); a flat Palette draws exactly as before.
// Usage: node --experimental-websocket scripts/test-fvs-palette-shading.mjs
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const S = Organica.shading, cols = ['#2a3a8c', '#e8b04a', '#c93ed6'];
  const sp = S.withColour(JSON.parse(JSON.stringify(S.defs(cols[0]).speckle)), cols[0]);
  const pol = S.withColour(JSON.parse(JSON.stringify(S.defs(cols[2])['pollen-dot'])), cols[2]);
  const ts = Organica.store('tunesutra');
  ts.write({ 'Test shading': { n: 3, colors: cols, names: ['Base', 'Secondary', 'Accent'], ids: ['c-a', 'c-b', 'c-c'], parts: ['main', 'sub', 'accent'], shades: [sp, null, pol], house: 42 } });
  F.setTier('element'); await w(300);
  // a flat Palette: the markup of before (no shading drawn)
  const flat = F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 200);
  check('a flat Palette draws no shading', !/clip-path="url\\(#shd/.test(flat) && Object.keys(F.state.inkShades).length === 0, flat.slice(0, 80));
  // the menu: TuneSutra's saved palettes, grouped
  [...document.querySelectorAll('#fvs-palette button')].pop().click(); await w(300);
  const menu = document.querySelector('.pal-menu');
  check('the Palette menu lists Saved, with the TuneSutra palette', menu && !menu.hidden && /Saved/.test(menu.innerText) && /Test shading/.test(menu.innerText) && !/Riso/.test(menu.innerText), menu && menu.innerText);
  [...menu.querySelectorAll('.preset-item')].find(b => b.textContent === 'Test shading').click(); await w(500);
  check('taken whole: its colours', JSON.stringify(F.state.colors) === JSON.stringify(cols), JSON.stringify(F.state.colors));
  check('…and each colour\\'s own shading', F.state.inkShades[cols[0]] && F.state.inkShades[cols[0]].specks === 'specks' && F.state.inkShades[cols[2]].specks === 'pollen-dot' && !F.state.inkShades[cols[1]], JSON.stringify(Object.keys(F.state.inkShades)));
  const chips = [...document.querySelectorAll('#fvs-palette .rmx-color')].map(c => /data:image/.test(c.style.backgroundImage));
  check('a shaded chip shows its shading, a flat one is flat', chips.join() === 'true,false,true', chips.join());
  // the Element: its shape draws the plates in its own box, clipped to it — every plate an ink path
  const el = F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 200);
  const inks = S.shadowInks(F.state.inkShades[cols[0]], cols[0], { tints: [] });
  check('the shape draws its shadow (a clip to the shape + the shadow inks as fill paths)', /clipPath id="shd/.test(el) && /clip-path="url\\(#shd/.test(el) && (el.match(/<path fill="#[0-9a-f]{6}" fill-rule="evenodd"/g) || []).length >= 2, el.length);
  // a Component of four cells: the shading in every cell, the same plates (cached)
  F.setTier('component'); await w(400); q('btn-generate').click(); await w(1000);
  const comp = F.state.components[0], grid = { kind: 'square', cols: 2, rows: 2, cellSize: 100, gap: 0 };
  const csvg = F.buildComponentSVG(F.buildComponentItems(comp, grid), F.getSeed(), 200);
  check('a Component: the shading in its cells', (csvg.match(/clip-path="url\\(#shd/g) || []).length >= 4, (csvg.match(/clip-path="url\\(#shd/g) || []).length);
  // canvas twin: draws without error and paints the halftone / core inks
  { const draw = () => { const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); F.drawComponentCanvas(x, F.buildComponentItems(comp, grid), F.getSeed(), 200); return x.getImageData(0, 0, 200, 200).data; };
    let err = '', diff = 0;
    try { const a = draw(), keep = F.state.inkShades; F.state.inkShades = {}; const b = draw(); F.state.inkShades = keep;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) diff++; } catch (e) { err = e.message; }
    check('the canvas draws the shading too (' + diff + ' px differ from flat)', !err && diff > 200, err || diff); }
  // a saved Component keeps the Palette's shading
  const entry = F.libraryEntryFromLive(comp);
  check('a saved Component carries the shading (inkShades)', entry.inkShades && entry.inkShades[cols[0]] && entry.inkShades[cols[0]].specks === 'specks', JSON.stringify(Object.keys(entry.inkShades || {})));
  F.setTier('element'); await w(300);
  // the colour edited in the picker: its shading follows it
  document.querySelector('#fvs-palette .rmx-color__pick').click(); await w(200);
  { const x = document.querySelector('.org-cpick__hex'); x.value = '#1c6b3a'; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); Organica.colorPicker.close(); await w(400); }
  const moved = F.state.inkShades['#1c6b3a'];
  check('a colour edited keeps its shading, on the new colour', moved && moved.specks === 'specks' && moved.stops[S.colourStop(moved)] === '#1c6b3a' && !F.state.inkShades[cols[0]], JSON.stringify(Object.keys(F.state.inkShades)));
  // the editor: the chip opened last; a texture picked there
  const host = q('fvs-shade'), sel = host.querySelector('select');
  check('the Gradient + Shadow editor shows the colour\\'s shadow', !!host.querySelector('.org-shade-editor') && sel.value === 'speckle', sel && sel.value);
  sel.value = 'camo-maze'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  check('Shadow › Maze changes that colour\\'s shading', F.state.inkShades['#1c6b3a'].specks === 'camo-maze', F.state.inkShades['#1c6b3a'].specks);
  sel.value = 'none'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  check('Shadow › None, Gradient Flat: no shading left (flat again)', !F.state.inkShades['#1c6b3a'], JSON.stringify(F.state.inkShades['#1c6b3a'] || null));
  sel.value = 'cells'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  // Save as palette…: a NEW palette, the original unchanged
  const before = JSON.stringify(ts.read()['Test shading']);
  [...document.querySelectorAll('.row-btns .mini-btn')].find(b => /^Save as palette/.test(b.textContent)).click(); await w(300);
  const dlg = [...document.querySelectorAll('.org-modal')].find(d => d.getAttribute('aria-label') === 'Save as palette');
  const proposed = dlg && dlg.querySelector('input').value;
  check('Save as palette… proposes "<name> · Flexible Visual System"', proposed === 'Test shading · Flexible Visual System', proposed);
  dlg.querySelector('[data-ok]').click(); await w(400);
  const all = ts.read(), rec = all['Test shading · Flexible Visual System'];
  check('…a new TuneSutra palette with the edited colour and its shading', rec && rec.colors[0] === '#1c6b3a' && rec.shades[0].specks === 'cells' && rec.shades[2].specks === 'pollen-dot' && rec.house === 42 && /^pal-/.test(rec.pid), JSON.stringify(rec && rec.shades.map(s => s && s.specks)));
  check('…and the original never changes', JSON.stringify(all['Test shading']) === before);
  check('only one Save as palette… under the strip', document.querySelectorAll('[data-pal-save]').length === 1, document.querySelectorAll('[data-pal-save]').length);
  // the Element keeps its Palette's shading (the board's save)
  document.body.click(); await w(1500);
  const els = JSON.parse(localStorage.getItem('organica.fvs-elements.presets') || '{}'), act = els[F.state.activeElement];
  check('the Element saves its Palette with the shading', act && act.palette && act.palette.shades && act.palette.shades['#1c6b3a'] && act.palette.shades['#1c6b3a'].specks === 'cells', JSON.stringify(act && act.palette));
  // the menu: up to 9 colours
  check('FVS takes up to 9 colours (TuneSutra\\'s palettes)', F.PALETTE_MAX === 9, F.PALETTE_MAX);
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS palette shading: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
