// Flexible Visual System · 10-suggest — Arrange + Suggest — pool, scoring, variations dock.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
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
  collectGeneratedComponents, generatedIn, suggestZoned
} from './engine/11-zones.js';
import {
  LIBRARY, isGenName, setGenComponents
} from './engine/07-library.js';
import {
  ctrl, setStatus
} from './00-core.js';
import {
  renderLibrary
} from './07-library.js';
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





// A variation drawn repeated 3 × 3 (Diego, Oct 28, 2026 — "su un insieme più grande di ripetizione"): the Symbol as a
// tile, so how it runs on at its edges shows. The Symbol once in <defs>, eight <use> — the ids inside stay unique.
function repeat3(svg, i) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), open = svg.indexOf('>') + 1, close = svg.lastIndexOf('</svg>');
  if (!m || open <= 0 || close < open) return svg;
  const w = +m[1], h = +m[2], id = 'sug-rep-' + i;
  let uses = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) uses += `<use href="#${id}" x="${c * w}" y="${r * h}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${3 * w} ${3 * h}" aria-hidden="true"><defs><g id="${id}">${svg.slice(open, close)}</g></defs>${uses}</svg>`;
}
export function renderSuggestGallery(currentIdx) {
  // the Variations sheet on the Symbol board (always open): empty, it shows its note instead
  const wrap = ctrl('fvs-sug-panel'), n = state.symbolSuggestions.length;
  ctrl('board-variations').classList.toggle('is-empty', !n);
  if (!n) { wrap.innerHTML = ''; return; }
  const prev = state.symbolCells;
  wrap.innerHTML = '';
  state.symbolSuggestions.forEach((sg, i) => {
    state.symbolCells = sg.cells;
    const svg = repeat3(buildSymbolSVG(), i);
    const btn = document.createElement('button');
    btn.className = 'fvs-suggest__item' + (i === currentIdx ? ' is-current' : '');
    btn.type = 'button';
    btn.innerHTML = svg;
    const cap = `Use variation ${i + 1}${sg.gen && sg.gen.length ? ' (uses generated)' : ''}: ${sg.label}${sg.score.edges ? ` · continuity ${Math.round(sg.score.match * 100)}%` : ''}${sg.score.structure != null ? ` · order ${Math.round(sg.score.structure * 100)}%` : ''}${sg.score.col != null ? ` · colour ${Math.round(sg.score.col * 100)}%` : ''}`;
    btn.setAttribute('aria-label', cap); btn.title = cap;
    if (sg.gen && sg.gen.length) { btn.classList.add('uses-generated'); btn.insertAdjacentHTML('beforeend', '<span class="fvs-suggest__badge">Uses generated</span>'); }
    btn.addEventListener('click', async () => {
      if (sg.gen && sg.gen.length && !(await saveGeneratedFor(sg))) return;
      rt.sugPicked = true;   // the next Suggest looks for more like this one
      state.symbolCells = sg.cells.map(c => ({ ...c }));
      if (sg.zoneDos && sg.zoneDos[0] && hooks.selectionTakeDos) hooks.selectionTakeDos(sg.zoneDos[0].dos);   // an open selection takes what this variation gave it (Oct 28, 2026)
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
  // a saved selection holds its cells (Oct 28, 2026); the selection on show is open: Suggest proposes what it could do, by
  // geometry too (suggestZoned: Symmetry, Continuity, Field, the Arrange classes). No selection: the Symbol's own turns
  // and contents, as before (⌘A opens every cell to the geometry).
  const zoneHeld = hooks.heldBySelections ? hooks.heldBySelections() : new Set();
  const openIdx = sel ? [...sel].filter(i => !zoneHeld.has(i) && !(real[i] && real[i].locked)) : [];
  const open = openIdx.length ? [{ zone: 0, idxs: openIdx, name: 'Selection' }] : [];
  const openCells = new Set(openIdx);
  const holds = (c, i) => zoneHeld.has(i) || (sel && !sel.has(i)) || (!openCells.has(i) && own.length && (L.covered[i] != null || !c || c.source === 'empty' || (c.source === 'component' && !cellContentKey(c))));
  const held = real.map(holds);
  const base = more ? candFromCells(real) : null;
  if (more && base.some((c, i) => !c && !held[i])) { runSuggest(false); return; }
  setStatus('active', 'Suggesting…');
  if (held.some(Boolean)) state.symbolCells = real.map((c, i) => (held[i] ? { ...c, locked: true } : c));
  const surprise = (+pv('rg-sug-surprise') || 0) / 100, seed = parseInt(pv('num-sug-seed'), 10) || 0;
  // Use generated components (Oct 27, 2026): the Elements' Generated components nobody saved join the pool, in memory
  // only — a variation that uses one says so, and applying it saves them (confirmed) to the Library
  const gen = ctrl('chk-sug-generated').checked ? collectGeneratedComponents() : (setGenComponents({}), []);
  const pool = own.length || gen.length ? [...own, ...gen.filter(g => !own.some(o => o.name === g.name))] : null;
  try {
    state.symbolSuggestions = more ? suggestSymbols({ base, ...(pool ? { pool } : {}) })
      : suggestZoned({ ...(pool ? { pool } : {}), open, surprise, seed });
  } finally { state.symbolCells = real; }
  state.symbolSuggestions.forEach(sg => { sg.gen = generatedIn(sg.cells); });
  state.symbolSuggestions.forEach(sg => { sg.cells = sg.cells.map((c, i) => (held[i] ? real[i] : c)); if (sel) sg.sel = true; });
  ctrl('sug-hint').textContent = [
    own.length ? `From this Symbol’s ${own.length} content${own.length === 1 ? '' : 's'}` + (own.length === 1 && !gen.length ? ' — turns and flips only.' : '.') : '',
    gen.length ? `+ ${gen.length} generated component${gen.length === 1 ? '' : 's'} not saved yet.` : '',
    sel ? `Variations of the ${sel.size} selected cell${sel.size === 1 ? '' : 's'}.` : '',
    zoneHeld.size ? `${zoneHeld.size} cells held by saved selections.` : '',
    suggestSymbols.lastNote || ''].filter(Boolean).join(' ');
  const first = state.symbolSuggestions.find(sg => !sg.gen.length);   // a variation with generated components waits for a click (and a confirm)
  if (!more && first) state.symbolCells = first.cells.map(c => ({ ...c }));   // the open zones stay open until a variation is clicked: Suggest again explores them again
  hooks.renderSymbol();
  renderSuggestGallery(more || !first ? -1 : state.symbolSuggestions.indexOf(first));   // More like this applies nothing: what it found shows on the Variations sheet
}
ctrl('fvs-sug-panel').addEventListener('wheel', e => e.stopPropagation(), { passive: true });   // scrolling the strip never zooms the sheet
['cont', 'bal', 'sur', 'col'].forEach(k => ctrl('rg-sug-' + k).addEventListener('input', e => { ctrl('v-sug-' + k).textContent = e.target.value; }));
// One Suggest (Oct 28, 2026): every click the next seed (the first is the field's, so a run can be repeated); after a
// variation was picked, more like it (was More like this)
ctrl('btn-sug-run').addEventListener('click', () => {
  const more = !!rt.sugPicked; rt.sugPicked = false;
  runSuggest(more);
  if (!more) ctrl('num-sug-seed').value = (parseInt(pv('num-sug-seed'), 10) || 0) + 1;
});
ctrl('btn-sug-more').addEventListener('click', () => runSuggest(true));
ctrl('btn-sug-seed-random').addEventListener('click', () => { ctrl('num-sug-seed').value = Math.floor(Math.random() * 1e6); runSuggest(false); });

// Applying a variation that uses generated components: say which, then save each to the Library ("Saved from Suggest"),
// under the usual "<rule> <time>" name, and point the variation's cells at the saved names. false = not applied.
export async function saveGeneratedFor(sg) {
  const gen = sg.gen || [], lib = LIBRARY.peek();
  if (Organica.confirm && !(await Organica.confirm({ title: 'Use this variation?', message: `It uses ${gen.length} generated component${gen.length === 1 ? '' : 's'}; ${gen.length === 1 ? 'it is' : 'they are'} saved to the Library in “Saved from Suggest”.`, ok: 'Use variation' }))) return false;
  const all = LIBRARY.read(), rename = {}, t = new Date().toLocaleTimeString();
  gen.forEach(key => {
    const e = lib[key]; if (!e) return;
    const label = ((e.generated && e.generated.elementName) ? e.generated.elementName + ' · ' : '') + (e.component.ruleSource || 'Component') + ' ' + t;
    let name = label, k = 2; while (all[name]) name = label + ' (' + k++ + ')';
    const { auto, generated, ...rest } = JSON.parse(JSON.stringify(e));
    all[name] = { ...rest, group: 'Saved from Suggest', savedAt: new Date().toISOString() };
    rename[key] = name;
  });
  LIBRARY.write(all);
  const fix = cells => cells.forEach(c => { if (c && c.source === 'component' && rename[c.componentName]) c.componentName = rename[c.componentName]; });
  fix(sg.cells); state.symbolSuggestions.forEach(o => { fix(o.cells); o.gen = generatedIn(o.cells); });
  renderLibrary();
  return true;
}

// Suggest › Surprise (Oct 27, 2026 — one slider for the four weights): low = continuity and order, high = surprise.
// It sets the scoring weights suggestWeights reads (their controls stay, hidden) and the MMR's λ (suggestZoned).
function syncSurprise() {
  const v = +ctrl('rg-sug-surprise').value, s = v / 100;
  ctrl('v-sug-surprise').textContent = v;
  const put = (id, x) => { ctrl(id).value = String(Math.round(x / 5) * 5); ctrl(id.replace(/^rg-/, 'v-')).textContent = ctrl(id).value; };
  put('rg-sug-cont', 90 - 60 * s); put('rg-sug-sur', 10 + 80 * s); put('rg-sug-bal', 30);
}
ctrl('rg-sug-surprise').addEventListener('input', syncSurprise);
syncSurprise();
