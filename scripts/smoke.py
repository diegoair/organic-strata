#!/usr/bin/env python3
"""Post-deploy smoke test. Usage: python3 scripts/smoke.py [base-url]

Default base is production. Pass a preview URL (staging deploy) to test that first.
Checks the hub, every rewritten tool page, and key shared assets return 200 and non-empty
HTML/JS/CSS. A preview behind Vercel Deployment Protection returns 401 — use the
Vercel MCP `web_fetch_vercel_url` / `get_access_to_vercel_url` for that case.
"""
import json, os, re, sys, urllib.request, urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://theorganicalanguage.vercel.app").rstrip("/")
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cfg = json.load(open("vercel.json"))
pages = sorted({re.sub(r"\(\.\*\)$", "", r["source"]) for r in cfg["rewrites"]})
paths = [p for p in pages if p not in ("/", "/shared/")]
paths = ["/"] + paths + [
    "/shared/tokens.css", "/shared/core.js", "/shared/panel.css", "/shared/vendor/manrope-variable.ttf"]
bad = 0
for p in paths:
    try:
        req = urllib.request.Request(BASE + p, headers={"User-Agent": "organica-smoke"})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read()
            good = r.status == 200 and len(body) > 200
            print(f"  {'✓' if good else '✗'} {r.status} {len(body):>9}  {p}")
            bad += not good
    except urllib.error.HTTPError as e:
        hint = "  (deployment protection? use the Vercel MCP)" if e.code == 401 else ""
        print(f"  ✗ {e.code}            {p}{hint}"); bad += 1
    except Exception as e:  # noqa
        print(f"  ✗ ERR            {p}  {e}"); bad += 1
print(f"\n{'SMOKE FAILED' if bad else 'SMOKE OK'} — {len(paths)-bad}/{len(paths)} at {BASE}")
sys.exit(1 if bad else 0)
