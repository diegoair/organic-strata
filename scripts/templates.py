#!/usr/bin/env python3
"""
Organica page templates — inventory + skeleton lint.

    python3 scripts/templates.py            regenerate design-system/templates.json
    python3 scripts/templates.py --check    lint every page's skeleton against its template and
                                            fail if templates.json is out of date (run by check.py)
    python3 scripts/templates.py --list     print the inventory

Three templates (decided Oct 2, 2026 — docs/DESIGN-DECISIONS.md):

  tool        header · floatbar · #app (surface + #panel on the right), on shell.css.
              Starter: shared/_template.html, linted here with the same rules.
              Variant "own surface": the same chrome, no shell.css (listed in OWN_SURFACE).
  page        header + one scrolling column, on page.css (body.org-page > .org-page__col).
              Variant "own layout": the hub and the design-system reference (OWN_LAYOUT).
  auth-card   the sign-in card, on auth-card.css.

The page list is never typed anywhere: /design-system/#templates renders templates.json, and
check.py fails when the committed JSON differs from what the pages really are. A deliberate
deviation is an entry in OWN_SURFACE / OWN_LAYOUT / ALLOW below, with its reason — and a line in
docs/DESIGN-DECISIONS.md §3. An entry added only to make the check pass is the failure mode.
"""
import json, os, re, subprocess, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = 'design-system/templates.json'
STARTER = 'shared/_template.html'

SKIP = re.compile(r'^(explorations|archive|scratchpad|\.claude|genesis/archive|figma-plugin|docs)/|(^|/)_')

# The sheets a template is made of, in load-bearing order (each may override the one before).
ORDER = ['tokens', 'icons', 'header', 'page', 'prose', 'auth-card', 'fvs-field', 'panel', 'floatbar', 'shell',
         'palette', 'seeds-panel', 'mobile-gate']      # scripts/css-lint.py keeps the same list

OWN_SURFACE = {   # tool chrome, own canvas surface — no shell.css
    'apostate': 'three-column board (character picker · glyph · panel)',
    'fvs': 'a step-nav row above #app and its own gallery / symbol surfaces',
    'rhizome': 'an infinite node canvas, no sheet',
    'genesis': 'library grid + Paper.js artboard; retiring, left alone by decision',
}
OWN_LAYOUT = {    # page chrome, own layout (the hub links page.css for the footer, the design system for its specimens)
    '': 'the hub: a stipple hero, a gallery and full-bleed sections',
    'design-system': 'the reference layout: a 232px section nav beside the content',
}
ALLOW = {         # (page, rule) -> why this deviation is deliberate
    ('rhizome', 'tail-scripts'): 'native ES modules: every shared script loads in <head>, before the module graph',
    ('genesis', 'app'): 'retiring — left alone by decision',
    ('genesis', 'floatbar-child'): 'retiring — left alone by decision',
    ('genesis', 'panel-last'): 'retiring — left alone by decision',
    ('genesis', 'tail-scripts'): 'retiring — left alone by decision',
}

PUBLIC = {'sign-in', 'privacy', 'terms'}      # shared/auth.js's own public list

VOID = {'meta', 'link', 'input', 'br', 'img', 'hr', 'source', 'path', 'circle', 'rect', 'line',
        'ellipse', 'polygon', 'polyline', 'use', 'stop', 'col', 'wbr', 'area', 'base', 'embed', 'track'}


class Skeleton(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.elems = [], []
        self.html, self.body = {}, {}
        self.sheets, self.scripts, self.head_scripts = [], [], []
        self.body_children, self.app_children = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag == 'html': self.html = a
        if tag == 'body': self.body = a
        if tag == 'link' and a.get('rel') == 'stylesheet': self.sheets.append(a.get('href', ''))
        in_head = any(t == 'head' for t, _, _ in self.stack)
        if tag == 'script':
            src = a.get('src') or ('<inline module>' if a.get('type') == 'module' else '<inline>')
            self.scripts.append((src, a.get('type', '')))
            if in_head and a.get('src'): self.head_scripts.append(a['src'])
        parent = self.stack[-1] if self.stack else None
        node = (tag, a, cls)
        if parent and parent[0] == 'body' and tag != 'script': self.body_children.append(node)
        if parent and parent[1].get('id') == 'app': self.app_children.append(node)
        self.elems.append((tag, a, cls, [p for p in self.stack]))
        if tag not in VOID: self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack: self.stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break


def parse(path):
    src = open(path, encoding='utf-8', errors='replace').read()
    body = re.sub(r'<!--.*?-->', '', src, flags=re.S)
    body = re.sub(r'(<script[^>]*>).*?(</script>)', r'\1\2', body, flags=re.S)   # JS template strings are not markup
    body = re.sub(r'(<style[^>]*>).*?(</style>)', r'\1\2', body, flags=re.S)
    p = Skeleton()
    p.feed(body)
    p.src = src
    return p


def pages():
    out = []
    for f in subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '*.html'],
                            capture_output=True, text=True).stdout.split():
        if SKIP.search(f) or not os.path.exists(f): continue
        if not (f in ('index.html', '404.html') or f.endswith('/index.html')): continue
        src = open(f, errors='replace').read()
        if len(src) < 3000 and re.search(r'http-equiv="refresh"|location\.replace', src): continue   # thin redirects
        out.append(f)
    return sorted(out)


def name_of(f):
    return '' if f == 'index.html' else f.rsplit('/', 1)[0] if '/' in f else f[:-5]


def sheet(href):
    m = re.match(r'/shared/([a-z-]+)\.css$', href)
    return m.group(1) if m else None


def describe(f):
    """-> the inventory row of one page."""
    p = parse(f)
    name = name_of(f)
    sheets = [s for s in (sheet(h) for h in p.sheets) if s]
    has = lambda pred: [e for e in p.elems if pred(e)]
    by_id = lambda i: has(lambda e: e[1].get('id') == i)
    by_cls = lambda c: has(lambda e: c in e[2])

    if f == STARTER: template, variant = 'tool', 'starter'
    elif name in OWN_LAYOUT: template, variant = 'page', 'own layout'
    elif name in OWN_SURFACE: template, variant = 'tool', 'own surface'
    elif 'page' in sheets or 'org-page' in (p.body.get('class') or '').split(): template, variant = 'page', None
    elif 'auth-card' in sheets: template, variant = 'auth-card', None
    elif 'shell' in sheets or by_id('app') or by_id('panel'): template, variant = 'tool', None
    else: template, variant = 'page', None

    surface = None
    for tag, a, cls in ([] if variant == 'own surface' else p.app_children):
        if a.get('id') != 'panel':
            surface = '#' + a['id'] if a.get('id') else '.' + '.'.join(cls) if cls else tag
            if 'org-canvas-wrap' in cls and a.get('id') != 'canvas-wrap': surface += ' (.org-canvas-wrap)'
            break
    stage = by_cls('org-stage')
    hdr_buttons = [e for e in p.elems if e[0] == 'button' and any('org-header__actions' in pc for _, _, pc in e[3])
                   and not any('org-popover' in pc for _, _, pc in e[3])]
    row = {
        'page': '/' + f if '/' not in f and f != 'index.html' else '/' + (name + '/' if name else ''),
        'file': f,
        'template': template,
        'variant': variant,
        'why': OWN_SURFACE.get(name) if variant == 'own surface' else OWN_LAYOUT.get(name) if variant == 'own layout' else None,
        'sheets': sheets,
        'modules': any(t == 'module' for _, t in p.scripts),
        'dark': 'data-theme-support' in p.html,
        'public': 'ORGANICA_PUBLIC' in p.src or not any('auth.js' in s for s, _ in p.scripts) or name in PUBLIC,
    }
    if template == 'tool':
        row.update({
            'surface': surface,
            'stage': ('#' + stage[0][1]['id']) if stage and stage[0][1].get('id') else None,
            'floatbar': bool(by_cls('org-floatbar')),
            'headerActions': len(hdr_buttons),
        })
    if template == 'page':
        col = [] if variant else by_cls('org-page__col')      # an own-layout page has no column of its own
        row['column'] = ('full' if 'org-page__col--full' in col[0][2] else 'wide' if 'org-page__col--wide' in col[0][2] else 'reading') if col else None
        row['prose'] = bool(by_cls('org-prose'))
    return row, p


def lint(f, row, p):
    """-> [(rule, message)] — skeleton rules of the page's template."""
    out = []
    name = name_of(f) if f != STARTER else '_template'
    sheets = row['sheets']

    def bad(rule, msg):
        if (name, rule) not in ALLOW: out.append((rule, f'{f}: {msg}'))

    # every template
    if not row['dark']: bad('theme', '<html> has no data-theme-support — every page opts in to dark mode')
    ranks = [ORDER.index(s) for s in sheets if s in ORDER]
    if ranks != sorted(ranks): bad('sheet-order', f'shared sheets out of order: {" > ".join(sheets)} (expected {" > ".join(s for s in ORDER if s in sheets)})')
    card = row['template'] == 'auth-card'      # the card stands alone: no header, no menu
    for need in ('tokens', 'icons') + (() if card else ('header',)):
        if need not in sheets: bad('sheets', f'does not link {need}.css')
    if not any(s.endswith('/pattern-init.js') for s in p.head_scripts): bad('pattern-init', 'pattern-init.js must load in <head> (theme and canvas pattern before first paint)')
    tail = [s.rsplit('/', 1)[-1] for s, _ in p.scripts if s.startswith('/shared/')][-3:]
    if not card and tail != ['tools.js', 'menu-icon.js', 'header.js']: bad('tail-scripts', f'the last shared scripts must be tools.js > menu-icon.js > header.js (found {" > ".join(tail)})')
    if not card and not any('org-header' in c for _, _, c in p.body_children): bad('header', 'no <header class="org-header"> as a child of <body>')

    if row['template'] == 'tool':
        own = row['variant'] == 'own surface'
        for need in ('panel', 'floatbar', 'mobile-gate') + (() if own else ('shell',)):
            if need not in sheets: bad('sheets', f'a tool links {need}.css')
        if own and 'shell' in sheets: bad('sheets', 'listed as own-surface but links shell.css — remove it from OWN_SURFACE')
        if 'page' in sheets: bad('sheets', 'a tool never links page.css')
        first = p.body_children[0] if p.body_children else None
        if not first or 'mobile-gate' not in first[2]: bad('mobile-gate-first', '.mobile-gate must be the first child of <body>')
        if not any('org-floatbar' in c for _, _, c in p.body_children): bad('floatbar-child', '.org-floatbar must be a direct child of <body>')
        if not p.app_children: bad('app', 'no #app with static children')
        elif p.app_children[-1][1].get('id') != 'panel': bad('panel-last', '#panel must be the last child of #app (the panel is on the right)')
        if not own and f != STARTER and not any(a.get('id') == 'canvas-wrap' or 'org-canvas-wrap' in c for _, a, c in p.app_children):
            bad('surface', 'the surface must be #canvas-wrap or carry class="org-canvas-wrap" — a local copy of the canvas region drifts (or list the page in OWN_SURFACE)')
        if row.get('headerActions'):
            bad('header-actions', f"{row['headerActions']} action button(s) in the header — a tool's header is identity only; Open, playback, Export and view toggles live in the floatbar")

    if f == '404.html' and any('auth.js' in s for s, _ in p.scripts):
        bad('public', 'the 404 never loads auth.js — a signed-out visitor with a wrong link must see it, not the sign-in')
    if row['template'] == 'page' and row['variant'] is None:
        if 'page' not in sheets: bad('sheets', 'a page links page.css')
        if 'shell' in sheets: bad('sheets', 'a page never links shell.css — it pins <body> to the viewport and the page cannot scroll')
        if 'org-page' not in (p.body.get('class') or '').split(): bad('page-body', '<body> needs class="org-page"')
        if row.get('column') is None: bad('page-col', 'no .org-page__col column')
    return out


def build():
    rows, problems = [], []
    for f in pages():
        row, p = describe(f)
        rows.append(row)
        problems += lint(f, row, p)
    srow, sp = describe(STARTER)
    problems += lint(STARTER, srow, sp)
    data = {
        '$generated': 'by scripts/templates.py from the pages themselves — do not edit by hand',
        'order': ORDER,
        'templates': {
            'tool': {'starter': '/' + STARTER, 'skeletonSheet': 'shell.css',
                     'pages': [r for r in rows if r['template'] == 'tool']},
            'page': {'starter': None, 'skeletonSheet': 'page.css',
                     'pages': [r for r in rows if r['template'] == 'page']},
            'auth-card': {'starter': None, 'skeletonSheet': 'auth-card.css',
                          'pages': [r for r in rows if r['template'] == 'auth-card']},
        },
        'allow': [{'page': k[0], 'rule': k[1], 'why': v} for k, v in sorted(ALLOW.items())],
    }
    return data, problems


def main():
    data, problems = build()
    text = json.dumps(data, indent=1, ensure_ascii=False) + '\n'
    if '--list' in sys.argv:
        for t, d in data['templates'].items():
            print(f"\n{t} — {len(d['pages'])} page(s)")
            for r in d['pages']:
                extra = r.get('surface') or r.get('column') or ''
                print(f"  {r['page']:18} {r['variant'] or '':12} {extra}")
        return
    if '--check' in sys.argv:
        for _, msg in problems: print('  ✗', msg)
        stale = not os.path.exists(OUT) or open(OUT, encoding='utf-8').read() != text
        if stale: print(f'  ✗ {OUT} is out of date — run: python3 scripts/templates.py')
        n = {t: len(d['pages']) for t, d in data['templates'].items()}
        if not problems and not stale:
            print(f"  ✓ {n['tool']} tool · {n['page']} page · {n['auth-card']} auth-card pages match their template; starter linted; {OUT} current")
        sys.exit(1 if problems or stale else 0)
    open(OUT, 'w', encoding='utf-8').write(text)
    print(f'wrote {OUT}')
    for _, msg in problems: print('  ✗', msg)


if __name__ == '__main__':
    main()
