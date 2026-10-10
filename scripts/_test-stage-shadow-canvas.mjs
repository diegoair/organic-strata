#!/usr/bin/env node
// LOCAL dev test (Oct 10, 2026 — not committed): the stage-shadow variants of design-system/_stage-shadow.css on the
// FVS canvases (Element / Symbol sheet, square + circle cells) — none (today) · offset (A, hard offset, no blur) · rest (C, the soft shadow only at rest) — timed with
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
const THEME = arg('theme', 'light'), CPU = +arg('cpu', 4), VARIANTS = arg('variants', 'none,soft,rest').split(','), RUNS = +arg('runs', 3);

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
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await cdp('Page.navigate', { url: `http://localhost:${port}/fvs/` });
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev(() => !!(window.__fvs && window.__fvs.isReady)).catch(() => false)) break; }
  await ev(t => { document.documentElement.dataset.theme = t;
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/design-system/_stage-shadow.css'; document.head.append(css);
    const js = document.createElement('script'); js.src = '/design-system/_stage-shadow.js'; document.head.append(js); }, THEME);
  await sleep(800);
}
await boot();
const STEPS = arg('steps', 'element,symbol').split(','), SHAPES = arg('shapes', 'square,circle').split(',');
await cdp('Emulation.setCPUThrottlingRate', { rate: CPU });
console.log(`Stage shadow — the canvases only, ${THEME}, CPU ×${CPU}, 2× pixel density, ${RUNS} runs each (median): a 3 s drag of a shape slider (the canvas redraws every step) and 10 zoom steps on the canvas`);
const rows = [];
for (const step of STEPS) for (const shape of SHAPES) {
  await ev((s, c) => { window.__fvs.setTier(s); window.__fvs.setCellShape(c); }, step, shape);
  await sleep(3000);
  if (step === 'symbol') { await ev(() => { const b = [...document.querySelectorAll('button')].find(x => /^Generate$/.test(x.textContent.trim()) && x.offsetParent); if (b) b.click(); }); await sleep(4000); }
  const canvas = await ev(s => { const el = s === 'element' ? document.querySelector('#element-svg > svg') : document.querySelector('#symbol-frame svg'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, step);
  // a slider of the Element's shape (Arc's Thickness at boot) — on Symbol the Element still drives every cell
  if (step === 'symbol') { await ev(() => window.__fvs.setTier('element')); await sleep(300); }
  const sl = await ev(() => { const r = document.getElementById('rg-thickness'); r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); return { x0: b.x + 4, x1: b.right - 4, y: b.y + b.height / 2 }; });
  if (step === 'symbol') { await ev(() => window.__fvs.setTier('symbol')); await sleep(800); }
  for (const v of VARIANTS) {
    await ev(x => window.__stageShadow.set(x), v); await sleep(500);
    const runs = { slider: [], zoom: [] };
    for (let k = 0; k < RUNS; k++) {
      if (step === 'symbol') { await ev(() => window.__fvs.setTier('element')); await sleep(200); }
      // slider: on Element the canvas is on screen; on Symbol the panel slider is on the Element step — so on Symbol only zoom counts
      if (step === 'element') runs.slider.push(await measure(() => drag({ x: sl.x0 + 10, y: sl.y }, { x: sl.x1 - 10, y: sl.y }, 'left', 3000)));
      if (step === 'symbol') { await ev(() => window.__fvs.setTier('symbol')); await sleep(600); }
      if (canvas) runs.zoom.push(await measure(() => zoom(canvas, 10)));
      await sleep(300);
    }
    for (const g of ['slider', 'zoom']) {
      if (!runs[g].length) continue;
      const med = key => { const a = runs[g].map(x => x[key] || 0).sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
      const row = { step, shape, variant: v, gesture: g, frames: med('frames'), p50: med('p50'), p95: med('p95'), long: med('long'), Paint: med('Paint'), Raster: med('RasterTask'), GPU: med('GPUTask') };
      rows.push(row);
      console.log(`  ${step.padEnd(8)}${shape.padEnd(7)} ${v.padEnd(7)} ${g.padEnd(6)} frames ${String(row.frames).padStart(3)}  p50 ${row.p50.toFixed(1).padStart(5)}  p95 ${row.p95.toFixed(1).padStart(5)}  >33ms ${String(row.long).padStart(3)}  Paint ${row.Paint.toFixed(0).padStart(4)}  Raster ${row.Raster.toFixed(0).padStart(4)}  GPU ${row.GPU.toFixed(0).padStart(5)}`);
    }
  }
}
const OUT = arg('json', '');
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ theme: THEME, cpu: CPU, rows }, null, 2));
if (consoleErrors.length) console.log('page errors:\n  ' + consoleErrors.slice(0, 5).join('\n  '));
done(0);
