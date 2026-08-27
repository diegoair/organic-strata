/* ─────────────────────────────────────────────────────────────
   Rhizome node — Merge (Tier 1, native).

   Composites two SVG inputs into one document, B translated by
   (offsetX, offsetY) relative to A. Fixed 2-input for the MVP —
   a variadic-input port is real UI work (ports.js has no concept of a
   dynamic port count yet) deferred past Phase 1; two inputs is already
   enough to prove a real multi-input node in the graph.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';

export const meta = {
  id: 'merge',
  label: 'Merge',
  category: 'transform',
  inputs: [
    { name: 'a', type: PortType.SVG },
    { name: 'b', type: PortType.SVG },
  ],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'offsetX', type: 'number', min: -400, max: 400, default: 0 },
    { name: 'offsetY', type: 'number', min: -400, max: 400, default: 0 },
  ],
};

function innerMarkup(svgString) {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  return doc.documentElement ? doc.documentElement.innerHTML : '';
}

function viewBoxOf(svgString) {
  const m = svgString.match(/viewBox="([^"]+)"/);
  if (!m) return [0, 0, 400, 300];
  return m[1].split(/\s+/).map(Number);
}

export function compute(inputs, params) {
  const { a, b } = inputs;
  if (!a && !b) throw new Error('Merge has no SVG inputs connected.');
  const [, , w, h] = viewBoxOf(a || b);
  const partA = a ? innerMarkup(a) : '';
  const partB = b ? `<g transform="translate(${params.offsetX || 0},${params.offsetY || 0})">${innerMarkup(b)}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${partA}${partB}</svg>`;
}
