from http.server import BaseHTTPRequestHandler
import os
import sys

# Vercel bundles each file under api/ as its own isolated function — the
# directory is not put on sys.path for you the way a normal package import
# would be, so a sibling import ("from _shared import ...") 404s at runtime
# with ModuleNotFoundError even though the file sits right next to this one.
# Confirmed in production logs; not reproduced by a local test that had
# already added api/ to sys.path by hand before importing.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _shared import send_json, send_options


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        send_options(self)

    def do_GET(self):
        token = os.environ.get("FIGMA_TOKEN", "")
        send_json(self, {
            "ok": True,
            # The Figma push still routes through the local backend — the
            # plugin is shared by every Organica tool and gets its own pass.
            "figma_token_set": bool(token) and token != "paste_token_here",
            "backend": "organic-strata",
            "runtime": "vercel",
            "version": "0.1",
        })
