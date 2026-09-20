/* ─────────────────────────────────────────────────────────────────────────────
 * shape-appearance.js — Organica.shapeAppearance: Style (Fill/Stroke + Stroke
 * width + Rounded caps) and Width/Length stretch, as pure functions shared
 * between Genesis Create and FVS's Element step.
 *
 * Genesis had this first (its own local `styleAttrs()`/`formTransform()`);
 * FVS's Element tier had neither concept at all (every Seed was always a
 * plain solid fill, no stretch beyond the per-cell uniform `scale` Component/
 * Symbol already apply). Extracted here at the second consumer — same move
 * as shared/shapes.js. Genesis's Rotation stays tool-local (FVS already does
 * rotation per grid-cell). Uniform Scale + Move X/Y were first left out for
 * the same reason, then added to FVS's Element step (Sep 2026) as the optional
 * 4th arg of stretchTransformAttr, so its "Fit to canvas" button can write them.
 *
 * LOAD ORDER: core.js → shapes.js → shape-appearance.js → tool script.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // fillMode: 'fill' (plain solid, the default) | 'stroke' (outline only).
  // `color` is whatever the caller would otherwise have used as the fill —
  // Genesis passes its single `var(--ink)`; FVS passes the per-cell resolved
  // colour (colorAt(i)/cell.color) so a stroked Element still cycles through
  // the Palette exactly like a filled one does. No separate stroke colour —
  // reusing the existing fill colour was the deliberate choice over adding
  // a new colour concept.
  function styleAttrs({ fillMode, color, strokeW, rounded }) {
    if (fillMode === 'stroke') {
      return `fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="${rounded ? 'round' : 'butt'}" stroke-linejoin="round"`;
    }
    return `fill="${color}"`;
  }

  // Canvas2D counterpart of styleAttrs — sets the context's paint state and
  // tells the caller which draw op to run (`ctx.fill(path)` or `ctx.stroke(path)`).
  function applyCanvasStyle(ctx, { fillMode, color, strokeW, rounded }) {
    if (fillMode === 'stroke') {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeW;
      ctx.lineCap = rounded ? 'round' : 'butt';
      ctx.lineJoin = 'round';
      return 'stroke';
    }
    ctx.fillStyle = color;
    return 'fill';
  }

  // Non-uniform stretch (independent Width × Length), centred on the shape's
  // own box centre — the same "scale about centre" Genesis's formTransform()
  // already does, pulled out so FVS can apply just this piece (no rotation/
  // move) around its own 50-centred 0..100 box instead of Genesis's
  // 100-centred 0..200 one.
  // `opts` = {scale=1, mx=0, my=0}: a uniform scale multiplied into w/l and a
  // move (in the same 0..100 box units) applied after it. Omitted / all-default
  // → the exact string the 3-arg call always produced.
  function stretchTransformAttr(w, l, center, opts) {
    const o = opts || {}, s = o.scale == null ? 1 : o.scale, mx = o.mx || 0, my = o.my || 0;
    if (s === 1 && !mx && !my) return `translate(${center},${center}) scale(${w},${l}) translate(${-center},${-center})`;
    return `translate(${center + mx},${center + my}) scale(${w * s},${l * s}) translate(${-center},${-center})`;
  }

  Organica.shapeAppearance = { styleAttrs, applyCanvasStyle, stretchTransformAttr };
})(window);
