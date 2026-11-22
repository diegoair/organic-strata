// Headless check for Spore's Colour mode (Diego, Nov 22, 2026: "ora porta il colour mode su Spore" — after Pollen).
// (1) the words: Solid · Adaptive · Image · Multi · Inks, Colour by, Mix, Sort by lightness, Ink / Paper; (2) what each
// mode shows — Mix only where two colours blend; (3) Mix reaches the render (rmxSpace); (4) Sort by lightness and ⌥→
// reorder the ramp; (5) one Save as palette… row; (6) Density's seg no longer clears the Mix; (7) a palette taken whole
// sets the mode and the Mix. Run: node --experimental-websocket scripts/test-spore-colour-mode.mjs — exits 1 on a failure.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 180000 });
const PAL = { n: 3, colors: ['#e8b030', '#1a2b3c', '#f4efe4'], parts: ['main', 'sub', 'background'],
  mapping: { mode: 'adaptive', submode: 'tone', order: [1, 0, 2], pair: [1, 2], space: 'oklab' } };
const ok = await P.goto('/spore/', 'window.Organica && Organica.paletteKit && Organica.reorder && typeof setColorMode === "function"');
if (!ok) { console.log('  FAIL /spore/ not ready'); await P.close(1); }
const R = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms)), q = id => document.getElementById(id), out = {};
  const vis = id => !q(id).closest('[hidden]'), mode = m => setColorMode(m, document.querySelector('.cm-btn[onclick*="\\'' + m + '\\'"]'));
  const mixOn = () => (q('mix-seg').querySelector('.active') || {}).dataset;
  out.modes = [...document.querySelectorAll('.cm-btn')].map(b => b.textContent.trim()).join(' · ');
  out.by = q('sel-rmx-map').closest('.ctrl-row').querySelector('.ctrl-label').textContent.trim();
  out.byOpts = [...q('sel-rmx-map').options].map(o => o.textContent).join(' · ');
  out.mix = [...q('mix-seg').querySelectorAll('.seg-btn')].map(b => b.textContent.trim()).join(' · ');
  out.sort = q('btn-rmx-sort').textContent.trim();
  out.pair = [q('hex-mark'), q('hex-bg')].map(e => e.parentNode.querySelector('.ctrl-label').textContent.trim()).join(' / ');
  const shows = () => ({ inks: vis('rmx-color-block'), mix: vis('row-mix'), ink: vis('row-mark') });
  mode('solid'); out.solid = shows();
  mode('adaptive'); out.adaptive = shows();
  mode('image'); out.image = shows();
  mode('rmx'); await w(200); out.rmx = shows();
  const sel = q('sel-rmx-map'); sel.value = 'posterize'; sel.dispatchEvent(new Event('change')); out.poster = vis('row-mix');
  sel.value = 'tone'; sel.dispatchEvent(new Event('change'));
  setMix('oklab'); out.space = rmxSpace + ' ' + (mixOn() || {}).val;
  const dens = [...document.querySelectorAll('.seg-btn')].find(b => (b.getAttribute('onclick') || '').indexOf('setDensity') >= 0);
  if (dens) dens.click(); out.afterDensity = (mixOn() || {}).val || 'none';
  rmxColors = ['#f4efe4', '#1a2b3c', '#e8b030']; rmxKit.rebuild(); syncColourRows();
  out.sortOn = !q('btn-rmx-sort').disabled; q('btn-rmx-sort').click(); out.sorted = rmxColors.join(); out.sortOff = q('btn-rmx-sort').disabled;
  const first = q('rmx-palette').querySelector('.rmx-color button, .rmx-color input');
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  out.moved = rmxColors.join(); out.saveRows = q('rmx-color-block').querySelectorAll('[data-pal-save]').length;
  mode('solid'); setMix('srgb');
  Organica.store('tunesutra').write({ PAL: ${JSON.stringify(PAL)} });
  mode('rmx'); await w(200);
  const btn = [...q('rmx-palette').querySelectorAll('.pal-btn, .rmx-add')].pop(); btn.click(); await w(300);
  const m = [...document.querySelectorAll('.pal-menu')].find(x => !x.hidden);
  const it = m && [...m.querySelectorAll('.preset-item')].find(b => b.textContent.trim() === 'PAL');
  if (it) { it.click(); await w(400); }
  out.taken = !!it && colorMode + ' ' + (mixOn() || {}).val + ' ' + vis('row-mix') + ' ' + q('hex-mark').value + ' ' + q('hex-bg').value;
  return out;`);
let failed = 0;
const check = (label, okk, detail) => { if (!okk) failed++; console.log((okk ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
check('modes Solid · Adaptive · Image · Multi · Inks', R.modes === 'Solid · Adaptive · Image · Multi · Inks', R.modes);
check('Colour by Tone · Posterize · Random · Tone + random', R.by === 'Colour by' && R.byOpts === 'Tone · Posterize · Random · Tone + random', R.by + ': ' + R.byOpts);
check('Mix sRGB · OKLab, Sort by lightness', R.mix === 'sRGB · OKLab' && R.sort === 'Sort by lightness', R.mix + ' / ' + R.sort);
check('the pair is Ink / Paper', R.pair === 'Ink / Paper', R.pair);
check('Solid: Ink, no Mix, no inks', R.solid.ink && !R.solid.mix && !R.solid.inks, JSON.stringify(R.solid));
check('Adaptive: Ink + Mix', R.adaptive.ink && R.adaptive.mix && !R.adaptive.inks, JSON.stringify(R.adaptive));
check('Image: no Mix', !R.image.mix && !R.image.inks, JSON.stringify(R.image));
check('Inks: the strip + Mix, no Ink', !R.rmx.ink && R.rmx.mix && R.rmx.inks, JSON.stringify(R.rmx));
check('Mix hides with Posterize', !R.poster, String(R.poster));
check('Mix reaches the render', R.space === 'oklab oklab', R.space);
check('Density no longer clears the Mix', R.afterDensity === 'oklab', R.afterDensity);
check('Sort by lightness only when it would move a colour', R.sortOn && R.sortOff, R.sortOn + ' / ' + R.sortOff);
check('Sort by lightness: dark → bright', R.sorted === '#1a2b3c,#e8b030,#f4efe4', R.sorted);
check('⌥→ moves a chip along the ramp', R.moved === '#e8b030,#1a2b3c,#f4efe4', R.moved);
check('one Save as palette… row', R.saveRows === 1, R.saveRows + ' rows');
check('a palette taken whole sets the mode, the Mix and the pair', R.taken === 'adaptive oklab true #1a2b3c #f4efe4', String(R.taken));
if (P.errors.length) { failed++; console.log('  FAIL page errors — ' + P.errors.join(' | ')); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
