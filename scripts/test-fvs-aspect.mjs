#!/usr/bin/env node
// FVS Rectangle Element (Oct 23, 2026 — docs/FVS.md §3): an uploaded SVG that is not square keeps its own box (width /
// height = state.cellAspect) and the Component's cells take its proportions. On a tall F (60 × 100): the 4×4 frame is
// 0.6 : 1, the ink reaches both side edges of the frame (no letterbox gap), the rules turn only by half turns (0 / 180),
// Radial is unavailable, and back to a square box everything is square again. Usage: scripts/test-fvs-aspect.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 5 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const res = await P.ev(`
  const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms)), fails = [], rows = [];
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const check = (name, ok, got) => { rows.push((ok ? '✓ ' : '✗ ') + name + (ok ? '' : ' — ' + got)); if (!ok) fails.push(name); };
  F.setTier('component'); F.setCellShape('square'); set('rg-grid-cols', 4); set('rg-grid-rows', 4); set('rg-gap', 0);
  F.useSvgAsSeed('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100"><path d="M0 0H60V20H20V45H50V65H20V100H0Z"/></svg>'); await w(300);
  F.state.cellAspect = 0.6; F.setCellShape('square'); F.syncRuleAvailability(); F.syncAxisValuesUI(); await w(100);
  const d = F.frameDims(F.getGrid());
  check('the 4×4 frame takes the box: 0.6 : 1', Math.abs(d.w / d.h - 0.6) < 0.005, JSON.stringify(d));
  check('the cell shape turns by half turns', JSON.stringify(F.rotationSteps()) === '[0,180]', JSON.stringify(F.rotationSteps()));
  check('Turns defaults follow it (Up to 180, Every 180)', q('rg-turn-upto').value === '180' && q('rg-turn-every').value === '180', q('rg-turn-upto').value + ' / ' + q('rg-turn-every').value);
  check('Radial is unavailable on a Rectangle', q('sel-rule').querySelector('option[value="radial"]').disabled, 'enabled');
  // the ink of a Uniform Component reaches both side edges of the frame (the box fills the cell — no letterbox)
  set('sel-rule', 'identity'); q('btn-generate').click(); await w(600);
  const comp = F.state.components[0], grid = F.getGrid(), fd = F.frameDims(grid), c = document.createElement('canvas');
  c.width = Math.round(fd.w); c.height = Math.round(fd.h);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  F.drawComponentCanvas(x, F.buildComponentItems(comp, grid), F.getSeed(), fd);
  const px = x.getImageData(0, 0, c.width, c.height).data, ink = (i, j) => px[(j * c.width + i) * 4] < 128;
  let minX = c.width, maxX = -1;
  for (let j = 0; j < c.height; j += 2) for (let i = 0; i < c.width; i++) if (ink(i, j)) { if (i < minX) minX = i; if (i > maxX) maxX = i; }
  check('the ink reaches both side edges of the frame', minX <= 2 && maxX >= c.width - 3, minX + ' … ' + maxX + ' of ' + c.width);
  // the rules: only half turns
  for (const r of ['pinwheel', 'checkerboard', 'hlines', 'oscillator', 'exhaustive']) {
    set('sel-rule', r); q('btn-generate').click(); await w(800);
    const turns = [...new Set(F.state.components.flatMap(k => k.cells.map(z => ((z.rotation % 360) + 360) % 360)))].sort((a, b) => a - b);
    check(r + ' turns only 0 / 180 (' + F.state.components.length + ')', turns.every(t => t === 0 || t === 180), JSON.stringify(turns));
  }
  // back to a square box
  F.state.cellAspect = 1; F.setCellShape('square'); F.syncRuleAvailability(); F.syncAxisValuesUI(); await w(100);
  const d1 = F.frameDims(F.getGrid());
  check('a square box: square cells again', d1.w === d1.h && JSON.stringify(F.rotationSteps()) === '[0,90,180,270]', JSON.stringify(d1));
  check('Radial is back', !q('sel-rule').querySelector('option[value="radial"]').disabled, 'disabled');
  return { fails, rows };`);
for (const r of res.rows) console.log('  ' + r);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !res.fails.length && !errs.length;
console.log(`\nFVS aspect: ${ok ? 'PASS' : 'FAIL'} — ${res.rows.length} checks${res.fails.length ? `, ${res.fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
