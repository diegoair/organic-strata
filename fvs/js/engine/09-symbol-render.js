// Flexible Visual System · engine/09-symbol-render — the engine part of 09-symbol-render.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically by scripts/fvs-engine.mjs. Map: docs/FVS.md §Architecture.
import {
  state
} from './00-core.js';
import {
  CELL_SHAPES, cellShapeOf, polygonCellTurn, resolveCellPlacement
} from './01-geometry.js';
import {
  mod360
} from './03-rules.js';
import {
  LIBRARY
} from './07-library.js';
import {
  symbolLook
} from './08-symbol-grid.js';
import { provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  cellPolygon: () => cellPolygon, placeInBox: () => placeInBox
});
export const _gcd = (a, b) => b ? _gcd(b, a % b) : a;
// The block a Component asks for, in Symbol cells, at this turn (90°/270° swap it).
export function componentSpanOf(name, rotation) {
  const entry = name && LIBRARY.read()[name];
  const g = entry && entry.grid;
  if (!g || g.kind === 'loom' || !g.cols) return [1, 1];
  const c = g.cols, r = g.rows || g.cols, k = _gcd(c, r);
  const q = (((rotation || 0) % 360) + 360) % 360;
  return (q === 90 || q === 270) ? [r / k, c / k] : [c / k, r / k];
}
// The cells of a block anchored at cell i, or null when it does not fit.
export function spanBlock(lat, i, span, taken, cells) {
  const c0 = lat.col[i], r0 = lat.row[i], out = [];
  for (let r = r0; r < r0 + span[1]; r++) for (let c = c0; c < c0 + span[0]; c++) {
    const k = lat.at(c, r);
    if (k < 0 || (taken && taken[k] != null && taken[k] !== i) || (k !== i && cells && cells[k] && cells[k].locked)) return null;
    out.push(k);
  }
  return out;
}
// A spanning Component whose block cells differ in size (a border dragged by hand): each of its modules
// goes in its own cell instead of the whole Component being spread evenly over the block. The frame is
// cut in as many bands as the block has cells along each axis; a band takes its cell's share of the
// block, and the modules in it move / stretch with it (kx, ky = the module's extra scale, read by the SVG
// and canvas drawers). Follows the cell's turn and flips (which frame axis lies along which block axis,
// and in which direction). Equal cells → the items come back untouched (same drawing as before).
export function modulesToBlockCells(items, W, H, reg, cell) {
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
export function matchCellPlacement(shape, poly, cell) {
  if (!poly || shape === 'square') return null;
  const n = poly.length, want = shape === 'triangle' ? 3 : shape === 'hexagon' ? 6 : 0;
  if (want ? n !== want : n < 12) return null;
  const mx = poly.reduce((a, p) => a + p[0], 0) / n, my = poly.reduce((a, p) => a + p[1], 0) / n;
  const rs = poly.map(p => Math.hypot(p[0] - mx, p[1] - my)), R = rs.reduce((a, r) => a + r, 0) / n;
  if (!(R > 0) || (Math.max(...rs) - Math.min(...rs)) / R > 0.06) return null;
  const st = CELL_SHAPES[shape].step, k = (R / CELL_SHAPES[shape].R) * (cell.scale == null ? 1 : cell.scale);
  return { scaleX: k, scaleY: k, offsetX: mx, offsetY: my, rotate: mod360(polygonCellTurn(shape, poly, mx, my) + Math.round((cell.rotation || 0) / st) * st) };
}
export function placeInBox(c, natural, cell, poly, outline) {
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
export const outlineCache = new Map();
export let outlineProbe = null;
export function seedOutline(geo) {
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
// A polygon cell's points relative to its centre (the point content is placed about); null on a rect grid.
export function cellPolygon(grid, i) {
  const raw = grid && grid.cellShape === 'polygon' && grid.cells[i];
  return raw && raw.points && raw.centroid ? raw.points.map(p => [p[0] - raw.centroid[0], p[1] - raw.centroid[1]]) : null;
}
// Contain in a polygon cell (hexagon, triangle, Voronoi…): the content's box — turned with the cell — must
// lie inside the SHAPE, not only inside its bounding box (a square contained in a hexagon's box sticks out
// of its slanted sides). The largest scale that fits, found by bisection at the cell's centre, then the
// Anchor slides it towards its side as far as it stays inside. It only shrinks what would stick out.
export function containInPolygon(c, natural, cell, poly, place, outline) {
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
// Blend → Shared cells: a small cell covered by more than one aligned Component is drawn once, by the one
// Drawn by picks (nearest centre · alternate · first · last); the others drop it (and their Paper there).
export function shareComponentGridCells(grid, items) {
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
// Matches the --danger token (tokens.css); a literal because it's
// baked into standalone SVG export strings + canvas strokeStyle.
export const MISSING_COMPONENT_COLOR = '#a03828';
export function missingComponentMarkupSVG(cx, cy, cellW, cellH) {
  const x = cx - cellW / 2, y = cy - cellH / 2;
  return `<g fill="none" stroke="${MISSING_COMPONENT_COLOR}" stroke-width="2">`
    + `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellW.toFixed(2)}" height="${cellH.toFixed(2)}" stroke-dasharray="6 4"/>`
    + `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + cellW).toFixed(2)}" y2="${(y + cellH).toFixed(2)}"/>`
    + `<line x1="${(x + cellW).toFixed(2)}" y1="${y.toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + cellH).toFixed(2)}"/>`
    + `</g>`;
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
export function polygonBoxOffset(grid, i) {
  const raw = grid.cellShape === 'polygon' && grid.cells[i];
  if (!raw || !raw.points) return { x: 0, y: 0 };
  const xs = raw.points.map(p => p[0]), ys = raw.points.map(p => p[1]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2 - raw.centroid[0], y: (Math.min(...ys) + Math.max(...ys)) / 2 - raw.centroid[1] };
}
export function symbolBleed(F) { return Math.max(0.5, 0.001 * Math.max(F.w, F.h)); }
// the same reach inside a nested Component, in its own units (its cells meet on seams too)
export function nestedBleed(it, d) { return d / Math.max(1e-6, Math.min(Math.abs(it.scaleX), Math.abs(it.scaleY))); }
// scale about the cell centre so the content reaches `d` past each side
export function cellBleed(c, d) { return { kx: 1 + 2 * d / Math.max(1e-6, c.cellW), ky: 1 + 2 * d / Math.max(1e-6, c.cellH) }; }
// the cell's clip outline, pushed out by `d`
export function bleedCellOutline(grid, rawCell, F, d) {
  if (grid.cellShape === 'polygon') {
    const cx = rawCell.points.reduce((t, p) => t + p[0], 0) / rawCell.points.length, cy = rawCell.points.reduce((t, p) => t + p[1], 0) / rawCell.points.length;
    return { poly: rawCell.points.map(p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1, k = 1.5 * d / l; return [F.X(p[0] + dx * k), F.Y(p[1] + dy * k)]; }) };
  }
  return { x: F.X(rawCell.x) - d, y: F.Y(rawCell.y) - d, w: rawCell.width + 2 * d, h: rawCell.height + 2 * d };
}
