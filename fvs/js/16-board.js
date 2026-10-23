// Flexible Visual System · 16-board — the step boards: Element, Component and Symbol each on an infinite board, the way
// Figure is (Organica.createZoomPan, infinite + panAlways, on a size-0 board). Sheets on it (a label: drag it to move
// the sheet, click it to select; linked sheets are one group with one ring), fit (Shift+1 / Shift+2), Space / ⌥ / the
// middle button pan, the view and the sheet positions kept per step. Plus Symbol's cell grammar for any set of cells
// on a sheet (cellEditor: marquee + a second click = choose). The steps' own boards are 18-step-boards.js.
// From the prototype fvs/_proto-board/ (Oct 10–11, 2026). An ES module of fvs/js/main.js — docs/FVS.md §11, §13.
import {
  state
} from './engine/00-core.js';
import {
  fvsIsTypingTarget
} from './12-shell.js';

const el = (tag, cls, attrs) => { const n = document.createElement(tag); if (cls) n.className = cls; if (attrs) Object.assign(n, attrs); return n; };
export const rectsHit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// The click a drag may end with is not a click — but not every drag ends with one (a press and release on different
// elements may give none), so only a click within 100 ms of the release is eaten, never the next real one.
// Only inside `scope` (where the drag ended) — a quick click on a button elsewhere is a real one.
let swallowUntil = 0, swallowScope = null;
window.addEventListener('click', ev => {
  if (performance.now() < swallowUntil && swallowScope && swallowScope.contains(ev.target)) { swallowUntil = 0; ev.stopPropagation(); ev.preventDefault(); }
}, true);
export const swallowNextClick = scope => { swallowUntil = performance.now() + 100; swallowScope = scope; };

// ── The board ─────────────────────────────────────────────────────────────────────────────────────────
let spaceHeld = false;
export const isPanKey = e => spaceHeld || e.altKey;   // a press that pans instead of acting
export const boards = {};
const VIEW_KEY = tier => 'organica.fvs.board.' + tier;
const LEGACY_VIEW_KEY = tier => 'organica.fvs.proto.board.' + tier;   // the prototype's (Oct 2026) — read forward, left in place
// the left dock (step buttons, the Library rail — its width varies) and the floatbar lie over the board: the fit keeps
// clear of them, measured (Figure's fitInset is a constant; here the open rail is wider)
function fitInset(r) {
  const dock = document.getElementById('fvs-rail-dock'), bar = document.querySelector('body > .org-floatbar[role="toolbar"]');
  const d = dock && dock.getBoundingClientRect(), b = bar && bar.getBoundingClientRect();
  return { left: d && d.width ? Math.max(0, d.right - r.left) : 0, bottom: b && b.height ? Math.max(0, r.bottom - b.top) : 0 };
}

// The board of a step: its stage, board and HUD are the tier view's own markup (fvs/index.html).
export function makeBoard(tier) {
  const view = document.querySelector(`#canvas-wrap .tier-view[data-tier="${tier}"]`);
  const stage = view.querySelector('.fvs-board-stage'), board = stage.querySelector('.fvs-board'), hud = view.querySelector('.fvs-board-hud');
  Organica.nodeCanvas.chordShim(view);   // a mouse that reports a side button held sends no pointerdown — the whole step, its single view too
  // A press on the board takes the keyboard from a panel field: a slider or a menu touched before kept the focus, and the
  // board's own keys (Delete, ⌘Z, the arrows) read as typing in it and did nothing (Diego, Oct 11, 2026)
  view.addEventListener('pointerdown', () => {
    const a = document.activeElement;
    if (a && a !== document.body && !view.contains(a) && fvsIsTypingTarget(a)) a.blur();
  }, true);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(VIEW_KEY(tier)) || localStorage.getItem(LEGACY_VIEW_KEY(tier))) || {}; } catch (err) {}
  const B = { tier, view, stage, board, hud, sheets: {}, selected: new Set(), saved, links: {} };   // links: sheets that move together (an Element and its Views)
  const save = () => { try { localStorage.setItem(VIEW_KEY(tier), JSON.stringify({ view: { zoom: B.zp.zoom, panX: B.zp.pan.x, panY: B.zp.pan.y }, pos: B.pos })); } catch (err) {} };
  B.pos = saved.pos || {};
  B.save = save;
  B.zp = Organica.createZoomPan({
    canvas: board, wrap: stage, min: 0.1, max: 4, panAlways: true, infinite: true, dblclickReset: false,
    isReady: () => state.activeTier === tier && !B.single,
    panStart: e => e.button === 1 || (e.button === 0 && isPanKey(e)),
    onChange(st) {
      stage.style.setProperty('--nc-zoom', st.zoom); stage.classList.toggle('nc-stage--far', st.zoom < 0.5);
      clearTimeout(B.saveT); B.saveT = setTimeout(save, 200);
      if (B.onZoom) B.onZoom();
      if (B.rings && B.rings.length) drawRings(B);
    },
  });
  // The wheel is the board's: captured before a sheet's own content sees it.
  stage.addEventListener('wheel', e => {
    if (state.activeTier !== tier || B.single) return;
    e.preventDefault(); e.stopPropagation();
    if (document.activeElement && document.activeElement !== document.body && !stage.contains(document.activeElement)) document.activeElement.blur();
    B.zp.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  }, { passive: false, capture: true });
  // A click on the bare board clears the sheet selection (and closes an open dropdown).
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0 || isPanKey(e)) return;
    if (e.target === stage || e.target === board) { stage.focus({ preventScroll: true }); selectSheets(B, []); document.dispatchEvent(new CustomEvent('organica:dropdown-open', { detail: stage })); }
  });
  B.fit = (ids, opts) => fitSheets(B, ids, opts);
  boards[tier] = B;
  return B;
}
// A sheet: a label (drag it to move the sheet, click to select it) over a body. `content` is either what goes in a new
// sheet's body, or a sheet already in the markup (.fvs-board-sheet, with its own label and body).
export function addSheet(B, id, label, x, y, content) {
  let s, lab;
  if (content.classList && content.classList.contains('fvs-board-sheet')) { s = content; lab = s.querySelector(':scope > .fvs-board-sheet__label'); }
  else {   // label null = a sheet without its own label (an Element: its name sits above its Views)
    s = el('div', 'fvs-board-sheet'); const body = el('div', 'fvs-board-sheet__body');
    if (label != null) {
      lab = el('button', 'nc-frame__label fvs-board-sheet__label', { type: 'button', textContent: label });
      lab.setAttribute('aria-label', label + ' — drag to move');
      s.append(lab);
    }
    body.append(content);
    s.append(body);
    B.board.append(s);
  }
  s.dataset.sheet = id;
  const p = B.pos[id] || { x, y };
  s.style.translate = `${p.x}px ${p.y}px`;
  B.sheets[id] = { el: s, p, label: lab };
  if (lab && !s.dataset.wired) {
    s.dataset.wired = '1';
    lab.addEventListener('pointerdown', e => dragSheet(B, s, lab, e));
    lab.addEventListener('click', e => { if (e.detail === 0) selectSheets(B, [s.dataset.sheet]); });   // Enter / Space on a label selects its sheet (then the arrows move it, Delete removes it)
  }
  return s;
}
export function placeSheet(B, id, x, y) {
  const sh = B.sheets[id];
  if (!sh) return;
  sh.p.x = x; sh.p.y = y; sh.el.style.translate = `${x}px ${y}px`;
}
export function removeSheet(B, id, keepEl) {
  const sh = B.sheets[id];
  if (!sh) return;
  if (!keepEl) sh.el.remove();
  delete B.sheets[id]; delete B.pos[id]; delete B.links[id];
  B.selected.delete(id);
}
function dragSheet(B, s, lab, e) {
  if (e.button !== 0 || isPanKey(e)) return;
  e.preventDefault(); e.stopPropagation();
  lab.focus({ preventScroll: true });   // the keys follow the sheet just pressed (preventDefault keeps the press from focusing it)
  const id = s.dataset.sheet;
  const add = e.metaKey || e.ctrlKey || e.shiftKey;
  selectSheets(B, add ? (B.selected.has(id) ? [...B.selected].filter(k => k !== id) : [...B.selected, id]) : (B.selected.has(id) ? [...B.selected] : [id]));
  const moving = new Set(B.selected);
  [...moving].forEach(k => (B.links[k] || []).forEach(l => moving.add(l)));
  const sx = e.clientX, sy = e.clientY, starts = [...moving].filter(k => B.sheets[k]).map(k => [B.sheets[k], { ...B.sheets[k].p }]);
  let moved = false;
  lab.setPointerCapture(e.pointerId);
  const mv = ev => {
    const dx = (ev.clientX - sx) / B.zp.zoom, dy = (ev.clientY - sy) / B.zp.zoom;
    if (!moved && Math.hypot(dx, dy) * B.zp.zoom < 3) return;
    moved = true; B.stage.classList.add('nc-stage--dragging');
    starts.forEach(([sh, o]) => { sh.p.x = Math.round(o.x + dx); sh.p.y = Math.round(o.y + dy); sh.el.style.translate = `${sh.p.x}px ${sh.p.y}px`; });
    drawRings(B);
  };
  const up = () => {
    lab.removeEventListener('pointermove', mv); lab.removeEventListener('pointerup', up); lab.removeEventListener('pointercancel', up);
    B.stage.classList.remove('nc-stage--dragging');
    if (moved) { swallowNextClick(lab); starts.forEach(([sh]) => { B.pos[sh.el.dataset.sheet] = sh.p; }); B.save(); if (B.afterMove) B.afterMove(starts.map(([sh]) => sh.el.dataset.sheet)); }   // the moved sheets' ids; the click that ends a drag is not a click
  };
  lab.addEventListener('pointermove', mv); lab.addEventListener('pointerup', up); lab.addEventListener('pointercancel', up);
}
// A group of linked sheets (an Element, its name and Views) is selected as one, with one ring round all of it (Diego, Oct 11).
const groupOf = (B, k) => [k, ...(B.links[k] || [])].filter(x => B.sheets[x]);
export function selectSheets(B, ids) {
  B.selected = new Set(ids.flatMap(k => groupOf(B, k)));
  Object.entries(B.sheets).forEach(([k, sh]) => { sh.el.classList.toggle('is-selected', B.selected.has(k)); sh.el.classList.toggle('is-linked', !!(B.links[k] && B.links[k].length)); });
  drawRings(B);
}
export function drawRings(B) {
  (B.rings || []).forEach(r => r.remove());
  B.rings = [];
  const done = new Set(), PAD = 16;   // board units (--space-6): the ring clears the sheets' pile
  B.selected.forEach(k => {
    if (done.has(k)) return;
    const g = groupOf(B, k);
    g.forEach(x => done.add(x));
    if (g.length < 2) return;
    const bx = g.map(x => sheetBox(B.sheets[x]));
    const x0 = Math.min(...bx.map(b => b.x)) - PAD, y0 = Math.min(...bx.map(b => b.y)) - PAD;
    const x1 = Math.max(...bx.map(b => b.x + b.w)) + PAD, y1 = Math.max(...bx.map(b => b.y + b.h)) + PAD;
    const r = el('div', 'fvs-board-ring');
    r.style.translate = `${x0}px ${y0}px`; r.style.width = (x1 - x0) + 'px'; r.style.height = (y1 - y0) + 'px';
    B.board.append(r); B.rings.push(r);
  });
}
// the label keeps its size on screen (scale(1/zoom) when zoomed out): its height in board units is the drawn one
export function sheetBox(sh) {
  const z = parseFloat(sh.el.closest('.fvs-board-stage').style.getPropertyValue('--nc-zoom')) || 1;
  const shown = sh.label && sh.label.offsetHeight;
  const lh = shown ? sh.label.getBoundingClientRect().height / z + 4 : 0;   // + its margin
  return { x: sh.p.x, y: sh.p.y - lh, w: Math.max(sh.el.offsetWidth, shown ? sh.label.getBoundingClientRect().width / z : 0), h: sh.el.offsetHeight + lh };
}
function fitSheets(B, ids, opts) {
  const list = (ids && ids.length ? ids : Object.keys(B.sheets)).map(k => B.sheets[k]).filter(sh => sh && sh.el.offsetParent);
  if (!list.length) return;
  fitBox(B, list.map(sheetBox), opts);
}
// opts.centred: in the middle of the stage — the dock / floatbar / HUD margins mirrored on the opposite side, so the
// sheets sit at the page's centre and still clear them (Element's landing, Diego Oct 11)
function fitBox(B, boxes, opts = {}) {
  const x0 = Math.min(...boxes.map(b => b.x)), y0 = Math.min(...boxes.map(b => b.y));
  const x1 = Math.max(...boxes.map(b => b.x + b.w)), y1 = Math.max(...boxes.map(b => b.y + b.h));
  // …and clear of the HUD at the top (Edit toolbar, empty notes) when it shows something
  const r = B.stage.getBoundingClientRect(), pad = 48, hud = B.hud.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const inset = { ...fitInset(r), top: hud.height > 1 ? Math.max(0, hud.bottom - r.top) : 0 };
  if (opts.centred) { inset.left = Math.max(inset.left, 0); inset.right = inset.left; inset.top = inset.bottom = Math.max(inset.top, inset.bottom); }
  const w = r.width - inset.left - (inset.right || 0) - 2 * pad, h = r.height - inset.top - inset.bottom - 2 * pad;
  const zoom = Math.min(1.5, w / Math.max(1, x1 - x0), h / Math.max(1, y1 - y0));
  B.zp.setView({ zoom, panX: inset.left + pad + w / 2 - ((x0 + x1) / 2) * zoom, panY: inset.top + pad + h / 2 - ((y0 + y1) / 2) * zoom });
}

// The single view (double-click an Element or a Component candidate): the step's classic page, the board hidden.
// The markup stays where it is — the tier view's class changes the layout (fvs.css, .is-single).
export function setSingle(B, on) {
  B.single = !!on;
  B.view.classList.toggle('is-single', B.single);
  if (B.single) selectSheets(B, []);
}

// Keys: Space pans, Shift+1 / Shift+2 fit — on the active step's board.
export const activeBoard = () => boards[state.activeTier] || null;
document.addEventListener('keydown', e => {
  const B = activeBoard();
  if (!B || B.single || fvsIsTypingTarget(e.target)) return;
  if (e.code === 'Space') { if (!spaceHeld) { spaceHeld = true; B.stage.classList.add('nc-stage--pan'); } e.preventDefault(); }
  if (e.shiftKey && !e.metaKey && !e.ctrlKey && (e.code === 'Digit1' || e.code === 'Digit2')) {
    e.preventDefault();
    if (e.code === 'Digit1') B.fit();
    else if (B.selected.size) B.fit([...B.selected]);
    else if (B.fitFocus) B.fitFocus(); else B.fit();
  }
  // the arrow keys nudge the selected sheets (Shift: by ten), as node-canvas moves its cards — focus on the board or a label
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (arrow && B.selected.size && (e.target === B.stage || (e.target.classList && e.target.classList.contains('fvs-board-sheet__label')))) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1, moving = new Set(B.selected);
    [...moving].forEach(k => (B.links[k] || []).forEach(l => moving.add(l)));
    moving.forEach(k => { const sh = B.sheets[k]; if (sh) { placeSheet(B, k, sh.p.x + arrow[0] * step, sh.p.y + arrow[1] * step); B.pos[k] = sh.p; } });
    drawRings(B); B.save(); if (B.afterMove) B.afterMove([...moving]);
  }
}, true);
const spaceOff = () => { spaceHeld = false; Object.values(boards).forEach(B => B.stage.classList.remove('nc-stage--pan')); };
document.addEventListener('keyup', e => { if (e.code === 'Space') spaceOff(); });
window.addEventListener('blur', spaceOff);
// First visit of a step: the step's own first view (B.firstFit — Element: the first Element, Diego Oct 11), else its
// saved view, else fit everything (setTier → hooks.boardTierShown).
const shown = new Set();
export function boardTierShown(tier) {
  const B = boards[tier];
  if (!B || shown.has(tier)) return;
  shown.add(tier);
  requestAnimationFrame(() => {
    if (B.beforeFit) B.beforeFit();
    if (B.firstFit) B.firstFit();
    else if (B.saved.view) { B.zp.setView(B.saved.view); if (!sheetInView(B)) B.fit(); }
    else B.fit();
  });
}
// A saved view can frame nothing: the sheets it was saved on are gone (Elements deleted, the board cleared, a sheet
// retired) — the step opened on an empty board with its Components far off screen (Diego, Oct 15, 2026: "I have
// problem to generate"). Then fit, as Shift+1 does.
function sheetInView(B) {
  const r = B.stage.getBoundingClientRect();
  return Object.values(B.sheets).some(sh => {
    if (!sh.el.offsetParent) return false;
    const q = sh.el.getBoundingClientRect();
    return q.right > r.left && q.left < r.right && q.bottom > r.top && q.top < r.bottom;
  });
}

// ── Symbol's cell grammar, for a set of cells on a sheet ──────────────────────────────────────────────────
// adapter: { frame, cells: () => [el], key: el => key, hit?(el, rect), selection: () => Set, wasSelected?(key),
//            select(keys, add), choose?(), active() }
// Click is the step's own (FVS already handles it); this adds the marquee and the second click → choose.
export function cellEditor(B, a) {
  let press = null, box = null;
  a.frame.addEventListener('pointerdown', e => {
    if (!a.active() || e.button !== 0 || isPanKey(e)) return;
    press = { x: e.clientX, y: e.clientY, add: e.metaKey || e.ctrlKey || e.shiftKey };
  });
  const host = () => (B.single ? B.view : B.stage);
  window.addEventListener('pointermove', e => {
    if (!press) return;
    if (!box) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
      box = el('div', 'nc-marquee fvs-board-marquee'); host().append(box);
    }
    const s = host().getBoundingClientRect();
    const l = Math.min(press.x, e.clientX), t = Math.min(press.y, e.clientY);
    box.style.translate = `${l - s.left + host().scrollLeft}px ${t - s.top + host().scrollTop}px`;
    box.style.width = Math.abs(e.clientX - press.x) + 'px'; box.style.height = Math.abs(e.clientY - press.y) + 'px';
    const r = { left: l, top: t, right: Math.max(press.x, e.clientX), bottom: Math.max(press.y, e.clientY) };
    a.cells().forEach(c => c.classList.toggle('is-marquee-hit', a.hit ? a.hit(c, r) : rectsHit(r, c.getBoundingClientRect())));
  });
  window.addEventListener('pointerup', () => {
    if (!press) return;
    const p = press; press = null;
    if (!box) return;
    box.remove(); box = null;
    const hits = a.cells().filter(c => c.classList.contains('is-marquee-hit'));
    a.cells().forEach(c => c.classList.remove('is-marquee-hit'));
    swallowNextClick(a.frame);
    const keys = hits.map(a.key);
    if (keys.length || !p.add) a.select(keys, p.add);
  });
  // A second click on a cell that is already selected = Choose (Symbol's own rule).
  a.frame.addEventListener('click', e => {
    if (!a.active() || e.metaKey || e.ctrlKey || e.shiftKey || !a.choose) return;
    const c = a.cells().find(n => n === e.target || n.contains(e.target));
    if (!c) return;
    const k = a.key(c), sel = a.selection();
    if (sel.has(k) && a.wasSelected && a.wasSelected(k)) { e.stopPropagation(); e.preventDefault(); a.choose(); }
  }, true);
}

// A part is in the marquee when its outline is, or when the marquee lies inside it: sample the path and test each
// point (its bounding box is not enough — the parts of a Fan all share a corner), then the marquee's corners and centre
// against the fill (a drag inside one big part crosses no outline — Oct 11, 2026).
export function shapeInRect(c, r) {
  if (!rectsHit(r, c.getBoundingClientRect())) return false;
  const probe = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
  return [...c.querySelectorAll('path')].some(path => {
    const m = path.getScreenCTM(), len = path.getTotalLength(), n = 96;
    if (!m || !len) return false;
    for (let k = 0; k <= n; k++) {
      const q = path.getPointAtLength(len * k / n), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    const inv = m.inverse();
    return probe.some(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(inv); return path.isPointInFill(p); });
  });
}
