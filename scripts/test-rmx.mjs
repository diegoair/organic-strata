// One RMX math for the suite (Diego, Nov 21, 2026): Organica.palette.colorAt / rmxIndex (shared/palette.js) is the
// reference; Membrane wraps it, Camo Turing's display shader runs it in GLSL. This test checks
//   1. colorAt on fixtures, every Mapping (Tone · Posterize · Random · Tone + Random) with n = 2…9, against the
//      mapping written out here independently — plus Solid and Adaptive;
//   2. Membrane's rmxColorAt = colorAt (rnd = its per-index hash);
//   3. Camo Turing's shader: a score ramp rendered headless through the real DISPLAY_FRAG, every pixel read back
//      and compared with colorAt (±1 per channel) at the same rnd (the page's 48×48 rnd table, uRnd in the shader),
//      and its SVG export's band colours drawn from the same math.
// Run: node --experimental-websocket scripts/test-rmx.mjs   (--node-only skips the headless part) — exits 1 on a failure.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, sharedContext } from './shading-fixtures.mjs';

const ctx = sharedContext(['palette.js']);
const O = ctx.Organica, pal = O.palette;
let failed = 0;
function check(label, ok, detail) { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); }

const FIX = ['#1a1a2e', '#e94f37', '#f6e8c3', '#2a7f62', '#ffd23f', '#3b5bdb', '#c2255c', '#868e96', '#0b7285'];
const MAPS = ['tone', 'posterize', 'random', 'tonernd'];
const SCORES = Array.from({ length: 129 }, (_, i) => i / 128).concat([-0.2, 1.3]);
const RNDS = [0, 0.05, 0.25, 0.4999, 0.5, 0.75, 0.95, 0.99999];

// the mapping, written out from the spec (not from palette.js)
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function spec(score, rnd, colors, map) {
  const n = colors.length, s = clamp(score, 0, 1), last = n - 1;
  if (n === 1) return colors[0];
  if (map === 'random') return colors[Math.min(last, Math.floor(rnd * n))];
  if (map === 'posterize') return colors[clamp(Math.round(s * last), 0, last)];
  if (map === 'tonernd') return colors[clamp(Math.round(s * last + (rnd - 0.5) * 1.2), 0, last)];
  const pos = s * last, i0 = clamp(Math.floor(pos), 0, last), i1 = Math.min(last, i0 + 1), f = pos - i0;
  const a = hex2(colors[i0]), b = hex2(colors[i1]);
  return toHex(a.map((v, k) => v + (b[k] - v) * f));
}

console.log('1. Organica.palette.colorAt — every Mapping, n = 2…9');
for (let n = 2; n <= 9; n++) {
  const colors = FIX.slice(0, n);
  for (const map of MAPS) {
    let bad = 0, first = '';
    for (const s of SCORES) for (const rnd of RNDS) {
      const got = pal.colorAt(s, { mode: 'rmx', colors, submode: map, rnd }), want = spec(s, rnd, colors, map);
      if (got.toLowerCase() !== want) { bad++; if (!first) first = `s ${s} rnd ${rnd}: ${got} ≠ ${want}`; }
      if (map !== 'tone' && !colors.includes(got.toLowerCase())) { bad++; if (!first) first = `${got} is not a stop`; }
    }
    check(`n ${n} · ${map}`, !bad, bad ? `${bad} off — ${first}` : '');
  }
  // the stops themselves: Tone and Posterize land on colour k at score k/(n-1); Tone + Random at rnd 0.5 = Posterize
  const stopsOk = colors.every((c, k) => pal.colorAt(k / (n - 1), { mode: 'rmx', colors, submode: 'tone' }).toLowerCase() === c
    && pal.colorAt(k / (n - 1), { mode: 'rmx', colors, submode: 'posterize' }).toLowerCase() === c);
  const trOk = SCORES.every(s => pal.colorAt(s, { mode: 'rmx', colors, submode: 'tonernd', rnd: 0.5 }) === pal.colorAt(s, { mode: 'rmx', colors, submode: 'posterize' }));
  check(`n ${n} · stops exact, Tone + Random at rnd ½ = Posterize`, stopsOk && trOk);
}
{
  const ink = '#102030', paper = '#f0e0d0';
  check('Solid = the ink at every score', SCORES.every(s => pal.colorAt(s, { mode: 'solid', ink, paper }) === ink));
  check('Adaptive = Tone over [ink, paper]', SCORES.every(s => pal.colorAt(s, { mode: 'adaptive', ink, paper }) === spec(s, 0.5, [ink, paper], 'tone')));
  check('rmxIndex = the colour colorAt picks (discrete Mappings)', MAPS.slice(1).every(map => SCORES.every(s => RNDS.every(rnd =>
    FIX[pal.rmxIndex(s, rnd, FIX, map)] === pal.colorAt(s, { mode: 'rmx', colors: FIX, submode: map, rnd })))));
}

console.log('2. Membrane — rmxColorAt wraps colorAt');
{
  globalThis.Organica = O;   // membrane/js/color.js reads the global, as in the page
  const M = await import(pathToFileURL(path.join(root, 'membrane/js/color.js')).href);
  const hash = i => { const x = Math.sin(i * 127.1) * 43758.5453123; return x - Math.floor(x); };
  let bad = 0, first = '';
  for (let n = 2; n <= 9; n++) for (const map of MAPS) for (let i = 0; i < 200; i++) {
    const t = i / 200, colors = FIX.slice(0, n);
    const got = toHex(M.rmxColorAt(t, colors, map, i)), want = pal.colorAt(t, { mode: 'rmx', colors, submode: map, rnd: hash(i) }).toLowerCase();
    if (got !== want) { bad++; if (!first) first = `n ${n} ${map} i ${i}: ${got} ≠ ${want}`; }
  }
  check('rmxColorAt = colorAt (n 2…9, every Mapping, 200 points)', !bad, first);
  check('one colour → that colour', toHex(M.rmxColorAt(0.3, ['#abcdef'], 'tone', 1)) === '#abcdef');
}

if (process.argv.includes('--node-only')) { console.log(failed ? `\n${failed} FAILED` : '\nAll passed (node only)'); process.exit(failed ? 1 : 0); }

console.log('3. Camo Turing — the display shader against colorAt (headless WebGL2)');
const { openChrome } = await import('./lib/chrome-page.mjs');
const P = await openChrome();
const ready = await P.goto('/camo-turing/', 'window.__camo && window.__camo.dispMat && window.Organica && Organica.palette');
check('Camo Turing opens', ready, P.errors.join(' | '));
if (ready) {
  const res = await P.ev(`
    const C = window.__camo, T = C.THREE, u = C.dispMat.uniforms;
    const FIX = ${JSON.stringify(FIX)}, MAPS = ${JSON.stringify(MAPS)};
    const W = 384, H = 96;   // 8 × 2 px per 48×48 hash cell: no pixel on a cell edge
    const data = new Float32Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data[(y * W + x) * 4] = (x + 0.5) / W;   // the score ramp, left → right
    const tex = new T.DataTexture(data, W, H, T.RGBAFormat, T.FloatType); tex.needsUpdate = true;
    const rt = new T.WebGLRenderTarget(W, H, { type: T.UnsignedByteType });
    const R = C.rndTable, hash = (cx, cy) => R[cy * 48 + cx];   // the page's own rnd table — the shader reads it as uRnd
    const px = new Uint8Array(W * H * 4), out = [];
    const render = () => {
      u.uState.value = tex; u.uScoreIsFinal.value = 1; u.uTileN.value = 1; u.uDiffOn.value = 0; u.uPaperImgOn.value = 0;
      C.renderer.setRenderTarget(rt); C.renderer.render(C.dispScene, C.camera);
      C.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); C.renderer.setRenderTarget(null);
    };
    const compare = (label, want) => {
      let worst = 0, off = 0, first = '';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const w = Organica.hexToRGB255(want(x, y)), i = (y * W + x) * 4;   // read-back row 0 = vUv.y near 0
        const d = Math.max(Math.abs(px[i] - w[0]), Math.abs(px[i + 1] - w[1]), Math.abs(px[i + 2] - w[2]));
        if (d > worst) worst = d;
        if (d > 1) { off++; if (!first) first = 'x ' + x + ' y ' + y + ': [' + [px[i], px[i + 1], px[i + 2]] + '] ≠ ' + want(x, y); }
      }
      out.push({ label, worst, off, first });
    };
    for (let n = 2; n <= 9; n++) for (const map of MAPS) {
      const colors = FIX.slice(0, n);
      C.setRmx(colors, map); u.uColorMode.value = 2; render();
      compare('n ' + n + ' · ' + map, (x, y) => Organica.palette.colorAt((x + 0.5) / W,
        { mode: 'rmx', colors, submode: map, rnd: hash(Math.floor((x + 0.5) / W * 48), Math.floor((y + 0.5) / H * 48)) }));
    }
    const ink = '#1b3a2c', paper = '#f2e6cf';
    u.uInk.value = new T.Color(ink); u.uPaper.value = new T.Color(paper);
    u.uColorMode.value = 1; render();
    compare('Adaptive', x => Organica.palette.colorAt((x + 0.5) / W, { mode: 'adaptive', ink, paper }));
    u.uColorMode.value = 0; u.uThreshold.value = 5; render();   // every score under the threshold → the ink, as picked
    compare('Solid ink as picked (no linear darkening)', () => ink);
    // the SVG export: band colours from the same math (the live field, whatever it holds)
    const svg = {};
    for (const map of MAPS) {
      C.setRmx(FIX.slice(0, 5), map); u.uColorMode.value = 2;
      const s = C.buildExportSVGString();
      svg[map] = [...new Set((s.match(/fill="(#[0-9a-fA-F]{6})"/g) || []).map(m => m.slice(6, 13).toLowerCase()))];
    }
    return { out, svg };
  `);
  for (const r of res.out) check(`shader ${r.label} = colorAt ±1`, r.off === 0, r.off ? `${r.off} px off (worst ${r.worst}) — ${r.first}` : `worst ${r.worst}`);
  const five = FIX.slice(0, 5);
  const toneBands = Array.from({ length: 25 }, (_, k) => pal.colorAt(k / 24, { mode: 'rmx', colors: five, submode: 'tone' }).toLowerCase());
  check('SVG · Tone: every band colour is colorAt at its own score', res.svg.tone.length > 0 && res.svg.tone.every(c => toneBands.includes(c)), res.svg.tone.join(' '));
  for (const map of ['posterize', 'random', 'tonernd'])
    check(`SVG · ${map}: only the palette's own stops`, res.svg[map].length > 0 && res.svg[map].every(c => five.includes(c)), res.svg[map].join(' '));
  check('no page errors', !P.errors.length, P.errors.join(' | '));
}
console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
await P.close(failed ? 1 : 0);
