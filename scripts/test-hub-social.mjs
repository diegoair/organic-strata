#!/usr/bin/env node
// The hub's Social (Nov 25, 2026 — docs/SOCIAL-EXPORT.md P3): the eight loops in the picker (the one on screen first), the
// file count (a still is PNG + SVG), the hint, the remembered ticks; Export makes one ZIP of the picked loop (PNG · SVG · MP4)
// while the loop on screen pauses and the controls lock; Cancel stops with no file. The hub is owner-only: the test answers
// Organica.auth.user() with the owner (the id is the page's own) before the page's scripts run; nothing else is stubbed.
// Usage: scripts/test-hub-social.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 6 * 60 * 1000 });
await P.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  // core.js assigns a fresh window.Organica: fit the auth accessor onto whatever object is assigned
  let O = window.Organica, real = null;
  const fit = o => { if (o && !Object.getOwnPropertyDescriptor(o, 'auth')) Object.defineProperty(o, 'auth', { configurable: true, set(v) { real = v; },
    get() { return real && Object.assign(Object.create(real), { user: () => Promise.resolve({ id: '997a1f53-23b2-40bb-8a4a-90b0aacb7921', user_metadata: {} }) }); } }); };
  Object.defineProperty(window, 'Organica', { configurable: true, get() { return O; }, set(v) { O = v; fit(O); } });
  fit(O);
})()` });
await P.goto('/hub/', 'window.__hubSocial && Organica.hero && Organica.hero.current');
const out = await P.ev(`const r = [], ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  const $ = id => document.getElementById(id), tick = (id, v) => { const e = $(id); e.checked = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
  ck('on the hub (owner gate passed)', location.pathname === '/hub/', location.pathname);
  const opts = [...$('soc-loop').options].map(o => o.textContent);
  ck('eight loops, the one on screen picked', opts.length === 8 && $('soc-loop').value === Organica.hero.current.key, [opts, $('soc-loop').value]);
  ck('12 files by default', $('btn-social').textContent === 'Export 12 files', $('btn-social').textContent);
  ['sz-4x5', 'sz-9x16', 'sz-16x9'].forEach(id => tick(id, false)); tick('soc-video', false);
  ck('a still is PNG + SVG', $('btn-social').textContent === 'Export 2 files', $('btn-social').textContent);
  ck('ticks remembered', JSON.parse(localStorage.getItem('organica.hub.social'))['sz-4x5'] === false);
  tick('soc-video', true); $('soc-loop').value = 'h'; $('soc-loop').dispatchEvent(new Event('change', { bubbles: true }));
  ck('hint: laid out per size, the loop’s length', /laid out for its shape; the video is one loop \\(\\d+ s\\)\\./.test($('social-hint').textContent), $('social-hint').textContent);
  // Export: watch the on-screen loop and the lock
  let got = null; const dl = Organica.download; Organica.download = (b, name) => { got = { b, name }; };
  const onScreen = Organica.hero.current.loop(); let pausedDuring = null; const pz = onScreen.pause; onScreen.pause = b => { if (b) pausedDuring = true; return pz(b); };
  const run = __hubSocial.run(); await new Promise(res => setTimeout(res, 200));
  ck('running: Cancel, controls locked, bar shown', $('btn-social').textContent === 'Cancel' && $('soc-loop').disabled && $('sz-1x1').disabled && !$('social-progress').hidden);
  await run;
  ck('on-screen loop paused for it', pausedDuring === true);
  ck('a ZIP named after the loop', got && got.b.type === 'application/zip' && /^organica-stacks.*\\.zip$/.test(got.name), got && got.name);
  const z = new Uint8Array(await got.b.arrayBuffer()), dv = new DataView(z.buffer), names = [];
  for (let p = 0; dv.getUint32(p, true) === 0x04034b50;) { const csz = dv.getUint32(p + 18, true), nl = dv.getUint16(p + 26, true), xl = dv.getUint16(p + 28, true); names.push(new TextDecoder().decode(z.subarray(p + 30, p + 30 + nl))); p += 30 + nl + xl + csz; }
  ck('ZIP: 1:1 PNG, SVG, MP4', JSON.stringify(names) === JSON.stringify(['organica-stacks-1x1.png', 'organica-stacks-1x1.svg', 'organica-stacks-1x1.mp4']), names);
  ck('after: unlocked, bar hidden', !$('soc-loop').disabled && $('social-progress').hidden && $('btn-social').textContent === 'Export 3 files', $('btn-social').textContent);
  got = null; const run2 = __hubSocial.run(); await new Promise(res => setTimeout(res, 300)); await __hubSocial.run(); await run2;
  ck('Cancel: no file, back to Export', got === null && $('btn-social').textContent === 'Export 3 files');
  Organica.download = dl; onScreen.pause = pz;
  return r.join('\\n');`);
// Overprint (G) on screen, exported at 9:16 only: on close the model for the hero's own aspect goes back in the shared slot
await P.goto('/hub/?hero=g', 'window.__hubSocial && Organica.hero && Organica.hero.current && Organica.hero.current.loop()');
const out2 = await P.ev(`const r = [], ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  const $ = id => document.getElementById(id), tick = (id, v) => { const e = $(id); e.checked = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
  ['sz-4x5', 'sz-1x1', 'sz-16x9'].forEach(id => tick(id, false)); tick('sz-9x16', true); tick('soc-video', false); tick('soc-stills', true);
  $('soc-loop').value = 'g';
  const host = $('hub-hero'), aspect = host.clientWidth / host.clientHeight, want = Organica.hero.LOOPS.g.model(aspect);
  const sets = []; const sm = Organica.heroSheets.setModel; Organica.heroSheets.setModel = (slot, j) => { sets.push(slot + ':' + (j && j.W) ); return sm(slot, j); };
  const urls = []; const f0 = window.fetch; window.fetch = (u, ...a) => { urls.push(String(u)); return f0(u, ...a); };
  const dl = Organica.download; Organica.download = () => {};
  await __hubSocial.run(); await new Promise(res => setTimeout(res, 600));
  Organica.download = dl; window.fetch = f0; Organica.heroSheets.setModel = sm;
  ck('G at 9:16 loads the 9:16 model', urls.some(u => u.endsWith('/shared/hero/print-model-9x16.json')), urls);
  const last = urls[urls.length - 1] || '';
  ck('close() puts back the model for the hero (' + want + ')', last.endsWith('/shared/hero/' + want + '.json') && sets.length >= 2, [urls.slice(-2), sets]);
  return r.join('\\n');`);
console.log(out + '\n' + out2);
const all = out + '\n' + out2;
const bad = all.split('\n').filter(l => l.startsWith('✗')).length + P.errors.length;
if (P.errors.length) console.log('page errors:', P.errors);
console.log(bad ? 'Hub social: FAIL — ' + bad : 'Hub social: PASS — ' + all.split('\n').filter(l => l.startsWith('✓')).length + ' checks');
await P.close();
process.exit(bad ? 1 : 0);
