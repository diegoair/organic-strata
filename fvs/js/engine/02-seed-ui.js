// Flexible Visual System · engine/02-seed-ui — the engine part of 02-seed-ui.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically by scripts/fvs-engine.mjs. Map: docs/FVS.md §Architecture.
import {
  SYMBOL_ARC, SYMBOL_ARC_TRUCHET, SYMBOL_CHEVRON, SYMBOL_CROSS, SYMBOL_INNER, SYMBOL_LENS, SYMBOL_POLYGON,
  SYMBOL_ROUNDEDRECT, SYMBOL_STAR, SYMBOL_TRIANGLE, SYMBOL_WEDGE
} from './01-geometry.js';
// Symbols cells carry no per-seed params of their own (same as they already
// ignore Base/Height/Thickness) — one merged params object covers every
// SEED_TYPES geometry fn, each reading only the fields it needs.
// ── Seed extras registry (Star · Square · Chevron · Cross · Lens · Segment · Drop · Blob) ──
// The row definitions (labels, ranges, defaults) live in shared/shapes.js → Organica.shapes.EXTRAS so Genesis
// Create reads the SAME table. Here: the FVS-side prefix + the derived Type shortcuts. One table drives, per
// shape: the panel rows (built into #seed-<shape>-block at boot), getSeed() keys, snapshot load (old entries
// fall back to `def`), the generic listeners and the Symbols defaults. Keys are shape-prefixed, never shared.
export const SEED_EXTRAS = {
  star: { prefix: "star", rows: Organica.shapes.EXTRAS.star, type: { label: "Star type", title: "Shortcut that sets Points, Inner radius, Edge curvature and Tip rounding. Reads Custom as soon as you move any of them by hand.",
    presets: { star: ["Star", {"rg-star-points": 5, "rg-star-inner": 45, "rg-star-curve": 0, "rg-star-tip": 0}], burst: ["Burst", {"rg-star-points": 12, "rg-star-inner": 70, "rg-star-curve": 0, "rg-star-tip": 0}], sparkle: ["Sparkle", {"rg-star-points": 4, "rg-star-inner": 20, "rg-star-curve": -50, "rg-star-tip": 0}], badge: ["Badge", {"rg-star-points": 12, "rg-star-inner": 88, "rg-star-curve": 0, "rg-star-tip": 40}] } } },
  roundedrect: { prefix: "rr", rows: Organica.shapes.EXTRAS.roundedrect, type: { label: "Square type", title: "Shortcut that sets Width, Height and Rounding. Reads Custom as soon as you move any of them by hand.",
    presets: { square: ["Square", {"rg-rr-width": 100, "rg-rr-height": 100, "rg-rr-corner": 0}], landscape: ["Landscape", {"rg-rr-width": 100, "rg-rr-height": 60, "rg-rr-corner": 0}], portrait: ["Portrait", {"rg-rr-width": 60, "rg-rr-height": 100, "rg-rr-corner": 0}], pill: ["Pill", {"rg-rr-width": 100, "rg-rr-height": 50, "rg-rr-corner": 100}] } } },
  chevron: { prefix: "chev", rows: Organica.shapes.EXTRAS.chevron },
  cross: { prefix: "cross", rows: Organica.shapes.EXTRAS.cross, type: { label: "Cross type", title: "Shortcut that sets Arms. Reads Custom as soon as you move it by hand. (An X is a Plus with Look & place → Rotate 45.)",
    presets: { plus: ["Plus", {"rg-cross-arms": 4}], y: ["Y", {"rg-cross-arms": 3}], asterisk: ["Asterisk", {"rg-cross-arms": 6}] } } },
  lens: { prefix: "lens", rows: Organica.shapes.EXTRAS.lens },
  segment: { prefix: "seg", rows: Organica.shapes.EXTRAS.segment },
  drop: { prefix: "drop", rows: Organica.shapes.EXTRAS.drop },
  blob: { prefix: "blob", rows: Organica.shapes.EXTRAS.blob },
};
export const SEED_EXTRAS_DEFAULTS = {};
Object.values(SEED_EXTRAS).forEach(sh => sh.rows.forEach(r => { SEED_EXTRAS_DEFAULTS[r.key] = r.def; }));
export const xrId = (sh, r) => (r.kind === 'select' ? 'sel-' : 'rg-') + sh.prefix + '-' + r.id;
export const SYMBOL_SEED_DEFAULTS = { base: 100, height: 100, thickness: 100, ...SYMBOL_ARC_TRUCHET, ...SYMBOL_ARC, ...SYMBOL_WEDGE, ...SYMBOL_POLYGON, ...SYMBOL_STAR, ...SYMBOL_ROUNDEDRECT, ...SYMBOL_CHEVRON, ...SYMBOL_CROSS, ...SYMBOL_LENS, ...SYMBOL_TRIANGLE, ...SYMBOL_INNER, ...SEED_EXTRAS_DEFAULTS };
// ── Seed type picker (thumbnail dropdown — shared/select-picker.js) ──
// 26×26 pictograms, currentColor, like Genesis Create's Kind picker.
export const SI = (inner, mode) => `<svg viewBox="0 0 26 26" ${mode === 'stroke' ? 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"'}>${inner}</svg>`;
export const SEED_ICONS = {
  arc: { name: 'Arc', icon: SI('<path d="M4,4 L22,4 A18,18 0 0,1 4,22 Z"/>') },
  arctruchet: { name: 'Arc truchet', icon: SI('<path d="M4 13 A9 9 0 0 1 22 13 M8 13 A5 5 0 0 1 18 13 M4 13 A9 9 0 0 0 22 13 M8 13 A5 5 0 0 0 18 13"/>', 'stroke') },
  blob: { name: 'Blob', icon: SI('<path d="M13,4 C18,3 22,7 21,12 C23,17 19,22 13,21 C7,23 3,18 5,13 C3,8 8,3 13,4 Z"/>') },
  chevron: { name: 'Chevron', icon: SI('<polygon points="13,4 23,22 17,22 13,13 9,22 3,22"/>') },
  circle: { name: 'Circle', icon: SI('<circle cx="13" cy="13" r="9"/>') },
  cross: { name: 'Cross', icon: SI('<polygon points="10,3 16,3 16,10 23,10 23,16 16,16 16,23 10,23 10,16 3,16 3,10 10,10"/>') },
  drop: { name: 'Drop', icon: SI('<path d="M13,3 C9,10 5,13 5,17 A8,8 0 0,0 21,17 C21,13 17,10 13,3 Z"/>') },
  freehand: { name: 'Freehand', icon: SI('<path d="M4 20 C7 8 11 8 13 14 C15 20 19 20 22 6"/>', 'stroke') },
  lens: { name: 'Lens', icon: SI('<path d="M13 3 C21 8 21 18 13 23 C5 18 5 8 13 3 Z"/>') },
  polygon: { name: 'Polygon', icon: SI('<polygon points="13,3 22,9.5 18.5,20.5 7.5,20.5 4,9.5"/>') },
  segment: { name: 'Segment', icon: SI('<line x1="4" y1="13" x2="22" y2="13"/>', 'stroke') },
  roundedrect: { name: 'Square', icon: SI('<rect x="5" y="5" width="16" height="16"/>') },   // value roundedrect (Width / Height / Rounding make rectangles and pills too)
  star: { name: 'Star', icon: SI('<polygon points="13,3 15.8,10.2 23,10.8 17.5,15.5 19.2,22.5 13,18.7 6.8,22.5 8.5,15.5 3,10.8 10.2,10.2"/>') },
  triangle: { name: 'Triangle', icon: SI('<polygon points="13,4 23,22 3,22"/>') },
  wedge: { name: 'Wedge', icon: SI('<path d="M13 22 L4.5 8 A11 11 0 0 1 21.5 8 Z"/>') },
  custom: { name: 'Custom (uploaded)', icon: SI('<rect x="4" y="4" width="18" height="18" stroke-dasharray="2.5 2.5"/><path d="M13 17 V9 M9.5 12 L13 8.5 L16.5 12"/>', 'stroke') },
};
// Circle modifiers: [getSeed key, control id suffix, default]. One table
// drives getSeed(), the snapshot restore and the input listeners.
export const CIRCLE_PARAMS = [
  ['round', 'round', 0], ['rotate', 'rotate', 0], ['lobes', 'lobes', 0], ['lobeDepth', 'lobedepth', 20], ['inner', 'inner', 50],
  ['ringCount', 'ringcount', 3], ['ringRatio', 'ringratio', 55], ['holes', 'holes', 6], ['holeSize', 'holesize', 14], ['holeRing', 'holering', 60],
  ['cutPos', 'cutpos', 0], ['cutAngle', 'cutangle', 0], ['biteRadius', 'biteradius', 70], ['biteOffset', 'biteoffset', 60], ['biteAngle', 'biteangle', 45],
  ['slices', 'slices', 6], ['sliceGap', 'slicegap', 6],
];
export const cap = k => 'circle' + k[0].toUpperCase() + k.slice(1);
// getSeed()-shaped params → circleAdvanced opts (only what's defined, so a
// Symbol's bare defaults object stays a plain circle).
export function circleOptsFrom(p) {
  const o = {};
  CIRCLE_PARAMS.forEach(([k]) => { if (p[cap(k)] != null) o[k] = p[cap(k)]; });
  if (p.circleInterior) o.interior = p.circleInterior;
  if (p.circleTrim) o.trim = p.circleTrim;
  return o;
}
// key prefix → Seed type, for the retired keys (RETIRED_SEED) — the note only speaks about the shape on screen
export const RETIRED_PREFIX = { tri: 'triangle', arc: 'arc', circle: 'circle', poly: 'polygon', star: 'star', blob: 'blob', wedge: 'wedge', chev: 'chevron', rr: 'roundedrect', cross: 'cross', lens: 'lens', drop: 'drop' };
// ── Retired controls (Oct 4, 2026) → Appearance, on load ──────────────
// Radius (Circle / Polygon / Star) = Scale, Squash (Wedge / Chevron) = Length and a shape's own Rotate =
// Appearance Rotate, so those rows are gone from the panel (their inputs live on, hidden, in #seed-legacy).
// A snapshot saved with one of them is converted when it is loaded for editing: the value moves into the
// placement (Appearance for a single shape, the layer's own place/look in a stack) and the seed key goes
// back to its default — but ONLY when the two pictures are the same, checked by sampling both shapes on a
// 64×64 grid. Anything that would change (a refit after rotating, a Stroke whose width would scale…) keeps
// its legacy value, so it renders exactly as it was saved. Saved Components / Symbols never go through
// here: they render from their stored seed, unchanged.
export const RETIRED_SEED = [
  // [seed key, default, kind]
  ['blobRadius', 60, 'dead'],   // the blob is always fitted to the cell, so its radius only ever moved a Stroke's relative width
  ['circleRadius', 100, 'scale'], ['polyRadius', 100, 'scale'], ['starRadius', 100, 'scale'],
  ['wedgeSquash', 100, 'length'], ['chevSquash', 100, 'length'],
  ['wedgeRotate', 0, 'rotate'], ['polyRotate', 0, 'rotate'], ['circleRotate', 0, 'rotate'], ['starRotate', 0, 'rotate'],
  ['rrRotate', 0, 'rotate'], ['chevRotate', 0, 'rotate'], ['crossRotate', 0, 'rotate'], ['lensRotate', 0, 'rotate'], ['dropRotate', 0, 'rotate'],
  // The shape-own Outlines scaled the shape toward its centre; Hollow keeps an even wall, so the picture
  // changes (up to 9 %) — never converted: an old snapshot keeps its Outline, hidden, and the note says so.
  ['triOutline', 0, 'keep'], ['polyOutline', 0, 'keep'], ['starOutline', 0, 'keep'], ['rrOutline', 0, 'keep'], ['lensOutline', 0, 'keep'], ['blobOutline', 0, 'keep'],
  // The shape-own Irregularity (+ Angle jitter) → Appearance → Irregularity: different formulas, so never converted
  // either. Their Seeds stay hidden too but are not listed: a Seed alone changes nothing.
  ['triIrregular', 0, 'keep'], ['arcIrregular', 0, 'keep'], ['wedgeIrregular', 0, 'keep'], ['polyIrregular', 0, 'keep'], ['polySkew', 0, 'keep'], ['starIrregular', 0, 'keep'], ['starSkew', 0, 'keep'],
];
// ── SVG upload → one custom Seed. Finds the FIRST drawable shape in
// the file (multi-shape SVGs only use that one — no shape-merging in
// v1, same scoping this project uses elsewhere: Loom's own polygon
// generators, Soul's Seeds panel), measures its untransformed local
// bbox via a real off-DOM <svg> host (Pollen's own `getBBox()`
// technique), and stores the fit as normTx/normTy/normScale (see
// SEED_TYPES's own header for why that's a separate transform layer
// rather than baked into `d`). No existing helper in the repo already
// does this (checked shared/core.js, Soul's parsePrimitives,
// Pollen's own seed-replay) — genuinely new code.
export const SHAPE_SELECTOR = 'path, circle, rect, ellipse, polygon, polyline';
export function shapeToPathD(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'path') return el.getAttribute('d') || '';
  if (tag === 'polygon' || tag === 'polyline') {
    const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
    if (pts.length < 4) return '';
    let d = `M ${pts[0]},${pts[1]}`;
    for (let i = 2; i < pts.length - 1; i += 2) d += ` L ${pts[i]},${pts[i + 1]}`;
    return d + (tag === 'polygon' ? ' Z' : '');
  }
  if (tag === 'rect') {
    const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0;
    const w = +el.getAttribute('width') || 0, h = +el.getAttribute('height') || 0;
    return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;   // rx/ry rounding ignored for v1
  }
  if (tag === 'circle') {
    const cx = +el.getAttribute('cx') || 0, cy = +el.getAttribute('cy') || 0, r = +el.getAttribute('r') || 0;
    return `M ${cx - r},${cy} A ${r},${r} 0 1,0 ${cx + r},${cy} A ${r},${r} 0 1,0 ${cx - r},${cy} Z`;
  }
  if (tag === 'ellipse') {
    const cx = +el.getAttribute('cx') || 0, cy = +el.getAttribute('cy') || 0;
    const rx = +el.getAttribute('rx') || 0, ry = +el.getAttribute('ry') || 0;
    return `M ${cx - rx},${cy} A ${rx},${ry} 0 1,0 ${cx + rx},${cy} A ${rx},${ry} 0 1,0 ${cx - rx},${cy} Z`;
  }
  return '';
}
// A real, standalone SVG FILE always declares xmlns on its root <svg> tag,
// which is what makes an XML parse resolve every descendant into the real
// SVG namespace (SVGPathElement etc., with a working getBBox()). Organica's
// own tools don't bother writing that attribute on the SVG STRINGS they
// pass around internally — inline markup dropped into innerHTML never needs
// it, since the browser already knows it's inside an <svg> — so a string
// straight from Creator's own library (organica.library.forms) parses here
// with every element in the null namespace and no getBBox at all. Only
// caught by testing this function against a real Creator-saved string, not
// against an uploaded file (which always has xmlns already).
export function ensureSvgNamespace(svgString) {
  if (/<svg[^>]*\sxmlns\s*=/.test(svgString)) return svgString;
  return svgString.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
}
// ── Creator library — reads the SAME localStorage key Genesis Creator
// (genesis/creator.html) and its own library.html save to, no live sync
// needed (this is the same cross-page localStorage read every Organica
// preset already relies on — reload FVS after saving in Creator to see
// it here). A saved form's own .svg string is a complete
// <svg viewBox="0 0 200 200">…</svg> — feeding it to extractSeedFromSVG
// (already built for file-upload) is the exact same code path, just a
// different source; builtIn sets (the "Organic Forms"/"Basic Shapes"
// catalogues) are included too, not just user-drawn ones.
export function getCreatorLibraryForms() {
  // The user's own Genesis seeds (Organica.store.library: a top-level forms array; each set.forms only
  // lists ids). Every seed once, even when it sits in several sets; the Base Seeds come from forms.js
  // (genesisTileForms), not from here.
  const lib = Organica.store.library.read(), byId = {}, forms = [], seen = new Set();
  for (const f of lib.forms || []) byId[f.id] = f;
  for (const set of lib.sets || []) for (const fid of set.forms || []) {
    const f = byId[fid];
    if (f && f.svg && !seen.has(f.id)) { seen.add(f.id); forms.push({ id: f.id, name: f.name, svg: f.svg }); }
  }
  return forms;
}
