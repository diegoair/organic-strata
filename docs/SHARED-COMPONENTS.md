# Organica — Shared Components & the centralization pattern

> Studio Rann · Organica
> The contract + playbook for the `Organica.*` JS/CSS component system.
> (Sibling doc: `SHARED-LIBRARY.md`, which covers only the Genesis `organic-*` forms.)

---

## 1. The centralization pattern (reusable — apply it to any scattered concern)

When the same behaviour has been hand-rolled in N tools and started to drift, fold it
into one shared module. The Palette component (§2) is the worked example; the same
eight steps apply to every entry in the backlog (§3).

1. **Inventory** — Explore agents, not guesswork. Find every copy, the divergence
   (params, side effects, CSS sizes), the consumers, and where the CSS lives.
2. **Canonical home** — reuse an existing `shared/organica-*.js` if the concern fits its
   identity; otherwise a new `shared/organica-<name>.js`. If the concern ships UI, pair a
   `shared/organica-<name>.css` — **unless** the CSS is already universal in
   `organica-panel.css` (like `.color-*`), which stays there.
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

## 2. Palette component — `shared/organica-palette.js` (+ `organica-palette.css`)

One polymorphic entry point for every colour control:

```js
// ATTACH — target is a string prefix. Wires #cp-/#hex-/#sw-/#btn-random-<prefix>
//   inside a labelled .color-row (CSS in organica-panel.css — universally linked).
const ink = Organica.palette.swatch('ink', { initial: '#1c1c1c', onChange: repaint });
//   onChange(hex, rgb255) — the legacy 2-arg signature.

// GENERATE — target is an HTMLElement. Builds .rmx-color chips into it.
//   Needs organica-palette.css. opts.max > 1 ⇒ RMX strip with + / × .
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

**Load:** after `organica-core.js`. Link `organica-palette.css` only in generate-mode
tools. **CSS custom props:** `--rmx-cell-w/h`, `--rmx-cell-radius`, `--rmx-cell-border`,
`--rmx-palette-mb`, `--icon-btn-w/h` (TuneSutra sets the first four for its 30×26 rounded
cell; Spore/Pollen set `--rmx-palette-mb: 0`).

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
| vortex | ✅ | ✅ | ✅ `bg` | ✅ | n/a (index cycle) |
| fvs | ✅ | ✅ | ✅ `paper` | ✅ (min 1) | n/a (index cycle) |
| tunesutra | ✅ | ✅ | — (bespoke RGB/HSB role editor) | ✅ (min 3 / max 7, `(colors,index,kind)` onChange, `setActive` for the active chip) | n/a |
| colornet | ✅ | — | ✅ `bg` | — (bespoke `.chan-card` channel list) | ✅ |
| pulsar | ✅ | — | ✅ `ink/paper` | — | — |
| design-system | — | ✅ (demo) | — | — | — |
| genesis, loom, soul, mycel, rhizome, livingpath, hub | — | — | (livingpath: bare `<input>` — Phase 3) | — | — |

The back-compat aliases (`Organica.createColorSwatch` / `createPaletteChips` /
`Organica.Palette.colorAt`) were **removed 2026-08-30** once every call site migrated.

---

## 3. Backlog — concerns queued for the same treatment

| Concern | State today | Canonical target |
|---|---|---|
| **Palette Phase 3** | Membrane `js/color.js rmxColorAt` keeps private tone/posterize/random/tonernd math (its `tonernd` is a smooth lerp, `colorAt`'s is a discrete stop — output would shift); Camo Turing's JS SVG-export `rmxLerpColor` lerps in THREE.Color space (linear when `ColorManagement` is on) vs `palette.mix`'s sRGB lerp — intermediate band colours could shift; Vortex re-declares `.color-*` at 26×22 (a real visual change to adopt the shared 18×18); livingpath uses a bare `<input type=color>` + read-only `.val` span (adopting `palette.swatch` adds a swatch button + editable hex it never had). Each needs a screenshot/output sign-off. *(TuneSutra's `setActive` migration — done 2026-08-30.)* | `Organica.palette.colorAt` / `.swatch` |
| zoom/pan | Spore, Pollen, Halide run inline copies (`UI-SHELL` §7) | `Organica.createZoomPan` (already in core) |
| `mulberry32` | core (canonical) + `organica-transformer.js` + ~9 inline tool copies | depend on `Organica.mulberry32` |
| Seeds panel (tabbed Genesis/SVG/Text source picker) | Camo Turing + Soul + Pulsar-adjacent all hand-roll the tab strip + shape grid | new `Organica.seedsPanel` |
| file drop-zone / `.upload-btn` | ~5 tools, each with a "not in organica-panel.css" comment | shared `.upload-zone` in `organica-panel.css` |
| floatbar video/PNG export (`canvas.captureStream` + `MediaRecorder`) | Soul, Camo Turing, Membrane, Vortex, Pulsar repeat the recorder + MIME-fallback dance | new `Organica.recorder` |
| `syncColor` single-swatch | **done** (2026-08-30) — folded into `Organica.palette.swatch` attach mode | — |

---

*Studio Rann · Updated August 2026*
