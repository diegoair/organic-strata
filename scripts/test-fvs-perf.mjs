#!/usr/bin/env node
// FVS performance — how long a Component save takes, click to painted frame. Usage: scripts/test-fvs-perf.sh [options]
//
// Same no-dependency pattern as scripts/test-fvs-qa.mjs: serves a checkout on a throwaway port, drives headless Chrome
// over the DevTools protocol with a clean profile. Every save is a REAL click on a gallery thumbnail's save circle
// (hover first: the circle is 0×0 until its thumbnail is hovered), timed until two animation frames have run — so
// style, layout and paint count, not just the JavaScript. (The desktop app's Browser pane is useless for this when
// hidden: it throttles timers to one per second.)
//
// Two parts:
//   1. sequence — circle cells, grid size 1, an empty library, 12 saves in a row. Catches a save that gets slower with
//      every saved thumbnail (Oct 6, 2026: 13 CSS filter passes per saved cell-shape thumbnail → ~2 s by the 12th).
//   2. matrix — every cell shape × grid shape × grid size (+ square 2×2 / 3×3 / 4×4 / 4×2), N saves each, on top of a
//      library pre-filled with ~P saved Components, the Library rail open. Catches a save that gets slower with the
//      library (Oct 6, 2026: every rail thumbnail re-parsed the whole library → ~3–4 s per save at ~400).
//   4. storage — localStorage filled to the brim (a filler key), then a save circle click, Save all, an Element save
//      and a Symbol save: each must show the "Not saved" notice and mark nothing saved; with the filler gone the
//      same save must work. (Oct 7, 2026: past ~540 Components saves were lost silently while ✓ still showed.)
//   3. paint — hover sweeps over the Component gallery and the Element turns, per cell shape, at 2× pixel density
//      (a retina screen), traced: the GPU / paint / style work each shape costs. Report only, no budget yet. (Oct 6,
//      2026: cell shapes cost 5–10× square in GPU work — the 40px stage shadow is a CSS drop-shadow filter on the
//      SVG, re-run on every repaint; square sheets use a box-shadow.)
// After every save the library must have grown by one: a save that is not stored (localStorage full) is a failure.
//
// Options:
//   --quick            sequence + one grid size per shape (~30 s) instead of the full matrix (~2–3 min)
//   --only PARTS       run some parts: e.g. --only paint, --only sequence,matrix
//   --css RULES        inject a style sheet first (try a change without editing: --css 'svg.is-cell{filter:none}')
//   --saves N          saves per matrix combination (default 3)
//   --prefill P        saved Components before the matrix (default 300; ~9 KB each, localStorage holds ~540)
//   --rail off         run with the Library rail closed
//   --max-ms M         budget: any save slower than M fails (default 500)
//   --profile LABEL    CPU profile of the first save of the combination whose label starts with LABEL
//                      (e.g. "circle / hexagon / size 1"): top functions, self and inclusive
//   --root DIR         serve another checkout (a `git worktree add` of an older commit = a before/after comparison)
//   --json FILE        write every timing to FILE
// Exit 0 = within budget, 1 = over budget / a save not stored / a page error, 2 = setup problem.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const QUICK = process.argv.includes('--quick');
const SAVES = +arg('saves', 3), PREFILL = +arg('prefill', 300), MAX_MS = +arg('max-ms', 500);
const ONLY = (arg('only', 'sequence,matrix,paint,storage')).split(','), CSS = arg('css', '');
const RAIL = arg('rail', 'on') !== 'off', PROFILE = arg('profile', ''), JSON_OUT = arg('json', '');
const ROOT = path.resolve(arg('root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));

const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/test-fvs-perf.mjs'); process.exit(2); }
if (!fs.existsSync(path.join(ROOT, 'fvs', 'index.html'))) { console.error(`No fvs/index.html under ${ROOT}`); process.exit(2); }

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
setTimeout(() => { console.log('FVS perf: ERROR — timed out after 20 min'); done(1); }, 20 * 60000);

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
async function ev(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]);
  return r.result?.result?.value;
}

await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Profiler.enable');
await cdp('Page.navigate', { url: `${ORIGIN}/fvs/` });
let ready = false;
for (let i = 0; i < 120 && !ready; i++) { await sleep(250); ready = !!(await ev(`document.readyState === 'complete' && !!(window.__fvs && window.__fvs.isReady)`)); }
if (!ready) { console.log('FVS perf: ERROR — FVS never became ready'); done(2); }
await sleep(1000);
await ev(`window.__fvs.setTier('component'); new Promise(r => setTimeout(r, 600))`);
await ev(`window.__fvs.setRailOpen(${RAIL}); 1`);
if (CSS) await ev(`(() => { const st = document.createElement('style'); st.textContent = ${JSON.stringify(CSS)}; document.head.append(st); return 1; })()`);

const libCount = () => ev(`Object.keys(window.__fvs.LIBRARY.read()).length`);
// Cell shape + Grid shape + Grid size (or columns × rows for square cells), through the same inputs the panel uses.
async function setGrid(k) {
  await ev(`(() => { const F = window.__fvs, s = F.state; F.setCellShape('${k.shape}');
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    ${k.shape === 'square' ? `set('rg-grid-cols', ${k.cols}); set('rg-grid-rows', ${k.rows});` : `s.cellOutline['${k.shape}'] = '${k.outline}'; set('rg-grid-rings', ${k.rings});`}
    return 1; })()`);
  await sleep(250);
}
const label = k => k.shape === 'square' ? `square ${k.cols}x${k.rows}` : `${k.shape} / ${k.outline} / size ${k.rings}`;

function printProfile(p) {
  const dt = p.timeDeltas, byId = new Map(p.nodes.map(n => [n.id, n])), parent = new Map();
  p.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const name = n => (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').slice(-2).join('/') + ':' + (n.callFrame.lineNumber + 1);
  const self = new Map(), incl = new Map();
  p.samples.forEach((id, j) => {
    const w = (dt[j] || 0) / 1000, seen = new Set();
    self.set(name(byId.get(id)), (self.get(name(byId.get(id))) || 0) + w);
    for (let x = id; x; x = parent.get(x)) { const k = name(byId.get(x)); if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + w); }
  });
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `      ${v.toFixed(0).padStart(5)} ms  ${k}`).join('\n');
  console.log('    profile — self:\n' + top(self, 12) + '\n    profile — inclusive:\n' + top(incl, 20));
  console.log('    ("(idle)" = waiting for the frame, i.e. style / layout / paint / raster off the main thread)');
}

// One save: hover a thumbnail that is not saved yet, click its save circle, wait two frames. → ms, or a string on a miss.
async function save(prof) {
  const at = await ev(`(() => { const b = document.querySelector('#gallery .fvs-thumb-quicksave:not(.saved)'); if (!b) return null;
    const w = b.closest('.fvs-thumb-wrap'); w.scrollIntoView({ block: 'center' }); const r = w.querySelector('.fvs-thumb').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!at) return 'no unsaved thumbnail';
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y }); await sleep(250);
  const pos = await ev(`(() => { const b = document.querySelector('#gallery .fvs-thumb-quicksave:not(.saved)'); const r = b.getBoundingClientRect(); if (!r.width) return null;
    const x = r.x + r.width / 2, y = r.y + r.height / 2, h = document.elementFromPoint(x, y); return h && h.closest('.fvs-thumb-quicksave') === b ? { x, y } : null; })()`);
  if (!pos) return 'save circle not under the pointer';
  const before = await libCount();
  if (prof) await cdp('Profiler.start');
  const t0 = performance.now();
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await ev(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  const ms = Math.round(performance.now() - t0);
  if (prof) printProfile((await cdp('Profiler.stop')).result.profile);
  await sleep(150);
  if ((await libCount()) !== before + 1) return `not stored (${ms} ms; library ${before} → ${await libCount()})`;
  return ms;
}

const fails = [], results = { root: ROOT, rail: RAIL, sequence: [], matrix: [] };
const judge = (where, t) => {
  if (typeof t !== 'number') fails.push(`${where}: ${t}`);
  else if (t > MAX_MS) fails.push(`${where}: ${t} ms > ${MAX_MS} ms`);
};

// 1 — sequence
console.log(`FVS perf — ${path.relative(process.cwd(), ROOT) || '.'}, Library rail ${RAIL ? 'open' : 'closed'}, budget ${MAX_MS} ms per save`);
if (ONLY.includes('sequence')) {
await setGrid({ shape: 'circle', outline: 'hexagon', rings: 1 });
for (let i = 0; i < 12; i++) {
  const t = await save(PROFILE && 'sequence'.startsWith(PROFILE) && i === 11);
  results.sequence.push(t); judge(`sequence save ${i + 1}`, t);
}
console.log('sequence  circle / grid size 1, 12 saves:  ' + results.sequence.join(', ') + ' ms');
const seq = results.sequence.filter(t => typeof t === 'number');
if (seq.length === 12) {
  const head = (seq[1] + seq[2]) / 2, tail = (seq[10] + seq[11]) / 2;
  if (tail > 150 && tail > 3 * head) fails.push(`sequence: saves grow with each saved thumbnail (${Math.round(head)} → ${Math.round(tail)} ms)`);
}
}

// 2 — prefill: Save all across Elements × cell shapes until the library holds ~PREFILL
if (ONLY.includes('matrix')) {
console.log(`prefill   up to ${PREFILL} saved Components …`);
outer: for (let round = 0; round < 20; round++) {
  for (const type of ['star', 'blob', 'drop', 'lens', 'chevron', 'cross', 'polygon', 'wedge', 'triangle', 'arc']) {
    await ev(`window.__fvs.fireChange('sel-seed-type', '${type}'); 1`); await sleep(120);
    for (const shape of ['square', 'circle', 'triangle', 'hexagon']) {
      if ((await libCount()) >= PREFILL) break outer;
      await setGrid({ shape, outline: 'hexagon', rings: 1 + (round % 4), cols: 2, rows: 2 });
      await ev(`window.__fvs.state.components.forEach(c => { c.savedName = null; }); window.__fvs.saveAllComponentsToLibrary(); 1`);
    }
  }
}
await ev(`window.__fvs.fireChange('sel-seed-type', 'triangle'); 1`); await sleep(200);
const kb = await ev(`Math.round((localStorage.getItem(window.__fvs.LIBRARY.key) || '').length / 1024)`);
console.log(`prefill   ${await libCount()} saved Components, ${kb} KB in localStorage`);

// 3 — matrix
const OUTLINES = { circle: ['hexagon', 'triangle', 'diamond', 'square'], hexagon: ['hexagon', 'triangle', 'diamond', 'square'], triangle: ['hexagon', 'triangle', 'diamond'] };
const combos = [[2, 2], [3, 3], [4, 4], [4, 2]].filter((_, i) => !QUICK || i === 0).map(([cols, rows]) => ({ shape: 'square', cols, rows }));
for (const shape of Object.keys(OUTLINES)) for (const outline of OUTLINES[shape]) for (const rings of [1, 2, 3, 4]) {
  if (QUICK && (outline !== 'hexagon' || rings > 2)) continue;
  combos.push({ shape, outline, rings });
}
for (const k of combos) {
  await setGrid(k);
  const t = [];
  for (let i = 0; i < SAVES; i++) { const r = await save(PROFILE && label(k).startsWith(PROFILE) && i === 0); t.push(r); judge(label(k), r); }
  results.matrix.push({ combo: label(k), ms: t, library: await libCount() });
  console.log(label(k).padEnd(30) + `lib ${await libCount()}`.padEnd(10) + t.join(', ') + (t.every(x => typeof x === 'number') ? ' ms' : ''));
}
const all = results.matrix.flatMap(r => r.ms).filter(t => typeof t === 'number').sort((a, b) => a - b);
const pct = q => all[Math.min(all.length - 1, Math.floor(all.length * q))];
if (all.length) console.log(`matrix    ${all.length} saves — median ${pct(0.5)} ms · p90 ${pct(0.9)} ms · max ${all[all.length - 1]} ms`);
results.summary = { median: pct(0.5), p90: pct(0.9), max: all[all.length - 1] };
}

// 4 — paint: a traced hover sweep per tier × cell shape at 2× pixel density
if (ONLY.includes('paint')) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  let trace = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Tracing.dataCollected') trace.push(...m.params.value); });
  const KEYS = ['GPUTask', 'Paint', 'RasterTask', 'UpdateLayoutTree', 'Layerize', 'RunTask'];
  const traced = async fn => {
    trace = [];
    await cdp('Tracing.start', { traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'viz', 'gpu', 'toplevel'] }, transferMode: 'ReportEvents' });
    await fn();
    const fin = new Promise(r => { const h = e => { if (JSON.parse(e.data).method === 'Tracing.tracingComplete') { ws.removeEventListener('message', h); r(); } }; ws.addEventListener('message', h); });
    await cdp('Tracing.end'); await fin;
    const sum = {}; trace.forEach(t => { if (t.ph === 'X' && t.dur && KEYS.includes(t.name)) sum[t.name] = (sum[t.name] || 0) + t.dur / 1000; });
    return sum;
  };
  results.paint = [];
  console.log('paint     hover sweep, 48 moves, 2× pixel density — ms of work (lower = lighter)');
  for (const tier of ['component', 'element']) for (const shape of ['square', 'circle', 'triangle', 'hexagon']) {
    // 3 s: a cell-shape switch moves the Grid size slider, whose liquid fill rings for ~2.5 s — let it settle, or
    // its repaints land in the next shape's numbers (it made hexagon read as 2× square on Oct 7, 2026)
    await ev(`window.__fvs.setTier('${tier}'); window.__fvs.setCellShape('${shape}'); new Promise(r => setTimeout(r, 3000))`);
    const p = await ev(`[...document.querySelectorAll('${tier === 'component' ? '#gallery .fvs-thumb' : '#seed-preview .fvs-seed-tile, #element-frame'}')].slice(0, 16).map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })`);
    while (p.length && p.length < 16) p.push(p[p.length % p.length]);
    const sum = await traced(async () => { for (let k = 0; k < 3; k++) for (const [x, y] of p) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(40); } });
    results.paint.push({ tier, shape, ...sum });
    console.log(`  ${tier.padEnd(10)}${shape.padEnd(9)}` + KEYS.map(k => `${k} ${String(Math.round(sum[k] || 0)).padStart(4)}`).join('  '));
  }
}
// 5 — storage full: a filler leaves no room, every save path must say so and mark nothing
if (ONLY.includes('storage')) {
  await cdp('Emulation.clearDeviceMetricsOverride');
  await ev(`window.__fvs.setTier('component'); window.__fvs.setCellShape('circle'); window.__fvs.setRailOpen(${RAIL}); new Promise(r => setTimeout(r, 800))`);
  // fill: grow one key until the browser refuses, then back off a little so only tiny writes still fit
  const filled = await ev(`(() => { localStorage.removeItem('organica.perf.filler'); let chunk = 'x'.repeat(1 << 20), s = '';
    for (;;) { try { localStorage.setItem('organica.perf.filler', s + chunk); s += chunk; } catch (e) { if (chunk.length <= 64) break; chunk = chunk.slice(0, chunk.length >> 1); } }
    return Math.round(s.length / 1024); })()`);
  const noticeText = () => ev(`(() => { const n = document.querySelector('.org-notice[data-kind="error"] .org-notice__text'); return n ? n.textContent : ''; })()`);
  const closeNotice = () => ev(`Organica.noticeClose && Organica.noticeClose(); new Promise(r => setTimeout(r, 2100))`);   // past the notice's 2 s de-duplication
  const st = [];
  const expectRefused = async (what, run) => {
    const before = await libCount();
    const r = await run();
    const n = await noticeText(), after = await libCount();
    const ok = /^Not saved:/.test(n) && after === before && !r.markedSaved;
    st.push(`${what}: ${ok ? 'refused, told' : 'FAIL'}`);
    if (!ok) fails.push(`storage full — ${what}: notice "${n}", library ${before} → ${after}, marked saved ${r.markedSaved}`);
    await closeNotice();
  };
  await expectRefused('save circle', async () => { const t = await save(false); return { markedSaved: await ev(`!!document.querySelector('#gallery .fvs-thumb.saved-in-library')`) || typeof t === 'number' }; });
  await expectRefused('Save all', async () => { await ev(`window.__fvs.saveAllComponentsToLibrary(); 1`); return { markedSaved: await ev(`window.__fvs.state.components.some(c => c.savedName)`) }; });
  await expectRefused('Element save', async () => { const n = await ev(`(() => { const F = window.__fvs; return F.saveElementVariant(0, false, false, '0°') || null; })()`); return { markedSaved: !!n }; });
  await expectRefused('Symbol save', async () => { await ev(`window.__fvs.setTier('symbol'); new Promise(r => setTimeout(r, 600))`); const had = await ev(`Object.keys(window.__fvs.SYMBOL_LIBRARY.read()).length`); await ev(`(() => { const F = window.__fvs; if (!F.state.symbolGrid && F.generateSymbol) F.generateSymbol(); F.saveSymbolAs('perf symbol'); return 1; })()`); return { markedSaved: (await ev(`Object.keys(window.__fvs.SYMBOL_LIBRARY.read()).length`)) !== had }; });
  // room again: the same save works
  await ev(`localStorage.removeItem('organica.perf.filler'); window.__fvs.setTier('component'); new Promise(r => setTimeout(r, 600))`);
  const again = await save(false);
  if (typeof again !== 'number') fails.push('storage freed — save circle: ' + again); else st.push('freed: saved in ' + again + ' ms');
  console.log(`storage   filled ${filled} KB of filler · ` + st.join(' · '));
}
if (errors.length) fails.push(...errors.slice(0, 5).map(e => 'page error: ' + e));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));

if (fails.length) { console.log(`FVS perf: FAIL — ${fails.length} problem(s)\n  ` + fails.slice(0, 20).join('\n  ')); done(1); }
console.log(`FVS perf: PASS — every save within ${MAX_MS} ms, every save stored, 0 page errors`);
done(0);
