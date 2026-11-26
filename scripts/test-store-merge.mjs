#!/usr/bin/env node
// shared/store.js mergePending — a pull while local edits wait to go up (Diego, Nov 26, 2026: the account wins on a conflict).
// No browser: loads store.js with a stub window. Usage: node scripts/test-store-merge.mjs
import fs from 'node:fs';
const notices = [];
const window = { Organica: { notice: m => notices.push(m) }, addEventListener() {} };
new Function('window', fs.readFileSync(new URL('../shared/store.js', import.meta.url), 'utf8'))(window);
const m = window.Organica.store.mergePending;
let bad = 0; const ck = (n, ok, got) => { if (!ok) bad++; console.log((ok ? '  ✓ ' : '  ✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got))); };
const base = { a: 1, b: 1, c: 1, d: 1 };
const local = { a: 2, b: 1, c: 5, e: 9 };          // a edited here, c edited here, d deleted here, e added here
const server = { a: 1, b: 3, c: 7, d: 1 };         // b changed there, c changed there too
const out = m(server, local, base);
ck('edited only here: kept', out.a === 2, out);
ck('changed only in the account: the account', out.b === 3, out);
ck('changed in both: the account wins', out.c === 7, out);
ck('deleted here, untouched there: deleted', !('d' in out), out);
ck('added here: kept', out.e === 9, out);
ck('one notice for the lost change', notices.length === 1 && /one change/.test(notices[0]), notices);
notices.length = 0;
ck('no conflict: no notice', m({ a: 1 }, { a: 2 }, { a: 1 }).a === 2 && notices.length === 0, notices);
ck('the same edit on both sides: no notice', m({ a: 4 }, { a: 4 }, { a: 1 }).a === 4 && notices.length === 0, notices);
console.log(bad ? 'store merge: FAIL — ' + bad : 'store merge: PASS — 8 checks');
process.exit(bad ? 1 : 0);
