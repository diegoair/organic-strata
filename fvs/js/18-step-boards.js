// Flexible Visual System · 18-step-boards — the Element, Component and Symbol boards (Oct 2026; from the prototype
// fvs/_proto-board/, Oct 10–11). The board itself is 16-board.js; the markup is the tier views' own (fvs/index.html).
//   · Element: several Elements in a column, each its name + Views + sheet (one group); the one being edited is the live
//     panel, the others are drawn from their snapshot; Inks (a tray), New element, Clear board, the single view.
//   · Component: the gallery as one area; double-click a candidate = Component Edit in its single view, its cells with
//     Symbol's grammar (marquee, a second click = Choose content, a rail Element dropped on them, Delete).
//   · Symbol: the Symbol sheet with Suggest's variations as sheets beside it.
// The FVS files call in through hooks (boardElementDrawn, boardGalleryDrawn, boardComponentEdit, boardTierShown).
// An ES module of fvs/js/main.js — docs/FVS.md §11, §13.
import { rt } from './rt.js';
import {
  pv, state
} from './engine/00-core.js';
import {
  SEED_ICONS, SYMBOL_SEED_DEFAULTS, seedForSnapshot
} from './engine/02-seed-ui.js';
import {
  ELEMENT_LIB, getElementAppearance, orientedElementTile, savedElementBySig, tileSig, withAppearance
} from './engine/04-appearance.js';
import {
  buildSeedPreviewSVG, seedPreviewStates
} from './engine/05-render-component.js';
import {
  ctrl
} from './00-core.js';
import {
  renderGallery, renderSeedPreview, setElementView
} from './05-render-component.js';
import {
  clearGallery, enterComponentEditMode, exitComponentEditMode, renderComponentEditCanvas, selectComponentEditCell
} from './06-component-ui.js';
import {
  applyElementSnapshot, enterElementEdit, layersChanged, selectLayer, setPartEdit
} from './07-library.js';
import {
  openCellContentOverlay, renderTrackLabelsOverlay, syncContentFilter
} from './11-symbol-ui.js';
import {
  fvsIsTypingTarget, galleryZoomTo, onAppearanceChange
} from './12-shell.js';
import {
  railNotice, setRailTarget
} from './15-export-library-view.js';
import {
  addSheet, boardTierShown, cellEditor, drawRings, isPanKey, makeBoard, placeSheet, removeSheet, selectSheets, setSingle,
  shapeInRect, swallowNextClick
} from './16-board.js';
import { fhCanUndo } from './02-seed-ui.js';
import { provide } from './hooks.js';
// Names earlier files reach at run time (hooks.*) — live getters.
provide({
  boardElementDrawn: () => elementDrawn, boardGalleryDrawn: () => galleryDrawn,
  boardComponentEdit: () => componentEdit, boardTierShown: () => boardTierShown
});

const el = (tag, cls, attrs) => { const n = document.createElement(tag); if (cls) n.className = cls; if (attrs) Object.assign(n, attrs); return n; };
const clone = o => JSON.parse(JSON.stringify(o));
const overlayOpen = () => ctrl('symbol-content-overlay').style.display !== 'none';   // as 12-shell.js reads it
let elementDrawn = () => {}, galleryDrawn = () => {}, componentEdit = () => {};

// ── The Element list: the user's work, in their account (Organica.store, signed out = this browser's cache) ────────
// One row per Element ({name, custom, seed, app, n = its place}) + the row 'board' ({active}).
export const ELEMENTS = Organica.store('fvs-elements');
const BOARD_ROW = 'board';
const LEGACY_ITEMS = 'organica.fvs.proto.board.element.items';   // the prototype's list (Oct 2026) — read forward once, left in place
function readElements() {
  const obj = ELEMENTS.read() || {};
  // an Element without a shape (left by a half-done add) is dropped, never allowed to stop the whole board
  let items = Object.entries(obj).filter(([k, v]) => k !== BOARD_ROW && v && v.seed && v.seed.type)
    .map(([id, v]) => ({ id, name: v.name, custom: !!v.custom, seed: v.seed, app: v.app, n: v.n || 0 })).sort((a, b) => a.n - b.n);
  let active = obj[BOARD_ROW] && obj[BOARD_ROW].active;
  if (!items.length) {
    try { const s = JSON.parse(localStorage.getItem(LEGACY_ITEMS)); if (s && s.items) { items = s.items.filter(e => e && e.id && e.seed && e.seed.type).map(e => ({ id: e.id, name: e.name, custom: !!e.custom, seed: e.seed, app: e.app })); active = s.active; } } catch (err) {}
  }
  items.forEach(e => { delete e.n; });
  return { items, active };
}
function writeElements() {
  const obj = {};
  state.elements.forEach((e, i) => { obj[e.id] = { name: e.name, custom: !!e.custom, seed: e.seed, app: e.app, n: i }; });
  obj[BOARD_ROW] = { active: state.activeElement };
  try { ELEMENTS.write(obj); } catch (err) {}
}

// ── Element board ───────────────────────────────────────────────────────────────────────────────────────
function mountElementBoard() {
  const B = makeBoard('element');
  const W = 560, GAP = 160, VH = 116;   // board units: the Element's sheet, the room between Elements, its Views strip (~92) + 24 above it
  const frame = ctrl('element-frame'), liveViews = ctrl('board-live-views'), liveEl = ctrl('board-live-element');
  const liveName = liveViews.querySelector('.fvs-board-sheet__label');
  const BOOT = { seed: clone(seedForSnapshot()), app: clone(getElementAppearance()) };   // the Element the page opened with
  // New element and Clear board start blank (Diego, O-67 b, Oct 11, 2026): an empty Freehand sheet — draw on it, or pick
  // a shape in the panel. The opening Element's other shape settings stay underneath, so a picked shape opens on its defaults.
  const BLANK = (() => {
    const b = BOOT.seed.type === 'stack' ? { ...clone(BOOT.seed.layers[BOOT.seed.active | 0] || {}), cellShape: BOOT.seed.cellShape } : clone(BOOT.seed);
    ['id', 'part', 'ink', 'name', 'layers', 'parts', 'active'].forEach(k => delete b[k]);
    if (b.cellShape === undefined) delete b.cellShape;
    return { seed: { ...b, type: 'freehand', customSeed: null, freehandData: null, freehandRaw: '' }, app: clone(BOOT.app) };
  })();
  const blankElement = () => ({ id: newId(), name: shapeName(BLANK.seed), custom: false, seed: clone(BLANK.seed), app: clone(BLANK.app) });
  const newId = () => 'e' + Date.now().toString(36) + Math.floor(Math.random() * 36 ** 3).toString(36);
  const find = id => state.elements.find(e => e.id === id);
  const active = () => state.activeElement;
  const sheetId = id => 'el-' + id, viewsId = id => 'vw-' + id;
  const save = () => writeElements();
  const idle = () => !state.componentEditMode && !state.preFigureSnapshot;   // the panel is the active Element (not a cell's scratch pad, not Figure's sandbox)
  const snap = () => { const e = find(active()); if (e && idle()) { e.seed = clone(seedForSnapshot()); e.app = clone(getElementAppearance()); } };
  const drawn = e => withAppearance(e.app, () => buildSeedPreviewSVG(e.seed, 0, false, false, 400, { outline: true }));
  // each Element has its Views above it: the active one's is FVS's live strip, the others are drawn from their snapshot —
  // a click on one edits that Element at that view
  const viewsOf = e => `<div class="fvs-seed-preview-wrap"><div class="fvs-seed-preview">${seedPreviewStates().map(([r, fh, fv, label], i) => `<div class="fvs-seed-tile" role="button" tabindex="0" data-view="${i}" aria-label="Show ${e.name} at ${label}"><div class="fvs-seed-tile__box">${withAppearance(e.app, () => buildSeedPreviewSVG(e.seed, r, fh, fv, 48, { outline: true }))}</div><span class="fvs-seed-tile__label">${label}</span></div>`).join('')}</div></div>`;
  // The name sits above the Views (Diego, Oct 11): made by itself — the saved Element's name when this Element is in the
  // library, else its shape's — until it is renamed by hand (double-click the name); an empty name goes back to the made one.
  const shapeName = sd => { const nm = t => (SEED_ICONS[t] || {}).name || t; return sd.type === 'stack' ? (sd.parts ? nm(sd.parts.source.type) + ' · parts' : 'Stack') : nm(sd.type); };
  const madeName = () => { const t = orientedElementTile(0, false, false), saved = t && savedElementBySig(tileSig(t)); return saved || shapeName(seedForSnapshot()); };
  const nameLabel = id => B.sheets[viewsId(id)] && B.sheets[viewsId(id)].label;
  function relabel() {
    state.elements.forEach(e => {
      const sh = B.sheets[sheetId(e.id)], lab = nameLabel(e.id);
      if (!sh || !lab || lab.querySelector('input')) return;
      const on = e.id === active();
      sh.el.classList.toggle('is-active', on); B.sheets[viewsId(e.id)].el.classList.toggle('is-active', on);
      lab.textContent = e.name;
      lab.setAttribute('aria-label', e.name + (on ? ' · editing' : '') + ' — drag to move, double-click to rename');
      if (on) lab.append(el('span', 'fvs-board-sheet__state', { textContent: ' · editing' }));
    });
  }
  const nameNow = () => { const e = find(active()); if (e && !e.custom) e.name = madeName(); };
  function rename(id) {
    const e = find(id), lab = nameLabel(id);
    if (!e || !lab || lab.querySelector('input')) return;
    const inp = el('input', 'nc-frame__input fvs-board-sheet__input', { type: 'text', value: e.name });
    inp.setAttribute('aria-label', 'Element name');
    lab.textContent = ''; lab.append(inp); inp.focus(); inp.select();
    let done = false;
    const end = keep => {
      if (done) return; done = true;
      const v = inp.value.trim();
      if (keep) { if (v) { e.name = v; e.custom = true; } else { e.custom = false; if (e.id === active()) nameNow(); else e.name = shapeName(e.seed); } }
      inp.remove(); relabel(); save(); lab.focus();
    };
    inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') end(true); if (ev.key === 'Escape') end(false); });
    inp.addEventListener('pointerdown', ev => ev.stopPropagation());
    inp.addEventListener('blur', () => end(true));
  }
  // A group: its name + Views sheet and its Element sheet move together; a click anywhere on it selects all of it.
  function link(id) { B.links[sheetId(id)] = [viewsId(id)]; B.links[viewsId(id)] = [sheetId(id)]; }
  function pin(id, x, y) {   // an Element at (x, y), its Views right above it (a Views position saved beside it is dropped)
    placeSheet(B, sheetId(id), x, y); placeSheet(B, viewsId(id), x, y - VH);
    B.pos[sheetId(id)] = B.sheets[sheetId(id)].p; B.pos[viewsId(id)] = B.sheets[viewsId(id)].p;
  }
  const wireName = (lab, id) => {
    lab.addEventListener('dblclick', ev => { ev.preventDefault(); rename(id()); });
    lab.addEventListener('keydown', ev => { if (ev.key === 'F2' && !lab.querySelector('input')) { ev.preventDefault(); rename(id()); } });
  };
  // the live group: the markup's own sheets, keyed by the Element being edited
  function placeLive(e, x, y) {
    addSheet(B, sheetId(e.id), null, x, y, liveEl);
    addSheet(B, viewsId(e.id), e.name, x, y - VH, liveViews);
    link(e.id); pin(e.id, x, y);
  }
  // another Element: drawn from its snapshot
  function mountStatic(e, x, y) {
    const body = el('div', 'fvs-board-el');
    body.innerHTML = drawn(e);
    const s = addSheet(B, sheetId(e.id), null, x, y, body);
    s.classList.add('fvs-board-element');
    const vb = el('div', 'fvs-board-views-static');
    vb.innerHTML = viewsOf(e);
    const v = addSheet(B, viewsId(e.id), e.name, x, y - VH, vb);
    v.classList.add('fvs-board-views');
    v.querySelector('.fvs-board-sheet__label').setAttribute('aria-label', e.name + ' — drag to move, double-click to rename');
    wireName(B.sheets[viewsId(e.id)].label, () => e.id);
    link(e.id); pin(e.id, x, y);
    vb.addEventListener('pointerdown', ev => { if (ev.button === 0 && !isPanKey(ev)) selectSheets(B, [viewsId(e.id)]); });
    vb.addEventListener('click', ev => {
      const t = ev.target.closest('[data-view]');
      ev.stopPropagation();
      activate(e.id);
      if (t) setElementView(+t.dataset.view);
    });
    vb.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[data-view]')) { ev.preventDefault(); ev.target.click(); } });
    body.addEventListener('pointerdown', ev => { if (ev.button === 0 && !isPanKey(ev)) selectSheets(B, [sheetId(e.id)]); });
    body.addEventListener('click', ev => { ev.stopPropagation(); activate(e.id); });
  }
  const dropGroup = (id, keepEl) => { removeSheet(B, sheetId(id), keepEl); removeSheet(B, viewsId(id), keepEl); };
  const posOf = id => ({ ...B.sheets[sheetId(id)].p });
  const lowest = () => state.elements.map(e => B.sheets[sheetId(e.id)]).filter(Boolean).reduce((a, b) => (b.p.y > a.p.y ? b : a));
  const placeAdd = () => { const low = lowest(); placeSheet(B, 'new-element', low.p.x, low.p.y + W + GAP + VH); };   // under the lowest Element, lined up with it
  const placeInks = () => {   // Inks follows the Element being edited: to its right, unless moved by hand
    const v = B.sheets[sheetId(active())];
    if (!v || B.pos.inks) return;
    placeSheet(B, 'inks', v.p.x + W + 60, v.p.y);
  };
  function activate(id) {
    if (id === active() || !find(id)) return;
    if (rt.partEdit) setPartEdit(false);
    snap();
    const prev = find(active()), next = find(id), pp = posOf(prev.id), np = posOf(next.id);
    dropGroup(next.id);            // its drawing goes: the live sheets take its place
    dropGroup(prev.id, true);      // the live sheets leave the Element they showed (kept in the page)
    state.activeElement = id;
    placeLive(next, np.x, np.y);
    mountStatic(prev, pp.x, pp.y);
    applyElementSnapshot(next.seed, next.app);
    onAppearanceChange(); renderGallery(); renderSeedPreview();
    selectSheets(B, [sheetId(id)]);
    relabel(); save(); B.save(); placeInks();
  }
  function add() {
    snap();
    const e = blankElement();
    state.elements.push(e);
    const at = B.sheets['new-element'].p;   // where New element stood
    mountStatic(e, at.x, at.y);
    activate(e.id);
    placeAdd();
    requestAnimationFrame(() => B.fit());   // the whole board: the Views and Inks stay in sight
  }
  // Undo (Diego, Oct 11, 2026): Delete and Clear board each keep a step — the list and the places as they were
  const undoStack = [], UNDO_MAX = 20, undoBtn = ctrl('btn-board-undo-element');
  const syncUndo = () => { undoBtn.disabled = !undoStack.length; };
  function pushUndo() {
    snap();
    undoStack.push({ items: clone(state.elements), active: active(), pos: clone(B.pos) });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    syncUndo();
  }
  function undo() {
    const u = undoStack.pop();
    if (!u) return;
    snap();
    const cur = find(active());   // the Element being edited keeps what was done to it since
    Object.assign(B.pos, u.pos);
    load({ items: u.items.map(e => (cur && e.id === cur.id ? cur : e)), active: u.active });
    selectSheets(B, []); save(); B.save(); syncUndo(); syncClear();
  }
  undoBtn.addEventListener('click', undo);
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z' || state.activeTier !== 'element' || !undoStack.length) return;
    if (fvsIsTypingTarget(e.target) || (pv('sel-seed-type') === 'freehand' && fhCanUndo())) return;   // text fields keep their own undo; a drawing with points keeps ⌘Z (12-shell.js), a blank one leaves it here
    e.preventDefault(); undo();
  });
  function remove(id) {
    if (id === active() || state.elements.length < 2) return;
    const i = state.elements.findIndex(e => e.id === id);
    if (i < 0) return;
    state.elements.splice(i, 1);
    dropGroup(id);
    placeAdd(); save(); B.save(); drawRings(B);
  }
  function layout() {   // one under the other, each with its Views above
    state.elements.forEach((e, i) => {
      const y = VH + i * (VH + W + GAP), p = B.pos[sheetId(e.id)] || { x: 0, y };
      if (e.id === active()) placeLive(e, p.x, p.y); else mountStatic(e, p.x, p.y);
    });
    placeAdd(); placeInks(); relabel();
  }
  function load(list) {   // a list from the store (boot, or another device): the board drawn again
    if (rt.partEdit) setPartEdit(false);
    selectSheets(B, []);
    const kept = { ...B.pos };   // the sheets go and come back: their places stay
    state.elements.forEach(e => dropGroup(e.id, e.id === active()));
    Object.assign(B.pos, kept);
    state.elements = list.items.map(e => ({ ...e, name: e.name || shapeName(e.seed) }));
    state.elements.forEach(e => { if (!e.custom && /^Element \d+$/.test(e.name)) e.name = shapeName(e.seed); });   // the prototype's numbered names become made ones
    state.activeElement = state.elements.some(e => e.id === list.active) ? list.active : state.elements[0].id;
    const cur = find(active());
    applyElementSnapshot(cur.seed, cur.app);
    onAppearanceChange(); renderGallery(); renderSeedPreview();
    layout();
  }
  // first: the list as saved (or one Element, the one the page opened with)
  const first = readElements();
  if (first.items.length) load(first);
  else {
    state.elements = [{ id: newId(), name: shapeName(BOOT.seed), custom: false, seed: clone(BOOT.seed), app: clone(BOOT.app) }];
    state.activeElement = state.elements[0].id;
    layout();
  }
  addSheet(B, 'inks', 'Inks', 0, 0, ctrl('board-inks'));
  addSheet(B, 'new-element', 'New element', 0, 0, ctrl('board-new-element'));
  placeAdd(); placeInks();
  // the account's copy (signed in): drawn when it arrives, and again when another device changes it
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ELEMENTS.pull().then(() => { const l = readElements(); if (l.items.length && !same(l.items, state.elements.map(e => ({ ...e })))) load(l); else save(); }).catch(() => {});
  ELEMENTS.onSync(() => {
    const l = readElements();
    if (!l.items.length || same(l.items, state.elements)) return;
    snap(); const keep = clone(find(active()));
    load({ items: l.items.map(e => (e.id === keep.id ? keep : e)), active: active() });   // the Element being edited stays as it is here
  });

  const newBtn = ctrl('btn-board-new-element');
  newBtn.innerHTML = Organica.icons.get('plus', { size: 'xl' });
  newBtn.addEventListener('click', add);
  wireName(liveName, active);
  // keep the active snapshot current (panel edits) — saved a moment after the last change, and when leaving
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(() => { if (!idle()) return; snap(); nameNow(); relabel(); save(); syncClear(); }, 400); };
  [frame, liveViews].forEach(n => n.addEventListener('click', later, true));   // a save to the library (the circles on the frame / Views) names it
  window.addEventListener('pagehide', () => { snap(); save(); });
  // the selection: a click anywhere on the live group selects it
  [liveViews.querySelector('.fvs-board-sheet__body'), liveEl].forEach(n => n.addEventListener('pointerdown', ev => { if (ev.button === 0 && !isPanKey(ev) && !B.single) selectSheets(B, [sheetId(active())]); }));
  // Delete on a selected Element group (not the one being edited) removes it from the board
  document.addEventListener('keydown', ev => {
    if (state.activeTier !== 'element' || B.single || (ev.key !== 'Delete' && ev.key !== 'Backspace') || fvsIsTypingTarget(ev.target) || rt.partEdit) return;
    const ids = [...B.selected].filter(k => k.startsWith('el-')).map(k => k.slice(3)).filter(id => id !== active());
    if (!ids.length) return;
    ev.preventDefault();
    pushUndo();
    ids.forEach(remove);
  });
  // Clear board: every Element goes, one blank Element is left (O-67 b) — as Symbol's Clear
  const canon = v => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v);   // key order is not content
  const sameContent = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  const isBlank = sd => sd.type === 'freehand' && !sd.freehandRaw && !(sd.customSeed && sd.customSeed.d);   // an empty Freehand: nothing drawn yet
  const isClear = () => state.elements.length === 1 && isBlank(find(active()).seed) && sameContent(find(active()).app, BLANK.app);
  function clearAll() {
    if (rt.partEdit) setPartEdit(false);
    selectSheets(B, []);
    state.elements.forEach(e => { dropGroup(e.id, e.id === active()); });
    state.elements.forEach(e => { delete B.pos[sheetId(e.id)]; delete B.pos[viewsId(e.id)]; });
    const e = blankElement();
    state.elements = [e]; state.activeElement = e.id;
    placeLive(e, 0, VH);
    applyElementSnapshot(clone(BLANK.seed), clone(BLANK.app));
    onAppearanceChange(); renderGallery(); renderSeedPreview();
    relabel(); save(); B.save();
    placeAdd(); placeInks();
    requestAnimationFrame(() => B.fit());
  }
  const clearBtn = ctrl('btn-board-clear-element');
  const syncClear = () => { snap(); clearBtn.disabled = isClear(); };
  clearBtn.addEventListener('click', () => { pushUndo(); clearAll(); syncClear(); });
  B.afterMove = () => { placeInks(); placeAdd(); };   // Inks beside the Element being edited, New element under the lowest Element

  // Inks: the Palette as a tray — click puts an ink on the selected parts, drag it onto a part.
  const tray = ctrl('board-inks-tray'), trayHint = ctrl('board-inks-hint');
  const parts = () => (state.layers && state.layers.parts ? state.layers.items.filter(l => l.part) : []);
  const picked = () => {
    const L = state.layers, ids = new Set(rt.partSel);
    if (L && L.items[L.active] && L.items[L.active].part) ids.add(L.items[L.active].id);
    return ids;
  };
  const setInk = (ids, ink) => { parts().forEach(l => { if (ids.has(l.id)) l.ink = ink; }); layersChanged(); };
  const renderTray = () => {
    const on = parts().length > 0, key = JSON.stringify([state.colors, on]);
    if (tray.dataset.key === key) return;
    tray.dataset.key = key;
    trayHint.hidden = on;
    tray.innerHTML = state.colors.map((c, k) => `<button type="button" data-ink="${k}" style="--sw:${c}" aria-label="Ink ${k + 1}" title="Ink ${k + 1} · ${c}"${on ? '' : ' disabled'}></button>`).join('');
  };
  tray.addEventListener('click', e => {
    const b = e.target.closest('button[data-ink]');
    if (!b) return;
    const ids = picked();
    if (ids.size) setInk(ids, +b.dataset.ink);
  });
  // drag an ink onto a part: a part in the selection colours the whole selection
  tray.addEventListener('pointerdown', e => {
    const b = e.target.closest('button[data-ink]');
    if (!b || b.disabled || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY, ink = +b.dataset.ink;
    let ghost = null, over = null;
    const partAt = ev => document.elementsFromPoint(ev.clientX, ev.clientY).map(n => n.closest && n.closest('#element-svg [data-part]')).find(Boolean) || null;
    const mv = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        ghost = el('div', 'fvs-rail-ghost fvs-rail-ghost--ink'); ghost.style.setProperty('--sw', state.colors[ink]); document.body.append(ghost);   // outside the board: it is position: fixed
        if (!rt.partEdit) enterElementEdit();
      }
      ghost.style.translate = `${ev.clientX - 12}px ${ev.clientY - 12}px`;
      const p = partAt(ev);
      if (p !== over) { if (over) over.classList.remove('is-drop'); over = p; if (p) p.classList.add('is-drop'); }
    };
    const up = ev => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (!ghost) return;
      ghost.remove(); swallowNextClick(frame);   // the drag's own click (if any) — never a flag left for the next real click
      const p = partAt(ev);
      if (over) over.classList.remove('is-drop');
      if (!p) return;
      const id = p.getAttribute('data-part'), sel = picked();
      setInk(sel.has(id) ? sel : new Set([id]), ink);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });

  // Every redraw of the Element (renderElementFrame): the tray, New element's Paper, the list kept current.
  elementDrawn = () => {
    renderTray();
    newBtn.style.setProperty('--fvs-board-paper', state.paperColor);   // the Element's Paper (content colour)
    later();
  };

  // Double-click an Element = its single view: the classic Element page (Diego, Oct 11 — not a zoom on the board).
  // The same markup laid out as the step's own (Views, the Edit toolbar, the Element); Back to board / Esc return.
  const enterSingle = () => { if (B.single) return; setSingle(B, true); renderSeedPreview(); ctrl('btn-element-board-back').focus({ preventScroll: true }); };
  const exitSingle = () => { if (!B.single) return; setSingle(B, false); renderSeedPreview(); placeInks(); };
  ctrl('btn-element-board-back').addEventListener('click', exitSingle);
  // the second press of a double-click, not dblclick: in Edit the first click redraws the parts, and a dblclick whose
  // first target left the page never comes
  frame.addEventListener('mousedown', e => { if (e.detail !== 2 || e.button !== 0 || B.single || e.target.closest('button')) return; e.preventDefault(); enterSingle(); });
  liveEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === liveEl && !B.single) { e.preventDefault(); enterSingle(); } });
  // Esc: leaves Edit first (FVS's own, 07-library.js), then the single view
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !B.single || state.activeTier !== 'element' || rt.partEdit || fvsIsTypingTarget(e.target) || overlayOpen()) return;
    e.preventDefault(); exitSingle();
  }, true);
  // Parts, the Symbol way: marquee + ⌘.
  cellEditor(B, {
    frame,
    active: () => !!rt.partEdit && parts().length > 0,
    cells: () => [...frame.querySelectorAll('#element-svg [data-part]')],
    key: c => c.getAttribute('data-part'),
    hit: shapeInRect,
    selection: () => picked(),
    select(keys, add) {
      const L = state.layers;
      const next = new Set(add ? [...picked(), ...keys] : keys);
      rt.partSel = next;
      const i = L.items.findIndex(l => next.has(l.id));
      if (i >= 0 && i !== L.active) selectLayer(i); else layersChanged();
    },
  });
  // Delete on picked parts: nothing to empty in an Element — left out on purpose (docs/FVS.md §13).
  B.fitFocus = () => B.fit([sheetId(active())]);
  B.beforeFit = () => placeInks();
  renderTray();
  requestAnimationFrame(syncClear);   // the board as it opens: nothing to clear on a fresh one
}

// ── Component board ─────────────────────────────────────────────────────────────────────────────────────
function mountComponentBoard() {
  const B = makeBoard('component');
  const gal = ctrl('gallery'), frame = ctrl('component-edit-frame');
  addSheet(B, 'gallery', 'Gallery', 0, 0, ctrl('board-gallery'));
  galleryZoomTo(2);   // the candidates at 2× on the board
  // Double-click a candidate (or its pencil) = Component Edit in its single view: the classic page — toolbar, part
  // colours, the fixed sheet — with the board hidden, the same as an Element's (Diego, Oct 11). Back to board / Esc return.
  gal.addEventListener('dblclick', e => {
    const w = e.target.closest('.fvs-thumb-wrap');
    if (!w) return;
    const comp = state.components[[...gal.children].indexOf(w)];
    if (comp) enterComponentEditMode(comp.id);
  });
  // A saved Element dragged from the Library rail onto a cell, or onto the selection.
  const CE_RAIL = {
    cellSel: '#component-edit-frame [data-cell-index]',
    apply(kind, name, idx) {
      if (kind !== 'element') { railNotice('A Component cell takes an Element'); return; }
      const e = ELEMENT_LIB.read()[name];
      if (!e || !e.seed) { railNotice('This Element was saved without its settings'); return; }
      const content = { source: 'seed', seedType: e.seed.type, seedParams: clone(e.seed), appearance: e.appearance || state.componentEditDefaultAppearance };
      const targets = idx != null && !rt.cePicked.has(idx) ? [idx] : [...rt.cePicked];
      targets.forEach(i => { const c = state.componentEditCells[i]; if (c) c.content = clone(content); });
      renderComponentEditCanvas();
    },
  };
  componentEdit = on => {
    setSingle(B, on);
    if (on) setRailTarget(CE_RAIL);
    else { if (rt.railTarget === CE_RAIL) setRailTarget(null); requestAnimationFrame(() => B.fit(['gallery'])); }
  };
  // Component cells, the Symbol way.
  let lastPicked = new Set();
  cellEditor(B, {
    frame,
    active: () => !!state.componentEditMode,
    cells: () => [...frame.querySelectorAll('[data-cell-index]')],
    key: c => +c.dataset.cellIndex,
    selection: () => rt.cePicked,
    wasSelected: k => lastPicked.has(k),
    select(keys, add) {
      const next = new Set(add ? [...rt.cePicked, ...keys] : keys);
      rt.cePicked = next;
      if (next.size) selectComponentEditCell(Math.min(...next)); else renderComponentEditCanvas();
    },
    choose: () => openChooseForCells(),
  });
  frame.addEventListener('pointerdown', () => { lastPicked = new Set(rt.cePicked); }, true);
  document.addEventListener('keydown', e => {
    if (!state.componentEditMode || state.activeTier !== 'component' || fvsIsTypingTarget(e.target)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && rt.cePicked.size && !overlayOpen()) {   // the picked cells back to the Component's own Element
      e.preventDefault();
      rt.cePicked.forEach(i => { const c = state.componentEditCells[i]; if (c) { delete c.content; delete c.partInks; } });
      renderComponentEditCanvas();
    }
    if (e.key === 'Escape' && !e.defaultPrevented && !overlayOpen()) { e.preventDefault(); exitComponentEditMode(); }
  });
  B.fitFocus = () => B.fit(['gallery']);
  // Clear board: every candidate goes — FVS's own clearGallery (it keeps an undo step, so ⌘Z brings them back)
  const clearBtn = ctrl('btn-board-clear-component');
  galleryDrawn = () => { clearBtn.disabled = !state.components.length; };
  clearBtn.addEventListener('click', () => { if (state.componentEditMode) exitComponentEditMode(); clearGallery(); });
  galleryDrawn();
}
// Choose content for Component cells: the Seed types (on this Component's own Element) and Empty (= its default).
// A Component in a Component cell does not exist: the overlay shows its Seeds only (seedsOnly).
function openChooseForCells() {
  rt.contentFilter = 'all'; syncContentFilter();
  openCellContentOverlay({
    seedsOnly: true,
    count: () => rt.cePicked.size,
    apply(patch) {
      rt.cePicked.forEach(i => {
        const c = state.componentEditCells[i];
        if (!c) return;
        const p = typeof patch === 'function' ? patch(c) : patch;
        if (p.source === 'empty') { delete c.content; return; }
        if (p.source === 'seed') {   // an Element tile carries its settings; a plain Seed type takes the defaults
          const seedParams = p.seedParams ? clone(p.seedParams) : { ...state.componentEditDefaultSeed, ...SYMBOL_SEED_DEFAULTS, type: p.seedType };
          if (!p.seedParams) { delete seedParams.parts; delete seedParams.layers; }
          c.content = { source: 'seed', seedType: p.seedType, seedParams, appearance: state.componentEditDefaultAppearance };
        }
        if ('rotation' in p) c.rotation = p.rotation || 0;
        if ('flipH' in p) c.flipH = !!p.flipH;
        if ('flipV' in p) c.flipV = !!p.flipV;
      });
      renderComponentEditCanvas();
    },
    done() {},
  });
}

// ── Symbol board ────────────────────────────────────────────────────────────────────────────────────────
function mountSymbolBoard() {
  const B = makeBoard('symbol');
  addSheet(B, 'symbol', 'Symbol', 0, 0, ctrl('board-symbol'));
  addSheet(B, 'variations', 'Variations', 980, 0, ctrl('board-variations'));
  ctrl('board-variations').classList.toggle('is-empty', !state.symbolSuggestions.length);
  B.fitFocus = () => B.fit(['symbol']);
  // the % labels are measured on screen: placed again after a zoom (one frame later, after the transform)
  B.onZoom = () => { cancelAnimationFrame(B.labelsRaf); B.labelsRaf = requestAnimationFrame(() => { if (state.activeTier === 'symbol') renderTrackLabelsOverlay(); }); };
}

mountElementBoard();
mountComponentBoard();
mountSymbolBoard();
// The boards' gestures reach past them — a rail Element dropped on a cell, Clear board's hold: the same mouse there
// (one that reports a side button held sends no pointerdown), as node-canvas does for its node bar.
Organica.nodeCanvas.chordShim(ctrl('fvs-rail-panel'));
Organica.nodeCanvas.chordShim(document.querySelector('body > .org-floatbar[role="toolbar"]'));
