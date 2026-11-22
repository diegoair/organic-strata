// Headless check for a Pollen preset as a Shadow (Nov 22, 2026): Organica.pollenPresets.toMarks → the copy a palette
// keeps, drawn by Organica.shadeMarks 'pollen-preset' through Organica.shading. Run: node scripts/test-shade-pollen.mjs
import { sharedContext, PALETTE } from './shading-fixtures.mjs';

const ctx = sharedContext(['shading.js', 'pollen-presets.js']);
const S = ctx.Organica.shading, PP = ctx.Organica.pollenPresets, SM = ctx.Organica.shadeMarks;
let failed = 0;
function check(label, ok, detail) { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); }
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
// a seed outline without a DOM: a square, centred, longest side 1 (the browser samples the real seed)
const SQUARE = [[-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]];
const shapeOf = key => (key === 'g:seed-breath' ? SQUARE : null);
const hex = PALETTE[0], box = [80, 60];
const drawn = marks => S.gradPlates(S.normalize(S.withColour(S.pollenDef(hex, marks), hex)), box[0], box[1], {});
const inkD = plates => plates.filter((p, i) => i > 0).map(p => p.d).join('|');

const list = PP.list();
check('six built-ins listed', list.filter(p => p.id.indexOf('b:') === 0).length === 6, list.map(p => p.name).join(', '));
check('shade-marks knows pollen-preset', SM.has('pollen-preset'));

const out = {};
list.forEach(p => {
  const m = PP.toMarks(p.preset, p.name, shapeOf), d = inkD(drawn(m)), d2 = inkD(drawn(PP.toMarks(p.preset, p.name, shapeOf)));
  out[p.name] = { m, d };
  check(p.name + ': marks drawn', d.replace(/\|/g, '').length > 0, d.length + ' chars');
  check(p.name + ': the same twice', hash(d) === hash(d2));
});
check('Fine Dots keeps its seed outline', JSON.stringify(out['Fine Dots'].m.shapes) === JSON.stringify([SQUARE]));
check('Hatch Flow is strokes, flowing', out['Hatch Flow'].m.kind === 'stroke' && out['Hatch Flow'].m.angleFlow);
check('Lines Flow: a seed with no outline here draws as dots', out['Lines Flow'].m.shapes.length === 1 && out['Lines Flow'].m.shapes[0] === null && /a/.test(out['Lines Flow'].d));
check('presets differ from one another', new Set(Object.values(out).map(o => hash(o.d))).size === list.length);
check('no colour copied', !('ink' in out['Duotone'].m) && !('colorMode' in out['Duotone'].m) && !('rmxColors' in out['Duotone'].m));

// Size scales the preset: twice the Size, about a quarter of the marks (spacing ×2 in both directions)
{
  const m = out['Fine Dots'].m, lvl = () => 0.8;
  const n = sz => SM.render('pollen-preset', { w: 200, h: 200, level: lvl, size: sz, angle: 0, seed: 7, marks: m }).mid.concat(SM.render('pollen-preset', { w: 200, h: 200, level: lvl, size: sz, angle: 0, seed: 7, marks: m }).core).length / 2;
  const a = n(4), b = n(8), r = a / b;
  check('Size ×2 → spacing ×2 (marks ÷ ~4)', r > 2.8 && r < 5.5, a + ' → ' + b + ' (×' + r.toFixed(2) + ')');
}
// the copy: the def holds everything — deleting the preset (here: no presets at all) draws the same
{
  const def = S.normalize(S.withColour(S.pollenDef(hex, out['Felt-tip'].m), hex)), saved = JSON.parse(JSON.stringify(def));
  const before = inkD(S.gradPlates(def, box[0], box[1], {}));
  const BUILT = PP.BUILTIN, keys = Object.keys(BUILT), backup = {}; keys.forEach(k => { backup[k] = BUILT[k]; delete BUILT[k]; });
  const after = inkD(S.gradPlates(S.normalize(saved), box[0], box[1], {}));
  keys.forEach(k => { BUILT[k] = backup[k]; });
  check('a saved shadow draws the same with the preset gone', before === after && before.length > 0);
}
// normalize: marks live only on a pollen-preset shadow; a preset shadow without them is Dot
{
  const a = S.normalize(Object.assign({}, S.defs(hex)['pollen-dot'], { marks: out['Fine Dots'].m }));
  check('normalize drops marks off another texture', !('marks' in a));
  const b = S.normalize(Object.assign({}, S.defs(hex)['pollen-dot'], { specks: 'pollen-preset' }));
  check('a pollen-preset without marks reads as Dot', b.specks === 'pollen-dot' && !('marks' in b));
}
// old saved presets: 'g:<n>' remapped
check('old point type remapped', PP.toMarks({ pointType: 'g:1' }, 'old', k => (k === 'g:seed-breath' ? SQUARE : null)).shapes[0] === SQUARE);

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
