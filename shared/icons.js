/* Organica.icons — the one icon registry (Oct 2, 2026).
 *
 * Every chrome icon in the suite is drawn on a 16×16 grid (live area 2–14), stroked
 * with currentColor, styled ONLY by .ico in shared/icons.css (stroke weight =
 * --icon-stroke, size = --icon-* tokens). A drawing exists once, here.
 *
 *   Organica.icons.get('download')             → '<svg class="ico" data-icon="download" …>…</svg>'
 *   Organica.icons.get('plus', {size:'sm'})    → size modifier: xs · sm · md · lg · xl
 *   Organica.icons.get('close', {cls:'x'})     → extra classes
 *   Organica.icons.mount(root)                 → fills every <i data-icon="name"> placeholder
 *   Organica.icons.register('mine', '<path …/>', {fill:true})   → a tool-local extension
 *
 * Static HTML may carry the markup inline (no flash, no JS needed): keep the
 * data-icon attribute, and scripts/check.py verifies the drawing still equals the
 * registry. Filled shapes carry fill="currentColor" stroke="none" themselves.
 * NOT here: the 26-grid thumbnail pictograms (seeds, generators, aspect icons),
 * export serialisers, the Google logo, <menu-icon>.
 * Load AFTER core.js (which creates window.Organica), BEFORE header.js. */
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};
  var F = ' fill="currentColor" stroke="none"';   // marks a filled element
  var DL = '<path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11"/>';
  var DICE = '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><circle cx="5.5" cy="5.5" r=".9"' + F + '/><circle cx="8" cy="8" r=".9"' + F + '/><circle cx="10.5" cy="10.5" r=".9"' + F + '/>';
  var EYE = '<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/>';

  var REG = {
    /* ── general ─────────────────────────────────────── */
    'plus':          '<path d="M8 3v10M3 8h10"/>',
    'minus':         '<path d="M3 8h10"/>',
    'close':         '<path d="M4 4l8 8M12 4l-8 8"/>',
    'check':         '<path d="M3.5 8.5l3 3 6-7"/>',
    'chevron-down':  '<path d="M4 6l4 4 4-4"/>',
    'chevron-up':    '<path d="M4 10l4-4 4 4"/>',
    'chevron-right': '<path d="M6 4l4 4-4 4"/>',
    'chevron-left':  '<path d="M10 4L6 8l4 4"/>',
    'arrow-up':      '<path d="M8 13V3M4.5 6.5 8 3l3.5 3.5"/>',
    'arrow-down':    '<path d="M8 3v10M4.5 9.5 8 13l3.5-3.5"/>',
    'arrow-right':   '<path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5"/>',
    'arrow-left':    '<path d="M13 8H3M6.5 4.5 3 8l3.5 3.5"/>',
    /* ── file / io ───────────────────────────────────── */
    'download':      '<path d="M8 2v7.2M5.3 6.7 8 9.4l2.7-2.7"/>' + DL,          // Export — save to file
    'upload':        '<path d="M8 9.2V2M5.3 4.7 8 2l2.7 2.7"/>' + DL,            // Import
    'folder-open':   '<path d="M1.5 4A1 1 0 0 1 2.5 3h2.8l1 1.3H13.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4Z"/>',   // Open a file / image
    'video':         '<rect x="2" y="4.5" width="8" height="7" rx="1"/><path d="m10 7 4-2v6l-4-2z"/>',
    /* ── history / run ───────────────────────────────── */
    'undo':          '<path d="M5.5 3 2.5 6l3 3"/><path d="M3 6h6.5a3.5 3.5 0 0 1 0 7H6"/>',
    'redo':          '<path d="M10.5 3l3 3-3 3"/><path d="M13 6H6.5a3.5 3.5 0 0 0 0 7H10"/>',
    'refresh':       '<path d="M13 8a5 5 0 1 1-1.6-3.65"/><path d="M13 2.3V6h-3.7"/>',   // clockwise — run again, reseed, replay
    'reset':         '<path d="M3 8a5 5 0 1 0 1.6-3.65"/><path d="M3 2.3V6h3.7"/>',      // counter-clockwise — back to defaults
    'loop':          '<path d="M3 8a5 5 0 0 1 8.5-3.5M13 8a5 5 0 0 1-8.5 3.5"/><path d="M11 2.5V5H8.5M5 13.5V11h2.5"/>',
    'dice':          DICE,
    'play':          '<path d="M5 3.5v9l7-4.5-7-4.5Z"' + F + '/>',
    'pause':         '<rect x="4" y="3.5" width="2.6" height="9" rx=".6"' + F + '/><rect x="9.4" y="3.5" width="2.6" height="9" rx=".6"' + F + '/>',
    'stop':          '<rect x="4" y="4" width="8" height="8" rx="1"' + F + '/>',
    /* ── edit ────────────────────────────────────────── */
    'trash':         '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/><path d="M6.7 7v4M9.3 7v4"/>',   // delete, permanently
    'eraser':        '<path d="M6.2 13.5 2.7 10a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0l3.2 3.2a1 1 0 0 1 0 1.4L8.5 13.5"/><path d="M6.5 13.5h7"/>',   // clear the canvas — not a bin
    'pencil':        '<path d="M10.5 2.5 13.5 5.5 6 13H3v-3l7.5-7.5Z"/>',
    'copy':          '<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>',
    'eye':           EYE + '<circle cx="8" cy="8" r="2"/>',
    'eye-off':       EYE + '<path d="M2.5 13.5l11-11"/>',
    'grip':          '<circle cx="6" cy="4" r="1.2"' + F + '/><circle cx="10" cy="4" r="1.2"' + F + '/><circle cx="6" cy="8" r="1.2"' + F + '/><circle cx="10" cy="8" r="1.2"' + F + '/><circle cx="6" cy="12" r="1.2"' + F + '/><circle cx="10" cy="12" r="1.2"' + F + '/>',
    'invert':        '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z"/>',
    /* ── views ───────────────────────────────────────── */
    'grid':          '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    'library':       '<path d="M3 3v10.5M5.75 3v10.5M8.5 3v10.5"/><path d="M10.4 3.6l2.8 9.6"/><path d="M2 13.5h12"/>',   // every saved item in one view (FVS Library) — not grid (= a layout of cells / the rail toggle)
    'fullscreen':    '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
    'full-family':   '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M8 2.5v11M2.5 8h11"/>',
    'generate':      '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M8 2.5v11M2.5 8h11"/><rect x="4" y="4" width="2.5" height="2.5" rx=".4"' + F + '/><rect x="9.5" y="9.5" width="2.5" height="2.5" rx=".4"' + F + '/>',   // fill a grid's cells for you (FVS Symbol Generate) — not refresh (= run again)
    'variations':    '<rect x="4.5" y="3.5" width="7" height="9" rx="1"/><path d="M2 5v6M14 5v6"/>',   // generated alternatives to pick from: one between its neighbours (FVS Symbol)
    'sun':           '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/>',
    'moon':          '<path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z"/>',
    'mirror':        '<path d="M8 2v12" stroke-dasharray="1.5 1.6"/><path d="M6.5 4.5 3 8l3.5 3.5zM9.5 4.5 13 8l-3.5 3.5z"/>',
    'align-left':    '<path d="M1 3.5h14M1 7h9M1 10.5h12"/>',
    'align-center':  '<path d="M1 3.5h14M3.5 7h9M2 10.5h12"/>',
    'align-right':   '<path d="M1 3.5h14M6 7h9M3 10.5h12"/>',
    /* ── node graph (Organica.nodeCanvas — ledger O-35 + G7, Oct 7, 2026) ── */
    'node-foundation': '<rect x="4" y="3" width="8" height="6" rx="1"/><path d="M2.5 12.5h11"/>',   // Foundation nodes (Canvas, Grid, Palette)
    'node-canvas':   '<rect x="3" y="2.5" width="10" height="11" rx="1"/><path d="M3 5.5h10"/>',   // a Canvas node: the page (pill head, node board)
    'palette':       '<rect x="2.5" y="5" width="3" height="6" rx=".6"/><rect x="6.5" y="5" width="3" height="6" rx=".6"/><rect x="10.5" y="5" width="3" height="6" rx=".6"/>',   // a palette: a row of colour chips — the Palette node AND "Pick from a palette" (Diego, Oct 8, 2026, option D; took that second meaning off grid)
    'node-element':   '<path d="M3 3A10 10 0 0 1 13 13H8A5 5 0 0 0 3 8z"/>',   // an Element node: one quarter-ring, the FVS arc mark (pill head)
    'node-component': '<path d="M3 3h4.5v4.5zM13 3v4.5H8.5zM13 13H8.5V8.5zM3 13V8.5h4.5z"/>',   // a Component node: one Element in four turns (pill head)
    'node-set':       '<rect x="2.5" y="6.5" width="11" height="7" rx="1"/><path d="M4 4.5h8M5.5 2.5h5"/>',   // a Set node: cards stacked in order — not copy, not library (pill head)
    'node-content':  '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M5 11l3-6 3 6z"/>',   // Content nodes (saved Element / Component / Symbol)
    'node-rule':     '<circle cx="4" cy="8" r="1.5"/><path d="M5.5 8h3l3-3.5M8.5 8l3 3.5"/>',   // Rule nodes
    'node-output':   '<rect x="2.5" y="4" width="8" height="8" rx="1"/><path d="M8 8h5.5M11.5 6l2 2-2 2"/>',   // Output nodes (Figure, Export)
    'fit-view':      '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',   // Fit all — the view, not "reset" (= defaults)
    'fit-selection': '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/><rect x="6" y="6" width="4" height="4" rx=".5"/>',
    'figure-from':   '<rect x="2.5" y="2.5" width="5" height="5" rx=".8"/><rect x="8.5" y="8.5" width="5" height="5" rx=".8"/><path d="M7.5 5h3.5v3.5"/><path d="M9.3 6.8 11 8.5l1.7-1.7"/>',   // New Figure from this (a variation → its own Figure) — not copy (= Duplicate)
    'pin':           '<path d="M6 2.5h4l-.5 4 2 2v1h-7v-1l2-2z"/><path d="M8 9.5v4"/>',   // Pin a variation (keeps its seed)
    'alert':         '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3"/><circle cx="8" cy="11.2" r=".7"' + F + '/>',   // a node error / something to look at
    'select-row':    '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><rect x="2.5" y="6.5" width="11" height="3"' + F + '/>',
    'select-column': '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><rect x="6.5" y="2.5" width="3" height="11"' + F + '/>',
    'select-class':  '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><rect x="3.5" y="3.5" width="3.5" height="3.5"' + F + '/><rect x="9" y="9" width="3.5" height="3.5"' + F + '/>',
    'select-range':  '<path d="M2.5 5V2.5H5M11 2.5h2.5V5M13.5 11v2.5H11M5 13.5H2.5V11"/><rect x="5.5" y="5.5" width="5" height="5"' + F + '/>',
    /* ── glyph editor (Apostate / Living Path) ───────── */
    'edit-points':   '<path d="M2.5 13.5 6 12l6.2-6.2a1.4 1.4 0 0 0 0-2L11.7 3.3a1.4 1.4 0 0 0-2 0L3.5 9.5l-1 4Z"/><circle cx="10.5" cy="4.8" r="1"/>',
    'add-point':     '<circle cx="8" cy="8" r="6" stroke-dasharray="2 2"/><path d="M8 5.5v5M5.5 8h5"/>',
    'handles':       '<path d="M3 12 8 4l5 8"/><circle cx="3" cy="12" r="1.4"/><circle cx="8" cy="4" r="1.4"/><circle cx="13" cy="12" r="1.4"/>',
    'outline':       '<rect x="3" y="3" width="10" height="10" rx="1.5"/>',
    'legible':       '<path d="M3 12V4M3 4h6M3 8h4.5"/><path d="M10.5 12V6.5c0-1 .6-1.5 1.5-1.5s1.5.5 1.5 1.5V12M10.5 9h3"/>',
    /* ── Living Path quick phrases / FVS layer roles ─── */
    'phrase-melt':   '<path d="M8 2.4c-2.6 3.5-4 5.6-4 7.6a4 4 0 0 0 8 0c0-2-1.4-4.1-4-7.6z"/>',
    'phrase-path':   '<path d="M2.5 12.5c2-.6 2.4-4 4.5-4s2.4 3.2 4.5 3.2 2-4.2 2-4.2"/><circle cx="2.6" cy="12.4" r="1.1"' + F + '/>',
    'phrase-rhizome':'<path d="M8 14V7.5M8 7.5 4.4 4M8 7.5l3.6-3.6M8 10.8 5.4 8.2"/>',
    'phrase-sprout': '<path d="M8 3v10M3 8h10M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8"/>',
    'role-fill':     '<circle cx="8" cy="8" r="5.5"' + F + '/>',
    'role-container':'<circle cx="8" cy="8" r="5.5"/><path d="M4.5 10.5l6-6M6 12l6-6M3.8 8.2l4.4-4.4"/>',
    'role-mask':     '<path fill-rule="evenodd" d="M2 2h12v12H2z M8 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z"' + F + '/>',
    'swap':          '<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>',
    'pattern':       '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M2.5 8.5l6-6M2.5 13.5l11-11M7.5 13.5l6-6"/>',
    'role-pattern':  '<path d="M2 6l4-4M2 10l8-8M2 14l12-12M6 14l8-8M10 14l4-4"/>',
    /* ── Flexible Visual System ──────────────────────── */
    'fvs-contain':   '<rect x="1.5" y="3.5" width="13" height="9" rx="1"/><circle cx="8" cy="8" r="2.6"/>',
    'fvs-fill':      '<rect x="1.5" y="3.5" width="13" height="9" rx="1"/><ellipse cx="8" cy="8" rx="4.4" ry="2.6"/>',
    'fvs-cover':     '<rect x="1.5" y="3.5" width="13" height="9" rx="1"/><path d="M4.67 3.5A5.6 5.6 0 0 0 4.67 12.5M11.33 3.5A5.6 5.6 0 0 1 11.33 12.5"/>',
    'fvs-fixed':     '<rect x="1.5" y="3.5" width="13" height="9" rx="1" stroke-dasharray="2 2.1"/><circle cx="8" cy="8" r="2"/>',
    'fvs-grid':      '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M6.17 2.5v11M9.83 2.5v11M2.5 6.17h11M2.5 9.83h11"/>',
    'fvs-clip':      '<rect x="3" y="3" width="10" height="10" rx="1"/><path d="M6.5 13A6.5 6.5 0 0 1 13 6.5"/>',
    'fvs-crop':      '<rect x="4" y="5" width="8" height="6" rx="1"/><circle cx="8" cy="8" r="6.2" stroke-dasharray="2 2.05"/>',
    'fvs-guides':    '<path d="M6 1.5v13M1.5 10h13" stroke-dasharray="2 2.1"/>',
    'fvs-cell-square':   '<rect x="3" y="3" width="10" height="10" rx="1"/>',
    'fvs-cell-circle':   '<circle cx="8" cy="8" r="5.5"/>',
    'fvs-cell-triangle': '<path d="M8 2.5 14 13H2z"/>',
    'fvs-cell-hexagon':  '<path d="M2 8 5 2.8h6L14 8l-3 5.2H5z"/>',
    'fvs-diamond':   '<path d="M1.5 12.5h8l5-9h-8z"/>',
    'fvs-match':     '<path d="M1.5 8 4.75 2.4h6.5L14.5 8l-3.25 5.6h-6.5z"/><path d="M5 8l1.5-2.6h3L11 8l-1.5 2.6h-3z"/>',
    'fvs-transparent': '<path d="M2 2h4v4H2zM10 2h4v4h-4zM6 6h4v4H6zM2 10h4v4H2zM10 10h4v4h-4z"/><rect x="2" y="2" width="12" height="12"/>'
  };
  var SIZES = { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 };

  function inner(name) { return REG[name]; }
  function get(name, o) {
    var d = REG[name];
    if (d == null) { if (global.console) console.warn('Organica.icons: unknown icon "' + name + '"'); return ''; }
    o = o || {};
    var cls = 'ico' + (SIZES[o.size] ? ' ico--' + o.size : '') + (o.cls ? ' ' + o.cls : '');
    var label = o.label ? ' role="img" aria-label="' + String(o.label).replace(/"/g, '&quot;') + '"' : ' aria-hidden="true"';
    return '<svg class="' + cls + '" data-icon="' + name + '" viewBox="0 0 16 16"' + label + '>' + d + '</svg>';
  }
  function register(name, markup) { REG[name] = markup; return Organica.icons; }
  function mount(root) {
    (root || document).querySelectorAll('i[data-icon], span[data-icon]').forEach(function (el) {
      var t = document.createElement('template');
      t.innerHTML = get(el.getAttribute('data-icon'), { size: el.getAttribute('data-size'), cls: el.getAttribute('class') || '' });
      if (t.content.firstChild) el.replaceWith(t.content.firstChild);
    });
  }
  Organica.icons = { get: get, inner: inner, register: register, mount: mount, names: function () { return Object.keys(REG); }, has: function (n) { return n in REG; } };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = REG;
})(typeof window !== 'undefined' ? window : globalThis);
