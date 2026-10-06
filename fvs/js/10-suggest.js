// Flexible Visual System · 10-suggest — Arrange + Suggest — pool, scoring, variations dock.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import {
  DEFAULT_COLOR_RULE, ctrl, entryInkAt, setStatus, state
} from './00-core.js';
import {
  frameDims, frameSize, resolveCellPlacement, resolveGridCells
} from './01-geometry.js';
import {
  canonicalState, mulberry32
} from './03-rules.js';
import {
  ELEMENT_LIB, buildComponentItems, withAppearance
} from './04-appearance.js';
import {
  drawComponentCanvas, withEntryInks
} from './05-render-component.js';
import {
  buildColourways
} from './06-component-ui.js';
import {
  LIBRARY, buildComponentSVGWithPaper, hexKey, isPaperNone
} from './07-library.js';
import {
  getSymbolGrid, polyOrient
} from './08-symbol-grid.js';
import {
  buildSymbolSVG, componentSpanOf, polygonBoxOffset, spanBlock, symbolLattice
} from './09-symbol-render.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  addSavedToPool: () => addSavedToPool, elementPool: () => elementPool,
  generateSymbolCells: () => generateSymbolCells, poolEntries: () => poolEntries,
  renderSuggestGallery: () => renderSuggestGallery, renderSymbolPool: () => renderSymbolPool,
  runSuggest: () => runSuggest, symbolSource: () => symbolSource
});
// ── Component pool + Arrange ─────────────────────────────────
// A Symbol is composed from saved Components only. The pool is the set
// it draws from (each with a weight); Arrange decides WHICH Component goes in
// each cell from the cell's place in the grid: class = f(col, row, ring,
// sector, band…), the n-th class takes the n-th pool entry. Random picks
// by weight. Transforms are reset (a down-pointing triangle cell is turned
// 180° to face its slot); refine them with the Rule mode. Locked cells stay.
export const SYMBOL_ARRANGE = {
  random: { label: 'Random (by weight)' },
  checker: { label: 'Checkerboard', cls: c => c.col + c.row },
  rows: { label: 'Rows', cls: c => c.row },
  columns: { label: 'Columns', cls: c => c.col },
  diagonal: { label: 'Diagonal bands', cls: c => c.col + c.row, full: true },
  blocks: { label: '2×2 blocks', cls: c => (c.col >> 1) + (c.row >> 1) },
  rings: { label: 'Rings (from the centre)', cls: (c, k) => Math.floor(Math.min(0.9999, Math.hypot(c.nx, c.ny) / Math.SQRT2) * k) },
  sectors: { label: 'Sectors (around the centre)', cls: (c, k) => Math.floor(((c.angle + Math.PI) / (2 * Math.PI)) * k) % k },
  wave: { label: 'Wave bands', cls: (c, k) => Math.floor(Math.min(0.9999, (Math.sin((c.nx * 1.5 + c.ny) * Math.PI) + 1) / 2) * k) },
  orientation: { label: 'Up / down (triangles)', cls: c => (c.orient === 'down' ? 1 : 0) },
};
// Checkerboard alternates the first two pool entries; every other patterned
// rule cycles through all of them.
export function poolEntries() {
  const lib = LIBRARY.read();
  return state.symbolPool.filter(p => lib[p.name]);
}
// With no saved Component, a Symbol is built from the saved Elements instead: the
// latest 8, weight ×1, each placed as it would be from the library rail (its own
// palette, used under Colour by → Element's own colours). Components win when any exist.
export function elementPool() {
  const all = ELEMENT_LIB.read();
  return Object.keys(all || {}).filter(n => all[n] && all[n].seed && !all[n].hidden)
    .sort((a, b) => String(all[b].savedAt || '').localeCompare(String(all[a].savedAt || '')))
    .slice(0, 8).map(name => ({ name, weight: 1, kind: 'element' }));
}
export const symbolSource = () => { const c = poolEntries(); return c.length ? c : elementPool(); };
export function weightedPick(pal, rng) {
  const total = pal.reduce((t, p) => t + (p.weight || 1), 0);
  let r = rng() * total;
  for (const p of pal) { r -= (p.weight || 1); if (r < 0) return p; }
  return pal[pal.length - 1];
}
export function symbolCellContext(grid) {
  const ctxs = hooks.cellColRow(grid);
  const raw = (state.symbolGrid && state.symbolGrid.cells) || [];
  return ctxs.map((c, i) => ({ ...c, orient: raw[i] && raw[i].points ? polyOrient(raw[i].points) : null }));
}
// Pure: the cells an arrangement produces for (grid, palette, rule, seed, fit),
// leaving locked cells as they are.
export function arrangeCells(grid, cells, pal, ruleId, seed, fit) {
  const rule = SYMBOL_ARRANGE[ruleId] || SYMBOL_ARRANGE.random;
  const rng = mulberry32(seed);
  const ctxs = symbolCellContext(grid);
  const k = ruleId === 'checker' ? Math.min(2, pal.length) : pal.length;
  const lat = symbolLattice(grid), taken = {};   // modular spans: a rectangular Component takes its block (symbolSpanLayout)
  return resolveGridCells(grid).map((c, i) => {
    const prev = cells[i];
    if (prev && prev.locked) return prev;
    if (taken[i] != null) return { source: 'empty', rotation: 0, flipH: false, flipV: false, scale: 1, color: null, fitMode: fit, fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false };   // inside a block
    const ctx = ctxs[i];
    const pick = rule.cls ? pal[((rule.cls(ctx, k) % k) + k) % k] : weightedPick(pal, rng);
    if (pick.kind === 'element') {
      const el = hooks.railPatch('element', pick.name);
      if (el) return { ...el, rotation: (el.rotation || 0) + (ctx.orient === 'down' ? 180 : 0), fitMode: fit, fixedSize: 100, scale: 1, padding: 0, anchorX: 0, anchorY: 0, locked: false };
    }
    const rotation = ctx.orient === 'down' ? 180 : 0;
    let span = false;
    if (lat) {
      const sp = componentSpanOf(pick.name, rotation);
      const block = sp[0] * sp[1] > 1 ? spanBlock(lat, i, sp, taken, cells) : null;
      if (block) { block.forEach(b => { taken[b] = i; }); span = true; }   // doesn't fit → its own cell, reduced
    }
    return {
      source: 'component', componentName: pick.name, span,
      rotation, flipH: false, flipV: false, scale: 1, color: null,
      fitMode: fit, fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false,
    };
  });
}
export function generateSymbolCells() {
  const grid = getSymbolGrid();
  if (!grid) return;
  const pal = symbolSource();
  if (!pal.length) { setStatus('error', 'Save a Component or an Element first'); return; }
  state.symbolSelection.clear();
  state.symbolCells = arrangeCells(grid, state.symbolCells, pal, ctrl('sel-sym-arrange').value,
    parseInt(ctrl('num-symbol-seed').value, 10) || 0, ctrl('sel-sym-arrange-fit').value);
  hooks.renderSymbol();
}

// A Component saved in the Component tier joins the Symbol pool straight away —
// the pool otherwise only auto-fills on the very first Symbol visit, so anything
// saved later (after changing the Element/Component) was silently left out and
// Arrange kept building from the old set. Full pool (8): the oldest entry makes room.
export function addSavedToPool(name) {
  if (!name || state.symbolPool.some(p => p.name === name)) return;
  if (state.symbolPool.length >= 8) state.symbolPool.shift();
  state.symbolPool.push({ name, weight: 1 });
}
export function componentThumbSVG(name) {
  const entry = LIBRARY.read()[name];
  if (!entry) return '';
  const savedColorAt = entryInkAt(entry);
  const items = buildComponentItems({ cells: entry.component.cells }, entry.grid).map((it, j) => ({ ...it, color: savedColorAt(j) }));
  return withEntryInks(entry.colors, () => buildComponentSVGWithPaper(items, entry.seed, frameDims(entry.grid), entry.paperColor, entry.role, entry.underlyingComponentName, entry.blend));
}
// The Symbol's pool (what Arrange / Suggest draw from) is automatic since the right-bar section was removed:
// the latest 8 saved Components (addSavedToPool), each at weight ×1. This keeps it honest — a deleted or
// renamed Component drops out — and redraws the empty state, whose Generate needs a pool.
export function renderSymbolPool() {
  state.symbolPool = poolEntries();
  if (!state.symbolGrid && state.activeTier === 'symbol') hooks.renderSymbolCanvasOnly();
}
ctrl('sel-sym-arrange').innerHTML = Object.entries(SYMBOL_ARRANGE).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

// ── Suggestion engine ────────────────────────────────────────────
// Proposes whole Symbols from the palette. Three analyses, then generators
// scored on three sliders.
//  1. Each Component is rasterised once (cached by name + savedAt) into an
//     ink mask over its own tight frame — so any point of any turned/flipped
//     placement can be asked "ink or paper?".
//  2. The grid's real adjacencies: rect cells share a vertical/horizontal
//     segment (bento spans included), polygon cells share an edge. Each shared
//     edge gets N sample points, nudged a little into each of its two cells.
//  3. A candidate = per cell {name, rotation, flipH}. Continuity = how often the
//     two sides of every shared edge agree (ink meets ink, paper meets paper;
//     ink-to-ink counts most), Balance = even ink over the page + each Component
//     used as often as its weight, Surprise = fewer identical neighbours.
// Colour (Organica.color): the mask also keeps WHICH ink each point is. On a
// shared edge the same colour on both sides counts fully, two distinct inks
// count half, two inks too close to tell apart (deltaE under DISTINCT_MIN) count
// nothing — a seam that reads as a mistake. A fourth criterion, Colour, scores
// the ink areas: a clear hierarchy (roleShares), each ink spread over the page,
// neighbouring inks distinct. With one ink everything is as it was.
// Generators: every Arrange rule with its turns chosen for continuity; a beam
// search over Component × turn for continuity; weighted random + the same turn
// search. Ranked, look-alikes dropped, shown as a gallery. Deterministic (seed).
export const SUG_N = 10;   // samples per shared edge
export const SUG_STATES_SQ = [[0, false], [90, false], [180, false], [270, false], [0, true], [90, true], [180, true], [270, true]];   // D4 (flip H + a turn covers flip V)
export const SUG_STATES_RECT = [[0, false], [180, false], [0, true], [180, true]];   // a non-square Component or cell only turns half-way
export const compAnalysisCache = new Map();
export const SUG_SAME = 2;   // deltaE under this = the same colour (about one just-noticeable step)
export function analyseComponent(name) {
  const entry = LIBRARY.read()[name];
  if (!entry) return null;
  const key = name + '|' + (entry.savedAt || '') + '|' + (entry.colors || []).join(',') + '|' + (entry.paperColor || '');
  if (compAnalysisCache.has(key)) return compAnalysisCache.get(key);
  const S = frameSize(entry.grid), d = frameDims(entry.grid), RES = 64;
  const cv = document.createElement('canvas'); cv.width = RES; cv.height = RES;
  const ctx = cv.getContext('2d');
  const prev = { paper: state.paperColor, role: state.componentRole, under: state.underlyingComponentName, blend: state.componentBlend };
  state.paperColor = entry.paperColor || '#ffffff'; state.componentRole = entry.role || 'normal'; state.underlyingComponentName = entry.underlyingComponentName || null; state.componentBlend = entry.blend === 'multiply' ? 'multiply' : 'normal';
  try {
    const savedColorAt = entryInkAt(entry);
    const items = buildComponentItems({ cells: entry.component.cells }, entry.grid).map((it, j) => ({ ...it, color: savedColorAt(j) }));
    ctx.setTransform(RES / S, 0, 0, RES / S, 0, 0);
    withEntryInks(entry.colors, () => withAppearance(entry.appearance, () => drawComponentCanvas(ctx, items, entry.seed, S)));
  } finally { state.paperColor = prev.paper; state.componentRole = prev.role; state.underlyingComponentName = prev.under; state.componentBlend = prev.blend; ctx.setTransform(1, 0, 0, 1, 0, 0); }
  const px = ctx.getImageData(0, 0, RES, RES).data;
  const clearPaper = isPaperNone(entry.paperColor);   // transparent Paper: ink = an opaque pixel
  const paperRGB = Organica.hexToRGB255(clearPaper ? '#ffffff' : (entry.paperColor || '#ffffff'));
  const paper = { r: paperRGB[0], g: paperRGB[1], b: paperRGB[2] };
  // Which ink is each ink pixel: the nearest (OKLab) of the colours this Component can paint with.
  const under = entry.underlyingComponentName && LIBRARY.read()[entry.underlyingComponentName];
  const cands = [...new Set([...(entry.colors || []), ...((under && under.colors) || [])].map(hexKey).filter(c => /^#[0-9a-f]{6}$/.test(c)))];
  if (!cands.length) cands.push('#000000');
  const candLab = cands.map(c => Organica.color.hexToOklab(c));
  const nearest = new Map();
  const inkOf = (r, g, b) => {
    const k = (r << 16) | (g << 8) | b;
    if (nearest.has(k)) return nearest.get(k);
    const lab = Organica.color.hexToOklab(Organica.rgbToHex(r, g, b));
    let bi = 0, bd = Infinity;
    candLab.forEach((c, i) => { const d = (c.L - lab.L) ** 2 + (c.a - lab.a) ** 2 + (c.b - lab.b) ** 2; if (d < bd) { bd = d; bi = i; } });
    nearest.set(k, bi);
    return bi;
  };
  const GW = Math.max(4, Math.round(d.w / S * RES)), GH = Math.max(4, Math.round(d.h / S * RES));
  const ox = Math.round((RES - GW) / 2), oy = Math.round((RES - GH) / 2);
  const cov = new Uint8Array(GW * GH), inkMap = new Uint8Array(GW * GH), area = new Array(cands.length).fill(0);
  let ink = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = ((oy + y) * RES + ox + x) * 4;
    const on = clearPaper ? (px[i + 3] > 128 ? 1 : 0) : (Math.abs(px[i] - paper.r) + Math.abs(px[i + 1] - paper.g) + Math.abs(px[i + 2] - paper.b) > 90 ? 1 : 0);
    cov[y * GW + x] = on; ink += on;
    if (on) { const c = inkOf(px[i], px[i + 1], px[i + 2]); inkMap[y * GW + x] = c + 1; area[c]++; }
  }
  // pal[0] = the ground (null = transparent, the Symbol's own paper shows), pal[k] = ink k; share = its part of the frame
  const pal = [clearPaper ? null : hexKey(entry.paperColor || '#ffffff'), ...cands];
  const out = { cov, ink: inkMap, pal, share: [1 - ink / (GW * GH), ...area.map(a => a / (GW * GH))], GW, GH, density: ink / (GW * GH), square: Math.abs(d.w - d.h) < 1e-6, natural: Math.abs(d.w - d.h) < 1e-6 ? S : { w: d.w, h: d.h } };
  compAnalysisCache.set(key, out);
  return out;
}
// What a point of the frame shows: 0 = the ground, k = ink k of an.pal.
export function inkAt(an, u, v) {
  if (u <= -1 || u >= 1 || v <= -1 || v >= 1) return 0;
  const gx = Math.min(an.GW - 1, Math.floor((u + 1) / 2 * an.GW)), gy = Math.min(an.GH - 1, Math.floor((v + 1) / 2 * an.GH));
  const at = gy * an.GW + gx;
  return an.cov[at] ? (an.ink[at] || 1) : 0;
}
// One table for the whole pool: every colour the analyses can show gets a class
// (colours under SUG_SAME apart share one), and REL says how two classes relate:
// 0 same · 1 too close to tell apart · 2 distinct. Each analysis gets gid[k] =
// the class of its pal[k]. A transparent ground is the Symbol's own paper.
export function suggestColourTable(anByName) {
  const C = Organica.color, hexes = [];
  const ground = isPaperNone(state.paperColor) ? '#ffffff' : hexKey(state.paperColor);
  const classOf = hex => {
    let i = hexes.findIndex(h => h === hex || C.deltaE(h, hex) < SUG_SAME);
    if (i < 0) { hexes.push(hex); i = hexes.length - 1; }
    return i;
  };
  const inkClasses = new Set();
  Object.values(anByName).forEach(an => {
    if (!an) return;
    an.gid = an.pal.map(h => classOf(h == null ? ground : h));
    an.gid.forEach((g, k) => { if (k > 0 && an.share[k] > 0) inkClasses.add(g); });
  });
  const n = hexes.length, rel = hexes.map(() => new Uint8Array(n));
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) rel[a][b] = a === b ? 0 : C.deltaE(hexes[a], hexes[b]) < C.DISTINCT_MIN ? 1 : 2;
  return { hexes, rel, inks: inkClasses.size };
}

// The grid, in raw (canvas) coordinates: per-cell centre + size, and the shared edges.
export function suggestGridContext() {
  const grid = getSymbolGrid();
  if (!grid) return null;
  const raw = state.symbolGrid.cells;
  const res = resolveGridCells(grid);
  const fill = (ctrl('sel-sym-arrange-fit').value || 'fill') === 'fill';
  const cells = raw.map((c, i) => {
    if (grid.cellShape !== 'polygon') return { cx: c.x + c.width / 2, cy: c.y + c.height / 2, w: c.width, h: c.height };
    const off = fill ? polygonBoxOffset(grid, i) : { x: 0, y: 0 };   // where buildSymbolItems centres the content
    return { cx: c.centroid[0] + off.x, cy: c.centroid[1] + off.y, w: res[i].cellW, h: res[i].cellH };
  });
  const segs = [];   // {i, j, a:[x,y], b:[x,y]}
  if (grid.cellShape === 'polygon') {
    // Shared edges, including partial ones (Loom's triangular lattice offsets its
    // rows, so a base is shared with two neighbours, half each): edges are
    // bucketed by the line they lie on, and two edges of different cells on the
    // same line share the overlap of their spans.
    const buckets = new Map();
    raw.forEach((c, i) => c.points.forEach((p, k) => {
      const q = c.points[(k + 1) % c.points.length];
      const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      if (len < 1) return;
      let ux = dx / len, uy = dy / len;
      if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
      const ang = Math.round(Math.atan2(uy, ux) * 180 / Math.PI * 2);   // ½° bins
      const dist = Math.round((p[0] * -uy + p[1] * ux) * 2);            // ½-unit bins
      const t0 = p[0] * ux + p[1] * uy, t1 = q[0] * ux + q[1] * uy;
      const id = ang + '|' + dist;
      if (!buckets.has(id)) buckets.set(id, []);
      buckets.get(id).push({ i, lo: Math.min(t0, t1), hi: Math.max(t0, t1), ux, uy, n: dist / 2 });
    }));
    for (const list of buckets.values()) {
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
        const A = list[a], B = list[b];
        if (A.i === B.i) continue;
        const lo = Math.max(A.lo, B.lo), hi = Math.min(A.hi, B.hi);
        if (hi - lo < 1) continue;
        const pt = t => [t * A.ux - A.n * A.uy, t * A.uy + A.n * A.ux];
        segs.push({ i: A.i, j: B.i, a: pt(lo), b: pt(hi) });
      }
    }
  } else {
    const eps = 0.5;
    for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) {
      const A = raw[i], B = raw[j];
      const y0 = Math.max(A.y, B.y), y1 = Math.min(A.y + A.height, B.y + B.height);
      const x0 = Math.max(A.x, B.x), x1 = Math.min(A.x + A.width, B.x + B.width);
      if (y1 - y0 > eps) {
        if (Math.abs(A.x + A.width - B.x) < eps) segs.push({ i, j, a: [B.x, y0], b: [B.x, y1] });
        else if (Math.abs(B.x + B.width - A.x) < eps) segs.push({ i, j, a: [A.x, y0], b: [A.x, y1] });
      }
      if (x1 - x0 > eps) {
        if (Math.abs(A.y + A.height - B.y) < eps) segs.push({ i, j, a: [x0, B.y], b: [x1, B.y] });
        else if (Math.abs(B.y + B.height - A.y) < eps) segs.push({ i, j, a: [x0, A.y], b: [x1, A.y] });
      }
    }
  }
  // One pair per two neighbouring cells, however many pieces their border has (a
  // Radial grid's curved ring borders are polylines): SUG_N sample points spread
  // along the whole shared border, nudged 4% of the cell's size into each side,
  // stored relative to that cell's centre.
  const groups = new Map();
  segs.forEach(sg => { const i = Math.min(sg.i, sg.j), j = Math.max(sg.i, sg.j), k = i + '|' + j; if (!groups.has(k)) groups.set(k, { i, j, segs: [] }); groups.get(k).segs.push(sg); });
  const pairs = [...groups.values()].map(gp => {
    const lens = gp.segs.map(sg => Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]));
    const total = lens.reduce((a, b) => a + b, 0);
    const at = t => {   // point at arc-length fraction t of the whole border
      let d = t * total;
      for (let k = 0; k < gp.segs.length; k++) {
        if (d <= lens[k] || k === gp.segs.length - 1) { const f = lens[k] ? Math.min(1, d / lens[k]) : 0, sg = gp.segs[k]; return [sg.a[0] + (sg.b[0] - sg.a[0]) * f, sg.a[1] + (sg.b[1] - sg.a[1]) * f]; }
        d -= lens[k];
      }
      return gp.segs[0].a;
    };
    const side = (c) => {
      const pts = [];
      for (let k = 0; k < SUG_N; k++) {
        const [x, y] = at((k + 0.5) / SUG_N);
        const dx = c.cx - x, dy = c.cy - y, len = Math.hypot(dx, dy) || 1, inset = 0.04 * Math.min(c.w, c.h);
        pts.push([x + dx / len * inset - c.cx, y + dy / len * inset - c.cy]);
      }
      return pts;
    };
    return { i: gp.i, j: gp.j, pi: side(cells[gp.i]), pj: side(cells[gp.j]) };
  });
  const nbrs = cells.map(() => []);
  pairs.forEach((p, k) => { nbrs[p.i].push(k); nbrs[p.j].push(k); });
  const order = cells.map((c, i) => i).sort((a, b) => (Math.round(cells[a].cy / 4) - Math.round(cells[b].cy / 4)) || (cells[a].cx - cells[b].cx));
  const xs = cells.map(c => c.cx), ys = cells.map(c => c.cy);
  const bounds = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  return { cells, pairs, nbrs, order, bounds, orient: raw.map(c => (c.points ? polyOrient(c.points) : null)) };
}

// The ink bits a choice {name, r, fh} shows at a list of cell-relative points.
// The analysis a choice is scored with: its Component's own, or — Recolour — the
// same mask with one of its colourways' colours (anByName['<name>#<k>']).
export const anOf = (anByName, ch) => anByName[ch.cw ? ch.name + '#' + ch.cw : ch.name];
export const sameChoice = (a, b) => a.name === b.name && a.r === b.r && a.fh === b.fh && (a.cw || 0) === (b.cw || 0);
// Memo per run (G.memo): the same cell side is asked for the same choice many times
// (the mask is the same whatever the colourway, so the key leaves it out).
export function choiceBits(G, i, ch, pts, fit, anByName) {
  if (!G.memo) G.memo = new WeakMap();
  let byPts = G.memo.get(pts);
  if (!byPts) { byPts = new Map(); G.memo.set(pts, byPts); }
  const mk = ch.name + '|' + ch.r + '|' + (ch.fh ? 1 : 0);
  let got = byPts.get(mk);
  if (!got) { got = choiceBitsRaw(G, i, ch, pts, fit, anByName); byPts.set(mk, got); }
  return got;
}
export function choiceBitsRaw(G, i, ch, pts, fit, anByName) {
  const an = anByName[ch.name];
  const c = G.cells[i];
  const place = resolveCellPlacement(c.w, c.h, an.natural, { fitMode: fit, scale: 1, padding: 0, anchorX: 0, anchorY: 0, fixedSize: 100 });
  const hw = (an.natural.w || an.natural) / 2 * place.scaleX, hh = (an.natural.h || an.natural) / 2 * place.scaleY;
  const rad = ch.r * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad), fx = ch.fh ? -1 : 1;
  return pts.map(([x, y]) => {
    const rx = x * cs + y * sn, ry = -x * sn + y * cs;   // undo the turn
    return inkAt(an, rx / (hw * fx), ry / hh);
  });
}
// The two sides of one shared edge. ai/aj = the analyses (colour classes), T = the
// pool's colour table. Without them (or with one ink) it is the plain ink/paper score.
export function pairScore(bi, bj, ai, aj, T) {
  let inkInk = 0, paper = 0, miss = 0, distinct = 0, close = 0, seam = 0;
  for (let k = 0; k < bi.length; k++) {
    const a = bi[k], b = bj[k];
    const r = T ? T.rel[ai.gid[a]][aj.gid[b]] : 0;
    if (a && b) { if (r === 0) inkInk++; else if (r === 2) distinct++; else close++; }
    else if (!a && !b) { if (r === 0) paper++; else seam++; }
    else if (T && r === 0) inkInk++;   // an ink running into a ground of its own colour reads as one area
    else miss++;
  }
  const n = bi.length;
  return { s: (2 * inkInk + distinct + 0.5 * paper - miss) / (2 * n), match: (inkInk + paper) / n, active: inkInk + distinct + close + miss > 0, distinct, close };
}
export function statesFor(G, i, an) {
  const c = G.cells[i];
  return an.square && Math.abs(c.w - c.h) / Math.max(c.w, c.h) < 0.08 ? SUG_STATES_SQ : SUG_STATES_RECT;
}
// Whole-candidate score: {total, cont, bal, sur, match}
export function scoreSymbolCandidate(G, cand, pal, W, fit, anByName, T) {
  let sc = 0, match = 0, act = 0, same = 0, distinct = 0, close = 0;
  const bitsCache = new Map();
  const bits = (i, side, p) => { const k = i + ':' + p + side; if (!bitsCache.has(k)) bitsCache.set(k, choiceBits(G, i, cand[i], side === 'i' ? G.pairs[p].pi : G.pairs[p].pj, fit, anByName)); return bitsCache.get(k); };
  G.pairs.forEach((p, k) => {
    const r = pairScore(bits(p.i, 'i', k), bits(p.j, 'j', k), anOf(anByName, cand[p.i]), anOf(anByName, cand[p.j]), T);
    sc += r.s; match += r.match; if (r.active) act++;
    distinct += r.distinct; close += r.close;
    const a = cand[p.i], b = cand[p.j];
    if (sameChoice(a, b)) same++;
  });
  const np = Math.max(1, G.pairs.length);
  const cont = (sc / np + 0.5) / 1.5;
  // balance: ink over a 3×3 split of the page + usage vs weight
  const reg = new Array(9).fill(0), regN = new Array(9).fill(0);
  const bw = Math.max(1, G.bounds.x1 - G.bounds.x0), bh = Math.max(1, G.bounds.y1 - G.bounds.y0);
  const use = {};
  cand.forEach((ch, i) => {
    const c = G.cells[i], an = anByName[ch.name];
    const rx = Math.min(2, Math.floor((c.cx - G.bounds.x0) / bw * 3)), ry = Math.min(2, Math.floor((c.cy - G.bounds.y0) / bh * 3));
    reg[ry * 3 + rx] += an.density * c.w * c.h; regN[ry * 3 + rx] += c.w * c.h;
    use[ch.name] = (use[ch.name] || 0) + 1;
  });
  const dens = reg.map((v, k) => (regN[k] ? v / regN[k] : null)).filter(v => v != null);
  const mean = dens.reduce((a, b) => a + b, 0) / dens.length;
  const sd = Math.sqrt(dens.reduce((a, b) => a + (b - mean) ** 2, 0) / dens.length);
  const totW = pal.reduce((t, p) => t + (p.weight || 1), 0);
  const dev = pal.reduce((t, p) => t + Math.abs((use[p.name] || 0) / cand.length - (p.weight || 1) / totW), 0) / 2;
  const bal = 0.5 * Math.max(0, 1 - sd / 0.35) + 0.5 * (1 - dev);
  const sur = 1 - same / np;
  // Colour — only when the pool shows two inks or more (one ink: nothing to weigh).
  let col = null;
  if (T && T.inks > 1) {
    const nC = T.hexes.length, tot = new Array(nC).fill(0), regC = Array.from({ length: nC }, () => new Array(9).fill(0));
    let page = 0;
    cand.forEach((ch, i) => {
      const c = G.cells[i], an = anOf(anByName, ch), a = c.w * c.h;
      const rx = Math.min(2, Math.floor((c.cx - G.bounds.x0) / bw * 3)), ry = Math.min(2, Math.floor((c.cy - G.bounds.y0) / bh * 3));
      page += a;
      for (let k = 1; k < an.pal.length; k++) { const v = an.share[k] * a; tot[an.gid[k]] += v; regC[an.gid[k]][ry * 3 + rx] += v; }
    });
    const used = tot.map((v, g) => ({ g, v })).filter(o => o.v > 0).sort((a, b) => b.v - a.v).slice(0, 7);
    const inkArea = used.reduce((t, o) => t + o.v, 0) || 1;
    // hierarchy: the ink areas, largest first, against the role shares (Base / Secondary / Accent…)
    const want = Organica.color.roleShares(used.length);
    const prop = 1 - used.reduce((t, o, k) => t + Math.abs(o.v / inkArea - want[k] / 100), 0) / 2;
    // spread: each ink over the regions that have cells, weighed by its area
    const live = regN.map((v, k) => (v ? k : -1)).filter(k => k >= 0);
    const spread = used.reduce((t, o) => {
      const d = live.map(k => regC[o.g][k] / regN[k]), m = d.reduce((a, b) => a + b, 0) / d.length;
      const cv = m ? Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length) / m : 0;
      return t + (o.v / inkArea) * Math.max(0, 1 - cv / 1.5);
    }, 0);
    // legibility: where two different inks meet, they can be told apart
    const leg = distinct + close ? distinct / (distinct + close) : 1;
    col = 0.45 * prop + 0.25 * spread + 0.30 * leg;
  }
  const wc = col == null ? 0 : (W.col || 0);
  const wsum = W.cont + W.bal + W.sur + wc || 1;
  return { total: (W.cont * cont + W.bal * bal + W.sur * sur + wc * (col || 0)) / wsum, cont, bal, sur, col, match: match / np, edges: G.pairs.length };
}
// For fixed Components, pick each cell's turn for continuity with the already-placed
// neighbours (cells visited top-to-bottom, left-to-right). Locked cells keep theirs.
// CW (Recolour): name → its colourways; each free cell then also picks one of them.
export function refineTurns(G, cand, fit, anByName, rng, fixed, T, CW) {
  const placed = new Array(cand.length).fill(false);
  fixed.forEach((f, i) => { if (f) placed[i] = true; });
  for (const i of G.order) {
    if (fixed[i]) continue;
    const an = anByName[cand[i].name];
    const nCw = CW ? CW[cand[i].name].length : 1;
    let best = null, bestS = -Infinity;
    for (const [r, fh] of statesFor(G, i, an)) for (let cw = 0; cw < nCw; cw++) {
      const ch = cw ? { name: cand[i].name, r, fh, cw } : { name: cand[i].name, r, fh };
      let s = rng() * 0.02;
      for (const k of G.nbrs[i]) {
        const p = G.pairs[k], o = p.i === i ? p.j : p.i;
        if (!placed[o]) continue;
        const mine = choiceBits(G, i, ch, p.i === i ? p.pi : p.pj, fit, anByName);
        const theirs = choiceBits(G, o, cand[o], p.i === i ? p.pj : p.pi, fit, anByName);
        s += pairScore(mine, theirs, anOf(anByName, ch), anOf(anByName, cand[o]), T).s;
      }
      if (s > bestS) { bestS = s; best = ch; }
    }
    cand[i] = best; placed[i] = true;
  }
  return cand;
}
// Beam search over Component × turn, cell by cell.
export function beamCandidate(G, pal, W, fit, anByName, rng, locked, width, T, CW) {
  const n = G.cells.length;
  const totW = pal.reduce((t, p) => t + (p.weight || 1), 0);
  let beam = [{ cand: locked.map(l => l || null), s: 0, uses: {} }];
  for (const i of G.order) {
    if (locked[i]) continue;
    const next = [];
    for (const b of beam) {
      for (const p of pal) {
        const an = anByName[p.name];
        const nCw = CW ? CW[p.name].length : 1;
        for (const [r, fh] of statesFor(G, i, an)) for (let cw = 0; cw < nCw; cw++) {
          const ch = cw ? { name: p.name, r, fh, cw } : { name: p.name, r, fh };
          let s = 0, rep = 0;
          for (const k of G.nbrs[i]) {
            const pr = G.pairs[k], o = pr.i === i ? pr.j : pr.i;
            const other = b.cand[o];
            if (!other) continue;
            s += pairScore(choiceBits(G, i, ch, pr.i === i ? pr.pi : pr.pj, fit, anByName), choiceBits(G, o, other, pr.i === i ? pr.pj : pr.pi, fit, anByName), anOf(anByName, ch), anOf(anByName, other), T).s;
            if (sameChoice(other, ch)) rep++;
          }
          const used = (b.uses[p.name] || 0) / n, want = (p.weight || 1) / totW;
          const inc = W.cont * s - W.sur * 0.6 * rep - W.bal * Math.max(0, used - want) * 2 + rng() * (0.05 + W.sur * 0.25);
          next.push({ b, i, ch, s: b.s + inc });
        }
      }
    }
    next.sort((x, y) => y.s - x.s);
    beam = next.slice(0, width).map(x => {
      const cand = x.b.cand.slice(); cand[x.i] = x.ch;
      return { cand, s: x.s, uses: { ...x.b.uses, [x.ch.name]: (x.b.uses[x.ch.name] || 0) + 1 } };
    });
  }
  return beam[0].cand;
}
// A cell's turn in the engine's own form {r, fh}: flip V = a half turn + flip H,
// flip H + V = a half turn (see canonicalState).
export function choiceOfCell(c) {
  if (!c || c.source !== 'component') return null;
  let r = ((Math.round(c.rotation / 90) * 90) % 360 + 360) % 360, fh = !!c.flipH;
  if (c.flipV) { r = (r + 180) % 360; fh = !fh; }
  const ch = { name: c.componentName, r, fh };
  if (c.colourway) ch.cwRaw = c.colourway;   // resolved to an index (cw) by suggestSymbols
  return ch;
}
export function candFromCells(cells) { return cells.map(choiceOfCell); }
export function cellsFromCand(cand, fit, prevCells, CW) {
  return cand.map((ch, i) => {
    const prev = prevCells[i];
    if (prev && prev.locked) return prev;
    const cell = { source: 'component', componentName: ch.name, rotation: ch.r, flipH: ch.fh, flipV: false, scale: 1, color: null,
      fitMode: fit, fixedSize: 100, anchorX: 0, anchorY: 0, padding: 0, locked: false };
    if (ch.cw && CW) { const cw = CW[ch.name][ch.cw]; cell.colourway = { colors: cw.colors.slice(), paper: cw.paper }; }
    return cell;
  });
}
// Recolour (test): the colourways a pool Component may take in a cell — the ones that
// keep its number of inks and its colour rule, so the analysed mask stays valid and
// only the colours change. Up to three, after the Component's own.
export function suggestColourways(name) {
  const entry = LIBRARY.read()[name];
  if (!entry || !(entry.colors || []).length) return [];
  const rule = { ...DEFAULT_COLOR_RULE, ...(entry.colorRule || {}) };
  const base = { colors: entry.colors.map(hexKey), paper: entry.paperColor || '#ffffff', colorRule: rule };
  return buildColourways(base, entry.grid, entry.component.cells.length).slice(1)
    .filter(cw => cw.colors.length === base.colors.length && cw.colorRule.mode === rule.mode && (cw.colorRule.offset || 0) === (rule.offset || 0))
    .slice(0, 3).map(cw => ({ colors: cw.colors, paper: cw.paper }));
}
// The same mask, shown in a colourway's colours.
export function recolouredAnalysis(an, entry, cw) {
  const map = new Map();
  (entry.colors || []).map(hexKey).forEach((h, k) => { if (!map.has(h) && cw.colors[k]) map.set(h, hexKey(cw.colors[k])); });
  return { ...an, gid: null, pal: [isPaperNone(cw.paper) ? null : hexKey(cw.paper), ...an.pal.slice(1).map(h => map.get(h) || h)] };
}
export function suggestWeights() { return { cont: +ctrl('rg-sug-cont').value / 100, bal: +ctrl('rg-sug-bal').value / 100, sur: +ctrl('rg-sug-sur').value / 100, col: +ctrl('rg-sug-col').value / 100 }; }

// The candidate list (pure apart from reading the grid/palette state).
export function suggestSymbols(opts = {}) {
  const G = suggestGridContext();
  const pal = poolEntries();
  if (!G || !pal.length) return [];
  const W = opts.weights || suggestWeights();
  const fit = opts.fit || ctrl('sel-sym-arrange-fit').value || 'fill';
  const seed = opts.seed != null ? opts.seed : (parseInt(ctrl('num-sug-seed').value, 10) || 0);
  const anByName = {};
  pal.forEach(p => { anByName[p.name] = analyseComponent(p.name); });
  // Colourways per Component: [own colours, …]. Filled by Recolour; a cell that
  // already carries one (locked, or the base of "More like this") adds its own.
  const recolour = opts.recolour != null ? opts.recolour : ctrl('chk-sug-recolour').checked;
  const lib = LIBRARY.read(), CW = {};
  const cwAdd = (name, cw) => {
    const key = cw.paper + '|' + cw.colors.join(',');
    let k = CW[name].findIndex(x => x && x.paper + '|' + x.colors.join(',') === key);
    if (k < 0) { k = CW[name].push({ colors: cw.colors.map(hexKey), paper: cw.paper }) - 1; anByName[name + '#' + k] = recolouredAnalysis(anByName[name], lib[name], CW[name][k]); }
    return k;
  };
  pal.forEach(p => { CW[p.name] = [null]; if (recolour) suggestColourways(p.name).forEach(cw => cwAdd(p.name, cw)); });
  const resolve = ch => {
    if (!ch) return ch;
    const out = { name: ch.name, r: ch.r, fh: ch.fh };
    const k = ch.cwRaw && CW[ch.name] ? cwAdd(ch.name, ch.cwRaw) : (ch.cw || 0);
    if (k) out.cw = k;
    return out;
  };
  const cur = state.symbolCells;
  const locked = cur.map(c => (c && c.locked && c.source === 'component' && anByName[c.componentName] ? resolve(choiceOfCell(c)) : null));
  const base = opts.base ? opts.base.map(ch => (ch && anByName[ch.name] ? resolve(ch) : null)) : null;
  const T = suggestColourTable(anByName);
  const CWs = recolour ? CW : null;
  // Recolour multiplies every cell's options: a heavy grid searches a narrower beam.
  const maxCw = Math.max(...Object.values(CW).map(l => l.length));
  const beamWidth = recolour && G.pairs.length * pal.length * maxCw > 2400 ? 2 : 4;
  suggestSymbols.lastNote = !recolour ? '' : `Recolour (test): a cell may take one of its Component's colourways (up to ${maxCw - 1} each)${beamWidth < 4 ? ' — large grid, narrower search' : ''}.`;
  const fixed = locked.map(Boolean);
  const grid = getSymbolGrid();
  const out = [];
  const add = (cand, label) => out.push({ cand, label });
  const rng = mulberry32(seed * 7919 + 13);
  if (opts.base) {
    // "More like this": 8–20% of the free cells re-drawn, then turns refined.
    for (let v = 0; v < 11; v++) {
      const r = mulberry32(seed * 131 + v * 977 + 5);
      const cand = base.map((ch, i) => (fixed[i] ? locked[i] : ch ? { ...ch } : { name: pal[0].name, r: 0, fh: false }));
      const rate = 0.08 + 0.12 * r();
      const keep = cand.map((ch, i) => fixed[i] || r() >= rate);   // only the re-drawn cells get a new Component + turn
      cand.forEach((ch, i) => { if (!keep[i]) cand[i] = { name: weightedPick(pal, r).name, r: 0, fh: false }; });
      add(refineTurns(G, cand, fit, anByName, r, keep, T, CWs), 'Like the current');
    }
  } else {
    for (const [id, rule] of Object.entries(SYMBOL_ARRANGE)) {
      if (id === 'random' || (id === 'orientation' && !G.orient.some(Boolean))) continue;
      const cells = arrangeCells(grid, cur, pal, id, seed, fit);
      const cand = cells.map((c, i) => (fixed[i] ? locked[i] : { name: c.componentName, r: 0, fh: false }));
      add(refineTurns(G, cand, fit, anByName, mulberry32(seed + id.length * 31), fixed, T, CWs), rule.label);
    }
    for (let b = 0; b < 3; b++) add(beamCandidate(G, pal, W, fit, anByName, mulberry32(seed * 17 + b * 101 + 1), locked, beamWidth, T, CWs), 'Continuity search');
    for (let b = 0; b < 2; b++) {
      const r = mulberry32(seed * 29 + b * 53 + 7);
      const cand = G.cells.map((c, i) => (fixed[i] ? locked[i] : { name: weightedPick(pal, r).name, r: 0, fh: false }));
      add(refineTurns(G, cand, fit, anByName, r, fixed, T, CWs), 'Weighted mix');
    }
  }
  // score, rank, drop duplicates (same Component + canonical turn in every cell)
  const seen = new Set();
  const scored = out.map(o => ({ ...o, score: scoreSymbolCandidate(G, o.cand, pal, W, fit, anByName, T) }))
    .sort((a, b) => b.score.total - a.score.total)
    .filter(o => { const key = o.cand.map(c => c.name + (c.cw ? '#' + c.cw : '') + canonicalState({ rotation: c.r, flipH: c.fh, flipV: false, scale: 1 })).join('|'); if (seen.has(key)) return false; seen.add(key); return true; });
  return scored.slice(0, opts.limit || 12).map(o => ({ ...o, cells: cellsFromCand(o.cand, fit, cur, CW) }));
}

export function renderSuggestGallery(currentIdx) {
  const wrap = ctrl('fvs-sug-panel'), n = state.symbolSuggestions.length;
  const vb = ctrl('btn-sug-dock');
  vb.setAttribute('aria-disabled', String(!n));
  ctrl('sug-dock-count').hidden = !n;
  if (!n) { wrap.innerHTML = ''; setSugDockOpen(false); vb.setAttribute('aria-label', 'Variations — none yet'); return; }
  ctrl('sug-dock-count').textContent = n > 99 ? '99+' : String(n);
  vb.setAttribute('aria-label', n + (n === 1 ? ' variation' : ' variations'));
  syncSugDock();
  const prev = state.symbolCells;
  wrap.innerHTML = '';
  state.symbolSuggestions.forEach((sg, i) => {
    state.symbolCells = sg.cells;
    const svg = buildSymbolSVG();
    const btn = document.createElement('button');
    btn.className = 'fvs-suggest__item' + (i === currentIdx ? ' is-current' : '');
    btn.type = 'button';
    btn.innerHTML = svg;
    const cap = `Use variation ${i + 1}: ${sg.label}${sg.score.edges ? ` · continuity ${Math.round(sg.score.match * 100)}%` : ''}${sg.score.col != null ? ` · colour ${Math.round(sg.score.col * 100)}%` : ''}`;
    btn.setAttribute('aria-label', cap); btn.title = cap;
    btn.addEventListener('click', e => {
      state.symbolCells = sg.cells.map(c => ({ ...c }));
      state.symbolSelection.clear();
      hooks.renderSymbol();
      wrap.querySelectorAll('.fvs-suggest__item').forEach((b, k) => b.classList.toggle('is-current', k === i));
      setSugDockOpen(false, { focus: e.detail === 0 });   // picked: the strip closes (focus back on the Variations button from the keyboard)
    });
    wrap.appendChild(btn);
  });
  state.symbolCells = prev;
}
export function runSuggest(more) {
  if (!state.symbolGrid) return;
  if (!poolEntries().length) {
    if (elementPool().length) { generateSymbolCells(); ctrl('sug-hint').textContent = 'Suggest reads saved Components — with Elements only the cells were arranged.'; return; }
    ctrl('sug-hint').textContent = 'Add Components to the pool first (Components section above).'; return;
  }
  const base = more ? candFromCells(state.symbolCells) : null;
  if (more && base.some(c => !c)) { runSuggest(false); return; }
  setStatus('active', 'Suggesting…');
  state.symbolSuggestions = suggestSymbols(more ? { base } : {});
  ctrl('sug-hint').textContent = suggestSymbols.lastNote || '';
  if (!more && state.symbolSuggestions.length) state.symbolCells = state.symbolSuggestions[0].cells.map(c => ({ ...c }));
  hooks.renderSymbol();
  renderSuggestGallery(more ? -1 : 0);
  if (more && state.symbolSuggestions.length) setSugDockOpen(true);   // More like this applies nothing — show what it found
}
// The variations dock: collapsed by default (variation 1 is already on the sheet); not remembered across visits.
export function sugDockIsOpen() { return ctrl('fvs-sug-panel').dataset.open === 'true'; }
export function syncSugDock() {
  const open = sugDockIsOpen(), btn = ctrl('btn-sug-dock');
  btn.setAttribute('aria-expanded', String(open));
}
export function setSugDockOpen(open, opts) {
  const panel = ctrl('fvs-sug-panel');
  if (open) {   // sit just above the floatbar, whatever its height; one dropdown at a time
    const bar = ctrl('btn-sug-dock').closest('.org-floatbar');
    panel.style.setProperty('--fvs-sug-bottom', Math.round(innerHeight - bar.getBoundingClientRect().top + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-3'))) + 'px');
    document.dispatchEvent(new CustomEvent('organica:dropdown-open', { detail: panel }));
  }
  panel.dataset.open = open ? 'true' : 'false';
  panel.toggleAttribute('inert', !open);
  syncSugDock();
  if (open) {
    const cur = panel.querySelector('.is-current') || panel.querySelector('.fvs-suggest__item');
    if (cur) { cur.scrollIntoView({ inline: 'nearest', block: 'nearest' }); if (opts && opts.focus) cur.focus({ preventScroll: true }); }
  } else if (opts && opts.focus) ctrl('btn-sug-dock').focus();
}
ctrl('btn-sug-dock').addEventListener('click', e => { if (e.currentTarget.getAttribute('aria-disabled') === 'true') return; setSugDockOpen(!sugDockIsOpen(), { focus: e.detail === 0 }); });   // keyboard opens with focus on the current variation
ctrl('fvs-sug-panel').addEventListener('wheel', e => e.stopPropagation(), { passive: true });   // scrolling the strip never zooms the sheet
document.addEventListener('organica:dropdown-open', e => { if (e.detail !== ctrl('fvs-sug-panel') && sugDockIsOpen()) setSugDockOpen(false); });   // Export / Anchor opened: make room

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || !sugDockIsOpen()) return;
  const a = document.activeElement;
  if ((a && (a.closest('#fvs-sug-panel') || a.id === 'btn-sug-dock')) || !a || a === document.body) setSugDockOpen(false, { focus: true });   // as the rail: an Escape meant for a field or popover stays theirs
});
['cont', 'bal', 'sur', 'col'].forEach(k => ctrl('rg-sug-' + k).addEventListener('input', e => { ctrl('v-sug-' + k).textContent = e.target.value; }));
ctrl('btn-sug-run').addEventListener('click', () => runSuggest(false));
ctrl('btn-sug-more').addEventListener('click', () => runSuggest(true));
ctrl('btn-sug-seed-random').addEventListener('click', () => { ctrl('num-sug-seed').value = Math.floor(Math.random() * 1e6); runSuggest(false); });
