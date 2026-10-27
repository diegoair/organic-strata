#!/usr/bin/env node
// FVS Zones › Field and Rhythm (Oct 27, 2026): engine/03-drive signals (gradient, centre, rings, noise, photo) and walks
// (reading, snake, spiral, rings, diagonal), and the Zone generators ZONE_FOLLOW field / rhythm through applyZones —
// content in bands of the signal, turns, sizes, holes; a rhythm's sequence along its walk.
// Usage: scripts/test-fvs-drive.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const S = F.signal, near = (a, b) => Math.abs(a - b) < 1e-6;
  check('gradient 0°: 0 on the left, 1 on the right, ½ in the middle', near(S('gradient', 0, 0.5, { angle: 0 }), 0) && near(S('gradient', 1, 0.5, { angle: 0 }), 1) && near(S('gradient', 0.5, 0.3, { angle: 0 }), 0.5), [S('gradient', 0, 0.5, { angle: 0 }), S('gradient', 1, 0.5, { angle: 0 })].join(' '));
  check('gradient 90°: top 0, bottom 1', near(S('gradient', 0.5, 0, { angle: 90 }), 0) && near(S('gradient', 0.5, 1, { angle: 90 }), 1), 'no');
  check('centre: 0 at the middle, 1 at the corners', near(S('centre', 0.5, 0.5), 0) && near(S('centre', 0, 0), 1), [S('centre', 0.5, 0.5), S('centre', 0, 0)].join(' '));
  check('rings: alternate bands', S('rings', 0.5, 0.5, { rings: 3 }) !== S('rings', 0.5, 0.15, { rings: 3 }), 'same');
  const nz = []; for (let k = 0; k < 50; k++) nz.push(S('noise', k / 50, (k * 7 % 50) / 50, { seed: 1, scale: 4 }));
  check('noise: in 0..1, not flat, seeded', nz.every(v => v >= 0 && v <= 1) && Math.max(...nz) - Math.min(...nz) > 0.2 && S('noise', 0.3, 0.3, { seed: 1 }) !== S('noise', 0.3, 0.3, { seed: 2 }), 'flat');
  const bytes = new Uint8Array(1024); for (let k = 0; k < 1024; k++) bytes[k] = (k % 32) * 8; let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  check('photo: the 32 × 32 sample read back (left dark, right light)', S('photo', 0, 0.5, { lum: btoa(bin) }) < 0.05 && S('photo', 0.99, 0.5, { lum: btoa(bin) }) > 0.9, [S('photo', 0, 0.5, { lum: btoa(bin) }), S('photo', 0.99, 0.5, { lum: btoa(bin) })].join(' '));
  check('photo with no sample: ½', S('photo', 0.2, 0.2, {}) === 0.5, 'not ½');
  // walks on a 4 × 4 grid
  F.setTier('component'); await w(500); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  F.setTier('component'); set('rg-grid-cols', 1); set('rg-grid-rows', 1); await w(200); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const B = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(700);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450); set('symgen-cols', 4); set('symgen-rows', 4); await w(450);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, F.railPatch('component', i % 2 ? A : B)));
  const G = F.getSymbolGrid(), C = F.zoneContexts(G), all = C.map(c => c.index), at = i => C[i].row + ',' + C[i].col;
  check('snake: row 1 left → right, row 2 right → left', F.walkOrder(all, C, 'snake').slice(0, 8).map(at).join(' ') === '0,0 0,1 0,2 0,3 1,3 1,2 1,1 1,0', F.walkOrder(all, C, 'snake').slice(0, 8).map(at).join(' '));
  check('spiral: the 12 border cells first', F.walkOrder(all, C, 'spiral').slice(0, 12).every(i => F.whenMatches({ sel: 'border' }, C[i])), 'no');
  check('rings: the 4 centre cells first', F.walkOrder(all, C, 'rings').slice(0, 4).every(i => F.whenMatches({ sel: 'centre', size: 0.5 }, C[i])), F.walkOrder(all, C, 'rings').slice(0, 4).map(at).join(' '));
  check('diagonal: by col + row', F.walkOrder(all, C, 'diagonal').map(i => C[i].col + C[i].row).every((v, k, a) => !k || v >= a[k - 1]), 'unordered');
  // Field
  const run = p => F.applyZones(F.state.symbolCells, G, [{ when: { sel: 'all' }, do: { follow: { id: 'field', params: p, seed: 1 } } }]).cells;
  const fc = run({ signal: 'gradient', angle: 0, drive: 'content' });
  check('Field › content: the left half one content, the right half the other', fc.every((c, i) => c.componentName === (C[i].col < 2 ? fc[0].componentName : fc[3].componentName)) && fc[0].componentName !== fc[3].componentName, fc.map(c => c.componentName.slice(0, 3)).join(''));
  const ft = run({ signal: 'gradient', angle: 0, drive: 'turn' });
  check('Field › turn: 0 · 90 · 180 · 270 across', [0, 1, 2, 3].map(k => ft[k].rotation).join(' ') === '0 90 180 270', [0, 1, 2, 3].map(k => ft[k].rotation).join(' '));
  const fs = run({ signal: 'centre', drive: 'scale' });
  check('Field › size: smaller at the centre than at the corners', fs[5].scale < fs[0].scale, fs[5].scale + ' vs ' + fs[0].scale);
  const fe = run({ signal: 'gradient', angle: 0, drive: 'empty' });
  check('Field › holes: the first column empty, the last filled', fe[0].source === 'empty' && fe[3].source === 'component', fe[0].source + ' ' + fe[3].source);
  // Rhythm
  const rr = F.applyZones(F.state.symbolCells, G, [{ when: { sel: 'all' }, do: { follow: { id: 'rhythm', params: { walk: 'snake', seq: 'ABB', turn: 90 }, seed: 1 } } }]).cells;
  const ord = F.walkOrder(all, C, 'snake');
  check('Rhythm A B B along the snake, +90° a step', ord.every((i, t) => rr[i].componentName === rr[ord[t % 3 === 0 ? 0 : 1]].componentName && rr[i].rotation === (t * 90) % 360) && rr[ord[0]].componentName !== rr[ord[1]].componentName,
    ord.slice(0, 6).map(i => rr[i].componentName.slice(0, 3) + rr[i].rotation).join(' '));
  // offered
  const opts = F.zoneOptions(G, all, F.symbolContentPool(F.state.symbolCells), Organica.mulberry32(1), C);
  check('Suggest offers Field and Rhythm', ['field', 'rhythm'].every(id => opts.some(o => o.dos.some(d => d.follow && d.follow.id === id))), 'missing');
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS drive: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
