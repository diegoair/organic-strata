/* ─────────────────────────────────────────────────────────────
   Vortex — SVG export. Far simpler than Membrane's own, and for a
   structural reason, not a corner cut: Vortex clears and redraws every
   frame (g.background() at the top of render.js's own renderFrame()),
   so "what is on the canvas right now" is exactly state.lastItems — one
   frame, fully known, already depth-sorted. Membrane accumulates
   thousands of frames' own strokes over time, so it needed a capped,
   throttled recording of PAST frames; there is nothing here to record.

   Two details that would be silently, subtly wrong if missed:
     1. scaleAmt multiplies BOTH half-length AND stroke-width — p5's own
        scale() (render.js's drawSingleSegment) scales the stroke too,
        so an SVG that only scales segment length would get the
        perspective right but every line the same thickness regardless
        of depth, which reads as "off" without an obvious cause.
     2. p5's strokeCap(SQUARE) is SVG's stroke-linecap="butt", NOT
        "square" — SVG's own `square` EXTENDS the stroke past the
        endpoint by half its width; p5's SQUARE is the flat, non-
        extending cap. The names collide, the behaviours don't.
   state.lastItems is already farthest-first (render.js's own depth
   sort) — SVG paints in document order, so no re-sort is needed; this
   is one of the rare cases where canvas paint order already IS the
   correct vector document order.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';

function rgba(rgb, alpha255) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(alpha255 / 255).toFixed(3)})`;
}

export function buildExportSVGString() {
  const W = state.W, H = state.H;
  const bg = `rgb(${state.bgRGB[0]},${state.bgRGB[1]},${state.bgRGB[2]})`;

  let body = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  for (const it of state.lastItems) {
    const half = (state.segLen / 2) * it.scaleAmt;
    const dx = Math.cos(it.angle) * half, dy = Math.sin(it.angle) * half;
    const sw = (state.thickness * it.scaleAmt).toFixed(2);
    body += `<line x1="${(it.x - dx).toFixed(2)}" y1="${(it.y - dy).toFixed(2)}" x2="${(it.x + dx).toFixed(2)}" y2="${(it.y + dy).toFixed(2)}" `
      + `stroke="${rgba(hexToRgb(it.hexColor), it.alpha)}" stroke-width="${sw}" stroke-linecap="butt"/>`;
  }

  const meta = {
    tool: 'Vortex', phase: state.phase, seed: state.seed,
    segments: state.lastItems.length, colors: state.colors,
    camera: { tilt: state.tiltDeg, yaw: state.yawAngle, pitch: state.pitchOffset, roll: state.rollAngle, camDist: state.camDist },
    exportedAt: new Date().toISOString(),
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<metadata>${JSON.stringify(meta)}</metadata>`
    + body + `</svg>`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
