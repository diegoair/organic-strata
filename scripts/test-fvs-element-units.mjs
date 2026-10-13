#!/usr/bin/env node
// FVS Element units — where a figure inside the Element meets the box edge (and so the neighbouring cell / tile).
// Fit to canvas: the drawn shape (stroke included) reaches the 0..100 box edges, never past them, for shapes on
// each of the three fit policies (identity, overflow-only, fitToBox) and for a stroked shape whose normScale ≠ 1.
// Usage: scripts/test-fvs-element-units.sh [--theme light|dark]
// No dependencies: serves the repo on 127.0.0.1, headless Chrome over CDP, never writes to the repo.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const THEME = arg('theme', 'light'), SHOTS = arg('shots', '');   // --shots DIR: screenshots of the Element canvas

const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/test-fvs-element-units.mjs'); process.exit(2); }

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
setTimeout(() => { console.log('FVS element units test: ERROR — timed out after 6 min'); done(1); }, 6 * 60 * 1000);

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
  else if (m.method === 'Page.javascriptDialogOpening') ws.send(JSON.stringify({ id: ++nid, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
});
const cdp = (method, params = {}) => new Promise(r => { const i = ++nid; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ev(fn, ...args) {
  const r = await cdp('Runtime.evaluate', { expression: `(${fn.toString()})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]);
  return r.result?.result?.value;
}

// ── the mouse: `held` = the side button reported down for the whole mode (bit 8 in every event) ──
let held = false;
const BIT = { left: 1, right: 2, middle: 4, back: 8 };
const raw = (type, x, y, button, buttons) => cdp('Input.dispatchMouseEvent', { type, x, y, button, buttons: buttons | (held ? 8 : 0), clickCount: type === 'mouseMoved' ? 0 : 1 });
const hover = async (x, y) => { await raw('mouseMoved', x, y, 'none', 0); await sleep(40); };

let failures = 0, passes = 0;
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok, detail }); if (ok) passes++; else failures++; }

async function openFvs() {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/vercel.json` }); await sleep(500);
  await ev(() => { try { localStorage.clear(); } catch {} });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/fvs/` }); await sleep(800);
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await ev(t => { document.documentElement.dataset.theme = t; }, THEME);
  await sleep(400);
  consoleErrors = [];
}

// The Element as drawn with the live appearance, rasterised over a −20..120 box at 10 px per unit:
// the ink's extent in box units (0.1-unit resolution, stroke and joins included — independent of getBBox).
const INK_EXTENT = async () => {
  const F = window.__fvs, geo = F.SEED_TYPES[F.getSeed().type].geometry(F.getSeed());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="-20 -20 140 140">${F.elementPathMarkup(geo, '#000')}</svg>`;
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
  const cv = document.createElement('canvas'); cv.width = cv.height = 1400; const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, 1400, 1400).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let y = 0; y < 1400; y++) for (let x = 0; x < 1400; x++) if (d[(y * 1400 + x) * 4 + 3] > 64) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const u = p => +(p / 10 - 20).toFixed(2);
  return { x0: u(x0), y0: u(y0), x1: u(x1 + 1), y1: u(y1 + 1) };
};

async function fitToCanvas() {
  const cases = [
    { name: 'Triangle, fill (identity)', type: 'triangle', fill: 'fill' },
    { name: 'Triangle, stroke 12', type: 'triangle', fill: 'stroke', sw: 12 },
    { name: 'Arc with Start 30, stroke 10 (fitToBox, normScale ≠ 1)', type: 'arc', fill: 'stroke', sw: 10, set: { 'rg-arc-start': 30 } },
    { name: 'Drop, fill (fitToBox)', type: 'drop', fill: 'fill' },
    { name: 'Blob, stroke 8 (fitToBox)', type: 'blob', fill: 'stroke', sw: 8 },
    { name: 'Star, stroke 20, Width 0.6', type: 'star', fill: 'stroke', sw: 20, set: { 'rg-element-w': 0.6 } },
    { name: 'Circle, stroke 6, Rotation 30', type: 'circle', fill: 'stroke', sw: 6, set: { 'rg-element-rotate': 30 } },
  ];
  for (const c of cases) {
    const r = await ev(async (c, INK) => {
      const F = window.__fvs, set = (id, v, evName = 'input') => { const el = document.getElementById(id); if (!el) return; el.value = v; el.dispatchEvent(new Event(evName, { bubbles: true })); };
      F.resetElement && F.resetElement();
      set('sel-seed-type', c.type, 'change');
      set('sel-element-fillmode', c.fill, 'change');
      if (c.sw) set('rg-element-strokew', c.sw);
      for (const [id, v] of Object.entries(c.set || {})) set(id, v);
      // start off-centre and oversized, so the fit has work to do
      set('rg-element-scale', 1.7); set('rg-element-mx', 13); set('rg-element-my', -9);
      F.fitSeedToCanvas();
      const e = await (0, eval)('(' + INK + ')')();
      return { ...e, scale: F.val('rg-element-scale'), mx: F.val('rg-element-mx'), my: F.val('rg-element-my') };
    }, c, INK_EXTENT.toString());
    const inside = r.x0 >= -0.35 && r.y0 >= -0.35 && r.x1 <= 100.35 && r.y1 <= 100.35;
    const touches = Math.max(r.x1 - r.x0, r.y1 - r.y0) >= 99.3;
    const centred = Math.abs((r.x0 + r.x1) / 2 - 50) <= 0.4 && Math.abs((r.y0 + r.y1) / 2 - 50) <= 0.4;
    check('Fit to canvas · ' + c.name + ': the drawn ink fills the box edge to edge, centred, never past it', inside && touches && centred, JSON.stringify(r));
  }
}

// --shots DIR: the Element canvas at 4× (a look, not a check)
async function shot(name) {
  if (!SHOTS) return;
  const b = await ev(() => { const r = document.querySelector('#element-svg > svg').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: Math.max(1, 600 / b.w) } });
  fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
}
// Show as tile: the canvas becomes the −50…150 view with the 8 neighbours and the edge overlay; the joins it marks.
async function tileView() {
  const r = await ev(async () => {
    const F = window.__fvs, set = (id, v, evName = 'input') => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(evName, { bubbles: true })); };
    const out = {};
    F.resetElement();
    set('sel-seed-type', 'arc', 'change'); set('sel-element-fillmode', 'fill', 'change');
    document.getElementById('btn-element-view-tile').click();
    await new Promise(r => setTimeout(r, 60));
    const svg = document.querySelector('#element-svg > svg');
    out.pressed = document.getElementById('btn-element-view-tile').getAttribute('aria-pressed');
    out.viewBox = svg && svg.getAttribute('viewBox');
    out.ghosts = svg ? svg.querySelectorAll('.fvs-tile-ghost > use').length : 0;
    out.ticks = svg ? svg.querySelectorAll('.fvs-tile-tick').length : 0;
    out.arc = F.edgeContacts(F.measureElementInk(F.SEED_TYPES.arc.geometry(F.getSeed())).pts);
    set('sel-seed-type', 'arctruchet', 'change');
    out.truchet = F.edgeContacts(F.measureElementInk(F.SEED_TYPES.arctruchet.geometry(F.getSeed())).pts);
    // Brick: row ±1 shifted by half a cell
    document.querySelector('#element-tile-popover [data-tile-layout="brick"]').click();
    await new Promise(r => setTimeout(r, 60));
    out.brickXs = [...document.querySelectorAll('#element-svg .fvs-tile-ghost > use')].map(u => u.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/)).filter(m => +m[2] === -50).map(m => +m[1]).sort((a, b) => a - b);
    // a non-square cell: the toggle says why it is off, the plain canvas comes back
    document.querySelector('#element-tile-popover [data-tile-layout="grid"]').click();
    out.exportClean = !F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 400).includes('fvs-tile');
    F.setElementView(1);   // the 90° view: the tile view turns with it (and the Element's own view state is not clobbered)
    const t90 = document.querySelector('#element-svg > svg').outerHTML;
    out.turned = t90.includes('rotate(90)') && !t90.includes('undefined') && F.currentElementView().r === 90;
    F.setElementView(0);
    document.getElementById('btn-element-view-tile').click();   // off again
    out.offViewBox = document.querySelector('#element-svg > svg').getAttribute('viewBox');
    return out;
  });
  check('Show as tile: the canvas shows the −50…150 view, 8 neighbours, the joins ticked', r.pressed === 'true' && r.viewBox === '-50 -50 200 200' && r.ghosts === 8 && r.ticks > 0, JSON.stringify({ ...r, arc: undefined, truchet: undefined }));
  const near = (side, v, tol = 1.5) => side.some(c => Math.abs(c.mid - v) <= tol || (c.from - tol <= v && v <= c.to + tol));
  const a = r.arc;
  check('Joins · quarter arc: meets the right edge at its top corner and the bottom edge at its left corner', near(a.right, 0) && near(a.bottom, 0) && a.right.every(c => c.to < 5) && a.bottom.every(c => c.to < 5), JSON.stringify(a));
  const t = r.truchet;
  check('Joins · arc truchet: its bands meet the edges symmetrically about the midpoints', t.top.length > 0 && t.bottom.length > 0 && Math.abs(t.top.reduce((s, c) => s + c.mid, 0) / t.top.length - 50) < 1.5, JSON.stringify(t));
  check('Show as tile · Brick: the row above is shifted by half a cell', JSON.stringify(r.brickXs) === JSON.stringify([0, 100]), JSON.stringify(r.brickXs));
  check('Show as tile · the 90° view turns the tiles', r.turned, String(r.turned));
  check('Show as tile: the export is the plain Element (no tile, no overlay); off again = the plain canvas', r.exportClean && r.offViewBox === '0 0 400 400', JSON.stringify({ exportClean: r.exportClean, off: r.offViewBox }));
}

// Snap: the pure helper, then a real pointer drag on Move X (snaps, guide shown), ⌘ held (does not), the keyboard (does not).
async function snap() {
  const u = await ev(() => {
    const F = window.__fvs;
    return {
      near: F.snapAxis({ cands: [0, 50, 100], targets: [0, 50, 100], k: 1, v: 1.5 }),
      far: F.snapAxis({ cands: [0, 50, 100], targets: [0, 50, 100], k: 1, v: 3 }),
      scaled: F.snapAxis({ cands: [10], targets: [0, 50, 100], k: 0.5, v: 77 }),   // 10 + 38.5 = 48.5 → 50 at v = 80
      cands: F.snapCandidates({ bb: { x: 20, y: 0, width: 60, height: 100 }, pts: [{ x: 50, y: 0, px: 0, py: 0 }, { x: 20, y: 100, px: 0, py: 0 }, { x: 80, y: 100, px: 0, py: 0 }] }, 'x'),
    };
  });
  check('snapAxis: within 2 units → the slider value that lands it; past it → nothing; a layer\'s factor k', u.near && u.near.v === 0 && u.near.at === 0 && u.far === null && u.scaled && Math.abs(u.scaled.v - 80) < 1e-9 && u.scaled.at === 50, JSON.stringify(u));
  check('snapCandidates: edges, centre, and the tip touching the top (a triangle\'s apex)', JSON.stringify(u.cands) === JSON.stringify([20, 50, 80, 50]), JSON.stringify(u.cands));

  // the drag: a triangle at Scale 0.4 (ink 30..70) dragged to Move X ≈ 28.6 → its right edge (98.6) catches 100 → 30
  const at = await ev(() => {
    const F = window.__fvs, set = (id, v, evName = 'input') => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(evName, { bubbles: true })); };
    F.resetElement(); set('sel-seed-type', 'triangle', 'change'); set('sel-element-fillmode', 'fill', 'change'); set('rg-element-scale', 0.4);
    F.elementAids.snap = true; F.elementAids.tile = false;
    const r = document.getElementById('rg-element-mx'); r.scrollIntoView({ block: 'center' });
    const b = r.getBoundingClientRect(), x = v => b.left + 8 + (v + 100) / 200 * (b.width - 16);
    return { y: b.top + b.height / 2, x0: x(0), x1: x(28.6), xFar: x(20) };
  });
  const drag = async (from, to, mods = 0, probe) => {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from, y: at.y, modifiers: mods });
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: from, y: at.y, button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
    for (let i = 1; i <= 8; i++) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from + (to - from) * i / 8, y: at.y, button: 'left', buttons: 1, modifiers: mods }); await sleep(15); }
    const mid = probe ? await ev(probe) : null;
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to, y: at.y, button: 'left', buttons: 0, clickCount: 1, modifiers: mods }); await sleep(120);
    return mid;
  };
  const probe = () => ({ v: +document.getElementById('rg-element-mx').value, guide: !!document.querySelector('#element-svg .fvs-snap-guide') });
  const d1 = await drag(at.x0, at.x1, 0, probe);
  const after = await ev(() => ({ v: +document.getElementById('rg-element-mx').value, guide: !!document.querySelector('#element-svg .fvs-snap-guide') }));
  check('Snap · drag Move X near the edge: lands on it (30) with the guide shown, the guide goes on release', d1.v === 30 && d1.guide && after.v === 30 && !after.guide, JSON.stringify({ d1, after }));
  const d2 = await drag(at.x0, at.x1, 4 /* ⌘ */, probe);
  check('Snap · ⌘ held: no snap, no guide', d2.v !== 30 && !d2.guide, JSON.stringify(d2));
  const k = await ev(() => { const r = document.getElementById('rg-element-mx'); r.value = 28.5; r.focus(); return true; });
  await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 }); await sleep(100);
  const kv = await ev(() => +document.getElementById('rg-element-mx').value);
  check('Snap · arrow keys never snap', Math.abs(kv - 28.6) < 1e-9, String(kv));
  const off = await ev(() => { window.__fvs.elementAids.snap = false; return true; });
  const d3 = await drag(at.x0, at.x1, 0, probe);
  await ev(() => { window.__fvs.elementAids.snap = true; });
  check('Snap off (the floatbar toggle): no snap', d3.v !== 30 && !d3.guide, JSON.stringify(d3));
  await ev(() => document.getElementById('btn-element-view-snap').click());
  const pressed = await ev(() => [window.__fvs.elementAids.snap, document.getElementById('btn-element-view-snap').getAttribute('aria-pressed')]);
  await ev(() => document.getElementById('btn-element-view-snap').click());
  check('Snap toggle: the button turns it off and says so', pressed[0] === false && pressed[1] === 'false', JSON.stringify(pressed));
}

// Snap on a layer: a second layer (Size 0.6, ink 20..80) dragged by its X to ≈ 18.6 → its right edge catches 100 → 20;
// under an Element turned 90° the same X moves the ink down the box, and snaps on the y axis.
async function layerSnap() {
  const prep = async rot => ev(rot => {
    const F = window.__fvs, set = (id, v, evName = 'input') => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(evName, { bubbles: true })); };
    F.resetElement(); set('sel-seed-type', 'triangle', 'change'); set('sel-element-fillmode', 'fill', 'change');
    document.getElementById('btn-layer-add').click();
    set('rg-element-rotate', rot);
    F.elementAids.snap = true;
    const r = document.getElementById('rg-layer-mx'); r.scrollIntoView({ block: 'center' });
    const b = r.getBoundingClientRect(), x = v => b.left + 8 + (v + 100) / 200 * (b.width - 16);
    return { layers: F.state.layers ? F.state.layers.items.length : 0, y: b.top + b.height / 2, x0: x(0), x1: x(18.6), w: b.width };
  }, rot);
  const drag = async (at, mods = 0) => {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x0, y: at.y });
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x0, y: at.y, button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
    for (let i = 1; i <= 8; i++) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x0 + (at.x1 - at.x0) * i / 8, y: at.y, button: 'left', buttons: 1, modifiers: mods }); await sleep(15); }
    const mid = await ev(() => ({ v: +document.getElementById('rg-layer-mx').value, guide: !!document.querySelector('#element-svg .fvs-snap-guide'), place: window.__fvs.state.layers.items[window.__fvs.state.layers.active].place }));
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x1, y: at.y, button: 'left', buttons: 0, clickCount: 1, modifiers: mods }); await sleep(120);
    return mid;
  };
  for (const rot of [0, 90]) {
    const at = await prep(rot), d = await drag(at);
    check(`Snap · a layer's X dragged near the edge (Element turned ${rot}°): lands on it (20), the layer's place holds it`, at.layers === 2 && d.v === 20 && d.guide && d.place && d.place.mx === 20, JSON.stringify({ at, d }));
  }
}

async function visuals() {
  const setup = async (o) => ev(async o => {
    const F = window.__fvs, set = (id, v, evName = 'input') => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(evName, { bubbles: true })); };
    F.resetElement(); set('sel-seed-type', o.type, 'change'); set('sel-element-fillmode', o.fill || 'fill', 'change');
    if (o.sw) set('rg-element-strokew', o.sw);
    for (const [id, v] of Object.entries(o.set || {})) set(id, v);
    Object.assign(F.elementAids, { layout: o.layout || "grid", turn: o.turn || "none", tile: true });
    F.renderSeedPreview();
    const svg = document.querySelector('#element-svg > svg'); svg.style.position = 'fixed'; svg.style.left = '20px'; svg.style.top = '20px'; svg.style.width = svg.style.height = '400px'; svg.style.zIndex = 99999;
  }, o);
  for (const [name, o] of Object.entries({
    'arc-stroke': { type: 'arc', fill: 'stroke', sw: 8 }, 'arc-quarter': { type: 'arc', turn: 'quarter' },
    'truchet': { type: 'arctruchet' }, 'triangle-brick': { type: 'triangle', layout: 'brick' },
    'drop-overflow': { type: 'drop', set: { 'rg-element-mx': 30 } },
  })) { await setup(o); await sleep(150); await shot(name); }
}

await openFvs();
try { await fitToCanvas(); } catch (e) { check('Fit to canvas ran', false, e.message); }
try { await tileView(); } catch (e) { check('Show as tile ran', false, e.message); }
try { await snap(); } catch (e) { check('Snap ran', false, e.message); }
try { await layerSnap(); } catch (e) { check('Layer snap ran', false, e.message); }
if (SHOTS) await visuals();
check('console clean', !consoleErrors.length, consoleErrors.slice(0, 4).join(' | '));
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`\nFVS element units test (${THEME}): ${failures ? 'FAIL' : 'PASS'} — ${passes}/${passes + failures}`);
done(failures ? 1 : 0);
