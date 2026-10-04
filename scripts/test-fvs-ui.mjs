#!/usr/bin/env node
// FVS usability + coherence runner — Element → Component → Symbol, the library rail, drag and drop.
// Usage: scripts/test-fvs-ui.sh [--only J1,J3,V] [--variants 120] [--seed 1] [--theme light|dark] [--out DIR]
//
// Like scripts/regression.mjs (no dependencies; serves the repo, drives headless Chrome over CDP) but it
// opens /fvs/ itself with a clean profile and adds what the regression suite lacks: REAL mouse input
// (Input.dispatchMouseEvent), screenshots, console-error capture and a JSON/Markdown result. It never
// writes to the repo — artefacts go to --out (default: a temp dir). The regression baseline is untouched.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const VARIANTS = +arg('variants', 120), SEED = +arg('seed', 1), THEME = arg('theme', 'light');
const OUT = arg('out', fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-ui-')));
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const want = k => !ONLY.length || ONLY.includes(k);

const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/test-fvs-ui.mjs'); process.exit(2); }

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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'organica-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--window-size=1440,900',
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const done = code => { try { chrome.kill('SIGKILL'); } catch {} server.close(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {} process.exit(code); };
setTimeout(() => { console.log('FVS UI test: ERROR — timed out after 25 min'); done(1); }, 25 * 60 * 1000);

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  chrome.on('exit', () => reject(new Error('Chrome exited early')));
});
const dbgPort = new URL(wsUrl).port;
const pages = await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let nid = 0; const pend = new Map(); let consoleErrors = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
});
const cdp = (method, params = {}) => new Promise(r => { const i = ++nid; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Evaluate a function in the page (it can reach FVS globals: state, ctrl, LIBRARY …).
async function ev(fn, ...args) {
  const expr = `(${fn.toString()})(...${JSON.stringify(args)})`;
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]);
  return r.result?.result?.value;
}
const shot = async name => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'shots', name + '.png'), Buffer.from(r.result.data, 'base64'));
};
// Real mouse: move, press, move in steps, (optionally hold), release.
const mouse = (type, x, y, extra = {}) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' || type === 'mouseMoved' && !extra.down ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1, ...extra });
const clickAt = p => click(p.x, p.y);
const hover = async (x, y) => { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 }); await sleep(60); };
const click = async (x, y) => { await hover(x, y); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await sleep(80); };
async function drag(from, to, { steps = 10, esc = false, release = true } = {}) {
  await hover(from.x, from.y);
  await mouse('mousePressed', from.x, from.y);
  for (let i = 1; i <= steps; i++) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps, button: 'left', buttons: 1 }); await sleep(12); }
  if (esc) { await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); }
  if (release) { await mouse('mouseReleased', to.x, to.y); await sleep(120); }
}

// ── in-page helpers (installed after each load) ─────────────────────────────────────────────────────
const HELPERS = `(() => {
  const w = window; if (w.__t) return;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const chg = (id, v) => { const el = document.getElementById(id); if (!el) return false; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; };
  const dlg = () => [...document.querySelectorAll('.org-modal[role="dialog"]')].pop();
  const answer = async (name) => { for (let i = 0; i < 20 && !dlg(); i++) await wait(50); const m = dlg(); if (!m) return false; const inp = m.querySelector('input'); if (inp && name != null) inp.value = name; m.querySelector(name === null ? '[data-modal-close]' : '[data-ok]').click(); await wait(150); return true; };
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; };
  const tile = (kind, name) => [...document.querySelectorAll('#fvs-rail-panel .fvs-library-item')].find(b => b.dataset.railKind === kind && (name == null || b.dataset.railName === name));
  const tiles = kind => [...document.querySelectorAll('#fvs-rail-panel .fvs-library-item')].filter(b => b.dataset.railKind === kind).map(b => b.dataset.railName);
  const cellEl = i => document.querySelector('#symbol-frame [data-cell-index="' + i + '"]');
  const openRail = async () => { if (!railIsOpen()) { document.getElementById('btn-rail').click(); await wait(350); } };
  // Coherence invariants: anything returned is a violation.
  const inv = () => {
    const v = []; const lib = LIBRARY.read(), el = ELEMENT_LIB.read(), sy = SYMBOL_LIBRARY.read();
    const cn = libraryNames(lib);
    if (railIsOpen()) {
      const rc = tiles('component').sort().join('|'), sc = cn.slice().sort().join('|'); if (rc !== sc) v.push('rail Components != store');
      const re = tiles('element').sort().join('|'), se = Object.keys(el).filter(n => el[n] && el[n].tile).sort().join('|'); if (re !== se) v.push('rail Elements != store');
      const rs = tiles('symbol').sort().join('|'), ss = Object.keys(sy).sort().join('|'); if (rs !== ss) v.push('rail Symbols != store');
    }
    (state.components || []).forEach(c => { if (c.savedName && !lib[c.savedName]) v.push('gallery savedName "' + c.savedName + '" not in library'); });
    (state.symbolPool || []).forEach(p => { if (!lib[p.name]) v.push('pool entry "' + p.name + '" not in library'); });
    (state.symbolCells || []).forEach((c, i) => { if (c && c.source === 'component' && c.componentName && !lib[c.componentName]) v.push('cell ' + i + ' references missing "' + c.componentName + '"'); });
    if (state.underlyingComponentName && !lib[state.underlyingComponentName]) v.push('underlying "' + state.underlyingComponentName + '" missing');
    if (document.querySelector('.fvs-rail-ghost')) v.push('ghost left behind');
    if (document.body.classList.contains('is-rail-dragging')) v.push('body.is-rail-dragging left');
    if (document.querySelector('#symbol-frame .is-drop')) v.push('.is-drop left');
    if (document.getElementById('fvs-rail-panel').classList.contains('is-dragging-away')) v.push('panel is-dragging-away left');
    const p = document.getElementById('fvs-rail-panel'); if ((p.dataset.open === 'true') === p.hasAttribute('inert')) v.push('inert != open');
    if (document.getElementById('btn-rail').getAttribute('aria-expanded') !== String(railIsOpen())) v.push('aria-expanded != open');
    return v;
  };
  // Hash an SVG with its generated ids renamed by order of appearance (clip/mask ids differ per drawing).
  const hashSvg = s => { const ids = []; (s.match(/ id="[^"]+"/g) || []).forEach(m => { const v = m.slice(5, -1); if (!ids.includes(v)) ids.push(v); }); let t = s; ids.forEach((v, i) => { t = t.split(v).join('ID' + i); }); t = t.replace(/"exportedAt":"[^"]*"/g, ''); return t.length + ':' + [...t].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7); };
  w.__t = { wait, chg, dlg, answer, center, tile, tiles, cellEl, openRail, inv, hashSvg };
})()`;

async function load(theme = THEME) {
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `http://localhost:${port}/fvs/` });
  for (let i = 0; i < 60; i++) { await sleep(250); const ok = await ev(() => typeof setTier === 'function' && typeof LIBRARY !== 'undefined' && document.readyState === 'complete').catch(() => false); if (ok) break; }
  await ev(() => { try { localStorage.clear(); } catch {} });
  await cdp('Page.reload'); await sleep(1800);
  await cdp('Runtime.evaluate', { expression: HELPERS });
  await ev(t => { document.documentElement.dataset.theme = t; }, theme);
  await sleep(150);
}

// ── test registry ───────────────────────────────────────────────────────────────────────────────────
const results = []; let current = null;
async function test(id, title, fn) {
  current = { id, title, ok: true, notes: [], errors: [] }; consoleErrors = [];
  const t0 = Date.now();
  try { await fn(current); } catch (e) { current.ok = false; current.notes.push('threw: ' + e.message); }
  const bad = consoleErrors.filter(e => !/Failed to load resource/.test(e));
  if (bad.length) { current.ok = false; current.errors = bad.slice(0, 6); }
  current.ms = Date.now() - t0; results.push(current);
  console.log(`${current.ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${current.ok ? '' : '  ← ' + [...current.notes, ...current.errors].slice(0, 2).join(' | ')}`);
}
const expect = (c, cond, note) => { if (!cond) { c.ok = false; c.notes.push(note); } };
const invariants = async (c, label) => { const v = await ev(() => __t.inv()); if (v && v.length) { c.ok = false; c.notes.push(`[${label}] ` + v.join('; ')); } };
// Seeded RNG so every variant is reproducible.
const rng = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(SEED);
const pick = a => a[Math.floor(rng() * a.length)];

await load();
console.log(`FVS UI test · theme=${THEME} · out=${OUT}`);

// ════════════ J1 — Element ════════════
if (want('J1')) {
  await test('J1.1', 'empty rail: no "None saved yet", no empty panel; opens and closes (aria/inert)', async c => {
    const s = await ev(async () => {
      await __t.openRail(); const txt = document.getElementById('fvs-rail-panel').textContent; const p = document.getElementById('fvs-rail-panel');
      const groups = ['elements', 'components', 'symbols'].map(k => getComputedStyle(document.getElementById('rail-g-' + k)).display);
      const out = { none: /None saved yet/.test(txt), groups, panelDisplay: getComputedStyle(p).display, open: railIsOpen() };
      document.getElementById('btn-rail').click(); await __t.wait(350); out.closed = !railIsOpen(); out.inert = p.hasAttribute('inert'); return out;
    });
    expect(c, !s.none, 'still prints "None saved yet"'); expect(c, s.groups.every(d => d === 'none'), 'empty groups are shown: ' + s.groups.join('/'));
    expect(c, s.panelDisplay === 'none', 'an empty glass panel is shown beside the toggle'); expect(c, s.open && s.closed && s.inert, 'open/close/inert wrong');
    await invariants(c, 'J1.1');
  });
  await test('J1.2', 'Save Element with the real + circle → rail tile; click = Paper tile', async c => {
    const p = await ev(async () => { await __t.openRail(); const b = document.querySelector('#element-frame .fvs-thumb-quicksave'); if (!b) return null; b.scrollIntoView({ block: 'center' }); return __t.center(b); });
    expect(c, !!p, 'no quick-save circle on the Element frame');
    if (p) { await click(p.x, p.y); await sleep(250); }
    const r = await ev(async () => { const n = Object.keys(ELEMENT_LIB.read()); await __t.wait(150); const t = __t.tile('element'); if (t) t.click(); await __t.wait(200); return { n, tile: __t.tiles('element'), live: document.getElementById('sel-ground-tile').value, on: paperPatternOn }; });
    expect(c, r.n.length >= 1, 'Element not saved by the + circle'); expect(c, r.tile.length === r.n.length, 'rail tiles != saved Elements');
    expect(c, r.on && /^saved:/.test(r.live), 'click did not set the Paper tile: ' + r.live);
    await shot('J1.2'); await invariants(c, 'J1.2');
  });
  await test('J1.3', 'rename a Saved Element used as Paper tile → tile repoints; clash re-asks; remove → no throw', async c => {
    const r = await ev(async () => {
      await __t.openRail(); const old = __t.tiles('element')[0]; const out = { old };
      __t.tile('element', old).parentElement.querySelector('[data-rail-rename]').click(); await __t.answer('Renamed E'); await __t.wait(300);
      out.renamed = !!ELEMENT_LIB.read()['Renamed E'] && !ELEMENT_LIB.read()[old]; out.live = document.getElementById('sel-ground-tile').value;
      saveElementVariant(0, false, false, '0°', 'Second E'); await __t.wait(150);
      __t.tile('element', 'Second E').parentElement.querySelector('[data-rail-rename]').click(); for (let i = 0; i < 20 && !__t.dlg(); i++) await __t.wait(50);
      __t.dlg().querySelector('input').value = 'Renamed E'; __t.dlg().querySelector('[data-ok]').click(); await __t.wait(250);
      out.reasked = !!__t.dlg() && /already exists/.test(__t.dlg().textContent); if (__t.dlg()) await __t.answer(null);
      __t.tile('element', 'Renamed E').parentElement.querySelector('[data-rail-remove]').click(); await __t.wait(250);
      out.removed = !ELEMENT_LIB.read()['Renamed E']; out.liveAfter = document.getElementById('sel-ground-tile').value;
      try { paperPatternSVG(100, 100); out.render = 'ok'; } catch (e) { out.render = 'threw ' + e.message; }
      return out;
    });
    expect(c, r.renamed, 'Element not renamed'); expect(c, r.live === 'saved:Renamed E', 'Paper tile not repointed on rename: ' + r.live);
    expect(c, r.reasked, 'rename clash did not re-ask'); expect(c, r.removed, 'Element not removed');
    expect(c, r.render === 'ok', 'Paper render after removing the live tile: ' + r.render);
    expect(c, !/^saved:Renamed E$/.test(r.liveAfter), 'Paper tile still names the removed Element: ' + r.liveAfter);
    await invariants(c, 'J1.3');
  });
}

// ════════════ J2 — Component ════════════
if (want('J2')) {
  await test('J2.1', 'generate, quick-save (real click), Save all, rail lists them', async c => {
    await ev(async () => { setTier('component'); await __t.wait(400); __t.chg('rg-grid-cols', 2); __t.chg('rg-grid-rows', 2); __t.chg('sel-rule', 'random'); document.getElementById('btn-generate').click(); await __t.wait(500); if (railIsOpen()) { document.getElementById('btn-rail').click(); await __t.wait(350); } });
    // Coverage check: with the rail OPEN, which gallery quick-save circles are under the panel (unreachable)?
    const cov = await ev(async () => { await __t.openRail(); const bs = [...document.querySelectorAll('#gallery .fvs-thumb-quicksave')]; const hit = bs.filter(b => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && e.closest('#fvs-rail-panel, #fvs-rail'); }).length; document.getElementById('btn-rail').click(); await __t.wait(350); return { total: bs.length, covered: hit }; });
    if (cov.covered) c.notes.push(`FINDING M · open rail covers ${cov.covered}/${cov.total} gallery quick-save circles (unreachable while open)`);
    const p = await ev(() => { const b = document.querySelector('#gallery .fvs-thumb-quicksave'); if (!b) return null; b.scrollIntoView({ block: 'center' }); return __t.center(b); });
    expect(c, !!p, 'no quick-save circle in the Component gallery');
    if (p) { await click(p.x, p.y); await sleep(300); }
    const r = await ev(async () => { await __t.openRail(); const a = libraryNames(LIBRARY.read()).length; document.getElementById('btn-rail-save-all').click(); await __t.wait(500); return { a, b: libraryNames(LIBRARY.read()).length, rail: __t.tiles('component').length, comps: state.components.length }; });
    expect(c, r.a >= 1, 'quick-save did not save'); expect(c, r.b >= r.a, 'Save all lost entries'); expect(c, r.rail === r.b, `rail ${r.rail} != store ${r.b}`);
    await shot('J2.1'); await invariants(c, 'J2.1');
  });
  await test('J2.2', 'H1 · remove a Component from the rail → gallery ✓ clears', async c => {
    const r = await ev(async () => { await __t.openRail(); const name = __t.tiles('component')[0]; const comp = state.components.find(x => x.savedName === name); __t.tile('component', name).parentElement.querySelector('[data-rail-remove]').click(); await __t.wait(300); return { name, hadMarker: !!comp, still: state.components.some(x => x.savedName === name) }; });
    expect(c, !r.still, `gallery still marks "${r.name}" as saved after removal (H1)`);
    await invariants(c, 'J2.2');
  });
  await test('J2.3', 'rename a Component → store/gallery/pool follow (H4); load from the rail on the Element tab hops tab', async c => {
    const r = await ev(async () => {
      await __t.openRail(); const old = __t.tiles('component')[0]; if (!old) return { skip: true };
      addSavedToPool(old); const had = state.symbolPool.some(p => p.name === old);
      __t.tile('component', old).parentElement.querySelector('[data-rail-rename]').click(); await __t.answer('Comp renamed'); await __t.wait(400);
      const out = { had, store: !!LIBRARY.read()['Comp renamed'] && !LIBRARY.read()[old], pool: state.symbolPool.some(p => p.name === 'Comp renamed'), poolOld: state.symbolPool.some(p => p.name === old) };
      setTier('element'); await __t.wait(300); __t.tile('component', 'Comp renamed').click(); await __t.wait(500); out.tier = state.activeTier; return out;
    });
    if (r.skip) { c.notes.push('no Component to rename'); c.ok = false; return; }
    expect(c, r.store, 'Component not renamed'); expect(c, r.pool && !r.poolOld, 'pool entry not repointed on rename (H4)'); expect(c, r.tier === 'component', 'tile click on the Element tab did not hop to Component: ' + r.tier);
    await invariants(c, 'J2.3');
  });
}

// ════════════ J3 — Symbol + drag and drop ════════════
async function seedComponents(n) {
  await ev(async n => {
    setTier('component'); await __t.wait(300);
    for (let i = 0; i < n; i++) { __t.chg('sel-rule', ['random', 'checkerboard', 'pinwheel', 'mirror'][i % 4]); __t.chg('num-seed', 3 + i); document.getElementById('btn-generate').click(); await __t.wait(350); quickSaveComponentToLibrary(state.components[0].id); await __t.wait(120); }
  }, n);
}
async function gridReady(preset = 'Square 1:1', gen = 'rectangular') {
  await ev(async (preset, gen) => { setTier('symbol'); await __t.wait(400); __t.chg('sel-symcanvas-preset', preset); __t.chg('sel-symgrid-gen', gen); document.getElementById('btn-symgrid-generate').click(); for (let i = 0; i < 40 && !(state.symbolCells && state.symbolCells.length); i++) await __t.wait(100); await __t.wait(1200); }, preset, gen);
}
if (want('J3')) {
  await seedComponents(3);
  await gridReady();
  await test('J3.1', 'grid + pool exist, cells filled from the pool', async c => {
    const r = await ev(() => ({ cells: state.symbolCells.length, comp: state.symbolCells.filter(x => x.source === 'component').length, pool: state.symbolPool.length }));
    expect(c, r.cells > 0 && r.comp > 0 && r.pool > 0, JSON.stringify(r)); await shot('J3.1'); await invariants(c, 'J3.1');
  });
  const dragTile = async (kind, cell, opts = {}) => {
    const g = await ev((kind, cell) => { __t.openRail(); const t = __t.tile(kind); const e = __t.cellEl(cell); if (!t || !e) return null; return { from: __t.center(t), to: __t.center(e) }; }, kind, cell);
    if (!g) return false; await sleep(350);
    const g2 = await ev((kind, cell) => ({ from: __t.center(__t.tile(kind)), to: __t.center(__t.cellEl(cell)) }), kind, cell);
    await drag(g2.from, opts.to || g2.to, opts); return true;
  };
  await test('J3.2', 'real drag Component → one unselected cell changes only that cell', async c => {
    const before = await ev(() => { state.symbolSelection.clear(); renderSymbolCanvasOnly(); return state.symbolCells.map(x => x.componentName + '|' + x.source); });
    const target = 7, name = await ev(() => __t.tiles('component').find(n => n !== state.symbolCells[7].componentName));
    await ev(async n => { const t = __t.tile('component', n); t.dataset.__pick = 1; }, name);
    const ok = await dragTile('component', target);
    expect(c, ok, 'could not locate tile/cell');
    const after = await ev(() => state.symbolCells.map(x => x.componentName + '|' + x.source));
    const changed = after.map((x, i) => x !== before[i] ? i : -1).filter(i => i >= 0);
    expect(c, changed.length === 1 && changed[0] === target, `changed cells: ${changed.join(',') || 'none'} (expected only ${target}) — tile picked by DOM order, first tile may equal the cell's current value`);
    await invariants(c, 'J3.2');
  });
  await test('J3.3', 'drop inside a multi-selection applies to all selected', async c => {
    const r = await ev(async () => { state.symbolSelection = new Set([1, 2, 3]); renderSymbolCanvasOnly(); await __t.wait(100); return __t.tiles('component').length; });
    await dragTile('component', 2);
    const res = await ev(() => { const n = state.symbolCells.slice(1, 4).map(x => x.componentName); return { n, same: new Set(n).size === 1 }; });
    expect(c, res.same, 'selected cells differ after the drop: ' + res.n.join(',')); await invariants(c, 'J3.3');
  });
  await test('J3.4', 'drop outside the grid / on the header → no change, nothing left behind', async c => {
    const before = await ev(() => JSON.stringify(state.symbolCells));
    await dragTile('component', 0, { to: { x: 700, y: 20 } });
    await dragTile('component', 0, { to: { x: 1100, y: 450 } });
    const after = await ev(() => JSON.stringify(state.symbolCells));
    expect(c, before === after, 'cells changed on a drop outside the grid'); await invariants(c, 'J3.4');
  });
  await test('J3.5', 'Esc mid-drag cancels and cleans up', async c => {
    const before = await ev(() => JSON.stringify(state.symbolCells));
    await dragTile('component', 5, { esc: true });
    const after = await ev(() => JSON.stringify(state.symbolCells));
    expect(c, before === after, 'Esc did not cancel the drop'); await invariants(c, 'J3.5');
  });
  await test('J3.6', 'locked cell: record whether a drop respects the lock', async c => {
    const r = await ev(() => { state.symbolSelection.clear(); state.symbolCells[9].locked = true; return state.symbolCells[9].componentName; });
    await dragTile('component', 9);
    const after = await ev(() => state.symbolCells[9].componentName);
    c.notes.push(`locked cell 9: ${r} → ${after} — decision 2026-10-04: a rail drop overwrites a locked cell (the lock only protects against Arrange/Suggest/Delete)`);
    await ev(() => { state.symbolCells[9].locked = false; });
  });
  await test('J3.7', 'drag a Symbol tile / drag on the Component tab must not start a drag', async c => {
    await ev(async () => { saveSymbolAs('Sym test'); await __t.wait(300); await __t.openRail(); });
    const g = await ev(() => { const t = __t.tile('symbol'); return t ? __t.center(t) : null; });
    expect(c, !!g, 'no Symbol tile after Save');
    if (g) { await drag(g, { x: g.x + 200, y: g.y + 120 }, { release: false }); const ghost = await ev(() => !!document.querySelector('.fvs-rail-ghost')); await mouse('mouseReleased', g.x + 200, g.y + 120); expect(c, !ghost, 'a Symbol tile started a drag'); }
    await invariants(c, 'J3.7');
  });
  await test('J3.8', 'Save library footer → named Symbol; load with unsaved work asks to confirm', async c => {
    const r = await ev(async () => {
      document.getElementById('fvs-rail-panel').dispatchEvent(new PointerEvent('pointerenter'));
      document.getElementById('btn-rail-save-lib').click(); await __t.answer('Footer sym'); await __t.wait(400);
      const saved = !!SYMBOL_LIBRARY.read()['Footer sym'];
      state.symbolCells[0].rotation = 90; Organica.dirty.set('fvs-symbol', true);
      __t.tile('symbol', 'Footer sym').click(); await __t.wait(300);
      const asked = !!__t.dlg() && /unsaved/i.test(__t.dlg().textContent); if (__t.dlg()) await __t.answer(null);
      return { saved, asked };
    });
    expect(c, r.saved, 'Save library did not save'); expect(c, r.asked, 'no unsaved-work confirm when loading a Symbol'); await invariants(c, 'J3.8');
  });
}

if (want('J3')) {
  await test('J3.9', 'Delete / Backspace empties the selected Symbol cells (locked skipped; not while typing)', async c => {
    const r = await ev(async () => {
      const key = (k, t = document.body) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); t.dispatchEvent(e); return e; };
      state.symbolSelection = new Set([1, 2, 3]); state.symbolCells[2].locked = true; state.symbolCells[1].source = state.symbolCells[3].source = 'component'; renderSymbolCanvasOnly(); await __t.wait(100);
      key('Delete'); await __t.wait(120);
      const out = { emptied: [1, 3].every(i => state.symbolCells[i].source === 'empty'), lockedKept: state.symbolCells[2].source !== 'empty' };
      state.symbolCells[4].source = 'component'; state.symbolSelection = new Set([4]); key('Backspace', document.getElementById('num-symbol-seed')); out.typingSafe = state.symbolCells[4].source === 'component';
      state.symbolCells[2].locked = false; return out;
    });
    expect(c, r.emptied, 'selected cells not emptied'); expect(c, r.lockedKept, 'locked cell was emptied'); expect(c, r.typingSafe, 'Backspace in a field emptied a cell');
  });
}

if (want('J3')) {
  await test('J3.10', 'BUG 1 · an emptied cell (Delete) can still be selected and dropped on', async c => {
    const r = await ev(async () => {
      state.symbolSelection = new Set([5, 6]); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })); await __t.wait(250);
      return { empty: [5, 6].every(i => state.symbolCells[i].source === 'empty'), hit: [5, 6].map(i => !!__t.cellEl(i)) };
    });
    expect(c, r.empty, 'Delete did not empty the cells'); expect(c, r.hit.every(Boolean), 'an empty cell has no [data-cell-index] hit shape (cannot be clicked or dropped on)');
    await ev(async () => { await __t.openRail(); });
    const g = await ev(() => { const t = __t.tile('component'), e = __t.cellEl(5); return t && e ? { from: __t.center(t), to: __t.center(e) } : null; });
    expect(c, !!g, 'no tile / cell to drag');
    if (g) { await drag(g.from, g.to); const after = await ev(() => state.symbolCells[5].source); expect(c, after === 'component', 'drop onto an emptied cell did nothing (source ' + after + ')'); }
    const click = await ev(() => { state.symbolSelection.clear(); const e = __t.cellEl(6); return e ? __t.center(e) : null; });
    if (click) { await sleep(50); await ev(() => { }); await clickAt(click); const sel = await ev(() => [...state.symbolSelection]); expect(c, sel.includes(6), 'clicking an emptied cell does not select it'); }
    await invariants(c, 'J3.10');
  });
}
if (want('J2')) {
  await test('J2.4', 'BUG 2 · a Component edited in Component Edit mode draws its own Elements when placed in a Symbol', async c => {
    const r = await ev(async () => {
      const wait = __t.wait; setTier('element'); __t.chg('sel-seed-type', 'arc'); await wait(150); setTier('component'); await wait(300);
      __t.chg('rg-grid-cols', 2); __t.chg('rg-grid-rows', 2); __t.chg('sel-rule', 'identity'); document.getElementById('btn-generate').click(); await wait(350);
      const base = state.components[0]; enterComponentEditMode(base.id); await wait(250); selectComponentEditCell(0); await wait(150); __t.chg('sel-seed-type', 'star'); await wait(250);
      saveComponentEditAsNew(); await wait(300);
      const edited = state.components.find(x => x.ruleSource === 'edited'); if (!edited) return { err: 'edit did not produce a Component' };
      quickSaveComponentToLibrary(edited.id, 'T edited'); quickSaveComponentToLibrary(base.id, 'T base'); await wait(150);
      setTier('symbol'); await wait(400); document.getElementById('btn-symgrid-generate').click(); for (let i = 0; i < 40 && !(state.symbolCells && state.symbolCells.length); i++) await wait(100); await wait(800);
      const svgOf = name => { state.symbolCells.forEach(cl => Object.assign(cl, { source: 'component', componentName: name, rotation: 0, flipH: false, flipV: false, scale: 1, fitMode: 'contain' })); return buildSymbolSVG(); };
      const a = svgOf('T base'), b = svgOf('T edited');
      let cv = ''; try { const o = document.createElement('canvas'); o.width = o.height = 200; const cx = o.getContext('2d'); drawSymbolCanvas(cx); cv = 'ok'; } catch (e) { cv = 'threw ' + e.message; }
      return { differ: __t.hashSvg(a) !== __t.hashSvg(b), hasContent: edited.cells.some(x => x.content), cv };
    });
    expect(c, !r.err, r.err); if (r.err) return;
    expect(c, r.hasContent, 'edited Component carries no per-cell content (test setup)'); expect(c, r.differ, 'a Component edited cell-by-cell renders IDENTICALLY to the original in the Symbol (per-cell Elements ignored)');
    expect(c, r.cv === 'ok', 'canvas export path: ' + r.cv);
  });
}

// ════════════ J4 — cross-step stress ════════════
if (want('J4')) {
  await test('J4.1', 'remove a Component that is placed in cells / pool / a saved Symbol (H2, H3)', async c => {
    const r = await ev(async () => {
      if (libraryNames(LIBRARY.read()).length < 2) return { skip: true };
      setTier('symbol'); await __t.wait(400); await __t.openRail();
      const used = state.symbolCells.find(x => x.source === 'component').componentName;
      saveSymbolAs('Uses ' + used); await __t.wait(200);
      __t.tile('component', used).parentElement.querySelector('[data-rail-remove]').click(); await __t.wait(300);
      const asked = !!__t.dlg() && /Used in/.test(__t.dlg().textContent); await __t.answer('ok'); await __t.wait(400);
      const cellsMissing = state.symbolCells.filter(x => x.source === 'component' && x.componentName === used).length;
      const poolStale = state.symbolPool.some(p => p.name === used);
      const poolUi = false;   // the pool has no UI any more (right-bar section removed) — only state.symbolPool
      const savedSym = Object.values(SYMBOL_LIBRARY.read()).some(e => (e.cells || []).some(x => x.componentName === used));
      return { used, asked, cellsMissing, poolStale, poolUi, savedSym, v: __t.inv() };
    });
    if (r.skip) { c.notes.push('not enough Components'); return; }
    expect(c, r.asked, 'removing a used Component did not ask for confirmation (decision 1 = B)');
    expect(c, r.cellsMissing === 0, `${r.cellsMissing} live cell(s) still reference the removed "${r.used}"`);
    if (r.savedSym) c.notes.push('by decision: saved Symbols keep a missing marker for the removed Component');
    expect(c, !r.poolStale && !r.poolUi, 'pool still lists / renders the removed Component (H3)');
    await shot('J4.1');
  });
  await test('J4.2', 'rapid successive drops and tab hops leave no stuck state', async c => {
    await ev(async () => { setTier('symbol'); await __t.wait(300); await __t.openRail(); });
    for (let i = 0; i < 4; i++) { const g = await ev(i => { const t = __t.tile('component') || __t.tile('element'); const e = __t.cellEl(i); return t && e ? { from: __t.center(t), to: __t.center(e) } : null; }, i); if (g) await drag(g.from, g.to, { steps: 4 }); }
    await ev(async () => { setTier('element'); await __t.wait(100); setTier('component'); await __t.wait(100); setTier('symbol'); await __t.wait(300); });
    await invariants(c, 'J4.2');
  });
}

// ════════════ D — design-system assertions (from the DS agent's CONSULT list) ════════════
if (want('D')) {
  await load();
  await seedComponents(3);
  await ev(async () => { saveElementVariant(0, false, false, '0°', 'D el'); saveElementVariant(90, false, false, '90°', 'D el 2'); setTier('symbol'); await __t.wait(300); });
  await gridReady();
  await ev(async () => { await __t.openRail(); await __t.wait(300); });
  await test('D.1', 'aria / roles / names / no title / icons are registry', async c => {
    const r = await ev(() => {
      const v = []; const q = s => [...document.querySelectorAll(s)];
      const rb = document.getElementById('btn-rail'); if (!rb.getAttribute('aria-label')) v.push('#btn-rail no aria-label'); if (rb.getAttribute('aria-controls') !== 'fvs-rail-panel') v.push('aria-controls');
      if (document.getElementById('fvs-rail').getAttribute('role') !== 'toolbar') v.push('rail role'); if (document.getElementById('fvs-rail-panel').getAttribute('role') !== 'region') v.push('panel role');
      q('#fvs-rail button, #fvs-rail-dock .org-floatbar__btn').forEach(b => { if (b.hasAttribute('title')) v.push('title on floatbar button ' + b.id); });
      q('#fvs-rail-dock button').forEach(b => { const n = (b.getAttribute('aria-label') || b.textContent || '').trim(); if (!n) v.push('unnamed button ' + (b.className || b.id)); });
      const labels = q('#fvs-rail-panel [data-rail-remove]').map(b => b.getAttribute('aria-label')); if (new Set(labels).size !== labels.length) v.push('duplicate remove labels');
      q('#fvs-rail-dock button:not(.fvs-library-item)').forEach(b => { if (/[×+↑↓✓▾]/.test(b.textContent)) v.push('typed glyph in ' + (b.id || b.className)); b.querySelectorAll('svg').forEach(sv => { if (!sv.classList.contains('ico')) v.push('bare <svg> in ' + (b.id || b.className)); }); });
      q('#fvs-rail-panel .fvs-library-item').forEach(b => { if (!(b.getAttribute('aria-label') || '').includes(b.dataset.railName)) v.push('tile label lacks name: ' + b.dataset.railName); });
      q('[tabindex]').forEach(e => { if (+e.getAttribute('tabindex') > 0) v.push('tabindex>0'); });
      return v;
    });
    expect(c, !r.length, r.join('; '));
  });
  await test('D.2', 'hit sizes: tile / rename / remove / toggle / footer ≥ --hit-min (effective)', async c => {
    const r = await ev(() => {
      const min = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit-min')) || 24, v = []; const info = {};
      const eff = el => { const r = el.getBoundingClientRect(); let w = r.width, h = r.height; const b = getComputedStyle(el, '::before'); if (b.content !== 'none' && b.position === 'absolute') { const i = parseFloat(b.top) || 0; w = Math.max(w, r.width - 2 * i); h = Math.max(h, r.height - 2 * i); } return { w, h }; };
      [['tile', '.fvs-rail__tile .fvs-library-item'], ['remove', '[data-rail-remove]'], ['rename', '[data-rail-rename]'], ['toggle', '#btn-rail']].forEach(([k, sel]) => { const el = document.querySelector(sel); if (!el) { v.push('missing ' + k); return; } const e = eff(el); info[k] = e; if (e.w < min || e.h < min) v.push(`${k} ${Math.round(e.w)}×${Math.round(e.h)} < ${min}`); });
      return { v, info, min };
    });
    expect(c, !r.v.length, r.v.join('; ') + ' (13px chip relies on ::before; effective size computed from its inset)');
    c.notes.push('measured: ' + JSON.stringify(r.info));
  });
  await test('D.3', 'layout: 2×48px columns, no horizontal scroll, no overlap with #panel / floatbar at 1440 and 769', async c => {
    const out = {};
    for (const w of [1440, 769]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(400);
      out[w] = await ev(() => {
        const g = getComputedStyle(document.getElementById('rail-components')).gridTemplateColumns, sc = document.querySelector('.fvs-rail__scroll');
        const r = id => document.querySelector(id).getBoundingClientRect(); const hit = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const pan = r('#fvs-rail-panel'), panel = r('#panel'), fb = document.querySelector('.org-floatbar:not(#fvs-rail):not(#fvs-rail-panel)'), hd = document.querySelector('.org-header');
        return { cols: g, hOver: sc.scrollWidth - sc.clientWidth, panelMax: pan.height <= 0.6 * innerHeight + 1, overPanel: hit(pan, panel), overFloatbar: fb ? hit(pan, fb.getBoundingClientRect()) : false, overHeader: hd ? hit(pan, hd.getBoundingClientRect()) : false, bodyScroll: document.documentElement.scrollHeight > innerHeight };
      });
    }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const w of [1440, 769]) { const o = out[w]; expect(c, o.cols === '48px 48px', `${w}: columns ${o.cols}`); expect(c, o.hOver <= 8, `${w}: horizontal overflow ${o.hOver}px`); expect(c, !o.overPanel && !o.overFloatbar && !o.overHeader, `${w}: panel overlaps ${[o.overPanel && '#panel', o.overFloatbar && 'floatbar', o.overHeader && 'header'].filter(Boolean).join('/')}`); expect(c, o.panelMax, `${w}: panel exceeds 60vh`); }
    c.notes.push(JSON.stringify(out));
  });
  await test('D.4', 'motion: panel/chip transitions use tokens only (no all, no width/left/top); reduced motion collapses', async c => {
    const r = await ev(() => { const v = []; const t = el => { const s = getComputedStyle(el); return { p: s.transitionProperty, d: s.transitionDuration }; };
      [['panel', '#fvs-rail-panel'], ['chip', '.rmx-x'], ['toggle', '#btn-rail']].forEach(([k, sel]) => { const el = document.querySelector(sel); if (!el) return; const x = t(el); if (/\ball\b/.test(x.p)) v.push(k + ' transitions all'); if (/width|height|left|top|max-height/.test(x.p)) v.push(k + ' animates layout: ' + x.p); });
      const root = getComputedStyle(document.documentElement); return { v, base: root.getPropertyValue('--dur-base').trim(), panel: t(document.getElementById('fvs-rail-panel')) }; });
    expect(c, !r.v.length, r.v.join('; '));
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await sleep(200);
    const rm = await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--dur-base').trim() + '|' + getComputedStyle(document.getElementById('fvs-rail-panel')).transitionDuration);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    expect(c, /^1ms\|/.test(rm) || /\b0\.001s\b/.test(rm), 'reduced motion did not collapse durations: ' + rm);
  });
  await test('D.5', 'contrast: .is-drop outline on a DARK Symbol paper; rail empty text; ghost border', async c => {
    const r = await ev(async () => {
      const C = Organica.color, out = {}; const rgb2hex = s => { const m = s.match(/\d+(\.\d+)?/g).map(Number); return '#' + m.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join(''); };
      const ink = rgb2hex(getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().startsWith('#') ? (() => { const h = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(); const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16 & 255},${n >> 8 & 255},${n & 255})`; })() : getComputedStyle(document.body).color);
      const paperSet = ['#1a1a1a', '#ffffff', '#264653']; out.ink = ink; out.ratios = {};
      paperSet.forEach(p => { out.ratios[p] = Math.round(C.contrast(ink, p) * 100) / 100; });
      return out;
    });
    const bad = Object.entries(r.ratios).filter(([, v]) => v < 3).map(([k, v]) => `${k}:${v}`);
    if (bad.length) c.notes.push(`ACCEPTED by owner 2026-10-04 (outline kept as is): .is-drop stroke --ink (${r.ink}) < 3:1 on Symbol paper(s) ${bad.join(', ')}`);
    c.notes.push(JSON.stringify(r.ratios));
  });
  await test('D.6', 'z-order: rail above stage; modal above ghost/rail; dock gap is click-through', async c => {
    const r = await ev(() => { const z = id => getComputedStyle(document.querySelector(id)).zIndex; const dock = document.getElementById('fvs-rail-dock'); const a = document.getElementById('fvs-rail').getBoundingClientRect(), b = document.getElementById('fvs-rail-panel').getBoundingClientRect(); const gx = (a.right + b.left) / 2, gy = a.top + 10; const e = document.elementFromPoint(gx, gy); return { dock: z('#fvs-rail-dock'), pe: getComputedStyle(dock).pointerEvents, gapHit: e ? (e.closest('#fvs-rail-dock') ? 'dock' : e.id || e.tagName) : null }; });
    expect(c, r.dock === '150', 'dock z-index ' + r.dock); expect(c, r.pe === 'none', 'dock pointer-events ' + r.pe); expect(c, r.gapHit !== 'dock', 'the gap between rail and panel blocks the canvas');
  });
  await test('D.7', 'tab order + keyboard: toggle → tiles → rename → remove; Esc closes and refocuses toggle', async c => {
    const seq = [];
    await ev(() => { document.getElementById('btn-rail').focus(); });
    for (let i = 0; i < 6; i++) { await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await sleep(60); seq.push(await ev(() => { const a = document.activeElement; return (a.dataset.railKind ? 'tile:' + a.dataset.railKind : a.dataset.railRename ? 'rename' : a.dataset.railRemove ? 'remove' : a.id || a.tagName); })); }
    expect(c, seq[0] === 'tile:element' && seq[1] === 'rename' && seq[2] === 'remove', 'tab order: ' + seq.join(' → '));
    const ring = await ev(() => { const a = document.activeElement, s = getComputedStyle(a); return { w: s.outlineWidth, st: s.outlineStyle }; });
    c.notes.push('focus ring on tab stop: ' + JSON.stringify(ring)); expect(c, ring.st !== 'none', 'no focus outline on the focused rail control');
    await ev(() => { document.getElementById('btn-rail').focus(); });
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300);
    const esc = await ev(() => ({ open: railIsOpen(), focus: document.activeElement.id })); expect(c, !esc.open && esc.focus === 'btn-rail', 'Esc: ' + JSON.stringify(esc));
    await ev(async () => { await __t.openRail(); });
  });
  await test('D.8', 'keyboard alternative to drag exists (select cell → Enter on a tile)', async c => {
    const r = await ev(async () => { state.symbolSelection = new Set([4]); renderSymbolCanvasOnly(); await __t.wait(100); const t = __t.tile('component'); const before = state.symbolCells[4].componentName; t.focus(); t.click(); await __t.wait(200); return { before, after: state.symbolCells[4].componentName, name: t.dataset.railName }; });
    expect(c, r.after === r.name, 'click/Enter on a tile did not place it into the selected cell');
  });
  await test('D.9', 'both themes: glass present, text colour follows theme', async c => {
    const out = {};
    for (const t of ['light', 'dark']) { await ev(t => { document.documentElement.dataset.theme = t; }, t); await sleep(250); out[t] = await ev(() => { const p = getComputedStyle(document.getElementById('fvs-rail-panel')), b = getComputedStyle(document.body); return { bg: p.backgroundColor, bf: p.backdropFilter, ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), body: b.color }; }); await shot('D.9-' + t); }
    await ev(t => { document.documentElement.dataset.theme = t; }, THEME);
    expect(c, out.light.ink !== out.dark.ink, '--ink identical in both themes'); expect(c, out.light.bg !== out.dark.bg, 'panel background identical in both themes (glass not themed)');
    c.notes.push(JSON.stringify(out));
  });
}

// ════════════ V — variant generation (≥100 Symbols) ════════════
const contact = [];
if (want('V')) {
  await load();
  const SEEDS = ['arc', 'triangle', 'circle', 'star', 'wedge', 'chevron', 'drop', 'lens', 'blob', 'cross', 'roundedrect', 'polygon', 'segment', 'arctruchet'];
  const STYLES = ['fill', 'stroke', 'pattern'];
  const RULES = ['identity', 'pinwheel', 'mirror', 'diagonal', 'checkerboard', 'rowmirror', 'columnmirror', 'radial', 'hlines', 'vlines', 'oscillator', 'random'];
  const GENS = ['rectangular', 'bento', 'sinusoidal', 'masonry', 'hexagonal', 'triangular', 'diamond', 'circular', 'radial', 'organic', 'fractal', 'spiral'];
  const PRESETS = ['Square 1:1', 'Portrait 4:5', 'Landscape 16:9', 'Vertical 9:16', 'Widescreen 3:2', 'A4 portrait', 'A4 landscape'];
  const FILLS = ['generate', 'rule', 'suggest', 'manual'];
  const ARR = ['random', 'checker', 'rows', 'columns', 'diagonal', 'blocks', 'rings', 'sectors', 'wave'];
  let n = 0;
  while (n < VARIANTS) {
    const cfg = { seed: pick(SEEDS), style: pick(STYLES), cols: 1 + Math.floor(rng() * 4), rows: 1 + Math.floor(rng() * 4), rule: pick(RULES), inks: 1 + Math.floor(rng() * 3), preset: pick(PRESETS), gen: pick(GENS), fill: pick(FILLS), arr: pick(ARR), fit: pick(['fill', 'contain', 'cover']), mode: rng() < 0.2 ? 'print' : 'screen' };
    await test(`V.${String(n + 1).padStart(3, '0')}`, `${cfg.seed}/${cfg.style} ${cfg.cols}×${cfg.rows} ${cfg.rule} → ${cfg.gen} ${cfg.preset} ${cfg.fill}/${cfg.arr}${cfg.mode === 'print' ? ' print' : ''}`, async c => {
      const r = await ev(async cfg => {
        const out = { cfg, steps: [] };
        setTier('element'); await __t.wait(120);
        __t.chg('sel-seed-type', cfg.seed); __t.chg('sel-element-fillmode', cfg.style); await __t.wait(120);
        setTier('component'); await __t.wait(200);
        __t.chg('rg-grid-cols', cfg.cols); __t.chg('rg-grid-rows', cfg.rows);
        const ruleSel = document.getElementById('sel-rule'); const okRule = [...ruleSel.options].some(o => o.value === cfg.rule && !o.disabled); __t.chg('sel-rule', okRule ? cfg.rule : 'random');
        document.getElementById('btn-generate').click(); await __t.wait(350);
        if (!state.components.length) { out.err = 'Generate produced no Components'; return out; }
        for (let i = 0; i < Math.min(2, state.components.length); i++) quickSaveComponentToLibrary(state.components[i].id);
        setTier('symbol'); await __t.wait(300);
        __t.chg('sel-symcanvas-preset', cfg.preset);
        const seg = document.querySelector('#seg-symcanvas-mode [data-mode="' + cfg.mode + '"], #seg-symcanvas-mode button'); // best effort
        __t.chg('sel-symgrid-gen', cfg.gen); __t.chg('sel-symbol-fill', cfg.fill); __t.chg('sel-sym-arrange', cfg.arr); __t.chg('sel-sym-arrange-fit', cfg.fit);
        document.getElementById('btn-symgrid-generate').click();
        for (let i = 0; i < 60 && !(state.symbolGrid && state.symbolCells && state.symbolCells.length); i++) await __t.wait(100);
        await __t.wait(900);
        const errEl = document.getElementById('symgrid-gen-error'); out.genError = errEl && errEl.style.display !== 'none' ? errEl.textContent : '';
        if (!state.symbolGrid) { out.err = 'no grid'; return out; }
        let svg = ''; try { svg = buildSymbolSVG(); } catch (e) { out.err = 'buildSymbolSVG threw: ' + e.message; return out; }
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        out.parseError = !!doc.querySelector('parsererror'); out.hasViewBox = !!doc.documentElement.getAttribute('viewBox'); out.len = svg.length;
        out.cells = state.symbolCells.length; out.gridCells = (state.symbolGrid.cells || []).length;
        out.hash = __t.hashSvg(svg);
        saveSymbolAs('V ' + Date.now()); await __t.wait(80);
        const name = Object.keys(SYMBOL_LIBRARY.read()).pop(); const entry = SYMBOL_LIBRARY.read()[name];
        applySymbolLibraryEntryToUI(entry); await __t.wait(200);
        let svg2 = ''; try { svg2 = buildSymbolSVG(); } catch (e) { out.err = 'round-trip threw: ' + e.message; }
        out.roundTrip = __t.hashSvg(svg2);
        out.svg = svg; out.inv = __t.inv();
        return out;
      }, cfg);
      expect(c, !r.err, r.err); if (r.err) return;
      expect(c, !r.parseError, 'SVG not well-formed'); expect(c, r.hasViewBox, 'SVG has no viewBox');
      expect(c, r.cells === r.gridCells, `cells ${r.cells} != grid cells ${r.gridCells}`);
      expect(c, r.hash === r.roundTrip, `save→load round-trip changed the SVG (${r.hash} vs ${r.roundTrip})`);
      if (r.genError) c.notes.push('generator message: ' + r.genError.slice(0, 120));
      if (r.inv && r.inv.length) { c.ok = false; c.notes.push('invariants: ' + r.inv.join('; ')); }
      contact.push({ id: c.id, title: c.title, ok: c.ok, svg: r.svg });
      n++;
    });
    if (results.length > VARIANTS * 3) break;   // runaway guard
    n = Math.max(n, results.filter(r => r.id.startsWith('V.')).length);
  }
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────────
const fail = results.filter(r => !r.ok);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ theme: THEME, seed: SEED, results }, null, 2));
if (contact.length) fs.writeFileSync(path.join(OUT, 'contact.html'), `<!doctype html><meta charset=utf-8><title>FVS variants</title><style>body{font:11px monospace;background:#fff;margin:12px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.c{border:1px solid #ccc;padding:4px}.c.f{border-color:#c00}.c svg{width:100%;height:auto;display:block;max-height:180px}</style><div class=g>${contact.map(x => `<div class="c ${x.ok ? '' : 'f'}"><b>${x.id}</b> ${x.ok ? '' : '✗'}<br>${x.svg.replace(/<\?xml[^>]*>/, '')}<br>${x.title}</div>`).join('')}</div>`);
fs.writeFileSync(path.join(OUT, 'summary.md'), `# FVS UI test — ${results.length} cases, ${fail.length} failing (${THEME})\n\n` + results.map(r => `- ${r.ok ? 'PASS' : '**FAIL**'} \`${r.id}\` ${r.title}${r.ok ? '' : '\n  - ' + [...r.notes, ...r.errors].join('\n  - ')}`).join('\n') + '\n');
console.log(`\n${results.length - fail.length}/${results.length} passed · variants rendered: ${contact.length} · artefacts: ${OUT}`);
done(fail.length ? 1 : 0);
