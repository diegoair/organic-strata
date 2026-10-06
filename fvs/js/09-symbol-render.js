// Flexible Visual System · 09-symbol-render — Symbol render — spans, outlines, buildSymbolItems / buildSymbolSVG / drawSymbolCanvas.
// One of the classic scripts fvs/index.html loads in order (fvs/js/00 … 99); they share one global scope.
// Architecture + file map: docs/FVS.md §Architecture.
'use strict';
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
let _symLattice = { key: null, lat: null };
function symbolLattice(grid) {
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
const _gcd = (a, b) => b ? _gcd(b, a % b) : a;
// The block a Component asks for, in Symbol cells, at this turn (90°/270° swap it).
function componentSpanOf(name, rotation) {
  const entry = name && LIBRARY.read()[name];
  const g = entry && entry.grid;
  if (!g || g.kind === 'loom' || !g.cols) return [1, 1];
  const c = g.cols, r = g.rows || g.cols, k = _gcd(c, r);
  const q = (((rotation || 0) % 360) + 360) % 360;
  return (q === 90 || q === 270) ? [r / k, c / k] : [c / k, r / k];
}
// The cells of a block anchored at cell i, or null when it does not fit.
function spanBlock(lat, i, span, taken, cells) {
  const c0 = lat.col[i], r0 = lat.row[i], out = [];
  for (let r = r0; r < r0 + span[1]; r++) for (let c = c0; c < c0 + span[0]; c++) {
    const k = lat.at(c, r);
    if (k < 0 || (taken && taken[k] != null && taken[k] !== i) || (k !== i && cells && cells[k] && cells[k].locked)) return null;
    out.push(k);
  }
  return out;
}
// Who covers whom in the current Symbol: covered[k] = the anchor's index;
// region[i] = the anchor's block as a resolved centre + a raw rect.
function symbolSpanLayout(grid, cells) {
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
// A spanning Component whose block cells differ in size (a border dragged by hand): each of its modules
// goes in its own cell instead of the whole Component being spread evenly over the block. The frame is
// cut in as many bands as the block has cells along each axis; a band takes its cell's share of the
// block, and the modules in it move / stretch with it (kx, ky = the module's extra scale, read by the SVG
// and canvas drawers). Follows the cell's turn and flips (which frame axis lies along which block axis,
// and in which direction). Equal cells → the items come back untouched (same drawing as before).
function modulesToBlockCells(items, W, H, reg, cell) {
  const rot = ((cell.rotation || 0) % 360 + 360) % 360, swap = rot === 90 || rot === 270;
  // world direction of the frame's x / y axes after flip + turn: +1 / −1 along the block axis they lie on
  const dirX = (cell.flipH ? -1 : 1) * (rot === 0 || rot === 90 ? 1 : -1), dirY = (cell.flipV ? -1 : 1) * (rot === 0 || rot === 270 ? 1 : -1);
  const bandsFor = (sizes, dir) => { const t = sizes.reduce((a, b) => a + b, 0) || 1, p = sizes.map(v => v / t); return dir < 0 ? p.reverse() : p; };
  const px = bandsFor(swap ? reg.rowH : reg.colW, dirX), py = bandsFor(swap ? reg.colW : reg.rowH, dirY);
  const even = p => p.every(v => Math.abs(v - 1 / p.length) < 1e-6);
  if (even(px) && even(py)) return items;
  const remap = (u, p) => {   // u in 0..1 along the frame → its new place, and the band's stretch
    const n = p.length, b = Math.min(n - 1, Math.max(0, Math.floor(u * n))), t = u * n - b;
    let start = 0; for (let k = 0; k < b; k++) start += p[k];
    return { u: start + t * p[b], k: p[b] * n };
  };
  return items.map(it => {
    const mx = remap((it.cx + W / 2) / W, px), my = remap((it.cy + H / 2) / H, py);
    const nr = ((it.rotation || 0) % 360 + 360) % 360, nswap = nr === 90 || nr === 270;   // a turned module: its own x is the frame's y
    return { ...it, cx: mx.u * W - W / 2, cy: my.u * H - H / 2, kx: nswap ? my.k : mx.k, ky: nswap ? mx.k : my.k };
  });
}
// resolveCellPlacement in a box that may be a spanning block: Fixed size scales by the block's length
// in cells (fixedK), everything else is unchanged. Every placement on the Symbol goes through here.
// Match cell (test): an Element drawn for a cell shape, laid exactly onto a cell of that shape — centred on
// the cell's centroid, scaled corner to corner, turned to the cell's pose (a down triangle, a pointy-top
// hexagon); the cell's own turn snaps to the shape's step. `poly` is relative to the cell's centre.
// null = the cell is not that shape (the caller falls back to Contain).
function matchCellPlacement(shape, poly, cell) {
  if (!poly || shape === 'square') return null;
  const n = poly.length, want = shape === 'triangle' ? 3 : shape === 'hexagon' ? 6 : 0;
  if (want ? n !== want : n < 12) return null;
  const mx = poly.reduce((a, p) => a + p[0], 0) / n, my = poly.reduce((a, p) => a + p[1], 0) / n;
  const rs = poly.map(p => Math.hypot(p[0] - mx, p[1] - my)), R = rs.reduce((a, r) => a + r, 0) / n;
  if (!(R > 0) || (Math.max(...rs) - Math.min(...rs)) / R > 0.06) return null;
  const st = CELL_SHAPES[shape].step, k = (R / CELL_SHAPES[shape].R) * (cell.scale == null ? 1 : cell.scale);
  return { scaleX: k, scaleY: k, offsetX: mx, offsetY: my, rotate: mod360(polygonCellTurn(shape, poly, mx, my) + Math.round((cell.rotation || 0) / st) * st) };
}
function placeInBox(c, natural, cell, poly, outline) {
  if (cell.fitMode === 'match' && natural === 100 && cell.source !== 'component') {
    const m = matchCellPlacement(cellShapeOf(cell.seedParams), poly, cell);
    if (m) return m;
  }
  const k = c && c.fixedK > 1 && cell.fitMode === 'fixed' ? c.fixedK : 1;
  const place = resolveCellPlacement(c.cellW, c.cellH, natural, k === 1 ? cell : { ...cell, fixedSize: (cell.fixedSize || 100) * k });
  return poly && cell.fitMode === 'contain' ? containInPolygon(c, natural, cell, poly, place, outline) : place;
}
// The real outline of a Seed's shape, as points about its 0..100 box centre (as drawn: the geometry's own
// normalisation), sampled along the path — so Contain in a polygon fits the SHAPE (a turned triangle, a star),
// not its square box. Cached per path. null → the box is used (a stack of layers, no DOM).
const outlineCache = new Map();
let outlineProbe = null;
function seedOutline(geo) {
  if (!geo || geo.layers || !geo.d || typeof document === 'undefined') return null;
  const key = geo.d + '|' + geo.normTx + '|' + geo.normTy + '|' + geo.normScale;
  if (outlineCache.has(key)) return outlineCache.get(key);
  if (!outlineProbe) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    outlineProbe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(outlineProbe); document.body.appendChild(svg);
  }
  let pts = null;
  try {
    outlineProbe.setAttribute('d', geo.d);
    const len = outlineProbe.getTotalLength(), N = 64, ns = geo.normScale || 1, tx = (geo.normTx || 0) * ns, ty = (geo.normTy || 0) * ns;
    pts = [];
    for (let n = 0; n < N; n++) { const q = outlineProbe.getPointAtLength(len * n / N); pts.push([tx + q.x * ns - 50, ty + q.y * ns - 50]); }
  } catch (e) { pts = null; }
  if (outlineCache.size > 500) outlineCache.clear();
  outlineCache.set(key, pts);
  return pts;
}
function cellSeedOutline(cell) {
  if (!cell || cell.source !== 'seed' || !SEED_TYPES[cell.seedType]) return null;
  return seedOutline(SEED_TYPES[cell.seedType].geometry(cell.seedParams || SYMBOL_SEED_DEFAULTS));
}
// A polygon cell's points relative to its centre (the point content is placed about); null on a rect grid.
function cellPolygon(grid, i) {
  const raw = grid && grid.cellShape === 'polygon' && grid.cells[i];
  return raw && raw.points && raw.centroid ? raw.points.map(p => [p[0] - raw.centroid[0], p[1] - raw.centroid[1]]) : null;
}
// Contain in a polygon cell (hexagon, triangle, Voronoi…): the content's box — turned with the cell — must
// lie inside the SHAPE, not only inside its bounding box (a square contained in a hexagon's box sticks out
// of its slanted sides). The largest scale that fits, found by bisection at the cell's centre, then the
// Anchor slides it towards its side as far as it stays inside. It only shrinks what would stick out.
function containInPolygon(c, natural, cell, poly, place, outline) {
  const inside = (x, y) => { let r = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) r = !r; } return r; };
  const base = resolveCellPlacement(c.cellW, c.cellH, natural, { ...cell, scale: 1, anchorX: 0, anchorY: 0 });
  const W = natural.w || natural, H = natural.h || natural, rad = (cell.rotation || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  // the content's points about its centre, in its natural units: the real outline (a Seed) or its box corners
  const pts = outline && outline.length ? outline.map(([x, y]) => [x * W / 100, y * H / 100]) : [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
  const sx0 = Math.abs(base.scaleX) * (cell.flipH ? -1 : 1), sy0 = Math.abs(base.scaleY) * (cell.flipV ? -1 : 1);
  const fits = (k, ox, oy) => pts.every(([px, py]) => { const x = px * sx0 * k, y = py * sy0 * k; return inside(ox + x * cos - y * sin, oy + x * sin + y * cos); });
  // Contain only shrinks what sticks out: the requested size (the box's contain × the cell's Scale) if it
  // already fits the shape, else the largest size that does. A Scale < 1 that fits is left as it is.
  const user = cell.scale == null ? 1 : cell.scale;
  let k = user;
  if (!fits(user, 0, 0)) { let lo = 0, hi = user; for (let n = 0; n < 24; n++) { const m = (lo + hi) / 2; if (fits(m, 0, 0)) lo = m; else hi = m; } k = lo * 0.999; }
  let ox = 0, oy = 0;
  const ax = cell.anchorX || 0, ay = cell.anchorY || 0;
  if (ax || ay) {   // slide towards the anchor while it still fits
    const R = Math.max(c.cellW, c.cellH);
    let a = 0, b = 1;
    for (let n = 0; n < 24; n++) { const m = (a + b) / 2; if (fits(k, ax * R * m, ay * R * m)) a = m; else b = m; }
    ox = ax * R * a; oy = ay * R * a;
  }
  return { ...place, scaleX: base.scaleX * k, scaleY: base.scaleY * k, offsetX: ox, offsetY: oy };
}
// The box each Symbol cell's content is placed in: its own cell, or — for a
// spanning Component — its whole block; null for a cell inside a block.
function symbolCellBoxes(grid) {
  const res = resolveGridCells(grid), L = symbolSpanLayout(grid, state.symbolCells);
  return res.map((c, i) => L.covered[i] != null ? null : (L.region[i] ? L.region[i].c : c));
}
function currentSpanLayout() { const g = getSymbolGrid(); return g ? symbolSpanLayout(g, state.symbolCells) : { covered: {}, region: {} }; }

function buildSymbolItems() {
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
        nestedItems, nestedSeed: entry.seed, nestedSize, nestedW, nestedH, nestedBlend: entry.blend === 'multiply', nestedPaper: own.paperColor, nestedColors: own.colors, nestedAppearance: { ...entry.appearance, ...(variantAppearance || {}) },
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
function inkLayer(ctx, multiply, draw) {
  if (!multiply) { draw(ctx); return; }
  const layer = Object.assign(document.createElement('canvas'), { width: ctx.canvas.width, height: ctx.canvas.height }), g = layer.getContext('2d');
  g.setTransform(ctx.getTransform());
  draw(g);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(layer, 0, 0); ctx.restore();
}
// Blend → Shared cells: a small cell covered by more than one aligned Component is drawn once, by the one
// Drawn by picks (nearest centre · alternate · first · last); the others drop it (and their Paper there).
function shareComponentGridCells(grid, items) {
  const look = symbolLook(grid), p = { drawnBy: state.symbolOverlap.drawnBy };
  if (!look || !look.shared) return items;
  // Small cells are matched by position: buckets a quarter of a small cell wide, looked up with their neighbours,
  // so two centres a hair apart (float noise) are one cell and a bucket edge never splits it.
  const claims = [], buckets = new Map();
  let q = Infinity;
  items.forEach(it => { if (it.aligned && it.nestedItems && it.nestedItems.length) q = Math.min(q, Math.abs(it.scaleX) * it.nestedItems[0].cellSize / 400); });
  if (!isFinite(q)) return items;
  const claimAt = (x, y) => {
    const bx = Math.round(x / q), by = Math.round(y / q);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const list = buckets.get((bx + dx) + ',' + (by + dy));
      if (list) for (const c of list) if (Math.hypot(c.x - x, c.y - y) < q) return c;
    }
    const c = { x, y, list: [] }; claims.push(c);
    const key = bx + ',' + by; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(c);
    return c;
  };
  items.forEach((it, ii) => {
    if (it.type !== 'component' || !it.aligned || !it.nestedItems) return;   // only Components on the shared lattice share cells
    const a = it.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), k = Math.abs(it.scaleX);
    it.nestedItems.forEach((ni, j) => {
      const x = it.cx + k * (ni.cx * cos - ni.cy * sin), y = it.cy + k * (ni.cx * sin + ni.cy * cos);
      claimAt(x, y).list.push({ ii, j, d: Math.hypot(x - it.cx, y - it.cy) });
    });
  });
  const keep = items.map(it => (it.nestedItems ? new Set(it.nestedItems.map((_, j) => j)) : null));
  claims.forEach(c => {
    if (c.list.length < 2) return;
    const L = c.list.slice().sort((u, v) => u.ii - v.ii);
    const w = p.drawnBy === 'first' ? L[0] : p.drawnBy === 'last' ? L[L.length - 1]
      : p.drawnBy === 'alternate' ? L[Math.abs(Math.round(c.x / (4 * q)) + Math.round(c.y / (4 * q))) % L.length]
      : L.reduce((b, u) => (u.d < b.d - 1e-6 ? u : b));
    L.forEach(u => { if (u !== w) keep[u.ii].delete(u.j); });
  });
  return items.map((it, ii) => (keep[ii] && keep[ii].size !== it.nestedItems.length ? { ...it, nestedItems: it.nestedItems.filter((_, j) => keep[ii].has(j)) } : it));
}

// Only meaningful while "Clip to cell" is off (clipping already makes the
// question moot). Reuses the exact resolveCellPlacement() output already
// computed for real placement — an axis-aligned-footprint check, same
// disclosed approximation symbolCellBounds() already uses for hex/polygon
// cells elsewhere in this feature (rotation isn't accounted for precisely).
function cellOverflowInfo(index, resolvedCells) {
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

function seedMarkupSVG(cx, cy, rotation, sx, sy, geo, color) {
  return `<g transform="translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${rotation}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-50,-50)">`
    + elementPathMarkup(geo, color) + `</g>`;
}

// Matches the --danger token (tokens.css); a literal because it's
// baked into standalone SVG export strings + canvas strokeStyle.
const MISSING_COMPONENT_COLOR = '#a03828';
function missingComponentMarkupSVG(cx, cy, cellW, cellH) {
  const x = cx - cellW / 2, y = cy - cellH / 2;
  return `<g fill="none" stroke="${MISSING_COMPONENT_COLOR}" stroke-width="2">`
    + `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellW.toFixed(2)}" height="${cellH.toFixed(2)}" stroke-dasharray="6 4"/>`
    + `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + cellW).toFixed(2)}" y2="${(y + cellH).toFixed(2)}"/>`
    + `<line x1="${(x + cellW).toFixed(2)}" y1="${y.toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + cellH).toFixed(2)}"/>`
    + `</g>`;
}

// data-cell-index on each cell's own wrapping <g> is a preview-only hook
// for click-to-select (see bindSymbolCanvasSelection) — harmless in the
// exported file (an unknown data attribute, no click handlers attached
// to a downloaded SVG), never stripped, since export calls this exact
// function directly with nothing else layered on top.
function buildSymbolSVG() {
  const grid = getSymbolGrid();
  if (!grid) return '';
  return symbolSVGFromItems(buildSymbolItems());
}

// Same markup builder as buildSymbolSVG(), split out so Motion can hand it
// an already colour/scale-adjusted items array (same shape buildSymbolItems()
// returns, same .index into grid.cells) instead of always recomputing fresh
// from state.symbolCells — the one render path both the static and the
// live-motion view share.
// ── Seams between cells ──
// Two shapes that meet exactly on a cell border are each anti-aliased there, so
// at any zoom where the border falls inside a pixel their half-covered pixels
// add up to a light hairline. And every nested Component used to paint its own
// paper right before its ink — the next cell's paper, a hair wider than the cell
// after rounding, covered the previous cell's ink along the border: a 1px line
// on every row. Two fixes, shared by the SVG and the Canvas renderer: all nested
// papers are painted first, under all ink; and each cell's content (and its
// clip) reaches SYMBOL_BLEED beyond the border — ~0.1% of the page — so
// neighbours overlap instead of touching. Too small to see as a change of shape.
// bounding-box centre − centroid of polygon cell i (0 for rect cells)
function polygonBoxOffset(grid, i) {
  const raw = grid.cellShape === 'polygon' && grid.cells[i];
  if (!raw || !raw.points) return { x: 0, y: 0 };
  const xs = raw.points.map(p => p[0]), ys = raw.points.map(p => p[1]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2 - raw.centroid[0], y: (Math.min(...ys) + Math.max(...ys)) / 2 - raw.centroid[1] };
}
function symbolBleed(F) { return Math.max(0.5, 0.001 * Math.max(F.w, F.h)); }
// the same reach inside a nested Component, in its own units (its cells meet on seams too)
function nestedBleed(it, d) { return d / Math.max(1e-6, Math.min(Math.abs(it.scaleX), Math.abs(it.scaleY))); }
// scale about the cell centre so the content reaches `d` past each side
function cellBleed(c, d) { return { kx: 1 + 2 * d / Math.max(1e-6, c.cellW), ky: 1 + 2 * d / Math.max(1e-6, c.cellH) }; }
// the cell's clip outline, pushed out by `d`
function bleedCellOutline(grid, rawCell, F, d) {
  if (grid.cellShape === 'polygon') {
    const cx = rawCell.points.reduce((t, p) => t + p[0], 0) / rawCell.points.length, cy = rawCell.points.reduce((t, p) => t + p[1], 0) / rawCell.points.length;
    return { poly: rawCell.points.map(p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1, k = 1.5 * d / l; return [F.X(p[0] + dx * k), F.Y(p[1] + dy * k)]; }) };
  }
  return { x: F.X(rawCell.x) - d, y: F.Y(rawCell.y) - d, w: rawCell.width + 2 * d, h: rawCell.height + 2 * d };
}

function symbolSVGFromItems(items) {
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

function drawSymbolCanvas(ctx) {
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
      const prevOverride = appearanceOverride, prevInks = inkPaletteOverride;
      appearanceOverride = { ...DEFAULT_APPEARANCE, ...(it.nestedAppearance || {}) };
      if (it.nestedColors && it.nestedColors.length) inkPaletteOverride = it.nestedColors;
      for (const ni of it.nestedItems) {
        g.save();
        if (it.nestedBlend) g.globalCompositeOperation = 'multiply';   // the Component's own Blend → Multiply
        g.translate(nhx + ni.cx, nhy + ni.cy);
        g.rotate(ni.rotation * Math.PI / 180);
        const nfit = ni.cellSize / 100, nk = 1 + 2 * nBleed / Math.max(1e-6, ni.cellSize);
        g.scale((ni.flipH ? -1 : 1) * ni.scale * nfit * nk * (ni.kx || 1), (ni.flipV ? -1 : 1) * ni.scale * nfit * nk * (ni.ky || 1));
        g.translate(-50, -50);
        const niGeo = ni.content ? resolveItemGeo(ni, geo) : geo, niPath = ni.content ? new Path2D(niGeo.d) : path, keepApp = appearanceOverride;
        if (ni.content && ni.content.appearance) appearanceOverride = { ...DEFAULT_APPEARANCE, ...ni.content.appearance };
        applyElementStretchCanvas(g);
        g.translate(niGeo.normTx * niGeo.normScale, niGeo.normTy * niGeo.normScale);
        g.scale(niGeo.normScale, niGeo.normScale);
        paintGeoCanvas(g, niGeo, niPath, ni.color);
        appearanceOverride = keepApp;
        g.restore();
      }
      if (layer) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(layer, 0, 0); ctx.restore(); }
      appearanceOverride = prevOverride; inkPaletteOverride = prevInks;
      ctx.restore();
    }
    ctx.restore();
  }
}
