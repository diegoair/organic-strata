// Flexible Visual System · 00-core — State, palette and colour rules — the shared state object every other file reads.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import { rt } from './rt.js';
import { hooks } from './hooks.js';
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, PALETTE_MAX, cellOwnInks, colorRuleCR, ruleInk, state
} from './engine/00-core.js';
import {
  componentCellColRow
} from './engine/04-appearance.js';
import {
  hexKey
} from './engine/07-library.js';
import {
  getSymbolGrid
} from './engine/08-symbol-grid.js';
import {
  cellColRow
} from './engine/11-symbol-ui.js';
/* ─────────────────────────────────────────────────────────────
   FVS — Flexible Visual System. First pass: Seeds → Components only
   (the Symbols/Pattern/Applications tiers from the reference brief are
   later phases, not built here).

   One canonical array of "items" (cx, cy, rotation, flipH, flipV, scale)
   per component feeds BOTH the canvas raster export and the SVG string —
   same discipline as vortex/js/render.js + svgexport.js: identical
   transform math in both places, so nothing can visually disagree
   between preview/PNG/SVG.
   ───────────────────────────────────────────────────────────── */

export function ctrl(id) { return document.getElementById(id); }
export function val(id) { return parseFloat(ctrl(id).value); }

export const setStatus = Organica.status();

// Screen/Print output mode — shared/print-size-panel.js. Screen (default)
// is today's Scale-multiplier export, untouched; Print reveals a real
// physical size + DPI + bleed. Title says "(selection)" — FVS's "trim" is
// the selected component's own square frame, not a whole canvas, so the
// export is always scoped to whatever's picked in the gallery.
export const printSizePanel = Organica.printSizePanel(document.getElementById('print-size-host'), {
  idPrefix: 'ps',
  title: 'Print (selection)',
  onChange: () => {
    document.getElementById('screen-scale-rows').style.display = printSizePanel.getMode() === 'print' ? 'none' : '';
  },
});

rt.tilePicker = null;


state.colorRule = { ...DEFAULT_COLOR_RULE };
// A Symbol cell's ink. `color: null` = follow the palette (what new cells
// store). A stored colour equal to the palette entry for that index — how
// older saves wrote it — is treated the same, so recolouring the palette
// recolours those cells too; any other stored colour is a real override.
export let _symCR = { key: null, rule: null, cr: null };
export function symbolCR() {
  const g = state.symbolGrid, r = state.colorRule.mode;
  if (_symCR.key !== g || _symCR.rule !== r) _symCR = { key: g, rule: r, cr: (r === 'index' || r === 'own') ? null : colorRuleCR(getSymbolGrid(), state.colorRule) };
  return _symCR.cr;
}
export function cellInk(cell, i) {
  const own = cellOwnInks(cell);
  const p = own ? own[0] : ruleInk(i, symbolCR());
  // null = follow the palette; anything else is an explicit override set in Cell properties
  // (legacy colours that merely pinned the palette value are released when a saved Symbol loads).
  return cell.color ? cell.color : p;
}

export function buildPalette() {
  Organica.palette.swatch(ctrl('fvs-palette'), {
    colors: state.colors,
    min: 1,
    max: PALETTE_MAX,
    onChange: (colors) => {
      state.colors = colors.map(hexKey);
      syncColorRuleUI();
      hooks.syncGroundInkOptions();
      refreshColourViews();
    },
  });
  hooks.syncGroundInkOptions();
}

export function syncColorRuleUI() {
  const sel = ctrl('sel-color-rule'), off = ctrl('sel-color-offset');
  if (!sel.options.length) Object.entries(COLOR_RULES).forEach(([k, v]) => sel.add(new Option(v.label, k)));
  const n = Math.max(1, state.colors.length);
  off.innerHTML = '';
  for (let i = 0; i < n; i++) off.add(new Option('Colour ' + (i + 1), i));
  sel.value = state.colorRule.mode;
  off.value = String(Math.min(state.colorRule.offset || 0, n - 1));
  ctrl('row-color-offset').style.display = n < 2 ? 'none' : '';
  syncQuadrantHint();
}
// "By quadrant" splits the grid at its middle; with an odd number of columns
// or rows the middle line runs through a cell, which is documented behaviour
// (that cell joins the second half) — so it is only flagged, never changed.
export function syncQuadrantHint() {
  let odd = false;
  if (state.colorRule.mode === 'quadrant') {
    try {
      const cr = state.activeTier === 'symbol' ? (state.symbolGrid ? cellColRow(getSymbolGrid()) : []) : componentCellColRow(hooks.getGrid());
      if (cr.length) odd = (Math.max(...cr.map(c => c.col)) + 1) % 2 === 1 || (Math.max(...cr.map(c => c.row)) + 1) % 2 === 1;
    } catch (e) { odd = false; }
  }
  ctrl('color-quadrant-hint').style.display = odd ? '' : 'none';
}
export function refreshColourViews() {
  hooks.renderGallery();
  hooks.renderSeedPreview();
  if (state.symbolGrid) hooks.renderSymbolCanvasOnly();
}
export function onColorRuleChange() {
  state.colorRule = { mode: ctrl('sel-color-rule').value, offset: parseInt(ctrl('sel-color-offset').value, 10) || 0 };
  syncColorRuleUI();
  refreshColourViews();
}
