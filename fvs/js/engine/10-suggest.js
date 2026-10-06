// Flexible Visual System · engine/10-suggest — the engine part of 10-suggest.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  DEFAULT_COLOR_RULE, state
} from './00-core.js';
import {
  resolveCellPlacement
} from './01-geometry.js';
import {
  ELEMENT_LIB
} from './04-appearance.js';
import {
  buildColourways
} from './06-component-ui.js';
import {
  LIBRARY, hexKey, isPaperNone
} from './07-library.js';
import {
  polyOrient
} from './08-symbol-grid.js';
import { hooks, provide } from '../hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  symbolSource: () => symbolSource
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
// A Component saved in the Component tier joins the Symbol pool straight away —
// the pool otherwise only auto-fills on the very first Symbol visit, so anything
// saved later (after changing the Element/Component) was silently left out and
// Arrange kept building from the old set. Full pool (8): the oldest entry makes room.
export function addSavedToPool(name) {
  if (!name || state.symbolPool.some(p => p.name === name)) return;
  if (state.symbolPool.length >= 8) state.symbolPool.shift();
  state.symbolPool.push({ name, weight: 1 });
}
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
