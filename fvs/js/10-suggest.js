// Flexible Visual System · 10-suggest — Arrange + Suggest — pool, scoring, variations dock.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import {
  pv, state
} from './engine/00-core.js';
import {
  getSymbolGrid
} from './engine/08-symbol-grid.js';
import {
  buildSymbolSVG, currentSpanLayout
} from './engine/09-symbol-render.js';
import {
  SYMBOL_ARRANGE, arrangeCells, candFromCells, cellContentKey, elementPool, poolEntries, suggestSymbols, symbolContentPool, symbolSource
} from './engine/10-suggest.js';
import {
  ctrl, setStatus
} from './00-core.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  generateSymbolCells: () => generateSymbolCells, renderSuggestGallery: () => renderSuggestGallery,
  renderSymbolPool: () => renderSymbolPool, runSuggest: () => runSuggest
});
export function generateSymbolCells() {
  const grid = getSymbolGrid();
  if (!grid) return;
  const pal = symbolSource();
  if (!pal.length) { setStatus('error', 'Save a Component or an Element first'); return; }
  state.symbolSelection.clear();
  state.symbolCells = arrangeCells(grid, state.symbolCells, pal, pv('sel-sym-arrange'),
    parseInt(pv('num-symbol-seed'), 10) || 0, pv('sel-sym-arrange-fit'));
  hooks.renderSymbol();
}

// The Symbol's pool (what Arrange / Suggest draw from) is automatic since the right-bar section was removed:
// the latest 8 saved Components (addSavedToPool), each at weight ×1. This keeps it honest — a deleted or
// renamed Component drops out — and redraws the empty state, whose Generate needs a pool.
export function renderSymbolPool() {
  state.symbolPool = poolEntries();
  if (!state.symbolGrid && state.activeTier === 'symbol') hooks.renderSymbolCanvasOnly();
}
ctrl('sel-sym-arrange').innerHTML = Object.entries(SYMBOL_ARRANGE).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');





export function renderSuggestGallery(currentIdx) {
  // the Variations sheet on the Symbol board (always open): empty, it shows its note instead
  const wrap = ctrl('fvs-sug-panel'), n = state.symbolSuggestions.length;
  ctrl('board-variations').classList.toggle('is-empty', !n);
  if (!n) { wrap.innerHTML = ''; return; }
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
    btn.addEventListener('click', () => {
      state.symbolCells = sg.cells.map(c => ({ ...c }));
      if (!sg.sel) state.symbolSelection.clear();   // variations of a selection: the selection stays, for the next run
      hooks.renderSymbol();
      wrap.querySelectorAll('.fvs-suggest__item').forEach((b, k) => b.classList.toggle('is-current', k === i));
    });
    wrap.appendChild(btn);
  });
  state.symbolCells = prev;
}
export function runSuggest(more) {
  if (!state.symbolGrid) return;
  // the Symbol's own contents (Oct 27, 2026): what its cells hold, weighted by count; none yet (an empty grid, the
  // placeholder triangles) = the library pool, as Fill the grid
  const L = currentSpanLayout(), own = symbolContentPool(state.symbolCells, L.covered);
  if (!own.length && !poolEntries().length) {
    if (elementPool().length) { generateSymbolCells(); ctrl('sug-hint').textContent = 'Suggest reads saved Components — with Elements only the cells were arranged.'; return; }
    ctrl('sug-hint').textContent = 'Add Components to the pool first (Components section above).'; return;
  }
  // held for the search and kept in every variation: the cells outside a selection (Diego, Oct 27, 2026: the variations
  // change only the selected cells), and — from the Symbol's contents — the empty cells, the cells under a block and a
  // missing Component (a hole stays a hole)
  const sel = state.symbolSelection.size ? new Set(state.symbolSelection) : null, real = state.symbolCells;
  const holds = (c, i) => (sel && !sel.has(i)) || (own.length && (L.covered[i] != null || !c || c.source === 'empty' || (c.source === 'component' && !cellContentKey(c))));
  const held = real.map(holds);
  const base = more ? candFromCells(real) : null;
  if (more && base.some((c, i) => !c && !held[i])) { runSuggest(false); return; }
  setStatus('active', 'Suggesting…');
  if (held.some(Boolean)) state.symbolCells = real.map((c, i) => (held[i] ? { ...c, locked: true } : c));
  try { state.symbolSuggestions = suggestSymbols({ ...(more ? { base } : {}), ...(own.length ? { pool: own } : {}) }); } finally { state.symbolCells = real; }
  state.symbolSuggestions.forEach(sg => { sg.cells = sg.cells.map((c, i) => (held[i] ? real[i] : c)); if (sel) sg.sel = true; });
  ctrl('sug-hint').textContent = [
    own.length ? `From this Symbol’s ${own.length} content${own.length === 1 ? '' : 's'}` + (own.length === 1 ? ' — turns and flips only.' : '.') : '',
    sel ? `Variations of the ${sel.size} selected cell${sel.size === 1 ? '' : 's'}.` : '',
    suggestSymbols.lastNote || ''].filter(Boolean).join(' ');
  if (!more && state.symbolSuggestions.length) state.symbolCells = state.symbolSuggestions[0].cells.map(c => ({ ...c }));
  hooks.renderSymbol();
  renderSuggestGallery(more ? -1 : 0);   // More like this applies nothing: what it found shows on the Variations sheet
}
ctrl('fvs-sug-panel').addEventListener('wheel', e => e.stopPropagation(), { passive: true });   // scrolling the strip never zooms the sheet
['cont', 'bal', 'sur', 'col'].forEach(k => ctrl('rg-sug-' + k).addEventListener('input', e => { ctrl('v-sug-' + k).textContent = e.target.value; }));
ctrl('btn-sug-run').addEventListener('click', () => runSuggest(false));
ctrl('btn-sug-more').addEventListener('click', () => runSuggest(true));
ctrl('btn-sug-seed-random').addEventListener('click', () => { ctrl('num-sug-seed').value = Math.floor(Math.random() * 1e6); runSuggest(false); });
