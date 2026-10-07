#!/usr/bin/env node
// FVS QA — boot health, every view, export parity, resources, dark mode. Usage: scripts/test-fvs-qa.sh [--record]
// --record writes fvs/_qa-baseline.json from the current run (export hashes + the resources FVS loaded).
//
// Same no-dependency pattern as scripts/regression.mjs: serves the repo on a throwaway port, drives headless
// Chrome over the DevTools protocol, opens /fvs/ with a clean profile. Local hosts are not auth-gated.
// It works on both shapes of the page — the classic scripts (FVS names are globals) and the ES-module build
// (names on window.__fvs, Figure loaded on demand): `F(name)` resolves either way.
// Checks: (1) no uncaught exception, console error or same-origin HTTP error from load to ready; (2) each tier,
// the Library rail, the Library view, the Suggest dock, New Figure… (the Built-in Figures) and the Export popover open with no new
// error and a non-empty view; (3) the SVG of every tier for fixed Figure recipes matches the baseline hash;
// (4) every /fvs/ script is 200 + javascript, and (when the page is split) the Figure code is not fetched before
// the Figure tab opens; (5) the same views in dark mode raise no error.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'fvs', '_qa-baseline.json');
const RECORD = process.argv.includes('--record');
const SHOTS = (i => i > 0 ? process.argv[i + 1] : '')(process.argv.indexOf('--shots'));   // --shots DIR: a PNG per tier
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/test-fvs-qa.mjs'); process.exit(2); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const ORIGIN = `http://localhost:${port}`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'organica-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--window-size=1440,900',
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const done = code => { try { chrome.kill('SIGKILL'); } catch {} server.close(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {} process.exit(code); };
setTimeout(() => { console.log('FVS QA: ERROR — timed out after 5 min'); done(1); }, 300000);

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  chrome.on('exit', () => reject(new Error('Chrome exited early')));
});
const dbgPort = new URL(wsUrl).port;
const pages = await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let nid = 0; const pend = new Map();
const errors = [];                       // { phase, text }
const responses = [];                    // { url, status, type }
let phase = 'boot';
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push({ phase, text: 'exception: ' + (d.exception?.description || d.text || '').split('\n')[0] });
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push({ phase, text: 'console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200) });
  } else if (m.method === 'Network.responseReceived') {
    const r = m.params.response;
    responses.push({ url: r.url, status: r.status, type: r.mimeType });
    if (r.url.startsWith(ORIGIN) && r.status >= 400 && !r.url.endsWith('/favicon.ico')) errors.push({ phase, text: `HTTP ${r.status} ${r.url.slice(ORIGIN.length)}` });
  }
});
const cdp = (method, params = {}) => new Promise(r => { const i = ++nid; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The page-side prelude: F(name) = the FVS binding, from window.__fvs (module build) or the global scope (classic).
const PRELUDE = `const F = n => (window.__fvs && n in window.__fvs) ? window.__fvs[n] : (0, eval)(n);
  const H = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const norm = s => s.replace(/"exportedAt":"[^"]*"/g, '"exportedAt":""').replace(/"ruleSource":"[^"]*"/g, '"ruleSource":""').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const idle = (ms) => new Promise(r => setTimeout(r, ms));`;
async function ev(body) {
  const expr = `(async () => { ${PRELUDE}\n${body} })()`;
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]);
  return r.result?.result?.value;
}

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const newErrors = (from) => errors.slice(from).map(e => `[${e.phase}] ${e.text}`);

await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
await cdp('Page.navigate', { url: `${ORIGIN}/fvs/` });

// 1 — boot: ready = window.__fvs.ready (module build) or setTier defined + the page settled (classic).
let ready = false;
for (let i = 0; i < 120 && !ready; i++) {
  await sleep(250);
  const r = await cdp('Runtime.evaluate', { expression: `document.readyState === 'complete' && (window.__fvs ? !!window.__fvs.isReady : typeof setTier === 'function')`, returnByValue: true });
  ready = !!r.result?.result?.value;
}
check(ready, 'boot: FVS never became ready');
await sleep(1500);
const bootErrs = newErrors(0);
check(!bootErrs.length, 'boot errors: ' + bootErrs.join(' | '));
const splitPage = await ev(`return !!document.querySelector('script[src^="/fvs/js/"]');`);
const figureEarly = await ev(`return performance.getEntriesByType('resource').some(e => /\\/fvs\\/js\\/.*figure/.test(e.name));`);
const bootKB = await ev(`return Math.round(performance.getEntriesByType('resource').concat(performance.getEntriesByType('navigation')).filter(e => e.name.includes('/fvs/')).reduce((a, e) => a + (e.decodedBodySize || 0), 0) / 1024);`);

// 1b — the real way into Figure, before anything preloads it: click its tab, let it arrive, check it drew
phase = 'figure-tab-click';
{ const e0 = errors.length;
  const ok = await ev(`document.querySelector('#tier-tabs [data-tier="figure"]').click();
    for (let i = 0; i < 40; i++) { await idle(100); const v = document.querySelector('.tier-view[data-tier="figure"]');
      if (v && v.classList.contains('active') && document.querySelectorAll('#fg-graph .nc-node').length > 0) return true; }   // the Figure step is a node graph (docs/FVS.md §12)
    return false;`);
  check(ok, 'Figure tab click: the Figure view did not draw');
  const ne = newErrors(e0); check(!ne.length, 'Figure tab click: ' + ne.join(' | '));
  await ev(`document.querySelector('#tier-tabs [data-tier="element"]').click(); await idle(200); return 1;`);
}

// 2 — every view
async function visitViews(tag) {
  const out = {};
  for (const t of ['element', 'component', 'symbol', 'figure']) {
    phase = `${tag}:tier:${t}`; const e0 = errors.length;
    if (t === 'figure') await ev(`if (window.__fvs && __fvs.loadFigureTier) await __fvs.loadFigureTier(); return 1;`);
    out[t] = await ev(`F('setTier')('${t}'); await idle(400);
      const v = document.querySelector('.tier-view[data-tier="${t}"]');
      return !!v && v.classList.contains('active') && v.getBoundingClientRect().height > 0 && v.querySelector('*') !== null;`);
    check(out[t], `${tag}: tier ${t} view empty or not active`);
    if (SHOTS) { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, `${tag}-${t}.png`), Buffer.from(r.result.data, 'base64')); }
    const ne = newErrors(e0); check(!ne.length, `${tag}: tier ${t}: ` + ne.join(' | '));
  }
  const steps = [
    ['rail', `F('setTier')('symbol'); F('setRailOpen')(true); await idle(300); const ok = !document.getElementById('fvs-rail-panel').hidden || F('railIsOpen')(); F('setRailOpen')(false); return ok;`],
    ['libview', `F('openLibview')(); await idle(400); const v = document.getElementById('fvs-libview'); const ok = !v.hidden && v.querySelectorAll('*').length > 0; F('closeLibview')(); return ok;`],
    ['suggest-dock', `F('setTier')('symbol'); F('setSugDockOpen')(true); await idle(300); const ok = F('sugDockIsOpen')(); F('setSugDockOpen')(false); return ok;`],
    ['figure-new', `F('setTier')('figure'); await idle(300); document.getElementById('btn-fg-new').click(); await idle(800); const m = document.querySelector('.fg-new'); const ok = !!m && m.querySelectorAll('.fg-new__thumb svg').length > 0; if (m) m.querySelector('[data-act="close"]').click(); return ok;`],
    // the Library rail must be reachable (not covered by the Figure node bar) on Element / Component / Symbol
    ['rail-reachable', `F('setTier')('figure'); await idle(300); let ok = true; for (const t of ['element', 'component', 'symbol']) { F('setTier')(t); await idle(150); const nb = document.getElementById('fg-nodebar-dock'); const b = document.getElementById('btn-rail'); const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); ok = ok && getComputedStyle(nb).display === 'none' && r.width > 0 && !!hit && b.contains(hit); } return ok;`],
    ['export-popover', `F('setTier')('component'); document.getElementById('btn-export').click(); await idle(300); const p = document.getElementById('export-popover'); const ok = !!p && p.getBoundingClientRect().height > 0; document.body.click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return ok;`],
  ];
  for (const [name, body] of steps) {
    phase = `${tag}:${name}`; const e0 = errors.length;
    let ok = false;
    try { ok = await ev(body); } catch (err) { ok = false; errors.push({ phase, text: String(err.message) }); }
    out[name] = ok; check(ok, `${tag}: ${name} did not open`);
    const ne = newErrors(e0); check(!ne.length, `${tag}: ${name}: ` + ne.join(' | '));
  }
  return out;
}
const views = await visitViews('light');
const figureAfter = await ev(`return performance.getEntriesByType('resource').some(e => /\\/fvs\\/js\\/.*figure/.test(e.name));`);

// 3 — export parity: fixed Figure recipes → the SVG of every level, hashed.
phase = 'parity';
const RECIPES = ['Triangle · Sierpinski · repeated'];
const hashes = await ev(`
  const cat = F('figureCatalog')(); const names = Object.keys(cat);
  const pick = [...${JSON.stringify(RECIPES)}.filter(n => cat[n]), names[0], names[Math.floor(names.length / 2)], names[names.length - 1]];
  const out = {};
  F('setTier')('figure');
  for (const n of pick) {
    F('runFigureRecipe')(JSON.parse(JSON.stringify(cat[n])), { keepTier: true }); await idle(50);
    for (const lvl of ['element', 'component', 'symbol']) { const s = F('figureSVGOf')(lvl); out[n + ' / ' + lvl] = s ? H(norm(s)) : ''; }
  }
  for (const t of ['element', 'component', 'symbol']) { F('setTier')(t); await idle(50); const s = F('tierSVG')(); out['tier / ' + t] = s ? H(norm(s)) : ''; }
  return out;`);

// 4 — resources
const fvsScripts = responses.filter(r => r.url.startsWith(ORIGIN + '/fvs/') && /\.js(\?|$)/.test(r.url));
fvsScripts.forEach(r => check(r.status === 200 && /javascript/.test(r.type), `resource ${r.url.slice(ORIGIN.length)}: ${r.status} ${r.type}`));
let lazyNote = '';
const lazyFigure = splitPage && fvsScripts.some(r => /figure/.test(r.url));
if (lazyFigure && responses.some(r => /\/fvs\/js\/.*figure.*\.js/.test(r.url))) {
  // only meaningful once Figure is lazy: the module build declares it with __fvs.figureLazy
  const lazy = await ev(`return !!(window.__fvs && __fvs.figureLazy);`);
  if (lazy) { check(!figureEarly, 'Figure code was fetched before the Figure tab opened'); check(figureAfter, 'Figure code never loaded'); lazyNote = ` · Figure lazy: ${figureEarly ? 'LOADED AT BOOT' : 'not at boot'}, ${figureAfter ? 'loaded on the tab' : 'NEVER LOADED'} · ${bootKB} KB of /fvs/ at boot`; }
}

// 5 — dark mode
await ev(`document.documentElement.setAttribute('data-theme', 'dark'); await idle(200); return 1;`);
const dark = await visitViews('dark');
await ev(`document.documentElement.removeAttribute('data-theme'); return 1;`);

const resources = [...new Set(responses.filter(r => r.url.startsWith(ORIGIN)).map(r => r.url.slice(ORIGIN.length).replace(/\?.*$/, '')))].sort();
const bytes = await ev(`return performance.getEntriesByType('resource').concat(performance.getEntriesByType('navigation')).filter(e => e.name.includes('/fvs/')).reduce((a, e) => a + (e.decodedBodySize || 0), 0);`);

if (RECORD) {
  fs.writeFileSync(BASELINE, JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), hashes, resources }, null, 2) + '\n');
  console.log(`Baseline recorded → fvs/_qa-baseline.json (${Object.keys(hashes).length} hashes).`);
} else {
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const keys = Object.keys(base.hashes);
  const diff = keys.filter(k => hashes[k] !== base.hashes[k]);
  check(!diff.length, `export parity: ${diff.length}/${keys.length} differ: ${diff.join(', ')}`);
  check(Object.keys(hashes).length === keys.length, `export parity: ${Object.keys(hashes).length} hashes vs ${keys.length} in the baseline`);
}

console.log(`FVS QA: ${fails.length ? 'FAIL' : 'PASS'} — ${Object.keys(hashes).length} export hashes, views light ${Object.values(views).filter(Boolean).length}/${Object.keys(views).length}, dark ${Object.values(dark).filter(Boolean).length}/${Object.keys(dark).length}, ${errors.length} errors, ${fvsScripts.length} /fvs/ scripts, ${Math.round(bytes / 1024)} KB of /fvs/ decoded${splitPage ? ' (split page)' : ''}${lazyNote}`);
fails.forEach(f => console.log('  ✗ ' + f));
done(fails.length ? 1 : 0);
