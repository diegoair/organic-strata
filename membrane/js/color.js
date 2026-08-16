/* ─────────────────────────────────────────────────────────────
   Membrane — colour utilities. Plain functions, no p5 dependency (colour
   maths doesn't need it) — kept separate from render.js so the three
   Colour-mode sources (ink / rainbow / sample-from-image) have one
   place to live instead of being re-derived per renderer.
   ───────────────────────────────────────────────────────────── */

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Standard HSB→RGB, 0-255 out. p5's own colorMode(HSB) was considered and
// rejected (see explorations/flow-field's own session notes — switching
// the WHOLE sketch's colorMode caused a real, confirmed bug where p5's
// own saturation() returned the HSL value instead of HSB for a colour
// built before the mode switch). Converting by hand once here avoids
// that class of bug entirely.
export function hsbToRgb(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Cached ONCE per image load (loadPixels() copies the whole buffer — real,
// measurable waste if called per point/frame instead), reused by every
// "Sample from image" colour lookup afterward.
export function cacheImagePixels(img) {
  img.loadPixels();
  return { pixels: img.pixels, w: img.width, h: img.height };
}

export function imgColorAt(cache, fallbackRGB, ix, iy) {
  if (!cache) return fallbackRGB;
  const x = Math.max(0, Math.min(cache.w - 1, Math.floor(ix)));
  const y = Math.max(0, Math.min(cache.h - 1, Math.floor(iy)));
  const idx = 4 * (y * cache.w + x);
  return [cache.pixels[idx], cache.pixels[idx + 1], cache.pixels[idx + 2]];
}
