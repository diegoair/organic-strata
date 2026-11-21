/* ─────────────────────────────────────────────────────────────
   Membrane — colour utilities. Plain functions, no p5 dependency (colour
   maths doesn't need it) — kept separate from render.js so the three
   Colour-mode sources (ink / rainbow / sample-from-image) have one
   place to live instead of being re-derived per renderer.
   ───────────────────────────────────────────────────────────── */

// shared/core.js owns the hex parse (normalised: a bad value reads as black, not NaN)
export function hexToRgb(hex) {
  return Organica.hexToRGB255(hex);
}

// Standard HSB→RGB, 0-255 out. p5's own colorMode(HSB) was considered and
// rejected (see explorations/flow-field's own session notes — switching
// the WHOLE sketch's colorMode caused a real, confirmed bug where p5's
// own saturation() returned the HSL value instead of HSB for a colour
// built before the mode switch). Converting by hand once here avoids
// that class of bug entirely. The maths itself now lives in shared/color.js
// (Organica.color.hsbToRgbRaw — unrounded [r,g,b], this function's own shape),
// promoted when TuneSutra's copy made it a two-consumer function.
export function hsbToRgb(h, s, v) { return Organica.color.hsbToRgbRaw(h, s, v); }

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

// RMX — Organica.palette.colorAt (shared/palette.js), the one RMX math of the suite (Diego, Nov 21, 2026:
// Pollen's — posterize = nearest stop, tone+random = ±1.2 jitter to a discrete stop; Membrane ran Camo
// Turing's old floor / ±1.5-blend lineage before). `t` is the point's own position along the curve/path
// (i/n, 0..1 — exactly what Rainbow already uses for its hue cycle); `seedIndex` drives the Random /
// Tone+Random `rnd` through hash1, so the jitter is index-stable rather than re-rolled every frame.
// Returns [r, g, b] 0-255, the shape render.js / svgexport.js read.
export function rmxColorAt(t, colors, mapping, seedIndex) {
  if (!colors || colors.length <= 1) return hexToRgb((colors && colors[0]) || '#888888');
  return hexToRgb(Organica.palette.colorAt(t, { mode: 'rmx', colors, submode: mapping, rnd: hash1(seedIndex) }));
}
