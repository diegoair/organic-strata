#!/usr/bin/env node
// FVS Open by URL (Nov 25, 2026 — home-hero backlog 1.3): ?element= / ?component= / ?symbol= <name> open that saved piece on its
// step once the libraries and boards have arrived, ?step= a step; the address is cleaned after; a missing name says why; the
// Library view's Copy link copies pieceUrl(). 15-export-library-view.js openFromUrl / pieceUrl, 99-boot.js.
// Usage: scripts/test-fvs-open-url.sh
import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 120000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const out = await P.ev(`const F = window.__fvs, r = [];
  const ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  ck('exports', typeof F.openFromUrl === 'function' && typeof F.pieceUrl === 'function');
  // seed a saved Element and a Component through the tool's own saves
  const en = F.saveElementVariant ? F.saveElementVariant('URL test element') : null;
  const els = F.ELEMENT_LIB.read(), eName = Object.keys(els).find(k => /URL test/.test(k)) || Object.keys(els)[0];
  ck('an Element is saved', !!eName, Object.keys(els));
  const notices = []; const n0 = Organica.notice; Organica.notice = m => notices.push(m);
  history.replaceState(null, '', '/fvs/?element=' + encodeURIComponent(eName) + '&x=1');
  F.setTier('symbol');
  let res = F.openFromUrl();
  ck('?element opens on the Element step', res && res.name === eName && F.state.activeTier === 'element', [res, F.state.activeTier]);
  ck('address cleaned, other params kept', location.search === '?x=1', location.search);
  history.replaceState(null, '', '/fvs/?component=' + encodeURIComponent('Nope “x”'));
  res = F.openFromUrl(); ck('missing → notice + its step', res.missing && F.state.activeTier === 'component' && notices[0] === 'No Component called “Nope “x”” in your library — the link may be from another account, or the Component was renamed', [notices, F.state.activeTier]);
  history.replaceState(null, '', '/fvs/?symbol=Gone'); F.openFromUrl(location.search, true); ck('offline → its own notice', notices[1] === 'Could not reach your library — check the connection, then open the link again', notices[1]);
  history.replaceState(null, '', '/fvs/?symbol='); F.setTier('element'); res = F.openFromUrl(); ck('empty name → step, no notice', F.state.activeTier === 'symbol' && notices.length === 2, [F.state.activeTier, notices.length]);
  // Copy link on a Library tile
  F.openLibview(); const btn = document.querySelector('.fvs-libview__thumb[data-lv-kind="element"]')?.closest('.fvs-libview__tile')?.querySelector('[data-lv-act="link"]');
  ck('Copy link on an Element tile', !!btn && btn.getAttribute('aria-label') === 'Copy link to ' + eName, btn && btn.getAttribute('aria-label'));
  ck('no Copy link on Genesis seeds', !document.querySelector('.fvs-libview__thumb[data-lv-kind="genesis"]')?.closest('.fvs-libview__tile')?.querySelector('[data-lv-act="link"]'));
  let copied = null; const cw = navigator.clipboard && navigator.clipboard.writeText; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
  btn && btn.click(); await new Promise(r => setTimeout(r, 50));
  ck('copies the link + status', copied === F.pieceUrl('element', eName) && document.getElementById('libview-status').textContent === 'Link copied', [copied, document.getElementById('libview-status').textContent]);
  ck('link icon registered', Organica.icons.names().includes('link'));
  F.closeLibview && F.closeLibview();
  ck('missing → address cleaned', location.search === '', location.search);
  history.replaceState(null, '', '/fvs/?step=component'); res = F.openFromUrl(); ck('?step=component', F.state.activeTier === 'component', F.state.activeTier);
  ck('no params → nothing', F.openFromUrl('') === null && F.openFromUrl('?foo=1') === null);
  ck('pieceUrl encodes', F.pieceUrl('symbol', 'Leaf wave / 2') === location.origin + '/fvs/?symbol=Leaf%20wave%20%2F%202', F.pieceUrl('symbol', 'Leaf wave / 2'));
  ck('boardPulls collected', Array.isArray(F.rt ? F.rt.boardPulls : null) ? F.rt.boardPulls.length === 2 : 'no rt');
  Organica.notice = n0;
  return r.join('\\n');`);
// a real load with the parameter: opens after boot
await P.goto('/fvs/?step=symbol', 'window.__fvs && window.__fvs.isReady');
await new Promise(r => setTimeout(r, 1500));
const all = out + '\n' + (await P.ev(`return window.__fvs.state.activeTier === 'symbol' && location.search === '' ? '✓ a real load with ?step=symbol' : '✗ a real load with ?step=symbol';`));
const bad = all.split('\n').filter(l => l.startsWith('✗')).length + P.errors.length;
if (P.errors.length) console.log('page errors:', P.errors);
console.log(bad ? 'FVS open by URL: FAIL — ' + bad : 'FVS open by URL: PASS — ' + all.split('\n').filter(l => l.startsWith('✓')).length + ' checks');
await P.close();
process.exit(bad ? 1 : 0);
