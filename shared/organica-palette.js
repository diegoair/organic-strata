/* ─────────────────────────────────────────────────────────────────────────────
 * organica-palette.js — the Organica Palette component (JS half).
 * Paired stylesheet: shared/organica-palette.css  (RMX chip CSS lives there,
 * not in organica-panel.css). The single-swatch `.color-*` CSS stays in
 * organica-panel.css — it is universal and unduplicated.
 *
 * Consolidates three previously-separate shared pieces (old names retired
 * 2026-08-30 after every call site migrated):
 *   - Organica.createColorSwatch  (was in organica-core.js)      → palette.swatch(<id>, …)
 *   - Organica.createPaletteChips (was organica-palette-chip.js) → palette.swatch(<el>, …)
 *   - Organica.Palette.colorAt    (score → colour math)          → palette.colorAt
 *
 * LOAD ORDER (load-bearing): organica-core.js → organica-palette.js → tool script.
 * Needs Organica.normalizeHex / hexToRGB255 / rgbToHex / randomHex from core.
 *
 * ── palette.swatch(target, opts) — one component, two shapes ──────────────────
 *   target is a STRING prefix  → ATTACH mode. Wires pre-existing markup:
 *     #cp-<prefix> (native <input type=color>), #hex-<prefix> (hex text field),
 *     #sw-<prefix> (visible swatch button), #btn-random-<prefix> (optional).
 *     For the labelled .color-row pattern most tools hand-write. opts:
 *     { initial, onChange(hex, rgb255) }.
 *   target is an HTMLElement    → GENERATE mode. Builds .rmx-color chips into it.
 *     opts.max > 1 ⇒ RMX strip with + / × ;  opts.max ≤ 1 ⇒ one bare chip.
 *     opts: { colors, min=1, max=8, activeIndex, onChange(colors, index, action) }
 *     where action ∈ 'edit' | 'add' | 'remove' | 'set'.
 *
 *   Both shapes return the SAME object:
 *     { get, set, getColors, setColors(arr, {notify}), setActive(i), rebuild }
 *   so every prior call style keeps working (swatch set/get and
 *   chips getColors/setColors/rebuild). Attach mode's chip-only methods are
 *   no-ops where they do not apply. Serialization stays the tool's job.
 *
 * Bugs fixed once, here (each was a real defect in one of the ~6 prior copies):
 *   - the visible chip colour is the wrapping <label>'s background (the
 *     <input type=color> underneath is opacity:0) — it must be repainted on
 *     every edit, not just at build time.
 *   - the single-swatch BUTTON sits over its own hidden native input; the
 *     click must be forwarded (cp.click()) or the swatch is a dead control
 *     (elementFromPoint at the swatch centre resolves to the button).
 *   - a <select> etc. writing a module-scoped `let` must go through an
 *     exported function, never a bare inline assignment, or it silently
 *     creates a disconnected global.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const palette = {};

  // ── colour-mapping math (score 0..1 → colour) ──────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgbToHex(rgb) { return Organica.rgbToHex(rgb[0], rgb[1], rgb[2]); }
  function mixHex(hexA, hexB, t) {
    const a = Organica.hexToRGB255(hexA), b = Organica.hexToRGB255(hexB);
    return rgbToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  }
  // Tone/Posterize/Random/Tone+Random → index (or adjacent pair + fraction) into colors.
  function rmxColor(score, rnd, colors, submode) {
    const n = colors.length;
    if (n <= 0) return '#000000';
    if (n === 1) return colors[0];
    const s = Math.max(0, Math.min(1, score));
    if (submode === 'random') return colors[Math.min(n - 1, Math.floor(rnd * n))];
    if (submode === 'posterize') return colors[Math.max(0, Math.min(n - 1, Math.round(s * (n - 1))))];
    if (submode === 'tonernd') {
      const raw = s * (n - 1) + (rnd - 0.5) * 1.2;
      return colors[Math.max(0, Math.min(n - 1, Math.round(raw)))];
    }
    // 'tone' — smooth lerp between the two adjacent stops.
    const pos = s * (n - 1), i0 = Math.max(0, Math.min(n - 1, Math.floor(pos))),
      i1 = Math.min(n - 1, i0 + 1), frac = pos - i0;
    return mixHex(colors[i0], colors[i1], frac);
  }

  // score: 0..1 scalar. opts.mode: 'solid' | 'adaptive' | 'rmx'.
  // rmx: opts.colors[] (dark→bright), opts.submode 'tone'|'posterize'|'random'|'tonernd',
  //      opts.rnd 0..1 caller-seeded and threaded through (do NOT pass a fresh
  //      Math.random() per render — seed once and reuse, or colours reshuffle).
  palette.colorAt = function (score, opts) {
    opts = opts || {};
    const mode = opts.mode || 'solid';
    if (mode === 'solid') return opts.ink || '#000000';
    if (mode === 'adaptive') return mixHex(opts.ink || '#000000', opts.paper || '#ffffff', Math.max(0, Math.min(1, score)));
    const colors = opts.colors && opts.colors.length ? opts.colors : [opts.ink || '#000000', opts.paper || '#ffffff'];
    return rmxColor(score, opts.rnd == null ? 0.5 : opts.rnd, colors, opts.submode || 'tone');
  };
  palette.mix = mixHex;

  // ── the swatch component ───────────────────────────────────────────────────
  palette.swatch = function (target, opts) {
    opts = opts || {};
    return (typeof target === 'string') ? attachMode(target, opts) : generateMode(target, opts);
  };

  // ATTACH — wire #cp-/#hex-/#sw-/#btn-random-<prefix>. Legacy onChange(hex, rgb255).
  function attachMode(prefix, opts) {
    const onChange = opts.onChange || function () {};
    const cp = document.getElementById('cp-' + prefix);
    const hexEl = document.getElementById('hex-' + prefix);
    const sw = document.getElementById('sw-' + prefix);
    const randomBtn = document.getElementById('btn-random-' + prefix);

    function set(hex) {
      hex = Organica.normalizeHex(hex, cp.value);
      cp.value = hex;
      hexEl.value = hex;
      if (sw) sw.style.background = hex;
      onChange(hex, Organica.hexToRGB255(hex));
    }

    cp.addEventListener('input', e => set(e.target.value));
    hexEl.addEventListener('input', e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) set(e.target.value); });
    if (randomBtn) randomBtn.addEventListener('click', () => set(Organica.randomHex()));
    if (sw) sw.addEventListener('click', () => cp.click());

    if (opts.initial) set(opts.initial);

    return {
      set,
      get: () => hexEl.value,
      getColors: () => [hexEl.value],
      setColors: (arr, o) => {
        if (arr && arr.length) set(arr[0]);
        if (o && o.notify) onChange(hexEl.value, Organica.hexToRGB255(hexEl.value));
      },
      setActive: function () {},
      rebuild: function () {},
    };
  }

  // GENERATE — build .rmx-color chips into `wrap`. onChange(colors, index, action).
  function generateMode(wrap, opts) {
    const min = opts.min || 1;
    const max = opts.max || 8;
    const onChange = opts.onChange || function () {};
    let colors = (opts.colors || ['#888888']).slice(0, max);
    while (colors.length < min) colors.push('#888888');
    let activeIndex = (opts.activeIndex == null) ? -1 : opts.activeIndex;

    function rebuild() {
      wrap.innerHTML = '';
      colors.forEach((col, i) => {
        const chip = document.createElement('label');
        chip.className = 'rmx-color' + (i === activeIndex ? ' chip-active' : '');
        chip.style.background = col;
        chip.setAttribute('aria-label', 'Palette colour ' + (i + 1));
        const input = document.createElement('input');
        input.type = 'color';
        input.value = col;
        input.setAttribute('aria-label', 'Palette colour ' + (i + 1));
        input.addEventListener('input', e => setColor(i, e.target.value));
        chip.appendChild(input);
        if (colors.length > min) {
          const x = document.createElement('button');
          x.className = 'rmx-x';
          x.textContent = '×';
          x.title = 'Remove';
          x.setAttribute('aria-label', 'Remove colour ' + (i + 1));
          x.addEventListener('click', e => { e.preventDefault(); removeColor(i); });
          chip.appendChild(x);
        }
        wrap.appendChild(chip);
      });
      if (colors.length < max) {
        const add = document.createElement('button');
        add.className = 'rmx-add';
        add.textContent = '+';
        add.title = 'Add colour';
        add.setAttribute('aria-label', 'Add palette colour');
        add.addEventListener('click', addColor);
        wrap.appendChild(add);
      }
    }

    function setColor(i, hex) {
      colors[i] = hex;
      // Repaint the chip's own background — the <input> underneath is opacity:0,
      // so without this every pick after the first looks like a no-op.
      const chip = wrap.children[i];
      if (chip) chip.style.background = hex;
      onChange(colors.slice(), i, 'edit');
    }
    function addColor() {
      if (colors.length >= max) return;
      colors.push('#888888');
      rebuild();
      onChange(colors.slice(), colors.length - 1, 'add');
    }
    function removeColor(i) {
      if (colors.length <= min) return;
      colors.splice(i, 1);
      if (activeIndex >= colors.length) activeIndex = colors.length - 1;
      rebuild();
      onChange(colors.slice(), Math.max(0, i - 1), 'remove');
    }
    function setColors(arr, o) {
      colors = arr.slice(0, max);
      while (colors.length < min) colors.push('#888888');
      rebuild();
      if (o && o.notify) onChange(colors.slice(), -1, 'set');
    }
    function setActive(i) {
      activeIndex = (i == null) ? -1 : i;
      Array.prototype.forEach.call(wrap.querySelectorAll('.rmx-color'), (el, idx) => {
        el.classList.toggle('chip-active', idx === activeIndex);
      });
    }

    rebuild();
    return {
      get: () => colors[0],
      set: hex => setColor(0, hex),
      getColors: () => colors.slice(),
      setColors,
      setActive,
      rebuild,
    };
  }

  Organica.palette = palette;
})(typeof window !== 'undefined' ? window : this);
