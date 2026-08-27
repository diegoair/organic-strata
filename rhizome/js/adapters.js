/* ─────────────────────────────────────────────────────────────
   Rhizome — type adapters (Piano approvato, Parte 3.2).

   Mismatched port-type connections are disallowed by default. The three
   listed here are the only auto-adapters, and each one is a direct,
   disclosed port of something an existing tool already does by hand:

   - svg  -> points  : Organica.motion.parsePrimitives (shared/organica-motion.js)
   - grid -> points  : cell-centre scatter, what Mycel already does by
                        hand for its own point-source (mycel/index.html:363)
   - grid -> svg     : one rect/polygon per cell, what FVS/the Loom
                        prototypes already do by hand
   - grid -> image   : rasterize each cell into a binary ink mask, the
                        same technique the Rhizome MVP test prototype
                        (_test-mvp.html) already validated inline for
                        Contour Trace — promoted here so any grid source
                        can feed any mask consumer, not just this one pair

   No generic conversion matrix — everything else is a hard "no", with the
   UI (ports.js) surfacing which node would bridge the gap instead of
   silently coercing data.
   ───────────────────────────────────────────────────────────── */

import { PortType } from './port-types.js';

function gridToPoints(grid) {
  if (!grid || !Array.isArray(grid.cells)) return [];
  return grid.cells.map(c => {
    if (c.shape === 'polygon') {
      return c.centroid ? { x: c.centroid[0], y: c.centroid[1] } : { x: 0, y: 0 };
    }
    return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  });
}

function gridToSVG(grid) {
  if (!grid || !Array.isArray(grid.cells)) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const w = grid.canvas ? grid.canvas.width : 0;
  const h = grid.canvas ? grid.canvas.height : 0;
  const shapes = grid.cells.map(c => {
    if (c.shape === 'polygon' && Array.isArray(c.points)) {
      const pts = c.points.map(p => p.join(',')).join(' ');
      return `<polygon points="${pts}" fill="none" stroke="#0a0a0a"/>`;
    }
    return `<rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" fill="none" stroke="#0a0a0a"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${shapes}</svg>`;
}

function svgToPoints(svg) {
  const { primitives } = Organica.motion.parsePrimitives(svg);
  return primitives.map(p => ({ x: p.cx, y: p.cy }));
}

function gridToImage(grid) {
  const w = grid.canvas ? Math.round(grid.canvas.width) : 0;
  const h = grid.canvas ? Math.round(grid.canvas.height) : 0;
  const mask = new Uint8Array(w * h);
  for (const c of (grid.cells || [])) {
    if (c.shape === 'polygon' && Array.isArray(c.points)) {
      fillPolygon(mask, w, h, c.points);
    } else {
      const x0 = Math.max(0, Math.round(c.x)), y0 = Math.max(0, Math.round(c.y));
      const x1 = Math.min(w, Math.round(c.x + c.width)), y1 = Math.min(h, Math.round(c.y + c.height));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * w + x] = 1;
    }
  }
  return { mask, width: w, height: h };
}

// Scanline polygon fill — only needed for the grid->image adapter's
// polygon cellShape branch (hexagonal/etc. grids), so it's kept private
// here rather than promoted to organica-core.js until a second consumer
// needs it (same "extract at the second real consumer, not speculatively"
// rule this project applies to every other shared-code decision).
function fillPolygon(mask, w, h, points) {
  const ys = points.map(p => p[1]);
  const yMin = Math.max(0, Math.floor(Math.min(...ys)));
  const yMax = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  for (let y = yMin; y <= yMax; y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i += 2) {
      const x0 = Math.max(0, Math.round(xs[i])), x1 = Math.min(w, Math.round(xs[i + 1]));
      for (let x = x0; x < x1; x++) mask[y * w + x] = 1;
    }
  }
}

// Keyed `${fromType}->${toType}`, each fn: (value) => adaptedValue
export const ADAPTERS = {
  [`${PortType.SVG}->${PortType.POINTS}`]: svgToPoints,
  [`${PortType.GRID}->${PortType.POINTS}`]: gridToPoints,
  [`${PortType.GRID}->${PortType.SVG}`]: gridToSVG,
  [`${PortType.GRID}->${PortType.IMAGE}`]: gridToImage,
};

export function canAdapt(fromType, toType) {
  return fromType === toType || !!ADAPTERS[`${fromType}->${toType}`];
}

export function adapt(fromType, toType, value) {
  if (fromType === toType) return value;
  const fn = ADAPTERS[`${fromType}->${toType}`];
  if (!fn) throw new Error(`No adapter from "${fromType}" to "${toType}".`);
  return fn(value);
}
