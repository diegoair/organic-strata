/* ─────────────────────────────────────────────────────────────
   Raster (PNG) renderer — resolves cell geometry itself (rect grids or
   polygon grids, same split as svg-renderer.js), draws ONE CLOSED SHAPE
   PER CELL onto a plain <canvas> — same fix as svg-renderer.js's own
   header explains (a closed, fillable shape per cell, not a network of
   disconnected line segments that only look closed). Kept a thin,
   separate function rather than rasterising the SVG string (Image +
   drawImage), so PNG export has no dependency on SVG parsing succeeding
   first.
   ───────────────────────────────────────────────────────────── */

import { resolveCellRects, catmullRomPathD } from '../json-model.js';

export function renderRaster(model, inner, scale = 2, lineColor) {
  const { canvas, grid } = model;
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
  if (grid.cellShape === 'polygon') {
    model.cells.forEach(cell => {
      if (cell.smooth) {
        // Reuses the exact same path string svg-renderer.js builds (via
        // Path2D, a real browser primitive) rather than re-deriving the
        // Catmull-Rom curve math a second way for canvas — the two
        // exports can't drift from each other this way.
        ctx.stroke(new Path2D(catmullRomPathD(cell.points)));
        return;
      }
      const pts = cell.points;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.stroke();
    });
  } else {
    resolveCellRects(model, inner).forEach(r => {
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    });
  }
  return c;
}
