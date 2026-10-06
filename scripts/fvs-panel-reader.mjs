#!/usr/bin/env node
// One-off (branch fvs-panel-state, Oct 2026), run on the CLASSIC files (after fvs-demodularize.mjs): the panel
// reader. The engine stops reading the page: every `ctrl(x).value` / `ctrl(x).checked` that READS a control
// becomes `pv(x)` / `pc(x)`, and `val(x)` reads through `pv`. The three read the panel through `panelSource`,
// which the UI points at the controls (setPanelSource) — the same values, read the same way, so nothing changes;
// what changes is that the functions using them no longer touch the DOM and can move to the engine.
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
const files = fs.readdirSync(JS).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
if (fs.readFileSync(path.join(JS, files[0]), 'utf8').includes('\nimport ')) { console.error('run on the classic files (fvs-demodularize.mjs first)'); process.exit(1); }

let total = 0;
const report = {};
for (const f of files) {
  const p = path.join(JS, f); let t = fs.readFileSync(p, 'utf8');
  const ast = acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'script', ranges: true });
  const edits = [];
  (function walk(n, parent, key) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'MemberExpression' && !n.computed && (n.property.name === 'value' || n.property.name === 'checked')
      && n.object.type === 'CallExpression' && n.object.callee.type === 'Identifier' && n.object.callee.name === 'ctrl' && n.object.arguments.length === 1) {
      const write = (parent && parent.type === 'AssignmentExpression' && key === 'left') || (parent && parent.type === 'UpdateExpression');
      if (!write) {
        const arg = t.slice(n.object.arguments[0].range[0], n.object.arguments[0].range[1]);
        edits.push([n.range[0], n.range[1], `${n.property.name === 'value' ? 'pv' : 'pc'}(${arg})`]);
        return;
      }
    }
    for (const k of Object.keys(n)) { if (k === 'range') continue; const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, n, k)); else if (v && typeof v.type === 'string') walk(v, n, k); }
  })(ast, null, null);
  edits.sort((a, b) => b[0] - a[0]);
  for (const [a, b, s] of edits) t = t.slice(0, a) + s + t.slice(b);
  report[f] = edits.length; total += edits.length;
  fs.writeFileSync(p, t);
}

// the reader itself, in 00-core, and the one aliased read (getSeedExtras)
const core = path.join(JS, '00-core.js'); let c = fs.readFileSync(core, 'utf8');
const oldVal = "function val(id) { return parseFloat(pv(id)); }";   // (the read rewrite above already turned ctrl(id).value into pv(id))
if (!c.includes(oldVal)) throw new Error('val() not found');
c = c.replace(oldVal, `// ── The panel reader (Oct 2026). The engine (fvs/js/engine/) reads a control through pv / pc / val, never the
// page: panelSource says where the values come from — today the controls themselves (setPanelSource, below);
// a port can plug in its own state. Same values, read the same way. docs/FVS.md §11.
const panelSource = { value: null, checked: null };
function setPanelSource(src) { Object.assign(panelSource, src); }
function pv(id) { return panelSource.value(id); }      // a control's value (a string) — was ctrl(id).value
function pc(id) { return panelSource.checked(id); }    // a checkbox's state — was ctrl(id).checked
function val(id) { return parseFloat(pv(id)); }
setPanelSource({ value: id => ctrl(id).value, checked: id => ctrl(id).checked });`);
fs.writeFileSync(core, c);
const seed = path.join(JS, '02-seed-ui.js'); let s = fs.readFileSync(seed, 'utf8');
const oldEx = "Object.values(SEED_EXTRAS).forEach(sh => sh.rows.forEach(r => { const el = ctrl(xrId(sh, r)); o[r.key] = r.kind === 'select' ? el.value : parseFloat(el.value); }));";
if (!s.includes(oldEx)) throw new Error('getSeedExtras read not found');
s = s.replace(oldEx, "Object.values(SEED_EXTRAS).forEach(sh => sh.rows.forEach(r => { const v = pv(xrId(sh, r)); o[r.key] = r.kind === 'select' ? v : parseFloat(v); }));");
fs.writeFileSync(seed, s);
console.log(`fvs-panel-reader: ${total} reads → pv / pc`, report);

// ── phase 2: the run-time values render code shares with the UI → one model object, `live` ──────────────────
// Ten top-level variables (render overrides, Paper-pattern switch, caches, a draw counter) kept code that reads
// them out of the engine: a reassigned variable cannot be shared, a property of a const object can. Same names,
// same initial values, now `live.name` everywhere (scope-accurate: a local of the same name is left alone).
const eslintScope = require(path.join(dir, 'eslint-scope'));
const LIVE = ['_stackDrawSeq', '_symCR', '_symLattice', 'appearanceOverride', 'contentOverlayFit', 'inkPaletteOverride',
  'lastFigureMeta', 'layerInkOverride', 'paperPatternOn', 'variantAppearance'];
{
  const texts = files.map(f => fs.readFileSync(path.join(JS, f), 'utf8'));
  let src = ''; const ranges = [];
  texts.forEach(t => { ranges.push([src.length, src.length + t.length]); src += t + '\n'; });
  const fileAt = pos => ranges.findIndex(([a, b]) => pos >= a && pos < b);
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  const mod = sm.scopes.find(s => s.type === 'module');
  const parent = new Map();
  (function link(n, p) { if (!n || typeof n.type !== 'string') return; parent.set(n, p);
    for (const k of Object.keys(n)) { if (k === 'range') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => link(c, n)); else if (v && typeof v.type === 'string') link(v, n); } })(ast, null);
  const edits = files.map(() => []), inits = {}, comments = {};
  for (const name of LIVE) {
    const v = mod.variables.find(x => x.name === name);
    if (!v) throw new Error('live: ' + name + ' not declared at top level');
    const decl = v.defs[0].parent, stmt = parent.get(decl) && parent.get(decl).type === 'Program' ? decl : null;
    if (!stmt || stmt.declarations.length !== 1) throw new Error('live: ' + name + ' is not a lone top-level declaration');
    const d = stmt.declarations[0];
    inits[name] = d.init ? src.slice(d.init.range[0], d.init.range[1]) : 'undefined';
    // the declaration line goes (its trailing comment travels into the live literal)
    const fi = fileAt(stmt.range[0]), off = ranges[fi][0];
    const lineEnd = src.indexOf('\n', stmt.range[1]);
    const comment = src.slice(stmt.range[1], lineEnd).trim();
    comments[name] = comment.startsWith('//') ? '   ' + comment : '';
    const lineStart = src.lastIndexOf('\n', stmt.range[0]) + 1;
    edits[fi].push([lineStart - off, lineEnd + 1 - off, '']);
    for (const r of v.references) {
      const id = r.identifier, f2 = fileAt(id.range[0]), o2 = ranges[f2][0], p = parent.get(id);
      if (id === d.id) continue;
      if (p && p.type === 'Property' && p.shorthand && p.value === id) edits[f2].push([p.range[0] - o2, p.range[1] - o2, `${name}: live.${name}`]);
      else edits[f2].push([id.range[0] - o2, id.range[1] - o2, 'live.' + name]);
    }
  }
  files.forEach((f, fi) => {
    let t = texts[fi];
    edits[fi].sort((a, b) => b[0] - a[0]).forEach(([a, b, s]) => { t = t.slice(0, a) + s + t.slice(b); });
    fs.writeFileSync(path.join(JS, f), t);
  });
  // the object itself, right after the reader in 00-core
  const core = path.join(JS, '00-core.js'); let c = fs.readFileSync(core, 'utf8');
  const anchor = "setPanelSource({ value: id => ctrl(id).value, checked: id => ctrl(id).checked });";
  if (!c.includes(anchor)) throw new Error('reader anchor');
  c = c.replace(anchor, `setPanelSource({ value: id => ctrl(id).value, checked: id => ctrl(id).checked,
  read: id => { const el = ctrl(id); return el.type === 'checkbox' ? el.checked : el.value; } });
function pr(id) { return panelSource.read(id); }       // a checkbox's state or any other control's value
// ── live: what render code and the UI share at run time (Oct 2026 — were ten top-level variables). Part of
// the model, like state: the engine reads it, the UI and the render wrappers set it.
const live = {
${LIVE.map(n => `  ${n}: ${inits[n]},${comments[n]}`).join('\n')}
};
// An offscreen canvas for compositing / raster checks — the one page call the engine makes (never mounted).
function offscreenCanvas(width, height) { return Object.assign(document.createElement('canvas'), { width, height }); }`);
  c = c.replace("const panelSource = { value: null, checked: null };", "const panelSource = { value: null, checked: null, read: null };");
  fs.writeFileSync(core, c);
  // readRuleState reads a mixed list of controls; the three offscreen canvases
  const swap = (file, a, b) => { const p = path.join(JS, file); const t = fs.readFileSync(p, 'utf8'); if (!t.includes(a)) throw new Error(file + ': ' + a.slice(0, 60)); fs.writeFileSync(p, t.split(a).join(b)); };
  const where = needle => files.find(f => fs.readFileSync(path.join(JS, f), 'utf8').includes(needle));
  const rr = "RULE_CONTROL_IDS.forEach(id => { const el = ctrl(id); s[id] = el.type === 'checkbox' ? el.checked : el.value; });";
  swap(where(rr), rr, "RULE_CONTROL_IDS.forEach(id => { s[id] = pr(id); });");
  const ac = "const cv = document.createElement('canvas'); cv.width = RES; cv.height = RES;";
  swap(where(ac), ac, "const cv = offscreenCanvas(RES, RES);");
  const oc = "Object.assign(document.createElement('canvas'), { width: ctx.canvas.width, height: ctx.canvas.height })";
  for (const f of files) { const t = fs.readFileSync(path.join(JS, f), 'utf8'); if (t.includes(oc)) swap(f, oc, 'offscreenCanvas(ctx.canvas.width, ctx.canvas.height)'); }
  console.log(`fvs-panel-reader: live = { ${LIVE.join(', ')} }`);
}
