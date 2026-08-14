/* ─────────────────────────────────────────────────────────────
   Triangular generator — fourth polygon-shaped generator. Real
   equilateral-triangle tessellation (alternating up/down triangles),
   not a rectangle-cut-in-half approximation: a right-triangle grid (the
   cheap way to "add triangles") only tiles at 90°/45° and reads as a cut
   rectangle, not a triangular mesh — the same "no distorted approximation"
   discipline Hexagonal's own header states for its hexagons.

   Construction (the standard equilateral-triangle-lattice layout): row
   height `h = side · √3⁄2`; within a row, triangle i alternates orientation
   by parity — even i is "up" (apex at the row's TOP edge, base along the
   BOTTOM edge), odd i is "down" (apex at the BOTTOM edge, base along the
   TOP edge), each advancing `side⁄2` in x. Stacking rows needs no special
   joinery between them — an up-triangle's apex naturally meets the row
   above's own down-triangle bases, because both rows are built from the
   same repeating side/2 pitch. `Columns` sets the target side length
   (`inner.width / cols`), matching Hexagonal's own density-not-count
   convention.

   `Rotation` (0–60°) — the SAME rigid whole-lattice rotation as
   Hexagonal's own, ported rather than reinvented once Diego asked for it
   here too: the triangular lattice is the hexagonal lattice's dual and
   shares its 6-fold symmetry, so the field is built in its own unrotated
   frame (sized from the inner rect's own diagonal, not its width/height,
   so a rotated field still covers every corner of the real, unrotated
   inner rect it's clipped against), rotated as a whole around the inner
   rect's centre, THEN clipped — rotating each triangle's shape alone
   while leaving lattice points fixed would open the same gaps/overlaps
   Hexagonal's own header explains for hexagons. Range `[0, 60)` for the
   identical reason: the pattern repeats every 60°.

   `cellShape = 'polygon'` again. Inner-rect clipping
   IS needed here, same as Voronoi/Hexagonal and unlike Radial — a plain
   row/column loop has no reason to stay inside the inner rect the way
   Radial's field is inherently bounded by its own outer radius, so
   boundary triangles are trimmed with the same Sutherland–Hodgman
   `clipToRect` Hexagonal already uses (ported, not shared, matching every
   other polygon generator's own private copy).

   Gap shrinks each triangle toward its OWN centroid before it's pushed —
   same idea as Hexagonal's own Gap. Jitter offsets each triangle
   independently (not its shared lattice vertices), the same accepted
   trade-off Hexagonal's own Jitter already makes: a real hand-set mosaic
   look, at the cost of neighbours no longer sharing an exact edge once
   jittered. At Gap 0 / Jitter 0 / any Rotation this tiles edge-to-edge
   exactly, the same "0 = true no-op" discipline as every other Organica
   control.

   `Spin mode` / `Spin amount` — the identical per-cell idea and the
   identical five modes as Hexagonal's own Spin (ported, not reinvented,
   once Diego asked for it here too): Random/Checkerboard/Radial/Spiral/
   Noise each rotate a triangle's own LOCAL orientation around its own
   centroid, independent of the rigid whole-lattice `Rotation` above, so
   — same as Hexagonal — it necessarily breaks edge-to-edge tiling once
   neighbours stop facing the same way. Applied to the (jittered) centroid
   BEFORE Gap and the rigid Rotation, so all four controls compose in one
   consistent order: local spin → position jitter is applied first so
   Radial/Spiral/Noise read the cell's actual jittered position, THEN
   spin rotates around that position, THEN Gap shrinks, THEN the whole
   lattice rotates rigidly, THEN the result is clipped.
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

function rotatePoint(p, cx, cy, rad) {
  const dx = p[0] - cx, dy = p[1] - cy;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  return [cx + dx * cosA - dy * sinA, cy + dx * sinA + dy * cosA];
}

// Per-cell Spin angle (degrees) — identical to hexagonal.js's own spinFor,
// ported rather than shared (each polygon generator keeps its own copy,
// this file set's established pattern). `noiseOffset` decorrelates the
// Noise field per Seed (fbm itself has no seed parameter — see
// hexagonal.js's own header for why this fix exists and how it avoids
// perturbing Jitter/Random's own output at the same seed).
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

// Sutherland–Hodgman clip of a convex polygon against an axis-aligned
// rect — same technique as hexagonal.js's own clipToRect (each polygon
// generator keeps its own copy, the established pattern in this file set).
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

function shrinkToward(poly, centroid, amount) {
  if (!amount) return poly;
  const k = 1 - amount;
  return poly.map(p => [
    centroid[0] + (p[0] - centroid[0]) * k,
    centroid[1] + (p[1] - centroid[1]) * k,
  ]);
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
export function generateTriangular(params, inner) {
  const { cols, rotation, spinMode, spinAmount, noiseScale, gap, jitter, seed } = params;
  const rng = mulberry32(seed);
  const rad = (Math.PI / 180) * (rotation || 0);

  const side = inner.width / cols;
  const h = side * (Math.sqrt(3) / 2);

  // Unrotated lattice must cover the inner rect's own bounding CIRCLE
  // (half-diagonal + one triangle's worth of slack), centred on the
  // inner rect's centre — same reasoning as hexagonal.js's own header.
  const centerX = inner.x + inner.width / 2, centerY = inner.y + inner.height / 2;
  const halfDiag = Math.hypot(inner.width, inner.height) / 2 + side;
  const noiseFreq = (noiseScale || 3) / (inner.width / 2);
  // Distinct rng stream from `rng` above — see spinFor's own comment.
  const noiseRng = mulberry32((seed >>> 0) ^ 0x9E3779B9);
  const noiseOffset = [noiseRng() * 1000, noiseRng() * 1000];
  const rowSteps = Math.ceil((2 * halfDiag) / h) + 2;
  const colSteps = Math.ceil((2 * halfDiag) / (side / 2)) + 2;
  const rowStart = -Math.floor(rowSteps / 2), colStart = -Math.floor(colSteps / 2);

  const cells = [];
  for (let row = rowStart; row < rowStart + rowSteps; row++) {
    const y0 = centerY + row * h, y1 = y0 + h;
    for (let i = colStart; i < colStart + colSteps; i++) {
      const x0 = centerX + i * (side / 2);
      const up = (((i % 2) + 2) % 2) === 0;
      let poly = up
        ? [[x0, y1], [x0 + side, y1], [x0 + side / 2, y0]]
        : [[x0, y0], [x0 + side, y0], [x0 + side / 2, y1]];

      let centroid = polygonCentroid(poly);
      if (jitter > 0) {
        const dx = (rng() - 0.5) * 2 * jitter * side;
        const dy = (rng() - 0.5) * 2 * jitter * side;
        poly = poly.map(p => [p[0] + dx, p[1] + dy]);
        centroid = [centroid[0] + dx, centroid[1] + dy];
      }
      const spinDeg = spinFor(spinMode, spinAmount, i, row, centroid[0], centroid[1], centerX, centerY, halfDiag, rng, noiseFreq, noiseOffset);
      if (spinDeg) {
        const spinRad = (Math.PI / 180) * spinDeg;
        poly = poly.map(p => rotatePoint(p, centroid[0], centroid[1], spinRad));
      }
      poly = shrinkToward(poly, centroid, gap);
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
      type: 'triangular',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, rotation, spinMode, spinAmount, noiseScale, gap, jitter, seed },
      gap: 0,
    },
    cells,
  };
}
