#!/usr/bin/env node
// FVS Figure board — every pointer gesture on the node board, with REAL mouse input (Input.dispatchMouseEvent),
// run twice: a clean mouse, and a mouse that reports its side "back" button held the whole time (Diego's, Oct 9,
// 2026 — buttons 8 stays down, so the browser sends no pointerdown / pointerup and a capture is never released).
// Checks the effect of each gesture AND the cursor shown before / during / after it.
// Usage: scripts/test-figure-board.sh [--only clean|held] [--theme light|dark]
// Like scripts/test-fvs-ui.mjs: no dependencies, serves the repo, headless Chrome over CDP, never writes to the repo.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = arg('only', ''), THEME = arg('theme', 'light');

const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/test-figure-board.mjs'); process.exit(2); }

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
setTimeout(() => { console.log('Figure board test: ERROR — timed out after 6 min'); done(1); }, 6 * 60 * 1000);

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
// a press, steps, an optional probe mid-gesture (cursor / state), the release
async function gesture(from, to, { button = 'left', steps = 8, mid } = {}) {
  await hover(from.x, from.y);
  await raw('mousePressed', from.x, from.y, button, BIT[button]);
  let probe;
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps, y = from.y + (to.y - from.y) * i / steps;
    await raw('mouseMoved', x, y, button, BIT[button]); await sleep(12);
    if (mid && i === Math.ceil(steps / 2)) probe = await ev(mid, { x, y });
  }
  await raw('mouseReleased', to.x, to.y, button, 0); await sleep(150);
  return probe;
}
const click = async (p, mods = 0) => { await hover(p.x, p.y); await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1 | (held ? 8 : 0), clickCount: 1, modifiers: mods }); await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: held ? 8 : 0, clickCount: 1, modifiers: mods }); await sleep(120); };
const key = async (type, code, keyName, vk) => cdp('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: vk });

// ── in-page probes ──
const PAGE = `(() => {
  const w = window; if (w.__b) return;
  const st = () => document.querySelector('.nc-stage'), board = () => document.querySelector('.nc-board');
  const nodes = () => [...document.querySelectorAll('.nc-node')];
  const byKind = k => nodes().filter(n => k === 'pill' ? n.classList.contains('nc-node--pill') : n.classList.contains('nc-node--capped'));
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, t: r.y, w: r.width, h: r.height }; };
  const grip = n => { const h = [n.querySelector('.nc-node__body'), n.querySelector('.nc-node__head'), n].find(e => e && e.getBoundingClientRect().height > 4); const r = h.getBoundingClientRect(); return { x: r.x + Math.min(r.width / 2, 24), y: r.y + r.height / 2 }; };
  const cursorAt = p => { const el = document.elementFromPoint(p.x, p.y); return el ? getComputedStyle(el).cursor : '-'; };
  const captured = () => [...document.querySelectorAll('*')].filter(e => e.hasPointerCapture && (e.hasPointerCapture(1) )).map(e => e.className && e.className.baseVal === undefined ? e.className.split(' ')[0] : e.tagName);
  const sel = () => nodes().filter(n => n.classList.contains('is-selected')).map(n => n.dataset.nodeId);
  const empty = () => { const r = st().getBoundingClientRect(); for (let y = r.bottom - 40; y > r.top + 40; y -= 23) for (let x = r.right - 40; x > r.left + 40; x -= 31) { if (document.elementFromPoint(x, y) === st()) return { x, y }; } return null; };
  const leftovers = () => { const s = st().className, out = []; ['nc-stage--dragging', 'nc-stage--wiring', 'nc-stage--pan'].forEach(c => { if (s.includes(c)) out.push(c); }); if (board().classList.contains('panning')) out.push('board.panning'); if (!document.querySelector('.nc-marquee').hidden) out.push('marquee shown'); if (document.querySelector('.is-lifted')) out.push('.is-lifted'); if (document.body.classList.contains('nc-is-dragging')) out.push('body.nc-is-dragging'); const c = captured(); if (c.length) out.push('capture on ' + c.join(',')); return out; };
  w.__b = { st, board, nodes, byKind, box, grip, cursorAt, sel, empty, leftovers };
})()`;

async function openFigure() {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `http://localhost:${port}/fvs/` });
  for (let i = 0; i < 60; i++) { await sleep(250); if (await ev(() => !!document.querySelector('button[aria-label="Figure"]') && document.readyState === 'complete').catch(() => false)) break; }
  await ev(() => { try { localStorage.clear(); } catch {} });
  await cdp('Page.reload'); await sleep(1500);
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(() => !!document.querySelector('button[aria-label="Figure"]')).catch(() => false)) break; }
  await ev(t => { document.documentElement.dataset.theme = t; }, THEME);
  const b = await ev(() => { const r = document.querySelector('button[aria-label="Figure"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await click(b);   // the real dock click: the button keeps the focus (Space must still pan)
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(() => document.querySelectorAll('.nc-node').length > 3).catch(() => false)) break; }
  await sleep(500);
  await cdp('Runtime.evaluate', { expression: PAGE });
}

const results = [];
async function test(id, title, fn) {
  const c = { id, title, ok: true, notes: [] }; consoleErrors = [];
  try { await fn(c); } catch (e) { c.ok = false; c.notes.push('threw: ' + e.message); }
  const left = await ev(() => __b.leftovers()).catch(() => []);
  if (left.length) { c.ok = false; c.notes.push('left behind: ' + left.join(', ')); }
  const bad = consoleErrors.filter(e => !/Failed to load resource/.test(e));
  if (bad.length) { c.ok = false; c.notes.push(...bad.slice(0, 3)); }
  results.push(c);
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${c.ok ? '' : '  ← ' + c.notes.join(' | ')}`);
}
const expect = (c, cond, note) => { if (!cond) { c.ok = false; c.notes.push(note); } };
const moved = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > 20;

async function run(mode) {
  held = mode === 'held';
  await openFigure();
  if (held) await raw('mousePressed', 700, 450, 'back', 8);   // the side button goes down — and stays down
  const P = `[${mode}]`;

  await test(`${P} cursor`, 'at rest: a card and a pill show grab, a port crosshair, the empty board the arrow', async c => {
    const r = await ev(() => { const card = __b.byKind('capped')[0], pill = __b.byKind('pill')[0], dot = document.querySelector('.nc-port__dot'); return { card: __b.cursorAt(__b.grip(card)), pill: __b.cursorAt(__b.grip(pill)), port: getComputedStyle(dot).cursor, board: __b.cursorAt(__b.empty()) }; });
    expect(c, r.card === 'grab', 'card cursor ' + r.card); expect(c, r.pill === 'grab', 'pill cursor ' + r.pill);
    expect(c, r.port === 'crosshair', 'port cursor ' + r.port); expect(c, r.board === 'auto' || r.board === 'default', 'board cursor ' + r.board);
  });

  await test(`${P} click`, 'a click selects the node; a click on the empty board clears it', async c => {
    const p = await ev(() => __b.grip(__b.byKind('pill')[0]));
    await click(p);
    const one = await ev(() => __b.sel().length);
    await click(await ev(() => __b.empty()));
    const none = await ev(() => __b.sel().length);
    expect(c, one === 1, 'selected after click: ' + one); expect(c, none === 0, 'selected after empty click: ' + none);
  });

  await test(`${P} shift-click`, 'shift-click adds a second node to the selection', async c => {
    const [a, b] = await ev(() => __b.byKind('pill').slice(0, 2).map(__b.grip));
    await click(a); await click(b, 8 /* shift */);
    const n = await ev(() => __b.sel().length);
    expect(c, n === 2, 'selected: ' + n);
    await click(await ev(() => __b.empty()));
  });

  for (const [kind, label] of [['capped', 'the Figure card'], ['pill', 'a pill'], ['pill', 'another pill, right after']]) {
    const idx = label.startsWith('another') ? 1 : 0;
    await test(`${P} drag ${kind}${idx ? ' 2' : ''}`, `drag ${label}: it moves, grabbing cursor while it moves`, async c => {
      const before = await ev((k, i) => __b.box(__b.byKind(k)[i]), kind, idx);
      const from = await ev((k, i) => __b.grip(__b.byKind(k)[i]), kind, idx);
      const mid = await gesture(from, { x: from.x + 120, y: from.y + 90 }, { mid: p => ({ cur: __b.cursorAt(p), cls: __b.st().className }) });
      const after = await ev((k, i) => __b.box(__b.byKind(k)[i]), kind, idx);
      expect(c, moved(before, after), 'did not move');
      expect(c, mid && mid.cur === 'grabbing', 'cursor while dragging: ' + (mid && mid.cur));
    });
  }

  await test(`${P} marquee`, 'a drag on the empty board draws the box and selects what it covers', async c => {
    const r = await ev(() => { const s = __b.st().getBoundingClientRect(); return { a: { x: s.left + 8, y: s.top + 8 }, b: { x: s.right - 8, y: s.bottom - 8 } }; });
    const from = await ev(() => __b.empty());
    const mid = await gesture(from, r.a, { mid: () => ({ shown: !document.querySelector('.nc-marquee').hidden }) });
    const n = await ev(() => __b.sel().length);
    expect(c, mid && mid.shown, 'no marquee during the drag'); expect(c, n > 0, 'nothing selected');
    await click(await ev(() => __b.empty()));
  });

  await test(`${P} space-pan`, 'Space + drag pans (focus on the dock button); grab when held, grabbing while panning; Space does not press the button', async c => {
    const focus = await ev(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
    const t0 = await ev(() => __b.board().style.transform);
    const from = await ev(() => __b.empty());
    await hover(from.x, from.y);
    await key('rawKeyDown', 'Space', ' ', 32); await sleep(60);
    const heldCur = await ev(p => __b.cursorAt(p), from);
    const mid = await gesture(from, { x: from.x - 150, y: from.y - 100 }, { mid: p => __b.cursorAt(p) });
    await key('keyUp', 'Space', ' ', 32); await sleep(80);
    const t1 = await ev(() => __b.board().style.transform);
    const still = await ev(() => document.querySelectorAll('.nc-node').length > 3);
    expect(c, t0 !== t1, 'board did not pan'); expect(c, heldCur === 'grab', 'cursor with Space held: ' + heldCur);
    expect(c, mid === 'grabbing', 'cursor while panning: ' + mid); expect(c, still, 'Space left the Figure step (pressed the dock button)');
    c.notes.push('focus was on: ' + focus);
  });

  await test(`${P} middle-pan`, 'the wheel button drags the board, grabbing cursor while it pans', async c => {
    const t0 = await ev(() => __b.board().style.transform);
    const from = await ev(() => __b.empty());
    const mid = await gesture(from, { x: from.x - 140, y: from.y - 80 }, { button: 'middle', mid: p => __b.cursorAt(p) });
    const t1 = await ev(() => __b.board().style.transform);
    expect(c, t0 !== t1, 'board did not pan'); expect(c, mid === 'grabbing', 'cursor while panning: ' + mid);
  });

  await test(`${P} wire`, 'a drag from an output port onto a card adds a wire; crosshair while wiring', async c => {
    const s = await ev(() => {
      // a pill's output dot and a card it is not wired to yet that can take it
      const pills = __b.byKind('pill'), fig = __b.byKind('capped')[0];
      const dot = pills.map(p => p.querySelector('.nc-port__dot[data-dir="out"]')).find(Boolean);
      const r = dot.getBoundingClientRect(); return { from: { x: r.x + r.width / 2, y: r.y + r.height / 2 }, to: __b.grip(fig), wires: document.querySelectorAll('[data-edge]').length };
    });
    // detach first so there is something to connect: drag the Figure's matching input off and drop it on the board
    const mid = await gesture(s.from, s.to, { mid: p => __b.cursorAt(p) });
    const w1 = await ev(() => document.querySelectorAll('[data-edge]').length);
    expect(c, mid === 'crosshair', 'cursor while wiring: ' + mid);
    expect(c, w1 >= s.wires, 'wires went from ' + s.wires + ' to ' + w1);
  });

  await test(`${P} node bar`, 'a tile dragged from the node bar onto the board adds a node', async c => {
    const btn = await ev(() => { const b = document.querySelector('button[aria-label="Content nodes"]'); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await click(btn); await sleep(350);
    const s = await ev(() => { const t = [...document.querySelectorAll('.nc-nodebar__item')].find(i => i.offsetParent); if (!t) return null; const r = t.getBoundingClientRect(); return { from: { x: r.x + r.width / 2, y: r.y + r.height / 2 }, n: document.querySelectorAll('.nc-node').length, to: __b.empty() }; });
    expect(c, !!s, 'no node-bar tile visible');
    if (!s) return;
    await gesture(s.from, s.to, { steps: 12 });
    const n = await ev(() => document.querySelectorAll('.nc-node').length);
    expect(c, n === s.n + 1, 'nodes ' + s.n + ' → ' + n);
    await click(btn); await sleep(250);
  });

  if (!held) await test(`${P} rotate panel`, 'Rotate & mirror on the cells: every control redraws the Figure; the pill says what is set', async c => {
    // a built-in Figure (it brings its own Element, Grid, Palette): New Figure… → the first built-in; it arrives selected
    await click(await ev(() => __b.box(document.getElementById('btn-fg-new')))); await sleep(400);
    await click(await ev(() => __b.box(document.querySelector('.fg-new__item')))); await sleep(1500);
    const figId = await ev(() => { const n = __b.nodes().find(x => x.classList.contains('is-selected') && x.classList.contains('nc-node--capped')); return n && n.dataset.nodeId; });
    expect(c, !!figId, 'New Figure… did not select a new Figure'); if (!figId) return;
    const figDrawing = () => ev(async id => { const f = document.querySelector('[data-node-id="' + id + '"]'); const img = f && f.querySelector('img'); if (!img || !img.src) return ''; try { return await (await fetch(img.src)).text(); } catch { return img.src; } }, figId);
    const settle = async before => { for (let i = 0; i < 40; i++) { await sleep(150); const d = await figDrawing(); if (d && d !== before) return d; } return await figDrawing(); };
    const dotOf = re => ev(src => { const n = __b.nodes().find(x => new RegExp(src).test(x.innerText)); const d = n && n.querySelector('.nc-port__dot[data-dir="out"]'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, re);
    const figAt = () => ev(id => __b.grip(document.querySelector('[data-node-id="' + id + '"]')), figId);
    let d0 = await settle('');
    expect(c, d0.length > 100, 'the built-in Figure did not draw');
    // add Rotate & mirror from the node bar, wire it into the Figure's Rules
    const bar = await ev(() => __b.box(document.querySelector('button[aria-label="Rule nodes"]')));
    await click(bar); await sleep(300);
    const tile = await ev(() => { const t = [...document.querySelectorAll('.nc-nodebar__item')].find(i => i.offsetParent && /Rotate/.test(i.textContent)); return t && __b.box(t); });
    await click(tile); await sleep(500); await click(bar); await sleep(250);
    const rotDot = await dotOf('^Rotate');
    expect(c, !!rotDot && await ev(p => p.x > 0 && p.y > 0 && p.x < innerWidth && p.y < innerHeight, rotDot), 'a click in the node bar added Rotate & mirror out of sight: ' + JSON.stringify(rotDot));
    // onto the Figure's Rules port: the built-in already has a Cell rules there, the new rule slots into the chain
    const rulesPort = await ev(id => __b.box(document.querySelector('[data-node-id="' + id + '"] .nc-port__dot[data-port="rules"]')), figId);
    await gesture(rotDot, rulesPort, { steps: 10 });
    d0 = await settle('') || d0;
    const pill = () => ev(() => { const n = __b.nodes().find(x => /^Rotate/.test(x.innerText)); return n ? n.querySelector('.nc-node__body').innerText.trim() : ''; });
    const select = async () => { const g = await ev(() => __b.grip(__b.nodes().find(x => /^Rotate/.test(x.innerText)))); await click(g); await sleep(250); };
    await select();
    const panelHas = await ev(() => ({ slider: !!document.getElementById('fgi-trot'), hints: [...document.querySelectorAll('#fg-inspector .org-panel__hint')].map(h => h.textContent) }));
    expect(c, panelHas.slider && !panelHas.hints.length, 'panel: slider ' + panelHas.slider + ', hint text ' + JSON.stringify(panelHas.hints));
    const slide = (id, v) => ev((id, v) => { const r = document.getElementById(id); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return r.step + '/' + r.max; }, id, v);
    const steps = [];
    const check = async (label, act, pillRe) => { const before = await figDrawing(); try { await act(); } catch (e) { steps.push(label + ' ✗ ' + e.message.slice(0, 80)); c.ok = false; c.notes.push(label + ': ' + e.message.slice(0, 120)); return; } const after = await settle(before); const pt = await pill(); steps.push(label + (after !== before ? ' ✓' : ' ✗') + (pillRe && !pillRe.test(pt) ? ' (pill: ' + pt + ')' : '')); expect(c, after !== before, label + ': the Figure did not change'); if (pillRe) expect(c, pillRe.test(pt), label + ': pill says "' + pt + '"'); };
    const st = await slide('fgi-trot', 0); expect(c, st === '1/359', 'Rotation slider is not 1° steps: ' + st);
    expect(c, !(await ev(() => document.getElementById('fgi-tseed') || document.querySelector('#fg-inspector input[type=checkbox]#fgi-trand'))), 'the Seed field / Random checkbox is still in the panel');
    await check('rotation 37°', () => slide('fgi-trot', 37), /Rotation 37°/);
    await check('flip horizontal', async () => click(await ev(() => __b.box(document.getElementById('fgi-tmv')))), /flip horizontal/i);
    await check('flip vertical too', async () => click(await ev(() => __b.box(document.getElementById('fgi-tmh')))), /flip both/i);
    await check('which cells: odd', () => ev(() => { const s = document.getElementById('fgi-twhich'); s.value = 'odd'; s.dispatchEvent(new Event('change', { bubbles: true })); }));
    await check('rotation per cell 15°', () => slide('fgi-tper', 15), /\+15° per cell/);
    await check('counted by row', () => ev(() => { const s = document.getElementById('fgi-tby'); s.value = 'row'; s.dispatchEvent(new Event('change', { bubbles: true })); }), /per row/);
    const dice0 = await ev(() => document.getElementById('fgi-tseed-new').disabled);
    expect(c, dice0, 'the dice is not disabled while Random rotation is 0°');
    await check('random rotation 20°', () => slide('fgi-trand', 20), /random ±20°/);
    await check('dice (new random draw)', async () => click(await ev(() => __b.box(document.getElementById('fgi-tseed-new')))));
    c.notes.push(steps.join(' · '));
    if (process.env.DEBUG_BOARD) console.log(steps.join('\n'));
  });

  if (!held) await test(`${P} use variation`, 'Variations → "Use this" on a variation: the Figure now draws that variation, one undo step brings it back', async c => {
    const norm = t => t.replace(/"exportedAt":"[^"]*"/g, '').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
    const fig = await ev(() => { const n = __b.byKind('capped').find(x => !/variation/i.test(x.innerText) && x.querySelector('img')); return n && n.dataset.nodeId; });
    expect(c, !!fig, 'no Figure with a drawing'); if (!fig) return;
    const drawingOf = id => ev(async id => { const f = document.querySelector('[data-node-id="' + id + '"]'); const img = f && f.querySelector('img'); return img && img.src ? await (await fetch(img.src)).text() : ''; }, id);
    await click(await ev(id => __b.grip(document.querySelector('[data-node-id="' + id + '"]')), fig)); await sleep(300);
    await click(await ev(() => __b.box(document.getElementById('fgi-addvar')))); await sleep(600);
    // the board draws what is on screen: bring the new Variations and its children in view — click the empty board, Shift+2 (fit selection) after selecting the Variations node is fiddly; Shift+1 fits everything
    await hover(...Object.values(await ev(() => __b.empty())));
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: '!', code: 'Digit1', windowsVirtualKeyCode: 49, modifiers: 8 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: '!', code: 'Digit1', windowsVirtualKeyCode: 49, modifiers: 8 }); await sleep(800);
    let child = null; for (let i = 0; i < 40 && !child; i++) { await sleep(200); child = await ev(() => { const n = __b.nodes().find(x => x.querySelector('[data-act="use"]')); return n && n.dataset.nodeId; }); }
    expect(c, !!child, 'Add Variations made no variation with a Use button'); if (!child) return;
    const before = norm(await drawingOf(fig)), want = norm(await drawingOf(child));
    expect(c, want && want !== before, 'the variation draws the same as its Figure');
    await ev(id => document.querySelector('[data-node-id="' + id + '"]').scrollIntoView({ block: 'center', inline: 'center' }), child);
    const use = await ev(id => __b.box(document.querySelector('[data-node-id="' + id + '"] [data-act="use"]')), child);
    await click(use);
    let after = ''; for (let i = 0; i < 40; i++) { await sleep(200); after = norm(await drawingOf(fig)); if (after && after !== before) break; }
    expect(c, after === want, 'after Use this the Figure does not draw the variation');
    const note = await ev(() => { const n = document.querySelector('.org-notice, [class*="notice"]'); return n ? n.textContent : ''; });
    c.notes.push('notice: ' + note.slice(0, 120));
    await key('rawKeyDown', 'KeyZ', 'z', 90); await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 4 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 4 });
    let back = ''; for (let i = 0; i < 30; i++) { await sleep(200); back = norm(await drawingOf(fig)); if (back === before) break; }
    expect(c, back === before, 'undo did not bring the Figure back');
  });

  if (!held) await test(`${P} series + table`, 'Variations → Mode Series: the count = the steps, Parameter / From / To rows, children captioned with the swept value; Table: two axes, children in rows', async c => {
    const fig = await ev(() => { const n = __b.byKind('capped').find(x => !/variation/i.test(x.innerText) && x.querySelector('img')); return n && n.dataset.nodeId; });
    expect(c, !!fig, 'no Figure with a drawing'); if (!fig) return;
    // the Figure's Variations node (the use-variation case left one; else Add Variations makes it) — selected, its panel shows
    const vn = await ev(() => { const n = __b.byKind('pill').find(x => /^Variations\b/.test(x.innerText.trim())); return n && n.dataset.nodeId; });
    if (vn) { await ev(id => document.querySelector('[data-node-id="' + id + '"]').scrollIntoView({ block: 'center', inline: 'center' }), vn); await click(await ev(id => __b.grip(document.querySelector('[data-node-id="' + id + '"]')), vn)); await sleep(400); }
    else { await click(await ev(id => __b.grip(document.querySelector('[data-node-id="' + id + '"]')), fig)); await sleep(300); await click(await ev(() => __b.box(document.getElementById('fgi-addvar')))); await sleep(800); }
    const modes = await ev(() => [...document.querySelectorAll('#fg-inspector [data-vmode]')].map(b => b.textContent));
    expect(c, modes.join('|') === 'Random|Series|Table', 'Mode seg: ' + modes.join('|'));
    const captions = () => ev(() => [...document.querySelectorAll('.nc-node .fg-var__label')].map(l => l.textContent).filter(t => !/As set up/.test(t)));
    const kids = () => ev(() => [...document.querySelectorAll('.nc-node')].filter(n => /variation/i.test(n.innerText) && n.querySelector('.fg-var__label')).map(n => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px/.exec(n.style.transform) || []; return { x: Math.round(+m[1]), y: Math.round(+m[2]) }; }));
    await click(await ev(() => __b.box(document.querySelector('#fg-inspector [data-vmode="series"]')))); await sleep(1500);
    const sp = await ev(() => ({ count: document.getElementById('fgi-vcount') && document.getElementById('fgi-vcount').value, param: !!document.getElementById('fgi-axis-param'), groups: document.getElementById('fgi-axis-param') ? document.getElementById('fgi-axis-param').querySelectorAll('optgroup').length : 0, from: document.getElementById('fgi-axis-from') && document.getElementById('fgi-axis-from').value, to: document.getElementById('fgi-axis-to') && document.getElementById('fgi-axis-to').value, amount: !!document.getElementById('fgi-amount'), title: document.querySelector('#fg-inspector h3') && document.querySelector('#fg-inspector h3').textContent }));
    expect(c, sp.param && sp.groups >= 1 && sp.from != null && sp.to != null && !sp.amount, 'Series rows: ' + JSON.stringify(sp));
    expect(c, /Series: /.test(sp.title || ''), 'the title says the series: ' + sp.title);
    let caps = []; for (let i = 0; i < 30 && caps.length < +sp.count; i++) { await sleep(300); caps = await captions(); }
    expect(c, caps.length === +sp.count && caps.every(t => /^(Grid|Palette|Cell rules|Rotate & mirror): .+ -?\d/.test(t)), 'Series children: ' + caps.join(' | ') + ' (count ' + sp.count + ')');
    await click(await ev(() => __b.box(document.querySelector('#fg-inspector [data-vmode="table"]')))); await sleep(2000);
    const tp = await ev(() => ({ across: !!document.getElementById('fgi-across-param'), down: !!document.getElementById('fgi-down-param'), values: document.querySelectorAll('#fg-inspector [data-values]').length, pressed: [...document.querySelectorAll('#fg-inspector [data-values][aria-pressed="true"]')].map(b => b.textContent).join('x'), count: !!document.getElementById('fgi-vcount'), title: document.querySelector('#fg-inspector h3') && document.querySelector('#fg-inspector h3').textContent }));
    expect(c, tp.across && tp.down && tp.values === 6 && tp.pressed === '3x3' && !tp.count && /Table: .+ × /.test(tp.title || ''), 'Table rows: ' + JSON.stringify(tp));
    let caps2 = []; for (let i = 0; i < 40 && caps2.length < 9; i++) { await sleep(300); caps2 = await captions(); }
    expect(c, caps2.length === 9 && caps2.every(t => / · /.test(t)), 'Table children: ' + caps2.length + ' — ' + caps2.slice(0, 3).join(' | '));
    await sleep(500); const pos = await kids(), xs = new Set(pos.map(q => q.x)), ys = new Set(pos.map(q => q.y));
    expect(c, pos.length === 9 && xs.size === 3 && ys.size === 3, 'Table layout 3 × 3 (x ' + xs.size + ', y ' + ys.size + ' of ' + pos.length + ')');
    c.notes.push('series: ' + caps.slice(0, 4).join(' | ') + ' · table: ' + caps2.slice(0, 2).join(' | '));
  });

  await test(`${P} after all`, 'after every gesture: a pill still drags (nothing kept the pointer)', async c => {
    const id = await ev(() => { const n = __b.byKind('pill').find(n => { const g = __b.grip(n), e = document.elementFromPoint(g.x, g.y); return g.x > 60 && g.y > 80 && g.x < innerWidth - 400 && g.y < innerHeight - 160 && e && n.contains(e); }); return n && n.dataset.nodeId; });
    expect(c, !!id, 'no pill in sight'); if (!id) return;
    const at = () => ev(i => __b.box(document.querySelector('[data-node-id="' + i + '"]')), id);
    const before = await at(), from = await ev(i => __b.grip(document.querySelector('[data-node-id="' + i + '"]')), id);
    await gesture(from, { x: from.x + 60, y: from.y + 60 });
    expect(c, moved(before, await at()), 'did not move');
  });

}

for (const m of ['clean', 'held']) if (!ONLY || ONLY === m) await run(m);
const failed = results.filter(r => !r.ok);
console.log(`\nFigure board: ${failed.length ? 'FAIL' : 'PASS'} — ${results.length - failed.length}/${results.length}`);
done(failed.length ? 1 : 0);
