// Flexible Visual System · engine/05-render-component — the engine part of 05-render-component.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  state
} from './00-core.js';
import {
  cellShapeStates
} from './01-geometry.js';
import {
  resolvedComponentDims
} from './03-rules.js';
import {
  patternOf
} from './04-appearance.js';
import { hooks, provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  SEED_PREVIEW_STATES_SQUARE: () => SEED_PREVIEW_STATES_SQUARE, patternGeometry: () => patternGeometry
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
  const a = hooks.getElementAppearance();
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
    const lk = hooks.layerLook(l, a);
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
      paintPatternCanvas(tc, patternGeometry(lk, placedExt(pl.mx, pl.my, pl.scale, lk.w, lk.l)), hooks.layerInkColor(l, color));
    } else if (role === 'fill') {
      const op = Organica.shapeAppearance.applyCanvasStyle(tc, { fillMode: lk.fillMode, color: hooks.layerInkColor(l, color), strokeW: lk.strokeW, rounded: lk.rounded });
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
