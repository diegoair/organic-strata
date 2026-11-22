// Headless check (Nov 22, 2026, test-log 5aaf1ce): every Explore card keeps its own key (l: / c: / p:) — the key-colour
// facet is `keyColour`, so a star marks one card, not every card of that key colour — and the Key colour filter and
// group still read it. Also: the mood map's Warm / Cool labels sit inside the 420 viewBox.
// Run: node --experimental-websocket scripts/test-tunesutra-explore-keys.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 180000 });
const ok = await P.goto('/tunesutra/', 'window.Organica && typeof exploreAll === "function" && window.TUNESUTRA_FIG');
if (!ok) { console.log('  FAIL /tunesutra/ not ready'); await P.close(1); }
const R = await P.ev(`
  const all = exploreAll(), out = {};
  out.n = all.length;
  out.badKey = all.filter(e => !/^(l|c|p):/.test(e.key)).length;
  out.unique = new Set(all.map(e => e.key)).size === all.length;
  const keys = TUNESUTRA_FIG && KEYS.map(k => k.k);
  out.badColour = all.filter(e => keys.indexOf(e.keyColour) < 0).length;
  const k0 = all[0].keyColour; EXP.keys = [k0];
  out.filter = all.filter(matches).every(e => e.keyColour === k0) && all.filter(matches).length > 0;
  EXP.keys = [];
  out.group = GROUPS.key.of(all[0]) === k0;
  const box = document.createElement('div'); box.innerHTML = '<svg viewBox="0 0 420 420" width="420" height="420">' + TUNESUTRA_FIG.moodSvg({}, false) + '</svg>';
  document.body.appendChild(box);
  out.labels = [...box.querySelectorAll('text')].map(t => { const b = t.getBoundingClientRect(), s = box.querySelector('svg').getBoundingClientRect();
    return { t: t.textContent, inside: b.left >= s.left - 0.5 && b.right <= s.right + 0.5 && b.top >= s.top - 0.5 && b.bottom <= s.bottom + 0.5 }; });
  box.remove();
  return out;`);
const checks = [
  ['Explore has cards', R.n > 0],
  ['every card key is l: / c: / p:', R.badKey === 0],
  ['card keys are unique', R.unique],
  ['every card has a key colour', R.badColour === 0],
  ['Key colour filter reads keyColour', R.filter],
  ['Key colour group reads keyColour', R.group],
  ...R.labels.map(l => [`mood map label ${l.t} inside the square`, l.inside]),
];
let fail = 0;
for (const [name, pass] of checks) { console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}`); if (!pass) fail++; }
if (P.errors.length) { console.log('  page errors:', P.errors); fail++; }
console.log(fail ? `${fail} failed` : `${checks.length}/${checks.length} pass (${R.n} cards)`);
await P.close(fail ? 1 : 0);
