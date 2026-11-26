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
// Apply the renames newer than `since` to a Project's two board stores (plain objects). Returns true when it changed.
export function applyRenames(elements, symbols, since) {
  const todo = Object.entries(RENAMES.read()).filter(([, v]) => v && String(v.at) > String(since || ''));
  if (!todo.length) return false;
  let hit = false;
  const comp = n => { for (const [k, v] of todo) if (k === 'component:' + n) { hit = true; return v.to; } return n; };
  Object.values(symbols || {}).forEach(row => { const w = row && row.work; if (!w) return;
    (w.cells || []).forEach(c => { if (c && c.componentName) c.componentName = comp(c.componentName); });
    (w.pool || w.palette || []).forEach(p => { if (p && p.name) p.name = comp(p.name); });
  });
  Object.values(elements || {}).forEach(row => { const g = row && row.gallery; if (!g) return;
    (g.components || []).forEach(c => { if (c.savedName) c.savedName = comp(c.savedName); if (c.savedNames) c.savedNames = c.savedNames.map(comp); });
  });
  todo.filter(([k]) => k.startsWith('element:')).forEach(([k, v]) => {   // a Paper tile names its Element: 'saved:<name>'
    const from = JSON.stringify('saved:' + k.slice(8)), to = JSON.stringify('saved:' + v.to);
    [elements, symbols].forEach(obj => Object.keys(obj || {}).forEach(id => { const j = JSON.stringify(obj[id]); if (j.includes(from)) { obj[id] = JSON.parse(j.split(from).join(to)); hit = true; } }));
  });
  return hit;
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

// Which Project to open: ?project=<id> → the last one on this browser → the most recently edited → the old work
// migrated → a new empty one. Fills the board stores before FVS reads them. Sets PROJECT.id.
// TODO(Projects, step 4): with no ?project and no last one, show the home (Your projects) instead of opening one.
export async function openProject() {
  await PROJECTS.pull().catch(() => {});
  const index = PROJECTS.read();
  const q = new URLSearchParams(location.search).get('project');
  let id = q && index[q] ? q : null;
  if (!id) { try { const l = localStorage.getItem(LAST); if (l && index[l]) id = l; } catch (e) {} }
  if (!id) { const ids = Object.keys(index).sort((a, b) => String(index[b].updatedAt).localeCompare(String(index[a].updatedAt))); id = ids[0] || null; }
  if (!id) id = await migrate();
  if (!id) id = createProject();
  PROJECT.id = id;
  try { localStorage.setItem(LAST, id); } catch (e) {}
  if (q !== id) {   // the address names the Project, so a reload or a shared link opens the same one
    const u = new URL(location.href); u.searchParams.set('project', id); history.replaceState(history.state, '', u);
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
