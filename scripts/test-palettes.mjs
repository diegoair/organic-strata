// Headless checks for shared/palettes.js (Organica.palettes): the suite's palettes as every tool reads them.
// Run: node scripts/test-palettes.mjs   — exits 1 when a check fails.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { root, sharedContext } from './shading-fixtures.mjs';

const ctx = sharedContext(['shading.js', 'hue-tone.js']);
// an in-memory Organica.store, the same API as shared/store.js
const DB = {};
ctx.Organica.store = tool => {
  DB[tool] = DB[tool] || {};
  return { read: () => JSON.parse(JSON.stringify(DB[tool])), peek: () => DB[tool], write: o => { DB[tool] = JSON.parse(JSON.stringify(o)); }, pull: () => Promise.resolve(DB[tool]), onSync: () => () => {} };
};
vm.runInContext(fs.readFileSync(path.join(root, 'shared/palettes.js'), 'utf8'), ctx, { filename: 'palettes.js' });
const P = ctx.Organica.palettes, S = ctx.Organica.shading;

let failed = 0;
function check(label, ok, detail) { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); }

// a palette as TuneSutra saves it: the second colour with its own shading (an old definition, to upgrade)
const own = { type: 'flat', stops: ['#3e7bc9', '#0a1a33'], shadow: true, amount: 60, specks: 'pollen-dot', speck: 4, hue: 'impressionist' };
DB.tunesutra = {
  'Dusk': { n: 3, colors: ['#C93ED6', '#3e7bc9', '#e8b04a'], names: ['Base', 'Secondary', 'Accent'], ids: ['c-1', 'c-2', 'c-3'], parts: ['main', 'sub', 'accent'], shades: [null, own, null], house: 77 },
  'Old': { n: 2, colors: ['#111111', '#eeeeee'] },
};
DB['tunesutra-favs'] = {
  'p:Dusk': { name: 'Dusk', colors: ['#c93ed6', '#3e7bc9', '#e8b04a'], house: 77, at: '2026-11-19T10:00:00Z' },
  'l:gen-40': { name: 'Yellow', colors: ['#2a3a8c', '#ffe600'], house: 12, at: '2026-11-20T10:00:00Z' },
};

{
  const L = P.list();
  check('list: saved first, then starred', L.map(p => p.source + ':' + p.name).join(', ') === 'saved:Dusk, saved:Old, starred:Yellow', L.map(p => p.id).join(', '));
  check('list: no built-ins (Riso, combinations)', !L.some(p => p.builtin || /riso|combo/.test(p.id)));
  check('list: a starred saved palette is listed once', L.filter(p => p.name === 'Dusk').length === 1);
  check('list: colours normalised', L[0].colors[0].hex === '#c93ed6' && L[0].colors[0].name === 'Base');
}
{
  const d = P.get('saved:Dusk');
  check('get: colours with role, part, ten tints', d && d.colours.length === 3 && d.colours[1].part === 'sub' && Object.keys(d.colours[0].tints).length === 10, d && Object.keys(d.colours[0].tints).join(','));
  check('get: a colour\'s own shading, upgraded', d.colours[1].shade && d.colours[1].shade.hue === 'analogous' && d.colours[1].shade.specks === 'pollen-dot' && d.colours[1].shade.stops[0] === '#3e7bc9');
  check('get: no own shading = flat (null)', d.colours[0].shade === null && d.colours[2].shade === null);
  check('get: the house kept', d.house === 77);
  const pl = S.plates(d.colours[1].shade, 40, 30, P.ctx(d));
  check('the shading draws (plates with the shadow inks)', pl.length >= 3 && pl.slice(1).some(p => p.d), pl.map(p => p.hex).join(' '));
  const o = P.get('saved:Old');
  check('get: an old palette gets parts, names and a house', o.colours[0].part === 'main' && o.colours[1].part === 'accent' && o.house >= 1);
  const s = P.get('star:l:gen-40');
  check('get: a starred palette, colours only (flat)', s && s.source === 'starred' && s.colours.every(c => c.shade === null) && s.house === 12);
  check('get: unknown id → null', P.get('saved:Nope') === null && P.get('x') === null);
}
{
  const d = P.get('saved:Dusk');
  d.colours[0].hex = '#d94e66';
  d.colours[0].shade = S.withColour(JSON.parse(JSON.stringify(S.defs('#d94e66').speckle)), '#d94e66');
  const before = JSON.stringify(DB.tunesutra['Dusk']);
  const n1 = P.saveAsNew(d, { tool: 'FVS' });
  check('saveAsNew: a new name, "<name> · <Tool>"', n1 === 'Dusk · FVS', n1);
  check('saveAsNew: the original never changes', JSON.stringify(DB.tunesutra['Dusk']) === before);
  const n2 = P.saveAsNew(P.get('saved:' + n1), { tool: 'FVS' });
  check('saveAsNew: numbered when taken, never "· FVS · FVS"', n2 === 'Dusk · FVS 2', n2);
  const r = DB.tunesutra[n1];
  check('saveAsNew: TuneSutra\'s format (colors, names, ids, parts, shades, house, set)', r.colors[0] === '#d94e66' && r.names.length === 3 && r.ids[1] === 'c-2' && r.parts.join() === 'main,sub,accent' && r.shades[0].specks === 'specks' && r.house === 77 && r.set.v === 1 && r.set.colours[0].own && r.set.colours[0].tints['900']);
  check('saveAsNew: a stable id and where it came from', /^pal-/.test(r.pid) && r.from && r.from.name === 'Dusk');
  const back = P.get('saved:' + n1);
  check('saveAsNew: reads back whole', back.colours[0].hex === '#d94e66' && back.colours[0].shade.specks === 'specks' && back.colours[1].shade.specks === 'pollen-dot');
}
{
  vm.runInContext(fs.readFileSync(path.join(root, 'tunesutra/palette-figures.js'), 'utf8'), ctx, { filename: 'palette-figures.js' });
  const F = ctx.TUNESUTRA_FIG, bad = [];
  for (let n = 2; n <= 9; n++) for (let i = 0; i < n; i++) if (F.roleName(i, n) !== P.roleName(i, n)) bad.push(n + '/' + i);
  check('role names mirror tunesutra/palette-figures.js', !bad.length, bad.join(', '));
  check('a starred colour is named by its role', P.list().find(p => p.source === 'starred').colors[1].name === 'Accent');
}
check('nameFor proposes what saveAsNew writes', P.nameFor(P.get('saved:Dusk'), { tool: 'Flexible Visual System' }) === 'Dusk · Flexible Visual System');
check('a chosen name is kept, numbered only when taken', P.saveAsNew(P.get('saved:Dusk'), { name: 'Dusk' }) === 'Dusk 2' && DB.tunesutra['Dusk'].house === 77);
check('ROLE_PARTS mirrors hue-tone.js', JSON.stringify(P.ROLE_PARTS) === JSON.stringify(ctx.Organica.hueTone.ROLE_PARTS));

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
