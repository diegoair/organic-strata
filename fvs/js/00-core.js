// Flexible Visual System · 00-core — State, palette and colour rules — the shared state object every other file reads.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import { hooks } from './hooks.js';
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, NEW_COLOR_RULE, PALETTE_MAX, colorAt, pv, setFigurePristine, setPanelSource, state
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
    document.getElementById('screen-scale-rows').hidden = !!(printSizePanel.getMode() === 'print');
  },
});

rt.tilePicker = null;


state.colorRule = { ...NEW_COLOR_RULE };

// The Palette strip. Its menu lists TuneSutra's saved and starred palettes (Diego, Nov 20, 2026 — the other Elements'
// Palettes left it); a palette taken whole comes with each colour's Gradient + Shadow (state.inkShades, hex → definition),
// edited below the strip (#fvs-shade, Organica.shadeEditor) for the chip last opened, and Save as palette… makes a NEW
// palette in TuneSutra (the original never changes). The wiring is the shared Organica.paletteKit since Nov 21, 2026
// (shared/palette-kit.js — promoted from here so every tool takes a palette the same way).
let paletteKit = null;
function colourChanged() {
  syncColorRuleUI();
  hooks.syncGroundInkOptions();
  if (hooks.syncLayerLight) hooks.syncLayerLight();   // Light shows once a colour is shaded
  refreshColourViews();
}
export function buildPalette() {
  paletteKit = Organica.paletteKit.strip(ctrl('fvs-palette'), ctrl('fvs-shade'), {
    tool: 'Flexible Visual System',
    max: PALETTE_MAX,
    get: () => ({ colors: state.colors, shades: state.inkShades }),
    paper: () => (state.paperColor && state.paperColor !== 'none' ? state.paperColor : '#ffffff'),
    // Wash over shown: All the shapes = one wash over the whole Component (live.washSheet, 05-render-component); in the
    // Element it is the shape's own (with Light › Whole element, one wash across the Element)
    sheet: () => ({ x: 0, y: 0, w: 100, h: 100 }),
    // the Shadow can fall outside the shape (Nov 22, 2026); Cell edge only where cells meet — Component, Symbol, Figure
    cast: { edge: () => state.activeTier !== 'element' },
    set: (p, why) => {
      if (p.colors) state.colors = p.colors.map(hexKey);
      if (p.shades) state.inkShades = p.shades;
      else if (why === 'palette') state.inkShades = {};
      if (why === 'shade') { if (hooks.syncLayerLight) hooks.syncLayerLight(); refreshColourViews(); }
      else colourChanged();
    },
  });
  hooks.syncGroundInkOptions();
}

// The Shadow editor's Cell edge row shows on the steps that have cells (12-shell switchTier calls it)
export function syncShadeEditor() { if (paletteKit && paletteKit.syncEditor) paletteKit.syncEditor(); }

// The Gradient + Shadow follow the layer (Diego, Nov 21, 2026: "se scelto un element e un layer quando cambio il layer i
// colori non si applicano"): the editor edits the colour of the chip last opened, so selecting a layer — or giving it
// another ink — opens that layer's ink in the editor. A layer that follows the cell colour opens the cell's (colorAt(0),
// what the Element shows); a Tonal step edits its ink (the step itself draws no shading).
export function paletteFollowLayer(l) {
  if (!paletteKit || !l || (l.role || 'fill') !== 'fill') return;
  const n = state.colors.length, i = typeof l.ink === 'number' ? ((l.ink % n) + n) % n : Math.max(0, state.colors.indexOf(colorAt(0)));
  paletteKit.setActive(i);
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
  ctrl('row-color-offset').hidden = !!(n < 2 || state.colorRule.mode === 'element');   // Element's colours: every cell slot 0, no start
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
  ctrl('color-quadrant-hint').hidden = !odd;
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
