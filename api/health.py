from http.server import BaseHTTPRequestHandler
import os

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
