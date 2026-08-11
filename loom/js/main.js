/* ─────────────────────────────────────────────────────────────
   Loom — Universal Grid Generator. Phase 1 MVP: Canvas Manager, two
   generators (Bento / Sinusoidal — brief's own "one simple, one complex"
   pairing), Universal JSON Model, three renderers (live CSS Grid / SVG /
   raster PNG) + JSON export, Figma via the existing shared SVG pipeline.

   THE ONE RULE (same as every other Organica tool): one build() function
   produces the model, every renderer/export reads that SAME model. No
   renderer is allowed to recompute geometry its own way.
   ───────────────────────────────────────────────────────────── */

import { CANVAS_PRESETS, createCanvas, innerRect, safeAreaRect } from './canvas-manager.js';
import { buildModel, resolveCellRects } from './json-model.js';
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
  ctrl('num-width').value = p.width;
  ctrl('num-height').value = p.height;
  ctrl('sel-unit').value = p.unit;
  syncUnitRows();
  build();
}
function syncUnitRows() {
  ctrl('row-bleed').style.display = ctrl('sel-unit').value === 'mm' ? '' : 'none';
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

// ── Grid params (per-generator blocks, same show/hide pattern as
// Warping's syncConditionalRows) ──
function syncGeneratorRows() {
  const type = ctrl('sel-gridtype').value;
  ctrl('block-bento').style.display = type === 'bento' ? '' : 'none';
  ctrl('block-sinusoidal').style.display = type === 'sinusoidal' ? '' : 'none';
  ctrl('hint-solver').textContent = GENERATORS[type].solver === 'kiwi'
    ? 'Kiwi constraint solver'
    : 'Direct parametric math';
}
function readGridParams() {
  const type = ctrl('sel-gridtype').value;
  if (type === 'bento') {
    return {
      cols: Math.round(val('rg-bento-cols')), rows: Math.round(val('rg-bento-rows')),
      variety: val('rg-bento-variety'), gap: val('rg-bento-gap'), seed: Math.round(val('rg-bento-seed')),
    };
  }
  return {
    cols: Math.round(val('rg-sin-cols')), rows: Math.round(val('rg-sin-rows')),
    amplitude: val('rg-sin-amp'), frequency: val('rg-sin-freq'), phase: val('rg-sin-phase'),
    axis: seg('seg-sin-axis'), gap: val('rg-sin-gap'),
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

  const { grid, cells } = generator.generate(params, inner);
  cells.forEach((c, i) => { c.number = i + 1; });   // sequential by default — Shuffle numbers randomises on top of this
  currentModel = buildModel({ canvas, grid, cells });
  currentInner = inner;

  canvasFrame.style.width = canvas.width + 'px';
  canvasFrame.style.height = canvas.height + 'px';
  fitToViewIfNeeded(canvas);
  paintGridDOM(previewEl, currentModel);
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
  paintGridDOM(previewEl, currentModel);
  if (ctrl('ck-json-view').checked) paintJSON();
  setStatus('active', 'Numbers shuffled');
}
function sequentialNumbers() {
  if (!currentModel) return;
  currentModel.cells.forEach((c, i) => { c.number = i + 1; });
  paintGridDOM(previewEl, currentModel);
  if (ctrl('ck-json-view').checked) paintJSON();
  setStatus('active', 'Numbers reset');
}

// ── Export ──
function exportPNG() {
  const rects = resolveCellRects(currentModel, currentInner);
  const c = renderRaster(currentModel, rects, currentInner, parseInt(ctrl('sel-scale').value, 10) || 2, GUIDE_COLOR);
  const url = c.toDataURL('image/png');
  const bin = atob(url.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  Organica.download(new Blob([bytes], { type: 'image/png' }), Organica.stamp('loom', 'png'));
  setStatus('active', 'PNG saved');
}
function buildSVGString() {
  const rects = resolveCellRects(currentModel, currentInner);
  return renderSVG(currentModel, rects, currentInner, GUIDE_COLOR);
}
function exportSVG() {
  Organica.download(new Blob([buildSVGString()], { type: 'image/svg+xml' }), Organica.stamp('loom', 'svg'));
  setStatus('active', 'SVG saved');
}
function exportHTML() {
  const html = buildHTMLSnippet(currentModel);
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
  min: 0.1,   // canvas can be a large social-format px size or a small
              // print mm size — 1.0 alone isn't guaranteed to fit either
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
