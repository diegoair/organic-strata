#!/usr/bin/env node
// FVS Symbol › Zones (Oct 27, 2026 — Diego: "voglio poter dire ad un determinato gruppo di righe, colonne, celle
// selezionate di fare e di seguire delle regole"). engine/11-zones: the named selectors on Rectangular, Hexagonal,
// Triangular and Radial grids and after a rebuild (row −1 stays the last row), Zone from selection (the selector that
// takes exactly those cells), and applyZones — pure, in order, a Keep zone always wins. The Figure's region rules run on
// the same evaluator: scripts/test-figure-eval.sh keeps them byte-identical.
// Usage: scripts/test-fvs-zones.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  F.setTier('symbol'); await w(700);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450);
  set('symgen-cols', 6); set('symgen-rows', 6); await w(450);
  const ctx = () => F.zoneContexts(F.getSymbolGrid()), n = when => F.zoneCells(when, ctx()).length;
  check('6 × 6: 36 cells', ctx().length === 36, ctx().length);
  check('row 0 = 6, row −1 = the last row', n({ sel: 'row', k: 0 }) === 6 && F.zoneCells({ sel: 'row', k: -1 }, ctx()).every(i => ctx()[i].row === 5), n({ sel: 'row', k: -1 }));
  check('columns 1 and 3 = 12', n({ sel: 'col', k: [1, 3] }) === 12, n({ sel: 'col', k: [1, 3] }));
  check('border = 20, two deep = 32', n({ sel: 'border' }) === 20 && n({ sel: 'border', depth: 2 }) === 32, [n({ sel: 'border' }), n({ sel: 'border', depth: 2 })]);
  check('centre = the middle 2 × 2', n({ sel: 'centre' }) === 4, n({ sel: 'centre' }));
  check('each quadrant = 9', ['tl', 'tr', 'bl', 'br'].every(q => n({ sel: 'quadrant', q }) === 9), ['tl', 'tr', 'bl', 'br'].map(q => n({ sel: 'quadrant', q })));
  check('diagonals = 6 + 6', n({ sel: 'diagonal', which: 'main' }) === 6 && n({ sel: 'diagonal', which: 'both' }) === 12, [n({ sel: 'diagonal', which: 'main' }), n({ sel: 'diagonal', which: 'both' })]);
  check('one in two, checker = 18; every third column = 12', n({ sel: 'every', by: 'checker', n: 2 }) === 18 && n({ sel: 'every', by: 'col', n: 3 }) === 12, [n({ sel: 'every', by: 'checker', n: 2 }), n({ sel: 'every', by: 'col', n: 3 })]);
  check('all minus the border = 16', n({ sel: 'all', not: { sel: 'border' } }) === 16, n({ sel: 'all', not: { sel: 'border' } }));
  // Zone from selection: the selector, not the cells
  const wf = sel => JSON.stringify(F.whenFromCells(F.zoneCells(sel, ctx()), ctx()));
  check('the border cells → {sel: border}', wf({ sel: 'border' }) === JSON.stringify({ sel: 'border' }), wf({ sel: 'border' }));
  check('the last row → row −1', wf({ sel: 'row', k: 5 }) === JSON.stringify({ sel: 'row', k: -1 }), wf({ sel: 'row', k: 5 }));
  check('rows 0 and 1 → rows [0, 1]', wf({ sel: 'row', k: [0, 1] }) === JSON.stringify({ sel: 'row', k: [0, 1] }), wf({ sel: 'row', k: [0, 1] }));
  check('three loose cells → their addresses', /"at":/.test(JSON.stringify(F.whenFromCells([0, 7, 20], ctx()))), JSON.stringify(F.whenFromCells([0, 7, 20], ctx())));
  // a rebuild: the same part
  set('symgen-cols', 8); set('symgen-rows', 8); await w(450);
  check('8 × 8: row −1 is still the last row, border = 28', F.zoneCells({ sel: 'row', k: -1 }, ctx()).every(i => ctx()[i].row === 7) && n({ sel: 'row', k: -1 }) === 8 && n({ sel: 'border' }) === 28, [n({ sel: 'row', k: -1 }), n({ sel: 'border' })]);
  // applyZones: pure, in order, Keep wins
  const cells0 = F.state.symbolCells.map(c => ({ ...c, source: 'seed', seedType: 'triangle', rotation: 0 }));
  const before = JSON.stringify(cells0);
  const out = F.applyZones(cells0, F.getSymbolGrid(), [
    { when: { sel: 'row', k: 0 }, do: { keep: true } },
    { when: { sel: 'all' }, do: { rotate: 90 } },
    { when: { sel: 'border' }, do: { flipH: true } },
    { when: { sel: 'centre' }, do: { empty: true } },
  ]);
  const C = ctx();
  check('the input is left as it was', JSON.stringify(cells0) === before, 'changed');
  check('Keep: row 0 untouched and locked', out.cells.filter((c, i) => C[i].row === 0).every(c => c.locked && c.rotation === 0 && !c.flipH), JSON.stringify(out.cells[0]));
  check('a later zone wins: the border flipped, all turned 90°', out.cells.every((c, i) => C[i].row === 0 || (c.rotation === 90 && (!!c.flipH === F.whenMatches({ sel: 'border' }, C[i])))), 'mismatch');
  check('Empty: the centre', out.cells.filter((c, i) => F.whenMatches({ sel: 'centre' }, C[i])).every(c => c.source === 'empty'), 'filled');
  check('counts per zone', JSON.stringify(out.counts) === JSON.stringify([8, 56, 20, 4]), JSON.stringify(out.counts));
  // other grids
  for (const [gen, p] of [['hexagonal', { 'symgen-cols': 6 }], ['triangular', { 'symgen-cols': 8 }], ['radial', { 'symgen-rings': 5, 'symgen-sectors': 6 }]]) {
    set('sel-symgrid-gen', gen); await w(500); for (const [k, v] of Object.entries(p)) if (q(k)) set(k, v); await w(450);
    const c = ctx(), b = n({ sel: 'border' }), m = n({ sel: 'centre' });
    check(gen + ': border and centre are parts, apart', b > 0 && m > 0 && b + m <= c.length && !F.zoneCells({ sel: 'border' }, c).some(i => F.whenMatches({ sel: 'centre' }, c[i])), JSON.stringify([c.length, b, m]));
    if (gen === 'radial') {
      check('radial: rings and sectors', c.some(x => x.ring != null) && n({ sel: 'ring', k: 0 }) > 0 && n({ sel: 'sector', k: 0 }) > 0 && F.zoneCells({ sel: 'border' }, c).every(i => c[i].ring === c[i].ext.maxRing), JSON.stringify([n({ sel: 'ring', k: 0 }), n({ sel: 'sector', k: 0 })]));
      check('radial: the outer ring → ring −1', wf({ sel: 'border' }) === JSON.stringify({ sel: 'border' }) && JSON.stringify(F.whenFromCells(F.zoneCells({ sel: 'ring', k: -1 }, c), c)) === JSON.stringify({ sel: 'border' }), wf({ sel: 'ring', k: -1 }));
    }
    if (gen === 'triangular') check('triangles: up / down by class', n({ class: 'up' }) > 0 && n({ class: 'down' }) > 0, [n({ class: 'up' }), n({ class: 'down' })]);
  }
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS zones: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
