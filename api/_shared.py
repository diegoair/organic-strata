"""
Shared plumbing for the Strata serverless functions.

The tracing pipeline itself is NOT duplicated here — backend/process.py stays
the single source of truth, used identically by the local server and by these
functions. This module only supplies the bits that differ on a serverless
host: where it is allowed to write, and the request/response boilerplate.
"""

import json
import os
import sys

# backend/ holds the pipeline. It is included in the function bundle via
# vercel.json → functions.includeFiles.
_BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Everything outside /tmp is read-only on a serverless host, and /tmp does not
# survive between invocations. The pipeline writes intermediate files, so it
# gets a per-invocation scratch dir and every response carries its data
# INLINE — nothing may be written now and read back on a later request.
os.environ.setdefault("STRATA_WORK_DIR", "/tmp/strata-work")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def work_dir():
    d = os.environ["STRATA_WORK_DIR"]
    os.makedirs(d, exist_ok=True)
    return d


def send_json(handler, obj, code=200):
    body = json.dumps(obj).encode()
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    for k, v in CORS.items():
        handler.send_header(k, v)
    handler.end_headers()
    handler.wfile.write(body)


def send_options(handler):
    handler.send_response(204)
    for k, v in CORS.items():
        handler.send_header(k, v)
    handler.end_headers()


def read_body(handler):
    n = int(handler.headers.get("Content-Length", 0) or 0)
    return handler.rfile.read(n) if n else b""


def parse_multipart(data: bytes, boundary: str):
    """Same minimal parser the local server uses."""
    parts = {}
    sep = ("--" + boundary).encode()
    for chunk in data.split(sep)[1:]:
        if chunk.strip() in (b"", b"--", b"--\r\n"):
            continue
        try:
            header_end = chunk.index(b"\r\n\r\n")
        except ValueError:
            continue
        headers_raw = chunk[:header_end].decode("utf-8", errors="replace")
        body = chunk[header_end + 4:]
        if body.endswith(b"\r\n"):
            body = body[:-2]
        name = filename = None
        for line in headers_raw.split("\r\n"):
            if "Content-Disposition" in line:
                for piece in line.split(";"):
                    piece = piece.strip()
                    if piece.startswith("name="):
                        name = piece[5:].strip('"')
                    if piece.startswith("filename="):
                        filename = piece[9:].strip('"')
        if name:
            parts[name] = {"data": body, "filename": filename}
    return parts
