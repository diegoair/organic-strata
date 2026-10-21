# FVS Component — Rules and transformations (plan)

> Diego, Oct 21, 2026. *The Rule decides, the transformation transforms.* Rules are simple presets that guide the
> creation; a transformation (Turn first, then Flip and Scale) is applied **after** the rule, on every cell of its result.
> A rule that gets a transformation becomes **Custom** in the Rule menu, and can be **saved as your own rule** (a preset,
> as in Living Path / Sinew / Apostate). Status: planned, nothing built.

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

1. **Turn after the rule.** Replace the Turns chips + Free angles with a switch (off) + **Up to** + **Every**; apply +t to
   every cell after the rule; remove the row on Step turn and Radial. Design-system CONSULT first (words, the row, the
   count line). Re-record the baselines where the old Turns wiring drew (Mirror's turn, Checkerboard's pairs, Uniform on
   lattices) — reviewed case by case.
2. **Custom.** A transformation on a system rule → the Rule menu shows **Custom** (base rule kept underneath); picking a
   system rule resets the transformations. Exhaustive / Random: a line that lists the transformations applied.
3. **Your rules.** The Rule menu on `Organica.presetPicker`: system rules (with their pictograms) + **Yours** (saved rules,
   delete button), stored with `Organica.store('fvs-rules')` (cloud-synced). *Save rule…* names it. A saved rule restores
   its base rule, its controls and its transformations.
4. **Checkerboard's own controls.** Cells A · Cells B · Start at in the Component step, as the Symbol's (`sel-rule-chk-rota`,
   `sel-rule-chk-rot`, `chk-rule-chk-swap`, Flip B); Checkerboard stops deriving pairs from the axes.
5. **Flip and Scale** on the same model (after the rule), once Turn is right.
6. **Rule by rule tests with Diego**, then the rule atlas, `docs/FVS.md` §5, UI-COPY and the ledger.
