// Headless check for the plates of a wash (O-92 c, Nov 21, 2026 — Diego: one plate per stop, the bands halftoned).
// A shape filled with its colour and washed through 3 stops, separated by Organica.plateExport: (1) the inks are the
// stops (3), not the ~60 bands; (2) every plate is pure black on clear; (3) in every block of the picture each plate's
// ink covers the share of its stop that the field gives there (the dots add up to the wash); (4) the shape's own fill
// is covered by the wash on its plate (no solid under the screen); (5) a wash across the sheet anchors its screen on
// the sheet. Run: node --experimental-websocket scripts/test-wash-plates.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 180000 });
await P.goto('/privacy/', 'true');
await P.ev(`
  for (const f of ['core.js', 'color.js', 'noise.js', 'shade-marks.js', 'shading.js', 'plate-export.js']) {
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/shared/' + f + '?t=' + Date.now(); s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }`);
const R = await P.ev(`
  const S = Organica.shading, X = Organica.plateExport, W = 240, H = 160, K = 8;   // drawn K× so the dots resolve
  const def = S.normalize({ type: 'field', angle: 90, stops: ['#2b1d16', '#b5642f', '#f3e2b8'] });
  const shape = 'M0 0h' + W + 'v' + H + 'h-' + W + 'z', hex = '#2b1d16';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="#ffffff"/>'
    + '<path fill="' + hex + '" d="' + shape + '"/>' + S.overlaySVG(def, hex, shape, { box: { x: 0, y: 0, w: W, h: H } }) + '</svg>';
  const inks = X.inksOf(svg, [hex], '#ffffff');
  const raster = async s => {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace('<svg ', '<svg width="' + W * K + '" height="' + H * K + '" ')); await img.decode();
    const cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, W * K, H * K).data;
  };
  const out = { inks: inks, bands: (svg.match(/data-mix=/g) || []).length, impure: 0, worst: 0, sumWorst: 0, kb: 0 };
  const B = 8, cov = [];   // blocks of B×B units (W, H multiples of B): the plate's mean ink against the stop's mean share there
  for (let i = 0; i < inks.length; i++) {
    const pl = X.plateSVG(svg, inks, i, '#ffffff'); out.kb = Math.max(out.kb, Math.round(pl.length / 1024));
    const d = await raster(pl), c = new Float32Array((W / B) * (H / B));
    for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) {
      const p = (y * W * K + x) * 4, a = d[p + 3] / 255;
      if (a > 0.02 && Math.max(d[p], d[p + 1], d[p + 2]) > 40) out.impure++;   // anything but black ink or clear
      c[Math.floor(y / K / B) * (W / B) + Math.floor(x / K / B)] += a / (K * K * B * B);
    }
    cov.push(c);
  }
  const stops = S.gradStops(def, {}), F = S.fieldValue(def, { x: 0, y: 0, w: W, h: H });
  for (let by = 0; by < H / B; by++) for (let bx = 0; bx < W / B; bx++) {
    const want = new Float32Array(inks.length);
    for (let y = 0; y < B; y += 0.5) for (let x = 0; x < B; x += 0.5) {
      const sg = S.segAt(stops, F(bx * B + x + 0.25, by * B + y + 0.25)), n = 4 * B * B;
      want[inks.indexOf(stops[sg.a].hex)] += (1 - sg.f) / n; want[inks.indexOf(stops[sg.a + 1].hex)] += sg.f / n;
    }
    let sum = 0;
    for (let i = 0; i < inks.length; i++) { const got = cov[i][by * (W / B) + bx]; sum += got; out.worst = Math.max(out.worst, Math.abs(got - want[i])); }
    out.sumWorst = Math.max(out.sumWorst, Math.abs(sum - 1));
  }
  // across the sheet: the screen is anchored on the sheet (two neighbouring boxes share one dot grid)
  const sh = S.normalize({ type: 'field', angle: 90, stops: ['#2a0f2e', '#d2465a', '#fbe6c2'], field: { span: 'sheet' } });
  const a = S.overlaySVG(sh, '#2a0f2e', 'M0 0h50v50h-50z', { box: { x: 70, y: 30, w: 50, h: 50 }, ctx: { sheet: { x: 0, y: 0, w: 600, h: 400 } } });
  out.anchor = (a.match(/data-wash="([^"]*)"/) || [])[1];

  return out;`);
let failed = 0;
const check = (label, ok, detail) => { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
check('a wash separates into its stops, not its bands', R.inks.length === 3, R.inks.length + ' inks for ' + R.bands + ' bands: ' + R.inks.join(' '));
check('every plate is black ink on clear', R.impure === 0, R.impure + ' pixels off');
check('each plate covers its stop\'s share (8×8 blocks)', Number.isFinite(R.worst) && R.worst < 0.1, 'worst block off by ' + (100 * R.worst).toFixed(1) + '%, plate ' + R.kb + ' KB');
check('the plates add up to full ink — the shape\'s own fill is covered by the wash', Number.isFinite(R.sumWorst) && R.sumWorst < 0.1, 'worst block sum off by ' + (100 * R.sumWorst).toFixed(1) + '%');
check('across the sheet the screen is anchored on the sheet', R.anchor && / 70 30$/.test(R.anchor), R.anchor);
if (P.errors.length) { failed++; console.log('  FAIL page errors — ' + P.errors.join(' | ')); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
