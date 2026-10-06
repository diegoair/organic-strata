// Flexible Visual System · 10-suggest — Arrange + Suggest — pool, scoring, variations dock.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import {
  entryInkAt, state
} from './engine/00-core.js';
import {
  frameDims, frameSize, resolveGridCells
} from './engine/01-geometry.js';
import {
  canonicalState, mulberry32
} from './engine/03-rules.js';
import {
  buildComponentItems
} from './engine/04-appearance.js';
import {
  LIBRARY, hexKey, isPaperNone
} from './engine/07-library.js';
import {
  getSymbolGrid, polyOrient
} from './engine/08-symbol-grid.js';
import {
  componentSpanOf, polygonBoxOffset, spanBlock
} from './engine/09-symbol-render.js';
import {
  SUG_N, SYMBOL_ARRANGE, beamCandidate, candFromCells, cellsFromCand, choiceOfCell, compAnalysisCache,
  elementPool, poolEntries, recolouredAnalysis, refineTurns, scoreSymbolCandidate, suggestColourTable,
  suggestColourways, symbolCellContext, symbolSource, weightedPick
} from './engine/10-suggest.js';
import {
  ctrl, setStatus
} from './00-core.js';
import {
  withAppearance
} from './04-appearance.js';
import {
  drawComponentCanvas, withEntryInks
} from './05-render-component.js';
import {
  buildComponentSVGWithPaper
} from './07-library.js';
import {
  buildSymbolSVG, symbolLattice
} from './09-symbol-render.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  generateSymbolCells: () => generateSymbolCells, renderSuggestGallery: () => renderSuggestGallery,
  renderSymbolPool: () => renderSymbolPool, runSuggest: () => runSuggest
});
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
