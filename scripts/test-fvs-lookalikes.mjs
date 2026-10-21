#!/usr/bin/env node
// FVS look-alikes (Oct 21, 2026 — docs/FVS.md §5.2a case 2): Generate folds the Components that only LOOK the same for
// this Element (its own symmetry). For Element shapes × rules × axes on a 2×2: every Component the fold removed has a
// pixel-identical twin that stayed (nothing new is lost), no two that stayed draw the same, and an asymmetric Element
// (Blob) loses nothing. Usage: scripts/test-fvs-lookalikes.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 10 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const res = await P.ev(`
  const F = window.__fvs, q = id => document.getElementById(id), fails = [], rows = [];
  const set = (id, v) => { const e = q(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  F.setTier('component'); F.setCellShape('square'); set('rg-grid-cols', 2); set('rg-grid-rows', 2);
  const img = comp => { const grid = F.getGrid(), d = F.frameDims(grid), c = document.createElement('canvas'); c.width = Math.round(d.w * 0.5); c.height = Math.round(d.h * 0.5);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.scale(0.5, 0.5);
    F.drawComponentCanvas(x, F.buildComponentItems(comp, grid), F.getSeed(), d); return x.getImageData(0, 0, c.width, c.height).data; };
  const same = (a, b) => { if (a.length !== b.length) return false; let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 48 && ++n > a.length / 4 * 0.0005) return false; return true; };
  const run = off => { F.live.lookAlikeFoldOff = off; F.generate(); F.live.lookAlikeFoldOff = false; return F.state.components.slice(); };
  for (const shape of ['circle', 'cross', 'lens', 'arc', 'star', 'blob']) {
    set('sel-seed-type', shape);
    for (const ax of [[true, false, false], [true, true, false], [true, false, true]]) {
      set('chk-axis-rotation', ax[0]); set('chk-axis-flip', ax[1]); set('chk-axis-scale', ax[2]);
      for (const rule of ['identity', 'pinwheel', 'mirror', 'checkerboard', 'radial', 'random', 'exhaustive']) {
        set('sel-rule', rule);
        const all = run(true), kept = run(false);
        const ki = kept.map(img), ai = all.map(img);
        const lost = ai.filter(a => !ki.some(k => same(a, k))).length;
        let dupes = 0; for (let i = 0; i < ki.length && i < 120; i++) for (let j = i + 1; j < ki.length && j < 120; j++) if (same(ki[i], ki[j])) dupes++;
        const tag = shape + ' ' + (ax[1] ? 'RF' : ax[2] ? 'RS' : 'R') + ' ' + rule;
        rows.push(tag + ': ' + all.length + ' → ' + kept.length);
        if (rule !== 'random' && lost) fails.push(tag + ': ' + lost + ' Component(s) lost with no identical twin');
        if (dupes) fails.push(tag + ': ' + dupes + ' identical pair(s) left');
        if (shape === 'blob' && rule !== 'random' && kept.length !== all.length) fails.push(tag + ': an asymmetric Element lost ' + (all.length - kept.length));
      }
    }
  }
  set('chk-axis-rotation', true); set('chk-axis-flip', false); set('chk-axis-scale', false); set('sel-seed-type', 'arc'); set('sel-rule', 'random');
  return { fails, rows };`);
for (const r of res.rows) console.log('  ' + r);
for (const f of res.fails) console.log('✗ ' + f);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !res.fails.length && !errs.length;
console.log(`\nFVS look-alikes: ${ok ? 'PASS' : 'FAIL'} — ${res.rows.length} cases${res.fails.length ? `, ${res.fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
