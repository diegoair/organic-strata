#!/usr/bin/env node
// FVS Element — Segment's bar is the line's own stroke (Diego, Oct 29, 2026: "fai un debug su segment, soprattutto con wave e
// altre trasformazioni"). Where the line turns tighter than half the bar (a high Wave, many cycles, a thick bar, a Repeat
// that squashes it) a plain offset folded back and left teeth; now each folding line is the union of its runs and a disc
// at every fold. Ground truth: the same centre line drawn by the browser as a stroke of the bar's width (round joins) —
// the bar, rasterised, must cover the same pixels. Plus: a line that never folds is drawn as before (byte-identical), and
// the heaviest case stays fast. 01-geometry.js segmentBar.
// Usage: scripts/test-fvs-segment.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, S = Organica.shapes;
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const W = 400;
  const mask = draw => { const c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'); x.setTransform(W / 100, 0, 0, W / 100, 0, 0); draw(x); return x.getImageData(0, 0, W, W).data; };
  // bar vs stroke: the share of pixels on which they disagree (alpha over half), and how many lie outside a 1.5 px band of the stroke's edge
  const compare = (p, weight, round) => {
    const opts = { angle: p.angle, bend: p.bend, wave: p.wave, cycles: p.cycles, dashes: p.dashes, lines: p.lines, spacing: p.spacing, repeatX: p.repeatX, repeatY: p.repeatY, rays: p.rays, tile: true };
    const g = S.segmentGeometry(p.len || 70, opts), bar = F.segmentBar(g, weight, round);
    const A = mask(x => { x.transform(bar.normScale, 0, 0, bar.normScale, bar.normScale * bar.normTx, bar.normScale * bar.normTy); x.fill(new Path2D(bar.d)); });
    const B = mask(x => { x.transform(bar.normScale, 0, 0, bar.normScale, bar.normScale * bar.normTx, bar.normScale * bar.normTy); x.lineWidth = weight; x.lineJoin = 'round'; x.lineCap = round ? 'round' : 'butt';
      const pth = new Path2D(); g.d.split(/(?=M)/).forEach(sub => { const n = (sub.match(/-?\\d*\\.?\\d+(?:e-?\\d+)?/g) || []).map(Number); for (let i = 0; i + 1 < n.length; i += 2) { const X = (n[i] + g.normTx) * g.normScale, Y = (n[i + 1] + g.normTy) * g.normScale; i ? pth.lineTo(X, Y) : pth.moveTo(X, Y); } }); x.stroke(pth); });
    // a butt end: the browser's stroke leaves a notch behind it where the line starts steep; the bar's discs at the
    // points next to the end fill it (by choice — a notch reads as a bite) — so the pixels near a butt end are not compared
    const ends = []; if (!round) g.d.split(/(?=M)/).forEach(sub => { const n = (sub.match(/-?\\d*\\.?\\d+(?:e-?\\d+)?/g) || []).map(Number); if (n.length < 4) return;
      const at = (X, Y) => [((X + g.normTx) * g.normScale * bar.normScale + bar.normScale * bar.normTx) * W / 100, ((Y + g.normTy) * g.normScale * bar.normScale + bar.normScale * bar.normTy) * W / 100];
      ends.push(at(n[0], n[1]), at(n[n.length - 2], n[n.length - 1])); });
    const nearEnd = new Uint8Array(W * W), rr = weight * 0.75 * bar.normScale * W / 100;
    ends.forEach(([ex, ey]) => { for (let y = Math.max(0, Math.floor(ey - rr)); y <= Math.min(W - 1, Math.ceil(ey + rr)); y++) for (let x = Math.max(0, Math.floor(ex - rr)); x <= Math.min(W - 1, Math.ceil(ex + rr)); x++) if (Math.hypot(x - ex, y - ey) <= rr) nearEnd[y * W + x] = 1; });
    const on = (D, i) => D[i * 4 + 3] > 127; let diff = 0, far = 0, ink = 0;
    for (let i = 0; i < W * W; i++) { if (nearEnd[i]) continue; const a = on(A, i), b = on(B, i); if (b) ink++; if (a !== b) { diff++; const px = i % W, py = (i / W) | 0; let edge = false; for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) { const j = (py + dy) * W + px + dx; if (j >= 0 && j < W * W && on(B, j) !== b) { edge = true; break; } } if (!edge) far++; } }
    return { diff: diff / ink, far };
  };
  const cases = [
    ['Wave 100, 8 cycles', { wave: 100, cycles: 8 }, 8, false],
    ['Wave 100, Weight 20', { wave: 100 }, 20, false],
    ['Wave 60, 8 cycles, Weight 16, Rounded caps', { wave: 60, cycles: 8 }, 16, true],
    ['Wave 100, 4 cycles, Weight 30', { wave: 100, cycles: 4 }, 30, false],
    ['Wave 50, Repeat X 3 (squashed)', { wave: 50, repeatX: 3 }, 8, false],
    ['Wave 80, Repeat X 9 × Y 9', { wave: 80, repeatX: 9, repeatY: 9 }, 8, false],
    ['Bend 100, Weight 30, Rounded caps', { bend: 100 }, 30, true],
    ['Wave 50, Angle 45', { wave: 50, angle: 45 }, 8, false],
  ];
  for (const [n, p, w, r] of cases) { const c = compare(p, w, r); check(n + ': the bar covers what the line’s stroke covers (' + (c.diff * 100).toFixed(2) + ' % edge pixels, ' + c.far + ' inside)', c.diff < 0.03 && c.far === 0, (c.diff * 100).toFixed(2) + ' % · ' + c.far + ' pixels away from the edge'); }
  // a line that never folds: the ribbon as before (one ring per line, straight ends, M … L … Z)
  const plain = F.segmentBar(S.segmentGeometry(70, { wave: 30, tile: true }), 8, false);
  check('a line that never folds keeps its one ribbon (Wave 30)', (plain.d.match(/M/g) || []).length === 1 && !/A /.test(plain.d), plain.d.slice(0, 60));
  const straight = F.segmentBar(S.segmentGeometry(70, { tile: true }), 8, false);
  check('a straight bar is the plain rectangle', straight.d === 'M 15,46 L 85,46 L 85,54 L 15,54 Z', straight.d);
  F._segBarCache.clear(); F._segFoldCache.clear();
  const t = performance.now(); F.segmentBar(S.segmentGeometry(70, { wave: 100, cycles: 8, repeatX: 9, repeatY: 9, rays: 12, tile: true }), 8, false); const ms = performance.now() - t;
  check('the heaviest case (Wave 100 × 8 cycles, Repeat 9 × 9, Rays 12) builds in under 2 s (' + Math.round(ms) + ' ms)', ms < 2000, Math.round(ms) + ' ms');
  return rows;`);
rows.forEach(r => console.log('  ' + r));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const fail = rows.filter(r => r.startsWith('✗')).length + (errs.length ? 1 : 0);
console.log(`\nFVS segment: ${fail ? 'FAIL' : 'PASS'} — ${rows.length} checks`);
await P.close(fail ? 1 : 0);
