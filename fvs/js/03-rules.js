// Flexible Visual System · 03-rules — Component grid + transform rules — FAMILIES, lattice rules, rule builders.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  state
} from './engine/00-core.js';
import {
  CELL_OUTLINES, CELL_SHAPES, OUTLINE_GATE, latticeRings, resolveGridCells
} from './engine/01-geometry.js';
import {
  FLIPS, GALLERY_THUMB, GRID_BUILD, ROTATIONS, buildCheckerboardCells, buildColumnMirrorCells,
  buildDiagonalCells, buildIdentityCells, buildMirrorCells, buildPinwheelCells, buildRadialCells,
  buildRowMirrorCells, componentKey, crDims, crIsLarge, dedupeComponents, fitThumbBox, latticeSteps,
  mod360, mulberry32, stateFrom
} from './engine/03-rules.js';
import {
  componentCellColRow
} from './engine/04-appearance.js';
import {
  snap90
} from './engine/11-symbol-ui.js';
import {
  ctrl, val
} from './00-core.js';
import {
  cellLatticeGrid
} from './01-geometry.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  getGrid: () => getGrid, syncComponentGridUI: () => syncComponentGridUI
});
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
  return { kind: 'square', cols: +ctrl('rg-grid-cols').value, rows: +ctrl('rg-grid-rows').value, cellSize: val('rg-cellsize'), gap: val('rg-gap') };
}
// spec: 'square3x3' (the recipes' string form), {cols, rows}, or a saved entry.grid.
export function setComponentGrid(spec, opts = {}) {
  let cols = 2, rows = 2;
  if (spec && spec.lattice) {   // a cell-shape lattice: the cell shape itself comes with the Element (seed.cellShape)
    state.cellLattice[spec.lattice.shape] = latticeRings(spec.lattice);
    if (spec.lattice.outline && CELL_OUTLINES[spec.lattice.shape].includes(spec.lattice.outline)) state.cellOutline[spec.lattice.shape] = spec.lattice.outline;
    state.loomGrid = null;
    syncComponentGridUI();
    if (!opts.silent) { hooks.syncRuleAvailability(); hooks.renderGallery(); }
    return;
  }
  if (typeof spec === 'string') { const m = spec.match(/^square(\d)x(\d)$/); if (m) { cols = +m[1]; rows = +m[2]; } }
  else if (spec && spec.kind === 'loom') {
    state.loomGrid = { cellShape: spec.cellShape, cells: spec.cells, inner: { width: spec.width, height: spec.height } };
  } else if (spec) { cols = spec.cols; rows = spec.rows || spec.cols; }
  if (!(spec && spec.kind === 'loom')) {
    state.loomGrid = null;
    cols = String(Math.min(4, Math.max(1, cols))); rows = String(Math.min(4, Math.max(1, rows)));
    ctrl('rg-grid-cols').value = cols; ctrl('v-grid-cols').textContent = cols;
    ctrl('rg-grid-rows').value = rows; ctrl('v-grid-rows').textContent = rows;
  }
  syncComponentGridUI();
  if (!opts.silent) { hooks.syncRuleAvailability(); hooks.renderGallery(); }
}
export function syncComponentGridUI() {
  const lattice = state.cellShape !== 'square';
  const legacy = !lattice && !!state.loomGrid;
  ctrl('grid-legacy-hint').style.display = legacy ? '' : 'none';
  ctrl('grid-square-block').style.display = legacy ? 'none' : '';
  ctrl('gap-row').style.display = lattice ? 'none' : '';
  ctrl('grid-cols-row').style.display = ctrl('grid-rows-row').style.display = lattice ? 'none' : '';
  ctrl('grid-lattice-row').style.display = lattice ? '' : 'none';
  ctrl('grid-outline-row').style.display = lattice ? '' : 'none';
  // Container / Mask fit the underlying Component in a square frame — square cells only.
  ['container', 'mask'].forEach(v => {
    const o = ctrl('sel-component-role').querySelector(`option[value="${v}"]`);
    o.disabled = lattice; o.title = lattice ? `${o.textContent} needs a square cell` : '';
  });
  if (lattice && state.componentRole !== 'normal') {
    state.componentRole = 'normal'; ctrl('sel-component-role').value = 'normal';
    if (typeof hooks.syncComponentRoleUI === 'function') hooks.syncComponentRoleUI();
  }
  if (lattice) {
    const n = state.cellLattice[state.cellShape], ol = state.cellOutline[state.cellShape];
    ctrl('rg-grid-rings').value = n; ctrl('v-grid-rings').textContent = n;
    ctrl('seg-grid-outline').querySelectorAll('.seg-btn').forEach(b => {
      const ok = CELL_OUTLINES[state.cellShape].includes(b.dataset.outline), on = b.dataset.outline === ol;
      const why = ok ? '' : ((OUTLINE_GATE[state.cellShape] || {})[b.dataset.outline] || '');
      b.setAttribute('aria-disabled', String(!ok)); b.title = ok ? b.getAttribute('aria-label') : why;
      if (why) b.setAttribute('aria-description', why); else b.removeAttribute('aria-description');
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
  }
}

// resolveGridCells(grid) / frameSize(grid) — moved to shared/shapes.js,
// aliased at the top of this script. Returns [{cx, cy, cellSize, cellW,
// cellH}], one per cell, relative to the grid's own centre.

rt.galleryZoom = 1;
export function setGalleryThumbVars(size) {
  const box = fitThumbBox(size.w, size.h, Math.round(GALLERY_THUMB * rt.galleryZoom));
  const g = document.getElementById('gallery');
  g.style.setProperty('--thumb-w', box.w + 'px');
  g.style.setProperty('--thumb-h', box.h + 'px');
}


export function scaleValues() {
  return [val('rg-scale-small') / 100, val('rg-scale-medium') / 100, val('rg-scale-large') / 100];
}

export function activeAxes() {
  return {
    rotation: ctrl('chk-axis-rotation').checked,
    flip: ctrl('chk-axis-flip').checked,
    scale: ctrl('chk-axis-scale').checked,
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



// ── Rule engine ──────────────────────────────────────────────
// Two layers share the same geometry:
//   1. Named STANDALONE rules (the dropdown) — each enumerates its own
//      small, curated, always-symmetric set, ignoring the axis
//      checkboxes entirely (unchanged design: "Identity/Pinwheel/Mirror
//      use their own fixed pattern").
//   2. The FAMILIES registry — used ONLY by Random/Exhaustive, which
//      pick a family (Identity/Pinwheel/Mirror/Diagonal/Checkerboard)
//      and vary ITS OWN parameters over the active axes, rather than
//      choosing all 4 cells independently. This is the direct fix for
//      "random/exhaustive often look like noise": every result, no
//      matter how it's picked, is still a member of a real symmetry
//      family, which is what the reference brief's own examples all
//      are. It's also what makes "low-entropy" happen for free — every
//      family caps how many DISTINCT states can appear across the 4
//      cells (1 for Identity, 2 for Mirror/Diagonal/Checkerboard, at
//      most 4 rotations sharing one shape for Pinwheel) rather than
//      allowing 4 fully independent cells the way the old design did.
// Each returns an array of {id, ruleSource, cells:[4]}.



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
  return componentCellColRow(grid).every((c, i) => c.col === i % 2 && c.row === (i >> 1));
}
export function ruleCR() { return isCanonical2x2() ? null : componentCellColRow(getGrid()); }


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
  const cr = componentCellColRow(getGrid());
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
  const ctxs = componentCellColRow(grid);
  const mode = ctrl('sel-lines-mode').value;
  const step = parseInt(ctrl('rg-lines-step').value, 10) || 0;
  const scaleOn = ctrl('chk-axis-scale').checked;
  const sv = scaleValues();
  const cells = ctxs.map(ctx => {
    const key = axis === 'row' ? ctx.row : ctx.col;
    const rot = mode === 'ramp' ? snap90(step * key) : (key % 2 ? step : 0);
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
  const ctxs = componentCellColRow(grid);
  const angle = parseInt(ctrl('sel-osc-angle').value, 10);
  const shift = parseFloat(ctrl('rg-osc-shift').value);
  const period = parseInt(ctrl('rg-osc-period').value, 10) || 1;
  const phase = parseInt(ctrl('rg-osc-phase').value, 10);
  const scaleOn = ctrl('chk-axis-scale').checked;
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
    eligible: () => crDims(componentCellColRow(getGrid())).rows > 1,
    paramSpace(av) {
      const out = [];
      for (const r of av.rotations) for (const s of av.scales) out.push({ rotation: r, scale: s });
      return out;
    },
    build(p, cr) { return cr ? GRID_BUILD.rowmirror(cr, p.rotation, p.scale) : buildRowMirrorCells(p.rotation, p.scale); },
  },
  columnmirror: {
    requiresAxis: 'flip',
    eligible: () => crDims(componentCellColRow(getGrid())).cols > 1,
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
      rotation: parseInt(ctrl(`sel-manual-rot-${i}`).value, 10),
      flipH: ctrl(`sel-manual-flip-${i}`).value === 'h' || ctrl(`sel-manual-flip-${i}`).value === 'hv',
      flipV: ctrl(`sel-manual-flip-${i}`).value === 'v' || ctrl(`sel-manual-flip-${i}`).value === 'hv',
      scale: parseFloat(ctrl(`sel-manual-scale-${i}`).value),
    });
  }
  return cells;
}
