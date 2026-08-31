/* ─────────────────────────────────────────────────────────────
   Rhizome node — SVG → Points (Tier 1, zero-porting).

   Thin wrapper on Organica.motion.parsePrimitives (shared/motion.js) —
   the most general "ingest arbitrary SVG into typed JS objects"
   mechanism in the repo.
   Silently drops any unsupported tag (text/image/defs/gradient/
   clipPath/use — see the shared function's own header) rather than
   erroring, matching its existing documented behaviour.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';

export const meta = {
  id: 'svg-to-points',
  label: 'SVG → Points',
  category: 'transform',
  inputs: [{ name: 'svg', type: PortType.SVG }],
  outputs: [{ name: 'points', type: PortType.POINTS }],
  params: [],
};

export function compute(inputs) {
  const { svg } = inputs;
  if (!svg) throw new Error('SVG → Points has no SVG input connected.');
  const { primitives } = Organica.motion.parsePrimitives(svg);
  return primitives.map(p => ({ x: p.cx, y: p.cy }));
}
