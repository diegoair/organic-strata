#!/usr/bin/env python3
"""Pre-release checks for Organica. Run: python3 scripts/check.py  (or scripts/check.sh)

Fast, no dependencies beyond python3 + node. Exits 1 on any failure.

  1. vercel.json   — valid JSON, ONLY schema keys (a stray `_comment_*` key silently
                     fails every deployment at config validation — see CLAUDE.md, Sep 7 2026)
  2. JSON files    — tokens.json and any other tracked *.json parse
  3. JS syntax     — every inline <script> in every */index.html, and every tracked .js
                     (modules under a js/ folder are checked as ES modules)
  4. Local refs    — every /shared/... and /genesis/... href/src in an HTML file exists
  5. css-lint      — scripts/css-lint.py must be clean
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

# 4b. mega menu data vs the hub nav ---------------------------------------------
print("tools.js vs hub nav")
hub = open("index.html", encoding="utf-8").read()
nav = hub[hub.index('<nav class="side-nav">'):hub.index("</nav>")]
nav = nav[:nav.index("Explorations")] if "Explorations" in nav else nav   # explorations are not in the mega menu
hub_links = set(re.findall(r'href="(/[\w-]+/)"', nav))
tools_js = open("shared/tools.js", encoding="utf-8").read()
menu_links = set(re.findall(r"'(/[\w-]+/)'", tools_js))
gap = sorted(hub_links - menu_links)
if gap:
    fail(f"shared/tools.js is missing tool(s) linked from the hub nav: {gap}")
else:
    ok(f"{len(hub_links)} hub tools all in shared/tools.js")

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
