#!/usr/bin/env node
// LOCAL dev test (Oct 10, 2026 — not committed): the stage-shadow variants of design-system/_stage-shadow.css on the
// Figure board — none (today) · offset (A, hard offset, no blur) · rest (C, the soft shadow only at rest) — timed with
// real mouse and wheel input: a 3 s node drag, a 3 s pan, 10 zoom steps, at 4× CPU slow-down and 2× pixel density.
// Per variant × gesture: frames, p50 / p95 frame time, frames over 33 ms, Paint / Raster / GPU ms (trace), layers.
// Usage: node --experimental-websocket scripts/_test-stage-shadow.mjs [--theme light|dark] [--cpu 4] [--runs 2]
//        [--variants none,offset,rest] [--json FILE]
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const THEME = arg('theme', 'light'), CPU = +arg('cpu', 4), VARIANTS = arg('variants', 'none,offset,rest').split(','), RUNS = +arg('runs', 2);

const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/_test-stage-shadow.mjs'); process.exit(2); }

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
setTimeout(() => { console.log('Stage shadow test: ERROR — timed out after 12 min'); done(1); }, 12 * 60 * 1000);

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


// ── the gestures: real mouse / wheel input on the Figure board ──
const raw = (type, x, y, button, buttons, extra = {}) => cdp('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: type === 'mouseMoved' ? 0 : 1, ...extra });
async function drag(from, to, button, ms) {
  const BIT = { left: 1, middle: 4 }, steps = Math.round(ms / 16);
  await raw('mouseMoved', from.x, from.y, 'none', 0); await sleep(30);
  await raw('mousePressed', from.x, from.y, button, BIT[button]);
  for (let i = 1; i <= steps; i++) { const t = i / steps, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t; await raw('mouseMoved', x, y, button, BIT[button]); await sleep(16); }
  await raw('mouseReleased', to.x, to.y, button, 0);
}
async function zoom(at, steps) { for (let i = 0; i < steps; i++) { await raw('mouseWheel', at.x, at.y, 'none', 0, { deltaX: 0, deltaY: i < steps / 2 ? -120 : 120 }); await sleep(120); } }

// frame times: rAF timestamps inside the page while a gesture runs
const FRAMES_ON = () => { window.__ft = []; let last = 0; const f = t => { if (last) window.__ft.push(t - last); last = t; if (window.__ftOn) requestAnimationFrame(f); }; window.__ftOn = true; requestAnimationFrame(f); return 1; };
const FRAMES_OFF = () => { window.__ftOn = false; return window.__ft.slice(); };
let trace = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Tracing.dataCollected') trace.push(...m.params.value); });
const KEYS = ['Paint', 'RasterTask', 'GPUTask', 'UpdateLayoutTree', 'Layerize'];
async function measure(fn) {
  trace = [];
  await cdp('Tracing.start', { traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'viz', 'gpu', 'toplevel'] }, transferMode: 'ReportEvents' });
  await ev(FRAMES_ON);
  await fn();
  await sleep(400);   // the release (C: the shadow comes back) inside the window
  const ft = await ev(FRAMES_OFF);
  const fin = new Promise(r => { const h = e => { if (JSON.parse(e.data).method === 'Tracing.tracingComplete') { ws.removeEventListener('message', h); r(); } }; ws.addEventListener('message', h); });
  await cdp('Tracing.end'); await fin;
  const sum = {}; trace.forEach(t => { if (t.ph === 'X' && t.dur && KEYS.includes(t.name)) sum[t.name] = (sum[t.name] || 0) + t.dur / 1000; });
  const s = ft.slice().sort((a, b) => a - b), q = p => s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
  return { frames: s.length, p50: q(0.5), p95: q(0.95), long: s.filter(x => x > 33.4).length, ...sum };
}

async function boot() {
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('LayerTree.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await cdp('Page.navigate', { url: `http://localhost:${port}/fvs/` });
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await ev(() => { try { localStorage.clear(); } catch {} });
  await cdp('Page.reload');
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await ev(t => { document.documentElement.dataset.theme = t;
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/design-system/_stage-shadow.css'; document.head.append(css);
    const js = document.createElement('script'); js.src = '/design-system/_stage-shadow.js'; document.head.append(js); }, THEME);
  const fb = await ev(() => { const r = document.querySelector('button[aria-label="Figure"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await raw('mouseMoved', fb.x, fb.y, 'none', 0); await raw('mousePressed', fb.x, fb.y, 'left', 1); await raw('mouseReleased', fb.x, fb.y, 'left', 0);   // the Figure tier loads on demand
  for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(() => !!document.getElementById('btn-fg-new')).catch(() => false)) break; }
  // three built-in Figures (the empty boot graph has no Element to draw)
  for (const i of [0, 1, 2]) { await ev(k => { document.getElementById('btn-fg-new').click(); const b = document.querySelector(`.fg-new__item[data-i="${k}"]`); if (b) b.click(); }, i); await sleep(1500); }
  for (let i = 0; i < 60; i++) { await sleep(250); if (await ev(() => document.querySelectorAll('.fg-card__sheet').length > 0).catch(() => false)) break; }
  await sleep(800);
  if (process.env.DBG) console.log(await ev(() => JSON.stringify({ nodes: document.querySelectorAll('.nc-node').length, sheets: document.querySelectorAll('.fg-card__sheet').length, imgs: document.querySelectorAll('.fg-card__img').length, tier: document.querySelector('.tier-view.active') && document.querySelector('.tier-view.active').dataset.tier, kinds: [...document.querySelectorAll('.nc-node')].map(n => n.className).slice(0, 8) })));
  // twelve variations of the Figure: 13 card sheets on the board
  const fig = await ev(() => { const st = document.querySelector('.nc-stage').getBoundingClientRect(), sh = [...document.querySelectorAll('.fg-card__sheet')].find(e => { const b = e.getBoundingClientRect(); return b.x > st.x + 20 && b.right < st.right - 200 && b.y > st.y + 20 && b.bottom < st.bottom - 120; }) || document.querySelector('.fg-card__sheet'), n = sh.closest('.nc-node'); const h = [n.querySelector('.nc-node__body'), n.querySelector('.nc-node__head'), n].find(e => e && e.getBoundingClientRect().height > 4); const r = h.getBoundingClientRect(); return { x: r.x + Math.min(r.width / 2, 24), y: r.y + r.height / 2, id: n.dataset.nodeId, t: n.style.transform || (n.style.left + ',' + n.style.top) }; });
  await raw('mouseMoved', fig.x, fig.y, 'none', 0); await raw('mousePressed', fig.x, fig.y, 'left', 1); await raw('mouseReleased', fig.x, fig.y, 'left', 0); await sleep(500);
  const av = await ev(() => { const b = document.getElementById('fgi-addvar'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (process.env.DBG) console.log('addvar button', JSON.stringify(av));
  if (av) { await raw('mouseMoved', av.x, av.y, 'none', 0); await raw('mousePressed', av.x, av.y, 'left', 1); await raw('mouseReleased', av.x, av.y, 'left', 0); }
  await sleep(1500);
  const vn = await ev(() => { const n = [...document.querySelectorAll('.nc-node')].find(x => /Variations/.test(x.textContent) && !x.querySelector('.fg-card__sheet')); if (!n) return null; const h = [n.querySelector('.nc-node__body'), n.querySelector('.nc-node__head'), n].find(e => e && e.getBoundingClientRect().height > 4); const r = h.getBoundingClientRect(); return { x: r.x + Math.min(r.width / 2, 24), y: r.y + r.height / 2 }; });
  if (vn) { await raw('mouseMoved', vn.x, vn.y, 'none', 0); await raw('mousePressed', vn.x, vn.y, 'left', 1); await raw('mouseReleased', vn.x, vn.y, 'left', 0); await sleep(800); }
  const vc = await ev(() => { const r = document.getElementById('fgi-vcount'); if (!r) return null; r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return r.max; });
  if (process.env.DBG) console.log('variations node', JSON.stringify(vn), 'count', vc);
  for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(() => document.querySelectorAll('.fg-card__sheet').length >= 15).catch(() => false)) break; }
  await sleep(1500);
  // fit the whole board in view (Shift+1), so every card is on screen
  const em = await ev(() => { const st = document.querySelector('.nc-stage'), r = st.getBoundingClientRect(); for (let y = r.bottom - 40; y > r.top + 40; y -= 23) for (let x = r.right - 60; x > r.left + 60; x -= 31) if (document.elementFromPoint(x, y) === st) return { x, y }; return null; });
  if (em) { await raw('mouseMoved', em.x, em.y, 'none', 0); await raw('mousePressed', em.x, em.y, 'left', 1); await raw('mouseReleased', em.x, em.y, 'left', 0); }
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Digit1', key: '!', modifiers: 8, windowsVirtualKeyCode: 49 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Digit1', key: '!', modifiers: 8, windowsVirtualKeyCode: 49 });
  await sleep(1200);
  // then two steps in: cards at a working size, most still on screen
  const sc = await ev(() => { const r = document.querySelector('.nc-stage').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  for (let i = 0; i < 2; i++) { await raw('mouseWheel', sc.x, sc.y, 'none', 0, { deltaX: 0, deltaY: -120 }); await sleep(300); }
  await sleep(800);
}

await boot();
const cards = await ev(() => document.querySelectorAll('.fg-card__sheet').length);
const stage = await ev(() => { const r = document.querySelector('.nc-stage').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
const nodeAt = () => ev(() => { const st = document.querySelector('.nc-stage').getBoundingClientRect(), sh = [...document.querySelectorAll('.fg-card__sheet')].find(e => { const b = e.getBoundingClientRect(); return b.x > st.x + 20 && b.right < st.right - 200 && b.y > st.y + 20 && b.bottom < st.bottom - 120; }) || document.querySelector('.fg-card__sheet'), n = sh.closest('.nc-node'); const h = [n.querySelector('.nc-node__body'), n.querySelector('.nc-node__head'), n].find(e => e && e.getBoundingClientRect().height > 4); const r = h.getBoundingClientRect(); return { x: r.x + Math.min(r.width / 2, 24), y: r.y + r.height / 2, id: n.dataset.nodeId, t: n.style.transform || (n.style.left + ',' + n.style.top) }; });
const emptyAt = () => ev(() => { const st = document.querySelector('.nc-stage'), r = st.getBoundingClientRect(); for (let y = r.bottom - 40; y > r.top + 40; y -= 23) for (let x = r.right - 60; x > r.left + 60; x -= 31) if (document.elementFromPoint(x, y) === st) return { x, y }; return { x: r.right - 80, y: r.bottom - 80 }; });
await cdp('Emulation.setCPUThrottlingRate', { rate: CPU });
console.log(`Stage shadow — Figure board, ${cards} card sheets, ${THEME}, CPU ×${CPU}, 2× pixel density, ${RUNS} runs each (median shown)`);
const rows = [];
for (const v of VARIANTS) {
  await ev(x => window.__stageShadow.set(x), v); await sleep(600);
  const runs = { drag: [], pan: [], zoom: [] };
  for (let k = 0; k < RUNS; k++) {
    const n = await nodeAt();
    runs.drag.push(await measure(() => drag(n, { x: n.x + 160, y: n.y + 90 }, 'left', 3000)));
    if (process.env.DBG) console.log('moved?', n.t, '→', (await nodeAt()).t);
    const n2 = await nodeAt(); await drag(n2, { x: n2.x - 160, y: n2.y - 90 }, 'left', 300); await sleep(300);   // put it back
    const e = await emptyAt();
    runs.pan.push(await measure(() => drag(e, { x: e.x - 200, y: e.y - 120 }, 'middle', 3000)));
    await drag(await emptyAt(), { x: e.x, y: e.y }, 'middle', 300); await sleep(300);
    runs.zoom.push(await measure(() => zoom({ x: stage.x, y: stage.y }, 10)));
    await sleep(400);
  }
  const layers = await new Promise(r => { const h = e => { const m = JSON.parse(e.data); if (m.method === 'LayerTree.layerTreeDidChange') { ws.removeEventListener('message', h); r((m.params.layers || []).length); } }; ws.addEventListener('message', h); ev(() => { document.querySelector('.nc-stage').style.outline = '0px solid transparent'; }); setTimeout(() => { ws.removeEventListener('message', h); r(null); }, 2000); });
  for (const g of ['drag', 'pan', 'zoom']) {
    const med = key => { const a = runs[g].map(x => x[key] || 0).sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
    const row = { variant: v, gesture: g, frames: med('frames'), p50: med('p50'), p95: med('p95'), long: med('long'), Paint: med('Paint'), Raster: med('RasterTask'), GPU: med('GPUTask'), layers };
    rows.push(row);
    console.log(`  ${v.padEnd(8)} ${g.padEnd(5)} frames ${String(row.frames).padStart(3)}  p50 ${row.p50.toFixed(1).padStart(5)} ms  p95 ${row.p95.toFixed(1).padStart(5)} ms  >33ms ${String(row.long).padStart(3)}  Paint ${row.Paint.toFixed(0).padStart(4)}  Raster ${row.Raster.toFixed(0).padStart(5)}  GPU ${row.GPU.toFixed(0).padStart(5)}  layers ${layers ?? '-'}`);
  }
}
const OUT = arg('json', '');
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ cards, theme: THEME, cpu: CPU, rows }, null, 2));
if (consoleErrors.length) console.log('page errors:\n  ' + consoleErrors.slice(0, 5).join('\n  '));
done(0);
