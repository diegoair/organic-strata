/* ─────────────────────────────────────────────────────────────
   ORGANICA — organica-noise.js
   Scalar value-noise / Worley primitives, shared across tools.

   These started as private copies inside komorebi/index.html (itself a
   plain-JS port of an even older GLSL version — see that file's own
   header note). Camo Turing's anisotropic-diffusion work needed the same
   hash/fbm construction again, and Warping is a third consumer built
   entirely on top of these — three independent copies is exactly the
   condition organica-core.js's own header warns about (routines drifting
   apart until a fix in one never reaches the others), so this is the
   point where they get pulled out for real.

   Scalar (x,y) in, scalar (or [x,y] pair) out — no vec2 allocations in a
   per-pixel hot loop, same reasoning as the original private copies.

   Load order: AFTER organica-core.js. organica-core.js's own last line is
   `global.Organica = Organica`, which would overwrite (not merge with)
   anything attached here if this file loaded first — see docs/SHARED-LIBRARY.md
   for the same load-order contract on organic-library.css. This file
   guards against that by reusing window.Organica if it already exists,
   but the safe, intended order is core → noise → the tool's own script.

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

  Organica.noise = noise;
})(window);
