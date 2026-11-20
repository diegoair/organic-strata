// Flexible Visual System · 00-core — State, palette and colour rules — the shared state object every other file reads.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import { hooks } from './hooks.js';
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, NEW_COLOR_RULE, PALETTE_MAX, pv, setFigurePristine, setPanelSource, state
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
// palette in TuneSutra (the original never changes).
let paletteStrip = null, shadeEd = null, shadeAt = 0, paletteName = '', paletteHouse = null;
const shadeCtx = () => ({ tints: [].concat.apply([], state.colors.map(h => Organica.color.scale(h).map(st => st.hex))), paper: state.paperColor && state.paperColor !== 'none' ? state.paperColor : '#ffffff' });
function colourChanged() {
  syncColorRuleUI();
  hooks.syncGroundInkOptions();
  if (hooks.syncLayerLight) hooks.syncLayerLight();   // Light shows once a colour is shaded
  refreshColourViews();
}
function syncShadeEditor() {
  const host = ctrl('fvs-shade');
  if (!host || !Organica.shadeEditor || !Organica.shading) return;
  shadeAt = Math.min(shadeAt, state.colors.length - 1);
  const hex = state.colors[shadeAt], o = { hex, def: state.inkShades[hex] || null, label: 'Palette colour ' + (shadeAt + 1) };   // the chip's own name (palette.js)
  if (shadeEd && host.firstChild) { shadeEd.set(o); return; }
  shadeEd = Organica.shadeEditor.mount(host, Object.assign(o, {
    ctx: shadeCtx,
    onChange: def => {
      const h = state.colors[shadeAt], m = { ...state.inkShades };
      if (def) m[h] = def; else delete m[h];
      state.inkShades = m;
      if (paletteStrip) paletteStrip.rebuild();   // the chip draws its new shading
      if (paletteStrip) paletteStrip.setActive(shadeAt);
      if (hooks.syncLayerLight) hooks.syncLayerLight();
      refreshColourViews();
    },
  }));
}
export function buildPalette() {
  const S = Organica.shading;
  paletteStrip = Organica.palette.swatch(ctrl('fvs-palette'), {
    colors: state.colors,
    min: 1,
    max: PALETTE_MAX,
    activeIndex: Math.min(shadeAt, state.colors.length - 1),
    shadeOf: (i, hex) => (state.inkShades[hex] ? { def: state.inkShades[hex], ctx: shadeCtx() } : null),
    onOpen: i => { shadeAt = i; paletteStrip.setActive(i); syncShadeEditor(); },
    onChange: (colors, i, action) => {
      const before = state.colors;
      state.colors = colors.map(hexKey);
      // a colour changed by hand keeps its shading, moved to the new colour (its first stop; the 900 follows)
      if (action === 'edit' && S && before[i] && state.inkShades[before[i]] && before[i] !== state.colors[i]) {
        const m = { ...state.inkShades }, def = m[before[i]];
        if (!before.some((h, j) => j !== i && h === before[i])) delete m[before[i]];
        m[state.colors[i]] = S.withColour(JSON.parse(JSON.stringify(def)), state.colors[i], shadeCtx());
        state.inkShades = m;
      }
      if (action === 'set') { paletteName = ''; paletteHouse = null; }
      colourChanged();
      syncShadeEditor();
    },
    // a TuneSutra palette taken whole: its colours and each one's shading
    onPalette: (pal, colors) => {
      state.colors = colors.map(hexKey);
      const m = {};
      pal.colours.slice(0, colors.length).forEach(c => { if (c.shade) m[hexKey(c.hex)] = c.shade; });
      state.inkShades = m;
      paletteName = pal.name; paletteHouse = pal.house || null;
      shadeAt = 0;
      paletteStrip.rebuild();
      paletteStrip.setActive(0);
      colourChanged();
      syncShadeEditor();
    },
    saveAs: {
      tool: 'Flexible Visual System',
      get: () => ({ name: paletteName || 'Palette', house: paletteHouse, colours: state.colors.map(h => ({ hex: h, shade: state.inkShades[h] || null })) }),
    },
  });
  hooks.syncGroundInkOptions();
  syncShadeEditor();
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
