/* ─────────────────────────────────────────────────────────────
   Canvas Manager — the physical space every grid resolves into.
   Pure data + helpers, no DOM. Width/height/unit/margin/safeArea/bleed,
   matching the brief's own field list (docs/organica-camouflage-tool-brief.md
   is a different brief; this one is the Grid Definition doc). Bleed only
   applies in mm (print), same convention Komorebi/Halide use for their
   own px-vs-mm decisions elsewhere in Organica.
   ───────────────────────────────────────────────────────────── */

// "Industry standard" presets per the brief — a first pass, not exhaustive.
// Width/height are in the preset's own natural unit; Loom's own Unit control
// only changes how the CUSTOM width/height fields below are interpreted.
export const CANVAS_PRESETS = {
  'Square 1:1': { width: 1080, height: 1080, unit: 'px' },
  'Landscape 16:9': { width: 1920, height: 1080, unit: 'px' },
  'Portrait 4:5': { width: 1080, height: 1350, unit: 'px' },
  'Widescreen 3:2': { width: 1620, height: 1080, unit: 'px' },
  'A4 portrait': { width: 210, height: 297, unit: 'mm' },
  'A4 landscape': { width: 297, height: 210, unit: 'mm' },
  'Letter portrait': { width: 215.9, height: 279.4, unit: 'mm' },
};

/**
 * @param {{width:number, height:number, unit:'px'|'mm', marginPct:number, safeAreaPct:number, bleed:number}} opts
 */
export function createCanvas({ width, height, unit = 'px', marginPct = 0, safeAreaPct = 0, bleed = 0 }) {
  return {
    width, height, unit,
    orientation: width >= height ? 'landscape' : 'portrait',
    // MVP simplification, disclosed rather than hidden: one margin value
    // applied to all four sides. Per-side margins are a real brief
    // requirement ("Margins" is its own constraint parameter) — deferred
    // to the phase that adds WYSIWYG editing, since per-side controls want
    // a visual handle, not four more sliders nobody will tune blind.
    margin: marginPct,
    safeArea: safeAreaPct,
    bleed: unit === 'mm' ? bleed : 0,
  };
}

// The rect every grid actually resolves inside — canvas minus margin
// (a percentage of the shorter side, so portrait and landscape canvases
// get proportionally similar margins rather than one axis being crushed).
export function innerRect(canvas) {
  const shortSide = Math.min(canvas.width, canvas.height);
  const m = shortSide * (canvas.margin / 100);
  return {
    x: m, y: m,
    width: Math.max(1, canvas.width - 2 * m),
    height: Math.max(1, canvas.height - 2 * m),
  };
}

// Safe-area rect, purely a guide (never clips generator output in this
// phase) — nested inside the margin rect, same percentage convention.
export function safeAreaRect(canvas) {
  const inner = innerRect(canvas);
  const shortSide = Math.min(inner.width, inner.height);
  const s = shortSide * (canvas.safeArea / 100);
  return {
    x: inner.x + s, y: inner.y + s,
    width: Math.max(1, inner.width - 2 * s),
    height: Math.max(1, inner.height - 2 * s),
  };
}
