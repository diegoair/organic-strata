/* ─────────────────────────────────────────────────────────────
   Membrane — all rendering. Four responsibilities:
     1. renderPoint()             — Point draw mode's single dot
     2. renderShapeSingleColor()  — Circle/Line, Single ink (broken-aware)
     3. renderShapeMultiColor()   — Circle/Line, Rainbow/Sample-from-image (broken-aware)
     4. renderFullPath()          — Follow path's own clean static trace (Line/Dots, + Glow)

   Every one of the first three ALSO records what it just drew into
   state.shapeHistory — the same "marks[]" list Spore/Pollen's own SVG
   export reads (see state.js's own header) — so svgexport.js can
   replay real vector geometry for what's actually accumulated on
   screen, not just the current frame. renderFullPath() does NOT record:
   its own line is identical every frame while Follow path is active
   (a fixed, non-accumulating trace), so svgexport.js rebuilds it fresh
   from state.textPathPoints at export time instead — recording an
   unchanging shape hundreds of times would just bloat the history for
   no benefit.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';
import { hsbToRgb, imgColorAt, rmxColorAt } from './color.js';

function shapeColorAt(i) {
  if (state.colorSrc === 'rainbow') return hsbToRgb((i / state.xs.length) * 360, 85, 100);
  if (state.colorSrc === 'rmx') return rmxColorAt(i / state.xs.length, state.rmxColors, state.rmxColorMap, i);
  if (state.colorSrc === 'image' && state.imgFit) {
    return imgColorAt(state.imgPixelsCache, state.inkRGB, state.imgFit.refX + state.xs[i] / state.imgFit.scale, state.imgFit.refY + state.ys[i] / state.imgFit.scale);
  }
  return state.inkRGB;
}
function pathColorAt(i) {
  const n = state.textPathPoints.length;
  if (state.colorSrc === 'rainbow') return hsbToRgb((i / n) * 360, 85, 100);
  if (state.colorSrc === 'rmx') return rmxColorAt(i / n, state.rmxColors, state.rmxColorMap, i);
  if (state.colorSrc === 'image' && state.imgFit) {
    const pt = state.textPathPoints[i];
    return imgColorAt(state.imgPixelsCache, state.inkRGB, state.imgFit.refX + (pt[0] - state.W / 2) / state.imgFit.scale, state.imgFit.refY + (pt[1] - state.H / 2) / state.imgFit.scale);
  }
  return state.inkRGB;
}

// ── History recording — throttled (real time, not frame count, so it
// behaves the same at any framerate) and capped (oldest dropped first,
// a ring buffer via shift() — the array never holds more than
// HISTORY_MAX entries, so neither memory nor the eventual SVG's own
// path count grows without bound the longer Membrane is left running).
const HISTORY_MAX = 220;
const HISTORY_INTERVAL_MS = 110;
let lastRecordTime = 0;
function pushHistory(entry) {
  const now = performance.now();
  if (now - lastRecordTime < HISTORY_INTERVAL_MS) return;
  lastRecordTime = now;
  state.shapeHistory.push(entry);
  if (state.shapeHistory.length > HISTORY_MAX) state.shapeHistory.shift();
}

export function renderPoint() {
  const p = state.p;
  const px = state.centerX + state.xs[0], py = state.centerY + state.ys[0];
  const col = shapeColorAt(0);
  p.noStroke();
  p.fill(col[0], col[1], col[2], state.strokeAlpha);
  p.circle(px, py, state.pointSize * 2);
  pushHistory({ kind: 'point', x: px, y: py, r: state.pointSize, rgb: col.slice(), alpha: state.strokeAlpha });
}

export function renderShape() {
  const p = state.p;
  p.strokeWeight(state.strokeW);

  if (state.colorSrc !== 'ink') {
    renderShapeMultiColor();
    return;
  }

  if (state.shapeBreaks.size === 0) {
    // One real contour (Procedural, Image) — the original single-shape
    // path, byte-for-byte.
    let fillEntry = null;
    if (state.fillEachFrame) {
      const t = p.random(1);
      const fr = p.lerp(state.accentRGB[0], state.inkRGB[0], t);
      const fg = p.lerp(state.accentRGB[1], state.inkRGB[1], t);
      const fb = p.lerp(state.accentRGB[2], state.inkRGB[2], t);
      p.fill(fr, fg, fb, 30);
      fillEntry = { rgb: [fr, fg, fb], alpha: 30 };
    } else {
      p.noFill();
    }
    p.stroke(state.inkRGB[0], state.inkRGB[1], state.inkRGB[2], state.strokeAlpha);
    const n = state.formResolution;
    p.beginShape();
    const pts = [];
    if (state.drawMode === 'circle') {
      p.curveVertex(state.xs[n - 1] + state.centerX, state.ys[n - 1] + state.centerY);
      for (let i = 0; i < n; i++) { const x = state.xs[i] + state.centerX, y = state.ys[i] + state.centerY; p.curveVertex(x, y); pts.push([x, y]); }
      p.curveVertex(state.xs[0] + state.centerX, state.ys[0] + state.centerY);
      p.curveVertex(state.xs[1] + state.centerX, state.ys[1] + state.centerY);
    } else {
      p.curveVertex(state.xs[0] + state.centerX, state.ys[0] + state.centerY);
      for (let i = 0; i < n; i++) { const x = state.xs[i] + state.centerX, y = state.ys[i] + state.centerY; p.curveVertex(x, y); pts.push([x, y]); }
      p.curveVertex(state.xs[n - 1] + state.centerX, state.ys[n - 1] + state.centerY);
    }
    p.endShape();
    pushHistory({
      kind: 'curve', strokeW: state.strokeW, fill: fillEntry,
      runs: [{ pts, colors: [state.inkRGB.slice()], closed: state.drawMode === 'circle' }],
    });
    return;
  }

  // A multi-contour Text shape — draws each contiguous RUN of points
  // between breaks as its own open sub-curve, so no stroke connects one
  // letter/hole to the next. Circle mode's closed-loop wraparound doesn't
  // apply once there's more than one real contour — each run stays open.
  p.noFill();
  p.stroke(state.inkRGB[0], state.inkRGB[1], state.inkRGB[2], state.strokeAlpha);
  const runs = [];
  let runStart = 0;
  for (let i = 1; i <= state.xs.length; i++) {
    if (i === state.xs.length || state.shapeBreaks.has(i)) {
      const i1 = i - 1;
      if (i1 > runStart) {
        p.beginShape();
        const pts = [];
        p.curveVertex(state.xs[runStart] + state.centerX, state.ys[runStart] + state.centerY);
        for (let j = runStart; j <= i1; j++) { const x = state.xs[j] + state.centerX, y = state.ys[j] + state.centerY; p.curveVertex(x, y); pts.push([x, y]); }
        p.curveVertex(state.xs[i1] + state.centerX, state.ys[i1] + state.centerY);
        p.endShape();
        runs.push({ pts, colors: [state.inkRGB.slice()], closed: false });
      }
      runStart = i;
    }
  }
  pushHistory({ kind: 'curve', strokeW: state.strokeW, fill: null, runs });
}

// Draws the SAME closed/open Catmull-Rom curve one SEGMENT at a time,
// each with its own stroke colour — neither p5 nor Canvas2D supports a
// per-vertex stroke colour within one continuous path. Each segment gets
// the same 4-point control window (prev, start, end, next) the single-
// shape path implicitly builds for every point along the way. Recorded
// as ONE history entry per FRAME (a run per drawn segment, not one
// pushHistory() call per segment) — same throttle, far fewer array
// operations than pushing per segment.
function renderShapeMultiColor() {
  const p = state.p;
  p.noFill();
  const n = state.xs.length;
  const segCount = state.drawMode === 'circle' ? n : n - 1;
  const runs = [];
  for (let k = 0; k < segCount; k++) {
    let i0, i1, i2, i3;
    if (state.drawMode === 'circle') {
      i0 = (k - 1 + n) % n; i1 = k % n; i2 = (k + 1) % n; i3 = (k + 2) % n;
    } else {
      i0 = Math.max(k - 1, 0); i1 = k; i2 = k + 1; i3 = Math.min(k + 2, n - 1);
    }
    if (state.shapeBreaks.has(i2)) continue;   // i1→i2 is the drawn portion — skip if i2 starts a new contour
    const col = shapeColorAt(i1);
    p.stroke(col[0], col[1], col[2], state.strokeAlpha);
    p.beginShape();
    p.curveVertex(state.xs[i0] + state.centerX, state.ys[i0] + state.centerY);
    p.curveVertex(state.xs[i1] + state.centerX, state.ys[i1] + state.centerY);
    p.curveVertex(state.xs[i2] + state.centerX, state.ys[i2] + state.centerY);
    p.curveVertex(state.xs[i3] + state.centerX, state.ys[i3] + state.centerY);
    p.endShape();
    runs.push({
      pts: [[state.xs[i0] + state.centerX, state.ys[i0] + state.centerY], [state.xs[i1] + state.centerX, state.ys[i1] + state.centerY],
      [state.xs[i2] + state.centerX, state.ys[i2] + state.centerY], [state.xs[i3] + state.centerX, state.ys[i3] + state.centerY]],
      colors: [col.slice()], closed: false, isSegment: true,
    });
  }
  pushHistory({ kind: 'curve', strokeW: state.strokeW, fill: null, runs });
}

// Dots (beaded) style — every waypoint its own filled circle, no
// connecting stroke at all. Breaks need no special handling here: with
// nothing connecting one point to the next in the first place, a jump
// between contours just reads as a slightly wider gap in the beads.
function renderPathDots() {
  const p = state.p;
  const n = state.textPathPoints.length;
  p.noStroke();
  if (state.glowEnabled) p.drawingContext.shadowBlur = 14;
  for (let i = 0; i < n; i++) {
    const col = pathColorAt(i);
    if (state.glowEnabled) p.drawingContext.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
    p.fill(col[0], col[1], col[2], state.strokeAlpha);
    p.circle(state.textPathPoints[i][0], state.textPathPoints[i][1], state.pathDotSize);
  }
  if (state.glowEnabled) p.drawingContext.shadowBlur = 0;
}

// Draws the WHOLE captured path (Text outline or Loom grid) as one clean
// static stroke, broken at pathBreaks — at a FIXED canvas position,
// completely independent of Step size/Move speed/Draw mode. Fixes a real
// gap those introduce: a small Point moving slowly builds a clean trail
// over many seconds, but Line/Circle at any real speed just stacks a
// fresh multi-point shape at a new position every frame (canvas never
// clears) — a blurry smear, not a traced line. Glow adds a neon halo
// (Canvas2D's own shadowBlur/shadowColor, reset to 0 after so nothing
// else this frame inherits it) plus small brighter "sparkle" dots. Not
// recorded into shapeHistory — see this file's own header.
export function renderFullPath() {
  const p = state.p;
  if (state.textPathPoints.length < 2) return;
  if (state.pathRenderStyle === 'dots') { renderPathDots(); return; }

  const n = state.textPathPoints.length;
  p.strokeWeight(state.strokeW);
  p.noFill();
  if (state.glowEnabled) p.drawingContext.shadowBlur = 14;

  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || state.pathBreaks.has(i)) {
      const runEnd = i - 1;
      if (runEnd > runStart) {
        if (state.colorSrc === 'ink') {
          if (state.glowEnabled) p.drawingContext.shadowColor = `rgba(${state.inkRGB[0]},${state.inkRGB[1]},${state.inkRGB[2]},0.9)`;
          p.stroke(state.inkRGB[0], state.inkRGB[1], state.inkRGB[2], state.strokeAlpha);
          p.beginShape();
          p.curveVertex(state.textPathPoints[runStart][0], state.textPathPoints[runStart][1]);
          for (let j = runStart; j <= runEnd; j++) p.curveVertex(state.textPathPoints[j][0], state.textPathPoints[j][1]);
          p.curveVertex(state.textPathPoints[runEnd][0], state.textPathPoints[runEnd][1]);
          p.endShape();
        } else {
          for (let k = runStart; k < runEnd; k++) {
            const i0 = Math.max(k - 1, runStart), i1 = k, i2 = k + 1, i3 = Math.min(k + 2, runEnd);
            const col = pathColorAt(i1);
            if (state.glowEnabled) p.drawingContext.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
            p.stroke(col[0], col[1], col[2], state.strokeAlpha);
            p.beginShape();
            p.curveVertex(state.textPathPoints[i0][0], state.textPathPoints[i0][1]);
            p.curveVertex(state.textPathPoints[i1][0], state.textPathPoints[i1][1]);
            p.curveVertex(state.textPathPoints[i2][0], state.textPathPoints[i2][1]);
            p.curveVertex(state.textPathPoints[i3][0], state.textPathPoints[i3][1]);
            p.endShape();
          }
        }
      }
      runStart = i;
    }
  }

  if (state.glowEnabled) {
    p.noStroke();
    const dotStep = Math.max(1, Math.floor(n / 60));   // ~60 sparkle dots regardless of path density
    for (let i = 0; i < n; i += dotStep) {
      const col = pathColorAt(i);
      p.drawingContext.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
      p.fill(Math.min(255, col[0] + 70), Math.min(255, col[1] + 70), Math.min(255, col[2] + 70), 230);
      p.circle(state.textPathPoints[i][0], state.textPathPoints[i][1], 3.5);
    }
    p.drawingContext.shadowBlur = 0;
  }
}
