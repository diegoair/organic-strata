// Flexible Visual System · home — Your projects (Nov 26, 2026, ledger O-67 a). The cards of every Project: open, rename,
// duplicate, save as file, delete (armed: a Project is three boards and has no undo), New project, Open file….
// Two ways in: the page itself when no Project is open (main.js, standalone — the app is not loaded, its bars hidden by
// body.fvs-home-only), or over the open Project from the step bar's Project button (wireProjectButton), the way the
// Library view covers the tier views. Imports only project.js: it works without the rest of FVS.
// Copy: docs/UI-COPY.md (Project row). docs/FVS.md § Projects.
import {
  PROJECT, PROJECTS, createProject, deleteProject, duplicateProject, goToProject, importProjectFile, nextProjectName,
  projectFile, projectHref, thumbKey,
} from './project.js';

const $ = id => document.getElementById(id);
let standalone = false, thumbs = {}, q = '';
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isOpen = () => !$('fvs-projects').hidden;
const status = t => { $('projects-status').textContent = t || ''; };

// "Edited today" · "Edited yesterday" · "Edited 24 Nov" · "Edited 24 Nov 2025"
export function editedWords(iso, now = new Date()) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff <= 0) return 'Edited today';
  if (diff === 1) return 'Edited yesterday';
  const opts = { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) };
  return 'Edited ' + d.toLocaleDateString('en-GB', opts);
}
export function countWords(c) {
  c = c || {};
  const one = (n, w) => (n || 0) + ' ' + w + ((n || 0) === 1 ? '' : 's');
  return one(c.elements, 'Element') + ' · ' + one(c.symbols, 'Symbol');
}
const sorted = () => Object.entries(PROJECTS.peek()).filter(([, r]) => r && r.name)
  .sort(([, a], [, b]) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

function card(id, r) {
  const cur = id === PROJECT.id, tile = document.createElement('div');
  tile.className = 'fvs-libview__tile'; tile.dataset.pid = id;
  if (cur) tile.setAttribute('aria-current', 'true');
  const t = thumbs[id];
  tile.innerHTML = `<a class="fvs-libview__thumb" href="${projectHref(id)}" data-theme="light" data-pj-act="open" aria-label="${esc((cur ? 'Back to ' : 'Open ') + r.name)}">${t || Organica.icons.get('fvs-symbol', { size: 'xl' })}</a>`
    + `<p class="fvs-libview__name fvs-library-caption" title="${esc(r.name)}">${esc(r.name)}</p>`
    + `<p class="fvs-libview__meta">${cur ? 'Editing · ' : ''}${esc(editedWords(r.updatedAt))} · ${esc(countWords(r.counts))}</p>`;
  const acts = document.createElement('div'); acts.className = 'fvs-libview__actions';
  const act = (icon, verb, label, armed) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'icon-btn'; x.dataset.pjAct = verb; x.setAttribute('aria-label', label); if (armed) x.dataset.armed = armed; x.innerHTML = Organica.icons.get(icon, { size: 'sm' }); return x; };
  acts.append(act('pencil', 'rename', 'Rename ' + r.name), act('copy', 'duplicate', 'Duplicate ' + r.name), act('download', 'file', 'Save ' + r.name + ' as file'),
    act('trash', 'delete', 'Delete ' + r.name, 'Delete ' + r.name + ' — click again to confirm'));
  tile.append(acts);
  return tile;
}
function newCard() {
  const tile = document.createElement('div'); tile.className = 'fvs-libview__tile';
  tile.innerHTML = `<button type="button" class="fvs-libview__thumb fvs-libview__thumb--new" data-pj-act="new" aria-label="New project">${Organica.icons.get('plus', { size: 'xl' })}</button>`
    + '<p class="fvs-libview__name fvs-library-caption">New project</p><p class="fvs-libview__meta">Start with one Element</p>';
  return tile;
}

export function renderHome() {
  if (!isOpen()) return;
  if (document.querySelector('#fvs-projects [data-armed].is-armed')) { setTimeout(renderHome, Organica.ARM_MS); return; }   // a redraw would take the armed button away
  const body = $('projects-body'), all = sorted(), shown = q ? all.filter(([, r]) => r.name.toLowerCase().includes(q.toLowerCase())) : all;
  body.innerHTML = '';
  if (!all.length) { body.innerHTML = '<div class="org-empty"><p class="org-empty__title">No projects yet</p><p class="org-empty__hint">Start one with New project, or open a project file.</p></div>'; return; }
  if (!shown.length) { body.innerHTML = `<div class="org-empty"><p class="org-empty__title">No matches</p><p class="org-empty__hint">No project is named “${esc(q)}”.</p></div>`; return; }
  const grid = document.createElement('div'); grid.className = 'fvs-libview__grid';
  if (!q) grid.appendChild(newCard());
  shown.forEach(([id, r]) => grid.appendChild(card(id, r)));
  body.appendChild(grid);
}
async function loadThumbs() {
  if (!Organica.idb) return;
  const ids = Object.keys(PROJECTS.peek());
  const got = await Promise.all(ids.map(id => Organica.idb.get(thumbKey(id))));
  ids.forEach((id, i) => { if (got[i]) thumbs[id] = got[i]; });
  renderHome();
}

export function showHome(opts) {
  wire();
  standalone = !!(opts && opts.standalone);
  document.body.classList.toggle('fvs-home-only', standalone);
  document.body.classList.add('fvs-projects-open');
  $('canvas-wrap').classList.add('is-libview');
  if (!standalone && window.__fvs && window.__fvs.closeLibview) window.__fvs.closeLibview();   // one view at a time
  $('fvs-projects').hidden = false;
  $('btn-project').setAttribute('aria-expanded', 'true');
  if (standalone) { const u = new URL(location.href); if (!u.searchParams.has('home')) { u.searchParams.set('home', ''); history.replaceState(history.state, '', u.pathname + '?home'); } }
  renderHome(); loadThumbs();
  $('projects-q').focus();
}
export function closeHome() {
  if (standalone || !isOpen()) return;
  $('fvs-projects').hidden = true;
  document.body.classList.remove('fvs-projects-open');
  if (!document.getElementById('fvs-libview') || document.getElementById('fvs-libview').hidden) $('canvas-wrap').classList.remove('is-libview');
  $('btn-project').setAttribute('aria-expanded', 'false');
  status('');
  $('btn-project').focus();
}

async function rename(id) {
  const r = PROJECTS.read()[id]; if (!r) return;
  let label = 'Project name';
  for (;;) {
    const v = await Organica.prompt({ title: 'Rename project', label, value: r.name, ok: 'Rename' });
    const name = v == null ? null : v.trim();
    if (!name || name === r.name) return;
    if (Object.entries(PROJECTS.read()).some(([k, x]) => k !== id && x && x.name === name)) { label = `“${name}” already exists — choose another`; continue; }
    const all = PROJECTS.read(); all[id].name = name; PROJECTS.write(all);
    if (id === PROJECT.id) syncProjectButton();
    status('Project renamed'); renderHome(); return;
  }
}
const fileSlug = n => String(n).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || 'project';
async function saveFile(id) {
  const f = await projectFile(id); if (!f) return;
  Organica.download(new Blob([JSON.stringify(f)], { type: 'application/json' }), fileSlug(f.name) + '.fvs');
  status('Project file saved');
}
async function openFile(file) {
  let data = null;
  try { data = JSON.parse(await file.text()); } catch (e) { Organica.notice('That file could not be opened', { kind: 'error' }); return; }
  await Promise.all(['fvs', 'fvs-element'].map(t => Organica.store(t).pull().catch(() => {})));   // the library first: a name taken is seen
  const id = importProjectFile(data);
  if (!id) { Organica.notice('That file is not an Organic Visual System project', { kind: 'error' }); return; }
  status('Project opened from file'); renderHome();
}

let wired = false;
function wire() {
  if (wired) return; wired = true;
  $('projects-new').innerHTML = Organica.icons.get('plus') + '<span>New project</span>';
  $('projects-close').innerHTML = Organica.icons.get('close', { size: 'sm' });
  $('projects-q').addEventListener('input', e => { q = e.target.value.trim(); renderHome(); });
  $('projects-close').addEventListener('click', closeHome);
  $('projects-new').addEventListener('click', () => goToProject(createProject(nextProjectName())));
  $('projects-open').addEventListener('click', () => $('projects-file').click());
  $('projects-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) openFile(f); });
  $('fvs-projects').addEventListener('click', async e => {
    const a = e.target.closest('[data-pj-act]'); if (!a) return;
    const verb = a.dataset.pjAct, id = a.closest('[data-pid]') && a.closest('[data-pid]').dataset.pid;
    if (verb === 'new') { goToProject(createProject(nextProjectName())); return; }
    if (verb === 'open') { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // a new tab: the link's own
      e.preventDefault(); if (id === PROJECT.id && !standalone) closeHome(); else goToProject(id); return; }
    if (verb === 'rename') { rename(id); return; }
    if (verb === 'duplicate') { const r = PROJECTS.read()[id]; const all = PROJECTS.read(); let n = r.name + ' copy'; for (let i = 2; Object.values(all).some(x => x && x.name === n); i++) n = r.name + ' copy ' + i;
      status(''); if (await duplicateProject(id, n)) { status('Project duplicated'); loadThumbs(); } return; }
    if (verb === 'file') { saveFile(id); return; }
    if (verb === 'delete') {
      const wasOpen = id === PROJECT.id;
      await deleteProject(id);
      if (wasOpen) { location.assign('/fvs/?home'); return; }   // the open one went (Diego: allowed): the home, with no Project open
      status('Project deleted'); renderHome();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || !isOpen() || standalone) return;
    if ([...document.querySelectorAll('.org-modal')].some(m => getComputedStyle(m).display !== 'none')) return;   // an open dialog (Organica.prompt) takes its own Escape
    if (e.target.closest && e.target.closest('[data-armed].is-armed')) return;   // the first Escape disarms only
    closeHome();
  }, true);   // capture: read .is-armed before Organica.armed's own Escape disarms it (else one Escape did both)
  PROJECTS.onSync(() => { renderHome(); syncProjectButton(); });
}
export function syncProjectButton() {
  const name = PROJECT.name || 'Project';
  $('btn-project-name').textContent = name;
  $('btn-project').setAttribute('aria-label', name + ' — your projects');
}
// The step bar's Project button, once the app is up (main.js)
export function wireProjectButton() {
  wire(); syncProjectButton();
  $('btn-project').addEventListener('click', () => (isOpen() ? closeHome() : showHome()));
  if (window.__fvs) Object.assign(window.__fvs, { showHome, closeHome, renderHome, editedWords, countWords });
}
