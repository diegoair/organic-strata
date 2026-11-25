# Social export — plan (backlog 1.1, Nov 25, 2026)

*Status: **P1–P3 built Nov 25, 2026** (`shared/mp4.js`, `shared/social-export.js`, `scripts/test-social-export.sh` — 17 checks; Pulsar › Export › Social, `scripts/test-pulsar-social.sh` — 14; the hero loops: `shared/hero-social.js` + the hub's Social, `scripts/test-hero-social.sh` — 14, `scripts/test-hub-social.sh` — 12); P4–P5 not started. O-106 answered Nov 25 as recommended (ledger §2). Source: `explorations/home-mockups/NOTES.md`
§ "Backlog with cost-benefit", item 1.1 (L · ★★★).*

## 1. Goal

One shared module that turns a piece into posts: **stills** (PNG + SVG) and **reels** (MP4, one seamless cycle) in the
social formats, downloaded as **one ZIP**. Every tool that has something to post calls the same module, so the formats,
the encoder and the file names are decided once.

## 2. What already exists (checked Nov 25, 2026)

| Piece | Where | What it gives the module |
|---|---|---|
| Frame-accurate H.264 encode | `explorations/home-mockups/ig-export.html` (`clip`) | WebCodecs `VideoEncoder`, one `VideoFrame` per tick of the source's own clock, 2 s keyframes, encode-queue back-pressure |
| A small MP4 writer | same file (`mp4`) | one video track, `moov` before `mdat`: plays and seeks everywhere and Instagram takes it. MediaRecorder's MP4 is fragmented and declares only its first fragment's length (a 41 s clip read as 3.35 s), so this is needed |
| Seamless loop by pre-roll | same file | run one full cycle unrecorded, then record one cycle: the clip ends where it starts and never opens on an empty sheet |
| SVG → PNG raster | same file (`raster`) | the frame's SVG drawn through an `Image` onto a canvas, Paper filled first |
| The formats | `mote/index.html` `MOTE_SOCIAL` | 1:1 1080², 9:16 1080×1920, 4:5 1080×1350, 16:9 1920×1080, 3:2 1620×1080 |
| A STORE-only ZIP | `shared/zip.js` (`Organica.zip`) | `add(path, data)` → `blob()`; used by Living Path |
| Download + file names | `shared/core.js` | `Organica.download`, `Organica.stamp` |
| Realtime recorder | `shared/recorder.js` | MediaRecorder WebM/MP4 from a live canvas: a fallback only, not frame-accurate |

## 3. The module

Two files, both `window.Organica.*`, no UI (each tool keeps its own controls):

- **`shared/mp4.js`** — `Organica.mp4.write(samples, avcC, W, H, timescale, sampleDur) → Uint8Array`. The prototype's
  writer, lifted as it is. Separate, because Mote's offline encoder can move onto it later.
- **`shared/social-export.js`** — `Organica.socialExport`:
  - `FORMATS` — `{ '4x5': [1080, 1350], '9x16': [1080, 1920], '1x1': [1080, 1080], '16x9': [1920, 1080] }` (O-106 e).
  - `support()` → `Promise<{ stills: true, reel: boolean }>`: `VideoEncoder.isConfigSupported` for H.264 at each size.
  - `still(source, fmt)` → `{ svg?: string, png: Blob }`.
  - `reel(source, fmt, { fps, onProgress, signal })` → `Blob` (video/mp4), one cycle, pre-rolled.
  - `bundle(source, { formats, stills, reel, name, onProgress, signal })` → ZIP `Blob`:
    `‹name›-4x5.png`, `‹name›-4x5.svg`, `‹name›-4x5.mp4`, … — then the tool calls `Organica.download`.

**The source contract** — what a tool hands over. One object; the module never reaches into a tool:

```js
{
  name: 'leaf-wave',                 // file name stem
  cycleMs: 12000,                    // one full cycle (0 or absent = a still-only source)
  fps: 30,                           // the source's own clock (HeroLoop: 31.25)
  layout(W, H) { … },                // lay the piece out for this format (fit, or a format-aware layout)
  seek(ms) { … },                    // put the piece at time ms from the cycle start (deterministic)
  svg() { return '<svg …>' },        // the current frame as standalone SVG — for SVG sources (FVS, hero loops)
  draw(ctx, W, H) { … },             // OR draw it on a canvas — for canvas sources (Pulsar)
}
```

`seek` makes the clip deterministic: a periodic source (Pulsar's `renderFrameAt(tNorm)`) is seamless by construction; a
stepped one (the hero loops' `advance(ms)`) seeks by pre-rolling. A source with only `svg()` gets PNG + SVG; with only
`draw()` it gets PNG.

## 4. Phases

| Phase | What | Cost | Done when |
|---|---|---|---|
| **P1 · Core** | `shared/mp4.js` + `shared/social-export.js` + `scripts/test-social-export.mjs` (headless) | M | a synthetic source (a moving square) gives a 4-format ZIP; each PNG is its format's size; each MP4 parses (`moov` duration = frames × sample duration), loads in a `<video>` with the right `duration` and `videoWidth`; frame 0 = frame n (seamless); no console errors |
| **P2 · Pulsar** | an Export › **Social** block: format checks, Stills / Reel, Export → one ZIP, progress on the status pill | S–M | one loop of a preset exports in all four formats; the reel's length = Loop seconds; DS CONSULT before, REVIEW after |
| **P3 · Home-hero loops** | the eight FVS loops exported for posting — on the owner's `/hub/` (one Social button per loop) or as a script on the module (O-106 a) | S | the reels match the prototype's (frame count, seamless); `ig-export.html` retired onto the module |
| **P4 · FVS stills** | Symbol and Figure: Export › **Social** stills (PNG + SVG) in the four formats | S–M | a Symbol exports in four formats, laid out per O-106 b; Print mode untouched (Social is screen-only) |
| **P5 · Mote onto the module** | Mote's batch sizes read `FORMATS`, its writer becomes `Organica.mp4` | S | optional; Mote's own encoder path (MediaStreamTrackGenerator) stays until then |

FVS **reels** wait for FVS Motion (backlog 2.4): until then an FVS piece has no clock. A Symbol that re-fits its lattice
to the format is backlog 2.9; P4 uses the layout chosen in O-106 b.

## 5. Risks

- **Safari / Firefox WebCodecs H.264.** Encoding may be missing or limited to some sizes. `support()` checks each size
  before Export; what fails falls back per O-106 d. Diego checks by hand before it goes to prod (CLAUDE.md
  cross-browser list).
- **Memory.** Encoded samples are kept until the MP4 is written: about 12 Mbps × 12 s ≈ 18 MB per 9:16 reel, so fine.
  Raw frames are closed as soon as they are encoded.
- **Time.** Rasterising an SVG frame through `Image` costs about 10–30 ms at 1080×1920, so a 12 s reel at 30 fps takes
  roughly 5–10 s per format. Progress is shown, and Cancel stops it (`signal`).
- **Fonts in SVG frames.** An SVG drawn through `<img>` cannot load web fonts. The loops' word slides are off in the
  prototype (`.hloop__word { display: none }`). Text frames need outlined text, or they are drawn without the word.

## 6. Questions for Diego (ledger O-106 — answered Nov 25, 2026: all as recommended)

- **(a) Who gets it first?** Recommended: P1 → P2 Pulsar (real motion, frame-accurate today) → P3 the hero loops → P4 FVS stills.
- **(b) A piece whose shape is not the format's:** *fit with Paper around it* (recommended) · *fill and crop* · per-tool
  layouts only (today only the hero loops have them).
- **(c) Reel length:** *one cycle* (recommended, seamless) · a set length (15 / 30 s), looping the cycle.
- **(d) No H.264 encoder in the browser:** *stills only, and say so* (recommended) · a realtime WebM through `recorder.js`.
- **(e) Formats:** *the four* (4:5 · 9:16 · 1:1 · 16:9, recommended) · also Mote's 3:2.
- **(f) Output:** *one ZIP* (recommended) · one download per file.

## 6a. P1 as built (Nov 25, 2026)

- The API is §3's, plus `fitSVG(svg, W, H, { paper, margin })`: the piece's root `<svg>` nested in a W×H frame
  (`preserveAspectRatio="xMidYMid meet"`, a Paper `<rect>` under it) — O-106 b, *fit with Paper around it*. A source
  usually returns `fitSVG(itsOwnSVG, W, H)` from `svg()`, with `layout(W, H)` remembering the size.
- Codec `avc1.640028` (H.264 High 4.0 — 1080×1920 is 8160 of its 8192 macroblocks), about 0.2 bit a pixel (12.4 Mbps at
  1080×1920 / 30 fps, clamped 6–20 Mbps), a keyframe every 2 s, the encode queue held under 8 frames.
- Frame *i* of a reel is `seek(i · cycleMs / n)` for *i* < n: frame *n* would be frame 0 again, so a periodic source loops
  seamlessly without a pre-roll; a stepped source (the hero loops' `advance`) pre-rolls inside its own `seek`.
- `bundle` checks `support()` first; a format with no encoder goes into `skipped` (`why: 'no-encoder'`) and only its
  stills are made — the calling tool says so (O-106 d). Files: `‹name›-‹format›.png / .svg / .mp4`.
- Measured headless (Chromium, Nov 25): 30 frames of a simple SVG piece at 1080×1350 in about 0.1 s; the `<video>` reads
  1080×1350 and 1.0 s; its first frame matches the still (mean difference under 6/255). Real pieces rasterise slower
  (heavier SVG): to be measured in P2 and P3.

## 6b. P2 as built — Pulsar (Nov 25, 2026)

- **Export › Social** at the foot of Pulsar's Export popover (design-system CONSULT; Mote's batch block and words): four
  size checks, *Stills · PNG* / *Video · MP4, one loop*, **Export ‹n› files** (→ **Cancel** while it runs), a hint that
  says one ZIP, fitted with Paper, and the loop's length — and, before the click, when this browser has no MP4 encoder.
  Words provisional: ledger O-107. Copy: `docs/UI-COPY.md`.
- The source (`socialSource()` in `pulsar/index.html`) takes the scene's parameters and tracks when Export is pressed and
  draws `composeP(base, tracks, t)` with `t = ms / loop` (Loop seconds, 6 if Off) on the module's canvas, the square scene
  fitted in the size's short side, its own Paper (per frame — a Paper track works) around it. `#preview` is never touched.
- A scene with a one-shot track (`ramp-once`, a phase spin) is not seamless — its last frame is not its first — exactly as
  Pulsar's own Video; Pulsar already flags it in the Loop popover.
- Measured headless (Chromium): the default scene, 6 s at 1080×1920 (180 frames), encodes in about 0.7 s; a 1:1 still +
  video in about 0.6 s.
- Test `scripts/test-pulsar-social.sh` (12 checks: counts, hint, remembered ticks, the ZIP's files, the video's length and
  size, `#preview` untouched, Cancel).

## 6c. P3 as built — the home-hero loops on the hub (Nov 25, 2026)

- **Where** (Diego, Nov 25: *Social button on /hub/*): a **Social** section on the owner's `/hub/`, between the hero and
  Specimens (design-system CONSULT: a section, not chrome over the loop). **Loop** picker (the eight, the one on screen
  first), the four size checks, *Stills · PNG + SVG* / *Video · MP4, one loop*, **Export ‹n› files** (a still counts two
  files) ↔ **Cancel**, a hint, a 2px progress bar on the section's foot; status through `Organica.notice` (a page has no
  status pill). The loop on screen pauses while it runs. Ticks in `organica.hub.social`. Words: ledger O-107 / O-108.
- **`shared/hero-social.js`** (`Organica.heroSocial.source(key)`): the loop mounted off screen through `Organica.hero.mount`
  with its `key` (no rotation stored; `Organica.hero.current` given back after), paused, at each size — **a fresh mount for
  every layout** (`go(0)` from wherever a loop was left is not the same frame). The **cycle is observed, not summed**: each
  slide drops the part of a step that runs past its end, so a real cycle is a few steps longer than its slides' ms; the
  pre-roll runs from `go(0)` to the wrap back to slide 1 (the hero's `onProgress` falls to 0), then counts the steps of one
  full cycle — that count is the reel's frame count, so frame *n* would be frame 0. `svg()` is the loop's own SVG at the
  size (each loop lays itself out for the format, so no `fitSVG`). `hero.js` itself is untouched.
- **Seamless — two of eight.** Bands (A) and Stacks (H) come back exactly (the next cycle's first frame = frame 0, mean
  difference ≤ 0.1/255; a Stacks reel's last frame runs into its first at 1.0/255). The other six carry state across cycles
  (drifting bands, morphs, the score's camera) that `go(0)` does not reset: their reel's wrap jumps (mean 38–175/255 —
  as much as a slide change). The live hero never wraps, so it never shows. A fix belongs in the loop engines (backlog 2.2,
  *seamless by construction*), not here.
- **Overprint (G) and the model swap**: exporting G loads its model for each size into a slot the loop on screen shares,
  and that copy rebuilds from the slot on a resize that keeps its model name (`hero.js` reloads only when the name
  changes). So `close()` puts back the model for the page's own aspect (`source(key, { aspect })` — the hub passes its
  hero's), when the loop on screen is the exported one. Found in the design-system REVIEW.
- **Fonts**: the loops' word slides are HTML overlays, not in the SVG, so they never reach the files.
- **Measured** headless (Chromium, 1080×1350): stills 70–680 ms a loop (C · The score's haze filter is the slow one); a
  40 s reel of Weave at 1080×1920 in about 11 s, 2.6 MB.
- `explorations/home-mockups/ig-export.html` stays local; the module now covers what it did.

## 7. Gates

- Every phase: `python3 scripts/ds-audit.py --diff` (no raw values), `scripts/check.py`, the new test, plus the tool's
  own suites (`scripts/test-fvs.sh` for P4).
- UI phases (P2, P4, P3 if on the hub): design-system **CONSULT** before building, **REVIEW** before the commit.
  Words go in `docs/UI-COPY.md`.
- Local commits only; prod on "porta in prod".
