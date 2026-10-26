#!/usr/bin/env node
// FVS Element undo (Oct 26, 2026 — Diego: "sull'element metti i comandi cmd z e undo"): every edit to the Element is a
// step for ⌘Z and the floatbar's Undo — a change that settles (500 ms) keeps what the Element was before it, a slider
// drag is one step, ⌘Z right after a change undoes it, a step on another Element goes back to that Element, and
// Delete / Clear board keep their steps in the same list.
// Usage: scripts/test-fvs-element-undo.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const r = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const cmdZ = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
  const btn = q('btn-board-undo-element'), seed = () => q('sel-seed-type').value, wd = () => q('rg-element-w').value;
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  F.setTier('element'); await w(800);
  set('sel-seed-type', 'chevron'); await w(700);
  const s0 = seed(), d0 = btn.disabled;
  set('sel-seed-type', 'circle'); await w(700);
  check('a shape change is a step: Undo is on', !btn.disabled && seed() === 'circle', [d0, btn.disabled, seed()]);
  for (const v of [1.1, 1.2, 1.3, 1.4, 1.5]) { set('rg-element-w', v); await w(60); }
  await w(700);
  check('a slider drag kept as one step', wd() === '1.5', wd());
  cmdZ(); await w(300);
  check('⌘Z: the drag goes back in one step', wd() === '1' && seed() === 'circle', [wd(), seed()]);
  btn.click(); await w(300);
  check('Undo: the shape as it was', seed() === s0, seed());
  set('sel-seed-type', 'triangle'); await w(50); cmdZ(); await w(300);
  check('⌘Z right after a change undoes it', seed() === s0, seed());
  F.state.colors = ['#3355ff']; F.buildPalette(); F.onAppearanceChange(); q('panel').dispatchEvent(new Event('change', { bubbles: true })); await w(700);
  cmdZ(); await w(300);
  check('a Palette change is a step', F.state.colors.join() !== '#3355ff', F.state.colors.join());
  // another Element: a step taken on the first goes back to it
  const first = F.state.activeElement;
  set('sel-seed-type', 'circle'); await w(700);
  q('btn-board-new-element').click(); await w(900);
  const second = F.state.activeElement;
  cmdZ(); await w(500);
  check('a step on another Element: back to it, as it was', second !== first && F.state.activeElement === first && seed() === s0, [second !== first, F.state.activeElement === first, seed()]);
  // typing in a field keeps the field's own undo
  const before = seed(); const inp = document.querySelector('#panel input[type=text], #panel input[type=number]');
  if (inp) { inp.focus(); inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })); await w(200); inp.blur(); }
  check('⌘Z in a text field is the field’s', seed() === before, seed());
  return rows;`);
const fails = r.filter(x => x.startsWith('✗'));
for (const x of r) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS element undo: ${ok ? 'PASS' : 'FAIL'} — ${r.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
