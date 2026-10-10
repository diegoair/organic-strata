// Flexible Visual System · 07-library — Component library + layers UI + Underlying picker.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  DEFAULT_COLOR_RULE, PALETTE_MAX, colorAt, entryInkAt, live, pv, state
} from './engine/00-core.js';
import {
  SEG_WEIGHT_DEF, SEED_TYPES, cellShapeOf, divideLayers, frameDims, partMethodsFor, partsOf, syncPartLayers
} from './engine/01-geometry.js';
import {
  CIRCLE_PARAMS, SEED_EXTRAS, SEED_ICONS, cap, panelSeedSnapshot, xrId
} from './engine/02-seed-ui.js';
import {
  fitThumbBox
} from './engine/03-rules.js';
import {
  buildComponentItems
} from './engine/04-appearance.js';
import {
  LAYER_ROLES, layerInkColor, layerPlace, withEntryInks
} from './engine/05-render-component.js';
import {
  LAYER_NEW_INKS, LAYER_ROLE_ORDER, LIBRARY, buildComponentSVGWithPaper, buildLibraryEntryFor, hexKey,
  layerName, libraryNames, newLayerId, readLookControls, syncActiveLayer, uniqueLibraryName
} from './engine/07-library.js';
import {
  addSavedToPool
} from './engine/10-suggest.js';
import {
  SYMBOL_LIBRARY
} from './engine/11-symbol-ui.js';
import {
  NEW_LAYER_SCALE
} from './engine/12-shell.js';
import {
  buildPalette, ctrl, syncColorPartsRow, syncColorRuleUI
} from './00-core.js';
import {
  setCellShape
} from './01-geometry.js';
import {
  fhEditor, foldLegacySeed, syncDependentRows
} from './02-seed-ui.js';
import {
  setComponentGrid, syncComponentGridUI
} from './03-rules.js';
import {
  applyAppearanceToUI, syncLookBlocks
} from './04-appearance.js';
import {
  renderGallery, renderSeedPreview
} from './05-render-component.js';
import {
  syncExhaustiveHint, syncRuleAvailability, syncSeedUI
} from './06-component-ui.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  applyElementSnapshot: () => applyElementSnapshot, applySeedToPanel: () => applySeedToPanel, enterElementEdit: () => enterElementEdit,
  deleteQuickSavedComponent: () => deleteQuickSavedComponent,
  quickSaveComponentToLibrary: () => quickSaveComponentToLibrary, renderLayersUI: () => renderLayersUI,
  showLayerStyle: () => showLayerStyle, syncComponentRoleUI: () => syncComponentRoleUI
});


// One-click save straight from a gallery thumbnail's own hover button —
// no name prompt, unlike "Save selected to library" below (which stays
// for when you actually want to pick your own name). Saves whichever
// candidate the button sits on, not necessarily the selected one — but
// also SELECTS it (an explicit action, same as clicking the thumbnail
// itself would), so the saved thumbnail keeps the normal selected border
// on top of its own persistent 3px "saved" marker. The ✓ + border both
// persist through any later renderGallery() re-render (grid resize,
// Element change, undo…) since they're read from comp.savedName /
// state.selectedId, not a transient timeout. Once saved, the same button
// becomes a delete toggle (deleteQuickSavedComponent below) — a fresh save
// always mints a new entry (or dedupes), it never silently overwrites an
// existing one.
export function quickSaveComponentToLibrary(compId, chosen) {
  const comp = state.components.find(c => c.id === compId);
  const entry = buildLibraryEntryFor(comp);
  if (!entry) return;
  const name = uniqueLibraryName(chosen || comp.ruleSource + ' ' + new Date().toLocaleTimeString());
  const all = LIBRARY.read();
  all[name] = entry;
  if (!LIBRARY.write(all)) return;   // storage full: the store showed the notice — no ✓ for a save that did not happen
  addSavedToPool(name);
  state.selectedId = comp.id;
  state.selectionExplicit = true;
  comp.savedName = name;
  renderLibrary();
  renderGallery();
}

// Every candidate in the gallery at once — the same entry and "<rule> <time>"
// name as the quick-save above, one LIBRARY.write for the whole batch. A
// candidate whose saved entry still exists is skipped, so a second click
// adds nothing; the selection is left as it is.
export function saveAllComponentsToLibrary() {
  const all = LIBRARY.read();
  const time = new Date().toLocaleTimeString();
  const added = [];   // [comp, name]
  state.components.forEach(comp => {
    if (comp.savedName && all[comp.savedName]) return;
    const entry = buildLibraryEntryFor(comp);
    if (!entry) return;
    const base = comp.ruleSource + ' ' + time;
    let name = base, i = 2;
    while (all[name]) name = `${base} (${i++})`;
    all[name] = entry;
    added.push([comp, name]);
  });
  if (!added.length) return;
  if (!LIBRARY.write(all)) return;   // storage full: the store showed the notice — nothing is marked saved
  added.forEach(([comp, name]) => { comp.savedName = name; addSavedToPool(name); });
  renderLibrary();
  renderGallery();
  Organica.notice(`Saved ${added.length} Component${added.length === 1 ? '' : 's'}`, { kind: 'info' });
}

// The saved ✓'s own hover-delete affordance — removes the library entry
// this candidate was saved as (reuses removeLibraryEntry, the same one
// the Library section's own "×" tile calls), then clears the marker so
// the thumbnail's button reverts to a plain hover-only "+".
export function deleteQuickSavedComponent(compId) {
  const comp = state.components.find(c => c.id === compId);
  if (!comp || !comp.savedName) return;
  hooks.deleteSaved('component', comp.savedName);   // kept hidden while a Symbol / Container still uses it
  comp.savedName = null;
  renderGallery();
}

export function removeLibraryEntry(name) {
  const all = LIBRARY.read();
  delete all[name];
  LIBRARY.write(all);
  state.components.forEach(c => { if (c.savedName === name) delete c.savedName; });   // the gallery's saved ✓ must follow
  renderLibrary();
}

// Restores every Seed-panel control (type + all its rg-*/sel-* params) from
// a plain seed object — extracted out of applyLibraryEntryToUI (which still
// calls this first thing) so Component Edit mode's cell-select can reuse the
// exact same restore logic without also touching grid/palette/role, which
// applyLibraryEntryToUI does right after this. Pure refactor: byte-identical
// behaviour, verified against the regression suite.
// Seed + Appearance of a saved Element into the panel, retired controls converted first (foldLegacySeed).
export function applyElementSnapshot(seed, app) {
  const f = foldLegacySeed(seed, app);
  applySeedToPanel(f.seed);
  applyAppearanceToUI(f.app);
}
export function applySeedToPanel(seed) {
  setCellShape(cellShapeOf(seed), { silent: true });
  if (seed && seed.type === 'stack' && Array.isArray(seed.layers) && seed.layers.length) {
    const items = seed.layers.map(l => JSON.parse(JSON.stringify(l)));
    const active = Math.max(0, Math.min(items.length - 1, seed.active | 0));
    state.layers = { items, active, ...(seed.parts ? { parts: JSON.parse(JSON.stringify(seed.parts)) } : {}) };
    applyPanelSeedRaw(layerPanelSeed(state.layers, items[active]));
  } else {
    state.layers = null;
    applyPanelSeedRaw(seed);
  }
  renderLayersUI();
}
export function applyPanelSeedRaw(seed) {
  ctrl('sel-seed-type').value = seed.type; rt.lastShapeType = seed.type;
  if (seed.type === 'custom' && !ctrl('sel-seed-type').querySelector('option[value="custom"]')) {
    const opt = document.createElement('option');
    opt.value = 'custom'; opt.textContent = 'Custom (uploaded)';
    ctrl('sel-seed-type').appendChild(opt);
    ctrl('sel-seed-type').value = 'custom'; rt.lastShapeType = 'custom';
  }
  state.customSeed = seed.customSeed || null;
  ctrl('rg-base').value = seed.base; ctrl('v-base').textContent = seed.base;
  ctrl('rg-height').value = seed.height; ctrl('v-height').textContent = seed.height;
  if (seed.triApex != null) { const pos = Math.round((Math.max(-100, Math.min(100, seed.triApex)) + 100) / 2); ctrl('rg-tri-apex').value = pos; ctrl('v-tri-apex').textContent = pos; }
  else { ctrl('rg-tri-apex').value = 50; ctrl('v-tri-apex').textContent = 50; }
  ctrl('rg-thickness').value = seed.thickness; ctrl('v-thickness').textContent = seed.thickness;
  if (seed.arcCount != null) { ctrl('rg-arc-count').value = seed.arcCount; ctrl('v-arc-count').textContent = seed.arcCount; }
  if (seed.arcRatio != null) { const pct = Math.round(seed.arcRatio * 100); ctrl('rg-arc-ratio').value = pct; ctrl('v-arc-ratio').textContent = pct; }
  if (seed.wedgeAngle != null) { ctrl('rg-wedge-angle').value = seed.wedgeAngle; ctrl('v-wedge-angle').textContent = seed.wedgeAngle; }
  if (seed.wedgeInner != null) { ctrl('rg-wedge-inner').value = seed.wedgeInner; ctrl('v-wedge-inner').textContent = seed.wedgeInner; }
  if (seed.wedgeSquash != null) { ctrl('rg-wedge-squash').value = seed.wedgeSquash; ctrl('v-wedge-squash').textContent = seed.wedgeSquash; }
  [['wedgeRound', 'round', 0], ['wedgeRotate', 'rotate', 0], ['wedgeCurve', 'curve', 0], ['wedgeIrregular', 'irregular', 0], ['wedgeSeed', 'seed', 1]].forEach(([k, id, def]) => {
    const v = seed[k] != null ? seed[k] : def;
    ctrl('rg-wedge-' + id).value = v; ctrl('v-wedge-' + id).textContent = v;
  });
  ctrl('rg-poly-base').value = seed.polyBase != null ? seed.polyBase : -90;   // saved before Oct 10, 2026: first corner up, as it was drawn
  ctrl('rg-star-base').value = seed.starBase != null ? seed.starBase : -90;
  if (seed.polySides != null) { ctrl('rg-poly-sides').value = seed.polySides; ctrl('v-poly-sides').textContent = seed.polySides; }
  [['polyRotate', 'rotate', 0], ['polyStep', 'step', 1], ['polyCurve', 'curve', 0], ['polyOutline', 'outline', 0], ['polySkew', 'skew', 0]].forEach(([k, id, def]) => {
    const v = seed[k] != null ? seed[k] : def;
    ctrl('rg-poly-' + id).value = v; ctrl('v-poly-' + id).textContent = v;
  });
  ctrl('sel-poly-style').value = seed.polyStyle || 'round';
  if (seed.polyCorner != null) { ctrl('rg-poly-corner').value = seed.polyCorner; ctrl('v-poly-corner').textContent = seed.polyCorner; }
  if (seed.polyIrregular != null) { ctrl('rg-poly-irregular').value = seed.polyIrregular; ctrl('v-poly-irregular').textContent = seed.polyIrregular; }
  if (seed.polySeed != null) { ctrl('rg-poly-seed').value = seed.polySeed; ctrl('v-poly-seed').textContent = seed.polySeed; }
  if (seed.starPoints != null) { ctrl('rg-star-points').value = seed.starPoints; ctrl('v-star-points').textContent = seed.starPoints; }
  if (seed.starInner != null) { ctrl('rg-star-inner').value = seed.starInner; ctrl('v-star-inner').textContent = seed.starInner; }
  if (seed.starIrregular != null) { ctrl('rg-star-irregular').value = seed.starIrregular; ctrl('v-star-irregular').textContent = seed.starIrregular; }
  if (seed.starSeed != null) { ctrl('rg-star-seed').value = seed.starSeed; ctrl('v-star-seed').textContent = seed.starSeed; }
  if (seed.rrWidth != null) { ctrl('rg-rr-width').value = seed.rrWidth; ctrl('v-rr-width').textContent = seed.rrWidth; }
  if (seed.rrHeight != null) { ctrl('rg-rr-height').value = seed.rrHeight; ctrl('v-rr-height').textContent = seed.rrHeight; }
  if (seed.rrCorner != null) { ctrl('rg-rr-corner').value = seed.rrCorner; ctrl('v-rr-corner').textContent = seed.rrCorner; }
  if (seed.chevNotch != null) { ctrl('rg-chev-notch').value = seed.chevNotch; ctrl('v-chev-notch').textContent = seed.chevNotch; }
  if (seed.chevArm != null) { ctrl('rg-chev-arm').value = seed.chevArm; ctrl('v-chev-arm').textContent = seed.chevArm; }
  if (seed.chevSquash != null) { ctrl('rg-chev-squash').value = seed.chevSquash; ctrl('v-chev-squash').textContent = seed.chevSquash; }
  if (seed.crossArmWidth != null) { ctrl('rg-cross-armwidth').value = seed.crossArmWidth; ctrl('v-cross-armwidth').textContent = seed.crossArmWidth; }
  if (seed.crossArmLength != null) { ctrl('rg-cross-armlength').value = seed.crossArmLength; ctrl('v-cross-armlength').textContent = seed.crossArmLength; }
  if (seed.crossCorner != null) { ctrl('rg-cross-corner').value = seed.crossCorner; ctrl('v-cross-corner').textContent = seed.crossCorner; }
  if (seed.lensWidth != null) { ctrl('rg-lens-width').value = seed.lensWidth; ctrl('v-lens-width').textContent = seed.lensWidth; }
  // Newer Seed params — snapshots saved before they existed simply lack them
  // and fall back to each control's own default (identical to the old shape).
  ctrl('sel-arc-pivot').value = seed.arcPivot || 'corner';
  ctrl('sel-element-irrmode').value = seed.irrMode === 'outline' ? 'outline' : 'corners';
  ctrl('sel-inner-anchor').value = seed.innerAnchor || 'bbox'; delete ctrl('sel-inner-anchor').dataset.before;   // a loaded snapshot's anchor is its own
  [['innerCount', 'rg-inner-count', 'v-inner-count', 0], ['innerRatio', 'rg-inner-ratio', 'v-inner-ratio', 70], ['cutOut', 'rg-element-cutout', 'v-element-cutout', 0], ['irregular', 'rg-element-irregular', 'v-element-irregular', 0], ['irrWaves', 'rg-element-irrwaves', 'v-element-irrwaves', 6], ['irrSeed', 'rg-element-irrseed', 'v-element-irrseed', 1],
   ['triCorner', 'rg-tri-corner', 'v-tri-corner', 0], ['triCurve', 'rg-tri-curve', 'v-tri-curve', 0], ['triIrregular', 'rg-tri-irregular', 'v-tri-irregular', 0],
   ['triSeed', 'rg-tri-seed', 'v-tri-seed', 1], ['triOutline', 'rg-tri-outline', 'v-tri-outline', 0],
   ['truCore', 'rg-tru-core', 'v-tru-core', 0], ['truSpread', 'rg-tru-spread', 'v-tru-spread', 180], ['truReach', 'rg-tru-reach', 'v-tru-reach', 100], ['truRamp', 'rg-tru-ramp', 'v-tru-ramp', 0],
   ['truCurve', 'rg-tru-curve', 'v-tru-curve', 0], ['truRound', 'rg-tru-round', 'v-tru-round', 0], ['truSegs', 'rg-tru-segs', 'v-tru-segs', 1], ['truGap', 'rg-tru-gap', 'v-tru-gap', 20],
   ['arcSweep', 'rg-arc-sweep', 'v-arc-sweep', 90], ['arcStart', 'rg-arc-start', 'v-arc-start', 0], ['arcRound', 'rg-arc-round', 'v-arc-round', 0], ['arcSegs', 'rg-arc-segs', 'v-arc-segs', 1],
   ['arcGap', 'rg-arc-gap', 'v-arc-gap', 20], ['arcTaper', 'rg-arc-taper', 'v-arc-taper', 0], ['arcIrregular', 'rg-arc-irregular', 'v-arc-irregular', 0], ['arcSeed', 'rg-arc-seed', 'v-arc-seed', 1], ['polyRadius', 'rg-poly-radius', 'v-poly-radius', 100], ['starRadius', 'rg-star-radius', 'v-star-radius', 100],
   ['circleRadius', 'rg-circle-radius', 'v-circle-radius', 100], ['segLen', 'rg-seg-len', 'v-seg-len', 70], ['segWeight', 'rg-seg-weight', 'v-seg-weight', SEG_WEIGHT_DEF], ['dropRadius', 'rg-drop-radius', 'v-drop-radius', 60],
   ['dropTail', 'rg-drop-tail', 'v-drop-tail', 50], ['blobRadius', 'rg-blob-radius', 'v-blob-radius', 60], ['blobAmount', 'rg-blob-amount', 'v-blob-amount', 40],
   ['blobSeed', 'rg-blob-seed', 'v-blob-seed', 1]].forEach(([k, id, vid, def]) => {
    const v = seed[k] != null ? seed[k] : def;
    ctrl(id).value = v; ctrl(vid).textContent = v;
  });
  ctrl('ck-seg-round').checked = !!seed.segRound;
  ctrl('sel-circle-interior').value = seed.circleInterior || 'solid';
  ctrl('sel-circle-trim').value = seed.circleTrim || 'none';
  ctrl('sel-tru-fans').value = String(seed.truFans || 2);
  Object.values(SEED_EXTRAS).forEach(sh => sh.rows.forEach(r => {
    const el = ctrl(xrId(sh, r)), v = seed[r.key] != null ? seed[r.key] : r.def;
    el.value = v; const vv = ctrl('v-' + sh.prefix + '-' + r.id); if (vv) vv.textContent = v;
  }));
  hooks.syncPolyStepMax(); hooks.syncTriType(); hooks.syncArcType(); hooks.syncTruType(); hooks.syncWedgeType(); hooks.syncPolyType(); hooks.syncExtrasTypes();
  CIRCLE_PARAMS.forEach(([k, id, def]) => {
    const v = seed[cap(k)] != null ? seed[cap(k)] : def;
    ctrl('rg-circle-' + id).value = v; ctrl('v-circle-' + id).textContent = v;
  });
  syncDependentRows();
  if (seed.type === 'freehand') {
    state.freehand = { data: seed.freehandData || null, raw: seed.freehandRaw || '', seed: seed.customSeed || null };
    if (fhEditor) { if (state.freehand.data) fhEditor.load(state.freehand.data); else fhEditor.clear(); }
  }
  syncSeedUI();
}


// Style / Stroke W / Rounded / Width / Length show the active layer's own look.
export function showLayerStyle(l) {
  if (!l.look) l.look = readLookControls();
  const lk = l.look;
  ctrl('sel-element-fillmode').value = lk.fillMode;
  ctrl('rg-element-strokew').value = lk.strokeW; ctrl('v-element-strokew').textContent = lk.strokeW;
  ctrl('ck-element-rounded').checked = lk.rounded;
  ctrl('rg-element-w').value = lk.w; ctrl('v-element-w').textContent = lk.w;
  ctrl('rg-element-l').value = lk.l; ctrl('v-element-l').textContent = lk.l;
  syncLookBlocks();
}
export function layersChanged() { renderLayersUI(); renderGallery(); renderSeedPreview(); }
export function selectLayer(i) {
  if (!state.layers || i === state.layers.active || !state.layers.items[i]) return;
  syncActiveLayer();
  const from = state.layers.items[state.layers.active];
  state.layers.active = i;
  const to = state.layers.items[i];
  if (!(from.part && to.part)) applyPanelSeedRaw(layerPanelSeed(state.layers, to));   // part → part: the same source, the panel stays as it is
  showLayerStyle(to);
  layersChanged();
}
// What the Shape panel shows for a layer: its own shape, or for a part the shape the parts come from.
export const layerPanelSeed = (L, l) => (l.part && L.parts ? L.parts.source : l.seed);
export function addLayer() {
  if (!state.layers) state.layers = { items: [{ id: newLayerId(), role: 'fill', ink: 'cell', place: { mx: 0, my: 0, scale: 1, rotate: 0 }, seed: panelSeedSnapshot(), look: readLookControls() }], active: 0 };
  syncActiveLayer();
  const L = state.layers, base = layerPanelSeed(L, L.items[L.active]), baseLook = L.items[L.active].look;
  const seed = JSON.parse(JSON.stringify(base));
  seed.type = base.type === 'circle' ? 'triangle' : 'circle';
  const slot = L.items.length;
  // A new layer takes the current layer's look — except after a Segment, whose square caps are forced, not chosen.
  const look = { ...baseLook };
  if (base.type === 'segment' && L.items[L.active].roundedBeforeSegment != null) look.rounded = L.items[L.active].roundedBeforeSegment;
  L.items.push({ id: newLayerId(), role: 'fill', ink: slot, place: { mx: 0, my: 0, scale: NEW_LAYER_SCALE, rotate: 0 }, seed, look });
  // Above/below is only visible with different colours: make sure the Palette has one for this layer.
  if (state.colors.length <= slot && state.colors.length < PALETTE_MAX) {
    state.colors = state.colors.concat(hexKey(LAYER_NEW_INKS[(slot - 1) % LAYER_NEW_INKS.length]));
    buildPalette(); syncColorRuleUI();
  }
  L.active = L.items.length - 1;
  applyPanelSeedRaw(seed);
  showLayerStyle(L.items[L.active]);
  layersChanged();
}
export function removeLayer(i) {
  const L = state.layers;
  if (!L || !L.items[i] || L.items[i].part) return;   // a part is hidden, never deleted — Join parts / Ungroup end the division
  syncActiveLayer();
  L.items.splice(i, 1);
  if (L.items.length <= 1) {
    const only = L.items[0];
    state.layers = null;
    applyPanelSeedRaw(only.seed);
    showLayerStyle(only);   // back to one shape: its Style becomes the Element's
  } else {
    L.active = Math.min(L.active > i ? L.active - 1 : L.active, L.items.length - 1);
    applyPanelSeedRaw(layerPanelSeed(L, L.items[L.active]));
    showLayerStyle(L.items[L.active]);
  }
  layersChanged();
}
export function moveLayer(i, dir) {
  const L = state.layers, j = i + dir;
  if (!L || j < 0 || j >= L.items.length) return;
  syncActiveLayer();
  [L.items[i], L.items[j]] = [L.items[j], L.items[i]];
  if (L.active === i) L.active = j; else if (L.active === j) L.active = i;
  layersChanged();
}
// Layer-row pictograms — from the shared registry (Organica.icons).
export const LAYER_ICONS = {
  grip: Organica.icons.get('grip', { size: 'sm' }),
  eye: Organica.icons.get('eye', { size: 'sm' }),
  eyeOff: Organica.icons.get('eye-off', { size: 'sm' }),
  trash: Organica.icons.get('trash', { size: 'sm' }),
  // role pictograms: solid disc = Filled · disc keeping stripes inside = Subtraction mask · square with a disc hole = Mask
  fill: Organica.icons.get('role-fill', { size: 'sm' }),
  container: Organica.icons.get('role-container', { size: 'sm' }),
  mask: Organica.icons.get('role-mask', { size: 'sm' }),
  pattern: Organica.icons.get('role-pattern', { size: 'sm' }),
};
export function renderLayersUI() {
  const list = ctrl('layers-list'), L = state.layers, place = ctrl('layer-place-block');
  closeLayerInkPop();
  place.style.display = L ? '' : 'none';
  ctrl('layers-section').appendChild(place);   // park it before the list is rebuilt
  ctrl('layer-inks-row').style.display = L ? '' : 'none';   // the colour-variants toggle only means something for a stack
  ctrl('element-wide-label').style.display = L ? '' : 'none';   // Appearance Scale / Move are Element-wide: say so once there are layers
  // the per-layer look lives in the layer's card; with a single shape it is back in Appearance
  if (L) place.appendChild(ctrl('element-look-block')); else ctrl('element-wide-label').before(ctrl('element-look-block'));
  // The pattern settings sit right under Style (single shape) or above the Element-wide controls (layers)
  if (L) ctrl('element-wide-label').before(ctrl('element-pattern-block'));
  else ctrl('element-style-row').after(ctrl('element-pattern-block'));
  if (pv('sel-rule') === 'exhaustive') syncExhaustiveHint();
  ctrl('layers-hint').textContent = L ? L.items.length + ' · top first' : 'Add new layer';
  ctrl('seed-layer-hint').textContent = L ? 'editing ' + layerName(L.items[L.active]) : '';
  ctrl('split-layers-hint').style.display = L ? '' : 'none';   // Split takes the whole stack
  renderPartsUI();
  if (!L) { list.innerHTML = ''; return; }
  // Top layer first, like every layer panel. The parts of a divided shape sit in one group (a disclosure, open
  // while one of them is being edited or picked on the canvas).
  const partIdx = L.items.map((l, i) => (l.part ? i : -1)).filter(i => i >= 0);
  const topPart = partIdx.length ? Math.max(...partIdx) : -1, lowPart = partIdx.length ? Math.min(...partIdx) : -1;
  const src = L.parts && L.parts.source, srcIcon = src ? (SEED_ICONS[src.type] || SEED_ICONS.custom).icon : '';
  const groupOpen = (L.items[L.active] && L.items[L.active].part) || rt.partEdit;
  list.innerHTML = L.items.map((l, i) => i).reverse().map(i => {
    const l = L.items[i], on = i === L.active, role = l.role || 'fill', isFill = role === 'fill';
    const tint = isFill ? layerInkColor(l, colorAt(0)) : 'var(--mid)', cell = l.ink == null || l.ink === 'cell';
    const icon = l.part ? srcIcon : (SEED_ICONS[l.seed.type] || SEED_ICONS.custom).icon;
    const picked = l.part && rt.partSel && rt.partSel.has(l.id);
    const open = i === topPart ? `<details class="org-disclosure fvs-part-group" role="listitem"${groupOpen ? ' open' : ''}><summary class="org-disclosure__head">${Organica.icons.get('chevron-right', { size: 'xs', cls: 'org-chev' })}<span class="org-disclosure__label">${partGroupName(L)}</span></summary><div class="org-disclosure__body" role="list" aria-label="${partGroupName(L)}">` : '';
    const close = i === lowPart ? '</div></details>' : '';
    return open + `<div class="org-layer-card org-layer-card--flush is-draggable ${l.hidden ? 'is-off' : 'is-on'}${on ? ' active' : ''}${picked ? ' is-picked' : ''}" data-layer="${i}" role="listitem" tabindex="-1">
      <div class="org-layer-card__head" title="Drag to reorder · ⌥↑ / ⌥↓">
      <span class="org-layer-card__grip" aria-hidden="true">${LAYER_ICONS.grip}</span>
      <button type="button" class="fvs-layer__main" data-layer-act="select" aria-pressed="${on}" aria-label="Edit layer ${i + 1}: ${layerName(l)}"><span class="fvs-layer__icon" style="color:${tint}">${icon}</span><span class="org-layer-card__title">${layerName(l)}</span></button>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-layer-act="eye" aria-pressed="${!l.hidden}" aria-label="${l.hidden ? 'Show' : 'Hide'} layer" title="${l.hidden ? 'Hidden — click to show' : 'Hide this layer'}">${l.hidden ? LAYER_ICONS.eyeOff : LAYER_ICONS.eye}</button>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-layer-act="role" aria-label="Role: ${LAYER_ROLES[role]} — click to change" title="${LAYER_ROLES[role]} — ${role === 'fill' ? 'paints its own ink' : role === 'mask' ? 'cuts its shape out of the layers below' : role === 'pattern' ? 'cuts its pattern out of the layers below' : 'keeps the layers below only inside its shape'}. Click: ${LAYER_ROLES[LAYER_ROLE_ORDER[(LAYER_ROLE_ORDER.indexOf(role) + 1) % LAYER_ROLE_ORDER.length]]}">${LAYER_ICONS[role]}</button>
      <button type="button" class="fvs-layer__swatch${cell ? ' is-cell' : ''}" data-layer-act="ink" style="--sw:${isFill ? layerInkColor(l, colorAt(0)) : 'var(--border)'}" aria-label="Colour: ${cell ? 'follow cell colour' : 'Ink ' + (l.ink + 1)}" title="${isFill ? (cell ? 'Follows the cell colour' : 'Ink ' + (l.ink + 1)) + ' — click to change' : 'Mask layers have no colour'}"${isFill ? '' : ' disabled'}></button>
      ${l.part ? '' : `<button type="button" class="org-btn org-btn--sm org-btn--icon fvs-layer__del" data-layer-act="del" aria-label="Delete layer" title="Delete layer">${LAYER_ICONS.trash}</button>`}
      </div>
    </div>` + close;
  }).join('');
  const activeRow = list.querySelector(`.org-layer-card[data-layer="${L.active}"]`);
  if (activeRow) activeRow.appendChild(place);   // Move / Size / Rotate live under the layer they edit
  const pl = layerPlace(L.items[L.active]);
  [['mx', pl.mx], ['my', pl.my], ['scale', pl.scale], ['rotate', pl.rotate]].forEach(([k, v]) => { ctrl('rg-layer-' + k).value = v; ctrl('v-layer-' + k).textContent = v; });
}
export function toggleLayerHidden(i) { const l = state.layers.items[i]; if (l.hidden) delete l.hidden; else l.hidden = true; layersChanged(); }
export function cycleLayerRole(i) {
  const l = state.layers.items[i];
  l.role = LAYER_ROLE_ORDER[(LAYER_ROLE_ORDER.indexOf(l.role || 'fill') + 1) % LAYER_ROLE_ORDER.length];
  syncLookBlocks();
  layersChanged();
}
// Move a layer from stack index `from` to `to` (0 = bottom); the active layer stays the same object.
export function moveLayerTo(from, to) {
  const L = state.layers;
  if (!L || from === to || !L.items[from] || to < 0 || to >= L.items.length) return;
  syncActiveLayer();
  const activeItem = L.items[L.active];
  const [it] = L.items.splice(from, 1);
  L.items.splice(to, 0, it);
  L.active = L.items.indexOf(activeItem);
  layersChanged();
}
// One shared colour panel (built on open, positioned under the clicked swatch).
export let layerInkPopFor = null;
export function closeLayerInkPop() { const pop = ctrl('layer-ink-pop'); if (pop) pop.hidden = true; layerInkPopFor = null; }
export function openLayerInkPop(i, anchor) {
  const pop = ctrl('layer-ink-pop'), l = state.layers.items[i];
  if (layerInkPopFor === i && !pop.hidden) { closeLayerInkPop(); return; }
  const cur = l.ink == null ? 'cell' : l.ink;
  const many = l.part && rt.partSel && rt.partSel.size > 1 && rt.partSel.has(l.id) ? rt.partSel.size : 0;
  pop.setAttribute('aria-label', many ? `Colour for ${many} parts` : 'Layer colour');
  pop.innerHTML = (many ? `<p class="fvs-ink-pop__head">Colour for ${many} parts</p>` : '') + `<button type="button" class="is-cell" data-ink="cell" style="--sw:${colorAt(0)}" aria-pressed="${cur === 'cell'}" aria-label="Follow cell colour" title="Follow the cell colour"></button>`
    + state.colors.map((c, k) => `<button type="button" data-ink="${k}" style="--sw:${c}" aria-pressed="${cur === k}" aria-label="Ink ${k + 1}" title="Ink ${k + 1} · ${c}"></button>`).join('');
  const r = anchor.getBoundingClientRect();
  pop.hidden = false;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + 'px';
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > window.innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + 'px';
  layerInkPopFor = i;
  (pop.querySelector('[aria-pressed="true"]') || pop.querySelector('button')).focus();
}
ctrl('layer-ink-pop').addEventListener('click', e => {
  const b = e.target.closest('[data-ink]');
  if (!b || layerInkPopFor == null || !state.layers) return;
  const l = state.layers.items[layerInkPopFor], ink = b.dataset.ink === 'cell' ? 'cell' : +b.dataset.ink;
  l.ink = ink;
  // several parts picked on the canvas (⌘-click) and this one among them: they all take the ink
  if (l.part && rt.partSel && rt.partSel.has(l.id)) state.layers.items.forEach(x => { if (x.part && rt.partSel.has(x.id)) x.ink = ink; });
  const i = layerInkPopFor;
  closeLayerInkPop();
  layersChanged();
  const sw = ctrl('layers-list').querySelector(`.org-layer-card[data-layer="${i}"] [data-layer-act="ink"]`); if (sw) sw.focus();
});
document.addEventListener('click', e => { if (layerInkPopFor != null && !e.target.closest('#layer-ink-pop, [data-layer-act="ink"]')) closeLayerInkPop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && layerInkPopFor != null) closeLayerInkPop(); });
ctrl('panel').addEventListener('scroll', closeLayerInkPop, true);

ctrl('btn-layer-add').addEventListener('click', addLayer);
// Changing the Seed shape renames the active layer's row at once ("Star"),
// not only on the next layer switch.
ctrl('sel-seed-type').addEventListener('change', () => { if (state.layers) { syncActiveLayer(); renderLayersUI(); } });
ctrl('layers-list').addEventListener('click', e => {
  const b = e.target.closest('[data-layer-act]'), row = e.target.closest('[data-layer]');
  if (!row || !state.layers) return;
  const i = +row.dataset.layer, act = b ? b.dataset.layerAct : 'select';
  if (e.target.closest('#layer-place-block')) return;
  if (act === 'select') selectLayer(i);
  else if (act === 'eye') toggleLayerHidden(i);
  else if (act === 'role') cycleLayerRole(i);
  else if (act === 'ink') openLayerInkPop(i, b);
  else if (act === 'del') removeLayer(i);
});
// Keyboard: ⌥↑ / ⌥↓ on a row moves the layer up / down the stack.
ctrl('layers-list').addEventListener('keydown', e => {
  const row = e.target.closest('.org-layer-card');
  if (!row || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  const i = +row.dataset.layer, to = i + (e.key === 'ArrowUp' ? 1 : -1);
  moveLayerTo(i, to);
  const moved = ctrl('layers-list').querySelector(`.org-layer-card[data-layer="${Math.max(0, Math.min(state.layers.items.length - 1, to))}"] .fvs-layer__main`); if (moved) moved.focus();
});
// Drag to reorder — a pointer drag, not native HTML5 drag and drop: the native one
// would not start from the layer's name (a <button>) in Safari/Firefox, and
// behaved differently per browser. Press on a row's head, move 4px, drop on another
// row: its upper half = above it, lower half = below it.
export let layerDragFrom = null;
export const clearLayerDropMarks = () => ctrl('layers-list').querySelectorAll('.drop-before, .drop-after, .is-dragging').forEach(r => r.classList.remove('drop-before', 'drop-after', 'is-dragging'));
// Where a drop on `row` sends the dragged layer: the half of the row's head picks
// above/below; a drop that would leave it where it is (the lower half of the row
// just above it — with two layers, half of every row) takes the row's place instead.
export function layerDropTarget(e, row) {
  const t = +row.dataset.layer, from = layerDragFrom;
  const r = (row.querySelector('.org-layer-card__head') || row).getBoundingClientRect(), above = e.clientY < r.top + r.height / 2;
  // rows are listed top first: "above" a row = a higher stack index
  let to = above ? t + 1 : t;
  if (from < to) to--;
  if (to === from && t !== from) to = t;
  to = Math.max(0, Math.min(state.layers.items.length - 1, to));
  return { to, before: to > from || (to === from && above) };
}
export let layerPress = null;   // {from, x, y, id, moved}
export const layerRowAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest('#layers-list .org-layer-card'); };
ctrl('layers-list').addEventListener('pointerdown', e => {
  const head = e.button === 0 && e.target.closest('.org-layer-card__head');
  // the eye / role / ink / delete buttons keep their own click
  if (!head || !state.layers || e.target.closest('[data-layer-act]:not([data-layer-act="select"])')) return;
  layerPress = { from: +head.parentElement.dataset.layer, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
});
window.addEventListener('pointermove', e => {
  if (!layerPress || e.pointerId !== layerPress.id) return;
  if (!layerPress.moved) {
    if (Math.hypot(e.clientX - layerPress.x, e.clientY - layerPress.y) < 4) return;
    layerPress.moved = true;
    layerDragFrom = layerPress.from;
    const row = ctrl('layers-list').querySelector(`.org-layer-card[data-layer="${layerDragFrom}"]`);
    if (row) row.classList.add('is-dragging');
  }
  e.preventDefault();
  const sel = window.getSelection && window.getSelection(); if (sel && sel.rangeCount) sel.removeAllRanges();
  ctrl('layers-list').querySelectorAll('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));
  const row = layerRowAt(e);
  if (row && +row.dataset.layer !== layerDragFrom) row.classList.add(layerDropTarget(e, row).before ? 'drop-before' : 'drop-after');
});
window.addEventListener('pointerup', e => {
  if (!layerPress || e.pointerId !== layerPress.id) return;
  const press = layerPress; layerPress = null;
  if (!press.moved) return;   // a plain click — selects the layer as before
  const row = layerRowAt(e), from = layerDragFrom;
  const to = row && +row.dataset.layer !== from ? layerDropTarget(e, row).to : from;
  layerDragFrom = null; clearLayerDropMarks();
  // the click that follows this pointerup is the end of a drag, not a "select"
  // (it fires in the same task, so the swallow is gone by the next tick either way)
  const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, true), 0);
  moveLayerTo(from, to);
});
window.addEventListener('pointercancel', () => { layerPress = null; layerDragFrom = null; clearLayerDropMarks(); });
['mx', 'my', 'scale', 'rotate'].forEach(k => ctrl('rg-layer-' + k).addEventListener('input', e => {
  if (!state.layers) return;
  const l = state.layers.items[state.layers.active];
  l.place = { ...layerPlace(l), [k]: parseFloat(e.target.value) };
  delete l.segmentFullCanvas;   // placed by hand now — leaving Segment keeps it
  ctrl('v-layer-' + k).textContent = e.target.value;
  renderGallery(); renderSeedPreview();
}));
// ── Divide into parts (Oct 10, 2026) ──────────────────────────────────
// Element Edit (the pencil on the canvas): the Division menu — None first, each option drawn on the current shape —
// divides the shape at once into one layer per primordial figure, each with its own ink, role, place and look, all
// still driven by the shape's own controls. On the canvas: click a part to edit it, ⌘/Ctrl/Shift-click to pick several
// (the ink chosen for one of them goes to all). Back to None joins the shape; the parts' settings are kept for the session.
const partSource = () => (state.layers && state.layers.parts ? state.layers.parts.source : (state.layers ? null : panelSeedSnapshot()));
export function partGroupName(L) {
  const src = L.parts.source, m = partMethodsFor(src).find(x => x.id === L.parts.method);
  const n = L.items.filter(l => l.part).length;
  return `${(SEED_ICONS[src.type] || {}).name || (SEED_TYPES[src.type] || {}).label || src.type} · ${m ? m.label : L.parts.method} · ${n}`;
}
// The greyed options, said once: a reason several share is listed with all their names ("Rhombi, Centre square: …").
// Pieces greyed = a one-piece shape — too common to say.
function partReasonsHint(off) {
  const by = new Map();
  off.filter(x => x.id !== 'pieces').forEach(x => by.set(x.reason, (by.get(x.reason) || []).concat(x.label)));
  return [...by].map(([r, labels]) => `${labels.length > 3 ? 'Its own Divisions' : labels.join(', ')}: ${r.charAt(0).toLowerCase() + r.slice(1)}`).join(' · ');
}
function partChoice() {
  // The first renderLayersUI() runs while the module loads, before the shape extras' rows exist: no source yet.
  let src = null;
  try { src = partSource(); } catch (e) { src = null; }
  const L = state.layers, methods = src ? partMethodsFor(src) : [];
  const m = L && L.parts ? methods.find(x => x.id === L.parts.method) || null : null;
  const count = !m || !m.count ? 0 : Math.max(m.count[0], Math.min(m.count[1], L.parts.count || m.count[2]));
  return { L, src, methods, m, count };
}
// The Division menu's thumbnails: the current shape, divided each way, its parts in the Palette's inks (two at least).
const partThumbRegistry = { none: { name: 'None', thumb: () => partThumb(null) } };
function partThumb(method) {
  let src = null;
  try { src = partSource(); } catch (e) { return ''; }
  if (!src || !SEED_TYPES[src.type]) return '';
  const inks = state.colors.length > 1 ? state.colors : [state.colors[0], ...LAYER_NEW_INKS.slice(0, 5)];
  const m = method && partMethodsFor(src).find(x => x.id === method);
  const res = method ? partsOf({ source: src, method, count: m && m.count ? m.count[2] : 0 }) : null;
  const geos = res && !res.reason ? res.list.map(p => p.geo) : [SEED_TYPES[src.type].geometry(src)];
  const g0 = geos[0];
  if (!g0 || !g0.d) return '';
  const T = `translate(${(g0.normTx * g0.normScale).toFixed(3)},${(g0.normTy * g0.normScale).toFixed(3)}) scale(${g0.normScale.toFixed(4)})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 108 108"><rect x="-4" y="-4" width="108" height="108" fill="${state.paperColor}"/><g transform="${T}">`
    + geos.map((g, i) => `<path d="${g.d}"${g.fillRule ? ` fill-rule="${g.fillRule}"` : ''} fill="${method ? inks[i % inks.length] : inks[0]}"/>`).join('') + '</g></svg>';
}
export const partPicker = Organica.selectPicker(ctrl('sel-part-method'), ctrl('part-method-picker'), { registry: partThumbRegistry, ariaLabel: 'Division', size: 'preview' });
let partThumbKey = '';
export function renderPartsUI() {
  syncColorPartsRow();
  const { L, src, methods, m, count } = partChoice();
  const show = !!(rt.partEdit && src && (!L || L.parts));
  ctrl('parts-block').hidden = !show;
  if (!show) return;
  const divided = !!(L && L.parts);
  // the thumbnails follow the shape and the Palette: drop them when either changed
  const key = JSON.stringify([src, state.colors, state.paperColor]);
  if (key !== partThumbKey) { partThumbKey = key; partPicker.invalidate(); }
  methods.forEach(x => { if (!partThumbRegistry[x.id]) partThumbRegistry[x.id] = { name: x.label, thumb: () => partThumb(x.id) }; else partThumbRegistry[x.id].name = x.label; });
  const sel = ctrl('sel-part-method');
  sel.innerHTML = `<option value="none"${divided ? '' : ' selected'}>None</option>`
    + methods.map(x => `<option value="${x.id}"${x.reason ? ` disabled title="${x.reason}"` : ''}${m && x.id === m.id ? ' selected' : ''}>${x.label}</option>`).join('');
  partPicker.refresh();
  ctrl('part-count-row').style.display = m && m.count ? '' : 'none';
  if (m && m.count) {
    const rg = ctrl('rg-part-count');
    rg.min = m.count[0]; rg.max = m.count[1]; rg.value = count; ctrl('v-part-count').textContent = count;
  }
  const res = divided ? partsOf(L.parts) : null;
  ctrl('part-hint').textContent = res && res.reason ? res.reason + ' — the whole shape is drawn meanwhile.' : partReasonsHint(methods.filter(x => x.reason));
  ctrl('part-actions-row').style.display = divided ? '' : 'none';
  ctrl('element-edit-hint').textContent = divided ? 'Click a part to edit it · ⌘-click to add' : 'Choose a Division to divide the shape';
}
// The parts' settings of the last division of this kind of shape, by part key — back to None and then a Division
// again finds them; another shape type starts clean.
let partMemo = { type: null, byKey: {} };
function rememberParts(L) {
  if (partMemo.type !== L.parts.source.type) partMemo = { type: L.parts.source.type, byKey: {} };
  Object.assign(partMemo.byKey, L.parts.stash || {});
  L.items.forEach(l => { if (l.part) partMemo.byKey[l.part] = JSON.parse(JSON.stringify(l)); });
}
function divideNow(method, count) {
  const L = state.layers;
  if (L && L.parts) {   // another Division: re-divide in place (the layers follow by key, the gone ones are parked)
    syncActiveLayer();
    L.parts.method = method; L.parts.count = count;
    syncPartLayers(L);
    layersChanged();
    return;
  }
  if (L) return;
  const r = divideLayers(panelSeedSnapshot(), method, count, readLookControls());
  if (r.reason) { ctrl('part-hint').textContent = r.reason; return; }
  const memo = partMemo.type === r.layers.parts.source.type ? partMemo.byKey : {};
  r.layers.items = r.layers.items.map(l => (memo[l.part] ? { ...memo[l.part], partName: l.partName } : l));
  state.layers = r.layers;
  rt.partSel = new Set();
  showLayerStyle(state.layers.items[0]);
  layersChanged();
}
// None: back to the one shape — its settings are remembered for the next Division.
function joinParts() {
  const L = state.layers;
  if (!L || !L.parts) return;
  syncActiveLayer();
  rememberParts(L);
  const src = L.parts.source, first = L.items.find(l => l.part), at = L.items.findIndex(l => l.part);
  const look = first && first.look ? { ...first.look } : readLookControls();
  const rest = L.items.filter(l => !l.part);
  rt.partSel = new Set();
  if (!rest.length) {
    state.layers = null;
    applyPanelSeedRaw(src);
    showLayerStyle({ look });
  } else {
    rest.splice(Math.max(0, at), 0, { id: newLayerId(), role: 'fill', ink: 'cell', place: { mx: 0, my: 0, scale: 1, rotate: 0 }, seed: JSON.parse(JSON.stringify(src)), look });
    state.layers = { items: rest, active: Math.max(0, at) };
    applyPanelSeedRaw(src);
    showLayerStyle(state.layers.items[state.layers.active]);
  }
  layersChanged();
}
ctrl('sel-part-method').addEventListener('change', e => {
  const v = e.target.value;
  if (v === 'none') { joinParts(); return; }
  const m = partMethodsFor(partSource()).find(x => x.id === v);
  divideNow(v, m && m.count ? m.count[2] : 0);
});
ctrl('rg-part-count').addEventListener('input', e => {
  ctrl('v-part-count').textContent = e.target.value;
  if (state.layers && state.layers.parts) divideNow(state.layers.parts.method, +e.target.value);
});
// Part k takes ink k — the Palette grows (up to its maximum) so every part can differ.
ctrl('btn-part-inks').addEventListener('click', () => {
  const L = state.layers;
  if (!L || !L.parts) return;
  const parts = L.items.filter(l => l.part), want = Math.min(PALETTE_MAX, parts.length), had = state.colors.length;
  if (state.colors.length < want) {
    let k = 0;
    while (state.colors.length < want) state.colors = state.colors.concat(hexKey(LAYER_NEW_INKS[k++ % LAYER_NEW_INKS.length]));
    buildPalette(); syncColorRuleUI();
  }
  parts.forEach((l, k) => { l.ink = k % state.colors.length; });
  layersChanged();
  const added = state.colors.length - had;
  if (added > 0) ctrl('part-hint').textContent = `Palette: ${added} ink${added > 1 ? 's' : ''} added`;   // the Palette grew — say so
});
// Ungroup: every part becomes a plain layer with its own fixed outline (a Custom shape); the division ends, Edit too.
ctrl('btn-part-ungroup').addEventListener('click', () => {
  const L = state.layers;
  if (!L || !L.parts) return;
  syncActiveLayer();
  const res = partsOf(L.parts);
  if (res.reason) { ctrl('part-hint').textContent = res.reason; return; }
  L.items.forEach(l => {
    if (!l.part) return;
    const p = res.byKey[l.part];
    if (p) l.seed = { type: 'custom', customSeed: { ...p.geo } };
    delete l.part;   // partName stays: an ungrouped part keeps its name ("Tip 3")
  });
  L.items = L.items.filter(l => l.seed && l.seed.type !== 'part');
  delete L.parts;
  L.active = Math.min(L.active, L.items.length - 1);
  applyPanelSeedRaw(L.items[L.active].seed);
  setPartEdit(false);
  layersChanged();
});
// Element Edit: in from the pencil on the canvas, out with Back or Esc.
export function setPartEdit(on) {
  rt.partEdit = !!on;
  if (!on) rt.partSel = new Set();
  ctrl('element-edit-toolbar').hidden = !rt.partEdit;
}
export function enterElementEdit() { setPartEdit(true); layersChanged(); }
ctrl('btn-element-edit-exit').addEventListener('click', () => { setPartEdit(false); layersChanged(); });
// On the canvas: a click edits that part, ⌘/Ctrl/Shift-click adds it to (or takes it from) the picked set.
ctrl('element-frame').addEventListener('click', e => {
  if (!rt.partEdit || !state.layers || !state.layers.parts) return;
  const g = e.target.closest('[data-part]');
  const L = state.layers;
  if (!g) { if (rt.partSel.size) { rt.partSel = new Set(); layersChanged(); } return; }
  const id = g.getAttribute('data-part'), i = L.items.findIndex(l => l.id === id);
  if (i < 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    if (!rt.partSel.size) rt.partSel.add(L.items[L.active].id);
    if (rt.partSel.has(id) && rt.partSel.size > 1) rt.partSel.delete(id); else rt.partSel.add(id);
    if (i !== L.active && rt.partSel.has(id)) selectLayer(i); else layersChanged();
  } else {
    rt.partSel = new Set();
    if (i !== L.active) selectLayer(i); else layersChanged();
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !rt.partEdit || layerInkPopFor != null || (e.target.closest && e.target.closest('input, select, textarea, .presets'))) return;
  setPartEdit(false); layersChanged();
});
// A shape control moved on a divided Element: the parts follow (syncActiveLayer re-divides); new or gone
// parts change the rows, so the list is redrawn once the change has been drawn.
const afterShapeEdit = () => {
  if (live.partRowsDirty) { live.partRowsDirty = false; renderLayersUI(); }
  else if (rt.partEdit) renderPartsUI();   // the Division options, thumbnails and hint follow the shape
};
ctrl('panel').addEventListener('input', afterShapeEdit);
ctrl('panel').addEventListener('change', afterShapeEdit);

renderLayersUI();

export function restoreComponentElementState(snap) {
  applyElementSnapshot(snap.seed, snap.appearance);
  state.loomGrid = snap.loomGrid;
  ctrl('rg-grid-cols').value = snap.gridCols; ctrl('v-grid-cols').textContent = snap.gridCols;
  ctrl('rg-grid-rows').value = snap.gridRows; ctrl('v-grid-rows').textContent = snap.gridRows;
  ctrl('rg-cellsize').value = snap.cellSize; ctrl('v-cellsize').textContent = snap.cellSize;
  ctrl('rg-gap').value = snap.gap; ctrl('v-gap').textContent = snap.gap;
  syncComponentGridUI();
  syncRuleAvailability();

  state.components = snap.components;
  state.selectedId = snap.selectedId;
  state.selectionExplicit = snap.selectionExplicit;
  state.componentAutoGenerated = snap.componentAutoGenerated;
  state.componentAutoGenSignature = snap.componentAutoGenSignature;

  state.colors = snap.colors.map(hexKey);
  state.colorRule = { ...DEFAULT_COLOR_RULE, ...snap.colorRule };
  syncColorRuleUI();
  buildPalette();
  state.paperColor = hexKey(snap.paperColor);
  hooks.setPaperUI(snap.paperColor);

  state.componentRole = snap.componentRole;
  state.underlyingComponentName = snap.underlyingComponentName;
  ctrl('sel-component-role').value = state.componentRole;
  syncComponentRoleUI();

  renderGallery();
  renderSeedPreview();
}

export function applyLibraryEntryToUI(entry) {
  applyElementSnapshot(entry.seed, entry.appearance);

  setComponentGrid(entry.grid, { silent: true });
  if (entry.grid.kind !== 'loom') {
    ctrl('rg-cellsize').value = entry.grid.cellSize; ctrl('v-cellsize').textContent = entry.grid.cellSize;
    ctrl('rg-gap').value = entry.grid.gap; ctrl('v-gap').textContent = entry.grid.gap;
  }
  syncRuleAvailability();

  state.colors = entry.colors.map(hexKey);
  state.colorRule = { ...DEFAULT_COLOR_RULE, ...(entry.colorRule || {}) };
  syncColorRuleUI();
  buildPalette();
  state.paperColor = hexKey(entry.paperColor);
  hooks.setPaperUI(entry.paperColor);

  const comp = { id: `library-${Date.now()}`, ruleSource: entry.component.ruleSource, cells: entry.component.cells };
  state.components = [comp];
  state.selectedId = comp.id;
  state.selectionExplicit = true;
  state.componentAutoGenerated = false;

  // Old saved Components (pre-Role) have neither field — backfilled to
  // the pre-feature-equivalent no-op (Normal, no underlying component).
  state.componentRole = entry.role || 'normal';
  state.underlyingComponentName = entry.underlyingComponentName || null;
  state.componentBlend = entry.blend === 'multiply' ? 'multiply' : 'normal';
  ctrl('sel-component-blend').value = state.componentBlend;
  ctrl('sel-component-role').value = state.componentRole;
  syncComponentRoleUI();

  renderGallery();
  renderSeedPreview();
}

// Underlying-component picker only matters once a role actually reads it
// (Normal never does) — dead-control rule already applied elsewhere in
// this project (Symbols' Fit/Padding hidden for polygon grids, etc.).
export function syncComponentRoleUI() {
  const relevant = state.componentRole === 'container' || state.componentRole === 'mask';
  ctrl('underlying-component-block').style.display = relevant ? '' : 'none';
  ctrl('underlying-component-empty').style.display = state.underlyingComponentName ? 'none' : '';
  ctrl('underlying-component-set').style.display = state.underlyingComponentName ? 'flex' : 'none';
  if (state.underlyingComponentName) ctrl('underlying-component-name').textContent = state.underlyingComponentName;
}

export function removeUnderlyingComponent() {
  state.underlyingComponentName = null;
  syncComponentRoleUI();
  renderGallery();
}

export function openUnderlyingComponentPicker() {
  const all = LIBRARY.read();
  const names = libraryNames(all);
  ctrl('underlying-component-overlay-empty').style.display = names.length ? 'none' : '';
  const wrap = ctrl('underlying-component-overlay-tiles');
  wrap.innerHTML = '';
  for (const name of names) {
    const entry = all[name];
    const size = frameDims(entry.grid);
    const savedColorAt = entryInkAt(entry);
    const items = buildComponentItems({ cells: entry.component.cells }, entry.grid).map((it, j) => ({ ...it, color: savedColorAt(j) }));
    const svgStr = withEntryInks(entry.colors, () => buildComponentSVGWithPaper(items, entry.seed, size, entry.paperColor, entry.role, entry.underlyingComponentName, entry.blend));
    const btn = document.createElement('button');
    btn.className = 'fvs-library-item';
    const box = fitThumbBox(size.w, size.h, 76);
    btn.style.width = box.w + 'px'; btn.style.height = box.h + 'px';
    btn.title = name;
    btn.setAttribute('aria-label', 'Use ' + name + ' as underlying component');
    btn.innerHTML = svgStr;
    btn.addEventListener('click', () => {
      state.underlyingComponentName = name;
      syncComponentRoleUI();
      renderGallery();
      closeUnderlyingComponentPicker();
    });
    wrap.appendChild(btn);
  }
  ctrl('underlying-component-overlay').style.display = 'flex';
  Organica.autoLabelPanel(ctrl('underlying-component-overlay'));
}

export function closeUnderlyingComponentPicker() {
  ctrl('underlying-component-overlay').style.display = 'none';
}

export function renderLibrary() { hooks.renderLibraryRail(); }

// Renames a saved Component and repoints everything that names it: saved
// Symbols' cells, the live Symbol, Container/Mask references, the Grid pick.
export function renameLibraryEntry(oldName, newName) {
  const all = LIBRARY.read();
  if (!all[oldName]) return;
  if (all[newName]) return;   // the rail's rename dialog asks again on a clash
  all[newName] = all[oldName]; delete all[oldName];
  Object.values(all).forEach(e => { if (e.underlyingComponentName === oldName) e.underlyingComponentName = newName; });
  LIBRARY.write(all);
  const sym = SYMBOL_LIBRARY.read();
  Object.values(sym).forEach(e => (e.cells || []).forEach(c => { if (c.componentName === oldName) c.componentName = newName; }));
  SYMBOL_LIBRARY.write(sym);
  (state.symbolCells || []).forEach(c => { if (c.componentName === oldName) c.componentName = newName; });
  state.symbolPool.forEach(p => { if (p.name === oldName) p.name = newName; });   // the Symbol pool names it too
  if (state.underlyingComponentName === oldName) state.underlyingComponentName = newName;
  if (state.fvsGridComponentName === oldName) state.fvsGridComponentName = newName;
  renderLibrary(); hooks.renderSymbolLibrary();
  if (state.symbolGrid) hooks.renderSymbol();
}
