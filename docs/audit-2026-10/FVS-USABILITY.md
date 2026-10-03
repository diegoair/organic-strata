# FVS usability + coherence audit — Element → Component → Symbol (library rail, drag and drop)

Date: 2026-10-03. Method: a new headless runner, `scripts/test-fvs-ui.sh` (`scripts/test-fvs-ui.mjs`), drives `/fvs/` in Chrome over CDP with a clean profile and **real mouse input** (`Input.dispatchMouseEvent`), collects console errors, and checks coherence invariants after every step. The design-system agent was consulted before building it (assertion list), reviewed the findings, and its checks are cases `D.*`. The runner writes nothing to the repo (artefacts go to `--out`); the regression baseline is untouched.

Run it: `scripts/test-fvs-ui.sh [--only J1,J2,J3,J4,D,V] [--variants N] [--seed S] [--theme light|dark] [--out DIR]`. A full variants run is slow (~40 variants ≈ 8 min): run several `--only V --seed N` in parallel.

## 0. Headline
- **160 different Symbols** (4 seeded batches, seeds 11–14; Element seed × style, Component grid × rule, 12 Symbol grid generators × 7 canvas presets × 4 fill modes × 9 Arrange rules × fit × screen/print) — **all 160 render, parse as SVG, have a viewBox, match the grid's cell count, survive Save → Load with an identical SVG, and raise no console error.** 160 distinct outputs. The Symbol *output* is solid.
- **Drag and drop with a real mouse works**: one unselected cell changes only that cell; a drop inside a multi-selection changes all selected cells; a drop outside the grid or on the header changes nothing; Esc mid-drag cancels cleanly; a Symbol tile never starts a drag; no ghost / `.is-drop` / body class is left behind.
- **The problems are in what happens to things that are already used**: removing, renaming and locking. Five confirmed functional/data bugs and one DS blocker (invisible drop target on a dark Symbol paper).
- DS checks passing: aria/roles/names, no `title` on floatbar buttons, effective hit sizes (13px chip + `::before` ≥ 24px), 2×48px grid with no horizontal scroll at 1440 and 769, no overlap with `#panel`/floatbar/header, motion tokens only and reduced-motion collapse, z-order and click-through gap, tab order + Esc, a keyboard path to place a tile, light/dark glass.

Severity key: **H** functional or data-loss · **M** inconsistency · **L** polish · **BLOCK** DS rule violated (accessibility).

## 1. Prioritised findings
| # | Sev | Step | Finding | Repro (runner case) | Evidence | Fix example |
|---|---|---|---|---|---|---|
| F1 | H | Component → Symbol | **Removing a Component that is in use leaves dangling references and says nothing.** 8 live cells keep `componentName` of the removed Component (render as `⚠ name (missing)`); a saved Symbol still names it; the pool UI still lists it. | `J4.1`, `J4.2` | `removeLibraryEntry` only deletes + re-renders (fvs/index.html ~6023) | See F1 fix below |
| F2 | H | Symbol | **A rail drop overwrites a LOCKED cell.** The per-cell lock is ignored by `railApply`. | `J3.6` | `railApply` → `patchCell` has no lock check | `railApply`: skip cells with `cell.locked` (see below) |
| F3 | H | Component → Symbol | **Renaming a Component drops it from the Symbol pool.** `renameLibraryEntry` repoints cells, saved Symbols, underlying refs, but not `state.symbolPool`; `poolEntries()` then filters the old name out. | `J2.3` | pool entry "…" not in library after rename | one line in `renameLibraryEntry` |
| F4 | M | Component | **The gallery keeps the ✓ / "Saved to library as X" after the entry is removed from the rail.** `comp.savedName` is not cleared; `renderGallery` reads it without checking the library. | `J2.2` | invariant "gallery savedName not in library" | clear `savedName` in `removeLibraryEntry` |
| F5 | BLOCK | Symbol | **The drop target is invisible on a dark Symbol paper.** `.is-drop` strokes with the chrome token `--ink` (≈ #0a0a0a): 1.14:1 on `#1a1a1a`, 1.96:1 on `#264653` (19.8:1 only on white). The Symbol paper is content, so a chrome token can never be guaranteed. | `D.5` | measured ratios in `results.json` | two-tone ring (below) |
| F6 | M | Stage | **The open rail covers the Component gallery's quick-save circles** (and the left edge of the Symbol stage). The panel is an overlay; while it is open those controls are unreachable. | `J2.1` (note) | overlap measured via `elementFromPoint` | owner decision O-4 |
| F7 | L | Rail | Silent clicks: a tile click with no valid target (Symbol tab, no cells selected; an entry deleted mid-click) does nothing and says nothing. | `D.8` passes only with a selection | `railApply` returns silently | inline notice |
| F8 | L | Rail | The thumbnail tile border in dark may be < 3:1 on the glass panel (DS NOTE — not measured yet). | add case (see §4) | D.9-dark.png | `--border-strong` on `.fvs-rail__grid .fvs-library-item` |

Test-only: `D.1` first failed on the runner itself (tile SVGs are content, not chrome icons); fixed in the runner, not a finding.

## 2. Fix examples (apply after the owner's go; each as a small commit, failing case first)

**F1 — a used Component.** In `removeLibraryEntry(name)` count the references first and ask once (owner decision O-1: warn, recommended):
```js
function componentUsage(name) {
  const cells = (state.symbolCells || []).filter(c => c && c.source === 'component' && c.componentName === name).length;
  const syms = Object.values(SYMBOL_LIBRARY.read()).filter(e => (e.cells || []).some(c => c.componentName === name)).length;
  const under = Object.values(LIBRARY.read()).filter(e => e.underlyingComponentName === name).length
    + (state.underlyingComponentName === name ? 1 : 0);
  return { cells, syms, under, total: cells + syms + under };
}
async function railRemoveComponent(name) {
  const u = componentUsage(name);
  if (u.total && !(await Organica.confirm({ title: 'Remove this Component?', message: `Used in ${u.cells} cell(s), ${u.syms} saved Symbol(s), ${u.under} Container/Mask.`, ok: 'Remove', danger: true }))) return;
  removeLibraryEntry(name);
  (state.symbolCells || []).forEach(c => { if (c && c.source === 'component' && c.componentName === name) Object.assign(c, { source: 'empty', componentName: null }); });
  state.symbolPool = state.symbolPool.filter(p => p.name !== name);
  if (state.underlyingComponentName === name) state.underlyingComponentName = null;
  state.components.forEach(c => { if (c.savedName === name) delete c.savedName; });   // F4
  renderSymbolPool(); renderSymbolCanvasOnly(); renderGallery();
}
```
Expected invariant (already asserted): no cell, pool entry, `savedName` or underlying ref names a Component that is not in `LIBRARY`. Saved Symbols are archived data: the confirm tells the user; they keep working through the existing "missing" marker.

**F2 — lock.** In `railApply`, skip locked cells for both paths:
```js
const patchable = c => c && !c.locked;
// single cell: if (!patchable(cell)) return notify('That cell is locked');
// selection:   applyToSelection(cell => cell.locked ? {} : patch)
```
Show a not-allowed state while dragging over a locked cell: add `is-drop-locked` (cursor `not-allowed`, no outline). Invariant: a locked cell's content is unchanged by any rail gesture (`J3.6` must pass).

**F3 — pool on rename.** In `renameLibraryEntry`, next to the other repoints:
```js
state.symbolPool.forEach(p => { if (p.name === oldName) p.name = newName; });
renderSymbolPool();
```

**F4** is inside the F1 snippet (`savedName`). If F1's confirm is rejected nothing changes.

**F5 — drop ring (token-only, works on any ground).** Draw the cell outline twice (a paper halo under an ink line), as a local rule under `#symbol-frame`:
```css
#symbol-frame .fvs-drop-ring { fill: none; vector-effect: non-scaling-stroke; pointer-events: none;
  stroke: var(--paper); stroke-width: calc(var(--space-1) * 2); }
#symbol-frame g[data-cell-index].is-drop > :first-child { stroke: var(--ink); stroke-width: var(--space-1);
  vector-effect: non-scaling-stroke; fill: color-mix(in srgb, var(--ink) 8%, transparent); }
```
JS: when `.is-drop` is set, insert a sibling `<rect class="fvs-drop-ring">` of the same size before the cell's first child; remove it with the class (the frame re-renders `innerHTML` often, so hold the index, not the node). Verify which theme the stage resolves to: if it is forced light, `--paper` is always white, so the halo alone carries the contrast (white on `#1a1a1a` ≈ 17:1) — measure both. Alternative C (compute the ink from the paper with `Organica.contentColor()`) is more exact but adds code; B (reuse the magenta selection ring + white halo) needs a contrast measurement.

**F6 — rail vs stage** (owner decision O-4): (a) dock — the stage shifts right while the rail is open (no overlap, resizes the stage); (b) auto-close the panel on any stage action (drag end, quick-save); (c) leave as is and move the gallery's quick-save circles. Recommended: (b).

**F7** — one `railNotice(text)` that writes to a `role="status"` line in the panel foot ("Select a cell first", "Component no longer exists").

## 3. Owner decisions
| # | Question | Recommendation |
|---|---|---|
| O-1 | Removing a used Component: warn (confirm with counts) or refuse? | warn |
| O-2 | A locked cell refuses a rail drop? | yes |
| O-3 | Drop ring: A two-tone (local rule), B reuse selection ring, C computed ink? | A |
| O-4 | Open rail over the stage: dock, push the stage, or auto-close? | auto-close |
| O-5 | Symbol undo (⌘Z is Component-only today): extend the existing undo stack (cap 20) to Symbol cell edits? | yes, separate task |
| O-6 | Loading a saved Symbol overwrites the shared palette/colour rule/paper of Element and Component (`applySymbolLibraryEntryToUI`). Keep or isolate per tier? | decide; documented only |

## 4. Not asserted yet — add to the runner (from the DS review)
1. `.is-drop` and the selection ring against every built-in and saved palette ground (not only two).
2. Contrast in the open panel, both themes: tile border vs panel ≥ 3:1, `.rmx-x` vs tile, empty-state text ≥ 4.5:1, the disabled "Save library" label.
3. Focus-ring contrast on tiles, chips and the toggle (D.7 covers order and presence only).
4. `data-armed` absent on removes by decision (O-14); `aria-label` on both chips.
5. `@media (hover: none)`: chips visible persistently; D.2 hit sizes again.
6. A locked-cell drop must refuse (F2); drop state clears after `pointercancel`, Esc, leaving the frame.
7. Dark theme: Symbol stage, thumbnails and ghost stay light (content ground never flips).
8. Viewport height ≤ 600: the dock (`top: 50%`) and `max-height: 60vh` must not clip the foot.
9. One dropdown at a time (`organica:dropdown-open`): opening the rail should close an open popover.
10. `organica.fvs.rail` registered in `docs/SHARED-LIBRARY.md` §4.

## 5. Coverage and limits
- Run: light theme; 16 journey cases (J1–J4), 9 DS cases (D.1–D.9), 160 variants. Dark theme was exercised only by `D.9` (screenshots + computed styles); re-run journeys with `--theme dark`.
- Not covered: Safari/Firefox, touch devices, phone widths, the Figure tier, cloud sync across devices, a real screen reader.
- Hash comparisons are Chrome's SVG serialisation.
- Drag was driven with real mouse events; a pointer-only gesture has a keyboard alternative (click/Enter on a tile with cells selected — `D.8`).
