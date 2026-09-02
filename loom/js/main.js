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
import { buildModel, offsets } from './json-model.js';
import { GENERATORS } from './generators/registry.js';
import { renderSVG, cellsMarkup } from './renderers/svg-renderer.js';
import { paintGridDOM, buildHTMLSnippet } from './renderers/html-renderer.js';
import { renderRaster, drawCells } from './renderers/raster-renderer.js';
import { solveTracksKiwiWithEdit } from './constraint-engine.js';

function ctrl(id) { return document.getElementById(id); }
function val(id) { return parseFloat(ctrl(id).value); }

const setStatus = Organica.status();
const previewEl = ctrl('grid-preview');
const canvasFrame = ctrl('canvas-frame');
// Read once from the CSS custom property that .loom-cell's own border
// already uses — SVG/PNG can't drift from the live preview's colour
// since both read this same value, not two hand-matched hex literals.
const GUIDE_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--guide-blue').trim() || '#3399ff';
const OVERLAY_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--overlay-orange').trim() || '#ff6b35';

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
    marginTop: val('rg-margin-top'), marginRight: val('rg-margin-right'),
    marginBottom: val('rg-margin-bottom'), marginLeft: val('rg-margin-left'),
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
  ctrl('block-hexagonal').style.display = type === 'hexagonal' ? '' : 'none';
  ctrl('block-radial').style.display = type === 'radial' ? '' : 'none';
  ctrl('block-triangular').style.display = type === 'triangular' ? '' : 'none';
  ctrl('block-diamond').style.display = type === 'diamond' ? '' : 'none';
  ctrl('block-circular').style.display = type === 'circular' ? '' : 'none';
  ctrl('block-linear').style.display = type === 'linear' ? '' : 'none';
  ctrl('block-rectangular').style.display = type === 'rectangular' ? '' : 'none';
  ctrl('block-diagonal').style.display = type === 'diagonal' ? '' : 'none';
  ctrl('block-angular').style.display = type === 'angular' ? '' : 'none';
  ctrl('block-masonry').style.display = type === 'masonry' ? '' : 'none';
  ctrl('block-fractal').style.display = type === 'fractal' ? '' : 'none';
  ctrl('block-organic').style.display = type === 'organic' ? '' : 'none';
  ctrl('block-spiral').style.display = type === 'spiral' ? '' : 'none';
  // Padding has no defined meaning on a polygon cell yet (voronoi.js's own
  // header) — hidden rather than left as a dead control that visibly does
  // nothing, same rule Komorebi's own control audit already established.
  ctrl('row-padding').style.display = ['hexagonal', 'radial', 'triangular', 'diamond', 'circular', 'diagonal', 'angular', 'masonry', 'fractal', 'organic', 'spiral', 'linear'].includes(type) ? 'none' : '';
  ctrl('hint-solver').textContent = SOLVER_LABELS[GENERATORS[type].solver];
  if (type === 'hexagonal') syncHexSpinRow();
  if (type === 'triangular') syncTriSpinRow();
  if (type === 'diamond') syncDiaSpinRow();
  if (type === 'sinusoidal') syncWaveFnRow();
  // Refreshes the thumbnail-picker trigger for EVERY path that changes
  // sel-gridtype.value, not just the picker's own click handler — the
  // picker click path already updates itself, so this is a harmless
  // no-op re-render there, but it's the only thing that keeps the
  // trigger in sync when the type changes via loadGridPreset() or any
  // future caller of applyGridParamsToUI, since syncGeneratorRows()
  // already runs unconditionally on every real `change` to the select
  // (its own onchange attribute) — one place to keep in sync, not one
  // per caller.
  gridtypePicker.refresh();
  if (type === 'linear') syncLinearAxisRow();
  // Every generator carrying a Distortion control shares the id pattern
  // syncDistortRow() reads — one call covers all of them.
  if (['linear', 'diagonal', 'angular', 'masonry', 'radial'].includes(type)) {
    syncDistortRow(type === 'linear' ? 'lin' : type === 'diagonal' ? 'diag' : type === 'angular' ? 'ang' : type === 'masonry' ? 'mas' : 'radial');
  }
}
// Columns only means something under Axis Columns/Both, Rows only under
// Axis Rows/Both — hidden rather than left as a dead control the other
// axis mode doesn't read, same rule as row-padding/Spin-amount above.
function syncLinearAxisRow() {
  const axis = seg('seg-lin-axis');
  ctrl('row-lin-cols').style.display = (axis === 'rows') ? 'none' : '';
  ctrl('row-lin-rows').style.display = (axis === 'cols') ? 'none' : '';
}
// Distortion's Amount/Frequency show only once a mode is picked (Off
// has nothing for them to affect); Phase only means something for
// Sine (fbm has no phase, same reason Wave hides it for Noise too).
// Generic — every generator that carries a Distortion control (Linear,
// Diagonal, Angular, Radial, Masonry) uses the identical id pattern
// (seg-<prefix>-distort, row-<prefix>-distort-amount/freq/phase), so one
// function serves all of them rather than five near-identical copies.
function syncDistortRow(prefix) {
  const mode = seg('seg-' + prefix + '-distort');
  ctrl('row-' + prefix + '-distort-amount').style.display = mode === 'off' ? 'none' : '';
  ctrl('row-' + prefix + '-distort-freq').style.display = mode === 'off' ? 'none' : '';
  ctrl('row-' + prefix + '-distort-phase').style.display = mode === 'sine' ? '' : 'none';
}

// ── Phase 6 — Randomisation UI. Scoped to the CURRENT generator's own
// `#block-<type>` element only (never Canvas, Padding, or the generator
// type itself) — a predictable "reroll this recipe" action, not a
// surprise grab-bag across unrelated controls. Every control kind in
// every block is handled generically (range/select/segmented/text)
// rather than one randomizer per generator, so a future generator needs
// no changes here to get Randomize for free.
function randomizeParams() {
  const type = ctrl('sel-gridtype').value;
  const block = ctrl('block-' + type);
  if (!block) return;

  block.querySelectorAll('input[type=range]').forEach(r => {
    const min = parseFloat(r.min), max = parseFloat(r.max), step = parseFloat(r.step) || 1;
    const steps = Math.round((max - min) / step);
    const v = min + Math.floor(Math.random() * (steps + 1)) * step;
    r.value = Math.round(v * 1e6) / 1e6;   // clear off float drift from repeated *step
    const valEl = r.closest('.ctrl-row')?.querySelector('.ctrl-val');
    if (valEl) valEl.textContent = r.value;
  });
  block.querySelectorAll('select').forEach(s => {
    const opts = Array.from(s.options);
    s.value = opts[Math.floor(Math.random() * opts.length)].value;
    s.dispatchEvent(new Event('change', { bubbles: true }));   // fires e.g. syncHexSpinRow
  });
  block.querySelectorAll('.seg-ctrl').forEach(seg => {
    const btns = Array.from(seg.querySelectorAll('.seg-btn'));
    const btn = btns[Math.floor(Math.random() * btns.length)];
    btns.forEach(b => b.classList.toggle('active', b === btn));
    if (seg.id === 'seg-lin-axis') syncLinearAxisRow();
    if (seg.id === 'seg-sin-fn') syncWaveFnRow();
    const distortMatch = seg.id.match(/^seg-(.+)-distort$/);
    if (distortMatch) syncDistortRow(distortMatch[1]);
  });
  block.querySelectorAll('input[type=checkbox]').forEach(c => {
    // Radial's Stretch to canvas today — a plain coin-flip.
    c.checked = Math.random() < 0.5;
  });
  block.querySelectorAll('input[type=text]').forEach(t => {
    // Only Rectangular's Column/Row weights today — a plausible random
    // ratio string, same 2–4-number shape as its own default ("2,1,1").
    const n = 2 + Math.floor(Math.random() * 3);
    t.value = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 4)).join(',');
  });

  build();
  setStatus('active', `${GENERATORS[type].label} randomized`);
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
// Wave's Function toggle (Sine/Noise) — Frequency/Phase only mean
// something for Sine, Scale/Seed only for Noise, same conditional-row
// discipline as every Spin-mode row above.
function syncWaveFnRow() {
  const fn = seg('seg-sin-fn');
  ['row-sin-freq', 'row-sin-phase'].forEach(id => { ctrl(id).style.display = fn === 'noise' ? 'none' : ''; });
  ['row-sin-scale', 'row-sin-seed'].forEach(id => { ctrl(id).style.display = fn === 'noise' ? '' : 'none'; });
}
function readGridParams() {
  const type = ctrl('sel-gridtype').value;
  if (type === 'bento') {
    return {
      cols: Math.round(val('rg-bento-cols')), rows: Math.round(val('rg-bento-rows')),
      variety: val('rg-bento-variety'), gap: unitVal('rg-bento-gap'), seed: Math.round(val('rg-bento-seed')),
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
      startAngle: val('rg-radial-startangle'), curve: val('rg-radial-curve'),
      stretch: ctrl('ck-radial-stretch').checked, seed: Math.round(val('rg-radial-seed')),
      distortMode: seg('seg-radial-distort'), distortAmount: val('rg-radial-distort-amount'),
      distortFrequency: val('rg-radial-distort-freq'), distortPhase: val('rg-radial-distort-phase'),
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
  if (type === 'linear') {
    return {
      cols: Math.round(val('rg-lin-cols')), rows: Math.round(val('rg-lin-rows')),
      axis: seg('seg-lin-axis'), rotation: val('rg-lin-rotation'), jitter: val('rg-lin-jitter'),
      gap: val('rg-lin-gap'), seed: Math.round(val('rg-lin-seed')),
      distortMode: seg('seg-lin-distort'), distortAmount: val('rg-lin-distort-amount'),
      distortFrequency: val('rg-lin-distort-freq'), distortPhase: val('rg-lin-distort-phase'),
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
      distortMode: seg('seg-diag-distort'), distortAmount: val('rg-diag-distort-amount'),
      distortFrequency: val('rg-diag-distort-freq'), distortPhase: val('rg-diag-distort-phase'),
    };
  }
  if (type === 'angular') {
    return {
      sectors: Math.round(val('rg-ang-sectors')), startAngle: val('rg-ang-startangle'),
      centerX: val('rg-ang-centerx'), centerY: val('rg-ang-centery'), gap: val('rg-ang-gap'),
      seed: Math.round(val('rg-ang-seed')),
      distortMode: seg('seg-ang-distort'), distortAmount: val('rg-ang-distort-amount'),
      distortFrequency: val('rg-ang-distort-freq'), distortPhase: val('rg-ang-distort-phase'),
    };
  }
  if (type === 'masonry') {
    return {
      cols: Math.round(val('rg-mas-cols')), minHeight: val('rg-mas-minheight'), maxHeight: val('rg-mas-maxheight'),
      gap: unitVal('rg-mas-gap'), seed: Math.round(val('rg-mas-seed')),
      distortMode: seg('seg-mas-distort'), distortAmount: val('rg-mas-distort-amount'),
      distortFrequency: val('rg-mas-distort-freq'), distortPhase: val('rg-mas-distort-phase'),
    };
  }
  if (type === 'fractal') {
    return {
      depth: Math.round(val('rg-frac-depth')), variance: val('rg-frac-variance'),
      axisMode: seg('seg-frac-axismode'),
      gap: unitVal('rg-frac-gap'), seed: Math.round(val('rg-frac-seed')),
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
  // Wave — fallback branch (also the default generator on fresh load).
  return {
    cols: Math.round(val('rg-sin-cols')), rows: Math.round(val('rg-sin-rows')),
    fn: seg('seg-sin-fn'), amount: val('rg-sin-amount'),
    frequency: val('rg-sin-freq'), phase: val('rg-sin-phase'),
    scale: val('rg-sin-scale'), seed: Math.round(val('rg-sin-seed')),
    axis: seg('seg-sin-axis'), gap: unitVal('rg-sin-gap'),
  };
}
function seg(groupId) { return ctrl(groupId).querySelector('.seg-btn.active').dataset.v; }
function setSeg(groupId, btn) {
  ctrl(groupId).querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
  if (groupId === 'seg-lin-axis') syncLinearAxisRow();
  if (groupId === 'seg-sin-fn') syncWaveFnRow();
  const distortMatch = groupId.match(/^seg-(.+)-distort$/);
  if (distortMatch) syncDistortRow(distortMatch[1]);
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
  renderOverlay();
  dragState = null;   // a full rebuild always discards any in-progress WYSIWYG edit
  renderTrackHandles();
  if (ctrl('ck-json-view').checked) paintJSON();

  setStatus('active', `${generator.label} · ${cells.length} cells · ${grid.solver}`);
}

// ── Phase 4 — WYSIWYG track drag-to-resize. Only rect-cellShape
// generators (Bento/Modular — Kiwi; Sinusoidal/Noise/Rectangular —
// parametric) have a single linear track boundary to grab; every
// polygon-cellShape generator has no equivalent (a Voronoi/Hexagonal
// edge is one of many, shared unpredictably between neighbours, not a
// single draggable line the way a track boundary is). Dragging mutates
// `currentModel.grid.tracks` DIRECTLY and repaints — it deliberately
// never calls build(), which would regenerate from params/seed and
// throw the edit away; the cells array (topology/spans) is untouched,
// since a track-size edit never changes which cell owns which span.
// The edit is exactly as real as any other model state: Save grid and
// every export already read `currentModel` as-is, so a dragged layout
// exports correctly with no extra plumbing.
let dragState = null;

function renderTrackHandles() {
  const container = ctrl('track-handles');
  container.innerHTML = '';
  // Rect-lattice generators never set cellShape:'rect' explicitly (only
  // polygon generators set their own flag) — same convention every other
  // cellShape check in this codebase already follows (paintGridDOM etc.),
  // so this checks for the polygon case, not for an explicit 'rect'.
  if (!currentModel || currentModel.grid.cellShape === 'polygon') return;
  const grid = currentModel.grid, inner = currentInner;
  const colOff = offsets(grid.tracks.cols, grid.gap);
  const rowOff = offsets(grid.tracks.rows, grid.gap);
  for (let i = 1; i < grid.tracks.cols.length; i++) {
    const h = document.createElement('div');
    h.className = 'track-handle track-handle--col';
    h.style.left = (inner.x + colOff[i] - grid.gap / 2) + 'px';
    h.dataset.axis = 'cols'; h.dataset.index = i - 1;
    h.addEventListener('pointerdown', onHandlePointerDown);
    container.appendChild(h);
  }
  for (let i = 1; i < grid.tracks.rows.length; i++) {
    const h = document.createElement('div');
    h.className = 'track-handle track-handle--row';
    h.style.top = (inner.y + rowOff[i] - grid.gap / 2) + 'px';
    h.dataset.axis = 'rows'; h.dataset.index = i - 1;
    h.addEventListener('pointerdown', onHandlePointerDown);
    container.appendChild(h);
  }
  if (dragState) {
    const sel = `.track-handle--${dragState.axis === 'cols' ? 'col' : 'row'}[data-index="${dragState.index}"]`;
    container.querySelector(sel)?.classList.add('dragging');
  }
}

function onHandlePointerDown(e) {
  e.preventDefault();
  e.stopPropagation();   // don't also start #canvas-frame's own pan-drag
  const axis = e.currentTarget.dataset.axis;
  const index = parseInt(e.currentTarget.dataset.index, 10);
  const innerSize = axis === 'cols' ? currentInner.width : currentInner.height;
  dragState = {
    axis, index,
    startClientX: e.clientX, startClientY: e.clientY,
    startTracks: currentModel.grid.tracks[axis].slice(),
    innerSize,
    solver: GENERATORS[ctrl('sel-gridtype').value].solver,
  };
  e.currentTarget.classList.add('dragging');
  window.addEventListener('pointermove', onHandlePointerMove);
  window.addEventListener('pointerup', onHandlePointerUp);
}

function onHandlePointerMove(e) {
  if (!dragState) return;
  const { axis, index, startClientX, startClientY, startTracks, innerSize, solver } = dragState;
  const deltaScreen = axis === 'cols' ? (e.clientX - startClientX) : (e.clientY - startClientY);
  const deltaCanvas = deltaScreen / zoomPan.zoom;   // #canvas-frame is CSS-scaled by the current zoom
  const gap = currentModel.grid.gap;
  const count = startTracks.length;
  const minSize = 16;
  const maxSize = innerSize - gap * (count - 1) - minSize * (count - 1);
  const newSize = Math.max(minSize, Math.min(maxSize, startTracks[index] + deltaCanvas));

  let newTracks;
  if (solver === 'kiwi') {
    // The real edit-constraint path: every OTHER track re-solves around
    // this one automatically (constraint-engine.js's own header).
    newTracks = solveTracksKiwiWithEdit(count, innerSize, gap, minSize, index, newSize);
  } else {
    // Parametric generators have no live solver instance to re-suggest —
    // the dragged track is set directly, every other track rescaled
    // proportionally so the sum still fills innerSize exactly, the same
    // normalise-then-rescale discipline solveTracksParametric's own
    // rescale step already applies (just run in reverse, from a fixed
    // point instead of a fixed ratio).
    const otherSum = startTracks.reduce((s, v, i) => i === index ? s : s + v, 0);
    const targetOtherSum = innerSize - gap * (count - 1) - newSize;
    const scale = otherSum > 0 ? targetOtherSum / otherSum : 1;
    newTracks = startTracks.map((v, i) => i === index ? newSize : Math.max(minSize, v * scale));
  }
  currentModel.grid.tracks[axis] = newTracks;
  paintGridDOM(previewEl, currentModel, currentInner, GUIDE_COLOR);
  renderTrackHandles();
  if (ctrl('ck-json-view').checked) paintJSON();
}

function onHandlePointerUp() {
  if (!dragState) return;
  dragState = null;
  window.removeEventListener('pointermove', onHandlePointerMove);
  window.removeEventListener('pointerup', onHandlePointerUp);
  renderTrackHandles();
  setStatus('active', 'Track resized');
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
// Overlay grid gets baked into SVG/PNG exports too — the same two draw
// calls into the same document/canvas the live preview already does with
// two stacked DOM layers, just combined into one flat output file rather
// than kept as two elements. HTML export stays Layer-A-only for now (its
// CSS-Grid path has no absolute-overlay slot the way #canvas-frame does)
// — not attempted this round, scoped down on request to SVG/PNG only.
function exportPNG() {
  const c = renderRaster(currentModel, currentInner, parseInt(ctrl('sel-scale').value, 10) || 2, GUIDE_COLOR);
  const overlayModel = buildOverlayModel();
  if (overlayModel) {
    const ctx = c.getContext('2d');   // same context renderRaster scaled — the transform persists, so overlay draws at the same physical scale for free
    ctx.globalAlpha = parseFloat(ctrl('rg-overlay-opacity').value) || 1;
    drawCells(ctx, overlayModel, currentInner, OVERLAY_COLOR);
    ctx.globalAlpha = 1;
  }
  const url = c.toDataURL('image/png');
  const bin = atob(url.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  Organica.download(new Blob([bytes], { type: 'image/png' }), Organica.stamp('loom', 'png'));
  setStatus('active', 'PNG saved');
}
function overlaySVGGroup() {
  const model = buildOverlayModel();
  if (!model) return '';
  const opacity = ctrl('rg-overlay-opacity').value;
  return `<g opacity="${opacity}">${cellsMarkup(model, currentInner, OVERLAY_COLOR)}</g>`;
}
function buildSVGString() {
  return renderSVG(currentModel, currentInner, GUIDE_COLOR).replace('</svg>', overlaySVGGroup() + '</svg>');
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
  // Swiss/Rule of Thirds/Modular Grid all target Bento at Variety 0 — a
  // plain uniform grid IS Bento with no merging, verified as an exact
  // no-op when Bento shipped, so the removed Modular generator's own
  // exact output stays one click away, just as a preset instead of a
  // fourth registry entry with no other behaviour of its own.
  'Swiss': {
    canvas: { displayWidth: 1080, displayHeight: 1080, unit: 'px', margin: 6, safeArea: 0 },
    grid: { type: 'bento', params: { cols: 6, rows: 10, variety: 0, gap: 8, seed: 7 }, padding: 0 },
  },
  'Golden Ratio': {
    canvas: { displayWidth: 1080, displayHeight: 680, unit: 'px', margin: 4, safeArea: 0 },
    grid: { type: 'spiral', params: { count: 8, ratio: 0.382, gap: 0 }, padding: 0 },
  },
  'Rule of Thirds': {
    canvas: { displayWidth: 1080, displayHeight: 1080, unit: 'px', margin: 0, safeArea: 0 },
    grid: { type: 'bento', params: { cols: 3, rows: 3, variety: 0, gap: 0, seed: 7 }, padding: 0 },
  },
  'Modular Grid': {
    canvas: { displayWidth: 1080, displayHeight: 1080, unit: 'px', margin: 4, safeArea: 0 },
    grid: { type: 'bento', params: { cols: 6, rows: 6, variety: 0, gap: 12, seed: 7 }, padding: 0 },
  },
  'Timeline': {
    canvas: { displayWidth: 1600, displayHeight: 260, unit: 'px', margin: 4, safeArea: 0 },
    grid: { type: 'linear', params: { cols: 16, rows: 1, axis: 'cols', rotation: 0, jitter: 0, gap: 0.04, seed: 7 }, padding: 0 },
  },
  'Isometric': {
    canvas: { displayWidth: 1080, displayHeight: 1080, unit: 'px', margin: 4, safeArea: 0 },
    grid: { type: 'diagonal', params: { count: 10, angle: 30, skew: 60, gap: 0.04, jitter: 0, seed: 7 }, padding: 0 },
  },
};
function allGridPresets() { return Object.assign({}, BUILTIN_GRID_PRESETS, gridPresetStore.read()); }
// Bento/Masonry/Rectangular/Wave's own generate() stores `gap` only at
// `grid.gap` (top-level), not inside its own returned `grid.params` — see
// buildOverlayModel()'s own header for the full reasoning. Restores it
// onto a copy of params for any caller that needs a complete, regenerable
// params object (Load saved grid, Overlay grid) — a no-op for every other
// generator, which already carries `gap` inside `params` itself.
function paramsWithGap(grid) {
  const params = { ...(grid.params || {}) };
  if (params.gap == null && grid.gap != null) params.gap = grid.gap;
  return params;
}

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
  populateOverlayGrids();
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
  populateOverlayGrids();
  if (ctrl('sel-overlay-grid').value === name) renderOverlay();
  setStatus('active', `Deleted "${name}"`);
}

// ── Overlay grid — a SECOND saved grid, drawn on top of the current one
// so two definitions can be lined up/compared by eye, and baked into the
// same SVG/PNG export. Deliberately NOT a general N-layer compositing
// system (blend modes, reorderable stack, its own Model schema) — that's
// a materially bigger feature, evaluated and scoped down on request to
// exactly this: one extra grid, same canvas, visualisation + export only.
// Reuses the SAME preset list as Save/Load (`allGridPresets()`) rather
// than a separate store, since it's the identical "a named grid
// definition" concept. Deliberately regenerates from the preset's own
// `grid.type`/`grid.params` against the CURRENT canvas's inner rect —
// the opposite choice from Load saved grid (which adopts the preset's
// OWN canvas size) — so the overlay always fits and aligns with Layer A
// regardless of what canvas it was originally saved on; the preset's own
// saved canvas/cells are read for Load, never for Overlay.
function populateOverlayGrids() {
  const sel = ctrl('sel-overlay-grid');
  const cur = sel.value;
  const presets = allGridPresets();
  sel.innerHTML = '<option value="">None</option>';
  Object.keys(presets).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
  if (presets[cur]) sel.value = cur;
}
function buildOverlayModel() {
  const name = ctrl('sel-overlay-grid').value;
  if (!name || !currentModel || !currentInner) return null;
  const preset = allGridPresets()[name];
  if (!preset) return null;
  const generator = GENERATORS[preset.grid.type];
  if (!generator) return null;
  try {
    // A real, pre-existing gap: Bento/Masonry/Rectangular/Wave's own
    // generate() destructures `gap` OUT of params before echoing the rest
    // back as `grid.params` (it's stored once, at the top-level `grid.gap`
    // instead) — every other generator keeps `gap` inside its own params
    // object. Feeding a saved preset's bare `grid.params` straight back
    // into generate() silently drops Gap for exactly those four types
    // (Kiwi/solveTracksParametric then received `gap: undefined`, which
    // threw and was swallowed by this same try/catch — the overlay simply
    // never appeared, no visible error). paramsWithGap() below fixes it
    // here AND in loadGridPreset()'s own identical call, the same root
    // cause affecting Save/Load's own Gap-restore for those four types.
    const params = paramsWithGap(preset.grid);
    const { grid, cells } = generator.generate(params, currentInner);
    grid.padding = preset.grid.padding || 0;
    return { grid, cells };
  } catch (err) {
    return null;   // same "canvas too small for these params" case build() already guards against
  }
}
function renderOverlay() {
  const frame = ctrl('overlay-frame');
  const model = buildOverlayModel();
  ctrl('v-overlay-opacity').textContent = ctrl('rg-overlay-opacity').value;
  if (!model) {
    frame.classList.remove('visible');
    frame.innerHTML = '';
    return;
  }
  const { width, height } = currentModel.canvas;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${cellsMarkup(model, currentInner, OVERLAY_COLOR)}</svg>`;
  frame.innerHTML = svg;
  frame.style.opacity = ctrl('rg-overlay-opacity').value;
  frame.classList.add('visible');
}
window.renderOverlay = renderOverlay;

// Per-generator param-key → control-id mapping, the mirror image of
// readGridParams()'s own explicit per-type branches — deliberately
// explicit per generator rather than a naming-convention guesser, same
// reasoning readGridParams already follows (a few irregular abbreviations
// — Sinusoidal's amp/freq, Radial's innerradius/startangle — would make a
// generic mapper either wrong or its own pile of special cases anyway).
function applyGridParamsToUI(type, params) {
  ctrl('sel-gridtype').value = type;   // syncGeneratorRows() below refreshes the thumbnail-picker trigger
  const setR = (id, v) => { if (v != null) ctrl(id).value = v; };
  const setS = (id, v) => { if (v != null) ctrl(id).value = v; };
  if (type === 'bento') {
    setR('rg-bento-cols', params.cols); setR('rg-bento-rows', params.rows);
    setR('rg-bento-variety', params.variety); setR('rg-bento-gap', params.gap); setR('rg-bento-seed', params.seed);
  } else if (type === 'sinusoidal') {
    setR('rg-sin-cols', params.cols); setR('rg-sin-rows', params.rows);
    setR('rg-sin-amount', params.amount); setR('rg-sin-freq', params.frequency); setR('rg-sin-phase', params.phase);
    setR('rg-sin-scale', params.scale); setR('rg-sin-seed', params.seed);
    setR('rg-sin-gap', params.gap);
    if (params.axis) setSegValue('seg-sin-axis', params.axis);
    if (params.fn) setSegValue('seg-sin-fn', params.fn);
    syncWaveFnRow();
  } else if (type === 'hexagonal') {
    setR('rg-hex-cols', params.cols); setR('rg-hex-rotation', params.rotation);
    setS('sel-hex-spinmode', params.spinMode); setR('rg-hex-spinamount', params.spinAmount);
    setR('rg-hex-noisescale', params.noiseScale);
    setR('rg-hex-gap', params.gap); setR('rg-hex-jitter', params.jitter); setR('rg-hex-seed', params.seed);
    syncHexSpinRow();
  } else if (type === 'radial') {
    setR('rg-radial-rings', params.rings); setR('rg-radial-sectors', params.sectors);
    setR('rg-radial-innerradius', params.innerRadiusFrac); setR('rg-radial-gap', params.gap);
    setR('rg-radial-startangle', params.startAngle); setR('rg-radial-curve', params.curve);
    if (params.stretch != null) ctrl('ck-radial-stretch').checked = params.stretch;
    setR('rg-radial-seed', params.seed);
    setR('rg-radial-distort-amount', params.distortAmount); setR('rg-radial-distort-freq', params.distortFrequency);
    setR('rg-radial-distort-phase', params.distortPhase);
    if (params.distortMode) setSegValue('seg-radial-distort', params.distortMode);
    syncDistortRow('radial');
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
  } else if (type === 'linear') {
    setR('rg-lin-cols', params.cols); setR('rg-lin-rows', params.rows);
    setR('rg-lin-rotation', params.rotation); setR('rg-lin-jitter', params.jitter);
    setR('rg-lin-gap', params.gap); setR('rg-lin-seed', params.seed);
    setR('rg-lin-distort-amount', params.distortAmount); setR('rg-lin-distort-freq', params.distortFrequency);
    setR('rg-lin-distort-phase', params.distortPhase);
    if (params.axis) setSegValue('seg-lin-axis', params.axis);
    if (params.distortMode) setSegValue('seg-lin-distort', params.distortMode);
    syncLinearAxisRow();
    syncDistortRow('lin');
  } else if (type === 'rectangular') {
    if (params.colWeights != null) ctrl('txt-rect-colweights').value = params.colWeights;
    if (params.rowWeights != null) ctrl('txt-rect-rowweights').value = params.rowWeights;
    setR('rg-rect-gap', params.gap);
  } else if (type === 'diagonal') {
    setR('rg-diag-count', params.count); setR('rg-diag-angle', params.angle); setR('rg-diag-skew', params.skew);
    setR('rg-diag-gap', params.gap); setR('rg-diag-jitter', params.jitter); setR('rg-diag-seed', params.seed);
    setR('rg-diag-distort-amount', params.distortAmount); setR('rg-diag-distort-freq', params.distortFrequency);
    setR('rg-diag-distort-phase', params.distortPhase);
    if (params.distortMode) setSegValue('seg-diag-distort', params.distortMode);
    syncDistortRow('diag');
  } else if (type === 'angular') {
    setR('rg-ang-sectors', params.sectors); setR('rg-ang-startangle', params.startAngle);
    setR('rg-ang-centerx', params.centerX); setR('rg-ang-centery', params.centerY); setR('rg-ang-gap', params.gap);
    setR('rg-ang-seed', params.seed);
    setR('rg-ang-distort-amount', params.distortAmount); setR('rg-ang-distort-freq', params.distortFrequency);
    setR('rg-ang-distort-phase', params.distortPhase);
    if (params.distortMode) setSegValue('seg-ang-distort', params.distortMode);
    syncDistortRow('ang');
  } else if (type === 'masonry') {
    setR('rg-mas-cols', params.cols); setR('rg-mas-minheight', params.minHeight);
    setR('rg-mas-maxheight', params.maxHeight); setR('rg-mas-gap', params.gap); setR('rg-mas-seed', params.seed);
    setR('rg-mas-distort-amount', params.distortAmount); setR('rg-mas-distort-freq', params.distortFrequency);
    setR('rg-mas-distort-phase', params.distortPhase);
    if (params.distortMode) setSegValue('seg-mas-distort', params.distortMode);
    syncDistortRow('mas');
  } else if (type === 'fractal') {
    setR('rg-frac-depth', params.depth); setR('rg-frac-variance', params.variance);
    setR('rg-frac-gap', params.gap); setR('rg-frac-seed', params.seed);
    if (params.axisMode) setSegValue('seg-frac-axismode', params.axisMode);
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
  // Per-side fields fall back to the old single `margin` for any grid
  // saved before Phase 4 (including the built-in presets above, none of
  // which carry the new fields) — same "legacy key stays readable"
  // discipline every other Organica localStorage migration in this repo
  // follows.
  const mc = model.canvas;
  ctrl('rg-margin-top').value = mc.marginTop ?? mc.margin ?? 0;
  ctrl('rg-margin-right').value = mc.marginRight ?? mc.margin ?? 0;
  ctrl('rg-margin-bottom').value = mc.marginBottom ?? mc.margin ?? 0;
  ctrl('rg-margin-left').value = mc.marginLeft ?? mc.margin ?? 0;
  ctrl('ck-margin-link').checked =
    (mc.marginTop ?? mc.margin) === (mc.marginRight ?? mc.margin) &&
    (mc.marginTop ?? mc.margin) === (mc.marginBottom ?? mc.margin) &&
    (mc.marginTop ?? mc.margin) === (mc.marginLeft ?? mc.margin);
  ctrl('rg-safearea').value = model.canvas.safeArea;
  if (model.canvas.bleed) ctrl('num-bleed').value = model.canvas.bleed;
  syncUnitRows();
  applyGridParamsToUI(model.grid.type, paramsWithGap(model.grid));
  syncGeneratorRows();
  if (model.grid.padding != null) ctrl('rg-padding').value = model.grid.padding;
  build();
  // build() just regenerated fresh tracks from params/seed alone — correct
  // for every OTHER control, but it silently threw away a WYSIWYG drag
  // edit the saved model itself carried (verified live: dragging a Bento
  // column then Save/Load round-tripped back to the plain equal-width
  // grid, the edit gone). The saved model's own tracks ARE the drag edit
  // — restoring them post-build, same "cells/topology untouched, only
  // track sizes overridden" idea the drag handlers themselves already
  // use — makes Save grid a real snapshot of an edited layout, not just
  // of the generator's recipe. Track counts always match (same params
  // just re-generated them), so no length-mismatch guard is needed.
  if (model.grid.tracks && currentModel) {
    currentModel.grid.tracks = { cols: model.grid.tracks.cols.slice(), rows: model.grid.tracks.rows.slice() };
    paintGridDOM(previewEl, currentModel, currentInner, GUIDE_COLOR);
    renderTrackHandles();
    if (ctrl('ck-json-view').checked) paintJSON();
  }
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

// ── Grid-type thumbnail picker — the shared design-system component
// (panel.css's own "PRESET/TRANSFORMER PICKER":
// .presets/.preset-trigger/.preset-menu/.pt-ico/.pi-ico, the same one
// Camo Turing's Pattern picker and Living Path's Transformer picker
// already use) applied to Grid type instead of a plain <select>. Static
// SVG icons, not live-simulated thumbnails — a grid TYPE (unlike a
// Gray-Scott f/k preset) isn't a function of one scalar the icon could
// render live, so a small representative pictogram per generator is
// the honest equivalent Camo Turing's own Transformer picker already
// uses for the same reason (see transformer.js's own header).
// 26×26 viewBox to match .pt-ico/.pi-ico's own fixed box; stroke=
// currentColor so it inherits --ink from the CSS component, never a
// hardcoded colour.
const GENERATOR_ICONS = {
  bento: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="20" height="20"/><line x1="12" y1="3" x2="12" y2="13"/><line x1="3" y1="13" x2="12" y2="13"/><line x1="12" y1="13" x2="12" y2="23"/></svg>',
  // A sine-curve glyph here would be actively misleading — Wave is
  // cellShape:'rect' (real CSS Grid tracks), so it only ever modulates
  // track WIDTH rhythmically, never bends a boundary into a visible
  // curve (that's Linear's own Distortion, which genuinely can). The
  // icon draws what Wave actually produces: uneven-width straight bars.
  sinusoidal: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="4" y1="4" x2="4" y2="22"/><line x1="9" y1="7" x2="9" y2="19"/><line x1="14" y1="3" x2="14" y2="23"/><line x1="19" y1="9" x2="19" y2="17"/><line x1="23" y1="6" x2="23" y2="20"/></svg>',
  hexagonal: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="13,3 21,8 21,18 13,23 5,18 5,8"/></svg>',
  radial: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="13" cy="13" r="10"/><circle cx="13" cy="13" r="4.5"/><line x1="13" y1="3" x2="13" y2="8.5"/><line x1="13" y1="17.5" x2="13" y2="23"/><line x1="3" y1="13" x2="8.5" y2="13"/><line x1="17.5" y1="13" x2="23" y2="13"/></svg>',
  triangular: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="3,21 10,7 17,21"/><polygon points="10,7 17,21 24,7"/></svg>',
  diamond: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="13,3 23,13 13,23 3,13"/></svg>',
  circular: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="9" cy="9" r="5.5"/><circle cx="18" cy="9" r="5.5"/><circle cx="13.5" cy="18.5" r="5.5"/></svg>',
  linear: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="7" y1="3" x2="7" y2="23"/><line x1="13" y1="3" x2="13" y2="23"/><line x1="19" y1="3" x2="19" y2="23"/></svg>',
  rectangular: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="20" height="20"/><line x1="14" y1="3" x2="14" y2="23"/><line x1="19" y1="3" x2="19" y2="23"/></svg>',
  diagonal: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="0" y1="20" x2="12" y2="0"/><line x1="7" y1="26" x2="19" y2="0"/><line x1="14" y1="26" x2="26" y2="4"/></svg>',
  angular: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 23 L3 13 A10 10 0 0 1 13 3 Z"/><path d="M3 23 L13 23 A10 10 0 0 0 13 3 Z" stroke-dasharray="1.5 1.8"/></svg>',
  masonry: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="6" height="10"/><rect x="3" y="13" width="6" height="10"/><rect x="10" y="3" width="6" height="15"/><rect x="10" y="18" width="6" height="5"/><rect x="17" y="3" width="6" height="6"/><rect x="17" y="9" width="6" height="14"/></svg>',
  fractal: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="20" height="20"/><line x1="13" y1="3" x2="13" y2="23"/><line x1="3" y1="13" x2="13" y2="13"/><line x1="13" y1="8" x2="23" y2="8"/></svg>',
  organic: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M13 3 L21 7 L23 15 L17 22 L9 22 L3 15 L5 7 Z"/><path d="M13 3 L13 11 M21 7 L13 11 M23 15 L13 11 M13 11 L9 22 M13 11 L17 22 M13 11 L3 15" stroke-width="0.9"/></svg>',
  spiral: '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 3 H23 V16 H10 V9 H17"/></svg>',
};
const GENERATOR_ICON_FALLBACK = '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="20" height="20"/></svg>';

function buildGeneratorPicker() {
  const host = ctrl('gridtype-picker');
  const sel = ctrl('sel-gridtype');
  const id = 'gridtype';
  host.innerHTML = `<button class="preset-trigger" id="${id}-trigger" aria-label="Grid type">
      <span class="pt-ico" id="${id}-ico"></span><span class="pt-name" id="${id}-name"></span><span class="pt-chev">▾</span>
    </button><div class="preset-menu" id="${id}-menu" hidden></div>`;
  const trigger = ctrl(id + '-trigger'), menu = ctrl(id + '-menu');
  const icoEl = ctrl(id + '-ico'), nameEl = ctrl(id + '-name');

  const icon = type => GENERATOR_ICONS[type] || GENERATOR_ICON_FALLBACK;
  const label = type => GENERATORS[type] ? GENERATORS[type].label : type;

  function updateTrigger() {
    const type = sel.value;
    icoEl.innerHTML = icon(type);
    nameEl.textContent = label(type);
  }
  function populateMenu() {
    menu.innerHTML = '';
    Object.keys(GENERATORS).forEach(type => {
      const row = document.createElement('button');
      row.className = 'preset-item' + (type === sel.value ? ' on' : '');
      row.innerHTML = `<span class="pi-ico">${icon(type)}</span><span class="pi-name">${label(type)}</span>`;
      row.addEventListener('click', () => {
        sel.value = type;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        updateTrigger();
        menu.hidden = true;
      });
      menu.appendChild(row);
    });
  }
  function positionMenu() {
    const t = trigger.getBoundingClientRect(), gap = 5, margin = 12;
    const below = window.innerHeight - t.bottom - margin, above = t.top - margin;
    menu.style.left = t.left + 'px'; menu.style.width = t.width + 'px';
    if (below >= 200 || below >= above) { menu.style.top = (t.bottom + gap) + 'px'; menu.style.bottom = 'auto'; menu.style.maxHeight = Math.max(160, below) + 'px'; }
    else { menu.style.bottom = (window.innerHeight - t.top + gap) + 'px'; menu.style.top = 'auto'; menu.style.maxHeight = Math.max(160, above) + 'px'; }
  }
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (menu.hidden) { populateMenu(); positionMenu(); menu.hidden = false; } else menu.hidden = true;
  });
  document.addEventListener('click', e => {
    if (!menu.hidden && !host.contains(e.target) && !menu.contains(e.target)) menu.hidden = true;
  });
  updateTrigger();
  return { refresh: updateTrigger };
}

// ── INIT ──
populateCanvasPresets();
syncUnitRows();
const gridtypePicker = buildGeneratorPicker();   // before syncGeneratorRows() — it refreshes the picker's own trigger on every call
syncGeneratorRows();
populateSavedGrids();
populateOverlayGrids();
// Cloud sync (shared/store.js): hydrate saved grids from Supabase.
gridPresetStore.pull().then(() => { populateSavedGrids(); populateOverlayGrids(); });
gridPresetStore.onSync(() => { populateSavedGrids(); populateOverlayGrids(); });
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
window.randomizeParams = randomizeParams;

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
// Link margin sides — editing any one of the four Margin fields while
// linked copies its value to the other three (checked by default, since
// "all four equal" was the only behaviour before per-side margins
// existed). Off, each side is fully independent. The four fields are
// plain number inputs (the 2×2 corner-bracket grid), not sliders — no
// separate .ctrl-val readout to sync, the input's own value IS the
// display.
ctrl('panel').addEventListener('input', e => {
  if (!e.target.matches('.margin-side') || !ctrl('ck-margin-link').checked) return;
  const v = e.target.value;
  ['rg-margin-top', 'rg-margin-right', 'rg-margin-bottom', 'rg-margin-left'].forEach(id => {
    if (id === e.target.id) return;
    ctrl(id).value = v;
  });
});
ctrl('panel').addEventListener('input', build);
ctrl('panel').addEventListener('change', build);
build();
setStatus('active', 'Ready');
