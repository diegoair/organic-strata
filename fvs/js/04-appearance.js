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

// ── Photo (Style = Photo — Tropism T2, Oct 23, 2026; the Paper's Pattern = Photo and SVG files, Oct 24, 2026) ──
// Each photo once, in its own store (by id, synced like every store); an appearance carries only its id, so a saved
// Component / Symbol never copies the picture. A photo is stored as a JPEG of at most 1024 px on its longer side; an SVG
// as its own text (it stays vector in Look Normal) + a data URL that decodes it as an image for Tone / Dither.
// Two sets of the same controls: `element` (Look & place, Style = Photo) and `ground` (Paper › Pattern = Photo).
export const PHOTO_STORE = Organica.store('fvs-photo');
const PHOTO_MAX = 1024, SVG_MAX = 2 * 1024 * 1024;
live.photoSource = id => { const e = PHOTO_STORE.peek()[id]; return e && e.data ? e.data : null; };
live.photoSvg = id => { const e = PHOTO_STORE.peek()[id]; return e && e.kind === 'svg' ? e.svg : null; };
let _photoRedraw = 0;
live.onPhotoReady = () => {   // a photo decoded after a drawing asked for it: draw everything again, once per frame
  if (_photoRedraw) return;
  _photoRedraw = requestAnimationFrame(() => { _photoRedraw = 0; hooks.onAppearanceChange(); });
};
export function showPhotoControls(lk, pre = 'element') {
  const p = { ...PHOTO_DEFAULTS, ...photoOf(lk) };
  ctrl('in-' + pre + '-photo').value = p.photoId;
  ctrl('in-' + pre + '-photolook').value = p.photoLook;
  ctrl('sel-' + pre + '-photoalg').value = p.photoAlg;
  [['photodot', p.photoDot], ['photocontrast', p.photoContrast], ['photosize', p.photoSize], ['photomx', p.photoMx], ['photomy', p.photoMy]]
    .forEach(([k, v]) => { ctrl('rg-' + pre + '-' + k).value = v; ctrl('v-' + pre + '-' + k).textContent = v; });
  if (pre === 'ground') ctrl('chk-ground-photocells').checked = !!(lk && lk.photoCells);
  syncPhotoBlock(pre);
}
// What a photo block shows: Open photo or SVG… or the photo with Replace photo or SVG… / Remove; Algorithm and Dot size for Dither,
// Contrast for Tone and Dither.
export function syncPhotoBlock(pre = 'element') {
  const id = pv('in-' + pre + '-photo'), look = pv('in-' + pre + '-photolook') || 'normal';
  ctrl(pre + '-photo-open-row').style.display = id ? 'none' : '';   // .ctrl-row is flex: style.display, not hidden
  ctrl(pre + '-photo-has-row').style.display = id ? '' : 'none';
  if (id) { const src = live.photoSource(id), im = ctrl('img-' + pre + '-photo'); if (src && im.getAttribute('src') !== src) im.src = src; }
  ctrl('seg-' + pre + '-photolook').querySelectorAll('.seg-btn').forEach(b => { const on = b.dataset.look === look; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  ctrl(pre + '-photoalg-row').style.display = ctrl(pre + '-photodot-row').style.display = look === 'dither' ? '' : 'none';
  ctrl(pre + '-photocontrast-row').style.display = look === 'normal' ? 'none' : '';
}
// An uploaded SVG made safe and measurable: no script / foreignObject / event attributes, a viewBox, and a size of
// 1024 on its longer side (so it decodes as an image at that size for Tone / Dither). → text, or null if unreadable.
function normalisePhotoSvg(text) {
  let doc;
  try { doc = new DOMParser().parseFromString(text, 'image/svg+xml'); } catch (e) { return null; }
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  [...root.querySelectorAll('script, foreignObject')].forEach(n => n.remove());
  // nothing that runs or reaches out: event attributes, a link that is not #… or an embedded image, an external url() / @import
  [root, ...root.querySelectorAll('*')].forEach(n => [...n.attributes].forEach(at => {
    const v = at.value.trim();
    if (/^on/i.test(at.name) || (/(^|:)href$/i.test(at.name) && !/^(#|data:image\/)/i.test(v)) || /url\(\s*['"]?(?!#|data:image\/)/i.test(v)) n.removeAttribute(at.name);
  }));
  [...root.querySelectorAll('style')].forEach(n => { if (/@import|url\(\s*['"]?(?!#|data:image\/)/i.test(n.textContent)) n.remove(); });
  [...root.querySelectorAll('image, use')].forEach(n => { if (!n.getAttribute('href') && !n.getAttribute('xlink:href')) n.remove(); });   // what pointed outside is gone
  let vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) {
    const w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
    vb = [0, 0, w > 0 ? w : 100, h > 0 ? h : 100];
    root.setAttribute('viewBox', vb.join(' '));
  }
  const k = PHOTO_MAX / Math.max(vb[2], vb[3]);
  root.setAttribute('width', (vb[2] * k).toFixed(2)); root.setAttribute('height', (vb[3] * k).toFixed(2));
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(root);
}
// The new photo becomes this block's: the Element's Style = Photo, or the Paper's Pattern = Photo.
function usePhotoId(id, img, pre) {
  primePhoto(id, img);
  ctrl('in-' + pre + '-photo').value = id;
  if (pre === 'element') ctrl('sel-element-fillmode').value = 'photo';
  else { live.paperPatternOn = true; if (hooks.paperSwatch) hooks.paperSwatch.setPattern(true); ctrl('sel-ground-pattern').value = 'photo'; syncGroundBlock(); }
  syncPhotoBlock(pre);
  hooks.onAppearanceChange();
}
const newPhotoId = () => 'photo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// A file → the store → this block's photo. A photo: a JPEG ≤ 1024 px. An SVG: its own text (≤ 2 MB).
export function usePhotoFile(file, pre = 'element') {
  const isSvg = file && (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || ''));
  if (!file || (!isSvg && !/^image\/(jpeg|png|webp)$/.test(file.type))) { Organica.notice('That file is not a photo or an SVG — choose a JPEG, PNG, WebP or SVG file', { kind: 'info' }); return; }
  if (isSvg) {
    if (file.size > SVG_MAX) { Organica.notice(`This SVG is too large (${(file.size / 1048576).toFixed(1)} MB) — at most 2 MB`, { kind: 'info' }); return; }
    file.text().then(text => {
      const svg = normalisePhotoSvg(text);
      if (!svg) { Organica.notice('This SVG could not be read', { kind: 'info' }); return; }
      const data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), id = newPhotoId();
      const all = PHOTO_STORE.read();
      all[id] = { kind: 'svg', svg, data, name: file.name, savedAt: new Date().toISOString() };
      if (!PHOTO_STORE.write(all)) return;   // storage full: the store showed the notice
      const dec = new Image();
      dec.onload = () => usePhotoId(id, dec, pre);
      dec.onerror = () => Organica.notice('This SVG could not be drawn', { kind: 'info' });
      dec.src = data;
    });
    return;
  }
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
    const data = cv.toDataURL('image/jpeg', 0.85), id = newPhotoId();
    const all = PHOTO_STORE.read();
    all[id] = { data, name: file.name, w: cv.width, h: cv.height, savedAt: new Date().toISOString() };
    if (!PHOTO_STORE.write(all)) return;   // storage full: the store showed the notice
    const dec = new Image();
    dec.onload = () => usePhotoId(id, dec, pre);
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
['element', 'ground'].forEach(pre => {
  [pre + '-photo-open', pre + '-photo-replace'].forEach(id => ctrl('btn-' + id).addEventListener('click', () => ctrl('file-' + pre + '-photo').click()));
  ctrl('file-' + pre + '-photo').addEventListener('change', e => { const f = e.target.files[0]; if (f) usePhotoFile(f, pre); e.target.value = ''; });
  ctrl('btn-' + pre + '-photo-remove').addEventListener('click', () => {   // the photo leaves this block (the store keeps it — saved work may use it)
    ctrl('in-' + pre + '-photo').value = '';
    if (pre === 'element' && pv('sel-element-fillmode') === 'photo') ctrl('sel-element-fillmode').value = 'fill';
    syncPhotoBlock(pre);
    hooks.onAppearanceChange();
  });
  ctrl('seg-' + pre + '-photolook').addEventListener('click', e => {
    const b = e.target.closest('.seg-btn[data-look]');
    if (!b) return;
    ctrl('in-' + pre + '-photolook').value = b.dataset.look;
    syncPhotoBlock(pre);
    hooks.onAppearanceChange();
  });
  ctrl('sel-' + pre + '-photoalg').addEventListener('change', () => hooks.onAppearanceChange());
  ['photodot', 'photocontrast', 'photosize', 'photomx', 'photomy'].forEach(k => ctrl('rg-' + pre + '-' + k).addEventListener('input', e => {
    ctrl('v-' + pre + '-' + k).textContent = e.target.value; hooks.onAppearanceChange();
  }));
});
ctrl('chk-ground-photocells').addEventListener('change', () => hooks.onAppearanceChange());



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
    showPhotoControls(g, 'ground');
  }
  syncGroundInkOptions(g && g.ink !== 'cell' ? g.ink : null);
  if (typeof hooks.paperSwatch !== 'undefined') hooks.paperSwatch.setPattern(live.paperPatternOn);
  syncGroundBlock();
}
export function syncGroundBlock() {
  const type = pv('sel-ground-pattern'), tile = type === 'element', photo = type === 'photo';
  ctrl('ground-patangle-row').style.display = type === 'concentric' || photo ? 'none' : '';
  ctrl('ground-tile-block').hidden = !tile;
  ctrl('ground-patweight-row').style.display = tile || photo ? 'none' : '';   // a tile's weight is the Element's own (Fill, or its Stroke W)
  ['ground-ink-row', 'ground-patspacing-row'].forEach(id => { ctrl(id).style.display = photo ? 'none' : ''; });   // a photo has no ink, no spacing
  ctrl('ground-photo-block').hidden = !photo;
  if (photo) syncPhotoBlock('ground');
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
