// The Wash's Colour by + Mix and Wash over (Nov 21, 2026 — Diego: "in tunesutra … mancano each shape o across shape",
// "i color by Posterize random tone + random e tone non sono stati portati", "posso decidere se questo effetto wash in
// FVS può essere applicato ad un elemento o componente intero"). Checks:
//   engine  — Posterize = one band per stop, solid (no halftone mark); Random / Tone + random = specks of the stops only;
//             Mix sRGB draws other colours than OKLab; specks over All the shapes share the sheet's grid
//   editor  — Colour by + Mix in the Wash block, Mix only with Tone
//   TuneSutra — the house is a sheet: Wash over is shown, All the shapes draws other pieces than Each shape
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
  for (const f of ['core.js', 'color.js', 'noise.js', 'shade-marks.js', 'shading.js', 'plate-export.js', 'shade-editor.js']) {
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
  // the editor
  const host = document.createElement('div'); document.body.appendChild(host);
  let def = wash('tone');
  const ed = Organica.shadeEditor.mount(host, { hex: stops[0], ctx: {}, edit: { get: () => def, before: () => {}, after: () => {} } });
  ed.sync && ed.sync();
  const q = s => host.querySelector(s);
  out.by = !!q('[data-sel="by"]') && [...q('[data-sel="by"]').options].map(o => o.textContent).join(' · ');
  out.mixTone = !q('[data-row="space"]').hidden;
  const sel = q('[data-sel="by"]'); sel.value = 'random'; sel.dispatchEvent(new Event('change'));
  out.byEdit = S.fieldParams(def).by; ed.sync && ed.sync();
  out.mixRandom = q('[data-row="space"]').hidden;
  out.overNoSheet = q('[data-row="span"]').hidden;
  return out;`);
check('Posterize: one band per stop, the stops\' own inks, no halftone mark', E.postBands === 4 && E.postInks.length === 4 && !E.postMix, E.postBands + ' bands (Tone ' + E.toneBands + '): ' + E.postInks.join(' '));
check('Random and Tone + random: specks of the stops only', E.onlyStops && E.rndInks.length === 4 && E.trInks.length >= 3 && E.rndCells > 100, E.rndInks.length + ' / ' + E.trInks.length + ' inks, ' + E.rndCells + ' runs');
check('Mix sRGB draws other colours than OKLab', E.mixDiffers);
check('Posterize separates into its stops, solid (no dot screen)', E.postPlates === 4 && !E.postScreen, E.postPlates + ' plates, screen ' + E.postScreen);
check('Random over All the shapes: specks on the sheet\'s grid', E.gridOff, '');
check('the editor: Colour by with the four words, writes def.field.by', E.by === 'Tone · Posterize · Random · Tone + random' && E.byEdit === 'random', E.by + ' → ' + E.byEdit);
check('the editor: Mix shown with Tone only', E.mixTone && E.mixRandom, JSON.stringify({ tone: E.mixTone, randomHidden: E.mixRandom }));
check('the editor: no sheet, no Wash over', E.overNoSheet);
check('engine + editor: no page errors', !P.errors.length, P.errors.splice(0).join(' | '));

// ── TuneSutra: the house is the Wash's sheet
await P.goto('/tunesutra/', 'window.Organica && document.getElementById("ts-shade") && document.querySelector("#ts-shade [data-seg=type]")');
await P.sleep(1200);
const T = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms)), ed = document.getElementById('ts-shade'), out = {};
  // the house view, a shape picked
  const seg = document.querySelector('.bar-seg[data-z]'); out.house = !!seg;
  if (seg) { seg.dispatchEvent(new MouseEvent('click', { bubbles: true })); await w(300); }
  ed.querySelector('[data-seg="type"] [data-v="field"]').click(); await w(300);
  out.over = !ed.querySelector('[data-row="span"]').hidden;
  out.by = !!ed.querySelector('[data-sel="by"]') && !ed.querySelector('[data-row="by"]').hidden;
  const shades = () => [...document.querySelectorAll('#stage-svg g[clip-path^="url(#ts-sh"]')].map(g => g.innerHTML.replace(/ts-sh\\d+/g, '')).join('|');
  const a = shades();
  ed.querySelector('[data-seg="span"] [data-v="sheet"]').click(); await w(400);
  const b = shades();
  out.changed = a.length > 0 && a !== b;
  ed.querySelector('[data-seg="span"] [data-v="shape"]').click(); await w(300);
  return out;`);
check('TuneSutra: on the house the Wash shows Colour by and Wash over', T.house && T.over && T.by, JSON.stringify(T));
check('TuneSutra: All the shapes draws other pieces than Each shape', T.changed, JSON.stringify(T));
check('TuneSutra: no page errors', !P.errors.length, P.errors.splice(0).join(' | '));

// ── FVS: a Component of 2 × 2 cells, the first ink washed
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const F = await P.ev(`
  const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms)), S = Organica.shading, out = {};
  F.setTier('component'); await w(400); q('btn-generate').click(); await w(1000);
  out.over = !document.querySelector('#fvs-shade [data-row="span"]').hidden || 'hidden';
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
check('FVS: Wash over is shown', F.over === true, String(F.over));
check('FVS: Each shape = the same wash in every cell', F.cells >= 4 && F.eachSame === 1, F.cells + ' pieces, ' + F.eachSame + ' distinct');
check('FVS: All the shapes = one wash over the Component, a different piece per cell, drawn back through the cell', F.acrossDiffer >= 4 && F.matrix, F.acrossDiffer + ' distinct, matrix ' + F.matrix);
check('FVS: the canvas draws it', !F.canvasErr, (F.canvasFn ? '' : 'drawComponentCanvas not exposed; ') + F.canvasErr);
check('FVS: no page errors', !P.errors.filter(e => !/Failed to load resource/.test(e)).length, P.errors.join(' | '));

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
