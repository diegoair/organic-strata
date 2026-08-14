/* ─────────────────────────────────────────────────────────────
   Elliptical generator — Radial's other sibling: concentric rings ×
   angular sectors again, but scaled independently on x/y to the inner
   rect's OWN aspect ratio (rx = inner.width/2, ry = inner.height/2)
   instead of the single radius Radial uses (min(width,height)/2,
   inscribed in a circle with real leftover canvas on the long axis).
   The outer ring here touches all four edges of the canvas at its own
   cardinal points — a genuine "target" grid that fills the full
   rectangle, not a circle sitting inside it with margin space Radial
   deliberately leaves alone.

   Same wedge/arc/donut-hole/Gap construction as radial.js (its own
   structural twin, same as polar.js) — the only change is every radius
   becomes an independent (rx, ry) pair rather than one scalar r, so a
   "circle" of fraction `f` becomes the ellipse (f·rx·cosθ, f·ry·sinθ).
   ───────────────────────────────────────────────────────────── */

function arcPoints(cx, cy, rx, ry, a0, a1) {
  const span = a1 - a0;
  const steps = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 18)));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (span * i) / steps;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

/**
 * @param {{rings:number, sectors:number, innerRadiusFrac:number, gap:number, startAngle:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateElliptical(params, inner) {
  const { rings, sectors, innerRadiusFrac, gap, startAngle } = params;
  const cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  const outerRx = inner.width / 2, outerRy = inner.height / 2;
  const innerFrac = innerRadiusFrac || 0;
  const sectorAngle = (2 * Math.PI) / sectors;
  const start = (startAngle || 0) * (Math.PI / 180);

  const cells = [];
  for (let i = 0; i < rings; i++) {
    const f0 = innerFrac + (i / rings) * (1 - innerFrac);
    const f1 = innerFrac + ((i + 1) / rings) * (1 - innerFrac);
    const fGap = (gap || 0) * (f1 - f0) * 0.4;
    const f0g = Math.max(0, f0 + fGap), f1g = Math.max(f0g, f1 - fGap);
    for (let j = 0; j < sectors; j++) {
      const a0 = start + j * sectorAngle, a1 = a0 + sectorAngle;
      const aGap = (gap || 0) * sectorAngle * 0.4;
      const a0g = a0 + aGap, a1g = a1 - aGap;

      const outer = arcPoints(cx, cy, outerRx * f1g, outerRy * f1g, a0g, a1g);
      const innerArc = arcPoints(cx, cy, outerRx * f0g, outerRy * f0g, a1g, a0g);
      const poly = outer.concat(innerArc);
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'elliptical',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { rings, sectors, innerRadiusFrac, gap, startAngle },
      gap: 0,
    },
    cells,
  };
}
