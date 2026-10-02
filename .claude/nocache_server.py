#!/usr/bin/env python3
"""Dev static server with Cache-Control: no-store on every response.
Plain python3 -m http.server sends no cache headers at all, and Chrome's
own heuristic caching (no explicit Cache-Control/Expires) can hold onto a
stale copy of a JS module far longer than expected during active
development — documented repeatedly in this project's own CLAUDE.md
session notes as "the dev server caches aggressively." This is the fix
already used successfully elsewhere in the project, wired into
.claude/launch.json instead of a one-off manual process this time."""
import http.server
import socketserver
import sys
import os

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    # Vercel serves /404.html for any address that matches no file and no
    # rewrite; do the same here, so a wrong address shows the real page.
    def send_error(self, code, message=None, explain=None):
        if code == 404 and self.command == 'GET' and os.path.isfile('404.html'):
            body = open('404.html', 'rb').read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().send_error(code, message, explain)

class ReusableServer(socketserver.TCPServer):
    allow_reuse_address = True

with ReusableServer(("", port), NoCacheHandler) as httpd:
    httpd.serve_forever()
