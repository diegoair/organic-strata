// Flexible Visual System · 05-render-component — Component render — stack layers, canvas + SVG, seed preview strip, gallery.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  live, pc, pv, state
} from './engine/00-core.js';
import {
  SEED_TYPES, frameDims, pathBBox, resolveGridCells
} from './engine/01-geometry.js';
import {
  getSeed, seedForSnapshot
} from './engine/02-seed-ui.js';
import {
  getGrid
} from './engine/03-rules.js';
import {
  buildComponentItems
} from './engine/04-appearance.js';
import {
  buildComponentSVG, buildComponentSVGBody, buildSeedPreviewSVG, componentGridOutlineSVG, r2,
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
// not, without assuming fitToBox's usual centring.
export function buildSplitGridOverlaySVG(size) {
  const chk = ctrl('chk-split-grid');
  if (!chk || !chk.checked) return '';
  const split = state.splitOriginal && state.customSeed === state.splitApplied;
  const srcSeed = split ? state.splitOriginal : (elementIsEmpty() ? null : seedForSnapshot());
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
    let svgStr;
    live.layerInkOverride = comp.layerInks || null;
    try { const its = buildComponentItems(comp, grid); svgStr = withCellRing(withGridWrapper(withComponentColours(comp, () => buildComponentSVG(its, seed, size)).replace(/<\/svg>$/, componentGridOutlineSVG(its, size) + '</svg>'), its, grid.lattice && grid.lattice.outline), its); } finally { live.layerInkOverride = null; }
    const isSelected = comp.id === state.selectedId && state.selectionExplicit;
    const thumbClass = 'fvs-thumb' + (isSelected ? ' selected' : '') + (comp.savedName ? ' saved-in-library' : '');
    const caption = componentCaption(comp);
    const key = drawIdFree(svgStr);
    const kept = galleryThumbs.get(comp);
    if (kept && kept.key === key) {
      if (kept.btn.className !== thumbClass) kept.btn.className = thumbClass;
      kept.btn.setAttribute('aria-label', `Component ${comp.ruleSource} ${comp.id}`);
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
    btn.setAttribute('aria-label', `Component ${comp.ruleSource} ${comp.id}`);
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
