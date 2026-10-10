// Flexible Visual System · engine/07-library — the engine part of 07-library.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  live, pc, pv, state, val
} from './00-core.js';
import {
  SEED_TYPES, syncPartLayers
} from './01-geometry.js';
import {
  SEED_ICONS, panelSeedSnapshot, seedForSnapshot
} from './02-seed-ui.js';
import {
  getGrid
} from './03-rules.js';
import {
  appearanceSnapshot
} from './04-appearance.js';
import {
  buildComponentSVG
} from './05-render-component.js';
import {
  getSelectedComponent, seedWithLayerInks, withComponentColours
} from './06-component-ui.js';
import { provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  LIBRARY: () => LIBRARY, fillPaper: () => fillPaper, hexKey: () => hexKey, isPaperNone: () => isPaperNone,
  syncActiveLayer: () => syncActiveLayer
});
// ── Component Library — save/reload full snapshots (Seed incl. an
// upload's own geometry, Grid, Palette, and the exact generated
// arrangement), not just current control state. Organica.presetStore is
// a generic JSON-blob store (confirmed against Loom's own "Save grid",
// which persists its whole Universal JSON Model the same way) — one
// entry here is a complete, self-contained snapshot so loading it later
// is unambiguous regardless of whatever else is on screen at the time. ──
export const LIBRARY = Organica.presetStore('fvs');
// Colours are compared and post-processed as STRINGS on the finished SVG
// (recolourSVG / plateSVG / the paper-rect strip) — a deliberate choice: one
// pass works for every tier alike, with no per-tier colour plumbing. That is
// only sound if one colour has one spelling, so hexKey() folds case and the
// short #abc form, and every entry point (palette, paper, saved entries,
// recipes) normalises through it.
// Paper can be transparent: state.paperColor === 'none' (Palette → the checkerboard
// button next to Paper). In SVG that's just fill="none"; on Canvas nothing is painted.
export const PAPER_NONE = 'none';
export const isPaperNone = c => String(c == null ? '' : c).trim().toLowerCase() === PAPER_NONE;
export function fillPaper(ctx, color, x, y, w, h) {
  if (!color || isPaperNone(color)) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
export const hexKey = c => {
  c = String(c == null ? '' : c).trim().toLowerCase();
  return /^#[0-9a-f]{3}$/.test(c) ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
};
// Auto-generated entries ("Tile · <id>", written by tileSelectedInGrid and the
// recipes so the Grid can tile a Component) are working copies, not the user's
// own saved work: they carry `auto: true` (older ones are recognised by their
// name), stay out of every picker/list, and are pruned at boot — the Grid
// rebuilds one from the live Component and a recipe carries its own entry.
export const isAutoEntry = (name, e) => !!(e && e.auto) || name.startsWith('Tile · ');
export const libraryNames = all => Object.keys(all).filter(n => !isAutoEntry(n, all[n]) && !all[n].hidden);
// A deleted Component / Element that another creation still uses is kept, hidden (deleteSavedComponent):
// out of every list, still drawn where it is used.
export const shownElementNames = all => Object.keys(all || {}).filter(n => all[n] && all[n].tile && !all[n].hidden);
export function pruneAutoLibraryEntries() {
  const all = LIBRARY.read();
  const gone = Object.keys(all).filter(n => isAutoEntry(n, all[n]));
  if (!gone.length) return;
  gone.forEach(n => delete all[n]);
  LIBRARY.write(all);
}
// The same "<rule> <time>" convention the rail's Save pre-fills the name
// row with — quick-save just commits it immediately instead of asking.
// Two quick-saves in the same second (or off two candidates that share a
// rule) would otherwise collide and silently overwrite one another, so a
// taken name gets " (2)", " (3)"… appended, same idea as a filesystem's
// own "file (1).txt" convention.
export function uniqueLibraryName(base) {
  const all = LIBRARY.read();
  if (!all[base]) return base;
  let i = 2;
  while (all[`${base} (${i})`]) i++;
  return `${base} (${i})`;
}
// ── Layers UI (state.layers) ───────────────────────────────────────────
// The Seed panel below always edits ONE shape: the active layer. Switching
// layer saves the panel into the layer being left and loads the new one.
export const LAYER_NEW_INKS = ['#e8321e', '#0a9a3e', '#1f5fd6', '#f2b300', '#7a3fd1', '#0e9aa7', '#d6336c'];
export const newLayerId = () => 'l' + Math.random().toString(36).slice(2, 7);
export const LAYER_ROLE_ORDER = ['fill', 'container', 'mask', 'pattern'];
export function buildLibraryEntryFor(comp) {
  if (!comp) return null;
  return withComponentColours(comp, () => libraryEntryFromLive(comp));   // a colourway is saved with its own colours
}
export function libraryEntryFromLive(comp) {
  return {
    seed: seedWithLayerInks(seedForSnapshot(), comp.layerInks),
    appearance: appearanceSnapshot(),
    grid: getGrid(),
    colors: state.colors.slice(),
    colorRule: { ...state.colorRule },
    paperColor: state.paperColor,
    component: { ruleSource: comp.ruleSource, cells: comp.cells },
    role: state.componentRole,
    underlyingComponentName: state.underlyingComponentName,
    ...(state.componentBlend === 'multiply' ? { blend: 'multiply' } : {}),   // absent = Normal (every older Component)
    savedAt: new Date().toISOString(),
  };
}
export function buildLibraryEntry() { return buildLibraryEntryFor(getSelectedComponent()); }
export function syncActiveLayer() {
  if (!state.layers) return;
  const L = state.layers, l = L.items[L.active];
  // A part layer: the panel edits the shape the parts come from (one source for the whole group).
  if (l.part && L.parts) { L.parts.source = panelSeedSnapshot(); if (syncPartLayers(L)) live.partRowsDirty = true; }
  else l.seed = panelSeedSnapshot();
  l.look = readLookControls();
}
export function readLookControls() {
  return { fillMode: pv('sel-element-fillmode'), strokeW: val('rg-element-strokew'), rounded: pc('ck-element-rounded'), w: val('rg-element-w'), l: val('rg-element-l') };
}
export const layerName = l => l.part || l.partName ? (l.partName || l.part) : (SEED_ICONS[l.seed.type] || {}).name || (SEED_TYPES[l.seed.type] || {}).label || l.seed.type;
// Figure recipes rewrite the shared Element seed-type control and replace
// state.components wholesale as a side effect (runBuiltinRecipe/
// runFigureRecipe both fireChange('sel-seed-type', el.type) then rebuild the
// gallery from the recipe) — Figure is meant to be its own sandbox ("edit it
// there and build the Figure again"), not something that silently overwrites
// whatever the user had built in Component/Element. Snapshot right before
// entering Figure, restore right after leaving it back to Component/Element
// (see setTier()). Nothing saved to LIBRARY is ever touched by this — it's
// purely the in-session Element/Component working state.
export function snapshotComponentElementState() {
  return {
    seed: seedForSnapshot(), appearance: appearanceSnapshot(),
    loomGrid: state.loomGrid ? JSON.parse(JSON.stringify(state.loomGrid)) : null,
    gridCols: pv('rg-grid-cols'), gridRows: pv('rg-grid-rows'),
    cellSize: pv('rg-cellsize'), gap: pv('rg-gap'),
    components: state.components.map(c => ({ ...c, cells: c.cells.map(x => ({ ...x })) })),
    selectedId: state.selectedId, selectionExplicit: state.selectionExplicit,
    componentAutoGenerated: state.componentAutoGenerated, componentAutoGenSignature: state.componentAutoGenSignature,
    colors: state.colors.slice(), colorRule: { ...state.colorRule }, paperColor: state.paperColor,
    componentRole: state.componentRole, underlyingComponentName: state.underlyingComponentName,
  };
}
// buildComponentSVG always reads state.paperColor/componentRole/
// underlyingComponentName — a saved Library entry needs its OWN saved
// values instead, so this wraps it with a temporary swap rather than
// duplicating the whole render function. role/underlyingComponentName
// default to 'normal'/null for entries saved before this feature existed.
export function buildComponentSVGWithPaper(items, seed, size, paperColor, role, underlyingComponentName, blend) {
  const prev = { paper: state.paperColor, role: state.componentRole, under: state.underlyingComponentName, blend: state.componentBlend };
  state.paperColor = paperColor;
  state.componentRole = role || 'normal';
  state.underlyingComponentName = underlyingComponentName || null;
  state.componentBlend = blend === 'multiply' ? 'multiply' : 'normal';
  const svg = buildComponentSVG(items, seed, size);
  state.paperColor = prev.paper; state.componentRole = prev.role; state.underlyingComponentName = prev.under; state.componentBlend = prev.blend;
  return svg;
}
