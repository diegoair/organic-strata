/* ─────────────────────────────────────────────────────────────
   SVG renderer — reads resolved cell rects (json-model.js's own
   resolveCellRects), draws each as an outlined rect. A grid DEFINITION
   export — guides for a designer to build on in Figma/Affinity, not
   filled shapes claiming to be a finished layout.
   ───────────────────────────────────────────────────────────── */

function r2(n) { return Math.round(n * 100) / 100; }

export function renderSVG(model, rects, inner) {
  const { canvas } = model;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(canvas.width)}" height="${r2(canvas.height)}" viewBox="0 0 ${r2(canvas.width)} ${r2(canvas.height)}">`;
  s += `<rect width="100%" height="100%" fill="#ffffff"/>`;
  s += `<rect x="${r2(inner.x)}" y="${r2(inner.y)}" width="${r2(inner.width)}" height="${r2(inner.height)}" fill="none" stroke="#c8c0b0" stroke-width="0.75" stroke-dasharray="3 3"/>`;
  rects.forEach(c => {
    s += `<rect x="${r2(c.x)}" y="${r2(c.y)}" width="${r2(c.width)}" height="${r2(c.height)}" fill="none" stroke="#0a0a0a" stroke-width="1"/>`;
  });
  s += '</svg>';
  return s;
}
