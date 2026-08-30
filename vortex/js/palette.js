/* ─────────────────────────────────────────────────────────────
   Vortex — Palette. Promoted to shared/organica-palette.js
   (Organica.palette.swatch; folded in from organica-palette-chip.js,
   2026-08-29) — this was one of the 6
   independent copies found duplicating the RMX chip pattern (itself
   ported from Membrane's own, which ported Camo Turing's original).

   Max stays 8 (raised from Membrane's 5, itself a leftover of Camo
   Turing's fixed-size GLSL uniform array — a real hardware constraint
   that doesn't apply here; Vortex's colour is a plain `i % colors.length`
   cycle with no array-size bound). Min stays 2.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';

const COLORS_MAX = 8;

export function colorAt(i) {
  return state.colors[i % state.colors.length];
}

function ctrl(id) { return document.getElementById(id); }

export function buildPalette() {
  Organica.palette.swatch(ctrl('rmx-palette'), {
    colors: state.colors,
    min: 2,
    max: COLORS_MAX,
    onChange: (colors) => { state.colors = colors; },
  });
}
