// Flexible Visual System · 12-shell — Shell — tier switch, zoom / pan, shortcuts, panel wiring, export by tier.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  DEFAULT_COLOR_RULE, live, pv, state, val
} from './engine/00-core.js';
import {
  BASE_GEOMETRY, SEED_TYPES, frameDims, shapeHasCorners
} from './engine/01-geometry.js';
import {
  CIRCLE_PARAMS, SEED_EXTRAS, getPanelSeed, getSeed, seedForSnapshot, xrId
} from './engine/02-seed-ui.js';
import {
  GALLERY_ZOOM_MAX, getGrid
} from './engine/03-rules.js';
import {
  DEFAULT_APPEARANCE, PATTERN_DEFAULTS, getElementAppearance, withAppearance
} from './engine/04-appearance.js';
import {
  elementPathMarkup, layerPlace
} from './engine/05-render-component.js';
import {
  LIBRARY, PAPER_NONE, hexKey, isPaperNone, libraryNames, readLookControls, snapshotComponentElementState
} from './engine/07-library.js';
import {
  snapPose
} from './engine/08-symbol-grid.js';
import {
  elementPool
} from './engine/10-suggest.js';
import {
  ARC_PRESETS, FVS_EXTRAS_LABELS, FVS_RETIRED_EXTRAS, FVS_SEED_ORDER, NEW_LAYER_SCALE, OUTLINE_ICONS,
  POLY_PRESETS, STEP_EXPORT_HINTS, TRI_PRESETS, TRU_IDS, TRU_NEUTRAL, TRU_PRESETS, WEDGE_PRESETS,
  fvsGalleryLive, fvsSurfaceLive, readShapeLook, truState
} from './engine/12-shell.js';
import {
  buildPalette, ctrl, syncColorRuleUI, syncQuadrantHint
} from './00-core.js';
import {
  setCellShape
} from './01-geometry.js';
import {
  fhEditor, handleSeedUpload, syncCircleRows, syncCopiesRows, syncDependentRows, syncFreehandEditor
} from './02-seed-ui.js';
import {
  setGalleryThumbVars, syncComponentGridUI
} from './03-rules.js';
import {
  showPatternControls, syncGroundBlock, syncGroundInkOptions, syncGroundTileNote, syncLookBlocks
} from './04-appearance.js';
import {
  exportElement, renderGallery, renderSeedPreview, setElementView
} from './05-render-component.js';
import {
  clearGallery, exitComponentEditMode, exportSelected, generate, generateColourways,
  populateComponentStarterGallery, renderComponentEditCanvas, savePieceAsSeed, splitElementReset,
  syncExhaustiveHint, syncRuleAvailability, syncRuleAxisNote, syncRuleUI, syncSeedUI, toggleSplitQuadrant
} from './06-component-ui.js';
import {
  renderLayersUI, renderLibrary, restoreComponentElementState
} from './07-library.js';
import {
  buildEmptySymbolGrid, buildFitAllAnchorGrid, exportFvsGrid, handleSymbolGridUpload, syncFitAnchorUI
} from './08-symbol-grid.js';
import {
  generateSymbolCells, renderSymbolPool, setSugDockOpen, sugDockIsOpen
} from './10-suggest.js';
import {
  applySymbolRule, applyToSelection, bindSymbolCanvasSelection, bindSymbolTrackDrag,
  closeCellContentOverlay, exportSymbol, openCellContentOverlay, openCellContentOverlayForAll,
  SYMBOL_CELLS, bindCellProps, renderCellPropertiesPanel, renderSymbol, renderSymbolCanvasOnly, renderSymbolLibrary,
  renderTrackLabelsOverlay, syncContentFilter, syncManualBlock, syncSymbolRuleUI
} from './11-symbol-ui.js';
import { hooks, provide } from './hooks.js';
import { isFigureLoaded, loadFigureTier } from './lazy.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  fireChange: () => fireChange, onAppearanceChange: () => onAppearanceChange,
  paperSwatch: () => paperSwatch, setPaperUI: () => setPaperUI, syncArcType: () => syncArcType,
  syncExtrasTypes: () => syncExtrasTypes, syncFvsZoomHud: () => syncFvsZoomHud,
  syncIrregularRows: () => syncIrregularRows, syncPolyStepMax: () => syncPolyStepMax,
  syncPolyType: () => syncPolyType, syncSymbolViewUI: () => syncSymbolViewUI,
  syncTriType: () => syncTriType, syncTruType: () => syncTruType, syncWedgeType: () => syncWedgeType
});
export function updateStepHint(tier) {
  let msg = '';
  if (tier === 'symbol' && libraryNames(LIBRARY.read()).length === 0 && !elementPool().length) {
    msg = 'Nothing saved yet — a Symbol is built from saved Components or Elements: save some first.';
  }
  const h = ctrl('stepnav-hint'); h.textContent = msg; h.hidden = !msg;   // inside the Symbol view (the top strip is gone, Oct 9, 2026)
}
// The steps live in the left dock (Diego, Oct 9, 2026): one group + its separator, at the top of whichever dock bar is
// showing — the Library rail (Element / Component / Symbol, and Compose) or the node bar (Figure). Idempotent; call it
// whenever a dock is shown, hidden or its bar is rebuilt (17-figure-graph.js does, on Compose and on its bar renders).
const STEP_ICONS = { element: 'node-element', component: 'node-component', symbol: 'fvs-symbol', figure: 'fvs-figure' };
let stepGroup = null, stepSep = null;   // held here: a bar rebuilt with innerHTML detaches them, and an id lookup would miss
export function placeStepNav() {
  const group = stepGroup || (stepGroup = ctrl('tier-tabs')), sep = stepSep || (stepSep = ctrl('tier-tabs-sep'));
  const nodebarShown = !ctrl('fg-nodebar-dock').hidden, host = ctrl(nodebarShown ? 'fg-nodebar' : 'fvs-rail');
  if (group.parentElement !== host || host.firstElementChild !== group) host.prepend(group, sep);
}

// The floatbar Export on the Figure graph is not a menu: it shows the Export node (17-figure-graph.js) — no chevron,
// no popup state, its own name. Every other step (and Compose) gets the menu back.
export function syncExportButton() {
  const b = ctrl('btn-export'), graph = state.activeTier === 'figure' && !document.body.classList.contains('fg-composing');
  b.classList.toggle('is-graph-export', graph);
  b.setAttribute('aria-label', graph ? 'Export — show the Export node' : 'Export');
  if (graph) { b.removeAttribute('aria-expanded'); b.removeAttribute('aria-haspopup'); } else { if (!b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-haspopup', 'dialog'); }
}
export function setTier(tier) {
  // Navigating away mid-edit abandons it (no auto-save) — otherwise
  // #component-edit-view and the disabled Grid/Rule controls would stay
  // stuck in their edit-mode state the next time Component tier is shown.
  if (state.componentEditMode && tier !== 'component') exitComponentEditMode();
  if (tier !== 'symbol' && sugDockIsOpen()) setSugDockOpen(false);   // the variations strip floats above the bar: Symbol only
  const prevTier = state.activeTier;
  // See snapshotComponentElementState()/restoreComponentElementState() —
  // Figure is a sandbox; entering it captures how Element/Component looked,
  // leaving it back to either of those tiers puts it back exactly as it was,
  // regardless of what recipes were previewed while inside Figure. A visit
  // that never leaves Figure (or leaves via Symbol) keeps the ONE pending
  // snapshot from the first entry, so the original pre-exploration state
  // survives any number of Figure↔Symbol hops in between.
  if (tier === 'figure' && prevTier !== 'figure' && !state.preFigureSnapshot) {
    state.preFigureSnapshot = snapshotComponentElementState();
  } else if (prevTier === 'figure' && (tier === 'component' || tier === 'element') && state.preFigureSnapshot) {
    restoreComponentElementState(state.preFigureSnapshot);
    state.preFigureSnapshot = null;
  }
  state.activeTier = tier;
  (stepGroup || (stepGroup = ctrl('tier-tabs'))).querySelectorAll('[data-tier]').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.tier === tier)));
  document.querySelectorAll('.tier-block').forEach(b => b.classList.toggle('active', b.dataset.tier === tier));
  document.querySelectorAll('#canvas-wrap .tier-view').forEach(v => v.classList.toggle('active', v.dataset.tier === tier));
  ctrl('export-hint').textContent = STEP_EXPORT_HINTS[tier] || STEP_EXPORT_HINTS.component;
  // Reset / Upload only act on the Element's Shape.
  ctrl('fb-cell-shape').style.display = tier === 'element' || tier === 'component' ? '' : 'none';
  ctrl('fb-element-actions').style.display = tier === 'element' ? '' : 'none';
  ctrl('fb-component-actions').style.display = tier === 'component' ? '' : 'none';
  ctrl('fb-symbol-actions').style.display = tier === 'symbol' ? '' : 'none';
  ctrl('fb-figure-actions').style.display = tier === 'figure' && !document.body.classList.contains('fg-composing') ? '' : 'none';
  ctrl('fb-compose-actions').style.display = tier === 'figure' && document.body.classList.contains('fg-composing') ? '' : 'none';
  ctrl('fg-nodebar-dock').hidden = tier !== 'figure';   // the left dock: Library rail on the other steps, the node bar here
  hooks.syncRailTier(tier);
  placeStepNav();
  syncExportButton();
  syncQuadrantHint();
  hooks.closeLibview();
  if (tier === 'symbol') {
    // A first visit starts the pool with every saved Component (up to the 8-slot cap),
    // most recently saved first — so a fresh Symbol is built from the full saved set, not a subset.
    if (!state.symbolPool.length) {
      const lib = LIBRARY.read();
      state.symbolPool = libraryNames(lib).sort((a, b) => String(lib[b].savedAt || '').localeCompare(String(lib[a].savedAt || ''))).slice(0, 8).map(name => ({ name, weight: 1 }));
    }
    renderSymbolPool(); renderSymbol(); renderSymbolLibrary();
    if (!state.symbolGrid) buildEmptySymbolGrid();
  }
  else if (tier === 'element') { renderSeedPreview(); }
  else if (tier === 'figure') {   // Figure loads on demand (lazy.js): the first visit renders once it has arrived
    if (isFigureLoaded()) hooks.renderFigureTier();
    else loadFigureTier().then(() => { if (state.activeTier === 'figure') hooks.renderFigureTier(); });
  }
  else if (tier === 'component') {
    if (state.components.length === 0 && state.componentAutoGenerated !== false) populateComponentStarterGallery();
    else renderGallery();
  }
  else { renderGallery(); }
  syncFreehandEditor();
  updateStepHint(tier);
  syncFvsZoomHud();
}

// ── Zoom: mouse wheel / ⌘+ ⌘− ⌘0 — only in Symbol and Component (Diego:
// not in Element; Figure has none either).
//   · Symbol, Component Edit: the suite's Organica.createZoomPan, one instance
//     each, live only while that step/mode shows. FVS's own clicks and drags stay
//     theirs: a pan starts only with Space / ⌥ held or the middle button
//     (`panStart`). Double-click / ⌘0 / "reset" = 100%.
//   · Component gallery: zoom = thumbnail size (galleryZoom → the --thumb-w/h
//     vars), so the grid reflows and still scrolls with its scrollbar.
// Keyboard shortcuts — list-only (each is handled by its own listener below); `?` shows them.
[['⌘Z', 'Undo (Component, Figure, Freehand)', 'Edit'], ['⌘⇧Z', 'Redo (Figure)', 'Edit'],
 ['Space (hold)', 'Pan a zoomed view', 'View'], ['⌘ + / − / 0', 'Gallery zoom in / out / reset', 'View'],
 ['Space', 'Figure: shuffle', 'Figure'], ['V', 'Figure: variations', 'Figure'], ['[ / ]', 'Figure: nudge size', 'Figure'],
 ['1–6', 'Figure: pick a paint tool', 'Figure'], ['R / m / M', 'Figure: rotate / mirror V / mirror H the handle target', 'Figure'],
 ['Delete / ⌫', 'Symbol: empty the selected cells', 'Edit'],
 ['Esc', 'Close gallery / overlay', 'General']
].forEach(([keys, label, group]) => Organica.shortcuts.add({ keys, label, group }));
export var fvsPanKey = false;
// Delete / Backspace on selected Symbol cells = the Choose-content → Empty tile (the cell goes blank).
document.addEventListener('keydown', e => {
  if ((e.key !== 'Delete' && e.key !== 'Backspace') || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if (state.activeTier !== 'symbol' || !state.symbolSelection.size) return;
  if (fvsIsTypingTarget(e.target) || (e.target.closest && e.target.closest('.org-modal, #symbol-content-overlay'))) return;
  e.preventDefault();   // Backspace must not navigate back
  applyToSelection(cell => (cell.locked ? {} : { source: 'empty', rotation: 0, flipH: false, flipV: false, fitMode: live.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0 }));
  renderCellPropertiesPanel();
});
export var fvsIsTypingTarget = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && fvsZoomActive() && !fvsIsTypingTarget(e.target)) {
    if (!fvsPanKey) { fvsPanKey = true; document.body.classList.add('fvs-pan-key'); }
    if (fvsZoomActive() && fvsZoomActive().zoom > 1.001) e.preventDefault();   // no page scroll while panning
  }
  if (e.key === 'Alt') document.body.classList.add('fvs-pan-key');
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space') { fvsPanKey = false; }
  if (!fvsPanKey && !e.altKey) document.body.classList.remove('fvs-pan-key');
});
window.addEventListener('blur', () => { fvsPanKey = false; document.body.classList.remove('fvs-pan-key'); });
export var FVS_ZOOM_SURFACES = [
  { tier: 'component', canvas: 'component-edit-frame', wrap: 'component-edit-view', ready: () => !!state.componentEditMode },
  { tier: 'symbol', canvas: 'symbol-frame' },
];
export var fvsZoom = {};
export function fvsZoomActive() { if (!FVS_ZOOM_SURFACES) return null; const sf = FVS_ZOOM_SURFACES.find(fvsSurfaceLive); return sf ? fvsZoom[sf.tier] : null; }
export function galleryZoomTo(z) {
  rt.galleryZoom = Math.min(GALLERY_ZOOM_MAX, Math.max(1, z));
  setGalleryThumbVars(frameDims(getGrid()));
  syncFvsZoomHud();
}
export function syncFvsZoomHud() {
  if (!FVS_ZOOM_SURFACES) return;   // startup: setTier can run before this block
  const zp = fvsZoomActive();
  const z = zp ? zp.zoom : fvsGalleryLive() ? rt.galleryZoom : 1;
  ctrl('zoom-level').textContent = Math.round(z * 100) + '%';
  ctrl('zoom-hud').classList.toggle('visible', z > 1.001);
}
FVS_ZOOM_SURFACES.forEach(sf => {
  const canvas = ctrl(sf.canvas);
  canvas.classList.add('fvs-zoomable');
  fvsZoom[sf.tier] = Organica.createZoomPan({
    canvas,
    wrap: sf.wrap ? ctrl(sf.wrap) : document.querySelector(`#canvas-wrap .tier-view[data-tier="${sf.tier}"]`),
    isReady: () => fvsSurfaceLive(sf),
    panStart: e => e.button === 1 || (e.button === 0 && (e.altKey || fvsPanKey)),
    onChange(st) { canvas.classList.toggle('zoomed', st.zoomed); if (fvsSurfaceLive(sf)) syncFvsZoomHud(); },
  });
});
ctrl('zoom-reset').addEventListener('click', () => { const zp = fvsZoomActive(); if (zp) zp.reset(); else if (fvsGalleryLive()) galleryZoomTo(1); });
document.querySelector('#canvas-wrap .tier-view[data-tier="component"]').addEventListener('wheel', e => {
  if (!fvsGalleryLive() || e.target.closest('#component-edit-view')) return;
  e.preventDefault();
  galleryZoomTo(rt.galleryZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
}, { passive: false });
window.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || !fvsGalleryLive()) return;
  if (e.key === '+' || e.key === '=') { e.preventDefault(); galleryZoomTo(rt.galleryZoom * 1.2); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); galleryZoomTo(rt.galleryZoom / 1.2); }
  else if (e.key === '0') { e.preventDefault(); galleryZoomTo(1); }
});

export function syncTriType() {
  const cur = [val('rg-base'), val('rg-height'), val('rg-tri-apex')];
  const hit = Object.keys(TRI_PRESETS).find(k => TRI_PRESETS[k].every((v, i) => v === cur[i]));
  ctrl('sel-tri-type').value = hit || 'custom';
}
ctrl('sel-tri-type').addEventListener('change', e => {
  const p = TRI_PRESETS[e.target.value];
  if (!p) return;
  [['rg-base', 'v-base'], ['rg-height', 'v-height'], ['rg-tri-apex', 'v-tri-apex']].forEach(([id, vid], i) => { ctrl(id).value = p[i]; ctrl(vid).textContent = p[i]; });
  renderGallery(); renderSeedPreview();
});
ctrl('rg-base').addEventListener('input', e => { ctrl('v-base').textContent = e.target.value; syncTriType(); renderGallery(); renderSeedPreview(); });
ctrl('rg-height').addEventListener('input', e => { ctrl('v-height').textContent = e.target.value; syncTriType(); renderGallery(); renderSeedPreview(); });
ctrl('rg-tri-apex').addEventListener('input', e => { ctrl('v-tri-apex').textContent = e.target.value; syncTriType(); renderGallery(); renderSeedPreview(); });
export function syncTruType() {
  const cur = truState();
  const hit = Object.keys(TRU_PRESETS).find(k => { const t = { ...TRU_NEUTRAL, ...TRU_PRESETS[k] }; return Object.keys(t).every(f => t[f] === cur[f]); });
  ctrl('sel-tru-type').value = hit || 'custom';
}
ctrl('sel-tru-type').addEventListener('change', e => {
  const pr = TRU_PRESETS[e.target.value];
  if (!pr) return;
  const t = { ...TRU_NEUTRAL, ...pr };
  ctrl('sel-tru-fans').value = String(t.fans);
  Object.keys(TRU_IDS).forEach(k => { const el = ctrl(TRU_IDS[k]); el.value = t[k]; const v = ctrl('v-' + TRU_IDS[k].slice(3)); if (v) v.textContent = t[k]; });
  renderGallery(); renderSeedPreview();
});
ctrl('sel-tru-fans').addEventListener('change', () => { syncTruType(); renderGallery(); renderSeedPreview(); });
Object.values(TRU_IDS).concat(['rg-tru-gap']).forEach(id => ctrl(id).addEventListener('input', syncTruType));
export function syncArcType() {
  const cur = val('rg-arc-sweep');
  ctrl('sel-arc-type').value = Object.keys(ARC_PRESETS).find(k => ARC_PRESETS[k] === cur) || 'custom';
}
ctrl('sel-arc-type').addEventListener('change', e => {
  const sw = ARC_PRESETS[e.target.value];
  if (sw == null) return;
  ctrl('rg-arc-sweep').value = sw; ctrl('v-arc-sweep').textContent = sw;
  renderGallery(); renderSeedPreview();
});
ctrl('rg-arc-sweep').addEventListener('input', syncArcType);
ctrl('rg-thickness').addEventListener('input', e => { ctrl('v-thickness').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-arc-count').addEventListener('input', e => { ctrl('v-arc-count').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-arc-ratio').addEventListener('input', e => { ctrl('v-arc-ratio').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
export function syncWedgeType() {
  const cur = [val('rg-wedge-angle'), val('rg-wedge-inner')];
  ctrl('sel-wedge-type').value = Object.keys(WEDGE_PRESETS).find(k => WEDGE_PRESETS[k].every((v, i) => v === cur[i])) || 'custom';
}
ctrl('sel-wedge-type').addEventListener('change', e => {
  const p = WEDGE_PRESETS[e.target.value];
  if (!p) return;
  [['rg-wedge-angle', 'v-wedge-angle'], ['rg-wedge-inner', 'v-wedge-inner']].forEach(([id, vid], i) => { ctrl(id).value = p[i]; ctrl(vid).textContent = p[i]; });
  renderGallery(); renderSeedPreview();
});
[['rg-wedge-round', 'v-wedge-round'], ['rg-wedge-rotate', 'v-wedge-rotate'], ['rg-wedge-curve', 'v-wedge-curve'], ['rg-wedge-irregular', 'v-wedge-irregular'], ['rg-wedge-seed', 'v-wedge-seed']].forEach(([id, vid]) => {
  ctrl(id).addEventListener('input', e => { ctrl(vid).textContent = e.target.value; renderGallery(); renderSeedPreview(); });
});
ctrl('rg-wedge-angle').addEventListener('input', e => { ctrl('v-wedge-angle').textContent = e.target.value; syncWedgeType(); renderGallery(); renderSeedPreview(); });
ctrl('rg-wedge-inner').addEventListener('input', e => { ctrl('v-wedge-inner').textContent = e.target.value; syncWedgeType(); renderGallery(); renderSeedPreview(); });
ctrl('rg-wedge-squash').addEventListener('input', e => { ctrl('v-wedge-squash').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
// Build the extras rows into each shape's block, then wire them (label readout,
// derived Type shortcut, re-render). Called once at boot, before the first render.
export function buildSeedExtras() {
  Object.entries(SEED_EXTRAS).forEach(([shape, sh]) => {
    const block = ctrl('seed-' + shape + '-block');
    sh.rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'ctrl-row';
      const [label, title] = FVS_EXTRAS_LABELS[r.key] || [r.label, r.title];
      const lab = document.createElement('div'); lab.className = 'ctrl-label'; lab.textContent = label; if (title || r.title) lab.title = title || r.title; row.appendChild(lab);
      if (r.kind === 'select') {
        const sel = document.createElement('select'); sel.className = 'panel-select'; sel.id = xrId(sh, r); sel.setAttribute('aria-label', sh.prefix + ' ' + label);
        r.options.forEach(([v, t]) => { const o = new Option(t, v); if (v === r.def) o.defaultSelected = true; sel.appendChild(o); });
        sel.value = r.def; row.appendChild(sel);
      } else {
        const inp = document.createElement('input'); inp.type = 'range'; inp.id = xrId(sh, r); inp.min = r.min; inp.max = r.max; inp.step = 1; inp.setAttribute('value', r.def); inp.value = r.def; row.appendChild(inp);
        const out = document.createElement('span'); out.className = 'ctrl-val'; out.id = 'v-' + sh.prefix + '-' + r.id; out.textContent = r.def; row.appendChild(out);
      }
      (FVS_RETIRED_EXTRAS.has(r.key) ? ctrl('seed-legacy') : block).appendChild(row);
    });
    if (sh.type) {
      const row = document.createElement('div'); row.className = 'ctrl-row';
      const lab = document.createElement('div'); lab.className = 'ctrl-label'; lab.textContent = 'Type'; lab.title = sh.type.title; row.appendChild(lab);
      const sel = document.createElement('select'); sel.className = 'panel-select'; sel.id = 'sel-' + sh.prefix + '-type'; sel.setAttribute('aria-label', sh.type.label);
      Object.entries(sh.type.presets).forEach(([k, [t]], i) => { const o = new Option(t, k); if (i === 0) o.defaultSelected = true; sel.appendChild(o); });
      sel.appendChild(new Option('Custom', 'custom')); sel.value = Object.keys(sh.type.presets)[0]; row.appendChild(sel);
      block.insertBefore(row, block.firstChild);
      sel.addEventListener('change', () => {
        const p = sh.type.presets[sel.value]; if (!p) return;
        Object.entries(p[1]).forEach(([id, v]) => { ctrl(id).value = v; const vv = ctrl(id.replace(/^rg-/, 'v-')); if (vv) vv.textContent = v; });
        renderGallery(); renderSeedPreview();
      });
      [...new Set(Object.values(sh.type.presets).flatMap(p => Object.keys(p[1])))].forEach(id => ctrl(id).addEventListener('input', () => syncExtrasType(sh)));   // every key any preset sets, not just the first preset's
    }
    sh.rows.forEach(r => {
      const el = ctrl(xrId(sh, r));
      el.addEventListener(r.kind === 'select' ? 'change' : 'input', e => {
        if (r.kind !== 'select') ctrl('v-' + sh.prefix + '-' + r.id).textContent = e.target.value;
        if (sh.type) syncExtrasType(sh);
        renderGallery(); renderSeedPreview();
      });
    });
  });
  Object.entries(FVS_SEED_ORDER).forEach(([shape, ids]) => {
    const block = ctrl('seed-' + shape + '-block');
    ids.forEach(id => block.appendChild(ctrl(id).closest('.ctrl-row')));
  });
}
export function syncExtrasType(sh) {
  const sel = ctrl('sel-' + sh.prefix + '-type'); if (!sel) return;
  const hit = Object.keys(sh.type.presets).find(k => Object.entries(sh.type.presets[k][1]).every(([id, v]) => val(id) === v));
  sel.value = hit || 'custom';
}
export function syncExtrasTypes() { Object.values(SEED_EXTRAS).forEach(sh => { if (sh.type) syncExtrasType(sh); }); }
buildSeedExtras();
// Any edit in the Seed panel may reveal / hide a dependent row (SEED_DEPENDS).
['input', 'change'].forEach(ev => ctrl('sel-seed-type').closest('.panel-section').addEventListener(ev, syncDependentRows));
['rg-inner-count', 'rg-inner-ratio', 'sel-inner-anchor'].forEach(id => ['input', 'change'].forEach(ev => ctrl(id).addEventListener(ev, syncCopiesRows)));   // on the inputs: they travel into a layer's card with the look block

export function syncPolyType() {
  const cur = [val('rg-poly-sides')];
  ctrl('sel-poly-type').value = Object.keys(POLY_PRESETS).find(k => POLY_PRESETS[k].every((v, i) => v === cur[i])) || 'custom';
}
export function syncPolyStepMax() {
  const max = Math.max(1, Math.floor((val('rg-poly-sides') - 1) / 2)), el = ctrl('rg-poly-step');
  el.max = max;
  if (+el.value > max) { el.value = max; ctrl('v-poly-step').textContent = max; }
}
ctrl('sel-poly-type').addEventListener('change', e => {
  const p = POLY_PRESETS[e.target.value];
  if (!p) return;
  [['rg-poly-sides', 'v-poly-sides']].forEach(([id, vid], i) => { ctrl(id).value = p[i]; ctrl(vid).textContent = p[i]; });
  syncPolyStepMax(); renderGallery(); renderSeedPreview();
});
ctrl('sel-poly-style').addEventListener('change', () => { renderGallery(); renderSeedPreview(); });
[['rg-poly-step', 'v-poly-step'], ['rg-poly-curve', 'v-poly-curve'], ['rg-poly-outline', 'v-poly-outline'], ['rg-poly-rotate', 'v-poly-rotate'], ['rg-poly-skew', 'v-poly-skew']].forEach(([id, vid]) => {
  ctrl(id).addEventListener('input', e => { ctrl(vid).textContent = e.target.value; if (id === 'rg-poly-rotate') syncPolyType(); renderGallery(); renderSeedPreview(); });
});
ctrl('rg-poly-sides').addEventListener('input', e => { ctrl('v-poly-sides').textContent = e.target.value; syncPolyStepMax(); syncPolyType(); renderGallery(); renderSeedPreview(); });
ctrl('rg-poly-corner').addEventListener('input', e => { ctrl('v-poly-corner').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-poly-irregular').addEventListener('input', e => { ctrl('v-poly-irregular').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-poly-seed').addEventListener('input', e => { ctrl('v-poly-seed').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-star-points').addEventListener('input', e => { ctrl('v-star-points').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-star-inner').addEventListener('input', e => { ctrl('v-star-inner').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-star-irregular').addEventListener('input', e => { ctrl('v-star-irregular').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-star-seed').addEventListener('input', e => { ctrl('v-star-seed').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-rr-width').addEventListener('input', e => { ctrl('v-rr-width').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-rr-height').addEventListener('input', e => { ctrl('v-rr-height').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-rr-corner').addEventListener('input', e => { ctrl('v-rr-corner').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-chev-notch').addEventListener('input', e => { ctrl('v-chev-notch').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-chev-arm').addEventListener('input', e => { ctrl('v-chev-arm').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-chev-squash').addEventListener('input', e => { ctrl('v-chev-squash').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-cross-armwidth').addEventListener('input', e => { ctrl('v-cross-armwidth').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-cross-armlength').addEventListener('input', e => { ctrl('v-cross-armlength').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-cross-corner').addEventListener('input', e => { ctrl('v-cross-corner').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-lens-width').addEventListener('input', e => { ctrl('v-lens-width').textContent = e.target.value; renderGallery(); renderSeedPreview(); });
ctrl('rg-cellsize').addEventListener('input', e => { ctrl('v-cellsize').textContent = e.target.value; renderGallery(); });
ctrl('rg-gap').addEventListener('input', e => { ctrl('v-gap').textContent = e.target.value; renderGallery(); });
ctrl('rg-random-count').addEventListener('input', e => { ctrl('v-random-count').textContent = e.target.value; });
ctrl('rg-lines-step').addEventListener('input', e => { ctrl('v-lines-step').textContent = e.target.value; });
[['rg-osc-shift', 'v-osc-shift'], ['rg-osc-period', 'v-osc-period'], ['rg-osc-phase', 'v-osc-phase']].forEach(([rangeId, valId]) => {
  ctrl(rangeId).addEventListener('input', e => { ctrl(valId).textContent = e.target.value; });
});

ctrl('sel-seed-type').addEventListener('change', () => {
  ctrl('rg-poly-base').value = 0; ctrl('rg-star-base').value = -90;   // a Polygon picked now starts with its first corner to the right, a Star still points up (Oct 10, 2026)
  syncSeedUI(); renderGallery(); renderSeedPreview();
});
ctrl('btn-upload-seed').addEventListener('click', () => ctrl('file-seed').click());
ctrl('file-seed').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleSeedUpload(file);
  e.target.value = '';
});
// Creator library lives in a floatbar popover; opening it (re)reads the shared library.

// Cell shape: picks the cell the Element is drawn for; the lattice row picks the Component's cell count.
ctrl('fb-cell-shape').querySelectorAll('[data-cell]').forEach(b => { b.innerHTML = Organica.icons.get('fvs-cell-' + b.dataset.cell); });
ctrl('fb-cell-shape').addEventListener('click', e => {
  const b = e.target.closest('[data-cell]'); if (!b || b.dataset.cell === state.cellShape) return;
  setCellShape(b.dataset.cell);
});
ctrl('seg-grid-outline').querySelectorAll('.seg-btn').forEach(b => { b.innerHTML = Organica.icons.get(OUTLINE_ICONS[b.dataset.outline]); });
ctrl('seg-grid-outline').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
  state.cellOutline[state.cellShape] = b.dataset.outline;
  syncComponentGridUI(); syncRuleAvailability(); renderGallery();
});
ctrl('rg-grid-rings').addEventListener('input', e => {
  state.cellLattice[state.cellShape] = +e.target.value;
  syncComponentGridUI(); syncRuleAvailability(); renderGallery();
});
[['rg-grid-cols', 'v-grid-cols'], ['rg-grid-rows', 'v-grid-rows']].forEach(([id, valId]) => ctrl(id).addEventListener('input', e => {
  ctrl(valId).textContent = e.target.value;
  state.loomGrid = null;   // picking columns × rows replaces a legacy Loom grid
  syncComponentGridUI();
  syncRuleAvailability();
  renderGallery();
}));

// Element appearance feeds every tier that draws the Element, so a change
// re-renders all of them (the inactive tiers' DOM is just hidden, not gone).
export function onAppearanceChange() {
  if (state.layers) state.layers.items[state.layers.active].look = readLookControls();
  syncLookBlocks();
  renderSeedPreview();
  renderGallery();
  renderSymbol();
  renderSymbolLibrary();
  renderLibrary();
}
ctrl('sel-element-fillmode').addEventListener('change', onAppearanceChange);

// New Seed parameters (same pattern as the original rg-* listeners: label
// readout, then re-render the gallery + the Element preview).
[['rg-inner-count', 'v-inner-count'], ['rg-inner-ratio', 'v-inner-ratio'],
 ['rg-tri-corner', 'v-tri-corner'], ['rg-tri-curve', 'v-tri-curve'], ['rg-tri-irregular', 'v-tri-irregular'], ['rg-tri-seed', 'v-tri-seed'], ['rg-tri-outline', 'v-tri-outline'],
 ['rg-tru-core', 'v-tru-core'], ['rg-tru-spread', 'v-tru-spread'], ['rg-tru-reach', 'v-tru-reach'], ['rg-tru-ramp', 'v-tru-ramp'],
 ['rg-tru-curve', 'v-tru-curve'], ['rg-tru-round', 'v-tru-round'], ['rg-tru-segs', 'v-tru-segs'], ['rg-tru-gap', 'v-tru-gap'],
 ['rg-arc-sweep', 'v-arc-sweep'], ['rg-arc-start', 'v-arc-start'], ['rg-arc-round', 'v-arc-round'], ['rg-arc-segs', 'v-arc-segs'], ['rg-arc-gap', 'v-arc-gap'],
 ['rg-arc-taper', 'v-arc-taper'], ['rg-arc-irregular', 'v-arc-irregular'], ['rg-arc-seed', 'v-arc-seed'], ['rg-poly-radius', 'v-poly-radius'], ['rg-star-radius', 'v-star-radius'],
 ['rg-circle-radius', 'v-circle-radius'], ['rg-seg-len', 'v-seg-len'], ['rg-seg-weight', 'v-seg-weight'], ['rg-drop-radius', 'v-drop-radius'],
 ['rg-drop-tail', 'v-drop-tail'], ['rg-blob-radius', 'v-blob-radius'], ['rg-blob-amount', 'v-blob-amount'],
 ['rg-blob-seed', 'v-blob-seed']].forEach(([id, vid]) => {
  ctrl(id).addEventListener('input', e => { ctrl(vid).textContent = e.target.value; renderGallery(); renderSeedPreview(); });
});
ctrl('ck-seg-round').addEventListener('change', () => { renderGallery(); renderSeedPreview(); });
// In FVS Repeat X/Y tile the canvas and Space X/Y are the gap between tiles — 0 (touching) is valid here.
['rg-seg-spaceX', 'rg-seg-spaceY'].forEach(id => { if (ctrl(id)) ctrl(id).min = 0; });
CIRCLE_PARAMS.forEach(([k, id]) => {
  ctrl('rg-circle-' + id).addEventListener('input', e => { ctrl('v-circle-' + id).textContent = e.target.value; syncCircleRows(); renderGallery(); renderSeedPreview(); });
});
['sel-circle-interior', 'sel-circle-trim'].forEach(id => {
  ctrl(id).addEventListener('change', () => { syncCircleRows(); renderGallery(); renderSeedPreview(); });
});
// resetSeedShape (used by the floatbar Reset Element): restores every control of the CURRENT shape's own
// block to its markup default, plus Copies and the shape's Appearance (see below). Type, Palette and Paper are untouched;
// Freehand clears the drawing; an uploaded / Creator seed has no parameters.
// Each control gets its real input/change event, so its own listener refreshes
// the readout + gallery + preview and the slider fill (core.js delegate) follows.
export function resetSeedShape() {
  const type = pv('sel-seed-type');
  ['rg-inner-count', 'rg-inner-ratio', 'rg-element-cutout'].forEach(id => {   // Copies + Cut out belong to the Seed, whatever its shape
    const el = ctrl(id);
    if (el.value !== el.defaultValue) { el.value = el.defaultValue; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  { const a = ctrl('sel-inner-anchor'); delete a.dataset.before; if (a.value !== 'bbox') { a.value = 'bbox'; a.dispatchEvent(new Event('change', { bubbles: true })); } }
  // "Tutta la forma" (Diego, Oct 4, 2026): Reset brings the shape back to how it opens the first time — its
  // Appearance too, the same defaults a shape switch starts from. Single shape: Style / Stroke / Width / Length /
  // Cut out / Scale / Move / Rotate / pattern. With layers: only the active layer's own look (Style, Stroke,
  // Width, Length, Cut out) — its place and the whole-Element Scale / Move / Rotate belong to the group.
  // Palette and Paper are never touched.
  if (!state.layers) applyShapeLook(null);
  else {
    ctrl('sel-element-fillmode').value = DEFAULT_APPEARANCE.fillMode;
    [['strokew', DEFAULT_APPEARANCE.strokeW], ['w', 1], ['l', 1]].forEach(([k, v]) => { ctrl('rg-element-' + k).value = v; ctrl('v-element-' + k).textContent = v; });
    ctrl('ck-element-rounded').checked = DEFAULT_APPEARANCE.rounded;
    [['irregular', 0], ['irrwaves', 6], ['irrseed', 1]].forEach(([k, v]) => { ctrl('rg-element-' + k).value = v; ctrl('v-element-' + k).textContent = v; });
    ctrl('sel-element-irrmode').value = 'corners';
    syncIrregularRows();
    syncLookBlocks();
  }
  if (type === 'segment') ctrl('ck-element-rounded').checked = false;   // a Segment's own default: square ends
  onAppearanceChange();
  if (type === 'freehand') { if (fhEditor) fhEditor.clear(); return; }
  const block = document.getElementById('seed-' + type + '-block');
  if (!block) return;
  // the shape's own block + the retired (hidden) inputs, so an old snapshot's leftover Rotate/Radius resets too
  [...block.querySelectorAll('input, select'), ...ctrl('seed-legacy').querySelectorAll('input, select')].forEach(el => {
    if (el.type === 'checkbox') { if (el.checked !== el.defaultChecked) { el.checked = el.defaultChecked; el.dispatchEvent(new Event('change', { bubbles: true })); } return; }
    if (el.tagName === 'SELECT') {
      const i = Math.max(0, Array.from(el.options).findIndex(o => o.defaultSelected));
      if (el.selectedIndex !== i) { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); }
      return;
    }
    if (el.value !== el.defaultValue) { el.value = el.defaultValue; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  syncDependentRows(); renderGallery(); renderSeedPreview();
}
// The floatbar Reset (Diego, Oct 5, 2026: "a total reset of everything"): the Element as FVS opens it — one
// shape (the picker's first-load default), its parameters and Look & place at their defaults, no layers, the
// default palette (one black ink, colour rule default) and a white Paper without texture. Saved Elements,
// Components and Symbols are untouched. Hold to confirm (data-hold, core.js): it throws the current Element away.
export function resetElement() {
  if (state.layers) { state.layers = null; renderLayersUI(); }
  const sel = ctrl('sel-seed-type'), first = Math.max(0, Array.from(sel.options).findIndex(o => o.defaultSelected));
  if (sel.selectedIndex !== first) { sel.selectedIndex = first; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  rt.shapeLooks = {};   // every shape forgets its remembered Look & place (a shape switch would bring it back)
  // every shape's own parameters, not only the open one's (a Star left at 8 points stays 8 otherwise)
  document.querySelectorAll('[id^="seed-"][id$="-block"]').forEach(block => block.querySelectorAll('input, select').forEach(el => {
    if (el.type === 'checkbox') { if (el.checked !== el.defaultChecked) { el.checked = el.defaultChecked; el.dispatchEvent(new Event('change', { bubbles: true })); } return; }
    if (el.tagName === 'SELECT') { const i = Math.max(0, Array.from(el.options).findIndex(o => o.defaultSelected)); if (el.selectedIndex !== i) { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); } return; }
    if (el.value !== el.defaultValue) { el.value = el.defaultValue; el.dispatchEvent(new Event('input', { bubbles: true })); }
  }));
  resetSeedShape();   // the open shape's parameters + Look & place
  state.colors = ['#000000']; state.colorRule = { ...DEFAULT_COLOR_RULE };
  syncColorRuleUI(); buildPalette();
  paperSwatch.setPattern(false); live.paperPatternOn = false;
  setPaperUI('#ffffff');
  onAppearanceChange(); renderGallery(); renderSeedPreview();
}
ctrl('btn-reset-seed').addEventListener('click', resetElement);

// ⤢ Fit to canvas (one-shot, same maths as Genesis's Fit to grid): measure the
// Seed as drawn at Scale 1 / Move 0 (Width/Length kept), then write the Scale +
// Move sliders so its bbox fills the cell, centred. Goes stale if the shape's
// own parameters change afterwards — press it again.
export function fitSeedToCanvas() {
  const seed = getSeed();
  const geo = SEED_TYPES[seed.type].geometry(seed);
  if (!geo || !geo.d) return;
  const a = getElementAppearance();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
  svg.innerHTML = '<g>' + withAppearance({ ...a, scale: 1, mx: 0, my: 0 }, () => elementPathMarkup(geo, '#000', true)) + '</g>';
  document.body.appendChild(svg);
  let bb = null;
  try { const b = svg.firstChild.getBBox(); bb = { x: b.x, y: b.y, width: b.width, height: b.height }; } catch (e) { /* nothing drawn */ }
  document.body.removeChild(svg);
  // A Segment is a zero-height line — only bail when BOTH dimensions are ~0.
  if (!bb || (bb.width < 0.01 && bb.height < 0.01)) return;
  const setCtl = (k, v) => { ctrl('rg-element-' + k).value = v; ctrl('v-element-' + k).textContent = val('rg-element-' + k); };
  // getBBox() excludes the stroke, and the stroke scales with the shape (a Stroke-style seed
  // painted S·(bbox + strokeW) wide, so it was cut at the cell edge) — reserve it.
  const pad = a.fillMode === 'stroke' ? a.strokeW : 0;
  setCtl('scale', Math.round(100 / (Math.max(bb.width, bb.height) + pad) * 100) / 100);
  const S = val('rg-element-scale');   // the slider may clamp — centre with the scale it actually holds
  setCtl('mx', Math.round(S * (50 - (bb.x + bb.width / 2))));
  setCtl('my', Math.round(S * (50 - (bb.y + bb.height / 2))));
  onAppearanceChange();
}
ctrl('btn-fit-seed').addEventListener('click', fitSeedToCanvas);
ctrl('sel-arc-pivot').addEventListener('change', () => { renderGallery(); renderSeedPreview(); });
ctrl('sel-inner-anchor').addEventListener('change', () => { renderGallery(); renderSeedPreview(); });

// A Segment is a filled bar (segmentBar), so Style stays as it is. Its ends
// are square by default: picking Segment turns Rounded caps OFF (it only
// matters in Stroke style, where the bar is outlined); leaving Segment gives
// back what you had. In a multi-layer Element this is the ACTIVE layer's own
// setting only (remembered on the layer itself), never the other layers'.
export let roundedBeforeSegment = null;
export function applyShapeLook(look) {   // the Element's own look — not the Paper (ground), which belongs to the whole Element
  const a = { ...DEFAULT_APPEARANCE, ...PATTERN_DEFAULTS, ...(look || {}) };
  ctrl('sel-element-fillmode').value = a.fillMode;
  ctrl('rg-element-strokew').value = a.strokeW; ctrl('v-element-strokew').textContent = a.strokeW;
  ctrl('ck-element-rounded').checked = a.rounded;
  ['w', 'l', 'scale', 'mx', 'my', 'rotate'].forEach(k => { ctrl('rg-element-' + k).value = a[k]; ctrl('v-element-' + k).textContent = a[k]; });
  // Cut out is a Seed param, but it sits with Width / Length and is remembered per shape like them (Diego, Oct 4, 2026):
  // a shape opened for the first time starts solid, going back restores its own.
  { const h = look && look.cutOut != null ? look.cutOut : 0; ctrl('rg-element-cutout').value = h; ctrl('v-element-cutout').textContent = h; }
  [['irregular', 0], ['irrwaves', 6], ['irrseed', 1]].forEach(([k, def]) => {   // Irregularity: per shape too, same rule as Cut out
    const key = { irregular: 'irregular', irrwaves: 'irrWaves', irrseed: 'irrSeed' }[k], v = look && look[key] != null ? look[key] : def;
    ctrl('rg-element-' + k).value = v; ctrl('v-element-' + k).textContent = v;
  });
  ctrl('sel-element-irrmode').value = look && look.irrMode === 'outline' ? 'outline' : 'corners';
  syncIrregularRows();
  showPatternControls(a);
  syncLookBlocks();
}
ctrl('sel-seed-type').addEventListener('change', () => {
  const type = pv('sel-seed-type'), ck = ctrl('ck-element-rounded');
  if (!state.layers && rt.lastShapeType && rt.lastShapeType !== type) {
    rt.shapeLooks[rt.lastShapeType] = readShapeLook();
    applyShapeLook(rt.shapeLooks[type]);   // undefined → defaults
    onAppearanceChange();
  }
  rt.lastShapeType = type;
  const layer = state.layers ? state.layers.items[state.layers.active] : null;
  // A Segment layer is a canvas pattern (Repeat X/Y tile the whole cell): if the
  // layer still has its untouched new-layer placement, give it the full canvas —
  // otherwise its repeats stay inside the central 60%. A placement set by hand stays.
  // Leaving Segment gives the starting scale back, if it's still untouched.
  if (layer) {
    const pl = layerPlace(layer), untouched = !pl.mx && !pl.my && !pl.rotate;
    let moved = false;
    if (type === 'segment' && untouched && pl.scale === NEW_LAYER_SCALE) { layer.place = { ...pl, scale: 1 }; layer.segmentFullCanvas = true; moved = true; }
    else if (type !== 'segment' && layer.segmentFullCanvas) {
      if (untouched && pl.scale === 1) { layer.place = { ...pl, scale: NEW_LAYER_SCALE }; moved = true; }
      delete layer.segmentFullCanvas;
    }
    if (moved) { renderLayersUI(); renderGallery(); renderSeedPreview(); }
  }
  const saved = layer ? layer.roundedBeforeSegment : roundedBeforeSegment;
  const setSaved = v => { if (layer) { if (v != null) layer.roundedBeforeSegment = v; else delete layer.roundedBeforeSegment; } else roundedBeforeSegment = v; };
  if (type === 'segment' && ck.checked) {
    setSaved(true);
    ck.checked = false; onAppearanceChange();   // onAppearanceChange stores it on the active layer
  } else if (type !== 'segment' && saved != null) {
    setSaved(null);
    ck.checked = saved; onAppearanceChange();
  }
});
rt.lastShapeType = pv('sel-seed-type');   // the shape the panel starts on

ctrl('ck-fh-close').addEventListener('change', e => { if (fhEditor) fhEditor.setClosed(e.target.checked); });
ctrl('ck-fh-smooth').addEventListener('change', e => { if (fhEditor) fhEditor.setSmooth(e.target.checked); });
ctrl('btn-fh-undo').addEventListener('click', () => { if (fhEditor) fhEditor.undo(); });
ctrl('btn-fh-clear').addEventListener('click', () => { if (fhEditor) fhEditor.clear(); });
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && fhEditor && state.activeTier === 'element' && pv('sel-seed-type') === 'freehand') {
    e.preventDefault(); fhEditor.undo();
  }
});
export let fhResizeT = 0;
window.addEventListener('resize', () => { clearTimeout(fhResizeT); fhResizeT = setTimeout(syncFreehandEditor, 120); });
ctrl('ck-element-rounded').addEventListener('change', onAppearanceChange);
ctrl('sel-element-pattern').addEventListener('change', onAppearanceChange);
ctrl('sel-ground-pattern').addEventListener('change', () => { syncGroundBlock(); syncGroundTileNote(); onAppearanceChange(); });
ctrl('sel-ground-ink').addEventListener('change', onAppearanceChange);
['sel-ground-tile', 'sel-ground-layout', 'sel-ground-turn'].forEach(id => ctrl(id).addEventListener('change', () => { syncGroundTileNote(); onAppearanceChange(); }));
ctrl('rg-ground-patsize').addEventListener('input', e => { ctrl('v-ground-patsize').textContent = e.target.value; onAppearanceChange(); });
['patspacing', 'patweight', 'patangle'].forEach(k => ctrl('rg-ground-' + k).addEventListener('input', e => { ctrl('v-ground-' + k).textContent = e.target.value; syncGroundTileNote(); onAppearanceChange(); }));
syncGroundInkOptions();
// Cut out is a Seed parameter (getPanelSeed → every renderer, each layer its own), shown here beside Width / Length.
// Irregularity rows: Mode / Waves / Seed hide at 0; Mode hides when the shape has no corners (Outline is then the
// only way); Waves shows only when the outline ripples.
export function syncIrregularRows() {
  const on = val('rg-element-irregular') > 0, type = pv('sel-seed-type');
  let corners = false;
  if (on && BASE_GEOMETRY[type]) { try { corners = shapeHasCorners(BASE_GEOMETRY[type](getPanelSeed())); } catch (e) { corners = false; } }
  const rippling = !corners || pv('sel-element-irrmode') === 'outline';
  ctrl('row-element-irrmode').style.display = on && corners ? '' : 'none';
  ctrl('row-element-irrwaves').style.display = on && rippling ? '' : 'none';
  ctrl('row-element-irrseed').style.display = on ? '' : 'none';
}
['rg-element-irregular', 'rg-element-irrwaves', 'rg-element-irrseed'].forEach(id => ctrl(id).addEventListener('input', e => {
  ctrl(id.replace(/^rg-/, 'v-')).textContent = e.target.value; syncIrregularRows(); renderGallery(); renderSeedPreview();
}));
ctrl('sel-element-irrmode').addEventListener('change', () => { syncIrregularRows(); renderGallery(); renderSeedPreview(); });
ctrl('rg-element-cutout').addEventListener('input', e => { ctrl('v-element-cutout').textContent = e.target.value; syncCopiesRows(); renderGallery(); renderSeedPreview(); });
['strokew', 'w', 'l', 'scale', 'mx', 'my', 'rotate', 'patspacing', 'patweight', 'patangle'].forEach(k => {
  ctrl('rg-element-' + k).addEventListener('input', e => { ctrl('v-element-' + k).textContent = e.target.value; onAppearanceChange(); });
});

// Load JSON grid — a grid exported from Loom (or any Organica.loadLoomGrid-able JSON).
ctrl('btn-symbol-grid-upload').addEventListener('click', () => ctrl('file-loom-grid').click());
ctrl('file-loom-grid').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleSymbolGridUpload(file);
  e.target.value = '';
});

// The floatbar's View toggles. Three are preview overlays (state.symbolView); Clip to cell is the Symbol's own
// setting (state.symbolClipEnabled — it is in the export and saved with the Symbol), kept in the same row
// because it is switched the same way.
export function syncSymbolViewUI() {
  document.querySelectorAll('#fb-symbol-actions [data-view]').forEach(b => {
    const k = b.dataset.view;
    b.setAttribute('aria-pressed', String(k === 'clip' ? state.symbolClipEnabled : state.symbolView[k]));
  });
}
ctrl('btn-component-view-outline').addEventListener('click', e => {
  state.componentGridOutline = !state.componentGridOutline;
  e.currentTarget.setAttribute('aria-pressed', String(state.componentGridOutline));
  renderGallery(); renderComponentEditCanvas();
});
document.querySelectorAll('#fb-symbol-actions [data-view]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.view;
  if (k === 'clip') state.symbolClipEnabled = !state.symbolClipEnabled;
  else state.symbolView[k] = !state.symbolView[k];
  syncSymbolViewUI();
  renderSymbolCanvasOnly();
  if (k === 'clip') renderCellPropertiesPanel();
}));
syncSymbolViewUI();

ctrl('sel-symbol-fill').addEventListener('change', e => {
  ctrl('symbol-generate-block').style.display = e.target.value === 'generate' ? '' : 'none';
  ctrl('symbol-suggest-block').style.display = e.target.value === 'suggest' ? '' : 'none';
  syncManualBlock();
  ctrl('symbol-rule-block').style.display = e.target.value === 'rule' ? '' : 'none';
  if (e.target.value === 'manual') renderCellPropertiesPanel();
  if (e.target.value === 'rule') syncSymbolRuleUI();
});
ctrl('btn-symbol-regenerate').addEventListener('click', generateSymbolCells);
ctrl('btn-symbol-seed-random').addEventListener('click', () => { ctrl('num-symbol-seed').value = Math.floor(Math.random() * 1e6); });

// ── Rule layer wiring — one delegated listener on the rule block re-applies
// live (debounced, lock-aware) on any control change; buttons are explicit. ──
ctrl('sel-symbol-rule').addEventListener('change', syncSymbolRuleUI);
ctrl('chk-rule-scale').addEventListener('change', syncSymbolRuleUI);
ctrl('btn-symbol-apply-rule').addEventListener('click', () => applySymbolRule());
ctrl('btn-symbol-clear-rule').addEventListener('click', () => applySymbolRule({ resetAll: true }));
ctrl('btn-rule-seed-random').addEventListener('click', () => { ctrl('num-rule-seed').value = Math.floor(Math.random() * 1e6); applySymbolRule(); });
export let ruleApplyQueued = false;
export function scheduleRuleApply() {
  if (ruleApplyQueued) return;
  ruleApplyQueued = true;
  requestAnimationFrame(() => { ruleApplyQueued = false; applySymbolRule(); });
}
ctrl('symbol-rule-block').addEventListener('input', e => {
  if (e.target.type === 'range') {
    const v = ctrl(e.target.id.replace(/^rg-/, 'v-'));
    if (v) v.textContent = e.target.value;
  }
  scheduleRuleApply();
});
ctrl('symbol-rule-block').addEventListener('change', scheduleRuleApply);

// ── Cell properties panel — one shared editor for whatever is currently
// selected (state.symbolSelection), written via applyToSelection(). ──
bindSymbolCanvasSelection();
bindSymbolTrackDrag();
// The track-% overlay is real HTML positioned in screen px (see
// renderTrackLabelsOverlay) — unlike the SVG content it sits over, it does
// not rescale itself when the frame's own box changes size, so a plain
// window resize needs its own reposition pass, cheap enough to run on every
// frame of it.
new ResizeObserver(() => { if (state.symbolGrid) renderTrackLabelsOverlay(); }).observe(ctrl('symbol-frame'));
buildFitAllAnchorGrid();
rt.symbolAnchorPopover = Organica.popover(ctrl('btn-symbol-anchor'), ctrl('symbol-anchor-popover'));
syncFitAnchorUI();
ctrl('btn-rule-choose-content').addEventListener('click', openCellContentOverlayForAll);
ctrl('btn-content-overlay-close').addEventListener('click', closeCellContentOverlay);
ctrl('seg-content-filter').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b) return;
  rt.contentFilter = b.dataset.filter; syncContentFilter();
});
ctrl('seg-content-fit').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b) return;
  live.contentOverlayFit = b.dataset.fit;
  ctrl('seg-content-fit').querySelectorAll('.seg-btn').forEach(x => {
    x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b));
  });
});
ctrl('symbol-content-overlay').addEventListener('click', e => {
  if (e.target === ctrl('symbol-content-overlay')) closeCellContentOverlay(); // click on the backdrop itself
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ctrl('symbol-content-overlay').style.display !== 'none') closeCellContentOverlay();
});
bindCellProps('', SYMBOL_CELLS);

ctrl('tier-tabs').querySelectorAll('[data-tier]').forEach(btn => { btn.innerHTML = Organica.icons.get(STEP_ICONS[btn.dataset.tier]); });
ctrl('tier-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tier]'); if (b) setTier(b.dataset.tier); });   // one listener: the group moves between bars

export const repaintPaper = () => { renderGallery(); renderSeedPreview(); if (state.symbolGrid) renderSymbolCanvasOnly(); };
export const paperSwatch = Organica.palette.swatch('paper', {
  initial: '#ffffff',
  // Paper = colour + an optional pattern (the texture over it): the Pattern icon on the row
  pattern: { panel: ctrl('paper-pattern-block'), onToggle: on => { live.paperPatternOn = on; onAppearanceChange(); } },
  // picking a colour always means an opaque paper again
  onChange: (hex) => { state.paperColor = hexKey(hex); syncPaperClearUI(); repaintPaper(); },
});
// Transparent paper (state.paperColor === 'none'): the checkerboard button next to
// Paper. The swatch keeps the last colour, so switching it off gives that colour back.
export function syncPaperClearUI() {
  const on = isPaperNone(state.paperColor);
  ctrl('btn-paper-clear').setAttribute('aria-pressed', String(on));
  ctrl('btn-paper-clear').classList.toggle('is-on', on);
  document.body.classList.toggle('paper-clear', on);
}
// Every place that restores a saved paper goes through here (a colour or 'none').
export function setPaperUI(c) {
  if (isPaperNone(c)) { state.paperColor = PAPER_NONE; syncPaperClearUI(); repaintPaper(); }
  else paperSwatch.set(c);
}
ctrl('btn-paper-clear').addEventListener('click', () => {
  if (isPaperNone(state.paperColor)) paperSwatch.set(hexKey(pv('hex-paper')) || '#ffffff');
  else setPaperUI(PAPER_NONE);
});
syncPaperClearUI();

ctrl('chk-axis-rotation').addEventListener('change', () => { syncExhaustiveHint(); syncRuleAxisNote(); });
ctrl('chk-axis-flip').addEventListener('change', () => { syncExhaustiveHint(); syncRuleAxisNote(); });
ctrl('chk-axis-scale').addEventListener('change', e => {
  ctrl('scale-values-block').style.display = e.target.checked ? '' : 'none';
  syncExhaustiveHint();
  syncRuleAxisNote();
});
[['rg-scale-small', 'v-scale-small'], ['rg-scale-medium', 'v-scale-medium'], ['rg-scale-large', 'v-scale-large']].forEach(([rangeId, valId]) => {
  ctrl(rangeId).addEventListener('input', e => { ctrl(valId).textContent = e.target.value; syncExhaustiveHint(); });
});

ctrl('sel-rule').addEventListener('change', syncRuleUI);
ctrl('chk-layer-inks').addEventListener('change', () => { if (pv('sel-rule') === 'exhaustive') syncExhaustiveHint(); });
ctrl('btn-generate').addEventListener('click', generate);
ctrl('btn-clear-gallery').addEventListener('click', clearGallery);
ctrl('btn-colourways').addEventListener('click', generateColourways);
ctrl('seg-split-quadrant').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b) return;
  if (b.dataset.q === 'whole') splitElementReset(); else toggleSplitQuadrant(b.dataset.q);
});
ctrl('chk-split-grid').addEventListener('change', renderSeedPreview);
// A strip tile shows that view on the big canvas (its save circle keeps its own click).
ctrl('seed-preview').addEventListener('click', e => {
  if (e.target.closest('.fvs-thumb-quicksave')) return;
  const t = e.target.closest('.fvs-seed-tile[data-view]');
  if (t) setElementView(+t.dataset.view);
});
ctrl('btn-split-save').addEventListener('click', savePieceAsSeed);
ctrl('btn-seed-random').addEventListener('click', () => { ctrl('num-seed').value = Math.floor(Math.random() * 1e6); });

Organica.popover(ctrl('btn-export'), ctrl('export-popover'));
export function exportByTier(format) {
  if (state.activeTier === 'figure') return exportByTierName(state.figureTier || 'symbol', format);
  return exportByTierName(state.activeTier, format);
}
export function exportByTierName(tier, format) {
  if (tier === 'symbol') return exportSymbol(format);
  if (tier === 'grid') return exportFvsGrid(format);
  if (tier === 'element') return exportElement(format);
  return exportSelected(format);
}
// Set a control and fire its event, as a user edit would (Split, Figure recipes).
export function fireInput(id, v) { const e = ctrl(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
export function fireChange(id, v) { const e = ctrl(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }
