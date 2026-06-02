"""
ShapeGrammar — Local Server
Bridges app.html UI → process.py pipeline
Run: python3 server.py
Then open: http://localhost:5050
"""

import os, json, tempfile, shutil
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse, urllib.request, urllib.error
import sys
from dotenv import load_dotenv

# Add current dir to path
sys.path.insert(0, os.path.dirname(__file__))
from process import run_pipeline, DEFAULT_PARAMS

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
FIGMA_TOKEN    = os.environ.get('FIGMA_TOKEN', '')

PORT           = 5050
STATIC_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR   = os.path.join(os.path.dirname(STATIC_DIR), 'frontend')
FIGMA_FILE_KEY = "FYWyi41bGojxFATB0szSUb"
FIGMA_NODE_ID  = "5:2"
FIGMA_URL      = "https://www.figma.com/design/FYWyi41bGojxFATB0szSUb/Organic-Strata?node-id=5-2"


def _figma_req(method, path, body=None, token=""):
    url = f"https://api.figma.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-Figma-Token", token)
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()), None
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode()).get("message", f"HTTP {e.code}")
        except Exception:
            msg = f"HTTP {e.code}"
        return None, msg
    except Exception as e:
        return None, str(e)


def push_svg_to_figma(svg_content, token):
    latest_svg_url = f"http://localhost:{PORT}/latest-svg"

    # Auth check is best-effort — a 403 or any error is silently ignored.
    # The plugin handles the actual Figma import; the backend only saves the SVG.
    if token and token != "paste_token_here":
        _figma_req("GET", "/v1/me", token=token)  # result intentionally discarded

    return {
        "ok": True,
        "method": "plugin",
        "latest_svg_url": latest_svg_url,
        "figma_url": FIGMA_URL,
        "message": "SVG ready — use the Figma plugin to import",
    }


def parse_multipart(data: bytes, boundary: str):
    """Minimal multipart/form-data parser."""
    parts = {}
    sep = ("--" + boundary).encode()
    chunks = data.split(sep)
    for chunk in chunks[1:]:
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

        # Extract field name
        name = None
        filename = None
        for line in headers_raw.split("\r\n"):
            if "Content-Disposition" in line:
                for part in line.split(";"):
                    part = part.strip()
                    if part.startswith("name="):
                        name = part[5:].strip('"')
                    if part.startswith("filename="):
                        filename = part[9:].strip('"')
        if name:
            parts[name] = {"data": body, "filename": filename}
    return parts


class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"  {fmt % args}")

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/" or path == "/index.html":
            self.serve_file(os.path.join(FRONTEND_DIR, "index.html"), "text/html")
        elif path == "/health":
            self.handle_health()
        elif path == "/latest-svg":
            self.handle_latest_svg()
        elif path == "/regions":
            self.handle_regions()
        elif path.startswith("/output/"):
            fname = path[8:]
            fpath = os.path.join(STATIC_DIR, "output", fname)
            self.serve_file(fpath, self.guess_mime(fname))
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/trace":
            self.handle_trace()
        elif self.path == "/send-to-figma":
            self.handle_send_to_figma()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def handle_health(self):
        token_set = bool(FIGMA_TOKEN) and FIGMA_TOKEN != "paste_token_here"
        self.send_json({
            "ok": True,
            "figma_token_set": token_set,
            "backend": "organic-strata",
            "version": "0.1",
        })

    def handle_latest_svg(self):
        svg_path = os.path.join(STATIC_DIR, "output", "latest.svg")
        if not os.path.exists(svg_path):
            self.send_json({"error": "No SVG generated yet"}, 404)
            return
        self.serve_file(svg_path, "image/svg+xml")

    def handle_regions(self):
        manifest_path = os.path.join(STATIC_DIR, "output", "regions.json")
        if not os.path.exists(manifest_path):
            self.send_json({"count": 0, "regions": []})
            return
        with open(manifest_path) as f:
            self.send_json(json.load(f))

    def handle_trace(self):
        content_type = self.headers.get("Content-Type", "")
        content_len  = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len)

        # Parse multipart
        if "multipart/form-data" in content_type:
            boundary = content_type.split("boundary=")[-1].strip()
            parts = parse_multipart(body, boundary)
        else:
            self.send_json({"error": "Expected multipart/form-data"}, 400)
            return

        # Get image bytes
        if "image" not in parts:
            self.send_json({"error": "No image field"}, 400)
            return

        img_bytes = parts["image"]["data"]

        # Get params
        params_raw = parts.get("params", {})
        if params_raw:
            try:
                ui_params = json.loads(params_raw["data"].decode())
            except Exception:
                ui_params = {}
        else:
            ui_params = {}

        # Map UI params → pipeline params
        pipeline_params = {
            **DEFAULT_PARAMS,
            "denoise":          ui_params.get("denoise", True),
            "contrast_boost":   float(ui_params.get("contrast", 1.5)),
            "threshold_block":  int(ui_params.get("block", 35)),
            "min_area":         int(ui_params.get("area", 80)),
            "alphamax":         float(ui_params.get("alpha", 1.0)),
            "opttolerance":     float(ui_params.get("opttol", 0.2)),
            "turdsize":         int(ui_params.get("turd", 4)),
            "stroke_width":     float(ui_params.get("stroke", 1.2)),
            "fill_mode":        ui_params.get("fill", "stroke_only"),
            "trace_mode":       ui_params.get("trace_mode", "single"),
        }

        split_regions = ui_params.get("split", True)

        # Write image to temp file
        tmp_dir  = tempfile.mkdtemp()
        img_path = os.path.join(tmp_dir, "input.png")
        out_dir  = os.path.join(STATIC_DIR, "output")
        os.makedirs(out_dir, exist_ok=True)

        try:
            with open(img_path, "wb") as f:
                f.write(img_bytes)

            # Run pipeline
            results = run_pipeline(img_path, out_dir, pipeline_params, split_regions)

            # Read SVGs
            full_svg = ""
            with open(results["full_svg"]) as f:
                full_svg = f.read()

            regions_out = []
            for r in results.get("regions", []):
                try:
                    with open(r["svg"]) as f:
                        svg_data = f.read()
                    regions_out.append({
                        "label": r["label"],
                        "bounds": r["bounds"],
                        "svgData": svg_data
                    })
                except Exception as e:
                    print(f"  Warning reading region {r['label']}: {e}")

            # Save regions manifest for the plugin
            manifest = {
                "count": len(regions_out),
                "regions": [
                    {"label": r["label"],
                     "url": f"http://localhost:{PORT}/output/{r['label']}.svg"}
                    for r in regions_out
                ]
            }
            with open(os.path.join(out_dir, "regions.json"), "w", encoding="utf-8") as f:
                json.dump(manifest, f)

            self.send_json({
                "ok": True,
                "svg": full_svg,
                "regions": regions_out,
                "region_count": len(regions_out)
            })

        except Exception as e:
            print(f"  Error: {e}")
            self.send_json({"error": str(e)}, 500)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def handle_send_to_figma(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len)
        try:
            data = json.loads(body.decode())
        except Exception:
            self.send_json({"error": "Invalid JSON"}, 400)
            return

        svg = data.get("svg", "")
        if not svg:
            self.send_json({"error": "No SVG provided"}, 400)
            return

        out_dir = os.path.join(STATIC_DIR, "output")
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "latest.svg"), "w", encoding="utf-8") as f:
            f.write(svg)

        self.send_json(push_svg_to_figma(svg, FIGMA_TOKEN))

    def serve_file(self, path, mime):
        if not os.path.exists(path):
            self.send_error(404)
            return
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def guess_mime(self, filename):
        ext = filename.rsplit(".", 1)[-1].lower()
        return {"svg": "image/svg+xml", "png": "image/png",
                "jpg": "image/jpeg", "json": "application/json"}.get(ext, "text/plain")


if __name__ == "__main__":
    print(f"\n  Organic Strata server running")
    print(f"  → http://localhost:{PORT}\n")
    server = HTTPServer(("localhost", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
