/* ─────────────────────────────────────────────────────────────
   print-size-panel.js — the shared "Output" panel section: an explicit
   Screen/Print mode switch, plus the unit/size/DPI/bleed controls that
   only matter once Print is picked.
   Paired with shared/print-size.js (the pure math) — this file is the
   one shared DOM piece, on the same "engine in shared/, orchestration
   stays local" split every other shared component uses.

   Why a shared PANEL and not just shared math: Print size is
   pixel-identical across every consumer landing in this same phase —
   same four controls, same show/hide-on-mode behaviour, every time.
   Unlike Palette (real per-tool variance — RMX vs single swatch) this
   control cluster has none, so it is built once here rather than
   copy-pasted into five tools and reconciled later.

   DESIGN: "Screen" vs "Print" is an explicit, always-visible mode
   choice (a .seg-ctrl), not a unit dropdown that silently grows extra
   fields — Diego's own correction to the first draft of this component.
   Screen is the default and shows nothing extra: existing screen-only
   export stays exactly as it was before this file existed. Print reveals
   unit (mm|in — no px here, Screen already owns px) + size + DPI +
   bleed.

   LOAD ORDER: core.js → print-size.js → print-size-panel.js → tool
   script. Needs Organica.printSize (mmToPx/pxToMm) and
   Organica.autoLabelPanel (core.js) for the dynamically-built controls'
   accessible names.

   ── Organica.printSizePanel(target, opts) → panel ──────────────────
   target: an element to attach into (its innerHTML is replaced).
   opts:
     idPrefix   required — every built control gets id `${idPrefix}-*`.
     title      default 'Output' — the section's h3 text. FVS passes
                'Output (selection)' since its trim is a selection
                bbox, not the whole canvas.
     defaultUnit  default 'mm'.
     onChange(state)   called on any field change/mode switch, with
                {mode, unit, width, height, dpi, bleed}.
   panel (returned):
     getMode() → 'screen' | 'print'
     getUnit() → 'mm' | 'in'
     getSize() → {width, height}   (in getUnit()'s unit)
     getDpi()  → number
     getBleed() → number (mm, always — the real print convention: a
                bleed spec doesn't change because the document happens
                to be quoted in a different unit, same reasoning
                loom/js/canvas-manager.js already documents)
     setPixelPreview(w, h)   updates a small "→ 1252 × 1252 px" hint
                under the fields, so picking a size/DPI shows its real
                pixel cost before export — purely informational, callers
                are not required to use it.
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  Organica.printSizePanel = function (target, opts) {
    opts = opts || {};
    const idPrefix = opts.idPrefix;
    if (!idPrefix) throw new Error('printSizePanel: opts.idPrefix is required');
    const title = opts.title || 'Output';
    const defaultUnit = opts.defaultUnit || 'mm';
    const onChange = opts.onChange || function () {};
    const id = function (suffix) { return idPrefix + '-' + suffix; };

    target.innerHTML =
      '<div class="panel-section">' +
        '<h3>' + title + '</h3>' +
        '<div class="ctrl-row">' +
          '<div class="ctrl-label">Mode</div>' +
          '<div class="seg-ctrl" id="' + id('mode') + '" role="group" aria-label="Output mode">' +
            '<button type="button" class="seg-btn active" aria-pressed="true" data-v="screen">Screen</button>' +
            '<button type="button" class="seg-btn" aria-pressed="false" data-v="print">Print</button>' +
          '</div>' +
        '</div>' +
        '<div class="ctrl-row" id="' + id('row-unit') + '" style="display:none">' +
          '<div class="ctrl-label">Unit</div>' +
          '<select class="panel-select" id="' + id('unit') + '" aria-label="Print unit">' +
            '<option value="mm">mm</option>' +
            '<option value="in">in</option>' +
          '</select>' +
        '</div>' +
        '<div class="ctrl-row" id="' + id('row-size') + '" style="display:none">' +
          '<div class="ctrl-label">Size</div>' +
          '<input type="number" class="panel-input" id="' + id('width') + '" value="100" min="1" step="0.5" aria-label="Width" style="width:100%">' +
          '<span class="hint" aria-hidden="true">&times;</span>' +
          '<input type="number" class="panel-input" id="' + id('height') + '" value="100" min="1" step="0.5" aria-label="Height" style="width:100%">' +
        '</div>' +
        '<div class="ctrl-row" id="' + id('row-dpi') + '" style="display:none">' +
          '<div class="ctrl-label">DPI</div>' +
          '<input type="number" class="panel-input" id="' + id('dpi') + '" value="300" min="72" step="1" aria-label="DPI" style="width:100%">' +
        '</div>' +
        '<div class="ctrl-row" id="' + id('row-bleed') + '" style="display:none">' +
          '<div class="ctrl-label" title="Always mm, regardless of the unit above — the real print convention: a bleed spec doesn\'t change because the document happens to be quoted in inches.">Bleed (mm)</div>' +
          '<input type="number" class="panel-input" id="' + id('bleed') + '" value="0" min="0" step="0.5" aria-label="Bleed in millimetres" style="width:100%">' +
        '</div>' +
        '<div class="hint" id="' + id('pxhint') + '" style="display:none"></div>' +
      '</div>';

    const modeCtrl = document.getElementById(id('mode'));
    const rowUnit = document.getElementById(id('row-unit'));
    const rowSize = document.getElementById(id('row-size'));
    const rowDpi = document.getElementById(id('row-dpi'));
    const rowBleed = document.getElementById(id('row-bleed'));
    const pxHint = document.getElementById(id('pxhint'));
    const unitEl = document.getElementById(id('unit'));
    const widthEl = document.getElementById(id('width'));
    const heightEl = document.getElementById(id('height'));
    const dpiEl = document.getElementById(id('dpi'));
    const bleedEl = document.getElementById(id('bleed'));
    unitEl.value = defaultUnit;

    let mode = 'screen';

    function state() {
      return {
        mode: mode,
        unit: unitEl.value,
        width: parseFloat(widthEl.value) || 0,
        height: parseFloat(heightEl.value) || 0,
        dpi: parseFloat(dpiEl.value) || 0,
        bleed: parseFloat(bleedEl.value) || 0,
      };
    }

    function syncRows() {
      const isPrint = mode === 'print';
      const disp = isPrint ? '' : 'none';
      rowUnit.style.display = disp;
      rowSize.style.display = disp;
      rowDpi.style.display = disp;
      rowBleed.style.display = disp;
      if (!isPrint) pxHint.style.display = 'none';
    }

    modeCtrl.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modeCtrl.querySelectorAll('.seg-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        mode = btn.dataset.v;
        syncRows();
        onChange(state());
      });
    });
    [unitEl, widthEl, heightEl, dpiEl, bleedEl].forEach(function (el) {
      el.addEventListener('input', function () { onChange(state()); });
      el.addEventListener('change', function () { onChange(state()); });
    });

    if (Organica.autoLabelPanel) Organica.autoLabelPanel(target);

    return {
      getMode: function () { return mode; },
      getUnit: function () { return unitEl.value; },
      getSize: function () { return { width: parseFloat(widthEl.value) || 0, height: parseFloat(heightEl.value) || 0 }; },
      getDpi: function () { return parseFloat(dpiEl.value) || 0; },
      getBleed: function () { return parseFloat(bleedEl.value) || 0; },
      setPixelPreview: function (w, h) {
        if (mode !== 'print') { pxHint.style.display = 'none'; return; }
        pxHint.textContent = '→ ' + Math.round(w) + ' × ' + Math.round(h) + ' px';
        pxHint.style.display = '';
      },
    };
  };
})(typeof window !== 'undefined' ? window : this);
