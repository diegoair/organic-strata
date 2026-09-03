// Base Seed definitions — Genesis's 13 organic "Base Seeds".
// (The 6 procedural primitives are synthesised in genesis/index.html.)
//
// One entry per seed, keyed by its canonical id `seed-<slug>` (matches the
// base_seeds table's seed_id — DB wins if they ever disagree). Each entry
// carries its display label, kind, tags and an approximate content bbox
// ([x, y, w, h] inside the `0 0 200 200` viewBox) alongside the static SVG
// markup.
//
// The SVG is class-free and paints with `fill="var(--ink)"` /
// `stroke="var(--ink)"` so the host controls the colour (Critical Rule —
// forms never hardcode a hex). Genesis renders these static; the old
// `class="aNN"` / presentation-class hooks that bound them to
// genesis/animations.css were dropped 2026-09-03 (nothing consumed them any
// more — Genesis and the hub bento both render static).
window.ORGANIC_SEEDS = {
  'seed-breath': {
    label: 'breath', type: 'asset', tags: ['circle', 'single'], bbox: [42, 42, 116, 116],
    svg: `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="58" fill="var(--ink)"/></svg>`,
  },
  'seed-heartbeat': {
    label: 'heartbeat', type: 'asset', tags: ['blob', 'single'], bbox: [60, 50, 88, 90],
    svg: `<svg viewBox="0 0 200 200"><path d="M100 50 q40 0 46 38 q4 32 -28 50 q-22 12 -38 0 q-30 -18 -28 -50 q4 -38 48 -38z" fill="var(--ink)"/></svg>`,
  },
  'seed-metaballs': {
    label: 'metaballs', type: 'asset', tags: ['circle', 'cluster'], bbox: [74, 74, 52, 52],
    svg: `<svg viewBox="0 0 200 200"><g fill="var(--ink)"><circle cx="100" cy="100" r="26"/><circle cx="100" cy="100" r="26"/></g></svg>`,
  },
  'seed-drop-fall': {
    label: 'drop fall', type: 'asset', tags: ['blob', 'single'], bbox: [86, 70, 28, 46],
    svg: `<svg viewBox="0 0 200 200"><path d="M100 70 q-14 18 -14 32 a14 14 0 0 0 28 0 q0 -14 -14 -32z" fill="var(--ink)"/></svg>`,
  },
  'seed-lava-detach': {
    label: 'lava detach', type: 'asset', tags: ['blob', 'cluster'], bbox: [44, 108, 112, 84],
    svg: `<svg viewBox="0 0 200 200"><g fill="var(--ink)"><ellipse cx="100" cy="170" rx="56" ry="22"/><ellipse cx="100" cy="130" rx="22" ry="20"/></g></svg>`,
  },
  'seed-flower-bloom': {
    label: 'flower bloom', type: 'asset', tags: ['petal', 'radial'], bbox: [30, 30, 140, 140],
    svg: `<svg viewBox="0 0 200 200"><g fill="var(--ink)">
  <ellipse cx="100" cy="64" rx="14" ry="34"/>
  <ellipse cx="100" cy="136" rx="14" ry="34"/>
  <ellipse cx="64" cy="100" rx="34" ry="14"/>
  <ellipse cx="136" cy="100" rx="34" ry="14"/>
  <ellipse cx="74" cy="74" rx="14" ry="30" transform="rotate(-45 74 74)"/>
  <ellipse cx="126" cy="74" rx="14" ry="30" transform="rotate(45 126 74)"/>
  <ellipse cx="74" cy="126" rx="14" ry="30" transform="rotate(45 74 126)"/>
  <ellipse cx="126" cy="126" rx="14" ry="30" transform="rotate(-45 126 126)"/>
  <circle cx="100" cy="100" r="12"/>
</g></svg>`,
  },
  'seed-petal-turn': {
    label: 'petal turn', type: 'asset', tags: ['petal', 'radial'], bbox: [40, 40, 120, 120],
    svg: `<svg viewBox="0 0 200 200"><g fill="var(--ink)">
  <path d="M100 100 q40 -30 0 -60 q-40 30 0 60"/>
  <path d="M100 100 q40 30 0 60 q-40 -30 0 -60"/>
  <path d="M100 100 q30 40 60 0 q-30 -40 -60 0"/>
  <path d="M100 100 q-30 40 -60 0 q30 -40 60 0"/>
</g></svg>`,
  },
  'seed-caterpillar': {
    label: 'caterpillar', type: 'asset', tags: ['circle', 'chain'], bbox: [36, 86, 132, 28],
    svg: `<svg viewBox="0 0 200 200"><g fill="var(--ink)">
  <circle cx="50" cy="100" r="14"/>
  <circle cx="76" cy="100" r="14"/>
  <circle cx="102" cy="100" r="14"/>
  <circle cx="128" cy="100" r="14"/>
  <circle cx="154" cy="100" r="14"/>
</g></svg>`,
  },
  'seed-amoeba': {
    label: 'amoeba', type: 'asset', tags: ['blob', 'single'], bbox: [36, 30, 116, 108],
    svg: `<svg viewBox="0 0 200 200"><path d="M100 30 q44 0 50 50 q4 40 -38 56 q-44 14 -64 -16 q-22 -36 6 -68 q22 -22 46 -22z" fill="var(--ink)"/></svg>`,
  },
  'seed-mitosis': {
    label: 'mitosis', type: 'asset', tags: ['circle', 'cluster'], bbox: [52, 78, 96, 44],
    svg: `<svg viewBox="0 0 200 200"><g fill="var(--ink)">
  <circle cx="100" cy="100" r="22"/>
  <circle cx="70" cy="100" r="18"/>
  <circle cx="130" cy="100" r="18"/>
</g></svg>`,
  },
  'seed-sun': {
    label: 'sun', type: 'asset', tags: ['line', 'radial'], bbox: [40, 40, 120, 120],
    svg: `<svg viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="18" fill="var(--ink)"/>
  <g stroke="var(--ink)" stroke-width="3" stroke-linecap="round">
    <line x1="100" y1="40" x2="100" y2="58"/>
    <line x1="100" y1="160" x2="100" y2="142"/>
    <line x1="40" y1="100" x2="58" y2="100"/>
    <line x1="160" y1="100" x2="142" y2="100"/>
    <line x1="58" y1="58" x2="70" y2="70"/>
    <line x1="142" y1="142" x2="130" y2="130"/>
    <line x1="142" y1="58" x2="130" y2="70"/>
    <line x1="58" y1="142" x2="70" y2="130"/>
  </g>
</svg>`,
  },
  'seed-bubble-cluster': {
    label: 'bubble cluster', type: 'asset', tags: ['circle', 'cluster'], bbox: [62, 62, 76, 78],
    svg: `<svg viewBox="0 0 200 200"><g fill="var(--ink)">
  <circle cx="86" cy="100" r="22"/>
  <circle cx="120" cy="92" r="18"/>
  <circle cx="104" cy="124" r="16"/>
  <circle cx="76" cy="76" r="14"/>
</g></svg>`,
  },
  'seed-line': {
    label: 'line', type: 'asset', tags: ['line', 'single'], bbox: [31, 95, 138, 10],
    svg: `<svg viewBox="0 0 200 200"><line x1="36" y1="100" x2="164" y2="100" stroke="var(--ink)" stroke-width="10" stroke-linecap="round"/></svg>`,
  },
};

// ── Back-compat flat maps, derived from ORGANIC_SEEDS ──────────────────────
// Every existing consumer (genesis/index.html, shared/seeds-panel.js, pollen,
// spore, livingpath, the hub bento) reads these two. Insertion order of
// ORGANIC_SEEDS is preserved, so `Object.keys(ORGANIC_FORMS)` still yields the
// 13 in their intended order.
window.ORGANIC_FORMS = {};
window.ORGANIC_LABELS = {};
for (const id in window.ORGANIC_SEEDS) {
  window.ORGANIC_FORMS[id] = window.ORGANIC_SEEDS[id].svg;
  window.ORGANIC_LABELS[id] = window.ORGANIC_SEEDS[id].label;
}
