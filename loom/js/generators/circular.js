/* ─────────────────────────────────────────────────────────────
   Circular generator — sixth polygon-shaped generator: a genuine
   circle-packing grid, each CELL itself a circle (approximated as a
   many-sided polygon), not a rect grid clipped inside a circular
   boundary — the base shape has to actually be a circle, the same
   discipline every other tessellation generator here already follows
   (Hexagonal's cells are hexagons, Triangular's are triangles, Diamond's
   are squares; Circular's are circles).

   Packing lattice: centres on the SAME triangular/hex-packing arrangement
   as Hexagonal's own offset-row lattice — the mathematically densest way
   to pack circles in the plane, and not a coincidence that it reuses
   Hexagonal's construction: a hexagonal tiling's own lattice of CENTRES
   is exactly a circle-packing's centre lattice. The spacing constants
   differ from Hexagonal's, though: circles pack point-TANGENT (touching
   at a single point per neighbour), not edge-to-edge, so same-row centre
   spacing is the full diameter `d` (not `1.5r`), row spacing is
   `d·√3⁄2`, odd rows offset by `d/2`.

   **Honesty disclosure, the same kind of thing Sinusoidal's own header
   states for wavy boundaries**: circles cannot truly TESSELLATE the
   plane the way every other cell shape in this file set can — at Gap 0,
   circles touch their neighbours at a single point, not a shared edge,
   so real triangular voids remain between any three mutually-touching
   circles. That void is correct circle-packing geometry, not a rendering
   bug, and it's why `collectPolygonEdges`'s dedup finds nothing to merge
   here (no cell shares an actual edge segment with another) — every
   circle's own outline draws in full, independently.

   `Columns` sets the target diameter (`inner.width / cols`), matching
   every other polygon generator's density-not-count convention. `Gap`
   shrinks each circle's radius from the touching size — 0 leaves circles
   touching (maximum packing), higher values open visible space between
   them (a dot-grid/perforation look). Inner-rect clipping is needed,
   same as Hexagonal/Triangular/Diamond and for the same reason (a plain
   lattice loop has no built-in boundary) — boundary circles are trimmed
   into real partial-disc shapes by the canvas edge, the same
   `clipToRect` technique every sibling generator already uses.
   ───────────────────────────────────────────────────────────── */

function circlePoints(cx, cy, r, segments) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

// Sutherland–Hodgman clip of a convex polygon against an axis-aligned
// rect — same technique as every other polygon generator's own private
// copy (hexagonal.js/triangular.js/diamond.js's own clipToRect).
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

/**
 * @param {{cols:number, gap:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateCircular(params, inner) {
  const { cols, gap } = params;

  const d = inner.width / cols;   // diameter at Gap 0 (touching circles)
  const r = d / 2;
  const hSpacing = d, vSpacing = d * (Math.sqrt(3) / 2);
  const effR = r * (1 - gap);

  const colSteps = Math.ceil(inner.width / hSpacing) + 2;
  const rowSteps = Math.ceil(inner.height / vSpacing) + 2;

  const cells = [];
  for (let row = -1; row < rowSteps; row++) {
    for (let col = -1; col < colSteps; col++) {
      const cx = inner.x + col * hSpacing + (row % 2 !== 0 ? hSpacing / 2 : 0);
      const cy = inner.y + row * vSpacing;
      const poly = clipToRect(circlePoints(cx, cy, effR, 48), inner);
      if (poly.length < 3) continue;
      cells.push({ id: 'c' + cells.length, points: poly, centroid: polygonCentroid(poly) });
    }
  }

  return {
    grid: {
      type: 'circular',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { cols, gap },
      gap: 0,
    },
    cells,
  };
}
