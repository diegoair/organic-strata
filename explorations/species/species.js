/* ─────────────────────────────────────────────────────────────────────────────
 * species.js — parametric organisms: Flower · Jellyfish · Fish.
 *
 * EXPLORATION (Oct 1, 2026): lives in explorations/species/, NOT shared/, on purpose —
 * no second consumer yet, so no shared API commitment. See NOTES.md next to it.
 *
 * One idea: an organism is SKELETON + BODY + APPENDAGES + SKIN, defined as 3-D
 * parametric surfaces, so one form definition feeds several renderers.
 *
 *   build(morph, P)            → mesh { quads:[{p:[[x,y,z]×4], u}], centre, radius }
 *   motion(morph, P, tNorm)    → a copy of P with periodic offsets (seamless loop)
 *   scene(mesh, V, W, H)       → items [{pts:[x,y,…], fill}] depth-sorted, run-merged
 *   itemsSVG(items, W, H, bg)  → SVG string        (preview === export, byte for byte)
 *   drawItems(ctx, items, s)   → Canvas2D, same items
 *
 * Backends today (Phase 1): V.shade 'flat' (ortho, unlit, banded — print-friendly)
 * and 'lit' (perspective camera, Lambert + gloss, optional posterised levels).
 * A Three.js backend (Phase 3) reads the same mesh.
 *
 * Everything is a pure function of (P, t): rebuilt every frame, seeded, no
 * accumulation. Every periodic term runs a whole number of cycles per loop.
 *
 * LOAD ORDER: core.js (Organica.mulberry32) → species.js → tool script (<script src="/explorations/species/species.js">).
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  // ── Colour ──────────────────────────────────────────────────────────────────
  function hex2rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  // Cyclic ramp: u wraps, so a phase offset of exactly 1 loops seamlessly.
  function rampAt(stops, u) {
    const n = stops.length;
    u = ((u % 1) + 1) % 1;
    const f = u * n, i = Math.floor(f), t = smooth(f - i);
    const a = stops[i % n], b = stops[(i + 1) % n];
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  // Non-cyclic ramp, t in 0..1 clamped (used by the facing-angle skin).
  function rampClamp(stops, t) {
    t = clamp(t, 0, 1);
    const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), k = smooth(f - i);
    const a = stops[i], b = stops[i + 1];
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }

  const pingpong = (x) => { x = ((x % 1) + 1) % 1; return x < 0.5 ? x * 2 : 2 - 2 * x; };   // ping-pong: continuous at the wrap

  const RAMPS = {
    reel2: ['#2c46ff', '#a6b6ff', '#efe6d4', '#4f9a1c', '#ece0c6', '#ff8aa3', '#e0003f', '#3a1346'],
    reel:  ['#1f3cf0', '#f0ead8', '#3f9a3a', '#f3c9d1', '#d6234a'],
    bloom: ['#2f45e0', '#e9eef8', '#58a65c', '#e3405e'],
    abyss: ['#0b1a4a', '#2a6fdb', '#7fe3e0', '#f2fbff', '#6a3fc8'],
    koi:   ['#f4efe6', '#e8552a', '#f4efe6', '#1c1c1c', '#e8552a'],
    ember: ['#2a0f2e', '#c2304a', '#f59e3a', '#fff1c4'],
    lagoon:['#0f6e6a', '#7fd6b2', '#f3e9c6', '#e07a5f'],
    mono:  ['#1c1c1c', '#8a8a8a', '#f2f2f2', '#555555'],
  };

  // ── Parameter schemas (key, label, range, default). `int` keys are rounded. ──
  const COMMON_DEFAULTS = { wobblePhase: 0, seed: 7, jitter: 0, ramp: 'bloom', rampPhase: 0, rampScale: 1, skin: 'surface', facePow: 1.5, stemFade: 0.3, stemBands: 0, stemPhase: 0, stemScroll: 0, pods: 0 };

  const SCHEMA = {
    flower: [
      { key: 'petals',  label: 'Lobes',        min: 3,    max: 24,  step: 1,    int: true, def: 12 },
      { key: 'podLen',  label: 'Lobe length',  min: 0.08, max: 0.5, step: 0.005,def: 0.24, for: 'pods' },
      { key: 'podWide', label: 'Lobe width',   min: 0.03, max: 0.25,step: 0.005,def: 0.11, for: 'pods' },
      { key: 'podThick',label: 'Lobe thickness',min: 0.03,max: 0.25,step: 0.005,def: 0.1,  for: 'pods' },
      { key: 'ringR',   label: 'Ring radius',  min: 0.12, max: 0.6, step: 0.005,def: 0.34, for: 'pods' },
      { key: 'lift',    label: 'Cup angle °',  min: -20,  max: 85,  step: 1,    def: 30,   for: 'pods' },
      { key: 'inner',   label: 'Inner teeth',  min: 0,    max: 1,   step: 0.01, def: 0.45, for: 'pods' },
      { key: 'wobble',  label: 'Lobe circling °', min: 0, max: 45,  step: 1,    def: 0,    for: 'pods' },
      { key: 'wobbleWaves', label: 'Circling waves', min: 0, max: 6, step: 1,   int: true, def: 1, for: 'pods' },
      { key: 'wobbleSpeed', label: 'Circling speed', min: 0, max: 8, step: 1,   int: true, def: 2, for: 'pods' },
      { key: 'lobe',    label: 'Groove depth', min: 0,    max: 0.6, step: 0.01, def: 0.25, for: 'surface' },
      { key: 'puff',    label: 'Puffiness',    min: 0,    max: 1,   step: 0.01, def: 0.6,  for: 'surface' },
      { key: 'thick',   label: 'Thickness',    min: 0.02, max: 0.4, step: 0.01, def: 0.14, for: 'surface' },
      { key: 'radius',  label: 'Head radius',  min: 0.25, max: 0.9, step: 0.01, def: 0.55, for: 'surface' },
      { key: 'cup',     label: 'Cup depth',    min: -0.5, max: 0.9, step: 0.01, def: 0.3,  for: 'surface' },
      { key: 'cupPow',  label: 'Cup curve',    min: 0.8,  max: 4,   step: 0.05, def: 2,    for: 'surface' },
      { key: 'core',    label: 'Core dimple',  min: 0,    max: 0.4, step: 0.01, def: 0.08, for: 'surface' },
      { key: 'tier',    label: 'Tiers',        min: 0,    max: 0.2, step: 0.005,def: 0.03, for: 'surface' },
      { key: 'stemLen', label: 'Stem length',  min: 0.4,  max: 3.6, step: 0.05, def: 1.5 },
      { key: 'stemR',   label: 'Stem radius',  min: 0.03, max: 0.2, step: 0.005,def: 0.07 },
      { key: 'bend',    label: 'Stem bend',    min: -0.8, max: 0.8, step: 0.01, def: 0.3 },
      { key: 'stemBands',label:'Stem bands',   min: 0,    max: 6,   step: 0.1,  def: 0 },
      { key: 'stemScroll',label:'Band scroll',  min: 0,    max: 8,   step: 1,    int: true, def: 0 },
      { key: 'tilt',    label: 'Head tilt °',  min: -80,  max: 80,  step: 1,    def: 28 },
      { key: 'nod',     label: 'Head nod °',   min: -120, max: 120, step: 1,    def: 0 },
      { key: 'spin',    label: 'Head spin',    min: 0,    max: 6.3, step: 0.05, def: 0 },
      { key: 'detail',  label: 'Detail',       min: 1,    max: 3,   step: 0.5,  def: 1.5 },
    ],
    jelly: [
      { key: 'lobes',    label: 'Margin lobes', min: 4,   max: 24,  step: 1,    int: true, def: 12 },
      { key: 'lobe',     label: 'Lobe depth',   min: 0,   max: 0.4, step: 0.01, def: 0.1 },
      { key: 'bellW',    label: 'Bell width',   min: 0.4, max: 1.1, step: 0.01, def: 0.78 },
      { key: 'bellH',    label: 'Bell height',  min: 0.2, max: 1.1, step: 0.01, def: 0.62 },
      { key: 'dome',     label: 'Dome shape',   min: 0.5, max: 2.5, step: 0.05, def: 1.2 },
      { key: 'pulse',    label: 'Contraction',  min: 0,   max: 1,   step: 0.01, def: 0 },
      { key: 'tentacles',label: 'Tentacles',    min: 0,   max: 48,  step: 1,    int: true, def: 24 },
      { key: 'tentLen',  label: 'Tentacle len', min: 0.3, max: 2.2, step: 0.05, def: 1.3 },
      { key: 'arms',     label: 'Oral arms',    min: 0,   max: 8,   step: 1,    int: true, def: 4 },
      { key: 'sway',     label: 'Sway',         min: 0,   max: 0.6, step: 0.01, def: 0.12 },
      { key: 'swayPhase',label: 'Sway phase',   min: 0,   max: 6.3, step: 0.05, def: 0 },
    ],
    fish: [
      { key: 'length',  label: 'Length',       min: 0.8,  max: 1.8, step: 0.01, def: 1.4 },
      { key: 'girth',   label: 'Girth',        min: 0.08, max: 0.5, step: 0.01, def: 0.26 },
      { key: 'depth',   label: 'Body depth',   min: 0.08, max: 0.6, step: 0.01, def: 0.3 },
      { key: 'taper',   label: 'Peak position',min: 0.4,  max: 1.2, step: 0.01, def: 0.62 },
      { key: 'tailLen', label: 'Tail length',  min: 0.1,  max: 0.6, step: 0.01, def: 0.3 },
      { key: 'tailH',   label: 'Tail height',  min: 0.1,  max: 0.7, step: 0.01, def: 0.36 },
      { key: 'fork',    label: 'Tail fork',    min: 0,    max: 1,   step: 0.01, def: 0.5 },
      { key: 'dorsal',  label: 'Dorsal fin',   min: 0,    max: 0.5, step: 0.01, def: 0.2 },
      { key: 'pectoral',label: 'Pectoral fins',min: 0,    max: 0.5, step: 0.01, def: 0.2 },
      { key: 'amp',     label: 'Swim amplitude',min: 0,   max: 0.5, step: 0.01, def: 0.14 },
      { key: 'envelope',label: 'Envelope exp', min: 0,    max: 4,   step: 0.1,  def: 1.6 },
      { key: 'waves',   label: 'Body waves',   min: 0.3,  max: 2.5, step: 0.05, def: 1 },
      { key: 'swim',    label: 'Swim phase',   min: 0,    max: 6.3, step: 0.05, def: 0 },
    ],
  };

  function defaults(morph) {
    const o = Object.assign({}, COMMON_DEFAULTS);
    SCHEMA[morph].forEach(s => { o[s.key] = s.def; });
    return o;
  }

  // Curated starting points, per morphology (override defaults).
  const PRESETS = {
    flower: {
      'Reel pods':   { pods: 1, petals: 14, podLen: 0.37, podWide: 0.235, podThick: 0.22, ringR: 0.32, lift: 42, inner: 0.5, wobble: 16, wobbleWaves: 1, wobbleSpeed: 2, detail: 1,
                       stemLen: 3.2, stemR: 0.085, bend: 0.5, stemBands: 1.4, stemScroll: 4, tilt: 6, nod: 30,
                       skin: 'facing', ramp: 'reel2', facePow: 1, rampScale: 1.3,
                       _view: { pitch: 22, yaw: 0, zoom: 1.7, persp: 0.7, gloss: 0, light: -35, panY: -0.2, bg: 'reel' } },
      'Reel bloom':  { petals: 14, lobe: 0.17, puff: 0.9, thick: 0.32, detail: 2, radius: 0.55, cup: 0.32, cupPow: 2, core: 0.07, tier: 0.035,
                       stemLen: 3.2, stemR: 0.085, bend: 0.5, tilt: 14, nod: 34, skin: 'facing', ramp: 'reel', facePow: 1.45, stemFade: 0.32,
                       _view: { pitch: 28, yaw: 0, zoom: 1.65, persp: 0.7, gloss: 0, light: -35, panY: -0.18, bg: 'reel' } },
      'Daisy':       { petals: 16, lobe: 0.32, puff: 0.2, thick: 0.05, cup: 0.1, cupPow: 1.6, core: 0.3, tier: 0, ramp: 'lagoon', tilt: 12, stemR: 0.04 },
      'Dahlia':      { petals: 21, lobe: 0.12, puff: 0.5, thick: 0.1, cup: 0.5, cupPow: 1.4, core: 0.04, tier: 0.08, ramp: 'ember', tilt: 40, stemR: 0.05 },
      'Lotus cup':   { petals: 8, lobe: 0.45, puff: 0.4, thick: 0.08, cup: 0.75, cupPow: 2.8, core: 0.2, tier: 0.02, ramp: 'abyss', tilt: 20, stemLen: 1.1, stemR: 0.05 },
    },
    jelly: {
      'Moon':        { ramp: 'abyss' },
      'Sea nettle':  { lobes: 16, lobe: 0.18, bellW: 0.9, bellH: 0.5, tentacles: 36, tentLen: 1.8, arms: 6, ramp: 'ember' },
      'Comb':        { lobes: 8, lobe: 0.06, bellW: 0.6, bellH: 0.9, dome: 0.8, tentacles: 8, arms: 0, ramp: 'lagoon' },
    },
    fish: {
      'Koi':         { ramp: 'koi', fork: 0.2, dorsal: 0.14 },
      'Tuna':        { girth: 0.2, depth: 0.34, tailLen: 0.22, tailH: 0.5, fork: 0.95, envelope: 3, amp: 0.08, ramp: 'abyss' },
      'Eel':         { length: 1.8, girth: 0.07, depth: 0.08, taper: 0.9, tailLen: 0.12, tailH: 0.1, fork: 0, dorsal: 0.06, pectoral: 0.04, amp: 0.2, envelope: 0.2, waves: 1.6, ramp: 'lagoon' },
    },
  };

  // Where each morphology lives in model space (centre/radius are FIXED per
  // morphology, never derived from the animated geometry — so a pulsing bell
  // doesn't make the whole view breathe).
  const FRAME = {
    flower: { centre: [0, -0.35, 0], radius: 1.25 },
    jelly:  { centre: [0, -0.55, 0], radius: 1.45 },
    fish:   { centre: [0, 0, 0],     radius: 0.95 },
  };

  // ── Mesh helpers ────────────────────────────────────────────────────────────
  // Rotate about Z then X then Y (model-space orientation of a sub-part).
  function rotZ(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }
  function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

  // Quad grid from a (nu+1)×(nv+1) array of points + a colour coordinate fn.
  function gridQuads(out, pts, nu, nv, uAt, wrapV) {
    const W = nv + 1;
    const vmax = wrapV ? nv : nv;      // wrapV: last column already duplicates the first
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < vmax; j++) {
        const a = pts[i * W + j], b = pts[(i + 1) * W + j], c = pts[(i + 1) * W + j + 1], d = pts[i * W + j + 1];
        out.push({ p: [a, b, c, d], u: uAt(i + 0.5, j + 0.5) });
      }
    }
  }

  // Cubic bézier point + tangent.
  function bez(p0, p1, p2, p3, t) {
    const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return [0, 1, 2].map(k => a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k]);
  }

  // Tube along a polyline of points: returns quads, radius fn r(s).
  function tube(out, path, radiusAt, sides, uAt) {
    const n = path.length;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const tl = Math.hypot(t[0], t[1], t[2]) || 1; t = [t[0] / tl, t[1] / tl, t[2] / tl];
      // any perpendicular frame
      let ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let nx = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]];
      const nl = Math.hypot(nx[0], nx[1], nx[2]) || 1; nx = [nx[0] / nl, nx[1] / nl, nx[2] / nl];
      const bx = [t[1] * nx[2] - t[2] * nx[1], t[2] * nx[0] - t[0] * nx[2], t[0] * nx[1] - t[1] * nx[0]];
      const r = radiusAt(i / (n - 1));
      for (let j = 0; j <= sides; j++) {
        const ang = (j / sides) * TAU, c = Math.cos(ang) * r, s = Math.sin(ang) * r;
        pts.push([path[i][0] + nx[0] * c + bx[0] * s, path[i][1] + nx[1] * c + bx[1] * s, path[i][2] + nx[2] * c + bx[2] * s]);
      }
    }
    const start = out.length;
    gridQuads(out, pts, n - 1, sides, (i, j) => uAt(i / (n - 1), j / sides), true);
    for (let k = start; k < out.length; k++) out[k].L = Math.floor((k - start) / sides) / (n - 1);   // 0 = tail end, 1 = head end
  }


  // ── Pods head: a ring of separate egg-shaped lobes (+ a ring of small inner teeth) ──
  function ellipsoid(out, c0, E1, E2, E3, a, b, c, nU, nV, innerAO) {
    const pts = [];
    for (let i = 0; i <= nU; i++) {
      const psi = (Math.PI * i) / nU, cp = Math.cos(psi), sp = Math.max(0, Math.sin(psi));
      for (let j = 0; j <= nV; j++) {
        const tau = (j / nV) * TAU, eg = 0.5 + 0.5 * smooth(clamp((cp + 1) / 2, 0, 1)), u = sp * Math.cos(tau) * eg, v = sp * Math.sin(tau) * eg;   // egg: narrow at the hole end, plump at the tip
        pts.push([c0[0] + E1[0] * a * cp + E2[0] * b * u + E3[0] * c * v,
                  c0[1] + E1[1] * a * cp + E2[1] * b * u + E3[1] * c * v,
                  c0[2] + E1[2] * a * cp + E2[2] * b * u + E3[2] * c * v]);
      }
    }
    const h0 = out.length;
    gridQuads(out, pts, nU, nV, (i) => i / nU, true);
    for (let k = h0; k < out.length; k++) {                     // inner (hole-side) end darker, like a crevice
      const i = Math.floor((k - h0) / nV), cp = Math.cos(Math.PI * (i + 0.5) / nU);   // +1 = outer tip
      out[k].ao = lerp(1 - innerAO, 1, smooth(clamp((cp + 1) / 2, 0, 1)));
    }
  }
  function podsHead(quads, P, orient) {
    const N = P.petals, nU = Math.round(18 * P.detail), nV = Math.round(26 * P.detail);
    const D2R = Math.PI / 180;
    // Each lobe is pinned at its hole-side end; its axis precesses on a cone, so the tip traces a circle.
    // The phase advances around the ring (wobbleWaves whole waves) → a travelling circular wave.
    const ring = (count, R0, a, b, c, liftDeg, y0, ao, wobDeg, waves, phase) => {
      const l0 = liftDeg * D2R, anchorR = R0 - a * Math.cos(l0);
      for (let k = 0; k < count; k++) {
        const th = (k / count) * TAU, er = [Math.cos(th), 0, Math.sin(th)], et = [-Math.sin(th), 0, Math.cos(th)];
        const f = phase + waves * (th - P.spin);          // phase follows the lobe's position after the head spin → whole lobe-steps close the loop
        const ph = l0 + wobDeg * D2R * Math.sin(f), sd = wobDeg * D2R * Math.cos(f);       // lift + side-sweep = a circle
        const cph = Math.cos(ph), sph = Math.sin(ph);
        let E1 = [er[0] * cph, sph, er[2] * cph], E3 = [-er[0] * sph, cph, -er[2] * sph], E2 = et;
        const cs = Math.cos(sd), sn = Math.sin(sd);                                         // swing about the lobe normal
        const E1b = [E1[0] * cs + E2[0] * sn, E1[1] * cs + E2[1] * sn, E1[2] * cs + E2[2] * sn];
        const E2b = [-E1[0] * sn + E2[0] * cs, -E1[1] * sn + E2[1] * cs, -E1[2] * sn + E2[2] * cs];
        const anchor = [er[0] * anchorR, y0, er[2] * anchorR];
        const c0 = [anchor[0] + E1b[0] * a, anchor[1] + E1b[1] * a, anchor[2] + E1b[2] * a];
        const start = quads.length;
        ellipsoid(quads, c0, E1b, E2b, E3, a, b, c, nU, nV, ao);
        for (let q = start; q < quads.length; q++) quads[q].p = quads[q].p.map(orient);
      }
    };
    ring(N, P.ringR, P.podLen, P.podWide, P.podThick, P.lift, 0, 0.5, P.wobble, P.wobbleWaves, P.wobblePhase);
    if (P.inner > 0.01) ring(N, P.ringR * 0.36, P.podLen * 0.34 * P.inner + 0.01, P.podWide * 0.34 * P.inner + 0.008, P.podThick * 0.5 * P.inner + 0.008, P.lift + 30, 0.03, 0.4, 0, 0, 0);
  }

  // ── FLOWER ──────────────────────────────────────────────────────────────────
  // Head = a closed, dished, pillow-lobed disc, swept over ψ∈[0,π] (top centre →
  // rolled rim → underside). Lobes: radial grooves cut by b(θ)=|cos(Nθ/2)|^0.6, and
  // each lobe is inflated (thickness ∝ b). Stem: S-bend tube, thick, tapering to the head.
  function buildFlower(P) {
    const quads = [];
    const N = P.petals;
    const rng = Organica.mulberry32((P.seed * 2654435761) >>> 0);
    const amp = []; for (let k = 0; k < N; k++) amp.push(1 + (rng() - 0.5) * 2 * P.jitter);
    const segs = Math.round(N * 6 * P.detail), nPsi = Math.round(26 * P.detail);

    // Stem: bézier from below up to the head centre (0,0,0).
    const L = P.stemLen, bd = P.bend;
    const p0 = [0.05 * bd, -L, 0], p1 = [bd * 1.5, -L * 0.66, 0.12 * bd], p2 = [-bd * 1.3, -L * 0.3, -0.1 * bd], p3 = [0, -0.02, 0];
    const path = [];
    const nS = 44;
    for (let i = 0; i <= nS; i++) path.push(bez(p0, p1, p2, p3, i / nS));
    const endT = [p3[0] - p2[0], p3[1] - p2[1]];
    const align = Math.atan2(endT[0], endT[1]);
    tube(quads, path, s => lerp(P.stemR * 2.1, P.stemR, smooth(s)), 14, (s) => s);

    const tiltR = (-P.tilt * Math.PI) / 180 - align, nodR = (P.nod * Math.PI) / 180;
    if (P.pods) { podsHead(quads, P, (p) => rotZ(rotX(rotY(p, P.spin), nodR), tiltR)); return quads; }
    // Lobe cross-section: a semi-ellipse (round belly, near-vertical walls, soft crease) — inflated rubber, not a cusped cosine.
    const pts = [], bAt = (th) => { const x = (((N * th) / TAU) % 1) * 2 - 1; return Math.sqrt(Math.max(0, 1 - x * x) * 0.94 + 0.06); };
    for (let i = 0; i <= nPsi; i++) {
      const psi = (Math.PI * i) / nPsi, sp = Math.max(0, Math.sin(psi)), cp = Math.cos(psi);   // sin(π) can round just below 0
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * TAU, b = bAt(th);
        const a = amp[Math.floor((th / TAU) * N) % N];
        const r = P.radius * Math.pow(sp, 0.8) * (1 - P.lobe * a * (1 - b) * smooth(clamp((sp - 0.3) / 0.7, 0, 1)));
        const env = smooth(clamp((sp - 0.3) / 0.7, 0, 1));                          // lobes only separate in the outer part; smooth bowl inside
        const T = P.thick * (1 - P.puff * env * (1 - Math.min(1, b * a)));
        let z = T * cp + P.cup * Math.pow(sp, P.cupPow);
        const top = smooth(clamp(cp, 0, 1));
        z -= P.core * Math.exp(-Math.pow(sp / 0.14, 2)) * top;
        z += P.tier * b * Math.sin(sp * TAU * 1.5) * sp * top;
        let p = [r * Math.cos(th), z, r * Math.sin(th)];
        p = rotY(p, P.spin); p = rotX(p, nodR); p = rotZ(p, tiltR);
        pts.push(p);
      }
    }
    const h0 = quads.length;
    gridQuads(quads, pts, nPsi, segs, (i) => i / nPsi, true);
    for (let k = h0; k < quads.length; k++) {                      // ambient occlusion in the grooves
      const i = Math.floor((k - h0) / segs), j = (k - h0) % segs;
      const sp = Math.sin(Math.PI * (i + 0.5) / nPsi), b = bAt(((j + 0.5) / segs) * TAU);
      quads[k].ao = 1 - 0.55 * (1 - b) * smooth(clamp((sp - 0.3) / 0.7, 0, 1));
    }
    return quads;
  }

  // ── JELLYFISH ───────────────────────────────────────────────────────────────
  function buildJelly(P) {
    const quads = [];
    const rng = Organica.mulberry32((P.seed * 2654435761) >>> 0);
    const segs = Math.max(48, P.lobes * 6), rings = 22;
    const R = P.bellW * (1 - 0.3 * P.pulse), H = P.bellH * (1 + 0.38 * P.pulse);

    const bellPt = (v, th, inset) => {
      const phi = v * (Math.PI * 0.5) * 1.05;                 // apex → margin (a hair past the equator)
      const rim = 1 - P.lobe + P.lobe * Math.pow(Math.abs(Math.cos((P.lobes * th) / 2)), 0.8);
      const lobeW = Math.pow(v, 3);
      const r = R * Math.sin(phi) * (1 + (rim - 1) * lobeW) * (1 - inset);
      const y = H * Math.pow(Math.max(0, Math.cos(phi)), 1 / P.dome) * (1 - inset * 0.9) - inset * 0.04;
      return [r * Math.cos(th), y, r * Math.sin(th)];
    };
    for (const inset of [0, 0.16]) {                           // outer shell + hollow inner shell
      const pts = [];
      for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) pts.push(bellPt(i / rings, (j / segs) * TAU, inset));
      const u0 = inset ? 0.78 : 0;
      gridQuads(quads, pts, rings, segs, (i) => (inset ? u0 + 0.1 * (i / rings) : 0.62 * (i / rings)), true);
    }

    // Tentacles: thin ribbons hanging from the margin, travelling-wave sway.
    const ribbon = (x0, z0, y0, len, w, th, amp, ph, kWave, waveFn) => {
      const n = 22, pts = [];
      const tx = -Math.sin(th), tz = Math.cos(th);              // ribbon plane ⟂ radial
      const rx = Math.cos(th), rz = Math.sin(th);
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const off = amp * s * Math.sin(kWave * s * TAU - ph);
        const cx = x0 + rx * off, cz = z0 + rz * off, cy = y0 - len * s;
        const ww = (waveFn ? waveFn(s) : 1) * w * (1 - 0.7 * s);
        pts.push([cx - tx * ww, cy, cz - tz * ww], [cx + tx * ww, cy, cz + tz * ww]);
      }
      for (let i = 0; i < n; i++) {
        const a = pts[i * 2], b = pts[i * 2 + 1], c = pts[i * 2 + 3], d = pts[i * 2 + 2];
        quads.push({ p: [a, b, c, d], u: 0.55 + 0.4 * (i / n) });
      }
    };
    const mR = R * 0.97;
    for (let k = 0; k < P.tentacles; k++) {
      const th = (k / P.tentacles) * TAU + (rng() - 0.5) * 0.05;
      ribbon(mR * Math.cos(th), mR * Math.sin(th), 0.02, P.tentLen * (0.8 + 0.3 * rng()), 0.012, th,
             P.sway * (0.7 + 0.5 * rng()), P.swayPhase + rng() * 0.8, 1.2, null);
    }
    for (let k = 0; k < P.arms; k++) {
      const th = (k / P.arms) * TAU + Math.PI / P.arms;
      ribbon(R * 0.2 * Math.cos(th), R * 0.2 * Math.sin(th), 0.04, P.tentLen * 0.6, 0.06, th,
             P.sway * 0.7, P.swayPhase + 1.1, 1.5, s => 1 + 0.55 * Math.sin(s * 22));
    }
    return quads;
  }

  // ── FISH ────────────────────────────────────────────────────────────────────
  function buildFish(P) {
    const quads = [];
    const L = P.length, nS = 44, nA = 18;
    // lateral swim wave (z): travelling along s, amplitude grows toward the tail
    const zAt = (s) => P.amp * Math.pow(Math.max(0, s), P.envelope) * Math.sin(P.waves * TAU * s - P.swim);
    const xAt = (s) => (0.5 - s) * L;                           // head at +x
    const prof = (s) => {
      const q = Math.pow(clamp(s, 0, 1), P.taper);              // peak position shaped by `taper`
      return Math.max(0.18, Math.pow(Math.sin(Math.PI * q), 0.75));   // floor = the caudal peduncle
    };
    const pts = [];
    for (let i = 0; i <= nS; i++) {
      const s = i / nS, w = P.girth * prof(s), h = P.depth * prof(s);
      for (let j = 0; j <= nA; j++) {
        const a = (j / nA) * TAU;
        pts.push([xAt(s), h * Math.cos(a), zAt(s) + w * Math.sin(a)]);
      }
    }
    gridQuads(quads, pts, nS, nA, (i, j) => 0.1 + 0.6 * (i / nS) + 0.2 * (0.5 - 0.5 * Math.cos((j / nA) * TAU)), true);

    // Tail fin: fan of quads past the peduncle, lobes control the fork.
    const tn = 10, tv = 14, tp = [];
    const xe = xAt(1), ze = (u) => zAt(1 + u * (P.tailLen / L));
    for (let i = 0; i <= tn; i++) {
      const u = i / tn;
      for (let j = 0; j <= tv; j++) {
        const v = (j / tv) * 2 - 1;
        const len = P.tailLen * (1 - P.fork * (1 - Math.abs(v)) * 0.9);
        tp.push([xe - u * len, v * (P.depth * 0.18 + (P.tailH - P.depth * 0.18) * Math.pow(u, 0.8)), ze(u * (len / P.tailLen))]);
      }
    }
    gridQuads(quads, tp, tn, tv, (i, j) => 0.78 + 0.2 * (i / tn), false);

    // Dorsal fin + pectoral fins: sheets pinned to the body.
    const sheet = (n, m, pt, uFn) => { const arr = []; for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) arr.push(pt(i / n, j / m)); gridQuads(quads, arr, n, m, uFn, false); };
    if (P.dorsal > 0.01) {
      sheet(14, 4, (u, v) => {
        const s = lerp(0.2, 0.62, u), bh = P.depth * prof(s);
        return [xAt(s) - v * 0.05, bh + v * P.dorsal * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8), zAt(s)];
      }, (i, j) => 0.2 + 0.5 * (i / 14));
    }
    if (P.pectoral > 0.01) {
      for (const side of [-1, 1]) {
        sheet(6, 6, (u, v) => {
          const s = 0.26, w = P.girth * prof(s);
          return [xAt(s) - v * P.pectoral * 0.9, -P.depth * 0.25 - v * 0.04 + u * 0, zAt(s) + side * (w + v * P.pectoral)];
        }, (i, j) => 0.35 + 0.3 * (j / 6));
      }
    }
    return quads;
  }

  const BUILDERS = { flower: buildFlower, jelly: buildJelly, fish: buildFish };

  function build(morph, P) {
    const quads = BUILDERS[morph](P);
    return { morph, quads, centre: FRAME[morph].centre, radius: FRAME[morph].radius };
  }

  // ── Motion: periodic offsets, seamless over tNorm ∈ [0,1) ────────────────────
  // `cycles` = whole cycles per loop. Same discipline as Pulsar's tracks.
  function asymPulse(p) {                      // fast power stroke, slow recovery
    p = ((p % 1) + 1) % 1;
    return p < 0.28 ? smooth(p / 0.28) : 1 - smooth((p - 0.28) / 0.72);
  }
  function motion(morph, P, t, opts) {
    const o = Object.assign({ cycles: 1, amount: 1 }, opts);
    const c = Math.max(1, Math.round(o.cycles)), k = o.amount, Q = Object.assign({}, P);
    const ph = TAU * c * t;
    Q.rampPhase = P.skin === 'facing' ? (P.pods ? P.rampPhase : P.rampPhase + k * 0.05 * Math.sin(ph + 0.5))   // facing ramp is not cyclic: never scroll it
                                       : P.rampPhase + c * t * (k > 0 ? 1 : 0);                          // surface ramp is cyclic → loops
    if (morph === 'flower') {
      Q.tilt = P.tilt + k * (P.pods ? 30 : 14) * Math.sin(P.pods ? 2 * ph + 1 : ph);
      Q.nod = P.nod + k * (P.pods ? 66 : 8) * Math.sin(P.pods ? ph : ph + 1.3);   // pods: the head tumbles front → top → back
      Q.wobblePhase = P.wobblePhase + TAU * c * t * P.wobbleSpeed;                  // lobes circle on their axes (whole turns → seamless)
      Q.stemPhase = P.stemPhase + k * P.stemScroll * c * t;                           // colour bands travel down the stem
      Q.puff = clamp(P.puff * (1 + k * 0.08 * Math.sin(2 * ph)), 0, 1);
      Q.bend = P.bend + k * 0.08 * Math.sin(ph - 0.6);
      Q.spin = P.spin + k * (TAU / P.petals) * c * t;          // one lobe-step per cycle → seamless (jitter 0)
    } else if (morph === 'jelly') {
      Q.pulse = clamp(P.pulse + k * asymPulse(c * t), 0, 1);
      Q.swayPhase = P.swayPhase + ph - 0.9 * asymPulse(c * t - 0.1) * 2;   // tentacles lag the bell
      Q.sway = P.sway * (1 + k * 0.6 * asymPulse(c * t - 0.15));
    } else if (morph === 'fish') {
      Q.swim = P.swim + ph;
    }
    return Q;
  }

  // ── Camera + rasterise to depth-sorted items ────────────────────────────────
  // V: { yaw, pitch (deg), zoom, shade:'flat'|'lit', persp (0..1), light (deg),
  //      gloss (0..1), levels (0 = continuous), ramp (key), rampPhase, rampScale, outline }
  function scene(mesh, V, W, H) {
    const stops = (RAMPS[V.ramp] || RAMPS.bloom).map(hex2rgb);
    const yaw = (V.yaw * Math.PI) / 180, pitch = (V.pitch * Math.PI) / 180;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = (Math.min(W, H) / 2) * 0.92 * V.zoom / mesh.radius;
    const dist = 4.2;                                        // camera distance in model radii
    const persp = clamp(V.persp, 0, 1);
    const [cx0, cy00, cz0] = mesh.centre, cy0 = cy00 + (V.panY || 0);
    const lit = V.shade === 'lit';
    const la = (V.light * Math.PI) / 180;
    const L = [Math.sin(la) * 0.7, 0.75, Math.cos(la) * 0.7 + 0.25];
    const ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;

    const cam = (p) => {                                     // model → camera space (y up, +z toward viewer)
      let x = p[0] - cx0, y = p[1] - cy0, z = p[2] - cz0;
      let x1 = x * cy + z * sy, z1 = -x * sy + z * cy;       // yaw about y
      let y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;      // pitch about x
      return [x1, y2, z2];
    };
    const proj = (q) => {
      const f = lerp(1, dist / Math.max(0.5, dist - q[2] / mesh.radius), persp);
      return [W / 2 + q[0] * scale * f, H / 2 - q[1] * scale * f];
    };

    const list = [];
    const qs = mesh.quads;
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      const a = cam(q.p[0]), b = cam(q.p[1]), c = cam(q.p[2]), d = cam(q.p[3]);
      const depth = (a[2] + b[2] + c[2] + d[2]) / 4;
      let col = rampAt(stops, q.u * V.rampScale + V.rampPhase);
      const facing = V.skin === 'facing';
      if (lit || facing) {
        // face normal from the diagonals, two-sided
        const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / nl, n[1] / nl, n[2] / nl];
        if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
        const lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        if (facing) {
          // colour = ramp over facing angle (blue toward camera → red at the silhouette); stem = ramp down its length
          let t = q.L != null ? (V.stemBands > 0 ? pingpong((1 - q.L) * V.stemBands + V.stemPhase) : clamp((1 - q.L) / Math.max(0.02, V.stemFade), 0, 1))
                              : Math.pow(Math.max(0, 1 - Math.abs(n[2])), V.facePow) * V.rampScale;
          t = clamp(t + V.rampPhase, 0, 1);
          if (V.levels > 0) t = Math.round(t * V.levels) / V.levels;
          col = rampClamp(stops, t);
        }
        let sh = facing ? 0.9 + 0.1 * lam : 0.34 + 0.72 * lam;
        if (V.levels > 0 && !facing) sh = Math.round(sh * V.levels) / V.levels;
        if (q.ao != null) sh *= 0.5 + 0.5 * q.ao;
        const rim = facing ? 0 : Math.pow(Math.max(0, 1 - Math.abs(n[2])), 2.2) * V.gloss * 0.55;
        col = [col[0] * sh + 255 * rim, col[1] * sh + 255 * rim, col[2] * sh + 255 * rim];
      } else if (V.levels > 0) {
        const uq = Math.round(((q.u * V.rampScale + V.rampPhase) % 1 + 1) % 1 * V.levels) / V.levels;
        col = rampAt(stops, uq);
      }
      list.push({ depth, fill: rgb2hex(col[0], col[1], col[2]), a, b, c, d });
    }
    list.sort((p, q) => p.depth - q.depth);                  // far → near (painter)

    // Run-merge consecutive same-fill quads into one path (smaller SVG, same picture).
    const items = [];
    let cur = null;
    for (const it of list) {
      const pa = proj(it.a), pb = proj(it.b), pc = proj(it.c), pd = proj(it.d);
      const seg = [pa[0], pa[1], pb[0], pb[1], pc[0], pc[1], pd[0], pd[1]];
      if (cur && cur.fill === it.fill) cur.polys.push(seg);
      else { cur = { fill: it.fill, polys: [seg] }; items.push(cur); }
    }
    return { items, count: list.length, W, H };
  }

  // bg: a hex string, or 'reel' (the vertical lavender gradient of the source video).
  const BG_STOPS = { reel: [[0, '#a9acbc'], [0.32, '#d3d7ec'], [0.58, '#dde0f2'], [1, '#aeb1c4']] };
  function bgFillCanvas(ctx, bg, W, H) {
    if (BG_STOPS[bg]) { const g = ctx.createLinearGradient(0, 0, 0, H); BG_STOPS[bg].forEach(([o, c]) => g.addColorStop(o, c)); return g; }
    return bg;
  }
  function bgSVG(bg, W, H) {
    if (BG_STOPS[bg]) {
      return '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' + BG_STOPS[bg].map(([o, c]) => '<stop offset="' + o + '" stop-color="' + c + '"/>').join('') +
        '</linearGradient></defs><rect width="' + W + '" height="' + H + '" fill="url(#bg)"/>';
    }
    return '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>';
  }
  const r1 = v => Math.round(v * 10) / 10;
  function polyD(seg) {
    return 'M' + r1(seg[0]) + ' ' + r1(seg[1]) + 'L' + r1(seg[2]) + ' ' + r1(seg[3]) + 'L' + r1(seg[4]) + ' ' + r1(seg[5]) + 'L' + r1(seg[6]) + ' ' + r1(seg[7]) + 'Z';
  }
  // Same-colour seams: stroke each fill with itself (hairline) so no gaps show.
  function itemsSVG(sc, bg, outlineW) {
    const sw = outlineW == null ? 0.7 : outlineW;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sc.W + ' ' + sc.H + '" width="' + sc.W + '" height="' + sc.H + '">' +
      '<metadata id="organica">{"tool":"species"}</metadata>' +
      bgSVG(bg, sc.W, sc.H) +
      '<g stroke-width="' + sw + '" stroke-linejoin="round">';
    for (const it of sc.items) {
      s += '<path fill="' + it.fill + '" stroke="' + it.fill + '" d="' + it.polys.map(polyD).join('') + '"/>';
    }
    return s + '</g></svg>';
  }
  function drawItems(ctx, sc, bg, k, outlineW) {
    k = k || 1;
    ctx.save();
    ctx.scale(k, k);
    ctx.fillStyle = bgFillCanvas(ctx, bg, sc.W, sc.H); ctx.fillRect(0, 0, sc.W, sc.H);
    ctx.lineWidth = outlineW == null ? 0.7 : outlineW; ctx.lineJoin = 'round';
    for (const it of sc.items) {
      ctx.fillStyle = it.fill; ctx.strokeStyle = it.fill;
      ctx.beginPath();
      for (const s of it.polys) {
        ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.lineTo(s[4], s[5]); ctx.lineTo(s[6], s[7]); ctx.closePath();
      }
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }


  // ── Smooth backend: per-pixel shading ────────────────────────────────────────
  // Flat-filled quads can never give a smooth gradient. This rasterises the same
  // mesh with a z-buffer, interpolating the vertex normal, surface coordinate, stem
  // coordinate and occlusion across each triangle, then evaluates the colour ramp
  // PER PIXEL — so a blue→cream→green→pink gradient has no visible steps or facets.
  // Returns an offscreen canvas with alpha (draw it over the background).
  function raster(mesh, V, W, H, k) {
    k = k || 1;
    const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const stops = (RAMPS[V.ramp] || RAMPS.bloom).map(hex2rgb);
    const LUT = 1024, lutC = new Uint8Array((LUT + 1) * 3), lutW = new Uint8Array((LUT + 1) * 3);
    for (let i = 0; i <= LUT; i++) {
      const c = rampClamp(stops, i / LUT), d = rampAt(stops, i / LUT);
      lutC[i * 3] = c[0]; lutC[i * 3 + 1] = c[1]; lutC[i * 3 + 2] = c[2];
      lutW[i * 3] = d[0]; lutW[i * 3 + 1] = d[1]; lutW[i * 3 + 2] = d[2];
    }
    const yaw = (V.yaw * Math.PI) / 180, pitch = (V.pitch * Math.PI) / 180;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = (Math.min(W, H) / 2) * 0.92 * V.zoom / mesh.radius * k;
    const dist = 4.2, persp = clamp(V.persp, 0, 1);
    const cx0 = mesh.centre[0], cy0 = mesh.centre[1] + (V.panY || 0), cz0 = mesh.centre[2];
    const la = (V.light * Math.PI) / 180;
    const Ld = [Math.sin(la) * 0.7, 0.75, Math.cos(la) * 0.7 + 0.25];
    const ll = Math.hypot(Ld[0], Ld[1], Ld[2]); Ld[0] /= ll; Ld[1] /= ll; Ld[2] /= ll;
    const facing = V.skin === 'facing';

    // 1) shared vertices (grid corners that coincide), with accumulated normals
    const map = new Map(), vx = [];
    const key = (p) => Math.round(p[0] * 4000) + ',' + Math.round(p[1] * 4000) + ',' + Math.round(p[2] * 4000);
    const qs = mesh.quads, tri = [];
    const vid = (p, q) => {
      const kk = key(p); let id = map.get(kk);
      if (id === undefined) {
        id = vx.length; map.set(kk, id);
        // camera space
        const x = p[0] - cx0, y = p[1] - cy0, z = p[2] - cz0;
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const f = lerp(1, dist / Math.max(0.5, dist - z2 / mesh.radius), persp);
        vx.push({ sx: w / 2 + x1 * scale * f, sy: h / 2 - y2 * scale * f, z: z2, c: [x1, y2, z2], n: [0, 0, 0], u: 0, L: 0, nL: 0, ao: 0, cnt: 0 });
      }
      const v = vx[id]; v.u += q.u; v.cnt++; if (q.L != null) { v.L += q.L; v.nL++; } v.ao += (q.ao == null ? 1 : q.ao);
      return id;
    };
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      const ids = [vid(q.p[0], q), vid(q.p[1], q), vid(q.p[2], q), vid(q.p[3], q)];
      const A = vx[ids[0]].c, B = vx[ids[1]].c, C = vx[ids[2]].c, D = vx[ids[3]].c;
      const e1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], e2 = [D[0] - B[0], D[1] - B[1], D[2] - B[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      for (const id of ids) { const v = vx[id]; v.n[0] += n[0]; v.n[1] += n[1]; v.n[2] += n[2]; }
      tri.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    }
    for (const v of vx) {
      const l = Math.hypot(v.n[0], v.n[1], v.n[2]) || 1; v.n[0] /= l; v.n[1] /= l; v.n[2] /= l;
      v.u /= v.cnt; v.ao /= v.cnt; v.L = v.nL ? v.L / v.nL : -1;
    }

    // 2) z-buffered triangle fill with per-pixel colour
    const img = new ImageData(w, h), px = img.data, zb = new Float32Array(w * h).fill(-1e9);
    const rsc = V.rampScale, ph = V.rampPhase, fp = V.facePow, sf = Math.max(0.02, V.stemFade);
    const lev = V.levels | 0;
    for (let t = 0; t < tri.length; t += 3) {
      const a = vx[tri[t]], b = vx[tri[t + 1]], c = vx[tri[t + 2]];
      const minX = Math.max(0, Math.floor(Math.min(a.sx, b.sx, c.sx))), maxX = Math.min(w - 1, Math.ceil(Math.max(a.sx, b.sx, c.sx)));
      const minY = Math.max(0, Math.floor(Math.min(a.sy, b.sy, c.sy))), maxY = Math.min(h - 1, Math.ceil(Math.max(a.sy, b.sy, c.sy)));
      const den = (b.sy - c.sy) * (a.sx - c.sx) + (c.sx - b.sx) * (a.sy - c.sy);
      if (Math.abs(den) < 1e-9) continue;
      const stem = a.L >= 0 && b.L >= 0 && c.L >= 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const l1 = ((b.sy - c.sy) * (x + 0.5 - c.sx) + (c.sx - b.sx) * (y + 0.5 - c.sy)) / den;
          const l2 = ((c.sy - a.sy) * (x + 0.5 - c.sx) + (a.sx - c.sx) * (y + 0.5 - c.sy)) / den;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
          const z = l1 * a.z + l2 * b.z + l3 * c.z, zi = y * w + x;
          if (z <= zb[zi]) continue;
          zb[zi] = z;
          let nx = l1 * a.n[0] + l2 * b.n[0] + l3 * c.n[0], ny = l1 * a.n[1] + l2 * b.n[1] + l3 * c.n[1], nz = l1 * a.n[2] + l2 * b.n[2] + l3 * c.n[2];
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const ao = l1 * a.ao + l2 * b.ao + l3 * c.ao;
          let r, g, bl;
          if (facing) {
            let tt;
            if (stem) { const Ls = l1 * a.L + l2 * b.L + l3 * c.L; tt = V.stemBands > 0 ? pingpong((1 - Ls) * V.stemBands + V.stemPhase) : clamp((1 - Ls) / sf, 0, 1); }
            else tt = Math.pow(Math.max(0, 1 - Math.abs(nz)), fp) * rsc;
            tt = clamp(tt + ph, 0, 1);
            if (lev > 0) tt = Math.round(tt * lev) / lev;
            const li = Math.round(tt * LUT) * 3; r = lutC[li]; g = lutC[li + 1]; bl = lutC[li + 2];
          } else {
            let uu = (l1 * a.u + l2 * b.u + l3 * c.u) * rsc + ph; uu = ((uu % 1) + 1) % 1;
            if (lev > 0) uu = Math.round(uu * lev) / lev;
            const li = Math.round(uu * LUT) * 3; r = lutW[li]; g = lutW[li + 1]; bl = lutW[li + 2];
          }
          const sgn = nz < 0 ? -1 : 1;
          const lam = Math.max(0, sgn * (nx * Ld[0] + ny * Ld[1] + nz * Ld[2]));
          let sh = facing ? 0.9 + 0.1 * lam : 0.34 + 0.72 * lam;
          sh *= 0.5 + 0.5 * ao;
          const rim = facing ? 0 : Math.pow(Math.max(0, 1 - Math.abs(nz)), 2.2) * V.gloss * 0.55 * 255;
          const o = zi * 4;
          px[o] = r * sh + rim; px[o + 1] = g * sh + rim; px[o + 2] = bl * sh + rim; px[o + 3] = 255;
        }
      }
    }
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    cv.getContext('2d').putImageData(img, 0, 0);
    return cv;
  }
  // Paint background + the smooth raster into ctx (logical W×H, scaled by k).
  function drawSmooth(ctx, mesh, V, W, H, bg, k) {
    k = k || 1;
    ctx.save();
    ctx.fillStyle = bgFillCanvas(ctx, bg, W * k, H * k); ctx.fillRect(0, 0, W * k, H * k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(raster(mesh, V, W, H, k), 0, 0, W * k, H * k);
    ctx.restore();
  }
  // SVG wrapper for the smooth backend: the raster embedded as a PNG (not vector).
  function smoothSVG(mesh, V, W, H, bg, k) {
    const c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
    drawSmooth(c.getContext('2d'), mesh, V, W, H, bg, k);
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
      '<metadata id="organica">{"tool":"species","raster":true}</metadata><image width="' + W + '" height="' + H + '" xlink:href="' + c.toDataURL('image/png') + '"/></svg>';
  }

  Organica.species = {
    TAU, RAMPS, SCHEMA, PRESETS, COMMON_DEFAULTS, FRAME,
    defaults, build, motion, scene, itemsSVG, drawItems, raster, drawSmooth, smoothSVG, rampAt, rampClamp, hex2rgb, rgb2hex,
  };
})(typeof window !== 'undefined' ? window : globalThis);
