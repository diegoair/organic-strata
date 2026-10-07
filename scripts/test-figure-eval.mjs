#!/usr/bin/env node
// FVS Figure evaluator — the 25 catalog figures, each rendered on a freshly loaded page, hashed.
// Usage: scripts/test-figure-eval.sh [--record] [--only "<name>"]
//   --record   writes fvs/_figure-eval-baseline.json from runFigureRecipe() (today's panel-driven runner).
//   (default)  renders every figure through evalFigure() — the pure evaluator — and checks (1) its SVG matches
//              the baseline byte for byte (FNV hash of the normalised SVG), (2) running it leaves FVS exactly as it
//              was: state, live and every panel control unchanged, and (3) the result does not depend on what the
//              panel showed before (the same figure is evaluated again after another one, and on a changed panel).
// Before evalFigure() exists, the default mode re-runs runFigureRecipe() — a check that the baseline is stable.
//
// Same no-dependency pattern as scripts/test-fvs-qa.mjs: serves the repo on a throwaway port, drives headless
// Chrome over the DevTools protocol, opens /fvs/ with a clean profile. docs/FVS.md §12.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'fvs', '_figure-eval-baseline.json');
const RECORD = process.argv.includes('--record');
const ONLY = (i => i > 0 ? process.argv[i + 1] : '')(process.argv.indexOf('--only'));
const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/test-figure-eval.mjs'); process.exit(2); }

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
const ORIGIN = `http://localhost:${server.address().port}`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'organica-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--window-size=1440,900',
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const done = code => { try { chrome.kill('SIGKILL'); } catch {} server.close(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {} process.exit(code); };
setTimeout(() => { console.log('Figure eval: ERROR — timed out after 10 min'); done(1); }, 600000);

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
const sleep = ms => new Promise(r => setTimeout(r, ms));

// F(name) = the FVS binding (window.__fvs). H = FNV-1a. norm = the same normalisation as test-fvs-qa (run-time ids).
const PRELUDE = `const F = n => window.__fvs[n];
  const H = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const norm = s => s.replace(/"exportedAt":"[^"]*"/g, '"exportedAt":""').replace(/"ruleSource":"[^"]*"/g, '"ruleSource":""').replace(/(stk[0-9a-z]+)-[0-9a-z]+-(\\d+)/g, '$1-$2').replace(/-d[0-9a-z]+(?=["')])/g, '');
  const idle = ms => new Promise(r => setTimeout(r, ms));
  // Everything a figure run could leave behind: the model (state + live, JSON-able parts) and every panel control.
  const fingerprint = () => {
    const S = F('state'), L = F('live'), skip = new Set(['preFigureSnapshot']);
    const js = o => { try { return JSON.stringify(o, (k, v) => v instanceof Set ? [...v] : v instanceof Map ? [...v] : (typeof v === 'function' ? undefined : v)); } catch (e) { return 'unserialisable'; } };
    const st = {}; Object.keys(S).forEach(k => { if (!skip.has(k)) st[k] = H(js(S[k]) || ''); });
    const lv = {}; Object.keys(L).forEach(k => { lv[k] = H(js(L[k]) || ''); });
    const ctl = {}; document.querySelectorAll('#panel input[id], #panel select[id], #panel textarea[id]').forEach(el => { ctl[el.id] = el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : el.value; });
    return { st, lv, ctl };
  };
  const fpDiff = (a, b) => { const out = []; for (const part of ['st', 'lv', 'ctl']) { const ks = new Set([...Object.keys(a[part]), ...Object.keys(b[part])]); ks.forEach(k => { if (a[part][k] !== b[part][k]) out.push(part + '.' + k); }); } return out; };`;
async function ev(body) {
  const r = await cdp('Runtime.evaluate', { expression: `(async () => { ${PRELUDE}\n${body} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]);
  return r.result?.result?.value;
}
async function freshPage() {
  await cdp('Page.navigate', { url: `${ORIGIN}/fvs/` });
  for (let i = 0; i < 160; i++) {
    await sleep(250);
    const r = await cdp('Runtime.evaluate', { expression: `document.readyState === 'complete' && !!(window.__fvs && window.__fvs.isReady)`, returnByValue: true });
    if (r.result?.result?.value) break;
  }
  await ev(`await F('loadFigureTestRunners')(); await idle(300); return 1;`);
}

await cdp('Page.enable'); await cdp('Runtime.enable');
await freshPage();
const names = (await ev(`return Object.keys(F('figureCatalog')());`)).filter(n => !ONLY || n === ONLY);
const hasEval = await ev(`return typeof window.__fvs.evalFigure === 'function';`);
const fails = []; const check = (ok, msg) => { if (!ok) fails.push(msg); };

// One figure, on a fresh page: the final SVG + the SVG of every level it built.
const RUN_OLD = n => `const def = F('figureCatalog')()[${JSON.stringify(n)}];
  const svg = F('runFigureRecipe')(def, { keepTier: true });
  const out = { final: H(norm(svg)), len: svg.length };
  for (const lvl of ['component', 'symbol']) { const s = F('figureSVGOf')(lvl); out[lvl] = s ? H(norm(s)) : ''; }
  return out;`;
const RUN_EVAL = n => `const def = F('figureCatalog')()[${JSON.stringify(n)}];
  const before = fingerprint();
  const t0 = performance.now(); const r = F('evalFigure')(def); const ms = performance.now() - t0;
  const after = fingerprint();
  const t1 = performance.now(); for (let i = 0; i < 5; i++) F('evalFigure')(def); const warm = (performance.now() - t1) / 5;
  const out = { final: H(norm(r.svg)), len: r.svg.length, leak: fpDiff(before, after), ms, warm };
  for (const lvl of ['component', 'symbol']) out[lvl] = r.levels && r.levels[lvl] ? H(norm(r.levels[lvl])) : '';
  return out;`;

const results = {};
for (const n of names) {
  await freshPage();
  const e0 = errors.length;
  try { results[n] = await ev(RECORD || !hasEval ? RUN_OLD(n) : RUN_EVAL(n)); }
  catch (err) { results[n] = { error: err.message }; check(false, `${n}: ${err.message}`); }
  const ne = errors.slice(e0); check(!ne.length, `${n}: page errors: ${ne.join(' | ')}`);
}

// Purity: evaluating figure B after figure A, and on a panel the user has changed, gives B's own result.
let purity = '';
if (!RECORD && hasEval && names.length > 1) {
  await freshPage();
  const a = names[0], b = names[names.length - 1];
  const r = await ev(`const cat = F('figureCatalog')();
    F('evalFigure')(cat[${JSON.stringify(a)}]);
    const s1 = F('evalFigure')(cat[${JSON.stringify(b)}]).svg;
    // change the panel the way a user would: another Shape, other colours
    const sel = document.getElementById('sel-seed-type'); sel.value = 'circle'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    F('state').colors = ['#ff0000', '#00ff00']; await idle(100);
    const s2 = F('evalFigure')(cat[${JSON.stringify(b)}]).svg;
    return { s1: H(norm(s1)), s2: H(norm(s2)) };`);
  const want = results[b] && results[b].final;
  check(r.s1 === want, `purity: "${b}" after "${a}" gives ${r.s1}, alone ${want}`);
  check(r.s2 === want, `purity: "${b}" on a changed panel gives ${r.s2}, alone ${want}`);
  purity = ` · purity ${r.s1 === want && r.s2 === want ? 'ok' : 'FAIL'}`;
}

if (RECORD) {
  const hashes = {}; Object.entries(results).forEach(([n, r]) => { if (!r.error) hashes[n] = { final: r.final, component: r.component, symbol: r.symbol }; });
  fs.writeFileSync(BASELINE, JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), note: 'runFigureRecipe() on a fresh /fvs/ page per figure', hashes }, null, 2) + '\n');
  console.log(`Baseline recorded → fvs/_figure-eval-baseline.json (${Object.keys(hashes).length} figures).`);
} else {
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).hashes;
  for (const n of names) {
    const r = results[n], b = base[n];
    if (!b) { check(false, `${n}: not in the baseline`); continue; }
    if (r.error) continue;
    check(r.final === b.final, `${n}: final SVG ${r.final} ≠ baseline ${b.final}`);
    for (const lvl of ['component', 'symbol']) if (b[lvl] && r[lvl] !== undefined && hasEval) check(r[lvl] === b[lvl], `${n}: ${lvl} level ${r[lvl]} ≠ baseline ${b[lvl]}`);
    if (r.leak) check(!r.leak.length, `${n}: evalFigure changed ${r.leak.length} things: ${r.leak.slice(0, 8).join(', ')}`);
  }
}
const timed = Object.values(results).filter(r => r.warm != null);
const speed = timed.length ? ` · ${(timed.reduce((a, r) => a + r.warm, 0) / timed.length).toFixed(1)} ms per figure (warm avg), slowest ${Math.max(...timed.map(r => r.warm)).toFixed(1)} ms` : '';
const ok = names.length - new Set(fails.map(f => f.split(':')[0])).size;
console.log(`Figure eval: ${fails.length ? 'FAIL' : 'PASS'} — ${RECORD ? 'recorded' : `${ok}/${names.length} match`} (${hasEval && !RECORD ? 'evalFigure' : 'runFigureRecipe'})${purity}${speed}`);
fails.forEach(f => console.log('  ✗ ' + f));
done(fails.length ? 1 : 0);
