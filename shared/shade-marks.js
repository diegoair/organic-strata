/* ─────────────────────────────────────────────────────────────────────────────
 * shade-marks.js — Organica.shadeMarks: the shadow TEXTURES TuneSutra's Shadow draws
 * (Nov 18, 2026 — Diego picked them in explorations/tunesutra-shadow-types/). Pure, vector,
 * deterministic: each returns SVG path data for the two shadow inks, in a w×h box.
 *
 *   Organica.shadeMarks.render(type, {
 *     w, h,            // the box, in sheet units
 *     level(x, y),     // the shadow amount at a point, 0 (lit) … 1 (core) — the light and the parts
 *     size,            // the cell / mark size (sheet units)
 *     angle,           // degrees: the direction strokes run (the light + 90)
 *     seed,            // fixed per palette (no control)
 *   }) → { mid: [d…], core: [d…] }   // path pieces for the Halftone ink and the Core ink
 *
 * TYPES (key → how):
 *   mottle         Speckle's threshold × simplex fbm (Organica.noise) — the shadow in organic clumps
 *   dither-fs      Floyd–Steinberg, serpentine rows, a touch of blue-noise jitter (no diagonals, no worms)
 *   dither-blue    an ordered dither on Organica.dither.blueNoise — the smoothest grain
 *   dither-bayer   an ordered 8×8 Bayer — the classic printed cross pattern
 *   pollen-dot     Pollen's variable-density Poisson disk (its algorithm, on a function field), round dots
 *   pollen-stroke  the same points as short strokes across the light (an engraving)
 *   pollen-cross   brush strokes in three directions, each with its own points, fading in by depth
 *   camo-spots     Camo Turing's Gray-Scott (Self-replicating spots), on the CPU, cached, tiled
 *   camo-maze      Gray-Scott Mazes
 *   cells          Worley cells (Organica.noise.voronoiF1F2) filling from their centre
 * Cell types (mottle, dither-*, camo-*, cells) are one ink per cell: plates never overlap. Pollen marks
 * overprint the colour under them.
 *
 * LOAD ORDER: core.js (mulberry32, dither) → noise.js → this.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = v => Math.round(v * 100) / 100;
  const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

  // cells → run-length rows, one path list per level (1 = halftone, 2 = core)
  function cellPaths(w, h, cell, pick) {
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), d = [[], [], []];
    for (let r = 0; r < rows; r++) {
      let run = 0, c0 = 0;
      for (let c = 0; c <= cols; c++) {
        const ink = c < cols ? pick(c, r, Math.min(w, (c + 0.5) * cell), Math.min(h, (r + 0.5) * cell)) : 0;
        if (ink !== run) {
          if (run) { const x0 = num(c0 * cell), x1 = num(Math.min(w, c * cell)), y0 = num(r * cell), y1 = num(Math.min(h, (r + 1) * cell)); d[run].push(`M${x0} ${y0}h${num(x1 - x0)}v${num(y1 - y0)}h${num(x0 - x1)}z`); }
          run = ink; c0 = c;
        }
      }
    }
    return { mid: d[1], core: d[2] };
  }
  const dithered = (v, c, r, seed) => { const lo = Math.floor(v); return hash(c, r, seed) < v - lo ? lo + 1 : lo; };

  // ── Pollen: variable-radius Poisson disk (pollen-engine's computePoints, synchronous, on a function) ──
  function poisson(w, h, minSp, rrAt, accept, rng) {
    const cell = minSp / Math.SQRT2, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), grid = new Int32Array(gw * gh).fill(-1), pts = [];
    const ok = (x, y, rr) => {
      const cx = (x / cell) | 0, cy = (y / cell) | 0, k = Math.ceil(rr / cell);
      for (let gy = Math.max(0, cy - k); gy <= Math.min(gh - 1, cy + k); gy++)
        for (let gx = Math.max(0, cx - k); gx <= Math.min(gw - 1, cx + k); gx++) {
          const j = grid[gy * gw + gx]; if (j < 0) continue;
          const p = pts[j]; if ((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < rr * rr) return false;
        }
      return true;
    };
    const tries = Math.min(60000, Math.ceil(w * h / (minSp * minSp)) * 3);
    for (let a = 0; a < tries; a++) {
      const x = rng() * w, y = rng() * h, p = accept(x, y);
      if (!p) continue;
      const rr = rrAt(x, y, p.s);
      if (!ok(x, y, rr)) continue;
      grid[((y / cell) | 0) * gw + ((x / cell) | 0)] = pts.length;
      pts.push({ x: x, y: y, s: p.s, rnd: rng() });
    }
    return pts;
  }
  const circle = (x, y, r) => `M${num(x - r)} ${num(y)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0Z`;
  const quad = (x0, y0, x1, y1, nx, ny) => `M${num(x0 + nx)} ${num(y0 + ny)}L${num(x1 + nx)} ${num(y1 + ny)}L${num(x1 - nx)} ${num(y1 - ny)}L${num(x0 - nx)} ${num(y0 - ny)}Z`;
  const CROSS = [[0, 0.15, 'mid'], [Math.PI / 2, 0.45, 'core'], [Math.PI / 4, 0.75, 'core']];
  const crossIn = (s, th) => { const t = clamp((s - (th - 0.2)) / 0.45, 0, 1); return t * t * (3 - 2 * t); };

  function pollen(o, mark) {
    const N = Organica.noise, { w, h, level, size, seed } = o, ang = o.angle * Math.PI / 180, out = { mid: [], core: [] };
    if (mark === 'cross') {
      // three directions, each with its own points: the strokes overlap at random; a layer fades in by depth
      CROSS.forEach(([da, th, ink], li) => {
        const rng = Organica.mulberry32(seed * 9973 + li * 7717), minSp = size * 0.9;
        const pts = poisson(w, h, minSp,
          (x, y) => minSp * 1.25 * (0.55 + 1.1 * (N.simplexFbm2(x / 34 + 3.1 + li * 9.7, y / 34 - 1.7 - li * 4.3, 3, 0.5) * 0.5 + 0.5)),
          (x, y) => { const s = level(x, y); return rng() > crossIn(s, th) ? null : { s: s }; }, rng);
        pts.forEach(p => {   // a brush stroke: curved, swelling in the middle, tapered ends; angle and bend follow a slow noise
          const nA = N.simplexFbm2(p.x / 60 + li * 5.3, p.y / 60 - li * 2.1, 2, 0.5), nB = N.simplexFbm2(p.x / 25 - li, p.y / 25 + li * 1.7, 2, 0.5);
          const a2 = ang + da + nA * 0.6 + (p.rnd - 0.5) * 0.2, L = minSp * (1.4 + 0.9 * p.rnd), bend = nB * L * 0.45, wmax = minSp * 0.16 + 0.35;
          const cx = Math.cos(a2), cy = Math.sin(a2);
          const P0 = [p.x - cx * L / 2, p.y - cy * L / 2], P2 = [p.x + cx * L / 2, p.y + cy * L / 2], P1 = [p.x - cy * bend, p.y + cx * bend];
          const left = [], right = [];
          for (let q = 0; q <= 6; q++) {
            const t = q / 6, u = 1 - t, x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1];
            const tx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), ty = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), tl = Math.hypot(tx, ty) || 1;
            const wd = wmax * Math.pow(Math.sin(Math.PI * t), 0.7) / 2 + 0.05;
            left.push([x - ty / tl * wd, y + tx / tl * wd]); right.push([x + ty / tl * wd, y - tx / tl * wd]);
          }
          out[ink].push('M' + left.concat(right.reverse()).map(pt => pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join('L') + 'Z');
        });
      });
      return out;
    }
    const rng = Organica.mulberry32(seed * 9973), minSp = size * 0.55, maxSp = size * 2.2;
    const pts = poisson(w, h, minSp, (x, y, s) => minSp + (maxSp - minSp) * (1 - s), (x, y) => { const s = level(x, y); return s < 0.06 ? null : { s: s }; }, rng);
    pts.forEach(p => {
      const ink = p.s > 0.55 ? 'core' : 'mid';
      if (mark === 'dot') { out[ink].push(circle(p.x, p.y, size * (0.25 + 0.3 * p.s))); return; }
      const L = size * (1.1 + 1.8 * p.s), wd = size * 0.16 + 0.25, wob = (p.rnd - 0.5) * 0.5, cx = Math.cos(ang + wob), cy = Math.sin(ang + wob);
      out[ink].push(quad(p.x - cx * L / 2, p.y - cy * L / 2, p.x + cx * L / 2, p.y + cy * L / 2, -cy * wd / 2, cx * wd / 2));
    });
    return out;
  }

  // ── Camo: Gray-Scott (Camo Turing's model: dA 1, dB 0.5, 9-point laplacian) on a 72² periodic grid, 3000 steps
  //    (the same spots / mazes as 96² × 5000 at a third of the cost — measured), cached; warm() pre-runs it when idle ──
  const gsCache = new Map();
  function grayScott(f, k, seed) {
    const key = f + '|' + k + '|' + seed;
    if (gsCache.has(key)) return gsCache.get(key);
    const n = 72, steps = 3000;
    let A = new Float32Array(n * n).fill(1), B = new Float32Array(n * n), A2 = new Float32Array(n * n), B2 = new Float32Array(n * n);
    const rng = Organica.mulberry32(seed * 7919 + 13);
    for (let s = 0; s < Math.round(n * n / 200); s++) {   // sparse seeds — too many and Spots / Mazes die out (measured)
      const cx = (rng() * n) | 0, cy = (rng() * n) | 0;
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) { const j = ((cy + y + n) % n) * n + ((cx + x + n) % n); B[j] = 0.25 + 0.25 * rng(); A[j] = 0.5; }
    }
    for (let it = 0; it < steps; it++) {
      for (let y = 0; y < n; y++) {
        const ym = ((y - 1 + n) % n) * n, y0 = y * n, yp = ((y + 1) % n) * n;
        for (let x = 0; x < n; x++) {
          const xm = (x - 1 + n) % n, xp = (x + 1) % n, i = y0 + x;
          const la = -A[i] + 0.2 * (A[y0 + xm] + A[y0 + xp] + A[ym + x] + A[yp + x]) + 0.05 * (A[ym + xm] + A[ym + xp] + A[yp + xm] + A[yp + xp]);
          const lb = -B[i] + 0.2 * (B[y0 + xm] + B[y0 + xp] + B[ym + x] + B[yp + x]) + 0.05 * (B[ym + xm] + B[ym + xp] + B[yp + xm] + B[yp + xp]);
          const abb = A[i] * B[i] * B[i];
          A2[i] = A[i] + (la - abb + f * (1 - A[i])); B2[i] = B[i] + (0.5 * lb + abb - (k + f) * B[i]);
        }
      }
      let t = A; A = A2; A2 = t; t = B; B = B2; B2 = t;
    }
    let mx = 0; for (let i = 0; i < n * n; i++) mx = Math.max(mx, B[i]);
    for (let i = 0; i < n * n; i++) B[i] /= mx || 1;
    const out = { n: n, B: B };
    gsCache.set(key, out);
    return out;
  }
  function camo(o, f, k) {
    const { w, h, level, size, seed } = o, G = grayScott(f, k, seed), n = G.n, T = size * 18, cell = Math.max(1.5, size / 2);
    const at = (x, y) => G.B[Math.floor((((y % T) + T) % T) / T * n) * n + Math.floor((((x % T) + T) % T) / T * n)];
    return cellPaths(w, h, cell, (c, r, x, y) => { const s = level(x, y), m = at(x, y); if (s < 0.08) return 0; return m > 1.05 - s * 0.75 ? (s > 0.55 && m > 1.25 - s * 0.6 ? 2 : 1) : 0; });
  }

  const RENDER = {
    mottle: o => { const N = Organica.noise, f = 1 / 38, sx = o.seed * 7.13;
      return cellPaths(o.w, o.h, o.size, (c, r, x, y) => { const nz = N.simplexFbm2(x * f + sx, y * f - sx, 4, 0.5) * 0.5 + 0.5; return Math.min(2, dithered(clamp(o.level(x, y) * 2 * (0.35 + 1.3 * nz), 0, 2), c, r, o.seed)); }); },
    'dither-fs': o => { const cell = o.size, cols = Math.ceil(o.w / cell), rows = Math.ceil(o.h / cell), g = new Float32Array(cols * rows), q = new Uint8Array(cols * rows), bn = Organica.dither.blueNoise(64);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g[r * cols + c] = o.level(Math.min(o.w, (c + 0.5) * cell), Math.min(o.h, (r + 0.5) * cell)) * 2;
      for (let r = 0; r < rows; r++) { const rtl = r % 2 === 1, dx = rtl ? -1 : 1;
        for (let k = 0; k < cols; k++) { const c = rtl ? cols - 1 - k : k, i = r * cols + c, v = g[i], j = (bn[((r + o.seed) % 64) * 64 + (c % 64)] - 0.5) * 0.35, qq = clamp(Math.round(v + j), 0, 2), e = v - qq; q[i] = qq;
          const add = (x, y, f) => { if (x >= 0 && x < cols && y < rows) g[y * cols + x] += e * f; };
          add(c + dx, r, 7 / 16); add(c - dx, r + 1, 3 / 16); add(c, r + 1, 5 / 16); add(c + dx, r + 1, 1 / 16); } }
      return cellPaths(o.w, o.h, cell, (c, r) => q[r * cols + c]); },
    'dither-blue': o => { const bn = Organica.dither.blueNoise(64);
      return cellPaths(o.w, o.h, o.size, (c, r, x, y) => { const v = o.level(x, y) * 2, lo = Math.floor(v); return Math.min(2, bn[((r + o.seed * 5) % 64) * 64 + ((c + o.seed * 11) % 64)] < v - lo ? lo + 1 : lo); }); },
    'dither-bayer': o => { const bt = Organica.dither.bayerThresholds(8);
      return cellPaths(o.w, o.h, o.size, (c, r, x, y) => { const v = o.level(x, y) * 2, lo = Math.floor(v); return Math.min(2, bt[(r % 8) * 8 + (c % 8)] < v - lo ? lo + 1 : lo); }); },
    'pollen-dot': o => pollen(o, 'dot'),
    'pollen-stroke': o => pollen(o, 'stroke'),
    'pollen-cross': o => pollen(o, 'cross'),
    'camo-spots': o => camo(o, 0.03, 0.063),
    'camo-maze': o => camo(o, 0.029, 0.057),
    cells: o => { const N = Organica.noise, sz = o.size * 5, sx = o.seed * 3.7;
      return cellPaths(o.w, o.h, Math.max(1.5, o.size / 2), (c, r, x, y) => { const f1 = N.voronoiF1F2(x / sz + sx, y / sz - sx, 0.9)[0], s = o.level(x, y); return f1 < (s - 0.5) * 1.6 ? 2 : f1 < s * 1.15 ? 1 : 0; }); },
  };

  Organica.shadeMarks = {
    TYPES: Object.keys(RENDER),
    has: t => Object.prototype.hasOwnProperty.call(RENDER, t),
    render: (type, o) => (RENDER[type] ? RENDER[type](o) : { mid: [], core: [] }),
    // the smallest Size each type keeps its file light at (heavy marks below it)
    // run the Camo simulations ahead, when the page is idle, so the first pick is instant
    warm: seed => { const run = () => { grayScott(0.03, 0.063, seed); grayScott(0.029, 0.057, seed); };
      if (global.requestIdleCallback) global.requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1500); },
    minSize: t => (t === 'pollen-cross' ? 3 : t.indexOf('pollen') === 0 || t.indexOf('dither') === 0 ? 2 : 1.5),
  };
})(typeof window !== 'undefined' ? window : globalThis);
