/* ─────────────────────────────────────────────────────────────
   ORGANICA — organica-transformer.js
   "Transformer" — a small registry-driven raster effect stack, first
   built inside Camo Turing (see camo-turing/index.html's own TRANSFORMERS
   registry) and centralized here once proven useful there. Ported from
   Living Path's RFX raster-effect family (livingpath/index.html) — the
   raster family only; the vector-NODE family (jitter/wobble/twist) needs
   a different pipeline (path points, not a field) and isn't here.

   Contract:
   - Algorithms below operate on a plain field object {w, h, f} where f
     is a Float32Array, one value per cell, 0..1 (0 = empty, 1 = full
     ink) — exactly Living Path's own `g` shape, so these are verbatim
     ports, not reimplementations.
   - canvasToField/fieldToCanvas adapt that field to/from a 2D canvas'
     ALPHA channel (the convention every Organica seed/mask canvas
     already uses: alpha>0 = ink, RGB is irrelevant and always painted
     black) — this is the seam between "generic field algorithm" and
     "how Organica tools represent a shape".
   - buildPicker() is the thumbnail-dropdown UI (same visual contract as
     Pattern's own preset-trigger/preset-menu — see organica-panel.css)
     wired to a registry of {name, icon, apply(canvas, ctx, params)}
     entries, for tools that want a static-icon picker rather than
     Pattern's own live-simulated-thumbnail one (a Transformer's
     appearance isn't a function of any single scalar parameter the way
     a Gray-Scott f/k preset's is, so a live preview has no equivalent
     here — small SVG icons instead).

   Requires organica-core.js loaded first (extends window.Organica).
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = global.Organica || {};
  const T = {};

  // ═══════════════════════════════════════════════════════════
  // FIELD ALGORITHMS — ported verbatim from Living Path's RFX helpers
  // ═══════════════════════════════════════════════════════════

  // dilate (amt>0) / erode (amt<0) — real per-pixel 3×3 neighbour scan,
  // `amt` iterations of it. Slower than a blur-and-rethreshold trick but
  // exact, no halo-radius tuning.
  T.morph = function (g, amt) {
    const it = Math.abs(amt | 0), grow = amt > 0, w = g.w, h = g.h;
    for (let k = 0; k < it; k++) {
      const f = g.f, o = new Float32Array(f.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let m = f[y * w + x];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const v = f[yy * w + xx]; m = grow ? Math.max(m, v) : Math.min(m, v);
        }
        o[y * w + x] = m;
      }
      g.f = o;
    }
  };

  // Two-pass (H then V), twice — a cheap approximate Gaussian.
  T.boxBlur = function (g, r) {
    r = Math.round(r); if (r <= 0) return; const w = g.w, h = g.h;
    for (let pass = 0; pass < 2; pass++) {
      for (const horiz of [true, false]) {
        const f = g.f, o = new Float32Array(f.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let sum = 0, cnt = 0;
          for (let k = -r; k <= r; k++) {
            const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            sum += f[yy * w + xx]; cnt++;
          }
          o[y * w + x] = sum / cnt;
        }
        g.f = o;
      }
    }
  };

  T.threshold = function (g, level01) {
    const L = Math.max(0, Math.min(1, level01));
    for (let i = 0; i < g.f.length; i++) g.f[i] = g.f[i] >= L ? 1 : 0;
  };

  // Smooth value-noise jitter (bilinear lattice), added to every cell —
  // breaks up a clean edge into a grainy/degraded one. seed*99991 mirrors
  // Living Path's own constant so identical seed values reproduce.
  T.addNoise = function (g, amt, scale, seed) {
    const w = g.w, h = g.h, rnd = Organica.mulberry32 ? Organica.mulberry32((seed * 99991) >>> 0) : mulberry32Fallback((seed * 99991) >>> 0);
    const gs = Math.max(2, scale);
    const gw = Math.ceil(w / gs) + 2, gh = Math.ceil(h / gs) + 2, lat = new Float32Array(gw * gh);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const at = (gx, gy) => lat[gy * gw + gx];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / gs, fy = y / gs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
      const n = at(ix, iy) * (1 - ux) * (1 - uy) + at(ix + 1, iy) * ux * (1 - uy) + at(ix, iy + 1) * (1 - ux) * uy + at(ix + 1, iy + 1) * ux * uy;
      const i = y * w + x; g.f[i] = Math.min(1, Math.max(0, g.f[i] + (n - 0.5) * 2 * amt));
    }
  };

  // Reaction-diffusion (Gray-Scott) run as a MASK TRANSFORM, not the
  // live GPU simulation — a real CPU pass, confined to the existing ink
  // (M) exactly like Living Path's own: seeds a handful of activator
  // spots inside the shape, lets it develop, then carves the settled V
  // concentration as holes into the shape (so it reads as "this shape,
  // eaten into a coral/cellular pattern" rather than replacing it).
  T.grayScott = function (g, F, K, steps, seedn, depth) {
    const w = g.w, h = g.h, N = w * h, Du = 0.16, Dv = 0.08;
    const M = new Uint8Array(N); for (let i = 0; i < N; i++) M[i] = g.f[i] > 0.5 ? 1 : 0;
    const U = new Float32Array(N).fill(1), V = new Float32Array(N);
    const rnd = Organica.mulberry32 ? Organica.mulberry32(((seedn || 5) * 2654435761) >>> 0) : mulberry32Fallback(((seedn || 5) * 2654435761) >>> 0);
    const ink = []; for (let i = 0; i < N; i++) if (M[i]) ink.push(i);
    if (!ink.length) return;
    const spots = Math.max(6, Math.floor(ink.length / 55));
    for (let k = 0; k < spots; k++) {
      const c = ink[(rnd() * ink.length) | 0], cx = c % w, cy = (c / w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x; if (M[i]) { V[i] = 1; U[i] = 0.35; }
      }
    }
    const U2 = new Float32Array(N), V2 = new Float32Array(N);
    for (let s = 0; s < steps; s++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const l = x > 0 ? i - 1 : i, r = x < w - 1 ? i + 1 : i, u = y > 0 ? i - w : i, d = y < h - 1 ? i + w : i;
        const lapU = U[l] + U[r] + U[u] + U[d] - 4 * U[i], lapV = V[l] + V[r] + V[u] + V[d] - 4 * V[i];
        const uvv = U[i] * V[i] * V[i];
        U2[i] = U[i] + (Du * lapU - uvv + F * (1 - U[i]));
        V2[i] = V[i] + (Dv * lapV + uvv - (F + K) * V[i]);
        if (!M[i]) { V2[i] = 0; U2[i] = 1; }
      }
      U.set(U2); V.set(V2);
    }
    let mx = 0; for (let i = 0; i < N; i++) if (V[i] > mx) mx = V[i];
    const inv = mx > 1e-4 ? 1 / mx : 1, dp = (depth == null ? 0.9 : depth / 100);
    for (let i = 0; i < N; i++) g.f[i] = M[i] ? Math.max(0, 1 - dp * V[i] * inv) : 0;
  };

  // Scatter disks seeded on the ink; they accrete into bubbly nodules
  // along the shape (union into the field). keepBody=1 keeps the source
  // shape, 0 = disks only.
  T.particles = function (g, count, size, spread, seed, keepBody) {
    const w = g.w, h = g.h, f = g.f, rnd = Organica.mulberry32 ? Organica.mulberry32((seed * 2654435761) >>> 0) : mulberry32Fallback((seed * 2654435761) >>> 0);
    const ink = []; for (let i = 0; i < f.length; i++) if (f[i] > 0.5) ink.push(i);
    if (!ink.length) return;
    const out = new Float32Array(f.length); if (keepBody) out.set(f);
    for (let k = 0; k < count; k++) {
      const i = ink[(rnd() * ink.length) | 0];
      let cx = (i % w) + (rnd() * 2 - 1) * spread, cy = ((i / w) | 0) + (rnd() * 2 - 1) * spread;
      const r = size * (0.5 + rnd());
      const x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(w - 1, (cx + r) | 0),
            y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(h - 1, (cy + r) | 0);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) out[y * w + x] = 1;
    }
    g.f = out;
  };

  // Zhang–Suen thinning → 1px skeleton, then dilate to a constant width.
  T.skeleton = function (g, width) {
    const w = g.w, h = g.h; let b = new Uint8Array(w * h);
    for (let i = 0; i < b.length; i++) b[i] = g.f[i] > 0.5 ? 1 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : b[y * w + x];
    let changed = true, guard = 0;
    while (changed && guard++ < 60) {
      changed = false;
      for (const step of [0, 1]) {
        const del = [];
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          if (!at(x, y)) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1),
                p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const C = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) + (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1)
                  + (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) + (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
          const Nn = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (C !== 1 || Nn < 2 || Nn > 6) continue;
          if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
          else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
          del.push(y * w + x);
        }
        if (del.length) { changed = true; for (const i of del) b[i] = 0; }
      }
    }
    const sk = { w, h, f: new Float32Array(w * h) };
    for (let i = 0; i < b.length; i++) sk.f[i] = b[i];
    if (width > 0) T.morph(sk, width);
    g.f = sk.f;
  };

  // Content-aware seam removal — dir 0 = vertical seams (narrows width),
  // 1 = horizontal (transposes, removes, transposes back).
  T.seamCarve = function (g, count, dir) {
    let W = dir ? g.h : g.w, H = dir ? g.w : g.h;
    let cur = new Float32Array(W * H);
    if (dir) { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) cur[x * H + y] = g.f[y * g.w + x]; }
    else cur.set(g.f);
    const startW = W; count = Math.max(0, Math.min(count | 0, W - 4));
    for (let s = 0; s < count; s++) {
      const en = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const l = cur[y * W + (x > 0 ? x - 1 : 0)], r = cur[y * W + (x < W - 1 ? x + 1 : W - 1)];
        const u = cur[(y > 0 ? y - 1 : 0) * W + x], d = cur[(y < H - 1 ? y + 1 : H - 1) * W + x];
        en[y * W + x] = Math.abs(r - l) + Math.abs(d - u);
      }
      const M = new Float32Array(W * H), back = new Int32Array(W * H);
      for (let x = 0; x < W; x++) M[x] = en[x];
      for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
        let best = M[(y - 1) * W + x], bx = x;
        if (x > 0 && M[(y - 1) * W + x - 1] < best) { best = M[(y - 1) * W + x - 1]; bx = x - 1; }
        if (x < W - 1 && M[(y - 1) * W + x + 1] < best) { best = M[(y - 1) * W + x + 1]; bx = x + 1; }
        M[y * W + x] = en[y * W + x] + best; back[y * W + x] = bx;
      }
      let minx = 0, minv = Infinity;
      for (let x = 0; x < W; x++) { const v = M[(H - 1) * W + x]; if (v < minv) { minv = v; minx = x; } }
      const nw = W - 1, nf = new Float32Array(nw * H); let sx = minx;
      for (let y = H - 1; y >= 0; y--) {
        let j = 0;
        for (let x = 0; x < W; x++) { if (x === sx) continue; nf[y * nw + j] = cur[y * W + x]; j++; }
        sx = back[y * W + sx];
      }
      cur = nf; W = nw;
    }
    const full = new Float32Array(startW * H), off = Math.floor((startW - W) / 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) full[y * startW + x + off] = cur[y * W + x];
    if (dir) {
      const o = new Float32Array(g.w * g.h);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) o[y * g.w + x] = full[x * startW + y];
      g.f = o;
    } else g.f = full;
  };

  // Block-quantise → chunky/faceted regions.
  T.polygonize = function (g, block) {
    const w = g.w, h = g.h, f = g.f; block = Math.max(2, block | 0);
    const o = new Float32Array(f.length);
    for (let by = 0; by < h; by += block) for (let bx = 0; bx < w; bx += block) {
      let sum = 0, c = 0; const x1 = Math.min(w, bx + block), y1 = Math.min(h, by + block);
      for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) { sum += f[y * w + x]; c++; }
      const v = sum / c > 0.5 ? 1 : 0;
      for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) o[y * w + x] = v;
    }
    g.f = o;
  };

  // Fallback PRNG if Organica.mulberry32 isn't exposed by the host tool
  // (organica-core.js doesn't currently export one — most tools keep
  // their own local copy) — same algorithm, so seeded results match.
  function mulberry32Fallback(seed) {
    let t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CANVAS ADAPTERS — the seam between "generic field algorithm" and
  // Organica's own mask-canvas convention (alpha>0 = ink, RGB unused).
  // ═══════════════════════════════════════════════════════════
  T.canvasToField = function (canvas) {
    const w = canvas.width, h = canvas.height;
    const id = canvas.getContext('2d').getImageData(0, 0, w, h);
    const f = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) f[i] = id.data[i * 4 + 3] / 255;
    return { w, h, f };
  };
  T.fieldToCanvas = function (g, canvas) {
    const ctx = canvas.getContext('2d');
    const id = ctx.createImageData(g.w, g.h);
    for (let i = 0; i < g.w * g.h; i++) {
      const v = Math.max(0, Math.min(1, g.f[i]));
      id.data[i * 4 + 3] = Math.round(v * 255);   // RGB stays 0 (black) — only alpha carries the shape
    }
    ctx.putImageData(id, 0, 0);
  };

  // ═══════════════════════════════════════════════════════════
  // PICKER UI — thumbnail dropdown, same visual contract (CSS classes)
  // as Pattern's own preset-trigger/preset-menu in organica-panel.css.
  // Static SVG icons, not live-simulated thumbnails — see file header.
  // ═══════════════════════════════════════════════════════════
  let pickerSeq = 0;
  T.buildPicker = function (hostEl, registry, opts) {
    opts = opts || {};
    const noneLabel = opts.noneLabel || 'None';
    const noneIcon = opts.noneIcon || '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.5 2.5"/></svg>';
    const id = 'txpick' + (pickerSeq++);
    let active = opts.initial || '';

    const label = key => key ? ((registry[key] && registry[key].name) || key) : noneLabel;
    const icon = key => key ? ((registry[key] && registry[key].icon) || '') : noneIcon;

    hostEl.innerHTML = `<button class="preset-trigger" id="${id}-trigger" aria-label="${opts.ariaLabel || 'Preset'}">
        <span class="pt-ico" id="${id}-ico"></span><span class="pt-name" id="${id}-name"></span><span class="pt-chev">▾</span>
      </button><div class="preset-menu" id="${id}-menu" hidden></div>`;
    const trigger = document.getElementById(id + '-trigger'), menu = document.getElementById(id + '-menu');
    const icoEl = document.getElementById(id + '-ico'), nameEl = document.getElementById(id + '-name');

    function updateTrigger() { icoEl.innerHTML = icon(active); nameEl.textContent = label(active); }
    function populateMenu() {
      menu.innerHTML = '';
      (opts.noNone ? Object.keys(registry) : ['', ...Object.keys(registry)]).forEach(key => {
        const row = document.createElement('button');
        row.className = 'preset-item' + (key === active ? ' on' : '');
        row.innerHTML = `<span class="pi-ico">${icon(key)}</span><span class="pi-name">${label(key)}</span>`;
        row.addEventListener('click', () => { setActive(key); menu.hidden = true; });
        menu.appendChild(row);
      });
    }
    function positionMenu() {
      const t = trigger.getBoundingClientRect(), gap = 5, margin = 12;
      const below = window.innerHeight - t.bottom - margin, above = t.top - margin;
      menu.style.left = t.left + 'px'; menu.style.width = t.width + 'px';
      if (below >= 160 || below >= above) { menu.style.top = (t.bottom + gap) + 'px'; menu.style.bottom = 'auto'; menu.style.maxHeight = Math.max(120, below) + 'px'; }
      else { menu.style.bottom = (window.innerHeight - t.top + gap) + 'px'; menu.style.top = 'auto'; menu.style.maxHeight = Math.max(120, above) + 'px'; }
    }
    function setActive(key) {
      active = key;
      updateTrigger();
      if (opts.onChange) opts.onChange(key);
    }
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      if (menu.hidden) { populateMenu(); positionMenu(); menu.hidden = false; } else menu.hidden = true;
    });
    document.addEventListener('click', e => {
      if (!menu.hidden && !hostEl.contains(e.target) && !menu.contains(e.target)) menu.hidden = true;
    });
    updateTrigger();
    return { getActive: () => active, setActive };
  };

  Organica.Transformer = T;
  global.Organica = Organica;
}(typeof window !== 'undefined' ? window : global));
