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

function ctrl(id) { return document.getElementById(id); }

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
    state.inkRGB = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--mark-ink').trim());
    state.accentRGB = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--mark-accent').trim());
    initShape(state.W / 2, state.H / 2, state.initRadius * p.random(0.5, 1));
    p.background(6);
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
    if (p.mouseX < 0 || p.mouseX > state.W || p.mouseY < 0 || p.mouseY > state.H) return;   // ignore clicks on the panel
    if (state.seedSource === 'image' && state.loadedImg) { seedFromImage(); return; }
    if (state.seedSource === 'text') { if (isFontReady()) seedFromText(); return; }
    initShape(p.mouseX, p.mouseY, proceduralSpawnRadius());
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
function syncSeedSourceUI() {
  ['procedural', 'image', 'text'].forEach(v => {
    const block = ctrl('seedsrc-' + v);
    if (block) block.style.display = v === state.seedSource ? '' : 'none';
  });
  ctrl('row-imgscale').style.display = state.seedSource === 'procedural' ? 'none' : '';
  ctrl('seg-seedsource').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.v === state.seedSource));
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
  reseedCurrent();
});

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
});
ctrl('rg-weight').addEventListener('input', e => { state.strokeW = parseFloat(e.target.value); ctrl('v-weight').textContent = state.strokeW.toFixed(2); });
ctrl('rg-alpha').addEventListener('input', e => { state.strokeAlpha = parseInt(e.target.value, 10); ctrl('v-alpha').textContent = state.strokeAlpha; });
ctrl('chk-fill').addEventListener('change', e => { state.fillEachFrame = e.target.checked; });

// ── Floatbar: Play/Pause, Clear, Reseed, Export ──
ctrl('btn-playpause').addEventListener('click', () => {
  state.frozen = !state.frozen;
  ctrl('btn-playpause').setAttribute('aria-label', state.frozen ? 'Play' : 'Pause');
  ctrl('ico-playpause').innerHTML = state.frozen
    ? '<path d="M5 3.5v9l7-4.5-7-4.5z" fill="currentColor"/>'
    : '<path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
  if (state.frozen) state.p.noLoop(); else state.p.loop();
});
ctrl('btn-clear').addEventListener('click', () => state.p.background(6));
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

// ── Accessibility + slider polish (organica-core.js) ──
Organica.autoLabelPanel(document);
Organica.enhanceSliders(document);
