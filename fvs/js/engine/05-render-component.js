// Flexible Visual System · engine/05-render-component — the engine part of 05-render-component.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  colorAt, live, state
} from './00-core.js';
import {
  CELL_SHAPES, SEED_TYPES, cellShapeOf, cellShapeStates, importAsPaperShape, partsOf, splitPaperScope
} from './01-geometry.js';
import {
  componentRoleActive, resolvedComponentDims
} from './03-rules.js';
import {
  appearanceIsIdentity, appearanceMatrix, componentBoundaryClipContent, getElementAppearance,
  paintPaperPatternCanvas, paperPatternSVG, patternOf, resolveItemGeo, resolveUnderlyingComponent,
  stretchOpts, withAppearance
} from './04-appearance.js';
import { hooks, provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  SEED_PREVIEW_STATES_SQUARE: () => SEED_PREVIEW_STATES_SQUARE, clipToCellShapes: () => clipToCellShapes,
  elementPathMarkup: () => elementPathMarkup, nextDrawId: () => nextDrawId, paintPath: () => paintPath,
  paintPatternCanvas: () => paintPatternCanvas, patternAttrs: () => patternAttrs,
  patternGeometry: () => patternGeometry, stackGeometry: () => stackGeometry,
  withEntryInks: () => withEntryInks
});
// ── Stack (multi-layer Element) ───────────────────────────────────────
// Each layer is a normal Element shape + a placement (Move/Scale/Rotate about
// the cell centre) + an ink + a role. Painted bottom→top: 'fill' paints,
// 'container' clips everything below it to its outline, 'mask' knocks its
// outline out of everything below it. Layers above are never affected.
export const LAYER_ROLES = { fill: 'Filled', mask: 'Mask', container: 'Subtraction mask', pattern: 'Pattern' };   // same words as the Element's Content select
export const layerPlace = l => ({ mx: 0, my: 0, scale: 1, rotate: 0, ...(l.place || {}) });
// Style, Stroke W, Rounded caps, Width and Length are per layer (`l.look`) —
// a Segment layer strokes and a stretched layer stretches without touching the
// others. Appearance Scale / Move stay Element-wide (each layer already has its
// own place). A layer saved before this has no `look`: it follows the Element's
// Style, and its Width/Length ride on the Element-wide stretch as they did then.
// An Export "Variants" row (variantAppearance) still overrides Style/Stroke W.
export const LOOK_KEYS = ['fillMode', 'strokeW', 'rounded', 'w', 'l'];
export const lookStretch = lk => (lk.w !== 1 || lk.l !== 1 ? ` scale(${lk.w},${lk.l})` : '');
export const _stackFlatCache = new Map();
// ── Pattern fill (test) ──────────────────────────────────────────────
// Lines / Crosshatch / Dots / Concentric as plain vector geometry in the
// Element's own 0..100 box — clipped to a shape (Style = Pattern) or to the
// layers below (a Pattern layer). Real paths, no <pattern>/bitmap, so an SVG
// export stays one ink per path for print. Anchored at the box centre so the
// patterns of stacked layers line up; `ext` = the circle {cx,cy,r} to cover.
// Returns {d, mode: 'stroke'|'fill', w}.
export const _patCache = new Map();
export function patternGeometry(pat, ext) {
  const p = patternOf(pat), s = Math.max(1, +p.patSpacing), w = Math.max(0.1, +p.patWeight);
  const r = ext.r + s, cx = ext.cx, cy = ext.cy, f = v => v.toFixed(2);
  const key = [p.patType, s, w, p.patAngle, f(cx), f(cy), f(r)].join('|');
  if (_patCache.has(key)) return _patCache.get(key);
  let d = '', mode = 'stroke';
  const lines = deg => {
    const a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const dx = cx - 50, dy = cy - 50, cn = dx * nx + dy * ny, cu = dx * ux + dy * uy;
    for (let k = Math.floor((cn - r) / s); k <= Math.ceil((cn + r) / s); k++) {
      const o = k * s, bx = 50 + nx * o, by = 50 + ny * o;
      d += `M${f(bx + ux * (cu - r))} ${f(by + uy * (cu - r))}L${f(bx + ux * (cu + r))} ${f(by + uy * (cu + r))}`;
    }
  };
  if (p.patType === 'crosshatch') { lines(p.patAngle); lines(p.patAngle + 90); }
  else if (p.patType === 'dots') {
    mode = 'fill';
    const a = p.patAngle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), rd = w / 2;
    const dx = cx - 50, dy = cy - 50, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;   // ext centre in grid space
    for (let j = Math.floor((ly - r) / s); j <= Math.ceil((ly + r) / s); j++) {
      for (let i = Math.floor((lx - r) / s); i <= Math.ceil((lx + r) / s); i++) {
        const gx = i * s, gy = j * s;
        if ((gx - lx) ** 2 + (gy - ly) ** 2 > r * r) continue;
        const x = 50 + gx * ca - gy * sa, y = 50 + gx * sa + gy * ca;
        d += `M${f(x - rd)} ${f(y)}a${f(rd)} ${f(rd)} 0 1 0 ${f(2 * rd)} 0a${f(rd)} ${f(rd)} 0 1 0 ${f(-2 * rd)} 0`;
      }
    }
  } else if (p.patType === 'concentric') {
    for (let k = 1; k * s <= r * 2; k++) { const R = k * s; d += `M${f(cx - R)} ${f(cy)}a${f(R)} ${f(R)} 0 1 0 ${f(2 * R)} 0a${f(R)} ${f(R)} 0 1 0 ${f(-2 * R)} 0`; }
  } else lines(p.patAngle);
  const out = { d, mode, w };
  if (_patCache.size > 200) _patCache.clear();
  _patCache.set(key, out);
  return out;
}
export const patternAttrs = (pg, color) => pg.mode === 'fill' ? `fill="${color}"` : `fill="none" stroke="${color}" stroke-width="${pg.w}" stroke-linecap="butt"`;
export function paintPatternCanvas(ctx, pg, color) {
  const path = new Path2D(pg.d);
  if (pg.mode === 'fill') { ctx.fillStyle = color; ctx.fill(path); }
  else { ctx.strokeStyle = color; ctx.lineWidth = pg.w; ctx.lineCap = 'butt'; ctx.stroke(path); }
}
// The circle a placed shape can reach: its 0..100 box, moved/scaled/stretched, any rotation.
export const placedExt = (mx, my, scale, w, l) => ({ cx: 50 + (mx || 0), cy: 50 + (my || 0), r: 50 * Math.SQRT2 * (scale == null ? 1 : scale) * Math.max(w || 1, l || 1) });
// A Pattern layer covers the whole Element box (in its own placed frame).
export const patternLayerFrame = pl => `translate(${(50 + pl.mx).toFixed(3)},${(50 + pl.my).toFixed(3)}) rotate(${pl.rotate}) scale(${pl.scale}) translate(-50,-50)`;
export const patternLayerExt = pl => ({ cx: 50, cy: 50, r: 100 / Math.max(0.1, pl.scale) });
export let _stackAcc = null;
// Canvas twin of stackPathMarkup. Pure-fill stacks paint straight onto ctx;
// a container/mask needs an offscreen layer (destination-in / destination-out).
export function paintStackCanvas(ctx, geo, color) {
  const a = getElementAppearance();
  const fx = geo.layers.some(l => (l.role || 'fill') !== 'fill');
  let tc = ctx;
  if (fx) {
    const cv = ctx.canvas;
    if (!_stackAcc) _stackAcc = document.createElement('canvas');
    if (_stackAcc.width !== cv.width || _stackAcc.height !== cv.height) { _stackAcc.width = cv.width; _stackAcc.height = cv.height; }
    tc = _stackAcc.getContext('2d');
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, cv.width, cv.height);
    tc.setTransform(ctx.getTransform());
  }
  for (const l of geo.layers) {
    const g = l.geo, role = l.role || 'fill', pl = layerPlace(l);
    const lk = layerLook(l, a);
    if (role === 'pattern') {
      // the pattern cut out of everything below (the SVG's <mask>)
      const pg = patternGeometry(lk, patternLayerExt(pl));
      tc.save();
      tc.globalCompositeOperation = 'destination-out';
      tc.translate(50 + pl.mx, 50 + pl.my); tc.rotate(pl.rotate * Math.PI / 180); tc.scale(pl.scale, pl.scale); tc.translate(-50, -50);
      paintPatternCanvas(tc, pg, '#000');
      tc.restore();
      continue;
    }
    if (!g.d) continue;
    tc.save();
    const box = tc.getTransform();   // the Element box — where a pattern fill is laid out
    tc.translate(50 + pl.mx, 50 + pl.my); tc.rotate(pl.rotate * Math.PI / 180); tc.scale(pl.scale, pl.scale); tc.scale(lk.w, lk.l); tc.translate(-50, -50);
    tc.translate(g.normTx * g.normScale, g.normTy * g.normScale); tc.scale(g.normScale, g.normScale);
    const path = new Path2D(g.d);
    if (role === 'fill' && lk.fillMode === 'pattern') {
      tc.clip(path, g.fillRule || 'nonzero');
      tc.setTransform(box);
      paintPatternCanvas(tc, patternGeometry(lk, placedExt(pl.mx, pl.my, pl.scale, lk.w, lk.l)), layerInkColor(l, color));
    } else if (role === 'fill') {
      const op = Organica.shapeAppearance.applyCanvasStyle(tc, { fillMode: lk.fillMode, color: layerInkColor(l, color), strokeW: lk.strokeW, rounded: lk.rounded });
      paintPath(tc, op, path, g);
    } else {
      tc.globalCompositeOperation = role === 'container' ? 'destination-in' : 'destination-out';
      tc.fillStyle = '#000';
      tc.fill(path, g.fillRule || 'nonzero');
    }
    tc.restore();
  }
  if (fx) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(_stackAcc, 0, 0); ctx.restore(); }
}
// Fill with the geometry's own fill-rule (evenodd when Inner seed copies are on) — the canvas twin of the fill-rule attr above.
export function paintPath(ctx, op, path, geo) { if (op === 'fill') ctx.fill(path, (geo && geo.fillRule) || 'nonzero'); else ctx.stroke(path); }
export function componentGridOutlineSVG(items, size) {
  if (!state.componentGridOutline || !items.length) return '';
  const d = resolvedComponentDims(size), hx = d.w / 2, hy = d.h / 2;
  return `<g fill="none" stroke="var(--tool)" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none">` + items.map(it => it.poly
    ? `<polygon vector-effect="non-scaling-stroke" points="${it.poly.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}"/>`
    : `<rect vector-effect="non-scaling-stroke" x="${(hx + it.cx - it.cellSize / 2).toFixed(2)}" y="${(hy + it.cy - it.cellSize / 2).toFixed(2)}" width="${it.cellSize.toFixed(2)}" height="${it.cellSize.toFixed(2)}"/>`).join('') + `</g>`;
}
// Show grid, on a cell-shape lattice: the Grid shape that wraps the cells (the triangle round three packed
// circles, the hexagon round seven…) as a dashed guide — what the Component is as a whole, so its fit in a
// Symbol grid reads at a glance. The tightest polygon of that shape: per edge direction, the support of every
// cell point (max p·n), consecutive edge lines intersected; of the shape's possible orientations the one with
// the least area is the lattice's own. Screen only, never exported. → { svg, box: [x0,y0,x1,y1] } or null.
export const WRAP_NORMALS = {
  triangle: [0, 30, 60, 90].map(t => [90, 210, 330].map(a => a + t)),
  hexagon: [0, 30].map(t => [0, 60, 120, 180, 240, 300].map(a => a + t)),
  diamond: [0, 30, 60, 90, 120, 150].flatMap(a => [[a, a + 60, a + 180, a + 240], [a, a + 120, a + 180, a + 300]]),
  square: [[0, 90, 180, 270]],
};
export function gridWrapper(items, outline) {
  if (!state.componentGridOutline || !items.length || !items[0].poly || !WRAP_NORMALS[outline]) return null;
  const pts = items.flatMap(it => it.poly);
  let best = null;
  for (const set of WRAP_NORMALS[outline]) {
    const ns = set.map(a => ((a % 360) + 360) % 360).sort((x, y) => x - y).map(a => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)]);
    const h = ns.map(n => Math.max(...pts.map(p => p[0] * n[0] + p[1] * n[1])));
    const poly = ns.map((n, i) => {   // the corner between edge i and edge i+1
      const m = ns[(i + 1) % ns.length], hm = h[(i + 1) % ns.length], det = n[0] * m[1] - n[1] * m[0];
      return [(h[i] * m[1] - n[1] * hm) / det, (n[0] * hm - h[i] * m[0]) / det];
    });
    const area = Math.abs(poly.reduce((acc, p, i) => { const q = poly[(i + 1) % poly.length]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    if (poly.every(p => isFinite(p[0]) && isFinite(p[1])) && (!best || area < best.area - 1e-6)) best = { poly, area };
  }
  if (!best) return null;
  const xs = best.poly.map(p => p[0]), ys = best.poly.map(p => p[1]);
  return { svg: `<polygon class="grid-wrap" points="${best.poly.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="var(--tool)" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`,
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}
// The gallery thumbnail grows its viewBox to take the wrapper in, so it never runs into its neighbours.
export function withGridWrapper(svgStr, items, outline) {
  const w = gridWrapper(items, outline);
  if (!w) return svgStr;
  const vb = (svgStr.match(/viewBox="([^"]+)"/) || [])[1];
  let out = svgStr.replace(/<\/svg>$/, w.svg + '</svg>');
  if (vb) {
    const [x, y, vw, vh] = vb.split(/[\s,]+/).map(Number), pad = 0.02 * Math.max(vw, vh);
    const x0 = Math.min(x, w.box[0] - pad), y0 = Math.min(y, w.box[1] - pad), x1 = Math.max(x + vw, w.box[2] + pad), y1 = Math.max(y + vh, w.box[3] + pad);
    out = out.replace(/viewBox="[^"]+"/, `viewBox="${x0.toFixed(2)} ${y0.toFixed(2)} ${(x1 - x0).toFixed(2)} ${(y1 - y0).toFixed(2)}"`).replace(/(<svg[^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '$1');
  }
  return out;
}
export function latticeShapePath(items) {
  if (!items.length || !items[0].poly) return null;
  const p = new Path2D();
  items.forEach(it => { it.poly.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); });
  return p;
}
export function r2(n) { return Math.round(n * 100) / 100; }
// The 0°/no-flip state is dropped on purpose: it's pixel-identical to the big
// canvas below (same seed, same transform, just smaller) — showing it twice added no information.
export const SEED_PREVIEW_STATES_SQUARE = [
  [0, false, false, '0°'], [90, false, false, '90°'], [180, false, false, '180°'], [270, false, false, '270°'],
  [0, true, false, 'Flip H'], [0, false, true, 'Flip V'], [0, true, true, 'Flip H+V'],
];
export const seedPreviewStates = () => cellShapeStates(state.cellShape);
// The pattern's settings are Element-wide (Appearance), never a layer's own: a look
// saved with pattern keys (Oct 3 test build) is overridden by the Element's.
export function layerLook(l, a) {
  return { fillMode: a.fillMode, strokeW: a.strokeW, rounded: a.rounded, w: 1, l: 1, ...(l.look || {}), ...patternOf(a), ...(live.variantAppearance || {}) };
}
// place → norm-fit, as ONE transform string (a <clipPath>/<mask> child must be a bare <path>, no <g>).
export function layerTransformAttr(l, g) {
  const pl = layerPlace(l);
  return `translate(${(50 + pl.mx).toFixed(3)},${(50 + pl.my).toFixed(3)}) rotate(${pl.rotate}) scale(${pl.scale})${lookStretch(layerLook(l, {}))} translate(-50,-50)`
    + ` translate(${(g.normTx * g.normScale).toFixed(4)},${(g.normTy * g.normScale).toFixed(4)}) scale(${g.normScale.toFixed(4)})`;
}
// A saved Component draws its layers' fixed inks ("Ink 2") from ITS OWN saved palette,
// like its cell colours (entryInkAt) — never the live one.
export function withEntryInks(colors, fn) {
  const prev = live.inkPaletteOverride;
  if (colors && colors.length) live.inkPaletteOverride = colors;
  try { return fn(); } finally { live.inkPaletteOverride = prev; }
}
export function layerInkColor(l, cellColor) {
  const ink = live.layerInkOverride && l.id in live.layerInkOverride ? live.layerInkOverride[l.id] : l.ink;
  if (ink == null || ink === 'cell') return cellColor;
  const pal = live.inkPaletteOverride || state.colors;
  return pal[((ink % pal.length) + pal.length) % pal.length];
}
// The placed union of the FILL layers as one path (in the 0..100 space) via
// Paper.js — only feeds bbox measuring and Container/Mask boundaries.
export function stackFlatD(layers) {
  const key = JSON.stringify(layers.map(l => [l.role, layerPlace(l), ...(lookStretch(layerLook(l, {})) ? [lookStretch(layerLook(l, {}))] : []), l.geo.d, l.geo.fillRule, l.geo.normTx, l.geo.normTy, l.geo.normScale]));
  if (_stackFlatCache.has(key)) return _stackFlatCache.get(key);
  let d = '';
  try {
    const scope = splitPaperScope();
    const parts = [];
    for (const l of layers) {
      if ((l.role || 'fill') !== 'fill' || !l.geo.d) continue;
      const cp = importAsPaperShape(scope, l.geo.d, l.geo.fillRule);
      const pl = layerPlace(l), g = l.geo, m = new scope.Matrix();
      const lk = layerLook(l, {});
      m.translate(50 + pl.mx, 50 + pl.my); m.rotate(pl.rotate); m.scale(pl.scale); m.scale(lk.w, lk.l); m.translate(-50, -50);
      m.translate(g.normTx * g.normScale, g.normTy * g.normScale); m.scale(g.normScale);
      cp.transform(m);
      parts.push(cp.pathData);
      cp.remove();
    }
    d = parts.join(' ');
  } catch (e) { d = ''; }
  if (_stackFlatCache.size > 60) _stackFlatCache.clear();
  _stackFlatCache.set(key, d);
  return d;
}
export function stackGeometry(p) {
  // A hidden layer (the eye on its row) is skipped here once — every renderer,
  // export and nested Component/Symbol reads geo.layers.
  // A part layer (Element › Divide) draws its piece of the stack's source shape; a key the source no longer has draws nothing.
  // When the source cannot be divided the current way (Rhombi on 7 sides, a shape with no division), the parts
  // give way to the whole source shape in their place, in the cell's ink — never an empty Element.
  const parts = p && p.parts ? partsOf(p.parts) : null;
  let all = (p && p.layers) || [];
  if (parts && parts.reason && SEED_TYPES[p.parts.source && p.parts.source.type]) {
    const at = all.findIndex(l => l.part), whole = { id: 'whole', role: 'fill', ink: 'cell', place: { mx: 0, my: 0, scale: 1, rotate: 0 }, wholeSource: true };
    all = all.filter(l => !l.part);
    all.splice(at < 0 ? all.length : at, 0, whole);
  }
  const layers = all.filter(l => !l.hidden && (!l.part || (parts && parts.byKey[l.part])))
    .map(l => ({ ...l, geo: l.wholeSource ? SEED_TYPES[p.parts.source.type].geometry(p.parts.source) : l.part ? parts.byKey[l.part].geo : SEED_TYPES[l.seed.type].geometry(l.seed) }));
  return { d: stackFlatD(layers), normTx: 0, normTy: 0, normScale: 1, layers };
}
export function stackUid(geo) {
  let h = 2166136261;
  const str = JSON.stringify(geo.layers.map(l => [l.role, layerPlace(l), ...(lookStretch(layerLook(l, {})) ? [lookStretch(layerLook(l, {}))] : []), l.geo.d, l.geo.normTx, l.geo.normTy, l.geo.normScale]));
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'stk' + (h >>> 0).toString(36);
}
// The same per-drawing suffix for the Component Role and Symbol "Clip to cell" ids —
// both are drawn many times in one page (gallery, library, suggestions, hidden steps).
export const nextDrawId = () => 'd' + (++live._stackDrawSeq).toString(36);
export function stackPathMarkup(geo, color, forceFill) {
  const a = getElementAppearance();
  // Unique per drawing, not just per shape: url(#id) resolves to the FIRST
  // element with that id in the whole document, and the same stack is drawn
  // in many places at once — when the first copy sits in a hidden step
  // (the Element previews, display:none while on Component) its clipPath /
  // mask doesn't apply, so every Component thumbnail lost its Subtraction
  // mask / Mask. The `-<n>` suffix makes each drawing reference its own defs.
  const uid = stackUid(geo) + '-' + (++live._stackDrawSeq).toString(36);
  let out = '';
  geo.layers.forEach((l, i) => {
    const g = l.geo, t = layerTransformAttr(l, g), role = l.role || 'fill', id = `${uid}-${i}`;
    if (role === 'pattern') {
      // a mask made of the pattern: its lines / dots are cut out of every layer below
      if (forceFill) return;   // a boundary silhouette is the shapes below, unchanged
      const pl = layerPlace(l), pg = patternGeometry(layerLook(l, a), patternLayerExt(pl));
      if (!pg.d) return;
      out = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300"><rect x="-100" y="-100" width="300" height="300" fill="white"/>`
        + `<g transform="${patternLayerFrame(pl)}"><path d="${pg.d}" ${patternAttrs(pg, 'black')}/></g></mask><g mask="url(#${id})">${out}</g>`;
      return;
    }
    if (!g.d) return;
    if (role === 'container') {
      out = `<clipPath id="${id}"><path d="${g.d}" transform="${t}"${g.fillRule ? ` clip-rule="${g.fillRule}"` : ''}/></clipPath><g clip-path="url(#${id})">${out}</g>`;
    } else if (role === 'mask') {
      out = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300"><rect x="-100" y="-100" width="300" height="300" fill="white"/>`
        + `<path d="${g.d}" transform="${t}" fill="black"${g.fillRule ? ` fill-rule="${g.fillRule}"` : ''}/></mask><g mask="url(#${id})">${out}</g>`;
    } else {
      const lk = layerLook(l, a), fm = forceFill ? 'fill' : lk.fillMode, ink = forceFill ? color : layerInkColor(l, color);
      if (fm === 'pattern') {
        const pl = layerPlace(l), pg = patternGeometry(lk, placedExt(pl.mx, pl.my, pl.scale, lk.w, lk.l));
        out += `<clipPath id="${id}p"><path d="${g.d}" transform="${t}"${g.fillRule ? ` clip-rule="${g.fillRule}"` : ''}/></clipPath><g clip-path="url(#${id}p)"${live.tagParts && l.part ? ` data-part="${l.id}"` : ''}><path d="${pg.d}" ${patternAttrs(pg, ink)}/></g>`;
        return;
      }
      const attrs = Organica.shapeAppearance.styleAttrs({ fillMode: fm, color: ink, strokeW: lk.strokeW, rounded: lk.rounded });
      const tag = live.tagParts && l.part ? ` data-part="${l.id}"` : '';   // the Element canvas in Edit parts only — never an export
      out += `<g transform="${t}"${tag}><path d="${g.d}" ${attrs}${g.fillRule && fm === 'fill' ? ` fill-rule="${g.fillRule}"` : ''}/></g>`;
    }
  });
  if (appearanceIsIdentity(a)) return out;
  return `<g transform="${Organica.shapeAppearance.stretchTransformAttr(a.w, a.l, 50, stretchOpts(a))}">${out}</g>`;
}
// Style + paint one geometry on a canvas whose transform already places it —
// the single Canvas2D paint step drawItemsPlain / Symbol seed cells share.
export function paintGeoCanvas(ctx, geo, path, color) {
  if (geo.layers) { paintStackCanvas(ctx, geo, color); return; }
  const a = getElementAppearance();
  if (a.fillMode === 'pattern') {
    // ctx = box · stretch · norm (the callers' order); clip there, then lay the
    // pattern out in the box itself so Width/Length don't distort its spacing.
    ctx.save();
    ctx.clip(path, (geo && geo.fillRule) || 'nonzero');
    let box = ctx.getTransform().multiply(new DOMMatrix().translate(geo.normTx * geo.normScale, geo.normTy * geo.normScale).scale(geo.normScale).inverse());
    if (!appearanceIsIdentity(a)) box = box.multiply(appearanceMatrix(a).inverse());
    ctx.setTransform(box);
    paintPatternCanvas(ctx, patternGeometry(a, placedExt(a.mx, a.my, a.scale, a.w, a.l)), color);
    ctx.restore();
    return;
  }
  paintPath(ctx, Organica.shapeAppearance.applyCanvasStyle(ctx, { fillMode: a.fillMode, color, strokeW: a.strokeW, rounded: a.rounded }), path, geo);
}
// The inner half of every per-cell/preview <g>: stretch layer (identity, and
// omitted, at w=l=1) → norm-fit layer → the styled path. `forceFill` is for
// Container/Mask boundaries, whose silhouette must stay solid regardless of
// an outline-only Style.
export function elementPathMarkup(geo, color, forceFill) {
  if (geo.layers) return stackPathMarkup(geo, color, forceFill);
  const a = getElementAppearance();
  if (a.fillMode === 'pattern' && !forceFill) {
    // clip = the shape through stretch + norm; the pattern itself sits in the plain box
    const normT = `translate(${(geo.normTx * geo.normScale).toFixed(4)},${(geo.normTy * geo.normScale).toFixed(4)}) scale(${geo.normScale.toFixed(4)})`;
    const t = appearanceIsIdentity(a) ? normT : `${Organica.shapeAppearance.stretchTransformAttr(a.w, a.l, 50, stretchOpts(a))} ${normT}`;
    const id = 'pat' + nextDrawId(), pg = patternGeometry(a, placedExt(a.mx, a.my, a.scale, a.w, a.l));
    return `<clipPath id="${id}"><path d="${geo.d}" transform="${t}"${geo.fillRule ? ` clip-rule="${geo.fillRule}"` : ''}/></clipPath><g clip-path="url(#${id})"><path d="${pg.d}" ${patternAttrs(pg, color)}/></g>`;
  }
  const attrs = Organica.shapeAppearance.styleAttrs({ fillMode: forceFill ? 'fill' : a.fillMode, color, strokeW: a.strokeW, rounded: a.rounded });
  const norm = `<g transform="translate(${(geo.normTx * geo.normScale).toFixed(4)},${(geo.normTy * geo.normScale).toFixed(4)}) scale(${geo.normScale.toFixed(4)})">`
    + `<path d="${geo.d}" ${attrs}${geo.fillRule && !forceFill ? ` fill-rule="${geo.fillRule}"` : ''}/></g>`;
  if (appearanceIsIdentity(a)) return norm;
  return `<g transform="${Organica.shapeAppearance.stretchTransformAttr(a.w, a.l, 50, stretchOpts(a))}">${norm}</g>`;
}
// Canvas2D twin of elementPathMarkup: apply the stretch layer to the
// current transform (call after translate(-50,-50), before the norm layer).
export function applyElementStretchCanvas(ctx) {
  const a = getElementAppearance();
  if (appearanceIsIdentity(a)) return;
  ctx.transform(...(m => [m.a, m.b, m.c, m.d, m.e, m.f])(appearanceMatrix(a)));
}
// Mask's own content tolerates <g> wrapping fine (confirmed directly,
// unlike <clipPath>) — reuses the normal two-level per-item transform,
// just forcing fill="#000" (mask luminance: black = hidden = "not part of
// the boundary" is backwards from what we want here — see below, the
// KNOCKOUT reads black-on-white as the erased region, so the boundary
// shapes ARE painted black on a white base, exactly the hole we want).
export function componentBoundaryMaskContent(items, geo, half) {
  return items.map(it => {
    const fit = it.cellSize / 100;
    const sx = (it.flipH ? -1 : 1) * it.scale * fit, sy = (it.flipV ? -1 : 1) * it.scale * fit;
    return `<g transform="translate(${(half + it.cx).toFixed(2)},${(half + it.cy).toFixed(2)}) rotate(${it.rotation}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-50,-50)">`
      + elementPathMarkup(geo, '#000', true) + `</g>`;
  }).join('');
}
export function drawItemsPlain(ctx, itemsToDraw, geo, path, boxW, boxH, multiply) {
  const halfX = boxW / 2, halfY = (boxH == null ? boxW : boxH) / 2;
  const overrideCache = new Map();   // seedType|params → {geo,path}, so several cells sharing one override don't re-tessellate
  for (const it of itemsToDraw) {
    let itGeo = geo, itPath = path;
    if (it.content) {
      const key = it.content.seedType + '|' + JSON.stringify(it.content.seedParams || null);
      let hit = overrideCache.get(key);
      if (!hit) { const g = resolveItemGeo(it, geo); hit = { geo: g, path: new Path2D(g.d) }; overrideCache.set(key, hit); }
      itGeo = hit.geo; itPath = hit.path;
    }
    const drawOne = () => {
      ctx.save();
      if (multiply) ctx.globalCompositeOperation = 'multiply';   // Blend → Multiply: each cell's ink mixes with what is under it
      ctx.translate(halfX + it.cx, halfY + it.cy);
      ctx.rotate(it.rotation * Math.PI / 180);
      const fit = it.cellSize / 100;
      ctx.scale((it.flipH ? -1 : 1) * it.scale * fit, (it.flipV ? -1 : 1) * it.scale * fit);
      ctx.translate(-50, -50);
      applyElementStretchCanvas(ctx);   // reads getElementAppearance() itself — must run inside the withAppearance below too
      ctx.translate(itGeo.normTx * itGeo.normScale, itGeo.normTy * itGeo.normScale);
      ctx.scale(itGeo.normScale, itGeo.normScale);
      paintGeoCanvas(ctx, itGeo, itPath, it.color);
      ctx.restore();
    };
    // A cell with its own content carries its own Appearance snapshot too
    // (Component Edit mode) — withAppearance makes every getElementAppearance()
    // read inside drawOne() (including applyElementStretchCanvas's own) see
    // that snapshot instead of the live/global panel, for this item only.
    if (it.content && it.content.appearance) withAppearance(it.content.appearance, drawOne);
    else drawOne();
  }
}
// SVG: `content` clipped to the union of `polys` (each a point list, in the content's own coords); as-is when polys is null.
export function clipToCellShapes(polys, content) {
  if (!polys) return content;
  const id = 'cellsclip-' + nextDrawId();
  return `<clipPath id="${id}">${polys.map(p => `<polygon points="${p.map(q => q.map(v => v.toFixed(2)).join(',')).join(' ')}"/>`).join('')}</clipPath><g clip-path="url(#${id})">${content}</g>`;
}
export function drawComponentCanvas(ctx, items, seed, size) {
  const dims = resolvedComponentDims(size);
  ctx.clearRect(0, 0, dims.w, dims.h);
  const geo = SEED_TYPES[seed.type].geometry(seed);
  const path = new Path2D(geo.d);
  const under = (state.componentRole === 'container' || state.componentRole === 'mask') ? resolveUnderlyingComponent(state.underlyingComponentName) : null;

  if (!under) {
    const shape = latticeShapePath(items);
    if (shape) { ctx.save(); ctx.clip(shape); }
    hooks.fillPaper(ctx, state.paperColor, 0, 0, dims.w, dims.h);
    paintPaperPatternCanvas(ctx, dims.w, dims.h);
    drawItemsPlain(ctx, items, geo, path, dims.w, dims.h, state.componentBlend === 'multiply');
    if (shape) ctx.restore();
    return;
  }

  size = dims.w;   // role active — resolvedComponentDims already forced dims.w === dims.h
  // ONE combined Path2D unioning every cell's own transformed outline —
  // Canvas2D has no <clipPath>-style bug (it never parses markup), so this
  // is the direct, simple equivalent of the SVG boundary-flatten above.
  const half = size / 2;
  const boundaryPath = new Path2D();
  const boundaryApp = getElementAppearance();
  for (const it of items) {
    const fit = it.cellSize / 100;
    const sx = (it.flipH ? -1 : 1) * it.scale * fit, sy = (it.flipV ? -1 : 1) * it.scale * fit;
    const m = new DOMMatrix()
      .translate(half + it.cx, half + it.cy).rotate(it.rotation).scale(sx, sy).translate(-50, -50)
      .multiply(appearanceMatrix(boundaryApp))
      .translate(geo.normTx * geo.normScale, geo.normTy * geo.normScale).scale(geo.normScale, geo.normScale);
    boundaryPath.addPath(path, m);
  }

  const underGeo = SEED_TYPES[under.seed.type].geometry(under.seed);
  const underPath = new Path2D(underGeo.d);
  const fitScale = size / under.size;

  if (state.componentRole === 'container') {
    ctx.save();
    ctx.clip(boundaryPath);
    hooks.fillPaper(ctx, under.paperColor, 0, 0, size, size);
    withAppearance(under.appearance, () => paintPaperPatternCanvas(ctx, size, size));
    ctx.save();
    ctx.scale(fitScale, fitScale);
    withEntryInks(under.colors, () => withAppearance(under.appearance, () => drawItemsPlain(ctx, under.items, underGeo, underPath, under.size)));
    ctx.restore();
    ctx.restore();
  } else {
    // Mask: paint this Component's own paper + the underlying Component
    // normally, then erase the boundary's own silhouette to REAL alpha
    // transparency (destination-out) — the same unifying mechanism
    // confirmed for Creator: "empty" wherever nothing else is beneath,
    // a genuine hole wherever there is.
    hooks.fillPaper(ctx, state.paperColor, 0, 0, size, size);
    paintPaperPatternCanvas(ctx, size, size);
    ctx.save();
    ctx.scale(fitScale, fitScale);
    hooks.fillPaper(ctx, under.paperColor, 0, 0, under.size, under.size);
    withEntryInks(under.colors, () => withAppearance(under.appearance, () => paintPaperPatternCanvas(ctx, under.size, under.size)));
    withEntryInks(under.colors, () => withAppearance(under.appearance, () => drawItemsPlain(ctx, under.items, underGeo, underPath, under.size)));
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fill(boundaryPath);
    ctx.restore();
  }
}
// Just the body markup (paper rect + clip/mask + items), no outer <svg> or
// <metadata> — the piece both buildComponentSVG() (Screen mode + Figma)
// and buildPrintComponentSVG() (Print mode) wrap.
export function buildComponentSVGBody(items, seed, size) {
  const dims = resolvedComponentDims(size);
  const halfX = dims.w / 2, halfY = dims.h / 2;
  const geo = SEED_TYPES[seed.type].geometry(seed);
  const under = (state.componentRole === 'container' || state.componentRole === 'mask') ? resolveUnderlyingComponent(state.underlyingComponentName) : null;
  // Container keeps the usual unconditional paper rect (the boundary only
  // ever occupies its own small item area — everywhere else stays plain
  // paper, same as any other item). Mask does NOT paint one here: a real
  // alpha-transparent knockout has to erase THROUGH the paper too, so for
  // mask the paper rect moves inside the masked group below instead —
  // otherwise the "hole" would only remove the underlying layer and still
  // show opaque paper underneath, not a genuine hole.
  let body = (under && state.componentRole === 'mask') ? '' : `<rect width="${dims.w}" height="${dims.h}" fill="${state.paperColor}"/>` + paperPatternSVG(dims.w, dims.h);
  const latticeClip = !under && items.length && items[0].poly ? 'cellsclip-' + nextDrawId() : null;

  if (under) {
    // Role active — resolvedComponentDims already forced dims.w === dims.h,
    // so the rest of this branch keeps the existing square-frame maths
    // (`size`/`half`) exactly as before.
    const size2 = dims.w, half = size2 / 2;
    const underGeo = SEED_TYPES[under.seed.type].geometry(under.seed);
    const fitScale = size2 / under.size;
    let underBody = `<rect width="${under.size}" height="${under.size}" fill="${under.paperColor}"/>` + withEntryInks(under.colors, () => withAppearance(under.appearance, () => paperPatternSVG(under.size, under.size)));
    for (const it of under.items) {
      const fit = it.cellSize / 100;
      const sx = (it.flipH ? -1 : 1) * it.scale * fit, sy = (it.flipV ? -1 : 1) * it.scale * fit;
      underBody += `<g transform="translate(${(under.size / 2 + it.cx).toFixed(2)},${(under.size / 2 + it.cy).toFixed(2)}) rotate(${it.rotation}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-50,-50)">`
        + withEntryInks(under.colors, () => withAppearance(under.appearance, () => elementPathMarkup(resolveItemGeo(it, underGeo), it.color))) + `</g>`;
    }
    // fitScale maps the underlying Component's own frame exactly onto this
    // one's (size2 = under.size * fitScale by construction) — a plain
    // scale from the origin already covers corner-to-corner, no centring
    // offset needed since both frames are square.
    const underWrapped = `<g transform="scale(${fitScale.toFixed(4)})">${underBody}</g>`;
    const uid = 'compfx-' + String(state.underlyingComponentName).replace(/[^a-zA-Z0-9_-]/g, '_') + '-' + nextDrawId();   // unique per drawing (see nextDrawId)
    if (state.componentRole === 'container') {
      body += `<clipPath id="${uid}">${componentBoundaryClipContent(items, geo, half)}</clipPath>`
        + `<g clip-path="url(#${uid})">${underWrapped}</g>`;
    } else {
      body += `<mask id="${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${size2}" height="${size2}">`
        + `<rect width="${size2}" height="${size2}" fill="white"/>${componentBoundaryMaskContent(items, geo, half)}</mask>`
        + `<g mask="url(#${uid})"><rect width="${size2}" height="${size2}" fill="${state.paperColor}"/>${paperPatternSVG(size2, size2)}${underWrapped}</g>`;
    }
  } else {
    for (const it of items) {
      const fit = it.cellSize / 100;
      const sx = (it.flipH ? -1 : 1) * it.scale * fit;
      const sy = (it.flipV ? -1 : 1) * it.scale * fit;
      // A cell with its own content carries its own Appearance snapshot too
      // (Component Edit mode) — withAppearance makes elementPathMarkup's own
      // getElementAppearance() read see that snapshot instead of the live/
      // global panel, for this one item only; every other item keeps
      // reading whatever appearance is already in effect for this whole
      // call (the live panel normally, or componentEditDefaultAppearance
      // while renderComponentEditCanvas has it wrapped).
      const markup = (it.content && it.content.appearance)
        ? withAppearance(it.content.appearance, () => elementPathMarkup(resolveItemGeo(it, geo), it.color))
        : elementPathMarkup(resolveItemGeo(it, geo), it.color);
      body += `<g transform="translate(${(halfX + it.cx).toFixed(2)},${(halfY + it.cy).toFixed(2)}) rotate(${it.rotation}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-50,-50)"${state.componentBlend === 'multiply' ? ' style="mix-blend-mode:multiply"' : ''}>`
        + markup + `</g>`;
    }
  }
  // A cell-shape lattice: the canvas is the cells' own outline — Paper and cells clipped to it.
  if (latticeClip) body = `<clipPath id="${latticeClip}">${items.map(it => `<polygon points="${it.poly.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}"/>`).join('')}</clipPath><g clip-path="url(#${latticeClip})">${body}</g>`;
  return body;
}
export function buildComponentSVG(items, seed, size) {
  const dims = resolvedComponentDims(size);
  const meta = { tool: 'FVS', ruleSource: state.selectedRuleSource || '', cells: items.length, exportedAt: new Date().toISOString() };
  const body = buildComponentSVGBody(items, seed, size);
  const cellCls = items.length && items[0].poly && !componentRoleActive() ? ' class="is-cell"' : '';   // a cell-shape lattice: the canvas is its outline
  return `<svg xmlns="http://www.w3.org/2000/svg"${cellCls} width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}">`
    + `<metadata>${JSON.stringify(meta)}</metadata>` + body + `</svg>`;
}
// ── Seed preview strip — the current Seed on its own, at 0/90/
// 180/270° and each flip, so an asymmetric or uploaded shape's behaviour
// under a transform is visible before committing to a full grid
// generation. Shares the same geometry/transform discipline as
// buildComponentSVG, for exactly one item instead of a 4-cell grid. ──
export function buildSeedPreviewSVG(seed, rotation, flipH, flipV, size, opts = {}) {
  const geo = SEED_TYPES[seed.type].geometry(seed);
  const half = size / 2;
  // A non-square cell shape IS the canvas: Paper only inside its outline, transparent outside, framed by
  // its circumradius so every turn stays in view.
  const cs = cellShapeOf(seed), k = cs === 'triangle' ? 50 / CELL_SHAPES.triangle.R : 1;
  const sx = (flipH ? -1 : 1) * (size / 100) * k, sy = (flipV ? -1 : 1) * (size / 100) * k;
  const T = `translate(${half},${half}) rotate(${rotation}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-50,-50)`;
  const body = `<g transform="${T}">` + elementPathMarkup(geo, colorAt(0)) + `</g>`;
  if (cs === 'square') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
      + `<rect width="${size}" height="${size}" fill="${state.paperColor}"/>${paperPatternSVG(size, size)}${body}</svg>`;
  }
  const pts = CELL_SHAPES[cs].poly.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');
  const id = 'cellclip-' + nextDrawId();
  const edge = opts.outline ? `<polygon class="cell-edge" transform="${T}" points="${pts}" fill="none" stroke="var(--border-strong)" stroke-width="1" vector-effect="non-scaling-stroke"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="is-cell" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<clipPath id="${id}"><polygon transform="${T}" points="${pts}"/></clipPath>`
    + `<g clip-path="url(#${id})"><rect width="${size}" height="${size}" fill="${state.paperColor}"/>${paperPatternSVG(size, size)}${body}</g>${edge}</svg>`;
}
// A saved Element drawn from its entry alone — its own inks, Paper and appearance, its orientation. For a copy that
// carries no cached thumbnail (a Figure graph's content node keeps the entry without it): drawing it from the outline
// alone painted every saved Element in --ink, black and white (Diego, Oct 9, 2026).
export function savedElementEntrySVG(e) {
  if (!e || !e.seed || !SEED_TYPES[e.seed.type]) return '';
  const o = e.orientation || {}, prev = { paper: state.paperColor, colors: state.colors };
  state.paperColor = e.paperColor || '#ffffff';
  if (e.colors && e.colors.length) state.colors = e.colors.slice();   // colorAt(0) reads state.colors, layer inks the override
  try { return withEntryInks(e.colors, () => withAppearance(e.appearance, () => buildSeedPreviewSVG(e.seed, o.rotation || 0, !!o.flipH, !!o.flipV, 100))); }
  finally { state.paperColor = prev.paper; state.colors = prev.colors; }
}
