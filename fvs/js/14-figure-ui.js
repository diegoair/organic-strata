// Flexible Visual System · 14-figure-ui — Figure UI — form ↔ recipe, pipeline, history, paint tools, Play, checks.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, ctrl, state
} from './00-core.js';
import {
  SEED_TYPES
} from './01-geometry.js';
import {
  SYMBOL_SEED_DEFAULTS, getSeed
} from './02-seed-ui.js';
import {
  mulberry32
} from './03-rules.js';
import {
  buildSeedPreviewSVG
} from './05-render-component.js';
import {
  CW_MIN_CONTRAST, buildColourways, cwMetrics, cwSolve, getSelectedComponent, syncUndoUI, undoStack
} from './06-component-ui.js';
import {
  hexKey, isPaperNone
} from './07-library.js';
import {
  getSymbolGrid, lastFigureMeta
} from './08-symbol-grid.js';
import {
  buildSymbolSVG
} from './09-symbol-render.js';
import {
  setTier
} from './12-shell.js';
import {
  FIGURE_RECIPES_V1_AS_V2, figureSVGOf, hexFigureRecipes, isSealedSymbol, recursiveFigureRecipes,
  runFigureRecipe, slotClassContext, triangleFigureRecipes, validateFigureRecipe
} from './13-figure-engine.js';
import { provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  renderFigureTier: () => renderFigureTier
});
// ── Figure tier: the form, the recipe JSON, the checks, the reference overlay ──
export const FIGURE_CLASSIC_LABELS = { circle: 'Circle from four arcs', 'leaf-block': 'Leaf block 2×2', 'leaf-wave': 'Leaf wave (tiled 2×2)', 'leaf-wave-outline': 'Leaf wave, outline', 'leaf-two-ink': 'Leaf wave, two inks (4×4)', pinwheel: 'Triangle pinwheels (3×3)', kaleidoscope: 'Arc kaleidoscope' };
export const figureCatalog = () => {
  const cat = {};
  Object.entries(triangleFigureRecipes()).forEach(([k, r]) => {
    const [a, c] = k.split(':');
    cat['Triangle · ' + { sierpinski: 'Sierpinski', trapezoid: 'Trapezoid', lattice4: 'Lattice 4' }[a] + ' · ' + { asset: 'asset', repeated: 'repeated', 'mirror-1': 'mirrored, one axis', 'mirror-2': 'mirrored, two axes' }[c]] = r;
  });
  Object.entries(FIGURE_RECIPES_V1_AS_V2).forEach(([k, r]) => { cat['Classic · ' + FIGURE_CLASSIC_LABELS[k]] = { tool: 'fvs-recipe', version: 2, ...r }; });
  Object.entries(hexFigureRecipes()).forEach(([k, r]) => { cat[k] = r; });
  Object.entries(recursiveFigureRecipes()).forEach(([k, r]) => { cat[k] = r; });
  return cat;
};
export const FG_LATTICE_OF = v => /^tier(\d)$/.test(v) ? { type: 'tier', stack: +v[4] } : /^tri(\d)$/.test(v) ? { type: 'triangle', rows: +v[3] } : { type: 'square', n: +v.match(/^square(\d+)/)[1] };
export const FG_STR_OF = l => l.type === 'tier' ? 'tier' + l.stack : l.type === 'triangle' ? 'tri' + l.rows : `square${l.n}x${l.n}`;

// The rules the Advanced form can express (and re-create itself); everything else is kept as it is.
export function isFormRule(r) {
  const w = r.when || {}, d = r.do || {}, keys = Object.keys(w);
  if (r.off) return false;
  if (w.parity === 'odd' && keys.length === 1 && d.rotate != null && Object.keys(d).length === 1) return true;
  if (w.class === 'up' && keys.length === 1 && d.content === 'empty' && Object.keys(d).length === 1) return true;
  if (w.class === 'down' && keys.length === 1 && (d.content === 'empty' || (d.content === 'filled' && (d.rotate === 180 || d.rotate == null))) && Object.keys(d).length <= 2) return true;
  if (w.row != null && keys.length === 1 && d.content === 'empty' && Object.keys(d).length === 1) return true;
  if (keys.length === 0 && d.rotate === 'sector') return true;
  if (w.ring === 0 && keys.length === 1 && d.content === 'empty' && Object.keys(d).length === 1) return true;
  return false;
}
export function figureRecipeFromForm() {
  const v = id => ctrl(id).value, lat = v('fg-lattice');
  // the form shows one ink: the recipe's other inks and its colour rule are kept
  const curEl = (state.figureRecipe && state.figureRecipe.element) || {};
  const el = { type: v('fg-seed'), style: v('fg-style'), colors: [v('fg-ink'), ...(curEl.colors || []).slice(1)], paper: v('fg-paper') };
  if (curEl.colorRule) el.colorRule = { ...curEl.colorRule };
  if (el.type === 'arc') el.params = { 'rg-thickness': 100 };
  let first;
  const cur0 = state.figureRecipe && state.figureRecipe.levels[0];
  if (lat === 'adopted' && isSealedSymbol(cur0)) first = JSON.parse(JSON.stringify(cur0));   // the form can't express it: keep it whole
  else if (lat === 'component') {
    const rule = v('fg-comprule');
    const params = { checkerboard: { a: 180, b: 0 }, radial: { base: 180, chirality: 1 }, pinwheel: { base: 0, chirality: 1 }, mirror: { seed: 0 } }[rule];
    first = { kind: 'component', grid: 'square2x2', rule, params };
  } else {
    const rules = [];
    const odd = v('fg-odd'); if (odd !== 'none') rules.push({ when: { parity: 'odd' }, do: { rotate: +odd } });
    if (lat === 'hexagon') {
      if (v('fg-hexturn') === 'sector') rules.push({ when: {}, do: { rotate: 'sector', scale: 0.62 } });   // a turned shape must stay inside its hexagon
      if (ctrl('fg-hexcentre').checked) rules.push({ when: { ring: 0 }, do: { content: 'empty' } });
    }
    if (lat === 'triangle') {
      if (v('fg-up') === 'empty') rules.push({ when: { class: 'up' }, do: { content: 'empty' } });
      const d = v('fg-down');
      rules.push({ when: { class: 'down' }, do: d === 'empty' ? { content: 'empty' } : d === 'turned' ? { content: 'filled', rotate: 180 } : { content: 'filled' } });
    }
    const rows = v('fg-emptyrows').split(',').map(x => parseInt(x, 10)).filter(x => !isNaN(x));
    if (rows.length) rules.push({ when: { row: rows }, do: { content: 'empty' } });
    // rules painted on the canvas (single cells, switched-off, flips…) have no field in this form: keep them
    const cur = state.figureRecipe && state.figureRecipe.levels[0] && state.figureRecipe.levels[0].rules;
    (cur || []).filter(r => !isFormRule(r)).forEach(r => rules.push(JSON.parse(JSON.stringify(r))));
    first = { kind: 'symbol', lattice: lat === 'triangle' ? { type: 'triangle', rows: +v('fg-n') } : lat === 'hexagon' ? { type: 'hexagon', rings: +v('fg-n') } : { type: 'square', cols: +v('fg-cols'), rows: +v('fg-n') },
      fit: lat === 'triangle' ? 'fill' : 'contain', rules };
    if (ctrl('fg-liveseed').checked) first.seed = 'live';
  }
  const levels = [first];
  if (v('fg-comp') !== 'none') {
    levels.push({ kind: 'grid', lattice: FG_LATTICE_OF(v('fg-comp')), cellSize: 110, altFlip: ctrl('fg-altflip').checked });
    if (v('fg-comp2') !== 'none') levels.push({ kind: 'grid', lattice: FG_LATTICE_OF(v('fg-comp2')), cellSize: 110 });
  }
  return { tool: 'fvs-recipe', version: 2, element: el, levels, transform: { rotate: +v('fg-rot'), mirror: v('fg-mirror') } };
}
export function figureFormFromRecipe(def) {
  const set = (id, val) => { const e = ctrl(id); e.value = String(val); };
  // fg-n/fg-cols are populated with a recommended 5-8 (or 3-4 hex) range for fresh
  // authoring (syncFgNOptions), but a loaded recipe — including the built-in catalog's
  // own small triangle/hex lattices — may carry a value outside that range; inject a
  // one-off option for it rather than silently clipping to whatever's already selected.
  const setOrInject = (id, val) => { const e = ctrl(id), s = String(val); if (!e.querySelector(`option[value="${s}"]`)) e.add(new Option(s, s)); e.value = s; };
  const el = def.element, first = def.levels[0], g = def.levels[1], tr = def.transform || {};
  set('fg-seed', el.type); set('fg-style', el.style || 'fill'); set('fg-ink', hexKey((el.colors || ['#000000'])[0])); set('fg-paper', hexKey(el.paper || '#ffffff'));
  set('fg-up', 'filled'); set('fg-down', 'empty'); set('fg-emptyrows', ''); set('fg-odd', 'none'); ctrl('fg-liveseed').checked = first.seed === 'live';
  if (first.kind === 'component') { set('fg-lattice', 'component'); set('fg-comprule', first.rule || 'checkerboard'); }
  else if (isSealedSymbol(first)) set('fg-lattice', 'adopted');
  else {
    set('fg-lattice', first.lattice.type);
    syncFgNOptions();   // fg-n's option range depends on the lattice just set — repopulate before assigning its value
    setOrInject('fg-n', first.lattice.type === 'triangle' ? first.lattice.rows : first.lattice.type === 'hexagon' ? first.lattice.rings : first.lattice.rows || first.lattice.cols);
    set('fg-hexturn', 'none'); ctrl('fg-hexcentre').checked = false;
    if (first.lattice.type === 'square') setOrInject('fg-cols', first.lattice.cols);
    (first.rules || []).forEach(r => {
      if (r.off) return;   // a switched-off rule must not read back as active on the form (isFormRule agrees: r.off => false)
      const w = r.when || {}, d = r.do || {};
      if (w.parity === 'odd' && d.rotate != null) set('fg-odd', d.rotate);
      else if (d.rotate === 'sector') set('fg-hexturn', 'sector');
      else if (w.ring === 0 && d.content === 'empty') ctrl('fg-hexcentre').checked = true;
      else if (w.class === 'up' && d.content === 'empty') set('fg-up', 'empty');
      else if (w.class === 'down') set('fg-down', d.content === 'empty' ? 'empty' : d.rotate === 180 ? 'turned' : 'filled');
      else if (w.row != null && d.content === 'empty') set('fg-emptyrows', [].concat(w.row).join(','));
    });
  }
  set('fg-comp', g ? FG_STR_OF(g.lattice) : 'none'); ctrl('fg-altflip').checked = !!(g && g.altFlip);
  set('fg-comp2', def.levels[2] ? FG_STR_OF(def.levels[2].lattice) : 'none');
  set('fg-rot', tr.rotate || 0); set('fg-mirror', tr.mirror || 'none');
  syncFigureFormUI();
}
// #fg-n's range depends on the lattice: hex rings grow ~1+3n(n-1) — confirmed against
// hexLoomModel() directly (n=4→37, n=5→61 cells), not the 1+3n(n+1) estimate this
// comment originally carried (off by one ring) — so it needs its own tighter band;
// square rows and triangle rows share the flat 5-8 "Symbol" band every other picker
// uses. See CLAUDE.md session note.
export function syncFgNOptions() {
  const lat = ctrl('fg-lattice').value;
  const [lo, hi] = lat === 'hexagon' ? [4, 5] : [5, 8];
  const sel = ctrl('fg-n');
  const prev = +sel.value;
  sel.innerHTML = '';
  for (let n = lo; n <= hi; n++) sel.add(new Option(n, n, false, n === prev));
  // an existing value outside the recommended band (e.g. a loaded recipe's own small
  // triangle/hex lattice — the built-in catalog uses rows/rings well under 5) is kept
  // as a one-off extra option rather than silently clamped away; this call runs twice
  // per recipe load (figureFormFromRecipe, then syncFigureFormUI at its own end) and
  // must be idempotent either way.
  if (prev && !(prev >= lo && prev <= hi)) sel.add(new Option(prev, prev, false, true));
}
export function syncFigureFormUI() {
  syncFgNOptions();
  const lat = ctrl('fg-lattice').value;
  ctrl('fg-row-n').style.display = lat === 'component' || lat === 'adopted' ? 'none' : '';
  ctrl('fg-row-cols').style.display = lat === 'square' ? '' : 'none';
  ctrl('fg-row-comprule').style.display = lat === 'component' ? '' : 'none';
  ctrl('fg-rules-section').style.display = lat === 'component' || lat === 'adopted' ? 'none' : '';
  ctrl('fg-row-up').style.display = ctrl('fg-row-down').style.display = lat === 'triangle' ? '' : 'none';
  ctrl('fg-row-comp2').style.display = ctrl('fg-comp').value === 'none' ? 'none' : '';
  ctrl('fg-row-hexturn').style.display = ctrl('fg-row-hexcentre').style.display = lat === 'hexagon' ? '' : 'none';
  ctrl('fg-row-n').querySelector('.ctrl-label').textContent = lat === 'hexagon' ? 'Rings' : 'Rows';
}

export let figureRun = 0;
export function applyFigureRecipe(def, opts) {
  opts = opts || {};
  ctrl('fg-json-error').style.display = 'none';
  try {
    validateFigureRecipe(def);   // an invalid recipe must never become the current one
    // a figure with only a Symbol has nothing after it: work on it directly (its cells are paintable at once)
    if (opts.resetStep || !state.figureStep) state.figureStep = def.levels.length === 1 && def.levels[0].kind === 'symbol' ? 'level0' : 'final';
    if (/^level(\d+)$/.test(state.figureStep) && +state.figureStep.slice(5) >= def.levels.length) state.figureStep = 'final';
    const steps = figureStepSVGs(def);
    const svg = runFigureRecipe(def, { keepTier: true });
    state.figureRecipe = def;
    const metas = (state.figureLevelMeta || []).slice(); if (def.levels.length > 1) metas[def.levels.length - 2] = lastFigureMeta;
    state.figureShown = { def, steps, svg, metas };
    if (!opts.noHistory) pushFigureHistory(def);
    renderFigurePipeline(def, steps, svg);
    showFigureStep();
    if (!opts.fromForm) figureFormFromRecipe(def);
    ctrl('fg-json').value = JSON.stringify(def, null, 2);
    refreshFigureChecks(def, svg, ++figureRun);
  } catch (e) {
    ctrl('fg-json-error').textContent = e.message; ctrl('fg-json-error').style.display = '';
  }
}
export function renderFigureTier() {
  if (!state.figureRecipe) state.figureRecipe = figureCatalog()['Triangle · Sierpinski · asset'];
  applyFigureRecipe(state.figureRecipe);
}

// ── Pipeline strip, starting gallery, recipe history ──
// The strip shows each step's own output (Element → Symbol/Component → Grid… → Mirror/Rotate)
// as a thumbnail; a thumbnail is a truncated run of the same recipe, cached by its JSON.
export const figureStepCache = new Map();
export const figureGalleryCache = new Map();
export function capMap(m, n) { while (m.size > n) m.delete(m.keys().next().value); }
export const svgURI = svg => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
export function figureStepSVGs(def) {
  const out = [], undoLen = undoStack.length;
  try {
    def.levels.forEach((_, k) => {
      const part = { ...def, levels: def.levels.slice(0, k + 1), transform: {} }, key = JSON.stringify(part);
      if (!figureStepCache.has(key)) { figureStepCache.set(key, runFigureRecipe(part, { keepTier: true })); capMap(figureStepCache, 60); }
      out.push(figureStepCache.get(key));
    });
  } catch (e) { return null; }
  finally { undoStack.length = undoLen; syncUndoUI(); }   // the truncated runs must not touch the Component undo stack
  return out;
}
export function figureCardHTML(label, svg, extra) {
  return `<img alt="" src="${svgURI(svg)}"><span>${label}</span>${extra || ''}`;
}
export function renderFigurePipeline(def, steps, finalSVG) {
  const box = ctrl('fg-pipeline'); box.innerHTML = '';
  const cards = [{ label: 'Element', svg: buildSeedPreviewSVG(getSeed(), 0, false, false, 96), view: null }];
  def.levels.forEach((l, i) => cards.push({ label: l.kind === 'grid' ? 'Grid' : l.kind === 'symbol' ? 'Symbol' : 'Component', svg: steps ? steps[i] : finalSVG, view: steps ? steps[i] : finalSVG, level: i }));
  cards.push({ label: 'Mirror / Rotate', svg: finalSVG, view: finalSVG, final: true });
  cards.forEach((c, i) => {
    if (i) { const a = document.createElement('span'); a.className = 'fg-arrow'; a.textContent = '→'; box.appendChild(a); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fg-card'; b.setAttribute('role', 'tab');
    const id = c.final ? 'final' : c.level == null ? 'element' : 'level' + c.level;
    b.dataset.step = id;
    b.setAttribute('aria-selected', String(state.figureStep === id));
    b.innerHTML = figureCardHTML(c.label, c.svg);
    b.addEventListener('click', () => setFigureStep(id));
    if (c.level === 0) {   // the first level: a Symbol or a Component — one click to swap
      const isSym = def.levels[0].kind === 'symbol', sw = document.createElement('button'); sw.type = 'button'; sw.className = 'fg-card__sw'; sw.innerHTML = Organica.icons.get('swap', { size: 'xs' });
      sw.setAttribute('aria-label', isSym ? 'Use a Component instead' : 'Use a Symbol instead'); sw.title = sw.getAttribute('aria-label');
      sw.addEventListener('click', e => { e.stopPropagation(); figureMutate(d => { d.levels[0] = figureFirstLevelOf(isSym ? 'component' : 'triangle'); }, { resetStep: true }); });
      b.appendChild(sw);
    }
    if (c.level > 0) {   // a Grid level: removable and draggable
      const x = document.createElement('button'); x.type = 'button'; x.className = 'fg-card__x'; x.innerHTML = Organica.icons.get('close', { size: 'xs' }); x.setAttribute('aria-label', 'Remove this Grid');
      x.addEventListener('click', e => { e.stopPropagation(); const d = JSON.parse(JSON.stringify(def)); d.levels.splice(c.level, 1); applyFigureRecipe(d); });
      b.appendChild(x); b.draggable = true;
      b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(c.level)); });
      b.addEventListener('dragover', e => { e.preventDefault(); b.classList.add('dragover'); });
      b.addEventListener('dragleave', () => b.classList.remove('dragover'));
      b.addEventListener('drop', e => {
        e.preventDefault(); b.classList.remove('dragover');
        const from = +e.dataTransfer.getData('text/plain'); if (!(from > 0) || from === c.level) return;
        const d = JSON.parse(JSON.stringify(def)); const [m] = d.levels.splice(from, 1); d.levels.splice(c.level, 0, m); applyFigureRecipe(d);
      });
    }
    box.appendChild(b);
  });
  const nGrids = def.levels.length - 1;
  const add = document.createElement('button'); add.type = 'button'; add.className = 'mini-btn'; add.textContent = '+ Grid'; add.disabled = nGrids >= 3;
  add.addEventListener('click', () => {
    const d = JSON.parse(JSON.stringify(def)), t = d.levels[0].lattice && d.levels[0].lattice.type;
    d.levels.push({ kind: 'grid', lattice: t === 'triangle' ? { type: 'tier', stack: 1 } : { type: 'square', n: 2 }, cellSize: 110 });
    state.figureStep = 'level' + (d.levels.length - 1);   // the new Grid is the one to work on: its handles and types are right there
    applyFigureRecipe(d);
  });
  box.appendChild(add);
}
// History of recipes (JSON snapshots, max 50)
export const figureHistory = { stack: [], idx: -1 };
export function pushFigureHistory(def) {
  const k = JSON.stringify(def);
  if (figureHistory.stack[figureHistory.idx] === k) return;
  figureHistory.stack.length = figureHistory.idx + 1;
  figureHistory.stack.push(k);
  if (figureHistory.stack.length > 50) figureHistory.stack.shift();
  figureHistory.idx = figureHistory.stack.length - 1;
  syncFigureHistoryUI();
}
export function syncFigureHistoryUI() {
  ctrl('fg-undo').disabled = figureHistory.idx <= 0;
  ctrl('fg-redo').disabled = figureHistory.idx >= figureHistory.stack.length - 1;
}
export function figureHistoryStep(d) {
  const i = figureHistory.idx + d; if (i < 0 || i >= figureHistory.stack.length) return;
  figureHistory.idx = i; syncFigureHistoryUI();
  applyFigureRecipe(JSON.parse(figureHistory.stack[i]), { noHistory: true });
}
// Starting gallery: one thumbnail per catalog figure, computed in chunks the first time it opens.
export let galleryToken = 0;
export function closeFigureGallery() { galleryToken++; ctrl('fg-gallery').hidden = true; ctrl('fg-new').setAttribute('aria-expanded', 'false'); }
export async function openFigureGallery() {
  const g = ctrl('fg-gallery'), grid = ctrl('fg-gallery-grid'), token = ++galleryToken, cat = figureCatalog();
  g.hidden = false; ctrl('fg-new').setAttribute('aria-expanded', 'true'); grid.innerHTML = '';
  const cur = state.figureRecipe, cards = [];
  Object.keys(cat).forEach(name => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fg-card';
    b.innerHTML = `<span class="fg-thumb" style="width:80px;height:80px;display:block"></span><span>${name.replace(/^(Triangle|Classic|Hexagon|Recursive) · /, '')}</span>`;
    b.addEventListener('click', () => { closeFigureGallery(); applyFigureRecipe(JSON.parse(JSON.stringify(cat[name])), { resetStep: true }); });
    grid.appendChild(b); cards.push([name, b]);
  });
  const undoLen = undoStack.length;
  try {
    for (const [name, b] of cards) {
      if (token !== galleryToken) break;
      const key = JSON.stringify(cat[name]);
      if (!figureGalleryCache.has(key)) {
        try { figureGalleryCache.set(key, runFigureRecipe(JSON.parse(key), { keepTier: true })); capMap(figureGalleryCache, 120); } catch (e) { figureGalleryCache.set(key, ''); }
      }
      const svg = figureGalleryCache.get(key);
      if (svg) b.querySelector('.fg-thumb').outerHTML = `<img alt="" src="${svgURI(svg)}">`;
      await new Promise(r => setTimeout(r, 0));
    }
  } finally {
    undoStack.length = undoLen; syncUndoUI();
    if (cur) applyFigureRecipe(cur, { noHistory: true });   // the gallery's runs used the shared state; put the current figure back
  }
}
ctrl('fg-new').addEventListener('click', () => { if (ctrl('fg-gallery').hidden) openFigureGallery(); else closeFigureGallery(); });
ctrl('fg-gallery-close').addEventListener('click', closeFigureGallery);
ctrl('fg-gallery-ref').addEventListener('click', () => ctrl('fg-ref-file').click());
ctrl('fg-undo').addEventListener('click', () => figureHistoryStep(-1));
ctrl('fg-redo').addEventListener('click', () => figureHistoryStep(1));
document.addEventListener('keydown', e => {
  if (state.activeTier !== 'figure') return;
  if (e.key === 'Escape' && !ctrl('fg-gallery').hidden) { closeFigureGallery(); return; }
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  e.preventDefault(); figureHistoryStep(e.shiftKey ? 1 : -1);
});

// ── Figure workspace: the active step, cell tools, rule chips, the step panel ──
export const FIGURE_TOOLS = [
  ['toggle', 'Toggle', 'Click a cell to switch it between Seed and Empty'], ['seed', 'Seed', 'Fill the cell with the Seed'], ['empty', 'Empty', 'Leave the cell blank'],
  ['rotate', 'Rotate', 'Turn the cell by 90° (60° on a hexagonal lattice, 180° on a triangular one)'], ['flipH', 'Flip H', 'Mirror the cell left–right'], ['flipV', 'Flip V', 'Mirror the cell top–bottom'],
];
export const figureStepIds = def => ['element'].concat(def.levels.map((_, i) => 'level' + i), ['final']);
export function setFigureStep(id) {
  state.figureStep = id;
  document.querySelectorAll('#fg-pipeline .fg-card').forEach(c => c.setAttribute('aria-selected', String(c.dataset.step === id)));
  showFigureStep();
}
export const figurePaintable = () => !!state.figureShown && state.figureStep === 'level0' && state.figureShown.def.levels[0].kind === 'symbol' && !isSealedSymbol(state.figureShown.def.levels[0]);
export function showFigureStep() {
  const sh = state.figureShown; if (!sh) return;
  const id = state.figureStep;
  const view = id === 'element' ? buildSeedPreviewSVG(getSeed(), 0, false, false, 400) : id === 'final' ? sh.svg : ((sh.steps && sh.steps[+id.slice(5)]) || sh.svg);
  ctrl('figure-frame').innerHTML = view;
  ctrl('figure-ref-canvas').style.visibility = id === 'final' ? '' : 'hidden';
  renderFigureToolbar(); renderFigureChips(); renderFigureHandles(); renderFigureStepPanel();
}
// One edit of the recipe: copy, change, validate, redraw (the active step is kept).
export function figureMutate(fn, opts) {
  const d = JSON.parse(JSON.stringify(state.figureRecipe));
  fn(d);
  try { validateFigureRecipe(d); } catch (e) { ctrl('fg-json-error').textContent = e.message; ctrl('fg-json-error').style.display = ''; ctrl('fg-advanced').open = true; return false; }
  applyFigureRecipe(d, opts || {});
  Organica.dirty.set('fvs-figure', true);   // a hand-edited figure recipe is memory-only until its JSON is copied
  return !ctrl('fg-json-error').textContent || ctrl('fg-json-error').style.display === 'none';
}

// Painting a cell writes a Rule: a single cell → `when {index}`, Shift → the whole class of that cell.
export function figureClassWhen(ctx, lat) {
  if (lat.type === 'triangle' && ctx.orient) return { class: ctx.orient };
  if (lat.type === 'hexagon' && ctx.ring != null) return { ring: ctx.ring };
  return { parity: ctx.parity };
}
export function paintCell(def, ctx, cellState, tool, byClass) {
  const d = JSON.parse(JSON.stringify(def)), first = d.levels[0];
  if (first.kind !== 'symbol' || isSealedSymbol(first)) return d;
  const when = byClass ? figureClassWhen(ctx, first.lattice) : { index: ctx.index };
  const step = first.lattice.type === 'hexagon' ? 60 : first.lattice.type === 'triangle' ? 180 : 90;   // a triangle only fits its cell turned by 180°
  const act = {
    toggle: () => ({ content: cellState.source === 'empty' ? 'filled' : 'empty' }), seed: () => ({ content: 'filled' }), empty: () => ({ content: 'empty' }),
    rotate: () => ({ rotate: (((cellState.rotation || 0) + step) % 360 + 360) % 360 }), flipH: () => ({ flipH: !cellState.flipH }), flipV: () => ({ flipV: !cellState.flipV }),
  }[tool];
  if (!act) return d;
  const dd = act(), key = JSON.stringify(when);
  first.rules = first.rules || [];
  const same = first.rules.find(r => JSON.stringify(r.when || {}) === key);
  if (same) { same.do = { ...same.do, ...dd }; delete same.off; } else first.rules.push({ when, do: dd });
  return d;
}
export let figureStroke = null;
export function figurePaintAt(cellEl) {
  const i = +cellEl.dataset.cellIndex, grid = getSymbolGrid(); if (!grid || isNaN(i)) return;
  const ctx = slotClassContext(grid)[i], st = state.symbolCells[i]; if (!ctx || !st) return;
  const key = figureStroke.byClass ? JSON.stringify(figureClassWhen(ctx, state.figureRecipe.levels[0].lattice)) : 'i' + i;
  if (figureStroke.seen.has(key)) return;
  figureStroke.seen.add(key);
  const d = paintCell(state.figureRecipe, ctx, st, state.figureTool || 'toggle', figureStroke.byClass);
  state.figureRecipe = d;
  try { runFigureRecipe(d, { keepTier: true }); ctrl('figure-frame').innerHTML = buildSymbolSVG(); } catch (e) { /* the full redraw at the end reports it */ }
}
export function figureEndStroke() {
  if (!figureStroke) return;
  figureStroke = null;
  applyFigureRecipe(state.figureRecipe, {});   // one full redraw and ONE history entry for the whole gesture
}
(function initFigureCanvasTools() {
  const fr = ctrl('figure-frame');
  fr.addEventListener('pointerdown', e => {
    if (!figurePaintable() || e.button !== 0) return;
    const c = e.target.closest && e.target.closest('[data-cell-index]'); if (!c) return;
    e.preventDefault();
    figureStroke = { byClass: e.shiftKey, seen: new Set() };
    figurePaintAt(c);
  });
  fr.addEventListener('pointermove', e => {
    if (!figureStroke) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest && el.closest('#figure-frame [data-cell-index]');
    if (c) figurePaintAt(c);
  });
  window.addEventListener('pointerup', figureEndStroke);
  window.addEventListener('pointercancel', figureEndStroke);
})();

export function renderFigureToolbar() {
  const tb = ctrl('fg-toolbar'); tb.innerHTML = '';
  if (!state.figureShown) return;
  const add = (cls, html) => { const g = document.createElement('span'); g.className = cls; g.innerHTML = html; tb.appendChild(g); return g; };
  if (figurePaintable()) {
    const g = add('fg-group', '<span class="fg-label">Cells</span>');
    FIGURE_TOOLS.forEach(([id, label, hint], k) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mini-btn'; b.textContent = label; b.title = `${hint} (${k + 1})`;
      b.setAttribute('aria-pressed', String((state.figureTool || 'toggle') === id)); b.dataset.tool = id;
      b.addEventListener('click', () => { state.figureTool = id; renderFigureToolbar(); });
      g.appendChild(b);
    });
    add('fg-label', 'Click or drag to paint · Shift = the whole class of the cell');
  } else {
    const def = state.figureShown.def, lv = state.figureStep.startsWith('level') ? def.levels[+state.figureStep.slice(5)] : null;
    let hint = '';
    if (state.figureStep === 'element') hint = 'The Element is the Seed every cell starts from.';
    else if (state.figureStep === 'final') hint = def.levels.length > 1 ? 'Hover the edges of the figure: click the right or bottom edge to Mirror, the corner to Rotate (M / R).' : 'Add a Grid to Mirror or Rotate the figure.';
    else if (lv && lv.kind === 'grid') hint = 'Hover the edges of the figure: click the right or bottom edge to Mirror this Grid, the corner to Rotate it.';
    else if (lv && lv.kind === 'component') hint = 'Component rules are in the panel on the right.';
    else if (lv && isSealedSymbol(lv)) hint = 'Adopted from the Symbol step.';
    if (hint) add('fg-label', hint);
  }
  renderFigurePlay(tb);
}

// ── Play: variations, shuffle with locks ──
// A mutation changes one thing in one of five groups; shuffle and variations are built from them, always
// through validateFigureRecipe, so every result is a valid recipe.
export const FG_LOCK_GROUPS = [['element', 'Element'], ['symbol', 'Symbol'], ['rules', 'Rules'], ['grid', 'Grid'], ['transform', 'Mirror / Rotate']];
export const FG_SEED_POOL = ['triangle', 'arc', 'star', 'polygon', 'blob', 'chevron', 'cross', 'lens', 'roundedrect', 'drop', 'circle', 'wedge'];
// Colour moves come from colour theory, not a fixed list: a hue turned by a harmony
// angle (OKLCH, lightness and chroma kept), a colourway of the recipe's own palette
// (COLOUR_SCHEMES — its shade scales), another colour rule. Each result is solved
// against the paper (cwSolve), so an ink never ends up unreadable.
export const FG_HUE_TURNS = [30, -30, 60, -60, 120, -120, 180];   // analogous · split · triadic · complementary
export const fgBaseColours = d => ({ colors: (d.element.colors && d.element.colors.length ? d.element.colors : ['#000000']).map(hexKey), paper: d.element.paper ? hexKey(d.element.paper) : '#ffffff', colorRule: { ...DEFAULT_COLOR_RULE, ...(d.element.colorRule || {}) } });
export const fgPick = (a, rng) => a[Math.floor(rng() * a.length)];
export function fgLastGridTransform(d) {
  const g = d.levels.length - 1; if (g < 1) return null;
  return d.levels[g].transform ? d.levels[g].transform : (d.transform = d.transform || {});
}
export function fgSymbol(d) { return d.levels[0].kind === 'symbol' && !isSealedSymbol(d.levels[0]) ? d.levels[0] : null; }
export const FIGURE_MUTATIONS = [
  { group: 'element', name: 'Other Seed', fn: (d, rng) => { const cur = d.element.type, t = fgPick(FG_SEED_POOL.filter(x => x !== cur), rng); d.element.type = t; if (t === 'arc') d.element.params = { 'rg-thickness': 100 }; else delete d.element.params; delete d.element.strokeW; if (d.element.style === 'stroke') d.element.strokeW = 4; return true; } },
  { group: 'element', name: 'Other hue', fn: (d, rng) => {
      const C = Organica.color, b = fgBaseColours(d), turn = fgPick(FG_HUE_TURNS, rng), grey = Math.round(rng() * 12) * 30;
      const turned = b.colors.map(h => { const o = C.hexToOklch(h); return o.c < 0.03 ? C.oklchToHex(Math.min(0.7, Math.max(0.5, o.l)), 0.16, grey) : C.oklchToHex(o.l, o.c, (o.h + turn + 360) % 360); });   // a grey has no hue to turn: it is given one
      const solved = cwSolve(turned, b.paper);
      if (!solved) return false;
      d.element.colors = solved; return true; } },
  { group: 'element', name: 'Other colourway', fn: (d, rng) => {
      const b = fgBaseColours(d), all = buildColourways(b, null, 0).slice(1);
      const same = all.filter(cw => cw.colors.length === b.colors.length), pool = same.length ? same : all;   // keep the number of inks when a scheme allows it
      if (!pool.length) return false;
      const cw = fgPick(pool, rng);
      d.element.colors = cw.colors.slice(); d.element.paper = cw.paper; return true; } },
  { group: 'element', name: 'Other colour rule', fn: (d, rng) => {
      const b = fgBaseColours(d);
      if (b.colors.length < 2) return false;
      d.element.colorRule = { mode: fgPick(Object.keys(COLOR_RULES).filter(m => m !== b.colorRule.mode && m !== 'own'), rng), offset: b.colorRule.offset || 0 }; return true; } },
  { group: 'element', name: 'Fill ↔ Stroke', fn: d => { if (d.element.style === 'stroke') { d.element.style = 'fill'; delete d.element.strokeW; } else { d.element.style = 'stroke'; d.element.strokeW = 4; } return true; } },
  { group: 'symbol', name: 'Bigger / smaller layout', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; const l = s2.lattice, key = l.type === 'triangle' ? 'rows' : l.type === 'hexagon' ? 'rings' : 'cols', lo = l.type === 'hexagon' ? 1 : 2, hi = l.type === 'hexagon' ? 3 : l.type === 'triangle' ? 5 : 4; const v = l[key] + (rng() < 0.5 ? -1 : 1); if (v < lo || v > hi) return false; l[key] = v; if (l.type === 'square') l.rows = v; return true; } },
  { group: 'rules', name: 'Toggle a class', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; s2.rules = s2.rules || []; const l = s2.lattice;
      if (l.type === 'triangle') { const r = s2.rules.find(x => x.when && x.when.class === 'down'); if (r) { r.do = r.do.content === 'empty' ? { content: 'filled', rotate: 180 } : { content: 'empty' }; } else s2.rules.push({ when: { class: 'down' }, do: { content: 'empty' } }); return true; }
      if (l.type === 'hexagon') { const i = s2.rules.findIndex(x => x.when && x.when.ring === 0); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: { ring: 0 }, do: { content: 'empty' } }); return true; }
      const i = s2.rules.findIndex(x => x.when && x.when.parity === 'odd' && x.do.content); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: { parity: 'odd' }, do: { content: 'empty' } }); return true; } },
  { group: 'rules', name: 'Empty a row', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; const l = s2.lattice, n = l.type === 'triangle' ? l.rows : l.type === 'hexagon' ? 2 * l.rings - 1 : (l.rows || l.cols); const row = Math.floor(rng() * n); s2.rules = s2.rules || [];
      if (s2.rules.some(x => x.when && x.when.row != null && [].concat(x.when.row).includes(row))) return false; s2.rules.push({ when: { row: [row] }, do: { content: 'empty' } }); return true; } },
  { group: 'rules', name: 'Turn cells', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; s2.rules = s2.rules || []; const l = s2.lattice;
      if (l.type === 'hexagon') { const i = s2.rules.findIndex(x => x.do && x.do.rotate === 'sector'); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: {}, do: { rotate: 'sector', scale: 0.62 } }); return true; }
      const i = s2.rules.findIndex(x => x.when && x.when.parity === 'odd' && x.do && x.do.rotate != null); const deg = l.type === 'triangle' ? 180 : fgPick([90, 180, 270], rng); if (i >= 0) s2.rules[i].do.rotate = deg; else s2.rules.push({ when: { parity: 'odd' }, do: { rotate: deg } }); return true; } },
  { group: 'rules', name: 'Flip cells', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2) return false; s2.rules = s2.rules || []; const i = s2.rules.findIndex(x => x.when && x.when.parity === 'odd' && x.do && x.do.flipH != null); if (i >= 0) s2.rules.splice(i, 1); else s2.rules.push({ when: { parity: 'odd' }, do: { flipH: true } }); return true; } },
  { group: 'rules', name: 'Drop a rule', fn: (d, rng) => { const s2 = fgSymbol(d); if (!s2 || !(s2.rules || []).length) return false; s2.rules.splice(Math.floor(rng() * s2.rules.length), 1); return true; } },
  { group: 'grid', name: 'Other Grid', fn: (d, rng) => { const g = d.levels.length - 1; const types = FG_GRID_TYPES.map(x => x[0]); if (g < 1) { d.levels.push({ kind: 'grid', lattice: FG_LATTICE_OF(fgPick(types, rng)), cellSize: 110 }); return true; }
      const cur = FG_STR_OF(d.levels[g].lattice); d.levels[g].lattice = FG_LATTICE_OF(fgPick(types.filter(x => x !== cur), rng)); return true; } },
  { group: 'grid', name: 'Add a Grid', fn: (d, rng) => { if (d.levels.length >= 4) return false; d.levels.push({ kind: 'grid', lattice: FG_LATTICE_OF(fgPick(['tier1', 'tri2', 'square2x2'], rng)), cellSize: 110 }); return true; } },
  { group: 'grid', name: 'Remove a Grid', fn: d => { if (d.levels.length < 2) return false; d.levels.pop(); return true; } },
  { group: 'transform', name: 'Rotate', fn: d => { const t = fgLastGridTransform(d); if (!t) return false; applyHandle(t, 'rotate'); return true; } },
  { group: 'transform', name: 'Mirror', fn: (d, rng) => { const t = fgLastGridTransform(d); if (!t) return false; const cur = t.mirror || 'none'; t.mirror = fgPick(['none', 'v', 'h', 'vh'].filter(x => x !== cur), rng); return true; } },
];
export function figureMutateOnce(def, mut, rng) {
  const d = JSON.parse(JSON.stringify(def));
  try { if (!mut.fn(d, rng)) return null; validateFigureRecipe(d); } catch (e) { return null; }
  return JSON.stringify(d) === JSON.stringify(def) ? null : d;
}
// Up to `count` different recipes, each one mutation away from `def`. Deterministic for a given seed.
export function figureNeighbours(def, seed, count) {
  count = count || 9;
  const rng = mulberry32(seed >>> 0), order = FIGURE_MUTATIONS.map((m, i) => [rng(), i]).sort((a, b) => a[0] - b[0]).map(x => FIGURE_MUTATIONS[x[1]]);
  const out = [], seen = new Set([JSON.stringify(def)]);
  for (let pass = 0; pass < 4 && out.length < count; pass++) for (const m of order) {
    if (out.length >= count) break;
    const d = figureMutateOnce(def, m, rng); if (!d) continue;
    const k = JSON.stringify(d); if (seen.has(k)) continue; seen.add(k); out.push({ recipe: d, label: m.name });
  }
  return out;
}
// One to three mutations of groups that are not locked; null when everything is locked.
export function figureShuffle(def, locks, seed) {
  const rng = mulberry32(seed >>> 0), pool = FIGURE_MUTATIONS.filter(m => !(locks && locks[m.group]));
  if (!pool.length) return null;
  // A later mutation can undo an earlier one (Fill ↔ Stroke twice, Add then Remove a Grid) — a step
  // that lands back on `def` is rejected, so a shuffle always changes something.
  const start = JSON.stringify(def);
  let d = def, changed = 0; const want = 1 + Math.floor(rng() * 3);
  for (let tries = 0; tries < 30 && changed < want; tries++) { const n = figureMutateOnce(d, fgPick(pool, rng), rng); if (n && JSON.stringify(n) !== start) { d = n; changed++; } }
  return changed ? d : null;
}
export function figureShuffleNow() {
  if (!state.figureRecipe) return;
  const locks = state.figureLocks || {};
  for (let attempt = 0; attempt < 8; attempt++) {
    const d = figureShuffle(state.figureRecipe, locks, Math.floor(Math.random() * 1e9)); if (!d) { renderFigureToolbar(); return; }
    try { runFigureRecipe(JSON.parse(JSON.stringify(d)), { keepTier: true }); } catch (e) { continue; }   // a shuffle must land on something drawable
    applyFigureRecipe(d, {}); return;
  }
}
export function renderFigurePlay(tb) {
  const locks = state.figureLocks = state.figureLocks || {};
  const g = document.createElement('span'); g.className = 'fg-group';
  const btn = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mini-btn'; b.textContent = label; b.title = title; b.addEventListener('click', fn); g.appendChild(b); return b; };
  btn('Shuffle', 'Change something at random, keeping what is locked (Space)', figureShuffleNow);
  btn('Variations', 'A grid of nearby figures to pick from (V)', () => openFigureVariations(false));
  tb.appendChild(g);
  const l = document.createElement('span'); l.className = 'fg-group'; l.innerHTML = '<span class="fg-label">Lock</span>';
  FG_LOCK_GROUPS.forEach(([k, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mini-btn'; b.textContent = label; b.title = 'Shuffle and Variations leave this alone';
    b.setAttribute('aria-pressed', String(!!locks[k])); b.addEventListener('click', () => { locks[k] = !locks[k]; renderFigureToolbar(); }); l.appendChild(b); });
  tb.appendChild(l);
}
export let figureVarToken = 0, figureVarSeed = 1;
export function closeFigureVariations() { figureVarToken++; ctrl('fg-variations').hidden = true; }
export async function openFigureVariations(more) {
  const cur = state.figureRecipe; if (!cur) return;
  if (more) figureVarSeed++; else figureVarSeed = Math.floor(Math.random() * 1e6);
  const grid = ctrl('fg-var-grid'), token = ++figureVarToken;
  ctrl('fg-gallery').hidden = true; ctrl('fg-variations').hidden = false; grid.innerHTML = '';
  const locks = state.figureLocks || {};
  const cands = figureNeighbours(cur, figureVarSeed, 14).filter(c => { const m = FIGURE_MUTATIONS.find(x => x.name === c.label); return !(m && locks[m.group]); }).slice(0, 12);
  const undoLen = undoStack.length; let shown = 0;
  try {
    for (const c of cands) {
      if (token !== figureVarToken || shown >= 9) break;
      let svg; try { svg = runFigureRecipe(JSON.parse(JSON.stringify(c.recipe)), { keepTier: true }); } catch (e) { continue; }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'fg-card';
      b.innerHTML = `<img alt="" src="${svgURI(svg)}"><span>${c.label}</span>`;
      b.addEventListener('click', () => { closeFigureVariations(); applyFigureRecipe(c.recipe, { resetStep: true }); });
      grid.appendChild(b); shown++;
      await new Promise(r => setTimeout(r, 0));
    }
  } finally { undoStack.length = undoLen; syncUndoUI(); applyFigureRecipe(cur, { noHistory: true }); }
  if (!shown) grid.textContent = 'Nothing nearby that is not locked — unlock a group and try again.';
}
ctrl('fg-var-close').addEventListener('click', closeFigureVariations);
ctrl('fg-var-more').addEventListener('click', () => openFigureVariations(true));
export function figureNudgeSize(dir) {
  figureMutate(d => { const s2 = fgSymbol(d); if (!s2) return; const l = s2.lattice, key = l.type === 'triangle' ? 'rows' : l.type === 'hexagon' ? 'rings' : 'cols', lo = l.type === 'hexagon' ? 1 : 2, hi = l.type === 'hexagon' ? 4 : 6; l[key] = Math.max(lo, Math.min(hi, l[key] + dir)); if (l.type === 'square') l.rows = l[key]; });
}
document.addEventListener('keydown', e => {
  if (state.activeTier !== 'figure' || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
  if (e.key === 'Escape' && !ctrl('fg-variations').hidden) { closeFigureVariations(); return; }
  if (!ctrl('fg-gallery').hidden || !ctrl('fg-variations').hidden) return;
  if (e.key === ' ') { e.preventDefault(); figureShuffleNow(); }
  else if (e.key === 'v' || e.key === 'V') openFigureVariations(false);
  else if (e.key === '[') figureNudgeSize(-1);
  else if (e.key === ']') figureNudgeSize(1);
});

// Rule chips
export function describeRule(r) {
  const w = r.when || {}, d = r.do || {}, parts = [];
  if (w.class != null) parts.push([].concat(w.class).join('/') + ' cells');
  if (w.ring != null) parts.push('ring ' + [].concat(w.ring).join('/'));
  if (w.sector != null) parts.push('sector ' + [].concat(w.sector).join('/'));
  if (w.row != null) parts.push('row ' + [].concat(w.row).map(x => x + 1).join('/'));
  if (w.col != null) parts.push('column ' + [].concat(w.col).map(x => x + 1).join('/'));
  if (w.index != null) parts.push('cell ' + [].concat(w.index).map(x => x + 1).join('/'));
  if (w.parity != null) parts.push(w.parity + ' cells');
  const what = [];
  if (d.content === 'empty') what.push('Empty'); if (d.content === 'filled') what.push('Seed');
  if (d.rotate != null) what.push(d.rotate === 'sector' ? 'Rotate by sector' : 'Rotate ' + d.rotate + '°');
  if (d.flipH != null) what.push(d.flipH ? 'Flip H' : 'Unflip H'); if (d.flipV != null) what.push(d.flipV ? 'Flip V' : 'Unflip V');
  if (d.scale != null) what.push('Scale ' + Math.round(d.scale * 100) + '%');
  return (parts.length ? parts.join(' + ') : 'all cells') + ' → ' + (what.join(', ') || '—');
}
export function renderFigureChips() {
  const box = ctrl('fg-chips'); box.innerHTML = '';
  if (!figurePaintable()) return;
  const rules = state.figureShown.def.levels[0].rules || [];
  if (!rules.length) { const h = document.createElement('span'); h.className = 'fg-label'; h.textContent = 'No rules yet — click a cell to make one.'; box.appendChild(h); return; }
  rules.forEach((r, i) => {
    const c = document.createElement('span'); c.className = 'fg-chip'; c.setAttribute('role', 'listitem'); c.dataset.off = String(!!r.off);
    c.innerHTML = `<span class="fg-chip__text">${describeRule(r)}</span>`;
    const btn = (icon, title, fn, disabled, pressed) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = Organica.icons.get(icon, { size: 'xs' }); if (pressed != null) b.setAttribute('aria-pressed', String(pressed)); b.title = title; b.setAttribute('aria-label', title); b.disabled = !!disabled; b.addEventListener('click', fn); c.appendChild(b); };
    const edit = fn => () => figureMutate(d => fn(d.levels[0].rules));
    btn(r.off ? 'eye-off' : 'eye', r.off ? 'Switch this rule on' : 'Switch this rule off', edit(rs => { if (rs[i].off) delete rs[i].off; else rs[i].off = true; }), false, !r.off);
    btn('arrow-up', 'Earlier (rules apply in order; later ones win)', edit(rs => { [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]]; }), i === 0);
    btn('arrow-down', 'Later', edit(rs => { [rs[i + 1], rs[i]] = [rs[i], rs[i + 1]]; }), i === rules.length - 1);
    btn('close', 'Delete this rule', edit(rs => { rs.splice(i, 1); }));
    box.appendChild(c);
  });
}
// Edge handles: the right edge mirrors over it, the bottom edge mirrors over it, the corner rotates.
export function figureHandleTarget() {
  const sh = state.figureShown; if (!sh || sh.def.levels.length < 2) return -1;
  if (state.figureStep === 'final') return sh.def.levels.length - 1;
  if (state.figureStep.startsWith('level')) { const k = +state.figureStep.slice(5); return sh.def.levels[k] && sh.def.levels[k].kind === 'grid' ? k : -1; }
  return -1;
}
export function renderFigureHandles() {
  const h = ctrl('fg-handles'); h.style.display = 'none'; h.innerHTML = '';
  const L = figureHandleTarget(); if (L < 1) return;
  const m = state.figureShown.metas[L - 1]; if (!m || !m.box || !m.size) return;
  const { x0, y0, x1, y1 } = m.box, S = m.size, t = S * 0.04, NS = 'http://www.w3.org/2000/svg';
  h.setAttribute('viewBox', `0 0 ${S} ${S}`);
  const mk = (tag, attrs, title) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (title) { const tt = document.createElementNS(NS, 'title'); tt.textContent = title; e.appendChild(tt); } h.appendChild(e); return e; };
  const icon = (cx, cy, glyph) => { const e = document.createElementNS(NS, 'text'); e.setAttribute('class', 'fg-handle-icon'); e.setAttribute('x', cx); e.setAttribute('y', cy); e.setAttribute('font-size', t * 1.8); e.textContent = glyph; h.appendChild(e); };
  mk('rect', { class: 'fg-box', x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  mk('rect', { 'data-handle': 'mirror-v', x: x1 - t / 2, y: y0, width: t, height: y1 - y0 }, 'Mirror over the right edge (M)');
  icon(x1, (y0 + y1) / 2, '⇔');
  mk('rect', { 'data-handle': 'mirror-h', x: x0, y: y1 - t / 2, width: x1 - x0, height: t }, 'Mirror over the bottom edge (Shift+M)');
  icon((x0 + x1) / 2, y1, '⇕');
  mk('circle', { 'data-handle': 'rotate', cx: x1, cy: y0, r: t * 1.6 }, 'Rotate 90° (R)');
  icon(x1, y0, '⟳');
  h.style.display = 'block';
}
// Pure: how a handle changes a transform {rotate, mirror}
export function applyHandle(t, kind) {
  const cur = t.mirror || 'none', hasV = cur === 'v' || cur === 'vh', hasH = cur === 'h' || cur === 'vh';
  if (kind === 'mirror-v') t.mirror = hasV ? (hasH ? 'h' : 'none') : (hasH ? 'vh' : 'v');
  else if (kind === 'mirror-h') t.mirror = hasH ? (hasV ? 'v' : 'none') : (hasV ? 'vh' : 'h');
  else if (kind === 'rotate') t.rotate = (((t.rotate || 0) + 90) % 360);
  return t;
}
export function figureHandleAction(kind) {
  const L = figureHandleTarget(); if (L < 1) return;
  state.figureStep = 'final';   // show what the handle just changed, not the level's own pre-transform view
  figureMutate(d => {
    const g = d.levels[L], last = L === d.levels.length - 1;
    const t = g.transform ? g.transform : (last ? (d.transform = d.transform || {}) : (g.transform = {}));
    applyHandle(t, kind);
  });
}
ctrl('fg-handles').addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-handle]'); if (el) figureHandleAction(el.dataset.handle); });

// The step panel: the few parameters of whichever step is active
export const FG_SEEDS = ['triangle', 'arc', 'arctruchet', 'wedge', 'polygon', 'star', 'roundedrect', 'chevron', 'cross', 'lens', 'circle', 'drop', 'blob'];
export const FG_ICONS = {
  triangle: '<path d="M20 5 L5 33 H35 Z M12.5 19 H27.5 M20 33 L12.5 19 M20 33 L27.5 19"/>',
  square: '<rect x="6" y="6" width="28" height="28"/><path d="M20 6V34M6 20H34"/>',
  hexagon: '<path d="M20 4 L34 12 V28 L20 36 L6 28 V12 Z M20 4V36 M6 12L34 28 M34 12L6 28"/>',
  component: '<rect x="6" y="6" width="28" height="28"/><path d="M20 6V34M6 20H34"/><circle cx="20" cy="20" r="8"/>',
  tier1: '<path d="M11 12 H29 L37 30 H3 Z M11 12 L20 30 L29 12"/>',
  tier2: '<path d="M13 4H27L34 16H6Z M13 4L20 16L27 4 M10 22H30L38 36H2Z M10 22L20 36L30 22"/>',
  tri2: '<path d="M20 5 L5 33 H35 Z M12.5 19 H27.5 M20 33 L12.5 19 M20 33 L27.5 19"/>',
  tri3: '<path d="M20 5 L5 33 H35 Z M15 14 H25 M10 24 H30 M20 33 L10 24 M20 33 L30 24 M15 14 L20 24 M25 14 L20 24"/>',
  square2x2: '<rect x="6" y="6" width="28" height="28"/><path d="M20 6V34M6 20H34"/>',
  square3x3: '<rect x="6" y="6" width="28" height="28"/><path d="M15.3 6V34M24.7 6V34M6 15.3H34M6 24.7H34"/>',
};
export const FG_GRID_TYPES = [['tier1', 'Tier'], ['tier2', 'Tier ×2'], ['tri2', 'Triangle 2'], ['tri3', 'Triangle 3'], ['square2x2', 'Square 2×2'], ['square3x3', 'Square 3×3']];
// The two or three settings of each Seed that change it most (control id → label); ranges come from the controls themselves.
export const FG_SEED_MAIN = {
  triangle: [['rg-tri-apex', 'Apex'], ['rg-tri-corner', 'Rounding']], arc: [['rg-thickness', 'Thickness'], ['rg-arc-sweep', 'Sweep']],
  arctruchet: [['rg-arc-count', 'Bands'], ['rg-arc-ratio', 'Thickness']], wedge: [['rg-wedge-angle', 'Angle'], ['rg-wedge-inner', 'Hole']],
  polygon: [['rg-poly-sides', 'Sides'], ['rg-poly-corner', 'Rounding']], star: [['rg-star-points', 'Points'], ['rg-star-inner', 'Inner radius']],
  roundedrect: [['rg-rr-width', 'Width'], ['rg-rr-corner', 'Rounding']], chevron: [['rg-chev-notch', 'Notch'], ['rg-chev-arm', 'Thickness']],
  cross: [['rg-cross-armwidth', 'Thickness'], ['rg-cross-corner', 'Rounding']], lens: [['rg-lens-width', 'Width']],
  circle: [['rg-circle-radius', 'Radius'], ['rg-circle-lobes', 'Lobes']], drop: [['rg-drop-radius', 'Size'], ['rg-drop-tail', 'Tail']],
  blob: [['rg-blob-amount', 'Wobble'], ['rg-blob-seed', 'Variation']],
};
// A fresh first level: a Component block or a Symbol on a triangle / square / hexagon lattice.
// Row/ring/col defaults match the Symbol size ladder's own lower bound (5 for
// triangle/square, 4 rings for hexagon — hexLoomModel(4) = 37 cells, confirmed live;
// Component stays its own 1-4 tier, untouched). See CLAUDE.md session note.
export function figureFirstLevelOf(v) {
  return v === 'component' ? { kind: 'component', grid: 'square2x2', rule: 'checkerboard', params: { a: 180, b: 0 } }
    : { kind: 'symbol', lattice: v === 'triangle' ? { type: 'triangle', rows: 5 } : v === 'hexagon' ? { type: 'hexagon', rings: 4 } : { type: 'square', cols: 5, rows: 5 }, fit: v === 'triangle' ? 'fill' : 'contain', rules: [] };
}
export function figureThumb(label, svgInner, pressed, onClick, raw) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'fg-thumb'; b.title = label; b.setAttribute('aria-pressed', String(!!pressed));
  b.innerHTML = (raw ? raw : `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${svgInner}</svg>`) + `<span>${label}</span>`;
  b.addEventListener('click', onClick); return b;
}
export function renderFigureStepPanel() {
  const box = ctrl('fg-step-panel'), sh = state.figureShown; if (!sh) return;
  const def = sh.def, id = state.figureStep; box.innerHTML = '';
  const h = t => { const e = document.createElement('h3'); e.textContent = t; box.appendChild(e); };
  const row = (label, el) => { const r = document.createElement('div'); r.className = 'ctrl-row'; r.innerHTML = `<div class="ctrl-label">${label}</div>`; r.appendChild(el); box.appendChild(r); return r; };
  const thumbs = () => { const t = document.createElement('div'); t.className = 'fg-thumbs'; box.appendChild(t); return t; };
  const hint = t => { const p = document.createElement('p'); p.className = 'org-panel__hint'; p.textContent = t; box.appendChild(p); };
  const sel = (opts, cur, fn, aria) => { const s2 = document.createElement('select'); s2.className = 'panel-select'; s2.setAttribute('aria-label', aria); opts.forEach(([v, l]) => s2.add(new Option(l, v))); s2.value = String(cur); s2.addEventListener('change', () => fn(s2.value)); return s2; };
  if (id === 'element') {
    h('Element');
    const t = thumbs();
    FG_SEEDS.forEach(k => t.appendChild(figureThumb(SEED_TYPES[k].label, '', def.element.type === k, () => figureMutate(d => { d.element.type = k; if (k === 'arc') d.element.params = { 'rg-thickness': 100 }; else delete d.element.params; }),
      buildSeedPreviewSVG({ type: k, ...SYMBOL_SEED_DEFAULTS }, 0, false, false, 44).replace(/<rect [^>]*\/>/, ''))));
    row('Style', sel([['fill', 'Fill'], ['stroke', 'Stroke']], def.element.style || 'fill', v => figureMutate(d => { d.element.style = v; }), 'Style'));
    const ink = document.createElement('input'); ink.type = 'color'; ink.value = hexKey((def.element.colors || ['#000000'])[0]); ink.className = 'fg-color';
    ink.addEventListener('change', () => figureMutate(d => { d.element.colors = [ink.value, ...(d.element.colors || []).slice(1)]; })); row('Ink', ink);
    const pap = document.createElement('input'); pap.type = 'color'; pap.value = hexKey(def.element.paper || '#ffffff'); pap.className = 'fg-color';
    pap.addEventListener('change', () => figureMutate(d => { d.element.paper = pap.value; })); row('Paper', pap);
    (FG_SEED_MAIN[def.element.type] || []).forEach(([pid, label]) => {
      const c = ctrl(pid), r = document.createElement('input'); r.type = 'range'; r.min = c.min; r.max = c.max; r.step = c.step || 1; r.value = c.value;
      const v = document.createElement('span'); v.className = 'ctrl-val'; v.textContent = r.value;
      r.addEventListener('input', () => { v.textContent = r.value; });
      r.addEventListener('change', () => figureMutate(d => { d.element.params = { ...(d.element.params || {}), [pid]: +r.value }; }));
      row(label, r).appendChild(v);
    });
    hint('More of the Seed\'s own settings (extras, corners…) are in the Element step; tick "Use the Element step\'s own settings" under Advanced to use them in every cell.');
  } else if (id === 'final') {
    h('Mirror / Rotate');
    if (def.levels.length < 2) { hint('Add a Grid first — Mirror and Rotate act on the figure a Grid makes.'); return; }
    const g = def.levels.length - 2, cur = (def.levels[g + 1].transform || def.transform || {});
    row('Rotate', sel([[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], cur.rotate || 0, v => figureSetTransform(d => { d.rotate = +v; }), 'Rotate'));
    row('Mirror', sel([['none', 'None'], ['v', 'Right edge'], ['h', 'Bottom edge'], ['vh', 'Both edges']], cur.mirror || 'none', v => figureSetTransform(d => { d.mirror = v; }), 'Mirror'));
    hint('Or hover the edges of the figure on the canvas and click.');
  } else {
    const k = +id.slice(5), lv = def.levels[k];
    if (lv.kind === 'grid') {
      h('Grid');
      const t = thumbs(), cur = FG_STR_OF(lv.lattice);
      FG_GRID_TYPES.forEach(([v, l]) => t.appendChild(figureThumb(l, FG_ICONS[v], cur === v, () => figureMutate(d => { d.levels[k].lattice = FG_LATTICE_OF(v); }))));
      const alt = document.createElement('input'); alt.type = 'checkbox'; alt.checked = !!lv.altFlip; alt.addEventListener('change', () => figureMutate(d => { d.levels[k].altFlip = alt.checked; }));
      row('Alternate flip', alt);
      const rm = document.createElement('button'); rm.className = 'mini-btn'; rm.textContent = 'Remove this Grid'; rm.addEventListener('click', () => { figureMutate(d => { d.levels.splice(k, 1); }, { resetStep: true }); });
      box.appendChild(rm);
    } else {
      h(lv.kind === 'component' ? 'Component' : isSealedSymbol(lv) ? 'Symbol · adopted' : 'Symbol');
      if (isSealedSymbol(lv)) {
        const card = document.createElement('div'); card.className = 'fg-adopted';
        card.innerHTML = `<img alt="" src="${svgURI((sh.steps && sh.steps[0]) || sh.svg)}">`;
        box.appendChild(card);
        const n = lv.cells.length, filled = lv.cells.filter(c => c.source !== 'empty').length, comps = Object.keys(lv.componentEntries || {}).length;
        hint(`Adopted from the Symbol step: ${n} cells (${filled} filled)${comps ? `, ${comps} saved Component${comps > 1 ? 's' : ''} carried in the recipe` : ''}. Its cells are sealed — edit the Symbol there and build the Figure again, or add Grids here.`);
        const back = document.createElement('button'); back.type = 'button'; back.className = 'mini-btn'; back.textContent = 'Open the Symbol step';
        back.addEventListener('click', () => setTier('symbol')); box.appendChild(back);
      }
      const t = thumbs(), cur = lv.kind === 'component' ? 'component' : lv.lattice.type;
      [['triangle', 'Triangle'], ['square', 'Square'], ['hexagon', 'Hexagon'], ['component', 'Component']].forEach(([v, l]) => t.appendChild(figureThumb(l, FG_ICONS[v], cur === v, () => figureMutate(d => {
        d.levels[0] = figureFirstLevelOf(v);
      }))));
      if (lv.kind === 'symbol' && !isSealedSymbol(lv)) {
        const lat = lv.lattice, key = lat.type === 'triangle' ? 'rows' : lat.type === 'hexagon' ? 'rings' : 'cols', max = lat.type === 'hexagon' ? 4 : 6;
        const r = document.createElement('input'); r.type = 'range'; r.min = lat.type === 'hexagon' ? 1 : 2; r.max = max; r.step = 1; r.value = lat[key];
        const v = document.createElement('span'); v.className = 'ctrl-val'; v.textContent = r.value;
        r.addEventListener('input', () => { v.textContent = r.value; });
        r.addEventListener('change', () => figureMutate(d => { const l = d.levels[0].lattice; l[key] = +r.value; if (l.type === 'square') l.rows = +r.value; }));
        const rr = row(key === 'rows' ? 'Rows' : key === 'rings' ? 'Rings' : 'Size', r); rr.appendChild(v);
        hint('Click or drag on the canvas to paint cells; the Rules appear above, in the Rules section.');
      } else if (lv.kind === 'component') {
        row('Rule', sel([['checkerboard', 'Checkerboard'], ['radial', 'Radial'], ['pinwheel', 'Pinwheel'], ['mirror', 'Mirror']], lv.rule || 'checkerboard', v => figureMutate(d => {
          d.levels[0].rule = v; d.levels[0].params = { checkerboard: { a: 180, b: 0 }, radial: { base: 180, chirality: 1 }, pinwheel: { base: 0, chirality: 1 }, mirror: { seed: 0 } }[v]; }), 'Component rule'));
      }
    }
  }
}
// Mirror / Rotate belong to the last Grid (its own transform, or the recipe's when it has none)
export function figureSetTransform(fn) {
  figureMutate(d => {
    const g = d.levels.length - 1; if (g < 1) return;
    const target = d.levels[g].transform ? d.levels[g].transform : (d.transform = d.transform || {});
    fn(target);
  });
}
document.addEventListener('keydown', e => {
  if (state.activeTier !== 'figure' || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (figurePaintable() && /^[1-6]$/.test(e.key)) { state.figureTool = FIGURE_TOOLS[+e.key - 1][0]; renderFigureToolbar(); }
  if (figureHandleTarget() > 0) {
    if (e.key === 'r' || e.key === 'R') figureHandleAction('rotate');
    else if (e.key === 'm') figureHandleAction('mirror-v');
    else if (e.key === 'M') figureHandleAction('mirror-h');
  }
});

// Checks — every one reads the drawn result, none reads the recipe's own intent back.
export function figureChecks(def, svg) {
  const out = [];
  const add = (ok, label, detail) => out.push({ ok, label, detail });
  const noDefs = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '');
  add(!/NaN|undefined|Infinity/.test(svg), 'Numbers are valid', '');
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]), ids = new Set([...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
  add(refs.every(r => ids.has(r)), 'Every clip reference resolves', refs.length + ' refs');
  add((svg.match(/<metadata>/g) || []).length <= 1 && (svg.match(/<defs>/g) || []).length <= 1, 'Defs and metadata appear once', '');
  const paths = (noDefs.match(/<path /g) || []).length;
  const first = def.levels[0];
  let slots = null;
  if (isSealedSymbol(first)) {
    add(state.symbolCells.length === first.cells.length, 'Lattice has the expected number of slots', `${state.symbolCells.length} of ${first.cells.length}`);
    // a cell may hold a whole Component (many shapes): count what the Symbol itself draws
    slots = (buildSymbolSVG().replace(/<defs>[\s\S]*?<\/defs>/g, '').match(/<path /g) || []).length;
  } else if (first.kind === 'symbol') {
    const l = first.lattice, total = l.type === 'triangle' ? l.rows * l.rows : l.type === 'hexagon' ? 3 * l.rings * (l.rings - 1) + 1 : l.cols * (l.rows || l.cols);
    add(state.symbolCells.length === total, 'Lattice has the expected number of slots', `${state.symbolCells.length} of ${total}`);
    slots = state.symbolCells.filter(c => c.source !== 'empty').length;
  } else slots = getSelectedComponent() ? getSelectedComponent().cells.length : 0;
  const stats = state.figureLevelStats || [];
  const expected = stats.reduce((acc, st) => acc * st.tiles * st.copies, slots);
  add(paths === expected, 'Shapes drawn = filled slots × tiles × mirror copies (per level)', `${paths} of ${expected}`);
  add(svg.length < 400000, 'File size is reasonable', Math.round(svg.length / 1024) + ' KB');
  // colour, read from what was drawn with (the live palette after the run)
  const cm = cwMetrics({ colors: state.colors.map(hexKey), paper: state.paperColor });
  add(cm.minContrast >= CW_MIN_CONTRAST, `Inks read on the paper (${CW_MIN_CONTRAST}:1 or more)`, cm.minContrast.toFixed(1) + ':1');
  if (cm.minDeltaE != null) add(cm.minDeltaE >= Organica.color.DISTINCT_MIN, 'Inks are distinct', 'ΔE ' + Math.round(cm.minDeltaE));
  return out;
}
export function renderFigureReport(rows, extra) {
  const all = rows.concat(extra || []);
  const bad = all.filter(r => !r.ok).length;
  ctrl('fg-report-hint').textContent = bad ? bad + ' to look at' : 'all good';
  ctrl('fg-report').innerHTML = all.map(r => `<div class="fg-row"><span class="fg-dot ${r.ok ? 'fg-ok' : 'fg-bad'}">${r.ok ? '●' : '○'}</span><span>${r.label}${r.detail ? ' — ' + r.detail : ''}</span></div>`).join('');
}
// Raster mask of an SVG string or an <img>: 1 where a pixel differs from the ground.
export async function rasterMask(src, n, ground) {
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
  const im = src instanceof HTMLImageElement ? src : await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(src); });
  const w = im.naturalWidth || n, h = im.naturalHeight || n, k = Math.min(n / w, n / h);
  const ox = (n - w * k) / 2, oy = (n - h * k) / 2;
  g.fillStyle = ground || '#ffffff'; g.fillRect(0, 0, n, n);
  g.drawImage(im, ox, oy, w * k, h * k);
  let d = g.getImageData(0, 0, n, n).data;
  let gr = ground ? null : [0, 0, 0];
  if (!ground) {
    // an image's ground is read from its OWN corners (the letterbox is not part of it), then the box is repainted with it
    const cx0 = Math.ceil(ox), cx1 = Math.floor(ox + w * k) - 1, cy0 = Math.ceil(oy), cy1 = Math.floor(oy + h * k) - 1;
    [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]].forEach(([x, y]) => { const i = (y * n + x) * 4; gr[0] += d[i] / 4; gr[1] += d[i + 1] / 4; gr[2] += d[i + 2] / 4; });
    g.fillStyle = `rgb(${gr.map(Math.round).join(',')})`; g.fillRect(0, 0, n, n); g.drawImage(im, ox, oy, w * k, h * k);
    d = g.getImageData(0, 0, n, n).data;
  } else { const t = document.createElement('canvas').getContext('2d'); t.fillStyle = ground; t.fillRect(0, 0, 1, 1); const p = t.getImageData(0, 0, 1, 1).data; gr = [p[0], p[1], p[2]]; }
  const mask = new Uint8Array(n * n); let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4, dist = Math.abs(d[i] - gr[0]) + Math.abs(d[i + 1] - gr[1]) + Math.abs(d[i + 2] - gr[2]);
    if (dist > 110) { mask[y * n + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { mask, n, box: x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 } };
}
// The mask's own box resampled to m×m (so two silhouettes of different size compare shape, not scale).
export function normMask(M, m) {
  const out = new Uint8Array(m * m); if (!M.box) return out;
  const bw = M.box.x1 - M.box.x0, bh = M.box.y1 - M.box.y0;
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) out[y * m + x] = M.mask[Math.min(M.n - 1, Math.floor(M.box.y0 + (y + .5) * bh / m)) * M.n + Math.min(M.n - 1, Math.floor(M.box.x0 + (x + .5) * bw / m))];
  return out;
}
export const maskIoU = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { i += a[k] & b[k]; u += a[k] | b[k]; } return u ? i / u : 0; };
export let figureRef = null;
export async function refreshFigureChecks(def, svg, run) {
  const rows = figureChecks(def, svg);
  renderFigureReport(rows);
  try {
    const fm = await rasterMask(svg, 160, isPaperNone(state.paperColor) ? '#ffffff' : state.paperColor);
    if (run !== figureRun) return;
    const extra = [];
    const m = 96, nf = normMask(fm, m), tr = def.transform || {};
    if (fm.box) {
      const sym = (a, flip) => { let same = 0, tot = 0; for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) { const b = flip(x, y); same += a[y * m + x] === a[b] ? 1 : 0; tot++; } return same / tot; };
      if (tr.mirror === 'v' || tr.mirror === 'vh') { const q = sym(nf, (x, y) => y * m + (m - 1 - x)); extra.push({ ok: q > 0.97, label: 'Mirror over the right edge is symmetric', detail: Math.round(q * 100) + '%' }); }
      if (tr.mirror === 'h' || tr.mirror === 'vh') { const q = sym(nf, (x, y) => (m - 1 - y) * m + x); extra.push({ ok: q > 0.97, label: 'Mirror over the bottom edge is symmetric', detail: Math.round(q * 100) + '%' }); }
      extra.push({ ok: true, label: 'Figure box (w × h)', detail: `${fm.box.x1 - fm.box.x0} × ${fm.box.y1 - fm.box.y0} of 160` });
    }
    if (figureRef) {
      const rm = await rasterMask(figureRef, 160, null);
      if (run !== figureRun) return;
      const iou = maskIoU(nf, normMask(rm, m));
      const ar = rm.box && fm.box ? ((rm.box.x1 - rm.box.x0) / (rm.box.y1 - rm.box.y0)) / ((fm.box.x1 - fm.box.x0) / (fm.box.y1 - fm.box.y0)) : 0;
      extra.push({ ok: iou > 0.8, label: 'Silhouette overlap with the reference', detail: Math.round(iou * 100) + '%' });
      extra.push({ ok: Math.abs(ar - 1) < 0.12, label: 'Proportions match the reference', detail: 'ratio ' + ar.toFixed(2) });
      drawFigureRef(fm, rm);
    } else ctrl('figure-ref-canvas').style.display = 'none';
    renderFigureReport(rows, extra);
  } catch (e) { /* raster checks are best-effort */ }
}
export function drawFigureRef(fm, rm) {
  const cv = ctrl('figure-ref-canvas'), N = 400; cv.width = cv.height = N;
  const g = cv.getContext('2d'), k = N / fm.n;
  g.clearRect(0, 0, N, N);
  if (!fm.box || !rm.box || !figureRef) { cv.style.display = 'none'; return; }
  const w = figureRef.naturalWidth, h = figureRef.naturalHeight, kk = Math.min(rm.n / w, rm.n / h);
  const offx = (rm.n - w * kk) / 2, offy = (rm.n - h * kk) / 2;
  const sx = (rm.box.x0 - offx) / kk, sy = (rm.box.y0 - offy) / kk, sw = (rm.box.x1 - rm.box.x0) / kk, sh = (rm.box.y1 - rm.box.y0) / kk;
  g.drawImage(figureRef, sx, sy, sw, sh, fm.box.x0 * k, fm.box.y0 * k, (fm.box.x1 - fm.box.x0) * k, (fm.box.y1 - fm.box.y0) * k);
  cv.style.display = 'block'; cv.style.opacity = String(ctrl('fg-ref-opacity').value / 100);
}
(function initFigureTier() {
  const seedSel = ctrl('fg-seed');
  Object.keys(SEED_TYPES).filter(t => t !== 'freehand' && t !== 'custom' && t !== 'freehandraw').forEach(t => seedSel.add(new Option(SEED_TYPES[t].label, t, false, t === 'triangle')));
  for (let n = 5; n <= 8; n++) ctrl('fg-cols').add(new Option(n, n, false, n === 5));   // square-only, flat 5-8 band; fg-n is populated by syncFgNOptions()
  const cat = figureCatalog(), ps = ctrl('fg-preset');
  ps.add(new Option('— choose a figure —', ''));
  Object.keys(cat).forEach(k => ps.add(new Option(k, k)));
  ps.addEventListener('change', () => { if (ps.value) applyFigureRecipe(JSON.parse(JSON.stringify(cat[ps.value])), { resetStep: true }); });
  const onForm = () => { syncFigureFormUI(); applyFigureRecipe(figureRecipeFromForm(), { fromForm: true }); };
  Array.from(ctrl('fg-comp').options).forEach(o => ctrl('fg-comp2').add(new Option(o.value === 'none' ? 'Nothing' : o.text, o.value)));
  ['fg-seed', 'fg-style', 'fg-lattice', 'fg-n', 'fg-cols', 'fg-comprule', 'fg-up', 'fg-down', 'fg-odd', 'fg-hexturn', 'fg-comp2', 'fg-comp', 'fg-rot', 'fg-mirror'].forEach(id => ctrl(id).addEventListener('change', onForm));
  ['fg-ink', 'fg-paper', 'fg-emptyrows'].forEach(id => ctrl(id).addEventListener('input', onForm));
  ctrl('fg-altflip').addEventListener('change', onForm);
  ctrl('fg-liveseed').addEventListener('change', onForm);
  ctrl('fg-hexcentre').addEventListener('change', onForm);
  ctrl('fg-json-apply').addEventListener('click', () => { try { applyFigureRecipe(JSON.parse(ctrl('fg-json').value), { resetStep: true }); } catch (e) { ctrl('fg-json-error').textContent = e.message; ctrl('fg-json-error').style.display = ''; } });
  ctrl('fg-json-copy').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(ctrl('fg-json').value); Organica.dirty.set('fvs-figure', false); });
  ctrl('fg-json-save').addEventListener('click', () => Organica.downloadText(ctrl('fg-json').value, Organica.stamp('fvs-figure', 'json'), 'application/json'));
  ctrl('fg-ref-load').addEventListener('click', () => ctrl('fg-ref-file').click());
  ctrl('fg-ref-file').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const im = new Image(); im.onload = () => { figureRef = im; if (state.figureRecipe) refreshFigureChecks(state.figureRecipe, figureSVGOf(state.figureTier || 'symbol'), ++figureRun); };
    im.src = URL.createObjectURL(f);
  });
  ctrl('fg-ref-clear').addEventListener('click', () => { figureRef = null; ctrl('figure-ref-canvas').style.display = 'none'; if (state.figureRecipe) refreshFigureChecks(state.figureRecipe, figureSVGOf(state.figureTier || 'symbol'), ++figureRun); });
  ctrl('fg-ref-opacity').addEventListener('input', e => { ctrl('v-fg-ref-opacity').textContent = e.target.value; ctrl('figure-ref-canvas').style.opacity = String(e.target.value / 100); });
  syncFigureFormUI();
})();
