// Headless check for Pollen's Colour mode (Diego, Nov 22, 2026: "testiamo il colour mode su Pollen" — the section that
// left TuneSutra on Nov 21 lives in the tone tools, Pollen first). (1) the words: Solid · Adaptive · Inks, Colour by
// (Tone · Posterize · Random · Tone + random), Mix (sRGB · OKLab), Sort by lightness; (2) what each mode shows — Mix
// only where two colours blend; (3) Mix reaches the engine (pointParams().space); (4) Sort by lightness and moving a
// chip (⌥→) reorder the ramp; (5) a preset keeps the Mix; (6) a palette taken whole sets the Mix.
// Run: node --experimental-websocket scripts/test-pollen-colour-mode.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 180000 });
const PAL = { n: 3, colors: ['#e8b030', '#1a2b3c', '#f4efe4'], parts: ['main', 'sub', 'background'],
  mapping: { mode: 'adaptive', submode: 'tone', order: [1, 0, 2], pair: [1, 2], space: 'oklab' } };
const ok = await P.goto('/pollen/', 'window.Organica && Organica.paletteKit && Organica.reorder');
if (!ok) { console.log('  FAIL /pollen/ not ready'); await P.close(1); }
const R = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms)), q = id => document.getElementById(id), out = {};
  const vis = id => !q(id).closest('[hidden]');
  out.seg = [...q('colormode-seg').querySelectorAll('.seg-btn')].map(b => b.textContent.trim()).join(' · ');
  out.by = q('sel-rmx-map').closest('.ctrl-row').querySelector('.ctrl-label').textContent.trim();
  out.byOpts = [...q('sel-rmx-map').options].map(o => o.textContent).join(' · ');
  out.mix = [...q('mix-seg').querySelectorAll('.seg-btn')].map(b => b.textContent.trim()).join(' · ');
  out.sort = q('btn-rmx-sort').textContent.trim();
  out.pair = [...document.querySelectorAll('.color-row .color-name')].map(e => e.textContent.trim()).slice(0, 2).join(' / ');
  const shows = () => ({ inks: vis('rmx-color-block'), mix: vis('row-mix'), point: vis('row-point') });
  setColorMode('solid'); out.solid = shows();
  setColorMode('adaptive'); out.adaptive = shows();
  setColorMode('rmx'); await w(200); out.rmx = shows();
  const sel = q('sel-rmx-map'); sel.value = 'posterize'; sel.dispatchEvent(new Event('change')); out.poster = vis('row-mix');
  sel.value = 'tonernd'; sel.dispatchEvent(new Event('change')); out.tonernd = vis('row-mix');
  sel.value = 'tone'; sel.dispatchEvent(new Event('change'));
  setMix('oklab'); out.space = pointParams().space; out.mixOn = q('mix-seg').querySelector('.active').dataset.val;
  rmxColors = ['#f4efe4', '#1a2b3c', '#e8b030']; rmxKit.rebuild(); syncColourRows();
  out.sortOn = !q('btn-rmx-sort').disabled; q('btn-rmx-sort').click(); out.sorted = rmxColors.join(); out.sortOff = q('btn-rmx-sort').disabled;
  const first = q('rmx-palette').querySelector('.rmx-color button, .rmx-color input');
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  out.saveRows = q('rmx-color-block').querySelectorAll('[data-pal-save]').length;
  out.moved = rmxColors.join(); out.chips = [...q('rmx-palette').querySelectorAll('.rmx-color')].length;
  const s = getState(); setMix('srgb'); setState(s); out.preset = rmxSpace + ' ' + q('mix-seg').querySelector('.active').dataset.val;
  setState({ colorMode: 'rmx' }); out.legacy = (rmxSpace || 'srgb') + ' ' + q('mix-seg').querySelector('.active').dataset.val;
  Organica.store('tunesutra').write({ PAL: ${JSON.stringify(PAL)} });
  const btn = [...q('rmx-palette').querySelectorAll('.pal-btn, .rmx-add')].pop(); btn.click(); await w(300);
  const m = [...document.querySelectorAll('.pal-menu')].find(x => !x.hidden);
  const it = m && [...m.querySelectorAll('.preset-item')].find(b => b.textContent.trim() === 'PAL');
  if (it) { it.click(); await w(400); }
  out.taken = !!it && colorMode + ' ' + q('mix-seg').querySelector('.active').dataset.val + ' ' + vis('row-mix');
  return out;`);
let failed = 0;
const check = (label, okk, detail) => { if (!okk) failed++; console.log((okk ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
check('modes Solid · Adaptive · Inks', R.seg === 'Solid · Adaptive · Inks', R.seg);
check('Colour by Tone · Posterize · Random · Tone + random', R.by === 'Colour by' && R.byOpts === 'Tone · Posterize · Random · Tone + random', R.by + ': ' + R.byOpts);
check('Mix sRGB · OKLab, Sort by lightness', R.mix === 'sRGB · OKLab' && R.sort === 'Sort by lightness', R.mix + ' / ' + R.sort);
check('the pair is Ink / Paper', R.pair === 'Ink / Paper', R.pair);
check('Solid: Point, no Mix, no inks', R.solid.point && !R.solid.mix && !R.solid.inks, JSON.stringify(R.solid));
check('Adaptive: Point + Mix, no inks', R.adaptive.point && R.adaptive.mix && !R.adaptive.inks, JSON.stringify(R.adaptive));
check('Inks: the strip + Mix, no Point', !R.rmx.point && R.rmx.mix && R.rmx.inks, JSON.stringify(R.rmx));
check('Mix hides where nothing blends (Posterize), shows for Tone + random', !R.poster && R.tonernd, R.poster + ' / ' + R.tonernd);
check('Sort by lightness only when it would move a colour', R.sortOn && R.sortOff, R.sortOn + ' / ' + R.sortOff);
check('Mix reaches the engine', R.space === 'oklab' && R.mixOn === 'oklab', R.space + ' / ' + R.mixOn);
check('Sort by lightness: dark → bright', R.sorted === '#1a2b3c,#e8b030,#f4efe4', R.sorted);
check('⌥→ moves a chip along the ramp', R.moved === '#e8b030,#1a2b3c,#f4efe4' && R.chips === 3, R.moved);
check('one Save as palette… row after the strip is rebuilt', R.saveRows === 1, R.saveRows + ' rows');
check('a preset keeps its Mix', R.preset === 'oklab oklab', R.preset);
check('an older preset opens in sRGB', R.legacy === 'srgb srgb', R.legacy);
check('a palette taken whole sets the mode and the Mix', R.taken === 'adaptive oklab true', String(R.taken));
if (P.errors.length) { failed++; console.log('  FAIL page errors — ' + P.errors.join(' | ')); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
