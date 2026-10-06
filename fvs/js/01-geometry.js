// Flexible Visual System · 01-geometry — Seed geometry — Seed types, cell shapes and lattices, Cut out, Irregularity, Split.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import { rt } from './rt.js';
import { hooks } from './hooks.js';
import {
  state
} from './engine/00-core.js';
import {
  CELL_OUTLINES, CELL_SHAPES, INNER_APEX, INNER_UNSUPPORTED, SEG_WEIGHT_DEF, SPLIT_QUADRANTS, arcGeometry,
  arcTruchetGeometry, blobGeometry, capArc, cellLatticeCells, cellShapeOf, chevronGeometry, circleGeometry,
  crossGeometry, dropGeometry, fitGeoToCell, fitPathToSeed, hollowGeometry, importAsPaperShape,
  irregularGeometry, lensGeometry, pathBBox, polygonGeometry, ptsToD, roundedRectGeometry, segNormal,
  segmentBar, segmentGeometry, splitPaperScope, starGeometry, triangleGeometry, unitVec, wedgeGeometry,
  withInnerCopies, withInnerHollowCopies
} from './engine/01-geometry.js';
import {
  circleOptsFrom
} from './engine/02-seed-ui.js';
import {
  ctrl, val
} from './00-core.js';

export const SEED_TYPES = {
  triangle: { label: 'Triangle', geometry: (p) => triangleGeometry(p.base, p.height, p.triApex, { corner: p.triCorner, curve: p.triCurve, irregular: p.triIrregular, seed: p.triSeed, outline: p.triOutline }) },
  arc: { label: 'Arc', geometry: (p) => arcGeometry(p.thickness, p.arcPivot, p.arcSweep, { start: p.arcStart, round: p.arcRound, segs: p.arcSegs, gap: p.arcGap, taper: p.arcTaper, irregular: p.arcIrregular, seed: p.arcSeed }) },
  arctruchet: { label: 'Arc truchet', geometry: (p) => arcTruchetGeometry(p.arcCount, p.arcRatio, { fans: p.truFans, core: p.truCore, spread: p.truSpread, reach: p.truReach, ramp: p.truRamp, curve: p.truCurve, round: p.truRound, segs: p.truSegs, gap: p.truGap }) },
  wedge: { label: 'Wedge', geometry: (p) => wedgeGeometry(p.wedgeAngle, p.wedgeInner, p.wedgeSquash, { round: p.wedgeRound, rotate: p.wedgeRotate, curve: p.wedgeCurve, irregular: p.wedgeIrregular, seed: p.wedgeSeed }) },
  polygon: { label: 'Polygon', geometry: (p) => polygonGeometry(p.polySides, p.polyCorner, p.polyIrregular, p.polySeed, p.polyRadius, { rotate: p.polyRotate, step: p.polyStep, style: p.polyStyle, curve: p.polyCurve, outline: p.polyOutline, skew: p.polySkew }) },
  star: { label: 'Star', geometry: (p) => starGeometry(p.starPoints, p.starInner, p.starIrregular, p.starSeed, p.starRadius, { rotate: p.starRotate, tipRound: p.starTipRound, valleyRound: p.starValleyRound, style: p.starStyle, curve: p.starCurve, twist: p.starTwist, outline: p.starOutline, skew: p.starSkew }) },
  roundedrect: { label: 'Square', geometry: (p) => roundedRectGeometry(p.rrWidth, p.rrHeight, p.rrCorner, { style: p.rrStyle, mask: p.rrMask, skew: p.rrSkew, rotate: p.rrRotate, curve: p.rrCurve, outline: p.rrOutline }) },
  chevron: { label: 'Chevron', geometry: (p) => chevronGeometry(p.chevNotch, p.chevArm, p.chevSquash, { round: p.chevRound, style: p.chevStyle, curve: p.chevCurve, lean: p.chevLean, flat: p.chevFlat, stack: p.chevStack, gap: p.chevGap, rotate: p.chevRotate }) },
  cross: { label: 'Cross', geometry: (p) => crossGeometry(p.crossArmWidth, p.crossArmLength, p.crossCorner, { arms: p.crossArms, taper: p.crossTaper, tip: p.crossTip, style: p.crossStyle, rotate: p.crossRotate }) },
  lens: { label: 'Lens', geometry: (p) => lensGeometry(p.lensWidth, { crescent: p.lensCrescent, petals: p.lensPetals, outline: p.lensOutline, rotate: p.lensRotate }) },
  circle: { label: 'Circle', geometry: (p) => circleGeometry(p.circleRadius, circleOptsFrom(p)) },
  segment: { label: 'Segment', geometry: (p) => segmentBar(segmentGeometry(p.segLen, { angle: p.segAngle, bend: p.segBend, wave: p.segWave, cycles: p.segCycles, dashes: p.segDashes, gap: p.segGap, lines: p.segLines, spacing: p.segSpacing, repeatX: p.segRepeatX, spaceX: p.segSpaceX, repeatY: p.segRepeatY, spaceY: p.segSpaceY, rays: p.segRays, tile: true }), p.segWeight == null ? SEG_WEIGHT_DEF : p.segWeight, !!p.segRound) },
  drop: { label: 'Drop', geometry: (p) => dropGeometry(p.dropRadius, p.dropTail, { bend: p.dropBend, neck: p.dropNeck, petals: p.dropPetals, rotate: p.dropRotate }) },
  blob: { label: 'Blob', geometry: (p) => blobGeometry(p.blobRadius, p.blobAmount, p.blobSeed, { freq: p.blobFreq, smooth: p.blobSmooth, outline: p.blobOutline }) },
  // Stack: an Element made of several layered shapes (state.layers). Its
  // geometry carries the per-layer geometries; elementPathMarkup /
  // paintGeoCanvas know how to paint them (fills in order, containers clip
  // and masks knock out everything BELOW them). `d` is the placed union of the
  // fill layers, only used for measuring / clip boundaries.
  stack: { label: 'Layers', geometry: (p) => hooks.stackGeometry(p) },
  // Freehand: every step after Element sees the drawing fitted to the cell;
  // only the Element stage shows it raw ('freehandraw', not in the picker).
  freehand: { label: 'Freehand', geometry: (p) => (p && p.customSeed) || (state.freehand && state.freehand.seed) || { d: '', normTx: 0, normTy: 0, normScale: 1 } },
  freehandraw: { label: 'Freehand (raw)', geometry: () => ({ d: (state.freehand && state.freehand.raw) || '', normTx: 0, normTy: 0, normScale: 1 }) },
  custom: {
    label: 'Custom (uploaded)',
    // Same convention as 'freehand' just above: prefer the snapshot's OWN
    // customSeed (a per-cell content override in Component Edit mode) and
    // only fall back to the live global upload when none was passed — a
    // plain `() => state.customSeed` here (the previous body) ignored its
    // argument entirely, so every cell showing an uploaded shape displayed
    // whatever was CURRENTLY uploaded, all changing together regardless of
    // which cell's content was actually selected.
    geometry: (p) => (p && p.customSeed) || state.customSeed || { d: '', normTx: 0, normTy: 0, normScale: 1 },
  },
};

state.cellShape = 'square';
state.cellLattice = { circle: 2, triangle: 1, hexagon: 2 };   // the Component grid's size (rings / cells along a side)
state.cellOutline = { circle: 'hexagon', triangle: 'hexagon', hexagon: 'hexagon' };   // the shape the cells are grouped into
Object.entries(SEED_TYPES).forEach(([type, t]) => {
  const base = t.geometry;
  t.geometry = p => {
    const cs = cellShapeOf(p);
    if (cs === 'square') return base(p);
    if (type === 'arc' && cs === 'triangle') return Organica.shapes.triangleArcGeometry(p.thickness);
    if (type === 'arctruchet' && cs === 'hexagon') return Organica.shapes.hexTruchetGeometry(p.arcCount, p.arcRatio);
    if (type === 'stack' || type === 'freehandraw') return base(p);
    return fitGeoToCell(base(p), cs);
  };
});
export function setCellShape(shape, opts = {}) {
  if (!CELL_SHAPES[shape]) shape = 'square';
  const changed = shape !== state.cellShape;
  state.cellShape = shape;
  ctrl('fb-cell-shape').querySelectorAll('[data-cell]').forEach(b => { const on = b.dataset.cell === shape; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
  if (changed) rt.elementView = { r: 0, fh: false, fv: false };
  hooks.syncComponentGridUI();
  // A loaded Element (silent): its caller fills the gallery, but the Rule menu must follow the new shape now.
  if (opts.silent) { if (changed) hooks.syncRuleAvailability(); return; }
  // Components built for the old cell shape turn in the wrong step (90° on hexagons…) even when the cell
  // count happens to match — start the gallery again from the starter set.
  if (changed) { state.components = []; state.selectedId = null; state.selectionExplicit = false; state.componentAutoGenerated = true; state.componentAutoGenSignature = null; }
  hooks.syncRuleAvailability();
  hooks.renderSeedPreview(); hooks.renderGallery(); hooks.renderSymbol();
}
export function cellLatticeGrid() {
  const shape = state.cellShape, rings = state.cellLattice[shape];
  const outline = CELL_OUTLINES[shape].includes(state.cellOutline[shape]) ? state.cellOutline[shape] : 'hexagon';
  const cells = cellLatticeCells(shape, rings, val('rg-cellsize'), outline);
  const xs = cells.flatMap(c => c.points.map(p => p[0])), ys = cells.flatMap(c => c.points.map(p => p[1]));
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  cells.forEach(c => { c.points = c.points.map(([x, y]) => [x - x0, y - y0]); c.centroid = [c.centroid[0] - x0, c.centroid[1] - y0]; });
  return { kind: 'loom', cellShape: 'polygon', cells, width: Math.max(...xs) - x0, height: Math.max(...ys) - y0, lattice: { shape, rings, outline } };
}
export const BASE_GEOMETRY = {};   // each type's geometry before Irregularity / Cut out / Copies (for the panel's Mode check)
for (const k of Object.keys(SEED_TYPES)) {
  if (k === 'freehandraw') continue;   // the raw drawing stage view stays untouched
  const g0 = SEED_TYPES[k].geometry, inner = !INNER_UNSUPPORTED.has(k);
  BASE_GEOMETRY[k] = g0;
  SEED_TYPES[k].geometry = p => {
    const base = p && p.irregular > 0 ? irregularGeometry(g0(p), p) : g0(p);   // Irregularity 0 → byte-identical to before
    if (!(p && p.cutOut > 0)) return inner ? withInnerCopies(base, p, INNER_APEX[k]) : base;   // Cut out 0 → byte-identical to before
    const h = hollowGeometry(base, 100 - Math.min(95, p.cutOut));   // Cut out c → a rim of (100 − c) % of the inradius: 0 solid, more = thinner rim, no jump
    return inner ? withInnerHollowCopies(h, base, p, INNER_APEX[k], p.cutOut) : h;
  };
}

export function strokeToShapeD(d, widthUnits, opts) {
  // caps: the caller's (an imported SVG's own stroke-linecap), else the Element's Rounded toggle
  const rounded = opts && opts.rounded != null ? opts.rounded : (ctrl('ck-element-rounded') ? ctrl('ck-element-rounded').checked : true);
  const halfW = Math.max(0.05, (widthUnits || 4) / 2);
  const scope = splitPaperScope();
  let src;
  try { src = new scope.CompoundPath(d); } catch (e) { return null; }
  const subs = (src.children && src.children.length ? src.children.slice() : [src]);
  const ribbonDs = [];
  for (const sub of subs) {
    const clone = sub.clone({ insert: false });
    try { clone.flatten(0.25); } catch (e) { /* already straight segments */ }
    const pts = (clone.segments || []).map(s => [s.point.x, s.point.y]);
    const closed = !!sub.closed;
    clone.remove();
    const n = pts.length;
    if (n < 2) continue;
    // Per-vertex normal = the average of its two flanking segment normals
    // (re-normalised) — a plain miter join, fine at Segment's typical widths.
    const normals = pts.map((p, i) => {
      const prevI = i > 0 ? i - 1 : (closed ? n - 1 : -1);
      const nextI = i < n - 1 ? i + 1 : (closed ? 0 : -1);
      const n1 = prevI >= 0 ? segNormal(pts[prevI], p) : null;
      const n2 = nextI >= 0 ? segNormal(p, pts[nextI]) : null;
      if (n1 && n2) return unitVec([n1[0] + n2[0], n1[1] + n2[1]]);
      return n1 || n2 || [0, 0];
    });
    const left = pts.map((p, i) => [p[0] + normals[i][0] * halfW, p[1] + normals[i][1] * halfW]);
    const right = pts.map((p, i) => [p[0] - normals[i][0] * halfW, p[1] - normals[i][1] * halfW]);
    let ribbonD;
    if (closed) {
      // Outer ring (left, forward) + inner ring (right, reversed) — opposite
      // traversal order gives opposite winding, so nonzero fill reads it as
      // an annulus (a hole), same convention withInnerCopies' evenodd rings use.
      ribbonD = ptsToD(left, true) + ' ' + ptsToD(right.slice().reverse(), true);
    } else {
      const tanEnd = unitVec([pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]]);
      const tanStart = unitVec([pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]]);
      let s = 'M ' + left.map(p => p[0] + ',' + p[1]).join(' L ');
      s += rounded ? ' ' + capArc(pts[n - 1], left[n - 1], right[n - 1], tanEnd) : ' L ' + right[n - 1][0] + ',' + right[n - 1][1];
      s += ' L ' + right.slice(0, n - 1).reverse().map(p => p[0] + ',' + p[1]).join(' L ');   // a 2-point line needs right[0] too
      s += rounded ? ' ' + capArc(pts[0], right[0], left[0], tanStart) : ' L ' + left[0][0] + ',' + left[0][1];
      s += ' Z';
      ribbonD = s;
    }
    ribbonDs.push(ribbonD);
  }
  src.remove();
  if (!ribbonDs.length) return null;
  let combined = null;
  for (const rd of ribbonDs) {
    let p; try { p = new scope.Path(rd); } catch (e) { continue; }
    if (!combined) combined = p;
    else { const u = combined.unite(p, { insert: false }); combined.remove(); p.remove(); combined = u; }
  }
  if (!combined) return null;
  const out = combined.pathData;
  combined.remove();
  return out;
}
// Splits `d` into up to 4 quadrant fragments {id:'tl'|'tr'|'bl'|'br', seed,
// strokeConv, frameBB} (seed already fit to its own 0..100 box via
// fitPathToSeed) — omits a quadrant Paper's intersect() finds empty (common
// for an off-centre or non-convex shape, e.g. a diagonal Segment only
// touching 2 of 4). `strokeConv` is true when `d` had no fillable area
// (Segment and its variants) and was converted to a filled ribbon first —
// the caller uses it to force the Element into Fill style, since a stroke
// re-applied on top of an already-filled ribbon piece would double-outline it.
export function splitElementGeometry(d, fillRule) {
  const scope = splitPaperScope();
  const bb0 = pathBBox(d);
  if (!bb0) return [];
  let allOpen = false;
  try {
    const probe = new scope.CompoundPath(d);
    const subs = probe.children && probe.children.length ? probe.children : [probe];
    allOpen = subs.every(s => !s.closed);
    probe.remove();
  } catch (e) { /* fall through, treat as a normal filled shape */ }
  let dd = d, fr = fillRule, strokeConv = false;
  if (bb0.width < 0.01 || bb0.height < 0.01 || allOpen) {
    const conv = strokeToShapeD(d, (hooks.getElementAppearance().strokeW) || 4);
    if (conv) { dd = conv; fr = undefined; strokeConv = true; }
  }
  const bb = strokeConv ? pathBBox(dd) : bb0;
  if (!bb || bb.width <= 0 || bb.height <= 0) return [];
  let shape;
  try { shape = importAsPaperShape(scope, dd, fr); } catch (e) { return []; }
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  // A margin well past the shape's own extent keeps a quadrant rectangle's
  // inner edges off any coincident shape boundary — an exact-touch can make
  // intersect() return a degenerate near-zero sliver instead of a clean cut.
  const pad = Math.max(bb.width, bb.height) + 10;
  const out = [];
  for (const q of SPLIT_QUADRANTS) {
    const rx = q.dx < 0 ? cx - pad : cx, ry = q.dy < 0 ? cy - pad : cy;
    const rect = new scope.Path.Rectangle(new scope.Rectangle(rx, ry, pad, pad));
    let piece = null;
    try { piece = shape.intersect(rect, { insert: false }); } catch (e) { piece = null; }
    rect.remove();
    if (piece) {
      if (Math.abs(piece.area) > 0.01) {
        const seed = fitPathToSeed(piece.pathData, bb);
        if (seed) out.push({ id: q.id, seed, strokeConv, frameBB: bb });
      }
      piece.remove();
    }
  }
  shape.remove();
  return out;
}
