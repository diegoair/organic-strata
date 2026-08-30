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
| vortex | ✅ | ✅ | ✅ `bg` (shared `.color-*`, no local overrides) | ✅ | n/a (index cycle) |
| livingpath | ✅ | — | ✅ `ink`,`bg` | — | — |
| fvs | ✅ | ✅ | ✅ `paper` | ✅ (min 1) | n/a (index cycle) |
| tunesutra | ✅ | ✅ | — (bespoke RGB/HSB role editor) | ✅ (min 3 / max 7, `(colors,index,kind)` onChange, `setActive` for the active chip) | n/a |
| colornet | ✅ | — | ✅ `bg` | — (channel list is `.org-layer-card` + its own inner controls) | ✅ |
| pulsar | ✅ | — | ✅ `ink/paper` | — | — |
| design-system | — | ✅ (demo) | — | — | — |
| genesis, loom, soul, mycel, rhizome, hub | — | — | no colour UI | — | — |

The back-compat aliases (`Organica.createColorSwatch` / `createPaletteChips` /
`Organica.Palette.colorAt`) were **removed 2026-08-30** once every call site migrated.

---

## 3. Backlog — concerns queued for the same treatment

| Concern | State today | Canonical target |
|---|---|---|
| **Palette** | Done 2026-08-30: all 14 colour-picker tools on `Organica.palette.swatch`, aliases removed, TuneSutra `setActive`, Vortex `.color-*` overrides dropped (adopts shared 18×18), livingpath's bare `<input>` → `.color-row` + `palette.swatch`. | — |
| **App shell** | Done 2026-08-30: new `shared/organica-shell.css` owns the reset / `body` / `#app` / `#canvas-wrap` / `.org-stage` / `#zoom-hud` / `#drop-hint`. 14 tools link it and deleted their local copies (Genesis / Rhizome / FVS keep their own canvas surface; still get the surface palette). Surface palette (`--ink`…`--border`) + `--danger` moved to `organica-tokens.css` as defaults. `shared/_template.html` refreshed. | — |
| **Modal** | Done 2026-08-30: `.org-modal` / `__panel` / `__header` / `__title` in `organica-panel.css`; Genesis (×2), FVS (×2), Colornet (×1) retrofitted (backdrop + panel skeleton shared, `display` toggle + inner content stay local, width via `--org-modal-w`). | — |
| **`.upload-btn` / `.org-file-input`** | Done 2026-08-30: both in `organica-panel.css`; Camo Turing / Soul / Membrane / Pollen adopted `.upload-btn` (Pollen + Membrane keep a 1-line delta), 8 tools' hidden file inputs → `.org-file-input`. Spore's `.upload-mark-btn` + Genesis's own `--fs-xs`-scale `.upload-btn` left local. | — |
| **`.org-layer-card`** | Done 2026-08-30: skeleton (border/head/body) in `organica-panel.css`. First aliased `.layer-card` / `.chan-card` onto it, then (same day) **renamed both outright** — Colornet's `.chan-card*` → `.org-layer-card*` (incl. `.chan-card--armed` → `.chan-armed`), Camo Turing's `.layer-card*` → `.org-layer-card*` (incl. its 2 card-builder `querySelectorAll`s). Aliases deleted; only `.org-layer-card` remains. Each tool keeps its own inner controls + real deltas (Colornet's rounded corner + `.chan-armed`). | — |
| ~~Membrane `rmxColorAt` / Camo Turing `rmxLerpColor`~~ | **Not drift — a different colour lineage, kept separate on purpose.** Both port Camo Turing's *GLSL* `rmxColor()` (posterize = `floor`; tonernd = smooth lerp, ±1.5; Camo's lerp is in the renderer's linear working space to match `DISPLAY_FRAG`). `Organica.palette.colorAt` is the *Pollen* lineage (posterize = `round`; tonernd = discrete stop, ±1.2; sRGB lerp). Merging them would shift Membrane's RMX output and break Camo's SVG-vs-canvas match. Comments in both files now say so. | — |
| ~~zoom/pan~~ | **Done 2026-08-30.** CSS in `organica-shell.css`; the JS — Spore, Pollen, Halide's ~55-line inline `applyZoom`/`zoomBy`/wheel/pan/⌘± copy — replaced by one `Organica.createZoomPan({canvas, wrap, isReady, onChange})` call + a 1-line `resetZoom()` wrapper (kept global — the HUD `onclick` + image-load path call it). Spore *gained* the ⌘± shortcuts + pre-wheel slider-blur. | — |
| `mulberry32` | core (canonical) + ~9 inline tool copies. (`organica-transformer.js`'s copy is a deliberate guarded fallback — `Organica.mulberry32 ? … : mulberry32Fallback` — so it works standalone; leave it.) | depend on `Organica.mulberry32` |
| Seeds panel (tabbed Genesis/SVG/Text source picker) | Camo Turing + Soul + Pulsar-adjacent all hand-roll the tab strip + shape grid | new `Organica.seedsPanel` |
| ~~file drop-zone / `.upload-btn`~~ | **done 2026-08-30** — `.upload-btn` + `.org-file-input` in `organica-panel.css`, `#drop-hint` / `.drop-icon` in `organica-shell.css`. | — |
| floatbar video/PNG export (`canvas.captureStream` + `MediaRecorder`) | Soul, Camo Turing, Membrane, Vortex, Pulsar repeat the recorder + MIME-fallback dance | new `Organica.recorder` |
| ~~`syncColor` single-swatch~~ | **done** (2026-08-30) — every production tool on `Organica.palette.swatch` attach mode; `shared/_template.html` refreshed the same day. | — |
| inline `style="display:none"` toggles | ~190 static inline toggles; a cross-ref (`node xref.js`) confirmed **all of them are JS-toggled** — via `el.style.display = '' / 'none'`, `forEach(id => …)`, `'prefix-' + t` id concatenation, or `show()`/`toggleRow()` helpers — so a plain `hidden` + `[hidden]{display:none!important}` swap would break every one. The honest version is a shared `Organica.show(el, bool)` (maps `'' ↔ 'none'` → `el.hidden`) + the safety rule, changing the *mechanism* not just the markup. Not started. | `Organica.show()` + `hidden` |

---

*Organica · Updated August 2026*
