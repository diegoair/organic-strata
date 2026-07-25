/* ─────────────────────────────────────────────────────────────
   ORGANICA — organica-core.js
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
   a plain <script src="/shared/organica-core.js"> before the tool's own
   script, matching how /genesis/organic-forms.js is already loaded.

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
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    }, { passive: false });

    canvas.addEventListener('mousedown', e => {
      if (zoom <= 1.001) return;
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

  global.Organica = Organica;
})(window);
