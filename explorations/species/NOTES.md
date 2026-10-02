# Species — exploration notes

**Status: open exploration (Oct 1, 2026).** Parked on purpose: it needs more testing and
development before it earns a production slot. Lives at `/explorations/species/`
(menu → Explorations). Not in `vercel.json`, not in the tools menu, not in the CLAUDE.md
Tools table. Nothing here is a shared API yet — the engine is `species.js` in this
folder, deliberately *not* `shared/` (no second consumer; "extract at the second consumer").

## What it is
A parametric organism generator with a motion layer. One idea: an organism =
**skeleton + body + appendages + skin**, defined as 3-D parametric surfaces (quad meshes),
so one definition feeds several renderers. Three morphologies: **Flower** (the focus),
**Jellyfish**, **Fish**. Everything is `frame = f(P, t)` — rebuilt every frame, seeded
(`Organica.mulberry32`), every periodic term runs a **whole number of cycles per loop**
so loops are seamless.

Files: `index.html` (the page — uses the real production shell, so promotion is mostly
moving files) · `species.js` (engine, `Organica.species`) · this file.

## Where it came from
Diego shared an Instagram reel — @teknosis_sis "Bloom 🌸" (Cinema 4D, gradients, loop;
`instagram.com/reels/Dd7Zi_UqeU4/`) — and asked for a way to make *infinite parametric
SVGs animated with nature-based and "crazy" motion*. Then a **screen recording of the reel**
(`~/Downloads/Screen Recording 2026-10-01 at 15.44.27.mov`, 14.3 s, 1280×1132 — NOT in the
repo; the flower is in the right ~half of the frame, x≈560–1280) which is the real
reference for the colour movement. Plan file: `~/.claude/plans/analyze-this-video-from-warm-cook.md`.

## What the reference actually does (measured from the recording, not guessed)
- **Head = a ring of ~14 separate egg-shaped lobes** (long axis radial, plump at the tip,
  narrow at the hole end), overlapping neighbours, around a small open centre with a small
  inner ring of "teeth". NOT one creased surface (an earlier attempt, kept as "Creased
  surface", never looked right).
- **Colour = a ramp on facing angle** (n·v): blue (face-on) → light blue → cream → green →
  cream → pink → red → near-black at the silhouette. The ramp advances fast with angle, so a
  single lobe shows the whole sequence as concentric rings. Not colour-by-surface-position.
- **The head tumbles in 3-D**: dish face-on → seen from above → seen from behind (lobes
  overlap like a fan, large uniform blue/green). Roughly a 2–3 s rhythm, irregular.
- **Colour bands travel down the stem** (horizontal bands, a function of position along the
  stem + time). This is most of the "colour movement".
- Stem: thick, S-bend, tapers to the head, exits the bottom of the frame. Background: vertical
  lavender-grey gradient (`#a9acbc → #d3d7ec → #dde0f2 → #aeb1c4`). Fine grain on the reel — not done.
- **Lobes circle on their own axes** (Diego, last message): each lobe's tip traces a circle.
  Implemented as an anchored precession with the phase travelling round the ring.

## Architecture (species.js)
- `build(morph, P)` → mesh `{quads:[{p:[4×xyz], u, L?, ao?}], centre, radius}`.
  Builders: `buildFlower` (→ `podsHead` or the creased-surface head), `buildJelly`, `buildFish`.
- `motion(morph, P, tNorm, {cycles, amount})` → P copy with periodic offsets.
- **Two renderers over the same mesh:**
  - `scene()/itemsSVG()/drawItems()` — **Flat · vector**: depth-sorted quads, same-colour runs
    merged. Real SVG paths. Visible colour segments (can't avoid with flat fills).
  - `raster()/drawSmooth()/smoothSVG()` — **Lit · 3D**: z-buffered per-pixel shading, vertex
    normals accumulated across shared vertices, colour ramp looked up PER PIXEL → no segments.
    Its SVG export embeds a PNG (honestly not vector).
  - Planned third (not built): Three.js on the same mesh.
- Skins: `skin:'surface'` (ramp over a surface coordinate `u`, cyclic) and `skin:'facing'`
  (ramp over `1-|nz|`, clamped; stem uses a ping-pong `stemBands` ramp over length + `stemPhase`).
- Presets can carry `_view` (camera/light/background) — applied then stripped from P.
- Preset to start from: **Flower → "Reel pods"**.

## Hard-won gotchas (do not relearn these)
- `Math.sin(Math.PI)` rounds slightly negative → `pow(negative, frac)` = NaN → silent blank
  canvas. Clamp (`Math.max(0, sin)`), and clamp `1-|nz|` before `pow`.
- A local `tri` array in `raster()` shadowed a helper named `tri` → renamed `pingpong`.
- Seamless loop with a head that spins by whole lobe-steps: per-lobe phases must follow the
  lobe's **position after the spin** (`th − spin`; `rotY` rotates by −angle), not its index.
- The facing ramp is non-cyclic: never scroll `rampPhase` on it (it saturates to the dark end).
  Only the stem scrolls (`stemPhase`, ping-pong → continuous).
- Browser pane / dev server cache: when the page looks stale, add `?v=N`. A blank first
  screenshot is often just mid-load — wait 2–3 s.
- Verifying loops: render t=0 and t=1 to canvases and diff the pixels (threshold >1 level).

## Measured
- Lit smooth @1080×1920: ~58 ms (surface head, 9k quads) → ~78–94 ms (pods + circling,
  13.7k quads) → **~10–13 fps live**. Flat mode is ~7 ms. Video export is unaffected (records
  the live canvas) but runs at that frame rate.
- Loop closes: 0 channels differing (>1 level) at cycles=2 with circling on.

## Open — the list to resume from
1. **Tumble timing/shape.** Mine is a plain nod + roll + one lobe-step spin. The recording is
   less regular (back views at uneven intervals). Needs frame-accurate study of the recording
   (it can be played in the browser pane: serve the .mov locally, `requestVideoFrameCallback`
   while it plays — seeking a detached `<video>` returns identical frames; play it in the DOM).
2. **Colour pacing** (band scroll speed, ramp scale) is tuned by eye. Measure colour-vs-time at
   fixed pixels from the recording to get real numbers.
3. **Lobe circling**: size/speed/waves are a guess (16°, 2/loop, 1 wave). Confirm against the recording.
4. **Performance**: raster is single-threaded JS. Options: OffscreenCanvas worker, fewer quads
   (detail), skip the z-buffer for the back, or the Three.js backend.
5. **Reel details missing**: dark toothed hole at the centre, grain, slightly heavier edge darkness.
6. **Jellyfish / Fish are rough.** Fish body is a bullet; fins/tail join wrong; no features.
   Jellyfish tentacles are thin ribbons, OK. Both still use the older flat `u` skin.
7. **"Levels" slider** doesn't make SVG meaningfully smaller or print-ready (−6% on a jelly).
   Real posterised-band output needs a colour-layer/contour approach (cf. `Organica.traceContours`).
8. **Smooth + vector** is unsolved: options are posterised bands, gradient meshes, or accept PNG-in-SVG.
9. **Not built from the plan:** Three.js backend, the side-by-side fidelity gallery, thumbnail
   preset picker, Mutate/Breed gallery, the "crazy" motion tier (Kuramoto oscillators,
   superformula sweeps, attractor drivers, topology morph), boids/schooling, Rhizome node.
10. **To promote** (docs/UI-SHELL.md §6b): pick the accent (`--tool: #2d8fd0` is provisional, not
    collision-checked), dark-mode audit (page opts in via `data-theme-support`; the canvas is a
    light work surface), move `species.js` → `shared/`, `vercel.json` rewrite, hub/menu group,
    CLAUDE.md Tools row + Repo Structure, a manual `docs/SPECIES.md`, FVS regression not needed.

## Not verified at all
Safari/Firefox; the Flat renderer on the new pods head (painter's-sort is approximate for
intersecting lobes — use Lit); video export of Species (uses `Organica.recorder`, wired but
never run); saved user presets; the Jellyfish/Fish with `skin:'facing'`.
