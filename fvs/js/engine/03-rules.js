// Flexible Visual System · engine/03-rules — the engine part of 03-rules.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  state
} from './00-core.js';
import {
  CELL_SHAPES
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
export function componentKey(cells) { return cells.map(canonicalState).join(','); }
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
  bookmatch: (cr, axis, sc) => { const d = crDims(cr); return cr.map(c => stateFrom(0, axis !== 'v' && c.col >= d.cols / 2, axis !== 'h' && c.row >= d.rows / 2, sc)); },
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
};
// A grid bigger than one 2×2 block — where the global and the tiled readings differ.
export const crIsLarge = cr => { if (!cr) return false; const d = crDims(cr); return d.cols > 2 || d.rows > 2; };
// ── Rules on a cell-shape lattice (test) — every turn is a step of the cell shape's own (90° circle, 120°
// triangle, 60° hexagon), added to the cell's own pose (a down triangle sits at 60°). Square cells never reach here.
export const LATTICE_RULES = new Set(['identity', 'radial', 'checkerboard', 'random', 'exhaustive']);
export function latticeSteps() {
  const st = CELL_SHAPES[state.cellShape].step, out = [];
  for (let r = 0; r < 360; r += st) out.push(r);
  return out;
}
export const EXHAUSTIVE_CAP = 512;
