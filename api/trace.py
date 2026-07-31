"""POST /api/trace — sketch PNG → SVG, the same pipeline the local server runs."""

from http.server import BaseHTTPRequestHandler
import json
import os
import shutil
import tempfile
import traceback

from _shared import send_json, send_options, read_body, parse_multipart, work_dir

from process import run_pipeline, DEFAULT_PARAMS


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        send_options(self)

    def do_POST(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            send_json(self, {"error": "Expected multipart/form-data"}, 400)
            return

        boundary = content_type.split("boundary=")[-1].strip()
        parts = parse_multipart(read_body(self), boundary)

        if "image" not in parts:
            send_json(self, {"error": "No image field"}, 400)
            return

        try:
            ui = json.loads(parts["params"]["data"].decode()) if parts.get("params") else {}
        except Exception:
            ui = {}

        params = {
            **DEFAULT_PARAMS,
            "fidelity":       int(ui.get("fidelity", 5)),
            "denoise":        ui.get("denoise", True),
            "contrast_boost": float(ui.get("contrast", 1.5)),
            "threshold_block": int(ui.get("block", 35)),
            "min_area":       int(ui.get("area", 80)),
            "stroke_width":   float(ui.get("stroke", 1.2)),
            "fill_mode":      ui.get("fill", "stroke_only"),
            "shape_style":    ui.get("style", "B"),
            "trace_mode":     ui.get("mode", "smart"),
        }
        split_regions = ui.get("mode") == "separate"

        # Per-invocation scratch dir, removed on the way out. /tmp is the only
        # writable place and it is not shared between invocations, so every
        # artefact the caller needs must go back INLINE in this response.
        run_dir = tempfile.mkdtemp(prefix="trace-", dir=work_dir())
        try:
            img_path = os.path.join(run_dir, "input.png")
            with open(img_path, "wb") as f:
                f.write(parts["image"]["data"])

            results = run_pipeline(img_path, run_dir, params, split_regions)

            with open(results["full_svg"], encoding="utf-8") as f:
                full_svg = f.read()

            regions = []
            for r in results.get("regions", []):
                try:
                    with open(r["svg"], encoding="utf-8") as f:
                        regions.append({
                            "label": r["label"],
                            "bounds": r["bounds"],
                            "svgData": f.read(),
                        })
                except Exception:
                    pass

            # Same response shape the local server sends, so the frontend
            # cannot tell the two apart.
            send_json(self, {
                "ok": True,
                "svg": full_svg,
                "regions": regions,
                "region_count": len(regions),
            })
        except Exception as e:
            traceback.print_exc()
            send_json(self, {"ok": False, "error": f"{e.__class__.__name__}: {e}"}, 500)
        finally:
            shutil.rmtree(run_dir, ignore_errors=True)
