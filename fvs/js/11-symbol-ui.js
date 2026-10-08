// Flexible Visual System · 11-symbol-ui — Symbol UI — rule layer, overlays, renderSymbol, track drag, cell properties, Symbol library + export.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
import {
  DEFAULT_COLOR_RULE, entryInkAt, live, pc, pv, ruleInk, state, symbolCR
} from './engine/00-core.js';
import {
  SEED_TYPES, frameDims, resolveGridCells
} from './engine/01-geometry.js';
import {
  SYMBOL_SEED_DEFAULTS, getSeed, seedForSnapshot
} from './engine/02-seed-ui.js';
import {
  fitThumbBox, mulberry32
} from './engine/03-rules.js';
import {
  buildComponentItems
} from './engine/04-appearance.js';
import {
  buildSeedPreviewSVG, seedPreviewStates, withEntryInks
} from './engine/05-render-component.js';
import {
  elementIsEmpty
} from './engine/06-component-ui.js';
import {
  LIBRARY, buildComponentSVGWithPaper, fillPaper, hexKey, libraryNames
} from './engine/07-library.js';
import {
  getSymbolGrid, polyOrient, snapPose, symbolCanvasOf, symbolFrame, symbolHasContent, withPlacementDefaults
} from './engine/08-symbol-grid.js';
import {
  buildSymbolSVG, cellOverflowInfo, drawSymbolCanvas
} from './engine/09-symbol-render.js';
import {
  RULE_CONTROL_IDS, SYMBOL_LIBRARY, SYMBOL_RULES, TRACK_MIN_FRAC, buildCoverCropPreviewSVG,
  buildEmptyCellHitsSVG, buildGridOutlineSVG, buildOverflowOutlineSVG, buildSelectionOutlineSVG,
  buildSymbolLibraryEntry, buildSymbolPrintSVG, cellColRow, patchCell, rectsIntersect,
  symbolCellBounds, symbolPrintDims, symbolTrackGrid, trackBands, trackBorders, tracksToWeights
} from './engine/11-symbol-ui.js';
import {
  buildPalette, ctrl, setStatus, syncColorRuleUI
} from './00-core.js';
import {
  applyAppearanceToUI
} from './04-appearance.js';
import {
  applySymbolCanvasToUI, syncFitAnchorUI, syncOverlapSection, syncSymbolStart
} from './08-symbol-grid.js';
import {
  renderSuggestGallery, renderSymbolPool
} from './10-suggest.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  applyToAllCells: () => applyToAllCells, applyToSelection: () => applyToSelection,
  renderCellPropertiesPanel: () => renderCellPropertiesPanel, renderSymbol: () => renderSymbol,
  renderSymbolCanvasOnly: () => renderSymbolCanvasOnly, renderSymbolLibrary: () => renderSymbolLibrary
});
// ─────────────────────────────────────────────────────────────
// GENERATIVE RULE LAYER — fill every cell's transform from a rule + a
// few params, N×M-general (Components' own FAMILIES are 2×2-only). The
// Truchet reference (bookofshapes concentric_arc_truchet_3) is the
// "oscillator" rule: rotation 0/90 from (col + rowShift·row) parity.
// Content (source/seedType/componentName/fit/anchor/padding) is never
// touched — only rotation/flipH/flipV/scale, and only the axes ticked
// in "Vary". Locked cells are skipped unless resetAll.
// ─────────────────────────────────────────────────────────────




export function applySymbolRule(opts) {
  opts = opts || {};
  const grid = getSymbolGrid();
  if (!grid || !state.symbolCells.length) return;
  const name = pv('sel-symbol-rule');
  const rule = SYMBOL_RULES[name];
  if (!rule) return;
  const ctxs = cellColRow(grid);
  const rng = mulberry32(parseInt(pv('num-rule-seed'), 10) || 0);
  const params = rule.read();
  const vary = {
    rotation: pc('chk-rule-rotation'),
    flip: pc('chk-rule-flip'),
    scale: pc('chk-rule-scale'),
  };
  const rawCells = (state.symbolGrid && state.symbolGrid.cells) || [];
  state.symbolCells.forEach((cell, i) => {
    if (!opts.resetAll && cell.locked) return;
    const raw = rawCells[i];
    const t = rule.fn({ ...ctxs[i], orient: raw && raw.points ? polyOrient(raw.points) : null }, params, rng);
    // Content-level results (the Orientation rule): a hole, or a filled cell turned to face its lattice slot.
    if (t.empty != null) {
      if (t.empty) cell.source = 'empty';
      // Only a genuinely empty cell needs a fresh default shape to become
      // visible again — a cell that already holds a Component or a Seed
      // keeps its own content; this used to force ANY non-'seed' cell
      // (i.e. every Component cell) to a plain Triangle seed on every
      // single run, silently discarding the Component reference each time
      // the rule was re-applied.
      else { if (cell.source === 'empty') { cell.source = 'seed'; cell.seedType = cell.seedType || 'triangle'; } cell.fitMode = 'fill'; cell.rotation = t.turn || 0; }
      return;
    }
    // Each rule snaps its own angle (Radial / Wave by their "Snap to 90°" box, the others are 90° steps by
    // construction): the applier only folds it into 0–360, so a free angle reaches the cell.
    if (vary.rotation && t.rotation != null) cell.rotation = Math.round((((t.rotation % 360) + 360) % 360) * 100) / 100;
    if (vary.flip) {
      if (t.flipH != null) cell.flipH = t.flipH;
      if (t.flipV != null) cell.flipV = t.flipV;
    }
    if (vary.scale && t.scale != null) cell.scale = t.scale;
  });
  renderSymbol();
}

export function syncSymbolRuleUI() {
  const name = pv('sel-symbol-rule');
  document.querySelectorAll('#symbol-rule-block .rule-params').forEach(el => {
    el.style.display = el.id === 'rp-' + name ? '' : 'none';
  });
  ctrl('row-rule-scalerange').style.display = pc('chk-rule-scale') ? '' : 'none';
}






export function renderSymbolCanvasOnly() {
  const frame = ctrl('symbol-frame');
  const grid = getSymbolGrid();
  ctrl('btn-symbol-clear').style.display = grid ? '' : 'none';
  ctrl('btn-symbol-clear').disabled = !symbolHasContent();   // an empty grid: the icon stays, disabled (nothing to clear)
  syncSymbolStart();
  if (!grid) {
    // No grid yet: the empty grid is being built from the panel (buildEmptySymbolGrid, on entering the step).
    frame.innerHTML = '';
    ctrl('symbol-cellcount-hint').textContent = '0 cells';
    setStatus('', 'No symbol grid loaded');
    return;
  }
  const count = resolveGridCells(grid).length;
  ctrl('symbol-cellcount-hint').textContent = count + (count === 1 ? ' cell' : ' cells');
  let svg = buildSymbolSVG();
  let overlay = buildEmptyCellHitsSVG();
  if (state.symbolView.outline) overlay += buildGridOutlineSVG();
  overlay += buildSelectionOutlineSVG();
  if (state.symbolView.guides) overlay += buildTrackHandlesSVG();
  if (trackDrag) overlay += buildOverflowOutlineSVG();
  if (state.symbolView.cover) overlay += buildCoverCropPreviewSVG();
  if (state.symbolMarqueeRect) {
    const r = state.symbolMarqueeRect;
    overlay += `<rect class="symbol-marquee" x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}"/>`;
  }
  if (overlay) svg = svg.replace('</svg>', overlay + '</svg>');
  const F = symbolFrame(grid);
  frame.style.setProperty('--sym-ar', (F.w / F.h).toFixed(5));   // the sheet's box takes the canvas's proportions (see #symbol-frame svg)
  frame.innerHTML = svg;
  renderTrackLabelsOverlay();
  // …and once more when this step's layout has settled. A render can run while
  // the Suggest strip above is momentarily empty: the frame is then taller, the
  // labels are measured against that, and the strip is refilled before the
  // browser paints — so the frame ends at its old size, the ResizeObserver
  // (which compares sizes between frames) never fires, and the labels stay
  // where the sheet was. Found on wide canvases, where the sheet re-centres.
  cancelAnimationFrame(trackLabelsRaf);
  trackLabelsRaf = requestAnimationFrame(renderTrackLabelsOverlay);
  setStatus('active', `Symbol · ${count} cells`);
}
export let trackLabelsRaf = 0;

export function renderSymbol() {
  syncOverlapSection();   // Shared cells follows whether aligned Components are in the Symbol
  renderSymbolCanvasOnly();
  if (pv('sel-symbol-fill') === 'manual' || state.symbolSelection.size) renderCellPropertiesPanel();
  else { syncManualBlock(); syncFitAnchorUI(); }
}

// Click-to-select on the rendered Symbol itself (Strata's Refine editor
// uses the same click-a-shape-on-canvas convention) — delegated on
// #symbol-frame, which survives every re-render (only its innerHTML is
// replaced), so this binds exactly once rather than being re-attached
// per render. Plain click selects just this cell (a click on a selected cell opens Choose content);
// ⌘/Ctrl-click (or Shift-click) toggles this cell into/out of a multi-cell selection.
// Mouse position → the SVG's own internal 0..size coordinate space (same
// technique Creator's old draw-mode artLoc() used) — needed both for a
// plain click (was it inside a cell?) and for the marquee rectangle,
// which is defined in that same space so it lines up with the cells it's
// meant to be selecting.
export function svgPointFromEvent(e) {
  const svg = ctrl('symbol-frame').querySelector('svg');
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: loc.x, y: loc.y };
}



export function buildTrackHandlesSVG() {
  const g = symbolTrackGrid();
  if (!g) return '';
  const grid = getSymbolGrid(), F = symbolFrame(grid);
  const hitW = Math.max(6, 0.012 * Math.max(F.w, F.h)), lw = Math.max(1, 0.002 * Math.max(F.w, F.h));
  const x0 = F.X(g.inner.x), x1 = F.X(g.inner.x + g.inner.width), y0 = F.Y(g.inner.y), y1 = F.Y(g.inner.y + g.inner.height);
  let s = '';
  trackBorders('cols').forEach((b, i) => {
    const x = F.X(b);
    s += `<g class="sym-track${trackDrag && trackDrag.axis === 'cols' && trackDrag.i === i ? ' is-dragging' : ''}" data-axis="cols" data-track="${i}"><rect class="sym-track__hit" x="${(x - hitW / 2).toFixed(2)}" y="${y0.toFixed(2)}" width="${hitW.toFixed(2)}" height="${(y1 - y0).toFixed(2)}"/><line class="sym-track__line" x1="${x.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y1.toFixed(2)}" stroke-width="${lw}"/></g>`;
  });
  trackBorders('rows').forEach((b, i) => {
    const y = F.Y(b);
    s += `<g class="sym-track${trackDrag && trackDrag.axis === 'rows' && trackDrag.i === i ? ' is-dragging' : ''}" data-axis="rows" data-track="${i}"><rect class="sym-track__hit" x="${x0.toFixed(2)}" y="${(y - hitW / 2).toFixed(2)}" width="${(x1 - x0).toFixed(2)}" height="${hitW.toFixed(2)}"/><line class="sym-track__line" x1="${x0.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y.toFixed(2)}" stroke-width="${lw}"/></g>`;
  });
  return s;
}
// % labels — one above each column, one left of each row, genuinely OUTSIDE
// the canvas. These are real HTML elements (a sibling overlay div, not SVG
// <text>), because "outside" has to survive the SVG's own preserveAspectRatio
// letterboxing: the viewBox (F.w × F.h, always the canvas's own square/
// rectangle) rarely matches #symbol-frame's own box exactly, so the browser
// centres it inside with extra space on one axis — a fixed SVG-user-space
// offset cleared the constrained axis fine but fell well short on the
// letterboxed one (a small negative x still landed inside the visible
// canvas whenever the frame was wider than the canvas itself). Measuring the
// SVG's REAL rendered rect after it's in the DOM and mapping through that
// gives the correct answer regardless of the frame's own proportions, and
// lets the labels use real design-system tokens directly (--fs-micro,
// --w-light) instead of a canvas-size-scaled approximation.
export function renderTrackLabelsOverlay() {
  const old = document.getElementById('sym-track-labels');
  if (old) old.remove();
  if (!state.symbolView.guides) return;
  const g = symbolTrackGrid();
  if (!g) return;
  const frame = ctrl('symbol-frame'), svgEl = frame.querySelector('svg');
  if (!svgEl) return;
  const grid = getSymbolGrid(), F = symbolFrame(grid);
  const svgR = svgEl.getBoundingClientRect(), frameR = frame.getBoundingClientRect();
  const scale = Math.min(svgR.width / F.w, svgR.height / F.h);
  const offX = svgR.left - frameR.left + (svgR.width - F.w * scale) / 2;
  const offY = svgR.top - frameR.top + (svgR.height - F.h * scale) / 2;
  // Gap between the label and the true canvas edge — --space-4 (10px), read
  // live rather than hardcoded so it tracks the token if it ever changes.
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-4')) || 10;
  const wrap = document.createElement('div');
  wrap.id = 'sym-track-labels';
  wrap.className = 'sym-track-labels';
  trackBands('cols').forEach(band => {
    const el = document.createElement('div');
    el.className = 'sym-track-label sym-track-label--col';
    el.style.left = (offX + F.X((band.start + band.end) / 2) * scale).toFixed(1) + 'px';
    el.style.top = (offY - gap).toFixed(1) + 'px';
    el.textContent = band.pct + '%';
    wrap.appendChild(el);
  });
  trackBands('rows').forEach(band => {
    const el = document.createElement('div');
    el.className = 'sym-track-label sym-track-label--row';
    el.style.left = (offX - gap).toFixed(1) + 'px';
    el.style.top = (offY + F.Y((band.start + band.end) / 2) * scale).toFixed(1) + 'px';
    el.textContent = band.pct + '%';
    wrap.appendChild(el);
  });
  frame.appendChild(wrap);
}
// Move border i of `axis` to raw coordinate `pos`; the grid is re-resolved, cells untouched.
export function moveTrackBorder(axis, i, pos) {
  const g = symbolTrackGrid();
  if (!g) return;
  const sizes = g.grid.tracks[axis].slice(), gap = g.grid.gap || 0;
  const start = (axis === 'cols' ? g.inner.x : g.inner.y) + sizes.slice(0, i).reduce((a, b) => a + b + gap, 0);
  const pair = sizes[i] + sizes[i + 1];
  const min = Math.max(1, TRACK_MIN_FRAC * sizes.reduce((a, b) => a + b, 0));
  const a = Math.min(pair - min, Math.max(min, pos - start - gap / 2));
  sizes[i] = a; sizes[i + 1] = pair - a;
  const tracks = { ...g.grid.tracks, [axis]: sizes };
  const grid = { ...g.grid, tracks };
  const frame = g.canvas && g.canvas.fvsFrame;
  const key = axis === 'cols' ? 'colWeights' : 'rowWeights';
  if (grid.type === 'rectangular') {
    grid.params = { ...(grid.params || {}), [key]: tracksToWeights(sizes) };
    if (frame && frame.params) frame.params = { ...frame.params, [key]: grid.params[key] };
    if (pv('sel-symgrid-gen') === 'rectangular' && ctrl('symgen-' + key)) ctrl('symgen-' + key).value = grid.params[key];
  }
  state.symbolGrid = Organica.loadLoomGrid({ ...g, grid });
}
export let trackDrag = null;   // {axis, i} while a border is being dragged
export function bindSymbolTrackDrag() {
  const frame = ctrl('symbol-frame');
  // capture phase: a border drag must not also start a marquee selection
  frame.addEventListener('mousedown', e => {
    const h = e.button === 0 && e.target.closest && e.target.closest('.sym-track');
    if (!h) return;
    e.preventDefault(); e.stopImmediatePropagation();
    trackDrag = { axis: h.dataset.axis, i: +h.dataset.track };
    frame.classList.add('is-resizing-' + trackDrag.axis);
    renderSymbolCanvasOnly();
  }, true);
  window.addEventListener('mousemove', e => {
    if (!trackDrag) return;
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    const F = symbolFrame(getSymbolGrid());
    // frame → raw coordinates: invert F.X / F.Y (both are v + constant)
    const pos = trackDrag.axis === 'cols' ? pt.x - (F.X(0)) : pt.y - (F.Y(0));
    moveTrackBorder(trackDrag.axis, trackDrag.i, pos);
    renderSymbolCanvasOnly();
  });
  window.addEventListener('mouseup', () => {
    if (!trackDrag) return;
    frame.classList.remove('is-resizing-' + trackDrag.axis);
    trackDrag = null;
    state.symbolSuggestions = []; renderSuggestGallery();   // variations were drawn for the old proportions
    renderSymbol();
  }, true);
}

export function bindSymbolCanvasSelection() {
  const frame = ctrl('symbol-frame');
  const THRESHOLD = 5;
  let dragStart = null, dragMoved = false, dragBase = [];
  const addKey = e => e.metaKey || e.ctrlKey || e.shiftKey;   // ⌘ (Ctrl on Windows) or Shift: add to / remove from the selection

  frame.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    e.preventDefault(); // no native text/seed drag while marquee-selecting
    dragStart = pt;
    dragMoved = false;
    dragBase = addKey(e) ? Array.from(state.symbolSelection) : [];
  });

  frame.addEventListener('mousemove', e => {
    if (!dragStart) return;
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    if (!dragMoved && Math.hypot(pt.x - dragStart.x, pt.y - dragStart.y) > THRESHOLD) dragMoved = true;
    if (!dragMoved) return;
    const rect = {
      x: Math.min(dragStart.x, pt.x), y: Math.min(dragStart.y, pt.y),
      w: Math.abs(pt.x - dragStart.x), h: Math.abs(pt.y - dragStart.y),
    };
    state.symbolMarqueeRect = rect;
    const hits = symbolCellBounds().filter(c => rectsIntersect(rect, c)).map(c => c.index);
    state.symbolSelection = new Set([...dragBase, ...hits]);
    renderSymbolCanvasOnly();
    renderCellPropertiesPanel();
  });

  window.addEventListener('mouseup', e => {
    if (!dragStart) return;
    const wasDrag = dragMoved;
    dragStart = null; dragMoved = false;
    if (wasDrag) {
      // A drag is for building a multi-selection to batch-edit — it
      // deliberately never opens the content overlay on its own.
      state.symbolMarqueeRect = null;
      renderSymbolCanvasOnly();
      return;
    }
    const el = e.target.closest && e.target.closest('[data-cell-index]');
    if (!el) {
      // Click outside any cell (the canvas's own paper background) clears
      // the selection — same convention as Strata's Refine editor, which
      // this feature was explicitly modelled on. A plain click missing
      // this was a real gap, not just an unhandled case: with a selection
      // already active, clicking empty canvas silently left it in place.
      if (!addKey(e) && state.symbolSelection.size > 0) {
        state.symbolSelection.clear();
        renderSymbolCanvasOnly();
        renderCellPropertiesPanel();
      }
      return;
    }
    const i = parseInt(el.getAttribute('data-cell-index'), 10);
    if (addKey(e)) {
      state.symbolSelection.has(i) ? state.symbolSelection.delete(i) : state.symbolSelection.add(i);
      renderSymbolCanvasOnly();
      renderCellPropertiesPanel();
    } else {
      // A plain click SELECTS; a click on a cell that is already selected (alone or in a
      // group — so also the second click of a double-click) opens Choose content for the
      // whole selection. Selecting a cell to change its Fit, Anchor or turn must not pop
      // the content picker in the way.
      const again = state.symbolSelection.has(i);
      if (!again) {
        state.symbolSelection.clear();
        state.symbolSelection.add(i);
      }
      renderSymbolCanvasOnly();
      renderCellPropertiesPanel();
      if (again) openCellContentOverlay();
    }
  });
}

export function applyToSelection(patch) {
  let changed = false;
  state.symbolSelection.forEach(i => {
    const cell = state.symbolCells[i];
    if (!cell) return;
    if (patchCell(cell, patch)) changed = true;
  });
  if (changed) Organica.dirty.set('fvs-symbol', true);   // hand-edited cells live only in memory until saved to the Symbol library
  renderSymbolCanvasOnly();
}

// Replaces the old one-row-per-cell list entirely: ONE shared panel that
// reflects/edits whatever is currently selected (state.symbolSelection).
// The panel markup itself is static HTML (see index.html) — no rebuild
// per selection change, only values get synced, so a control never loses
// focus mid-edit the way rebuilding used to risk.
// Content (Source/Type/Component) is picked entirely through the overlay
// now — no docked <select> trio to keep in sync with it, which is exactly
// what used to risk drifting (a dropdown AND an overlay both able to set
// the same fields). The docked panel just reflects the result: a plain
// text readout plus the Choose… button that reopens the overlay.
// Colour: "Follow palette" (color null) or an explicit override — a palette
// colour or a free one. Only Seed cells carry a colour (a nested Component
// keeps its own inks).
// Cell properties — ONE block for every cell editor (Oct 8, 2026: Compose = the Symbol step's editor). The markup
// (cellPropsHTML), the readout (syncCellProps) and the wiring (bindCellProps) take an id prefix and a target:
//   { count(), first() → the cell shown, colors() → the palette's hexes, apply(patch | cell => patch), refresh(),
//     overflow() → bool, choose() → opens Choose content, lock: show the Lock row }
// Symbol mounts it with prefix '' — its ids (sel-cellprop-rot …) are unchanged; Compose with 'fgc-'.
export function cellPropsHTML(pre, opts = {}) {
  const I = b => pre + b;
  return `<div class="ctrl-row"><div class="ctrl-label">Selected</div>
            <span class="ctrl-val" id="${I('symbol-cellprop-count')}" style="flex:1;text-align:left"></span>
          </div>
          <div class="ctrl-row"><div class="ctrl-label">Content</div>
            <span class="ctrl-val" id="${I('symbol-cellprop-content-label')}" style="flex:1;text-align:left">—</span>
            <button class="mini-btn" id="${I('btn-cellprop-choose')}">Choose…</button>
          </div>
          <div class="ctrl-row fvs-cellprop-shape" id="${I('row-cellprop-seedparams')}">
            <div class="ctrl-label">Shape</div>
            <span class="ctrl-val" id="${I('symbol-cellprop-seedparams-label')}" style="flex:1;text-align:left">Default</span>
            <button class="mini-btn" id="${I('btn-cellprop-useseed')}" title="Copy the Element step’s current settings (extras, thickness…) into the selected cells">Use Element</button>
            <button class="mini-btn" id="${I('btn-cellprop-defseed')}" title="Back to the plain default shape">Default</button>
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-rotation')}"><div class="ctrl-label">Rotation</div>
            <select class="panel-select" id="${I('sel-cellprop-rot')}">
              <option value="0">0°</option><option value="60">60°</option><option value="90">90°</option><option value="120">120°</option><option value="180">180°</option><option value="240">240°</option><option value="270">270°</option><option value="300">300°</option>
            </select>
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-flip')}"><div class="ctrl-label">Flip</div>
            <select class="panel-select" id="${I('sel-cellprop-flip')}">
              <option value="none">None</option><option value="h">Horizontal</option><option value="v">Vertical</option><option value="hv">Both</option>
            </select>
          </div>
          <div class="ctrl-row"><div class="ctrl-label">Fit</div>
            <select class="panel-select" id="${I('sel-cellprop-fit')}">
              <option value="contain">Contain</option>
              <option value="fill">Stretch</option>
              <option value="cover">Cover (no gaps)</option>
              <option value="fixed">Fixed size</option>
              <option value="match">Match cell</option>
            </select>
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-coveraxis')}" style="display:none">
            <div class="ctrl-label">Cover axis</div>
            <select class="panel-select" id="${I('sel-cellprop-coveraxis')}">
              <option value="auto">Auto (no gaps)</option>
              <option value="x">Lock to width</option>
              <option value="y">Lock to height</option>
            </select>
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-overflow')}" style="display:none">
            <span class="ctrl-val" style="color:var(--danger);text-align:left;flex:1">⚠ Extends beyond cell bounds</span>
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-scale')}">
            <div class="ctrl-label">Scale</div>
            <input type="range" id="${I('rg-cellprop-scale')}" min="10" max="400" step="1" value="100">
            <span class="ctrl-val" id="${I('v-cellprop-scale')}">100</span>
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-fixedsize')}" style="display:none">
            <div class="ctrl-label">Size</div>
            <input type="range" id="${I('rg-cellprop-fixedsize')}" min="5" max="300" step="1" value="100">
            <span class="ctrl-val" id="${I('v-cellprop-fixedsize')}">100</span>
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-color')}">
            <div class="ctrl-label">Colour</div>
            <select class="panel-select" id="${I('sel-cellprop-color')}" aria-label="Cell colour"></select>
            <input type="color" id="${I('in-cellprop-color')}" aria-label="Custom cell colour" style="display:none">
          </div>
          <div class="ctrl-row" id="${I('row-cellprop-color-override')}" style="display:none">
            <span class="ctrl-val" style="color:var(--tool);text-align:left;flex:1">● Overrides the palette</span>
            <button class="mini-btn" id="${I('btn-cellprop-color-reset')}">Reset</button>
          </div>
          <div class="ctrl-row">
            <div class="ctrl-label">Padding</div>
            <input type="range" id="${I('rg-cellprop-padding')}" min="0" max="40" step="1" value="0">
            <span class="ctrl-val" id="${I('v-cellprop-padding')}">0</span>
          </div>
          ${opts.lock === false ? '' : `<label class="check-row" style="margin-top:var(--space-2)"><input type="checkbox" id="${I('chk-cellprop-lock')}"><span>Lock cell (rule skips it)</span></label>`}`;
}
// Colour: "Follow palette" (color null) or an explicit override — a palette
// colour or a free one. Only Seed cells carry a colour (a nested Component
// keeps its own inks).
export function syncCellColourUI(cell, isComponent, pre = '', colors = state.colors) {
  const c = b => ctrl(pre + b);
  c('row-cellprop-color').style.display = isComponent ? 'none' : '';
  if (isComponent) { c('row-cellprop-color-override').style.display = 'none'; return; }
  const sel = c('sel-cellprop-color');
  const pal = colors.map(hexKey);
  const cur = cell.color ? hexKey(cell.color) : '';
  const custom = cur && !pal.includes(cur);
  sel.innerHTML = `<option value="">Follow palette</option>`
    + pal.map((c, i) => `<option value="${c}">Ink ${i + 1} · ${c}</option>`).join('')
    + `<option value="custom">Custom…</option>`;
  sel.value = !cur ? '' : custom ? 'custom' : cur;
  const inp = c('in-cellprop-color');
  inp.style.display = custom ? '' : 'none';
  if (custom) inp.value = cur;
  c('row-cellprop-color-override').style.display = cur ? '' : 'none';
}
// Cell properties belong to the selection, not to the Fill mode: the block
// shows in Manual, and in any other mode as soon as cells are selected.
export function syncManualBlock() {
  ctrl('symbol-manual-block').style.display = (pv('sel-symbol-fill') === 'manual' || state.symbolSelection.size > 0) ? '' : 'none';
}
// The Symbol step's target: the selected cells of state.symbolCells.
export const SYMBOL_CELLS = {
  count: () => state.symbolSelection.size,
  first: () => state.symbolCells[Math.min(...state.symbolSelection)],
  colors: () => state.colors,
  apply: patch => applyToSelection(patch),
  refresh: () => renderCellPropertiesPanel(),
  overflow: () => !state.symbolClipEnabled && cellOverflowInfo(Math.min(...state.symbolSelection)),
  choose: () => openCellContentOverlay(),
  lock: true,
};
export function renderCellPropertiesPanel() {
  syncManualBlock();
  syncFitAnchorUI();
  const hasSelection = state.symbolSelection.size > 0 && state.symbolGrid;
  ctrl('symbol-cell-empty').style.display = hasSelection ? 'none' : '';
  ctrl('symbol-cell-props').style.display = hasSelection ? '' : 'none';
  if (!hasSelection) return;
  syncCellProps('', SYMBOL_CELLS);
}
export function syncCellProps(pre, t) {
  const c = b => ctrl(pre + b), n = t.count();
  c('symbol-cellprop-count').textContent = `${n} cell${n === 1 ? '' : 's'}`;

  const first = t.first();
  const isComponent = first.source === 'component';

  let label = '—';
  if (isComponent) {
    const exists = first.componentName && LIBRARY.read()[first.componentName];
    label = first.componentName ? (exists ? first.componentName + (first.colourway ? ' · recoloured' : '') : `⚠ ${first.componentName} (missing)`) : '—';
  } else if (first.source === 'empty') {
    label = 'Empty';
  } else if (first.seedType && SEED_TYPES[first.seedType]) {
    label = SEED_TYPES[first.seedType].label;
  }
  c('symbol-cellprop-content-label').textContent = label;

  // Rotation/Flip are hidden entirely for Component cells — a saved
  // Component is already an internally-composed (often symmetric)
  // arrangement, so rotating/flipping the whole nested block as one more
  // knob adds little real value against the extra control surface.
  c('row-cellprop-rotation').style.display = isComponent ? 'none' : '';
  c('row-cellprop-flip').style.display = isComponent ? 'none' : '';
  // A free angle (Radial / Wave with Snap off) gets its own option, so the menu shows it instead of a blank.
  const rotSel = c('sel-cellprop-rot'), rotVal = String(first.rotation || 0);
  rotSel.querySelectorAll('option[data-free]').forEach(o => { if (o.value !== rotVal) o.remove(); });
  if (![...rotSel.options].some(o => o.value === rotVal)) rotSel.add(Object.assign(new Option(`${rotVal}°`, rotVal), { title: 'Set by the rule' }), null), rotSel.lastElementChild.dataset.free = '1';
  rotSel.value = rotVal;
  c('sel-cellprop-flip').value = first.flipH && first.flipV ? 'hv' : first.flipH ? 'h' : first.flipV ? 'v' : 'none';
  c('sel-cellprop-fit').value = first.fitMode || 'contain';
  c('row-cellprop-coveraxis').style.display = first.fitMode === 'cover' ? '' : 'none';
  c('sel-cellprop-coveraxis').value = first.coverAxis || 'auto';
  c('row-cellprop-scale').style.display = first.fitMode === 'fixed' ? 'none' : '';
  c('row-cellprop-fixedsize').style.display = first.fitMode === 'fixed' ? '' : 'none';
  c('rg-cellprop-scale').value = Math.round((first.scale == null ? 1 : first.scale) * 100);
  c('v-cellprop-scale').textContent = c('rg-cellprop-scale').value;
  c('rg-cellprop-fixedsize').value = first.fixedSize || 100;
  c('v-cellprop-fixedsize').textContent = c('rg-cellprop-fixedsize').value;
  syncCellColourUI(first, isComponent, pre, t.colors());
  c('row-cellprop-seedparams').style.display = (isComponent || first.source === 'empty') ? 'none' : '';
  c('symbol-cellprop-seedparams-label').textContent = first.seedParams ? 'Element settings' : 'Default';
  c('rg-cellprop-padding').value = Math.round((first.padding || 0) * 100);
  c('v-cellprop-padding').textContent = c('rg-cellprop-padding').value;
  if (t.lock) c('chk-cellprop-lock').checked = !!first.locked;

  c('row-cellprop-overflow').style.display = t.overflow && t.overflow() ? '' : 'none';
}
export function bindCellProps(pre, t) {
  const c = b => ctrl(pre + b);
  c('btn-cellprop-choose').addEventListener('click', () => t.choose());
  c('sel-cellprop-rot').addEventListener('change', e => t.apply({ rotation: snapPose(parseInt(e.target.value, 10)) }));
  c('sel-cellprop-flip').addEventListener('change', e => {
    const v = e.target.value;
    t.apply({ flipH: v === 'h' || v === 'hv', flipV: v === 'v' || v === 'hv' });
  });
  c('sel-cellprop-fit').addEventListener('change', e => {
    t.apply({ fitMode: e.target.value });
    t.refresh();
  });
  c('sel-cellprop-coveraxis').addEventListener('change', e => t.apply({ coverAxis: e.target.value }));
  c('rg-cellprop-scale').addEventListener('input', e => {
    c('v-cellprop-scale').textContent = e.target.value;
    t.apply({ scale: parseInt(e.target.value, 10) / 100 });
  });
  c('rg-cellprop-fixedsize').addEventListener('input', e => {
    c('v-cellprop-fixedsize').textContent = e.target.value;
    t.apply({ fixedSize: parseInt(e.target.value, 10) });
  });
  c('rg-cellprop-padding').addEventListener('input', e => {
    c('v-cellprop-padding').textContent = e.target.value;
    t.apply({ padding: parseInt(e.target.value, 10) / 100 });
  });
  c('sel-cellprop-color').addEventListener('change', e => {
    const v = e.target.value;
    const inp = c('in-cellprop-color');
    const color = v === '' ? null : v === 'custom' ? hexKey(inp.value || t.colors()[0]) : v;
    if (v === 'custom') inp.value = color;
    t.apply({ color });
    t.refresh();
  });
  c('in-cellprop-color').addEventListener('input', e => t.apply({ color: hexKey(e.target.value) }));
  c('btn-cellprop-color-reset').addEventListener('click', () => { t.apply({ color: null }); t.refresh(); });
  c('btn-cellprop-useseed').addEventListener('click', () => {
    const sp = seedForSnapshot();
    t.apply(cell => ({ seedParams: cell.source === 'seed' ? JSON.parse(JSON.stringify(sp)) : undefined, seedType: cell.source === 'seed' ? sp.type : cell.seedType }));
    t.refresh();
  });
  c('btn-cellprop-defseed').addEventListener('click', () => { t.apply({ seedParams: undefined }); t.refresh(); });
  if (t.lock) c('chk-cellprop-lock').addEventListener('change', e => t.apply({ locked: e.target.checked }));
}
ctrl('symbol-cell-props').innerHTML = cellPropsHTML('');

// ── Choose-content overlay — opened by a plain click on a cell (or the
// docked panel's own Choose… button for a ⌘-click/drag-built multi-
// selection). Picking a tile applies the same fresh defaults regardless
// of source type (scale 100%, Fill, no padding, centred anchor) — a
// predictable clean slate every time content is assigned, not whatever
// the previously-selected cell happened to have. ──
// The window has a target, like Cell properties: none = the Symbol step's cells; Compose passes
// { count(), apply(patch | cell => patch), done() } and its pick becomes the selection's region rule.
let overlayTarget = null;
export function openCellContentOverlay(target) {
  overlayTarget = target && target.apply ? target : null;
  ctrl('chk-content-overlay-all').closest('label').style.display = overlayTarget ? 'none' : '';   // "all cells" is Symbol-only
  if (!overlayTarget && state.symbolSelection.size === 0 && !pc('chk-content-overlay-all')) return;
  renderCellContentOverlayTiles();
  ctrl('symbol-content-overlay').style.display = 'flex';
  const first = ctrl('symbol-content-overlay').querySelector('button.fvs-library-item, button#btn-content-overlay-close');
  if (first) first.focus();
}
export function openCellContentOverlayForAll() {
  if (!state.symbolGrid) return;
  ctrl('chk-content-overlay-all').checked = true;
  openCellContentOverlay();
}
// Write a content patch to every cell (used when "Apply to all cells" is
// armed) — the sibling of applyToSelection().
export function applyToAllCells(patch) {
  let changed = false;
  state.symbolCells.forEach(cell => {
    if (!cell) return;
    if (patchCell(cell, patch)) changed = true;
  });
  if (changed) Organica.dirty.set('fvs-symbol', true);
  renderSymbolCanvasOnly();
}
export function contentTarget() { return overlayTarget ? overlayTarget.apply : pc('chk-content-overlay-all') ? applyToAllCells : applyToSelection; }
function pickDone() { const t = overlayTarget; closeCellContentOverlay(); if (t) t.done(); else renderCellPropertiesPanel(); }

// Choose-content filter — which of the two lists to show (memory only).
rt.contentFilter = 'all';
export function syncContentFilter() {
  ctrl('content-sec-seeds').style.display = rt.contentFilter === 'components' ? 'none' : '';
  ctrl('content-sec-components').style.display = rt.contentFilter === 'seeds' ? 'none' : '';
  ctrl('seg-content-filter').querySelectorAll('.seg-btn').forEach(b => {
    const on = b.dataset.filter === rt.contentFilter;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
export function closeCellContentOverlay() {
  ctrl('symbol-content-overlay').style.display = 'none';
  overlayTarget = null;
  ctrl('chk-content-overlay-all').checked = false;   // disarm so a later single-cell edit isn't hijacked
}

// The overlay fills the selected cell(s) with a Component or Empty — a Symbol is built from saved
// Components only, so the raw Seeds are no longer offered; old Symbols with Seed cells still render.
// Which fitMode fresh content picked from this overlay gets — sticky for the
// session (same convention as contentFilter below), not reset on close: a
// deliberate visible choice, unlike "Apply to all cells" which IS reset
// (that one guards against an accidental bulk edit; this one doesn't carry
// that risk — a wrong fit is obvious immediately and easy to redo).
export function renderCellContentOverlayTiles() {
  const toAll = pc('chk-content-overlay-all');
  const count = overlayTarget ? overlayTarget.count() : state.symbolSelection.size;
  ctrl('symbol-content-overlay__title').textContent = toAll ? 'Choose content for all cells' : count > 1 ? `Choose content for ${count} cells` : 'Choose content';

  const elWrap = ctrl('symbol-content-overlay__seeds');
  elWrap.innerHTML = '';
  const emptyBtn = document.createElement('button');
  emptyBtn.className = 'fvs-library-item';
  emptyBtn.title = 'Empty — leave the cell blank';
  emptyBtn.setAttribute('aria-label', 'Use Empty (blank cell)');
  emptyBtn.innerHTML = '<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="10" y="10" width="52" height="52" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 4"/></svg>';
  emptyBtn.addEventListener('click', () => {
    contentTarget()(() => ({ source: 'empty', rotation: 0, flipH: false, flipV: false, fitMode: live.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0 }));
    pickDone();
  });
  elWrap.appendChild(emptyBtn);
  ['arc', 'arctruchet', 'blob', 'chevron', 'circle', 'cross', 'drop', 'lens', 'polygon', 'roundedrect', 'star', 'triangle', 'wedge'].forEach(type => {   // alphabetical (UI only — generateSymbolCells' seeded seedTypes array is deliberately NOT reordered)
    const svgStr = buildSeedPreviewSVG({ type, ...SYMBOL_SEED_DEFAULTS }, 0, false, false, 72);
    const btn = document.createElement('button');
    btn.className = 'fvs-library-item';
    btn.title = SEED_TYPES[type].label;
    btn.setAttribute('aria-label', 'Use ' + SEED_TYPES[type].label);
    btn.innerHTML = svgStr;
    btn.addEventListener('click', () => {
      contentTarget()(cell => ({
        source: 'seed', seedType: type, color: cell.color || null,
        rotation: 0, flipH: false, flipV: false,
        fitMode: live.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0,
      }));
      pickDone();
    });
    elWrap.appendChild(btn);
  });

  const library = LIBRARY.read();
  const libNames = libraryNames(library);
  ctrl('symbol-content-overlay__components-empty').style.display = libNames.length ? 'none' : '';
  const compWrap = ctrl('symbol-content-overlay__components');
  compWrap.innerHTML = '';
  compWrap.appendChild(emptyBtn);
  for (const name of libNames) {
    const entry = library[name];
    const size = frameDims(entry.grid);
    // Entry's own saved colours/paper, not the live Palette — same rule
    // renderLibrary()'s own thumbnails already follow.
    const savedColorAt = entryInkAt(entry);
    const items = buildComponentItems({ cells: entry.component.cells }, entry.grid)
      .map((it, j) => ({ ...it, color: savedColorAt(j) }));
    const svgStr = withEntryInks(entry.colors, () => buildComponentSVGWithPaper(items, entry.seed, size, entry.paperColor, entry.role, entry.underlyingComponentName, entry.blend));
    const btn = document.createElement('button');
    btn.className = 'fvs-library-item';
    const box = fitThumbBox(size.w, size.h, 76);
    btn.style.width = box.w + 'px'; btn.style.height = box.h + 'px';
    btn.title = name;
    btn.setAttribute('aria-label', 'Use Component ' + name);
    btn.innerHTML = svgStr;
    btn.addEventListener('click', () => {
      contentTarget()({
        source: 'component', componentName: name, span: true, colourway: null,   // a rectangular Component takes its block where it fits
        rotation: 0, flipH: false, flipV: false,
        fitMode: live.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0,
      });
      pickDone();
    });
    const item = document.createElement('div');
    const cap = document.createElement('span');
    cap.className = 'fvs-library-caption';
    cap.textContent = name;
    item.append(btn, cap);
    compWrap.appendChild(item);
  }
  // The Element itself as cell content: as it is, and in the six states of the Element
  // step's own preview strip. The cell keeps the Element's settings as they are now
  // (seedParams, like Cell properties → Use Element) and the turn / flip of the tile.
  const elSec = ctrl('content-sec-element'), elTiles = ctrl('symbol-content-overlay__element');
  elTiles.innerHTML = '';
  elSec.style.display = elementIsEmpty() ? 'none' : '';
  if (!elementIsEmpty()) {
    const seedNow = getSeed();   // not `live`: that name is the module's run-time values (contentOverlayFit is read below)
    [[0, false, false, 'As it is'], ...seedPreviewStates().slice(1)].forEach(([r, fh, fv, label]) => {   // the strip's own 0° is "As it is" here
      const btn = document.createElement('button');
      btn.className = 'fvs-library-item';
      btn.title = 'Element · ' + label;
      btn.setAttribute('aria-label', 'Use the Element — ' + label);
      btn.innerHTML = buildSeedPreviewSVG(seedNow, r, fh, fv, 72);
      btn.addEventListener('click', () => {
        const sp = JSON.parse(JSON.stringify(seedForSnapshot()));
        // A layer that follows the cell colour would take a different ink in every cell (the Symbol's
        // colour rule) and vanish wherever that ink is also another layer's own. Here it is pinned to
        // the ink the Element step shows it in — the palette's first — so every cell shows all layers.
        if (sp.type === 'stack') sp.layers.forEach(l => { if (l.ink == null || l.ink === 'cell') l.ink = 0; });
        contentTarget()(cell => ({
          source: 'seed', seedType: sp.type, seedParams: JSON.parse(JSON.stringify(sp)), color: cell.color || null, ownColors: null, ownPaper: null, ownAppearance: null, colourway: null,
          rotation: r, flipH: fh, flipV: fv,
          fitMode: live.contentOverlayFit, scale: 1, padding: 0, anchorX: 0, anchorY: 0,
        }));
        pickDone();
      });
      const item = document.createElement('div');
      const cap = document.createElement('span');
      cap.className = 'fvs-library-caption';
      cap.textContent = label;
      item.append(btn, cap);
      elTiles.appendChild(item);
    });
  }
  // The plain default Seeds are not Symbol content any more: that list and the filter stay hidden.
  ctrl('content-sec-seeds').style.display = 'none';
  ctrl('seg-content-filter').style.display = 'none';
  Organica.autoLabelPanel(ctrl('symbol-content-overlay'));
}


export function applyRuleState(s) {
  if (!s) return;
  RULE_CONTROL_IDS.forEach(id => {
    if (s[id] == null) return;
    const el = ctrl(id);
    if (el.type === 'checkbox') el.checked = !!s[id]; else el.value = s[id];
    const v = ctrl(id.replace(/^rg-/, 'v-')); if (v && el.type === 'range') v.textContent = el.value;
  });
  ctrl('symbol-rule-block').style.display = pv('sel-symbol-fill') === 'rule' ? '' : 'none';
  ctrl('symbol-generate-block').style.display = pv('sel-symbol-fill') === 'generate' ? '' : 'none';
  ctrl('symbol-suggest-block').style.display = pv('sel-symbol-fill') === 'suggest' ? '' : 'none';
  syncManualBlock();
  syncSymbolRuleUI();
}


export function saveSymbolAs(chosen) {
  const entry = buildSymbolLibraryEntry();
  if (!entry) return;
  const all = SYMBOL_LIBRARY.read();
  let name = chosen;
  for (let i = 2; all[name]; i++) name = `${chosen} (${i})`;
  all[name] = entry;
  if (!SYMBOL_LIBRARY.write(all)) return;   // storage full: the store showed the notice — the Symbol stays unsaved (dirty)
  Organica.dirty.set('fvs-symbol', false);
  renderSymbolLibrary();
}
export function removeSymbolLibraryEntry(name) {
  const all = SYMBOL_LIBRARY.read();
  delete all[name];
  SYMBOL_LIBRARY.write(all);
  renderSymbolLibrary();
}

export function applySymbolLibraryEntryToUI(entry) {
  state.symbolGrid = Organica.loadLoomGrid(entry.gridModel);
  if (symbolCanvasOf(state.symbolGrid)) applySymbolCanvasToUI(symbolCanvasOf(state.symbolGrid));
  if (entry.pool || entry.palette) { state.symbolPool = (entry.pool || entry.palette).map(p => ({ ...p })); renderSymbolPool(); }
  if (entry.arrange) { ctrl('sel-sym-arrange').value = entry.arrange.rule; ctrl('sel-sym-arrange-fit').value = entry.arrange.fit; ctrl('num-symbol-seed').value = entry.arrange.seed; }
  state.symbolCells = entry.cells.map(c => withPlacementDefaults({ ...c }));
  Organica.dirty.set('fvs-symbol', false);   // a loaded saved Symbol matches the library
  state.symbolSelection.clear();
  state.colors = entry.colors.map(hexKey);
  state.colorRule = { ...DEFAULT_COLOR_RULE, ...(entry.colorRule || {}) };
  syncColorRuleUI();
  // Older saves pinned each cell to its palette colour — release those pins
  // (cellInk) so the palette drives them; genuinely different colours stay.
  state.symbolCells.forEach((c, i) => { if (c.color && String(c.color).toLowerCase() === String(ruleInk(i, symbolCR())).toLowerCase()) c.color = null; });
  buildPalette();
  state.paperColor = hexKey(entry.paperColor);
  hooks.setPaperUI(entry.paperColor);
  // Old saved Symbols (pre-Clip-to-cell) have no clipEnabled field — back-
  // filled to true, matching withPlacementDefaults' own convention of
  // restoring exactly the pre-feature behaviour for anything not saved.
  state.symbolClipEnabled = entry.clipEnabled !== false;
  hooks.syncSymbolViewUI();
  state.symbolOverlap = { amount: 0, blend: 'under', drawnBy: 'nearest', ...(entry.overlap || {}) };
  syncOverlapSection();
  applyAppearanceToUI(entry.appearance);
  applyRuleState(entry.rule);
  renderSymbol();
}

export function renderSymbolLibrary() { hooks.renderLibraryRail(); }

export function exportSymbol(format) {
  const grid = getSymbolGrid();
  if (!grid) return;
  const F = symbolFrame(grid);
  const cv = symbolCanvasOf(state.symbolGrid);
  if (cv && cv.mode === 'print') { exportSymbolPrint(format, F, cv); return; }
  if (format === 'svg') {
    Organica.download(new Blob([buildSymbolSVG()], { type: 'image/svg+xml' }), Organica.stamp('fvs-symbol', 'svg'));
    return;
  }
  const scale = parseInt(pv('sel-export-scale'), 10);
  const off = document.createElement('canvas');
  off.width = Math.round(F.w * scale); off.height = Math.round(F.h * scale);
  const ctx = off.getContext('2d');
  ctx.save();
  ctx.scale(scale, scale);
  drawSymbolCanvas(ctx);
  ctx.restore();
  off.toBlob(blob => { Organica.download(blob, Organica.stamp('fvs-symbol', 'png')); });
}

export function exportSymbolPrint(format, F, cv) {
  if (format === 'svg') {
    Organica.download(new Blob([buildSymbolPrintSVG(F, cv)], { type: 'image/svg+xml' }), Organica.stamp('fvs-symbol', 'svg'));
    return;
  }
  const d = symbolPrintDims(F, cv);
  const off = document.createElement('canvas');
  off.width = d.trimWpx + 2 * d.bleedPx; off.height = d.trimHpx + 2 * d.bleedPx;
  const ctx = off.getContext('2d');
  fillPaper(ctx, state.paperColor, 0, 0, off.width, off.height);
  ctx.save();
  ctx.translate(d.bleedPx, d.bleedPx);
  ctx.scale(d.trimWpx / F.w, d.trimHpx / F.h);
  drawSymbolCanvas(ctx);
  ctx.restore();
  if (d.bleedPx > 0) {
    ctx.save(); ctx.translate(d.bleedPx, d.bleedPx);
    Organica.printSize.drawCropMarksCanvas(ctx, d.trimWpx, d.trimHpx, {}, '#000');
    ctx.restore();
  }
  off.toBlob(async blob => {
    const bytes = Organica.printSize.embedPngDpi(await blob.arrayBuffer(), d.dpi);
    Organica.download(new Blob([bytes], { type: 'image/png' }), Organica.stamp('fvs-symbol', 'png'));
  });
}
