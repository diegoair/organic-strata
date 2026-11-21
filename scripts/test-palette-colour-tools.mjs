import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 6 * 60 * 1000 });
const PAL = { n: 4, colors: ['#7a3020', '#1a2b3c', '#e8b030', '#f4efe4'], parts: ['main', 'sub', 'accent', 'background'],
  mapping: { mode: 'rmx', submode: 'posterize', order: [1, 0, 2, 3] } };
const PAL_AD = { n: 4, colors: PAL.colors, parts: PAL.parts, mapping: { mode: 'adaptive', submode: 'tone', order: [1, 0, 2, 3], pair: [1, 3], space: 'oklab' } };
const RAMP = '#1a2b3c,#7a3020,#e8b030,#f4efe4';
const HELP = `const w = ms => new Promise(r => setTimeout(r, ms)), q = id => document.getElementById(id);
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  Organica.store('tunesutra').write({ P: ${JSON.stringify(PAL)}, PA: ${JSON.stringify(PAL_AD)} });
  async function take(btn, name) { btn.click(); await w(300); const m = [...document.querySelectorAll('.pal-menu')].find(x => !x.hidden);
    const it = m && [...m.querySelectorAll('.preset-item')].find(b => b.textContent.trim() === name); if (!it) return 'no item: ' + (m ? m.innerText.slice(0, 200) : 'no menu'); it.click(); await w(400); return ''; }
  const stripBtn = host => [...q(host).querySelectorAll('.pal-btn, .rmx-add')].pop();
  const rowBtn = id => q('hex-' + id).parentNode.querySelector('.pal-btn');
  const hex = id => q('hex-' + id).value.toLowerCase();`;
async function run(path, ready, body) {
  const ok = await P.goto(path, ready);
  if (!ok) { console.log(path, '✗ not ready'); return; }
  P.errors.length = 0;
  try { const rows = await P.ev(HELP + body + '; return rows;'); console.log(path + '\n  ' + rows.join('\n  ')); }
  catch (e) { console.log(path, '✗', e.message); }
  if (P.errors.length) console.log('  ✗ errors:', P.errors.join(' | ')); else console.log('  ✓ 0 console errors');
}
await run('/pollen/', 'window.Organica && Organica.paletteKit', `
  setColorMode('rmx'); await w(200);
  let e = await take(stripBtn('rmx-palette'), 'P'); check('menu', !e, e);
  check('strip ramp', rmxColors.join() === '${RAMP}', rmxColors.join());
  check('chips', [...q('rmx-palette').querySelectorAll('.rmx-color')].length === 4, 0);
  check('mode rmx + posterize', colorMode === 'rmx' && rmxColorMap === 'posterize' && q('sel-rmx-map').value === 'posterize', colorMode + rmxColorMap);
  check('space stored', rmxSpace === 'oklab' && pointParams().space === 'oklab', rmxSpace);
  e = await take(stripBtn('rmx-palette'), 'PA'); check('menu PA', !e, e);
  check('adaptive applied', colorMode === 'adaptive' && hex('ink') === '#1a2b3c' && hex('bg') === '#f4efe4', colorMode + hex('ink') + hex('bg'));
  const m = Organica.paletteKit && null;
  swatches.ink.set('#000000'); swatches.bg.set('#ffffff');
  e = await take(rowBtn('ink'), 'P'); check('row menu', !e, e);
  check('roles ink main / bg background', hex('ink') === '#7a3020' && hex('bg') === '#f4efe4', hex('ink') + hex('bg'));
  check('roles fill the strip', rmxColors.join() === '${RAMP}', rmxColors.join());
  setState({ colorMode: 'solid' }); check('preset without space resets', rmxSpace === null, rmxSpace);`);
await run('/mote/', 'window.Organica && Organica.paletteKit && document.querySelector("#rmx-palette .rmx-color")', `
  setColor('rmx'); await w(200);
  let e = await take(stripBtn('rmx-palette'), 'P'); check('menu', !e, e);
  check('strip ramp', rmxColors.join() === '${RAMP}', rmxColors.join());
  check('mode + map', colorMode === 'rmx' && q('sel-rmx-map').value === 'posterize' && pointParams().space === 'oklab', colorMode + q('sel-rmx-map').value);
  e = await take(stripBtn('rmx-palette'), 'PA');
  check('adaptive', colorMode === 'adaptive' && hex('ink') === '#1a2b3c' && hex('paper') === '#f4efe4', colorMode + hex('ink') + hex('paper'));
  e = await take(rowBtn('paper'), 'P'); check('row menu', !e, e);
  check('roles', hex('ink') === '#7a3020' && hex('paper') === '#f4efe4' && rmxColors.join() === '${RAMP}', hex('ink') + hex('paper') + rmxColors.join());`);
await run('/camo-turing/', 'window.Organica && Organica.paletteKit && document.querySelector("#rmx-palette .rmx-color")', `
  setColorMode('rmx'); await w(200);
  let e = await take(stripBtn('rmx-palette'), 'P'); check('menu', !e, e);
  const T = window.__camoTest || window.__camo || {};
  check('mode rmx + posterize (seg + select)', q('seg-colormode').querySelector('.active').dataset.v === 'rmx' && q('sel-rmx-map').value === 'posterize', q('sel-rmx-map').value);
  check('chips ramp', [...q('rmx-palette').querySelectorAll('.rmx-color')].length === 4, 0);
  e = await take(stripBtn('rmx-palette'), 'PA');
  check('adaptive', q('seg-colormode').querySelector('.active').dataset.v === 'adaptive' && hex('ink') === '#1a2b3c' && hex('paper') === '#f4efe4', hex('ink') + hex('paper'));
  e = await take(rowBtn('ink'), 'P'); check('row', !e, e);
  check('roles', hex('ink') === '#7a3020' && hex('paper') === '#f4efe4', hex('ink') + hex('paper'));`);
await run('/membrane/', 'window.Organica && Organica.paletteKit && document.querySelector("#rmx-palette .rmx-color")', `
  let e = await take(stripBtn('rmx-palette'), 'P'); check('menu', !e, e);
  check('colorsrc rmx + posterize', q('sel-colorsrc').value === 'rmx' && !q('rmx-color-block').hidden && q('sel-rmx-map').value === 'posterize', q('sel-colorsrc').value + q('sel-rmx-map').value);
  const chips = [...q('rmx-palette').querySelectorAll('.rmx-color')].length; check('4 chips', chips === 4, chips);
  e = await take(rowBtn('bg'), 'P'); check('row', !e, e);
  check('roles', hex('ink') === '#7a3020' && hex('bg') === '#f4efe4', hex('ink') + hex('bg'));
  await w(500);`);
await run('/vortex/', 'window.Organica && Organica.paletteKit && document.querySelector("#rmx-palette .rmx-color")', `
  let e = await take(stripBtn('rmx-palette'), 'P'); check('menu', !e, e);
  const cs = [...q('rmx-palette').querySelectorAll('.rmx-color')].length; check('4 chips', cs === 4, cs);
  e = await take(rowBtn('bg'), 'P'); check('row', !e, e);
  check('bg role', hex('bg') === '#f4efe4', hex('bg'));
  await w(500);`);
await run('/warping/', 'window.Organica && Organica.paletteKit', `
  let e = await take(rowBtn('paper'), 'P'); check('row', !e, e);
  check('roles', hex('ink') === '#7a3020' && hex('paper') === '#f4efe4', hex('ink') + hex('paper')); await w(500);`);
await run('/komorebi/', 'window.Organica && Organica.paletteKit', `
  let e = await take(rowBtn('sun'), 'P'); check('row', !e, e);
  const got = ['sun','sky','ground','shadow'].map(hex).join();
  check('roles sun accent · sky background · ground main · shadow darkest', got === '#e8b030,#f4efe4,#7a3020,#1a2b3c', got); await w(500);`);
P.close(0);
