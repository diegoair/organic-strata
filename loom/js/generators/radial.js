/* ─────────────────────────────────────────────────────────────
   Radial generator — third POLYGON-shaped generator: real polar
   coordinates — concentric Rings crossed with angular Sectors, each
   cell a ring-sector wedge (an annular quadrilateral with two straight
   radial edges and two curved arc edges), the dartboard/sunburst/mandala
   structure no rect-lattice or polygon-tessellation generator can honestly
   produce.

   Consolidated from three generators that turned out to be the exact
   same mechanism at different fixed parameter values — Polar was
   "Radial plus a Radius curve exponent" (curve=1 reproduced Radial
   exactly, verified byte-identical when it shipped), Elliptical was
   "Radial with independent x/y scaling instead of one radius" (an
   ellipse that touches all four canvas edges rather than a circle
   inscribed with margin left over). `Radius curve` 1 and `Stretch to
   canvas` off are the exact old Radial defaults.

   `Distortion` (Off/Sine/Noise) bends BOTH edge families at once —
   spokes (radial edges) wobble in ANGLE as a function of radius (a
   twisting/pinwheel look, the same idea angular.js's own header
   derives), and rings (arc edges) wobble in RADIUS as a function of
   angle (a wobbly, non-circular dartboard ring). One shared
   `realPoint(R, A)` maps ANY nominal (radius-fraction, angle) pair to
   its real position, where the angle nudge depends only on R and the
   radius nudge depends only on A — the identical separable-warp
   argument linear.js's own header makes in full: a ring boundary has a
   fixed nominal R along its own length (so every ring reading it gets
   the same angle-nudge), a spoke boundary has a fixed nominal A along
   its own length (so every wedge reading it gets the same radius-
   nudge) — shared edges stay coincident with no seam-matching special
   case, at Gap 0.

   `cellShape = 'polygon'` (Voronoi's own fork), each arc/spoke edge
   subdivided into short segments — a real circular (or elliptical) arc
   has no exact polygon form, so it's subdivided finely enough that the
   SVG/PNG export and the live preview both read as smoothly curved.
   When Distortion is active the whole cell additionally gets
   `smooth: true` (a real Catmull-Rom curve through those same sample
   points at export time — see json-model.js's own `catmullRomPathD`),
   since a distorted spoke newly has visible straight-segment facets a
   plain arc's own accepted many-segment convention didn't.
   ───────────────────────────────────────────────────────────── */

function realPointFactory(cx, cy, outerRx, outerRy, angleWarp, radiusWarp) {
  return function (R, A) {
    const Rw = R + (radiusWarp ? radiusWarp(A) : 0);
    const Aw = A + (angleWarp ? angleWarp(R) : 0);
    return [cx + outerRx * Rw * Math.cos(Aw), cy + outerRy * Rw * Math.sin(Aw)];
  };
}

function traceRing(realPoint, R, a0, a1, subdiv) {
  const pts = [];
  for (let k = 0; k <= subdiv; k++) {
    const a = a0 + (a1 - a0) * k / subdiv;
    pts.push(realPoint(R, a));
  }
  return pts;
}
function traceSpoke(realPoint, r0, r1, a, subdiv) {
  const pts = [];
  for (let k = 0; k <= subdiv; k++) {
    const r = r0 + (r1 - r0) * k / subdiv;
    pts.push(realPoint(r, a));
  }
  return pts;
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

function distortAt(pos, refLen, mode, amount, freq, phase, seedOffset) {
  if (mode === 'off' || !amount) return 0;
  const t = pos / refLen;
  if (mode === 'sine') return amount * Math.sin(t * freq * 2 * Math.PI + phase);
  const n = Organica.noise.fbm(t * freq, seedOffset);
  return amount * (n * 2 - 1);
}

/**
 * @param {{rings:number, sectors:number, innerRadiusFrac:number, gap:number, startAngle:number, curve:number, stretch:boolean, seed:number, distortMode:'off'|'sine'|'noise', distortAmount:number, distortFrequency:number, distortPhase:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateRadial(params, inner) {
  const { rings, sectors, innerRadiusFrac, gap, startAngle, curve, stretch, seed, distortMode, distortAmount, distortFrequency, distortPhase } = params;
  const cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  // Stretch off: both axes share the smaller radius, inscribed in a
  // circle (old Radial/Polar). Stretch on: each axis gets its own full
  // half-extent, touching all four canvas edges (old Elliptical).
  const outerRx = stretch ? inner.width / 2 : Math.min(inner.width, inner.height) / 2;
  const outerRy = stretch ? inner.height / 2 : Math.min(inner.width, inner.height) / 2;
  const innerFrac = innerRadiusFrac || 0;
  const pow = curve || 1;
  const fracAt = i => innerFrac + Math.pow(i / rings, pow) * (1 - innerFrac);
  const sectorAngle = (2 * Math.PI) / sectors;
  const start = (startAngle || 0) * (Math.PI / 180);

  const mode = distortMode || 'off';
  const active = mode !== 'off' && distortAmount > 0;
  const seedOffsetSpoke = (seed || 0) * 0.137 + 2.2, seedOffsetRing = (seed || 0) * 0.137 + 8.8;
  // Spokes swing up to ~0.35 radians (~20°) per unit Amount — an angle,
  // not a length. Rings wobble as a fraction of the outer radius.
  const angleWarp = active ? (R) => 0.35 * distortAt(R, 1, mode, distortAmount, distortFrequency, distortPhase, seedOffsetSpoke) : null;
  const radiusWarp = active ? (A) => 0.15 * distortAt(A, 2 * Math.PI, mode, distortAmount, distortFrequency, distortPhase, seedOffsetRing) : null;
  const realPoint = realPointFactory(cx, cy, outerRx, outerRy, angleWarp, radiusWarp);
  const ringSubdiv = 18, spokeSubdiv = active ? 16 : 1;

  const cells = [];
  for (let i = 0; i < rings; i++) {
    const f0 = fracAt(i), f1 = fracAt(i + 1);
    const rGap = (gap || 0) * (f1 - f0) * 0.4;
    const f0g = Math.max(0, f0 + rGap), f1g = Math.max(f0g, f1 - rGap);
    for (let j = 0; j < sectors; j++) {
      const a0 = start + j * sectorAngle, a1 = a0 + sectorAngle;
      const aGap = (gap || 0) * sectorAngle * 0.4;
      const a0g = a0 + aGap, a1g = a1 - aGap;

      const poly = traceSpoke(realPoint, f0g, f1g, a0g, spokeSubdiv)
        .concat(traceRing(realPoint, f1g, a0g, a1g, ringSubdiv).slice(1))
        .concat(traceSpoke(realPoint, f1g, f0g, a1g, spokeSubdiv).slice(1))
        .concat(traceRing(realPoint, f0g, a1g, a0g, ringSubdiv).slice(1, -1));
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly), smooth: active });
    }
  }

  return {
    grid: {
      type: 'radial',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { rings, sectors, innerRadiusFrac, gap, startAngle, curve, stretch, seed, distortMode, distortAmount, distortFrequency, distortPhase },
      gap: 0,
    },
    cells,
  };
}
