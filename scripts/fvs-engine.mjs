// One-off (branch fvs-split, Oct 2026, stage B): which top-level statements of the classic fvs/js files form the
// ENGINE — model + logic with no DOM UI — so scripts/fvs-modules.mjs can put them in fvs/js/engine/NN-*.js.
//
// A statement is engine when everything it reaches is engine too (fixpoint), and it uses:
//   • no panel or page:   ctrl, val, setStatus, document, window, timers, Image, Event, … (BAD_GLOBALS)
//   • Organica only for pure shared maths (OK_ORG): shapes, color, shapeAppearance, printSize, loadLoomGrid, …
//   • the MODEL freely — `state` and the saved-item stores — which the UI writes and the engine reads
//   • ENV helpers — they touch the DOM only to measure or composite offscreen (hidden SVG for getBBox, an
//     unmounted canvas for Paper.js, the stack's offscreen canvas)
// A const qualifies only if every load-time statement that mutates it qualifies too (they move with it, in
// order: e.g. the two SEED_TYPES geometry wraps). Engine statements run before the UI files (the engine files
// load first), so the check also refuses an engine load-time statement that reads the MODEL.
//
// What stays UI is reported with its root cause, so the next step is plain: most of it reads the Element and
// grid from the panel controls (getPanelSeed, getGrid, getElementAppearance), which is where moving the
// panel's values into `state` would start.
export const BAD_GLOBALS = new Set(['document', 'window', 'navigator', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Image', 'FileReader', 'ResizeObserver', 'HTMLImageElement', 'CustomEvent',
  'Event', 'KeyboardEvent', 'DOMParser', 'Option', 'innerHeight', 'innerWidth', 'localStorage', 'Blob', 'URL']);
export const BAD_TOP = new Set(['ctrl', 'setStatus', 'rt', 'isFigureLoaded', 'loadFigureTier']);   // rt: the test hook (rt.afterLoadSymbolGrid); the two lazy.js calls
export const OK_ORG = new Set(['shapes', 'color', 'loadLoomGrid', 'mulberry32', 'printSize', 'traceContours', 'contoursToPathD', 'noise', 'radial',
  'shapeAppearance', 'hexToRGB255', 'rgbToHex', 'hexToRGB']);
export const MODEL = new Set(['state', 'live', 'LIBRARY', 'ELEMENT_LIB', 'SYMBOL_LIBRARY', 'genesisTileForms', 'getCreatorLibraryForms']);
export const ENV = new Set(['offscreenCanvas', 'pathBBox', 'pathCentroid', 'splitPaperScope', '_splitScope', 'seedOutline', 'outlineProbe', '_stackAcc', 'paintStackCanvas']);
const EXPR = new Set(['ExpressionStatement', 'ForOfStatement', 'ForStatement', 'ForInStatement', 'IfStatement', 'BlockStatement']);
const MUT = /^(set|add|push|pop|splice|delete|clear|unshift|shift|sort|reverse|fill)$/;

export function extractEngine(files, texts, { acorn, eslintScope }) {
  let src = ''; const ranges = [];
  texts.forEach(t => { ranges.push({ start: src.length, end: src.length + t.length }); src += t + '\n'; });
  const fileAt = pos => ranges.findIndex(r => pos >= r.start && pos < r.end);
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  const top = ast.body;
  const declOf = st => { const out = [];
    const walk = p => { if (!p) return; if (p.type === 'Identifier') out.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => walk(q.type === 'RestElement' ? q.argument : q.value)); else if (p.type === 'ArrayPattern') p.elements.forEach(walk); else if (p.type === 'AssignmentPattern') walk(p.left); else if (p.type === 'RestElement') walk(p.argument); };
    if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') out.push(st.id.name); else if (st.type === 'VariableDeclaration') st.declarations.forEach(d => walk(d.id));
    return out; };
  const names = top.map(declOf), nameStmt = new Map();
  names.forEach((ns, i) => ns.forEach(n => nameStmt.set(n, i)));
  const stmtAt = pos => { let lo = 0, hi = top.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (top[m].range[1] <= pos) lo = m + 1; else if (top[m].range[0] > pos) hi = m - 1; else return m; } return -1; };
  const refsIn = top.map(() => new Set()), orgIn = top.map(() => new Set()), loadRefs = top.map(() => new Set());
  const inFunction = sc => { for (let s = sc; s; s = s.upper) if (s.type === 'function') return true; return false; };
  for (const sc of sm.scopes) for (const r of sc.references) {
    const i = stmtAt(r.identifier.range[0]); if (i < 0) continue;
    if (!r.resolved || r.resolved.scope.type === 'module' || r.resolved.scope.type === 'global') {
      refsIn[i].add(r.identifier.name);
      if (!inFunction(r.from)) loadRefs[i].add(r.identifier.name);   // evaluated while the file loads
    }
  }
  const rootId = n => { while (n && n.type === 'MemberExpression') n = n.object; return n && n.type === 'Identifier' ? n.name : null; };
  const mutBy = new Map();
  (function walk(n) { if (!n || typeof n.type !== 'string') return;
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'Organica') { const i = stmtAt(n.range[0]); if (i >= 0) orgIn[i].add(n.property.name || '?'); }
    for (const k of Object.keys(n)) { if (k === 'range' || k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(ast);
  top.forEach((st, i) => { if (st.type === 'FunctionDeclaration') return;
    (function walk(n) { if (!n || typeof n.type !== 'string') return; let tgt = null;
      if ((n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression') || (n.type === 'UpdateExpression' && n.argument.type === 'MemberExpression')) tgt = rootId(n.left || n.argument);
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && MUT.test(n.callee.property.name || '')) tgt = rootId(n.callee.object);
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier' && n.callee.object.name === 'Object' && n.callee.property.name === 'assign' && n.arguments[0]) tgt = rootId(n.arguments[0]);
      if (tgt) { const j = nameStmt.get(tgt); if (j !== undefined && j !== i) { if (!mutBy.has(j)) mutBy.set(j, new Set()); mutBy.get(j).add(i); } }
      for (const k of Object.keys(n)) { if (k === 'range' || k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(st); });
  const mutTargets = i => [...mutBy].filter(([, set]) => set.has(i)).map(([j]) => j);
  const isModel = i => names[i].some(n => MODEL.has(n)), isEnv = i => names[i].some(n => ENV.has(n));
  const eligible = i => { const st = top[i];
    if (isModel(i) || isEnv(i) || st.type === 'FunctionDeclaration') return true;
    if (st.type === 'VariableDeclaration' && st.kind === 'const') return true;
    if (EXPR.has(st.type)) return mutTargets(i).length > 0;
    return false; };
  const pure = new Set(top.map((_, i) => i).filter(eligible));
  for (let changed = true; changed;) { changed = false;
    for (const i of [...pure]) {
      if (isModel(i) || isEnv(i)) continue;
      let ok = true;
      for (const n of refsIn[i]) { if (BAD_GLOBALS.has(n) || BAD_TOP.has(n)) { ok = false; break; } const j = nameStmt.get(n); if (j !== undefined && j !== i && !pure.has(j)) { ok = false; break; } }
      if (ok) for (const p of orgIn[i]) if (!OK_ORG.has(p)) { ok = false; break; }
      if (ok && mutBy.has(i)) for (const m of mutBy.get(i)) if (!pure.has(m)) { ok = false; break; }
      if (ok && EXPR.has(top[i].type)) for (const j of mutTargets(i)) if (!pure.has(j) || isModel(j)) { ok = false; break; }
      if (!ok) { pure.delete(i); changed = true; }
    } }
  // calls made while a statement loads (not inside a function it only defines; IIFEs + array callbacks do run)
  const callsIn = node => { const out = new Set();
    (function walk(n) { if (!n || typeof n.type !== 'string') return;
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier') out.add(n.callee.name);
      for (const k of Object.keys(n)) { if (k === 'range' || k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(node);
    return out; };
  const loadCalls = st => { const out = new Set();
    (function walk(n, parent) { if (!n || typeof n.type !== 'string') return;
      if ((n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') && parent) {
        const iife = parent.type === 'CallExpression' && parent.callee === n;
        const arrCb = parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' && /^(forEach|map|filter|some|every|reduce|find|findIndex|flatMap|sort)$/.test(parent.callee.property.name || '');
        if (!iife && !arrCb) return; }
      if (n.type === 'FunctionDeclaration' && parent) return;
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier') out.add(n.callee.name);
      for (const k of Object.keys(n)) { if (k === 'range' || k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => walk(c, n)); else if (v && typeof v.type === 'string') walk(v, n); } })(st, null);
    return out; };
  // engine load-time code may not read the MODEL (it now runs before every UI file)
  const loadReadsModel = [];
  for (const i of pure) { if (top[i].type === 'FunctionDeclaration' || isModel(i)) continue;
    // what loading this statement reads: its own load-time refs + everything the functions it reaches read
    // follow only functions CALLED while loading (a name merely listed, e.g. in a table of rules, is not run)
    const need = new Set(loadRefs[i]), seen = new Set(), stack = [...loadCalls(top[i])];
    while (stack.length) { const n = stack.pop(); if (seen.has(n)) continue; seen.add(n); const j = nameStmt.get(n);
      if (j !== undefined && top[j].type === 'FunctionDeclaration') { refsIn[j].forEach(x => need.add(x)); callsIn(top[j].body).forEach(x => stack.push(x)); } }
    const model = [...need].filter(n => MODEL.has(n)); if (model.length) loadReadsModel.push(`${names[i].join(',') || 'stmt'} reads ${model.join(',')}`); }
  // a statement moves with whole lines: it must not share its first or last line with another statement
  const lines = src.split('\n'); const lineStart = []; { let p = 0; for (const l of lines) { lineStart.push(p); p += l.length + 1; } }
  const occupied = new Map();   // line → count of statements touching it
  top.forEach(st => { for (let L = st.loc.start.line; L <= st.loc.end.line; L++) occupied.set(L, (occupied.get(L) || 0) + 1); });
  const sharedLine = i => occupied.get(top[i].loc.start.line) > 1 || occupied.get(top[i].loc.end.line) > 1;
  const blocked = [...pure].filter(sharedLine);
  // carve: per origin file, engine text + remaining UI text, by whole lines (with the comment lines right above)
  const isComment = l => /^\s*(\/\/|\/\*|\*)/.test(l);
  const take = new Set();   // 1-based lines that go to the engine
  for (const i of pure) { if (blocked.includes(i)) continue;
    let a = top[i].loc.start.line; const b = top[i].loc.end.line;
    while (a > 1 && isComment(lines[a - 2]) && !occupied.get(a - 1)) a--;   // the comment block attached right above
    for (let L = a; L <= b; L++) take.add(L); }
  // if a blocked (shared-line) statement is engine, the fixpoint must not rely on it moving: drop it and dependants
  if (blocked.length) throw new Error('engine statements sharing a line with UI code: ' + blocked.map(i => names[i].join(',')).join(' '));
  if (loadReadsModel.length) throw new Error('engine load-time code reads the model: ' + loadReadsModel.join('; '));
  const eng = files.map(() => []), ui = files.map(() => []);
  lines.forEach((l, k) => { const L = k + 1, fi = fileAt(lineStart[k]); if (fi < 0) return; (take.has(L) ? eng : ui)[fi].push(l); });
  const outFiles = [], outTexts = [];
  files.forEach((f, fi) => { const body = eng[fi].filter((l, k, a) => !(l.trim() === '' && (k === 0 || a[k - 1].trim() === '')));
    if (body.some(l => l.trim() && !isComment(l))) { outFiles.push('engine/' + f); outTexts.push(body.join('\n').replace(/\n*$/, '\n')); } });
  files.forEach((f, fi) => { outFiles.push(f); outTexts.push(ui[fi].join('\n').replace(/\n*$/, '\n')); });
  const kb = [...pure].reduce((a, i) => a + top[i].range[1] - top[i].range[0], 0) / 1024;
  return { files: outFiles, texts: outTexts, report: { statements: pure.size, kb: Math.round(kb), engineNames: [...pure].flatMap(i => names[i]) } };
}
