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
