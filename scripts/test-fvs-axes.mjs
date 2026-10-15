#!/usr/bin/env node
// FVS Transform axes × Component rules — what every rule makes, frozen. Usage: scripts/test-fvs-axes.sh [--record]
//
// Tropism Phase 1 (docs/FVS-TROPISM.md) moves the rules onto levels + axis values with "no visible change by default".
// The regression suite never covered Rhythm, Lines, the lattice rules or Scale on, so this records, for every rule
// (every Rhythm mode, both Lines modes) × grid (square 1×3 / 2×2 / 2×3 / 3×3 / 4×4, hexagon / triangle / circle cells
// at size 2) × the 8 on/off combinations of Rotation · Flip · Scale, the count and a hash of every cell's rotation /
// flip / scale. The run must match fvs/_axes-baseline.json key for key; --record rewrites it (review the git diff).
// Calls the rules directly (produceRule — Generate's own dispatch, no gallery drawn). Headless, a clean profile.
import fs from 'node:fs';
import path from 'node:path';
import { openChrome, ROOT } from './lib/chrome-page.mjs';

const BASELINE = path.join(ROOT, 'fvs', '_axes-baseline.json');
const RECORD = process.argv.includes('--record');
const P = await openChrome({ timeoutMs: 10 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');

const got = await P.ev(`
  const F = window.__fvs, s = F.state;
  const set = (id, v) => { const e = document.getElementById(id); if (!e) throw new Error('no #' + id);
    if (e.type === 'checkbox') e.checked = v; else e.value = v;
    e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const opts = id => [...document.getElementById(id).options].map(o => o.value);
  F.setTier('component');
  const GRIDS = [['square', 1, 3], ['square', 2, 2], ['square', 2, 3], ['square', 3, 3], ['square', 4, 4], ['hexagon', 2], ['triangle', 2], ['circle', 2]];
  const out = {};
  for (const g of GRIDS) {
    F.setCellShape(g[0]);
    if (g[0] === 'square') { set('rg-grid-cols', g[1]); set('rg-grid-rows', g[2]); } else set('rg-grid-rings', g[1]);
    const gk = g[0] === 'square' ? g[1] + 'x' + g[2] : g[0] + g[1];
    const rules = [...document.getElementById('sel-rule').options].filter(o => !o.hidden && !o.disabled && o.value !== 'manual').map(o => o.value);
    for (let m = 0; m < 8; m++) {
      const R = !!(m & 1), Fl = !!(m & 2), S = !!(m & 4);
      set('chk-axis-rotation', R); set('chk-axis-flip', Fl); set('chk-axis-scale', S);
      const ak = (R ? 'R' : '-') + (Fl ? 'F' : '-') + (S ? 'S' : '-');
      for (const r of rules) {
        const variants = r === 'oscillator' ? opts('sel-rhythm-mode').map(v => ['sel-rhythm-mode', v])
          : (r === 'hlines' || r === 'vlines') ? opts('sel-lines-mode').map(v => ['sel-lines-mode', v]) : [[null, '']];
        for (const [ctl, v] of variants) {
          if (ctl) set(ctl, v);
          set('sel-rule', r);
          let list, key = gk + '|' + ak + '|' + r + (v ? ':' + v : '');
          try { list = F.produceRule(r); } catch (e) { out[key] = 'threw ' + e.message.slice(0, 60); continue; }
          out[key] = list ? list.length + ':' + hash(JSON.stringify(list.map(c => [c.ruleSource, c.cells.map(x => [x.rotation, !!x.flipH, !!x.flipV, x.scale])]))) : 'null';
        }
      }
    }
  }
  return out;`);

// Turns (the angle toggles, Oct 15, 2026): what a click gives, per cell shape, and that a shape change keeps each set
const turns = await P.ev(`
  const F = window.__fvs, s = F.state, q = id => document.getElementById(id), fails = [];
  const chips = () => [...q('turns-chips').querySelectorAll('.seg-btn')];
  const pressed = () => chips().filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.angle);
  const click = a => chips().find(b => +b.dataset.angle === a).click();
  const eq = (name, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(name + ': ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };
  F.setTier('component'); q('rot-set').value = ''; F.setTurnsFree(false);
  F.setCellShape('square'); q('chk-axis-rotation').checked = true; q('chk-axis-rotation').dispatchEvent(new Event('change'));
  eq('square chips', chips().map(b => +b.dataset.angle), [0, 90, 180, 270]);
  eq('square default', F.rotationValues(), [0, 90, 180, 270]);
  click(90); click(270); eq('square {0,180}', F.rotationValues(), [0, 180]); eq('pressed {0,180}', pressed(), [0, 180]);
  click(0); eq('0° stays', F.rotationValues(), [0, 180]);
  click(180); eq('only 0° → axis off', q('chk-axis-rotation').checked, false); eq('off pressed', pressed(), [0]);
  click(180); eq('back on', q('chk-axis-rotation').checked, true);
  F.setCellShape('hexagon'); eq('hexagon chips', chips().map(b => +b.dataset.angle), [0, 60, 120, 180, 240, 300]);
  eq('hexagon default', F.rotationValues(), [0, 60, 120, 180, 240, 300]); eq('free hidden off square', q('turns-free').hidden, true);
  click(60); click(180); click(300); eq('hexagon {0,120,240}', F.rotationValues(), [0, 120, 240]);
  F.setCellShape('triangle'); eq('triangle', F.rotationValues(), [0, 120, 240]);
  F.setCellShape('square'); eq('square kept', F.rotationValues(), [0, 180]);
  F.setCellShape('hexagon'); eq('hexagon kept', F.rotationValues(), [0, 120, 240]);
  F.setCellShape('square'); q('rg-rot-from').value = 0; q('rg-rot-to').value = 135; q('rg-rot-step').value = 45; F.setTurnsFree(true);
  eq('free 0–135 by 45', F.rotationValues(), [0, 45, 90, 135]); eq('chips disabled', chips().every(b => b.getAttribute('aria-disabled') === 'true'), true);
  F.setTurnsFree(false); eq('free closed → chips', F.rotationValues(), [0, 180]);
  q('rot-set').value = ''; q('rg-rot-from').value = 0; q('rg-rot-to').value = 270; q('rg-rot-step').value = 90; F.syncAxisValuesUI();
  return fails;`);
for (const f of turns) console.log('✗ turns ' + f);
const keys = Object.keys(got).sort();
if (RECORD) {
  fs.writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(keys.map(k => [k, got[k]])), null, 1) + '\n');
  console.log(`FVS axes: baseline recorded — ${keys.length} cases → fvs/_axes-baseline.json (review the git diff)`);
  await P.close(0);
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const changed = keys.filter(k => k in base && base[k] !== got[k]);
const added = keys.filter(k => !(k in base)), missing = Object.keys(base).filter(k => !(k in got));
for (const k of changed.slice(0, 20)) console.log(`✗ ${k}: ${base[k]} → ${got[k]}`);
if (added.length) console.log(`  new cases (not in the baseline): ${added.slice(0, 10).join(', ')}${added.length > 10 ? ' …' : ''}`);
if (missing.length) console.log(`  missing cases: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !changed.length && !missing.length && !errs.length && !turns.length;
console.log(`\nFVS axes: ${ok ? 'PASS' : 'FAIL'} — ${keys.length - changed.length}/${keys.length} cases match the baseline${added.length ? ` (+${added.length} new)` : ''}; Turns ${turns.length ? turns.length + ' failed' : 'OK'}`);
await P.close(ok ? 0 : 1);
