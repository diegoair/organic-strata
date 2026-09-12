/* ─────────────────────────────────────────────────────────────
   canvas-size-panel.js — the shared "Canvas" panel section: a
   preset dropdown plus Width/Height fields. Screen-only, on
   purpose — shared/print-size-panel.js already owns the heavier
   Screen/Print + unit/DPI/bleed case for tools with a real print
   production path. This one is for the plainer "what pixel/unit
   size does the exported document come out at" question.

   ── Organica.canvasSizePanel(target, opts) → panel ──────────────
   target: an element to attach into (its innerHTML is replaced).
   opts:
     idPrefix   required — every built control gets id `${idPrefix}-*`.
     title      default 'Canvas'.
     hint       default '' — small label text next to the title,
                matching the `<h3>Canvas <span class="hint">…</span>`
                convention already used elsewhere (e.g. Loom's own
                bespoke canvas panel: "the physical space").
     presets    default DEFAULT_PRESETS — [{label,width,height}, …].
     defaultWidth / defaultHeight   default: the first preset's own
                size.
     onChange(state)   called on any preset/field change, with
                {width, height, presetLabel}.
   panel (returned):
     getSize() → {width, height}
     setSize(w, h)   also resyncs the preset dropdown (falls to
                "Custom…" when the pair doesn't match any preset).
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const DEFAULT_PRESETS = [
    { label: 'Square', width: 1000, height: 1000 },
    { label: 'Landscape 16:9', width: 1920, height: 1080 },
    { label: 'Portrait 4:5', width: 1080, height: 1350 },
    { label: 'Widescreen 3:2', width: 1620, height: 1080 },
  ];

  Organica.canvasSizePanel = function (target, opts) {
    opts = opts || {};
    const idPrefix = opts.idPrefix;
    if (!idPrefix) throw new Error('canvasSizePanel: opts.idPrefix is required');
    const title = opts.title || 'Canvas';
    const hint = opts.hint || '';
    const presets = opts.presets || DEFAULT_PRESETS;
    const onChange = opts.onChange || function () {};
    const id = function (suffix) { return idPrefix + '-' + suffix; };

    let width = opts.defaultWidth || presets[0].width;
    let height = opts.defaultHeight || presets[0].height;

    function matchingPreset(w, h) {
      const found = presets.find(function (p) { return p.width === w && p.height === h; });
      return found ? found.label : '__custom__';
    }

    const presetOptions = presets.map(function (p) {
      return '<option value="' + p.label + '">' + p.label + ' (' + p.width + '×' + p.height + ')</option>';
    }).join('') + '<option value="__custom__">Custom…</option>';

    target.innerHTML =
      '<div class="panel-section">' +
        '<h3>' + title + (hint ? ' <span class="hint">' + hint + '</span>' : '') + '</h3>' +
        '<div class="ctrl-row">' +
          '<select class="panel-select" id="' + id('preset') + '" aria-label="Canvas preset" style="width:100%">' + presetOptions + '</select>' +
        '</div>' +
        '<div class="ctrl-row">' +
          '<div class="ctrl-label">Width</div>' +
          '<input type="number" class="panel-input" id="' + id('width') + '" value="' + width + '" min="1" step="1" aria-label="Width" style="width:100%">' +
        '</div>' +
        '<div class="ctrl-row">' +
          '<div class="ctrl-label">Height</div>' +
          '<input type="number" class="panel-input" id="' + id('height') + '" value="' + height + '" min="1" step="1" aria-label="Height" style="width:100%">' +
        '</div>' +
      '</div>';

    const presetEl = document.getElementById(id('preset'));
    const widthEl = document.getElementById(id('width'));
    const heightEl = document.getElementById(id('height'));
    presetEl.value = matchingPreset(width, height);

    function fire() {
      onChange({ width: width, height: height, presetLabel: presetEl.value });
    }

    presetEl.addEventListener('change', function () {
      if (presetEl.value === '__custom__') return; // keep whatever width/height are already set
      const p = presets.find(function (pp) { return pp.label === presetEl.value; });
      if (!p) return;
      width = p.width; height = p.height;
      widthEl.value = width; heightEl.value = height;
      fire();
    });
    [widthEl, heightEl].forEach(function (el) {
      ['input', 'change'].forEach(function (evt) {
        el.addEventListener(evt, function () {
          width = parseFloat(widthEl.value) || width;
          height = parseFloat(heightEl.value) || height;
          presetEl.value = matchingPreset(width, height);
          fire();
        });
      });
    });

    if (Organica.autoLabelPanel) Organica.autoLabelPanel(target);

    return {
      getSize: function () { return { width: width, height: height }; },
      setSize: function (w, h) {
        width = w; height = h;
        widthEl.value = w; heightEl.value = h;
        presetEl.value = matchingPreset(w, h);
      },
    };
  };
})(typeof window !== 'undefined' ? window : this);
