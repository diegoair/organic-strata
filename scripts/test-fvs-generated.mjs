#!/usr/bin/env node
// FVS Suggest › Use generated components (Oct 27, 2026 — Diego: "devi prima suggerirli e devono essere visibili come
// suggerimento prima di applicarli e confermarli"). An Element's Generated components nobody saved join Suggest's pool
// in memory ('gen:' keys): no 'gen:' key ever reaches the stored Library; a variation that uses one carries the badge and
// is not applied by itself; applying it asks, then saves each to the Library ("Saved from Suggest") and renames the
// cells; the saved ones stay when the Element generates again.
// Usage: scripts/test-fvs-generated.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const stored = () => Object.keys(JSON.parse(localStorage.getItem('organica.fvs.presets') || '{}'));   // the stored text itself (presetStore is one shared instance)
  let asked = 0; Organica.confirm = async () => { asked++; return true; };
  F.setTier('element'); set('sel-seed-type', 'arc'); await w(400);
  F.setTier('component'); await w(600); q('btn-generate').click(); await w(900);
  const nGen = F.state.components.length;
  F.quickSaveComponentToLibrary(F.state.components[0].id); await w(200); const A = F.getSelectedComponent().savedName;
  check('the Element has generated components (' + nGen + ')', nGen > 1, nGen);
  F.setTier('symbol'); await w(700);
  set('sel-symcanvas-preset', 'Square 1:1'); set('sel-symgrid-gen', 'rectangular'); await w(450); set('symgen-cols', 4); set('symgen-rows', 4); await w(450);
  F.state.symbolCells.forEach(c => F.patchCell(c, F.railPatch('component', A))); F.renderSymbol(); await w(100);
  // off: nothing generated
  set('chk-sug-generated', false); q('btn-sug-run').click(); await w(200);
  check('off: no variation uses a generated component', F.state.symbolSuggestions.every(sg => !sg.gen.length), 'some do');
  // on
  set('chk-sug-generated', true); set('num-sug-seed', 3); set('rg-sug-surprise', 70);
  const cur = JSON.stringify(F.state.symbolCells.map(c => c.componentName));
  q('btn-sug-run').click(); await w(300);
  const S = F.state.symbolSuggestions, withGen = S.filter(sg => sg.gen.length);
  check('on: some variations use generated components', withGen.length > 0, S.length + ' variations, ' + withGen.length + ' with');
  check('…they carry the badge', document.querySelectorAll('#fvs-sug-panel .fvs-suggest__badge').length === withGen.length, document.querySelectorAll('#fvs-sug-panel .fvs-suggest__badge').length);
  check('…the Symbol was not changed to one of them by itself', !F.state.symbolCells.some(c => F.isGenName(c.componentName)), 'applied');
  check('no gen: key in the stored Library', !stored().some(F.isGenName), stored().filter(F.isGenName).join(','));
  check('…nor in the Library lists', !F.libraryNames(F.LIBRARY.read()).some(F.isGenName), 'listed');
  // apply one
  const k = S.indexOf(withGen[0]), used = withGen[0].gen.slice();
  document.querySelectorAll('#fvs-sug-panel .fvs-suggest__item')[k].click(); await w(300);
  const lib = JSON.parse(localStorage.getItem('organica.fvs.presets') || '{}'), saved = Object.keys(lib).filter(n => lib[n].group === 'Saved from Suggest');
  check('applying asked first', asked === 1, asked);
  check('…and saved ' + used.length + ' to the Library, “Saved from Suggest”', saved.length === used.length, saved.join(', '));
  check('…the Symbol uses the saved names', !F.state.symbolCells.some(c => F.isGenName(c.componentName)) && F.state.symbolCells.some(c => saved.includes(c.componentName)), 'not renamed');
  check('…still no gen: key stored', !stored().some(F.isGenName), 'stored');
  // the Element generates again: the saved ones stay
  F.setTier('component'); await w(500); q('btn-generate').click(); await w(900);
  F.setTier('symbol'); await w(600);
  check('after Generate again, the saved components are still there and drawn', saved.every(n => F.LIBRARY.peek()[n]) && /<g data-cell-index/.test(F.buildSymbolSVG()), 'gone');
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS generated: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
