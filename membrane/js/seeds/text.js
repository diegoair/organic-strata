/* ─────────────────────────────────────────────────────────────
   Membrane — Text seed: REAL glyph outline points via opentype.js
   reading the same vendored Manrope file every Organica tool's own
   typography already commits to (Soul, Camo Turing, Living Path) —
   not p5's own text()/textToPoints(), which only wraps the SYSTEM font
   with no queryable outline geometry. font.getPaths(text,...) returns
   one Path PER GLYPH (not fused), so glyph boundaries are known
   directly — no heuristic needed to tell "AMO" apart into A/M/O.

   Within each glyph, `Z` (closepath) in the path's own commands marks
   real contour boundaries too (a letter's outer ring vs, for A/O, its
   inner hole) — flattening on M/Z instead of guessing from point
   spacing (the exploration's own distance-heuristic) makes every break
   exact, not inferred.
   ───────────────────────────────────────────────────────────── */
import { state, effectiveN } from '../state.js';
import { applySeedResult } from './common.js';
import { initShape } from './procedural.js';

let manropeFont = null;

export function loadMembraneFont(onDone) {
  opentype.load('/shared/vendor/manrope-variable.ttf', (err, font) => {
    if (!err) manropeFont = font;
    onDone && onDone(err);
  });
}
export function isFontReady() { return !!manropeFont; }

function cubicAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}
function quadAt(p0, p1, p2, t) {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

// Flattens one opentype.Path's own commands into contours (an array of
// point arrays — more than one per glyph for a letter with a hole).
// Curves are sampled at a fixed step count — Manrope at this fontSize
// doesn't need adaptive subdivision, and a fixed count keeps every
// contour's own point density predictable.
function flattenPathToContours(path, samples = 8) {
  const contours = [];
  let current = null, cx = 0, cy = 0;
  path.commands.forEach(cmd => {
    if (cmd.type === 'M') {
      current = [{ x: cmd.x, y: cmd.y }];
      contours.push(current);
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === 'L') {
      current.push({ x: cmd.x, y: cmd.y });
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === 'C') {
      for (let t = 1; t <= samples; t++) {
        const tt = t / samples;
        current.push({ x: cubicAt(cx, cmd.x1, cmd.x2, cmd.x, tt), y: cubicAt(cy, cmd.y1, cmd.y2, cmd.y, tt) });
      }
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === 'Q') {
      for (let t = 1; t <= samples; t++) {
        const tt = t / samples;
        current.push({ x: quadAt(cx, cmd.x1, cmd.x, tt), y: quadAt(cy, cmd.y1, cmd.y, tt) });
      }
      cx = cmd.x; cy = cmd.y;
    }
    // 'Z' needs no point of its own — the contour closes back to its own first point implicitly, same as curveVertex's own closed-loop convention.
  });
  return contours;
}

// Returns { raw: [[x,y],...] centred at (0,0), breaks: Set } — raw is
// EVERY contour of EVERY glyph concatenated, in reading order, rotated
// to start at the first glyph's own lowest point (its "bottom vertex" —
// e.g. where A's two legs meet the baseline). `breaks` marks every index
// where a NEW contour begins, including index 0 — kept even though nothing
// in the STATIC curve renderer ever queries index 0 (its own run-splitting
// loop starts at i=1), because Follow path's MOVEMENT wraps from the
// last waypoint back to the first when it loops, and pathBreaks.has(0)
// is what tells it not to draw a phantom connector there. (A real gap in
// the exploration this migrates from: its own Loom-borders code called
// `breaks.delete(0)`, so a looping Follow path there silently drew one
// extra connecting segment from the last cell's last vertex back to the
// first cell's first vertex — caught while porting, fixed here by simply
// never deleting it.)
export function glyphOutline(text, fontSize = 220) {
  if (!manropeFont || !text) return null;
  const paths = manropeFont.getPaths(text, 0, 0, fontSize);
  if (!paths.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const glyphContours = paths.map(gp => {
    const bb = gp.getBoundingBox();
    minX = Math.min(minX, bb.x1); minY = Math.min(minY, bb.y1);
    maxX = Math.max(maxX, bb.x2); maxY = Math.max(maxY, bb.y2);
    return flattenPathToContours(gp);
  });
  if (!isFinite(minX)) return null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  const raw = [];
  const breaks = new Set();
  glyphContours.forEach(contours => {
    contours.forEach(contour => {
      breaks.add(raw.length);
      contour.forEach(pt => raw.push([pt.x - cx, pt.y - cy]));
    });
  });
  breaks.delete(raw.length);   // guard: never a break exactly at the (nonexistent) end

  // Rotate so traversal starts at glyph 0's own lowest point — searched
  // only within glyph 0's own point range, not the whole word, so a
  // later letter with an equally-low point (M's legs, say) can't steal it.
  let glyph0Len = 0;
  glyphContours[0].forEach(c => glyph0Len += c.length);
  let startIdx = 0, maxY2 = -Infinity;
  for (let i = 0; i < glyph0Len && i < raw.length; i++) {
    if (raw[i][1] > maxY2) { maxY2 = raw[i][1]; startIdx = i; }
  }

  let outRaw = raw, outBreaks = breaks;
  if (startIdx > 0) {
    outRaw = raw.slice(startIdx).concat(raw.slice(0, startIdx));
    outBreaks = new Set();
    breaks.forEach(b => outBreaks.add((b - startIdx + raw.length) % raw.length));
  }
  outBreaks.add(0);   // always — see this function's own header comment

  return { raw: outRaw, breaks: outBreaks, iw: maxX - minX, ih: maxY - minY };
}

function subsampleOutline(raw, breaksIn, n) {
  const pts = [], breaksOut = new Set();
  const rawN = raw.length;
  for (let i = 0; i < n; i++) {
    const srcIdx = Math.floor((i / n) * rawN);
    pts.push(raw[srcIdx]);
    // Carries a break forward if ANY raw break falls in the range this
    // output index consumed since the previous one — otherwise a break
    // could fall between two sampled indices and vanish at low n.
    const prevSrcIdx = i === 0 ? 0 : Math.floor(((i - 1) / n) * rawN);
    for (let s = prevSrcIdx; s <= srcIdx; s++) if (breaksIn.has(s)) { breaksOut.add(i); break; }
  }
  breaksOut.add(0);
  return { pts, breaks: breaksOut };
}

const TEXT_PATH_DENSITY = 300;   // waypoints "Follow path" gets, independent of the breathing shape's own (usually much smaller) Resolution

export function seedFromText() {
  const word = state.seedText || 'AMO';
  const g = glyphOutline(word);
  if (!g) return;

  const shapeSample = subsampleOutline(g.raw, g.breaks, effectiveN());
  applySeedResult({ pts: shapeSample.pts, iw: g.iw, ih: g.ih, refX: 0, refY: 0 });
  state.shapeBreaks = shapeSample.breaks;

  if (state.pathSource === 'text') {
    const denseN = Math.min(TEXT_PATH_DENSITY, g.raw.length);
    const pathSample = subsampleOutline(g.raw, g.breaks, denseN);
    state.textPathPoints = pathSample.pts.map(p => [state.W / 2 + p[0] * state.imgFit.scale, state.H / 2 + p[1] * state.imgFit.scale]);
    state.pathBreaks = pathSample.breaks;
    if (state.writeBrush) initShape(state.textPathPoints[0][0], state.textPathPoints[0][1], state.brushSize);
  }
}
