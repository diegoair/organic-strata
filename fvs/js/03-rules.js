// Flexible Visual System · 03-rules — Component grid + transform rules — FAMILIES, lattice rules, rule builders.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  state
} from './engine/00-core.js';
import {
  CELL_OUTLINES, OUTLINE_GATE, latticeRings
} from './engine/01-geometry.js';
import {
  GALLERY_THUMB, fitThumbBox
} from './engine/03-rules.js';
import {
  ctrl
} from './00-core.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  syncComponentGridUI: () => syncComponentGridUI
});
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
