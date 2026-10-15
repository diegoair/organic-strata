#!/usr/bin/env node
// Every FVS headless suite at once. Usage: scripts/test-fvs.sh [--only a,b] [--jobs N] [--list] [--verbose]
// Each suite already brings its own static server + headless Chrome on throwaway ports, so they run side by
// side; the two-mode boards (clean mouse / held side button) run as two jobs. Prints one line per job with its
// time, the full output of any job that failed, and exits 1 if one did. The pre-commit hook runs a subset.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = (script, ...args) => [process.execPath, ['--experimental-websocket', '--no-warnings', `scripts/${script}`, ...args]];
// heaviest first: the long jobs start at once, the short ones fill in around them
const JOBS = {
  // the UI runner's journeys J1–J4 share one page (in order); D and the 120 variants V split off
  'ui-journeys':        node('test-fvs-ui.mjs', '--only', 'J1,J2,J3,J4'),
  'ui-v0':              node('test-fvs-ui.mjs', '--only', 'V', '--shard', '0/4'),
  'ui-v1':              node('test-fvs-ui.mjs', '--only', 'V', '--shard', '1/4'),
  'ui-v2':              node('test-fvs-ui.mjs', '--only', 'V', '--shard', '2/4'),
  'ui-v3':              node('test-fvs-ui.mjs', '--only', 'V', '--shard', '3/4'),
  'ui-design':          node('test-fvs-ui.mjs', '--only', 'D'),
  'boards-clean':       node('test-fvs-boards.mjs', '--only', 'clean'),
  'boards-held':        node('test-fvs-boards.mjs', '--only', 'held'),
  'boards-extra':       node('test-fvs-boards.mjs', '--only', 'extra'),
  'figure-board-clean': node('test-figure-board.mjs', '--only', 'clean'),
  'figure-board-held':  node('test-figure-board.mjs', '--only', 'held'),
  'figure-board-dark-clean': node('test-figure-board.mjs', '--only', 'clean', '--theme', 'dark'),
  'figure-board-dark-held':  node('test-figure-board.mjs', '--only', 'held', '--theme', 'dark'),
  'element-units':      node('test-fvs-element-units.mjs'),
  'generate':           node('test-fvs-generate.mjs'),
  'axes':               node('test-fvs-axes.mjs'),       // every rule × grid × axis frozen (Tropism Phase 1)   // Component: one Generate after another = a fresh one
  'qa':                 node('test-fvs-qa.mjs'),
  'figure-graph':       node('test-figure-graph.mjs'),
  'figure-eval':        node('test-figure-eval.mjs'),
  'regression':         node('regression.mjs'),
  'rhizome':            node('test-rhizome.mjs'),   // the other node-canvas consumer
  'atlas':              node('capture-fvs-atlas.mjs', '--check'),   // design-system/_fvs-rules.html = the engine's rules
};
// groups, so a caller can name a suite rather than its jobs
const GROUPS = { boards: ['boards-clean', 'boards-held', 'boards-extra'], 'figure-board': ['figure-board-clean', 'figure-board-held'],
  'figure-board-dark': ['figure-board-dark-clean', 'figure-board-dark-held'],
  ui: ['ui-journeys', 'ui-v0', 'ui-v1', 'ui-v2', 'ui-v3', 'ui-design'] };

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
if (process.argv.includes('--list')) { console.log(Object.keys(JOBS).join('\n') + '\n(groups: ' + Object.keys(GROUPS).join(', ') + ')'); process.exit(0); }
const VERBOSE = process.argv.includes('--verbose');
const only = (arg('only', '') || '').split(',').filter(Boolean).flatMap(n => GROUPS[n] || [n]);
const unknown = only.filter(n => !JOBS[n]);
if (unknown.length) { console.error(`Unknown job: ${unknown.join(', ')} (see --list)`); process.exit(2); }
const names = only.length ? Object.keys(JOBS).filter(n => only.includes(n)) : Object.keys(JOBS);
const LIMIT = Math.max(1, +arg('jobs', 0) || Math.min(6, Math.floor(os.cpus().length / 2)));

const t0 = Date.now(), results = [], queue = [...names];
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, Math.max(n, s.length));
function runOne(name) {
  const [cmd, args] = JOBS[name], start = Date.now();
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    p.on('close', code => {
      const r = { name, code, secs: (Date.now() - start) / 1000, out };
      // the suite's own last verdict line (PASS — n/m, All N cases match…)
      const verdict = out.trim().split('\n').reverse().find(l => /PASS|FAIL|ERROR|match|passed|failed/i.test(l)) || '';
      console.log(`${code === 0 ? '✓' : '✗'} ${pad(name, 20)} ${r.secs.toFixed(1).padStart(6)}s  ${verdict.trim().slice(0, 90)}`);
      results.push(r); resolve();
    });
  });
}
async function worker() { while (queue.length) await runOne(queue.shift()); }
console.log(`FVS suites: ${names.length} job${names.length === 1 ? '' : 's'}, ${LIMIT} at a time\n`);
await Promise.all(Array.from({ length: Math.min(LIMIT, names.length) }, worker));

const failed = results.filter(r => r.code !== 0);
for (const r of (VERBOSE ? results : failed)) console.log(`\n──── ${r.name} (exit ${r.code}) ────\n${r.out.trim()}`);
console.log(`\n${failed.length ? 'FAIL' : 'PASS'} — ${results.length - failed.length}/${results.length} jobs in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
  ` (sum of job times ${results.reduce((a, r) => a + r.secs, 0).toFixed(0)}s)`);
process.exit(failed.length ? 1 : 0);
