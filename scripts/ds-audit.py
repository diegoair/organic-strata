#!/usr/bin/env python3
"""
Organica design-system audit — the measuring instrument of the design-system agent
(.claude/agents/design-system.md). It REPORTS; it decides nothing and edits nothing.

    python3 scripts/ds-audit.py                 full report: registry drift + raw values per page
    python3 scripts/ds-audit.py --tool fvs      every raw value in one page / sheet, with line numbers
    python3 scripts/ds-audit.py --diff [REF]    only lines added since REF (default HEAD) + untracked
                                                files. Exit 1 if the change introduces raw values.
    python3 scripts/ds-audit.py --json          the full report as JSON
    python3 scripts/ds-audit.py --uses NAME     who uses a class, token, icon or Organica.* API, per file

css-lint.py (blocking, in scripts/check.py) guards the structural rules: shadowed shared classes,
load order, off-scale radii, raw hex in shared sheets. This script covers what that one does not:

  REGISTRY   tokens.css <-> tokens.json <-> docs/DESIGN-SYSTEM.md <-> design-system/index.html
             (undocumented tokens, tokens nobody uses, colour tokens with no dark value, tokens.json
             values that tokens.css no longer has, tool accents the doc does not list, shared
             components the live reference does not show)
  RAW VALUES every literal where a token exists, in tool-local <style>, inline style="" and the
             shared sheets: font-size, font-weight, font-family, hex, radius, spacing, motion.

The existing pages carry legacy debt, so the full report is a map, not a gate. `--diff` is the
gate: a change may not ADD debt. Categories marked (judge) need a human reading — a hex can be a
tool's own content colour, an off-scale px can be layout geometry (docs/CSS-RULES.md (c)).
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SKIP_DIRS = ('explorations/', 'archive/', 'scratchpad/', 'docs/', '.claude/', 'node_modules/',
             'figma-plugin/', 'scripts/', 'shared/vendor/')
KNOWN_DEBT = {'genesis/index.html': 'retiring — left alone by decision (Oct 2, 2026)'}
SPACE_SCALE = {4, 6, 8, 10, 14, 16, 24, 32}          # --space-1 … --space-8
STRICT = ('font-size', 'font-weight', 'font-family', 'radius', 'space', 'motion')   # a token always exists
JUDGE = ('hex', 'space-off')                           # may be content colour / layout geometry
CATS = STRICT + JUDGE


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout


# _-prefixed pages that are references for people, not dev tools: audited like any page (Diego, Oct 7, 2026, O-28).
# scripts/check-apostrophes.mjs keeps the same list.
SCANNED_DEV_PAGES = ('design-system/_fvs-rules.html',)


def tracked(*exts):
    return [f for f in sh('git', 'ls-files').split('\n')
            if f.endswith(exts) and os.path.exists(f) and not f.startswith(SKIP_DIRS)
            and '.min.' not in f and ('/_' not in f or f in SCANNED_DEV_PAGES) and '/archive/' not in f]


def read(f):
    return open(f, encoding='utf-8', errors='replace').read()


# ── raw values ─────────────────────────────────────────────────────────────────
DECL = re.compile(r'(-{0,2}[a-zA-Z][\w-]*)\s*:\s*([^;{}]+)')
VAR = re.compile(r'var\([^()]*\)')


def strip_vars(v):
    prev = None
    while prev != v:
        prev, v = v, VAR.sub('', v)
    return v


def check_decl(prop, val):
    """-> [(category, message)] for one CSS declaration."""
    out = []
    prop = prop.lower()
    raw = strip_vars(val).strip()
    if prop == '--tool':                                   # the one colour a tool declares
        return out
    if prop == 'font-size' and re.search(r'\d(px|rem|em|pt)\b', raw):
        out.append(('font-size', f'font-size: {val.strip()} → --fs-* / --t-*-size'))
    if prop == 'font-weight' and re.search(r'\b(\d{3}|bold|bolder|lighter)\b', raw):
        out.append(('font-weight', f'font-weight: {val.strip()} → --w-*'))
    if prop == 'font-family' and raw and not re.fullmatch(r'(inherit|initial|unset)', raw):
        out.append(('font-family', f'font-family: {val.strip()} → --font / --font-display / --font-mono'))
    if prop.startswith('border') and prop.endswith('radius'):
        for m in re.finditer(r'(?<![\d.])(\d+)px', raw):
            if 2 <= int(m.group(1)) < 12:                  # >=12 is a stadium, 0/1 are not corners
                out.append(('radius', f'{prop}: {val.strip()} → --radius-sm/md/lg'))
                break
    if re.fullmatch(r'(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|inline|block)(-(start|end))?)?', prop):
        px = [int(n) for n in re.findall(r'(?<![\d.\w-])(\d+)px', raw)]
        if any(n in SPACE_SCALE for n in px):
            out.append(('space', f'{prop}: {val.strip()} → --space-*'))
        elif any(n > 2 for n in px):
            out.append(('space-off', f'{prop}: {val.strip()} (off the spacing scale — geometry or a missing step?)'))
    if prop in ('transition', 'animation', 'transition-duration', 'animation-duration',
                'transition-timing-function', 'animation-timing-function', 'transition-delay', 'animation-delay'):
        why = []
        durs = [d for d in re.findall(r'(?<![\w.-])(\d*\.?\d+m?s)\b', raw) if d not in ('0s', '0ms', '1ms')]   # 1ms = the reduced-motion collapse
        if durs: why.append('raw duration → --dur-*')
        if 'cubic-bezier' in raw: why.append('raw easing → --ease-*')
        if prop == 'transition' and re.match(r'all\b', raw): why.append('transition: all → list the properties')
        if why:
            out.append(('motion', f'{prop}: {val.strip()} — ' + '; '.join(why)))
    for h in re.findall(r'#[0-9a-fA-F]{3,8}\b', raw):
        out.append(('hex', f'{prop}: {h} (judge: chrome → token; content colour is fine)'))
    return out


def scan(path):
    """-> [(line, category, message)] for one page, sheet or script."""
    text = read(path)
    is_css = path.endswith('.css')
    is_js = path.endswith('.js')
    found, in_style, in_comment = [], is_css, False
    for i, line in enumerate(text.split('\n'), 1):
        chunks = []
        if not is_css and not is_js:
            if re.search(r'<style\b', line, re.I): in_style = True
        if in_style:
            body = line
            if not is_css:
                body = re.sub(r'^.*?<style[^>]*>', '', body, flags=re.I) if '<style' in body.lower() else body
                body = re.sub(r'</style>.*$', '', body, flags=re.I)
            # comments (possibly multi-line)
            clean = ''
            while body:
                if in_comment:
                    end = body.find('*/')
                    if end < 0: body = ''
                    else: body, in_comment = body[end + 2:], False
                else:
                    start = body.find('/*')
                    if start < 0: clean, body = clean + body, ''
                    else: clean, body, in_comment = clean + body[:start], body[start + 2:], True
            chunks.append(clean)
        else:
            chunks += re.findall(r'style\s*=\s*"([^"]*)"', line)       # inline style, in markup or in a JS template
            chunks += re.findall(r"style\s*=\s*'([^']*)'", line) if not is_js else []
        if not is_css and not is_js and re.search(r'</style>', line, re.I): in_style = False
        for chunk in chunks:
            if '${' in chunk:                                           # a computed value, not a literal
                chunk = re.sub(r'\$\{[^}]*\}', 'var(--computed)', chunk)
            for m in DECL.finditer(chunk):
                for cat, msg in check_decl(m.group(1), m.group(2)):
                    found.append((i, cat, msg))
    return found


def is_own_sheet(f):
    """A tool's own sheet, named after it: <tool>/<tool>.css (fvs/fvs.css, split out of fvs/index.html,
    Oct 2026). It is that page's <style>, moved — audited like it, and its --tool counts as declared."""
    d = f.split('/')[0]
    return f == f'{d}/{d}.css' and d != 'shared'


def page_style(f):
    """A page's text plus its own sheet, if it has one."""
    d = f.split('/')[0]
    own = f'{d}/{d}.css'
    return read(f) + ('\n' + read(own) if f.endswith('/index.html') and os.path.exists(own) else '')


def targets():
    pages = [f for f in tracked('.html') if f == 'index.html' or f.endswith('/index.html')]
    sheets = [f for f in tracked('.css') if f.startswith('shared/') and f != 'shared/tokens.css']
    sheets += [f for f in tracked('.css') if is_own_sheet(f)]
    scripts = [f for f in tracked('.js') if not f.startswith('shared/vendor/')]
    return sorted(pages) + sorted(sheets) + sorted(scripts)


def added_lines(ref):
    """{path: set(line numbers) | None}  — None = the whole file is new."""
    out = {}
    cur = None
    for line in sh('git', 'diff', ref, '-U0', '--no-color', '--', '*.html', '*.css', '*.js').split('\n'):
        if line.startswith('+++ '):
            cur = line[6:] if line.startswith('+++ b/') else None
            if cur: out.setdefault(cur, set())
        elif line.startswith('@@') and cur:
            m = re.search(r'\+(\d+)(?:,(\d+))?', line)
            start, n = int(m.group(1)), int(m.group(2) or 1)
            out[cur] |= set(range(start, start + n))
    for f in sh('git', 'ls-files', '--others', '--exclude-standard').split('\n'):
        if f.endswith(('.html', '.css', '.js')): out[f] = None
    return out


# ── registry ───────────────────────────────────────────────────────────────────
def css_blocks(css):
    """Innermost rule blocks as (selector context, body)."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, stack, buf = [], [], ''
    for ch in css:
        if ch == '{':
            stack.append(buf.strip()); buf = ''
        elif ch == '}':
            if stack:
                out.append((' » '.join(stack), buf)); stack.pop()
            buf = ''
        else:
            buf += ch
    return out


def expand_doc_names(doc):
    """-> (names, patterns): every token a document names, incl. `--dur-instant/fast/base` and
    `--t-x-size|weight` shorthand; patterns cover `--t-<role>-size|weight` and `--gray-0 … --gray-900`."""
    names = set(re.findall(r'--[a-z][a-z0-9-]*', doc))
    for m in re.finditer(r'(--[a-z][a-z0-9-]*?-)([a-z0-9]+)((?:[/|][a-z0-9-]+)+)', doc):
        for alt in re.split(r'[/|]', m.group(2) + m.group(3)):
            names.add(m.group(1) + alt)
    pats = []
    for m in re.finditer(r'(--[a-z][a-z0-9-]*-)<[a-z]+>-([a-z0-9]+(?:[/|][a-z0-9]+)*)', doc):
        pats.append(re.compile(re.escape(m.group(1)) + r'[a-z0-9-]+-(' + '|'.join(re.split(r'[/|]', m.group(2))) + r')$'))
    for m in re.finditer(r'(--[a-z][a-z0-9-]*-)[a-z0-9]+`?\s*(?:…|\.\.\.)\s*`?\1[a-z0-9]+', doc):
        pats.append(re.compile(re.escape(m.group(1)) + r'[a-z0-9]+$'))
    return names, pats


JSON_MAP = [  # tokens.json path prefix -> tokens.css name prefix
    ('weight.', '--w-'), ('size.', '--fs-'), ('tracking.', '--ls-'), ('lineHeight.', '--lh-'),
    ('space.', '--space-'), ('radius.', '--radius-'), ('icon.', '--icon-'),
    ('motion.duration.', '--dur-'), ('motion.easing.', '--ease-'),
]
JSON_ONE = {'color.borderStrong': '--border-strong', 'color.mid': '--mid', 'layout.rowHeight': '--row-h'}
kebab = lambda t: re.sub(r'([a-z])([A-Z])', r'\1-\2', t).lower()


def registry():
    r = {}
    tok_css = read('shared/tokens.css')
    blocks = css_blocks(tok_css)
    decl = {}                                   # name -> [(selector, value)]
    for sel, body in blocks:
        for m in re.finditer(r'(--[a-z][a-z0-9-]*)\s*:\s*([^;]+);', body):
            decl.setdefault(m.group(1), []).append((sel, m.group(2).strip()))
    r['tokens'] = len(decl)

    # 1. documented?
    doc = read('docs/DESIGN-SYSTEM.md')
    live = read('design-system/index.html')
    doc_names, doc_pats = expand_doc_names(doc)
    families = {re.match(r'--[a-z]+', n).group(0) for n in doc_names}
    r['undocumented'] = sorted(n for n in decl if n not in doc_names and not any(p.match(n) for p in doc_pats))
    r['undocumented_family'] = sorted({re.match(r'--[a-z]+', n).group(0) for n in r['undocumented']} - families)

    # 2. used?
    corpus = '\n'.join(read(f) for f in tracked('.html', '.css', '.js'))
    used = set(re.findall(r'var\(\s*(--[a-z][a-z0-9-]*)', corpus)) | set(re.findall(r"['\"](--[a-z][a-z0-9-]*)['\"]", corpus))
    r['unused'] = sorted(n for n in decl if n not in used)

    # 3. colour literals with no dark value
    colour = lambda v: bool(re.search(r'#[0-9a-fA-F]{3,8}\b|rgba?\(', v)) and 'var(' not in v
    dark = {n for n, ds in decl.items() if any('dark' in s and '.org-stage' not in s for s, _ in ds)}
    r['no_dark'] = sorted(n for n, ds in decl.items() if any(colour(v) for _, v in ds) and n not in dark)

    # 4. tokens.json <-> tokens.css, by name (the JSON calls itself the single source of truth)
    norm = lambda v: re.sub(r'\s+', '', str(v)).lower().strip('\'"')
    first = lambda n: decl[n][0][1]                       # the :root (light) declaration
    leaves = {}

    def walk(o, path):
        if isinstance(o, dict):
            if '$value' in o and not isinstance(o['$value'], dict): leaves['.'.join(path)] = o['$value']
            for k, v in o.items():
                if not k.startswith('$'): walk(v, path + [k])
    walk(json.load(open('shared/tokens.json')), [])
    pages = {f.split('/')[0]: m.group(1).lower() for f in tracked('.html') if f.endswith('/index.html')
             for m in [re.search(r'--tool:\s*(#[0-9a-fA-F]{6})', page_style(f))] if m}
    gone, differ, in_json = [], [], set()
    for path, val in leaves.items():
        if path.startswith('color.accent.'):
            tool = kebab(path.split('.')[-1])
            if tool not in pages: gone.append(f'{path} = {val} — no page declares it (/{tool}/)')
            elif pages[tool] != str(val).lower(): differ.append(f'{path}: json {val} · /{tool}/ runs {pages[tool]}')
            continue
        name = JSON_ONE.get(path) or next((c + kebab(path[len(j):]) for j, c in JSON_MAP if path.startswith(j)), None)
        if not name: continue
        in_json.add(name)
        if name not in decl: gone.append(f'{path} = {val} — tokens.css has no {name}'); continue
        want = 'cubic-bezier(' + ','.join(str(x) for x in val) + ')' if isinstance(val, list) else val
        if norm(want) != norm(first(name)): differ.append(f'{path}: json {val} · css {name}: {first(name)}')
    r['json_gone'], r['json_differ'] = gone, differ
    r['json_missing'] = sorted(n for n in decl if any(n.startswith(c) for _, c in JSON_MAP) and n not in in_json)
    r['json_missing_accent'] = sorted(t for t in pages if t != 'design-system' and
                                      not any(kebab(p.split('.')[-1]) == t for p in leaves if p.startswith('color.accent.')))

    # 5. tool accents the doc does not list
    acc = []
    for f in tracked('.html'):
        if not f.endswith('/index.html') or f.startswith('design-system/'): continue
        m = re.search(r'--tool:\s*(#[0-9a-fA-F]{6})', page_style(f))
        if m and m.group(1).lower() not in doc.lower():
            acc.append(f"{f.split('/')[0]} {m.group(1)}")
    r['accent_undocumented'] = acc

    # 6. shared components the live reference does not show
    comps = set()
    for f in tracked('.css'):
        if f.startswith('shared/'):
            comps |= set(re.findall(r'\.(org-[a-z]+(?:-[a-z]+)*)(?![\w-])', re.sub(r'/\*.*?\*/', '', read(f), flags=re.S)))
    comps = {c for c in comps if '__' not in c}
    r['component_not_in_reference'] = sorted(c for c in comps if c not in live)

    # 7. freshness
    r['doc_last_updated'] = (re.search(r'Last updated:\s*(.+)', doc) or [None, '?'])[1].strip()
    r['tokens_last_commit'] = sh('git', 'log', '-1', '--format=%ad', '--date=format:%B %-d, %Y', '--', 'shared/tokens.css').strip()
    return r


# ── output ─────────────────────────────────────────────────────────────────────
def main():
    args = sys.argv[1:]
    if '--uses' in args:
        name = args[args.index('--uses') + 1].lstrip('.')
        pat = re.compile(r'(?<![\w-])' + re.escape(name) + r'(?![\w-])')
        total = 0
        for f in tracked('.html', '.css', '.js'):
            lines = [i for i, l in enumerate(read(f).split('\n'), 1) if pat.search(l)]
            if lines:
                total += len(lines)
                print(f'  {f:40} {len(lines):>4}   first: {f}:{lines[0]}')
        print(f'{total} line(s) mention "{name}"' if total else f'nothing uses "{name}"')
        return

    if '--tool' in args:
        name = args[args.index('--tool') + 1].strip('/')
        files = [f for f in targets() if f == name or f.startswith(name + '/') or f == f'shared/{name}' or f == f'shared/{name}.css']
        if not files: sys.exit(f'no page or sheet matches "{name}"')
        for f in files:
            hits = scan(f)
            if not hits: continue
            print(f'\n{f} — {len(hits)} raw value(s)')
            for line, cat, msg in hits:
                print(f'  {f}:{line}  [{cat}]  {msg}')
        return

    if '--diff' in args:
        i = args.index('--diff')
        ref = args[i + 1] if len(args) > i + 1 and not args[i + 1].startswith('--') else 'HEAD'
        added = added_lines(ref)
        strict, judge = [], []
        for f, lines in sorted(added.items()):
            if f.startswith(SKIP_DIRS) or not os.path.exists(f) or f == 'shared/tokens.css': continue
            for line, cat, msg in scan(f):
                if lines is None or line in lines:
                    (strict if cat in STRICT else judge).append(f'  {f}:{line}  [{cat}]  {msg}')
        print(f'ds-audit --diff {ref}: {len(added)} changed file(s)')
        if strict: print(f'\nNEW RAW VALUES — a token exists ({len(strict)}):'); print('\n'.join(strict))
        if judge: print(f'\nTO JUDGE — content colour / layout geometry, or chrome? ({len(judge)}):'); print('\n'.join(judge))
        if not strict and not judge: print('  ✓ the change adds no raw values')
        sys.exit(1 if strict else 0)

    reg = registry()
    rows = []
    for f in targets():
        c = dict.fromkeys(CATS, 0)
        for _, cat, _ in scan(f): c[cat] += 1
        if sum(c.values()): rows.append((f, c))
    rows.sort(key=lambda r: -sum(r[1][k] for k in STRICT))

    if '--json' in args:
        print(json.dumps({'registry': reg, 'raw': {f: c for f, c in rows}}, indent=1)); return

    def lst(title, items, cap=40):
        print(f'\n{title}: {len(items)}')
        for x in items[:cap]: print('   ', x)
        if len(items) > cap: print(f'    … +{len(items) - cap} more (--json for all)')

    print('REGISTRY — shared/tokens.css is what the browser runs; everything else must agree with it')
    print(f"  {reg['tokens']} tokens declared · DESIGN-SYSTEM.md says \"Last updated: {reg['doc_last_updated']}\""
          f" · tokens.css last committed {reg['tokens_last_commit']}")
    lst('Tokens docs/DESIGN-SYSTEM.md never names', reg['undocumented'])
    if reg['undocumented_family']: print('    whole families missing:', ', '.join(reg['undocumented_family']))
    lst('Tokens with no consumer (var(--x) nowhere)', reg['unused'])
    lst('Colour tokens with a literal value and no dark override', reg['no_dark'])
    lst('tokens.json: entries for something that no longer exists', reg['json_gone'])
    lst('tokens.json: value differs from what runs', reg['json_differ'])
    lst('tokens.json: tokens.css tokens (scale families) it does not carry', reg['json_missing'])
    lst('tokens.json: tools with no accent entry', reg['json_missing_accent'])
    lst('Tool accents (--tool) missing from DESIGN-SYSTEM.md §5', reg['accent_undocumented'])
    lst('Shared .org-* components the live reference never shows', reg['component_not_in_reference'])

    print('\nRAW VALUES — literals where a token exists (legacy debt map; `--diff` is the gate)')
    head = f"  {'file':34}" + ''.join(f'{c:>12}' for c in CATS)
    print(head); print('  ' + '─' * (len(head) - 2))
    tot = dict.fromkeys(CATS, 0)
    for f, c in rows:
        for k in CATS: tot[k] += c[k]
        note = '  ← known debt' if f in KNOWN_DEBT else ''
        print(f'  {f:34}' + ''.join(f'{c[k] or "·":>12}' for k in CATS) + note)
    print('  ' + '─' * (len(head) - 2))
    print(f"  {'total':34}" + ''.join(f'{tot[k]:>12}' for k in CATS))
    print(f"\n  strict (a token always exists): {sum(tot[k] for k in STRICT)} · to judge: {sum(tot[k] for k in JUDGE)}")
    print('  one page in detail:  python3 scripts/ds-audit.py --tool <folder>')


if __name__ == '__main__':
    main()
