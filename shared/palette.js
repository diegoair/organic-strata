/* ─────────────────────────────────────────────────────────────────────────────
 * palette.js — the Organica Palette component (JS half).
 * Paired stylesheet: shared/palette.css  (RMX chip CSS lives there,
 * not in panel.css). The single-swatch `.color-*` CSS stays in
 * panel.css — it is universal and unduplicated.
 *
 * Consolidates three previously-separate shared pieces (old names retired
 * 2026-08-30 after every call site migrated):
 *   - Organica.createColorSwatch  (was in core.js)      → palette.swatch(<id>, …)
 *   - Organica.createPaletteChips (was organica-palette-chip.js) → palette.swatch(<el>, …)
 *   - Organica.Palette.colorAt    (score → colour math)          → palette.colorAt
 *
 * LOAD ORDER (load-bearing): core.js → palette.js → tool script.
 * Needs Organica.normalizeHex / hexToRGB255 / rgbToHex / randomHex from core.
 *
 * ── palette.swatch(target, opts) — one component, two shapes ──────────────────
 *   target is a STRING prefix  → ATTACH mode. Wires pre-existing markup:
 *     #cp-<prefix> (native <input type=color>), #hex-<prefix> (hex text field),
 *     #sw-<prefix> (visible swatch button), #btn-random-<prefix> (optional).
 *     For the labelled .color-row pattern most tools hand-write. opts:
 *     { initial, onChange(hex, rgb255) }.
 *   target is an HTMLElement    → GENERATE mode. Builds .rmx-color chips into it.
 *     opts.max > 1 ⇒ RMX strip with plus / close icons (needs shared/icons.js loaded first);  opts.max ≤ 1 ⇒ one bare chip.
 *     opts: { colors, min=1, max=8, activeIndex, onChange(colors, index, action, removedAt) }
 *     where action ∈ 'edit' | 'add' | 'remove' | 'set'. On 'remove', index is the chip to
 *     select next and removedAt is the chip that went (a caller keeping per-colour data
 *     in a parallel list needs the second; the first cannot tell 0 from 1).
 *
 *   Attach mode also takes opts.pattern = { panel, on, onToggle(on), label, title } —
 *   opt-in: a Pattern icon at the end of the row that shows the tool's own pattern
 *   controls (`panel`, placed right under the row) and reports on/off. Returned
 *   object: setPattern(on). Only Flexible Visual System's Paper uses it so far.
 *
 *   Either shape also gets a small "Pick from a palette" button (palette.pick →
 *   palette.library(): the palettes saved in TuneSutra + the built-in sets —
 *   three colour combinations and the Riso standard inks).
 *   opts.library: false leaves it out. Its menu CSS is in panel.css.
 *   Generate mode also takes opts.palettes: () => [{ name, colors:[{name,hex}] }]
 *   — the tool's own unsaved palettes, listed first (TuneSutra's gradient stops).
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
  // space 'oklab' → perceptual mix (shared/color.js; no muddy midpoint). Opt-in:
  // the default stays the gamma-sRGB lerp every existing export was made with,
  // and a tool that has not loaded color.js falls back to it.
  function mixHex(hexA, hexB, t, space) {
    if (space === 'oklab' && Organica.color) return Organica.color.mix(hexA, hexB, t);
    const a = Organica.hexToRGB255(hexA), b = Organica.hexToRGB255(hexB);
    return rgbToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  }
  // Tone/Posterize/Random/Tone+Random → a discrete index into colors[], or
  // null for 'tone' (a continuous blend with no single index). The one
  // source of truth for "which discrete swatch does this score+rnd land
  // on" — shared by rmxColor's own discrete branches below and by any
  // external classification (e.g. Pollen/Spore's plate-export feature
  // deciding which ink a point belongs to, without re-deriving this math).
  function rmxIndex(score, rnd, colors, submode) {
    const n = colors.length;
    if (n <= 1) return 0;
    const s = Math.max(0, Math.min(1, score));
    if (submode === 'random') return Math.min(n - 1, Math.floor(rnd * n));
    if (submode === 'posterize') return Math.max(0, Math.min(n - 1, Math.round(s * (n - 1))));
    if (submode === 'tonernd') {
      const raw = s * (n - 1) + (rnd - 0.5) * 1.2;
      return Math.max(0, Math.min(n - 1, Math.round(raw)));
    }
    return null;   // 'tone' — no single discrete index
  }
  function rmxColor(score, rnd, colors, submode, space) {
    const n = colors.length;
    if (n <= 0) return '#000000';
    const idx = rmxIndex(score, rnd, colors, submode);
    if (idx != null) return colors[idx];
    // 'tone' — smooth lerp between the two adjacent stops.
    const s = Math.max(0, Math.min(1, score));
    const pos = s * (n - 1), i0 = Math.max(0, Math.min(n - 1, Math.floor(pos))),
      i1 = Math.min(n - 1, i0 + 1), frac = pos - i0;
    return mixHex(colors[i0], colors[i1], frac, space);
  }

  palette.rmxIndex = rmxIndex;
  // Gate for "can this RMX config be split into N discrete plate outputs"
  // (Pollen/Spore's plate-export feature). Colornet's own channels are
  // always splittable (masks, never blended) and don't need this check.
  palette.isSplittable = function (mode, submode) { return mode === 'rmx' && submode !== 'tone'; };

  // score: 0..1 scalar. opts.mode: 'solid' | 'adaptive' | 'rmx'.
  // rmx: opts.colors[] (dark→bright), opts.submode 'tone'|'posterize'|'random'|'tonernd',
  //      opts.rnd 0..1 caller-seeded and threaded through (do NOT pass a fresh
  //      Math.random() per render — seed once and reuse, or colours reshuffle).
  // opts.space: 'oklab' blends perceptually (needs shared/color.js); omitted = sRGB, as before.
  palette.colorAt = function (score, opts) {
    opts = opts || {};
    const mode = opts.mode || 'solid';
    if (mode === 'solid') return opts.ink || '#000000';
    if (mode === 'adaptive') return mixHex(opts.ink || '#000000', opts.paper || '#ffffff', Math.max(0, Math.min(1, score)), opts.space);
    const colors = opts.colors && opts.colors.length ? opts.colors : [opts.ink || '#000000', opts.paper || '#ffffff'];
    return rmxColor(score, opts.rnd == null ? 0.5 : opts.rnd, colors, opts.submode || 'tone', opts.space);
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

    // "Pick from a palette" — one small button at the end of the colour row.
    if (opts.library !== false && hexEl.parentNode) {
      const lib = libraryButton('icon-btn');
      (randomBtn && randomBtn.parentNode === hexEl.parentNode ? randomBtn : hexEl).insertAdjacentElement('afterend', lib);
      lib.addEventListener('click', e => { e.stopPropagation(); palette.pick(lib, { onPick: set }); });
    }

    // opts.pattern (opt-in, attach mode): a "Pattern" icon at the end of the row that
    // shows / hides the tool's own pattern controls (`panel`, moved right under the row)
    // and reports on/off. Paper = colour + texture. The tool draws the pattern itself;
    // tools that don't pass it are unchanged.
    let setPattern = function () {};
    if (opts.pattern && opts.pattern.panel && hexEl.parentNode) {
      const row = hexEl.parentNode, panel = opts.pattern.panel;
      const pb = document.createElement('button');
      pb.type = 'button';
      pb.className = 'org-btn org-btn--sm org-btn--icon pal-pattern-btn';   // pressed = the shared ink fill ([aria-pressed="true"])
      pb.setAttribute('aria-label', opts.pattern.label || 'Pattern');
      pb.title = opts.pattern.title || 'Pattern — a texture over this colour';
      pb.innerHTML = Organica.icons ? Organica.icons.get('pattern', { size: 'sm' }) : '';
      row.appendChild(pb);
      row.insertAdjacentElement('afterend', panel);
      setPattern = on => { on = !!on; pb.setAttribute('aria-pressed', String(on)); panel.hidden = !on; };
      setPattern(!!opts.pattern.on);
      pb.addEventListener('click', () => {
        const on = pb.getAttribute('aria-pressed') !== 'true';
        setPattern(on);
        if (opts.pattern.onToggle) opts.pattern.onToggle(on);
      });
    }

    if (opts.initial) set(opts.initial);

    return {
      set,
      setPattern,
      get: () => hexEl.value,
      getColors: () => [hexEl.value],
      setColors: (arr) => { if (arr && arr.length) set(arr[0]); },   // set() already notifies — a second onChange here fired every listener twice
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
          x.innerHTML = Organica.icons ? Organica.icons.get('close', { size: 'xs' }) : '';
          x.setAttribute('aria-label', 'Remove colour ' + (i + 1));
          x.addEventListener('click', e => { e.preventDefault(); removeColor(i); });
          chip.appendChild(x);
        }
        wrap.appendChild(chip);
      });
      if (colors.length < max) {
        const add = document.createElement('button');
        add.className = 'rmx-add';
        add.innerHTML = Organica.icons ? Organica.icons.get('plus', { size: 'sm' }) : '';
        add.title = 'Add colour';
        add.setAttribute('aria-label', 'Add palette colour');
        add.addEventListener('click', addColor);
        wrap.appendChild(add);
      }
      if (opts.library !== false) {
        const lib = libraryButton('rmx-add');
        lib.addEventListener('click', e => {
          e.stopPropagation();
          palette.pick(lib, {
            max: max,
            extra: opts.palettes,
            // one colour: add it while there is room, otherwise it replaces the last chip
            onPick: hex => { if (colors.length < max) { colors.push(hex); rebuild(); onChange(colors.slice(), colors.length - 1, 'add'); } else setColors(colors.slice(0, max - 1).concat(hex), { notify: true }); },
            onPickAll: hexes => setColors(hexes, { notify: true }),
          });
        });
        wrap.appendChild(lib);
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
      onChange(colors.slice(), Math.max(0, i - 1), 'remove', i);   // 4th arg: the index that was removed
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

  // ── the palette library ────────────────────────────────────────────────────
  // What every colour control can pick from: the palettes saved in TuneSutra
  // (its own preset store — read here the way FVS and Trellis read Loom's),
  // then the built-in sets. palette.library() → [{ id, name, builtin,
  // colors: [{ id, name, hex }] }], synchronous, from the local cache.
  //
  // Built-in: Riso's 21 standard inks. Hex values are SCREEN APPROXIMATIONS of
  // real inks (names + values from the public riso-colors list,
  // github.com/mattdesl/riso-colors) — a starting point, never a proof.
  const RISO_STANDARD = [
    ['Black', '#000000'], ['Burgundy', '#914e72'], ['Blue', '#0078bf'], ['Green', '#00a95c'],
    ['Medium Blue', '#3255a4'], ['Bright Red', '#f15060'], ['RisoFederal Blue', '#3d5588'], ['Purple', '#765ba7'],
    ['Teal', '#00838a'], ['Flat Gold', '#bb8b41'], ['Hunter Green', '#407060'], ['Red', '#ff665e'],
    ['Brown', '#925f52'], ['Yellow', '#ffe800'], ['Marine Red', '#d2515e'], ['Orange', '#ff6c2f'],
    ['Fluorescent Pink', '#ff48b0'], ['Light Gray', '#88898a'], ['Metallic Gold', '#ac936e'], ['Crimson', '#e45d50'],
    ['Fluorescent Orange', '#ff7477'],
  ];
  // Three three-colour combinations Diego picked (Oct 2, 2026) from TuneSutra's
  // "Garment studies — violet" collection, offered in every tool without having
  // to save them first. Role order: Base, Secondary, Accent. The values mirror
  // tunesutra/collections.js (same ids) — change both together.
  const COMBINATIONS = [
    ['violet-06', 'Violet 06', ['#fba79d', '#cfb3d7', '#f9dfe2']],
    ['stimulating', 'Stimulating', ['#5f238d', '#74c476', '#d40039']],
    ['violet-07', 'Violet 07', ['#ead8e3', '#ccece8', '#fffab8']],
  ];
  const ROLE_NAMES = ['Base', 'Secondary', 'Accent'];
  const BUILTIN = COMBINATIONS.map(c => ({
    id: 'combo-' + c[0], name: c[1], builtin: true,
    colors: c[2].map((hex, i) => ({ id: 'combo-' + c[0] + '-' + ROLE_NAMES[i].toLowerCase(), name: ROLE_NAMES[i], hex: hex })),
  })).concat([{
    id: 'riso-standard', name: 'Riso standard inks (approx.)', builtin: true,
    colors: RISO_STANDARD.map(c => ({ id: 'riso-' + c[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: c[0], hex: c[1] })),
  }]);
  function libraryStore() {
    const make = Organica.store || Organica.presetStore;
    return make ? make('tunesutra') : null;
  }
  palette.library = function () {
    let all = {};
    try { const st = libraryStore(); all = st ? st.read() : {}; } catch (e) { all = {}; }
    const user = Object.keys(all).filter(name => all[name] && Array.isArray(all[name].colors)).map(name => {
      const p = all[name];
      return {
        id: 'user:' + name, name: name, builtin: false,
        colors: p.colors.map((hex, i) => ({ id: (p.ids && p.ids[i]) || null, name: (p.names && p.names[i]) || '', hex: Organica.normalizeHex(hex, '#888888') })),
      };
    });
    return user.concat(BUILTIN);
  };

  // ── palette.pick(trigger, { onPick(hex), onPickAll(hexes)?, max? }) ─────────
  // One menu for the whole page, placed under the trigger. Each palette is a
  // name and its colours; a colour is a button. With onPickAll, a palette that
  // fits (≤ max colours) can also be taken whole by clicking its name.
  let menu = null, menuFor = null, pulled = false;
  const LIB_ICON = '<svg class="ico ico--sm" data-icon="grid" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>';
  function libraryButton(cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls + ' pal-btn';
    b.title = 'Pick from a palette';
    b.setAttribute('aria-label', 'Pick from a palette');
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = LIB_ICON;
    return b;
  }
  function closeMenu(returnFocus) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    if (menuFor) { menuFor.setAttribute('aria-expanded', 'false'); if (returnFocus) menuFor.focus(); }
    menuFor = null;
  }
  function ensureMenu() {
    if (menu) return;
    menu = document.createElement('div');
    menu.className = 'preset-menu pal-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Palettes');
    document.body.appendChild(menu);
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(true); });
  }
  function fillMenu(opts) {
    menu.innerHTML = '';
    (opts.extra ? opts.extra() : []).concat(palette.library()).forEach(pal => {
      const whole = opts.onPickAll && pal.colors.length <= (opts.max || 8);
      const head = document.createElement(whole ? 'button' : 'div');
      head.className = whole ? 'preset-item' : 'pi-group';
      head.textContent = pal.name;
      if (whole) {
        head.type = 'button';
        head.title = 'Use all ' + pal.colors.length + ' colours';
        head.addEventListener('click', () => { opts.onPickAll(pal.colors.map(c => c.hex), pal); closeMenu(true); });
      }
      menu.appendChild(head);
      const chips = document.createElement('div');
      chips.className = 'pal-chips';
      pal.colors.forEach(c => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'color-swatch';
        chip.style.background = c.hex;
        chip.title = (c.name ? c.name + ' ' : '') + c.hex;
        chip.setAttribute('aria-label', chip.title);
        chip.addEventListener('click', () => { opts.onPick(c.hex, c, pal); closeMenu(true); });
        chips.appendChild(chip);
      });
      menu.appendChild(chips);
    });
    if (global.location && !/^\/tunesutra\//.test(global.location.pathname)) {
      const link = document.createElement('a');
      link.className = 'pal-link';
      link.href = '/tunesutra/';
      link.textContent = 'Make a palette in TuneSutra';
      menu.appendChild(link);
    }
  }
  function placeMenu(trigger) {
    const t = trigger.getBoundingClientRect(), gap = 5, margin = 12;
    const below = global.innerHeight - t.bottom - margin, above = t.top - margin;
    const w = Math.min(global.innerWidth - 2 * margin, 236);
    menu.style.width = w + 'px';
    menu.style.left = Math.max(margin, Math.min(t.right - w, global.innerWidth - margin - w)) + 'px';
    if (below >= 200 || below >= above) { menu.style.top = (t.bottom + gap) + 'px'; menu.style.bottom = 'auto'; menu.style.maxHeight = Math.max(160, below) + 'px'; }
    else { menu.style.bottom = (global.innerHeight - t.top + gap) + 'px'; menu.style.top = 'auto'; menu.style.maxHeight = Math.max(160, above) + 'px'; }
  }
  palette.pick = function (trigger, opts) {
    ensureMenu();
    if (!menu.hidden && menuFor === trigger) { closeMenu(true); return; }
    closeMenu(false);
    fillMenu(opts);
    placeMenu(trigger);
    menu.hidden = false;
    menuFor = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    const first = menu.querySelector('button');
    if (first) first.focus();
    // The cache may be stale or empty on this device: refresh once from the
    // cloud (a no-op when signed out) and repaint the open menu.
    const st = libraryStore();
    if (!pulled && st && st.pull) {
      pulled = true;
      st.pull().then(() => { if (!menu.hidden && menuFor === trigger) { fillMenu(opts); placeMenu(trigger); } }, () => {});
    }
  };

  Organica.palette = palette;
})(typeof window !== 'undefined' ? window : this);
