#!/usr/bin/env node
// FVS Rectangle cell (Oct 26, 2026 — Diego: a fifth cell shape, Portrait or Landscape, a box he chooses): the floatbar's
// Rectangle is square cells with a fixed box (state.cellAspect + cellAspectMode 'fixed'). Pressed: Portrait 2:3, the
// drawing fitted whole, the Rectangle / Proportions rows shown; Landscape, the presets (width first) and Free (Long
// side, up to 1:4) set the box; Width / Length never re-measure it; it is saved on the Element and comes back after a
// reload; Square leaves it. Usage: scripts/test-fvs-rectangle.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
const PRE = `const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const fb = c => document.querySelector('#fb-cell-shape [data-cell="' + c + '"]');
  const on = sel => [...document.querySelectorAll(sel + ' .seg-btn')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent.trim()).join();
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const ar = () => +F.state.cellAspect.toFixed(4);`;
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const r = await P.ev(PRE + `
  F.setTier('element'); await w(500); set('sel-seed-type', 'circle'); await w(300);
  fb('rectangle').click(); await w(400);
  check('pressed: Portrait 2:3, the button pressed and named', ar() === 0.6667 && F.state.cellAspectMode === 'fixed' && fb('rectangle').getAttribute('aria-pressed') === 'true' && fb('square').getAttribute('aria-pressed') === 'false' && fb('rectangle').getAttribute('aria-label') === 'Cell shape: Rectangle, 2:3', [ar(), fb('rectangle').getAttribute('aria-label')]);
  check('the Rectangle and Proportions rows: Portrait · 2:3, no Drawing, no Long side', !q('element-rect-row').hidden && on('#seg-element-rect') === 'Portrait' && on('#seg-element-rect-ratio') === '2:3' && q('seg-element-proportions').hidden && q('element-rect-long-row').hidden, [on('#seg-element-rect'), on('#seg-element-rect-ratio')]);
  const d = F.frameDims(F.getGrid());
  check('the Component frame takes the box', Math.abs(d.w / d.h - 2 / 3) < 0.005, JSON.stringify(d));
  check('the drawing fits whole: Scale ≤ the box', +q('rg-element-scale').value <= 0.667 + 0.001, q('rg-element-scale').value);
  check('half turns on a rectangle', JSON.stringify(F.rotationSteps()) === '[0,180]', JSON.stringify(F.rotationSteps()));
  F.setTier('component'); await w(300);
  const turnsOf = () => [...new Set(F.state.components.flatMap(k => k.cells.map(z => ((z.rotation % 360) + 360) % 360)))].sort((x, y) => x - y).join();
  const pin = async () => { set('sel-rule', 'pinwheel'); q('btn-generate').click(); await w(800); return turnsOf(); };
  const tOn = await pin(); const ax = q('chk-axis-rotation'), was = ax.checked; ax.checked = !was; ax.dispatchEvent(new Event('change', { bubbles: true })); await w(200);
  const tOff = await pin(); ax.checked = was; ax.dispatchEvent(new Event('change', { bubbles: true })); await w(200);
  check('Step turn turns only 0 / 180, with Turns on and off', /^0(,180)?$/.test(tOn) && /^0(,180)?$/.test(tOff), tOn + ' | ' + tOff);
  F.setTier('element'); await w(300);
  document.querySelector('#seg-element-rect [data-orient="landscape"]').click(); await w(300);
  check('Landscape: 3:2, the presets written width first', ar() === 1.5 && on('#seg-element-rect-ratio') === '3:2' && [...document.querySelectorAll('#seg-element-rect-ratio .seg-btn')].map(b => b.textContent).join() === '2:1,3:2,4:3,Free', [ar(), on('#seg-element-rect-ratio')]);
  document.querySelector('#seg-element-rect-ratio [data-ratio="2"]').click(); await w(300);
  check('2:1', ar() === 2 && on('#seg-element-rect-ratio') === '2:1', ar());
  document.querySelector('#seg-element-rect-ratio [data-ratio="free"]').click(); await w(200);
  check('Free: Long side shown at the box', !q('element-rect-long-row').hidden && on('#seg-element-rect-ratio') === 'Free' && q('rg-element-rect-long').value === '2', q('rg-element-rect-long').value);
  set('rg-element-rect-long', 3); await w(300);
  check('Long side 3 → 3:1, named on the button', ar() === 3 && q('v-element-rect-long').textContent === '3:1' && fb('rectangle').getAttribute('aria-label') === 'Cell shape: Rectangle, 3:1', [ar(), q('v-element-rect-long').textContent]);
  check('Long side stops at 1:4', q('rg-element-rect-long').max === '4', q('rg-element-rect-long').max);
  set('rg-element-w', 1.4); q('rg-element-w').dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  check('Width never re-measures the box', ar() === 3, ar());
  await w(900);
  const e = F.state.elements.find(x => x.id === F.state.activeElement);
  check('saved on the Element', e.seed.cellAspectMode === 'fixed' && +e.seed.cellAspect.toFixed(4) === 3, JSON.stringify([e.seed.cellAspectMode, e.seed.cellAspect]));
  return rows;`);
await P.sleep(800);
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const r2 = await P.ev(PRE + `F.setTier('element'); await w(600);
  check('after a reload: Rectangle 3:1, Free', fb('rectangle').getAttribute('aria-pressed') === 'true' && ar() === 3 && !q('element-rect-row').hidden && on('#seg-element-rect') === 'Landscape' && on('#seg-element-rect-ratio') === 'Free', [ar(), fb('rectangle').getAttribute('aria-pressed'), on('#seg-element-rect-ratio')]);
  fb('square').click(); await w(400);
  check('Square leaves it: box 1, rows back to Cell shape · Drawing', ar() === 1 && !F.state.cellAspectMode && q('element-rect-row').hidden && !q('seg-element-proportions').hidden && q('seg-element-rect-ratio').hidden && fb('square').getAttribute('aria-pressed') === 'true', [ar(), F.state.cellAspectMode]);
  fb('rectangle').click(); await w(400);
  check('pressed again: the last box (3:1)', ar() === 3, ar());
  document.querySelector('#seg-element-rect [data-orient="portrait"]').click(); await w(200);
  document.querySelector('#seg-element-rect-ratio [data-ratio="1.5"]').click(); await w(800);
  document.querySelector('#seg-element-rect-ratio [data-ratio="free"]').click(); await w(200);
  set('rg-element-rect-long', 3); await w(800);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })); await w(400);
  check('⌘Z back to a 2:3 box shows 2:3, not Free', ar() === 0.6667 && on('#seg-element-rect-ratio') === '2:3' && q('element-rect-long-row').hidden, ar() + ' ' + on('#seg-element-rect-ratio'));
  fb('hexagon').click(); await w(400);
  check('Hexagon leaves it too', ar() === 1 && F.state.cellShape === 'hexagon' && !F.state.cellAspectMode, [ar(), F.state.cellShape]);
  fb('square').click(); await w(300);
  return rows;`);
const rows = [...r, ...r2], fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS rectangle: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
