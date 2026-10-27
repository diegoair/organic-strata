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
 * @param {{cols:number, rows:number, variety:number, gap:number, seed:number, square?:boolean}} params
 * @param {{width:number, height:number}} inner  canvas inner rect size
 *
 * SQUARE CELLS (`square: true`, Diego, Oct 27, 2026). Columns and Rows stay as
 * chosen; every base cell is an exact square of side
 *   s = min((inner.width − (cols−1)·gap) / cols, (inner.height − (rows−1)·gap) / rows)
 * and the grid is centred: the leftover on the long side is split equally,
 *   grid.offset = { x: (inner.width − used width) / 2, y: (inner.height − used height) / 2 }
 * (Rows was derived from Columns the first day — Diego: keep Rows.)
 * OVERFLOW (`overflow: true` + `reach` {left, top, right, bottom} = the canvas around inner): the squares go on to
 * the canvas's edges on the same lattice; the tracks then count the extra squares, params keep what was asked.
 * KEEP MARGIN (`keepMargin: true`, reach 0): only to the inner rect, the edge tracks cut down to it.
 * `grid.offset` is the model's way to say "the tracks start this far in from
 * the inner rect's top-left": every reader that turns tracks into rects adds
 * it (json-model.js resolveCellRects, the HTML renderer's padding, main.js's
 * track handles). Absent / {0,0} = today's behaviour, so every other
 * generator and every saved model is unchanged. Spans (Variety) are built
 * on the derived rows exactly as on typed rows.
 */
export function generateBento(params, inner) {
  const { variety, gap, seed } = params;
  let { cols, rows } = params; const square = !!params.square;
  let colSizes, rowSizes, offset = null;
  const over = !!params.overflow;
  if (square || over) {
    // Columns and Rows as chosen; with Square cells the side is the larger square that fits both ways, the grid centred
    // (Diego, Oct 27, 2026: Rows stays — it was derived from Columns until then); without, the cells fill the inner rect
    const fx = (inner.width - (cols - 1) * gap) / cols, fy = (inner.height - (rows - 1) * gap) / rows;
    const sx = square ? Math.min(fx, fy) : fx, sy = square ? sx : fy;
    offset = { x: (inner.width - (cols * sx + (cols - 1) * gap)) / 2, y: (inner.height - (rows * sy + (rows - 1) * gap)) / 2 };
    // Overflow (`reach` = the canvas's edges around the inner rect) — with or without Square cells (Diego): the same
    // cells go on to them on the same lattice, the chosen grid where it was; the canvas cuts the outer ones
    if (over && params.reach) {
      const px = sx + gap, py = sy + gap, R = params.reach;
      const l = Math.ceil((offset.x + R.left) / px - 1e-9), t = Math.ceil((offset.y + R.top) / py - 1e-9);
      const r = Math.ceil((inner.width - offset.x - (cols * sx + (cols - 1) * gap) + R.right) / px - 1e-9), b = Math.ceil((inner.height - offset.y - (rows * sy + (rows - 1) * gap) + R.bottom) / py - 1e-9);
      offset = { x: offset.x - l * px, y: offset.y - t * py };
      cols += l + r; rows += t + b;
    }
    colSizes = new Array(cols).fill(sx); rowSizes = new Array(rows).fill(sy);
    // Keep margin (`reach` all 0 — main.js): the cells stop at the inner rect; the edge tracks are cut down to it, so
    // every renderer draws the cut cells as they are (Diego, Oct 27, 2026)
    if (over && params.keepMargin) {
      const trim = (sizes, start, span) => {
        const over0 = Math.max(0, -start), end = start + sizes.reduce((a, v) => a + v, 0) + gap * (sizes.length - 1), over1 = Math.max(0, end - span);
        sizes[0] -= over0; sizes[sizes.length - 1] -= over1;
        return start + over0;
      };
      offset = { x: trim(colSizes, offset.x, inner.width), y: trim(rowSizes, offset.y, inner.height) };
    }
    if (!offset.x && !offset.y) offset = null;
  } else {
    colSizes = solveTracksKiwi(cols, inner.width, gap);
    rowSizes = solveTracksKiwi(rows, inner.height, gap);
  }
  const cells = buildSpans(cols, rows, variety, seed).map((s, i) => ({ id: 'c' + i, ...s }));

  const grid = {
    type: 'bento',
    solver: 'kiwi',
    params: square || over ? { cols: params.cols, rows: params.rows, variety, seed, ...(square ? { square: true } : {}), ...(over ? { overflow: true } : {}), ...(over && params.keepMargin ? { keepMargin: true } : {}) } : { cols, rows, variety, seed },
    gap,
    tracks: { cols: colSizes, rows: rowSizes },
  };
  if (offset) grid.offset = offset;
  return { grid, cells };
}
