# UI copy — the words on the interface

> Content-design rules and the glossary for every visible string in Organica: panel
> section titles, labels, buttons, options, placeholders, hints, status lines, toasts,
> `aria-label`s. Kept by the design-system agent (`.claude/agents/design-system.md`),
> decided by Diego. Started Oct 4, 2026, from the naming audit
> (`/design-system/_colour-audit.html` §8).

A label is part of the design system like a token: the same thing has the same name in
every tool, and one word has one meaning. A wrong or drifting label costs the same refactor
a raw hex does — it just shows up in a user's head instead of in the CSS.

## 1. Rules

1. **One concept, one word; one word, one meaning — across the whole suite.** Before naming a
   control, look the concept up in §2. If the word you want already means something else
   (see the conflicts in §3), pick another.
2. **Name what the user gets, not how the code does it.** "Paper", not "bg"; "Colour by",
   not "Mapping"; no internal ids (`rmx`, `cp-bg`) as text.
3. **Sentence case** for every control, title and option ("Save to library", "Random
   colours"). Capitals only for proper nouns: tool names, and the FVS / Genesis domain
   nouns when they name the object (Seed, Element, Component, Symbol, Figure).
4. **English, one spelling.** No Italian strings in the UI. UK vs US spelling: *pending*
   (D5 / N9) — until decided, do not introduce a new spelling that differs from the rest of
   the same tool.
5. **Whole words.** No "BG", "Med", "Adapt", "Stop rec", "col." — unless the abbreviation is
   the domain term (PNG, DPI, CMYK, OTF).
6. **The visible label is contained in the accessible name** (WCAG 2.5.3). A row labelled
   "Paper" is not announced as "Background colour". Prefer `Organica.autoLabelPanel` over
   hand-written names; when hand-written, use one pattern: "‹Label› colour", "‹Label› hex".
   (`Organica.palette.swatch` applies this pattern to every colour row since Oct 4, 2026.)
7. **Verbs for actions, nouns for settings.** A button says what happens ("Render",
   "Restart", "Export"); a row says what it sets ("Spacing", "Opacity").
8. **Same action, same verb**: Reset = back to defaults · Restart = run again from the
   start · Clear = empty it · Delete = remove for good (armed or held; a held button is named *‹Action› — hold to confirm*) · Open = the main source
   file · Add = one more item. (Matches the icon meanings in `CLAUDE.md`: refresh / reset /
   close / trash / eraser.)
9. **Units and ranges are consistent**: a percentage is 0–100 and says %; a seed is a number.
10. **Status and toasts**: past tense, what happened + what it is — "PNG exported",
    "Preset saved". Errors say what to do next — e.g. the shared storage-full notice
    (`Organica.storageFull`, `shared/core.js`, Oct 7, 2026): *Not saved: this browser’s
    storage is full. Delete what you no longer need, then save again.*
11. **Changing a label never changes an id or a preset key** — saved work depends on them.
12. **Typographic apostrophe** (Diego, Oct 7, 2026): every visible string uses ’ (U+2019),
    never the straight ' — "browser’s", "don’t", "‹name›’s". Applies to text, options,
    placeholders, hints, toasts, `aria-label` and `title`. Not copy: a `'` that delimits a JS
    string or belongs to HTML / CSS syntax. Swept Oct 7, 2026; `scripts/check.py` keeps it (`scripts/check-apostrophes.mjs` —
    `--fix` rewrites, `apostrophe-ok` on a line keeps a deliberate one).

## 2. Glossary

Status: **Decided** (in the ledger, enforce it) · **Pending** (a question for Diego — do not
"fix" towards one option before he answers; flag the drift instead).

| Concept | Word | Status | Not | Where decided / asked |
|---|---|---|---|---|
| **Figure graph** — the node surface of the FVS Figure step, and the file it is saved as | **Graph** — floatbar menu *Graph* (`aria-label` "Graph"); in it *Saved graphs* (select), *Graph name*, **Save**, **Delete** (armed), **New graph**, **Open file…** (a graph or a Figure recipe, `.json`), **Save as file**; right panel with nothing selected: *‹n› Figures · ‹m› nodes* | Decided | Canvas (= the Canvas node, the page), Board, Workflow, Pipeline, Preset (N8 — a graph is not a preset), Recipe (the JSON a Figure compiles to — docs and file names only), Import / Export JSON (N11; Export = the figures) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| The parts of a graph | **Node** (a box) · its **ports** (named by the port label: *Canvas*, *Grid* …) · **connect** (the verb; "wire" is a docs word). Search on `/`: placeholder + name **Search nodes**; from a wire: heading *Nodes that connect to ‹Port›*; nothing found: *No node matches “‹query›”* | Decided | Block, Card (docs only — the look), Link, Edge (code), Socket, Pin (= keep a variation) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| The vertical bar on the left of the graph that adds nodes | toolbar `aria-label` **Nodes**; four buttons **Foundation nodes · Content nodes · Rule nodes · Output nodes** (visible headings in the panel: **Foundation · Content · Rules · Output**); panel hint *Drag onto the graph, or click to add*. Docs call it the **node bar** | Decided | Node palette (Palette = colours — never in UI or docs), Library rail (= the Element / Component / Symbol occupant of the same dock), Add node (Rhizome’s old popover) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Node names (one per node type; the card shows the type as overline, the node’s own name as title) | Foundation: **Canvas · Grid · Palette** · Content: **Element · Component · Symbol · Set** · Rules: **Cell rules · Component rule · Arrange · Repeat in grid · Rotate & mirror · Region rule · Composition** · Output: **Figure · Export**. Default names: *Canvas 1*, *Grid 1*, *Palette 1*, *Figure 1*, *Set 1*; a content node is titled by its library entry | Decided | Saved Element / Component / Symbol (content is saved by definition — the panel says so), Class rules, Grid level, Transform, Mirror / Rotate, Generator | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Port labels (Figure graph) | **Canvas · Grid · Palette · Content · Rules · Composition · Figure**; the Export node’s input **Figures**. Accessible name *‹Label› input — connect* / *‹Label› output — connect* (label = name, rule 6). Colour + label + shape, never colour alone (O-34) | Decided | svg / grid / color (code ids), Source, In / Out alone | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| A named area of the graph that holds nodes and moves them together (one per setup; the board layout) | **Section** — default *Section 1*; *Add section* | Decided | Frame (= the Element’s 0–100 drawing area / a Symbol frame), Group, Board, Artboard | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| The Figure node’s variation controls (Vary is part of the Figure node, not a node) | section **Variations**: **Variations** (count) · **Vary by** *Random seed · One change · Several changes* · **Random seed** (the number — in FVS a bare "Seed" is the shape, so this holds whatever N4 decides) · **Keep** (checkboxes: what a change may not touch, named after the node it would change — *Content · Palette · Cell rules · Grid · Rotate & mirror*) · **Layout** *One row · Rows* | Decided | Shuffle (already two meanings, §3; N9 pending), Neighbours, Mutations, Generation, Lock (= Keep), Grid (= the Grid node) as a layout | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Keep one variation through a refresh; replace the others | **Pin** — toggle on the variation, `aria-pressed`, name *Pin variation 3* (does not change with state); **New variations** (`refresh` icon = run again; name *New variations — pinned ones stay*) | Decided | Reroll, Favourite, Star, Save / Save to library (B1 — not in Figure) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| A new Figure node from one variation (same wires, that random seed fixed) | **New Figure from this** (name *New Figure from variation 3*) | Decided | Promote, Fork, Duplicate (= copy the node as it is, ⌘D) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Start a Figure | **New Figure…** (bottom floatbar) → **Built-in Figures** (the 25) · **Step by step** (*Content → Grid → Palette → Variations*) | Decided | Catalog, Gallery (= the Component step’s results), Templates (= page templates), Wizard, New figure (lower case — Figure names the object, rule 3) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Place content in a Figure’s cells by hand and attach rules to parts of it | verb **Compose** (on the variation, or double-click) → a mode of the Figure step, breadcrumb *Graph › Compose ‹Figure name›*, back with **Done** (or Esc); the node that keeps it **Composition**, badge *12 placements · 3 region rules* | Decided | Edit, Paint, Composer, Composite | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Selecting cells in Compose; a rule on the selection | group *Select cells*: **Row · Column · Similar cells · Range**; **Region rule** (also a node); button **Add rule to selection**; kinds *Symbol rule · Component rule · Arrange · Pattern · Colour*; on/off as O-15 (*Switch this rule on / off*) | Decided | Class, Cells by class (code word), Area, Zone, Mask (= a layer role) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| A content input keeps its own inks instead of the Palette’s | **Keep own colours** (checkbox per content input); the Figure’s Palette picker with none connected: **None — content’s own colours** | Decided | Original colours, Ignore palette | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| A saved, ordered list of library entries (FVS), fed to a Figure as many inputs | **Set** (same as Genesis Sets: a plain ordered list); the Set node’s picker *Saved Sets* + **New Set**; wire label *×‹n›* | Decided | Collection (= TuneSutra’s built-in palette collections), Group, Batch, Pool (code) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Graph view and removal | **Fit all** (Shift+1) · **Fit selection** (Shift+2) · **Undo** · **Redo** · **Delete** (unarmed — undoable). Delete refused: notice + the protected node’s panel *A Figure needs a Canvas — connect another one first* / *A Figure needs a Grid — connect another one first*; nothing selected: *Select a node first* | Decided | Zoom to fit, Reset view (Reset = defaults, rule 8), Remove | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| The Export node | card summary *18 files · SVG + plates · 300 DPI*; its one button **Export ‹n› files** (card and panel); done: *‹n› files exported* | Decided | Run, Go, Render (N5) | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Figure graph states and notices | running *Updating…* · upstream failed *Waiting for ‹node name› — fix it first* · entry deleted from the library *‹name› is no longer in the library — drawn from the copy kept in this graph* · empty library *Nothing saved yet — save a Component in the Component step first* (Element / Symbol the same) · no Sets *No Sets yet — New Set makes one* · too heavy (on the card) *Too many shapes: ‹n› (limit ‹m›). Lower Variations or use a smaller Grid.* · lost cell *Cell ‹n› is not in this grid any more — the placement is kept but not drawn.* · connect refused *That connection would make a loop.* / *‹Port› can’t connect to ‹Port›.* · empty graph *This graph is empty. Add a Figure and some saved content, or start from a built-in Figure with New Figure…* · *‹n› nodes selected* · toasts *Graph saved* · *Graph deleted* · *Graph file saved* · *Recipe opened as a graph* | Decided | — | Ledger §2, 2026-10-07 (Figure graph — terms delegated to the content designer, round 2 #13) |
| Every saved FVS Element, Component and Symbol + the Genesis seeds, in one view over the canvas | **Library** — floatbar button name + view title; filter *All · Elements · Components · Symbols · Genesis seeds*; search *Search by name* (name "Search the library") | Decided | Creator library, Saved items, Gallery (= the Component step's grid of results) | Ledger §2, 2026-10-06 (Diego) |
| The floating left rail of saved items in FVS (drag onto Symbol cells) | **Library rail** — toggle + group name; its footer button **Save Symbol** | Decided | Library (bare — the view), Save library | Ledger §2, 2026-10-06 (Diego) |
| Remove a saved item from an FVS library | **Delete** (trash, one click — Diego, Oct 6, 2026) | Decided | Remove (× / `close` = dismiss, rule 8; the quick-save circle's un-save stays `close`, O-17) | Ledger §2, 2026-10-06 |
| A copy of a saved item, kept beside it | **Duplicate** → *‹name› copy*, *‹name› copy 2* | Decided | Clone, Copy of ‹name› | Ledger §2, 2026-10-06 (Diego) |
| Shapes from Genesis shown in another tool (the 13 Base Seeds + the user's own) | **Genesis seeds** (a source name — "Seed" here is the Genesis shape, N4's first meaning) | Decided | Creator library, Genesis forms, Base Seeds (= only the 13 built-ins) | Ledger §2, 2026-10-06 |
| The outline of one cell an FVS Element is drawn for (Square · Circle · Triangle · Hexagon) | **Cell shape** — floatbar group `aria-label` "Cell shape", buttons "Cell shape: Square" … (`aria-pressed`) | Decided | Box, Frame (both already mean the Element's 0–100 drawing area / a Symbol frame) | Ledger §2, 2026-10-06 (delegated) |
| The outline the Component's cells are grouped into (Hexagon · Triangle · Diamond · Square) | **Grid shape** — row label + `.seg-ctrl` group name; an option the cell shape cannot fill reads "‹Option› needs ‹cells› cells" (e.g. "Square needs circle or hexagon cells") | Decided | Outline (an id only: `seg-grid-outline`, `lattice.outline` — kept, rule 11), Silhouette, Arrangement (Arrange = a fill mode), Layout, Form | Ledger §2, 2026-10-06 (delegated) |
| How many cells the Component grid has, counted along each side — every Grid shape, Hexagon included | **Grid size** (1–4); hint "Cells along each side." | Decided | Size (bare — Scale's Small / Medium / Large and export sizes already use it), Rings (id only: `rg-grid-rings`) | Ledger §2, 2026-10-06 (delegated; Diego approved Hexagon on the same meaning) |
| Symbol fit: an Element drawn for a cell shape laid exactly onto a cell of that shape | **Match cell** (floatbar *Match cell · all cells*, Cell properties Fit option) | Decided | Shape (the Element section's name), Snap, Fit to cell (Fit = the select itself) | Ledger §2, 2026-10-06 (delegated) |
| Generated alternatives to pick from (FVS Suggest, the Figure node) | **Variation** — *12 variations*, "Use variation 3: …"; on a Figure node *Variation 3, random seed 4182* | Decided | proposal, option, combination, arrangement (Arrange = a fill mode) | Ledger §2, 2026-10-05 (O-25, delegated) |
| Put content into the empty Symbol grid (FVS) | **Fill the grid** (button); **Fill** = the panel section that says how (Suggest / Arrange / Manual / Rule) | Decided | Generate (a new grid, a Component set — elsewhere), Fill the Symbol | Ledger §2, 2026-10-05 |
| Helper lines on the FVS Symbol sheet — column/row guides + empty-cell outlines, one toggle | **Guides** — toggle *Show guides* (`aria-pressed`, name does not change with state) | Decided | column/row guides, outlines, helper lines, grid (= *Show loaded grid*, the cells' own lines — a different thing) | Ledger §2, 2026-10-05 (delegated) |
| Content scaled to its cell, both axes (FVS Fit) | **Stretch** (*Stretch · all cells*) | Decided | Fill, Fill the cell | Ledger §2, 2026-10-05 (O-26) |
| The FVS / Genesis square primitive (also makes rectangles and pills by its rows) | **Square**; its preset select **Square type** | Decided | Rounded rect, Rectangle, Rect | Ledger §2, 2026-10-05 |
| FVS Element sections | **Shape**, **Look & place** | Decided | Seed, Appearance | Ledger §2, 2026-10-04 |
| FVS shape details | **Rounding**, **Rounding style**, **Dashes / Dash gap**, **Thickness**, **Bands**, **Hole** (Ring: **Opening**) | Decided | Corner radius, Corner rounding, End rounding, Arm width, Arc ratio | Ledger §2, 2026-10-04 |
| Paper (+ texture) | **Paper** = ground colour + its pattern (FVS) | Decided (FVS) | — | Ledger §2, 2026-10-03 |
| Foreground colour | Ink (role names allowed with ≥3 roles) | Pending | Point, Mark, Dots | D2 |
| Ground colour | Paper; Halide's replacement fill = Background fill | Pending | Background, BG, Color | D3 |
| Colour section title | Colour; "Palette" only for a saved set | Pending | Color, Palette, Tone… | D4 |
| Multi-colour mode | Inks | Pending | RMX, Multi | D6 |
| Mode set / assignment | Solid · Adaptive · Inks; Colour by: Tone · Posterize · Random · Tone + random | Pending | Adapt, Single ink, Mapping | D7 |
| File type in Export | Format (and only that) | Pending | — | N1 |
| Canvas size section | Canvas | Pending | Format, Resolution, Scene | N2 |
| Aspect presets | Square 1:1 · Portrait 4:5 · Vertical 9:16 · Landscape 16:9 · Widescreen 3:2 | Pending | Wide 16:9, Landscape 3:2 | N3 |
| Seed | the shape (Organica vocabulary); the number = Random seed | Pending | — | N4 |
| Render | the compute action only | Pending | Refresh; section titles | N5 |
| Scale | export multiplier; Noise scale; TuneSutra Shades | Pending | PNG scale | N6 |
| Reset / Restart / Fit / Clear | see rule 8 | Pending | Reset for zoom or restart | N7 |
| Saved settings | Presets · "Preset name" · Save | Pending | Scene, Look, Name this… | N8 |
| Random | Randomise; Shuffle = reorder only | Pending | Randomize | N9 |
| Loom grid import | Load Loom grid | Pending | 6 other wordings | N10 |
| Source file | Open … (image / SVG / font); Add … for one more item | Pending | Upload, Import | N11 |
| Transparency | Opacity, % 0–100 | Pending | Alpha 0–255 | N12 |
| Colour swap | Swap Ink / Paper; luminance = Invert image | Pending | Swap colors, Invert | N13 |

When Diego answers on the audit page, the DOCUMENT run moves the row to **Decided**, writes
the decision in `docs/DESIGN-DECISIONS.md` §2, and lists the tools whose strings must change.

## 3. Words that mean more than one thing today

Format · Seed · Render · Scale · Reset · Palette · Invert · Shuffle · Duotone · Zoom ·
Style · Resolution · Fill (FVS: put content in the cells — Decided; stretch content to the cell = **Stretch** since O-26, not Fill; Element paint Fill / Stroke — the vector term, a different object, kept) · Variation (FVS Figure's blob seed slider is labelled "Variation" — a number, not a generated alternative; to rename with N4) · Variant (Export *Variants* = size rows; a different word, keep them apart) · Grid (FVS: *Show grid* on the Component and *Show loaded grid* on the Symbol both mean the cells' own lines; helper lines are **Guides**; *Grid shape* / *Grid size* qualify it, never a bare "Shape" or "Size"; a layout of variations is *One row · Rows*, never "Grid") · Frame (Element drawing area / Symbol frame — the Figure graph’s grouping is **Section**, never Frame) · Palette (colours only — the graph’s left bar is **Nodes** / the node bar, never "node palette") · Composition (today’s Figure Advanced form *4 · Composition*, `fg-comp`, goes with the old Figure UI in Phase 3; from then only the Figure graph node) · Rule (FVS *Rule* = a Symbol Fill mode; in the Figure graph a rule is always qualified: *Cell rules*, *Component rule*, *Region rule*, *Symbol rule*) · Set (noun: a saved list — Genesis, FVS Sets; the verb in *Set content for all cells…* stays, never at the start of a node or section name) · Run (not used: the Export node’s button is *Export ‹n› files*) — inventory with tools and lines on `/design-system/_colour-audit.html`
§8. A new control must not add a meaning to any of them.

## 4. How it is checked

- **CONSULT** gives a copy brief: the exact labels, options, placeholder, hint and
  `aria-label` for what is about to be built, from §2.
- **REVIEW** reads every added or changed visible string in the diff against §1–§2.
- **AUDIT** (scope "copy") re-runs the inventory: section titles, labels, buttons, options,
  aria, toasts, per tool.
