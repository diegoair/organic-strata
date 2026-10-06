// Flexible Visual System · 08-symbol-grid — Symbol grid — presets, Loom models, Symbol Canvas, generators, arrival, Fit / Anchor.
// One of the classic scripts fvs/index.html loads in order (fvs/js/00 … 99); they share one global scope.
// Architecture + file map: docs/FVS.md §Architecture.
'use strict';
// ═══════════════════════════════════════════════════════════════
// SYMBOLS — a second tier: a Loom grid whose cells each hold either a
// raw Seed (the same transform vocabulary Components already use)
// or a whole saved Component, nested and scaled into that one cell.
// Deliberately NOT built on top of Components' own state (state.loomGrid
// /state.components) — a Symbol has its own independent grid and its
// own heterogeneous per-cell fill, so it gets its own state fields
// (state.symbolGrid/state.symbolCells) and its own small set of
// functions below, reusing resolveGridCells/frameSize/SEED_TYPES/
// buildComponentItems/mulberry32/colorAt exactly as-is.
// ═══════════════════════════════════════════════════════════════

// Two real Loom exports (captured live from /loom/, not hand-built) —
// a small Bento (7 merged rect cells) and a Hexagonal (17 polygon
// cells, the "more complex" case), both well under Loom's own
// defaults so the evaluation stays small per Diego's own instruction.
const SYMBOL_GRID_PRESETS = {
  bento: {
    "version": "1.0", "canvas": { "width": 1080, "height": 1080, "displayWidth": 1080, "displayHeight": 1080, "unit": "px", "orientation": "landscape", "marginTop": 0, "marginRight": 0, "marginBottom": 0, "marginLeft": 0, "margin": 0, "safeArea": 0, "bleed": 0 },
    "grid": { "type": "bento", "solver": "kiwi", "params": { "cols": 3, "rows": 3, "variety": 0.35, "seed": 7 }, "gap": 0, "tracks": { "cols": [360, 360, 360], "rows": [360, 360, 360] }, "padding": 0 },
    "cells": [
      { "id": "c0", "col": 0, "row": 0, "colSpan": 2, "rowSpan": 1, "number": 1 },
      { "id": "c1", "col": 2, "row": 0, "colSpan": 1, "rowSpan": 1, "number": 2 },
      { "id": "c2", "col": 0, "row": 1, "colSpan": 1, "rowSpan": 1, "number": 3 },
      { "id": "c3", "col": 1, "row": 1, "colSpan": 1, "rowSpan": 1, "number": 4 },
      { "id": "c4", "col": 2, "row": 1, "colSpan": 1, "rowSpan": 1, "number": 5 },
      { "id": "c5", "col": 0, "row": 2, "colSpan": 2, "rowSpan": 1, "number": 6 },
      { "id": "c6", "col": 2, "row": 2, "colSpan": 1, "rowSpan": 1, "number": 7 }
    ]
  },
  hexagonal: {
    "version": "1.0", "canvas": { "width": 1080, "height": 1080, "displayWidth": 1080, "displayHeight": 1080, "unit": "px", "orientation": "landscape", "marginTop": 0, "marginRight": 0, "marginBottom": 0, "marginLeft": 0, "margin": 0, "safeArea": 0, "bleed": 0 },
    "grid": { "type": "hexagonal", "solver": "geometric", "cellShape": "polygon", "params": { "cols": 3, "rotation": 0, "spinMode": "off", "spinAmount": 20, "noiseScale": 3, "gap": 0, "jitter": 0, "seed": 7 }, "gap": 0, "padding": 0 },
    "cells": [
      { "id": "c0", "points": [[371.7691453623979, 0], [300, 124.3078061834695], [60.00000000000006, 124.30780618346952], [0, 20.384757729336854], [-6.968733952797104e-16, 0]], "centroid": [146.35382907247958, 53.80007401925518], "number": 1 },
      { "id": "c1", "points": [[1080, 0], [1080, 20.38475772933687], [1020, 124.3078061834695], [780, 124.30780618346952], [708.2308546376021, 0]], "centroid": [933.6461709275205, 53.80007401925518], "number": 2 },
      { "id": "c2", "points": [[0, 20.38475772933684], [60, 124.3078061834695], [0, 228.23085463760214]], "centroid": [20, 124.3078061834695], "number": 3 },
      { "id": "c3", "points": [[420, 332.1539030917347], [300, 540], [60.00000000000006, 540], [0, 436.07695154586736], [-7.105427357601002e-15, 228.23085463760205], [59.999999999999886, 124.3078061834695], [300, 124.30780618346947]], "centroid": [162.85714285714286, 332.1539030917347], "number": 4 },
      { "id": "c4", "points": [[708.2308546376021, 0], [780, 124.3078061834695], [660, 332.1539030917347], [420.00000000000006, 332.1539030917348], [300, 124.30780618346952], [371.7691453623979, 0]], "centroid": [540, 152.15390309173475], "number": 5 },
      { "id": "c5", "points": [[1080, 228.23085463760208], [1080, 436.07695154586736], [1020, 540], [780, 540], [660, 332.1539030917348], [779.9999999999999, 124.3078061834695], [1020, 124.30780618346947]], "centroid": [917.1428571428571, 332.1539030917347], "number": 6 },
      { "id": "c6", "points": [[1080, 228.23085463760214], [1020, 124.30780618346952], [1080, 20.384757729336897]], "centroid": [1060, 124.30780618346951], "number": 7 },
      { "id": "c7", "points": [[0, 436.07695154586736], [60, 540], [0, 643.9230484541326]], "centroid": [20, 540], "number": 8 },
      { "id": "c8", "points": [[420, 747.8460969082653], [300, 955.6921938165306], [60.00000000000006, 955.6921938165306], [0, 851.7691453623979], [-7.105427357601002e-15, 643.9230484541325], [59.999999999999886, 540], [300, 540]], "centroid": [162.85714285714286, 747.8460969082653], "number": 9 },
      { "id": "c9", "points": [[780, 540], [660, 747.8460969082653], [420.00000000000006, 747.8460969082653], [300, 540], [419.9999999999999, 332.1539030917348], [660, 332.1539030917347]], "centroid": [540, 540], "number": 10 },
      { "id": "c10", "points": [[1080, 643.9230484541326], [1080, 851.7691453623979], [1020, 955.6921938165306], [780, 955.6921938165306], [660, 747.8460969082653], [779.9999999999999, 540], [1020, 540]], "centroid": [917.1428571428571, 747.8460969082653], "number": 11 },
      { "id": "c11", "points": [[1080, 643.9230484541326], [1020, 540], [1080, 436.07695154586736]], "centroid": [1060, 540], "number": 12 },
      { "id": "c12", "points": [[0, 851.7691453623979], [60, 955.6921938165306], [0, 1059.6152422706632]], "centroid": [20, 955.6921938165306], "number": 13 },
      { "id": "c13", "points": [[371.7691453623979, 1080], [-6.408553962321293e-15, 1080], [-7.105427357601002e-15, 1059.6152422706632], [59.999999999999886, 955.6921938165306], [300, 955.6921938165306]], "centroid": [146.35382907247956, 1026.1999259807449], "number": 14 },
      { "id": "c14", "points": [[780, 955.6921938165306], [708.2308546376021, 1080], [371.7691453623979, 1080], [300, 955.6921938165306], [419.9999999999999, 747.8460969082653], [660, 747.8460969082653]], "centroid": [540, 927.8460969082653], "number": 15 },
      { "id": "c15", "points": [[1080, 1059.6152422706632], [1080, 1080], [708.2308546376021, 1080], [779.9999999999999, 955.6921938165306], [1020, 955.6921938165306]], "centroid": [933.6461709275205, 1026.1999259807449], "number": 16 },
      { "id": "c16", "points": [[1080, 1059.6152422706632], [1020, 955.6921938165306], [1080, 851.7691453623979]], "centroid": [1060, 955.6921938165306], "number": 17 }
    ]
  },
};

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// state.symbolGrid is the RAW Organica.loadLoomGrid() return value
// ({canvas, grid, inner, cellShape, cells}) — kept raw (not pre-wrapped
// like getGrid() does for Components) specifically so it can be fed
// straight back into Organica.loadLoomGrid() again when reloading a
// saved Symbol, with zero reconstruction. getSymbolGrid() does the same
// {kind:'loom', cellShape, cells, width, height} wrapping getGrid()
// does for Components, on demand, for resolveGridCells()/frameSize().
function getSymbolGrid() {
  if (!state.symbolGrid) return null;
  return { kind: 'loom', cellShape: state.symbolGrid.cellShape, cells: state.symbolGrid.cells, width: state.symbolGrid.inner.width, height: state.symbolGrid.inner.height,
    canvasFrame: state.symbolGrid.canvas && state.symbolGrid.canvas.fvsFrame ? state.symbolGrid.canvas : null };
}
// Where the Symbol draws. Without a Symbol Canvas (every grid loaded or saved
// before it, and every Figure lattice) the frame is the old square
// frameSize(grid) with the grid centred — byte-identical to before. With a
// Canvas the frame IS the canvas (w × h, any proportion) and the cells sit at
// their own absolute canvas coordinates (the grid was generated inside the
// canvas margin). bx/by: where a resolveGridCells() centre (c.cx = 0) lands;
// X/Y: map a RAW cell coordinate (outline, hit shape, clip) into the frame.
function symbolFrame(grid) {
  if (grid && grid.canvasFrame) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    grid.cells.forEach(c => {
      if (grid.cellShape === 'polygon') c.points.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      else { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x + c.width); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y + c.height); }
    });
    return { w: grid.canvasFrame.width, h: grid.canvasFrame.height, bx: (x0 + x1) / 2, by: (y0 + y1) / 2, X: v => v, Y: v => v };
  }
  const S = frameSize(grid), half = S / 2, ox = grid.width / 2, oy = grid.height / 2;
  // (half + v) − origin, in exactly the order the renderers always used, so every
  // coordinate string stays byte-identical
  return { w: S, h: S, bx: half, by: half, X: v => half + v - ox, Y: v => half + v - oy };
}

// ── Grid tiling — page-less now (no standalone tier/nav/export); kept as an
// internal helper for Figure recipes ({kind:'grid'} levels) and the v1
// recipe fixtures (BUILTIN_RECIPES). Reads state.fvsGridConfig instead of DOM
// controls, since there's no longer a panel for those controls to live in. ──

function getFvsGrid() {
  const cfg = state.fvsGridConfig;
  const type = cfg.type;
  if (/^tier\d$/.test(type)) {
    const g = Organica.loadLoomGrid(tierLoomModel(+type[4], Math.max(20, cfg.cellSize)));
    return { kind: 'loom', tri: true, cellShape: 'polygon', cells: g.cells, width: g.inner.width, height: g.inner.height };
  }
  if (/^tri\d$/.test(type)) {
    const g = Organica.loadLoomGrid(triangleLoomModel(+type[3], Math.max(20, cfg.cellSize)));
    return { kind: 'loom', tri: true, cellShape: 'polygon', cells: g.cells, width: g.inner.width, height: g.inner.height };
  }
  const m = /^square(\d+)/.exec(type);
  const n = m ? +m[1] : 2;
  return { kind: 'square', cols: n, rows: n, cellSize: cfg.cellSize, gap: cfg.gap };
}

// A saved Component tiled directly: a throw-away 1×1 Symbol whose only cell
// holds the Component, built on the fly so nothing pollutes SYMBOL_LIBRARY.
function componentTileEntry(name) {
  const c = LIBRARY.read()[name];
  if (!c) return null;
  return {
    gridModel: squareLoomModel(1, 1, frameSize(c.grid)),
    cells: [{ source: 'component', componentName: name, rotation: 0, flipH: false, flipV: false, scale: 1, color: null,
      fitMode: 'fill', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false }],
    colors: c.colors, colorRule: c.colorRule, paperColor: c.paperColor, clipEnabled: false, appearance: c.appearance, rule: null,
  };
}

// Auto-saves the selected Component to the library (once, by id) and points
// the (page-less) Grid helper at it — used internally by Figure recipes and
// the v1 recipe fixtures (BUILTIN_RECIPES), never by a visible page anymore.
function tileSelectedInGrid() {
  const comp = getSelectedComponent();
  if (!comp) return;
  pushUndo();
  const name = 'Tile · ' + comp.id;
  const all = LIBRARY.read();
  // always refreshed: the id stays the same when the Element/colours change, so a cached copy would go stale
  all[name] = { ...buildLibraryEntry(), auto: true }; LIBRARY.write(all);
  state.fvsGridComponentName = name;
}

// The Symbol being edited, offered to the Grid as it is right now — no save step
// in between (a saved copy went stale the moment the Symbol was edited).
const LIVE_SYMBOL = '● Current symbol';
function fvsGridSelectedEntry() {
  if (state.fvsGridRaw) return { raw: state.fvsGridRaw };   // the figure below, promoted to a tile
  if (state.fvsGridComponentName) return componentTileEntry(state.fvsGridComponentName);
  if (!state.fvsGridSymbolName) return null;
  if (state.fvsGridSymbolName === LIVE_SYMBOL) return state.symbolGrid ? buildSymbolLibraryEntry() : null;
  return SYMBOL_LIBRARY.read()[state.fvsGridSymbolName] || null;
}

// Renders one saved Symbol entry's SVG string against its OWN saved
// state (not the live one), same swap-state-then-restore trick
// renderSymbolLibrary() already uses for its own thumbnails.
function renderedSymbolEntrySVG(entry) {
  if (entry.raw) return { size: entry.raw.size, inner: entry.raw.inner };   // a finished figure used as a tile
  const prev = { grid: state.symbolGrid, cells: state.symbolCells, colors: state.colors, rule: state.colorRule, paper: state.paperColor, clip: state.symbolClipEnabled, overlap: state.symbolOverlap };
  state.symbolGrid = Organica.loadLoomGrid(entry.gridModel);
  state.symbolCells = entry.cells;
  state.colors = entry.colors;
  state.colorRule = entry.colorRule || DEFAULT_COLOR_RULE;
  state.paperColor = entry.paperColor;
  state.symbolClipEnabled = entry.clipEnabled !== false;
  state.symbolOverlap = { amount: 0, blend: 'under', drawnBy: 'nearest', ...(entry.overlap || {}) };
  // A Symbol with a Canvas may not be square: it is tiled letterboxed in a
  // square of its long side (centred), so the Grid tier's placement is unchanged.
  const F = symbolFrame(getSymbolGrid());
  const size = Math.max(F.w, F.h);
  const svgStr = withAppearance({ ...entry.appearance, ...(variantAppearance || {}) }, buildSymbolSVG);
  state.symbolGrid = prev.grid; state.symbolCells = prev.cells; state.colors = prev.colors; state.colorRule = prev.rule; state.paperColor = prev.paper; state.symbolClipEnabled = prev.clip; state.symbolOverlap = prev.overlap;
  let inner = svgStr.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  if (F.w !== F.h) inner = `<g transform="translate(${r2((size - F.w) / 2)},${r2((size - F.h) / 2)})">${inner}</g>`;
  return { size, inner };
}

function buildFvsGridSVG() {
  const grid = getFvsGrid();
  const entry = fvsGridSelectedEntry();
  if (!grid || !entry) return '';
  const size = frameSize(grid);
  const centers = resolveGridCells(grid);
  const { size: natSize, inner } = renderedSymbolEntrySVG(entry);
  const altFlip = state.fvsGridConfig.altFlip;
  // Checkerboard by (col + row) parity — index parity gave vertical stripes on grids with an even column count.
  const colRow = altFlip ? Organica.shapes.cellColRow(grid, null, null) : null;
  // Every tile repeats the same Symbol markup, so the clip <defs> (identical in each tile's own
  // coordinates) are emitted once and the per-tile <metadata> is dropped: a 36-tile grid used to
  // carry 36 copies of both. Triangular tiles overlap as boxes, so only the grid's own paper rect
  // may paint the ground.
  const defsM = inner.match(/<defs>[\s\S]*?<\/defs>/);
  const sharedDefs = defsM ? defsM[0] : '';
  let tileInner = inner.replace(/<metadata>[\s\S]*?<\/metadata>/, '').replace(/<defs>[\s\S]*?<\/defs>/, '');
  // A tile's own paper is also dropped when it is the ground colour anyway: a Symbol with a Canvas
  // margin has a paper larger than its drawn box, and a mirrored copy's paper covered the original's
  // edge across the mirror axis.
  const tilePaper = tileInner.match(/<rect width="[\d.]+" height="[\d.]+" fill="(#[0-9a-fA-F]+)"\/>/);
  if (grid.tri || (tilePaper && hexKey(tilePaper[1]) === hexKey(state.paperColor))) tileInner = tileInner.replace(/<rect width="[\d.]+" height="[\d.]+" fill="#[0-9a-fA-F]+"\/>/, '');
  const cbox = symbolContentBox(entry, natSize);   // where the Symbol actually draws, in its own frame
  // A promoted figure is placed by its drawn box; a Symbol by its (square) frame, exactly as before.
  const raw = !!entry.raw && !!cbox;
  const lcx = raw ? (cbox.x0 + cbox.x1) / 2 : natSize / 2, lcy = raw ? (cbox.y0 + cbox.y1) / 2 : natSize / 2;
  const ext = raw ? (grid.tri ? cbox.x1 - cbox.x0 : Math.max(cbox.x1 - cbox.x0, cbox.y1 - cbox.y0)) : natSize;
  let body = '';
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  centers.forEach((c, i) => {
    const cw = c.cellW || c.cellSize, ch = c.cellH || c.cellSize;
    // Triangle lattices: the Symbol's own width matches the cell's width (the cell box is not square)
    const target = grid.tri ? cw : Math.min(cw, ch);
    const s = target / ext;
    const tx = size / 2 + c.cx - (raw ? s * lcx : target / 2), ty = size / 2 + c.cy - (raw ? s * lcy : target / 2);
    const flip = altFlip && (colRow[i].col + colRow[i].row) % 2 === 1;
    const flipPart = flip ? ` translate(${2 * lcx},0) scale(-1,1)` : '';
    // a tile in a down-pointing cell is turned half a turn so it keeps facing its lattice slot
    const down = grid.tri && polyOrient(grid.cells[i].points) === 'down';
    const turn = down ? ` rotate(180 ${lcx} ${lcy})` : '';
    body += `<g transform="translate(${tx.toFixed(3)},${ty.toFixed(3)}) scale(${s.toFixed(4)})${turn}${flipPart}">${tileInner}</g>`;
    if (cbox) {   // the content box through this tile's own transform (flip, then turn, then scale + move)
      [[cbox.x0, cbox.y0], [cbox.x1, cbox.y0], [cbox.x0, cbox.y1], [cbox.x1, cbox.y1]].forEach(([px, py]) => {
        if (flip) px = 2 * lcx - px;
        if (down) { px = 2 * lcx - px; py = 2 * lcy - py; }
        const X = tx + px * s, Y = ty + py * s;
        bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
      });
    }
  });
  const rot = parseInt(state.fvsGridConfig.rot, 10) || 0, mir = state.fvsGridConfig.mirror;
  lastFigureMeta = { size, box: cbox ? { x0: bx0, y0: by0, x1: bx1, y1: by1 } : { x0: 0, y0: 0, x1: size, y1: size } };
  if (!rot && mir === 'none') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`
      + `<rect width="${size}" height="${size}" fill="${state.paperColor}"/>${sharedDefs}${body}</svg>`;
  }
  return figureWithMirror(sharedDefs, body, cbox ? { x0: bx0, y0: by0, x1: bx1, y1: by1 } : { x0: 0, y0: 0, x1: size, y1: size }, size, rot, mir);
}

let lastFigureMeta = { size: 0, box: null };   // the frame and drawn box of the last Grid figure built
// The box a saved Symbol really draws in (its non-empty cells), in the Symbol's own frame — so a
// mirror lands on the visible edge even when a tile's outer rows are empty.
function symbolContentBox(entry, nat) {
  if (entry.raw) return entry.raw.box;
  try {
    const g = Organica.loadLoomGrid(entry.gridModel);
    const gw = { kind: 'loom', cellShape: g.cellShape, cells: g.cells, width: g.inner.width, height: g.inner.height, canvasFrame: symbolCanvasOf(g) ? g.canvas : null };
    const cs = resolveGridCells(gw);
    const F = symbolFrame(gw), bx = (nat - F.w) / 2 + F.bx, by = (nat - F.h) / 2 + F.by;   // = nat/2 for a Symbol without a Canvas
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    cs.forEach((c, i) => {
      if (!entry.cells[i] || entry.cells[i].source === 'empty') return;
      const cw = c.cellW || c.cellSize, ch = c.cellH || c.cellSize;
      x0 = Math.min(x0, bx + c.cx - cw / 2); x1 = Math.max(x1, bx + c.cx + cw / 2);
      y0 = Math.min(y0, by + c.cy - ch / 2); y1 = Math.max(y1, by + c.cy + ch / 2);
    });
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  } catch (e) { return null; }
}

// Rotate the tiled figure about its centre, then reflect it over its right and/or
// bottom edge (the copy shares that edge), then fit the result in a square frame.
// The figure's box is the drawn content of the tiles (empty cells excluded), so the
// reflection meets the visible edge for any lattice and any Seed.
function figureWithMirror(defs, body, box, size, rot, mir) {
  const { x0, x1, y0, y1 } = box;   // the figure's drawn box, in frame coordinates
  const fw = x1 - x0, fh = y1 - y0, quarter = rot % 180 === 90;
  const bw = quarter ? fh : fw, bh = quarter ? fw : fh;             // box after rotation
  const mv = mir === 'v' || mir === 'vh', mh = mir === 'h' || mir === 'vh';
  const mw = bw * (mv ? 2 : 1), mhgt = bh * (mh ? 2 : 1), S = Math.max(mw, mhgt);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;   // figure centre in frame coords
  // rotated figure with its box's top-left at the origin
  const fig = `<g transform="translate(${r2(bw / 2)},${r2(bh / 2)}) rotate(${rot}) translate(${r2(-cx)},${r2(-cy)})">${body}</g>`;
  let out = fig;
  if (mv) out += `<g transform="translate(${r2(2 * bw)},0) scale(-1,1)">${fig}</g>`;
  if (mh) {
    const row = out;
    out += `<g transform="translate(0,${r2(2 * bh)}) scale(1,-1)">${row}</g>`;
  }
  const ox = (S - mw) / 2, oy = (S - mhgt) / 2;
  lastFigureMeta = { size: S, box: { x0: ox, y0: oy, x1: ox + mw, y1: oy + mhgt } };   // what the next level sees as this figure's drawn box
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(S)} ${r2(S)}" width="${r2(S)}" height="${r2(S)}">`
    + `<rect width="${r2(S)}" height="${r2(S)}" fill="${state.paperColor}"/>${defs}<g transform="translate(${r2(ox)},${r2(oy)})">${out}</g></svg>`;
}

function exportFvsGrid(format) {
  const svgStr = buildFvsGridSVG();
  if (!svgStr) return;
  if (format === 'svg') {
    Organica.download(new Blob([svgStr], { type: 'image/svg+xml' }), Organica.stamp('fvs-grid', 'svg'));
    return;
  }
  const scale = parseInt(ctrl('sel-export-scale').value, 10);
  const grid = getFvsGrid();
  const size = (parseFloat((svgStr.match(/ width="([\d.]+)"/) || [])[1]) || frameSize(grid)) * scale;   // the drawn frame (a Mirror changes it)
  const scaledSVG = buildFvsGridSVG().replace(/width="[\d.]+" height="[\d.]+"/, `width="${size}" height="${size}"`);
  const url = URL.createObjectURL(new Blob([scaledSVG], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    off.getContext('2d').drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    off.toBlob(blob => Organica.download(blob, Organica.stamp('fvs-grid', 'png')));
  };
  img.src = url;
}

function defaultSymbolCells(grid) {
  return resolveGridCells(grid).map((c, i) => ({
    source: 'seed', seedType: 'triangle', rotation: 0, flipH: false, flipV: false, scale: 1, color: null,
    fitMode: 'contain', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false,
  }));
}

// Old saved Symbols (fvs-symbols store) predate fitMode/fixedSize/anchor/
// padding — backfilled here so they render exactly as they did before
// this feature shipped (contain/center/0 is the old, only behaviour).
function withPlacementDefaults(cell) {
  return {
    fitMode: 'contain', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false,
    rotation: 0, flipH: false, flipV: false, scale: 1,
    ...cell,
  };
}

// A plain cols×rows grid of equal square rect cells, in the same Loom-model
// shape as SYMBOL_GRID_PRESETS.bento so it goes through Organica.loadLoomGrid
// and every Symbol code path (rules, cellColRow, export) unchanged.
function squareLoomModel(cols, rows, cell = 270) {
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push({ id: 'c' + (r * cols + c), col: c, row: r, colSpan: 1, rowSpan: 1, number: r * cols + c + 1 });
  }
  const W = cell * cols, H = cell * rows;
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'bento', solver: 'kiwi', params: { cols, rows, variety: 0, seed: 1 }, gap: 0, tracks: { cols: Array(cols).fill(cell), rows: Array(rows).fill(cell) }, padding: 0 },
    cells,
  };
}

// An exact triangular lattice of `n` rows (a triangle of side n): row r holds
// 2r+1 cells alternating up/down, so the silhouette is a real triangle (Loom's
// rectangular Triangular grid clips its boundary cells instead). Polygon
// cells, same model shape as Loom's own Triangular generator.
function triangleLoomModel(n, side = 200) {
  const h = side * Math.sqrt(3) / 2, W = side * n, H = h * n;
  const cells = [];
  for (let r = 0; r < n; r++) {
    const y0 = r * h, y1 = y0 + h, left = W / 2 - (r + 1) * side / 2;
    for (let i = 0; i <= 2 * r; i++) {
      const x0 = left + i * side / 2;
      const pts = i % 2 === 0 ? [[x0, y1], [x0 + side, y1], [x0 + side / 2, y0]] : [[x0, y0], [x0 + side, y0], [x0 + side / 2, y1]];
      // placement anchor = the bbox centre, not the true centroid (h/6 apart on a triangle): a shape fitted to the cell's box must be centred on that box
      const cx = x0 + side / 2, cy = (y0 + y1) / 2;
      cells.push({ id: 'c' + cells.length, number: cells.length + 1, points: pts, centroid: [cx, cy] });
    }
  }
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'triangular', solver: 'geometric', cellShape: 'polygon', params: { rows: n }, gap: 0 },
    cells,
  };
}
// A "tier": one row of three triangles (up, down, up) forming a trapezoid, stacked
// `stack` times without lattice offset — the stepped silhouette of a tree. Same
// polygon-cell model as triangleLoomModel (bbox-centre placement anchor).
function tierLoomModel(stack, side = 200) {
  const h = side * Math.sqrt(3) / 2, W = 2 * side, H = h * stack;
  const cells = [];
  for (let k = 0; k < stack; k++) {
    const y0 = k * h, y1 = y0 + h;
    [0, 1, 2].forEach(i => {
      const x0 = i * side / 2;
      const pts = i % 2 === 0 ? [[x0, y1], [x0 + side, y1], [x0 + side / 2, y0]] : [[x0, y0], [x0 + side, y0], [x0 + side / 2, y1]];
      cells.push({ id: 'c' + cells.length, number: cells.length + 1, points: pts, centroid: [x0 + side / 2, (y0 + y1) / 2] });
    });
  }
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'triangular', solver: 'geometric', cellShape: 'polygon', params: { tier: stack }, gap: 0 },
    cells,
  };
}
// A hexagonal lattice of `rings` rings (1, 7, 19, 37… pointy-top hexagons). Each cell knows its
// ring (distance from the centre) and its sector (0–5, clockwise from the +x axis: one corner
// cell plus the edge cells that follow it), the classes 60° poses are keyed on.
function hexLoomModel(rings, side = 100) {
  const R = rings - 1, w = Math.sqrt(3) * side, pos = [];
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) pos.push([q, r]);
  pos.sort((a, b) => a[1] - b[1] || (a[0] + a[1] / 2) - (b[0] + b[1] / 2));
  const xy = pos.map(([q, r]) => [w * (q + r / 2), 1.5 * side * r]);
  const minX = Math.min(...xy.map(p => p[0])) - w / 2, maxX = Math.max(...xy.map(p => p[0])) + w / 2;
  const minY = Math.min(...xy.map(p => p[1])) - side, maxY = Math.max(...xy.map(p => p[1])) + side;
  const cells = xy.map(([x, y], i) => {
    const [q, r] = pos[i], ring = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
    const ang = ((Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360;
    const cx = x - minX, cy = y - minY;
    const points = [0, 1, 2, 3, 4, 5].map(k => { const a = (-90 + 60 * k) * Math.PI / 180; return [cx + side * Math.cos(a), cy + side * Math.sin(a)]; });
    return { id: 'c' + i, number: i + 1, points, centroid: [cx, cy], ring, sector: ring ? Math.floor(ang / 60 + 1e-6) % 6 : 0 };
  });
  const W = maxX - minX, H = maxY - minY;
  return {
    version: '1.0',
    canvas: { width: W, height: H, displayWidth: W, displayHeight: H, unit: 'px', orientation: 'landscape', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, margin: 0, safeArea: 0, bleed: 0 },
    grid: { type: 'hexagonal', solver: 'geometric', cellShape: 'polygon', params: { rings }, gap: 0 },
    cells,
  };
}
// Poses are multiples of 30° (0/90/180/270 for square lattices, 60° steps for hexagonal ones).
const snapPose = n => ((Math.round(n / 30) * 30) % 360 + 360) % 360;
// 'up' when the triangle's base is its lower edge (two vertices share the max y), 'down' otherwise; null for non-triangles.
function polyOrient(points) {
  if (!points || points.length !== 3) return null;
  const ys = points.map(p => p[1]), mx = Math.max(...ys), mn = Math.min(...ys);
  const low = ys.filter(y => Math.abs(y - mx) < 1e-6).length, high = ys.filter(y => Math.abs(y - mn) < 1e-6).length;
  return low === 2 ? 'up' : high === 2 ? 'down' : null;
}

function loadSymbolGrid(model) {
  state.symbolGrid = Organica.loadLoomGrid(model);
  state.symbolSuggestions = []; renderSuggestGallery();   // variations belong to the previous grid
  state.symbolCells = defaultSymbolCells(getSymbolGrid());
  state.symbolSelection.clear();
  state.symbolClipEnabled = false;   // a new grid starts on the default
  syncSymbolViewUI();
  ctrl('symbol-grid-error').style.display = 'none';
  syncOverlapSection();
  renderSymbol();
}

// ── Symbol Canvas + grid generators ─────────────────────────────
// The Symbol is the composition: it gets a real page (proportions, and in
// Print a physical size + DPI + bleed that the Export follows) and a grid
// generated INSIDE that page by any of Loom's own generators (imported as ES
// modules, the Rhizome way — loom/js/generators/registry.js, untouched). The
// page travels with the grid: it is stored on the Loom model's own canvas
// (canvas.fvsFrame), so saving/loading a Symbol and the Grid tier need no new
// field. Drawing units: px for Screen, px at 96 dpi of the physical size for
// Print (A4 = 794 × 1123) — the Export converts to the real size.
let symCanvasPicker = null;   // the canvas-format thumbnail picker — built once the <select> is filled (below)
const SYMCANVAS_PRESETS = {   // Loom's CANVAS_PRESETS (loom/js/canvas-manager.js) + 9:16 and A3
  'Square 1:1': { w: 1080, h: 1080, unit: 'px' },
  'Portrait 4:5': { w: 1080, h: 1350, unit: 'px' },
  'Landscape 16:9': { w: 1920, h: 1080, unit: 'px' },
  'Vertical 9:16': { w: 1080, h: 1920, unit: 'px' },
  'Widescreen 3:2': { w: 1620, h: 1080, unit: 'px' },
  'A4 portrait': { w: 210, h: 297, unit: 'mm' },
  'A4 landscape': { w: 297, h: 210, unit: 'mm' },
  'A3 portrait': { w: 297, h: 420, unit: 'mm' },
  'Letter portrait': { w: 215.9, h: 279.4, unit: 'mm' },
};
const PX_PER_MM = 96 / 25.4;
// [key, label, min, max, step, default] — or [key, label, 'text', default]. Everything
// else comes from the generator's own registry defaults; gap is 0 so cells touch
// (edge continuity needs neighbours that meet).
// Every generator is bounded so its cell count lands in the same "Symbol" band —
// above a maxed-out Component (4×4 = 16 cells) and below a Figure-scale canvas —
// roughly 25-64 cells, i.e. what a 5×5 to 8×8 square grid produces. Two generators
// (Fractal's exact 2^depth, and Figure's own hex-ring picker elsewhere) don't map
// onto a literal 5-8 slider and get their own deliberately different-looking range
// that still lands in the same cell-count band — see CLAUDE.md session note.
const SYMGRID_GENS = {
  // Columns/Rows just pick the track COUNT (equal-width to start, same slider
  // shape as every other generator) — uneven weights are set afterward by
  // dragging the borders directly on the canvas, where a live % label above
  // each column / beside each row shows the current share. A free-text
  // "1,1,1,1,1" field asked the user to hand-author that string blind; this
  // doesn't, and it's the same generate-then-drag workflow Loom itself uses.
  rectangular: { label: 'Rectangular', params: [['cols', 'Columns', 5, 8, 1, 6], ['rows', 'Rows', 5, 8, 1, 6]] },
  bento: { label: 'Bento', params: [['cols', 'Columns', 5, 8, 1, 6], ['rows', 'Rows', 5, 8, 1, 6], ['variety', 'Variety', 0, 1, 0.05, 0.5], ['seed', 'Seed', 0, 999, 1, 7]] },
  sinusoidal: { label: 'Wave', params: [['cols', 'Columns', 5, 8, 1, 6], ['rows', 'Rows', 5, 8, 1, 6], ['amount', 'Amount', 0, 1, 0.05, 0.5], ['frequency', 'Frequency', 0.5, 6, 0.5, 2]] },
  masonry: { label: 'Masonry', params: [['cols', 'Columns', 5, 8, 1, 6], ['seed', 'Seed', 0, 999, 1, 7]] },
  hexagonal: { label: 'Hexagonal', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  triangular: { label: 'Triangular', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  diamond: { label: 'Diamond', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  circular: { label: 'Circular', params: [['cols', 'Columns', 5, 8, 1, 6]] },
  radial: { label: 'Radial', params: [['rings', 'Rings', 5, 8, 1, 6], ['sectors', 'Sectors', 5, 8, 1, 6]] },
  organic: { label: 'Organic (Voronoi)', params: [['points', 'Cells', 25, 64, 1, 40], ['iterations', 'Relax', 0, 8, 1, 4], ['seed', 'Seed', 0, 999, 1, 7]] },
  fractal: { label: 'Fractal', params: [['depth', 'Depth', 5, 6, 1, 5], ['variance', 'Variance', 0, 0.5, 0.05, 0.2], ['seed', 'Seed', 0, 999, 1, 7]] },
  spiral: { label: 'Spiral (golden)', params: [['count', 'Cells', 25, 64, 1, 40]] },
};
// Rectangular has no cols/rows slider — column/row count is literally the number of
// comma-separated weights typed in. Clamp the track COUNT (not the weight values) to
// the same 5-8 band every other generator uses, padding/truncating as needed.
function clampWeightTrackCount(str, min = 5, max = 8) {
  let parts = String(str).split(',').map(s => s.trim()).filter(s => s !== '');
  if (parts.length > max) parts = parts.slice(0, max);
  while (parts.length < min) parts.push('1');
  return parts.join(',');
}
let loomRegistryP = null;
function loomRegistry() { return (loomRegistryP = loomRegistryP || import('/loom/js/generators/registry.js').then(m => m.GENERATORS)); }

function readSymbolCanvas() {
  const mode = ctrl('seg-symcanvas-mode').querySelector('.seg-btn.active').dataset.mode;
  const unit = mode === 'print' ? ctrl('sel-symcanvas-unit').value : 'px';
  const pw = Math.max(1, parseFloat(ctrl('num-symcanvas-w').value) || 1), ph = Math.max(1, parseFloat(ctrl('num-symcanvas-h').value) || 1);
  const toPx = v => mode === 'print' ? v * (unit === 'in' ? 25.4 : 1) * PX_PER_MM : v;
  return {
    preset: ctrl('sel-symcanvas-preset').value, mode, unit, pw, ph,
    dpi: parseFloat(ctrl('num-symcanvas-dpi').value) || 300, bleed: Math.max(0, parseFloat(ctrl('num-symcanvas-bleed').value) || 0),
    margin: +ctrl('rg-symcanvas-margin').value,
    W: Math.round(toPx(pw) * 100) / 100, H: Math.round(toPx(ph) * 100) / 100,
  };
}
function applySymbolCanvasToUI(cv) {
  ctrl('sel-symcanvas-preset').value = cv.preset in SYMCANVAS_PRESETS ? cv.preset : 'Custom';
  if (symCanvasPicker) symCanvasPicker.refresh();
  setSymbolCanvasMode(cv.mode || 'screen');
  if (cv.unit && cv.unit !== 'px') ctrl('sel-symcanvas-unit').value = cv.unit;
  ctrl('num-symcanvas-w').value = cv.pw; ctrl('num-symcanvas-h').value = cv.ph;
  if (cv.dpi) ctrl('num-symcanvas-dpi').value = cv.dpi;
  if (cv.bleed != null) ctrl('num-symcanvas-bleed').value = cv.bleed;
  ctrl('rg-symcanvas-margin').value = cv.margin || 0; ctrl('v-symcanvas-margin').textContent = cv.margin || 0;
  syncSymbolCanvasHint();
}
function setSymbolCanvasMode(mode) {
  ctrl('seg-symcanvas-mode').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  ctrl('symcanvas-print-block').style.display = mode === 'print' ? '' : 'none';
  ctrl('symcanvas-unit-label').textContent = mode === 'print' ? ctrl('sel-symcanvas-unit').value : 'px';
}
function syncSymbolCanvasHint() {
  const cv = readSymbolCanvas();
  ctrl('symbol-canvas-hint').textContent = cv.mode === 'print' ? `${cv.pw} × ${cv.ph} ${cv.unit} · ${cv.dpi} dpi` : `${cv.pw} × ${cv.ph} px`;
}
function renderSymgridParams() {
  const genId = ctrl('sel-symgrid-gen').value, spec = SYMGRID_GENS[genId];
  ctrl('symgrid-gen-params').innerHTML = spec.params.map(([k, label, a, b, step, def]) => a === 'text'
    ? `<div class="ctrl-row"><div class="ctrl-label">${label} <span class="hint">5–8 weights</span></div><input type="text" class="panel-input" id="symgen-${k}" value="${b}" aria-label="${label}"></div>`
    : `<div class="ctrl-row"><div class="ctrl-label">${label}</div><input type="range" id="symgen-${k}" min="${a}" max="${b}" step="${step}" value="${def}" aria-label="${label}"><span class="ctrl-val" id="v-symgen-${k}">${def}</span></div>`).join('');
  spec.params.forEach(([k, , a]) => { if (a !== 'text') ctrl('symgen-' + k).addEventListener('input', e => { ctrl('v-symgen-' + k).textContent = e.target.value; }); });
}
function readSymgridParams(id) {
  const out = {};
  SYMGRID_GENS[id].params.forEach(([k, , a]) => { const v = ctrl('symgen-' + k).value; out[k] = a === 'text' ? v : parseFloat(v); });
  return out;
}
// The Loom model for a generated grid — pure, so the regression suite can call it too.
async function symbolGridModel(genId, params, cv) {
  const G = (await loomRegistry())[genId];
  if (!G) throw new Error(`Unknown grid generator "${genId}".`);
  const m = Math.min(cv.W, cv.H) * (cv.margin / 100);
  const inner = { x: m, y: m, width: Math.max(1, cv.W - 2 * m), height: Math.max(1, cv.H - 2 * m) };
  if (genId === 'rectangular') {
    // New UI path: cols/rows are just a track COUNT → equal starting weights
    // (uneven ones come from dragging borders afterward). Old path, still
    // supported for saved recipes / the regression suite: a literal
    // colWeights/rowWeights string, clamped to the same 5–8 track band.
    const equalWeights = n => Array.from({ length: Math.max(1, Math.round(n)) }, () => '1').join(',');
    if (params.cols != null) params = { ...params, colWeights: equalWeights(params.cols) };
    if (params.rows != null) params = { ...params, rowWeights: equalWeights(params.rows) };
    if (params.colWeights != null) params = { ...params, colWeights: clampWeightTrackCount(params.colWeights) };
    if (params.rowWeights != null) params = { ...params, rowWeights: clampWeightTrackCount(params.rowWeights) };
  }
  const full = { ...G.defaults, ...params, gap: 0 };
  const { grid, cells } = G.generate(full, inner);
  if (G.cellShape === 'polygon') grid.cellShape = 'polygon';
  cells.forEach((c, i) => { c.number = i + 1; });
  const { W, H, ...frame } = cv;
  return {
    version: '1.0',
    canvas: { width: W, height: H, unit: 'px', margin: cv.margin, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, safeArea: 0, bleed: 0,
      fvsFrame: { ...frame, generator: genId, params } },
    grid, cells,
  };
}
// ── Cell-shape Components in a Symbol (Oct 6, 2026): every Component with a Grid shape set to Match cell shares ONE
// small-cell lattice per cell shape — its small cells snap to it, wherever the Symbol grid puts it — so neighbours
// line up exactly (lines run on, Shared cells can tell which small cell is whose). The lattice helpers:
const SQ3 = Math.sqrt(3);
// Every aligned Component's placement, per cell index: one small-cell size per cell shape (the median of their
// Contain fits, grown by Overlap), the turn snapped to the lattice's symmetry (60°, square packing 90°; no flips),
// and the position snapped so the Component's lattice origin lands on the shared lattice — whose origin is the
// frame centre, in the Components' own (unturned) orientation.
function alignedPlacements(grid, centers, F, lib, L) {
  const out = new Map(), groups = {};
  state.symbolCells.forEach((cell, i) => {
    if (!cell || cell.source !== 'component' || cell.fitMode !== 'match' || L.covered[i] != null || L.region[i]) return;
    const e = lib[cell.componentName], c = centers[i];
    if (!e || !e.grid || !e.grid.lattice || !c) return;
    const B = latticeBasisOf(e), d = frameDims(e.grid), nat = d.w === d.h ? frameSize(e.grid) : { w: d.w, h: d.h };
    const fit = placeInBox(c, nat, { ...withPlacementDefaults(cell), fitMode: 'contain', scale: 1, anchorX: 0, anchorY: 0, padding: 0, rotation: 0 }, cellPolygon(grid, i));
    const key = e.grid.lattice.shape + (B.square ? ':square' : '');
    (groups[key] = groups[key] || []).push({ i, e, B, c, cell, r: Math.abs(fit.scaleX) * B.R });
  });
  const grow = overlapGrowth();
  Object.values(groups).forEach(list => {
    const r = median(list.map(x => x.r)) * grow;
    list.forEach(({ i, e, B, c, cell }) => {
      const k = r / B.R, step = B.square ? 90 : 60, rot = mod360(Math.round((cell.rotation || 0) / step) * step);
      const a = rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
      const T = v => [k * (v[0] * cos - v[1] * sin), k * (v[0] * sin + v[1] * cos)];
      const cs = e.grid.cells, Cs = [cs.reduce((t, q) => t + q.centroid[0], 0) / cs.length, cs.reduce((t, q) => t + q.centroid[1], 0) / cs.length];
      const bx = F.bx + c.cx, by = F.by + c.cy, o = T([B.O[0] - Cs[0], B.O[1] - Cs[1]]), ox = bx + o[0], oy = by + o[1];
      const g1 = [B.e1[0] * k, B.e1[1] * k], g2 = [B.e2[0] * k, B.e2[1] * k], det = g1[0] * g2[1] - g1[1] * g2[0];
      const dx = ox - F.bx, dy = oy - F.by, la = Math.round((dx * g2[1] - dy * g2[0]) / det), lb = Math.round((g1[0] * dy - g1[1] * dx) / det);
      const sx = F.bx + la * g1[0] + lb * g2[0] - ox, sy = F.by + la * g1[1] + lb * g2[1] - oy;
      const fc = T([e.grid.width / 2 - Cs[0], e.grid.height / 2 - Cs[1]]);
      out.set(i, { scaleX: k, scaleY: k, offsetX: fc[0] + sx, offsetY: fc[1] + sy, rotate: rot });
    });
  });
  return out;
}
// The small-cell lattice of a saved cell-shape Component: basis e1/e2, an origin O (a cell centre, or a triangle
// corner), and how a cell is keyed (its centre, or the triangle it is).
function latticeBasisOf(entry) {
  const L = entry.grid.lattice, c0 = entry.grid.cells[0];
  const cR = Math.max(...c0.points.map(q => Math.hypot(q[0] - c0.centroid[0], q[1] - c0.centroid[1])));
  if (L.shape === 'hexagon') return { e1: [1.5 * cR, SQ3 / 2 * cR], e2: [0, SQ3 * cR], O: c0.centroid, kind: 'centre', R: cR };
  if (L.shape === 'circle') return L.outline === 'square' ? { e1: [2 * cR, 0], e2: [0, 2 * cR], O: c0.centroid, kind: 'centre', R: cR, square: true }
    : { e1: [2 * cR, 0], e2: [cR, SQ3 * cR], O: c0.centroid, kind: 'centre', R: cR };
  const S = cR * SQ3;
  return { e1: [S, 0], e2: [S / 2, S * SQ3 / 2], O: c0.points[0], kind: 'vertex', R: cR };
}
function latticeKeyer(B) {
  const det = B.e1[0] * B.e2[1] - B.e1[1] * B.e2[0];
  const toLat = ([x, y]) => { const dx = x - B.O[0], dy = y - B.O[1]; return [(dx * B.e2[1] - dy * B.e2[0]) / det, (B.e1[0] * dy - B.e1[1] * dx) / det]; };
  return B.kind === 'centre'
    ? c => { const [a, b] = toLat(c); return Math.round(a) + ',' + Math.round(b); }
    : c => { const [a, b] = toLat(c), fa = Math.floor(a + 1e-6), fb = Math.floor(b + 1e-6); return fa + ',' + fb + ',' + ((a - fa) + (b - fb) < 1 ? 0 : 1); };
}
const latCart = (B, [a, b]) => [a * B.e1[0] + b * B.e2[0], a * B.e1[1] + b * B.e2[1]];
// ── Overlap & blend — every Symbol grid. Saved with the Symbol (entry.overlap); older Symbols open as Paper under, 0.
state.symbolOverlap = { amount: 0, blend: 'under', drawnBy: 'nearest' };
// The section: Overlap in % (each content grows past its cell; Components on the shared small-cell lattice grow
// that lattice instead, so they stay aligned). Shared cells needs aligned Components (Match cell + a Grid shape).
function symbolHasAlignedComponents() {
  const lib = LIBRARY.read();
  return (state.symbolCells || []).some(c => c && c.source === 'component' && c.fitMode === 'match' && lib[c.componentName] && lib[c.componentName].grid && lib[c.componentName].grid.lattice);
}
function syncOverlapSection() {
  const o = state.symbolOverlap, rg = ctrl('rg-symbol-overlap');
  rg.value = o.amount; ctrl('v-symbol-overlap').textContent = o.amount + '%';
  const blend = ctrl('sel-symbol-blend'), sharedOk = symbolHasAlignedComponents();
  const so = blend.querySelector('option[value="shared"]');
  so.disabled = !sharedOk; so.title = sharedOk ? '' : 'Only with Components that have a Grid shape, set to Match cell';
  if (!sharedOk && o.blend === 'shared') o.blend = 'under';
  blend.value = o.blend; ctrl('sel-symbol-drawnby').value = o.drawnBy;
  ctrl('symbol-drawnby-row').style.display = o.blend === 'shared' ? '' : 'none';
}
// How overlaps draw on the loaded grid: null = Paper under (the drawing as before).
function symbolLook(grid) {
  const o = state.symbolOverlap;
  if (!grid || o.blend === 'under') return null;
  if (o.blend === 'shared') return { shared: true };
  return { interleave: o.blend === 'normal', multiply: o.blend === 'multiply' };
}
// Overlap: each cell's content grows past its cell, about its own centre (aligned Components: see alignedPlacements).
function overlapGrowth() { return 1 + Math.max(0, state.symbolOverlap.amount) / 100; }
function onSymbolOverlapInput() {
  const o = state.symbolOverlap; o.amount = +ctrl('rg-symbol-overlap').value;
  if (o.amount > 0 && state.symbolClipEnabled) { state.symbolClipEnabled = false; syncSymbolViewUI(); }   // a clip would cut the overlap away
  syncOverlapSection(); renderSymbol();
}
async function generateSymbolGridInCanvas() {
  const id = ctrl('sel-symgrid-gen').value;
  // With nothing saved the grid is built empty (the start pane says why it can't be filled).
  if (!libraryNames(LIBRARY.read()).length && !elementPool().length) { await buildEmptySymbolGrid(); return; }
  try {
    const model = await symbolGridModel(id, readSymgridParams(id), readSymbolCanvas());
    if (!model.cells.length) throw new Error('No cells — make the canvas larger or lower the counts.');
    ctrl('symgrid-gen-error').style.display = 'none';
    loadSymbolGrid(model);
    clipByDefaultForShape();
    fillSymbolCells();
  } catch (e) {
    ctrl('symgrid-gen-error').textContent = /unsatisfiable/i.test(e.message) ? 'The canvas is too small for this grid — enlarge it or reduce columns/rows.' : e.message;
    ctrl('symgrid-gen-error').style.display = '';
  }
}
// Fill the current grid's cells: Suggest or Arrange from the pool (or the saved Elements).
function fillSymbolCells() {
  renderSymbolPool();   // self-heals a stale pool (a Component renamed or deleted since) before filling
  if (poolEntries().length) { if (ctrl('sel-symbol-fill').value === 'suggest') runSuggest(false); else generateSymbolCells(); }
  else if (elementPool().length) generateSymbolCells();   // Elements only: Arrange (Suggest reads Components)
  else {
    ctrl('symgrid-gen-error').textContent = 'Nothing to fill the grid with — save an Element or a Component first.';
    ctrl('symgrid-gen-error').style.display = '';
  }
}
// A new grid of polygon cells (hexagons, triangles, Voronoi…) starts with Clip to cell ON: there, Cover and
// Stretch size the content to the cell's bounding box and would spill into the neighbours. Rect grids keep
// the default (off). Only for grids built from the panel — a saved Symbol keeps what it was saved with.
function clipByDefaultForShape() {
  state.symbolClipEnabled = !!state.symbolGrid && state.symbolGrid.cellShape === 'polygon';
  syncSymbolViewUI();
}
// ── The empty Symbol: the panel's grid with every cell empty ──
const emptySymbolCell = () => ({ source: 'empty', rotation: 0, flipH: false, flipV: false, scale: 1, color: null, fitMode: 'contain', fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false });
const symbolHasContent = () => (state.symbolCells || []).some(c => c && c.source !== 'empty');
let emptyBuildSeq = 0;
async function buildEmptySymbolGrid() {
  const seq = ++emptyBuildSeq, id = ctrl('sel-symgrid-gen').value;
  try {
    const model = await symbolGridModel(id, readSymgridParams(id), readSymbolCanvas());
    if (seq !== emptyBuildSeq || symbolHasContent()) return;   // a newer build, or the user placed something meanwhile
    if (!model.cells.length) throw new Error('No cells — make the canvas larger or lower the counts.');
    ctrl('symgrid-gen-error').style.display = 'none';
    loadSymbolGrid(model);
    clipByDefaultForShape();
    state.symbolCells = state.symbolCells.map(emptySymbolCell);
    renderSymbol();
  } catch (e) {
    ctrl('symgrid-gen-error').textContent = /unsatisfiable/i.test(e.message) ? 'The canvas is too small for this grid — enlarge it or reduce columns/rows.' : e.message;
    ctrl('symgrid-gen-error').style.display = '';
  }
}
// While every cell is empty, the panel is the grid's source: a change to the canvas or the
// generator rebuilds it (nothing to lose). Once something is placed, "Generate grid in canvas" does.
let emptyRebuildTimer = 0;
['sym-canvas-section', 'sym-grid-section'].forEach(id => ['input', 'change'].forEach(ev => ctrl(id).addEventListener(ev, e => {
  if (e.target.closest('button') || !state.symbolGrid || symbolHasContent()) return;
  clearTimeout(emptyRebuildTimer);
  emptyRebuildTimer = setTimeout(buildEmptySymbolGrid, 120);
})));
// The floatbar Generate: fills the empty grid. Disabled (aria-disabled, so it stays focusable and its
// tooltip says why) when nothing is saved, or when the grid already has content (no Symbol undo — Clear first).
function symbolGenerateBlock() {
  if (!state.symbolGrid) return '';   // the grid is being built; the click handler's own guard covers it
  if (symbolHasContent()) return 'Fill the grid — clear the Symbol first';
  if (!symbolSource().length) return 'Fill the grid — save an Element or a Component first';
  return '';
}
function syncSymbolStart() {
  const btn = ctrl('btn-symbol-generate'), why = symbolGenerateBlock();
  btn.setAttribute('aria-disabled', String(!!why));
  btn.setAttribute('aria-label', why || 'Fill the grid');
}
// The canvas of the loaded Symbol, if it has one (a grid generated in a Canvas).
function symbolCanvasOf(model) { return model && model.canvas && model.canvas.fvsFrame ? model.canvas.fvsFrame : null; }

ctrl('sel-symcanvas-preset').innerHTML = Object.keys(SYMCANVAS_PRESETS).map(n => `<option>${n}</option>`).join('') + '<option>Custom</option>';
// Thumbnail picker (Organica.selectPicker, 26px icons): each format as a
// rectangle at its own aspect; Custom is dashed.
symCanvasPicker = Organica.selectPicker(ctrl('sel-symcanvas-preset'), ctrl('symcanvas-picker'), {
  ariaLabel: 'Canvas format',
  registry: Object.assign(Object.fromEntries(Object.entries(SYMCANVAS_PRESETS).map(([n, p]) => [n, { name: n, icon: Organica.aspectIcon(p.w, p.h) }])),
    { Custom: { name: 'Custom', icon: Organica.aspectIcon(1, 1, { dashed: true }) } }),
});
ctrl('sel-symgrid-gen').innerHTML = Object.entries(SYMGRID_GENS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
ctrl('sel-symgrid-gen').value = 'rectangular';
renderSymgridParams();
ctrl('sel-symgrid-gen').addEventListener('change', () => { ctrl('symgrid-gen-error').style.display = 'none'; renderSymgridParams(); syncOverlapSection(); });
ctrl('rg-symbol-overlap').addEventListener('input', onSymbolOverlapInput);
ctrl('sel-symbol-blend').addEventListener('change', e => { state.symbolOverlap.blend = e.target.value; syncOverlapSection(); renderSymbol(); });
ctrl('sel-symbol-drawnby').addEventListener('change', e => { state.symbolOverlap.drawnBy = e.target.value; renderSymbol(); });
ctrl('btn-symgrid-generate').addEventListener('click', generateSymbolGridInCanvas);
// Clear: every cell empty again, the grid kept — the Symbol is back to its empty grid with Generate over it.
ctrl('btn-symbol-clear').addEventListener('click', () => {
  if (genArrivalStop) genArrivalStop();
  state.symbolCells = (state.symbolCells || []).map(emptySymbolCell);   // the grid stays (borders dragged by hand too); every cell is empty again
  state.symbolSuggestions = []; renderSuggestGallery();
  state.symbolSelection.clear();
  state.symbolMarqueeRect = null;
  ctrl('symgrid-gen-error').style.display = 'none';
  renderSymbol();
  ctrl('btn-symbol-generate').focus({ preventScroll: true });   // Clear is disabled now: focus goes to Generate
});
// ── The arrival, after Bencho's Generate (MIT — THIRD-PARTY-NOTICES.md) ──
// The Symbol is built whole and sharp, underneath. Over it, in the live
// preview only (never in the export — that string is built separately), goes
// a layer with one pane per cell of the grid in use: the cell's own paper,
// and on it a filtered COPY OF THE WHOLE SYMBOL cut to that cell. The whole
// Symbol, not the cell's own group: a blur that only knows one cell fades to
// nothing at the cell's edge and frames every cell in paper, where shapes
// that were drawn to meet across the edge should stay joined while they form.
// A cell arrives the way a generated image does, the large decisions first
// and the fine ones last:
//   · SHAPES. Heavily blurred and pushed hard in contrast, the cell is a few
//     clean glassy masses — where the ink is, nothing more. The contrast is
//     what makes them shapes rather than fog.
//   · FORM. The blur lets go on a slow curve and the contrast eases back to
//     the Symbol's own, so the shapes find their edges. A low drifting ripple
//     keeps the surface liquid while it happens.
// Contrast turns about the PAPER rather than mid-grey: about 0.5 the paper
// went to white and the card was a glowing sheet that snapped back at the
// end. About the paper, the ground holds and the ink deepens. With no paper
// (transparent) the same slope goes on the alpha instead.
// The filter is identity by the time a pane leaves, so leaving shows nothing.
// Cells start `step` apart, in a scattered order; `step` is the sweep
// divided by the cell count (clamped), so a 4-cell grid does not crawl and a
// 200-cell one does not take ten seconds. One rAF loop for all of them, and
// it parks itself when the last cell has landed. Lengths are Bencho's, in
// screen pixels, converted to the svg's user units at the start.
const GEN_ARRIVE = { cell: 1000, sweep: 1200, stepMin: 4, stepMax: 60, blur: 20, contrast: 2.4, ripple: 50 };
let genArrivalStop = null;
function runSymbolArrival() {
  if (genArrivalStop) genArrivalStop();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const svg = ctrl('symbol-frame').querySelector('svg');
  if (!svg) return;
  const groups = [...svg.querySelectorAll('g[data-cell-index]')].sort((a, b) => a.dataset.cellIndex - b.dataset.cellIndex);
  const n = groups.length;
  if (!n) return;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const px = 1 / (svg.getScreenCTM().a || 1);   // one screen pixel, in user units
  const paper = isPaperNone(state.paperColor) ? null : hexKey(state.paperColor);
  const P = paper ? [1, 3, 5].map(o => parseInt(paper.slice(o, o + 2), 16) / 255) : null;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent.appendChild(el); return el; };
  const uid = 'fvs-gen-' + nextDrawId();
  const layer = mk('g', { id: uid, 'pointer-events': 'none' }, svg);
  const defs = mk('defs', {}, layer);
  // The copy: the drawing as it stands, without the guides and the metadata. Its clip paths keep their ids — the
  // same definitions twice in one document, so either one resolves to the same shape.
  const src = mk('g', { id: uid + '-src' }, defs);
  [...svg.children].forEach(c => { if (c !== layer && c.tagName !== 'metadata' && !c.classList.contains('sym-track') && !c.classList.contains('symbol-marquee')) src.appendChild(c.cloneNode(true)); });
  const cells = groups.map((g, i) => {
    const hit = g.firstElementChild, bb = hit.getBBox();
    // the cell's own outline: its clip (which carries the overdraw past the edge) when "Clip to cell" is on, else its hit shape
    let clip = g.getAttribute('clip-path');
    if (!clip) { const cp = mk('clipPath', { id: `${uid}-c${i}` }, defs); cp.appendChild(hit.cloneNode(false)); clip = `url(#${uid}-c${i})`; }
    const f = mk('filter', { id: `${uid}-f${i}`, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
    const turb = mk('feTurbulence', { type: 'fractalNoise', numOctaves: '2', seed: String(7 + i), result: 'n' }, f);
    const disp = mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }, f);
    const blur = mk('feGaussianBlur', { in: 'd' }, f);
    const ct = mk('feComponentTransfer', {}, f);
    const funcs = (paper ? ['R', 'G', 'B'] : ['A']).map(c => mk('feFunc' + c, { type: 'linear' }, ct));
    const pane = mk('g', { 'clip-path': clip }, layer);
    if (paper) mk('rect', { x: bb.x - 2 * px, y: bb.y - 2 * px, width: bb.width + 4 * px, height: bb.height + 4 * px, fill: paper }, pane);
    // nothing to cover the finished cell with: it waits, hidden, for its pane — and so does its own ground, a
    // sibling group that carries the same clip (the only thing that says whose it is)
    const own = paper ? [] : [g, ...(g.getAttribute('clip-path') ? [...svg.children].filter(c => c !== g && c.tagName === 'g' && c.getAttribute('clip-path') === g.getAttribute('clip-path')) : [])];
    own.forEach(el => { el.style.opacity = '0'; });
    const pic = mk('g', { opacity: '0' }, pane);
    mk('use', { href: `#${uid}-src` }, mk('g', { filter: `url(#${uid}-f${i})` }, pic));
    return { own, bb, f, turb, disp, blur, funcs, pane, pic, rank: i, done: false };
  });
  // Scattered: each cell draws its place in the queue (Fisher–Yates on the ranks), a new draw every run. Read
  // top to bottom the sweep was a wipe; out of order it is a picture being decided in several places at once.
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), r = cells[i].rank; cells[i].rank = cells[j].rank; cells[j].rank = r; }
  const step = clamp(GEN_ARRIVE.sweep / n, GEN_ARRIVE.stepMin, GEN_ARRIVE.stepMax);
  let raf = 0, t0 = 0, left = n;
  const land = c => { if (c.done) return; c.done = true; left--; c.pane.remove(); c.f.remove(); c.own.forEach(el => { el.style.opacity = ''; }); };
  const stop = () => { cancelAnimationFrame(raf); cells.forEach(land); layer.remove(); genArrivalStop = null; };
  const tick = now => {
    if (!t0) t0 = now;
    if (!svg.isConnected) return stop();   // the preview was redrawn under the run: it is sharp already
    cells.forEach(c => {
      if (c.done) return;
      const t = (now - t0 - c.rank * step) / GEN_ARRIVE.cell;
      if (t <= 0) return;
      if (t >= 1) return land(c);
      // one long rise, no pulse: a picture that dims and brightens before it has started reads as hesitating
      const haze = smooth(0, 0.3, t), form = smooth(0.1, 0.82, t);
      // blur falls fast at first and then crawls through the small radii, which is where the detail actually lives
      const sd = mix(GEN_ARRIVE.blur, 0, 1 - Math.pow(1 - form, 2.2)) * px;
      const k = mix(GEN_ARRIVE.contrast, 1, form);
      const warp = (GEN_ARRIVE.ripple / 100) * 32 * Math.pow(1 - smooth(0.05, 0.9, t), 1.5) * px;
      // a slow drift in the noise so the water moves rather than sitting as a fixed distortion
      const fq = (0.006 + 0.0018 * Math.sin(t * 4.4)) / px;
      // the filter only works on the cell and as far past it as the blur and the ripple can reach — it shrinks as they do
      const m = 2.5 * sd + warp + px;
      c.f.setAttribute('x', (c.bb.x - m).toFixed(1)); c.f.setAttribute('y', (c.bb.y - m).toFixed(1));
      c.f.setAttribute('width', (c.bb.width + 2 * m).toFixed(1)); c.f.setAttribute('height', (c.bb.height + 2 * m).toFixed(1));
      c.turb.setAttribute('baseFrequency', `${fq.toFixed(5)} ${(fq * 1.3).toFixed(5)}`);
      c.disp.setAttribute('scale', warp.toFixed(2));
      c.blur.setAttribute('stdDeviation', Math.max(0.001, sd).toFixed(3));
      c.funcs.forEach((fn, j) => { const pivot = P ? P[j] : 0.5; fn.setAttribute('slope', k.toFixed(3)); fn.setAttribute('intercept', (pivot - pivot * k).toFixed(3)); });
      c.pic.setAttribute('opacity', (haze * mix(0.7, 1, form)).toFixed(3));
    });
    if (left > 0) raf = requestAnimationFrame(tick); else stop();
  };
  genArrivalStop = stop;
  raf = requestAnimationFrame(tick);
}
// The first grid, from the middle of the page: the same run as the panel's
// button (canvas, generator and its parameters are read from the panel), with
// the button's leave before it and the arrival after it. Delegated —
// the frame's innerHTML is rewritten on every render.
ctrl('btn-symbol-generate').addEventListener('click', () => {
  const why = symbolGenerateBlock();
  if (why) { Organica.notice(why.replace(/^[^—]+ — /, '').replace(/^./, c => c.toUpperCase()), { kind: 'info' }); return; }
  if (!state.symbolGrid) return;
  fillSymbolCells();
  if (symbolHasContent()) runSymbolArrival();
  syncSymbolStart();
  if (state.symbolSuggestions.length) ctrl('btn-sug-dock').focus({ preventScroll: true });   // Generate is disabled now
});
// Mirrors Trellis's refCellSize() (trellis/index.html) — a sensible starting
// size for newly-"Fixed" content, so switching TO fixed doesn't leave every
// cell's content looking randomly sized. getSymbolGrid(), not state.symbolGrid
// directly — resolveGridCells() expects the resolved {cells,cellShape,...}
// shape getSymbolGrid() returns, same as cellOverflowInfo() already does.
function symbolMedianCellSize() {
  const grid = getSymbolGrid();
  if (!grid) return 100;
  const cells = resolveGridCells(grid);
  return cells.length ? Math.round(median(cells.map(c => Math.min(c.cellW, c.cellH)))) || 100 : 100;
}
// Fit (floatbar, Symbol step) and Anchor (Symbol grid section) act on the SELECTION when there is one,
// on every cell when there is none — one control for both, the label says which.
// (Cell properties → Fit / Anchor write the same fields, on the selection.)
let symbolAnchorPopover = null;   // the floatbar Anchor popover (set at boot)
const fitTargetIndices = () => (state.symbolSelection.size ? [...state.symbolSelection] : state.symbolCells.map((_, i) => i)).filter(i => state.symbolCells[i]);
const fitTargetWrite = patch => (state.symbolSelection.size ? applyToSelection : applyToAllCells)(patch);
// The label names the target; a button is pressed only when EVERY target cell holds that value (mixed = none).
// What a Fit button would write into a cell — the one definition the buttons and their enabled state share.
function fitPatch(fitMode) {
  const patch = { fitMode };
  if (fitMode === 'fixed') patch.fixedSize = symbolMedianCellSize();
  if (fitMode === 'cover') patch.coverAxis = 'auto';   // a fresh Cover always starts from the safe, guaranteed-no-gaps baseline
  return patch;
}
// The natural size a cell's content is placed with (as buildSymbolItems does): 100 for a Seed,
// the Component's own frame otherwise. null = nothing to place (Empty, or a missing Component).
function cellNaturalSize(cell, lib) {
  if (!cell || cell.source === 'empty') return null;
  if (cell.source !== 'component') return 100;
  const entry = lib[cell.componentName];
  if (!entry) return null;
  const nd = frameDims(entry.grid);
  return nd.w === nd.h ? frameSize(entry.grid) : { w: nd.w, h: nd.h };
}
const samePlacement = (a, b) => ['scaleX', 'scaleY', 'offsetX', 'offsetY'].every(k => Math.abs(a[k] - b[k]) < 1e-6);
function syncFitAnchorUI() {
  const n = state.symbolSelection.size, who = n ? `${n} selected cell${n === 1 ? '' : 's'}` : 'all cells';
  // Fit and Anchor are about a CONTENT in its cell. They read (pressed state, anchor position) and
  // are enabled from the target cells that hold something, and each control is on only when using
  // it would actually change the drawing of at least one of them:
  //  · no content at all (Empty cells, no grid yet) → everything off;
  //  · Contain / Fill / Cover that would place every target exactly as it is placed now → that
  //    icon off (a round content in a square cell: the three are the same picture);
  //  · Anchor when no target has room to move in (the content is exactly its cell) → off.
  const grid = getSymbolGrid(), lib = LIBRARY.read(), res = grid ? symbolCellBoxes(grid) : [];   // a spanning Component is fitted in its block
  const L0 = grid ? symbolSpanLayout(grid, state.symbolCells) : { region: {} };
  const targets = fitTargetIndices().map(i => ({ cell: state.symbolCells[i], box: res[i], nat: cellNaturalSize(state.symbolCells[i], lib), poly: L0.region[i] ? null : cellPolygon(grid, i) })).filter(t => t.box && t.nat);
  const cells = targets.map(t => t.cell);
  const nothing = cells.length === 0;
  const why = nothing ? (state.symbolGrid ? ' — nothing to fit (empty)' : ' — no grid yet') : '';
  const placeOf = (t, patch) => placeInBox(t.box, t.nat, { ...t.cell, ...(patch || {}) }, t.poly, t.poly ? cellSeedOutline(t.cell) : null);
  const shared = fn => (cells.length && cells.every(c => fn(c) === fn(cells[0])) ? fn(cells[0]) : null);
  const fit = shared(c => c.fitMode || 'contain'), ax = shared(c => c.anchorX || 0), ay = shared(c => c.anchorY || 0);
  // the Fit buttons live in the floatbar: their tooltip (aria-label) names the target
  ['contain', 'fill', 'cover', 'fixed', 'match'].forEach(f => {
    const b = ctrl('btn-symbol-fit-all-' + f), patch = nothing ? null : fitPatch(f);
    // Fixed is never "the same": even when it starts at the size the content already has, it changes
    // what the cell does next (its own Size, whatever the cell becomes).
    // Match cell on a Component with a Grid shape is never "the same": it puts it on the shared small-cell lattice
    const aligns = f === 'match' && targets.some(t => t.cell.source === 'component' && lib[t.cell.componentName] && lib[t.cell.componentName].grid && lib[t.cell.componentName].grid.lattice);
    const same = !nothing && f !== 'fixed' && fit !== f && !aligns && targets.every(t => samePlacement(placeOf(t), placeOf(t, patch)));
    if (b.getAttribute('aria-pressed') !== String(fit === f)) b.setAttribute('aria-pressed', String(fit === f));
    const label = b.dataset.fitName + ' · ' + who + (nothing ? why : same ? ' — same result as now' : '');
    if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    if (b.disabled !== (nothing || same)) b.disabled = nothing || same;
  });
  // Anchor (floatbar button + flyout): the icon is the position itself — a dot in a cell, a dash
  // when the target cells differ.
  const still = !nothing && targets.every(t => samePlacement(placeOf(t, { anchorX: -1, anchorY: -1 }), placeOf(t, { anchorX: 1, anchorY: 1 })));
  const anchorOff = nothing || still;
  const aLabel = 'Anchor · ' + who + (nothing ? why : still ? ' — no effect: the content is exactly its cell' : '');
  if (ctrl('btn-symbol-anchor').getAttribute('aria-label') !== aLabel) ctrl('btn-symbol-anchor').setAttribute('aria-label', aLabel);
  if (ctrl('btn-symbol-anchor').disabled !== anchorOff) ctrl('btn-symbol-anchor').disabled = anchorOff;
  if (anchorOff && symbolAnchorPopover) symbolAnchorPopover.close();
  ctrl('symbol-fitall-anchor-grid').querySelectorAll('.fvs-flyout__tool').forEach(b => {
    const on = String(ax != null && ay != null && +b.dataset.ax === ax && +b.dataset.ay === ay);
    if (b.dataset.on !== on) b.dataset.on = on;
  });
  const mark = ax != null && ay != null
    ? `<circle cx="${8 + ax * 3}" cy="${8 + ay * 3}" r="1.5" fill="currentColor"/>`
    : '<path d="M6 8h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
  const ico = '<rect x="2.5" y="2.5" width="11" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/>' + mark;
  if (ctrl('ico-symbol-anchor').innerHTML !== ico) ctrl('ico-symbol-anchor').innerHTML = ico;
}
function applyFitToAllCells(fitMode) {
  if (!state.symbolGrid) return;
  const patch = fitPatch(fitMode);
  fitTargetWrite(() => ({ ...patch }));
  // the write only re-renders the canvas — the docked Cell properties panel has its
  // own #sel-cellprop-fit readout, and these buttons their pressed state: re-sync both.
  renderCellPropertiesPanel();
}
['contain', 'fill', 'cover', 'fixed', 'match'].forEach(fit =>
  ctrl('btn-symbol-fit-all-' + fit).addEventListener('click', () => applyFitToAllCells(fit)));
// Anchor: which part of a cropped / overflowing cell's content shows — meaningful for Cover
// (which part is kept), Fixed (which part overflows) and Contain (where it sits), not for Fill.
// One control: the floatbar button and its flyout (.fvs-flyout), on the selection or on every cell.
function applyAnchorToAllCells(ax, ay) {
  if (!state.symbolGrid) return;
  fitTargetWrite({ anchorX: ax, anchorY: ay });
  renderCellPropertiesPanel();
}
function buildFitAllAnchorGrid() {
  const wrap = ctrl('symbol-fitall-anchor-grid');
  wrap.innerHTML = ANCHOR_POSITIONS.map(([ax, ay]) =>
    `<button type="button" class="fvs-flyout__tool" data-on="false" data-ax="${ax}" data-ay="${ay}" aria-label="Anchor ${ax < 0 ? 'left' : ax > 0 ? 'right' : 'center'} ${ay < 0 ? 'top' : ay > 0 ? 'bottom' : 'middle'}"><span></span></button>`
  ).join('');
  wrap.querySelectorAll('.fvs-flyout__tool').forEach(btn => btn.addEventListener('click', () => {
    applyAnchorToAllCells(parseInt(btn.dataset.ax, 10), parseInt(btn.dataset.ay, 10));
    // the pad arrives, then the flyout closes — the button's face now shows the choice
    setTimeout(() => { if (symbolAnchorPopover) symbolAnchorPopover.close(); ctrl('btn-symbol-anchor').focus(); }, 220);
  }));
}
ctrl('sel-symcanvas-preset').addEventListener('change', () => {
  const p = SYMCANVAS_PRESETS[ctrl('sel-symcanvas-preset').value];
  if (!p) return;
  setSymbolCanvasMode(p.unit === 'px' ? 'screen' : 'print');
  if (p.unit !== 'px') ctrl('sel-symcanvas-unit').value = 'mm';
  ctrl('num-symcanvas-w').value = p.w; ctrl('num-symcanvas-h').value = p.h;
  syncSymbolCanvasHint();
});
ctrl('seg-symcanvas-mode').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b) return;
  const cur = readSymbolCanvas();
  if (b.dataset.mode === cur.mode) return;
  // keep the page's proportions: px ↔ mm at 96 dpi
  const k = b.dataset.mode === 'print' ? 1 / PX_PER_MM : PX_PER_MM;
  ctrl('num-symcanvas-w').value = Math.round(cur.pw * k * 10) / 10; ctrl('num-symcanvas-h').value = Math.round(cur.ph * k * 10) / 10;
  if (b.dataset.mode === 'print') ctrl('sel-symcanvas-unit').value = 'mm';
  setSymbolCanvasMode(b.dataset.mode);
  ctrl('sel-symcanvas-preset').value = 'Custom';
  if (symCanvasPicker) symCanvasPicker.refresh();
  syncSymbolCanvasHint();
});
['num-symcanvas-w', 'num-symcanvas-h'].forEach(id => ctrl(id).addEventListener('input', () => { ctrl('sel-symcanvas-preset').value = 'Custom'; if (symCanvasPicker) symCanvasPicker.refresh(); syncSymbolCanvasHint(); }));
['sel-symcanvas-unit', 'num-symcanvas-dpi', 'num-symcanvas-bleed'].forEach(id => ctrl(id).addEventListener('input', () => { setSymbolCanvasMode(readSymbolCanvas().mode); syncSymbolCanvasHint(); }));
ctrl('rg-symcanvas-margin').addEventListener('input', e => { ctrl('v-symcanvas-margin').textContent = e.target.value; });
syncSymbolCanvasHint();

function handleSymbolGridUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try { loadSymbolGrid(reader.result); }
    catch (e) { ctrl('symbol-grid-error').textContent = e.message; ctrl('symbol-grid-error').style.display = ''; }
  };
  reader.onerror = () => { ctrl('symbol-grid-error').textContent = 'Could not read that file.'; ctrl('symbol-grid-error').style.display = ''; };
  reader.readAsText(file);
}
