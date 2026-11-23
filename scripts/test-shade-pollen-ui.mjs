// Headless check, in the real page, of Pollen's presets in TuneSutra's Shadow (Nov 22, 2026): (1) the Shading menu
// lists them in the one Pollen category — Dot · Stroke · Cross-hatch, the built-ins
// (sentence case), then the saved ones; (2) a seed's outline is sampled from the seed data
// (loaded on demand); (3) a pick on the house copies the marks onto every colour, drawn on the sheet; (4) the palette
// saved and the Pollen preset deleted, it opens with the same shadow, the menu naming the copy.
// Run: node --experimental-websocket scripts/test-shade-pollen-ui.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 180000 });
let failed = 0;
const check = (label, ok, detail) => { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
// a saved Pollen preset first, as Pollen writes it
const ok = await P.goto('/tunesutra/', 'window.Organica && Organica.shadeEditor && Organica.pollenPresets && typeof setShading === "function"');
if (!ok) { console.log('  FAIL /tunesutra/ not ready'); await P.close(1); }
const R = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
  Organica.presetStore('pollen', 'pollen-presets').write({ 'My hatch': { pointType: 'stroke', strokeStyle: 'star', 'sl-size': '1', 'sl-sp-min': '2', 'sl-sp-max': '10' } });
  await Organica.pollenPresets.loadSeeds(); syncGradControls(); await w(300);
  const sel = document.querySelector('#ts-shade select[aria-label="Shading"]');
  // the menu is rebuilt from the store on sync; ask it again
  sel.dispatchEvent(new Event('focus'));
  out.groups = [...sel.querySelectorAll('optgroup')].map(g => g.label);
  out.pollen = [...sel.querySelectorAll('optgroup')].filter(g => g.label === 'Pollen').map(g => [...g.children].filter(o => !o.hidden).map(o => o.textContent).join(', '))[0];
  out.seeds = !!(window.ORGANIC_SEEDS || window.ORGANIC_FORMS);
  const d = Organica.shadeEditor.pollenDef(state.items[0].hex, 'pollen-p:b:Fine Dots', {});
  out.loops = d && d.marks.shapes[0] ? d.marks.shapes[0][0].length : 0;
  setShading('pollen-p:b:Fine Dots'); await w(200);
  out.each = state.items.map(it => it.shade && it.shade.specks + ':' + it.shade.marks.name).join(' | ');
  out.shown = sel.value;
  const marksLen = () => { renderStage(); return [...document.querySelectorAll('#stage-svg path')].reduce((n, p) => n + (p.getAttribute('d') || '').length, 0); };
  out.drawn = marksLen();
  // a saved preset: save, delete it in Pollen, reopen — the copy keeps its shadow and its name
  setShading('pollen-p:u:My hatch'); await w(100);
  out.mine = state.items.map(it => it.shade && it.shade.marks.name).join(' | ');
  const name = 'pollen-shadow-test';
  ctrl('txt-preset-name').value = name; confirmSavePreset();
  const first = JSON.stringify(state.items[0].shade);
  Organica.presetStore('pollen', 'pollen-presets').write({});
  setShading('none'); out.flat = marksLen();
  loadPaletteData(userPresets()[name]); syncGradControls(); await w(200);
  const strip = s => { const g = JSON.parse(s); return JSON.stringify([g.specks, g.marks, g.speck, g.amount]); };
  out.same = strip(JSON.stringify(state.items[0].shade)) === strip(first);
  // the palette opens with the house's Shading None (TuneSutra, Nov 18); the colour's own shadow names its copy
  out.copy = presetOf(state.items[0].shade, state.items[0].hex) + ' / ' + state.items[0].shade.marks.name;
  syncGradControls(); await w(100);
  // a tool's editor (FVS: a value, no house): the copy is the menu's selection, under its own name, not in the list
  const host = document.createElement('div'); document.body.appendChild(host);
  const ed = Organica.shadeEditor.mount(host, { hex: state.items[0].hex, ctx: {}, def: state.items[0].shade, onChange: () => {} });
  const s2 = host.querySelector('select[aria-label="Shading"]');
  out.copyOpt = s2.value + ' · ' + [...s2.options].filter(o => o.value === 'pollen-p:copy').map(o => o.textContent + (o.hidden ? ' (hidden)' : '')).join();
  out.trigger = host.querySelector('[data-host="shading"]').textContent.trim();
  ed.destroy(); host.remove();
  out.drawnAfter = marksLen();
  return out;
`);
check('one Pollen category, no other Pollen group', R.groups.filter(g => /Pollen/.test(g)).join() === 'Pollen', R.groups.join(' / '));
check('Pollen lists its textures, the built-ins (sentence case), then the saved', R.pollen === 'Dot, Stroke, Cross-hatch, Fine dots, Felt-tip, Lines flow, Duotone, Hatch flow, Hatch swirl, My hatch', R.pollen);
check('seed data loaded on demand', R.seeds);
check('Fine dots copies the seed outline (breath: a circle)', R.loops === 3, R.loops + ' numbers');
check('a house pick: every colour its own copy', R.each.split(' | ').every(s => s === 'pollen-preset:Fine dots'), R.each);
check('the menu names the pick', R.shown === 'pollen-p:b:Fine Dots', R.shown);
check('saved and reopened: the same shadow, preset gone', R.same);
check('a saved preset copied as typed', R.mine.split(' | ').every(n => n === 'My hatch'), R.mine);
check('the copy is named as copied', R.copy === 'pollen-p:copy / My hatch', R.copy);
check('the editor holds the copy as a hidden entry', R.copyOpt === 'pollen-p:copy · My hatch (hidden)' && /My hatch/.test(R.trigger), R.copyOpt + ' — trigger: ' + R.trigger);
check('marks drawn on the sheet, and again after reopening', R.drawn > R.flat * 1.5 && R.drawnAfter > R.flat * 1.5, 'flat ' + R.flat + ', Fine dots ' + R.drawn + ', reopened ' + R.drawnAfter + ' chars of path');
check('no page errors', !P.errors.length, P.errors.slice(0, 3).join(' | '));
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
