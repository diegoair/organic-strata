# Komorebi — User Manual

> Studio Rann · Organica · 木漏れ日 — Dappled Sunlight Through a Canopy
> Live: [theorganicalanguage.vercel.app/komorebi/](https://theorganicalanguage.vercel.app/komorebi/)
> Last updated: July 27, 2026 (Canvas2D/JS rewrite — see §17)

---

## 1. What Komorebi does

**Komorebi** (木漏れ日, *"sunlight leaking through trees"*) generates dappled-light **pattern
shapes** — the shifting coins of light, the soft leaf-shadows, the shafts of light breaking
through gaps — as a static composition, always exportable as real vector SVG.

There is no repository called "komorebi" because it is a poetic word, not a graphics term.
The effect is built instead from the three technical mechanics that actually produce it:

1. **Light cookie / gobo** — the dappled leaf-shadows on the ground; six selectable pattern
   masks as of July 27, 2026 (Foliage, Cellular, Veins, Drop mark, Blinds, Blob — §16).
2. **Penumbra + pinhole** — why real komorebi is round soft coins of light, not sharp leaf
   silhouettes.
3. **Volumetric light / god rays** — the shafts of light breaking through the canopy.

Komorebi is a **single-file vanilla HTML/CSS/JS** tool, like the rest of Organica. **As of
July 27, 2026 it renders with Canvas2D, not WebGL** — see §17 for why and what changed. §§2–14
below describe the mechanics conceptually (still accurate) but some implementation specifics
(GLSL, shader passes, the continuous animation loop) describe the pre-rewrite version; §17 is
the authoritative reference for the current code.

---

## 2. The three mechanics (what's happening under the hood)

### Light cookie / gobo
A *gobo* ("goes-between-optics") or *light cookie* is a mask placed over a light so it
projects a shaped pattern. Ours is a **canopy mask** — 1.0 where a leaf blocks the sun, 0.0
where a gap lets light through — projected onto a ground plane in perspective. Instead of
simulating 3D leaves, we pan the mask; two layers moving at slightly different rates read as
wind rustling the branches.

### Penumbra + pinhole — the part that makes it *komorebi*
The sun is not a point. It subtends about **0.53°** in the sky. That means a gap in the
canopy at height *h* casts a shadow whose edge is blurred by roughly **h / 108**. When a gap
is **larger** than that blur, its leaf shape survives on the ground. When a gap is
**smaller** than the blur, it stops projecting its own shape and acts as a **pinhole
camera**, projecting a round image of the sun — a soft coin of light.

This is why real komorebi is made of round, soft-edged light spots, not crisp leaf
silhouettes — and it is the detail almost no god-rays shader implements. Komorebi gets it
from one control (**Dapple › Height**): the canopy is sampled through a disc-shaped kernel
whose radius is the penumbra. Small gaps average away into soft discs; large gaps keep their
edges. Nothing special-cases the pinhole — it falls out of the averaging, exactly as the
physics does.

### God rays (volumetric)
The shafts of light are a **post-process radial blur** of an *occlusion buffer* (the method
from Kenny Mitchell, *GPU Gems 3*, ch. 13). One pass renders the sun bright and everything
blocking it black; a second pass smears that buffer radially outward from the sun's position
on screen. **No shadow map and no 3D scene are needed** — the occluder is the same 2D canopy
that casts the ground dapple, so the rays always stream out of the same gaps that make the
light pools.

---

## 3. Format — pattern framing

Komorebi renders **Gobo** only: an orthographic, flat projection — no camera, no horizon, the
whole frame *is* the lit plane. This is what makes it a **pattern tool** rather than a scene
renderer: the output tiles, and it feeds the Organica pattern engine (Phase 4). An earlier
"Scene" mode (a perspective horizon/sky/ground camera picture) existed during prototyping and
was dropped from the UI once the priority became realistic, usable dapple *patterns* rather
than a landscape picture — see §15.

- **Format** — output aspect ratio (Square, Portrait, Landscape, Wide, A-series).
- **Spread** — how much of the canopy fills the frame (zoom).

---

## 4. Canopy — the gobo source

- **Pattern** — which mask generates the gobo when the source is Procedural: **Foliage**,
  **Cellular**, **Veins**, **Drop mark**, **Blinds**, or **Blob**. All six share the same six
  sliders below (Scale / Density / Edge / Layer 2 / Clumping / Leaf detail) — each pattern
  repurposes them to fit its own geometry, and the panel relabels the rows to match. See §16
  for what each pattern does with them. Switching patterns doesn't touch Wind, Sun, Rays,
  Dapple, or Colour — only the shape of the mask changes.
- **Procedural** — a layered fBm foliage mask, tuned for organic realism rather than smooth
  cloud-noise blobs:
  - **Scale** — canopy zoom (bigger = smaller, finer leaves).
  - **Density** — leaf coverage vs. open sky.
  - **Edge** — softness of the leaf edges (low = crisp, high = feathered).
  - **Layer 2** — frequency ratio of a second fBm layer, combined with the first via `max()`
    so a gap exists only where *both* layers happen to be open — the sparse, irregular
    apertures a real canopy has, instead of even noise holes.
  - **Clumping** — a slow, low-frequency field nudges the local density up or down across the
    frame, so the canopy forms denser thickets and wider open gaps instead of one uniform
    threshold everywhere. This is the single biggest lever for "this looks like a real
    canopy" vs. "this looks like noise."
  - **Leaf detail** — a fine high-frequency layer nibbles the boundary, turning smooth blob
    edges into scalloped, leaf-like edges, and flecks a few pinholes of light through
    otherwise-solid interior — real foliage is never fully opaque up close. High values on an
    already-dense canopy can close off *more* light than they add (they nibble both ways) —
    if a dense preset reads too flat/dark, lower this before raising Density.
  - **Seed** — reshuffles the whole canopy.
- **Image** — upload any silhouette to use as the canopy: **Open image…**, or **drag and
  drop** a file anywhere on the canvas. Its luminance becomes the mask (bright = gap). This
  is the loop-closer: a **Halide** 1-bit export, or a plain photo of a
  real canopy, all drop straight in. Scale / Density / Edge still apply.

---

## 5. Wind

- **Sway** — purely periodic motion (built from a single phase angle). Because the whole
  field returns exactly to its start after one period, **the WebM export loops seamlessly**
  (see §9). Set **Loop** to the period in seconds.
- **Drift** — continuous travel in one direction. More natural for a live screen, but it
  **does not loop** — don't use it for a looping export.
- **Amount** — how far the canopy moves. **Speed** — pace (Drift only; Sway's pace is set by
  Loop).

---

## 6. Sun

- **Azimuth / Altitude** — the sun's position. You can also just **drag on the canvas** to
  move it — the rays and the light pools both follow, because they read the same sun
  position.
- **Size** — the sun's angular size. Note this interacts with the pinhole effect: a bigger
  sun makes the coins of light bigger and softer.

---

## 7. Rays (volumetric)

- **God rays** — master on/off.
- **Density** — how far the rays reach from the sun (sample spread).
- **Weight** — brightness contribution per sample.
- **Decay** — falloff along each ray (closer to 1.0 = longer shafts).
- **Exposure** — overall strength of the ray layer.

Rays are tinted by the **Sun** colour. For a hazy, cathedral-of-light look, raise Decay,
Exposure and the **Grade › Haze**; for hard midday shafts, lower Decay.

---

## 8. Dapple — penumbra physics

- **Height** — the penumbra radius (see §2). 0 = razor-sharp leaf shadows; raise it and
  small gaps melt into soft round coins of light. This is the single most important control
  for the komorebi feel.
- **Contrast** — gamma on the light/shadow curve (higher = punchier pools).
- **Lift** — raises the darkest shadow so it isn't pure black.

Moving the sun horizontally also slides the light pools across the floor, by an amount
proportional to Height — the same geometry that blurs the shadows also parallaxes them.

---

## 9. Colour & Grade

**Colour** — Sun, Sky, Canopy, Ground, Shadow. Type a hex or use the swatch picker.

**Grade:**
- **Posterize** — 0 = smooth gradient; any other value flattens the image into N luminance
  bands (a preview of what the SVG separation will trace — see §10).
- **Haze** — atmospheric wash toward the sky/sun colour; sells depth and the volumetric look.
- **Grain** — fine film grain.
- **Vignette** — darkened corners.

---

## 10. Export

Everything exports **WYSIWYG** — one render function feeds the preview, the raster exports,
the video and the SVG source, so what you see is what you get. **Export Scale** (top bar,
×1–×4) multiplies the resolution; a hard cap keeps the longest side ≤ 6000 px.

- **PNG / JPG** — a still of the exact current frame, at Export Scale.
- **REC (WebM)** — records the live animation. Click to start, click again to stop and
  download. In **Sway** wind mode the field is exactly periodic, so recording one **Loop**
  period gives a seamless loop for installations and social. (Availability depends on the
  browser's `MediaRecorder` support.)
- **SVG** — a **posterised tone-band separation** (see §11), not a rasterised image.
- **→ Figma** — sends the SVG straight to the Organica Figma plugin.

---

## 11. The SVG separation

A volumetric light field is continuous — there is no honest one-to-one vector version of a
gradient. What *is* honest is a **tone separation**: quantise the image into **Bands** flat
luminance levels and trace each band's real boundary into one flat-colour path. Each band is
effectively one **screen-print / riso plate**.

- **Bands** (Grade › SVG separation) — number of tone bands. Set it equal to **Posterize**
  to make the preview an exact match of the export.
- **Detail** — the resolution at which band boundaries are traced (Coarse → Max). Higher is
  more faithful and produces a larger file.

Bands are **stacked** (each path is "luminance ≥ this level", drawn darkest-first) rather
than cut into disjoint tiles, so there can be no hairline gaps between plates however coarse
the trace. The boundary tracer is the **rectilinear contour walk from Halide's "Simplify
shapes"** — straight horizontal/vertical segments, `fill-rule="evenodd"` so holes and nested
regions resolve regardless of winding.

---

## 12. Presets

Six built-ins, each a complete deterministic state (applying one never inherits leftovers
from the previous look — it is layered over the *Forest Floor* baseline):

- **Forest Floor** — the default balanced organic dapple pattern.
- **Riso Two-Tone** — 3 bands, flat print palette, high Clumping for bold graphic shapes;
  built for the SVG separation (§11) — a real screen-print / riso plate output.
- **Shoji** — soft, low-contrast, paper-and-shadow palette; diffused light, minimal Leaf
  detail — the flat, even pattern look.
- **Dense Canopy** — deep shade, high Density, only scattered pinhole coins of light —
  demonstrates the penumbra/pinhole effect (§2) at its most dramatic.
- **Sparse Grove** — mostly open, sunlit ground with a few soft dark leaf-clumps — the
  inverse read of Dense Canopy.
- **Fine Foliage** — small Scale, high Leaf detail, low Clumping — a delicate, fine-grained
  texture rather than large shapes.

**Save** stores the current state to `localStorage`; **Delete** removes a saved preset
(built-ins can't be deleted).

---

## 13. Top bar & interaction

- **Pause / Play** — freeze or resume the wind clock.
- **Reset (↺)** — rewind the wind clock to 0.
- **Drag on canvas** — move the sun.
- The status readout (top) and the time readout (bottom-left HUD) show state.

---

## 14. Implementation notes

- **Two shader passes, shared canopy** — the occlusion buffer (pass A, rendered at half
  resolution because a radial blur destroys high frequencies anyway) and the composite
  (pass B) both `#include` the same `CANOPY_LIB` and `PROJECT_LIB` GLSL chunks. If they ever
  used different canopy code the rays would stream out of gaps that cast no light pools; sharing
  the source makes that class of bug impossible.
- **WYSIWYG** — `renderFrame(w, h)` is the only render path. Preview, PNG/JPG, WebM frames
  and the SVG's pixel source all call it; only `w`/`h` differ, and every uniform is
  resolution-independent, so a 4× export is the same image sampled finer.
- **PNG/JPG use `toDataURL`, not `toBlob`** — `toBlob` is asynchronous, and the export
  resizes the canvas back to preview size the instant it returns, which raced the encoder and
  produced blank/preview-sized files. `toDataURL` snapshots synchronously.
- **Penumbra kernel** — golden-angle disc taps with a per-sample rotation, so the finite tap
  count doesn't band the soft light pools.
- **Ray dithering** — the ray march starts at a per-pixel dithered offset so the finite step
  count doesn't produce visible rings.

---

## 15. Evaluated and deferred

- **Scene mode — dropped from the UI (July 25, 2026)** — the perspective camera picture
  (horizon, canopy ceiling, sky, receding ground) that Komorebi first shipped with. Once the
  priority became realistic, usable dapple *patterns* for design work rather than a landscape
  render, Scene stopped earning its panel space; Diego asked for it gone in favour of doubling
  down on Gobo. The underlying shader code (`PROJECT_LIB`'s `groundPoint`/`ceilingPoint`
  branches, the `uMode`/`uHorizon` uniforms) was left in place rather than deleted — it's
  inert (the JS always sets `uMode = 1`, gobo), so it carries no runtime cost and nothing
  downstream (occlusion pass, rays, SVG separation) had to change. Revisit by re-exposing the
  Projection toggle if a "picture" output is wanted again later; don't re-derive the geometry
  from scratch.
- **Structure-tensor flow field for wind** — the current warp is per-pixel fBm (some
  shimmer); a smoothed flow field would give coherent branch sway. Parked (mirrors the same
  note in the Pollen hatching backlog).
- **Sun-path timeline** — animate the sun along a dawn→dusk arc with colour-temperature
  keyframes for the installation loop. Not built; sun is static per frame.
- **Per-plate riso SVGs** — the separation is already banded; emitting one named SVG file
  per band would make it a true multi-plate print hand-off.
- **Genesis form as canopy** — feed a Genesis form or composed grid directly as the cookie,
  the same way image upload already works.

---

## 16. Pattern types (July 27, 2026)

Komorebi's original brief was dappled *sunlight through a canopy*; this widened the Canopy
source into a general-purpose gobo library for pattern-making on top of the same light/wind/
export machinery, per Diego's direction: natural-or-not patterns, tuned per look, animated
with wind — patterns first, animation second. All six masks are `float mask(vec2 p) -> 0..1`
functions compiled into the same `CANOPY_LIB` GLSL chunk and selected by `uPatternType`; none
of the surrounding pipeline (dapple/penumbra, god rays, wind, SVG separation) had to change,
because every mask still just answers "opaque or gap" for a point in ground space.

- **Foliage** — the original two-layer fBm canopy (§4). Unchanged.
- **Cellular** — cracked-earth / cell walls. Two Voronoi scales (`voronoiF1F2`, nearest minus
  second-nearest point distance); a crack opens wherever *either* scale cracks, so fine
  capillary cracks run inside the coarse cell walls. **Density** biases solid wall vs. crack
  coverage, **Edge** → *Crack width*, **Layer 2** → *Fine cracks* (scale of the secondary
  crack layer), **Clumping** → *Jitter* (0 = perfect grid), **Leaf detail** → *Crack detail*.
- **Veins** — a branching network from ridged fbm (`1 - abs(noise*2-1)`, sharpened and
  fractally stacked), plus a finer capillary layer gated by Leaf detail. **Density** →
  *Thickness*, **Layer 2** → *Capillary scale*, **Clumping** → *Variation*, **Leaf detail** →
  *Capillaries*.
- **Drop mark** — Organica's own gesture (pigment + gravity, see the top of this repo's
  `CLAUDE.md`) used as the gobo instead of foliage. A jittered point grid, each cell a circle
  pulled into a gravity tail (`dropField`'s SDF), plus a second, smaller-scale "satellite
  droplet" layer — the fine spatter a real drop throws off on impact — combined with `min()`.
  **Density** → *Coverage* (probability a cell has a drop), **Layer 2** → *Satellite scale*,
  **Clumping** → *Scatter* (grid jitter), **Leaf detail** → *Tail length*.
- **Blinds** — venetian slats; the one deliberately non-natural pattern, architectural/street
  rather than biomimetic. Horizontal duty-cycle stripes, with **Layer 2** blending in a second
  vertical set (*Cross grid*) for a window-mullion look, and per-row/column hash jitter so
  slats read as slightly bent rather than a machined grate. **Density** → *Slat width*,
  **Clumping** → *Irregularity*, **Leaf detail** → *Bend*.
- **Blob** — large, soft two-tone fields with a wide blurred edge, built from reference photos
  of painted canvas studies (soft organic blobs, two flat tones, blurred boundary — see the
  session note below). The mask is fbm *thresholded after domain-warping* rather than
  thresholded directly: the warp is what turns noise-grain edges into rounded, flowing
  boundaries instead of a leafy/cellular texture. **Density** → *Balance* (tone split),
  **Edge** is multiplied ×4 internally (*Softness* — Blob wants a much wider band than the
  other masks), **Layer 2** → *Complexity* (a second warp octave), **Clumping** → *Balance
  drift*, **Leaf detail** → *Flow* (how much the boundary itself meanders).

**The "Canvas Bloom" preset and the luminance trap.** Diego's reference photos are two flat
*hues* (sage green / cream, or blue / cream) with a soft edge — not two *luminances*. The SVG
separation (§11) buckets purely by luminance: `floor(lum * bands)`. The first attempt at this
preset picked a sage green with luminance ≈0.64 sitting in the *same* band as the cream
background (≈0.85–0.95) at Bands = 2 — the live PNG preview looked right, but `buildSVG()`
produced a single full-canvas rectangle, not the traced blob shape, because every pixel fell in
band 1. Fixed by darkening the shadow colour to luminance ≈0.45 (below the 0.5 split for
2 bands) while keeping it visually close to the reference — verified by reading raw pixel
luminance min/max and re-running `buildSVG()` to confirm two real contour paths. **Rule for any
future two-tone preset: check that the chosen colours straddle the relevant band threshold(s)
in luminance, not just that they look distinct on screen** — a correct-looking preview and a
correct vector export are two different checks. Also: the preset sets **Posterize (live) =
0** and **SVG bands = 2** deliberately — Posterize re-quantizes the rendered *pixels* by
luminance before they even reach the SVG tracer (and would have re-introduced the same
collapse on top of already-correct colours), whereas SVG bands only affects the export-time
trace. A pattern whose mask is already near-binary (Blob, Drop mark, Cellular, Blinds) needs
Posterize off; it's a control for washing continuous-tone renders (Foliage, Veins) into flat
bands, not a general "make it two-tone" switch.

---

## 17. WebGL2/GLSL → Canvas2D/JS rewrite (July 27, 2026)

Direct feedback after §16 shipped: *"credo che il problema principale sia legato alla
libreria che usi, valutiamo un'alternativa che definisca e faccia le cose in maniera più
semplificata"* — followed by the actual priority once discussed: **the shape/pattern quality
matters, always exported as real vector SVG; wind/animation can wait**. Komorebi did not
depend on any external library (it was hand-written WebGL2/GLSL, per the project's own
vanilla-no-framework rule) — the §16 bug was a luminance-math oversight, not a library fault.
But raw GLSL genuinely is hard to read, debug (no breakpoints, no `console.log`), and verify —
and once real-time performance stopped being a requirement (animation deferred), the GPU
stopped earning its complexity cost. Rewrote the entire render pipeline onto plain Canvas2D +
JavaScript.

**What changed:**
- **No WebGL, no GLSL, no shader compilation.** `<canvas id="view-canvas">` uses a normal 2D
  context. Every mask/noise/compositing routine is a direct, checkable port of the old GLSL —
  same formulas, plain JS functions operating on scalar `(x, y)` instead of `vec2`, so they
  read and debug like any other function in the codebase.
- **No continuous animation loop.** Wind/time is a design casualty of the "patterns first,
  animation later" brief (Diego's own sequencing, not this rewrite's choice) — `uTime` is
  effectively frozen at 0. Sway vs. Drift are now two different **static warp shapes** rather
  than two motions; Amount still visibly shapes the pattern, Speed/Loop are inert until
  animation ships. Rendering is **on-demand**: any control change queues one
  `requestAnimationFrame`-coalesced `renderFrame()` call (`scheduleRender()`), wired once via
  a single `input`/`change` listener on `#panel` rather than manual calls scattered through
  every handler.
- **WebM recording removed from the UI** (not deleted, just disabled with an explanatory
  tooltip) — recording a "video" of a frame that never changes isn't a real feature; it
  returns when wind animation does.
- **Occlusion caching.** The expensive step — evaluating the noise mask at every pixel — is
  cached (`occCache`, keyed on every shape-affecting control + resolution). Purely
  colour/grade/ray tweaks (the most common edits) reuse the cached mask and only re-run the
  cheap O(w·h) blur/colourise/grade passes: **~10ms** for a colour change vs. **~120ms** for a
  shape change at preview resolution (measured), ~480ms for a full-resolution export with god
  rays on. A second cache (`sunOccCache`) does the same for the ray-march input specifically.
- **Penumbra is now a box blur**, not 14-tap per-pixel disc sampling. A separable sliding-window
  box blur is O(w·h) regardless of radius and reads as "blur the mask, then light it" instead
  of a hand-rolled Monte-Carlo kernel — same "soft edge whose width is the canopy height" idea,
  much cheaper and much easier to verify by eye.
- **God rays kept**, ported faithfully (same radial-accumulation-toward-the-sun algorithm,
  same half-resolution occlusion buffer), but **RAY_STEPS dropped from 48 to 32** — a
  JS-affordable compromise; quality difference is not visible at these ray-density settings.
- **SVG separation got simpler, not just ported**: `ctx.getImageData()` on a real Canvas2D
  context is top-down already, so the old "readPixels is bottom-up, flip it" comment block and
  code are just gone. `buildSVG()` and the shared `Organica.contoursToPathD` tracer are
  otherwise unchanged — verified byte-for-byte equivalent behaviour on the Canvas Bloom preset
  (2 bands → 2 real contour paths, ~4.5 KB, not the single-rect degenerate case from §16).
- **One disclosed simplification**: the old "sunShift" parallax (light pools sliding slightly
  as the sun moves, independent of the ray direction) was dropped rather than ported, since it
  would have required a second, differently-offset occlusion buffer per frame for a minor
  secondary effect. Re-addable later by offsetting the sample coordinates in
  `computeOcclusion` specifically for the lit/colourise pass.
- **`uPatternType` → a plain string.** `PATTERN_INDEX` (the old int-uniform mapping table) is
  gone; `sel-pattern`'s value is used directly as an object key into `MASK_FNS`. One fewer
  layer of indirection, a direct consequence of not needing a GLSL-compatible enum any more.

**Verified before shipping:** all six patterns (Foliage/Cellular/Veins/Drop mark/Blinds/Blob)
render without console errors; all six built-in presets (including Canvas Bloom) reproduce
their pre-rewrite look; sun-drag, PNG/JPG export, and SVG export (path count + geometry, not
just visual) all checked against the WebGL version's behaviour.

**Not done in this pass (flagged, not silently dropped):** wind/animation is the explicitly
deferred next phase — when it returns, `windOffset`'s time term needs to come back in a way
that doesn't reintroduce the O(w·h) full-pattern recompute on every frame (likely: keep the
static occlusion cache for the *shape*, animate only a cheap post-hoc coordinate shift, or
accept a lower live-preview frame rate since export was always going to re-render at whatever
resolution is requested anyway).

---

## 18. Post-rewrite quality fix + control audit (July 27, 2026, later same day)

Direct feedback right after §17 shipped: *"il risultato è pessimo e ci sono tanti controlli
della precedente libreria che non servono — verifica e analizza cosa serve e cosa può andare
via."* Two separate things, both real.

**The quality regression (a genuine bug, not a taste difference).** Every pattern rendered as
a muddy, low-contrast wash instead of the crisp dappled shapes from the WebGL version.
Isolated by setting Dapple Height to 0 (no blur at all) and comparing: the underlying mask was
fine — the **box blur standing in for the old penumbra sampling was far too strong**. The old
GPU code averaged only **14 sparse Monte-Carlo taps** across a disc of a given radius; a dense
box blur over the *same nominal radius* is a much stronger low-pass (14 sparse samples of
highly detailed noise under-sample it and leave visible texture; a full pixel-by-pixel average
erases it). The radius conversion math was dimensionally consistent with the old ground-space
radius — the bug was assuming an equal nominal radius gives equal blur STRENGTH across two
structurally different algorithms. Fixed with an empirically-verified ×⅕ correction
(`renderFrame`'s `radiusPx` calculation) — checked against Foliage, Drop mark, and Canvas
Bloom before and after; Canvas Bloom was barely affected (it already uses Height≈0.02) which
is exactly why the bug wasn't caught when that preset was the main thing being eyeballed in §16.

**Control audit — what was actually dead vs. what still earns its place:**

| Control | Verdict | Why |
|---|---|---|
| **Colour → Canopy** swatch | **Removed** | Never read anywhere in gobo-mode rendering — a Scene-mode leftover (Scene itself was removed from the UI in July 2026, §15). Confirmed by grep before removing, not assumed. |
| **Wind → Speed, Loop** | **Removed** | Not just visually inert — `windOffset()` in the Canvas2D rewrite never reads `windSpeed`/`windPeriod` at all (time is a hardcoded 0). Pure dead weight since §17 shipped. |
| **Wind → Amount, Sway/Drift** | Kept | Still does something real: a static, non-animated domain warp that visibly shapes every pattern's boundary. Not "wind" in any live sense right now, but not decorative either. |
| **Colour → Sky** | Kept | Looks unused at first glance (no literal "sky" in gobo mode) but it's read by the Haze grade blend (`colSky*0.55 + colSun*0.45`) — genuinely wired in, just named for a mode that no longer exists in the UI. Worth a rename to something like "Haze tint" in a future pass; not done here to keep this fix scoped. |
| **Rays (Density/Weight/Decay/Exposure + God rays) + Sun (Azimuth/Altitude/Size)** | **Removed** | Asked Diego rather than deciding unilaterally, since it's a bigger scope cut than a dead-code sweep — real, working code, but it was the single biggest thing pulling Komorebi back toward "photoreal light simulation" when the stated priority is flat pattern shapes for vector export. Answer: remove both. Deleted `computeSunOcc`/`sunOccCache`/`sunDisc`/`RAY_STEPS`, the ray-march block in `renderFrame`, the Sun-drag interaction (`sunFromEvent` and its listeners — the on-canvas HUD hint that documented it is gone too, and with it the single most expensive render pass, O(w·h·32)). `rg-sunx/suny/sunsize/raydens/rayweight/raydecay/rayexp` and `ck-rays` dropped from `RANGES`/state and stripped from every built-in preset. The **Colour → Sun swatch stays** — it's a different thing (the warm tint added to lit areas, `colSun*lit²*0.45`, plus the Haze blend), not the removed Sun *position*.

---

## 19. Tree/foliage variety — Conifer, Fronds, and a Broadleaf rename (July 27, 2026)

Direct ask: *"ho bisogno di komorebi che richiamino diversi tipi di alberi e fogliame"*. Asked
which species mattered first rather than guessing across the many possible directions
(broadleaf, conifer, sparse birch/poplar, and palm/bamboo were named) — each implies
genuinely different underlying maths, not just a re-skin. Landed on:

- **Foliage → renamed "Broadleaf"** (label only, `value="foliage"` and the mask itself
  unchanged) — its dense, rounded, clumpy look already reads as oak/beech; no new code needed.
- **Conifer** (new pattern) — needle tufts on the same jittered grid as Drop mark, but each
  cell is a spiky radial "star" instead of a circle: a single `cos(needleCount · φ/2)`
  angular modulation, sharpened by a power (**Sharpness**, from Leaf detail), gives a bristly
  rosette silhouette per tuft with no per-needle loop. **Needle count** (from Layer 2) sets
  how many spikes.
- **Fronds** (new pattern) — covers *both* palm and bamboo as one mask, since they're the
  same shape idea at different angular widths: long strokes fan out from a per-cell centre
  within an angular window. **Spread** (repurposed from Clumping) is the window's width — narrow
  (~20–40°) reads as near-parallel bamboo canes reaching mostly upward, wide (~300°+) reads
  as a full radiating palm burst. Per-cell rotation jitter scales with Spread, so bamboo stays
  reading as vertical while palm gets natural per-clump orientation variety. **Frond count**
  (Layer 2) and **Taper** (Leaf detail, the same sharpening power as Conifer) round it out.
- **Sparse canopy (birch/poplar) needed no new mask at all** — it's the existing Broadleaf
  mask with low Density (sparse coverage), small Scale (small leaf clusters), high Clumping
  (patchy, uneven thickets) and high Leaf detail (lots of pinhole flecking) — shipped as the
  **Birch Grove** preset rather than a seventh pattern type, since the *shape generator*
  doesn't change, only the tuning.

Four new presets ship as starting points: **Birch Grove**, **Conifer Grove**, **Palm Shade**,
**Bamboo Grove** — each its own colour palette (conifer: deep green/gold; palm: tropical
teal/sand; bamboo: cool pale green; birch: airy near-white). All verified: apply without
error, render without console errors, and `buildSVG()` traces real multi-path vector geometry
(checked on Palm Shade specifically, since its radiating star shapes are the least
rectilinear-friendly of the six patterns).

Komorebi's Pattern list is now eight: **Broadleaf, Conifer, Cellular, Veins, Drop mark,
Blinds, Fronds (Palm/Bamboo), Blob** — Cellular/Veins/Blinds/Blob remain the "natural or not"
non-tree patterns from §16; the tree-specific ones are Broadleaf/Conifer/Fronds plus the
Birch Grove tuning of Broadleaf.

---

## 20. Reference-photo workflow: Window Light fix + Leaves pattern (July 27, 2026)

Diego set up `komorebi/reference-photos/` (kept out of git, like `halide/test-photos/`) to
upload photos of real light/shadow/painted-canvas references for Komorebi to be tuned or
built against directly, rather than described in words. 18 photos went in on the first pass —
real dappled-shadow photography, painted canvas studies, and riso/grain prints. Read all of
them; the recurring, not-yet-covered themes (recognizable single-leaf silhouettes, radiating
pinhole-dot bursts, directional density gradients, heavy grain/riso texture, chromatic-
aberration edge fringing, visible surface material under the light) are logged for later
passes. Two items were actioned immediately:

**Blinds retuned to match a specific reference (a 2×2 window projected on a wall).** The
existing defaults (Slat width ≈ 0.58, Cross grid low) read as dense venetian blinds, not a
window — wrong duty-cycle direction (thick bars, thin gaps) and the internal row/column
frequency (hardcoded ×6.0/×5.4, from `docs/KOMOREBI.md` §16) always produces many repeats
regardless of Scale's slider floor (0.4). Fix was **all parameter tuning, no new maths**:
**Spread down to 0.03** (this is what actually controls repeat count here — lowering it
shrinks the ground-space range so far that only ~2 cycles fit, something Scale alone can't
reach because its slider floor is 0.4) + **Slat width at its floor (0.20)** for a thin mullion
+ **Cross grid maxed (5.0)** for a full two-axis grid + a little Dapple blur for the soft glow
in the corners. Shipped as the **Window Light** preset. Verified against the photo side by
side and via `buildSVG()` (2 bands → 2 real paths, ~5.6 KB).

**Leaves (new pattern)** — the first of the "recognizable silhouette" requests. Each leaf is a
lens/vesica shape: half-width tapers to zero at both ends via `halfW · sin(π·t)^0.7` (t = 0
at the base, 1 at the tip), so it reads as an actual leaf outline rather than a blob or a
star — no other pattern in Komorebi has this "pointed at both ends" profile. **Elongation**
(Layer 2) sets the length-to-width ratio (round ≈ poplar, slender ≈ willow); **Serration**
(Leaf detail) adds a `cos(10·t + phase)` ripple to the width for a toothed holly/maple margin
versus a smooth bay-leaf edge at 0. Same jittered-grid scatter + per-cell rotation as
Drop mark/Conifer/Fronds. One correctness point worth flagging for future grid-based masks:
a naive version measured distance as `|qx| − width(t)` for *all* t including outside [0,1],
which is wrong there (width(t) can be non-monotonic outside its intended domain, so a stray
point far above the tip or below the base could read as "inside" the leaf on the same
centreline) — fixed by falling back to a capsule-style distance to the nearest end-point
outside the [0,1] range. Shipped as the **Leaf Litter** preset (warm autumn palette, some
Serration). Verified visually at both extremes (Serration 0 = smooth, 0.4 = toothed;
Elongation 1.2 = round, 2.5 = slender) and via `buildSVG()` (3 bands → 3 real paths, ~103 KB,
serrated edges resolve correctly in the trace).

Komorebi's Pattern list is now nine: **Broadleaf, Conifer, Cellular, Veins, Drop mark, Blinds,
Fronds, Leaves, Blob**.

---

## 21. Cluster — the organic-randomness technique (July 27, 2026)

Diego's feedback on the grid-scatter patterns was a **method** critique, not a subject one:
*"non focalizzarti su 'cosa' … ma sul come giocare sulle forme in maniera totalmente casuale.
Le forme sono le shadow e come costruire pattern che possano richiamare diversi elementi
organici."* i.e. stop building "a leaf", build the **randomness** that makes any organic
shadow read as real.

### The diagnosis

Every shape-based pattern up to this point (Drop mark, Conifer, Fronds, Leaves) places **one
shape per cell of a jittered grid, all at roughly the same size**. That always reads as a grid
no matter how hard the jitter is pushed, because two lattice properties survive jittering:
every cell contributes the same *number* of shapes, and every shape is the same *size*. The
eye reads the regular spacing statistics even when it can't see the lines.

### Three failed attempts (kept here because the failure modes are the useful part)

Each was isolated and rendered **on its own** before judging it, rather than being shipped on
the assumption that it worked:

1. **Thresholded ridged-fbm "bold branch" layer**, `max()`-combined with the existing dapple
   texture — the idea being one continuous thick branch plus fine speckle. Rendered alone it
   produces **blobby "cow-spot" patches**, not a flowing branch. Ridged fbm gives a *web* of
   thin ridges; raising the threshold to isolate only the strongest ridges doesn't thicken
   them, it fragments them.
2. **Continuous spatial modulation of the sampling frequency** (a slow selector field scaling
   the noise input coordinates), so some regions would show big shapes and others fine
   speckle. This produces **wood-grain / fingerprint concentric rings** — the classic
   frequency-modulation artifact: when you scale coordinates by a spatially varying factor,
   iso-value contours of that factor become visible as rings.
3. **Blending two fixed-frequency fields' output VALUES** weighted by a slow selector — safe
   against the ring artifact (no frequency is modulated, only a mix weight), but it didn't
   visibly beat the plain two-layer mask, so it was reverted rather than kept as noise.

`foliageMask` was returned byte-for-byte to its pre-pilot form after all three.

### What the references actually show

Re-reading the reference photos for **mechanism** rather than subject — especially the two
painted studies (`946b2a89…`, `4c815f6…`) where the construction is unambiguous — the shared
structure across both the paintings and the real dapple photography is:

> **a union of round blobs whose radii vary enormously, merged smoothly where they overlap.**

Sparse regions read as isolated dots of wildly different sizes; dense regions read as one
continuous flowing mass with bulging joins and irregular holes. That is a *placement +
combination* property, not a noise-thresholding property — which is why every noise-based
attempt above missed it.

### The technique (`clusterField` / Cluster pattern)

Three ingredients, all absent from the earlier grid-scatter patterns:

1. **Multi-octave scatter, rotated per octave.** Three scatters at cell sizes 1 : 1/2.3 :
   1/5.3, each evaluated in its **own rotated frame** (`o · 1.10714872` rad). Rotating by an
   irrational-ish angle means no two octaves' lattices can ever align, so the union has no
   recoverable repeat — this is what a single jittered grid can never achieve.
2. **Heavy-tailed radii.** `r = 0.10 + 0.75 · u^p` with `p = 1 + Layer2` (2…6). At p = 5 most
   discs sit near the minimum and a rare few reach full size — the huge size spread the
   references show. A uniform radius is the single biggest reason the older patterns read as
   "placed shapes."
3. **Smooth union (`smin`)** instead of `min()`. The polynomial smooth-minimum melts
   overlapping discs into one bulging mass with a fillet at the join, rather than a
   figure-of-eight of two circles. **This is where the branch-like continuity comes from** —
   it *emerges* from chains of overlapping discs rather than being drawn, which is exactly
   what attempt (1) tried and failed to draw explicitly.

Controls (panel relabels per §16 convention): Scale · **Coverage** (density) · Softness ·
**Size range** (tail exponent) · **Scatter** (per-cell jitter) · **Merge** (smin fillet
radius; 0 = separate circles, high = one continuous organic mass).

Two presets ship it at the two ends of its range: **Cluster Bloom** (dense merged mass,
yellow/green, matching the painted reference) and **Cluster Scatter** (sparse isolated dots of
varying size). Verified: both render without console errors, `buildSVG()` produces real
2-band vector geometry (54 KB / 81 KB, not degenerate rectangles), cold preview render ≈200 ms
(comparable to Fronds' 218 ms — the 3×9 = 27 cell probes per pixel are offset by the early
density cull), and all 14 built-in presets still apply cleanly.

**Not yet done:** Cluster is a new pattern, deliberately *added* rather than used to replace
the grid-scatter internals of Drop mark / Conifer / Fronds / Leaves. Retro-fitting those to
the same three ingredients (rotated multi-octave placement + heavy-tailed size + smooth union
of their own shape primitives instead of discs) is the obvious follow-up now that the
technique is proven, but it would change the look of four shipped patterns and four presets,
so it wants its own pass.

---

## 22. Retro-fitting the scatter engine into every shape pattern (July 27, 2026)

§21 proved the technique on a new pattern (Cluster) without touching anything shipped. This
pass does the follow-up it flagged: **Drop mark, Conifer, Fronds and Leaves now all run on the
same engine**, supplying only their own shape SDF.

### `scatterField(x, y, P, shapeFn, cfg)`

One function owns the three randomness ingredients (multi-octave rotated placement,
heavy-tailed sizes, smooth union — see §21 for why each is necessary). Each pattern passes:

- `shapeFn(qx, qy, size, cx, cy, P)` — coordinates relative to the shape centre in
  octave-local units. **The shape does its own rotation**, because orientation is not uniform
  across shapes: Drop mark may only tilt slightly (gravity has a direction), Fronds points
  mostly upward with Spread-dependent jitter, everything else is free 360°.
- `cfg = { octaves, sizeMin, sizeSpan, jitter }` — per-pattern tuning. Cheap shapes (discs)
  afford 3 octaves; the trig-heavy ones (needle/frond/leaf) use 2.

Shapes: `shapeDrop`, `shapeNeedle`, `shapeFrond`, `shapeLeaf`, `shapeDisc`.

### Two new controls, and why they had to be new

**Size range** and **Merge** are properties of the *scatter*, not of any shape — and every one
of the six existing sliders was already carrying a shape meaning (Layer 2 = Needle count /
Frond count / Elongation, Leaf detail = Sharpness / Taper / Serration / Tail length). Reusing
one would have made a control mean two different things depending on pattern. They're shown
**only for the five scatter patterns** and hidden for the noise-field ones (Broadleaf,
Cellular, Veins, Blinds, Blob), which have no discrete shapes to size or fuse — dead controls
are treated as a bug here, see §18.

**Size range gates the octave count as well as the radius tail** (`< 0.20` → 1 octave). Found
while retuning Bamboo Grove: with the slider at its floor the canes were still sprouting tiny
specks, because extra octaves *are* a size difference (each is a whole population at a smaller
scale) and they kept firing regardless. One control, one meaning: all size variety.

### Freed and re-purposed controls

Retro-fitting made two controls meaningless, and both were given real jobs rather than left
sitting dead:

- **Drop mark's Layer 2** drove a hand-rolled "satellite droplet" second pass, which the
  engine's finer octave now does natively. Re-purposed to **Splat** — how far the drop spreads
  sideways on impact (round drop → flattened splat).
- **Cluster's Layer 2 / Leaf detail** were standing in for Size range / Merge before those
  existed. Now **Elongation** (ellipse rather than circle) and **Irregularity** (radius wobble
  by angle), so its blobs read as hand-made lumps rather than geometric circles — closer to
  the reference paintings, which have no perfect circles in them.

### Preset retuning

The look of four shipped patterns changed by design, so their presets were re-checked visually
one by one rather than assumed:

- **Palm Shade** — improved as-is on the inherited defaults (0.55 / 0.30): big fronds with
  small ones scattered between, instead of the old uniform size.
- **Leaf Litter** — likewise; leaves now range from specks to large merged clumps.
- **Bamboo Grove** — needed retuning, and is the useful counter-example: **bamboo canes are
  genuinely near-uniform**, so the heavy tail that flatters palm actively hurt here. Ships
  with Size range 0.30 / Merge 0.10 and higher Coverage.
- **Cluster Bloom / Cluster Scatter** — remapped onto the new sliders (Size range 1.0, Merge
  0.77 / 0.40) and Coverage raised to 0.58 on Bloom, because Elongation narrows each blob and
  so lowered total coverage at the old density.

Verified: all 14 built-in presets apply and produce real multi-path vector SVG; all 10 patterns
render without console errors; cold render at 400×267 ranges 14 ms (Blinds) to 129 ms
(Cluster, 3 octaves) — the per-cell density cull before any shape maths is what keeps
multi-octave affordable in JS.

**Design note for future patterns:** the engine is the default way to place shapes now. A new
shape pattern should be a `shapeFn` plus a `cfg`, not a new grid loop.

---

## 23. Raking light — directional stretch (July 27, 2026)

Built from a reference photo of low sun on leather: soft light pools all elongated along **one
shared diagonal**, with dark channels between them, in warm two-tone.

**Why no existing control could do it.** Cluster already has Elongation, but it rotates every
blob independently (`rot = hash2(…) · 2π`), so raising it gives ellipses pointing every which
way — noisier, not directional. Per-shape elongation and *shared* directionality are different
things, and no amount of the former produces the latter.

**The mechanism, taken from what's physically happening.** Light striking a surface at a
glancing angle foreshortens the whole projected pattern along the direction of incidence —
every shape stretches the same way because the *projection* is anisotropic, not the shapes.
So it belongs to the projection, and lives in `groundPoint()` alongside Spread:

```
rotate ground coords into the rake frame → scale that axis by 1/(1 + rake·4) → rotate back
```

Compressing the *sample* coordinates along an axis makes the sampled pattern appear stretched
along it. Two controls in **Format**: **Raking** (amount) and **Rake angle** (0…1 → 0…180°).

Because it acts on the coordinates feeding the mask, it applies to **every pattern**, noise-field
and shape-scatter alike — Broadleaf, Veins, Blinds and Blob all gain a directional variant for
free, which a per-shape control could never have given them.

**Verified as a true no-op at 0**, not assumed: sampled 500 random pixels and confirmed the
ground coordinates are bit-identical to the pre-Raking formula (max delta 0), and checked that
all 14 pre-existing presets carry Raking = 0 — so nothing shipped changed appearance. All 10
patterns render with Raking on; all 15 presets produce real vector SVG.

Shipped as the **Raking Leather** preset (Cluster + Raking 0.45 at 54°, high Merge so the dark
forms connected channels, warm cream/dark-brown two-tone, some grain and vignette).

---

*Studio Rann · Organica System v0.1 · July 27, 2026*
