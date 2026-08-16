/* ─────────────────────────────────────────────────────────────
   Membrane — Image seed: Contour (silhouette) and Luminance scatter.

   Contour ray-casts `n` evenly-spaced angles out from the image's own
   weighted centroid (of foreground pixels), stopping each ray at the
   last foreground pixel it passed through — a star-convex approximation
   of the subject's silhouette. Works well for a roughly centred subject
   on a contrasting background; a deeply concave or multi-blob silhouette
   reads as its own convex-ish envelope, not every inlet — an accepted
   simplification for a 15-60 point ring, not a full contour tracer like
   Halide's/Strata's own pixel-boundary walk.

   Luminance scatter rejection-samples `n` points weighted toward dark
   (or, inverted, light) areas — same idea as Pollen/Spore's own
   stippling — then sorts them by angle around their own centroid so the
   connected curve reads as one coherent (if wobbly) loop instead of a
   scribble, since a random scatter has no inherent order and curveVertex
   draws points in array order.

   Both were tried FIRST for Text too (before seeds/text.js's real glyph
   outlines) and genuinely failed there: Contour collapses on a short
   wide word (most vertical rays never hit any letter), Scatter's
   angle-sort scrambles a left-to-right word into a chaotic star. Neither
   assumption (star-convex / roughly-one-centroid) holds for text, which
   is why Text gets its own, different sampling method.
   ───────────────────────────────────────────────────────────── */
import { state } from '../state.js';
import { applySeedResult, effectiveN } from './common.js';

function luminanceAt(pixels, w, h, x, y) {
  x = Math.max(0, Math.min(w - 1, Math.floor(x)));
  y = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const idx = 4 * (y * w + x);
  return (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
}
function isForeground(lum) { return state.invertMask ? lum > state.threshold : lum < state.threshold; }

export function sampleContour(img, n) {
  img.loadPixels();
  const iw = img.width, ih = img.height, px = img.pixels;
  let sumX = 0, sumY = 0, count = 0;
  const step = Math.max(1, Math.floor(Math.min(iw, ih) / 150));
  for (let y = 0; y < ih; y += step) {
    for (let x = 0; x < iw; x += step) {
      if (isForeground(luminanceAt(px, iw, ih, x, y))) { sumX += x; sumY += y; count++; }
    }
  }
  const cx = count > 0 ? sumX / count : iw / 2, cy = count > 0 ? sumY / count : ih / 2;
  const maxR = Math.hypot(Math.max(cx, iw - cx), Math.max(cy, ih - cy));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let lastR = 0;
    for (let r = 0; r < maxR; r += 2) {
      const x = cx + dx * r, y = cy + dy * r;
      if (x < 0 || x >= iw || y < 0 || y >= ih) break;
      if (isForeground(luminanceAt(px, iw, ih, x, y))) lastR = r;
    }
    pts.push([dx * lastR, dy * lastR]);
  }
  return { pts, iw, ih, refX: 0, refY: 0 };
}

export function sampleScatter(img, n) {
  const p = state.p;
  img.loadPixels();
  const iw = img.width, ih = img.height, px = img.pixels;
  const weightAt = (x, y) => {
    const lum = luminanceAt(px, iw, ih, x, y);
    return state.invertMask ? lum / 255 : 1 - lum / 255;
  };
  const pts = [];
  let guard = 0;
  while (pts.length < n && guard < n * 400) {
    guard++;
    const x = p.random(iw), y = p.random(ih);
    if (p.random(1) < weightAt(x, y)) pts.push([x, y]);
  }
  while (pts.length < n) pts.push([p.random(iw), p.random(ih)]);   // sparse image fallback — never leaves a point unseeded
  let sumX = 0, sumY = 0;
  pts.forEach(pt => { sumX += pt[0]; sumY += pt[1]; });
  const cx = sumX / pts.length, cy = sumY / pts.length;
  pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  return { pts: pts.map(pt => [pt[0] - cx, pt[1] - cy]), iw, ih, refX: 0, refY: 0 };
}

export function seedFromImage() {
  if (!state.loadedImg) return;
  state.shapeBreaks = new Set();   // Contour's ray-cast and Scatter's angle-sort both already resolve to one coherent loop
  const result = state.seedStyle === 'contour'
    ? sampleContour(state.loadedImg, effectiveN())
    : sampleScatter(state.loadedImg, effectiveN());
  applySeedResult(result);
}
