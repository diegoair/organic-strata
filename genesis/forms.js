// Base Seed SVG templates — the 13 organic forms of Genesis's "Base Seeds" set
// (the 6 procedural primitives are synthesised in genesis/index.html). Keyed by
// their canonical id `seed-<slug>` (matches the base_seeds table's seed_id — DB
// wins if they ever disagree). The `class="aNN"` hooks are retained for the hub
// bento's animated preview only; Genesis renders these static.
window.ORGANIC_FORMS = {
  'seed-breath': `<svg viewBox="0 0 200 200" class="a01"><circle class="b" cx="100" cy="100" r="58"/></svg>`,
  'seed-heartbeat': `<svg viewBox="0 0 200 200" class="a02"><path class="b" d="M100 50 q40 0 46 38 q4 32 -28 50 q-22 12 -38 0 q-30 -18 -28 -50 q4 -38 48 -38z"/></svg>`,
  'seed-metaballs': `<svg viewBox="0 0 200 200" class="a03"><g><circle class="l" cx="100" cy="100" r="26"/><circle class="r" cx="100" cy="100" r="26"/></g></svg>`,
  'seed-drop-fall': `<svg viewBox="0 0 200 200" class="a07">
  <path class="drop" d="M100 70 q-14 18 -14 32 a14 14 0 0 0 28 0 q0 -14 -14 -32z"/>
  <circle class="sp" cx="100" cy="140" r="0"/>
</svg>`,
  'seed-lava-detach': `<svg viewBox="0 0 200 200" class="a09"><g>
  <ellipse class="pool" cx="100" cy="170" rx="56" ry="22"/>
  <ellipse class="blob" cx="100" cy="130" rx="22" ry="20"/>
</g></svg>`,
  'seed-flower-bloom': `<svg viewBox="0 0 200 200" class="a13"><g class="p">
  <ellipse cx="100" cy="64" rx="14" ry="34"/>
  <ellipse cx="100" cy="136" rx="14" ry="34"/>
  <ellipse cx="64" cy="100" rx="34" ry="14"/>
  <ellipse cx="136" cy="100" rx="34" ry="14"/>
  <ellipse cx="74" cy="74" rx="14" ry="30" transform="rotate(-45 74 74)"/>
  <ellipse cx="126" cy="74" rx="14" ry="30" transform="rotate(45 126 74)"/>
  <ellipse cx="74" cy="126" rx="14" ry="30" transform="rotate(45 74 126)"/>
  <ellipse cx="126" cy="126" rx="14" ry="30" transform="rotate(-45 126 126)"/>
  <circle class="core" cx="100" cy="100" r="12"/>
</g></svg>`,
  'seed-petal-turn': `<svg viewBox="0 0 200 200" class="a14"><g class="t">
  <path d="M100 100 q40 -30 0 -60 q-40 30 0 60"/>
  <path d="M100 100 q40 30 0 60 q-40 -30 0 -60"/>
  <path d="M100 100 q30 40 60 0 q-30 -40 -60 0"/>
  <path d="M100 100 q-30 40 -60 0 q30 -40 60 0"/>
</g></svg>`,
  'seed-caterpillar': `<svg viewBox="0 0 200 200" class="a21">
  <circle class="c1" cx="50" cy="100" r="14"/>
  <circle class="c2" cx="76" cy="100" r="14"/>
  <circle class="c3" cx="102" cy="100" r="14"/>
  <circle class="c4" cx="128" cy="100" r="14"/>
  <circle class="c5" cx="154" cy="100" r="14"/>
</svg>`,
  'seed-amoeba': `<svg viewBox="0 0 200 200" class="a26">
  <path d="M100 30 q44 0 50 50 q4 40 -38 56 q-44 14 -64 -16 q-22 -36 6 -68 q22 -22 46 -22z"/>
</svg>`,
  'seed-mitosis': `<svg viewBox="0 0 200 200" class="a28"><g>
  <circle cx="100" cy="100" r="22"/>
  <circle cx="70" cy="100" r="18"/>
  <circle cx="130" cy="100" r="18"/>
</g></svg>`,
  'seed-sun': `<svg viewBox="0 0 200 200" class="a37">
  <circle class="core" cx="100" cy="100" r="18"/>
  <g>
    <line class="ray" x1="100" y1="40" x2="100" y2="58"/>
    <line class="ray r2" x1="100" y1="160" x2="100" y2="142"/>
    <line class="ray" x1="40" y1="100" x2="58" y2="100"/>
    <line class="ray r2" x1="160" y1="100" x2="142" y2="100"/>
    <line class="ray" x1="58" y1="58" x2="70" y2="70"/>
    <line class="ray r2" x1="142" y1="142" x2="130" y2="130"/>
    <line class="ray" x1="142" y1="58" x2="130" y2="70"/>
    <line class="ray r2" x1="58" y1="142" x2="70" y2="130"/>
  </g>
</svg>`,
  'seed-bubble-cluster': `<svg viewBox="0 0 200 200" class="a41"><g>
  <circle class="b1" cx="86" cy="100" r="22"/>
  <circle class="b2" cx="120" cy="92" r="18"/>
  <circle class="b3" cx="104" cy="124" r="16"/>
  <circle class="b4" cx="76" cy="76" r="14"/>
</g></svg>`,
  'seed-line': `<svg viewBox="0 0 200 200" class="a56"><line x1="36" y1="100" x2="164" y2="100" stroke="currentColor" stroke-width="10" stroke-linecap="round"/></svg>`,
};
window.ORGANIC_LABELS = {
  'seed-breath': 'breath', 'seed-heartbeat': 'heartbeat', 'seed-metaballs': 'metaballs',
  'seed-drop-fall': 'drop fall', 'seed-lava-detach': 'lava detach',
  'seed-flower-bloom': 'flower bloom', 'seed-petal-turn': 'petal turn',
  'seed-caterpillar': 'caterpillar', 'seed-amoeba': 'amoeba', 'seed-mitosis': 'mitosis',
  'seed-sun': 'sun', 'seed-bubble-cluster': 'bubble cluster', 'seed-line': 'line',
};
