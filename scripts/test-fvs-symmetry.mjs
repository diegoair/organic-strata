#!/usr/bin/env node
// FVS Zones › Symmetry (Oct 27, 2026): engine/03-symmetry. composePose is a group (identity, associativity, inverse) over
// D4 and D6; each of the 12 wallpaper groups on a square lattice leaves its result unchanged under every generator (the
// cell a generator sends a cell to holds the same content, posed by the generator); orbit counts on a tile; which
// groups a grid carries; rosettes on radial / hexagonal grids; the Zone generators (ZONE_FOLLOW wallpaper / rosette)
// through applyZones.
// Usage: scripts/test-fvs-symmetry.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const eq = (a, b) => a.f === b.f && Math.abs((((a.r - b.r) % 360) + 360) % 360) < 1e-6;
  // the pose algebra
  for (const step of [90, 60]) {
    const els = []; for (let r = 0; r < 360; r += step) for (const f of [false, true]) els.push({ r, f });
    let ok = true;
    els.forEach(a => { if (!eq(F.composePose(a, { r: 0, f: false }), a) || !eq(F.composePose({ r: 0, f: false }, a), a)) ok = false;
      els.forEach(b => els.forEach(c => { if (!eq(F.composePose(F.composePose(a, b), c), F.composePose(a, F.composePose(b, c)))) ok = false; })); });
    check('composePose: identity and associativity over D' + (360 / step), ok, 'fails');
    const mirror = { r: 0, f: true };
    check('…a mirror is its own inverse; F·R(θ) = R(−θ)·F', eq(F.composePose(mirror, mirror), { r: 0, f: false }) && eq(F.composePose(mirror, { r: step, f: false }), F.composePose({ r: 360 - step, f: false }, mirror)), 'no');
  }
  // the wallpaper groups on an 8 × 8 lattice: invariance under every generator
  const cr = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) cr.push({ col: c, row: r });
  const idxs = cr.map((_, i) => i), act = (p, x, y) => { if (p.f) x = -x; const t = p.r * Math.PI / 180; return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]; };
  const rnd = Organica.mulberry32(5), base = idxs.map(() => ({ name: 'c' + Math.floor(rnd() * 3), pose: { r: 90 * Math.floor(rnd() * 4), f: rnd() < 0.5 } }));
  const avail = [], axisNote = [];
  for (const [group, gens] of Object.entries(F.WALLPAPER)) for (const n of [2, 4]) {
    const M = F.wallpaperMap(idxs, cr, group, n);
    if (!M) continue;
    avail.push(group + '/' + n);
    const out = idxs.map(i => { const m = M.get(i), b = base[m.rep]; return { name: b.name, pose: F.composePose(m.pose, b.pose) }; });
    let bad = 0, tried = 0, axis = 0;
    idxs.forEach(i => gens.forEach(g => {
      const { col, row } = cr[i], u = ((col % n) + n) % n, v = ((row % n) + n) % n, h = n / 2;
      const [x, y] = act(g.p, u + 0.5 - h, v + 0.5 - h);
      const du = Math.floor(x + h + g.t[0] * n + 1e-6) - u, dv = Math.floor(y + h + g.t[1] * n + 1e-6) - v;
      const c2 = col + du, r2 = row + dv;
      // the image modulo the tile, inside the lattice
      const cc = ((c2 % 8) + 8) % 8, rr = ((r2 % 8) + 8) % 8, j = rr * 8 + cc;
      if (M.get(i).axis || M.get(j).axis) { axis++; return; }
      tried++; if (out[j].name !== out[i].name || !eq(out[j].pose, F.composePose(g.p, out[i].pose))) bad++;
    }));
    check(group + ' (tile ' + n + '): every generator maps the pattern onto itself' + (axis ? ' (off the axes)' : ''), bad === 0 && (tried > 0 || !gens.length), bad + ' / ' + tried);
    axisNote.push(group + '/' + n + ' ' + new Set(idxs.filter(i => M.get(i).axis).map(i => (cr[i].col % n) + ',' + (cr[i].row % n))).size + '/' + (n * n));
  }
  rows.push('  · places on an axis per tile: ' + axisNote.filter(x => !x.includes(' 0/')).join(', '));
  check('all 12 groups on a square lattice (tile 2 or 4)', Object.keys(F.WALLPAPER).every(g => avail.includes(g + '/2') || avail.includes(g + '/4')), avail.join(' '));
  const orbits = (group, n) => new Set([...F.wallpaperMap(idxs, cr, group, n).values()].map(m => m.rep)).size;
  check('orbits on a tile: p1/2 = 4, p2/2 = 2, p4/2 = 1, p4m/4 = 3, pmm/4 = 4', orbits('p1', 2) === 4 && orbits('p2', 2) === 2 && orbits('p4', 2) === 1 && orbits('p4m', 4) === 3 && orbits('pmm', 4) === 4,
    [orbits('p1', 2), orbits('p2', 2), orbits('p4', 2), orbits('p4m', 4), orbits('pmm', 4)].join(' '));
  // through the Zones: a Symbol, a zone that follows p4m
  F.setTier('component'); await w(500); q('btn-generate').click(); await w(800);
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  F.setTier('symbol'); await w(700);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450); set('symgen-cols', 8); set('symgen-rows', 8); await w(450);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, { ...F.railPatch('component', A), rotation: 90 * Math.floor(rnd() * 4), flipH: rnd() < 0.5 }));
  const G = F.getSymbolGrid(), C = F.zoneContexts(G);
  const sp = F.ZONE_FOLLOW.wallpaper.space(G, idxs, C);
  check('Symmetry offers the 12 groups on an 8 × 8 zone', new Set(sp.map(p => p.group)).size === 12, sp.map(p => p.group + p.n).join(' '));
  const out = F.applyZones(F.state.symbolCells, G, [{ when: { sel: 'all' }, do: { follow: { id: 'wallpaper', params: { group: 'p4m', n: 4 }, seed: 1 } } }]).cells;
  const M = F.wallpaperMap(idxs, C, 'p4m', 4);
  check('p4m through applyZones: each cell = its representative, posed', idxs.every(i => { const m = M.get(i), s = F.state.symbolCells[m.rep], p = F.composePose(m.pose, F.poseOf(s)); return Math.abs(out[i].rotation - p.r) < 1e-6 && !!out[i].flipH === p.f; }), 'mismatch');
  check('…the representatives keep theirs', [...new Set([...M.values()].map(m => m.rep))].every(r => out[r].rotation === F.state.symbolCells[r].rotation), 'changed');
  // a zone on part of the grid: the rest stays
  const tl = F.zoneCells({ sel: 'quadrant', q: 'tl' }, C);
  const out2 = F.applyZones(F.state.symbolCells, G, [{ when: { sel: 'quadrant', q: 'tl' }, do: { follow: { id: 'wallpaper', params: { group: 'p4', n: 2 }, seed: 1 } } }]).cells;
  check('a zone of a quadrant: only its 16 cells change', out2.every((c, i) => tl.includes(i) || c.rotation === F.state.symbolCells[i].rotation), 'changed outside');
  // rosettes: radial (6 sectors) and hexagonal
  set('sel-symgrid-gen', 'radial'); await w(500); if (q('symgen-rings')) set('symgen-rings', 5); if (q('symgen-sectors')) set('symgen-sectors', 6); await w(500);
  { const G2 = F.getSymbolGrid(), C2 = F.zoneContexts(G2), all = C2.map(c => c.index), rs = F.ZONE_FOLLOW.rosette.space(G2, all, C2).map(p => (p.mirror ? 'D' : 'C') + p.m);
    check('radial, 6 sectors: rosettes C2 · C3 · C6 (no C4, no C8)', ['C2', 'C3', 'C6'].every(x => rs.includes(x)) && !rs.includes('C4') && !rs.includes('C8'), rs.join(' '));
    check('…and the wallpaper groups are not offered (no square lattice)', !F.ZONE_FOLLOW.wallpaper.applies(G2, all, C2), 'offered'); }
  set('sel-symgrid-gen', 'hexagonal'); await w(500); if (q('symgen-cols')) set('symgen-cols', 7); await w(500);
  { const G3 = F.getSymbolGrid(), C3 = F.zoneContexts(G3), all = C3.map(c => c.index), rs = F.ZONE_FOLLOW.rosette.space(G3, all, C3).map(p => (p.mirror ? 'D' : 'C') + p.m);
    check('hexagonal: at least a 2-fold rosette', rs.includes('C2'), rs.join(' ') || 'none'); rows.push('  · hexagonal rosettes: ' + (rs.join(' ') || 'none')); }
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS symmetry: ${ok ? 'PASS' : 'FAIL'} — ${rows.filter(x => /^[✓✗]/.test(x)).length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
