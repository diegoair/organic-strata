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

  // ═══════════════════════════════════════════════════════════
  // HEADER
  //
  // The bar is markup (see shared/organica-header.css); this owns the two
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
  //      organica-panel.css. User drags update it via the bubbling 'input'
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
