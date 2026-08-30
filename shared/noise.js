/* ─────────────────────────────────────────────────────────────
   ORGANICA — noise.js
   Scalar value-noise / Worley primitives, shared across tools.

   These started as private copies inside komorebi/index.html (itself a
   plain-JS port of an even older GLSL version — see that file's own
   header note). Camo Turing's anisotropic-diffusion work needed the same
   hash/fbm construction again, and Warping is a third consumer built
   entirely on top of these — three independent copies is exactly the
   condition core.js's own header warns about (routines drifting
   apart until a fix in one never reaches the others), so this is the
   point where they get pulled out for real.

   Scalar (x,y) in, scalar (or [x,y] pair) out — no vec2 allocations in a
   per-pixel hot loop, same reasoning as the original private copies.

   Load order: AFTER core.js. core.js's own last line is
   `global.Organica = Organica`, which would overwrite (not merge with)
   anything attached here if this file loaded first. This file guards
   against that by reusing window.Organica if it already exists, but the
   safe, intended order is core → noise → the tool's own script.

   Everything hangs off window.Organica.noise.*
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = global.Organica = global.Organica || {};
  const noise = {};

  // Hash constants and construction are the exact values every existing
  // consumer (Komorebi's canopy patterns, Camo Turing's anisotropic warp)
  // already verified visually — kept byte-identical so porting a tool onto
  // this module is a no-op, not a retune.
  noise.hash2 = function hash2(x, y) {
    let px = fract(x * 123.34), py = fract(y * 456.21);
    const d = px * (px + 45.32) + py * (py + 45.32);
    px += d; py += d;
    return fract(px * py);
  };
  noise.hash2b = function hash2b(x, y) { return [noise.hash2(x, y), noise.hash2(x + 17.3, y + 17.3)]; };

  noise.vnoise = function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = noise.hash2(ix, iy), b = noise.hash2(ix + 1, iy);
    const c = noise.hash2(ix, iy + 1), d = noise.hash2(ix + 1, iy + 1);
    return mix(mix(a, b, ux), mix(c, d, ux), uy);
  };

  noise.fbm = function fbm(x, y) {
    let s = 0, a = 0.5;
    for (let i = 0; i < 4; i++) {
      s += a * noise.vnoise(x, y);
      const nx = x * 2.03 + 1.7, ny = y * 2.03 + 9.2;
      x = nx; y = ny; a *= 0.5;
    }
    return s / 0.9375;
  };

  // Ridged fbm: noise ridges sharpened into thin lines. Komorebi's own
  // basis for its Veins pattern; here it's also the wood-grain primitive
  // (rings are ridged fbm read radially, see docs/WARPING.md).
  noise.ridgedFbm = function ridgedFbm(x, y) {
    let s = 0, a = 0.55, sum = 0;
    for (let i = 0; i < 5; i++) {
      const r = 1 - Math.abs(noise.vnoise(x, y) * 2 - 1);
      s += r * r * a; sum += a;
      const nx = x * 2.13 + 3.1, ny = y * 2.13 + 7.7;
      x = nx; y = ny; a *= 0.55;
    }
    return s / sum;
  };

  // Nearest/second-nearest distance to a jittered point grid (Worley/
  // cellular noise). Komorebi's own basis for its Cellular mask
  // (crack = where F1≈F2); Warping's Cellular network pattern reuses this
  // verbatim rather than re-deriving it.
  noise.voronoiF1F2 = function voronoiF1F2(x, y, jitter) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    let f1 = 8, f2 = 8;
    for (let gy = -1; gy <= 1; gy++) {
      for (let gx = -1; gx <= 1; gx++) {
        const h = noise.hash2b(ix + gx, iy + gy);
        const dx = gx + h[0] * jitter - fx, dy = gy + h[1] * jitter - fy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
      }
    }
    return [f1, f2];
  };

  function fract(v) { return v - Math.floor(v); }
  function mix(a, b, t) { return a + (b - a) * t; }

  // ═══════════════════════════════════════════════════════════
  // SIMPLEX NOISE — Ken Perlin's 2001 successor to his own 1985 "Perlin
  // noise" (the one `vnoise`/`fbm` above are the value-noise cousin of,
  // NOT the same algorithm despite the popular naming confusion — see
  // the animation-engine scoping discussion this file's own git history
  // records). Simplex trades the square lattice for a skewed triangular
  // one, which removes the directional bias a square grid imposes at 45°
  // — the concrete quality upgrade asked for here, evaluated deliberately
  // against p5.js's noise() (same value-noise family as our own, not a
  // different algorithm) rather than assumed.
  //
  // Kept ADDITIVE, not a replacement for vnoise/fbm: Komorebi/Camo
  // Turing/Warping verified their own shipped output against vnoise's
  // exact byte behaviour, and this file's own header already states the
  // "byte-identical, no-op to port onto" contract for those. simplex2/
  // simplex3 are new, independent functions for new work (the animation
  // engine) to build on.
  //
  // Permutation table: rather than hand-transcribe Ken Perlin's original
  // 256-entry table (a real transcription-error risk with no way to spot
  // a single wrong byte by eye), built via a Fisher–Yates shuffle off our
  // own mulberry32 with a FIXED seed — deterministic across runs (not
  // reseeded per page load), same statistical role as the original table,
  // zero transcription risk. Per-call seeding (matching every other
  // seeded function in this codebase) is the CALLER's job via coordinate
  // offset, e.g. `simplex2(x + seed*0.137, y + seed*0.271)` — these stay
  // pure functions of their input coordinates only, no hidden state.
  const GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  (function buildPermutation() {
    const rng = mulberry32(1337);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
    }
    for (let i = 0; i < 512; i++) { perm[i] = base[i & 255]; permMod12[i] = perm[i] % 12; }
  })();

  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  noise.simplex2 = function simplex2(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = GRAD3[permMod12[ii + perm[jj]]];
    const gi1 = GRAD3[permMod12[ii + i1 + perm[jj + j1]]];
    const gi2 = GRAD3[permMod12[ii + 1 + perm[jj + 1]]];
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (gi0[0] * x0 + gi0[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (gi1[0] * x1 + gi1[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (gi2[0] * x2 + gi2[1] * y2); }
    return 70 * (n0 + n1 + n2);   // empirical normalisation constant, standard across simplex reference implementations — keeps output in ~[-1,1]
  };

  const F3 = 1 / 3, G3 = 1 / 6;
  noise.simplex3 = function simplex3(xin, yin, zin) {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const gi0 = GRAD3[permMod12[ii + perm[jj + perm[kk]]]];
    const gi1 = GRAD3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]];
    const gi2 = GRAD3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]];
    const gi3 = GRAD3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]];
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (gi0[0] * x0 + gi0[1] * y0 + gi0[2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (gi1[0] * x1 + gi1[1] * y1 + gi1[2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (gi2[0] * x2 + gi2[1] * y2 + gi2[2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 >= 0) { t3 *= t3; n3 = t3 * t3 * (gi3[0] * x3 + gi3[1] * y3 + gi3[2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  };

  // fbm wrappers, octaves/falloff exposed as real parameters (unlike the
  // value-noise fbm() above, which hardcodes them) — the runtime
  // flexibility p5.js's noiseDetail() has and ours didn't, addressed
  // directly rather than left as a known gap. Defaults (4 octaves, 0.5
  // falloff) match fbm()'s own so the two are comparable at their
  // defaults. Output normalised to the actual achieved amplitude sum, not
  // a hardcoded constant, so any octave/falloff combination stays ~[-1,1].
  noise.simplexFbm2 = function simplexFbm2(x, y, octaves, falloff) {
    octaves = octaves || 4; falloff = falloff == null ? 0.5 : falloff;
    let s = 0, a = 1, sum = 0, freq = 1;
    for (let i = 0; i < octaves; i++) {
      s += a * noise.simplex2(x * freq, y * freq);
      sum += a; a *= falloff; freq *= 2.01;   // 2.01, not 2.0 — same octave-misalignment trick fbm() already uses
    }
    return s / sum;
  };
  noise.simplexFbm3 = function simplexFbm3(x, y, z, octaves, falloff) {
    octaves = octaves || 4; falloff = falloff == null ? 0.5 : falloff;
    let s = 0, a = 1, sum = 0, freq = 1;
    for (let i = 0; i < octaves; i++) {
      s += a * noise.simplex3(x * freq, y * freq, z * freq);
      sum += a; a *= falloff; freq *= 2.01;
    }
    return s / sum;
  };

  Organica.noise = noise;
})(window);
