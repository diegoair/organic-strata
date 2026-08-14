/* ─────────────────────────────────────────────────────────────
   Linear generator — Column and Row combined into one generator (see
   the header history below for that first merge), now also carrying
   `Distortion`: bends the division lines themselves into sine waves or
   noise-driven ripples, on request.

   This is honest here in a way it CAN'T be on Wave (Sinusoidal/Noise):
   Wave is `cellShape: 'rect'`, its cells are CSS Grid tracks, so it can
   only ever modulate track SIZE, never the boundary's actual shape —
   its own header discloses this explicitly. Linear has been
   `cellShape: 'polygon'` since Rotation shipped (see below) — its
   cells are already plain point lists, not CSS Grid tracks, so nothing
   stops a division LINE from being a real curve instead of a straight
   segment. `Distortion` is that: Off (default, byte-identical to the
   old straight-line behaviour) / Sine / Noise, each bending every
   division line the SAME way at the SAME physical position, which is
   exactly what keeps adjacent cells' shared edges coincident (see
   `warp()` below for why this falls out for free rather than needing
   a seam-matching hack).

   Two orthogonal unit vectors `nx1`/`nx2` (the rotated X/Y axes) still
   do all three axis modes with one shared cell-builder: `both` places
   a small sx×sy rect at every (i,j) lattice point; `cols`/`rows` place
   a STRIP — full sx (or sy) width but stretched `halfLen` (≈ the
   canvas diagonal) along the other axis, then clipped to the inner
   rect. `Rotation` needed `cellShape: 'polygon'` in the first place —
   CSS Grid has no way to rotate individual tracks independently, and
   clipping a rotated lattice to the canvas rect needs real polygon
   geometry at the boundary (see diamond.js's own header for why
   "rotate the whole field, then clip" is the correct construction).
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

// Lateral displacement of a division line at physical position `pos`
// along its own length — Sine: a plain `sin`, one shared Amount/
// Frequency/Phase. Noise: `Organica.noise.fbm` sampled along a line
// (the same "reuse the shared 2D field, don't write a new 1D
// primitive" choice Wave's own Noise function already makes), Phase
// unused (fbm has no phase, same reason Wave hides it for Noise too).
// `spacing` scales the result so Amount reads as "fraction of a
// track's own width", consistent with every other Amount control in
// Loom; `refLen` is what Frequency's "cycles across ___" is relative
// to (inner.height for a Columns-family line, inner.width for Rows).
function distortAt(pos, spacing, refLen, mode, amount, freq, phase, seedOffset) {
  if (mode === 'off' || !amount) return 0;
  const t = pos / refLen;
  if (mode === 'sine') return amount * spacing * Math.sin(t * freq * 2 * Math.PI + phase);
  const n = Organica.noise.fbm(t * freq, seedOffset);
  return amount * spacing * (n * 2 - 1);
}

/**
 * One function maps ANY nominal (offX, offY) — offsets along nx1/nx2
 * from the lattice centre — to its real, possibly-warped position.
 * offX's own displacement (`Dx`) is a function of offY alone, and
 * offY's displacement (`Dy`) is a function of offX alone — this
 * separability is what guarantees two cells sharing a nominal edge
 * always compute the SAME warped points for it, from either side,
 * with no seam-matching special case: the shared edge has one of its
 * two nominal coordinates literally constant along its own length, so
 * both neighbours evaluate the identical Dx(constant-Y) or
 * Dy(constant-X) at every sampled point.
 */
function makeRealPoint(cx, cy, nx1, nx2, distortCols, distortRows) {
  return function (offX, offY) {
    const dx = distortCols ? distortCols(offY) : 0;
    const dy = distortRows ? distortRows(offX) : 0;
    const rx = offX + dx, ry = offY + dy;
    return [cx + rx * nx1[0] + ry * nx2[0], cy + rx * nx1[1] + ry * nx2[1]];
  };
}

// Subdivided straight line IN NOMINAL (offX,offY) SPACE, each sample
// mapped through realPoint — a straight nominal line becomes a real
// curve wherever distortion is active, and collapses back to an exact
// straight segment at `subdiv:1` (used whenever Distortion is Off, so
// that case costs nothing extra and matches the pre-Distortion output
// exactly).
function traceEdge(realPoint, offX0, offY0, offX1, offY1, subdiv) {
  const pts = [];
  for (let k = 0; k <= subdiv; k++) {
    const t = k / subdiv;
    pts.push(realPoint(offX0 + (offX1 - offX0) * t, offY0 + (offY1 - offY0) * t));
  }
  return pts;
}

/**
 * @param {{cols:number, rows:number, axis:'cols'|'rows'|'both', rotation:number, jitter:number, gap:number, seed:number, distortMode:'off'|'sine'|'noise', distortAmount:number, distortFrequency:number, distortPhase:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateLinear(params, inner) {
  const { cols, rows, axis, rotation, jitter, gap, seed, distortMode, distortAmount, distortFrequency, distortPhase } = params;
  const rng = mulberry32(seed);
  const rad = (rotation || 0) * (Math.PI / 180);
  const nx1 = [Math.cos(rad), Math.sin(rad)];   // rotated "X" (division axis for Columns)
  const nx2 = [-Math.sin(rad), Math.cos(rad)];  // rotated "Y" (division axis for Rows)
  const cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  const sx = inner.width / cols, sy = inner.height / rows;
  const halfLen = Math.hypot(inner.width, inner.height) / 2 + Math.max(sx, sy);
  const shrink = 1 - Math.min(0.9, gap || 0);
  const j = (jitter || 0);
  const mode = distortMode || 'off';
  const active = mode !== 'off' && distortAmount > 0;

  // Cols-family lines bend as a function of Y (position along nx2),
  // Rows-family as a function of X — only built/read when that family
  // of lines actually exists for the current Axis, same "don't evaluate
  // what nothing reads" discipline as every conditional-row control.
  const colSeedOffset = (seed || 0) * 0.137 + 3.3;
  const rowSeedOffset = (seed || 0) * 0.137 + 11.7;
  const distortCols = (active && (axis === 'cols' || axis === 'both'))
    ? (offY) => distortAt(offY, sx, inner.height, mode, distortAmount, distortFrequency, distortPhase, colSeedOffset) : null;
  const distortRows = (active && (axis === 'rows' || axis === 'both'))
    ? (offX) => distortAt(offX, sy, inner.width, mode, distortAmount, distortFrequency, distortPhase, rowSeedOffset) : null;
  const realPoint = makeRealPoint(cx, cy, nx1, nx2, distortCols, distortRows);

  // Straight (subdiv 1) whenever nothing bends this particular line —
  // exact byte-for-byte parity with the pre-Distortion straight-edge
  // construction, not just a visually-close approximation. Strips are
  // long (need real smoothness); Both-mode cell edges are short (a
  // coarser subdivision already reads as smooth at cell scale) —
  // capped lower there mainly to keep point counts sane on a large
  // Cols×Rows grid (many small cells × 4 edges each).
  const stripSubdiv = distortCols || distortRows ? 32 : 1;
  const cellSubdiv = distortCols || distortRows ? 6 : 1;

  const cells = [];
  const pushPoly = (rawPoly) => {
    const poly = clipToRect(rawPoly, inner);
    if (poly.length < 3) return;
    cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
  };

  // At Rotation 0 the division axis (nx1 for Columns, nx2 for Rows) is
  // exactly the canvas's own axis, so `cols`/`rows` strips of width sx/sy
  // span precisely inner.width/inner.height — no more, no less. Once
  // rotated, the rect's own footprint projected onto that axis grows past
  // that fixed span (up to the full diagonal near 45°), so building only
  // exactly `cols`/`rows` strips left two opposite corners uncovered —
  // reported live via a rotated Linear/Axis:Columns grid with visible
  // blank triangles at two corners. Fixed the same way Diamond/Hexagonal/
  // Triangular already cover their own rotation case: build the SAME
  // periodic strip field far enough past `cols`/`rows` to cover the
  // canvas diagonal regardless of angle, then let clipToRect discard
  // whatever falls outside. The `+2` beyond the rotation-only margin
  // covers Distortion's own lateral excursion (up to ~1 track width),
  // which can otherwise leave the same kind of corner gap Rotation did.
  const extra = (span) => Math.ceil(halfLen / span) + 3;

  if (axis === 'cols') {
    const pad = extra(sx);
    for (let i = -pad; i < cols + pad; i++) {
      const off = (i - (cols - 1) / 2) * sx + (j ? (rng() - 0.5) * 2 * j * sx : 0);
      const left = off - (sx / 2) * shrink, right = off + (sx / 2) * shrink;
      const poly = traceEdge(realPoint, left, -halfLen, left, halfLen, stripSubdiv)
        .concat(traceEdge(realPoint, right, halfLen, right, -halfLen, stripSubdiv));
      pushPoly(poly);
    }
  } else if (axis === 'rows') {
    const pad = extra(sy);
    for (let r = -pad; r < rows + pad; r++) {
      const off = (r - (rows - 1) / 2) * sy + (j ? (rng() - 0.5) * 2 * j * sy : 0);
      const top = off - (sy / 2) * shrink, bottom = off + (sy / 2) * shrink;
      // Traced in (offX,offY) space with offY constant — realPoint's own
      // nx1/nx2 mapping handles the axis swap, no separate code path.
      const poly = traceEdge(realPoint, -halfLen, top, halfLen, top, stripSubdiv)
        .concat(traceEdge(realPoint, halfLen, bottom, -halfLen, bottom, stripSubdiv));
      pushPoly(poly);
    }
  } else {
    const padC = extra(sx), padR = extra(sy);
    for (let r = -padR; r < rows + padR; r++) {
      for (let i = -padC; i < cols + padC; i++) {
        let offX = (i - (cols - 1) / 2) * sx, offY = (r - (rows - 1) / 2) * sy;
        if (j) { offX += (rng() - 0.5) * 2 * j * sx; offY += (rng() - 0.5) * 2 * j * sy; }
        const x0 = offX - (sx / 2) * shrink, x1 = offX + (sx / 2) * shrink;
        const y0 = offY - (sy / 2) * shrink, y1 = offY + (sy / 2) * shrink;
        const poly = traceEdge(realPoint, x0, y0, x1, y0, cellSubdiv)
          .concat(traceEdge(realPoint, x1, y0, x1, y1, cellSubdiv))
          .concat(traceEdge(realPoint, x1, y1, x0, y1, cellSubdiv))
          .concat(traceEdge(realPoint, x0, y1, x0, y0, cellSubdiv));
        pushPoly(poly);
      }
    }
  }

  return {
    grid: {
      type: 'linear',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, rows, axis, rotation, jitter, gap, seed, distortMode, distortAmount, distortFrequency, distortPhase },
      gap: 0,
    },
    cells,
  };
}
