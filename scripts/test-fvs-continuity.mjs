#!/usr/bin/env node
// FVS Zones › Continuity (Oct 27, 2026): engine/11-zones continuitySolve / ZONE_FOLLOW continuity. On a quarter-disc
// (the Arc Element, one cell — a truchet-like tile) on a 6 × 6 Symbol, the turns it finds make the shared edges agree
// far more than random turns do (≥ 0.95 of the edge samples); a zone's walk respects the zone (the cells outside stay as
// they are, and are matched against); 'pool' picks contents as well; the same input gives the same answer.
// Usage: scripts/test-fvs-continuity.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  F.setTier('element'); set('sel-seed-type', 'arc'); await w(400);
  F.setTier('component'); await w(500); set('rg-grid-cols', 1); set('rg-grid-rows', 1); await w(200); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(700);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450); set('symgen-cols', 6); set('symgen-rows', 6); await w(450);
  F.state.symbolClipEnabled = true;
  const rnd = Organica.mulberry32(3);
  F.state.symbolCells.forEach(c => F.patchCell(c, { ...F.railPatch('component', A), rotation: 90 * Math.floor(rnd() * 4), flipH: false }));
  const G = F.getSymbolGrid(), C = F.zoneContexts(G), all = C.map(c => c.index);
  const matchOf = cells => { const pl = F.symbolContentPool(cells), E = F.suggestEnv({ pool: pl }); if (!E) throw new Error('no env: pool ' + pl.length + ', grid ' + !!F.suggestGridContext() + ', cell ' + JSON.stringify(cells[0])); const cand = F.scorable(F.candFromCells(cells), E.anByName); return F.scoreSymbolCandidate(E.G, cand, E.pal, E.W, E.fit, E.anByName, E.T).match; };
  const before = matchOf(F.state.symbolCells);
  const t0 = performance.now();
  const out = F.applyZones(F.state.symbolCells, G, [{ when: { sel: 'all' }, do: { follow: { id: 'continuity', params: { content: 'keep' }, seed: 1 } } }]).cells;
  const ms = performance.now() - t0, after = matchOf(out);
  check('random turns: the edges agree ' + Math.round(before * 100) + ' %', before < 0.9, before.toFixed(3));
  check('Continuity: ≥ 95 % (' + Math.round(after * 100) + ' %)', after >= 0.95, after.toFixed(3));
  check('…in under 1 s on 36 cells', ms < 1000, ms.toFixed(0) + ' ms');
  check('…turns only: every cell still holds the arc', out.every(c => c.componentName === A), 'changed content');
  const again = F.applyZones(F.state.symbolCells, G, [{ when: { sel: 'all' }, do: { follow: { id: 'continuity', params: { content: 'keep' }, seed: 1 } } }]).cells;
  check('same input, same answer', JSON.stringify(again.map(c => c.rotation)) === JSON.stringify(out.map(c => c.rotation)), 'differs');
  // a zone: the centre 4 × 4 runs on into a fixed border
  const inner = F.zoneCells({ sel: 'all', not: { sel: 'border' } }, C);
  const out2 = F.applyZones(F.state.symbolCells, G, [{ when: { sel: 'all', not: { sel: 'border' } }, do: { follow: { id: 'continuity', params: { content: 'keep' }, seed: 1 } } }]).cells;
  check('a zone: the border is left as it was', out2.every((c, i) => inner.includes(i) || c.rotation === F.state.symbolCells[i].rotation), 'border changed');
  check('…and the whole Symbol agrees more than before', matchOf(out2) > before + 0.1, matchOf(out2).toFixed(3) + ' vs ' + before.toFixed(3));
  // pool: a second content to choose from
  F.setTier('component'); await w(400); set('rg-grid-cols', 2); set('rg-grid-rows', 2); await w(200); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const B = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(900);
  rows.push('  · back on the Symbol: ' + F.state.symbolCells.length + ' cells, grid ' + !!F.getSymbolGrid());
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, { ...F.railPatch('component', i % 5 ? A : B), rotation: 90 * Math.floor(rnd() * 4) }));
  const out3 = F.applyZones(F.state.symbolCells, F.getSymbolGrid(), [{ when: { sel: 'all' }, do: { follow: { id: 'continuity', params: { content: 'pool' }, seed: 1 } } }]).cells;
  check('pool: it may change contents too (from this Symbol’s two)', out3.every(c => c.componentName === A || c.componentName === B) && matchOf(out3) >= matchOf(F.state.symbolCells), matchOf(out3).toFixed(3));
  // offered to open zones by Suggest
  check('Continuity is offered for a zone', F.zoneOptions(F.getSymbolGrid(), all, F.symbolContentPool(F.state.symbolCells), Organica.mulberry32(1), C).some(o => o.dos.some(d => d.follow && d.follow.id === 'continuity')), 'not offered');
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS continuity: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
