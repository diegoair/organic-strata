# Halide — User Manual

> Studio Rann · Organica · Photo → True 1-bit Dithered Portrait
> Live: [theorganicalanguage.vercel.app/halide/](https://theorganicalanguage.vercel.app/halide/)
> Last updated: July 24, 2026

---

## 1. What Halide does

Halide turns a photo into a **true 1-bit dithered portrait** — the Mac-System /
screen-print halftone look, built from real error-diffusion and ordered-dithering
algorithms (not a filter or a preset "duotone" effect). It was prototyped after
evaluating [ditherface.com](https://ditherface.com) — a **manual, hand-drawn**
$150-per-slot commission service, not a tool — as a reference for the target look.
Halide reaches for the same aesthetic algorithmically: real dithering, background
removal, a sticker outline, and a background-fill layer, all live and exportable.

Single-file vanilla HTML/CSS/JS, no build step, no external dependencies (unlike
Pollen/Spore it doesn't even load `organic-forms.js` — there's no Genesis shape
placement here, every mark is a plain grid cell; see §14 for why that's a
deliberate, evaluated choice, not an oversight).

---

## 2. Input

Drop a photo anywhere on the page, or **Open…** in the top bar. Any browser-decodable
raster format (JPG/PNG/etc.).

---

## 3. Dither algorithms — the Algorithm segmented control

- **F–S (Floyd–Steinberg, 1976)** — classic 4-neighbour error diffusion.
- **Atkinson** (Bill Atkinson, Apple, 1984) — only diffuses 6/8 of the quantisation
  error, discarding the rest. Punchier and higher-contrast than Floyd–Steinberg —
  the original Mac 1-bit screen / MacPaint look. This is the algorithm behind the
  **Ditherface** preset.
- **Bayer** (ordered dithering) — a recursively-constructed Bayer threshold matrix
  (2×2 / 4×4 / 8×8 / 16×16), tiled across the image. No error diffusion, so it's
  stable/repeatable — a halftone-screen look with no directional streaking.
- **Flat (threshold)** — plain 50% cutoff, no dithering. A baseline for comparison;
  it visibly loses shadow detail, which is *why* dithering exists.

**Serpentine scan** (F–S/Atkinson only) — alternates scan direction each row,
mirroring the diffusion kernel, to avoid directional drag artifacts.

**Resolution — Grid width** sets the working pixel grid (24–400 px wide; height
follows the image aspect, or is forced square — see §7). This is the single most
important control for how "pixelated vs fine-grained" the result reads.

---

## 4. Image — orientation & tone

- **Rotation** (0/90/180/270), **Flip horizontal**, **Invert** (flips which tonal
  half of the photo counts as "ink" — see the swap-colours note in §9).
- **Gamma / Contrast / Bias** — the tone-mapping stack, applied in that order
  before thresholding/diffusion. Bias is a flat shift (±50), useful for nudging
  overall ink coverage without touching the gamma curve's shape.

---

## 5. Square crop (avatar) — interactive positioning

Toggling **Square crop** doesn't just centre-crop — click **Position crop…** to
open a **drag-to-position overlay**: it shows the full, un-cropped, oriented
source image with a draggable square frame and the outside darkened (the classic
crop-tool look). **Drag** to move the frame, **Enter** confirms, **Esc** cancels.
The chosen offset persists until you reposition or load a new photo (loading a new
photo resets it to centred).

*(Earlier iteration: this was two Crop X/Y sliders. Replaced entirely by the
drag overlay per direct feedback — sliders divorced from the visual you're
actually cropping are a worse interaction than seeing the frame on the photo.)*

---

## 6. Remove background

**Remove background** keys out a solid backdrop before dithering, so it renders
as a flat, noise-free area instead of getting dithered along with the subject —
matching how the reference portraits always have a perfectly clean background.

- **Tolerance** — colour-distance reach from the reference colour (0–100, mapped
  to a 0–765 Manhattan RGB distance). Every pixel within Tolerance of the
  reference counts as background — a global colour-key threshold, not a
  connected-region flood fill (see the design note below for why).
- **Reference — Pick… / Auto** — **Auto** averages the image *border* colour as
  the reference (works when the subject doesn't touch the frame edge). **Pick…**
  lets you click an actual spot of background in the image — click **Pick…**,
  then click the photo. This is the reliable path: the moment hair, a shoulder,
  or a garment touches the frame edge, the border average gets contaminated and
  Auto under-performs. Loading a new photo resets the reference to Auto.

**Why global colour-key, not connected flood-fill:** an earlier version chained
pixel-to-pixel comparisons outward from the border (accept a pixel if it's close
to its *already-accepted neighbour*). That let a flood spread across any gradual
lighting gradient — including gradients **inside the subject** (a soft-lit
cheek, a shoulder) — because each individual step was small even though the
total drift was large. On a real test photo it ate ~99% of the face. The fix:
test every candidate pixel against one **fixed** reference colour (the picked
point, or the border average), never against a neighbour. Simpler code, and it
stops exactly at the real subject/background tonal edge instead of drifting
through it.

---

## 7. Outline — the sticker ring

**Outline** traces a solid **white** ring around the subject's silhouette —
independent of Ink/Paper colour choice, always white, always solid. Needs
**Remove background** on (it needs a subject/background distinction to trace).
**Width** in cells, default 1.

**Silhouette clean-up (why the ring doesn't chase every stray hair):** colour-key
background removal leaves small gaps wherever a wispy, rim-lit hair strand
blends close enough to the backdrop colour to be misread as background. Two
fixes, applied only to the mask the *outline* traces from (the dithered image
itself still uses the raw, precise mask — this clean-up doesn't blur real
detail):
1. **Largest connected component** — keep only the biggest connected blob of
   "kept" pixels, dropping stray wisps that broke off the main mass instead of
   tracing a tiny ring around each one.
2. **Fill enclosed holes** — a hole fully surrounded by the kept blob (e.g. a
   bright highlight briefly misread as background) is folded back in via a
   border flood-fill of the complement: whatever the flood *can't* reach from
   the canvas edge is enclosed, so it gets filled.

A fixed-radius morphological closing was tried first and rejected: too small a
radius left the gaps; a large enough radius to bridge them ate square chunks out
of real concavities (the neck, under the jaw) because a square structuring
element doesn't respect the actual shape.

**Diagonal-gap bridging:** the ring is one connected loop mathematically (proven:
its own connected-component count is always 1), but wherever the silhouette
steps diagonally, two ring cells can end up touching only at a *corner*, not a
shared edge — filled as separate unit squares, that's a real visual pinch at
high zoom, even though the ring never actually breaks. `bridgeDiagonalGaps()`
scans every 2×2 block for a corner-only crossing and fills one elbow cell to
make the path fully edge-connected. Verified at 1200%+ zoom: solid, unbroken band.

---

## 8. Background fill

**Background fill** colours everything **outside** the outline — found purely by
subtraction (canvas margins minus the silhouette minus the ring itself) — with
its own colour, independent of Paper. Needs **Outline** on. Paper/Transparent
still govern the *kept subject's own* non-ink cells (skin highlights, an eye's
white) — only the true "outside" area takes the new colour. Verified pixel-exact
under **Paper is transparent** too: the outside area stays a fully opaque fill
while the subject's own paper cells go transparent — two independently
controlled layers.

---

## 9. Color

- **Ink / Paper** — any two colours, plus **Swap colors**. Swap is a **true**
  recolour: it only trades the two hex values, it does **not** touch Invert or
  recompute which cells are ink. (Verified byte-for-byte: the `rects` array is
  identical before and after a swap.) An earlier version *did* auto-toggle
  Invert on swap — reverted after direct feedback: toggling Invert actually
  changes which cells count as ink (a real image change), which is a different
  operation from "the same picture, recoloured." If you want the classic
  white-ink/black-paper look with correct *tonal* polarity (dark photo regions
  reading as dark, not inverted to light), toggle **Invert** yourself alongside
  the colour choice — that's a deliberate, separate decision now, not bundled
  into Swap.
- **Paper is transparent (PNG/SVG)** — skips Paper entirely (real alpha), so only
  Ink is drawn. Independent of Remove background — this is "the dither texture
  as a stamp/overlay," useful even with no background removed at all. JPG has no
  alpha channel, so it always falls back to a flat Paper fill regardless of this
  toggle.

---

## 10. Presets

Built-ins: `Mac Classic (Atkinson)` · `Newspaper (Bayer 4×4)` ·
`Film Grain (Floyd–Steinberg)` · `Halftone Coarse (Bayer 8×8)` ·
`Fine Grain (Bayer 16×16)` · `High-Contrast Portrait` · `Threshold (no dither)` ·
**`Ditherface`**.

**Ditherface** is the validated match to the reference look: Atkinson · square
crop · background removed (Tolerance 24) · Outline (width 1) · Background fill
(`#000000`) · Ink `#0a0a0a` / Paper `#f5f2ec` · Invert off · Transparent off.

Presets are fully deterministic — applying one resets *every* field it covers
(algorithm, tone, colours, background-removal/outline/background-fill state,
Invert, Transparent) regardless of whatever was set before. What presets
deliberately **don't** touch (photo-specific, not a style choice): the picked
background reference colour and the crop position — both reset to their neutral
default (Auto / centred) whenever a preset is applied or a new photo loads, not
carried over from the preset itself.

**Save** writes a custom preset to `localStorage` (captures the same full field
set as the built-ins). **Delete** only works on custom presets — built-ins are
protected.

---

## 11. Export

Top bar: **PNG · JPG · SVG**, plus **→ Figma** (same `organica-svg` postMessage
protocol as Spore/Pollen/Living Path). **Export Scale** (×2 to ×12) sets pixels
per dithered cell in the raster/SVG output — independent of the live preview's
own display scale.

**Show block structure** (Preview, in the Dither section) — a wireframe view:
strokes the merged block boundaries instead of filling them, on canvas *and* in
export. This is the adaptive-block debug/aesthetic view: big blocks in flat
regions, a fine mesh where there's detail — the direct evidence for the "one
shape per pixel would be wasteful" argument below.

### Simplify shapes (SVG only)

A checkbox next to the SVG button, **off by default**. When on, every region
(background fill, kept-paper, outline, ink) is traced into a **single
rectilinear `<path>`** — straight horizontal/vertical segments only, no curve
fitting, keeping the blocky look — instead of a `<g>` full of individual
`<rect>` tiles. `fill-rule="evenodd"` handles holes and nested regions correctly
regardless of each loop's winding direction (e.g. the background-fill "frame
with a subject-shaped hole").

Verified by rasterising both the tiled and simplified SVG and diffing pixels:
**0 differing pixels** across every tested case (plain Ditherface, with
Outline + Background fill, and a dense Bayer stress test for the diagonal-touch
disambiguation). Typical reduction on a real photo: **4,789 `<rect>` → 4
`<path>`** elements, ~36% smaller file. Left off by default because some
downstream workflows (per-cell editing after **→ Figma**) want the individual
rects; wireframe mode always keeps individual rects regardless of this toggle
(that view exists specifically to show the blocks).

**Why not literally merge into fewer *rectangles* instead of paths?** The
existing 2D greedy rectangle merge (`mergeRects`, grows each block right then
down) already collapses same-value runs into big blocks where the image is
flat — that's what makes the block-structure view work. But a single rectangle
can't represent an L-shaped or organically-curved connected region; contour
tracing is the actual fix for "many small adjacent shapes that are really one
connected blob," which is what the user-reported case looked like.

---

## 12. A typical workflow

1. **Drop a photo**.
2. Pick **Ditherface** from Presets (or build your own: Atkinson, Square crop,
   Remove background).
3. If the background wasn't fully removed (subject touches the frame edge),
   click **Pick…** and click an actual background pixel in the photo.
4. **Position crop…** if the framing needs adjusting.
5. Turn on **Outline** / **Background fill** for the sticker look, or leave them
   off for a plain portrait.
6. Export — **SVG** with **Simplify** on for the lightest file, **→ Figma** to
   keep working there, or **PNG** for immediate use.

---

## 13. Tips & gotchas

- **White-on-black looking "worse" than black-on-white for the same photo?**
  This is usually correct, not a bug: if hair/dark clothing occupy a lot of the
  frame, inverting to white-ink/black-paper means the *darkest* tones now get
  the *least* ink coverage — they can visually sink into the black backdrop and
  lose definition. Dark-ink/light-paper (the default) always keeps strong
  contrast for the darkest tones, since ink is never the same colour as the
  backdrop. Prefer the default unless the photo's tonal balance suits an invert.
- **Auto background reference wrong?** The subject almost certainly touches the
  frame border somewhere. Use **Pick…** instead of Auto.
- **Outline / Background fill greyed out?** Outline needs Remove background on;
  Background fill needs Outline on — each is a refinement of the layer below it.
- **A real photo's tonal range is narrower than it looks** — a high-key studio
  shot can have almost no pixels in the 0.5–0.7 luma band, all bunched at the
  very top. Gamma/Contrast/Bias are flat/curve adjustments, not a levels stretch
  — for most photos they're enough, but don't expect them to manufacture detail
  that genuinely isn't spread across the tonal range.

---

## 14. Why squares, not Genesis organic forms

Evaluated directly: swapping the ink cell's shape from a square to a Genesis
form (drop/dot/etc.) was considered and set aside. Two concrete reasons, not
just "different aesthetic":

1. **It would duplicate Pollen.** Pollen already places Genesis forms by
   tone-driven density (blue-noise stippling). Doing the same thing under
   Halide's name doesn't add a new capability to Organica — it blurs two tools
   that are currently distinct.
2. **It would undo the Simplify-shapes win.** Contour tracing (§11) only works
   because dithered cells are rectilinear — adjacent same-value cells merge
   into a clean boundary. An organic mark per cell doesn't merge with its
   neighbours the same way; SVG export would go back to one shape per cell
   (thousands of `<use>`/`<path>` elements), and live preview would get
   meaningfully slower (parsing/transforming a real path per cell vs. a plain
   `fillRect`).

If a hybrid "organic-mark dithering" look is wanted later, it should be scoped
as an **additional mark-shape style** (small Genesis primitive filling the cell
1:1, no overlap with neighbours — preserving tonal accuracy) rather than a
wholesale replacement, with the explicit tradeoff that Simplify wouldn't apply
to that mode.

**Also evaluated and deferred:** hover-reactive or autonomously-animated pixels.
Autonomous animation (noise/time-driven, no input) fits Organica's existing
Motion vocabulary (Genesis's "Collective Behaviour" pattern — staggered
`animation-delay` + goo filter) and could ship as an animated SVG export.
Mouse-hover reactivity needs real JavaScript reading cursor position — it can't
be a static export file (PNG/SVG); it would need to be a separate interactive
page/demo, a different deliverable from what Halide produces today. Neither is
built yet.

---

## 15. Architecture notes

- **Pipeline:** `sampleOriented()` (draw rotated/flipped/cropped source, raw
  RGBA) → `backgroundMask()` (colour-key, if on) → `brightnessField()`
  (luma + invert/gamma/contrast/bias, background forced to pure white) →
  one of `ditherErrorDiffusion` / `ditherBayer` / `ditherThreshold` → binary
  `cells` → `mergeRects()` (2D greedy rectangle merge — the shared
  representation painted to canvas **and** serialised to SVG, so preview and
  export can never drift apart, the same WYSIWYG discipline as Pollen/Living
  Path) → (if Outline on) `largestComponent` → `fillEnclosedHoles` →
  `outlineRing` → `bridgeDiagonalGaps` → (if Background fill on) subtract for
  the outside/kept-paper masks.
- **Raw per-cell masks are kept alongside the merged rects** (`inkCellsMask`,
  `ringCellsMask`, `outsideCellsMask`, `keptNonInkCellsMask`) specifically so
  SVG export's Simplify option can trace contours from the exact same source
  data the rects were merged from — no reconstruction, no drift.
- **`mergeRects`** grows each block right then down as far as it stays solid —
  flat regions collapse into one big block; noisy dithered texture stays fine.
- **`traceContours`** walks boundary edges clockwise (SVG y-down space) with a
  tightest-clockwise-turn priority to resolve "checkerboard" saddle points
  (two ink cells touching only at a corner) without special-casing them.
- **Crop positioning** renders the *full, un-cropped* oriented source into a
  dedicated overlay canvas (`#crop-preview-canvas`) at whatever scale fits the
  viewport, with a draggable frame (`#crop-frame`) sized to the shorter
  oriented dimension; confirming maps the frame's final pixel position back to
  a `-100..100` offset consumed by `drawOriented()`'s existing 'cover'-fit math
  (the same offset model the crop sliders used, before they were replaced by
  the drag overlay).

---

## 16. Development notes & context

- **Files deliberately kept out of git:** `halide/test-photos/` — Diego's real
  test photo, used as the fixed reference for every feature verified after it
  was added (background removal, outline, background fill, Simplify shapes).
  Same convention as `backend/fitCurves.py` / `backend/output/` /
  `design_handoff_genesis_creator/` (see `docs/LIVINGPATH.md` §12) — documented
  as excluded, not `.gitignore`d, so `git status` always shows it explicitly
  and a stray `git add -A` doesn't silently sweep it in.
- **Browser-session state can go stale mid-investigation.** More than once
  during development, a sequence of separate automated script calls against
  the *same* long-lived tab produced inconsistent readings (global state that
  didn't match what a fresh reload + single atomic script showed). When a
  measurement looks contradictory, prefer a hard reload and one self-contained
  script over trusting several sequential calls against old tab state.
- **Manual ASCII/visual dumps are easy to miscount.** A "gap" first suspected
  in the outline turned out to be a character-counting error in a hand-eyeballed
  debug dump, not a real defect — the real (and different) bug was the
  diagonal-corner-touch pinch (§7). Prefer programmatic checks (connected-
  component counts, exact coordinate distance checks) over reading rendered
  ASCII/pixels by eye when verifying topology.
- **Dev-server caching** (same as Living Path, §12 of that manual): hard-refresh
  or append `?v=…` when testing — a plain reload can serve the pre-edit file.

---

*Studio Rann · Organica System v0.1*
