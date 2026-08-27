/* ─────────────────────────────────────────────────────────────
   Rhizome node — Export (Tier 1, native, sink node).

   PNG/SVG/JSON/Figma output — reuses Organica.download/stamp exactly
   like every other tool, and Organica.sendToFigma now that the
   figma-plugin/code.js listener has been fixed (Piano Parte 3.0).
   This is a "sink": compute() has no meaningful return value, its job
   is the side effect. The actual button click that fires it lives in
   renderers/node-card.js — this file only owns what happens on click.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';

export const meta = {
  id: 'export',
  label: 'Export',
  category: 'sink',
  inputs: [{ name: 'svg', type: PortType.SVG }],
  outputs: [],
  params: [
    { name: 'scale', type: 'select', options: ['1', '2', '4'], default: '2' },
  ],
};

// Sink nodes don't participate in dirty-flag recompute the way transform
// nodes do — compute() just passes the input through so the node card
// can show a live preview of what would export.
export function compute(inputs) {
  return inputs.svg || null;
}

function svgToPNGBlob(svgString, scale) {
  return new Promise((resolve, reject) => {
    const m = svgString.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const w = m ? parseFloat(m[1]) : 400, h = m ? parseFloat(m[2]) : 300;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale; canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG failed to rasterize')); };
    img.src = url;
  });
}

export async function exportPNG(svgString, scale) {
  const blob = await svgToPNGBlob(svgString, scale);
  Organica.download(blob, Organica.stamp('rhizome', 'png'));
}

export function exportSVG(svgString) {
  Organica.download(new Blob([svgString], { type: 'image/svg+xml' }), Organica.stamp('rhizome', 'svg'));
}

export function sendToFigma(svgString) {
  Organica.sendToFigma(svgString, 'Rhizome');
}
