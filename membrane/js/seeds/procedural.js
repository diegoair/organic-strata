/* ─────────────────────────────────────────────────────────────
   Membrane — Procedural seed: Circle (a ring of formResolution points,
   evenly spaced), Line (formResolution points interpolated between two
   random endpoints), or Point (exactly one agent). Ported from the
   original P_2_2_3_02 sketch's own setup()/mousePressed() branching —
   this is the one seed source with no external raster/outline to read,
   so it writes directly into state.xs/ys in canvas-relative space.
   ───────────────────────────────────────────────────────────── */
import { state } from '../state.js';

export function initShape(cx, cy, radius) {
  const p = state.p;
  state.centerX = cx;
  state.centerY = cy;
  state.xs = []; state.ys = [];
  state.shapeBreaks = new Set();   // Procedural is always one real, unbroken loop/point

  if (state.drawMode === 'point') {
    // A single agent — still a real member of xs/ys (Motion's own
    // per-point random walk applies to it exactly like every other
    // point), just Resolution=1 by construction rather than by slider.
    state.xs.push(0);
    state.ys.push(0);
    state.pointSize = radius;
    return;
  }

  if (state.drawMode === 'circle') {
    const angle = p.radians(360 / state.formResolution);
    for (let i = 0; i < state.formResolution; i++) {
      state.xs.push(Math.cos(angle * i) * radius);
      state.ys.push(Math.sin(angle * i) * radius);
    }
  } else {
    const ang = p.random(Math.PI);
    const x1 = Math.cos(ang) * radius, y1 = Math.sin(ang) * radius;
    const x2 = Math.cos(ang - Math.PI) * radius, y2 = Math.sin(ang - Math.PI) * radius;
    for (let i = 0; i < state.formResolution; i++) {
      state.xs.push(p.lerp(x1, x2, i / state.formResolution));
      state.ys.push(p.lerp(y1, y2, i / state.formResolution));
    }
  }
}

// Shared by mousePressed() and Reseed's own Procedural branch — Point
// mode reads the dedicated Point size slider (2-60, sane for an actual
// on-screen dot radius); Circle/Line keep the original Init-radius-based
// spawn logic (20-320, sized for spreading a curve's worth of points,
// not for one dot).
export function proceduralSpawnRadius() {
  const p = state.p;
  if (state.drawMode === 'point') return state.pointSizeSetting;
  return state.drawMode === 'circle' ? state.initRadius * p.random(0.5, 1) : state.initRadius * p.random(0.5, 5);
}
