/* ─────────────────────────────────────────────────────────────
   Membrane — Movement patterns for the form's own centre. Float to mouse
   is the original sketch's own behaviour (eases toward the pointer); the
   rest are fixed, predictable trajectories independent of the mouse.
   Follow path additionally needs pathBreaks (built by seeds/text.js or
   seeds/loom.js) to avoid drawing/tracing a connector across a jump
   between unrelated contours/cells.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';

// Reseeds a fresh random bounce direction for Linear — called when that
// pattern is (re)selected so switching back to it doesn't always send
// the form off in the exact same direction as last time.
export function reseedLinear() {
  const p = state.p;
  const ang = p.random(Math.PI * 2);
  state.linVX = Math.cos(ang);
  state.linVY = Math.sin(ang);
}

// Five fixed, predictable trajectories for the form's own centre,
// independent of the mouse — pure functions of elapsed time `t` (seconds
// since the pattern was selected), centred on the canvas. Linear is
// handled separately in updateMovement() below (stateful — a real
// bounced velocity isn't a clean closed-form function of t).
function movementCenter(pattern, t, moveSpeed) {
  const cx0 = state.W / 2, cy0 = state.H / 2;
  const ang = t * moveSpeed;
  // Math.asin(Math.sin(x)) turns a plain sine into a clean -1..1 triangle
  // wave — no piecewise branching needed for Zigzag's back-and-forth legs.
  const tri = a => Math.asin(Math.sin(a)) * (2 / Math.PI);
  switch (pattern) {
    case 'orbit': {
      const r = Math.min(state.W, state.H) * 0.3;
      return [cx0 + Math.cos(ang) * r, cy0 + Math.sin(ang) * r];
    }
    case 'zigzag':
      return [cx0 + tri(ang) * state.W * 0.35, cy0 + tri(ang * 0.6 + Math.PI / 2) * state.H * 0.3];
    case 'figure8':
      return [cx0 + Math.sin(ang) * state.W * 0.3, cy0 + Math.sin(ang * 2) * state.H * 0.25];
    case 'sine':
      return [cx0 + tri(ang * 0.4) * state.W * 0.4, cy0 + Math.sin(ang * 3) * state.H * 0.22];
    default:
      return [cx0, cy0];
  }
}

export function updateMovement(dt) {
  const p = state.p;
  if (state.movementPattern === 'mouse') {
    if (p.mouseX >= 0 && p.mouseX <= state.W && p.mouseY >= 0 && p.mouseY <= state.H) {
      state.centerX += (p.mouseX - state.centerX) * state.floatSpeed;
      state.centerY += (p.mouseY - state.centerY) * state.floatSpeed;
    }
    return;
  }

  state.moveClock += dt;

  if (state.movementPattern === 'linear') {
    const margin = 60;   // keeps the form's own centre (and most of its extent) on-canvas before bouncing
    state.centerX += state.linVX * state.moveSpeed * 60 * dt;
    state.centerY += state.linVY * state.moveSpeed * 60 * dt;
    if (state.centerX < margin || state.centerX > state.W - margin) state.linVX *= -1;
    if (state.centerY < margin || state.centerY > state.H - margin) state.linVY *= -1;
    state.centerX = p.constrain(state.centerX, margin, state.W - margin);
    state.centerY = p.constrain(state.centerY, margin, state.H - margin);
    return;
  }

  if (state.movementPattern === 'textpath') {
    if (!state.textPathPoints.length) return;   // no path built yet — nothing to follow
    const n = state.textPathPoints.length;
    // Point-rate scaled by n itself (not a fixed constant) so a full loop
    // takes a fixed ~15s at moveSpeed=1 regardless of how dense the path is.
    const pos = (state.moveClock * state.moveSpeed * (n / 15)) % n;
    const i0 = Math.floor(pos), i1 = (i0 + 1) % n, frac = pos - i0;
    if (state.pathBreaks.has(i1)) {
      // A break at i1 isn't real geometry — snap straight to the
      // destination instead of lerping across it, so the point sits
      // still (in canvas space) for this segment's duration rather than
      // visibly tracing the gap. The same "pen lift" a real plotter does
      // between disconnected strokes.
      state.centerX = state.textPathPoints[i1][0];
      state.centerY = state.textPathPoints[i1][1];
    } else {
      const a = state.textPathPoints[i0], b = state.textPathPoints[i1];
      state.centerX = p.lerp(a[0], b[0], frac);
      state.centerY = p.lerp(a[1], b[1], frac);
    }
    return;
  }

  const [cx, cy] = movementCenter(state.movementPattern, state.moveClock, state.moveSpeed);
  state.centerX = cx;
  state.centerY = cy;
}
