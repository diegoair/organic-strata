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
// The 5-colour Scene (Nov 17, 2026): its own proportions — 5 roles, largest first, inside its box.
const SC = ctx.window.TUNESUTRA_SCENE5;
if (SC) {
  const s = shares(SC);
  const ok = s.length === 5 && Math.abs(s.reduce((a, b) => a + b, 0) - 100) < 1e-6 && s.every((v, i) => i === 0 || v < s[i - 1]) && s[4] > 0
    && SC.zones.every(z => z.pts.every(p => p[0] >= -0.01 && p[0] <= SC.w + 0.01 && p[1] >= -0.01 && p[1] <= SC.h + 0.01));
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + 'scene    ' + s.map(v => v.toFixed(1)).join(' / ') + '   (5 colours, its own proportions)');
}
process.exit(failed ? 1 : 0);
