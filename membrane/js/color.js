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

function lerpRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Same sine-dot-product hash Camo Turing's own GLSL hash1(vec2) uses,
// ported to a single scalar input — Membrane has no 2D field coordinate
// to hash (Camo Turing hashes screen-space uv), just a point INDEX along
// the curve/path, so the jitter is a function of that index instead.
// Deterministic per index, so Random/Tone+Random stay visually STABLE
// frame to frame at a given point, not flickering noise.
function hash1(n) {
  const x = Math.sin(n * 127.1) * 43758.5453123;
  return x - Math.floor(x);
}

// RMX — Camo Turing's own "up to 5 colours, 4 mapping modes" palette
// (rmxColor() in its own GLSL, ported here verbatim since Membrane has
// no shader to run it in). `t` is the point's own position along the
// curve/path (i/n, 0..1 — exactly what Rainbow already uses for its hue
// cycle); `seedIndex` drives the Random/Tone+Random hash so the jitter
// is index-stable rather than re-rolled every frame.
//
// NOT the same as Organica.palette.colorAt: this is the Camo-Turing-GLSL
// colour lineage (posterize = floor(scaled); tonernd = smooth lerp,
// ±1.5 jitter), where palette.colorAt is the Pollen lineage (posterize =
// round; tonernd = discrete stop, ±1.2). Kept separate on purpose so
// Membrane's RMX output matches Camo Turing's, not Pollen's.
export function rmxColorAt(t, colors, mapping, seedIndex) {
  const count = colors.length;
  if (count <= 1) return hexToRgb(colors[0] || '#888888');
  const paletteAt = i => hexToRgb(colors[Math.max(0, Math.min(count - 1, i))]);
  const scaled = t * (count - 1);
  const i0 = Math.floor(scaled), i1 = Math.min(i0 + 1, count - 1), f = scaled - i0;
  if (mapping === 'tone') {
    return lerpRgb(paletteAt(i0), paletteAt(i1), f);
  } else if (mapping === 'posterize') {
    return paletteAt(i0);
  } else if (mapping === 'random') {
    const h = hash1(seedIndex);
    return paletteAt(Math.min(count - 1, Math.floor(h * count)));
  } else {   // tonernd — Tone + Random: gradient position jittered by the same hash
    const h = hash1(seedIndex) - 0.5;
    const tt = Math.max(0, Math.min(count - 1, scaled + h * 1.5));
    const j0 = Math.floor(tt), j1 = Math.min(j0 + 1, count - 1);
    return lerpRgb(paletteAt(j0), paletteAt(j1), tt - j0);
  }
}
