// Flexible Visual System · 08-symbol-grid — Symbol grid — presets, Loom models, Symbol Canvas, generators, arrival, Fit / Anchor.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import { hooks } from './hooks.js';
import {
  pv, state
} from './engine/00-core.js';
import {
  frameSize
} from './engine/01-geometry.js';
import {
  nextDrawId
} from './engine/05-render-component.js';
import {
  getSelectedComponent
} from './engine/06-component-ui.js';
import {
  LIBRARY, buildLibraryEntry, hexKey, isPaperNone, libraryNames
} from './engine/07-library.js';
import {
  GEN_ARRIVE, PX_PER_MM, SYMCANVAS_PRESETS, SYMGRID_GENS, buildFvsGridSVG, cellNaturalSize, loomRegistry, symbolGridModel,
  clampWeightTrackCount, defaultSymbolCells, emptySymbolCell, fitPatch, fitTargetIndices, getFvsGrid,
  getSymbolGrid, readSymgridParams, samePlacement, symbolGenerateBlock, symbolHasAlignedComponents,
  symbolHasContent
} from './engine/08-symbol-grid.js';
import {
  cellPolygon, cellSeedOutline, placeInBox, symbolCellBoxes, symbolSpanLayout
} from './engine/09-symbol-render.js';
import {
  elementPool, poolEntries
} from './engine/10-suggest.js';
import {
  ANCHOR_POSITIONS
} from './engine/11-symbol-ui.js';
import {
  ctrl
} from './00-core.js';
import {
  pushUndo
} from './06-component-ui.js';
// ═══════════════════════════════════════════════════════════════
// SYMBOLS — a second tier: a Loom grid whose cells each hold either a
// raw Seed (the same transform vocabulary Components already use)
// or a whole saved Component, nested and scaled into that one cell.
// Deliberately NOT built on top of Components' own state (state.loomGrid
// /state.components) — a Symbol has its own independent grid and its
// own heterogeneous per-cell fill, so it gets its own state fields
// (state.symbolGrid/state.symbolCells) and its own small set of
// functions below, reusing resolveGridCells/frameSize/SEED_TYPES/
// buildComponentItems/mulberry32/colorAt exactly as-is.
// ═══════════════════════════════════════════════════════════════




// ── Grid tiling — page-less now (no standalone tier/nav/export); kept as an
// internal helper for Figure recipes ({kind:'grid'} levels) and the v1
// recipe fixtures (BUILTIN_RECIPES). Reads state.fvsGridConfig instead of DOM
// controls, since there's no longer a panel for those controls to live in. ──



// Auto-saves the selected Component to the library (once, by id) and points
// the (page-less) Grid helper at it — used internally by Figure recipes and
// the v1 recipe fixtures (BUILTIN_RECIPES), never by a visible page anymore.
export function tileSelectedInGrid() {
  const comp = getSelectedComponent();
  if (!comp) return;
  pushUndo();
  const name = 'Tile · ' + comp.id;
  const all = LIBRARY.read();
  // always refreshed: the id stays the same when the Element/colours change, so a cached copy would go stale
  all[name] = { ...buildLibraryEntry(), auto: true }; LIBRARY.write(all);
  state.fvsGridComponentName = name;
}






export function exportFvsGrid(format) {
  const svgStr = buildFvsGridSVG();
  if (!svgStr) return;
  if (format === 'svg') {
    Organica.download(new Blob([svgStr], { type: 'image/svg+xml' }), Organica.stamp('fvs-grid', 'svg'));
    return;
  }
  const scale = parseInt(pv('sel-export-scale'), 10);
  const grid = getFvsGrid();
  const size = (parseFloat((svgStr.match(/ width="([\d.]+)"/) || [])[1]) || frameSize(grid)) * scale;   // the drawn frame (a Mirror changes it)
  const scaledSVG = buildFvsGridSVG().replace(/width="[\d.]+" height="[\d.]+"/, `width="${size}" height="${size}"`);
  const url = URL.createObjectURL(new Blob([scaledSVG], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    off.getContext('2d').drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    off.toBlob(blob => Organica.download(blob, Organica.stamp('fvs-grid', 'png')));
  };
  img.src = url;
}





export function loadSymbolGridNow(model) {
  state.symbolGrid = Organica.loadLoomGrid(model);
  state.symbolSuggestions = []; hooks.renderSuggestGallery();   // variations belong to the previous grid
  state.symbolCells = defaultSymbolCells(getSymbolGrid());
  state.symbolSelection.clear();
  state.symbolClipEnabled = false;   // a new grid starts on the default
  hooks.syncSymbolViewUI();
  ctrl('symbol-grid-error').style.display = 'none';
  syncOverlapSection();
  hooks.renderSymbol();
}

// ── Symbol Canvas + grid generators ─────────────────────────────
// The Symbol is the composition: it gets a real page (proportions, and in
// Print a physical size + DPI + bleed that the Export follows) and a grid
// generated INSIDE that page by any of Loom's own generators (imported as ES
// modules, the Rhizome way — loom/js/generators/registry.js, untouched). The
// page travels with the grid: it is stored on the Loom model's own canvas
// (canvas.fvsFrame), so saving/loading a Symbol and the Grid tier need no new
// field. Drawing units: px for Screen, px at 96 dpi of the physical size for
// Print (A4 = 794 × 1123) — the Export converts to the real size.
export let symCanvasPicker = null;   // the canvas-format thumbnail picker — built once the <select> is filled (below)

export function readSymbolCanvas() {
  const mode = ctrl('seg-symcanvas-mode').querySelector('.seg-btn.active').dataset.mode;
  const unit = mode === 'print' ? pv('sel-symcanvas-unit') : 'px';
  const pw = Math.max(1, parseFloat(pv('num-symcanvas-w')) || 1), ph = Math.max(1, parseFloat(pv('num-symcanvas-h')) || 1);
  const toPx = v => mode === 'print' ? v * (unit === 'in' ? 25.4 : 1) * PX_PER_MM : v;
  return {
    preset: pv('sel-symcanvas-preset'), mode, unit, pw, ph,
    dpi: parseFloat(pv('num-symcanvas-dpi')) || 300, bleed: Math.max(0, parseFloat(pv('num-symcanvas-bleed')) || 0),
    margin: +pv('rg-symcanvas-margin'),
    W: Math.round(toPx(pw) * 100) / 100, H: Math.round(toPx(ph) * 100) / 100,
  };
}
export function applySymbolCanvasToUI(cv) {
  ctrl('sel-symcanvas-preset').value = cv.preset in SYMCANVAS_PRESETS ? cv.preset : 'Custom';
  if (symCanvasPicker) symCanvasPicker.refresh();
  setSymbolCanvasMode(cv.mode || 'screen');
  if (cv.unit && cv.unit !== 'px') ctrl('sel-symcanvas-unit').value = cv.unit;
  ctrl('num-symcanvas-w').value = cv.pw; ctrl('num-symcanvas-h').value = cv.ph;
  if (cv.dpi) ctrl('num-symcanvas-dpi').value = cv.dpi;
  if (cv.bleed != null) ctrl('num-symcanvas-bleed').value = cv.bleed;
  ctrl('rg-symcanvas-margin').value = cv.margin || 0; ctrl('v-symcanvas-margin').textContent = cv.margin || 0;
  syncSymbolCanvasHint();
}
export function setSymbolCanvasMode(mode) {
  ctrl('seg-symcanvas-mode').querySelectorAll('.seg-btn').forEach(b => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
  ctrl('symcanvas-print-block').style.display = mode === 'print' ? '' : 'none';
  ctrl('symcanvas-unit-label').textContent = mode === 'print' ? pv('sel-symcanvas-unit') : 'px';
}
export function syncSymbolCanvasHint() {
  const cv = readSymbolCanvas();
  ctrl('symbol-canvas-hint').textContent = cv.mode === 'print' ? `${cv.pw} × ${cv.ph} ${cv.unit} · ${cv.dpi} DPI` : `${cv.pw} × ${cv.ph} px`;
}
export function renderSymgridParams() {
  const genId = pv('sel-symgrid-gen'), spec = SYMGRID_GENS[genId];
  ctrl('symgrid-gen-params').innerHTML = spec.params.map(([k, label, a, b, step, def]) => a === 'text'
    ? `<div class="ctrl-row"><div class="ctrl-label">${label} <span class="hint">5–8 weights</span></div><input type="text" class="panel-input" id="symgen-${k}" value="${b}" aria-label="${label}"></div>`
    : `<div class="ctrl-row"><div class="ctrl-label">${label}</div><input type="range" id="symgen-${k}" min="${a}" max="${b}" step="${step}" value="${def}" aria-label="${label}"><span class="ctrl-val" id="v-symgen-${k}">${def}</span></div>`).join('');
  spec.params.forEach(([k, , a]) => { if (a !== 'text') ctrl('symgen-' + k).addEventListener('input', e => { ctrl('v-symgen-' + k).textContent = e.target.value; }); });
}
// ── Overlap & blend — every Symbol grid. Saved with the Symbol (entry.overlap); older Symbols open as Paper under, 0.
state.symbolOverlap = { amount: 0, blend: 'under', drawnBy: 'nearest' };
export function syncOverlapSection() {
  const o = state.symbolOverlap, rg = ctrl('rg-symbol-overlap');
  rg.value = o.amount; ctrl('v-symbol-overlap').textContent = o.amount + '%';
  const blend = ctrl('sel-symbol-blend'), sharedOk = symbolHasAlignedComponents();
  const so = blend.querySelector('option[value="shared"]');
  so.disabled = !sharedOk; so.title = sharedOk ? '' : 'Only with Components that have a Grid shape, set to Match cell';
  if (!sharedOk && o.blend === 'shared') o.blend = 'under';
  blend.value = o.blend; ctrl('sel-symbol-drawnby').value = o.drawnBy;
  ctrl('symbol-drawnby-row').style.display = o.blend === 'shared' ? '' : 'none';
}
export function onSymbolOverlapInput() {
  const o = state.symbolOverlap; o.amount = +pv('rg-symbol-overlap');
  if (o.amount > 0 && state.symbolClipEnabled) { state.symbolClipEnabled = false; hooks.syncSymbolViewUI(); }   // a clip would cut the overlap away
  syncOverlapSection(); hooks.renderSymbol();
}
export async function generateSymbolGridInCanvas() {
  const id = pv('sel-symgrid-gen');
  // With nothing saved the grid is built empty (the start pane says why it can't be filled).
  if (!libraryNames(LIBRARY.read()).length && !elementPool().length) { await buildEmptySymbolGrid(); return; }
  try {
    const model = await symbolGridModel(id, readSymgridParams(id), readSymbolCanvas());
    if (!model.cells.length) throw new Error('No cells — make the canvas larger or lower the counts.');
    ctrl('symgrid-gen-error').style.display = 'none';
    loadSymbolGrid(model);
    clipByDefaultForShape();
    fillSymbolCells();
  } catch (e) {
    ctrl('symgrid-gen-error').textContent = /unsatisfiable/i.test(e.message) ? 'The canvas is too small for this grid — enlarge it or reduce columns/rows.' : e.message;
    ctrl('symgrid-gen-error').style.display = '';
  }
}
// Fill the current grid's cells: Suggest or Arrange from the pool (or the saved Elements).
export function fillSymbolCells() {
  hooks.renderSymbolPool();   // self-heals a stale pool (a Component renamed or deleted since) before filling
  if (poolEntries().length) { if (pv('sel-symbol-fill') === 'suggest') hooks.runSuggest(false); else hooks.generateSymbolCells(); }
  else if (elementPool().length) hooks.generateSymbolCells();   // Elements only: Arrange (Suggest reads Components)
  else {
    ctrl('symgrid-gen-error').textContent = 'Nothing to fill the grid with — save an Element or a Component first.';
    ctrl('symgrid-gen-error').style.display = '';
  }
}
// A new grid of polygon cells (hexagons, triangles, Voronoi…) starts with Clip to cell ON: there, Cover and
// Stretch size the content to the cell's bounding box and would spill into the neighbours. Rect grids keep
// the default (off). Only for grids built from the panel — a saved Symbol keeps what it was saved with.
export function clipByDefaultForShape() {
  state.symbolClipEnabled = !!state.symbolGrid && state.symbolGrid.cellShape === 'polygon';
  hooks.syncSymbolViewUI();
}
export let emptyBuildSeq = 0;
export async function buildEmptySymbolGrid() {
  const seq = ++emptyBuildSeq, id = pv('sel-symgrid-gen');
  try {
    const model = await symbolGridModel(id, readSymgridParams(id), readSymbolCanvas());
    if (seq !== emptyBuildSeq || symbolHasContent()) return;   // a newer build, or the user placed something meanwhile
    if (!model.cells.length) throw new Error('No cells — make the canvas larger or lower the counts.');
    ctrl('symgrid-gen-error').style.display = 'none';
    loadSymbolGrid(model);
    clipByDefaultForShape();
    state.symbolCells = state.symbolCells.map(emptySymbolCell);
    hooks.renderSymbol();
  } catch (e) {
    ctrl('symgrid-gen-error').textContent = /unsatisfiable/i.test(e.message) ? 'The canvas is too small for this grid — enlarge it or reduce columns/rows.' : e.message;
    ctrl('symgrid-gen-error').style.display = '';
  }
}
// While every cell is empty, the panel is the grid's source: a change to the canvas or the
// generator rebuilds it (nothing to lose). Once something is placed, "Generate grid in canvas" does.
export let emptyRebuildTimer = 0;
['sym-canvas-section', 'sym-grid-section'].forEach(id => ['input', 'change'].forEach(ev => ctrl(id).addEventListener(ev, e => {
  if (e.target.closest('button') || !state.symbolGrid || symbolHasContent()) return;
  clearTimeout(emptyRebuildTimer);
  emptyRebuildTimer = setTimeout(buildEmptySymbolGrid, 120);
})));
export function syncSymbolStart() {
  const btn = ctrl('btn-symbol-generate'), why = symbolGenerateBlock();
  btn.setAttribute('aria-disabled', String(!!why));
  btn.setAttribute('aria-label', why || 'Fill the grid');
}

ctrl('sel-symcanvas-preset').innerHTML = Object.keys(SYMCANVAS_PRESETS).map(n => `<option>${n}</option>`).join('') + '<option>Custom</option>';
// Thumbnail picker (Organica.selectPicker, 26px icons): each format as a
// rectangle at its own aspect; Custom is dashed.
symCanvasPicker = Organica.selectPicker(ctrl('sel-symcanvas-preset'), ctrl('symcanvas-picker'), {
  ariaLabel: 'Canvas format',
  registry: Object.assign(Object.fromEntries(Object.entries(SYMCANVAS_PRESETS).map(([n, p]) => [n, { name: n, icon: Organica.aspectIcon(p.w, p.h) }])),
    { Custom: { name: 'Custom', icon: Organica.aspectIcon(1, 1, { dashed: true }) } }),
});
ctrl('sel-symgrid-gen').innerHTML = Object.entries(SYMGRID_GENS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
ctrl('sel-symgrid-gen').value = 'rectangular';
renderSymgridParams();
ctrl('sel-symgrid-gen').addEventListener('change', () => { ctrl('symgrid-gen-error').style.display = 'none'; renderSymgridParams(); syncOverlapSection(); });
ctrl('rg-symbol-overlap').addEventListener('input', onSymbolOverlapInput);
ctrl('sel-symbol-blend').addEventListener('change', e => { state.symbolOverlap.blend = e.target.value; syncOverlapSection(); hooks.renderSymbol(); });
ctrl('sel-symbol-drawnby').addEventListener('change', e => { state.symbolOverlap.drawnBy = e.target.value; hooks.renderSymbol(); });
ctrl('btn-symgrid-generate').addEventListener('click', generateSymbolGridInCanvas);
// Clear: every cell empty again, the grid kept — the Symbol is back to its empty grid with Generate over it.
ctrl('btn-symbol-clear').addEventListener('click', () => {
  if (genArrivalStop) genArrivalStop();
  state.symbolCells = (state.symbolCells || []).map(emptySymbolCell);   // the grid stays (borders dragged by hand too); every cell is empty again
  state.symbolSuggestions = []; hooks.renderSuggestGallery();
  state.symbolSelection.clear();
  state.symbolMarqueeRect = null;
  ctrl('symgrid-gen-error').style.display = 'none';
  hooks.renderSymbol();
  ctrl('btn-symbol-generate').focus({ preventScroll: true });   // Clear is disabled now: focus goes to Generate
});
export let genArrivalStop = null;
export function runSymbolArrival() {
  if (genArrivalStop) genArrivalStop();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const svg = ctrl('symbol-frame').querySelector('svg');
  if (!svg) return;
  const groups = [...svg.querySelectorAll('g[data-cell-index]')].sort((a, b) => a.dataset.cellIndex - b.dataset.cellIndex);
  const n = groups.length;
  if (!n) return;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const px = 1 / (svg.getScreenCTM().a || 1);   // one screen pixel, in user units
  const paper = isPaperNone(state.paperColor) ? null : hexKey(state.paperColor);
  const P = paper ? [1, 3, 5].map(o => parseInt(paper.slice(o, o + 2), 16) / 255) : null;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent.appendChild(el); return el; };
  const uid = 'fvs-gen-' + nextDrawId();
  const layer = mk('g', { id: uid, 'pointer-events': 'none' }, svg);
  const defs = mk('defs', {}, layer);
  // The copy: the drawing as it stands, without the guides and the metadata. Its clip paths keep their ids — the
  // same definitions twice in one document, so either one resolves to the same shape.
  const src = mk('g', { id: uid + '-src' }, defs);
  [...svg.children].forEach(c => { if (c !== layer && c.tagName !== 'metadata' && !c.classList.contains('sym-track') && !c.classList.contains('symbol-marquee')) src.appendChild(c.cloneNode(true)); });
  const cells = groups.map((g, i) => {
    const hit = g.firstElementChild, bb = hit.getBBox();
    // the cell's own outline: its clip (which carries the overdraw past the edge) when "Clip to cell" is on, else its hit shape
    let clip = g.getAttribute('clip-path');
    if (!clip) { const cp = mk('clipPath', { id: `${uid}-c${i}` }, defs); cp.appendChild(hit.cloneNode(false)); clip = `url(#${uid}-c${i})`; }
    const f = mk('filter', { id: `${uid}-f${i}`, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
    const turb = mk('feTurbulence', { type: 'fractalNoise', numOctaves: '2', seed: String(7 + i), result: 'n' }, f);
    const disp = mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }, f);
    const blur = mk('feGaussianBlur', { in: 'd' }, f);
    const ct = mk('feComponentTransfer', {}, f);
    const funcs = (paper ? ['R', 'G', 'B'] : ['A']).map(c => mk('feFunc' + c, { type: 'linear' }, ct));
    const pane = mk('g', { 'clip-path': clip }, layer);
    if (paper) mk('rect', { x: bb.x - 2 * px, y: bb.y - 2 * px, width: bb.width + 4 * px, height: bb.height + 4 * px, fill: paper }, pane);
    // nothing to cover the finished cell with: it waits, hidden, for its pane — and so does its own ground, a
    // sibling group that carries the same clip (the only thing that says whose it is)
    const own = paper ? [] : [g, ...(g.getAttribute('clip-path') ? [...svg.children].filter(c => c !== g && c.tagName === 'g' && c.getAttribute('clip-path') === g.getAttribute('clip-path')) : [])];
    own.forEach(el => { el.style.opacity = '0'; });
    const pic = mk('g', { opacity: '0' }, pane);
    mk('use', { href: `#${uid}-src` }, mk('g', { filter: `url(#${uid}-f${i})` }, pic));
    return { own, bb, f, turb, disp, blur, funcs, pane, pic, rank: i, done: false };
  });
  // Scattered: each cell draws its place in the queue (Fisher–Yates on the ranks), a new draw every run. Read
  // top to bottom the sweep was a wipe; out of order it is a picture being decided in several places at once.
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), r = cells[i].rank; cells[i].rank = cells[j].rank; cells[j].rank = r; }
  const step = clamp(GEN_ARRIVE.sweep / n, GEN_ARRIVE.stepMin, GEN_ARRIVE.stepMax);
  let raf = 0, t0 = 0, left = n;
  const land = c => { if (c.done) return; c.done = true; left--; c.pane.remove(); c.f.remove(); c.own.forEach(el => { el.style.opacity = ''; }); };
  const stop = () => { cancelAnimationFrame(raf); cells.forEach(land); layer.remove(); genArrivalStop = null; };
  const tick = now => {
    if (!t0) t0 = now;
    if (!svg.isConnected) return stop();   // the preview was redrawn under the run: it is sharp already
    cells.forEach(c => {
      if (c.done) return;
      const t = (now - t0 - c.rank * step) / GEN_ARRIVE.cell;
      if (t <= 0) return;
      if (t >= 1) return land(c);
      // one long rise, no pulse: a picture that dims and brightens before it has started reads as hesitating
      const haze = smooth(0, 0.3, t), form = smooth(0.1, 0.82, t);
      // blur falls fast at first and then crawls through the small radii, which is where the detail actually lives
      const sd = mix(GEN_ARRIVE.blur, 0, 1 - Math.pow(1 - form, 2.2)) * px;
      const k = mix(GEN_ARRIVE.contrast, 1, form);
      const warp = (GEN_ARRIVE.ripple / 100) * 32 * Math.pow(1 - smooth(0.05, 0.9, t), 1.5) * px;
      // a slow drift in the noise so the water moves rather than sitting as a fixed distortion
      const fq = (0.006 + 0.0018 * Math.sin(t * 4.4)) / px;
      // the filter only works on the cell and as far past it as the blur and the ripple can reach — it shrinks as they do
      const m = 2.5 * sd + warp + px;
      c.f.setAttribute('x', (c.bb.x - m).toFixed(1)); c.f.setAttribute('y', (c.bb.y - m).toFixed(1));
      c.f.setAttribute('width', (c.bb.width + 2 * m).toFixed(1)); c.f.setAttribute('height', (c.bb.height + 2 * m).toFixed(1));
      c.turb.setAttribute('baseFrequency', `${fq.toFixed(5)} ${(fq * 1.3).toFixed(5)}`);
      c.disp.setAttribute('scale', warp.toFixed(2));
      c.blur.setAttribute('stdDeviation', Math.max(0.001, sd).toFixed(3));
      c.funcs.forEach((fn, j) => { const pivot = P ? P[j] : 0.5; fn.setAttribute('slope', k.toFixed(3)); fn.setAttribute('intercept', (pivot - pivot * k).toFixed(3)); });
      c.pic.setAttribute('opacity', (haze * mix(0.7, 1, form)).toFixed(3));
    });
    if (left > 0) raf = requestAnimationFrame(tick); else stop();
  };
  genArrivalStop = stop;
  raf = requestAnimationFrame(tick);
}
// The first grid, from the middle of the page: the same run as the panel's
// button (canvas, generator and its parameters are read from the panel), with
// the button's leave before it and the arrival after it. Delegated —
// the frame's innerHTML is rewritten on every render.
ctrl('btn-symbol-generate').addEventListener('click', () => {
  const why = symbolGenerateBlock();
  if (why) { Organica.notice(why.replace(/^[^—]+ — /, '').replace(/^./, c => c.toUpperCase()), { kind: 'info' }); return; }
  if (!state.symbolGrid) return;
  fillSymbolCells();
  if (symbolHasContent()) runSymbolArrival();
  syncSymbolStart();
  if (state.symbolSuggestions.length) ctrl('btn-sug-dock').focus({ preventScroll: true });   // Generate is disabled now
});
// Fit (floatbar, Symbol step) and Anchor (Symbol grid section) act on the SELECTION when there is one,
// on every cell when there is none — one control for both, the label says which.
// (Cell properties → Fit / Anchor write the same fields, on the selection.)
rt.symbolAnchorPopover = null;   // the floatbar Anchor popover (set at boot)
export const fitTargetWrite = patch => (state.symbolSelection.size ? hooks.applyToSelection : hooks.applyToAllCells)(patch);
export function syncFitAnchorUI() {
  const n = state.symbolSelection.size, who = n ? `${n} selected cell${n === 1 ? '' : 's'}` : 'all cells';
  // Fit and Anchor are about a CONTENT in its cell. They read (pressed state, anchor position) and
  // are enabled from the target cells that hold something, and each control is on only when using
  // it would actually change the drawing of at least one of them:
  //  · no content at all (Empty cells, no grid yet) → everything off;
  //  · Contain / Fill / Cover that would place every target exactly as it is placed now → that
  //    icon off (a round content in a square cell: the three are the same picture);
  //  · Anchor when no target has room to move in (the content is exactly its cell) → off.
  const grid = getSymbolGrid(), lib = LIBRARY.read(), res = grid ? symbolCellBoxes(grid) : [];   // a spanning Component is fitted in its block
  const L0 = grid ? symbolSpanLayout(grid, state.symbolCells) : { region: {} };
  const targets = fitTargetIndices().map(i => ({ cell: state.symbolCells[i], box: res[i], nat: cellNaturalSize(state.symbolCells[i], lib), poly: L0.region[i] ? null : cellPolygon(grid, i) })).filter(t => t.box && t.nat);
  const cells = targets.map(t => t.cell);
  const nothing = cells.length === 0;
  const why = nothing ? (state.symbolGrid ? ' — nothing to fit (empty)' : ' — no grid yet') : '';
  const placeOf = (t, patch) => placeInBox(t.box, t.nat, { ...t.cell, ...(patch || {}) }, t.poly, t.poly ? cellSeedOutline(t.cell) : null);
  const shared = fn => (cells.length && cells.every(c => fn(c) === fn(cells[0])) ? fn(cells[0]) : null);
  const fit = shared(c => c.fitMode || 'contain'), ax = shared(c => c.anchorX || 0), ay = shared(c => c.anchorY || 0);
  // the Fit buttons live in the floatbar: their tooltip (aria-label) names the target
  ['contain', 'fill', 'cover', 'fixed', 'match'].forEach(f => {
    const b = ctrl('btn-symbol-fit-all-' + f), patch = nothing ? null : fitPatch(f);
    // Fixed is never "the same": even when it starts at the size the content already has, it changes
    // what the cell does next (its own Size, whatever the cell becomes).
    // Match cell on a Component with a Grid shape is never "the same": it puts it on the shared small-cell lattice
    const aligns = f === 'match' && targets.some(t => t.cell.source === 'component' && lib[t.cell.componentName] && lib[t.cell.componentName].grid && lib[t.cell.componentName].grid.lattice);
    const same = !nothing && f !== 'fixed' && fit !== f && !aligns && targets.every(t => samePlacement(placeOf(t), placeOf(t, patch)));
    if (b.getAttribute('aria-pressed') !== String(fit === f)) b.setAttribute('aria-pressed', String(fit === f));
    const label = b.dataset.fitName + ' · ' + who + (nothing ? why : same ? ' — same result as now' : '');
    if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    if (b.disabled !== (nothing || same)) b.disabled = nothing || same;
  });
  // Anchor (floatbar button + flyout): the icon is the position itself — a dot in a cell, a dash
  // when the target cells differ.
  const still = !nothing && targets.every(t => samePlacement(placeOf(t, { anchorX: -1, anchorY: -1 }), placeOf(t, { anchorX: 1, anchorY: 1 })));
  const anchorOff = nothing || still;
  const aLabel = 'Anchor · ' + who + (nothing ? why : still ? ' — no effect: the content is exactly its cell' : '');
  if (ctrl('btn-symbol-anchor').getAttribute('aria-label') !== aLabel) ctrl('btn-symbol-anchor').setAttribute('aria-label', aLabel);
  if (ctrl('btn-symbol-anchor').disabled !== anchorOff) ctrl('btn-symbol-anchor').disabled = anchorOff;
  if (anchorOff && rt.symbolAnchorPopover) rt.symbolAnchorPopover.close();
  ctrl('symbol-fitall-anchor-grid').querySelectorAll('.fvs-flyout__tool').forEach(b => {
    const on = String(ax != null && ay != null && +b.dataset.ax === ax && +b.dataset.ay === ay);
    if (b.dataset.on !== on) b.dataset.on = on;
  });
  const mark = ax != null && ay != null
    ? `<circle cx="${8 + ax * 3}" cy="${8 + ay * 3}" r="1.5" fill="currentColor"/>`
    : '<path d="M6 8h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
  const ico = '<rect x="2.5" y="2.5" width="11" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/>' + mark;
  if (ctrl('ico-symbol-anchor').innerHTML !== ico) ctrl('ico-symbol-anchor').innerHTML = ico;
}
export function applyFitToAllCells(fitMode) {
  if (!state.symbolGrid) return;
  const patch = fitPatch(fitMode);
  fitTargetWrite(() => ({ ...patch }));
  // the write only re-renders the canvas — the docked Cell properties panel has its
  // own #sel-cellprop-fit readout, and these buttons their pressed state: re-sync both.
  hooks.renderCellPropertiesPanel();
}
['contain', 'fill', 'cover', 'fixed', 'match'].forEach(fit =>
  ctrl('btn-symbol-fit-all-' + fit).addEventListener('click', () => applyFitToAllCells(fit)));
// Anchor: which part of a cropped / overflowing cell's content shows — meaningful for Cover
// (which part is kept), Fixed (which part overflows) and Contain (where it sits), not for Fill.
// One control: the floatbar button and its flyout (.fvs-flyout), on the selection or on every cell.
export function applyAnchorToAllCells(ax, ay) {
  if (!state.symbolGrid) return;
  fitTargetWrite({ anchorX: ax, anchorY: ay });
  hooks.renderCellPropertiesPanel();
}
export function buildFitAllAnchorGrid() {
  const wrap = ctrl('symbol-fitall-anchor-grid');
  wrap.innerHTML = ANCHOR_POSITIONS.map(([ax, ay]) =>
    `<button type="button" class="fvs-flyout__tool" data-on="false" data-ax="${ax}" data-ay="${ay}" aria-label="Anchor ${ax < 0 ? 'left' : ax > 0 ? 'right' : 'centre'} ${ay < 0 ? 'top' : ay > 0 ? 'bottom' : 'middle'}"><span></span></button>`
  ).join('');
  wrap.querySelectorAll('.fvs-flyout__tool').forEach(btn => btn.addEventListener('click', () => {
    applyAnchorToAllCells(parseInt(btn.dataset.ax, 10), parseInt(btn.dataset.ay, 10));
    // the pad arrives, then the flyout closes — the button's face now shows the choice
    setTimeout(() => { if (rt.symbolAnchorPopover) rt.symbolAnchorPopover.close(); ctrl('btn-symbol-anchor').focus(); }, 220);
  }));
}
ctrl('sel-symcanvas-preset').addEventListener('change', () => {
  const p = SYMCANVAS_PRESETS[pv('sel-symcanvas-preset')];
  if (!p) return;
  setSymbolCanvasMode(p.unit === 'px' ? 'screen' : 'print');
  if (p.unit !== 'px') ctrl('sel-symcanvas-unit').value = 'mm';
  ctrl('num-symcanvas-w').value = p.w; ctrl('num-symcanvas-h').value = p.h;
  syncSymbolCanvasHint();
});
ctrl('seg-symcanvas-mode').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b) return;
  const cur = readSymbolCanvas();
  if (b.dataset.mode === cur.mode) return;
  // keep the page's proportions: px ↔ mm at 96 dpi
  const k = b.dataset.mode === 'print' ? 1 / PX_PER_MM : PX_PER_MM;
  ctrl('num-symcanvas-w').value = Math.round(cur.pw * k * 10) / 10; ctrl('num-symcanvas-h').value = Math.round(cur.ph * k * 10) / 10;
  if (b.dataset.mode === 'print') ctrl('sel-symcanvas-unit').value = 'mm';
  setSymbolCanvasMode(b.dataset.mode);
  ctrl('sel-symcanvas-preset').value = 'Custom';
  if (symCanvasPicker) symCanvasPicker.refresh();
  syncSymbolCanvasHint();
});
['num-symcanvas-w', 'num-symcanvas-h'].forEach(id => ctrl(id).addEventListener('input', () => { ctrl('sel-symcanvas-preset').value = 'Custom'; if (symCanvasPicker) symCanvasPicker.refresh(); syncSymbolCanvasHint(); }));
['sel-symcanvas-unit', 'num-symcanvas-dpi', 'num-symcanvas-bleed'].forEach(id => ctrl(id).addEventListener('input', () => { setSymbolCanvasMode(readSymbolCanvas().mode); syncSymbolCanvasHint(); }));
ctrl('rg-symcanvas-margin').addEventListener('input', e => { ctrl('v-symcanvas-margin').textContent = e.target.value; });
syncSymbolCanvasHint();

export function handleSymbolGridUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try { loadSymbolGrid(reader.result); }
    catch (e) { ctrl('symbol-grid-error').textContent = e.message; ctrl('symbol-grid-error').style.display = ''; }
  };
  reader.onerror = () => { ctrl('symbol-grid-error').textContent = 'Could not read that file.'; ctrl('symbol-grid-error').style.display = ''; };
  reader.readAsText(file);
}

// Every caller goes through here; rt.afterLoadSymbolGrid is a test hook (fvs/_test-regression.html), null in use.
export function loadSymbolGrid(model) {
  loadSymbolGridNow(model);
  if (rt.afterLoadSymbolGrid) rt.afterLoadSymbolGrid(model);
}
