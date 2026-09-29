/* pattern-init.js — applies the saved canvas pattern (and, on pages that opt in
   with <html data-theme-support>, the saved dark theme) before first paint.
   Loaded synchronously in <head> so the dots never flash before the choice.
   The switcher itself (4 circles in the header) lives in shared/header.js. */
(function () {
  try {
    var v = localStorage.getItem('organica.ui.canvas-pattern');
    if (v === 'grid' || v === 'lines' || v === 'plain') document.documentElement.setAttribute('data-canvas-pattern', v);
    var root = document.documentElement;
    if (root.hasAttribute('data-theme-support') && localStorage.getItem('organica.ui.theme') === 'dark') root.setAttribute('data-theme', 'dark');
  } catch (e) { /* storage blocked — default dots, light */ }
})();
