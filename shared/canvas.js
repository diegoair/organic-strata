/* ═══════════════════════════════════════════════════════════
   ORGANICA — canvas.js
   The shared canvas/stage layer — home for what shell.css (the
   markup: #canvas-wrap, .org-stage, #zoom-hud) and core.js's
   createZoomPan (the raw wheel/drag zoom math) don't yet own: the
   wiring between them.

   "Canvas Surface Audit" (Sep 2026) found the same ~6-line onChange
   block duplicated near-verbatim in 6 tools (Halide, Spore, Pollen,
   Colornet, Mote, Membrane) — each reading zoom state back off
   createZoomPan and writing it into #zoom-level's text, #zoom-hud's
   .visible class, and the canvas's own .zoomed class, by hand.
   Organica.canvasZoomHud() is that block, written once.

   Tools with real bespoke needs on top of the HUD (Living Path/
   Apostate syncing an overlay's position, Trellis suppressing the
   HUD entirely) still pass their own onChange — it runs AFTER the
   HUD update, not instead of it. Camo Turing's transient auto-hide
   zoom badge is a deliberately different pattern, not a copy of this
   one, and is left as-is.

   Load AFTER core.js (needs Organica.createZoomPan), BEFORE the
   tool's own script. No CSS of its own.

   First of four items on the audit's closing agenda:
     1. zoom/pan → DOM wiring     ← this file
     2. DPR-aware sizing          deferred
     3. surface mounting          deferred
     4. multi-surface patterns    deferred
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  if (!window.Organica) window.Organica = {};

  function resolveEl(ref, fallbackId) {
    if (ref === null) return null; // explicit opt-out
    if (ref === undefined) return fallbackId ? document.getElementById(fallbackId) : null;
    return typeof ref === 'string' ? document.getElementById(ref) : ref;
  }

  // Organica.canvasZoomHud({
  //   canvas, wrap,                 // same as createZoomPan
  //   hud, level, resetEl,          // id string | element | null to suppress; default #zoom-hud / #zoom-level / (none)
  //   zoomedClass = 'zoomed',
  //   hudVisible(state),            // default: state.zoomed. Override when the HUD needs an
  //                                 // extra guard — e.g. Halide/Spore/Pollen only show it once
  //                                 // an image is actually loaded, not just because zoomed=true
  //                                 // lingers from before the canvas went blank again.
  //   onChange,                     // your own extra logic — runs after the HUD update
  //   ...isReady/min/max/panAlways  // passed straight through to createZoomPan
  // }) → the same { zoomBy, reset, apply, zoom, pan } createZoomPan returns.
  Organica.canvasZoomHud = function (opts) {
    const {
      canvas, wrap = canvas.parentElement,
      hud, level, resetEl,
      zoomedClass = 'zoomed',
      hudVisible = (state) => state.zoomed,
      onChange,
      ...rest
    } = opts;

    const hudEl = resolveEl(hud, 'zoom-hud');
    const levelEl = resolveEl(level, 'zoom-level');
    const resetElResolved = resolveEl(resetEl, null);

    const zp = Organica.createZoomPan({
      canvas,
      wrap,
      ...rest,
      onChange(state) {
        if (levelEl) levelEl.textContent = Math.round(state.zoom * 100) + '%';
        if (hudEl) hudEl.classList.toggle('visible', hudVisible(state));
        canvas.classList.toggle(zoomedClass, state.zoomed);
        if (onChange) onChange(state);
      },
    });

    if (resetElResolved) resetElResolved.addEventListener('click', () => zp.reset());
    return zp;
  };

  // Organica.canvasDropZone({ wrap, dropIcon, fileInput, accept, onFile }) —
  // the click-to-open + dragover/dragleave/drop wiring found byte-near-
  // identical in Halide/Spore/Pollen. Intentionally narrow: matches those
  // three exactly (first dropped file only, type-checked, synthesized into
  // `fileInput.files` so a tool's existing loadX(input) keeps working
  // unchanged) rather than trying to also cover Colornet's own multi-file
  // batch drop or Mote's video-file drop — both real, deliberately
  // different shapes, left as their own local wiring.
  //
  //   wrap       — id string | element, the drop target (gets .drag-over)
  //   dropIcon   — id string | element | CSS selector string | null; the
  //                click-to-open affordance (omit if there isn't one)
  //   fileInput  — id string | element, the hidden <input type="file">
  //   accept     — MIME-type prefix to match, default 'image/'
  //   onFile(fileInput) — called once the dropped file is in fileInput.files
  Organica.canvasDropZone = function (opts) {
    const { wrap, dropIcon, fileInput, accept = 'image/', onFile } = opts;

    const wrapEl = typeof wrap === 'string' ? document.getElementById(wrap) : wrap;
    const inputEl = typeof fileInput === 'string' ? document.getElementById(fileInput) : fileInput;
    const iconEl = dropIcon == null
      ? null
      : (typeof dropIcon === 'string'
          ? (document.getElementById(dropIcon) || document.querySelector(dropIcon))
          : dropIcon);

    if (iconEl) {
      iconEl.addEventListener('click', (e) => {
        e.stopPropagation();
        inputEl.click();
      });
    }

    wrapEl.addEventListener('dragover', (e) => { e.preventDefault(); wrapEl.classList.add('drag-over'); });
    wrapEl.addEventListener('dragleave', () => wrapEl.classList.remove('drag-over'));
    wrapEl.addEventListener('drop', (e) => {
      e.preventDefault();
      wrapEl.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith(accept)) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      inputEl.files = dt.files;
      if (onFile) onFile(inputEl);
    });
  };
})();
