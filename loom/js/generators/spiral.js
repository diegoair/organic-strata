/* ─────────────────────────────────────────────────────────────
   Spiral generator — the classic whirling-rectangle subdivision: cut a
   strip off the current rect in a rotating direction (right, down,
   left, up, right, …), `Ratio` of the current rect's own relevant side,
   `Count` times, with the final leftover rect as the last cell. At
   `Ratio ≈ 0.618` (or its complement 0.382) this is the literal golden-
   rectangle/Fibonacci spiral construction — the built-in "Golden Ratio"
   preset (see main.js's own BUILTIN_GRID_PRESETS) is exactly this
   generator at that ratio, not a separate generator: the golden spiral
   IS a spiral subdivision, not a distinct topology needing its own code.

   Direction rotates strip-cut → strip-cut, always 90° clockwise from
   the previous cut, which is what makes the sequence of shrinking
   rects visually whirl around a common centre rather than just
   stacking in one direction (that would be Column/Row, already built).
   Same "resolved rect as a 4-point polygon" trick as Masonry/Fractal/
   Recursive/Diagonal — no track lattice applies here either.
   ───────────────────────────────────────────────────────────── */

function rectPoly(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
function polygonCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

/**
 * @param {{count:number, ratio:number, gap:number}} params
 * @param {{x:number, y:number, width:number, height:number}} inner
 */
export function generateSpiral(params, inner) {
  const { count, ratio, gap } = params;
  const r = Math.min(0.85, Math.max(0.15, ratio));
  let rect = { x: inner.x, y: inner.y, width: inner.width, height: inner.height };
  const leaves = [];
  // 0=right, 1=down, 2=left, 3=up — rotates 90° clockwise every cut.
  for (let i = 0; i < count - 1 && rect.width > 1 && rect.height > 1; i++) {
    const dir = i % 4;
    let cut, rest;
    if (dir === 0) {
      const w = rect.width * r;
      cut = { x: rect.x, y: rect.y, width: w, height: rect.height };
      rest = { x: rect.x + w, y: rect.y, width: rect.width - w, height: rect.height };
    } else if (dir === 1) {
      const h = rect.height * r;
      cut = { x: rect.x, y: rect.y, width: rect.width, height: h };
      rest = { x: rect.x, y: rect.y + h, width: rect.width, height: rect.height - h };
    } else if (dir === 2) {
      const w = rect.width * r;
      cut = { x: rect.x + rect.width - w, y: rect.y, width: w, height: rect.height };
      rest = { x: rect.x, y: rect.y, width: rect.width - w, height: rect.height };
    } else {
      const h = rect.height * r;
      cut = { x: rect.x, y: rect.y + rect.height - h, width: rect.width, height: h };
      rest = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - h };
    }
    leaves.push(cut);
    rect = rest;
  }
  leaves.push(rect);

  const inset = (gap || 0) / 2;
  const cells = leaves.map((rr, i) => {
    const poly = rectPoly(rr.x + inset, rr.y + inset, Math.max(0, rr.width - 2 * inset), Math.max(0, rr.height - 2 * inset));
    return { id: 'c' + i, points: poly, centroid: polygonCentroid(poly) };
  });

  return {
    grid: {
      type: 'spiral',
      solver: 'geometric',
      cellShape: 'polygon',
      params: { count, ratio, gap },
      gap: 0,
    },
    cells,
  };
}
