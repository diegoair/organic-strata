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
// Field (Nov 21, 2026): bands of the stops' colours, stacked, a new band every just-visible step; a field across the
// sheet reads the sheet at the box's place (cached apart); normalize keeps its settings. The pixel match against the
// smooth field is scripts/test-shading-field.mjs (headless).
{
  const def = S.normalize({ type: 'field', angle: 90, stops: ['#2b1d16', '#b5642f', '#f3e2b8'], field: { size: 38 } });
  check('normalize keeps a field', def.type === 'field' && def.field.size === 38 && def.field.slope === 45 && def.field.span === 'shape');
  check('normalize drops field settings off a field', !('field' in S.normalize({ type: 'linear', field: { size: 9 } })));
  const pl = S.gradPlates(def, 120, 80, {});
  const dE = pl.slice(1).map((p, i) => C.deltaE(pl[i].hex, p.hex));
  check('field: base + stacked bands', pl.length > 20 && pl[0].d === 'M0 0h120v80h-120z' && pl.slice(1).every(p => p.band > 0 && /^M[\d.\- L]+Z/.test(p.d)), pl.length + ' plates');
  check('field: each band a just-visible step (ΔE ≤ 2.5)', dE.every(d => d <= 2.5), 'max ΔE ' + Math.max(...dE).toFixed(2));
  check('field: first band ≈ the first stop', C.deltaE(pl[0].hex, '#2b1d16') < 2);
  const F = S.fieldValue(def, { x: 0, y: 0, w: 120, h: 80 });
  let lo = 1, hi = 0; for (let x = 0; x <= 120; x += 4) for (let y = 0; y <= 80; y += 4) { const v = F(x, y); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  check('field value in 0..1 and spread', lo >= 0 && hi <= 1 && hi - lo > 0.4, lo.toFixed(2) + '…' + hi.toFixed(2));
  const sheet = Object.assign({}, def, { field: Object.assign({}, def.field, { span: 'sheet' }) }), c2 = { sheet: { x: 0, y: 0, w: 600, h: 400 } };
  const a = S.shapePlates(sheet, '#2b1d16', { x: 0, y: 0, w: 120, h: 80 }, c2), b = S.shapePlates(sheet, '#2b1d16', { x: 300, y: 200, w: 120, h: 80 }, c2);
  check('field across the sheet: two places, two drawings', JSON.stringify(a) !== JSON.stringify(b));
  const e = S.shapePlates(def, '#2b1d16', { x: 0, y: 0, w: 120, h: 80 }, c2), f = S.shapePlates(def, '#2b1d16', { x: 300, y: 200, w: 120, h: 80 }, c2);
  check('field in each shape: the same drawing anywhere', JSON.stringify(e) === JSON.stringify(f));
  check('gradUses: field shows Angle and its rows', S.gradUses(def).angle && S.gradUses(def).field && !S.gradUses(S.normalize({ type: 'radial' })).field);
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
