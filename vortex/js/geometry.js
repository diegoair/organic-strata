/* ─────────────────────────────────────────────────────────────
   Vortex — pure 3D math: the conical helix, camera orbit, perspective
   projection, per-segment noise/spin/orbit, and the per-segment
   segConst() cache. Ported from explorations/vortex/index.html's own
   module-level functions — the geometry itself is untouched, only the
   p5 dependency (state.p.noise, the only one) and the module-level
   mutable variables (now state.*) changed shape.

   lerp/clamp/mapRange are small local pure helpers, NOT routed through
   state.p — p5's own lerp/constrain/map are three-line functions, and
   threading them through state.p would only add an indirection with no
   benefit (unlike state.p.noise(), which is real Perlin-table state).
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';

const TAU = Math.PI * 2;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function mapRange(v, a, b, c, d) { return c + (d - c) * ((v - a) / (b - a)); }

// Standard mulberry32 — Camouflage's own documented reproducible-Seed
// precedent (CLAUDE.md's own Session Notes): one small PRNG reset per
// generation from a numeric seed. Used here only to derive
// state.seedOffset once (see applySeed() below), not as an ongoing
// per-frame generator.
function mulberry32(a) { return Organica.mulberry32(a);
}

// Called from main.js's p.setup() and on every Seed change. Two things,
// both mandatory:
//   1. p.noiseSeed() reinits p5's own deterministic Perlin table — a
//      single call that covers BOTH segConst's own noise samples AND
//      noisyPoint3D's, since both are plain state.p.noise() calls.
//   2. segConstCache.length = 0 — segConst() caches lazily per index
//      (see its own comment below); without clearing it, every index
//      already visited before the seed change stays frozen on the OLD
//      seed's values, so a new seed would only affect segments beyond
//      whatever activeCount had already reached. Real bug risk, not a
//      hypothetical — this is exactly what the "seed 42, seed 7, seed
//      42 again must match" verification in the plan is designed to catch.
// Belt-and-braces: seedOffset (mulberry32-derived) is ALSO added to
// every noise x-coordinate in segConst/noisyPoint3D, decorrelating the
// two seeds even if p.noiseSeed()'s own behaviour ever changes across
// p5 versions.
export function applySeed() {
  if (state.p) state.p.noiseSeed(state.seed);
  state.seedOffset = Math.floor(mulberry32(state.seed)() * 100000);
  segConstCache.length = 0;
}

// ── Per-segment CONSTANT multipliers — see the exploration's own
// extensive comment (ported verbatim in spirit): derived from noise
// sampled at a fixed reference coordinate unrelated to the animation's
// own time axis (z=999), so each segment's rate/direction/phase is
// stable across frames, differing only BY index. CACHED, not
// recomputed every frame — a measured real performance fix (46fps→60fps
// at 800 segments with Spin+Orbit active in the original file); the
// seed work above is the one thing allowed to invalidate this cache.
const segConstCache = [];
function segConst(i) {
  let c = segConstCache[i];
  if (!c) {
    const p = state.p;
    const off = state.seedOffset;
    c = {
      spinRate: (p.noise(i * 9.7 + off, 999) - 0.5) * 2,
      orbitRate: 0.5 + p.noise(i * 9.7 + 300 + off, 999),
      orbitPhase: p.noise(i * 9.7 + 600 + off, 999) * TAU,
    };
    segConstCache[i] = c;
  }
  return c;
}

// ── Conical helix, in the vortex's OWN 3D space before any camera
// transform. t=0 is the small vertex, t=1 the large one.
export function helixPoint3D(t, time) {
  const r = lerp(state.Rsmall, state.Rlarge, Math.pow(t, state.easingPow));
  const theta = time * state.angSpeed + t * state.turns * TAU;
  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  const y = (t - 0.5) * state.axisLen;
  return { x, y, z };
}

// ── Camera orbit — yaw → pitch → roll, three sequential axis rotations
// (not a combined matrix — clearer to read, and free at this primitive
// count next to everything else per-segment already costs).
export function applyOrbit3D(p, pitchRad, yawRad, rollRad) {
  let x = p.x, y = p.y, z = p.z;
  const x1 = x * Math.cos(yawRad) + z * Math.sin(yawRad);
  const z1 = -x * Math.sin(yawRad) + z * Math.cos(yawRad);
  const y2 = y * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
  const z2 = y * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);
  const x3 = x1 * Math.cos(rollRad) - y2 * Math.sin(rollRad);
  const y3 = x1 * Math.sin(rollRad) + y2 * Math.cos(rollRad);
  return { x: x3, y: y3, z: z2 };
}

// ── TRUE PERSPECTIVE — camera sits at distance camDist from the
// vortex's own centre; scale falls out of similar triangles. Reads
// pitch/yaw/roll from state directly (every call site wants "however
// the camera is currently oriented", never a one-off custom angle).
export function project(p3, camDist) {
  const pitchRad = state.tiltDeg * Math.PI / 180 + state.pitchOffset;
  const t = applyOrbit3D(p3, pitchRad, state.yawAngle, state.rollAngle);
  const zc = Math.max(camDist - t.z, 1);
  const scaleAmt = camDist / zc;
  return { x: t.x * scaleAmt, y: t.y * scaleAmt, z: t.z, scaleAmt };
}

// ── Per-segment independence via 3D coherent noise. Scaled by the
// local radius so the wobble reads proportionate at both ends of the cone.
export function noisyPoint3D(t, time, segIndex, r) {
  const base = helixPoint3D(t, time);
  if (state.noiseAmt <= 0) return base;
  const p = state.p, off = state.seedOffset;
  const nt = time * state.noiseSpeed;
  const nx = (p.noise(segIndex * 3.1 + off, nt) - 0.5) * 2;
  const ny = (p.noise(segIndex * 3.1 + 50 + off, nt) - 0.5) * 2;
  const nz = (p.noise(segIndex * 3.1 + 100 + off, nt) - 0.5) * 2;
  const amt = state.noiseAmt * clamp(r / state.Rlarge, 0.15, 1);
  return { x: base.x + nx * amt, y: base.y + ny * amt, z: base.z + nz * amt };
}

// Shortest-path angle interpolation — always takes the under-half-turn
// direction rather than potentially crossing the -π/π seam the long way.
export function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % TAU) - Math.PI;
  if (diff < -Math.PI) diff += TAU;
  return a + diff * t;
}

// ── Single source of truth for "where is segment i, fully rendered, at
// simulation time `time`" — used by BOTH 'running' and 'transitioning'
// (its own target pose), so the two can never silently drift apart.
// colorAt (js/palette.js) replaces the exploration's own hardcoded
// COLORS[i % COLORS.length].
export function computeSegmentState(i, time, cx, cy, anchorDX, anchorDY, colorAt) {
  const frac = i / state.copies;
  const t = (((time * state.travSpeed + frac * state.phaseSpread) % 1) + 1) % 1;
  const r = lerp(state.Rsmall, state.Rlarge, Math.pow(t, state.easingPow));

  const p = noisyPoint3D(t, time, i, r);
  const pt = project(p, state.camDist);

  const eps = 0.002;
  const t2 = Math.min(t + eps, 1);
  const p2 = noisyPoint3D(t2, time, i, r);
  const pt2 = project(p2, state.camDist);
  const tangentAngle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);

  let alpha = 255;
  if (state.depthCue) {
    const zRange = state.Rlarge * 1.2;
    const zNorm = clamp(mapRange(pt.z, -zRange, zRange, 0, 1), 0, 1);
    alpha = lerp(90, 255, zNorm);
  }

  const sc = segConst(i);
  const finalAngle = tangentAngle + time * state.spinSpeed * sc.spinRate;
  const orbitAngle = time * state.orbitSpeed * sc.orbitRate + sc.orbitPhase;
  const orbitDX = Math.cos(orbitAngle) * state.orbitRadius * pt.scaleAmt;
  const orbitDY = Math.sin(orbitAngle) * state.orbitRadius * pt.scaleAmt;

  return {
    x: cx + pt.x + orbitDX + anchorDX,
    y: cy + pt.y + orbitDY + anchorDY,
    z: pt.z,
    angle: finalAngle,
    scaleAmt: pt.scaleAmt,
    alpha,
    hexColor: colorAt(i),
  };
}
