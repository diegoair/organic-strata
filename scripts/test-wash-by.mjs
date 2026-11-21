// The Wash's Colour by + Mix and Wash over (Nov 21, 2026 — Diego: "in tunesutra … mancano each shape o across shape",
// "i color by Posterize random tone + random e tone non sono stati portati", "posso decidere se questo effetto wash in
// FVS può essere applicato ad un elemento o componente intero"). Checks:
//   engine  — Posterize = one band per stop, solid (no halftone mark); Random / Tone + random = specks of the stops only;
//             Mix sRGB draws other colours than OKLab; specks over All the shapes share the sheet's grid
//   editor  — since Nov 21, 2026 (evening) the Wash is a Shading: out of Gradient › Type, its rows in the Shadow section
//   TuneSutra — the house is a sheet: Wash over is shown, All the shapes draws other pieces than Each shape; no Colour mode
//   FVS     — Wash over shown; in a Component, All the shapes = one wash over the frame (every cell a different piece,
//             drawn back through the cell's inverse), Each shape = the same wash in every cell; the canvas draws it
// Run: node --experimental-websocket scripts/test-wash-by.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 5 * 60 * 1000 });
let failed = 0;
const check = (label, ok, detail) => { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };

// ── engine + editor (a public page, the shared scripts loaded by hand)
await P.goto('/privacy/', 'true');
await P.ev(`
  for (const f of ['core.js', 'color.js', 'noise.js', 'shade-marks.js', 'shading.js', 'plate-export.js', 'palettes.js', 'shade-editor.js']) {
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/shared/' + f + '?t=' + Date.now(); s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }`);
const E = await P.ev(`
  const S = Organica.shading, X = Organica.plateExport, stops = ['#2b1d16', '#b5642f', '#f3e2b8', '#6a8f7a'];
  const wash = (by, extra) => S.normalize({ type: 'field', angle: 90, stops: stops, field: Object.assign({ by: by }, extra || {}) });
  const hexes = pl => [...new Set(pl.filter(p => p.d).map(p => p.hex))];
  const out = {};
  const tone = S.fieldPlates(wash('tone'), 240, 160, {}), post = S.fieldPlates(wash('posterize'), 240, 160, {});
  out.toneBands = tone.length; out.postBands = post.length; out.postInks = hexes(post); out.postMix = post.some(p => p.mix);
  const rnd = S.fieldPlates(wash('random'), 240, 160, {}), tr = S.fieldPlates(wash('tonernd'), 240, 160, {});
  out.rndInks = hexes(rnd); out.trInks = hexes(tr); out.rndCells = rnd.reduce((n, p) => n + p.cells, 0);
  const ok = h => stops.includes(h);
  out.onlyStops = out.postInks.every(ok) && out.rndInks.every(ok) && out.trInks.every(ok);
  // Tone + random follows the tone: its first stop sits on the dark end (top, angle 90 = left → right … use rows)
  const srgb = S.fieldPlates(wash('tone', { space: 'srgb' }), 240, 160, {});
  out.mixDiffers = JSON.stringify(hexes(srgb)) !== JSON.stringify(hexes(tone));
  // plates: Posterize / Random separate into the stops, solid — no dot screen
  const svgOf = pl => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><path fill="' + stops[0] + '" d="M0 0h240v160h-240z"/>' + S.overlaySVG(pl, stops[0], 'M0 0h240v160h-240z', { box: { x: 0, y: 0, w: 240, h: 160 } }) + '</svg>';
  const ps = svgOf(wash('posterize')), pi = X.inksOf(ps, [stops[0]], '#ffffff');
  out.postPlates = pi.length; out.postScreen = /<pattern/.test(X.plateSVG(ps, pi, 1, '#ffffff'));
  // specks over the sheet: two neighbouring boxes on one grid (the second box's first speck starts on the grid)
  const sh = wash('random', { span: 'sheet' });
  const a = S.fieldPlates(sh, 50, 50, { sheet: { x: 0, y: 0, w: 213, h: 213 }, origin: { x: 7, y: 0 } });
  out.gridOff = (a.find(p => p.cells) || {}).d ? /^M-1 /.test(a.find(p => p.cells).d) || /M-1 /.test(a.find(p => p.cells).d) : false;
  // the editor: the Wash is a Shading (Nov 21, 2026, evening) — gone from Gradient › Type, in the Shading menu; chosen,
  // the Gradient section steps aside and its rows sit in the Shadow section
  const host = document.createElement('div'); document.body.appendChild(host);
  let flat = S.normalize({ type: 'flat', stops: ['#b5642f', '#3a1a08'] });
  Organica.shadeEditor.mount(host, { hex: '#b5642f', ctx: { sheet: { x: 0, y: 0, w: 1, h: 1 } }, edit: { get: () => flat, before: () => {}, after: () => {} } });
  const q = s => host.querySelector(s), shSel = q('select[aria-label="Shading"]');
  out.inType = !!q('[data-seg="type"] [data-v="field"]');
  out.inMenu = [...shSel.options].some(o => o.value === 'wash');
  out.cat = [...shSel.querySelectorAll('optgroup')].filter(g => g.label === 'Wash').map(g => [...g.children].map(o => o.textContent).join(' · ')).join();
  shSel.value = 'wash'; shSel.dispatchEvent(new Event('change'));
  const shadowPart = q('[data-part="shadow"]'), gradPart = q('[data-part="gradient"]');
  out.chosen = flat.type === 'field' && !flat.shadow && !gradPart.hidden && shSel.value === 'wash' && !q('[data-seg="type"] .seg-btn.active');
  out.rowsInShadow = ['[data-row="space"]', '[data-row="size"]', '[data-row="seed"]'].every(k => shadowPart.contains(q(k)) && !q(k).hidden)
    && shadowPart.contains(q('[data-row="angle"]')) && !q('[data-row="angle"]').hidden && shadowPart.contains(q('[data-block="stops"]')) && !q('[data-block="stops"]').hidden
    && !q('[data-row="span"]') && !q('[data-sel="by"]');
  shSel.value = 'wash-posterize'; shSel.dispatchEvent(new Event('change'));
  out.byEdit = S.fieldParams(flat).by + '/' + shSel.value + '/' + (q('[data-row="space"]').hidden ? 'nomix' : 'mix');
  shSel.value = 'camo-maze'; shSel.dispatchEvent(new Event('change'));
  out.leave = flat.type === 'flat' && flat.shadow && flat.specks === 'camo-maze' && !q('[data-part="gradient"]').hidden && q('[data-part="gradient"]').contains(q('[data-block="stops"]')) && q('[data-part="gradient"]').contains(q('[data-row="angle"]')) && q('[data-block="field"]').hidden;
  // Organica.palettes.washOf (kept for the Wash's new place): Inks dark → bright, Adaptive Ink → Paper, Solid none
  const W = Organica.palettes.washOf, hx = ['#f3e2b8', '#b5642f', '#2b1d16', '#ffffff'];
  out.washOf = [W(hx, { mode: 'rmx', submode: 'posterize' }), W(hx, { mode: 'adaptive', pair: [2, 3] }), W(hx, { mode: 'solid' })].map(x => x.by + ':' + (x.stops ? x.stops.join(',') : '-')).join(' | ');
  return out;`);
check('Wash is gone from Gradient › Type and is a Shading category: Tone · Posterize · Random · Tone + random', !E.inType && E.cat === 'Tone · Posterize · Random · Tone + random', JSON.stringify({ inType: E.inType, cat: E.cat }));
check('…chosen: the fill is a Wash, no shadow on it; the Gradient stays, no Type lit', E.chosen);
check('…Mix, Angle, Size, Seed and the Stops in the Shadow section; no Wash over, no Colour by select', E.rowsInShadow, String(E.rowsInShadow));
check('…another Wash entry changes its Colour by (Posterize: no Mix)', E.byEdit === 'posterize/wash-posterize/nomix', E.byEdit);
check('…another Shading (Camo › Maze) takes it off: a Flat fill with that shadow, the Angle and the Stops back in the Gradient', E.leave);
check('Organica.palettes.washOf: Inks dark → bright, Adaptive Ink → Paper, Solid none', E.washOf === 'posterize:#2b1d16,#b5642f,#f3e2b8,#ffffff | tone:#2b1d16,#ffffff | tone:-', E.washOf);
check('Posterize: one band per stop, the stops\' own inks, no halftone mark', E.postBands === 4 && E.postInks.length === 4 && !E.postMix, E.postBands + ' bands (Tone ' + E.toneBands + '): ' + E.postInks.join(' '));
check('Random and Tone + random: specks of the stops only', E.onlyStops && E.rndInks.length === 4 && E.trInks.length >= 3 && E.rndCells > 100, E.rndInks.length + ' / ' + E.trInks.length + ' inks, ' + E.rndCells + ' runs');
check('Mix sRGB draws other colours than OKLab', E.mixDiffers);
check('Posterize separates into its stops, solid (no dot screen)', E.postPlates === 4 && !E.postScreen, E.postPlates + ' plates, screen ' + E.postScreen);
check('Random over All the shapes: specks on the sheet\'s grid', E.gridOff, '');
check('engine + editor: no page errors', !P.errors.length, P.errors.splice(0).join(' | '));

// ── TuneSutra: the house is the Wash's sheet
await P.goto('/tunesutra/', 'window.Organica && document.getElementById("ts-shade") && document.querySelector("#ts-shade [data-seg=type]")');
await P.sleep(1200);
const T = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms)), ed = document.getElementById('ts-shade'), out = {};
  // the house view, a shape picked
  const seg = document.querySelector('.bar-seg[data-z]'); out.house = !!seg;
  if (seg) { seg.dispatchEvent(new MouseEvent('click', { bubbles: true })); await w(300); }
  out.noMode = !document.getElementById('ts-mode') && !document.getElementById('sel-map-by');
  // a colour saved with a Wash (set as the palette would bring it): Each shape vs All the shapes on the house
  const i = +seg.dataset.i, hex = state.items[i].hex, S = Organica.shading;
  const mk = span => S.withColour(S.normalize({ type: 'field', angle: 90, stops: [hex, '#f3e2b8'], field: { span: span } }), hex);
  const shades = () => [...document.querySelectorAll('#stage-svg g[clip-path^="url(#ts-sh"]')].map(g => g.innerHTML.replace(/ts-sh\d+/g, '')).join('|');
  state.items[i].shade = mk('shape'); renderStage(); await w(300); const a = shades();
  state.items[i].shade = mk('sheet'); renderStage(); await w(300); const b = shades();
  out.changed = a.length > 0 && a !== b;
  delete state.items[i].shade; renderStage();
  // the Shading menu: Wash on the selected shape
  const shSel = ed.querySelector('select[aria-label="Shading"]');
  shSel.value = 'wash-random'; shSel.dispatchEvent(new Event('change')); await w(400);
  out.picked = shSel.value === 'wash-random' && !ed.querySelector('[data-part="gradient"]').hidden && !ed.querySelector('[data-row="size"]').hidden;
  out.drawn = document.querySelectorAll('#stage-svg g[clip-path^="url(#ts-sh"]').length;
  shSel.value = 'none'; shSel.dispatchEvent(new Event('change')); await w(300);
  return out;`);
check('TuneSutra: no Colour mode section; Shading › Wash › Random on a shape draws it, its rows shown, the Gradient kept', T.noMode && T.picked && T.drawn > 0, JSON.stringify(T));
check('TuneSutra: a saved Wash still draws — All the shapes (the house as its sheet) other pieces than Each shape', T.changed, JSON.stringify(T));
check('TuneSutra: no page errors', !P.errors.length, P.errors.splice(0).join(' | '));

// ── FVS: a Component of 2 × 2 cells, the first ink washed
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const F = await P.ev(`
  const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms)), S = Organica.shading, out = {};
  F.setTier('component'); await w(400); q('btn-generate').click(); await w(1000);
  const comp = F.state.components[0], grid = { kind: 'square', cols: 2, rows: 2, cellSize: 100, gap: 0 };
  const items = F.buildComponentItems(comp, grid);
  const washOf = span => { const m = {}; F.state.colors.forEach(h => { m[h] = S.withColour(S.normalize({ type: 'field', angle: 90, stops: [h, '#f3e2b8'], field: { span: span } }), h); }); return m; };
  const pieces = svg => (svg.match(/<g clip-path="url\\(#shd[^"]*\\)">[\\s\\S]*?<\\/g><\\/g>/g) || []).map(s => s.replace(/shd[0-9a-z]+(-\\d+)?/g, '').replace(/<g transform="matrix\\([^)]*\\)">/, ''));
  F.state.inkShades = washOf('shape'); const a = pieces(F.buildComponentSVG(items, F.getSeed(), 200));
  F.state.inkShades = washOf('sheet'); const svgB = F.buildComponentSVG(items, F.getSeed(), 200), b = pieces(svgB);
  out.cells = a.length; out.eachSame = new Set(a).size; out.acrossDiffer = new Set(b).size; out.matrix = /<g transform="matrix\\(/.test(svgB);
  const cv = document.createElement('canvas'); cv.width = cv.height = 200;
  const g = cv.getContext('2d'); let err = '';
  try { F.drawComponentCanvas ? F.drawComponentCanvas(g, items, F.getSeed(), 200) : null; } catch (e) { err = String(e); }
  out.canvasErr = err; out.canvasFn = !!F.drawComponentCanvas;
  F.state.inkShades = {}; F.buildPalette && F.buildPalette();
  return out;`);
check('FVS: Each shape = the same wash in every cell', F.cells >= 4 && F.eachSame === 1, F.cells + ' pieces, ' + F.eachSame + ' distinct');
check('FVS: All the shapes = one wash over the Component, a different piece per cell, drawn back through the cell', F.acrossDiffer >= 4 && F.matrix, F.acrossDiffer + ' distinct, matrix ' + F.matrix);
check('FVS: the canvas draws it', !F.canvasErr, (F.canvasFn ? '' : 'drawComponentCanvas not exposed; ') + F.canvasErr);
check('FVS: no page errors', !P.errors.filter(e => !/Failed to load resource/.test(e)).length, P.errors.join(' | '));

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
