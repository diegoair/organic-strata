// Flexible Visual System · engine/12-shell — the engine part of 12-shell.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically by scripts/fvs-engine.mjs. Map: docs/FVS.md §Architecture.
import {
  state
} from './00-core.js';
// ── Components ↔ Symbols tab switch ──
export const STEP_EXPORT_HINTS = {
  element: 'Exports the current Element on its own, at 0°.',
  component: 'Exports the selected component only — click one in the gallery first. Paper background (Palette section), real vector geometry (one path per cell).',
  symbol: 'Exports the current Symbol. Paper background (Palette section), real nested vector geometry.',
  figure: 'Exports the figure as drawn (SVG: real vector geometry, one path per shape; PNG: the same drawing rasterised).',
};
export function fvsSurfaceLive(sf) { return state.activeTier === sf.tier && (!sf.ready || sf.ready()); }
export function fvsGalleryLive() { return state.activeTier === 'component' && !state.componentEditMode; }
// ── Wiring ──
// Triangle Type is a derived shortcut, not stored state: picking one writes
// Base/Height/Apex X; any hand edit of those three flips it back to Custom.
export const TRI_PRESETS = { isosceles: [100, 100, 50], right: [100, 100, 0], equilateral: [100, 87, 50] };
// Arc truchet Type is a derived shortcut over several controls (no stored
// state): picking one writes them, any hand edit flips it back to Custom.
export const TRU_PRESETS = {
  butterfly: { fans: 2, count: 5, ratio: 70, core: 0, round: 0 },
  rainbow:   { fans: 1, count: 5, ratio: 60, core: 0, round: 0 },
  horseshoe: { fans: 1, count: 4, ratio: 60, core: 35, round: 100 },
  halo:      { fans: 2, count: 4, ratio: 55, core: 40, round: 100 },
};
export const TRU_NEUTRAL = { spread: 180, reach: 100, ramp: 0, curve: 0, segs: 1 };   // a preset always resets these
export const TRU_IDS = { count: 'rg-arc-count', ratio: 'rg-arc-ratio', core: 'rg-tru-core', round: 'rg-tru-round', spread: 'rg-tru-spread', reach: 'rg-tru-reach', ramp: 'rg-tru-ramp', curve: 'rg-tru-curve', segs: 'rg-tru-segs' };
// Arc Type is a derived shortcut for Sweep, same idea as Triangle Type.
export const ARC_PRESETS = { quarter: 90, half: 180, threequarter: 270 };   // no 'ring' (Oct 4, 2026): Sweep stops at 350, so it was never closed — a full ring is Circle → Interior Ring
// Wedge Type is a derived shortcut for Angle + Inner radius (same idea as Arc Type).
export const WEDGE_PRESETS = { quarter: [90, 0], half: [180, 0], threequarter: [270, 0] };   // 'ring' dropped Oct 4, 2026 — the same annulus as Circle → Interior Ring; Angle 360 still makes it
// A shape's own Rotate (shared/shapes.js EXTRAS, also read by Genesis) is retired in FVS — Appearance → Rotate
// does it for every shape. The row is still built, into the hidden #seed-legacy, so old snapshots round-trip.
export const FVS_RETIRED_EXTRAS = new Set(['starRotate', 'rrRotate', 'chevRotate', 'crossRotate', 'lensRotate', 'dropRotate',
  'starOutline', 'rrOutline', 'lensOutline', 'blobOutline',   // + the shape-own Outlines → Appearance → Cut out
  'starSkew']);   // + Star's Angle jitter → Appearance → Irregularity
// One name per idea across every shape (Oct 4, 2026): FVS's own labels for a few shared rows — the shared table
// keeps its own, Genesis reads it. key → [label, title?].
export const FVS_EXTRAS_LABELS = {
  starStyle: ['Rounding style'], rrStyle: ['Rounding style'],
  chevRound: ['Rounding'], chevStyle: ['Rounding style', 'How corners are cut when Rounding is above 0.'],
  crossStyle: ['Rounding style', 'How corners are cut when Rounding is above 0.'],
};
// The same row order in every Seed: Type · proportions · rounding (then its style, then curvature) · the shape's
// own details · repeats inside the shape. Blocks whose rows come partly from the shared table are re-ordered here.
export const FVS_SEED_ORDER = {
  roundedrect: ['sel-rr-type', 'rg-rr-width', 'rg-rr-height', 'rg-rr-skew', 'rg-rr-corner', 'sel-rr-style', 'sel-rr-mask', 'rg-rr-curve'],
  cross: ['sel-cross-type', 'rg-cross-arms', 'rg-cross-armwidth', 'rg-cross-armlength', 'rg-cross-corner', 'sel-cross-style', 'rg-cross-taper', 'sel-cross-tip'],
  blob: ['rg-blob-amount', 'rg-blob-freq', 'rg-blob-smooth', 'rg-blob-seed'],
};
// Polygon Type is a derived shortcut for Sides. Triangle and Square were dropped (Oct 4, 2026) — they are
// shapes of their own (Triangle, Square); a snapshot with 3 or 4 sides reads Custom.
// Step is capped by Sides (a star polygon {n/k} needs k < n/2).
export const POLY_PRESETS = { pentagon: [5], hexagon: [6], octagon: [8] };
export const OUTLINE_ICONS = { hexagon: 'fvs-cell-hexagon', triangle: 'fvs-cell-triangle', diamond: 'fvs-diamond', square: 'fvs-cell-square' };
export const NEW_LAYER_SCALE = 0.6;   // a new layer starts smaller so it shows on top of the one below (addLayer)
