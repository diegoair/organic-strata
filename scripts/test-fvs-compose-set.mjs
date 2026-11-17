#!/usr/bin/env node
// FVS Figure › Compose: a saved Set dropped on a cell (or clicked with cells selected) is an Arrange of its items — the
// Library rail shows a Sets group while composing, a click / drag adds one Arrange region rule with the Set's items as
// its pool, and the Figure draws them (O-54, Diego, Nov 17, 2026). 17-figure-graph.js composeRailApply / composeRailSets ·
// 15-export-library-view.js renderLibraryRail · engine/17-figure-nodes.js (a Set Arrange's Components travel with it).
// Usage: scripts/test-fvs-compose-set.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 3 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, NC = Organica.nodeCanvas, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const tab = t => document.querySelector('#tier-tabs [data-tier="' + t + '"]');
  const M = () => F.figureGraphModel(), card = id => document.querySelector('#fg-graph .nc-node[data-node-id="' + id + '"]');
  // two saved Components, no filled Symbol: the classic graph (Canvas + Grid + Palette → Figure 1)
  F.setTier('component'); await w(500); set('rg-grid-cols', 2); set('rg-grid-rows', 2); q('btn-generate').click(); await w(800);
  [0, 1].forEach(i => F.quickSaveComponentToLibrary(F.state.components[i].id)); await w(300);
  await F.loadFigureTier();
  const lib = F.LIBRARY.read(), names = Object.keys(lib).slice(0, 2);
  Organica.store('fvs-sets').write({ 'Set A': { items: names.map(n => ({ kind: 'component', name: n, snapshot: F.entrySnapshot(lib[n]) })), savedAt: new Date().toISOString() },
    'Empty set': { items: [], savedAt: '2026-01-01T00:00:00.000Z' } });
  // the Figure tab opens once a Symbol has content; then the classic graph replaces the Symbols' Figures
  F.setTier('symbol'); await w(800); set('sel-symgrid-gen', 'rectangular'); await w(400); set('symgen-cols', 4); set('symgen-rows', 4); await w(700);
  F.state.symbolCells.forEach((c, i) => F.patchCell(c, { source: 'component', componentName: names[i % 2] })); F.renderSymbol(); await w(900);
  tab('figure').click(); for (let t = 0; t < 60 && !M(); t++) await w(250);
  F.figureUseModel(F.classicStarter()); await w(3000);
  const fig = M().nodes.find(n => n.type === 'figure');
  check('the rail has no Sets group outside Compose', q('rail-g-sets').hidden, q('rail-g-sets').hidden);
  card(fig.id).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await w(1500);
  check('a double-click on the Figure opens Compose', document.body.classList.contains('fg-composing'), document.body.className);
  if (q('fvs-rail-panel').dataset.open !== 'true') { q('btn-rail').click(); await w(400); }
  const tiles = [...q('rail-sets').querySelectorAll('.fvs-library-item')];
  check('while composing, the rail shows Sets: one tile per Set with items (an empty Set has none)', !q('rail-g-sets').hidden && tiles.length === 1 && tiles[0].dataset.railName === 'Set A', tiles.map(t => t.dataset.railName).join());
  check('…named “Arrange Set in the selected cells — Set A”, no rename / delete', tiles[0] && tiles[0].getAttribute('aria-label') === 'Arrange Set in the selected cells — Set A' && !tiles[0].parentElement.querySelector('[data-rail-remove]'), tiles[0] && tiles[0].getAttribute('aria-label'));
  check('…its thumbnail is drawn (its first item)', tiles[0] && tiles[0].querySelector('svg'), tiles[0] && tiles[0].innerHTML.slice(0, 80));
  const before = F.figureNodeSVG ? F.figureNodeSVG(fig.id) : '';
  const comp = () => { const e = M().edges.find(x => x.to.node === fig.id && x.to.port === 'composition'); return e ? M().nodes.find(n => n.id === e.from.node) : null; };
  // a click with nothing selected: nothing happens
  tiles[0].click(); await w(600);
  check('a click with no cell selected adds no rule', !comp() || !(comp().params.rules || []).length, comp() && JSON.stringify(comp().params.rules));
  // select four cells, click the Set
  const cells = [...document.querySelectorAll('#fg-compose-stage .fg-cell')];
  const key = (c, shift) => { c.focus(); c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: !!shift, bubbles: true })); };   // Compose's keyboard path: Enter selects, Shift adds
  key(cells[0]); [1, 2, 3].forEach(i => key(document.querySelectorAll('#fg-compose-stage .fg-cell')[i], true)); await w(400);
  q('rail-sets').querySelector('.fvs-library-item').click(); await w(2500);
  const rs = comp() ? comp().params.rules || [] : [], r = rs[rs.length - 1], a = r && r.do && r.do.arrange;
  check('a click on the Set with 4 cells selected: one Arrange region rule, the Set’s items as its pool', rs.length === 1 && a && a.live === false && a.set === 'Set A' && a.pool.length === 2 && a.pool.every(p => p.kind === 'component' && p.entry), String(JSON.stringify(r && r.do)).slice(0, 200));
  check('…over the 4 selected cells', r && JSON.stringify(r.when).length > 2 && (r.when.index || r.when.at || []).length === 4, JSON.stringify(r && r.when));
  const fv = () => { const en = F.figureEngine ? F.figureEngine().get(fig.id) : null; return en && en.value && en.value.figure; };
  const svg = F.figureNodeSVG ? F.figureNodeSVG(fig.id) : '';
  check('the Figure draws again, with the Set’s items, no error', svg && svg !== before && !card(fig.id).classList.contains('is-error'), 'same as before: ' + (svg === before) + ', error: ' + card(fig.id).classList.contains('is-error'));
  const list = [...document.querySelectorAll('#fg-inspector *')].map(e => e.textContent).find(t => /Arrange: .* · Set A, 2 items/.test(t));
  check('the rule list reads “Arrange: ‹rule› · Set A, 2 items”', !!list, [...document.querySelectorAll('#fg-inspector')].map(e => e.textContent).join('').slice(0, 300));
  // ⌘Z takes the rule back
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })); await w(1200);
  check('⌘Z removes it (one undo step)', !comp() || !(comp().params.rules || []).length, comp() && (comp().params.rules || []).length);
  // a drag of the tile onto a cell = the same rule on that cell
  { const t = q('rail-sets').querySelector('.fvs-library-item'), b = t.getBoundingClientRect(), c = document.querySelectorAll('#fg-compose-stage .fg-cell')[5].getBoundingClientRect();
    const pe = (type, x, y, el) => (el || window).dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 7, clientX: x, clientY: y }));
    pe('pointerdown', b.x + 10, b.y + 10, t); pe('pointermove', b.x + 30, b.y + 30); pe('pointermove', c.x + c.width / 2, c.y + c.height / 2); pe('pointerup', c.x + c.width / 2, c.y + c.height / 2); await w(2500);
    const rs2 = comp() ? comp().params.rules || [] : [], r2 = rs2[rs2.length - 1];
    check('a drag of the Set onto a cell: an Arrange of its items on that cell', rs2.length === 1 && r2.do.arrange && r2.do.arrange.set === 'Set A' && (r2.when.index || r2.when.at || []).length === 1, JSON.stringify(r2 && r2.when)); }
  q('fg-compose-back').click(); await w(800);
  check('leaving Compose hides the Sets group again (the rail is closed on the graph)', q('fvs-rail-dock').hidden || q('rail-g-sets').hidden, q('fvs-rail-dock').hidden);
  return rows;`);
const bad = rows.filter(r => r.startsWith('✗'));
rows.forEach(r => console.log(r));
if (P.errors.length) console.log('page errors:', P.errors.slice(0, 3).join(' | '));
console.log(bad.length ? `\n${bad.length} of ${rows.length} failed` : `\nAll ${rows.length} passed`);
await P.close(bad.length || P.errors.length ? 1 : 0);
