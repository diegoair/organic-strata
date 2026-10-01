// Headless check for tunesutra/figures.js: every figure shows the palette in the
// Garment's proportions. Run: node scripts/test-figures.mjs — exits 1 on a miss.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ Math, window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'tunesutra/figures.js'), 'utf8'), ctx);
const FIGS = ctx.window.TUNESUTRA_FIGURES, shares = ctx.window.TUNESUTRA_FIGURE_SHARES;

const TARGET = [52.0, 32.2, 10.9, 4.8], TOL = 1;   // the Garment's own shares; ±1 point for the others
let failed = 0;
FIGS.forEach(fig => {
  const s = shares(fig), tol = fig.id === 'garment' ? 0.15 : TOL;
  const ok = s.every((v, i) => Math.abs(v - TARGET[i]) <= tol) && fig.zones.every(z => z.pts.every(p => p[0] >= -0.01 && p[0] <= fig.w + 0.01 && p[1] >= -0.01 && p[1] <= fig.h + 0.01));
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + fig.id.padEnd(8) + s.map(v => v.toFixed(1)).join(' / ') + '   3 colours: ' + [s[0], s[1], s[2] + s[3]].map(v => v.toFixed(1)).join(' / ') + '   ' + fig.zones.length + ' zones');
});
console.log(failed ? '\n' + failed + ' figure(s) off target' : '\nall figures within tolerance of ' + TARGET.join(' / '));
process.exit(failed ? 1 : 0);
