/* pattern-init.js — applies the saved canvas pattern before first paint.
   Loaded synchronously in <head> so the dots never flash before the choice.
   The switcher itself (4 circles in the header) lives in shared/header.js. */
(function () {
  try {
    var v = localStorage.getItem('organica.ui.canvas-pattern');
    if (v === 'grid' || v === 'lines' || v === 'plain') document.documentElement.setAttribute('data-canvas-pattern', v);
  } catch (e) { /* storage blocked — default dots */ }
})();
