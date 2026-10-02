// Headless check for shared/fvs-field.js (Organica.fvsField): the data it bakes
// so that it can run alone must equal what the rest of the system produces.
//   ELEMENTS  = Organica.shapes' own paths (truchet, arc, triangle, circle)
//   BUILTIN   = the library's built-in combinations through fvsField.resolve()
// Run: node scripts/test-fvs-field.mjs   — exits 1 on a mismatch.
//      node scripts/test-fvs-field.mjs --print   prints the BUILTIN literal to paste.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// the core helpers color / palette / shapes need, from core.js's own source text (as test-color.mjs does)
const coreSrc = read('shared/core.js');
function grab(name) {
  const m = coreSrc.match(new RegExp('Organica\\.' + name + ' = function[\\s\\S]*?\\n  };'));
  if (!m) throw new Error('core.js: Organica.' + name + ' not found');
  return m[0];
}
const ctx = vm.createContext({ Math, String, parseInt, Object, Array, Organica: {},
  matchMedia: () => ({ matches: false }) });
ctx.globalThis = ctx; ctx.window = ctx;
vm.runInContext(['normalizeHex', 'hexToRGB255', 'rgbToHex', 'mulberry32'].map(grab).join('\n'), ctx);
['shared/color.js', 'shared/palette.js', 'shared/shapes.js', 'shared/fvs-field.js'].forEach(f => vm.runInContext(read(f), ctx));
const O = ctx.Organica, F = O.fvsField;

const want = {
  truchet: O.shapes.arcTruchetGeometry(3, 0.5).d,
  arc: O.shapes.arcGeometry(42).d,
  builtin: JSON.parse(JSON.stringify(
    O.palette.library().filter(p => p.builtin && p.colors.length >= 2 && p.colors.length <= 7).map(F.resolve))),
};
if (process.argv.includes('--print')) {
  console.log(want.builtin.map(p => '    ' + JSON.stringify(p).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'").replace(/,(?=\S)/g, ', ')).join(',\n'));
  process.exit(0);
}

let failed = 0;
function check(label, ok) { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label); }
check('ELEMENTS.truchet = shapes.arcTruchetGeometry(3, 0.5).d', F.ELEMENTS.truchet === want.truchet);
check('ELEMENTS.arc = shapes.arcGeometry(42).d', F.ELEMENTS.arc === want.arc);
check('ELEMENTS.triangle = shapes.triangleGeometry(100, 100, 0).d', F.ELEMENTS.triangle === O.shapes.triangleGeometry(100, 100, 0).d);
check('ELEMENTS.circle = shapes.circleGeometry(90).d', F.ELEMENTS.circle === O.shapes.circleGeometry(90).d);
check('BUILTIN = the built-in combinations, resolved (' + want.builtin.length + ')',
  JSON.stringify(JSON.parse(JSON.stringify(F.BUILTIN))) === JSON.stringify(want.builtin));
check('palettes() with the library loaded returns the live library', F.palettes().length >= want.builtin.length);
if (failed) { console.log('\nfvs-field: ' + failed + ' check(s) failed — re-bake with --print'); process.exit(1); }
console.log('\nfvs-field: baked data matches');
