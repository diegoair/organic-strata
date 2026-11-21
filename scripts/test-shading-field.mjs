// Headless check for the Field fill (shared/shading.js, Nov 21, 2026): its vector bands must look like the smooth
// field they come from — Diego: "quello che vediamo Screen · smooth sia uguale anche in SVG export". Every pixel of
// the field computed directly (S.fieldValue → the stops' colour, OKLab) against the plates' SVG rasterised by Chrome.
// Run: node --experimental-websocket scripts/test-shading-field.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 180000 });
await P.goto('/privacy/', 'true');
const LOAD = `
  for (const f of ['core.js', 'color.js', 'noise.js', 'shade-marks.js', 'shading.js']) {
    if (f === 'shading.js' && window.Organica && Organica.shading && Organica.shading.fieldPlates) break;
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/shared/' + f + '?t=' + Date.now(); s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }`;
const COMPARE = `
  async function compare(def, box, ctx) {
    const S = Organica.shading, W = Math.round(box.w), H = Math.round(box.h);
    const stops = S.gradStops(def, ctx), across = def.field && def.field.span === 'sheet' && ctx.sheet;
    const F = S.fieldValue(def, across ? ctx.sheet : { x: 0, y: 0, w: box.w, h: box.h }), o = across ? box : { x: 0, y: 0 };
    const a = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = Organica.hexToRGB255(S.colourAt(stops, F(o.x + x + 0.5, o.y + y + 0.5))), i = (y * W + x) * 4;
      a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255;
    }
    const t0 = performance.now(), pl = S.shapePlates(def, '#000001', box, ctx), ms = performance.now() - t0;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + S.platesSVG(pl, 't') + '</svg>';
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const b = g.getImageData(0, 0, W, H).data;
    let sum = 0, big = 0; const n = W * H;
    for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); sum += d; if (d > 6) big++; }
    return { mean: sum / n, over6: 100 * big / n, kb: svg.length / 1024, bands: pl.length, ms: ms };
  }`;
const CASES = [
  ['each shape, 3 stops', `{ type: 'field', angle: 90, stops: ['#2b1d16', '#b5642f', '#f3e2b8'] }`, `{ x: 40, y: 30, w: 240, h: 160 }`, `{}`],
  ['each shape, small, 5 stops', `{ type: 'field', angle: 135, stops: ['#0d1b2a', '#1b3a5c', '#2f6f8f', '#7fb7be', '#e6f2ef'], field: { size: 24, slope: 30, wave: 20, seed: 7 } }`, `{ x: 0, y: 0, w: 96, h: 120 }`, `{}`],
  ['across the sheet', `{ type: 'field', angle: 90, stops: ['#2a0f2e', '#d2465a', '#fbe6c2'], field: { span: 'sheet' } }`, `{ x: 220, y: 90, w: 200, h: 150 }`, `{ sheet: { x: 0, y: 0, w: 600, h: 400 } }`],
];
let failed = 0;
await P.ev(LOAD);
for (const [label, def, box, ctx] of CASES) {
  const r = await P.ev(COMPARE + `return await compare(Organica.shading.normalize(${def}), ${box}, ${ctx});`);
  const ok = r && r.mean < 2.5 && r.over6 < 1;
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + label + ' — mean ' + r.mean.toFixed(2) + '/255, ' + r.over6.toFixed(2) + '% over 6, ' + r.bands + ' plates, ' + Math.round(r.kb) + ' KB, ' + Math.round(r.ms) + ' ms');
}
if (P.errors.length) { failed++; console.log('  FAIL page errors — ' + P.errors.join(' | ')); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
