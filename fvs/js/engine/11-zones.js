// Flexible Visual System · engine/11-zones — Zones: a part of the Symbol and what it does (Oct 27, 2026 — Diego:
// "voglio poter dire ad un determinato gruppo di righe, colonne, celle selezionate di fare e di seguire delle regole").
// One evaluator for the Symbol step's Zones and the Figure's region rules (Compose): a zone / region rule is
// { id?, name?, when, do, off? } — `when` says which cells (the Figure's class keys, explicit addresses, or a named
// geometric selector that survives a grid rebuild), `do` what they get. Zones apply in order, a later one wins on the
// cells it matches; a Keep zone always wins (its cells are locked, nothing after it touches them).
// Engine: no DOM — the model only. Map: docs/FVS.md §11, Zones §6c.
import {
  state
} from './00-core.js';
import {
  mulberry32
} from './03-rules.js';
import {
  polyOrient, snapPose, withPlacementDefaults
} from './08-symbol-grid.js';
import {
  SYMBOL_ARRANGE, symbolCellContext
} from './10-suggest.js';
import {
  SYMBOL_RULES, cellColRow, symbolPastePlan
} from './11-symbol-ui.js';
import { provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  applyZones: () => applyZones, zoneCells: () => zoneCells
});

const clone = o => JSON.parse(JSON.stringify(o));

// ── Cell context ─────────────────────────────────────────────
// Each cell's place: col / row (bands on polygon grids), parity, orientation (triangles), ring / sector (radial grids).
// `raw` = the Loom grid's own cells (default: the Symbol's).
export function slotClassContext(grid, raw) {
  const cr = cellColRow(grid);
  raw = raw || (state.symbolGrid && state.symbolGrid.cells) || [];
  return cr.map((c, i) => ({
    index: i, col: c.col, row: c.row, parity: (c.col + c.row) % 2 === 1 ? 'odd' : 'even',
    orient: raw[i] && raw[i].points ? polyOrient(raw[i].points) : null,
    ring: raw[i] && raw[i].ring != null ? raw[i].ring : null, sector: raw[i] && raw[i].sector != null ? raw[i].sector : null,
  }));
}
// The Figure's class keys + Compose's addresses (unchanged since Oct 7–8, 2026).
export function ruleMatches(when, ctx) {
  const has = (v, x) => Array.isArray(v) ? v.includes(x) : v === x;
  return (when.class == null || has(when.class, ctx.orient)) && (when.row == null || has(when.row, ctx.row))
    && (when.col == null || has(when.col, ctx.col)) && (when.index == null || has(when.index, ctx.index))
    && (when.parity == null || when.parity === ctx.parity) && (when.ring == null || has(when.ring, ctx.ring)) && (when.sector == null || has(when.sector, ctx.sector))
    && (when.at == null || when.at.some(a => a[0] === ctx.row && a[1] === ctx.col));   // at: [[row, col], …] — cells by grid address (Compose)
}

// ── Named selectors (when.sel) — a part described by the grid's geometry, so it stays the same part when the grid
// is rebuilt (more columns, another canvas). k < 0 counts from the end: row −1 = the last row.
//   {sel:'row'|'col'|'ring'|'sector', k}   k a number or a list
//   {sel:'border', depth}                  the outer band, depth lines deep (rings on a radial grid)
//   {sel:'centre', size}                   the middle: |nx|, |ny| under size (0..1, default ⅓)
//   {sel:'quadrant', q}                    'tl' · 'tr' · 'bl' · 'br'
//   {sel:'diagonal', which}                'main' · 'anti' · 'both' — the cells the corner-to-corner lines cross
//   {sel:'every', by, n, phase}            by 'row' · 'col' · 'index' · 'checker' · 'ring' · 'sector' — one in n
//   {sel:'all'}                            every cell
export const ZONE_SELECTORS = ['row', 'col', 'ring', 'sector', 'border', 'centre', 'quadrant', 'diagonal', 'every', 'all'];
// Rings and sectors of a radial grid, from the cells' centres (Loom's wedges carry no ring / sector of their own):
// a ring = cells at the same distance from the centre, a sector = cells at the same angle (bands, 2 % tolerance).
const bandIndex = (vals, tol) => {
  const reps = [];
  [...vals].sort((a, b) => a - b).forEach(v => { if (!reps.length || v - reps[reps.length - 1] > tol) reps.push(v); });
  return vals.map(v => { let bi = 0, bd = Infinity; reps.forEach((r, i) => { const d = Math.abs(r - v); if (d < bd) { bd = d; bi = i; } }); return bi; });
};
const RADIAL_GRIDS = new Set(['radial', 'circular']);
// derive: false keeps the Figure's region rules as they were (their rings come from the cells' own data only).
export function zoneContexts(grid, raw, derive = true) {
  const slot = slotClassContext(grid, raw), geo = cellColRow(grid);
  const type = state.symbolGrid && state.symbolGrid.grid && state.symbolGrid.grid.type;
  if (derive && RADIAL_GRIDS.has(type) && slot.length && slot.every(c => c.ring == null)) {
    const r = geo.map(g => Math.hypot(g.cx, g.cy)), maxR = Math.max(1e-6, ...r);
    const rings = bandIndex(r, 0.02 * maxR), sectors = bandIndex(geo.map(g => ((g.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)), 0.02);
    slot.forEach((c, i) => { c.ring = rings[i]; c.sector = sectors[i]; });
  }
  const max = k => Math.max(0, ...slot.map(c => (c[k] == null ? 0 : c[k])));
  const ext = { maxCol: max('col'), maxRow: max('row'), maxRing: max('ring'), maxSector: max('sector'), radial: slot.some(c => c.ring != null) };
  return slot.map((c, i) => ({ ...c, nx: geo[i].nx, ny: geo[i].ny, angle: geo[i].angle, ext }));
}
const listOf = v => (Array.isArray(v) ? v : [v]);
const fromEnd = (k, max) => (k < 0 ? max + 1 + k : k);
function selMatches(s, c) {
  const E = c.ext;
  switch (s.sel) {
    case 'all': return true;
    case 'row': return listOf(s.k).some(k => c.row === fromEnd(+k, E.maxRow));
    case 'col': return listOf(s.k).some(k => c.col === fromEnd(+k, E.maxCol));
    case 'ring': return c.ring != null && listOf(s.k).some(k => c.ring === fromEnd(+k, E.maxRing));
    case 'sector': return c.sector != null && listOf(s.k).some(k => c.sector === fromEnd(+k, E.maxSector));
    case 'border': {
      const d = Math.max(1, +s.depth || 1);
      if (E.radial) return c.ring != null && c.ring > E.maxRing - d;
      return c.col < d || c.row < d || c.col > E.maxCol - d || c.row > E.maxRow - d;
    }
    case 'centre': {
      const z = s.size != null ? +s.size : 1 / 3;
      if (E.radial) return c.ring != null && c.ring < Math.max(1, Math.round((E.maxRing + 1) * z));
      return Math.abs(c.nx) < z + 1e-6 && Math.abs(c.ny) < z + 1e-6;
    }
    case 'quadrant': {
      const q = String(s.q || 'tl'), right = c.nx > 1e-6, left = c.nx < -1e-6, bottom = c.ny > 1e-6, top = c.ny < -1e-6;
      return (q[0] === 't' ? top : bottom) && (q[1] === 'l' ? left : right);
    }
    case 'diagonal': {
      const w = s.which || 'both', tol = 1 / (Math.max(E.maxCol, E.maxRow) + 1);
      const main = Math.abs(c.nx - c.ny) <= tol + 1e-6, anti = Math.abs(c.nx + c.ny) <= tol + 1e-6;
      return w === 'main' ? main : w === 'anti' ? anti : main || anti;
    }
    case 'every': {
      const n = Math.max(1, +s.n || 2), p = +s.phase || 0, by = s.by || 'index';
      const v = by === 'checker' ? c.col + c.row : by === 'row' ? c.row : by === 'col' ? c.col : by === 'ring' ? c.ring : by === 'sector' ? c.sector : c.index;
      return v != null && (((v - p) % n) + n) % n === 0;
    }
    default: return false;
  }
}
// Does a zone's `when` take this cell? A selector, the class keys and addresses all have to agree (an empty when = all).
export function whenMatches(when, ctx) {
  when = when || {};
  if (when.sel && !selMatches(when, ctx)) return false;
  if (when.not && whenMatches(when.not, ctx)) return false;   // a part minus another: {sel:'all', not:{sel:'border'}}
  return ruleMatches(when, ctx);
}
// The cells of a zone, as indices.
export function zoneCells(when, ctxs) {
  return ctxs.filter(c => whenMatches(when, c)).map(c => c.index);
}
// The explicit addresses of a cell list ({at} when every cell has its own row / column, {index} otherwise) — or the
// named selector that takes exactly those cells, when one does (Zone from selection keeps the part, not the cells).
export function whenFromCells(ids, ctxs) {
  const want = [...new Set(ids)].sort((a, b) => a - b), key = want.join(',');
  const same = w => zoneCells(w, ctxs).join(',') === key;
  const E = ctxs.length ? ctxs[0].ext : {};
  const tries = [{ sel: 'all' }, { sel: 'border' }, { sel: 'centre' }, { sel: 'diagonal', which: 'both' }, { sel: 'diagonal', which: 'main' }, { sel: 'diagonal', which: 'anti' },
    ...['tl', 'tr', 'bl', 'br'].map(q => ({ sel: 'quadrant', q })),
    ...['checker', 'row', 'col', 'index'].flatMap(by => [0, 1].map(phase => ({ sel: 'every', by, n: 2, phase })))];
  for (const w of tries) if (same(w)) return w;
  // whole rows / columns / rings / sectors: the set of k that covers them
  for (const k of ['row', 'col', 'ring', 'sector']) {
    const vals = [...new Set(want.map(i => ctxs[i][k]))];
    if (vals.some(v => v == null)) continue;
    const w = { sel: k, k: vals.length === 1 ? vals[0] : vals.sort((a, b) => a - b) };
    if (same(w)) {   // the last line(s) counted from the end, so they stay the last ones on a bigger grid
      const max = k === 'row' ? E.maxRow : k === 'col' ? E.maxCol : k === 'ring' ? E.maxRing : E.maxSector;
      const all = listOf(w.k);
      if (all.every(v => v > max / 2)) w.k = all.length === 1 ? all[0] - max - 1 : all.map(v => v - max - 1);
      return w;
    }
  }
  const unique = new Set(ctxs.map(c => c.row + ',' + c.col)).size === ctxs.length;
  return unique ? { at: want.map(i => [ctxs[i].row, ctxs[i].col]) } : { index: want };
}

// Rotate & mirror on the cells (Oct 9, 2026): how much one cell turns — the Rotation, + the Rotation per cell × the
// cell's count (cell / row / column, from 0), + a random turn up to ± Random rotation, drawn from the seed and the cell's index.
export function cellTurnOf(d, ctx) {
  let t = +d.turnBy || 0;
  if (d.turnStep && +d.turnStep.deg) t += +d.turnStep.deg * (+ctx[d.turnStep.by === 'row' ? 'row' : d.turnStep.by === 'col' ? 'col' : 'index'] || 0);
  if (d.turnRandom != null) {   // { seed, amount }: up to ± amount° each way (a bare number = a seed from before, a full turn)
    const R = typeof d.turnRandom === 'object' ? d.turnRandom : { seed: d.turnRandom, amount: 180 };
    t += (+R.amount || 0) * (2 * Organica.mulberry32(((R.seed >>> 0) ^ Math.imul((+ctx.index || 0) + 1, 2654435761)) >>> 0)() - 1);
  }
  return t;
}
// A saved Element / Component (with a copy of its entry) → the patch a Symbol cell takes (the Library rail's railPatch,
// from the copy). Used by the Figure graph's content, by Composition rules and Zones that drop content into cells.
export function contentPatch(c, fit) {
  const base = { rotation: 0, flipH: false, flipV: false, fitMode: fit || 'contain', scale: 1, padding: 0, pad: null, anchorX: 0, anchorY: 0, colourway: null };
  if (c.kind === 'component') return { ...base, source: 'component', componentName: c.name, span: true, ownColors: null, ownPaper: null, ownAppearance: null };
  const e = c.entry || {};
  const sp = clone(e.seed), o = e.orientation || {};
  if (sp.type === 'stack') sp.layers.forEach(l => { if (l.ink == null || l.ink === 'cell') l.ink = 0; });
  return { ...base, source: 'seed', seedType: sp.type, seedParams: sp, color: null,
    ownColors: e.colors && e.colors.length ? e.colors.slice() : null, ownPaper: e.paperColor || null, ownAppearance: e.appearance || null,
    rotation: o.rotation || 0, flipH: !!o.flipH, flipV: !!o.flipV };
}

// A content taken from a cell of the Symbol (Zones' Content from "this Symbol"): the fields that say what the cell holds,
// put on another cell with its pose reset (a down triangle turned to face its slot) and the zone's Fit.
export const CONTENT_FIELDS = ['source', 'seedType', 'seedParams', 'componentName', 'ownColors', 'ownPaper', 'ownAppearance', 'appearancePatch', 'color', 'span', 'colourway'];
export function contentOfCell(c) { const o = {}; CONTENT_FIELDS.forEach(k => { if (c && c[k] != null) o[k] = clone(c[k]); }); return o; }
function placeContent(cell, item, fit, ctx) {
  const patch = item.tpl ? { ...contentOfCell(item.tpl), rotation: 0, flipH: false, flipV: false, scale: 1, fitMode: fit || cell.fitMode } : contentPatch(item, fit || cell.fitMode);
  CONTENT_FIELDS.forEach(k => { if (!(k in patch)) delete cell[k]; });
  Object.assign(cell, withPlacementDefaults(patch), { rotation: ctx && ctx.orient === 'down' ? 180 : 0 });
}

// ── What a zone does — generators the zone can Follow (Phase 2+ fill this registry; docs/FVS.md §6c).
// ZONE_FOLLOW[id] = { label, applies(grid, idxs, ctxs) → bool, build(cells, idxs, params, rng, env) → cells (in
// place), caption(params) }. `do.follow = {id, params, seed}` runs one on the zone's cells.
export const ZONE_FOLLOW = {};

// ── The evaluator ────────────────────────────────────────────
// Cell rules on a sealed level (the Figure graph's cells hold content patches): applyClassRules()'s order and
// matching, but "filled" puts back the cell's own content (or a Seed of `do.seed`), never a bare Seed. Composition
// rules add: content: {kind, name, entry} (drop saved content into the cells), toggle (empty ↔ its content), color.
// Region rules (Phase 5b) add: symbolRule {name, params, seed, vary} — a Symbol-step rule over the region's cells only;
// arrange {rule, pool: [content…], seed, fit?} — the region gets content by an Arrange class (fit: the Symbol Arrange's Fit); pattern {patType, patSpacing,
// patWeight, patAngle} — a pattern fill (the cell's appearance patch). Seeded rules draw in cell order.
// paste {name, at: [row, col], entry: {gridModel, cells}, components} — a saved Symbol cell by cell (symbolPastePlan);
// Compose (Oct 8, 2026 — the Symbol step's Cell properties over region rules) adds: cell {fitMode, coverAxis,
// fixedSize, padding, seedParams} — the Cell properties fields a rotate / flip / scale / colour rule does not carry,
// copied onto the cell as Symbol's patchCell does (seedParams only on a Seed cell; null = back to the default shape).
// Zones (Oct 27, 2026) add: keep (the cells are locked — every later zone and Suggest leave them), empty, follow.
const CELL_KEYS = ['fitMode', 'coverAxis', 'fixedSize', 'padding', 'pad', 'seedParams', 'anchorX', 'anchorY'];   // pad = padding per side (Oct 13, 2026)
// Pure: cells in, new cells out (the input is not changed). opts.cw: the Palette's colourway, given to every Component a
// rule puts in a cell. opts.ctxs: the zone contexts if already made. → { cells, counts: [cells matched per rule] }.
export function applyZones(cellsIn, grid, rules, opts) {
  opts = opts || {};
  const cw = opts.cw, cells = cellsIn.map(c => clone(c)), own = cells.map(c => clone(c));
  const ctxs = opts.ctxs || zoneContexts(grid, null, opts.derive !== false), sctx = symbolCellContext(grid);
  const rngs = rules.map(r => { const d = r.do || {}, sd = (d.symbolRule && d.symbolRule.seed) || (d.arrange && d.arrange.seed) || (d.follow && d.follow.seed) || 0; return mulberry32(sd >>> 0); });
  const pastes = rules.map(r => r.do && r.do.paste ? new Map(symbolPastePlan(r.do.paste.entry, ctxs, r.do.paste.at)) : null);   // a Symbol put in the cells
  const kept = new Set(), counts = rules.map(() => 0);
  // Follow runs on a zone's cells as a whole (a symmetry, a walk), before the cell-by-cell pass, in zone order
  const follows = rules.map((r, ri) => {
    const f = r.do && r.do.follow, G = f && ZONE_FOLLOW[f.id];
    return !r.off && G ? { G, f, ri, idxs: zoneCells(r.when, ctxs) } : null;
  });
  cells.forEach((cell, i) => {
    rules.forEach((r, ri) => {
      if (r.off || kept.has(i) || !whenMatches(r.when || {}, ctxs[i])) return;
      counts[ri]++;
      const d = r.do || {};
      if (d.keep) { cell.locked = true; kept.add(i); return; }
      if (d.empty) { cell.source = 'empty'; return; }
      if (d.follow) {
        const F = follows[ri];
        if (F && !F.done) {
          F.done = true;
          const idxs = F.idxs.filter(k => !kept.has(k));
          F.G.build(cells, idxs, F.f.params || {}, rngs[ri], { grid, ctxs, sctx, own, cw });
        }
        return;
      }
      if (pastes[ri]) { const src = pastes[ri].get(i); if (src) { Object.assign(cell, withPlacementDefaults(clone(src))); if (cw && cell.source === 'component') cell.colourway = clone(cw); own[i] = clone(cell); } return; }
      if (d.symbolRule && SYMBOL_RULES[d.symbolRule.name]) {
        const sr = d.symbolRule, vary = { rotation: true, flip: true, scale: false, ...(sr.vary || {}) };
        const t = SYMBOL_RULES[sr.name].fn(sctx[i], sr.params || {}, rngs[ri]) || {};
        if (t.empty != null) { if (t.empty) cell.source = 'empty'; else { if (cell.source === 'empty') Object.assign(cell, { source: own[i].source === 'empty' ? 'seed' : own[i].source }); cell.rotation = t.turn || 0; } return; }
        if (vary.rotation && t.rotation != null) cell.rotation = Math.round((((t.rotation % 360) + 360) % 360) * 100) / 100;
        if (vary.flip) { if (t.flipH != null) cell.flipH = t.flipH; if (t.flipV != null) cell.flipV = t.flipV; }
        if (vary.scale && t.scale != null) cell.scale = t.scale;
        return;
      }
      if (d.arrange && (d.arrange.pool || []).length) {
        const A = SYMBOL_ARRANGE[d.arrange.rule] || SYMBOL_ARRANGE.random, pool = d.arrange.pool, k = d.arrange.rule === 'checker' ? Math.min(2, pool.length) : pool.length;
        const pick = A.cls ? pool[((A.cls(sctx[i], k) % k) + k) % k] : pool[Math.floor(rngs[ri]() * pool.length)];
        if (pick.tpl) placeContent(cell, pick, d.arrange.fit, sctx[i]);   // a content of this Symbol (Zones)
        else Object.assign(cell, withPlacementDefaults(contentPatch(pick, d.arrange.fit || cell.fitMode)), { rotation: sctx[i].orient === 'down' ? 180 : 0 });
        if (cw && cell.source === 'component') cell.colourway = clone(cw); own[i] = clone(cell);
        return;
      }
      if (d.pattern) cell.appearancePatch = { fillMode: 'pattern', patType: d.pattern.patType || 'lines', patSpacing: +d.pattern.patSpacing || 8, patWeight: +d.pattern.patWeight || 2, patAngle: d.pattern.patAngle != null ? +d.pattern.patAngle : 45 };
      if (d.content && typeof d.content === 'object' && d.content.tpl) { placeContent(cell, d.content, d.fit, sctx[i]); own[i] = clone(cell); }
      else if (d.content && typeof d.content === 'object') { const pose = { rotation: cell.rotation, flipH: cell.flipH, flipV: cell.flipV }; Object.assign(cell, withPlacementDefaults(contentPatch(d.content, cell.fitMode)), d.keepPose ? pose : {}); if (cw && cell.source === 'component') cell.colourway = clone(cw); own[i] = clone(cell); }
      else if (d.toggle) { if (cell.source === 'empty') Object.assign(cell, { source: own[i].source === 'empty' ? 'seed' : own[i].source }); else cell.source = 'empty'; }
      else if (d.content === 'empty') cell.source = 'empty';
      else if (d.content === 'filled') { Object.assign(cell, d.seed ? { source: 'seed', seedType: d.seed } : { source: own[i].source === 'empty' ? 'seed' : own[i].source }); }
      if (d.color) cell.color = d.color;
      if (d.rotate != null) cell.rotation = snapPose(d.rotate === 'sector' ? 60 * (ctxs[i].sector || 0) : d.rotate);
      if (d.flipH != null) cell.flipH = !!d.flipH;
      if (d.flipV != null) cell.flipV = !!d.flipV;
      if (d.turnBy || d.turnStep || d.turnRandom != null) cell.rotation = Math.round(((((+cell.rotation || 0) + cellTurnOf(d, ctxs[i])) % 360) + 360) % 360 * 100) / 100;   // Rotate & mirror on the cells: added to the cell's own turn, any angle (Diego: no fixed steps)
      if (d.mirror === 'v' || d.mirror === 'vh') cell.flipH = !cell.flipH;   // … and its mirror flips what the cell has
      if (d.mirror === 'h' || d.mirror === 'vh') cell.flipV = !cell.flipV;
      if (d.scale != null) cell.scale = d.scale;
      if (d.cell) CELL_KEYS.forEach(k => { if (!(k in d.cell)) return; if (k === 'seedParams' && cell.source !== 'seed') return; if (d.cell[k] == null) delete cell[k]; else cell[k] = clone(d.cell[k]); });
    });
  });
  return { cells, counts };
}

// ── Picking a part (Phase 1) ─────────────────────────────────
// Select similar, from one cell: the cells that share its row / column / ring / sector, every other one like it, the
// ones holding the same content (cellContentKey-like: Component name, or the Element's shape + settings), the border,
// the centre. → the `when` of that part (so Zone from selection keeps the part, not the cells).
export const SIMILAR_KINDS = ['row', 'col', 'ring', 'sector', 'every', 'content', 'border', 'centre'];
const contentKeyOf = c => !c || c.source === 'empty' ? 'empty' : c.source === 'component' ? 'c:' + c.componentName
  : 'e:' + JSON.stringify([c.seedType, c.seedParams || null, c.ownColors || null, c.color || null]);
export function similarWhen(i, kind, ctxs, cells) {
  const c = ctxs[i]; if (!c) return null;
  switch (kind) {
    case 'row': return { sel: 'row', k: c.row };
    case 'col': return { sel: 'col', k: c.col };
    case 'ring': return c.ring != null ? { sel: 'ring', k: c.ring } : null;
    case 'sector': return c.sector != null ? { sel: 'sector', k: c.sector } : null;
    case 'every': return { sel: 'every', by: 'checker', n: 2, phase: (c.col + c.row) % 2 };
    case 'border': return { sel: 'border' };
    case 'centre': return { sel: 'centre' };
    case 'content': { const k = contentKeyOf(cells[i]); return { index: cells.map((x, j) => (contentKeyOf(x) === k ? j : -1)).filter(j => j >= 0) }; }
    default: return null;
  }
}
// Ready-made zones from the grid's geometry — each a { key, label, when } the panel offers as a chip. Rings only where
// the grid has them; Rows / Columns only where cells have their own rows and columns.
export function readyZones(ctxs) {
  if (!ctxs.length) return [];
  const E = ctxs[0].ext, out = [];
  out.push({ key: 'border', label: 'Border', when: { sel: 'border' } });
  out.push({ key: 'centre', label: 'Centre', when: { sel: 'centre' } });
  if (!E.radial) {
    out.push({ key: 'diagonals', label: 'Diagonals', when: { sel: 'diagonal', which: 'both' } });
    ['tl', 'tr', 'bl', 'br'].forEach(q => out.push({ key: 'q-' + q, label: { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right' }[q], group: 'Quadrants', when: { sel: 'quadrant', q } }));
    out.push({ key: 'checker', label: 'Every other', when: { sel: 'every', by: 'checker', n: 2, phase: 0 } });
  } else {
    for (let k = 0; k <= E.maxRing; k++) out.push({ key: 'ring-' + k, label: 'Ring ' + (k + 1), group: 'Rings', when: { sel: 'ring', k: k === E.maxRing ? -1 : k } });
    out.push({ key: 'sectors-alt', label: 'Every other sector', when: { sel: 'every', by: 'sector', n: 2, phase: 0 } });
  }
  return out.filter(z => zoneCells(z.when, ctxs).length > 0);
}
// The lines a handle can pick: each column / row (or ring) with the mean position of its cells (grid-centred, as
// cellColRow's cx / cy) — for the handles on the canvas edge. Grids whose cells have no own rows and columns (bands of
// a hexagon / triangle grid) still get them: the bands cellColRow makes.
export function zoneLines(ctxs, geo) {
  const by = (k, axis) => {
    const m = new Map();
    ctxs.forEach((c, i) => { if (c[k] == null) return; const e = m.get(c[k]) || { k: c[k], sum: 0, n: 0 }; e.sum += geo[i][axis]; e.n++; m.set(c[k], e); });
    return [...m.values()].sort((a, b) => a.k - b.k).map(e => ({ k: e.k, at: e.sum / e.n, n: e.n }));
  };
  return { cols: by('col', 'cx'), rows: by('row', 'cy') };
}
