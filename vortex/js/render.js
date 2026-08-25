/* ─────────────────────────────────────────────────────────────
   Vortex — rendering. renderFrame(g, opts) is a PURE function of the
   current state: given whatever phase/clocks/camera state already say
   (advanced by main.js's own p.draw BEFORE calling this — clock
   advancement, the hover hit-test, and camera drag are input handling,
   not rendering, so they stay in main.js), it draws to the target `g`
   and (re)populates state.lastItems. Deliberately safe to call twice on
   the same frame's state: PNG scale export calls it a second time on an
   offscreen p5.Graphics with opts.scale set, which must NOT advance any
   clock or it would silently double-step the simulation on every scaled
   export.

   opts.scale wraps the WHOLE draw in one g.scale(s) rather than
   touching any per-item math: item positions are always computed in
   state.W/state.H's own unscaled space (cx,cy = state.W/2, state.H/2,
   never g.width/2), so a scaled offscreen target just needs g.scale(s)
   applied once before drawing — p5's scale() affects both position AND
   stroke width together, which is exactly what "a genuine bigger
   re-render, not a blurry upsample" requires.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';
import { helixPoint3D, project, computeSegmentState, lerpAngle } from './geometry.js';
import { colorAt } from './palette.js';

function lerp(a, b, t) { return a + (b - a) * t; }

function drawSingleSegment(g, x, y, angle, scaleAmt, alpha, hexColor) {
  g.push();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(scaleAmt);
  g.strokeWeight(state.thickness);
  g.strokeCap(g.SQUARE);
  const c = g.color(hexColor);
  c.setAlpha(alpha);
  g.stroke(c);
  g.line(-state.segLen / 2, 0, state.segLen / 2, 0);
  g.pop();
}

// Exported so main.js's own hover hit-test in 'resting' phase can reuse
// the EXACT same bounds this draws — one source of truth, no risk of
// the hitbox silently drifting from what's actually drawn.
export function seedLineBounds(cx, cy) {
  const n = state.colors.length;
  const totalLen = state.segLen * n;
  const pad = 14;   // generous hit area — a 1:1 hitbox on a thin line is hard to hover accurately
  return { x0: cx - totalLen / 2 - pad, x1: cx + totalLen / 2 + pad, y0: cy - state.thickness / 2 - pad, y1: cy + state.thickness / 2 + pad };
}

function drawSeedLine(g, cx, cy) {
  g.push();
  g.translate(cx, cy);
  g.strokeWeight(state.thickness);
  g.strokeCap(g.SQUARE);
  const n = state.colors.length;
  const totalLen = state.segLen * n;
  const items = [];
  for (let i = 0; i < n; i++) {
    const x0 = -totalLen / 2 + i * state.segLen;
    const x1 = x0 + state.segLen;
    g.stroke(state.colors[i]);
    g.line(x0, 0, x1, 0);
    // Synthesized as real items (not just drawn) so SVG/PNG export never
    // comes back empty at rest — see state.js's own header on lastItems.
    items.push({ x: cx + (x0 + x1) / 2, y: cy, z: 0, angle: 0, scaleAmt: 1, alpha: 255, hexColor: state.colors[i] });
  }
  g.pop();
  state.lastItems = items;
}

export function renderFrame(g, opts = {}) {
  const scale = opts.scale || 1;
  g.background(state.bgRGB[0], state.bgRGB[1], state.bgRGB[2]);
  const cx = state.W / 2, cy = state.H / 2;

  g.push();
  g.scale(scale);

  if (state.phase === 'resting') {
    drawSeedLine(g, cx, cy);
    g.pop();
    return;
  }

  const anchor0 = project(helixPoint3D(0, 0), state.camDist);
  const anchorDX = -anchor0.x, anchorDY = -anchor0.y;

  // ── TRANSITIONING — eases each of the palette's own segments from
  // their exact resting pose to their real generation-1 pose, computed
  // via computeSegmentState — the SAME function 'running' uses, so the
  // transition's own endpoint is guaranteed identical to what 'running'
  // shows on the very next frame, never a second hand-derived copy that
  // could quietly drift from it.
  if (state.phase === 'transitioning') {
    const p = Math.min(Math.max(state.transitionClock / state.transitionDuration, 0), 1);
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // easeInOutCubic
    const n = state.colors.length;
    const totalLen = state.segLen * n;
    const items = [];
    for (let i = 0; i < n; i++) {
      const restX = cx + (-totalLen / 2 + i * state.segLen + state.segLen / 2);
      const restY = cy;
      const target = computeSegmentState(i, 0, cx, cy, anchorDX, anchorDY, colorAt);
      items.push({
        x: lerp(restX, target.x, eased),
        y: lerp(restY, target.y, eased),
        angle: lerpAngle(0, target.angle, eased),
        scaleAmt: lerp(1, target.scaleAmt, eased),
        alpha: lerp(255, target.alpha, eased),
        hexColor: state.colors[i],
      });
    }
    items.forEach(it => drawSingleSegment(g, it.x, it.y, it.angle, it.scaleAmt, it.alpha, it.hexColor));
    state.lastItems = items;
    g.pop();
    return;
  }

  // ── RUNNING ──
  if (state.showDebug) {
    g.push();
    g.stroke(255, 255, 255, 60);
    g.strokeWeight(1);
    g.noFill();
    g.beginShape();
    for (let i = 0; i <= 200; i++) {
      const tt = i / 200;
      const pp = project(helixPoint3D(tt, state.animClock), state.camDist);
      g.vertex(cx + pp.x + anchorDX, cy + pp.y + anchorDY);
    }
    g.endShape();
    g.pop();
  }

  // Build every segment's own point first, THEN sort by depth and draw —
  // without depth-sorting, draw order would just be index order, so a
  // nearer segment could paint UNDER a farther one.
  const activeCount = Math.max(5, Math.round(lerp(5, state.copies, state.rampProgress)));
  const items = [];
  for (let i = 0; i < activeCount; i++) {
    items.push(computeSegmentState(i, state.animClock, cx, cy, anchorDX, anchorDY, colorAt));
  }
  items.sort((a, b) => a.z - b.z);   // farthest (smallest z) first, nearest last — nearest paints on top
  items.forEach(it => drawSingleSegment(g, it.x, it.y, it.angle, it.scaleAmt, it.alpha, it.hexColor));
  state.lastItems = items;
  g.pop();
}
