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

// Cumulative offsets of a track list — shared by column and row resolution,
// and by main.js's own drag-to-resize (it needs the exact same boundary
// positions to place its handles, so this is exported rather than
// re-derived a second way that could drift from what actually renders).
export function offsets(sizes, gap) {
  const out = [0];
  for (let i = 0; i < sizes.length; i++) out.push(out[i] + sizes[i] + gap);
  return out;
}

/**
 * Resolves every cell's pixel rect from grid.tracks + cell spans, anchored
 * at the canvas's own inner rect (post-margin). Pure function of the
 * model — call it again any time canvas/grid/cells change, never cache
 * stale rects across a param change.
 *
 * `model.grid.padding` insets each cell's own rect inward on all four
 * sides — visual breathing room inside a cell, independent of Gap (which
 * changes the track sizes the solver/math actually resolves). Applied
 * here, after track resolution, so it never affects a generator's own
 * geometry — only how the already-resolved rect is drawn. Read off the
 * model (not a separate function argument) since it's a real persisted
 * render parameter, not ephemeral UI state — every renderer that needs it
 * reads the same single source of truth.
 */
/**
 * Closed-loop Catmull-Rom → cubic-Bezier SVG/Canvas path — turns a dense
 * point list (Linear/Diagonal/Masonry/Angular's own subdivided,
 * distortion-bent cell boundaries) into a genuinely smooth curve instead
 * of the straight-segment polyline `<polygon>`/`strokeRect` draw by
 * default. Real gap this fixes, reported live: opening an exported
 * Linear-Sine grid in a vector editor showed dozens of straight line
 * segments with visible anchor points at every subdivision sample —
 * technically a valid polygon approximation of a curve (the same
 * technique Radial's own arcPoints already uses, disclosed there), but
 * not what "a single line that becomes sinusoidal" means to a designer
 * who wants to select and further edit the curve. `cell.smooth` (set by
 * the generator only when it actually subdivided a curve — never for
 * Distortion:Off, which stays the exact straight-edge case, or for any
 * generator whose edges are genuinely meant to be sharp, like Hexagonal/
 * Diamond) is the flag every renderer below branches on.
 *
 * Standard uniform Catmull-Rom → Bezier control-point formula, looped
 * (point n wraps to point 0) since every cell here is a closed shape.
 * Rounds true corners slightly (Catmull-Rom has no concept of a hard
 * corner) — an accepted, minor trade-off for cells built specifically
 * to look organic/wavy in the first place; sharp-cornered generators
 * never set this flag; export uses this same string builder Loom itself
 * already assembles per point with `X,Y ` — no smoothing math duplicated
 * a second way for canvas.
 *
 * `keepCorners` (Linear's distorted cells pass it) clamps the spline's
 * tangents at any vertex whose two incident edges turn more than ~40°:
 * the wavy edge runs stay smooth curves, but the ~90° joins where a wave
 * meets the straight frame / a cap corner stay SHARP — no overshoot past
 * the canvas edge. It also makes a shared wavy run spline identically
 * from either of its two cells (Catmull-Rom is reversal-symmetric and the
 * clamped run endpoints match), so a shared division line strokes once
 * instead of as two nearly-coincident curves.
 */
export function catmullRomPathD(points, r2, keepCorners) {
  const n = points.length;
  const fmt = r2 || (v => v);
  if (n < 3) return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p[0])},${fmt(p[1])}`).join(' ') + ' Z';

  // A vertex is a corner when its two incident edges turn > ~40°
  // (normalised dot < cos40°). Only computed / applied when asked.
  let corner = null;
  if (keepCorners) {
    corner = new Array(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = points[(i - 1 + n) % n], b = points[i], c = points[(i + 1) % n];
      const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
      const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      corner[i] = l1 > 1e-9 && l2 > 1e-9 && (v1x * v2x + v1y * v2y) / (l1 * l2) < 0.766;
      any = any || corner[i];
    }
    if (!any) corner = null;   // nothing sharp — fall through to the plain loop
  }

  let d = `M ${fmt(points[0][0])},${fmt(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p1 = points[i], p2 = points[(i + 1) % n];
    // At a corner, reflect the neighbour to itself → the tangent lies
    // along the chord, so the curve enters/leaves that vertex straight.
    const p0 = corner && corner[i] ? p1 : points[(i - 1 + n) % n];
    const p3 = corner && corner[(i + 1) % n] ? p2 : points[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d + ' Z';
}

export function resolveCellRects(model, inner) {
  const { tracks, gap, padding } = model.grid;
  const pad = padding || 0;
  const colOff = offsets(tracks.cols, gap);
  const rowOff = offsets(tracks.rows, gap);
  return model.cells.map(c => {
    const x = inner.x + colOff[c.col] + pad;
    const y = inner.y + rowOff[c.row] + pad;
    const width = colOff[c.col + c.colSpan] - colOff[c.col] - gap - 2 * pad;
    const height = rowOff[c.row + c.rowSpan] - rowOff[c.row] - gap - 2 * pad;
    return { ...c, x, y, width: Math.max(0, width), height: Math.max(0, height) };
  });
}

