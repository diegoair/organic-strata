// Headless checks for tunesutra/house.js (TUNESUTRA_HOUSE).
// Run: node scripts/test-house.mjs           — exits 1 when a check fails
//      node scripts/test-house.mjs --record  — re-record the golden fingerprints (only after a deliberate change)
// The golden file keeps one fingerprint per colour count for seeds 1–200: a saved palette keeps its house by its
// seed, so a change that moves any existing house (3–7 colours) must be a decision, not an accident.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = path.join(root, 'scripts/house-golden.json');
const coreSrc = fs.readFileSync(path.join(root, 'shared/core.js'), 'utf8');
const mul = coreSrc.match(/Organica\.mulberry32 = function[\s\S]*?\n  };/)[0];
const ctx = vm.createContext({ Math, Number, String, Object, Array, Error, Map, Set, JSON, Infinity, NaN, isFinite, parseFloat, parseInt, Organica: {}, console });
ctx.window = ctx; ctx.globalThis = ctx;
vm.runInContext(mul, ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shared/shapes.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'tunesutra/house.js'), 'utf8'), ctx);
const H = ctx.TUNESUTRA_HOUSE;

let failed = 0;
function check(label, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : ''));
}
const SEEDS = 200;
const fingerprint = n => {
  const h = crypto.createHash('sha1');
  for (let s = 1; s <= SEEDS; s++) { const f = H.generate(s, n); h.update(JSON.stringify([f.w, f.h, f.shares.map(v => +v.toFixed(3)), f.zones.map(z => [z.role, z.d])])); }
  return h.digest('hex').slice(0, 16);
};
const COUNTS = Object.keys(H.SHARES).map(Number).sort((a, b) => a - b);

if (process.argv.includes('--record')) {
  const g = {}; COUNTS.forEach(n => { g[n] = fingerprint(n); });
  fs.writeFileSync(GOLDEN, JSON.stringify({ seeds: SEEDS, fingerprints: g }, null, 2) + '\n');
  console.log('recorded', GOLDEN, JSON.stringify(g));
  process.exit(0);
}

// 1. Existing houses do not move (the golden fingerprints).
const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')).fingerprints;
Object.keys(golden).forEach(n => {
  const fp = fingerprint(+n);
  check(n + ' colours: same houses as recorded', fp === golden[n], fp + (fp === golden[n] ? '' : ' (recorded ' + golden[n] + ')'));
});
// 2. Every count: shares solved, zones for every role, no throw, speed.
COUNTS.forEach(n => {
  let worst = 0, missing = 0, t = Date.now();
  for (let s = 1; s <= 500; s++) {
    const f = H.generate(s, n);
    f.shares.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - H.SHARES[n][i])); });
    for (let r = 0; r < n; r++) if (!f.zones.some(z => z.role === r)) { missing++; break; }
  }
  const ms = (Date.now() - t) / 500;
  check(n + ' colours: shares on target, every role drawn', worst <= 0.15 && !missing, 'worst share error ' + worst.toFixed(3) + ' · ' + ms.toFixed(2) + ' ms a house' + (missing ? ' · ' + missing + ' houses miss a role' : ''));
  const sum = H.SHARES[n].reduce((a, b) => a + b, 0);
  check(n + ' colours: SHARES sum to 100', Math.abs(sum - 100) < 0.05, sum.toFixed(2));
});

console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nALL PASS');
process.exit(failed ? 1 : 0);
