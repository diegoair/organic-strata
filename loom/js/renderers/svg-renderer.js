/* ─────────────────────────────────────────────────────────────
   SVG renderer — resolves cell geometry itself (rect grids via
   json-model.js's resolveCellRects, polygon grids read model.cells'
   own absolute points directly — see voronoi.js's own header for why
   there's no shared "rect" representation between the two), then draws
   ONE CLOSED SHAPE PER CELL (`<rect>` or `<polygon>`) — every cell a
   real closed, fillable path, not a network of disconnected `<line>`
   segments that only look closed on screen.

   This replaced an earlier de-duplicated-edge-list version (one `<line>`
   per unique boundary, never a closed per-cell shape) that Diego caught
   in real use: opening the exported file, nothing was actually a closed
   shape — no path a design tool could select and fill with a colour, just
   independent line segments that happened to line up. That's a real
   defect for a grid export whose whole job is to hand off usable
   geometry, not a stylistic choice to preserve. The de-dup approach's own
   original motivation — avoiding a doubled-stroke look where two
   adjacent cells each draw their own copy of a shared edge — is a real,
   secondary cosmetic effect, but it's strictly less important than the
   shapes being closed and fillable at all, so it's an accepted trade-off
   now rather than the deciding constraint.
   ───────────────────────────────────────────────────────────── */

import { resolveCellRects, catmullRomPathD } from '../json-model.js';

function r2(n) { return Math.round(n * 100) / 100; }

export function renderSVG(model, inner, lineColor) {
  const { canvas, grid } = model;
  const stroke = lineColor || '#3399ff';
  // width/height need a real unit suffix for a physical canvas, or SVG
  // treats the bare number as px — this was a genuine bug (an A4 export
  // said width="210", which is 210px, not 210mm). SVG has no native "m"
  // unit, and canvas.width is already the canonical mm-equivalent number
  // (canvas-manager.js's own header) for any non-px unit, so every
  // physical unit — mm, cm, m alike — exports as literal "mm", which is
  // always valid and unambiguous. viewBox stays bare numbers regardless,
  // per the SVG spec — only width/height carry a unit.
  const suffix = canvas.unit === 'px' ? '' : 'mm';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(canvas.width)}${suffix}" height="${r2(canvas.height)}${suffix}" viewBox="0 0 ${r2(canvas.width)} ${r2(canvas.height)}">`;
  s += `<rect width="100%" height="100%" fill="#ffffff"/>`;
  s += `<rect x="${r2(inner.x)}" y="${r2(inner.y)}" width="${r2(inner.width)}" height="${r2(inner.height)}" fill="none" stroke="#c8c0b0" stroke-width="0.75" stroke-dasharray="3 3"/>`;
  s += `<g fill="none" stroke="${stroke}" stroke-width="1">`;
  if (grid.cellShape === 'polygon') {
    model.cells.forEach(cell => {
      // Distortion-bent cells (Linear/Diagonal/Masonry/Angular, only when
      // actually subdivided) get a real smooth curve instead of a dense
      // straight-segment polygon — see catmullRomPathD's own header for
      // why this exists and why sharp-cornered generators never set it.
      if (cell.smooth) {
        s += `<path d="${catmullRomPathD(cell.points, r2)}"/>`;
      } else {
        const pts = cell.points.map(p => `${r2(p[0])},${r2(p[1])}`).join(' ');
        s += `<polygon points="${pts}"/>`;
      }
    });
  } else {
    resolveCellRects(model, inner).forEach(r => {
      s += `<rect x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.width)}" height="${r2(r.height)}"/>`;
    });
  }
  s += '</g>';
  s += '</svg>';
  return s;
}
