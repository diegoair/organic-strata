/* ─────────────────────────────────────────────────────────────
   Membrane — Loom grid path: walks a /loom/ JSON export as a sequence of
   waypoints, in the cells' own Number order (Sequential/Shuffle both
   already give every cell a real, meaningful order). Two styles:
   Cell centroids (one waypoint per cell — a route THROUGH the grid) or
   Polygon borders (every one of each cell's own boundary VERTICES, so
   the path walks the grid's real line-work instead of just visiting
   cell centres).

   Reuses Organica.loadLoomGrid verbatim (organica-core.js) for parsing
   AND geometry resolution — the exploration this migrates from had its
   own private reimplementation of the margin/track-offset maths (written
   before this module existed as a production tool worth linking
   organica-core.js from), which is exactly the kind of drift the shared
   core exists to prevent. Only centroids/corners are derived here; point-
   in-polygon resolution (which loadLoomGrid also does, for Flow Field's
   own field-lookup use) isn't needed for a plain waypoint sequence.
   ───────────────────────────────────────────────────────────── */
import { state } from '../state.js';
import { initShape } from './procedural.js';

export function buildLoomPath(model, style) {
  const resolved = Organica.loadLoomGrid(model);   // throws a plain, user-safe Error on invalid input
  const cells = resolved.cells.map(c => {
    if (resolved.cellShape === 'polygon') {
      return { cx: c.centroid[0], cy: c.centroid[1], points: c.points, number: c.number };
    }
    return {
      cx: c.x + c.width / 2, cy: c.y + c.height / 2,
      points: [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]],
      number: c.number,
    };
  });
  if (cells.every(c => c.number != null)) cells.sort((a, b) => a.number - b.number);

  // Deterministic breaks — the exact cell boundary is already known while
  // concatenating, no distance-heuristic needed (unlike Text). Centroids
  // style deliberately gets NO breaks: every centroid-to-centroid segment
  // there IS the intended "a route through the grid", not an artifact —
  // there's no narrower "real" geometry inside it to preserve the way
  // Borders' own within-cell vertices are real and between-cell jumps
  // aren't.
  const raw = [];
  const breaks = new Set();
  if (style === 'borders') {
    cells.forEach(c => {
      breaks.add(raw.length);
      c.points.forEach(p => raw.push(p));
    });
    // Kept at index 0 (unlike the exploration's own `breaks.delete(0)`,
    // a real bug caught while porting — see seeds/text.js's own header
    // comment for the identical fix) — the static renderer never queries
    // index 0, but Follow path's movement wraps from the last waypoint
    // back to the first when it loops, and needs this to not draw a
    // phantom connector there.
  } else {
    cells.forEach(c => raw.push([c.cx, c.cy]));
  }

  const scale = Math.min(state.W / model.canvas.width, state.H / model.canvas.height) * 0.85;
  const offX = (state.W - model.canvas.width * scale) / 2, offY = (state.H - model.canvas.height * scale) / 2;
  state.textPathPoints = raw.map(p => [p[0] * scale + offX, p[1] * scale + offY]);
  state.pathBreaks = style === 'borders' ? breaks : new Set();

  if (state.writeBrush && state.textPathPoints.length) {
    initShape(state.textPathPoints[0][0], state.textPathPoints[0][1], state.brushSize);
  }

  return {
    cellCount: cells.length,
    vertexCount: raw.length,
    gridType: model.grid.type || 'unknown type',
  };
}

// onDone(info, errorMessage) — errorMessage is null on success, a plain
// user-safe string on failure (never a raw exception/stack).
export function loadLoomPathJSON(jsonText, onDone) {
  let model;
  try {
    model = JSON.parse(jsonText);
  } catch (e) {
    onDone(null, 'Could not parse file — not valid JSON.');
    return;
  }
  state.lastLoomModel = model;
  try {
    const info = buildLoomPath(model, state.loompathStyle);
    onDone(info, null);
  } catch (e) {
    onDone(null, e.message || 'Could not read this grid.');
  }
}
