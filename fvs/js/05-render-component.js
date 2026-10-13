// Flexible Visual System · 05-render-component — Component render — stack layers, canvas + SVG, seed preview strip, gallery.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  live, pc, pv, state
} from './engine/00-core.js';
import {
  CELL_SHAPES, SEED_TYPES, cellShapeOf, frameDims, pathBBox, resolveGridCells, snapAxis, snapCandidates, splitPlan
} from './engine/01-geometry.js';
import {
  getSeed, seedForSnapshot
} from './engine/02-seed-ui.js';
import {
  getGrid, ruleLabel
} from './engine/03-rules.js';
import {
  buildComponentItems, getElementAppearance, withAppearance
} from './engine/04-appearance.js';
import {
  buildComponentSVG, buildComponentSVGBody, buildSeedPreviewSVG, buildSeedTileSVG, componentGridOutlineSVG,
  edgeContacts, elementPathMarkup, layerPlace, orientInkPoint, polyEdgeContacts, polyEdgeOverlaySVG, r2, tileEdgeOverlaySVG,
  seedPreviewStates, withGridWrapper
} from './engine/05-render-component.js';
import {
  componentCaption, componentElementSignature, elementIsEmpty, syncSelectedColourway, withComponentColours
} from './engine/06-component-ui.js';
import {
  ctrl, printSizePanel, setStatus
} from './00-core.js';
import {
  setGalleryThumbVars
} from './03-rules.js';
import {
  mountElementQuickSaves, quickSaveButton
} from './04-appearance.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  currentElementView: () => currentElementView, elementViewIndex: () => elementViewIndex,
  renderGallery: () => renderGallery, renderSeedPreview: () => renderSeedPreview
});







// The union of a cell-shape lattice's cells (items carry `poly`), as one Path2D to clip a canvas to; null otherwise.
// Show grid (Component): each cell's outline over the drawing — polygons for a cell-shape lattice, squares
// otherwise. Screen only: appended by renderGallery / the edit view, never by buildComponentSVG (exports).
state.componentGridOutline = false;


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
// not, without assuming fitToBox's usual centring. Oct 13, 2026: the frame is the
// Element's whole canvas (Diego), the cross at its centre where Split cuts the shape
// as drawn, through the canvas's own box → px (`T`: the plain canvas's scale and cell-shape fit, or none
// on the tile view, already in box units).
export function buildSplitGridOverlaySVG(size, T = '') {
  const chk = ctrl('chk-split-grid');
  if (!chk || !chk.checked) return '';
  const split = state.splitOriginal && state.customSeed === state.splitApplied;
  const srcSeed = split ? state.splitOriginal : (elementIsEmpty() ? null : seedForSnapshot());
  if (!srcSeed || !SEED_TYPES[srcSeed.type]) return '';
  const geo = SEED_TYPES[srcSeed.type].geometry(srcSeed);
  if (!geo || !geo.d) return '';
  // the frame = the Element's whole canvas (its 0..100 box, the cell), the cross at its centre — where Split cuts
  // (splitElementGeometry's `view`: the shape as drawn, cut at 50 / 50)
  const fx = 0, fy = 0, fw = 100, fh = 100;
  const cx = fx + fw / 2, cy = fy + fh / 2;
  const fs = (10 * 100 / size).toFixed(3);   // labels about 10 px on screen
  const kept = state.splitKeep;
  const line = 'stroke="var(--tool)" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"';
  const plan = splitPlan(cellShapeOf(srcSeed));
  if (plan.kind === 'fan') {
    // a Circle / Triangle / Hexagon cell: the cell's outline, the fan's cuts from its centre to each corner, each slice
    // tinted (kept or not) and numbered — 1 … n clockwise from the top, as the buttons (splitPlan)
    const cs = cellShapeOf(srcSeed), poly = CELL_SHAPES[cs].poly, r3 = v => v.toFixed(3);
    const reach = a => {   // where a cut from the centre leaves the cell (the circle's radius, or the polygon's edge)
      const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t);
      if (cs === 'circle') return [50 + 50 * dx, 50 + 50 * dy];
      let best = Infinity;
      for (let k = 0; k < poly.length; k++) {
        const [ax, ay] = poly[k], [bx, by] = poly[(k + 1) % poly.length], ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const u = ((ax - 50) * ey - (ay - 50) * ex) / den, v = ((ax - 50) * dy - (ay - 50) * dx) / den;
        if (u > 1e-6 && v >= -1e-6 && v <= 1 + 1e-6) best = Math.min(best, u);
      }
      return [50 + best * dx, 50 + best * dy];
    };
    const slices = plan.pieces.map(p => {
      const steps = cs === 'circle' ? Math.ceil((p.b - p.a) / 5) : 1, pts = [[50, 50]];
      for (let k = 0; k <= steps; k++) pts.push(reach(p.a + (p.b - p.a) * k / steps));
      const on = kept.size === 0 || kept.has(p.id), [lx, ly] = reach((p.a + p.b) / 2), L = [50 + (lx - 50) * 0.62, 50 + (ly - 50) * 0.62];
      return `<polygon points="${pts.map(q => q.map(r3).join(',')).join(' ')}" fill="${on ? 'var(--tool)' : 'var(--mid)'}" fill-opacity="${on ? 0.14 : 0.05}"/>`
        + `<text x="${r3(L[0])}" y="${r3(L[1])}" font-size="${(10 * 100 / size).toFixed(3)}" text-anchor="middle" dominant-baseline="middle" fill="var(--mid)" font-family="var(--font)">${p.label}</text>`;
    }).join('');
    const cuts = plan.pieces.map(p => { const [x, y] = reach(p.a); return `<line x1="50" y1="50" x2="${r3(x)}" y2="${r3(y)}" ${line}/>`; }).join('');
    return `<g pointer-events="none" class="fvs-split-grid" data-fan="${plan.pieces.length}"${T ? ` transform="${T}"` : ''}>`
      + slices + `<polygon points="${poly.map(q => q.map(r3).join(',')).join(' ')}" fill="none" ${line}/>` + cuts + `</g>`;
  }
  const tint = (q, dx, dy) => {
    const on = kept.size === 0 || kept.has(q);
    const rx = dx < 0 ? fx : cx, ry = dy < 0 ? fy : cy;
    return `<rect x="${rx.toFixed(3)}" y="${ry.toFixed(3)}" width="${(fw / 2).toFixed(3)}" height="${(fh / 2).toFixed(3)}" fill="${on ? 'var(--tool)' : 'var(--mid)'}" fill-opacity="${on ? 0.14 : 0.05}"/>`;
  };
  const label = (dx, dy, text) => {
    const lx = (dx < 0 ? fx : cx) + fw * 0.06, ly = (dy < 0 ? fy : cy) + fh * 0.2;
    return `<text x="${lx.toFixed(3)}" y="${ly.toFixed(3)}" font-size="${fs}" fill="var(--mid)" font-family="var(--font)">${text}</text>`;
  };
  return `<g pointer-events="none" class="fvs-split-grid"${T ? ` transform="${T}"` : ''}><g>`
    + tint('tl', -1, -1) + tint('tr', 1, -1) + tint('bl', -1, 1) + tint('br', 1, 1)
    + `<rect x="${fx.toFixed(3)}" y="${fy.toFixed(3)}" width="${fw.toFixed(3)}" height="${fh.toFixed(3)}" fill="none" ${line}/>`
    + `<line x1="${cx.toFixed(3)}" y1="${fy.toFixed(3)}" x2="${cx.toFixed(3)}" y2="${(fy + fh).toFixed(3)}" ${line}/>`
    + `<line x1="${fx.toFixed(3)}" y1="${cy.toFixed(3)}" x2="${(fx + fw).toFixed(3)}" y2="${cy.toFixed(3)}" ${line}/>`
    + label(-1, -1, 'TL') + label(1, -1, 'TR') + label(-1, 1, 'BL') + label(1, 1, 'BR')
    + `</g></g>`;
}
// Element tier's own big canvas — a single live preview of the current
// Seed at 0°, on its own stage. Reuses buildSeedPreviewSVG (the same
// geometry the 7-tile strip below uses) at a larger size.
// The view shown on the big Element canvas: one of the strip's orientations (a
// viewing choice — the Element itself, and every later step, stay as they are).
// Drawing (Freehand) and Split's cut grid work upright only, so they show 0°.
rt.elementView = { r: 0, fh: false, fv: false };
export function elementViewLocked() { return pv('sel-seed-type') === 'freehand' || (ctrl('chk-split-grid') && pc('chk-split-grid')); }
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
// ── The Element canvas's View (Oct 13, 2026): Show as tile + its Layout / Turn, and Snap. Per browser, in memory
// for the session and kept in localStorage — a view aid, never part of the Element or an export.
const ELEMENT_VIEW_KEY = 'organica.fvs.element-view';
let inkCache = null;   // the tile overlay's last ink measurement: { key, ink }
rt.elementAids = { tile: false, layout: 'grid', turn: 'none', snap: false };   // Snap is opt-in (Diego, Oct 13)
try { Object.assign(rt.elementAids, JSON.parse(localStorage.getItem(ELEMENT_VIEW_KEY) || 'null') || {}); } catch (e) { /* private mode */ }
export function saveElementView() { try { localStorage.setItem(ELEMENT_VIEW_KEY, JSON.stringify(rt.elementAids)); } catch (e) { /* private mode */ } }
// Every cell shape tiles: a square on the Layout / Turn lattice, a Circle / Triangle / Hexagon in its own (Diego, Oct 13).
// The tile view lives in the Element's single view only (double-click on the board — Diego, Oct 13: "only in the
// single view"); the board draws the plain Element.
const elementSingle = () => { const v = document.querySelector('.tier-view[data-tier="element"]'); return !!(v && v.classList.contains('is-single')); };
export const elementTileOn = () => !!rt.elementAids.tile && elementSingle();
const TILE_OPTION_NAMES = { grid: 'Layout: Grid', brick: 'Layout: Brick', halfdrop: 'Layout: Half-drop', none: 'Turn: None', alternate: 'Turn: Alternate', quarter: 'Turn: Quarter' };
export function syncElementViewUI(seed) {
  const btn = ctrl('btn-element-view-tile');
  if (!btn) return;
  const square = cellShapeOf(seed || getSeed()) === 'square';
  btn.setAttribute('aria-pressed', String(!!rt.elementAids.tile));
  // the second layer: open while Show as tile is on. Layout / Turn arrange square tiles; another cell shape tiles in
  // its own lattice, so there they are off (aria-disabled, the reason in the name)
  const fly = ctrl('element-tile-flyout');
  const single = elementSingle();
  // the whole View group (Show as tile + its layer, Snap) and its separator: the single view only (Diego, Oct 13)
  const group = btn.closest('.org-floatbar__group');
  group.hidden = !single;
  if (group.nextElementSibling && group.nextElementSibling.classList.contains('org-floatbar__sep')) group.nextElementSibling.hidden = !single;
  if (fly) fly.dataset.open = String(!!rt.elementAids.tile && single && state.activeTier === 'element');
  const why = square ? '' : ' — needs square cells';
  document.querySelectorAll('#element-tile-flyout [data-tile-layout], #element-tile-flyout [data-tile-turn]').forEach(o => {
    const on = o.dataset.tileLayout ? o.dataset.tileLayout === rt.elementAids.layout : o.dataset.tileTurn === rt.elementAids.turn;
    o.dataset.on = String(on && square); o.setAttribute('aria-pressed', String(on));
    o.setAttribute('aria-disabled', String(!square));
    o.setAttribute('aria-label', TILE_OPTION_NAMES[o.dataset.tileLayout || o.dataset.tileTurn] + why);
  });
  ctrl('btn-element-view-snap').setAttribute('aria-pressed', String(!!rt.elementAids.snap));
}

// ── Snap (Oct 13, 2026): while Move X / Y or a layer's X / Y is DRAGGED (a pointer on the slider — arrow keys and a
// typed readout never snap), the ink's edges / centre / tips catch the box's 0 · 50 · 100 and the other layers'
// edges and centres within 4 px of the slider's travel (≥ 1 box unit — a 94 px layer slider is 2.5 units a pixel,
// so a fixed 2 units would be under one pixel); ⌘ / Ctrl held = no snap. The ink is measured once at the press (the shape
// does not change while you drag); the caught line shows as a guide until the release.
rt.snapGuide = null;
const SNAP_SLIDERS = { 'rg-element-mx': ['element', 'x'], 'rg-element-my': ['element', 'y'], 'rg-layer-mx': ['layer', 'x'], 'rg-layer-my': ['layer', 'y'] };
const SNAP_PX = 4;
// the threshold in box units: SNAP_PX of this slider's travel, times how far one unit of it moves the ink (k)
const snapThr = (range, k) => { const w = range.getBoundingClientRect().width || 100, span = (+range.max - +range.min) || 200; return Math.max(1, SNAP_PX * span / w * Math.abs(k || 1)); };
let snapDrag = null, snapMods = false;
function prepareSnap(range) {
  const [who, axis] = SNAP_SLIDERS[range.id], seed = getSeed(), geo = SEED_TYPES[seed.type].geometry(seed), a = getElementAppearance();
  if (!geo || !geo.d) return null;
  const targets = [0, 50, 100];
  if (who === 'element') {
    const ink = measureElementInk(geo, { ...a, [axis === 'x' ? 'mx' : 'my']: 0 });
    return { range, axis, k: 1, thr: snapThr(range, 1), cands: snapCandidates(ink, axis), targets };
  }
  if (!state.layers || !geo.layers) return null;
  const item = state.layers.items[state.layers.active], me = item && geo.layers.find(l => l.id === item.id);
  if (!me) return null;
  // a layer's X / Y moves its ink by Scale × the Element's turn: snap only when that is along one box axis
  const r = (a.rotate || 0) * Math.PI / 180, S = a.scale || 1;
  const dir = axis === 'x' ? [Math.cos(r) * a.w * S, Math.sin(r) * a.w * S] : [-Math.sin(r) * a.l * S, Math.cos(r) * a.l * S];
  const len = Math.hypot(dir[0], dir[1]), boxAxis = Math.abs(dir[0]) > 0.999 * len ? 'x' : Math.abs(dir[1]) > 0.999 * len ? 'y' : null;
  if (!boxAxis) return null;
  const solo = l => ({ ...geo, layers: [{ ...l, role: 'fill' }] });
  const ink = measureElementInk(solo({ ...me, place: { ...layerPlace(me), [axis === 'x' ? 'mx' : 'my']: 0 } }), a);
  geo.layers.filter(l => l !== me && l.geo && l.geo.d).forEach(l => {
    const b = measureElementInk(solo(l), a).bb;
    if (b) { const [lo, w] = boxAxis === 'x' ? [b.x, b.width] : [b.y, b.height]; targets.push(lo, lo + w / 2, lo + w); }
  });
  const k = boxAxis === 'x' ? dir[0] : dir[1];
  return { range, axis: boxAxis, k, thr: snapThr(range, k), cands: snapCandidates(ink, boxAxis), targets };
}
document.addEventListener('pointerdown', e => {
  snapMods = e.metaKey || e.ctrlKey;
  snapDrag = SNAP_SLIDERS[e.target.id] ? { pending: e.target } : null;
}, true);
document.addEventListener('pointermove', e => { snapMods = e.metaKey || e.ctrlKey; }, true);
const endSnap = () => { snapDrag = null; if (rt.snapGuide) { rt.snapGuide = null; renderElementFrame(); } };
document.addEventListener('pointerup', endSnap, true);
document.addEventListener('pointercancel', endSnap, true);
// Capture phase: runs before the slider's own input listener, which then reads the snapped value.
document.addEventListener('input', e => {
  if (!snapDrag || (snapDrag.pending || snapDrag.range) !== e.target) return;
  if (snapDrag.pending) snapDrag = prepareSnap(snapDrag.pending) || { range: e.target, off: true };
  const range = e.target;
  rt.snapGuide = null;
  if (snapDrag.off || !rt.elementAids.snap || snapMods || !elementSingle()) return;   // Snap works in the single view only
  const hit = snapAxis({ cands: snapDrag.cands, targets: snapDrag.targets, k: snapDrag.k, v: parseFloat(range.value), thr: snapDrag.thr });
  if (!hit) return;
  range.value = hit.v;   // the slider rounds to its step (0.1 — a 0.05-unit error at most)
  rt.snapGuide = { axis: snapDrag.axis, at: hit.at };
}, true);
// The caught line, across the whole canvas, in the box's units through the view's orientation.
function snapGuideSVG(g, v, tiled) {
  const [x1, y1, x2, y2] = g.axis === 'x' ? [g.at, -100, g.at, 200] : [-100, g.at, 200, g.at];
  const T = `translate(${tiled ? 50 : 200},${tiled ? 50 : 200}) rotate(${v.r || 0}) scale(${(v.fh ? -1 : 1) * (tiled ? 1 : 4)},${(v.fv ? -1 : 1) * (tiled ? 1 : 4)}) translate(-50,-50)`;
  return `<g transform="${T}" pointer-events="none"><line class="fvs-snap-guide" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></g>`;
}

// Where the Element's ink actually is, in its 0..100 box (the box = one cell): its outlines sampled through their own
// transforms, the way it paints under `appearance` (stroke kept; Pattern measured on the shape, its clip). getBBox()
// on a <g> unions each child's box — loose under a rotation (a turned circle measured as its turned square) — and
// leaves the stroke out (Chrome ignores {stroke:true}). The stroke is drawn INSIDE the norm layer, so its painted
// half width is strokeW / 2 × normScale × the stretch: each point carries that circle's x / y extent under the
// path's matrix (px, py). Returns { bb, pts:[{x, y, px, py}] } — bb null when nothing is drawn.
export function measureElementInk(geo, appearance) {
  const a = appearance || getElementAppearance();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  // 100 × 100 px so the viewBox maps 1:1 (a 0-size viewport makes getCTM() singular); off-screen, never painted.
  svg.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:100px;height:100px;visibility:hidden');
  svg.innerHTML = '<g>' + withAppearance(a, () => elementPathMarkup(geo, '#000', a.fillMode === 'pattern')) + '</g>';
  document.body.appendChild(svg);
  const pts = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  try {
    const g = svg.firstChild, inv = g.getCTM().inverse();
    g.querySelectorAll('path').forEach(el => {
      if (el.closest('clipPath, mask, defs')) return;
      const L = el.getTotalLength(), m = inv.multiply(el.getCTM());
      const st = getComputedStyle(el), hw = st.stroke !== 'none' ? (parseFloat(st.strokeWidth) || 0) / 2 : 0;
      const px = hw * Math.hypot(m.a, m.c), py = hw * Math.hypot(m.b, m.d);
      const n = Math.min(4000, Math.max(200, Math.ceil(L * 2)));
      for (let i = 0; i <= n; i++) {
        const q = el.getPointAtLength(L * i / n), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
        pts.push({ x, y, px, py });
        if (x - px < x0) x0 = x - px; if (x + px > x1) x1 = x + px;
        if (y - py < y0) y0 = y - py; if (y + py > y1) y1 = y + py;
      }
      // samples by length can fall either side of a corner: unturned or on a quarter turn, the path's own box mapped
      // through its matrix is exact (corners included)
      const e = 1e-9;
      if ((Math.abs(m.b) < e && Math.abs(m.c) < e) || (Math.abs(m.a) < e && Math.abs(m.d) < e)) {
        const b = el.getBBox(), cs = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
          .map(([u, w]) => [m.a * u + m.c * w + m.e, m.b * u + m.d * w + m.f]);
        x0 = Math.min(x0, ...cs.map(c => c[0] - px)); x1 = Math.max(x1, ...cs.map(c => c[0] + px));
        y0 = Math.min(y0, ...cs.map(c => c[1] - py)); y1 = Math.max(y1, ...cs.map(c => c[1] + py));
      }
    });
  } catch (e) { /* nothing drawn */ }
  document.body.removeChild(svg);
  return { bb: x1 >= x0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null, pts };
}

export function renderElementFrame(seed) {
  const frame = ctrl('element-frame');
  if (!frame) return;
  const sd = seed || getSeed(), v = currentElementView();
  // Edit parts: the part layers carry data-part on this canvas only, so a click finds the part under it.
  const editing = !!(rt.partEdit && state.layers && state.layers.parts);
  live.tagParts = editing;
  let svg;
  const drawn = sd.type === 'freehand' ? { ...sd, type: 'freehandraw' } : sd, tiled = elementTileOn(sd);
  try { svg = tiled ? buildSeedTileSVG(drawn, v, rt.elementAids, 400) : buildSeedPreviewSVG(drawn, v.r, v.fh, v.fv, 400, { outline: true }); }
  finally { live.tagParts = false; }
  if (tiled) {
    // the joins, measured on the ink as it paints (stroke included), in the view's orientation
    // measured once per shape + look (a drag of an unrelated slider redraws without re-sampling the outline)
    const geo = SEED_TYPES[drawn.type].geometry(drawn), key = geo && geo.d ? JSON.stringify([drawn, getElementAppearance()]) : '';
    if (!inkCache || inkCache.key !== key) inkCache = { key, ink: key ? measureElementInk(geo) : { pts: [] } };
    const ink = inkCache.ink;
    const opts = ink.pts.map(q => orientInkPoint(q, v)), cs = cellShapeOf(sd);
    svg = svg.replace('</svg>', (cs === 'square' ? tileEdgeOverlaySVG(edgeContacts(opts))
      : polyEdgeOverlaySVG(CELL_SHAPES[cs].poly, polyEdgeContacts(opts, CELL_SHAPES[cs].poly))) + '</svg>');
  }
  if (rt.snapGuide && (tiled || cellShapeOf(sd) === 'square')) svg = svg.replace('</svg>', snapGuideSVG(rt.snapGuide, v, tiled) + '</svg>');
  // the cut grid, through the canvas's own box → px: the plain canvas's (a triangle cell drawn at 50 / R, as
  // buildSeedPreviewSVG does; the view is upright while it shows) or none on the tile view (box units already)
  const ck = cellShapeOf(sd) === 'triangle' ? 50 / CELL_SHAPES.triangle.R : 1;
  const overlay = buildSplitGridOverlaySVG(tiled ? 100 : 400 * ck, tiled ? '' : `translate(200,200) scale(${(4 * ck).toFixed(4)}) translate(-50,-50)`);
  if (overlay) svg = svg.replace('</svg>', overlay + '</svg>');
  syncElementViewUI(sd);
  ctrl('element-svg').innerHTML = svg;
  frame.classList.toggle('is-part-edit', editing);
  if (editing) {
    const L = state.layers, act = L.items[L.active];
    ctrl('element-svg').querySelectorAll('[data-part]').forEach(g => {
      const id = g.getAttribute('data-part');
      g.classList.add('fvs-part');
      if ((act && act.id === id) || (rt.partSel && rt.partSel.has(id))) g.classList.add('is-sel');
    });
  }
  if (hooks.boardElementDrawn) hooks.boardElementDrawn();   // the Element board: Inks, New element's Paper, the list (18-step-boards.js)
}

export function exportElement(format) {
  const seed = getSeed(), v = currentElementView();   // the view on the canvas, as shown
  if (format === 'svg') {
    Organica.download(new Blob([buildSeedPreviewSVG(seed, v.r, v.fh, v.fv, 400)], { type: 'image/svg+xml' }), Organica.stamp('fvs-element', 'svg'));
    return;
  }
  const scale = parseInt(pv('sel-export-scale'), 10);
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
// A cell-shape thumbnail's selected / saved ring, drawn along the cells' outline: the lattice's outer edges
// (an edge two cells share cancels out), chained into closed loops and stroked mitre-joined UNDER the Paper,
// so only the outward half shows (= the outline grown by half the width, sharp corners kept).
// Hidden until .selected / .saved-in-library (fvs.css). It replaced a chain of 1px CSS drop-shadows — 13
// filter passes per saved thumbnail, re-run on every gallery redraw (a dozen saved circle Components took
// ~2 s per save). Gallery DOM only: exports never carry it.
export function cellOutlineLoops(items) {
  const key = p => p[0].toFixed(1) + ',' + p[1].toFixed(1);
  const edges = new Map();   // undirected edge → { a, b, n }
  items.forEach(it => it.poly.forEach((p, i) => {
    const q = it.poly[(i + 1) % it.poly.length], ka = key(p), kb = key(q), k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    const e = edges.get(k);
    if (e) e.n++; else edges.set(k, { a: p, b: q, ka, kb, n: 1 });
  }));
  const next = new Map();    // outer edges only, kept in each cell's own winding
  edges.forEach(e => { if (e.n === 1) next.set(e.ka, e); });
  const loops = [];
  while (next.size) {
    const [start, first] = next.entries().next().value;
    const loop = [first.a];
    let e = first; next.delete(start);
    while (e && e.kb !== start) { loop.push(e.b); e = next.get(e.kb); if (e) next.delete(e.ka); }
    loops.push(loop);
  }
  return loops;
}
export function withCellRing(svgStr, items) {
  if (!items.length || !items[0].poly || !/^<svg[^>]*class="is-cell"/.test(svgStr)) return svgStr;
  const d = cellOutlineLoops(items).map(l => 'M' + l.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z').join('');
  const ring = `<path class="cell-ring" d="${d}" fill="none" stroke-linejoin="miter" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  return svgStr.replace(/^(<svg[^>]*>)/, '$1' + ring);
}
// Two drawings of the same thing differ only in their time stamp (<metadata> exportedAt) and per-drawing ids
// (nextDrawId: clip paths, patterns…): this text leaves the metadata out and reads the ids as their order, so
// "same drawing" is a string compare. Used by the gallery below and the Library rail (15-export-library-view.js).
export const drawIdFree = svg => {
  let out = String(svg).replace(/<metadata>[\s\S]*?<\/metadata>/g, '');
  const ids = [...new Set([...out.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]))];
  ids.forEach((id, i) => { out = out.split('"' + id + '"').join('"#' + i + '"').split('#' + id + ')').join('#' + i + ')').split('"#' + id + '"').join('"##' + i + '"'); });
  return out;
};
// The gallery keeps each thumbnail whose drawing is unchanged (keyed by the Component object, so a new candidate
// list = new thumbnails): a save, a selection or a redraw that changes nothing visible only updates classes, the
// caption and the save circle, instead of re-creating and re-painting every SVG.
// A kept SVG keeps its own ids, still unique on the page (the counter only goes up).
const galleryThumbs = new WeakMap();   // comp → { key, wrap, btn, cap, quickSave, savedName }
// One Component's thumbnail SVG — the edited Element's area and the other Elements' (18-step-boards.js, drawn with their
// own Element / Palette / appearance) both draw through it.
export function componentThumbMarkup(comp, grid, seed, size) {
  live.layerInkOverride = comp.layerInks || null;
  try { const its = buildComponentItems(comp, grid); return withCellRing(withGridWrapper(withComponentColours(comp, () => buildComponentSVG(its, seed, size)).replace(/<\/svg>$/, componentGridOutlineSVG(its, size) + '</svg>'), its, grid.lattice && grid.lattice.outline), its); } finally { live.layerInkOverride = null; }
}
export function renderGallery() {
  // Drawn only while the Component step shows (or Component Edit): off it the list is hidden, and every Palette / Paper /
  // shape change redrew it all — 33k nodes with layer colour variants and a Paper pattern made a Paper drag on the
  // Symbol step crawl (Diego, Oct 11, 2026). setTier redraws it when the step shows.
  if (state.activeTier === 'component' || state.componentEditMode) renderGalleryNow();
  if (hooks.boardGalleryDrawn) hooks.boardGalleryDrawn();   // the Component board's Clear board (18-step-boards.js)
}
function renderGalleryNow() {
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
      if (pv('sel-rule') !== 'manual' && !ctrl('sel-rule').selectedOptions[0].disabled) { hooks.generate(); if (state.components.length) return; }
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
    const sig = componentElementSignature();
    if (sig !== state.componentAutoGenSignature) { hooks.populateComponentStarterGallery(); return; }
  }

  if (state.components.length === 0) {
    gallery.innerHTML = '';
    gallery.classList.remove('visible');
    empty.style.display = 'flex';
    ctrl('gallery-status').textContent = elementIsEmpty() ? 'The Element is empty — draw a shape or pick one in step 1 first.' : '';
    setStatus('', 'No components yet');
    return;
  }
  empty.style.display = 'none';
  gallery.classList.add('visible');
  // The plain "N components" count lives in the header status pill alone now — this line is
  // warning-only, so it stays empty (zero footprint, see the :empty CSS rule) most of the time.
  const capNote = state.galleryCapNote && state.galleryCapNote.list === state.components ? state.galleryCapNote.text : '';   // tied to THIS gallery array
  ctrl('gallery-status').textContent = elementIsEmpty() ? 'The Element is empty (draw a shape or pick one in step 1) — these render blank.' : capNote;
  setStatus('active', `${state.components.length} component${state.components.length === 1 ? '' : 's'}`);

  syncSelectedColourway();
  const wraps = [];
  for (const comp of state.components) {
    const svgStr = componentThumbMarkup(comp, grid, seed, size);
    const isSelected = comp.id === state.selectedId && state.selectionExplicit;
    const thumbClass = 'fvs-thumb' + (isSelected ? ' selected' : '') + (comp.savedName ? ' saved-in-library' : '');
    const caption = componentCaption(comp);
    const key = drawIdFree(svgStr);
    const kept = galleryThumbs.get(comp);
    if (kept && kept.key === key) {
      if (kept.btn.className !== thumbClass) kept.btn.className = thumbClass;
      kept.btn.setAttribute('aria-label', `Component ${ruleLabel(comp.ruleSource)} ${comp.id} — double-click to edit`);
      if (kept.btn.title !== caption) { kept.btn.title = caption; kept.cap.textContent = caption; }
      if (kept.savedName !== (comp.savedName || null)) {   // the save circle carries the name in its label / its click
        const q = galleryQuickSave(comp);
        kept.quickSave.replaceWith(q);
        kept.quickSave = q; kept.savedName = comp.savedName || null;
      }
      wraps.push(kept.wrap);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = thumbClass;
    btn.setAttribute('aria-label', `Component ${ruleLabel(comp.ruleSource)} ${comp.id} — double-click to edit`);
    btn.innerHTML = svgStr;
    btn.addEventListener('click', () => { state.selectedId = comp.id; state.selectionExplicit = true; hooks.adoptLayerInks(comp); hooks.adoptColourway(comp); renderGallery(); });
    // Caption = the rule that made it + each cell's rotation (f = flipped),
    // so two look-alike candidates can be told apart without opening them.
    btn.title = caption;
    const wrap = document.createElement('div');
    wrap.className = 'fvs-thumb-wrap';
    // Hover-only quick-save — a sibling of the thumb button, not nested in
    // it (a <button> inside a <button> is invalid HTML), positioned over
    // its top-right corner by .fvs-thumb-wrap's own `position: relative`.
    // Once a candidate is saved (comp.savedName), the ✓ stays put — no
    // fade, no revert to "+" — since renderGallery() rebuilds this button
    // from comp.savedName whenever that changes, not from transient DOM state.
    // Hovering that ✓ swaps it to a delete "×" (mouseenter/leave, not CSS
    // content, since the label/title need to change too for a11y) — a
    // click then removes the saved entry instead of re-saving it.
    const quickSave = galleryQuickSave(comp);
    // Component Edit: a double-click on the thumbnail (18-step-boards.js), or Enter on the one already selected — the
    // keyboard's way in since the hover pencil went (Oct 11, 2026)
    const cid = comp.id;
    btn.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || state.selectedId !== cid || !state.selectionExplicit) return;
      e.preventDefault(); hooks.enterComponentEditMode(cid);
    });
    const cap = document.createElement('span');
    cap.className = 'fvs-thumb-caption';
    cap.textContent = caption;
    wrap.append(btn, quickSave, cap);
    galleryThumbs.set(comp, { key, wrap, btn, cap, quickSave, savedName: comp.savedName || null });
    wraps.push(wrap);
  }
  // in order, moving only what moved; thumbnails of candidates no longer listed go
  wraps.forEach((w, i) => { if (gallery.children[i] !== w) gallery.insertBefore(w, gallery.children[i] || null); });
  while (gallery.children.length > wraps.length) gallery.lastElementChild.remove();
}
// The thumbnail's save circle — rebuilt (alone) when the candidate's saved name changes.
function galleryQuickSave(comp) {
  return quickSaveButton({
    savedName: comp.savedName,
    labelSave: 'Save to library',
    labelSaved: `Saved to library as "${comp.savedName}"`,
    labelRemove: 'Remove from library',
    onSave: () => hooks.quickSaveComponentToLibrary(comp.id),
    onRemove: () => hooks.deleteQuickSavedComponent(comp.id),
  });
}
