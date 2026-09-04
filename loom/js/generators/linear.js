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

   `Crop` (Sine/Noise only) picks how the two OUTER division lines meet
   the canvas edge: `none` pushes them onto the frame so the edge cells
   fill solid; `low` lets them wave and clip, leaving open crescents
   where a wave dips inward; `full` turns each clipped-off crescent lobe
   into its own cell (`cols`/`rows` axes — on `both`, `full` == `low`).

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

// Area-weighted centroid (the real polygon centre of mass), NOT a plain
// vertex average — a distorted strip carries ~50 samples along each
// curved edge and only 2 along each straight cap, so an unweighted mean
// is dragged toward the wavy sides and the cell number lands off-centre
// (worst on the clipped edge cells). Falls back to the vertex mean when
// the weighted formula is unstable: a (near-)zero-area polygon, or a
// self-intersecting one (heavy Both-axis distortion can fold a cell over
// itself) whose shoelace centre lands outside the shape's own bounds.
function polygonCentroid(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let a = 0, cx = 0, cy = 0, mx = 0, my = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const cross = p[0] * q[1] - q[0] * p[1];
    a += cross;
    cx += (p[0] + q[0]) * cross;
    cy += (p[1] + q[1]) * cross;
    mx += p[0]; my += p[1];
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  }
  const mean = [mx / poly.length, my / poly.length];
  if (Math.abs(a) < 1e-6) return mean;
  const wx = cx / (3 * a), wy = cy / (3 * a);
  if (wx < minX || wx > maxX || wy < minY || wy > maxY) return mean;
  return [wx, wy];
}

// Shoelace area (unsigned). Used only to reject the zero-area sliver a
// boundary strip produces when gap:0 lands its edge exactly on the inner
// rect — clipToRect returns a degenerate ≥3-point polygon there, which
// would otherwise be counted (and numbered) as a real cell.
function polygonArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

// Collapse points that sit within `eps` of the one before them (wraparound
// included). clipToRect adds an intersection vertex right next to the real
// sample it clipped from — a sub-pixel stub that, left in, makes the
// render's spline overshoot into a beak where a curved edge meets the
// frame. A close pair is replaced by its MIDPOINT (not "keep the first"),
// so the result is independent of which direction the polygon was walked
// — the shared division line between two cells then dedupes to the exact
// same points from either side, and strokes once instead of as two
// nearly-coincident curves. eps stays ≤ ~1px, far below the gap between
// two genuine wave samples.
function dedupeClose(poly, eps) {
  if (!(eps > 0) || poly.length < 4) return poly;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], prev = out.length ? out[out.length - 1] : null;
    if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < eps) {
      out[out.length - 1] = [(p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2];
      continue;
    }
    out.push(p);
  }
  if (out.length > 3) {
    const first = out[0], last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < eps) {
      out[0] = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
      out.pop();
    }
  }
  return out.length >= 3 ? out : poly;
}

// Break a traced boundary-line polyline into the closed lobes that poke
// PAST `bound` on the `sign` side (+1 = coord above bound is inside,
// -1 = below); `axisIdx` selects x (0) or y (1). Each lobe is
// [entryCrossing, …insideRun…, exitCrossing] — the closing edge lies on
// `bound`. Crop:'full' feeds each lobe through pushPoly so the crescents
// clipped off the two outer division lines become their own cells.
function splitLobes(pts, axisIdx, bound, sign) {
  const inside = p => (p[axisIdx] - bound) * sign > 0;
  const cross = (a, b) => {
    const t = (bound - a[axisIdx]) / (b[axisIdx] - a[axisIdx]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const lobes = [];
  let run = null;
  for (let k = 1; k < pts.length; k++) {
    const prev = pts[k - 1], p = pts[k];
    const pIn = inside(p), prevIn = inside(prev);
    if (pIn && !prevIn) { run = [cross(prev, p), p]; }
    else if (pIn && prevIn) { if (run) run.push(p); else run = [prev, p]; }
    else if (!pIn && prevIn && run) { run.push(cross(prev, p)); lobes.push(run); run = null; }
  }
  if (run && run.length >= 3) lobes.push(run);
  return lobes.filter(l => l.length >= 3);
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
 *
 * Every division line bends by the same Dx at the same physical
 * position — the two outer boundary lines included, so the edge cells
 * stay full, even-width wavy strips like the rest (their bend is then
 * clipped to the canvas rect where it runs past the edge).
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
 * @param {{cols:number, rows:number, axis:'cols'|'rows'|'both', rotation:number, jitter:number, gap:number, seed:number, distortMode:'off'|'sine'|'noise', distortAmount:number, distortFrequency:number, distortPhase:number, distortCrop:'none'|'low'|'full'}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateLinear(params, inner) {
  const { cols, rows, axis, rotation, jitter, gap, seed, distortMode, distortAmount, distortFrequency, distortPhase, distortCrop } = params;
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
  // construction, not just a visually-close approximation.
  //
  // When a line DOES bend it's sampled and the renderer draws a real
  // corner-aware Catmull-Rom curve through those samples (cell.smooth ===
  // 'sharp'), so the sampling only has to be dense enough that the spline
  // doesn't wobble between knots — a flat ~22 segments per cycle, plus a
  // mild bump with amplitude (a steep high-Amount wave benefits from a
  // couple more knots near its zero crossings). NOT dense enough to fake a
  // curve out of straight chords — that's the renderer's job now.
  const anyDistort = !!(distortCols || distortRows);
  const freq = distortFrequency || 1;
  const ampMax = anyDistort ? distortAmount * Math.max(distortCols ? sx : 0, distortRows ? sy : 0) : 0;
  const segPerCycle = Math.min(48, 22 + Math.ceil(ampMax / 30));
  const stripCycles = anyDistort ? freq * 2 * halfLen / Math.min(inner.width, inner.height) : 0;
  const cellCycles = anyDistort ? freq * Math.max(sx / inner.width, sy / inner.height) : 0;
  const stripSubdiv = anyDistort ? Math.min(1024, Math.max(48, Math.ceil(stripCycles * segPerCycle))) : 1;
  const cellSubdiv = anyDistort ? Math.min(120, Math.max(6, Math.ceil(cellCycles * segPerCycle))) : 1;

  const cells = [];
  // A distorted cell is emitted with `smooth: 'sharp'` — the renderer runs
  // a CORNER-AWARE Catmull-Rom over its points (`catmullRomPathD`'s third
  // arg): the wavy edge runs become true curves, but the ~90° joins where
  // a wave meets the straight frame / a cap stay sharp, no overshoot past
  // the canvas. `'sharp'` (not `true`) so the four other distortion
  // generators, which pass no flag, keep the plain closed-loop spline.
  const subdivided = stripSubdiv > 1 || cellSubdiv > 1;
  const smoothFlag = subdivided ? 'sharp' : false;
  // A real cell is at least a small fraction of one nominal track cell;
  // a boundary sliver (gap:0, strip edge on the inner rect) clips to
  // ~0 area. This drops the sliver without touching any genuine cell.
  const minArea = 1e-4 * sx * sy;
  // Just enough to swallow the clip-vertex stub (the sub-pixel spike
  // clipToRect leaves next to the real sample it cut) — capped at ~1px so
  // it can never merge a genuine crossing point with its neighbour and
  // pull a lobe cell's seam off the main cell's edge.
  const stripStep = stripSubdiv > 1 ? (2 * halfLen) / stripSubdiv : Infinity;
  const cellStep = cellSubdiv > 1 ? Math.max(sx, sy) / cellSubdiv : Infinity;
  const mergeEps = subdivided ? Math.min(1, Math.min(stripStep, cellStep) * 0.34) : 0;
  const pushPoly = (rawPoly) => {
    const poly = dedupeClose(clipToRect(rawPoly, inner), mergeEps);
    if (poly.length < 3) return;
    if (polygonArea(poly) < minArea) return;
    cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly), smooth: smoothFlag });
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
  // whatever falls outside.
  //
  // That overscan is ONLY needed when the field is rotated (or jittered
  // off its lattice). At rotation 0 the strips 0…n-1 tile the inner rect
  // exactly, and building extra strips outside it just gave Distortion
  // spare lines to bend back into view as thin fragment cells at the two
  // edges (a distorted division line is *meant* to dip in and out — the
  // canvas edge simply isn't guaranteed fully covered there, which is
  // the honest look, not a fragment column).
  const rotated = ((rotation || 0) % 180) !== 0;

  // ── Crop — how the two OUTER division lines meet the canvas ──────────
  //   none: push them past the frame so clipToRect flattens them onto it;
  //         the edge cells fill solid (rectangular frame, no crescents).
  //   low : leave them as waves — clipToRect trims what falls outside,
  //         open crescents remain where a wave dips inward.
  //   full: as 'low', plus each clipped-off crescent LOBE becomes its own
  //         cell (cols/rows axes only — on 'both', 'full' behaves as 'low').
  // Ignored while rotated (the strips aren't frame-aligned then) and while
  // Distortion is Off (nothing waves).
  const crop = distortCrop || 'full';
  const OUT = halfLen * 4;
  // All crop handling is moot without a wave — with Distortion Off the
  // outer strips already sit exactly on the frame, so `off` keeps the
  // long-standing straight construction regardless of the crop value.
  const cropOut = active && crop === 'none' && !rotated;         // push outer edges past the frame
  const cropLobes = active && crop === 'full' && !rotated && axis !== 'both';  // crescents → own cells
  const extra = (span) => rotated ? Math.ceil(halfLen / span) + 3 : Math.max(j ? 1 : 0, cropLobes ? 1 : 0);

  // Crop:'full' crescent lobes are collected here and pushed AFTER the
  // main strips, so they take the trailing cell numbers.
  const crescents = [];

  if (axis === 'cols') {
    const pad = extra(sx);
    for (let i = -pad; i < cols + pad; i++) {
      const off = (i - (cols - 1) / 2) * sx + (j ? (rng() - 0.5) * 2 * j * sx : 0);
      let left = off - (sx / 2) * shrink, right = off + (sx / 2) * shrink;
      if (cropLobes && (i < 0 || i >= cols)) {
        // The crescent strip's INNER edge is the real boundary line.
        const edge = i < 0 ? right : left;
        splitLobes(traceEdge(realPoint, edge, -halfLen, edge, halfLen, stripSubdiv),
          0, inner.x + (i < 0 ? 0 : inner.width), i < 0 ? 1 : -1).forEach(l => crescents.push(l));
        continue;
      }
      if (cropOut && i === 0) left = -OUT;
      if (cropOut && i === cols - 1) right = OUT;
      const poly = traceEdge(realPoint, left, -halfLen, left, halfLen, stripSubdiv)
        .concat(traceEdge(realPoint, right, halfLen, right, -halfLen, stripSubdiv));
      pushPoly(poly);
    }
  } else if (axis === 'rows') {
    const pad = extra(sy);
    for (let r = -pad; r < rows + pad; r++) {
      const off = (r - (rows - 1) / 2) * sy + (j ? (rng() - 0.5) * 2 * j * sy : 0);
      let top = off - (sy / 2) * shrink, bottom = off + (sy / 2) * shrink;
      if (cropLobes && (r < 0 || r >= rows)) {
        const edge = r < 0 ? bottom : top;
        splitLobes(traceEdge(realPoint, -halfLen, edge, halfLen, edge, stripSubdiv),
          1, inner.y + (r < 0 ? 0 : inner.height), r < 0 ? 1 : -1).forEach(l => crescents.push(l));
        continue;
      }
      if (cropOut && r === 0) top = -OUT;
      if (cropOut && r === rows - 1) bottom = OUT;
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
        let x0 = offX - (sx / 2) * shrink, x1 = offX + (sx / 2) * shrink;
        let y0 = offY - (sy / 2) * shrink, y1 = offY + (sy / 2) * shrink;
        if (cropOut) {
          if (i === 0) x0 = -OUT;
          if (i === cols - 1) x1 = OUT;
          if (r === 0) y0 = -OUT;
          if (r === rows - 1) y1 = OUT;
        }
        const poly = traceEdge(realPoint, x0, y0, x1, y0, cellSubdiv)
          .concat(traceEdge(realPoint, x1, y0, x1, y1, cellSubdiv))
          .concat(traceEdge(realPoint, x1, y1, x0, y1, cellSubdiv))
          .concat(traceEdge(realPoint, x0, y1, x0, y0, cellSubdiv));
        pushPoly(poly);
      }
    }
  }

  crescents.forEach(pushPoly);

  return {
    grid: {
      type: 'linear',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, rows, axis, rotation, jitter, gap, seed, distortMode, distortAmount, distortFrequency, distortPhase, distortCrop: crop },
      gap: 0,
    },
    cells,
  };
}
