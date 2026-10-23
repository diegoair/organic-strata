# FVS — Tropism, v2 (rewritten Oct 23, 2026 on today's model)

> Codename **Tropism** (Diego, Oct 14, 2026): cells turn in response to a signal — a rule, a field, a photo.
> **v2 (Oct 23, 2026, Diego: *ok go ahead*)** rewrites the plan on the model the rule-by-rule tests (Oct 21–23) left:
> every rule is a package, the Transform axes act after a rule or as its material, every variant is named and grouped,
> an Element can keep its own proportions. The v1 text (Oct 14–15) is in git (`42de358` and before); what it decided
> still stands where it isn't superseded here (ledger O-73, §2 2026-10-14 / -15).

## What changed since v1
- **Superseded:** v1's Phase 1–2 core — a level → value mapping per axis (`AXES`, `fromLevel`) and a *Driven by* menu on
  every axis. Today the rules have (almost) no controls: Checkerboard, Radial, Lines, Rhythm and Exhaustive / Random are
  packages; Turns, Flip and Scale are either applied after the rule (Uniform, Mirror) or the rule's own material
  (`TURNS_REPLACE`, `FS_AFTER`, `docs/FVS.md` §5). A per-axis *Driven by* would put controls back on rules we just
  emptied — dropped.
- **Built:** v1 Phase 0 (Components by hand in Component Edit, Oct 14); Phase 1's Turns / Sizes became today's
  Transform axes (Turns = Up to / Every); the grouping by variant (`rv`, `ck`, `xf`) gives every Component a name.
- **Still open and still worth it:** everything that **adds a capability** — colour and layers following the rule, a
  shift / stretch per cell, field and photo signals, the Photo Element style, and the new structures.

## Decided (Diego, Oct 23, 2026 — O-76 answered)
- **T1 Ink — dropped** (*non farlo, cancellalo dal piano*). Colour keeps coming from Colour by (by position), Layer
  colour variants and Colourways; the backlog item *colour follows the rule* stays a backlog idea, not a phase.
- **T6 Structures — dropped** (From a hand-drawn piece, Nest, Paths).
- **T2 Photo first**, and only **Normal · Tone · Dither**, all **from the Palette**; **Inside each Element** only.
- **T3, T4, T5 — a test page first** for each, to understand them before anything is planned in the tool.
- T-D4 (hide Manual) and T-D5 (the words) — unchanged: Manual stays as it is; the words through a CONSULT per phase.

## T2 — Photo in the Element (building, Oct 23, 2026)
A new Element **Style**, **Photo** (beside Fill · Stroke · Pattern): the shape is a mask and an uploaded photo shows
through it, laid out in the Element's own 0–100 box — so it turns, flips and scales with every cell (Component, Symbol,
Figure) like the Pattern does. **Looks**, every one from the Element's Palette:
- **Normal** — the photo as it is (a raster, embedded).
- **Tone** — a gradient map on the Palette: darkest → Ink 1, then the other inks in order, lightest → Paper (a raster;
  one ink = Ink → Paper).
- **Dither** — every pixel takes the nearest of the inks + Paper by tone, by error diffusion (Floyd–Steinberg ·
  Atkinson · Bayer · Threshold, Halide's), drawn as **vector** — one path per ink, Paper empty — so plates and print work.
The photo is stored downscaled (≤ 1024 px JPEG) in the Element; the dither's paths are cached, never stored.
Later, not now: *Across the Component* (one photo through every cell), Stipple, Bands.

## Test pages first (not in the tool)
- **T3 — Image and Field signals:** a signal per cell (the luminance of a photo under its centre; noise, a gradient,
  Rings) drives its turn, size or ink; Walks (*Spiral*, *Snake*) as Step turn orders.
- **T4 — Offset and Stretch per cell → Glide:** each cell shifted / stretched by a % of the cell; Mirror's *Glide*
  (alternate rows flipped and shifted half a cell).
- **T5 — Layers follow the rule:** a cell's class (Checkerboard A / B, a line, a beat) decides which of the Element's
  layers show or turn.
Each page is a local dev page (`explorations/`), not shipped until Diego says so.

## Verification (every phase)
- `scripts/test-fvs.sh` (24 suites); regression and axes baselines unchanged until a phase deliberately re-records
  (named in the commit); new fields absent at defaults (`test-fvs-axes` asserts it).
- A per-phase test (T2: `scripts/test-fvs-photo.sh` — the three Looks, the Palette inks, vector Dither, baselines unchanged).
- Headless screenshots on a separate port (never Diego's tab); `python3 scripts/check.py`, `ds-audit.py --diff`;
  the rule atlas re-captured; `docs/FVS.md`, UI-COPY and the ledger in the same change.
