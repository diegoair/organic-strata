/* ─────────────────────────────────────────────────────────────
   Vortex — shared mutable state. Same "one plain object" pattern
   Membrane's own migration established — every module below reads/
   writes this instead of colliding on bare module-level variables the
   way explorations/vortex/index.html's own global-mode script did.

   `state.p` holds the live p5 INSTANCE (instance mode, not the
   exploration's own global mode — instance mode is what composes with
   ES modules; global mode's bare `noise()`/`TWO_PI`/etc. would collide
   across files). main.js constructs it once; every other module reads
   state.p.* instead of importing p5 itself.
   ───────────────────────────────────────────────────────────── */

export const state = {
  p: null,             // the p5 instance, set once by main.js
  W: 700, H: 700,       // canvas size — the exploration's own default

  // ── Segment ──
  segLen: 16,
  thickness: 5,

  // ── Vortex geometry (spatial) ──
  Rsmall: 15, Rlarge: 180, axisLen: 320, turns: 3, easingPow: 1,

  // ── Camera — the exploration's own 3D orbit system (drag-orbit,
  // Shift-drag-roll, Camera distance as the "zoom"). Deliberately kept
  // as the ONLY zoom/pan mechanism (see main.js's own header comment
  // for why Organica.createZoomPan is NOT layered on top). tiltDeg is
  // the slider; pitchOffset/yawAngle/rollAngle are drag-only, added on
  // top of tiltDeg rather than replacing it.
  tiltDeg: 55,
  camDist: 700,
  yawAngle: 0, pitchOffset: 0, rollAngle: 0,
  shiftDown: false,   // tracked from document keydown/keyup, not p.keyIsDown — see main.js's own note on why

  // ── Temporal ──
  angSpeed: 1.2, travSpeed: 0.15,

  // ── Start ramp (on hover/Play) ──
  rampDuration: 8, rampExponent: 3,

  // ── Toggles ──
  depthCue: true, showDebug: false,

  // ── Coverage (independent segments) ──
  copies: 260, phaseSpread: 1,

  // ── Independence (noise) ──
  noiseAmt: 18, noiseSpeed: 0.35,
  spinSpeed: 0, orbitRadius: 0, orbitSpeed: 1.5,

  // ── Palette — a variable-length colour list (RMX chip UI, ported
  // from Membrane's own — see js/palette.js), NOT a single Ink the way
  // Membrane has: Vortex's segments cycle by index through this list,
  // there is no one "ink" colour. Max 8 (raised from Membrane's 5 —
  // see palette.js's own header for why that ceiling doesn't apply
  // here), min 2. bgRGB is the canvas's own ground, same Background-
  // swatch convention as Membrane via Organica.createColorSwatch.
  colors: ['#e94f37', '#f6e8c3', '#3a86ff', '#06d6a0', '#8a4fff'],
  bgRGB: [6, 6, 6],

  // ── Seed — reproducible PRNG driving segConst's own cache and the
  // noise offset, Camouflage's own documented mulberry32-per-generation
  // precedent (see geometry.js's own applySeed()). Not present at all
  // in the exploration; a new control per Diego's own request.
  seed: 1,
  seedOffset: 0,   // derived from `seed` by applySeed(), added to every noise x-coordinate

  // ── State machine — resting → transitioning → running, plus paused.
  // Identical shape to the exploration's own module-level variables.
  phase: 'resting',
  paused: false,
  startTime: 0,
  animClock: 0,
  transitionClock: 0,
  transitionDuration: 0.6,
  lastFrameMs: 0,
  rampProgress: 0,   // transient, recomputed every 'running' frame by main.js's own p.draw before calling render.js's renderFrame()

  // Last frame's own already depth-sorted segment list — the single
  // source SVG/PNG export reads (see svgexport.js's own header for why
  // Vortex needs no accumulated-history recording the way Membrane
  // does: it redraws from scratch every frame, so this IS "what's on
  // screen right now"). Populated by render.js at the end of every
  // renderFrame() call, in every phase (resting included, as a
  // synthesized version of the seed line) so export never comes back empty.
  lastItems: [],
};
