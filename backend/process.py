"""
Sketch → SVG Pipeline
Core processing engine: photo/scan → clean vector SVG
"""

import cv2
import numpy as np
from PIL import Image
import subprocess
import tempfile
import os
import json
import re


# ── 1. LOAD & NORMALISE ──────────────────────────────────────────────────────

def load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Cannot load image: {path}")
    return img


def normalise_orientation(img: np.ndarray) -> np.ndarray:
    """Auto-rotate based on aspect ratio heuristic (portrait sketches stay portrait)."""
    h, w = img.shape[:2]
    if w > h * 1.4:           # clearly landscape — rotate to portrait
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    return img



# ── 2. PREPROCESS ────────────────────────────────────────────────────────────

def preprocess(img: np.ndarray, params: dict) -> np.ndarray:
    """
    Turn a photo of a sketch into a clean binary image ready for tracing.
    params keys: threshold, blur_radius, contrast_boost, denoise
    """
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Optional denoise (good for phone photos)
    if params.get("denoise", True):
        gray = cv2.fastNlMeansDenoising(gray, h=10)

    # Contrast boost — stretch histogram
    boost = params.get("contrast_boost", 1.4)
    gray = np.clip(gray.astype(np.float32) * boost, 0, 255).astype(np.uint8)

    # Light blur to smooth grain before thresholding
    blur_r = params.get("blur_radius", 1)
    if blur_r > 0:
        k = blur_r * 2 + 1
        gray = cv2.GaussianBlur(gray, (k, k), 0)

    # Adaptive threshold — handles uneven lighting in phone photos
    block = params.get("threshold_block", 35)
    c_val = params.get("threshold_c", 8)
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block, c_val
    )

    # Remove small noise specks (keep only shapes above min_area)
    min_area = params.get("min_area", 80)
    binary = remove_noise(binary, min_area)

    return binary


def remove_noise(binary: np.ndarray, min_area: int) -> np.ndarray:
    """Remove connected components smaller than min_area pixels."""
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        cv2.bitwise_not(binary), connectivity=8
    )
    clean = np.ones_like(binary) * 255  # start white
    for i in range(1, num_labels):      # skip background (0)
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            clean[labels == i] = 0      # keep: draw black
    return clean


# ── 3. REGION DETECTION ──────────────────────────────────────────────────────

def detect_regions(binary: np.ndarray) -> list[dict]:
    """
    Find distinct rectangular regions in the sketch (e.g. top/bottom panels).
    Returns list of {x, y, w, h, label} dicts.
    """
    h, w = binary.shape

    # Look for large horizontal dividers (long runs of white horizontal space)
    row_density = np.sum(binary == 0, axis=1).astype(float) / w  # 0=dark pixel
    
    # Smooth the density curve
    kernel = np.ones(30) / 30
    smooth = np.convolve(row_density, kernel, mode='same')

    # Find gaps (rows with very low ink density = dividers)
    gap_threshold = 0.015
    in_gap = smooth < gap_threshold
    
    regions = []
    current_start = 0
    in_content = not in_gap[0]

    for i in range(1, h):
        if in_gap[i] and in_content:
            # Just entered a gap — end of a region
            if i - current_start > 50:  # min region height
                regions.append({"y": current_start, "h": i - current_start,
                                 "x": 0, "w": w})
            in_content = False
        elif not in_gap[i] and not in_content:
            # Just left a gap — start of new region
            current_start = i
            in_content = True

    # Close last region
    if in_content and h - current_start > 50:
        regions.append({"y": current_start, "h": h - current_start,
                        "x": 0, "w": w})

    # If no gap found — whole image is one region
    if not regions:
        regions = [{"x": 0, "y": 0, "w": w, "h": h}]

    # Label regions
    for i, r in enumerate(regions):
        r["label"] = f"region_{i+1}"

    return regions


# ── 4. TRACE TO SVG ──────────────────────────────────────────────────────────

def trace_to_svg(binary: np.ndarray, params: dict, output_path: str) -> str:
    """
    Use potrace to convert binary image → SVG paths.
    params keys: turdsize, alphamax, opttolerance, turnpolicy
    """
    h, w = binary.shape

    # Write temp PBM (potrace native input format)
    with tempfile.NamedTemporaryFile(suffix=".pbm", delete=False) as f:
        pbm_path = f.name

    # PBM: 0=black (ink), 1=white (paper) — opposite of our binary
    # Our binary: 0=ink, 255=paper → invert for PBM
    pbm_img = Image.fromarray(binary)
    pbm_img = pbm_img.convert("1")  # 1-bit
    pbm_img.save(pbm_path)

    # Build potrace command
    turdsize    = params.get("turdsize", 5)        # ignore specks smaller than N px
    alphamax    = params.get("alphamax", 1.0)      # corner smoothing (0=sharp, 1.33=round)
    opttol      = params.get("opttolerance", 0.2)  # curve optimisation tolerance
    turnpolicy  = params.get("turnpolicy", "minority")  # how to resolve ambiguities

    cmd = [
        "potrace",
        "--svg",
        f"--turdsize={turdsize}",
        f"--alphamax={alphamax}",
        f"--opttolerance={opttol}",
        f"--turnpolicy={turnpolicy}",
        "--flat",           # output all paths in one group
        "-o", output_path,
        pbm_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    os.unlink(pbm_path)

    if result.returncode != 0:
        raise RuntimeError(f"potrace failed: {result.stderr}")

    return output_path


def trace_region(binary: np.ndarray, region: dict, params: dict,
                 output_dir: str) -> str:
    """Crop to region and trace it independently."""
    x, y, w, h = region["x"], region["y"], region["w"], region["h"]
    crop = binary[y:y+h, x:x+w]

    out_path = os.path.join(output_dir, f"{region['label']}.svg")
    trace_to_svg(crop, params, out_path)
    return out_path


# ── 5a. SEPARATE PATHS ───────────────────────────────────────────────────────

def split_svg_paths(svg_path: str, params: dict) -> str:
    """
    Parse potrace compound path → individual <path> elements classified as
    primary / secondary / detail by bounding-box area relative to image area.
    Shapes are ordered largest-first and grouped in three <g> elements.
    """
    with open(svg_path) as f:
        content = f.read()

    path_match = re.search(r'<path\b[^>]*\bd="([^"]+)"', content)
    if not path_match:
        return svg_path

    d_attr = path_match.group(1)

    # Preserve viewBox / dimensions
    vb_match = re.search(r'viewBox="([^"]+)"', content)
    vb = f'viewBox="{vb_match.group(1)}"' if vb_match else ''
    wh_match = re.search(r'<svg[^>]*width="([^"]+)"[^>]*height="([^"]+)"', content)
    wh = f'width="{wh_match.group(1)}" height="{wh_match.group(2)}"' if wh_match else ''

    # Total image area from viewBox (fallback: large)
    img_area = 1e9
    if vb_match:
        parts = vb_match.group(1).split()
        if len(parts) == 4:
            try:
                img_area = float(parts[2]) * float(parts[3])
            except ValueError:
                pass

    stroke_color = params.get("stroke_color", "#1a1a1a")
    stroke_width = params.get("stroke_width", 1.0)
    fill_mode    = params.get("fill_mode", "stroke_only")
    min_area     = params.get("min_area", 80)

    if fill_mode == "stroke_only":
        style = f'fill="none" stroke="{stroke_color}" stroke-width="{stroke_width}"'
    else:
        style = f'fill="{stroke_color}" stroke="none"'

    # Split compound path on each M opener
    subpaths = re.split(r'(?=M[\s\d\-])', d_attr.strip())
    subpaths = [s.strip() for s in subpaths if s.strip()]

    shapes = []
    for seg in subpaths:
        nums = list(map(float, re.findall(r'[-+]?\d*\.?\d+', seg)))
        if len(nums) < 4:
            continue
        xs = nums[0::2]; ys = nums[1::2]
        bbox_w = max(xs) - min(xs)
        bbox_h = max(ys) - min(ys)
        bbox_area = bbox_w * bbox_h
        if bbox_area < min_area:
            continue
        shapes.append({"d": seg, "area": bbox_area})

    # Sort largest first
    shapes.sort(key=lambda s: s["area"], reverse=True)

    # Classify relative to total image area
    for s in shapes:
        ratio = s["area"] / img_area
        if ratio > 0.30:
            s["cls"] = "primary"
        elif ratio >= 0.05:
            s["cls"] = "secondary"
        else:
            s["cls"] = "detail"

    # Build grouped SVG
    groups = {"primary": [], "secondary": [], "detail": []}
    for i, s in enumerate(shapes):
        shape_id = f"shape-{i+1:03d}"
        el = (f'    <path id="{shape_id}" data-class="{s["cls"]}" '
              f'data-area="{int(s["area"])}" {style} d="{s["d"]}"/>')
        groups[s["cls"]].append(el)

    g_primary   = "  <g id=\"primary-shapes\">\n"   + "\n".join(groups["primary"])   + "\n  </g>"
    g_secondary = "  <g id=\"secondary-shapes\">\n" + "\n".join(groups["secondary"]) + "\n  </g>"
    g_detail    = "  <g id=\"detail-shapes\">\n"    + "\n".join(groups["detail"])    + "\n  </g>"

    new_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" {wh} {vb}>\n'
               f'{g_primary}\n{g_secondary}\n{g_detail}\n</svg>')

    with open(svg_path, 'w') as f:
        f.write(new_svg)

    return svg_path


# ── 5b. SIMPLIFIED ────────────────────────────────────────────────────────────

def simplify_svg(svg_path: str, params: dict) -> str:
    """
    Re-derive simplified paths via OpenCV contour approximation:
    load the binary image, run approxPolyDP on every contour, emit SVG paths.
    """
    # The binary image was written alongside the SVG; reconstruct it from params
    # We'll pass the binary as a side-channel via a temp file set in run_pipeline.
    # If not present, return the svg unchanged.
    bin_path = svg_path.replace('.svg', '_binary.png')
    if not os.path.exists(bin_path):
        return svg_path

    binary = cv2.imread(bin_path, cv2.IMREAD_GRAYSCALE)
    if binary is None:
        return svg_path

    h, w = binary.shape
    stroke_color = params.get("stroke_color", "#1a1a1a")
    stroke_width = params.get("stroke_width", 1.0)
    fill_mode    = params.get("fill_mode", "stroke_only")
    min_area     = params.get("min_area", 80)

    if fill_mode == "stroke_only":
        style = f'fill="none" stroke="{stroke_color}" stroke-width="{stroke_width}"'
    else:
        style = f'fill="{stroke_color}" stroke="none"'

    # Invert: findContours expects white objects on black
    inv = cv2.bitwise_not(binary)
    contours, _ = cv2.findContours(inv, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    path_elements = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue
        eps = 2.0 * cv2.arcLength(contour, True) * 0.002
        approx = cv2.approxPolyDP(contour, eps, True)
        if len(approx) < 3:
            continue
        pts = approx.reshape(-1, 2)
        d = "M " + " L ".join(f"{x},{y}" for x, y in pts) + " Z"
        path_elements.append(f'  <path {style} d="{d}"/>')

    new_svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
        + "\n".join(path_elements)
        + "\n</svg>"
    )

    with open(svg_path, 'w') as f:
        f.write(new_svg)

    return svg_path


# ── 5. SVG POST-PROCESS ──────────────────────────────────────────────────────

def postprocess_svg(svg_path: str, params: dict) -> str:
    """
    Clean up potrace SVG output:
    - Set correct viewBox
    - Apply stroke-only style (no fill) for your contour language
    - Scale to target size
    - Embed grammar metadata as SVG comment
    """
    with open(svg_path, "r") as f:
        content = f.read()

    stroke_color  = params.get("stroke_color", "#1a1a1a")
    stroke_width  = params.get("stroke_width", 1.0)
    target_width  = params.get("target_width", 800)
    fill_mode     = params.get("fill_mode", "stroke_only")  # or "filled"

    # Potrace outputs filled black paths — switch to stroke-only for your language
    if fill_mode == "stroke_only":
        content = re.sub(r'\s+stroke(?:-width)?="[^"]*"', '', content)
        style = f'fill="none" stroke="{stroke_color}" stroke-width="{stroke_width}"'
        content = re.sub(r'fill="(?:black|#000000|#000)"', style, content)

    # Inject grammar metadata comment
    grammar = params.get("grammar_params", {})
    meta = f"<!-- ShapeGrammar: {json.dumps(grammar)} -->"
    content = content.replace("</svg>", f"\n{meta}\n</svg>")

    with open(svg_path, "w") as f:
        f.write(content)

    return svg_path


# ── 6. MAIN PIPELINE ─────────────────────────────────────────────────────────

DEFAULT_PARAMS = {
    # Preprocessing
    "denoise": True,
    "contrast_boost": 1.5,
    "blur_radius": 1,
    "threshold_block": 35,
    "threshold_c": 8,
    "min_area": 80,

    # Tracing
    "turdsize": 4,
    "alphamax": 1.0,
    "opttolerance": 0.2,
    "turnpolicy": "minority",
    "trace_mode": "single",   # single | separate | simplified

    # Output style
    "stroke_color": "#1a1a1a",
    "stroke_width": 1.2,
    "fill_mode": "stroke_only",
    "target_width": 800,

    # Grammar params (get embedded in SVG metadata)
    "grammar_params": {
        "curve_tension": 0.85,
        "nesting_depth": 2,
        "density": 0.90,
        "variation_index": 0.35,
        "boundary_pressure": 0.85,
        "stroke_weight_ratio": 2.0,
        "vertical_bias": 0.5,
        "composition_mode": "auto"  # auto | columnar | scene
    }
}


def run_pipeline(input_path: str, output_dir: str,
                 params: dict = None, split_regions: bool = True) -> dict:
    """
    Full pipeline: image → SVG(s)
    Returns dict with output paths and metadata.
    """
    os.makedirs(output_dir, exist_ok=True)
    p = {**DEFAULT_PARAMS, **(params or {})}

    # Load
    img = load_image(input_path)
    img = normalise_orientation(img)
    orig_h, orig_w = img.shape[:2]

    # Preprocess
    binary = preprocess(img, p)
    trace_mode = p.get("trace_mode", "single")

    # Simplified mode overrides potrace params for aggressive simplification
    if trace_mode == "simplified":
        p = {**p, "turdsize": 20, "alphamax": 1.33, "opttolerance": 0.8}

    results = {"input": input_path, "regions": [], "params": p,
               "trace_mode": trace_mode}

    if split_regions:
        regions = detect_regions(binary)
    else:
        regions = [{"x": 0, "y": 0, "w": orig_w, "h": orig_h, "label": "full"}]

    for region in regions:
        svg_path = trace_region(binary, region, p, output_dir)
        svg_path = postprocess_svg(svg_path, p)
        # Save binary tile alongside SVG for simplified mode
        if trace_mode == "simplified":
            x, y, w, h = region["x"], region["y"], region["w"], region["h"]
            bin_tile = binary[y:y+h, x:x+w]
            cv2.imwrite(svg_path.replace(".svg", "_binary.png"), bin_tile)
            svg_path = simplify_svg(svg_path, p)
        elif trace_mode == "separate":
            svg_path = split_svg_paths(svg_path, p)
        results["regions"].append({
            "label": region["label"],
            "bounds": {k: region[k] for k in ["x","y","w","h"]},
            "svg": svg_path
        })
        print(f"  ✓ {region['label']} → {svg_path}")

    # Also save full-image trace
    full_path = os.path.join(output_dir, "full.svg")
    trace_to_svg(binary, p, full_path)
    postprocess_svg(full_path, p)
    if trace_mode == "simplified":
        cv2.imwrite(full_path.replace(".svg", "_binary.png"), binary)
        simplify_svg(full_path, p)
    elif trace_mode == "separate":
        split_svg_paths(full_path, p)
    results["full_svg"] = full_path
    print(f"  ✓ full → {full_path}")

    # Save params/metadata
    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(results, f, indent=2)

    return results


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python process.py <input_image> <output_dir>")
        sys.exit(1)

    input_path  = sys.argv[1]
    output_dir  = sys.argv[2]
    results = run_pipeline(input_path, output_dir)
    print(f"\nDone. {len(results['regions'])} regions extracted.")
    print(f"Full SVG: {results['full_svg']}")
