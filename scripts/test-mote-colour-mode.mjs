// Headless check for Mote's Colour mode (Diego, Nov 22, 2026: "All three, as proposed" — after Pollen and Spore). The
// words (Solid · Adaptive · Inks · Video, Colour by, Mix, Sort by lightness, Ink / Paper), the mode seg fits its buttons,
// Mix only where two colours blend and it reaches the engine, Sort / ⌥→ reorder the ramp, a preset keeps its Mix.
// Run: node --experimental-websocket scripts/test-mote-colour-mode.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 180000 });
const ok = await P.goto('/mote/', 'window.Organica && Organica.reorder && typeof rmxChips !== "undefined" && rmxChips');
if (!ok) { console.log('  FAIL /mote/ not ready'); await P.close(1); }
const R = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms)), q = id => document.getElementById(id), out = {};
  const vis = id => !q(id).closest('[hidden]'), mixOn = () => (q('seg-mix').querySelector('.active') || {}).dataset || {};
  out.seg = [...q('seg-color').querySelectorAll('.seg-btn')].map(b => b.textContent.trim()).join(' · ');
  out.fit = [...q('seg-color').querySelectorAll('.seg-btn')].every(b => b.scrollWidth <= b.clientWidth + 1);
  out.by = q('sel-rmx-map').closest('.ctrl-row').querySelector('.ctrl-label').textContent.trim();
  out.byOpts = [...q('sel-rmx-map').options].map(o => o.textContent).join(' · ');
  out.mix = [...q('seg-mix').querySelectorAll('.seg-btn')].map(b => b.textContent.trim()).join(' · ');
  out.pair = [...document.querySelectorAll('.color-row .color-name')].map(e => e.textContent.trim()).join(' / ');
  setColor('solid'); out.solid = vis('row-mix');
  setColor('video'); out.video = vis('row-mix');
  setColor('adaptive'); out.adaptive = vis('row-mix');
  setColor('rmx'); await w(100); out.rmx = vis('row-mix');
  const sel = q('sel-rmx-map'); sel.value = 'posterize'; sel.dispatchEvent(new Event('change')); out.poster = vis('row-mix');
  sel.value = 'tone'; sel.dispatchEvent(new Event('change'));
  q('seg-mix').querySelector('[data-v="oklab"]').click(); out.space = rmxSpace + ' ' + mixOn().v;
  rmxColors = ['#f4efe4', '#1a2b3c', '#e8b030']; rmxChips.rebuild(); syncColourRows();
  out.sortOn = !q('btn-rmx-sort').disabled; q('btn-rmx-sort').click(); out.sorted = rmxColors.join(); out.sortOff = q('btn-rmx-sort').disabled;
  q('rmx-palette').querySelector('.rmx-color button, .rmx-color input').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  out.moved = rmxColors.join(); out.saveRows = q('rmx-block').querySelectorAll('[data-pal-save]').length;
  return out;`);
let failed = 0;
const check = (label, okk, detail) => { if (!okk) failed++; console.log((okk ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
check('modes Solid · Adaptive · Inks · Video', R.seg === 'Solid · Adaptive · Inks · Video', R.seg);
check('every mode button shows its whole word', R.fit, String(R.fit));
check('Colour by Tone · Posterize · Random · Tone + random', R.by === 'Colour by' && R.byOpts === 'Tone · Posterize · Random · Tone + random', R.by + ': ' + R.byOpts);
check('Mix sRGB · OKLab', R.mix === 'sRGB · OKLab', R.mix);
check('the pair is Ink / Paper', R.pair === 'Ink / Paper', R.pair);
check('Mix: hidden in Solid, Video, Posterize; shown in Adaptive, Inks › Tone', !R.solid && !R.video && !R.poster && R.adaptive && R.rmx, [R.solid, R.video, R.poster, R.adaptive, R.rmx].join());
check('Mix reaches the engine', R.space === 'oklab oklab', R.space);
check('Sort by lightness only when it would move a colour', R.sortOn && R.sortOff, R.sortOn + ' / ' + R.sortOff);
check('Sort by lightness: dark → bright', R.sorted === '#1a2b3c,#e8b030,#f4efe4', R.sorted);
check('⌥→ moves a chip along the ramp', R.moved === '#e8b030,#1a2b3c,#f4efe4', R.moved);
check('one Save as palette… row', R.saveRows === 1, R.saveRows + ' rows');
if (P.errors.length) { failed++; console.log('  FAIL page errors — ' + P.errors.join(' | ')); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
