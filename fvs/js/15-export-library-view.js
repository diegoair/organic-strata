// Flexible Visual System · 15-export-library-view — Variants, Plates, recipe import / export, init, Library rail, Delete, Library view.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  live, pc, pv, state
} from './engine/00-core.js';
import {
  frameDims
} from './engine/01-geometry.js';
import {
  ensureSvgNamespace, getSeed
} from './engine/02-seed-ui.js';
import {
  fitThumbBox
} from './engine/03-rules.js';
import {
  ELEMENT_LIB, genesisTileForms, savedElementThumb
} from './engine/04-appearance.js';
import {
  elementIsEmpty
} from './engine/06-component-ui.js';
import {
  buildSeedPreviewSVG, r2
} from './engine/05-render-component.js';
import {
  LIBRARY, buildLibraryEntry, hexKey, isPaperNone, libraryNames, shownElementNames
} from './engine/07-library.js';
import {
  LIVE_SYMBOL
} from './engine/08-symbol-grid.js';
import {
  componentThumbSVG
} from './engine/10-suggest.js';
import {
  ASSET_LIBRARY, SYMBOL_LIBRARY, assetThumbSVG, buildSymbolLibraryEntry, patchCell, symbolCellBounds, symbolEntryThumbSVG
} from './engine/11-symbol-ui.js';
import {
  DEFAULT_VARIANTS, KIND_WORD, LIBVIEW_KINDS, RAIL_DBL_MS, componentUsage, dupName, elementInLivePaper,
  fileSlug, libviewBlock, libviewItems, libviewSVG, libviewVerb, plateSVG, railBlock, railPatch,
  railTileVerb, renderVariant, svgBaseDims, svgInnerOf, tierSVG
} from './engine/15-export-library-view.js';
import {
  buildPalette, ctrl, onColorRuleChange, printSizePanel, setStatus, syncColorRuleUI
} from './00-core.js';
import {
  useSvgAsSeed
} from './02-seed-ui.js';
import {
  elementLibraryChanged, removeSavedElement, useAsPaperTile, exportablePhotoSVG
} from './04-appearance.js';
import {
  drawIdFree, printComponentDims, renderGallery, renderSeedPreview
} from './05-render-component.js';
import {
  renderComponentEditCanvas, syncRuleAvailability, syncRuleUI, syncSeedUI
} from './06-component-ui.js';
import {
  applyElementSnapshot, applyLibraryEntryToUI, closeUnderlyingComponentPicker,
  openUnderlyingComponentPicker, removeLibraryEntry, removeUnderlyingComponent, renameLibraryEntry,
  renderLibrary, replaceSavedComponent, replaceableBy, saveAllComponentsToLibrary, syncComponentRoleUI
} from './07-library.js';
import {
  renderSymbolPool
} from './10-suggest.js';
import {
  applySymbolLibraryEntryToUI, applyToSelection, elementPosePatch, elementPoses, removeSymbolLibraryEntry, renderCellPropertiesPanel,
  renderSymbol, renderSymbolCanvasOnly, renderSymbolLibrary, saveSymbolAs, svgPointFromEvent
} from './11-symbol-ui.js';
import {
  exportByTier, fvsIsTypingTarget, onAppearanceChange, setPaperUI, setTier
} from './12-shell.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  closeLibview: () => closeLibview, deleteSaved: () => deleteSaved, libviewIsOpen: () => libviewIsOpen,
  renderLibraryRail: () => renderLibraryRail, renderLibview: () => renderLibview,
  syncRailTier: () => syncRailTier
});
// ── Variants / Plates / Recipe ─────────────────────────────────────
// One geometry, many outputs. tierSVG() is the single SVG builder for
// the active tier (the same functions the normal SVG export uses), so a
// variant / plate is exactly what the preview shows — only Style, ink
// and paper differ, applied as overrides around that one call.
export const VARIANTS = Organica.presetStore('fvs-variants');
export function readVariants() {
  try { const v = VARIANTS.read().list; if (Array.isArray(v) && v.length) return v; } catch (e) {}
  return DEFAULT_VARIANTS.map(v => ({ ...v }));
}
export function writeVariants(list) { try { VARIANTS.write({ list }); } catch (e) {} }
export let variantList = readVariants();




export function renderVariantRows() {
  const host = ctrl('variant-rows');
  host.innerHTML = '';
  variantList.forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'fvs-variant-row';
    row.innerHTML = `<select class="panel-select" aria-label="Variant ${i + 1} style"><option value="fill">Fill</option><option value="stroke">Stroke</option></select>`
      + `<input type="color" aria-label="Variant ${i + 1} ink">`
      + `<input type="color" aria-label="Variant ${i + 1} paper">`
      + `<input type="number" class="panel-input" min="1" max="20" aria-label="Variant ${i + 1} stroke width">`
      + `<button class="mini-btn" aria-label="Remove variant ${i + 1}">${Organica.icons.get('close', { size: 'sm' })}</button>`;
    const [sel, col, pap, num, del] = row.children;
    sel.value = v.style; col.value = v.ink; num.value = v.strokeW; pap.value = v.paper || (isPaperNone(state.paperColor) ? '#ffffff' : state.paperColor);
    pap.title = 'Paper for this variant';
    pap.addEventListener('input', () => { v.paper = pap.value; writeVariants(variantList); });
    num.disabled = v.style !== 'stroke';
    sel.addEventListener('change', () => { v.style = sel.value; num.disabled = v.style !== 'stroke'; writeVariants(variantList); });
    col.addEventListener('input', () => { v.ink = col.value; writeVariants(variantList); });
    num.addEventListener('input', () => { v.strokeW = Math.max(1, +num.value || 1); writeVariants(variantList); });
    del.addEventListener('click', () => { variantList.splice(i, 1); writeVariants(variantList); renderVariantRows(); });
    host.appendChild(row);
  });
}
renderVariantRows();
ctrl('btn-variant-add').addEventListener('click', () => {
  variantList.push({ style: 'fill', ink: '#000000', strokeW: 4, paper: null });
  writeVariants(variantList); renderVariantRows();
});
export function printWrapSVG(svg, paper, plate) {
  const bd = svgBaseDims(svg), base = bd.w, p = printComponentDims(base, bd.h);
  const bw = p.trimWmm + 2 * p.bleedMm, bh = p.trimHmm + 2 * p.bleedMm;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(bw)}mm" height="${r2(bh)}mm" viewBox="0 0 ${r2(bw)} ${r2(bh)}">`;
  if (paper && paper !== 'none') out += `<rect width="100%" height="100%" fill="${paper}"/>`;
  out += `<g transform="translate(${r2(p.bleedMm)},${r2(p.bleedMm)})"><g transform="scale(${base ? p.trimWmm / base : 1})">${svgInnerOf(svg)}</g>`;
  if (p.bleedMm > 0) out += Organica.printSize.cropMarksSVG(p.trimWmm, p.trimHmm, {}, '#000');
  if (plate && p.bleedMm > 0) out += Organica.printSize.registrationMarksSVG(p.trimWmm, p.trimHmm, { bleed: p.bleedMm }, '#000');
  return out + '</g></svg>';
}
export async function encodeOutput(svg, { format, scale, paper, plate }) {
  const print = printSizePanel.getMode() === 'print';
  svg = exportablePhotoSVG(svg, true);   // the caller said so once
  const doc = print ? printWrapSVG(svg, paper, plate) : svg;
  if (format === 'svg') return new Blob([doc], { type: 'image/svg+xml' });
  const bd = svgBaseDims(svg), base = bd.w;
  let outW, outH, dpi = null;
  if (print) { const p = printComponentDims(base, bd.h); outW = p.outW; outH = p.outH; dpi = p.dpi; }
  else { outW = Math.round(base * scale); outH = Math.round(bd.h * scale); }
  const sized = /<svg[^>]*\swidth="/.test(doc)
    ? doc.replace(/(<svg[^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, `$1 width="${outW}" height="${outH}"`)
    : doc.replace('<svg ', `<svg width="${outW}" height="${outH}" `);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('SVG raster failed')); im.src = url; });
    const cv = document.createElement('canvas'); cv.width = outW; cv.height = outH;
    cv.getContext('2d').drawImage(img, 0, 0, outW, outH);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (dpi) return new Blob([Organica.printSize.embedPngDpi(await blob.arrayBuffer(), dpi)], { type: 'image/png' });
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
// The (scale) sizes to emit: PNG in screen mode honours the ×1/×2/×4 ticks;
// SVG and print mode are one file per item.
export function outputScales() {
  if (pv('sel-variant-format') !== 'png' || printSizePanel.getMode() === 'print') return [1];
  const out = [1, 2, 4].filter(n => pc('chk-vscale-' + n));
  return out.length ? out : [1];
}
export function outputName(label, scale) {
  const fmt = pv('sel-variant-format');
  return Organica.stamp(`fvs-${label}${fmt === 'png' && scale > 1 ? '@' + scale + 'x' : ''}`, fmt);
}
export function syncVariantFormatUI() { ctrl('row-variant-scales').hidden = !(pv('sel-variant-format') === 'png'); }
ctrl('sel-variant-format').addEventListener('change', syncVariantFormatUI);
syncVariantFormatUI();

ctrl('btn-variant-export').addEventListener('click', () => {
  const transparent = pc('chk-variant-transparent');
  const scales = outputScales(), format = pv('sel-variant-format');
  const jobs = [];
  variantList.forEach(v => scales.forEach(sc => jobs.push({ v, sc })));
  Organica.plateExport.run(jobs.length, {
    build: async i => {
      const { v, sc } = jobs[i];
      const svg = renderVariant(v, transparent);
      if (!svg) return null;
      const paper = transparent ? 'none' : (v.paper || state.paperColor);
      return { blob: await encodeOutput(svg, { format, scale: sc, paper, plate: false }), filename: outputName(`${v.style}-${v.ink.slice(1)}`, sc) };
    },
  });
});

export function syncPlatesBlock() { ctrl('plates-block').hidden = state.colors.length < 2; }
ctrl('btn-export').addEventListener('click', syncPlatesBlock);
ctrl('btn-plates-export').addEventListener('click', () => {
  const svg = exportablePhotoSVG(tierSVG()); if (!svg) return;
  const colors = state.colors.slice(), paper = state.paperColor;
  const scales = outputScales(), format = pv('sel-variant-format');
  const jobs = [];
  colors.forEach((c, i) => scales.forEach(sc => jobs.push({ i, sc })));
  Organica.plateExport.run(jobs.length, {
    build: async n => {
      const { i, sc } = jobs[n];
      return { blob: await encodeOutput(plateSVG(svg, colors, i, paper), { format, scale: sc, paper: 'none', plate: true }), filename: outputName(`plate${i + 1}-${colors[i].slice(1)}`, sc) };
    },
  });
});

// Recipe: everything needed to rebuild the current work — Element (with
// Appearance), the selected Component, the live Symbol, the Grid setup,
// palette and the variant rows — as one JSON file.
export function buildRecipe() {
  const symName = state.fvsGridSymbolName;
  return {
    tool: 'fvs-recipe', version: 1, tier: state.activeTier,
    component: buildLibraryEntry(),
    symbol: buildSymbolLibraryEntry(),
    grid: { componentName: state.fvsGridComponentName, componentEntry: state.fvsGridComponentName ? (LIBRARY.read()[state.fvsGridComponentName] || null) : null,
      symbolName: symName === LIVE_SYMBOL ? 'Recipe symbol' : symName,
      symbol: symName === LIVE_SYMBOL ? buildSymbolLibraryEntry() : (symName ? (SYMBOL_LIBRARY.read()[symName] || null) : null),
      type: state.fvsGridConfig.type, cellSize: state.fvsGridConfig.cellSize, gap: state.fvsGridConfig.gap, altFlip: state.fvsGridConfig.altFlip },
    variants: variantList,
  };
}
export function applyRecipe(r) {
  if (!r || r.tool !== 'fvs-recipe') throw new Error('Not a Flexible Visual System recipe');
  if (r.component) applyLibraryEntryToUI(r.component);
  if (r.symbol) applySymbolLibraryEntryToUI(r.symbol);
  if (r.grid && r.grid.componentName && r.grid.componentEntry) {
    const all = LIBRARY.read(); all[r.grid.componentName] = r.grid.componentEntry; LIBRARY.write(all);
    state.fvsGridComponentName = r.grid.componentName;
  }
  if (r.grid && r.grid.symbol && r.grid.symbolName) {
    const all = SYMBOL_LIBRARY.read(); all[r.grid.symbolName] = r.grid.symbol; SYMBOL_LIBRARY.write(all);
    state.fvsGridSymbolName = r.grid.symbolName;
    state.fvsGridConfig = { ...state.fvsGridConfig, type: r.grid.type, cellSize: r.grid.cellSize, gap: r.grid.gap, altFlip: !!r.grid.altFlip };
  }
  if (Array.isArray(r.variants) && r.variants.length) { variantList = r.variants; writeVariants(variantList); renderVariantRows(); }
  // A recipe saved while the (now-removed) Grid page was active falls back to Symbol.
  setTier(r.tier === 'grid' ? 'symbol' : (r.tier || 'component'));
}
ctrl('btn-recipe-export').addEventListener('click', () => {
  Organica.downloadText(JSON.stringify(buildRecipe(), null, 2), Organica.stamp('fvs-recipe', 'json'), 'application/json');
});
ctrl('btn-recipe-import').addEventListener('click', () => ctrl('file-recipe').click());
ctrl('file-recipe').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { try { applyRecipe(JSON.parse(reader.result)); } catch (err) { setStatus('error', 'Recipe not loaded: ' + err.message); } };
  reader.readAsText(f);
});

ctrl('btn-export-png').addEventListener('click', () => exportByTier('png'));
ctrl('btn-export-svg').addEventListener('click', () => exportByTier('svg'));
// Same channel Spore/Pollen/Halide use: the finished SVG of the active step, posted to the Figma plugin.
ctrl('btn-export-figma').addEventListener('click', () => {
  const btn = ctrl('btn-export-figma');
  const svg = exportablePhotoSVG(tierSVG());
  if (!svg) { btn.textContent = 'Nothing to send'; setTimeout(() => { btn.textContent = 'Send to Figma'; }, 1600); return; }
  Organica.sendToFigma(svg, 'Flexible Visual System');
  btn.textContent = 'Sent ↗'; setTimeout(() => { btn.textContent = 'Send to Figma'; }, 1600);
});

state.componentBlend = 'normal';   // Component Blend: Normal | Multiply (saved as entry.blend only when Multiply)
ctrl('sel-component-blend').addEventListener('change', e => {
  state.componentBlend = e.target.value;
  renderGallery(); renderComponentEditCanvas();
});
ctrl('sel-component-role').addEventListener('change', e => {
  state.componentRole = e.target.value;
  syncComponentRoleUI();
  renderGallery();
});
ctrl('btn-pick-underlying-component').addEventListener('click', openUnderlyingComponentPicker);
ctrl('btn-remove-underlying-component').addEventListener('click', removeUnderlyingComponent);
ctrl('btn-underlying-overlay-close').addEventListener('click', closeUnderlyingComponentPicker);
ctrl('underlying-component-overlay').addEventListener('click', e => { if (e.target === ctrl('underlying-component-overlay')) closeUnderlyingComponentPicker(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ctrl('underlying-component-overlay').hidden) closeUnderlyingComponentPicker(); });


// ── Init ──
buildPalette();
syncColorRuleUI();
ctrl('sel-color-rule').addEventListener('change', onColorRuleChange);
ctrl('sel-color-offset').addEventListener('change', onColorRuleChange);
ctrl('chk-color-parts').addEventListener('change', onColorRuleChange);
syncSeedUI();
syncComponentRoleUI();
syncRuleAvailability();
syncRuleUI();
renderSymbol();
renderSymbolLibrary();
// ── Library rail (test) ── a floating left rail of saved Elements + Components. On the Symbol tab a tile
// is dragged onto a cell (pointer drag, the Layers pattern) — or clicked / Enter to put it in the
// selected cells. Place-only: renaming and removing stay in the right-bar libraries.
export const railPanel = ctrl('fvs-rail-panel'), railBtn = ctrl('btn-rail');
// Open by default, remembered per browser (Diego, Oct 28, 2026): only the user's own toggle (the button, Esc) writes it;
// a step that hides the rail, the Library view or an empty Element tab close it without changing the wish.
const RAIL_OPEN_KEY = 'organica.fvs.rail-open';
export function railWanted() { try { return localStorage.getItem(RAIL_OPEN_KEY) !== 'false'; } catch (e) { return true; } }
function setRailWanted(open) { try { localStorage.setItem(RAIL_OPEN_KEY, String(!!open)); } catch (e) { /* private mode: it opens next time */ } }
function railMayReopen() { return railWanted() && !railIsOpen() && !railBlock() && !ctrl('fvs-rail-dock').hidden && !document.body.classList.contains('fvs-libview-open'); }
export function railIsOpen() { return ctrl('fvs-rail-panel').dataset.open === 'true'; }   // a function: renderLibrary() reaches it during init
export function setRailOpen(open, opts) {
  const railPanel = ctrl('fvs-rail-panel'), railBtn = ctrl('btn-rail');   // ctrl(): syncRailButton can reopen it during init, before the consts
  railPanel.dataset.open = open ? 'true' : 'false';
  railPanel.toggleAttribute('inert', !open);
  railBtn.setAttribute('aria-expanded', String(open));
  railBtn.innerHTML = Organica.icons.get(open ? 'chevron-left' : 'grid', { size: 'lg' });
  if (open) renderLibraryRail();
  else if (opts && opts.focus) railBtn.focus();
  syncRailSpace();
}
// The open rail takes its width from the work area instead of lying over the Component gallery /
// the Symbol sheet: #canvas-wrap's left padding reserves up to the panel's right edge (+ a gap),
// measured without the panel's entry transform (offset*, not getBoundingClientRect).
export function syncRailSpace() {
  const wrap = ctrl('canvas-wrap'), dock = ctrl('fvs-rail-dock'), railPanel = ctrl('fvs-rail-panel');   // ctrl(): it can run during init, before the const
  const open = railPanel.dataset.open === 'true' && !railPanel.classList.contains('is-empty') && !dock.hidden;
  if (!open) { wrap.style.removeProperty('--fvs-rail-reserve'); return; }
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-5')) || 0;
  const right = dock.offsetLeft + railPanel.offsetLeft + railPanel.offsetWidth - wrap.getBoundingClientRect().left;
  wrap.style.setProperty('--fvs-rail-reserve', Math.max(0, Math.round(right + gap)) + 'px');
}
window.addEventListener('resize', () => syncRailSpace());
export const railSaveBtn = ctrl('btn-rail-save-lib');
// One tile: the thumbnail button plus (siblings, so a click on them never starts a drag) rename and remove.
export function railTile(kind, name, svg, w, h) {
  const tile = document.createElement('div');
  tile.className = 'fvs-rail__tile';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fvs-library-item';
  b.dataset.railKind = kind; b.dataset.railName = name;
  b.title = name;
  b.setAttribute('aria-label', railTileVerb(kind) + ' ' + name);
  if (w) { b.style.width = w + 'px'; b.style.height = h + 'px'; }
  b.innerHTML = svg;
  const ren = document.createElement('button');
  ren.type = 'button'; ren.className = 'rmx-x fvs-rail__rename'; ren.dataset.railRename = '1';
  ren.innerHTML = Organica.icons.get('pencil', { size: 'xs' });
  ren.setAttribute('aria-label', 'Rename ' + name);
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'rmx-x'; x.dataset.railRemove = '1';
  x.innerHTML = Organica.icons.get('trash', { size: 'xs' });
  x.setAttribute('aria-label', 'Delete ' + name);   // one click, no confirm (Diego, Oct 6, 2026)
  if (kind === 'pose') { tile.append(b); return tile; }   // the live Element: nothing to rename or delete
  tile.append(b, ren, x);
  return tile;
}
// A group's tiles in this order, reusing every tile whose thumbnail is the same SVG text (kind, name, size
// and drawing unchanged) — a save then adds one tile instead of re-drawing the whole library (110 saved
// Components cost ~90 ms of style + paint per save when every tile was rebuilt). Clicks are delegated to the
// panel, so a kept tile carries no stale listener. "Same drawing" = drawIdFree (05-render-component.js), which
// ignores the time stamp and the per-drawing ids; a kept tile keeps its own ids, still unique on the page.
const railTileKey = new WeakMap();
export function syncRailGroup(group, specs) {
  const old = new Map();
  [...group.children].forEach(t => { const k = railTileKey.get(t); if (k != null && !old.has(k)) old.set(k, t); });
  specs.forEach((spec, i) => {
    const k = [spec[0], spec[1], drawIdFree(spec[2]), spec[3], spec[4]].join('\u0000');
    let t = old.get(k);
    if (t) { old.delete(k); t.querySelector('.fvs-library-item').setAttribute('aria-label', railTileVerb(spec[0]) + ' ' + spec[1]); }   // a kept tile is named for this step too
    else { t = railTile(...spec); railTileKey.set(t, k); }
    if (group.children[i] !== t) group.insertBefore(t, group.children[i] || null);
  });
  while (group.children.length > specs.length) group.lastElementChild.remove();
}
export function syncRailButton() {
  if (document.getElementById('btn-libview')) syncLibviewButton();
  const why = railBlock(), railBtn = ctrl('btn-rail');   // ctrl(): it can run during init, before the const
  railBtn.setAttribute('aria-disabled', String(!!why));
  railBtn.setAttribute('aria-label', why || 'Library rail');
  if (why && railIsOpen()) setRailOpen(false);
  else if (!why && rt.railBooted && railMayReopen()) setRailOpen(true);   // not during init: 99-boot opens it once the module is ready
}
export function renderLibraryRail() {
  ctrl('fvs-rail-panel').dataset.railTier = state.activeTier;   // the Symbol tab's tiles drag (grab cursor)
  syncRailButton();
  if (!railIsOpen()) return;   // drawn when it opens
  const els = ctrl('rail-elements'), comps = ctrl('rail-components'), syms = ctrl('rail-symbols');
  // newest first (Diego, Oct 5, 2026): a save lands at the top, in view — at the end it sat below the fold
  const newestFirst = all => (a, b) => String((all[b] || {}).savedAt || '').localeCompare(String((all[a] || {}).savedAt || ''));
  const elAll = ELEMENT_LIB.read(), elNames = shownElementNames(elAll).sort(newestFirst(elAll));
  // None saved yet: the Element on the Element step, as it is, is the Elements group's one tile on the Symbol step — what
  // the Brush takes by default (Diego, Oct 29, 2026: "bring the basic element 1 only in the library rail as default").
  const live = !elNames.length && state.activeTier === 'symbol' && !elementIsEmpty();
  syncRailGroup(els, live ? [['pose', liveElementName(), buildSeedPreviewSVG(getSeed(), 0, false, false, 48)]] : elNames.map(n => ['element', n, savedElementThumb(elAll[n])]));
  const cAll = LIBRARY.read(), cNames = libraryNames(cAll).sort(newestFirst(cAll));
  syncRailGroup(comps, cNames.map(n => { const size = frameDims(cAll[n].grid), box = fitThumbBox(size.w, size.h, 48); return ['component', n, componentThumbSVG(n), box.w, box.h]; }));
  // No group of the Element's seven poses any more (Diego, Oct 28, 2026: "non è necessario portare tutti gli element nel
  // library rail ma solo quello salvato"): the rail shows the saved Elements; a turn or a flip is a click again on a cell.
  const poses = [];
  syncRailGroup(ctrl('rail-poses'), []);
  const sAll = SYMBOL_LIBRARY.read(), sNames = Object.keys(sAll || {}).sort(newestFirst(sAll));
  syncRailGroup(syms, sNames.map(n => ['symbol', n, symbolEntryThumbSVG(sAll[n])]));
  const aAll = ASSET_LIBRARY.read(), aNames = Object.keys(aAll || {}).sort(newestFirst(aAll));
  syncRailGroup(ctrl('rail-assets'), aNames.map(n => ['asset', n, assetThumbSVG(aAll[n])]));
  // An empty group is not shown (no "None saved yet"); Components stays on its own tab for Save all.
  const onComp = state.activeTier === 'component', visible = [['poses', poses.length], ['elements', elNames.length || live], ['components', cNames.length || onComp], ['symbols', sNames.length], ['assets', aNames.length]];
  visible.forEach(([k, on]) => { ctrl('rail-g-' + k).hidden = !on; });
  ctrl('btn-rail-save-all').hidden = !onComp;
  // nothing to show at all (and no Save footer) → no empty glass box beside the toggle
  ctrl('fvs-rail-panel').classList.toggle('is-empty', !visible.some(([, on]) => on) && state.activeTier !== 'symbol');
  if (rt.brush) setBrush(rt.brush);   // the Brush's tile stays pressed after a redraw (gone if its item was deleted)
  syncRailSpace();   // its contents (and so its width) changed
}
railBtn.addEventListener('click', () => { if (railBtn.getAttribute('aria-disabled') === 'true') return; const open = !railIsOpen(); setRailWanted(open); setRailOpen(open); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (railDrag) { cancelRailDrag(); return; }
  const a = document.activeElement, inRail = a && (a.closest('#fvs-rail') || a.closest('#fvs-rail-panel'));
  if (railIsOpen() && inRail) { setRailWanted(false); setRailOpen(false, { focus: true }); }   // only an Escape inside the rail closes it now (Oct 28, 2026: open by default — Esc on the sheet is the Selection's / the Brush's)
});

// A cell inside the selection takes the whole selection; any other cell takes only itself.
export function railApply(kind, name, idx) {
  if (state.activeTier !== 'symbol') return;
  const patch = kind === 'pose' ? elementPosePatch(poseAt(name)) : railPatch(kind, name);
  if (!patch) return;
  if (idx != null && !state.symbolSelection.has(idx)) {
    const cell = state.symbolCells[idx];
    if (!cell) return;
    patchCell(cell, patch);   // no unsaved-work guard: the working Symbol is kept across reloads (Oct 11, 2026)
    renderSymbolCanvasOnly();
  } else if (state.symbolSelection.size) {
    applyToSelection(patch);
  } else return;   // no cell selected: a click does nothing (Diego, Oct 5, 2026 — no notice; dragging onto a cell still works)
  renderCellPropertiesPanel();
}

export let railPress = null, railDrag = null;   // {kind,name,tile,x,y,id} / {ghost,idx}
// A drop target other than the Symbol step's cells: { apply(kind, name, idx), cellSel } — Compose (cellSel left out:
// its .fg-cell) and Component Edit's cells (18-step-boards.js). null = the Symbol step's own.
export function setRailTarget(t) { rt.railTarget = t || null; }
// The Symbol step's selection drop target (Oct 28, 2026 — 11-selection-ui): the square dot beside a selection takes
// Elements / Components as the selection's items A, B, C…; it answers before any cell.
export const railCellAt = e => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!rt.railTarget && el && el.closest('.fvs-sel-drop')) return el.closest('.fvs-sel-drop');
  return el && el.closest(rt.railTarget ? (rt.railTarget.cellSel || '#fg-compose-stage .fg-cell') : '#symbol-frame [data-cell-index]');
};
const railCellIndex = g => (g.classList.contains('fvs-sel-drop') ? 'drop' : +(g.dataset.cellIndex != null ? g.dataset.cellIndex : g.dataset.i));
export const clearRailDrop = () => document.querySelectorAll('#canvas-wrap .is-drop, #canvas-wrap .is-compatible, #canvas-wrap .is-incompatible').forEach(g => g.classList.remove('is-drop', 'is-compatible', 'is-incompatible'));

export function cancelRailDrag() {
  if (railDrag) railDrag.ghost.remove();
  if (railPress && railPress.tile) railPress.tile.classList.remove('is-dragging');
  railPress = null; railDrag = null; clearRailDrop(); document.body.classList.remove('is-rail-dragging');
  railPanel.classList.remove('is-dragging-away');
}
railPanel.addEventListener('pointerdown', e => {
  const tile = e.button === 0 && e.target.closest('.fvs-library-item');
  if (!tile || (state.activeTier !== 'symbol' && !rt.railTarget)) return;   // a Symbol drags onto a cell too (Oct 28, 2026: a drag pastes it there; a click still opens it)
  railPress = { kind: tile.dataset.railKind, name: tile.dataset.railName, tile, x: e.clientX, y: e.clientY, id: e.pointerId };
});
window.addEventListener('pointermove', e => {
  if (!railPress || e.pointerId !== railPress.id) return;
  if (!railDrag) {
    if (Math.hypot(e.clientX - railPress.x, e.clientY - railPress.y) < 4) return;
    const ghost = document.createElement('div');
    ghost.className = 'fvs-rail-ghost';
    ghost.innerHTML = railPress.tile.innerHTML;
    document.body.appendChild(ghost);   // never inside the rail: a backdrop-filter ancestor would re-anchor position:fixed
    railDrag = { ghost, idx: null };
    railPress.tile.classList.add('is-dragging');
    document.body.classList.add('is-rail-dragging');
    railPanel.classList.add('is-dragging-away');   // out of the way, still there
  }
  e.preventDefault();
  railDrag.ghost.style.transform = `translate3d(${e.clientX - 24}px, ${e.clientY - 24}px, 0)`;
  const g = railCellAt(e), idx = g ? railCellIndex(g) : null;
  if (idx !== railDrag.idx) { clearRailDrop(); if (g) g.classList.add(idx === 'drop' ? (railPress.kind === 'symbol' || railPress.kind === 'asset' ? 'is-incompatible' : 'is-compatible') : 'is-drop'); railDrag.idx = idx; }
});
window.addEventListener('pointerup', e => {
  if (!railPress || e.pointerId !== railPress.id) return;
  const press = railPress, drag = railDrag;
  const idx = drag ? drag.idx : null;
  cancelRailDrag();
  if (!drag) return;   // a plain click: handled by the click listener below
  const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, true), 0);
  if (idx === 'drop') { if (press.kind !== 'symbol' && press.kind !== 'asset' && hooks.selectionDrop) hooks.selectionDrop(press.kind, press.name); return; }
  if (idx != null && !Number.isNaN(idx)) (rt.railTarget ? rt.railTarget.apply : press.kind === 'symbol' ? (k, n, i) => hooks.symbolPaste && hooks.symbolPaste(n, i) : press.kind === 'asset' ? (k, n, i) => hooks.assetPaste && hooks.assetPaste(n, i) : railApply)(press.kind, press.name, idx);
});
window.addEventListener('pointercancel', cancelRailDrag);
window.addEventListener('blur', () => { if (railPress) cancelRailDrag(); });   // a drag never stays half done when the window loses the pointer
railPanel.addEventListener('dragstart', e => e.preventDefault());   // never the browser's own drag of a tile's picture or text
// Rename: the one centred dialog; a taken name asks again.
export async function railRename(kind, name) {
  const store = kind === 'element' ? ELEMENT_LIB : kind === 'symbol' ? SYMBOL_LIBRARY : kind === 'asset' ? ASSET_LIBRARY : LIBRARY;
  let label = 'New name', next;
  for (;;) {
    next = await Organica.prompt({ title: 'Rename', label, value: next || name, ok: 'Rename' });
    if (!next || next === name) return;
    if (!store.read()[next]) break;
    label = `"${next}" already exists — choose another`;
  }
  if (kind === 'component') {
    renameLibraryEntry(name, next);
    state.components.forEach(c => { if (c.savedName === name) c.savedName = next; if (c.savedNames) c.savedNames = c.savedNames.map(n => (n === name ? next : n)); });   // the saved-version history follows a rename
    renderGallery();
    return;
  }
  const all = store.read();
  if (!all[name]) return;
  const livePaper = kind === 'element' && live.paperPatternOn && pv('sel-ground-tile') === 'saved:' + name;
  all[next] = all[name]; delete all[name];
  store.write(all);
  if (kind === 'element') {
    // a Paper tile names its Element ('saved:<name>'): repoint the live one and every saved appearance
    const from = JSON.stringify('saved:' + name), to = JSON.stringify('saved:' + next);
    [LIBRARY, SYMBOL_LIBRARY].forEach(st => {
      const lib = st.read(); let hit = false;
      Object.keys(lib).forEach(k => { const j = JSON.stringify(lib[k]); if (j.includes(from)) { lib[k] = JSON.parse(j.split(from).join(to)); hit = true; } });
      if (hit) st.write(lib);
    });
    elementLibraryChanged();
    if (livePaper) useAsPaperTile('saved:' + next);
  } else renderLibraryRail();
}
export let railNoteTimer = 0;
export function railNotice(text, info) {
  const n = ctrl('rail-note'); n.textContent = text; n.classList.toggle('is-info', !!info);
  clearTimeout(railNoteTimer); if (text) railNoteTimer = setTimeout(() => { n.textContent = ''; }, 8000);
}
export function railRemove(kind, name) { deleteSaved(kind, name); }
export function railUse(kind, name) {
  const t = state.activeTier;
  if (rt.railTarget) { rt.railTarget.apply(kind, name, null); return; }   // Compose: into the selected cells (a Symbol too)
  if (kind === 'symbol') {
    const e = SYMBOL_LIBRARY.read()[name];
    if (!e) return;
    if (Organica.dirty.any && state.symbolGrid) { Organica.confirm({ title: 'Replace the Symbol?', message: 'The Symbol on the canvas has unsaved changes.', ok: 'Replace', danger: true }).then(ok => { if (ok) { setTier('symbol'); applySymbolLibraryEntryToUI(e); } }); return; }
    setTier('symbol'); applySymbolLibraryEntryToUI(e);
    return;
  }
  if (kind === 'asset') {   // from the first selected cell (Enter, the Library view)
    if (t !== 'symbol') setTier('symbol');
    if (!state.symbolSelection.size) { railNotice('Select a cell: the asset is placed from it'); return; }
    if (hooks.assetPaste) hooks.assetPaste(name, Math.min(...state.symbolSelection));
    return;
  }
  if (t === 'symbol') { railApply(kind, name, null); return; }
  if (kind === 'element') { useAsPaperTile('saved:' + name); return; }
  const e = LIBRARY.read()[name];
  if (e) { if (t !== 'component') setTier('component'); applyLibraryEntryToUI(e); }
}
export let railClickTimer = 0;
export function openSavedElement(name) {
  const e = ELEMENT_LIB.read()[name];
  if (!e || !e.seed) { railNotice('This Element was saved without its settings — it can be placed, not edited'); return; }
  setTier('element');
  applyElementSnapshot(e.seed, e.appearance || null);
  if (e.colors && e.colors.length) { state.colors = e.colors.map(hexKey); buildPalette(); }
  setPaperUI(e.paperColor || '#ffffff');
  onAppearanceChange(); renderGallery(); renderSeedPreview();
}
export function openSavedComponent(name) {
  const e = LIBRARY.read()[name];
  if (!e) return;
  setTier('component');
  applyLibraryEntryToUI(e);
}
railPanel.addEventListener('click', e => {
  const tile = e.target.closest('.fvs-rail__tile');
  if (!tile) return;
  const it = tile.querySelector('.fvs-library-item'), kind = it.dataset.railKind, name = it.dataset.railName;
  if (e.target.closest('[data-rail-remove]')) { railRemove(kind, name); return; }
  if (e.target.closest('[data-rail-rename]')) { railRename(kind, name); return; }
  if (kind === 'symbol' || e.detail === 0) { railUse(kind, name); return; }   // a Symbol / Enter on a focused tile
  clearTimeout(railClickTimer);
  if (e.detail >= 2) { if (kind === 'asset') return; if (kind === 'pose') setTier('element'); else (kind === 'element' ? openSavedElement : openSavedComponent)(name); return; }
  railClickTimer = setTimeout(() => (rt.brush && brushable(kind) ? setBrush({ kind, name }) : railUse(kind, name)), RAIL_DBL_MS);   // Brush on: a click takes the tile as the Brush; Select: it goes in the selected cells
});
ctrl('btn-rail-save-all').addEventListener('click', saveAllComponentsToLibrary);

// ── Brush (Diego, Oct 28, 2026 — the asset-learn page's tray: "clic sulla tile la prende, clic sulle celle la mette,
// clic di nuovo ruota e ribalta, Esc la lascia"). A mouse click on an Element, a pose of the Element or a Component tile
// on the Symbol step takes it as the Brush (the tile pressed, the sheet's cursor a crosshair); a click or a drag on the
// cells puts it there; a click on a cell already holding it turns it a quarter, past 270° it flips (8 poses); Esc, or a
// click on the same tile, puts it down. Enter on a tile still places it in the selected cells (railUse). A Symbol is
// never a Brush: it is dragged and pasted. Each stroke is one ⌘Z step (the Symbol board keeps an edit once it settles).
rt.brush = null;   // { kind, name } while a tile is the Brush
const brushable = kind => state.activeTier === 'symbol' && !rt.railTarget && kind !== 'symbol';
function brushPatch(b) {
  if (b.kind === 'asset') return ASSET_LIBRARY.read()[b.name] ? {} : null;   // an asset is stamped, not patched (brushPaint)
  if (b.kind === 'pose') return elementPosePatch(poseAt(b.name));
  return railPatch(b.kind, b.name);
}
// Does the cell already hold what the Brush puts (any pose of it)?
function brushHolds(cell, b) {
  if (!cell) return false;
  if (b.kind === 'component') return cell.source === 'component' && cell.componentName === b.name;
  const p = brushPatch(b); if (!p) return false;
  const q = typeof p === 'function' ? p(cell) : p;
  return cell.source === 'seed' && JSON.stringify(cell.seedParams) === JSON.stringify(q.seedParams);
}
export function setBrush(b) {
  rt.brush = b && brushPatch(b) ? b : null;
  document.body.classList.toggle('fvs-brush-on', !!rt.brush);
  railPanel.querySelectorAll('.fvs-library-item').forEach(t => {
    const on = !!rt.brush && t.dataset.railKind === rt.brush.kind && t.dataset.railName === rt.brush.name;
    t.classList.toggle('is-brush', on);   // the visual; the live note says the Brush is on (no aria-pressed: Enter places, it does not toggle)
  });
  railNotice(rt.brush ? 'Brush: click or drag over cells to place it. Click a cell again to turn or flip it. Click a tile to change the Brush.' : '', true);
  syncBrushMode();
}
// The Brush mode (Diego, Oct 28, 2026: "una modalità brush sulla floatbar centrale in basso … così è nascosto"): Select ·
// Brush in the Symbol step's bar, V / B. Brush on = a Brush in hand (rt.brush) — turned on with nothing taken yet it
// takes what the selected cell holds (a Component), else the newest saved Element, else the Element as it is; Select, Esc or leaving the step puts it down.
// The Element on the Element step — its name on the Element board ("Element 1"…); a pose tile named so is that Element as it is
export function liveElementName() { const e = state.elements && state.elements.find(x => x.id === state.activeElement); return (e && e.name) || 'Element'; }
const poseAt = name => { const i = elementPoses().findIndex(p => p[3] === name); return i < 0 ? 0 : i; };   // a pose by name; any other name = as it is
export function brushFromSelection() {
  const i = state.symbolSelection.size ? Math.min(...state.symbolSelection) : -1, c = state.symbolCells[i];
  if (c && c.source === 'component' && c.componentName && LIBRARY.read()[c.componentName]) return { kind: 'component', name: c.componentName };
  const elAll = ELEMENT_LIB.read(), saved = shownElementNames(elAll).sort((a, b) => String((elAll[b] || {}).savedAt || '').localeCompare(String((elAll[a] || {}).savedAt || '')));
  if (saved.length) return { kind: 'element', name: saved[0] };   // the newest saved Element, as the rail shows first
  return { kind: 'pose', name: liveElementName() };   // nothing saved: the Element on the Element step, as it is (its rail tile)
}
export function setBrushMode(on) {
  if (on && state.activeTier !== 'symbol') return;
  setBrush(on ? (rt.brush || brushFromSelection()) : null);
}
function syncBrushMode() {
  const on = !!rt.brush, sel = ctrl('btn-symbol-mode-select'), br = ctrl('btn-symbol-mode-brush'), th = ctrl('symbol-brush-thumb');
  if (sel) sel.setAttribute('aria-pressed', String(!on));
  if (br) br.setAttribute('aria-pressed', String(on));
  if (th) {
    const t = on && [...railPanel.querySelectorAll('.fvs-library-item')].find(x => x.dataset.railKind === rt.brush.kind && x.dataset.railName === rt.brush.name);
    th.innerHTML = t ? t.innerHTML : ''; th.hidden = !t;
    if (br) br.setAttribute('aria-label', on ? 'Brush: ' + rt.brush.name + ' (B)' : 'Brush (B)');   // the key stays in the tooltip, as Undo (⌘Z)
  }
}
// The cell under a point of the sheet (its bounding box — as the marquee reads cells)
function brushCellAt(e) {
  const pt = svgPointFromEvent(e); if (!pt) return null;
  const c = symbolCellBounds().find(b => pt.x >= b.x && pt.x < b.x + b.w && pt.y >= b.y && pt.y < b.y + b.h);
  return c ? c.index : null;
}
function brushPaint(i, click) {
  const cell = state.symbolCells[i], b = rt.brush;
  if (!cell || !b) return false;
  if (b.kind === 'asset') { if (click && hooks.assetPaste) hooks.assetPaste(b.name, i, { quiet: true }); return click; }   // a click stamps it from that cell; a drag does not repeat it
  if (cell.locked) return false;
  if (click && brushHolds(cell, b)) {   // again on it: the next of the 8 poses — 0 90 180 270, then flipped 0 90 180 270
    const r = ((cell.rotation || 0) + 90) % 360;
    patchCell(cell, { rotation: r, flipH: r === 0 ? !cell.flipH : !!cell.flipH, flipV: false });
    return true;
  }
  if (brushHolds(cell, b)) return false;   // a drag over cells that hold it already leaves their turn
  return patchCell(cell, brushPatch(b));
}
let brushStroke = null;   // { done: Set, moved } while the mouse is down with a Brush
ctrl('symbol-frame').addEventListener('mousedown', e => {
  if (!rt.brush || state.activeTier !== 'symbol' || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (e.target.closest && e.target.closest('.fvs-sel-overlay, .sym-track')) return;   // the selection's boxes, a grid border
  const i = brushCellAt(e); if (i == null) return;
  e.preventDefault(); e.stopImmediatePropagation();   // no marquee, no selection click
  brushStroke = { done: new Set([i]), moved: false, first: i };
  if (brushPaint(i, true)) renderSymbolCanvasOnly();
}, true);
window.addEventListener('mousemove', e => {
  if (!brushStroke) return;
  const i = brushCellAt(e); if (i == null || brushStroke.done.has(i)) return;
  brushStroke.done.add(i); brushStroke.moved = true;
  if (brushPaint(i, false)) renderSymbolCanvasOnly();
});
window.addEventListener('mouseup', () => {
  if (!brushStroke) return;
  brushStroke = null;
  renderSymbol();   // the panels, the saved work and the undo step follow the stroke
}, true);
// Esc puts the Brush down before anything else reads it (the Selection's Esc, the rail's)
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !rt.brush) return;
  const shown = el => el.getClientRects().length > 0;
  if ([...document.querySelectorAll('.org-modal, dialog[open], .org-popover[data-open="true"]')].some(shown) || fvsIsTypingTarget(document.activeElement)) return;   // an Esc for a dialog, a popover or a field stays theirs
  e.preventDefault(); e.stopImmediatePropagation();
  setBrush(null);
}, true);


// Select · Brush in the bar, and their keys (V / B, a bare key, not while typing — the Figure's own keys are elsewhere)
ctrl('btn-symbol-mode-select').innerHTML = Organica.icons.get('pointer');
ctrl('btn-symbol-mode-brush').insertAdjacentHTML('afterbegin', Organica.icons.get('brush'));
ctrl('btn-symbol-mode-select').addEventListener('click', () => setBrushMode(false));
ctrl('btn-symbol-mode-brush').addEventListener('click', () => setBrushMode(true));
window.addEventListener('keydown', e => {
  if (state.activeTier !== 'symbol' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || fvsIsTypingTarget(document.activeElement)) return;
  if ([...document.querySelectorAll('.org-modal, dialog[open]')].some(el => el.getClientRects().length > 0)) return;
  const k = e.key.toLowerCase();
  if (k === 'v' || k === 'b') { e.preventDefault(); setBrushMode(k === 'b'); }
});
syncBrushMode();

// Save: the Symbol only — Elements and Components save from their own thumbnails.
export function railSaveTarget() {
  const t = state.activeTier;
  if (t === 'symbol') { if (!state.symbolGrid) return null; return { title: 'Save Symbol', value: 'Symbol ' + new Date().toLocaleTimeString(), save: n => saveSymbolAs(n) }; }
  return null;
}
export function syncRailSave() {
  // Symbol only: Elements and Components save from their own thumbnails (the + circle)
  ctrl('fvs-rail-panel').querySelector('.fvs-rail__foot').hidden = !(state.activeTier === 'symbol');
  railSaveBtn.disabled = !railSaveTarget();
}
ctrl('fvs-rail-panel').addEventListener('pointerenter', syncRailSave);
railSaveBtn.addEventListener('click', async () => {
  const tgt = railSaveTarget();
  if (!tgt) return;
  const name = await Organica.prompt({ title: tgt.title, label: 'Name', value: tgt.value, ok: 'Save' });
  if (!name) return;
  tgt.save(name);
  renderLibraryRail();
});
// rt.railTarget: set while the Figure step composes (17-figure-graph) — { apply(kind, name, idx) } puts a saved item in
// Compose's cells as a region rule; the rail is then the same Library rail as the Symbol step's (Oct 8, 2026).
rt.railTarget = null;
export function syncRailTier(tier) {
  if (tier !== 'symbol') setBrush(null);
  const show = tier !== 'figure' || !!rt.railTarget;
  ctrl('fvs-rail-dock').hidden = !show;
  syncRailSave();
  if (!show && railIsOpen()) setRailOpen(false);
  renderLibraryRail();
}
export function deleteSavedComponent(name) {
  const all = LIBRARY.read();
  if (!all[name]) return;
  state.symbolPool = state.symbolPool.filter(p => p.name !== name);
  state.components.forEach(c => { if (c.savedNames) c.savedNames = c.savedNames.filter(n => n !== name); if (c.savedName === name) { const v = c.savedNames || []; if (v.length) c.savedName = v[v.length - 1]; else delete c.savedName; } });
  if (componentUsage(name).total) {
    const key = name + ' (deleted ' + Date.now().toString(36) + ')';
    renameLibraryEntry(name, key);   // repoints every user to the hidden key
    const lib = LIBRARY.read(); if (lib[key]) { lib[key].hidden = true; LIBRARY.write(lib); }
  } else removeLibraryEntry(name);
  renderSymbolPool(); renderGallery(); renderLibrary();
}
export function deleteSavedElement(name) {
  const all = ELEMENT_LIB.read();
  if (!all[name]) return;
  if (elementInLivePaper(name)) { all[name].hidden = true; ELEMENT_LIB.write(all); elementLibraryChanged(); }   // the open Paper keeps its tile
  else removeSavedElement(name);
}
export function deleteSaved(kind, name) {
  if (kind === 'element') deleteSavedElement(name);
  else if (kind === 'symbol') removeSymbolLibraryEntry(name);
  else if (kind === 'asset') { const all = ASSET_LIBRARY.read(); delete all[name]; ASSET_LIBRARY.write(all); renderLibraryRail(); }
  else deleteSavedComponent(name);
  sweepHiddenSaved();
}
// Hidden entries nothing uses any more go for good.
export function sweepHiddenSaved() {
  const lib = LIBRARY.read();
  let gone = false;
  for (let pass = 0; pass < 4; pass++) {   // a hidden Container may be the only user of another hidden one
    const drop = Object.keys(lib).filter(n => lib[n].hidden && !componentUsage(n).total);
    if (!drop.length) break;
    drop.forEach(n => delete lib[n]); LIBRARY.write(lib); gone = true;
  }
  if (gone) renderLibrary();
  const els = ELEMENT_LIB.read(), dropEl = Object.keys(els).filter(n => els[n] && els[n].hidden && !elementInLivePaper(n));
  if (dropEl.length) { dropEl.forEach(n => delete els[n]); ELEMENT_LIB.write(els); elementLibraryChanged(); }
}
export function duplicateSaved(kind, name) {
  const store = kind === 'element' ? ELEMENT_LIB : kind === 'symbol' ? SYMBOL_LIBRARY : kind === 'asset' ? ASSET_LIBRARY : LIBRARY;
  const all = store.read();
  if (!all[name]) return null;
  const next = dupName(all, name);
  all[next] = { ...JSON.parse(JSON.stringify(all[name])), savedAt: new Date().toISOString() };
  store.write(all);
  if (kind === 'element') elementLibraryChanged(); else if (kind === 'symbol') renderSymbolLibrary(); else if (kind === 'asset') renderLibraryRail(); else renderLibrary();
  return next;
}

export let libviewKind = 'all';
export function libviewIsOpen() { const v = document.getElementById('fvs-libview'); return !!(v && !v.hidden); }
export function libviewTile(kind, item) {
  const tile = document.createElement('div');
  tile.className = 'fvs-libview__tile';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'fvs-libview__thumb';
  b.dataset.theme = 'light';   // the work stays light in dark mode (a work surface, like the sheet)
  b.dataset.lvKind = kind; b.dataset.lvName = item.id || item.name;
  b.setAttribute('aria-label', libviewVerb(kind, item.name));
  try { b.innerHTML = item.svg(); } catch (e) { b.innerHTML = ''; }
  const cap = document.createElement('span');
  cap.className = 'fvs-library-caption fvs-libview__name'; cap.textContent = item.name; cap.title = item.name;
  const acts = document.createElement('div');
  acts.className = 'fvs-libview__actions';
  const act = (icon, verb, label, extra) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'icon-btn'; x.dataset.lvAct = verb; x.setAttribute('aria-label', label); x.innerHTML = Organica.icons.get(icon, { size: 'sm' }); if (extra) extra(x); return x; };
  const fmt = f => { const x = document.createElement('button'); x.type = 'button'; x.className = 'mini-btn'; x.dataset.lvAct = f; x.textContent = f.toUpperCase(); x.setAttribute('aria-label', 'Download ' + item.name + ' as ' + f.toUpperCase()); return x; };
  if (kind !== 'genesis') {
    acts.append(act('pencil', 'rename', 'Rename ' + item.name), act('copy', 'duplicate', 'Duplicate ' + item.name));
  }
  // Replace (Oct 26, 2026): a saved Component whose gallery Component now draws differently can take the current version
  if (kind === 'component' && replaceableBy(item.name)) {
    const x = document.createElement('button'); x.type = 'button'; x.className = 'mini-btn'; x.dataset.lvAct = 'replace';
    x.textContent = 'Replace'; x.setAttribute('aria-label', 'Replace ' + item.name + ' with the current version');
    acts.append(x);
  }
  acts.append(fmt('svg'), fmt('png'));
  if (kind !== 'genesis') acts.append(act('trash', 'delete', 'Delete ' + item.name));   // one click (Diego: "delete is delete")
  tile.append(b, cap, acts);
  return tile;
}
export function renderLibview() {
  if (!libviewIsOpen()) return;
  const body = ctrl('libview-body'), q = pv('libview-q').trim().toLowerCase();
  body.innerHTML = '';
  let shown = 0, any = 0;
  LIBVIEW_KINDS.forEach(([kind, title]) => {
    if (libviewKind !== 'all' && libviewKind !== kind) return;
    const all = libviewItems(kind); any += all.length;
    const items = q ? all.filter(it => String(it.name).toLowerCase().includes(q)) : all;
    if (!items.length) return;   // an empty section is not shown
    shown += items.length;
    const sec = document.createElement('section');
    sec.className = 'fvs-libview__section';
    const h = document.createElement('h3'); h.className = 'sub-label'; h.textContent = title + ' · ' + items.length;
    const grid = document.createElement('div'); grid.className = 'fvs-libview__grid';
    items.forEach(it => grid.appendChild(libviewTile(kind, it)));
    sec.append(h, grid); body.appendChild(sec);
  });
  if (!shown) {
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    body.innerHTML = q ? `<div class="org-empty"><p class="org-empty__title">No matches</p><p class="org-empty__hint">Nothing saved is named “${esc(pv('libview-q').trim())}”.</p></div>`
      : `<div class="org-empty"><p class="org-empty__title">Nothing here yet</p><p class="org-empty__hint">${libviewKind === 'all' ? 'Save an Element, a Component, a Symbol or an asset.' : 'No ' + (LIBVIEW_KINDS.find(k => k[0] === libviewKind) || [, 'items'])[1] + ' saved yet.'}</p></div>`;
  }
}
export function syncLibviewButton() {
  const btn = ctrl('btn-libview'), why = libviewBlock();
  btn.setAttribute('aria-disabled', String(!!why));
  btn.setAttribute('aria-label', why || 'Library');
  if (why && libviewIsOpen()) closeLibview({ focus: true });
}
export function openLibview() {
  const v = ctrl('fvs-libview');
  if (railIsOpen()) setRailOpen(false);
  libviewKind = 'all';
  ctrl('libview-filter').querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === 'all')));
  v.hidden = false;
  ctrl('canvas-wrap').classList.add('is-libview');
  document.body.classList.add('fvs-libview-open');
  ctrl('btn-libview').setAttribute('aria-expanded', 'true');
  Organica.store.library.pull().then(() => renderLibview());   // the user's Genesis seeds, fresh
  renderLibview();
  ctrl('libview-q').focus();
}
export function closeLibview(opts) {
  const v = document.getElementById('fvs-libview');
  if (!v || v.hidden) return;
  v.hidden = true;
  ctrl('canvas-wrap').classList.remove('is-libview');
  document.body.classList.remove('fvs-libview-open');
  ctrl('btn-libview').setAttribute('aria-expanded', 'false');
  ctrl('libview-status').textContent = '';
  if (opts && opts.focus) ctrl('btn-libview').focus();
  syncRailButton();   // the rail it closed comes back, if it was open
}
export async function libviewDownload(kind, name, fmt) {
  let svg = libviewSVG(kind, name);
  if (!svg) return;
  svg = exportablePhotoSVG(ensureSvgNamespace(svg).replace(/\saria-hidden="true"/, ''));
  const base = 'fvs-' + kind + '-' + fileSlug(kind === 'genesis' ? (genesisTileForms().find(x => x.id === name) || {}).name || name : name);
  if (fmt === 'svg') { Organica.download(new Blob([svg], { type: 'image/svg+xml' }), Organica.stamp(base, 'svg')); ctrl('libview-status').textContent = 'SVG downloaded'; return; }
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1], parts = vb ? vb.trim().split(/[\s,]+/).map(Number) : [0, 0, 100, 100];
  const w = parts[2] || 100, h = parts[3] || 100, k = 2000 / Math.max(w, h);
  const cw = Math.round(w * k), ch = Math.round(h * k);
  const sized = svg.replace(/<svg\b([^>]*)>/, (m, a) => '<svg' + a.replace(/\s(width|height)="[^"]*"/g, '') + ` width="${cw}" height="${ch}">`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('PNG failed')); im.src = url; });
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
    Organica.download(Organica.dataURLToBlob(cv.toDataURL('image/png')), Organica.stamp(base, 'png'));
    ctrl('libview-status').textContent = 'PNG downloaded';
  } catch (e) { ctrl('libview-status').textContent = 'Could not make the PNG'; }
  finally { URL.revokeObjectURL(url); }
}
export function libviewOpenItem(kind, name) {
  if (kind === 'genesis') {
    const f = genesisTileForms().find(x => x.id === name);
    if (!f) return;
    closeLibview();
    if (state.activeTier !== 'element') setTier('element');
    try { useSvgAsSeed(f.svg); }   // whole: flower bloom = 9 ellipses, sun = disc + stroked rays
    catch (e) { ctrl('seed-upload-error').textContent = e.message; ctrl('seed-upload-error').hidden = false; }
    return;
  }
  closeLibview();
  if (kind === 'element') openSavedElement(name);
  else if (kind === 'component') openSavedComponent(name);
  else if (kind === 'asset') railUse('asset', name);
  else railUse('symbol', name);
}
ctrl('fvs-libview').addEventListener('click', async e => {
  const seg = e.target.closest('#libview-filter .seg-btn');
  if (seg) { libviewKind = seg.dataset.kind; ctrl('libview-filter').querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b === seg))); renderLibview(); return; }
  if (e.target.closest('#libview-close')) { closeLibview({ focus: true }); return; }
  const tile = e.target.closest('.fvs-libview__tile');
  if (!tile) return;
  const th = tile.querySelector('.fvs-libview__thumb'), kind = th.dataset.lvKind, name = th.dataset.lvName;
  const act = e.target.closest('[data-lv-act]');
  if (!act) { if (e.target.closest('.fvs-libview__thumb')) libviewOpenItem(kind, name); return; }
  const verb = act.dataset.lvAct, status = ctrl('libview-status');
  if (verb === 'svg' || verb === 'png') { libviewDownload(kind, name, verb); return; }
  if (verb === 'rename') { await railRename(kind, name); renderLibview(); status.textContent = KIND_WORD[kind] + ' renamed'; return; }
  if (verb === 'replace') { replaceSavedComponent(name).then(done => { if (done) renderLibview(); }); return; }   // replaceSavedComponent says so (one notice)
  if (verb === 'duplicate') { if (duplicateSaved(kind, name)) { renderLibview(); status.textContent = KIND_WORD[kind] + ' duplicated'; } return; }
  if (verb === 'delete') { deleteSaved(kind, name); renderLibview(); status.textContent = KIND_WORD[kind] + ' deleted'; syncLibviewButton(); }
});
ctrl('libview-q').addEventListener('input', () => renderLibview());
ctrl('btn-libview').addEventListener('click', () => {
  if (ctrl('btn-libview').getAttribute('aria-disabled') === 'true') return;
  libviewIsOpen() ? closeLibview({ focus: true }) : openLibview();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || !libviewIsOpen()) return;
  if (document.querySelector('dialog[open]')) return;   // Organica.prompt / confirm take their own Escape
  if (e.target.closest && e.target.closest('[data-armed].is-armed')) return;
  closeLibview({ focus: true });
});
ctrl('btn-libview').innerHTML = Organica.icons.get('library', { size: 'lg' });
ctrl('libview-close').innerHTML = Organica.icons.get('close', { size: 'sm' });
