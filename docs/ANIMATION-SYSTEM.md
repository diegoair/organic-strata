# Organica — Animation System Documentation

> Reference for the 55 organic form animations in `genesis/organic-library.css`.  
> Use this when extending the library, debugging existing forms, or building new tools on top of Genesis.

---

## Core Principle

Each form animates according to its **real physical or biological mechanics** — not generic motion presets applied to arbitrary shapes. The question behind every animation is: *what force or process actually governs this thing in nature?*

This is why the animations feel convincing: the timing, easing, and transform type all correspond to the real phenomenon.

---

## The 6 Animation Patterns

### 1. Internal Pressure — `scale` with asymmetric easing

**What it simulates:** biological pressure systems — lungs, hearts, cells, fungi.  
**CSS mechanism:** `transform: scale()` cycling between a compressed and expanded state, using `cubic-bezier` with a fast expand / slow contract curve.  
**Key insight:** pressure builds slowly and releases fast (or vice versa) — a linear scale looks mechanical, not organic.

**Forms using this pattern:**
`01 breath` · `02 heartbeat` · `13 flower bloom` · `31 lung` · `45 mushroom inflate`

**Example — breath:**
```css
@keyframes breathe {
  0%, 100% { transform: scale(.78) }
  50%       { transform: scale(1.02) }
}
.a01 .b {
  transform-origin: 100px 100px;
  animation: breathe 3.4s cubic-bezier(.5,0,.5,1) infinite;
}
```

**Heartbeat variation:** multiple keyframe stops simulate the double-pump — `scale(1.02)` at 20%, drops to `.92`, spikes to `1.06`, then long rest.

---

### 2. Gravity + Viscosity — `translateY` + `scaleY` combined

**What it simulates:** fluid dynamics — drops, honey, lava, dew.  
**CSS mechanism:** vertical translation paired with Y-axis scaling. Stretches on acceleration, compresses on impact. Duration and easing encode viscosity.  
**Key insight:** a falling drop elongates (`scaleY > 1`), flattens on impact (`scaleY < 1`). Honey is slow to start (`cubic-bezier(.6,0,.5,1)`), water is fast.

**Forms using this pattern:**
`07 drop fall` · `08 lava lamp` · `09 lava detach` · `10 honey drip` · `44 dew form` · `49 pebble splash`

**Example — honey drip:**
```css
@keyframes honey {
  0%    { transform: scaleY(1) translateY(0) }
  40%   { transform: scaleY(2.6) translateY(8px) }   /* stretching under gravity */
  55%   { transform: scaleY(2.2) translateY(20px) }  /* still elongated, falling */
  70%   { transform: scaleY(.9) translateY(40px); opacity:.9 }  /* impact squash */
  100%  { transform: scaleY(.9) translateY(60px); opacity:0 }
}
```

**Splash forms** add a secondary `circle` element expanding from `r:0` to `r:60px` with `opacity:0` — the ripple from impact, triggered at the same moment the drop disappears.

---

### 3. Growth by Tracing — `stroke-dashoffset`

**What it simulates:** biological growth — vines, roots, shells, tree rings, mycelium.  
**CSS mechanism:** `stroke-dasharray` sets the total stroke length; animating `stroke-dashoffset` from that value to `0` "draws" the path progressively.  
**Key insight:** the path shape encodes the growth direction. The timing encodes growth speed. For tree rings, each ring uses a CSS variable `--c` set to its actual circumference — so drawing speed is proportional to ring size, exactly like real growth.

**Forms using this pattern:**
`11 vine` · `15 sprout` · `16 roots` · `38 spiral shell` · `48 tree rings` · `51 vermicular`

**Example — tree rings (most sophisticated):**
```css
@keyframes ringDraw {
  0%,8%   { stroke-dashoffset: var(--c); opacity: 0 }
  16%     { opacity: 1 }
  68%     { stroke-dashoffset: 0; opacity: 1 }
  94%,100%{ stroke-dashoffset: 0; opacity: 0 }
}
.a48 .r1 { --c: 90  }
.a48 .r2 { --c: 140; animation-delay: .16s }
.a48 .r3 { --c: 200; animation-delay: .32s }
/* etc — each ring draws outward with staggered delay */
```

**Vermicular variation:** paths are ordered bottom-to-top with increasing `animation-delay`, simulating a worm or mycelium traveling upward.

---

### 4. Collective Behaviour — staggered delays + goo filter

**What it simulates:** swarms, colonies, fluid clusters — where individual elements form a collective.  
**CSS mechanism:** identical keyframes on multiple elements, each offset by a small `animation-delay` increment (typically `0.15–0.25s`). The SVG `filter: url(#goo)` (Gaussian blur + threshold matrix) merges nearby shapes into a single fluid body.  
**Key insight:** collective behaviour is NOT a complex animation — it's the same simple animation on many elements, phase-shifted. The goo filter does the rest optically.

**Forms using this pattern:**
`03 metaballs merge` · `04 orbit` · `05 swarm` · `27 cell divide` · `28 mitosis` · `41 bubble cluster` · `50 forest chord` · `55 lichen patches`

**The goo filter (from `organic-defs.js`):**
```svg
<filter id="goo">
  <feGaussianBlur stdDeviation="6" result="blur"/>
  <feColorMatrix mode="matrix"
    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"/>
  <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
</filter>
```
The `22 -10` values in the alpha channel are the threshold — increase `22` for harder edges, decrease for softer merging. `#goosoft` uses `18 -8` for gentler fusion.

**Example — forest chord (7 circles, wave-like breathing):**
```css
.a50 .c1 { animation: b1 2.8s ease-in-out infinite }
.a50 .c2 { animation: b1 2.8s ease-in-out infinite; animation-delay: .18s }
.a50 .c3 { animation: b1 2.8s ease-in-out infinite; animation-delay: .36s }
/* same keyframe, 0.18s apart — produces a travelling wave */
```

---

### 5. Environmental Forces — continuous translate

**What it simulates:** external forces acting on passive objects — wind, current, gravity fields.  
**CSS mechanism:** `translateX` or `translateY` cycling continuously, or linear travel from off-screen to off-screen.  
**Key insight:** unlike biological motion, environmental forces are constant and uniform. Use `linear` easing (not `ease-in-out`) for drift, current, and fall. Use `ease-in-out` for tidal oscillation.

**Forms using this pattern:**
`12 leaf sway` · `24 grass wind` · `42 pollen drift` · `43 tide` · `46 branch sway` · `54 sedimentation`

**Example — sedimentation (most complex):**
```css
@keyframes sink {
  0%   { transform: translate(var(--x), -30px); opacity: 0 }
  10%  { opacity: 1 }
  90%  { opacity: 1 }
  100% { transform: translate(var(--x), 230px); opacity: 0 }
}
.a54 .s1 { animation-duration: 7s }
.a54 .s2 { animation-duration: 8.6s; animation-delay: 1s }
.a54 .s3 { animation-duration: 6s;   animation-delay: .4s }
```
Each chip has a unique `--x` offset (horizontal position) and a different duration — simulating varying mass/drag through fluid. Heavier chips sink faster; lighter ones drift more.

---

### 6. Differential Rotation — counter-spinning layers

**What it simulates:** orbital mechanics, crystal growth, geological strata.  
**CSS mechanism:** two or more elements with `spin` and `spinR` (`rotate(360deg)` and `rotate(-360deg)`) at different speeds.  
**Key insight:** a single rotating element looks mechanical. Two layers rotating in opposite directions at different speeds create emergent visual complexity — the eye perceives a system with its own physics.

**Forms using this pattern:**
`04 orbit` · `14 petal turn` · `30 iris` · `36 moon phase` · `52 shard rotation`

**Example — shard rotation:**
```css
.a52 .big   { animation: spinSlow52 9s linear infinite }   /* outer layer, slow */
.a52 .small { animation: spinRev52  14s linear infinite }  /* inner layer, reverse, slower */
```

---

## Timing Philosophy

The animation duration range (`1.4s – 14s`) is not arbitrary — it maps to the **real-world time scale** of the phenomenon:

| Range | Phenomena |
|---|---|
| `1.4 – 2s` | Heartbeat, ripple, water drop |
| `2 – 3.5s` | Breathing, leaf sway, vine growth |
| `3.5 – 5s` | Flower bloom, jellyfish pulse, tree ring reveal |
| `5 – 9s` | Sedimentation, spiral shell, smoke |
| `9 – 14s` | Shard rotation, geological / tectonic forms |

Forms that feel slow feel slow because their real counterparts are slow. This is the single biggest contributor to perceived authenticity.

---

## Special Case — Form 35 (Phyllotaxis)

The only form generated programmatically at boot, not defined in SVG markup.

```js
// genesis-creator.js — fillSpiral() IIFE
const N=44, GA=Math.PI*(3-Math.sqrt(5)), C=12;
for(let i=1; i<=N; i++){
  const r = C * Math.sqrt(i);          // radius grows as √i
  const a = i * GA;                    // golden angle ≈ 137.5°
  // places circle at (x,y), radius and animation-delay increment with i
}
```

Each of 44 circles sits at golden-angle intervals on an Archimedean spiral — the same algorithm that governs sunflower seed packing, pinecone scales, and nautilus chambers. The CSS `animation-delay` increments by `0.05s` per circle, producing an outward ripple from center.

---

## How to Add a New Form

1. **Identify the real physics.** What force or process governs this subject? Choose the closest pattern from the 6 above.

2. **Pick the next available ID** (`56`, `57`, etc.) and add a class `.a56` block to `organic-library.css`.

3. **Add the SVG markup** to `organic-forms.js` as `window.ORGANIC_FORMS[56]` — a self-contained `<svg viewBox="0 0 200 200" class="a56">`. Use `fill: var(--ink)` / `stroke: var(--ink)` for all color — never hardcode hex values.

4. **Add the label** to `window.ORGANIC_LABELS[56]` in `organic-forms.js`.

5. **If the form uses the goo filter or terrazzo chips**, they're already in `organic-defs.js` — reference `filter: url(#goo)` or `<use href="#cA"/>` directly. No changes needed to defs.

6. **Test in `genesis/indicators.html`** — reload and confirm the form animates correctly in the catalog grid before integrating into the composer.

---

## Files Reference

| File | Role | Modify? |
|---|---|---|
| `organic-library.css` | All 55 `@keyframes` + `.aNN` rules | Yes — add new form rules here |
| `organic-forms.js` | SVG markup for all 55 forms + labels | Yes — add `ORGANIC_FORMS[N]` and `ORGANIC_LABELS[N]` |
| `organic-defs.js` | Shared SVG `<defs>`: goo filters + 7 terrazzo chip paths | Rarely — only if adding new shared filters |
| `genesis-creator.js` | Composer interaction logic | Yes — update form count if adding forms |

---

*Last updated: June 2026 — Organica System v0.1*
