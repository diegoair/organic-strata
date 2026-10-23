#!/usr/bin/env node
// FVS Element Style = Photo (Oct 23, 2026 — Tropism T2, docs/FVS-TROPISM.md): the shape is a mask, an uploaded photo
// shows through it. Checks: nothing changes until a photo is chosen (no photo keys in the appearance); the photo is
// stored once in its own store and an appearance carries only its id; Normal / Tone / Dither draw on screen and on a
// canvas; Tone and Dither take the Palette's inks; a file is self-contained (each photo once in <defs>, a <use> per
// drawing) — Normal / Tone as an embedded raster, Dither as vector paths, one per ink, Paper empty; the multi-level
// dither with two levels equals the 1-bit one; Remove photo goes back to Fill. Usage: scripts/test-fvs-photo.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 5 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const res = await P.ev(`
  const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms)), fails = [], rows = [];
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const check = (name, ok, got) => { rows.push((ok ? '✓ ' : '✗ ') + name + (ok ? '' : ' — ' + got)); if (!ok) fails.push(name); };
  const until = async (fn, ms = 5000) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await w(30); return fn(); };
  F.setTier('element'); F.setCellShape('square');
  set('sel-seed-type', 'circle'); await w(100);
  check('no photo: the appearance has no photo keys', !Object.keys(F.getElementAppearance()).some(k => /^photo/.test(k)), Object.keys(F.getElementAppearance()).join(','));
  // a test photo: a left → right dark → light gradient with a black square top left
  const pc = document.createElement('canvas'); pc.width = 300; pc.height = 200;
  const px = pc.getContext('2d'), gr = px.createLinearGradient(0, 0, 300, 0);
  gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); px.fillStyle = gr; px.fillRect(0, 0, 300, 200);
  const blob = await new Promise(r => pc.toBlob(r, 'image/png'));
  F.usePhotoFile(new File([blob], 'test.png', { type: 'image/png' }));
  await until(() => q('in-element-photo').value);
  const id = q('in-element-photo').value;
  check('Open photo sets Style = Photo', q('sel-element-fillmode').value === 'photo', q('sel-element-fillmode').value);
  check('the photo block shows, with Replace / Remove', !q('element-photo-block').hidden && q('element-photo-has-row').style.display !== 'none' && q('element-photo-open-row').style.display === 'none', '');
  const stored = F.PHOTO_STORE.read()[id];
  check('stored once, a JPEG ≤ 1024 px', stored && /^data:image\\/jpeg/.test(stored.data) && Math.max(stored.w, stored.h) <= 1024, stored && stored.w + '×' + stored.h);
  const app = F.getElementAppearance();
  check('the appearance carries the id, never the picture', app.photoId === id && !JSON.stringify(app).includes('data:image'), '');
  const prev = () => F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 200);
  check('Normal: the preview draws the photo through the shape', /<image data-ph="\\d+" href="blob:/.test(prev()), prev().slice(0, 200));
  const canvasAt = (xs) => { const c = document.createElement('canvas'); c.width = c.height = 100; const x = c.getContext('2d');
    F.drawComponentCanvas(x, [{ cx: 0, cy: 0, rotation: 0, flipH: false, flipV: false, scale: 1, cellSize: 100, color: '#000000' }], F.getSeed(), { w: 100, h: 100 });
    const d = x.getImageData(0, 0, 100, 100).data; return xs.map(([i, j]) => [...d.slice((j * 100 + i) * 4, (j * 100 + i) * 4 + 3)]); };
  { const [l, r, out] = canvasAt([[20, 50], [80, 50], [1, 1]]);
    check('Normal on a canvas: dark on the left, light on the right, the Paper outside the circle', l[0] < 90 && r[0] > 165 && out.join() === '255,255,255', JSON.stringify([l, r, out])); }
  const shown = id => q(id).style.display !== 'none' && !q(id).hidden;
  check('Normal shows neither Algorithm nor Contrast', !shown('element-photoalg-row') && !shown('element-photocontrast-row'), '');
  // Tone on two inks + a white Paper: darkest = Ink 1 (red), middle = Ink 2 (blue), lightest = Paper
  F.state.colors = ['#ff0000', '#0000ff']; F.state.paperColor = '#ffffff';
  set('in-element-photolook', 'tone'); q('seg-element-photolook').querySelector('[data-look="tone"]').click(); await w(50);
  check('Tone shows Contrast, not Algorithm / Dot size', shown('element-photocontrast-row') && !shown('element-photoalg-row') && !shown('element-photodot-row'), '');
  { const [l, m, r] = canvasAt([[8, 50], [50, 50], [92, 50]]);
    check('Tone: Ink 1 → Ink 2 → Paper', l[0] > 120 && l[0] > l[2] && m[2] > 200 && m[0] < 40 && r[0] > m[0] + 80 && r[2] > 200, JSON.stringify([l, m, r])); }
  { const s = F.photoSelfContained('<svg xmlns="http://www.w3.org/2000/svg">' + prev() + '</svg>');
    check('Tone in a file: an embedded raster, said so', s.raster && /<image id="ph\\d+" href="data:image/.test(s.svg) && !/blob:/.test(s.svg), s.svg.slice(0, 160)); }
  // Dither
  q('seg-element-photolook').querySelector('[data-look="dither"]').click(); await w(50);
  check('Dither shows Algorithm and Dot size', shown('element-photoalg-row') && shown('element-photodot-row'), '');
  for (const alg of ['fs', 'atkinson', 'bayer', 'threshold']) {
    set('sel-element-photoalg', alg); await w(20);
    const s = F.photoSelfContained(prev());
    const fills = [...new Set([...s.svg.matchAll(/<path d="[^"]+" fill="(#[0-9a-f]{6})"\\/>/g)].map(m => m[1]))].sort();
    check('Dither ' + alg + ' in a file: vector, one path per ink, Paper empty', !s.raster && !/<image/.test(s.svg) && JSON.stringify(fills) === '["#0000ff","#ff0000"]', JSON.stringify(fills) + ' raster=' + s.raster);
  }
  set('sel-element-photoalg', 'fs');
  { const n = d => (F.photoSelfContained(prev()).svg.match(/Z/g) || []).length;
    set('rg-element-photodot', 1); const fine = n(); set('rg-element-photodot', 5); const coarse = n();
    check('Dot size: smaller dots, more of them', fine > coarse * 4, fine + ' vs ' + coarse); set('rg-element-photodot', 1); }
  // a Component: each cell draws the photo, turned with the cell; a file has the photo once
  F.setTier('component'); set('rg-grid-cols', 2); set('rg-grid-rows', 2); set('rg-gap', 0); set('sel-rule', 'pinwheel'); q('btn-generate').click(); await w(600);
  const comp = F.state.components[0], grid = F.getGrid();
  const csvg = F.buildComponentSVG(F.buildComponentItems(comp, grid), F.getSeed(), F.frameDims(grid));
  const s4 = F.photoSelfContained(csvg);
  check('a 2×2 Step turn: the photo in every cell, once in the file', (csvg.match(/<image data-ph=/g) || []).length === 4 && (s4.svg.match(/<use href="#ph/g) || []).length === 4 && (s4.svg.match(/<g id="ph/g) || []).length === 1, '');
  // layers: one layer in Photo, the other a plain Fill — the photo settings stay the Element's
  F.setTier('element'); F.addLayer(); await w(100);
  set('sel-element-fillmode', 'fill'); await w(50);
  { const sv = prev(), L = F.state.layers;
    check('with layers: the Photo layer draws the photo, the new layer its ink', L && L.items.some(l => l.look && l.look.fillMode === 'photo') && /<image data-ph=/.test(sv) && /<path d="[^"]+" fill="#/.test(sv), L ? L.items.map(l => l.look && l.look.fillMode).join(',') : 'no layers'); }
  check('with layers: the photo block still shows (one set for the Element)', !q('element-photo-block').hidden, '');
  F.state.layers = null; F.renderLayersUI(); set('sel-element-fillmode', 'photo'); await w(50);
  // the 1-bit case of the multi-level dither
  { const W = 37, H = 23, g = new Float32Array(W * H).map((_, i) => (Math.sin(i * 0.37) + 1) / 2);
    const a = Organica.dither.errorDiffusion(g, W, H, Organica.dither.FS_KERNEL, true), b = Organica.dither.levels(g, W, H, [0, 1], 'fs');
    check('levels([0, 1]) = the 1-bit dither', a.every((v, i) => v === (b[i] === 0 ? 1 : 0)), ''); }
  // Remove photo: back to Fill, the store keeps it
  F.setTier('element'); q('btn-element-photo-remove').click(); await w(50);
  check('Remove photo: Style back to Fill, no photo keys', q('sel-element-fillmode').value === 'fill' && !Object.keys(F.getElementAppearance()).some(k => /^photo/.test(k)), q('sel-element-fillmode').value);
  check('the store keeps the photo (saved work may use it)', !!F.PHOTO_STORE.read()[id], '');
  return { fails, rows };`);
for (const r of res.rows) console.log('  ' + r);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !res.fails.length && !errs.length;
console.log(`\nFVS photo: ${ok ? 'PASS' : 'FAIL'} — ${res.rows.length} checks${res.fails.length ? `, ${res.fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
