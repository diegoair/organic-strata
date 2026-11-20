/* ─────────────────────────────────────────────────────────────────────────────
 * shade-editor.js — Organica.shadeEditor: a colour's GRADIENT and SHADOW controls, in any panel.
 *
 * Nov 20, 2026 (Diego: a TuneSutra palette loads in every tool "con tutti i loro shadow, grain e
 * parametri" and they can be changed there). The controls, values and words are TuneSutra's
 * (tunesutra/index.html, Gradient + Shadow sections; docs/TUNESUTRA.md §3), built from the panel's
 * own parts — .panel-section, .seg-ctrl, .ctrl-row, .color-row, Organica.selectPicker — so TuneSutra
 * can move onto this component. The drawing is Organica.shading's.
 *
 *   const ed = Organica.shadeEditor.mount(hostEl, {
 *     hex,                 // the colour being shaded
 *     ctx,                 // the Organica.shading context (the palette's tints, the paper) — or a function → it
 *     label,               // optional: the colour's name, shown as the sections' hint
 *     // EITHER a value (a tool: FVS) —
 *     def,                 // its definition (an Organica.shading GradDef), or null = flat, no shadow
 *     onChange(def|null),  // one call per edit (a range commits on release): the host makes it one Undo step
 *     // OR the host's own definition, edited in place (TuneSutra) —
 *     edit: { get() → def, before(key), after() },   // before: the host's Undo step (key = what changed, so a drag is
 *                                                    // one step); after: the host redraws. Ranges are live (input).
 *     onShading(mode) → true,   // optional: the host applies the Shading menu itself (TuneSutra's house / shape scope)
 *     shadingShown() → mode,    // optional: what the Shading menu shows (the host's scope)
 *     onColourStop(anchor),     // optional: a click on the colour's own stop (TuneSutra: the colour picker on the colour)
 *     everyColour(def),         // optional: shows "Use on every colour" after both sections — this colour's Gradient + Shadow on all
 *   });
 *   ed.set({ hex, def, label })   // another colour, or the same one changed elsewhere
 *   ed.sync()                     // the host's definition changed (edit mode)
 *   ed.destroy()
 *
 * The stop bar (Gradient › Stops, Nov 20, 2026: promoted from TuneSutra — the colour component's `stops` kind, O-20):
 * the gradient as the track, a knob per stop; drag one to move it (it cannot pass its neighbours), a click on the
 * bar adds one there (up to 8), Delete removes it (not the colour's own), a click or Enter opens its colour (a
 * stop may be transparent). Reverse keeps the colour on its stop; Space evenly spreads them. Its style: shade-editor.css.
 *
 * LOAD ORDER: core.js → color.js → noise.js → shade-marks.js → shading.js → select-picker.js → this (+ shade-editor.css).
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // The Shading menu — TuneSutra's #sel-shading: values, labels, groups and hints are the same.
  const SHADING = [
    [null, [['none', 'None'], ['soft', 'Soft']]],
    ['Specks', [['speckle', 'Speckle'], ['mottle', 'Mottle']]],
    ['Dither', [['dither-fs', 'Serpentine'], ['dither-blue', 'Blue noise'], ['dither-bayer', 'Bayer']]],
    ['Pollen', [['pollen-dot', 'Dot'], ['pollen-stroke', 'Stroke'], ['pollen-cross', 'Cross-hatch']]],
    ['Camo', [['camo-spots', 'Spots'], ['camo-maze', 'Maze']]],
    [null, [['cells', 'Cells']]],
  ];
  const SHADING_HINT = {
    none: 'No shadow', soft: 'A smooth shadow, no marks', speckle: 'Square specks', mottle: 'Specks in organic clumps',
    'dither-fs': 'Error diffusion, even grain', 'dither-blue': 'The smoothest grain', 'dither-bayer': 'A printed cross pattern',
    'pollen-dot': 'Dots, denser in shadow', 'pollen-stroke': 'Short strokes across the light', 'pollen-cross': 'Brush strokes, crossing as it darkens',
    'camo-spots': 'Spots that grow into the shadow', 'camo-maze': 'A labyrinth that thickens', cells: 'Cells filling from their centre',
  };
  // The Ink menu — TuneSutra's #sel-gink.
  const INK = [
    ['On the palette', [['same|p', 'Same'], ['cool|p', 'Cool'], ['warm|p', 'Warm'], ['complement|p', 'Complement']]],
    ['Free', [['same|f', 'Monochromatic'], ['analogous|f', 'Analogous'], ['complement|f', 'Complementary'], ['split|f', 'Split-complementary'], ['triadic|f', 'Triadic'], ['tetradic|f', 'Tetradic']]],
  ];
  const INK_HINT = { same: 'only darker', cool: 'toward blue-violet', warm: 'toward red-orange', complement: 'toward the opposite hue', analogous: 'the neighbouring hues', split: 'either side of the opposite', triadic: 'a third of the wheel apart', tetradic: 'a quarter of the wheel apart' };
  // Ranges — TuneSutra's min / max / step, and its titles.
  const RANGES = {
    angle: { label: 'Angle', min: 0, max: 360, step: 1, unit: '°' },
    amount: { label: 'Amount', min: 1, max: 100, step: 1, title: 'How strong the shadow is.' },
    speck: { label: 'Size', min: 1, max: 12, step: 0.5, aria: 'Shadow size', title: 'The size of one speck or dot, in sheet units.' },
    light: { label: 'Light from', min: 0, max: 360, step: 1, unit: '°', title: 'Where the light comes from: 0° = the top, 90° = the right. The shadow thickens toward the opposite side.' },
    falloff: { label: 'Falloff', min: 0, max: 100, step: 1, title: '50 = the shadow grows evenly across the fill. Higher keeps it to the far side; lower takes it further.' },
    shift: { label: 'Shift', min: 0, max: 100, step: 1, title: 'How far the shadow turns toward the Ink’s hue.' },
    depth: { label: 'Depth', min: 10, max: 90, step: 1, title: 'How dark the core shadow gets.' },
  };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  let uid = 0;

  function optionsHTML(groups) {
    return groups.map(([g, opts]) => {
      const o = opts.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('');
      return g ? `<optgroup label="${esc(g)}">${o}</optgroup>` : o;
    }).join('');
  }
  function rangeRow(p, key) {
    const r = RANGES[key];
    return `<div class="ctrl-row" data-row="${key}"><div class="ctrl-label"${r.title ? ` title="${esc(r.title)}"` : ''}>${esc(r.label)}</div>`
      + `<input type="range" id="${p}-${key}" min="${r.min}" max="${r.max}" step="${r.step}"${r.aria ? ` aria-label="${esc(r.aria)}"` : ''}>`
      + `<span class="ctrl-val" id="${p}-v-${key}"></span></div>`;
  }

  const MAX_STOPS = 8;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pct = v => +(+v * 100).toFixed(2);

  function mount(host, opts) {
    const S = Organica.shading;
    if (!S) throw new Error('shadeEditor: load shared/shading.js first');
    const p = 'sed' + (++uid), liveMode = !!opts.edit;
    let hex = opts.hex, def = opts.def ? clone(opts.def) : null, label = opts.label || '', sel = 0;
    const ctxOf = () => (typeof opts.ctx === 'function' ? opts.ctx() : opts.ctx) || {};
    host.innerHTML =
      `<div class="panel-section org-shade-editor" data-part="gradient"><h3>Gradient <span class="hint" data-hint></span></h3>`
      + `<div class="sub-label">Type</div><div class="ctrl-row"><div class="seg-ctrl" data-seg="type" role="group" aria-label="Type">`
      + `<button type="button" class="seg-btn" data-v="flat" title="One colour, no gradient">Flat</button><button type="button" class="seg-btn" data-v="linear">Linear</button><button type="button" class="seg-btn" data-v="radial">Radial</button></div></div>`
      + rangeRow(p, 'angle')
      + `<div data-block="stops"><div class="sub-label">Stops</div>`
      + `<div class="org-stopbar" data-bar role="group" aria-label="Stops"><div class="org-stopbar__rail"></div></div>`
      + `<div class="row-btns"><button type="button" class="mini-btn" data-act="reverse">Reverse</button><button type="button" class="mini-btn" data-act="even">Space evenly</button></div></div>`
      + `</div>`
      + `<div class="panel-section org-shade-editor" data-part="shadow"><h3>Shadow <span class="hint" data-hint></span></h3>`
      + `<div class="ctrl-row"><select id="${p}-shading" aria-label="Shading">${optionsHTML(SHADING)}</select><div data-host="shading"></div></div>`
      + `<div data-block="shadow">`
      + rangeRow(p, 'amount') + rangeRow(p, 'speck') + rangeRow(p, 'light') + rangeRow(p, 'falloff')
      + `<div class="sub-label">Ink</div><div class="ctrl-row"><select id="${p}-ink" aria-label="Ink">${optionsHTML(INK)}</select><div data-host="ink"></div></div>`
      + rangeRow(p, 'shift')
      + `<div class="color-row"><span class="color-name">Halftone</span><button type="button" class="color-swatch" data-ink="inkMid" aria-label="Halftone ink" aria-haspopup="dialog"></button><span class="ctrl-val" data-inkval="inkMid"></span></div>`
      + `<div class="color-row"><span class="color-name">Core</span><button type="button" class="color-swatch" data-ink="inkCore" aria-label="Core ink" aria-haspopup="dialog"></button><span class="ctrl-val" data-inkval="inkCore"></span></div>`
      + rangeRow(p, 'depth')
      + `</div></div>`
      // after both sections: it copies this colour's Gradient AND Shadow
      + (opts.everyColour ? `<div class="panel-section org-shade-editor" data-part="every"><div class="row-btns"><button type="button" class="mini-btn" data-act="every">Use on every colour</button></div></div>` : '');
    const $ = q => host.querySelector(q);
    const selShading = $('#' + p + '-shading'), selInk = $('#' + p + '-ink'), bar = $('[data-bar]'), rail = bar.firstElementChild;

    // what is drawn now: the host's definition (edit mode), or the value — the flat colour when there is none
    const cur = () => liveMode ? opts.edit.get() : (def || S.flatDef(hex, ctxOf()));
    const emit = () => {
      // flat + no shadow is no shading at all: null, so a palette with nothing changed saves as before
      if (def && def.type === 'flat' && !S.hasNoise(def)) def = null;
      if (opts.onChange) opts.onChange(def ? clone(def) : null);
      sync();
    };
    // One edit: in edit mode the host's Undo step first (before), then the definition changed in place, then the
    // host redraws (after); with a value, a copy is changed and handed back (onChange).
    function edit(key, fn) {
      if (liveMode) {
        if (opts.edit.before) opts.edit.before(key);
        fn(opts.edit.get());
        if (opts.edit.after) opts.edit.after();
        sync();
        return;
      }
      def = S.withColour(clone(cur()), hex, ctxOf()); fn(def); emit();
    }

    // Shading: a preset's shadow (its texture, size, amount, depth, falloff) on the colour; the Gradient section's
    // fill (Type, Angle, stops) stays as it is — the two sections edit one definition side by side.
    function presetOf(g) {
      if (!g || !S.hasNoise(g)) return 'none';
      const t = g.specks === 'smooth' ? 'soft' : g.specks === 'specks' ? 'speckle' : g.specks;
      return [...selShading.options].some(o => o.value === t) ? t : '';
    }
    function setShading(mode) {
      if (opts.onShading && opts.onShading(mode)) { sync(); return; }
      const D = S.defs(hex, ctxOf());
      edit('shading', g => {
        if (mode === 'none') { g.shadow = false; return; }
        const pre = D[mode], had = g.shadow;
        // the fill stays as it is (Type, Angle, stops); the shadow takes the preset's settings
        Object.assign(g, { shadow: true, specks: pre.specks, speck: pre.speck, amount: pre.amount, depth: pre.depth, falloff: pre.falloff,
          hue: had ? g.hue : pre.hue, snap: had ? g.snap : pre.snap });
      });
    }
    function shadingThumb(mode) {
      // TuneSutra's: a 72-unit box, a disc of radius 32, light from the top-left, a wide falloff; no <clipPath id>
      const SZ = 72, R = 32, c = SZ / 2, ctx = ctxOf(), paper = ctx.paper || Organica.contentColor('--paper');
      const g = mode === 'none' ? null : S.withColour(Object.assign(clone(S.defs(hex, ctx)[mode]), { light: 315, falloff: 45, amount: 90 }), hex, ctx);
      const own = hex.toLowerCase();
      const inks = g ? S.plates(g, SZ, SZ, ctx).filter((pl, i) => i > 0 || String(pl.hex).toLowerCase() !== own).map((pl, i) => !pl.d ? '' : pl.smooth ? S.smoothMarkup(pl, p + '-t' + mode + i) : `<path fill="${pl.hex}" d="${pl.d}"/>`).join('') : '';
      const disc = `M${c - R} ${c}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
      return `<svg viewBox="0 0 ${SZ} ${SZ}"><rect width="${SZ}" height="${SZ}" fill="${hex}"/><g shape-rendering="crispEdges" fill-rule="evenodd">${inks}</g>`
        + `<path fill="${paper}" fill-rule="evenodd" d="M0 0H${SZ}V${SZ}H0Z${disc}"/></svg>`;
    }
    function inkThumb(value) {
      const [hue, mode] = value.split('|'), g = Object.assign(clone(cur()), { hue: hue, snap: mode === 'p', inkMid: null, inkCore: null });
      const h = g.stops[S.colourStop(g)], [mid, core] = S.shadowInks(g, h, ctxOf());
      return `<svg viewBox="0 0 30 30"><rect width="10" height="30" fill="${h}"/><rect x="10" width="10" height="30" fill="${mid}"/><rect x="20" width="10" height="30" fill="${core}"/></svg>`;
    }
    let shadingPicker = null, inkPicker = null, thumbKey = '', inkKey = '';
    if (Organica.selectPicker) {
      const reg = {};
      [...selShading.options].forEach(o => { reg[o.value] = { name: o.textContent, thumb: () => shadingThumb(o.value), rowHtml: esc(o.textContent) + (SHADING_HINT[o.value] ? ` <span class="pi-hint">${esc(SHADING_HINT[o.value])}</span>` : '') }; });
      shadingPicker = Organica.selectPicker(selShading, $('[data-host="shading"]'), { registry: reg, size: 'preview', ariaLabel: 'Shading' });
      const ireg = {};
      [...selInk.options].forEach(o => { const [h, m] = o.value.split('|'); ireg[o.value] = { name: o.textContent + (m === 'p' ? ' · palette' : ''), thumb: () => inkThumb(o.value), rowHtml: esc(o.textContent) + ` <span class="pi-hint">${esc(INK_HINT[h] + (m === 'p' ? ', from the palette' : ''))}</span>` }; });
      inkPicker = Organica.selectPicker(selInk, $('[data-host="ink"]'), { registry: ireg, size: 'preview', ariaLabel: 'Ink' });
    }

    // ── the stop bar ──
    const ensurePos = g => { if (!g.pos || g.pos.length !== g.stops.length) g.pos = S.evenPos(g.stops.length); return g.pos; };
    const posFrom = x => { const r = rail.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1); };
    function selectStop(i) {
      sel = clamp(i, 0, cur().stops.length - 1);
      [...rail.children].forEach((k, j) => k.classList.toggle('is-active', j === sel));
    }
    const focusStop = i => { const k = rail.children[i]; if (k) k.focus({ preventScroll: true }); };
    // a stop at `at` (0..1) in the colour the gradient has there; returns its index
    function addStopAt(g, at) {
      const pos = ensurePos(g);
      let i = pos.findIndex(x => x > at);
      if (i < 0) i = pos.length;
      const stops = S.gradStops(g, ctxOf()).filter(st => !st.paper);
      const h = S.colourAt(stops.length ? stops : [{ hex: hex, at: 0 }], at);
      if (i <= S.colourStop(g)) g.colourAt = S.colourStop(g) + 1;
      g.stops.splice(i, 0, h); pos.splice(i, 0, at); g.auto2 = false;
      return i;
    }
    function removeStop(i) {
      const g = cur();
      if (g.stops.length <= 2 || i === S.colourStop(g)) return;   // the colour's own stop stays
      edit('stop', g2 => {
        if (i < S.colourStop(g2)) g2.colourAt = S.colourStop(g2) - 1;
        ensurePos(g2).splice(i, 1); g2.stops.splice(i, 1); g2.auto2 = false;
      });
      sel = Math.max(0, i - 1);
      renderStopBar(); focusStop(sel);
    }
    function moveStop(i, to) {
      const g = cur(), pos = ensurePos(g), lo = i > 0 ? pos[i - 1] : 0, hi = i < pos.length - 1 ? pos[i + 1] : 1;
      to = Math.round(clamp(to, lo, hi) * 1000) / 1000;
      if (to === pos[i]) return;
      // a drag with a value: moved in place, handed back once on release (end) — one Undo step, not one per pixel
      if (!liveMode && drag) { if (!def) def = S.withColour(clone(cur()), hex, ctxOf()); ensurePos(def)[i] = to; drag.dirty = true; sync(); return; }
      edit('stop-move', g2 => { ensurePos(g2)[i] = to; });
    }
    function pickStop(i) {
      const k = rail.children[i], g = cur();
      if (!k || !Organica.colorPicker) return;
      if (i === S.colourStop(g)) { if (opts.onColourStop) opts.onColourStop(k); return; }   // the colour itself: the host's colour
      const set = v => { if (cur().stops[i] === v) return; edit('stop-colour', g2 => { g2.auto2 = false; g2.stops[i] = v; }); };
      Organica.colorPicker.open(k, {
        value: S.isClear(g.stops[i]) ? '#ffffff' : g.stops[i], label: 'Stop ' + (i + 1),
        [liveMode ? 'onInput' : 'onChange']: set,
        transparent: true, onTransparent: () => set('transparent'),
      });
    }
    function renderStopBar() {
      const g = cur();
      if (g.type === 'flat') return;
      const pos = ensurePos(liveMode ? g : clone(g));
      bar.style.background = 'linear-gradient(to right, ' + S.smoothStops(g, ctxOf()).map(([at, h, op]) => (op < 1 ? h + Math.round(op * 255).toString(16).padStart(2, '0') : h) + ' ' + pct(at) + '%').join(', ') + ')';
      if (rail.children.length !== pos.length) rail.innerHTML = pos.map((_, i) => `<span class="org-stopbar__stop" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" data-i="${i}"></span>`).join('');
      sel = Math.min(sel, pos.length - 1);
      [...rail.children].forEach((k, i) => {
        const v = Math.round(pos[i] * 100), clear = S.isClear(g.stops[i]);
        k.style.left = (pos[i] * 100) + '%';
        k.style.background = clear ? '' : g.stops[i];
        k.classList.toggle('is-clear', clear);
        k.classList.toggle('is-active', i === sel);
        k.setAttribute('aria-valuenow', v);
        k.setAttribute('aria-valuetext', v + '%, ' + (clear ? 'transparent' : g.stops[i]));
        k.setAttribute('aria-label', 'Stop ' + (i + 1));
      });
    }
    let drag = null;
    bar.addEventListener('pointerdown', e => {
      const knob = e.target.closest('.org-stopbar__stop');
      let i;
      if (knob) i = +knob.dataset.i;
      else {
        if (cur().stops.length >= MAX_STOPS) return;
        const at = posFrom(e.clientX);
        edit('stop', g => { i = addStopAt(g, at); });
      }
      selectStop(i);
      drag = { i: i, id: e.pointerId, x0: e.clientX, knob: !!knob, moved: false };
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* a pointer the page did not see begin */ }
      bar.classList.add('is-dragging');
      focusStop(i);
      e.preventDefault();
    });
    bar.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (Math.abs(e.clientX - drag.x0) > 3) drag.moved = true;
      if (drag.moved) moveStop(drag.i, posFrom(e.clientX));
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null; bar.classList.remove('is-dragging');
      if (d.dirty) emit();
      if (e.type === 'pointerup' && d.knob && !d.moved) pickStop(d.i);
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('keydown', e => {
      const knob = e.target.closest('.org-stopbar__stop');
      if (!knob) return;
      const i = +knob.dataset.i, pos = ensurePos(liveMode ? cur() : clone(cur())), step = e.shiftKey ? 0.1 : 0.01;
      let to = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = pos[i] - step;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = pos[i] + step;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = 1;
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); removeStop(i); return; }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pickStop(i); return; }
      else return;
      // the tool's own keys (Delete an Element, the arrows on a canvas) never see a key the stop used
      e.preventDefault(); e.stopPropagation();
      selectStop(i);
      moveStop(i, to);
      focusStop(i);
    });
    bar.addEventListener('focusin', e => { const k = e.target.closest('.org-stopbar__stop'); if (k) selectStop(+k.dataset.i); });

    // ── wiring ──
    host.querySelectorAll('[data-seg="type"] .seg-btn').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (cur().type === v) return;
      edit('type', g => { g.type = v; });
    }));
    $('[data-act="reverse"]').addEventListener('click', () => {
      edit('stop', g => {
        const ci = S.colourStop(g), pos = ensurePos(g);
        g.colourAt = g.stops.length - 1 - ci;   // the colour keeps its stop (TuneSutra: "deve mantenere i color scelti")
        g.stops.reverse(); g.pos = pos.map(x => Math.round((1 - x) * 1000) / 1000).reverse();
      });
      sel = cur().stops.length - 1 - sel;
      renderStopBar();
    });
    $('[data-act="even"]').addEventListener('click', () => edit('stop', g => { g.pos = null; }));
    if (opts.everyColour) $('[data-act="every"]').addEventListener('click', () => opts.everyColour(clone(cur())));
    Object.keys(RANGES).forEach(k => {
      const r = $('#' + p + '-' + k), v = $('#' + p + '-v-' + k), u = RANGES[k].unit || '';
      r.addEventListener('input', () => {
        v.textContent = r.value + u;
        if (liveMode && cur()[k] !== +r.value) edit(k, g => { g[k] = +r.value; });   // TuneSutra: live, one Undo step per drag
      });
      if (!liveMode) r.addEventListener('change', () => edit(k, g => { g[k] = +r.value; }));
    });
    selShading.addEventListener('change', () => setShading(selShading.value));
    selInk.addEventListener('change', () => {
      const [h, m] = selInk.value.split('|'), g = cur();
      if (g.hue === h && !!g.snap === (m === 'p') && !g.inkMid && !g.inkCore) return;
      edit('ink', g2 => { g2.hue = h; g2.snap = m === 'p'; g2.inkMid = null; g2.inkCore = null; });   // an Ink preset replaces hand-picked inks
    });
    host.querySelectorAll('[data-ink]').forEach(btn => btn.addEventListener('click', () => {
      if (!Organica.colorPicker) return;
      const key = btn.dataset.ink, g = cur(), inks = S.shadowInks(g, g.stops[S.colourStop(g)], ctxOf());
      Organica.colorPicker.open(btn, {
        value: key === 'inkMid' ? inks[0] : inks[1],
        label: key === 'inkMid' ? 'Halftone ink' : 'Core ink',
        [liveMode ? 'onInput' : 'onChange']: h => { if (cur()[key] === h) return; edit('ink-' + key, g2 => { g2[key] = h; }); },
      });
    }));
    if (Organica.autoLabelPanel) Organica.autoLabelPanel(host);
    if (Organica.enhanceSliders) Organica.enhanceSliders(host);

    // ── sync: the controls show the definition ──
    function sync() {
      const g = cur(), uses = S.gradUses(g), shadow = S.hasNoise(g), own = g.stops[S.colourStop(g)];
      host.querySelectorAll('[data-hint]').forEach(h => { h.textContent = label; });
      host.querySelectorAll('[data-seg="type"] .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.v === g.type));
      Object.keys(RANGES).forEach(k => {
        const r = $('#' + p + '-' + k);
        // the enhanced slider's fill follows an 'input'; in edit mode the handler sees the same value and edits nothing
        if (g[k] != null && document.activeElement !== r && +r.value !== +g[k]) { r.value = g[k]; r.dispatchEvent(new Event('input')); }
        if (g[k] != null) $('#' + p + '-v-' + k).textContent = g[k] + (RANGES[k].unit || '');
      });
      $('[data-row="angle"]').hidden = !uses.angle;
      $('[data-block="stops"]').hidden = g.type === 'flat';
      $('[data-block="shadow"]').hidden = !shadow;
      ['speck', 'light', 'falloff'].forEach(k => { $('[data-row="' + k + '"]').hidden = !uses[k]; });
      $('[data-row="shift"]').hidden = g.hue === 'same' || g.snap || (!!g.inkMid && !!g.inkCore);
      const inks = S.shadowInks(g, own, ctxOf());
      [['inkMid', inks[0]], ['inkCore', inks[1]]].forEach(([k, h]) => { $('[data-ink="' + k + '"]').style.background = h; $('[data-inkval="' + k + '"]').textContent = h; });
      const shown = opts.shadingShown ? opts.shadingShown() : presetOf(g);
      selShading.value = shown == null ? '' : shown;
      selInk.value = g.hue + '|' + (g.snap ? 'p' : 'f');
      if (!selInk.value) selInk.value = 'same|p';
      const ctx = ctxOf(), tk = hex + '|' + (ctx.paper || '') + '|' + (document.documentElement.dataset.theme || '');
      if (shadingPicker) { if (tk !== thumbKey) { thumbKey = tk; shadingPicker.invalidate(); } shadingPicker.refresh(); }
      const tints = typeof ctx.tints === 'function' ? ctx.tints() : ctx.tints;
      const ik = own + '|' + (tints ? tints.join('') : '') + '|' + g.depth + '|' + g.shift + '|' + g.lose + '|' + g.glow;
      if (inkPicker) { if (ik !== inkKey) { inkKey = ik; inkPicker.invalidate(); } inkPicker.refresh(); }
      renderStopBar();
    }
    sync();
    return {
      set(o) {
        if (o.hex) hex = o.hex;
        if ('def' in o) def = o.def ? clone(o.def) : null;
        if ('label' in o) label = o.label || '';
        sync();
      },
      sync: sync,
      get: () => clone(cur()),
      destroy() { host.innerHTML = ''; },
    };
  }

  Organica.shadeEditor = { mount: mount, SHADING: SHADING, SHADING_HINT: SHADING_HINT, INK: INK, RANGES: RANGES, MAX_STOPS: MAX_STOPS };
})(typeof window !== 'undefined' ? window : this);
