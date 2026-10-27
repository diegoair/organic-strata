// Flexible Visual System · 11-zones-ui — the Symbol's Zones panel, the line handles on the canvas, Select (similar).
// One flow (Diego, Oct 27, 2026 — "voglio poter dire quale parte si deve comportare e seguire delle regole, in maniera
// super semplice"): pick a part of the Symbol — a ready-made zone, a row / column handle, Select, or cells on the canvas
// — make it a Zone, say what it Does (Content · Rule · Locked · Empty); Suggest then changes only what no zone holds.
// The evaluator is engine/11-zones applyZones — the same as the Figure's region rules. An ES module of fvs/js/main.js.
// Architecture + file map: docs/FVS.md §11; Zones §6c.
import {
  pv, state
} from './engine/00-core.js';
import {
  LIBRARY
} from './engine/07-library.js';
import {
  getSymbolGrid, symbolFrame
} from './engine/08-symbol-grid.js';
import {
  SYMBOL_ARRANGE, symbolContentPool
} from './engine/10-suggest.js';
import {
  SYMBOL_RULES, cellColRow
} from './engine/11-symbol-ui.js';
import {
  ZONE_FOLLOW, applyZones, contentOfCell, readyZones, similarWhen, whenFromCells, zoneCells, zoneContexts, zoneLines
} from './engine/11-zones.js';
import {
  ctrl
} from './00-core.js';
import {
  renderSuggestGallery
} from './10-suggest.js';
import {
  renderCellPropertiesPanel, renderSymbol, renderSymbolCanvasOnly, syncSymbolRuleUI
} from './11-symbol-ui.js';
import { provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  applyZonesNow: () => applyZonesNow, renderZonesPanel: () => renderZonesPanel, zonesOverlaySVG: () => zonesOverlaySVG,
  renderLineHandles: () => renderLineHandles, zonePickedRule: () => zonePickedRule, ruleToPickedZone: () => ruleToPickedZone
});

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const clone = o => JSON.parse(JSON.stringify(o));
const ctxsNow = () => { const g = getSymbolGrid(); return g ? zoneContexts(g) : []; };
const newSeed = () => 1 + Math.floor(Math.random() * 99999);

// ── Words ────────────────────────────────────────────────────
const Q = { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right' };
const nth = (k, word) => (k < 0 ? (k === -1 ? 'Last ' + word : word[0].toUpperCase() + word.slice(1) + ' ' + (k === -1 ? 'last' : -k + ' from the end')) : word[0].toUpperCase() + word.slice(1) + ' ' + (k + 1));
const many = (k, word) => (Array.isArray(k) ? word[0].toUpperCase() + word.slice(1) + 's ' + k.map(v => (v < 0 ? 'last' + (v < -1 ? ' −' + (-v - 1) : '') : v + 1)).join(', ') : nth(k, word));
export function whenText(w) {
  w = w || {};
  const base = w.sel === 'all' ? 'All cells' : w.sel === 'row' ? many(w.k, 'row') : w.sel === 'col' ? many(w.k, 'column') : w.sel === 'ring' ? many(w.k, 'ring') : w.sel === 'sector' ? many(w.k, 'sector')
    : w.sel === 'border' ? 'Border' : w.sel === 'centre' ? 'Centre' : w.sel === 'quadrant' ? Q[w.q] || 'Quadrant' : w.sel === 'diagonal' ? (w.which === 'main' ? 'Diagonal' : w.which === 'anti' ? 'Other diagonal' : 'Diagonals')
    : w.sel === 'every' ? 'Every other ' + ({ checker: 'cell', row: 'row', col: 'column', index: 'cell', ring: 'ring', sector: 'sector' }[w.by] || 'cell')
    : w.at ? w.at.length + (w.at.length === 1 ? ' cell' : ' cells') : w.index ? w.index.length + (w.index.length === 1 ? ' cell' : ' cells') : 'Cells';
  return w.not ? base + ' minus ' + whenText(w.not).toLowerCase() : base;
}
const RULE_NAMES = { oscillator: 'Rhythm', checkerboard: 'Checkerboard', rows: 'Rows', columns: 'Columns', radial: 'Radial', wave: 'Wave', orientation: 'Up / down', random: 'Random' };
export function doText(d) {
  d = d || {};
  if (d.keep) return 'Locked';
  if (d.empty) return 'Empty';
  if (d.follow) { const G = ZONE_FOLLOW[d.follow.id]; return G ? (G.caption ? G.caption(d.follow.params || {}) : G.label) : 'Rule'; }
  if (d.symbolRule) return RULE_NAMES[d.symbolRule.name] || 'Rule';
  if (d.arrange) return 'Content · ' + ((SYMBOL_ARRANGE[d.arrange.rule] || {}).label || 'Arranged');
  if (d.content) return 'Content · ' + (d.content.label || d.content.name || 'one');
  return 'Does nothing yet';
}
const doKind = d => (!d ? null : d.keep ? 'keep' : d.empty ? 'empty' : d.symbolRule || d.follow ? 'rule' : d.arrange || d.content ? 'content' : null);

// ── Contents a zone can take ─────────────────────────────────
// This Symbol's own contents first (what its cells hold), then the saved Components not already among them.
function contentItems() {
  const out = [];
  symbolContentPool(state.symbolCells).forEach(p => {
    const t = p.tpl, label = t.source === 'component' ? t.componentName : (t.seedType || 'Element') + ' (in this Symbol)';
    out.push({ key: 'own:' + p.name, label, tpl: contentOfCell(t) });
  });
  const have = new Set(out.filter(o => o.tpl.source === 'component').map(o => o.tpl.componentName));
  Object.keys(LIBRARY.peek() || {}).filter(n => !have.has(n) && !(LIBRARY.peek()[n] || {}).auto).forEach(n => out.push({ key: 'lib:' + n, label: n, kind: 'component', name: n }));
  return out;
}
const itemOf = it => (it.tpl ? { tpl: it.tpl, label: it.label } : { kind: 'component', name: it.name, label: it.label });

// ── Applying ─────────────────────────────────────────────────
// The zones write into the cells (cells stay what is saved and drawn — old Symbols never need the evaluator). A Locked
// zone's lock is the zone's: cells it locked are unlocked first, so removing the zone frees them again.
export function applyZonesNow(opts = {}) {
  const grid = getSymbolGrid();
  if (!grid) return;
  const cells = state.symbolCells.map(c => (c && c.lockedBy === 'zone' ? { ...c, locked: false, lockedBy: undefined } : c));
  const zones = state.symbolZones || [];
  if (!zones.length) { state.symbolCells = cells.map(c => { if (c && c.lockedBy === undefined && 'lockedBy' in c) delete c.lockedBy; return c; }); if (!opts.quiet) renderSymbol(); return; }
  const out = applyZones(cells, grid, zones).cells;
  out.forEach((c, i) => { if (c.locked && !(cells[i] && cells[i].locked)) c.lockedBy = 'zone'; if (c.lockedBy === undefined) delete c.lockedBy; });
  state.symbolCells = out;
  state.symbolSuggestions = []; renderSuggestGallery();   // variations were made for the cells before
  if (!opts.quiet) renderSymbol();
  renderZonesPanel();
}
// The picked zone, when it follows a Symbol rule — the Rule block's controls edit it (11-symbol-ui applySymbolRule).
export function zonePickedRule() {
  const z = state.zonePick != null && state.symbolZones[state.zonePick];
  return z && z.do && z.do.symbolRule ? z : null;
}
function readRule() {
  const name = pv('sel-symbol-rule'), r = SYMBOL_RULES[name];
  return { name, params: r ? r.read() : {}, seed: parseInt(pv('num-rule-seed'), 10) || 0, vary: { rotation: ctrl('chk-rule-rotation').checked, flip: ctrl('chk-rule-flip').checked, scale: ctrl('chk-rule-scale').checked } };
}
// What the Rule block's controls set, written to the picked zone (a rule control changed, or Rule was chosen)
export function ruleToPickedZone() {
  const z = state.zonePick != null && state.symbolZones[state.zonePick];
  if (!z) return false;
  z.do = { symbolRule: readRule() };
  applyZonesNow();
  return true;
}

// ── Making and editing zones ─────────────────────────────────
function addZone(when, d) {
  state.symbolZones.push({ when: clone(when), do: d || {} });
  state.zonePick = state.symbolZones.length - 1;
  state.symbolSelection = new Set(zoneCells(when, ctxsNow()));
  applyZonesNow();
}
function pickZone(i) {
  state.zonePick = state.zonePick === i ? null : i;
  state.symbolSelection = state.zonePick == null ? new Set() : new Set(zoneCells(state.symbolZones[i].when, ctxsNow()));
  renderSymbolCanvasOnly(); renderCellPropertiesPanel(); renderZonesPanel();
}
function setDoes(kind) {
  const z = state.symbolZones[state.zonePick]; if (!z) return;
  if (kind === 'keep') z.do = { keep: true };
  else if (kind === 'empty') z.do = { empty: true };
  else if (kind === 'rule') { if (!z.do.symbolRule && !z.do.follow) z.do = { symbolRule: readRule() }; }
  else if (kind === 'content') { if (!z.do.arrange && !z.do.content) z.do = contentDo('pool', ctrl('sel-zone-arrange').value || 'random', ctrl('sel-zone-fit').value || 'contain'); }
  applyZonesNow();
}
function contentDo(which, rule, fit) {
  const items = contentItems();
  if (which === 'pool') return { arrange: { rule, fit, seed: newSeed(), pool: items.map(itemOf) } };
  const it = items.find(x => x.key === which);
  return it ? { content: itemOf(it), fit } : { arrange: { rule, fit, seed: newSeed(), pool: items.map(itemOf) } };
}

// ── The panel ────────────────────────────────────────────────
let readyHover = null;
export function renderZonesPanel() {
  const box = ctrl('zone-list'); if (!box) return;
  const ctxs = ctxsNow(), zones = state.symbolZones || [];
  if (state.zonePick != null && !zones[state.zonePick]) state.zonePick = null;
  // ready-made zones: a group (Quadrants, Rings) adds one zone per part
  const ready = readyZones(ctxs), groups = [];
  ready.forEach(z => { const g = z.group ? groups.find(x => x.label === z.group) : null; if (g) g.parts.push(z); else groups.push(z.group ? { label: z.group, key: z.group, parts: [z] } : { label: z.label, key: z.key, parts: [z] }); });
  ctrl('zone-ready').innerHTML = groups.map((g, i) => `<button type="button" class="mini-btn" data-ready="${i}" aria-label="Add zone: ${esc(g.label)}">${esc(g.label)}</button>`).join('');
  ctrl('zone-ready')._groups = groups;
  box.innerHTML = zones.length ? zones.map((z, i) => {
    const name = whenText(z.when) + ' · ' + doText(z.do), seeded = z.do && (z.do.symbolRule || z.do.arrange || z.do.follow);
    return `<div class="org-layer-card org-layer-card--flush fvs-zone-card${z.off ? ' is-off' : ''}${i === state.zonePick ? ' is-picked' : ''}" role="listitem" data-i="${i}"><div class="org-layer-card__head">
      <button type="button" class="org-layer-card__title fg-rule__pick" data-act="pick" data-i="${i}" aria-pressed="${i === state.zonePick}" aria-label="Zone ${i + 1}: ${esc(name)}">${i + 1} · ${esc(name)}</button>
      ${seeded ? `<button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="seed" data-i="${i}" aria-label="New random seed for zone ${i + 1}">${Organica.icons.get('refresh')}</button>` : ''}
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="up" data-i="${i}" aria-label="Move zone ${i + 1} up"${i === 0 ? ' disabled' : ''}>${Organica.icons.get('chevron-up')}</button>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="down" data-i="${i}" aria-label="Move zone ${i + 1} down"${i === zones.length - 1 ? ' disabled' : ''}>${Organica.icons.get('chevron-down')}</button>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="off" data-i="${i}" aria-pressed="${!z.off}" aria-label="Zone ${i + 1} on">${Organica.icons.get(z.off ? 'eye-off' : 'eye')}</button>
      <button type="button" class="org-btn org-btn--sm org-btn--icon" data-act="del" data-i="${i}" aria-label="Delete zone ${i + 1}">${Organica.icons.get('trash')}</button></div></div>`;
  }).join('') : '<p class="org-empty">No zones yet. Pick one above or select cells.</p>';
  ctrl('btn-zone-from-sel').disabled = !state.symbolSelection.size;
  // the inspector
  const z = state.zonePick != null ? zones[state.zonePick] : null, ins = ctrl('zone-inspector');
  ins.hidden = !z;
  const ruleBlock = ctrl('symbol-rule-block');
  if (!z) { if (ruleBlock.parentElement === ctrl('zone-rule-host')) ruleBlock.hidden = true; syncSimilar(); return; }
  const kind = doKind(z.do);
  ins.querySelectorAll('[data-does]').forEach(b => { const on = b.dataset.does === kind; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  ctrl('zone-content-block').hidden = kind !== 'content';
  if (kind === 'content') {
    const items = contentItems(), cur = z.do.content ? (items.find(it => (it.tpl && z.do.content.tpl && JSON.stringify(it.tpl) === JSON.stringify(z.do.content.tpl)) || (it.name && it.name === z.do.content.name)) || {}).key : 'pool';
    ctrl('sel-zone-content').innerHTML = `<option value="pool"${cur === 'pool' ? ' selected' : ''}>From the pool (${items.length})</option>` + items.map(it => `<option value="${esc(it.key)}"${it.key === cur ? ' selected' : ''}>${esc(it.label)}</option>`).join('');
    ctrl('row-zone-arrange').hidden = cur !== 'pool';
    ctrl('sel-zone-arrange').value = (z.do.arrange && z.do.arrange.rule) || 'random';
    ctrl('sel-zone-fit').value = (z.do.arrange && z.do.arrange.fit) || z.do.fit || 'contain';
  }
  // the Rule block lives in the inspector while a zone is picked
  if (ruleBlock.parentElement !== ctrl('zone-rule-host')) ctrl('zone-rule-host').appendChild(ruleBlock);
  ruleBlock.classList.add('is-zone');
  ruleBlock.hidden = kind !== 'rule';
  if (kind === 'rule' && z.do.symbolRule && !ruleBlock._syncing) {
    const sr = z.do.symbolRule;
    ruleBlock._syncing = true;
    ctrl('sel-symbol-rule').value = sr.name;
    (SYMBOL_RULES[sr.name] ? SYMBOL_RULES[sr.name].fields : []).forEach(f => {   // the zone's own settings back on the controls
      const el = ctrl(f.id), v = sr.params ? sr.params[f.key] : undefined; if (!el || v === undefined) return;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      const out = ctrl(f.id.replace(/^rg-/, 'v-')); if (out && f.id.startsWith('rg-')) out.textContent = el.value;
    });
    if (sr.vary) { ctrl('chk-rule-rotation').checked = sr.vary.rotation !== false; ctrl('chk-rule-flip').checked = !!sr.vary.flip; ctrl('chk-rule-scale').checked = !!sr.vary.scale; }
    ctrl('num-rule-seed').value = sr.seed;
    syncSymbolRuleUI();
    ruleBlock._syncing = false;
  }
  const n = zoneCells(z.when, ctxs).length;
  ctrl('zone-hint').textContent = `${n} ${n === 1 ? 'cell' : 'cells'}. Zones apply in order: a later zone wins on the cells it shares; a Locked zone always wins. Suggest changes only the cells no zone holds.`;
  syncSimilar();
}
function syncSimilar() {
  const one = state.symbolSelection.size > 0, ctxs = ctxsNow(), radial = ctxs.some(c => c.ring != null);
  ctrl('zone-similar').querySelectorAll('[data-similar]').forEach(b => {
    const k = b.dataset.similar;
    if (k === 'ring') b.hidden = !radial;
    if (k === 'row' || k === 'col') b.hidden = radial;
    if (k !== 'border' && k !== 'centre') b.disabled = !one;
  });
}

ctrl('zone-rule-host').appendChild(ctrl('symbol-rule-block'));   // the Rule block is the Zone inspector's (it was the Fill section's Rule mode)
ctrl('symbol-rule-block').querySelectorAll('#btn-rule-choose-content, #btn-symbol-apply-rule, #btn-symbol-clear-rule, .org-panel__hint').forEach(el => el.classList.add('fvs-zone-hide'));
ctrl('sel-zone-arrange').innerHTML = Object.entries(SYMBOL_ARRANGE).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
ctrl('zone-ready').addEventListener('click', e => {
  const b = e.target.closest('[data-ready]'); if (!b) return;
  const g = ctrl('zone-ready')._groups[+b.dataset.ready]; if (!g) return;
  g.parts.forEach((p, k) => { state.symbolZones.push({ when: clone(p.when), do: {} }); if (k === 0) state.zonePick = state.symbolZones.length - 1; });
  state.symbolSelection = new Set(zoneCells(g.parts[0].when, ctxsNow()));
  applyZonesNow();
});
const hintCells = idxs => { readyHover = idxs; ctrl('symbol-frame').querySelectorAll('[data-cell-index]').forEach(el => el.classList.toggle('is-hint', !!idxs && idxs.has(+el.getAttribute('data-cell-index')))); };
ctrl('zone-ready').addEventListener('mouseover', e => { const b = e.target.closest('[data-ready]'); if (!b) return; const g = ctrl('zone-ready')._groups[+b.dataset.ready], c = ctxsNow(); hintCells(new Set(g.parts.flatMap(p => zoneCells(p.when, c)))); });
ctrl('zone-ready').addEventListener('focusin', e => { const b = e.target.closest('[data-ready]'); if (b) b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
['mouseleave', 'focusout'].forEach(t => ctrl('zone-ready').addEventListener(t, () => hintCells(null)));
ctrl('zone-list').addEventListener('mouseover', e => { const c = e.target.closest('.fvs-zone-card'); if (!c) return; const z = state.symbolZones[+c.dataset.i]; if (z) hintCells(new Set(zoneCells(z.when, ctxsNow()))); });
ctrl('zone-list').addEventListener('mouseleave', () => hintCells(null));
ctrl('zone-list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const i = +b.dataset.i, zs = state.symbolZones, z = zs[i]; if (!z) return;
  const act = b.dataset.act;
  if (act === 'pick') { pickZone(i); return; }
  if (act === 'seed') { const d = z.do, t = d.symbolRule || d.arrange || d.follow; if (t) t.seed = newSeed(); }
  else if (act === 'off') z.off = !z.off;
  else if (act === 'up' && i > 0) { [zs[i - 1], zs[i]] = [zs[i], zs[i - 1]]; if (state.zonePick === i) state.zonePick = i - 1; else if (state.zonePick === i - 1) state.zonePick = i; }
  else if (act === 'down' && i < zs.length - 1) { [zs[i + 1], zs[i]] = [zs[i], zs[i + 1]]; if (state.zonePick === i) state.zonePick = i + 1; else if (state.zonePick === i + 1) state.zonePick = i; }
  else if (act === 'del') { zs.splice(i, 1); if (state.zonePick === i) { state.zonePick = null; state.symbolSelection.clear(); } else if (state.zonePick > i) state.zonePick--; }
  applyZonesNow();
  const next = ctrl('zone-list').querySelector(act === 'del' ? `[data-act="del"][data-i="${Math.min(i, zs.length - 1)}"]` : `[data-act="${act}"][data-i="${act === 'up' ? i - 1 : act === 'down' ? i + 1 : i}"]`);
  if (next && !next.disabled) next.focus({ preventScroll: true });
});
ctrl('btn-zone-from-sel').addEventListener('click', () => {
  if (!state.symbolSelection.size) return;
  addZone(whenFromCells([...state.symbolSelection], ctxsNow()), {});
});
ctrl('seg-zone-does').addEventListener('click', e => { const b = e.target.closest('[data-does]'); if (b) setDoes(b.dataset.does); });
const onContent = () => {
  const z = state.symbolZones[state.zonePick]; if (!z) return;
  const v = ctrl('sel-zone-content').value, seed = (z.do.arrange && z.do.arrange.seed) || newSeed();
  z.do = contentDo(v, ctrl('sel-zone-arrange').value, ctrl('sel-zone-fit').value);
  if (z.do.arrange) z.do.arrange.seed = seed;
  applyZonesNow();
};
['sel-zone-content', 'sel-zone-arrange', 'sel-zone-fit'].forEach(id => ctrl(id).addEventListener('change', onContent));
// Select: the part like the first selected cell (Border / Centre need none)
ctrl('zone-similar').addEventListener('click', e => {
  const b = e.target.closest('[data-similar]'); if (!b || b.disabled) return;
  const ctxs = ctxsNow(), first = [...state.symbolSelection][0];
  const w = similarWhen(first != null ? first : 0, b.dataset.similar, ctxs, state.symbolCells);
  if (!w) return;
  state.symbolSelection = new Set(zoneCells(w, ctxs));
  state.zonePick = null;
  renderSymbolCanvasOnly(); renderCellPropertiesPanel(); renderZonesPanel();
});

// ── On the canvas ────────────────────────────────────────────
// Zones: the picked one a solid ink outline round its cells, the others dashed (ink only — no zone colours, the
// design-system CONSULT of Oct 27, 2026). Drawn into the preview overlay, never into an export.
export function zonesOverlaySVG() {
  const grid = getSymbolGrid(), zones = state.symbolZones || [];
  if (!grid || !zones.length) return '';
  const ctxs = zoneContexts(grid), F = symbolFrame(grid);
  const shape = c0 => (grid.cellShape === 'polygon'
    ? `<polygon points="${c0.points.map(p => `${F.X(p[0]).toFixed(2)},${F.Y(p[1]).toFixed(2)}`).join(' ')}"/>`
    : `<rect x="${F.X(c0.x).toFixed(2)}" y="${F.Y(c0.y).toFixed(2)}" width="${c0.width.toFixed(2)}" height="${c0.height.toFixed(2)}"/>`);
  let s = '';
  zones.forEach((z, i) => {
    if (z.off) return;
    const picked = i === state.zonePick;
    s += `<g class="fvs-zone-outline${picked ? ' is-picked' : ''}" aria-hidden="true">${zoneCells(z.when, ctxs).map(k => grid.cells[k] ? shape(grid.cells[k]) : '').join('')}</g>`;
  });
  return s;
}
// Row / column handles in the sheet's margin, outside the grid: a click picks the whole line, Shift a range from the
// last one picked, ⌘ (Ctrl) adds or removes it. Grids with rings pick rings through Select instead.
let lastLine = null;
export function renderLineHandles() {
  const frame = ctrl('symbol-frame'), old = document.getElementById('sym-line-handles');
  if (old) old.remove();
  const grid = getSymbolGrid(), svgEl = frame && frame.querySelector('svg');
  if (!grid || !svgEl || state.activeTier !== 'symbol') return;
  const ctxs = zoneContexts(grid);
  if (!ctxs.length || ctxs.some(c => c.ring != null)) return;
  const geo = cellColRow(grid), L = zoneLines(ctxs, geo), F = symbolFrame(grid);
  if (L.cols.length < 2 && L.rows.length < 2) return;
  const svgR = svgEl.getBoundingClientRect(), frameR = frame.getBoundingClientRect();
  const zoom = parseFloat(getComputedStyle(frame).getPropertyValue('--nc-zoom')) || 1;
  const scale = Math.min(svgR.width / F.w, svgR.height / F.h) / zoom;
  const offX = (svgR.left - frameR.left) / zoom + (svgR.width / zoom - F.w * scale) / 2, offY = (svgR.top - frameR.top) / zoom + (svgR.height / zoom - F.h * scale) / 2;
  const bx = F.bx != null ? F.bx : F.w / 2, by = F.by != null ? F.by : F.h / 2;
  const wrap = document.createElement('div');
  wrap.id = 'sym-line-handles'; wrap.className = 'fvs-line-handles';
  const sel = state.symbolSelection;
  const full = (k, v) => { const idx = ctxs.filter(c => c[k] === v).map(c => c.index); return idx.length && idx.every(i => sel.has(i)); };
  const add = (axis, line) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fvs-line-handle fvs-line-handle--' + axis + (full(axis === 'col' ? 'col' : 'row', line.k) ? ' is-on' : '');
    b.dataset.axis = axis; b.dataset.k = line.k;
    b.setAttribute('aria-label', (axis === 'col' ? 'Select column ' : 'Select row ') + (line.k + 1));
    if (axis === 'col') { b.style.left = (offX + (bx + line.at) * scale).toFixed(1) + 'px'; b.style.top = (offY + F.h * scale).toFixed(1) + 'px'; }
    else { b.style.left = (offX + F.w * scale).toFixed(1) + 'px'; b.style.top = (offY + (by + line.at) * scale).toFixed(1) + 'px'; }
    wrap.appendChild(b);
  };
  L.cols.forEach(l => add('col', l)); L.rows.forEach(l => add('row', l));
  frame.appendChild(wrap);
}
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.fvs-line-handle')) e.stopPropagation(); }, true);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.fvs-line-handle'); if (!b) return;
  e.stopPropagation();
  const axis = b.dataset.axis, k = +b.dataset.k, ctxs = ctxsNow(), key = axis === 'col' ? 'col' : 'row';
  const cellsOf = v => ctxs.filter(c => c[key] === v).map(c => c.index);
  let idx = cellsOf(k);
  if (e.shiftKey && lastLine && lastLine.axis === axis) { const a = Math.min(lastLine.k, k), z = Math.max(lastLine.k, k); idx = []; for (let v = a; v <= z; v++) idx.push(...cellsOf(v)); }
  if (e.metaKey || e.ctrlKey) {
    const allIn = idx.every(i => state.symbolSelection.has(i));
    idx.forEach(i => (allIn ? state.symbolSelection.delete(i) : state.symbolSelection.add(i)));
  } else if (e.shiftKey && lastLine && lastLine.axis === axis) state.symbolSelection = new Set(idx);
  else state.symbolSelection = new Set(idx);
  if (!e.shiftKey) lastLine = { axis, k };
  state.zonePick = null;
  renderSymbolCanvasOnly(); renderCellPropertiesPanel(); renderZonesPanel();
}, true);

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
