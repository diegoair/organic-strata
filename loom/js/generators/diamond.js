/* ─────────────────────────────────────────────────────────────
   Diamond generator — fifth polygon-shaped generator: squares on a plain
   uniform lattice, rotated as a whole field by `Rotation`. At Rotation 0
   the squares are axis-aligned (a plain "Rectangular" grid); at Rotation
   45 the SAME lattice reads as the classic diamond/argyle pattern
   (vertices up/down/left/right instead of edges) — one continuous
   control morphs between the two rather than needing separate
   generators for what is the same tessellation at two named angles, the
   same insight that turned Hexagonal's own Flat-top/Pointy-top toggle
   into a continuous `Rotation` earlier this session. Ships with
   Rotation defaulting to 45° (reads as "Diamond" out of the box, per
   this generator's own name), not 0.

   `Rotation`'s meaningful range is `[0, 90)`, not the 60° every other
   polygon generator here uses, because a SQUARE's point-group order is 4,
   not 6.

   A real first-draft mistake, caught and rebuilt before shipping, is
   worth recording: the first attempt built diamond-oriented squares
   directly on an offset row/column lattice (guessing at spacing by
   analogy to Hexagonal's own offset-row construction) — same-row
   diamonds only touched at a single VERTEX, not a shared EDGE, leaving
   real diamond-shaped gaps between rows. The fix was to stop hand-deriving
   diamond-lattice spacing and instead build what's actually proven to
   tile: a PLAIN axis-aligned square grid (trivially edge-to-edge, no
   offset math needed at all — `hSpacing = vSpacing = side`), each square's
   own 4 vertices already built at 45°+90°·i so Rotation 0 gives axis-
   aligned squares and Rotation 45 gives diamonds, then the WHOLE field
   (lattice centres AND shapes) is rotated rigidly by the user's Rotation
   value — the same "rotate everything together, never the shape alone"
   discipline Hexagonal's own header already establishes, which is also
   exactly why this is safe: a rigid rotation of a tiling that already
   tiles is still a tiling, at any angle, with no new spacing to derive.

   `Spin mode`/`Spin amount`/`Noise scale` are the identical five per-cell
   flavours (Random/Checkerboard/Radial/Spiral/Noise) as Hexagonal/
   Triangular, applied to each square's own local vertex angles before
   the rigid Rotation. `Gap` shrinks each square toward its own
   (jittered) centroid; `Jitter` offsets each cell independently first,
   same accepted "breaks the exact shared edge" trade-off as every other
   polygon generator's own Jitter. At Gap 0 / Jitter 0 / Spin off, any
   Rotation tiles edge-to-edge exactly.
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

// A square (half-side `halfSide`) built at its 4 CORNERS (45°+90°·i), so
// spinDeg 0 is axis-aligned — `circumR` is the corner distance (half-side
// × √2). `spinDeg` rotates this local orientation before the rigid
// whole-lattice Rotation is applied (same composition order as
// hexagonal.js's own hexPoints(...,spinDeg)).
function squarePoints(cx, cy, halfSide, spinDeg) {
  const circumR = halfSide * Math.SQRT2;
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const rad = (Math.PI / 180) * (45 + 90 * i + (spinDeg || 0));
    pts.push([cx + circumR * Math.cos(rad), cy + circumR * Math.sin(rad)]);
  }
  return pts;
}

function rotatePoint(p, cx, cy, rad) {
  const dx = p[0] - cx, dy = p[1] - cy;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  return [cx + dx * cosA - dy * sinA, cy + dx * sinA + dy * cosA];
}

// Per-cell Spin angle (degrees) — identical to hexagonal.js/triangular.js's
// own spinFor (each polygon generator keeps its own copy).
function spinFor(mode, amount, col, row, cx, cy, centerX, centerY, halfDiag, rng, noiseFreq) {
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
    const n = Organica.noise.fbm(cx * noiseFreq, cy * noiseFreq);
    return (n * 2 - 1) * amount;
  }
  return 0;
}

// Sutherland–Hodgman clip of a convex polygon against an axis-aligned rect
// — same technique as every other polygon generator's own private copy.
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
export function generateDiamond(params, inner) {
  const { cols, rotation, spinMode, spinAmount, noiseScale, gap, jitter, seed } = params;
  const rng = mulberry32(seed);
  const rad = (Math.PI / 180) * (rotation || 0);

  const side = inner.width / cols;
  const halfSide = side / 2;

  // Unrotated lattice must cover the inner rect's own bounding CIRCLE,
  // centred on the inner rect's centre — same reasoning as
  // hexagonal.js/triangular.js's own header.
  const centerX = inner.x + inner.width / 2, centerY = inner.y + inner.height / 2;
  const halfDiag = Math.hypot(inner.width, inner.height) / 2 + side;
  const noiseFreq = (noiseScale || 3) / (inner.width / 2);
  const steps = Math.ceil((2 * halfDiag) / side) + 2;
  const start = -Math.floor(steps / 2);
  const effHalfSide = halfSide * (1 - gap);

  const cells = [];
  for (let row = start; row < start + steps; row++) {
    for (let col = start; col < start + steps; col++) {
      let cx = centerX + col * side, cy = centerY + row * side;
      if (jitter > 0) {
        cx += (rng() - 0.5) * 2 * jitter * halfSide;
        cy += (rng() - 0.5) * 2 * jitter * halfSide;
      }
      const spinDeg = spinFor(spinMode, spinAmount, col, row, cx, cy, centerX, centerY, halfDiag, rng, noiseFreq);
      let poly = squarePoints(cx, cy, effHalfSide, spinDeg);
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
      type: 'diamond',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, rotation, spinMode, spinAmount, noiseScale, gap, jitter, seed },
      gap: 0,
    },
    cells,
  };
}
