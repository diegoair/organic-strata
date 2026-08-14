/* ─────────────────────────────────────────────────────────────
   Polar generator — Radial's own direct sibling (identical rings ×
   sectors, curved ring-sector wedge cells, inscribed-circle boundary —
   registry.js already calls Radial "true polar coordinates"), with one
   real addition Radial doesn't have: `Radius curve`, a power exponent
   controlling how ring THICKNESS varies from centre to edge. Radial's
   own ring spacing is always linear (equal thickness); Polar remaps the
   normalised ring index through `t^curve` before scaling it into a
   radius, so curve>1 bunches thin rings near the centre (a dartboard/
   iris-like density gradient) and curve<1 bunches them near the outer
   edge — a genuine non-uniform-ring case neither Radial nor any other
   generator here can produce. curve=1 reproduces Radial's own linear
   spacing exactly (verified: identical ring boundaries at curve=1).

   Same arc-subdivision, inner-radius-donut-hole, and Gap conventions as
   radial.js — this file is deliberately built as its structural twin
   rather than re-deriving the wedge/arc geometry from scratch.
   ───────────────────────────────────────────────────────────── */

function arcPoints(cx, cy, r, a0, a1) {
  const span = a1 - a0;
  const steps = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 18)));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (span * i) / steps;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

/**
 * @param {{rings:number, sectors:number, innerRadiusFrac:number, gap:number, startAngle:number, curve:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generatePolar(params, inner) {
  const { rings, sectors, innerRadiusFrac, gap, startAngle, curve } = params;
  const cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  const outerRadius = Math.min(inner.width, inner.height) / 2;
  const innerRadius = outerRadius * innerRadiusFrac;
  const pow = curve || 1;
  // Ring boundary radii at the curved normalised positions 0..1 — curve=1
  // gives t_i = i/rings exactly, the same linear spacing radial.js's own
  // fixed `ringWidth` step produces.
  const radiusAt = i => innerRadius + Math.pow(i / rings, pow) * (outerRadius - innerRadius);
  const sectorAngle = (2 * Math.PI) / sectors;
  const start = (startAngle || 0) * (Math.PI / 180);

  const cells = [];
  for (let i = 0; i < rings; i++) {
    const r0 = radiusAt(i), r1 = radiusAt(i + 1);
    const ringWidth = r1 - r0;
    const rGap = (gap || 0) * ringWidth * 0.4;
    const r0g = Math.max(0, r0 + rGap), r1g = Math.max(r0g, r1 - rGap);
    for (let j = 0; j < sectors; j++) {
      const a0 = start + j * sectorAngle, a1 = a0 + sectorAngle;
      const aGap = (gap || 0) * sectorAngle * 0.4;
      const a0g = a0 + aGap, a1g = a1 - aGap;

      const outer = arcPoints(cx, cy, r1g, a0g, a1g);
      const innerArc = arcPoints(cx, cy, r0g, a1g, a0g);
      const poly = outer.concat(innerArc);
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'polar',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { rings, sectors, innerRadiusFrac, gap, startAngle, curve },
      gap: 0,
    },
    cells,
  };
}
