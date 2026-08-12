/* ─────────────────────────────────────────────────────────────
   SVG renderer — resolves cell geometry itself (rect grids via
   json-model.js's resolveCellRects, polygon grids read model.cells'
   own absolute points directly — see voronoi.js's own header for why
   there's no shared "rect" representation between the two), then draws
   the DE-DUPLICATED edge set (collectEdges / collectPolygonEdges) as
   <line> segments rather than one stroked shape per cell. A grid
   DEFINITION export — guides for a designer to build on in Figma/Affinity,
   not filled shapes claiming to be a finished layout. Per-cell shapes
   would stroke every shared boundary between adjacent cells twice —
   geometrically coincident, but two overlapping anti-aliased strokes
   compound into a visibly bolder line than the single strokes elsewhere
   (json-model.js's own collectEdges header has the full story).
   ───────────────────────────────────────────────────────────── */

import { resolveCellRects, collectEdges, collectPolygonEdges } from '../json-model.js';

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
  const edges = grid.cellShape === 'polygon'
    ? collectPolygonEdges(model.cells)
    : collectEdges(resolveCellRects(model, inner));
  s += `<g stroke="${stroke}" stroke-width="1">`;
  edges.forEach(e => {
    s += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}"/>`;
  });
  s += '</g>';
  s += '</svg>';
  return s;
}
