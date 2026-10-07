#!/usr/bin/env node
// Typographic apostrophe in visible copy (docs/UI-COPY.md rule 12 — Diego, Oct 7, 2026): every visible string uses ’
// (U+2019), never the straight '. Run by scripts/check.py; `node scripts/check-apostrophes.mjs --fix` rewrites what it finds.
//
// What it reads: HTML text, copy attributes (title / aria-label / aria-description / placeholder / alt / content /
// label / value / data-tip / data-label) and JS string literals ("…", `…`, and '…' where the apostrophe is \').
// What it skips: comments, code (a ' between letters outside a string is not possible in valid JS anyway), <code> /
// <pre> blocks, <script type="application/json|text/template">, GLSL / worker source kept in a template literal,
// the comments a tool writes into an exported CSS file, entity escapes (&#39; / &apos; are an escape function's job).
// Not scanned: archive/ (frozen), explorations/, scratchpad/, docs/, scripts/, shared/vendor/, _-prefixed dev pages —
// except the _ pages in SCANNED_DEV_PAGES: references read by people, not dev tools (Diego, Oct 7, 2026, O-28).
// A deliberate straight apostrophe: put `apostrophe-ok` on the same line (in a comment for JS).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = process.argv.includes('--fix');
const SKIP = /^(archive|explorations|scratchpad|docs|scripts|node_modules|\.git|\.claude|genesis\/archive|shared\/vendor)(\/|$)|(^|\/)_[^/]*\.(html|js|mjs)$|\.min\.js$/;
// _-prefixed pages that are references for people, so their copy follows the same rules (scripts/ds-audit.py has the same list)
export const SCANNED_DEV_PAGES = new Set(['design-system/_fvs-rules.html']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = d ? d + '/' + e.name : e.name;
    if (SKIP.test(rel) && !SCANNED_DEV_PAGES.has(rel)) continue;
    if (e.isDirectory()) walk(rel); else if (/\.(html|js|mjs)$/.test(e.name)) files.push(rel);
  }
})('');

const APOS = /(?<=[A-Za-zÀ-ɏ])'(?=[A-Za-z])|(?<=[A-Za-z]s)'(?=[\s.,;:!?)])/g;      // don't · Diego's · users'
const APOS_ESC = /(?<=[A-Za-zÀ-ɏ])\\'(?=[A-Za-z])|(?<=[A-Za-z]s)\\'(?=[\s.,;:!?)])/g;
const COPY_ATTR = /^(title|aria-label|aria-description|placeholder|alt|content|data-tip|data-label|label|value)$/;

// JS: every string literal → [kind, start, end] (offsets into src), comments and regex literals skipped
function jsStrings(src) {
  const n = src.length, strings = [];
  let prevSig = '';
  const regexOK = () => /(^|[(,=:[!&|?{};+\-*%<>~^]|return|typeof|case|in|of|delete|void|throw|new|else|do)$/.test(prevSig);
  const str = (q, s) => { let j = s + 1; while (j < n && src[j] !== q) { if (src[j] === '\\') j++; else if (src[j] === '\n') break; j++; } return j + 1; };
  function template(s) {
    let j = s + 1, seg = j;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') { strings.push(['tpl', seg, j]); return j + 1; }
      if (c === '$' && src[j + 1] === '{') { strings.push(['tpl', seg, j]); j = code(j + 2, true); seg = j; continue; }
      j++;
    }
    return j;
  }
  function code(j, untilBrace) {
    let depth = 0;
    while (j < n) {
      const c = src[j];
      if (c === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j++; continue; }
      if (c === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j + 2); j = e < 0 ? n : e + 2; continue; }
      if (c === '"' || c === "'") { const e = str(c, j); strings.push([c === '"' ? 'dq' : 'sq', j + 1, e - 1]); j = e; prevSig = 'x'; continue; }
      if (c === '`') { j = template(j); prevSig = 'x'; continue; }
      if (c === '/' && regexOK()) {
        let k = j + 1, cls = false;
        while (k < n && src[k] !== '\n') { const d = src[k]; if (d === '\\') { k += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; k++; }
        j = k + 1; while (/[a-z]/i.test(src[j] || '')) j++; prevSig = 'x'; continue;
      }
      if (untilBrace) { if (c === '{') depth++; else if (c === '}') { if (depth === 0) return j + 1; depth--; } }
      if (!/\s/.test(c)) {
        if (/[A-Za-z_$0-9]/.test(c)) { let k = j; while (k < n && /[A-Za-z_$0-9]/.test(src[k])) k++; prevSig = src.slice(j, k); j = k; continue; }
        prevSig = c;
      }
      j++;
    }
    return j;
  }
  code(0, false);
  return strings;
}
const isCodeTemplate = t => /precision (high|medium|low)p|void main\s*\(|gl_FragColor|^\s*\/\/|\n\s*\/\/|self\.onmessage|postMessage\(/.test(t);
const isCssComment = t => /\/\*|\*\//.test(t);

// → list of { pos, len, rep } for one file
function findings(src, file) {
  const hits = [];
  const push = (p, len) => hits.push({ pos: p, len, rep: '’' });
  const scanJS = (js, base) => {
    for (const [kind, s, e] of jsStrings(js)) {
      const t = js.slice(s, e);
      if (kind === 'tpl' && isCodeTemplate(t)) continue;
      if (isCssComment(t)) continue;
      const re = kind === 'sq' ? APOS_ESC : APOS;
      re.lastIndex = 0; let m;
      while ((m = re.exec(t))) push(base + s + m.index, m[0].length);
    }
  };
  if (!file.endsWith('.html')) { scanJS(src, 0); return hits; }
  const code = [...src.matchAll(/<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/g)].map(m => [m.index, m.index + m[0].length]);
  const inCode = p => code.some(([a, b]) => a <= p && p < b);
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[2] !== undefined) {
      if (/\bsrc=/.test(m[1]) || /type="(application\/json|text\/template)"/.test(m[1])) continue;
      scanJS(m[2], m.index + m[0].indexOf('>') + 1); continue;
    }
    if (m[3]) {
      const attrs = m[4] || '', base = m.index + m[0].indexOf(m[3]) + m[3].length;
      const ar = /([^\s=>\/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g; let a;
      while ((a = ar.exec(attrs))) {
        if (a[3] === undefined || !COPY_ATTR.test(a[1].toLowerCase())) continue;
        const vs = base + a.index + a[0].indexOf('"') + 1;
        APOS.lastIndex = 0; let x;
        while ((x = APOS.exec(a[3]))) push(vs + x.index, 1);
      }
      continue;
    }
    if (m[5]) { APOS.lastIndex = 0; let x; while ((x = APOS.exec(m[5]))) if (!inCode(m.index + x.index)) push(m.index + x.index, 1); }
  }
  return hits;
}

const lineOf = (src, p) => src.slice(0, p).split('\n').length;
let count = 0;
const report = [];
for (const f of files) {
  let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const lines = src.split('\n');
  const hits = findings(src, f).filter(h => !/apostrophe-ok/.test(lines[lineOf(src, h.pos) - 1]));
  if (!hits.length) continue;
  count += hits.length;
  if (FIX) {
    for (const h of hits.sort((a, b) => b.pos - a.pos)) src = src.slice(0, h.pos) + h.rep + src.slice(h.pos + h.len);
    fs.writeFileSync(path.join(ROOT, f), src);
    report.push(`fixed ${hits.length}  ${f}`);
  } else {
    for (const h of hits.slice(0, 5)) {
      const ln = lineOf(src, h.pos), line = lines[ln - 1], col = h.pos - src.lastIndexOf('\n', h.pos - 1) - 1;
      report.push(`${f}:${ln}  …${line.slice(Math.max(0, col - 40), col + 30).trim()}…`);
    }
    if (hits.length > 5) report.push(`${f}: +${hits.length - 5} more`);
  }
}
if (report.length) console.log(report.join('\n'));
console.log(count ? (FIX ? `${count} straight apostrophe(s) → ’` : `${count} straight apostrophe(s) in visible copy (UI-COPY rule 12) — node scripts/check-apostrophes.mjs --fix, or apostrophe-ok on the line`) : `${files.length} files, no straight apostrophe in visible copy`);
process.exit(count && !FIX ? 1 : 0);
