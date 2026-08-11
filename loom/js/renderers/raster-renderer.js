/* ─────────────────────────────────────────────────────────────
   Raster (PNG) renderer — draws the same resolved cell rects the SVG
   renderer uses onto a plain <canvas>. Kept a thin, separate function
   rather than rasterising the SVG string (Image + drawImage), so PNG
   export has no dependency on SVG parsing succeeding first.
   ───────────────────────────────────────────────────────────── */

export function renderRaster(model, rects, inner, scale = 2) {
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
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 1;
  rects.forEach(r => ctx.strokeRect(r.x, r.y, r.width, r.height));
  return c;
}
