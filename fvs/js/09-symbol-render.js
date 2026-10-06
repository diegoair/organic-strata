// Flexible Visual System · 09-symbol-render — Symbol render — spans, outlines, buildSymbolItems / buildSymbolSVG / drawSymbolCanvas.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  cellOwnInks, entryInkAt, state
} from './engine/00-core.js';
import {
  CELL_SHAPES, cellShapeOf, frameDims, frameSize, resolveGridCells
} from './engine/01-geometry.js';
import {
  SYMBOL_SEED_DEFAULTS
} from './engine/02-seed-ui.js';
import {
  DEFAULT_APPEARANCE, buildComponentItems
} from './engine/04-appearance.js';
import {
  latticeShapePath
} from './engine/05-render-component.js';
import {
  LIBRARY, fillPaper, isPaperNone
} from './engine/07-library.js';
import {
  alignedPlacements, getSymbolGrid, overlapGrowth, symbolFrame, symbolLook, withPlacementDefaults
} from './engine/08-symbol-grid.js';
import {
  MISSING_COMPONENT_COLOR, bleedCellOutline, cellBleed, cellPolygon, componentSpanOf,
  missingComponentMarkupSVG, modulesToBlockCells, nestedBleed, placeInBox, polygonBoxOffset, seedOutline,
  shareComponentGridCells, spanBlock, symbolBleed
} from './engine/09-symbol-render.js';
import {
  cellInk
} from './00-core.js';
import {
  SEED_TYPES
} from './01-geometry.js';
import {
  paintPaperPatternCanvas, paperPatternSVG, resolveItemGeo, withAppearance
} from './04-appearance.js';
import {
  applyElementStretchCanvas, clipToCellShapes, elementPathMarkup, nextDrawId, paintGeoCanvas,
  withEntryInks
} from './05-render-component.js';
import { provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  buildSymbolSVG: () => buildSymbolSVG, cellSeedOutline: () => cellSeedOutline,
  symbolCellBoxes: () => symbolCellBoxes, symbolSpanLayout: () => symbolSpanLayout
});
// resolveCellPlacement(cellW, cellH, natural, cell) — moved to
// shared/shapes.js, aliased at the top of this script. Shared by both
// source types and both render paths (SVG string, Canvas2D) — turns fit
// mode + anchor + padding + scale/fixedSize into a concrete {scaleX,
// scaleY, offsetX, offsetY} for one cell.

// One draw-op per cell: 'seed' carries its own geometry directly;
// 'component' carries the referenced Component's own resolved items
// (via the EXISTING, unmodified buildComponentItems) plus its natural
// frame size, so the render functions can nest a second nearly-
// identical transform layer around them — real vector, two levels deep.
// scaleX/scaleY already carry the flip sign, so render only ever consumes
// them directly — no separate flip check downstream.
// ── Modular spans (Oct 4, 2026) ─────────────────────────────────────
// A rectangular Component takes the Symbol cells its proportion asks for: its
// columns × rows reduced (1×4 → 1×4, 2×4 → 1×2, 2×3 → 2×3; a square one stays
// 1×1). Only on a regular rectangular Symbol grid (every column × row once — the
// Rectangular generator and its kin; never polygons, never merged bento cells).
// A cell opts in with `span: true` (Arrange and manual placement set it); where
// the block does not fit — the grid's edge, a cell already covered, a locked
// cell — the Component sits in its own cell, reduced, as before.
export let _symLattice = { key: null, lat: null };
export function symbolLattice(grid) {
  if (!grid || grid.cellShape === 'polygon' || !grid.cells || !grid.cells.length) return null;
  if (_symLattice.key === grid.cells) return _symLattice.lat;
  const r3 = v => Math.round(v * 1000) / 1000;
  const xs = [...new Set(grid.cells.map(c => r3(c.x)))].sort((a, b) => a - b);
  const ys = [...new Set(grid.cells.map(c => r3(c.y)))].sort((a, b) => a - b);
  const at = new Array(xs.length * ys.length).fill(-1), col = [], row = [];
  let ok = xs.length * ys.length === grid.cells.length;
  grid.cells.forEach((c, i) => {
    const ci = xs.indexOf(r3(c.x)), ri = ys.indexOf(r3(c.y)), k = ri * xs.length + ci;
    if (!ok || ci < 0 || ri < 0 || at[k] !== -1) { ok = false; return; }
    at[k] = i; col[i] = ci; row[i] = ri;
  });
  const lat = ok ? { cols: xs.length, rows: ys.length, at: (c, r) => (c < 0 || r < 0 || c >= xs.length || r >= ys.length) ? -1 : at[r * xs.length + c], col, row } : null;
  _symLattice = { key: grid.cells, lat };
  return lat;
}
// Who covers whom in the current Symbol: covered[k] = the anchor's index;
// region[i] = the anchor's block as a resolved centre + a raw rect.
export function symbolSpanLayout(grid, cells) {
  const out = { covered: {}, region: {} };
  const lat = symbolLattice(grid);
  if (!lat) return out;
  const taken = {}, centers = resolveGridCells(grid);
  cells.forEach((cell, i) => {
    if (!cell || taken[i] != null || cell.source !== 'component' || !cell.span) return;
    const sp = componentSpanOf(cell.componentName, cell.rotation);
    if (sp[0] * sp[1] <= 1) return;
    const block = spanBlock(lat, i, sp, taken, cells);
    if (!block) return;
    block.forEach(k => { taken[k] = i; if (k !== i) out.covered[k] = i; });
    const a = centers[block[0]], b = centers[block[block.length - 1]];
    const x0 = a.cx - a.cellW / 2, y0 = a.cy - a.cellH / 2, x1 = b.cx + b.cellW / 2, y1 = b.cy + b.cellH / 2;
    const ra = grid.cells[block[0]], rb = grid.cells[block[block.length - 1]];
    // the block's own column widths / row heights, in order — its cells can differ (a border dragged by hand)
    const colW = [], rowH = [];
    for (let k = 0; k < sp[0]; k++) colW.push(centers[block[k]].cellW);
    for (let k = 0; k < sp[1]; k++) rowH.push(centers[block[k * sp[0]]].cellH);
    out.region[i] = {
      colW, rowH,
      // fixedK: the block's length in cells along its long side — Fixed size is a size PER CELL, so a 1×2
      // block holds its Component at the same scale per module as a square Component in one cell.
      c: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cellW: x1 - x0, cellH: y1 - y0, cellSize: Math.min(x1 - x0, y1 - y0), fixedK: Math.max(sp[0], sp[1]) },
      raw: { x: ra.x, y: ra.y, width: rb.x + rb.width - ra.x, height: rb.y + rb.height - ra.y },
    };
  });
  return out;
}
export function cellSeedOutline(cell) {
  if (!cell || cell.source !== 'seed' || !SEED_TYPES[cell.seedType]) return null;
  return seedOutline(SEED_TYPES[cell.seedType].geometry(cell.seedParams || SYMBOL_SEED_DEFAULTS));
}
// The box each Symbol cell's content is placed in: its own cell, or — for a
// spanning Component — its whole block; null for a cell inside a block.
export function symbolCellBoxes(grid) {
  const res = resolveGridCells(grid), L = symbolSpanLayout(grid, state.symbolCells);
  return res.map((c, i) => L.covered[i] != null ? null : (L.region[i] ? L.region[i].c : c));
}
export function currentSpanLayout() { const g = getSymbolGrid(); return g ? symbolSpanLayout(g, state.symbolCells) : { covered: {}, region: {} }; }

export function buildSymbolItems() {
  const grid = getSymbolGrid();
  if (!grid) return [];
  const centers = resolveGridCells(grid);
  const F = symbolFrame(grid);
  const library = LIBRARY.read();
  const L = symbolSpanLayout(grid, state.symbolCells);
  const AL = alignedPlacements(grid, centers, F, library, L);
  const items = state.symbolCells.map((rawCell, i) => {
    if (L.covered[i] != null) return null;   // inside another cell's Component block
    const reg = L.region[i];
    const c = reg ? reg.c : centers[i];
    if (!c || !rawCell) return null;
    // A cell missing a field (an older entry, a hand-built one) draws with the
    // defaults instead of writing "rotate(undefined)" into the SVG.
    const cell = rawCell.rotation == null || rawCell.scale == null || rawCell.fitMode == null ? withPlacementDefaults(rawCell) : rawCell;
    let baseCx = F.bx + c.cx, baseCy = F.by + c.cy;
    // Fill sizes the content to the cell's bounding box, so it must sit on the box's
    // centre too — a polygon cell's centroid is off-centre when the cell is not
    // symmetric (a hexagon cut by the page margin, a triangle), which left an
    // uncovered strip. (Zero shift for symmetric cells and every Figure lattice.)
    if (cell.fitMode === 'fill') { const off = polygonBoxOffset(grid, i); baseCx += off.x; baseCy += off.y; }
    if (cell.source === 'empty') return null;   // a deliberate hole — nothing is drawn, the cell stays selectable
    if (cell.source === 'component') {
      const entry = library[cell.componentName];
      // A cell can end up pointing at a Component that no longer exists
      // (deleted from the Library after being referenced) — this used to
      // silently drop the cell (filtered out below, zero visual trace, no
      // console error), which reads as data loss rather than a fixable
      // problem. A visible placeholder — same size/position as the real
      // content would have had — makes the gap discoverable instead,
      // including in exported files, where silently missing content is
      // worse than a visible "this needs fixing" marker.
      if (!entry) return { type: 'missing', index: i, cx: baseCx, cy: baseCy, cellW: c.cellW, cellH: c.cellH };
      const nestedSize = frameSize(entry.grid);
      // A rectangular Component (columns ≠ rows) is placed by its own tight box,
      // so Fill doesn't stretch its letterbox bands into the cell.
      const nd = frameDims(entry.grid), nestedW = nd.w === nd.h ? nestedSize : nd.w, nestedH = nd.w === nd.h ? nestedSize : nd.h;
      // Colours from the ENTRY's own saved palette, not the live one —
      // same fix renderLibrary()'s own thumbnails already need, since
      // buildComponentItems()'s color field always reads the live
      // colorAt(), not any particular saved snapshot's colours.
      // A cell may recolour its Component (cell.colourway, written by Suggest's Recolour).
      const own = cell.colourway ? { ...entry, colors: cell.colourway.colors, paperColor: cell.colourway.paper } : entry;
      const savedColorAt = entryInkAt(own);
      let nestedItems = buildComponentItems({ cells: entry.component.cells }, entry.grid)
        .map((it, j) => ({ ...it, color: savedColorAt(j) }));
      if (reg) nestedItems = modulesToBlockCells(nestedItems, nestedW, nestedH, reg, cell);
      // A cell-shape Component set to Match cell sits on the Symbol's shared small-cell lattice (alignedPlacements).
      const al = AL.get(i);
      const place = al || placeInBox(c, nestedW === nestedH ? nestedSize : { w: nestedW, h: nestedH }, cell, reg ? null : cellPolygon(grid, i));
      return {
        type: 'component', index: i, region: reg || null, cx: baseCx + place.offsetX, cy: baseCy + place.offsetY, rotation: place.rotate != null ? place.rotate : cell.rotation,
        scaleX: place.scaleX * (!al && cell.flipH ? -1 : 1), scaleY: place.scaleY * (!al && cell.flipV ? -1 : 1), aligned: !!al,
        nestedItems, nestedSeed: entry.seed, nestedSize, nestedW, nestedH, nestedBlend: entry.blend === 'multiply', nestedPaper: own.paperColor, nestedColors: own.colors, nestedAppearance: { ...entry.appearance, ...(rt.variantAppearance || {}) },
      };
    }
    // a cell may carry the Element's own settings (seedParams); otherwise the plain default shape
    const geo = SEED_TYPES[cell.seedType].geometry(cell.seedParams || SYMBOL_SEED_DEFAULTS);
    const place = placeInBox(c, 100, cell, cellPolygon(grid, i), cellPolygon(grid, i) && cell.fitMode === 'contain' ? seedOutline(geo) : null);
    return {
      type: 'seed', index: i, cx: baseCx + place.offsetX, cy: baseCy + place.offsetY, rotation: place.rotate != null ? place.rotate : cell.rotation,
      scaleX: place.scaleX * (cell.flipH ? -1 : 1), scaleY: place.scaleY * (cell.flipV ? -1 : 1),
      color: cellInk(cell, i), geo, inks: cellOwnInks(cell), cellShape: cellShapeOf(cell.seedParams),   // inks: a saved Element's own palette (Colour by → Element's own colours)
      // …and its own Paper (colour + texture), drawn under it in the Element's 0..100 frame, like a Component's paper
      ownPaper: cellOwnInks(cell) && cell.ownPaper ? cell.ownPaper : null, ownAppearance: cellOwnInks(cell) ? cell.ownAppearance : null,
    };
  }).filter(Boolean);
  const grow = overlapGrowth();   // Overlap: each content grows past its cell (aligned Components grow their lattice instead)
  const grown = grow === 1 ? items : items.map(it => ((it.type === 'seed' || it.type === 'component') && !it.aligned ? { ...it, scaleX: it.scaleX * grow, scaleY: it.scaleY * grow } : it));
  return shareComponentGridCells(grid, grown);
}
// Draw ink with `draw(g)`; with `multiply`, on its own layer first, then multiplied onto the page as one ink
// (the canvas twin of an SVG mix-blend-mode group).
export function inkLayer(ctx, multiply, draw) {
  if (!multiply) { draw(ctx); return; }
  const layer = Object.assign(document.createElement('canvas'), { width: ctx.canvas.width, height: ctx.canvas.height }), g = layer.getContext('2d');
  g.setTransform(ctx.getTransform());
  draw(g);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(layer, 0, 0); ctx.restore();
}

// Only meaningful while "Clip to cell" is off (clipping already makes the
// question moot). Reuses the exact resolveCellPlacement() output already
// computed for real placement — an axis-aligned-footprint check, same
// disclosed approximation symbolCellBounds() already uses for hex/polygon
// cells elsewhere in this feature (rotation isn't accounted for precisely).
export function cellOverflowInfo(index, resolvedCells) {
  const grid = getSymbolGrid();
  const cell = state.symbolCells[index];
  if (!grid || !cell) return false;
  // Cover is BY DESIGN "over" one axis whenever the cell's aspect ratio
  // doesn't exactly match the content's own — that's what lets it fill the
  // cell with no gaps (pair with Clip to cell to crop it). Flagging that as
  // an overflow warning would fire on almost every Cover cell for no reason;
  // this check exists to catch a genuine surprise (Fixed outgrowing a
  // shrunk cell), which Cover never does — including an axis-locked one
  // (coverAxis 'x'/'y'): locking to whichever axis already had the larger
  // ratio reproduces auto's own scale exactly (same overshoot auto already
  // gets a pass on); locking to the smaller-ratio axis only ever UNDERFILLS
  // the other axis (a visible gap, same as Contain's gaps — never flagged),
  // it can never overshoot beyond what auto itself already would. Verified:
  // there is no coverAxis value that introduces an overshoot auto doesn't
  // already have, so the exemption stays unconditional for every Cover cell.
  if (cell.fitMode === 'cover') return false;
  const c = (resolvedCells || resolveGridCells(grid))[index];
  if (!c) return false;
  let natural = 100;
  if (cell.source === 'component') {
    const entry = LIBRARY.read()[cell.componentName];
    if (!entry) return false; // missing-reference placeholder — no fit math to check
    const nd = frameDims(entry.grid);
    natural = nd.w === nd.h ? frameSize(entry.grid) : { w: nd.w, h: nd.h };
  }
  if (cell.source === 'empty') return false;
  const poly = currentSpanLayout().region[index] ? null : cellPolygon(grid, index);
  const place = placeInBox(c, natural, cell, poly, poly ? cellSeedOutline(cell) : null);
  const itemW = (natural.w || natural) * place.scaleX, itemH = (natural.h || natural) * place.scaleY;
  return itemW > c.cellW + 0.01 || itemH > c.cellH + 0.01;
}

export function seedMarkupSVG(cx, cy, rotation, sx, sy, geo, color) {
  return `<g transform="translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${rotation}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-50,-50)">`
    + elementPathMarkup(geo, color) + `</g>`;
}


// data-cell-index on each cell's own wrapping <g> is a preview-only hook
// for click-to-select (see bindSymbolCanvasSelection) — harmless in the
// exported file (an unknown data attribute, no click handlers attached
// to a downloaded SVG), never stripped, since export calls this exact
// function directly with nothing else layered on top.
export function buildSymbolSVG() {
  const grid = getSymbolGrid();
  if (!grid) return '';
  return symbolSVGFromItems(buildSymbolItems());
}


export function symbolSVGFromItems(items) {
  const drawId = nextDrawId();
  const grid = getSymbolGrid();
  if (!grid) return '';
  const F = symbolFrame(grid);
  // The overdraw belongs to the clip: clipped, a cell's content reaches a hair past its edge and the clip (pushed
  // out the same hair) decides where it stops, so neighbours overlap instead of leaving a seam. Unclipped there is
  // nothing to stop it — the Symbol's reach and the nested Component's add up, and every cell is drawn about 0.2%
  // of the page too large, over its neighbours and past the grid. So unclipped content is drawn at its true size.
  const bleed = state.symbolClipEnabled ? symbolBleed(F) : 0, centers = resolveGridCells(grid);
  const look = symbolLook(grid);   // Component grid with Overlap: Normal = each Component's Paper right under its own ink; Multiply = no Paper, inks multiply
  let defs = '';
  let papers = '';   // every nested Component's own paper, painted before any ink
  let body = '';
  for (const it of items) {
    let cellMarkup, paperMarkup = '';
    if (it.type === 'missing') {
      cellMarkup = missingComponentMarkupSVG(it.cx, it.cy, it.cellW, it.cellH);
    } else if (it.type === 'seed') {
      cellMarkup = withEntryInks(it.inks, () => seedMarkupSVG(it.cx, it.cy, it.rotation, it.scaleX, it.scaleY, it.geo, it.color));
      if (it.ownPaper) {   // a saved Element's own Paper + texture, as its library thumbnail shows it
        const ground = withEntryInks(it.inks, () => withAppearance(it.ownAppearance, () => paperPatternSVG(100, 100)));
        paperMarkup = `<g transform="translate(${it.cx.toFixed(2)},${it.cy.toFixed(2)}) rotate(${it.rotation}) scale(${it.scaleX.toFixed(4)},${it.scaleY.toFixed(4)}) translate(-50,-50)">`
          + clipToCellShapes(it.cellShape && it.cellShape !== 'square' ? [CELL_SHAPES[it.cellShape].poly] : null,
            (isPaperNone(it.ownPaper) ? '' : `<rect width="100" height="100" fill="${it.ownPaper}"/>`) + ground) + `</g>`;
      }
    } else {
      const geo = SEED_TYPES[it.nestedSeed.type].geometry(it.nestedSeed);
      const nhx = it.nestedW / 2, nhy = it.nestedH / 2;
      const nBleed = nestedBleed(it, bleed);
      let inner = '';
      for (const ni of it.nestedItems) {
        const nfit = ni.cellSize / 100, nk = 1 + 2 * nBleed / Math.max(1e-6, ni.cellSize);   // the Component's own cells overlap too
        const nsx = (ni.flipH ? -1 : 1) * ni.scale * nfit * nk * (ni.kx || 1), nsy = (ni.flipV ? -1 : 1) * ni.scale * nfit * nk * (ni.ky || 1);   // kx/ky: a module stretched to its own block cell
        // a cell the Component was edited in (Component Edit mode) carries its own Element + Appearance: draw that, not the Component's one shared Element
        const niGeo = ni.content ? resolveItemGeo(ni, geo) : geo, niApp = ni.content && ni.content.appearance ? ni.content.appearance : it.nestedAppearance;
        const one = withEntryInks(it.nestedColors, () => withAppearance(niApp, () => seedMarkupSVG(nhx + ni.cx, nhy + ni.cy, ni.rotation, nsx, nsy, niGeo, ni.color)));
        inner += it.nestedBlend ? `<g style="mix-blend-mode:multiply">${one}</g>` : one;   // the Component's own Blend → Multiply
      }
      const tf = `translate(${it.cx.toFixed(2)},${it.cy.toFixed(2)}) rotate(${it.rotation}) scale(${it.scaleX.toFixed(4)},${it.scaleY.toFixed(4)}) translate(${(-nhx).toFixed(2)},${(-nhy).toFixed(2)})`;
      cellMarkup = `<g transform="${tf}">${inner}</g>`;
      // the nested Component's own Ground pattern sits on its paper, under all ink
      const ground = withEntryInks(it.nestedColors, () => withAppearance(it.nestedAppearance, () => paperPatternSVG(it.nestedW, it.nestedH)));
      paperMarkup = `<g transform="${tf}">${clipToCellShapes(!it.region && it.nestedItems.length && it.nestedItems[0].poly ? it.nestedItems.map(ni => ni.poly) : null,
        `<rect width="${it.nestedW}" height="${it.nestedH}" fill="${it.nestedPaper}"/>${ground}`)}</g>`;
    }
    // An invisible hit-shape covering the cell's FULL boundary (not just
    // whatever the content happens to draw) — without this, clicking the
    // empty margin a Contain-fit shape leaves inside a non-square cell
    // hit nothing at all, since a plain <g> has no hit-test area of its
    // own in SVG. fill="transparent" (not "none") is what gives it one.
    const rawCell = (it.region && it.region.raw) || grid.cells[it.index];   // a spanning Component: its whole block
    let hit = '', cellPts = '';
    if (rawCell) {
      if (grid.cellShape === 'polygon') {
        const pts = rawCell.points.map(p => `${F.X(p[0]).toFixed(2)},${F.Y(p[1]).toFixed(2)}`).join(' ');
        hit = `<polygon points="${pts}" fill="transparent"/>`;
        cellPts = `<polygon points="${pts}"/>`;
      } else {
        const x = F.X(rawCell.x), y = F.Y(rawCell.y);
        hit = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rawCell.width.toFixed(2)}" height="${rawCell.height.toFixed(2)}" fill="transparent"/>`;
        cellPts = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rawCell.width.toFixed(2)}" height="${rawCell.height.toFixed(2)}"/>`;
      }
    }
    // "Clip to cell" (state.symbolClipEnabled, default off): each cell's
    // content can't bleed past its own real boundary — reuses the exact
    // same rect/polygon geometry as the invisible hit-shape above, just
    // referenced as a clipPath instead. Off restores the pre-feature
    // free-overflow behaviour (a deliberate bleed effect stays possible).
    let clipAttr = '';
    if (state.symbolClipEnabled && cellPts) {
      const o = bleedCellOutline(grid, rawCell, F, bleed);
      const clipShape = o.poly ? `<polygon points="${o.poly.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')}"/>`
        : `<rect x="${o.x.toFixed(2)}" y="${o.y.toFixed(2)}" width="${o.w.toFixed(2)}" height="${o.h.toFixed(2)}"/>`;
      defs += `<clipPath id="clip-cell-${it.index}-${drawId}">${clipShape}</clipPath>`;
      clipAttr = ` clip-path="url(#clip-cell-${it.index}-${drawId})"`;
    }
    const c = (it.region && it.region.c) || centers[it.index];
    if (c && it.type !== 'missing') {
      const k = cellBleed(c, bleed), ox = F.bx + c.cx, oy = F.by + c.cy;
      const wrap = m => `<g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${k.kx.toFixed(5)},${k.ky.toFixed(5)}) translate(${(-ox).toFixed(2)},${(-oy).toFixed(2)})">${m}</g>`;
      cellMarkup = wrap(cellMarkup);
      if (paperMarkup) paperMarkup = wrap(paperMarkup);
    }
    const own = (it.type === 'component' || it.type === 'seed') && look;
    if (own && look.multiply) { paperMarkup = ''; cellMarkup = `<g style="mix-blend-mode:multiply">${cellMarkup}</g>`; }
    if (paperMarkup && own && look.interleave) body += `<g${clipAttr}>${paperMarkup}</g>`;
    else if (paperMarkup) papers += `<g${clipAttr}>${paperMarkup}</g>`;
    body += `<g data-cell-index="${it.index}"${clipAttr}>${hit}${cellMarkup}</g>`;
  }
  const meta = { tool: 'FVS-Symbol', cells: items.length, exportedAt: new Date().toISOString() };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${F.w}" height="${F.h}" viewBox="0 0 ${F.w} ${F.h}">`
    + `<metadata>${JSON.stringify(meta)}</metadata>` + (defs ? `<defs>${defs}</defs>` : '')
    + `<rect width="${F.w}" height="${F.h}" fill="${state.paperColor}"/>` + paperPatternSVG(F.w, F.h) + papers + body + `</svg>`;
}

export function drawSymbolCanvas(ctx) {
  const grid = getSymbolGrid();
  const F = grid ? symbolFrame(grid) : { w: 0, h: 0, X: v => v, Y: v => v };
  ctx.clearRect(0, 0, F.w, F.h);
  fillPaper(ctx, state.paperColor, 0, 0, F.w, F.h);
  paintPaperPatternCanvas(ctx, F.w, F.h);
  if (!grid) return;
  const items = buildSymbolItems().filter(Boolean);
  const bleed = state.symbolClipEnabled ? symbolBleed(F) : 0, centers = resolveGridCells(grid);   // see symbolSVGFromItems
  const look = symbolLook(grid);
  // "Clip to cell" mirror of buildSymbolSVG()'s <clipPath> (the same bled outline)
  // and the same bled content, so preview/PNG and SVG export can't disagree.
  const enter = it => {
    const rawCell = (it.region && it.region.raw) || grid.cells[it.index];   // a spanning Component: its whole block
    const clipping = state.symbolClipEnabled && rawCell;
    ctx.save();
    if (clipping) {
      const o = bleedCellOutline(grid, rawCell, F, bleed);
      ctx.beginPath();
      if (o.poly) { o.poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]))); ctx.closePath(); }
      else ctx.rect(o.x, o.y, o.w, o.h);
      ctx.clip();
    }
    const c = (it.region && it.region.c) || centers[it.index];
    if (c && it.type !== 'missing') {
      const k = cellBleed(c, bleed), ox = F.bx + c.cx, oy = F.by + c.cy;
      ctx.translate(ox, oy); ctx.scale(k.kx, k.ky); ctx.translate(-ox, -oy);
    }
  };
  const nestedFrame = it => {
    ctx.translate(it.cx, it.cy);
    ctx.rotate(it.rotation * Math.PI / 180);
    ctx.scale(it.scaleX, it.scaleY);
    ctx.translate(-it.nestedW / 2, -it.nestedH / 2);
  };
  // pass 1 — every nested Component's paper (and a saved Element's own Paper), under all ink
  for (const it of items) {
    if (it.type === 'seed' && it.ownPaper) {
      if (look && !look.shared) continue;   // Normal: painted under its own ink in pass 2; Multiply: no Paper
      enter(it);
      ctx.translate(it.cx, it.cy); ctx.rotate(it.rotation * Math.PI / 180); ctx.scale(it.scaleX, it.scaleY); ctx.translate(-50, -50);
      if (it.cellShape && it.cellShape !== 'square') ctx.clip(latticeShapePath([{ poly: CELL_SHAPES[it.cellShape].poly }]));   // the Element's canvas is its cell
      fillPaper(ctx, it.ownPaper, 0, 0, 100, 100);
      withEntryInks(it.inks, () => withAppearance(it.ownAppearance, () => paintPaperPatternCanvas(ctx, 100, 100)));
      ctx.restore();
      continue;
    }
    if (it.type !== 'component' || (look && !look.shared)) continue;   // Normal / Multiply overlap: the Paper is painted (or skipped) in pass 2
    enter(it);
    nestedFrame(it);
    if (!it.region && it.nestedItems.length && it.nestedItems[0].poly) ctx.clip(latticeShapePath(it.nestedItems));   // a cell-shape Component: its canvas is the grid's outline
    fillPaper(ctx, it.nestedPaper, 0, 0, it.nestedW, it.nestedH);
    withEntryInks(it.nestedColors, () => withAppearance(it.nestedAppearance, () => paintPaperPatternCanvas(ctx, it.nestedW, it.nestedH)));
    ctx.restore();
  }
  // pass 2 — ink
  for (const it of items) {
    enter(it);
    if (it.type === 'missing') {
      const x = it.cx - it.cellW / 2, y = it.cy - it.cellH / 2;
      ctx.save();
      ctx.strokeStyle = MISSING_COMPONENT_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, it.cellW, it.cellH);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + it.cellW, y + it.cellH);
      ctx.moveTo(x + it.cellW, y); ctx.lineTo(x, y + it.cellH);
      ctx.stroke();
      ctx.restore();
    } else if (it.type === 'seed') {
      if (look && look.interleave && it.ownPaper) {   // Normal: this Element's own Paper right under its ink
        ctx.save();
        ctx.translate(it.cx, it.cy); ctx.rotate(it.rotation * Math.PI / 180); ctx.scale(it.scaleX, it.scaleY); ctx.translate(-50, -50);
        if (it.cellShape && it.cellShape !== 'square') ctx.clip(latticeShapePath([{ poly: CELL_SHAPES[it.cellShape].poly }]));
        fillPaper(ctx, it.ownPaper, 0, 0, 100, 100);
        withEntryInks(it.inks, () => withAppearance(it.ownAppearance, () => paintPaperPatternCanvas(ctx, 100, 100)));
        ctx.restore();
      }
      inkLayer(ctx, look && look.multiply, g => {
        g.save();
        g.translate(it.cx, it.cy);
        g.rotate(it.rotation * Math.PI / 180);
        g.scale(it.scaleX, it.scaleY);
        g.translate(-50, -50);
        applyElementStretchCanvas(g);
        g.translate(it.geo.normTx * it.geo.normScale, it.geo.normTy * it.geo.normScale);
        g.scale(it.geo.normScale, it.geo.normScale);
        withEntryInks(it.inks, () => paintGeoCanvas(g, it.geo, new Path2D(it.geo.d), it.color));
        g.restore();
      });
    } else {
      const geo = SEED_TYPES[it.nestedSeed.type].geometry(it.nestedSeed);
      const path = new Path2D(geo.d);
      const nhx = it.nestedW / 2, nhy = it.nestedH / 2;
      ctx.save();
      nestedFrame(it);
      if (look && look.interleave) {   // this Component's Paper, right under its own ink: a later one covers it
        ctx.save();
        if (it.nestedItems.length && it.nestedItems[0].poly) ctx.clip(latticeShapePath(it.nestedItems));
        fillPaper(ctx, it.nestedPaper, 0, 0, it.nestedW, it.nestedH);
        withEntryInks(it.nestedColors, () => withAppearance(it.nestedAppearance, () => paintPaperPatternCanvas(ctx, it.nestedW, it.nestedH)));
        ctx.restore();
      }
      // Multiply: the Component's ink goes on its own layer first, then the layer multiplies onto the page — the
      // whole Component is one ink, as the SVG's mix-blend-mode group (its own pieces don't darken each other).
      const layer = look && look.multiply ? Object.assign(document.createElement('canvas'), { width: ctx.canvas.width, height: ctx.canvas.height }) : null;
      const g = layer ? layer.getContext('2d') : ctx;
      if (layer) g.setTransform(ctx.getTransform());
      const nBleed = nestedBleed(it, bleed);
      const prevOverride = rt.appearanceOverride, prevInks = rt.inkPaletteOverride;
      rt.appearanceOverride = { ...DEFAULT_APPEARANCE, ...(it.nestedAppearance || {}) };
      if (it.nestedColors && it.nestedColors.length) rt.inkPaletteOverride = it.nestedColors;
      for (const ni of it.nestedItems) {
        g.save();
        if (it.nestedBlend) g.globalCompositeOperation = 'multiply';   // the Component's own Blend → Multiply
        g.translate(nhx + ni.cx, nhy + ni.cy);
        g.rotate(ni.rotation * Math.PI / 180);
        const nfit = ni.cellSize / 100, nk = 1 + 2 * nBleed / Math.max(1e-6, ni.cellSize);
        g.scale((ni.flipH ? -1 : 1) * ni.scale * nfit * nk * (ni.kx || 1), (ni.flipV ? -1 : 1) * ni.scale * nfit * nk * (ni.ky || 1));
        g.translate(-50, -50);
        const niGeo = ni.content ? resolveItemGeo(ni, geo) : geo, niPath = ni.content ? new Path2D(niGeo.d) : path, keepApp = rt.appearanceOverride;
        if (ni.content && ni.content.appearance) rt.appearanceOverride = { ...DEFAULT_APPEARANCE, ...ni.content.appearance };
        applyElementStretchCanvas(g);
        g.translate(niGeo.normTx * niGeo.normScale, niGeo.normTy * niGeo.normScale);
        g.scale(niGeo.normScale, niGeo.normScale);
        paintGeoCanvas(g, niGeo, niPath, ni.color);
        rt.appearanceOverride = keepApp;
        g.restore();
      }
      if (layer) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(layer, 0, 0); ctx.restore(); }
      rt.appearanceOverride = prevOverride; rt.inkPaletteOverride = prevInks;
      ctx.restore();
    }
    ctx.restore();
  }
}
