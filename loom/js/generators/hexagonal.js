/* ─────────────────────────────────────────────────────────────
   Hexagonal generator — second POLYGON-shaped generator (Voronoi's own
   header: `grid.cellShape = 'polygon'` is the fork every renderer already
   branches on), reusing that whole pipeline for free: SVG/PNG export,
   the embedded-SVG live preview — none of it had to change to add this
   generator, which is the whole point of the fork being a flag on the
   model rather than per-generator code in every renderer.

   Real regular-hexagon tessellation (redblobgames' standard flat-top
   formulas — 1.5r horizontal spacing, √3·r vertical, odd columns offset
   by half a row), continuously rotatable via `rotation` instead of a
   Flat-top/Pointy-top toggle. The toggle's two options were never a real
   binary — "pointy-top" IS "flat-top" rotated 30°, and a rigid hex tiling
   tiles at ANY angle, not just those two. The two things that made the
   toggle version wrong to just generalise naively: (1) you can't rotate
   only the hexagon SHAPE and keep the lattice centres fixed — a hexagon's
   own edges only meet its neighbours' edges when the shape's orientation
   matches the lattice's, so at an in-between angle a shape-only rotation
   opens visible gaps/overlaps between hexagons that were otherwise
   edge-to-edge; the fix is to rotate the CENTRES and the SHAPE together,
   a rigid rotation of the whole pattern, which tiles at every angle by
   the honeycomb's own rotational symmetry. (2) the pattern repeats every
   60° (a hexagon's point-group order), so `rotation`'s meaningful range
   is [0, 60) — old "Flat-top" was rotation 0, old "Pointy-top" was
   rotation 30, exposed now as one continuous control instead of the two
   named endpoints.

   Building this needs the lattice generated in its OWN unrotated frame,
   THEN rotated as a whole around the inner rect's centre, THEN clipped
   against the real (axis-aligned, unrotated) inner rect — generating
   directly in rotated coordinates would need a rotation-aware clip
   against a re-rotated rect every cell, more code for the same result.
   The unrotated lattice has to cover a region big enough that, once
   rotated, it still fully covers the actual inner rect corner-to-corner
   — a plain width/height loop bound (Voronoi/pre-rotation Hexagonal's
   own approach) isn't enough once the pattern can point any direction,
   so the loop bounds are sized from the inner rect's own diagonal
   instead, centred on the inner rect's centre.

   Gap shrinks each hexagon toward its OWN centre (not the tessellation
   point) before clipping — same idea as Padding on a rect cell, just
   applied pre-clip here since a polygon has no separate "track size" to
   shrink into. Jitter offsets each centre by a seeded random amount
   before the hexagon is built, so the polygon clipped against the inner
   rect can be a false triangle/sliver at the very edge — same accepted
   trade Voronoi's own boundary seeds have. At Gap 0 / Jitter 0 / any
   Rotation this tiles edge-to-edge exactly, the same "0 = true no-op"
   discipline as every other Organica control.

   `Spin` — per-CELL rotation, a deliberately different control from
   `Rotation` above, not a finer-grained version of it. `Rotation` rotates
   centres and shapes TOGETHER (rigid, tiling-preserving); Spin rotates
   only each hexagon's own local orientation, on top of that, which by
   definition can no longer preserve edge-to-edge tiling once two
   neighbours stop facing the same way — same honest trade-off Jitter
   already makes for position. Asked Diego directly which flavour he
   meant rather than guessing (spin isn't visually near-identical the way
   two colour presets are — random/checkerboard/radial/spiral/noise are
   structurally different generators of the SAME idea) and shipped five as
   `Spin mode`, `Off` by default so the base tessellation stays an exact
   no-op:
     - `random`  — seeded, uniform in [-Amount, +Amount] per cell.
     - `checkerboard` — alternates ±Amount by (col+row) parity, in the
       UNROTATED lattice's own row/col indices (not the rotated visual
       grid) — a deterministic, non-random pattern.
     - `radial` — Amount scaled by each cell's distance from the inner
       rect's own centre (0 at the centre, full Amount at the corners),
       a continuous "unfurling" gradient rather than a per-cell jitter.
     - `spiral` — Amount scaled by each cell's ANGLE around the centre
       (`atan2`, not distance), a true pinwheel/vortex twist. Angle wraps
       from -π to +π, so there is a real, expected seam where Spin jumps
       from -Amount to +Amount directly across it — disclosed rather than
       smoothed away, the same way a physical spiral staircase has a seam
       where it starts; smoothing it (e.g. `sin(theta)`) would read as a
       wave, not a vortex, a different mode entirely.
     - `noise` — Amount scaled by a seeded 4-octave value-noise field
       (`Organica.noise.fbm`, `shared/organica-noise.js` — Loom's first
       consumer, ported from Komorebi/Camo Turing/Warping rather than a
       fourth private copy) sampled at each hex's own centre, an organic
       "wind-blown" texture instead of geometric symmetry. `Noise scale`
       sets how many field cycles span the canvas — the one Spin mode
       that needs a second control, since "how chaotic" (Amount) and "how
       big are the swirled regions" (Scale) are genuinely independent.
       `fbm` itself has no seed parameter (Diego caught this live: turning
       Seed at Jitter 0 did nothing under Noise, a real dead-control gap,
       unlike Random/Checkerboard/Radial/Spiral which are either genuinely
       seeded or genuinely deterministic by design) — fixed by sampling
       `fbm` at a per-generation offset drawn from its OWN independent
       `mulberry32` stream (seeded from a distinct transform of `seed`,
       never sharing draws with the main `rng` that feeds Jitter/Random),
       so Seed now reliably reshuffles the Noise field too without
       perturbing Jitter's or Random's own output at the same seed.
   Applied to the hexagon's OWN local vertex angles before the rigid
   `Rotation` step, so Spin composes with Rotation correctly (rotate
   locally first, then carry that already-spun shape through the same
   rigid whole-pattern rotation) rather than fighting it.
   ───────────────────────────────────────────────────────────── */

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hexPoints(cx, cy, r, spinDeg) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const rad = (Math.PI / 180) * (60 * i + (spinDeg || 0));
    pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
  }
  return pts;
}

// Per-cell Spin angle (degrees) — see this file's own header for why this
// is a distinct control from the rigid, tiling-preserving `Rotation`.
function spinFor(mode, amount, col, row, cx, cy, centerX, centerY, halfDiag, rng, noiseFreq, noiseOffset) {
  if (!mode || mode === 'off' || !amount) return 0;
  if (mode === 'random') return (rng() - 0.5) * 2 * amount;
  if (mode === 'checkerboard') return ((((col + row) % 2) + 2) % 2 === 0 ? 1 : -1) * amount;
  if (mode === 'radial') {
    const dist = Math.hypot(cx - centerX, cy - centerY) / halfDiag;
    return amount * Math.min(1, dist);
  }
  if (mode === 'spiral') {
    const theta = Math.atan2(cy - centerY, cx - centerX);
    return amount * (theta / Math.PI);
  }
  if (mode === 'noise') {
    const n = Organica.noise.fbm(cx * noiseFreq + noiseOffset[0], cy * noiseFreq + noiseOffset[1]);
    return (n * 2 - 1) * amount;
  }
  return 0;
}

function rotatePoint(p, cx, cy, rad) {
  const dx = p[0] - cx, dy = p[1] - cy;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  return [cx + dx * cosA - dy * sinA, cy + dx * sinA + dy * cosA];
}

// Sutherland–Hodgman clip of a convex polygon against an axis-aligned
// rect, one edge (half-plane) at a time — same technique as voronoi.js's
// own clipHalfPlane, generalised to 4 fixed half-planes instead of one
// per neighbour seed.
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

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

/**
 * @param {{cols:number, rotation:number, spinMode:'off'|'random'|'checkerboard'|'radial'|'spiral'|'noise', spinAmount:number, noiseScale:number, gap:number, jitter:number, seed:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateHexagonal(params, inner) {
  const { cols, rotation, spinMode, spinAmount, noiseScale, gap, jitter, seed } = params;
  const rng = mulberry32(seed);
  const rad = (Math.PI / 180) * (rotation || 0);
  // "Noise scale" is stated to the user as cycles across the canvas, so
  // the frequency is normalised by the inner rect's own half-width —
  // same reasoning as Warping's own NORM constant, just local to this
  // generator since it's the only Spin mode that needs it.
  const noiseFreq = (noiseScale || 3) / (inner.width / 2);
  // A distinct rng stream, never sharing draws with `rng` above — the
  // Noise field's own seed-dependence must not perturb Jitter/Random's
  // output at the same seed (this file's own header explains why).
  const noiseRng = mulberry32((seed >>> 0) ^ 0x9E3779B9);
  const noiseOffset = [noiseRng() * 1000, noiseRng() * 1000];

  const hSpacing0 = inner.width / cols;
  const r = hSpacing0 / 1.5;
  const hSpacing = 1.5 * r;
  const vSpacing = Math.sqrt(3) * r;
  const effR = r * (1 - gap);

  // Unrotated lattice must cover the inner rect's own bounding CIRCLE
  // (half-diagonal + one hex radius of slack), centred on the inner
  // rect's centre — big enough that no corner of the real rect is left
  // uncovered once the whole lattice is rotated into place.
  const centerX = inner.x + inner.width / 2, centerY = inner.y + inner.height / 2;
  const halfDiag = Math.hypot(inner.width, inner.height) / 2 + r;
  const colSteps = Math.ceil((2 * halfDiag) / hSpacing) + 2;
  const rowSteps = Math.ceil((2 * halfDiag) / vSpacing) + 2;
  const colStart = -Math.floor(colSteps / 2), rowStart = -Math.floor(rowSteps / 2);

  const cells = [];
  for (let row = rowStart; row < rowStart + rowSteps; row++) {
    for (let col = colStart; col < colStart + colSteps; col++) {
      let cx = centerX + col * hSpacing;
      let cy = centerY + row * vSpacing + (col % 2 !== 0 ? vSpacing / 2 : 0);
      if (jitter > 0) {
        cx += (rng() - 0.5) * 2 * jitter * r;
        cy += (rng() - 0.5) * 2 * jitter * r;
      }
      const spinDeg = spinFor(spinMode, spinAmount, col, row, cx, cy, centerX, centerY, halfDiag, rng, noiseFreq, noiseOffset);
      let poly = hexPoints(cx, cy, effR, spinDeg);
      if (rad !== 0) {
        poly = poly.map(p => rotatePoint(p, centerX, centerY, rad));
      }
      poly = clipToRect(poly, inner);
      if (poly.length < 3) continue;
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'hexagonal',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, rotation, spinMode, spinAmount, noiseScale, gap, jitter, seed },
      gap: 0,
    },
    cells,
  };
}
