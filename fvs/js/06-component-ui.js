// Flexible Visual System · 06-component-ui — Component UI — Edit mode, rule UI, undo, Colourways, Generate, Split.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import {
  pv, state, val
} from './engine/00-core.js';
import {
  INNER_APEX, INNER_UNSUPPORTED, SEED_TYPES, fitPathToSeed, frameDims, splitPaperScope
} from './engine/01-geometry.js';
import {
  getSeed, seedForSnapshot
} from './engine/02-seed-ui.js';
import {
  EXHAUSTIVE_CAP, FAMILIES, LATTICE_RULES, activeAxes, activeCellCount, axisSatisfied, crDims,
  exhaustiveTotal, getGrid, isCanonical2x2, latticeRule, radialEligible, readManualCells,
  resolvedComponentDims, ruleCheckerboard, ruleColumnMirror, ruleDiagonal, ruleExhaustive, ruleIdentity,
  ruleLines, ruleMirror, ruleOscillator, rulePinwheel, ruleRadial, ruleRandom, ruleRowMirror
} from './engine/03-rules.js';
import {
  buildComponentItems, componentCellColRow, getElementAppearance, withAppearance
} from './engine/04-appearance.js';
import {
  buildComponentSVG, buildComponentSVGBody, componentGridOutlineSVG, drawComponentCanvas, gridWrapper
} from './engine/05-render-component.js';
import {
  COMPONENT_STARTER_RULES, RULE_TO_FAMILY, STARTER_VARIANTS_PER_RULE, UNDO_MAX, buildColourways,
  componentEditHitLayer, componentElementSignature, currentLayerInks, cwColourKey, elementIsEmpty,
  expandLayerInks, getSelectedComponent, layerInkComboCount, liveColourKey, splitCurrentOriginal,
  undoStack
} from './engine/06-component-ui.js';
import {
  fillPaper
} from './engine/07-library.js';
import {
  buildPalette, ctrl, printSizePanel, setStatus, syncColorRuleUI, syncQuadrantHint
} from './00-core.js';
import {
  splitElementGeometry
} from './01-geometry.js';
import {
  seedPicker, syncDependentRows, syncFreehandEditor, useSvgAsSeed
} from './02-seed-ui.js';
import {
  applyAppearanceToUI
} from './04-appearance.js';
import {
  buildPrintComponentSVG, printComponentDims, renderGallery, renderSeedPreview
} from './05-render-component.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  adoptColourway: () => adoptColourway, adoptLayerInks: () => adoptLayerInks,
  enterComponentEditMode: () => enterComponentEditMode, generate: () => generate,
  populateComponentStarterGallery: () => populateComponentStarterGallery,
  syncRuleAvailability: () => syncRuleAvailability, syncSeedUI: () => syncSeedUI
});
// ── Component Edit mode ──────────────────────────────────────────────────
// A big single-component view (state.componentEditMode) where every cell is
// clickable; the selected cell's own shape can then be edited LIVE from the
// Element sidebar panel (temporarily swapped into view in place of the
// Component tier's own Grid/Rule panel). Never mutates the source component
// — componentEditCells is a working copy, and "Save as new component" pushes
// a fresh gallery candidate, leaving the original untouched.
export function enterComponentEditMode(compId) {
  const comp = state.components.find(c => c.id === compId);
  if (!comp) return;
  state.selectedId = comp.id;
  state.selectionExplicit = true;
  state.componentEditMode = true;
  state.componentEditId = compId;
  // A per-cell shallow copy, NOT structuredClone(comp.cells) — some rule
  // generators (confirmed live: checkerboard) build their cells array with
  // two slots pointing at the SAME object (harmless until now, since
  // nothing ever mutated one cell in place). structuredClone faithfully
  // preserves that aliasing, so editing "cell 0" would silently also edit
  // whichever other index shares its object. map(c => ({...c})) guarantees
  // every slot is its own independent object regardless.
  state.componentEditCells = comp.cells.map(c => ({ ...c }));
  state.componentEditGrid = structuredClone(getGrid());
  state.componentEditSelectedCell = null;
  // Frozen once, at entry — every non-overridden cell's DEFAULT shape must
  // stay this, even while the same physical Seed panel is being reused as
  // the SELECTED cell's own scratch pad (selectComponentEditCell/
  // componentEditLiveBind write into cell.content, they never touch this).
  // Without freezing it, moving a slider would change every un-edited
  // cell's shape too, since they'd otherwise read the live (now-scratch)
  // panel same as before this mode existed.
  state.componentEditDefaultSeed = seedForSnapshot();
  state.componentEditDefaultAppearance = getElementAppearance();   // same freezing, for Style/Width/Length/Scale/Move
  // Grid is fixed for the duration of the edit (a resize could invalidate
  // cells mid-edit) — disable the controls that would change it.
  ctrl('rg-grid-cols').disabled = true; ctrl('rg-grid-rows').disabled = true;
  ctrl('sel-rule').disabled = true;
  ctrl('gallery').classList.remove('visible');
  ctrl('gallery-empty').style.display = 'none';
  ctrl('gallery-status').textContent = '';
  ctrl('component-edit-view').style.display = 'flex';
  renderComponentEditCanvas();
  hooks.syncFvsZoomHud();   // gallery ⇄ Edit: the zoom chip follows
}

export function exitComponentEditMode() {
  // The panel was repurposed as the selected cell's own scratch pad —
  // restore it to the real shared Element before leaving, so normal
  // Element-tier editing (and the next cell you select) doesn't inherit
  // whatever the last-edited cell happened to be showing.
  if (state.componentEditDefaultSeed) hooks.applySeedToPanel(state.componentEditDefaultSeed);
  if (state.componentEditDefaultAppearance) applyAppearanceToUI(state.componentEditDefaultAppearance);
  state.componentEditMode = false;
  state.componentEditId = null;
  state.componentEditCells = null;
  state.componentEditGrid = null;
  state.componentEditSelectedCell = null;
  state.componentEditDefaultSeed = null;
  state.componentEditDefaultAppearance = null;
  ctrl('rg-grid-cols').disabled = false; ctrl('rg-grid-rows').disabled = false;
  ctrl('sel-rule').disabled = false;
  ctrl('component-edit-view').style.display = 'none';
  const compBlock = document.querySelector('.tier-block[data-tier="component"]');
  const elBlock = document.querySelector('.tier-block[data-tier="element"]');
  if (compBlock) compBlock.classList.add('active');
  if (elBlock) elBlock.classList.remove('active');
  renderGallery();
  renderSeedPreview();
  hooks.syncFvsZoomHud();   // gallery ⇄ Edit: the zoom chip follows
}

// Pushes a brand-new gallery candidate carrying the edited cells, then
// leaves edit mode — the component being edited FROM is never touched.
export function saveComponentEditAsNew() {
  if (!state.componentEditMode) return;
  const newComp = { id: `edit-${Date.now()}`, ruleSource: 'edited', cells: structuredClone(state.componentEditCells) };
  pushUndo();
  state.components.push(newComp);
  state.selectedId = newComp.id;
  state.selectionExplicit = true;
  state.componentAutoGenerated = false;
  exitComponentEditMode();
}


export function renderComponentEditCanvas() {
  if (!state.componentEditMode) return;
  const grid = state.componentEditGrid;
  const seed = state.componentEditDefaultSeed;   // frozen — see enterComponentEditMode's comment
  const size = frameDims(grid);   // real width×height — no square letterbox
  const items = buildComponentItems({ cells: state.componentEditCells }, grid);
  // Frozen default Appearance for the whole call (every non-overridden cell) —
  // an overridden cell's own withAppearance (inside buildComponentSVGBody's
  // per-item loop) nests inside this one and wins for just that item.
  const body = withAppearance(state.componentEditDefaultAppearance, () => buildComponentSVGBody(items, seed, size));
  const hit = componentEditHitLayer(items, size);
  const dims = resolvedComponentDims(size);
  ctrl('component-edit-frame').style.setProperty('--comp-ar', (dims.w / dims.h).toFixed(5));   // the sheet's box takes the component's proportions
  ctrl('component-edit-frame').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg"${items.length && items[0].poly ? ' class="is-cell"' : ''} viewBox="0 0 ${dims.w} ${dims.h}">${body}${componentGridOutlineSVG(items, size)}${(gridWrapper(items, grid.lattice && grid.lattice.outline) || {}).svg || ''}${hit}</svg>`;
  const cell = state.componentEditSelectedCell;
  ctrl('component-edit-hint').textContent = cell == null
    ? 'Click a cell to give it its own shape'
    : `Editing cell ${cell + 1} — adjust the Seed panel on the right`;
}

// Selecting a cell swaps the sidebar to the Element panel and loads that
// cell's own content (or, if it has none yet, leaves the panel exactly as
// it already reads — a reasonable starting point for a first edit).
export function selectComponentEditCell(i) {
  if (!state.componentEditMode) return;
  state.componentEditSelectedCell = i;
  const cell = state.componentEditCells[i];
  if (cell.content) {
    hooks.applyElementSnapshot(cell.content.seedParams, cell.content.appearance || state.componentEditDefaultAppearance);
  }
  const compBlock = document.querySelector('.tier-block[data-tier="component"]');
  const elBlock = document.querySelector('.tier-block[data-tier="element"]');
  if (compBlock) compBlock.classList.remove('active');
  if (elBlock) elBlock.classList.add('active');
  renderComponentEditCanvas();
}

ctrl('component-edit-frame').addEventListener('click', e => {
  const hit = e.target.closest('[data-cell-index]');
  if (!hit) return;
  selectComponentEditCell(parseInt(hit.dataset.cellIndex, 10));
});
ctrl('btn-component-edit-exit').addEventListener('click', exitComponentEditMode);
ctrl('btn-component-edit-save').addEventListener('click', saveComponentEditAsNew);

// Live binding: any edit inside the Element sidebar, while a cell is
// selected in Component Edit mode, writes straight into that cell's own
// content and re-renders — delegated on the whole panel (fires in the
// bubble phase, after each control's own input/change listener already ran
// its usual job), so no individual Seed slider needs touching.
ctrl('panel').addEventListener('input', componentEditLiveBind);
ctrl('panel').addEventListener('change', componentEditLiveBind);
export function componentEditLiveBind(e) {
  if (!state.componentEditMode || state.componentEditSelectedCell == null) return;
  if (!e.target.closest('.tier-block[data-tier="element"]')) return;
  const cell = state.componentEditCells[state.componentEditSelectedCell];
  // Appearance (Style/Width/Length/Scale/Move) rides along in the same
  // snapshot as the shape — the Element panel is this cell's own scratch
  // pad while it's selected, so everything you touch in it (not just the
  // Seed section) belongs to that one cell, not the whole Component.
  cell.content = { source: 'seed', seedType: getSeed().type, seedParams: seedForSnapshot(), appearance: getElementAppearance() };
  renderComponentEditCanvas();
}




// ── Grid-driven rule availability — Radial needs an even × even grid (its
// centre falls between cells); Random/Exhaustive draw from the same families on any grid
// (see the comment above ruleRandom). Grey out what does not apply and bounce
// off a now-invalid selection rather than leaving it silently unusable. ──
export function syncRuleAvailability() {
  const count = activeCellCount();
  const sel = ctrl('sel-rule');
  let currentInvalid = false;
  // Row mirror on a single row (or Column mirror on a single column) has
  // nothing to mirror — every candidate was Identity in disguise.
  const d = crDims(componentCellColRow(getGrid()));
  const gates = {
    radial: [radialEligible(), 'Radial needs a grid with an even number of columns and rows (2×2, 4×4, …)'],
    rowmirror: [d.rows > 1, 'Row mirror needs at least two rows'],
    columnmirror: [d.cols > 1, 'Column mirror needs at least two columns'],
  };
  // A single cell has no pattern to arrange — Identity / Random / Exhaustive /
  // Manual cover its rotations and flips.
  if (count === 1) ['pinwheel', 'mirror', 'diagonal', 'checkerboard', 'hlines', 'vlines', 'oscillator'].forEach(v => { gates[v] = [false, 'A 1×1 Component has no pattern — use Exhaustive for its rotations/flips']; });
  // A non-square cell shape: only the rules that turn in its own step apply.
  if (state.cellShape !== 'square') {
    gates.radial = [count > 1, 'A single cell has no centre to turn towards'];
    [...sel.options].forEach(o => { if (!LATTICE_RULES.has(o.value) && o.value !== 'manual') gates[o.value] = [false, `${o.textContent.replace(/ \(.*\)$/, '')} needs a square cell`]; });
    gates.manual = [false, 'Manual needs a square cell'];
    if (count === 1) gates.checkerboard = [false, 'A single cell has no pattern'];
  } else if (!('manual' in gates)) gates.manual = [true, ''];
  Object.entries(gates).forEach(([v, [eligible, why]]) => {
    const opt = sel.querySelector(`option[value="${v}"]`);
    opt.disabled = !eligible;
    opt.title = eligible ? '' : why;
    if (!eligible && sel.value === v) currentInvalid = true;
  });
  ['pinwheel', 'mirror', 'diagonal', 'checkerboard', 'hlines', 'vlines', 'oscillator'].forEach(v => {
    if (count !== 1 && !(v in gates)) { const opt = sel.querySelector(`option[value="${v}"]`); if (opt) { opt.disabled = false; opt.title = ''; } }
  });
  if (currentInvalid) { sel.value = 'identity'; syncRuleUI(); }
  ctrl('grid-cellcount-hint').textContent = count + ' cell' + (count === 1 ? '' : 's');
  syncQuadrantHint();
  buildManualEditor();
  if (sel.value === 'exhaustive') syncExhaustiveHint();
}

export function syncRuleAxisNote() {
  const note = ctrl('rule-axis-note');
  const famKey = RULE_TO_FAMILY[pv('sel-rule')];
  const fam = famKey && FAMILIES[famKey];
  // Only Checkerboard still depends on the axes (see familyRuleGallery).
  const satisfied = !fam || fam.requiresAxis !== 'any' || axisSatisfied('any', activeAxes());
  if (satisfied) { note.style.display = 'none'; return; }
  note.textContent = 'Checkerboard needs an axis active in Transform axes (above) — showing Identity until then.';
  note.style.display = '';
}

// ── Rule UI wiring ──
export function syncRuleUI() {
  const mode = pv('sel-rule');
  ctrl('rule-random-block').style.display = mode === 'random' ? '' : 'none';
  ctrl('rule-lines-block').style.display = (mode === 'hlines' || mode === 'vlines') ? '' : 'none';
  ctrl('rule-oscillator-block').style.display = mode === 'oscillator' ? '' : 'none';
  ctrl('rule-exhaustive-block').style.display = mode === 'exhaustive' ? '' : 'none';
  ctrl('rule-manual-block').style.display = mode === 'manual' ? '' : 'none';
  ctrl('btn-generate').textContent = mode === 'manual' ? 'Add to gallery' : 'Generate';
  syncRuleAxisNote();
  // Exhaustive-over-cap disables Generate; leaving that mode for any
  // other rule must re-enable it — previously only re-checked when
  // switching BACK INTO exhaustive, so Generate could stay permanently
  // stuck disabled after leaving an over-cap Exhaustive for any other rule.
  if (mode === 'exhaustive') syncExhaustiveHint();
  else ctrl('btn-generate').disabled = false;
}

export function syncExhaustiveHint() {
  const total = exhaustiveTotal();
  const hint = ctrl('rule-total-hint');
  if (total > EXHAUSTIVE_CAP) {
    hint.textContent = `${total.toLocaleString()} possible — exceeds the ${EXHAUSTIVE_CAP} cap. Narrow active axes or use Random instead.`;
    hint.classList.add('over-cap');
    ctrl('btn-generate').disabled = pv('sel-rule') === 'exhaustive';
  } else {
    const k = layerInkComboCount();
    hint.textContent = k > 1
      ? `${total.toLocaleString()} possible component${total === 1 ? '' : 's'} × ${k} layer-colour combinations = ${(total * k).toLocaleString()}${total * k > EXHAUSTIVE_CAP ? ` (first ${EXHAUSTIVE_CAP} shown)` : ''}.`
      : `${total.toLocaleString()} possible component${total === 1 ? '' : 's'}.`;
    hint.classList.remove('over-cap');
    if (pv('sel-rule') === 'exhaustive') ctrl('btn-generate').disabled = false;
  }
}

export function buildManualEditor() {
  const wrap = ctrl('rule-manual-block');
  const count = activeCellCount();
  const square4Labels = ['Cell 1 (top-left)', 'Cell 2 (top-right)', 'Cell 3 (bottom-left)', 'Cell 4 (bottom-right)'];
  let html = '';
  for (let i = 0; i < count; i++) {
    const label = isCanonical2x2() ? square4Labels[i] : `Cell ${i + 1}`;
    html += `<div class="fvs-cell-group">
      <div class="sub-label">${label}</div>
      <div class="ctrl-row"><div class="ctrl-label">Rotation</div>
        <select class="panel-select" id="sel-manual-rot-${i}">
          <option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option>
        </select></div>
      <div class="ctrl-row"><div class="ctrl-label">Flip</div>
        <select class="panel-select" id="sel-manual-flip-${i}">
          <option value="none">None</option><option value="h">Horizontal</option><option value="v">Vertical</option><option value="hv">Both</option>
        </select></div>
      <div class="ctrl-row"><div class="ctrl-label">Scale</div>
        <select class="panel-select" id="sel-manual-scale-${i}">
          <option value="0.75">Small (75%)</option><option value="1" selected>Medium (100%)</option><option value="1.25">Large (125%)</option>
        </select></div>
    </div>`;
  }
  wrap.innerHTML = html;
  // This rebuilds on every grid/cell-count change (via
  // syncRuleAvailability), not just once at init — autoLabelPanel only
  // ran once at page load, so any rebuild after that left its fresh
  // rows unlabeled. Safe to call again: it skips rows that already have
  // a name and only fills the real gaps.
  Organica.autoLabelPanel(wrap);
}

export function pushUndo() {
  undoStack.push(structuredClone({ components: state.components, selectedId: state.selectedId, explicit: state.selectionExplicit, tile: state.fvsGridComponentName, auto: state.componentAutoGenerated, sig: state.componentAutoGenSignature }));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  syncUndoUI();
}
export function undoComponents() {
  const snap = undoStack.pop();
  if (!snap) return;
  state.components = snap.components; state.selectedId = snap.selectedId; state.selectionExplicit = !!snap.explicit; state.fvsGridComponentName = snap.tile;
  state.componentAutoGenerated = snap.auto; state.componentAutoGenSignature = snap.sig;
  adoptColourway(getSelectedComponent());
  renderGallery(); syncUndoUI();
}
export function syncUndoUI() { ctrl('btn-undo-components').disabled = undoStack.length === 0; }
ctrl('btn-undo-components').addEventListener('click', undoComponents);
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z' || state.activeTier !== 'component') return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;   // keep native text undo
  e.preventDefault(); undoComponents();
});

export function populateComponentStarterGallery() {
  // Runs automatically the moment you land on the Component step: each
  // starter rule's first STARTER_VARIANTS_PER_RULE candidates, nothing
  // filtered for looking alike (Generate doesn't filter either).
  const picks = [];
  const starters = state.cellShape !== 'square'
    ? ['radial', 'checkerboard', 'identity'].map(m => ({ name: m, fn: () => latticeRule(m) }))
    : COMPONENT_STARTER_RULES;
  for (const r of starters) {
    if (r.eligible && !r.eligible()) continue;
    const out = r.fn();
    if (!out || !out.length) continue;
    for (const comp of out.slice(0, STARTER_VARIANTS_PER_RULE)) picks.push(comp);
  }
  state.components = picks;
  // selectedId still defaults to the first candidate — Save/Tile/Export etc.
  // all read getSelectedComponent() and several other tests/recipes rely on
  // a fresh tier entry already having a working default target. What
  // changes is state.selectionExplicit (false here): the starter gallery's
  // own pick is a passive default nobody has looked at yet, so it renders
  // with NO visible border (see renderGallery()'s isSelected) until a real
  // action — a click, Generate, quick-save, a Library load — happens.
  state.selectedId = picks.length ? picks[0].id : null;
  state.selectionExplicit = false;
  state.componentAutoGenerated = true;
  state.componentAutoGenSignature = componentElementSignature();
  renderGallery();
}

// Picking a colour variant makes its inks the Element's own, so Export, Tile
// in Grid, Component Edit and the Symbol step all see what the thumbnail shows.
export function adoptLayerInks(comp) {
  if (!comp || !comp.layerInks || !state.layers) return;
  let changed = false;
  for (const l of state.layers.items) {
    if (!(l.id in comp.layerInks) || l.ink === comp.layerInks[l.id]) continue;
    l.ink = comp.layerInks[l.id]; changed = true;
  }
  if (changed) { hooks.renderLayersUI(); renderSeedPreview(); }
}

// Picking a colourway makes it the live palette (like adoptLayerInks), so Export,
// Tile, Component Edit and the Symbol step all show what the thumbnail shows.
export function adoptColourway(comp) {
  const cw = comp && comp.colourway;
  if (!cw || cwColourKey(cw) === liveColourKey()) return;
  state.colors = cw.colors.slice(); state.colorRule = { ...cw.colorRule };
  syncColorRuleUI(); buildPalette(); hooks.setPaperUI(cw.paper);
  renderSeedPreview();
}
export function generateColourways() {
  const comp = getSelectedComponent();
  if (!comp) { setStatus('error', 'Select a component first'); return; }
  // Asked again from a colourway: the mains are still the palette the first set was made from
  // (a hand-edited one — Custom — is a new starting palette).
  const base = comp.colourway && comp.colourway.scheme !== 'custom' && state.colourwayBase ? state.colourwayBase : { colors: state.colors.slice(), paper: state.paperColor, colorRule: { ...state.colorRule } };
  state.colourwayBase = base;
  const list = buildColourways(base, getGrid(), comp.cells.length);
  pushUndo();
  const root = String(comp.id).replace(/-cw\d+$/, '');
  state.components = list.map((cw, j) => ({ ...comp, id: `${root}-cw${j}`, savedName: null, colourway: cw }));
  state.galleryCapNote = null;
  state.selectedId = state.components[0].id;
  state.selectionExplicit = true;
  state.componentAutoGenerated = false;
  adoptColourway(state.components[0]);
  renderGallery();
}

export function generate() {
  const mode = pv('sel-rule');
  let produced = state.cellShape !== 'square' && LATTICE_RULES.has(mode) ? latticeRule(mode) : null;
  if (produced && mode === 'exhaustive' && produced.length > EXHAUSTIVE_CAP) return;
  if (!produced) switch (mode) {
    case 'identity': produced = ruleIdentity(); break;
    case 'pinwheel': produced = rulePinwheel(); break;
    case 'mirror': produced = ruleMirror(); break;
    case 'diagonal': produced = ruleDiagonal(); break;
    case 'checkerboard': produced = ruleCheckerboard(); break;
    case 'rowmirror': produced = ruleRowMirror(); break;
    case 'columnmirror': produced = ruleColumnMirror(); break;
    case 'radial': produced = ruleRadial(); break;
    case 'hlines': produced = ruleLines('row'); break;
    case 'vlines': produced = ruleLines('col'); break;
    case 'oscillator': produced = ruleOscillator(); break;
    case 'random': produced = ruleRandom(); break;
    case 'exhaustive':
      produced = ruleExhaustive();
      if (produced.length > EXHAUSTIVE_CAP) return;
      break;
    case 'manual': {
      pushUndo();
      const comp = { id: `manual-${Date.now()}`, ruleSource: 'manual', cells: readManualCells() };
      if (state.layers) comp.layerInks = currentLayerInks();
      state.components.push(comp);
      state.selectedId = comp.id;
      state.selectionExplicit = true;
      state.componentAutoGenerated = false;
      renderGallery();
      return;
    }
  }
  pushUndo();
  // Nothing is hidden: every structurally distinct candidate is listed, even
  // when this Element paints two of them alike (a Circle's 8 Pinwheels).
  // A multi-layer Element multiplies each one by every layer-ink combination.
  const expanded = expandLayerInks(produced);
  produced = expanded.list;
  state.galleryCapNote = expanded.total > expanded.list.length
    ? { list: produced, text: `Showing ${expanded.list.length} of ${expanded.total.toLocaleString()} (geometry × layer colours) — reduce inks, layers or axes to see all.` }
    : null;
  state.components = produced;
  state.selectedId = produced.length ? produced[0].id : null;
  state.selectionExplicit = true;
  state.componentAutoGenerated = false;
  renderGallery();
}

export function clearGallery() {
  pushUndo();
  state.components = [];
  state.selectedId = null;
  state.selectionExplicit = false;
  state.componentAutoGenerated = false;
  renderGallery();
}

// Element-tier split: cuts the Element's own shape at its bbox centre (a real
// geometric clip via splitElementGeometry, not a mask) and keeps ONE OR MORE
// quadrants as the Element itself, stored as one combined 'custom' seed —
// every downstream tier (Component, Symbol, Figure, export) already
// understands that. `All` restores the original. state.splitOriginal
// remembers the pre-split seed; it is re-snapshotted whenever the Element is
// no longer the piece we made (state.splitApplied), so a manual change of
// shape never restores stale data. state.splitKeep is the live multi-select
// set (empty = whole shape); state.splitCache memoises splitElementGeometry's
// Paper.js work per pre-split seed so toggling chips is cheap.
export function syncSplitUI() {
  ctrl('seg-split-quadrant').querySelectorAll('.seg-btn').forEach(b => {
    const q = b.dataset.q;
    const on = q === 'whole' ? state.splitKeep.size === 0 : state.splitKeep.has(q);
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
  ctrl('btn-split-save').style.display = state.splitKeep.size === 0 ? 'none' : '';   // below the chips: appearing never moves them
}
export function splitElementReset() {
  const status = ctrl('split-status');
  if (state.splitOriginal && state.customSeed === state.splitApplied) {
    hooks.applySeedToPanel(state.splitOriginal);
    if (state.splitOriginalStyle) hooks.fireChange('sel-element-fillmode', state.splitOriginalStyle);
  }
  state.splitOriginal = null; state.splitApplied = null; state.splitOriginalStyle = null;
  state.splitCache = null; state.splitCombinedRaw = null; state.splitKeep.clear();
  renderGallery(); renderSeedPreview();
  syncSplitUI();
  status.textContent = '';   // the All chip says it
}
export function toggleSplitQuadrant(q) {
  if (state.splitKeep.has(q)) state.splitKeep.delete(q); else state.splitKeep.add(q);
  if (state.splitKeep.size === 0 || state.splitKeep.size === 4) { splitElementReset(); return; }
  splitElementApply();
}
export function splitElementApply() {
  const status = ctrl('split-status');
  const { stillOurs, original } = splitCurrentOriginal();
  if (!stillOurs && elementIsEmpty()) { status.textContent = 'Draw or pick a Seed first — nothing to split.'; state.splitKeep.clear(); syncSplitUI(); return; }
  const geo = SEED_TYPES[original.type].geometry(original);
  if (!geo || !geo.d) { status.textContent = 'This Element has no visible shape to split.'; state.splitKeep.clear(); syncSplitUI(); return; }
  const key = JSON.stringify(original);
  if (!state.splitCache || state.splitCache.key !== key) {
    state.splitCache = { key, pieces: splitElementGeometry(geo.d, geo.fillRule) };
  }
  const pieces = state.splitCache.pieces;
  const kept = ['tl', 'tr', 'bl', 'br'].filter(q => state.splitKeep.has(q)).map(q => pieces.find(p => p.id === q)).filter(Boolean);
  if (!kept.length) { status.textContent = 'Those quadrants are empty — the shape has no material there.'; syncSplitUI(); return; }
  // Each kept piece's seed.d is its RAW (unfitted) pathData (fitPathToSeed's
  // `d` field is the input unchanged) — concatenating them and fitting the
  // whole against the shared frameBB keeps every piece at its original place
  // and size, so several kept quadrants reassemble exactly like the original.
  const combinedRaw = kept.map(p => p.seed.d).join(' ');
  const fitted = fitPathToSeed(combinedRaw, kept[0].frameBB);
  if (!fitted) { status.textContent = 'Could not combine the kept quadrants.'; return; }
  if (!stillOurs) state.splitOriginalStyle = pv('sel-element-fillmode');
  state.splitOriginal = JSON.parse(JSON.stringify(original));
  state.splitCombinedRaw = combinedRaw;
  // innerCount forced to 0: Inner Seed rings are already baked into the clipped
  // `d`; 'custom' runs back through withInnerCopies, which would nest a second set.
  hooks.applySeedToPanel({ ...original, type: 'custom', customSeed: fitted, innerCount: 0 });
  const strokeConv = kept.some(p => p.strokeConv);
  if (strokeConv && pv('sel-element-fillmode') !== 'fill') hooks.fireChange('sel-element-fillmode', 'fill');
  state.splitApplied = state.customSeed;
  renderGallery(); renderSeedPreview();
  syncSplitUI();
  status.textContent = '';   // the pressed chips say what is kept; the line is for problems only
}
export function savePieceAsSeed() {
  const status = ctrl('split-status');
  const raw = state.splitCombinedRaw;
  if (!raw) return;
  const scope = splitPaperScope();
  let src;
  try { src = new scope.CompoundPath(raw); } catch (e) { status.textContent = 'Could not save this piece.'; return; }
  const b = src.bounds;
  if (!b || b.width <= 0 || b.height <= 0) { src.remove(); status.textContent = 'Could not save this piece.'; return; }
  const s = 180 / Math.max(b.width, b.height);
  src.scale(s, b.center);
  src.position = new scope.Point(100, 100);
  const d = src.pathData;
  src.remove();
  const typeLabel = (SEED_TYPES[state.splitOriginal ? state.splitOriginal.type : getSeed().type] || {}).label || 'Element';
  const pieceLabel = ['tl', 'tr', 'bl', 'br'].filter(q => state.splitKeep.has(q)).map(q => q.toUpperCase()).join('+') || 'piece';
  const name = typeLabel + ' · ' + pieceLabel + ' piece';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="${d}" fill="var(--ink)"/></svg>`;
  const lib = Organica.store.library.read();
  lib.forms = lib.forms || []; lib.sets = lib.sets || [];
  const id = 'seed-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  lib.forms.push({ id, name, svg, type: 'asset', builtIn: false });
  let mySet = lib.sets.find(x => x.id === 'set-my-seeds');
  if (!mySet) { mySet = { id: 'set-my-seeds', name: 'My Seeds', builtIn: false, forms: [] }; lib.sets.push(mySet); }
  if (!mySet.forms) mySet.forms = [];
  mySet.forms.push(id);
  Organica.store.library.write(lib);
  if (hooks.libviewIsOpen()) hooks.renderLibview();
  useSvgAsSeed(svg);
  state.splitOriginal = null; state.splitApplied = null; state.splitOriginalStyle = null;
  state.splitCache = null; state.splitCombinedRaw = null; state.splitKeep.clear();
  syncSplitUI();
  status.textContent = "Saved '" + name + "' to your Seeds and set it as the Element.";
}

// ── Export ──
export function exportSelected(format) {
  const comp = getSelectedComponent();
  if (!comp) return;
  state.selectedRuleSource = comp.ruleSource;
  const grid = getGrid();
  const seed = getSeed();
  const items = buildComponentItems(comp, grid);
  const baseDims = frameDims(grid);
  const isPrint = printSizePanel.getMode() === 'print';

  if (format === 'svg') {
    const svg = isPrint ? buildPrintComponentSVG(items, seed, baseDims.w, baseDims.h) : buildComponentSVG(items, seed, baseDims);
    Organica.download(new Blob([svg], { type: 'image/svg+xml' }), Organica.stamp('fvs', 'svg'));
    return;
  }

  if (isPrint) {
    const p = printComponentDims(baseDims.w, baseDims.h);
    const off = document.createElement('canvas');
    off.width = p.outW; off.height = p.outH;
    const ctx = off.getContext('2d');
    fillPaper(ctx, state.paperColor, 0, 0, p.outW, p.outH);
    ctx.save();
    ctx.translate(p.bleedPx, p.bleedPx);
    ctx.scale(p.scale, p.scale);
    drawComponentCanvas(ctx, items, seed, baseDims);
    ctx.restore();
    if (p.bleedPx > 0) {
      ctx.save();
      ctx.translate(p.bleedPx, p.bleedPx);
      Organica.printSize.drawCropMarksCanvas(ctx, p.trimWpx, p.trimHpx, {}, '#000');
      ctx.restore();
    }
    off.toBlob(async blob => {
      const bytes = Organica.printSize.embedPngDpi(await blob.arrayBuffer(), p.dpi);
      Organica.download(new Blob([bytes], { type: 'image/png' }), Organica.stamp('fvs', 'png'));
    });
    return;
  }

  const scale = parseInt(pv('sel-export-scale'), 10);
  const off = document.createElement('canvas');
  off.width = baseDims.w * scale; off.height = baseDims.h * scale;
  const ctx = off.getContext('2d');
  ctx.save();
  ctx.scale(scale, scale);
  drawComponentCanvas(ctx, items, seed, baseDims);
  ctx.restore();
  off.toBlob(blob => {
    Organica.download(blob, Organica.stamp('fvs', 'png'));
  });
}

// ── Seed UI — Base/Height only mean anything for the triangle,
// Thickness only for the arc; an upload has no adjustable params. ──
export function syncSeedUI() {
  const type = pv('sel-seed-type');
  ctrl('seed-triangle-block').style.display = type === 'triangle' ? '' : 'none';
  ctrl('seed-arc-block').style.display = type === 'arc' ? '' : 'none';
  ctrl('seed-arctruchet-block').style.display = type === 'arctruchet' ? '' : 'none';
  ctrl('seed-wedge-block').style.display = type === 'wedge' ? '' : 'none';
  ctrl('seed-polygon-block').style.display = type === 'polygon' ? '' : 'none';
  ctrl('seed-star-block').style.display = type === 'star' ? '' : 'none';
  ctrl('seed-roundedrect-block').style.display = type === 'roundedrect' ? '' : 'none';
  ctrl('seed-chevron-block').style.display = type === 'chevron' ? '' : 'none';
  ctrl('seed-cross-block').style.display = type === 'cross' ? '' : 'none';
  ctrl('seed-lens-block').style.display = type === 'lens' ? '' : 'none';
  ctrl('seed-circle-block').style.display = type === 'circle' ? '' : 'none';
  ctrl('seed-segment-block').style.display = type === 'segment' ? '' : 'none';
  ctrl('seed-drop-block').style.display = type === 'drop' ? '' : 'none';
  ctrl('seed-blob-block').style.display = type === 'blob' ? '' : 'none';
  ctrl('seed-freehand-block').style.display = type === 'freehand' ? '' : 'none';
  { const off = INNER_UNSUPPORTED.has(type);
    ['rg-inner-count', 'rg-inner-ratio', 'sel-inner-anchor'].forEach(id => { ctrl(id).disabled = off; });
    ctrl('inner-unsupported').style.display = off ? '' : 'none';
    const hasApex = !!INNER_APEX[type], sel = ctrl('sel-inner-anchor');
    sel.querySelector('option[value="apex"]').disabled = !hasApex;
    if (!hasApex && sel.value === 'apex') { sel.value = val('rg-element-cutout') > 0 ? 'incentre' : 'centroid'; renderGallery(); renderSeedPreview(); } }
  syncDependentRows();
  seedPicker.refresh();
  syncFreehandEditor();
}
