#!/usr/bin/env node
// Re-capture the FVS rule atlas's Component data from the engine. Usage: node --experimental-websocket scripts/capture-fvs-atlas.mjs
//
// Serves the repo, opens /fvs/ in headless Chrome (clean profile), runs every Component rule through the engine
// (fvs/js/engine/03-rules.js) and rewrites the four data lines of design-system/_fvs-rules.html:
//   CELLS   — each rule's candidates on a 2×2 / 4×4 (+ the extra settings the cards show)
//   SIZES   — the "rules by grid size" table (counts, first cases, greyed reasons)
//   GROUPS  — every case of each rule, grouped by what changes, with the group's description
//   LATTICE — Step turn and Mirror on circle / triangle / hexagon cells: the cells' outlines + each cell's state
// Run it in the commit that changes a rule (the atlas's own rule: "re-capture when a rule changes"). Oct 13, 2026.
// --check: write nothing, exit 1 if the atlas is out of date with the engine (scripts/test-fvs.sh runs it as "atlas").
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATLAS = path.join(ROOT, 'design-system', '_fvs-rules.html');
const which = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  which('google-chrome'), which('chromium'), which('chromium-browser')].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No Chrome found (set CHROME=/path/to/chrome)'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Run with: node --experimental-websocket scripts/capture-fvs-atlas.mjs'); process.exit(2); }

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
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const done = code => { try { chrome.kill('SIGKILL'); } catch {} server.close(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {} process.exit(code); };
setTimeout(() => { console.log('Atlas capture: ERROR — timed out after 3 min'); done(1); }, 180000);
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  chrome.on('exit', () => reject(new Error('Chrome exited early')));
});
const pages = await (await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json`)).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await cdp('Page.enable');
await cdp('Page.navigate', { url: `http://localhost:${port}/fvs/` });
for (let i = 0; i < 120; i++) {
  await sleep(250);
  const r = await cdp('Runtime.evaluate', { expression: '!!(window.__fvs && window.__fvs.isReady) && document.readyState === "complete"', returnByValue: true });
  if (r.result?.result?.value) break;
}
await sleep(400);

// Runs inside /fvs/. Only control values and the model are touched (no render, no save), and everything is put back.
const CAPTURE = async () => {
  const R = await import('/fvs/js/engine/03-rules.js'), UI = await import('/fvs/js/06-component-ui.js');
  const st = window.__fvs.state, $ = id => document.getElementById(id), F = R.FAMILIES;
  const ids = ['rg-grid-cols', 'rg-grid-rows', 'chk-axis-rotation', 'chk-axis-flip', 'chk-axis-scale', 'sel-rhythm-angle', 'rg-rhythm-shift', 'rg-rhythm-across', 'rg-rhythm-down', 'sel-rhythm-amp', 'rg-rhythm-period', 'rg-random-count', 'num-seed'];
  const set = o => { for (const [k, v] of Object.entries(o)) { const e = $(k); if (e.type === 'checkbox') e.checked = v; else e.value = v; } };
  const base = { 'chk-axis-rotation': true, 'chk-axis-flip': false, 'chk-axis-scale': false, 'sel-rhythm-angle': '90', 'rg-rhythm-shift': 1, 'rg-rhythm-across': 3, 'rg-rhythm-down': 4, 'sel-rhythm-amp': '90', 'rg-rhythm-period': 4, 'rg-random-count': 16, 'num-seed': 1 };
  const fmt = c => `${c.rotation}${c.flipH ? 'h' : ''}${c.flipV ? 'v' : ''}${c.scale !== 1 ? '@' + c.scale : ''}`;
  const row = cells => cells.map(fmt).join(' ');
  st.cellShape = 'square'; st.mirrorLine = 'both'; st.mirrorSpread = 'cell'; st.checkerStart = 0; st.radialReading = 'quadrants';
  st.rhythm = { mode: 'beat', beat: [0, 90, 0], combine: 'add' };
  const grid = (n, o = {}, m = n) => { set({ ...base, 'rg-grid-cols': n, 'rg-grid-rows': m, ...o }); return R.ruleCR(); };
  const fns = { identity: () => R.ruleIdentity(), pinwheel: () => R.rulePinwheel(), mirror: () => R.ruleMirror(), checkerboard: () => R.ruleCheckerboard(), radial: () => R.ruleRadial(), hlines: () => R.ruleLines('row'), vlines: () => R.ruleLines('col'), oscillator: () => R.ruleOscillator(), random: () => R.ruleRandom(), exhaustive: () => R.ruleExhaustive() };
  const run = (k, n) => { const r = fns[k](); return { n: r.length, s: r.slice(0, n).map(x => row(x.cells)) }; };

  // CELLS
  const CELLS = {};
  for (const sz of [2, 4]) { grid(sz); for (const k of Object.keys(fns)) { const r = run(k, sz === 2 ? 8 : 4); CELLS[`${sz}|${k}`] = { n: r.n, c: sz, r: sz, s: r.s }; } }
  const extra = (key, sz, over, k, n) => { grid(sz, over); const r = run(k, n); CELLS[key] = { n: r.n, c: sz, r: sz, s: r.s }; };
  extra('2|checkerboard|RF', 2, { 'chk-axis-flip': true }, 'checkerboard', 6);
  extra('2|exhaustive|RF', 2, { 'chk-axis-flip': true }, 'exhaustive', 1);
  st.rhythm.beat = [0, 90, 180, 270]; extra('4|osc|ramp', 4, { 'rg-rhythm-shift': 1 }, 'oscillator', 1); st.rhythm.beat = [0, 90, 0];
  extra('2|pinwheel|S', 2, { 'chk-axis-scale': true }, 'pinwheel', 6);
  extra('4|random|RFS', 4, { 'chk-axis-flip': true, 'chk-axis-scale': true }, 'random', 6);
  CELLS['3|radial'] = 'disabled';

  // SIZES
  const SIZES = {}, sel = $('sel-rule');
  for (const sz of ['1x1', '2x1', '4x1', '1x4', '3x2', '3x3', '2x4']) {
    const [c, r] = sz.split('x').map(Number); grid(c, {}, r); UI.syncRuleAvailability(); SIZES[sz] = {};
    for (const k of Object.keys(fns)) {
      const o = sel.querySelector(`option[value="${k}"]`);
      if (o.disabled) { SIZES[sz][k] = o.title; continue; }
      set({ 'chk-axis-flip': false }); const a = run(k, 3); set({ 'chk-axis-flip': true }); const b = fns[k]().length; set({ 'chk-axis-flip': false });
      SIZES[sz][k] = b !== a.n ? [a.n, a.s, b] : [a.n, a.s];
    }
  }

  // GROUPS
  const g = (t, d, n, s, m = n) => ({ t, d, c: n, r: m, s });
  const B = (cr, fam, p) => row(F[fam].build(p, cr));
  const G = {};
  let cr = grid(2);
  G.identity = [g('As drawn', 'every cell 0°, no flip, scale 1 — always one result on square cells, whatever the axes', 2, [B(cr, 'identity', { rotation: 0, flipH: false, flipV: false, scale: 1 })])];
  G.pinwheel = [g('Clockwise', 'start 0° · 90° · 180° · 270°; each next cell (reading order) +90°', 2, [0, 90, 180, 270].map(b => B(cr, 'pinwheel', { base: b, chirality: 1, scale: 1 }))),
    g('Counter‑clockwise', 'the same starts; each next cell −90°', 2, [0, 90, 180, 270].map(b => B(cr, 'pinwheel', { base: b, chirality: -1, scale: 1 })))];
  let cr4 = grid(4);
  G.pinwheel.push(g('On a 4×4', 'start 0°, clockwise · counter‑clockwise — step (col + 2·row) mod 4: each column +90°, each row +180°, the turns drift diagonally', 4, [1, -1].map(ch => B(cr4, 'pinwheel', { base: 0, chirality: ch, scale: 1 }))));
  cr = grid(2);
  const M = (c, p) => row(R.GRID_BUILD.mirrorLine(c || R.CR_2X2, p.seed, p.line, p.rotation, 1, p.spread || 'cell'));
  G.mirror = [0, 90, 180, 270].map(t => g(`All around · turn ${t}°`, t === 0 ? 'the plain Element as drawn; the plain cell in each corner (top left · top right · bottom left · bottom right); its side neighbour flipped left–right, the one below top–bottom, the diagonal both' : `the plain Element turned ${t}° first; the other cells its mirror images; the plain cell in each corner`, 2, [0, 1, 2, 3].map(sd => M(cr, { seed: sd, line: 'both', rotation: t }))));
  G.mirror.push(g('Side by side', 'every other column flipped left–right; the plain cell on the left or the right × turn 0° · 90° · 180° · 270°', 2, [0, 90, 180, 270].flatMap(t => [0, 1].map(sd => M(cr, { seed: sd, line: 'lr', rotation: t })))));
  G.mirror.push(g('Above and below', 'every other row flipped top–bottom; the plain cell on top or below × turn 0° · 90° · 180° · 270°', 2, [0, 90, 180, 270].flatMap(t => [0, 2].map(sd => M(cr, { seed: sd, line: 'tb', rotation: t })))));
  cr4 = grid(4);
  G.mirror.push(g('Pattern Alternate · on a 4×4', 'a mirror line between every pair of neighbours — the 2×2 tile repeats (All around, turn 0°, the plain cell in each corner)', 4, [0, 1, 2, 3].map(sd => M(cr4, { seed: sd, line: 'both', rotation: 0 }))));
  G.mirror.push(g('Pattern In pairs · on a 4×4', 'a mirror line every two cells — F F′ F′ F (All around · Side by side · Above and below, turn 0°); needs 3 or more cells along the mirror’s direction', 4, ['both', 'lr', 'tb'].map(l => M(cr4, { seed: 0, line: l, rotation: 0, spread: 'pair' }))));
  G.mirror.push(g('Pattern Book · on a 4×4', 'one mirror line through the middle of the grid, like an open book — Side by side: left | right · Above and below: top | bottom · All around: both ways, its only result (turn 0°; with Turns on, × each turn)', 4, ['h', 'v', 'hv'].map(a => B(cr4, 'bookmatch', { axis: a, rotation: 0, scale: 1 }))));
  cr = grid(2);
  const chk = () => R.ruleCheckerboard().map(x => row(x.cells));
  G.checkerboard = [g('Every pair, both starts', 'two different poses alternate — A where column + row is even (the top‑left cell), B on the others; every ordered pair, so each board starts once on A and once on B: 4 turns → 12', 2, chk())];
  grid(2, { 'chk-axis-flip': true });
  const rf = chk();
  G.checkerboard.push(g('With Flip on', `a pose = turn × flipped or not (top–bottom = left–right turned 180°, both = 180°): 8 poses, every ordered pair — ${rf.length}; the first 8 shown. With Scale on, × the three sizes too`, 2, rf.slice(0, 8)));
  cr = grid(2);
  G.checkerboard.push(g('Diagonal mirror pattern', 'A = R, B = 90° − R: 0° / 90°, 90° / 0°, 180° / 270°, 270° / 180° — four of the twelve plain-turn boards', 2, [0, 90, 180, 270].map(r => B(cr, 'diagonal', { rotation: r, scale: 1 }))));
  const RN = { quadrants: 'By quadrant', blocks: 'By 2×2 block', centre: 'By cell' };
  const rad = (n, m, reading, ch) => { grid(n, {}, m); const all = R.ruleRadial(), many = all.some(x => x.rv.sec.includes('By ')); return all.filter(x => x.rv.sec.endsWith(ch > 0 ? 'Clockwise' : 'Counter-clockwise') && (!many || x.rv.sec.startsWith(RN[reading]))).map(x => row(x.cells)); };
  G.radial = [g('Turn by Quadrant · clockwise', 'a walk TL → TR → BR → BL, +90° each — four quarter‑arcs close a circle; start 0° · 90° · 180° · 270°', 2, rad(2, 2, 'quadrants', 1)),
    g('Turn by Quadrant · counter‑clockwise', 'the same walk, −90° each', 2, rad(2, 2, 'quadrants', -1)),
    g('Turn by Quadrant · on a 4×4', 'the grid cut into 4 quadrants, each quadrant one step of the walk — one rosette of blocks (start 0° · 90° · 180° · 270°, clockwise)', 4, rad(4, 4, 'quadrants', 1)),
    g('Turn by Each 2×2 · on a 4×4', 'every 2×2 block takes the walk — a rosette per block (start 0° · 90° · 180° · 270°, clockwise)', 4, rad(4, 4, 'blocks', 1)),
    g('Turn by Cell · on a 4×4', 'each cell turned by its own angle around the centre, not snapped — a true rosette (start 0° · 90° · 180° · 270°, clockwise)', 4, rad(4, 4, 'centre', 1)),
    g('Turn by Cell · on a 3×3', 'odd grids too: the middle cell stays at the start, the mid‑line cells land on 45° steps (start 0° · 90° · 180° · 270°, clockwise)', 3, rad(3, 3, 'centre', 1))];
  const lines = (axis, mode) => [90, 180, 270].map(stp => { grid(4); return row(R.ruleLines(axis, { mode, step: stp })[0].cells); });
  G.hlines = [g('Alternate', 'odd rows take Step: Step 90° · 180° · 270°', 4, lines('row', 'alternate')), g('Ramp', 'each row turns Step more than the row above: Step 90° · 180° · 270°', 4, lines('row', 'ramp'))];
  G.vlines = [g('Alternate', 'odd columns take Step: Step 90° · 180° · 270°', 4, lines('col', 'alternate')), g('Ramp', 'each column turns Step more than the one before: Step 90° · 180° · 270°', 4, lines('col', 'ramp'))];
  const osc = (mode, list) => list.map(([o, rh]) => { st.rhythm = { mode, beat: [0, 90, 0], combine: 'add', ...rh }; grid(4, o); return row(R.ruleOscillator()[0].cells); });
  G.oscillator = [g('Beat 0° · 90° · 0°', 'the beat repeats along each row; Row shift 0 · 1 · 2 slides the next row along', 4, osc('beat', [[{ 'rg-rhythm-shift': 0 }], [{ 'rg-rhythm-shift': 1 }], [{ 'rg-rhythm-shift': 2 }]])),
    g('Beat · longer beats', '0° · 90° · 180° · 270° (a ramp) · 0° · 0° · 180° · 90° · 90° · 270° (Row shift 1)', 4, osc('beat', [[{}, { beat: [0, 90, 180, 270] }], [{}, { beat: [0, 0, 180] }], [{}, { beat: [90, 90, 270] }]])),
    g('Two beats · Add · One only · Both', 'a beat every 3 cells along the row (Across) and every 2 rows (Down), Angle 90°: each turns its cells, twice where they meet · cells on exactly one · only where they meet', 4, osc('beats', ['add', 'one', 'both'].map(c => [{ 'rg-rhythm-across': 3, 'rg-rhythm-down': 2 }, { combine: c }]))),
    g('Wave · Amplitude 90° · 180°', 'the turn follows a sine along the row, snapped to quarter turns: Period 4 · 90°, Period 6 · 180°, Period 8 · 180° with Row shift 0.5 (a tilted wave front)', 4, osc('wave', [[{ 'rg-rhythm-period': 4 }], [{ 'sel-rhythm-amp': '180', 'rg-rhythm-period': 6 }], [{ 'sel-rhythm-amp': '180', 'rg-rhythm-period': 8, 'rg-rhythm-shift': 0.5 }]]))];
  st.rhythm = { mode: 'beat', beat: [0, 90, 0], combine: 'add' };
  cr = grid(2);
  G.random = [g('Seed 1 · Count 16', 'each result a family drawn at random, then one of its settings — every result a real symmetry; another Seed, other results', 2, R.ruleRandom().map(x => row(x.cells)))];
  cr = grid(2);
  const av = R.axisValues(), seen = new Set(), names = { identity: 'Uniform', pinwheel: 'Step turn', mirror: 'Mirror', bookmatch: 'Book‑match', diagonal: 'Diagonal mirror pattern', checkerboard: 'Checkerboard', radial: 'Radial' };
  G.exhaustive = [];
  for (const k of R.activeFamilies()) {
    const list = [];
    for (const p of F[k].paramSpace(av, cr)) { const cells = F[k].build(p, cr), key = R.componentKey(cells); if (seen.has(key)) continue; seen.add(key); list.push(row(cells)); }
    if (list.length) G.exhaustive.push(g(`From ${names[k] || k}`, `${list.length} new — the cases not already listed by an earlier family`, 2, list));
  }

  // LATTICE — the engine's own cells and states on circle / triangle / hexagon cells
  const L = {}, keep = { shape: st.cellShape, lattice: { ...st.cellLattice }, outline: { ...st.cellOutline } };
  const lat = (key, shape, rings, outline) => {
    st.cellShape = shape; st.cellLattice[shape] = rings; st.cellOutline[shape] = outline; set({ ...base });
    const gr = R.getGrid();
    const cells = gr.cells.map(c => ({ pts: c.points.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), c: [+c.centroid[0].toFixed(2), +c.centroid[1].toFixed(2)], b: c.baseRot || 0 }));
    st.checkerStart = 0;
    const step = R.latticeRule('pinwheel')[0].cells.map(fmt), mirror = R.latticeRule('mirror').slice(0, 2).map(x => x.cells.map(fmt));
    const chkL = R.latticeRule('checkerboard'), checker = chkL[0].cells.map(fmt), nStates = R.latticeCheckerClasses().n;
    L[key] = { shape, kind: R.latticeMirrorKind(), cells, step, mirror, checker, nStates, nStep: R.latticeRule('pinwheel').length, nMirror: R.latticeRule('mirror').length, nChecker: chkL.length };
  };
  lat('hexagon', 'hexagon', 2, 'hexagon'); lat('triangle', 'triangle', 2, 'hexagon'); lat('circleHex', 'circle', 2, 'hexagon'); lat('circleSquare', 'circle', 3, 'square');
  st.cellShape = keep.shape; Object.assign(st.cellLattice, keep.lattice); Object.assign(st.cellOutline, keep.outline);
  return JSON.stringify({ CELLS, SIZES, GROUPS: G, LATTICE: L });
};
const r = await cdp('Runtime.evaluate', { expression: `(${CAPTURE.toString()})()`, awaitPromise: true, returnByValue: true });
if (!r.result?.result?.value) { console.log('Atlas capture: ERROR —', JSON.stringify(r.result?.exceptionDetails || r.result).slice(0, 600)); done(1); }
const data = JSON.parse(r.result.result.value);
let html = fs.readFileSync(ATLAS, 'utf8');
for (const name of ['CELLS', 'SIZES', 'GROUPS', 'LATTICE']) {
  const re = new RegExp(`^const ${name} = .*;$`, 'm'), line = `const ${name} = ${JSON.stringify(data[name])};`;
  if (re.test(html)) html = html.replace(re, () => line);
  else if (name === 'LATTICE') html = html.replace(/^const SIZES = /m, () => `${line}\nconst SIZES = `);
  else { console.log(`Atlas capture: ERROR — no "const ${name} =" line in the atlas`); done(1); }
}
if (process.argv.includes('--check')) {
  const same = html === fs.readFileSync(ATLAS, 'utf8');
  console.log(same ? 'Atlas check: PASS — design-system/_fvs-rules.html matches the engine'
    : 'Atlas check: FAIL — the rule atlas is out of date: node --experimental-websocket scripts/capture-fvs-atlas.mjs, review the diff, commit it');
  done(same ? 0 : 1);
}
fs.writeFileSync(ATLAS, html);
console.log(`Atlas capture: OK — ${Object.keys(data.GROUPS).length} rules, ${Object.values(data.GROUPS).flat().length} groups, ${Object.keys(data.LATTICE).length} lattices → design-system/_fvs-rules.html`);
done(0);
