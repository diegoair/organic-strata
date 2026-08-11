/* ─────────────────────────────────────────────────────────────
   Universal JSON Model — the single source of truth (brief's own words).
   Every renderer (CSS Grid, SVG, Figma, future raster) reads this SAME
   object and nothing else — no renderer is allowed to carry state the
   model doesn't have, or two renderers can silently disagree (the exact
   bug class Organica's WYSIWYG discipline exists to prevent elsewhere:
   Komorebi/Halide/Warping all serve preview + every export off one
   render function for the same reason).

   Shape:
   {
     version, generatedAt,
     canvas: { width, height, unit, orientation, margin, safeArea, bleed },
     grid:   { type, solver, params, gap, tracks: { cols:[...], rows:[...] } },
     cells:  [ { id, col, row, colSpan, rowSpan } ]
   }

   Deliberately NOT storing per-cell pixel x/y/width/height here — those
   are always derivable from tracks + spans (resolveCellRects below), and
   a derivable value stored alongside its source is exactly how the
   "which one is the truth" bug happens. CSS Grid rendering wants
   tracks+spans natively (grid-template-columns / grid-column); SVG,
   raster and Figma want flat pixel rects — both read the same tracks,
   neither can drift from the other.
   ───────────────────────────────────────────────────────────── */

export const MODEL_VERSION = '1.0';

export function buildModel({ canvas, grid, cells }) {
  return {
    version: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    canvas,
    grid,
    cells,
  };
}

// Cumulative offsets of a track list — shared by column and row resolution.
function offsets(sizes, gap) {
  const out = [0];
  for (let i = 0; i < sizes.length; i++) out.push(out[i] + sizes[i] + gap);
  return out;
}

/**
 * Resolves every cell's pixel rect from grid.tracks + cell spans, anchored
 * at the canvas's own inner rect (post-margin). Pure function of the
 * model — call it again any time canvas/grid/cells change, never cache
 * stale rects across a param change.
 */
export function resolveCellRects(model, inner) {
  const { tracks, gap } = model.grid;
  const colOff = offsets(tracks.cols, gap);
  const rowOff = offsets(tracks.rows, gap);
  return model.cells.map(c => {
    const x = inner.x + colOff[c.col];
    const y = inner.y + rowOff[c.row];
    const width = colOff[c.col + c.colSpan] - colOff[c.col] - gap;
    const height = rowOff[c.row + c.rowSpan] - rowOff[c.row] - gap;
    return { ...c, x, y, width, height };
  });
}

/**
 * De-duplicated edge list from a set of cell rects — one segment per
 * unique boundary, not one stroked rect per cell. Two adjacent cells
 * (at Gap 0, or any two spans that happen to touch) share an edge at
 * IDENTICAL coordinates; stroking each cell's own rect draws that shared
 * edge twice, and two coincident anti-aliased 1px strokes visibly compound
 * into a bolder/darker line than a genuine single border — this is what
 * "two lines look like one, but bolder" actually was, not a positioning
 * bug (rects already landed pixel-exact, verified: adjacent cells'
 * touching edges measured a 0.0000076px gap, i.e. exact). Coordinates are
 * rounded before keying so floating-point noise from the Kiwi/parametric
 * solvers can't produce two "different" keys for what is geometrically
 * the same edge.
 */
export function collectEdges(rects) {
  const seen = new Set();
  const edges = [];
  function r2(n) { return Math.round(n * 100) / 100; }
  function add(x1, y1, x2, y2) {
    let a = [r2(x1), r2(y1)], b = [r2(x2), r2(y2)];
    if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) { const t = a; a = b; b = t; }
    const key = a[0] + ',' + a[1] + '|' + b[0] + ',' + b[1];
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
  }
  rects.forEach(r => {
    add(r.x, r.y, r.x + r.width, r.y);                        // top
    add(r.x, r.y + r.height, r.x + r.width, r.y + r.height);   // bottom
    add(r.x, r.y, r.x, r.y + r.height);                        // left
    add(r.x + r.width, r.y, r.x + r.width, r.y + r.height);    // right
  });
  return edges;
}
