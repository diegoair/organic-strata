/* ─────────────────────────────────────────────────────────────
   Membrane — Procedural seed: Circle (a ring of formResolution points,
   evenly spaced — or, per state.proceduralShape, a Noise-perturbed or
   Cluster variant of that same ring), Line (formResolution points
   interpolated between two random endpoints), or Point (exactly one
   agent). Ported from the original P_2_2_3_02 sketch's own setup()/
   mousePressed() branching — this is the one seed source with no
   external raster/outline to read, so it writes directly into
   state.xs/ys in canvas-relative space.

   Seed shape (Circle mode only — Line/Point have no "ring" to reshape):
     'ring'    — the original perfect circle, byte-for-byte unchanged.
     'noise'   — radius modulated by Organica.noise.fbm, sampled on a
                 circle in NOISE space (cos/sin of the point's own angle)
                 so angle=0 and angle=2π land on the exact same noise
                 value — no seam where the loop closes. An organic blob,
                 not a lumpy one — the same "drop mark" language Komorebi's
                 own Cellular/Broadleaf masks already use this technique for.
     'cluster' — heavy per-vertex radius jitter (0.3x–1.7x) plus small
                 angular jitter, for a lumpy, uneven silhouette. NOT
                 Komorebi's own clusterField (a raster union of many
                 independent discs) — Membrane's shape is always ONE
                 ordered point list feeding a single curveVertex loop,
                 so "cluster" here is the closest honest equivalent: an
                 irregular outline instead of a raster blob union. Angle
                 stays monotonically increasing (jitter capped at under
                 half the angular step) so the closed curve can't
                 self-cross into a chaotic knot.
   ───────────────────────────────────────────────────────────── */
import { state } from '../state.js';

function ringPoint(i, n, radius) {
  const a = (Math.PI * 2 * i) / n;
  return [Math.cos(a) * radius, Math.sin(a) * radius, a];
}

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

  if (state.drawMode === 'circle' && state.proceduralShape === 'noise') {
    const freq = 1.6, seed = p.random(1000);   // a fresh noise offset per spawn, same "vary every time" feel Rainbow/Cluster already have
    for (let i = 0; i < state.formResolution; i++) {
      const [ux, uy, a] = ringPoint(i, state.formResolution, 1);
      const n = Organica.noise.fbm(ux * freq + seed, uy * freq + seed);   // 0..1, seamless around the loop since (ux,uy) is itself periodic
      const r = radius * (0.55 + n * 0.9);
      state.xs.push(Math.cos(a) * r);
      state.ys.push(Math.sin(a) * r);
    }
  } else if (state.drawMode === 'circle' && state.proceduralShape === 'cluster') {
    const step = (Math.PI * 2) / state.formResolution;
    for (let i = 0; i < state.formResolution; i++) {
      const a = i * step + p.random(-step * 0.35, step * 0.35);   // angular jitter capped under half a step — never reorders past a neighbour
      const r = radius * p.random(0.3, 1.7);
      state.xs.push(Math.cos(a) * r);
      state.ys.push(Math.sin(a) * r);
    }
  } else if (state.drawMode === 'circle') {
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
