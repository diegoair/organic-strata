# Komorebi — User Manual

> Studio Rann · Organica · 木漏れ日 — Dappled Sunlight Through a Canopy
> Live: [theorganicalanguage.vercel.app/komorebi/](https://theorganicalanguage.vercel.app/komorebi/)
> Last updated: July 25, 2026 (Gobo-only pattern focus)

---

## 1. What Komorebi does

**Komorebi** (木漏れ日, *"sunlight leaking through trees"*) replicates dappled sunlight
filtering through a forest canopy — the shifting coins of light, the soft leaf-shadows, and
the shafts of light breaking through gaps — in **real time on the GPU**.

There is no repository called "komorebi" because it is a poetic word, not a graphics term.
The effect is built instead from the three technical mechanics that actually produce it:

1. **Light cookie / gobo** — the dappled leaf-shadows on the ground.
2. **Penumbra + pinhole** — why real komorebi is round soft coins of light, not sharp leaf
   silhouettes.
3. **Volumetric light / god rays** — the shafts of light breaking through the canopy.

Komorebi is a **single-file vanilla HTML/CSS/JS** tool, like the rest of Organica. The one
difference: it renders with **WebGL 2**. WebGL is a browser API, not a framework or an
npm dependency, so it holds the single-file / no-build rule — but a radial ray-blur in
Canvas2D JavaScript would be on the order of 9 million operations per frame and would not
run. The GPU is not optional here; it is what makes the effect live.

If the browser has no WebGL 2, the tool shows a short notice instead of the canvas.

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
  is the loop-closer: a **Halide** 1-bit export, a **Strata** trace, or a plain photo of a
  real canopy all drop straight in. Scale / Density / Edge still apply.

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

*Studio Rann · Organica System v0.1 · July 25, 2026*
