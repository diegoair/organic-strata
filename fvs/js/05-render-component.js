// Flexible Visual System · 05-render-component — Component render — stack layers, canvas + SVG, seed preview strip, gallery.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import { rt } from './rt.js';
import {
  colorAt, ctrl, printSizePanel, setStatus, state
} from './00-core.js';
import {
  CELL_SHAPES, SEED_TYPES, cellShapeOf, cellShapeStates, frameDims, importAsPaperShape, pathBBox,
  resolveGridCells, splitPaperScope
} from './01-geometry.js';
import {
  getSeed, seedForSnapshot
} from './02-seed-ui.js';
import {
  componentRoleActive, getGrid, resolvedComponentDims, setGalleryThumbVars
} from './03-rules.js';
import {
  appearanceIsIdentity, appearanceMatrix, buildComponentItems, componentBoundaryClipContent,
  getElementAppearance, mountElementQuickSaves, paintPaperPatternCanvas, paperPatternSVG, patternOf,
  quickSaveButton, resolveItemGeo, resolveUnderlyingComponent, stretchOpts, withAppearance
} from './04-appearance.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  SEED_PREVIEW_STATES_SQUARE: () => SEED_PREVIEW_STATES_SQUARE, clipToCellShapes: () => clipToCellShapes,
  currentElementView: () => currentElementView, elementPathMarkup: () => elementPathMarkup,
  elementViewIndex: () => elementViewIndex, layerPlace: () => layerPlace, nextDrawId: () => nextDrawId,
  paintPath: () => paintPath, paintPatternCanvas: () => paintPatternCanvas,
  patternAttrs: () => patternAttrs, patternGeometry: () => patternGeometry,
  renderGallery: () => renderGallery, renderSeedPreview: () => renderSeedPreview,
  seedPreviewStates: () => seedPreviewStates, stackGeometry: () => stackGeometry,
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
// The pattern's settings are Element-wide (Appearance), never a layer's own: a look
// saved with pattern keys (Oct 3 test build) is overridden by the Element's.
export function layerLook(l, a) {
  return { fillMode: a.fillMode, strokeW: a.strokeW, rounded: a.rounded, w: 1, l: 1, ...(l.look || {}), ...patternOf(a), ...(rt.variantAppearance || {}) };
}
export const lookStretch = lk => (lk.w !== 1 || lk.l !== 1 ? ` scale(${lk.w},${lk.l})` : '');
// place → norm-fit, as ONE transform string (a <clipPath>/<mask> child must be a bare <path>, no <g>).
export function layerTransformAttr(l, g) {
  const pl = layerPlace(l);
  return `translate(${(50 + pl.mx).toFixed(3)},${(50 + pl.my).toFixed(3)}) rotate(${pl.rotate}) scale(${pl.scale})${lookStretch(layerLook(l, {}))} translate(-50,-50)`
    + ` translate(${(g.normTx * g.normScale).toFixed(4)},${(g.normTy * g.normScale).toFixed(4)}) scale(${g.normScale.toFixed(4)})`;
}
rt.inkPaletteOverride = null;   // set while rendering a saved entry with ITS palette (withEntryInks)
// A saved Component draws its layers' fixed inks ("Ink 2") from ITS OWN saved palette,
// like its cell colours (entryInkAt) — never the live one.
export function withEntryInks(colors, fn) {
  const prev = rt.inkPaletteOverride;
  if (colors && colors.length) rt.inkPaletteOverride = colors;
  try { return fn(); } finally { rt.inkPaletteOverride = prev; }
}
export let layerInkOverride = null;     // {layerId: 'cell'|slot} — set while rendering a colour-variant thumbnail
export function layerInkColor(l, cellColor) {
  const ink = layerInkOverride && l.id in layerInkOverride ? layerInkOverride[l.id] : l.ink;
  if (ink == null || ink === 'cell') return cellColor;
  const pal = rt.inkPaletteOverride || state.colors;
  return pal[((ink % pal.length) + pal.length) % pal.length];
}
export const _stackFlatCache = new Map();
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
  const layers = ((p && p.layers) || []).filter(l => !l.hidden).map(l => ({ ...l, geo: SEED_TYPES[l.seed.type].geometry(l.seed) }));
  return { d: stackFlatD(layers), normTx: 0, normTy: 0, normScale: 1, layers };
}
export function stackUid(geo) {
  let h = 2166136261;
  const str = JSON.stringify(geo.layers.map(l => [l.role, layerPlace(l), ...(lookStretch(layerLook(l, {})) ? [lookStretch(layerLook(l, {}))] : []), l.geo.d, l.geo.normTx, l.geo.normTy, l.geo.normScale]));
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'stk' + (h >>> 0).toString(36);
}
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

export let _stackDrawSeq = 0;
// The same per-drawing suffix for the Component Role and Symbol "Clip to cell" ids —
// both are drawn many times in one page (gallery, library, suggestions, hidden steps).
export const nextDrawId = () => 'd' + (++_stackDrawSeq).toString(36);
export function stackPathMarkup(geo, color, forceFill) {
  const a = getElementAppearance();
  // Unique per drawing, not just per shape: url(#id) resolves to the FIRST
  // element with that id in the whole document, and the same stack is drawn
  // in many places at once — when the first copy sits in a hidden step
  // (the Element previews, display:none while on Component) its clipPath /
  // mask doesn't apply, so every Component thumbnail lost its Subtraction
  // mask / Mask. The `-<n>` suffix makes each drawing reference its own defs.
  const uid = stackUid(geo) + '-' + (++_stackDrawSeq).toString(36);
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
        out += `<clipPath id="${id}p"><path d="${g.d}" transform="${t}"${g.fillRule ? ` clip-rule="${g.fillRule}"` : ''}/></clipPath><g clip-path="url(#${id}p)"><path d="${pg.d}" ${patternAttrs(pg, ink)}/></g>`;
        return;
      }
      const attrs = Organica.shapeAppearance.styleAttrs({ fillMode: fm, color: ink, strokeW: lk.strokeW, rounded: lk.rounded });
      out += `<g transform="${t}"><path d="${g.d}" ${attrs}${g.fillRule && fm === 'fill' ? ` fill-rule="${g.fillRule}"` : ''}/></g>`;
    }
  });
  if (appearanceIsIdentity(a)) return out;
  return `<g transform="${Organica.shapeAppearance.stretchTransformAttr(a.w, a.l, 50, stretchOpts(a))}">${out}</g>`;
}
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

// Fill with the geometry's own fill-rule (evenodd when Inner seed copies are on) — the canvas twin of the fill-rule attr above.
export function paintPath(ctx, op, path, geo) { if (op === 'fill') ctx.fill(path, (geo && geo.fillRule) || 'nonzero'); else ctx.stroke(path); }

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

// The union of a cell-shape lattice's cells (items carry `poly`), as one Path2D to clip a canvas to; null otherwise.
// Show grid (Component): each cell's outline over the drawing — polygons for a cell-shape lattice, squares
// otherwise. Screen only: appended by renderGallery / the edit view, never by buildComponentSVG (exports).
state.componentGridOutline = false;
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
// SVG: `content` clipped to the union of `polys` (each a point list, in the content's own coords); as-is when polys is null.
export function clipToCellShapes(polys, content) {
  if (!polys) return content;
  const id = 'cellsclip-' + nextDrawId();
  return `<clipPath id="${id}">${polys.map(p => `<polygon points="${p.map(q => q.map(v => v.toFixed(2)).join(',')).join(' ')}"/>`).join('')}</clipPath><g clip-path="url(#${id})">${content}</g>`;
}
export function latticeShapePath(items) {
  if (!items.length || !items[0].poly) return null;
  const p = new Path2D();
  items.forEach(it => { it.poly.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); });
  return p;
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
export function r2(n) { return Math.round(n * 100) / 100; }

// Print mode's SVG: the panel's physical size/DPI/bleed dims (title says
// "(selection)" — the trim here is the selected component's own square
// frame, not a canvas). Same v1 discipline as the other four tools: a
// bleed box + a uniform scale(trimWmm/size) group wrapping the SAME body
// buildComponentSVG() uses, plus crop marks when bleed > 0.
export function printComponentDims(baseSize, baseH) {
  const unit = printSizePanel.getUnit();
  const sz = printSizePanel.getSize();
  const dpi = printSizePanel.getDpi() || 300;
  const bleedMm = printSizePanel.getBleed();
  const trimWmm = Organica.printSize.toMM(sz.width, unit) || 0;
  let trimHmm = Organica.printSize.toMM(sz.height, unit) || 0;
  // A non-square artwork (a rectangular Loom grid) keeps its own proportions:
  // the width drives the scale, the trim height follows the viewBox ratio.
  // Square artwork keeps using the panel's height field, as before.
  if (baseSize && baseH && Math.abs(baseH - baseSize) > 1e-6) trimHmm = trimWmm * baseH / baseSize;
  const trimWpx = Math.round(Organica.printSize.mmToPx(trimWmm, dpi));
  const trimHpx = Math.round(Organica.printSize.mmToPx(trimHmm, dpi));
  const bleedPx = Math.round(Organica.printSize.mmToPx(bleedMm, dpi));
  return {
    dpi, trimWmm, trimHmm, bleedMm, trimWpx, trimHpx, bleedPx,
    outW: trimWpx + 2 * bleedPx, outH: trimHpx + 2 * bleedPx,
    scale: baseSize ? trimWpx / baseSize : 1,
  };
}
export function buildPrintComponentSVG(items, seed, baseSize, baseH) {
  const p = printComponentDims(baseSize, baseH);
  const bw = p.trimWmm + 2 * p.bleedMm, bh = p.trimHmm + 2 * p.bleedMm;
  const body = buildComponentSVGBody(items, seed, baseH ? { w: baseSize, h: baseH } : baseSize);
  const scaleMm = baseSize ? p.trimWmm / baseSize : 1;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(bw)}mm" height="${r2(bh)}mm" viewBox="0 0 ${r2(bw)} ${r2(bh)}">`;
  s += `<rect width="100%" height="100%" fill="${state.paperColor}"/>`;
  s += `<g transform="translate(${r2(p.bleedMm)},${r2(p.bleedMm)})">`;
  s += `<g transform="scale(${scaleMm})">${body}</g>`;
  if (p.bleedMm > 0) s += Organica.printSize.cropMarksSVG(p.trimWmm, p.trimHmm, {}, '#000');
  s += '</g></svg>';
  return s;
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

// The 0°/no-flip state is dropped on purpose: it's pixel-identical to the big
// canvas below (same seed, same transform, just smaller) — showing it twice added no information.
export const SEED_PREVIEW_STATES_SQUARE = [
  [0, false, false, '0°'], [90, false, false, '90°'], [180, false, false, '180°'], [270, false, false, '270°'],
  [0, true, false, 'Flip H'], [0, false, true, 'Flip V'], [0, true, true, 'Flip H+V'],
];
export const seedPreviewStates = () => cellShapeStates(state.cellShape);
export function renderSeedPreview() {
  const seed = getSeed();
  ctrl('seed-preview').innerHTML = seedPreviewStates()
    .map(([r, fh, fv, label], i) => `<div class="fvs-seed-tile${i === elementViewIndex() ? ' is-selected' : ''}" role="button" tabindex="0" data-view="${i}" aria-pressed="${i === elementViewIndex()}" aria-label="Show the Element at ${label}"><div class="fvs-seed-tile__box">${buildSeedPreviewSVG(seed, r, fh, fv, 48, { outline: true })}</div><span class="fvs-seed-tile__label">${label}</span></div>`).join('');
  renderElementFrame(seed);
  mountElementQuickSaves();
}

// Split's cut grid — a dashed frame + centre cross showing exactly where the
// two cut lines fall, drawn over the Element canvas only (never exported —
// exportElement() calls buildSeedPreviewSVG directly). The frame is the
// ORIGINAL (pre-split) shape's own bbox mapped through its own geometry
// transform: transformed_x = (raw_x + normTx) * normScale, the same formula
// elementPathMarkup's <g transform> applies — works for any Seed, centred or
// not, without assuming fitToBox's usual centring.
export function buildSplitGridOverlaySVG(size) {
  const chk = ctrl('chk-split-grid');
  if (!chk || !chk.checked) return '';
  const split = state.splitOriginal && state.customSeed === state.splitApplied;
  const srcSeed = split ? state.splitOriginal : (hooks.elementIsEmpty() ? null : seedForSnapshot());
  if (!srcSeed || !SEED_TYPES[srcSeed.type]) return '';
  const geo = SEED_TYPES[srcSeed.type].geometry(srcSeed);
  if (!geo || !geo.d) return '';
  const bb = pathBBox(geo.d);
  if (!bb) return '';
  const scale = size / 100;
  const fx = (bb.x + geo.normTx) * geo.normScale * scale;
  const fy = (bb.y + geo.normTy) * geo.normScale * scale;
  const fw = bb.width * geo.normScale * scale, fh = bb.height * geo.normScale * scale;
  const cx = fx + fw / 2, cy = fy + fh / 2;
  const kept = state.splitKeep;
  const tint = (q, dx, dy) => {
    const on = kept.size === 0 || kept.has(q);
    const rx = dx < 0 ? fx : cx, ry = dy < 0 ? fy : cy;
    return `<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${(fw / 2).toFixed(2)}" height="${(fh / 2).toFixed(2)}" fill="${on ? 'var(--tool)' : 'var(--mid)'}" fill-opacity="${on ? 0.14 : 0.05}"/>`;
  };
  const label = (dx, dy, text) => {
    const lx = (dx < 0 ? fx : cx) + fw * 0.06, ly = (dy < 0 ? fy : cy) + fh * 0.2;
    return `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="10" fill="var(--mid)" font-family="var(--font)">${text}</text>`;
  };
  return `<g pointer-events="none">`
    + tint('tl', -1, -1) + tint('tr', 1, -1) + tint('bl', -1, 1) + tint('br', 1, 1)
    + `<rect x="${fx.toFixed(2)}" y="${fy.toFixed(2)}" width="${fw.toFixed(2)}" height="${fh.toFixed(2)}" fill="none" stroke="var(--tool)" stroke-width="1" stroke-dasharray="4 3"/>`
    + `<line x1="${cx.toFixed(2)}" y1="${fy.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${(fy + fh).toFixed(2)}" stroke="var(--tool)" stroke-width="1" stroke-dasharray="4 3"/>`
    + `<line x1="${fx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(fx + fw).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="var(--tool)" stroke-width="1" stroke-dasharray="4 3"/>`
    + label(-1, -1, 'TL') + label(1, -1, 'TR') + label(-1, 1, 'BL') + label(1, 1, 'BR')
    + `</g>`;
}
// Element tier's own big canvas — a single live preview of the current
// Seed at 0°, on its own stage. Reuses buildSeedPreviewSVG (the same
// geometry the 7-tile strip below uses) at a larger size.
// The view shown on the big Element canvas: one of the strip's orientations (a
// viewing choice — the Element itself, and every later step, stay as they are).
// Drawing (Freehand) and Split's cut grid work upright only, so they show 0°.
rt.elementView = { r: 0, fh: false, fv: false };
export function elementViewLocked() { return ctrl('sel-seed-type').value === 'freehand' || (ctrl('chk-split-grid') && ctrl('chk-split-grid').checked); }
export function currentElementView() { return elementViewLocked() ? { r: 0, fh: false, fv: false } : rt.elementView; }
export function elementViewIndex() {
  const v = currentElementView();
  return seedPreviewStates().findIndex(([r, fh, fv]) => r === v.r && fh === v.fh && fv === v.fv);
}
export function setElementView(i) {
  const st = seedPreviewStates()[i];
  if (!st) return;
  rt.elementView = { r: st[0], fh: st[1], fv: st[2] };
  renderSeedPreview();
}
export function renderElementFrame(seed) {
  const frame = ctrl('element-frame');
  if (!frame) return;
  const sd = seed || getSeed(), v = currentElementView();
  let svg = buildSeedPreviewSVG(sd.type === 'freehand' ? { ...sd, type: 'freehandraw' } : sd, v.r, v.fh, v.fv, 400, { outline: true });
  const overlay = buildSplitGridOverlaySVG(400);
  if (overlay) svg = svg.replace('</svg>', overlay + '</svg>');
  ctrl('element-svg').innerHTML = svg;
}

export function exportElement(format) {
  const seed = getSeed(), v = currentElementView();   // the view on the canvas, as shown
  if (format === 'svg') {
    Organica.download(new Blob([buildSeedPreviewSVG(seed, v.r, v.fh, v.fv, 400)], { type: 'image/svg+xml' }), Organica.stamp('fvs-element', 'svg'));
    return;
  }
  const scale = parseInt(ctrl('sel-export-scale').value, 10);
  const size = 400 * scale;
  const svgStr = buildSeedPreviewSVG(seed, v.r, v.fh, v.fv, size);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    off.getContext('2d').drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    off.toBlob(blob => Organica.download(blob, Organica.stamp('fvs-element', 'png')));
  };
  img.src = url;
}

// ── Gallery ──
export function renderGallery() {
  // Component Edit mode owns the view while active (renderComponentEditCanvas
  // is its own render path) — a reactive renderGallery() call from elsewhere
  // (e.g. a Palette edit) must not repaint the hidden #gallery underneath it.
  if (state.componentEditMode) return;
  const gallery = ctrl('gallery');
  const empty = ctrl('gallery-empty');
  const grid = getGrid();
  const seed = getSeed();
  const size = frameDims(grid);
  // Every thumbnail in this gallery shares the same grid, so one box fits
  // them all — set once as CSS vars rather than per-button inline styles.
  setGalleryThumbVars(size);

  // The grid size can change (columns × rows, a legacy Loom entry) without
  // a fresh Generate — gallery candidates built for the PREVIOUS cell count
  // would otherwise crash buildComponentItems() (centers[i] undefined past
  // the new, smaller cell count). A grid change invalidates the gallery the
  // same way clearGallery() does; drop anything that no longer fits.
  const cellCount = resolveGridCells(grid).length;
  if (state.components.some(c => c.cells.length !== cellCount)) {
    state.components = state.components.filter(c => c.cells.length === cellCount);
    if (!state.components.find(c => c.id === state.selectedId)) {
      state.selectedId = state.components.length ? state.components[0].id : null;
    }
    // Every candidate was built for the old grid: run the current rule again on the new one rather than
    // leaving an empty gallery (Manual has nothing to re-run — the starter set comes back instead).
    if (!state.components.length && state.activeTier === 'component' && !state.componentAutoGenerated) {
      if (ctrl('sel-rule').value !== 'manual' && !ctrl('sel-rule').selectedOptions[0].disabled) { hooks.generate(); if (state.components.length) return; }
      state.componentAutoGenerated = true; state.componentAutoGenSignature = null;
    }
  }

  // If the starter gallery is still "live" (nothing explicit has touched it yet
  // — Generate/Manual/Clear/a Library load all flip componentAutoGenerated to
  // false first), keep it in sync with whatever the Element/grid now is, instead
  // of drawing stale candidates against a shape or cell count they weren't built
  // for. Runs AFTER the cell-count invalidation above, so a grid resize and an
  // Element change are both handled by the same repopulate call.
  if (state.activeTier === 'component' && state.componentAutoGenerated) {
    const sig = hooks.componentElementSignature();
    if (sig !== state.componentAutoGenSignature) { hooks.populateComponentStarterGallery(); return; }
  }

  gallery.innerHTML = '';
  if (state.components.length === 0) {
    gallery.classList.remove('visible');
    empty.style.display = 'flex';
    ctrl('gallery-status').textContent = hooks.elementIsEmpty() ? 'The Element is empty — draw a shape or pick one in step 1 first.' : '';
    setStatus('', 'No components yet');
    return;
  }
  empty.style.display = 'none';
  gallery.classList.add('visible');
  // The plain "N components" count lives in the header status pill alone now — this line is
  // warning-only, so it stays empty (zero footprint, see the :empty CSS rule) most of the time.
  const capNote = state.galleryCapNote && state.galleryCapNote.list === state.components ? state.galleryCapNote.text : '';   // tied to THIS gallery array
  ctrl('gallery-status').textContent = hooks.elementIsEmpty() ? 'The Element is empty (draw a shape or pick one in step 1) — these render blank.' : capNote;
  setStatus('active', `${state.components.length} component${state.components.length === 1 ? '' : 's'}`);

  hooks.syncSelectedColourway();
  for (const comp of state.components) {
    let svgStr;
    layerInkOverride = comp.layerInks || null;
    try { const its = buildComponentItems(comp, grid); svgStr = withGridWrapper(hooks.withComponentColours(comp, () => buildComponentSVG(its, seed, size)).replace(/<\/svg>$/, componentGridOutlineSVG(its, size) + '</svg>'), its, grid.lattice && grid.lattice.outline); } finally { layerInkOverride = null; }
    const btn = document.createElement('button');
    const isSelected = comp.id === state.selectedId && state.selectionExplicit;
    btn.className = 'fvs-thumb' + (isSelected ? ' selected' : '') + (comp.savedName ? ' saved-in-library' : '');
    btn.setAttribute('aria-label', `Component ${comp.ruleSource} ${comp.id}`);
    btn.innerHTML = svgStr;
    btn.addEventListener('click', () => { state.selectedId = comp.id; state.selectionExplicit = true; hooks.adoptLayerInks(comp); hooks.adoptColourway(comp); renderGallery(); });
    // Caption = the rule that made it + each cell's rotation (f = flipped),
    // so two look-alike candidates can be told apart without opening them.
    const caption = hooks.componentCaption(comp);
    btn.title = caption;
    const wrap = document.createElement('div');
    wrap.className = 'fvs-thumb-wrap';
    // Hover-only quick-save — a sibling of the thumb button, not nested in
    // it (a <button> inside a <button> is invalid HTML), positioned over
    // its top-right corner by .fvs-thumb-wrap's own `position: relative`.
    // Once a candidate is saved (comp.savedName), the ✓ stays put — no
    // fade, no revert to "+" — since renderGallery() rebuilds this button
    // from comp.savedName on every re-render, not from transient DOM state.
    // Hovering that ✓ swaps it to a delete "×" (mouseenter/leave, not CSS
    // content, since the label/title need to change too for a11y) — a
    // click then removes the saved entry instead of re-saving it.
    const quickSave = quickSaveButton({
      savedName: comp.savedName,
      labelSave: 'Save to library',
      labelSaved: `Saved to library as "${comp.savedName}"`,
      labelRemove: 'Remove from library',
      onSave: () => hooks.quickSaveComponentToLibrary(comp.id),
      onRemove: () => hooks.deleteQuickSavedComponent(comp.id),
    });
    // Hover-only edit — sits directly left of the save circle, same reveal
    // behaviour. Jumps into Manual mode pre-loaded with THIS candidate's
    // own per-cell rotation/flip/scale, so you can start from what's
    // already there instead of building a new arrangement from scratch.
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'fvs-thumb-edit';
    editBtn.setAttribute('aria-label', 'Edit component structure');
    editBtn.title = 'Edit component structure';
    editBtn.innerHTML = Organica.icons.get('pencil', { size: 'sm' });
    editBtn.addEventListener('click', e => { e.stopPropagation(); hooks.enterComponentEditMode(comp.id); });
    const cap = document.createElement('span');
    cap.className = 'fvs-thumb-caption';
    cap.textContent = caption;
    wrap.append(btn, editBtn, quickSave, cap);
    gallery.appendChild(wrap);
  }
}
