#!/usr/bin/env python3
"""
Organica CSS lint — the regression test for the September 2026 cleanup.

Run from the repo root:   python3 scripts/css-lint.py
Exit code 1 if any check fails, so it can gate a commit.

Every check here exists because the audit found that exact bug. The rules it
enforces are written out in docs/CSS-RULES.md; this file is the executable
half. When a check fires, the fix is in the rule it names — not an entry in
the ALLOW list, unless the divergence is genuinely deliberate and explained.
"""

import re, sys, glob, os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# Pages that are tools (canvas + panel). Legal/auth/docs pages are excluded
# from the tool-shaped checks on purpose — see docs/CSS-RULES.md (a).
EXCLUDE_DIRS = {'.claude', 'node_modules', 'explorations', 'figma-plugin',
                'docs', 'shared', 'scratchpad', 'scripts'}
NON_TOOL_PAGES = {'privacy/index.html', 'terms/index.html', 'sign-in/index.html',
                  'admin/index.html', 'design-system/index.html', 'index.html'}

def tool_pages():
    out = []
    for p in sorted(glob.glob('*/index.html')):
        if p.split('/')[0] in EXCLUDE_DIRS: continue
        if p in NON_TOOL_PAGES: continue
        out.append(p)
    return out

def all_pages():
    return [p for p in sorted(glob.glob('*/index.html') + ['index.html'])
            if p.split('/')[0] not in EXCLUDE_DIRS]

def styles(src):
    """Every tool-local <style> block's contents."""
    return re.findall(r'<style[^>]*>(.*?)</style>', src, re.S)

def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)

def selectors(css):
    for chunk in re.findall(r'([^{}]+)\{', strip_comments(css)):
        if '@' in chunk: continue
        for part in chunk.split(','):
            s = part.strip()
            if s: yield s

failures = []      # regressions — these fail the run
debts = []         # known, deliberately deferred — reported, never blocking
def fail(check, msg):
    failures.append((check, msg))
def debt(check, msg):
    debts.append((check, msg))

# Deliberately deferred, with the decision recorded. Reported every run so it
# stays visible, but does not fail — a lint that is green only because
# everything is allow-listed tells you nothing.
KNOWN_DEBT = {
    'genesis/index.html': 'local re-implementation of panel.css (~47 selectors) '
                          'and its off-scale radii — deferred by explicit scope '
                          'decision, Sep 2026. See CLAUDE.md.',
}

# ── 1. No tool-local rule may shadow a shared class name ──────────────
# The single most important check. A local rule under a shared class name
# either duplicates it (dead weight) or half-overrides it (silent coupling —
# this is what mote's preset picker was doing). If a tool's component is
# genuinely different, it gets a tool prefix. See CSS-RULES.md (b) and (d).
ALLOW_SHADOW = {
    # 'page': {'class': 'why this override is deliberate'}
    # An entry here is a claim that the tool is VARYING a shared component on
    # purpose, not redefining it. Adding one to silence the check without that
    # being true is the failure mode this list has to resist.
    'colornet/index.html': {
        'icon-btn': "borderless ghost variant; sized via the component's own "
                    '--icon-btn-w/h tuning vars, only real deltas kept',
        'org-layer-card': 'single-property delta (--radius-sm), not a redefinition',
    },
    'tunesutra/index.html': {
        'rmx-color': 'sized purely through the documented --rmx-cell-* tuning vars',
        'rmx-x': 'genuine visual variant — repositioned, translucent, borderless',
        'rmx-add': 'genuine visual variant — 30x26 dashed add-chip',
        'seg-btn': ':disabled state only, not a redefinition',
    },
    'membrane/index.html': {'upload-btn': 'bottom-margin delta only'},
    'pollen/index.html': {
        'shape-thumb': 'different component: .selected state + a hover the '
                       'shared rule has not; pollen does not link seeds-panel.css',
        'thumb-num': 'ditto',
        'upload-btn': 'margin/size deltas only',
        'panel-select': ':focus state delta only',
    },
    'spore/index.html': {
        'thumb-num': 'own .mark-thumb component; does not link seeds-panel.css',
        'upload-btn': 'size/tracking deltas only',
    },
    'mote/index.html': {
        'panel-note': 'offline-render note spacing delta',
        'org-stage': 'adds the :not(.visible) hidden state, which shell.css '
                     'does not define (it only defines .visible)',
        'visible': 'ditto — part of the same :not() selector',
    },
    # Living Path and Sinew share one lineage; both entries are the same two
    # cases. `.row .ctrl-label` narrows the label column for this panel's
    # longer words — a scoped override that reads as a redefinition only
    # because BOTH class names happen to be shared ones.
    # `.hint` is a standalone hint paragraph; panel.css only styles .hint
    # scoped inside a section h3, so this is a local component, not an
    # override. Two consumers — under rule (d) that is one short of promotion,
    # so it stays local until a third tool wants it.
    'livingpath/index.html': {
        'row': 'scoped override: .row .ctrl-label label column width',
        'ctrl-label': 'ditto',
        'hint': 'standalone hint paragraph; panel.css only scopes .hint inside '
                'a section h3. Promotion candidate at a third consumer.',
    },
    'sinew/index.html': {
        'row': 'scoped override: .row .ctrl-label label column width',
        'ctrl-label': 'ditto',
        'hint': 'standalone hint paragraph — see livingpath',
    },
    'genesis/index.html': {
        'upload-btn': 'softer hover + bottom margin', 'type-pill': 'local',
        'org-floatbar__btn': 'aria-pressed active fill', 'read-only-note': 'local',
        'seg-btn': 'part of the local panel implementation (KNOWN_DEBT)',
        'seg': 'ditto', 'panel-section': 'ditto', 'panel-section__title': 'ditto',
        'panel-label': 'ditto', 'panel-input': 'ditto', 'panel-input--full': 'ditto',
        'panel-input-group': 'ditto', 'panel-unit': 'ditto', 'panel-hint': 'ditto',
    },
}

shared_classes = set()
for f in glob.glob('shared/*.css'):
    shared_classes |= set(re.findall(r'\.([a-z][a-z0-9_-]*)', strip_comments(open(f).read())))

def is_redefinition(sel):
    """True only if the selector reaches shared classes with nothing of the
    tool's own anchoring it.

    `.hint {}` redefines the shared component for the whole page — a bug.
    `.fvs-cell-group .ctrl-row {}` scopes it inside something this tool owns,
    and `#canvas-wrap.drag-over {}` anchors on an id — both are the supported
    way to vary a shared component locally, so neither is reported.
    """
    if not re.search(r'\.[a-z]', sel):          # no class at all
        return False
    if '#' in sel or '[' in sel:                # id- or attribute-anchored
        return False
    classes = re.findall(r'\.([a-z][a-z0-9_-]*)', sel)
    if not any(c in shared_classes for c in classes):
        return False
    # any class the shared sheets do NOT own is this tool's own anchor
    return all(c in shared_classes for c in classes)

# which sheet owns each class, so only a real collision is reported
CLASS_SHEET = {}
for f in glob.glob('shared/*.css'):
    sheet = os.path.basename(f)[:-4]
    for cls in set(re.findall(r'\.([a-z][a-z0-9_-]*)', strip_comments(open(f).read()))):
        CLASS_SHEET.setdefault(cls, set()).add(sheet)

for page in all_pages():
    src = open(page, errors='ignore').read()
    linked = set(re.findall(r'/shared/([a-z-]+)\.css', src))
    allowed = ALLOW_SHADOW.get(page, {})
    seen = set()
    for block in styles(src):
        for sel in selectors(block):
            if not is_redefinition(sel): continue
            for cls in re.findall(r'\.([a-z][a-z0-9_-]*)', sel):
                if cls not in shared_classes or cls in allowed or cls in seen:
                    continue
                # a name only collides if this page actually loads the sheet
                # that defines it — admin's own .row is not a shadow, it never
                # links panel.css
                if not (CLASS_SHEET.get(cls, set()) & linked):
                    continue
                seen.add(cls)
                (debt if page in KNOWN_DEBT else fail)(
                    'shadow', f'{page}: redefines shared .{cls}   ({sel[:60]})')

# ── 2. A tool may not redeclare a palette token at its own default ────
DEFAULTS = {'--ink': '#0a0a0a', '--paper': '#ffffff', '--mid': '#696256',
            '--accent': '#2a2a2a', '--panel': '#eceae4', '--border': '#d0c8b8'}
for page in all_pages():
    # only the tool's own <style> — a docs page may legitimately PRINT a token
    # value as content, and that is not a redeclaration.
    css = '\n'.join(styles(open(page, errors='ignore').read()))
    for tok, val in DEFAULTS.items():
        if re.search(re.escape(tok) + r'\s*:\s*' + re.escape(val) + r'\s*;', css, re.I):
            fail('token-noise', f'{page}: redeclares {tok} at its tokens.css default ({val})')

# ── 3. Every tool links the shared sheets in the documented order ─────
ORDER = ['tokens', 'header', 'panel', 'floatbar', 'shell', 'palette', 'seeds-panel', 'mobile-gate']
for page in all_pages():
    src = open(page, errors='ignore').read()
    got = re.findall(r'<link rel="stylesheet" href="/shared/([a-z-]+)\.css">', src)
    ranks = [ORDER.index(g) for g in got if g in ORDER]
    if ranks != sorted(ranks):
        fail('load-order', f'{page}: shared sheets out of order -> {got}')

# ── 4. Every tool ships the mobile gate ───────────────────────────────
for page in tool_pages():
    src = open(page, errors='ignore').read()
    if 'mobile-gate.css' not in src:
        fail('mobile-gate', f'{page}: does not link mobile-gate.css')
    elif 'class="mobile-gate"' not in src:
        fail('mobile-gate', f'{page}: links mobile-gate.css but has no .mobile-gate div')

# ── 5. Uses a shared class but does not link the sheet that owns it ───
# This is the check that would have caught colornet's unstyled .icon-btn on
# the day it landed. See CSS-RULES.md (d).
OWNER = {}
for f in glob.glob('shared/*.css'):
    sheet = os.path.basename(f)[:-4]
    for cls in re.findall(r'^\.([a-z][a-z0-9_-]*)', strip_comments(open(f).read()), re.M):
        OWNER.setdefault(cls, sheet)
OPTIONAL = {'palette', 'seeds-panel', 'mobile-gate'}
for page in all_pages():
    src = open(page, errors='ignore').read()
    linked = set(re.findall(r'/shared/([a-z-]+)\.css', src))
    used = set(re.findall(r'class="([^"]+)"', src))
    flat = set()
    for u in used: flat |= set(u.split())
    for cls in sorted(flat):
        owner = OWNER.get(cls)
        if owner in OPTIONAL and owner not in linked:
            # only report if the page has no local rule for it either
            if not any(re.search(r'\.' + re.escape(cls) + r'\b', strip_comments(b)) for b in styles(src)):
                fail('missing-sheet', f'{page}: uses .{cls} (owned by {owner}.css) without linking it')

# ── 6. Retired tokens must stay retired ───────────────────────────────
for name in ('--sans', '--mono', '--display', '--fs-display', '--lh-tight', '--ls-tight'):
    hits = []
    for f in glob.glob('*/index.html') + glob.glob('shared/*.css') + ['index.html']:
        if f.split('/')[0] in EXCLUDE_DIRS: continue
        if re.search(r'var\(\s*' + re.escape(name) + r'\s*\)', open(f, errors='ignore').read()):
            hits.append(f)
    if hits:
        fail('retired-token', f'{name} was retired but is still used in: {", ".join(hits)}')

# ── 7. Radius values must sit on the 2/4/8 scale ──────────────────────
# A radius equal to half the element's own height is a stadium/pill, not a
# corner — CLAUDE.md carves that out explicitly, and it cannot be told apart
# from a mistake by reading the value alone. Those are listed here with the
# element they cap; everything else off the scale means nobody chose it.
ALLOW_RADIUS = {
    ('camo-turing/index.html', 9): '.toggle-slider on an 18px track — stadium',
    ('design-system/index.html', 3): '::-webkit-scrollbar-thumb on a 6px bar — stadium',
    ('shared/panel.css', 3): 'scrollbar thumb — stadium',
}
for f in glob.glob('shared/*.css') + all_pages():
    src = open(f, errors='ignore').read()
    # tool pages: only their own <style>. Scanning the whole file made the
    # design-system page fail on a radius quoted inside its own documentation.
    css = src if f.endswith('.css') else '\n'.join(styles(src))
    for m in re.finditer(r'border-radius:\s*([0-9]+)px', strip_comments(css)):
        px = int(m.group(1))
        if px >= 12 or px in (0, 1, 2, 4, 8): continue
        if (f, px) in ALLOW_RADIUS: continue
        (debt if f in KNOWN_DEBT else fail)(
            'radius', f'{f}: border-radius {px}px is off the 2/4/8 scale')

# ── report ────────────────────────────────────────────────────────────
def show(items, title):
    if not items: return
    by = {}
    for check, msg in items: by.setdefault(check, []).append(msg)
    print(title)
    for check in sorted(by):
        print(f'  [{check}]  {len(by[check])}')
        for m in by[check]: print('    ' + m)

show(debts, '\nKNOWN DEBT (deferred by decision, not blocking):')
for page, why in KNOWN_DEBT.items():
    print(f'    note: {page} — {why}')

if not failures:
    print('\ncss-lint: clean')
    sys.exit(0)

by_check = {}
for check, msg in failures:
    by_check.setdefault(check, []).append(msg)
for check in sorted(by_check):
    print(f'\n[{check}]  {len(by_check[check])} issue(s)')
    for m in by_check[check]:
        print('  ' + m)
print(f'\ncss-lint: {len(failures)} issue(s). See docs/CSS-RULES.md.')
sys.exit(1)
