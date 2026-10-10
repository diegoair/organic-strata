// Flexible Visual System · 00-core — State, palette and colour rules — the shared state object every other file reads.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import { hooks } from './hooks.js';
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, PALETTE_MAX, pv, setFigurePristine, setPanelSource, state
} from './engine/00-core.js';
import {
  getGrid
} from './engine/03-rules.js';
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
setPanelSource({ value: id => ctrl(id).value, checked: id => ctrl(id).checked,
  read: id => { const el = ctrl(id); return el.type === 'checkbox' ? el.checked : el.value; } });
// The Figure evaluator's starting point (engine/00-core.js figurePristine): every control as it is at boot, and
// how a real control would hold a value set on it — asked of a detached copy, so nothing on screen changes.
export function captureFigurePristine() {
  const panel = new Map(), probes = new Map();
  document.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => panel.set(el.id, { value: el.value, checked: el.checked, type: el.type }));
  const sanitize = (id, v) => {
    let p = probes.get(id);
    if (!p) { const el = ctrl(id); if (!el) return String(v); p = el.cloneNode(true); probes.set(id, p); }
    p.value = v; return p.value;
  };
  setFigurePristine(panel, sanitize);
}

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

// "Each part the next ink" means something only while the Element is divided (or the rule is already on).
export function syncColorPartsRow() {
  const L = state.layers, divided = !!(L && L.parts) || !!(state.componentEditDefaultSeed && state.componentEditDefaultSeed.parts);
  ctrl('row-color-parts').hidden = !(divided || state.colorRule.parts === 'step');
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
  ctrl('chk-color-parts').checked = state.colorRule.parts === 'step';
  syncColorPartsRow();
  syncQuadrantHint();
}
// "By quadrant" splits the grid at its middle; with an odd number of columns
// or rows the middle line runs through a cell, which is documented behaviour
// (that cell joins the second half) — so it is only flagged, never changed.
export function syncQuadrantHint() {
  let odd = false;
  if (state.colorRule.mode === 'quadrant') {
    try {
      const cr = state.activeTier === 'symbol' ? (state.symbolGrid ? cellColRow(getSymbolGrid()) : []) : componentCellColRow(getGrid());
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
  state.colorRule = { mode: pv('sel-color-rule'), offset: parseInt(pv('sel-color-offset'), 10) || 0, ...(ctrl('chk-color-parts').checked ? { parts: 'step' } : {}) };
  syncColorRuleUI();
  refreshColourViews();
}
