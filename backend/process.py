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
        style = f'fill="none" stroke="{stroke_color}" stroke-width="{stroke_width}"'
        # Replace fill="black" and fill="#000000" 
        content = content.replace('fill="black"', style)
        content = content.replace('fill="#000000"', style)
        content = content.replace('fill="#000"', style)

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

    results = {"input": input_path, "regions": [], "params": p}

    if split_regions:
        regions = detect_regions(binary)
    else:
        regions = [{"x": 0, "y": 0, "w": orig_w, "h": orig_h, "label": "full"}]

    for region in regions:
        svg_path = trace_region(binary, region, p, output_dir)
        svg_path = postprocess_svg(svg_path, p)
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
