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

// OVERFLOW (Diego, Oct 27, 2026) — `params.overflow` + `params.reach` {left, top, right, bottom} (main.js: how far
// the canvas's edges lie beyond the inner rect; all 0 = Keep margin). Everything is still sized from `inner` (cell
// size, lattice origin, rotation centre); the lattice only goes on past it, clipped against the larger rect. Null when
// there is nothing to add (Overflow off, or Keep margin) — the output is then today's, byte for byte.
function overflowRect(params, inner) {
  const R = params.overflow && params.reach;
  if (!R) return null;
  const l = Math.max(0, R.left || 0), t = Math.max(0, R.top || 0), r = Math.max(0, R.right || 0), b = Math.max(0, R.bottom || 0);
  if (!(l || t || r || b)) return null;
  return { x: inner.x - l, y: inner.y - t, width: inner.width + l + r, height: inner.height + t + b };
}
function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
// Overflow params flags, so presets round-trip (reach itself is not stored — main.js derives it from the canvas).
function overflowFlags(params) {
  return { ...(params.overflow ? { overflow: true } : {}), ...(params.overflow && params.keepMargin ? { keepMargin: true } : {}) };
}

// Sutherland–Hodgman clip against an axis-aligned rect — the same private copy as hexagonal.js's own clipToRect. A
// ring-sector is not convex (its inner arc), but the clip rect is, which is all Sutherland–Hodgman needs; a wedge the
// rect cuts in two comes back as one polygon joined along the rect's edge (zero-width there), drawn as two pieces.
function clipToRect(poly, rect) {
  const planes = [
    { p: [rect.x, rect.y], n: [1, 0] },
    { p: [rect.x + rect.width, rect.y], n: [-1, 0] },
    { p: [rect.x, rect.y], n: [0, 1] },
    { p: [rect.x, rect.y + rect.height], n: [0, -1] },
  ];
  let out = poly;
  for (const plane of planes) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    const side = (p) => (p[0] - plane.p[0]) * plane.n[0] + (p[1] - plane.p[1]) * plane.n[1];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i - 1 + input.length) % input.length];
      const curSide = side(cur), prevSide = side(prev);
      const curIn = curSide >= 0, prevIn = prevSide >= 0;
      if (curIn !== prevIn) {
        const t = prevSide / (prevSide - curSide);
        out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
      }
      if (curIn) out.push(cur);
    }
  }
  return out;
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

  // OVERFLOW (Diego, Oct 27, 2026): same centre, same sectors, same ring step — the rings go on outward (each one the
  // last ring's step) until the clip rect's farthest corner is covered, then every wedge is clipped against it.
  // Overflow = the canvas (`reach` from main.js); Keep margin (reach 0) = the inner rect itself, so its corners fill.
  const clip = params.overflow && params.reach ? (overflowRect(params, inner) || { x: inner.x, y: inner.y, width: inner.width, height: inner.height }) : null;
  let ringCount = rings;
  const lastStep = fracAt(rings) - fracAt(rings - 1);
  const fracOut = i => i <= rings ? fracAt(i) : fracAt(rings) + (i - rings) * lastStep;
  if (clip && lastStep > 0) {
    const xs = [clip.x, clip.x + clip.width], ys = [clip.y, clip.y + clip.height];
    let need = 0;   // the farthest corner, in the ellipse's own radius fraction
    xs.forEach(x => ys.forEach(y => { need = Math.max(need, Math.hypot((x - cx) / outerRx, (y - cy) / outerRy)); }));
    need += active ? 0.15 * distortAmount : 0;   // a ring's radius wobbles up to this much (radiusWarp below)
    while (fracOut(ringCount) < need && ringCount < rings + 400) ringCount++;
  }

  const cells = [];
  for (let i = 0; i < ringCount; i++) {
    const f0 = clip ? fracOut(i) : fracAt(i), f1 = clip ? fracOut(i + 1) : fracAt(i + 1);
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
      if (clip) {
        const cut = clipToRect(poly, clip);
        if (cut.length < 3 || Math.abs(polygonArea(cut)) < 1e-6) continue;
        // a cut wedge keeps its straight cut: 'sharp' holds the corners the canvas edge makes (catmullRomPathD)
        const wasCut = cut.length !== poly.length || cut.some((p, k) => p !== poly[k]);
        cells.push({ id: 'c' + cells.length, points: cut, centroid: polygonCentroid(cut), smooth: active ? (wasCut ? 'sharp' : true) : false });
        continue;
      }
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly), smooth: active });
    }
  }

  return {
    grid: {
      type: 'radial',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { rings, sectors, innerRadiusFrac, gap, startAngle, curve, stretch, seed, distortMode, distortAmount, distortFrequency, distortPhase, ...overflowFlags(params) },
      gap: 0,
    },
    cells,
  };
}
