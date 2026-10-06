#!/usr/bin/env node
// One-off generator (branch fvs-split, Oct 2026): splits fvs/index.html's inline <style> and <script> into
// fvs/fvs.css + fvs/js/NN-*.js classic scripts, loaded in order. Re-runnable on a fresh main: the cuts are
// ANCHORS (the source text a region's first top-level statement starts with), not line numbers, so code
// added later lands in whichever region it sits in. Deleted after the merge — from then on the files are
// the source.
//
// Usage: node scripts/fvs-split.mjs [--dry]      (needs acorn: ACORN_DIR or a node_modules that has it)
//
// Self-checks (exit 1 on any): every script line lands in exactly one file (multiset equal, generated
// headers aside); the <style> body equals fvs.css; no top-level name is declared twice; every file passes
// `node --check` as a module (what scripts/check.py runs on */js/*.js); no top-level statement needs, at
// parse time, a binding first declared in a LATER file (would throw across classic scripts, where function
// hoisting no longer reaches); both SEED_TYPES geometry wraps stay in 01-geometry.js, in order.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ACORN_DIRS = [process.env.ACORN_DIR, path.join(ROOT, 'node_modules'), '/Users/diego/projects/terragen-plan/node_modules'].filter(Boolean);
const dir = ACORN_DIRS.find(d => fs.existsSync(path.join(d, 'acorn')));
if (!dir) { console.error('acorn not found — set ACORN_DIR to a node_modules that has it'); process.exit(2); }
const acorn = require(path.join(dir, 'acorn'));
const DRY = process.argv.includes('--dry');

// Region → the text its first top-level statement starts with. Order matters; each must appear once, in order.
const ANCHORS = [
  ['00-core', 'State, palette and colour rules — the shared state object every other file reads', null],
  ['01-geometry', 'Seed geometry — Seed types, cell shapes and lattices, Cut out, Irregularity, Split', /^const \{[^}]*\} = Organica\.shapes/s],
  ['02-seed-ui', 'Element panel — Seed extras, seed picker, freehand, getSeed / getPanelSeed, SVG upload', /^const SEED_EXTRAS\b/],
  ['03-rules', 'Component grid + transform rules — FAMILIES, lattice rules, rule builders', /^function getGrid\(/],
  ['04-appearance', 'Items, appearance, Pattern / Ground, Element as tile, Saved Elements', /^function buildComponentItems\(/],
  ['05-render-component', 'Component render — stack layers, canvas + SVG, seed preview strip, gallery', /^const LAYER_ROLES\b/],
  ['06-component-ui', 'Component UI — Edit mode, rule UI, undo, Colourways, Generate, Split', /^function enterComponentEditMode\(/],
  ['07-library', 'Component library + layers UI + Underlying picker', /^const LIBRARY\b/],
  ['08-symbol-grid', 'Symbol grid — presets, Loom models, Symbol Canvas, generators, arrival, Fit / Anchor', /^const SYMBOL_GRID_PRESETS\b/],
  ['09-symbol-render', 'Symbol render — spans, outlines, buildSymbolItems / buildSymbolSVG / drawSymbolCanvas', /^let _symLattice\b/],
  ['10-suggest', 'Arrange + Suggest — pool, scoring, variations dock', /^const SYMBOL_ARRANGE\b/],
  ['11-symbol-ui', 'Symbol UI — rule layer, overlays, renderSymbol, track drag, cell properties, Symbol library + export', /^function cellColRow\(/],
  ['12-shell', 'Shell — tier switch, zoom / pan, shortcuts, panel wiring, export by tier', /^const STEP_EXPORT_HINTS\b/],
  ['13-figure-engine', 'Figure engine — recipes v1 fixtures, recipe v2 validate / run, catalogs', /^const LEAF_CELLS\b/],
  ['14-figure-ui', 'Figure UI — form ↔ recipe, pipeline, history, paint tools, Play, checks', /^const FIGURE_CLASSIC_LABELS\b/],
  ['15-export-library-view', 'Variants, Plates, recipe import / export, init, Library rail, Delete, Library view', /^const VARIANTS\b/],
  ['99-boot', 'Boot — first render, tier, cloud sync of the libraries', /^setRailOpen\(false\)/],
];

const PAGE = path.join(ROOT, 'fvs', 'index.html');
const html = fs.readFileSync(PAGE, 'utf8');
const sm = html.match(/\n<style>\n([\s\S]*?)<\/style>\n/);
if (!sm) throw new Error('no inline <style> block');
const scm = html.match(/\n<script>\n([\s\S]*?)<\/script>\n/);
if (!scm) throw new Error('no inline <script> block');
let src = scm[1];
const lines = src.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
if (lines[0] !== "'use strict';") throw new Error("expected the script to start with 'use strict'; (stage 0)");

const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
const stmts = ast.body;
// assign statements to files
const fileOf = []; let fi = 0; const startStmt = [0];
stmts.forEach((st, i) => {
  const text = src.slice(st.start, st.start + 800);
  for (let k = fi + 1; k < ANCHORS.length; k++) {
    if (ANCHORS[k][2].test(text)) {
      if (k !== fi + 1) throw new Error(`anchor ${ANCHORS[k][0]} found before ${ANCHORS[fi + 1][0]}`);
      fi = k; startStmt[k] = i;
    }
  }
  fileOf[i] = fi;
});
if (fi !== ANCHORS.length - 1) throw new Error(`anchor ${ANCHORS[fi + 1][0]} not found`);

// line cut: a file starts on the line after the previous statement ends (leading comments go with the region)
const cut = [1];   // 0-based line index where each file starts (line 0 = 'use strict')
for (let k = 1; k < ANCHORS.length; k++) {
  const prev = stmts[startStmt[k] - 1], cur = stmts[startStmt[k]];
  if (prev.loc.end.line >= cur.loc.start.line) throw new Error(`${ANCHORS[k][0]}: anchor shares a line with the previous statement`);
  cut[k] = prev.loc.end.line;   // loc lines are 1-based → index of the line after prev ends
}
cut.push(lines.length);

// ── self-check: parse-time bindings from a later file ──
const patNames = (p, out) => { if (!p) return; if (p.type === 'Identifier') out.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => patNames(q.type === 'RestElement' ? q.argument : q.value, out)); else if (p.type === 'ArrayPattern') p.elements.forEach(e => patNames(e, out)); else if (p.type === 'AssignmentPattern') patNames(p.left, out); else if (p.type === 'RestElement') patNames(p.argument, out); };
const declFile = new Map(), fnNode = new Map(), dup = [];
stmts.forEach((st, i) => {
  const names = [];
  if (st.type === 'FunctionDeclaration') { names.push(st.id.name); fnNode.set(st.id.name, st); }
  else if (st.type === 'VariableDeclaration') st.declarations.forEach(d => patNames(d.id, names));
  else if (st.type === 'ClassDeclaration') names.push(st.id.name);
  names.forEach(n => { if (declFile.has(n)) dup.push(n); declFile.set(n, fileOf[i]); });
});
function refs(node) {   // identifiers used now + functions called now (deferred callbacks skipped; IIFEs + array callbacks run now)
  const used = new Set(), called = new Set();
  const visit = (n, parent) => {
    if (!n || typeof n.type !== 'string') return;
    if ((n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') && parent) {
      const iife = parent.type === 'CallExpression' && parent.callee === n;
      const arrCb = parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' && /^(forEach|map|filter|some|every|reduce|find|findIndex|flatMap|sort)$/.test(parent.callee.property.name || '');
      if (!iife && !arrCb) return;
    }
    if (n.type === 'Identifier') used.add(n.name);
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier') called.add(n.callee.name);
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      if (n.type === 'MemberExpression' && k === 'property' && !n.computed) continue;
      if (n.type === 'Property' && k === 'key' && !n.computed) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => visit(c, n)); else if (v && typeof v.type === 'string') visit(v, n);
    }
  };
  visit(node, null);
  return { used, called };
}
const fnRefs = new Map(); for (const [n, node] of fnNode) fnRefs.set(n, refs(node.body));
const late = [];
stmts.forEach((st, i) => {
  if (st.type === 'FunctionDeclaration') return;
  const r0 = refs(st), need = new Set(r0.used), seen = new Set(), stack = [...r0.called];
  while (stack.length) { const f = stack.pop(); if (seen.has(f) || !fnRefs.has(f)) continue; seen.add(f); const r = fnRefs.get(f); r.used.forEach(x => need.add(x)); r.called.forEach(x => stack.push(x)); }
  const bad = [...need].filter(n => declFile.has(n) && declFile.get(n) > fileOf[i]);
  if (bad.length) late.push(`${ANCHORS[fileOf[i]][0]} line ${st.loc.start.line}: needs ${bad.slice(0, 5).join(', ')}`);
});

// ── write ──
const header = (name, desc) => [`// Flexible Visual System · ${name} — ${desc}.`,
  '// One of the classic scripts fvs/index.html loads in order (fvs/js/00 … 99); they share one global scope.',
  '// Architecture + file map: docs/FVS.md §Architecture.', "'use strict';"];
const HEADER_LINES = 4;
const outFiles = [];
for (let k = 0; k < ANCHORS.length; k++) {
  const [name, desc] = ANCHORS[k];
  const body = lines.slice(cut[k], cut[k + 1]);
  while (body.length && body[0].trim() === '') body.shift();     // blank lines at a cut
  outFiles.push({ name, file: path.join('fvs', 'js', name + '.js'), text: [...header(name, desc), ...body].join('\n') + '\n', body });
}
const css = sm[1];
// multiset check
const count = arr => arr.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
const orig = count(lines.slice(1).filter(l => l.trim() !== ''));
const got = count(outFiles.flatMap(f => f.body).filter(l => l.trim() !== ''));
const lost = [...orig].filter(([l, c]) => got.get(l) !== c);
const extra = [...got].filter(([l, c]) => orig.get(l) !== c);

const errs = [];
if (lost.length || extra.length) errs.push(`line multiset differs: ${lost.length} lost, ${extra.length} extra (e.g. ${JSON.stringify((lost[0] || extra[0])[0]).slice(0, 80)})`);
if (dup.length) errs.push('declared twice: ' + dup.join(', '));
if (late.length) errs.push('parse-time binding from a later file:\n    ' + late.join('\n    '));
const geo = outFiles[1].text;
const wA = geo.indexOf('Object.entries(SEED_TYPES).forEach(([type, t]) => {'), wB = geo.indexOf('for (const k of Object.keys(SEED_TYPES)) {');
const wraps = (wA >= 0) + (wB >= 0);
if (!(wA >= 0 && wB > wA)) errs.push('the two SEED_TYPES geometry wraps are not both in 01-geometry, cell-shape fit first');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-split-'));
for (const f of outFiles) {
  const t = path.join(tmp, f.name + '.mjs'); fs.writeFileSync(t, f.text);
  try { execFileSync(process.execPath, ['--check', t], { stdio: 'pipe' }); } catch (e) { errs.push(`${f.file}: node --check (module) failed: ${String(e.stderr).split('\n').slice(0, 4).join(' ')}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('fvs-split: ' + outFiles.map(f => `${f.name} ${kb(Buffer.byteLength(f.text))}`).join(' · '));
console.log(`  fvs.css ${kb(Buffer.byteLength(css))} · SEED_TYPES wraps in 01-geometry: ${wraps}`);
if (errs.length) { console.log('FAIL\n  ' + errs.join('\n  ')); process.exit(1); }

if (!DRY) {
  fs.mkdirSync(path.join(ROOT, 'fvs', 'js'), { recursive: true });
  for (const f of outFiles) fs.writeFileSync(path.join(ROOT, f.file), f.text);
  fs.writeFileSync(path.join(ROOT, 'fvs', 'fvs.css'), css);
  const tags = outFiles.map(f => `<script src="/${f.file}"></script>`).join('\n');
  let page = html.replace(sm[0], '\n<link rel="stylesheet" href="/fvs/fvs.css">\n');
  page = page.replace(scm[0], `\n<!-- Flexible Visual System — the tool's own scripts, classic, in order (one shared global scope). Map: docs/FVS.md §Architecture -->\n${tags}\n`);
  fs.writeFileSync(PAGE, page);
  console.log(`  wrote fvs/js/*.js (${outFiles.length}), fvs/fvs.css, fvs/index.html ${kb(Buffer.byteLength(page))}`);
}
console.log('PASS — every line placed once, no duplicates, every file parses, no parse-time reach into a later file');
