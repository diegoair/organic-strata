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
  canonicalState, mulberry32
} from './03-rules.js';
import {
  seedWithLayerInks
} from './06-component-ui.js';
import {
  GEN_PREFIX, LIBRARY, entryVersionKey, isGenName, setGenComponents
} from './07-library.js';
import {
  WALLPAPER, WALLPAPER_WORDS, composePose, poseOf, rosetteMap, wallpaperMap
} from './03-symmetry.js';
import {
  signal, walkOrder, zoneUV
} from './03-drive.js';
import {
  getSymbolGrid, polyOrient, snapPose, withPlacementDefaults
} from './08-symbol-grid.js';
import {
  EMPTY_CHOICE, SYMBOL_ARRANGE, anOf, candFromCells, choiceBits, choiceOfCell, pairScore, poolEntries, scorable, scoreSymbolCandidate, statesFor,
  suggestEnv, suggestSymbols, symbolCellContext, symbolContentPool
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

// ── A selection's contents arranged (Oct 28, 2026 — Diego: "if I select a column and drop 3 components I can go to the
// sets of rules that tell me how these 3 components should be there, like checkerboard ABC ABC ABC"). The letter each
// cell of the selection takes, A = 0 … read from the selection itself: its first column / row start on A, its centre is
// the centre of Rings / Sectors / Wave. Checkerboard cycles every item (A B C / B C A); Rhythm walks the cells (Reading ·
// Snake · Spiral · Diagonal · Rings) and repeats a sequence. → Map(cell index → item index).
export const SEL_ARRANGE = ['checker', 'rows', 'columns', 'diagonal', 'blocks', 'rings', 'sectors', 'wave', 'random'];
export const SEL_WALKS = ['reading', 'snake', 'spiral', 'diagonal', 'rings'];
export const SEL_SEQS = { ABC: null, ABB: [0, 1, 1], AABB: [0, 0, 1, 1], ABCB: [0, 1, 2, 1] };
export function arrangeLetters(idxs, sctx, ctxs, n, spec, rng) {
  const out = new Map();
  if (!idxs.length || n < 1) return out;
  spec = spec || {};
  if (n === 1 || spec.rule === 'all') { idxs.forEach(i => out.set(i, 0)); return out; }
  if (spec.rule === 'rhythm') {
    const order = walkOrder(idxs, ctxs, SEL_WALKS.includes(spec.walk) ? spec.walk : 'reading');
    const seq = (SEL_SEQS[spec.seq] || null), len = seq ? seq.length : n;
    order.forEach((i, t) => out.set(i, seq ? seq[t % len] % n : t % n));
    return out;
  }
  if (spec.rule === 'random' || !SYMBOL_ARRANGE[spec.rule] || !SYMBOL_ARRANGE[spec.rule].cls) {
    const r = rng || mulberry32(1);
    idxs.forEach(i => out.set(i, Math.floor(r() * n)));
    return out;
  }
  const c0 = Math.min(...idxs.map(i => sctx[i].col)), r0 = Math.min(...idxs.map(i => sctx[i].row));
  const cx = idxs.reduce((t, i) => t + sctx[i].nx, 0) / idxs.length, cy = idxs.reduce((t, i) => t + sctx[i].ny, 0) / idxs.length;
  const hx = Math.max(1e-6, ...idxs.map(i => Math.abs(sctx[i].nx - cx))), hy = Math.max(1e-6, ...idxs.map(i => Math.abs(sctx[i].ny - cy)));
  const A = SYMBOL_ARRANGE[spec.rule];
  idxs.forEach(i => {
    const s = sctx[i], nx = (s.nx - cx) / hx, ny = (s.ny - cy) / hy;
    const local = { ...s, col: s.col - c0, row: s.row - r0, nx, ny, angle: Math.atan2(ny, nx) };
    const k = spec.rule === 'checker' ? local.col + local.row : A.cls(local, n);
    out.set(i, ((k % n) + n) % n);
  });
  return out;
}

// ── What a zone does — generators the zone can Follow (Phase 2+ fill this registry; docs/FVS.md §6c).
// ZONE_FOLLOW[id] = { label, applies(grid, idxs, ctxs) → bool, build(cells, idxs, params, rng, env) → cells (in
// place), caption(params) }. `do.follow = {id, params, seed}` runs one on the zone's cells.
export const ZONE_FOLLOW = {};
// A map {i → {rep, pose}} applied: every cell takes its representative's content, posed by the group's operation.
function applyOrbitMap(cells, M) {
  const src = new Map();
  M.forEach(m => { if (!src.has(m.rep)) src.set(m.rep, clone(cells[m.rep])); });
  M.forEach((m, i) => {
    const s = src.get(m.rep); if (!s || i === m.rep) return;
    const cell = cells[i];
    CONTENT_FIELDS.forEach(k => { delete cell[k]; });
    Object.assign(cell, contentOfCell(s));
    const p = composePose(m.pose, poseOf(s));
    cell.rotation = p.r; cell.flipH = p.f; cell.flipV = false;
  });
}
const rectLattice = (grid, idxs, ctxs) => grid && grid.cellShape === 'rect' && idxs.length >= 4 && new Set(idxs.map(i => ctxs[i].row + ',' + ctxs[i].col)).size === idxs.length;
// Symmetry › the wallpaper groups (square lattices): the zone becomes a pattern of the group on a tile of n × n cells.
ZONE_FOLLOW.wallpaper = {
  label: 'Symmetry',
  applies: rectLattice,
  space(grid, idxs, ctxs) {
    const out = [], span = k => Math.max(...idxs.map(i => ctxs[i][k])) - Math.min(...idxs.map(i => ctxs[i][k])) + 1;
    const small = Math.min(span('col'), span('row'));
    Object.keys(WALLPAPER).forEach(group => [2, 4].forEach(n => {
      if (n > small || (n === 4 && !['p4m', 'p4g', 'cmm', 'pmg', 'pgg', 'cm'].includes(group))) return;
      if (wallpaperMap(idxs, ctxs, group, n)) out.push({ group, n });
    }));
    return out;
  },
  build(cells, idxs, p, rng, env) { const M = wallpaperMap(idxs, env.ctxs, p.group, p.n); if (M) applyOrbitMap(cells, M); },
  caption: p => p.group + (p.n > 2 ? ' · tile ' + p.n : ''),
  words: p => WALLPAPER_WORDS[p.group] || '',
};
// Continuity (Phase 4) — lines and fills run on from cell to cell, across the zone and into its neighbours: a beam search
// along a walk of the zone (snake, by rows), each step scored on the shared edges with the cells already placed and the
// cells outside the zone (as they are). Content: 'keep' turns and mirrors what each cell holds; 'pool' also picks which
// content (this Symbol's own, else the saved Components). The match is the share of edge samples where ink meets ink or
// paper meets paper (the Suggest caption's continuity).
const contMemo = new Map();
function snakeOrder(idxs, ctxs) {
  return idxs.slice().sort((a, b) => (ctxs[a].row - ctxs[b].row) || ((ctxs[a].row % 2 ? -1 : 1) * (ctxs[a].col - ctxs[b].col)));
}
export function continuitySolve(cells, idxs, p, env) {
  const own = symbolContentPool(cells), pal = own.length ? own : poolEntries();
  if (!pal.length) return null;
  const E = suggestEnv(own.length ? { pool: own } : {}); if (!E) return null;
  const G = E.G, fit = E.fit, an = E.anByName, T = E.T, width = p.width || 6;
  const inZone = new Set(idxs), fixed = scorable(candFromCells(cells), an).map((ch, i) => (inZone.has(i) ? null : ch));
  const key = JSON.stringify([idxs, p, fixed.map(c => c && c.name + c.r + (c.fh ? 1 : 0))]);
  if (contMemo.has(key)) return contMemo.get(key);
  const order = snakeOrder(idxs, env.ctxs);
  const optionsAt = i => {
    const cur = choiceOfCell(cells[i]), names = p.content === 'pool' ? pal.map(x => x.name) : [cur && an[cur.name] ? cur.name : null].filter(Boolean);
    const out = [];
    names.forEach(nm => statesFor(G, i, an[nm]).forEach(([r, fh]) => out.push({ name: nm, r, fh })));
    return out;
  };
  let beam = [{ cand: fixed.slice(), s: 0 }];
  for (const i of order) {
    const opts = optionsAt(i); if (!opts.length) continue;
    const next = [];
    beam.forEach(b => opts.forEach(ch => {
      let s = 0;
      G.nbrs[i].forEach(k => {
        const pr = G.pairs[k], o = pr.i === i ? pr.j : pr.i, other = b.cand[o];
        if (!other) return;
        s += pairScore(choiceBits(G, i, ch, pr.i === i ? pr.pi : pr.pj, fit, an), choiceBits(G, o, other, pr.i === i ? pr.pj : pr.pi, fit, an), anOf(an, ch), anOf(an, other), T).s;
      });
      next.push({ b, i, ch, s: b.s + s });
    }));
    next.sort((x, y) => y.s - x.s);
    beam = next.slice(0, width).map(x => { const cand = x.b.cand.slice(); cand[x.i] = x.ch; return { cand, s: x.s }; });
  }
  // the match over the zone's edges
  let m = 0, n = 0;
  const best = beam[0].cand;
  G.pairs.forEach(pr => {
    if (!inZone.has(pr.i) && !inZone.has(pr.j)) return;
    const a = best[pr.i], b = best[pr.j]; if (!a || !b) return;
    m += pairScore(choiceBits(G, pr.i, a, pr.pi, fit, an), choiceBits(G, pr.j, b, pr.pj, fit, an), anOf(an, a), anOf(an, b), T).match; n++;
  });
  const res = { cand: best, match: n ? m / n : 1, tpls: E.tpls ? Object.fromEntries(Object.entries(E.tpls).map(([k, t]) => [k, contentOfCell(t)])) : null };   // copies: the tpl is a cell the build then changes
  if (contMemo.size > 64) contMemo.clear();
  contMemo.set(key, res);
  return res;
}
ZONE_FOLLOW.continuity = {
  label: 'Continuity',
  applies: (grid, idxs) => idxs.length >= 2,
  space: () => [{ content: 'keep' }, { content: 'pool' }],
  build(cells, idxs, p, rng, env) {
    const R = continuitySolve(cells, idxs, p, env); if (!R) return;
    idxs.forEach(i => {
      const ch = R.cand[i]; if (!ch || ch.name === EMPTY_CHOICE) return;
      const cell = cells[i], tpl = R.tpls && R.tpls[ch.name];
      if (p.content === 'pool' && (tpl || cell.componentName !== ch.name)) {
        CONTENT_FIELDS.forEach(k => { delete cell[k]; });
        Object.assign(cell, tpl ? contentOfCell(tpl) : { source: 'component', componentName: ch.name, span: false });
      }
      cell.rotation = ch.r; cell.flipH = ch.fh; cell.flipV = false;
    });
    env.notes = env.notes || {}; env.notes.continuity = R.match;
  },
  caption: p => (p.content === 'pool' ? 'Continuity · contents and turns' : 'Continuity · turns'),
  words: p => (p.content === 'pool' ? 'lines run on: picks contents and turns' : 'lines run on: turns what each cell holds'),
};
// Field (Phase 5) — a signal over the zone (a gradient, the centre, rings, noise, a photo) decides, cell by cell, which
// content (bands of the pool), the turn (quarter turns, sixths on hexagon / triangle cells), the size, or a hole.
const poolOf = cells => { const own = symbolContentPool(cells); return own.length ? own.map(p => ({ tpl: contentOfCell(p.tpl), name: p.name })) : poolEntries().map(p => ({ kind: 'component', name: p.name })); };
function putContent(cell, item) {
  CONTENT_FIELDS.forEach(k => { delete cell[k]; });
  Object.assign(cell, item.tpl ? clone(item.tpl) : { source: 'component', componentName: item.name, span: false });
}
const FIELD_SIGNALS = [{ signal: 'gradient', angle: 0 }, { signal: 'gradient', angle: 45 }, { signal: 'gradient', angle: 90 }, { signal: 'centre' }, { signal: 'rings', rings: 3 }, { signal: 'noise', seed: 1, scale: 3 }, { signal: 'noise', seed: 2, scale: 5 }];
const SIGNAL_WORDS = p => (p.signal === 'gradient' ? 'gradient ' + (p.angle || 0) + '°' : p.signal === 'centre' ? 'from the centre' : p.signal === 'rings' ? (p.rings || 3) + ' rings' : p.signal === 'noise' ? 'noise' : p.signal === 'photo' ? 'photo' : p.signal);
const DRIVE_WORDS = { content: 'which content', turn: 'the turn', scale: 'the size', empty: 'holes' };
ZONE_FOLLOW.field = {
  label: 'Field',
  applies: (grid, idxs) => idxs.length >= 4,
  space: () => FIELD_SIGNALS.flatMap(sg => ['content', 'turn', 'scale', 'empty'].map(drive => ({ ...sg, drive }))),
  build(cells, idxs, p, rng, env) {
    const uv = zoneUV(idxs, env.ctxs), pool = poolOf(cells), poly = env.grid && env.grid.cellShape === 'polygon';
    idxs.forEach(i => {
      const [u, v] = uv.get(i), L = signal(p.signal, u, v, p), cell = cells[i];
      if (p.drive === 'content' && pool.length) putContent(cell, pool[Math.min(pool.length - 1, Math.floor(L * pool.length))]);
      else if (p.drive === 'turn') { const step = poly ? 60 : 90, n = 360 / step; cell.rotation = Math.min(n - 1, Math.floor(L * n)) * step + (env.ctxs[i].orient === 'down' ? 180 : 0); }
      else if (p.drive === 'scale') cell.scale = Math.round((0.45 + 0.6 * L) * 100) / 100;
      else if (p.drive === 'empty' && L < (p.threshold != null ? p.threshold : 0.35)) cell.source = 'empty';
    });
  },
  caption: p => 'Field · ' + SIGNAL_WORDS(p) + ' → ' + (DRIVE_WORDS[p.drive] || p.drive),
  words: p => 'a ' + SIGNAL_WORDS(p) + ' decides ' + (DRIVE_WORDS[p.drive] || p.drive),
};
// Rhythm (Phase 5) — the zone walked in an order (reading, snake, spiral, rings, diagonal): step t takes the sequence's
// content (A B B …, letters = the pool in order) and a turn of t × the step.
const SEQS = ['AB', 'ABB', 'ABC', 'AABB'];
ZONE_FOLLOW.rhythm = {
  label: 'Rhythm',
  applies: (grid, idxs) => idxs.length >= 3,
  space: (grid, idxs, ctxs) => {
    const out = [], radial = idxs.some(i => ctxs[i].ring != null);
    ['snake', 'spiral', 'diagonal', 'rings'].forEach(walk => { if (radial && walk !== 'rings' && walk !== 'spiral') return; SEQS.forEach(seq => [0, 90].forEach(turn => out.push({ walk, seq, turn }))); });
    return out;
  },
  build(cells, idxs, p, rng, env) {
    const pool = poolOf(cells), order = walkOrder(idxs, env.ctxs, p.walk), seq = String(p.seq || 'AB'), poly = env.grid && env.grid.cellShape === 'polygon';
    const step = poly && p.turn ? 60 : (+p.turn || 0);
    order.forEach((i, t) => {
      const cell = cells[i], k = seq.charCodeAt(t % seq.length) - 65;
      if (pool.length) putContent(cell, pool[k % pool.length]);
      cell.rotation = (((t * step) % 360) + (env.ctxs[i].orient === 'down' ? 180 : 0)) % 360; cell.flipH = false; cell.flipV = false;
    });
  },
  caption: p => 'Rhythm · ' + p.seq.split('').join(' ') + ' · ' + p.walk + (p.turn ? ' · +' + p.turn + '°' : ''),
  words: p => p.seq.split('').join(' ') + ' along a ' + p.walk + ' walk' + (p.turn ? ', turning ' + p.turn + '° each step' : ''),
};
// Symmetry › rosettes: m-fold turns about the zone's centre (C m), with mirrors (D m) — any grid that carries them.
function centresOf(grid) {
  const geo = cellColRow(grid), pts = geo.map(g => [g.cx, g.cy]);
  const nn = pts.map((p, i) => { let d = Infinity; pts.forEach((q, j) => { if (j !== i) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1])); }); return d; }).filter(Number.isFinite).sort((a, b) => a - b);
  return { pts, tol: 0.35 * (nn[Math.floor(nn.length / 2)] || 1) };
}
ZONE_FOLLOW.rosette = {
  label: 'Symmetry',
  applies: (grid, idxs) => idxs.length >= 3,
  space(grid, idxs) {
    const { pts, tol } = centresOf(grid), out = [];
    [2, 3, 4, 6, 8].forEach(m => [false, true].forEach(mirror => { if (rosetteMap(idxs, pts, m, mirror, tol)) out.push({ m, mirror }); }));
    return out;
  },
  build(cells, idxs, p, rng, env) { const { pts, tol } = centresOf(env.grid), M = rosetteMap(idxs, pts, p.m, p.mirror, tol); if (M) applyOrbitMap(cells, M); },
  caption: p => (p.mirror ? 'D' : 'C') + p.m + ' rosette',
  words: p => p.m + (p.mirror ? ' mirrors and turns' : ' turns') + ' about the centre',
};

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
  // a selection's arrangement (arrange.local, Oct 28, 2026): the letters read from the selection's own cells
  const letters = rules.map((r, ri) => { const a = r.do && r.do.arrange; return a && a.local && (a.pool || []).length ? arrangeLetters(zoneCells(r.when, ctxs), sctx, ctxs, a.pool.length, a, mulberry32(((a.seed || 1) * 2654435761) >>> 0)) : null; });
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
        const pick = letters[ri] ? pool[letters[ri].get(i) || 0] : A.cls ? pool[((A.cls(sctx[i], k) % k) + k) % k] : pool[Math.floor(rngs[ri]() * pool.length)];
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

// ── Suggest with Zones (Phase 2) ─────────────────────────────
// Diego, Oct 27, 2026: "le variations al momento sono troppo casuali … seguendo le più complesse regole di geometria
// gli algoritmi mi suggerissero creazioni che da solo non riuscirei a vedere". A zone that Does nothing yet is *open*:
// Suggest proposes, for each open zone, what it could do — a content arranged by a rule, a pose rule, and every
// generator in ZONE_FOLLOW (symmetry, continuity, field, rhythm, as they arrive) — on top of the usual search over the
// cells no zone holds. Every candidate is the zones evaluator applied to a base (one of suggestSymbols' results), scored
// as Suggest scores (continuity, balance, surprise, colour) + a structure term, and twelve are picked by MMR so they
// differ from each other: λ·score − (1−λ)·likeness to the ones already picked, λ from Surprise.
// opts: { open: [{ zone index, idxs }], surprise 0..1, seed, pool, limit } → [{ cells, label, score, zoneDos }]
const SUG_RULES = [   // the Symbol rules a zone may take, with a few settings each
  ['rows', [{ step: 90, mode: 'alternate' }, { step: 180, mode: 'alternate' }, { step: 90, mode: 'ramp' }]],
  ['columns', [{ step: 90, mode: 'alternate' }, { step: 180, mode: 'alternate' }, { step: 90, mode: 'ramp' }]],
  ['checkerboard', [{ rotA: 0, rotB: 90, swap: false, flip: false }, { rotA: 0, rotB: 180, swap: false, flip: false }, { rotA: 90, rotB: 270, swap: false, flip: false }, { rotA: 0, rotB: 0, swap: false, flip: true }]],
  ['oscillator', [{ angle: 90, shift: 1, period: 2, phase: 0 }, { angle: 90, shift: 1, period: 3, phase: 1 }, { angle: 180, shift: 0.5, period: 4, phase: 0 }]],
  ['radial', [{ snap: true, chir: 1 }, { snap: true, chir: -1 }]],
  ['wave', [{ amp: 90, freq: 1, phase: 0, snap: true }, { amp: 180, freq: 0.5, phase: 90, snap: true }]],
];
const RULE_LABEL = { rows: 'Rows', columns: 'Columns', checkerboard: 'Checkerboard', oscillator: 'Rhythm', radial: 'Radial', wave: 'Wave', random: 'Random' };
// What an open zone could do: [{ dos: [do, …], label }] — a content (or the base's), then a pose (or the base's turns).
export function zoneOptions(grid, idxs, pal, rng, ctxs) {
  const pool = pal.map(p => (p.tpl ? { tpl: contentOfCell(p.tpl) } : { kind: 'component', name: p.name }));
  const contents = [{ d: null, label: '' }];
  Object.keys(SYMBOL_ARRANGE).forEach(id => {
    if (id === 'orientation' && !ctxs.some(c => c.orient)) return;
    if (id === 'random') return;
    contents.push({ d: { arrange: { rule: id, pool, seed: 1 + Math.floor(rng() * 99999), fit: 'contain' } }, label: SYMBOL_ARRANGE[id].label });
  });
  pal.forEach((p, k) => contents.push({ d: { content: pool[k], fit: 'contain' }, label: 'One content' }));
  const poses = [{ d: null, label: '' }];
  SUG_RULES.forEach(([name, ps]) => ps.forEach(params => poses.push({ d: { symbolRule: { name, params, seed: 1 + Math.floor(rng() * 99999), vary: { rotation: true, flip: true, scale: false } } }, label: RULE_LABEL[name] })));
  const gens = [];
  Object.entries(ZONE_FOLLOW).forEach(([id, G]) => {
    if (G.applies && !G.applies(grid, idxs, ctxs)) return;
    const space = G.space ? G.space(grid, idxs, ctxs, rng) : [{}];
    space.forEach(params => gens.push({ d: { follow: { id, params, seed: 1 + Math.floor(rng() * 99999) } }, label: G.caption ? G.caption(params) : G.label }));
  });
  const out = [];
  contents.forEach(c => poses.forEach(p => { if (c.d || p.d) out.push({ dos: [c.d, p.d].filter(Boolean), label: [c.label, p.label].filter(Boolean).join(' + ') }); }));
  gens.forEach(g => contents.forEach(c => out.push({ dos: [c.d, g.d].filter(Boolean), label: [c.label, g.label].filter(Boolean).join(' + ') })));
  return out;
}
// Order: how few distinct (content, pose) a candidate uses — 1 = one repeated cell, 0 = every cell different.
function structureOf(cand) {
  const k = new Set(cand.map(c => c.name + canonicalState({ rotation: c.r, flipH: c.fh, flipV: false, scale: 1 })));
  return cand.length > 1 ? 1 - (k.size - 1) / (cand.length - 1) : 1;
}
const likeness = (a, b) => { let same = 0; for (let i = 0; i < a.length; i++) if (a[i].name === b[i].name && a[i].r === b[i].r && a[i].fh === b[i].fh) same++; return same / Math.max(1, a.length); };
export function suggestZoned(opts = {}) {
  const env = suggestEnv(opts); if (!env) return [];
  const grid = getSymbolGrid(), ctxs = zoneContexts(grid), s = opts.surprise != null ? opts.surprise : 0.3;
  const seed = opts.seed != null ? opts.seed : 1, rng = mulberry32((seed * 7919 + 13) >>> 0);
  const bases = suggestSymbols({ ...opts, limit: opts.open && opts.open.length ? 6 : 24 });
  const scoreOf = cells => {
    const cand = scorable(candFromCells(cells), env.anByName), sc = scoreSymbolCandidate(env.G, cand, env.pal, env.W, env.fit, env.anByName, env.T);
    const st = structureOf(cand);
    return { cand, score: { ...sc, structure: st, total: 0.75 * sc.total + 0.25 * ((1 - s) * st + s * (1 - st)) } };
  };
  const pool = [];
  bases.forEach(b => pool.push({ cells: b.cells, label: b.label, zoneDos: null, ...scoreOf(b.cells) }));
  const open = (opts.open || []).filter(o => o.idxs.length);
  if (open.length) {
    const opt = open.map(o => zoneOptions(grid, o.idxs, env.pal, rng, ctxs));
    const N = Math.min(400, 60 * bases.length);
    for (let t = 0; t < N; t++) {
      const b = bases[t % bases.length]; if (!b) break;
      const pick = opt.map(list => list[Math.floor(rng() * list.length)]);
      const synth = [];
      pick.forEach((p, k) => p.dos.forEach(d => synth.push({ when: { index: open[k].idxs }, do: d })));
      const cells = applyZones(b.cells, grid, synth, { ctxs }).cells;
      pool.push({ cells, label: pick.map((p, k) => (open[k].name || 'Zone ' + (open[k].zone + 1)) + ': ' + p.label).join(' · '), zoneDos: pick.map((p, k) => ({ zone: open[k].zone, dos: p.dos })), ...scoreOf(cells) });
    }
  }
  // dedupe, then MMR
  const seen = new Set(), uniq = pool.filter(o => { const k = o.cand.map(c => c.name + ':' + c.r + (c.fh ? 'h' : '')).join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
  const lam = 0.85 - 0.5 * s, picked = [], limit = opts.limit || 12;
  while (picked.length < limit && uniq.length) {
    let bi = 0, bv = -Infinity;
    uniq.forEach((o, k) => { const sim = picked.length ? Math.max(...picked.map(p => likeness(o.cand, p.cand))) : 0; const v = lam * o.score.total - (1 - lam) * sim; if (v > bv) { bv = v; bi = k; } });
    picked.push(uniq.splice(bi, 1)[0]);
  }
  return picked.map(o => ({ cells: o.cells, label: o.label, score: o.score, zoneDos: o.zoneDos }));
}

// ── Generated components (Phase 6) ───────────────────────────
// Each Element's Generated components that are not saved (no Library entry draws the same: entryVersionKey) become
// in-memory Library entries 'gen:<element id>:<component id>' (engine/07-library setGenComponents) — the newest
// Elements first, at most `cap`. → the pool entries ({ name, weight }) Suggest adds when Use generated is on.
export function collectGeneratedComponents(cap = 16) {
  const saved = new Set(Object.entries(LIBRARY.peek() || {}).filter(([n]) => !isGenName(n)).map(([, e]) => { try { return entryVersionKey(e); } catch (err) { return null; } }));
  const out = {}, pool = [];
  (state.elements || []).slice().reverse().forEach(el => {
    const live = el.id === state.activeElement, g = el.gallery, comps = (live ? state.components : g && g.components) || [];   // the edited Element: its live gallery
    const pal = live ? { colors: state.colors, colorRule: state.colorRule, paperColor: state.paperColor } : el.palette || { colors: state.colors, colorRule: state.colorRule, paperColor: state.paperColor };
    comps.forEach(comp => {
      if (pool.length >= cap || !comp || !comp.cells || !comp.cells.length) return;
      const n = Math.round(Math.sqrt(comp.cells.length)), panel = (g && g.panel) || {};
      const cols = (comp.grid && comp.grid.cols) || +panel['rg-grid-cols'] || n, rows = (comp.grid && comp.grid.rows) || +panel['rg-grid-rows'] || Math.ceil(comp.cells.length / cols);
      const entry = { seed: seedWithLayerInks(clone(el.seed), comp.layerInks), appearance: clone(el.app || {}), grid: { kind: 'square', cols, rows, cellSize: 160, gap: 0 },
        colors: (pal.colors || []).slice(), colorRule: { ...(pal.colorRule || {}) }, paperColor: pal.paperColor || '#ffffff',
        component: { ruleSource: comp.ruleSource, cells: clone(comp.cells) }, role: 'normal', underlyingComponentName: null, auto: true,
        generated: { element: el.id, elementName: el.name, component: comp.id }, savedAt: '' };
      let key = null; try { key = entryVersionKey(entry); } catch (err) { return; }
      if (saved.has(key)) return;
      const name = GEN_PREFIX + el.id + ':' + comp.id;
      out[name] = entry; pool.push({ name, weight: 1 });
    });
  });
  setGenComponents(out);
  return pool;
}
export const generatedIn = cells => [...new Set((cells || []).filter(c => c && c.source === 'component' && isGenName(c.componentName)).map(c => c.componentName))];
