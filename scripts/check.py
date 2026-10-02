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

print()
if fails:
    print(f"FAILED — {len(fails)} problem(s). Fix before committing.")
    sys.exit(1)
print("ALL CHECKS PASSED")
