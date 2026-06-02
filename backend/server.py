"""
ShapeGrammar — Local Server
Bridges app.html UI → process.py pipeline
Run: python3 server.py
Then open: http://localhost:5050
"""

import os, json, tempfile, shutil
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import sys

# Add current dir to path
sys.path.insert(0, os.path.dirname(__file__))
from process import run_pipeline, DEFAULT_PARAMS

PORT = 5050
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(STATIC_DIR), 'frontend')


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

        self.send_json({
            "ok": True,
            "figma_url": "https://www.figma.com/design/FYWyi41bGojxFATB0szSUb/Organic-Strata?node-id=5-2"
        })

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
    print(f"\n  ShapeGrammar server running")
    print(f"  → http://localhost:{PORT}\n")
    server = HTTPServer(("localhost", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
