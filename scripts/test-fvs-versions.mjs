#!/usr/bin/env node
// FVS saved versions + the Symbol's own Palette (Oct 26, 2026 — Diego). (1) A gallery Component's save circle follows what
// it draws: ✓ only while the library holds that exact drawing; after an Element edit it is + ("an earlier version is saved
// as …") and saves the new version as another, the old one kept; back to the old look it is ✓ again; ✓ removes only its
// own version; the Library view offers Replace on the earlier version, which then takes the current one (same name, so a
// Symbol using it changes); Save all skips what is saved. (2) The Symbol's Palette is its own: Paper and inks changed on
// the Symbol step leave the Element, its Components and its board Palette as they were — also after a reload.
// Usage: scripts/test-fvs-versions.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 6 * 60 * 1000 });
const PRE = `const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const store = () => Organica.store('fvs').read(), lib = () => Object.keys(store()).filter(n => !store()[n].hidden);
  const inkOf = n => (store()[n] || {}).colors + '';
  const circle = () => { const b = [...document.querySelectorAll('.fvs-thumb-quicksave')].find(b => /library/i.test(b.getAttribute('aria-label') || '')); return b ? { saved: b.classList.contains('saved'), label: b.getAttribute('aria-label') } : null; };
  const paint = async c => { F.setTier('element'); F.state.colors = c; F.buildPalette(); F.onAppearanceChange(); F.setTier('component'); await w(400); };
  const rectFill = svg => (svg.match(/<rect width="[\\d.]+" height="[\\d.]+" fill="(#[0-9a-f]{6}|none)"/) || [])[1];
  const boardPalette = () => { const e = F.state.elements.find(e => e.id === F.state.activeElement); return e && e.palette ? e.palette.paperColor + '/' + e.palette.colors.join(',') : '-'; };`;
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const r = await P.ev(PRE + `
  const fails = [], rows = [], check = (n, ok, got) => { rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got)); if (!ok) fails.push(n); };
  const RED = ['#c2462e'], GREEN = ['#1d3b2a'];
  F.setTier('element'); set('sel-seed-type', 'chevron'); await w(200); F.setPaperUI('#f4efe4');
  await paint(RED);
  set('rg-grid-cols', 2); set('rg-grid-rows', 2); set('sel-rule', 'mirror'); q('btn-generate').click(); await w(900);
  const comp = F.state.components[0];
  check('a new Component: + Save to library', circle() && !circle().saved && circle().label === 'Save to library', JSON.stringify(circle()));
  F.quickSaveComponentToLibrary(comp.id); await w(200); const red = comp.savedName;
  check('saved: ✓ with its name', circle().saved && circle().label === 'Saved to library as “' + red + '”', JSON.stringify(circle()));
  await paint(GREEN);
  check('the Element edited: + names the earlier version', !circle().saved && circle().label === 'Save this version to library — an earlier version is saved as “' + red + '”', JSON.stringify(circle()));
  check('the saved one is untouched', inkOf(red) === '#c2462e', inkOf(red));
  F.openLibview(); await w(300);
  const rep = [...document.querySelectorAll('[data-lv-act="replace"]')].map(b => b.getAttribute('aria-label'));
  check('the Library view offers Replace on the earlier version', rep.length === 1 && rep[0] === 'Replace ' + red + ' with the current version', JSON.stringify(rep));
  F.closeLibview();
  await paint(RED);
  check('back to the saved look: ✓ by itself, no Replace', circle().saved && !F.replaceableBy(red), JSON.stringify(circle()));
  await paint(GREEN);
  [...document.querySelectorAll('.fvs-thumb-quicksave')].find(b => /earlier version/.test(b.getAttribute('aria-label') || '')).click(); await w(300);
  const green = comp.savedName;
  check('+ saves the new version as another; the old one stays', green !== red && lib().includes(red) && lib().includes(green) && inkOf(green) === '#1d3b2a' && circle().saved, JSON.stringify(lib().map(n => n + '=' + inkOf(n))));
  [...document.querySelectorAll('.fvs-thumb-quicksave.saved')].find(b => /library/i.test(b.getAttribute('aria-label') || '')).click(); await w(300);
  check('✓ removes only its own version; + names the earlier one again', !lib().includes(green) && lib().includes(red) && /earlier version is saved as “/.test(circle().label), JSON.stringify([lib(), circle()]));
  F.setTier('symbol'); await w(500); F.railApply('component', red, 0); await w(200);
  const symInk = () => (F.buildSymbolSVG().match(/fill="(#c2462e|#1d3b2a)"/) || [])[1];
  const before = symInk(); F.setTier('component'); await w(300);
  Organica.confirm = async () => true;
  await F.replaceSavedComponent(red); await w(300);
  F.setTier('symbol'); await w(400); const after = symInk(); F.setTier('component'); await w(300);
  check('Replace: the saved one takes the current version, same name; the Symbol changes', inkOf(red) === '#1d3b2a' && before === '#c2462e' && after === '#1d3b2a' && circle().saved, JSON.stringify({ ink: inkOf(red), before, after, circle: circle() }));
  const n0 = lib().length; F.saveAllComponentsToLibrary(); await w(200); const n1 = lib().length; F.saveAllComponentsToLibrary(); await w(200);
  check('Save all: the saved drawing is skipped, a second run adds nothing', n1 - n0 === F.state.components.length - 1 && lib().length === n1, JSON.stringify([n0, n1, lib().length, F.state.components.length]));
  // (2) the Symbol's own Palette
  await paint(RED); F.setTier('element'); F.setPaperUI('#f4efe4'); F.onAppearanceChange(); await w(700);
  F.setTier('symbol'); await w(400);
  // not changed on the Symbol step yet: the Symbol follows the Element's Palette (red now, though it was green at the first visit)
  check('the Symbol follows the Element’s Palette until changed on the Symbol; no “Symbol’s own” yet', F.state.paperColor === '#f4efe4' && F.state.colors.join() === '#c2462e' && q('palette-symbol-hint').hidden, F.state.paperColor + ' ' + F.state.colors);
  F.setPaperUI('#222222'); F.state.colors = ['#3355ff']; F.buildPalette(); F.onAppearanceChange(); await w(900);
  check('changed on the Symbol: the Symbol draws it, the board keeps the Element’s, “Symbol’s own” shows', rectFill(F.buildSymbolSVG()) === '#222222' && boardPalette() === '#f4efe4/#c2462e' && !q('palette-symbol-hint').hidden, rectFill(F.buildSymbolSVG()) + ' ' + boardPalette() + ' hint ' + !q('palette-symbol-hint').hidden);
  F.setTier('component'); await w(400);
  const cc = F.state.components[0];
  check('back on Component: the Element’s Palette and Paper', F.state.paperColor === '#f4efe4' && F.state.colors.join() === '#c2462e' && rectFill(F.componentThumbMarkup(cc, F.gridOf(cc), F.getSeed(), F.frameDims(F.gridOf(cc)))) === '#f4efe4' && q('palette-symbol-hint').hidden, F.state.paperColor);
  await paint(GREEN);   // the Element changes after the Symbol has its own
  F.setTier('symbol'); await w(400);
  check('on the Symbol again: its own Palette, not the Element’s later change', F.state.paperColor === '#222222' && F.state.colors.join() === '#3355ff', F.state.paperColor + ' ' + F.state.colors);
  F.setTier('element'); await w(800);
  return { fails, rows };`);
await P.sleep(1200);
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const r2 = await P.ev(PRE + `await w(600);
  const ok1 = F.state.paperColor === '#f4efe4' && boardPalette() === '#f4efe4/#1d3b2a';
  F.setTier('symbol'); await w(500);
  const ok2 = F.state.paperColor === '#222222' && F.state.colors.join() === '#3355ff';
  return [(ok1 && ok2 ? '✓ ' : '✗ ') + 'after a reload: the Element its own, the Symbol its own' + (ok1 && ok2 ? '' : ' — ' + [ok1, ok2, F.state.paperColor, boardPalette()].join(' '))];`);
const rows = [...r.rows, ...r2], fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS versions: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
