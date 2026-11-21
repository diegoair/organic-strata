import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
const SEED = `const S = Organica.shading, w = ms => new Promise(r => setTimeout(r, ms)), rows = [], check = (n, ok, got) => rows.push((ok ? 'ok ' : 'FAIL ') + n + (ok ? '' : ' — ' + got));
  const cols = ['#f2ead8', '#2a3a8c', '#c9863e'];   // background, main, sub — not dark → bright
  const sp = S.withColour(JSON.parse(JSON.stringify(S.defs(cols[1]).speckle)), cols[1]);
  Organica.store('tunesutra').write({
    'Test shading': { n: 3, colors: cols, parts: ['background', 'main', 'sub'], shades: [null, sp, null], house: 42, mapping: { mode: 'rmx', submode: 'posterize', order: [1, 2, 0], pair: [1, 0], space: 'oklab' } },
    'Test solid': { n: 3, colors: cols, parts: ['background', 'main', 'sub'], shades: [null, sp, null], house: 43, mapping: { mode: 'solid', submode: 'tone', order: [1, 2, 0], pair: [2, 0], space: 'srgb' } },
  });
  const take = async (btn, name) => { btn.click(); await w(300); const it = [...document.querySelectorAll('.pal-menu .preset-item')].find(b => b.textContent === name); if (!it) return false; it.click(); await w(500); return true; };
  const img = await new Promise(r => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 300, 0); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, 300, 200); const i = new Image(); i.onload = () => r(i); i.src = c.toDataURL(); });
  const inkOnly = svg => (svg.match(/(?:fill|stroke|stop-color)="([^"]+)"/g) || []).map(m => m.split('"')[1]).filter(v => v !== '#000000' && v !== 'none' && v !== '#000');`;

await P.goto('/spore/', "document.getElementById('rmx-palette') && window.Organica && Organica.paletteKit");
const spore = await P.ev(SEED + `
  document.querySelector('.cm-btn[onclick*="rmx"]').click(); await w(200);
  check('taken from the ▦', await take(document.querySelector('#rmx-palette .pal-btn'), 'Test shading'), 'no menu item');
  check('colours dark → bright', JSON.stringify(rmxColors) === JSON.stringify(['#2a3a8c', '#c9863e', '#f2ead8']), JSON.stringify(rmxColors));
  check('shading of main kept', rmxShades['#2a3a8c'] && rmxShades['#2a3a8c'].specks === 'specks', JSON.stringify(Object.keys(rmxShades)));
  check('Mapping from submode', rmxColorMap === 'posterize' && document.getElementById('sel-rmx-map').value === 'posterize' && colorMode === 'rmx', rmxColorMap + colorMode);
  check('space stored', rmxSpace === 'oklab', rmxSpace);
  check('editor mounted', document.getElementById('spore-shade').children.length > 0, 0);
  sourceImage = img; doRender();
  for (let t = 0; t < 100 && (isRendering || !window._lastRenderData || !window._lastRenderData.marks.length); t++) await w(100);
  await w(300);
  const svg = buildSporeSVG();
  check('SVG carries shading clip', /clip-path="url\\(#/.test(svg), svg.length);
  const plan = platePlan();
  check('plates: strip + shadow inks', plan && plan.inks.length > 3, plan && plan.inks.join());
  let bad = [], n = 0;
  plan.inks.forEach((_, i) => { const p = plateSVGAt(plan, i); if (p) { n++; bad = bad.concat(inkOnly(p)); } });
  check('every plate only black/clear (' + n + ' plates)', n >= 3 && bad.length === 0, [...new Set(bad)].join());
  check('Plates button counts inks', /\\(\\d+\\)/.test(document.getElementById('btn-plates-svg').textContent) && +document.getElementById('btn-plates-svg').textContent.match(/\\d+/)[0] === plan.inks.length, document.getElementById('btn-plates-svg').textContent);
  const pm = currentMapping();
  check('mapping getter', pm.mode === 'rmx' && pm.submode === 'posterize' && pm.space === 'oklab', JSON.stringify(pm));
  // canvas shading differs from flat
  const c1 = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; const keep = rmxShades; rmxShades = {}; doRender();
  for (let t = 0; t < 100 && isRendering; t++) await w(100); await w(200);
  const c2 = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; rmxShades = keep;
  let diff = 0; for (let i = 0; i < c1.length; i += 4) if (Math.abs(c1[i] - c2[i]) + Math.abs(c1[i+1] - c2[i+1]) + Math.abs(c1[i+2] - c2[i+2]) > 30) diff++;
  check('canvas draws the shading (' + diff + ' px)', diff > 100, diff);
  // a solid palette
  await take(document.querySelector('#rmx-palette .pal-btn'), 'Test solid');
  check('solid mode + pair', colorMode === 'solid' && document.getElementById('hex-mark').value === rmxColors[1] && document.getElementById('hex-bg').value === rmxColors[2], colorMode + ' ' + document.getElementById('hex-mark').value + ' ' + document.getElementById('hex-bg').value + ' ' + rmxColors.join());
  return rows;`);
console.log('SPORE\n' + spore.join('\n'));

await P.goto('/halide/', "document.getElementById('hex-ink') && window.Organica && Organica.paletteKit");
const halide = await P.ev(SEED + `
  check('taken from the ink ▦', await take(document.querySelector('#hex-ink').parentNode.querySelector('.pal-btn'), 'Test shading'), 'no item');
  const v = id => document.getElementById(id).value.toLowerCase();
  check('roles: ink main, paper background', v('hex-ink') === '#2a3a8c' && v('hex-paper') === '#f2ead8', v('hex-ink') + v('hex-paper') + v('hex-bgfill'));
  check('bgfill filled', v('hex-bgfill') === '#c9863e' || v('hex-bgfill') === '#f2ead8', v('hex-bgfill'));
  check('ink shading taken', inkShade && inkShade.specks === 'specks', JSON.stringify(inkShade && inkShade.specks));
  check('editor mounted', document.getElementById('halide-shade').children.length > 0, 0);
  sourceImage = img; computeAndPaint(); await w(200);
  const svg = buildSVG(4);
  check('SVG carries shading clip', /clip-path="url\\(#/.test(svg), svg.length);
  document.getElementById('ck-svg-simplify').checked = !document.getElementById('ck-svg-simplify').checked;
  check('SVG (other simplify) carries shading clip', /clip-path="url\\(#/.test(buildSVG(4)), 0);
  const c1 = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; const keep = inkShade; inkShade = null; paintPreview();
  const c2 = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; inkShade = keep; paintPreview();
  let diff = 0; for (let i = 0; i < c1.length; i += 4) if (Math.abs(c1[i] - c2[i]) + Math.abs(c1[i+1] - c2[i+1]) + Math.abs(c1[i+2] - c2[i+2]) > 30) diff++;
  check('canvas draws the shading (' + diff + ' px)', diff > 100, diff);
  // presets keep it; an old one is flat
  document.getElementById('txt-preset-name').value = 'tmp-shaded'; confirmSavePreset();
  check('preset saved with inkShade', userPresets()['tmp-shaded'].inkShade && userPresets()['tmp-shaded'].inkShade.specks === 'specks', 0);
  applyPreset('Newspaper (Bayer 4×4)'); check('old preset = flat', inkShade === null, JSON.stringify(inkShade));
  applyPreset('tmp-shaded'); check('shaded preset restores', inkShade && inkShade.specks === 'specks', 0);
  const u = userPresets(); delete u['tmp-shaded']; PRESETS.write(u);
  // ink edited by hand keeps its shading on the new colour
  swatches.ink.set('#1c6b3a'); check('ink edit moves shading', inkShade && inkShade.stops[S.colourStop(inkShade)] === '#1c6b3a', JSON.stringify(inkShade && inkShade.stops));
  return rows;`);
console.log('HALIDE\n' + halide.join('\n'));
console.log('errors:', P.errors);
await P.close(0);
