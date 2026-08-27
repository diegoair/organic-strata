/* ─────────────────────────────────────────────────────────────
   Rhizome — port type registry (Piano approvato, Parte 3.2).

   A node declares its input/output ports as one of these types. The
   execution engine and the canvas layer (ports.js) both read this same
   enum to decide whether a proposed connection is legal.
   ───────────────────────────────────────────────────────────── */

export const PortType = {
  SVG: 'svg',       // string — an SVG document (any tool's export shape)
  IMAGE: 'image',   // {mask:Uint8Array, width, height} — a binary raster
                     //   mask, OR {dataURL} for a genuine photo/raster —
                     //   both share this port type since they're both
                     //   "pixels", but a node declares which shape it
                     //   actually expects in its own params/docs.
  GRID: 'grid',      // Organica.loadLoomGrid()'s return shape verbatim:
                     //   {canvas, grid, inner, cellShape, cells}
  COLOR: 'color',    // '#rrggbb'
  NUMBER: 'number',
  POINTS: 'points',  // [{x,y}, ...]
};

// Display metadata — one place, so the canvas layer (port dot colour) and
// any future inspector legend can't drift apart from each other.
export const PORT_META = {
  [PortType.SVG]:    { label: 'SVG',    color: '#3fa876' },
  [PortType.IMAGE]:  { label: 'Image',  color: '#a9683e' },
  [PortType.GRID]:   { label: 'Grid',   color: '#4a7fc9' },
  [PortType.COLOR]:  { label: 'Color',  color: '#c93ed6' },
  [PortType.NUMBER]: { label: 'Number', color: '#8a7355' },
  [PortType.POINTS]: { label: 'Points', color: '#c85a8c' },
};
