#!/usr/bin/env python3
"""Pre-release checks for Organica. Run: python3 scripts/check.py  (or scripts/check.sh)

Fast, no dependencies beyond python3 + node. Exits 1 on any failure.

  1. vercel.json   — valid JSON, ONLY schema keys (a stray `_comment_*` key silently
                     fails every deployment at config validation — see CLAUDE.md, Sep 7 2026)
  2. JSON files    — tokens.json and any other tracked *.json parse
  3. JS syntax     — every inline <script> in every */index.html, and every tracked .js
                     (modules under a js/ folder are checked as ES modules)
  4. Local refs    — every /shared/... and /genesis/... href/src in an HTML file exists
  4d. templates    — every page's skeleton matches its template; design-system/templates.json is current
  5. icons         — every <svg data-icon> equals its shared/icons.js drawing; no new bare 16-grid <svg>
  6. css-lint      — scripts/css-lint.py must be clean
  7. session log   — docs/SESSION-LOG.md is append-only: never fewer notes than at HEAD
  8. docs          — CLAUDE.md stays small (size budget, ≤ 3 inline session notes); doc paths that do not resolve are reported
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
fails = []


def fail(msg):
    fails.append(msg)
    print("  ✗", msg)


def ok(msg):
    print("  ✓", msg)


def tracked(*exts):
    out = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout.split("\n")
    return [f for f in out if f.endswith(exts) and os.path.exists(f)
            and not f.startswith(("node_modules/", ".claude/"))]


# 1. vercel.json ---------------------------------------------------------------
print("vercel.json")
TOP = {"headers", "rewrites", "redirects", "cleanUrls", "trailingSlash", "routes",
       "buildCommand", "outputDirectory", "installCommand", "framework", "functions",
       "crons", "regions", "github", "images", "devCommand", "ignoreCommand", "public"}
ENTRY = {"headers": {"source", "headers", "has", "missing"},
         "rewrites": {"source", "destination", "has", "missing"},
         "redirects": {"source", "destination", "permanent", "statusCode", "has", "missing"}}
try:
    cfg = json.load(open("vercel.json"))
    bad = [k for k in cfg if k not in TOP]
    if bad:
        fail(f"unknown top-level key(s) {bad} — Vercel rejects these and the deploy fails silently")
    for sect, allowed in ENTRY.items():
        for i, e in enumerate(cfg.get(sect, [])):
            extra = set(e) - allowed
            if extra:
                fail(f"{sect}[{i}] has unknown key(s) {sorted(extra)}")
    # a route `source` is a path-to-regexp pattern: a group inside a group, or `|` outside one, fails the
    # deploy with "invalid-route-source-pattern" (Oct 6, 2026: /fvs/(js/(.*)|fvs).(css|js) did) — keep them flat
    for sect in ("headers", "rewrites", "redirects"):
        for i, e in enumerate(cfg.get(sect, [])):
            src, depth, nested = e.get("source", ""), 0, False
            for ch in src:
                if ch == "(":
                    depth += 1; nested = nested or depth > 1
                elif ch == ")":
                    depth -= 1
                elif ch == "|" and depth == 0:
                    nested = True
            if nested or depth:
                fail(f"{sect}[{i}] source {src!r}: nested or unbalanced group — Vercel rejects it (invalid-route-source-pattern)")
    dests = [r["destination"] for r in cfg.get("rewrites", [])]
    for d in dests:
        m = re.match(r"^/([\w-]+)/", d)
        if m and not os.path.isdir(m.group(1)) and m.group(1) != "shared":
            fail(f"rewrite destination {d} points at a missing folder")
    if not any(f.startswith("vercel.json") for f in fails):
        ok(f"valid, {len(cfg.get('rewrites', []))} rewrites, {len(cfg.get('headers', []))} header rules")
except Exception as e:  # noqa
    fail(f"vercel.json unreadable: {e}")

# 2. JSON ----------------------------------------------------------------------
print("JSON files")
n = 0
for f in tracked(".json"):
    if f.endswith(("package-lock.json",)) or "_regression-baseline" in f:
        continue
    try:
        json.load(open(f))
        n += 1
    except Exception as e:  # noqa
        fail(f"{f}: {e}")
ok(f"{n} parsed") if not any("json" in x for x in fails[1:]) else None

# 3. JS syntax -----------------------------------------------------------------
print("JS syntax")
tmp = tempfile.mkdtemp()
checked = 0


def node_check(path, label):
    global checked
    r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
    checked += 1
    if r.returncode:
        first = (r.stderr.strip().split("\n") or [""])[0:4]
        fail(f"{label}: {' | '.join(first)}")


SCRIPT = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
for f in tracked(".html"):
    src = re.sub(r"<!--.*?-->", "", open(f, encoding="utf-8", errors="replace").read(), flags=re.S)
    for i, m in enumerate(SCRIPT.finditer(src)):
        attrs, body = m.group(1), m.group(2)
        if "src=" in attrs or not body.strip():
            continue
        t = re.search(r'type\s*=\s*["\']([^"\']+)', attrs)
        if t and t.group(1).lower() not in ("module", "text/javascript", "application/javascript"):
            continue  # json / templates
        ext = ".mjs" if (t and t.group(1).lower() == "module") else ".js"
        p = os.path.join(tmp, f"{f.replace('/', '_')}.{i}{ext}")
        open(p, "w").write(body)
        node_check(p, f"{f} <script #{i}>")

for f in tracked(".js"):
    if f.startswith(("shared/vendor/", "figma-plugin/")) or ".min." in f:
        continue
    p = f
    if "/js/" in f:  # native ES modules (loom, rhizome, membrane, vortex)
        p = os.path.join(tmp, f.replace("/", "_") + ".mjs")
        open(p, "w").write(open(f, encoding="utf-8").read())
    node_check(p, f)
ok(f"{checked} scripts checked") if not any("<script" in x or x.endswith(".js") for x in fails) else None

# 4. Local references ----------------------------------------------------------
print("Local /shared and /genesis references")
REF = re.compile(r'(?:href|src)\s*=\s*["\'](/(?:shared|genesis)/[^"\'?#]+)', re.I)
missing = set()
for f in tracked(".html"):
    for m in REF.finditer(open(f, encoding="utf-8", errors="replace").read()):
        if not os.path.exists(m.group(1).lstrip("/")):
            missing.add((f, m.group(1)))
for f, r in sorted(missing):
    fail(f"{f} references missing file {r}")
if not missing:
    ok("all resolve")

# 4b. mega menu data resolves ---------------------------------------------------
# shared/tools.js is the only tool navigation since the hub side-nav was removed (Sep 29, 2026).
print("tools.js links")
tools_js = open("shared/tools.js", encoding="utf-8").read()
menu_links = re.findall(r"'(/[\w./-]+)'", tools_js)
dead = [l for l in menu_links if not os.path.exists(l.lstrip("/") + ("index.html" if l.endswith("/") else ""))]
if dead:
    fail(f"shared/tools.js links to missing page(s): {dead}")
else:
    ok(f"{len(menu_links)} menu links all resolve")

# 4c. test gallery: size budget + reachable only from the design system ----------
# /gallery/ is a DEVELOPMENT page that logs the tests we run (a tile = one real export + one animator
# preset). Rule (Oct 1, 2026): keep it light, and link to it from the design system only.
print("test gallery")
budget = json.load(open("gallery/budget.json"))
gal = open("gallery/index.html", encoding="utf-8").read()
tiles = len(re.findall(r"^\s*\{ src: '", gal, re.M))
samples = sorted(f for f in os.listdir("gallery/samples") if f.endswith(".svg"))
sizes = {f: os.path.getsize("gallery/samples/" + f) for f in samples}
total_kb = sum(sizes.values()) / 1024
page_kb = os.path.getsize("gallery/index.html") / 1024
bad = False
if tiles > budget["maxTiles"]: fail(f"gallery has {tiles} tiles; budget is {budget['maxTiles']} (gallery/budget.json)"); bad = True
if total_kb > budget["maxTotalKB"]: fail(f"gallery samples total {total_kb:.0f} KB; budget is {budget['maxTotalKB']} KB"); bad = True
for f, n in sizes.items():
    if n / 1024 > budget["maxSampleKB"]: fail(f"gallery/samples/{f} is {n/1024:.0f} KB; per-sample budget is {budget['maxSampleKB']} KB"); bad = True
if page_kb > budget["maxPageKB"]: fail(f"gallery/index.html is {page_kb:.0f} KB; budget is {budget['maxPageKB']} KB"); bad = True
used = set(re.findall(r"src: '([\w-]+)'", gal))
orphans = [f for f in samples if f[:-4] not in used]
if orphans: fail(f"gallery samples not used by any tile (delete them or add a tile): {orphans}"); bad = True
linkers = []
for f in tracked(".html", ".js"):
    if f.startswith(("gallery/", "design-system/", "scratchpad/")): continue
    if "/gallery/" in open(f, encoding="utf-8", errors="replace").read(): linkers.append(f)
if linkers: fail(f"/gallery/ may be linked from the design system only; also linked from: {linkers}"); bad = True
if "/gallery/" not in open("design-system/index.html", encoding="utf-8").read(): fail("design-system/index.html must link to /gallery/"); bad = True
if not bad: ok(f"{tiles}/{budget['maxTiles']} tiles · samples {total_kb:.0f}/{budget['maxTotalKB']} KB · page {page_kb:.0f}/{budget['maxPageKB']} KB · design-system link only")

# 4b. icons — one registry (shared/icons.js) ---------------------------------------
print("icons")
reg = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./shared/icons.js')))"], capture_output=True, text=True).stdout or "{}")
ICON_EXEMPT = ("genesis/", "explorations/", "archive/", "design-system/", "docs/", "shared/icons.js", "index.html")
sq = lambda t: re.sub(r"\s+", " ", t).strip()
n_icons = 0; bad_icons = False
for f in tracked(".html", ".js"):
    if f.startswith(ICON_EXEMPT[:-1]) or f == "index.html" or "/_test" in f or "/vendor/" in f: continue
    t = open(f, encoding="utf-8", errors="ignore").read()
    for m in re.finditer(r"<svg\b([^>]*)>([\s\S]*?)</svg>", t):
        attr, inner = m.group(1), m.group(2)
        line = t[:m.start()].count("\n") + 1
        dm = re.search(r'data-icon="([^"]+)"', attr)
        if dm:
            n_icons += 1
            name = dm.group(1)
            if name not in reg: fail(f"{f}:{line} data-icon=\"{name}\" is not in shared/icons.js"); bad_icons = True
            elif sq(inner) != sq(reg[name]): fail(f"{f}:{line} data-icon=\"{name}\" drawing differs from shared/icons.js (edit the registry, then re-paste)"); bad_icons = True
        elif 'viewBox="0 0 16 16"' in attr and "data-icon-slot" not in attr and "${" not in inner:
            fail(f"{f}:{line} inline 16-grid <svg> without data-icon — add the drawing to shared/icons.js and use Organica.icons.get() / data-icon"); bad_icons = True
if not bad_icons: ok(f"{n_icons} inline icons match the registry ({len(reg)} drawings)")

# 4d. page templates — skeleton lint + the generated inventory -------------------
# Three templates (tool / page / auth-card). scripts/templates.py lints every page and the starter
# (shared/_template.html) against its template, and fails when design-system/templates.json — what
# /design-system/#templates renders — no longer matches the pages. (Oct 2, 2026, decision O-10.)
print("page templates")
r = subprocess.run([sys.executable, "scripts/templates.py", "--check"], capture_output=True, text=True)
for l in (r.stdout + r.stderr).strip().split("\n"):
    if l.strip().startswith("✗"): fail(l.strip()[2:])
    elif l.strip(): print(l)
if r.returncode and not any(l.strip().startswith("✗") for l in (r.stdout + r.stderr).split("\n")):
    fail("templates.py failed:\n" + (r.stdout + r.stderr).strip()[-600:])   # a crash must not pass

# 5. css-lint ------------------------------------------------------------------
print("css-lint")
r = subprocess.run([sys.executable, "scripts/css-lint.py"], capture_output=True, text=True)
if r.returncode:
    fail("css-lint failed:\n" + "\n".join("      " + l for l in (r.stdout + r.stderr).strip().split("\n")[-12:]))
else:
    ok("clean")

# 5b. FVS engine stays engine — fvs/js/engine/*.js is model + logic with no DOM UI (docs/FVS.md
# §11). It may import only other engine files and ../hooks.js / ../rt.js, never a UI file, and use
# the DOM only to measure / composite offscreen (createElement / createElementNS / body append + remove); the
# model's stores (presetStore 'fvs' / 'fvs-element' / 'fvs-symbols' / 'fvs-assets', the Genesis library, ORGANIC_SEEDS) are allowed.
print("fvs engine")
eng = sorted(f for f in subprocess.run(["git", "ls-files", "fvs/js/engine"], capture_output=True, text=True).stdout.split() if f.endswith(".js"))
ENGINE_BAD = re.compile(r"\b(ctrl|setStatus)\(|\bwindow\.|localStorage|addEventListener|querySelector|getElementById|innerHTML|\bOrganica\.(download|icons|popover|prompt|confirm|notice|store\b|presetStore|dirty|selectPicker)")
MODEL_OK = re.compile(r"Organica\.presetStore\('fvs(-element|-symbols|-assets)?'\)|Organica\.store\.library\.read\(\)|window\.ORGANIC_SEEDS")
ENGINE_IMPORT_OK = ("/loom/js/generators/",)   # other tools' pure data modules the engine may import() on demand
DOM_OK = re.compile(r"document\.(createElement|createElementNS)\(|document\.body\.(appendChild|removeChild)\(")
bad_e = []
for f in eng:
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        code = line.split("//")[0]
        m = re.search(r"from '([^']+)'", line)
        if m and not (m.group(1).startswith("./") or m.group(1) in ("../hooks.js", "../rt.js")):
            bad_e.append(f"{f}:{n} imports {m.group(1)} (engine imports engine only)")
        # a dynamic import() too (Oct 25, 2026 — it was not read): engine files, or another tool's data module named in
        # ENGINE_IMPORT_OK (engine/08 loads Loom's generator registry on demand); never an FVS UI file
        for d in re.findall(r"\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)", code):
            if not (d.startswith("./") or d in ("../hooks.js", "../rt.js") or d.startswith("/fvs/js/engine/") or d.startswith(ENGINE_IMPORT_OK)):
                bad_e.append(f"{f}:{n} import('{d}') (engine imports engine only — or add a data module to ENGINE_IMPORT_OK)")
        code = MODEL_OK.sub("", code)   # the model's own stores + data sources are engine by design
        if ENGINE_BAD.search(code) or ("document." in code and not DOM_OK.search(code)):
            bad_e.append(f"{f}:{n} {code.strip()[:90]}")
for b in bad_e[:12]:
    fail("fvs engine: " + b)
if eng and not bad_e:
    ok(f"{len(eng)} engine files — no panel, page or UI import")

# 6. fvs-field: the data it bakes to run alone = what shapes / palette / color produce
print("fvs-field baked data")
r = subprocess.run(["node", "scripts/test-fvs-field.mjs"], capture_output=True, text=True)
if r.returncode:
    fail("fvs-field: baked data out of date:\n" + "\n".join("      " + l for l in (r.stdout + r.stderr).strip().split("\n")[-8:]))
else:
    ok("ELEMENTS and BUILTIN match shapes.js / palette.js / color.js")

# 6a. node canvas: the graph model / engine / history logic (shared/node-canvas.js) — pure, no browser
print("node canvas logic")
r = subprocess.run(["node", "scripts/test-node-canvas.mjs"], capture_output=True, text=True)
if r.returncode:
    fail("node canvas:\n" + "\n".join("      " + l for l in (r.stdout + r.stderr).strip().split("\n")[-8:]))
else:
    ok(r.stdout.strip().split("\n")[0].replace("nodeCanvas: ", ""))

# 6b. copy: typographic apostrophe (docs/UI-COPY.md rule 12 — Diego, Oct 7, 2026). Visible text, copy attributes and
#     JS string literals use ’, never '; comments / code / <code> samples are not copy. Fix: --fix, or apostrophe-ok.
print("copy apostrophes")
r = subprocess.run(["node", "scripts/check-apostrophes.mjs"], capture_output=True, text=True)
if r.returncode:
    fail("straight apostrophe in visible copy:\n" + "\n".join("      " + l for l in r.stdout.strip().split("\n")[:12]))
else:
    ok(r.stdout.strip().split("\n")[-1])

# 7. session log: append-only. On Sep 29, 2026 a commit overwrote docs/SESSION-LOG.md with only
#    its own new notes (640 lines -> 2) and twelve commits did the same before anyone noticed.
#    A note may be edited; the log may never hold FEWER notes than the last commit's.
print("session log")
def _notes(text):
    return sum(1 for l in text.split("\n") if l.startswith("- **"))
try:
    _head = subprocess.run(["git", "show", "HEAD:docs/SESSION-LOG.md"], capture_output=True, text=True).stdout
    _now = open("docs/SESSION-LOG.md", encoding="utf-8").read()
    if _notes(_now) < _notes(_head):
        fail(f"docs/SESSION-LOG.md lost notes ({_notes(_head)} at HEAD -> {_notes(_now)}): append to it, never rewrite it")
    elif not _now.startswith("# Organica — Session Log"):
        fail("docs/SESSION-LOG.md lost its header — append to the existing file, never rewrite it")
    else:
        ok(f"{_notes(_now)} notes, none lost")
except OSError as e:
    fail(f"docs/SESSION-LOG.md: {e}")

# 8. docs: CLAUDE.md is read at the start of every session — on Oct 14, 2026 it had grown to 122 KB (~30k tokens): the
#    full Tools table and Repo Structure now live in docs/TOOLS.md / docs/REPO-STRUCTURE.md, older notes in the log.
#    Over budget = move detail to the tool's manual or docs/TOOLS.md; a 4th inline note = migrate the oldest to the log.
#    Backticked repo paths and relative links in the docs that do not resolve are listed (a report, not a failure:
#    a plan names files still to come, a history names files since removed).
print("docs")
CLAUDE_MD_BUDGET = 60_000
try:
    _cm = open("CLAUDE.md", encoding="utf-8").read()
    _size = len(_cm.encode("utf-8"))
    _sn = _cm.find("## Session Notes")
    _inline = sum(1 for l in _cm[_sn:].split("\n") if l.startswith("- **")) if _sn >= 0 else 0
    if _size > CLAUDE_MD_BUDGET:
        fail(f"CLAUDE.md is {_size // 1000} KB (budget {CLAUDE_MD_BUDGET // 1000} KB): move detail to docs/TOOLS.md, docs/REPO-STRUCTURE.md or the tool's manual")
    elif _inline > 3:
        fail(f"CLAUDE.md has {_inline} inline session notes (keep 3): append the oldest to docs/SESSION-LOG.md and remove it here")
    else:
        ok(f"CLAUDE.md {_size // 1000} KB of {CLAUDE_MD_BUDGET // 1000} KB, {_inline} inline session notes")
    _dead = []
    _path_re = re.compile(r"`((?:scripts|shared|fvs|docs|design-system|genesis|loom|rhizome)/[\w./-]+\.(?:js|mjs|sh|py|css|html|json|md))`")
    _link_re = re.compile(r"\]\(([^)#\s]+)(?:#[^)]*)?\)")
    for _f in ["CLAUDE.md", "README.md"] + sorted(f for f in tracked(".md") if f.startswith("docs/") and "SESSION-LOG" not in f):
        _t = open(_f, encoding="utf-8").read()
        for _p in set(_path_re.findall(_t)):
            if not os.path.exists(_p): _dead.append(f"{_f}: {_p}")
        for _p in set(_link_re.findall(_t)):
            if _p.startswith(("http", "mailto")): continue
            if not (os.path.exists(os.path.normpath(os.path.join(os.path.dirname(_f), _p))) or os.path.exists(_p.lstrip("/"))):
                _dead.append(f"{_f}: link {_p}")
    if _dead:
        print(f"  · {len(_dead)} doc path(s) that do not resolve — report only (planned or removed files are fine)" +
              (":" if "--docs" in sys.argv else "; list them: python3 scripts/check.py --docs"))
        if "--docs" in sys.argv:
            for _d in sorted(_dead): print("      " + _d)
except OSError as e:
    fail(f"docs: {e}")

print()
if fails:
    print(f"FAILED — {len(fails)} problem(s). Fix before committing.")
    sys.exit(1)
print("ALL CHECKS PASSED")
