/* ─────────────────────────────────────────────────────────────
   Angular generator — seventh polygon-shaped generator: pure radiating
   sectors from a point, with NO ring subdivision — the direct sibling
   Radial's own header already implies but doesn't build (Radial is
   rings × sectors, bounded inside a circle inscribed in the inner rect).
   Angular is sectors alone, each wedge a straight-edged triangle from
   the centre out far enough to exceed the canvas, then clipped to the
   inner RECT (not a circle) — so wedges reach every edge and corner of
   the canvas, a full sunburst/fan filling the rectangle edge-to-edge,
   which Radial's own circular boundary can't produce.

   `Center X`/`Center Y` (0–1, fraction of the inner rect) let the fan's
   own apex move off-centre — at the canvas edge or a corner this reads
   as a classic dazzle/op-art radiating-lines composition instead of a
   centred sunburst. `Gap` insets each wedge angularly on both edges
   (same "shrink toward the cell's own middle" idea as every other
   polygon generator's Gap, just one-dimensional here since a wedge has
   only an angular boundary to inset, unlike Radial's own two-axis Gap).

   `Distortion` (Off/Sine/Noise) bends each spoke's own ANGLE as a
   function of RADIUS — a twisting-fan / pinwheel wobble along the
   spoke's length, rather than the spoke staying a straight ray. Every
   spoke index has ONE shared distortion function (a function of radius
   alone), so a wedge's own Gap inset (±aGap around the spoke's nominal
   angle) is the only thing that can make two neighbours' edges differ
   — at Gap 0 they collapse onto the exact same nominal spoke angle
   plus the exact same distortion at every radius, so they stay
   coincident with no seam-matching special case, the identical
   argument linear.js's own header makes in full for its own division
   lines.
   ───────────────────────────────────────────────────────────── */

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

function distortAt(radius, reach, mode, amount, freq, phase, seedOffset) {
  if (mode === 'off' || !amount) return 0;
  const t = radius / reach;
  if (mode === 'sine') return amount * Math.sin(t * freq * 2 * Math.PI + phase);
  const n = Organica.noise.fbm(t * freq, seedOffset);
  return amount * (n * 2 - 1);
}

/**
 * @param {{sectors:number, startAngle:number, centerX:number, centerY:number, gap:number, distortMode:'off'|'sine'|'noise', distortAmount:number, distortFrequency:number, distortPhase:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateAngular(params, inner) {
  const { sectors, startAngle, centerX, centerY, gap, distortMode, distortAmount, distortFrequency, distortPhase } = params;
  const cx = inner.x + inner.width * (centerX != null ? centerX : 0.5);
  const cy = inner.y + inner.height * (centerY != null ? centerY : 0.5);
  // Far enough that every wedge edge exceeds the rect in every direction
  // before clipping — the corner-to-apex distance is the worst case.
  const reach = Math.hypot(inner.width, inner.height) * 2 +
    Math.hypot(Math.max(cx - inner.x, inner.x + inner.width - cx), Math.max(cy - inner.y, inner.y + inner.height - cy));
  const sectorAngle = (2 * Math.PI) / sectors;
  const start = (startAngle || 0) * (Math.PI / 180);

  const mode = distortMode || 'off';
  const active = mode !== 'off' && distortAmount > 0;
  const seedOffset = (params.seed || 0) * 0.137 + 4.4;
  // Max ~0.4 radians (~23°) of twist per unit Amount — angles, not
  // lengths, so the scale is a fixed constant rather than "a fraction
  // of a track", same idea, different unit.
  const swing = 0.4;
  // `reach` is deliberately huge (needs to clear the canvas at any
  // apex position, any angle) — normalising Frequency against it, and
  // sampling uniformly out to it, both undersample the part of the
  // spoke anyone can actually SEE: a real bug caught live, reproduced
  // as small self-crossing loops near the centre even at the default
  // Amount, because most of `reach` is empty space far past the
  // canvas edge where nothing is rendered, so a handful of `subdiv`
  // points spread across all of it left only 2–3 samples inside the
  // canvas itself for Frequency's own cycles to actually play out —
  // classic aliasing, not an amplitude problem (turning Amount down
  // didn't fix it, confirming the diagnosis before committing to it).
  // Fixed by normalising AND sampling against the true visible radius
  // (centre to the farthest canvas corner) instead, then a single
  // straight extension out to `reach` only for off-canvas clip
  // coverage, where no one will ever see the difference.
  const visibleRadius = Math.max(
    Math.hypot(inner.x - cx, inner.y - cy), Math.hypot(inner.x + inner.width - cx, inner.y - cy),
    Math.hypot(inner.x - cx, inner.y + inner.height - cy), Math.hypot(inner.x + inner.width - cx, inner.y + inner.height - cy)
  );
  const distortFn = active ? (r) => swing * distortAt(r, visibleRadius, mode, distortAmount, distortFrequency, distortPhase, seedOffset) : null;
  const subdiv = active ? 24 : 1;

  function spokePoints(angleBase) {
    const pts = [];
    for (let k = 0; k <= subdiv; k++) {
      const r = visibleRadius * k / subdiv;
      const a = angleBase + (distortFn ? distortFn(r) : 0);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    if (active) {
      const lastAngle = angleBase + distortFn(visibleRadius);
      pts.push([cx + reach * Math.cos(lastAngle), cy + reach * Math.sin(lastAngle)]);
    }
    return pts;
  }

  const cells = [];
  for (let j = 0; j < sectors; j++) {
    const a0 = start + j * sectorAngle, a1 = a0 + sectorAngle;
    const aGap = (gap || 0) * sectorAngle * 0.4;
    const leftPts = spokePoints(a0 + aGap);
    const rightPts = spokePoints(a1 - aGap);
    const poly0 = leftPts.concat(rightPts.slice(1).reverse());
    const poly = clipToRect(poly0, inner);
    if (poly.length < 3) continue;
    cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly), smooth: subdiv > 1 });
  }

  return {
    grid: {
      type: 'angular',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { sectors, startAngle, centerX, centerY, gap, distortMode, distortAmount, distortFrequency, distortPhase },
      gap: 0,
    },
    cells,
  };
}
