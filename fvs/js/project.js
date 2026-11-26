// Flexible Visual System · project — which Project this page works on (Nov 26, 2026, ledger O-67 a).
// A Project = the boards: the Element board (with each Element's Component gallery), the Symbol board, the Figure
// being edited and the board views. The libraries (saved Elements, Components, Symbols, Assets, named graphs, Sets,
// rules, photos, palettes) stay shared by every Project. Each board store gets the Project's id in its name
// ('fvs-elements@p…') and lives in memory + IndexedDB + the account (shared/store.js, backend 'idb'), so only the
// open Project is loaded and a large one no longer fills the ~5 MB localStorage quota.
//
// main.js awaits openProject() BEFORE it imports the rest of FVS: every file that makes a board store at its top
// level (18-step-boards.js, 17-figure-graph.js, 16-board.js's view keys) then finds PROJECT set and its store filled.
// docs/FVS.md § Projects.

import { rt } from './rt.js';
import { provide } from './hooks.js';

export const PROJECTS = Organica.store('fvs-projects');   // the index: { [pid]: { name, createdAt, updatedAt, counts, uses, thumb? } }
export const BOARD_STORES = ['fvs-elements', 'fvs-symbol-work', 'fvs-figure-work'];
const IDB = { backend: 'idb' };
const LAST = 'organica.fvs.project.last';   // the Project open last on this browser
const VIEW_KEYS = ['organica.fvs.board.element', 'organica.fvs.board.component', 'organica.fvs.board.symbol', 'organica.fvs.figure-view'];

export const PROJECT = {
  id: null,
  get name() { const r = this.id && PROJECTS.peek()[this.id]; return r ? r.name : ''; },
  tool(base) { return base + '@' + this.id; },   // 'fvs-elements' → 'fvs-elements@p…'
  viewKey(key) { return key.replace(/^organica\.fvs\./, 'organica.fvs.' + this.id + '.'); },   // per-browser board views
};

// A store of the open Project's boards — memory + IndexedDB + the account.
export const projectStore = base => Organica.store(PROJECT.tool(base), IDB);

export const newProjectId = () => 'p' + Date.now().toString(36) + Math.floor(Math.random() * 36 ** 3).toString(36);
export function nextProjectName(index) {
  const used = new Set(Object.values(index || PROJECTS.peek()).map(r => r && r.name));
  let n = 1; while (used.has('Project ' + n)) n++;
  return 'Project ' + n;
}

// A new row in the index. Returns the id.
export function createProject(name, extra) {
  const all = PROJECTS.read(), id = newProjectId(), now = new Date().toISOString();
  all[id] = { name: name || nextProjectName(all), createdAt: now, updatedAt: now, counts: { elements: 0, symbols: 0, figureNodes: 0 }, uses: { components: [], elements: [] }, ...(extra || {}) };
  PROJECTS.write(all);
  return id;
}

// Change the open Project's index row (debounced: a board saves often). patch: an object, or a function of the row.
let touchT = 0, touchPatch = [];
export function touchProject(patch) {
  if (!PROJECT.id) return;
  touchPatch.push(patch || {});
  clearTimeout(touchT);
  touchT = setTimeout(flushTouch, 300);
}
function flushTouch() {
  clearTimeout(touchT);
  if (!touchPatch.length || !PROJECT.id) return;
  const all = PROJECTS.read(), row = all[PROJECT.id];
  if (!row) { touchPatch = []; return; }   // deleted in another tab meanwhile
  touchPatch.forEach(p => Object.assign(row, typeof p === 'function' ? p(row) : p));
  touchPatch = [];
  row.updatedAt = new Date().toISOString();
  PROJECTS.write(all);
}
window.addEventListener('pagehide', flushTouch);

// ── The card's picture on the home: an SVG of the open Project, local to this browser (IndexedDB, not the account —
// a picture can weigh a few hundred KB and is drawn again the next time the Project is open) ─────────────────────────
export const thumbKey = id => 'fvs-project-thumb:' + id;
let thumbAt = 0, thumbT = 0;
export function saveThumb(make) {   // make() → an SVG string ('' = none); drawn at most every 5 s, and once more after the last call
  if (!PROJECT.id || !Organica.idb) return;
  const run = () => { thumbAt = Date.now(); let svg = ''; try { svg = make() || ''; } catch (e) {} if (svg && svg.length < 600000) Organica.idb.set(thumbKey(PROJECT.id), svg); };
  clearTimeout(thumbT);
  if (Date.now() - thumbAt > 5000) run(); else thumbT = setTimeout(run, 5000);
}

// ── What a Project's boards use from the shared library ─────────────────────────────────────────────────────────
// Kept on its index row (uses), so the library can tell, without opening every Project, that a Component or an Element
// is still named somewhere: a Symbol cell or the Symbol pool names a Component; a Paper tile 'saved:<name>' an Element.
export function symbolUses(symbols) {
  const comps = new Set();
  (symbols || []).forEach(s => { const w = s && s.work; if (!w) return;
    (w.cells || []).forEach(c => { if (c && c.componentName) comps.add(c.componentName); });
    (w.pool || w.palette || []).forEach(p => { if (p && p.name) comps.add(p.name); });
  });
  return [...comps].sort();
}
const SAVED_REF = /"saved:((?:[^"\\]|\\.)*)"/g;
export function elementUses(...data) {
  const names = new Set();
  data.forEach(d => { const j = JSON.stringify(d || null); let m; SAVED_REF.lastIndex = 0; while ((m = SAVED_REF.exec(j))) names.add(JSON.parse('"' + m[1] + '"')); });
  return [...names].sort();
}
// Other Projects that use a saved item (the open one is counted from its live boards by the caller).
// uses = { components: [names] (Symbol board), elements: [names] (Element board), symbolElements: [names] (Symbol board) }
export function usedElsewhere(kind, name) {
  const keys = kind === 'element' ? ['elements', 'symbolElements'] : ['components'];
  return Object.entries(PROJECTS.peek()).filter(([id, r]) => id !== PROJECT.id && r && r.uses && keys.some(k => (r.uses[k] || []).includes(name))).length;
}
provide({ usedElsewhere: () => usedElsewhere, projectSymbolUses: () => symbolUses });   // for the library (engine/15-export-library-view.js)

// ── Renames across Projects ─────────────────────────────────────────────────────────────────────────────────────
// Renaming a saved Component or Element repoints the open Project at once (07-library.js, 15-export-library-view.js);
// a closed Project's boards are not loaded, so the rename is kept here — 'fvs-renames': { '<kind>:<old>': {to, at} } —
// and applied when that Project next opens (each index row keeps renamesSeen, the time of the last one it applied).
export const RENAMES = Organica.store('fvs-renames');
export function recordRename(kind, from, to) {
  if (!from || !to || from === to) return;
  const all = RENAMES.read(), at = new Date().toISOString();
  Object.keys(all).forEach(k => { if (k.startsWith(kind + ':') && all[k].to === from) all[k] = { to, at }; });   // A → B, then B → C: A → C
  all[kind + ':' + from] = { to, at };
  delete all[kind + ':' + to];   // a name used again is a new item
  RENAMES.write(all);
}
// Rename the library names a Project's two board stores use (plain objects, changed in place). map = { component: {old: new},
// element: {old: new} }. Returns true when anything changed. Used by the renames below and by Open file (a name taken here).
export function remapNames(elements, symbols, map) {
  const cm = (map && map.component) || {}, em = (map && map.element) || {};
  let hit = false;
  const comp = n => (n in cm ? (hit = true, cm[n]) : n);
  Object.values(symbols || {}).forEach(row => { const w = row && row.work; if (!w) return;
    (w.cells || []).forEach(c => { if (c && c.componentName) c.componentName = comp(c.componentName); });
    (w.pool || w.palette || []).forEach(p => { if (p && p.name) p.name = comp(p.name); });
  });
  Object.values(elements || {}).forEach(row => { const g = row && row.gallery; if (!g) return;
    (g.components || []).forEach(c => { if (c.savedName) c.savedName = comp(c.savedName); if (c.savedNames) c.savedNames = c.savedNames.map(comp); });
  });
  Object.entries(em).forEach(([oldName, newName]) => {   // a Paper tile names its Element: 'saved:<name>'
    const from = JSON.stringify('saved:' + oldName), to = JSON.stringify('saved:' + newName);
    [elements, symbols].forEach(obj => Object.keys(obj || {}).forEach(id => { const j = JSON.stringify(obj[id]); if (j.includes(from)) { obj[id] = JSON.parse(j.split(from).join(to)); hit = true; } }));
  });
  return hit;
}
// Apply the renames newer than `since` to a Project's two board stores (plain objects). Returns true when it changed.
export function applyRenames(elements, symbols, since) {
  const map = { component: {}, element: {} };
  Object.entries(RENAMES.read()).forEach(([k, v]) => { if (!v || String(v.at) <= String(since || '')) return; const i = k.indexOf(':'); const kind = k.slice(0, i); if (map[kind]) map[kind][k.slice(i + 1)] = v.to; });
  if (!Object.keys(map.component).length && !Object.keys(map.element).length) return false;
  return remapNames(elements, symbols, map);
}

// ── A closed Project's boards: read without opening it (Duplicate, Save as file) ──────────────────────────────────────
const storeOf = (id, base) => Organica.store(base + '@' + id, IDB);
export async function readBoards(id) {
  const out = {};
  for (const b of BOARD_STORES) { await Organica.store.preload(b + '@' + id); out[b] = await storeOf(id, b).pull().catch(() => storeOf(id, b).read()); }
  return out;   // { 'fvs-elements': {…}, 'fvs-symbol-work': {…}, 'fvs-figure-work': {…} }
}
export function writeBoards(id, boards) {
  BOARD_STORES.forEach(b => { if (boards[b]) storeOf(id, b).write(boards[b]); });
}
export async function duplicateProject(id, name) {
  const src = PROJECTS.read()[id]; if (!src) return null;
  const boards = await readBoards(id);
  const nid = createProject(name, { counts: { ...(src.counts || {}) }, uses: JSON.parse(JSON.stringify(src.uses || {})), renamesSeen: src.renamesSeen });
  writeBoards(nid, JSON.parse(JSON.stringify(boards)));
  await Promise.all(BOARD_STORES.map(b => storeOf(nid, b).pull().catch(() => {})));   // signed in: the copy goes up to the account
  if (Organica.idb) { const t = await Organica.idb.get(thumbKey(id)); if (t) Organica.idb.set(thumbKey(nid), t); }
  return nid;
}
export async function deleteProject(id) {
  const all = PROJECTS.read(); if (!all[id]) return;
  delete all[id]; PROJECTS.write(all);
  await Promise.all(BOARD_STORES.map(b => Organica.store.drop(b + '@' + id)));
  if (Organica.idb) Organica.idb.del(thumbKey(id));
  VIEW_KEYS.forEach(k => { try { localStorage.removeItem(k.replace(/^organica\.fvs\./, 'organica.fvs.' + id + '.')); } catch (e) {} });
  try { if (localStorage.getItem(LAST) === id) localStorage.removeItem(LAST); } catch (e) {}
}

// ── The Project file (.fvs, JSON inside): the boards + the library entries they name, so it opens in another account ──
export const FILE_TOOL = 'fvs-project';
const LIBS = { component: 'fvs', element: 'fvs-element' };
export async function projectFile(id) {
  const row = PROJECTS.read()[id]; if (!row) return null;
  const boards = await readBoards(id);
  const comps = Organica.store(LIBS.component).read(), els = Organica.store(LIBS.element).read();
  const want = new Set(symbolUses(Object.values(boards['fvs-symbol-work'] || {}).filter(r => r && r.work)));
  Object.values(boards['fvs-elements'] || {}).forEach(r => ((r && r.gallery && r.gallery.components) || []).forEach(c => [c.savedName, ...(c.savedNames || [])].forEach(n => n && want.add(n))));
  const component = {};
  const add = n => { if (!n || component[n] || !comps[n]) return; component[n] = comps[n]; add(comps[n].underlyingComponentName); };   // a Container / Mask names its underlying Component
  want.forEach(add);
  const element = {};
  elementUses(boards, component).forEach(n => { if (els[n]) element[n] = els[n]; });
  return { tool: FILE_TOOL, version: 1, name: row.name, savedAt: new Date().toISOString(), boards, library: { component, element } };
}
// A file → always a new Project (Diego, Nov 26, 2026: nothing is overwritten). A library entry missing here is added; one
// whose name is taken by a different entry comes in as "‹name› (imported)" and the boards are pointed at it.
export function importProjectFile(file) {
  if (!file || file.tool !== FILE_TOOL || !file.boards) return null;
  const boards = JSON.parse(JSON.stringify(file.boards)), map = { component: {}, element: {} };
  Object.entries(LIBS).forEach(([kind, tool]) => {
    const st = Organica.store(tool), all = st.read(), incoming = (file.library && file.library[kind]) || {};
    let changed = false;
    Object.entries(incoming).forEach(([n, entry]) => {
      if (all[n] && JSON.stringify(all[n]) === JSON.stringify(entry)) return;   // the same one: nothing to do
      let to = n;
      if (all[n]) { to = n + ' (imported)'; for (let i = 2; all[to]; i++) to = n + ' (imported ' + i + ')'; map[kind][n] = to; }
      all[to] = entry; changed = true;
    });
    if (kind === 'component') Object.values(all).forEach(e => { if (e && e.underlyingComponentName in map.component) e.underlyingComponentName = map.component[e.underlyingComponentName]; });
    if (changed) st.write(all);
  });
  remapNames(boards['fvs-elements'], boards['fvs-symbol-work'], map);
  const index = PROJECTS.read(), base = String(file.name || 'Project').trim() || 'Project';
  let name = base; for (let i = 1; Object.values(index).some(r => r && r.name === name); i++) name = base + ' copy' + (i > 1 ? ' ' + i : '');
  const els = Object.keys(boards['fvs-elements'] || {}).filter(k => k !== 'board').length, sys = Object.keys(boards['fvs-symbol-work'] || {}).filter(k => k !== 'board' && k !== 'current').length;
  const id = createProject(name, { counts: { elements: els, symbols: sys, figureNodes: 0 }, uses: { components: symbolUses(Object.values(boards['fvs-symbol-work'] || {})), elements: elementUses(boards['fvs-elements']), symbolElements: elementUses(boards['fvs-symbol-work']) } });
  writeBoards(id, boards);
  return id;
}

// ── Migration (once): the single working set before Projects becomes "Project 1" ──────────────────────────────────
// The old stores are read (pulled from the account when signed in, so a new browser finds the work too) and COPIED;
// the old keys and rows stay in place (CLAUDE.md, localStorage keys: user work is never deleted in the same release).
async function legacyWork() {
  const el = await Organica.store('fvs-elements').pull().catch(() => ({}));
  const sy = await Organica.store('fvs-symbol-work').pull().catch(() => ({}));
  let fig = null;
  try { const g = JSON.parse(localStorage.getItem('organica.fvs-figure.presets') || '{}'); fig = g && g.__current || null; } catch (e) {}
  const has = Object.keys(el || {}).some(k => k !== 'board') || Object.keys(sy || {}).some(k => k !== 'board' && k !== 'current') || !!(fig && fig.model && fig.model.nodes && fig.model.nodes.length);
  return has ? { el, sy, fig } : null;
}
async function migrate() {
  const w = await legacyWork();
  if (!w) return null;
  const id = createProject('Project 1');
  PROJECT.id = id;
  projectStore('fvs-elements').write(w.el || {});
  projectStore('fvs-symbol-work').write(w.sy || {});
  if (w.fig) projectStore('fvs-figure-work').write({ current: w.fig });
  VIEW_KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v != null) localStorage.setItem(PROJECT.viewKey(k), v); } catch (e) {} });
  return id;
}

// ── Two tabs on one Project: the later one warns (both would autosave over each other) ─────────────────────────────
function watchTabs(id) {
  if (!('BroadcastChannel' in window)) return;
  const ch = new BroadcastChannel('organica.fvs.project'), me = Math.random().toString(36).slice(2);
  ch.onmessage = ev => {
    const m = ev.data || {};
    if (m.id !== id || m.from === me) return;
    if (m.type === 'hello') ch.postMessage({ type: 'here', id, from: me });
    else if (m.type === 'here') Organica.notice('This project is open in another tab: changes here and there can overwrite each other.', { kind: 'error' });
  };
  ch.postMessage({ type: 'hello', id, from: me });
}

// Which Project to open: ?project=<id> → the last one on this browser → null = the home (Your projects), which is also
// what ?home asks for. With no Project at all, the work of before Projects becomes Project 1, else a first empty one is made.
export async function chooseProject() {
  await PROJECTS.pull().catch(() => {});
  const index = PROJECTS.read(), params = new URLSearchParams(location.search);
  if (params.has('home')) return null;
  const q = params.get('project');
  if (q && index[q]) return q;
  try { const l = localStorage.getItem(LAST); if (l && index[l]) return l; } catch (e) {}
  if (Object.keys(index).length) return null;   // Projects, none open last on this browser: choose on the home
  return (await migrate()) || createProject();
}
// Open it: the address names it, its board stores are filled before FVS reads them. Sets PROJECT.id.
export async function openProject(id) {
  PROJECT.id = id;
  try { localStorage.setItem(LAST, id); } catch (e) {}
  const u = new URL(location.href);
  if (u.searchParams.get('project') !== id || u.searchParams.has('home')) {   // a reload or a shared link opens the same one
    u.searchParams.set('project', id); u.searchParams.delete('home'); history.replaceState(history.state, '', u);
  }
  rt.projectId = id;
  await Promise.all(BOARD_STORES.map(b => Organica.store.preload(PROJECT.tool(b))));
  // renames made in another Project since this one was last open
  const row = PROJECTS.read()[id] || {}, now = new Date().toISOString();
  const E = projectStore('fvs-elements'), S = projectStore('fvs-symbol-work'), el = E.read(), sy = S.read();
  if (applyRenames(el, sy, row.renamesSeen)) { E.write(el); S.write(sy); }
  touchProject({ renamesSeen: now });
  projectStore('fvs-figure-work').pull().catch(() => {});   // the Figure loads on demand: its account copy arrives meanwhile
  watchTabs(id);
  return id;
}
// Go to a Project (a reload: only that one is loaded) / to the home.
export const goToProject = id => { const u = new URL(location.href); u.search = '?project=' + encodeURIComponent(id); location.assign(u); };
export const projectHref = id => '/fvs/?project=' + encodeURIComponent(id);
