"""
Sketch → SVG Pipeline
Core processing engine: photo/scan → clean vector SVG

One engine only: vtracer over enclosed cell regions ("Smart"). Single/
Separate/Simplified/Regions(CV) potrace-based modes were removed — they
traced ink pixels directly (each pen stroke became its own filled ribbon
shape) instead of the enclosed cell the hand-drawn lines close off, which
never matched the goal (one clean bezier shape per drawn cell) and pulled in
a whole external-binary dependency (potrace) for a worse result.
"""

import cv2
import numpy as np
import tempfile
import os
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


# ── 3. ENCLOSED-CELL PREP ────────────────────────────────────────────────────

def _prepare_enclosed_regions(binary_img: np.ndarray, output_dir: str = None,
                               debug_name: str = "debug_enclosed_regions.png") -> np.ndarray:
    """
    Convert a binary sketch image so enclosed white regions (the cells the
    hand-drawn lines close off) become BLACK, and everything else is WHITE.

    This is the whole trick: left to trace the raw ink pixels directly, a
    tracer reproduces the ink stroke's own filled footprint (a ribbon
    following the pen's width/wobble) instead of a single clean cell
    boundary. Converting to "the enclosed cell is the shape" first is what
    makes the output one clean bezier path per drawn shape.
    """
    h, w = binary_img.shape

    # Close small gaps between ink lines so enclosed regions seal properly
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    dilated = cv2.dilate(cv2.bitwise_not(binary_img), kernel, iterations=2)
    closed = cv2.bitwise_not(dilated)

    # Flood fill exterior from all 4 corners → remaining white = enclosed regions
    flood = closed.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, mask, (0,     0    ), 0)
    cv2.floodFill(flood, mask, (w - 1, 0    ), 0)
    cv2.floodFill(flood, mask, (0,     h - 1), 0)
    cv2.floodFill(flood, mask, (w - 1, h - 1), 0)

    # Invert: enclosed regions become BLACK (vtracer traces black shapes)
    regions = cv2.bitwise_not(flood)

    # The dilate above thickened every ink line to close small gaps, which
    # permanently shrinks each cell inward from where the pen actually was —
    # visible as a gap between the sketch underlay and the traced path in
    # Refine. Erode the found regions back out by the same amount (dilate
    # then erode = morphological "closing": gaps still seal, but the
    # boundary lands back on the ink instead of inside it).
    regions = cv2.erode(regions, kernel, iterations=2)

    # Remove small noise specks
    kernel_clean = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    regions = cv2.morphologyEx(regions, cv2.MORPH_OPEN, kernel_clean)

    # Pad with 50px black border so tracer coordinates never go negative
    regions = cv2.copyMakeBorder(regions, 50, 50, 50, 50,
                                  cv2.BORDER_CONSTANT, value=0)

    if output_dir:
        debug_path = os.path.join(output_dir, debug_name)
        cv2.imwrite(debug_path, regions)
        print(f"  debug: enclosed-region input saved → {debug_path}")

    return regions


# ── 4. TRACE (vtracer) ───────────────────────────────────────────────────────

_FIDELITY_VTRACER = {
    1:  dict(filter_speckle=80, corner_threshold=130, length_threshold=20.0, splice_threshold=90),
    2:  dict(filter_speckle=60, corner_threshold=120, length_threshold=16.0, splice_threshold=80),
    3:  dict(filter_speckle=45, corner_threshold=110, length_threshold=12.0, splice_threshold=70),
    4:  dict(filter_speckle=35, corner_threshold=100, length_threshold=10.0, splice_threshold=60),
    5:  dict(filter_speckle=25, corner_threshold=90,  length_threshold=8.0,  splice_threshold=50),
    6:  dict(filter_speckle=18, corner_threshold=80,  length_threshold=6.0,  splice_threshold=45),
    7:  dict(filter_speckle=12, corner_threshold=70,  length_threshold=4.5,  splice_threshold=40),
    8:  dict(filter_speckle=8,  corner_threshold=60,  length_threshold=3.0,  splice_threshold=35),
    9:  dict(filter_speckle=5,  corner_threshold=50,  length_threshold=2.0,  splice_threshold=30),
    10: dict(filter_speckle=2,  corner_threshold=40,  length_threshold=1.0,  splice_threshold=25),
}


def trace_with_vtracer(binary: np.ndarray, params: dict, output_dir: str = None) -> str:
    """
    Vectorize enclosed white regions using vtracer (Rust-backed spline tracing).
    Returns a structured SVG with paths classified as primary/secondary/detail.
    """
    # Debug dump, only when a writable dir was actually passed in. This used
    # to be an unconditional cv2.imwrite('output/debug_trace_input.png'),
    # a RELATIVE path that depended on the process's cwd and on that folder
    # existing — it raises on a read-only filesystem, which is every
    # serverless host.
    if output_dir:
        cv2.imwrite(os.path.join(output_dir, "debug_trace_input.png"), binary)

    import vtracer  # required — Smart is the only engine, no fallback to degrade to

    prepared = _prepare_enclosed_regions(binary, output_dir, "debug_vtracer_input.png")

    tmp_in  = tempfile.mktemp(suffix=".png")
    tmp_out = tempfile.mktemp(suffix=".svg")
    try:
        cv2.imwrite(tmp_in, prepared)
        fidelity  = int(params.get("fidelity", 5))
        vt_params = _FIDELITY_VTRACER.get(fidelity, _FIDELITY_VTRACER[5])
        print(f"  vtracer params: fidelity={fidelity} → {vt_params}")
        vtracer.convert_image_to_svg_py(
            tmp_in, tmp_out,
            colormode="binary",
            mode="spline",
            max_iterations=10,
            path_precision=3,
            **vt_params,
        )
        with open(tmp_out) as f:
            svg_str = f.read()
    finally:
        for p in (tmp_in, tmp_out):
            try: os.unlink(p)
            except FileNotFoundError: pass

    if not re.search(r'<path', svg_str):
        return svg_str

    # Classify by d-attribute length as proxy for shape area
    all_d = re.findall(r'd="([^"]+)"', svg_str)
    avg_d = sum(len(d) for d in all_d) / max(len(all_d), 1)

    # Was hardcoded to "#1a1a1a"/1.5 regardless of these params — the Stroke
    # width slider (and any future stroke colour control) never actually
    # reached vtracer's output. Now it does.
    stroke_color = params.get("stroke_color", "#1a1a1a")
    stroke_width = params.get("stroke_width", 1.2)

    shape_counter = [0]

    def process_path(m):
        shape_counter[0] += 1
        tag = m.group(0)
        idx = shape_counter[0]

        d_m = re.search(r'd="([^"]+)"', tag)
        d_len = len(d_m.group(1)) if d_m else 0
        ratio = d_len / avg_d if avg_d > 0 else 0
        cls = "primary" if ratio > 0.15 else "secondary" if ratio > 0.04 else "detail"

        tag = re.sub(r'\bfill="[^"]*"', 'fill="none"', tag)
        tag = re.sub(r'\bstroke(?:-width)?="[^"]*"', '', tag)
        tag = tag.replace(
            "<path ",
            f'<path id="shape-{idx:03d}" data-class="{cls}" '
            f'stroke="{stroke_color}" stroke-width="{stroke_width}" '
        )
        return tag

    result_svg = re.sub(r'<path\b[^>]*/>', process_path, svg_str)

    # Move transform from <path> to wrapping <g> for broader renderer compatibility
    def wrap_with_g(match):
        full_tag = match.group(0)
        t = re.search(r'transform="([^"]+)"', full_tag)
        if t:
            clean_tag = re.sub(r'\s*transform="[^"]+"', '', full_tag)
            return f'<g transform="{t.group(1)}">{clean_tag}</g>'
        return full_tag

    result_svg = re.sub(r'<path\b[^>]*/>', wrap_with_g, result_svg)

    # Add viewBox to SVG element (vtracer omits it)
    result_svg = re.sub(
        r'(<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"[^>]*>)',
        lambda m: m.group(1).replace('>', f' viewBox="0 0 {m.group(2)} {m.group(3)}">', 1),
        result_svg
    )

    total       = result_svg.count('data-class=')
    primaries   = result_svg.count('data-class="primary"')
    secondaries = result_svg.count('data-class="secondary"')
    details     = result_svg.count('data-class="detail"')

    print(f"  ✓ vtracer — {total} shapes "
          f"({primaries}p / {secondaries}s / {details}d)")
    return result_svg


# ── 5. MAIN PIPELINE ─────────────────────────────────────────────────────────

DEFAULT_PARAMS = {
    # Preprocessing
    "denoise": True,
    "contrast_boost": 1.5,
    "blur_radius": 1,
    "threshold_block": 35,
    "threshold_c": 8,
    "min_area": 80,

    # Tracing (vtracer fidelity 1-10, see _FIDELITY_VTRACER)
    "fidelity": 5,

    # Output style
    "stroke_color": "#1a1a1a",
    "stroke_width": 1.2,
}


def run_pipeline(input_path: str, output_dir: str, params: dict = None) -> dict:
    """
    Full pipeline: image → SVG. Always vtracer over enclosed cell regions —
    the only engine that traces "the shape you drew", not "the ink itself".
    """
    os.makedirs(output_dir, exist_ok=True)
    p = {**DEFAULT_PARAMS, **(params or {})}

    # Load
    img = load_image(input_path)
    img = normalise_orientation(img)

    # Preprocess
    binary = preprocess(img, p)

    svg_str   = trace_with_vtracer(binary, p, output_dir)
    full_path = os.path.join(output_dir, "full.svg")
    with open(full_path, "w") as f:
        f.write(svg_str)
    import shutil
    shutil.copy(full_path, os.path.join(output_dir, "latest.svg"))

    return {"input": input_path, "full_svg": full_path, "regions": [], "params": p}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python process.py <input_image> <output_dir>")
        sys.exit(1)

    input_path  = sys.argv[1]
    output_dir  = sys.argv[2]
    results = run_pipeline(input_path, output_dir)
    print(f"\nDone. Full SVG: {results['full_svg']}")
