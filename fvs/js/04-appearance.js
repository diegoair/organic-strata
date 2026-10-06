// Flexible Visual System · 04-appearance — Items, appearance, Pattern / Ground, Element as tile, Saved Elements.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import { rt } from './rt.js';
import {
  TILE_PICK_REG, colorAt, state
} from './engine/00-core.js';
import {
  CELL_SHAPES, cellShapeOf, importAsPaperShape, splitPaperScope
} from './engine/01-geometry.js';
import {
  SEED_ICONS
} from './engine/02-seed-ui.js';
import {
  DEFAULT_APPEARANCE, ELEMENT_LIB, TILE_CAP, _genesisTileCache, elementTileLayout, genesisTileForms,
  libraryNamesAll, paperPatternGeo, patternOf, savedElementBySig, stretchOpts, svgToTileGeo, tileIconSVG,
  tileNormAttr, tileSig, tileThumbSVG
} from './engine/04-appearance.js';
import {
  paintPath, paintPatternCanvas, patternAttrs, seedPreviewStates
} from './engine/05-render-component.js';
import {
  isPaperNone
} from './engine/07-library.js';
import {
  ctrl, val
} from './00-core.js';
import {
  SEED_TYPES
} from './01-geometry.js';
import {
  getSeed, seedForSnapshot
} from './02-seed-ui.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  getElementAppearance: () => getElementAppearance, syncGroundInkOptions: () => syncGroundInkOptions
});

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

// Each shape remembers its own Appearance (single shape only): switching Square → Arc must not make Arc
// inherit the Square's Style / Stroke / Width / Length / Scale / Move / Pattern. A shape opened for the first
// time starts from defaults; going back restores what it had. `var`: loaders reach these before the handler is defined.
rt.shapeLooks = {}; rt.lastShapeType = null;
export function readPatternControls() {
  return { patType: ctrl('sel-element-pattern').value, patSpacing: val('rg-element-patspacing'), patWeight: val('rg-element-patweight'), patAngle: val('rg-element-patangle') };
}
export function showPatternControls(lk) {
  const p = patternOf(lk);
  ctrl('sel-element-pattern').value = p.patType;
  [['patspacing', p.patSpacing], ['patweight', p.patWeight], ['patangle', p.patAngle]].forEach(([k, v]) => { ctrl('rg-element-' + k).value = v; ctrl('v-element-' + k).textContent = v; });
}
// Which look blocks show: Stroke W for Stroke; the pattern block for Style = Pattern
// or a Pattern layer (whose Style means nothing — it has no shape of its own).
export function syncLookBlocks() {
  const L = state.layers, patRole = !!(L && (L.items[L.active].role || 'fill') === 'pattern');
  const fm = ctrl('sel-element-fillmode').value;
  ctrl('element-style-row').style.display = patRole ? 'none' : '';
  ctrl('element-stroke-block').style.display = !patRole && fm === 'stroke' ? '' : 'none';
  const usesPattern = L ? L.items.some((l, i) => (l.role || 'fill') === 'pattern' || (i === L.active ? fm : (l.look && l.look.fillMode)) === 'pattern') : fm === 'pattern';
  ctrl('element-pattern-block').style.display = usesPattern ? '' : 'none';
  ctrl('element-patangle-row').style.display = ctrl('sel-element-pattern').value === 'concentric' ? 'none' : '';
}
// Paper pattern (the "Ground"): a pattern laid over the Paper, always covering the
// whole canvas, under everything else — in every step (Element preview, Component,
// Symbol, each nested Component's own paper). Switched on by the Pattern icon on the
// Palette's Paper row. `null` = plain Paper. Saved in the appearance object, so a
// saved Component / Symbol keeps its own. Units: 1/100 of the canvas's short side,
// so the same settings look alike on the Element preview, a Component and a Symbol.
rt.paperPatternOn = false;
export function readGroundControls() {
  if (!rt.paperPatternOn) return null;
  const g = { patType: ctrl('sel-ground-pattern').value, patSpacing: val('rg-ground-patspacing'), patWeight: val('rg-ground-patweight'), patAngle: val('rg-ground-patangle'), ink: +ctrl('sel-ground-ink').value || 0 };
  if (g.patType === 'element') Object.assign(g, { src: ctrl('sel-ground-tile').value || 'element', layout: ctrl('sel-ground-layout').value, turn: ctrl('sel-ground-turn').value, patSize: val('rg-ground-patsize') });
  return g;
}
export function syncGroundInkOptions(selected) {
  const sel = ctrl('sel-ground-ink'), cur = selected != null ? String(selected) : sel.value;
  sel.innerHTML = state.colors.map((c, i) => `<option value="${i}">Ink ${i + 1}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : String(Math.max(0, state.colors.length - 1));
}
export function showGroundControls(g) {
  rt.paperPatternOn = !!g;
  if (g) {
    ctrl('sel-ground-pattern').value = g.patType;
    [['patspacing', g.patSpacing], ['patweight', g.patWeight], ['patangle', g.patAngle], ['patsize', g.patSize == null ? 70 : g.patSize]].forEach(([k, v]) => { ctrl('rg-ground-' + k).value = v; ctrl('v-ground-' + k).textContent = v; });
    ctrl('sel-ground-layout').value = g.layout || 'grid';
    ctrl('sel-ground-turn').value = g.turn || 'none';
    syncGroundTileOptions(g.src);
  }
  syncGroundInkOptions(g && g.ink !== 'cell' ? g.ink : null);
  if (typeof hooks.paperSwatch !== 'undefined') hooks.paperSwatch.setPattern(rt.paperPatternOn);
  syncGroundBlock();
}
export function syncGroundBlock() {
  const type = ctrl('sel-ground-pattern').value, tile = type === 'element';
  ctrl('ground-patangle-row').style.display = type === 'concentric' ? 'none' : '';
  ctrl('ground-tile-block').hidden = !tile;
  ctrl('ground-patweight-row').style.display = tile ? 'none' : '';   // a tile's weight is the Element's own (Fill, or its Stroke W)
  if (tile) syncGroundTileOptions();
}

export function liveElementTile() {
  const seed = getSeed();
  if (!seed || !SEED_TYPES[seed.type]) return null;
  const geo = SEED_TYPES[seed.type].geometry(seed);
  if (!geo || !geo.d) return null;
  // One silhouette: Stroke only for a single shape whose Style is Stroke; a stack / Fill / Pattern is a fill.
  const fm = ctrl('sel-element-fillmode').value, stroke = !state.layers && fm === 'stroke';
  return { geo: { d: geo.d, fillRule: geo.fillRule || null, normTx: geo.normTx, normTy: geo.normTy, normScale: geo.normScale },
    style: stroke ? { fillMode: 'stroke', strokeW: val('rg-element-strokew'), rounded: ctrl('ck-element-rounded').checked } : { fillMode: 'fill' } };
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
export function syncGroundTileOptions(selected) {
  const sel = ctrl('sel-ground-tile'), cur = selected != null ? selected : sel.value;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const elAll = ELEMENT_LIB.read(), saved = libraryNamesAll(elAll).filter(n => !elAll[n].hidden || cur === 'saved:' + n), gen = genesisTileForms();
  // tiny silhouette of each tile in the dropdown (icon thumbnails, currentColor)
  Object.keys(TILE_PICK_REG).forEach(k => delete TILE_PICK_REG[k]);
  TILE_PICK_REG.element = { name: 'Current Element', thumb: () => tileIconSVG(liveElementTile()) };
  saved.forEach(n => { const e = ELEMENT_LIB.read()[n]; TILE_PICK_REG['saved:' + n] = { name: esc(n), icon: tileIconSVG(e && e.tile) }; });
  gen.forEach(f => { TILE_PICK_REG['genesis:' + f.id] = { name: esc(f.name || f.id), thumb: () => tileIconSVG(resolveTile({ src: 'genesis:' + f.id })) }; });
  sel.innerHTML = '<option value="element">Current Element</option>'
    + (saved.length ? `<optgroup label="Saved Elements">${saved.map(n => `<option value="saved:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>` : '')
    + (gen.length ? `<optgroup label="Genesis seeds">${gen.map(f => `<option value="genesis:${esc(f.id)}">${esc(f.name || f.id)}</option>`).join('')}</optgroup>` : '');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'element';
  if (!rt.tilePicker) rt.tilePicker = Organica.selectPicker(sel, ctrl('ground-tile-picker'), { registry: TILE_PICK_REG, ariaLabel: 'Tile shape' });
  rt.tilePicker.invalidate();
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
    paintPath(ctx, op, path, geo);
    ctx.restore();
  }
  ctx.restore();
}
// Says so when the tile count hit the cap (the live Paper only).
export function syncGroundTileNote() {
  const g = readGroundControls(), note = ctrl('ground-tile-note');
  if (!g || g.patType !== 'element') { note.hidden = true; return; }
  const L = elementTileLayout(g, 100, 100);
  note.hidden = !L.capped;
  if (L.capped) note.textContent = `Spacing raised to ${L.spacing.toFixed(1)} — at most ${TILE_CAP.toLocaleString()} tiles per canvas.`;
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
  return (state.layers ? 'Stack' : ((SEED_ICONS[type] || {}).name || type)) + (label && label !== '0°' ? ' · ' + label : '') + ' ' + new Date().toLocaleTimeString();
}
export function saveElementVariant(rot, flipH, flipV, label, chosen) {
  const tile = orientedElementTile(rot, flipH, flipV);
  if (!tile) return;
  const all = ELEMENT_LIB.read();
  let name = chosen || defaultElementName(label);
  while (all[name]) name += '′';
  all[name] = { tile, sig: tileSig(tile), thumb: elementVariantSVG(rot, flipH, flipV), colors: state.colors.slice(), paperColor: state.paperColor, orientation: { rotation: rot, flipH, flipV }, seed: seedForSnapshot(), appearance: getElementAppearance(), savedAt: new Date().toISOString() };
  ELEMENT_LIB.write(all);
  elementLibraryChanged();
  return name;
}
// The Element as drawn — its own inks (Palette, layer inks), this orientation, on its
// Paper (colour + texture, as the Element frame shows it) — kept with a saved Element as
// its thumbnail. data-paper="2" marks a thumbnail that already carries the texture.
export function elementVariantSVG(rot, flipH, flipV) {
  const seed = getSeed(), geo = SEED_TYPES[seed.type].geometry(seed);
  const paper = (isPaperNone(state.paperColor) ? '' : `<rect width="100" height="100" fill="${state.paperColor}"/>`) + paperPatternSVG(100, 100);
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
// The second circle on the Element frame / views: save this view (if it isn't yet)
// and make it the Paper's tile — Paper pattern on, Pattern = Element.
export function elementTileButton(rot, flipH, flipV, label) {
  const t = orientedElementTile(rot, flipH, flipV);
  const savedName = t ? savedElementBySig(tileSig(t)) : null;
  const g = readGroundControls(), on = !!(savedName && g && g.patType === 'element' && g.src === 'saved:' + savedName);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fvs-thumb-tile';
  b.setAttribute('aria-pressed', String(on));
  const lbl = on ? 'This view is the Paper tile' : 'Use this view' + (label && label !== '0°' ? ' (' + label + ')' : '') + ' as the Paper tile';
  b.setAttribute('aria-label', lbl); b.title = lbl;
  b.innerHTML = Organica.icons.get('pattern', { size: 'sm' });
  b.disabled = !t;
  b.addEventListener('click', e => {
    e.stopPropagation();
    const name = savedName || saveElementVariant(rot, flipH, flipV, label);
    if (name) useAsPaperTile('saved:' + name);
  });
  return b;
}
export function removeSavedElement(name) {
  const all = ELEMENT_LIB.read();
  delete all[name];
  ELEMENT_LIB.write(all);
  elementLibraryChanged();
  hooks.onAppearanceChange();   // a Paper tile that pointed at it falls back to nothing / the live Element
}
export function elementLibraryChanged() { syncGroundTileOptions(); mountElementQuickSaves(); hooks.renderLibraryRail(); hooks.renderSymbolPool(); }   // an empty Symbol can now build from Elements
// The corner circle (the Component gallery's quick-save): + saves this view,
// ✓ = already saved, hovering ✓ offers remove.
export function elementQuickSaveButton(rot, flipH, flipV, label) {
  const t = orientedElementTile(rot, flipH, flipV);
  const savedName = t ? savedElementBySig(tileSig(t)) : null;
  const b = quickSaveButton({
    savedName,
    labelSave: 'Save the Element' + (label && label !== '0°' ? ' at ' + label : '') + ' to Saved Elements',
    labelSaved: 'Saved as ' + savedName,
    labelRemove: 'Remove from Saved Elements',
    onSave: () => saveElementVariant(rot, flipH, flipV, label),   // no "Saved as …" notice (Diego, Oct 6, 2026): the ✓ on the button says it
    onRemove: () => removeSavedElement(savedName),
  });
  b.disabled = !t;
  return b;
}
// THE quick-save circle (Component gallery + Element views): + saves, a persistent
// ✓ once saved, hovering the ✓ offers remove (×). One builder so the two never drift.
export function quickSaveButton({ savedName, labelSave, labelSaved, labelRemove, onSave, onRemove }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fvs-thumb-quicksave' + (savedName ? ' saved' : '');
  const show = (icon, label) => { b.innerHTML = Organica.icons.get(icon, { size: 'sm' }); b.setAttribute('aria-label', label); b.title = label; };
  show(savedName ? 'check' : 'plus', savedName ? labelSaved : labelSave);
  if (savedName) {
    b.addEventListener('mouseenter', () => { show('close', labelRemove); b.classList.add('delete-hover'); });
    b.addEventListener('mouseleave', () => { show('check', labelSaved); b.classList.remove('delete-hover'); });
  }
  b.addEventListener('click', e => { e.stopPropagation(); if (savedName) onRemove(); else onSave(); });
  return b;
}
export function mountElementQuickSaves() {
  if (hooks.elementIsEmpty()) { ctrl('element-frame').querySelectorAll(':scope > .fvs-thumb-quicksave, :scope > .fvs-thumb-tile').forEach(x => x.remove()); return; }
  const boxes = ctrl('seed-preview').querySelectorAll('.fvs-seed-tile__box');
  seedPreviewStates().forEach(([r, fh, fv, label], i) => { const box = boxes[i]; if (box) { box.querySelectorAll('.fvs-thumb-quicksave, .fvs-thumb-tile').forEach(x => x.remove()); box.append(elementTileButton(r, fh, fv, label), elementQuickSaveButton(r, fh, fv, label)); } });
  const frame = ctrl('element-frame');
  frame.querySelectorAll(':scope > .fvs-thumb-quicksave, :scope > .fvs-thumb-tile').forEach(x => x.remove());
  const v = hooks.currentElementView(), vi = hooks.elementViewIndex(), lbl = vi >= 0 ? seedPreviewStates()[vi][3] : '0°';
  frame.append(elementTileButton(v.r, v.fh, v.fv, lbl), elementQuickSaveButton(v.r, v.fh, v.fv, lbl));
  if (rt.tilePicker) rt.tilePicker.invalidate('element');   // the "Current Element" thumbnail follows the Element
}
// Click on a saved Element: Paper pattern on, Pattern = Element, this tile.
export function useAsPaperTile(src) {
  rt.paperPatternOn = true;
  hooks.paperSwatch.setPattern(true);
  ctrl('sel-ground-pattern').value = 'element';
  syncGroundBlock();
  syncGroundTileOptions(src);
  hooks.onAppearanceChange();
}
export const groundInk = g => {
  const pal = rt.inkPaletteOverride || state.colors, i = g.ink === 'cell' || g.ink == null ? 0 : +g.ink;
  return pal[((i % pal.length) + pal.length) % pal.length];
};
export function paperPatternSVG(w, h) {
  const g = getElementAppearance().ground;
  if (!g || !(w > 0) || !(h > 0)) return '';
  if (g.patType === 'element') return elementTileSVG(g, w, h, 'gnd' + hooks.nextDrawId());
  const id = 'gnd' + hooks.nextDrawId(), { k, pg } = paperPatternGeo(g, w, h);
  return `<clipPath id="${id}"><rect width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})"><g transform="scale(${k.toFixed(4)})"><path d="${pg.d}" ${patternAttrs(pg, groundInk(g))}/></g></g>`;
}
export function paintPaperPatternCanvas(ctx, w, h) {
  const g = getElementAppearance().ground;
  if (!g || !(w > 0) || !(h > 0)) return;
  if (g.patType === 'element') { paintElementTileCanvas(ctx, g, w, h); return; }
  const { k, pg } = paperPatternGeo(g, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.scale(k, k);
  paintPatternCanvas(ctx, pg, groundInk(g));
  ctx.restore();
}
// While set, getElementAppearance() returns it instead of the live controls —
// how a saved Component/Symbol (and the nested Components inside a Symbol)
// renders with the appearance it was SAVED with, not whatever the Element
// panel says now. Entries saved before this field existed fall back to plain.
rt.appearanceOverride = null;
// Export "Variants" override — merged over a saved Symbol's own appearance
// in renderedSymbolEntrySVG so the Grid tier can change Style too.
rt.variantAppearance = null;
export function withAppearance(app, fn) {
  const prev = rt.appearanceOverride;
  rt.appearanceOverride = { ...DEFAULT_APPEARANCE, ...(app || {}) };
  try { return fn(); } finally { rt.appearanceOverride = prev; }
}
export function applyAppearanceToUI(app) {
  rt.shapeLooks = {};   // a loaded look replaces whatever the shapes remembered
  const a = { ...DEFAULT_APPEARANCE, ...(app || {}) };
  ctrl('sel-element-fillmode').value = a.fillMode;
  ctrl('rg-element-strokew').value = a.strokeW; ctrl('v-element-strokew').textContent = a.strokeW;
  ctrl('ck-element-rounded').checked = a.rounded;
  ctrl('rg-element-w').value = a.w; ctrl('v-element-w').textContent = a.w;
  ctrl('rg-element-l').value = a.l; ctrl('v-element-l').textContent = a.l;
  ['scale', 'mx', 'my', 'rotate'].forEach(k => { ctrl('rg-element-' + k).value = a[k]; ctrl('v-element-' + k).textContent = a[k]; });
  showPatternControls(a);
  showGroundControls(a.ground);
  syncLookBlocks();
  // A loaded stack whose layers predate per-layer looks: they take this appearance
  // as their own, so the live Element keeps the Width/Length it was saved with.
  if (state.layers) {
    state.layers.items.forEach(l => { if (!l.look) l.look = hooks.readLookControls(); });
    hooks.showLayerStyle(state.layers.items[state.layers.active]);
  }
}
export function getElementAppearance() {
  if (rt.appearanceOverride) return rt.appearanceOverride;
  return {
    fillMode: ctrl('sel-element-fillmode').value,
    strokeW: val('rg-element-strokew'),
    rounded: ctrl('ck-element-rounded').checked,
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
