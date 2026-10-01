/* ─────────────────────────────────────────────────────────────────────────────
 * color.js — Organica's colour maths (Organica.color).
 *
 * Pure functions, no DOM, no paired CSS. The perceptual layer the suite did
 * not have: everything before this was hex ↔ RGB (core.js), a naive CMYK
 * (core.js) and HSL/HSB typed locally in TuneSutra and Membrane.
 *
 * LOAD ORDER: core.js → color.js → palette.js → tool script.
 * Needs Organica.hexToRGB255 / rgbToHex / normalizeHex from core.
 *
 * WHY OKLCH: HSL lightness is not perceived lightness — a yellow and a blue
 * at HSL L 50 are far apart in brightness, so a harmony built by rotating
 * HSL hue comes out unbalanced and a scale built by moving HSL L is uneven
 * to the eye. OKLab / OKLCH (Björn Ottosson, 2020) is perceptually uniform
 * enough that "same L" reads as "same lightness" across hues.
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 *   hexToOklab(hex)            → { L, a, b }          L 0..1
 *   oklabToHex(L, a, b)        → hex (gamut-mapped by chroma reduction)
 *   hexToOklch(hex)            → { l, c, h }          l 0..1, c ≥ 0, h 0..360
 *   oklchToHex(l, c, h)        → hex (gamut-mapped by chroma reduction)
 *   inGamut(l, c, h)           → bool — is it a real sRGB colour
 *   maxChroma(l, h)            → the largest c that still fits sRGB
 *   mix(hexA, hexB, t)         → hex, interpolated in OKLab (no muddy middle)
 *   luminance(hex)             → WCAG relative luminance 0..1
 *   contrast(hexA, hexB)       → WCAG contrast ratio 1..21
 *   deltaE(hexA, hexB)         → OKLab distance ×100 (≈2 = just noticeable)
 *   scale(hex, opts)           → 10 steps 0…900, see below
 *   rgbToHsb / hsbToRgb / rgbToHsl / hslToRgb — moved verbatim from TuneSutra
 *   hsbToRgbRaw(h, s, v)       → [r, g, b] unrounded floats (Membrane's shape)
 *
 * ── scale(hex, { snap = true }) → [{ step, hex, l, anchor }] ─────────────────
 *   Each step sits at a FIXED perceptual lightness (SCALE_L), so step 500 is
 *   the same lightness in every row and rows are interchangeable. Hue is
 *   held. Chroma keeps the picked colour's share of the available gamut at
 *   each lightness and never exceeds the picked colour's own chroma, so tints
 *   do not go neon and shades do not go grey.
 *   snap: the picked colour is placed, unchanged, on the step whose target
 *   lightness is nearest to it (anchor: true) — not forced to 500.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const color = {};

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ── sRGB transfer ──────────────────────────────────────────────────────────
  function toLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function toGamma(v) { return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }

  // ── OKLab ↔ linear sRGB (Ottosson's matrices) ──────────────────────────────
  function linearToOklab(r, g, b) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
      L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    };
  }
  function oklabToLinear(L, a, b) {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }

  const GAMUT_EPS = 1e-4;
  function linearInGamut(rgb) {
    return rgb[0] >= -GAMUT_EPS && rgb[0] <= 1 + GAMUT_EPS &&
           rgb[1] >= -GAMUT_EPS && rgb[1] <= 1 + GAMUT_EPS &&
           rgb[2] >= -GAMUT_EPS && rgb[2] <= 1 + GAMUT_EPS;
  }
  function lchToLinear(l, c, h) {
    const rad = h * Math.PI / 180;
    return oklabToLinear(l, c * Math.cos(rad), c * Math.sin(rad));
  }

  color.inGamut = function (l, c, h) { return linearInGamut(lchToLinear(l, c, h)); };

  // Largest chroma at this lightness + hue that is still an sRGB colour.
  // Bisection — the gamut boundary has no closed form worth carrying here.
  color.maxChroma = function (l, h) {
    if (l <= 0 || l >= 1) return 0;
    let lo = 0, hi = 0.4;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (linearInGamut(lchToLinear(l, mid, h))) lo = mid; else hi = mid;
    }
    return lo;
  };

  color.hexToOklab = function (hex) {
    const rgb = Organica.hexToRGB255(hex);
    return linearToOklab(toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2]));
  };
  color.hexToOklch = function (hex) {
    const lab = color.hexToOklab(hex);
    const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { l: lab.L, c: c, h: c < 1e-4 ? 0 : h };   // a grey has no hue — report 0, not atan2 noise
  };

  // Out-of-gamut colours are brought in by reducing chroma at constant
  // lightness and hue (clipping the channels instead shifts the hue).
  color.oklchToHex = function (l, c, h) {
    l = clamp(l, 0, 1);
    c = Math.max(0, c);
    let rgb = lchToLinear(l, c, h);
    if (!linearInGamut(rgb)) rgb = lchToLinear(l, Math.min(c, color.maxChroma(l, h)), h);
    return Organica.rgbToHex(toGamma(clamp(rgb[0], 0, 1)), toGamma(clamp(rgb[1], 0, 1)), toGamma(clamp(rgb[2], 0, 1)));
  };
  color.oklabToHex = function (L, a, b) {
    let h = Math.atan2(b, a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return color.oklchToHex(L, Math.sqrt(a * a + b * b), h);
  };

  color.mix = function (hexA, hexB, t) {
    const A = color.hexToOklab(hexA), B = color.hexToOklab(hexB);
    t = clamp(t, 0, 1);
    return color.oklabToHex(A.L + (B.L - A.L) * t, A.a + (B.a - A.a) * t, A.b + (B.b - A.b) * t);
  };

  // ── WCAG 2.x ───────────────────────────────────────────────────────────────
  color.luminance = function (hex) {
    const rgb = Organica.hexToRGB255(hex);
    return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
  };
  color.contrast = function (hexA, hexB) {
    const a = color.luminance(hexA), b = color.luminance(hexB);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  // Euclidean distance in OKLab, ×100. Around 2 is just noticeable side by
  // side; under ~5 two swatches read as "the same colour" at a glance.
  color.deltaE = function (hexA, hexB) {
    const A = color.hexToOklab(hexA), B = color.hexToOklab(hexB);
    return 100 * Math.sqrt(Math.pow(A.L - B.L, 2) + Math.pow(A.a - B.a, 2) + Math.pow(A.b - B.b, 2));
  };

  // ── Scale ──────────────────────────────────────────────────────────────────
  const SCALE_STEPS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  const SCALE_L = [0.985, 0.95, 0.89, 0.81, 0.71, 0.61, 0.51, 0.41, 0.31, 0.22];
  color.SCALE_STEPS = SCALE_STEPS;
  color.SCALE_L = SCALE_L;

  color.scale = function (hex, opts) {
    const snap = !opts || opts.snap !== false;
    hex = Organica.normalizeHex(hex, '#888888');
    const src = color.hexToOklch(hex);
    const srcMax = color.maxChroma(src.l, src.h);
    const share = srcMax > 1e-4 ? Math.min(1, src.c / srcMax) : 0;   // how much of the available gamut the pick uses

    let anchor = -1;
    if (snap) {
      let best = Infinity;
      SCALE_L.forEach(function (L, i) {
        const d = Math.abs(L - src.l);
        if (d < best) { best = d; anchor = i; }
      });
    }
    return SCALE_STEPS.map(function (step, i) {
      if (i === anchor) return { step: step, hex: hex, l: src.l, anchor: true };
      const L = SCALE_L[i];
      const c = Math.min(share * color.maxChroma(L, src.h), src.c);
      return { step: step, hex: color.oklchToHex(L, c, src.h), l: L, anchor: false };
    });
  };

  // ── HSB / HSL — moved verbatim from tunesutra/index.html (2nd consumer:
  //    Membrane's own hsbToRgb). Same signatures and rounding as the originals:
  //    rgbToHsb rounds, rgbToHsl does not, both *ToRgb round to 0–255 ints. ────
  function hueOf(r, g, b, max, d) {
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return h;
  }
  function sextant(h, c, x) {
    if (h < 60) return [c, x, 0];
    if (h < 120) return [x, c, 0];
    if (h < 180) return [0, c, x];
    if (h < 240) return [0, x, c];
    if (h < 300) return [x, 0, c];
    return [c, 0, x];
  }
  color.rgbToHsb = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const h = hueOf(r, g, b, max, d);
    const s = max === 0 ? 0 : d / max;
    return { h: Math.round(h), s: Math.round(s * 100), b: Math.round(max * 100) };
  };
  color.hsbToRgbRaw = function (h, s, v) {
    s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const p = sextant(h, c, x);
    return [(p[0] + m) * 255, (p[1] + m) * 255, (p[2] + m) * 255];
  };
  color.hsbToRgb = function (h, s, v) {
    const p = color.hsbToRgbRaw(h, s, v);
    return { r: Math.round(p[0]), g: Math.round(p[1]), b: Math.round(p[2]) };
  };
  color.rgbToHsl = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const h = hueOf(r, g, b, max, d);
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h: h, s: s * 100, l: l * 100 };
  };
  color.hslToRgb = function (h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const p = sextant(h, c, x);
    return { r: Math.round((p[0] + m) * 255), g: Math.round((p[1] + m) * 255), b: Math.round((p[2] + m) * 255) };
  };

  Organica.color = color;
})(typeof window !== 'undefined' ? window : globalThis);
