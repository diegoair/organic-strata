/* ─────────────────────────────────────────────────────────────
   Rhizome node — Living Path Preset (Tier 2 bridge, Phase 3).
   Seeds from the tool's own built-in Genesis-forms gallery (no upload
   needed) and applies one of its 29 presets (5 vector + 24 raster).
   Preset options are prefixed `tech:name` since Rhizome's param system
   has no cross-param-reactive dropdown (the raster/vector preset lists
   are disjoint) — one flat list is simpler than two params that would
   need to stay in sync. See the listener added to livingpath/index.html.
   ───────────────────────────────────────────────────────────── */

import { PortType } from '../port-types.js';
import { makeBridgeNode } from './bridge-iframe.js';

const VECTOR_PRESETS = ['Type-safe', 'Eroded', 'Liquid', 'Vortex', 'Shatter'];
const RASTER_PRESETS = [
  'Avulsion', 'Flood', 'Bulbs', 'Grain', 'Bubbles', 'Stream', 'Frog-eggs', 'Coral',
  'Cahn cells', 'Cahn bold', 'Beaded', 'Dilated', 'Rough bold', 'Pixel dust', 'Exploded',
  'Dotty bold', 'Dotty light', 'Thin line', 'Sliced', 'Gridouille', 'Faceted', 'Low-poly',
  'Sin-out', 'Sin-vert',
];
const OPTIONS = [
  ...VECTOR_PRESETS.map(n => 'vector:' + n),
  ...RASTER_PRESETS.map(n => 'raster:' + n),
];

export const { meta, compute } = makeBridgeNode({
  id: 'livingpath-preset',
  label: 'Living Path Preset',
  src: '/livingpath/',
  inputs: [],
  outputs: [{ name: 'svg', type: PortType.SVG }],
  params: [
    { name: 'preset', type: 'select', options: OPTIONS, default: 'raster:Coral' },
  ],
  buildPayload(inputs, params) {
    const raw = params.preset || 'raster:Coral';
    const i = raw.indexOf(':');
    return { tech: raw.slice(0, i), preset: raw.slice(i + 1) };
  },
});
