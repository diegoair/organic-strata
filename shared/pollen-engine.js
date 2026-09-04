/* ─────────────────────────────────────────────────────────────────────────────
 * pollen-engine.js — the Organica stippling core.
 *
 * The variable-radius Poisson-disk (blue-noise) dart-thrower, the tone pipeline,
 * and the line/streamline mark geometry — the numerical heart of Pollen, and the
 * part Mote copied when it was a scratchpad prototype. Extracted here at the
 * second consumer (Mote → /mote/), the same "extract at the second consumer"
 * move as noise.js / motion.js / radial.js.
 *
 * SCOPE — the intersection both tools share, nothing tool-specific:
 *   - the tone curve + luma-field build
 *   - computePoints(o): the dart-thrower, DOM-free, with an injectable rng
 *     (Mote's mode C seeds it) and an injectable luma field (Mote's is a video
 *     frame). Default rng === Math.random reproduces the exact draw sequence
 *     Pollen's inline version made, so Pollen's output is byte-identical.
 *   - spacingAt / gradAngle (field sampling)
 *   - ranged / dropoutSkip / pointAngle / pointRGBA (per-point value resolution)
 *   - the curved-line + field-streamline geometry (strokeCenterline,
 *     smoothOpenPath[D], makeFieldAngle, fieldStrokePts)
 *
 * NOT here — each tool keeps its own, calling the primitives above:
 *   - paintPoints (Pollen dispatches to SVG-form marks; Mote draws literal dots)
 *   - the SVG serializer (Pollen only)
 *   - the temporal-coherence layer stepA/B/C + makeGridMulti (Mote only)
 *   - all DOM / panel / state wiring
 *
 * LOAD ORDER: core.js → palette.js → pollen-engine.js → tool script.
 * Needs Organica.palette.colorAt / Organica.hexToRGB255 from the two before it.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

  // ── TONE ──────────────────────────────────────────────────────────────────
  // Gamma then Contrast on a 0..1 luma value (Invert already applied by the
  // caller). The 259·(c+255)/(255·(259−c)) curve is the standard GIMP-style one.
  function processLuma(l, gamma, contrast) {
    if (gamma !== 1) l = Math.pow(Math.max(0, l), gamma);
    if (contrast) {
      const cc = contrast * 2.55, f = (259 * (cc + 255)) / (255 * (259 - cc));
      l = f * (l - 0.5) + 0.5;
    }
    return Math.max(0, Math.min(1, l));
  }

  // Build the Float32 luma field from a raw RGBA byte buffer (ImageData.data).
  //   opt = { invert, gamma, contrast, keepRGBA }
  // Returns { data:Float32Array(W*H), rgba:(kept or null), W, H }.
  function buildField(rgba, W, H, opt) {
    opt = opt || {};
    const invert = !!opt.invert, gamma = opt.gamma == null ? 1 : opt.gamma,
          contrast = opt.contrast || 0;
    const b = new Float32Array(W * H);
    for (let i = 0, p = 0; i < b.length; i++, p += 4) {
      let l = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255;
      if (invert) l = 1 - l;
      b[i] = processLuma(l, gamma, contrast);
    }
    return { data: b, rgba: opt.keepRGBA ? rgba : null, W, H };
  }

  // ── FIELD SAMPLING ────────────────────────────────────────────────────────
  function spacingAt(field, minSp, maxSp, x, y) {
    const { data, W, H } = field;
    const ix = Math.min(W - 1, Math.max(0, x | 0)), iy = Math.min(H - 1, Math.max(0, y | 0));
    return minSp + (maxSp - minSp) * data[iy * W + ix];
  }

  // Sobel-lite image gradient angle at (x,y), or null on a flat neighbourhood.
  function gradAngle(field, x, y) {
    const { data: d, W, H } = field;
    const ix = Math.min(W - 1, x | 0), iy = Math.min(H - 1, y | 0);
    const xm = Math.max(0, ix - 1), xp = Math.min(W - 1, ix + 1);
    const ym = Math.max(0, iy - 1), yp = Math.min(H - 1, iy + 1);
    const gx = d[iy * W + xp] - d[iy * W + xm];
    const gy = d[yp * W + ix] - d[ym * W + ix];
    return (gx === 0 && gy === 0) ? null : Math.atan2(gy, gx);
  }

  // ── DART THROWER ──────────────────────────────────────────────────────────
  // Progressive variable-radius Poisson-disk. Pure: everything comes in via `o`.
  //   o = {
  //     field,                     // { data:Float32Array, W, H } (from buildField)
  //     minSp, maxSp,              // spacing range, px in field space
  //     phases,                    // dart-throwing passes
  //     rng = Math.random,         // injectable [0,1) stream (Mote mode C seeds it)
  //     maxPoints = 70000,
  //     hideBand = null,           // [lo,hi] in 0..1 — skip candidates in this
  //                                //   tone band (Pollen's "Hide Zone"); null = off
  //     isCancelled = () => false, // checked after every phase's yield
  //     onProgress = () => {},     // (frac 0..1, count) after every phase
  //   }
  // Returns [{ x, y, b, rnd, ga }] — position, tone, stable per-point random,
  // gradient angle. Yields to the event loop once per phase.
  async function computePoints(o) {
    const { field, minSp, maxSp, phases, rng = Math.random, maxPoints = 70000,
            hideBand = null, isCancelled = () => false, onProgress = () => {} } = o;
    const { data: bright, W, H } = field;
    const cell = Math.max(0.5, minSp / Math.SQRT2);
    const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
    const grid = new Int32Array(gw * gh).fill(-1);
    const px = [], py = [], pb = [], prnd = [];
    const spAt = (x, y) => {
      const ix = Math.min(W - 1, Math.max(0, x | 0)), iy = Math.min(H - 1, Math.max(0, y | 0));
      return minSp + (maxSp - minSp) * bright[iy * W + ix];
    };
    const accept = (x, y, r) => {
      const cx = (x / cell) | 0, cy = (y / cell) | 0, rad = Math.ceil(r / cell);
      for (let gy = Math.max(0, cy - rad); gy <= Math.min(gh - 1, cy + rad); gy++)
        for (let gx = Math.max(0, cx - rad); gx <= Math.min(gw - 1, cx + rad); gx++) {
          const idx = grid[gy * gw + gx];
          if (idx === -1) continue;
          const dx = px[idx] - x, dy = py[idx] - y;
          if (dx * dx + dy * dy < r * r) return false;
        }
      return true;
    };
    const attemptsPerPhase = Math.min(180000, Math.ceil((W * H) / (minSp * minSp)));
    for (let phase = 0; phase < phases; phase++) {
      for (let a = 0; a < attemptsPerPhase; a++) {
        if (px.length >= maxPoints) break;
        const x = rng() * W, y = rng() * H;
        const bb = bright[Math.min(H - 1, y | 0) * W + Math.min(W - 1, x | 0)];
        if (hideBand && bb >= hideBand[0] && bb <= hideBand[1]) continue;
        const r = spAt(x, y);
        if (!accept(x, y, r)) continue;
        const i = px.length;
        px.push(x); py.push(y);
        pb.push(bb);
        prnd.push(rng());
        grid[((y / cell) | 0) * gw + ((x / cell) | 0)] = i;
      }
      onProgress((phase + 1) / phases, px.length);
      await new Promise(r => setTimeout(r, 0));
      if (isCancelled()) return [];
      if (px.length >= maxPoints) break;
    }
    return px.map((x, i) => {
      const ix = Math.min(W - 1, x | 0), iy = Math.min(H - 1, py[i] | 0);
      const xm = Math.max(0, ix - 1), xp = Math.min(W - 1, ix + 1);
      const ym = Math.max(0, iy - 1), yp = Math.min(H - 1, iy + 1);
      const gx = bright[iy * W + xp] - bright[iy * W + xm];
      const gy = bright[yp * W + ix] - bright[ym * W + ix];
      const ga = (gx === 0 && gy === 0) ? null : Math.atan2(gy, gx);
      return { x, y: py[i], b: pb[i], rnd: prnd[i], ga };
    });
  }

  // ── PER-POINT VALUE RESOLUTION ────────────────────────────────────────────
  // Random → by stored rnd; Range → by brightness (Min dark … Max bright);
  // else the base (Min).
  function ranged(min, max, range, random, b, rnd) {
    if (random) return lerp(min, max, rnd);
    if (range) return lerp(min, max, b);
    return min;
  }

  // Light dropout: drop marks at random in bright areas (probability rises toward
  // white). Decorrelated from rnd so it doesn't bias size/angle/colour.
  function dropoutSkip(P, b, rnd) {
    if (!P.lightDropout) return false;
    let d = Math.sin((rnd + 0.123) * 99.13) * 43758.5453; d = d - Math.floor(d);
    return d < P.lightDropout * Math.pow(b, 1.5);
  }

  // One point's rotation (radians). Flow = align to the image (isophote: 90° off
  // the local gradient); the Angle value adds as an offset.
  function pointAngle(P, p) {
    let deg = ranged(P.angleMin, P.angleMax, P.angleRange, P.angleRandom, p.b, p.rnd);
    if (P.angleFlow && p.ga != null) deg += (p.ga * 180 / Math.PI) + 90;
    return deg * Math.PI / 180;
  }

  // Per-point colour → { r, g, b, a } 0..255 / 0..1.
  //   Solid → Point; Adaptive → lerp(Point, Paper) by tone; RMX → palette by map.
  //   'video' (Mote) → the pixel under the point, from field.rgba.
  //   P.minInk (0..1, Adapt only) floors the blend toward Paper — bright-field
  //   marks stay visible instead of vanishing into the background.
  // Delegates the palette maths to Organica.palette.colorAt so Pollen / Spore /
  // Mote can't drift.
  function pointRGBA(P, b, rnd, p, field) {
    if (P.colorMode === 'video' && p && field && field.rgba) {
      const ix = Math.min(field.W - 1, Math.max(0, p.x | 0));
      const iy = Math.min(field.H - 1, Math.max(0, p.y | 0));
      const o = (iy * field.W + ix) * 4;
      return { r: field.rgba[o], g: field.rgba[o + 1], b: field.rgba[o + 2], a: P.alpha };
    }
    // Min ink (Adapt only): stop a mark blending closer than (1 − minInk) to the
    // Paper colour, so a saturated bright-field region keeps visible marks
    // instead of vanishing into the background. Absent/0 ⇒ untouched (Pollen).
    let score = b;
    if (P.colorMode === 'adaptive' && P.minInk) score = b * (1 - P.minInk);
    const hex = Organica.palette.colorAt(score, {
      mode: P.colorMode === 'video' ? 'solid' : P.colorMode,
      ink: P.ink, paper: P.bg, colors: P.palette || P.rmxColors,
      submode: P.rmxMap, rnd: rnd || 0,
    });
    const [r, g, bl] = Organica.hexToRGB255(hex);
    return { r, g, b: bl, a: P.alpha };
  }

  // ── CURVED-LINE + FIELD-STREAMLINE GEOMETRY ───────────────────────────────
  // A clean arc centreline: constant curvature from rnd × Warping. Centred.
  function strokeCenterline(len, segs, warp, rnd) {
    const n = Math.max(2, segs | 0), step = len / n;
    const bend = (rnd - 0.5) * warp * 2.4;
    const dA = bend / n;
    let ang = -bend / 2, x = 0, y = 0;
    const pts = [[0, 0]];
    for (let i = 0; i < n; i++) { ang += dA; x += Math.cos(ang) * step; y += Math.sin(ang) * step; pts.push([x, y]); }
    const mx = (pts[0][0] + pts[n][0]) / 2, my = (pts[0][1] + pts[n][1]) / 2;
    return pts.map(p => [p[0] - mx, p[1] - my]);
  }

  // Quadratic-midpoint smoothing of an open polyline — onto a 2D context…
  function smoothOpenPath(g, pts) {
    const n = pts.length;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++)
      g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    g.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
  // …or into an SVG path `d` string (Pollen's vector export).
  function smoothOpenPathD(pts) {
    const n = pts.length;
    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < n - 1; i++) {
      d += ` Q ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} ${((pts[i][0] + pts[i + 1][0]) / 2).toFixed(2)} ${((pts[i][1] + pts[i + 1][1]) / 2).toFixed(2)}`;
    }
    return d + ` L ${pts[n - 1][0].toFixed(2)} ${pts[n - 1][1].toFixed(2)}`;
  }

  // Angle (radians) of the field at (x,y): Angle/Range/Random by local tone, plus
  // Flow = isophote of the local gradient. `sampleB(x,y) → 0..1` is injected so
  // the caller controls the source (work image / synthetic preview blob / frame).
  function makeFieldAngle(P, sampleB) {
    return (x, y, rnd) => {
      const b = sampleB(x, y);
      let deg = ranged(P.angleMin, P.angleMax, P.angleRange, P.angleRandom, b, rnd);
      if (P.angleFlow) {
        const e = 1.5;
        const gx = sampleB(x + e, y) - sampleB(x - e, y);
        const gy = sampleB(x, y + e) - sampleB(x, y - e);
        if (gx || gy) deg += Math.atan2(gy, gx) * 180 / Math.PI + 90;
      }
      return deg * Math.PI / 180;
    };
  }

  // Integrate a centred streamline from (x0,y0): half the segments forward along
  // the field, half backward. Warping adds per-segment hand jitter.
  function fieldStrokePts(x0, y0, P, rnd, angleAt, scale) {
    const len = P.strokeLen * (scale || 1);
    const n = Math.max(2, P.strokeSeg | 0), step = len / n, half = Math.ceil(n / 2);
    let s = (rnd || 0) * 9999 + 1;
    const nz = () => { s = Math.sin(s * 12.9898) * 43758.5453; return s - Math.floor(s); };
    const fwd = [[x0, y0]]; let x = x0, y = y0;
    for (let i = 0; i < half; i++) { const a = angleAt(x, y, rnd) + (nz() - 0.5) * P.strokeWarp; x += Math.cos(a) * step; y += Math.sin(a) * step; fwd.push([x, y]); }
    const back = []; x = x0; y = y0;
    for (let i = 0; i < n - half; i++) { const a = angleAt(x, y, rnd) + Math.PI + (nz() - 0.5) * P.strokeWarp; x += Math.cos(a) * step; y += Math.sin(a) * step; back.push([x, y]); }
    return back.reverse().concat(fwd);
  }

  Organica.pollenEngine = {
    lerp,
    processLuma, buildField, spacingAt, gradAngle,
    computePoints,
    ranged, dropoutSkip, pointAngle, pointRGBA,
    strokeCenterline, smoothOpenPath, smoothOpenPathD, makeFieldAngle, fieldStrokePts,
  };
})(typeof window !== 'undefined' ? window : this);
