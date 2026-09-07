/* ─────────────────────────────────────────────────────────────
   plate-export.js — generalizes Colornet's own per-channel PNG loop
   (exportSeparations) into "N discrete outputs → N staggered downloads",
   reusable by any tool that can enumerate N atomic plates and build each
   one's Blob on demand. Extracted at the 2nd+3rd real consumer (Pollen,
   Spore) alongside Colornet (1st) — this repo's own "extract at the
   second consumer" convention (pollen-engine.js, radial.js, shapes.js).

   Plain classic script (IIFE → window.Organica.plateExport), same shape
   as every other shared/*.js file.

   LOAD ORDER: core.js → print-size.js → print-size-panel.js →
   plate-export.js → tool script. Needs Organica.download (core.js).
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  Organica.plateExport = {
    // count: number of plates. opts.build(i) → {blob, filename} — or a
    // Promise of one, for a plate whose export needs async work (e.g.
    // embedding a PNG pHYs chunk via Blob.arrayBuffer()) — or null/
    // undefined to skip an empty/degenerate plate without downloading a
    // blank file. opts.stagger (ms, default 220 — browsers drop bursts
    // of simultaneous downloads, the same reasoning Colornet's original
    // exportSeparations loop already used). opts.onDone() fires once
    // every plate has resolved (order-independent).
    run: function (count, opts) {
      opts = opts || {};
      const stagger = opts.stagger != null ? opts.stagger : 220;
      let done = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(function (idx) {
          Promise.resolve(opts.build(idx)).then(function (r) {
            if (r) Organica.download(r.blob, r.filename);
            done++;
            if (done === count && opts.onDone) opts.onDone();
          });
        }.bind(null, i), i * stagger);
      }
    },
  };
})(typeof window !== 'undefined' ? window : this);
