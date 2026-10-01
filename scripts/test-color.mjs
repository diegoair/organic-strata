// Headless checks for shared/color.js (Organica.color).
// Run: node scripts/test-color.mjs   — exits 1 on the first failed group.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// color.js needs only four core helpers — re-declared here from core.js's own
// source text so the test does not have to boot the DOM half of core.
const coreSrc = fs.readFileSync(path.join(root, 'shared/core.js'), 'utf8');
function grab(name) {
  const m = coreSrc.match(new RegExp('Organica\\.' + name + ' = function[\\s\\S]*?\\n  };'));
  if (!m) throw new Error('core.js: Organica.' + name + ' not found');
  return m[0];
}
const ctx = vm.createContext({ Math, String, parseInt, Organica: {} });
ctx.globalThis = ctx;
vm.runInContext(['normalizeHex', 'hexToRGB255', 'rgbToHex'].map(grab).join('\n'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shared/color.js'), 'utf8'), ctx);
const C = ctx.Organica.color, O = ctx.Organica;

let failed = 0;
function check(label, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : ''));
}
const near = (a, b, eps) => Math.abs(a - b) <= eps;

// 1. Round trip: every hex on a 17-level cube survives hex → OKLCH → hex exactly.
{
  let worst = 0, n = 0;
  for (let r = 0; r <= 255; r += 15) for (let g = 0; g <= 255; g += 15) for (let b = 0; b <= 255; b += 15) {
    const hex = O.rgbToHex(r, g, b), lch = C.hexToOklch(hex);
    const back = O.hexToRGB255(C.oklchToHex(lch.l, lch.c, lch.h));
    worst = Math.max(worst, Math.abs(back[0] - r), Math.abs(back[1] - g), Math.abs(back[2] - b));
    n++;
  }
  check('round trip hex → OKLCH → hex', worst <= 1, n + ' colours, worst channel error ' + worst + '/255');
}

// 2. Known values.
{
  const w = C.hexToOklab('#ffffff'), k = C.hexToOklab('#000000'), red = C.hexToOklch('#ff0000');
  check('white is L 1, black is L 0', near(w.L, 1, 1e-3) && near(k.L, 0, 1e-6) && near(w.a, 0, 1e-3) && near(w.b, 0, 1e-3));
  check('sRGB red is oklch(0.628 0.258 29.2)', near(red.l, 0.628, 2e-3) && near(red.c, 0.2577, 2e-3) && near(red.h, 29.23, 0.3),
    red.l.toFixed(4) + ' ' + red.c.toFixed(4) + ' ' + red.h.toFixed(2));
  check('contrast black/white is 21', near(C.contrast('#000000', '#ffffff'), 21, 1e-9));
  check('contrast #777777/white is 4.48', near(C.contrast('#777777', '#ffffff'), 4.48, 0.01), C.contrast('#777777', '#ffffff').toFixed(3));
  check('deltaE of a colour with itself is 0', C.deltaE('#c93ed6', '#c93ed6') === 0);
}

// 3. Gamut mapping: an impossible chroma comes back in gamut, hue and lightness held.
{
  let worstH = 0, worstL = 0;
  for (let h = 0; h < 360; h += 15) for (const l of [0.3, 0.5, 0.7, 0.9]) {
    const got = C.hexToOklch(C.oklchToHex(l, 0.4, h));
    let dh = Math.abs(got.h - h); if (dh > 180) dh = 360 - dh;
    worstH = Math.max(worstH, dh); worstL = Math.max(worstL, Math.abs(got.l - l));
  }
  check('gamut mapping holds hue and lightness', worstH < 3 && worstL < 0.012, 'worst hue drift ' + worstH.toFixed(2) + '°, worst L drift ' + worstL.toFixed(4));
}

// 4. Mix: endpoints exact, midpoint lightness is the mean (the perceptual point of it).
{
  const a = '#1e5be8', b = '#f0c020';
  const mid = C.hexToOklab(C.mix(a, b, 0.5)), A = C.hexToOklab(a), B = C.hexToOklab(b);
  check('mix endpoints', C.mix(a, b, 0) === a && C.mix(a, b, 1) === b);
  check('mix midpoint lightness is the mean', near(mid.L, (A.L + B.L) / 2, 0.01), mid.L.toFixed(4) + ' vs ' + ((A.L + B.L) / 2).toFixed(4));
}

// 5. Scale: fixed lightness per step across hues, strictly darker step by step, anchor kept.
{
  const picks = ['#c93ed6', '#f0e040', '#1e5be8', '#0a9a3e', '#e8321e', '#888888', '#f5f2ec', '#101010'];
  let worstL = 0, monotone = true, anchors = true, hueDrift = 0;
  picks.forEach(hex => {
    const sc = C.scale(hex), src = C.hexToOklch(hex);
    if (sc.filter(s => s.anchor).length !== 1 || sc.find(s => s.anchor).hex !== hex) anchors = false;
    sc.forEach((s, i) => {
      const got = C.hexToOklch(s.hex);
      if (!s.anchor) worstL = Math.max(worstL, Math.abs(got.l - C.SCALE_L[i]));
      if (i && got.l >= C.hexToOklch(sc[i - 1].hex).l) monotone = false;
      if (src.c > 0.03 && got.c > 0.03) { let d = Math.abs(got.h - src.h); if (d > 180) d = 360 - d; hueDrift = Math.max(hueDrift, d); }
    });
  });
  check('scale: non-anchor steps sit on their lightness target', worstL < 0.012, 'worst L error ' + worstL.toFixed(4));
  check('scale: every step darker than the one before', monotone);
  check('scale: the pick is kept, once, as the anchor', anchors);
  check('scale: hue held', hueDrift < 6, 'worst drift ' + hueDrift.toFixed(2) + '°');
  const plain = C.scale('#c93ed6', { snap: false });
  check('scale: snap off puts every step on target', plain.every(s => !s.anchor));
}

// 6. HSB / HSL round trips.
{
  let worst = 0;
  for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
    const hsl = C.rgbToHsl(r, g, b), back = C.hslToRgb(hsl.h, hsl.s, hsl.l);
    worst = Math.max(worst, Math.abs(back.r - r), Math.abs(back.g - g), Math.abs(back.b - b));
  }
  check('HSL round trip', worst <= 1, 'worst ' + worst + '/255');
  const p = C.hsbToRgb(300, 100, 100), raw = C.hsbToRgbRaw(300, 100, 100);
  check('HSB magenta', p.r === 255 && p.g === 0 && p.b === 255 && raw[0] === 255);
}

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nall checks passed');
process.exit(failed ? 1 : 0);
