/* ─────────────────────────────────────────────────────────────
   ORGANICA — core.js
   The utilities every Organica tool needs, in one place.

   Why this file exists: these routines used to be copy-pasted between
   tools, and they had already drifted apart in ways that mattered —
   Living Path revoked its download URL after a delay (correct) while three
   other tools revoked it immediately (can cancel the download in some
   browsers); Komorebi's contour tracer emitted 2-decimal coordinates while
   Halide's emitted integers; Komorebi validated colour hex input while
   Halide did not. A bug fixed in one copy never reached the others.

   Each routine below is the merged best version, so adopting it is an
   upgrade rather than a lateral move. Notes on the merges are inline.

   Everything hangs off window.Organica. No build step, no modules —
   a plain <script src="/shared/core.js"> before the tool's own
   script, matching how /genesis/forms.js is already loaded.

   See docs/SHARED-LIBRARY.md.
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = {};

  // ═══════════════════════════════════════════════════════════
  // FILES
  // ═══════════════════════════════════════════════════════════

  // Revoking the object URL synchronously after .click() can cancel the
  // download before the browser has read it — Living Path already worked
  // around this with a delay; the other tools had the racy version. The
  // delayed revoke is the one that is correct everywhere.
  Organica.download = function (blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  Organica.downloadText = function (text, name, mime) {
    Organica.download(new Blob([text], { type: mime || 'text/plain' }), name);
  };

  // Timestamped filename, the convention every tool already used:
  //   halide-1753440000000.svg
  Organica.stamp = function (tool, ext) {
    return tool + '-' + Date.now() + '.' + ext;
  };

  // ═══════════════════════════════════════════════════════════
  // COLOUR
  // ═══════════════════════════════════════════════════════════

  // Halide accepted whatever was typed into a hex field, so a stray
  // keystroke could set an invalid colour; Komorebi validated and fell back.
  // Validation is the correct behaviour, so it lives here for everyone.
  Organica.normalizeHex = function (hex, fallback) {
    hex = String(hex == null ? '' : hex).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return String(fallback || '#000000').toLowerCase();
    return hex.toLowerCase();
  };

  Organica.hexToRGB = function (hex) {
    const n = parseInt(Organica.normalizeHex(hex, '#000000').slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  Organica.hexToRGB255 = function (hex) {
    const n = parseInt(Organica.normalizeHex(hex, '#000000').slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  Organica.rgbToHex = function (r, g, b) {
    const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  };

  // Promoted from an inline expression in createColorSwatch's own random
  // button (the only place this existed before) — Colornet is the second
  // consumer (Shuffle + Random Colors), so it lives here now.
  Organica.randomHex = function () {
    return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  };

  // CMYK ↔ RGB. Written first inside tunesutra/index.html, where its own
  // comment flagged them as "PROMOTION CANDIDATE once a second tool needs
  // them" — Colornet (a print-separation tool) is that second tool, so they
  // live here now. Naive/uncalibrated conversion (no ICC profile, no ink
  // model): correct for a UI readout and for round-tripping a screen colour,
  // NOT a substitute for a real press profile. TuneSutra's own two functions
  // now delegate to these rather than keeping a second copy.
  //   rgbToCmyk: r,g,b in 0–255 → {c,m,y,k} in 0–100 (integers)
  //   cmykToRgb: c,m,y,k in 0–100 → {r,g,b} in 0–255 (integers)
  Organica.rgbToCmyk = function (r, g, b) {
    const round = Math.round;
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
    const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
    const y = k === 1 ? 0 : (1 - b - k) / (1 - k);
    return { c: round(c * 100), m: round(m * 100), y: round(y * 100), k: round(k * 100) };
  };

  Organica.cmykToRgb = function (c, m, y, k) {
    const round = Math.round;
    c /= 100; m /= 100; y /= 100; k /= 100;
    return {
      r: round(255 * (1 - c) * (1 - k)),
      g: round(255 * (1 - m) * (1 - k)),
      b: round(255 * (1 - y) * (1 - k)),
    };
  };

  // Standard mulberry32 — a small, fast, seeded PRNG. Found independently
  // reimplemented byte-for-byte identically (down to the exact magic
  // constants) in ~9 places (FVS, Living Path, Mycel, Camo Turing, Vortex,
  // Genesis Creator, every loom/js/generators/*.js file) — the project's
  // own established reproducible-seed convention (Camouflage, Vortex,
  // FVS, TuneSutra, Mycel all reset one of these per generation from a
  // numeric Seed control). Genesis Creator's own copy used `t += 0x...`
  // without the `|0` re-mask other copies have — same result per call
  // (Math.imul coerces internally regardless) but lets the stored `t`
  // drift outside safe 32-bit float precision over a long sequence;
  // consolidating onto this version is a small correctness fix there,
  // not just deduplication.
  Organica.mulberry32 = function (seed) {
    let t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Colour-swatch + RMX-chip UI moved to shared/palette.js
  // (Organica.palette.swatch, JS + paired palette.css).

  // ═══════════════════════════════════════════════════════════
  // PRESET STORAGE
  //
  // Key convention: organica.<tool>.<thing>. A tool created before
  // July 2026 may still have data under a legacy key — pass it and the
  // store migrates forward on first read. The legacy key is deliberately
  // NOT deleted: saved presets are real user work, and leaving the old
  // copy means rolling back to an earlier deploy still finds them.
  // ═══════════════════════════════════════════════════════════

  Organica.presetStore = function (tool, legacyKey) {
    const key = 'organica.' + tool + '.presets';
    return {
      key: key,
      read() {
        try {
          const cur = localStorage.getItem(key);
          if (cur !== null) return JSON.parse(cur || '{}');
          if (!legacyKey) return {};
          const old = localStorage.getItem(legacyKey);
          if (old === null) return {};
          localStorage.setItem(key, old);      // migrate forward, keep the original
          return JSON.parse(old || '{}');
        } catch (e) { return {}; }
      },
      write(obj) {
        try { localStorage.setItem(key, JSON.stringify(obj)); return true; }
        catch (e) { return false; }            // quota / private mode — caller decides what to say
      },
    };
  };

  // ═══════════════════════════════════════════════════════════
  // LOOM GRID IMPORT
  //
  // Reads Loom's own Universal JSON Model (the exact object
  // loom/js/json-model.js's buildModel() produces — canvas/grid/cells)
  // and resolves it into absolute per-cell geometry any OTHER Organica
  // tool can consume, without that tool needing to know anything about
  // tracks, spans, Kiwi, or polygon generators. This is the cross-tool
  // half of Loom's own brief — "the user can save a grid in Loom, then
  // use it as an import in any other Organica tool."
  //
  // Deliberately NOT an ES module import of Loom's own json-model.js:
  // every other Organica tool is a plain single-file `<script>` (no
  // bundler), the same reason every polygon generator in loom/js/
  // keeps its own private copy of clipToRect rather than sharing one —
  // this ports the same two small, pure functions (innerRect,
  // resolveCellRects) rather than pulling in a module loader for two
  // functions. Kept easy to eyeball against the originals if either
  // ever drifts (loom/js/canvas-manager.js's own innerRect,
  // loom/js/json-model.js's own resolveCellRects).
  // ═══════════════════════════════════════════════════════════

  function loomInnerRect(canvas) {
    const shortSide = Math.min(canvas.width, canvas.height);
    const m = shortSide * ((canvas.margin || 0) / 100);
    return {
      x: m, y: m,
      width: Math.max(1, canvas.width - 2 * m),
      height: Math.max(1, canvas.height - 2 * m),
    };
  }

  function loomResolveCellRects(model, inner) {
    const { tracks, gap, padding } = model.grid;
    const pad = padding || 0;
    const offsets = (sizes) => {
      const out = [0];
      for (let i = 0; i < sizes.length; i++) out.push(out[i] + sizes[i] + gap);
      return out;
    };
    const colOff = offsets(tracks.cols), rowOff = offsets(tracks.rows);
    return model.cells.map(c => {
      const x = inner.x + colOff[c.col] + pad;
      const y = inner.y + rowOff[c.row] + pad;
      const width = colOff[c.col + c.colSpan] - colOff[c.col] - gap - 2 * pad;
      const height = rowOff[c.row + c.rowSpan] - rowOff[c.row] - gap - 2 * pad;
      return { ...c, shape: 'rect', x, y, width: Math.max(0, width), height: Math.max(0, height) };
    });
  }

  // @param {string|object} input — a Loom JSON export, parsed or not.
  // @returns {{canvas, inner, cellShape, cells}} or throws a plain Error
  //   with a message safe to show a user directly (not a stack trace) —
  //   callers are expected to try/catch this, the same "never let a bad
  //   import crash the host tool" discipline every file-input handler in
  //   Organica already follows (Living Path's .lvp load, Warping's own
  //   image drop, etc.).
  Organica.loadLoomGrid = function (input) {
    let model;
    try {
      model = typeof input === 'string' ? JSON.parse(input) : input;
    } catch (e) {
      throw new Error('Not valid JSON.');
    }
    if (!model || !model.canvas || !model.grid || !Array.isArray(model.cells)) {
      throw new Error('Not a Loom grid export — missing canvas/grid/cells.');
    }
    const inner = loomInnerRect(model.canvas);
    const cellShape = model.grid.cellShape === 'polygon' ? 'polygon' : 'rect';
    const cells = cellShape === 'polygon'
      ? model.cells.map(c => ({ ...c, shape: 'polygon' }))   // already absolute points/centroid
      : loomResolveCellRects(model, inner);
    return { canvas: model.canvas, grid: model.grid, inner, cellShape, cells };
  };

  // ═══════════════════════════════════════════════════════════
  // FIGMA
  //
  // The one formal contract between Organica tools and the plugin:
  // postMessage({ pluginMessage: { type: 'organica-svg', svg, name } }).
  // Spore, Pollen, Halide and Komorebi each had their own copy of this
  // line; the shape is identical, so it belongs here.
  // ═══════════════════════════════════════════════════════════

  Organica.sendToFigma = function (svg, toolName) {
    global.parent.postMessage({
      pluginMessage: {
        type: 'organica-svg',
        svg: svg,
        name: toolName + ' — ' + new Date().toLocaleTimeString(),
      },
    }, '*');
  };

  // ═══════════════════════════════════════════════════════════
  // CONTOUR TRACING
  //
  // Turns a binary cell mask into closed rectilinear polygons — only
  // horizontal/vertical segments, no curve fitting, so the blocky look is
  // preserved. Written for Halide's SVG "Simplify shapes" (one <path> per
  // region instead of one <rect> per cell) and reused verbatim by
  // Komorebi's tone-band separation.
  //
  // Boundary edges are walked clockwise in SVG's y-down space. At a
  // checkerboard saddle — two ink cells touching only at a corner — a vertex
  // has two valid outgoing edges; always taking the tightest clockwise turn
  // keeps every loop simple without special-casing the diagonal touch.
  //
  // fill-rule="evenodd" on the resulting path resolves holes and nesting
  // regardless of each loop's winding direction.
  // ═══════════════════════════════════════════════════════════

  const CONTOUR_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // right, down, left, up

  function contourDirIndex(dx, dy) {
    for (let i = 0; i < 4; i++) if (CONTOUR_DIRS[i][0] === dx && CONTOUR_DIRS[i][1] === dy) return i;
    return -1;
  }

  Organica.traceContours = function (mask, W, H) {
    const ink = (x, y) => x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] === 1;
    const edgesFrom = new Map();
    const addEdge = (x1, y1, x2, y2) => {
      const k = x1 + ',' + y1;
      let arr = edgesFrom.get(k);
      if (!arr) { arr = []; edgesFrom.set(k, arr); }
      arr.push([x2, y2]);
    };

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!ink(x, y)) continue;
      if (!ink(x, y - 1)) addEdge(x, y, x + 1, y);           // top
      if (!ink(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);   // right
      if (!ink(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);   // bottom
      if (!ink(x - 1, y)) addEdge(x, y + 1, x, y);           // left
    }

    const used = new Set();
    const edgeKey = (x1, y1, x2, y2) => x1 + ',' + y1 + '>' + x2 + ',' + y2;
    const loops = [];

    for (const [fromKey, targets] of edgesFrom) {
      for (const [tx, ty] of targets) {
        const [fx, fy] = fromKey.split(',').map(Number);
        if (used.has(edgeKey(fx, fy, tx, ty))) continue;
        const loop = [[fx, fy]];
        used.add(edgeKey(fx, fy, tx, ty));
        loop.push([tx, ty]);
        let curDir = contourDirIndex(tx - fx, ty - fy);
        let cx = tx, cy = ty, guard = 0;
        while (!(cx === fx && cy === fy) && guard++ < W * H * 4 + 8) {
          const candidates = edgesFrom.get(cx + ',' + cy) || [];
          const avail = candidates.filter(([tx2, ty2]) => !used.has(edgeKey(cx, cy, tx2, ty2)));
          if (!avail.length) break;   // malformed boundary — bail out of this loop gracefully
          let best = null, bestScore = -Infinity;
          for (const [tx2, ty2] of avail) {
            const d = contourDirIndex(tx2 - cx, ty2 - cy);
            const turn = (d - curDir + 4) % 4;   // 0=straight, 1=right, 2=back, 3=left
            const score = turn === 1 ? 3 : turn === 0 ? 2 : turn === 3 ? 1 : 0;
            if (score > bestScore) { bestScore = score; best = [tx2, ty2, d]; }
          }
          used.add(edgeKey(cx, cy, best[0], best[1]));
          loop.push([best[0], best[1]]);
          curDir = best[2];
          cx = best[0]; cy = best[1];
        }
        loops.push(loop);
      }
    }
    return loops;
  };

  // Merge consecutive collinear points — a straight run of unit steps
  // becomes one segment instead of many.
  Organica.simplifyLoop = function (loop) {
    const n = loop.length - 1;   // last point repeats the first (closed)
    if (n < 3) return loop.slice(0, -1);
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = loop[(i - 1 + n) % n], cur = loop[i], next = loop[(i + 1) % n];
      const dx1 = cur[0] - prev[0], dy1 = cur[1] - prev[1];
      const dx2 = next[0] - cur[0], dy2 = next[1] - cur[1];
      if (dx1 !== dx2 || dy1 !== dy2) out.push(cur);
    }
    return out;
  };

  // Halide's block size is an integer (export scale) and its old tracer
  // emitted bare integers; Komorebi's block is fractional (outW / traceW)
  // and its copy emitted .toFixed(2) — which would have bloated Halide's
  // files with a pointless ".00" on every coordinate. Rounding to 2dp and
  // letting String() drop trailing zeros gives both tools the shortest
  // correct form: integers stay integers, fractions keep their precision.
  function coord(v) {
    return String(Math.round(v * 100) / 100);
  }

  Organica.contoursToPathD = function (mask, W, H, block) {
    const loops = Organica.traceContours(mask, W, H);
    let d = '';
    for (const loop of loops) {
      const s = Organica.simplifyLoop(loop);
      if (s.length < 3) continue;
      d += 'M' + coord(s[0][0] * block) + ',' + coord(s[0][1] * block);
      for (let i = 1; i < s.length; i++) d += 'L' + coord(s[i][0] * block) + ',' + coord(s[i][1] * block);
      d += 'Z';
    }
    return d;
  };

  // ═══════════════════════════════════════════════════════════
  // DITHER — promoted from Halide (halide/index.html), which had the only
  // copy. Colornet is the second consumer (its own 'dither' screen mode).
  // Takes a 0..1 "gray" field, returns a Uint8Array of 0/1 ink flags
  // (1 = dark = ink). Halide's own local copies now alias these.
  // ═══════════════════════════════════════════════════════════

  Organica.dither = {};

  // Floyd–Steinberg (1976): classic 4-neighbour error diffusion.
  Organica.dither.FS_KERNEL = [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]];

  // Atkinson (Bill Atkinson, Apple, 1984): only diffuses 6/8 of the error,
  // discarding the rest — punchier, higher-contrast than Floyd–Steinberg.
  Organica.dither.ATKINSON_KERNEL = [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]];

  // 7 more classic error-diffusion kernels (Colornet's own "match Dotraster's
  // named list" pass) — each verified summing to 1.0, same [dx,dy,weight]
  // triple convention as FS/Atkinson above.
  Organica.dither.JJN_KERNEL = [
    [1, 0, 7 / 48], [2, 0, 5 / 48],
    [-2, 1, 3 / 48], [-1, 1, 5 / 48], [0, 1, 7 / 48], [1, 1, 5 / 48], [2, 1, 3 / 48],
    [-2, 2, 1 / 48], [-1, 2, 3 / 48], [0, 2, 5 / 48], [1, 2, 3 / 48], [2, 2, 1 / 48],
  ];
  Organica.dither.STUCKI_KERNEL = [
    [1, 0, 8 / 42], [2, 0, 4 / 42],
    [-2, 1, 2 / 42], [-1, 1, 4 / 42], [0, 1, 8 / 42], [1, 1, 4 / 42], [2, 1, 2 / 42],
    [-2, 2, 1 / 42], [-1, 2, 2 / 42], [0, 2, 4 / 42], [1, 2, 2 / 42], [2, 2, 1 / 42],
  ];
  Organica.dither.BURKES_KERNEL = [
    [1, 0, 8 / 32], [2, 0, 4 / 32],
    [-2, 1, 2 / 32], [-1, 1, 4 / 32], [0, 1, 8 / 32], [1, 1, 4 / 32], [2, 1, 2 / 32],
  ];
  Organica.dither.SIERRA_KERNEL = [
    [1, 0, 5 / 32], [2, 0, 3 / 32],
    [-2, 1, 2 / 32], [-1, 1, 4 / 32], [0, 1, 5 / 32], [1, 1, 4 / 32], [2, 1, 2 / 32],
    [-1, 2, 2 / 32], [0, 2, 3 / 32], [1, 2, 2 / 32],
  ];
  Organica.dither.SIERRA_TWO_ROW_KERNEL = [
    [1, 0, 4 / 16], [2, 0, 3 / 16],
    [-2, 1, 1 / 16], [-1, 1, 2 / 16], [0, 1, 3 / 16], [1, 1, 2 / 16], [2, 1, 1 / 16],
  ];
  Organica.dither.SIERRA_LITE_KERNEL = [[1, 0, 2 / 4], [-1, 1, 1 / 4], [0, 1, 1 / 4]];
  Organica.dither.SIMPLE2D_KERNEL = [[1, 0, 1 / 2], [0, 1, 1 / 2]];

  Organica.dither.errorDiffusion = function errorDiffusion(gray, W, H, kernel, serpentine) {
    const buf = Float32Array.from(gray);
    const cells = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const ltr = !serpentine || (y % 2 === 0);
      for (let xi = 0; xi < W; xi++) {
        const x = ltr ? xi : W - 1 - xi;
        const i = y * W + x;
        const old = buf[i];
        const ink = old < 0.5 ? 1 : 0;
        cells[i] = ink;
        const err = old - (ink ? 0 : 1);
        for (let k = 0; k < kernel.length; k++) {
          const dx = ltr ? kernel[k][0] : -kernel[k][0];
          const nx = x + dx, ny = y + kernel[k][1];
          if (nx < 0 || nx >= W || ny >= H) continue;
          buf[ny * W + nx] += err * kernel[k][2];
        }
      }
    }
    return cells;
  };

  // Bayer ordered dithering: recursive matrix construction, normalised to
  // a 0..1 threshold and tiled across the field. No error diffusion, so
  // it's stable/repeatable — the halftone-screen look, no directional
  // streaking.
  const _bayerCache = {};
  Organica.dither.bayerMatrix = function bayerMatrix(n) {
    if (n === 1) return [[0]];
    const half = Organica.dither.bayerMatrix(n / 2), s = half.length;
    const m = Array.from({ length: n }, () => new Array(n));
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = half[y][x] * 4;
      m[y][x] = v; m[y][x + s] = v + 2; m[y + s][x] = v + 3; m[y + s][x + s] = v + 1;
    }
    return m;
  };
  Organica.dither.bayerThresholds = function bayerThresholds(n) {
    if (!_bayerCache[n]) {
      const m = Organica.dither.bayerMatrix(n);
      const t = new Float32Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) t[y * n + x] = (m[y][x] + 0.5) / (n * n);
      _bayerCache[n] = t;
    }
    return _bayerCache[n];
  };
  // Shared tiling loop — Bayer's own recursive matrix and a user-authored
  // custom Pattern (Colornet's Pattern mode) both end up as a plain
  // Float32Array of n*n thresholds in [0,1]; this is the one loop that
  // tiles either across a field. `ordered` below is the Bayer-specific
  // convenience wrapper.
  Organica.dither.orderedCustom = function orderedCustom(gray, W, H, thresholds, n) {
    const cells = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      cells[y * W + x] = gray[y * W + x] < thresholds[(y % n) * n + (x % n)] ? 1 : 0;
    }
    return cells;
  };
  Organica.dither.ordered = function ordered(gray, W, H, n) {
    return Organica.dither.orderedCustom(gray, W, H, Organica.dither.bayerThresholds(n), n);
  };

  // `level` optional, default 0.5 — Halide's own only call site (still 3
  // args) is unaffected; Colornet is the second consumer, passing a level.
  Organica.dither.threshold = function threshold(gray, W, H, level) {
    if (level == null) level = 0.5;
    const cells = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) cells[i] = gray[i] < level ? 1 : 0;
    return cells;
  };

  // ═══════════════════════════════════════════════════════════
  // FORMAT — aspect-ratio select
  //
  // Komorebi and Camouflage each carried their own copy of this exact
  // "N:M" parse (Komorebi's select has 6 options incl. 2:3 and the
  // A-series root-2 ratio; Camouflage's has 4 and had already drifted
  // to a subset). What's genuinely shared is the parsing, not the
  // resize itself — each tool reacts to a new ratio differently
  // (Komorebi just restyles a CSS aspect-ratio and re-renders on demand;
  // Camouflage resizes its CPU pixel buffer; Camo Turing reallocates
  // its WebGL simulation render targets) so ONLY the ratio math is
  // centralised here — each tool still owns its own resizeCanvas().
  // ═══════════════════════════════════════════════════════════

  Organica.formatRatio = function (select) {
    const [a, b] = select.value.split(':').map(Number);
    return a / b;
  };

  // ═══════════════════════════════════════════════════════════
  // ZOOM & PAN
  //
  // Wheel-zoom toward the cursor, drag to pan, double-click to reset,
  // ⌘/Ctrl +/-/0. Spore, Pollen and Halide each carried a near-identical
  // copy that differed only in whitespace.
  //
  // The tool owns its DOM; this owns the maths. onChange fires with the
  // current transform so the caller can update its own HUD.
  // ═══════════════════════════════════════════════════════════

  Organica.createZoomPan = function (opts) {
    const canvas = opts.canvas;
    const wrap = opts.wrap || canvas.parentElement;
    const MIN = opts.min == null ? 1 : opts.min;
    const MAX = opts.max == null ? 12 : opts.max;
    const onChange = opts.onChange || function () {};
    const isReady = opts.isReady || function () { return true; };
    // Every existing caller (image/canvas tools) wants panning gated on
    // "already zoomed in" — panning a 1:1 image at 100% has nothing to
    // reveal. A node-graph canvas is the opposite: empty canvas space at
    // 100% is exactly where you pan to see more of the graph. Opt-in only,
    // so no existing caller's behaviour changes — see docs/ plan for
    // Rhizome (aggiungi-le-axploration-come-shimmying-koala.md, Parte 3.4d).
    const panAlways = !!opts.panAlways;

    let zoom = 1, panX = 0, panY = 0;
    let panning = false, startX = 0, startY = 0;

    function apply() {
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      onChange({ zoom, panX, panY, zoomed: zoom > 1.001 });
    }

    function reset() { zoom = 1; panX = 0; panY = 0; apply(); }

    function zoomBy(factor, fx, fy) {
      if (!isReady()) return;
      const r = canvas.getBoundingClientRect();
      if (fx == null) { fx = r.left + r.width / 2; fy = r.top + r.height / 2; }
      const cx = fx - r.left, cy = fy - r.top;
      const prev = zoom;
      zoom = Math.min(MAX, Math.max(MIN, zoom * factor));
      const ratio = zoom / prev;
      panX -= cx * (ratio - 1);
      panY -= cy * (ratio - 1);
      if (zoom === MIN) { panX = 0; panY = 0; }
      apply();
    }

    wrap.addEventListener('wheel', e => {
      if (!isReady()) return;
      e.preventDefault();
      // A focused <input type=range>/number captures wheel scroll GLOBALLY in
      // Chromium — independent of where the cursor actually is — so leaving a
      // panel slider focused after dragging it, then scrolling over the canvas
      // to zoom, silently nudges that slider's value too (found live: Gap and
      // Seed both drifted while scroll-zooming Loom's Hexagonal preview, which
      // read as "some hexagons are wrong" once the grid quietly regenerated
      // under different params). Blurring any focused control outside the
      // zoom/pan surface itself, right before zooming, makes wheel-over-canvas
      // mean "zoom" only, never "zoom AND adjust whatever slider I last used."
      if (document.activeElement && document.activeElement !== document.body &&
          !wrap.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    }, { passive: false });

    canvas.addEventListener('mousedown', e => {
      if (!panAlways && zoom <= 1.001) return;
      panning = true; startX = e.clientX - panX; startY = e.clientY - panY;
      canvas.classList.add('panning');
      e.preventDefault();
    });
    global.addEventListener('mousemove', e => {
      if (!panning) return;
      panX = e.clientX - startX; panY = e.clientY - startY; apply();
    });
    global.addEventListener('mouseup', () => {
      if (!panning) return;
      panning = false; canvas.classList.remove('panning');
    });
    canvas.addEventListener('dblclick', reset);

    global.addEventListener('keydown', e => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.2); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / 1.2); }
      else if (e.key === '0') { e.preventDefault(); reset(); }
    });

    apply();
    return {
      zoomBy, reset, apply,
      get zoom() { return zoom; },
      get pan() { return { x: panX, y: panY }; },
    };
  };

  // ═══════════════════════════════════════════════════════════
  // HEADER
  //
  // The bar is markup (see shared/header.css); this owns the two
  // behaviours that were missing everywhere and are easy to get wrong.
  // ═══════════════════════════════════════════════════════════

  // Status. The element is an <output> — implicitly role="status", a polite
  // live region — so this announces to a screen reader as well as painting
  // pixels. Before, #status-text was mutated silently: the one piece of
  // feedback you need mid-export was invisible to anyone not watching.
  //   state: 'active' (done) | 'busy' (working) | '' (idle)
  Organica.status = function (root) {
    root = root || document;
    const dot = root.querySelector('.org-header__dot');
    const text = root.querySelector('.org-header__state');
    return function setStatus(state, msg) {
      if (dot) dot.className = 'org-header__dot' + (state ? ' ' + state : '');
      if (text) text.textContent = msg;
    };
  };

  // Export popover. Handles the accessibility contract a bare click handler
  // always forgets: aria-expanded on the trigger, Escape to dismiss,
  // click-outside to dismiss, and returning focus to the trigger on close
  // so keyboard users don't get dropped at the top of the document.
  Organica.popover = function (triggerEl, panelEl) {
    let open = false;

    function setOpen(next) {
      open = next;
      panelEl.dataset.open = String(open);
      triggerEl.setAttribute('aria-expanded', String(open));
      if (open) {
        const first = panelEl.querySelector('button, select, input, a[href]');
        if (first) first.focus();
      }
    }

    function close(returnFocus) {
      if (!open) return;
      setOpen(false);
      if (returnFocus) triggerEl.focus();
    }

    triggerEl.setAttribute('aria-expanded', 'false');
    triggerEl.setAttribute('aria-haspopup', 'dialog');
    panelEl.setAttribute('role', 'dialog');
    panelEl.dataset.open = 'false';

    triggerEl.addEventListener('click', e => { e.stopPropagation(); setOpen(!open); });

    document.addEventListener('click', e => {
      if (!open) return;
      if (!panelEl.contains(e.target) && e.target !== triggerEl) close(false);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close(true);
    });

    // Tabbing past the last control should close rather than leave an open
    // panel behind the rest of the page.
    panelEl.addEventListener('focusout', e => {
      if (open && !panelEl.contains(e.relatedTarget) && e.relatedTarget !== triggerEl) close(false);
    });

    return { close: () => close(false), get isOpen() { return open; } };
  };

  // ═══════════════════════════════════════════════════════════
  // ACCESSIBLE NAMES
  //
  // Audit finding: 121 of ~210 form controls across the six panels had no
  // accessible name — a slider sits next to a ".ctrl-label" that says
  // "Grid width", but nothing programmatically ties them together, so a
  // screen reader announces "slider" with no name. Visually the label is
  // right there; to assistive tech it doesn't exist. That's a WCAG 4.1.2
  // failure, and it's the same markup pattern (row → label + control)
  // repeated in every tool, so it gets one fix here rather than 121
  // hand-edits across six files.
  //
  // Call once after a panel's rows exist (population from JS is fine —
  // this runs after, or call it again if you build rows dynamically).
  // Idempotent: controls that already have a name are left untouched, so
  // it's safe to call more than once.
  // ═══════════════════════════════════════════════════════════

  let autoLabelSeq = 0;

  Organica.autoLabelPanel = function (root) {
    root = root || document;
    const rowSel = '.ctrl-row, .panel-row, .row, .color-row, .check-row, .param-row, .toggle-row';
    // .param-name covers Strata's deliberate slider-with-captions variant
    // (see docs/UI-SHELL.md "Deliberate variant") — same association need,
    // different markup.
    const labelSel = '.ctrl-label, .panel-label, .color-name, .group-label, .param-name, .toggle-name, label';
    const controlSel = 'input, select, textarea';
    let fixed = 0;

    // A button with its own visible text (Save, Delete, F–S, Atkinson…)
    // already has an accessible name FROM that text — aria-labelledby would
    // replace it, not add to it, so a segmented control's four buttons
    // would all announce as their shared row label instead of their own
    // text. Only a button with no text of its own (an icon-only colour
    // swatch) needs the row label.
    // A wrapping <label> with no text of its own (a toggle-switch styled
    // purely with a ::before/::after slider knob, no visible copy inside)
    // is not a name — .closest('label') existing isn't enough, it has to
    // have text. Missed this on the first pass: Strata's toggle switches
    // wrap the checkbox in an empty <label class="toggle">, so the naive
    // check called them "already named" while they announced nothing.
    const hasName = el =>
      !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
         (el.id && root.querySelector(`label[for="${el.id}"]`)) ||
         (el.closest('label') && el.closest('label').textContent.trim()) ||
         (el.tagName === 'BUTTON' && el.textContent.trim()));

    root.querySelectorAll(rowSel).forEach(row => {
      const label = row.querySelector(labelSel);
      if (!label) return;
      if (!label.id) label.id = 'organica-label-' + (++autoLabelSeq);
      // A colour row has up to three controls sharing one label (icon-only
      // swatch button, native <input type=color>, hex text field) — name
      // all of them. Every other row has exactly one control.
      row.querySelectorAll(controlSel + ', button').forEach(control => {
        if (control === label || hasName(control)) return;
        control.setAttribute('aria-labelledby', label.id);
        fixed++;
      });
    });

    return fixed;
  };

  // ── SLIDERS — filled track + click-to-edit value ──────────────────────
  // Two things every input[type=range] in the panel gets, wired once and
  // reaching content added later (Living Path rebuilds its effect rows on
  // every layer toggle):
  //   1. A live --fill custom property (0%–100%), read by the gradient in
  //      panel.css. User drags update it via the bubbling 'input'
  //      event; script-driven changes (a preset doing `slider.value = x`)
  //      update it via a wrapped .value accessor, since presets never
  //      dispatch a synthetic input event.
  //   2. Click the number beside a slider to type an exact value. This is
  //      a delegated click handler, not a per-element one, so it survives
  //      DOM rebuilt after this function ran (Living Path's layer rows) —
  //      those sliders still get their fill wired via a MutationObserver.
  const rangeValSel = '.ctrl-val, .panel-value, .row .val, .param-val, .panel-unit, .val';
  const rangeRowSel = '.ctrl-row, .panel-row, .row, .param-row, .panel-input-group';

  function organicaUpdateFill(range) {
    const min = range.min !== '' ? parseFloat(range.min) : 0;
    const max = range.max !== '' ? parseFloat(range.max) : 100;
    const v = parseFloat(range.value);
    const pct = max > min ? Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100)) : 0;
    range.style.setProperty('--fill', pct + '%');
  }

  function organicaWireRange(range) {
    if (range.__orgFillWired) return;
    range.__orgFillWired = true;
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(range, 'value', {
      configurable: true,
      get() { return desc.get.call(range); },
      set(v) { desc.set.call(range, v); organicaUpdateFill(range); },
    });
    organicaUpdateFill(range);
  }

  function organicaBeginValueEdit(val, range) {
    const original = val.textContent;
    const m = original.match(/-?\d+\.?\d*/);
    val.dataset.orgOriginal = original;
    val.contentEditable = ('plaintext-only' in document.body.style) ? 'plaintext-only' : 'true';
    val.classList.add('editing');
    val.textContent = m ? m[0] : original;

    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(val);
    sel.removeAllRanges();
    sel.addRange(r);
    val.focus();

    const finish = commit => {
      val.removeEventListener('blur', onBlur);
      val.removeEventListener('keydown', onKey);
      val.contentEditable = 'false';
      val.classList.remove('editing');
      if (!commit) { val.textContent = val.dataset.orgOriginal; return; }
      const n0 = parseFloat(val.textContent);
      if (isNaN(n0)) { val.textContent = val.dataset.orgOriginal; return; }
      const min = range.min !== '' ? parseFloat(range.min) : 0;
      const max = range.max !== '' ? parseFloat(range.max) : 100;
      const step = (range.step && range.step !== 'any') ? parseFloat(range.step) : null;
      let n = Math.min(max, Math.max(min, n0));
      if (step) n = Math.round((n - min) / step) * step + min;
      n = Math.round(n * 1e6) / 1e6;
      range.value = n;
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const onBlur = () => finish(true);
    const onKey = e => {
      if (e.key === 'Enter') { e.preventDefault(); val.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); val.blur(); }
    };
    val.addEventListener('blur', onBlur);
    val.addEventListener('keydown', onKey);
  }

  let sliderObserver = null;
  let sliderDelegatesWired = false;

  Organica.enhanceSliders = function (root) {
    root = root || document;
    root.querySelectorAll('input[type=range]').forEach(organicaWireRange);

    if (!sliderDelegatesWired) {
      sliderDelegatesWired = true;
      document.addEventListener('input', e => {
        if (e.target && e.target.matches && e.target.matches('input[type=range]')) {
          organicaWireRange(e.target);
          organicaUpdateFill(e.target);
        }
      });
      document.addEventListener('click', e => {
        const val = e.target.closest && e.target.closest(rangeValSel);
        if (!val || val.isContentEditable) return;
        const row = val.closest(rangeRowSel);
        const range = row && row.querySelector('input[type=range]');
        if (!range) return;
        organicaBeginValueEdit(val, range);
      });
    }

    if (!sliderObserver) {
      sliderObserver = new MutationObserver(muts => {
        muts.forEach(m => {
          m.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches && n.matches('input[type=range]')) organicaWireRange(n);
            if (n.querySelectorAll) n.querySelectorAll('input[type=range]').forEach(organicaWireRange);
          });
        });
      });
      sliderObserver.observe(document.body, { childList: true, subtree: true });
    }
  };

  global.Organica = Organica;
})(window);
