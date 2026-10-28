// Flexible Visual System · 11-selection-ui — the Symbol's selection is the interaction (Oct 28, 2026 — Diego, after Zones:
// "selection will be made only by the users with click or drag selection"). Cells picked on the canvas (click, drag,
// ⌘ / Shift) get a dot in the sheet's margin, wired to the last picked cell. The dot opens the Selection section of the
// right bar: Lock · Save selection · Clear; Content (the items A, B, C… dropped on the square drop target beside the
// dot, or picked with Choose content); Arrange (visual tiles: how the items share the selection); Transform; Rule (a
// Symbol rule or a generator — Symmetry, Continuity, Field); Cells. A saved selection stays live: its dot stays on the
// sheet (faded), its content and rule apply again whenever the Symbol is drawn anew (a resize keeps whole rows / columns).
// The evaluator is engine/11-zones applyZones (shared with the Figure's region rules); a saved selection is stored in
// state.symbolZones as { name, when, fill, rule, off } (entry.zones). An ES module of fvs/js/main.js. Map docs/FVS.md §6c, §11.
import {
  live, pv, state
} from './engine/00-core.js';
import {
  ELEMENT_LIB, savedElementThumb
} from './engine/04-appearance.js';
import {
  savedElementEntrySVG
} from './engine/05-render-component.js';
import {
  LIBRARY
} from './engine/07-library.js';
import {
  getSymbolGrid, symbolFrame, withPlacementDefaults
} from './engine/08-symbol-grid.js';
import {
  SYMBOL_ARRANGE, componentThumbSVG, symbolCellContext
} from './engine/10-suggest.js';
import {
  SYMBOL_LIBRARY, SYMBOL_RULES, symbolPastePlan
} from './engine/11-symbol-ui.js';
import {
  SEL_ARRANGE, SEL_SEQS, SEL_WALKS, ZONE_FOLLOW, applyZones, arrangeLetters, contentOfCell, whenFromCells, zoneCells, zoneContexts
} from './engine/11-zones.js';
import {
  ctrl
} from './00-core.js';
import {
  renderSuggestGallery
} from './10-suggest.js';
import {
  applyToSelection, openCellContentOverlay, renderCellPropertiesPanel, renderSymbol, renderSymbolCanvasOnly, syncSymbolRuleUI
} from './11-symbol-ui.js';
import { hooks, provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  applySelectionsNow: () => applySelectionsNow, renderSelectionPanel: () => renderSelectionPanel, selectionOverlay: () => selectionOverlay,
  selectionLettersSVG: () => selectionLettersSVG, selectionDrop: () => selectionDrop, symbolPaste: () => symbolPaste,
  selectionRuleEdit: () => selectionRuleEdit, selectionTouched: () => selectionTouched, selectionTakeDos: () => selectionTakeDos,
  heldBySelections: () => heldBySelections
});

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const clone = o => JSON.parse(JSON.stringify(o));
const ctxsNow = () => { const g = getSymbolGrid(); return g ? zoneContexts(g) : []; };
const newSeed = () => 1 + Math.floor(Math.random() * 99999);
const LETTER = k => String.fromCharCode(65 + (k % 26));

// ── The model ────────────────────────────────────────────────
// A saved selection: { name, when, fill, rule, off }. fill = what goes in the cells ({arrange} · {content} · {empty}),
// rule = how they turn ({symbolRule} · {follow}). The Zones of Oct 27 ({when, do}, never pushed) are not selections
// anyone saved: they are dropped (what they did is already in the cells), so they draw no dot.
const isSaved = z => !!z && z.when && (z.fill !== undefined || z.rule !== undefined);
const savedList = () => { const z = state.symbolZones || []; if (!z.every(isSaved)) state.symbolZones = z.filter(isSaved); return state.symbolZones; };
const rulesOf = (when, z) => [z.fill && { when, do: z.fill, off: z.off }, z.rule && { when, do: z.rule, off: z.off }].filter(Boolean);
// The selection on show: a saved one (state.selPick) or the cells just picked (state.selDraft, kept until the selection
// changes — what it did stays in the cells).
function current() {
  if (state.selPick != null) { const z = savedList()[state.selPick]; if (z) return z; state.selPick = null; }
  if (!state.selDraft) state.selDraft = { fill: null, rule: null };
  return state.selDraft;
}
const draftWhen = () => ({ index: [...state.symbolSelection].sort((a, b) => a - b) });
const itemsOf = z => (z.fill && z.fill.arrange ? z.fill.arrange.pool : z.fill && z.fill.content ? [z.fill.content] : []) || [];

// Every saved selection, then the open draft, written into the cells (the cells stay what is saved and drawn).
export function applySelectionsNow(opts = {}) {
  const grid = getSymbolGrid(); if (!grid) return;
  const rules = savedList().flatMap(z => rulesOf(z.when, z));
  if (state.selOpen && state.selPick == null && state.selDraft && state.symbolSelection.size) rules.push(...rulesOf(draftWhen(), state.selDraft));
  if (rules.length) state.symbolCells = applyZones(state.symbolCells, grid, rules).cells;
  if (opts.quiet) return;
  state.symbolSuggestions = []; renderSuggestGallery();
  renderSymbol();
}
// Cells a saved selection holds (Suggest leaves them as they are).
export function heldBySelections() {
  const ctxs = ctxsNow(), out = new Set();
  savedList().forEach(z => { if (!z.off && (z.fill || z.rule)) zoneCells(z.when, ctxs).forEach(i => out.add(i)); });
  return out;
}
// The canvas selection changed by hand (11-symbol-ui): the panel closes, the draft ends.
export function selectionTouched(last) {
  if (last != null) state.selLast = last;
  state.selOpen = false; state.selPick = null; state.selDraft = null; hoverRule = null;
  renderSelectionPanel();
}
function openSelection() {
  if (!state.symbolSelection.size) return;
  state.selOpen = true;
  renderSymbolCanvasOnly(); renderCellPropertiesPanel(); renderSelectionPanel();
  const t = document.querySelector('.fvs-sel-dot'); if (t) t.classList.add('is-pop');
}
function openSaved(i) {
  const z = savedList()[i]; if (!z) return;
  const idxs = zoneCells(z.when, ctxsNow());
  state.symbolSelection = new Set(idxs); state.selLast = idxs.length ? Math.max(...idxs) : null;
  state.selPick = i; state.selDraft = null; state.selOpen = true;
  renderSymbolCanvasOnly(); renderCellPropertiesPanel(); renderSelectionPanel();
}
function closeSelection() {
  state.selOpen = false; state.selPick = null; state.selDraft = null; hoverRule = null;
  renderSymbolCanvasOnly(); renderSelectionPanel();
}

// ── Content: items A, B, C… ──────────────────────────────────
// Dropped on the square drop target (15-export-library-view), or picked with Choose content (one item, the old way).
function itemFor(kind, name) {
  if (kind === 'component') return LIBRARY.peek()[name] ? { kind, name } : null;
  const e = ELEMENT_LIB.read()[name];
  return e && e.seed ? { kind: 'element', name, entry: clone(e) } : null;
}
function setItems(items) {
  const z = current(), prev = z.fill && z.fill.arrange;
  if (!items.length) z.fill = null;
  else z.fill = { arrange: { rule: (prev && prev.rule) || 'checker', walk: prev && prev.walk, seq: prev && prev.seq, seed: (prev && prev.seed) || newSeed(), fit: (prev && prev.fit) || live.contentOverlayFit, pool: items, local: true } };
  applySelectionsNow();
  renderSelectionPanel();
}
export function selectionDrop(kind, name) {
  if (!state.symbolSelection.size) return;
  const it = itemFor(kind, name); if (!it) return;
  if (!state.selOpen) state.selOpen = true;
  setItems([...itemsOf(current()), it]);
  const d = document.querySelector('.fvs-sel-drop'); if (d) d.classList.add('is-pop');
}
// A saved Symbol dragged onto a cell (Oct 28, 2026): pasted cell by cell, its 4 central cells from that cell — as
// Compose does (symbolPastePlan); what falls outside the grid is cut.
export function symbolPaste(name, idx) {
  const entry = SYMBOL_LIBRARY.read()[name], ctxs = ctxsNow(); if (!entry || !ctxs[idx]) return;
  const plan = symbolPastePlan(entry, ctxs, [ctxs[idx].row, ctxs[idx].col]);
  plan.forEach(([ti, c]) => { const cell = state.symbolCells[ti]; if (cell && !cell.locked) state.symbolCells[ti] = withPlacementDefaults(clone(c)); });
  renderSymbol();
}
// Choose content in the Selection section adds an item too: the window's pick, kept as the content it puts in a cell
const chooseItem = () => openCellContentOverlay({
  count: () => state.symbolSelection.size,
  apply: patch => { const p = typeof patch === 'function' ? patch({}) : patch; const tpl = contentOfCell(p); setItems([...itemsOf(current()), { tpl, label: p.source === 'component' ? p.componentName : p.source === 'empty' ? 'Empty' : (p.seedType || 'Element') }]); },
  done: () => {},
});
const thumbOf = it => { try { if (it.tpl) return it.tpl.source === 'component' ? componentThumbSVG(it.tpl.componentName) : ''; if (it.kind === 'element') return it.entry && !it.entry.thumb && it.entry.seed ? savedElementEntrySVG(it.entry) : savedElementThumb(it.entry); return componentThumbSVG(it.name); } catch (e) { return ''; } };

// ── Arrange ──────────────────────────────────────────────────
const ARR_LABEL = { checker: 'Checkerboard', rows: 'Rows', columns: 'Columns', diagonal: 'Diagonal', blocks: '2 × 2 blocks', rings: 'Rings', sectors: 'Sectors', wave: 'Wave', random: 'Random' };
const WALK_LABEL = { reading: 'Reading', snake: 'Snake', spiral: 'Spiral', diagonal: 'Diagonal', rings: 'Rings' };
const SEQ_LABEL = { ABC: 'A B C', ABB: 'A B B', AABB: 'A A B B', ABCB: 'A B C B' };
const arrKey = a => (a.rule === 'rhythm' ? 'rhythm:' + (a.walk || 'reading') : a.rule);
const specOf = key => (key.startsWith('rhythm:') ? { rule: 'rhythm', walk: key.slice(7) } : { rule: key });
let hoverRule = null;   // a tile under the pointer: its letters shown on the canvas
function lettersFor(spec, n) {
  const grid = getSymbolGrid(); if (!grid || !state.symbolSelection.size) return new Map();
  const idxs = [...state.symbolSelection], seq = (current().fill && current().fill.arrange && current().fill.arrange.seq) || 'ABC';
  return arrangeLetters(idxs, symbolCellContext(grid), zoneContexts(grid), n, { ...spec, seq }, Organica.mulberry32(7));
}
// A tile: the selection's own cells, drawn small, each in its letter's tint (ink at 85 / 50 / 20 % on paper) with the letter.
const TINTS = [85, 50, 20, 70, 35];
function tileSVG(spec, n) {
  const grid = getSymbolGrid(), L = lettersFor(spec, n);
  if (!grid || !L.size) return '';
  const cells = [...L.keys()].map(i => grid.cells[i]).filter(Boolean);
  const box = c => (c.points ? c.points.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]) : [c.x, c.y, c.x + c.width, c.y + c.height]);
  const B = cells.map(box).reduce((b, x) => [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  const w = B[2] - B[0] || 1, h = B[3] - B[1] || 1, pad = 0.04 * Math.max(w, h);
  let s = '';
  L.forEach((k, i) => {
    const c = grid.cells[i]; if (!c) return;
    const tint = `color-mix(in srgb, var(--ink) ${TINTS[k % TINTS.length]}%, var(--paper))`;
    const shape = c.points ? `<polygon points="${c.points.map(p => p.join(',')).join(' ')}"` : `<rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}"`;
    const b = box(c), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, fs = 0.5 * Math.min(b[2] - b[0], b[3] - b[1]);
    s += `${shape} style="fill:${tint};stroke:var(--paper)" stroke-width="${(0.012 * Math.max(w, h)).toFixed(2)}"/>`;
    if (L.size <= 64) s += `<text x="${cx}" y="${cy}" font-size="${fs.toFixed(2)}" text-anchor="middle" dominant-baseline="central" style="fill:${TINTS[k % TINTS.length] >= 50 ? 'var(--paper)' : 'var(--ink)'};font-family:var(--font-display)">${LETTER(k)}</text>`;
  });
  return `<svg viewBox="${B[0] - pad} ${B[1] - pad} ${w + 2 * pad} ${h + 2 * pad}" aria-hidden="true">${s}</svg>`;
}
// The hovered tile's letters on the canvas itself (screen only).
export function selectionLettersSVG() {
  if (!hoverRule || !state.selOpen) return '';
  const grid = getSymbolGrid(), n = itemsOf(current()).length; if (!grid || n < 2) return '';
  const F = symbolFrame(grid), L = lettersFor(specOf(hoverRule), n);
  let s = '';
  L.forEach((k, i) => {
    const c = grid.cells[i]; if (!c) return;
    const b = c.points ? c.points.reduce((t, p) => [Math.min(t[0], p[0]), Math.min(t[1], p[1]), Math.max(t[2], p[0]), Math.max(t[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]) : [c.x, c.y, c.x + c.width, c.y + c.height];
    const fs = 0.45 * Math.min(b[2] - b[0], b[3] - b[1]);
    s += `<text class="fvs-sel-letter" x="${F.X((b[0] + b[2]) / 2).toFixed(2)}" y="${F.Y((b[1] + b[3]) / 2).toFixed(2)}" font-size="${fs.toFixed(2)}">${LETTER(k)}</text>`;
  });
  return `<g aria-hidden="true">${s}</g>`;
}

// ── Rule ─────────────────────────────────────────────────────
function readRule() {
  const name = pv('sel-symbol-rule'), r = SYMBOL_RULES[name];
  return { name, params: r ? r.read() : {}, seed: parseInt(pv('num-rule-seed'), 10) || 0, vary: { rotation: ctrl('chk-rule-rotation').checked, flip: ctrl('chk-rule-flip').checked, scale: ctrl('chk-rule-scale').checked } };
}
// A Rule-block control changed while the Selection section shows a Symbol rule: it edits that rule (11-symbol-ui
// applySymbolRule asks first). → true when it did.
export function selectionRuleEdit() {
  if (!state.selOpen) return false;
  const z = current(); if (!z.rule || !z.rule.symbolRule) return false;
  z.rule = { symbolRule: readRule() };
  applySelectionsNow();
  return true;
}
function ruleOptions() {
  const grid = getSymbolGrid(), ctxs = ctxsNow(), idxs = [...state.symbolSelection], groups = new Map(), rng = Organica.mulberry32(1);
  if (!grid || !idxs.length) return groups;
  Object.entries(ZONE_FOLLOW).forEach(([id, G]) => {
    if (id === 'rhythm') return;   // Rhythm is an Arrange (it takes the items)
    if (G.applies && !G.applies(grid, idxs, ctxs)) return;
    (G.space ? G.space(grid, idxs, ctxs, rng) : [{}]).forEach(params => {
      const list = groups.get(G.label) || []; list.push({ v: id + '|' + JSON.stringify(params), t: (G.caption ? G.caption(params) : G.label) + (G.words && G.words(params) ? ' — ' + G.words(params) : '') }); groups.set(G.label, list);
    });
  });
  if (groups.has('Field')) groups.get('Field').push(...['content', 'turn', 'scale', 'empty'].map(drive => ({ v: 'photo|' + drive, t: 'Field · a photo → ' + { content: 'which content', turn: 'the turn', scale: 'the size', empty: 'holes' }[drive] + '…' })));
  return groups;
}
function pickPhoto(drive) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0]; if (!f) { renderSelectionPanel(); return; }
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const N = 32, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
      const g = cv.getContext('2d'), sq = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - sq) / 2, (img.height - sq) / 2, sq, sq, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data; let bin = '';
      for (let k = 0; k < N * N; k++) bin += String.fromCharCode(Math.round(0.2126 * d[k * 4] + 0.7152 * d[k * 4 + 1] + 0.0722 * d[k * 4 + 2]));
      URL.revokeObjectURL(url);
      current().rule = { follow: { id: 'field', params: { signal: 'photo', lum: btoa(bin), drive }, seed: newSeed() } };
      applySelectionsNow(); renderSelectionPanel();
    };
    img.src = url;
  });
  inp.click();
}
// A Suggest variation clicked while a selection is open: the selection takes what the variation gave it.
export function selectionTakeDos(dos) {
  if (!state.selOpen || !dos || !dos.length) return;
  const z = current();
  dos.forEach(d => { if (d.symbolRule || d.follow) z.rule = clone(d); else z.fill = clone(d); });
  renderSelectionPanel();
}

// ── The panel ────────────────────────────────────────────────
export function renderSelectionPanel() {
  const sec = ctrl('sym-selection-section'); if (!sec) return;
  const n = state.symbolSelection.size, open = state.selOpen && n > 0;
  sec.hidden = !open;
  if (!open) { parkRuleBlock(); return; }
  const z = current(), saved = state.selPick != null, items = itemsOf(z);
  ctrl('sel-title').textContent = saved ? (z.name || 'Selection ' + (state.selPick + 1)) : n + (n === 1 ? ' cell' : ' cells');
  ctrl('sel-sub').textContent = saved ? n + (n === 1 ? ' cell' : ' cells') : '';
  const locked = [...state.symbolSelection].every(i => state.symbolCells[i] && state.symbolCells[i].locked);
  ctrl('btn-sel-lock').setAttribute('aria-pressed', String(locked));   // the name stays "Lock cells": pressed carries the state
  ctrl('btn-sel-save').hidden = saved;
  ctrl('btn-sel-rename').hidden = !saved;
  ctrl('btn-sel-delete').hidden = !saved;
  ctrl('btn-sel-clear').setAttribute('aria-label', 'Clear ' + n + (n === 1 ? ' cell' : ' cells'));
  // items
  ctrl('sel-items').innerHTML = items.length ? items.map((it, k) => `<div class="org-layer-card org-layer-card--flush fvs-sel-item" role="listitem"><div class="org-layer-card__head">
      <span class="fvs-sel-item__letter" aria-hidden="true">${LETTER(k)}</span><span class="fvs-sel-item__thumb" aria-hidden="true">${thumbOf(it)}</span>
      <span class="org-layer-card__title">${esc(it.label || it.name || 'Item')}</span>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="up" data-k="${k}" aria-label="Move ${LETTER(k)} earlier"${k === 0 ? ' disabled' : ''}>${Organica.icons.get('chevron-up')}</button>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="del" data-k="${k}" aria-label="Remove ${LETTER(k)}">${Organica.icons.get('close')}</button></div></div>`).join('')
    : '<p class="org-empty">Drag Elements or Components onto the square dot beside the selection: each one is a letter, A, B, C…</p>';
  // arrange
  const multi = items.length >= 2, a = z.fill && z.fill.arrange;
  ctrl('sel-arrange-block').hidden = !multi;
  if (multi) {
    const cur = a ? arrKey(a) : '';
    const keys = [...SEL_ARRANGE.filter(r => SYMBOL_ARRANGE[r] || r === 'random'), ...SEL_WALKS.map(w => 'rhythm:' + w)];
    ctrl('sel-arrange').innerHTML = keys.map(key => {
      const label = key.startsWith('rhythm:') ? 'Rhythm · ' + WALK_LABEL[key.slice(7)] : ARR_LABEL[key];
      return `<button type="button" class="fvs-suggest__item fvs-arrange-tile${key === cur ? ' is-current' : ''}" data-arr="${key}" aria-pressed="${key === cur}" aria-label="Arrange: ${esc(label)}"><span class="fvs-arrange-tile__map org-stage" data-theme="light">${tileSVG(specOf(key), items.length)}</span><span class="fvs-arrange-tile__label">${esc(label)}</span></button>`;
    }).join('');
    ctrl('sel-seq-row').hidden = !(a && a.rule === 'rhythm');
    ctrl('sel-seq').querySelectorAll('[data-seq]').forEach(b => { const on = b.dataset.seq === ((a && a.seq) || 'ABC'); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  }
  // rule
  const groups = ruleOptions(), r = z.rule;
  const fp = r && r.follow && r.follow.params, curR = !r ? '' : r.symbolRule ? 'rule|' + r.symbolRule.name : r.follow.id === 'field' && fp && fp.signal === 'photo' ? 'photo|' + fp.drive : r.follow.id + '|' + JSON.stringify(fp || {});
  const ruleNames = [...ctrl('sel-symbol-rule').options].map(o => ({ v: 'rule|' + o.value, t: o.textContent }));
  ctrl('sel-sel-rule').innerHTML = '<option value="">None</option>'
    + `<optgroup label="Turns and flips">${ruleNames.map(o => `<option value="${esc(o.v)}"${o.v === curR ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</optgroup>`
    + [...groups].map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(o => `<option value="${esc(o.v)}"${o.v === curR ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</optgroup>`).join('');
  const rb = ctrl('symbol-rule-block');
  if (r && r.symbolRule) {
    if (rb.parentElement !== ctrl('sel-rule-host')) ctrl('sel-rule-host').appendChild(rb);
    rb.classList.add('is-selection'); rb.hidden = false;
    if (!rb._syncing) {
      rb._syncing = true;
      const sr = r.symbolRule;
      ctrl('sel-symbol-rule').value = sr.name;
      (SYMBOL_RULES[sr.name] ? SYMBOL_RULES[sr.name].fields : []).forEach(f => {
        const el = ctrl(f.id), v = sr.params ? sr.params[f.key] : undefined; if (!el || v === undefined) return;
        if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
        const out = ctrl(f.id.replace(/^rg-/, 'v-')); if (out && f.id.startsWith('rg-')) out.textContent = el.value;
      });
      if (sr.vary) { ctrl('chk-rule-rotation').checked = sr.vary.rotation !== false; ctrl('chk-rule-flip').checked = !!sr.vary.flip; ctrl('chk-rule-scale').checked = !!sr.vary.scale; }
      ctrl('num-rule-seed').value = sr.seed;
      syncSymbolRuleUI();
      rb._syncing = false;
    }
  } else parkRuleBlock();
}
function parkRuleBlock() { const rb = ctrl('symbol-rule-block'); if (rb) rb.hidden = true; }

// ── On the canvas: the dot, its wire, the drop target, the saved selections' dots ─────────────
// HTML over the sheet (as the % labels): the dot sits in the margin on the side of the cell it is wired to — left or right
// (the shared wire is horizontal: design-system CONSULT, Oct 28, 2026).
export function selectionOverlay() {
  const frame = ctrl('symbol-frame'), old = document.getElementById('sym-sel-overlay');
  if (old) old.remove();
  const grid = getSymbolGrid(), svgEl = frame && frame.querySelector('svg');
  if (!grid || !svgEl || state.activeTier !== 'symbol') return;
  const F = symbolFrame(grid), svgR = svgEl.getBoundingClientRect(), frameR = frame.getBoundingClientRect();
  if (!svgR.width) return;
  const zoom = parseFloat(getComputedStyle(frame).getPropertyValue('--nc-zoom')) || 1;
  const scale = Math.min(svgR.width / F.w, svgR.height / F.h) / zoom;
  const offX = (svgR.left - frameR.left) / zoom + (svgR.width / zoom - F.w * scale) / 2, offY = (svgR.top - frameR.top) / zoom + (svgR.height / zoom - F.h * scale) / 2;
  // clear of the row % labels in the same margin: the dot 2.5 × --space-8 out, the drop target one --space-6 further
  const tok = k => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)) || 0;
  const gap = 2.5 * (tok('--space-8') || 32), step = tok('--space-6') || 16;
  const bx = (x, y) => [offX + F.X(x) * scale, offY + F.Y(y) * scale];
  const boxOf = i => { const c = grid.cells[i]; if (!c) return null; const b = c.points ? c.points.reduce((t, p) => [Math.min(t[0], p[0]), Math.min(t[1], p[1]), Math.max(t[2], p[0]), Math.max(t[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]) : [c.x, c.y, c.x + c.width, c.y + c.height]; const a = bx(b[0], b[1]), z = bx(b[2], b[3]); return [a[0], a[1], z[0], z[1]]; };
  const left = offX, right = offX + F.w * scale;
  const wrap = document.createElement('div');
  wrap.id = 'sym-sel-overlay'; wrap.className = 'fvs-sel-overlay';
  let wires = '';
  const place = (i, out = 0) => {
    const b = boxOf(i); if (!b) return null;
    const cy = (b[1] + b[3]) / 2, onLeft = (b[0] + b[2]) / 2 < (left + right) / 2;
    const x = onLeft ? left - gap - step * out : right + gap + step * out;
    return { x, y: cy, from: onLeft ? [b[0], cy] : [b[2], cy], onLeft };
  };
  const wire = (p, cls) => { const a = p.onLeft ? [p.x, p.y] : p.from, z = p.onLeft ? p.from : [p.x, p.y]; wires += `<path class="nc-wire nc-wire--content${cls}" d="${Organica.nodeCanvas.wirePath(a[0], a[1], z[0], z[1])}"/>`; };
  const dot = (p, cls, attrs) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'nc-port__dot fvs-sel-anchor ' + cls; b.dataset.type = 'content'; b.style.left = p.x.toFixed(1) + 'px'; b.style.top = p.y.toFixed(1) + 'px'; Object.entries(attrs).forEach(([k, v]) => b.setAttribute(k, v)); wrap.appendChild(b); return b; };
  // saved selections: a faded dot each (not the one on show)
  const ctxs = zoneContexts(grid);
  savedList().forEach((z, k) => {
    if (k === state.selPick) return;
    const idxs = zoneCells(z.when, ctxs); if (!idxs.length) return;
    const p = place(Math.max(...idxs)); if (!p) return;
    wire(p, ' nc-wire--faint');
    dot(p, 'fvs-sel-saved', { 'data-saved': String(k), 'aria-label': 'Open ' + (z.name || 'Selection ' + (k + 1)) });
  });
  // the selection on show
  if (state.symbolSelection.size) {
    const n = state.symbolSelection.size, last = state.symbolSelection.has(state.selLast) ? state.selLast : Math.max(...state.symbolSelection);
    const p = place(last);
    if (p) {
      wire(p, '');
      const d = dot(p, 'fvs-sel-dot', { 'aria-expanded': String(!!state.selOpen), 'aria-controls': 'sym-selection-section', 'aria-label': 'Selection: ' + n + (n === 1 ? ' cell' : ' cells') });
      if (state.selOpen) {
        const q = place(last, 1);
        dot(q, 'nc-port__dot--multi fvs-sel-drop', { 'aria-label': 'Add content to the selection — drag Elements or Components here' });
      }
      d.dataset.sel = '1';
    }
  }
  if (!wrap.children.length) return;
  wrap.insertAdjacentHTML('afterbegin', `<svg class="nc-wires fvs-sel-wires" aria-hidden="true">${wires}</svg>`);
  frame.appendChild(wrap);
}

// ── Events ───────────────────────────────────────────────────
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.fvs-sel-overlay')) e.stopPropagation(); }, true);   // a dot is no marquee
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.fvs-sel-overlay .nc-port__dot'); if (!b) return;
  e.stopPropagation();
  if (b.dataset.saved != null) { openSaved(+b.dataset.saved); return; }
  if (b.classList.contains('fvs-sel-drop')) { chooseItem(); return; }
  if (state.selOpen) closeSelection(); else openSelection();
}, true);
document.addEventListener('keydown', e => {
  if (state.activeTier !== 'symbol' || e.defaultPrevented) return;
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || (t.closest && t.closest('.org-modal, #symbol-content-overlay'))) return;
  if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A') && state.symbolCells.length) {   // ⌘A: every cell
    e.preventDefault();
    state.symbolSelection = new Set(state.symbolCells.map((_, i) => i)); selectionTouched(state.symbolCells.length - 1);
    renderSymbolCanvasOnly(); renderCellPropertiesPanel();
  } else if (e.key === 'Escape' && state.symbolSelection.size) {   // Esc: the panel closes, then the selection goes
    if (state.selOpen) { closeSelection(); const d = document.querySelector('.fvs-sel-dot'); if (d) d.focus({ preventScroll: true }); }
    else { state.symbolSelection.clear(); selectionTouched(null); renderSymbolCanvasOnly(); renderCellPropertiesPanel(); }
  }
});
ctrl('btn-sel-lock').addEventListener('click', () => {
  const lock = ctrl('btn-sel-lock').getAttribute('aria-pressed') !== 'true';
  applyToSelection({ locked: lock }); renderCellPropertiesPanel(); renderSelectionPanel();
});
ctrl('btn-sel-clear').addEventListener('click', () => {
  const z = current(); z.fill = state.selPick != null ? { empty: true } : null; z.rule = null;
  applyToSelection(cell => (cell.locked ? {} : { source: 'empty', rotation: 0, flipH: false, flipV: false, scale: 1 }));
  applySelectionsNow(); renderSelectionPanel();
});
ctrl('btn-sel-save').addEventListener('click', async () => {
  if (!state.symbolSelection.size) return;
  const list = savedList(), def = 'Selection ' + (list.length + 1);
  const name = Organica.prompt ? await Organica.prompt({ title: 'Save selection', label: 'Name', value: def, ok: 'Save' }) : def;
  if (name == null) return;
  const d = state.selDraft || { fill: null, rule: null };
  list.push({ name: String(name).trim() || def, when: whenFromCells([...state.symbolSelection], ctxsNow()), fill: d.fill ? clone(d.fill) : null, rule: d.rule ? clone(d.rule) : null, off: false });
  state.selPick = list.length - 1; state.selDraft = null;
  applySelectionsNow();
  renderSelectionPanel();
});
ctrl('btn-sel-rename').addEventListener('click', async () => {
  const z = state.selPick != null && savedList()[state.selPick]; if (!z) return;
  const name = await Organica.prompt({ title: 'Rename selection', label: 'Name', value: z.name, ok: 'Rename' });
  if (name == null) return;
  z.name = String(name).trim() || z.name; renderSelectionPanel(); renderSymbolCanvasOnly();
});
ctrl('btn-sel-delete').addEventListener('click', () => {   // armed: the saved selection goes, what its cells hold stays
  if (state.selPick == null) return;
  savedList().splice(state.selPick, 1);
  state.selPick = null; state.selDraft = null;
  renderSymbol(); renderSelectionPanel();
});
ctrl('btn-sel-choose').addEventListener('click', chooseItem);
ctrl('sel-items').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const items = itemsOf(current()).slice(), k = +b.dataset.k;
  if (b.dataset.act === 'del') items.splice(k, 1);
  else if (b.dataset.act === 'up' && k > 0) [items[k - 1], items[k]] = [items[k], items[k - 1]];
  setItems(items);
  if (!items.length) { applyToSelection(cell => (cell.locked ? {} : { source: 'empty' })); applySelectionsNow(); }
});
ctrl('sel-arrange').addEventListener('click', e => {
  const b = e.target.closest('[data-arr]'); if (!b) return;
  const a = current().fill && current().fill.arrange; if (!a) return;
  const s = specOf(b.dataset.arr);
  a.rule = s.rule; if (s.walk) a.walk = s.walk; if (a.rule === 'random') a.seed = newSeed();
  hoverRule = null;
  applySelectionsNow(); renderSelectionPanel();
});
const hoverTile = key => { if (hoverRule === key) return; hoverRule = key; renderSymbolCanvasOnly(); };
ctrl('sel-arrange').addEventListener('mouseover', e => { const b = e.target.closest('[data-arr]'); if (b) hoverTile(b.dataset.arr); });
ctrl('sel-arrange').addEventListener('focusin', e => { const b = e.target.closest('[data-arr]'); if (b) hoverTile(b.dataset.arr); });
['mouseleave', 'focusout'].forEach(t => ctrl('sel-arrange').addEventListener(t, () => hoverTile(null)));
ctrl('sel-seq').addEventListener('click', e => {
  const b = e.target.closest('[data-seq]'); if (!b) return;
  const a = current().fill && current().fill.arrange; if (!a || !SEL_SEQS.hasOwnProperty(b.dataset.seq)) return;
  a.seq = b.dataset.seq; applySelectionsNow(); renderSelectionPanel();
});
ctrl('sel-sel-rule').addEventListener('change', () => {
  const z = current(), v = ctrl('sel-sel-rule').value;
  if (!v) z.rule = null;
  else if (v.startsWith('photo|')) { pickPhoto(v.slice(6)); return; }
  else if (v.startsWith('rule|')) { ctrl('sel-symbol-rule').value = v.slice(5); syncSymbolRuleUI(); z.rule = { symbolRule: readRule() }; }
  else { const k = v.indexOf('|'); z.rule = { follow: { id: v.slice(0, k), params: JSON.parse(v.slice(k + 1)), seed: newSeed() } }; }
  applySelectionsNow(); renderSelectionPanel();
});
ctrl('sel-seq').innerHTML = Object.keys(SEL_SEQS).map(k => `<button type="button" class="seg-btn" data-seq="${k}" aria-pressed="false">${SEQ_LABEL[k]}</button>`).join('');
ctrl('symbol-rule-block').querySelectorAll('#btn-rule-choose-content, #btn-symbol-apply-rule, #btn-symbol-clear-rule, .org-panel__hint').forEach(el => el.classList.add('fvs-sel-hide'));
// Transform · Cells: the Cell properties rows this section keeps (Diego, Oct 28, 2026) moved in from their block
['row-cellprop-rotation', 'row-cellprop-flip', 'row-cellprop-scale', 'row-cellprop-fixedsize', 'row-cellprop-overflow'].forEach(id => { const el = ctrl(id); if (el) ctrl('sel-transform').appendChild(el); });
['row-cellprop-span', 'note-cellprop-span-cut'].forEach(id => { const el = ctrl(id); if (el) ctrl('sel-cells').appendChild(el); });
{ const pad = ctrl('cellprop-pad'); if (pad) { const lab = pad.previousElementSibling; if (lab && lab.classList.contains('sub-label')) { lab.classList.remove('sub-label'); lab.className = 'ctrl-label fvs-sel-padlabel'; ctrl('sel-cells').appendChild(lab); } ctrl('sel-cells').appendChild(pad); } }
[['btn-sel-lock', 'lock'], ['btn-sel-save', 'bookmark'], ['btn-sel-rename', 'pencil'], ['btn-sel-clear', 'eraser'], ['btn-sel-delete', 'trash']].forEach(([id, ic]) => { ctrl(id).innerHTML = Organica.icons.get(ic); });
