// Headless check for the Colour mode in Camo Turing and Membrane (Diego, Nov 22, 2026: "All three, as proposed").
// Camo: Inks, Colour by, the ramp's order (drag / ⌥→ / Sort by lightness) — no Mix (its shader blends in sRGB only,
// O-91 i). Membrane: Inks, Mix (Tone / Tone + random only, reaching the state the render reads), the order; its
// Mapping keeps its word until Diego names "along the form". Run: node --experimental-websocket
// scripts/test-colour-mode-camo-membrane.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 240000 });
let failed = 0;
const check = (label, okk, detail) => { if (!okk) failed++; console.log((okk ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
const ORDER = `
  out.sortOn = !q('btn-rmx-sort').disabled; q('btn-rmx-sort').click(); out.sorted = cols().join(); out.sortOff = q('btn-rmx-sort').disabled;
  q('rmx-palette').querySelector('.rmx-color button, .rmx-color input').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  out.moved = cols().join(); out.saveRows = q('rmx-color-block').querySelectorAll('[data-pal-save]').length;`;
const orderChecks = (R) => {
  check('Sort by lightness only when it would move a colour', R.sortOn && R.sortOff, R.sortOn + ' / ' + R.sortOff);
  check('Sort by lightness: dark → bright', R.sorted === '#1a2b3c,#e8b030,#f4efe4', R.sorted);
  check('⌥→ moves a chip along the ramp', R.moved === '#e8b030,#1a2b3c,#f4efe4', R.moved);
  check('one Save as palette… row', R.saveRows === 1, R.saveRows + ' rows');
};

console.log('CAMO TURING');
if (!await P.goto('/camo-turing/', 'window.__camo && document.querySelector("#rmx-palette .rmx-color")')) { console.log('  FAIL not ready'); await P.close(1); }
P.errors.length = 0;
let R = await P.ev(`
  const q = id => document.getElementById(id), out = {}, cols = () => __camo.rmxColors;
  out.seg = [...q('seg-colormode').querySelectorAll('.seg-btn')].map(b => b.textContent.trim()).join(' · ');
  out.by = q('sel-rmx-map').closest('.ctrl-row').querySelector('.ctrl-label').textContent.trim();
  out.byOpts = [...q('sel-rmx-map').options].map(o => o.textContent).join(' · ');
  out.noMix = !q('row-mix');
  setColorMode('rmx');
  __camo.setRmx(['#f4efe4', '#1a2b3c', '#e8b030'], 'tone');
  ${ORDER}
  out.uniform = __camo.dispMat.uniforms.uPalette.value.slice(0, 3).map(c => '#' + c.getHexString()).join();
  return out;`);
check('modes Solid · Adaptive · Inks', R.seg === 'Solid · Adaptive · Inks', R.seg);
check('Colour by Tone · Posterize · Random · Tone + random', R.by === 'Colour by' && R.byOpts === 'Tone · Posterize · Random · Tone + random', R.by + ': ' + R.byOpts);
check('no Mix row (the shader blends in sRGB only)', R.noMix, String(R.noMix));
orderChecks(R);
check('the shader gets the new order', R.uniform === R.moved, R.uniform);
if (P.errors.length) { failed++; console.log('  FAIL page errors — ' + P.errors.join(' | ')); }

console.log('MEMBRANE');
if (!await P.goto('/membrane/', 'window.__membrane && document.querySelector("#rmx-palette .rmx-color")')) { console.log('  FAIL not ready'); await P.close(1); }
P.errors.length = 0;
R = await P.ev(`
  const q = id => document.getElementById(id), out = {}, S = __membrane.state, cols = () => S.rmxColors;
  const vis = id => !q(id).closest('[hidden]'), mixOn = () => (q('seg-mix').querySelector('.active') || {}).dataset || {};
  out.opt = q('sel-colorsrc').querySelector('option[value="rmx"]').textContent;
  const src = q('sel-colorsrc'); src.value = 'rmx'; src.dispatchEvent(new Event('change'));
  out.mixTone = vis('row-mix');
  const sel = q('sel-rmx-map'); sel.value = 'posterize'; sel.dispatchEvent(new Event('change')); out.poster = vis('row-mix');
  sel.value = 'tonernd'; sel.dispatchEvent(new Event('change')); out.tonernd = vis('row-mix');
  q('seg-mix').querySelector('[data-v="oklab"]').click(); out.space = S.rmxSpace + ' ' + mixOn().v;
  src.value = 'ink'; src.dispatchEvent(new Event('change')); out.inkHides = !vis('row-mix');
  src.value = 'rmx'; src.dispatchEvent(new Event('change'));
  return out;`);
check('mode option Inks', R.opt === 'Inks', R.opt);
check('Mix shown with Tone and Tone + random, hidden with Posterize', R.mixTone && R.tonernd && !R.poster, [R.mixTone, R.tonernd, R.poster].join());
check('Mix reaches the state the render reads', R.space === 'oklab oklab', R.space);
check('Mix hidden outside Inks', R.inkHides, String(R.inkHides));
R = await P.ev(`
  const q = id => document.getElementById(id), out = {}, S = __membrane.state, cols = () => S.rmxColors;
  S.rmxColors = ['#f4efe4', '#1a2b3c', '#e8b030'];
  q('sel-rmx-map').dispatchEvent(new Event('change'));   // syncColourRows: Sort by lightness reads the new order
  ${ORDER}
  return out;`);
orderChecks(R);
if (P.errors.length) { failed++; console.log('  FAIL page errors — ' + P.errors.join(' | ')); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
