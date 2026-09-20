---
name: fvs-figure-from-image
description: Read a reference image of a pattern/figure (a print, a photo of a screen, a screenshot) and turn it into an FVS figure recipe v2 (JSON), then check it in the FVS Figure tab. Use when asked to "replicate", "reconstruct" or "study" a figure in FVS.
---

# Image → FVS figure recipe

FVS describes a figure as **Seed · lattice · slot classes · class→content/pose rules · composition · transform**, none of which mentions a particular Seed. Read the image bottom-up, then emit one JSON recipe and verify it.

## 1. Decode (write the answers down before writing JSON)
1. **Seed** — the unit shape (triangle, arc, star, blob …) and whether it is filled or outlined; ink and paper colours.
2. **Lattice** — the smallest repeated slot and how slots are laid out: `triangle` (n rows, up/down cells), `square` (cols × rows). Measure the slot width (e.g. the width of one hole) and count rows and the width of each row. If the outline steps (widths 3,4,3,4 units) the figure is a **stack of identical tiers**, not one bigger lattice.
3. **Classes** — which class of slot is filled/empty (`class: up|down`, `row`, `col`, `index`, `parity: odd|even`) and which class is turned (a down triangle that stays a triangle is `rotate: 180`).
4. **Levels** — does a smaller figure repeat as the tile of a bigger one? Then level 0 is a `symbol`, level 1 a `grid` (`tier` stack n, `triangle` rows n, `square` n).
5. **Transform** — the whole figure rotated 0/90/180/270 and/or mirrored over its right (`v`) or bottom (`h`) edge (`vh` both). A hexagon from a trapezoid is "mirror over the bottom edge"; a bow tie is "rotate 90 + mirror over the right edge".
6. Photos are often stretched or keystoned: trust counts and topology, not exact proportions.

## 2. Emit the recipe
```
{ "tool":"fvs-recipe","version":2,
  "element":{"type":"triangle","style":"fill","colors":["#f0301f"],"paper":"#ffffff"},
  "levels":[
    {"kind":"symbol","lattice":{"type":"triangle","rows":2},"fit":"fill",
     "rules":[{"when":{"class":"down"},"do":{"content":"empty"}}]},
    {"kind":"grid","lattice":{"type":"tier","stack":2}} ],
  "transform":{"rotate":0,"mirror":"none"} }
```
- Lattices: `triangle` (`rows`), `square` (`cols`, `rows`), `hexagon` (`rings`, with classes `ring` and `sector`; `rotate: 'sector'` gives 60° rosettes). Grid lattices: `square` (`n`), `triangle` (`rows`), `tier` (`stack`). Up to three grid levels: each figure is the tile of the next; a grid level may carry its own `transform`.
- `seed: 'live'` on a symbol level keeps the Element's own settings in every cell.
- `rules` apply in order; later rules override earlier ones. `when` keys: `class`, `row`, `col`, `index`, `parity`, `ring`, `sector` (a value or an array). `do` keys: `content` (`empty`|`filled`), `rotate`, `flipH`, `flipV`, `scale`.
- A `component` first level (`rule`: checkerboard / radial / pinwheel / mirror, with `params`) covers the classic 2×2 blocks.
- Examples: `triangleFigureRecipes()` and `FIGURE_RECIPES_V1_AS_V2` in `fvs/index.html`.

## 3. Verify
Open `/fvs/` on the dev server, the **Figure** tab, paste the JSON in *Recipe JSON* → Apply. Load the (cropped) reference image: the overlay and the checks report slot counts, shapes drawn, symmetry of mirrors, and the silhouette overlap with the reference. Iterate on the decode, not on the checks — a low overlap on a distorted photo is expected; a wrong count is not.
