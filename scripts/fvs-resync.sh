#!/bin/sh
# One-off (branch fvs-split, Oct 2026): rebuild the split FVS from main's latest single-file fvs/index.html, right
# before merging — so FVS work that landed on main while the branch was open is carried over by the generators,
# never hand-merged. Usage (in the fvs-split worktree, clean tree): scripts/fvs-resync.sh [ref=main]
#   1. takes <ref>:fvs/index.html, re-applies the stage-0 edits (drop the dead first componentUsage, 'use strict',
#      pencil / close via Organica.icons.get) — each only if still needed
#   2. fvs-split.mjs → classic files, fvs-modules.mjs (+ fvs-engine.mjs) → ES modules, engine, lazy Figure
#   3. runs check.py, regression, test-fvs-qa — review `git diff`, then commit
# The harness / docs / scripts changes are ordinary files: bring main's edits to those with a normal `git merge`.
set -e
cd "$(dirname "$0")/.."
REF="${1:-main}"
git show "$REF:fvs/index.html" > fvs/index.html
python3 - <<'PY'
import re
p = 'fvs/index.html'; s = open(p, encoding='utf-8').read()
if not re.search(r'<script>\n/\* ─', s): raise SystemExit('fvs/index.html: the inline script is not where it was — rebuild by hand')
# 'use strict' on the script
s = s.replace("<script>\n/* ─", "<script>\n'use strict';\n/* ─", 1)
# the first of two componentUsage declarations is dead (the second wins in a classic script; a SyntaxError in a module)
decls = [m.start() for m in re.finditer(r'^function componentUsage\(', s, re.M)]
if len(decls) == 2:
    a = s.rfind('\n// Where a saved Component is in use', 0, decls[0])
    a = a + 1 if a >= 0 and decls[0] - a < 120 else decls[0]
    b = s.index('\n}\n', decls[0]) + 3
    s = s[:a] + s[b:]
# icons from the registry (identical markup)
s = s.replace('''editBtn.innerHTML = '<svg class="ico ico--sm" data-icon="pencil" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3l7.5-7.5Z"/></svg>';''',
              "editBtn.innerHTML = Organica.icons.get('pencil', { size: 'sm' });")
s = s.replace('''<svg class="ico ico--sm" data-icon="close" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`;''',
              "${Organica.icons.get('close', { size: 'sm' })}</button>`;")
open(p, 'w', encoding='utf-8').write(s)
PY
rm -rf fvs/js fvs/fvs.css
node scripts/fvs-split.mjs
node scripts/fvs-modules.mjs
python3 scripts/templates.py >/dev/null
python3 scripts/check.py | tail -1
scripts/regression.sh
scripts/test-fvs-qa.sh
echo "Re-synced from $REF — review: git status && git diff --stat"
