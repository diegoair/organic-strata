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
  if (state.cellShape !== 'square') return cellLatticeGrid();
  if (state.loomGrid) {
    return { kind: 'loom', cellShape: state.loomGrid.cellShape, cells: state.loomGrid.cells, width: state.loomGrid.inner.width, height: state.loomGrid.inner.height };
  }
  return { kind: 'square', cols: +pv('rg-grid-cols'), rows: +pv('rg-grid-rows'), cellSize: val('rg-cellsize'), gap: val('rg-gap') };
}
export function scaleValues() {
  return [val('rg-scale-small') / 100, val('rg-scale-medium') / 100, val('rg-scale-large') / 100];
}
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
    rotations: axes.rotation ? ROTATIONS : [0],
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
export function ruleMirror() {
  const gallery = familyRuleGallery('mirror');
  // Beyond 2×2 the per-tile mirror above is not the only reading: add the
  // whole-grid (book-matched) mirrors — left|right, top|bottom, and both —
  // from their own FAMILIES entry, same axis-gating.
  const bm = FAMILIES.bookmatch;
  if (bm.eligible()) {
    const av = axisValues();
    const cr = ruleCR();
    bm.paramSpace(av, cr).forEach((p, i) => gallery.push({ id: `mirror-book-${i}`, ruleSource: 'mirror', cells: bm.build(p, cr) }));
  }
  return dedupeComponents(gallery);
}
export function ruleDiagonal() { return familyRuleGallery('diagonal'); }
export function ruleCheckerboard() { return familyRuleGallery('checkerboard'); }
export function ruleRowMirror() { return familyRuleGallery('rowmirror'); }
export function ruleColumnMirror() { return familyRuleGallery('columnmirror'); }
// Radial needs a centre that falls between cells: an even × even grid (the
// four quadrants each take one step of the clockwise walk TL,TR,BR,BL).
export function radialEligible() {
  if (isCanonical2x2()) return true;
  const cr = hooks.componentCellColRow(getGrid());
  if (!cr.length) return false;
  const d = crDims(cr);
  return d.cols % 2 === 0 && d.rows % 2 === 0 && d.cols * d.rows === cr.length;
}
export function ruleRadial() { return familyRuleGallery('radial'); }
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
    const scale = !scaleOn ? 1.0 : (mode === 'ramp' ? sv[key % sv.length] : sv[key % 2 ? 2 : 0]);
    return stateFrom(((rot % 360) + 360) % 360, false, false, scale);
  });
  const ruleSource = axis === 'row' ? 'hlines' : 'vlines';
  return [{ id: `${ruleSource}-${mode}-${step}-${scaleOn ? 's' : ''}`, ruleSource, cells }];
}
// Oscillator (Truchet) — byte-identical math to the Symbols tier's own
// SYMBOL_RULES.oscillator.fn (bookofshapes concentric_arc_truchet_3:
// "rotation 0/90 from (col + rowShift·row) parity"), ported here reading
// Components' own controls + componentCellColRow instead of Symbols'
// cellColRow/state.symbolCells — N×M-general like ruleLines above, not
// tied to a fixed Loom Bento import. Pair with SEED_TYPES.arctruchet
// (step 01) for the reference look. Scale axis, same idea as ruleLines: the
// phase-position key already driving rotation on/off also indexes into
// Small/Medium/Large — off, scale stays 1.0 everywhere (byte-identical).
export function ruleOscillator() {
  const grid = getGrid();
  const ctxs = hooks.componentCellColRow(grid);
  const angle = parseInt(pv('sel-osc-angle'), 10);
  const shift = parseFloat(pv('rg-osc-shift'));
  const period = parseInt(pv('rg-osc-period'), 10) || 1;
  const phase = parseInt(pv('rg-osc-phase'), 10);
  const scaleOn = pc('chk-axis-scale');
  const sv = scaleValues();
  const cells = ctxs.map(ctx => {
    const raw = ctx.col + Math.floor(shift * ctx.row);
    const mod = ((raw % period) + period) % period;
    const phaseMod = ((phase % period) + period) % period;
    const scale = scaleOn ? sv[mod % sv.length] : 1.0;
    return stateFrom(mod === phaseMod ? angle : 0, false, false, scale);
  });
  return [{ id: `oscillator-${angle}-${shift}-${period}-${phase}-${scaleOn ? 's' : ''}`, ruleSource: 'oscillator', cells }];
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
    paramSpace(av) {
      const out = [];
      for (let seed = 0; seed < 4; seed++) for (const s of av.scales) out.push({ seed, scale: s });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.mirror(cr, p.seed, p.scale) : buildMirrorCells(p.seed, p.scale); },
  },
  bookmatch: {
    requiresAxis: 'flip',
    eligible: () => !isCanonical2x2(),
    paramSpace(av) {
      const out = [];
      for (const axis of ['h', 'v', 'hv']) for (const s of av.scales) out.push({ axis, scale: s });
      return out;
    },
    build(p, cr) { return GRID_BUILD.bookmatch(cr, p.axis, p.scale); },
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
  rowmirror: {
    requiresAxis: 'flip',
    eligible: () => crDims(hooks.componentCellColRow(getGrid())).rows > 1,
    paramSpace(av) {
      const out = [];
      for (const r of av.rotations) for (const s of av.scales) out.push({ rotation: r, scale: s });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.rowmirror(cr, p.rotation, p.scale) : buildRowMirrorCells(p.rotation, p.scale); },
  },
  columnmirror: {
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
    paramSpace(av, cr) {
      const out = [];
      for (const tiled of crIsLarge(cr) ? [false, true] : [false])
        for (const base of [0, 90, 180, 270]) for (const chirality of [1, -1]) for (const s of av.scales) out.push({ base, chirality, scale: s, tiled });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.radial(cr, p.base, p.chirality, p.scale, p.tiled) : buildRadialCells(p.base, p.chirality, p.scale); },
  },
};
export function activeFamilies() {
  const axes = activeAxes();
  return Object.keys(FAMILIES).filter(key => {
    const fam = FAMILIES[key];
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
  for (const r of ax.rotation ? latticeSteps() : [0]) for (const f of flips) for (const s of axisValues().scales) out.push(stateFrom(r, f.h, f.v, s));
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
export function latticeParity() {
  const grid = getGrid();
  return grid.cells.map((c, i) => state.cellShape === 'triangle' ? (c.baseRot > 1 ? 1 : 0) : i % 2);
}
export function latticeRule(mode) {
  const n = getGrid().cells.length, scales = axisValues().scales;
  const pack = (key, list) => dedupeComponents(list.map((cells, i) => ({ id: `${key}-${i}`, ruleSource: key, cells })));
  if (mode === 'identity') return pack('identity', latticeStates().map(s => Array.from({ length: n }, () => ({ ...s }))));
  if (mode === 'radial') return pack('radial', latticeSteps().flatMap(e => scales.map(s => latticeRadialCells(e, s))));
  if (mode === 'checkerboard') {
    const par = latticeParity(), sts = latticeStates(), out = [];
    for (const a of sts) for (const b of sts) if (a !== b) out.push(par.map(p => ({ ...(p ? b : a) })));
    return pack('checkerboard', out);
  }
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
  if (mode === 'exhaustive') return dedupeComponents(['identity', 'radial', 'checkerboard'].flatMap(m => latticeRule(m)).map((c, i) => ({ ...c, id: `exhaustive-${i}`, ruleSource: 'exhaustive' })));
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
