/* ─────────────────────────────────────────────────────────────
   Vortex — main.js. p5 INSTANCE mode (not the exploration's own global
   mode — instance mode is what composes with ES modules). Orchestrates
   render.js/geometry.js/palette.js and wires every panel control.

   Zoom/pan: deliberately NOT Organica.createZoomPan. Vortex already has
   its own real 3D camera (drag-orbit, Shift-drag-roll, Camera distance
   as the "zoom") — layering a second, unrelated 2D zoom/pan on top
   would give the canvas two overlapping, confusing zoom concepts for
   one 3D scene. This is a deliberate divergence from Membrane's own
   convention, not an oversight.

   Mouse handling: plain p.mouseX/p.mouseY/p.pmouseX/p.pmouseY, NOT
   Membrane's own getBoundingClientRect()-based state.mouseX/mouseY
   tracking. That tracking exists in Membrane ONLY because
   createZoomPan's CSS transform desyncs p5's own mouse coordinates —
   Vortex has no such transform, so p5's own values stay correct and
   copying Membrane's workaround here would be fixing a bug this tool
   doesn't have.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';
import { applySeed } from './geometry.js';
import { renderFrame, seedLineBounds } from './render.js';
import { buildPalette } from './palette.js';
import { CANVAS_PRESETS, clampCanvasSize } from './canvas.js';
import { buildExportSVGString } from './svgexport.js';

function ctrl(id) { return document.getElementById(id); }

// ── State machine transitions — same shape as the exploration's own
// enterTransitioning/enterRunning/resetToRest. ──
function enterTransitioning() {
  state.phase = 'transitioning';
  state.transitionClock = 0;
  state.lastFrameMs = state.p.millis();
}
function enterRunning() {
  state.phase = 'running';
  state.startTime = state.p.millis();
  state.animClock = 0;
  state.lastFrameMs = state.p.millis();
}
function resetToRest() {
  state.phase = 'resting';
  state.paused = false;
  state.animClock = 0;
  state.transitionClock = 0;
  state.yawAngle = 0; state.pitchOffset = 0; state.rollAngle = 0;
  updatePlayPauseIcon();
}

// ── Floatbar Play/Pause — a single combined toggle, matching every
// other Organica tool's own floatbar convention, standing in for the
// exploration's own separate Play/Pause/Reset transport buttons. From
// 'resting' it's the exact same trigger hovering the seed line uses;
// otherwise it flips state.paused. Deliberately does NOT call
// p.noLoop()/p.loop() the way Membrane's own togglePlayPause does —
// Membrane's canvas only needs to redraw when something changes, but
// Vortex redraws from scratch every frame regardless (render.js's own
// g.background() call), and the draw loop must keep running while
// paused so camera drag and a live Background-colour change both still
// repaint (state.paused only freezes dt, not the frame itself).
function updatePlayPauseIcon() {
  const showPlay = state.phase === 'resting' || state.paused;
  ctrl('btn-playpause').setAttribute('aria-label', showPlay ? 'Play' : 'Pause');
  ctrl('ico-playpause').innerHTML = showPlay
    ? '<path d="M5 3.5v9l7-4.5-7-4.5z" fill="currentColor"/>'
    : '<path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
}
function togglePlayPause() {
  if (state.phase === 'resting') { enterTransitioning(); updatePlayPauseIcon(); return; }
  state.paused = !state.paused;
  if (!state.paused) state.lastFrameMs = state.p.millis();   // resuming: re-stamp so the frozen interval isn't counted as a dt spike
  updatePlayPauseIcon();
}

function randomizeSeed() {
  state.seed = Math.floor(Math.random() * 1e6);
  ctrl('num-seed').value = state.seed;
  applySeed();
}

// ── p5 sketch (instance mode) ──
const sketch = (p) => {
  state.p = p;

  p.setup = () => {
    const c = p.createCanvas(state.W, state.H);
    c.parent('canvas-wrap');
    p.noSmooth();
    applySeed();   // reads state.p.noiseSeed — must run after createCanvas gives us a real instance to call it on
  };

  p.draw = () => {
    if (state.phase === 'resting') {
      renderFrame(p);
      const cx = state.W / 2, cy = state.H / 2;
      const b = seedLineBounds(cx, cy);
      if (p.mouseX > b.x0 && p.mouseX < b.x1 && p.mouseY > b.y0 && p.mouseY < b.y1) {
        enterTransitioning();
        updatePlayPauseIcon();
      }
      return;   // nothing below runs until hover fires — no field, no projection, no noise/spin/orbit cost paid at rest
    }

    const nowMs = p.millis();
    const dt = state.paused ? 0 : (nowMs - state.lastFrameMs) / 1000;
    state.lastFrameMs = nowMs;

    if (state.phase === 'transitioning') {
      state.transitionClock += dt;
      renderFrame(p);
      const prog = Math.min(Math.max(state.transitionClock / state.transitionDuration, 0), 1);
      if (prog >= 1) { enterRunning(); updatePlayPauseIcon(); }
      return;
    }

    // ── RUNNING — ramp climbs 0→1 over Ramp duration on an ease-in
    // power curve, driving both simulation speed and active segment
    // count together (see geometry.js's own computeSegmentState).
    const elapsedSinceStart = (nowMs - state.startTime) / 1000;
    state.rampProgress = Math.pow(Math.min(Math.max(elapsedSinceStart / state.rampDuration, 0), 1), state.rampExponent);
    state.animClock += dt * state.rampProgress;
    const spiralComplete = state.rampProgress >= 1;

    // ── ORBIT DRAG — only once the spiral has fully generated (dragging
    // earlier would fight the anchor-offset fix, which recomputes each
    // frame's screen offset from the vortex's own (t=0,time=0) point at
    // the CURRENT camera angles — a moving anchor while segments are
    // still being generated would read as the vortex sliding around).
    // Works identically while paused (dt=0 but this block doesn't read
    // dt) — the deliberate "pause first, then frame the shot" export workflow.
    if (spiralComplete && p.mouseIsPressed && p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      const dx = p.mouseX - p.pmouseX, dy = p.mouseY - p.pmouseY;
      if (state.shiftDown) state.rollAngle += dx * 0.006;
      else { state.yawAngle += dx * 0.006; state.pitchOffset += dy * 0.006; }
    }

    renderFrame(p);
  };
};
new p5(sketch);

// Shift tracked from document keydown/keyup (e.shiftKey), not
// p.keyIsDown(p.SHIFT) — that needs the canvas to hold DOM focus to be
// reliable, and nothing here ever calls .focus() on it.
document.addEventListener('keydown', e => { state.shiftDown = e.shiftKey; });
document.addEventListener('keyup', e => { state.shiftDown = e.shiftKey; });

// ── Segment ──
ctrl('rg-seglen').addEventListener('input', e => { state.segLen = parseFloat(e.target.value); ctrl('v-seglen').textContent = state.segLen; });
ctrl('rg-thick').addEventListener('input', e => { state.thickness = parseFloat(e.target.value); ctrl('v-thick').textContent = state.thickness; });
ctrl('chk-depthcue').addEventListener('change', e => { state.depthCue = e.target.checked; });

// ── Vortex geometry ──
ctrl('rg-rsmall').addEventListener('input', e => { state.Rsmall = parseFloat(e.target.value); ctrl('v-rsmall').textContent = state.Rsmall; });
ctrl('rg-rlarge').addEventListener('input', e => { state.Rlarge = parseFloat(e.target.value); ctrl('v-rlarge').textContent = state.Rlarge; });
ctrl('rg-axislen').addEventListener('input', e => { state.axisLen = parseFloat(e.target.value); ctrl('v-axislen').textContent = state.axisLen; });
ctrl('rg-turns').addEventListener('input', e => { state.turns = parseFloat(e.target.value); ctrl('v-turns').textContent = state.turns.toFixed(1); });
ctrl('rg-easing').addEventListener('input', e => { state.easingPow = parseFloat(e.target.value); ctrl('v-easing').textContent = state.easingPow.toFixed(1); });

// ── Camera ──
ctrl('rg-tilt').addEventListener('input', e => { state.tiltDeg = parseFloat(e.target.value); ctrl('v-tilt').textContent = state.tiltDeg; });
ctrl('rg-camdist').addEventListener('input', e => { state.camDist = parseFloat(e.target.value); ctrl('v-camdist').textContent = state.camDist; });
ctrl('btn-camera-reset').addEventListener('click', () => { state.yawAngle = 0; state.pitchOffset = 0; state.rollAngle = 0; });

// ── Temporal ──
ctrl('rg-angspeed').addEventListener('input', e => { state.angSpeed = parseFloat(e.target.value); ctrl('v-angspeed').textContent = state.angSpeed.toFixed(2); });
ctrl('rg-travspeed').addEventListener('input', e => { state.travSpeed = parseFloat(e.target.value); ctrl('v-travspeed').textContent = state.travSpeed.toFixed(2); });

// ── Start ramp ──
ctrl('rg-rampdur').addEventListener('input', e => { state.rampDuration = parseFloat(e.target.value); ctrl('v-rampdur').textContent = state.rampDuration.toFixed(1); });
ctrl('rg-rampexp').addEventListener('input', e => { state.rampExponent = parseFloat(e.target.value); ctrl('v-rampexp').textContent = state.rampExponent.toFixed(1); });

// ── Coverage ──
ctrl('rg-copies').addEventListener('input', e => { state.copies = parseInt(e.target.value, 10); ctrl('v-copies').textContent = state.copies; });
ctrl('rg-phase').addEventListener('input', e => { state.phaseSpread = parseFloat(e.target.value); ctrl('v-phase').textContent = state.phaseSpread.toFixed(2); });

// ── Independence (noise) ──
ctrl('rg-noiseamt').addEventListener('input', e => { state.noiseAmt = parseFloat(e.target.value); ctrl('v-noiseamt').textContent = state.noiseAmt; });
ctrl('rg-noisespeed').addEventListener('input', e => { state.noiseSpeed = parseFloat(e.target.value); ctrl('v-noisespeed').textContent = state.noiseSpeed.toFixed(2); });
ctrl('rg-spinspeed').addEventListener('input', e => { state.spinSpeed = parseFloat(e.target.value); ctrl('v-spinspeed').textContent = state.spinSpeed.toFixed(1); });
ctrl('rg-orbitr').addEventListener('input', e => { state.orbitRadius = parseFloat(e.target.value); ctrl('v-orbitr').textContent = state.orbitRadius; });
ctrl('rg-orbitspeed').addEventListener('input', e => { state.orbitSpeed = parseFloat(e.target.value); ctrl('v-orbitspeed').textContent = state.orbitSpeed.toFixed(1); });

// ── Debug ──
ctrl('chk-debug').addEventListener('change', e => { state.showDebug = e.target.checked; });

// ── Canvas — same Preset+Width/Height standard Membrane's own
// canvas.js uses. Resizing does NOT reset the running animation
// (deliberate divergence from Membrane, documented in the Canvas
// section's own hint) — Vortex reconstructs every pixel from
// (state, animClock, camera) each frame, so nothing is lost by
// resizing, unlike Membrane's accumulated trail which a resize
// genuinely destroys. lastFrameMs IS re-stamped: a resize can stall a
// frame, and without re-stamping, the next frame's dt would absorb the
// stall as one visible jump.
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
  state.lastFrameMs = state.p.millis();
}
ctrl('sel-canvas-preset').addEventListener('change', e => {
  const p = CANVAS_PRESETS[e.target.value];
  if (!p) return;
  applyCanvasSize(p.width, p.height);
});
ctrl('num-canvas-width').addEventListener('change', e => {
  ctrl('sel-canvas-preset').value = '';
  applyCanvasSize(parseFloat(e.target.value), state.H);
});
ctrl('num-canvas-height').addEventListener('change', e => {
  ctrl('sel-canvas-preset').value = '';
  applyCanvasSize(state.W, parseFloat(e.target.value));
});

// ── Palette + Seed ──
ctrl('rmx-palette').addEventListener('dragstart', e => e.preventDefault());   // no-op guard, keeps the chip grid inert to accidental drag
buildPalette();
const bgSwatch = Organica.palette.swatch('bg', {
  initial: Organica.rgbToHex(...state.bgRGB),
  onChange: (hex, rgb) => { state.bgRGB = rgb; },
});
ctrl('num-seed').addEventListener('change', e => {
  state.seed = parseInt(e.target.value, 10) || 0;
  applySeed();
});
ctrl('btn-seed-random').addEventListener('click', randomizeSeed);

// ── Floatbar: Play/Pause, Reset, Reseed, Export ──
ctrl('btn-playpause').addEventListener('click', togglePlayPause);
updatePlayPauseIcon();
ctrl('btn-reset').addEventListener('click', resetToRest);
ctrl('btn-reseed').addEventListener('click', randomizeSeed);
Organica.popover(ctrl('btn-export'), ctrl('export-popover'));

// PNG — a genuine re-render at scale (render.js's own renderFrame(g,
// {scale}) wraps the whole draw in one g.scale(s)), not an upsampled
// bitmap: Vortex can afford this because it redraws from scratch every
// frame regardless, unlike Membrane's own accumulated-trail canvas.
ctrl('btn-export-png').addEventListener('click', () => {
  const scale = parseInt(ctrl('sel-export-scale').value, 10);
  if (scale === 1) {
    state.p.saveCanvas('vortex-' + Date.now(), 'png');
    return;
  }
  const off = state.p.createGraphics(state.W * scale, state.H * scale);
  off.noSmooth();
  renderFrame(off, { scale });
  off.canvas.toBlob(blob => {
    Organica.download(blob, Organica.stamp('vortex', 'png'));
    off.remove();
  });
});

ctrl('btn-export-svg').addEventListener('click', () => {
  const svg = buildExportSVGString();
  Organica.download(new Blob([svg], { type: 'image/svg+xml' }), Organica.stamp('vortex', 'svg'));
});

// Video — the shared Organica.recorder (organica-recorder.js). Manual stop
// only (Vortex is a continuous sim, no fixed loop). "Force it running first":
// resting has nothing moving to record, so Start triggers the same growth-ramp
// hover would; paused resumes, since the point of Video is the motion.
const vortexRecorder = Organica.recorder({
  canvas: () => state.p.canvas,
  tool: 'vortex',
  onStart: () => {
    if (state.phase === 'resting') { enterTransitioning(); updatePlayPauseIcon(); }
    else if (state.paused) { state.paused = false; state.lastFrameMs = state.p.millis(); updatePlayPauseIcon(); }
  },
  onStatus: (phase, msg) => {
    ctrl('record-hint').textContent = (msg.endsWith('.') || msg.endsWith('…')) ? msg : msg + '.';
  },
  onStateChange: (isRec) => {
    const btn = ctrl('btn-record');
    btn.textContent = isRec ? 'Stop recording' : 'Start recording';
    btn.classList.toggle('org-btn--primary', isRec);
  },
});
function toggleRecording() { vortexRecorder.toggle(); }
ctrl('btn-record').addEventListener('click', toggleRecording);

// ── Accessibility + slider polish (organica-core.js) ──
Organica.autoLabelPanel(document);
Organica.enhanceSliders(document);
