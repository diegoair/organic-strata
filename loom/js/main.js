/* ─────────────────────────────────────────────────────────────
   Loom — Universal Grid Generator. Phase 1 MVP: Canvas Manager, two
   generators (Bento / Sinusoidal — brief's own "one simple, one complex"
   pairing), Universal JSON Model, three renderers (live CSS Grid / SVG /
   raster PNG) + JSON export, Figma via the existing shared SVG pipeline.

   THE ONE RULE (same as every other Organica tool): one build() function
   produces the model, every renderer/export reads that SAME model. No
   renderer is allowed to recompute geometry its own way.
   ───────────────────────────────────────────────────────────── */

import { CANVAS_PRESETS, createCanvas, innerRect, safeAreaRect, UNIT_TO_MM, toCanonical } from './canvas-manager.js';
import { buildModel } from './json-model.js';
import { GENERATORS } from './generators/registry.js';
import { renderSVG } from './renderers/svg-renderer.js';
import { paintGridDOM, buildHTMLSnippet } from './renderers/html-renderer.js';
import { renderRaster } from './renderers/raster-renderer.js';

function ctrl(id) { return document.getElementById(id); }
function val(id) { return parseFloat(ctrl(id).value); }

const setStatus = Organica.status();
const previewEl = ctrl('grid-preview');
const canvasFrame = ctrl('canvas-frame');
// Read once from the CSS custom property that .loom-cell's own border
// already uses — SVG/PNG can't drift from the live preview's colour
// since both read this same value, not two hand-matched hex literals.
const GUIDE_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--guide-blue').trim() || '#3399ff';

let currentModel = null;
let currentInner = null;

// ── Canvas Manager ──
function populateCanvasPresets() {
  const sel = ctrl('sel-canvas-preset');
  Object.keys(CANVAS_PRESETS).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
}
function applyCanvasPreset() {
  const name = ctrl('sel-canvas-preset').value;
  const p = CANVAS_PRESETS[name];
  if (!p) return;
  // A preset can silently change the unit (px presets vs. A4/Letter's mm)
  // — Gap/Padding still need rescaling to the new unit's range (a real
  // bug caught testing preset switches: their slider stayed at the
  // PREVIOUS unit's range/value while the Unit field read something else
  // entirely). Width/Height do NOT go through the same rescale — the
  // preset already supplies the exact correct number in its own unit;
  // treating it as still being in the OLD unit and reconverting would
  // double-convert (a second real bug, caught the same way: A4 landed at
  // "2100" instead of "210" after switching units by hand first, then
  // picking A4 — onUnitChange()'s own width/height rescale ran a second
  // time on a value the preset had already written correctly).
  rescaleGapPadding(lastUnit, p.unit);
  ctrl('num-width').value = p.width;
  ctrl('num-height').value = p.height;
  ctrl('sel-unit').value = p.unit;
  lastUnit = p.unit;
  syncUnitRows();
  build();
}
function syncUnitRows() {
  ctrl('row-bleed').style.display = ctrl('sel-unit').value !== 'px' ? '' : 'none';
}
function readCanvas() {
  return createCanvas({
    width: val('num-width'),
    height: val('num-height'),
    unit: ctrl('sel-unit').value,
    marginPct: val('rg-margin'),
    safeAreaPct: val('rg-safearea'),
    bleed: val('num-bleed'),
  });
}

// Gap/Padding are absolute numbers, not percentages like Margin/Safe area
// — they need the SAME canonicalisation as Width/Height (see
// canvas-manager.js's own header) so a Gap of "12" means 12mm when the
// canvas unit is mm and 12m when it's m, not the same raw number treated
// identically regardless of scale.
function unitVal(id) {
  return toCanonical(val(id), ctrl('sel-unit').value);
}

// Physical-unit ranges for the two absolute-number sliders (Gap, Padding)
// — px and mm share one range (1 canonical unit ≈ 1 on-screen px, the
// pre-existing simplification), cm/m get their own so the slider stays
// physically sensible at that scale instead of e.g. "0–40" meaning
// 0–40 METRES of gap.
const UNIT_RANGES = {
  gap:     { px: { min: 0, max: 40, step: 1 }, mm: { min: 0, max: 40, step: 1 }, cm: { min: 0, max: 10, step: 0.2 }, m: { min: 0, max: 1, step: 0.02 } },
  padding: { px: { min: 0, max: 30, step: 1 }, mm: { min: 0, max: 30, step: 1 }, cm: { min: 0, max: 5, step: 0.1 }, m: { min: 0, max: 0.5, step: 0.01 } },
};
let lastUnit = 'px';

// Rescales a Gap/Padding slider's raw value + range to a newly-selected
// unit, preserving the PHYSICAL size it represented under the old one
// (convert old raw value → mm-equivalent → new unit's raw value) rather
// than leaving the number unchanged and silently meaning something
// completely different.
function rescaleUnitField(id, rangeKey, oldUnit, newUnit) {
  const el = ctrl(id);
  const oldFactor = oldUnit === 'px' ? 1 : UNIT_TO_MM[oldUnit];
  const newFactor = newUnit === 'px' ? 1 : UNIT_TO_MM[newUnit];
  const mmEquivalent = parseFloat(el.value) * oldFactor;
  const r = UNIT_RANGES[rangeKey][newUnit] || UNIT_RANGES[rangeKey].mm;
  el.min = r.min; el.max = r.max; el.step = r.step;
  let newValue = mmEquivalent / newFactor;
  newValue = Math.min(r.max, Math.max(r.min, Math.round(newValue / r.step) * r.step));
  el.value = newValue;
  const valEl = ctrl('v-' + id.slice(3));
  if (valEl) valEl.textContent = el.value;
}

function rescaleGapPadding(oldUnit, newUnit) {
  rescaleUnitField('rg-bento-gap', 'gap', oldUnit, newUnit);
  rescaleUnitField('rg-sin-gap', 'gap', oldUnit, newUnit);
  rescaleUnitField('rg-padding', 'padding', oldUnit, newUnit);
}

function onUnitChange() {
  const newUnit = ctrl('sel-unit').value;
  if (newUnit !== lastUnit) {
    rescaleGapPadding(lastUnit, newUnit);
    // Width/Height too — but ONLY between two physical units (mm/cm/m),
    // where "preserve the real size" is well-defined. px has no fixed
    // physical size to preserve, so a transition to/from px leaves the
    // raw number untouched (same as it always has) rather than inventing
    // a conversion. Without this, switching mm→cm left "210" meaning
    // 210cm instead of 21cm — a real 10× jump for no reason the user
    // asked for, on top of the zoom/fit issue this session already found.
    if (lastUnit !== 'px' && newUnit !== 'px') {
      const oldFactor = UNIT_TO_MM[lastUnit], newFactor = UNIT_TO_MM[newUnit];
      ctrl('num-width').value = round4(val('num-width') * oldFactor / newFactor);
      ctrl('num-height').value = round4(val('num-height') * oldFactor / newFactor);
    }
  }
  lastUnit = newUnit;
  syncUnitRows();
  build();
}
function round4(n) { return Math.round(n * 10000) / 10000; }

// ── Grid params (per-generator blocks, same show/hide pattern as
// Warping's syncConditionalRows) ──
const SOLVER_LABELS = { kiwi: 'Kiwi constraint solver', parametric: 'Direct parametric math', geometric: 'Geometric (half-plane clip)' };
function syncGeneratorRows() {
  const type = ctrl('sel-gridtype').value;
  ctrl('block-bento').style.display = type === 'bento' ? '' : 'none';
  ctrl('block-sinusoidal').style.display = type === 'sinusoidal' ? '' : 'none';
  ctrl('block-voronoi').style.display = type === 'voronoi' ? '' : 'none';
  // Padding has no defined meaning on a polygon cell yet (voronoi.js's own
  // header) — hidden rather than left as a dead control that visibly does
  // nothing, same rule Komorebi's own control audit already established.
  ctrl('row-padding').style.display = type === 'voronoi' ? 'none' : '';
  ctrl('hint-solver').textContent = SOLVER_LABELS[GENERATORS[type].solver];
}
function readGridParams() {
  const type = ctrl('sel-gridtype').value;
  if (type === 'bento') {
    return {
      cols: Math.round(val('rg-bento-cols')), rows: Math.round(val('rg-bento-rows')),
      variety: val('rg-bento-variety'), gap: unitVal('rg-bento-gap'), seed: Math.round(val('rg-bento-seed')),
    };
  }
  if (type === 'voronoi') {
    return {
      points: Math.round(val('rg-voronoi-points')), seed: Math.round(val('rg-voronoi-seed')),
    };
  }
  return {
    cols: Math.round(val('rg-sin-cols')), rows: Math.round(val('rg-sin-rows')),
    amplitude: val('rg-sin-amp'), frequency: val('rg-sin-freq'), phase: val('rg-sin-phase'),
    axis: seg('seg-sin-axis'), gap: unitVal('rg-sin-gap'),
  };
}
function seg(groupId) { return ctrl(groupId).querySelector('.seg-btn.active').dataset.v; }
function setSeg(groupId, btn) {
  ctrl(groupId).querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
  build();
}

// ── Build — Canvas → Grid Definition → Constraint Engine → JSON Model ──
function build() {
  const canvas = readCanvas();
  const inner = innerRect(canvas);
  const type = ctrl('sel-gridtype').value;
  const generator = GENERATORS[type];
  const params = readGridParams();

  // Kiwi throws (an uncaught exception, not a return value) when a
  // canvas is too small for the current Columns/Rows/Gap combination to
  // satisfy each track's own hard minimum-size constraint — there's no
  // fixed "safe" canvas floor to pre-check against, since the real
  // minimum depends on whatever Columns/Gap/Margin happen to be dialled
  // in. Reproduced live: a physically tiny canvas (e.g. typed while
  // working in m, then the unit switched to px with no conversion — px
  // has no physical equivalent to convert TO, so the raw number is
  // deliberately left as-is) crashed the whole app rather than just
  // failing to render. Caught here so any unreachable combination, not
  // only this one path to it, degrades to a status message instead.
  let grid, cells;
  try {
    ({ grid, cells } = generator.generate(params, inner));
  } catch (err) {
    setStatus('', 'Canvas too small for this grid — increase size or reduce Columns/Rows/Gap');
    return;
  }
  grid.padding = unitVal('rg-padding');   // visual inset per cell, applied post-resolution by every renderer that reads it
  cells.forEach((c, i) => { c.number = i + 1; });   // sequential by default — Shuffle numbers randomises on top of this
  currentModel = buildModel({ canvas, grid, cells });
  currentInner = inner;

  canvasFrame.style.width = canvas.width + 'px';
  canvasFrame.style.height = canvas.height + 'px';
  fitToViewIfNeeded(canvas);
  paintGridDOM(previewEl, currentModel, inner, GUIDE_COLOR);
  paintGuides(canvas, inner);
  if (ctrl('ck-json-view').checked) paintJSON();

  setStatus('active', `${generator.label} · ${cells.length} cells · ${grid.solver}`);
}

function paintGuides(canvas, inner) {
  const safe = safeAreaRect(canvas);
  ctrl('guide-margin').style.cssText =
    `left:${inner.x}px; top:${inner.y}px; width:${inner.width}px; height:${inner.height}px;`;
  ctrl('guide-safe').style.cssText =
    `left:${safe.x}px; top:${safe.y}px; width:${safe.width}px; height:${safe.height}px;`;
}

function paintJSON() {
  ctrl('json-view').textContent = JSON.stringify(currentModel, null, 2);
}
function toggleJSONView() {
  ctrl('json-panel').style.display = ctrl('ck-json-view').checked ? '' : 'none';
  if (ctrl('ck-json-view').checked) paintJSON();
}

// ── Numbering — which block shows which number. Independent of col/row/
// span (the actual layout), so shuffling never touches the model's real
// geometry, only the label each cell happens to display. Resets to
// sequential on the next rebuild (any panel change re-runs build(), which
// re-generates cells from scratch) — a deliberate simplification: the
// shuffle is a one-off action on the CURRENT grid, not a persisted param.
function shuffleNumbers() {
  if (!currentModel) return;
  const numbers = currentModel.cells.map(c => c.number);
  // Fisher–Yates — uniform, not the classic biased "sort by Math.random()".
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  currentModel.cells.forEach((c, i) => { c.number = numbers[i]; });
  paintGridDOM(previewEl, currentModel, currentInner, GUIDE_COLOR);
  if (ctrl('ck-json-view').checked) paintJSON();
  setStatus('active', 'Numbers shuffled');
}
function sequentialNumbers() {
  if (!currentModel) return;
  currentModel.cells.forEach((c, i) => { c.number = i + 1; });
  paintGridDOM(previewEl, currentModel, currentInner, GUIDE_COLOR);
  if (ctrl('ck-json-view').checked) paintJSON();
  setStatus('active', 'Numbers reset');
}

// ── Export ──
function exportPNG() {
  const c = renderRaster(currentModel, currentInner, parseInt(ctrl('sel-scale').value, 10) || 2, GUIDE_COLOR);
  const url = c.toDataURL('image/png');
  const bin = atob(url.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  Organica.download(new Blob([bytes], { type: 'image/png' }), Organica.stamp('loom', 'png'));
  setStatus('active', 'PNG saved');
}
function buildSVGString() {
  return renderSVG(currentModel, currentInner, GUIDE_COLOR);
}
function exportSVG() {
  Organica.download(new Blob([buildSVGString()], { type: 'image/svg+xml' }), Organica.stamp('loom', 'svg'));
  setStatus('active', 'SVG saved');
}
function exportHTML() {
  const html = buildHTMLSnippet(currentModel, currentInner, GUIDE_COLOR);
  Organica.download(new Blob([html], { type: 'text/html' }), Organica.stamp('loom', 'html'));
  setStatus('active', 'HTML snippet saved');
}
function exportJSON() {
  Organica.download(new Blob([JSON.stringify(currentModel, null, 2)], { type: 'application/json' }), Organica.stamp('loom', 'json'));
  setStatus('active', 'JSON model saved');
}
function sendToFigma() {
  // Phase 1 reuses the existing shared SVG-import pipeline verbatim — the
  // grid arrives in Figma as vector guides, not yet native Auto Layout
  // frames. Auto Layout frame generation (figma.createFrame with
  // layoutMode, Create Layout Grids, nested Auto Layout, roundtrip
  // editing) is Phase 5, per docs/LOOM.md's own roadmap — this button is
  // real and working today, just not yet the Phase-5 depth the brief asks
  // for eventually.
  Organica.sendToFigma(buildSVGString(), 'Loom');
  setStatus('active', 'Sent to Figma plugin ↗ (vector guides — native Auto Layout frames land in Phase 5)');
}

// ── ZOOM / PAN — mouse wheel over the canvas, same shared behaviour as
// every other Organica tool (Organica.createZoomPan: wheel zooms toward
// the cursor, drag pans once zoomed, dblclick/Reset returns to 100%,
// Cmd/Ctrl +/-/0 as keyboard shortcuts). Zooming is a pure CSS transform
// on #canvas-frame — it never touches canvas.width/height or the model,
// so it can't affect any export. ──
const zoomPan = Organica.createZoomPan({
  canvas: canvasFrame,
  wrap: ctrl('canvas-wrap'),
  // 0.01, not 0.1: with cm/m units a canvas can be metres wide — canonical
  // mm-equivalents in the tens of thousands — and createZoomPan has a
  // sharp edge at its own minimum: when a requested zoom clamps EXACTLY
  // to `min`, it zeroes pan outright (its own "back to a clean state"
  // shortcut), which fitToViewIfNeeded's own reset()+zoomBy(scale) hits
  // whenever the fit scale it wants is below `min`. At the old min:0.1, a
  // 10.8m canvas (a bare Width/Height number carried over from a px/mm
  // canvas, now reinterpreted in cm/m) needed ~0.05 to fit, clamped to
  // 0.1, and the resulting zeroed pan left the whole canvas off-screen —
  // reproduced live via getBoundingClientRect() landing at x:-5087,
  // y:-4908. 0.01 covers real canvases up to ~50–100m before the same
  // edge case could recur.
  min: 0.01,
  onChange: ({ zoom, zoomed }) => {
    ctrl('zoom-level').textContent = Math.round(zoom * 100) + '%';
    ctrl('zoom-hud').classList.toggle('visible', zoomed);
    canvasFrame.classList.toggle('zoomed', zoomed);
  },
});
function resetZoom() { zoomPan.reset(); }

// Re-fit whenever the canvas's own physical size changes (not on every
// param tweak) — a freshly picked A4/social preset should land fully
// visible, not clipped by #canvas-wrap's overflow:hidden.
let lastFitKey = '';
function fitToViewIfNeeded(canvas) {
  const key = canvas.width + 'x' + canvas.height;
  if (key === lastFitKey) return;
  lastFitKey = key;
  const wrap = ctrl('canvas-wrap');
  const availW = wrap.clientWidth - 64, availH = wrap.clientHeight - 64;
  const scale = Math.min(1, availW / canvas.width, availH / canvas.height);
  zoomPan.reset();
  if (scale < 0.999) zoomPan.zoomBy(scale);
}

// ── INIT ──
populateCanvasPresets();
syncUnitRows();
syncGeneratorRows();
window.build = build;
window.applyCanvasPreset = applyCanvasPreset;
window.syncUnitRows = syncUnitRows;
window.onUnitChange = onUnitChange;
window.syncGeneratorRows = syncGeneratorRows;
window.setSeg = setSeg;
window.toggleJSONView = toggleJSONView;
window.exportPNG = exportPNG;
window.exportSVG = exportSVG;
window.exportHTML = exportHTML;
window.exportJSON = exportJSON;
window.sendToFigma = sendToFigma;
window.resetZoom = resetZoom;
window.shuffleNumbers = shuffleNumbers;
window.sequentialNumbers = sequentialNumbers;

Organica.popover(ctrl('btn-export'), ctrl('export-popover'));
Organica.autoLabelPanel(document);
Organica.enhanceSliders(document);
// Live numeric readout for every slider — generic, not one hand-typed
// oninput="syncVal(...)" per control (that's how this bug happened in the
// first place: the Grid section's 13 sliders never got wired, so dragging
// any of them silently left the displayed number frozen at its initial
// HTML value while the grid itself rebuilt correctly underneath — caught
// by testing, not by reading the markup). Fixed once for the whole panel,
// present and future sliders alike, same discipline as autoLabelPanel.
ctrl('panel').addEventListener('input', e => {
  if (!e.target.matches('input[type=range]')) return;
  const valEl = e.target.closest('.ctrl-row')?.querySelector('.ctrl-val');
  if (valEl) valEl.textContent = e.target.value;
});
ctrl('panel').addEventListener('input', build);
ctrl('panel').addEventListener('change', build);
build();
setStatus('active', 'Ready');
