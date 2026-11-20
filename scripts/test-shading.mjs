// Headless check for shared/shading.js (Organica.shading): it must draw exactly what TuneSutra drew
// before the engine was promoted (scripts/shading-baseline.json, recorded from tunesutra/index.html on
// Nov 20, 2026). Run: node scripts/test-shading.mjs   — exits 1 when a check fails.
//   --record   re-record the baseline from shared/shading.js (only for a deliberate change of the look)
import fs from 'node:fs';
import path from 'node:path';
import { root, sharedContext, snapshot, PALETTE } from './shading-fixtures.mjs';

const ctx = sharedContext(['shading.js']);
const S = ctx.Organica.shading, C = ctx.Organica.color;
const E = { shadeDefs: S.defs, gradPlates: S.gradPlates, shadowInks: S.shadowInks, colourStop: S.colourStop, normalizeGrad: S.normalize, withColour: S.withColour };
const snap = snapshot(E, hex => C.scale(hex).map(s => s.hex));
const file = path.join(root, 'scripts/shading-baseline.json');
if (process.argv.includes('--record')) { fs.writeFileSync(file, JSON.stringify(snap)); console.log('recorded', file); process.exit(0); }
const base = JSON.parse(fs.readFileSync(file, 'utf8'));

let failed = 0;
function check(label, ok, detail) { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); }
const diff = (a, b) => Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

{ const d = diff(snap.plates, base.plates); check('plates match TuneSutra', !d.length, d.length ? d.slice(0, 6).join(', ') : Object.keys(base.plates).length + ' sets'); }
{ const d = diff(snap.inks, base.inks); check('shadow inks match', !d.length, d.join(', ') || Object.keys(base.inks).length + ' defs'); }
{ const d = diff(snap.defs, base.defs); check('presets (defs) match', !d.length, d.join(', ')); }
check('normalize matches', JSON.stringify(snap.normalize) === JSON.stringify(base.normalize));
check('withColour matches', JSON.stringify(snap.withColour) === JSON.stringify(base.withColour));
// the cache gives the same drawing, and one object per (def, box, palette)
{
  const def = S.defs(PALETTE[0]).speckle, c1 = { tints: ['#000000'] };
  const a = S.plates(def, 30, 20, c1), b = S.plates(def, 30, 20, c1);
  check('plates() cached', a === b && JSON.stringify(a) === JSON.stringify(S.gradPlates(def, 30, 20, c1)));
}
// platesSVG: one path per ink, the shape's own fill left out with skipFirst
{
  const pl = S.gradPlates(S.defs(PALETTE[0]).speckle, 30, 20, {});
  const svg = S.platesSVG(pl, 't', true);
  check('platesSVG skips the shape\'s own fill', !svg.includes('fill="' + pl[0].hex + '"') && (svg.match(/<path /g) || []).length === pl.slice(1).filter(p => p.d).length);
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
