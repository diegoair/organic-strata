/* ─────────────────────────────────────────────────────────────
   Rhizome node — Merge (Tier 1, native, variadic input).

   Composites N SVG inputs into one document. Input 0 sits at its own
   origin; input i (i>0) is offset by (offsetXStep*i, offsetYStep*i) —
   a cascading step rather than N independent offset pairs, so the node
   doesn't need N dynamic param rows in the inspector (a real UI cost)
   to stay useful — a uniform step still produces genuinely different,
   controllable layouts (a diagonal stagger, a stacked grid) and input 0
   at zero offset is still the common "just merge" case.

   Input count is per-node-instance state (`params.inputCount`), not a
   fixed meta.inputs array — the first node in the graph whose own port
   list isn't static. See `getInputs()` below and node-registry.js's
   `getNodeInputs(node)` dispatcher, which every port-aware caller
   (node-card.js, execution-engine.js, ports.js's callbacks in main.js)
   goes through instead of reading `meta.inputs` directly.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';

export const MIN_INPUTS = 1, MAX_INPUTS = 6;

export const meta = {
  id: 'merge',
  label: 'Merge',
  category: 'transform',
  inputs: [],   // dynamic — see getInputs()
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'inputCount', type: 'number', min: MIN_INPUTS, max: MAX_INPUTS, default: 2 },
    { name: 'offsetXStep', type: 'number', min: -400, max: 400, default: 40 },
    { name: 'offsetYStep', type: 'number', min: -400, max: 400, default: 0 },
  ],
};

export function getInputs(node) {
  const n = Math.max(MIN_INPUTS, Math.min(MAX_INPUTS, node.params.inputCount || 2));
  return Array.from({ length: n }, (_, i) => ({ name: 'in' + i, type: PortType.SVG }));
}

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
  const n = Math.max(MIN_INPUTS, Math.min(MAX_INPUTS, params.inputCount || 2));
  const values = [];
  for (let i = 0; i < n; i++) values.push(inputs['in' + i]);
  const first = values.find(v => v);
  if (!first) throw new Error('Merge has no SVG inputs connected.');
  const [, , w, h] = viewBoxOf(first);
  const ox = params.offsetXStep || 0, oy = params.offsetYStep || 0;
  let body = '';
  values.forEach((v, i) => {
    if (!v) return;
    const inner = innerMarkup(v);
    body += i === 0 ? inner : `<g transform="translate(${ox * i},${oy * i})">${inner}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
