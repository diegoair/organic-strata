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
   inscribed with margin left over). Both differences are real but
   orthogonal — a curved radius profile and an elliptical aspect ratio
   don't interact, so exposing both as their own controls on ONE
   generator (rather than three separate generators, two of which were
   provably reproducible from the third at specific settings) covers
   every case the three used to, with two more controls instead of two
   more generator entries. `Radius curve` 1 and `Stretch to canvas`
   off are the exact old Radial defaults; every other combination is a
   genuinely new, real option this merge adds rather than removes.

   `cellShape = 'polygon'` (Voronoi's own fork), each cell's `points`
   approximate its two arcs as short line segments — a real circular
   (or elliptical) arc has no exact polygon form, so it's subdivided
   finely enough (one vertex roughly every 10°) that the SVG/PNG export
   and the live preview both read as smoothly curved. No clipping
   against the inner rect is needed — by construction the whole field
   is built inside the outer ring, whether that ring is a circle
   inscribed in the inner rect (Stretch off) or an ellipse touching all
   four edges (Stretch on).

   `Radius curve`: ring boundary i sits at the normalised position
   `(i/rings)^curve` instead of the always-linear `i/rings` — curve>1
   bunches thin rings near the centre (a dartboard/iris-like density
   gradient), curve<1 bunches them toward the outer edge.

   `Inner radius`/`Gap`/`Start angle` — unchanged from Radial's own
   original meaning: 0 = true pie-slice wedges at the centre; Gap insets
   each wedge on both its radial and angular sides, same "shrink toward
   the cell's own middle" idea as every other polygon generator's Gap.
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
 * @param {{rings:number, sectors:number, innerRadiusFrac:number, gap:number, startAngle:number, curve:number, stretch:boolean}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateRadial(params, inner) {
  const { rings, sectors, innerRadiusFrac, gap, startAngle, curve, stretch } = params;
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

  const cells = [];
  for (let i = 0; i < rings; i++) {
    const f0 = fracAt(i), f1 = fracAt(i + 1);
    const rGap = (gap || 0) * (f1 - f0) * 0.4;
    const f0g = Math.max(0, f0 + rGap), f1g = Math.max(f0g, f1 - rGap);
    for (let j = 0; j < sectors; j++) {
      const a0 = start + j * sectorAngle, a1 = a0 + sectorAngle;
      const aGap = (gap || 0) * sectorAngle * 0.4;
      const a0g = a0 + aGap, a1g = a1 - aGap;

      const outer = arcPoints(cx, cy, outerRx * f1g, outerRy * f1g, a0g, a1g);
      const innerArc = arcPoints(cx, cy, outerRx * f0g, outerRy * f0g, a1g, a0g); // reversed, closes the loop
      const poly = outer.concat(innerArc);
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'radial',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { rings, sectors, innerRadiusFrac, gap, startAngle, curve, stretch },
      gap: 0,
    },
    cells,
  };
}
