# FVS Component — Rules and transformations (plan)

> Diego, Oct 21, 2026. *The Rule decides, the transformation transforms.* Rules are simple presets that guide the
> creation; a transformation (Turn first, then Flip and Scale) is applied **after** the rule, on every cell of its result.
> A rule that gets a transformation becomes **Custom** in the Rule menu, and can be **saved as your own rule** (a preset,
> as in Living Path / Sinew / Apostate). Status: **phases 1–4 built Oct 21, 2026** (local); phases 5–6 planned.

## Decisions (Diego, Oct 21, 2026)

| # | Question | Answer |
|---|---|---|
| — | Where Turn applies | **After the rule** (rule first, then the transformation) |
| — | Turn's controls | Off by default; when on: **Up to** (how far it turns) and **Every** (the step between turns) — the content proposal, accepted |
| — | A free step on square cells | Fine: it breaks the grid, the cells clip to their cell |
| — | Where Turn makes no sense | **Removed**, not shown (Step turn, Radial: their turns are their own) |
| 1 | The menu label once transformed | **Custom** only |
| 2 | What your own rule saves | The base rule + its own controls (Line, Span, Cells A / B…) + the transformations. Not Grid, not Palette |
| 3 | Picking a system rule after a Custom one | Starts clean: transformations off |
| 4 | Exhaustive and Random | The axes are their material, not a retouch: they never become Custom; the panel **shows the transformations applied** |
| 5 | Checkerboard | Gets its own controls inside the rule (**Cells A · Cells B · Start at**, as the Symbol step's Checkerboard) and stops reading its pairs from Turns |

## What each rule owns, and what Turn does

| Rule | Its own transformations (in the Rule) | Turn (after) |
|---|---|---|
| Uniform | none | +t on every cell — one Component per turn → Custom |
| Step turn | 4 starts × 2 directions | removed |
| Mirror | Line, Span | +t on every cell → Custom (no longer a strict mirror) |
| Checkerboard | Cells A · Cells B · Start at (new, from the Symbol step) | +t on every cell → Custom |
| Radial | each cell towards the centre, Turn by | removed |
| Horizontal / Vertical lines | Step, Alternate / Ramp | +t on every cell → Custom |
| Rhythm | its angles | +t on every cell → Custom |
| Random | draws from the families | the turns it draws from — never Custom, the applied turns shown |
| Exhaustive | every combination | every axis on and wired — never Custom, the applied turns shown |

One Component per turn value: the rule's Components × the turns (Up to / Every), each cell's rotation + t. The look-alike
fold (§5.2a) still removes what draws the same.

## Phases

1. **Turn after the rule.** — *Built Oct 21, 2026.* Checkerboard, Random and Exhaustive keep the cell shape's own turns **inside the rule** whatever Turns says (Diego: *the turns are their material, in the rule; their numbers must not drop*), and Turns adds after them too. Mirror no longer turns inside (4 Components, not 8, until Turns adds). Every 5°–180° in 5° steps, Up to 0–355°; defaults per cell shape (square 270 / 90, hexagon 300 / 60, triangle 240 / 120); a count *4 turns*.
   Was: Replace the Turns chips + Free angles with a switch (off) + **Up to** + **Every**; apply +t to
   every cell after the rule; remove the row on Step turn and Radial. Design-system CONSULT first (words, the row, the
   count line). Re-record the baselines where the old Turns wiring drew (Mirror's turn, Checkerboard's pairs, Uniform on
   lattices) — reviewed case by case.
2. **Custom.** — *Built Oct 21, 2026*: with Turns on (two turns or more) Uniform, Mirror, Checkerboard, Lines and Rhythm show **Custom** with a new icon (`fvs-rule-custom`, Diego's pick over the base rule's pictogram), name *Rule: Custom, from ‹rule›*; any pick from the menu (the same rule too) turns Turns off; Random and Exhaustive never Custom and show **no** extra line (Diego). Shared: `Organica.selectPicker` gains `display()` and `onPick()`.
   Was: A transformation on a system rule → the Rule menu shows **Custom** (base rule kept underneath); picking a
   system rule resets the transformations. Exhaustive / Random: a line that lists the transformations applied.
3. **Your rules.** — *Built Oct 21, 2026*: the Rule menu stays `Organica.selectPicker` on `#sel-rule` (presetPicker would replace the select the engine reads) with a group **Yours** (values `mine:<name>`), each row with its base rule's pictogram and an armed delete; **Save rule…** under the picker while the rule is Custom and not saved as it stands (`Organica.prompt` *Save rule* · *Rule name*; a built-in name refused; a used name asks *Replace the saved rule “…”?*); toasts *Rule saved* / *Rule deleted*; a saved rule unchanged shows its own name, edited shows *Custom* (*from ‹name›*); a saved rule follows its base rule's availability. Stored in `Organica.store('fvs-rules')`: base, its block's controls, the segmented settings on state, Turns. Shared: every picker's row delete (`.pi-del`) is now armed (two clicks) — Living Path, Sinew, Apostate too (Diego).
   Was: The Rule menu on `Organica.presetPicker`: system rules (with their pictograms) + **Yours** (saved rules,
   delete button), stored with `Organica.store('fvs-rules')` (cloud-synced). *Save rule…* names it. A saved rule restores
   its base rule, its controls and its transformations.
4. **Checkerboard's own controls.** — *Built Oct 21, 2026*: **Cells A** · **Cells B** (*Any* · 0° · 90° · 180° · 270°, default Any = every pair of the rule's own turns, as before — 6 on a square 2×2; A = 0° → 3; A = 0°, B = 90° → 1) and **Flip B instead of rotate** (each A with itself mirrored; Cells B hides), before *Start at*. Square cells only — the lattices keep their A · B · C. Saved with your rules.
   Was: Cells A · Cells B · Start at in the Component step, as the Symbol's (`sel-rule-chk-rota`,
   `sel-rule-chk-rot`, `chk-rule-chk-swap`, Flip B); Checkerboard stops deriving pairs from the axes.
5. **Flip and Scale** on the same model (after the rule), once Turn is right.
6. **Rule by rule tests with Diego**, then the rule atlas, `docs/FVS.md` §5, UI-COPY and the ledger.
