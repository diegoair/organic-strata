#!/usr/bin/env node
// One-off (branch fvs-panel-state, Oct 2026): the inverse of scripts/fvs-modules.mjs. Turns the ES modules in
// fvs/js/ back into classic per-view files (fvs/js/NN-*.js, one shared scope), so a refactor can be applied to
// them and fvs-modules.mjs can rebuild the modules and re-extract the engine from scratch.
//   engine/NN + NN → NN (engine part first — the order the modules already run in), imports and provide()
//   removed, `export` dropped, hooks.x → x, rt.x → a top-level variable again (rt.afterLoadSymbolGrid stays:
//   it is the test hook, not a moved variable). main / test-surface / hooks / rt / lazy / figure are removed —
//   fvs-modules.mjs writes them again.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dir = [process.env.ACORN_DIR, path.join(ROOT, 'node_modules'), '/Users/diego/projects/terragen-plan/node_modules']
  .filter(Boolean).find(d => fs.existsSync(path.join(d, 'acorn')));
const acorn = require(path.join(dir, 'acorn'));
const JS = path.join(ROOT, 'fvs', 'js');
const VARS = new Set(['galleryZoom', 'shapeLooks', 'lastShapeType']);   // were `var` before they moved to rt
const KEEP_RT = new Set(['afterLoadSymbolGrid']);

const ui = fs.readdirSync(JS).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
if (!ui.length || !fs.readFileSync(path.join(JS, ui[0]), 'utf8').includes('import ')) { console.error('fvs/js is not the module build'); process.exit(1); }

const declared = new Set();   // rt.x: only its FIRST top-level assignment (in load order) was the declaration
function strip(text) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
  const edits = [];
  const lineEnd = p => { const n = text.indexOf('\n', p); return n < 0 ? text.length : n + 1; };
  for (const st of ast.body) {
    if (st.type === 'ImportDeclaration') edits.push([st.range[0], lineEnd(st.range[1]), '']);
    else if ((st.type === 'ExportNamedDeclaration' || st.type === 'ExportDefaultDeclaration') && st.declaration) edits.push([st.range[0], st.declaration.range[0], '']);
    else if (st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && st.expression.callee.name === 'provide') {
      let a = st.range[0]; const prev = text.lastIndexOf('\n', a - 2);
      if (text.slice(prev + 1, a).startsWith('// Names earlier files reach at run time')) a = prev + 1;
      edits.push([a, lineEnd(st.range[1]), '']);
    }
  }
  // hooks.x → x · rt.x → x (top-level `rt.x = v;` → `let x = v;`)
  const topRt = new Set();
  for (const st of ast.body) if (st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression'
    && st.expression.left.type === 'MemberExpression' && st.expression.left.object.name === 'rt' && !KEEP_RT.has(st.expression.left.property.name)
    && !declared.has(st.expression.left.property.name)) { topRt.add(st.expression.left); declared.add(st.expression.left.property.name); }
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && (n.object.name === 'hooks' || (n.object.name === 'rt' && !KEEP_RT.has(n.property.name)))) {
      const name = n.property.name;
      edits.push([n.range[0], n.range[1], topRt.has(n) ? `${VARS.has(name) ? 'var' : 'let'} ${name}` : name]);
      return;
    }
    for (const k of Object.keys(n)) { if (k === 'range') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  // shorthand { x: hooks.x } stays valid as { x: x } — fine. Apply, last first.
  edits.sort((a, b) => b[0] - a[0]);
  let t = text;
  for (const [a, b, s] of edits) t = t.slice(0, a) + s + t.slice(b);
  return t;
}
const bodyOf = t => t.split('\n').slice(3).join('\n');   // after the 3 header comment lines
for (const f of ui) {
  const uiText = fs.readFileSync(path.join(JS, f), 'utf8');
  const engPath = path.join(JS, 'engine', f);
  const eng = fs.existsSync(engPath) ? strip(fs.readFileSync(engPath, 'utf8')) : '';
  const u = strip(uiText).split('\n');
  const head = u.slice(0, 3).map(l => l.replace("An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.",
    'One of the classic scripts fvs/index.html loads in order (fvs/js/00 … 99); they share one global scope.'));
  if (!head[0].startsWith('// Flexible Visual System · ')) throw new Error(f + ': unexpected header');
  const out = [...head, "'use strict';", bodyOf(eng).replace(/\n+$/, ''), u.slice(3).join('\n').replace(/^\n+/, '')].join('\n').replace(/\n*$/, '\n');
  fs.writeFileSync(path.join(JS, f), out);
}
fs.rmSync(path.join(JS, 'engine'), { recursive: true, force: true });
for (const f of ['main.js', 'test-surface.js', 'hooks.js', 'rt.js', 'lazy.js', 'figure.js']) fs.rmSync(path.join(JS, f), { force: true });
console.log(`fvs-demodularize: ${ui.length} classic files written`);
