// Headless Chrome on a throwaway static server of the repo — the no-dependency pattern of scripts/test-fvs-qa.mjs,
// as a helper. Run with: node --experimental-websocket. Usage:
//   const P = await openChrome(); await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
//   const v = await P.ev(`return 1 + 1;`, PRELUDE); P.errors → [..]; await P.close(code)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png' };

export async function openChrome({ timeoutMs = 600000, width = 1440, height = 900 } = {}) {
  const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
  const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
  if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
  if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket'); process.exit(2); }
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
  const ORIGIN = `http://localhost:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'organica-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const close = code => { try { chrome.kill('SIGKILL'); } catch {} server.close(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {} process.exit(code); };
  const timer = setTimeout(() => { console.log('ERROR — timed out'); close(1); }, timeoutMs);
  timer.unref();
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
    chrome.on('exit', () => reject(new Error('Chrome exited early')));
  });
  const pages = await (await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json`)).json();
  const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let nid = 0; const pend = new Map(); const errors = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0]);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  });
  const cdp = (method, params = {}) => new Promise(r => { const i = ++nid; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Page.enable'); await cdp('Runtime.enable');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function ev(body, prelude = '') {
    const r = await cdp('Runtime.evaluate', { expression: `(async () => { ${prelude}\n${body} })()`, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]);
    return r.result?.result?.value;
  }
  async function goto(p, readyExpr) {
    await cdp('Page.navigate', { url: ORIGIN + p });
    for (let i = 0; i < 160; i++) {
      await sleep(250);
      const r = await cdp('Runtime.evaluate', { expression: `document.readyState === 'complete' && !!(${readyExpr || 'true'})`, returnByValue: true });
      if (r.result?.result?.value) return true;
    }
    return false;
  }
  return { ORIGIN, cdp, ev, goto, sleep, errors, close };
}

// ── settling instead of sleeping ──
// QUIET_INIT goes in before the page's own scripts (Page.addScriptToEvaluateOnNewDocument): it counts the page's
// short timers (≤ 1 s — debounced saves, re-renders, "later" passes; longer ones are notes / tooltips) so a test can
// wait for the page to be done reacting instead of sleeping a fixed time: `await ev(QUIET)` resolves after two
// animation frames with no short timer pending (or 4 s at most). Pair it with prefers-reduced-motion (the motion
// tokens collapse to 1 ms, the Symbol arrival is skipped), see `quietPage()`.
export const QUIET_INIT = `(() => {
  if (window.__quiet) return;
  const pend = new Set(), st = window.setTimeout.bind(window), ct = window.clearTimeout.bind(window);
  window.setTimeout = function (fn, ms, ...a) {
    if (typeof fn !== 'function' || (+ms || 0) > 1000) return st(fn, ms, ...a);
    const id = st(() => { pend.delete(id); fn(...a); }, ms); pend.add(id); return id;
  };
  window.clearTimeout = id => { pend.delete(id); return ct(id); };
  window.__quiet = () => new Promise(res => {
    const t0 = performance.now();
    const loop = () => requestAnimationFrame(() => requestAnimationFrame(() => (!pend.size || performance.now() - t0 > 4000) ? res(pend.size) : st(loop, 16)));
    loop();
  });
})()`;
export const QUIET = 'window.__quiet ? window.__quiet() : 0';
// install the detector + reduced motion on a CDP session (call once, before the first navigation)
export async function quietPage(cdp) {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: QUIET_INIT });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
}
