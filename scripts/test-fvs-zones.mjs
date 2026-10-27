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
// ── the panel: ready-made zones, the list, the inspector, the handles, Select ──
const ui = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  set('sel-symgrid-gen', 'rectangular'); await w(500); set('symgen-cols', 6); set('symgen-rows', 6); await w(500);
  // a Component to fill with
  F.setTier('component'); await w(500); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(700);
  F.state.symbolCells.forEach(c => F.patchCell(c, F.railPatch('component', A))); F.renderSymbol(); await w(200);
  check('no Fill mode menu on screen', q('sel-symbol-fill').closest('.ctrl-row').hidden, 'shown');
  const ready = [...q('zone-ready').querySelectorAll('[data-ready]')].map(b => b.textContent);
  check('ready-made zones: Border · Centre · Diagonals · Quadrants · Every other', JSON.stringify(ready) === JSON.stringify(['Border', 'Centre', 'Diagonals', 'Quadrants', 'Every other']), JSON.stringify(ready));
  check('line handles: 6 columns + 6 rows', document.querySelectorAll('#sym-line-handles .fvs-line-handle').length === 12, document.querySelectorAll('#sym-line-handles .fvs-line-handle').length);
  // a column by its handle → Zone from selection → Rule
  document.querySelector('.fvs-line-handle--col[data-k="2"]').click(); await w(100);
  check('a column handle selects the column', F.state.symbolSelection.size === 6 && [...F.state.symbolSelection].every(i => F.zoneContexts(F.getSymbolGrid())[i].col === 2), F.state.symbolSelection.size);
  document.querySelector('.fvs-line-handle--col[data-k="4"]').dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })); await w(100);
  check('⌘ adds another column', F.state.symbolSelection.size === 12, F.state.symbolSelection.size);
  check('Zone from selection is on', !q('btn-zone-from-sel').disabled, 'disabled');
  q('btn-zone-from-sel').click(); await w(150);
  check('…a zone of columns 3 and 5 (a selector)', JSON.stringify(F.state.symbolZones[0].when) === JSON.stringify({ sel: 'col', k: [2, 4] }), JSON.stringify(F.state.symbolZones[0].when));
  check('the inspector shows', !q('zone-inspector').hidden, 'hidden');
  q('seg-zone-does').querySelector('[data-does="rule"]').click(); await w(150);
  set('sel-symbol-rule', 'rows'); await w(50); set('rg-rule-rows-step', 90); await w(250);
  const C = () => F.zoneContexts(F.getSymbolGrid());
  check('Rule: the zone follows Rows; only its cells turn', F.state.symbolZones[0].do.symbolRule.name === 'rows' && F.state.symbolCells.every((c, i) => (C()[i].col === 2 || C()[i].col === 4) ? c.rotation === 90 * (C()[i].row % 2) : c.rotation === 0), JSON.stringify(F.state.symbolCells.slice(0, 6).map(c => c.rotation)));
  check('the Rule block sits in the inspector, without Apply', q('zone-rule-host').contains(q('symbol-rule-block')) && !q('symbol-rule-block').hidden && getComputedStyle(q('btn-symbol-apply-rule')).display === 'none', 'not');
  // Border, Locked
  q('zone-ready').querySelector('[data-ready="0"]').click(); await w(150);
  q('seg-zone-does').querySelector('[data-does="keep"]').click(); await w(150);
  const border = F.zoneCells({ sel: 'border' }, C());
  check('Locked: the border is locked (by the zone)', border.every(i => F.state.symbolCells[i].locked && F.state.symbolCells[i].lockedBy === 'zone'), 'not locked');
  check('…and the column zone before it still turns what is not locked', F.state.symbolCells.every((c, i) => !(C()[i].col === 2 && C()[i].row === 3) || c.rotation === 90), 'no');
  // Quadrants → four zones; Content from the pool
  q('zone-ready').querySelector('[data-ready="3"]').click(); await w(150);
  check('Quadrants adds four zones', F.state.symbolZones.length === 6, F.state.symbolZones.length);
  q('seg-zone-does').querySelector('[data-does="empty"]').click(); await w(150);
  const tl = F.zoneCells({ sel: 'quadrant', q: 'tl' }, C());
  check('Empty on the top-left quadrant (the locked border stays)', tl.every(i => border.includes(i) ? F.state.symbolCells[i].source === 'component' : F.state.symbolCells[i].source === 'empty'), 'mismatch');
  // order, off, delete
  const outline = () => (q('symbol-frame').innerHTML.match(/fvs-zone-outline/g) || []).length;
  check('outlines on the canvas, one per zone on', outline() === 6, outline());
  q('zone-list').querySelector('[data-act="off"][data-i="1"]').click(); await w(150);
  check('switching the Locked zone off frees the border', border.every(i => !F.state.symbolCells[i].locked), 'still locked');
  q('zone-list').querySelector('[data-act="del"][data-i="1"]').click(); await w(150);
  check('Delete zone is armed: one click deletes nothing', F.state.symbolZones.length === 6, F.state.symbolZones.length);
  q('zone-list').querySelector('[data-act="del"][data-i="1"]').click(); await w(150);
  check('delete: 5 zones', F.state.symbolZones.length === 5, F.state.symbolZones.length);
  q('zone-list').querySelector('[data-act="down"][data-i="0"]').click(); await w(150);
  check('move down: the column zone is second', F.state.symbolZones[1].when.sel === 'col', JSON.stringify(F.state.symbolZones.map(z => z.when.sel)));
  // Select (similar)
  F.state.symbolSelection = new Set([7]); F.renderCellPropertiesPanel(); await w(50);
  q('zone-similar').querySelector('[data-similar="row"]').click(); await w(80);
  check('Select › Row', F.state.symbolSelection.size === 6 && [...F.state.symbolSelection].every(i => C()[i].row === 1), F.state.symbolSelection.size);
  q('zone-similar').querySelector('[data-similar="every"]').click(); await w(80);
  check('Select › Every other cell', F.state.symbolSelection.size === 18, F.state.symbolSelection.size);
  // saved with the Symbol, back after a reload of the entry
  const e = F.buildSymbolLibraryEntry();
  check('zones saved with the Symbol', e.zones && e.zones.length === 5, e.zones && e.zones.length);
  F.state.symbolZones = []; F.applySymbolLibraryEntryToUI && F.applySymbolLibraryEntryToUI(e); await w(300);
  check('…and read back', F.state.symbolZones.length === 5, F.state.symbolZones.length);
  return rows;`);
rows.push(...ui);
// ── Suggest with zones: held cells stay, open zones get something, the twelve differ, same seed = same result ──
const sug = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const lib = Object.keys(F.LIBRARY.peek());
  set('symgen-cols', 8); set('symgen-rows', 8); await w(500);
  F.state.symbolCells.forEach(c => F.patchCell(c, F.railPatch('component', lib[0])));
  F.state.symbolZones = [{ when: { sel: 'border' }, do: { keep: true } }, { when: { sel: 'quadrant', q: 'tl' }, do: {} }, { when: { sel: 'quadrant', q: 'br' }, do: {} }];
  F.applyZonesNow(); await w(100);
  const C = F.zoneContexts(F.getSymbolGrid()), border = F.zoneCells({ sel: 'border' }, C), before = JSON.stringify(border.map(i => F.state.symbolCells[i]));
  set('num-sug-seed', 7); set('rg-sug-surprise', 30);
  const t0 = performance.now(); q('btn-sug-run').click(); const ms = performance.now() - t0; await w(200);
  const S = F.state.symbolSuggestions;
  check('Suggest gives 12 variations', S.length === 12, S.length);
  check('the Locked border is the same in every variation', S.every(sg => JSON.stringify(border.map(i => sg.cells[i])) === before), 'changed');
  check('variations say what the open zones get', S.filter(sg => sg.zoneDos && /Zone 2: .+ · Zone 3: /.test(sg.label)).length >= 8, JSON.stringify(S.map(sg => sg.label).slice(0, 4)));
  const key = sg => sg.cells.map(c => c.componentName + ':' + c.rotation + (c.flipH ? 'h' : '')).join('|');
  const sim = (a, b) => { const A = key(a).split('|'), B = key(b).split('|'); return A.filter((x, i) => x === B[i]).length / A.length; };
  let maxSim = 0; for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) maxSim = Math.max(maxSim, sim(S[i], S[j]));
  check('no two variations are the same (most alike under 99%)', maxSim < 0.99, maxSim.toFixed(3));
  const first = S.map(key).join('/');
  q('btn-sug-run').click(); await w(200);
  check('same seed, same variations', F.state.symbolSuggestions.map(key).join('/') === first, 'different');
  check('Suggest on 64 cells, 2 open zones, under 1.5 s', ms < 1500, ms.toFixed(0) + ' ms');
  // a variation applied: the open zones take what it gave them
  const k = F.state.symbolSuggestions.findIndex(sg => sg.zoneDos);
  document.querySelectorAll('#fvs-sug-panel .fvs-suggest__item')[k].click(); await w(150);
  check('applying it writes the zones (no zone left open)', F.state.symbolZones.length >= 3 && F.state.symbolZones.every(z => Object.keys(z.do).length), JSON.stringify(F.state.symbolZones.map(z => Object.keys(z.do))));
  F.state.symbolZones = []; F.applyZonesNow();
  return rows;`);
rows.push(...sug);
if (process.env.ZONES_SHOT) await P.ev(`${process.env.ZONES_DARK ? "document.documentElement.setAttribute('data-theme', 'dark');" : ''} window.__fvs.state.zonePick = 1; window.__fvs.renderSymbol(); document.getElementById('sym-zones-section').scrollIntoView(); return 1;`);
const shot = process.env.ZONES_SHOT && await P.cdp('Page.captureScreenshot', { format: 'png' });
if (process.env.ZONES_SHOT) (await import('node:fs')).writeFileSync(process.env.ZONES_SHOT, Buffer.from(shot.result.data, 'base64'));
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS zones: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
