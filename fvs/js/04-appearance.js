// Flexible Visual System · 04-appearance — Items, appearance, Pattern / Ground, Element as tile, Saved Elements.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  TILE_PICK_REG, live, pv, state
} from './engine/00-core.js';
import {
  seedForSnapshot
} from './engine/02-seed-ui.js';
import {
  DEFAULT_APPEARANCE, ELEMENT_LIB, TILE_CAP, defaultElementName, elementTileLayout, elementVariantSVG,
  genesisTileForms, getElementAppearance, libraryNamesAll, liveElementTile, orientedElementTile, patternOf,
  PHOTO_DEFAULTS, photoOf, photoSelfContained, primePhoto, readGroundControls, resolveTile, savedElementBySig, tileIconSVG, tileSig
} from './engine/04-appearance.js';
import {
  seedPreviewStates
} from './engine/05-render-component.js';
import {
  elementIsEmpty
} from './engine/06-component-ui.js';
import {
  readLookControls
} from './engine/07-library.js';
import {
  ctrl
} from './00-core.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  syncGroundInkOptions: () => syncGroundInkOptions
});

// ── Photo (Style = Photo — Tropism T2, Oct 23, 2026) ──
// Each photo once, in its own store (by id, synced like every store); an appearance carries only its id, so a saved
// Component / Symbol never copies the picture. Stored as a JPEG of at most 1024 px on its longer side.
export const PHOTO_STORE = Organica.store('fvs-photo');
const PHOTO_MAX = 1024;
live.photoSource = id => { const e = PHOTO_STORE.peek()[id]; return e && e.data ? e.data : null; };
let _photoRedraw = 0;
live.onPhotoReady = () => {   // a photo decoded after a drawing asked for it: draw everything again, once per frame
  if (_photoRedraw) return;
  _photoRedraw = requestAnimationFrame(() => { _photoRedraw = 0; hooks.onAppearanceChange(); });
};
export function showPhotoControls(lk) {
  const p = { ...PHOTO_DEFAULTS, ...photoOf(lk) };
  ctrl('in-element-photo').value = p.photoId;
  ctrl('in-element-photolook').value = p.photoLook;
  ctrl('sel-element-photoalg').value = p.photoAlg;
  [['photodot', p.photoDot], ['photocontrast', p.photoContrast], ['photosize', p.photoSize], ['photomx', p.photoMx], ['photomy', p.photoMy]]
    .forEach(([k, v]) => { ctrl('rg-element-' + k).value = v; ctrl('v-element-' + k).textContent = v; });
  syncPhotoBlock();
}
// What the photo block shows: Open photo… or the photo with Replace / Remove; Algorithm and Dot size for Dither,
// Contrast for Tone and Dither.
export function syncPhotoBlock() {
  const id = pv('in-element-photo'), look = pv('in-element-photolook') || 'normal';
  ctrl('element-photo-open-row').style.display = id ? 'none' : '';   // .ctrl-row is flex: style.display, not hidden
  ctrl('element-photo-has-row').style.display = id ? '' : 'none';
  if (id) { const src = live.photoSource(id); if (src && ctrl('img-element-photo').getAttribute('src') !== src) ctrl('img-element-photo').src = src; }
  ctrl('seg-element-photolook').querySelectorAll('.seg-btn').forEach(b => { const on = b.dataset.look === look; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  ctrl('element-photoalg-row').style.display = ctrl('element-photodot-row').style.display = look === 'dither' ? '' : 'none';
  ctrl('element-photocontrast-row').style.display = look === 'normal' ? 'none' : '';
}
// A file → a JPEG ≤ 1024 px in the store → this Element's photo (Style = Photo).
export function usePhotoFile(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { Organica.notice('That file is not a photo — choose a JPEG, PNG or WebP image', { kind: 'info' }); return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const k = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
    const cx = cv.getContext('2d');
    cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);   // a JPEG has no alpha: transparent reads as white
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    const data = cv.toDataURL('image/jpeg', 0.85);
    const id = 'photo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const all = PHOTO_STORE.read();
    all[id] = { data, name: file.name, w: cv.width, h: cv.height, savedAt: new Date().toISOString() };
    if (!PHOTO_STORE.write(all)) return;   // storage full: the store showed the notice
    const dec = new Image();
    dec.onload = () => {
      primePhoto(id, dec);
      ctrl('in-element-photo').value = id;
      ctrl('sel-element-fillmode').value = 'photo';
      syncPhotoBlock();
      hooks.onAppearanceChange();
    };
    dec.src = data;
  };
  img.onerror = () => { URL.revokeObjectURL(url); Organica.notice('This photo could not be read', { kind: 'info' }); };
  img.src = url;
}
// Files can't reach the screen's photos: every export runs its SVG through this (and says so when a raster went in).
export function exportablePhotoSVG(svg, quiet) {
  const r = photoSelfContained(svg);
  if (r.raster && !quiet) Organica.notice('This export contains a photo (raster) — choose Dither for vector plates', { kind: 'info' });
  return r.svg;
}
['btn-element-photo-open', 'btn-element-photo-replace'].forEach(id => ctrl(id).addEventListener('click', () => ctrl('file-element-photo').click()));
ctrl('file-element-photo').addEventListener('change', e => { const f = e.target.files[0]; if (f) usePhotoFile(f); e.target.value = ''; });
ctrl('btn-element-photo-remove').addEventListener('click', () => {   // the photo leaves this Element (the store keeps it — saved work may use it)
  ctrl('in-element-photo').value = '';
  if (pv('sel-element-fillmode') === 'photo') ctrl('sel-element-fillmode').value = 'fill';
  syncPhotoBlock();
  hooks.onAppearanceChange();
});
ctrl('seg-element-photolook').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn[data-look]');
  if (!b) return;
  ctrl('in-element-photolook').value = b.dataset.look;
  syncPhotoBlock();
  hooks.onAppearanceChange();
});
ctrl('sel-element-photoalg').addEventListener('change', () => hooks.onAppearanceChange());
['photodot', 'photocontrast', 'photosize', 'photomx', 'photomy'].forEach(k => ctrl('rg-element-' + k).addEventListener('input', e => {
  ctrl('v-element-' + k).textContent = e.target.value; hooks.onAppearanceChange();
}));




// Each shape remembers its own Appearance (single shape only): switching Square → Arc must not make Arc
// inherit the Square's Style / Stroke / Width / Length / Scale / Move / Pattern. A shape opened for the first
// time starts from defaults; going back restores what it had. `var`: loaders reach these before the handler is defined.
rt.shapeLooks = {}; rt.lastShapeType = null;
export function showPatternControls(lk) {
  const p = patternOf(lk);
  ctrl('sel-element-pattern').value = p.patType;
  [['patspacing', p.patSpacing], ['patweight', p.patWeight], ['patangle', p.patAngle]].forEach(([k, v]) => { ctrl('rg-element-' + k).value = v; ctrl('v-element-' + k).textContent = v; });
}
// Which look blocks show: Stroke W for Stroke; the pattern block for Style = Pattern
// or a Pattern layer (whose Style means nothing — it has no shape of its own).
export function syncLookBlocks() {
  const L = state.layers, patRole = !!(L && (L.items[L.active].role || 'fill') === 'pattern');
  const fm = pv('sel-element-fillmode');
  ctrl('element-style-row').style.display = patRole ? 'none' : '';
  ctrl('element-stroke-block').style.display = !patRole && fm === 'stroke' ? '' : 'none';
  const usesPattern = L ? L.items.some((l, i) => (l.role || 'fill') === 'pattern' || (i === L.active ? fm : (l.look && l.look.fillMode)) === 'pattern') : fm === 'pattern';
  ctrl('element-pattern-block').style.display = usesPattern ? '' : 'none';
  ctrl('element-patangle-row').style.display = pv('sel-element-pattern') === 'concentric' ? 'none' : '';
  const usesPhoto = L ? L.items.some((l, i) => (l.role || 'fill') === 'fill' && (i === L.active ? fm : (l.look && l.look.fillMode)) === 'photo') : fm === 'photo';
  ctrl('element-photo-block').hidden = !usesPhoto || patRole;
  if (usesPhoto) syncPhotoBlock();
}
export function syncGroundInkOptions(selected) {
  const sel = ctrl('sel-ground-ink'), cur = selected != null ? String(selected) : sel.value;
  sel.innerHTML = state.colors.map((c, i) => `<option value="${i}">Ink ${i + 1}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : String(Math.max(0, state.colors.length - 1));
}
export function showGroundControls(g) {
  live.paperPatternOn = !!g;
  if (g) {
    ctrl('sel-ground-pattern').value = g.patType;
    [['patspacing', g.patSpacing], ['patweight', g.patWeight], ['patangle', g.patAngle], ['patsize', g.patSize == null ? 70 : g.patSize]].forEach(([k, v]) => { ctrl('rg-ground-' + k).value = v; ctrl('v-ground-' + k).textContent = v; });
    ctrl('sel-ground-layout').value = g.layout || 'grid';
    ctrl('sel-ground-turn').value = g.turn || 'none';
    syncGroundTileOptions(g.src);
  }
  syncGroundInkOptions(g && g.ink !== 'cell' ? g.ink : null);
  if (typeof hooks.paperSwatch !== 'undefined') hooks.paperSwatch.setPattern(live.paperPatternOn);
  syncGroundBlock();
}
export function syncGroundBlock() {
  const type = pv('sel-ground-pattern'), tile = type === 'element';
  ctrl('ground-patangle-row').style.display = type === 'concentric' ? 'none' : '';
  ctrl('ground-tile-block').hidden = !tile;
  ctrl('ground-patweight-row').style.display = tile ? 'none' : '';   // a tile's weight is the Element's own (Fill, or its Stroke W)
  if (tile) syncGroundTileOptions();
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
// Says so when the tile count hit the cap (the live Paper only).
export function syncGroundTileNote() {
  const g = readGroundControls(), note = ctrl('ground-tile-note');
  if (!g || g.patType !== 'element') { note.hidden = true; return; }
  const L = elementTileLayout(g, 100, 100);
  note.hidden = !L.capped;
  if (L.capped) note.textContent = `Spacing raised to ${L.spacing.toFixed(1)} — at most ${TILE_CAP.toLocaleString()} tiles per canvas.`;
}

export function saveElementVariant(rot, flipH, flipV, label, chosen) {
  const tile = orientedElementTile(rot, flipH, flipV);
  if (!tile) return;
  const all = ELEMENT_LIB.read();
  let name = chosen || defaultElementName(label);
  while (all[name]) name += '′';
  all[name] = { tile, sig: tileSig(tile), thumb: elementVariantSVG(rot, flipH, flipV), colors: state.colors.slice(), paperColor: state.paperColor, orientation: { rotation: rot, flipH, flipV }, seed: seedForSnapshot(), appearance: getElementAppearance(), savedAt: new Date().toISOString() };
  if (!ELEMENT_LIB.write(all)) return null;   // storage full: the store showed the notice — no ✓, no Paper tile
  elementLibraryChanged();
  return name;
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
  if (elementIsEmpty()) { ctrl('element-frame').querySelectorAll(':scope > .fvs-thumb-quicksave, :scope > .fvs-thumb-tile').forEach(x => x.remove()); return; }
  const boxes = ctrl('seed-preview').querySelectorAll('.fvs-seed-tile__box');
  seedPreviewStates().forEach(([r, fh, fv, label], i) => { const box = boxes[i]; if (box) { box.querySelectorAll('.fvs-thumb-quicksave, .fvs-thumb-tile').forEach(x => x.remove()); box.append(elementTileButton(r, fh, fv, label), elementQuickSaveButton(r, fh, fv, label)); } });
  const frame = ctrl('element-frame');
  frame.querySelectorAll(':scope > .fvs-thumb-quicksave, :scope > .fvs-thumb-tile').forEach(x => x.remove());
  const v = hooks.currentElementView(), vi = hooks.elementViewIndex(), lbl = vi >= 0 ? seedPreviewStates()[vi][3] : '0°';
  // (no pencil since Oct 11, 2026: parts are picked on the board — 18-step-boards.js)
  frame.append(elementTileButton(v.r, v.fh, v.fv, lbl), elementQuickSaveButton(v.r, v.fh, v.fv, lbl));
  if (rt.tilePicker) rt.tilePicker.invalidate('element');   // the "Current Element" thumbnail follows the Element
}
// Click on a saved Element: Paper pattern on, Pattern = Element, this tile.
export function useAsPaperTile(src) {
  live.paperPatternOn = true;
  hooks.paperSwatch.setPattern(true);
  ctrl('sel-ground-pattern').value = 'element';
  syncGroundBlock();
  syncGroundTileOptions(src);
  hooks.onAppearanceChange();
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
  showPhotoControls(a);
  showGroundControls(a.ground);
  syncLookBlocks();
  // A loaded stack whose layers predate per-layer looks: they take this appearance
  // as their own, so the live Element keeps the Width/Length it was saved with.
  if (state.layers) {
    state.layers.items.forEach(l => { if (!l.look) l.look = readLookControls(); });
    hooks.showLayerStyle(state.layers.items[state.layers.active]);
  }
}
