/* ─────────────────────────────────────────────────────────────
   Canvas Manager — the physical space every grid resolves into.
   Pure data + helpers, no DOM. Width/height/unit/margin/safeArea/bleed,
   matching the brief's own field list (docs/organica-camouflage-tool-brief.md
   is a different brief; this one is the Grid Definition doc). Bleed is
   always entered in mm regardless of canvas unit — the real print
   convention (a bleed spec doesn't change because the document happens to
   be quoted in cm), same reasoning Komorebi/Halide's own px-vs-mm splits
   use elsewhere in Organica.

   UNITS — px vs. the metric family (mm/cm/m). mm/cm/m convert between
   each other with clean decimal factors; px does not — a CSS pixel has no
   fixed physical size, so "converting" px to mm would mean silently
   assuming a DPI nobody asked for. The two families are kept genuinely
   separate: px passes through unconverted (exactly today's pre-existing
   behaviour); mm/cm/m all canonicalise to an internal MM-EQUIVALENT
   number before any geometry math runs, so a Kiwi/parametric generator
   never has to know or care which of the three the user actually typed.
   canvas.width/height below ARE that canonical number — every generator,
   innerRect/safeAreaRect, and the on-screen canvas-frame sizing (still
   "1 canonical unit = 1 CSS px", the same simplification mm alone used
   before cm/m existed) all read it directly. canvas.displayWidth/
   displayHeight/unit are kept alongside, unconverted, ONLY for showing
   the user back their own numbers and for export labelling.
   ───────────────────────────────────────────────────────────── */

export const UNIT_TO_MM = { mm: 1, cm: 10, m: 1000 };

// px has no canonical physical size — pass through. mm/cm/m canonicalise
// to mm-equivalents so canvas.width/height, Gap and Padding (main.js's
// own unitVal()) all end up in the SAME coordinate space regardless of
// which of the three the user is currently working in.
export function toCanonical(value, unit) {
  return unit === 'px' ? value : value * (UNIT_TO_MM[unit] || 1);
}

function clampCanonical(v) {
  return Math.min(MAX_CANONICAL, Math.max(MIN_CANONICAL, v));
}

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

// Absolute floor in CANONICAL units — well above any generator's own
// per-track minimum (Kiwi's solveTracksKiwi hard-constrains each track to
// >= 16), so a canvas this small or larger always has room to satisfy
// its constraints. Below it, Kiwi throws "unsatisfiable constraint" as an
// UNCAUGHT exception — reproduced live: typing a physically tiny size in
// a large unit (e.g. "0.21" while working in m = 210mm, perfectly
// reasonable) then switching to px with no conversion (px has no
// physical equivalent to convert TO, so the raw number is deliberately
// left alone) leaves canvas.width at 0.21 canonical units, and the whole
// app crashes rather than just rendering something degenerate. One floor
// here, at the single choke point every generator/renderer reads
// canvas.width/height through, protects all of them at once.
const MIN_CANONICAL = 20;

// Ceiling, same reasoning in reverse: 50 000 canonical units = 50m at any
// physical unit (mm/cm/m alike) or 50 000px if working in raw px. Chosen
// to stay comfortably inside the range already verified working this
// session — createZoomPan's own min:0.01 fits a canvas up to roughly
// 50–100m before its "zoom clamps to min, pan zeroes" edge case (this
// session's own §"cm/m made the canvas disappear") could resurface — 50m
// leaves real headroom under that, while still covering every realistic
// Studio Rann mural (murals in practice run well under it; a building
// facade beyond 50m is the rare exception, not the common case).
const MAX_CANONICAL = 50000;

/**
 * @param {{width:number, height:number, unit:'px'|'mm'|'cm'|'m', marginPct:number, safeAreaPct:number, bleed:number}} opts
 */
export function createCanvas({ width, height, unit = 'px', marginPct = 0, safeAreaPct = 0, bleed = 0 }) {
  const cw = clampCanonical(toCanonical(width, unit));
  const ch = clampCanonical(toCanonical(height, unit));
  return {
    width: cw, height: ch,             // canonical — every generator/renderer reads this
    displayWidth: width, displayHeight: height, unit,   // what the user actually typed, for labels only
    orientation: cw >= ch ? 'landscape' : 'portrait',
    // MVP simplification, disclosed rather than hidden: one margin value
    // applied to all four sides. Per-side margins are a real brief
    // requirement ("Margins" is its own constraint parameter) — deferred
    // to the phase that adds WYSIWYG editing, since per-side controls want
    // a visual handle, not four more sliders nobody will tune blind.
    margin: marginPct,
    safeArea: safeAreaPct,
    bleed: unit !== 'px' ? bleed : 0,   // always mm-equivalent already, never re-converted (see header)
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
