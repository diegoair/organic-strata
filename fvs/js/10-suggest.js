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
  buildSymbolSVG
} from './engine/09-symbol-render.js';
import {
  SYMBOL_ARRANGE, arrangeCells, candFromCells, elementPool, poolEntries, suggestSymbols, symbolSource
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
      state.symbolSelection.clear();
      hooks.renderSymbol();
      wrap.querySelectorAll('.fvs-suggest__item').forEach((b, k) => b.classList.toggle('is-current', k === i));
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
  renderSuggestGallery(more ? -1 : 0);   // More like this applies nothing: what it found shows on the Variations sheet
}
ctrl('fvs-sug-panel').addEventListener('wheel', e => e.stopPropagation(), { passive: true });   // scrolling the strip never zooms the sheet
['cont', 'bal', 'sur', 'col'].forEach(k => ctrl('rg-sug-' + k).addEventListener('input', e => { ctrl('v-sug-' + k).textContent = e.target.value; }));
ctrl('btn-sug-run').addEventListener('click', () => runSuggest(false));
ctrl('btn-sug-more').addEventListener('click', () => runSuggest(true));
ctrl('btn-sug-seed-random').addEventListener('click', () => { ctrl('num-sug-seed').value = Math.floor(Math.random() * 1e6); runSuggest(false); });
