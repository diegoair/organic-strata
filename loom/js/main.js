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
  rescaleUnitField('rg-noise-gap', 'gap', oldUnit, newUnit);
  rescaleUnitField('rg-col-gap', 'gap', oldUnit, newUnit);
  rescaleUnitField('rg-row-gap', 'gap', oldUnit, newUnit);
  rescaleUnitField('rg-mod-gap', 'gap', oldUnit, newUnit);
  rescaleUnitField('rg-rect-gap', 'gap', oldUnit, newUnit);
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
  ctrl('block-hexagonal').style.display = type === 'hexagonal' ? '' : 'none';
  ctrl('block-radial').style.display = type === 'radial' ? '' : 'none';
  ctrl('block-triangular').style.display = type === 'triangular' ? '' : 'none';
  ctrl('block-diamond').style.display = type === 'diamond' ? '' : 'none';
  ctrl('block-circular').style.display = type === 'circular' ? '' : 'none';
  ctrl('block-noise').style.display = type === 'noise' ? '' : 'none';
  ctrl('block-column').style.display = type === 'column' ? '' : 'none';
  ctrl('block-row').style.display = type === 'row' ? '' : 'none';
  ctrl('block-modular').style.display = type === 'modular' ? '' : 'none';
  ctrl('block-rectangular').style.display = type === 'rectangular' ? '' : 'none';
  ctrl('block-diagonal').style.display = type === 'diagonal' ? '' : 'none';
  ctrl('block-angular').style.display = type === 'angular' ? '' : 'none';
  ctrl('block-polar').style.display = type === 'polar' ? '' : 'none';
  ctrl('block-elliptical').style.display = type === 'elliptical' ? '' : 'none';
  ctrl('block-masonry').style.display = type === 'masonry' ? '' : 'none';
  ctrl('block-fractal').style.display = type === 'fractal' ? '' : 'none';
  ctrl('block-recursive').style.display = type === 'recursive' ? '' : 'none';
  ctrl('block-organic').style.display = type === 'organic' ? '' : 'none';
  ctrl('block-spiral').style.display = type === 'spiral' ? '' : 'none';
  // Padding has no defined meaning on a polygon cell yet (voronoi.js's own
  // header) — hidden rather than left as a dead control that visibly does
  // nothing, same rule Komorebi's own control audit already established.
  ctrl('row-padding').style.display = ['voronoi', 'hexagonal', 'radial', 'triangular', 'diamond', 'circular', 'diagonal', 'angular', 'polar', 'elliptical', 'masonry', 'fractal', 'recursive', 'organic', 'spiral'].includes(type) ? 'none' : '';
  ctrl('hint-solver').textContent = SOLVER_LABELS[GENERATORS[type].solver];
  if (type === 'hexagonal') syncHexSpinRow();
  if (type === 'triangular') syncTriSpinRow();
  if (type === 'diamond') syncDiaSpinRow();
}
// Spin Amount only means something once a Spin mode other than Off is
// picked — hidden rather than left as a dead control when Off, same rule
// as row-padding/the Voronoi hint above (Komorebi's own control audit).
function syncHexSpinRow() {
  const mode = ctrl('sel-hex-spinmode').value;
  ctrl('row-hex-spinamount').style.display = mode === 'off' ? 'none' : '';
  ctrl('row-hex-noisescale').style.display = mode === 'noise' ? '' : 'none';
}
// Same idea, Triangular's own Spin block — kept as its own function rather
// than parameterising syncHexSpinRow, matching this file's existing
// per-generator-block pattern (readGridParams' own explicit branches).
function syncTriSpinRow() {
  const mode = ctrl('sel-tri-spinmode').value;
  ctrl('row-tri-spinamount').style.display = mode === 'off' ? 'none' : '';
  ctrl('row-tri-noisescale').style.display = mode === 'noise' ? '' : 'none';
}
// Same idea, Diamond's own Spin block.
function syncDiaSpinRow() {
  const mode = ctrl('sel-dia-spinmode').value;
  ctrl('row-dia-spinamount').style.display = mode === 'off' ? 'none' : '';
  ctrl('row-dia-noisescale').style.display = mode === 'noise' ? '' : 'none';
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
  if (type === 'hexagonal') {
    return {
      cols: Math.round(val('rg-hex-cols')), rotation: val('rg-hex-rotation'),
      spinMode: ctrl('sel-hex-spinmode').value, spinAmount: val('rg-hex-spinamount'),
      noiseScale: val('rg-hex-noisescale'),
      gap: val('rg-hex-gap'), jitter: val('rg-hex-jitter'), seed: Math.round(val('rg-hex-seed')),
    };
  }
  if (type === 'radial') {
    return {
      rings: Math.round(val('rg-radial-rings')), sectors: Math.round(val('rg-radial-sectors')),
      innerRadiusFrac: val('rg-radial-innerradius'), gap: val('rg-radial-gap'),
      startAngle: val('rg-radial-startangle'),
    };
  }
  if (type === 'triangular') {
    return {
      cols: Math.round(val('rg-tri-cols')), rotation: val('rg-tri-rotation'),
      spinMode: ctrl('sel-tri-spinmode').value, spinAmount: val('rg-tri-spinamount'),
      noiseScale: val('rg-tri-noisescale'),
      gap: val('rg-tri-gap'), jitter: val('rg-tri-jitter'), seed: Math.round(val('rg-tri-seed')),
    };
  }
  if (type === 'diamond') {
    return {
      cols: Math.round(val('rg-dia-cols')), rotation: val('rg-dia-rotation'),
      spinMode: ctrl('sel-dia-spinmode').value, spinAmount: val('rg-dia-spinamount'),
      noiseScale: val('rg-dia-noisescale'),
      gap: val('rg-dia-gap'), jitter: val('rg-dia-jitter'), seed: Math.round(val('rg-dia-seed')),
    };
  }
  if (type === 'circular') {
    return {
      cols: Math.round(val('rg-cir-cols')), rotation: val('rg-cir-rotation'),
      gap: val('rg-cir-gap'), jitter: val('rg-cir-jitter'), seed: Math.round(val('rg-cir-seed')),
    };
  }
  if (type === 'noise') {
    return {
      cols: Math.round(val('rg-noise-cols')), rows: Math.round(val('rg-noise-rows')),
      amount: val('rg-noise-amount'), scale: val('rg-noise-scale'),
      axis: seg('seg-noise-axis'), seed: Math.round(val('rg-noise-seed')), gap: unitVal('rg-noise-gap'),
    };
  }
  if (type === 'column') {
    return { count: Math.round(val('rg-col-count')), gap: unitVal('rg-col-gap') };
  }
  if (type === 'row') {
    return { count: Math.round(val('rg-row-count')), gap: unitVal('rg-row-gap') };
  }
  if (type === 'modular') {
    return {
      cols: Math.round(val('rg-mod-cols')), rows: Math.round(val('rg-mod-rows')),
      gap: unitVal('rg-mod-gap'),
    };
  }
  if (type === 'rectangular') {
    return {
      colWeights: ctrl('txt-rect-colweights').value,
      rowWeights: ctrl('txt-rect-rowweights').value,
      gap: unitVal('rg-rect-gap'),
    };
  }
  if (type === 'diagonal') {
    return {
      count: Math.round(val('rg-diag-count')), angle: val('rg-diag-angle'), skew: val('rg-diag-skew'),
      gap: val('rg-diag-gap'), jitter: val('rg-diag-jitter'), seed: Math.round(val('rg-diag-seed')),
    };
  }
  if (type === 'angular') {
    return {
      sectors: Math.round(val('rg-ang-sectors')), startAngle: val('rg-ang-startangle'),
      centerX: val('rg-ang-centerx'), centerY: val('rg-ang-centery'), gap: val('rg-ang-gap'),
    };
  }
  if (type === 'polar') {
    return {
      rings: Math.round(val('rg-pol-rings')), sectors: Math.round(val('rg-pol-sectors')),
      innerRadiusFrac: val('rg-pol-innerradius'), gap: val('rg-pol-gap'),
      startAngle: val('rg-pol-startangle'), curve: val('rg-pol-curve'),
    };
  }
  if (type === 'elliptical') {
    return {
      rings: Math.round(val('rg-ell-rings')), sectors: Math.round(val('rg-ell-sectors')),
      innerRadiusFrac: val('rg-ell-innerradius'), gap: val('rg-ell-gap'),
      startAngle: val('rg-ell-startangle'),
    };
  }
  if (type === 'masonry') {
    return {
      cols: Math.round(val('rg-mas-cols')), minHeight: val('rg-mas-minheight'), maxHeight: val('rg-mas-maxheight'),
      gap: unitVal('rg-mas-gap'), seed: Math.round(val('rg-mas-seed')),
    };
  }
  if (type === 'fractal') {
    return {
      depth: Math.round(val('rg-frac-depth')), variance: val('rg-frac-variance'),
      gap: unitVal('rg-frac-gap'), seed: Math.round(val('rg-frac-seed')),
    };
  }
  if (type === 'recursive') {
    return {
      depth: Math.round(val('rg-rec-depth')), variance: val('rg-rec-variance'),
      gap: unitVal('rg-rec-gap'), seed: Math.round(val('rg-rec-seed')),
    };
  }
  if (type === 'organic') {
    return {
      points: Math.round(val('rg-org-points')), iterations: Math.round(val('rg-org-iterations')),
      seed: Math.round(val('rg-org-seed')),
    };
  }
  if (type === 'spiral') {
    return {
      count: Math.round(val('rg-spi-count')), ratio: val('rg-spi-ratio'), gap: unitVal('rg-spi-gap'),
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
  syncCanvasOverlays();
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

// Three preview-only verification aids (§ user request) — none of them
// touch the model or any export, all three are pure #canvas-frame CSS
// state, kept in sync with the current canvas here in one place rather
// than scattered across build()'s own render calls.
function syncCanvasOverlays() {
  canvasFrame.classList.toggle('preview-fill', ctrl('ck-preview-fill').checked);
  canvasFrame.classList.toggle('hide-numbers', !ctrl('ck-show-numbers').checked);
  const bgGridOn = ctrl('ck-bg-grid').checked;
  const bgGrid = ctrl('guide-bg-grid');
  bgGrid.classList.toggle('visible', bgGridOn);
  if (bgGridOn && currentModel) {
    // 12 divisions across the canvas's own width — a plain reference
    // reticle sized off the canvas's own dimensions, same "derive from
    // the physical space, don't hardcode a pixel count" reasoning as
    // every other canvas-relative control in this tool (Hexagonal's own
    // Columns density, Radial's outer radius, etc.).
    const spacing = currentModel.canvas.width / 12;
    bgGrid.style.backgroundImage =
      `repeating-linear-gradient(to right, rgba(10,10,10,0.06) 0, rgba(10,10,10,0.06) 1px, transparent 1px, transparent ${spacing}px),` +
      `repeating-linear-gradient(to bottom, rgba(10,10,10,0.06) 0, rgba(10,10,10,0.06) 1px, transparent 1px, transparent ${spacing}px)`;
  }
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

// ── Save grid — named presets in the SAME shared store every other
// Organica tool's own presets use (Organica.presetStore), so the exact
// JSON another tool later reads via Organica.loadLoomGrid() is available
// cross-tool for free, not a Loom-only mechanism. Each preset stores the
// full model (buildModel()'s own output) — the single source of truth
// this file's own header already insists on, so "load" is exact, not an
// approximation reconstructed from separate fields. ──
const gridPresetStore = Organica.presetStore('loom');

// Phase 3's other five list items (Swiss, Golden Ratio, Rule of Thirds,
// Timeline, Isometric) turned out to need no new generator code at all —
// each is a specific, named parameter set on a generator that already
// exists (registry.js's own header explains the split). Shipped as
// read-only built-ins, same convention as Komorebi/Camo Turing/Warping's
// own BUILTIN_PRESETS: merged with the user's own saved grids in the
// dropdown, blocked from Delete. Minimal model shape — only the fields
// loadGridPreset() actually reads (canvas.displayWidth/Height/unit/
// margin/safeArea, grid.type/params/padding); tracks/cells are always
// re-derived by build(), never stored redundantly here.
const BUILTIN_GRID_PRESETS = {
  'Swiss': {
    canvas: { displayWidth: 1080, displayHeight: 1080, unit: 'px', margin: 6, safeArea: 0 },
    grid: { type: 'modular', params: { cols: 6, rows: 10, gap: 8 }, padding: 0 },
  },
  'Golden Ratio': {
    canvas: { displayWidth: 1080, displayHeight: 680, unit: 'px', margin: 4, safeArea: 0 },
    grid: { type: 'spiral', params: { count: 8, ratio: 0.382, gap: 0 }, padding: 0 },
  },
  'Rule of Thirds': {
    canvas: { displayWidth: 1080, displayHeight: 1080, unit: 'px', margin: 0, safeArea: 0 },
    grid: { type: 'modular', params: { cols: 3, rows: 3, gap: 0 }, padding: 0 },
  },
  'Timeline': {
    canvas: { displayWidth: 1600, displayHeight: 260, unit: 'px', margin: 4, safeArea: 0 },
    grid: { type: 'column', params: { count: 16, gap: 6 }, padding: 0 },
  },
  'Isometric': {
    canvas: { displayWidth: 1080, displayHeight: 1080, unit: 'px', margin: 4, safeArea: 0 },
    grid: { type: 'diagonal', params: { count: 10, angle: 30, skew: 60, gap: 0.04, jitter: 0, seed: 7 }, padding: 0 },
  },
};
function allGridPresets() { return Object.assign({}, BUILTIN_GRID_PRESETS, gridPresetStore.read()); }

function populateSavedGrids() {
  const sel = ctrl('sel-saved-grids');
  const cur = sel.value;
  const presets = allGridPresets();
  sel.innerHTML = '<option value="">Load saved…</option>';
  Object.keys(presets).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
  if (presets[cur]) sel.value = cur;
}
function saveGridPreset() {
  const name = ctrl('txt-save-name').value.trim();
  if (!name) { setStatus('', 'Name the grid before saving'); return; }
  if (BUILTIN_GRID_PRESETS[name]) { setStatus('', 'That name is a built-in preset — pick another'); return; }
  if (!currentModel) return;
  const presets = gridPresetStore.read();
  presets[name] = currentModel;
  if (!gridPresetStore.write(presets)) { setStatus('', 'Could not save — storage full or unavailable'); return; }
  ctrl('txt-save-name').value = '';
  populateSavedGrids();
  ctrl('sel-saved-grids').value = name;
  setStatus('active', `Saved "${name}"`);
}
function deleteGridPreset() {
  const name = ctrl('sel-saved-grids').value;
  if (!name) return;
  if (BUILTIN_GRID_PRESETS[name]) { setStatus('', 'Built-in presets cannot be deleted'); return; }
  const presets = gridPresetStore.read();
  delete presets[name];
  gridPresetStore.write(presets);
  populateSavedGrids();
  setStatus('active', `Deleted "${name}"`);
}

// Per-generator param-key → control-id mapping, the mirror image of
// readGridParams()'s own explicit per-type branches — deliberately
// explicit per generator rather than a naming-convention guesser, same
// reasoning readGridParams already follows (a few irregular abbreviations
// — Sinusoidal's amp/freq, Radial's innerradius/startangle — would make a
// generic mapper either wrong or its own pile of special cases anyway).
function applyGridParamsToUI(type, params) {
  ctrl('sel-gridtype').value = type;
  const setR = (id, v) => { if (v != null) ctrl(id).value = v; };
  const setS = (id, v) => { if (v != null) ctrl(id).value = v; };
  if (type === 'bento') {
    setR('rg-bento-cols', params.cols); setR('rg-bento-rows', params.rows);
    setR('rg-bento-variety', params.variety); setR('rg-bento-gap', params.gap); setR('rg-bento-seed', params.seed);
  } else if (type === 'sinusoidal') {
    setR('rg-sin-cols', params.cols); setR('rg-sin-rows', params.rows);
    setR('rg-sin-amp', params.amplitude); setR('rg-sin-freq', params.frequency); setR('rg-sin-phase', params.phase);
    setR('rg-sin-gap', params.gap);
    if (params.axis) setSegValue('seg-sin-axis', params.axis);
  } else if (type === 'voronoi') {
    setR('rg-voronoi-points', params.points); setR('rg-voronoi-seed', params.seed);
  } else if (type === 'hexagonal') {
    setR('rg-hex-cols', params.cols); setR('rg-hex-rotation', params.rotation);
    setS('sel-hex-spinmode', params.spinMode); setR('rg-hex-spinamount', params.spinAmount);
    setR('rg-hex-noisescale', params.noiseScale);
    setR('rg-hex-gap', params.gap); setR('rg-hex-jitter', params.jitter); setR('rg-hex-seed', params.seed);
    syncHexSpinRow();
  } else if (type === 'radial') {
    setR('rg-radial-rings', params.rings); setR('rg-radial-sectors', params.sectors);
    setR('rg-radial-innerradius', params.innerRadiusFrac); setR('rg-radial-gap', params.gap);
    setR('rg-radial-startangle', params.startAngle);
  } else if (type === 'triangular') {
    setR('rg-tri-cols', params.cols); setR('rg-tri-rotation', params.rotation);
    setS('sel-tri-spinmode', params.spinMode); setR('rg-tri-spinamount', params.spinAmount);
    setR('rg-tri-noisescale', params.noiseScale);
    setR('rg-tri-gap', params.gap); setR('rg-tri-jitter', params.jitter); setR('rg-tri-seed', params.seed);
    syncTriSpinRow();
  } else if (type === 'diamond') {
    setR('rg-dia-cols', params.cols); setR('rg-dia-rotation', params.rotation);
    setS('sel-dia-spinmode', params.spinMode); setR('rg-dia-spinamount', params.spinAmount);
    setR('rg-dia-noisescale', params.noiseScale);
    setR('rg-dia-gap', params.gap); setR('rg-dia-jitter', params.jitter); setR('rg-dia-seed', params.seed);
    syncDiaSpinRow();
  } else if (type === 'circular') {
    setR('rg-cir-cols', params.cols); setR('rg-cir-rotation', params.rotation);
    setR('rg-cir-gap', params.gap); setR('rg-cir-jitter', params.jitter); setR('rg-cir-seed', params.seed);
  } else if (type === 'noise') {
    setR('rg-noise-cols', params.cols); setR('rg-noise-rows', params.rows);
    setR('rg-noise-amount', params.amount); setR('rg-noise-scale', params.scale);
    setR('rg-noise-seed', params.seed); setR('rg-noise-gap', params.gap);
    if (params.axis) setSegValue('seg-noise-axis', params.axis);
  } else if (type === 'column') {
    setR('rg-col-count', params.count); setR('rg-col-gap', params.gap);
  } else if (type === 'row') {
    setR('rg-row-count', params.count); setR('rg-row-gap', params.gap);
  } else if (type === 'modular') {
    setR('rg-mod-cols', params.cols); setR('rg-mod-rows', params.rows); setR('rg-mod-gap', params.gap);
  } else if (type === 'rectangular') {
    if (params.colWeights != null) ctrl('txt-rect-colweights').value = params.colWeights;
    if (params.rowWeights != null) ctrl('txt-rect-rowweights').value = params.rowWeights;
    setR('rg-rect-gap', params.gap);
  } else if (type === 'diagonal') {
    setR('rg-diag-count', params.count); setR('rg-diag-angle', params.angle); setR('rg-diag-skew', params.skew);
    setR('rg-diag-gap', params.gap); setR('rg-diag-jitter', params.jitter); setR('rg-diag-seed', params.seed);
  } else if (type === 'angular') {
    setR('rg-ang-sectors', params.sectors); setR('rg-ang-startangle', params.startAngle);
    setR('rg-ang-centerx', params.centerX); setR('rg-ang-centery', params.centerY); setR('rg-ang-gap', params.gap);
  } else if (type === 'polar') {
    setR('rg-pol-rings', params.rings); setR('rg-pol-sectors', params.sectors);
    setR('rg-pol-innerradius', params.innerRadiusFrac); setR('rg-pol-gap', params.gap);
    setR('rg-pol-startangle', params.startAngle); setR('rg-pol-curve', params.curve);
  } else if (type === 'elliptical') {
    setR('rg-ell-rings', params.rings); setR('rg-ell-sectors', params.sectors);
    setR('rg-ell-innerradius', params.innerRadiusFrac); setR('rg-ell-gap', params.gap);
    setR('rg-ell-startangle', params.startAngle);
  } else if (type === 'masonry') {
    setR('rg-mas-cols', params.cols); setR('rg-mas-minheight', params.minHeight);
    setR('rg-mas-maxheight', params.maxHeight); setR('rg-mas-gap', params.gap); setR('rg-mas-seed', params.seed);
  } else if (type === 'fractal') {
    setR('rg-frac-depth', params.depth); setR('rg-frac-variance', params.variance);
    setR('rg-frac-gap', params.gap); setR('rg-frac-seed', params.seed);
  } else if (type === 'recursive') {
    setR('rg-rec-depth', params.depth); setR('rg-rec-variance', params.variance);
    setR('rg-rec-gap', params.gap); setR('rg-rec-seed', params.seed);
  } else if (type === 'organic') {
    setR('rg-org-points', params.points); setR('rg-org-iterations', params.iterations); setR('rg-org-seed', params.seed);
  } else if (type === 'spiral') {
    setR('rg-spi-count', params.count); setR('rg-spi-ratio', params.ratio); setR('rg-spi-gap', params.gap);
  }
  // Live numeric readouts (the delegated panel listener only fires on a
  // real user `input` event, not a programmatic .value set) — sync every
  // slider's own displayed number to match what was just loaded.
  ctrl('panel').querySelectorAll('input[type=range]').forEach(r => {
    const valEl = r.closest('.ctrl-row')?.querySelector('.ctrl-val');
    if (valEl) valEl.textContent = r.value;
  });
}
function setSegValue(groupId, value) {
  ctrl(groupId).querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.v === value));
}
function loadGridPreset() {
  const name = ctrl('sel-saved-grids').value;
  if (!name) return;
  const presets = allGridPresets();
  const model = presets[name];
  if (!model) return;
  ctrl('num-width').value = model.canvas.displayWidth;
  ctrl('num-height').value = model.canvas.displayHeight;
  ctrl('sel-unit').value = model.canvas.unit;
  lastUnit = model.canvas.unit;
  ctrl('rg-margin').value = model.canvas.margin;
  ctrl('rg-safearea').value = model.canvas.safeArea;
  if (model.canvas.bleed) ctrl('num-bleed').value = model.canvas.bleed;
  syncUnitRows();
  applyGridParamsToUI(model.grid.type, model.grid.params || {});
  syncGeneratorRows();
  if (model.grid.padding != null) ctrl('rg-padding').value = model.grid.padding;
  build();
  setStatus('active', `Loaded "${name}"`);
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
  const wrap = ctrl('canvas-wrap');
  const availW = wrap.clientWidth - 64, availH = wrap.clientHeight - 64;
  // The very first build() runs synchronously at module init, before the
  // panel's own layout has necessarily settled — caught live: canvas-wrap
  // measured a clientWidth small enough that availW went negative, which
  // fed a negative scale into zoomBy and landed on the zoom floor (1%,
  // fully off-screen) on every fresh load, not just Hexagonal/Spin.
  // Retrying on the next frame (without committing lastFitKey yet) instead
  // of fitting to garbage dimensions fixes this without guessing a delay.
  if (availW <= 0 || availH <= 0) {
    requestAnimationFrame(() => fitToViewIfNeeded(canvas));
    return;
  }
  lastFitKey = key;
  const scale = Math.min(1, availW / canvas.width, availH / canvas.height);
  zoomPan.reset();
  if (scale < 0.999) zoomPan.zoomBy(scale);
}

// ── INIT ──
populateCanvasPresets();
syncUnitRows();
syncGeneratorRows();
populateSavedGrids();
window.saveGridPreset = saveGridPreset;
window.deleteGridPreset = deleteGridPreset;
window.loadGridPreset = loadGridPreset;
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
window.syncHexSpinRow = syncHexSpinRow;
window.syncTriSpinRow = syncTriSpinRow;
window.syncDiaSpinRow = syncDiaSpinRow;
window.syncCanvasOverlays = syncCanvasOverlays;

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
