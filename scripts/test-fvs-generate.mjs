#!/usr/bin/env node
// FVS Component — what changes from one Generate to the next. Usage: scripts/test-fvs-generate.sh [--only grid,lattice,layers]
//
// For every Component rule B, "B generated after A" must equal "B generated on a fresh page": same Components (cells,
// rule, layer inks), the gallery drawing exactly those (one thumbnail per Component, in order, each drawing what a fresh
// run draws), the first one selected, nothing of A left behind (no thumbnail, no selection, no cap note), the
// Exhaustive hint matching what it made, the gallery on screen, the console clean. A is Exhaustive and then every rule
// in turn (a chain through the whole menu), plus B → Exhaustive back. An Exhaustive over the 2,048 cap must leave the
// gallery as it was with Generate disabled. (Diego, Oct 15, 2026: "test what changes between one generation and
// another, start with Exhaustive and finish with another, and see if it is correct".)
// Four set-ups: a 2×2 square grid (Rotation + Flip), a size-2 hexagon lattice (the seven lattice rules), a 3-layer
// Element with Layer colour variants, and the 2×2 grid with Scale on too (Exhaustive over the cap). --only grid,lattice,layers,overcap. Headless, a clean profile, never writes to the repo.
import { openChrome, quietPage, QUIET } from './lib/chrome-page.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const P = await openChrome({ timeoutMs: 8 * 60 * 1000 });
await quietPage(P.cdp);
const settle = () => P.cdp('Runtime.evaluate', { expression: QUIET, awaitPromise: true });

// in-page helpers: apply a set-up, generate a rule, read the result
const PAGE = `(() => { if (window.__g) return;
  const F = window.__fvs, s = F.state;
  const set = (id, v) => { const e = document.getElementById(id); if (!e) throw new Error('no #' + id);
    if (e.type === 'checkbox') e.checked = v; else e.value = v;
    e.dispatchEvent(new Event(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const setups = {
    grid:    async () => { F.setTier('component'); F.setCellShape('square'); set('rg-grid-cols', 2); set('rg-grid-rows', 2); },
    lattice: async () => { F.setTier('component'); F.setCellShape('hexagon'); set('rg-grid-rings', 2); },   // size 1 = one cell: the patterned rules grey out
    layers:  async () => { F.setTier('element'); const add = document.getElementById('btn-layer-add'); add.click(); add.click();
                           F.setTier('component'); F.setCellShape('square'); set('rg-grid-cols', 2); set('rg-grid-rows', 2); set('chk-layer-inks', true); },
  };
  const axes = (r, f, sc) => { set('chk-axis-rotation', r); set('chk-axis-flip', f); set('chk-axis-scale', sc); };
  const rules = () => [...document.getElementById('sel-rule').options].filter(o => !o.hidden && !o.disabled && o.value !== 'manual').map(o => o.value);
  const read = () => {
    const comps = s.components;
    const thumbs = [...document.querySelectorAll('#gallery .fvs-thumb')];
    const thumbIds = thumbs.map(t => (t.getAttribute('aria-label') || '').split(' ').find(w => comps.some(c => c.id === w)) || '?' + t.getAttribute('aria-label'));
    const sel = [...document.querySelectorAll('#gallery .fvs-thumb-wrap')].filter(w => /is-sel|selected/.test(w.className) || w.querySelector('[aria-pressed="true"]')).length;
    const B = F.boards && F.boards.component, st = B && B.stage.getBoundingClientRect(), g = document.querySelector('#gallery');
    const gr = g && g.getBoundingClientRect();
    return {
      n: comps.length,
      model: hash(JSON.stringify(comps.map(c => [c.ruleSource, c.cells.map(x => [x.rotation, x.flipH, x.flipV, x.scale]), c.layerInks ? (s.layers ? s.layers.items.map(l => c.layerInks[l.id] ?? null) : c.layerInks) : null]))),   // layer ids are random per page: read the inks in layer order
      ids: comps.map(c => c.id),
      thumbIds,
      drawings: hash(thumbs.map(t => F.drawIdFree(t.querySelector('svg').outerHTML)).join('|')),
      selectedId: s.selectedId, selMarks: sel,
      capNote: s.galleryCapNote ? s.galleryCapNote.text : null,
      hint: (document.getElementById('rule-total-hint') || {}).textContent || '',
      genDisabled: document.getElementById('btn-generate').getAttribute('aria-disabled') === 'true',
      cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0,
      onScreen: !!(st && gr && gr.bottom > st.top && gr.top < st.bottom && gr.right > st.left && gr.left < st.right),
    };
  };
  const gen = async rule => { set('sel-rule', rule); document.getElementById('btn-generate').click(); };
  window.__g = { F, s, set, setups, axes, rules, read, gen };
})()`;

async function freshPage(setup) {
  await P.goto('/vercel.json');
  await P.ev(`try { localStorage.clear(); } catch (e) {} return 1;`);
  await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
  await P.cdp('Runtime.evaluate', { expression: PAGE });
  await P.ev(`await __g.setups[${JSON.stringify(setup.name)}](); __g.axes(${setup.axes.join(',')}); return 1;`);
  await settle();
  P.errors.length = 0;
}
const gen = async rule => { await P.ev(`await __g.gen(${JSON.stringify(rule)}); return 1;`); await settle(); return P.ev(`return __g.read();`); };

const SETUPS = [
  { name: 'grid', axes: [true, true, false] },
  { name: 'lattice', axes: [true, true, false] },
  { name: 'layers', axes: [true, false, false] },
  { name: 'lattice', label: 'overcap', axes: [true, true, true] },   // hexagons + Scale: Exhaustive 74,556 > 2,048 refused, the gallery kept; Checkerboard cut at 2,048
].map(x => ({ ...x, label: x.label || x.name })).filter(x => !ONLY.length || ONLY.includes(x.label));

let pass = 0, fail = 0;
const lines = [];
const check = (where, name, ok, detail = '') => { ok ? pass++ : fail++; if (!ok) lines.push(`✗ ${where} · ${name}${detail ? ' — ' + detail : ''}`); };

for (const setup of SETUPS) {
  // 1 — the reference: each rule generated on a fresh page
  await freshPage(setup);
  const rules = await P.ev(`return __g.rules();`);
  const ref = {};
  for (const r of rules) { await freshPage(setup); ref[r] = await gen(r); }
  console.log(`${setup.label}: ${rules.length} rules — ` + rules.map(r => `${r} ${r === 'exhaustive' && ref[r].genDisabled ? 'over cap' : ref[r].n}`).join(' · '));

  // what every generation must satisfy on its own
  const own = (where, r, got) => {
    check(where, 'one thumbnail per Component, in order', JSON.stringify(got.thumbIds) === JSON.stringify(got.ids), `${got.thumbIds.length} thumbs vs ${got.n}`);
    check(where, 'the first Component selected, one selection mark', got.selectedId === (got.ids[0] ?? null) && got.selMarks === (got.n ? 1 : 0), `selected ${got.selectedId}, marks ${got.selMarks}`);
    check(where, 'the gallery on screen', got.n === 0 || got.onScreen);
    check(where, 'never more than 2,048 (every rule capped — Oct 15, 2026)', got.n <= 2048, `${got.n}`);
    check(where, 'the area\'s columns follow the count', got.cols === (got.n <= 32 ? 4 : Math.ceil(Math.sqrt(got.n * 1.5) / 4) * 4), `${got.cols} columns for ${got.n}`);
    if (r === 'exhaustive' && !got.genDisabled) {
      // "N possible components." = N made · "N possible … × k layer-colour combinations = T" = min(T, 2,048) made
      const num = t => +t.replace(/,/g, '');
      const m = got.hint.match(/^([\d,]+) possible/), t = got.hint.match(/= ([\d,]+)/);
      const want = t ? Math.min(num(t[1]), 2048) : m && num(m[1]);
      check(where, 'Exhaustive hint = what it made', want === got.n, got.hint + ' / made ' + got.n);
    }
  };
  for (const r of rules) if (!(r === 'exhaustive' && ref[r].genDisabled)) own(`${setup.label} fresh ${r}`, r, ref[r]);

  // 2 — transitions: Exhaustive → B, B → Exhaustive, and one chain through the whole menu
  const same = (where, got, want) => {
    check(where, 'same Components as a fresh run', got.model === want.model && got.n === want.n, `${got.n} vs ${want.n}`);
    check(where, 'same drawings as a fresh run', got.drawings === want.drawings);
    check(where, 'nothing of the previous run left', got.thumbIds.every(id => got.ids.includes(id)) && (!!got.capNote === !!want.capNote));
  };
  const overCap = ref.exhaustive.genDisabled;   // refused: a fresh page still shows its start-up Components, so not n = 0
  await freshPage(setup);
  for (const b of rules) {
    if (b === 'exhaustive') continue;
    const a = await gen('exhaustive');
    const got = await gen(b);
    if (overCap) check(`${setup.label} exhaustive (over cap)`, 'Generate disabled, gallery kept', a.genDisabled);
    const w = `${setup.label} exhaustive → ${b}`;
    same(w, got, ref[b]); own(w, b, got);
    const back = await gen('exhaustive');
    if (!(overCap)) { same(`${setup.label} ${b} → exhaustive`, back, ref.exhaustive); own(`${setup.label} ${b} → exhaustive`, 'exhaustive', back); }
    else check(`${setup.label} ${b} → exhaustive (over cap)`, 'the gallery is left as it was', back.model === got.model && back.genDisabled, `n ${back.n} vs ${got.n}`);
  }
  let prev = 'exhaustive'; await gen(prev);
  for (const b of [...rules].reverse()) { if (b === 'exhaustive' && overCap) continue; const got = await gen(b); same(`${setup.label} chain ${prev} → ${b}`, got, ref[b]); prev = b; }
  check(`${setup.label}`, 'console clean', !P.errors.length, P.errors.slice(0, 3).join(' | '));
}

for (const l of lines) console.log(l);
console.log(`\nFVS generate transitions: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
await P.close(fail ? 1 : 0);
