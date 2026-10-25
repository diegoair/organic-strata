#!/usr/bin/env node
// The dark-mode audit, headless (Oct 25, 2026 — it had only the Run button on /design-system/_dark-audit.html). Opens that
// page on its own server, presses Run, reads window.__auditResults: per page, text under 4.5:1 in light and in dark, and
// "dark islands" (light panels left in dark mode). Compares with scripts/dark-audit-baseline.json: a page that gets worse
// (more of any kind), an error, or an opted-in page with no theme button fails; fewer is reported (re-record with --record).
// Usage: scripts/test-dark-audit.sh [--record] [--all] [--detail]  (--all: also the pages not opted in, forced dark; --detail: every finding)
import fs from 'node:fs';
import path from 'node:path';
import { openChrome, ROOT } from './lib/chrome-page.mjs';

const RECORD = process.argv.includes('--record'), ALL = process.argv.includes('--all'), DETAIL = process.argv.includes('--detail');
const BASE = path.join(ROOT, 'scripts', 'dark-audit-baseline.json');
const P = await openChrome({ timeoutMs: 15 * 60 * 1000 });
await P.goto('/design-system/_dark-audit.html', 'document.getElementById("run")');
await P.ev(`document.getElementById('forced').checked = ${ALL}; document.getElementById('run').click();`);
const res = await P.ev(`
  const t0 = performance.now();
  while (!/^Done/.test(document.getElementById('summary').textContent) && performance.now() - t0 < 14 * 60 * 1000) await new Promise(r => setTimeout(r, 500));
  return window.__auditResults || null;`);
if (!res) { console.log('Dark audit: FAIL — the page never finished'); await P.close(1); }

const now = {};
for (const [url, { light, dark }] of Object.entries(res)) {
  if (!dark.opted && !ALL) continue;
  now[url] = { opted: !!dark.opted, light: (light.text || []).length, dark: (dark.text || []).length, islands: (dark.islands || []).length,
    button: !!dark.button, error: light.error || dark.error || null };
}
if (RECORD) {
  fs.writeFileSync(BASE, JSON.stringify(now, null, 1) + '\n');
  console.log(`Dark audit: recorded ${Object.keys(now).length} pages → scripts/dark-audit-baseline.json`);
  await P.close(0);
}
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
const worse = [], better = [];
for (const [url, r] of Object.entries(now)) {
  const b = base[url] || { light: 0, dark: 0, islands: 0, button: true };
  const line = `${url} — light text ${r.light} · dark text ${r.dark} · dark islands ${r.islands}`;
  if (r.error) worse.push(line + ' · ERROR ' + r.error);
  else if (r.opted && !r.button && b.button !== false) worse.push(line + ' · NO THEME BUTTON');   // the sign-in card has none by design (in the baseline)
  else if (r.light > b.light || r.dark > b.dark || r.islands > b.islands) worse.push(line + `  (baseline ${b.light} · ${b.dark} · ${b.islands})`);
  else if (r.light < b.light || r.dark < b.dark || r.islands < b.islands) better.push(line + `  (baseline ${b.light} · ${b.dark} · ${b.islands})`);
}
for (const l of worse) console.log('  ✗ ' + l);
if (DETAIL) for (const [url, { light, dark }] of Object.entries(res)) if (now[url]) {
  for (const [t, r] of [['light', light], ['dark', dark]]) for (const x of r.text || []) console.log(`    ${url} ${t} ${x.ratio}:1 ${x.sel} "${String(x.text).slice(0, 40)}" ${x.fg} on ${x.bg}`);
  for (const x of dark.islands || []) console.log(`    ${url} dark island ${x.sel} ${x.bg} ${x.size}`);
}
for (const l of better) console.log('  ↓ ' + l + ' — better: re-record with --record');
const ok = !worse.length;
console.log(`\nDark audit: ${ok ? 'PASS' : 'FAIL'} — ${Object.keys(now).length} pages${worse.length ? `, ${worse.length} worse than the baseline` : ''}${better.length ? `, ${better.length} better` : ''}`);
await P.close(ok ? 0 : 1);   // closes Chrome and the server, and exits with this code
