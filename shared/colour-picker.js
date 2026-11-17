/* ─────────────────────────────────────────────────────────────────────────────
 * colour-picker.js — Organica's own popover colour picker (O-21, Nov 17, 2026).
 * Paired stylesheet: shared/colour-picker.css. Phase 3 of the colour migration,
 * piloted in TuneSutra (palette chips + the Colour section's swatch).
 *
 *   Organica.colorPicker.open(anchorEl, {
 *     value: '#ff3e41',
 *     label: 'Base',                 // optional, names the dialog: "Base colour"
 *     onInput(hex),                  // live: dragging the square / hue, typing
 *     onChange(hex),                 // committed: pointer up, a field left, Enter,
 *   })                               //   the eyedropper, a recent / palette colour
 *   → { close, set(hex) }
 *   Organica.colorPicker.close()
 *   Organica.colorPicker.recent()    → the recent colours (shared by every tool)
 *   Organica.colorPicker.nearestRal(hex) → { code, name, hex, dE } | null
 *
 * Layout, top to bottom: Recent colours (+ Palettes, the saved TuneSutra palettes
 * and the built-in sets, opened in place) · the saturation / brightness square ·
 * the hue strip · the value row (Hex, RGB or CMYK fields + the colour sample) ·
 * a footer with the mode menu (Hex · RGB · CMYK — Diego, Nov 17), Pick from
 * screen (EyeDropper API, hidden where it is missing) and Copy.
 *
 * One instance, in <body>, position:fixed from the anchor's rect (as
 * select-picker.js). It joins the "one dropdown open at a time" contract
 * (organica:dropdown-open). Escape closes it and gives focus back to the anchor.
 * The square and hue gradients are CONTENT (the colours being picked), not
 * chrome, so they are written here, not tokenised.
 *
 * LOAD ORDER: core.js → icons.js → this → palette.js (palette.js decides per chip at build time). color.js +
 * vendor/ral-classic.js only for nearestRal().
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const RECENT_KEY = 'organica.color.recent', RECENT_MAX = 10;
  const MODES = [['hex', 'Hex'], ['rgb', 'RGB'], ['cmyk', 'CMYK']];
  const MODE_KEY = 'organica.color.picker-mode';

  let root = null, els = {}, anchor = null, opts = {}, open = false;
  let h = 0, s = 0, v = 0;                 // the picker's own HSB (floats), so the hue survives grey
  let mode = 'hex', committed = '', dragging = null;

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ico = (n, o) => (Organica.icons ? Organica.icons.get(n, o) : '');
  function store(k, val) { try { if (val === undefined) return global.localStorage.getItem(k); global.localStorage.setItem(k, val); } catch (e) { return null; } return null; }

  // ── colour maths (HSB floats ↔ hex) ──
  // Its own HSB → RGB, so every tool can load the picker without shared/color.js
  // (only Nearest RAL needs color.js's ΔE, and only TuneSutra shows it).
  function hexOf() {
    const sat = s / 100, val = v / 100, c = val * sat, hp = (h % 360) / 60, x = c * (1 - Math.abs(hp % 2 - 1)), m = val - c;
    const p = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    return Organica.rgbToHex((p[0] + m) * 255, (p[1] + m) * 255, (p[2] + m) * 255).toLowerCase();
  }
  function fromHex(hex) {
    const [r, g, b] = Organica.hexToRGB255(hex).map(x => x / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hh = h;
    if (d > 0) {
      if (max === r) hh = 60 * (((g - b) / d) % 6);
      else if (max === g) hh = 60 * ((b - r) / d + 2);
      else hh = 60 * ((r - g) / d + 4);
      if (hh < 0) hh += 360;
    }
    h = hh; s = max === 0 ? 0 : (d / max) * 100; v = max * 100;
  }

  // ── recent colours (P4: one list for every tool) ──
  function recent() {
    try { const a = JSON.parse(store(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => /^#[0-9a-f]{6}$/i.test(x)) : []; } catch (e) { return []; }
  }
  function pushRecent(hex) {
    const a = [hex].concat(recent().filter(x => x.toLowerCase() !== hex.toLowerCase())).slice(0, RECENT_MAX);
    store(RECENT_KEY, JSON.stringify(a));
  }

  // ── nearest RAL Classic (vendor/ral-classic.js; screen approximations) ──
  function nearestRal(hex) {
    const list = global.ORGANICA_RAL_CLASSIC;
    if (!list || !list.length || !Organica.color || !Organica.color.deltaE) return null;
    let best = null;
    for (let i = 0; i < list.length; i++) {
      const dE = Organica.color.deltaE(hex, list[i][2]);
      if (!best || dE < best.dE) best = { code: list[i][0], name: list[i][1], hex: list[i][2], dE: dE };
    }
    return best;
  }

  // ── value text per mode (also what Copy and the tiles copy) ──
  function valueText(hex, m) {
    const [r, g, b] = Organica.hexToRGB255(hex);
    if (m === 'rgb') return r + ', ' + g + ', ' + b;
    if (m === 'cmyk') { const c = Organica.rgbToCmyk(r, g, b); return c.c + ', ' + c.m + ', ' + c.y + ', ' + c.k; }
    if (m === 'hsb') {   // display only (TuneSutra's HSB tile) — not a picker mode
      const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), d = max - Math.min(R, G, B);
      let hh = 0;
      if (d > 0) { hh = max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4); if (hh < 0) hh += 360; }
      return Math.round(hh) % 360 + ', ' + Math.round(max ? d / max * 100 : 0) + ', ' + Math.round(max * 100);
    }
    if (m === 'oklch' && Organica.color && Organica.color.hexToOklch) {   // display only (TuneSutra's OKLCH tile); needs color.js
      const o = Organica.color.hexToOklch(hex);
      return Math.round(o.l * 100) + '%, ' + o.c.toFixed(2) + ', ' + Math.round(o.h) % 360;
    }
    return hex.toUpperCase();
  }

  // ── build once ──
  function el(tag, cls, attrs) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
    return e;
  }
  function build() {
    root = el('div', 'org-popover org-cpick', { role: 'dialog', 'aria-label': 'Colour' });
    root.hidden = true;

    const top = el('div', 'org-cpick__top');
    els.recentLabel = el('div', 'org-cpick__label'); els.recentLabel.textContent = 'Recent';
    els.palBtn = el('button', 'org-cpick__more', { type: 'button', 'aria-expanded': 'false' });
    els.palBtn.innerHTML = '<span>Palettes</span>' + ico('chevron-down', { size: 'sm', cls: 'chev' });
    const head = el('div', 'org-cpick__head'); head.append(els.recentLabel, els.palBtn);
    els.recent = el('div', 'org-cpick__swatches', { role: 'group', 'aria-label': 'Recent colours' });
    els.pals = el('div', 'org-cpick__pals'); els.pals.hidden = true;
    top.append(head, els.recent, els.pals);

    els.sv = el('div', 'org-cpick__sv', { role: 'slider', tabindex: '0', 'aria-label': 'Saturation and brightness', 'aria-valuemin': '0', 'aria-valuemax': '100' });
    els.svKnob = el('div', 'org-cpick__knob'); els.sv.appendChild(els.svKnob);
    els.hue = el('div', 'org-cpick__hue', { role: 'slider', tabindex: '0', 'aria-label': 'Hue', 'aria-valuemin': '0', 'aria-valuemax': '360' });
    els.hueKnob = el('div', 'org-cpick__knob'); els.hue.appendChild(els.hueKnob);
    els.hue.style.background = 'linear-gradient(90deg, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)';   // content: the hue wheel

    els.fields = el('div', 'org-cpick__fields');
    els.sample = el('span', 'org-cpick__sample', { 'aria-hidden': 'true' });
    const valueRow = el('div', 'org-cpick__value'); valueRow.append(els.fields, els.sample);

    const foot = el('div', 'org-cpick__foot');
    const modeWrap = el('div', 'org-cpick__modewrap');
    els.modeBtn = el('button', 'org-cpick__mode', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
    els.modeMenu = el('div', 'org-cpick__menu', { role: 'listbox', 'aria-label': 'Values' }); els.modeMenu.hidden = true;
    MODES.forEach(([id, name]) => {
      const o = el('button', 'org-cpick__opt', { type: 'button', role: 'option', 'data-mode': id });
      o.innerHTML = '<span>' + name + '</span>' + ico('check', { size: 'sm' });
      els.modeMenu.appendChild(o);
    });
    modeWrap.append(els.modeBtn, els.modeMenu);
    els.drop = el('button', 'org-btn org-btn--sm org-btn--icon org-cpick__tool', { type: 'button', 'aria-label': 'Pick from screen' });
    els.drop.innerHTML = ico('eyedropper', { size: 'sm' });
    els.drop.hidden = !('EyeDropper' in global);
    els.copy = el('button', 'org-btn org-btn--sm org-btn--icon org-cpick__tool', { type: 'button' });
    els.copy.innerHTML = ico('copy', { size: 'sm' });
    const tools = el('div', 'org-cpick__tools'); tools.append(els.drop, els.copy);
    foot.append(modeWrap, tools);

    root.append(top, els.sv, els.hue, valueRow, foot);
    document.body.appendChild(root);
    wire();
  }

  // ── paint ──
  function paint(skipFields) {
    const hex = hexOf();
    els.sv.style.background = 'linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, hsl(' + h.toFixed(1) + ', 100%, 50%))';   // content
    els.svKnob.style.left = s + '%';
    els.svKnob.style.top = (100 - v) + '%';
    els.svKnob.style.background = hex;
    els.hueKnob.style.left = (h / 360 * 100) + '%';
    els.hueKnob.style.background = 'hsl(' + h.toFixed(1) + ', 100%, 50%)';
    els.sv.setAttribute('aria-valuenow', Math.round(s));
    els.sv.setAttribute('aria-valuetext', 'Saturation ' + Math.round(s) + '%, brightness ' + Math.round(v) + '%');
    els.hue.setAttribute('aria-valuenow', Math.round(h));
    els.sample.style.background = hex;
    if (!skipFields) writeFields(hex);
    return hex;
  }
  function writeFields(hex) {
    const inputs = els.fields.querySelectorAll('input');
    if (mode === 'hex') { if (document.activeElement !== inputs[0]) inputs[0].value = hex.toUpperCase(); return; }
    const vals = valueText(hex, mode).split(', ');
    inputs.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = vals[i]; });
  }
  function buildFields() {
    els.fields.innerHTML = '';
    if (mode === 'hex') {
      const i = el('input', 'color-hex org-cpick__hex', { type: 'text', maxlength: '7', 'aria-label': 'Hex value', spellcheck: 'false' });
      els.fields.appendChild(i);
    } else {
      const spec = mode === 'rgb'
        ? [['R', 'Red, 0 to 255', 255], ['G', 'Green, 0 to 255', 255], ['B', 'Blue, 0 to 255', 255]]
        : [['C', 'Cyan, 0 to 100 percent', 100], ['M', 'Magenta, 0 to 100 percent', 100], ['Y', 'Yellow, 0 to 100 percent', 100], ['K', 'Key/black, 0 to 100 percent', 100]];
      spec.forEach(([tag, name, max]) => {
        const lab = el('label', 'org-cpick__num');
        lab.innerHTML = '<span class="org-cpick__tag">' + tag + '</span>';
        const i = el('input', 'panel-input', { type: 'number', min: '0', max: String(max), step: '1', 'aria-label': name });
        lab.appendChild(i);
        els.fields.appendChild(lab);
      });
    }
    els.fields.className = 'org-cpick__fields' + (mode === 'hex' ? '' : ' org-cpick__nums');
    const name = MODES.find(m => m[0] === mode)[1];
    els.modeBtn.innerHTML = '<span>' + name + '</span>' + ico('chevron-down', { size: 'sm', cls: 'chev' });
    els.modeBtn.setAttribute('aria-label', 'Values: ' + name);
    els.copy.setAttribute('aria-label', 'Copy ' + name + ' value');
    els.modeMenu.querySelectorAll('.org-cpick__opt').forEach(o => o.setAttribute('aria-selected', String(o.dataset.mode === mode)));
    writeFields(hexOf());
  }
  function readFields() {
    const inputs = [...els.fields.querySelectorAll('input')];
    if (mode === 'hex') {
      let t = inputs[0].value.trim(); if (t && t[0] !== '#') t = '#' + t;
      if (/^#[0-9a-f]{3}$/i.test(t)) t = '#' + t.slice(1).split('').map(c => c + c).join('');
      return /^#[0-9a-f]{6}$/i.test(t) ? t.toLowerCase() : null;
    }
    if (inputs.some(i => i.value === '')) return null;
    const n = inputs.map(i => +i.value || 0);
    if (mode === 'rgb') return Organica.rgbToHex(clamp(n[0], 0, 255), clamp(n[1], 0, 255), clamp(n[2], 0, 255)).toLowerCase();
    const rgb = Organica.cmykToRgb(clamp(n[0], 0, 100), clamp(n[1], 0, 100), clamp(n[2], 0, 100), clamp(n[3], 0, 100));
    return Organica.rgbToHex(rgb.r, rgb.g, rgb.b).toLowerCase();
  }
  function paintTop() {
    els.recent.innerHTML = '';
    const r = recent();
    els.recentLabel.hidden = !r.length && els.pals.hidden;
    r.forEach(hex => els.recent.appendChild(swatchBtn(hex, hex.toUpperCase())));
    if (!r.length) { const p = el('span', 'org-cpick__empty'); p.textContent = 'No recent colours yet'; els.recent.appendChild(p); }
  }
  function swatchBtn(hex, name) {
    const b = el('button', 'color-swatch org-cpick__swatch', { type: 'button', 'aria-label': name });
    b.style.background = hex;
    b.dataset.hex = hex;
    return b;
  }
  function paintPalettes() {
    els.pals.innerHTML = '';
    const lib = Organica.palette && Organica.palette.library ? Organica.palette.library() : [];
    lib.forEach(pal => {
      const name = el('div', 'org-cpick__palname'); name.textContent = pal.name;
      const row = el('div', 'org-cpick__swatches');
      pal.colors.forEach(c => row.appendChild(swatchBtn(c.hex, (c.name ? c.name + ' ' : '') + c.hex.toUpperCase())));
      els.pals.append(name, row);
    });
  }

  // ── emit ──
  function emitInput(hex) { if (opts.onInput) opts.onInput(hex); }
  function emitChange(hex) {
    if (hex === committed) return;
    committed = hex;
    if (opts.onChange) opts.onChange(hex);
  }
  function setHex(hex, commit) {
    fromHex(hex);
    const out = paint();
    emitInput(out);
    if (commit) emitChange(out);
  }

  // ── interaction ──
  function svAt(e) {
    const r = els.sv.getBoundingClientRect();
    s = clamp((e.clientX - r.left) / r.width, 0, 1) * 100;
    v = (1 - clamp((e.clientY - r.top) / r.height, 0, 1)) * 100;
    emitInput(paint());
  }
  function hueAt(e) {
    const r = els.hue.getBoundingClientRect();
    h = clamp((e.clientX - r.left) / r.width, 0, 1) * 360;
    emitInput(paint());
  }
  function dragOn(target, fn) {
    target.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      target.focus();
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* a pointer the browser no longer tracks — the drag still works inside the target */ }
      dragging = fn; fn(e);
    });
    target.addEventListener('pointermove', e => { if (dragging === fn) fn(e); });
    const end = e => { if (dragging !== fn) return; dragging = null; try { if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ } emitChange(hexOf()); };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }
  function keyOn(target, fn) {
    target.addEventListener('keydown', e => {
      const step = e.shiftKey ? 10 : 1;
      if (!fn(e.key, step)) return;
      e.preventDefault();
      const hex = paint(); emitInput(hex); emitChange(hex);
    });
  }
  function closeMenu() { els.modeMenu.hidden = true; els.modeBtn.setAttribute('aria-expanded', 'false'); }

  function wire() {
    dragOn(els.sv, svAt);
    dragOn(els.hue, hueAt);
    keyOn(els.sv, (k, st) => {
      if (k === 'ArrowLeft') s = clamp(s - st, 0, 100);
      else if (k === 'ArrowRight') s = clamp(s + st, 0, 100);
      else if (k === 'ArrowUp') v = clamp(v + st, 0, 100);
      else if (k === 'ArrowDown') v = clamp(v - st, 0, 100);
      else return false;
      return true;
    });
    keyOn(els.hue, (k, st) => {
      if (k === 'ArrowLeft' || k === 'ArrowDown') h = clamp(h - st, 0, 360);
      else if (k === 'ArrowRight' || k === 'ArrowUp') h = clamp(h + st, 0, 360);
      else if (k === 'Home') h = 0;
      else if (k === 'End') h = 360;
      else return false;
      return true;
    });

    // fields: live while typing a whole value, committed on leave / Enter
    els.fields.addEventListener('input', () => {
      const hex = readFields();
      if (!hex) return;
      fromHex(hex); paint(true); emitInput(hexOf());
    });
    els.fields.addEventListener('change', () => { const hex = readFields(); if (hex) setHex(hex, true); else writeFields(hexOf()); });
    els.fields.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const hex = readFields(); if (hex) setHex(hex, true); } });
    // paste any CSS colour in the hex field (P8)
    els.fields.addEventListener('paste', e => {
      if (mode !== 'hex') return;
      const t = (e.clipboardData && e.clipboardData.getData('text') || '').trim();
      const probe = document.createElement('span'); probe.style.color = t;
      if (!t || !probe.style.color || /^#?[0-9a-f]{3,6}$/i.test(t)) return;   // a plain hex pastes as text
      e.preventDefault();
      document.body.appendChild(probe);
      const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g); probe.remove();
      if (m) setHex(Organica.rgbToHex(+m[0], +m[1], +m[2]).toLowerCase(), true);
    });

    // recent + palettes: a click picks and commits
    root.addEventListener('click', e => {
      const sw = e.target.closest('.org-cpick__swatch');
      if (sw && root.contains(sw)) setHex(Organica.normalizeHex(sw.dataset.hex, hexOf()), true);
    });
    els.palBtn.addEventListener('click', () => {
      const on = els.pals.hidden;
      if (on) paintPalettes();
      els.pals.hidden = !on;
      els.palBtn.setAttribute('aria-expanded', String(on));
      paintTop();
      position();
    });

    // mode menu
    els.modeBtn.addEventListener('click', () => {
      const on = els.modeMenu.hidden;
      els.modeMenu.hidden = !on;
      els.modeBtn.setAttribute('aria-expanded', String(on));
      if (on) { const cur = els.modeMenu.querySelector('[aria-selected="true"]'); (cur || els.modeMenu.firstChild).focus(); }
    });
    els.modeMenu.addEventListener('click', e => {
      const o = e.target.closest('.org-cpick__opt'); if (!o) return;
      mode = o.dataset.mode; store(MODE_KEY, mode);
      closeMenu(); buildFields(); els.modeBtn.focus();
    });
    els.modeMenu.addEventListener('keydown', e => {
      const it = [...els.modeMenu.children], i = it.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (it[i + 1] || it[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (it[i - 1] || it[it.length - 1]).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); els.modeBtn.focus(); }
    });

    // eyedropper (Chromium only; the button is hidden elsewhere)
    els.drop.addEventListener('click', () => {
      if (!('EyeDropper' in global)) return;
      new global.EyeDropper().open().then(r => { if (r && r.sRGBHex) setHex(Organica.normalizeHex(r.sRGBHex, hexOf()), true); }, () => {});
    });
    // copy the value as the current mode shows it
    els.copy.addEventListener('click', () => {
      const text = valueText(hexOf(), mode), b = els.copy, label = b.getAttribute('aria-label');
      const done = () => {
        b.innerHTML = ico('check', { size: 'sm' }); b.setAttribute('aria-label', 'Copied');
        setTimeout(() => { b.innerHTML = ico('copy', { size: 'sm' }); b.setAttribute('aria-label', label); }, 1200);
      };
      if (global.navigator.clipboard) global.navigator.clipboard.writeText(text).then(done, () => {});
    });

    // closing: outside, Escape, another dropdown, resize, a scroll outside
    document.addEventListener('pointerdown', e => {
      if (!open) return;
      if (!els.modeMenu.hidden && !els.modeMenu.contains(e.target) && e.target !== els.modeBtn && !els.modeBtn.contains(e.target)) closeMenu();
      if (root.contains(e.target) || (anchor && anchor.contains(e.target))) return;
      close(false);
    }, true);
    document.addEventListener('keydown', e => { if (open && e.key === 'Escape' && els.modeMenu.hidden) { e.preventDefault(); close(true); } });
    document.addEventListener('organica:dropdown-open', e => { if (open && e.detail !== root) close(false); });
    global.addEventListener('resize', () => { if (open) position(); });
    document.addEventListener('scroll', e => { if (open && !root.contains(e.target)) close(false); }, true);
  }

  function position() {
    if (!anchor || !root) return;
    const t = anchor.getBoundingClientRect(), gap = 6, margin = 12;
    const w = root.offsetWidth, hgt = root.offsetHeight;
    const left = clamp(t.left, margin, global.innerWidth - margin - w);
    const below = global.innerHeight - t.bottom - margin;
    const top = (below >= hgt + gap || below >= t.top - margin) ? t.bottom + gap : t.top - gap - hgt;
    root.style.left = left + 'px';
    root.style.top = clamp(top, margin, Math.max(margin, global.innerHeight - margin - hgt)) + 'px';
  }

  function openPicker(a, o) {
    if (!root) build();
    if (open && anchor === a) { close(true); return api(); }   // a second click on the same colour closes it
    if (open) close(false);
    anchor = a; opts = o || {};
    document.dispatchEvent(new CustomEvent('organica:dropdown-open', { detail: root }));
    const hex = Organica.normalizeHex(opts.value || '#888888', '#888888').toLowerCase();
    committed = hex;
    mode = MODES.some(m => m[0] === store(MODE_KEY)) ? store(MODE_KEY) : 'hex';
    fromHex(hex);
    root.setAttribute('aria-label', opts.label ? opts.label + ' colour' : 'Colour');
    els.pals.hidden = true; els.palBtn.setAttribute('aria-expanded', 'false');
    closeMenu();
    buildFields(); paintTop(); paint();
    root.hidden = false; root.dataset.open = 'true'; open = true;
    if (anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');
    position();
    els.sv.focus({ preventScroll: true });
    return api();
  }
  function close(returnFocus) {
    if (!open) return;
    open = false; dragging = null;
    root.hidden = true; root.dataset.open = 'false';
    const hex = hexOf();
    if (committed && hex !== committed) emitChange(hex);   // a value still being typed is kept
    if (committed) pushRecent(committed);
    if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'false');
    if (returnFocus && anchor && anchor.isConnected) anchor.focus();
  }
  function api() { return { close: () => close(true), set: hex => { fromHex(hex); committed = hexOf(); paint(); } }; }

  // drive(button, input, {label}) — a hand-built swatch (a .color-swatch button + a hidden
  // native <input type=color>, outside Organica.palette) opens this picker; the native input
  // stays the value holder and still fires its own 'input' / 'change', so the tool's listeners
  // are untouched. The input leaves the tab order and stops catching clicks.
  function drive(button, input, o) {
    if (!button || !input || button.__orgPicker) return;
    button.__orgPicker = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.pointerEvents = 'none';
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      openPicker(button, {
        value: input.value,
        label: (o && o.label) || null,
        onInput: hex => { if (hex === input.value) return; input.value = hex; input.dispatchEvent(new Event('input', { bubbles: true })); },
        onChange: () => input.dispatchEvent(new Event('change', { bubbles: true })),
      });
    });
  }

  // EVERYWHERE (Diego, Nov 17, 2026): any native <input type=color> left on a page that loads
  // this file — a tool's own hand-built field (FVS Variants, a cell's Custom colour …) —
  // opens this picker instead of the browser's. The input stays the value holder and fires its
  // own 'input' / 'change'. data-picker="native" on the input keeps the browser's picker.
  document.addEventListener('click', e => {
    const inp = e.target && e.target.closest && e.target.closest('input[type=color]');
    if (!inp || inp.disabled || inp.dataset.picker === 'native' || (root && root.contains(inp))) return;
    e.preventDefault();
    const name = (inp.getAttribute('aria-label') || '').replace(/\s+(colou?r|value)$/i, '').replace(/\s+colou?r$/i, '');
    openPicker(inp, {
      value: inp.value,
      label: name || null,
      onInput: hex => { if (hex === inp.value) return; inp.value = hex; inp.dispatchEvent(new Event('input', { bubbles: true })); },
      onChange: () => inp.dispatchEvent(new Event('change', { bubbles: true })),
    });
  }, true);

  Organica.colorPicker = {
    open: openPicker,
    drive: drive,
    close: () => close(false),
    isOpen: () => open,
    recent: recent,
    nearestRal: nearestRal,
    valueText: valueText,
  };
})(typeof window !== 'undefined' ? window : this);
