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
 *     def,                 // its definition (an Organica.shading GradDef), or null = flat, no shadow
 *     ctx,                 // the Organica.shading context (the palette's tints, the paper) — or a function → it
 *     label,               // optional: the colour's name, shown as the sections' hint
 *     onChange(def|null),  // one call per edit (a range commits on release): the host makes it one Undo step
 *   });
 *   ed.set({ hex, def, label })   // another colour, or the same one changed elsewhere
 *   ed.destroy()
 *
 * Not here yet: the stop bar (several stops, their positions) — TuneSutra's own until it is promoted
 * (O-20 'stops'); a gradient here runs from the colour to its own 900, Reverse swaps them.
 *
 * LOAD ORDER: core.js → color.js → noise.js → shade-marks.js → shading.js → select-picker.js → this.
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

  function mount(host, opts) {
    const S = Organica.shading;
    if (!S) throw new Error('shadeEditor: load shared/shading.js first');
    const p = 'sed' + (++uid);
    let hex = opts.hex, def = opts.def ? clone(opts.def) : null, label = opts.label || '';
    const ctxOf = () => (typeof opts.ctx === 'function' ? opts.ctx() : opts.ctx) || {};
    host.innerHTML =
      `<div class="panel-section org-shade-editor" data-part="gradient"><h3>Gradient <span class="hint" data-hint></span></h3>`
      + `<div class="sub-label">Type</div><div class="ctrl-row"><div class="seg-ctrl" data-seg="type" role="group" aria-label="Type">`
      + `<button type="button" class="seg-btn" data-v="flat" title="One colour, no gradient">Flat</button><button type="button" class="seg-btn" data-v="linear">Linear</button><button type="button" class="seg-btn" data-v="radial">Radial</button></div></div>`
      + rangeRow(p, 'angle')
      + `<div class="row-btns" data-row="reverse"><button type="button" class="mini-btn" data-act="reverse">Reverse</button></div>`
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
      + `</div></div>`;
    const $ = sel => host.querySelector(sel);
    const selShading = $('#' + p + '-shading'), selInk = $('#' + p + '-ink');

    // what is drawn now: the definition, or the flat colour (TuneSutra's draftDef with Shading None)
    const cur = () => def || S.flatDef(hex, ctxOf());
    const emit = () => {
      // flat + no shadow is no shading at all: null, so a palette with nothing changed saves as before
      if (def && def.type === 'flat' && !S.hasNoise(def)) def = null;
      if (opts.onChange) opts.onChange(def ? clone(def) : null);
      sync();
    };
    const edit = fn => { def = S.withColour(clone(cur()), hex, ctxOf()); fn(def); emit(); };

    // Shading: a preset's shadow (its texture, size, amount, depth, falloff) on the colour; the Gradient section's
    // fill (Type, Angle, stops) stays as it is — here the two sections edit one definition side by side.
    function presetOf(g) {
      if (!g || !S.hasNoise(g)) return 'none';
      const t = g.specks === 'smooth' ? 'soft' : g.specks === 'specks' ? 'speckle' : g.specks;
      return [...selShading.options].some(o => o.value === t) ? t : '';
    }
    function setShading(mode) {
      const was = cur(), D = S.defs(hex, ctxOf());
      if (mode === 'none') { def = Object.assign(clone(was), { shadow: false }); emit(); return; }
      const pre = clone(D[mode]);
      // the fill stays as it is (Type, Angle, stops); the shadow takes the preset's settings
      def = Object.assign(clone(was), {
        shadow: true, specks: pre.specks, speck: pre.speck, amount: pre.amount, depth: pre.depth, falloff: pre.falloff,
        hue: was.shadow ? was.hue : pre.hue, snap: was.shadow ? was.snap : pre.snap,
      });
      emit();
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
      const [mid, core] = S.shadowInks(g, hex, ctxOf());
      return `<svg viewBox="0 0 30 30"><rect width="10" height="30" fill="${hex}"/><rect x="10" width="10" height="30" fill="${mid}"/><rect x="20" width="10" height="30" fill="${core}"/></svg>`;
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

    // ── wiring ──
    host.querySelectorAll('[data-seg="type"] .seg-btn').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (cur().type === v) return;
      edit(g => { g.type = v; });
    }));
    $('[data-act="reverse"]').addEventListener('click', () => edit(g => {
      const ci = S.colourStop(g);
      g.stops = g.stops.slice().reverse();
      if (g.pos) g.pos = g.pos.map(x => 1 - x).reverse();
      g.colourAt = g.stops.length - 1 - ci;   // the colour keeps its stop (TuneSutra: "deve mantenere i color scelti")
    }));
    Object.keys(RANGES).forEach(k => {
      const r = $('#' + p + '-' + k), v = $('#' + p + '-v-' + k), u = RANGES[k].unit || '';
      r.addEventListener('input', () => { v.textContent = r.value + u; });
      r.addEventListener('change', () => edit(g => { g[k] = +r.value; }));
    });
    selShading.addEventListener('change', () => setShading(selShading.value));
    selInk.addEventListener('change', () => { const [h, m] = selInk.value.split('|'); edit(g => { g.hue = h; g.snap = m === 'p'; g.inkMid = null; g.inkCore = null; }); });
    host.querySelectorAll('[data-ink]').forEach(btn => btn.addEventListener('click', () => {
      if (!Organica.colorPicker) return;
      const key = btn.dataset.ink, inks = S.shadowInks(cur(), hex, ctxOf());
      Organica.colorPicker.open(btn, {
        value: key === 'inkMid' ? inks[0] : inks[1],
        label: key === 'inkMid' ? 'Halftone ink' : 'Core ink',
        onChange: h => edit(g => { g[key] = h; }),
      });
    }));
    if (Organica.autoLabelPanel) Organica.autoLabelPanel(host);
    if (Organica.enhanceSliders) Organica.enhanceSliders(host);

    // ── sync: the controls show the definition ──
    function sync() {
      const g = cur(), uses = S.gradUses(g), shadow = S.hasNoise(g);
      host.querySelectorAll('[data-hint]').forEach(h => { h.textContent = label; });
      host.querySelectorAll('[data-seg="type"] .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.v === g.type));
      Object.keys(RANGES).forEach(k => {
        const r = $('#' + p + '-' + k);
        if (g[k] != null) { r.value = g[k]; $('#' + p + '-v-' + k).textContent = g[k] + (RANGES[k].unit || ''); r.dispatchEvent(new Event('input')); }
      });
      $('[data-row="angle"]').hidden = !uses.angle;
      $('[data-row="reverse"]').hidden = g.type === 'flat';
      $('[data-block="shadow"]').hidden = !shadow;
      ['speck', 'light', 'falloff'].forEach(k => { $('[data-row="' + k + '"]').hidden = !uses[k]; });
      $('[data-row="shift"]').hidden = g.hue === 'same' || g.snap || (!!g.inkMid && !!g.inkCore);
      const inks = S.shadowInks(g, hex, ctxOf());
      [['inkMid', inks[0]], ['inkCore', inks[1]]].forEach(([k, h]) => { $('[data-ink="' + k + '"]').style.background = h; $('[data-inkval="' + k + '"]').textContent = h; });
      selShading.value = presetOf(g);
      selInk.value = g.hue + '|' + (g.snap ? 'p' : 'f');
      if (!selInk.value) selInk.value = 'same|p';
      const ctx = ctxOf(), tk = hex + '|' + (ctx.paper || '') + '|' + (document.documentElement.dataset.theme || '');
      if (shadingPicker) { if (tk !== thumbKey) { thumbKey = tk; shadingPicker.invalidate(); } shadingPicker.refresh(); }
      const ik = hex + '|' + (ctx.tints ? (typeof ctx.tints === 'function' ? '' : ctx.tints.length) : '') + '|' + g.depth + '|' + g.shift + '|' + g.lose + '|' + g.glow;
      if (inkPicker) { if (ik !== inkKey) { inkKey = ik; inkPicker.invalidate(); } inkPicker.refresh(); }
    }
    sync();
    return {
      set(o) {
        if (o.hex) hex = o.hex;
        if ('def' in o) def = o.def ? clone(o.def) : null;
        if ('label' in o) label = o.label || '';
        sync();
      },
      get: () => (def ? clone(def) : null),
      destroy() { host.innerHTML = ''; },
    };
  }

  Organica.shadeEditor = { mount: mount, SHADING: SHADING, SHADING_HINT: SHADING_HINT, INK: INK, RANGES: RANGES };
})(typeof window !== 'undefined' ? window : this);
