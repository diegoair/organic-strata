/* ─────────────────────────────────────────────────────────────
   Membrane — SVG export. REAL vector geometry, not an embedded raster —
   the same "record marks as data, replay as vector elements at export
   time" architecture Spore/Pollen's own SVG export already uses
   (window._lastRenderData.marks / points[] there; state.shapeHistory
   here, see its own header in state.js and render.js's own recording
   calls). Spore/Pollen can record a one-shot batch of discrete marks;
   Membrane's own canvas is a continuously moving curve, so instead this
   replays a CAPPED, THROTTLED history of past frames' own curve/point
   geometry (render.js's HISTORY_MAX/HISTORY_INTERVAL_MS) — real vector
   paths for the accumulated look, not just the current instant, without
   an unbounded path count.

   Curves are Catmull-Rom (p5's own curveVertex, tightness 0) — converted
   to SVG cubic Bezier `C` commands via the standard conversion formula,
   the same one p5 itself uses internally. Follow path's own "Draw full
   path" static line is rebuilt fresh from state.textPathPoints (not
   from history — it's identical every frame while active, so recording
   it repeatedly would only bloat the file for no visual gain; see
   render.js's own header).
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';
import { imgColorAt, rmxColorAt } from './color.js';

function rgba(rgb, alpha255) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(alpha255 / 255).toFixed(3)})`;
}

function catmullSegD(p0, p1, p2, p3) {
  const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
  const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
  return `C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
}

// A full open/closed curve through an arbitrary point list — the same
// "prev/next" window construction render.js's own curveVertex calls use
// (clamped at the ends when open, wrapped when closed).
function curvePathD(pts, closed) {
  const n = pts.length;
  if (n < 2) return '';
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} `;
  if (closed) {
    for (let i = 0; i < n; i++) d += catmullSegD(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]) + ' ';
    d += 'Z';
  } else {
    for (let i = 0; i < n - 1; i++) d += catmullSegD(pts[Math.max(i - 1, 0)], pts[i], pts[i + 1], pts[Math.min(i + 2, n - 1)]) + ' ';
  }
  return d.trim();
}

// Replays state.shapeHistory — one entry per recorded frame, each with
// its own run list (a run is either a full contour, in Single-ink mode,
// or a single 4-point Catmull-Rom SEGMENT, in Rainbow/Sample-from-image
// mode — see render.js's own renderShapeMultiColor comment).
function buildHistorySVG() {
  let body = '';
  for (const entry of state.shapeHistory) {
    if (entry.kind === 'point') {
      body += `<circle cx="${entry.x.toFixed(2)}" cy="${entry.y.toFixed(2)}" r="${entry.r.toFixed(2)}" fill="${rgba(entry.rgb, entry.alpha)}"/>`;
      continue;
    }
    // kind === 'curve'
    if (entry.fill) {
      // fillEachFrame's own translucent fill sits UNDER the stroke, same
      // paint order as the live canvas (p.fill() before p.beginShape()).
      for (const run of entry.runs) {
        if (run.pts.length < 3) continue;
        body += `<path fill="${rgba(entry.fill.rgb, entry.fill.alpha)}" stroke="none" d="${curvePathD(run.pts, run.closed)}"/>`;
      }
    }
    for (const run of entry.runs) {
      const col = run.colors[0];
      const attrs = `fill="none" stroke="${rgba(col, state.strokeAlpha)}" stroke-width="${entry.strokeW}"`;
      if (run.isSegment) {
        // Exactly the 4-point window renderShapeMultiColor recorded —
        // one Bezier segment, not a full multi-point curve.
        const [p0, p1, p2, p3] = run.pts;
        body += `<path ${attrs} d="M ${p1[0].toFixed(2)},${p1[1].toFixed(2)} ${catmullSegD(p0, p1, p2, p3)}"/>`;
      } else {
        body += `<path ${attrs} d="${curvePathD(run.pts, run.closed)}"/>`;
      }
    }
  }
  return body;
}

// Follow path's own clean static line — rebuilt fresh from
// state.textPathPoints (not history, see this file's own header),
// mirroring render.js's own pathColorAt/renderFullPath() exactly (same
// formula, same imgColorAt call) so Sample-from-image reads real pixel
// colour here too, not a degraded ink-only fallback.
function pathColorAt(i) {
  const n = state.textPathPoints.length;
  if (state.colorSrc === 'rainbow') return hsbToRgb255((i / n) * 360, 85, 100);
  if (state.colorSrc === 'rmx') return rmxColorAt(i / n, state.rmxColors, state.rmxColorMap, i);
  if (state.colorSrc === 'image' && state.imgFit) {
    const pt = state.textPathPoints[i];
    return imgColorAt(state.imgPixelsCache, state.inkRGB, state.imgFit.refX + (pt[0] - state.W / 2) / state.imgFit.scale, state.imgFit.refY + (pt[1] - state.H / 2) / state.imgFit.scale);
  }
  return state.inkRGB;
}
function hsbToRgb255(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function buildFullPathSVG(glowFilterId) {
  const n = state.textPathPoints.length;
  if (n < 2) return '';
  const filterAttr = glowFilterId ? ` filter="url(#${glowFilterId})"` : '';

  if (state.pathRenderStyle === 'dots') {
    let body = '';
    for (let i = 0; i < n; i++) {
      const col = pathColorAt(i);
      const p = state.textPathPoints[i];
      body += `<circle${filterAttr} cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="${(state.pathDotSize / 2).toFixed(2)}" fill="${rgba(col, state.strokeAlpha)}"/>`;
    }
    return body;
  }

  let body = '', runStart = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || state.pathBreaks.has(i)) {
      const runEnd = i - 1;
      if (runEnd > runStart) {
        const runPts = state.textPathPoints.slice(runStart, runEnd + 1);
        if (state.colorSrc === 'ink') {
          body += `<path${filterAttr} fill="none" stroke="${rgba(state.inkRGB, state.strokeAlpha)}" stroke-width="${state.strokeW}" d="${curvePathD(runPts, false)}"/>`;
        } else {
          for (let k = runStart; k < runEnd; k++) {
            const i0 = Math.max(k - 1, runStart), i1 = k, i2 = k + 1, i3 = Math.min(k + 2, runEnd);
            const col = pathColorAt(i1);
            body += `<path${filterAttr} fill="none" stroke="${rgba(col, state.strokeAlpha)}" stroke-width="${state.strokeW}" d="M ${state.textPathPoints[i1][0].toFixed(2)},${state.textPathPoints[i1][1].toFixed(2)} ${catmullSegD(state.textPathPoints[i0], state.textPathPoints[i1], state.textPathPoints[i2], state.textPathPoints[i3])}"/>`;
          }
        }
      }
      runStart = i;
    }
  }
  return body;
}

export function buildExportSVGString() {
  const W = state.W, H = state.H;
  const bg = `rgb(${state.canvasBgRGB[0]},${state.canvasBgRGB[1]},${state.canvasBgRGB[2]})`;
  const showFullPath = state.movementPattern === 'textpath' && state.drawFullPath && state.textPathPoints.length >= 2;
  const glowOn = state.glowEnabled && showFullPath;

  let defs = '';
  if (glowOn) {
    defs = `<filter id="mGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  }

  let body = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  body += buildHistorySVG();
  if (showFullPath) body += buildFullPathSVG(glowOn ? 'mGlow' : null);

  const meta = {
    tool: 'Membrane', drawMode: state.drawMode, seedSource: state.seedSource,
    movementPattern: state.movementPattern, colorSrc: state.colorSrc,
    historyFrames: state.shapeHistory.length,
    exportedAt: new Date().toISOString(),
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<metadata>${JSON.stringify(meta)}</metadata>`
    + (defs ? `<defs>${defs}</defs>` : '')
    + body + `</svg>`;
}
