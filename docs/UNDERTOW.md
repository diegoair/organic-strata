# Undertow — User Manual

> Organica · Warping's contours, set moving
> Live: [theorganicalanguage.vercel.app/undertow/](https://theorganicalanguage.vercel.app/undertow/)
> Last updated: October 1, 2026

---

## 1. What Undertow does

Warping poses a still: wood grain, marble veining, a cellular network, level
curves. Undertow takes the **SVG Warping exports** and sets its edges moving.
At rest the picture *is* the source file. The motion is everything around it:
contours that flow, a travelling wave, a swirl, a slow breath, a fine shimmer,
and layers that slide against each other.

It is one half of a pair. **Dapple** does the same for Komorebi. Both run on one
engine, `shared/bandfield.js` (`Organica.bandField`). Murmur is the mark-field
cousin (Pollen / Spore / Halide).

Output: a **seamless video loop** (MP4 / WebM).

---

## 2. Input — which SVGs work

A Warping export (Screen mode) is one full-canvas `<rect>` (the ground) plus one
`fill-rule="evenodd"` `<path>` per tone band, painted in order, each a stack of
straight `M / L / Z` boundaries. Undertow reads exactly that.

- Since Oct 1, 2026 Warping writes
  `<metadata id="organica">{"tool":"warping","bands":N,"W":…,"H":…}</metadata>`.
  Older files without it are accepted by shape.
- **Refused, with a message:** Print-mode files (mm / cm / in); mark exports
  (Pollen / Spore / Halide — "open it in Murmur"); a Komorebi export ("open it
  in Dapple"); curved paths; files with no band paths; more than 220,000
  boundary points (export fewer bands or a lower detail).
- Every refusal is a visible notice, never a silent no-op.

**Detail budget.** The picture is redrawn 60 times a second, so geometry is
capped at ~120,000 vertices. Long staircase edges are first cut into short
segments (otherwise only their corners would move); if that would exceed the
cap, the segment length grows until it fits and the status line says "detail
reduced to fit". Measured: a 155,000-point Komorebi export holds 60 fps.

---

## 3. How it moves

Every vertex of every band boundary is displaced by **one** field, so the
stacked bands keep nesting (no gaps between them). The field is the sum of:

| Control | What it does |
|---|---|
| **Flow** | the contours drift on a noise field |
| **Wave** | a transverse wave travels across; **Wavelength**, **Wave angle** |
| **Swirl** | the whole field turns about its centre |
| **Breathe** | scales about the centre, rippling outward |
| **Rustle** | a fine, fast shimmer |
| **Stagger** | each band lags the previous one by a fraction of a turn: layers slide |
| **Flicker** | each band's opacity pulses at its own phase |

Shared: **Amplitude** (pixels of a 1200-unit canvas, scaled to the file),
**Cycles** (whole turns of every periodic term per loop), **Scale** (feature size
of the noise). **Smooth** rounds the staircase into soft contours (it shrinks
loops very slightly — at Smooth 0 and Amplitude 0 the first frame is the source,
pixel for pixel). **Detail** sets the subdivision density.

Vertices on the canvas border stay on it (they may slide along it), so the
full-canvas band never pulls in from the edge and exposes the ground.

### Presets

Flow, Tide, Ripple, Marble, Strata, Source (the file as exported), plus your own
(**Save** / **Delete**, stored with `Organica.store('undertow')`). Each thumbnail
is the real engine on a small synthetic model, amplitude exaggerated ×4, the
source outline as a hairline.

---

## 4. Looping

There is **no pre-roll and no integrated state**: a frame is a pure function of
time. Every term is periodic in `2π · t / loop · cycles` (Cycles is a whole
number), and the noise terms travel on a circle through the noise plane, so the
frame at `t` and at `t + loop` are the same geometry exactly (verified by
comparing every vertex and every band alpha at t = 0, 8, 16 s).

- **Loop** (floatbar): 1–30 s.
- **Record loop** (floatbar → Export): one loop in real time through
  `Organica.recorder`, re-rendered at **Source / 1080 / 2160 / 3840** long edge
  (the bands are vector, so it stays crisp). MP4 or WebM, whichever the browser
  offers. Verified here: a 2 s MP4 at source size, 800 KB.
- **Space** pauses; **Restart** goes back to t = 0.

---

## 5. Measured

- Rest frame vs Chrome's own render of the source SVG: **0 differing pixels**
  (600×400 raster).
- Frame time (1800×1200 canvas): ~2 ms for a 31,000-point Warping export,
  ~7 ms with Stagger (one field per band).
- `ctx.closePath()` is deliberately not called per boundary: `fill()` closes
  every subpath itself, and `closePath()` cost ~12 µs *per subpath* in Chrome
  (3,120 small boundaries: 37 ms with it, 0.3 ms without).

Not verified: Safari / Firefox `MediaRecorder` codec support.

---

## 6. Code map

- `undertow/index.html` — the page (single file, generated from the same
  template as Dapple).
- `shared/bandfield.js` — `parse` / `prepare` / `create` / `panel` / `diff` /
  `thumb`; `docs/DAPPLE.md` for the sibling tool.
- Reused: `shared/recorder.js`, `shared/noise.js` (simplex2),
  `shared/select-picker.js`, `Organica.store`.
