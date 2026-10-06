#!/usr/bin/env node
// One-off transform (branch fvs-split, Oct 2026, stage B): the classic fvs/js/NN-*.js files (one shared
// global scope) → native ES modules, without changing what runs or in which order.
//
//   • every top-level declaration is exported; a file imports, by name, what it uses from EARLIER files —
//     so the import graph only points backwards and modules evaluate in the same order the scripts ran;
//   • a reference to a LATER file (only ever reached at run time, never while the files load — checked by
//     scripts/fvs-split.mjs) reads it from `hooks` (fvs/js/hooks.js), which the later file fills with live
//     getters (its first statement): hooks.renderLibraryRail() — the upward edges, named in the code;
//   • a top-level variable assigned from a file other than its own (an imported binding is read-only) lives
//     on `rt` (fvs/js/rt.js): rt.paperPatternOn;
//   • fvs/js/main.js imports the files in order, then fvs/js/test-surface.js puts every export on
//     window.__fvs (live getters) for the harnesses, and resolves __fvs.ready.
//
// Usage: node scripts/fvs-modules.mjs [--dry]     (needs acorn + eslint-scope: ACORN_DIR)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extractEngine } from './fvs-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dir = [process.env.ACORN_DIR, path.join(ROOT, 'node_modules'), '/Users/diego/projects/terragen-plan/node_modules']
  .filter(Boolean).find(d => fs.existsSync(path.join(d, 'acorn')) && fs.existsSync(path.join(d, 'eslint-scope')));
if (!dir) { console.error('acorn + eslint-scope not found — set ACORN_DIR'); process.exit(2); }
const acorn = require(path.join(dir, 'acorn'));
const eslintScope = require(path.join(dir, 'eslint-scope'));
const DRY = process.argv.includes('--dry');

const JS = path.join(ROOT, 'fvs', 'js');
const classicFiles = fs.readdirSync(JS).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const classicTexts = classicFiles.map(f => fs.readFileSync(path.join(JS, f), 'utf8'));
if (classicTexts.some(t => /^export |^import /m.test(t))) { console.error('already modules'); process.exit(1); }
// engine first (fvs/js/engine/NN-*.js — model + logic, no DOM UI; scripts/fvs-engine.mjs), then the UI files
const ENG = extractEngine(classicFiles, classicTexts, { acorn, eslintScope });
const files = ENG.files;
const texts = ENG.texts.map((t, i) => !files[i].startsWith('engine/') ? t : [
  `// Flexible Visual System · ${files[i].replace(/\.js$/, '')} — the engine part of ${files[i].slice(7)}: model + logic, no DOM UI.`,
  '// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths',
  '// and the offscreen measuring helpers. Chosen mechanically by scripts/fvs-engine.mjs. Map: docs/FVS.md §Architecture.',
  "'use strict';", t].join('\n'));
const rel = (from, to) => { const r = path.posix.relative(path.posix.dirname(from), to); return r.startsWith('.') ? r : './' + r; };
let src = ''; const ranges = [];
texts.forEach((t, i) => { ranges.push({ start: src.length, end: src.length + t.length }); src += t + '\n'; });
const fileAt = pos => ranges.findIndex(r => pos >= r.start && pos < r.end);
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const mod = sm.scopes.find(s => s.type === 'module');

// parent map (for shorthand properties)
const parent = new Map();
(function link(n, p) { if (!n || typeof n.type !== 'string') return; parent.set(n, p);
  for (const k of Object.keys(n)) { const v = n[k]; if (k === 'range') continue;
    if (Array.isArray(v)) v.forEach(c => link(c, n)); else if (v && typeof v.type === 'string') link(v, n); } })(ast, null);

const decl = new Map();   // name → { file, v, stmt }
const stmtOf = node => { let n = node; while (parent.get(n) && parent.get(n).type !== 'Program') n = parent.get(n); return n; };
for (const v of mod.variables) {
  if (!v.defs.length) continue;
  const d = v.defs[0];
  decl.set(v.name, { file: fileAt(d.name.range[0]), v, stmt: stmtOf(d.name), kind: d.type });
}
// rt: assigned from a file other than its own
const RT = new Set();
for (const [name, d] of decl) for (const r of d.v.references)
  if (r.isWrite() && r.identifier !== d.v.defs[0].name && fileAt(r.identifier.range[0]) !== d.file) RT.add(name);

const edits = files.map(() => []);           // { start, end, text } in file-local offsets
const imports = files.map(() => new Map());  // fromFile → Set(names)
const provides = files.map(() => new Set()); // names a file puts on hooks
const usesHooks = new Set(), usesRt = new Set();
const local = (fi, pos) => pos - ranges[fi].start;
const rewriteRef = (fi, id, text) => {
  const p = parent.get(id);
  if (p && p.type === 'Property' && p.shorthand && p.value === id) edits[fi].push({ start: local(fi, p.range[0]), end: local(fi, p.range[1]), text: `${id.name}: ${text}` });
  else edits[fi].push({ start: local(fi, id.range[0]), end: local(fi, id.range[1]), text });
};
let up = 0;
for (const [name, d] of decl) {
  for (const r of d.v.references) {
    const id = r.identifier, fi = fileAt(id.range[0]);
    if (id === d.v.defs[0].name) continue;
    if (RT.has(name)) { rewriteRef(fi, id, 'rt.' + name); usesRt.add(fi); continue; }
    if (fi === d.file) continue;
    if (fi > d.file) { if (!imports[fi].has(d.file)) imports[fi].set(d.file, new Set()); imports[fi].get(d.file).add(name); }
    else { rewriteRef(fi, id, 'hooks.' + name); usesHooks.add(fi); provides[d.file].add(name); up++; }
  }
}
// declarations: export, or rt for the RT names
for (const st of ast.body) {
  const fi = fileAt(st.range[0]);
  if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') {
    edits[fi].push({ start: local(fi, st.range[0]), end: local(fi, st.range[0]), text: 'export ' }); continue;
  }
  if (st.type !== 'VariableDeclaration') continue;
  const rtDecls = st.declarations.filter(dc => dc.id.type === 'Identifier' && RT.has(dc.id.name));
  if (!rtDecls.length) { edits[fi].push({ start: local(fi, st.range[0]), end: local(fi, st.range[0]), text: 'export ' }); continue; }
  if (rtDecls.length !== st.declarations.length) throw new Error('mixed rt / non-rt declaration: ' + src.slice(st.range[0], st.range[0] + 80));
  // `let a = 1, b;` → `rt.a = 1; rt.b = undefined;` (the init text keeps its own rewrites: apply them inside)
  const parts = st.declarations.map(dc => {
    let initText = 'undefined';
    if (dc.init) {
      const inner = edits[fi].filter(e => e.start >= local(fi, dc.init.range[0]) && e.end <= local(fi, dc.init.range[1]));
      let t = src.slice(dc.init.range[0], dc.init.range[1]);
      inner.sort((a, b) => b.start - a.start).forEach(e => { const o = local(fi, dc.init.range[0]); t = t.slice(0, e.start - o) + e.text + t.slice(e.end - o); });
      edits[fi] = edits[fi].filter(e => !inner.includes(e));
      initText = t;
    }
    return `rt.${dc.id.name} = ${initText};`;
  });
  edits[fi].push({ start: local(fi, st.range[0]), end: local(fi, st.range[1]), text: parts.join(' ') });
  usesRt.add(fi);
}
// apply
const wrapList = (names, indent) => { const out = []; let line = ''; for (const n of names) { if ((line + n).length > 104) { out.push(line.trimEnd()); line = ''; } line += n + ', '; } if (line) out.push(line.replace(/, $/, '')); return out.map(l => indent + l).join('\n'); };
const out = files.map((f, fi) => {
  let t = texts[fi];
  const es = edits[fi].sort((a, b) => b.start - a.start || b.end - a.end);
  for (let k = 1; k < es.length; k++) if (es[k].end > es[k - 1].start && !(es[k].start === es[k - 1].start && es[k].end === es[k - 1].end && es[k].start === es[k].end)) throw new Error(`${f}: overlapping edits at ${es[k].start}`);
  for (const e of es) t = t.slice(0, e.start) + e.text + t.slice(e.end);
  const lines = t.split('\n');
  const hi = lines.findIndex(l => l === "'use strict';");
  if (hi < 0 || hi > 4) throw new Error(f + ': header');
  const head = lines.slice(0, hi).map(l => l.replace('One of the classic scripts fvs/index.html loads in order (fvs/js/00 … 99); they share one global scope.',
    'An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.'));
  const imp = [];
  if (usesRt.has(fi)) imp.push(`import { rt } from '${rel(f, 'rt.js')}';`);
  if (usesHooks.has(fi)) imp.push(`import { hooks } from '${rel(f, 'hooks.js')}';`);
  [...imports[fi].keys()].sort((a, b) => a - b).forEach(from => {
    const names = [...imports[fi].get(from)].sort();
    imp.push(`import {\n${wrapList(names, '  ')}\n} from '${rel(f, files[from])}';`);
  });
  const prov = [...provides[fi]].sort();
  // provide() runs first: a file's own load-time code may call an earlier file that reads one of these hooks
  // (the classic scripts had them hoisted). Getters — a const is read only when asked for, as before.
  const prov_ = prov.length ? [`// Names earlier files reach at run time (hooks.*) — live getters.`,
    `provide({\n${wrapList(prov.map(n => `${n}: () => ${n}`), '  ')}\n});`] : [];
  if (prov.length) imp.push(`import { provide } from '${rel(f, 'hooks.js')}';`);
  return [...head, ...imp, ...prov_, ...lines.slice(hi + 1)].join('\n').replace(/\n*$/, '\n');
});
// the one test hook in the tool's code: a function wrapping loadSymbolGrid from outside can no longer reach the
// calls inside the modules (the classic battery replaced window.loadSymbolGrid), so loadSymbolGrid calls it.
{
  const fi = files.indexOf('08-symbol-grid.js');
  const a = 'export function loadSymbolGrid(model) {';
  if (!out[fi].includes(a)) throw new Error('loadSymbolGrid not found');
  out[fi] = out[fi].replace(a, 'function loadSymbolGridNow(model) {') +
    `\n// Every caller goes through here; rt.afterLoadSymbolGrid is a test hook (fvs/_test-regression.html), null in use.\n` +
    `export function loadSymbolGrid(model) {\n  loadSymbolGridNow(model);\n  if (rt.afterLoadSymbolGrid) rt.afterLoadSymbolGrid(model);\n}\n`;
  if (!out[fi].includes(`import { rt } from './rt.js';`)) out[fi] = out[fi].replace(/^(\/\/.*\n)+/, m => m + `import { rt } from './rt.js';\n`);
}
// merge a duplicate hooks import line (provide + hooks)
for (let fi = 0; fi < out.length; fi++) { const h = rel(files[fi], 'hooks.js');
  out[fi] = out[fi].replace(`import { hooks } from '${h}';\n`, m => out[fi].includes(`import { provide } from '${h}';`) ? '' : m)
    .replace(`import { provide } from '${h}';`, m => usesHooks.has(fi) ? `import { hooks, provide } from '${h}';` : m); }

const RT_JS = `// Flexible Visual System · rt — the top-level variables more than one file assigns (an imported binding is
// read-only, so they live here as properties). Each file still sets its own initial value where it always did.
// Also the test flags the harnesses set through window.__fvs.
export const rt = {
  afterLoadSymbolGrid: null,   // test hook: called with the model after every loadSymbolGrid() (the regression battery pins Clip to cell)
};
`;
const HOOKS_JS = `// Flexible Visual System · hooks — the references from an earlier file to a later one. The import graph only
// points backwards (files evaluate in order: 00 → 99), so a later file puts the names earlier files call
// at run time here, as live getters (provide() is the first statement of that file). No hook is read while
// the files load before the file that provides it.
export const hooks = {};
export function provide(getters) {
  for (const [name, get] of Object.entries(getters)) Object.defineProperty(hooks, name, { get, enumerable: true, configurable: true });
}
`;
const nsName = f => (f.startsWith('engine/') ? 'e' : 'm') + path.posix.basename(f).slice(0, 2);
const TS_JS = `// Flexible Visual System · test surface — window.__fvs: every name the files export, as live getters, plus the
// variables on rt (get + set) and the test flags. For fvs/_test-regression.html (it runs its battery inside
// \`with (window.__fvs)\`, so the battery's bare names still resolve) and scripts/test-fvs-*.mjs.
import { rt } from './rt.js';
${files.map(f => `import * as ${nsName(f)} from './${f}';`).join('\n')}

const api = {};
for (const ns of [${files.map(nsName).join(', ')}])
  for (const name of Object.keys(ns)) Object.defineProperty(api, name, { get: () => ns[name], enumerable: true });
for (const name of Object.keys(rt)) Object.defineProperty(api, name, { get: () => rt[name], set: v => { rt[name] = v; }, enumerable: true });
let ready;
api.ready = new Promise(r => { ready = r; });
api.isReady = false;
api.markReady = () => { api.isReady = true; ready(); };
window.__fvs = api;
`;
const MAIN_JS = `// Flexible Visual System — entry module. The files evaluate in this order (each imports only earlier ones),
// which is the order the single inline script used to run in. Architecture: docs/FVS.md §Architecture.
${files.map(f => `import './${f}';`).join('\n')}
import './test-surface.js';
window.__fvs.markReady();
`;

// check
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-mod-'));
const all = { ...Object.fromEntries(files.map((f, i) => [f, out[i]])), 'rt.js': RT_JS, 'hooks.js': HOOKS_JS, 'test-surface.js': TS_JS, 'main.js': MAIN_JS };
const errs = [];
for (const [f, t] of Object.entries(all)) {
  const p = path.join(tmp, f.replace(/\//g, '__').replace(/\.js$/, '.mjs')); fs.writeFileSync(p, t);
  try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); } catch (e) { errs.push(`${f}: ${String(e.stderr).split('\n').slice(0, 5).join(' ')}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`fvs-modules: engine ${ENG.report.statements} statements / ${ENG.report.kb} KB in ${files.filter(f => f.startsWith('engine/')).length} files`);
console.log(`fvs-modules: ${files.length} files · ${up} upward refs via hooks (${provides.reduce((a, s) => a + s.size, 0)} names) · rt: ${[...RT].join(', ')}`);
if (errs.length) { console.log('FAIL\n  ' + errs.join('\n  ')); process.exit(1); }
if (!DRY) {
  fs.mkdirSync(path.join(JS, 'engine'), { recursive: true });
  for (const [f, t] of Object.entries(all)) fs.writeFileSync(path.join(JS, f), t);
  const page = path.join(ROOT, 'fvs', 'index.html');
  let html = fs.readFileSync(page, 'utf8');
  const tags = classicFiles.map(f => `<script src="/fvs/js/${f}"></script>\n`).join('');
  if (!html.includes(tags)) throw new Error('script tags not found in fvs/index.html');
  html = html.replace(tags, `<script type="module" src="/fvs/js/main.js"></script>\n`)
    .replace(`<!-- Flexible Visual System — the tool's own scripts, classic, in order (one shared global scope). Map: docs/FVS.md §Architecture -->`,
      `<!-- Flexible Visual System — the tool's own code: ES modules from fvs/js/main.js (deferred; runs before DOMContentLoaded). Map: docs/FVS.md §Architecture -->`);
  fs.writeFileSync(page, html);
  console.log('  wrote fvs/js (modules + rt, hooks, test-surface, main) and fvs/index.html');
}
console.log('PASS — every file parses as a module');
