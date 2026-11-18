// Headless check for tunesutra/house.js — TuneSutra's one figure, a house generated from a seed.
// For many seeds and each colour count (3, 4, 5): the house is drawn, every role lands on its
// share (TUNESUTRA_HOUSE.SHARES, the same weights as the Bar), every zone stays inside the
// figure's box, and the same seed gives the same house twice.
// Run: node scripts/test-figures.mjs — exits 1 on a miss.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ Math, Number, Array, Object, JSON, String, Error, console });
ctx.window = ctx; ctx.globalThis = ctx;
// core.js's mulberry32 is all house.js needs from core (core itself wants a DOM)
const core = fs.readFileSync(path.join(root, 'shared/core.js'), 'utf8');
const m = core.match(/Organica\.mulberry32 = function \(seed\) \{[\s\S]*?\n  \};/);
if (!m) { console.error('FAIL  could not find Organica.mulberry32 in shared/core.js'); process.exit(1); }
vm.runInContext('var Organica = window.Organica = {}; ' + m[0], ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shared/shapes.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'tunesutra/house.js'), 'utf8'), ctx);
const H = ctx.TUNESUTRA_HOUSE;

const SEEDS = 300, TOL = 0.15;
let failed = 0;
const kinds = {};
for (const n of [3, 4, 5]) {
  let worst = 0, misses = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let fig;
    try { fig = H.generate(seed, n); } catch (e) { misses++; console.log(`  FAIL  n=${n} seed=${seed}: ${e.message}`); continue; }
    const target = H.SHARES[n];
    const dev = Math.max(...fig.shares.map((v, i) => Math.abs(v - target[i])));
    worst = Math.max(worst, dev);
    const sum = fig.shares.reduce((a, b) => a + b, 0);
    const nums = fig.zones.flatMap(z => (z.d.match(/-?\d+(\.\d+)?/g) || []).map(Number));
    // every end point of every command (M / L: x y; A: the last two of its seven numbers)
    const ends = d => (d.match(/[MLA][^MLAZ]*/g) || []).map(c => { const v = c.slice(1).trim().split(/[\s,]+/).map(Number); return v.slice(-2); });
    const inBox = fig.zones.every(z => ends(z.d).every(([x, y]) => x >= -0.6 && x <= fig.w + 0.6 && y >= -0.6 && y <= fig.h + 0.6));
    const again = JSON.stringify(H.generate(seed, n)) === JSON.stringify(fig);
    const roles = new Set(fig.zones.map(z => z.role));
    // every zone carries its own box (for its shading): real, inside the figure
    const bbOk = fig.zones.every(z => z.bb && z.bb[2] > z.bb[0] && z.bb[3] > z.bb[1] && z.bb[0] >= -0.6 && z.bb[1] >= -0.6 && z.bb[2] <= fig.w + 0.6 && z.bb[3] <= fig.h + 0.6);
    const ok = dev <= TOL && Math.abs(sum - 100) < 1e-6 && inBox && again && nums.every(Number.isFinite) && roles.size === n && bbOk;
    if (!ok) { misses++; if (misses <= 5) console.log(`  FAIL  n=${n} seed=${seed}: shares ${fig.shares.map(v => v.toFixed(2)).join(' / ')} · in box ${inBox} · boxes ${bbOk} · repeatable ${again} · roles ${roles.size}`); }
    fig.parts.split(' · ').forEach(p => { const k = p.replace(/^window 2 × /, 'window ').replace(/ \d+$/, ''); kinds[k] = (kinds[k] || 0) + 1; });
  }
  if (misses) failed += misses;
  console.log(`${misses ? '  FAIL ' : '  ok   '} ${n} colours · ${SEEDS} seeds · worst share off by ${worst.toFixed(3)} points (target ${H.SHARES[n].join(' / ')})`);
}
console.log('  parts drawn: ' + Object.keys(kinds).sort().map(k => `${k} ${kinds[k]}`).join(' · '));
console.log(failed ? `\n${failed} house(s) off the rules` : '\nevery house lands on its shares');
process.exit(failed ? 1 : 0);
