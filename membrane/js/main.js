/* ─────────────────────────────────────────────────────────────
   Membrane — main.js. p5 INSTANCE mode (not the exploration's own
   global mode — instance mode is what actually composes with ES
   modules: every module below reads/writes state.p.* instead of
   colliding on bare `random`/`curveVertex`/etc. globals). Orchestrates
   the seed/movement/render modules and wires every panel control.
   ───────────────────────────────────────────────────────────── */
import { state, effectiveN } from './state.js';
import { hexToRgb, cacheImagePixels } from './color.js';
import { initShape, proceduralSpawnRadius } from './seeds/procedural.js';
import { seedFromImage } from './seeds/image.js';
import { loadMembraneFont, isFontReady, seedFromText } from './seeds/text.js';
import { loadLoomPathJSON } from './seeds/loom.js';
import { reseedLinear, updateMovement } from './movement.js';
import { renderPoint, renderShape, renderFullPath } from './render.js';
import { CANVAS_PRESETS, clampCanvasSize } from './canvas.js';
import { buildExportSVGString } from './svgexport.js';

function ctrl(id) { return document.getElementById(id); }

// Single choke point for the canvas's own fill colour — Palette's
// "Background" swatch (state.canvasBgRGB), painted directly onto the
// canvas by p5. #canvas-wrap's own CSS background is --panel (UI chrome,
// Camo Turing's own convention — see index.html's own comment), not
// this colour, so there's no CSS var to keep in sync here any more.
// Guarded on state.p.canvas, not just state.p: `state.p = p` runs
// synchronously inside `new p5(sketch)`
// (the sketch function's own first line, before setup/draw are even
// registered), so state.p itself is already a real p5 instance by the
// time the Palette's own initial swatch-sync call runs at module load —
// but createCanvas() is still deferred inside setup(), and calling
// background() before it exists throws deep inside p5's own renderer
// lookup. setup() calls paintBackground() again right after
// createCanvas(), so skipping a not-yet-possible repaint here loses
// nothing.
function paintBackground() {
  if (!state.p || !state.p.canvas) return;
  state.p.background(state.canvasBgRGB[0], state.canvasBgRGB[1], state.canvasBgRGB[2]);
  // A flat repaint wipes every stroke actually on screen — state.shapeHistory
  // (render.js's own recorded frames, replayed by svgexport.js) must be
  // wiped in lockstep, or an SVG export after Clear/resize/Background
  // change would draw strokes that no longer exist on the canvas.
  state.shapeHistory.length = 0;
}

// ── Zoom/pan — the same shared component every other Organica tool's
// own canvas/frame uses (Organica.createZoomPan, shared/organica-core.js:
// wheel zooms toward the cursor, drag pans once zoomed, dblclick/Reset
// returns to 100%, Cmd/Ctrl +/-/0 as keyboard shortcuts). Wired once,
// right after createCanvas() creates the real canvas element setup()
// needs — resizeCanvas() (Canvas panel's own resize) keeps that same
// DOM node, just changes its size, so this never needs to run twice.
//
// min:0.1, not the shared default of 1 — a real bug, found by testing:
// createZoomPan's own default range is [1, 12], so zooming OUT below
// 100% is impossible out of the box (exactly the gap Loom's own session
// notes already documented and fixed the same way). Every Canvas preset
// (even Square 1:1) measured wider or taller than #canvas-wrap at a
// normal browser size, and with no way to zoom below 100% there was
// simply no way to ever see the whole canvas — confirmed live: 5 wheel-
// down events plus Ctrl+- all left the canvas pinned at scale(1). 0.1
// covers Membrane's own real range (canvas.js caps custom size at
// 4000px; a 4000px canvas in a ~900px wrap needs ≈0.225 to fit, well
// inside 0.1) without Loom's own sharper edge case at 0.01 (multi-metre
// print canvases don't exist here).
let zoomPan = null;
function setupZoomPan() {
  zoomPan = Organica.createZoomPan({
    canvas: state.p.canvas,
    wrap: ctrl('canvas-wrap'),
    min: 0.1,
    onChange: ({ zoom, zoomed }) => {
      ctrl('zoom-level').textContent = Math.round(zoom * 100) + '%';
      ctrl('zoom-hud').classList.toggle('visible', zoomed);
      state.p.canvas.classList.toggle('zoomed', zoomed);
    },
  });
  ctrl('btn-zoom-reset').addEventListener('click', () => zoomPan.reset());
  fitToViewIfNeeded();
}

// Auto-fits whenever the canvas's own physical size changes (a fresh
// preset/custom size shouldn't land clipped by #canvas-wrap's own
// overflow:hidden) — same technique and same "retry next frame if the
// wrap hasn't been laid out yet" guard Loom's own fitToViewIfNeeded()
// uses, ported rather than re-derived.
let lastFitKey = '';
function fitToViewIfNeeded() {
  const key = state.W + 'x' + state.H;
  if (key === lastFitKey || !zoomPan) return;
  const wrap = ctrl('canvas-wrap');
  const availW = wrap.clientWidth - 64, availH = wrap.clientHeight - 64;
  if (availW <= 0 || availH <= 0) {
    requestAnimationFrame(fitToViewIfNeeded);
    return;
  }
  lastFitKey = key;
  const scale = Math.min(1, availW / state.W, availH / state.H);
  zoomPan.reset();
  if (scale < 0.999) zoomPan.zoomBy(scale);
}

// Tracks state.mouseX/mouseY in canvas-LOGICAL coordinates (0..state.W,
// 0..state.H) from real DOM mousemove events — getBoundingClientRect()
// reflects the canvas's live CSS transform (zoom scale + pan translate),
// which is exactly what p5's own p.mouseX/mouseY does NOT account for
// (see state.js's own header comment). Listened on document, not just
// the canvas, so the "ignore clicks on the panel" bounds check in
// mousePressed still sees an out-of-[0,W]-range position for a panel
// click, the same defensive behaviour the original p.mouseX-based code had.
function setupMouseTracking() {
  document.addEventListener('mousemove', e => {
    const rect = state.p.canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - rect.left) / rect.width) * state.W;
    state.mouseY = ((e.clientY - rect.top) / rect.height) * state.H;
  });
}

// ── Reseed dispatch — "something that affects the current seed changed"
// routes here instead of every control re-deriving the branch. Procedural
// has no file/word to re-sample, but doing nothing there would be a dead
// control the same way the others would be — a fresh circle/line/point
// at the form's own current centre is the direct equivalent.
function reseedCurrent() {
  if (state.seedSource === 'image' && state.loadedImg) seedFromImage();
  else if (state.seedSource === 'text') { if (isFontReady()) seedFromText(); }
  else initShape(state.centerX, state.centerY, proceduralSpawnRadius());
}

// ── p5 sketch (instance mode) ──
const sketch = (p) => {
  state.p = p;

  p.setup = () => {
    const c = p.createCanvas(state.W, state.H);
    c.parent('canvas-wrap');
    // inkSwatch.set (defined further down, hoisted — safe to call here
    // since this callback only ever RUNS once the whole module has
    // finished evaluating), not a direct state.inkRGB assignment: a real
    // bug, found by tracing the two assignments — this used to write
    // state.inkRGB straight from the CSS var, bypassing the swatch
    // entirely, so the Palette's own Ink swatch/hex fields (set by the
    // OTHER, module-load-time createColorSwatch call from state.js's own
    // default) could silently disagree with the colour actually being
    // drawn if --mark-ink and state.js's default array ever drifted
    // apart. One call, one source of truth, UI and state can't disagree.
    inkSwatch.set(getComputedStyle(document.documentElement).getPropertyValue('--mark-ink').trim());
    state.accentRGB = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--mark-accent').trim());
    initShape(state.W / 2, state.H / 2, state.initRadius * p.random(0.5, 1));
    paintBackground();
    setupZoomPan();
    setupMouseTracking();
  };

  p.draw = () => {
    updateMovement(p.deltaTime / 1000);
    if (state.movementPattern === 'textpath' && state.drawFullPath) renderFullPath();

    // Every point takes its own small independent step — xs.length, not
    // formResolution: Point mode's xs is a single element regardless of
    // whatever formResolution the slider still reads, so looping to
    // formResolution would walk past the real array (a real bug caught
    // porting the exploration this migrates from — `undefined + number`
    // = NaN written into brand-new indices).
    for (let i = 0; i < state.xs.length; i++) {
      state.xs[i] += p.random(-state.stepSize, state.stepSize);
      state.ys[i] += p.random(-state.stepSize, state.stepSize);
    }

    if (state.drawMode === 'point') { renderPoint(); return; }
    renderShape();
  };

  p.mousePressed = () => {
    // state.mouseX/mouseY (our own tracked position), not p.mouseX/
    // p.mouseY — see state.js's own header comment on why p5's own
    // values go wrong once the canvas is CSS-zoomed (Organica.createZoomPan).
    if (state.mouseX < 0 || state.mouseX > state.W || state.mouseY < 0 || state.mouseY > state.H) return;   // ignore clicks on the panel
    if (state.seedSource === 'image' && state.loadedImg) { seedFromImage(); return; }
    if (state.seedSource === 'text') { if (isFontReady()) seedFromText(); return; }
    initShape(state.mouseX, state.mouseY, proceduralSpawnRadius());
  };
};

new p5(sketch);

// ── Font load ──
loadMembraneFont((err) => {
  ctrl('font-status-hint').textContent = err ? 'Font failed to load.' : 'Font ready.';
  ctrl('font-status-hint').style.display = err ? '' : 'none';
  if (!err && state.seedSource === 'text') seedFromText();
});

// ── Seed source tabs ──
// Seed shape (Ring/Noise blob/Cluster) only means something for the
// Procedural source's own Circle mode — Image/Text supply their own
// outline, Line/Point have no ring to reshape. Dead-control rule
// (Komorebi §18): hide, don't leave it visibly doing nothing.
function syncSeedShapeRow() {
  ctrl('row-seedshape').style.display = (state.seedSource === 'procedural' && state.drawMode === 'circle') ? '' : 'none';
}
function syncSeedSourceUI() {
  ['procedural', 'image', 'text'].forEach(v => {
    const block = ctrl('seedsrc-' + v);
    if (block) block.style.display = v === state.seedSource ? '' : 'none';
  });
  ctrl('row-imgscale').style.display = state.seedSource === 'procedural' ? 'none' : '';
  ctrl('seg-seedsource').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.v === state.seedSource));
  syncSeedShapeRow();
}
ctrl('seg-seedsource').querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.seedSource = btn.dataset.v;
    syncSeedSourceUI();
    reseedCurrent();
  });
});
syncSeedSourceUI();

// ── Form ──
ctrl('rg-res').addEventListener('input', e => {
  state.formResolution = parseInt(e.target.value, 10);
  ctrl('v-res').textContent = state.formResolution;
  reseedCurrent();
});
ctrl('rg-radius').addEventListener('input', e => { state.initRadius = parseFloat(e.target.value); ctrl('v-radius').textContent = state.initRadius; });
ctrl('rg-pointsize').addEventListener('input', e => {
  state.pointSizeSetting = parseFloat(e.target.value);
  ctrl('v-pointsize').textContent = state.pointSizeSetting;
  if (state.drawMode === 'point') reseedCurrent();
});
ctrl('sel-mode').addEventListener('change', e => {
  state.drawMode = e.target.value;
  const isPoint = state.drawMode === 'point';
  ctrl('row-resolution').style.display = isPoint ? 'none' : '';
  ctrl('row-initradius').style.display = isPoint ? 'none' : '';
  ctrl('row-pointsize').style.display = isPoint ? '' : 'none';
  syncSeedShapeRow();
  reseedCurrent();
});
ctrl('sel-seedshape').addEventListener('change', e => { state.proceduralShape = e.target.value; reseedCurrent(); });

// ── Seed: Image ──
ctrl('btn-upload-image').addEventListener('click', () => ctrl('file-image').click());
ctrl('file-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    state.p.loadImage(evt.target.result, img => {
      state.loadedImg = img;
      import('./color.js').then(({ cacheImagePixels }) => { state.imgPixelsCache = cacheImagePixels(img); });
      ctrl('image-readout').textContent = file.name + ' — ' + img.width + '×' + img.height;
      state.seedSource = 'image';
      syncSeedSourceUI();
      seedFromImage();
    }, () => { ctrl('image-readout').textContent = 'Could not load image.'; });
  };
  reader.readAsDataURL(file);
});
ctrl('sel-seedstyle').addEventListener('change', e => { state.seedStyle = e.target.value; reseedCurrent(); });
ctrl('rg-threshold').addEventListener('input', e => {
  state.threshold = parseInt(e.target.value, 10);
  ctrl('v-threshold').textContent = state.threshold;
  reseedCurrent();
});
ctrl('chk-invert').addEventListener('change', e => { state.invertMask = e.target.checked; reseedCurrent(); });
ctrl('rg-imgscale').addEventListener('input', e => {
  state.imageScale = parseFloat(e.target.value);
  ctrl('v-imgscale').textContent = state.imageScale.toFixed(2);
  reseedCurrent();
});

// ── Seed: Text ──
ctrl('txt-seedtext').addEventListener('input', e => {
  state.seedText = e.target.value;
  if (state.seedSource === 'text' && isFontReady()) seedFromText();
});

// ── Motion ──
ctrl('rg-step').addEventListener('input', e => { state.stepSize = parseFloat(e.target.value); ctrl('v-step').textContent = state.stepSize.toFixed(1); });
ctrl('rg-float').addEventListener('input', e => { state.floatSpeed = parseFloat(e.target.value); ctrl('v-float').textContent = state.floatSpeed.toFixed(3); });
ctrl('rg-movespeed').addEventListener('input', e => { state.moveSpeed = parseFloat(e.target.value); ctrl('v-movespeed').textContent = state.moveSpeed.toFixed(1); });
ctrl('sel-movement').addEventListener('change', e => {
  state.movementPattern = e.target.value;
  state.moveClock = 0;   // restart every pattern's own t=0 pose instead of jumping in mid-cycle
  if (state.movementPattern === 'linear') reseedLinear();
  ctrl('row-float').style.display = state.movementPattern === 'mouse' ? '' : 'none';
  ctrl('row-movespeed').style.display = state.movementPattern === 'mouse' ? 'none' : '';
  ctrl('followpath-block').style.display = state.movementPattern === 'textpath' ? '' : 'none';
});

// ── Follow path ──
ctrl('sel-pathsource').addEventListener('change', e => {
  state.pathSource = e.target.value;
  ctrl('loompath-block').style.display = state.pathSource === 'loom' ? '' : 'none';
  if (state.pathSource === 'text' && state.seedSource === 'text' && isFontReady()) seedFromText();
});
ctrl('sel-loompathstyle').addEventListener('change', e => {
  state.loompathStyle = e.target.value;
  if (state.lastLoomModel) {
    import('./seeds/loom.js').then(({ buildLoomPath }) => {
      const info = buildLoomPath(state.lastLoomModel, state.loompathStyle);
      ctrl('loompath-readout').textContent = (state.loompathStyle === 'borders' ? info.vertexCount + ' vertices (borders)' : info.cellCount + ' cells (centroids)') + ' — ' + info.gridType;
    });
  }
});
ctrl('btn-upload-loompath').addEventListener('click', () => ctrl('file-loompath').click());
ctrl('file-loompath').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    loadLoomPathJSON(evt.target.result, (info, errMsg) => {
      if (errMsg) { ctrl('loompath-readout').textContent = errMsg; return; }
      ctrl('loompath-readout').textContent = (state.loompathStyle === 'borders' ? info.vertexCount + ' vertices (borders)' : info.cellCount + ' cells (centroids)') + ' — ' + info.gridType;
    });
  };
  reader.readAsText(file);
});
ctrl('chk-drawpath').addEventListener('change', e => { state.drawFullPath = e.target.checked; });
ctrl('sel-pathrender').addEventListener('change', e => {
  state.pathRenderStyle = e.target.value;
  ctrl('row-pathdotsize').style.display = state.pathRenderStyle === 'dots' ? '' : 'none';
});
ctrl('rg-pathdotsize').addEventListener('input', e => { state.pathDotSize = parseFloat(e.target.value); ctrl('v-pathdotsize').textContent = state.pathDotSize.toFixed(1); });
ctrl('chk-glow').addEventListener('change', e => { state.glowEnabled = e.target.checked; });
ctrl('chk-writebrush').addEventListener('change', e => {
  state.writeBrush = e.target.checked;
  ctrl('row-brushsize').style.display = state.writeBrush ? '' : 'none';
  if (state.seedSource === 'text' && isFontReady()) seedFromText();
});
ctrl('rg-brushsize').addEventListener('input', e => {
  state.brushSize = parseFloat(e.target.value);
  ctrl('v-brushsize').textContent = state.brushSize;
  if (state.writeBrush && state.seedSource === 'text' && isFontReady()) seedFromText();
});

// ── Ink ──
ctrl('sel-colorsrc').addEventListener('change', e => {
  state.colorSrc = e.target.value;
  ctrl('row-fill').style.display = state.colorSrc === 'ink' ? '' : 'none';   // Fill only ever applies to Single ink's own one-shape path
  ctrl('rmx-color-block').style.display = state.colorSrc === 'rmx' ? '' : 'none';
});
ctrl('rg-weight').addEventListener('input', e => { state.strokeW = parseFloat(e.target.value); ctrl('v-weight').textContent = state.strokeW.toFixed(2); });
ctrl('rg-alpha').addEventListener('input', e => { state.strokeAlpha = parseInt(e.target.value, 10); ctrl('v-alpha').textContent = state.strokeAlpha; });
ctrl('chk-fill').addEventListener('change', e => { state.fillEachFrame = e.target.checked; });

// ── RMX — promoted to shared/organica-palette-chip.js (TuneSutra's own
// extraction, 2026-08-26); this was one of the 6 independent copies found
// duplicating it (ported here from Camo Turing's own original). state
// stays the live source of truth (render.js/svgexport.js read
// state.rmxColors directly each frame), kept in sync via onChange.
const RMX_COLORS_MAX = 5;
Organica.createPaletteChips({
  wrap: ctrl('rmx-palette'),
  colors: state.rmxColors,
  min: 2,
  max: RMX_COLORS_MAX,
  onChange: (colors) => { state.rmxColors = colors; },
});
ctrl('sel-rmx-map').addEventListener('change', e => { state.rmxColorMap = e.target.value; });

// ── Floatbar: Play/Pause, Clear, Reseed, Export ──
function togglePlayPause() {
  state.frozen = !state.frozen;
  ctrl('btn-playpause').setAttribute('aria-label', state.frozen ? 'Play' : 'Pause');
  ctrl('ico-playpause').innerHTML = state.frozen
    ? '<path d="M5 3.5v9l7-4.5-7-4.5z" fill="currentColor"/>'
    : '<path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
  if (state.frozen) state.p.noLoop(); else state.p.loop();
}
ctrl('btn-playpause').addEventListener('click', togglePlayPause);
// Spacebar toggles Play/Pause from anywhere EXCEPT while a text/number
// field or a range slider has focus — Space needs to keep typing a
// literal space in the Word field and keep its native "nudge the
// slider" behaviour on a focused range input, not steal either one.
// Also prevents the page's own default Space-scrolls-the-page action,
// which would otherwise fire since #panel is a real scrollable region.
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' && e.key !== ' ') return;
  const t = document.activeElement;
  const tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
  e.preventDefault();
  togglePlayPause();
});
ctrl('btn-clear').addEventListener('click', () => paintBackground());
ctrl('btn-reseed').addEventListener('click', () => reseedCurrent());
Organica.popover(ctrl('btn-export'), ctrl('export-popover'));
ctrl('btn-export-png').addEventListener('click', () => {
  const scale = parseInt(ctrl('sel-export-scale').value, 10);
  if (scale === 1) {
    state.p.saveCanvas('membrane-' + Date.now(), 'png');
    return;
  }
  // Membrane's canvas is a persistent ACCUMULATED trail (never cleared
  // frame to frame) — unlike Komorebi/Halide's own "resize canvas,
  // redraw, save, resize back" scale-export technique, resizeCanvas()
  // would clear everything drawn in every previous frame, which is the
  // whole point of this tool. Scale export instead upsamples the CURRENT
  // bitmap onto a separate offscreen canvas — an honest "bigger file of
  // what's actually on screen right now", not a vector re-render.
  const off = document.createElement('canvas');
  off.width = state.p.canvas.width * scale;
  off.height = state.p.canvas.height * scale;
  const octx = off.getContext('2d');
  octx.drawImage(state.p.canvas, 0, 0, off.width, off.height);
  off.toBlob(blob => Organica.download(blob, Organica.stamp('membrane', 'png')));
});

// ── Canvas — Loom's own Preset + custom Width/Height standard, px only
// (see canvas.js's own header for why unit conversion doesn't apply
// here). Resizing is a structural change to the drawing surface — same
// category as Clear/Reseed, not the export-scale case that must NEVER
// clear (that one upsamples the CURRENT bitmap instead, see the PNG
// export handler below).
Object.keys(CANVAS_PRESETS).forEach(name => {
  const opt = document.createElement('option');
  opt.value = name; opt.textContent = name;
  ctrl('sel-canvas-preset').appendChild(opt);
});
function applyCanvasSize(w, h) {
  w = clampCanvasSize(w); h = clampCanvasSize(h);
  ctrl('num-canvas-width').value = w;
  ctrl('num-canvas-height').value = h;
  state.W = w; state.H = h;
  state.p.resizeCanvas(w, h);
  state.centerX = w / 2; state.centerY = h / 2;
  paintBackground();
  reseedCurrent();
  fitToViewIfNeeded();
}
ctrl('sel-canvas-preset').addEventListener('change', e => {
  const p = CANVAS_PRESETS[e.target.value];
  if (!p) return;
  applyCanvasSize(p.width, p.height);
});
ctrl('num-canvas-width').addEventListener('change', e => {
  ctrl('sel-canvas-preset').value = '';   // typing a custom size stops claiming to be a preset
  applyCanvasSize(parseFloat(e.target.value), state.H);
});
ctrl('num-canvas-height').addEventListener('change', e => {
  ctrl('sel-canvas-preset').value = '';
  applyCanvasSize(state.W, parseFloat(e.target.value));
});

// ── Palette — Ink + Background, Camo Turing's own Ink/Paper pairing
// (see index.html's own Palette section comment for why Background isn't
// literally called "Paper" here). Wired via the shared
// Organica.createColorSwatch (shared/organica-core.js) — extracted from
// this exact pair (which started as a hand-copy of Camo Turing's own
// syncColor) once a repo-wide survey found the same swatch+hex+random+
// native-picker-forward wiring reimplemented independently in 7 tools.
// `initial` syncs the visible swatch/hex fields to state.js's own
// defaults immediately; `onChange` is this tool's own side effect
// (state.*RGB, plus a full repaint for Background).
const inkSwatch = Organica.createColorSwatch('ink', {
  initial: Organica.rgbToHex(...state.inkRGB),
  onChange: (hex, rgb) => { state.inkRGB = rgb; },
});
const bgSwatch = Organica.createColorSwatch('bg', {
  initial: Organica.rgbToHex(...state.canvasBgRGB),
  onChange: (hex, rgb) => { state.canvasBgRGB = rgb; paintBackground(); },
});

// ── Export: SVG (real vector geometry of the current shape/path — see
// svgexport.js's own header for the disclosed "current frame, not the
// accumulated trail" scope) ──
ctrl('btn-export-svg').addEventListener('click', () => {
  const svg = buildExportSVGString();
  Organica.download(new Blob([svg], { type: 'image/svg+xml' }), Organica.stamp('membrane', 'svg'));
});

// ── Export: Video — canvas.captureStream() + MediaRecorder, MP4 first
// then WebM, the exact technique Camo Turing's own toggleRecording()
// uses (ported, not reinvented — same candidate list, same onstop
// download). Unlike Camo Turing's evolving simulation, Membrane's canvas
// is already always "live" (never auto-pauses), so Start never needs to
// force anything running first.
let mediaRecorder = null, recordedChunks = [], recordingExt = 'mp4', recordingMime = 'video/mp4';
function toggleRecording() {
  const btn = ctrl('btn-record');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  const canvas = state.p.canvas;
  if (typeof canvas.captureStream !== 'function' || typeof window.MediaRecorder === 'undefined') {
    ctrl('record-hint').textContent = 'Video recording isn\'t supported in this browser.';
    return;
  }
  const stream = canvas.captureStream(30);
  recordedChunks = [];
  const candidates = [
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
  ];
  const picked = candidates.find(([mime]) => MediaRecorder.isTypeSupported(mime));
  if (!picked) {
    ctrl('record-hint').textContent = 'No supported video format found in this browser.';
    return;
  }
  [recordingMime, recordingExt] = picked;
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: recordingMime });
  } catch (err) {
    ctrl('record-hint').textContent = 'Could not start recording: ' + err.message;
    return;
  }
  mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: recordingMime });
    Organica.download(blob, Organica.stamp('membrane', recordingExt));
    btn.textContent = 'Start recording';
    btn.classList.remove('org-btn--primary');
    ctrl('record-hint').textContent = 'Recording saved.';
  };
  if (state.frozen) ctrl('btn-playpause').click();   // recording a frozen canvas isn't useful
  mediaRecorder.start();
  btn.textContent = 'Stop recording';
  btn.classList.add('org-btn--primary');
  ctrl('record-hint').textContent = 'Recording…';
}
ctrl('btn-record').addEventListener('click', toggleRecording);

// ── Accessibility + slider polish (organica-core.js) ──
Organica.autoLabelPanel(document);
Organica.enhanceSliders(document);

// ── Rhizome bridge (Tier 2 node graph) ──
// Membrane's own `main.js` is a `<script type="module">` — nothing here
// lands on `window` by accident the way a classic script's functions do,
// so this listener lives inside the module itself, using the already-
// imported `state`/`buildExportSVGString` directly rather than reaching
// for globals that don't exist. The default `state.seedSource ===
// 'procedural'` needs no upstream setup (confirmed by reading
// seeds/procedural.js's own initShape() call in p.setup()), so only a
// Movement pattern is exposed as a param. Unlike every other bridge in
// this project, position genuinely depends on WALL-CLOCK time, not
// frame count (confirmed directly — no scheduleRender()/stepSim()-style
// synchronous batch entry point exists; render.js's own pushHistory()
// throttles by performance.now(), and movement itself reads p.deltaTime)
// — so this is the one bridge that has to actually wait real seconds
// with the p5 loop running, not fast-forward it. 'textpath' is excluded
// from the exposed options since it needs a text seed used at least
// once first (this bridge's own 0-input path can't satisfy that).
window.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'rhizome-set-input') return;
  (async () => {
    try {
      const payload = msg.payload || {};
      const pattern = payload.pattern || 'orbit';
      state.movementPattern = pattern;
      state.moveClock = 0;
      if (pattern === 'linear') reseedLinear();
      state.frozen = false;   // must be running for the trail to accumulate at all
      await new Promise(r => setTimeout(r, payload.seconds ? payload.seconds * 1000 : 2500));
      const svg = buildExportSVGString();
      e.source.postMessage({ type: 'rhizome-output-ready', payload: svg, nodeId: msg.nodeId }, '*');
    } catch (err) {
      console.error('Rhizome bridge:', err);
    }
  })();
});
