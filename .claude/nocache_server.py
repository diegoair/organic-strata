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

    # Range requests (Nov 25, 2026): a <video> seeks by asking for a byte range. SimpleHTTPRequestHandler always
    # answers 200 with the whole file, so a local video could not seek (and Safari will not play it at all).
    # One range only ("bytes=a-b", "bytes=a-", "bytes=-n"), as browsers send for media; anything else gets the file.
    def send_head(self):
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        if not rng or not rng.startswith('bytes=') or ',' in rng or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a, _, b = rng[6:].strip().partition('-')
        try:
            if a == '':
                start, end = max(0, size - int(b)), size - 1
            else:
                start, end = int(a), (min(int(b), size - 1) if b else size - 1)
        except ValueError:
            return super().send_head()
        if start >= size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        self._range_left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, '_range_left', None)
        if left is None:
            return super().copyfile(source, outputfile)
        self._range_left = None
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

# Threaded (Nov 25, 2026): one request at a time hung the whole server when a page asked for many large videos
# and one transfer stalled — every tab on the port stopped loading.
class ReusableServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

with ReusableServer(("", port), NoCacheHandler) as httpd:
    httpd.serve_forever()
