/* ─────────────────────────────────────────────────────────────
   Bento generator — the "simple" MVP generator (brief's own pairing:
   one simple, one complex, to prove the architecture end to end before
   building out the other ~24 elementary/preset types).

   Topology: a base Columns×Rows lattice, then adjacent cells are randomly
   merged into rectangular spans (1×1 up to 2×2) — the mixed-size look a
   Bento box grid is named for. Merging is a pure seeded-random pass over
   the lattice, independent of sizing.

   Sizing: solved by Kiwi (constraint-engine's solveTracksKiwi) — every
   track equal by default, at MEDIUM strength (a soft preference, not a
   hard rule), plus a hard minimum size and a hard "tracks + gaps fill the
   canvas" sum. That soft-equal constraint is exactly the hook Phase 4's
   drag-to-resize will grab: dragging one track becomes a stronger edit
   constraint and the others re-solve around it, no redistribution code
   to write by hand. Bento's visual variety comes entirely from the SPAN
   topology above (which cells merge), not from unequal track sizing —
   a first version that weighted tracks by how many cells touched them
   was tried and reverted: dividing a wide cell's contribution across its
   own tracks made them thinner, the opposite of the intended "a 2-wide
   cell reads as a bigger block" look.
   ───────────────────────────────────────────────────────────── */

import { solveTracksKiwi } from '../constraint-engine.js';

// Tiny local seeded RNG — every Organica tool that needs one keeps its own
// copy rather than sharing a generic PRNG module (see Camo Turing/Komorebi);
// one-line utility, not worth a shared dependency.
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSpans(cols, rows, variety, seed) {
  const rng = mulberry32(seed);
  const occupied = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const spans = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (occupied[r][c]) continue;
      let colSpan = 1, rowSpan = 1;
      // `variety` gates how often a merge is attempted at all, so 0 is a
      // guaranteed plain 1×1 grid (a true no-op, same discipline as every
      // other tool's own "0 = off" controls).
      if (rng() < variety) {
        const canGrowCol = c + 1 < cols && !occupied[r][c + 1] && rng() < 0.6;
        const canGrowRow = r + 1 < rows && !occupied[r + 1][c] && rng() < 0.6;
        if (canGrowCol) colSpan = 2;
        if (canGrowRow) rowSpan = 2;
        // A 2×2 merge needs its 4th corner free too, or it would overlap
        // whatever the row/col-only merge above already claimed.
        if (colSpan === 2 && rowSpan === 2 && occupied[r + 1][c + 1]) rowSpan = 1;
      }
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) occupied[r + dr][c + dc] = true;
      }
      spans.push({ col: c, row: r, colSpan, rowSpan });
    }
  }
  return spans;
}

/**
 * @param {{cols:number, rows:number, variety:number, gap:number, seed:number}} params
 * @param {{width:number, height:number}} inner  canvas inner rect size
 */
export function generateBento(params, inner) {
  const { cols, rows, variety, gap, seed } = params;
  const cells = buildSpans(cols, rows, variety, seed).map((s, i) => ({ id: 'c' + i, ...s }));

  const colSizes = solveTracksKiwi(cols, inner.width, gap);
  const rowSizes = solveTracksKiwi(rows, inner.height, gap);

  return {
    grid: {
      type: 'bento',
      solver: 'kiwi',
      params: { cols, rows, variety, seed },
      gap,
      tracks: { cols: colSizes, rows: rowSizes },
    },
    cells,
  };
}
