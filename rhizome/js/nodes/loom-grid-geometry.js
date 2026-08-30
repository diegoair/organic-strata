/* ─────────────────────────────────────────────────────────────
   Rhizome node — Loom Grid → Geometry (Tier 1, zero-porting).

   Thin wrapper on Organica.loadLoomGrid (shared/core.js:234),
   the one genuine cross-tool JSON contract already in the repo (Piano
   Parte 1). Lets an externally-exported Loom grid (from the real /loom/
   tool, not just the in-graph Loom Grid Generator node) become a source
   node in the pipeline — a designer can build a grid visually in Loom,
   export it, and drop it in here.

   `params.json` holds the raw uploaded text (a 'file' param type,
   handled by renderers/inspector-panel.js — see its own comment for why
   the param lives as plain text rather than parsed state).
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';

export const meta = {
  id: 'loom-grid-geometry',
  label: 'Loom Grid → Geometry',
  category: 'source',
  inputs: [],
  outputs: [{ name: 'grid', type: PortType.GRID }],
  params: [
    { name: 'json', type: 'file', accept: '.json,application/json', default: '' },
  ],
};

export function compute(inputs, params) {
  if (!params.json) throw new Error('No Loom grid JSON loaded yet — upload one in the node panel.');
  return Organica.loadLoomGrid(params.json);
}
