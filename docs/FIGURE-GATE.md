# Figure closing gate

The gate that closes a day of work on the FVS Figure graph before it is called done. It has two halves:
an **automated** run, which proves nothing broke, and a **manual** pass in the browser, which checks
what a test cannot judge (does it read right, does it feel right, in both themes). It was first written
for **Oct 9, 2026** (38 commits, `7a358d1` → `8162691`, listed in §3). A later day copies §3 and replaces
the checklist with that day's work.

The gate does not decide anything. A wording or behaviour question it raises goes to the ledger
(`docs/DESIGN-DECISIONS.md` §1), not into a fix made during the gate.

## 1. When

- At the end of a working day that touched `fvs/js/*figure*`, `fvs/js/engine/17-*`, `shared/node-canvas.*` or the
  Figure's icons.
- Before "porta in prod" when the day's Figure commits are still local.
- After a parallel session pushed Figure commits you did not watch.

## 2. Automated half

```bash
scripts/gate-figure.sh 7a358d1
```

`BASE` is the commit the day started from (for Oct 9, `7a358d1`, the Oct 8 session note). The script runs every
check below, keeps going after a failure, and prints one summary plus a log folder:

| Step | What it proves |
|---|---|
| `check.py` | Repo integrity: JS syntax, refs, icons registry, templates, css-lint, FVS engine has no UI, node-canvas logic, session log |
| `ds-audit.py --diff BASE` | The whole day adds no raw values (font size, spacing, radius, colour, duration) |
| `test-figure-graph` | The engine: 25 built-ins identical as graphs, the rule chain, the migrations, Variations (Vary, Amount, Changes, Series / Table, Palette / Content keys, pins, edits, nested, the "no visible change" child) |
| `test-figure-eval` | `evalFigure` against the recipes |
| `test-figure-board` light + dark | Every board gesture with real input, clean mouse and with a side button held; Rotate & mirror panel; Use variation; Series + Table |
| `regression` | The 346 FVS cases match the baseline |
| `test-fvs-qa`, `test-fvs-ui` | FVS end-to-end journeys (Element → Component → Symbol), console errors, screenshots |
| `test-rhizome` | The other consumer of `shared/node-canvas.js` (the chord shim, Space pan and cursors changed today) |
| `test-fvs-perf` | Save and draw times stay in budget |

**Pass** = every line PASS. A failure is fixed and the whole script run again. Do not start the manual half on a red run.

## 3. Manual half — Oct 9, 2026

Open `/fvs/`, step Figure, on the local server. Do each item in **light**, then toggle the moon and repeat the
items marked ◐ in **dark**. Tick an item only when it does what the line says. Write anything odd in §4 and
keep going.

### 3.1 Board and node bar (`000675b` … `3aaf5b3`, `1aac893` … `2ff5b86`)

- [ ] The four steps sit in the left dock as an icon group. Element, Component, Symbol and Figure icons read as tile → 2×2 → 3×3 → joined truchet. ◐
- [ ] The node bar shows tiles (icon over name, two per row). Figure is under **Content**. Variations is under **Rules**. ◐
- [ ] Drag a tile onto the board → a node appears where you drop it. Click a tile → a node appears.
- [ ] Cursors: grab over a card or pill at rest, grabbing while it moves, crosshair over a port, arrow on the empty board.
- [ ] **Space + drag** pans, even right after clicking a dock button. Wheel-button drag pans. Both show grabbing.
- [ ] With the mouse's side button held (or any extra button), click, drag, marquee and wire still work and nothing stays stuck afterwards.

### 3.2 Figure card and the rule chain (`7556602`, `515c8f3`)

- [ ] The Figure card has the round icon cap and its name on one row, the drawing, and one meta line. No breadcrumb. ◐
- [ ] Rule nodes chain: Cell rules → Repeat in grid → Rotate & mirror → Figure. Drop a new rule on a wire that is already in the chain → it slots in, and the order on the board is the order applied.
- [ ] The Figure panel lists the chain in that order.
- [ ] Open an **older saved graph** (from before today) → it draws as it did, with a notice that the rules were chained.
- [ ] Component rule on a Square grid of any size (also odd, e.g. 5×5 with Radial) draws. On a Loom grid it is refused with a reason on the card.
- [ ] Checkerboard: *Swap A and B* and *Flip B* both change the drawing.

### 3.3 Rotate & mirror (`0659329` … `f6aba9a`)

- [ ] With **no Repeat** before it: every Element turns or flips inside its own cell. The Rotation slider moves in 1° steps.
- [ ] Flip and Mirror icon toggles work. Which cells, Rotation per cell + Counted by change the pattern.
- [ ] Random rotation = a 0–180° slider. Its seed button is the refresh icon, like every other seed.
- [ ] **After a Repeat**: only quarter turns. Anything else shows an error on the card.
- [ ] The pill says what is set. ◐

### 3.4 Variations node (`a0f424a`, `274a0b0`, `b94ccfe`, `cd72999`)

- [ ] Figure panel → *Add Variations* → Figure → Variations → n children (default 3), named *variation 1 … n*. ◐
- [ ] Several Variations nodes on one Figure are numbered. Their children are named after their own node.
- [ ] An older saved Figure that had Variations > 1 opens as Figure → Variations → children, with one notice.
- [ ] Variations adjust the rules already in the chain and never add a rule.
- [ ] *Use variation* on a child: the Figure draws that variation, and one undo brings it back. On a child with its own inputs it is refused with a reason.

### 3.5 Variations, first level (`76fa7b9`, `c5a8fe7`)

- [ ] **Vary** rows: one per input with its port colour as a dot. Grid and Palette open to their parameters with the chevron. ◐
- [ ] **N2:** on a Figure with a single Element, *Content* reads **unticked** (nothing to vary). Tick it → its parameters (Rotation, Flip, Style…) all tick and the children change.
- [ ] **N3:** untick *Palette* → its parameters show unticked and disabled.
- [ ] **Changes per variation** 1 · 2 · 3 changes how many captions each child gets.
- [ ] **New seeds only** disables Amount, Changes per variation, Palette and Cell rules.
- [ ] **Amount** 0 → children barely move. 100 → they move a lot. 50 = the drawings from before today (an old pin draws the same).
- [ ] A child's panel lists its **Changes** (dot · parameter · value). Edit a number → the child is pinned and keeps the value after *New variations* (refresh). ◐
- [ ] *Add Variations* on a child → a Variations node that varies around **that** child.

### 3.6 Variations, second level (`5ddd434`, `bc42cc7`, `8162691`)

- [ ] **Mode** Random · Series · Table. Switching back to Random restores your Random settings.
- [ ] **Series**: pick Grid Columns, From 5 To 8 → 4 children captioned *Grid: Columns 5 … 8*, in order. A step equal to the Figure is still shown.
- [ ] Pin a Series child, change the seed → the pin keeps its slot and the other steps are unchanged.
- [ ] **Table**: Across × Down, Values 2–4 → children laid out in rows. The product never passes 12 (4 × 4 not offered).
- [ ] Palette opt-ins: *Lightness*, *Chroma*, *Paper*, *Another palette*, *Colourway* each produce a visible, readable change. The inks keep contrast on the paper. ◐
- [ ] Content opt-ins: *Rotation*, *Flip horizontal / vertical*, *Style*, *Stroke width*, *Scale*, and *Item* (on a Set without fan-out) each produce a visible change.
- [ ] Captions are prefixed with their input, also for Content (*Content: New spread*).
- [ ] *Use variation* on a child that changed the Element itself is refused before anything is written.
- [ ] **N8:** set Vary to almost nothing and Variations to 6 → the children no draw can fill say *No visible change — … tick more under Vary*. A child past the count still says *raise Variations*.

### 3.7 Across the day

- [ ] Export from a Figure (SVG and PNG) and from a variation child: the file matches the card.
- [ ] Save the graph, reload the page, open it: everything above comes back (chain order, Variations settings, pins, edits, Mode).
- [ ] Console (Cmd+Opt+J): no errors after the whole pass.
- [ ] `/design-system/_dark-audit.html` → Run: no new failures.

## 4. Record

Tick each commit in the **Organica test log** artifact (https://claude.ai/artifact/FsEoGMwKmWeKinrXfUhvyh) as you go. It lists every commit of the day with a "try this" and a link, and its note field is where a failure goes. Then:

When both halves pass, add a line to the day's session note in `CLAUDE.md` (append in place — never rewrite the
note), for example *Figure gate passed, automated + manual, HEAD `8162691`*. Anything odd from §3 is either:

- a **bug** → fixed, then the automated half run again, or
- a **word or behaviour** to decide → a row in `docs/DESIGN-DECISIONS.md` §1, linked from the note.

The open owner questions from Oct 9 are O-59 (Variations varying cell-mode Rotate & mirror), O-60, O-61 and O-62.
The gate tests what was built with the recommended option. It does not answer those questions.
