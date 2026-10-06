// Flexible Visual System · engine/01-geometry — the engine part of 01-geometry.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically by scripts/fvs-engine.mjs. Map: docs/FVS.md §Architecture.
import { hooks } from '../hooks.js';
import {
  state
} from './00-core.js';
// ── Seed ──
// Each type exposes geometry(params) → { d, normTx, normTy, normScale }.
// d is an SVG path in a normalized 0..100 box; normTx/normTy/normScale
// default to identity (0,0,1) for hand-authored shapes (triangle, the 4
// arcs) already drawn directly in that box. They exist for uploaded
// custom shapes (see extractSeedFromSVG below), whose own bbox-fit
// transform lives here as a SEPARATE nested transform layer rather than
// being baked into `d` — baking it in would mean parsing and rewriting
// every coordinate token in arbitrary path data (arcs/beziers/etc, too
// many shapes to safely regex-transform); one more <g transform> /
// ctx.translate+scale nesting is trivial and handles any path losslessly.
//
// Geometry + grid cell-placement math (triangle/arc/arc-truchet,
// resolveGridCells/resolveCellPlacement/frameSize/median) moved to
// shared/shapes.js at Trellis's arrival (2nd consumer) — aliased here so
// every call site below is unchanged. cellColRow (below, near SYMBOL_RULES)
// keeps a thin local wrapper instead of a bare alias, since its shared
// version takes an explicit rawCells arg where the old inline copy reached
// into state.symbolGrid directly.
export const { triangleGeometry, arcGeometry, arcPathD, arcTruchetGeometry, arcTruchetPathD,
  wedgeGeometry, polygonGeometry, starGeometry,
  roundedRectGeometry, chevronGeometry, crossGeometry, lensGeometry,
  circleGeometry, segmentGeometry, dropGeometry, blobGeometry,
  resolveGridCells, resolveCellPlacement, frameSize, frameDims, median } = Organica.shapes;
// ── Cell shape (test, Oct 6, 2026) — the cell the Element is drawn for. Square is today's box and changes
// nothing (no `cellShape` key on the seed → every geometry below is the untouched original). Circle / Triangle /
// Hexagon: Arc (triangle) and Arc truchet (hexagon) take their own geometry; every other shape is cut to the
// cell's outline. The outlines + turns live in Organica.shapes.CELL_SHAPES, centred on the box centre (50,50).
export const CELL_SHAPES = Organica.shapes.CELL_SHAPES;
// Which outlines each cell shape can fill; a reason for the ones it can't.
export const CELL_OUTLINES = { circle: ['hexagon', 'triangle', 'diamond', 'square'], hexagon: ['hexagon', 'triangle', 'diamond', 'square'], triangle: ['hexagon', 'triangle', 'diamond'] };
export const OUTLINE_GATE = { triangle: { square: 'Square needs circle or hexagon cells' } };
export const cellShapeOf = seed => (seed && seed.cellShape && CELL_SHAPES[seed.cellShape]) ? seed.cellShape : 'square';
export const withCellShape = seed => (state.cellShape === 'square' || !seed) ? seed : { ...seed, cellShape: state.cellShape };
// A shape on a non-square cell is fitted WHOLE inside it (Diego, Oct 6, 2026 — it used to be cut to the
// outline, so a Circle on a triangle became a solid triangle and a seed lost its ends). Its box centre goes on
// the cell's centre (50,50), and it takes the largest scale at which every outline point is inside: the cells
// are convex, so per edge (outward normal n, offset e) and point q (from the box centre) s ≤ (e − n·c) / (n·q).
export const _cellFitCache = new Map();
export function fitGeoToCell(geo, shape) {
  if (!geo || !geo.d) return geo;
  const key = shape + '|' + (geo.fillRule || '') + '|' + geo.normTx + ',' + geo.normTy + ',' + geo.normScale + '|' + geo.d;
  if (_cellFitCache.has(key)) return _cellFitCache.get(key);
  let out = geo;
  try {
    const scope = splitPaperScope();
    const shapeP = importAsPaperShape(scope, geo.d, geo.fillRule);
    shapeP.scale(geo.normScale, new scope.Point(0, 0));
    shapeP.translate(new scope.Point(geo.normTx * geo.normScale, geo.normTy * geo.normScale));
    const flat = shapeP.clone({ insert: false });
    flat.flatten(0.25);
    const pts = (flat.children && flat.children.length ? flat.children : [flat]).flatMap(ch => (ch.segments || []).map(sg => [sg.point.x, sg.point.y]));
    flat.remove();
    const bb = shapeP.bounds, cb = [bb.center.x, bb.center.y], c = [50, 50], poly = CELL_SHAPES[shape].poly;
    let sc = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      let n = [b[1] - a[1], a[0] - b[0]];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (n[0] * (mid[0] - c[0]) + n[1] * (mid[1] - c[1]) < 0) n = [-n[0], -n[1]];   // outward
      const e = n[0] * a[0] + n[1] * a[1], room = e - (n[0] * c[0] + n[1] * c[1]);
      for (const p of pts) { const dq = n[0] * (p[0] - cb[0]) + n[1] * (p[1] - cb[1]); if (dq > 1e-9) sc = Math.min(sc, room / dq); }
    }
    if (isFinite(sc) && sc > 0) {
      shapeP.translate(new scope.Point(-cb[0], -cb[1]));
      shapeP.scale(sc, new scope.Point(0, 0));
      shapeP.translate(new scope.Point(c[0], c[1]));
      out = { d: shapeP.pathData, normTx: 0, normTy: 0, normScale: 1, fillRule: geo.fillRule || null };
    }
    shapeP.remove();
  } catch (e) { out = geo; }
  if (_cellFitCache.size > 400) _cellFitCache.clear();
  _cellFitCache.set(key, out);
  return out;
}
// The turns that map a cell shape onto itself, as the Element strip shows them: [rotation, flipH, flipV, label].
export function cellShapeStates(shape) {
  if (shape === 'triangle') return [[0, false, false, '0°'], [120, false, false, '120°'], [240, false, false, '240°'], [0, true, false, 'Mirror']];
  if (shape === 'hexagon') return [0, 60, 120, 180, 240, 300].map(r => [r, false, false, r + '°']).concat([[0, true, false, 'Flip H'], [0, false, true, 'Flip V']]);
  return hooks.SEED_PREVIEW_STATES_SQUARE;
}
// The rotation a polygon cell sits at, relative to the cell shape drawn upright: the turn (in [0, step)) that
// brings the local outline's first corner onto one of the cell's corners. Circles: 0.
export function polygonCellTurn(shape, pts, cx, cy) {
  if (shape === 'circle' || shape === 'square') return 0;
  const cs = CELL_SHAPES[shape], [lx, ly] = cs.poly[cs.poly.length === 3 ? 2 : 0];
  const ref = Math.atan2(ly - 50, lx - 50) * 180 / Math.PI;
  const a = Math.atan2(pts[0][1] - cy, pts[0][0] - cx) * 180 / Math.PI;
  const k = 360 / pts.length;   // the cell's own corner spacing (120 / 60)
  return Math.round((((a - ref) % k) + k) % k * 1000) / 1000;
}
// Component lattices on a non-square cell shape: [{points, centroid, baseRot, ring}], polygon cells, each sized
// so the cell shape's outline fills it. `w` = a cell's width (the Cell size slider), `n` = rings (1–4):
// circle / hexagon = a centre cell plus n−1 rings (1, 7, 19, 37); triangle = n rings of triangles around one
// shared corner — a hexagon of triangles (6, 24, 54, 96), so Radial always has a real centre.
export const latticeRings = l => Math.max(1, Math.min(4, l.rings != null ? +l.rings : ({ '1': 1, '3': 1, '4': 1, '6': 1, '7': 2 })[l.key] || 1));   // early test saves kept a cell count
export function cellLatticeCells(shape, n, w, outline = 'hexagon') {
  const out = [], u = a => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)];
  const add = (points, ring) => {
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length, cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    out.push({ id: 'c' + out.length, number: out.length + 1, points, centroid: [cx, cy], baseRot: polygonCellTurn(shape, points, cx, cy), ring });
  };
  if (shape === 'circle' || shape === 'hexagon') {
    const R = w / 2, sides = shape === 'circle' ? 48 : 6, m = n - 1;
    const cell = ([x, y], ring) => add(Array.from({ length: sides }, (_, k) => { const [c, s] = u(360 * k / sides); return [x + R * c, y + R * s]; }), ring);
    // hexagons: flat-top axial layout; circles: touching discs (centres 2R apart) on the same lattice
    const pos = (q, r) => shape === 'hexagon' ? [1.5 * R * q, Math.sqrt(3) * R * (r + q / 2)] : [2 * R * (q + r / 2), Math.sqrt(3) * R * r];
    if (outline === 'triangle') { for (let q = 0; q < n; q++) for (let r = 0; r < n - q; r++) cell(shape === 'hexagon' ? pos(q, r) : pos(q, n - 1 - q - r), 0); }
    else if (outline === 'diamond') { for (let q = 0; q < n; q++) for (let r = 0; r < n; r++) cell(pos(q, r), 0); }
    else if (outline === 'square') {   // hexagons in offset columns; circles in square packing
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cell(shape === 'hexagon' ? [1.5 * R * i, Math.sqrt(3) * R * (j + (i % 2) / 2)] : [2 * R * i, 2 * R * j], 0);
    } else for (let q = -m; q <= m; q++) for (let r = Math.max(-m, -q - m); r <= Math.min(m, -q + m); r++) cell(pos(q, r), (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2);
  } else if (shape === 'triangle') {
    const S = w, h = S * Math.sqrt(3) / 2;
    // one row of alternating up / down triangles: `cells` of them, from x = left, the first one up
    const row = (j, left, cells) => { for (let i = 0; i < cells; i++) {
      const x0 = left + i * S / 2, y0 = j * h, y1 = y0 + h;
      add(i % 2 === 0 ? [[x0, y1], [x0 + S, y1], [x0 + S / 2, y0]] : [[x0, y0], [x0 + S, y0], [x0 + S / 2, y1]], 0);
    } };
    if (outline === 'triangle') { for (let j = 0; j < n; j++) row(j, (n - 1 - j) * S / 2, 2 * j + 1); }   // side n, apex up: n² cells
    else if (outline === 'diamond') { for (let j = 0; j < n; j++) row(j, (n - 1 - j) * S / 2, 2 * n); }   // side n: 2n² cells
    else {   // n rings of triangles around one shared corner — a hexagon of triangles (6, 24, 54, 96)
      const V = (a, b) => [a * S + b * S / 2, b * h], Rh = n * S;
      const inside = ([x, y]) => Math.abs(y) <= Rh * Math.sqrt(3) / 2 + 1e-6 && Math.sqrt(3) * Math.abs(x) + Math.abs(y) <= Math.sqrt(3) * Rh + 1e-6;
      for (let b = -n; b < n; b++) for (let a = -2 * n; a <= 2 * n; a++) [[V(a, b), V(a + 1, b), V(a, b + 1)], [V(a + 1, b), V(a + 1, b + 1), V(a, b + 1)]].forEach(pts => {
        const c = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
        if (inside(c)) add(pts, 0);
      });
    }
    out.sort((p, q) => p.centroid[1] - q.centroid[1] || p.centroid[0] - q.centroid[0]).forEach((c, i) => { c.id = 'c' + i; c.number = i + 1; });
  }
  return out;
}
// ── Inner seed: N nested copies of ANY Seed inside itself (Arc truchet's
// Count + Ratio, generalised). The copies are baked into the shape's own `d`
// so every renderer keeps consuming one path per cell; alternating ring / gap
// comes from fill-rule evenodd, set on the returned geometry ONLY when Count > 0
// (so every shape at Count 0 stays byte-identical). Container / Mask
// silhouettes ignore the rule on purpose — the union of the copies is the
// solid outline, which is the boundary you want.
export const _pathBBoxCache = new Map();
export function pathBBox(d) {
  if (_pathBBoxCache.has(d)) return _pathBBoxCache.get(d);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  let bb = null;
  try { const b = path.getBBox(); bb = { x: b.x, y: b.y, width: b.width, height: b.height }; } catch (e) { /* empty path */ }
  document.body.removeChild(svg);
  if (_pathBBoxCache.size > 200) _pathBBoxCache.clear();
  _pathBBoxCache.set(d, bb);
  return bb;
}
// Area centroid of a path's filled region: a 24×24 isPointInFill sweep over its
// bbox (respects holes, works for any command set). Falls back to the bbox centre.
export const _pathCentroidCache = new Map();
export function pathCentroid(d, bb) {
  if (_pathCentroidCache.has(d)) return _pathCentroidCache.get(d);
  let c = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  try {
    const N = 24; let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const pt = svg.createSVGPoint();
      pt.x = bb.x + (i + 0.5) / N * bb.width; pt.y = bb.y + (j + 0.5) / N * bb.height;
      if (path.isPointInFill(pt)) { sx += pt.x; sy += pt.y; n++; }
    }
    if (n) c = { x: sx / n, y: sy / n };
  } catch (e) { /* keep bbox centre */ }
  document.body.removeChild(svg);
  if (_pathCentroidCache.size > 200) _pathCentroidCache.clear();
  _pathCentroidCache.set(d, c);
  return c;
}
export const INNER_APEX = {   // where the shape's pivot sits in its own d-space (before the norm fit)
  wedge: () => [50, 50],
  arc: p => p.arcPivot === 'center' ? [50, 50] : [0, 0],
};
// Segment in FVS is a FILLED BAR, not a hairline: the shared segmentGeometry()
// centre-lines (still a plain stroke, as Genesis draws them) are thickened here
// into closed ribbons `weight` wide (in the final 0..100 space, so Repeat/Rays
// never squash the thickness), butt ends unless `round`. Each ribbon is wound
// the same way (positive area), so overlaps (Rays, Lines) stay filled under
// nonzero instead of cancelling out. No Paper.js — pure maths, memoised.
export const SEG_WEIGHT_DEF = 8;
export const _segBarCache = new Map();
export function segmentBar(g, weight, round) {
  const key = g.d + '|' + g.normTx + '|' + g.normTy + '|' + g.normScale + '|' + weight + '|' + round;
  if (_segBarCache.has(key)) return _segBarCache.get(key);
  const hw = Math.max(0.05, weight / 2), R = v => Math.round(v * 1000) / 1000;
  const polys = g.d.split(/(?=M)/).map(sub => (sub.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number))
    .map(nums => { const pts = []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push([(nums[i] + g.normTx) * g.normScale, (nums[i + 1] + g.normTy) * g.normScale]); return pts; })
    .filter(pts => pts.length > 1);
  let d = '', x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (q, r) => { if (q[0] - r < x0) x0 = q[0] - r; if (q[0] + r > x1) x1 = q[0] + r; if (q[1] - r < y0) y0 = q[1] - r; if (q[1] + r > y1) y1 = q[1] + r; };
  for (let pts of polys) {
    pts = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
    const n = pts.length;
    if (n < 2) continue;
    const normals = pts.map((p, i) => {
      const n1 = i > 0 ? segNormal(pts[i - 1], p) : null, n2 = i < n - 1 ? segNormal(p, pts[i + 1]) : null;
      if (n1 && n2) { const m = unitVec([n1[0] + n2[0], n1[1] + n2[1]]); const c = Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]); return [m[0] / c, m[1] / c]; }   // miter, clamped
      return n1 || n2;
    });
    let left = pts.map((p, i) => [p[0] + normals[i][0] * hw, p[1] + normals[i][1] * hw]);
    let right = pts.map((p, i) => [p[0] - normals[i][0] * hw, p[1] - normals[i][1] * hw]);
    // signed area of left→(reversed)right; flip sides so every ribbon winds the same way
    const ring = left.concat(right.slice().reverse());
    let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) { [left, right] = [right, left]; }
    left.forEach(q => grow(q, 0)); right.forEach(q => grow(q, 0));
    if (round) { grow(pts[0], hw); grow(pts[n - 1], hw); }   // a round end bulges up to hw past its centre point
    const P = q => R(q[0]) + ',' + R(q[1]);
    const tanEnd = unitVec([pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]]);
    const tanStart = unitVec([pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]]);
    const arc = (c, from, to, dir) => capArc(c, from, to, dir).replace(/-?\d*\.?\d+(?:e-?\d+)?/g, m => String(R(+m)));
    let s = 'M ' + left.map(P).join(' L ');
    s += round ? ' ' + arc(pts[n - 1], left[n - 1], right[n - 1], tanEnd) : ' L ' + P(right[n - 1]);
    s += ' L ' + right.slice(0, n - 1).reverse().map(P).join(' L ');   // down to right[0] — a 2-point line needs it too (else a triangle)
    s += round ? ' ' + arc(pts[0], right[0], left[0], tanStart) : '';
    d += (d ? ' ' : '') + s + ' Z';
  }
  // The thickness can push past the canvas (Rays turning a full grid, round ends
  // on a full-length bar): fit the finished bar back in, like overflowNorm does.
  let out = { d, normTx: 0, normTy: 0, normScale: 1 };
  if (d && (x0 < -0.01 || y0 < -0.01 || x1 > 100.01 || y1 > 100.01)) {
    const sc = Math.min(1, 100 / Math.max(x1 - x0, 1e-6), 100 / Math.max(y1 - y0, 1e-6));
    out = { d, normTx: 50 / sc - (x0 + x1) / 2, normTy: 50 / sc - (y0 + y1) / 2, normScale: sc };
  }
  if (_segBarCache.size > 200) _segBarCache.clear();
  _segBarCache.set(key, out);
  return out;
}
export const INNER_UNSUPPORTED = new Set(['segment', 'arctruchet']);   // open / already multi-ring — copies would cross, not nest
export function withInnerCopies(geo, p, apex) {
  const n = Math.round((p && p.innerCount) || 0);
  if (!(n > 0) || !geo || !geo.d) return geo;
  const ratio = Math.min(0.95, Math.max(0.1, (p.innerRatio == null ? 70 : p.innerRatio) / 100));
  const bb = pathBBox(geo.d);
  if (!bb) return geo;
  const ap = p.innerAnchor === 'apex' && apex ? apex(p) : null;   // Arc / Wedge pivot in the shape's own d-space
  const ctr = ap ? { x: ap[0], y: ap[1] } : p.innerAnchor === 'incentre' ? inscribedCircle(geo) : p.innerAnchor === 'centroid' || p.innerAnchor === 'apex' ? pathCentroid(geo.d, bb) : { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  const cx = ctr.x, cy = ctr.y;
  let d = geo.d;
  for (let k = 1; k <= n; k++) d += ' ' + Organica.shapes.scalePathAbout(geo.d, Math.pow(ratio, k), cx, cy);
  return { ...geo, d, fillRule: 'evenodd' };
}
// ── Cut out (Oct 4, 2026 — named "Hollow" while prototyped): ONE constant-thickness rim for every shape ──
// The panel's Cut out c (0–95) is the Seed param `cutOut`; the rim it leaves is (100 − c) % of the inradius,
// so the slider runs solid → thinner and thinner rim with no jump (Diego chose the word and the direction).
// Replaces the six shape-own "Outline (hollow)" sliders (Triangle, Polygon, Star, Square, Lens,
// Blob), which scaled the shape toward its centre — an even wall only on a triangle or a regular polygon
// (measured up to ×1.53 at a lens tip, ×0.73 in a star's valleys). Here: the part of the shape within
// t of its own outline, t = a % of the shape's inradius (the unit the old sliders used). Built
// with Paper.js on the visible silhouette (a self-crossing pentagram gets no wall along its inner
// lines): a quad per flattened edge + a disc per vertex, united pairwise (one compound read as nonzero
// flipped the ring on convex shapes with long edges), then shape ∩ band. Flattening error ≤ 3% of t.
// Prototype (since removed) + measurements: docs/audit-2026-10/FVS-ELEMENT-DUPLICATES.md §5.
// Memoised by d + fill-rule + %, the inradius by d alone, so a Hollow drag only rebuilds the band.
export const _hollowCache = new Map(), _inradiusCache = new Map();
export const paperLeaves = item => item.children && item.children.length ? item.children.flatMap(paperLeaves) : [item];
// Largest inscribed circle (the unit of Hollow's %): a 48×48 grid, then two finer passes around the best
// point. Distances and inside-tests run in plain JS on the silhouette flattened to ≤0.05 — Paper's own
// getNearestPoint on curves cost ~0.35 ms a call (≈500 ms for a lobed Circle); this is a few ms.
export function inradiusOf(shape, scope) {   // → { r, x, y }: the largest inscribed circle
  const polys = paperLeaves(shape).map(l => { const c = l.clone({ insert: false }); try { c.flatten(0.05); } catch (e) { /* straight */ } const pts = c.segments.map(sg => [sg.point.x, sg.point.y]); c.remove(); return pts; }).filter(p => p.length > 2);
  const inside = (x, y) => {   // nonzero winding — Paper's boolean output is wound so holes cancel
    let w = 0;
    for (const P of polys) for (let i = 0, n = P.length; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) w++; }
      else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) w--;
    }
    return w !== 0;
  };
  const dist = (x, y) => {
    let m = Infinity;
    for (const P of polys) for (let i = 0, n = P.length; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      const u = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
      const ex = a[0] + u * dx - x, ey = a[1] + u * dy - y, d2 = ex * ex + ey * ey;
      if (d2 < m) m = d2;
    }
    return Math.sqrt(m);
  };
  const b = shape.bounds, N = 48;
  let best = 0, bx = 0, by = 0, sx = b.width / N, sy = b.height / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = b.x + (i + 0.5) * sx, y = b.y + (j + 0.5) * sy;
    if (!inside(x, y)) continue;
    const d = dist(x, y);
    if (d > best) { best = d; bx = x; by = y; }
  }
  for (let pass = 0; pass < 2; pass++) {   // refine: 7×7 around the best point, a third of the step each time
    sx /= 3; sy /= 3;
    const cx = bx, cy = by;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const x = cx + i * sx, y = cy + j * sy;
      if (!inside(x, y)) continue;
      const d = dist(x, y);
      if (d > best) { best = d; bx = x; by = y; }
    }
  }
  return { r: best, x: bx, y: by };
}
// The largest inscribed circle of a geometry's visible silhouette (its own d-space), memoised by d.
export function inscribedCircle(geo) {
  const rKey = geo.d + '|' + (geo.fillRule || '');
  let c = _inradiusCache.get(rKey);
  if (c) return c;
  const scope = splitPaperScope();
  const raw = importAsPaperShape(scope, geo.d, geo.fillRule);
  const shape = raw.unite(raw.clone({ insert: false }), { insert: false });
  raw.remove();
  c = inradiusOf(shape, scope);
  shape.remove();
  if (_inradiusCache.size > 200) _inradiusCache.clear();
  _inradiusCache.set(rKey, c);
  return c;
}
export function hollowGeometry(geo, pct) {
  if (!geo || !geo.d || !(pct > 0)) return geo;
  const key = geo.d + '|' + (geo.fillRule || '') + '|' + pct;
  if (_hollowCache.has(key)) return { ...geo, ..._hollowCache.get(key) };
  let res = null;
  try {
    const scope = splitPaperScope();
    const raw = importAsPaperShape(scope, geo.d, geo.fillRule);
    const shape = raw.unite(raw.clone({ insert: false }), { insert: false });
    raw.remove();
    const r = inscribedCircle(geo).r;
    const t = Math.min(99, pct) / 100 * r, tol = Math.min(0.3, Math.max(0.03, t * 0.03));
    const pieces = [];
    for (const leaf of paperLeaves(shape)) {
      const c = leaf.clone({ insert: false });
      try { c.flatten(tol); } catch (e) { /* already straight */ }
      const pts = c.segments.map(sg => [sg.point.x, sg.point.y]);
      c.remove();
      const n = pts.length;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const a = pts[i], bb = pts[(i + 1) % n], dx = bb[0] - a[0], dy = bb[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        const nx = -dy / L * t, ny = dx / L * t;
        const q = new scope.Path({ segments: [[a[0] + nx, a[1] + ny], [bb[0] + nx, bb[1] + ny], [bb[0] - nx, bb[1] - ny], [a[0] - nx, a[1] - ny]], closed: true, insert: false });
        q.clockwise = true; pieces.push(q);
        // Two quads leave a wedge-shaped crack at a turning vertex, from the vertex right through the wall.
        // A real corner gets a disc; on a flattened curve (turn under 8°) two thin triangles close the
        // wedge on either side instead — polygons keep the booleans fast, and what they leave out (the
        // sliver between the wedge's chord and its arc, ≈ t·θ²/8) stays under 0.25 % of t.
        const pv = pts[(i - 1 + n) % n], ux = a[0] - pv[0], uy = a[1] - pv[1], Lu = Math.hypot(ux, uy);
        const turn = Lu < 1e-6 ? Math.PI : Math.abs(Math.atan2(ux * dy - uy * dx, ux * dx + uy * dy));
        if (turn > 0.14) { const disc = new scope.Path.Circle({ center: a, radius: t, insert: false }); disc.clockwise = true; pieces.push(disc); }
        else if (turn > 1e-4) {
          const px = -uy / Lu * t, py = ux / Lu * t;   // the previous edge's normal
          for (const sg of [1, -1]) {
            const tri = new scope.Path({ segments: [a, [a[0] + sg * px, a[1] + sg * py], [a[0] + sg * nx, a[1] + sg * ny]], closed: true, insert: false });
            tri.clockwise = true; pieces.push(tri);
          }
        }
      }
    }
    if (t > 0 && pieces.length) {
      let layer = pieces;
      while (layer.length > 1) {
        const next = [];
        for (let i = 0; i < layer.length; i += 2) {
          if (i + 1 >= layer.length) { next.push(layer[i]); continue; }
          next.push(layer[i].unite(layer[i + 1], { insert: false }));
          layer[i].remove(); layer[i + 1].remove();
        }
        layer = next;
      }
      const out = shape.intersect(layer[0], { insert: false });
      res = { d: out.pathData, fillRule: undefined };
      out.remove(); layer[0].remove();
    }
    shape.remove();
  } catch (e) { res = null; }
  if (!res || !res.d) return geo;
  if (_hollowCache.size > 200) _hollowCache.clear();
  _hollowCache.set(key, res);
  return { ...geo, ...res };
}
// Inner seed on a cut-out shape (Diego's choice C, then "A+B", Oct 4, 2026): the copies ARE the cut-out
// shape, UNITED (evenodd would turn every overlap of a thick rim white), and
//  A — Ratio is measured inside the previous copy's hole: each copy is Ratio × (the hole's share, Cut out %)
//      of the one before, so a copy always sits inside the hole and the rings never merge (before: only
//      6 of 24 Ratio × Cut out pairs gave separate rings, the rest only shrank the hole or left fragments);
//  B — the copies shrink toward the centre of the largest inscribed circle, so the gaps stay even on a
//      triangle, a drop, a star… (the bbox / centroid of those shapes is not equidistant from the outline).
//      Apex (Arc / Wedge) still pivots on the shape's own tip.
export function withInnerHollowCopies(h, base, p, apex, cut) {
  const n = Math.round((p && p.innerCount) || 0);
  if (!(n > 0) || !h || !h.d || !base || !base.d) return h;
  const ratio = Math.min(0.95, Math.max(0.1, (p.innerRatio == null ? 70 : p.innerRatio) / 100));
  const ap = p.innerAnchor === 'apex' && apex ? apex(p) : null;
  const ic = ap ? null : inscribedCircle(base);
  const ctr = ap ? { x: ap[0], y: ap[1] } : { x: ic.x, y: ic.y };
  const key = 'inner|' + h.d + '|' + n + '|' + ratio + '|' + ctr.x + ',' + ctr.y;
  if (_hollowCache.has(key)) return { ...h, ..._hollowCache.get(key) };
  let d = h.d;
  try {
    const scope = splitPaperScope();
    let u = new scope.CompoundPath(h.d);
    // The largest scale at which the whole outline, shrunk toward the centre, still lies inside the hole —
    // found by bisection on the flattened outline and hole (plain JS). Measured, not assumed from Cut out:
    // a star's tips, a long rectangle's short side or a cross's arms make the hole fit very differently.
    const flat = l => { const c = l.clone({ insert: false }); try { c.flatten(0.25); } catch (e) { /* straight */ } const pts = c.segments.map(sg => [sg.point.x, sg.point.y]); c.remove(); return pts; };
    const all = paperLeaves(u), outer = all.reduce((a, b) => Math.abs(b.area) > Math.abs(a.area) ? b : a);
    const holePolys = all.filter(l => l.clockwise !== outer.clockwise).map(flat).filter(q => q.length > 2);
    const outerPts = flat(outer);
    const inHole = (x, y) => holePolys.some(P => {
      let w = 0;
      for (let i = 0, m = P.length; i < m; i++) {
        const a = P[i], b = P[(i + 1) % m];
        if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) w++; }
        else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) w--;
      }
      return w !== 0;
    });
    const fits = sc => outerPts.every(q => inHole(ctr.x + (q[0] - ctr.x) * sc, ctr.y + (q[1] - ctr.y) * sc));
    let fit = 0;
    if (holePolys.length && inHole(ctr.x, ctr.y)) {
      let lo = 0, hi = 1;
      for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
      fit = lo;
    }
    if (!(fit > 0)) fit = Math.min(95, Math.max(1, cut)) / 100;   // no hole around the centre (thick rim, off-centre apex) — the plain estimate
    const step = ratio * Math.min(1, fit);
    for (let k = 1; k <= n; k++) {
      const cp = new scope.CompoundPath(Organica.shapes.scalePathAbout(h.d, Math.pow(step, k), ctr.x, ctr.y));
      const next = u.unite(cp, { insert: false }); u.remove(); cp.remove(); u = next;
    }
    d = u.pathData; u.remove();
  } catch (e) { /* keep the single hollow */ }
  const res = { d, fillRule: undefined };
  if (_hollowCache.size > 200) _hollowCache.clear();
  _hollowCache.set(key, res);
  return { ...h, ...res };
}
// ── Irregularity (Oct 4, 2026): ONE seeded irregularity for every shape, two modes ──
// Replaces the five shape-own Irregularity + Seed pairs (Triangle, Arc, Wedge, Polygon, Star; + Polygon /
// Star Angle jitter), which did two different things under one name. Here, on the shape's flattened outline
// (every sub-path, holes too), with an amplitude of `irregular` % of the inscribed-circle radius (half of it for Outline):
//  Corners — each corner gets a seeded offset; every point between two corners moves by the blend of their
//            offsets along the outline, so a straight side stays straight (hand-cut paper). A corner = where the
//            outline turns more than 35° within ±3 % of its length (sharp or rounded corners alike).
//  Outline — every point moves along its normal by a seeded periodic wave with `irrWaves` bumps around the
//            outline (organic, wobbly). A shape with no corners (circle, blob…) always uses Outline.
// Applied before Cut out and Copies, so the rim and the copies follow the irregular outline. The shape may
// poke out of its cell, like Scale above 1 — it is never refitted. Memoised by d + parameters.
export const _irrCache = new Map();
export function outlinePolys(geo, tol) {
  const scope = splitPaperScope(), shape = importAsPaperShape(scope, geo.d, geo.fillRule);
  const polys = paperLeaves(shape).map(l => { const c = l.clone({ insert: false }); try { c.flatten(tol); } catch (e) { /* straight */ } const pts = c.segments.map(sg => [sg.point.x, sg.point.y]); c.remove(); return pts; }).filter(q => q.length > 2);
  shape.remove();
  return polys;
}
// Corner indices of one closed polyline (see above). `arc` = cumulative length at each point.
export function polyCorners(pts) {
  const n = pts.length, arc = [0];
  for (let i = 1; i <= n; i++) arc.push(arc[i - 1] + Math.hypot(pts[i % n][0] - pts[i - 1][0], pts[i % n][1] - pts[i - 1][1]));
  const P = arc[n], w = Math.max(0.03 * P, 1e-6);
  const at = (i, ds) => {   // the point `ds` along the outline from i (wrapping)
    let s = ((arc[i] + ds) % P + P) % P, j = 0;
    while (j < n && arc[j + 1] < s) j++;
    const t = (s - arc[j]) / Math.max(arc[j + 1] - arc[j], 1e-9), a = pts[j], b = pts[(j + 1) % n];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const turn = pts.map((q, i) => {
    const a = at(i, -w), b = at(i, w), u = [q[0] - a[0], q[1] - a[1]], v = [b[0] - q[0], b[1] - q[1]];
    return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    if (turn[i] < 0.61) continue;   // 35°
    let isMax = true;
    for (let j = 1; j < n && isMax; j++) {   // the sharpest point within ±w of the outline
      const k = (i + j) % n, d = Math.min(Math.abs(arc[k] - arc[i]), P - Math.abs(arc[k] - arc[i]));
      if (d > w) { if (j > n / 2) break; continue; }
      if (turn[k] > turn[i] || (turn[k] === turn[i] && k < i)) isMax = false;
    }
    if (isMax) out.push(i);
  }
  return { corners: out, arc, P };
}
export const _cornersCache = new Map();   // the panel asks on every Irregularity / Seed-panel input — memoised by d
export function shapeHasCorners(geo) {
  if (!geo || !geo.d) return false;
  const key = geo.d + '|' + (geo.fillRule || '');
  if (_cornersCache.has(key)) return _cornersCache.get(key);
  let has = false;
  try { has = outlinePolys(geo, 0.2).some(q => polyCorners(q).corners.length > 0); } catch (e) { has = false; }
  if (_cornersCache.size > 200) _cornersCache.clear();
  _cornersCache.set(key, has);
  return has;
}
export function irregularGeometry(geo, p) {
  const amt = Math.min(100, Math.max(0, p.irregular || 0));
  if (!geo || !geo.d || !(amt > 0)) return geo;
  const mode = p.irrMode === 'outline' ? 'outline' : 'corners', waves = Math.max(1, Math.round(p.irrWaves || 6)), seed = Math.round(p.irrSeed || 1);
  const key = geo.d + '|' + (geo.fillRule || '') + '|' + amt + '|' + mode + '|' + waves + '|' + seed;
  if (_irrCache.has(key)) return { ...geo, ..._irrCache.get(key) };
  let res = null;
  try {
    // amplitude: Corners up to the inscribed radius (≈ the old Triangle Irregularity at the same value), Outline half of it
    const amp = amt / 100 * (mode === 'corners' ? 1 : 0.5) * inscribedCircle(geo).r, polys = outlinePolys(geo, 0.2), R = v => Math.round(v * 1000) / 1000;
    let d = '';
    polys.forEach((pts, li) => {
      const rng = Organica.mulberry32(((seed * 7919) ^ (li * 104729)) >>> 0), n = pts.length;
      const { corners, arc, P } = polyCorners(pts);
      let moved;
      if (mode === 'corners' && corners.length) {
        const vec = corners.map(() => { const a = rng() * Math.PI * 2, m = amp * (0.4 + 0.6 * rng()); return [Math.cos(a) * m, Math.sin(a) * m]; });
        moved = pts.map((q, i) => {
          let ci = corners.length - 1;   // the corner at or before i (wrapping)
          for (let c = 0; c < corners.length; c++) if (corners[c] <= i) ci = c;
          const cj = (ci + 1) % corners.length, sa = arc[corners[ci]], sb = arc[corners[cj]];
          let span = sb - sa, ds = arc[i] - sa;
          if (span <= 0) span += P; if (ds < 0) ds += P;
          if (corners.length === 1) {   // one corner (a drop's tip): it moves, the far side stays put
            const f = 1 - 2 * Math.min(ds, P - ds) / P, v = vec[0];
            return [q[0] + v[0] * f, q[1] + v[1] * f];
          }
          const t = ds / span, va = vec[ci], vb = vec[cj];
          return [q[0] + va[0] + (vb[0] - va[0]) * t, q[1] + va[1] + (vb[1] - va[1]) * t];
        });
      } else {
        const knots = Array.from({ length: waves }, () => rng() * 2 - 1);
        const wave = s => {   // periodic Catmull-Rom through the knots, `waves` bumps around the outline
          const u = s / P * waves, i = Math.floor(u), t = u - i, k = j => knots[((j % waves) + waves) % waves];
          const p0 = k(i - 1), p1 = k(i), p2 = k(i + 1), p3 = k(i + 2);
          return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
        };
        moved = pts.map((q, i) => {
          const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, w = wave(arc[i]) * amp;
          return [q[0] - dy / L * w, q[1] + dx / L * w];
        });
      }
      d += (d ? ' ' : '') + 'M ' + moved.map(q => R(q[0]) + ',' + R(q[1])).join(' L ') + ' Z';
    });
    if (d) res = { d };
  } catch (e) { res = null; }
  if (!res) return geo;
  if (_irrCache.size > 200) _irrCache.clear();
  _irrCache.set(key, res);
  return { ...geo, ...res };
}
// ── Split Element into 4 quadrant pieces — a true path-boolean clip
// (Paper.js, already vendored above for the Freehand editor), not the
// render-time <clipPath>/<mask> trick Content (Mask/Subtraction, further
// below) uses — this needs a REAL new `d` per piece, since each quadrant
// becomes its own independent cell content, not just a picture. Operates on
// the shape's own raw geo.d (pre-normTx/normScale), same convention as
// pathBBox/withInnerCopies above; splits at the shape's own bbox centre, not
// a fixed 50/50 of the placement box, so an off-centre shape (Wedge,
// Segment, an uploaded SVG) gets quadrants relative to where its mass
// actually sits, not the frame.
//
// A dedicated PaperScope, never `paper.setup()` on the shared default scope
// createPaperDrawEditor (above) uses for the live Freehand canvas —
// re-setup on the default scope would silently break that editor if it's
// mounted at the same time. Every construction below goes through this
// scope's OWN bound classes (scope.Path, scope.CompoundPath, scope.Path.
// Rectangle…), never the bare global Path/CompoundPath, so this never
// touches the shared scope at all.
export let _splitScope = null;
export function splitPaperScope() {
  if (_splitScope) return _splitScope;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 8;   // never mounted — Paper only needs a context to attach to
  _splitScope = new paper.PaperScope();
  _splitScope.setup(canvas);
  return _splitScope;
}
export const SPLIT_QUADRANTS = [
  { id: 'tl', dx: -1, dy: -1 }, { id: 'tr', dx: 1, dy: -1 },
  { id: 'bl', dx: -1, dy: 1 }, { id: 'br', dx: 1, dy: 1 },
];   // TL,TR,BL,BR — the same row-major order resolveGridCells gives a square 2×2
// Paper.js has no evenodd concept — Inner Seed's `fillRule:'evenodd'` d
// strings are N NESTED, SAME-WINDING copies of one shape (withInnerCopies
// above), so importing them as a plain nonzero CompoundPath would fill every
// ring solid instead of alternating. Rebuilding via iterative exclude()
// (symmetric difference) across the subpaths reproduces the same alternating
// fill — exclude() operates on each subpath's own filled REGION, not its
// winding direction, and is commutative/associative, so subpath order
// doesn't matter. A plain (non-evenodd) `d` — every other geometry, incl.
// the reverse-winding "outline" hollow shapes — imports correctly as-is.
export function importAsPaperShape(scope, d, fillRule) {
  const cp = new scope.CompoundPath(d);
  if (fillRule !== 'evenodd' || cp.children.length < 2) return cp;
  const kids = cp.children.map(c => c.clone({ insert: false }));
  cp.remove();
  let combined = kids[0];
  for (let i = 1; i < kids.length; i++) combined = combined.exclude(kids[i], { insert: false });
  return combined;
}
// Fits a raw `d` into a fresh 0..100 box — the exact formula
// extractSeedFromSVG (below) uses for an uploaded file, generalised to work
// on any `d` string via pathBBox instead of a DOM getBBox() call.
export function fitPathToSeed(d, frameBB) {
  // frameBB: fit against THIS box instead of the path's own — a split piece
  // then keeps its place and size inside the original shape's frame, so the
  // four pieces reassemble into the original.
  const bb = frameBB || pathBBox(d);
  if (!bb || bb.width <= 0 || bb.height <= 0) return null;
  const normScale = 100 / Math.max(bb.width, bb.height);
  const fitW = bb.width * normScale, fitH = bb.height * normScale;
  const offX = (100 - fitW) / 2, offY = (100 - fitH) / 2;
  return { d, normScale, normTx: -bb.x + offX / normScale, normTy: -bb.y + offY / normScale };
}
// Segment (and any other open-stroke geometry) has zero fill area, so
// intersect() below finds nothing — this turns its open strokes into thin
// FILLED ribbons first, at the Element's own current stroke width, so the
// normal area-cut pipeline can run unchanged. FVS-local only: shared/shapes.js
// segmentGeometry() must keep returning a plain stroke (Genesis draws it that
// way), so the conversion happens here, at split time, not in the shared geometry.
export function unitVec(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
export function segNormal(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; return [-dy / len, dx / len]; }
export function ptsToD(pts, closed) { let d = 'M ' + pts.map(p => p[0] + ',' + p[1]).join(' L '); if (closed) d += ' Z'; return d; }
// A true semicircular cap from `from` to `to`, both at radius r from `center`
// (the path's own endpoint) — picks the sweep flag by directly computing
// which of the two candidate arc directions points toward `outwardDir`,
// rather than reasoning about SVG's own sweep-flag convention (exact for a
// diameter chord: sweep=1's arc midpoint is center + rotate90CCW(from-center)).
export function capArc(center, from, to, outwardDir) {
  const r = Math.hypot(from[0] - center[0], from[1] - center[1]);
  const v = [from[0] - center[0], from[1] - center[1]];
  const mid = [-v[1], v[0]];   // candidate midpoint direction for sweep=1
  const sweep = (mid[0] * outwardDir[0] + mid[1] * outwardDir[1]) > 0 ? 1 : 0;
  return `A ${r} ${r} 0 0 ${sweep} ${to[0]} ${to[1]}`;
}
export const SYMBOL_ARC_TRUCHET ={ arcCount: 5, arcRatio: 0.7, truFans: 2, truCore: 0, truSpread: 180, truReach: 100, truRamp: 0, truCurve: 0, truRound: 0, truSegs: 1, truGap: 20 };   // fixed defaults for the Symbols tier
export const SYMBOL_ARC = { arcPivot: 'corner', arcSweep: 90, arcStart: 0, arcRound: 0, arcSegs: 1, arcGap: 20, arcTaper: 0, arcIrregular: 0, arcSeed: 1 };   // Symbols stay a plain quarter arc
export const SYMBOL_WEDGE = { wedgeAngle: 90, wedgeInner: 0, wedgeSquash: 100, wedgeRound: 0, wedgeRotate: 0, wedgeCurve: 0, wedgeIrregular: 0, wedgeSeed: 1 };
export const SYMBOL_POLYGON = { polySides: 6, polyCorner: 0, polyRotate: 0, polyStep: 1, polyStyle: 'round', polyCurve: 0, polyOutline: 0, polySkew: 0 };
export const SYMBOL_STAR = { starPoints: 5, starInner: 45 };
export const SYMBOL_ROUNDEDRECT = { rrWidth: 100, rrHeight: 100, rrCorner: 0 };
export const SYMBOL_CHEVRON = { chevNotch: 40, chevArm: 55 };
export const SYMBOL_CROSS = { crossArmWidth: 35, crossArmLength: 100 };
export const SYMBOL_LENS = { lensWidth: 50 };
export const SYMBOL_INNER = { innerCount: 0, innerRatio: 70, innerAnchor: 'bbox', cutOut: 0, irregular: 0 };   // Symbols stay plain shapes
export const SYMBOL_TRIANGLE = { triApex: 0, triCorner: 0, triCurve: 0, triIrregular: 0, triSeed: 1, triOutline: 0 };   // Symbols stay a plain triangle
