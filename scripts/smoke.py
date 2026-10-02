"""Post-deploy smoke test. Usage: python3 scripts/smoke.py [base-url]

Default base is production. Pass a preview URL (staging deploy) to test that first.
Every path must return 200 with the RIGHT content type and real content (a Vercel login
page served with 200 must not count as a pass). Redirects are never followed off-host.

Protected previews (Vercel Deployment Protection) redirect to vercel.com SSO. Options:
  * export VERCEL_PROTECTION_BYPASS=<secret>   (Project > Settings > Deployment Protection >
    Protection Bypass for Automation) — sent as x-vercel-protection-bypass
  * or fetch through the Vercel MCP (web_fetch_vercel_url) by hand
"""
import json, os, re, sys, urllib.request, urllib.error, urllib.parse

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://theorganicalanguage.vercel.app").rstrip("/")
HOST = urllib.parse.urlparse(BASE).netloc
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cfg = json.load(open("vercel.json"))
pages = sorted({re.sub(r"\(\.\*\)$", "", r["source"]) for r in cfg["rewrites"]})
paths = ["/"] + [p for p in pages if p not in ("/", "/shared/")] + [
    "/shared/tokens.css", "/shared/core.js", "/shared/panel.css", "/shared/vendor/manrope-variable.ttf"]


class NoCrossHost(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlparse(newurl).netloc != HOST:
            return None  # surfaces as HTTPError 3xx -> reported as protected/redirect
        return super().redirect_request(req, fp, code, msg, headers, newurl)


opener = urllib.request.build_opener(NoCrossHost)
HDR = {"User-Agent": "organica-smoke"}
if os.environ.get("VERCEL_PROTECTION_BYPASS"):
    HDR["x-vercel-protection-bypass"] = os.environ["VERCEL_PROTECTION_BYPASS"]


def expected(path):
    if path.endswith(".css"): return ("text/css", None)
    if path.endswith(".js"): return ("javascript", None)
    if path.endswith(".ttf"): return ("font", None)
    return ("text/html", b"</html")


bad = protected = 0
for p in paths:
    want, marker = expected(p)
    try:
        with opener.open(urllib.request.Request(BASE + p, headers=HDR), timeout=20) as r:
            body, ct = r.read(), r.headers.get("Content-Type", "")
            good = (r.status == 200 and len(body) > 200 and want in ct
                    and (marker is None or marker in body.lower()))
            if "vercel.com/sso" in r.geturl(): good = False
            print(f"  {'✓' if good else '✗'} {r.status} {len(body):>9}  {p}" + ("" if good else f"  (content-type {ct!r})"))
            bad += not good
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308, 401, 403) and ("sso" in (e.headers.get("Location") or "") or e.code in (401, 403)):
            protected += 1; print(f"  ✗ PROTECTED {e.code}  {p}")
        else:
            print(f"  ✗ {e.code}            {p}")
        bad += 1
    except Exception as e:  # noqa
        print(f"  ✗ ERR            {p}  {e}"); bad += 1
# An address that does not exist must answer 404 WITH our page (404.html), not the host's default.
try:
    opener.open(urllib.request.Request(BASE + "/this-page-does-not-exist", headers=HDR), timeout=20)
    print("  ✗ 200            /this-page-does-not-exist  (expected 404)"); bad += 1
except urllib.error.HTTPError as e:
    ours = e.code == 404 and b"org-page__card" in e.read()
    print(f"  {'✓' if ours else '✗'} {e.code}            /this-page-does-not-exist" + ("" if ours else "  (not the Organica 404 page)"))
    bad += not ours
except Exception as e:  # noqa
    print(f"  ✗ ERR            /this-page-does-not-exist  {e}"); bad += 1
if protected:
    print("\nDeployment is behind Vercel auth — set VERCEL_PROTECTION_BYPASS or fetch via the Vercel MCP.")
print(f"\n{'SMOKE FAILED' if bad else 'SMOKE OK'} — {len(paths)+1-bad}/{len(paths)+1} at {BASE}")
sys.exit(1 if bad else 0)
