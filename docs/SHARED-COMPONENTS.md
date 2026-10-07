# Organica — Shared Components & the centralization pattern

> Organica
> The contract + playbook for the `Organica.*` JS/CSS component system.
> (Sibling doc: `SHARED-LIBRARY.md`, which covers only the Genesis `organic-*` forms.)

---

## 1. The centralization pattern (reusable — apply it to any scattered concern)

When the same behaviour has been hand-rolled in N tools and started to drift, fold it
into one shared module. The Palette component (§2) is the worked example; the same
eight steps apply to every entry in the backlog (§3).

1. **Inventory** — Explore agents, not guesswork. Find every copy, the divergence
   (params, side effects, CSS sizes), the consumers, and where the CSS lives.
2. **Canonical home** — reuse an existing `shared/<name>.js` if the concern fits its
   identity; otherwise a new `shared/<name>.js`. If the concern ships UI, pair a
   `shared/<name>.css` — **unless** the CSS is already universal in
   `panel.css` (like `.color-*`), which stays there.
3. **One entry point** — if the concern has two shapes of the same idea (single vs list;
   attach-to-existing-markup vs generate-markup), write **one polymorphic function** that
   branches on argument type and returns **one unified object shape**. Do not ship two
   functions.
4. **Back-compat aliases** — keep the old names as thin delegates so the consolidation
   commit changes zero call sites. (Removal is a later pass — step 8.)
5. **Repoint + delete** — change the `<script>`/`<link>` includes, delete the local
   copies, express per-tool variance with **CSS custom props** (`--rmx-cell-w` etc.),
   never a fork.
6. **Docs** — `UI-SHELL.md` §2 (load order) + §7 (what still drifts), `design-system/`
   (a live demo section + TOC entry), `CLAUDE.md` (Repo Structure line + dated session
   note), and this file's adoption table.
7. **Verify zero observable diff** — open every consumer on the no-store dev server,
   exercise the one risky action, console clean, computed styles match a `git stash`
   baseline. No automated tests exist; this pass is the test.
8. **Phase 2** (separate session) — migrate every call site off the aliases to the new
   namespace, then **delete the aliases**; migrate any hold-outs that need a
   behaviour/visual sign-off.

### Rules that fell out of doing it

- Aliases are temporary scaffolding — track their removal, don't let them ossify.
- A module that ships CSS is a **pair** (`.js` + `.css`), loaded together.
- `attach mode` wires pre-existing markup by id convention; `generate mode` builds DOM
  into a container. One function can do both — branch on `typeof target`.
- Preserve legacy callback signatures in the alias layer (e.g. `onChange(hex, rgb255)`),
  not in the new core.
- TDZ bites: a component whose `onChange` calls a tool fn (`scheduleRender`) that reads a
  module-scope `let` must be **constructed in the tool's INIT block**, after those `let`s
  initialize — not inline where the old hand-rolled function used to sit.

---

## 2. Palette component — `shared/palette.js` (+ `palette.css`)

One polymorphic entry point for every colour control:

```js
// ATTACH — target is a string prefix. Wires #cp-/#hex-/#sw-/#btn-random-<prefix>
//   inside a labelled .color-row (CSS in panel.css — universally linked).
const ink = Organica.palette.swatch('ink', { initial: '#1c1c1c', onChange: repaint });
//   onChange(hex, rgb255) — the legacy 2-arg signature.

// GENERATE — target is an HTMLElement. Builds .rmx-color chips into it.
//   Needs palette.css + icons.js (loaded before palette.js). opts.max > 1 ⇒ RMX strip
//   with plus / close icons from the registry (no typed glyphs since Oct 3, 2026).
const rmx = Organica.palette.swatch(wrapEl, {
  colors: state.colors, min: 2, max: 8,
  onChange: (colors, index, action) => { state.colors = colors; },   // action: edit|add|remove|set
});

Organica.palette.colorAt(score, { mode, submode, ink, paper, colors, rnd });  // score → colour
Organica.palette.mix(hexA, hexB, t);
```

Both shapes return the **same** object: `{ get, set, getColors, setColors(arr, {notify}),
setActive(i), rebuild }`. Attach mode's chip-only methods are no-ops. Serialization stays
the tool's job (`getColors()[0]` for `ink`/`paper`, `getColors()` for `colors[]`).

**Load:** after `core.js`. Link `palette.css` only in generate-mode
tools. **CSS custom props:** `--rmx-cell-w/h`, `--rmx-cell-radius`, `--rmx-cell-border`,
`--rmx-palette-mb`, `--icon-btn-w/h`. Set the `--rmx-cell-*` props **on the strip** (its id or
`.rmx-palette`): the chips and the add / library buttons (`.rmx-add`) all read them — TuneSutra
sets the first four on `#rmx-palette, #grad-stops` for its 30×26 rounded cell and has no local
`.rmx-*` rule since Oct 4, 2026; Spore/Pollen set `--rmx-palette-mb: 0`.

**Accessibility (Oct 4, 2026):** in attach mode the swatch button is the keyboard control — the
native input gets `tabindex=-1` + `aria-hidden` when a swatch exists (one tab stop per colour), and
the swatch / hex are named "‹Label› colour" / "‹Label› hex" from the row's `.color-name` unless
the tool named them. Call `palette.swatch` **before** `Organica.autoLabelPanel` (true in every tool
today): the other way round, autoLabel gives both the bare row label first. The library menu takes
part in "one dropdown open at a time" (`organica:dropdown-open`) and has arrow / Home / End keys.
A colour row inside an `Organica.popover` would close that popover when the library menu opens (the
menu lives in `<body>`) — teach the popover about child menus the first time that is needed.

### A texture on a colour — `opts.pattern` (Oct 3, 2026)

Attach mode only, opt-in: `Organica.palette.swatch('paper', { …, pattern: { panel,
on, onToggle(on), label, title } })` appends a **Pattern** icon button at the end of
the colour row (`org-btn org-btn--sm org-btn--icon pal-pattern-btn`, icon `pattern`,
`aria-pressed`, `aria-label` = `label` || "Pattern"), moves `panel` (the tool's own
controls, a block carrying the `hidden` attribute) right under the row and shows /
hides it; the returned object gains `setPattern(on)` (for loading a saved state —
it does not call `onToggle`). The component owns the toggle and the placement only;
the tool owns the pattern's controls and draws it. One consumer: FVS's Paper.

### The palette library (Oct 1, 2026)

Every swatch — attach or generate — gets a small **Pick from a palette** button
(`opts.library: false` leaves it out). It opens one shared menu,
`Organica.palette.pick(trigger, { onPick(hex), onPickAll(hexes)?, max?, extra? })`,
listing `Organica.palette.library()`:

- the palettes saved in **TuneSutra** — read from `Organica.store('tunesutra')`,
  the way FVS and Trellis read Loom's store (no second copy to keep in sync);
- the built-in sets: three three-colour combinations Diego chose from TuneSutra's
  violet collection (*Violet 06*, *Stimulating*, *Violet 07* — mirrored from
  `tunesutra/collections.js`, change both together), then Riso's 21 standard
  inks (screen approximations).

A single row takes one colour. A chip strip adds the clicked colour (or replaces
the last chip when full), and loads a whole palette when its name is clicked
(offered only when the palette fits `max`). `opts.palettes: () => [...]` on a
strip lists a tool's own unsaved palettes first. The menu CSS (`.pal-chips`,
`.pal-link`) is in `panel.css`, because single-swatch tools do not link
`palette.css`. Generate-mode `onChange` now passes a 4th argument on `'remove'`:
the index that was removed.

Not yet on the component: FVS's variant rows / cell colour, Colornet's channel
cards, Camo Turing's layer cards — bare `<input type=color>` inside dynamic
cards.

### Colour maths — `shared/color.js` (`Organica.color`)

Load after `core.js`, before `palette.js`. Pure functions, no CSS:
OKLab / OKLCH ↔ hex with chroma-reduction gamut mapping, `mix` (perceptual),
`contrast` / `luminance` (WCAG), `deltaE`, `scale(hex)` (10 steps at fixed
perceived lightness), and HSB / HSL (moved from TuneSutra; Membrane delegates
too). `palette.mix(a, b, t, 'oklab')` and `palette.colorAt(…, { space: 'oklab' })`
opt in to the perceptual blend; the default stays gamma-sRGB so existing exports
do not change. Tests: `node scripts/test-color.mjs`. Consumers today: TuneSutra,
Membrane.

### Adoption table

| Tool | `palette.js` | `palette.css` | swatch attach (single) | swatch generate (RMX) | `colorAt` |
|---|:--:|:--:|:--:|:--:|:--:|
| komorebi | ✅ | — | ✅ `sun/sky/ground/shadow` | — | — |
| warping | ✅ | — | ✅ `ink/paper` | — | — |
| radial | ✅ | — | ✅ `ink/paper` | — | — |
| camo-turing | ✅ | ✅ | ✅ `ink/paper` (+ THREE.Color uniform in onChange) | ✅ | — (GLSL + JS export copy — Phase 3) |
| blob-boundary | ✅ | — | ✅ `bg/mask/dot` | — | — |
| halide | ✅ | — | ✅ `ink/paper/bgfill` | — | — |
| spore | ✅ | ✅ | ✅ `mark/bg` | ✅ | ✅ |
| pollen | ✅ | ✅ | ✅ `ink/bg` | ✅ | ✅ |
| membrane | ✅ | ✅ | ✅ `ink/bg` | ✅ | — (`js/color.js rmxColorAt` — Phase 3) |
| vortex | ✅ | ✅ | ✅ `bg` (shared `.color-*`, no local overrides) | ✅ | n/a (index cycle) |
| livingpath | ✅ | — | ✅ `ink`,`bg` | — | — |
| fvs | ✅ | ✅ | ✅ `paper` | ✅ (min 1) | n/a (index cycle) |
| tunesutra | ✅ | ✅ | — (bespoke RGB/HSB role editor) | ✅ (min 3 / max 7, `(colors,index,kind)` onChange, `setActive` for the active chip) | n/a |
| colornet | ✅ | — | ✅ `bg` | — (channel list is `.org-layer-card` + its own inner controls) | ✅ |
| pulsar | ✅ | — | ✅ `ink/paper` | — | — |
| design-system | — | ✅ (demo) | — | — | — |
| genesis, loom, mycel, rhizome, hub | — | — | no colour UI | — | — |

The back-compat aliases (`Organica.createColorSwatch` / `createPaletteChips` /
`Organica.Palette.colorAt`) were **removed 2026-08-30** once every call site migrated.

---

## 2b. FVS field — `shared/fvs-field.js` (+ `fvs-field.css`)

A decorative full-screen field made with the Flexible Visual System, under a
page. A shared component by the owner's decision (Oct 2, 2026). Two consumers:
`/404.html` (the numerals "404") and `/sign-in/` (circles spelling WELCOME TO
ORGANICA among triangles). Decisions: `docs/DESIGN-DECISIONS.md` §2.

```js
var field = Organica.fvsField.mount(host, {
  motion: 'arrival' | 'rules',   // Organica.fvsField.MOTIONS
  numerals: true,                // the "404" mask (16 × 8 cells)
  text: 'WELCOME TO\nORGANICA',  // or: words, 3 × 5 cell alphabet A–Z 0–9 (fvsField.textMask)
  elements: { cell: 'triangle', mark: 'circle' },   // truchet | arc | triangle | circle; default = the motion's own
  hold: false,                   // default true (404): the words' cells never arrive / obey
  band: el,                      // with numerals / text: the box the mask fills (.org-fvs-field__band)
  centre: el,                    // with neither: the element the grid centres on
  above: headerEl, below: footerEl,   // no cell above / below these
  palette: Organica.fvsField.palettes()[i],   // { name, paper, inks[], mark, dark }; omit → currentColor
});
field.stop();                    // stops timers + observer, empties the host
var n = Organica.fvsField.visit('organica.<page>.visit');   // per-browser visit count → alternate motion / palette
```

- **Standalone** (Oct 2, 2026, "dobbiamo renderla più leggera"): no other
  script is needed — the 404 loads this file alone (38 KB of script on the
  page, the module 21 KB, instead of ~250 KB). What it would take from the rest
  of the system is baked in and public: `Organica.fvsField.ELEMENTS` (four
  paths: truchet = `Organica.shapes.arcTruchetGeometry(3, 0.5).d`, arc =
  `arcGeometry(42).d`, triangle = `triangleGeometry(100,100,0)`, circle =
  `circleGeometry(90)`), `.BUILTIN` (the library's three built-in combinations,
  already through `.resolve()`), and a local copy of core's `mulberry32`.
- **Kept honest by a test**: `node scripts/test-fvs-field.mjs` (run by
  `scripts/check.py`, "fvs-field baked data") fails when `ELEMENTS` / `BUILTIN`
  drift from what `shapes.js` / `palette.js` / `color.js` produce; `--print`
  prints the `BUILTIN` literal to paste. The built-in combinations now live in
  three places — `tunesutra/collections.js` ↔ `palette.js` `COMBINATIONS`
  (by hand) ↔ `fvs-field.js` `BUILTIN` (test-enforced).
- **Load order trap**: standalone, but on a page that also loads `core.js`
  (the sign-in, the design system) it must come **after** core — core's last
  line reassigns the `Organica` namespace and would drop `fvsField`.
- **Big grids**: past 800 cells only a share (800/n) forms through the filter
  in Arrival, the rest fade in (`.org-fvs-field__own`); blur / ripple scale
  down under 47px cells. Sign-in: 1,683 cells, ~4 s, ~41 fps avg (Chromium,
  1440×900).
- **Optional**: with `color.js` + `palette.js` loaded (after `core.js`),
  `palettes()` reads the live library — saved TuneSutra palettes too — and
  `.resolve(entry)` works on any library entry. Without them `palettes()`
  returns `BUILTIN`.
- **On a page without `core.js`** the mega menu is `header.js`'s no-core
  fallback (no Escape to close) — as on privacy and terms.
- **Paired CSS** `fvs-field.css`: `.org-fvs-field`, `__band` (component-local
  `--fvs-field-band-h`), `__svg`, `__cell`, and the Page variant
  `.org-page--field` (footer as a bar outside the column; no pattern switcher or
  theme button in the header). Sheet order: after `auth-card`, before `panel`.
- **Behaviour**: inline SVG, own timers only, pauses while the tab is hidden,
  rebuilds on host resize, `prefers-reduced-motion` = the settled picture.
- **Colour rule, motions, markup**: `/design-system/#fvs-field` (live demo).
- **Known duplication**: the arrival lives twice — `fvs/js/08-symbol-grid.js`
  `runSymbolArrival` and this module (queued in the ledger §4).

---

## 2c. Shapes — `shared/shapes.js` (`Organica.shapes`): cell shapes (Oct 6, 2026)

Pure geometry, no DOM, every path in the Element's 0–100 box. Consumers: FVS
(first), Trellis, `fvs-field.js` (baked). Added for FVS **Cell shape**
(`docs/FVS.md` §3a):

```js
Organica.shapes.CELL_SHAPES = {
  square:   { step: 90,  flips: ['h','v'], R: 50·√2,  poly: [[0,0],[100,0],[100,100],[0,100]] },   // today's box
  circle:   { step: 90,  flips: ['h','v'], R: 50,     poly: /* 64-gon */ },
  triangle: { step: 120, flips: ['h'],     R: 100/√3, poly: /* equilateral, side 100, apex up */ },
  hexagon:  { step: 60,  flips: ['h','v'], R: 50,     poly: /* flat-top, circumradius 50 */ },
};
Organica.shapes.triangleArcGeometry(thicknessPct)   // → {d, normTx:0, normTy:0, normScale:1}
Organica.shapes.hexTruchetGeometry(count, ratio)    // → same shape of result
```

- **Every outline is centred on (50,50)** so a turn about the box centre maps
  it onto itself — the triangle by its *centroid*, so it pokes above y 0.
  `step` = the turn that maps it onto itself; `flips` = the mirrors that do;
  `R` = circumradius, what a matching cell is scaled by (Symbol *Match cell*).
- **`triangleArcGeometry`** — the Arc on a triangle cell: a 60° annular slice
  pivoted on the bottom-left corner, radius half a side, ending on two edge
  midpoints, so six cells turned onto one corner close a circle. 100 = solid.
- **`hexTruchetGeometry`** — the Arc truchet on a hexagon cell: `count`
  concentric bands around three alternate corners, centred on the edge
  midpoints (radius 25), spread over `ratio` of the room; they cross every
  edge symmetrically, so they run on into any neighbour.
- Square output is byte-identical to before (FVS regression 396/396). Saved
  data names a cell shape only when it is not square.

---

## 2d. Node board — `shared/node-canvas.js` (`Organica.nodeCanvas`) + `node-canvas.css` (Oct 2026)

A node graph: one model object is the truth; outputs, order and states are derived. Extracted
from Rhizome (`rhizome/js/graph-model.js`, `execution-engine.js`, `history.js`) at its second
consumer, the FVS Figure graph (`docs/FVS.md` §12), and fixed on the way. Classic script (no
`export`): ES-module tools read the global. Load **after `core.js`** (it calls
`Organica.createZoomPan`); the sheet **after `shell.css`** (or the tool's own skeleton). Live
reference: `/design-system/#node-canvas` (both themes, self-checked); port colours `#color`.
Consumers: FVS Figure graph. Queued: Rhizome (ledger §4).

**Model** — plain data, saved as is (`MODEL_VERSION` 2).

```js
const NC = Organica.nodeCanvas;
const model = NC.createModel(saved);   // { version, nodes:[], edges:[], frames:[] }
// node  { id, type, x, y, params, name?, w?, h?, collapsed? }
// edge  { id, from:{node, port}, to:{node, port} }
// frame { id, name, x, y, w, h }      — a Section; stored and undone with the model, not drawn yet
NC.addNode(model, { type, x, y, params, name })   // → node (id from NC.nextId('n'))
NC.removeNode(model, id)        // the node and ONLY its own wires — connected nodes keep their settings
NC.addEdge(model, from, to, multi)  // a single input keeps one wire (a new one replaces it); multi refuses a duplicate
NC.removeEdge(model, id) · NC.findNode · NC.edgesInto · NC.edgesOutOf
NC.topoSort(model)              // Kahn; throws a CycleError ("That connection would make a loop.") — never hangs
NC.wouldCycle(model, from, to)
```

**Registry** — node types and their typed ports.

```js
const registry = NC.createRegistry(types, { adapters: { 'grid->svg': fn } });
// type: { meta: { id, label, category, inputs, outputs, params }, compute(inputs, params, ctx) → { <outPort>: value } }
// port: { name, type, label?, required?, multi?, accepts? }   — inputs/outputs may be a function of the node (variable ports)
registry.get(id) · has · list() · byCategory() · inputsOf(node) · outputsOf(node) · defaults(id) · canAdapt(a, b) · adapt(a, b, v)
NC.canConnect(model, registry, from, to)   // → { ok, multi, inType, outType } or { ok:false, reason } — reason is notice copy
```

A port's `type` is one of the seven `--port-*` types (`canvas · grid · palette · content · rule ·
composition · figure`, ledger O-34) — the CSS colours the dot and the wire from it. A tool with
other type names maps them onto these (Rhizome: SVG → content, Image → figure, Grid → grid,
Color → palette, Number → rule, Points → composition). `multi: true` = a list port (many wires,
a square dot).

**Engine** — `NC.createEngine({ registry, isActive?(node), onState?(id, entry) })` →
`{ run(model) → Promise<{entries}>, touch(id), get(id), forget(id), entries, isRunning() }`.
Recomputes only what changed (a node's key = its revision, bumped by `touch`, + the output
versions of the nodes feeding it — counters, never a stringified SVG) and only what is needed
(`isActive` picks the outputs; their ancestors run with them; the rest goes `stale`). Every node
has an explicit state: `ok · error · waiting` (a required input is missing — *Connect a ‹port›
input*) `· upstream` (a node it reads failed — *Waiting for ‹node› — fix it first*) `· stale`.
Runs are serialised: a `run()` during a run schedules one more, with the latest model.

**History** — `NC.createHistory(max = 100)` → `{ push(model, meta), undo(), redo(), canUndo(),
canRedo(), clear() }`; snapshots at checkpoints (add / remove, connect, drag end, commit);
`meta` (the selection) comes back with the model.

**View** — `NC.mount(opts)` → `ctl`. It fills `opts.stage` with the board (cards, an SVG wire
layer, the marquee, a polite live region), wires `Organica.createZoomPan` with `infinite: true`,
`dblclickReset: false`, `panAlways: true`, min 0.1, max 4, and runs a default engine whose
`isActive` = the card is on screen (an `IntersectionObserver`, 25% margin) unless you pass one.

| Option | |
|---|---|
| `stage` | the element to fill (`position: relative`); it gets `.nc-stage`, `role="application"`, `aria-roledescription="node graph"` |
| `registry`, `model` | as above; the controller keeps the model — read `ctl.model` |
| `isActive()` | shortcuts and wheel only while true (e.g. the Figure step is on screen) |
| `renderBody(node, entry, el, ctl)` | fill the card body (preview, summary) after every run |
| `cardClass(node)` | extra class(es) on the card — size variants `nc-node--compact` / `nc-node--wide` |
| `nodeLabel(node)` | the card title (default `node.name` or the type's label) |
| `wireClass(edge, model)` | extra class(es) on a wire — FVS: `nc-wire--faint` for foundation wires (from Canvas / Grid / Palette) |
| `protect(node, model)` | `null`, or the reason this node can't be deleted (Delete keeps it and says why in an `Organica.notice`) |
| `onSelect(ids)` | the selection changed — fill the panel |
| `onChange(model, reason)` | anything changed (structure, positions, params) — save / mark dirty |
| `onSearch(point, from, client)` | `/` or right-click on the board: open the node search (`point` in board units) |
| `onWireDrop(from, point, client)` | a wire released on the empty board: open the search there, filtered by `from` |
| `onPortDblClick(node, port, dir)` | a port double-clicked: spawn the node it wants, wired |
| `onNodeDblClick(node, e)` | a card double-clicked outside its ports |
| `onBoardDblClick(point, client)` | the empty board double-clicked (FVS: the node search) |
| `nameCopy(node, model)` → name | the name a duplicated / pasted node gets (FVS: the next *Canvas ‹n›*) |
| `fitInset` | `{ left, bottom }` px of the stage covered by chrome (the left dock, the floatbar) — Fit keeps clear of it |
| `keepActive(node)` → bool | used by the default engine only: compute this node even when its card is off screen, because the host shows its output elsewhere (FVS: the Figure open in Compose, whose output fills the Compose sheet while the graph is hidden). Ignored when you pass your own `engine` — give it an `isActive` that does the same |
| `keyScope(target)` → bool | focus on this element still counts as the board for its keyboard shortcuts (FVS: the floatbar’s Figure actions, the inspector, the node bar — fields excluded by the host) |
| `announce(text)` | replace the default live region |
| `engine`, `history` | your own instances (default: made here) |

Controller: `model, engine, history, zoomPan, select(ids), selection(), add(type, at, params),
connect(from, to), remove(ids), duplicate(ids), setModel(model, meta)` (clears history),
`refresh(), run(), touch(id)` (params changed → recompute it and what follows), `commit(reason)`
(push a history checkpoint), `undo(), redo(), fitAll(), fitSelection(), fitTo(ids),
toBoard(clientX, clientY), cardOf(id), paint(id), remeasure(id), destroy()`.

Keys while `isActive()` and focus is not in a field: wheel zoom · Space-drag / middle-drag pan ·
drag on the board = marquee (Shift / ⌘ adds) · Delete / Backspace · ⌘/Ctrl Z, ⇧Z or Y, A, C, V,
D · arrows nudge 8 (Shift 32) · Esc · `/` search · **Shift+1** Fit all · **Shift+2** Fit selection
(ledger O-33; ⌘/Ctrl +−0 stay the browser's). Port dots have a `--hit-min` hit area at any zoom;
below 35% zoom (`.nc-stage--far`) ports and status lines hide.

CSS (`node-canvas.css`, tokens only; component-local `--node-w` 14rem, `--port-d` 10px,
`--wire-w` 1.5px, `--nc-zoom` written by the view): `.nc-stage` · `.nc-board` · `.nc-wires` ·
`.nc-nodes` · `.nc-node` (+ `__head`, `__type`, `__title`, `__io`, `__ports(--in|--out)`,
`__body`, `__status`; `.is-selected`, `.is-lifted`, `.is-collapsed`, `[data-state="error|stale"]`,
`--compact`, `--wide`) · `.nc-port` (+ `--in|--out`, `__label`, `__dot`, `__dot--multi`,
`.is-compatible`, `.is-incompatible`, `[data-type]`) · `.nc-wire` (+ `--<type>`, `--faint`,
`--pending`, `.is-related`, `.is-selected`) · `.nc-wire-hit` · `.nc-marquee` · `.nc-live`.
Card look = ledger G3 (edge `--border-strong`, no shadow at rest, `--stage-shadow` lifted, 2px
`--ink` ring selected).

### `Organica.createZoomPan` — three opt-ins for a node board (Oct 2026)

`shared/core.js`. Every existing caller is unchanged (the defaults are the old behaviour).

- **`infinite: true`** — zooming out to `min` no longer snaps the pan back to 0,0 (an image tool
  wants that; an infinite board does not).
- **`dblclickReset: false`** — double-click no longer resets the view; it belongs to the board
  (FVS: open the node search; Compose later).
- **`setView({ zoom?, panX?, panY? })`** — on the returned object: set the view outright (zoom
  clamped to min…max) — Fit all / Fit selection, restoring a saved view
  (`localStorage['organica.fvs.figure-view']`).

The returned object is now `{ zoomBy, reset, apply, setView, zoom, pan }`; the other options
(`canvas, wrap, min, max, isReady, onChange, panAlways, panStart`) are as before.

### The left dock — `.org-dock` (`shared/floatbar.css`, Oct 2026)

CSS only, no module. The optional left slot of the Tool template (ledger O-30 / O-31,
`docs/UI-SHELL.md` "Left dock"): `.org-dock` (fixed, left `--space-5`, vertically centred,
`z-index` 150, `pointer-events: none`) holding two **sibling** `.org-floatbar`s —
`.org-dock__bar` (vertical toggles, 3rem wide, tooltips to the right) and `.org-dock__panel`
(one glass panel; `data-open="true"` shows it, slides in on `--dur-base` / `--ease-out`;
`.is-dragging-away` = half opacity while something is dragged out) — plus `.org-dock__sep`.
Never nest them (a `backdrop-filter` child blurs only its parent). The dock is transformed, so
a drag ghost or popover goes on `<body>`. The tool wires `aria-expanded` / `aria-controls` on the
toggles and `inert` on the closed panel. One occupant per tool step — FVS: the Library rail
(`#fvs-rail-dock`, Element / Component / Symbol) and the Figure graph's node bar
(`#fg-nodebar-dock`). A node board under it passes `fitInset.left`. Promoted from the Library
rail at its second vertical occupant; the Suggest dock (`#fvs-sug-dock`, horizontal, top) is the
same pattern turned sideways and stays FVS-local. Reference: `/design-system/#dock`.

---

## 3. Backlog — concerns queued for the same treatment

| Concern | State today | Canonical target |
|---|---|---|
| **Palette** | Done 2026-08-30: all 14 colour-picker tools on `Organica.palette.swatch`, aliases removed, TuneSutra `setActive`, Vortex `.color-*` overrides dropped (adopts shared 18×18), livingpath's bare `<input>` → `.color-row` + `palette.swatch`. | — |
| **App shell** | Done 2026-08-30: new `shared/shell.css` owns the reset / `body` / `#app` / `#canvas-wrap` / `.org-stage` / `#zoom-hud` / `#drop-hint`. 14 tools link it and deleted their local copies (Genesis / Rhizome / Flexible Visual System keep their own canvas surface; still get the surface palette). Surface palette (`--ink`…`--border`) + `--danger` moved to `tokens.css` as defaults. `shared/_template.html` refreshed. | — |
| **Modal** | Done 2026-08-30: `.org-modal` / `__panel` / `__header` / `__title` in `panel.css`; Genesis (×2), Flexible Visual System (×2), Colornet (×1) retrofitted (backdrop + panel skeleton shared, `display` toggle + inner content stay local, width via `--org-modal-w`). | — |
| ~~`.upload-btn` / `.org-file-input`~~ | **Done 2026-08-30.** `.upload-btn` in `panel.css` (Camo Turing / Soul exact; Pollen / Membrane / Spore keep a 1-line delta; Genesis keeps a softer hover + bottom margin). `.org-file-input` on all inline sr-only `<input type=file>` blocks (komorebi / halide / spore / pollen / soul / colornet / membrane / camo-turing / fvs / genesis). | — |
| **`.org-layer-card`** | Done 2026-08-30: skeleton (border/head/body) in `panel.css`. First aliased `.layer-card` / `.chan-card` onto it, then (same day) **renamed both outright** — Colornet's `.chan-card*` → `.org-layer-card*` (incl. `.chan-card--armed` → `.chan-armed`), Camo Turing's `.layer-card*` → `.org-layer-card*` (incl. its 2 card-builder `querySelectorAll`s). Aliases deleted; only `.org-layer-card` remains. Each tool keeps its own inner controls + real deltas (Colornet's rounded corner + `.chan-armed`). | — |
| ~~Membrane `rmxColorAt` / Camo Turing `rmxLerpColor`~~ | **Not drift — a different colour lineage, kept separate on purpose.** Both port Camo Turing's *GLSL* `rmxColor()` (posterize = `floor`; tonernd = smooth lerp, ±1.5; Camo's lerp is in the renderer's linear working space to match `DISPLAY_FRAG`). `Organica.palette.colorAt` is the *Pollen* lineage (posterize = `round`; tonernd = discrete stop, ±1.2; sRGB lerp). Merging them would shift Membrane's RMX output and break Camo's SVG-vs-canvas match. Comments in both files now say so. | — |
| ~~zoom/pan~~ | **Done 2026-08-30.** CSS in `shell.css`; the JS — Spore, Pollen, Halide's ~55-line inline `applyZoom`/`zoomBy`/wheel/pan/⌘± copy — replaced by one `Organica.createZoomPan({canvas, wrap, isReady, onChange})` call + a 1-line `resetZoom()` wrapper (kept global — the HUD `onclick` + image-load path call it). Spore *gained* the ⌘± shortcuts + pre-wheel slider-blur. | — |
| `mulberry32` | core (canonical) + ~9 inline tool copies. (`transformer.js`'s copy is a deliberate guarded fallback — `Organica.mulberry32 ? … : mulberry32Fallback` — so it works standalone; leave it.) | depend on `Organica.mulberry32` |
| Seeds panel (tabbed Genesis/SVG/Text source picker) | **Component shipped** `2026-08-30` — `shared/seeds-panel.js` + `seeds-panel.css`. `Organica.seedsPanel({target,tabs,slots,subControls,extraControls,genesis,text,svg,image,applyMode,onSeed,onTabChange,onFontReady,onError})` → `{el,getTab,setTab,getDescriptor,getSVGString,apply,emit,slot,refreshGenesisGrid,setFont,setText,destroy}`. Polymorphic on `typeof target` (element = generate / string = attach). Emits BOTH `svgString` (canonical vector) **and** a raw `descriptor` — each tool keeps its own model step. `.PRIMORDIAL` is the shared curated form list — **since 2026-08-30 it is the 13 Genesis Base Seeds** (`[1,2,3,7,9,13,14,21,26,28,37,41,56]`), the same set `forms.js` was reduced to; there is no longer a "subset of a bigger catalog" distinction. Pollen and Spore keep a local literal copy of the 13 (they don't load `seeds-panel.js`) with a `// keep in sync with shared/seeds-panel.js` note; both `.filter(n => F[n])` so a shrunk `ORGANIC_FORMS` degrades safely. **Adopted:** Membrane (Procedural + Image as custom slots, Text built-in with `preloadFont:false`, `onTabChange` = reseed dispatch), **Camo Turing** (2 instances `seedsB`/`seedsA`, `idPrefix`, `applyMode:'manual'`, `genesis.bakeGeometry:true`, `allowFontUpload`; Mode/Size/Two-seeds/famine + Apply stay as plain markup siblings; `rasterizeCurrentSeed`/`rasterizeShapeA`/`applyPaperImageMode`/`rasterizeTextSource` rewired to `getDescriptor()`/`getSVGString()`; the local `rasterizeGenesisSource` kept — parameterised by `formId` — only for the `window.test*` probes). **Living Path** takes only `Organica.seedsPanel.PRIMORDIAL` (the last byte-identical copy of the curated list, was in 5 files) — its own Font/SVG/Genesis picker stays bespoke: `.seg`/`.drop`/`.forms` markup, visible drop-zones, an OTF-export "Font" workbench, and it links none of the shared panel CSS. A full adoption is gated on Living Path moving to the shared shell (its own pass). | done |
| ~~file drop-zone / `.upload-btn`~~ | **done 2026-08-30** — `.upload-btn` + `.org-file-input` in `panel.css`, `#drop-hint` / `.drop-icon` in `shell.css`. | — |
| `Organica.zip` (store-only writer) | **Live again `2026-09-08`.** `shared/zip.js` — `Organica.zip()` → `{add(path, data), blob()}`, STORE-only (method 0) + CRC32, synthesises directory entries. First shipped for Mote's SVG-sequence export, deleted `2026-09-01` with that feature, **re-added** for Living Path's Phase-3 UFO + `.designspace` bundle export (`shared/ufo-export.js` writes the file map, `zip.js` packs it). Still a candidate for **Colornet's "Batch"** (currently sequential downloads with a 220–350 ms anti-burst delay). | shared |
| floatbar video/PNG export (`canvas.captureStream` + `MediaRecorder`) | **Done `2026-08-30`** — `shared/recorder.js` (no paired CSS, ships no UI). `Organica.recorder({canvas,tool,fps,duration,durationPadMs,onStart,onStatus,onStateChange})` → `{toggle,start,stop,isRecording}`. `canvas` may be a function (p5 tools whose canvas isn't up at construct time). Merged best version: superset 5-entry MIME list (`mp4;avc1`→`mp4`→`webm;vp9`→`webm;vp8`→`webm`), extension **sniffed from the negotiated `mediaRecorder.mimeType`**, `duration` omitted = manual-stop / number|fn = auto-stop (Pulsar `loopSec`+`90ms`). **Adopted:** Pulsar, Camo Turing, Vortex, Membrane (each keeps its own floatbar button + wiring). | — |
| ~~`syncColor` single-swatch~~ | **done** (2026-08-30) — every production tool on `Organica.palette.swatch` attach mode; `shared/_template.html` refreshed the same day. | — |
| inline `style="display:none"` toggles | ~190 static inline toggles; a cross-ref (`node xref.js`) confirmed **all of them are JS-toggled** — via `el.style.display = '' / 'none'`, `forEach(id => …)`, `'prefix-' + t` id concatenation, or `show()`/`toggleRow()` helpers — so a plain `hidden` + `[hidden]{display:none!important}` swap would break every one. The honest version is a shared `Organica.show(el, bool)` (maps `'' ↔ 'none'` → `el.hidden`) + the safety rule, changing the *mechanism* not just the markup. Not started. | `Organica.show()` + `hidden` |
| **Print size / DPI** | **Done 2026-09-07** — `shared/print-size.js` (pure math: `UNIT_TO_MM` incl. `in`, `toMM`/`mmToPx`/`pxToMm`, a from-scratch PNG `pHYs`-chunk writer `embedPngDpi`, `bleedBox`/`cropMarks`/`cropMarksSVG`/`drawCropMarksCanvas`) + `shared/print-size-panel.js` (`Organica.printSizePanel(target, opts)` → the shared Screen/Print `.seg-ctrl` panel — an explicit, always-visible mode choice, not a unit dropdown that silently grows fields). Screen is the default and every consumer's Screen-mode export is byte-identical to before this landed. **Adopted by all 5 planned tools:** Loom (bespoke Screen/Print split — it already had a real unit selector, so it didn't need the shared panel, just the math module + its own DPI field), Pollen, Spore, Halide, Flexible Visual System (panel title "Print (selection)" — its trim is the selected Component's own square frame, not a canvas). Each tool's raster export gains a bleed-inclusive canvas (flat-fill background extension + crop marks — v1 discipline, no per-generator/mark/region edge extrapolation) + a real embedded PNG pHYs chunk; each SVG export wraps the *same* inner markup a Screen-mode export already builds (`buildPointsMarkup`/`buildSVGInner`/`buildComponentSVGBody`/etc. — one shared body-builder per tool, split out as a pure refactor) in a physical-mm document with bleed + crop marks. **Extended, same phase (Colornet print-production pass, still Sep 2026):** `lpiToPx(lpi,dpi) = dpi/lpi` (real screen-ruling cell size, no trim-size dependency) + `registrationMarks`/`registrationMarksSVG`/`drawRegistrationMarksCanvas` (crosshair-in-circle marks at each trim edge's midpoint, never the corners crop marks already occupy) — Colornet joined the panel (its own AM "Lineature" now ties to real DPI/lpi instead of an abstract mask-resolution ratio), and gained a real per-plate SVG export alongside its existing PNG. **Deliberately not built:** JPG DPI (JFIF APP0, not a PNG pHYs chunk). | — |
| **Plate export (N discrete inks → N files)** | **Done, same Colornet phase** — `shared/plate-export.js` (`Organica.plateExport.run(count, {build, stagger, onDone})`, generalizing Colornet's own inline per-channel PNG loop) + `shared/palette.js`'s `rmxIndex`/`isSplittable` (the discrete-classification core `rmxColor`'s own posterize/random/tonernd branches already implemented, pulled out so external callers can classify a point/mark by ink without re-deriving the colour math — `isSplittable(mode,submode)` is the UI gate: false for `'tone'`, false for any non-`'rmx'` mode). **Adopted by Colornet** (per-channel plate PNG/SVG, forced black-on-white/transparent per plate, registration marks added), **Pollen** (per-point, classified via `rmxIndex` since Pollen never stores a resolved colour — `buildPointsMarkup`/`paintPoints` gained a `forceInk` override), **Spore** (per-mark, a plain colour-equality filter since Spore's marks already store a resolved `.color` string — `buildSporeMarksMarkup`/`paintSporeMarksScaled` gained `forceColor`). Extracted at the 2nd+3rd real consumer (Pollen, Spore) alongside Colornet (1st) — this repo's own "extract at the second consumer" convention. | — |

---

*Organica · Updated August 2026*
