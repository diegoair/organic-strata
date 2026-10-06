// Flexible Visual System · engine/15-export-library-view — the engine part of 15-export-library-view.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  live, pv, state
} from './00-core.js';
import {
  frameDims
} from './01-geometry.js';
import {
  getSeed
} from './02-seed-ui.js';
import {
  getGrid
} from './03-rules.js';
import {
  ELEMENT_LIB, buildComponentItems, genesisTileForms, getElementAppearance, savedElementThumb,
  withAppearance
} from './04-appearance.js';
import {
  buildComponentSVG, buildSeedPreviewSVG
} from './05-render-component.js';
import {
  getSelectedComponent
} from './06-component-ui.js';
import {
  LIBRARY, hexKey, libraryNames, shownElementNames
} from './07-library.js';
import {
  buildFvsGridSVG, getSymbolGrid
} from './08-symbol-grid.js';
import {
  buildSymbolSVG
} from './09-symbol-render.js';
import {
  componentThumbSVG
} from './10-suggest.js';
import {
  SYMBOL_LIBRARY, symbolEntryThumbSVG
} from './11-symbol-ui.js';
import { hooks, provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  railPatch: () => railPatch, svgInnerOf: () => svgInnerOf
});
export const DEFAULT_VARIANTS = [
  { style: 'fill', ink: '#0a9a3e', strokeW: 4, paper: null },
  { style: 'stroke', ink: '#e8321e', strokeW: 5, paper: null },
];
// Recolour by string on the finished SVG: every fill/stroke that is not
// "none" or the paper colour becomes `ink`. Works for every tier alike.
export function recolourSVG(svg, ink, paper) {
  const p = hexKey(paper);
  return svg.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (m, attr, c) => hexKey(c) === p ? m : `${attr}="${ink}"`);
}
// Output pipeline shared by Variants and Plates: raw tier SVG → (Print mode:
// physical-mm wrapper with bleed, crop marks, and — plates only — registration
// marks) → SVG blob, or a rasterised PNG (screen: base×scale; print: exact
// px from the panel's size/DPI, with the DPI written into the file).
export function svgBaseDims(svg) { const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); return m ? { w: parseFloat(m[1]), h: parseFloat(m[2]) } : { w: 400, h: 400 }; }
export function svgInnerOf(svg) { return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''); }
// Plates: one black-on-transparent SVG per palette colour. Only the
// shapes painted in ink i survive; every other palette colour → none.
export function plateSVG(svg, colors, i, paper) {
  const cs = colors.map(hexKey);
  let out = svg.replace(new RegExp(`<rect width="[\\d.]+" height="[\\d.]+" fill="${paper}"/>`, 'i'), '');
  out = out.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (m, attr, c) => {
    const j = cs.indexOf(hexKey(c));
    return j === -1 ? m : `${attr}="${j === i ? '#000000' : 'none'}"`;
  });
  return out;
}
// What a click on a tile does depends on the tab: the aria-label says which.
export function railTileVerb(kind) {
  const t = state.activeTier;
  if (kind === 'symbol') return 'Load Symbol';
  if (t === 'symbol') return 'Place ' + (kind === 'element' ? 'Element' : 'Component') + ' in the selected cells —';
  return kind === 'element' ? 'Use Element as Paper tile —' : 'Load Component';
}
// Anything saved at all? Elements (with a tile), Components, Symbols.
export function railSavedCount() {
  const elAll = ELEMENT_LIB.read() || {};
  return shownElementNames(elAll).length + libraryNames(LIBRARY.read()).length + Object.keys(SYMBOL_LIBRARY.read() || {}).length;
}
// The rail toggle is aria-disabled (focusable, the reason in its label = the tooltip) when opening it
// would show nothing: nothing saved, on the Element tab (Component / Symbol keep their Save buttons there).
export function railBlock() {
  return state.activeTier === 'element' && !railSavedCount() ? 'Library rail — save an Element, a Component or a Symbol first' : '';
}
// Double-click an Element or a Component tile → open it in its own step to edit it (Diego, Oct 5, 2026).
// A tile's single click already does something (place it, use it as the Paper tile, load it), so a mouse
// click waits a moment for a possible second one instead of doing both; the keyboard (Enter, detail 0)
// and a Symbol tile (its click already opens it) act at once.
export const RAIL_DBL_MS = 220;   // under the usual double-click interval
// ── Delete — one path for the rail and the Library view (Diego, Oct 6, 2026: deleting an item never changes
// another creation). Symbols and Elements are copied into what uses them (cells copy the Element's seed,
// saved appearances freeze the Paper tile), so they go. A Component is named by saved Symbols' cells,
// Container / Mask references and the open Symbol: while any of those use it, it is kept, hidden, under a
// key of its own (so a new save can never take its name), and dropped once nothing uses it (sweepHiddenSaved).
export function componentUsage(name) {
  const cells = (state.symbolCells || []).filter(c => c && c.source === 'component' && c.componentName === name).length;
  const syms = Object.values(SYMBOL_LIBRARY.read()).filter(e => (e.cells || []).some(c => c.componentName === name)).length;
  const under = Object.entries(LIBRARY.read()).filter(([n, e]) => n !== name && e.underlyingComponentName === name).length + (state.underlyingComponentName === name ? 1 : 0);
  return { cells, syms, under, total: cells + syms + under };
}
export function dupName(all, base) {
  let n = base + ' copy';
  for (let i = 2; all[n]; i++) n = base + ' copy ' + i;
  return n;
}
// ── Library view (Oct 6, 2026) — every saved Element, Component, Symbol and the Genesis seeds (the 13
// Base Seeds + the user's own) in one view over the canvas, opened from the floatbar on every tier.
// A tile's click opens / loads it (a Genesis seed becomes the Element's Shape); Rename · Duplicate ·
// SVG · PNG · Delete under it. The rail stays for dragging onto Symbol cells.
export const LIBVIEW_KINDS = [['element', 'Elements'], ['component', 'Components'], ['symbol', 'Symbols'], ['genesis', 'Genesis seeds']];
export function libviewVerb(kind, name) {
  return kind === 'element' ? 'Edit Element ' + name : kind === 'component' ? 'Load Component ' + name
    : kind === 'symbol' ? 'Load Symbol ' + name : 'Use as Element shape: ' + name;
}
// Always on (Diego, Oct 6, 2026): the Genesis seeds are always there, and the Library is where the Element picks them.
export function libviewBlock() { return ''; }
export const fileSlug = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
export const KIND_WORD = { element: 'Element', component: 'Component', symbol: 'Symbol' };
export function tierSVG() {
  const t = state.activeTier;
  if (t === 'symbol') return getSymbolGrid() ? buildSymbolSVG() : '';
  if (t === 'grid') return buildFvsGridSVG();
  if (t === 'element') return buildSeedPreviewSVG(getSeed(), 0, false, false, 400);
  if (t === 'figure') return hooks.figureSVGOf(state.figureTier || 'symbol');
  const comp = getSelectedComponent();
  if (!comp) return '';
  state.selectedRuleSource = comp.ruleSource;
  const grid = getGrid();
  return buildComponentSVG(buildComponentItems(comp, grid), getSeed(), frameDims(grid));
}
export function renderVariant(v, transparent) {
  const prev = { colors: state.colors, paper: state.paperColor };
  const paper = prev.paper;
  if (v.paper) state.paperColor = v.paper;
  const app = { ...getElementAppearance(), fillMode: v.style, strokeW: v.strokeW, rounded: true };
  live.variantAppearance = { fillMode: v.style, strokeW: v.strokeW, rounded: true };
  state.colors = [v.ink];
  try {
    let svg = withAppearance(app, tierSVG);
    if (!svg) return '';
    const paperNow = v.paper || paper;
    svg = recolourSVG(svg, v.ink, paperNow);
    if (transparent) svg = svg.replace(new RegExp(`<rect width="[\\d.]+" height="[\\d.]+" fill="${paperNow}"/>`, 'i'), '');
    return svg;
  } finally { live.variantAppearance = null; state.colors = prev.colors; state.paperColor = prev.paper; }
}
// What a tile puts in a cell — the same patches as the Choose-content overlay.
export function railPatch(kind, name) {
  if (kind === 'component') {
    if (!LIBRARY.peek()[name]) return null;
    return { source: 'component', componentName: name, span: true, ownColors: null, ownPaper: null, ownAppearance: null, colourway: null, rotation: 0, flipH: false, flipV: false, fitMode: live.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0 };
  }
  const entry = ELEMENT_LIB.read()[name];
  if (!entry || !entry.seed) return null;
  const sp = JSON.parse(JSON.stringify(entry.seed)), o = entry.orientation || {};
  if (sp.type === 'stack') sp.layers.forEach(l => { if (l.ink == null || l.ink === 'cell') l.ink = 0; });
  // The cell carries the palette the Element was saved with (ownColors). It is used while
  // Colour by is "Element's own colours" (the default): its first ink for the shape, every
  // layer's ink for a stack (drawn like a Component's own palette). Any other rule colours
  // the cell like the rest. An entry saved without colours follows the rule.
  const own = entry.colors && entry.colors.length ? entry.colors.slice() : null;
  return { source: 'seed', seedType: sp.type, seedParams: sp, color: null, ownColors: own, ownPaper: entry.paperColor || null, ownAppearance: entry.appearance || null, colourway: null, rotation: o.rotation || 0, flipH: !!o.flipH, flipV: !!o.flipV, fitMode: live.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0 };
}
export function elementInLivePaper(name) { return !!(live.paperPatternOn && pv('sel-ground-tile') === 'saved:' + name); }
export function libviewItems(kind) {
  const newest = all => (a, b) => String((all[b] || {}).savedAt || '').localeCompare(String((all[a] || {}).savedAt || ''));
  if (kind === 'element') { const all = ELEMENT_LIB.read(); return shownElementNames(all).sort(newest(all)).map(n => ({ name: n, svg: () => savedElementThumb(all[n]) })); }
  if (kind === 'component') { const all = LIBRARY.read(); return libraryNames(all).sort(newest(all)).map(n => ({ name: n, svg: () => componentThumbSVG(n) })); }
  if (kind === 'symbol') { const all = SYMBOL_LIBRARY.read(); return Object.keys(all || {}).sort(newest(all)).map(n => ({ name: n, svg: () => symbolEntryThumbSVG(all[n]) })); }
  return genesisTileForms().map(f => ({ name: f.name || f.id, id: f.id, svg: () => String(f.svg) }));
}
// A saved item as a file: the same SVG its thumbnail draws (Paper included), or that SVG rasterised.
export function libviewSVG(kind, name) {
  if (kind === 'element') { const e = ELEMENT_LIB.read()[name]; return e ? savedElementThumb(e) : ''; }
  if (kind === 'component') return componentThumbSVG(name);
  if (kind === 'symbol') { const e = SYMBOL_LIBRARY.read()[name]; return e ? symbolEntryThumbSVG(e) : ''; }
  const f = genesisTileForms().find(x => x.id === name);
  return f ? String(f.svg).replace(/var\(--ink\)/g, '#000000') : '';
}
