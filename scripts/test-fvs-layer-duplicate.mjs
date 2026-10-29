#!/usr/bin/env node
// FVS Element — Duplicate a layer (Diego, Oct 29, 2026: "add a duplicate feature on the layer of the element"). The copy
// goes right above its layer with the same shape, look, place, role and ink, a new id, and becomes the edited layer; a
// part of a division has no Duplicate. 07-library.js duplicateLayer.
// Usage: scripts/test-fvs-layer-duplicate.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 2 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  F.setTier('element'); await w(600);
  q('btn-layer-add').click(); await w(400);   // two layers: the new one (a circle) on top, edited
  set('rg-layer-mx', 20); set('rg-layer-rotate', 30); await w(400);
  const L = () => F.state.layers, top = L().items[1];
  const dup = document.querySelector('#layers-list .org-layer-card[data-layer="1"] [data-layer-act="dup"]');
  check('each layer row has a Duplicate button (copy icon, named “Duplicate layer”)', !!dup && dup.getAttribute('aria-label') === 'Duplicate layer' && !!dup.querySelector('svg'), dup && dup.outerHTML.slice(0, 120));
  dup.click(); await w(500);
  const c = L().items[2], o = L().items[1];
  check('Duplicate: 3 layers, the copy right above its layer', L().items.length === 3 && o.id === top.id, L().items.length);
  check('…same shape, place, role, ink and look; a new id', c && c.id !== o.id && c.seed.type === o.seed.type && JSON.stringify(c.place) === JSON.stringify(o.place) && c.role === o.role && c.ink === o.ink && JSON.stringify(c.look) === JSON.stringify(o.look) && c.place.mx === 20 && c.place.rotate === 30, JSON.stringify([c && c.place, o.place]));
  check('…the copy is the edited layer (its row active)', L().active === 2 && !!document.querySelector('#layers-list .org-layer-card.active[data-layer="2"]'), L().active);
  set('rg-layer-mx', -10); await w(400);
  check('…editing the copy leaves the original as it was', L().items[2].place.mx === -10 && L().items[1].place.mx === 20, L().items[2].place.mx + ' / ' + L().items[1].place.mx);
  const bottom = document.querySelector('#layers-list .org-layer-card[data-layer="0"] [data-layer-act="dup"]'); bottom.click(); await w(500);
  check('Duplicate on the bottom layer: the copy lands at 1, the others move up', L().items.length === 4 && L().items[1].seed.type === L().items[0].seed.type && L().active === 1 && L().items[3].place.mx === -10, JSON.stringify(L().items.map(l => l.seed.type)));
  check('the Element still draws', !!document.querySelector('#seed-preview svg, #element-preview svg, .tier-view[data-tier="element"] svg'), '');
  return rows;`);
rows.forEach(r => console.log('  ' + r));
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const fail = rows.filter(r => r.startsWith('✗')).length + (errs.length ? 1 : 0);
console.log(`\nFVS layer duplicate: ${fail ? 'FAIL' : 'PASS'} — ${rows.length} checks`);
await P.close(fail ? 1 : 0);
