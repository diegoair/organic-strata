/* ─────────────────────────────────────────────────────────────
   Membrane — shared by every raster/vector seed source (Image, Text):
   the final "fit the sampled points onto the canvas" step. Procedural
   doesn't go through this — it spawns directly in canvas space, no
   external raster/outline to fit.
   ───────────────────────────────────────────────────────────── */
import { state, effectiveN } from '../state.js';

// result: { pts: [[x,y],...] relative to the source's own centre, iw, ih,
// refX, refY (the point that becomes centerX/centerY) }
export function applySeedResult(result) {
  const scale = Math.min(state.W / result.iw, state.H / result.ih) * state.imageScale;
  state.centerX = state.W / 2;
  state.centerY = state.H / 2;
  state.xs = result.pts.map(p => p[0] * scale);
  state.ys = result.pts.map(p => p[1] * scale);
  state.imgFit = { scale, refX: result.refX, refY: result.refY };
}

export { effectiveN };
