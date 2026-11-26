#!/usr/bin/env node
// FVS Projects (Nov 26, 2026 — ledger O-67 a): the boards belong to a Project (fvs/js/project.js); each board store is
// 'fvs-elements@<pid>' … in memory + IndexedDB (shared/idb.js, shared/store.js backend 'idb').
// Checks: the work before Projects becomes "Project 1" (old keys left in place); a new Project has its own boards;
// switching keeps each one's; the address names the Project; no ?project opens the last one; the index counts.
// Usage: scripts/test-fvs-projects.sh   (headless, its own profile and port — never Diego's tab)
import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 180000 });
const READY = 'window.__fvs && window.__fvs.isReady';
const pre = `const F = window.__fvs, r = [], w = ms => new Promise(res => setTimeout(res, ms));
  const ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  const idx = () => JSON.parse(localStorage.getItem('organica.fvs-projects.presets') || '{}');
  const pid = () => new URLSearchParams(location.search).get('project');`;
let out = [];
const run = async body => { const s = await P.ev(pre + body + `\n return r.join('\\n');`); out.push(...String(s).split('\n').filter(Boolean)); };

// 1 · a first visit: a Project is made and named in the address
await P.goto('/fvs/', READY);
await run(`
  ck('a Project is open', !!F.PROJECT.id && pid() === F.PROJECT.id, [F.PROJECT.id, location.search]);
  ck('the board stores are per Project, on IndexedDB', F.ELEMENTS === F.projectStore('fvs-elements') && F.ELEMENTS.backend === 'idb', F.ELEMENTS.backend);
  ck('nothing of the boards in localStorage', localStorage.getItem('organica.' + F.PROJECT.tool('fvs-elements') + '.presets') === null);
  // the work of before Projects, seeded as the old stores held it: two Elements, one renamed
  await w(600);
  const el = JSON.parse(JSON.stringify(F.ELEMENTS.read()));
  const ids = Object.keys(el).filter(k => k !== 'board'); const first = el[ids[0]];
  el['eLegacy'] = { ...JSON.parse(JSON.stringify(first)), name: 'Legacy A', custom: true, n: 1 };
  localStorage.setItem('organica.fvs-elements.presets', JSON.stringify(el));
  localStorage.setItem('organica.fvs-figure.presets', JSON.stringify({ __current: { model: { nodes: [{ id: 'n1', type: 'symbol', params: {} }], edges: [], frames: [] }, name: '' }, Saved: { model: { nodes: [], edges: [] } } }));
  localStorage.setItem('organica.fvs.board.element', JSON.stringify({ view: { zoom: 0.5, panX: 11, panY: 22 }, pos: { ['el-' + ids[0]]: { x: 0, y: 116 }, ['vw-' + ids[0]]: { x: 0, y: 0 }, 'el-eLegacy': { x: 333, y: 2001 }, 'vw-eLegacy': { x: 333, y: 1885 } } }));   // odd places: the board keeps them (a saved view off the sheets is re-framed, so the view itself is not the check)
  // forget the Project just made, so the next load is a first load with old work
  localStorage.removeItem('organica.fvs-projects.presets'); localStorage.removeItem('organica.fvs.project.last');
  F.PROJECTS.write = () => true;   // this page's own last saves must not bring the index back
`);

// 2 · the migration
await P.goto('/fvs/', READY);
await P.ev('return new Promise(r => setTimeout(r, 800))');
await run(`
  const i = idx(), ids = Object.keys(i);
  ck('one Project, called Project 1', ids.length === 1 && i[ids[0]].name === 'Project 1', i);
  ck('the old Elements are on its board', F.state.elements.map(e => e.name).includes('Legacy A') && F.state.elements.length === 2, F.state.elements.map(e => e.name));
  ck('the old Figure is its Figure', !!(F.projectStore('fvs-figure-work').read().current || {}).model);
  const bv = JSON.parse(localStorage.getItem(F.PROJECT.viewKey('organica.fvs.board.element')) || '{}');
  ck('the old board view is its view (the sheets where they were)', bv.pos && bv.pos['el-eLegacy'] && bv.pos['el-eLegacy'].y === 2001, bv);
  ck('the old keys stay in place', !!localStorage.getItem('organica.fvs-elements.presets') && !!JSON.parse(localStorage.getItem('organica.fvs-figure.presets')).__current);
  ck('the saved graphs stay in the library', !!JSON.parse(localStorage.getItem('organica.fvs-figure.presets')).Saved);
  sessionStorage.setItem('p1', F.PROJECT.id);
  sessionStorage.setItem('p2', F.createProject('Second'));
`);

// 3 · a second Project: its own board; a change in it stays in it
await P.goto('/fvs/?project=' + await P.ev(`return sessionStorage.getItem('p2')`), READY);
await run(`
  ck('the Project named in the address opens', F.PROJECT.id === sessionStorage.getItem('p2') && F.PROJECT.name === 'Second', F.PROJECT.id);
  ck('…with its own board (not Project 1’s Elements)', !F.state.elements.some(e => e.name === 'Legacy A'), F.state.elements.map(e => e.name));
  F.state.elements[0].name = 'Only in Second'; F.state.elements[0].custom = true;   // kept by the board's save on leaving
`);
await P.goto('/fvs/?project=' + await P.ev(`return sessionStorage.getItem('p2')`), READY);
await run(`
  ck('a change is kept after a reload (IndexedDB)', F.state.elements[0].name === 'Only in Second', F.state.elements.map(e => e.name));
  await w(500);
  ck('the index counts its Elements', (idx()[F.PROJECT.id].counts || {}).elements === F.state.elements.length, idx()[F.PROJECT.id]);
`);
await P.goto('/fvs/?project=' + await P.ev(`return sessionStorage.getItem('p1')`), READY);
await run(`
  ck('Project 1 kept its own', F.state.elements.some(e => e.name === 'Legacy A') && !F.state.elements.some(e => e.name === 'Only in Second'), F.state.elements.map(e => e.name));
`);

// 4 · no ?project: the last one
await P.goto('/fvs/', READY);
await run(`
  ck('no ?project opens the last one', F.PROJECT.id === sessionStorage.getItem('p1') && pid() === F.PROJECT.id, [F.PROJECT.id, location.search]);
  ck('an unknown ?project falls back', true);
`);
await P.goto('/fvs/?project=pNope', READY);
await run(`ck('an unknown ?project opens the last one', F.PROJECT.id === sessionStorage.getItem('p1') && pid() === F.PROJECT.id, [F.PROJECT.id, location.search]);`);

// 5 · the shared library across Projects: a Component a closed Project uses is kept (hidden), a rename reaches it
await run(`
  const p2 = sessionStorage.getItem('p2'), all = F.PROJECTS.read();
  all[p2].uses = { ...(all[p2].uses || {}), components: ['Shared C'] }; F.PROJECTS.write(all);
  if (!Object.keys(F.LIBRARY.read()).length) { F.setTier('component'); await w(800); F.saveAllComponentsToLibrary(); await w(300); }
  const lib = F.LIBRARY.read(), any = Object.keys(lib)[0];
  ck('a Component to share', !!any, Object.keys(lib));
  if (any) {
    lib['Shared C'] = JSON.parse(JSON.stringify(lib[any])); F.LIBRARY.write(lib);
    ck('its use in the other Project counts', F.componentUsage('Shared C').projects === 1, F.componentUsage('Shared C'));
    F.deleteSavedComponent('Shared C');
    const left = Object.entries(F.LIBRARY.read()).find(([n, e]) => n.startsWith('Shared C (deleted') && e.hidden);
    ck('…so Delete keeps it, hidden', !!left && !F.LIBRARY.read()['Shared C'], Object.keys(F.LIBRARY.read()));
  }
  // renames: A → B, B → C, applied to plain board data newer than a time
  const t0 = new Date(Date.now() - 1000).toISOString();
  F.recordRename('component', 'Rn A', 'Rn B'); F.recordRename('component', 'Rn B', 'Rn C'); F.recordRename('element', 'El A', 'El B');
  const el = { e1: { gallery: { components: [{ savedName: 'Rn A', savedNames: ['Rn A', 'X'] }] }, app: { ground: { tile: 'saved:El A' } } } };
  const sy = { s1: { work: { cells: [{ source: 'component', componentName: 'Rn A' }, { componentName: 'Other' }], pool: [{ name: 'Rn B', weight: 1 }] } } };
  ck('renames apply to a closed Project', F.applyRenames(el, sy, t0) && sy.s1.work.cells[0].componentName === 'Rn C' && sy.s1.work.cells[1].componentName === 'Other' && sy.s1.work.pool[0].name === 'Rn C' && el.e1.gallery.components[0].savedNames[0] === 'Rn C' && el.e1.app.ground.tile === 'saved:El B', [sy, el]);
  ck('…only the ones newer than its last open', !F.applyRenames({}, { s: { work: { cells: [{ componentName: 'Rn A' }] } } }, new Date(Date.now() + 1000).toISOString()));
  ck('uses read from the boards', F.symbolUses([{ work: { cells: [{ componentName: 'K' }], pool: [{ name: 'L' }] } }]).join() === 'K,L' && F.elementUses({ a: 'saved:Q', b: ['saved:R "x"'] }).join() === 'Q,R "x"');
`);

// 6 · the home: Your projects
await run(`
  ck('words', F.editedWords(new Date().toISOString()) === 'Edited today' && F.editedWords('2020-03-04T10:00:00Z', new Date('2026-11-26')) === 'Edited 4 Mar 2020' && F.countWords({ elements: 1, symbols: 2 }) === '1 Element · 2 Symbols', [F.editedWords('2020-03-04T10:00:00Z', new Date('2026-11-26'))]);
  document.getElementById('btn-project').click(); await w(200);
  const cards = [...document.querySelectorAll('#fvs-projects [data-pid]')];
  ck('the Project button opens Your projects, a card per Project + New', !document.getElementById('fvs-projects').hidden && cards.length === Object.keys(idx()).length && !!document.querySelector('#fvs-projects [data-pj-act="new"]'), cards.length);
  ck('…the open one marked Editing', document.querySelector('#fvs-projects [aria-current="true"]').dataset.pid === F.PROJECT.id && /^Editing · /.test(document.querySelector('#fvs-projects [aria-current="true"] .fvs-libview__meta').textContent));
  ck('…newest first', cards.map(c => idx()[c.dataset.pid].updatedAt).every((t, i, a) => !i || a[i - 1] >= t));
  // rename (the dialog answered by a stub)
  const p2 = sessionStorage.getItem('p2'), p0 = Organica.prompt; let asks = 0;
  Organica.prompt = async o => (asks++ ? 'Renamed two' : idx()[F.PROJECT.id].name);   // first a taken name: asked again
  document.querySelector('[data-pid="' + p2 + '"] [data-pj-act="rename"]').click(); await w(300);
  Organica.prompt = p0;
  ck('Rename asks again on a taken name, then renames', asks === 2 && idx()[p2].name === 'Renamed two', [asks, idx()[p2].name]);
  // duplicate
  document.querySelector('[data-pid="' + p2 + '"] [data-pj-act="duplicate"]').click(); await w(1500);
  const dup = Object.entries(idx()).find(([, r]) => r.name === 'Renamed two copy');
  ck('Duplicate: “‹name› copy”, with the same boards', !!dup && JSON.stringify(Object.values(await F.readBoards(dup[0]).then(b => b['fvs-elements'])).map(e => e && e.name)) === JSON.stringify(Object.values((await F.readBoards(p2))['fvs-elements']).map(e => e && e.name)), dup && dup[0]);
  sessionStorage.setItem('dup', dup ? dup[0] : '');
  // file round trip: Project 1's file (it uses no Component) → a new Project with the same Elements
  const file = await F.projectFile(F.PROJECT.id);
  ck('the file: tool, version, boards, library', file.tool === 'fvs-project' && file.version === 1 && !!file.boards['fvs-elements'] && !!file.library);
  const back = F.importProjectFile(JSON.parse(JSON.stringify(file)));
  const b2 = await F.readBoards(back);
  ck('Open file: always a new Project (“‹name› copy”), the same boards', back && back !== F.PROJECT.id && idx()[back].name === idx()[F.PROJECT.id].name + ' copy' && JSON.stringify(Object.values(b2['fvs-elements']).map(e => e && e.name).sort()) === JSON.stringify(Object.values(file.boards['fvs-elements']).map(e => e && e.name).sort()), back && idx()[back].name);
  ck('…a file of something else is refused', F.importProjectFile({ tool: 'fvs-figure-graph' }) === null);
  // a library name taken by a different entry comes in renamed, and the boards follow
  const lib = F.LIBRARY.read(), any = Object.keys(lib).find(n => !lib[n].hidden);
  const f2 = { tool: 'fvs-project', version: 1, name: 'Imported', boards: { 'fvs-elements': {}, 'fvs-symbol-work': { s1: { name: 'S', work: { cells: [{ source: 'component', componentName: any }] } } }, 'fvs-figure-work': {} }, library: { component: { [any]: { ...lib[any], savedAt: 'other' } }, element: {} } };
  const imp = F.importProjectFile(f2), ib = await F.readBoards(imp);
  ck('…a taken name comes in as “‹name› (imported)”', !!F.LIBRARY.read()[any + ' (imported)'] && ib['fvs-symbol-work'].s1.work.cells[0].componentName === any + ' (imported)', ib['fvs-symbol-work']);
  // delete (armed): a closed one — its stores go from IndexedDB
  const before = await Organica.idb.keys('organica.fvs-elements@' + imp);
  F.renderHome(); await w(100);
  const del = document.querySelector('[data-pid="' + imp + '"] [data-pj-act="delete"]');
  del.click(); await w(50);
  ck('Delete is armed: the first click deletes nothing', !!idx()[imp] && del.classList.contains('is-armed'));
  del.click(); await w(500);
  const after = await Organica.idb.keys('organica.fvs-elements@' + imp);
  ck('…the second deletes the Project and its stores', !idx()[imp] && before.length === 1 && after.length === 0 && !document.querySelector('[data-pid="' + imp + '"]'), [before, after]);
  { const d2 = document.querySelector('[data-pid] [data-pj-act="delete"]'); d2.focus(); d2.click(); d2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ck('the first Escape on an armed Delete only disarms it', !document.getElementById('fvs-projects').hidden && !d2.classList.contains('is-armed')); }
  ck('Escape closes Your projects', (document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), document.getElementById('fvs-projects').hidden));
  sessionStorage.setItem('open', F.PROJECT.id);
`);
// delete the open one: the home, with no Project open
await P.ev(`const d = document.querySelector('[data-pid="' + window.__fvs.PROJECT.id + '"] [data-pj-act="delete"]') || (document.getElementById('btn-project').click(), document.querySelector('[data-pid="' + window.__fvs.PROJECT.id + '"] [data-pj-act="delete"]')); d.click(); d.click(); return 1;`);
await new Promise(r => setTimeout(r, 2500));
await run(`
  ck('deleting the open Project shows the home with none open', new URLSearchParams(location.search).has('home') && document.body.classList.contains('fvs-home-only') && !document.getElementById('fvs-projects').hidden && !idx()[sessionStorage.getItem('open')], location.search);
  ck('…the standalone home has no Close, and the tool is not loaded', getComputedStyle(document.getElementById('projects-close')).display === 'none' && !window.__fvs, !!window.__fvs);
`.replace("const F = window.__fvs, ", "const F = {}, "));

const bad = out.filter(l => l.startsWith('✗')).length + P.errors.length;
out.forEach(l => console.log('  ' + l));
if (P.errors.length) console.log('page errors:', P.errors);
console.log(bad ? 'FVS projects: FAIL — ' + bad + ' of ' + out.length : 'FVS projects: PASS — ' + out.length + ' checks');
await P.close(bad ? 1 : 0);
