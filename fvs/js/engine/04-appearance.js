// Flexible Visual System · engine/04-appearance — the engine part of 04-appearance.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  colorAt, colorRuleCR, entryItemInk, live, paletteSlot, pc, pv, ruleInk, state, val
} from './00-core.js';
import {
  CELL_SHAPES, SEED_TYPES, cellShapeOf, frameSize, importAsPaperShape, median, ptsToD, resolveGridCells,
  splitPaperScope
} from './01-geometry.js';
import {
  SEED_ICONS, ensureSvgNamespace, getCreatorLibraryForms, getSeed
} from './02-seed-ui.js';
import {
  mod360
} from './03-rules.js';
import { hooks, provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  componentCellColRow: () => componentCellColRow
});
// ── Item resolution + draw/export (shared by canvas + SVG) ──
export function buildComponentItems(component, grid) {
  const centers = resolveGridCells(grid);
  const cr = colorRuleCR(grid, state.colorRule);
  if (grid.lattice) {   // a cell-shape lattice: the outline fills each cell, turned to the cell's own pose
    const localR = CELL_SHAPES[grid.lattice.shape].R;
    return component.cells.map((t, i) => {
      const c = grid.cells[i], cellR = Math.max(...c.points.map(p => Math.hypot(p[0] - c.centroid[0], p[1] - c.centroid[1])));
      return withPartInks({ cx: centers[i].cx, cy: centers[i].cy, rotation: mod360((c.baseRot || 0) + t.rotation), flipH: t.flipH, flipV: t.flipV, scale: t.scale,
        cellSize: 100 * cellR / localR, color: ruleInk(i, cr), content: t.content || null, poly: c.points }, t, i, cr);   // poly: the cell in frame coords — the canvas is the lattice's outline
    });
  }
  return component.cells.map((t, i) => withPartInks({
    cx: centers[i].cx, cy: centers[i].cy,
    rotation: t.rotation, flipH: t.flipH, flipV: t.flipV, scale: t.scale,
    cellSize: centers[i].cellSize, color: ruleInk(i, cr),
    content: t.content || null,
  }, t, i, cr));
}
// Divide into parts, per cell (R3): a cell's own part colours, and the cell's palette slot when the parts step
// through the inks. Only added when used — every other item is the same object as before.
function withPartInks(item, cell, i, cr) {
  if (cell.partInks && Object.keys(cell.partInks).length) item.partInks = cell.partInks;
  if (state.colorRule.parts === 'step') item.inkSlot = paletteSlot(state.colors, state.colorRule, i, cr);
  return item;
}
// Per-cell {col,row,cols,rows,cx,cy,nx,ny,angle,index,count} for the
// Components tier's own grid — used by the named component rules
// (checkerboard/radial/pinwheel/…). Mirrors the Symbols tier's own
// cellColRow(grid) wrapper below, just reading Components' own Loom state
// (state.loomGrid) instead of state.symbolGrid — the two tiers keep
// independent Loom imports, so this can't be the same function.
export function componentCellColRow(grid) {
  const cr = Organica.shapes.cellColRow(grid, state.loomGrid && state.loomGrid.cells, state.loomGrid && state.loomGrid.grid);
  return grid.kind === 'loom' && grid.cellShape === 'polygon' ? polygonLatticeColRow(grid, cr) : cr;
}
// Organica.shapes.cellColRow bins polygon centroids with a tolerance taken from
// the MEDIAN cell. On a Loom hexagonal grid the clipped edge slivers drag that
// median down, and the offset columns ("doubled" rows — the middle column sits
// half a cell lower) leave every full hexagon on the same (col + row) parity:
// Checkerboard, Mirror, Diagonal and the parity colour rules all collapsed to
// Identity there. Re-bin from the full-size cells only (slivers join their
// nearest band) and fold doubled row indices back to a count per column.
export function polygonLatticeColRow(grid, cr) {
  const cells = resolveGridCells(grid);
  const area = c => c.cellW * c.cellH;
  const maxA = Math.max(...cells.map(area));
  const isMain = cells.map(c => area(c) >= maxA * 0.5);
  const main = cells.filter((c, i) => isMain[i]);
  if (main.length < 2) return cr;
  const bands = (vals, tol) => {
    const reps = [];
    [...vals].sort((a, b) => a - b).forEach(v => { if (!reps.length || v - reps[reps.length - 1] > tol) reps.push(v); });
    return reps;
  };
  const nearest = (v, reps) => { let bi = 0, bd = Infinity; reps.forEach((r, i) => { const d = Math.abs(r - v); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const colReps = bands(main.map(c => c.cx), median(main.map(c => c.cellW)) * 0.4);
  const rowReps = bands(main.map(c => c.cy), median(main.map(c => c.cellH)) * 0.4);
  const col = cells.map(c => nearest(c.cx, colReps));
  let row = cells.map(c => nearest(c.cy, rowReps)), rows = rowReps.length;
  // Doubled coordinates: every column's full cells share one row parity, and
  // the parities differ between columns.
  const parity = new Map();
  let doubled = colReps.length > 1;
  cells.forEach((c, i) => {
    if (!doubled || !isMain[i]) return;
    const p = row[i] % 2;
    if (!parity.has(col[i])) parity.set(col[i], p); else if (parity.get(col[i]) !== p) doubled = false;
  });
  if (doubled && new Set(parity.values()).size > 1) { row = row.map(r => r >> 1); rows = Math.ceil(rows / 2); }
  return cr.map((c, i) => ({ ...c, col: col[i], row: row[i], cols: colReps.length, rows }));
}
// Resolves state.underlyingComponentName into a self-contained snapshot —
// items with the ENTRY's own saved colours baked in (savedColorAt, same
// fix renderLibrary()'s own thumbnails already need), not the live
// palette. Deliberately does NOT recurse into the underlying entry's own
// role/underlyingComponentName (even a literal self-reference just renders
// that entry's plain cells once) — a disclosed simplification that also
// makes runaway recursion structurally impossible, not just guarded.
export function resolveUnderlyingComponent(name) {
  if (!name) return null;
  const entry = hooks.LIBRARY.read()[name];
  if (!entry) return null;
  const items = buildComponentItems({ cells: entry.component.cells }, entry.grid).map(entryItemInk(entry));
  return { items, seed: entry.seed, size: frameSize(entry.grid), paperColor: entry.paperColor, appearance: entry.appearance, colors: entry.colors };
}
// Real, empirically-verified browser bug (found building the equivalent
// Creator feature): a <g> nested ANYWHERE inside a <clipPath> renders the
// whole clip as empty, even with no transform at all — <mask> has no such
// problem. A Component's own cells are always <g>-wrapped (rotation/scale
// per cell), so Container's boundary can't just reuse the normal per-item
// markup — each cell's TWO transform levels are consolidated into ONE
// `transform` attribute on a bare <path> (no <g> anywhere), which a
// <clipPath> can hold as one of several direct children (their combined
// areas union automatically, per spec).
// Scale + Move ride on the same Element-level transform as Width/Length.
export const stretchOpts = a => ({ scale: a.scale, mx: a.mx, my: a.my, rotate: a.rotate });
export const appearanceIsIdentity = a => a.w === 1 && a.l === 1 && (a.scale == null || a.scale === 1) && !a.mx && !a.my && !a.rotate;
// The Element-level transform (Width/Length · Scale · Rotate · Move about the box centre) as a matrix —
// the canvas twin of shapeAppearance.stretchTransformAttr(a.w, a.l, 50, stretchOpts(a)).
export function appearanceMatrix(a) {
  const s = a.scale == null ? 1 : a.scale;
  return new DOMMatrix().translate(50 + (a.mx || 0), 50 + (a.my || 0)).rotate(a.rotate || 0).scale(a.w * s, a.l * s).translate(-50, -50);
}
// ── Element appearance (Style + Width/Length stretch) ──
// Read live from the Element tier's own controls, same way getSeed() reads
// the shape params — shared/shape-appearance.js owns the actual attribute /
// transform strings so Genesis Create and this tool can't drift apart.
export const DEFAULT_APPEARANCE = { fillMode: 'fill', strokeW: 4, rounded: true, w: 1, l: 1, scale: 1, mx: 0, my: 0, rotate: 0 };
// Pattern fill (Style = Pattern, or a Pattern layer): its own keys, so entries
// saved before it existed read the defaults.
export const PATTERN_DEFAULTS = { patType: 'lines', patSpacing: 8, patWeight: 2, patAngle: 45 };
export const PATTERN_KEYS = Object.keys(PATTERN_DEFAULTS);
export const patternOf = lk => { const o = {}; PATTERN_KEYS.forEach(k => { o[k] = lk && lk[k] != null ? lk[k] : PATTERN_DEFAULTS[k]; }); return o; };
// ── Element as tile (Paper pattern = Element) ─────────────────────────
// The tile is a flat silhouette in ONE ink: the current Element (all its fill
// layers as one shape — stackGeometry's union), a saved Element, or a Genesis
// seed. A saved Component / Symbol keeps a SNAPSHOT of the tile (appearanceSnapshot,
// at save time), so editing the Element later never changes saved work; the live
// Paper follows the Element as you edit it.
export const ELEMENT_LIB = Organica.presetStore('fvs-element');
export const TILE_CAP = 2500;   // tiles per canvas — past it the spacing is raised (and said so)
export const _genesisTileCache = new Map();
// Genesis seeds offered as tiles: the 13 Base Seeds (genesis/forms.js) + the user's
// own Genesis library in this browser (getCreatorLibraryForms), by id, no duplicates.
export function genesisTileForms() {
  const out = [], seen = new Set();
  for (const [id, e] of Object.entries(window.ORGANIC_SEEDS || {})) { out.push({ id, name: e.label || id, svg: e.svg }); seen.add(id); }
  for (const f of getCreatorLibraryForms()) if (f && f.svg && !seen.has(f.id)) { out.push(f); seen.add(f.id); }
  return out;
}
// A whole Genesis SVG → ONE filled outline in the 0..100 box: every shape with its
// transform (Paper.js importSVG, shapes expanded), strokes turned into outlines
// (strokeToShapeD), all united — so multi-shape seeds (flower bloom: 9 ellipses)
// and stroked ones (sun's rays, line) tile as they look, as a real path.
// An SVG stroke as filled outlines, honouring its own width, caps and joins — for imported seeds
// (svgToTileGeo). Each subpath is flattened and split at its sharp corners (> 40° turn): every run is a
// ribbon whose offsets are widened by 1/cos(half-turn) so it keeps its width through gentle bends, and
// every sharp corner gets the join the SVG asked for (round = a disc, miter = the miter wedge up to the
// SVG limit of 4, else a bevel). Returns several path strings; the caller unites them. The Element's own
// strokes keep strokeToShapeD.
export function strokeOutlineParts(d, width, cap, join) {
  const hw = Math.max(0.05, width / 2), scope = splitPaperScope(), out = [];
  let src; try { src = new scope.CompoundPath(d); } catch (e) { return out; }
  const disc = (c, r) => `M ${c[0] - r},${c[1]} a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0 Z`;
  const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]], nrm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const perp = v => [-v[1], v[0]];
  const joinAt = (v, a, b) => {   // a = incoming, b = outgoing unit directions
    if (join === 'round') { out.push(disc(v, hw)); return; }
    const na = perp(a), nb = perp(b), side = (a[0] * b[1] - a[1] * b[0]) > 0 ? -1 : 1;
    const p1 = [v[0] + side * hw * na[0], v[1] + side * hw * na[1]], p2 = [v[0] + side * hw * nb[0], v[1] + side * hw * nb[1]];
    const m = nrm([na[0] + nb[0], na[1] + nb[1]]), cosH = Math.abs(m[0] * na[0] + m[1] * na[1]);
    const ml = cosH > 1e-6 ? hw / cosH : Infinity;
    if (join !== 'bevel' && ml / hw <= 4) out.push(ptsToD([v, p1, [v[0] + side * m[0] * ml, v[1] + side * m[1] * ml], p2], true));
    else out.push(ptsToD([v, p1, p2], true));
  };
  const ribbon = (pts, startCap, endCap) => {
    const n = pts.length; if (n < 2) return;
    const left = [], right = [];
    pts.forEach((p, i) => {
      const dIn = i > 0 ? nrm(sub2(p, pts[i - 1])) : null, dOut = i < n - 1 ? nrm(sub2(pts[i + 1], p)) : null;
      const nIn = dIn && perp(dIn), nOut = dOut && perp(dOut);
      let nv = nIn && nOut ? nrm([nIn[0] + nOut[0], nIn[1] + nOut[1]]) : (nIn || nOut), k = hw;
      if (nIn && nOut) k = hw / Math.max(0.25, nv[0] * nIn[0] + nv[1] * nIn[1]);   // keep the width through a bend
      let q = p;
      if (cap === 'square' && ((i === 0 && startCap) || (i === n - 1 && endCap))) { const t = i === 0 ? dOut : dIn, sg = i === 0 ? -1 : 1; q = [p[0] + sg * t[0] * hw, p[1] + sg * t[1] * hw]; }
      left.push([q[0] + nv[0] * k, q[1] + nv[1] * k]); right.push([q[0] - nv[0] * k, q[1] - nv[1] * k]);
    });
    out.push(ptsToD(left.concat(right.reverse()), true));
    if (cap === 'round') { if (startCap) out.push(disc(pts[0], hw)); if (endCap) out.push(disc(pts[n - 1], hw)); }
  };
  (src.children && src.children.length ? src.children.slice() : [src]).forEach(sub => {
    const c = sub.clone({ insert: false });
    try { c.flatten(0.25); } catch (e) {}
    let pts = (c.segments || []).map(sg => [sg.point.x, sg.point.y]);
    c.remove();
    pts = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
    const closed = !!sub.closed;
    if (closed && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
    const n = pts.length; if (n < 2) return;
    const dirAt = i => nrm(sub2(pts[(i + 1) % n], pts[i]));
    const sharp = i => { const a = dirAt((i - 1 + n) % n), b = dirAt(i); return a[0] * b[0] + a[1] * b[1] < Math.cos(40 * Math.PI / 180); };
    const breaks = []; for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) if (sharp(i)) breaks.push(i);
    if (closed && !breaks.length) {   // one smooth loop: an outer and an inner ring
      const left = [], right = [];
      for (let i = 0; i < n; i++) { const a = perp(dirAt((i - 1 + n) % n)), b = perp(dirAt(i)), nv = nrm([a[0] + b[0], a[1] + b[1]]), k = hw / Math.max(0.25, nv[0] * a[0] + nv[1] * a[1]); left.push([pts[i][0] + nv[0] * k, pts[i][1] + nv[1] * k]); right.push([pts[i][0] - nv[0] * k, pts[i][1] - nv[1] * k]); }
      const cp = new scope.CompoundPath({ pathData: ptsToD(left, true) + ' ' + ptsToD(right.reverse(), true), insert: false });
      cp.reorient(false, true); out.push(cp.pathData); cp.remove();
      return;
    }
    if (closed) { const r = breaks[0]; pts = pts.slice(r).concat(pts.slice(0, r + 1)); }   // start at a corner, end on it
    const runs = [], cut = closed ? breaks.map(b => (b - breaks[0] + n) % n).concat([n]) : [0].concat(breaks, [n - 1]);
    for (let k = 0; k < cut.length - 1; k++) runs.push(pts.slice(cut[k], cut[k + 1] + 1));
    runs.forEach((r, k) => ribbon(r, !closed && k === 0, !closed && k === runs.length - 1));
    (closed ? cut.slice(0, -1) : breaks).forEach(i => { const v = pts[i], a = nrm(sub2(v, pts[i > 0 ? i - 1 : pts.length - 2])), b = nrm(sub2(pts[i + 1], v)); joinAt(v, a, b); });   // closed: pts ends on its start corner
  });
  src.remove();
  return out;
}
export function svgToTileGeo(svg) {
  if (!/<svg[\s>]/i.test(String(svg))) return null;   // Paper.js would fetch any other string as a URL
  const scope = splitPaperScope();
  const root = scope.project.importSVG(ensureSvgNamespace(String(svg).replace(/var\(--ink\)/g, '#000')), { expandShapes: true, insert: false });
  const parts = [], partsInk = [], whiteParts = [];
  // What is ink: visible, not a clip mask, not fully transparent (own or a parent's opacity). A white /
  // near-white paint is Paper (an uploaded file's background rect), used only if nothing else is drawn.
  const shown = it => { for (let p = it; p; p = p.parent) { if (!p.visible || p.opacity === 0) return false; } return !it.clipMask; };
  const isWhite = col => col && col.type !== 'gradient' && col.lightness > 0.97;
  // clip-path: Paper imports it as a group whose first child is the mask — every shape inside is cut to it
  const clipsOf = it => { const out = []; for (let g = it.parent; g; g = g.parent) if (g.clipped && g.firstChild && g.firstChild.clipMask && g.firstChild !== it) { let m = g.firstChild.clone({ insert: false }); if (m instanceof scope.Shape) { const q = m.toPath(false); m.remove(); m = q; } if (g.firstChild.parent) m.transform(g.firstChild.parent.globalMatrix); out.push(m); } return out; };   // the root's viewBox clip is a Shape (rect): booleans need a Path
  // a rectangular mask that already holds the shape (the viewBox, almost always) cuts nothing — skip the boolean
  const holds = (m, p) => Math.abs(Math.abs(m.area) - m.bounds.width * m.bounds.height) < 1e-3 * m.bounds.width * m.bounds.height && m.bounds.contains(p.bounds);
  const clipD = (d, masks) => {
    if (!masks.length || !d) return d;
    let p = new scope.CompoundPath({ pathData: d, insert: false });
    masks.forEach(m => { if (holds(m, p)) return; const q = p.intersect(m, { insert: false }); p.remove(); p = q; });
    const r = p.pathData; p.remove(); return r;
  };
  root.getItems({ match: it => (it instanceof scope.Path || it instanceof scope.CompoundPath || it instanceof scope.Shape) && !(it.parent instanceof scope.CompoundPath) }).forEach(src => {
    if (!shown(src)) return;
    const it = src instanceof scope.Shape ? src.toPath(false) : src;   // a clipped circle / rect stays a Shape on import
    if (it !== src) src.replaceWith(it);   // in its place, so its group's transform and clip still apply
    const masks = clipsOf(it);
    const push = (to, d) => { const r = clipD(d, masks); if (r) to.push(r); };
    const c = it.clone({ insert: false });
    if (it.parent) c.transform(it.parent.globalMatrix);
    // SVG's default fill is black even on a <line>: only a shape with area is filled; any stroke is outlined
    const filled = it.fillColor && it.fillColor.alpha !== 0 && Math.abs(it.area) > 1e-6, stroked = it.strokeColor && it.strokeColor.alpha !== 0 && it.strokeWidth > 0;
    const fillTo = isWhite(it.fillColor) ? whiteParts : partsInk, strokeTo = isWhite(it.strokeColor) ? whiteParts : partsInk;   // each paint on its own
    if (filled) {   // an evenodd fill keeps its holes: sub-paths re-wound so nonzero reads them the same way (a ring)
      if (it.fillRule === 'evenodd') { const cp = new scope.CompoundPath({ pathData: c.pathData, insert: false }); cp.reorient(false, true); push(fillTo, cp.pathData); cp.remove(); }
      else push(fillTo, c.pathData);
    }
    if (stroked) strokeOutlineParts(c.pathData, it.strokeWidth * Math.abs(it.parent ? it.parent.globalMatrix.scaling.x : 1), it.strokeCap, it.strokeJoin).forEach(d => push(strokeTo, d));   // the seed's own width, caps and joins
    c.remove(); masks.forEach(m => m.remove());
  });
  root.remove();
  parts.push(...(partsInk.length ? partsInk : whiteParts));
  if (!parts.length) return null;
  const ps = parts.map(d => new scope.CompoundPath({ pathData: d, insert: false }));
  let acc = null;
  for (const p of ps) acc = acc ? acc.unite(p, { insert: false }) : p.clone({ insert: false });
  // Paper's boolean can drop part of a shape that only touches the others at a point (Petal turn: four
  // petals meeting at the centre came out as two and two halves). Every part must survive the union:
  // a 9×9 grid of points inside each part must all be inside the result. If not, the parts are kept side
  // by side, each turned clockwise, so nonzero fill draws their union without a boolean.
  const survives = p => {
    const bb = p.bounds;
    for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
      const pt = new scope.Point(bb.x + bb.width * i / 10, bb.y + bb.height * j / 10);
      if (p.contains(pt) && !acc.contains(pt)) return false;
    }
    return true;
  };
  const lost = !ps.every(survives);
  let d, b;
  if (lost) {
    ps.forEach(p => p.reorient(true, true));   // outer contours clockwise, holes counter-clockwise
    d = ps.map(p => p.pathData).join(' ');
    b = ps.reduce((u, p) => (u ? u.unite(p.bounds) : p.bounds), null);
  } else { d = acc.pathData; b = acc.bounds; }
  acc.remove(); ps.forEach(p => p.remove());
  if (!d || !(b.width > 0 || b.height > 0)) return null;
  const ns = 100 / Math.max(b.width, b.height);
  return { d, fillRule: null, normScale: ns, normTx: -b.x + (100 - b.width * ns) / 2 / ns, normTy: -b.y + (100 - b.height * ns) / 2 / ns };
}
export function tileIconSVG(t) {
  if (!t || !t.geo || !t.geo.d) return '';
  const g = t.geo, attrs = Organica.shapeAppearance.styleAttrs({ fillMode: t.style.fillMode, color: 'currentColor', strokeW: t.style.strokeW, rounded: t.style.rounded });
  return `<svg viewBox="-6 -6 112 112" aria-hidden="true"><g transform="${tileNormAttr(g)}"><path d="${g.d}" ${attrs}${g.fillRule && t.style.fillMode !== 'stroke' ? ` fill-rule="${g.fillRule}"` : ''}/></g></svg>`;
}
export const libraryNamesAll = all => Object.keys(all || {});
// The tiles across a w×h canvas, in the canvas's 1/100-of-short-side units (k):
// a lattice rotated by Angle about the centre, Brick / Half-drop offsets, Turn.
export function elementTileLayout(g, w, h) {
  const k = Math.min(w, h) / 100, cx = w / 2 / k, cy = h / 2 / k, r = Math.hypot(w, h) / 2 / k;
  let s = Math.max(1, +g.patSpacing || 8), capped = false;
  const est = Math.pow(2 * r / s + 2, 2);
  if (est > TILE_CAP) { s *= Math.sqrt(est / TILE_CAP); capped = true; }
  const a = (+g.patAngle || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const n = Math.ceil(r / s) + 1, tiles = [], odd = v => ((v % 2) + 2) % 2;
  const PIN = [[0, 90], [270, 180]];
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const gx = i * s + (g.layout === 'brick' && odd(j) ? s / 2 : 0);
      const gy = j * s + (g.layout === 'halfdrop' && odd(i) ? s / 2 : 0);
      if (gx * gx + gy * gy > (r + s) * (r + s)) continue;
      const turn = g.turn === 'alternate' ? odd(i + j) * 180 : g.turn === 'quarter' ? PIN[odd(j)][odd(i)] : 0;
      tiles.push({ x: cx + gx * ca - gy * sa, y: cy + gx * sa + gy * ca, rot: (+g.patAngle || 0) + turn });
    }
  }
  return { k, size: s * Math.max(0.05, (g.patSize == null ? 70 : +g.patSize) / 100), tiles, capped, spacing: s };
}
export const tileNormAttr = geo => `translate(${(geo.normTx * geo.normScale).toFixed(4)},${(geo.normTy * geo.normScale).toFixed(4)}) scale(${geo.normScale.toFixed(4)})`;
// Same shape + style = same variant (drives the ✓).
export function tileSig(t) {
  const str = JSON.stringify([t.geo.d, t.geo.fillRule, t.geo.normTx, t.geo.normTy, t.geo.normScale, t.style]);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'el' + (h >>> 0).toString(36);
}
export function savedElementBySig(sig) {
  const all = ELEMENT_LIB.read();
  return Object.keys(all).find(n => all[n] && all[n].tile && !all[n].hidden && (all[n].sig || tileSig(all[n].tile)) === sig) || null;   // an entry saved before `sig` existed is matched by its shape
}
export function tileThumbSVG(t) {
  const g = t.geo, attrs = Organica.shapeAppearance.styleAttrs({ fillMode: t.style.fillMode, color: 'var(--ink)', strokeW: t.style.strokeW, rounded: t.style.rounded });
  return `<svg viewBox="-6 -6 112 112" aria-hidden="true"><g transform="${tileNormAttr(g)}"><path d="${g.d}" ${attrs}${g.fillRule && t.style.fillMode !== 'stroke' ? ` fill-rule="${g.fillRule}"` : ''}/></g></svg>`;
}
export const paperPatternGeo = (g, w, h) => { const k = Math.min(w, h) / 100; return { k, pg: hooks.patternGeometry(g, { cx: w / 2 / k, cy: h / 2 / k, r: Math.hypot(w, h) / 2 / k }) }; };
// A cell's own content override (Component Edit mode) replaces the shared
// Element's geometry for that one item; every other item keeps using the
// ONE `defaultGeo` computed once per render — a component with no edited
// cells renders byte-identical to before this existed.
export function resolveItemGeo(item, defaultGeo) {
  if (!item.content) return defaultGeo;
  return SEED_TYPES[item.content.seedType].geometry(item.content.seedParams);
}
// Deliberately still `geo` here, not resolveItemGeo(it, geo) — a per-cell
// content override (Component Edit mode) changes what a cell PAINTS, not
// the Container/Mask boundary silhouette, which stays the shared Element's
// outline for every cell regardless. Mixing per-cell shapes into the clip
// itself is a real, separate idea, out of scope for this pass.
export function componentBoundaryClipContent(items, geo, half) {
  const a = getElementAppearance();
  const stretch = Organica.shapeAppearance.stretchTransformAttr(a.w, a.l, 50, stretchOpts(a));
  return items.map(it => {
    const fit = it.cellSize / 100;
    const sx = (it.flipH ? -1 : 1) * it.scale * fit, sy = (it.flipV ? -1 : 1) * it.scale * fit;
    const tf = `translate(${(half + it.cx).toFixed(2)},${(half + it.cy).toFixed(2)}) rotate(${it.rotation}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-50,-50) ${stretch} translate(${(geo.normTx * geo.normScale).toFixed(4)},${(geo.normTy * geo.normScale).toFixed(4)}) scale(${geo.normScale.toFixed(4)})`;
    return `<path transform="${tf}" d="${geo.d}"/>`;
  }).join('');
}
export function readPatternControls() {
  return { patType: pv('sel-element-pattern'), patSpacing: val('rg-element-patspacing'), patWeight: val('rg-element-patweight'), patAngle: val('rg-element-patangle') };
}
// Paper pattern (the "Ground"): a pattern laid over the Paper, always covering the
// whole canvas, under everything else — in every step (Element preview, Component,
// Symbol, each nested Component's own paper). Switched on by the Pattern icon on the
// Palette's Paper row. `null` = plain Paper. Saved in the appearance object, so a
// saved Component / Symbol keeps its own. Units: 1/100 of the canvas's short side,
// so the same settings look alike on the Element preview, a Component and a Symbol.
export function readGroundControls() {
  if (!live.paperPatternOn) return null;
  const g = { patType: pv('sel-ground-pattern'), patSpacing: val('rg-ground-patspacing'), patWeight: val('rg-ground-patweight'), patAngle: val('rg-ground-patangle'), ink: +pv('sel-ground-ink') || 0 };
  if (g.patType === 'element') Object.assign(g, { src: pv('sel-ground-tile') || 'element', layout: pv('sel-ground-layout'), turn: pv('sel-ground-turn'), patSize: val('rg-ground-patsize') });
  return g;
}
export function liveElementTile() {
  const seed = getSeed();
  if (!seed || !SEED_TYPES[seed.type]) return null;
  const geo = SEED_TYPES[seed.type].geometry(seed);
  if (!geo || !geo.d) return null;
  // One silhouette: Stroke only for a single shape whose Style is Stroke; a stack / Fill / Pattern is a fill.
  const fm = pv('sel-element-fillmode'), stroke = !state.layers && fm === 'stroke';
  return { geo: { d: geo.d, fillRule: geo.fillRule || null, normTx: geo.normTx, normTy: geo.normTy, normScale: geo.normScale },
    style: stroke ? { fillMode: 'stroke', strokeW: val('rg-element-strokew'), rounded: pc('ck-element-rounded') } : { fillMode: 'fill' } };
}
export function resolveTile(g) {
  if (!g) return null;
  if (g.tile) return g.tile;
  const src = g.src || 'element';
  if (src.startsWith('saved:')) { const e = ELEMENT_LIB.read()[src.slice(6)]; return e ? e.tile : null; }
  if (src.startsWith('genesis:')) {
    const id = src.slice(8);
    if (!_genesisTileCache.has(id)) {
      const f = genesisTileForms().find(x => x.id === id);
      let geo = null;
      try { geo = f ? svgToTileGeo(f.svg) : null; } catch (e) { geo = null; }
      _genesisTileCache.set(id, geo ? { geo, style: { fillMode: 'fill' } } : null);
    }
    return _genesisTileCache.get(id);
  }
  return liveElementTile();
}
// What a save stores: the appearance with the tile frozen into it.
export function appearanceSnapshot() {
  const a = getElementAppearance();
  if (!a.ground || a.ground.patType !== 'element' || a.ground.tile) return a;
  const t = resolveTile(a.ground);
  return t ? { ...a, ground: { ...a.ground, tile: t } } : a;
}
export function elementTileSVG(g, w, h, clipId) {
  const t = resolveTile(g);
  if (!t || !t.geo || !t.geo.d) return '';
  const L = elementTileLayout(g, w, h), ink = groundInk(g), id = clipId + 't', sc = L.size / 100;
  const attrs = Organica.shapeAppearance.styleAttrs({ fillMode: t.style.fillMode, color: ink, strokeW: t.style.strokeW, rounded: t.style.rounded })
    + (t.geo.fillRule && t.style.fillMode !== 'stroke' ? ` fill-rule="${t.geo.fillRule}"` : '');
  const uses = L.tiles.map(p => `<use href="#${id}" transform="translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${p.rot}) scale(${sc.toFixed(4)}) translate(-50,-50)"/>`).join('');
  return `<defs><path id="${id}" d="${t.geo.d}" transform="${tileNormAttr(t.geo)}" ${attrs}/></defs>`
    + `<clipPath id="${clipId}"><rect width="${w}" height="${h}"/></clipPath><g clip-path="url(#${clipId})"><g transform="scale(${L.k.toFixed(4)})">${uses}</g></g>`;
}
export function paintElementTileCanvas(ctx, g, w, h) {
  const t = resolveTile(g);
  if (!t || !t.geo || !t.geo.d) return;
  const L = elementTileLayout(g, w, h), sc = L.size / 100, path = new Path2D(t.geo.d), geo = t.geo;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.scale(L.k, L.k);
  const op = Organica.shapeAppearance.applyCanvasStyle(ctx, { fillMode: t.style.fillMode, color: groundInk(g), strokeW: t.style.strokeW, rounded: t.style.rounded });
  for (const p of L.tiles) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.scale(sc, sc); ctx.translate(-50, -50);
    ctx.translate(geo.normTx * geo.normScale, geo.normTy * geo.normScale); ctx.scale(geo.normScale, geo.normScale);
    hooks.paintPath(ctx, op, path, geo);
    ctx.restore();
  }
  ctx.restore();
}
// ── Saved Elements — the Element as it is now, kept for reuse (Paper tile).
// Same store mechanism as the Component library (Organica.presetStore), its own
// key; a saved Element is not edited — only used, or removed.
// One orientation of the live Element as a tile: rotation / flip baked into the path
// (about the box centre, after the norm fit) — a saved variant is its own shape.
export function orientedElementTile(rot, flipH, flipV) {
  const t = liveElementTile();
  if (!t || (!rot && !flipH && !flipV)) return t;
  const g = t.geo, scope = splitPaperScope();
  const cp = importAsPaperShape(scope, g.d, g.fillRule);
  const m = new scope.Matrix().translate(50, 50).rotate(rot).scale(flipH ? -1 : 1, flipV ? -1 : 1).translate(-50, -50)
    .translate(g.normTx * g.normScale, g.normTy * g.normScale).scale(g.normScale);
  cp.transform(m);
  const d = cp.pathData; cp.remove();
  const style = t.style.fillMode === 'stroke' ? { ...t.style, strokeW: t.style.strokeW * g.normScale } : t.style;
  return { geo: { d, fillRule: g.fillRule || null, normTx: 0, normTy: 0, normScale: 1 }, style };
}
export function defaultElementName(label) {
  const type = getSeed().type;
  return (state.layers ? (state.layers.parts ? ((SEED_ICONS[state.layers.parts.source.type] || {}).name || state.layers.parts.source.type) + ' · parts' : 'Stack') : ((SEED_ICONS[type] || {}).name || type)) + (label && label !== '0°' ? ' · ' + label : '') + ' ' + new Date().toLocaleTimeString();
}
// The Element as drawn — its own inks (Palette, layer inks), this orientation, on its
// Paper (colour + texture, as the Element frame shows it) — kept with a saved Element as
// its thumbnail. data-paper="2" marks a thumbnail that already carries the texture.
export function elementVariantSVG(rot, flipH, flipV) {
  const seed = getSeed(), geo = SEED_TYPES[seed.type].geometry(seed);
  const paper = (hooks.isPaperNone(state.paperColor) ? '' : `<rect width="100" height="100" fill="${state.paperColor}"/>`) + paperPatternSVG(100, 100);
  const cs = cellShapeOf(seed);
  if (cs !== 'square') {   // the Element's canvas is its cell: Paper + shape inside the outline, framed like the Element step
    const k = cs === 'triangle' ? 50 / CELL_SHAPES.triangle.R : 1;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" data-paper="2"><g transform="translate(50,50) rotate(${rot}) scale(${(flipH ? -1 : 1) * k},${(flipV ? -1 : 1) * k}) translate(-50,-50)">`
      + hooks.clipToCellShapes([CELL_SHAPES[cs].poly], paper + hooks.elementPathMarkup(geo, colorAt(0))) + `</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" data-paper="2">${paper}<g transform="translate(50,50) rotate(${rot}) scale(${flipH ? -1 : 1},${flipV ? -1 : 1}) translate(-50,-50)">${hooks.elementPathMarkup(geo, colorAt(0))}</g></svg>`;
}
// A saved Element's thumbnail for the library. Thumbnails saved before Oct 4, 2026 drew
// the Paper colour only: their texture is added back here from the entry's own saved
// appearance and palette (nothing is rewritten in the store).
export function savedElementThumb(e) {
  if (!e.thumb) return tileThumbSVG(e.tile);
  if (/data-paper="2"/.test(e.thumb) || !e.appearance || !e.appearance.ground) return e.thumb;
  const pat = hooks.withEntryInks(e.colors, () => withAppearance(e.appearance, () => paperPatternSVG(100, 100)));
  if (!pat) return e.thumb;
  const at = e.thumb.indexOf('<g transform=');
  return at < 0 ? e.thumb : e.thumb.slice(0, at) + pat + e.thumb.slice(at);
}
export const groundInk = g => {
  const pal = live.inkPaletteOverride || state.colors, i = g.ink === 'cell' || g.ink == null ? 0 : +g.ink;
  return pal[((i % pal.length) + pal.length) % pal.length];
};
export function paperPatternSVG(w, h) {
  const g = getElementAppearance().ground;
  if (!g || !(w > 0) || !(h > 0)) return '';
  if (g.patType === 'element') return elementTileSVG(g, w, h, 'gnd' + hooks.nextDrawId());
  const id = 'gnd' + hooks.nextDrawId(), { k, pg } = paperPatternGeo(g, w, h);
  return `<clipPath id="${id}"><rect width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})"><g transform="scale(${k.toFixed(4)})"><path d="${pg.d}" ${hooks.patternAttrs(pg, groundInk(g))}/></g></g>`;
}
export function paintPaperPatternCanvas(ctx, w, h) {
  const g = getElementAppearance().ground;
  if (!g || !(w > 0) || !(h > 0)) return;
  if (g.patType === 'element') { paintElementTileCanvas(ctx, g, w, h); return; }
  const { k, pg } = paperPatternGeo(g, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.scale(k, k);
  hooks.paintPatternCanvas(ctx, pg, groundInk(g));
  ctx.restore();
}
// While set, getElementAppearance() returns it instead of the live controls —
// how a saved Component/Symbol (and the nested Components inside a Symbol)
// renders with the appearance it was SAVED with, not whatever the Element
// panel says now. Entries saved before this field existed fall back to plain.
// Export "Variants" override — merged over a saved Symbol's own appearance
// in renderedSymbolEntrySVG so the Grid tier can change Style too.
export function withAppearance(app, fn) {
  const prev = live.appearanceOverride;
  live.appearanceOverride = { ...DEFAULT_APPEARANCE, ...(app || {}) };
  try { return fn(); } finally { live.appearanceOverride = prev; }
}
export function getElementAppearance() {
  if (live.appearanceOverride) return live.appearanceOverride;
  return {
    fillMode: pv('sel-element-fillmode'),
    strokeW: val('rg-element-strokew'),
    rounded: pc('ck-element-rounded'),
    // A live multi-layer Element: these two controls edit the ACTIVE layer's
    // own look, so the Element-wide stretch is identity.
    w: state.layers ? 1 : val('rg-element-w'),
    l: state.layers ? 1 : val('rg-element-l'),
    scale: val('rg-element-scale'),
    mx: val('rg-element-mx'),
    my: val('rg-element-my'),
    rotate: val('rg-element-rotate'),
    ...readPatternControls(),
    ground: readGroundControls(),
  };
}
