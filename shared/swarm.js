/* ─────────────────────────────────────────────────────────────
   ORGANICA — swarm.js
   A field of marks, each hung on a spring to its own home point, driven by
   ambient motion (noise drift, a travelling wave, breath), a pointer (live
   or scripted), an entrance, and a few periodic "cycle" forces. Fast marks
   stretch into strokes, so motion reads as hatching.

   Extracted from the hub hero (index.html — the word "Organica" as a live
   stipple field) at Murmur's arrival, its second consumer: Murmur feeds it
   the marks of a Pollen / Spore / Halide SVG export, the hero feeds it dots
   sampled from the word. HERO defaults below reproduce the hero's original
   hand-tuned constants exactly.

   The engine is pure — no DOM. The caller owns the canvas, its size/DPR
   transform, the pointer events and the rAF loop; the engine only steps and
   draws in its own W×H "source" space (the caller's ctx transform maps it
   to pixels). The one DOM helper, panel(), builds the shared SCHEMA into
   panel.css markup for whichever consumer wants the controls.

   Load order: AFTER core.js (mulberry32) + noise.js (vnoise). tracks.js is
   optional — when present, entrance staggers use Organica.tracks.
   staggerDelay (same vocabulary as Trellis / Pulsar).

   Organica.swarm.create({ homes, styles, W, H, params, unit, seed })
     homes  { hx, hy, r, angle?, style?, geo? } — typed arrays or plain
            arrays, one entry per mark. r = radius (circle), half side
            (square) or scale (shape, 1 = the shape's own units).
            geo[i] = the mark's geometry for a 'shape' style: an array, one
            entry per paint, of Path2D or [cx, cy, rx, ry] (an oval — kept
            as a primitive so it rasterises like the source), in local units
            centred on the mark.
     styles [{ kind: 'circle'|'square'|'shape', color, alpha?,
               paints?, aspect?, size? }]
            'shape' paints = [{ fill?, stroke?, lw?, cap?, join?, rule? }],
            one per Path2D in geo[i]; aspect = y-scale ÷ x-scale (Pollen's
            Width/Length); size = the shape's half-extent in local units
            (sizes the speed stroke). Everything stays vector, so a re-render
            at export size is crisp. A style's color may be changed live
            (the hero re-reads --ink on a theme flip).
     unit   source units per "reference pixel" (default 1). Every distance-
            like param (drift, wave, speed, pointer force…) is multiplied by
            it, so one params object feels the same on a 1200px hero and a
            4000px Pollen export.
   → { advance(t, pointer, warm), draw(ctx), reset(), settle(), setParams(p),
       params, styles, count, pointerAt(t), time }
     advance(t, pointer) steps the fixed-timestep simulation up to time t
     (seconds since reset()). pointer = { x, y, down } in source units, or
     null (→ the scripted path, if any). warm = true lifts the per-call step
     cap (pre-rolling a loop before a recording). Deterministic for a given
     seed + inputs.
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = global.Organica = global.Organica || {};
  const TAU = Math.PI * 2;
  const DT = 1 / 60;          // one step = one 60 Hz frame (the hero's original cadence)
  const MAX_STEPS = 4;        // a stalled tab doesn't spiral — it just slows
  // Circles / squares are filled one by one up to this many marks: Chrome
  // anti-aliases one big multi-circle path ~15% lighter than the same dots
  // filled singly (measured against the source SVG — singly is byte-exact).
  // Above it, batching into one path per style buys the frame rate back.
  const BATCH_OVER = 25000;

  // ── The params vocabulary — one object for the tool panel, the hero's
  //    ?tune panel and every preset. Defaults = the hero, verbatim. ──
  const DEFAULTS = {
    // Spring
    stiffness: 0.045,       // pull toward the target per step
    damping: 0.84,          // velocity kept per step
    // Ambient
    drift: 6,               // px of noise drift (peak-to-peak, x)
    driftScale: 0.006,      // noise frequency per px
    driftSpeed: 0.25,       // noise travel per second
    waveAmp: 1.5,           // px of vertical wave
    waveSpeed: 1.3,         // rad / s
    waveScale: 0.01,        // rad per px across x
    breathAmp: 0.18,        // ± fraction of mark size
    breathSpeed: 2,         // rad / s
    // Pointer
    pointerMode: 'repel',   // repel | attract | swirl
    pointerRadius: 0.09,    // fraction of W …
    pointerMin: 80,         // … but never under this many px
    pointerForce: 3.2,
    pressMul: 9 / 3.2,      // held button multiplies the force
    // Scripted pointer (shows up in recordings)
    path: 'off',            // off | orbit | figure8 | zigzag | sweep
    pathTurns: 1,           // whole turns per cycle — keeps loops seamless
    pathPress: false,       // scripted pointer pushes as if held
    // Entrance
    entrance: 'scatter',    // scatter | centre | below | edges | none
    staggerBy: 'none',      // none | index | x | distance | noise
    stagger: 0,             // seconds spread across the field
    // Marks
    strokeAt: 0.25,         // speed (0..1 of speedRef) at which a mark becomes a stroke; ≥1 = never
    speedRef: 12,           // px / step that counts as "full speed"
    shrink: 0.4,            // size lost at full speed
    strokeLen: 1.4,         // stroke length in steps of velocity
    // Cycle
    loop: 0,                // seconds; > 0 = every periodic motion snaps to whole cycles
    cycle: 6,               // period of gravity / scatter / swing / path when loop = 0
    gravity: 0,             // px a mark sags on its own phase (Drip)
    scatter: 0,             // px marks blow out and reform, once per cycle
    swing: 0,               // radians of differential rotation about the centre (Orbit)
  };

  const HERO = Object.assign({}, DEFAULTS);

  // A frequency (rad/s) snapped so it completes a whole number of cycles
  // (≥ 1 when non-zero) in `loop` seconds — frame 0 ≡ frame N.
  function snapW(w, loop) {
    if (!(loop > 0) || !w) return w;
    const cyc = Math.max(1, Math.round(Math.abs(w) * loop / TAU));
    return Math.sign(w) * cyc * TAU / loop;
  }
  const tri = a => Math.asin(Math.sin(a)) * (2 / Math.PI);

  function create(opt) {
    const H0 = opt.homes;
    const n = H0.hx.length;
    const W = opt.W, H = opt.H;
    const unit = opt.unit || 1;
    const styles = opt.styles || [{ kind: 'circle', color: '#000' }];
    const P = Object.assign({}, DEFAULTS, opt.params || {});
    const noise = Organica.noise;

    const hx = Float32Array.from(H0.hx), hy = Float32Array.from(H0.hy);
    const r = Float32Array.from(H0.r);
    const ang = H0.angle ? Float32Array.from(H0.angle) : new Float32Array(n);
    const sty = H0.style ? Uint32Array.from(H0.style) : new Uint32Array(n);
    const geo = H0.geo || null;
    const x = new Float32Array(n), y = new Float32Array(n);
    const vx = new Float32Array(n), vy = new Float32Array(n);
    const ph = new Float32Array(n), delay = new Float32Array(n);
    const sx = new Float32Array(n), sy = new Float32Array(n);     // entrance start
    const ox = new Float32Array(n), oy = new Float32Array(n);     // scatter offset (unit vector × rand)
    const cx0 = W / 2, cy0 = H / 2, halfDiag = Math.hypot(cx0, cy0) || 1;

    // Draw order: grouped by style so each style is one path + one fill.
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((a, b) => sty[a] - sty[b]);

    let rng = Organica.mulberry32((opt.seed >>> 0) || 1);
    let simT = 0, acc = 0, lastT = 0;

    function seedParticles() {
      rng = Organica.mulberry32((opt.seed >>> 0) || 1);
      for (let i = 0; i < n; i++) {
        ph[i] = rng() * 6.28;
        const a = rng() * TAU, m = 0.35 + rng() * 0.65;
        ox[i] = Math.cos(a) * m; oy[i] = Math.sin(a) * m;
      }
    }

    function entranceStart() {
      const e = P.entrance;
      for (let i = 0; i < n; i++) {
        let px = hx[i], py = hy[i];
        if (e === 'scatter') { px = cx0 + (rng() - .5) * W; py = cy0 + (rng() - .5) * H * 2; }
        else if (e === 'centre') { const a = rng() * TAU, d = rng() * 4 * unit; px = cx0 + Math.cos(a) * d; py = cy0 + Math.sin(a) * d; }
        else if (e === 'below') { py = H + rng() * H * 0.5; px = hx[i] + (rng() - .5) * 20 * unit; }
        else if (e === 'edges') {
          const dx = hx[i] - cx0, dy = hy[i] - cy0, d = Math.hypot(dx, dy) || 1;
          px = cx0 + dx / d * halfDiag * 1.15; py = cy0 + dy / d * halfDiag * 1.15;
        }
        sx[i] = px; sy[i] = py;
      }
    }

    function computeDelays() {
      const by = P.staggerBy, amt = +P.stagger || 0;
      const T = Organica.tracks;
      for (let i = 0; i < n; i++) {
        if (!amt || by === 'none') { delay[i] = 0; continue; }
        if (by === 'x') { delay[i] = (W > 0 ? hx[i] / W : 0) * amt; continue; }
        const ctx = { index: i, count: n, cx: hx[i], cy: hy[i],
                      nx: (hx[i] - cx0) / (cx0 || 1), ny: (hy[i] - cy0) / (cy0 || 1) };
        // Distance: normalise by the half-diagonal so a corner reads as 1.
        if (by === 'distance') { delay[i] = Math.min(1, Math.hypot(hx[i] - cx0, hy[i] - cy0) / halfDiag) * amt; continue; }
        if (T && T.staggerDelay) { delay[i] = T.staggerDelay(ctx, by, amt); continue; }
        delay[i] = by === 'index' ? (n > 1 ? i / (n - 1) : 0) * amt
                 : by === 'noise' ? noise.fbm(hx[i] * 0.004, hy[i] * 0.004) * amt : 0;
      }
    }

    function reset() {
      seedParticles();
      entranceStart();
      computeDelays();
      for (let i = 0; i < n; i++) { x[i] = sx[i]; y[i] = sy[i]; vx[i] = 0; vy[i] = 0; }
      simT = 0; acc = 0; lastT = 0;
    }

    // Scripted pointer position at time t (source units), or null.
    function pointerAt(t) {
      if (!P.path || P.path === 'off') return null;
      const period = P.loop > 0 ? P.loop : P.cycle;
      const a = TAU * Math.max(1, Math.round(P.pathTurns || 1)) * t / period;
      switch (P.path) {
        case 'orbit':   { const rr = Math.min(W, H) * 0.3; return { x: cx0 + Math.cos(a) * rr, y: cy0 + Math.sin(a) * rr, down: !!P.pathPress }; }
        case 'figure8': return { x: cx0 + Math.sin(a) * W * 0.3, y: cy0 + Math.sin(a * 2) * H * 0.25, down: !!P.pathPress };
        case 'zigzag':  return { x: cx0 + tri(a) * W * 0.38, y: cy0 + tri(a * 3) * H * 0.3, down: !!P.pathPress };
        case 'sweep':   return { x: cx0 + tri(a) * W * 0.45, y: cy0 + Math.sin(a * 2) * H * 0.08, down: !!P.pathPress };
      }
      return null;
    }

    function stepOnce(t, ptr) {
      const loop = P.loop;
      const period = loop > 0 ? loop : P.cycle;
      const k = P.stiffness, damp = P.damping;
      const drift = P.drift * unit, dS = P.driftScale / unit;
      const waveA = P.waveAmp * unit, waveW = snapW(P.waveSpeed, loop), waveK = P.waveScale / unit;
      // Noise travel: linear when free-running (the hero's original), a
      // circle through the noise field when looping (frame 0 ≡ frame N).
      const circ = loop > 0 && P.driftSpeed > 0;
      const cr = circ ? P.driftSpeed * loop / TAU : 0;
      const ca = circ ? TAU * t / loop : 0;
      const nOffX = circ ? cr * Math.cos(ca) : P.driftSpeed * t;
      const nOffY = circ ? cr * Math.sin(ca) : 0;
      const tN = t / period;
      const scatA = P.scatter * unit * (0.5 - 0.5 * Math.cos(TAU * tN));
      const swingA = P.swing * Math.sin(TAU * tN);
      const grav = P.gravity * unit;

      const R = Math.max(P.pointerMin * unit, W * P.pointerRadius);
      const hasP = ptr && ptr.x > -1e3;
      const force = P.pointerForce * unit * (ptr && ptr.down ? P.pressMul : 1);
      const mode = P.pointerMode;

      for (let i = 0; i < n; i++) {
        if (t < delay[i]) continue;            // not yet released by the stagger
        const px = hx[i], py = hy[i];
        let tx = px, ty = py;
        if (swingA) {                          // Orbit: inner marks swing further
          const dx = px - cx0, dy = py - cy0;
          const a = swingA * (1 - 0.8 * Math.min(1, Math.hypot(dx, dy) / halfDiag));
          const c = Math.cos(a), s = Math.sin(a);
          tx = cx0 + dx * c - dy * s; ty = cy0 + dx * s + dy * c;
        }
        // Internal pressure: a slow breath through the field, + drift from noise
        const nv = noise.vnoise(px * dS + nOffX, py * dS + nOffY);
        tx += (nv - .5) * drift;
        ty += Math.sin(t * waveW + px * waveK) * waveA;
        if (grav) {                            // Drip: hang, then fall, on each mark's own phase
          const g = 0.5 - 0.5 * Math.cos(TAU * tN + ph[i]);
          ty += grav * g * g * g;
        }
        if (scatA) { tx += ox[i] * scatA; ty += oy[i] * scatA; }

        if (hasP) {
          const dx = x[i] - ptr.x, dy = y[i] - ptr.y, dd = dx * dx + dy * dy;
          if (dd < R * R) {
            const d = Math.sqrt(dd);
            const f = (1 - d / R) * force;
            const inv = 1 / (d + .01);
            if (mode === 'attract') { vx[i] -= dx * inv * f * 0.5; vy[i] -= dy * inv * f * 0.5; }
            else if (mode === 'swirl') { vx[i] += -dy * inv * f; vy[i] += dx * inv * f; }
            else { vx[i] += dx * inv * f; vy[i] += dy * inv * f; }
          }
        }
        vx[i] += (tx - x[i]) * k; vy[i] += (ty - y[i]) * k;
        vx[i] *= damp; vy[i] *= damp;
        x[i] += vx[i]; y[i] += vy[i];
      }
    }

    // Advance the simulation to time t (seconds since reset).
    function advance(t, ptr, warm) {
      if (t < lastT) { acc = 0; }                // time went backwards → just step from here
      acc += Math.max(0, t - lastT); lastT = t;
      const cap = warm ? Infinity : MAX_STEPS;
      let steps = 0;
      while (acc >= DT - 1e-9 && steps < cap) {
        const p = ptr || pointerAt(simT);
        stepOnce(simT, p);
        simT += DT; acc -= DT; steps++;
      }
      if (steps === cap) acc = 0;
    }

    function draw(ctx) {
      const breathW = snapW(P.breathSpeed, P.loop), breathA = P.breathAmp;
      const ref = P.speedRef * unit, shrink = P.shrink, sAt = P.strokeAt, sLen = P.strokeLen;
      const t = simT;
      const m = ctx.getTransform();
      const batch = n > BATCH_OVER;
      let cur = -1, st = null, open = false;
      const fast = [];

      function flush() {
        if (!open) return;
        ctx.fill(); open = false;
      }
      for (let o = 0; o < n; o++) {
        const i = order[o];
        if (sty[i] !== cur) {
          flush();
          cur = sty[i]; st = styles[cur] || styles[0];
          ctx.fillStyle = st.color; ctx.globalAlpha = st.alpha == null ? 1 : st.alpha;
          if (st.kind !== 'shape' && batch) { ctx.beginPath(); open = true; }
        }
        const sp = Math.min(1, Math.hypot(vx[i], vy[i]) / ref);
        const s = r[i] * (1 + breathA * Math.sin(t * breathW + ph[i])) * (1 - sp * shrink);
        if (sp > sAt) { fast.push(i, s); continue; }   // fast marks → strokes, drawn after
        if (st.kind === 'circle') {
          if (batch) { ctx.moveTo(x[i] + s, y[i]); ctx.arc(x[i], y[i], Math.max(0, s), 0, 6.2832); }
          else { ctx.beginPath(); ctx.arc(x[i], y[i], Math.max(0, s), 0, 6.2832); ctx.fill(); }
        }
        else if (st.kind === 'square') {
          if (batch) ctx.rect(x[i] - s, y[i] - s, 2 * s, 2 * s);
          else ctx.fillRect(x[i] - s, y[i] - s, 2 * s, 2 * s);
        }
        else if (st.kind === 'shape' && geo && geo[i]) {
          const c = Math.cos(ang[i]) * s, sn = Math.sin(ang[i]) * s, asp = st.aspect || 1;
          // base m is a scale + translate (DPR / fit) — compose translate·rotate·scale onto it
          ctx.setTransform(m.a * c, m.d * sn, -m.a * sn * asp, m.d * c * asp, m.a * x[i] + m.e, m.d * y[i] + m.f);
          const g = geo[i], pts = st.paints;
          for (let q = 0; q < g.length; q++) {
            const pt = pts[q] || pts[0];
            let path = g[q];
            if (Array.isArray(path)) {         // [cx, cy, rx, ry] — an oval primitive
              ctx.beginPath(); ctx.ellipse(path[0], path[1], path[2], path[3], 0, 0, 6.2832); path = null;
            }
            if (pt.fill) { ctx.fillStyle = pt.fill; path ? ctx.fill(path, pt.rule || 'nonzero') : ctx.fill(); }
            if (pt.stroke) {
              ctx.strokeStyle = pt.stroke; ctx.lineWidth = pt.lw || 1;
              ctx.lineCap = pt.cap || 'butt'; ctx.lineJoin = pt.join || 'miter';
              path ? ctx.stroke(path) : ctx.stroke();
            }
          }
        }
      }
      flush();
      ctx.setTransform(m);
      // Motion reads as marks: each fast mark is a round-capped stroke along its velocity.
      ctx.lineCap = 'round';
      for (let f = 0; f < fast.length; f += 2) {
        const i = fast[f], s = fast[f + 1];
        const stl = styles[sty[i]] || styles[0];
        const size = stl.kind === 'shape' ? (stl.size || 1) * s * 0.5 : s;
        ctx.strokeStyle = stl.color; ctx.globalAlpha = stl.alpha == null ? 1 : stl.alpha;
        ctx.lineWidth = Math.max(0.5, size * 1.6);
        ctx.beginPath(); ctx.moveTo(x[i], y[i]); ctx.lineTo(x[i] - vx[i] * sLen, y[i] - vy[i] * sLen); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function setParams(p) {
      const prevEntrance = P.entrance, prevBy = P.staggerBy, prevSt = P.stagger;
      Object.assign(P, p);
      if (P.staggerBy !== prevBy || P.stagger !== prevSt) computeDelays();
      if (P.entrance !== prevEntrance) entranceStart();
    }

    // Park every mark at home, at rest (reduced motion / static frames).
    function settle() {
      for (let i = 0; i < n; i++) { x[i] = hx[i]; y[i] = hy[i]; vx[i] = 0; vy[i] = 0; delay[i] = 0; }
    }

    reset();
    return { advance, draw, reset, settle, setParams, params: P, styles, count: n, pointerAt,
             get time() { return simT; } };
  }

  // ── The control schema — the same groups drive Murmur's panel and the
  //    hub hero's ?tune panel, so a feel dialled in one pastes into the other.
  //    (`loop` is not here: it lives on each consumer's own Loop control.) ──
  const SCHEMA = [
    { title: 'Spring', hint: 'snappy ↔ syrupy', controls: [
      { key: 'stiffness', label: 'Stiffness', min: 0.005, max: 0.2, step: 0.001 },
      { key: 'damping', label: 'Damping', min: 0.5, max: 0.98, step: 0.01 },
    ]},
    { title: 'Ambient', hint: 'alive at rest', controls: [
      { key: 'drift', label: 'Drift', min: 0, max: 60, step: 0.5 },
      { key: 'driftScale', label: 'Drift scale', min: 0.001, max: 0.03, step: 0.0005 },
      { key: 'driftSpeed', label: 'Drift speed', min: 0, max: 2, step: 0.01 },
      { key: 'waveAmp', label: 'Wave', min: 0, max: 30, step: 0.1 },
      { key: 'waveSpeed', label: 'Wave speed', min: 0, max: 6, step: 0.05 },
      { key: 'waveScale', label: 'Wave length', min: 0, max: 0.05, step: 0.001 },
      { key: 'breathAmp', label: 'Breath', min: 0, max: 0.8, step: 0.01 },
      { key: 'breathSpeed', label: 'Breath speed', min: 0, max: 8, step: 0.1 },
    ]},
    { title: 'Pointer', hint: 'how the field answers the hand', controls: [
      { key: 'pointerMode', label: 'Mode', options: ['repel', 'attract', 'swirl'] },
      { key: 'pointerRadius', label: 'Radius', min: 0.02, max: 0.4, step: 0.005 },
      { key: 'pointerForce', label: 'Force', min: 0, max: 15, step: 0.1 },
      { key: 'pressMul', label: 'Press ×', min: 1, max: 6, step: 0.1 },
      { key: 'path', label: 'Scripted', options: ['off', 'orbit', 'figure8', 'zigzag', 'sweep'] },
      { key: 'pathTurns', label: 'Turns', min: 1, max: 4, step: 1 },
      { key: 'pathPress', label: 'Scripted press', check: true },
    ]},
    { title: 'Entrance', hint: 'how the image assembles', controls: [
      { key: 'entrance', label: 'From', options: ['scatter', 'centre', 'below', 'edges', 'none'] },
      { key: 'staggerBy', label: 'Stagger by', options: ['none', 'index', 'x', 'distance', 'noise'] },
      { key: 'stagger', label: 'Stagger', min: 0, max: 4, step: 0.05 },
    ]},
    { title: 'Marks', hint: 'when motion reads as hatching', controls: [
      { key: 'strokeAt', label: 'Stroke at', min: 0, max: 1.01, step: 0.01 },
      { key: 'speedRef', label: 'Full speed', min: 2, max: 40, step: 0.5 },
      { key: 'shrink', label: 'Shrink', min: 0, max: 0.9, step: 0.01 },
      { key: 'strokeLen', label: 'Stroke length', min: 0, max: 4, step: 0.1 },
    ]},
    { title: 'Cycle', hint: 'periodic forces', controls: [
      { key: 'cycle', label: 'Period', min: 1, max: 30, step: 0.5 },
      { key: 'gravity', label: 'Gravity', min: 0, max: 120, step: 1 },
      { key: 'scatter', label: 'Scatter', min: 0, max: 400, step: 5 },
      { key: 'swing', label: 'Swing', min: 0, max: 1.5, step: 0.01 },
    ]},
  ];

  // Motion modes — one-click starting points mapped to ANIMATION-SYSTEM.md's
  // physics patterns. Each is a partial params object laid over DEFAULTS.
  const MODES = {
    Pulse:    { breathAmp: 0.45, breathSpeed: 3, stiffness: 0.08, damping: 0.8, drift: 2, waveAmp: 0.5 },
    Drip:     { gravity: 40, damping: 0.9, stiffness: 0.03, drift: 2, waveAmp: 0, breathAmp: 0.1 },
    Assemble: { entrance: 'centre', staggerBy: 'distance', stagger: 2.2, stiffness: 0.035, damping: 0.86 },
    Swarm:    { stiffness: 0.012, damping: 0.9, drift: 40, driftScale: 0.004, driftSpeed: 0.6, waveAmp: 4 },
    Drift:    { waveAmp: 10, waveSpeed: 1.6, waveScale: 0.012, drift: 8, driftSpeed: 0.4 },
    Orbit:    { swing: 0.6, stiffness: 0.06, damping: 0.82, drift: 3 },
  };

  // Build the schema into panel.css markup inside `target` (an element).
  // onChange(key, value) fires on every edit. Returns { sync(params) } to
  // refresh every control after a preset / mode load. idPrefix keeps ids unique.
  function panel(target, params, onChange, idPrefix) {
    const pre = idPrefix || 'sw-';
    const doc = target.ownerDocument;
    const rows = [];
    const fmt = (c, v) => (c.step >= 1 ? String(Math.round(v)) : String(+(+v).toFixed(c.step < 0.001 ? 4 : c.step < 0.01 ? 3 : 2)));
    SCHEMA.forEach(g => {
      const sec = doc.createElement('div');
      sec.className = 'panel-section';
      sec.innerHTML = '<h3>' + g.title + ' <span class="hint">' + g.hint + '</span></h3>';
      g.controls.forEach(c => {
        const id = pre + c.key;
        let row;
        if (c.check) {
          row = doc.createElement('label'); row.className = 'check-row';
          row.innerHTML = '<input type="checkbox" id="' + id + '"><span>' + c.label + '</span>';
          const el = row.querySelector('input');
          el.addEventListener('change', () => onChange(c.key, el.checked));
          rows.push({ c, sync: p => { el.checked = !!p[c.key]; } });
        } else if (c.options) {
          row = doc.createElement('div'); row.className = 'ctrl-row';
          row.innerHTML = '<label class="ctrl-label" for="' + id + '">' + c.label + '</label><select class="panel-select" id="' + id + '">' +
            c.options.map(o => '<option value="' + o + '">' + o + '</option>').join('') + '</select>';
          const el = row.querySelector('select');
          el.addEventListener('change', () => onChange(c.key, el.value));
          rows.push({ c, sync: p => { el.value = p[c.key]; } });
        } else {
          row = doc.createElement('div'); row.className = 'ctrl-row';
          row.innerHTML = '<label class="ctrl-label" for="' + id + '">' + c.label + '</label>' +
            '<input type="range" id="' + id + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '">' +
            '<span class="ctrl-val"></span>';
          const el = row.querySelector('input'), out = row.querySelector('.ctrl-val');
          el.addEventListener('input', () => { out.textContent = fmt(c, el.value); onChange(c.key, parseFloat(el.value)); });
          rows.push({ c, sync: p => { el.value = p[c.key]; out.textContent = fmt(c, p[c.key]); } });
        }
        sec.appendChild(row);
      });
      target.appendChild(sec);
    });
    const api = { sync(p) { rows.forEach(r => r.sync(p)); } };
    api.sync(params);
    return api;
  }

  // The params worth copying: only what differs from DEFAULTS.
  function diff(p) {
    const out = {};
    Object.keys(DEFAULTS).forEach(k => { if (p[k] !== DEFAULTS[k]) out[k] = p[k]; });
    return out;
  }

  Organica.swarm = { create, DEFAULTS, HERO, DT, SCHEMA, MODES, panel, diff };
})(window);
