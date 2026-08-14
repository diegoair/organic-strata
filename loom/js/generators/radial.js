/* ─────────────────────────────────────────────────────────────
   Radial generator — third POLYGON-shaped generator, and a genuinely
   different structure from both families that came before it: Bento/
   Sinusoidal are a Columns×Rows track lattice; Voronoi/Hexagonal are a
   tessellation of the SAME repeated cell shape. Radial is real polar
   coordinates — concentric Rings crossed with angular Sectors, each cell
   a ring-sector wedge (an annular quadrilateral with two straight radial
   edges and two curved arc edges), the dartboard/sunburst/mandala
   structure no rect-lattice or polygon-tessellation generator can honestly
   produce.

   `cellShape = 'polygon'` again (Voronoi's own fork), but each cell's
   `points` approximate its two arcs as short line segments rather than
   the 3–6 straight edges every other polygon generator emits — a real
   circular arc has no exact polygon form, so the arc is subdivided finely
   enough (one vertex roughly every 10°) that the SVG/PNG export and the
   live preview both read as smoothly curved at any reasonable Rings ×
   Sectors count, not faceted.

   No clipping against the inner rect is needed here, unlike Voronoi/
   Hexagonal — by construction the whole radial field is built inside a
   circle already inscribed within the inner rect (`outerRadius =
   min(inner.width, inner.height) / 2`), so every wedge is guaranteed to
   land fully inside it. Simpler than the other two polygon generators,
   not a shortcut: there is genuinely no boundary case to handle.

   `Inner radius` (0–0.8, fraction of the outer radius) is the classic
   dartboard/donut-chart control — 0 gives true pie-slice wedges at the
   innermost ring (the "inner arc" degenerates to a single point at the
   centre, handled as a real, not special-cased, zero-radius arc: same
   arc-point code, just repeated points at (cx, cy), which draw as
   zero-length segments and cost nothing). `Gap` insets each wedge inward
   on BOTH its radial and angular sides before the arc is built — same
   "shrink toward the cell's own middle" idea as Hexagonal's own Gap, just
   with two independent inset amounts (ring-width-relative radially,
   sector-angle-relative angularly) since a wedge has two genuinely
   different kinds of edge. At Gap 0 this tiles edge-to-edge exactly, the
   same "0 = true no-op" discipline as every other Organica control.
   ───────────────────────────────────────────────────────────── */

// Points along a circular arc from `a0` to `a1` (radians) at radius `r`,
// centred on (cx,cy) — subdivided finely enough (~10° per segment) that
// the polygon reads as a smooth curve, not a facet, at any wedge size.
// A near-zero radius (the innermost ring at Inner radius 0) still walks
// this same path rather than being special-cased — every point just
// lands at (cx, cy), a real (if degenerate) arc.
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
 * @param {{rings:number, sectors:number, innerRadiusFrac:number, gap:number, startAngle:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateRadial(params, inner) {
  const { rings, sectors, innerRadiusFrac, gap, startAngle } = params;
  const cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  const outerRadius = Math.min(inner.width, inner.height) / 2;
  const innerRadius = outerRadius * innerRadiusFrac;
  const ringWidth = (outerRadius - innerRadius) / rings;
  const sectorAngle = (2 * Math.PI) / sectors;
  const start = (startAngle || 0) * (Math.PI / 180);

  const cells = [];
  for (let i = 0; i < rings; i++) {
    const r0 = innerRadius + i * ringWidth, r1 = r0 + ringWidth;
    const rGap = gap * ringWidth * 0.4;
    const r0g = Math.max(0, r0 + rGap), r1g = Math.max(r0g, r1 - rGap);
    for (let j = 0; j < sectors; j++) {
      const a0 = start + j * sectorAngle, a1 = a0 + sectorAngle;
      const aGap = gap * sectorAngle * 0.4;
      const a0g = a0 + aGap, a1g = a1 - aGap;

      const outer = arcPoints(cx, cy, r1g, a0g, a1g);
      const innerArc = arcPoints(cx, cy, r0g, a1g, a0g); // reversed, closes the loop
      const poly = outer.concat(innerArc);
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'radial',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { rings, sectors, innerRadiusFrac, gap, startAngle },
      gap: 0,
    },
    cells,
  };
}
