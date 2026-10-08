# FVS Figure step — right-panel design audit (components, layout, tokens)

> AUDIT, scope **components · layout · tokens**, Oct 7, 2026, by the design-system agent. Read-only on code.
> Asked by Diego: *"the right column of the FVS Figure step has many things not coherent with what we
> developed for Element, Component and Symbol"*. The **words** are covered by the sibling audit
> [`figure-panel-copy.md`](figure-panel-copy.md) (37 findings); this one cross-references it ("copy #n")
> instead of repeating it.
>
> Measured at `b87930d` (`main`, clean). Code: `fvs/js/17-figure-graph.js` (`renderInspectorBody` 399–571,
> `setEditor` 574–603, `cellRulesEditor` 613–639, `renderComposeInspector` 893–960), `fvs/fvs.css` 453–543,
> `shared/panel.css`, `shared/header.css`, against `fvs/index.html` (Element 358–1103, Symbol 1105–1173 +
> 1432–1674, Component 1176–1350, the shared Palette section 1352–1430) and `fvs/js/00-core.js`,
> `07-library.js`, `08-symbol-grid.js`, `12-shell.js`.
> Browser: headless Chrome 1440 wide (`scripts/lib/chrome-page.mjs` pattern), FVS with a clean profile; one
> built-in Figure opened + one node of every type added from the node bar; each node selected, computed
> styles read, the panel captured in **light and dark**. Instruments: `ds-audit.py --tool fvs` (2 raw values,
> both the known `#3399ff`, none in Figure code), `css-lint.py` (clean).
>
> **Not verified:** Compose with a live selection (synthetic clicks on SVG cells did not select), rule /
> Set chips with content, a Figure with a Set, pins or failing checks — those were read from code, not seen.
> Safari / Firefox not run.

> **Status, Oct 8, 2026** (DOCUMENT run): the *Sev* column now ends with each row’s status — **done** (`2d5009e`, `1706d27`, `cd00d90`, `244fed3`, checked in the code), *open — O-nn* (ledger §1), *queued* (ledger §4). §4 items 1–6 are O-47, O-45, O-48, O-49, O-50, O-51. “Where E/C/S lag”: Symbol Canvas `aria-pressed`, seed fields `.panel-input`, *PNG size* (`fvs/index.html:239`) — done in `cd00d90`; the popover’s single-export *Scale* (`:218`) is unchanged — N6 is still pending outside the Figure; the inline `style=` debt stays with the `hidden` sweep.

## 0. The answer

The Figure panel was built from its own small row helpers (`rangeRow` / `selectRow` / `numberRow`, 17-figure-graph.js:374–386)
rather than from the markup the other three steps use, and three things drifted from that start:

1. **Two shared classes are used wrongly, so every Figure node renders in the wrong type role.**
   `.panel-hint` (25 uses) **does not exist** in any shared sheet — it is a Genesis-local class — so every
   Figure hint is unstyled body text: **11px IBM Plex Mono in `--ink`**, where E/C/S hints (`.org-panel__hint`)
   are **9px in `--mid`**. And every Figure checkbox (13) puts its label as a bare text node, not in the
   `<span>` that `.check-row span` styles — **11px mono `--ink`** against E/C/S's **9px Space Grotesk `--accent`**.
   This is most of what "looks different" at a glance (screenshots: the Figure panel reads one size up and darker).
2. **One section per node, everything in it.** E/C/S split a step into several `.panel-section`s with a
   concept `h3` and a right-hand `.hint` meta ("Canvas · 1080 × 1080 px", "Symbol grid · 36 cells"). The
   Figure panel always renders **one** section whose `h3` is the node's *name* ("Figure 1", "Triangle · built-in")
   and divides the rest with `.sub-label`s — the Figure node packs 4 groups (inputs, Variations, Checks, Cells)
   into one section, and four groups have a label in an empty `.ctrl-row` instead of a sub-label.
3. **Local copies of shared components, and G4 only half kept.** Rule / Set / region-rule lists are a
   local `.fg-chip` (a re-implementation of `.org-layer-card`); the Canvas node drops the Symbol Canvas's
   thumbnail format picker; the Palette node replaces the swatch's own *Pick from a palette* with a separate
   select and drops *Start at*, *Transparent paper* and the Paper *Pattern*; the seed row and the Export
   button use other patterns than the E/C/S seed rows and primary actions.

Tokens are clean: no raw value in Figure code (`ds-audit`), both themes render (dark screenshots checked —
only tokens are used, so the colour roles follow; the two class misuses above are wrong in both themes alike).

## 1. Findings

Severity: **BLOCK** = the pattern every new Figure panel copies is wrong (fix before more nodes are built on
it) · **HIGH** = a shared component skipped or re-implemented, or a decided contract (G4) not met ·
**MED** = same job, different pattern from E/C/S · **LOW** = alignment / polish.
Paths: `17` = `fvs/js/17-figure-graph.js`, `ix` = `fvs/index.html`, `css` = `fvs/fvs.css`.

| # | Sev | State / node | What Figure does | What E/C/S do | Evidence | Fix (reuse) |
|---|---|---|---|---|---|---|
| 1 | **BLOCK** · **done** | All nodes, Graph summary, Compose | Hints are `<p class="panel-hint">` — a class defined **nowhere** in `shared/` or `fvs/fvs.css` (only `genesis/index.html:226`, locally). Measured: 11px IBM Plex Mono, `--ink`, margin 0, so consecutive hints touch (Compose 924–925) | `.org-panel__hint` (panel.css:111 — `--fs-micro` 9px, `--mid`), 110 uses suite-wide, 19 in `ix` | `17`:404, 409, 429, 482, 484, 508, 516, 520, 540, 553, 568, 581, 582, 620, 626, 903, 905, 923, 924, 925 (25 × `panel-hint`); `ix`:1294, 1310, 1552 | Replace every `panel-hint` with `org-panel__hint`. The danger line (`fg-warn`, 923) → `org-panel__hint fg-warn` |
| 2 | **BLOCK** · **done** | Figure, Export, Repeat in grid, Set in Figure | `<label class="check-row"><input …> Label</label>` — the text is a bare node, so `.check-row span` (display face, label size, `--accent`) never applies. Measured: 11px mono `--ink` | `<label class="check-row"><input …><span>Label</span></label>` | `17`:479, 480, 481, 513, 542, 549, 563, 565 (13 checkboxes); `ix`:1221–1223, 1533–1535; panel.css:341 | Wrap every label in `<span>`. One helper `checkRow(label, id, checked)` beside `rangeRow` so it cannot drift again |
| 3 | HIGH · **done** | Every node | One `.panel-section` per node; `h3` = the node's own name; groups divided by `.sub-label` | Several `.panel-section`s per step, `h3` = the concept, right-hand `<span class="hint">` = live meta (`ix`:1107 *1080 × 1080 px*, 1145 *36 cells*, 360 *Layers · 3 · top first*) | `17`:422 (`title`), 568 (`title + rows + '</div>'`), 544, 559, 561 | `h3` = the node **type** + `.hint` = its name and a one-line summary (the card's `canvasSummary` / `gridSummary`, already computed at `17`:530). Rich nodes get sections, not sub-labels: **Figure** → *Inputs* (Canvas · Grid · Palette · Set) / *Variations* (UI-COPY §2 already calls it a "section") / *Cells* / *Checks*; **Export** → *Files* / *Send*; **Set** → *Items* / *Add* / *Saved Sets* |
| 4 | HIGH · **done** (reorder: O-49) | Cell rules, Set, Compose region rules | Ordered lists are a local `.fg-chip` (`css`:470–475: border, `--radius-md`, `--paper` ground) + four `.icon-btn` (eye, ↑, ↓, trash) | The Element **Layers** list: `.org-layer-card.org-layer-card--flush.is-draggable` (`--radius-sm`, `--panel` ground), `.org-btn--sm.org-btn--icon` buttons, reorder by grip drag + ⌥↑/⌥↓, delete revealed on hover / active | `17`:576–579, 615–619, 916–921; `07-library.js`:353–360; panel.css:745–753, 1074–1079; DESIGN-SYSTEM.md:583 | Rung 1: build the three lists on `.org-layer-card--flush` (`__head`, `__title`). Keep the arrow buttons only if the drag reorder is not wanted (Diego item 4); either way drop `.fg-chip` / `.fg-chips` from `fvs.css` |
| 5 | HIGH · **done** | Canvas (G4) | Format = plain `<select class="panel-select fg-grow">` | Symbol Canvas: `Organica.selectPicker` thumbnail (each format drawn at its aspect, Custom dashed) + the select, `aria-label` *Canvas format* | `17`:428 vs `ix`:1108–1110 + `08-symbol-grid.js`:254–260; the Figure **card** already draws `Organica.aspectIcon` (`17`:140) | Mount the same `Organica.selectPicker(select, host, {registry})` — the registry object at `08-symbol-grid.js`:256 can be lifted into a shared function in `engine/08` and used by both, + one entry for *Fit to figure* |
| 6 | HIGH · **done** | Canvas, Grid (G4) | No live meta in the title; no cell count | `h3` hint: Canvas *1080 × 1080 px* / *… mm · 300 dpi* (`08-symbol-grid.js`:161–164), Symbol grid *36 cells* (`11-symbol-ui.js`:144) | `17`:422 | Part of #3: `<span class="hint">` with `canvasSummary(cv)` / the grid's cell count |
| 7 | HIGH · **done** | Palette | Ink library = a separate **"From the library"** select row above the strip; the strip itself is mounted with `library: false`, so its *Pick from a palette* button is gone — but the **Paper** swatch still has its own (measured: `icon-btn pal-btn` "Pick from a palette" on Paper only) | Shared Palette section: one strip with the swatch's own *Pick from a palette* button (`Organica.palette.swatch` default) | `17`:461–462, 466 vs `00-core.js`:73–81; screenshots *symbol-light* vs *fig-2-Palette* | Drop the select row; mount the strip like `00-core.js`:73 (library on) and set `p.source` in its `onChange`. Copy #13 on the word |
| 8 | HIGH · half — *Start at* done; Paper pattern / Transparent paper: O-45 | Palette | No **Start at**, no **Transparent paper** toggle, no Paper **Pattern** (icon on the Paper row → pattern block) | Palette section: *Colour by* + *Start at* (`ix`:1355–1362, `00-core.js`:88–96); Paper row with `btn-paper-clear` (`fvs-transparent`, `ix`:1371) and the swatch's `opts.pattern` (`12-shell.js`:818–823) | `17`:463–469; Palette node params `engine/17-figure-nodes.js`:449 (`colors`, `paper`, `rule` — offset carried but not editable; a built-in's `colorRule.offset` arrives at `:414` and cannot be changed) | *Start at*: add the row (the param exists). Transparent paper + Pattern are capabilities the Palette node does not have → Diego item 2 |
| 9 | MED · open — O-53 | Palette | Default *Colour by* = **By cell order** (`mode: 'index'`) | FVS default since Oct 4 = **Element's own colours** (`DEFAULT_COLOR_RULE`, `engine/00-core.js`:85; ledger §2 2026-10-04) | `engine/17-figure-nodes.js`:449–450 (default + fallback), `17`:469 | Default to `DEFAULT_COLOR_RULE`, or say why the Figure differs (with *Keep own colours* and *None — content's own colours* there are now three ways to say it: copy #14) |
| 10 | MED · **done** (`.fg-keep` → O-50) | Figure, Export, Palette | A label alone in an empty `.ctrl-row` (a 26px row with nothing in it) above a local `.fg-keep` wrap of checkboxes: *Keep*, *Format*, *PNG size*, *Inks* | Symbol *Vary*: `.sub-label` then the check-rows (`ix`:1531–1536); the Palette section has no "Inks" label at all — the strip sits under the `h3` | `17`:463, 479, 480, 549; `css`:499 | `.sub-label` + the check-rows; *Inks* row removed (the h3 says Palette). `.fg-keep` is the 3rd "group of check-rows" (Symbol Vary inline-styled, Export popover `org-popover__row`) → Diego item 5 |
| 11 | MED · **done** | Figure | *Random seed* = a bare number field; a separate full-width **New variations** button (refresh icon + text) increments it | Every seed in E/C/S: number field + an `icon-btn` with `refresh` in the same row (*Random seed*) — Component `ix`:1272–1277, Symbol Rule 1542–1547, Suggest 1564–1569, Arrange 1588–1593 | `17`:547, 552 | One row: `numberRow` + `icon-btn` `refresh`, `aria-label` *New variations — pinned ones stay*; drop the mini-btn |
| 12 | MED · **done** | Export | The node's one action, **Export ‹n› files**, is a secondary `.mini-btn`, beside *Send to Figma* at equal weight | A section's main action is `.panel-btn` (primary, block): *Generate grid in canvas* `ix`:1150, *Save as new component* `ix`:319 | `17`:483 | `Export ‹n› files` → `.panel-btn`; *Send to Figma* stays `.mini-btn` under it |
| 13 | MED · **done** | Grid | `ctrl-label` *Grid* + select, `aria-label` *Grid* | Symbol grid: full-width select, no row label, `aria-label` *Grid generator* (the `h3` names it) | `17`:450 vs `ix`:1146–1147 | Symbol's markup (full-width select) — the h3 from #3 carries the name. Copy #8–#9 on *Rings* vs *Grid size* |
| 14 | MED · queued (ledger §4) | Grid (lattices) | Lattices are options of the generator select (*Triangle / Square / Hexagon lattice*) + *Rows* / *Rings* sliders, ranges 1–8 / 1–12 / 1–6 | Component step: a **Grid shape** `.seg-ctrl` of icon buttons (hexagon / triangle / diamond / square) + **Grid size** (`ix`:1179–1191) | `engine/17-figure-nodes.js`:75–79, `17`:450–457 | When a lattice is chosen, show the Component step's *Grid shape* seg (icons) + *Grid size*, not a select entry. Ranges stay Figure's own (a Figure lattice is bigger than a Component) |
| 15 | MED · **done** | Composition node vs Compose | The same region rules are an `<ol class="fg-rulelist">` on the node and chips in Compose | — | `17`:523 vs 916; `css`:542–543 | One list: the #4 layer cards, read-only on the node (no buttons) |
| 16 | MED · **done** | Compose | Seven quick `.mini-btn`s in a wrapping `.row-btns` (rows of 2-3-2, `flex:1` stretches them unevenly) **and** the same seven actions as the first optgroup of *They get* | Symbol Manual: one control per property (Rotation select, Flip select, Choose… button), `ix`:1598–1670 | `17`:906–913; `css`:529 | Keep one path: the *They get* select + *Add rule to selection* (as Cell rules does, `17`:621–625); quick actions, if kept, as an icon row in the dock (registry icons exist: `refresh`, flips) |
| 17 | MED · open — O-48 | Compose | A **Symbol rule** over a region uses the Symbol step's hidden panel values (`SYMBOL_RULES[x].read()`), not shown or editable in Figure; a **Pattern** gets fixed spacing 8 / weight 2 / angle 45 | Symbol Rule shows each rule's own params (`ix`:1458–1530); Paper / Element pattern show Spacing / Weight / Angle sliders (`ix`:1414–1427) | `17`:933, 935 | Show the rule's params under the chosen rule (reuse the Symbol `rp-*` row specs) and the pattern sliders — or Diego item 3 |
| 18 | MED · open — O-47 | Every node | Node names cannot be changed anywhere (no rename on the card or in the panel), yet Canvas / Grid / Palette are decided as *named and shared* and **Save Set** saves under the node's name (*Set 1*) | Sections rename in place (F2, `shared/node-canvas.js`:462–473); FVS library: *Rename* via `Organica.prompt` (`15-export-library-view.js`:451) | `17`:595–599 (Save Set uses `nodeLabel(node)`), ledger §2 *Figure graph — scope* | Make the `h3` name (#3) renameable like a Section label (F2 / double-click), or a *Name* field (`panel-input--full`) at the top of each node. Behaviour → Diego item 1 |
| 19 | LOW · **done** | Rule chips, Compose | `Organica.icons.get(…, { size: 'xs' })` inside `.icon-btn` — the size class is overridden by `.icon-btn svg { width: var(--space-5) }` (header.css:502) | E/C/S `icon-btn` children are `ico--sm` (`ix`:1274) | `17`:577–579, 616–619, 917–921 | Drop `size: 'xs'` (dead) |
| 20 | LOW · **done** | Palette | *From the library* label is 69px, the only label wider than the 62px label column, so its select starts 7px right of every other | All E/C/S labels fit 62px | measured (`fig-2-Palette`) | Goes with #7 |
| 21 | LOW · **done** | Figure | *Compose* is a lone full-width button between *Variations* and *Cells* | — | `17`:560 | Under the Variations section or as the first row of the node (it is the node's main verb — `.panel-btn`) |
| 22 | LOW · **done** | Graph summary | Counts (*2 Figures · 10 nodes*) are a hint paragraph; the Figures / Sections lists are a local `.fg-figlist__item` (`--radius-sm`, `--t-control-size`) | Counts live in the `h3 .hint` | `17`:404–407; `css`:500–504 | Counts → `h3 .hint`. `.fg-figlist` is a local list component (rung 3, fine) — becomes the read-only `.org-layer-card` of #4/#15 if that lands |
| 23 | LOW · **done** | Multi-select | `Add section` carries `aria-keyshortcuts`; the same button in the Graph summary does not | — | `17`:416 vs 408 | Add it at 408 |
| 24 | LOW · **done** | Canvas (protected) | The protect reason (*A Figure needs a Canvas — connect another one first.*) is the panel's last paragraph | Refused actions explain themselves at the control (`aria-describedby`, ledger §2 Delete) | `17`:568 | Keep, as `org-panel__hint` (#1), directly under the h3 so it is read first |

### Where Figure is right and E/C/S lag (not Figure findings — maintenance)

- Figure's `.seg-ctrl` buttons carry `aria-pressed` (`17`:430, 551); Symbol's Canvas mode does not (`ix`:1113–1114).
- Figure's seed is a `.panel-input` (`17`:383); E/C/S seed fields are `.panel-select` with an inline `width:70%` (`ix`:1274, 1544, 1566, 1590).
- Export node says **PNG size** (N6, decided); the FVS Export popover still says *PNG sizes* (`ix`:239) and *Scale* (`ix`:218).
- E/C/S inline `style=` for spacing / display (`ix`:1531, 1533–1535, 1550–1551, 1669) — the debt the `hidden` sweep (CLAUDE.md backlog) covers.

## 2. Canvas and Grid against the Symbol step (G4), control by control

| Control | Symbol (`ix`) | Figure (`17`) | Match |
|---|---|---|---|
| Section title | *Canvas* + hint *1080 × 1080 px* (1107) | node name, no hint (422) | no — #3, #6 |
| Format | selectPicker thumbnail + select (1108–1110) | select only (428) + *Fit to figure* entry | no — #5 |
| Mode | seg *Screen · Print* (1113–1114) | same, with `aria-pressed` (430) | yes |
| Size | 2 × `panel-input` + × + unit, inline `width:30%` (1117–1122) | same, `.fg-size` (431) | yes (Figure tidier) |
| Unit / DPI / Bleed (Print) | mm·in / 72–2400 / 0–20 step 0.5 (1124–1136) | identical ranges and labels (432–434) | yes |
| Margin | range 0–25 + value (1138–1141) | same (448) | yes |
| Grid title | *Symbol grid* + *36 cells* (1145) | node name, no count (450) | no — #3, #6 |
| Generator | full-width select, *Grid generator* (1146–1147) | label *Grid* + select (450), + lattices optgroup | no — #13, #14 |
| Generator params | `SYMGRID_GENS` ranges (5–8 …) (`08-symbol-grid.js`:165–169) | same spec, same ranges (`17`:454–457) | yes |
| Generate / Load JSON grid | buttons (1150, 1152) | live, no button; no JSON grid | by design (live); JSON grid → Diego item 6 |

## 3. Palette node against the Palette section

| Control | Palette section (`ix` 1352–1430) | Palette node (`17` 459–469) |
|---|---|---|
| Inks | RMX strip, *Pick from a palette* on it | label *Inks* + strip with `library:false` + a *From the library* select above (#7, #10) |
| Colour by | select, default *Element's own colours* | select, default *By cell order* (#9) |
| Start at | select *Colour n* | missing (#8) |
| Paper | colour row + *Transparent paper* toggle + *Pattern* icon → pattern block | colour row only (+ the swatch's own palette pick) (#8) |

## 4. Needs Diego

1. **Rename nodes?** Canvas / Grid / Palette are "named and shared", Save Set saves under the node name, and nothing lets you change a name. Recommend: the panel title renames in place (F2 / double-click, as Section labels do). *yes / no*
2. **Palette node = the Palette section?** Add *Transparent paper* and the Paper *Pattern* to the Palette node (engine + panel work), or keep the Figure Palette colour-only and say so in the panel. Recommend: add them — "Paper = colour + texture" is decided for FVS. *add / colour only*
3. **Compose's Symbol rule and Pattern settings** — show and edit them in the Compose panel (recommended), or keep "the Symbol step's settings" as today. *show / keep*
4. **Ordered lists reorder by drag** (as Element Layers, ⌥↑/⌥↓) instead of ↑/↓ buttons, once they are `.org-layer-card`s. Recommend: drag + keyboard, as Layers — one reorder gesture in FVS. *drag / buttons*
5. **A shared "group of checkboxes"** (`.check-group`: check-rows that wrap, one gap) — third instance now (Figure *Keep* / *Format* / *PNG size*, Symbol *Vary*, the Export popover's *PNG sizes*). Promote to `shared/panel.css`? Recommend yes, as its own commit. *yes / no*
6. **Load JSON grid in the Grid node** (Symbol has it, the Figure Grid does not). *add / not now*

No new token is needed for any finding.

## 5. For the ledger

- §4 maintenance queue: findings 1–2 (BLOCK, one commit: class + span + a `checkRow` helper), then 3/6 (sections and title hints), 4/15 (layer cards), 5 (format picker), 7–12.
- §4: the E/C/S lag items above (Symbol seg `aria-pressed`, seed fields `.panel-select` → `.panel-input`, *PNG sizes* → *PNG size*).
- §1 open: items 1–6 above.
- §5 audit log: "AUDIT, FVS Figure panel — design (components, layout, tokens): 24 findings (2 BLOCK, 6 HIGH, 9 MED, 7 LOW), 6 owner questions; tokens clean; light + dark measured headless; copy in `figure-panel-copy.md`."
