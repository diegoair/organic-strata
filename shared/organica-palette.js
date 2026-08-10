/* ─────────────────────────────────────────────────────────────
   ORGANICA — organica-palette.js
   "Palette" — the Solid / Adaptive / RMX colour-mapping system, born in
   Pollen and copied by hand into Spore and (as a GLSL port) Camo Turing.
   The three copies had already drifted: Spore's Adaptive mode was a stub
   that just returned the flat mark colour (comment admitted "simplified"),
   Spore's RMX Random/Tone+Random called Math.random() fresh on every
   redraw instead of a per-point/per-cell seeded value (so colours
   reshuffled on any re-render), and Camo Turing's field-value range
   (v = A-B, roughly -0.22..1.0) needed a remap Pollen never did because
   Pollen's brightness is already naturally 0..1.

   This module centralizes the one piece that's genuinely the same
   everywhere: given a scalar score (0..1) and a seeded random value,
   which colour comes out. It does NOT centralize the panel markup — the
   three tools' Palette UI has real, shipped divergence (Pollen/Spore are
   3 vs 5 mode buttons with an Image/Multi pair Pollen never had; the
   swatch rows are labelled Point/BG in Pollen, Mark/BG in Spore, Ink/Paper
   in Camo Turing) — forcing one buildUI() onto three working, live tools
   is a bigger and riskier move than the bug this module exists to fix, so
   each tool keeps its own panel wiring and just calls colorAt() instead
   of carrying its own copy of the math.

   Contract — Organica.Palette.colorAt(score, opts):
   - score: 0..1 scalar (Pollen/Spore: per-point brightness; Camo Turing:
     the field value already remapped into 0..1 by the caller — GLSL and
     its SVG-export JS mirror both keep their OWN remap step, since that
     remap depends on the field's own natural range, not on this module).
   - opts.mode: 'solid' | 'adaptive' | 'rmx' ('solid' just returns
     opts.ink — callers usually skip calling this for solid and compare
     score to a threshold directly, since that's a hard binary choice
     with no colour math to share, but it's handled here too for callers
     that want one call site for all three modes).
   - opts.ink / opts.paper: hex strings.
   - opts.colors: array of up to 5 hex strings (RMX palette stops,
     dark → bright), required when mode is 'rmx'.
   - opts.submode: 'tone' | 'posterize' | 'random' | 'tonernd' (RMX only).
   - opts.rnd: 0..1, a value the CALLER seeds and threads through
     (Pollen's per-point captured Math.random(), Camo Turing's hashed
     per-cell value) — used by the 'random'/'tonernd' submodes. Passing a
     fresh Math.random() here reproduces Spore's old reshuffle-on-redraw
     bug, so callers that want stable colour should seed it once and
     reuse it, not regenerate it per render.
   Returns a hex string.

   Requires organica-core.js loaded first (for normalizeHex/hexToRGB255;
   extends window.Organica).
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = global.Organica || {};
  const P = {};

  function lerp(a, b, t) { return a + (b - a) * t; }

  // rgb255 in, hex out — small local wrapper since core only goes hex->rgb.
  function rgbToHex(rgb) { return Organica.rgbToHex(rgb[0], rgb[1], rgb[2]); }

  function mixHex(hexA, hexB, t) {
    const a = Organica.hexToRGB255(hexA), b = Organica.hexToRGB255(hexB);
    return rgbToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  }

  // Tone/Posterize/Random/Tone+Random all resolve to an index (or pair of
  // adjacent indices + fraction) into opts.colors — this is the one piece
  // every RMX submode shares, factored out so colorAt() itself just picks
  // which resolver to call.
  function rmxColor(score, rnd, colors, submode) {
    const n = colors.length;
    if (n <= 0) return '#000000';
    if (n === 1) return colors[0];
    const s = Math.max(0, Math.min(1, score));
    if (submode === 'random') {
      const idx = Math.min(n - 1, Math.floor(rnd * n));
      return colors[idx];
    }
    if (submode === 'posterize') {
      const idx = Math.max(0, Math.min(n - 1, Math.round(s * (n - 1))));
      return colors[idx];
    }
    if (submode === 'tonernd') {
      const raw = s * (n - 1) + (rnd - 0.5) * 1.2;
      const idx = Math.max(0, Math.min(n - 1, Math.round(raw)));
      return colors[idx];
    }
    // 'tone' (default) — smooth lerp between the two adjacent stops.
    const pos = s * (n - 1), i0 = Math.max(0, Math.min(n - 1, Math.floor(pos))),
      i1 = Math.min(n - 1, i0 + 1), frac = pos - i0;
    return mixHex(colors[i0], colors[i1], frac);
  }

  P.colorAt = function (score, opts) {
    opts = opts || {};
    const mode = opts.mode || 'solid';
    if (mode === 'solid') return opts.ink || '#000000';
    if (mode === 'adaptive') return mixHex(opts.ink || '#000000', opts.paper || '#ffffff', Math.max(0, Math.min(1, score)));
    // rmx
    const colors = opts.colors && opts.colors.length ? opts.colors : [opts.ink || '#000000', opts.paper || '#ffffff'];
    return rmxColor(score, opts.rnd == null ? 0.5 : opts.rnd, colors, opts.submode || 'tone');
  };

  // Seeded PRNG for callers that want reproducible 'random'/'tonernd'
  // colour (e.g. a value captured once per point/cell and reused across
  // re-renders, rather than a fresh Math.random() every frame — the
  // latter is what made Spore's RMX-Random reshuffle on every redraw).
  // Same algorithm as organica-transformer.js's fallback, so seeded
  // results match wherever either module is used.
  P.mulberry32 = function (seed) {
    let t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  Organica.Palette = P;
  global.Organica = Organica;
}(typeof window !== 'undefined' ? window : global));
