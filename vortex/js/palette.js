/* ─────────────────────────────────────────────────────────────
   Vortex — Palette. Promoted to shared/palette.js
   (Organica.palette.swatch; folded in from organica-palette-chip.js,
   2026-08-29) — this was one of the 6
   independent copies found duplicating the RMX chip pattern (itself
   ported from Membrane's own, which ported Camo Turing's original).

   Max 9, the same as every Organica tool (Diego, Nov 21, 2026; it was 8);
   Vortex's colour is a plain `i % colors.length` cycle with no array-size
   bound. Min stays 2.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';

const COLORS_MAX = 9;

export function colorAt(i) {
  return state.colors[i % state.colors.length];
}

function ctrl(id) { return document.getElementById(id); }

// A TuneSutra palette is taken whole (Organica.paletteKit, Nov 21, 2026): its colours, in its own order (Vortex cycles
// them by segment, it has no Colour mode). Returns the kit — its rebuild() redraws the strip after state.colors changes.
export function buildPalette() {
  return Organica.paletteKit.strip(ctrl('rmx-palette'), null, {
    tool: 'Vortex', min: 2, max: COLORS_MAX, order: 'palette', shading: false,
    get: () => ({ colors: state.colors }),
    set: (p) => { if (p.colors) state.colors = p.colors; },
  });
}
export { COLORS_MAX };
