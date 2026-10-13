#!/usr/bin/env node
// FVS step boards — the Element, Component and Symbol boards (fvs/js/16-board.js + 18-step-boards.js) with REAL
// mouse and keyboard input (Input.dispatch*Event), run twice: a clean mouse, and a mouse that reports its side "back"
// button held the whole time (the Figure board's chordShim case, scripts/test-figure-board.mjs).
// Pan, zoom, fit, sheet and group drag, the group ring; add / switch / rename / delete an Element; parts marquee; the single views and their Esc order; Component Edit's cell marquee, second click → Choose content,
// a rail drop, Delete; Clear board (held) on both boards; the Symbol's variations on the board.
// Usage: scripts/test-fvs-boards.sh [--only clean|held] [--theme light|dark]
// No dependencies: serves the repo on 127.0.0.1, headless Chrome over CDP, never writes to the repo.
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
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/test-fvs-boards.mjs'); process.exit(2); }

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
setTimeout(() => { console.log('FVS boards test: ERROR — timed out after 6 min'); done(1); }, 6 * 60 * 1000);

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

const dblclick = async p => {
  await hover(p.x, p.y);
  for (const n of [1, 2]) { await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1 | (held ? 8 : 0), clickCount: n }); await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: held ? 8 : 0, clickCount: n }); }
  await sleep(200);
};
const wheel = async (p, dy) => { await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: dy }); await sleep(120); };
// a press held for `ms` (Clear board's hold to confirm), then released on the spot
const hold = async (p, ms = 1200) => { await hover(p.x, p.y); await raw('mousePressed', p.x, p.y, 'left', 1); await sleep(ms); await raw('mouseReleased', p.x, p.y, 'left', 0); await sleep(250); };
const press = async (code, keyName, vk, mods = 0) => { await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: keyName, windowsVirtualKeyCode: vk, modifiers: mods }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: vk, modifiers: mods }); await sleep(150); };
const type = async text => { await cdp('Input.insertText', { text }); await sleep(80); };
const SHIFT = 8, META = 4;

// ── in-page probes ──
const PAGE = `(() => {
  const w = window; if (w.__t) return;
  const F = w.__fvs, B = t => F.boards[t];
  const box = el => { if (typeof el === 'string') el = document.querySelector(el); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, t: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const view = t => ({ zoom: B(t).zp.zoom, x: B(t).zp.pan.x, y: B(t).zp.pan.y });
  const sheetAt = (t, id) => { const s = B(t).sheets[id]; return s ? { x: s.p.x, y: s.p.y } : null; };
  // an empty spot of the board: the stage itself under the point
  const empty = t => { const st = B(t).stage, r = st.getBoundingClientRect(); for (let y = r.bottom - 120; y > r.top + 60; y -= 29) for (let x = r.right - 60; x > r.left + 120; x -= 37) { const e = document.elementFromPoint(x, y); if (e === st || e === B(t).board) return { x, y }; } return null; };
  const captured = () => [...document.querySelectorAll('*')].filter(e => e.hasPointerCapture && e.hasPointerCapture(1)).length;
  const leftovers = t => { const out = [], st = B(t).stage; ['nc-stage--dragging', 'nc-stage--pan'].forEach(c => { if (st.classList.contains(c)) out.push(c); }); if (B(t).board.classList.contains('panning')) out.push('board.panning'); if (document.querySelector('.fvs-board-marquee')) out.push('marquee left'); if (document.querySelector('.fvs-rail-ghost')) out.push('ghost left'); if (captured()) out.push('pointer capture held'); return out; };
  w.__t = { F, B, box, view, sheetAt, empty, leftovers };
})()`;

let failures = 0, passes = 0;
const results = [];
function check(mode, name, ok, detail = '') { results.push({ mode, name, ok, detail }); if (ok) passes++; else failures++; }

async function openFvs() {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  // storage cleared from a page that is not FVS: leaving FVS saves its Element list (pagehide), after a clear made there
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/vercel.json` }); await sleep(500);
  await ev(() => { try { localStorage.clear(); } catch {} });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/fvs/` }); await sleep(800);
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await ev(t => { document.documentElement.dataset.theme = t; }, THEME);
  await sleep(600);
  await cdp('Runtime.evaluate', { expression: PAGE });
  consoleErrors = [];
}
const step = async t => { await click(await ev(t => __t.box(`#tier-tabs [data-tier="${t}"]`), t)); await sleep(700); };

async function elementBoard(mode) {
  const C = (n, ok, d) => check(mode, 'Element · ' + n, ok, d);
  await step('element');
  // landing: zoom on the first Element only — its sheet fills most of the stage height (Diego, Oct 11)
  const land = await ev(() => { const st = __t.B('element').stage.getBoundingClientRect(), el = document.querySelector('#board-live-element').getBoundingClientRect(); const vw = document.querySelector('#board-live-views').getBoundingClientRect(), lb = document.querySelector('#board-live-views > .fvs-board-sheet__label').getBoundingClientRect(), top = Math.min(vw.top, el.top, lb.top); return { inside: el.top >= st.top - 1 && el.bottom <= st.bottom + 1, share: el.height / st.height, dx: Math.round((el.left + el.right) / 2 - (st.left + st.right) / 2), dy: Math.round((top + el.bottom) / 2 - (st.top + st.bottom) / 2) }; });
  C('landing on Element zooms on the first Element, centred on the stage', land.inside && land.share > 0.5 && Math.abs(land.dx) <= 2 && Math.abs(land.dy) <= 2, JSON.stringify(land));
  // zoom: the wheel zooms around the cursor
  const e0 = await ev(() => __t.empty('element'));
  const v0 = await ev(() => __t.view('element'));
  await wheel(e0, -240);
  const v1 = await ev(() => __t.view('element'));
  C('wheel zooms the board', v1.zoom > v0.zoom * 1.05, `${v0.zoom.toFixed(3)} → ${v1.zoom.toFixed(3)}`);
  // fit: Shift+1
  await press('Digit1', '!', 49, SHIFT);
  const v2 = await ev(() => __t.view('element'));
  C('Shift+1 fits the whole board (wider than the landing zoom)', v2.zoom < v0.zoom - 0.05, `zoom ${v2.zoom.toFixed(3)} (landing ${v0.zoom.toFixed(3)})`);
  // pan: Space-drag, middle-button drag
  const e1 = await ev(() => __t.empty('element'));
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
  const cur = await gesture(e1, { x: e1.x - 120, y: e1.y - 80 }, { mid: () => getComputedStyle(document.elementFromPoint(innerWidth / 2, innerHeight / 2)).cursor });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 }); await sleep(100);
  const v3 = await ev(() => __t.view('element'));
  C('Space+drag pans', Math.abs(v3.x - v2.x + 120) < 3 && Math.abs(v3.y - v2.y + 80) < 3, `pan Δ ${(v3.x - v2.x).toFixed(0)},${(v3.y - v2.y).toFixed(0)} · cursor mid-pan ${cur}`);
  await gesture(e1, { x: e1.x + 120, y: e1.y + 80 }, { button: 'middle' });
  const v4 = await ev(() => __t.view('element'));
  C('middle-button drag pans', Math.abs(v4.x - v3.x - 120) < 3, `pan Δ ${(v4.x - v3.x).toFixed(0)}`);
  // a group drag by its name: the Views and the Element move together, the position is kept
  const id0 = await ev(() => __t.F.state.activeElement);
  const lab = await ev(() => __t.box('#board-live-views > .fvs-board-sheet__label'));
  const p0 = await ev(id => [__t.sheetAt('element', 'el-' + id), __t.sheetAt('element', 'vw-' + id)], id0);
  await gesture({ x: lab.l + 12, y: lab.y }, { x: lab.l + 112, y: lab.y + 60 });
  const p1 = await ev(id => [__t.sheetAt('element', 'el-' + id), __t.sheetAt('element', 'vw-' + id), JSON.parse(localStorage.getItem('organica.fvs.board.element') || '{}').pos], id0);
  const dz = await ev(() => __t.view('element').zoom);
  const moved = (a, b) => Math.round((b.x - a.x) * dz) === 100 || Math.abs((b.x - a.x) * dz - 100) < 2;
  C('dragging the name moves the group', moved(p0[0], p1[0]) && moved(p0[1], p1[1]), `Element Δx ${((p1[0].x - p0[0].x) * dz).toFixed(1)}px, Views Δx ${((p1[1].x - p0[1].x) * dz).toFixed(1)}px`);
  C('the group position is saved', !!(p1[2] && p1[2]['el-' + id0] && p1[2]['el-' + id0].x === p1[0].x));
  C('one ring round the selected group', await ev(() => document.querySelectorAll('.fvs-board-ring').length === 1));
  // a click on the bare board clears the selection
  await click(await ev(() => __t.empty('element')));
  C('a click on the board clears the selection', await ev(() => !document.querySelector('.fvs-board-ring') && __t.B('element').selected.size === 0));
  // New element: a second Element, edited at once
  await click(await ev(() => { const b = document.getElementById('btn-board-new-element'); b.scrollIntoView(); return __t.box(b); }));
  await sleep(500);
  const s1 = await ev(() => ({ n: __t.F.state.elements.length, active: __t.F.state.activeElement, statics: document.querySelectorAll('.fvs-board-el').length }));
  C('New element adds an Element and edits it', s1.n === 2 && s1.active !== id0 && s1.statics === 1, JSON.stringify(s1));
  const blank1 = await ev(() => ({ type: document.getElementById('sel-seed-type').value, d: (__t.F.state.freehand.raw || '') + ((__t.F.state.freehand.seed || {}).d || '') }));
  C('New element is a fresh Arc (Freehand needs work first — Diego, Oct 11)', blank1.type === 'arc', JSON.stringify(blank1));
  // change the new one's shape, then switch back by clicking the other Element
  await ev(() => { const s = document.getElementById('sel-seed-type'); const o = [...s.options].find(o => !o.disabled && o.value !== s.value && ['circle', 'square', 'triangle', 'star'].includes(o.value)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(700);
  const typeNew = await ev(() => document.getElementById('sel-seed-type').value);
  await ev(() => document.querySelector('.fvs-board-el').scrollIntoView());
  await press('Digit1', '!', 49, SHIFT);
  await click(await ev(() => __t.box('.fvs-board-el')));
  await sleep(700);
  const s2 = await ev(() => ({ active: __t.F.state.activeElement, type: document.getElementById('sel-seed-type').value, other: __t.F.state.elements.find(e => e.id !== __t.F.state.activeElement).seed.type }));
  C('a click on another Element edits it', s2.active === id0 && s2.type !== typeNew && s2.other === typeNew, JSON.stringify(s2) + ' new=' + typeNew);
  // rename: double-click the name, type, Enter; empty = made again
  await dblclick(await ev(() => { const l = document.querySelector('#board-live-views > .fvs-board-sheet__label'); return { x: __t.box(l).l + 14, y: __t.box(l).y }; }));
  const hasInput = await ev(() => !!document.querySelector('#board-live-views .fvs-board-sheet__input'));
  if (hasInput) { await ev(() => { document.querySelector('#board-live-views .fvs-board-sheet__input').select(); }); await type('Test name'); await press('Enter', 'Enter', 13); }
  const nm = await ev(() => { const e = __t.F.state.elements.find(e => e.id === __t.F.state.activeElement); return { name: e.name, custom: e.custom, label: document.querySelector('#board-live-views > .fvs-board-sheet__label').textContent }; });
  C('double-click the name renames it', hasInput && nm.name === 'Test name' && nm.custom && nm.label.startsWith('Test name'), JSON.stringify(nm));
  // Delete on the other (selected) group removes it — with the focus left on a panel slider first (Diego's case, Oct 11:
  // the slider kept the keyboard and Delete / ⌘Z did nothing)
  await ev(() => { const r = document.getElementById('rg-element-scale'); r.scrollIntoView({ block: 'center' }); });
  await click(await ev(() => __t.box('#rg-element-scale')));
  C('(the panel slider has the focus)', await ev(() => document.activeElement && document.activeElement.id === 'rg-element-scale'));
  await click(await ev(() => __t.box('.fvs-board-views-static .fvs-board-sheet__label, .fvs-board-sheet.fvs-board-views:not(#board-live-views) > .fvs-board-sheet__label')));
  await press('Backspace', 'Backspace', 8);
  C('Delete removes a selected Element', await ev(() => __t.F.state.elements.length === 1 && !document.querySelector('.fvs-board-el')));
  await press('KeyZ', 'z', 90, META);
  const back = await ev(() => ({ n: __t.F.state.elements.length, statics: document.querySelectorAll('.fvs-board-el').length, name: document.querySelector('#board-live-views > .fvs-board-sheet__label').textContent }));
  C('⌘Z brings a deleted Element back (the one edited keeps its name)', back.n === 2 && back.statics === 1 && back.name.startsWith('Test name'), JSON.stringify(back));
  await click(await ev(() => __t.box('.fvs-board-sheet.fvs-board-views:not(#board-live-views) > .fvs-board-sheet__label')));
  await press('Delete', 'Delete', 46);
  // the list is the user's: in the store
  C('the list is kept in the store', await ev(() => { const o = Organica.store('fvs-elements').read(); return Object.keys(o).filter(k => k !== 'board').length === 1 && o.board && o.board.active === __t.F.state.activeElement; }));
  // parts: Edit, divide, marquee
  await ev(() => { const s = document.getElementById('sel-seed-type'); s.value = 'roundedrect'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(400);
  await ev(() => { __t.F.enterElementEdit(); const s = document.getElementById('sel-part-method'); const o = [...s.options].find(o => !o.disabled && o.value !== 'none'); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(400);
  await ev(() => document.getElementById('btn-part-inks').click());
  await sleep(400);
  await press('Digit2', '@', 50, SHIFT);
  const fr = await ev(() => __t.box('#element-svg svg'));
  const nParts = await ev(() => document.querySelectorAll('#element-svg [data-part]').length);
  await gesture({ x: fr.l + 4, y: fr.t + 4 }, { x: fr.l + fr.w * 0.3, y: fr.t + fr.h * 0.3 });
  const picked = await ev(() => { const L = __t.F.state.layers, ids = new Set(__t.F.partSel); if (L.items[L.active] && L.items[L.active].part) ids.add(L.items[L.active].id); return [...ids]; });
  C('a marquee picks the parts it touches', nParts >= 2 && picked.length >= 1 && picked.length < nParts + 1, `${picked.length} of ${nParts} parts`);
  // Delete on the picked parts: they leave the Element; ⌘Z brings them back; the last part stays (O-67 e)
  const np = () => ev(() => ({ layers: __t.F.state.layers.items.filter(l => l.part).length, drawn: document.querySelectorAll('#element-svg [data-part]').length, removed: (__t.F.state.layers.parts.removed || []).length }));
  const q0 = await np();
  await press('Delete', 'Delete', 46); await sleep(300);
  const q1 = await np();
  C('Delete on picked parts removes them from the Element', q1.layers === q0.layers - picked.length && q1.drawn === q0.drawn - picked.length && q1.removed === picked.length, JSON.stringify({ q0, q1, picked: picked.length }));
  await press('KeyZ', 'z', 90, META); await sleep(300);
  const q2 = await np();
  C('⌘Z brings the deleted parts back', q2.layers === q0.layers && q2.drawn === q0.drawn && q2.removed === 0, JSON.stringify(q2));
  await gesture({ x: fr.l + 2, y: fr.t + 2 }, { x: fr.r - 2, y: fr.b - 2 });
  await press('Backspace', 'Backspace', 8); await sleep(300);
  const q3 = await np();
  C('Delete with every part picked keeps them (one part stays)', q3.layers === q0.layers, JSON.stringify(q3));
  C('no Inks tray on the board (Diego, Oct 11)', await ev(() => !document.getElementById('board-inks') && !__t.B('element').sheets.inks));
  C('no gesture state left (Element)', (await ev(() => __t.leftovers('element'))).length === 0, (await ev(() => __t.leftovers('element'))).join(', '));
  // No Element Edit mode (Diego, Oct 11: edit on the board): Division and parts work on the board; double-click / Enter =
  // the single view only (a view, Back to board at the top), Esc returns.
  C('no Edit pencil and no Edit Back', await ev(() => !document.querySelector('.fvs-thumb-edit') && !document.getElementById('btn-element-edit-exit')));
  const onb = await ev(() => ({ single: document.querySelector('.tier-view[data-tier="element"]').classList.contains('is-single'), division: !document.getElementById('parts-block').hidden, hint: !document.getElementById('element-edit-toolbar').hidden && document.getElementById('element-edit-hint').textContent }));
  C('on the board: the Division section, no mode to enter, no parts hint', !onb.single && onb.division && !onb.hint, JSON.stringify(onb));
  // a click on a part picks it — and not the Element's group — so Delete takes the part; ⌘Z brings it back
  const pt = await ev(() => { const g = document.querySelector('#element-svg [data-part]'), r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: g.getAttribute('data-part') }; });
  const nb = await ev(() => __t.F.state.layers.items.filter(l => l.part).length);
  await click(pt);
  const pk = await ev(() => ({ sel: [...__t.F.partSel], board: [...__t.B('element').selected] }));
  C('a click on a part picks the part, not the Element group', pk.sel.length === 1 && pk.sel[0] === pt.id && pk.board.length === 0, JSON.stringify(pk));
  await press('Delete', 'Delete', 46); await sleep(300);
  const na = await ev(() => ({ parts: __t.F.state.layers.items.filter(l => l.part).length, els: __t.F.state.elements.length }));
  await press('KeyZ', 'z', 90, META); await sleep(300);
  const nz = await ev(() => __t.F.state.layers.items.filter(l => l.part).length);
  C('Delete after a part click deletes the part (not the Element); ⌘Z restores', na.parts === nb - 1 && nz === nb, JSON.stringify({ nb, na, nz }));
  // the single view: double-click; Back to board at the top; Esc returns
  await dblclick(await ev(() => { const r = __t.box('#element-frame'); return { x: r.l + 10, y: r.t + 10 }; }));
  const sv = await ev(() => ({ single: document.querySelector('.tier-view[data-tier="element"]').classList.contains('is-single'), back: !!document.getElementById('btn-element-board-back').offsetParent, top: document.getElementById('btn-element-board-back').getBoundingClientRect().top < document.getElementById('seed-preview').getBoundingClientRect().top, focus: document.activeElement && document.activeElement.id }));
  C('double-click opens the single view: Back to board at the top, focused', sv.single && sv.back && sv.top && sv.focus === 'btn-element-board-back', JSON.stringify(sv));
  await press('Escape', 'Escape', 27); await sleep(300);
  C('Esc goes back to the board', await ev(() => !document.querySelector('.tier-view[data-tier="element"]').classList.contains('is-single')));
  await ev(() => document.getElementById('board-live-element').focus());
  await press('Enter', 'Enter', 13); await sleep(300);
  const ke = await ev(() => document.querySelector('.tier-view[data-tier="element"]').classList.contains('is-single'));
  C('Enter on the focused Element opens the single view (the keyboard path)', ke);
  await click(await ev(() => __t.box('#btn-element-board-back')));
  await sleep(300);
  const b1 = await ev(() => document.querySelector('.tier-view[data-tier="element"]').classList.contains('is-single'));
  C('Back to board returns to the board', !b1);
  // Clear board (held): one starting Element is left
  await press('Digit1', '!', 49, SHIFT);
  await click(await ev(() => { const b = document.getElementById('btn-board-new-element'); return __t.box(b); }));
  await sleep(400);
  const before = await ev(() => __t.F.state.elements.length);
  await hold(await ev(() => __t.box('#btn-board-clear-element')));
  await sleep(400);
  const after = await ev(() => ({ n: __t.F.state.elements.length, dis: document.getElementById('btn-board-clear-element').disabled }));
  const blank2 = await ev(() => document.getElementById('sel-seed-type').value);
  C('Clear board (held) leaves one fresh Arc, and Clear board is then off', before === 2 && after.n === 1 && blank2 === 'arc' && after.dis, `${before} → ${after.n}, ${blank2}, then disabled=${after.dis}`);
  await click(await ev(() => __t.box('#btn-board-undo-element')));
  const un = await ev(() => ({ n: __t.F.state.elements.length, dis: document.getElementById('btn-board-undo-element').disabled }));
  C('Undo (floatbar) brings the cleared Elements back', un.n === 2, JSON.stringify(un));
  // a blank Freehand being edited (nothing drawn): ⌘Z is the board's, not the drawing's (Diego, Oct 11)
  await ev(() => { const s = document.getElementById('sel-seed-type'); s.value = 'freehand'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(500);
  const bl = await ev(() => ({ type: document.getElementById('sel-seed-type').value, n: __t.F.state.elements.length }));
  await click(await ev(() => __t.box('.fvs-board-sheet.fvs-board-views:not(#board-live-views) > .fvs-board-sheet__label')));
  await press('Delete', 'Delete', 46);
  const del = await ev(() => __t.F.state.elements.length);
  await press('KeyZ', 'z', 90, META);
  const und = await ev(() => __t.F.state.elements.length);
  C('with a blank Freehand in edit, Delete removes the other and ⌘Z brings it back', bl.type === 'freehand' && bl.n === 2 && del === 1 && und === 2, JSON.stringify(bl) + ` → ${del} → ${und}`);
  // Delete on the Element being edited (Diego's case, Oct 11: a New element he didn't want): editing moves on
  const ed0 = await ev(() => __t.F.state.activeElement);
  await click(await ev(() => __t.box('#board-live-views > .fvs-board-sheet__label')));
  await press('Delete', 'Delete', 46);
  const ed1 = await ev(() => ({ n: __t.F.state.elements.length, active: __t.F.state.activeElement }));
  await press('KeyZ', 'z', 90, META);
  const ed2 = await ev(() => ({ n: __t.F.state.elements.length, active: __t.F.state.activeElement }));
  C('Delete removes the Element being edited (editing moves on), ⌘Z brings it back', ed1.n === 1 && ed1.active !== ed0 && ed2.n === 2 && ed2.active === ed0, JSON.stringify({ ed0, ed1, ed2 }));
  // the last Element stays
  await click(await ev(() => __t.box('.fvs-board-sheet.fvs-board-views:not(#board-live-views) > .fvs-board-sheet__label')));
  await press('Delete', 'Delete', 46);
  await click(await ev(() => __t.box('#board-live-views > .fvs-board-sheet__label')));
  await press('Delete', 'Delete', 46);
  C('the last Element cannot be deleted', await ev(() => __t.F.state.elements.length === 1));
}

async function componentBoard(mode) {
  const C = (n, ok, d) => check(mode, 'Component · ' + n, ok, d);
  await step('component');
  await sleep(600);
  const n0 = await ev(() => __t.F.state.components.length);
  C('the gallery sits on the board', n0 > 0 && await ev(() => !!document.querySelector('#board-gallery #gallery .fvs-thumb-wrap')), n0 + ' candidates');
  const v0 = await ev(() => __t.view('component'));
  await wheel(await ev(() => __t.empty('component')), 240);
  C('wheel zooms the board', (await ev(() => __t.view('component'))).zoom < v0.zoom * 0.95);
  await press('Digit1', '!', 49, SHIFT);
  // a saved Element in the library, for the rail drop
  // (the Element in edit is the blank one New element made: give it a shape first — a blank Element has nothing to save)
  await ev(() => { const s = document.getElementById('sel-seed-type'); if (s.value === 'freehand') { s.value = 'circle'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await sleep(500);
  const savedType = await ev(() => { const n = __t.F.saveElementVariant(0, false, false, '0°', 'Board test'); return n && __t.F.ELEMENT_LIB.read()[n].seed.type; });
  // double-click a candidate = Component Edit, in its single view
  await dblclick(await ev(() => __t.box('#gallery .fvs-thumb-wrap svg')));
  await sleep(500);
  const ed = await ev(() => ({ edit: __t.F.state.componentEditMode, single: document.querySelector('.tier-view[data-tier="component"]').classList.contains('is-single'), back: document.getElementById('btn-component-edit-exit').textContent.trim() }));
  C('double-click a candidate opens Component Edit', ed.edit && ed.single && ed.back === 'Back to board', JSON.stringify(ed));
  // marquee over two cells
  const cells = await ev(() => [...document.querySelectorAll('#component-edit-frame [data-cell-index]')].map(c => __t.box(c)));
  if (cells.length >= 2) {
    const fr = await ev(() => __t.box('#component-edit-frame svg'));
    await gesture({ x: fr.l + 3, y: cells[0].y }, { x: cells[1].x, y: cells[1].y + 4 });
    const pk = await ev(() => [...__t.F.cePicked]);
    C('a marquee picks the cells it touches', pk.length >= 2, JSON.stringify(pk));
    // a second click on a picked cell = Choose content, Seeds only
    await click(cells[0]);
    const ov = await ev(() => { const o = document.getElementById('symbol-content-overlay'); return { open: o.style.display !== 'none', seeds: o.classList.contains('is-seeds-only'), comps: getComputedStyle(document.getElementById('content-sec-components')).display }; });
    C('a second click on a picked cell opens Choose content (Seeds only)', ov.open && ov.seeds && ov.comps === 'none', JSON.stringify(ov));
    await press('Escape', 'Escape', 27);
    const after = await ev(() => ({ ov: document.getElementById('symbol-content-overlay').style.display !== 'none', edit: __t.F.state.componentEditMode }));
    C('Esc closes Choose content first', !after.ov && after.edit, JSON.stringify(after));
    // a saved Element dragged from the rail onto a cell
    await ev(() => { if (!__t.F.railIsOpen()) document.getElementById('btn-rail').click(); });
    await sleep(500);
    const tile = await ev(() => { const t = document.querySelector('#fvs-rail-panel .fvs-library-item[data-rail-kind="element"][data-rail-name="Board test"]'); return t ? __t.box(t) : null; });
    const free = await ev(() => { const c = [...document.querySelectorAll('#component-edit-frame [data-cell-index]')].find(c => !__t.F.cePicked.has(+c.dataset.cellIndex)); return c ? { ...__t.box(c), i: +c.dataset.cellIndex } : null; });
    if (tile && free) {
      await gesture(tile, free, { steps: 14 });
      const got = await ev(i => { const c = __t.F.state.componentEditCells[i]; return c && c.content ? c.content.seedType : null; }, free.i);
      C('a rail Element dropped on a cell fills it', !!savedType && got === savedType, 'cell ' + free.i + ': ' + got + ' (saved ' + savedType + ')');
      // Delete returns the picked cells to the Component's own Element
      await ev(i => { __t.F.cePicked = new Set([i]); }, free.i);
      await press('Delete', 'Delete', 46);
      C('Delete returns a cell to the Component\'s Element', await ev(i => !__t.F.state.componentEditCells[i].content, free.i));
    } else C('a rail Element dropped on a cell fills it', false, 'tile ' + !!tile + ' cell ' + !!free);
    await ev(() => { if (__t.F.railIsOpen()) document.getElementById('btn-rail').click(); });
    await sleep(300);
  } else C('Component Edit has cells', false);
  await press('Escape', 'Escape', 27);
  C('Esc leaves Component Edit, back to the board', await ev(() => !__t.F.state.componentEditMode && !document.querySelector('.tier-view[data-tier="component"]').classList.contains('is-single')));
  // the keyboard path into Component Edit (no pencil): Enter on the selected candidate
  await click(await ev(() => __t.box('#gallery .fvs-thumb-wrap:nth-child(2) > button')));
  await ev(() => document.querySelector('#gallery .fvs-thumb-wrap:nth-child(2) > button').focus());
  await press('Enter', 'Enter', 13); await sleep(500);
  const ke = await ev(() => ({ edit: !!__t.F.state.componentEditMode, label: document.querySelector('#gallery .fvs-thumb-wrap > button') && document.querySelector('#gallery .fvs-thumb-wrap > button').getAttribute('aria-label') }));
  C('Enter on the selected candidate opens Component Edit (the keyboard path)', ke.edit, JSON.stringify(ke));
  await press('Escape', 'Escape', 27); await sleep(400);
  C('no gesture state left (Component)', (await ev(() => __t.leftovers('component'))).length === 0, (await ev(() => __t.leftovers('component'))).join(', '));
  // Clear board (held), then ⌘Z
  await hold(await ev(() => __t.box('#btn-board-clear-component')));
  const cl = await ev(() => ({ n: __t.F.state.components.length, dis: document.getElementById('btn-board-clear-component').disabled }));
  await press('KeyZ', 'z', 90, META);
  const un = await ev(() => __t.F.state.components.length);
  C('Clear board (held) empties the gallery, ⌘Z brings it back', cl.n === 0 && cl.dis && un === n0, `${n0} → ${cl.n} (disabled ${cl.dis}) → ${un}`);
}

async function symbolBoard(mode) {
  const C = (n, ok, d) => check(mode, 'Symbol · ' + n, ok, d);
  await step('symbol');
  await sleep(500);
  C('the Symbol sheet and an empty Variations sheet', await ev(() => !!document.querySelector('#board-symbol #symbol-frame svg') && document.getElementById('board-variations').classList.contains('is-empty')));
  C('no Variations button in the floatbar', await ev(() => !document.getElementById('btn-sug-dock')));
  // variations: shown as sheets, a click puts one on the Symbol
  await ev(() => { const F = __t.F; F.state.symbolSuggestions = [0, 1, 2].map(i => ({ cells: F.state.symbolCells.map(c => ({ ...c })), label: 'test ' + i, score: { edges: 0 } })); F.renderSuggestGallery(0); });
  await press('Digit1', '!', 49, SHIFT);
  const items = await ev(() => document.querySelectorAll('#fvs-sug-panel .fvs-suggest__item').length);
  C('Suggest\'s variations are sheets beside the Symbol', items === 3 && await ev(() => !document.getElementById('board-variations').classList.contains('is-empty')), items + ' items');
  await click(await ev(() => __t.box('#fvs-sug-panel .fvs-suggest__item:nth-child(3)')));
  C('a click on a variation makes it current', await ev(() => document.querySelector('#fvs-sug-panel .fvs-suggest__item:nth-child(3)').classList.contains('is-current')));
  // the % labels: placed again after a zoom, at the same size on screen
  await ev(() => { __t.F.state.symbolView.guides = true; __t.F.renderSymbol(); });
  await wheel(await ev(() => __t.empty('symbol')), -240);
  await sleep(200);
  const lb = await ev(() => { const w = document.getElementById('sym-track-labels'), z = __t.view('symbol').zoom; if (!w) return null; const m = new DOMMatrix(getComputedStyle(w).transform); const l = w.querySelector('.sym-track-label--col'), svg = document.querySelector('#symbol-frame svg').getBoundingClientRect(); return { scale: m.a, inv: 1 / z, above: l ? l.getBoundingClientRect().bottom <= svg.top + 1 : false }; });
  C('the % labels follow the zoom', lb && Math.abs(lb.scale - lb.inv) < 0.01 && lb.above, JSON.stringify(lb));
  C('no gesture state left (Symbol)', (await ev(() => __t.leftovers('symbol'))).length === 0, (await ev(() => __t.leftovers('symbol'))).join(', '));
}

// A Palette per Element (O-67 c): each Element keeps its inks / Colour by / Paper; a new one is black on white; the
// others' Palettes are in "Pick from a palette"; a reload keeps them; Clear board leaves the default.
async function elementPalettes(mode) {
  const C = (n, ok, d) => check(mode, 'Palette · ' + n, ok, d);
  await step('element');
  const setInk = hex => ev(h => { const i = document.querySelector('#fvs-palette input[type="color"]'); i.value = h; i.dispatchEvent(new Event('input', { bubbles: true })); }, hex);
  const live = () => ev(() => ({ colors: __t.F.state.colors.slice(), paper: __t.F.state.paperColor, active: __t.F.state.activeElement }));
  await setInk('#d01c1c'); await sleep(600);
  const e1 = await live();
  await press('Digit1', '!', 49, SHIFT);   // the whole board: New element in sight
  await click(await ev(() => { const b = document.getElementById('btn-board-new-element'); return __t.box(b); }));
  await sleep(600);
  const e2 = await live();
  C('New element starts black on white', e2.active !== e1.active && e2.colors.length === 1 && e2.colors[0] === '#000000' && e2.paper === '#ffffff', JSON.stringify(e2));
  await setInk('#1c3cd0'); await sleep(600);
  const otherFill = await ev(() => document.querySelector('.fvs-board-el').innerHTML.toLowerCase().includes('#d01c1c'));
  C('the other Element is drawn in its own Palette', otherFill && (await live()).colors[0] === '#1c3cd0');
  // Pick from a palette lists the other Element's Palette
  await ev(() => { const b = [...document.querySelectorAll('#fvs-palette button')].pop(); b.click(); });
  await sleep(300);
  const listed = await ev(() => [...document.querySelectorAll('.color-swatch')].some(c => getComputedStyle(c).backgroundColor === 'rgb(208, 28, 28)'));
  C('Pick from a palette offers the other Element\'s Palette', listed);
  await press('Escape', 'Escape', 27);
  // back to the first Element: its Palette comes back
  await click(await ev(() => __t.box('.fvs-board-el')));
  await sleep(700);
  const back = await live();
  C('switching Element switches the Palette', back.active === e1.active && back.colors[0] === '#d01c1c', JSON.stringify(back));
  // a reload keeps both
  await sleep(600);
  await cdp('Page.reload'); await sleep(800);
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await sleep(600); await cdp('Runtime.evaluate', { expression: PAGE });
  await step('element');
  const rl = await ev(() => ({ colors: __t.F.state.colors.slice(), pals: __t.F.state.elements.map(e => e.palette && e.palette.colors[0]) }));
  C('a reload keeps each Element\'s Palette', rl.colors[0] === '#d01c1c' && rl.pals.includes('#d01c1c') && rl.pals.includes('#1c3cd0'), JSON.stringify(rl));
  // Clear board: the Element left is black on white
  await hold(await ev(() => __t.box('#btn-board-clear-element')));
  await sleep(500);
  const cl = await live();
  C('Clear board leaves the default Palette', cl.colors.length === 1 && cl.colors[0] === '#000000' && cl.paper === '#ffffff', JSON.stringify(cl));
  // an Element saved before Phase B (no palette) loads black on white
  const old = await ev(() => { const o = Organica.store('fvs-elements').read(); Object.values(o).forEach(v => { if (v && v.seed) delete v.palette; }); Organica.store('fvs-elements').write(o); return Object.keys(o).length; });
  await cdp('Page.reload'); await sleep(800);
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await sleep(600); await cdp('Runtime.evaluate', { expression: PAGE });
  const ol = await ev(() => ({ colors: __t.F.state.colors.slice(), paper: __t.F.state.paperColor }));
  C('an Element saved without a Palette loads black on white', old > 0 && ol.colors[0] === '#000000' && ol.paper === '#ffffff', JSON.stringify(ol));
}

// One "Generated components" area per Element (O-67 d): each Element's Components, drawn with it; a click in another
// area edits that Element and selects the Component; Generate only touches the edited one; Clear board clears all, ⌘Z
// restores; a reload keeps them; a double-click on an area's Element thumbnail edits it on the Element board.
async function generatedPerElement(mode) {
  const C = (n, ok, d) => check(mode, 'Generated · ' + n, ok, d);
  await step('element');
  const setType = t => ev(async t => { const s = document.getElementById('sel-seed-type'); s.value = t; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 400)); }, t);
  await setType('star');
  for (const t of ['cross', 'drop']) { await press('Digit1', '!', 49, SHIFT); await click(await ev(() => __t.box('#btn-board-new-element'))); await sleep(500); await setType(t); }
  await ev(() => { const i = document.querySelector('#fvs-palette input[type="color"]'); i.value = '#c0392b'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(500);
  await step('component'); await sleep(1200);
  const areas = () => ev(() => [...document.querySelectorAll('#canvas-wrap .tier-view[data-tier="component"] [data-sheet]')].filter(s => s.dataset.sheet === 'gallery' || s.dataset.sheet.startsWith('gl-')).map(s => ({ id: s.dataset.sheet, label: (s.querySelector('.fvs-board-sheet__label') || {}).textContent, n: s.querySelectorAll('.fvs-thumb').length, red: s.querySelector('.fvs-thumb') ? s.querySelector('.fvs-thumb').innerHTML.toLowerCase().includes('#c0392b') : null, el: !!s.querySelector('.fvs-board-gallery__el-box svg') })));
  const a0 = await areas();
  C('one area per Element, each with its Element thumbnail and its Components', a0.length === 3 && a0.every(a => a.n > 0 && a.el && / · Generated components/.test(a.label)) && a0.filter(a => /editing/.test(a.label)).length === 1, JSON.stringify(a0));
  C('each area is drawn in its own Element\'s Palette', a0.find(a => a.id === 'gallery').red === true && a0.filter(a => a.id !== 'gallery').every(a => a.red === false), JSON.stringify(a0.map(a => [a.id, a.red])));
  // Generate on the edited Element: the others keep theirs
  const before = await ev(() => JSON.stringify(__t.F.state.elements.filter(e => e.id !== __t.F.state.activeElement).map(e => e.gallery)));
  await ev(() => { document.getElementById('sel-rule').value = 'random'; document.getElementById('sel-rule').dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('btn-generate').click(); });
  await sleep(800);
  const after = await ev(() => JSON.stringify(__t.F.state.elements.filter(e => e.id !== __t.F.state.activeElement).map(e => e.gallery)));
  C('Generate touches only the edited Element\'s Components', before === after);
  // a click on a Component of another area: that Element is edited, that Component selected
  const target = await ev(() => { const s = [...document.querySelectorAll('[data-sheet^="gl-"]')][0], b = s.querySelectorAll('button[data-k]')[2]; return { ...__t.box(b), el: s.dataset.sheet.slice(3) }; });
  await click(target); await sleep(700);
  const sw = await ev(() => ({ active: __t.F.state.activeElement, sel: __t.F.state.selectedId, third: __t.F.state.components[2] && __t.F.state.components[2].id, explicit: __t.F.state.selectionExplicit }));
  C('a click in another area edits its Element and selects that Component', sw.active === target.el && sw.sel === sw.third && sw.explicit, JSON.stringify(sw));
  // Clear board: every area; ⌘Z brings them all back
  await hold(await ev(() => __t.box('#btn-board-clear-component'))); await sleep(600);
  const cl = await areas();
  C('Clear board clears every Element\'s Components', cl.every(a => a.n === 0), JSON.stringify(cl.map(a => a.n)));
  await click(await ev(() => __t.empty('component')));
  await press('KeyZ', 'z', 90, META); await sleep(800);
  const un = await areas();
  C('⌘Z brings every area back', un.length === 3 && un.every(a => a.n > 0), JSON.stringify(un.map(a => a.n)));
  // a reload keeps each Element's set
  const ids = await ev(() => { const o = {}; __t.F.state.elements.forEach(e => { o[e.id] = e.id === __t.F.state.activeElement ? __t.F.state.components.map(c => c.id).join() : (e.gallery && e.gallery.components || []).map(c => c.id).join(); }); return o; });
  await sleep(800);
  await cdp('Page.reload'); await sleep(800);
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await sleep(600); await cdp('Runtime.evaluate', { expression: PAGE });
  await step('component'); await sleep(1000);
  const ids2 = await ev(() => { const o = {}; __t.F.state.elements.forEach(e => { o[e.id] = e.id === __t.F.state.activeElement ? __t.F.state.components.map(c => c.id).join() : (e.gallery && e.gallery.components || []).map(c => c.id).join(); }); return o; });
  C('a reload keeps each Element\'s Components', JSON.stringify(ids) === JSON.stringify(ids2), JSON.stringify({ ids, ids2 }).slice(0, 300));
  // the cell shape belongs to the edited Element: changing it redraws only its own area, never the others'
  const other = await ev(() => { const s = [...document.querySelectorAll('[data-sheet^="gl-"]')][0]; return { id: s.dataset.sheet, html: s.querySelector('.fvs-board-gallery__grid').innerHTML.length + ':' + s.querySelectorAll('.fvs-thumb').length }; });
  await ev(() => document.querySelector('#fb-cell-shape [data-cell="triangle"]').click()); await sleep(900);
  const cs = await ev(id => { const s = document.querySelector(`[data-sheet="${id}"]`); return { html: s.querySelector('.fvs-board-gallery__grid').innerHTML.length + ':' + s.querySelectorAll('.fvs-thumb').length, live: __t.F.state.cellShape }; }, other.id);
  // a shape changed and Component opened at once: the area's label follows the made name (Oct 12)
  await step('element');
  await ev(async () => { const s = document.getElementById('sel-seed-type'); s.value = 'lens'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await step('component'); await sleep(900);
  const lab = await ev(() => document.querySelector('#board-gallery > .fvs-board-sheet__label').textContent);
  C('the area label follows a shape changed just before opening Component', /^Lens · Generated components/.test(lab), lab);
  C('a cell shape change redraws only the edited Element\'s Components', cs.live === 'triangle' && cs.html === other.html, JSON.stringify({ other, cs }));
  await click(await ev(id => __t.box(document.querySelector(`[data-sheet="${id}"] button[data-k]`)), other.id)); await sleep(700);
  const back = await ev(() => ({ shape: __t.F.state.cellShape, pressed: document.querySelector('#fb-cell-shape [aria-pressed="true"]') && document.querySelector('#fb-cell-shape [aria-pressed="true"]').dataset.cell }));
  C('editing the other Element shows its own cell shape', back.shape === 'square' && back.pressed === 'square', JSON.stringify(back));
  // a double-click on an area's Element thumbnail: that Element, edited on the Element board
  const eb = await ev(() => { const s = [...document.querySelectorAll('[data-sheet^="gl-"]')][0]; return { ...__t.box(s.querySelector('.fvs-board-gallery__el-box')), el: s.dataset.sheet.slice(3) }; });
  await dblclick(eb); await sleep(800);
  const ge = await ev(() => ({ tier: __t.F.state.activeTier, active: __t.F.state.activeElement }));
  C('double-click on an area\'s Element thumbnail edits that Element on the Element board', ge.tier === 'element' && ge.active === eb.el, JSON.stringify(ge));
}

// The working Symbol is kept across reloads (Diego, Oct 11): grid, cells, pool, settings — not the colours (the edited
// Element's Palette stays its own).
async function symbolKept(mode) {
  const C = (n, ok, d) => check(mode, 'Symbol kept · ' + n, ok, d);
  await step('component'); await sleep(1200);
  await ev(() => __t.F.saveAllComponentsToLibrary()); await sleep(600);
  await step('symbol'); await sleep(800);
  await ev(() => document.getElementById('btn-symbol-generate').click()); await sleep(4000);
  const sig = () => ev(() => ({ cells: (__t.F.state.symbolCells || []).length, names: (__t.F.state.symbolCells || []).map(c => c.componentName || c.seedType || '').join(','), grid: JSON.stringify(__t.F.state.symbolGrid && __t.F.state.symbolGrid.canvas && __t.F.state.symbolGrid.canvas.fvsFrame || null) }));
  const s0 = await sig();
  await ev(() => { const i = document.querySelector('#fvs-palette input[type="color"]'); i.value = '#2e86c1'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(900);
  await cdp('Page.reload'); await sleep(800);
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await sleep(600); await cdp('Runtime.evaluate', { expression: PAGE });
  await step('symbol'); await sleep(1200);
  const s1 = await sig();
  C('a reload keeps the working Symbol (grid, cells)', s0.cells > 0 && s1.cells === s0.cells && s1.names === s0.names && s1.grid === s0.grid, JSON.stringify({ s0: s0.cells, s1: s1.cells, same: s1.names === s0.names }));
  const ink = await ev(() => __t.F.state.colors[0]);
  C('the Symbol does not bring colours back over the edited Element\'s Palette', ink === '#2e86c1', ink);
  C('the Symbol is drawn after the reload', await ev(() => document.querySelectorAll('#symbol-frame svg *').length > 10));
}

// Layer colour variants on a divided Element (Diego, Oct 12 — a Polygon in 8 parts × 6 inks gave millions of combinations):
// off by default; on = one variant per ink (every part's ink moved along the Palette), not every combination.
async function partVariants(mode) {
  const C = (n, ok, d) => check(mode, 'Part variants · ' + n, ok, d);
  await step('element');
  await ev(async () => {
    const F = window.__fvs, sl = ms => new Promise(r => setTimeout(r, ms));
    const s = document.getElementById('sel-seed-type'); s.value = 'polygon'; s.dispatchEvent(new Event('change', { bubbles: true })); await sl(300);
    F.state.colors = ['#4775e1', '#2b14d7', '#ffdbfc', '#f9dfe2', '#00e61b', '#888888']; F.buildPalette();
    const m = document.getElementById('sel-part-method'); const o = [...m.options].find(o => o.value === 'fan') || [...m.options].find(o => !o.disabled && o.value !== 'none');
    m.value = o.value; m.dispatchEvent(new Event('change', { bubbles: true })); await sl(400);
    F.state.layers.items.forEach((l, i) => { if (l.part) l.ink = i % 6; }); F.layersChanged(); await sl(300);
  });
  await step('component'); await sleep(800);
  const gen = () => ev(async () => { const r = document.getElementById('sel-rule'); r.value = 'pinwheel'; r.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('btn-generate').click(); await new Promise(r => setTimeout(r, 700)); return { n: __t.F.state.components.length, inks: __t.F.state.components.filter(c => c.layerInks).length, parts: __t.F.state.layers.items.filter(l => l.part).length, on: document.getElementById('chk-layer-inks').checked }; });
  const off = await gen();
  C('a divided Element: colour variants off by default (geometry only)', off.parts >= 6 && !off.on && off.inks === 0, JSON.stringify(off));
  await ev(() => { const c = document.getElementById('chk-layer-inks'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  const on = await gen();
  C('switched on: one variant per ink, not every combination', on.on && on.n === off.n * 6 && on.inks === on.n, JSON.stringify({ off: off.n, on: on.n }));
  const turn = await ev(() => { const a = __t.F.state.components[0].layerInks, b = __t.F.state.components[1].layerInks; return Object.keys(a).every(k => typeof a[k] !== 'number' || b[k] === (a[k] + 1) % 6); });
  C('each variant moves every part\'s ink along the Palette', turn);
  C('the switch is kept on the Element\'s Division', await ev(() => !!__t.F.state.layers.parts.layerInks));
  // an Element with plain layers keeps every combination
  await step('element');
  const plain = await ev(async () => { const F = window.__fvs, sl = ms => new Promise(r => setTimeout(r, ms)); const m = document.getElementById('sel-part-method'); m.value = 'none'; m.dispatchEvent(new Event('change', { bubbles: true })); await sl(300); F.state.layers = null; const s = document.getElementById('sel-seed-type'); s.value = 'triangle'; s.dispatchEvent(new Event('change', { bubbles: true })); await sl(200); F.state.colors = ['#111111', '#e8321e', '#1f5fd6']; F.buildPalette(); F.addLayer(); await sl(300); const c = document.getElementById('chk-layer-inks'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); return F.layerInkComboCount(); });
  C('plain layers still give every combination ((3+1)² = 16)', plain === 16, String(plain));
}

// Colour groups (Diego, Oct 12): layers that change colour together by one rule — colour only.
async function colourGroups(mode) {
  const C = (n, ok, d) => check(mode, 'Colour group · ' + n, ok, d);
  await step('element');
  await ev(async () => {
    const F = window.__fvs, sl = ms => new Promise(r => setTimeout(r, ms));
    const s = document.getElementById('sel-seed-type'); s.value = 'polygon'; s.dispatchEvent(new Event('change', { bubbles: true })); await sl(300);
    F.state.colors = ['#4775e1', '#2b14d7', '#ffdbfc', '#f9dfe2', '#00e61b', '#888888']; F.buildPalette();
    const m = document.getElementById('sel-part-method'); const o = [...m.options].find(o => o.value === 'fan') || [...m.options].find(o => !o.disabled && o.value !== 'none');
    m.value = o.value; m.dispatchEvent(new Event('change', { bubbles: true })); await sl(400);
    F.state.layers.items.forEach((l, i) => { if (l.part) l.ink = i % 6; }); F.layersChanged(); await sl(200);
  });
  C('the old Ungroup reads "Make plain layers"', await ev(() => document.getElementById('btn-part-ungroup').textContent === 'Make plain layers'));
  const rowBtn = k => ev(k => __t.box(document.querySelectorAll('#layers-list .fvs-layer__main')[k]), k);
  // details (the parts disclosure) open so the rows are clickable
  await ev(() => { const d = document.querySelector('#layers-list details'); if (d) d.open = true; });
  await click(await rowBtn(0)); await sleep(200);
  C('Group is off with one layer selected, no hint (Diego, Oct 12)', await ev(() => document.getElementById('btn-layer-group').getAttribute('aria-disabled') === 'true' && document.getElementById('layer-group-hint').hidden));
  C('the parts are rows of the list, no Division header', await ev(() => !document.querySelector('#layers-list details, #layers-list .org-disclosure') && document.querySelectorAll('#layers-list .org-layer-card').length >= 6));
  await click(await rowBtn(1), META); await sleep(150); await click(await rowBtn(2), META); await sleep(200);
  // Shift-click = a range; then back to the ⌘ picks below
  await click(await rowBtn(0)); await sleep(150); await click(await rowBtn(4), SHIFT); await sleep(200);
  C('Shift-click selects the range of rows (5)', await ev(() => __t.F.partSel.size === 5), String(await ev(() => __t.F.partSel.size)));
  const ux = await ev(() => ({ hint: document.getElementById('layers-hint').textContent, place: getComputedStyle(document.getElementById('layer-place-block')).display, note: !!document.querySelector('.fvs-layer-place-hint'), tint: getComputedStyle(document.querySelector('#layers-list .org-layer-card.is-picked')).backgroundColor, sel: (() => { const p = document.querySelector('#element-svg .fvs-part.is-sel > path'); if (!p) return null; const cs = getComputedStyle(p); return { filter: cs.filter, w: cs.strokeWidth }; })() }));
  C('5 picked: the header says "5 selected", the one-layer settings step aside, rows tinted', /6 · 5 selected/.test(ux.hint) && ux.place === 'none' && ux.note && ux.tint !== 'rgba(0, 0, 0, 0)', JSON.stringify(ux));
  C('a picked part on the board: a crisp outline, no blurred halo', ux.sel && ux.sel.filter === 'none' && ux.sel.w === '2px', JSON.stringify(ux.sel));
  await click(await rowBtn(0)); await sleep(150); await click(await rowBtn(1), META); await sleep(150); await click(await rowBtn(2), META); await sleep(200);
  C('⌘-click picks rows one by one (3)', await ev(() => __t.F.partSel.size === 3), String(await ev(() => __t.F.partSel.size)));
  C('Group is on with three selected', await ev(() => document.getElementById('btn-layer-group').getAttribute('aria-disabled') === 'false'));
  const inks0 = await ev(() => JSON.stringify(__t.F.state.layers.items.map(l => l.ink)));
  await ev(() => document.getElementById('btn-layer-group').click()); await sleep(300);
  const g = await ev(() => { const L = __t.F.state.layers, id = Object.keys(L.groups || {})[0], ms = L.items.filter(l => l.group === id); return { id, n: ms.length, chips: document.querySelectorAll('#layers-list .fvs-layer__group').length, rows: document.querySelectorAll('#layers-list .org-layer-card.in-group').length, joins: document.querySelectorAll('#layers-list .org-layer-card.group-joins').length, bar: getComputedStyle(document.querySelector('#layers-list .org-layer-card.in-group')).boxShadow, noBlock: !document.getElementById('layer-group-block') }; });
  C('Group: a colour group, a chip and a coloured bar on each member, the bars joined', g.n === 3 && g.chips === 3 && g.rows === 3 && g.joins === 2 && /inset/.test(g.bar) && g.noBlock, JSON.stringify(g));
  C('grouping leaves the Element\'s inks as they are', inks0 === await ev(() => JSON.stringify(__t.F.state.layers.items.map(l => l.ink))));
  // the chip: hover lights the group (rows + parts), a click picks the whole group
  await click(await rowBtn(5)); await sleep(200);
  const chip = await ev(() => __t.box(document.querySelector('#layers-list .fvs-layer__group')));
  await hover(chip.x, chip.y); await sleep(150);
  const hl = await ev(() => ({ rows: document.querySelectorAll('#layers-list .org-layer-card.is-group-hl').length, parts: document.querySelectorAll('#element-svg .is-group-hl').length, label: document.querySelector('#layers-list .fvs-layer__group').getAttribute('aria-label') }));
  C('hovering a group chip lights its members (rows + parts)', hl.rows === 3 && hl.parts === 3 && hl.label === 'Select Colour group 1', JSON.stringify(hl));
  await click(chip); await sleep(250);
  C('a click on the chip picks the whole group', await ev(() => { const L = __t.F.state.layers, id = Object.keys(L.groups)[0]; const ms = L.items.filter(l => l.group === id).map(l => l.id); return __t.F.partSel.size === ms.length && ms.every(m => __t.F.partSel.has(m)); }));
  // One ink per part skips the members
  const before = await ev(() => JSON.stringify(__t.F.state.layers.items.filter(l => l.group).map(l => [l.ink, l.tone])));
  await ev(() => document.getElementById('btn-part-inks').click()); await sleep(300);
  C('One ink per part leaves the group alone', before === await ev(() => JSON.stringify(__t.F.state.layers.items.filter(l => l.group).map(l => [l.ink, l.tone]))));
  // the rules live on the Component step and shape the colour variants
  await step('component'); await sleep(800);
  const rules = await ev(() => { const h = document.getElementById('colour-group-rules'); return { shown: !h.hidden, selects: h.querySelectorAll('select[data-group]').length, opts: [...(h.querySelector('select') || { options: [] }).options].map(o => o.textContent) }; });
  const off = await ev(() => ({ dis: document.querySelector('#colour-group-rules select').disabled, hint: document.querySelector('#colour-group-rules .panel-hint').textContent }));
  C('the rules are disabled (not hidden) while the colour variants are off', off.dis && /Turn on Layer colour variants/.test(off.hint), JSON.stringify(off));
  C('Component: one rule per colour group (Same ink · Tonal · Shift together)', rules.shown && rules.selects === 1 && rules.opts.join() === 'Same ink,Tonal,Shift together', JSON.stringify(rules));
  const gen = rule => ev(async rule => { const sel = document.querySelector('#colour-group-rules select'); sel.value = rule; sel.dispatchEvent(new Event('change', { bubbles: true })); const c = document.getElementById('chk-layer-inks'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } const r = document.getElementById('sel-rule'); r.value = 'pinwheel'; r.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('btn-generate').click(); await new Promise(r => setTimeout(r, 700)); const L = __t.F.state.layers, id = Object.keys(L.groups)[0], ms = L.items.map((l, i) => ({ l, i })).filter(x => x.l.group === id).sort((a, b) => b.i - a.i).map(x => x.l.id); return __t.F.state.components.map(c => ms.map(m => c.layerInks[m])); }, rule);
  const same = await gen('same');
  C('Same ink: every variant keeps the group one ink', same.length > 0 && same.every(v => new Set(v.map(x => JSON.stringify(x))).size === 1), JSON.stringify(same[0]));
  const tonal = await gen('tonal');
  C('Tonal: every variant gives the group one ink, top lightest → darker', tonal.length > 0 && tonal.every(v => v.every(x => x && typeof x === 'object') && new Set(v.map(x => x.ink)).size === 1 && v[0].tone < v[1].tone && v[1].tone < v[2].tone), JSON.stringify(tonal[0]));
  const thumbsTonal = await ev(() => __t.F.state.components.length === document.querySelectorAll('#gallery .fvs-thumb').length);
  C('the Tonal variants are drawn', thumbsTonal);
  // saved with the Element
  await step('element'); await sleep(400);
  C('the group (with its rule) is saved with the Element', await ev(() => { const sd = __t.F.seedForSnapshot(); const id = sd.groups && Object.keys(sd.groups)[0]; return !!(id && sd.groups[id].rule === 'tonal' && sd.layers.filter(l => l.group).length === 3); }));
  // Ungroup: the layers keep their colours
  const keep = await ev(() => JSON.stringify(__t.F.state.layers.items.map(l => [l.ink, l.tone])));
  await ev(() => { const L = __t.F.state.layers, id = Object.keys(L.groups)[0]; __t.F.partSel = new Set(L.items.filter(l => l.group === id).map(l => l.id)); __t.F.layersChanged(); }); await sleep(200);
  await ev(() => document.getElementById('btn-layer-ungroup').click()); await sleep(300);
  C('Ungroup: no group left, every layer keeps its colour', await ev(k => !__t.F.state.layers.groups && !__t.F.state.layers.items.some(l => l.group) && JSON.stringify(__t.F.state.layers.items.map(l => [l.ink, l.tone])) === k, keep));
  // plain layers: a group is one unit in every combination
  const plain = await ev(async () => { const F = window.__fvs, sl = ms => new Promise(r => setTimeout(r, ms)); const m = document.getElementById('sel-part-method'); m.value = 'none'; m.dispatchEvent(new Event('change', { bubbles: true })); await sl(300); F.state.layers = null; const s = document.getElementById('sel-seed-type'); s.value = 'triangle'; s.dispatchEvent(new Event('change', { bubbles: true })); await sl(200); F.state.colors = ['#111111', '#e8321e', '#1f5fd6']; F.buildPalette(); F.addLayer(); await sl(200); F.addLayer(); await sl(200); const L = F.state.layers; L.groups = { gx: { name: 'Colour group 1', rule: 'same', ink: 1 } }; L.items[1].group = 'gx'; L.items[2].group = 'gx'; F.applyColourGroup(L, 'gx', 3); const c = document.getElementById('chk-layer-inks'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); const combos = F.layerInkCombos(); return { count: F.layerInkComboCount(), combos: combos.length, uniform: combos.every(c => c[L.items[1].id] === c[L.items[2].id]) }; });
  C('plain layers: the group is one unit (3 × (3+1) = 12, the members always together)', plain.count === 12 && plain.combos === 12 && plain.uniform, JSON.stringify(plain));
}

// Layer by layer + Clip to cell (Diego, Oct 12 — a square moved out of its cell covered the neighbour's upper layers).
async function layerOrder(mode) {
  const C = (n, ok, d) => check(mode, 'Layer order · ' + n, ok, d);
  await step('element');
  await ev(async () => {
    const F = window.__fvs, sl = ms => new Promise(r => setTimeout(r, ms));
    F.state.colors = ['#ff00aa', '#0033ff', '#00cc44']; F.buildPalette();
    const s = document.getElementById('sel-seed-type'); s.value = 'roundedrect'; s.dispatchEvent(new Event('change', { bubbles: true })); await sl(200);
    F.addLayer(); await sl(200);
    const L = F.state.layers; L.items[0].ink = 0; L.items[0].place = { mx: 0, my: -64, scale: 0.6, rotate: 0 }; L.items[1].ink = 1;
    F.layersChanged(); await sl(200);
  });
  await step('component'); await sleep(600);
  const r = await ev(async () => {
    const F = window.__fvs, sel = document.getElementById('sel-rule'); sel.value = 'pinwheel'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const c = document.getElementById('chk-layer-inks'); if (c.checked) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }
    document.getElementById('btn-generate').click(); await new Promise(r => setTimeout(r, 500));
    const it = F.buildComponentItems(F.state.components[0], F.getGrid()), svg = F.buildComponentSVG(it, F.getSeed(), F.frameSize(F.getGrid()));
    const lowLast = svg.lastIndexOf('#ff00aa'), highFirst = svg.indexOf('#0033ff');
    return { lowLast, highFirst, ok: lowLast > 0 && highFirst > lowLast };
  });
  C('every cell\'s lower layer is drawn before any cell\'s upper layer', r.ok, JSON.stringify(r));
  await ev(() => { const c = document.getElementById('chk-component-clip'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
  const k = await ev(() => { const F = window.__fvs, it = F.buildComponentItems(F.state.components[0], F.getGrid()), svg = F.buildComponentSVG(it, F.getSeed(), F.frameSize(F.getGrid())); const cv = document.createElement('canvas'); cv.width = cv.height = 400; let png = true; try { F.drawComponentCanvas(cv.getContext('2d'), it, F.getSeed(), F.frameSize(F.getGrid())); } catch (e) { png = String(e); } return { clips: (svg.match(/<clipPath id="cellcut-/g) || []).length, cells: it.length, png }; });
  C('Clip to cell: every cell (and layer pass) cut to its frame, the PNG draws too', k.clips === k.cells * 2 && k.png === true, JSON.stringify(k));
  C('Clip to cell is kept with the Element\'s Generated components', await ev(() => { const F = window.__fvs; F.state.elements.length; return document.getElementById('chk-component-clip').checked && F.state.componentClip === true; }));
  // the Symbol draws a saved Component the same way: layer by layer across ALL its cells (no Overlap), SVG = PNG
  await ev(() => { const c = document.getElementById('chk-component-clip'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await ev(() => __t.F.saveAllComponentsToLibrary()); await sleep(500);
  await step('symbol'); await sleep(800);
  await ev(() => document.getElementById('btn-symbol-generate').click()); await sleep(4000);
  const sy = await ev(async () => {
    const F = window.__fvs, svg = F.buildSymbolSVG();
    const lowLast = svg.lastIndexOf('#ff00aa'), highFirst = svg.indexOf('#0033ff');
    const W = 300, img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const a = document.createElement('canvas'); a.width = a.height = W; a.getContext('2d').drawImage(img, 0, 0, W, W);
    const grid = F.getSymbolGrid(), fr = F.symbolFrame(grid), b = document.createElement('canvas'); b.width = fr.w; b.height = fr.h; F.drawSymbolCanvas(b.getContext('2d'));
    const c = document.createElement('canvas'); c.width = c.height = W; c.getContext('2d').drawImage(b, 0, 0, W, W);
    const da = a.getContext('2d').getImageData(0, 0, W, W).data, db = c.getContext('2d').getImageData(0, 0, W, W).data;
    let diff = 0; for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 60) diff++;
    return { cells: (F.state.symbolCells || []).length, lowLast, highFirst, ok: lowLast > 0 && highFirst > lowLast, diffShare: +(diff / (W * W)).toFixed(4) };
  });
  C('Symbol: every cell\'s lower layer before any upper layer (no Overlap)', sy.cells > 0 && sy.ok, JSON.stringify(sy));
  // Blend Normal (interleave — Diego's Symbol): each Component still drawn layer by layer inside itself
  const il = await ev(() => { const F = window.__fvs; F.state.symbolOverlap = { ...F.state.symbolOverlap, blend: 'normal' }; const svg = F.buildSymbolSVG(); const cells = [...svg.matchAll(/<g data-cell-index="\d+"[^>]*>([\s\S]*?)(?=<g data-cell-index=|<\/svg>)/g)].map(m => m[1]).filter(m => m.includes('#ff00aa') && m.includes('#0033ff')); const ok = cells.length > 0 && cells.every(m => m.lastIndexOf('#ff00aa') < m.indexOf('#0033ff')); const cv = document.createElement('canvas'); const fr = F.symbolFrame(F.getSymbolGrid()); cv.width = fr.w; cv.height = fr.h; let png = true; try { F.drawSymbolCanvas(cv.getContext('2d')); } catch (e) { png = String(e); } F.state.symbolOverlap = { ...F.state.symbolOverlap, blend: 'under' }; return { cells: cells.length, ok, png }; });
  C('Symbol, Blend Normal (interleave): each Component layer by layer inside itself, the PNG draws', il.ok && il.png === true, JSON.stringify(il));
  // the SVG and the canvas already differed by ~2.7 % of pixels before (anti-aliased edges, scaling) — checked by eye: the same picture
  C('Symbol: the PNG (canvas) draws as the SVG (under 5 % of pixels differ — edges)', sy.diffShare < 0.05, JSON.stringify(sy));
}

for (const mode of ['clean', 'held']) {
  if (ONLY && ONLY !== mode) continue;
  held = false;
  await openFvs();
  held = mode === 'held';
  try { await elementBoard(mode); } catch (e) { check(mode, 'Element board ran', false, e.message); }
  try { await componentBoard(mode); } catch (e) { check(mode, 'Component board ran', false, e.message); }
  try { await symbolBoard(mode); } catch (e) { check(mode, 'Symbol board ran', false, e.message); }
  if (mode === 'clean') { await openFvs(); try { await elementPalettes(mode); } catch (e) { check(mode, 'Palette ran', false, e.message); } }
  if (mode === 'clean') { await openFvs(); try { await generatedPerElement(mode); } catch (e) { check(mode, 'Generated ran', false, e.message); } }
  if (mode === 'clean') { await openFvs(); try { await symbolKept(mode); } catch (e) { check(mode, 'Symbol kept ran', false, e.message); } }
  if (mode === 'clean') { await openFvs(); try { await partVariants(mode); } catch (e) { check(mode, 'Part variants ran', false, e.message); } }
  if (mode === 'clean') { await openFvs(); try { await colourGroups(mode); } catch (e) { check(mode, 'Colour group ran', false, e.message); } }
  if (mode === 'clean') { await openFvs(); try { await layerOrder(mode); } catch (e) { check(mode, 'Layer order ran', false, e.message); } }
  check(mode, 'console clean', !consoleErrors.length, consoleErrors.slice(0, 4).join(' | '));
}
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} [${r.mode}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`\nFVS boards test (${THEME}): ${failures ? 'FAIL' : 'PASS'} — ${passes}/${passes + failures}`);
done(failures ? 1 : 0);
