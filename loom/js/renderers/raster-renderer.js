/* ─────────────────────────────────────────────────────────────
   Raster (PNG) renderer — draws the DE-DUPLICATED edge set (json-model.js's
   collectEdges) the SVG renderer also uses, as ONE stroked path, onto a
   plain <canvas>. Not one strokeRect() per cell — that draws every shared
   boundary between adjacent cells twice, and two coincident anti-aliased
   1px strokes compound into a visibly bolder line than a genuine single
   border (collectEdges's own header has the full story). Kept a thin,
   separate function rather than rasterising the SVG string (Image +
   drawImage), so PNG export has no dependency on SVG parsing succeeding
   first.
   ───────────────────────────────────────────────────────────── */

import { collectEdges } from '../json-model.js';

export function renderRaster(model, rects, inner, scale = 2, lineColor) {
  const { canvas } = model;
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#c8c0b0';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 0.75;
  ctx.strokeRect(inner.x, inner.y, inner.width, inner.height);
  ctx.setLineDash([]);
  ctx.strokeStyle = lineColor || '#3399ff';
  ctx.lineWidth = 1;
  const edges = collectEdges(rects);
  ctx.beginPath();
  edges.forEach(e => { ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); });
  ctx.stroke();
  return c;
}
