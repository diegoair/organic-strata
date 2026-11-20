// Headless checks for shared/hue-tone.js (Organica.hueTone).
// Run: node scripts/test-hue-tone.mjs   — exits 1 when a check fails.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreSrc = fs.readFileSync(path.join(root, 'shared/core.js'), 'utf8');
function grab(name) {
  const m = coreSrc.match(new RegExp('Organica\\.' + name + ' = function[\\s\\S]*?\\n  };'));
  if (!m) throw new Error('core.js: Organica.' + name + ' not found');
  return m[0];
}
const ctx = vm.createContext({ Math, String, parseInt, Number, Object, Array, Map, Set, Error, Organica: {} });
ctx.globalThis = ctx;
vm.runInContext(['normalizeHex', 'hexToRGB255', 'rgbToHex'].map(grab).join('\n'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shared/color.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shared/hue-tone.js'), 'utf8'), ctx);
const HT = ctx.Organica.hueTone, C = ctx.Organica.color;

let failed = 0;
function check(label, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : ''));
}
const isHex = h => /^#[0-9a-f]{6}$/.test(h);

// 1. The key colours read as their codes.
{
  const keys = { '#e5000d': 'R/V', '#ff7f00': 'YR/V', '#fff200': 'Y/V', '#119352': 'G/V', '#1a439b': 'PB/V', '#5f238d': 'P/V', '#fbaec1': 'RP/P', '#963a04': 'YR/Dp', '#ffffff': 'N9.5', '#a1a1a1': 'N5', '#000000': 'N1.5' };
  const bad = Object.keys(keys).filter(h => HT.read(h).label !== keys[h]).map(h => h + ' → ' + HT.read(h).label);
  check('key colours read as their codes', !bad.length, bad.join(', ') || Object.keys(keys).length + ' colours');
}
// 2. Every cell's colour reads back to its own cell (gamut clipping may move a few).
{
  let ok = 0, miss = [];
  for (let hi = 0; hi < 10; hi++) for (let ti = 0; ti < 12; ti++) {
    const r = HT.read(HT.toneColour(hi, ti));
    if (!r.neutral && r.hi === hi && r.ti === ti) ok++; else miss.push(HT.HUES[hi].k + '/' + HT.TONES[ti].k + '→' + r.label);
  }
  check('cells read back to themselves', ok >= 114, ok + '/120' + (miss.length ? ' · moved: ' + miss.join(' ') : ''));
}
// 3. Names.
{
  const want = { '#e5000d': 'Carmine', 'silver': 'Sterling silver', 'pinkgold': 'Rose gold', '229-0-13': 'Carmine', '#a1a1a1': 'Grey', '#dedede': 'Pale grey' };
  const bad = Object.keys(want).filter(t => HT.nameOf(t) !== want[t]).map(t => t + ' → ' + HT.nameOf(t));
  check('names', !bad.length, bad.join(', ') || Object.keys(want).length + ' names');
  const cell = HT.nameOf(HT.toneColour(8, 3));
  check('a cell colour is named tone + hue', cell === 'Pale purple', cell);
  const dup = HT.settleNames(['#e31a2a', '#d40039', '#e5000d']);
  check('settleNames separates colours sharing a cell', !dup.length, dup.join(' · ') || ['#e31a2a', '#d40039'].map(HT.nameOf).join(' / '));
}
// 4. Readings.
{
  const r = HT.readPalette(['#e5000d', '#008a84', '#fff200']);
  check('readPalette gives relations and a position', r.rs.length === 3 && typeof r.hueRel === 'string' && Math.abs(r.pos.x) <= 1 && Math.abs(r.pos.y) <= 1, r.hueRel + ' · ' + r.toneRel + ' · ' + r.purity);
}
// 5. The hue × tone generator: deterministic, right length, valid colours.
{
  const opts = { image: 'base', hue: 'complement', tone: 'near', purity: 'same', n: 5, neutral: 'auto' };
  const a = HT.generate('#e5000d', opts, 7), b = HT.generate('#e5000d', opts, 7);
  check('generate is deterministic', JSON.stringify(a) === JSON.stringify(b), a.join(' '));
  check('generate returns n valid colours', a.length === 5 && a.every(isHex), a.length + ' colours');
}
// 6. The role generator, 2–9.
{
  let bad = [];
  for (let n = 2; n <= 9; n++) for (let s = 1; s <= 40; s++) {
    const out = HT.generateRoles('#e5000d', n, s);
    if (out.length !== n) bad.push(n + ':' + s + ' length ' + out.length);
    else if (!out.every(x => isHex(x.hex))) bad.push(n + ':' + s + ' bad hex');
    else if (out.map(x => x.part).join() !== HT.ROLE_PARTS[n].join()) bad.push(n + ':' + s + ' order');
    else if (out.find(x => x.part === 'main').hex !== '#e5000d') bad.push(n + ':' + s + ' main');
  }
  check('generateRoles 2–9: length, order, main kept', !bad.length, bad.slice(0, 5).join(', ') || '8 counts × 40 seeds');
  const again = JSON.stringify(HT.generateRoles('#1a439b', 8, 12)) === JSON.stringify(HT.generateRoles('#1a439b', 8, 12));
  check('generateRoles is deterministic', again);
  // The lab's output for the same inputs (explorations/tunesutra-hue-tone, Nov 19) — the move changed nothing.
  const six = HT.generateRoles('#e5000d', 6, 1).map(x => x.hex).join(' '), seven = HT.generateRoles('#e5000d', 7, 1).map(x => x.hex).join(' ');
  check('same 6-colour result as the lab', six === '#d2ecb6 #000000 #e5000d #351251 #feddd8 #cacaca', six);
  check('same 7-colour result as the lab', seven === '#d2ecb6 #cccb97 #000000 #e5000d #9b4037 #a09c4b #e0d8ea', seven);
}
// 7. Reference data, when it is on this machine (local only): the model reproduces it closely.
{
  const p = path.join(root, 'explorations/tunesutra-hue-tone/book-pages/book-data.js');
  if (fs.existsSync(p)) {
    const w = {}; vm.runInContext(fs.readFileSync(p, 'utf8'), vm.createContext({ window: w }));
    const toks = new Set();
    w.BOOK_DATA.pages.forEach(pg => { (pg.pairs || []).flat().forEach(t => toks.add(t)); (pg.triads || []).forEach(t => t.c.forEach(x => toks.add(x))); });
    const cols = [...toks].filter(t => /^\d+-\d+-\d+$/.test(t)).map(HT.toHex).filter(h => C.hexToOklch(h).c >= 0.02);
    const dE = cols.map(h => { const r = HT.read(h); return C.deltaE(h, HT.toneColour(r.hi, r.ti)); });
    const mean = dE.reduce((a, b) => a + b, 0) / dE.length;
    check('reference colours: mean ΔE to their cell', mean <= 3.5, mean.toFixed(2) + ' over ' + cols.length + ' colours');
  } else console.log('  skip reference data (not on this machine)');
}

// The hue relation in the editor's harmony words: built from the model's own V colours (hue index → harmony).
{
  const V = hi => HT.toneColour(hi, HT.TONES.findIndex(T => T.k === 'V'));
  const cases = [
    [[V(0), V(0)], 'monochromatic'], [[V(0), V(1), V(2)], 'analogous'], [[V(0), V(5)], 'complementary'],
    [[V(0), V(4), V(6)], 'split'], [[V(0), V(3), V(7)], 'triadic'], [[V(0), V(2), V(5), V(7)], 'tetradic'],
    [[V(0), '#ffffff', '#000000'], null], [[V(0), V(3)], 'varied'],
  ];
  const bad = cases.filter(([h, want]) => HT.harmonyOf(h) !== want).map(([h, want]) => want + '→' + HT.harmonyOf(h));
  check('harmonyOf reads the editor harmonies', !bad.length, bad.join(', '));
}

// The generator's hue relations read back as the harmony they ask for.
{
  const key = '#e5000d', ask = { same: 'monochromatic', complement: 'complementary', split: 'split', triad: 'triadic' }, bad = [];
  Object.keys(ask).forEach(rel => {
    [3, 5, 7].forEach(n => ['none', 'auto'].forEach(neutral => {
      if (neutral !== 'none' && n - 1 < 3 && (rel === 'split' || rel === 'triad')) return;   // a neutral leaves two hues: no split or triad to make
      let ok = 0;
      for (let s = 1; s <= 20; s++) { const p = HT.generate(key, { image: 'base', hue: rel, tone: 'near', purity: 'any', n, neutral }, s); if (HT.harmonyOf(p) === ask[rel]) ok++; }
      if (ok < 16) bad.push(rel + ' n' + n + ' ' + neutral + ' ' + ok + '/20');
    }));
  });
  check('generate(hue) reads back as its harmony at 3, 5, 7 colours (16 of 20 seeds at least)', !bad.length, bad.join(', '));
}

// A palette from an image: a synthetic picture of known areas reads back as those colours and shares.
{
  const px = (cols) => {   // cols = [[hex, count]] → rgba
    const out = []; cols.forEach(([h, k]) => { const [r, g, b] = ctx.Organica.hexToRGB255(h); for (let i = 0; i < k; i++) out.push(r, g, b, 255); }); return Uint8ClampedArray.from(out);
  };
  const img = px([['#1a439b', 6000], ['#f4efe4', 3000], ['#e5000d', 800], ['#fff200', 200]]);
  const a = HT.extract(img, { n: 4 }), sum = a.reduce((s, c) => s + c.share, 0);
  check('extract finds the four colours, largest first', a.length === 4 && a.every(c => isHex(c.hex)) && C.deltaE(a[0].hex, '#1a439b') < 3 && C.deltaE(a[3].hex, '#fff200') < 3,
    a.map(c => c.hex + ' ' + c.share.toFixed(1)).join(' · '));
  check('extract shares sum to 100 and follow the areas', Math.abs(sum - 100) < 1e-6 && Math.abs(a[0].share - 60) < 1, a[0].share.toFixed(2));
  const blues = px([['#1a439b', 6000], ['#4a78d8', 3000], ['#fff200', 400]]);
  const two = HT.extract(blues, { n: 2 }), spread = HT.extract(blues, { n: 2, pick: 'spread' });
  check('pick area keeps the two blues, spread keeps the small yellow', !two.some(c => C.deltaE(c.hex, '#fff200') < 10) && spread.some(c => C.deltaE(c.hex, '#fff200') < 10),
    'area ' + two.map(c => c.hex).join(' ') + ' · spread ' + spread.map(c => c.hex).join(' '));
  const flat = HT.extract(px([['#808080', 500], ['#828282', 500]]), { n: 5 });
  check('near colours merge: a flat image gives fewer colours', flat.length === 1, flat.length + ' colour(s)');
  check('extract is deterministic', JSON.stringify(HT.extract(img, { n: 3, pick: 'spread' })) === JSON.stringify(HT.extract(img, { n: 3, pick: 'spread' })));
  check('transparent pixels are left out', HT.extract(Uint8ClampedArray.from([0, 0, 0, 0]), { n: 3 }).length === 0);
}

// 11. generate never repeats a colour (Nov 20, 2026: it kept a duplicate after 12 retries — a third of the palettes).
{
  const keys = ['#e5000d', '#2a6fdb', '#f2c94c', '#3a7d44', '#7b3fa0', '#f4a7b9', '#5a3e2b'];
  let total = 0, dup = 0, mono = 0, monoOk = 0, first = '';
  for (const hue of ['same', 'similar', 'complement', 'split', 'opposite', 'triad', 'free'])
    for (const tone of ['same', 'near', 'far']) for (const image of ['base', 'casual', 'heavy']) for (const neutral of ['none', 'auto'])
      for (const n of [2, 4, 6, 9]) for (const k of keys) for (let s = 1; s <= 3; s++) {
        const p = HT.generate(k, { image, hue, tone, purity: 'any', n, neutral }, s); total++;
        let clash = p.length !== n;
        for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (C.deltaE(p[i], p[j]) < C.DISTINCT_MIN) clash = true;
        if (clash) { dup++; if (!first) first = [k, hue, tone, image, neutral, n, s].join(' '); }
        if (hue === 'same' && neutral === 'none' && n <= 8) { mono++; if (HT.harmonyOf(p) === 'monochromatic') monoOk++; }
      }
  check('generate: n distinct colours in every palette', dup === 0, dup + ' of ' + total + ' clash' + (first ? ' (first: ' + first + ')' : ''));
  check('generate: a single hue stays one hue up to 8 colours', monoOk === mono, monoOk + ' of ' + mono);
}

console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nALL PASS');
process.exit(failed ? 1 : 0);
