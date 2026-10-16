// Flexible Visual System · engine/03-rules — the engine part of 03-rules.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import { hooks } from '../hooks.js';
import {
  pc, pv, state, val
} from './00-core.js';
import {
  CELL_SHAPES, cellLatticeGrid, resolveGridCells
} from './01-geometry.js';
// Whether the Component's own canvas frame should stay a forced square —
// true only while a Role (Container/Mask) is set, since the underlying-
// Component fit maths (resolveUnderlyingComponent's own `.size`) is still a
// single square scalar. Left false the frame is the grid's REAL width×height
// (a 1×4 grid draws as 4 cells wide, 1 tall — no square letterbox padding).
export function componentRoleActive() { return state.componentRole === 'container' || state.componentRole === 'mask'; }
// `size` may be a plain number (legacy square, e.g. frameSize()) or a {w,h}
// pair (frameDims()) — either way this is the one place that decides the
// Component canvas's actual drawn shape, used by drawComponentCanvas/
// buildComponentSVGBody/buildComponentSVG/componentEditHitLayer so
// they all agree.
export function resolvedComponentDims(size) {
  const d = typeof size === 'object' ? size : { w: size, h: size };
  if (componentRoleActive()) { const s = Math.max(d.w, d.h); return { w: s, h: s }; }
  return d;
}
// A thumbnail box that keeps the real w:h proportion of a component's frame,
// scaled to fit within a `maxSide`×`maxSide` square (so a 1×4 grid's thumbnail
// is a wide short box, a 4×1 grid's a tall narrow one — never a square with
// letterbox padding around the drawn content, and never wider/taller than the
// gallery can comfortably lay out).
// Component gallery zoom = thumbnail size (wheel / ⌘+ ⌘− ⌘0 on the gallery):
// only the two CSS vars change, the grid reflows and still scrolls.
export const GALLERY_THUMB = 96, GALLERY_ZOOM_MAX = 5;
export function fitThumbBox(w, h, maxSide) {
  const scale = maxSide / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}
// The rule's name as people read it (the Rule menu's words, short) — for saved names and accessible names.
// `ruleSource` stays the code key (saved Components, the regression suite). Diego, Oct 13, 2026.
export const RULE_LABELS = {
  identity: 'Uniform', pinwheel: 'Step turn', mirror: 'Mirror', bookmatch: 'Mirror', diagonal: 'Diagonal mirror',
  checkerboard: 'Checkerboard', rowmirror: 'Row mirror', columnmirror: 'Column mirror', radial: 'Radial',
  hlines: 'Horizontal lines', vlines: 'Vertical lines', oscillator: 'Rhythm', random: 'Random',
  exhaustive: 'Exhaustive', manual: 'Manual', edited: 'Edited', recipe: 'Recipe',
};
export const ruleLabel = key => RULE_LABELS[key] || (key ? key[0].toUpperCase() + key.slice(1) : 'Component');
// ── Transform axes — the full vocabulary. ──
export const ROTATIONS = [0, 90, 180, 270];
export const FLIPS = [{ h: false, v: false }, { h: true, v: false }, { h: false, v: true }, { h: true, v: true }];
export function mulberry32(a) { return Organica.mulberry32(a);
}
// Drops components whose cell transforms are identical to one already in the
// list. Compared on the CANONICAL state: flipH + flipV together is exactly a
// 180° turn (scale(-1,-1) ≡ rotate(180), for any shape), so {r, H+V} and
// {r+180, no flip} are the same cell — without this, Exhaustive with Rotation +
// Flip listed every such pair twice and Checkerboard's (0°, H+V) pair was a
// silent copy of its own (0°, 180°) pair.
export function canonicalState(c) {
  const both = c.flipH && c.flipV;
  return (both ? (c.rotation + 180) % 360 : c.rotation) + (both ? '' : (c.flipH ? 'h' : '') + (c.flipV ? 'v' : '')) + '@' + c.scale;
}
// A cell made by hand (Component Edit) carries Symbol's cell fields: they count in a Component's key — two Components
// that differ only in a cell's colour, padding, anchor, fit or emptiness are not the same one. Absent on every generated
// cell → '' (unchanged keys). Not in canonicalState: a Symbol cell always carries its placement, and its keys stay as they are.
const EXTRA_CELL_KEYS = ['empty', 'color', 'fitMode', 'coverAxis', 'fixedSize', 'pad', 'padding', 'anchorX', 'anchorY'];
function cellExtraKey(c) {
  const x = EXTRA_CELL_KEYS.filter(k => c[k] != null && c[k] !== false && c[k] !== 0).map(k => k + '=' + JSON.stringify(c[k]));
  return x.length ? '|' + x.join('|') : '';
}
export function componentKey(cells) { return cells.map(c => canonicalState(c) + cellExtraKey(c)).join(','); }
export function dedupeComponents(list) {
  const seen = new Set();
  const out = [];
  for (const comp of list) {
    const key = componentKey(comp.cells);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(comp);
  }
  return out;
}
export function stateFrom(rotation, flipH, flipV, scale) { return { rotation, flipH, flipV, scale }; }
export function buildIdentityCells(rotation, flipH, flipV, scale, count) {
  const c = stateFrom(rotation, flipH, flipV, scale);
  return new Array(count).fill(c);
}
export function buildPinwheelCells(base, chirality, scale) {
  return [0, 1, 2, 3].map(i => {
    const rot = (((base + chirality * i * 90) % 360) + 360) % 360;
    return stateFrom(rot, false, false, scale);
  });
}
// Row-major grid indices: 0=TL, 1=TR, 2=BL, 3=BR. For each possible
// "seed" cell, its actual horizontal neighbour (same row) gets flipH,
// its vertical neighbour (same column) gets flipV, and the remaining
// diagonal cell gets both — a direct adjacency table rather than a
// generic cycle-then-reindex, which (caught by diffing the actual cells
// output, not by eyeballing — the isosceles triangle's own left-right
// symmetry hides a wrong flipH visually) previously mismatched which
// cell got the diagonal "both" flip.
export const MIRROR_RELATIONS = [
  { hNeighbor: 1, vNeighbor: 2, diagonal: 3 },   // seed = TL
  { hNeighbor: 0, vNeighbor: 3, diagonal: 2 },   // seed = TR
  { hNeighbor: 3, vNeighbor: 0, diagonal: 1 },   // seed = BL
  { hNeighbor: 2, vNeighbor: 1, diagonal: 0 },   // seed = BR
];
export function buildMirrorCells(seed, scale) {
  const rel = MIRROR_RELATIONS[seed];
  const cells = new Array(4);
  cells[seed] = stateFrom(0, false, false, scale);
  cells[rel.hNeighbor] = stateFrom(0, true, false, scale);
  cells[rel.vNeighbor] = stateFrom(0, false, true, scale);
  cells[rel.diagonal] = stateFrom(0, true, true, scale);
  return cells;
}
// Reflects across the grid's own 45° (TL–BR) diagonal: the on-diagonal
// pair (TL,BR) shares rotation R, the off-diagonal pair (TR,BL) shares
// R's diagonal reflection, (90−R) mod 360 — the discrete-90°-rotation
// equivalent of mirroring across a 45° line (an "up"-pointing shape's
// diagonal reflection is a "right"-pointing one, which (90−0)=90 gives
// correctly under this file's own 0°=up convention).
export function buildDiagonalCells(rotation, scale) {
  const onDiag = stateFrom(rotation, false, false, scale);
  const offRot = (((90 - rotation) % 360) + 360) % 360;
  const offDiag = stateFrom(offRot, false, false, scale);
  return [onDiag, offDiag, offDiag, onDiag];   // TL,BR = onDiag; TR,BL = offDiag
}
export function buildCheckerboardCells(stateA, stateB) {
  return [stateA, stateB, stateB, stateA];   // TL,BR = A; TR,BL = B — exactly 2 distinct states
}
// Row mirror — top row (TL,TR) = A, bottom row (BL,BR) = A reflected
// across X (flipV). Column mirror — left column (TL,BL) = A, right
// column (TR,BR) = A reflected across Y (flipH). Both genuinely
// different groupings from Checkerboard's own diagonal pairing
// (TL,BR)/(TR,BL) — derived directly from how Diego described
// Components 4 ("S" curve) and 5 ("bowtie") in the reference brief.
export function buildRowMirrorCells(rotation, scale) {
  const a = stateFrom(rotation, false, false, scale);
  const b = stateFrom(rotation, false, true, scale);
  return [a, a, b, b];   // TL,TR,BL,BR
}
export function buildColumnMirrorCells(rotation, scale) {
  // Left column (TL,BL) = flipH; right column (TR,BR) = original — per
  // Diego's own description of Component 5 ("cella 1 riflesso sulla y,
  // cella 2 come l'originale").
  const a = stateFrom(rotation, true, false, scale);
  const b = stateFrom(rotation, false, false, scale);
  return [a, b, a, b];   // TL,TR,BL,BR
}
// Radial — true rotational tiling around the grid's own shared centre,
// for shapes (like the solid-quarter-circle Arc) meant to meet edge-to-
// edge into a full circle/rosette. Pinwheel steps rotation by ROW-MAJOR
// cell index (TL,TR,BL,BR), which is what makes its own "windmill" look
// — but that ISN'T the grid's actual rotational adjacency. Walking the
// square's corners in true clockwise order (TL,TR,BR,BL) is what makes
// 4 quarter-shapes actually meet seamlessly at the centre.
export const RADIAL_ORDER = [0, 1, 3, 2];   // TL, TR, BR, BL — true clockwise walk
export function buildRadialCells(base, chirality, scale) {
  const cells = new Array(4);
  RADIAL_ORDER.forEach((cellIdx, k) => {
    const rot = (((base + chirality * k * 90) % 360) + 360) % 360;
    cells[cellIdx] = stateFrom(rot, false, false, scale);
  });
  return cells;
}
// Does the active axis state satisfy a FAMILIES entry's own requiresAxis gate
// (null = always, 'any' = at least one of the three, else that one axis)?
// Shared by activeFamilies() (Random/Exhaustive's pool filter) and the
// standalone named rules below, so the two can't drift on what "eligible"
// means for a given family.
export function axisSatisfied(req, axes) {
  if (req == null) return true;
  if (req === 'any') return axes.rotation || axes.flip || axes.scale;
  return !!axes[req];
}
export const mod360 = r => ((r % 360) + 360) % 360;
export const crDims = cr => ({ cols: Math.max(...cr.map(c => c.col)) + 1, rows: Math.max(...cr.map(c => c.row)) + 1 });
// ── Any-grid cell builders — one per family, shared by the named rules and
// the FAMILIES registry (Random/Exhaustive), so the two can't drift. `cr` is
// componentCellColRow(grid). On 2×2 each is identical to its literal builder.
export const GRID_BUILD = {
  // step by (col + 2·row) mod 4 — on 2×2 that is exactly the row-major index
  pinwheel: (cr, base, ch, sc) => cr.map(c => stateFrom(mod360(base + ch * ((c.col + 2 * c.row) % 4) * 90), false, false, sc)),
  // the seed cell sits at (seed % 2, seed >> 1); flips follow column/row parity from it
  mirror: (cr, seed, sc) => { const sx = seed % 2, sy = seed >> 1; return cr.map(c => stateFrom(0, (c.col + sx) % 2 === 1, (c.row + sy) % 2 === 1, sc)); },
  // one mirror axis through the WHOLE grid (book-matched halves) instead of
  // one per 2×2 tile — the same thing on 2×2, a different picture on anything larger
  bookmatch: (cr, axis, sc, R = 0) => { const d = crDims(cr); return cr.map(c => { const fh = axis !== 'v' && c.col >= d.cols / 2, fv = axis !== 'h' && c.row >= d.rows / 2; return stateFrom(fh !== fv ? mod360(-R) : R, fh, fv, sc); }); },
  // Mirror with a Line and a turn (Oct 13, 2026 — Row / Column mirror folded in): the plain cell turned by R; a cell
  // flipped once shows the mirror image of that turned Element — the render flips first, then turns, so it takes −R;
  // flipped both ways = a 180° turn, R kept. line 'both' | 'lr' (flips left–right only) | 'tb' (top–bottom only).
  // seed = which corner of the 2 × 2 parity is plain (bit 0: column, bit 1: row). R 0 + 'both' = GRID_BUILD.mirror.
  // spread 'cell' = a mirror line between every pair of neighbours (A A′ A A′ …); 'pair' = every two cells
  // (A A′ A′ A …, Oct 13, 2026 — phase 3). The plain corner shifts the pattern by one (cell) or two (pairs) cells.
  mirrorLine: (cr, seed, line, R, sc, spread = 'cell') => {
    const sx = seed % 2, sy = seed >> 1, odd = spread === 'pair' ? (k, s) => ((k + 2 * s + 1) >> 1) % 2 === 1 : (k, s) => (k + s) % 2 === 1;
    return cr.map(c => { const fh = line !== 'tb' && odd(c.col, sx), fv = line !== 'lr' && odd(c.row, sy); return stateFrom(fh !== fv ? mod360(-R) : R, fh, fv, sc); });
  },
  diagonal: (cr, r, sc) => cr.map(c => stateFrom((c.col + c.row) % 2 === 0 ? r : mod360(90 - r), false, false, sc)),
  checkerboard: (cr, a, b) => cr.map(c => ((c.col + c.row) % 2 === 0 ? a : b)),
  rowmirror: (cr, r, sc) => cr.map(c => stateFrom(r, false, c.row % 2 === 1, sc)),
  columnmirror: (cr, r, sc) => cr.map(c => stateFrom(r, c.col % 2 === 0, false, sc)),
  // global: the four QUADRANTS of the grid take one step each of the clockwise
  // walk TL,TR,BR,BL (one rosette centred on the grid); tiled: every 2×2 block
  // takes the walk (a rosette per block — e.g. four full circles from four
  // quarter-arcs on a 4×4). Same thing on a 2×2.
  radial: (cr, base, ch, sc, tiled) => {
    const d = crDims(cr);
    return cr.map(c => {
      const qx = tiled ? c.col % 2 : (c.col >= d.cols / 2 ? 1 : 0), qy = tiled ? c.row % 2 : (c.row >= d.rows / 2 ? 1 : 0);
      const k = qy === 0 ? qx : (qx === 1 ? 2 : 3);   // TL 0, TR 1, BR 2, BL 3
      return stateFrom(mod360(base + ch * k * 90), false, false, sc);
    });
  },
  // Turn by › Cell (Oct 14, 2026): each cell turned by its OWN angle around the grid's centre — counted from the
  // top-left diagonal in the walk's direction, not snapped (snapped to a quarter it would equal the quadrants on every
  // even grid: each quadrant spans exactly 90° of angle). On a 2 × 2 = the classic walk; an odd grid's mid-line cells
  // land on exact quarters and its centre cell stays at the start.
  radialCentre: (cr, base, ch, sc) => {
    const d = crDims(cr);
    return cr.map(c => {
      const x = c.col - (d.cols - 1) / 2, y = c.row - (d.rows - 1) / 2;
      if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return stateFrom(mod360(base), false, false, sc);
      const t = Math.atan2(y, x) * 180 / Math.PI, k = mod360(ch > 0 ? t - 225 : 225 - t);
      return stateFrom(Math.round(mod360(base + k) * 10) / 10 % 360, false, false, sc);
    });
  },
};
// ── Rules on a cell-shape lattice (test) — every turn is a step of the cell shape's own (90° circle, 120°
// triangle, 60° hexagon), added to the cell's own pose (a down triangle sits at 60°). Square cells never reach here.
export const LATTICE_RULES = new Set(['identity', 'pinwheel', 'mirror', 'radial', 'checkerboard', 'random', 'exhaustive']);
export function latticeSteps() {
  const st = CELL_SHAPES[state.cellShape].step, out = [];
  for (let r = 0; r < 360; r += st) out.push(r);
  return out;
}
export const EXHAUSTIVE_CAP = 2048;   // every rule's list stops here, Exhaustive refuses above (was 512 — raised by Diego, Oct 15, 2026: ~0.4 s to draw 2,048 thumbnails)
// ── Grid — either a plain square NxN (cellSize/gap-driven) or an
// imported Loom grid (rect or polygon cellShape, arbitrary cell count
// and layout, read via Organica.loadLoomGrid). Cell centres are always
// resolved relative to the component's own centre (0,0), so
// buildComponentSVG/Canvas only ever need one translate. ──
// The Component is the small building block: 1×1 up to 4×4, square or
// rectangular. Larger and irregular (Loom) grids belong to the Symbol. A
// Component saved on an imported Loom grid before that split still loads
// (state.loomGrid, "legacy") and renders exactly as saved; picking columns ×
// rows replaces it.
export function getGrid() {
  if (state.gridOverride) return state.gridOverride;   // a rule run on another grid (Component Edit's Columns × Rows)
  if (state.cellShape !== 'square') return cellLatticeGrid();
  if (state.loomGrid) {
    return { kind: 'loom', cellShape: state.loomGrid.cellShape, cells: state.loomGrid.cells, width: state.loomGrid.inner.width, height: state.loomGrid.inner.height };
  }
  const g = { kind: 'square', cols: +pv('rg-grid-cols'), rows: +pv('rg-grid-rows'), cellSize: val('rg-cellsize'), gap: val('rg-gap') };
  // the step's own track sizes ("Apply grid to all" from Component Edit) — only while they fit its columns / rows
  const w = state.gridWeights;
  if (w && w.colWeights && w.colWeights.length === g.cols) g.colWeights = w.colWeights.slice();
  if (w && w.rowWeights && w.rowWeights.length === g.rows) g.rowWeights = w.rowWeights.slice();
  return g;
}
// A Component's own grid (Tropism Phase 0 — Diego, Oct 14, 2026: "each component can have a different grid"): set when its
// grid was changed in Component Edit — { cols, rows, colWeights?, rowWeights? }; the step's Cell size and Gap still apply.
// Square cells only. Absent = the step's grid (every Component before; the rules and Generate always use that one).
export function gridOf(comp) {
  const g = getGrid();
  if (!comp || !comp.grid || g.kind !== 'square') return g;
  const own = { ...g, cols: comp.grid.cols, rows: comp.grid.rows };
  delete own.colWeights; delete own.rowWeights;
  if (comp.grid.colWeights) own.colWeights = comp.grid.colWeights.slice();
  if (comp.grid.rowWeights) own.rowWeights = comp.grid.rowWeights.slice();
  return own;
}
// Run `fn` with getGrid() answering `grid` (the rules read it) — then back.
export function withGrid(grid, fn) {
  const keep = state.gridOverride;
  state.gridOverride = grid;
  try { return fn(); } finally { state.gridOverride = keep; }
}
// ── Axis values (Tropism Phase 1, Oct 15, 2026 — Rule › Axes): which angles and sizes a rule may use ──
// Turns: the set of angles a rule may use, one set per cell shape in #rot-set ({square: [0, 90], hexagon: […]}), always
// on the shape's own steps (0/90/180/270 square, latticeSteps() on lattices) and always holding 0°; nothing saved for a
// shape = all of its steps, so every rule draws as before by default. Square cells only: Free angles (#rot-free) =
// From · To · Step in degrees, for angles that don't tile.
export const rotationStepOf = shape => (CELL_SHAPES[shape] && CELL_SHAPES[shape].step) || 90;
export function rotationDefaults(shape = state.cellShape) { const st = rotationStepOf(shape); return { from: 0, to: 360 - st, step: st }; }
export function rotationSteps(shape = state.cellShape) { const st = rotationStepOf(shape), out = []; for (let a = 0; a < 360; a += st) out.push(a); return out; }
export function rotationSet(shape = state.cellShape) {
  const steps = rotationSteps(shape);
  let saved = null;
  try { saved = (JSON.parse(pv('rot-set') || '{}') || {})[shape]; } catch (e) { saved = null; }
  if (!Array.isArray(saved)) return steps;
  return steps.filter(a => a === 0 || saved.includes(a));
}
export const rotationFree = () => state.cellShape === 'square' && pv('rot-free') === '1';
export function rotationValues() {
  if (!rotationFree()) return rotationSet();
  const from = val('rg-rot-from'), to = val('rg-rot-to'), st = val('rg-rot-step');
  if (!(st > 0) || !(to >= from)) return ROTATIONS;
  const out = [];
  for (let a = from; a <= to + 1e-9 && out.length < 72; a += st) { const r = mod360(a); if (!out.includes(r)) out.push(r); }
  return out;
}
// Scale: Small · Medium · Large % (back from Sizes + How many — Diego, Oct 16, 2026: the Transform axes "as before").
export function scaleValues() {
  return [val('rg-scale-small') / 100, val('rg-scale-medium') / 100, val('rg-scale-large') / 100];
}
// Which axes each rule reads — what Rule › Axes shows (measured on fvs/_axes-baseline.json, Oct 15, 2026: Step turn and
// Radial draw the same with Rotation on or off — their turns are their own; Uniform on square cells reads none;
// Rhythm › Connect reads Flip, not Scale). rotation: 'values' | 'own' (a note, no control) | null. One table for the
// step's panel and, at the end of Tropism, the Figure's Component rule node.
export function ruleAxes(mode, { lattice = false, rhythm = 'beat' } = {}) {
  const all = { rotation: 'values', flip: true, scale: true };
  switch (mode) {
    case 'identity': return lattice ? all : { rotation: null, flip: false, scale: false };
    case 'pinwheel': case 'radial': return { rotation: 'own', flip: false, scale: true };
    case 'hlines': case 'vlines': return { rotation: null, flip: false, scale: true };
    case 'oscillator': return rhythm === 'connect' ? { rotation: null, flip: true, scale: false } : { rotation: null, flip: false, scale: true };
    default: return all;   // Mirror, Checkerboard, Random, Exhaustive (and the hidden legacy rules)
  }
}
// N sizes picked by a level that runs 0…2 (Rhythm's beats met, a wave's level + 1): the same three as before when N = 3.
const sizeAt = (sv, l3) => sv[Math.round(l3 / 2 * (sv.length - 1))];
export function activeAxes() {
  return {
    rotation: pc('chk-axis-rotation'),
    flip: pc('chk-axis-flip'),
    scale: pc('chk-axis-scale'),
  };
}
export function axisValues() {
  const axes = activeAxes();
  return {
    rotations: axes.rotation ? rotationValues() : [0],
    flips: axes.flip ? FLIPS : [{ h: false, v: false }],
    scales: axes.scale ? scaleValues() : [1.0],
  };
}
export function activeCellCount() { return resolveGridCells(getGrid()).length; }
export function ruleIdentity() {
  return [{ id: 'identity-0', ruleSource: 'identity', cells: buildIdentityCells(0, false, false, 1.0, activeCellCount()) }];
}
// Any grid size: the named rules read each cell's col/row (componentCellColRow
// — native for rect grids, lattice-binned for polygon ones) and apply the same
// relation the 4-cell tables encode. Only a CANONICAL 2×2 (4 cells laid out
// TL,TR,BL,BR) runs the original literal builders, so every existing 2×2
// result is untouched (the regression suite hashes them). A 4-cell Loom grid
// that is a 4×1 row / 1×4 column is NOT a 2×2 — it used to be fed to the
// TL/TR/BL/BR tables anyway (and Radial was offered on it).
export function isCanonical2x2() {
  const grid = getGrid();
  if (resolveGridCells(grid).length !== 4) return false;
  if (grid.kind === 'square') return grid.cols === 2 && grid.rows === 2;
  return hooks.componentCellColRow(grid).every((c, i) => c.col === i % 2 && c.row === (i >> 1));
}
export function ruleCR() { return isCanonical2x2() ? null : hooks.componentCellColRow(getGrid()); }
// Every named rule below (bar Mirror, handled separately just after) draws
// its candidate gallery straight from its own FAMILIES entry — the same
// paramSpace/build pair Random/Exhaustive already use — parametrised on the
// live Transform-axes checkboxes (Rotation/Flip/Scale). With every axis at
// its default (Rotation on, Flip/Scale off) this reproduces the exact
// pre-existing curated set 1:1 (av.rotations=[0,90,180,270],
// av.flips=[identity], av.scales=[1.0] — see axisValues()). If the ONE axis a
// rule structurally needs is off (e.g. Flip for Mirror), the rule has
// nothing to draw and falls back to Identity rather than showing an empty
// gallery — the Rule dropdown itself stays selectable either way; the axes
// panel's own hint explains the fallback.
// A named rule picked in the dropdown always shows its whole family: the one
// axis it structurally needs (Flip for the mirrors, Rotation for Pinwheel/
// Diagonal/Radial) is implied by the pick, not gated by the axis checkboxes —
// those only add the OTHER axes' values. Only Checkerboard, whose states come
// entirely from the axes, can still come out empty (every axis off) and then
// shows Identity.
export function familyRuleGallery(key) {
  const fam = FAMILIES[key];
  if (fam.eligible && !fam.eligible()) return ruleIdentity();
  const av = axisValues();
  const cr = ruleCR();
  const out = fam.paramSpace(av, cr).map((p, i) => ({ id: `${key}-${i}`, ruleSource: key, cells: fam.build(p, cr) }));
  const kept = dedupeComponents(out);
  return kept.length ? kept : ruleIdentity();
}
export function rulePinwheel() { return familyRuleGallery('pinwheel'); }
// The 2 × 2 as columns / rows, for the builders that read them (Mirror's Line on a canonical 2 × 2).
export const CR_2X2 = [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }];
// Which Mirror Lines this grid can run: Left–right needs two columns, Top–bottom two rows, Both either. On a cell-shape
// lattice the mirror lines follow the lattice — only Both, except circles in square packing (they read as squares).
export function mirrorLinesEligible() {
  if (state.cellShape !== 'square') return latticeMirrorKind() === 'square' ? ['both', 'lr', 'tb'] : ['both'];
  const d = crDims(hooks.componentCellColRow(getGrid()));
  return ['both', 'lr', 'tb'].filter(l => (l === 'lr' ? d.cols > 1 : l === 'tb' ? d.rows > 1 : d.cols > 1 || d.rows > 1));
}
// How far apart the mirror lines are (phase 3): 'cell' every cell · 'pair' every two cells · 'grid' one line through
// the whole grid (book-matched). Pairs and the whole grid need more than two cells along the Line; square cells only.
export function mirrorSpreadsEligible(line) {
  if (state.cellShape !== 'square') return ['cell'];
  const d = crDims(hooks.componentCellColRow(getGrid())), long = line === 'lr' ? d.cols > 2 : line === 'tb' ? d.rows > 2 : d.cols > 2 || d.rows > 2;
  return long ? ['cell', 'pair', 'grid'] : ['cell'];
}
export function ruleMirror() {
  if (state.cellShape !== 'square') return latticeRule('mirror');
  const ok = mirrorLinesEligible(), line = ok.includes(state.mirrorLine) ? state.mirrorLine : 'both';
  const spreads = mirrorSpreadsEligible(line), spread = spreads.includes(state.mirrorSpread) ? state.mirrorSpread : 'cell';
  const av = axisValues(), cr = ruleCR();
  let gallery;
  if (spread === 'grid') {   // book-matched: one mirror line through the whole grid, along the Line
    const bm = FAMILIES.bookmatch, axes = line === 'lr' ? ['h'] : line === 'tb' ? ['v'] : ['h', 'v', 'hv'];
    gallery = bm.paramSpace(av, cr, axes).map((p, i) => ({ id: `mirror-book-${i}`, ruleSource: 'mirror', cells: bm.build(p, cr) }));
  } else {
    const out = [];
    for (const rotation of av.rotations) for (let seed = 0; seed < 4; seed++) for (const s of av.scales) out.push({ seed, line, spread, rotation, scale: s });
    gallery = out.map((p, i) => ({ id: `mirror-${i}`, ruleSource: 'mirror', cells: FAMILIES.mirror.build(p, cr) }));
  }
  const kept = dedupeComponents(gallery);
  return kept.length ? kept : ruleIdentity();
}
export function ruleDiagonal() { return familyRuleGallery('diagonal'); }
// Checkerboard (Oct 13, 2026, Diego): each pair of states once — {A, B}, not also {B, A}, the same board started on the
// other square — and state.checkerStart picks which of the two sits on the first cell (top left, the even cells).
// Random / Exhaustive keep every ordered pair (FAMILIES.checkerboard). Fewer than two states → Uniform.
export function checkerStates(list) {
  const seen = new Set(), out = [];
  for (const st of list) { const k = canonicalState(st); if (!seen.has(k)) { seen.add(k); out.push(st); } }
  return out;
}
export function ruleCheckerboard() {
  if (state.cellShape !== 'square') return latticeRule('checkerboard');
  const av = axisValues(), cr = ruleCR(), S = [];
  for (const r of av.rotations) for (const f of av.flips) for (const sc of av.scales) S.push(stateFrom(r, f.h, f.v, sc));
  const states = checkerStates(S), start = state.checkerStart === 1 ? 1 : 0, out = [];
  for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
    const [a, b] = start ? [states[j], states[i]] : [states[i], states[j]];
    out.push({ id: `checkerboard-${out.length}`, ruleSource: 'checkerboard', cells: cr ? GRID_BUILD.checkerboard(cr, a, b) : buildCheckerboardCells(a, b) });
  }
  const kept = dedupeComponents(out);
  return kept.length ? kept : ruleIdentity();
}
export function ruleRowMirror() { return familyRuleGallery('rowmirror'); }
export function ruleColumnMirror() { return familyRuleGallery('columnmirror'); }
// Radial needs a centre that falls between cells: an even × even grid (the
// four quadrants each take one step of the clockwise walk TL,TR,BR,BL).
export function radialQuadrantsEligible() {
  if (isCanonical2x2()) return true;
  const cr = hooks.componentCellColRow(getGrid());
  if (!cr.length) return false;
  const d = crDims(cr);
  return d.cols % 2 === 0 && d.rows % 2 === 0 && d.cols * d.rows === cr.length;
}
// Radial › Turn by (Oct 14, 2026 — Diego): 'quadrants' (Quadrant: the grid in 4 quadrants, each one step of the walk) and
// 'blocks' (Each 2×2: a walk per 2 × 2 block) need an even × even grid; 'centre' (Cell: each cell by its own angle
// around the centre) runs on any grid of 2 or more cells, odd ones too — on a 2 × 2 the three draw the same.
// On circle / triangle / hexagon cells only 'centre' (the lattice already turns each cell towards the centre).
export function radialReadingsEligible() {
  if (state.cellShape !== 'square') return ['centre'];
  const cr = hooks.componentCellColRow(getGrid());
  if (cr.length < 2) return [];
  const even = radialQuadrantsEligible();   // on a 2 × 2 the three readings draw the same — all left on (design-system CONSULT)
  return [...(even ? ['quadrants', 'blocks'] : []), 'centre'];
}
export function radialEligible() { return radialReadingsEligible().length > 0; }
export function radialReading() {
  const ok = radialReadingsEligible();
  return ok.includes(state.radialReading) ? state.radialReading : ok[0];
}
export function ruleRadial() {
  if (state.cellShape !== 'square') return latticeRule('radial');
  const reading = radialReading();
  if (!reading) return ruleIdentity();
  const av = axisValues(), cr = ruleCR(), out = [];
  for (const base of [0, 90, 180, 270]) for (const ch of [1, -1]) for (const s of av.scales) {
    const cells = reading === 'centre' ? GRID_BUILD.radialCentre(cr || CR_2X2, base, ch, s)
      : cr ? GRID_BUILD.radial(cr, base, ch, s, reading === 'blocks') : buildRadialCells(base, ch, s);
    out.push({ id: `radial-${out.length}`, ruleSource: 'radial', cells });
  }
  const kept = dedupeComponents(out);
  return kept.length ? kept : ruleIdentity();
}
// Horizontal/vertical lines — unlike the 8 named rules above (all
// hand-derived for exactly 4 cells, TL/TR/BL/BR), this reads N×M-general
// row/col context off componentCellColRow (added for Motion's stagger
// context) so it works at any grid size, same as Identity/Random/
// Exhaustive/Manual — not gated by grid size. Same
// Alternate/Ramp + Step shape as the Symbols tier's own Rows/Columns
// rule (SYMBOL_RULES.rows/.columns below), just keyed on rotation only —
// deterministic, one candidate per Generate, no enumeration needed. When the
// Scale axis is on, the same per-row/col key that alternates/ramps rotation
// also cycles through the Small/Medium/Large values (scaleValues()) — off,
// every cell stays at the untouched scale 1.0 (byte-identical to before this
// axis existed). Rotation/Flip have no hook here (the angle is already
// governed by Mode/Step, not by the axis checkboxes).
export function ruleLines(axis) {
  const grid = getGrid();
  const ctxs = hooks.componentCellColRow(grid);
  const mode = pv('sel-lines-mode');
  const step = parseInt(pv('rg-lines-step'), 10) || 0;
  const scaleOn = pc('chk-axis-scale');
  const sv = scaleValues();
  const cells = ctxs.map(ctx => {
    const key = axis === 'row' ? ctx.row : ctx.col;
    const rot = mode === 'ramp' ? hooks.snap90(step * key) : (key % 2 ? step : 0);
    const scale = !scaleOn ? 1.0 : (mode === 'ramp' ? sv[key % sv.length] : sv[key % 2 ? sv.length - 1 : 0]);
    return stateFrom(((rot % 360) + 360) % 360, false, false, scale);
  });
  const ruleSource = axis === 'row' ? 'hlines' : 'vlines';
  return [{ id: `${ruleSource}-${mode}-${step}-${scaleOn ? 's' : ''}`, ruleSource, cells }];
}
// Rhythm (was Oscillator; Diego, Oct 14, 2026 — "go with all the 4, Rhythm is ok"). Turns only, one result per mode
// (Connect lists a few). The count k = col + ⌊Row shift × row⌋ walks each row; Row shift slides the next row along.
//   Beat     — the turns written as a beat, repeated along k (the old Oscillator = a beat of Period steps with Angle
//              on step Phase: its default, Period 3 · Phase 1 · 90°, is the beat 0° · 90° · 0°).
//   Two beats — a beat every Across cells along k and every Down rows; Combine: Add (each turns by Angle, twice where
//              they meet) · One only (cells on exactly one) · Both (only where they meet).
//   Wave     — the turn follows a sine along k (no floor, so a fraction of Row shift tilts the wave front), snapped
//              to quarter turns: Amplitude 90° gives 0 · 90 · 270, 180° adds 180.
//   Connect  — each cell turned (and flipped, with Flip on) so the ink meets its neighbours' ink on the shared edge
//              (hooks.elementSideCover: per side, which points along it the ink reaches), in reading order, against
//              every neighbour already placed; *Tile seamlessly* wraps the grid round (the last column meets the
//              first, the last row the first), so the Component repeats without a seam. Ties drawn from a seed,
//              16 seeds, duplicates folded.
// Scale (on): Beat by the beat step, Two beats by the beats met (0 · 1 · 2), Wave by the wave's level.
const rmod = (a, n) => ((a % n) + n) % n;
export function rhythmBeatCells(ctxs, beat, shift, sv) {
  const b = beat && beat.length ? beat : [0];
  return ctxs.map(ctx => {
    const p = rmod(ctx.col + Math.floor(shift * ctx.row), b.length);
    return stateFrom(rmod(b[p], 360), false, false, sv ? sv[p % sv.length] : 1.0);
  });
}
export function rhythmBeatsCells(ctxs, across, down, angle, combine, shift, sv) {
  return ctxs.map(ctx => {
    const hits = (rmod(ctx.col + Math.floor(shift * ctx.row), across) === 0 ? 1 : 0) + (rmod(ctx.row, down) === 0 ? 1 : 0);
    const turn = combine === 'one' ? (hits === 1 ? angle : 0) : combine === 'both' ? (hits === 2 ? angle : 0) : angle * hits;
    return stateFrom(rmod(turn, 360), false, false, sv ? sizeAt(sv, hits) : 1.0);
  });
}
export function rhythmWaveCells(ctxs, amplitude, period, shift, sv) {
  return ctxs.map(ctx => {
    const w = Math.sin(2 * Math.PI * (ctx.col + shift * ctx.row) / period);
    const turn = Math.round(amplitude * w / 90) * 90;
    return stateFrom(rmod(turn, 360) || 0, false, false, sv ? sizeAt(sv, w + 1) : 1.0);
  });
}
// Connect: `views` = the orientations a cell may take ({r, fh, fv}), `cover[i]` = view i's sides ({top, right,
// bottom, left}: 101 flags along that side, left → right / top → bottom). A cell's cost = the points where one of
// its sides and the facing side of a neighbour already placed disagree (ink on one side, none on the other);
// `wrap` = the neighbours past the grid's edge are the cells on the opposite edge.
export function rhythmConnectCells(ctxs, views, cover, seed, wrap) {
  const rng = mulberry32(seed), at = new Map(), chosen = new Array(ctxs.length);
  ctxs.forEach((c, i) => at.set(c.col + ',' + c.row, i));
  const cols = Math.max(...ctxs.map(c => c.col)) + 1, rows = Math.max(...ctxs.map(c => c.row)) + 1;
  const miss = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
  // [dx, dy, my side, its side]; wrapping needs 3 or more cells along that line (on 2 the neighbour is the same cell both ways)
  const DIRS = [[-1, 0, 'left', 'right'], [1, 0, 'right', 'left'], [0, -1, 'top', 'bottom'], [0, 1, 'bottom', 'top']];
  const near = (col, row, dx, dy) => {
    let c = col + dx, r = row + dy;
    if (wrap) { if (cols > 2 || !dx) c = (c + cols) % cols; if (rows > 2 || !dy) r = (r + rows) % rows; }
    return at.get(c + ',' + r);
  };
  const order = ctxs.map((c, i) => i).sort((i, j) => ctxs[i].row - ctxs[j].row || ctxs[i].col - ctxs[j].col);
  for (const i of order) {
    const { col, row } = ctxs[i];
    const placed = DIRS.map(([dx, dy, mine, its]) => [near(col, row, dx, dy), mine, its]).filter(([n]) => n !== undefined && n !== i && chosen[n] !== undefined);
    let best = Infinity, ties = [];
    views.forEach((v, k) => {
      let cost = 0;
      for (const [n, mine, its] of placed) cost += miss(cover[k][mine], cover[chosen[n]][its]);
      if (cost < best) { best = cost; ties = [k]; } else if (cost === best) ties.push(k);
    });
    chosen[i] = ties[Math.floor(rng() * ties.length)];
  }
  return chosen.map(k => stateFrom(views[k].r, views[k].fh, views[k].fv, 1.0));
}
export const RHYTHM_CONNECT_SEEDS = 16;
// The Figure's Component rule node (Oct 14, 2026): Rhythm from its own params, pure. `ctxs` = each cell's {col, row};
// `cover` = { views, sides } measured for Connect (rhythmConnectViews + hooks.elementSideCover), else null.
export const RHYTHM_DEFAULTS = { mode: 'beat', beat: [0, 90, 0], shift: 1, across: 3, down: 4, combine: 'add', angle: 90, amp: 90, period: 4, wrap: true, flip: false, seed: 1 };
export function rhythmConnectViews(flip) {
  const views = [];
  for (const rot of ROTATIONS) for (const f of (flip ? FLIPS.slice(0, 3) : [FLIPS[0]])) views.push({ r: rot, fh: f.h, fv: f.v });
  return views;
}
export function rhythmCells(params, ctxs, cover) {
  const p = { ...RHYTHM_DEFAULTS, ...(params || {}) }, shift = +p.shift || 0;
  if (p.mode === 'beats') return rhythmBeatsCells(ctxs, +p.across || 2, +p.down || 2, +p.angle || 90, p.combine, shift, null);
  if (p.mode === 'wave') return rhythmWaveCells(ctxs, +p.amp || 90, +p.period || 4, shift, null);
  if (p.mode === 'connect') {
    if (!cover) throw new Error('Rhythm › Connect reads an Element: wire a saved Element to the Figure');
    return rhythmConnectCells(ctxs, cover.views, cover.sides, Math.max(1, +p.seed || 1), p.wrap !== false);
  }
  return rhythmBeatCells(ctxs, Array.isArray(p.beat) && p.beat.length ? p.beat : RHYTHM_DEFAULTS.beat, shift, null);
}
export function ruleOscillator() {
  const grid = getGrid();
  const ctxs = hooks.componentCellColRow(grid);
  const r = state.rhythm, shift = parseFloat(pv('rg-rhythm-shift')) || 0;
  const sv = pc('chk-axis-scale') ? scaleValues() : null, s = sv ? '-s' : '';
  if (r.mode === 'connect') {
    const views = rhythmConnectViews(pc('chk-axis-flip'));
    const cover = views.map(v => hooks.elementSideCover(v));
    const out = [], wrap = pc('chk-rhythm-wrap');
    for (let k = 1; k <= RHYTHM_CONNECT_SEEDS; k++) out.push({ id: `rhythm-connect-${views.length}-${wrap ? 'w' : ''}${k}`, ruleSource: 'oscillator', cells: rhythmConnectCells(ctxs, views, cover, k, wrap) });
    return dedupeComponents(out);
  }
  if (r.mode === 'beats') {
    const across = parseInt(pv('rg-rhythm-across'), 10) || 2, down = parseInt(pv('rg-rhythm-down'), 10) || 2, angle = parseInt(pv('sel-rhythm-angle'), 10) || 90;
    return [{ id: `rhythm-beats-${across}-${down}-${angle}-${r.combine}-${shift}${s}`, ruleSource: 'oscillator', cells: rhythmBeatsCells(ctxs, across, down, angle, r.combine, shift, sv) }];
  }
  if (r.mode === 'wave') {
    const amp = parseInt(pv('sel-rhythm-amp'), 10) || 90, period = parseInt(pv('rg-rhythm-period'), 10) || 4;
    return [{ id: `rhythm-wave-${amp}-${period}-${shift}${s}`, ruleSource: 'oscillator', cells: rhythmWaveCells(ctxs, amp, period, shift, sv) }];
  }
  return [{ id: `rhythm-beat-${r.beat.join('.')}-${shift}${s}`, ruleSource: 'oscillator', cells: rhythmBeatCells(ctxs, r.beat, shift, sv) }];
}
// ── Family registry — Random/Exhaustive draw from here, on ANY grid (every
// family builds through GRID_BUILD's col/row form; a canonical 2×2 keeps the
// literal 4-cell builders). requiresAxis gates which families are even
// eligible: Pinwheel/Diagonal/Radial only mean anything with Rotation active,
// Mirror/Book-match/Row/Column mirror only with Flip active, Checkerboard with
// any axis active (else stateA===stateB, degenerating to Identity) — Identity
// itself has no such requirement, so activeFamilies() is never empty.
// `eligible` is an extra grid gate (Radial: even × even; Book-match: only
// where it differs from the per-tile Mirror, i.e. not a canonical 2×2). ──
export const FAMILIES = {
  identity: {
    requiresAxis: null,
    paramSpace(av) {
      const out = [];
      for (const r of av.rotations) for (const f of av.flips) for (const s of av.scales) out.push({ rotation: r, flipH: f.h, flipV: f.v, scale: s });
      return out;
    },
    build(p, cr) { return buildIdentityCells(p.rotation, p.flipH, p.flipV, p.scale, cr ? cr.length : 4); },
  },
  pinwheel: {
    requiresAxis: 'rotation',
    paramSpace(av) {
      const out = [];
      for (const base of [0, 90, 180, 270]) for (const chirality of [1, -1]) for (const s of av.scales) out.push({ base, chirality, scale: s });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.pinwheel(cr, p.base, p.chirality, p.scale) : buildPinwheelCells(p.base, p.chirality, p.scale); },
  },
  mirror: {
    requiresAxis: 'flip',
    eligible: () => mirrorLinesEligible().length > 0,   // a 1 × 1 has no line to mirror across (Random would draw from an empty space)
    // lines: the Mirror rule passes its own Line; Random / Exhaustive take every Line the grid can run. The turn R
    // comes from the Rotation axis (0 only when it is off). Line × turn × plain corner × scale.
    paramSpace(av, cr, lines) {
      const out = [];
      for (const line of lines || mirrorLinesEligible()) for (const spread of mirrorSpreadsEligible(line).filter(x => x !== 'grid')) for (const rotation of av.rotations) for (let seed = 0; seed < 4; seed++) for (const s of av.scales) out.push({ seed, line, spread, rotation, scale: s });
      return out;
    },
    build(p, cr) { return GRID_BUILD.mirrorLine(cr || CR_2X2, p.seed, p.line || 'both', p.rotation || 0, p.scale, p.spread || 'cell'); },
  },
  bookmatch: {
    requiresAxis: 'flip',
    eligible: () => state.cellShape === 'square' && mirrorSpreadsEligible('both').includes('grid'),
    paramSpace(av, cr, axes) {
      const out = [];
      for (const rotation of av.rotations) for (const axis of axes || ['h', 'v', 'hv']) for (const s of av.scales) out.push({ axis, rotation, scale: s });
      return out;
    },
    build(p, cr) { return GRID_BUILD.bookmatch(cr, p.axis, p.scale, p.rotation || 0); },
  },
  diagonal: {
    requiresAxis: 'rotation',
    paramSpace(av) {
      const out = [];
      for (const r of [0, 90, 180, 270]) for (const s of av.scales) out.push({ rotation: r, scale: s });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.diagonal(cr, p.rotation, p.scale) : buildDiagonalCells(p.rotation, p.scale); },
  },
  checkerboard: {
    requiresAxis: 'any',
    paramSpace(av) {
      const states = [];
      for (const r of av.rotations) for (const f of av.flips) for (const s of av.scales) states.push(stateFrom(r, f.h, f.v, s));
      const out = [];
      for (const a of states) for (const b of states) if (a !== b) out.push({ a, b });   // a === b is just Identity
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.checkerboard(cr, p.a, p.b) : buildCheckerboardCells(p.a, p.b); },
  },
  rowmirror: {   // off the Rule menu since Oct 13, 2026 (= Mirror › Line: Top–bottom); kept for a hidden pick, not drawn by Random / Exhaustive
    retired: true,
    requiresAxis: 'flip',
    eligible: () => crDims(hooks.componentCellColRow(getGrid())).rows > 1,
    paramSpace(av) {
      const out = [];
      for (const r of av.rotations) for (const s of av.scales) out.push({ rotation: r, scale: s });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.rowmirror(cr, p.rotation, p.scale) : buildRowMirrorCells(p.rotation, p.scale); },
  },
  columnmirror: {   // off the Rule menu since Oct 13, 2026 (= Mirror › Line: Left–right)
    retired: true,
    requiresAxis: 'flip',
    eligible: () => crDims(hooks.componentCellColRow(getGrid())).cols > 1,
    paramSpace(av) {
      const out = [];
      for (const r of av.rotations) for (const s of av.scales) out.push({ rotation: r, scale: s });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.columnmirror(cr, p.rotation, p.scale) : buildColumnMirrorCells(p.rotation, p.scale); },
  },
  radial: {
    requiresAxis: 'rotation',
    eligible: () => radialEligible(),
    paramSpace(av, cr) {   // every reading this grid can run (Random / Exhaustive)
      const out = [], ok = radialReadingsEligible();
      for (const reading of ok) for (const base of [0, 90, 180, 270]) for (const chirality of [1, -1]) for (const s of av.scales) out.push({ base, chirality, scale: s, tiled: reading === 'blocks', centre: reading === 'centre' });
      return out;
    },
    build(p, cr) { return p.centre ? GRID_BUILD.radialCentre(cr || CR_2X2, p.base, p.chirality, p.scale) : cr ? GRID_BUILD.radial(cr, p.base, p.chirality, p.scale, p.tiled) : buildRadialCells(p.base, p.chirality, p.scale); },
  },
};
export function activeFamilies() {
  const axes = activeAxes();
  return Object.keys(FAMILIES).filter(key => {
    const fam = FAMILIES[key];
    if (fam.retired) return false;
    if (fam.eligible && !fam.eligible()) return false;
    const req = fam.requiresAxis;
    if (req === null) return true;
    if (req === 'any') return axes.rotation || axes.flip || axes.scale;
    return axes[req];
  });
}
// Random draws a family, then one of ITS parameter sets, on any grid size —
// every result is a real symmetry, never per-cell noise. (Previously any grid
// other than 4 cells fell back to drawing every cell independently: pure
// noise, and on a 3×3 Exhaustive was over the cap as soon as one axis was on.)
// Structural repeats (canonical cells) are skipped — plus anything `accept`
// rejects, if given — and the draw continues until `count` distinct
// candidates exist or the space is visibly exhausted.
export function ruleRandom(accept) {
  const count = Math.round(val('rg-random-count'));
  const seed = Math.round(val('num-seed'));
  const rng = mulberry32(seed);
  const av = axisValues();
  const cr = ruleCR();
  const families = activeFamilies();
  const out = [];
  const seen = new Set();
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const fam = FAMILIES[families[Math.floor(rng() * families.length)]];
    const space = fam.paramSpace(av, cr);
    const cells = fam.build(space[Math.floor(rng() * space.length)], cr);
    const key = componentKey(cells);
    if (seen.has(key)) continue;
    seen.add(key);
    const comp = { id: `random-${seed}-${out.length}`, ruleSource: 'random', cells };
    if (accept && !accept(comp)) continue;
    out.push(comp);
  }
  return out;
}
export function ruleExhaustive() {
  const av = axisValues();
  const cr = ruleCR();
  const out = [];
  let idx = 0;
  for (const key of activeFamilies()) {
    const fam = FAMILIES[key];
    for (const params of fam.paramSpace(av, cr)) out.push({ id: `exhaustive-${idx++}`, ruleSource: 'exhaustive', cells: fam.build(params, cr) });
  }
  return dedupeComponents(out);
}
// The honest count — after the duplicate pairs (e.g. H+V vs a 180° turn, a
// Diagonal that is also a Checkerboard) are folded away.
export function exhaustiveTotal() { return state.cellShape !== 'square' ? latticeRule('exhaustive').length : ruleExhaustive().length; }
export function latticeStates() {
  const ax = activeAxes(), out = [];
  const flips = ax.flip ? [{ h: false, v: false }, ...CELL_SHAPES[state.cellShape].flips.map(f => ({ h: f === 'h', v: f === 'v' }))] : [{ h: false, v: false }];
  for (const r of ax.rotation ? rotationValues() : [0]) for (const f of flips) for (const s of axisValues().scales) out.push(stateFrom(r, f.h, f.v, s));
  return out;
}
// Radial: each cell turned towards the lattice centre. On triangles the Arc's pivot corner (the outline's
// first corner) goes to the corner nearest the centre — six of them close a full circle; elsewhere the cell's
// top faces the centre. `extra` turns every cell by one more step (the gallery's variants).
export function latticeRadialCells(extra, scale) {
  const grid = getGrid(), centers = resolveGridCells(grid), shape = state.cellShape, cs = CELL_SHAPES[shape], st = cs.step;
  const snap = r => mod360(Math.round(r / st) * st);
  return grid.cells.map((c, i) => {
    const { cx, cy } = centers[i], base = c.baseRot || 0;
    if (Math.hypot(cx, cy) < 1e-6) return stateFrom(snap(extra), false, false, scale);
    let best = 0;
    if (shape === 'triangle') {
      const cellR = Math.max(...c.points.map(p => Math.hypot(p[0] - c.centroid[0], p[1] - c.centroid[1]))), k = cellR / cs.R;
      let bd = Infinity;
      for (const t of latticeSteps()) {
        const a = (base + t) * Math.PI / 180, lx = (cs.poly[0][0] - 50) * k, ly = (cs.poly[0][1] - 50) * k;
        const d = Math.hypot(cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a));
        if (d < bd) { bd = d; best = t; }
      }
    } else best = Math.atan2(cy, cx) * 180 / Math.PI + 270 - base;
    return stateFrom(snap(best + extra), false, false, scale);
  });
}
// Checkerboard's two classes on a lattice, read from where each cell sits (it was the cell's number, i % 2,
// which on rings of hexagons is no pattern at all). Triangles: up / down. Square-packed cells (circles in a
// Square grid): a true checkerboard. Hex-packed cells (every hexagon grid, packed circles) can't be split in
// two with every neighbour different, so the classes alternate by line of cells along the neighbour direction
// nearest an axis (hexagons: columns, packed circles: rows) — each cell then differs from 4 of its 6 neighbours.
export function latticeParity() {
  const grid = getGrid();
  if (state.cellShape === 'triangle') return grid.cells.map(c => (c.baseRot > 1 ? 1 : 0));
  const P = resolveGridCells(grid).map(c => [c.cx, c.cy]);
  if (P.length < 2) return P.map(() => 0);
  let d = Infinity;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) d = Math.min(d, Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]));
  const dirs = [];   // neighbour directions, folded into [0°, 180°)
  for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) {
    const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1];
    if (i !== j && Math.hypot(dx, dy) < d * 1.1) dirs.push(mod360(Math.atan2(dy, dx) * 180 / Math.PI) % 180);
  }
  const offAxis = a => Math.min(a % 90, 90 - (a % 90));
  const [x0, y0] = P[0];
  if (dirs.every(a => offAxis(a) < 5)) return P.map(([x, y]) => (Math.round((x - x0) / d) + Math.round((y - y0) / d)) & 1);
  const a = dirs.reduce((best, b) => (offAxis(b) < offAxis(best) ? b : best)) * Math.PI / 180;
  const nx = -Math.sin(a), ny = Math.cos(a), gap = d * Math.sqrt(3) / 2;   // line spacing on a hex lattice
  return P.map(([x, y]) => Math.round(((x - x0) * nx + (y - y0) * ny) / gap) & 1);
}
// Reading order on a lattice: rows by the cells' top edge (an up and a down triangle of one strip share it), then
// left to right — the same order Step turn reads on square cells (Diego, Oct 13, 2026). rank[i] = cell i's place.
export function latticeReadingRank(grid) {
  const cells = grid.cells.map((c, i) => ({ i, top: Math.min(...c.points.map(p => p[1])), x: c.centroid[0], h: Math.max(...c.points.map(p => p[1])) - Math.min(...c.points.map(p => p[1])) }));
  const tol = Math.min(...cells.map(c => c.h)) * 0.25;
  cells.sort((a, b) => a.top - b.top);
  let row = 0, rowTop = cells.length ? cells[0].top : 0;
  cells.forEach(c => { if (c.top - rowTop > tol) { row++; rowTop = c.top; } c.row = row; });
  cells.sort((a, b) => a.row - b.row || a.x - b.x);
  const rank = new Array(cells.length);
  cells.forEach((c, k) => { rank[c.i] = k; });
  return rank;
}
// Mirror on a cell-shape lattice (Oct 13, 2026 — phase 4). 'kaleido': triangles — each cell the reflection of its
// neighbour across their shared edge (a true kaleidoscope); 'lines': hexagons and hex-packed circles — every other line
// of cells flipped (three cells meet at each corner, so not every neighbour can be a mirror); 'square': circles in
// square packing — read as columns and rows, like square cells.
export function latticeMirrorKind() {
  if (state.cellShape === 'triangle') return 'kaleido';
  const grid = getGrid(), P = resolveGridCells(grid).map(c => [c.cx, c.cy]);
  if (P.length < 2) return 'lines';
  let d = Infinity;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) d = Math.min(d, Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]));
  const offAxis = a => Math.min(a % 90, 90 - (a % 90));
  for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) {
    const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1];
    if (i !== j && Math.hypot(dx, dy) < d * 1.1 && offAxis(mod360(Math.atan2(dy, dx) * 180 / Math.PI) % 180) >= 5) return 'lines';
  }
  return 'square';
}
// The kaleidoscope's isometries: cell k's content = L_k · (the base cell's content). BFS over shared edges from the
// cell nearest the centre; L = the product of the edge reflections on the way (a 2 × 2 linear part — translations
// are carried by the cell centres). Returns [{ det, theta }] per cell.
function kaleidoMaps(grid) {
  const cells = grid.cells, key = p => p[0].toFixed(3) + ',' + p[1].toFixed(3);
  const cx = cells.reduce((a, c) => a + c.centroid[0], 0) / cells.length, cy = cells.reduce((a, c) => a + c.centroid[1], 0) / cells.length;
  let base = 0;
  cells.forEach((c, i) => { if (Math.hypot(c.centroid[0] - cx, c.centroid[1] - cy) < Math.hypot(cells[base].centroid[0] - cx, cells[base].centroid[1] - cy) - 1e-6) base = i; });
  const L = new Array(cells.length).fill(null), mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
  L[base] = [1, 0, 0, 1];
  const queue = [base];
  while (queue.length) {
    const t = queue.shift(), tk = cells[t].points.map(key);
    cells.forEach((n, k) => {
      if (L[k]) return;
      const shared = n.points.filter(p => tk.includes(key(p)));
      if (shared.length < 2) return;
      let ux = shared[1][0] - shared[0][0], uy = shared[1][1] - shared[0][1]; const l = Math.hypot(ux, uy); ux /= l; uy /= l;
      L[k] = mul([ux * ux - uy * uy, 2 * ux * uy, 2 * ux * uy, uy * uy - ux * ux], L[t]);   // [a, b, c, d] row-major
      queue.push(k);
    });
  }
  return { base, maps: L.map(m => { if (!m) return { det: 1, theta: 0 }; const det = m[0] * m[3] - m[1] * m[2];
    return det > 0 ? { det, theta: Math.atan2(m[2], m[0]) * 180 / Math.PI } : { det, theta: Math.atan2(-m[2], -m[0]) * 180 / Math.PI }; }) };
}
export function latticeMirrorCells(R, seed, scale) {
  const grid = getGrid(), kind = latticeMirrorKind(), snap = r => mod360(Math.round(r));
  if (kind === 'kaleido') {
    const { base, maps } = kaleidoMaps(grid), b0 = grid.cells[base].baseRot || 0;
    // det > 0: a turn θ → rot(θ + b0 + R); det < 0: rot(θ)·flipH·rot(b0 + R) = rot(θ − b0 − R)·flipH. Minus the cell's own pose.
    return grid.cells.map((c, k) => { const m = maps[k], bk = c.baseRot || 0;
      return m.det > 0 ? stateFrom(snap(m.theta + b0 + R - bk), false, false, scale) : stateFrom(snap(m.theta - b0 - R - bk), true, false, scale); });
  }
  const P = resolveGridCells(grid).map(c => [c.cx, c.cy]);
  let d = Infinity;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) d = Math.min(d, Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]));
  const [x0, y0] = P[0];
  if (kind === 'square') {
    const cr = P.map(([x, y]) => ({ col: Math.round((x - x0) / d), row: Math.round((y - y0) / d) })), m = Math.min(...cr.map(c => c.col)), n = Math.min(...cr.map(c => c.row));
    return GRID_BUILD.mirrorLine(cr.map(c => ({ col: c.col - m, row: c.row - n })), seed, mirrorLinesEligible().includes(state.mirrorLine) ? state.mirrorLine : 'both', R, scale);
  }
  // lines: the latticeParity classes; hexagons stack in columns (flip left–right), packed circles in rows (top–bottom)
  const par = latticeParity(), flipH = state.cellShape === 'hexagon';
  return par.map(p => ((p + seed) % 2 === 1 ? stateFrom(snap(-R), flipH, !flipH, scale) : stateFrom(snap(R), false, false, scale)));
}
// Checkerboard on a lattice. Triangles and square-packed circles: two states by where the cell sits (latticeParity).
// Hexagons and hex-packed circles: THREE states (Oct 13, 2026 — Diego: "improve it as we have more complex geometry") —
// the centres form a triangular lattice, and (i + 2j) mod 3 on its basis gives every neighbour a different state, which
// no two-state pattern can. Each set of states once; state.checkerStart turns which state sits on the first class
// (the class of the cell the lattice is read from); allStarts lists every turn (Exhaustive).
export function latticeThreeClasses() {
  const P = resolveGridCells(getGrid()).map(c => [c.cx, c.cy]);
  if (P.length < 2) return P.map(() => 0);
  let d = Infinity, v1 = null;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const e = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]); if (e < d - 1e-6) { d = e; v1 = [P[j][0] - P[i][0], P[j][1] - P[i][1]]; } }
  const a = Math.atan2(v1[1], v1[0]) + Math.PI / 3, v2 = [d * Math.cos(a), d * Math.sin(a)], det = v1[0] * v2[1] - v1[1] * v2[0], [x0, y0] = P[0];
  return P.map(([x, y]) => { const dx = x - x0, dy = y - y0, i = Math.round((dx * v2[1] - dy * v2[0]) / det), j = Math.round((v1[0] * dy - v1[1] * dx) / det); return ((i + 2 * j) % 3 + 3) % 3; });
}
export function latticeCheckerClasses() { return latticeMirrorKind() === 'lines' ? { n: 3, cls: latticeThreeClasses() } : { n: 2, cls: latticeParity() }; }
export function latticeCheckerboards(allStarts) {
  const { n, cls } = latticeCheckerClasses(), S = checkerStates(latticeStates()), out = [];
  const starts = allStarts ? [...Array(n).keys()] : [Math.min(state.checkerStart || 0, n - 1)];
  const sets = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { if (n === 2) sets.push([S[i], S[j]]); else for (let k = j + 1; k < S.length; k++) sets.push([S[i], S[j], S[k]]); }
  for (const set of sets) for (const st of starts) out.push(cls.map(c => ({ ...set[(c + st) % n] })));
  return out;
}
export function latticeRule(mode, opts) {
  const n = getGrid().cells.length, scales = axisValues().scales;
  const pack = (key, list) => dedupeComponents(list.map((cells, i) => ({ id: `${key}-${i}`, ruleSource: key, cells })));
  if (mode === 'identity') return pack('identity', latticeStates().map(s => Array.from({ length: n }, () => ({ ...s }))));
  if (mode === 'radial') return pack('radial', latticeSteps().flatMap(e => scales.map(s => latticeRadialCells(e, s))));
  // Step turn: each cell one step of the cell shape's own (hexagon 60°, triangle 120°, circle 90°) more than the one
  // before it in reading order; start × direction × scales (Oct 13, 2026).
  if (mode === 'pinwheel') {
    const st = CELL_SHAPES[state.cellShape].step, rank = latticeReadingRank(getGrid()), list = [];
    for (const start of latticeSteps()) for (const ch of [1, -1]) for (const s of scales) list.push(rank.map(k => stateFrom(mod360(start + ch * st * k), false, false, s)));
    return pack('pinwheel', list);
  }
  if (mode === 'mirror') {
    const kind = latticeMirrorKind(), seeds = kind === 'square' ? [0, 1, 2, 3] : kind === 'lines' ? [0, 1] : [0], list = [];
    for (const R of activeAxes().rotation ? rotationValues() : [0]) for (const sd of seeds) for (const s of scales) list.push(latticeMirrorCells(R, sd, s));
    return pack('mirror', list);
  }
  if (mode === 'checkerboard') return pack('checkerboard', latticeCheckerboards(opts && opts.allStarts));
  if (mode === 'random') {
    const count = Math.round(val('rg-random-count')), seed = Math.round(val('num-seed')), rng = mulberry32(seed), sts = latticeStates();
    const out = [], seen = new Set();
    for (let tries = 0; out.length < count && tries < count * 40; tries++) {
      const cells = Array.from({ length: n }, () => ({ ...sts[Math.floor(rng() * sts.length)] }));
      const key = componentKey(cells); if (seen.has(key)) continue;
      seen.add(key); out.push({ id: `random-${seed}-${out.length}`, ruleSource: 'random', cells });
    }
    return out;
  }
  if (mode === 'exhaustive') return dedupeComponents(['identity', 'pinwheel', ...(activeAxes().flip ? ['mirror'] : []), 'radial', 'checkerboard'].flatMap(m => latticeRule(m, { allStarts: true })).map((c, i) => ({ ...c, id: `exhaustive-${i}`, ruleSource: 'exhaustive' })));
  return [];
}
export function readManualCells() {
  const cells = [];
  for (let i = 0; i < activeCellCount(); i++) {
    cells.push({
      rotation: parseInt(pv(`sel-manual-rot-${i}`), 10),
      flipH: pv(`sel-manual-flip-${i}`) === 'h' || pv(`sel-manual-flip-${i}`) === 'hv',
      flipV: pv(`sel-manual-flip-${i}`) === 'v' || pv(`sel-manual-flip-${i}`) === 'hv',
      scale: parseFloat(pv(`sel-manual-scale-${i}`)),
    });
  }
  return cells;
}
