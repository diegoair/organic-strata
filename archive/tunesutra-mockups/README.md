# TuneSutra — the Nov 18, 2026 mockups (archived)

Archived on **Nov 20, 2026**. Diego asked to keep the pages in git and archive them now that every one has been built into TuneSutra. These are four dev pages, made on Nov 18, 2026 to decide one question each. They are frozen and never edited.

The pages still load the live `/shared/*` scripts, and `layout/` also loads `/tunesutra/house.js`. A later change to those files can break these copies. The TuneSutra redesign changed `house.js` (2–9 colours), so `layout/` may not draw correctly any more. Use them as references, not as pages to keep running.

| Page | The question | What was decided · where it lives now |
|---|---|---|
| `layout/` | How should the colours sit on the sheet? | The + card adds a colour and the Colour section sits to the right of the Contrast pairs. The 0–900 tints can be selected and the Gradient view was removed. See `docs/DESIGN-DECISIONS.md` (2026-11-18) and `docs/TUNESUTRA.md` §1. |
| `gradient-panel/` | How to show which control is for the gradient, the grain and the shadow? | Mockup A won, three sections. Grain was later removed, so the panel is now Gradient · Shadow. See `docs/TUNESUTRA.md` §1. |
| `shadow-ink/` | The painter's shadow on one sphere: hue shift, saturation lost and found, the parts. | The two inks (Halftone · Core) and the parts Terminator, Core shadow, Reflected light and Highlight. This is the Shadow section in `tunesutra/index.html`. |
| `shadow-types/` | Every candidate shadow texture side by side, all vector. | 11 types were chosen and are drawn by `shared/shade-marks.js` (`Organica.shadeMarks`). They appear in the Shading dropdown. See `docs/TUNESUTRA.md`. |

The Hue × tone lab is not here. It stays live in `explorations/tunesutra-hue-tone/`.
