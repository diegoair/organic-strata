// Headless check for the home hero (Nov 24, 2026): the carousel of FVS loops (shared/hero-carousel.js over shared/hero.js).
// (1) every loop mounts on the work page /design-system/_hero-loops.html?hero=a…h, draws, steps without an error, loads
// its own model and nothing from explorations/; (2) the home's carousel: Organica.hero.HOME (Nov 26, 2026: H A G E F),
// five bars in that order, Next moves on, a loop that ends hands the stage to the next one;
// (3) the loader's rotation (the owner's hub uses it) advances one loop per mount and stays inside ROTATION;
// (4) a model that cannot load calls the fallback; (5) reduced motion gives one still frame; (6) a portrait stage
// takes G's 4:5 model. The hub page itself (/hub/, owner only) cannot be opened headless: its stipple-word fallback is
// checked by hand. Run: node --experimental-websocket scripts/test-home-hero.mjs — exits 1 on a failure.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 240000 });
let failed = 0;
const check = (label, ok, detail) => { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
const READY = 'window.Organica && Organica.hero && Organica.hero.current && Organica.hero.current.loop()';
const SEEN = `performance.getEntriesByType('resource').map(r => new URL(r.name).pathname)`;
const MODEL = { a: null, b: 'windows-model', c: 'score-model', d: 'morph-model', e: 'dots-model', f: 'weave-tiles', g: 'print-model', h: 'stacks-model' };
const KEYS = Object.keys(MODEL);

const WORK = '/design-system/_hero-loops.html';
for (const k of KEYS) {
  await P.goto(WORK + '?hero=' + k, READY);
  const r = await P.ev(`
    const c = Organica.hero.current, host = document.getElementById('heroStage'), L = c.loop();
    let err = ''; try { L.advance(2000); } catch (e) { err = String(e); }
    const seen = ${SEEN};
    return { key: c.key, nodes: host.querySelectorAll('svg *').length, label: !!host.querySelector('.hloop__word'), err,
      count: document.getElementById('heroCount').textContent,
      models: seen.filter(p => p.startsWith('/shared/hero/')).map(p => p.slice(13, -5)), expl: seen.filter(p => p.includes('explorations')).length, swarm: seen.includes('/shared/swarm.js') };`);
  const n = KEYS.indexOf(k) + 1;
  check(k + ' mounts and draws', r.key === k && r.nodes > 20 && !r.label && !r.err && r.count === '0' + n + ' / 08', r.nodes + ' nodes, ' + r.count + (r.err ? ', ' + r.err : ''));
  check(k + ' loads its model, nothing from explorations/', (!MODEL[k] || r.models.includes(MODEL[k])) && r.models.length <= 2 && !r.expl && !r.swarm, 'models [' + r.models.join(', ') + ']');
}

// the home's carousel: H A G E F
const HOME = ['h', 'a', 'g', 'e', 'f'];
await P.goto('/', READY);
const car = await P.ev(`
  const wait = async k => { for (let i = 0; i < 80 && !(Organica.hero.current.key === k && Organica.hero.current.loop()); i++) await new Promise(r => setTimeout(r, 100)); };
  const bars = [...document.querySelectorAll('#heroBars button')].map(b => b.getAttribute('aria-label'));
  const first = Organica.hero.current.key, home = Organica.hero.HOME.join('');
  document.getElementById('heroNext').click(); await wait('a');
  const next = Organica.hero.current.key, count = document.getElementById('heroCount').textContent;
  // play A to its end by hand: the stage must pass to G
  const L = Organica.hero.current.loop();
  for (let t = 0; t < 60000 && Organica.hero.current.key === 'a'; t += 50) { L.advance(50); if (t % 5000 === 0) await new Promise(r => setTimeout(r, 0)); }
  await wait('g');
  const ended = Organica.hero.current.key, done = document.querySelectorAll('#heroBars button.is-done').length;
  document.getElementById('heroPrev').click(); await wait('a');
  const after = Organica.hero.current.key;
  document.getElementById('heroPrev').click(); await wait('h');
  document.getElementById('heroPrev').click(); await wait('f');
  return { bars, first, home, next, count, ended, done, after, wrap: Organica.hero.current.key, svgs: document.querySelectorAll('#heroStage svg').length, demo: document.querySelectorAll('#demoStage g.cell').length, stray: document.querySelectorAll('#demoStage svg').length };`);
check('the home shows H A G E F, in that order', car.home === HOME.join('') && car.bars.length === 5 && car.first === 'h' && /^Composition 1: Stacks$/.test(car.bars[0]) && /^Composition 5: Weave$/.test(car.bars[4]), car.home + ' · ' + car.bars.join(' | '));
check('Next moves on', car.next === 'a' && car.count === '02 / 05', car.next + ', ' + car.count);
check('a loop that ends hands the stage to the next; Previous goes back and wraps', car.ended === 'g' && car.done === 2 && car.after === 'a' && car.wrap === 'f' && car.svgs === 1 && car.demo === 160 && car.stray === 1, 'ended → ' + car.ended + ', done ' + car.done + ', back ' + car.after + ', wrap ' + car.wrap + '; hero svgs ' + car.svgs + ', demo cells ' + car.demo);
// Nov 26, 2026: every home loop moves at once (its first slide plays its entrance) and a cycle is short
for (const k of HOME) {
  await P.goto('/?hero=' + k, READY);
  const r = await P.ev(`
    const st = document.getElementById('heroStage'), a = st.innerHTML;
    for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    const K = Organica.heroSheets.KINDS[Organica.hero.LOOPS['${k}'].kind];
    return { moved: st.innerHTML !== a, cycle: K.slides.reduce((t, s) => t + s.ms, 0) };`);
  check(k + ' moves at once on the home, a cycle ≤ 30 s', r.moved && r.cycle <= 30000, (r.moved ? 'moved' : 'still') + ', cycle ' + r.cycle + ' ms');
}
await P.goto('/?hero=b', READY);
check('a loop off the home is not shown there (?hero=b starts on H)', await P.ev(`return Organica.hero.current.key;`) === 'h');

// the loader's rotation and fallback, on a stage of their own
await P.goto('/', READY);   // no ?hero= in the address: the rotation decides
const rot = await P.ev(`
  localStorage.removeItem('organica.hub.hero');
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:500px;visibility:hidden'; document.body.appendChild(host);
  const seq = [];
  for (let i = 0; i < 3; i++) { const h = Organica.hero.mount(host, {}); seq.push(h.key); h.stop(); host.textContent = ''; }
  return { seq, rot: Organica.hero.ROTATION };`);
const step = (a, b) => rot.rot[(rot.rot.indexOf(a) + 1) % rot.rot.length] === b;
check('the rotation advances one loop per mount', rot.seq.every(k => rot.rot.includes(k)) && step(rot.seq[0], rot.seq[1]) && step(rot.seq[1], rot.seq[2]), rot.seq.join(' → ') + ' in [' + rot.rot.join(' ') + ']');
await P.cdp('Network.enable');
await P.cdp('Network.setBlockedURLs', { urls: ['*stacks-model.json*'] });
await P.goto('/?hero=a', READY);
const fb = await P.ev(`
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:500px;visibility:hidden'; document.body.appendChild(host);
  return await new Promise(res => { Organica.hero.mount(host, { key: 'h', fallback: () => res('fallback') }); setTimeout(() => res('nothing'), 6000); });`);
check('a model that cannot load calls the fallback', fb === 'fallback', fb);
await P.cdp('Network.setBlockedURLs', { urls: [] });

// reduced motion: one still frame
await P.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
for (const k of ['d', 'c']) {
  await P.goto(WORK + '?hero=' + k, READY);
  const still = await P.ev(`
    const svg = document.querySelector('#heroStage svg'), a = svg.outerHTML;
    await new Promise(r => setTimeout(r, 900));
    return a === svg.outerHTML && Organica.hero.current.key === '${k}';`);
  check('reduced motion: ' + k + ' is one still frame', still);
}
await P.cdp('Emulation.setEmulatedMedia', { features: [] });

// a portrait stage: G takes the model made for it
await P.cdp('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false });
await P.goto('/?hero=g', READY);
const pm = await P.ev(`return ${SEEN}.filter(p => p.startsWith('/shared/hero/print')).map(p => p.slice(13, -5));`);
check('portrait: G loads its 4:5 model', pm.length === 1 && pm[0] === 'print-model-4x5', pm.join(', '));

const errs = P.errors.filter(e => !/insights|stacks-model|ERR_BLOCKED|Failed to load resource/.test(e));
if (errs.length) { failed++; console.log('  FAIL page errors — ' + errs.join(' | ')); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
