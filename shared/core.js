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

  // The atob → Uint8Array conversion found byte-near-identical in 11 files'
  // own canvas-export paths — always fed by canvas.toDataURL(), never
  // canvas.toBlob(): toBlob() is async and can race a canvas that gets
  // resized back to its live dimensions right after export (docs/UI-SHELL.md
  // §5), so every one of those sites needs the synchronous toDataURL() read.
  // Split into two layers: most callers want the Blob; Loom's PNG-DPI-chunk
  // export needs the raw bytes themselves (to splice in a pHYs chunk before
  // it's ever wrapped in a Blob), so that stays the lower-level primitive.
  Organica.dataURLToBytes = function (dataURL) {
    const bin = atob(dataURL.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  Organica.dataURLToBlob = function (dataURL) {
    const mime = (dataURL.match(/^data:([^;]+);base64,/) || [, 'application/octet-stream'])[1];
    return new Blob([Organica.dataURLToBytes(dataURL)], { type: mime });
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

    // opts.panStart(e) → bool — opt-in, for a canvas whose own clicks/drags
    // mean something (FVS paints cells, drags borders): a pan then starts only
    // when this says so (e.g. Space held / middle button), on the WRAP in
    // capture phase, and swallows the event so the canvas's own pointer/mouse
    // handlers never see it. Omitted → the original behaviour below, unchanged.
    const panStart = opts.panStart || null;
    if (panStart) {
      wrap.addEventListener('pointerdown', e => {
        if ((!panAlways && zoom <= 1.001) || !isReady() || !panStart(e)) return;
        panning = true; startX = e.clientX - panX; startY = e.clientY - panY;
        canvas.classList.add('panning');
        e.preventDefault(); e.stopPropagation();   // preventDefault also suppresses the follow-up mousedown
      }, true);
      // …and the compat mousemove/mouseup too, so this mode tracks the pointer itself.
      global.addEventListener('pointermove', e => {
        if (!panning) return;
        panX = e.clientX - startX; panY = e.clientY - startY; apply();
      });
      global.addEventListener('pointerup', () => {
        if (!panning) return;
        panning = false; canvas.classList.remove('panning');
      });
    } else canvas.addEventListener('mousedown', e => {
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

  // ── Notice — the one place a tool tells you something ────────────────
  // (Sep 29, 2026.) It replaced the header's status slot, which had grown
  // into five things at once: state ("Ready"), prompts that repeated the
  // canvas's own drop hint ("Drop a photo to begin"), live counts that
  // rewrote at slider-drag rate ("1064 elements", "t=0.42"), a bare "—", and
  // the only thing that genuinely needed to be there: errors and guards
  // ("Could not read that image", "WebGL2 unavailable", "Pause the
  // simulation before exporting SVG"). Those now show here — centred on the
  // canvas (the same centring the floatbar uses, so it clears the panel),
  // dismissable with a ×, Escape, or after 12s (paused while hovered).
  // One at a time; a new one replaces the old.
  //   Organica.notice(message, { kind: 'error' | 'busy' | 'info' })  → { close }
  //   error  --danger dot, role="alert"; closes itself after 12s
  //   busy   pulsing --tool dot, no timer; closed by the next non-busy call
  //          (Organica.status does this) or by hand
  //   info   plain; closes itself after 12s
  let noticeEl = null, noticeTimer = 0;
  Organica.notice = function (message, opts) {
    opts = opts || {};
    const kind = opts.kind === 'error' || opts.kind === 'busy' ? opts.kind : 'info';
    Organica.noticeClose();
    const el = document.createElement('div');
    el.className = 'org-notice';
    el.dataset.kind = kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const dot = document.createElement('span'); dot.className = 'org-notice__dot'; dot.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'org-notice__text'; text.textContent = message;
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'org-notice__close'; x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10" fill="none" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
    x.addEventListener('click', () => Organica.noticeClose());
    el.append(dot, text, x);
    document.body.appendChild(el);
    noticeEl = el;
    if (kind !== 'busy') {
      const arm = () => { clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { if (noticeEl === el) Organica.noticeClose(); }, 12000); };
      arm();
      el.addEventListener('pointerenter', () => clearTimeout(noticeTimer));
      el.addEventListener('pointerleave', arm);
    }
    return { close: () => { if (noticeEl === el) Organica.noticeClose(); } };
  };
  Organica.noticeClose = function () {
    clearTimeout(noticeTimer);
    if (noticeEl) { noticeEl.remove(); noticeEl = null; }
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && noticeEl) Organica.noticeClose(); });

  // Status — the tools' one feedback call, kept so ~280 call sites didn't
  // have to change, but no longer painted in the header. setStatus(state, msg):
  //   'error'  → a notice (dismissable, centred on the canvas)
  //   'busy'   → a busy notice ("Recording 6s…") that stays until the next call
  //   'active' / '' → silent. Confirmations ("saved"), prompts, counts and
  //   idle text were redundant with the canvas, the panel and the download
  //   itself; a busy notice still open is closed, since the work is done.
  Organica.status = function () {
    return function setStatus(state, msg) {
      if (state === 'error') { Organica.notice(msg, { kind: 'error' }); return; }
      if (state === 'busy')  { Organica.notice(msg, { kind: 'busy' }); return; }
      if (noticeEl && noticeEl.dataset.kind === 'busy') Organica.noticeClose();
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

  // ── SLIDERS — the Slosh slider + click/drag-to-edit value ─────────────
  // Three things every input[type=range] in the panel gets, wired once and
  // reaching content added later (Living Path rebuilds its effect rows on
  // every layer toggle; Rhizome builds its inspector from JS):
  //   1. The slider itself (Organica.slosh, below): a spring-driven liquid
  //      fill that panel.css draws from --sf. Until the spring exists the
  //      CSS falls back to --fv, the rigid value 0..1 written here. User
  //      drags update it via the bubbling 'input' event; script-driven
  //      changes (a preset doing `slider.value = x`) go through a wrapped
  //      .value accessor, since presets never dispatch a synthetic input.
  //   2. Click the number beside a slider to type an exact value — and
  //      drag it to scrub (see Organica.slosh). This is a delegated click
  //      handler, not a per-element one, so it survives DOM rebuilt after
  //      this function ran — those sliders still get wired via a
  //      MutationObserver.
  const rangeValSel = '.ctrl-val, .panel-value, .row .val, .param-val, .panel-unit, .val, .fb-val';
  const rangeRowSel = '.ctrl-row, .panel-row, .row, .param-row, .panel-input-group, .fb-field';

  function organicaUpdateFill(range) {
    const min = range.min !== '' ? parseFloat(range.min) : 0;
    const max = range.max !== '' ? parseFloat(range.max) : 100;
    const v = parseFloat(range.value);
    const pct = max > min ? Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100)) : 0;
    range.style.setProperty('--fv', (pct / 100).toFixed(4));   // rigid value: the liquid's fallback before the spring exists
    if (range.__slosh) range.__slosh.retarget();                 // typed / scripted value → the liquid follows
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
    if (range.dataset.slosh !== 'off') Organica.slosh(range);
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

  // ── Slosh slider — THE slider (every input[type=range]) ─────────
  // After Bencho's Slosh (MIT). The handle (the native thumb) is rigid —
  // under your finger, and anything that lags a finger is broken. The
  // LIQUID (the ink fill, drawn by panel.css) is a second, softer,
  // barely-damped spring behind it: a fast drag throws it past the handle
  // into the end stop and rocks it back a few times. The lean of the
  // leading edge is what sells it as liquid — a bar that lags is a laggy
  // bar; one whose edge leans the way it is travelling is a surface with
  // a meniscus. Release mid-drag and (if momentum > 0) the value coasts.
  //
  // It only styles/observes the NATIVE input — no wrapper, no extra
  // nodes — so value, step, keys, a11y and every tool's own listeners and
  // `input.nextElementSibling` reads keep working. It writes two custom
  // properties on the input: --sf (liquid position, 0..1) and, only while
  // the edge is leaning, --sedge (an angled hard-stop gradient). The loop
  // PARKS itself when everything is at rest.
  // Opt out per range with data-slosh="off". Tunables (0–100):
  // data-viscosity / data-momentum / data-tilt.
  Organica.slosh = function (range, opts) {
    if (range.__slosh) return range.__slosh;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const ds = range.dataset;
    const o = Object.assign({
      /* 0 is a rigid fill, 100 loose liquid. Bencho's 15 is a little give; we default to 85 — a loose, wavy slosh */
      viscosity: ds.viscosity !== undefined ? +ds.viscosity : 85,
      /* how far the VALUE coasts after release, 0..100. Default 0: a coast
         re-fires 'input' every frame, and in a tool that regenerates an
         image per input that is a real cost — and a parameter that keeps
         drifting after you let go is a surprise. Opt in per slider. */
      momentum: ds.momentum !== undefined ? +ds.momentum : 0,
      /* lean on the leading edge, 0..100 */
      tilt: ds.tilt !== undefined ? +ds.tilt : 100,
    }, opts || {});
    const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    const min = () => (range.min !== '' ? parseFloat(range.min) : 0);
    const max = () => (range.max !== '' ? parseFloat(range.max) : 100);
    const toPct = v => (max() > min() ? clamp(((v - min()) / (max() - min())) * 100, 0, 100) : 0);
    const fromPct = p => min() + (p / 100) * (max() - min());
    /* the handle's diameter = --knob-r (0.78) of the track height — the shared knob, read from the token so JS and CSS agree */
    const knobW = () => range.clientHeight * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--knob-r')) || 0.78);

    /* the handle (rigid value), its velocity after release, and the
       liquid chasing it with a velocity of its own */
    let val = toPct(parseFloat(range.value)), hv = 0, fill = val, fv = 0;
    let held = false, raf = 0, prev = 0, writing = false, leaning = false;
    let last = { v: val, t: 0 };

    const paint = () => {
      range.style.setProperty('--sf', (fill / 100).toFixed(4));
      /* the meniscus: proportional to how fast the liquid is actually
         moving, so it is upright at rest and cannot be decoration */
      const lean = reduced() ? 0 : clamp((o.tilt / 100) * fv * 3, -32, 32);
      if (Math.abs(lean) < 0.05) {
        if (leaning) { range.style.removeProperty('--sedge'); leaning = false; }
        return;
      }
      /* an angled hard-stop gradient: its iso-lines ARE the slanted edge.
         Angle 90° is a vertical edge; tilt it by atan(2·lean/height), and
         place the stop at the edge centre's distance along the gradient
         line (whose length is W·cosφ + H·|sinφ|). */
      const W = range.clientWidth, H = range.clientHeight;
      if (!W || !H) return;
      const k = knobW();
      const x = (fill / 100) * (W - k) + k / 2;
      const phi = Math.atan2(2 * lean, H);
      const len = W * Math.cos(phi) + H * Math.abs(Math.sin(phi));
      const pos = len / 2 + (x - W / 2) * Math.cos(phi);
      range.style.setProperty('--sedge',
        'linear-gradient(' + (90 + phi * 180 / Math.PI).toFixed(2) + 'deg, var(--ink) ' + pos.toFixed(2) + 'px, var(--track-bg) ' + pos.toFixed(2) + 'px)');
      leaning = true;
    };
    const rest = () => !held && Math.abs(hv) < 0.01 && Math.abs(fv) < 0.01 && Math.abs(val - fill) < 0.02;

    const write = () => {
      writing = true;
      range.value = fromPct(val);       // the native input snaps to its step
      writing = false;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const tick = t => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      /* the coast. Friction is per frame, so it is raised to dt rather
         than multiplied by it — a dropped frame must not double the
         deceleration. */
      if (!held && hv) {
        val += hv * dt;
        hv *= Math.pow(0.86 + (o.momentum / 100) * 0.115, dt);
        if (val <= 0 || val >= 100) { val = clamp(val, 0, 100); hv = 0; }
        if (Math.abs(hv) < 0.01) { hv = 0; range.dispatchEvent(new Event('change', { bubbles: true })); }
        write();
      }
      const soft = reduced() ? 0 : o.viscosity / 100;
      if (soft === 0) {
        /* 0 is an ordinary slider and has to be exactly that, not a very
           stiff spring that still rings */
        fill = val; fv = 0;
      } else {
        /* stiffness falls and damping rises together: thin liquid is slow
           to answer and slow to forget — one thing said twice, so one knob */
        const stiff = 0.34 - soft * 0.29, damp = 0.74 + soft * 0.22;
        fv += (val - fill) * stiff * dt;
        fv *= Math.pow(damp, dt);
        fill += fv * dt;
        /* the end stop is a wall, and a wall gives some back */
        if (fill > 100) { fill = 100; fv = -fv * 0.42; }
        else if (fill < 0) { fill = 0; fv = -fv * 0.42; }
        if (Math.abs(val - fill) < 0.02 && Math.abs(fv) < 0.02) { fill = val; fv = 0; }
      }
      paint();
      if (rest()) { raf = 0; prev = 0; return; }
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf) raf = requestAnimationFrame(tick); };

    range.addEventListener('pointerdown', e => {
      held = true; hv = 0;
      val = toPct(parseFloat(range.value));
      last = { v: val, t: e.timeStamp };
      run();
    });
    range.addEventListener('input', e => {
      if (writing) return;
      const v = toPct(parseFloat(range.value));
      if (held) {
        const dt = Math.max(1, e.timeStamp - last.t);
        /* per frame, not per ms — the loop is in frames and a release
           velocity in the other unit is a hundred times too big */
        hv = ((v - last.v) / dt) * 16.67;
        last = { v, t: e.timeStamp };
      }
      val = v; run();
    });
    const drop = () => {
      if (!held) return;
      held = false;
      /* leaves along the velocity it actually had, capped so a flick
         across the whole track does not simply pin it */
      hv = (reduced() || !o.momentum) ? 0 : clamp(hv, -6, 6);
      run();
    };
    range.addEventListener('pointerup', drop);
    range.addEventListener('pointercancel', drop);
    range.addEventListener('lostpointercapture', drop);
    range.addEventListener('keydown', () => { hv = 0; });

    // ── drag-to-scrub on the number beside the slider ──────────────
    // Press on the value and drag left/right to change it (the ew-resize
    // cursor promises exactly this). Under 3px of travel it is still a
    // click, so click-to-type keeps working; past that it is a scrub and
    // the click that follows the release is swallowed so it doesn't also
    // open the editor. 200px of travel = the full range; Shift = 10x finer.
    const valSel = '.ctrl-val, .panel-value, .panel-unit, .param-val, .val, .fb-val';
    const valEl = (() => {
      const n = range.nextElementSibling;
      if (n && n.matches && n.matches(valSel)) return n;
      const row = range.parentElement;
      if (row && row.querySelectorAll('input[type=range]').length === 1) return row.querySelector(valSel);
      return null;
    })();
    if (valEl) {
      let sx = 0, sv = 0, scrubbing = false, down = false, swallow = false;
      const step = () => (range.step && range.step !== 'any' ? parseFloat(range.step) : null);
      valEl.addEventListener('pointerdown', e => {
        if (e.button !== 0 || valEl.isContentEditable) return;
        down = true; scrubbing = false; sx = e.clientX; sv = parseFloat(range.value);
        valEl.setPointerCapture && valEl.setPointerCapture(e.pointerId);
      });
      valEl.addEventListener('pointermove', e => {
        if (!down) return;
        if (!scrubbing && Math.abs(e.clientX - sx) < 3) return;
        if (!scrubbing) { scrubbing = true; valEl.style.userSelect = 'none'; }
        const per = (max() - min()) / 200 * (e.shiftKey ? 0.1 : 1);
        let v = clamp(sv + (e.clientX - sx) * per, min(), max());
        const st = step();
        if (st) v = Math.round((v - min()) / st) * st + min();
        v = Math.round(v * 1e6) / 1e6;
        if (String(v) === range.value) return;
        range.value = v;
        range.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const end = () => {
        if (!down) return;
        down = false;
        if (scrubbing) {
          swallow = true;                       // the click after a scrub is not an edit
          valEl.style.userSelect = '';
          range.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      valEl.addEventListener('pointerup', end);
      valEl.addEventListener('pointercancel', end);
      valEl.addEventListener('click', e => {
        if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); }
      });
    }

    const api = {
      /* a typed / scripted value: snap the handle, let the liquid follow */
      retarget() {
        if (writing) return;
        hv = 0;
        val = toPct(parseFloat(range.value));
        run();
      },
    };
    range.__slosh = api;
    /* first paint: the liquid starts AT the value, so nothing animates in */
    range.style.setProperty('--sf', (fill / 100).toFixed(4));
    return api;
  };

  // ── Liquid switch (every .check-row.org-switch checkbox) ───────
  // After Bencho's Liquid toggle (MIT), ported off framer-motion. The real
  // checkbox stays; this only drives three custom properties on it that
  // panel.css turns into the droplet's transform: --lx (position 0..1),
  // --lsx / --lsy (the stretch). Three springs, integrated here:
  //   · the droplet's position, released onto its target;
  //   · a second, softer spring FOLLOWING the droplet's velocity, so the
  //     stretch eases in and out instead of flickering with every frame;
  //   · a hover swell (LIQUID_HOVER) about the droplet's own centre.
  // The stretch is 1 + min(.4, |v|/600)·stretch, area-kept (scaleY = 1/scaleX).
  // The divisor is the whole tuning: the thumb's peak speed on Bencho's
  // 46px crossing is ~150px/s, so /1400 peaked at 1.039 — present and
  // invisible; /600 gives ~1.09. Velocity here is in fractions/s, scaled by
  // 46 back to that crossing so the same numbers mean the same thing.
  // Drag the droplet: it follows the finger from where it IS (the offset
  // is taken at the first MOVE, so no press can make it teleport), and it
  // flips as it passes the middle so the track answers under your finger.
  // A press that never travelled is a click and the native input handles
  // it. Tunables: data-speed (0–100, default 66) and data-stretch (0–100,
  // default 60) — the values of the saved Bencho configuration.
  /* How far the thing under the pointer swells. Bencho's was 1.035, which on a
     14–20px control is under a pixel — present and invisible — so it is 1.1
     here, and the hover also darkens the surface (panel.css) and previews the
     tick; the whole label row counts as hovering because the label is the
     click target. */
  const LIQUID_HOVER = 1.1;
  Organica.liquidSwitch = function (input) {
    if (input.__liquid) return input.__liquid;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const speed = input.dataset.speed !== undefined ? +input.dataset.speed : 66;
    const stretch = input.dataset.stretch !== undefined ? +input.dataset.stretch : 60;
    const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    /* softer than Bencho's first pass on purpose: 170/21.5 is zeta .87, it
       arrives with a hint of give and no snap */
    const K = 170 - (50 - speed) * 1.1, C = 21.5, M = 0.9;
    const CROSSING = 46;

    let f = input.checked ? 1 : 0, v = 0, target = f;
    let ev = 0, ew = 0;              // eased velocity (its own spring)
    let sw = 1, swv = 0, hot = false;
    let raf = 0, prev = 0, held = false, dragged = false, grab = null, pid = null;

    const paint = () => {
      const len = 1 + Math.min(0.4, Math.abs(ev * CROSSING) / 600) * (clamp(stretch, 0, 100) / 100);
      input.style.setProperty('--lx', f.toFixed(4));
      input.style.setProperty('--lsx', (len * sw).toFixed(4));
      input.style.setProperty('--lsy', (sw / len).toFixed(4));
    };
    const rest = () => !held && Math.abs(target - f) < 0.0005 && Math.abs(v) < 0.001 &&
      Math.abs(ev) < 0.001 && Math.abs(ew) < 0.001 && Math.abs(sw - (hot ? LIQUID_HOVER : 1)) < 0.0005 && Math.abs(swv) < 0.001;

    const tick = t => {
      const dt = prev ? clamp((t - prev) / 1000, 0, 0.032) : 0.016;
      prev = t;
      const f0 = f;
      if (!held) {                                     // a finger owns it while held
        const a = (K * (target - f) - C * v) / M;
        v += a * dt; f += v * dt;
      }
      const vel = (f - f0) / dt;                       // fractions / s, either driver
      const ea = (320 * (vel - ev) - 40 * ew) / 0.6;   // the velocity-following spring
      ew += ea * dt; ev += ew * dt;
      const sa = (520 * ((hot ? LIQUID_HOVER : 1) - sw) - 34 * swv) / 0.6;
      swv += sa * dt; sw += swv * dt;
      paint();
      if (rest()) {
        f = target; v = ev = ew = 0; sw = hot ? LIQUID_HOVER : 1; swv = 0;
        if (hot) {                       // resting under the pointer: the swell stays
          input.style.setProperty('--lsx', sw.toFixed(4)); input.style.setProperty('--lsy', sw.toFixed(4));
        } else { input.style.removeProperty('--lsx'); input.style.removeProperty('--lsy'); }
        input.style.setProperty('--lx', f.toFixed(4));
        raf = 0; prev = 0; return;
      }
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const retarget = () => {
      target = input.checked ? 1 : 0;
      if (reduced()) { f = target; v = 0; paint(); input.style.removeProperty('--lsx'); input.style.removeProperty('--lsy'); return; }
      run();
    };

    input.addEventListener('change', () => { if (!held) retarget(); });
    const host = input.closest('.check-row, .org-check') || input;   // the label is the click target: hovering it counts
    host.addEventListener('pointerenter', () => { if (input.disabled) return; hot = true; if (!reduced()) run(); });
    host.addEventListener('pointerleave', () => { hot = false; if (!reduced()) run(); });

    // ── drag ──
    const geom = () => {
      const r = input.getBoundingClientRect();
      const thumb = r.height * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--knob-r')) || 0.78), pad = (r.height - thumb) / 2;
      return { r, travel: r.width - thumb - pad * 2, pad, thumb };
    };
    input.addEventListener('pointerdown', e => {
      if (input.disabled || e.button !== 0 || reduced()) return;
      held = true; dragged = false; grab = null; pid = e.pointerId;
      try { input.setPointerCapture(e.pointerId); } catch (x) { /* not a live pointer */ }
      run();
    });
    input.addEventListener('pointermove', e => {
      if (!held || e.pointerId !== pid) return;
      const g = geom();
      const at = (e.clientX - g.r.left) / g.travel;     // pointer, in the droplet's own 0..1
      if (grab === null) grab = at - f;                 // taken at the first move: never a jump
      const next = clamp(at - grab, 0, 1);
      if (Math.abs(next - f) * g.travel > 0.4) dragged = true;
      f = next; v = 0;
      const past = next > 0.5;
      if (past !== input.checked) {
        input.checked = past;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const release = e => {
      if (!held || (e && e.pointerId !== pid)) return;
      held = false;
      try { input.releasePointerCapture(pid); } catch (x) { /* never captured */ }
      target = input.checked ? 1 : 0;
      run();
    };
    input.addEventListener('pointerup', release);
    input.addEventListener('pointercancel', release);
    /* the click after a drag must not flip it back: cancelling a checkbox's
       click restores the state it had before the click — the one we set */
    input.addEventListener('click', e => { if (dragged) { dragged = false; e.preventDefault(); } });

    /* a preset doing `checkbox.checked = x` never fires an event: wrap the
       property the way enhanceSliders wraps a range's .value */
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    Object.defineProperty(input, 'checked', {
      configurable: true,
      get() { return desc.get.call(input); },
      set(val) { desc.set.call(input, val); if (!held) retarget(); },
    });

    const api = { retarget };
    input.__liquid = api;
    paint();
    input.style.removeProperty('--lsx'); input.style.removeProperty('--lsy');
    return api;
  };

  // ── Liquid checkbox (every non-switch checkbox) ────────────────
  // The switch's springs applied to the checkbox's tick (Diego: "apply the
  // same animation to the checkbox, same style definition"). The tick is the
  // only thing that moves, so it is the droplet: position p goes 0 → 1 on the
  // SAME spring (170·speed, 21.5, 0.9), a second softer spring follows its
  // velocity for the stretch, a third is the hover swell. Written as three
  // custom properties on the real checkbox — --cx (how far sprung in, with
  // overshoot), --csx / --csy (squash and stretch, area kept, along the
  // tick's own long axis) — which panel.css turns into the tick's scale.
  // No drag: a checkbox has no travel. data-speed / data-stretch as the switch.
  Organica.liquidCheck = function (input) {
    if (input.__liquid) return input.__liquid;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const speed = input.dataset.speed !== undefined ? +input.dataset.speed : 66;
    const stretch = input.dataset.stretch !== undefined ? +input.dataset.stretch : 60;
    const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const K = 170 - (50 - speed) * 1.1, C = 21.5, M = 0.9, CROSSING = 46;

    let p = input.checked ? 1 : 0, v = 0, target = p, ev = 0, ew = 0, sw = 1, swv = 0, hot = false, raf = 0, prev = 0;
    const PREVIEW = 0.4;             // hovering an unchecked box springs the tick 40% of the way in
    const paint = () => {
      const len = 1 + Math.min(0.4, Math.abs(ev * CROSSING) / 600) * (clamp(stretch, 0, 100) / 100);
      input.style.setProperty('--hw', sw.toFixed(4));            // the box's own swell
      input.style.setProperty('--cx', Math.max(0, p).toFixed(4));
      input.style.setProperty('--csx', (sw / len).toFixed(4));
      input.style.setProperty('--csy', (sw * len).toFixed(4));
    };
    const rest = () => Math.abs(target - p) < 0.0005 && Math.abs(v) < 0.001 && Math.abs(ev) < 0.001 &&
      Math.abs(ew) < 0.001 && Math.abs(sw - (hot ? LIQUID_HOVER : 1)) < 0.0005 && Math.abs(swv) < 0.001;
    const tick = t => {
      const dt = prev ? clamp((t - prev) / 1000, 0, 0.032) : 0.016;
      prev = t;
      const p0 = p;
      const a = (K * (target - p) - C * v) / M;
      v += a * dt; p += v * dt;
      const vel = (p - p0) / dt;
      ew += ((320 * (vel - ev) - 40 * ew) / 0.6) * dt; ev += ew * dt;
      swv += ((520 * ((hot ? LIQUID_HOVER : 1) - sw) - 34 * swv) / 0.6) * dt; sw += swv * dt;
      paint();
      if (rest()) {
        p = target; v = ev = ew = 0; sw = hot ? LIQUID_HOVER : 1; swv = 0;
        input.style.removeProperty('--csx'); input.style.removeProperty('--csy');
        input.style.setProperty('--cx', p.toFixed(4));
        raf = 0; prev = 0; return;
      }
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const retarget = () => {
      target = input.checked ? 1 : (hot && !input.disabled ? PREVIEW : 0);
      if (reduced()) { p = input.checked ? 1 : 0; v = 0; paint(); input.style.removeProperty('--csx'); input.style.removeProperty('--csy'); return; }
      run();
    };
    input.addEventListener('change', retarget);
    const host = input.closest('.check-row, .org-check') || input;   // the label is the click target: hovering it counts
    host.addEventListener('pointerenter', () => { if (input.disabled) return; hot = true; retarget(); });
    host.addEventListener('pointerleave', () => { hot = false; retarget(); });
    /* a preset doing `checkbox.checked = x` never fires an event: wrap the property */
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    Object.defineProperty(input, 'checked', {
      configurable: true,
      get() { return desc.get.call(input); },
      set(val) { desc.set.call(input, val); retarget(); },
    });
    const api = { retarget };
    input.__liquid = api;
    input.style.setProperty('--cx', p.toFixed(4));
    return api;
  };
  const CHECK_SEL = '.check-row:not(.org-switch) input[type=checkbox], .org-check input[type=checkbox], .ctrl-row > input[type=checkbox]';

  let sliderObserver = null;
  let sliderDelegatesWired = false;

  Organica.enhanceSliders = function (root) {
    root = root || document;
    root.querySelectorAll('input[type=range]').forEach(organicaWireRange);
    root.querySelectorAll('.check-row.org-switch input[type=checkbox]').forEach(Organica.liquidSwitch);
    root.querySelectorAll(CHECK_SEL).forEach(el => Organica.liquidCheck(el));

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
            if (n.matches && n.matches('.check-row.org-switch input[type=checkbox]')) Organica.liquidSwitch(n);
            if (n.querySelectorAll) n.querySelectorAll('.check-row.org-switch input[type=checkbox]').forEach(Organica.liquidSwitch);
            if (n.matches && n.matches(CHECK_SEL)) Organica.liquidCheck(n);
            if (n.querySelectorAll) n.querySelectorAll(CHECK_SEL).forEach(el => Organica.liquidCheck(el));
          });
        });
      });
      sliderObserver.observe(document.body, { childList: true, subtree: true });
    }
  };

  // ── Floatbar indicator pill ──────────────────────────────────
  // Drives shared/floatbar.css's .org-floatbar__ind: one wash that travels
  // between the bar's buttons. Target = the hovered / focused button, else
  // the first pressed / open toggle, else hidden. Two phases (Bencho's
  // IconBar): the pill first stretches across the union of the old and new
  // slot, then settles onto the new one and overshoots on landing.
  // Delegated + self-mounting so every bar in every tool works with zero
  // per-tool wiring. Touch has no hover, so it only ever rests on toggles.
  Organica.floatbarPill = (function () {
    const bars = new WeakMap();
    const BTN = '.org-floatbar__btn';

    function restTarget(bar) {
      return bar.querySelector(BTN + '[aria-pressed="true"], ' + BTN + '[aria-expanded="true"]');
    }
    function measure(bar, btn) {
      const b = bar.getBoundingClientRect(), r = btn.getBoundingClientRect();
      return { x: r.left - b.left - bar.clientLeft, y: r.top - b.top - bar.clientTop, w: r.width, h: r.height };
    }
    function paint(st, m, phase) {
      const i = st.ind;
      i.dataset.phase = phase;
      i.style.top = m.y + 'px';
      i.style.height = m.h + 'px';
      i.style.width = m.w + 'px';
      i.style.transform = 'translate3d(' + m.x + 'px,0,0)';
      st.cur = m;
    }
    function go(bar, target) {
      const st = bars.get(bar);
      if (!st) return;
      clearTimeout(st.timer);
      if (!target || !target.getClientRects().length) {
        st.target = null;
        st.ind.dataset.on = 'false';
        return;
      }
      const to = measure(bar, target);
      const from = st.cur;
      const first = st.ind.dataset.on !== 'true' || !from;
      st.target = target;
      if (first) {
        // appearing: place without travelling, then fade in
        paint(st, to, 'idle');
        void st.ind.offsetWidth;
        st.ind.dataset.on = 'true';
        return;
      }
      if (from.x === to.x && from.w === to.w) { paint(st, to, 'idle'); return; }
      const start = Math.min(from.x, to.x), end = Math.max(from.x + from.w, to.x + to.w);
      paint(st, { x: start, w: end - start, y: to.y, h: to.h }, 'stretch');
      st.timer = setTimeout(() => {
        if (st.target === target) paint(st, measure(bar, target), 'settle');
      }, 150);
    }
    function mount(bar) {
      if (bars.has(bar)) return;
      const ind = document.createElement('span');
      ind.className = 'org-floatbar__ind';
      ind.setAttribute('aria-hidden', 'true');
      ind.dataset.on = 'false';
      ind.dataset.phase = 'idle';
      bar.insertBefore(ind, bar.firstChild);
      bars.set(bar, { ind, cur: null, target: null, timer: 0, hover: null });
      go(bar, restTarget(bar));
      // toggles flipping, buttons hidden/enabled → re-rest the pill
      new MutationObserver(recs => {
        const st = bars.get(bar);
        if (recs.every(r => r.target === st.ind)) return;   // our own paint
        go(bar, st.hover || restTarget(bar));
      }).observe(bar, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-expanded', 'hidden', 'disabled', 'style', 'class'] });
      if (window.ResizeObserver) new ResizeObserver(() => {
        const st = bars.get(bar);
        const t = st.hover || restTarget(bar);
        if (t) { clearTimeout(st.timer); paint(st, measure(bar, t), 'idle'); }
      }).observe(bar);
    }
    function point(e) {
      const btn = e.target.closest && e.target.closest(BTN);
      const bar = btn && btn.closest('.org-floatbar');
      if (!bar) return;
      mount(bar);
      const st = bars.get(bar);
      if (btn.disabled) return;
      st.hover = btn;
      go(bar, btn);
    }
    function leave(e) {
      const btn = e.target.closest && e.target.closest(BTN);
      const bar = btn && btn.closest('.org-floatbar');
      const st = bar && bars.get(bar);
      if (!st) return;
      const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(BTN);
      if (to && bar.contains(to)) return;       // moving to another button: pointerover handles it
      st.hover = null;
      go(bar, restTarget(bar));
    }
    document.addEventListener('pointerover', e => { if (e.pointerType !== 'touch') point(e); });
    document.addEventListener('pointerout', e => { if (e.pointerType !== 'touch') leave(e); });
    document.addEventListener('focusin', point);
    document.addEventListener('focusout', leave);
    const boot = () => document.querySelectorAll('.org-floatbar').forEach(mount);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    return { mount };
  })();

  global.Organica = Organica;
})(window);
